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
  prepareRoutineWidgetActions,
  resolveRoutineWidgetActionTokens,
  ROUTINE_WIDGET_ACTION_AUTHORITY_STALE,
  ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE,
  ROUTINE_WIDGET_ACTION_INPUT_INVALID,
  ROUTINE_WIDGET_ACTION_REGISTRY_INVALID,
  ROUTINE_WIDGET_ACTION_REGISTRY_KEY,
  ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION,
} from './actionRegistry';

const mocks = vi.hoisted(() => ({
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

function storedEnvelope(): Record<string, unknown> {
  return JSON.parse(mocks.storage.get(ROUTINE_WIDGET_ACTION_REGISTRY_KEY) ?? '{}') as Record<
    string,
    unknown
  >;
}

async function prepare(expiresAt = NOW + 60_000) {
  mocks.uuids.push(SNAPSHOT, TOKEN_A, TOKEN_B);
  return prepareRoutineWidgetActions({
    localDate: DAY,
    phase: 'PM',
    stepKeys: ['PM:cleanser', 'PM:moisturizer'],
    expiresAt,
  });
}

function resolve(tokens: readonly string[]) {
  return resolveRoutineWidgetActionTokens({ tokens, localDate: DAY, phase: 'PM' });
}

async function prepareReplacement(expiresAt: number) {
  mocks.uuids.push(SNAPSHOT_2, TOKEN_C);
  return prepareRoutineWidgetActions({
    localDate: DAY,
    phase: 'PM',
    stepKeys: ['PM:replacement'],
    expiresAt,
  });
}

describe('encrypted routine widget action registry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    clearActiveHealthProcessingEpoch();
    mocks.storage.clear();
    mocks.uuids = [];
    mocks.fallbackUuidCounter = 100;
    vi.clearAllMocks();
    openLease();
  });

  afterEach(() => {
    clearActiveHealthProcessingEpoch();
    vi.useRealTimers();
  });

  it('returns only opaque tokens while keeping the exact authority and step mapping private', async () => {
    const lease = activeHealthProcessingLeaseSnapshot();

    const prepared = await prepare();
    expect(prepared).toEqual({
      actionTokens: [TOKEN_A, TOKEN_B],
      snapshotNonce: SNAPSHOT,
    });

    expect(Object.keys(prepared).sort()).toEqual(['actionTokens', 'snapshotNonce']);
    const stored = storedEnvelope();
    expect(stored).toEqual({
      version: 1,
      ownerUserId: 'owner-a',
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
    });
  });

  it('resolves current tokens and never reveals a step for an unknown capability', async () => {
    await prepare();

    await expect(resolve([TOKEN_B, UNKNOWN_TOKEN])).resolves.toEqual([
      { token: TOKEN_B, stepKey: 'PM:moisturizer', status: 'resolved' },
      { token: UNKNOWN_TOKEN, stepKey: null, status: 'unknown' },
    ]);
  });

  it('rejects a token transplanted into a different widget date, phase, or snapshot', async () => {
    await prepare();

    for (const request of [
      { tokens: [TOKEN_A], localDate: '2026-07-15', phase: 'PM' as const },
      { tokens: [TOKEN_A], localDate: DAY, phase: 'AM' as const },
      {
        tokens: [TOKEN_A],
        localDate: DAY,
        phase: 'PM' as const,
        snapshotNonce: UNKNOWN_TOKEN,
      },
    ]) {
      await expect(resolveRoutineWidgetActionTokens(request)).resolves.toEqual([
        { token: TOKEN_A, stepKey: null, status: 'stale' },
      ]);
    }
  });

  it('acknowledges only requested capabilities and deletes the empty registry', async () => {
    await prepare();

    await expect(acknowledgeRoutineWidgetActionTokens([TOKEN_A])).resolves.toBe(1);
    expect(storedEnvelope().actions).toEqual([{ token: TOKEN_B, stepKey: 'PM:moisturizer' }]);
    await expect(acknowledgeRoutineWidgetActionTokens([TOKEN_A])).resolves.toBe(0);
    await expect(acknowledgeRoutineWidgetActionTokens([TOKEN_B])).resolves.toBe(1);
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(false);
  });

  it('fails closed after the capability expires while its health lease is still current', async () => {
    await prepare(NOW + 30_000);
    vi.advanceTimersByTime(30_000);

    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'expired' },
    ]);
    await expect(acknowledgeRoutineWidgetActionTokens([TOKEN_A])).rejects.toThrow(
      'ROUTINE_WIDGET_ACTION_EXPIRED',
    );

    await expect(prepareReplacement(NOW + 90_000)).resolves.toEqual({
      actionTokens: [TOKEN_C],
      snapshotNonce: SNAPSHOT_2,
    });
    await expect(resolve([TOKEN_C])).resolves.toEqual([
      { token: TOKEN_C, stepKey: 'PM:replacement', status: 'resolved' },
    ]);
  });

  it('fails closed if the device clock moves before the registry creation time', async () => {
    await prepare();
    vi.setSystemTime(NOW - 1);

    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
    await expect(acknowledgeRoutineWidgetActionTokens([TOKEN_A])).rejects.toThrow(
      ROUTINE_WIDGET_ACTION_AUTHORITY_STALE,
    );
  });

  it('fails closed after a same-owner status renewal changes the processing generation', async () => {
    await prepare(NOW + 120_000);
    vi.advanceTimersByTime(10_000);
    openLease({ verifiedAt: new Date(NOW + 10_000).toISOString() });

    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
    await expect(acknowledgeRoutineWidgetActionTokens([TOKEN_A])).rejects.toThrow(
      ROUTINE_WIDGET_ACTION_AUTHORITY_STALE,
    );

    await expect(prepareReplacement(NOW + 90_000)).resolves.toEqual({
      actionTokens: [TOKEN_C],
      snapshotNonce: SNAPSHOT_2,
    });
    await expect(resolve([TOKEN_C])).resolves.toEqual([
      { token: TOKEN_C, stepKey: 'PM:replacement', status: 'resolved' },
    ]);
  });

  it('does not expose a prior owner mapping after an owner transition', async () => {
    await prepare();
    clearActiveHealthProcessingEpoch();
    openLease({ ownerUserId: 'owner-b' });

    await expect(resolve([TOKEN_A])).resolves.toEqual([
      { token: TOKEN_A, stepKey: null, status: 'stale' },
    ]);
    await expect(prepareReplacement(NOW + 60_000)).resolves.toEqual({
      actionTokens: [TOKEN_C],
      snapshotNonce: SNAPSHOT_2,
    });
    expect(storedEnvelope().ownerUserId).toBe('owner-b');
  });

  it('replaces malformed state but preserves an unsupported future schema', async () => {
    await prepare();
    const malformed = JSON.stringify({ ...storedEnvelope(), unexpected: true });
    mocks.storage.set(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, malformed);

    await expect(resolve([TOKEN_A])).rejects.toThrow(ROUTINE_WIDGET_ACTION_REGISTRY_INVALID);
    await expect(prepareReplacement(NOW + 30_000)).resolves.toEqual({
      actionTokens: [TOKEN_C],
      snapshotNonce: SNAPSHOT_2,
    });
    expect(mocks.storage.get(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).not.toBe(malformed);

    const future = JSON.stringify({ ...storedEnvelope(), version: 2 });
    mocks.storage.set(ROUTINE_WIDGET_ACTION_REGISTRY_KEY, future);
    await expect(resolve([TOKEN_A])).rejects.toThrow(
      ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION,
    );
    mocks.uuids.push('00000000-0000-4000-8000-000000000012');
    await expect(
      prepareRoutineWidgetActions({
        localDate: DAY,
        phase: 'PM',
        stepKeys: [],
        expiresAt: NOW + 30_000,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_REGISTRY_UNSUPPORTED_VERSION);
    expect(mocks.storage.get(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(future);
  });

  it('rejects invalid bindings and any expiry beyond the active five-minute authority', async () => {
    mocks.uuids.push(SNAPSHOT);
    await expect(
      prepareRoutineWidgetActions({
        localDate: DAY,
        phase: 'PM',
        stepKeys: ['AM:cleanser'],
        expiresAt: NOW + 60_000,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_INPUT_INVALID);

    mocks.uuids.push(SNAPSHOT, TOKEN_A);
    await expect(
      prepareRoutineWidgetActions({
        localDate: DAY,
        phase: 'PM',
        stepKeys: ['PM:cleanser'],
        expiresAt: NOW + HEALTH_PROCESSING_STATUS_LEASE_MS + 1,
      }),
    ).rejects.toThrow(ROUTINE_WIDGET_ACTION_EXPIRY_OUTSIDE_LEASE);
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(false);
  });

  it('keeps deletion available after health processing closes', async () => {
    await prepare();
    clearActiveHealthProcessingEpoch();

    await expect(clearRoutineWidgetActions()).resolves.toBeUndefined();
    expect(mocks.storage.has(ROUTINE_WIDGET_ACTION_REGISTRY_KEY)).toBe(false);
  });
});
