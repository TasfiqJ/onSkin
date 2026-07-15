import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { shippableRules } from '@/features/intelligence/rules';
import { useProfileBits } from '@/features/scheduler/profile';
import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';
import { useShelf } from '@/features/shelf/useShelf';
import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import { queryKeys, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import {
  generatePlan,
  type GeneratedPlan,
  type RoutineGenerationProfile,
  type RoutineProduct,
} from './generate';
import {
  applyRoutineOrderOverrides,
  loadRoutineOrderOverrides,
  type RoutineOrderOverrides,
} from './orderStore';

// The user's generated plan. Live from the shelf via the (tested) generatePlan
// pipeline; when the shelf is empty, falls back to the design's Maya example so
// the plan-built screen matches the handoff design out of the box (docs/03 §2 /
// design screen 01). Becomes fully live once products are on the shelf.

const MAYA_PRODUCTS: RoutineProduct[] = [
  { id: 'm-cleanser', name: 'Cream cleanser', tags: [] },
  { id: 'm-vitc', name: 'Vitamin C serum', tags: ['vitamin_c'] },
  { id: 'm-retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
  { id: 'm-glycolic', name: 'Glycolic 7% Toner', tags: ['aha'] },
  { id: 'm-cera', name: 'Ceramide moisturizer', tags: ['ceramide', 'barrier'] },
];
const MAYA_PROFILE: RoutineGenerationProfile = {
  sensitivity: 'sensitive',
  pregnancy: false,
  goals: ['barrier_repair'],
};

export type PlanResult = {
  plan: GeneratedPlan;
  canonicalPlan: GeneratedPlan;
  isExample: boolean;
  profileLabel: string;
  orderOverrides: RoutineOrderOverrides;
  orderPersistenceUnavailable: boolean;
  activeProductIds: string[];
};

export type PlanQueryResult = {
  data: PlanResult | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  retry: () => Promise<{ isError: boolean }>;
};

export type PlanShelfSource = Pick<
  ReturnType<typeof useShelf>,
  'data' | 'isError' | 'isFetching' | 'isPending' | 'isSuccess'
>;
export type PlanProfileSource = Pick<
  ReturnType<typeof useProfileBits>,
  'data' | 'isError' | 'isFetching' | 'isPending' | 'isSuccess'
>;

/**
 * Derive one plan observer from route-owned Shelf/profile snapshots. Routes that
 * already need those domains must pass the exact query results here instead of
 * recursively mounting duplicate TanStack observers through `usePlan()`.
 */
export function usePlanFromSources(
  shelf: PlanShelfSource,
  profile: PlanProfileSource,
): PlanQueryResult {
  const ownerScope = useOwnerQueryScope();
  const routineOrder = useQuery({
    queryKey: queryKeys.routineOrder(ownerScope),
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        lease.assertCurrent();
        const overrides = await awaitAccountGenerationLease(lease, () =>
          loadRoutineOrderOverrides(),
        );
        lease.assertCurrent();
        return overrides;
      }),
    networkMode: 'always',
    retry: 1,
    staleTime: Infinity,
  });

  const data = useMemo<PlanResult | undefined>(() => {
    if (
      !shelf.isSuccess ||
      !profile.isSuccess ||
      !routineOrder.isSuccess ||
      !shelf.data ||
      !profile.data ||
      !routineOrder.data
    ) {
      return undefined;
    }

    const orderOverrides = routineOrder.data;
    const items = shelf.data.items ?? [];
    if (items.length > 0) {
      const products: RoutineProduct[] = items.map((item) => ({
        id: item.engineProduct.id,
        name: item.engineProduct.name,
        tags: item.engineProduct.tags,
        category: item.category,
        concentration: item.engineProduct.concentration,
      }));
      const real: RoutineGenerationProfile = {
        sensitivity: profile.data.sensitivity,
        pregnancy: profile.data.pregnancy,
        pregnancySafety: profile.data.pregnancySafety,
        pregnancyStatus: profile.data.pregnancyStatus,
        goals: profile.data.goals,
      };
      const canonicalPlan = generatePlan(
        products,
        real,
        shippableRules(),
        shelf.data.conflictChoices,
      );
      return {
        plan: applyRoutineOrderOverrides(canonicalPlan, orderOverrides),
        canonicalPlan,
        isExample: false,
        profileLabel: routinePlanProfileLabel(profile.data, false),
        orderOverrides,
        orderPersistenceUnavailable: false,
        activeProductIds: items.map((item) => item.id),
      };
    }

    const canonicalPlan = generatePlan(MAYA_PRODUCTS, MAYA_PROFILE, shippableRules());
    return {
      plan: canonicalPlan,
      canonicalPlan,
      isExample: true,
      profileLabel: routinePlanProfileLabel(null, true),
      orderOverrides,
      orderPersistenceUnavailable: false,
      activeProductIds: [],
    };
  }, [
    shelf.isSuccess,
    shelf.data,
    profile.isSuccess,
    profile.data,
    routineOrder.isSuccess,
    routineOrder.data,
  ]);

  // The route owns shared Shelf/profile recovery. This hook retries only the
  // routine-order observer it mounted itself.
  async function retry(): Promise<{ isError: boolean }> {
    if (!routineOrder.isError) return { isError: false };
    const result = await routineOrder.refetch();
    return { isError: result.isError };
  }

  if (shelf.isPending || profile.isPending || routineOrder.isPending) {
    return {
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: shelf.isFetching || profile.isFetching || routineOrder.isFetching,
      isSuccess: false,
      retry,
    };
  }

  // A missing/empty Shelf is valid and may intentionally render the design
  // example. An unreadable Shelf, profile, or saved routine order is not absence
  // and must never seed Maya products or publish derived routine guidance.
  if (
    shelf.isError ||
    profile.isError ||
    routineOrder.isError ||
    !shelf.isSuccess ||
    !profile.isSuccess ||
    !routineOrder.isSuccess ||
    !data
  ) {
    return {
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: shelf.isFetching || profile.isFetching || routineOrder.isFetching,
      isSuccess: false,
      retry,
    };
  }

  return {
    data,
    isLoading: false,
    isError: false,
    isFetching: shelf.isFetching || profile.isFetching || routineOrder.isFetching,
    isSuccess: true,
    retry,
  };
}

/** Standalone plan consumer. Route view models should prefer `usePlanFromSources`. */
export function usePlan(): PlanQueryResult {
  const shelf = useShelf();
  const profile = useProfileBits();
  const plan = usePlanFromSources(shelf, profile);

  return {
    ...plan,
    retry: async () => {
      const results = await Promise.all([
        shelf.isError ? shelf.refetch() : Promise.resolve(),
        profile.isError ? profile.refetch() : Promise.resolve(),
        plan.retry(),
      ]);
      return {
        isError: results.some(
          (result) => result && typeof result === 'object' && 'isError' in result && result.isError,
        ),
      };
    },
  };
}
