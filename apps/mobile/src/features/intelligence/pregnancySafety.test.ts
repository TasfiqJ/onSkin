import { describe, expect, it } from 'vitest';

import {
  STARTER_RULES,
  type ConflictConstraint,
  type ConflictParticipantApplicability,
  type ConflictRule,
} from './rules';
import {
  pregnancySafetyEvaluationForProduct,
  pregnancySafetyModeForStatus,
  pregnancySafetyReasonForProduct,
} from './pregnancySafety';

const notApplicable = { status: 'not_applicable' } as const;
const exact = <T>(value: T): ConflictConstraint<T> => ({ status: 'exact', value });

function participant(
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

function admittedPregnantTretinoinRule(): ConflictRule {
  const source = STARTER_RULES.find(
    (rule) => rule.interactionType === 'safety' && rule.tagA === 'retinoid',
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
        tagA: participant({
          moleculeIds: exact(['tretinoin']),
          finishedFormulationIds: exact(['tretinoin-gel-0.025']),
        }),
        tagB: participant(),
        reproductiveContexts: exact(['pregnant']),
      },
      safetyContexts: ['pregnant'],
    },
  };
}

describe('pregnancy safety clearance', () => {
  it.each([
    ['none', 'clear'],
    ['pregnant', 'caution'],
    ['breastfeeding', 'caution'],
    ['prefer_not', 'caution'],
    ['unknown', 'caution'],
  ] as const)('maps %s to %s for the legacy display posture', (status, expected) => {
    expect(pregnancySafetyModeForStatus(status)).toBe(expected);
  });

  it('requires exact admitted molecule, formulation, and pregnant context', () => {
    const rule = admittedPregnantTretinoinRule();
    const product = {
      id: 'tretinoin-gel',
      name: 'Tretinoin 0.025% gel',
      tags: ['retinoid'] as const,
      applicabilityFacts: {
        moleculeIds: ['tretinoin'],
        finishedFormulationId: 'tretinoin-gel-0.025',
      },
    };

    expect(pregnancySafetyEvaluationForProduct(product, 'pregnant', [rule])).toEqual({
      status: 'reviewed_exclusion',
      reason: 'retinoid',
    });
    expect(pregnancySafetyReasonForProduct(product, 'pregnant', [rule])).toBe('retinoid');
  });

  it('withholds generically without widening the pregnancy reason to another context', () => {
    const rule = admittedPregnantTretinoinRule();
    const product = {
      tags: ['retinoid'] as const,
      applicabilityFacts: {
        moleculeIds: ['tretinoin'],
        finishedFormulationId: 'tretinoin-gel-0.025',
      },
    };

    for (const status of ['breastfeeding', 'unknown', 'prefer_not', 'trying', 'caution'] as const) {
      expect(pregnancySafetyEvaluationForProduct(product, status, [rule])).toEqual({
        status: 'unsupported_reproductive_context',
        reason: null,
      });
      expect(pregnancySafetyReasonForProduct(product, status, [rule])).toBeNull();
    }
  });

  it('distinguishes an unrelated retinoid or formulation from exact tretinoin gel', () => {
    const rule = admittedPregnantTretinoinRule();

    expect(
      pregnancySafetyEvaluationForProduct(
        {
          tags: ['retinoid'],
          applicabilityFacts: {
            moleculeIds: ['retinol'],
            finishedFormulationId: 'retinol-serum',
          },
        },
        'pregnant',
        [rule],
      ),
    ).toEqual({ status: 'not_applicable', reason: null });
    expect(
      pregnancySafetyEvaluationForProduct(
        {
          tags: ['retinoid'],
          applicabilityFacts: {
            moleculeIds: ['tretinoin'],
            finishedFormulationId: 'tretinoin-cream-0.05',
          },
        },
        'pregnant',
        [rule],
      ),
    ).toEqual({ status: 'not_applicable', reason: null });
  });

  it('fails closed without inventing a reviewed reason when exact facts are missing', () => {
    const rule = admittedPregnantTretinoinRule();
    expect(pregnancySafetyEvaluationForProduct({ tags: ['retinoid'] }, 'pregnant', [rule])).toEqual(
      {
        status: 'unsupported_missing_facts',
        reason: null,
      },
    );
    expect(pregnancySafetyReasonForProduct({ tags: ['retinoid'] }, 'pregnant', [rule])).toBeNull();
  });

  it('preserves zero admission and ignores candidate-only rows', () => {
    expect(pregnancySafetyEvaluationForProduct({ tags: ['retinoid'] }, 'pregnant', [])).toEqual({
      status: 'not_applicable',
      reason: null,
    });
    expect(
      pregnancySafetyEvaluationForProduct(
        {
          tags: ['retinoid'],
          applicabilityFacts: {
            moleculeIds: ['tretinoin'],
            finishedFormulationId: 'tretinoin-gel-0.025',
          },
        },
        'pregnant',
        STARTER_RULES,
      ),
    ).toEqual({ status: 'not_applicable', reason: null });
  });
});
