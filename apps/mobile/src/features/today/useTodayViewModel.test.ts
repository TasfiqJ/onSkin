import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTodayViewModel } from './useTodayViewModel';

const BOUNDARY = {
  localDate: '2026-07-15',
  timeZone: 'America/Toronto|offset:240',
};

const mocks = vi.hoisted(() => ({
  commitTodayCompletionForOwner: vi.fn(),
  completion: {
    data: new Set<string>(),
    isError: false,
    isFetching: false,
    isPending: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
  cycle: {
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(),
  },
  entitlement: { data: undefined },
  haptics: { select: vi.fn(), success: vi.fn() },
  ownerCurrent: true,
  plan: {
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(),
  },
  profile: {
    data: { goals: [] },
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
  progress: {
    data: { streak: 0 },
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
  },
  queryClient: {
    cancelQueries: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
  ramp: {
    items: [],
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(),
  },
  requestReviewAfterValue: vi.fn(),
  reserveCycleNightCompletionAnalyticsForOwner: vi.fn(),
  setCompletionMutationFailureScope: vi.fn(),
  shelf: {
    data: { items: [] },
    isError: false,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
  track: vi.fn(),
  useCycleFromSources: vi.fn(),
  useEntitlement: vi.fn(),
  useMemo: vi.fn((factory: () => unknown) => factory()),
  usePlanFromSources: vi.fn(),
  useProfileBits: vi.fn(),
  useProgressFromBoundary: vi.fn(),
  useQuery: vi.fn(),
  useRampFromPlan: vi.fn(),
}));

vi.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => void) => effect(),
  useMemo: mocks.useMemo,
  useRef: <T>(value: T) => ({ current: value }),
  useState: <T>(value: T) =>
    [value, value === null ? mocks.setCompletionMutationFailureScope : vi.fn()] as const,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/features/routine/usePlan', () => ({
  usePlanFromSources: mocks.usePlanFromSources,
}));

vi.mock('@/features/routine/useProgress', () => ({
  useProgressFromBoundary: mocks.useProgressFromBoundary,
}));

vi.mock('@/features/routine/useRamp', () => ({
  useRampFromPlan: mocks.useRampFromPlan,
}));

vi.mock('@/features/review/prompt', () => ({
  requestReviewAfterValue: mocks.requestReviewAfterValue,
}));

vi.mock('@/features/scheduler/profile', () => ({
  useProfileBits: mocks.useProfileBits,
}));

vi.mock('@/features/scheduler/useCycle', () => ({
  useCycleFromSources: mocks.useCycleFromSources,
}));

vi.mock('@/features/subscription/useEntitlement', () => ({
  useEntitlement: mocks.useEntitlement,
}));

vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

vi.mock('@/lib/query/queryKeys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/query/queryKeys')>();
  return { ...actual, isOwnerQueryScopeCurrent: () => mocks.ownerCurrent };
});

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => ({ generation: 7 }),
}));

vi.mock('@/theme/haptics', () => ({ haptics: mocks.haptics }));

vi.mock('./completionMutationCoordinator', () => ({
  commitTodayCompletionForOwner: mocks.commitTodayCompletionForOwner,
}));

vi.mock('./completionsStore', () => ({
  commitCompletion: vi.fn(),
  getCompletedSteps: vi.fn(),
}));

vi.mock('./cycleNightAnalytics', () => ({
  reserveCycleNightCompletionAnalyticsForOwner: mocks.reserveCycleNightCompletionAnalyticsForOwner,
}));

