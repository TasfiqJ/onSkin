import { useQuery } from '@tanstack/react-query';

import { shippableRules } from '@/features/intelligence/rules';
import { useProfileBits } from '@/features/scheduler/profile';
import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';
import { useShelf } from '@/features/shelf/useShelf';
import { queryKeys } from '@/lib/query/queryKeys';
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
  retry: () => Promise<void>;
};

export function usePlan(): PlanQueryResult {
  const shelf = useShelf();
  const profile = useProfileBits();
  const ownerScope = useOwnerQueryScope();
  const routineOrder = useQuery({
    queryKey: queryKeys.routineOrder(ownerScope),
    queryFn: loadRoutineOrderOverrides,
    networkMode: 'always',
    retry: 1,
    staleTime: Infinity,
  });

  async function retry(): Promise<void> {
    await Promise.all([
      shelf.isError ? shelf.refetch() : Promise.resolve(),
      profile.isError ? profile.refetch() : Promise.resolve(),
      routineOrder.isError ? routineOrder.refetch() : Promise.resolve(),
    ]);
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
    !shelf.data ||
    !profile.data ||
    !routineOrder.data
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

  const orderOverrides = routineOrder.data;

  const items = shelf.data?.items ?? [];
  if (items.length > 0) {
    const products: RoutineProduct[] = items.map((i) => ({
      id: i.engineProduct.id,
      name: i.engineProduct.name,
      tags: i.engineProduct.tags,
      category: i.category,
      concentration: i.engineProduct.concentration,
    }));
    // Use the REAL profile (sensitivity + pregnancy + goals) so the plan honours
    // pregnancy retinoid suppression etc. everywhere, not just the cycle engine.
    const real: RoutineGenerationProfile = {
      sensitivity: profile.data.sensitivity,
      pregnancy: profile.data.pregnancy,
      pregnancySafety: profile.data.pregnancySafety,
      pregnancyStatus: profile.data.pregnancyStatus,
      goals: profile.data.goals,
    };
    // Use the launch-gated rule set (docs/02 §9 B-DERM-REVIEW), consistent with
    // useShelf/recommendations. In production the conflict layer stays inert until
    // clinical sign-off; in dev the full starter matrix drives the plan.
    const canonicalPlan = generatePlan(
      products,
      real,
      shippableRules(),
      shelf.data?.conflictChoices,
    );
    return {
      data: {
        plan: applyRoutineOrderOverrides(canonicalPlan, orderOverrides),
        canonicalPlan,
        isExample: false,
        profileLabel: routinePlanProfileLabel(profile.data ?? null, false),
        orderOverrides,
        orderPersistenceUnavailable: routineOrder.isError,
        activeProductIds: items.map((item) => item.id),
      },
      isLoading: false,
      isError: false,
      isFetching: shelf.isFetching || profile.isFetching || routineOrder.isFetching,
      isSuccess: true,
      retry,
    };
  }
  const canonicalPlan = generatePlan(MAYA_PRODUCTS, MAYA_PROFILE, shippableRules());
  return {
    data: {
      plan: canonicalPlan,
      canonicalPlan,
      isExample: true,
      profileLabel: routinePlanProfileLabel(null, true),
      orderOverrides,
      orderPersistenceUnavailable: routineOrder.isError,
      activeProductIds: [],
    },
    isLoading: false,
    isError: false,
    isFetching: shelf.isFetching || profile.isFetching || routineOrder.isFetching,
    isSuccess: true,
    retry,
  };
}
