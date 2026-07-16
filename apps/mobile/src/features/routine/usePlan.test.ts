import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';
import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { usePlan, usePlanFromSources } from './usePlan';

const mocks = vi.hoisted(() => ({
  loadRoutineOrderOverrides: vi.fn(),
  ownerScope: { generation: 0 },
  profileRefetch: vi.fn(),
  shelfRefetch: vi.fn(),
  useProfileBits: vi.fn(),
  useQuery: vi.fn((options: Record<string, unknown>) => ({
    ...options,
    data: { schemaVersion: 1, am: [], pm: [] },
    isError: false,
    isFetching: false,
    isPending: false,
    isSuccess: true,
    refetch: vi.fn(async () => undefined),
  })),
  useShelf: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
}));

vi.mock('@/features/scheduler/profile', () => ({
  useProfileBits: mocks.useProfileBits,
}));

vi.mock('@/features/shelf/useShelf', () => ({
  useShelf: mocks.useShelf,
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));

vi.mock('./orderStore', () => ({
  applyRoutineOrderOverrides: (plan: unknown) => plan,
  loadRoutineOrderOverrides: mocks.loadRoutineOrderOverrides,
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

function useCapturedRoutineOrderQuery(): {
  queryFn: () => Promise<{ schemaVersion: 1; am: string[]; pm: string[] }>;
  queryKey: readonly unknown[];
} {
  usePlan();
  return mocks.useQuery.mock.calls.at(-1)?.[0] as {
    queryFn: () => Promise<{ schemaVersion: 1; am: string[]; pm: string[] }>;
    queryKey: readonly unknown[];
  };
}

beforeEach(() => {
  mocks.loadRoutineOrderOverrides.mockReset();
  mocks.loadRoutineOrderOverrides.mockResolvedValue({ schemaVersion: 1, am: [], pm: [] });
  mocks.profileRefetch.mockReset();
  mocks.profileRefetch.mockResolvedValue({ isError: false });
  mocks.shelfRefetch.mockReset();
  mocks.shelfRefetch.mockResolvedValue({ isError: false });
  mocks.useProfileBits.mockReset();
  mocks.useProfileBits.mockReturnValue({
    data: {
      consentCurrent: true,
      goals: [],
      moisture: 'balanced',
      pregnancy: false,
      pregnancySafety: 'clear',
      pregnancyStatus: 'none',
      sensitivity: 'neutral',
      source: 'local',
    },
    isError: false,
    isFetching: false,
    isPending: false,
    isSuccess: true,
    refetch: mocks.profileRefetch,
  });
  mocks.useQuery.mockClear();
  mocks.useShelf.mockReset();
  mocks.useShelf.mockReturnValue({
    data: {
      archive: [],
      banner: null,
      conflictChoices: {},
      conflicts: [],
      items: [],
      reassurances: [],
      unresolvedConflicts: [],
    },
    isError: false,
    isFetching: false,
    isPending: false,
    isSuccess: true,
    refetch: mocks.shelfRefetch,
  });
  mocks.ownerScope = createOwnerQueryScope();
});

describe('routine plan profile label', () => {
  it('labels the empty-shelf fallback as an example', () => {
    expect(routinePlanProfileLabel(null, true)).toBe('EXAMPLE ROUTINE');
  });

  it('does not fabricate dry sensitive copy for neutral profiles', () => {
    expect(
      routinePlanProfileLabel(
        { sensitivity: 'neutral', moisture: 'balanced', pregnancy: false, goals: [] },
        false,
      ),
    ).toBe('BUILT FROM YOUR SHELF');
  });

  it('reflects the real coarse profile when available', () => {
    expect(
      routinePlanProfileLabel(
        { sensitivity: 'resistant', moisture: 'oily', pregnancy: false, goals: [] },
        false,
      ),
    ).toBe('BUILT FOR OILY, RESISTANT SKIN');
  });

  it('marks pregnancy-aware plans without adding sensitive details', () => {
    expect(
      routinePlanProfileLabel(
        { sensitivity: 'sensitive', moisture: 'dry', pregnancy: true, goals: [] },
        false,
      ),
    ).toBe('BUILT FOR DRY, SENSITIVE, PREGNANCY-AWARE SKIN');
  });

  it('labels an unconfirmed cautious profile without inferring pregnancy', () => {
    expect(
      routinePlanProfileLabel(
        {
          sensitivity: 'neutral',
          moisture: 'balanced',
          pregnancy: false,
          pregnancySafety: 'caution',
          pregnancyStatus: 'prefer_not',
          goals: [],
        },
        false,
      ),
    ).toBe('BUILT FOR SAFETY-FIRST SKIN');
  });
});

describe('routine order owner-bound query', () => {
  it('reports persistent failures from every standalone retry owner', async () => {
    const routineOrderRefetch = vi.fn(async () => ({ isError: true }));
    mocks.shelfRefetch.mockResolvedValueOnce({ isError: true });
    mocks.profileRefetch.mockResolvedValueOnce({ isError: true });
    mocks.useShelf.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isPending: false,
      isSuccess: false,
      refetch: mocks.shelfRefetch,
    });
    mocks.useProfileBits.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isPending: false,
      isSuccess: false,
      refetch: mocks.profileRefetch,
    });
    mocks.useQuery.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isPending: false,
      isSuccess: false,
      refetch: routineOrderRefetch,
    } as never);

    const result = usePlan();

    await expect(result.retry()).resolves.toEqual({ isError: true });
    expect(mocks.shelfRefetch).toHaveBeenCalledOnce();
    expect(mocks.profileRefetch).toHaveBeenCalledOnce();
    expect(routineOrderRefetch).toHaveBeenCalledOnce();
  });

  it('keeps shared Shelf/profile retry ownership with the route view model', async () => {
    const shelfRefetch = vi.fn(async () => ({ isError: false }));
    const profileRefetch = vi.fn(async () => ({ isError: false }));
    const routineOrderRefetch = vi.fn(async () => ({ isError: false }));
    mocks.useQuery.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isPending: false,
      isSuccess: false,
      refetch: routineOrderRefetch,
    } as never);

    const result = usePlanFromSources(
      {
        data: undefined,
        isError: true,
        isFetching: false,
        isPending: false,
        isSuccess: false,
        refetch: shelfRefetch,
      } as never,
      {
        data: undefined,
        isError: true,
        isFetching: false,
        isPending: false,
        isSuccess: false,
        refetch: profileRefetch,
      } as never,
    );

    await expect(result.retry()).resolves.toEqual({ isError: false });

    expect(routineOrderRefetch).toHaveBeenCalledOnce();
    expect(shelfRefetch).not.toHaveBeenCalled();
    expect(profileRefetch).not.toHaveBeenCalled();
  });

  it('reports a persistent routine-order retry failure to the route owner', async () => {
    const routineOrderRefetch = vi.fn(async () => ({ isError: true }));
    mocks.useQuery.mockReturnValueOnce({
      data: undefined,
      isError: true,
      isFetching: false,
      isPending: false,
      isSuccess: false,
      refetch: routineOrderRefetch,
    } as never);

    const result = usePlanFromSources(
      {
        data: {
          archive: [],
          banner: null,
          conflictChoices: {},
          conflicts: [],
          items: [],
          profile: {
            consentCurrent: true,
            goals: [],
            moisture: 'balanced',
            pregnancy: false,
            pregnancySafety: 'clear',
            pregnancyStatus: 'none',
            sensitivity: 'neutral',
            source: 'local',
          },
          reassurances: [],
          unresolvedConflicts: [],
        },
        isError: false,
        isFetching: false,
        isPending: false,
        isSuccess: true,
      },
      {
        data: {
          consentCurrent: true,
          goals: [],
          moisture: 'balanced',
          pregnancy: false,
          pregnancySafety: 'clear',
          pregnancyStatus: 'none',
          sensitivity: 'neutral',
          source: 'local',
        },
        isError: false,
        isFetching: false,
        isPending: false,
        isSuccess: true,
      },
    );

    await expect(result.retry()).resolves.toEqual({ isError: true });
    expect(routineOrderRefetch).toHaveBeenCalledOnce();
  });

  it('uses the owner-scoped key and keeps a delayed same-generation read valid', async () => {
    const delayed = deferred<{ schemaVersion: 1; am: string[]; pm: string[] }>();
    mocks.loadRoutineOrderOverrides.mockReturnValueOnce(delayed.promise);
    const query = useCapturedRoutineOrderQuery();

    expect(query.queryKey).toEqual(queryKeys.routineOrder(mocks.ownerScope));
    const pending = query.queryFn();
    await Promise.resolve();
    expect(mocks.loadRoutineOrderOverrides).toHaveBeenCalledOnce();

    delayed.resolve({ schemaVersion: 1, am: ['cleanser'], pm: ['retinoid'] });
    await expect(pending).resolves.toEqual({
      schemaVersion: 1,
      am: ['cleanser'],
      pm: ['retinoid'],
    });
  });

  it('detaches a hung owner-A read, drains the boundary, and permits owner B', async () => {
    const ownerARead = deferred<{ schemaVersion: 1; am: string[]; pm: string[] }>();
    mocks.loadRoutineOrderOverrides.mockReturnValueOnce(ownerARead.promise);
    const pendingA = useCapturedRoutineOrderQuery().queryFn();
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    ownerARead.resolve({ schemaVersion: 1, am: ['owner-a'], pm: [] });
    await Promise.resolve();

    mocks.ownerScope = createOwnerQueryScope();
    mocks.loadRoutineOrderOverrides.mockResolvedValueOnce({
      schemaVersion: 1,
      am: ['owner-b'],
      pm: [],
    });
    await expect(useCapturedRoutineOrderQuery().queryFn()).resolves.toEqual({
      schemaVersion: 1,
      am: ['owner-b'],
      pm: [],
    });
  });
});
