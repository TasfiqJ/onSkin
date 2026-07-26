import type { FunctionalTag, GoalId, SequencingRole } from '@onskin/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { previewDetectConflicts, type EngineProduct } from '@/features/intelligence/engine';
import {
  STARTER_RULES,
  type ConflictConstraint,
  type ConflictParticipantApplicability,
  type ConflictRule,
} from '@/features/intelligence/rules';

import { recTypeByKey, RECS_REVIEWED, shippableRecTypes } from './catalog';
import {
  recommend,
  recommendationConflictDispositionForType,
  type RecInput,
  type RecProfile,
  type RecReplenishmentItem,
  type RecShelfItem,
} from './engine';
import { DEFAULT_PREFERENCES } from './preferences';

// Engine fixtures (docs/09 §4/§5). The six triggers + the honest "you're set",
// restrained and type-first. The engine recommends only on a genuine, profile-
// grounded need, prioritised safety/gap > replacement > conflict > better-fit > goal.

// In dev the full catalog (incl. launch-gated goal actives) is available. Mirror
// that here so the behavioural fixtures exercise the goal trigger. A dedicated test
// below asserts the production gate withholds them (B-DERM-REVIEW).
beforeAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});
afterAll(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

function item(over: Partial<RecShelfItem> & { id: string; role: SequencingRole }): RecShelfItem {
  return {
    name: over.name ?? over.id,
    tags: [],
    fragranced: false,
    ...over,
  };
}

function replenishment(
  product: RecShelfItem,
  reason: RecReplenishmentItem['reason'] = 'printed_expiry_countdown',
): RecReplenishmentItem {
  return {
    id: product.id,
    name: product.name,
    tags: product.tags,
    concentration: product.concentration,
    reason,
  };
}

function input(over: Partial<RecInput> & { profile: RecProfile; shelf: RecShelfItem[] }): RecInput {
  return {
    conflicts: [],
    preferences: DEFAULT_PREFERENCES,
    ...over,
  };
}

const cleanser = item({ id: 'p_clean', name: 'Gentle cleanser', role: 'cleanser' });
const moisturiser = item({
  id: 'p_moist',
  name: 'Ceramide cream',
  role: 'moisturiser',
  tags: ['ceramide'],
});
const spf = item({ id: 'p_spf', name: 'Daily SPF 30', role: 'spf', tags: ['sunscreen'] });
const niacinamide = item({
  id: 'p_niac',
  name: 'Niacinamide 5%',
  role: 'hydrating_serum',
  tags: ['niacinamide'],
});

const notApplicable = { status: 'not_applicable' } as const;
const exact = <T>(value: T): ConflictConstraint<T> => ({ status: 'exact', value });

function reviewedParticipant(
  over: Partial<ConflictParticipantApplicability> = {},
): ConflictParticipantApplicability {
  return {
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
  };
}

function admittedBpTretinoinRule(): ConflictRule {
  const source = STARTER_RULES.find(
    (rule) => rule.tagA === 'benzoyl_peroxide' && rule.tagB === 'retinoid',
  )!;
  return {
    ...source,
    candidateDisposition: 'reviewed',
    admission: {
      status: 'approved',
      corpusSha256: source.corpusSha256,
      receiptIds: ['receipt-derm', 'receipt-chemist', 'receipt-counsel'],
      reviewerRoles: ['board_certified_dermatologist', 'cosmetic_chemist', 'regulatory_counsel'],
    },
    applicability: {
      ...source.applicability,
      reviewStatus: 'reviewed',
      approvedConditions: {
        tagA: reviewedParticipant(),
        tagB: reviewedParticipant({
          moleculeIds: exact(['tretinoin']),
          finishedFormulationIds: exact(['tretinoin-gel-0.025']),
        }),
        reproductiveContexts: notApplicable,
      },
    },
  };
}

describe('gap-filling. A missing SPF is the highest-priority recommendation (§4.1)', () => {
  const res = recommend(
    input({
      profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging'] },
      shelf: [cleanser, moisturiser, niacinamide],
    }),
  );

  it('puts the SPF gap first, type-first, with a strong fit and an evidence dot', () => {
    const top = res.recommendations[0]!;
    expect(top.trigger).toBe('gap');
    expect(top.productType).toBe('mineral_spf'); // sensitive → mineral preferred
    expect(top.what).toBe('A mineral SPF 30+');
    expect(top.fitLabel).toBe('Strong fit');
    expect(top.footIsEvidence).toBe(true);
    expect(res.youreSet).toBe(false);
  });

  it('carries the what / why / how triad on every suggestion (§6. Explainability is mandatory)', () => {
    const top = res.recommendations[0]!;
    expect(top.why.toLowerCase()).toContain('spf');
    expect(top.how.profile.length).toBeGreaterThan(0);
    expect(top.how.gap.toLowerCase()).toContain('no spf');
    expect(top.how.evidence.length).toBeGreaterThan(0);
    expect(top.how.caveat).toBeTruthy(); // mineral SPF white-cast caveat (honest flaw)
  });

  it('is restrained. It does not re-recommend what is already owned, nor pad the list', () => {
    const types = res.recommendations.map((r) => r.productType);
    expect(types).not.toContain('niacinamide_serum'); // already owned
    expect(res.recommendations.length).toBeLessThanOrEqual(2); // gap + one goal active, no padding
  });
});

describe('goal-driven. Pregnancy swaps the active for a safe alternative (§8 hard exclusion)', () => {
  it('withholds unreviewed goal-active guidance for an exact pregnant status', () => {
    const res = recommend(
      input({
        profile: {
          sensitivity: 'neutral',
          pregnancy: true,
          reproductiveStatus: 'pregnant',
          goals: ['anti_aging'],
        },
        shelf: [cleanser, moisturiser, spf],
      }),
    );
    const goalRec = res.recommendations.find((r) => r.trigger === 'goal');
    expect(goalRec).toBeUndefined();
  });

  it('describes the combined stored profile without inferring pregnancy alone', () => {
    const res = recommend(
      input({
        profile: {
          sensitivity: 'neutral',
          pregnancy: true,
          reproductiveStatus: 'pregnant',
          goals: [],
        },
        shelf: [cleanser, moisturiser],
      }),
    );

    expect(res.recommendations).not.toHaveLength(0);
    expect(res.recommendations.every((rec) => rec.how.profile.includes('Pregnant or trying'))).toBe(
      true,
    );
    expect(JSON.stringify(res.recommendations)).not.toMatch(/Pregnancy setting/u);
  });

  it('does not turn the legacy caution mode into a pregnancy exclusion or claim', () => {
    const res = recommend(
      input({
        profile: {
          sensitivity: 'neutral',
          pregnancy: false,
          pregnancySafety: 'caution',
          goals: ['anti_aging'],
        },
        shelf: [cleanser, moisturiser, spf],
      }),
    );

    expect(res.recommendations.some((r) => r.trigger === 'goal')).toBe(true);
    expect(JSON.stringify(res.recommendations)).not.toMatch(/pregnan/i);
  });

  for (const reproductiveStatus of ['breastfeeding', 'trying', 'unknown', 'prefer_not'] as const) {
    it(`keeps ${reproductiveStatus} exact and withholds unreviewed goal-active guidance`, () => {
      const res = recommend(
        input({
          profile: {
            sensitivity: 'neutral',
            pregnancy: reproductiveStatus === 'breastfeeding',
            reproductiveStatus,
            goals: ['anti_aging'],
          },
          shelf: [cleanser, moisturiser, spf],
        }),
      );

      expect(res.recommendations.some((rec) => rec.trigger === 'goal')).toBe(false);
      expect(JSON.stringify(res.recommendations)).not.toMatch(/pregnan|pregnancy-friendly/i);
    });
  }

  it('does not infer that an owned retinoid is paused without admitted safety guidance', () => {
    const pausedRetinoid = item({
      id: 'paused-retinoid',
      name: 'Retinol serum',
      role: 'treatment',
      tags: ['retinoid'],
    });
    const res = recommend(
      input({
        profile: {
          sensitivity: 'neutral',
          pregnancy: false,
          pregnancySafety: 'caution',
          goals: ['anti_aging'],
        },
        shelf: [cleanser, moisturiser, spf, pausedRetinoid],
      }),
    );

    expect(res.recommendations.find((rec) => rec.trigger === 'goal')).toBeUndefined();
    expect(res.conflictCoverageStatus).toBe('unsupported_unreviewed');
  });

  it('introduces only ONE goal active at a time (restraint, §4.5)', () => {
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: ['anti_aging', 'clear_skin'] },
        shelf: [cleanser, moisturiser, spf],
      }),
    );
    expect(res.recommendations.filter((r) => r.trigger === 'goal').length).toBe(1);
  });
});

