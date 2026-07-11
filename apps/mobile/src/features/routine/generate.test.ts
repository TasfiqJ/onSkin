import { describe, expect, it } from 'vitest';

import type { DetectedConflict, EngineProfile } from '@/features/intelligence/engine';
import type { ConflictChoices } from '@/features/intelligence/conflictChoices';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import { STARTER_RULES, shippableRules } from '@/features/intelligence/rules';
import { tagsForIngredientList } from '@/features/intelligence/tags';

import { generatePlan, type RoutineProduct } from './generate';
import { applyTolerance, deEscalate, initRamp, shouldOfferStepUp } from './ramp';
import { classifyRole, routineCadenceDisposition, sequencePhase } from './sequencing';

function product(
  id: string,
  name: string,
  ingredients: string[] = [],
  category: string | null = null,
): RoutineProduct {
  const { tags } = tagsForIngredientList(ingredients);
  return { id, name, tags: [...tags], category };
}

function shelfNameProduct(
  id: string,
  name: string,
  ingredients: string[] = [],
  category: string | null = null,
): RoutineProduct {
  const { tags } = tagsForIngredientList([name, ...ingredients]);
  return { id, name, tags: [...tags], category };
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

function choicesForConflict(
  conflict: DetectedConflict,
  choice: 'accept_suggested_timing' | 'use_together',
): ConflictChoices {
  const productIds = [conflict.productAId!, conflict.productBId!].sort() as [string, string];
  return {
    [conflictKey(conflict)]: {
      choice,
      ruleId: conflict.rule.id,
      ruleVersion: conflict.rule.ruleVersion,
      productIds,
    },
  };
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
  it('uses explicit intake category before guessing from unknown names', () => {
    expect(classifyRole(product('g', 'Night bottle', [], 'retinoid_serum'))).toBe('treatment');
    expect(classifyRole(product('h', 'Plain bottle', [], 'serum'))).toBe('hydrating_serum');
  });
  it('does not invent a hydrating-serum role for unknown products', () => {
    expect(classifyRole(product('i', 'Mystery drops'))).toBeNull();
    expect(classifyRole(product('j', 'Mystery drops', [], 'other'))).toBeNull();
  });

  it('assigns cadence only to product families with a documented placement', () => {
    expect(routineCadenceDisposition({ id: 'r', name: 'Retinol', tags: ['retinoid'] })).toBe(
      'cycle',
    );
    expect(routineCadenceDisposition({ id: 'a', name: 'AHA', tags: ['aha'] })).toBe('cycle');
    expect(routineCadenceDisposition({ id: 'bp', name: 'BP', tags: ['benzoyl_peroxide'] })).toBe(
      'daily_am',
    );
    expect(
      routineCadenceDisposition({ id: 'h', name: 'Hydroquinone', tags: ['hydroquinone'] }),
    ).toBe('withheld');
    expect(
      routineCadenceDisposition({ id: 'c', name: 'Copper peptide', tags: ['copper_peptide'] }),
    ).toBe('withheld');
  });

  it('places benzoyl peroxide in AM with product-label guidance', () => {
    const bp = { id: 'bp', name: 'Benzoyl peroxide', tags: ['benzoyl_peroxide'] as const };
    const input = [{ ...bp, tags: [...bp.tags] }];

    expect(sequencePhase(input, 'am')).toMatchObject([
      {
        productId: 'bp',
        cadence: 'daily_am',
        instruction: 'Use in the morning. Follow the product label directions.',
      },
    ]);
    expect(sequencePhase(input, 'pm')).toEqual([]);
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

  it('marks exfoliants and retinoids for the canonical cycle projection', () => {
    expect(plan.pm.find((s) => s.role === 'exfoliant')?.cadence).toBe('cycle');
    expect(plan.pm.find((s) => s.role === 'treatment')?.cadence).toBe('cycle');
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

  it('removes a decided ordinary conflict from repeated Plan prompts without changing phases', () => {
    const conflict = plan.conflicts.find(
      (item) => item.rule.resolutionType === 'alternate_nights',
    )!;

    for (const choice of ['accept_suggested_timing', 'use_together'] as const) {
      const decided = withDevFlag(true, () =>
        generatePlan(maya, mayaProfile, STARTER_RULES, choicesForConflict(conflict, choice)),
      );
      expect(decided.conflicts.some((item) => conflictKey(item) === conflictKey(conflict))).toBe(
        false,
      );
      expect(decided.am.map((step) => step.productId)).toEqual(
        plan.am.map((step) => step.productId),
      );
      expect(decided.pm.map((step) => step.productId)).toEqual(
        plan.pm.map((step) => step.productId),
      );
    }
  });

  it('shows no gap notes (Maya owns cleanser, moisturiser, SPF)', () => {
    expect(plan.gaps).toEqual([]);
  });

  it('has no unplaced products when the shelf is classifiable', () => {
    expect(plan.unplacedProducts).toEqual([]);
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

  it('leaves unclassified products out of AM/PM rows and records why', () => {
    const plan = generatePlan([product('unknown', 'Mystery drops')], {
      sensitivity: 'neutral',
      pregnancy: false,
      goals: [],
    });

    expect(plan.am).toEqual([]);
    expect(plan.pm).toEqual([]);
    expect(plan.unplacedProducts).toEqual([{ productId: 'unknown', name: 'Mystery drops' }]);
  });
});

describe('front-label shelf names', () => {
  it('routes common manually entered actives into the right routine phases', () => {
    const plan = withDevFlag(true, () =>
      generatePlan(
        [
          shelfNameProduct('r', 'Granactive Retinoid 2% Emulsion'),
          shelfNameProduct('g', 'Glycolic 7% Toner'),
          shelfNameProduct('s', 'Mineral SPF50'),
        ],
        { sensitivity: 'neutral', pregnancy: false, goals: [] },
        STARTER_RULES,
      ),
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

describe('pregnancy safety exclusions', () => {
  const safetyShelf = [
    shelfNameProduct('retinoid', 'Retinol 0.3% Night Serum'),
    { ...shelfNameProduct('bha', 'Salicylic serum'), concentration: undefined },
    shelfNameProduct('hydroquinone', 'Hydroquinone cream'),
    shelfNameProduct('moisturiser', 'Ceramide moisturiser'),
  ];
  const reviewedSafetyRules = STARTER_RULES.filter((rule) => rule.interactionType === 'safety').map(
    (rule) => ({ ...rule, reviewedBy: 'B-DERM-REVIEW' }),
  );

  it('withholds unreviewed active cadence without surfacing unreviewed safety guidance', () => {
    withDevFlag(false, () => {
      const plan = generatePlan(safetyShelf, {
        sensitivity: 'neutral',
        pregnancy: true,
        pregnancySafety: 'caution',
        pregnancyStatus: 'pregnant',
        goals: [],
      });

      expect(plan.safetyExclusions).toEqual([]);
      expect(plan.pm.map((step) => step.productId)).toEqual(['moisturiser']);
      expect(plan.cadenceWithheld.map((item) => item.productId)).toEqual([
        'bha',
        'hydroquinone',
        'retinoid',
      ]);
    });
  });

  it('removes reviewed caution products before PM sequencing and ramp creation in production', () => {
    withDevFlag(false, () => {
      const plan = generatePlan(
        safetyShelf,
        {
          sensitivity: 'neutral',
          pregnancy: true,
          pregnancySafety: 'caution',
          pregnancyStatus: 'pregnant',
          goals: [],
        },
        shippableRules(reviewedSafetyRules),
      );

      expect(plan.pm.map((step) => step.productId)).toEqual(['moisturiser']);
      expect(plan.ramp).toEqual([]);
      expect(plan.cycle).toBeNull();
      expect(plan.safetyExclusions.map((item) => item.productId)).toEqual([
        'retinoid',
        'bha',
        'hydroquinone',
      ]);
      expect(
        plan.conflicts.filter((conflict) => conflict.rule.interactionType === 'safety'),
      ).toHaveLength(2);
    });
  });

  it('uses the same cautious plan without falsely asserting pregnancy for unknown status', () => {
    const plan = generatePlan(
      safetyShelf,
      {
        sensitivity: 'neutral',
        pregnancy: false,
        pregnancySafety: 'caution',
        pregnancyStatus: 'unknown',
        goals: [],
      },
      STARTER_RULES,
    );

    expect(plan.pm.map((step) => step.productId)).toEqual(['moisturiser']);
    expect(plan.safetyExclusions).toHaveLength(3);
    expect(plan.conflicts.filter((conflict) => conflict.rule.interactionType === 'safety')).toEqual(
      [],
    );
  });

  it('keeps confirmed-low BHA eligible and reintroduces products after explicit none', () => {
    const lowBha = {
      ...shelfNameProduct('bha', 'Salicylic 0.5% serum'),
      concentration: 'low' as const,
    };
    const cautious = withDevFlag(true, () =>
      generatePlan(
        [lowBha],
        {
          sensitivity: 'neutral',
          pregnancy: false,
          pregnancySafety: 'caution',
          pregnancyStatus: 'prefer_not',
          goals: [],
        },
        STARTER_RULES,
      ),
    );
    const clear = withDevFlag(true, () =>
      generatePlan(
        safetyShelf,
        {
          sensitivity: 'neutral',
          pregnancy: false,
          pregnancySafety: 'clear',
          pregnancyStatus: 'none',
          goals: [],
        },
        STARTER_RULES,
      ),
    );

    expect(cautious.pm.map((step) => step.productId)).toEqual(['bha']);
    expect(cautious.safetyExclusions).toEqual([]);
    expect(clear.pm.map((step) => step.productId)).toEqual(['retinoid', 'bha', 'moisturiser']);
    expect(clear.cadenceWithheld.map((item) => item.productId)).toEqual(['hydroquinone']);
    expect(clear.safetyExclusions).toEqual([]);
  });
});

describe('clear-mode multi-treatment placement', () => {
  const profile = { sensitivity: 'neutral' as const, pregnancy: false, goals: [] };

  it('cycles only AHA/BHA/retinoids, puts BP in AM, and withholds undefined cadences', () => {
    const plan = withDevFlag(true, () =>
      generatePlan(
        [
          { id: 'retinoid', name: 'Retinol', tags: ['retinoid'] },
          { id: 'aha', name: 'Glycolic acid', tags: ['aha'] },
          { id: 'bha', name: 'Salicylic acid', tags: ['bha'] },
          { id: 'bp', name: 'Benzoyl peroxide', tags: ['benzoyl_peroxide'] },
          { id: 'hydro', name: 'Hydroquinone', tags: ['hydroquinone'] },
          { id: 'copper', name: 'Copper peptide', tags: ['copper_peptide'] },
        ],
        profile,
        STARTER_RULES,
      ),
    );

    expect(plan.am.map((step) => step.productId)).toEqual(['bp']);
    expect(plan.pm.map((step) => step.productId)).toEqual(['retinoid', 'aha', 'bha']);
    expect(plan.pm.every((step) => step.cadence === 'cycle')).toBe(true);
    expect(plan.cadenceWithheld.map((item) => item.productId)).toEqual(['copper', 'hydro']);
    expect(plan.ramp.map((item) => item.productId)).toEqual(['retinoid', 'aha', 'bha']);
    expect(plan.cycle).not.toBeNull();
  });

  it.each([
    ['hydroquinone', 'Hydroquinone', 'hydroquinone'],
    ['copper', 'Copper peptide', 'copper_peptide'],
  ] as const)('withholds %s instead of inventing a retinoid ramp', (id, name, tag) => {
    const plan = withDevFlag(true, () =>
      generatePlan([{ id, name, tags: [tag] }], profile, STARTER_RULES),
    );

    expect(plan.am).toEqual([]);
    expect(plan.pm).toEqual([]);
    expect(plan.cadenceWithheld).toEqual([{ productId: id, name }]);
    expect(plan.ramp).toEqual([]);
    expect(plan.cycle).toBeNull();
  });

  it('keeps a BP-only shelf in AM without creating a cycle or ramp', () => {
    const plan = withDevFlag(true, () =>
      generatePlan(
        [{ id: 'bp', name: 'Benzoyl peroxide', tags: ['benzoyl_peroxide'] }],
        profile,
        STARTER_RULES,
      ),
    );

    expect(plan.am.map((step) => step.productId)).toEqual(['bp']);
    expect(plan.pm).toEqual([]);
    expect(plan.cadenceWithheld).toEqual([]);
    expect(plan.ramp).toEqual([]);
    expect(plan.cycle).toBeNull();
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

      expect(plan.pm).toEqual([]);
      expect(plan.cadenceWithheld.map((item) => item.name)).toEqual([
        'Glycolic 7% Toner',
        'Retinol 0.3% Night Serum',
      ]);
      expect(plan.cycle).toBeNull();
      expect(plan.ramp).toEqual([]);
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
      expect(plan.pm).toEqual([]);
      expect(plan.cadenceWithheld).toHaveLength(2);
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
