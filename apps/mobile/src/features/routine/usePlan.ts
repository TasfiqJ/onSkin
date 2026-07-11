import { useQuery } from '@tanstack/react-query';

import { shippableRules } from '@/features/intelligence/rules';
import { useProfileBits } from '@/features/scheduler/profile';
import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';
import { useShelf } from '@/features/shelf/useShelf';

import {
  generatePlan,
  type GeneratedPlan,
  type RoutineGenerationProfile,
  type RoutineProduct,
} from './generate';
import {
  applyRoutineOrderOverrides,
  loadRoutineOrderOverrides,
  ROUTINE_ORDER_QUERY_KEY,
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

export function usePlan(): { data: PlanResult | undefined; isLoading: boolean } {
  const shelf = useShelf();
  const profile = useProfileBits();
  const routineOrder = useQuery({
    queryKey: ROUTINE_ORDER_QUERY_KEY,
    queryFn: loadRoutineOrderOverrides,
    retry: 1,
    staleTime: Infinity,
  });
  if (shelf.isLoading || profile.isLoading || routineOrder.isLoading) {
    return { data: undefined, isLoading: true };
  }

  const orderOverrides = routineOrder.data ?? { schemaVersion: 1, am: [], pm: [] };

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
    const real: RoutineGenerationProfile = profile.data
      ? {
          sensitivity: profile.data.sensitivity,
          pregnancy: profile.data.pregnancy,
          pregnancySafety: profile.data.pregnancySafety,
          pregnancyStatus: profile.data.pregnancyStatus,
          goals: profile.data.goals,
        }
      : MAYA_PROFILE;
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
  };
}
