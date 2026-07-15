import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommerceConsent } from './useCommerce';

const mocks = vi.hoisted(() => ({
  commerceConsentQueryOptions: vi.fn(() => ({ queryKey: ['commerce-consent-test'] })),
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

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('./consentQuery', () => ({
  commerceConsentQueryOptions: mocks.commerceConsentQueryOptions,
}));

describe('commerce consent hook publication', () => {
  beforeEach(() => {
    mocks.commerceConsentQueryOptions.mockClear();
    mocks.useOwnerQueryScope.mockReset();
    mocks.useQuery.mockReset();
    mocks.useOwnerQueryScope.mockReturnValue(mocks.ownerScope);
    mocks.useQuery.mockImplementation(() => mocks.queryResult);
  });

  it('withholds a retained true grant after the fresh strict read errors', () => {
    mocks.queryResult = {
      data: true,
      isError: true,
      isFetching: false,
      isSuccess: false,
      status: 'error',
    };

    expect(useCommerceConsent()).toMatchObject({
      data: undefined,
      isError: true,
      isSuccess: false,
    });
    expect(mocks.commerceConsentQueryOptions).toHaveBeenCalledWith(mocks.ownerScope);
  });

  it('publishes true only from a currently successful consent read', () => {
    mocks.queryResult = {
      data: true,
      isError: false,
      isFetching: false,
      isSuccess: true,
      status: 'success',
    };

    expect(useCommerceConsent()).toMatchObject({ data: true, isSuccess: true });
  });

  it('withholds a retained grant while its strict refresh is still pending', () => {
    mocks.queryResult = {
      data: true,
      isError: false,
      isFetching: true,
      isSuccess: true,
      status: 'success',
    };

    expect(useCommerceConsent()).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: true,
    });
  });
});
