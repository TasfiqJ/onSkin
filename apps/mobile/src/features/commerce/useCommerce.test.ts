import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { useCommerceConsent, useWhereToBuy } from './useCommerce';

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  commerceConsentQueryOptions: vi.fn(() => ({ queryKey: ['commerce-consent-test'] })),
  eq: vi.fn(),
  from: vi.fn(),
  ownerScope: null as ReturnType<typeof createOwnerQueryScope> | null,
  queryResult: {} as Record<string, unknown>,
  select: vi.fn(),
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
  supabase: { from: mocks.from },
}));

vi.mock('./consentQuery', () => ({
  commerceConsentQueryOptions: mocks.commerceConsentQueryOptions,
}));

describe('commerce consent hook publication', () => {
  beforeEach(() => {
    for (let index = 0; index < 4; index += 1) endAccountGenerationBoundary();
    mocks.abortSignal.mockReset();
    mocks.commerceConsentQueryOptions.mockClear();
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.useOwnerQueryScope.mockReset();
    mocks.useQuery.mockReset();
    mocks.ownerScope = createOwnerQueryScope();
    mocks.useOwnerQueryScope.mockReturnValue(mocks.ownerScope);
    mocks.useQuery.mockImplementation((options: { queryKey?: readonly unknown[] }) =>
      options.queryKey?.[0] === 'commerce-consent-test' ? mocks.queryResult : options,
    );
    const query = {
      abortSignal: mocks.abortSignal,
      eq: mocks.eq,
      select: mocks.select,
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.abortSignal.mockResolvedValue({ data: [], error: null, status: 200 });
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

  it('owner-scopes Where to Buy and runs its read under the bounded request policy', async () => {
    const row = {
      id: 'link-a',
      product_type: 'cleanser',
      retailer: 'Retailer',
      label: 'Buy',
      url: 'https://example.com/cleanser',
      price_cents: 1900,
      currency: 'USD',
      source: 'catalog',
      is_paid: false,
      is_active: true,
    };
    mocks.abortSignal.mockResolvedValueOnce({ data: [row], error: null, status: 200 });

    const query = useWhereToBuy('cleanser') as unknown as {
      queryFn: () => Promise<unknown[]>;
      queryKey: readonly unknown[];
    };

    expect(query.queryKey).toEqual(queryKeys.whereToBuy(mocks.ownerScope!, 'cleanser'));
    await expect(query.queryFn()).resolves.toHaveLength(1);
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.eq).toHaveBeenNthCalledWith(1, 'product_type', 'cleanser');
    expect(mocks.eq).toHaveBeenNthCalledWith(2, 'is_active', true);
  });

  it('detaches a hung owner-A commerce read and never publishes its late rows', async () => {
    let resolveServer!: (result: { data: []; error: null; status: 200 }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    mocks.abortSignal.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveServer = resolve;
          markStarted();
        }),
    );
    const query = useWhereToBuy('cleanser') as unknown as {
      queryFn: () => Promise<unknown[]>;
    };
    let published = false;
    const outcome = query.queryFn().then(
      (value) => {
        published = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await started;

    beginAccountGenerationBoundary();
    try {
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(ACCOUNT_GENERATION_CHANGED);
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      expect(published).toBe(false);
    } finally {
      resolveServer({ data: [], error: null, status: 200 });
      endAccountGenerationBoundary();
    }
  });
});
