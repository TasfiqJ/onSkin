import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { STARTER_RULES } from '@/features/intelligence/rules';
import { orchestrate } from '@/features/scheduler/orchestrate';
import { cycleActiveSummaries } from '@/features/scheduler/projection';

import { generatePlan, type RoutineProduct } from './generate';

const runtime = globalThis as { __DEV__?: boolean };
let previousDev: boolean | undefined;

beforeAll(() => {
  previousDev = runtime.__DEV__;
  runtime.__DEV__ = true;
});

afterAll(() => {
  if (previousDev === undefined) delete runtime.__DEV__;
  else runtime.__DEV__ = previousDev;
});

describe('routine and canonical scheduler contract', () => {
  it('keeps every supported active aligned and unsupported cadence explicit', () => {
    const products: RoutineProduct[] = [
      { id: 'ret-b', name: 'Retinol B', tags: ['retinoid'] },
      { id: 'ret-a', name: 'Retinol A', tags: ['retinoid'] },
      { id: 'aha', name: 'Glycolic acid', tags: ['aha'] },
      { id: 'bha', name: 'Salicylic acid', tags: ['bha'] },
      { id: 'bp', name: 'Benzoyl peroxide', tags: ['benzoyl_peroxide'] },
      { id: 'hydro', name: 'Hydroquinone', tags: ['hydroquinone'] },
      { id: 'copper', name: 'Copper peptide', tags: ['copper_peptide'] },
      { id: 'moisturiser', name: 'Barrier cream', tags: ['barrier'] },
    ];
    const profile = { sensitivity: 'neutral' as const, pregnancy: false, goals: [] };
    const plan = generatePlan(products, profile, STARTER_RULES);
    const cycle = orchestrate(
      products.map((product) => ({
        id: product.id,
        name: product.name,
        tags: product.tags,
        category: product.category,
      })),
      profile,
      STARTER_RULES,
    ).cycle!;

    const planCycleIds = plan.pm
      .filter((step) => step.cadence === 'cycle')
      .map((step) => step.productId)
      .sort();
    const canonicalCycleIds = cycleActiveSummaries(cycle)
      .map((summary) => summary.productId)
      .sort();

    expect(canonicalCycleIds).toEqual(planCycleIds);
    expect(canonicalCycleIds).toEqual(['aha', 'bha', 'ret-a', 'ret-b']);
    expect(plan.am.some((step) => step.productId === 'bp')).toBe(true);
    expect(cycle.amDaily.some((item) => item.productId === 'bp')).toBe(true);
    expect(plan.cadenceWithheld.map((item) => item.productId)).toEqual(['copper', 'hydro']);
    expect(canonicalCycleIds).not.toContain('hydro');
    expect(canonicalCycleIds).not.toContain('copper');
  });
});
