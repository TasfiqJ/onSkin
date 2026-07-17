import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  HEALTH_PROCESSING_STATUS_LEASE_MS,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  acknowledgeRoutineWidgetActionTokens,
  clearRoutineWidgetActions,
  discardRoutineWidgetPreparedActions,
  prepareRoutineWidgetActions,
  retainOnlyPublishedRoutineWidgetActions,
  resolveRoutineWidgetActionTokens,
  ROUTINE_WIDGET_ACTION_AUTHORITY_STALE,
  ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE,
  ROUTINE_WIDGET_ACTION_INPUT_INVALID,
  ROUTINE_WIDGET_ACTION_REGISTRY_INVALID,
  ROUTINE_WIDGET_ACTION_REGISTRY_KEY,
  ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION,
  ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY,
} from './actionRegistry';

const mocks = vi.hoisted(() => ({
  removeFailures: new Set<string>(),
  storage: new Map<string, string>(),
  uuids: [] as string[],
  fallbackUuidCounter: 100,
}));

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => {
    const queued = mocks.uuids.shift();
    if (queued) return queued;
    const suffix = String(mocks.fallbackUuidCounter++).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  }),
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  removePrivateItem: vi.fn(async (key: string) => {
    if (mocks.removeFailures.has(key)) throw new Error(`remove failed:${key}`);
    mocks.storage.delete(key);
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const current = mocks.storage.get(key) ?? null;
      const next = updater(current);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
}));

const NOW = Date.parse('2026-07-16T12:00:00.000Z');
const DAY = '2026-07-16';
const OWNER_GENERATION = '00000000-0000-4000-8000-0000000000a1';
const OWNER_GENERATION_B = '00000000-0000-4000-8000-0000000000b1';
const SNAPSHOT = '00000000-0000-4000-8000-000000000001';
const TOKEN_A = '00000000-0000-4000-8000-000000000002';
const TOKEN_B = '00000000-0000-4000-8000-000000000003';
const UNKNOWN_TOKEN = '00000000-0000-4000-8000-000000000099';
const SNAPSHOT_2 = '00000000-0000-4000-8000-000000000010';
const TOKEN_C = '00000000-0000-4000-8000-000000000011';

function openLease(options: { ownerUserId?: string; verifiedAt?: string | null } = {}) {
  return setActiveHealthProcessingEpoch(7, {
    ownerUserId: options.ownerUserId ?? 'owner-a',
    accountGeneration: 0,
    serverVerifiedAt:
      options.verifiedAt === undefined ? new Date(NOW).toISOString() : options.verifiedAt,
  });
}

function storedRegistry(): { version?: number; snapshots?: Record<string, unknown>[] } {
  return JSON.parse(mocks.storage.get(ROUTINE_WIDGET_ACTION_REGISTRY_KEY) ?? '{}') as {
    version?: number;
    snapshots?: Record<string, unknown>[];
  };
}

async function prepare(expiresAt = NOW + 60_000) {
  mocks.uuids.push(SNAPSHOT, TOKEN_A, TOKEN_B);
  return prepareRoutineWidgetActions({
    ownerGeneration: OWNER_GENERATION,
    localDate: DAY,
    phase: 'PM',
    stepKeys: ['PM:cleanser', 'PM:moisturizer'],
    expiresAt,
  });
}

function resolve(
  tokens: readonly string[],
  overrides: Partial<{
    ownerGeneration: string;
    snapshotNonce: string;
    localDate: string;
    phase: 'AM' | 'PM';
    createdAtMs: number;
  }> = {},
) {
  return resolveRoutineWidgetActionTokens({
    events: tokens.map((token) => ({ token, createdAtMs: overrides.createdAtMs ?? NOW })),
    ownerGeneration: overrides.ownerGeneration ?? OWNER_GENERATION,
    snapshotNonce: overrides.snapshotNonce ?? SNAPSHOT,
    localDate: overrides.localDate ?? DAY,
    phase: overrides.phase ?? 'PM',
  });
}

function acknowledge(tokens: readonly string[], snapshotNonce = SNAPSHOT, createdAtMs = NOW) {
  return acknowledgeRoutineWidgetActionTokens({
    events: tokens.map((token) => ({ token, createdAtMs })),
    ownerGeneration: OWNER_GENERATION,
    snapshotNonce,
  });
}

