import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlanQueryResult } from '@/features/routine/usePlan';
import type { RampQueryResult } from '@/features/routine/useRamp';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import {
  useCycle,
  useCycleFromSources,
  type CycleProfileSource,
  type CycleShelfSource,
} from './useCycle';

const BOUNDARY = {
  localDate: '2026-07-14',
  timeZone: 'America/Toronto',
} as const;

const CONFIG = {
  anchorISO: '2026-07-14',
  customCycle: null,
  pausedFrom: null,
  recovery: null,
  skips: [],
  stagingOverrides: [],
  variant: 'auto',
};

const mocks = vi.hoisted(() => ({
  applyCustomCycleDefinition: vi.fn(),
  cfgRefetch: vi.fn(),
  loadCycleConfigWithLease: vi.fn(),
  orchestrate: vi.fn(),
  ownerScope: { generation: 0 },
  plan: undefined as unknown,
  profile: undefined as unknown,
  queryOptions: null as Record<string, unknown> | null,
  ramp: undefined as unknown,
  recoveryProgress: vi.fn(),
  shelf: undefined as unknown,
  useLocalDateBoundary: vi.fn(),
  usePlanFromSources: vi.fn(),
  useProfileBits: vi.fn(),
  useQuery: vi.fn(),
  useRampFromPlan: vi.fn(),
  useShelfFromBoundary: vi.fn(),
}));

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => true,
}));

vi.mock('@/features/routine/usePlan', () => ({
  usePlanFromSources: mocks.usePlanFromSources,
}));

vi.mock('@/features/routine/useRamp', () => ({
  useRampFromPlan: mocks.useRampFromPlan,
}));

vi.mock('@/features/shelf/useShelf', () => ({
  useShelfFromBoundary: mocks.useShelfFromBoundary,
}));

vi.mock('@/lib/query/localDateBoundaryStore', () => ({
  useLocalDateBoundary: mocks.useLocalDateBoundary,
}));

vi.mock('@/lib/query/useOwnerQueryScope', () => ({
  useOwnerQueryScope: () => mocks.ownerScope,
}));

vi.mock('./cycleStore', () => ({
  loadCycleConfigWithLease: mocks.loadCycleConfigWithLease,
  recoveryProgress: mocks.recoveryProgress,
}));

vi.mock('./customCycle', () => ({
  applyCustomCycleDefinition: mocks.applyCustomCycleDefinition,
}));

vi.mock('./orchestrate', () => ({
  orchestrate: mocks.orchestrate,
}));

vi.mock('./profile', () => ({
  useProfileBits: mocks.useProfileBits,
}));

vi.mock('./projection', () => ({
  nextSlotDate: vi.fn(() => null),
  nightFor: vi.fn(),
  nightIndex: vi.fn(() => 0),
  weekAhead: vi.fn(() => []),
}));

function shelfSource(
  overrides: Partial<CycleShelfSource> = {},
): CycleShelfSource & { refetch: ReturnType<typeof vi.fn> } {
  return {
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
    isLoading: false,
    isSuccess: true,
    refetch: vi.fn(async () => ({ isError: false })),
    ...overrides,
  } as CycleShelfSource & { refetch: ReturnType<typeof vi.fn> };
}

function profileSource(
  overrides: Partial<CycleProfileSource> = {},
): CycleProfileSource & { refetch: ReturnType<typeof vi.fn> } {
  return {
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
    isLoading: false,
    isSuccess: true,
    refetch: vi.fn(async () => ({ isError: false })),
    ...overrides,
  } as CycleProfileSource & { refetch: ReturnType<typeof vi.fn> };
}

function planSource(overrides: Partial<PlanQueryResult> = {}): PlanQueryResult {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    retry: vi.fn(async () => ({ isError: false })),
    ...overrides,
  };
}

function rampSource(overrides: Partial<RampQueryResult> = {}): RampQueryResult {
  return {
    acceptStepUp: vi.fn(async () => undefined),
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    items: [],
    retry: vi.fn(async () => ({ isError: false })),
    ...overrides,
  };
}

