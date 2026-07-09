import { beforeEach, describe, expect, it, vi } from 'vitest';

import { recordRoutinePlanAnalytics } from './activationAnalytics';

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  track: vi.fn(),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setPrivateItem: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  removePrivateItem: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));

const KEY = 'routinekind.routineActivation.v1';

describe('routine activation analytics', () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.track.mockClear();
  });

  it('records routine plan views every time but first activation events only once', async () => {
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
      firstRoutineCreated: true,
      firstUsefulInsight: true,
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

  it('normalizes malformed marker state before deciding first events', async () => {
    mocks.storage.set(KEY, JSON.stringify({ firstRoutineCreated: 'yes' }));

    await recordRoutinePlanAnalytics({
      routineStepCount: 1,
      insightCount: 2,
      isExample: false,
      source: 'routine_plan',
    });

    expect(mocks.track.mock.calls).toEqual([
      ['routine_plan_viewed', { source: 'routine_plan' }],
      ['routine_created', { source: 'routine_plan' }],
      ['first_routine_created', { source: 'routine_plan' }],
      ['first_useful_insight', { count: 2, source: 'routine_plan' }],
    ]);
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
      firstRoutineCreated: false,
      firstUsefulInsight: true,
    });
  });
});
