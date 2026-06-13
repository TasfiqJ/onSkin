import type { EngineProfile } from '@/features/intelligence/engine';
import { STARTER_RULES } from '@/features/intelligence/rules';
import { useShelf } from '@/features/shelf/useShelf';

import { generatePlan, type GeneratedPlan, type RoutineProduct } from './generate';

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
const MAYA_PROFILE: EngineProfile & { goals: string[] } = {
  sensitivity: 'sensitive',
  pregnancy: false,
  goals: ['barrier_repair'],
};

export type PlanResult = { plan: GeneratedPlan; isExample: boolean };

export function usePlan(): { data: PlanResult | undefined; isLoading: boolean } {
  const shelf = useShelf();
  if (shelf.isLoading) return { data: undefined, isLoading: true };

  const items = shelf.data?.items ?? [];
  if (items.length > 0) {
    const products: RoutineProduct[] = items.map((i) => ({
      id: i.engineProduct.id,
      name: i.engineProduct.name,
      tags: i.engineProduct.tags,
    }));
    // Profile sensitivity is already baked into the shelf conflicts; re-derive a
    // minimal profile here (sensitive default keeps the gentle/ramp conservative).
    return { data: { plan: generatePlan(products, MAYA_PROFILE, STARTER_RULES), isExample: false }, isLoading: false };
  }
  return { data: { plan: generatePlan(MAYA_PRODUCTS, MAYA_PROFILE, STARTER_RULES), isExample: true }, isLoading: false };
}
