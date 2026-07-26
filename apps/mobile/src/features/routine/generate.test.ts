import { describe, expect, it } from 'vitest';

import type { EngineProfile } from '@/features/intelligence/engine';
import { tagsForIngredientList } from '@/features/intelligence/tags';

import { generatePlan, type RoutineProduct } from './generate';
import { applyTolerance, deEscalate, initRamp, shouldOfferStepUp } from './ramp';
import {
  classifyRole,
  instructionFor,
  phasesFor,
  routineCadenceDisposition,
  SEQUENCING_RULES,
  sequencePhase,
  shippableSequencingRules,
} from './sequencing';

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

    withDevFlag(true, () => {
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

  it('does not allocate a phase or expose instructions without reviewed sequencing', () => {
    const input = [product('cleanser', 'Cream cleanser')];

    withDevFlag(false, () => {
      expect(phasesFor('cleanser')).toEqual([]);
      expect(instructionFor('cleanser', 'stable')).toBeNull();
      expect(sequencePhase(input, 'am')).toEqual([]);
      expect(sequencePhase(input, 'pm')).toEqual([]);
      expect(sequencePhase(input, 'am', { cleanser: SEQUENCING_RULES.cleanser })).toEqual([]);
    });
  });

  it('uses only the reviewed role subset in production', () => {
    const reviewedCleanser = {
      ...SEQUENCING_RULES.cleanser,
      reviewedBy: 'B-DERM-REVIEW',
    };
    const rules = withDevFlag(false, () =>
      shippableSequencingRules({
        cleanser: reviewedCleanser,
        moisturiser: SEQUENCING_RULES.moisturiser,
      }),
    );
    const input = [
      product('cleanser', 'Cream cleanser'),
      product('moisturiser', 'Ceramide moisturiser'),
    ];

    expect(sequencePhase(input, 'am', rules).map((step) => step.productId)).toEqual(['cleanser']);
    expect(sequencePhase(input, 'am', rules)[0]?.instruction).toBe(reviewedCleanser.notes);
  });
});

describe('Maya plan generation (docs/03 §2 worked example)', () => {
  const plan = withDevFlag(true, () => generatePlan(maya, mayaProfile));

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

  it('withholds compatibility guidance until the exact corpus is admitted', () => {
    expect(plan.conflicts).toEqual([]);
    expect(plan.conflictCoverageStatus).toBe('unsupported_unreviewed');
    expect(plan.unsupportedConflictPairs).toContain('aha|retinoid@routine@unknown');
  });

  it('does not invent a choice prompt when coverage is still under review', () => {
    expect(plan.conflicts).toEqual([]);
    expect(plan.am.map((step) => step.productId)).toEqual(['cleanser', 'vitc', 'cera', 'spf']);
    expect(plan.pm.map((step) => step.productId)).toEqual([
      'cleanser',
      'retinol',
      'glycolic',
      'cera',
    ]);
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
      ),
    );

    expect(plan.am.map((s) => s.name)).toEqual(['Mineral SPF50']);
    expect(plan.pm.map((s) => s.name)).toEqual([
      'Granactive Retinoid 2% Emulsion',
      'Glycolic 7% Toner',
    ]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.conflictCoverageStatus).toBe('unsupported_unreviewed');
    expect(plan.unsupportedConflictPairs).toContain('aha|retinoid@routine@unknown');
  });

  it('does not fabricate a night cycle for a sparse daytime-only shelf', () => {
    const plan = withDevFlag(true, () =>
      generatePlan([shelfNameProduct('s', 'Mineral SPF 50')], {
        sensitivity: 'neutral',
        pregnancy: false,
        goals: [],
      }),
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
      expect(plan.pm).toEqual([]);
      expect(plan.cadenceWithheld.map((item) => item.productId)).toEqual([
        'bha',
        'hydroquinone',
        'retinoid',
      ]);
      expect(plan.sequencingWithheld.map((item) => item.productId)).toEqual(['moisturiser']);
    });
  });

  it('does not turn candidate safety rows into production exclusions', () => {
    withDevFlag(false, () => {
      const plan = generatePlan(safetyShelf, {
        sensitivity: 'neutral',
        pregnancy: true,
        pregnancySafety: 'caution',
        pregnancyStatus: 'pregnant',
        goals: [],
      });

      expect(plan.pm).toEqual([]);
      expect(plan.ramp).toEqual([]);
      expect(plan.cycle).toBeNull();
      expect(plan.safetyExclusions).toEqual([]);
      expect(plan.conflicts).toEqual([]);
      expect(plan.conflictCoverageStatus).toBe('unsupported_unreviewed');
      expect(plan.sequencingWithheld.map((item) => item.productId)).toEqual(['moisturiser']);
    });
  });

  it('does not borrow pregnancy exclusions for an unknown status', () => {
    const plan = withDevFlag(true, () =>
      generatePlan(safetyShelf, {
        sensitivity: 'neutral',
        pregnancy: false,
        pregnancySafety: 'caution',
        pregnancyStatus: 'unknown',
        goals: [],
      }),
    );

    expect(plan.pm.map((step) => step.productId)).toEqual(['retinoid', 'bha', 'moisturiser']);
    expect(plan.safetyExclusions).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.conflictCoverageStatus).toBe('unsupported_unreviewed');
  });

  it('keeps confirmed-low BHA eligible and reintroduces products after explicit none', () => {
    const lowBha = {
      ...shelfNameProduct('bha', 'Salicylic 0.5% serum'),
      concentration: 'low' as const,
    };
    const cautious = withDevFlag(true, () =>
      generatePlan([lowBha], {
        sensitivity: 'neutral',
        pregnancy: false,
        pregnancySafety: 'caution',
        pregnancyStatus: 'prefer_not',
        goals: [],
      }),
    );
    const clear = withDevFlag(true, () =>
      generatePlan(safetyShelf, {
        sensitivity: 'neutral',
        pregnancy: false,
        pregnancySafety: 'clear',
        pregnancyStatus: 'none',
        goals: [],
      }),
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
    const plan = withDevFlag(true, () => generatePlan([{ id, name, tags: [tag] }], profile));

    expect(plan.am).toEqual([]);
    expect(plan.pm).toEqual([]);
    expect(plan.cadenceWithheld).toEqual([{ productId: id, name }]);
    expect(plan.ramp).toEqual([]);
    expect(plan.cycle).toBeNull();
  });

  it('keeps a BP-only shelf in AM without creating a cycle or ramp', () => {
    const plan = withDevFlag(true, () =>
      generatePlan([{ id: 'bp', name: 'Benzoyl peroxide', tags: ['benzoyl_peroxide'] }], profile),
    );

    expect(plan.am.map((step) => step.productId)).toEqual(['bp']);
    expect(plan.pm).toEqual([]);
    expect(plan.cadenceWithheld).toEqual([]);
    expect(plan.ramp).toEqual([]);
    expect(plan.cycle).toBeNull();
  });
});

