import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';

import {
  clearRoutineActivationAnalytics,
  MAX_ROUTINE_ACTIVATION_RECORD_CHARS,
  readRoutineActivationState,
  recordFirstUsefulInsightAnalytics,
  recordRoutinePlanAnalytics,
} from './activationAnalytics';

const mocks = vi.hoisted(() => ({
  readPrivateItem: vi.fn(),
  removePrivateItem: vi.fn(),
  storage: new Map<string, string>(),
  track: vi.fn(),
  updateFailure: null as Error | null,
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  readPrivateItem: mocks.readPrivateItem,
  removePrivateItem: mocks.removePrivateItem,
  updatePrivateItem: vi.fn(
    async (key: string, updater: (current: string | null) => string | null) => {
      if (mocks.updateFailure) throw mocks.updateFailure;
      const next = updater(mocks.storage.get(key) ?? null);
      if (next === null) mocks.storage.delete(key);
      else mocks.storage.set(key, next);
    },
  ),
}));

const KEY = 'routinekind.routineActivation.v1';

describe('routine activation analytics', () => {
  let boundaryActive = false;

  beforeEach(() => {
    mocks.storage.clear();
    mocks.track.mockClear();
    mocks.updateFailure = null;
    mocks.readPrivateItem.mockReset();
    mocks.readPrivateItem.mockImplementation(async (key: string) => {
      const value = mocks.storage.get(key);
      return value === undefined ? { status: 'absent' } : { status: 'available', value };
    });
    mocks.removePrivateItem.mockReset();
    mocks.removePrivateItem.mockImplementation(async (key: string) => {
      mocks.storage.delete(key);
    });
  });

  afterEach(() => {
    if (!boundaryActive) return;
    endAccountGenerationBoundary();
    boundaryActive = false;
  });

  it('returns typed absent, legacy, and current reads without rewriting bytes', async () => {
    await expect(readRoutineActivationState()).resolves.toEqual({
      status: 'absent',
      flags: { firstRoutineCreated: false, firstUsefulInsight: false },
    });

    const legacy = JSON.stringify({
      firstRoutineCreated: true,
      firstUsefulInsight: false,
    });
    mocks.storage.set(KEY, legacy);

    await expect(readRoutineActivationState()).resolves.toEqual({
      status: 'available',
      format: 'legacy',
      flags: { firstRoutineCreated: true, firstUsefulInsight: false },
    });
    expect(mocks.storage.get(KEY)).toBe(legacy);

    const current = JSON.stringify({
      version: 1,
      flags: { firstRoutineCreated: true, firstUsefulInsight: true },
    });
    mocks.storage.set(KEY, current);

    await expect(readRoutineActivationState()).resolves.toEqual({
      status: 'available',
      format: 'current',
      flags: { firstRoutineCreated: true, firstUsefulInsight: true },
    });
    expect(mocks.storage.get(KEY)).toBe(current);
  });

  it.each([
    [
      { status: 'unavailable', reason: 'content_key_missing' },
      { status: 'unavailable', flags: null, reason: 'content_key_missing' },
    ],
    [
      { status: 'corrupt', reason: 'decryption_failed' },
      { status: 'corrupt', flags: null, reason: 'decryption_failed' },
    ],
    [{ status: 'unsupported_version' }, { status: 'unsupported_version', flags: null }],
  ])('preserves the private-KV failure taxonomy for %#', async (stored, expected) => {
    mocks.readPrivateItem.mockResolvedValueOnce(stored);

    await expect(readRoutineActivationState()).resolves.toEqual(expected);
  });

  it('classifies an unexpected private read rejection as unavailable', async () => {
    mocks.readPrivateItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(readRoutineActivationState()).resolves.toEqual({
      status: 'unavailable',
      flags: null,
      reason: 'storage_unavailable',
    });
  });

  it('cancels a delayed activation read at an account-generation boundary', async () => {
    let releaseRead!: (result: { status: 'absent' }) => void;
    mocks.readPrivateItem.mockImplementationOnce(
      () =>
        new Promise<{ status: 'absent' }>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const read = readRoutineActivationState();
    await vi.waitFor(() => expect(mocks.readPrivateItem).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    boundaryActive = true;

    await expect(read).resolves.toEqual({
      status: 'unavailable',
      flags: null,
      reason: 'account_boundary',
    });

    endAccountGenerationBoundary();
    boundaryActive = false;
    releaseRead({ status: 'absent' });
    await Promise.resolve();
  });

  it('publishes a delayed activation read while its generation remains current', async () => {
    let releaseRead!: (result: { status: 'absent' }) => void;
    mocks.readPrivateItem.mockImplementationOnce(
      () =>
        new Promise<{ status: 'absent' }>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const read = readRoutineActivationState();
    await vi.waitFor(() => expect(mocks.readPrivateItem).toHaveBeenCalledOnce());
    releaseRead({ status: 'absent' });

    await expect(read).resolves.toEqual({
      status: 'absent',
      flags: { firstRoutineCreated: false, firstUsefulInsight: false },
    });
  });

  it.each([
    '{',
    '[]',
    JSON.stringify({ firstRoutineCreated: true }),
    JSON.stringify({ firstRoutineCreated: true, firstUsefulInsight: false, extra: true }),
    JSON.stringify({ firstRoutineCreated: true, firstUsefulInsight: 'yes' }),
    JSON.stringify({ version: 1, flags: { firstRoutineCreated: true } }),
    JSON.stringify({ version: 0, flags: { firstRoutineCreated: true, firstUsefulInsight: true } }),
    'x'.repeat(MAX_ROUTINE_ACTIVATION_RECORD_CHARS + 1),
  ])('classifies invalid or oversized application bytes without replacing them', async (stored) => {
    mocks.storage.set(KEY, stored);

    await expect(readRoutineActivationState()).resolves.toEqual({
      status: 'corrupt',
      flags: null,
      reason: 'invalid_payload',
    });
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('classifies and preserves a future application envelope', async () => {
    const stored = JSON.stringify({ version: 2, flags: { future: true } });
    mocks.storage.set(KEY, stored);

    await expect(readRoutineActivationState()).resolves.toEqual({
      status: 'unsupported_version',
      flags: null,
    });
    expect(mocks.storage.get(KEY)).toBe(stored);
  });

  it('upgrades valid legacy bytes only when an explicit reservation changes them', async () => {
    const legacy = JSON.stringify({
      firstRoutineCreated: false,
      firstUsefulInsight: false,
    });
    mocks.storage.set(KEY, legacy);

    await recordFirstUsefulInsightAnalytics({
      insightCount: 1,
      isExample: false,
      source: 'reveal',
    });

    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      flags: { firstRoutineCreated: false, firstUsefulInsight: true },
    });
  });

  it('preserves current bytes when no first-event reservation changes state', async () => {
    const stored = JSON.stringify({
      version: 1,
      flags: { firstRoutineCreated: true, firstUsefulInsight: true },
    });
    mocks.storage.set(KEY, stored);

    await recordRoutinePlanAnalytics({
      routineStepCount: 1,
      insightCount: 1,
      isExample: false,
      source: 'routine_plan',
    });

    expect(mocks.storage.get(KEY)).toBe(stored);
    expect(mocks.track.mock.calls).toEqual([
      ['routine_plan_viewed', { source: 'routine_plan' }],
      ['routine_created', { source: 'routine_plan' }],
    ]);
  });

  it('clears the activation marker explicitly', async () => {
    mocks.storage.set(
      KEY,
      JSON.stringify({
        version: 1,
        flags: { firstRoutineCreated: true, firstUsefulInsight: true },
      }),
    );

    await clearRoutineActivationAnalytics();

    expect(mocks.removePrivateItem).toHaveBeenCalledWith(KEY);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('records routine plan views every time but reserves first activation events only once', async () => {
    await recordRoutinePlanAnalytics({
      routineStepCount: 2,
      insightCount: 3,
      isExample: false,
      source: 'routine_plan',
    });
    await recordRoutinePlanAnalytics({
      routineStepCount: 3,
      insightCount: 4,
      isExample: false,
      source: 'routine_plan',
    });

    expect(mocks.track.mock.calls).toEqual([
      ['routine_plan_viewed', { source: 'routine_plan' }],
      ['routine_created', { source: 'routine_plan' }],
      ['first_routine_created', { source: 'routine_plan' }],
      ['first_useful_insight', { count: 3, source: 'routine_plan' }],
      ['routine_plan_viewed', { source: 'routine_plan' }],
      ['routine_created', { source: 'routine_plan' }],
    ]);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      flags: {
        firstRoutineCreated: true,
        firstUsefulInsight: true,
      },
    });
  });

  it('does not count example plans as first routine creation or first insight', async () => {
    await recordRoutinePlanAnalytics({
      routineStepCount: 2,
      insightCount: 1,
      isExample: true,
      source: 'example',
    });

    expect(mocks.track.mock.calls).toEqual([['routine_plan_viewed', { source: 'example' }]]);
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('preserves malformed and future marker state without emitting duplicate first events', async () => {
    for (const stored of [
      JSON.stringify({ firstRoutineCreated: 'yes' }),
      JSON.stringify({ version: 2, flags: { future: true } }),
      'x'.repeat(MAX_ROUTINE_ACTIVATION_RECORD_CHARS + 1),
    ]) {
      mocks.storage.set(KEY, stored);
      mocks.track.mockClear();

      await recordRoutinePlanAnalytics({
        routineStepCount: 1,
        insightCount: 2,
        isExample: false,
        source: 'routine_plan',
      });

      expect(mocks.track.mock.calls).toEqual([
        ['routine_plan_viewed', { source: 'routine_plan' }],
        ['routine_created', { source: 'routine_plan' }],
      ]);
      expect(mocks.storage.get(KEY)).toBe(stored);
    }
  });

  it('does not count a real plan with no executable steps as routine creation', async () => {
    await recordRoutinePlanAnalytics({
      routineStepCount: 0,
      insightCount: 1,
      isExample: false,
      source: 'routine_plan',
    });

    expect(mocks.track.mock.calls).toEqual([
      ['routine_plan_viewed', { source: 'routine_plan' }],
      ['first_useful_insight', { count: 1, source: 'routine_plan' }],
    ]);
    expect(JSON.parse(mocks.storage.get(KEY) ?? '{}')).toEqual({
      version: 1,
      flags: {
        firstRoutineCreated: false,
        firstUsefulInsight: true,
      },
    });
  });

  it('lets reveal own the first useful insight without counting a routine plan view', async () => {
    await recordFirstUsefulInsightAnalytics({
      insightCount: 2,
      isExample: false,
      source: 'reveal',
    });
    await recordRoutinePlanAnalytics({
      routineStepCount: 3,
      insightCount: 4,
      isExample: false,
      source: 'routine_plan',
    });

    expect(mocks.track.mock.calls).toEqual([
      ['first_useful_insight', { count: 2, source: 'reveal' }],
      ['routine_plan_viewed', { source: 'routine_plan' }],
      ['routine_created', { source: 'routine_plan' }],
      ['first_routine_created', { source: 'routine_plan' }],
    ]);
  });

  it('does not count example reveal insights', async () => {
    await recordFirstUsefulInsightAnalytics({
      insightCount: 1,
      isExample: true,
      source: 'reveal',
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });

  it('serializes simultaneous first-insight reservations', async () => {
    await Promise.all([
      recordFirstUsefulInsightAnalytics({ insightCount: 1, isExample: false, source: 'reveal' }),
      recordFirstUsefulInsightAnalytics({ insightCount: 2, isExample: false, source: 'reveal' }),
    ]);

    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenCalledWith('first_useful_insight', {
      count: 1,
      source: 'reveal',
    });
  });

  it('does not emit a first event when its durable reservation fails', async () => {
    mocks.updateFailure = new Error('storage unavailable');

    await recordFirstUsefulInsightAnalytics({
      insightCount: 1,
      isExample: false,
      source: 'reveal',
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.storage.has(KEY)).toBe(false);
  });
});
