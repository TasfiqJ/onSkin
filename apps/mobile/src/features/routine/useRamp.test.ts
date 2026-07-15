import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, ownerQueryPrefixes, queryKeys } from '@/lib/query/queryKeys';

import { useRamp, useRampFromPlan, type RampItem, type RampPlanSource } from './useRamp';

type MockRampQueryResult = {
  data: RampItem[] | undefined;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
};

const mocks = vi.hoisted(() => ({
  ensureRamp: vi.fn(),
  getStoredRamps: vi.fn(),
  invalidateQueries: vi.fn(async (_filters?: { queryKey?: readonly unknown[] }) => undefined),
  ownerScope: { generation: 0 },
  planResult: {
    data: {
      isExample: false,
      plan: {
        ramp: [
          {
            name: 'Retinol',
            productId: 'retinol',
            state: {
              freqPerWeek: 2,
              targetPerWeek: 3,
              toleranceState: 'building',
            },
          },
        ],
      },
    },
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(async (): Promise<{ isError: boolean }> => ({ isError: false })),
  },
  queryOptions: null as Record<string, unknown> | null,
  stepUpRamp: vi.fn(),
  useLocalDateBoundary: vi.fn(() => ({
    localDate: '2026-07-14',
    timeZone: 'America/Toronto',
  })),
  usePlan: vi.fn(),
  useQuery: vi.fn((options: Record<string, unknown>): MockRampQueryResult => {
    mocks.queryOptions = options;
    return {
      data: undefined,
      isError: false,
      isFetching: false,
      isPending: true,
      isSuccess: false,
      refetch: vi.fn(async () => undefined),
    };
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mocks.useQuery,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  };
});

vi.mock('@/lib/query/localDateBoundaryStore', () => ({
  useLocalDateBoundary: mocks.useLocalDateBoundary,
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));

vi.mock('./rampStore', () => ({
  ensureRamp: mocks.ensureRamp,
  getStoredRamps: mocks.getStoredRamps,
  stepUpRamp: mocks.stepUpRamp,
}));

vi.mock('./usePlan', () => ({
  usePlan: mocks.usePlan,
}));

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const OWNER_A_RAMP = {
  freqPerWeek: 2,
  lastStepUp: null,
  startedAt: '2026-06-01',
  targetPerWeek: 3,
  toleranceState: 'building' as const,
};

const OWNER_B_RAMP = {
  ...OWNER_A_RAMP,
  freqPerWeek: 1,
  startedAt: '2026-07-01',
};

const BOUNDARY = {
  localDate: '2026-07-14',
  timeZone: 'America/Toronto',
} as const;

function useCapturedRampQuery(): {
  queryFn: () => Promise<RampItem[]>;
  queryKey: readonly unknown[];
} {
  useRamp();
  return mocks.queryOptions as {
    queryFn: () => Promise<RampItem[]>;
    queryKey: readonly unknown[];
  };
}

function mockAvailableStepUpQuery(): void {
  mocks.useQuery.mockImplementationOnce((options: Record<string, unknown>) => {
    mocks.queryOptions = options;
    return {
      data: [
        {
          productId: 'retinol',
          name: 'Retinol',
          state: OWNER_A_RAMP,
          offerStepUp: true,
        },
      ],
      isError: false,
      isFetching: false,
      isPending: false,
      isSuccess: true,
      refetch: vi.fn(async () => undefined),
    };
  });
}

function useCapturedRamp(): ReturnType<typeof useRamp> {
  return useRamp();
}

beforeEach(() => {
  mocks.ensureRamp.mockReset();
  mocks.getStoredRamps.mockReset();
  mocks.getStoredRamps.mockResolvedValue({ retinol: OWNER_A_RAMP });
  mocks.invalidateQueries.mockReset();
  mocks.invalidateQueries.mockResolvedValue(undefined);
  mocks.ownerScope = createOwnerQueryScope();
  mocks.queryOptions = null;
  mocks.stepUpRamp.mockReset();
  mocks.stepUpRamp.mockResolvedValue(undefined);
  mocks.useLocalDateBoundary.mockClear();
  mocks.usePlan.mockReset();
  mocks.usePlan.mockReturnValue(mocks.planResult);
  mocks.planResult.retry.mockReset();
  mocks.planResult.retry.mockResolvedValue({ isError: false });
  mocks.useQuery.mockReset();
  mocks.useQuery.mockImplementation((options: Record<string, unknown>) => {
    mocks.queryOptions = options;
    return {
      data: undefined,
      isError: false,
      isFetching: false,
      isPending: true,
      isSuccess: false,
      refetch: vi.fn(async () => undefined),
    };
  });
});

describe('ramp source ownership', () => {
  it('uses the supplied day, runs offline, and retries only the owned ramp query', async () => {
    const upstreamRetry = vi.fn(async () => ({ isError: true }));
    const rampRefetch = vi.fn(async () => ({ isError: false }));
    mocks.useQuery.mockImplementationOnce((options: Record<string, unknown>) => {
      mocks.queryOptions = options;
      return {
        data: undefined,
        isError: true,
        isFetching: false,
        isPending: false,
        isSuccess: false,
        refetch: rampRefetch,
      };
    });

    const plan = { ...mocks.planResult, retry: upstreamRetry } as unknown as RampPlanSource;
    const result = useRampFromPlan(plan, BOUNDARY);

    expect(mocks.queryOptions).toMatchObject({
      enabled: true,
      networkMode: 'always',
      queryKey: queryKeys.ramp(mocks.ownerScope, BOUNDARY, 'retinol'),
    });
    await expect(result.retry()).resolves.toEqual({ isError: false });
    expect(rampRefetch).toHaveBeenCalledOnce();
    expect(upstreamRetry).not.toHaveBeenCalled();
    expect(mocks.usePlan).not.toHaveBeenCalled();
    expect(mocks.useLocalDateBoundary).not.toHaveBeenCalled();
  });

  it('reports a persistent owned ramp failure', async () => {
    const rampRefetch = vi.fn(async () => ({ isError: true }));
    mocks.useQuery.mockImplementationOnce((options: Record<string, unknown>) => {
      mocks.queryOptions = options;
      return {
        data: undefined,
        isError: true,
        isFetching: false,
        isPending: false,
        isSuccess: false,
        refetch: rampRefetch,
      };
    });

    const result = useRampFromPlan(mocks.planResult as unknown as RampPlanSource, BOUNDARY);

    await expect(result.retry()).resolves.toEqual({ isError: true });
    expect(rampRefetch).toHaveBeenCalledOnce();
  });

  it('leaves route-owned Plan recovery to the caller', async () => {
    const upstreamRetry = vi.fn(async () => ({ isError: false }));
    const plan = {
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
      retry: upstreamRetry,
    } as unknown as RampPlanSource;
    const result = useRampFromPlan(plan, BOUNDARY);

    expect(result.isError).toBe(true);
    await expect(result.retry()).resolves.toEqual({ isError: false });
    expect(upstreamRetry).not.toHaveBeenCalled();
  });

  it('keeps standalone Plan recovery and reports its persistent failure', async () => {
    const upstreamRetry = vi.fn(async () => ({ isError: true }));
    mocks.usePlan.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
      retry: upstreamRetry,
    });

    const result = useRamp();

    await expect(result.retry()).resolves.toEqual({ isError: true });
    expect(upstreamRetry).toHaveBeenCalledOnce();
  });
});

describe('ramp owner-bound query', () => {
  it('uses the owner/day key and keeps a delayed same-generation read valid', async () => {
    const delayed = deferred<Record<string, typeof OWNER_A_RAMP>>();
    mocks.getStoredRamps.mockReturnValueOnce(delayed.promise);
    const query = useCapturedRampQuery();

    expect(query.queryKey).toEqual(
      queryKeys.ramp(
        mocks.ownerScope,
        { localDate: '2026-07-14', timeZone: 'America/Toronto' },
        'retinol',
      ),
    );
    const pending = query.queryFn();
    await Promise.resolve();
    expect(mocks.getStoredRamps).toHaveBeenCalledOnce();

    delayed.resolve({ retinol: OWNER_A_RAMP });
    await expect(pending).resolves.toEqual([
      expect.objectContaining({ productId: 'retinol', state: OWNER_A_RAMP }),
    ]);
    expect(mocks.ensureRamp).not.toHaveBeenCalled();
  });

  it('detaches a hung owner-A read, drains immediately, and permits owner B', async () => {
    const ownerARead = deferred<Record<string, typeof OWNER_A_RAMP>>();
    mocks.getStoredRamps.mockReturnValueOnce(ownerARead.promise);
    const pendingA = useCapturedRampQuery().queryFn();
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    ownerARead.resolve({ retinol: OWNER_A_RAMP });
    await Promise.resolve();

    mocks.ownerScope = createOwnerQueryScope();
    mocks.getStoredRamps.mockResolvedValueOnce({ retinol: OWNER_B_RAMP });
    await expect(useCapturedRampQuery().queryFn()).resolves.toEqual([
      expect.objectContaining({ productId: 'retinol', state: OWNER_B_RAMP }),
    ]);
  });

  it('keeps a delayed lazy-seed mutation in the account drain before rejecting owner A', async () => {
    const ownerASeed = deferred<typeof OWNER_A_RAMP>();
    mocks.getStoredRamps.mockResolvedValueOnce({});
    mocks.ensureRamp.mockReturnValueOnce(ownerASeed.promise);
    const pendingA = useCapturedRampQuery().queryFn();
    await vi.waitFor(() => expect(mocks.ensureRamp).toHaveBeenCalledOnce());

    beginAccountGenerationBoundary();
    try {
      let drainFinished = false;
      const drain = waitForAccountGenerationOperationsToSettle().then(() => {
        drainFinished = true;
      });
      await Promise.resolve();
      expect(drainFinished).toBe(false);

      ownerASeed.resolve(OWNER_A_RAMP);
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await drain;
      expect(drainFinished).toBe(true);
    } finally {
      endAccountGenerationBoundary();
    }
  });
});

describe('ramp owner-bound step-up mutation', () => {
  it('keeps the private mutation in the account drain before rejecting owner A', async () => {
    const ownerAMutation = deferred<void>();
    mocks.stepUpRamp.mockReturnValueOnce(ownerAMutation.promise);
    mockAvailableStepUpQuery();

    const pendingA = useCapturedRamp().acceptStepUp('retinol');
    await vi.waitFor(() => expect(mocks.stepUpRamp).toHaveBeenCalledWith('retinol', 3));

    beginAccountGenerationBoundary();
    try {
      let drainFinished = false;
      const drain = waitForAccountGenerationOperationsToSettle().then(() => {
        drainFinished = true;
      });
      const rejected = expect(pendingA).rejects.toMatchObject({
        code: ACCOUNT_GENERATION_CHANGED,
      });
      await Promise.resolve();
      expect(drainFinished).toBe(false);
      expect(mocks.invalidateQueries).not.toHaveBeenCalled();

      ownerAMutation.resolve();
      await rejected;
      await drain;
      expect(drainFinished).toBe(true);
      expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('detaches hung cache invalidation and invalidates only the owner-A ramp prefix', async () => {
    const cache = new QueryClient();
    const ownerA = mocks.ownerScope;
    const ownerB = Object.freeze({ generation: ownerA.generation + 1 });
    const boundary = { localDate: '2026-07-14', timeZone: 'America/Toronto' } as const;
    const keyA = queryKeys.ramp(ownerA, boundary, 'retinol');
    const keyB = queryKeys.ramp(ownerB, boundary, 'retinol');
    const ownerAInvalidation = deferred<void>();
    cache.setQueryData(keyA, [OWNER_A_RAMP]);
    cache.setQueryData(keyB, [OWNER_B_RAMP]);
    mocks.invalidateQueries.mockImplementationOnce(async (filters) => {
      await cache.invalidateQueries({
        queryKey: filters?.queryKey,
        refetchType: 'none',
      });
      await ownerAInvalidation.promise;
    });
    mockAvailableStepUpQuery();

    const pendingA = useCapturedRamp().acceptStepUp('retinol');
    await vi.waitFor(() => expect(mocks.invalidateQueries).toHaveBeenCalledOnce());
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ownerQueryPrefixes.ramp(ownerA),
    });
    expect(cache.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(keyB)?.isInvalidated).toBe(false);

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    mocks.ownerScope = createOwnerQueryScope();
    expect(mocks.ownerScope).toEqual(ownerB);
    ownerAInvalidation.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.invalidateQueries).toHaveBeenCalledOnce();
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ownerQueryPrefixes.ramp(ownerB),
    });
    expect(cache.getQueryState(keyB)?.isInvalidated).toBe(false);
    cache.clear();
  });
});
