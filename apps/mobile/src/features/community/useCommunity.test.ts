import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommunityGate } from './useCommunity';

const mocks = vi.hoisted(() => ({
  communityGateQueryOptions: vi.fn(() => ({ queryKey: ['community-gate-test'] })),
  ownerScope: Object.freeze({ generation: 9 }),
  queryResult: {} as Record<string, unknown>,
  useOwnerQueryScope: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: mocks.useOwnerQueryScope,
}));

vi.mock('./communityGateQuery', () => ({
  communityGateQueryOptions: mocks.communityGateQueryOptions,
}));

describe('community gate hook publication', () => {
  beforeEach(() => {
    mocks.communityGateQueryOptions.mockClear();
    mocks.useOwnerQueryScope.mockReset();
    mocks.useQuery.mockReset();
    mocks.useOwnerQueryScope.mockReturnValue(mocks.ownerScope);
    mocks.useQuery.mockImplementation(() => mocks.queryResult);
  });

  it('withholds a retained open gate after the fresh strict read errors', () => {
    mocks.queryResult = {
      data: { consented: true, ageConfirmed: true },
      isError: true,
      isFetching: false,
      isSuccess: false,
      status: 'error',
    };

    expect(useCommunityGate()).toMatchObject({
      data: undefined,
      isError: true,
      isSuccess: false,
    });
    expect(mocks.communityGateQueryOptions).toHaveBeenCalledWith(mocks.ownerScope);
  });

  it('publishes an open gate only from a currently successful strict read', () => {
    const gate = { consented: true, ageConfirmed: true };
    mocks.queryResult = {
      data: gate,
      isError: false,
      isFetching: false,
      isSuccess: true,
      status: 'success',
    };

    expect(useCommunityGate()).toMatchObject({ data: gate, isSuccess: true });
  });

  it('withholds a retained open gate while its strict refresh is pending', () => {
    const gate = { consented: true, ageConfirmed: true };
    mocks.queryResult = {
      data: gate,
      isError: false,
      isFetching: true,
      isSuccess: true,
      status: 'success',
    };

    expect(useCommunityGate()).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: true,
    });
  });
});
