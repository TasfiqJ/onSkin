import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAskViewModel } from './useAsk';

const mocks = vi.hoisted(() => ({
  profile: {
    data: { goals: [] },
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
  recommendations: {
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    result: { recommendations: [], youreSet: false },
    retry: vi.fn(),
  },
  plan: {
    data: { isExample: false, plan: { pm: [] } },
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(),
  },
  shelf: {
    data: { archive: [], items: [], unresolvedConflicts: [] },
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
  useEntitlement: vi.fn(),
  usePlanFromSources: vi.fn(),
  useProfileBits: vi.fn(),
  useQuery: vi.fn(),
  useRecommendationsFromSources: vi.fn(),
  useShelf: vi.fn(),
}));

vi.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useMemo: <T>(factory: () => T) => factory(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/features/recommendations/useRecommendations', () => ({
  useRecommendationsFromSources: mocks.useRecommendationsFromSources,
}));

vi.mock('@/features/routine/usePlan', () => ({
  usePlanFromSources: mocks.usePlanFromSources,
}));

vi.mock('@/features/scheduler/profile', () => ({
  useProfileBits: mocks.useProfileBits,
}));

vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: mocks.useShelf,
}));

vi.mock('@/features/subscription/useEntitlement', () => ({
  useEntitlement: mocks.useEntitlement,
}));

vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/launch/phase7', () => ({
  phase7Flags: { cloudAsk: false },
}));

vi.mock('@/lib/query/localDateBoundaryStore', () => ({
  useLocalDateBoundary: () => ({ localDate: '2026-07-15' }),
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => ({ generation: 7, ownerId: 'owner-a' }),
}));

vi.mock('./groundedTurnsQuery', () => ({
  groundedTurnsQueryOptions: () => ({ enabled: false, queryKey: ['ask-grounded-turns'] }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shelf.isError = false;
  mocks.shelf.isSuccess = true;
  mocks.profile.isError = false;
  mocks.profile.isSuccess = true;
  mocks.plan.isError = false;
  mocks.plan.isSuccess = true;
  mocks.recommendations.isError = false;
  mocks.recommendations.isSuccess = true;
  mocks.shelf.refetch.mockResolvedValue({ isError: false });
  mocks.profile.refetch.mockResolvedValue({ isError: false });
  mocks.plan.retry.mockResolvedValue({ isError: false });
  mocks.recommendations.retry.mockResolvedValue({ isError: false });
  mocks.useShelf.mockReturnValue(mocks.shelf);
  mocks.useProfileBits.mockReturnValue(mocks.profile);
  mocks.usePlanFromSources.mockReturnValue(mocks.plan);
  mocks.useRecommendationsFromSources.mockReturnValue(mocks.recommendations);
  mocks.useEntitlement.mockReturnValue({ data: undefined });
  mocks.useQuery.mockReturnValue({
    data: 0,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    refetch: vi.fn(),
  });
});

describe('Ask route view model', () => {
  it('mounts one Shelf and one profile observer and reuses both exact snapshots', () => {
    const viewModel = useAskViewModel();

    expect(mocks.useShelf).toHaveBeenCalledOnce();
    expect(mocks.useProfileBits).toHaveBeenCalledOnce();
    expect(mocks.usePlanFromSources).toHaveBeenCalledOnce();
    expect(mocks.usePlanFromSources).toHaveBeenCalledWith(mocks.shelf, mocks.profile);
    expect(mocks.useRecommendationsFromSources).toHaveBeenCalledOnce();
    expect(mocks.useRecommendationsFromSources).toHaveBeenCalledWith(
      mocks.shelf,
      mocks.profile,
    );
    expect(viewModel.isSuccess).toBe(true);
  });

  it('retries every route-owned observer exactly once when shared readiness fails', async () => {
    mocks.shelf.isError = true;
    mocks.shelf.isSuccess = false;
    mocks.profile.isError = true;
    mocks.profile.isSuccess = false;
    mocks.plan.isError = true;
    mocks.plan.isSuccess = false;
    mocks.recommendations.isError = true;
    mocks.recommendations.isSuccess = false;

    const viewModel = useAskViewModel();
    await viewModel.retry();

    expect(mocks.shelf.refetch).toHaveBeenCalledOnce();
    expect(mocks.profile.refetch).toHaveBeenCalledOnce();
    expect(mocks.plan.retry).toHaveBeenCalledOnce();
    expect(mocks.recommendations.retry).toHaveBeenCalledOnce();
  });

  it('reports a persistent routine-order retry failure', async () => {
    mocks.plan.isError = true;
    mocks.plan.isSuccess = false;
    mocks.plan.retry.mockResolvedValueOnce({ isError: true });

    const viewModel = useAskViewModel();

    await expect(viewModel.retry()).resolves.toEqual({ isError: true });
    expect(mocks.plan.retry).toHaveBeenCalledOnce();
  });
});