describe('the honest "you\'re set" seventh state (§4)', () => {
  it('does not say "you’re set" when interaction coverage is unavailable', () => {
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf],
      }),
    );
    expect(res.recommendations).toHaveLength(0);
    expect(res.youreSet).toBe(false);
    expect(res.conflictCoverageStatus).toBe('unsupported_unreviewed');
  });

  it('does not claim completion when interaction coverage did not evaluate a pair', () => {
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf],
        conflictCoverageStatus: 'not_applicable',
      }),
    );

    expect(res.recommendations).toEqual([]);
    expect(res.youreSet).toBe(false);
    expect(res.conflictCoverageStatus).toBe('not_applicable');
  });

  it('allows the seventh state only after reviewed compatibility', () => {
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf],
        conflictCoverageStatus: 'compatible',
      }),
    );

    expect(res.recommendations).toEqual([]);
    expect(res.youreSet).toBe(true);
  });
});

describe('conflict resolution. A non-conflicting alternative (§4.3)', () => {
  it('uses exact BP × tretinoin applicability instead of collapsing every retinoid tag', () => {
    const rule = admittedBpTretinoinRule();
    const bp = item({
      id: 'bp',
      name: 'Benzoyl peroxide',
      role: 'treatment',
      tags: ['benzoyl_peroxide'],
    });
    const retinoidType = recTypeByKey('retinoid_serum')!;
    const exactTretinoin = {
      ...retinoidType,
      type: 'exact-tretinoin-gel',
      applicabilityFacts: {
        moleculeIds: ['tretinoin'],
        finishedFormulationId: 'tretinoin-gel-0.025',
      },
    };
    const unrelatedRetinol = {
      ...retinoidType,
      type: 'unrelated-retinol',
      applicabilityFacts: {
        moleculeIds: ['retinol'],
        finishedFormulationId: 'retinol-serum',
      },
    };
    const unrelatedFormulation = {
      ...retinoidType,
      type: 'unrelated-tretinoin-formulation',
      applicabilityFacts: {
        moleculeIds: ['tretinoin'],
        finishedFormulationId: 'tretinoin-cream-0.05',
      },
    };

    expect(recommendationConflictDispositionForType(exactTretinoin, [bp], [rule])).toBe(
      'reviewed_conflict',
    );
    expect(recommendationConflictDispositionForType(unrelatedRetinol, [bp], [rule])).toBe(
      'eligible',
    );
    expect(recommendationConflictDispositionForType(unrelatedFormulation, [bp], [rule])).toBe(
      'eligible',
    );
    expect(recommendationConflictDispositionForType(retinoidType, [bp], [rule])).toBe(
      'unsupported_missing_facts',
    );

    const allowedSetRule: ConflictRule = {
      ...rule,
      applicability: {
        ...rule.applicability,
        approvedConditions: {
          ...rule.applicability.approvedConditions,
          tagB: reviewedParticipant({
            moleculeIds: exact(['adapalene', 'tretinoin']),
            finishedFormulationIds: exact([
              'adapalene-bp-reviewed-combination',
              'tretinoin-gel-0.025',
            ]),
          }),
        },
      },
    };
    expect(recommendationConflictDispositionForType(exactTretinoin, [bp], [allowedSetRule])).toBe(
      'reviewed_conflict',
    );

    const missingSeverityBranchFact: ConflictRule = {
      ...rule,
      applicability: {
        ...rule.applicability,
        severityBranches: [
          {
            branchId: 'urn:reviewed-concentration-severity-branch',
            severity: 'high',
            conditions: {
              tagA: reviewedParticipant(),
              tagB: reviewedParticipant({
                concentration: exact({
                  unit: '%',
                  minInclusive: 0.025,
                  maxInclusive: 0.05,
                }),
              }),
              reproductiveContexts: notApplicable,
            },
          },
        ],
      },
    };
    expect(
      recommendationConflictDispositionForType(exactTretinoin, [bp], [missingSeverityBranchFact]),
    ).toBe('unsupported_missing_facts');

    const overlappingSeverityBranches: ConflictRule = {
      ...rule,
      applicability: {
        ...rule.applicability,
        severityBranches: [
          {
            branchId: 'urn:reviewed-overlap-moderate',
            severity: 'moderate',
            conditions: {
              tagA: reviewedParticipant(),
              tagB: reviewedParticipant(),
              reproductiveContexts: notApplicable,
            },
          },
          {
            branchId: 'urn:reviewed-overlap-high',
            severity: 'high',
            conditions: {
              tagA: reviewedParticipant(),
              tagB: reviewedParticipant(),
              reproductiveContexts: notApplicable,
            },
          },
        ],
      },
    };
    expect(
      recommendationConflictDispositionForType(exactTretinoin, [bp], [overlappingSeverityBranches]),
    ).toBe('unsupported_ambiguous_branches');
    expect(
      recommendationConflictDispositionForType(
        exactTretinoin,
        [bp],
        [rule, overlappingSeverityBranches],
      ),
    ).toBe('unsupported_ambiguous_branches');
    expect(
      recommendationConflictDispositionForType(
        exactTretinoin,
        [bp],
        [overlappingSeverityBranches, rule],
      ),
    ).toBe('unsupported_ambiguous_branches');
  });

  it('does not turn a candidate preview conflict into a production recommendation', () => {
    const profile = { sensitivity: 'sensitive' as const, pregnancy: false, goals: [] as GoalId[] };
    const engineProducts: EngineProduct[] = [
      { id: 'p_ret', name: 'Retinol 0.5%', tags: ['retinoid'] as FunctionalTag[] },
      { id: 'p_aha', name: 'Glycolic 7%', tags: ['aha'] as FunctionalTag[] },
    ];
    const conflicts = previewDetectConflicts(
      engineProducts,
      { sensitivity: 'sensitive', pregnancy: false },
      STARTER_RULES,
    );
    const res = recommend(
      input({
        profile,
        shelf: [
          cleanser,
          moisturiser,
          spf,
          item({ id: 'p_ret', name: 'Retinol 0.5%', role: 'treatment', tags: ['retinoid'] }),
          item({ id: 'p_aha', name: 'Glycolic 7%', role: 'exfoliant', tags: ['aha'] }),
        ],
        conflicts,
      }),
    );
    const conflictRec = res.recommendations.find((r) => r.trigger === 'conflict');
    expect(conflictRec).toBeUndefined();
    expect(res.conflictCoverageStatus).toBe('unsupported_unreviewed');
  });

  it('honours a legacy rule-only dismissal after conflict IDs become pair-aware', () => {
    const conflicts = previewDetectConflicts(
      [
        { id: 'p_ret', name: 'Retinol 0.5%', tags: ['retinoid'] },
        { id: 'p_aha', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      { sensitivity: 'sensitive', pregnancy: false },
      STARTER_RULES,
    );
    const result = recommend(
      input({
        profile: { sensitivity: 'sensitive', pregnancy: false, goals: [] },
        shelf: [
          cleanser,
          moisturiser,
          spf,
          item({ id: 'p_ret', name: 'Retinol 0.5%', role: 'treatment', tags: ['retinoid'] }),
          item({ id: 'p_aha', name: 'Glycolic 7%', role: 'exfoliant', tags: ['aha'] }),
        ],
        conflicts,
        dismissed: new Set([`conflict:${conflicts[0]!.rule.id}`]),
      }),
    );

    expect(
      result.recommendations.some((recommendation) => recommendation.trigger === 'conflict'),
    ).toBe(false);
  });

  it('does not derive a conflict recommendation from a safety-excluded product', () => {
    const conflicts = previewDetectConflicts(
      [
        { id: 'p_ret', name: 'Retinol 0.5%', tags: ['retinoid'] },
        { id: 'p_aha', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      { sensitivity: 'sensitive', pregnancy: false },
      STARTER_RULES,
    );
    const res = recommend(
      input({
        profile: {
          sensitivity: 'sensitive',
          pregnancy: false,
          pregnancySafety: 'caution',
          goals: [],
        },
        shelf: [
          cleanser,
          moisturiser,
          spf,
          item({ id: 'p_ret', name: 'Retinol 0.5%', role: 'treatment', tags: ['retinoid'] }),
          item({ id: 'p_aha', name: 'Glycolic 7%', role: 'exfoliant', tags: ['aha'] }),
        ],
        conflicts,
      }),
    );

    expect(res.recommendations.some((rec) => rec.trigger === 'conflict')).toBe(false);
  });
});

describe('better-fit. A gentler alternative to a fragranced product (§4.4)', () => {
  it('offers a fragrance-free swap for sensitive skin, as an option (relatedProductId set)', () => {
    const fragranced = item({
      id: 'p_fc',
      name: 'Rose cleanser',
      role: 'cleanser',
      fragranced: true,
    });
    const res = recommend(
      input({
        profile: { sensitivity: 'sensitive', pregnancy: false, goals: [] },
        shelf: [fragranced, moisturiser, spf],
      }),
    );
    const bf = res.recommendations.find((r) => r.trigger === 'better_fit');
    expect(bf?.productType).toBe('fragrance_free_cleanser');
    expect(bf?.relatedProductId).toBe('p_fc');
    expect(bf?.footLabel).toBe('Better fit');
  });
});

describe('routine completion. A beginner gets a minimal starter routine (§4.6)', () => {
  it('recommends the three essentials, not a 10-step regimen', () => {
    const res = recommend(
      input({ profile: { sensitivity: 'neutral', pregnancy: false, goals: [] }, shelf: [] }),
    );
    const roles = res.recommendations.map((r) => r.productType);
    expect(res.recommendations.every((r) => r.trigger === 'routine_completion')).toBe(true);
    expect(roles).toContain('mineral_spf');
    expect(roles.some((t) => t.includes('cleanser'))).toBe(true);
    expect(roles).toContain('ceramide_moisturiser');
    expect(res.recommendations.length).toBeLessThanOrEqual(3); // minimal
  });
});

describe('replacement. Only from tracked freshness or user-finished history (§4.2)', () => {
  it('surfaces an expiring product, anchored to the shelf item', () => {
    const expiring = item({
      id: 'p_vc',
      name: 'Vitamin C serum',
      role: 'antioxidant',
      tags: ['vitamin_c'],
    });
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf, expiring],
        replenishment: [replenishment(expiring)],
      }),
    );
    const rep = res.recommendations.find((r) => r.trigger === 'replacement');
    expect(rep?.relatedProductId).toBe('p_vc');
    expect(rep?.what.toLowerCase()).toContain('recorded package date');
    expect([rep?.what, rep?.why, rep?.how.gap].join(' ').toLowerCase()).not.toMatch(
      /running low|running out|nearly finished/,
    );
    expect(rep?.footIsEvidence).toBe(false); // "From your shelf", not an evidence grade
  });

  it('identifies product-label PAO without attributing its recorder or calling it reviewed catalog data', () => {
    const paoTracked = item({
      id: 'p_label_pao',
      name: 'Labelled serum',
      role: 'hydrating_serum',
    });
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf, paoTracked],
        replenishment: [replenishment(paoTracked, 'label_pao_expired')],
      }),
    );

    const rep = res.recommendations.find((r) => r.trigger === 'replacement');
    expect(rep?.what).toContain('tracked PAO date');
    expect(rep?.why).toContain('PAO recorded from the product label');
    expect(rep?.how.evidence).toContain('Opened date + PAO recorded from the product label');
    expect(rep?.why).not.toContain('you recorded');
    const copy = [rep?.what, rep?.why, rep?.how.gap, rep?.how.evidence].join(' ');
    expect(copy).not.toContain('printed expiry');
    expect(copy).not.toContain('reviewed catalog');
  });

  it('identifies a reviewed catalog PAO without attributing it to the user label', () => {
    const paoTracked = item({
      id: 'p_catalog_pao',
      name: 'Catalog serum',
      role: 'hydrating_serum',
    });
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf, paoTracked],
        replenishment: [replenishment(paoTracked, 'catalog_pao_countdown')],
      }),
    );

    const rep = res.recommendations.find((r) => r.trigger === 'replacement');
    expect(rep?.what).toContain('tracked PAO date');
    expect(rep?.why).toContain('reviewed catalog PAO');
    expect(rep?.how.evidence).toContain('Opened date + reviewed catalog PAO');
    const copy = [rep?.what, rep?.why, rep?.how.gap, rep?.how.evidence].join(' ');
    expect(copy).not.toContain('printed expiry');
    expect(copy).not.toContain('recorded from the product label');
  });

  it('surfaces an unsuperseded finished product without counting it as active inventory', () => {
    const finished = item({ id: 'finished-serum', name: 'Vitamin C serum', role: 'antioxidant' });
    const res = recommend(
      input({
        profile: { sensitivity: 'neutral', pregnancy: false, goals: [] },
        shelf: [cleanser, moisturiser, spf],
        replenishment: [replenishment(finished, 'finished')],
      }),
    );

    const rep = res.recommendations.find((r) => r.trigger === 'replacement');
    expect(rep).toMatchObject({
      relatedProductId: 'finished-serum',
      what: 'You marked Vitamin C serum as finished',
    });
    expect(rep?.how.evidence).toContain('Marked finished');
  });

  it('does not invent safety exclusions for replacement rows while review is pending', () => {
    const cautiousProfile: RecProfile = {
      sensitivity: 'neutral',
      pregnancy: false,
      pregnancySafety: 'caution',
      goals: [],
    };
    const excluded = [
      item({ id: 'r', name: 'Retinol', role: 'treatment', tags: ['retinoid'] }),
      item({
        id: 'h',
        name: 'Hydroquinone',
        role: 'treatment',
        tags: ['hydroquinone'],
      }),
      item({
        id: 'b',
        name: 'Salicylic serum',
        role: 'exfoliant',
        tags: ['bha'],
      }),
    ];

    const result = recommend(
      input({
        profile: cautiousProfile,
        shelf: [cleanser, moisturiser, spf, ...excluded],
        replenishment: excluded.map((product) => replenishment(product)),
      }),
    );

    expect(result.recommendations.filter((rec) => rec.trigger === 'replacement')).toHaveLength(3);
    expect(result.conflictCoverageStatus).toBe('unsupported_unreviewed');
  });

  it('keeps a confirmed-low BHA replacement eligible on the cautious branch', () => {
    const lowBha = item({
      id: 'low-bha',
      name: 'Salicylic 0.5%',
      role: 'exfoliant',
      tags: ['bha'],
      concentration: 'low',
    });
    const result = recommend(
      input({
        profile: {
          sensitivity: 'neutral',
          pregnancy: false,
          pregnancySafety: 'caution',
          goals: [],
        },
        shelf: [cleanser, moisturiser, spf, lowBha],
        replenishment: [replenishment(lowBha)],
      }),
    );

    expect(
      result.recommendations.some(
        (rec) => rec.trigger === 'replacement' && rec.relatedProductId === lowBha.id,
      ),
    ).toBe(true);
  });

  it.each(['pregnant', 'breastfeeding', 'trying', 'unknown', 'prefer_not'] as const)(
    'withholds safety-relevant repurchase copy for an exact %s status without admitted clearance',
    (reproductiveStatus) => {
      const reviewRequired = [
        item({ id: 'r', name: 'Retinol', role: 'treatment', tags: ['retinoid'] }),
        item({
          id: 'h',
          name: 'Hydroquinone',
          role: 'treatment',
          tags: ['hydroquinone'],
        }),
        item({
          id: 'b',
          name: 'Salicylic serum',
          role: 'exfoliant',
          tags: ['bha'],
          concentration: 'low',
        }),
      ];
      const result = recommend(
        input({
          profile: {
            sensitivity: 'neutral',
            pregnancy: reproductiveStatus === 'pregnant',
            reproductiveStatus,
            goals: [],
          },
          shelf: [cleanser, moisturiser, spf, ...reviewRequired],
          replenishment: reviewRequired.map((product) => replenishment(product, 'finished')),
          conflictCoverageStatus: 'unsupported_unreviewed',
        }),
      );

      expect(result.recommendations.filter((rec) => rec.trigger === 'replacement')).toEqual([]);
      expect(JSON.stringify(result.recommendations)).not.toMatch(
        /repurchase|better-fit alternative/i,
      );
    },
  );

  it('keeps a non-safety-relevant replenishment row under an exact reproductive status', () => {
    const vitaminC = item({
      id: 'vitamin-c',
      name: 'Vitamin C serum',
      role: 'antioxidant',
      tags: ['vitamin_c'],
    });
    const result = recommend(
      input({
        profile: {
          sensitivity: 'neutral',
          pregnancy: true,
          reproductiveStatus: 'pregnant',
          goals: [],
        },
        shelf: [cleanser, moisturiser, spf, vitaminC],
        replenishment: [replenishment(vitaminC, 'finished')],
        conflictCoverageStatus: 'unsupported_unreviewed',
      }),
    );

    expect(
      result.recommendations.some(
        (rec) => rec.trigger === 'replacement' && rec.relatedProductId === vitaminC.id,
      ),
    ).toBe(true);
  });
});

