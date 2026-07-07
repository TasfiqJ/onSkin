import { describe, expect, it } from 'vitest';

import type { EngineProfile } from '@/features/intelligence/engine';
import { STARTER_RULES, shippableRules } from '@/features/intelligence/rules';
import { tagsForIngredientList } from '@/features/intelligence/tags';

import { generatePlan, type RoutineProduct } from './generate';
import { applyTolerance, deEscalate, initRamp, shouldOfferStepUp } from './ramp';
import { classifyRole } from './sequencing';

function product(id: string, name: string, ingredients: string[] = []): RoutineProduct {
  const { tags } = tagsForIngredientList(ingredients);
  return { id, name, tags: [...tags] };
}

function shelfNameProduct(id: string, name: string, ingredients: string[] = []): RoutineProduct {
  const { tags } = tagsForIngredientList([name, ...ingredients]);
  return { id, name, tags: [...tags] };
}

function withDevFlag<T>(value: boolean, run: () => T): T {
  const runtime = globalThis as { __DEV__?: boolean };
  const previous = runtime.__DEV__;
  runtime.__DEV__ = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = previous;
  }
}

// Maya's shelf (docs/03 §2 worked example) + a cleanser (spec AM shows one).
const maya: RoutineProduct[] = [
  product('cleanser', 'Cream cleanser'),
  product('vitc', 'Vitamin C serum', ['Ascorbic Acid']),
  product('retinol', 'Retinol 0.3% Night Serum', ['Retinol']),
  product('glycolic', 'Glycolic 7% Toner', ['Glycolic Acid']),
  product('cera', 'Ceramide moisturizer', ['Ceramide NP']),
  product('spf', 'Mineral SPF 50', ['Zinc Oxide']),
];
const mayaProfile: EngineProfile & { goals: string[] } = {
  sensitivity: 'sensitive',
  pregnancy: false,
  goals: ['barrier_repair'],
};

describe('role classification (docs/03 §3). Tags win over name keywords', () => {
  it('classifies actives by tag', () => {
    expect(classifyRole(product('a', 'Retinol 0.3%', ['Retinol']))).toBe('treatment');
    expect(classifyRole(product('b', 'Glycolic 7% Toner', ['Glycolic Acid']))).toBe('exfoliant'); // not "toner"
    expect(classifyRole(product('c', 'Vitamin C serum', ['Ascorbic Acid']))).toBe('antioxidant');
    expect(classifyRole(product('d', 'Mineral SPF 50', ['Zinc Oxide']))).toBe('spf');
  });
  it('falls back to name keywords for non-actives', () => {
    expect(classifyRole(product('e', 'Cream cleanser'))).toBe('cleanser');
    expect(classifyRole(product('f', 'Ceramide moisturizer', ['Ceramide NP']))).toBe('moisturiser');
  });
});

describe('Maya plan generation (docs/03 §2 worked example)', () => {
  const plan = withDevFlag(true, () => generatePlan(maya, mayaProfile, STARTER_RULES));

  it('AM is sequenced thin→thick: cleanser → vitamin C → moisturiser → SPF', () => {
    expect(plan.am.map((s) => s.name)).toEqual([
      'Cream cleanser',
      'Vitamin C serum',
      'Ceramide moisturizer',
      'Mineral SPF 50',
    ]);
  });

  it('retinoid and SPF are correctly phase-allocated', () => {
    expect(plan.am.find((s) => s.role === 'treatment')).toBeUndefined(); // retinoid not in AM
    expect(plan.am.find((s) => s.role === 'spf')).toBeDefined();
    expect(plan.pm.find((s) => s.role === 'spf')).toBeUndefined(); // SPF not in PM
  });

  it('assigns cycling nights: exfoliant=1, retinoid=2', () => {
    expect(plan.pm.find((s) => s.role === 'exfoliant')?.cyclingNight).toBe(1);
    expect(plan.pm.find((s) => s.role === 'treatment')?.cyclingNight).toBe(2);
  });

  it('picks the gentle cycle for sensitive skin', () => {
    expect(plan.cycle?.id).toBe('gentle_5');
  });

  it('initialises the retinoid ramp at 2 nights/week (the reveal default)', () => {
    const retRamp = plan.ramp.find((r) => r.name.includes('Retinol'));
    expect(retRamp?.state.freqPerWeek).toBe(2);
    expect(retRamp?.state.targetPerWeek).toBe(3);
  });

  it('surfaces the retinoid × glycolic conflict (resolved alternate_nights)', () => {
    const c = plan.conflicts.find(
      (x) =>
        (x.rule.tagA === 'retinoid' && x.rule.tagB === 'aha') ||
        (x.rule.tagA === 'aha' && x.rule.tagB === 'retinoid'),
    );
    expect(c?.rule.resolutionType).toBe('alternate_nights');
    expect(c?.computedSeverity).toBe('moderate'); // sensitive bumps mild→moderate
  });

  it('shows no gap notes (Maya owns cleanser, moisturiser, SPF)', () => {
    expect(plan.gaps).toEqual([]);
  });
});

