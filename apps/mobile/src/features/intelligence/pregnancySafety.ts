import type { FunctionalTag, PregnancyStatus } from '@layerwell/types';

import { evaluateExactApplicabilityForReview, type EngineProduct } from './engine';
import { shippableRules, type ConflictRule } from './rules';

export type PregnancySafetyStatus = PregnancyStatus | 'unknown';
export type PregnancySafetyMode = 'clear' | 'caution';
export type PregnancySafetyReason = 'retinoid' | 'hydroquinone' | 'bha_not_confirmed_low';

export type PregnancySafetyCandidate = {
  id?: string;
  name?: string;
  tags: readonly FunctionalTag[];
  /** Legacy display band only. Exact reviewed applicability never infers from it. */
  concentration?: 'low' | 'high';
  applicabilityFacts?: EngineProduct['applicabilityFacts'];
};

export type PregnancySafetyEvaluation =
  | { status: 'reviewed_exclusion'; reason: PregnancySafetyReason }
  | { status: 'unsupported_missing_facts'; reason: null }
  | { status: 'unsupported_reproductive_context'; reason: null }
  | { status: 'not_applicable'; reason: null };

/** Pregnancy-caution products require a successfully read, explicit `none`. */
export function pregnancySafetyModeForStatus(status: PregnancySafetyStatus): PregnancySafetyMode {
  return status === 'none' ? 'clear' : 'caution';
}

function reasonForSafetyRule(rule: ConflictRule): PregnancySafetyReason | null {
  const activeTag = rule.tagA === 'pregnancy' ? rule.tagB : rule.tagA;
  if (activeTag === 'retinoid') return 'retinoid';
  if (activeTag === 'hydroquinone') return 'hydroquinone';
  if (activeTag === 'bha') return 'bha_not_confirmed_low';
  return null;
}

/**
 * Evaluate a product against exact, admitted safety applicability. Missing
 * molecule/formulation/exposure facts are distinct from a reviewed exclusion:
 * callers can withhold a recommendation without inventing a safety claim.
 */
export function pregnancySafetyEvaluationForProduct(
  product: PregnancySafetyCandidate,
  status: PregnancySafetyStatus | PregnancySafetyMode | 'trying',
  rules: readonly ConflictRule[] = shippableRules(),
): PregnancySafetyEvaluation {
  // A broad legacy caution bit is not an exact reproductive context and cannot
  // borrow pregnancy guidance. Current persistence deliberately supplies the
  // combined pregnant-or-trying answer as `pregnant`.
  if (status === 'none' || status === 'clear') {
    return { status: 'not_applicable', reason: null };
  }

  const candidate: EngineProduct = {
    id: product.id ?? '__safety_candidate__',
    name: product.name ?? 'Safety candidate',
    tags: [...product.tags],
    applicabilityFacts: product.applicabilityFacts,
  };
  const safetyContext: EngineProduct = {
    id: '__pregnancy__',
    name: 'Pregnant or trying safety setting',
    tags: ['pregnancy'],
  };
  let hasMissingFacts = false;
  let hasUnsupportedContext = false;

  for (const rule of rules) {
    if (
      rule.interactionType !== 'safety' ||
      rule.applicability.reviewStatus !== 'reviewed' ||
      rule.admission?.status !== 'approved' ||
      rule.applicability.approvedConditions.reproductiveContexts.status !== 'exact'
    ) {
      continue;
    }
    const reason = reasonForSafetyRule(rule);
    if (!reason) continue;
    const productOnlyConditions = {
      ...rule.applicability.approvedConditions,
      reproductiveContexts: { status: 'not_applicable' } as const,
    };
    const productEvaluation = evaluateExactApplicabilityForReview(
      rule,
      productOnlyConditions,
      candidate,
      safetyContext,
    );
    if (productEvaluation === 'does_not_match') continue;
    if (productEvaluation === 'missing_facts') {
      hasMissingFacts = true;
      continue;
    }
    if (status !== 'pregnant') {
      hasUnsupportedContext = true;
      continue;
    }
    const evaluation = evaluateExactApplicabilityForReview(
      rule,
      rule.applicability.approvedConditions,
      candidate,
      safetyContext,
      status,
    );
    if (evaluation === 'matches') return { status: 'reviewed_exclusion', reason };
    if (evaluation === 'missing_facts') hasMissingFacts = true;
  }

  return hasMissingFacts
    ? { status: 'unsupported_missing_facts', reason: null }
    : hasUnsupportedContext
      ? { status: 'unsupported_reproductive_context', reason: null }
      : { status: 'not_applicable', reason: null };
}

/** Exact reviewed reason only; never returns a reason for missing facts. */
export function pregnancySafetyReasonForProduct(
  product: PregnancySafetyCandidate,
  status: PregnancySafetyStatus | PregnancySafetyMode | 'trying',
  rules: readonly ConflictRule[] = shippableRules(),
): PregnancySafetyReason | null {
  const evaluation = pregnancySafetyEvaluationForProduct(product, status, rules);
  return evaluation.status === 'reviewed_exclusion' ? evaluation.reason : null;
}
