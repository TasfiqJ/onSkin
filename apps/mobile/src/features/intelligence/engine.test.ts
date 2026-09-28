import { describe, expect, it } from 'vitest';

import {
  previewDetectConflicts,
  evaluateExactApplicabilityForReview,
  evaluateConflicts,
  evaluateReviewedSeverityForApplicability,
  findRule,
  findRules,
  isReassuring,
  matchesExactApplicabilityForReview,
  type EngineProduct,
  type EngineProfile,
} from './engine';
import {
  STARTER_RULES,
  type ConflictConstraint,
  type ConflictParticipantApplicability,
} from './rules';
import { tagsForIngredientList } from './tags';

// Fixture tests for the conflict engine. Docs/02 §10: "every rule has a fixture
// test ... non-negotiable for a liability surface." These assert (tagged products
// + profile) -> (interaction type, computed severity, resolution).

function product(
  id: string,
  name: string,
  ingredients: string[],
  concentration?: 'low' | 'high',
): EngineProduct {
  const { tags, subflags } = tagsForIngredientList(ingredients);
  const moleculeIds = ingredients.flatMap((ingredient) => {
    const normalized = ingredient.toLowerCase();
    if (normalized.includes('tretinoin')) return ['tretinoin'];
    if (normalized.includes('retinol')) return ['retinol'];
    if (normalized.includes('adapalene')) return ['adapalene'];
    return [];
  });
  return {
    id,
    name,
    tags: [...tags],
    subflags: [...subflags],
    moleculeIds,
    concentration,
  };
}

const sensitive: EngineProfile = { sensitivity: 'sensitive', pregnancy: false };
const resistant: EngineProfile = { sensitivity: 'resistant', pregnancy: false };
const neutral: EngineProfile = { sensitivity: 'neutral', pregnancy: false };
const pregnant: EngineProfile = { sensitivity: 'neutral', pregnancy: true };

describe('the Maya worked example (docs/02 §4.2/§4.4/§7.3)', () => {
  it('keeps exact base severity despite generic sensitivity', () => {
    const products = [
      product('p1', 'Retinol 0.3%', ['Retinol'], 'low'),
      product('p2', 'Glycolic 7%', ['Glycolic Acid'], 'low'),
    ];
    const conflicts = previewDetectConflicts(products, sensitive, STARTER_RULES);
    expect(conflicts).toHaveLength(1);
    const c = conflicts[0]!;
    expect(c.rule.interactionType).toBe('irritation');
    expect(c.rule.evidenceLabel).toBe('contested');
    expect(c.rule.resolutionType).toBe('alternate_nights');
    expect(c.computedSeverity).toBe('mild');
  });
});

describe('niacinamide × vitamin C. Refuted myth, reassure not warn (§4.4 row 4 / §7.8)', () => {
  it('classifies as myth and is reassuring', () => {
    const products = [
      product('p1', 'Niacinamide 10%', ['Niacinamide']),
      product('p2', 'Vitamin C serum', ['Ascorbic Acid']),
    ];
    const conflicts = previewDetectConflicts(products, neutral, STARTER_RULES);
    const myth = conflicts.find((c) => c.rule.interactionType === 'myth');
    expect(myth).toBeDefined();
    expect(myth!.rule.evidenceLabel).toBe('refuted');
    expect(myth!.rule.evidenceGrade).toBeNull();
    expect(myth!.computedSeverity).toBe('none');
    expect(isReassuring(myth!)).toBe(true);
  });
});

describe('benzoyl peroxide × retinoid stability (§4.4 row 3 / 3b)', () => {
  it('flags the scoped tretinoin molecule as moderate stability / separate_am_pm', () => {
    const products = [
      product('p1', 'BP wash', ['Benzoyl Peroxide']),
      product('p2', 'Tretinoin', ['Tretinoin']),
    ];
    const c = previewDetectConflicts(products, neutral, STARTER_RULES).find(
      (x) => x.rule.interactionType === 'stability',
    );
    expect(c).toBeDefined();
    expect(c!.computedSeverity).toBe('moderate');
    expect(c!.rule.resolutionType).toBe('separate_am_pm');
  });

  it('does not reuse the named retinol/tretinoin row for adapalene', () => {
    const products = [
      product('p1', 'BP wash', ['Benzoyl Peroxide']),
      product('p2', 'Adapalene gel', ['Adapalene']),
    ];
    const stability = previewDetectConflicts(products, neutral, STARTER_RULES).filter(
      (x) => x.rule.interactionType === 'stability',
    );
    expect(stability).toHaveLength(0);
  });
});