async function prepareReplacement(expiresAt: number) {
  mocks.uuids.push(SNAPSHOT_2, TOKEN_C);
  return prepareRoutineWidgetActions({
    ownerGeneration: OWNER_GENERATION,
    localDate: DAY,
    phase: 'PM',
    stepKeys: ['PM:replacement'],
    expiresAt,
  });
}

describe('encrypted multi-snapshot routine widget action registry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    clearActiveHealthProcessingEpoch();
    mocks.storage.clear();
    mocks.removeFailures.clear();
    mocks.uuids = [];
    mocks.fallbackUuidCounter = 100;
    vi.clearAllMocks();
    openLease();
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
    vi.useRealTimers();
  });

  it('returns only opaque binding values while keeping owner and step mappings private', async () => {
    const lease = activeHealthProcessingLeaseSnapshot();
    await expect(prepare()).resolves.toEqual({
      actionTokens: [TOKEN_A, TOKEN_B],
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT,
    });

    const stored = storedRegistry();
    expect(stored.version).toBe(2);
    expect(stored.snapshots).toEqual([
      {
        ownerUserId: 'owner-a',
        ownerGeneration: OWNER_GENERATION,
        processingEpoch: 7,
        processingGeneration: lease?.generation,
        accountGeneration: 0,
        localDate: DAY,
        phase: 'PM',
        snapshotNonce: SNAPSHOT,
        createdAt: NOW,
        expiresAt: NOW + 60_000,
        actions: [
          { token: TOKEN_A, stepKey: 'PM:cleanser' },
          { token: TOKEN_B, stepKey: 'PM:moisturizer' },
        ],
      },
    ]);
  });

  it('retains snapshot A while B is prepared and resolves each only by exact identity', async () => {
    await prepare();
    await prepareReplacement(NOW + 90_000);

    expect(storedRegistry().snapshots).toHaveLength(2);
    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: 'PM:cleanser', status: 'resolved' },
    ]);
    await expect(resolve([TOKEN_C], { snapshotNonce: SNAPSHOT_2 })).resolves.toEqual([
      { token: TOKEN_C, stepKey: 'PM:replacement', status: 'resolved' },
    ]);
    await expect(resolve([TOKEN_A], { snapshotNonce: SNAPSHOT_2 })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'unknown' },
    ]);
  });

  it('discards a never-published retry and prunes superseded mappings after native replacement', async () => {
    await prepare();
    await prepareReplacement(NOW + 60_000);
    expect(storedRegistry().snapshots).toHaveLength(2);

    await discardRoutineWidgetPreparedActions({
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_2,
    });
    expect(storedRegistry().snapshots?.map(({ snapshotNonce }) => snapshotNonce)).toEqual([
      SNAPSHOT,
    ]);

    await prepareReplacement(NOW + 60_000);
    await retainOnlyPublishedRoutineWidgetActions({
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: SNAPSHOT_2,
    });
    expect(storedRegistry().snapshots?.map(({ snapshotNonce }) => snapshotNonce)).toEqual([
      SNAPSHOT_2,
    ]);
    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'unknown' },
    ]);

    await retainOnlyPublishedRoutineWidgetActions({
      ownerGeneration: OWNER_GENERATION,
      snapshotNonce: null,
    });
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(false);
  });

  it('rejects transplanted owner generation, snapshot, date, and phase', async () => {
    await prepare();
    await expect(resolve([TOKEN_A], { ownerGeneration: OWNER_GENERATION_B })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'unknown' },
    ]);
    await expect(resolve([TOKEN_A], { snapshotNonce: UNKNOWN_TOKEN })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'unknown' },
    ]);
    await expect(resolve([TOKEN_A], { localDate: '2026-07-15' })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
    await expect(resolve([TOKEN_A], { phase: 'AM' })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
  });

  it('acknowledges only the exact snapshot and preserves other in-flight snapshots', async () => {
    await prepare();
    await prepareReplacement(NOW + 90_000);

    await expect(acknowledge([TOKEN_A])).resolves.toBe(1);
    expect(storedRegistry().snapshots?.[0]?.actions).toEqual([
      { token: TOKEN_B, stepKey: 'PM:moisturizer' },
    ]);
    await expect(acknowledge([TOKEN_C], SNAPSHOT_2)).resolves.toBe(1);
    expect(storedRegistry().snapshots).toHaveLength(1);
    await expect(acknowledge([TOKEN_B])).resolves.toBe(1);
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(false);
  });

  it('reconciles a proven pre-expiry native acceptance after display expiry', async () => {
    await prepare(NOW + 30_000);
    vi.advanceTimersByTime(30_000);
    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: 'PM:cleanser', status: 'resolved' },
    ]);
    await expect(acknowledge([TOKEN_A])).resolves.toBe(1);
  });

  it('rejects event-time transplants at or outside the accepted snapshot window', async () => {
    await prepare(NOW + 30_000);
    await expect(resolve([TOKEN_A], { createdAtMs: NOW - 1 })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'expired' },
    ]);
    vi.advanceTimersByTime(30_000);
    await expect(resolve([TOKEN_A], { createdAtMs: NOW + 30_000 })).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'expired' },
    ]);
    await expect(acknowledge([TOKEN_A], SNAPSHOT, NOW + 30_000)).rejects.toThrow(
      'ROUTINE_WIDGET_ACTION_EXPIRED',
    );
  });

  it('fails closed on clock rollback, lease renewal, and owner transition', async () => {
    await prepare(NOW + 120_000);
    vi.setSystemTime(NOW - 1);
    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
    await expect(acknowledge([TOKEN_A])).rejects.toThrow(ROUTINE_WIDGET_ACTION_AUTHORITY_STALE);

    vi.setSystemTime(NOW + 10_000);
    openLease({ verifiedAt: new Date(NOW + 10_000).toISOString() });
    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);

    clearActiveHealthProcessingEpoch();
    openLease({ ownerUserId: 'owner-b' });
    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
  });

  it('replaces malformed state during preparation but preserves a future schema', async () => {
    await prepare();
    const malformed = JSON.stringify({ ...storedRegistry(), unexpected: true });
    mocks.storage.set(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, malformed);
    await expect(resolve([TOKEN_A])).rejects.toThrow(ROUTINE_WIDGET_ACTION_REGISTRY_INVALID);
    await expect(prepareReplacement(NOW + 30_000)).resolves.toMatchObject({
      snapshotNonce: SNAPSHOT_2,
    });

    const future = JSON.stringify({ version: 3, snapshots: [] });
    mocks.storage.set(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, future);
    await expect(resolve([TOKEN_A])).rejects.toThrow(
      ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION,
    );
    mocks.uuids.push('00000000-0000-4000-8000-000000000012');
    await expect(
      prepareRoutineWidgetActions({
        ownerGeneration: OWNER_GENERATION,
        localDate: DAY,
        phase: 'PM',
        stepKeys: [],
        expiresAt: NOW + 30_000,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(future);
  });

  it('rejects invalid bindings and expiry beyond the five-minute authority', async () => {
    await expect(
      prepareRoutineWidgetActions({
        ownerGeneration: OWNER_GENERATION,
        snapshotNonce: OWNER_GENERATION,
        localDate: DAY,
        phase: 'PM',
        stepKeys: ['PM:cleanser'],
        expiresAt: NOW + 60_000,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    mocks.uuids.push(SNAPSHOT, TOKEN_A);
    await expect(
      prepareRoutineWidgetActions({
        ownerGeneration: OWNER_GENERATION,
        localDate: DAY,
        phase: 'PM',
        stepKeys: ['AM:cleanser'],
        expiresAt: NOW + 60_000,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_INPUT_INVALID);
    mocks.uuids.push(SNAPSHOT, TOKEN_A);
    await expect(
      prepareRoutineWidgetActions({
        ownerGeneration: OWNER_GENERATION,
        localDate: DAY,
        phase: 'PM',
        stepKeys: ['PM:cleanser'],
        expiresAt: NOW + HEALTH_PROCESSING_STATUS_LEASE_MS + 1,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE);
  });

  it('keeps current and legacy deletion lanes available after health processing closes', async () => {
    await prepare();
    mocks.storage.set(ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY, '{"version":1}');
    clearActiveHealthProcessingEpoch();
    await expect(clearRoutineWidgetActions()).resolves.toBeUndefined();
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(false);
    expect(mocks.storage.has(ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY)).toBe(false);
  });

  it('attempts both capability-key removals when either encrypted deletion fails', async () => {
    await prepare();
    mocks.storage.set(ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY, '{"version":1}');
    mocks.removeFailures.add(ROUTINE_WIDGET_ACTION_REGISTRY_KEY);
    clearActiveHealthProcessingEpoch();

    await expect(clearRoutineWidgetActions()).rejects.toThrow(
      `remove failed:${ROUTINE_WIDGET_ACTION_REGISTRY_KEY}`,
    );
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(true);
    expect(mocks.storage.has(ROUTINE_WIDGET_LEGACY_ACTION_REGISTRY_KEY)).toBe(false);
  });
});