function mockConfigQuery(overrides: Record<string, unknown> = {}): void {
  mocks.useQuery.mockImplementationOnce((options: Record<string, unknown>) => {
    mocks.queryOptions = options;
    return {
      data: CONFIG,
      isError: false,
      isFetching: false,
      isLoading: false,
      isSuccess: true,
      refetch: mocks.cfgRefetch,
      ...overrides,
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ownerScope = createOwnerQueryScope();
  mocks.queryOptions = null;
  mocks.cfgRefetch.mockResolvedValue({ isError: false });
  mocks.orchestrate.mockReturnValue({
    amDaily: [],
    conflictChoices: [],
    cycle: null,
    cycleActives: [],
    notes: [],
  });
  mocks.recoveryProgress.mockReturnValue({ active: false, day: 0, days: 0 });
  mocks.shelf = shelfSource();
  mocks.profile = profileSource();
  mocks.plan = planSource();
  mocks.ramp = rampSource();
  mocks.useLocalDateBoundary.mockReturnValue(BOUNDARY);
  mocks.useShelfFromBoundary.mockImplementation(() => mocks.shelf);
  mocks.useProfileBits.mockImplementation(() => mocks.profile);
  mocks.usePlanFromSources.mockImplementation(() => mocks.plan);
  mocks.useRampFromPlan.mockImplementation(() => mocks.ramp);
  mockConfigQuery();
});

describe('cycle source ownership', () => {
  it('does not retry shared Shelf/profile/ramp sources', async () => {
    const shelfRefetch = vi.fn(async () => ({ isError: false }));
    const profileRefetch = vi.fn(async () => ({ isError: false }));
    const rampRetry = vi.fn(async () => ({ isError: false }));
    const shelf = shelfSource({ data: undefined, isError: true, isSuccess: false });
    const profile = profileSource({ data: undefined, isError: true, isSuccess: false });
    const ramp = rampSource({ isError: true, isSuccess: false });
    shelf.refetch = shelfRefetch;
    profile.refetch = profileRefetch;
    ramp.retry = rampRetry;

    const result = useCycleFromSources(shelf, profile, ramp, BOUNDARY);

    expect(result.isError).toBe(true);
    await expect(result.retry()).resolves.toEqual({ isError: false });
    expect(shelfRefetch).not.toHaveBeenCalled();
    expect(profileRefetch).not.toHaveBeenCalled();
    expect(rampRetry).not.toHaveBeenCalled();
    expect(mocks.useShelfFromBoundary).not.toHaveBeenCalled();
    expect(mocks.useProfileBits).not.toHaveBeenCalled();
    expect(mocks.usePlanFromSources).not.toHaveBeenCalled();
    expect(mocks.useRampFromPlan).not.toHaveBeenCalled();
  });

  it('runs cycle config offline and reports a persistent owned retry failure', async () => {
    mocks.useQuery.mockReset();
    mocks.cfgRefetch.mockResolvedValueOnce({ isError: true });
    mockConfigQuery({
      data: undefined,
      isError: true,
      isSuccess: false,
    });

    const result = useCycleFromSources(shelfSource(), profileSource(), rampSource(), BOUNDARY);

    expect(mocks.queryOptions).toMatchObject({
      networkMode: 'always',
      queryKey: queryKeys.cycleConfig(mocks.ownerScope, BOUNDARY),
      retry: false,
      retryOnMount: false,
    });
    await expect(result.retry()).resolves.toEqual({ isError: true });
    expect(mocks.cfgRefetch).toHaveBeenCalledOnce();
  });

  it('never orchestrates while authoritative ramp cadence is pending', () => {
    const result = useCycleFromSources(
      shelfSource(),
      profileSource(),
      rampSource({ isFetching: true, isLoading: true, isSuccess: false }),
      BOUNDARY,
    );

    expect(result.data).toBeUndefined();
    expect(result.isLoading).toBe(true);
    expect(result.isSuccess).toBe(false);
    expect(mocks.orchestrate).not.toHaveBeenCalled();
  });

  it('standalone composition shares one boundary and retries every owner once', async () => {
    const shelf = shelfSource({ data: undefined, isError: true, isSuccess: false });
    const profile = profileSource({ data: undefined, isError: true, isSuccess: false });
    const planRetry = vi.fn(async () => ({ isError: false }));
    const plan = planSource({ isError: true, isSuccess: false, retry: planRetry });
    const rampRetry = vi.fn(async () => ({ isError: true }));
    const ramp = rampSource({ isError: true, isSuccess: false, retry: rampRetry });
    mocks.shelf = shelf;
    mocks.profile = profile;
    mocks.plan = plan;
    mocks.ramp = ramp;
    mocks.useQuery.mockReset();
    mockConfigQuery({ data: undefined, isError: true, isSuccess: false });

    const result = useCycle();

    expect(mocks.useLocalDateBoundary).toHaveBeenCalledOnce();
    expect(mocks.useShelfFromBoundary).toHaveBeenCalledWith(BOUNDARY);
    expect(mocks.useProfileBits).toHaveBeenCalledOnce();
    expect(mocks.usePlanFromSources).toHaveBeenCalledWith(shelf, profile);
    expect(mocks.useRampFromPlan).toHaveBeenCalledWith(plan, BOUNDARY);
    await expect(result.retry()).resolves.toEqual({ isError: true });
    expect(shelf.refetch).toHaveBeenCalledOnce();
    expect(profile.refetch).toHaveBeenCalledOnce();
    expect(planRetry).toHaveBeenCalledOnce();
    expect(rampRetry).toHaveBeenCalledOnce();
    expect(mocks.cfgRefetch).toHaveBeenCalledOnce();
  });
});