describe('gap notes (docs/03 §2. Never fabricate a product)', () => {
  it('notes a missing SPF', () => {
    const plan = generatePlan([product('r', 'Retinol', ['Retinol'])], {
      sensitivity: 'neutral',
      pregnancy: false,
      goals: [],
    });
    expect(plan.gaps.some((g) => g.toLowerCase().includes('spf'))).toBe(true);
  });
});

describe('front-label shelf names', () => {
  it('routes common manually entered actives into the right routine phases', () => {
    const plan = generatePlan(
      [
        shelfNameProduct('r', 'Granactive Retinoid 2% Emulsion'),
        shelfNameProduct('g', 'Glycolic 7% Toner'),
        shelfNameProduct('s', 'Mineral SPF50'),
      ],
      { sensitivity: 'neutral', pregnancy: false, goals: [] },
      STARTER_RULES,
    );

    expect(plan.am.map((s) => s.name)).toEqual(['Mineral SPF50']);
    expect(plan.pm.map((s) => s.name)).toEqual([
      'Granactive Retinoid 2% Emulsion',
      'Glycolic 7% Toner',
    ]);
    expect(plan.conflicts.some((c) => c.rule.tagA === 'retinoid' && c.rule.tagB === 'aha')).toBe(
      true,
    );
  });

  it('does not fabricate a night cycle for a sparse daytime-only shelf', () => {
    const plan = generatePlan(
      [shelfNameProduct('s', 'Mineral SPF 50')],
      { sensitivity: 'neutral', pregnancy: false, goals: [] },
      STARTER_RULES,
    );

    expect(plan.am.map((s) => s.name)).toEqual(['Mineral SPF 50']);
    expect(plan.pm).toEqual([]);
    expect(plan.cycle).toBeNull();
    expect(plan.ramp).toEqual([]);
  });
});

describe('B-DERM-REVIEW routine launch gate', () => {
  const retinoidAhaRule = STARTER_RULES.find((r) => r.tagA === 'retinoid' && r.tagB === 'aha')!;
  const launchProfile: EngineProfile & { goals: string[] } = {
    sensitivity: 'sensitive',
    pregnancy: false,
    goals: [],
  };
  const launchShelf = [
    shelfNameProduct('retinoid', 'Retinol 0.3% Night Serum'),
    shelfNameProduct('acid', 'Glycolic 7% Toner'),
  ];

  it('does not surface unreviewed conflict guidance through the default production generator', () => {
    withDevFlag(false, () => {
      const plan = generatePlan(launchShelf, launchProfile);

      expect(plan.pm.map((s) => s.name)).toEqual(['Retinol 0.3% Night Serum', 'Glycolic 7% Toner']);
      expect(plan.cycle).toBeNull();
      expect(plan.ramp).toEqual([]);
      expect(plan.pm.every((s) => s.cyclingNight == null)).toBe(true);
      expect(plan.conflicts).toEqual([]);
    });
  });

  it('surfaces reviewed conflict guidance when production rules are reviewed', () => {
    const reviewedRetinoidAhaRule = { ...retinoidAhaRule, reviewedBy: 'B-DERM-REVIEW' };

    withDevFlag(false, () => {
      const plan = generatePlan(
        launchShelf,
        launchProfile,
        shippableRules([reviewedRetinoidAhaRule]),
      );

      expect(plan.conflicts).toHaveLength(1);
      expect(plan.conflicts[0]?.rule.id).toBe(retinoidAhaRule.id);
      expect(plan.conflicts[0]?.rule.reviewedBy).toBe('B-DERM-REVIEW');
    });
  });
});

describe('retinoid ramp (docs/03 §4)', () => {
  it('starts gentler for sensitive than resistant', () => {
    expect(initRamp('retinoid', 'sensitive').freqPerWeek).toBe(2);
    expect(initRamp('retinoid', 'resistant').freqPerWeek).toBe(3);
  });
  it('offers a step-up only after ~21 days, below target, not irritated', () => {
    const base = {
      startedAt: '2026-06-01',
      lastStepUp: null,
      freqPerWeek: 2,
      targetPerWeek: 3,
      toleranceState: 'building' as const,
    };
    expect(shouldOfferStepUp({ ...base, today: '2026-06-10' })).toBe(false); // too soon
    expect(shouldOfferStepUp({ ...base, today: '2026-06-25' })).toBe(true); // 24 days
    expect(
      shouldOfferStepUp({ ...base, today: '2026-06-25', toleranceState: 'paused_irritation' }),
    ).toBe(false);
    expect(shouldOfferStepUp({ ...base, today: '2026-06-25', freqPerWeek: 3 })).toBe(false); // at target
  });
  it('de-escalates on irritation', () => {
    const s = applyTolerance(
      { freqPerWeek: 3, targetPerWeek: 4, toleranceState: 'building' },
      'irritated',
    );
    expect(s.freqPerWeek).toBe(2);
    expect(s.toleranceState).toBe('paused_irritation');
  });
  it('comfortable → steady; a bit dry → hold', () => {
    expect(applyTolerance(initRamp('retinoid', 'sensitive'), 'comfortable').toleranceState).toBe(
      'steady',
    );
    expect(applyTolerance(initRamp('retinoid', 'sensitive'), 'a_bit_dry').toleranceState).toBe(
      'building',
    );
    void deEscalate; // referenced for coverage
  });
});
