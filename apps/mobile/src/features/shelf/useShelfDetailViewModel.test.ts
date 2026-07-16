import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useShelfDetailViewModel } from './useShelfDetailViewModel';

const mocks = vi.hoisted(() => ({
  useCycleFromSources: vi.fn(),
  usePlanFromSources: vi.fn(),
  useRampFromPlan: vi.fn(),
}));

vi.mock('react', () => ({
  useMemo: (factory: () => unknown) => factory(),
}));

vi.mock('@/features/routine/usePlan', () => ({
  usePlanFromSources: mocks.usePlanFromSources,
}));

vi.mock('@/features/routine/useRamp', () => ({
  useRampFromPlan: mocks.useRampFromPlan,
}));

vi.mock('@/features/scheduler/useCycle', () => ({
  useCycleFromSources: mocks.useCycleFromSources,
}));

const boundary = {
  localDate: '2026-07-15',
  timeZone: 'America/Toronto',
} as const;
const profileData = {
  consentCurrent: true,
  goals: [],
  moisture: 'balanced',
  pregnancy: false,
  pregnancySafety: 'clear',
  pregnancyStatus: 'none',
  sensitivity: 'neutral',
  source: 'local',
} as const;

function source(overrides: Record<string, unknown> = {}) {
  return {
    data: { profile: profileData },
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    ...overrides,
  };
}

describe('Shelf product-detail view model', () => {
  beforeEach(() => {
    mocks.useCycleFromSources.mockReset();
    mocks.usePlanFromSources.mockReset();
    mocks.useRampFromPlan.mockReset();
  });

  it('shares one Shelf/profile snapshot across Plan, Ramp, and Cycle', () => {
    const shelf = source();
    const plan = { isError: false, isFetching: false, isSuccess: true, retry: vi.fn() };
    const ramp = { isError: false, isFetching: false, isSuccess: true, retry: vi.fn() };
    const cycle = { isError: false, isFetching: false, isSuccess: true, retry: vi.fn() };
    mocks.usePlanFromSources.mockReturnValue(plan);
    mocks.useRampFromPlan.mockReturnValue(ramp);
    mocks.useCycleFromSources.mockReturnValue(cycle);

    const result = useShelfDetailViewModel({ boundary, shelf } as never);
    const profile = {
      data: profileData,
      isError: false,
      isFetching: false,
      isLoading: false,
      isPending: false,
      isSuccess: true,
    };

    expect(mocks.usePlanFromSources).toHaveBeenCalledExactlyOnceWith(shelf, profile);
    expect(mocks.useRampFromPlan).toHaveBeenCalledExactlyOnceWith(plan, boundary);
    expect(mocks.useCycleFromSources).toHaveBeenCalledExactlyOnceWith(
      shelf,
      profile,
      ramp,
      boundary,
    );
    expect(result).toMatchObject({
      cycle,
      plan,
      profile,
      ramp,
      routineGuidanceError: false,
      routineGuidanceFetching: false,
      routineGuidanceLoading: false,
      shelf,
    });
  });

  it.each([
    ['routine order', false, false, false],
    ['ramp', true, false, false],
    ['cycle config', true, true, false],
  ])(
    'keeps absence guidance non-authoritative while %s is pending',
    (_stage, planSuccess, rampSuccess, cycleSuccess) => {
      mocks.usePlanFromSources.mockReturnValue({
        isError: false,
        isFetching: true,
        isSuccess: planSuccess,
        retry: vi.fn(),
      });
      mocks.useRampFromPlan.mockReturnValue({
        isError: false,
        isFetching: true,
        isSuccess: rampSuccess,
        retry: vi.fn(),
      });
      mocks.useCycleFromSources.mockReturnValue({
        isError: false,
        isFetching: true,
        isSuccess: cycleSuccess,
        retry: vi.fn(),
      });

      const result = useShelfDetailViewModel({ boundary, shelf: source() } as never);

      expect(result.routineGuidanceError).toBe(false);
      expect(result.routineGuidanceLoading).toBe(true);
    },
  );

  it('retries only failed derived observers and reports a persistent failure', async () => {
    const planRetry = vi.fn(async () => ({ isError: true }));
    const rampRetry = vi.fn(async () => ({ isError: false }));
    const cycleRetry = vi.fn(async () => ({ isError: false }));
    mocks.usePlanFromSources.mockReturnValue({
      isError: true,
      isFetching: false,
      isSuccess: false,
      retry: planRetry,
    });
    mocks.useRampFromPlan.mockReturnValue({
      isError: false,
      isFetching: false,
      isSuccess: true,
      retry: rampRetry,
    });
    mocks.useCycleFromSources.mockReturnValue({
      isError: true,
      isFetching: true,
      isSuccess: false,
      retry: cycleRetry,
    });

    const result = useShelfDetailViewModel({ boundary, shelf: source() } as never);

    expect(result.routineGuidanceError).toBe(true);
    expect(result.routineGuidanceFetching).toBe(true);
    expect(result.routineGuidanceLoading).toBe(false);
    await expect(result.retryRoutineGuidance()).resolves.toEqual({ isError: true });
    expect(planRetry).toHaveBeenCalledOnce();
    expect(rampRetry).not.toHaveBeenCalled();
    expect(cycleRetry).toHaveBeenCalledOnce();
  });
});
