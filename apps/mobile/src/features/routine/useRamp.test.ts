import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRamp } from './useRamp';

const mocks = vi.hoisted(() => ({
  assertCadence: vi.fn(),
  cadenceReady: true,
  ensureRamp: vi.fn(),
  getStoredRamps: vi.fn(),
  invalidateQueries: vi.fn(async () => {}),
  queryOptions: undefined as
    | {
        enabled: boolean;
        queryFn: () => Promise<unknown>;
      }
    | undefined,
  queryResult: {
    data: [] as unknown[],
    isError: false,
    isLoading: false,
  },
  recoveryReady: true,
  runHealthOperation: vi.fn(),
  shouldOfferStepUp: vi.fn(() => false),
  stepUpRamp: vi.fn(async () => {}),
  usePlan: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('@/features/routine/reviewGate', () => ({
  canUseRoutineCadence: () => mocks.cadenceReady,
  canUseRoutineRecovery: () => mocks.recoveryReady,
}));
vi.mock('@/features/scheduler/cycleStore', () => ({
  assertRoutineCadenceMutationAdmission: mocks.assertCadence,
}));
vi.mock('@/features/today/useToday', () => ({
  localDateString: () => '2026-07-26',
}));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runCurrentHealthDataOperation: mocks.runHealthOperation,
}));
vi.mock('./ramp', () => ({
  shouldOfferStepUp: mocks.shouldOfferStepUp,
}));
vi.mock('./rampStore', () => ({
  ensureRamp: mocks.ensureRamp,
  getStoredRamps: mocks.getStoredRamps,
  stepUpRamp: mocks.stepUpRamp,
}));
vi.mock('./usePlan', () => ({
  usePlan: mocks.usePlan,
}));

const steadyItem = {
  productId: 'steady',
  name: 'Steady retinoid',
  state: {
    freqPerWeek: 2,
    targetPerWeek: 3,
    toleranceState: 'steady' as const,
    startedAt: '2026-06-01',
    lastStepUp: null,
  },
  offerStepUp: true,
};

const pausedItem = {
  productId: 'paused',
  name: 'Paused retinoid',
  state: {
    ...steadyItem.state,
    toleranceState: 'paused_irritation' as const,
  },
  offerStepUp: false,
};

beforeEach(() => {
  mocks.assertCadence.mockReset();
  mocks.cadenceReady = true;
  mocks.ensureRamp.mockReset();
  mocks.getStoredRamps.mockReset();
  mocks.invalidateQueries.mockReset();
  mocks.invalidateQueries.mockResolvedValue(undefined);
  mocks.queryOptions = undefined;
  mocks.queryResult = { data: [], isError: false, isLoading: false };
  mocks.recoveryReady = true;
  mocks.runHealthOperation.mockReset();
  mocks.runHealthOperation.mockImplementation(
    async (operation: (lease: { assertCurrent: () => void }) => Promise<unknown>) =>
      operation({ assertCurrent: vi.fn() }),
  );
  mocks.shouldOfferStepUp.mockReset();
  mocks.shouldOfferStepUp.mockReturnValue(false);
  mocks.stepUpRamp.mockReset();
  mocks.stepUpRamp.mockResolvedValue(undefined);
  mocks.usePlan.mockReset();
  mocks.usePlan.mockReturnValue({
    data: { plan: { ramp: [] } },
    isError: false,
    isExample: false,
    isLoading: false,
    sourceReady: true,
  });
  mocks.useQuery.mockReset();
  mocks.useQuery.mockImplementation((options) => {
    mocks.queryOptions = options;
    return mocks.queryResult;
  });
});

describe('useRamp publication admission', () => {
  it('publishes no cached cadence items or offers while cadence is closed', () => {
    mocks.cadenceReady = false;
    mocks.queryResult.data = [steadyItem, pausedItem];

    const result = useRamp();

    expect(mocks.queryOptions?.enabled).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(false);
    expect(result.sourceReady).toBe(false);
    expect(mocks.getStoredRamps).not.toHaveBeenCalled();
    expect(mocks.ensureRamp).not.toHaveBeenCalled();
  });

  it('suppresses cached paused-irritation guidance when recovery is closed', () => {
    mocks.recoveryReady = false;
    mocks.queryResult.data = [pausedItem, steadyItem];

    const result = useRamp();

    expect(result.items).toEqual([steadyItem]);
    expect(result.items.some((item) => item.state.toleranceState === 'paused_irritation')).toBe(
      false,
    );
    expect(mocks.getStoredRamps).not.toHaveBeenCalled();
    expect(mocks.ensureRamp).not.toHaveBeenCalled();
  });

  it('asserts cadence before the query can read or seed private ramp state', async () => {
    mocks.assertCadence.mockImplementationOnce(() => {
      throw new Error('ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED');
    });
    useRamp();

    await expect(mocks.queryOptions?.queryFn()).rejects.toThrow(
      'ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED',
    );
    expect(mocks.getStoredRamps).not.toHaveBeenCalled();
    expect(mocks.ensureRamp).not.toHaveBeenCalled();
  });

  it('asserts cadence before the health operation and again before invalidation', async () => {
    const result = useRamp();

    await result.acceptStepUp('steady');

    expect(mocks.assertCadence).toHaveBeenCalledTimes(3);
    expect(mocks.assertCadence.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.runHealthOperation.mock.invocationCallOrder[0]!,
    );
    expect(mocks.stepUpRamp).toHaveBeenCalledWith('steady');
    expect(mocks.stepUpRamp.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.assertCadence.mock.invocationCallOrder[2]!,
    );
    expect(mocks.assertCadence.mock.invocationCallOrder[2]).toBeLessThan(
      mocks.invalidateQueries.mock.invocationCallOrder[0]!,
    );
  });

  it('cannot enter the health operation when direct step-up admission is closed', () => {
    mocks.assertCadence.mockImplementationOnce(() => {
      throw new Error('ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED');
    });
    const result = useRamp();

    expect(() => result.acceptStepUp('steady')).toThrow(
      'ROUTINE_CADENCE_MUTATION_ADMISSION_CLOSED',
    );
    expect(mocks.runHealthOperation).not.toHaveBeenCalled();
    expect(mocks.stepUpRamp).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
});