describe('multiple interactions for one pair', () => {
  it('evaluates every applicable rule instead of treating multiplicity as compatibility', () => {
    const first = STARTER_RULES.find((rule) => rule.pairKey === 'aha|retinoid')!;
    const second = {
      ...first,
      id: '00000000-0000-4000-8000-0000000000ee',
      interactionType: 'efficacy' as const,
    };
    const rules = [first, second];
    const products = [
      product('p1', 'Retinol', ['Retinol']),
      product('p2', 'Glycolic', ['Glycolic Acid']),
    ];

    expect(findRules(rules, 'retinoid', 'aha')).toHaveLength(2);
    expect(findRule(rules, 'retinoid', 'aha')).toBeUndefined();
    expect(
      previewDetectConflicts(products, neutral, rules).map((conflict) => conflict.rule.id),
    ).toEqual([first.id, second.id]);
  });
});

describe('safety: retinoid × pregnancy (§4.8)', () => {
  it('fires high / avoid_refer when pregnant', () => {
    const products = [product('p1', 'Retinol', ['Retinol'])];
    const c = previewDetectConflicts(products, pregnant, STARTER_RULES).find(
      (x) => x.rule.interactionType === 'safety',
    );
    expect(c).toBeDefined();
    expect(c!.computedSeverity).toBe('high');
    expect(c!.rule.resolutionType).toBe('avoid_refer');
    expect(c!.rule.evidenceLabel).toBe('contested'); // not "established". Caution, not demonstrated harm
    expect(c!.productBId).toBeNull(); // pregnancy is a pseudo-tag, not a product
  });

  it('does NOT fire when not pregnant', () => {
    const products = [product('p1', 'Retinol', ['Retinol'])];
    const c = previewDetectConflicts(products, neutral, STARTER_RULES).filter(
      (x) => x.rule.interactionType === 'safety',
    );
    expect(c).toHaveLength(0);
  });
});

describe('safety dose-gating: BHA × pregnancy only on high-dose (§4.8)', () => {
  it('does NOT fire on low-dose BHA', () => {
    const products = [product('p1', 'Gentle BHA toner', ['Salicylic Acid'], 'low')];
    const safety = previewDetectConflicts(products, pregnant, STARTER_RULES).filter(
      (x) => x.rule.tagA === 'bha' || x.rule.tagB === 'bha',
    );
    expect(safety.filter((s) => s.rule.interactionType === 'safety')).toHaveLength(0);
  });

  it('fires on high-dose BHA', () => {
    const products = [product('p1', 'Strong BHA peel', ['Salicylic Acid'], 'high')];
    const c = previewDetectConflicts(products, pregnant, STARTER_RULES).find(
      (x) =>
        x.rule.interactionType === 'safety' && (x.rule.tagA === 'bha' || x.rule.tagB === 'bha'),
    );
    expect(c).toBeDefined();
    expect(c!.computedSeverity).toBe('moderate');
  });

  it('fires conservatively when BHA concentration is unknown', () => {
    const products = [product('p1', 'BHA product', ['Salicylic Acid'])];
    const safety = previewDetectConflicts(products, pregnant, STARTER_RULES).filter(
      (conflict) => conflict.rule.interactionType === 'safety',
    );
    expect(safety).toHaveLength(1);
  });
});

describe('personalization (§4.7)', () => {
  it('does not bypass retinoid + BHA guidance for resistant skin', () => {
    const products = [
      product('p1', 'Retinol', ['Retinol']),
      product('p2', 'BHA', ['Salicylic Acid']),
    ];
    const irritation = previewDetectConflicts(products, resistant, STARTER_RULES).filter(
      (x) => x.rule.interactionType === 'irritation',
    );
    expect(irritation).toHaveLength(1);
  });

  it('high concentration + sensitive escalates retinoid × AHA to high', () => {
    const products = [
      product('p1', 'Retinol 1%', ['Retinol'], 'high'),
      product('p2', 'Glycolic 10%', ['Glycolic Acid'], 'high'),
    ];
    const c = previewDetectConflicts(products, sensitive, STARTER_RULES).find(
      (x) => x.rule.interactionType === 'irritation',
    );
    expect(c!.computedSeverity).toBe('mild');
  });
});