function durableResult(
  steps: readonly string[],
  options: { changed?: boolean; firstEver?: boolean } = {},
) {
  return {
    published: true,
    result: {
      status: 'committed' as const,
      done: true as const,
      firstEver: options.firstEver ?? false,
      changed: options.changed ?? true,
      date: BOUNDARY.localDate,
      completedSteps: new Set(steps),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.profile, { isError: false, isSuccess: true });
  Object.assign(mocks.plan, { isError: false, isSuccess: true });
  Object.assign(mocks.ramp, { isError: false, isSuccess: true });
  Object.assign(mocks.cycle, { isError: false, isSuccess: true });
  mocks.ownerCurrent = true;
  mocks.progress.data = { streak: 0 };
  mocks.completion.data = new Set<string>();
  mocks.profile.refetch.mockResolvedValue({ isError: false });
  mocks.plan.retry.mockResolvedValue({ isError: false });
  mocks.ramp.retry.mockResolvedValue({ isError: false });
  mocks.cycle.retry.mockResolvedValue({ isError: false });
  mocks.completion.refetch.mockResolvedValue({ isError: false, isSuccess: true });
  mocks.queryClient.invalidateQueries.mockResolvedValue(undefined);
  mocks.reserveCycleNightCompletionAnalyticsForOwner.mockResolvedValue({
    status: 'not_candidate',
  });
  mocks.setCompletionMutationFailureScope.mockReset();
  mocks.useProfileBits.mockReturnValue(mocks.profile);
  mocks.usePlanFromSources.mockReturnValue(mocks.plan);
  mocks.useRampFromPlan.mockReturnValue(mocks.ramp);
  mocks.useCycleFromSources.mockReturnValue(mocks.cycle);
  mocks.useProgressFromBoundary.mockReturnValue(mocks.progress);
  mocks.useEntitlement.mockReturnValue(mocks.entitlement);
  mocks.useQuery.mockReturnValue(mocks.completion);
});

