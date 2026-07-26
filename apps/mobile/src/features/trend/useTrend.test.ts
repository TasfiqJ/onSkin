import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys, type OwnerQueryScope } from '@/lib/query/queryKeys';

import {
  useMonkBand,
  useTrendConsent,
  useTrendInsight,
  useTrendInsightFromPhotos,
} from './useTrend';

const mocks = vi.hoisted(() => ({
  abortSignal: vi.fn(),
  consentResult: null as Record<string, unknown> | null,
  from: vi.fn(),
  isTrendInsightsConsentedWithLease: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  monkResult: null as Record<string, unknown> | null,
  order: vi.fn(),
  select: vi.fn(),
  serverSignal: null as AbortSignal | null,
  photosResult: null as Record<string, unknown> | null,
  useOwnerQueryScope: vi.fn(),
  usePhotos: vi.fn(),
  useQuery: vi.fn(),
}));

const serverQuery = {
  abortSignal: mocks.abortSignal,
  limit: mocks.limit,
  maybeSingle: mocks.maybeSingle,
  order: mocks.order,
  select: mocks.select,
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('react', () => ({
  useMemo: (factory: () => unknown) => factory(),
}));

vi.mock('@/features/photos/usePhotos', () => ({
  usePhotos: mocks.usePhotos,
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: mocks.useOwnerQueryScope,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('./consent', () => ({
  isTrendInsightsConsentedWithLease: mocks.isTrendInsightsConsentedWithLease,
}));

type CapturedQuery<T> = {
  networkMode?: string;
  queryFn: () => Promise<T>;
  queryKey: readonly unknown[];
  refetchOnReconnect?: (query: { state: { status: string } }) => boolean | 'always';
};

function capturedQuery<T>(hook: () => unknown): CapturedQuery<T> {
  return hook() as CapturedQuery<T>;
}

describe('owner-bound trend queries', () => {
  let ownerScope: OwnerQueryScope;

  beforeEach(() => {
    // Keep the account-generation singleton balanced if a prior assertion
    // interrupted a boundary cleanup.
    for (let index = 0; index < 4; index += 1) endAccountGenerationBoundary();

    mocks.abortSignal.mockReset();
    mocks.consentResult = null;
    mocks.from.mockReset();
    mocks.isTrendInsightsConsentedWithLease.mockReset();
    mocks.limit.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.monkResult = null;
    mocks.order.mockReset();
    mocks.select.mockReset();
    mocks.serverSignal = null;
    mocks.photosResult = null;
    mocks.useOwnerQueryScope.mockReset();
    mocks.usePhotos.mockReset();
    mocks.useQuery.mockReset();

    ownerScope = createOwnerQueryScope();
    mocks.useOwnerQueryScope.mockReturnValue(ownerScope);
    mocks.usePhotos.mockImplementation(() => mocks.photosResult);
    mocks.useQuery.mockImplementation((options: { queryKey?: readonly unknown[] }) => {
      if (options.queryKey?.[0] === 'trendConsent' && mocks.consentResult) {
        return mocks.consentResult;
      }
      if (options.queryKey?.[0] === 'monkBand' && mocks.monkResult) return mocks.monkResult;
      return options;
    });
    mocks.isTrendInsightsConsentedWithLease.mockResolvedValue(false);
    mocks.from.mockReturnValue(serverQuery);
    mocks.select.mockReturnValue(serverQuery);
    mocks.order.mockReturnValue(serverQuery);
    mocks.limit.mockReturnValue(serverQuery);
    mocks.abortSignal.mockImplementation((signal: AbortSignal) => {
      mocks.serverSignal = signal;
      return serverQuery;
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('runs consent under the owner lease and preserves same-owner refresh plus offline mode', async () => {
    const leases: AccountGenerationLease[] = [];
    mocks.isTrendInsightsConsentedWithLease
      .mockImplementationOnce(async (lease: AccountGenerationLease) => {
        leases.push(lease);
        lease.assertCurrent();
        return true;
      })
      .mockImplementationOnce(async (lease: AccountGenerationLease) => {
        leases.push(lease);
        lease.assertCurrent();
        return false;
      });

    const query = capturedQuery<boolean>(useTrendConsent);

    expect(query.queryKey).toEqual(queryKeys.trendConsent(ownerScope));
    expect(query.networkMode).toBe('always');
    expect(query.refetchOnReconnect?.({ state: { status: 'success' } })).toBe(true);
    expect(query.refetchOnReconnect?.({ state: { status: 'error' } })).toBe(false);
    await expect(query.queryFn()).resolves.toBe(true);
    await expect(query.queryFn()).resolves.toBe(false);
    expect(leases).toHaveLength(2);
    expect(leases.every((lease) => lease.generation === ownerScope.generation)).toBe(true);
  });

  it('passes an owner abort signal to Monk reads and preserves null recovery and refresh', async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { monk_tone: 4 }, error: null })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { monk_tone: 7 }, error: null });

    const query = capturedQuery<number | null>(useMonkBand);

    expect(query.queryKey).toEqual(queryKeys.monkBand(ownerScope));
    await expect(query.queryFn()).resolves.toBe(4);
    await expect(query.queryFn()).resolves.toBeNull();
    await expect(query.queryFn()).resolves.toBe(7);
    expect(mocks.from).toHaveBeenCalledTimes(3);
    expect(mocks.abortSignal).toHaveBeenCalledTimes(3);
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('detaches a hung Monk transport, drains the boundary, and suppresses its late value', async () => {
    let resolveServer!: (value: { data: { monk_tone: number }; error: null }) => void;
    let markServerStarted!: () => void;
    const serverStarted = new Promise<void>((resolve) => {
      markServerStarted = resolve;
    });
    mocks.maybeSingle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveServer = resolve;
          markServerStarted();
        }),
    );

    const query = capturedQuery<number | null>(useMonkBand);
    let published = false;
    const outcome = query.queryFn().then(
      (value) => {
        published = true;
        return { status: 'resolved' as const, value };
      },
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await serverStarted;
    beginAccountGenerationBoundary();
    try {
      const rejected = await outcome;
      expect(rejected.status).toBe('rejected');
      expect((rejected as { error: Error }).error.message).toBe(ACCOUNT_GENERATION_CHANGED);
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
      expect(mocks.serverSignal?.aborted).toBe(true);
      expect(published).toBe(false);

      resolveServer({ data: { monk_tone: 9 }, error: null });
      await Promise.resolve();
      await Promise.resolve();
      expect(published).toBe(false);
    } finally {
      resolveServer({ data: { monk_tone: 9 }, error: null });
      endAccountGenerationBoundary();
    }
  });

  it.each(['consent', 'photos', 'monk'] as const)(
    'withholds insight when %s has stale data but the latest read failed',
    (failedInput) => {
      mocks.consentResult = {
        data: true,
        isError: false,
        isLoading: false,
        isSuccess: true,
      };
      mocks.photosResult = {
        data: { series: [{}, {}, {}] },
        isError: false,
        isLoading: false,
        isSuccess: true,
      };
      mocks.monkResult = {
        data: 8,
        isError: false,
        isLoading: false,
        isSuccess: true,
      };

      const failed = {
        data:
          failedInput === 'consent'
            ? true
            : failedInput === 'photos'
              ? { series: [{}, {}, {}] }
              : 8,
        isError: true,
        isLoading: false,
        isSuccess: false,
      };
      if (failedInput === 'consent') mocks.consentResult = failed;
      if (failedInput === 'photos') mocks.photosResult = failed;
      if (failedInput === 'monk') mocks.monkResult = failed;

      const result = useTrendInsight();

      expect(result.insight).toBeNull();
      expect(result.consented).toBe(failedInput !== 'consent');
    },
  );

  it('includes Monk readiness in loading and withholds a provisional fairness result', () => {
    mocks.consentResult = {
      data: true,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    mocks.photosResult = {
      data: { series: [{}, {}, {}] },
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    mocks.monkResult = {
      data: undefined,
      isError: false,
      isLoading: true,
      isSuccess: false,
    };

    const result = useTrendInsight();

    expect(result).toMatchObject({ consented: true, insight: null, isLoading: true });
  });

  it('derives an insight only after consent, photos, and Monk are all successful', () => {
    mocks.consentResult = {
      data: true,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    mocks.photosResult = {
      data: { series: [{}, {}, {}] },
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    mocks.monkResult = {
      data: 8,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };

    const result = useTrendInsight();

    expect(result.consented).toBe(true);
    expect(result.isLoading).toBe(false);
    expect(result.insight).toMatchObject({ monkBand: 8 });
  });

  it('derives from a route-owned photo snapshot without mounting a standalone photo observer', () => {
    mocks.consentResult = {
      data: true,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    const photos = {
      data: { series: [{}, {}, {}] },
      isError: false,
      isLoading: false,
      isSuccess: true,
    } as unknown as Parameters<typeof useTrendInsightFromPhotos>[0];
    mocks.monkResult = {
      data: 8,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };

    const result = useTrendInsightFromPhotos(photos);

    expect(mocks.usePhotos).not.toHaveBeenCalled();
    expect(result).toMatchObject({ consented: true, isLoading: false });
    expect(result.insight).toMatchObject({ monkBand: 8 });
  });

  it('keeps an explicit successful decline locked without reporting loading', () => {
    mocks.consentResult = {
      data: false,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    mocks.photosResult = {
      data: { series: [{}, {}, {}] },
      isError: false,
      isLoading: false,
      isSuccess: true,
    };
    mocks.monkResult = {
      data: 8,
      isError: false,
      isLoading: false,
      isSuccess: true,
    };

    expect(useTrendInsight()).toMatchObject({ consented: false, insight: null, isLoading: false });
  });
});
