import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import * as privateKV from '@/lib/storage/privateKV';
import type { PrivateKVReadResult } from '@/lib/storage/privateKV';

import {
  acknowledgeLifecyclePromptPresented,
  MAX_SUBSCRIPTION_PROMPT_RECORD_CHARS,
  pendingLifecycleRoute,
  pendingLifecycleRouteResult,
  readLifecyclePromptState,
  supersedeLifecyclePrompt,
  type LifecyclePrompt,
} from './lifecycle';

const mocks = vi.hoisted(() => ({
  entitlement: null as null | Record<string, unknown>,
  readEntitlementCache: vi.fn(),
  physicalWrites: 0,
  promptReadOverride: null as PrivateKVReadResult | null,
  storage: new Map<string, string>(),
  tails: new Map<string, Promise<void>>(),
  updateFailure: null as 'before' | 'after_updater' | 'after' | null,
  updateBeforeError: null as Error | null,
  updateBlocker: null as Promise<void> | null,
  uuidCounter: 0,
  randomUUID: vi.fn(() => {
    const tail = (++mocks.uuidCounter).toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${tail}`;
  }),
}));

vi.mock('expo-crypto', () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock('./store', () => ({
  readEntitlementCache: mocks.readEntitlementCache,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  PRIVATE_KV_CONTENT_KEY_INVALID: 'PRIVATE_KV_CONTENT_KEY_INVALID',
  PRIVATE_KV_CONTENT_KEY_MISSING: 'PRIVATE_KV_CONTENT_KEY_MISSING',
  PRIVATE_KV_DECRYPTION_FAILED: 'PRIVATE_KV_DECRYPTION_FAILED',
  PRIVATE_KV_ENVELOPE_INVALID: 'PRIVATE_KV_ENVELOPE_INVALID',
  PRIVATE_KV_ENVELOPE_UNSUPPORTED: 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',
  PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY: 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY',
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  readPrivateItem: vi.fn(async (key: string): Promise<PrivateKVReadResult> => {
    if (mocks.promptReadOverride) return mocks.promptReadOverride;
    const value = mocks.storage.get(key);
    return value === undefined ? { status: 'absent' } : { status: 'available', value };
  }),
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      const previous = mocks.tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.tails.set(key, tail);
      await previous;
      try {
        const blocker = mocks.updateBlocker;
        mocks.updateBlocker = null;
        if (blocker) await blocker;
        if (mocks.updateFailure === 'before') {
          throw mocks.updateBeforeError ?? new Error('storage unavailable');
        }
        const current = mocks.storage.get(key) ?? null;
        const next = updater(current);
        if (mocks.updateFailure === 'after_updater') {
          throw new Error('native pre-commit rejection after updater');
        }
        if (next !== current) {
          mocks.physicalWrites += 1;
          if (next === null) mocks.storage.delete(key);
          else mocks.storage.set(key, next);
        }
        if (mocks.updateFailure === 'after') throw new Error('native post-commit rejection');
      } finally {
        release();
        if (mocks.tails.get(key) === tail) mocks.tails.delete(key);
      }
    },
  ),
}));

const KEY = 'onskin.subscription.promptedExpiry';
const NOW = '2026-07-12T12:00:00.000Z';
const EXPIRES_AT = '2026-07-11T12:00:00.000Z';
const REPLAY_PROMPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PREVIOUS_SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function entitlement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tier: 'pro',
    isActive: false,
    expiresAt: EXPIRES_AT,
    periodType: 'reverse_trial',
    storeUserId: 'owner-a',
    ...overrides,
  };
}

function storedEnvelope(): Record<string, unknown> {
  return JSON.parse(mocks.storage.get(KEY) ?? '{}') as Record<string, unknown>;
}

function preparedEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 2,
    expiresAt: EXPIRES_AT,
    route: '/paywall/reoffer',
    promptId: REPLAY_PROMPT_ID,
    deliverySessionId: PREVIOUS_SESSION_ID,
    phase: 'prepared',
    ...overrides,
  });
}

describe('subscription expiry lifecycle prompt', () => {
  let boundaryActive = false;

  beforeEach(() => {
    mocks.entitlement = entitlement();
    mocks.readEntitlementCache
      .mockReset()
      .mockImplementation(async (options: { expectedStoreUserId?: string } = {}) => {
        if (
          mocks.entitlement &&
          options.expectedStoreUserId &&
          mocks.entitlement.storeUserId !== options.expectedStoreUserId
        ) {
          return { status: 'unavailable', entitlement: null };
        }
        return mocks.entitlement
          ? { status: 'available', entitlement: mocks.entitlement }
          : { status: 'absent', entitlement: null };
      });
    mocks.physicalWrites = 0;
    mocks.promptReadOverride = null;
    mocks.storage.clear();
    mocks.tails.clear();
    mocks.updateFailure = null;
    mocks.updateBeforeError = null;
    mocks.updateBlocker = null;
    vi.mocked(privateKV.getPrivateItem).mockClear();
    vi.mocked(privateKV.readPrivateItem).mockClear();
    vi.mocked(privateKV.updatePrivateItem).mockClear();
  });

  afterEach(() => {
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('reads absent prompt state without reserving, repairing, or using the raw adapter', async () => {
    await expect(readLifecyclePromptState()).resolves.toEqual({ status: 'absent', state: null });

    expect(privateKV.readPrivateItem).toHaveBeenCalledOnce();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.physicalWrites).toBe(0);
  });

  it('reads current prompt state without mutating its delivery journal', async () => {
    const original = preparedEnvelope();
    mocks.storage.set(KEY, original);

    await expect(readLifecyclePromptState()).resolves.toEqual({
      status: 'available',
      state: {
        format: 'current',
        expiresAt: EXPIRES_AT,
        route: '/paywall/reoffer',
        promptId: REPLAY_PROMPT_ID,
        deliverySessionId: PREVIOUS_SESSION_ID,
        phase: 'prepared',
      },
    });

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.readPrivateItem).toHaveBeenCalledOnce();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.physicalWrites).toBe(0);
  });

  it.each([
    ['legacy scalar', '2026-07-11T08:00:00-04:00'],
    ['legacy v1 envelope', JSON.stringify({ version: 1, expiresAt: '2026-07-11T08:00:00-04:00' })],
  ])(
    'canonicalizes an equivalent RFC3339 offset from %s without rewriting bytes',
    async (_label, original) => {
      mocks.storage.set(KEY, original);

      await expect(readLifecyclePromptState()).resolves.toEqual({
        status: 'available',
        state: {
          format: 'legacy_presented',
          expiresAt: EXPIRES_AT,
          phase: 'presented',
        },
      });

      expect(mocks.storage.get(KEY)).toBe(original);
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
      expect(privateKV.getPrivateItem).not.toHaveBeenCalled();

      await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({ status: 'none' });
      expect(mocks.storage.get(KEY)).toBe(original);
      expect(mocks.physicalWrites).toBe(0);
    },
  );

  it.each([
    ['offset timestamp', '2026-07-11T08:00:00-04:00'],
    ['zero-offset timestamp', '2026-07-11T12:00:00+00:00'],
    ['missing milliseconds', '2026-07-11T12:00:00Z'],
    ['excess fractional precision', '2026-07-11T12:00:00.0000Z'],
  ])('classifies a v2 %s as noncanonical and preserves exact bytes', async (_label, expiresAt) => {
    const original = preparedEnvelope({ expiresAt });
    mocks.storage.set(KEY, original);

    await expect(readLifecyclePromptState()).resolves.toEqual({
      status: 'corrupt',
      state: null,
      reason: 'invalid_payload',
    });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'corrupt',
      reason: 'invalid_payload',
    });
    expect(mocks.storage.get(KEY)).toBe(original);
    expect(mocks.physicalWrites).toBe(0);
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' },
      { status: 'unavailable', state: null, reason: 'content_key_missing' },
    ],
    [
      { status: 'unavailable', reason: 'content_key_conflict' },
      { status: 'unavailable', state: null, reason: 'content_key_conflict' },
    ],
    [
      { status: 'unavailable', reason: 'content_key_storage_unavailable' },
      { status: 'unavailable', state: null, reason: 'content_key_storage_unavailable' },
    ],
    [
      { status: 'unavailable', reason: 'account_boundary' },
      { status: 'unavailable', state: null, reason: 'account_boundary' },
    ],
    [
      { status: 'unavailable', reason: 'storage_unavailable' },
      { status: 'unavailable', state: null, reason: 'storage_unavailable' },
    ],
    [
      { status: 'corrupt', reason: 'content_key_invalid' },
      { status: 'corrupt', state: null, reason: 'content_key_invalid' },
    ],
    [
      { status: 'corrupt', reason: 'envelope_invalid' },
      { status: 'corrupt', state: null, reason: 'envelope_invalid' },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'corrupt', state: null, reason: 'decryption_failed' },
    ],
    [{ status: 'unsupported_version' }, { status: 'unsupported_version', state: null }],
  ] as const)(
    'propagates private typed read state %# without touching persisted bytes',
    async (stored, expected) => {
      const original = preparedEnvelope();
      mocks.storage.set(KEY, original);
      mocks.promptReadOverride = stored as PrivateKVReadResult;

      await expect(readLifecyclePromptState()).resolves.toEqual(expected);

      expect(mocks.storage.get(KEY)).toBe(original);
      expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
      expect(mocks.physicalWrites).toBe(0);
    },
  );

  it('maps an unexpected private read rejection without changing stored bytes', async () => {
    const original = preparedEnvelope();
    mocks.storage.set(KEY, original);
    vi.mocked(privateKV.readPrivateItem).mockRejectedValueOnce(new Error('transport unavailable'));

    await expect(readLifecyclePromptState()).resolves.toEqual({
      status: 'unavailable',
      state: null,
      reason: 'storage_unavailable',
    });

    expect(mocks.storage.get(KEY)).toBe(original);
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });

  it('durably prepares a reverse-trial prompt without marking it presented', async () => {
    const prompt = await pendingLifecycleRoute(NOW);

    expect(prompt).toEqual({
      promptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      route: '/paywall/reoffer',
    });
    expect(storedEnvelope()).toEqual({
      version: 3,
      expiresAt: EXPIRES_AT,
      route: '/paywall/reoffer',
      promptId: prompt?.promptId,
      deliverySessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      phase: 'prepared',
    });
    expect(mocks.physicalWrites).toBe(1);
  });

  it('returns a typed route and performs no read before the atomic reservation', async () => {
    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'route',
      prompt: {
        promptId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        route: '/paywall/reoffer',
      },
    });

    expect(privateKV.updatePrivateItem).toHaveBeenCalledOnce();
    expect(privateKV.getPrivateItem).toHaveBeenCalledOnce();
    expect(vi.mocked(privateKV.updatePrivateItem).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(privateKV.getPrivateItem).mock.invocationCallOrder[0]!,
    );
  });

  it('does not reserve or navigate from owner-A proof under owner B', async () => {
    await expect(
      pendingLifecycleRouteResult(NOW, { expectedStoreUserId: 'owner-b' }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'entitlement_unavailable' });

    expect(mocks.readEntitlementCache).toHaveBeenCalledWith({
      expectedStoreUserId: 'owner-b',
    });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('suppresses duplicate delivery attempts in the same JS process', async () => {
    await expect(pendingLifecycleRoute(NOW)).resolves.toMatchObject({
      route: '/paywall/reoffer',
    });
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();

    expect(storedEnvelope().phase).toBe('prepared');
    expect(mocks.physicalWrites).toBe(1);
  });

  it('reoffers an unacknowledged prepared prompt after a new JS process', async () => {
    mocks.storage.set(KEY, preparedEnvelope());

    await expect(pendingLifecycleRoute(NOW)).resolves.toEqual({
      promptId: REPLAY_PROMPT_ID,
      route: '/paywall/reoffer',
    });

    const replayed = storedEnvelope();
    expect(replayed.phase).toBe('prepared');
    expect(replayed.promptId).toBe(REPLAY_PROMPT_ID);
    expect(replayed.deliverySessionId).not.toBe(PREVIOUS_SESSION_ID);
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
  });

  it('replays the durable prepared route when entitlement type changes at the same expiry', async () => {
    mocks.entitlement = entitlement({ periodType: 'normal' });
    mocks.storage.set(KEY, preparedEnvelope());

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'route',
      prompt: {
        promptId: REPLAY_PROMPT_ID,
        route: '/paywall/reoffer',
      },
    });
    expect(storedEnvelope()).toMatchObject({
      route: '/paywall/reoffer',
      promptId: REPLAY_PROMPT_ID,
      phase: 'prepared',
    });
    expect(storedEnvelope().deliverySessionId).not.toBe(PREVIOUS_SESSION_ID);
  });

  it('acknowledges presentation only for the exact prompt and route', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;

    await expect(acknowledgeLifecyclePromptPresented(prompt)).resolves.toBe(true);
    expect(storedEnvelope().phase).toBe('presented');
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();

    const settled = mocks.storage.get(KEY);
    await expect(
      acknowledgeLifecyclePromptPresented({
        promptId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(settled);
  });

  it('settles an exact stale delivery as superseded without claiming presentation', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;

    await expect(supersedeLifecyclePrompt(prompt)).resolves.toBe(true);
    expect(storedEnvelope()).toMatchObject({ version: 3, phase: 'superseded' });
    await expect(readLifecyclePromptState()).resolves.toMatchObject({
      status: 'available',
      state: { phase: 'superseded' },
    });
    await expect(acknowledgeLifecyclePromptPresented(prompt)).resolves.toBe(false);
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(storedEnvelope().phase).toBe('superseded');
  });

  it('upgrades a superseded V2 delivery to V3 that rollback V2 preserves as unsupported', async () => {
    mocks.storage.set(KEY, preparedEnvelope());

    await expect(
      supersedeLifecyclePrompt({
        promptId: REPLAY_PROMPT_ID,
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(true);
    const raw = mocks.storage.get(KEY) as string;
    const parsed = JSON.parse(raw) as { version: number; phase: string };
    expect(parsed).toMatchObject({ version: 3, phase: 'superseded' });

    const rollbackV2Classification = parsed.version > 2 ? 'unsupported_version' : 'decodable';
    expect(rollbackV2Classification).toBe('unsupported_version');
    expect(mocks.storage.get(KEY)).toBe(raw);
    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.get(KEY)).toBe(raw);
  });

  it('does not supersede a prompt through the wrong lifecycle route', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;
    const prepared = mocks.storage.get(KEY);

    await expect(
      supersedeLifecyclePrompt({
        promptId: prompt.promptId,
        route: '/paywall/downgrade',
      }),
    ).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(prepared);
    expect(storedEnvelope().phase).toBe('prepared');
  });

  it('uses exact readback to distinguish supersede commit-then-reject from no commit', async () => {
    mocks.storage.set(KEY, preparedEnvelope());
    mocks.updateFailure = 'after';

    await expect(
      supersedeLifecyclePrompt({
        promptId: REPLAY_PROMPT_ID,
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(true);
    expect(storedEnvelope()).toMatchObject({ version: 3, phase: 'superseded' });

    mocks.storage.set(KEY, preparedEnvelope());
    mocks.updateFailure = 'before';
    await expect(
      supersedeLifecyclePrompt({
        promptId: REPLAY_PROMPT_ID,
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(preparedEnvelope());
  });

  it('never rewrites an already-presented prompt as superseded', async () => {
    mocks.storage.set(KEY, preparedEnvelope({ phase: 'presented' }));
    const original = mocks.storage.get(KEY);

    await expect(
      supersedeLifecyclePrompt({
        promptId: REPLAY_PROMPT_ID,
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(false);
    expect(mocks.storage.get(KEY)).toBe(original);
  });

  it('routes a lapsed paid period to graceful downgrade', async () => {
    mocks.entitlement = entitlement({ periodType: 'normal' });

    await expect(pendingLifecycleRoute(NOW)).resolves.toMatchObject({
      route: '/paywall/downgrade',
    });
    expect(storedEnvelope()).toMatchObject({
      route: '/paywall/downgrade',
      phase: 'prepared',
    });
  });

  it('does not reserve or route an active unexpired entitlement', async () => {
    mocks.entitlement = entitlement({
      isActive: true,
      expiresAt: '2026-07-13T12:00:00.000Z',
    });

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it.each([
    [{ status: 'absent', entitlement: null }, { status: 'none' }],
    [
      { status: 'unavailable', entitlement: null },
      { status: 'unavailable', reason: 'entitlement_unavailable' },
    ],
    [
      { status: 'corrupt', entitlement: null },
      { status: 'corrupt', reason: 'entitlement_corrupt' },
    ],
    [{ status: 'unsupported_version', entitlement: null }, { status: 'unsupported_version' }],
  ] as const)(
    'propagates typed entitlement state %# before prompt storage',
    async (stored, result) => {
      mocks.readEntitlementCache.mockResolvedValueOnce(stored);

      await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual(result);

      expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
      expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
      expect(mocks.storage.has(KEY)).toBe(false);
    },
  );

  it('classifies an unexpected entitlement read rejection as entitlement unavailable', async () => {
    mocks.readEntitlementCache.mockRejectedValueOnce(new Error('entitlement adapter failed'));

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'unavailable',
      reason: 'entitlement_unavailable',
    });

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
  });

  it('rejects an available entitlement whose expiry is not encoder-canonical', async () => {
    mocks.entitlement = entitlement({ expiresAt: '2026-07-11T08:00:00-04:00' });

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'corrupt',
      reason: 'entitlement_corrupt',
    });

    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('serializes 100 simultaneous callers so exactly one receives the delivery', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => pendingLifecycleRouteResult(NOW)),
    );

    expect(results.filter((result) => result.status === 'route')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'none')).toHaveLength(99);
    expect(results.find((result) => result.status === 'route')).toMatchObject({
      status: 'route',
      prompt: { route: '/paywall/reoffer' },
    });
    expect(mocks.physicalWrites).toBe(1);
  });

  it('accepts reservation commit-then-reject only after exact readback', async () => {
    mocks.updateFailure = 'after';

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toMatchObject({
      status: 'route',
      prompt: { route: '/paywall/reoffer' },
    });
    expect(storedEnvelope().phase).toBe('prepared');
    expect(privateKV.getPrivateItem).toHaveBeenCalledWith(KEY);
  });

  it('classifies a mismatched commit readback as unavailable and does not route', async () => {
    mocks.updateFailure = 'after';
    vi.mocked(privateKV.getPrivateItem).mockResolvedValueOnce(
      preparedEnvelope({ promptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }),
    );

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'unavailable',
      reason: 'write_unconfirmed',
    });
    expect(storedEnvelope().phase).toBe('prepared');
  });

  it('classifies a rejected commit readback as unavailable without replacing committed bytes', async () => {
    vi.mocked(privateKV.getPrivateItem).mockRejectedValueOnce(new Error('readback unavailable'));

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'unavailable',
      reason: 'write_unconfirmed',
    });

    expect(storedEnvelope().phase).toBe('prepared');
    expect(mocks.physicalWrites).toBe(1);
  });

  it('accepts acknowledgement commit-then-reject only after exact readback', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;
    mocks.updateFailure = 'after';

    await expect(acknowledgeLifecyclePromptPresented(prompt)).resolves.toBe(true);
    expect(storedEnvelope().phase).toBe('presented');
    expect(privateKV.getPrivateItem).toHaveBeenCalledWith(KEY);
  });

  it('classifies a pre-commit reservation failure as unavailable and keeps it retryable', async () => {
    mocks.updateFailure = 'before';

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'unavailable',
      reason: 'prompt_storage_unavailable',
    });
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
  });

  it('does not route when the updater ran but native storage rejected before commit', async () => {
    mocks.updateFailure = 'after_updater';

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual({
      status: 'unavailable',
      reason: 'write_unconfirmed',
    });

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.physicalWrites).toBe(0);
    expect(privateKV.getPrivateItem).toHaveBeenCalledOnce();
  });

  it.each([
    [
      privateKV.PRIVATE_KV_CONTENT_KEY_MISSING,
      { status: 'unavailable', reason: 'prompt_storage_unavailable' },
    ],
    [
      privateKV.PRIVATE_KV_CONTENT_KEY_INVALID,
      { status: 'corrupt', reason: 'private_storage_corrupt' },
    ],
    [
      privateKV.PRIVATE_KV_ENVELOPE_INVALID,
      { status: 'corrupt', reason: 'private_storage_corrupt' },
    ],
    [
      privateKV.PRIVATE_KV_DECRYPTION_FAILED,
      { status: 'corrupt', reason: 'private_storage_corrupt' },
    ],
    [privateKV.PRIVATE_KV_ENVELOPE_UNSUPPORTED, { status: 'unsupported_version' }],
    [privateKV.PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY, { status: 'account_boundary' }],
  ] as const)(
    'classifies private-storage failure %s without a fallback read',
    async (code, result) => {
      mocks.updateFailure = 'before';
      mocks.updateBeforeError = new Error(code);

      await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual(result);

      expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
      expect(mocks.physicalWrites).toBe(0);
    },
  );

  it('does not publish a delayed typed read after an account boundary', async () => {
    let releaseRead!: (result: PrivateKVReadResult) => void;
    vi.mocked(privateKV.readPrivateItem).mockImplementationOnce(
      () =>
        new Promise<PrivateKVReadResult>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const state = readLifecyclePromptState();
    await vi.waitFor(() => expect(privateKV.readPrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(state).resolves.toEqual({
      status: 'unavailable',
      state: null,
      reason: 'account_boundary',
    });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();

    releaseRead({ status: 'available', value: preparedEnvelope() });
    await Promise.resolve();
  });

  it('cancels a reservation delayed inside the atomic update at an account boundary', async () => {
    let releaseUpdate!: () => void;
    mocks.updateBlocker = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });

    const route = pendingLifecycleRouteResult(NOW);
    await vi.waitFor(() => expect(privateKV.updatePrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(route).resolves.toEqual({ status: 'account_boundary' });

    // The real private adapter rejects stale-generation writes. Mirror that
    // guard in this intentionally minimal storage mock before releasing it.
    mocks.updateFailure = 'before';
    releaseUpdate();
    await vi.waitFor(() => expect(mocks.tails.size).toBe(0));
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.physicalWrites).toBe(0);
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
  });

  it('does not publish a committed reservation after its exact readback crosses owners', async () => {
    let releaseReadback!: (value: string | null) => void;
    vi.mocked(privateKV.getPrivateItem).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          releaseReadback = resolve;
        }),
    );

    const route = pendingLifecycleRouteResult(NOW);
    await vi.waitFor(() => expect(privateKV.getPrivateItem).toHaveBeenCalledOnce());
    expect(storedEnvelope().phase).toBe('prepared');

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(route).resolves.toEqual({ status: 'account_boundary' });
    expect(mocks.physicalWrites).toBe(1);

    releaseReadback(mocks.storage.get(KEY) ?? null);
    await Promise.resolve();
  });

  it('publishes a delayed exact readback while the same account generation remains current', async () => {
    let releaseReadback!: (value: string | null) => void;
    vi.mocked(privateKV.getPrivateItem).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          releaseReadback = resolve;
        }),
    );

    const route = pendingLifecycleRouteResult(NOW);
    await vi.waitFor(() => expect(privateKV.getPrivateItem).toHaveBeenCalledOnce());
    releaseReadback(mocks.storage.get(KEY) ?? null);

    await expect(route).resolves.toMatchObject({
      status: 'route',
      prompt: { route: '/paywall/reoffer' },
    });
    expect(mocks.physicalWrites).toBe(1);
  });

  it('cancels a delayed presentation acknowledgement at an account boundary', async () => {
    const prompt = (await pendingLifecycleRoute(NOW)) as LifecyclePrompt;
    let releaseUpdate!: () => void;
    mocks.updateBlocker = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });

    const acknowledgement = acknowledgeLifecyclePromptPresented(prompt);
    await vi.waitFor(() => expect(privateKV.updatePrivateItem).toHaveBeenCalledTimes(2));

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(acknowledgement).resolves.toBe(false);
    mocks.updateFailure = 'before';
    releaseUpdate();
    await vi.waitFor(() => expect(mocks.tails.size).toBe(0));
    expect(storedEnvelope().phase).toBe('prepared');
    expect(mocks.physicalWrites).toBe(1);
  });

  it('cancels a delayed owner-A entitlement after a boundary without writing or routing', async () => {
    let releaseEntitlement!: () => void;
    mocks.readEntitlementCache.mockImplementationOnce(
      () =>
        new Promise<{ status: 'available'; entitlement: Record<string, unknown> }>((resolve) => {
          releaseEntitlement = () =>
            resolve({ status: 'available', entitlement: mocks.entitlement! });
        }),
    );

    const route = pendingLifecycleRouteResult(NOW);
    await vi.waitFor(() => expect(mocks.readEntitlementCache).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(route).resolves.toEqual({ status: 'account_boundary' });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
    expect(mocks.physicalWrites).toBe(0);

    releaseEntitlement();
    await Promise.resolve();
  });

  it('keeps a delayed entitlement valid while the same owner generation remains current', async () => {
    let releaseEntitlement!: () => void;
    mocks.readEntitlementCache.mockImplementationOnce(
      () =>
        new Promise<{ status: 'available'; entitlement: Record<string, unknown> }>((resolve) => {
          releaseEntitlement = () =>
            resolve({ status: 'available', entitlement: mocks.entitlement! });
        }),
    );

    const route = pendingLifecycleRouteResult(NOW);
    await vi.waitFor(() => expect(mocks.readEntitlementCache).toHaveBeenCalledOnce());
    releaseEntitlement();

    await expect(route).resolves.toMatchObject({
      status: 'route',
      prompt: { route: '/paywall/reoffer' },
    });
    expect(mocks.physicalWrites).toBe(1);
  });

  it.each([
    ['invalid legacy scalar', 'not-an-iso-date', { status: 'corrupt', reason: 'invalid_payload' }],
    ['numeric date shorthand', '0', { status: 'corrupt', reason: 'invalid_payload' }],
    ['date-only scalar', '2026-07-10', { status: 'corrupt', reason: 'invalid_payload' }],
    ['prose date', 'July 10, 2026', { status: 'corrupt', reason: 'invalid_payload' }],
    [
      'impossible calendar date',
      '2026-02-30T12:00:00.000Z',
      { status: 'corrupt', reason: 'invalid_payload' },
    ],
    ['invalid hour', '2026-07-10T25:00:00Z', { status: 'corrupt', reason: 'invalid_payload' }],
    ['malformed JSON', '{not-json', { status: 'corrupt', reason: 'invalid_payload' }],
    [
      'oversized payload',
      'x'.repeat(MAX_SUBSCRIPTION_PROMPT_RECORD_CHARS + 1),
      { status: 'corrupt', reason: 'invalid_payload' },
    ],
    [
      'wrong-shaped current state',
      JSON.stringify({ version: 2, expiresAt: EXPIRES_AT }),
      { status: 'corrupt', reason: 'invalid_payload' },
    ],
    [
      'future state',
      JSON.stringify({ version: 4, expiresAt: EXPIRES_AT }),
      { status: 'unsupported_version' },
    ],
  ] as const)('classifies and preserves %s', async (_label, stored, result) => {
    mocks.storage.set(KEY, stored);

    await expect(readLifecyclePromptState()).resolves.toEqual({ ...result, state: null });
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();

    await expect(pendingLifecycleRouteResult(NOW)).resolves.toEqual(result);

    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.physicalWrites).toBe(0);
    expect(privateKV.getPrivateItem).not.toHaveBeenCalled();
  });

  it('keeps the existing navigation adapter fail closed for a typed storage failure', async () => {
    const stored = '{not-json';
    mocks.storage.set(KEY, stored);

    await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();

    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.physicalWrites).toBe(0);
  });

  it('reads equal legacy prompted state without rewriting or presenting it again', async () => {
    for (const legacy of [EXPIRES_AT, JSON.stringify({ version: 1, expiresAt: EXPIRES_AT })]) {
      mocks.storage.set(KEY, legacy);

      await expect(pendingLifecycleRoute(NOW)).resolves.toBeNull();
      expect(mocks.storage.get(KEY)).toBe(legacy);
      expect(mocks.physicalWrites).toBe(0);
    }
  });

  it('rejects non-RFC3339 wall-clock and acknowledgement inputs without touching state', async () => {
    for (const invalidNow of [
      'not-a-date',
      '0',
      '2026-07-12',
      'July 12, 2026',
      '2026-02-30T12:00:00.000Z',
      '2026-07-12T25:00:00.000Z',
    ]) {
      await expect(pendingLifecycleRouteResult(invalidNow)).resolves.toEqual({
        status: 'unavailable',
        reason: 'invalid_clock',
      });
      await expect(pendingLifecycleRoute(invalidNow)).resolves.toBeNull();
    }
    await expect(
      acknowledgeLifecyclePromptPresented({
        promptId: '../not-opaque',
        route: '/paywall/reoffer',
      }),
    ).resolves.toBe(false);

    expect(mocks.storage.has(KEY)).toBe(false);
    expect(privateKV.updatePrivateItem).not.toHaveBeenCalled();
  });
});