describe('dismissed suggestions never re-surface ("not for me")', () => {
  it('filters a dismissed recommendation by stable id', () => {
    const base = input({
      profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging'] },
      shelf: [cleanser, moisturiser, niacinamide],
    });
    const before = recommend(base);
    const dismissedId = before.recommendations[0]!.id;
    const after = recommend({ ...base, dismissed: new Set([dismissedId]) });
    expect(after.recommendations.some((r) => r.id === dismissedId)).toBe(false);
  });
});

describe('the launch gate withholds medically-adjacent goal actives in production (B-DERM-REVIEW)', () => {
  it('RECS_REVIEWED is false (parity with the conflict-matrix + PAO gates)', () => {
    expect(RECS_REVIEWED).toBe(false);
  });

  it('in production only structural routine-completeness types ship; goal actives are withheld', () => {
    const prev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const shippable = shippableRecTypes();
      expect(shippable.every((t) => !t.medicalAdjacent)).toBe(true);
      expect(shippable.some((t) => t.role === 'spf')).toBe(true); // structural SPF still ships
      expect(shippable.some((t) => t.type === 'retinoid_serum')).toBe(false);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = prev;
    }
  });
});

describe('church and state. No commercial field exists in the ranking output (D-054)', () => {
  it('a recommendation carries only merit + explainability fields, never commerce', () => {
    const res = recommend(
      input({
        profile: { sensitivity: 'sensitive', pregnancy: false, goals: ['anti_aging'] },
        shelf: [cleanser, moisturiser, niacinamide],
      }),
    );
    const rec = res.recommendations[0]!;
    const keys = Object.keys(rec).join(' ').toLowerCase();
    for (const banned of [
      'commission',
      'affiliate',
      'partnership',
      'brand_deal',
      'sponsor',
      'payout',
      'revenue',
    ]) {
      expect(keys).not.toContain(banned);
    }
  });
});
