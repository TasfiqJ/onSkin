import { useMemo } from 'react';

import { usePlanFromSources } from '@/features/routine/usePlan';
import { useRampFromPlan } from '@/features/routine/useRamp';
import { useCycleFromSources } from '@/features/scheduler/useCycle';

import type { ShelfRouteSources } from './ShelfRouteSources';

/**
 * One product-detail observer graph. Shelf already owns the exact profile
 * snapshot used for conflict derivation, so Plan and Cycle consume it directly
 * instead of rereading profile/Shelf state through standalone hooks.
 */
export function useShelfDetailViewModel({ boundary, shelf }: ShelfRouteSources) {
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
  const routineGuidanceError = plan.isError || ramp.isError || cycle.isError;
  const routineGuidanceLoading =
    !routineGuidanceError && (!plan.isSuccess || !ramp.isSuccess || !cycle.isSuccess);

  async function retryRoutineGuidance(): Promise<{ isError: boolean }> {
    const results = await Promise.all([
      plan.isError ? plan.retry() : Promise.resolve(),
      ramp.isError ? ramp.retry() : Promise.resolve(),
      cycle.isError ? cycle.retry() : Promise.resolve(),
    ]);
    return {
      isError: results.some(
        (result) => result && typeof result === 'object' && 'isError' in result && result.isError,
      ),
    };
  }

  return {
    cycle,
    plan,
    profile,
    ramp,
    retryRoutineGuidance,
    routineGuidanceError,
    routineGuidanceFetching: plan.isFetching || ramp.isFetching || cycle.isFetching,
    routineGuidanceLoading,
    shelf,
  };
}
