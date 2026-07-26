import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRoutinePlanViewModel } from './useRoutinePlanViewModel';

const BOUNDARY = {
  localDate: '2026-07-25',
  timeZone: 'America/Toronto',
} as const;
const PROFILE = {
  consentCurrent: true,
  goals: [],
  moisture: 'balanced',
  pregnancy: false,
  pregnancySafety: 'clear',
  pregnancyStatus: 'none',
  sensitivity: 'neutral',
  source: 'local',
} as const;

const mocks = vi.hoisted(() => ({
  cycle: undefined as unknown,
  plan: undefined as unknown,
  ramp: undefined as unknown,
  routeSources: undefined as unknown,
  useCycleFromSources: vi.fn(),
  usePlanFromSources: vi.fn(),
  useRampFromPlan: vi.fn(),
  useRoutineRouteSources: vi.fn(),
}));

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
}));

vi.mock('@/features/scheduler/useCycle', () => ({
  useCycleFromSources: mocks.useCycleFromSources,
}));

vi.mock('./RoutineRouteSources', () => ({
  useRoutineRouteSources: mocks.useRoutineRouteSources,
}));

vi.mock('./usePlan', () => ({
  usePlanFromSources: mocks.usePlanFromSources,
}));

vi.mock('./useRamp', () => ({
  useRampFromPlan: mocks.useRampFromPlan,
}));

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(async () => ({ isError: false })),
    ...overrides,
  };
}

function shelfResult(overrides: Record<string, unknown> = {}) {
  return {
    ...queryResult(),
    isPending: false,
    refetch: vi.fn(async () => ({ isError: false })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const shelf = shelfResult({ data: { profile: PROFILE } });
  mocks.routeSources = { boundary: BOUNDARY, shelf };
  mocks.plan = queryResult();
  mocks.ramp = {
    ...queryResult(),
    items: [],
    acceptStepUp: vi.fn(async () => undefined),
  };
  mocks.cycle = queryResult();
  mocks.useRoutineRouteSources.mockImplementation(() => mocks.routeSources);
  mocks.usePlanFromSources.mockImplementation(() => mocks.plan);
  mocks.useRampFromPlan.mockImplementation(() => mocks.ramp);
  mocks.useCycleFromSources.mockImplementation(() => mocks.cycle);
});

describe('Routine Plan route view model', () => {
  it('owns one exact shared source graph for Plan and Cycle', () => {
    const result = useRoutinePlanViewModel();
    const { shelf } = mocks.routeSources as {
      shelf: ReturnType<typeof shelfResult>;
    };

    expect(mocks.useRoutineRouteSources).toHaveBeenCalledOnce();
    expect(mocks.usePlanFromSources).toHaveBeenCalledOnce();
    expect(mocks.usePlanFromSources.mock.calls[0]?.[0]).toBe(shelf);
    expect(mocks.usePlanFromSources.mock.calls[0]?.[1]).toMatchObject({
      data: PROFILE,
      isError: false,
      isFetching: false,
      isLoading: false,
      isPending: false,
      isSuccess: true,
    });
    expect(mocks.useRampFromPlan).toHaveBeenCalledExactlyOnceWith(mocks.plan, BOUNDARY);
    expect(mocks.useCycleFromSources).toHaveBeenCalledExactlyOnceWith(
      shelf,
      expect.objectContaining({ data: PROFILE, isSuccess: true }),
      mocks.ramp,
      BOUNDARY,
    );
    expect(result.planQuery.data).toBe((mocks.plan as { data: unknown }).data);
    expect(result.cycleQuery.data).toBe((mocks.cycle as { data: unknown }).data);
  });

  it('leaves Shelf recovery with the outer boundary and Plan recovery with routine order', async () => {
    const planRetry = vi.fn(async () => ({ isError: false }));
    const rampRetry = vi.fn(async () => ({ isError: false }));
    const cycleRetry = vi.fn(async () => ({ isError: false }));
    mocks.plan = queryResult({ isError: true, isSuccess: false, retry: planRetry });
    mocks.ramp = {
      ...queryResult({ isError: true, isSuccess: false, retry: rampRetry }),
      items: [],
    };
    mocks.cycle = queryResult({ isError: true, isSuccess: false, retry: cycleRetry });

    const result = useRoutinePlanViewModel();

    await expect(result.planQuery.retry()).resolves.toEqual({ isError: false });
    expect(planRetry).toHaveBeenCalledOnce();
    expect(rampRetry).not.toHaveBeenCalled();
    expect(cycleRetry).not.toHaveBeenCalled();
  });

  it('preserves the standalone Cycle retry set without duplicating observers', async () => {
    const planRetry = vi.fn(async () => ({ isError: false }));
    const rampRetry = vi.fn(async () => ({ isError: false }));
    const cycleRetry = vi.fn(async () => ({ isError: true }));
    mocks.plan = queryResult({ isError: true, isSuccess: false, retry: planRetry });
    mocks.ramp = {
      ...queryResult({ isError: true, isSuccess: false, retry: rampRetry }),
      items: [],
    };
    mocks.cycle = queryResult({ isError: true, isSuccess: false, retry: cycleRetry });

    const result = useRoutinePlanViewModel();

    await expect(result.cycleQuery.retry()).resolves.toEqual({ isError: true });
    expect(planRetry).not.toHaveBeenCalled();
    expect(rampRetry).toHaveBeenCalledOnce();
    expect(cycleRetry).toHaveBeenCalledOnce();
  });
});
