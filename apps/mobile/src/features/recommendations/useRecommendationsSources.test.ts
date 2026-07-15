import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useRecommendations,
  useRecommendationsFromSources,
  type RecommendationProfileSource,
  type RecommendationShelfSource,
} from './useRecommendations';

const RECOMMENDATIONS_DIR = fileURLToPath(new URL('./', import.meta.url));

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
    const shelf: RecommendationShelfSource = {
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
    };
    const profile: RecommendationProfileSource = {
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
    };
    const recommendations = useRecommendationsFromSources(shelf, profile);

    await recommendations.retry();

    expect(mocks.prefsRefetch).toHaveBeenCalledOnce();
    expect(mocks.useShelf).not.toHaveBeenCalled();
    expect(mocks.useProfileBits).not.toHaveBeenCalled();
  });

  it('keeps the shared Shelf contract limited to recommendation inputs', () => {
    const source = readFileSync(`${RECOMMENDATIONS_DIR}/useRecommendations.ts`, 'utf8');
    const contract = source.slice(
      source.indexOf('export type RecommendationShelfSource'),
      source.indexOf('export type RecommendationProfileSource'),
    );

    expect(contract).toContain('data: ShelfData | undefined;');
    expect(contract).toContain('isError: boolean;');
    expect(contract).toContain('isFetching: boolean;');
    expect(contract).toContain('isLoading: boolean;');
    expect(contract).toContain('isSuccess: boolean;');
    expect(contract).not.toContain('ReturnType<typeof useShelf>');
    expect(contract).not.toContain('refetch');
  });
});