describe('Today route view model', () => {
  it('mounts every shared domain once and passes the exact route snapshots downstream', () => {
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'AM',
      shelf: mocks.shelf as never,
    });

    expect(mocks.useProfileBits).toHaveBeenCalledOnce();
    expect(mocks.usePlanFromSources).toHaveBeenCalledWith(mocks.shelf, mocks.profile);
    expect(mocks.useRampFromPlan).toHaveBeenCalledWith(mocks.plan, BOUNDARY);
    expect(mocks.useCycleFromSources).toHaveBeenCalledWith(
      mocks.shelf,
      mocks.profile,
      mocks.ramp,
      BOUNDARY,
    );
    expect(mocks.useProgressFromBoundary).toHaveBeenCalledWith(BOUNDARY);
    expect(mocks.useEntitlement).toHaveBeenCalledOnce();
    expect(mocks.useQuery).toHaveBeenCalledOnce();
    expect(mocks.useQuery.mock.calls[0]?.[0]).toMatchObject({
      networkMode: 'always',
      retry: false,
      retryOnMount: false,
    });
    expect(viewModel.shelf).toBe(mocks.shelf);
    expect(viewModel.recommendationShelf).toEqual({
      data: mocks.shelf.data,
      isError: mocks.shelf.isError,
      isFetching: mocks.shelf.isFetching,
      isLoading: mocks.shelf.isLoading,
      isSuccess: mocks.shelf.isSuccess,
    });
    expect(viewModel.recommendationShelf).not.toBe(mocks.shelf);
    expect(Object.keys(viewModel.recommendationShelf).sort()).toEqual([
      'data',
      'isError',
      'isFetching',
      'isLoading',
      'isSuccess',
    ]);
    expect(mocks.useMemo).toHaveBeenCalledWith(expect.any(Function), [
      mocks.shelf.data,
      mocks.shelf.isError,
      mocks.shelf.isFetching,
      mocks.shelf.isLoading,
      mocks.shelf.isSuccess,
    ]);
    expect(viewModel.profile).toBe(mocks.profile);
    expect(viewModel.completionActionScope).toBe('7:2026-07-15:America/Toronto|offset:240');
  });

  it('retries route-owned guidance and schedule observers exactly once', async () => {
    Object.assign(mocks.profile, { isError: true, isSuccess: false });
    Object.assign(mocks.plan, { isError: true, isSuccess: false });
    Object.assign(mocks.ramp, { isError: true, isSuccess: false });
    Object.assign(mocks.cycle, { isError: true, isSuccess: false });

    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'AM',
      shelf: mocks.shelf as never,
    });

    await expect(viewModel.retryPrivateGuidance()).resolves.toEqual({ isError: false });
    await expect(viewModel.retrySchedule()).resolves.toEqual({ isError: false });
    expect(mocks.profile.refetch).toHaveBeenCalledOnce();
    expect(mocks.plan.retry).toHaveBeenCalledOnce();
    expect(mocks.ramp.retry).toHaveBeenCalledOnce();
    expect(mocks.cycle.retry).toHaveBeenCalledOnce();
    expect(mocks.shelf.refetch).not.toHaveBeenCalled();
  });

  it('does not let an old-scope retry erase a newer completion failure', async () => {
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'AM',
      shelf: mocks.shelf as never,
    });

    await expect(viewModel.retryCompletionHistory()).resolves.toEqual({ isError: false });

    const clearForCapturedScope = mocks.setCompletionMutationFailureScope.mock.calls[0]?.[0] as (
      failedScope: string | null,
    ) => string | null;
    expect(clearForCapturedScope(viewModel.completionActionScope)).toBeNull();
    expect(clearForCapturedScope('7:2026-07-16:America/Toronto|offset:240')).toBe(
      '7:2026-07-16:America/Toronto|offset:240',
    );
  });

  it('coalesces rapid same-step taps and emits durable effects exactly once', async () => {
    let release!: () => void;
    mocks.progress.data = { streak: 6 };
    mocks.commitTodayCompletionForOwner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(durableResult(['AM:cleanser'], { firstEver: true }));
        }),
    );
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'AM',
      shelf: mocks.shelf as never,
    });
    const context = { phase: 'AM' as const, cycleActive: false, stepKeys: ['AM:cleanser'] };

    const first = viewModel.completeStep('AM:cleanser', context);
    const second = viewModel.completeStep('AM:cleanser', context);

    expect(second).toBe(first);
    expect(mocks.commitTodayCompletionForOwner).toHaveBeenCalledOnce();
    expect(mocks.haptics.select).toHaveBeenCalledOnce();
    expect(viewModel.isCompletionPending('AM:cleanser')).toBe(true);
    release();
    await Promise.all([first, second]);
    expect(viewModel.isCompletionPending('AM:cleanser')).toBe(false);

    expect(mocks.track).toHaveBeenCalledWith('routine_checkoff_completed', { moment: 'am' });
    expect(mocks.track).toHaveBeenCalledWith('first_checkoff_completed', { moment: 'am' });
    expect(mocks.haptics.success).toHaveBeenCalledOnce();
    expect(mocks.requestReviewAfterValue).toHaveBeenCalledOnce();

    await viewModel.completeStep('AM:cleanser', context);
    expect(mocks.commitTodayCompletionForOwner).toHaveBeenCalledOnce();
    expect(mocks.haptics.select).toHaveBeenCalledOnce();
  });

  it('tracks one cycle completion when rapid distinct PM commits finish the phase', async () => {
    mocks.reserveCycleNightCompletionAnalyticsForOwner
      .mockResolvedValueOnce({ status: 'not_candidate' })
      .mockResolvedValueOnce({ status: 'reserved' });
    mocks.commitTodayCompletionForOwner
      .mockResolvedValueOnce(durableResult(['PM:cleanser']))
      .mockResolvedValueOnce(durableResult(['PM:cleanser', 'PM:retinol']));
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'PM',
      shelf: mocks.shelf as never,
    });
    const context = {
      phase: 'PM' as const,
      cycleActive: true,
      stepKeys: ['PM:cleanser', 'PM:retinol'],
    };

    await Promise.all([
      viewModel.completeStep('PM:cleanser', context),
      viewModel.completeStep('PM:retinol', context),
    ]);

    expect(mocks.commitTodayCompletionForOwner).toHaveBeenCalledTimes(2);
    expect(mocks.haptics.select).toHaveBeenCalledTimes(2);
    expect(mocks.haptics.success).toHaveBeenCalledOnce();
    expect(
      mocks.track.mock.calls.filter(([event]) => event === 'routine_checkoff_completed'),
    ).toHaveLength(2);
    expect(mocks.track.mock.calls.filter(([event]) => event === 'cycle_night_completed')).toEqual([
      ['cycle_night_completed', { moment: 'pm', source: 'today' }],
    ]);
    expect(mocks.reserveCycleNightCompletionAnalyticsForOwner).toHaveBeenLastCalledWith({
      changed: true,
      completedAfter: new Set(['PM:cleanser', 'PM:retinol']),
      cycleActive: true,
      localDate: BOUNDARY.localDate,
      phase: 'PM',
      scope: { generation: 7 },
      stepKeys: ['PM:cleanser', 'PM:retinol'],
    });
  });

  it('suppresses a cycle event when the owner/date receipt was already reserved', async () => {
    mocks.reserveCycleNightCompletionAnalyticsForOwner.mockResolvedValueOnce({
      status: 'already_reserved',
    });
    mocks.commitTodayCompletionForOwner.mockResolvedValueOnce(
      durableResult(['PM:cleanser', 'PM:retinol']),
    );
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'PM',
      shelf: mocks.shelf as never,
    });

    await viewModel.completeStep('PM:retinol', {
      phase: 'PM',
      cycleActive: true,
      stepKeys: ['PM:cleanser', 'PM:retinol'],
    });

    expect(mocks.reserveCycleNightCompletionAnalyticsForOwner).toHaveBeenCalledOnce();
    expect(mocks.track).toHaveBeenCalledWith('routine_checkoff_completed', { moment: 'pm' });
    expect(mocks.track).not.toHaveBeenCalledWith('cycle_night_completed', expect.anything());
  });

  it('publishes no delayed haptic, review, or cycle effect after the owner changes', async () => {
    let releaseReceipt!: () => void;
    mocks.progress.data = { streak: 6 };
    mocks.reserveCycleNightCompletionAnalyticsForOwner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseReceipt = () => resolve({ status: 'cancelled' });
        }),
    );
    mocks.commitTodayCompletionForOwner.mockResolvedValueOnce(durableResult(['PM:cleanser']));
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'PM',
      shelf: mocks.shelf as never,
    });

    const completion = viewModel.completeStep('PM:cleanser', {
      phase: 'PM',
      cycleActive: true,
      stepKeys: ['PM:cleanser'],
    });
    await vi.waitFor(() => expect(releaseReceipt).toBeTypeOf('function'));
    mocks.ownerCurrent = false;
    releaseReceipt();
    await completion;

    expect(mocks.track).toHaveBeenCalledWith('routine_checkoff_completed', { moment: 'pm' });
    expect(mocks.track).not.toHaveBeenCalledWith('cycle_night_completed', expect.anything());
    expect(mocks.haptics.success).not.toHaveBeenCalled();
    expect(mocks.requestReviewAfterValue).not.toHaveBeenCalled();
  });

  it('queues one trailing Progress refresh when rapid commits overlap an active refresh', async () => {
    let releaseFirstRefresh!: () => void;
    const firstRefresh = new Promise<void>((resolve) => {
      releaseFirstRefresh = resolve;
    });
    mocks.queryClient.invalidateQueries
      .mockReturnValueOnce(firstRefresh)
      .mockResolvedValueOnce(undefined);
    let commitCount = 0;
    mocks.commitTodayCompletionForOwner.mockImplementation(
      async (dependencies: { reconcileProgress?: () => void | Promise<void> }) => {
        commitCount += 1;
        void dependencies.reconcileProgress?.();
        return durableResult(
          commitCount === 1 ? ['AM:cleanser'] : ['AM:cleanser', 'AM:moisturiser'],
        );
      },
    );
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'AM',
      shelf: mocks.shelf as never,
    });
    const context = {
      phase: 'AM' as const,
      cycleActive: false,
      stepKeys: ['AM:cleanser', 'AM:moisturiser'],
    };

    await Promise.all([
      viewModel.completeStep('AM:cleanser', context),
      viewModel.completeStep('AM:moisturiser', context),
    ]);
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledOnce();

    releaseFirstRefresh();
    await firstRefresh;
    await Promise.resolve();
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it('does not emit success effects for an idempotent store result', async () => {
    mocks.commitTodayCompletionForOwner.mockResolvedValueOnce(
      durableResult(['AM:cleanser'], { changed: false }),
    );
    const viewModel = useTodayViewModel({
      boundary: BOUNDARY,
      routineType: 'AM',
      shelf: mocks.shelf as never,
    });

    await viewModel.completeStep('AM:cleanser', {
      phase: 'AM',
      cycleActive: false,
      stepKeys: ['AM:cleanser'],
    });

    expect(mocks.haptics.select).toHaveBeenCalledOnce();
    expect(mocks.haptics.success).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