describe('coverage-aware evaluation', () => {
  it('uses a non-claim state when there is no pair to assess', () => {
    expect(evaluateConflicts([], neutral)).toEqual({
      status: 'not_applicable',
      conflicts: [],
      unsupportedPairs: [],
    });
    expect(evaluateConflicts([product('p1', 'Moisturizer', ['Glycerin'])], neutral)).toEqual({
      status: 'not_applicable',
      conflicts: [],
      unsupportedPairs: [],
    });
  });

  it('fails closed when two real products have no assessable tag pair', () => {
    expect(
      evaluateConflicts(
        [
          { id: 'manual-a', name: 'Manual product A', tags: [] },
          { id: 'manual-b', name: 'Manual product B', tags: [] },
        ],
        neutral,
      ),
    ).toEqual({
      status: 'unsupported_unreviewed',
      conflicts: [],
      unsupportedPairs: ['unassessable_pair@routine@unknown#0-1'],
    });
  });

  it('unions every unassessable physical pair with assessable coverage in a mixed shelf', () => {
    expect(
      evaluateConflicts(
        [
          product('tagged-retinoid', 'Retinol', ['Retinol']),
          { id: 'manual', name: 'Manual product', tags: [] },
          product('tagged-acid', 'Glycolic', ['Glycolic Acid']),
        ],
        neutral,
      ),
    ).toEqual({
      status: 'unsupported_unreviewed',
      conflicts: [],
      unsupportedPairs: [
        'aha|retinoid@routine@unknown',
        'unassessable_pair@routine@unknown#0-1',
        'unassessable_pair@routine@unknown#1-2',
      ],
    });
  });

  it('fails closed when a product cannot be assessed for an active reproductive context', () => {
    expect(
      evaluateConflicts([{ id: 'manual-a', name: 'Manual product A', tags: [] }], {
        sensitivity: 'neutral',
        pregnancy: true,
        reproductiveStatus: 'pregnant',
      }),
    ).toEqual({
      status: 'unsupported_unreviewed',
      conflicts: [],
      unsupportedPairs: ['unassessable_pair@pregnant@unknown#0'],
    });
  });

  it('unions an unassessable safety-context pair with tagged safety coverage', () => {
    expect(
      evaluateConflicts(
        [
          product('tagged-retinoid', 'Retinol', ['Retinol']),
          { id: 'manual', name: 'Manual product', tags: [] },
        ],
        {
          sensitivity: 'neutral',
          pregnancy: true,
          reproductiveStatus: 'pregnant',
        },
      ),
    ).toEqual({
      status: 'unsupported_unreviewed',
      conflicts: [],
      unsupportedPairs: [
        'pregnancy|retinoid@pregnant@unknown',
        'unassessable_pair@pregnant@unknown#1',
        'unassessable_pair@routine@unknown#0-1',
      ],
    });
  });

  it('distinguishes the closed unreviewed corpus from reviewed compatibility', () => {
    const products = [
      product('p1', 'Niacinamide', ['Niacinamide']),
      product('p2', 'Moisturizer', ['Glycerin']),
    ];
    const evaluation = evaluateConflicts(products, neutral);

    expect(evaluation.status).toBe('unsupported_unreviewed');
    expect(evaluation.conflicts).toEqual([]);
    expect(evaluation.unsupportedPairs).toContain('humectant|niacinamide@routine@unknown');
  });

  it('keeps pregnancy and breastfeeding distinct and leaves breastfeeding unsupported', () => {
    const products = [product('p1', 'Retinol', ['Retinol'])];
    const breastfeeding: EngineProfile = {
      sensitivity: 'neutral',
      pregnancy: false,
      safetyStatus: 'breastfeeding',
    };
    const safety = previewDetectConflicts(products, breastfeeding, STARTER_RULES);
    const evaluation = evaluateConflicts(products, breastfeeding, {
      corpusSha256: STARTER_RULES[0]!.corpusSha256,
      rules: STARTER_RULES,
      reviewedCompatiblePairs: [],
      receiptIds: ['synthetic-alpha', 'synthetic-beta', 'synthetic-regulatory'],
    });

    expect(safety).toEqual([]);
    expect(evaluation.status).toBe('unsupported_unreviewed');
    expect(evaluation.unsupportedPairs).toContain('pregnancy|retinoid@breastfeeding@unknown');
  });

  it('rejects a structurally forged corpus that never passed runtime admission', () => {
    const evaluation = evaluateConflicts(
      [product('p1', 'Retinol', ['Retinol']), product('p2', 'Glycolic', ['Glycolic Acid'])],
      neutral,
      {
        corpusSha256: STARTER_RULES[0]!.corpusSha256,
        rules: STARTER_RULES,
        reviewedCompatiblePairs: [],
        receiptIds: ['forged-alpha', 'forged-beta', 'forged-regulatory'],
      },
    );

    expect(evaluation).toMatchObject({
      status: 'unsupported_unreviewed',
      conflicts: [],
    });
    expect(evaluation.unsupportedPairs).toContain('aha|retinoid@routine@unknown');
  });
});