describe('B-DERM-REVIEW routine launch gate', () => {
  const launchProfile: EngineProfile & { goals: string[] } = {
    sensitivity: 'sensitive',
    pregnancy: false,
    goals: [],
  };
  const launchShelf = [
    shelfNameProduct('retinoid', 'Retinol 0.3% Night Serum'),
    shelfNameProduct('acid', 'Glycolic 7% Toner'),
  ];

  it('keeps classifiable stable products on the shelf but withholds routine placement and instructions', () => {
    withDevFlag(false, () => {
      const plan = generatePlan(
        [
          product('cleanser', 'Cream cleanser'),
          product('moisturiser', 'Ceramide moisturiser'),
          product('spf', 'Mineral SPF', ['Zinc Oxide']),
        ],
        launchProfile,
      );

      expect(plan.am).toEqual([]);
      expect(plan.pm).toEqual([]);
      expect(plan.sequencingWithheld).toEqual([
        {
          productId: 'cleanser',
          name: 'Cream cleanser',
          role: 'cleanser',
          placement: 'withheld',
          reason: 'review_required',
        },
        {
          productId: 'moisturiser',
          name: 'Ceramide moisturiser',
          role: 'moisturiser',
          placement: 'withheld',
          reason: 'review_required',
        },
        {
          productId: 'spf',
          name: 'Mineral SPF',
          role: 'spf',
          placement: 'withheld',
          reason: 'review_required',
        },
      ]);
      expect(plan.sequencingWithheld.every((item) => item.placement === 'withheld')).toBe(true);
    });
  });

  it('auto-places only products whose role rule carries production review', () => {
    const reviewedCleanser = {
      ...SEQUENCING_RULES.cleanser,
      reviewedBy: 'B-DERM-REVIEW',
    };

    withDevFlag(false, () => {
      const reviewedRules = shippableSequencingRules({
        cleanser: reviewedCleanser,
        moisturiser: SEQUENCING_RULES.moisturiser,
      });
      const plan = generatePlan(
        [product('cleanser', 'Cream cleanser'), product('moisturiser', 'Ceramide moisturiser')],
        launchProfile,
        {},
        reviewedRules,
      );

      expect(plan.am.map((step) => step.productId)).toEqual(['cleanser']);
      expect(plan.pm.map((step) => step.productId)).toEqual(['cleanser']);
      expect(plan.am[0]?.instruction).toBe(reviewedCleanser.notes);
      expect(plan.sequencingWithheld).toEqual([
        {
          productId: 'moisturiser',
          name: 'Ceramide moisturiser',
          role: 'moisturiser',
          placement: 'withheld',
          reason: 'review_required',
        },
      ]);
    });
  });

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
    expect(applyTolerance(s, 'irritated')).toEqual(s);
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
