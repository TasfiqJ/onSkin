import { useMemo } from 'react';

import { useCycleFromSources, type CycleQueryResult } from '@/features/scheduler/useCycle';

import { usePlanFromSources, type PlanQueryResult } from './usePlan';
import { useRampFromPlan } from './useRamp';
import { useRoutineRouteSources } from './RoutineRouteSources';

type RetryResult = void | { isError: boolean };

function anyRetryFailed(results: RetryResult[]): boolean {
  return results.some((result) => result && typeof result === 'object' && result.isError);
}

/**
 * Own the Routine Plan route's complete query graph. Plan and Cycle share the
 * exact local-day, Shelf, profile, and routine-order snapshots instead of
 * recursively mounting the standalone hook graph twice.
 */
export function useRoutinePlanViewModel(): {
  planQuery: PlanQueryResult;
  cycleQuery: CycleQueryResult;
} {
  const { boundary, shelf } = useRoutineRouteSources();
  const profile = useMemo(
    () => ({
      data: shelf.data?.profile,
      isError: shelf.isError,
      isFetching: shelf.isFetching,
      isLoading: shelf.isLoading,
      isPending: shelf.isPending,
      isSuccess: shelf.isSuccess && shelf.data?.profile !== undefined,
    }),
    [
      shelf.data?.profile,
      shelf.isError,
      shelf.isFetching,
      shelf.isLoading,
      shelf.isPending,
      shelf.isSuccess,
    ],
  );
  const plan = usePlanFromSources(shelf, profile);
  const ramp = useRampFromPlan(plan, boundary);
  const cycle = useCycleFromSources(shelf, profile, ramp, boundary);

  return {
    planQuery: plan,
    cycleQuery: {
      ...cycle,
      retry: async () => {
        const results = await Promise.all<RetryResult>([
          ramp.isError ? ramp.retry() : Promise.resolve(),
          cycle.isError ? cycle.retry() : Promise.resolve(),
        ]);
        return { isError: anyRetryFailed(results) };
      },
    },
  };
}
