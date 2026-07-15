import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecommendations, useRecommendationsFromSources } from './useRecommendations';

const mocks = vi.hoisted(() => ({
  prefsRefetch: vi.fn(),
  useProfileBits: vi.fn(),
  useQuery: vi.fn(),
  useShelf: vi.fn(),
}));

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
  useState: (initial: unknown) => [initial, vi.fn()],
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/features/scheduler/profile', () => ({
  useProfileBits: mocks.useProfileBits,
}));

vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: mocks.useShelf,
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => ({ generation: 4, ownerId: 'owner-a' }),
}));

vi.mock('./recommendationInputsQuery', () => ({
  recommendationInputsQueryOptions: () => ({ queryKey: ['recommendation-inputs'] }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prefsRefetch.mockResolvedValue({ isError: false });
  mocks.useQuery.mockReturnValue({
    data: undefined,
    isError: true,
    isFetching: false,
    isLoading: false,
    isSuccess: false,
    refetch: mocks.prefsRefetch,
  });
  mocks.useProfileBits.mockReturnValue({
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: false,
    refetch: vi.fn(),
  });
  mocks.useShelf.mockReturnValue({
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: false,
    refetch: vi.fn(),
  });
});

describe('shared-source recommendations', () => {
  it('reports persistent failures from every standalone retry owner', async () => {
    const shelfRefetch = vi.fn(async () => ({ isError: true }));
    const profileRefetch = vi.fn(async () => ({ isError: true }));
    mocks.prefsRefetch.mockResolvedValueOnce({ isError: true });
    mocks.useShelf.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
      refetch: shelfRefetch,
    });
    mocks.useProfileBits.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
      refetch: profileRefetch,
    });

    const recommendations = useRecommendations();

    await expect(recommendations.retry()).resolves.toEqual({ isError: true });
    expect(shelfRefetch).toHaveBeenCalledOnce();
    expect(profileRefetch).toHaveBeenCalledOnce();
    expect(mocks.prefsRefetch).toHaveBeenCalledOnce();
  });

  it('retries only its owned preferences query', async () => {
    const shelfRefetch = vi.fn(async () => ({ isError: false }));
    const profileRefetch = vi.fn(async () => ({ isError: false }));
    const recommendations = useRecommendationsFromSources(
      {
        data: undefined,
        isError: true,
        isFetching: false,
        isLoading: false,
        isSuccess: false,
        refetch: shelfRefetch,
      } as never,
      {
        data: undefined,
        isError: true,
        isFetching: false,
        isLoading: false,
        isSuccess: false,
        refetch: profileRefetch,
      } as never,
    );

    await recommendations.retry();

    expect(mocks.prefsRefetch).toHaveBeenCalledOnce();
    expect(shelfRefetch).not.toHaveBeenCalled();
    expect(profileRefetch).not.toHaveBeenCalled();
  });
});
