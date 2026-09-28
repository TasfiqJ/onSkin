import { isReviewedRule, type ConflictRule } from '@/features/intelligence/conflictRuleCorpus.v1';
import { env } from '@/lib/env';
import { normalizePublicDomain } from '@/lib/growth/attribution';

import {
  CONFLICT_SHARE_PUBLIC_COPY,
  parseConflictShareProjection,
  type ConflictShareProjection,
} from './shareProjection';

/**
 * Builds public card data from the canonical reviewed rule only. Product and
 * account objects are deliberately absent from this API: a user may choose a
 * reviewed finding, but product names, shelf identifiers, profile facts,
 * notes, photos, citations, and reviewer metadata never enter the projection.
 */
export function buildReviewedConflictShareProjection(
  rule: Partial<ConflictRule>,
): ConflictShareProjection | null {
  if (!isReviewedRule(rule)) return null;
  const admittedRule = rule as ConflictRule;

  const finalDomain = normalizePublicDomain(env.finalBrandDomain);
  if (!finalDomain || finalDomain !== CONFLICT_SHARE_PUBLIC_COPY.attributionLabel) return null;

  return parseConflictShareProjection({
    schemaVersion: 1,
    brandName: CONFLICT_SHARE_PUBLIC_COPY.brandName,
    eyebrow: CONFLICT_SHARE_PUBLIC_COPY.eyebrow,
    title: admittedRule.copy.shareTitle,
    severityLabel: admittedRule.copy.severityLabel,
    evidenceLabel: CONFLICT_SHARE_PUBLIC_COPY.evidenceLabel,
    claim: admittedRule.copy.shareClaim,
    actionLabel: CONFLICT_SHARE_PUBLIC_COPY.actionLabel,
    attributionLabel: finalDomain,
    disclaimer: CONFLICT_SHARE_PUBLIC_COPY.disclaimer,
    tone:
      admittedRule.interactionType === 'synergy' || admittedRule.interactionType === 'myth'
        ? 'reassuring'
        : 'caution',
  });
}