describe('exact applicability binds every fact to its tagged participant', () => {
  const rule = STARTER_RULES.find(
    (candidate) => candidate.tagA === 'retinoid' && candidate.tagB === 'aha',
  )!;
  const notApplicable = { status: 'not_applicable' } as const;
  const participant = (
    over: Partial<ConflictParticipantApplicability> = {},
  ): ConflictParticipantApplicability => ({
    moleculeIds: notApplicable,
    finishedProductIds: notApplicable,
    finishedFormulationIds: notApplicable,
    concentration: notApplicable,
    applicationAmount: notApplicable,
    applicationArea: notApplicable,
    frequencyPerWeek: notApplicable,
    durationDays: notApplicable,
    ph: notApplicable,
    vehicle: notApplicable,
    occlusion: notApplicable,
    barrierCondition: notApplicable,
    exposure: notApplicable,
    ...over,
  });
  const exact = <T>(value: T): ConflictConstraint<T> => ({ status: 'exact', value });
  const cases: {
    name: keyof ConflictParticipantApplicability;
    constraint: ConflictConstraint<never>;
    facts: NonNullable<EngineProduct['applicabilityFacts']>;
  }[] = [
    {
      name: 'moleculeIds',
      constraint: exact(['retinol']) as ConflictConstraint<never>,
      facts: { moleculeIds: ['retinol'] },
    },
    {
      name: 'finishedProductIds',
      constraint: exact(['product-101']) as ConflictConstraint<never>,
      facts: { finishedProductId: 'product-101' },
    },
    {
      name: 'finishedFormulationIds',
      constraint: exact(['formula-202']) as ConflictConstraint<never>,
      facts: { finishedFormulationId: 'formula-202' },
    },
    {
      name: 'concentration',
      constraint: exact({
        unit: '%' as const,
        minInclusive: 0.25,
        maxInclusive: 0.5,
      }) as ConflictConstraint<never>,
      facts: { concentration: { value: 0.3, unit: '%' } },
    },
    {
      name: 'applicationAmount',
      constraint: exact({
        unit: 'pea_sized' as const,
        minInclusive: 1,
        maxInclusive: 1,
      }) as ConflictConstraint<never>,
      facts: { applicationAmount: { value: 1, unit: 'pea_sized' } },
    },
    {
      name: 'applicationArea',
      constraint: exact(['face']) as ConflictConstraint<never>,
      facts: { applicationArea: 'face' },
    },
    {
      name: 'frequencyPerWeek',
      constraint: exact({ minInclusive: 2, maxInclusive: 3 }) as ConflictConstraint<never>,
      facts: { frequencyPerWeek: 2 },
    },
    {
      name: 'durationDays',
      constraint: exact({ minInclusive: 14, maxInclusive: 30 }) as ConflictConstraint<never>,
      facts: { durationDays: 21 },
    },
    {
      name: 'ph',
      constraint: exact({ minInclusive: 5, maxInclusive: 6 }) as ConflictConstraint<never>,
      facts: { ph: 5.5 },
    },
    {
      name: 'vehicle',
      constraint: exact(['gel']) as ConflictConstraint<never>,
      facts: { vehicle: 'gel' },
    },
    {
      name: 'occlusion',
      constraint: exact(false) as ConflictConstraint<never>,
      facts: { occlusion: false },
    },
    {
      name: 'barrierCondition',
      constraint: exact(['intact'] as const) as ConflictConstraint<never>,
      facts: { barrierCondition: 'intact' },
    },
    {
      name: 'exposure',
      constraint: exact('leave_on' as const) as ConflictConstraint<never>,
      facts: { exposure: 'leave_on' },
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name}: matches its own side in either input order and rejects wrong-side facts`, () => {
      const conditions = {
        tagA: participant({ [testCase.name]: testCase.constraint }),
        tagB: participant(),
        reproductiveContexts: notApplicable,
      };
      const retinoid: EngineProduct = {
        id: 'retinoid',
        name: 'Retinoid',
        tags: ['retinoid'],
        applicabilityFacts: testCase.facts,
      };
      const acid: EngineProduct = { id: 'acid', name: 'Acid', tags: ['aha'] };
      const wrongSideRetinoid: EngineProduct = {
        ...retinoid,
        applicabilityFacts: undefined,
      };
      const wrongSideAcid: EngineProduct = { ...acid, applicabilityFacts: testCase.facts };

      expect(matchesExactApplicabilityForReview(rule, conditions, retinoid, acid)).toBe(true);
      expect(matchesExactApplicabilityForReview(rule, conditions, acid, retinoid)).toBe(true);
      expect(
        matchesExactApplicabilityForReview(rule, conditions, wrongSideRetinoid, wrongSideAcid),
      ).toBe(false);
      expect(
        matchesExactApplicabilityForReview(rule, conditions, wrongSideAcid, wrongSideRetinoid),
      ).toBe(false);
    });
  }

  const allowlistCases: {
    name: keyof ConflictParticipantApplicability;
    constraint: ConflictConstraint<never>;
    allowedFacts: NonNullable<EngineProduct['applicabilityFacts']>;
    disallowedFacts: NonNullable<EngineProduct['applicabilityFacts']>;
  }[] = [
    {
      name: 'moleculeIds',
      constraint: exact(['retinol', 'tretinoin']) as ConflictConstraint<never>,
      allowedFacts: { moleculeIds: ['tretinoin'] },
      disallowedFacts: { moleculeIds: ['adapalene'] },
    },
    {
      name: 'finishedProductIds',
      constraint: exact(['product-101', 'product-202']) as ConflictConstraint<never>,
      allowedFacts: { finishedProductId: 'product-202' },
      disallowedFacts: { finishedProductId: 'product-303' },
    },
    {
      name: 'finishedFormulationIds',
      constraint: exact(['formula-gel', 'formula-cream']) as ConflictConstraint<never>,
      allowedFacts: { finishedFormulationId: 'formula-cream' },
      disallowedFacts: { finishedFormulationId: 'formula-lotion' },
    },
    {
      name: 'applicationArea',
      constraint: exact(['face', 'neck']) as ConflictConstraint<never>,
      allowedFacts: { applicationArea: 'neck' },
      disallowedFacts: { applicationArea: 'body' },
    },
    {
      name: 'vehicle',
      constraint: exact(['gel', 'cream']) as ConflictConstraint<never>,
      allowedFacts: { vehicle: 'cream' },
      disallowedFacts: { vehicle: 'lotion' },
    },
    {
      name: 'barrierCondition',
      constraint: exact(['intact', 'compromised'] as const) as ConflictConstraint<never>,
      allowedFacts: { barrierCondition: 'compromised' },
      disallowedFacts: { barrierCondition: 'unknown' },
    },
  ];

  for (const testCase of allowlistCases) {
    it(`${testCase.name}: treats every exact array value as an allowed alternative`, () => {
      const conditions = {
        tagA: participant({ [testCase.name]: testCase.constraint }),
        tagB: participant(),
        reproductiveContexts: notApplicable,
      };
      const acid: EngineProduct = { id: 'acid', name: 'Acid', tags: ['aha'] };
      const allowed: EngineProduct = {
        id: 'allowed-retinoid',
        name: 'Allowed retinoid',
        tags: ['retinoid'],
        applicabilityFacts: testCase.allowedFacts,
      };
      const disallowed: EngineProduct = {
        ...allowed,
        id: 'disallowed-retinoid',
        applicabilityFacts: testCase.disallowedFacts,
      };

      expect(evaluateExactApplicabilityForReview(rule, conditions, allowed, acid)).toBe('matches');
      expect(evaluateExactApplicabilityForReview(rule, conditions, disallowed, acid)).toBe(
        'does_not_match',
      );
    });
  }

  it('withholds severity instead of falling back to base when a branch fact is missing', () => {
    const branchedRule = {
      ...rule,
      applicability: {
        ...rule.applicability,
        severityBranches: [
          {
            branchId: 'urn:reviewed-vehicle-severity-branch',
            severity: 'moderate' as const,
            conditions: {
              tagA: participant({ vehicle: exact(['gel', 'cream']) }),
              tagB: participant(),
              reproductiveContexts: notApplicable,
            },
          },
        ],
      },
    };
    const acid: EngineProduct = { id: 'acid', name: 'Acid', tags: ['aha'] };
    const missing: EngineProduct = { id: 'missing', name: 'Retinoid', tags: ['retinoid'] };
    const cream: EngineProduct = {
      ...missing,
      id: 'cream',
      applicabilityFacts: { vehicle: 'cream' },
    };
    const lotion: EngineProduct = {
      ...missing,
      id: 'lotion',
      applicabilityFacts: { vehicle: 'lotion' },
    };

    expect(evaluateReviewedSeverityForApplicability(branchedRule, missing, acid)).toEqual({
      status: 'unsupported_missing_facts',
      severity: null,
    });
    expect(evaluateReviewedSeverityForApplicability(branchedRule, cream, acid)).toEqual({
      status: 'resolved',
      severity: 'moderate',
    });
    expect(evaluateReviewedSeverityForApplicability(branchedRule, lotion, acid)).toEqual({
      status: 'resolved',
      severity: rule.baseSeverity,
    });
  });

  it('withholds severity when more than one reviewed branch matches the same exact facts', () => {
    const overlappingRule = {
      ...rule,
      applicability: {
        ...rule.applicability,
        severityBranches: [
          {
            branchId: 'urn:reviewed-overlap-moderate',
            severity: 'moderate' as const,
            conditions: {
              tagA: participant(),
              tagB: participant(),
              reproductiveContexts: notApplicable,
            },
          },
          {
            branchId: 'urn:reviewed-overlap-high',
            severity: 'high' as const,
            conditions: {
              tagA: participant(),
              tagB: participant(),
              reproductiveContexts: notApplicable,
            },
          },
        ],
      },
    };
    const retinoid: EngineProduct = {
      id: 'retinoid',
      name: 'Retinoid',
      tags: ['retinoid'],
    };
    const acid: EngineProduct = { id: 'acid', name: 'Acid', tags: ['aha'] };

    expect(evaluateReviewedSeverityForApplicability(overlappingRule, retinoid, acid)).toEqual({
      status: 'unsupported_ambiguous_branches',
      severity: null,
    });
  });

  it('binds reproductive context independently from both products', () => {
    const conditions = {
      tagA: participant(),
      tagB: participant(),
      reproductiveContexts: exact(['pregnant', 'breastfeeding'] as const),
    };
    const retinoid: EngineProduct = { id: 'retinoid', name: 'Retinoid', tags: ['retinoid'] };
    const acid: EngineProduct = { id: 'acid', name: 'Acid', tags: ['aha'] };

    expect(matchesExactApplicabilityForReview(rule, conditions, retinoid, acid, 'pregnant')).toBe(
      true,
    );
    expect(matchesExactApplicabilityForReview(rule, conditions, acid, retinoid, 'pregnant')).toBe(
      true,
    );
    expect(
      matchesExactApplicabilityForReview(rule, conditions, retinoid, acid, 'breastfeeding'),
    ).toBe(true);
    expect(matchesExactApplicabilityForReview(rule, conditions, retinoid, acid, 'unknown')).toBe(
      false,
    );
  });
});

describe('synergy (§4.1 #9/#11)', () => {
  it('vitamin C + sunscreen is surfaced positively', () => {
    const products = [
      product('p1', 'Vitamin C', ['Ascorbic Acid']),
      product('p2', 'Mineral SPF', ['Zinc Oxide']),
    ];
    const syn = previewDetectConflicts(products, neutral, STARTER_RULES).find(
      (x) => x.rule.interactionType === 'synergy',
    );
    expect(syn).toBeDefined();
    expect(isReassuring(syn!)).toBe(true);
    expect(syn!.rule.resolutionType).toBe('no_change');
  });
});

describe('ranking (§4.6). Safety first', () => {
  it('orders safety above irritation', () => {
    const products = [
      product('p1', 'Retinol', ['Retinol']),
      product('p2', 'Glycolic', ['Glycolic Acid']),
    ];
    const conflicts = previewDetectConflicts(products, pregnant, STARTER_RULES);
    expect(conflicts[0]!.rule.interactionType).toBe('safety');
  });
});
