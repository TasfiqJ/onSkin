import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recordFirstUsefulInsightAnalytics,
  recordRoutinePlanAnalytics,
} from './activationAnalytics';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  track: vi.fn(),
  updateFailure: null as Error | null,
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
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
  beforeEach(() => {
    mocks.storage.clear();
    mocks.track.mockClear();
    mocks.updateFailure = null;
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
