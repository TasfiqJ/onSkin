import type { FunctionalTag, PregnancyStatus } from '@onskin/types';

import { shippableRules, type ConflictRule } from './rules';

export type PregnancySafetyStatus = PregnancyStatus | 'unknown';
export type PregnancySafetyMode = 'clear' | 'caution';
export type PregnancySafetyReason = 'retinoid' | 'hydroquinone' | 'bha_not_confirmed_low';

export type PregnancySafetyCandidate = {
  tags: readonly FunctionalTag[];
  concentration?: 'low' | 'high';
};

function hasReviewedSafetyRule(tag: FunctionalTag, rules: readonly ConflictRule[]): boolean {
  return rules.some(
    (rule) =>
      rule.interactionType === 'safety' &&
      ((rule.tagA === tag && rule.tagB === 'pregnancy') ||
        (rule.tagA === 'pregnancy' && rule.tagB === tag)),
  );
}

/** Pregnancy-caution products require a successfully read, explicit `none`. */
export function pregnancySafetyModeForStatus(status: PregnancySafetyStatus): PregnancySafetyMode {
  return status === 'none' ? 'clear' : 'caution';
}

/** Safety exclusions derived only from the launch-gated docs/02 rule set. */
export function pregnancySafetyReasonForProduct(
  product: PregnancySafetyCandidate,
  mode: PregnancySafetyMode,
  rules: readonly ConflictRule[] = shippableRules(),
): PregnancySafetyReason | null {
  if (mode === 'clear') return null;

  const tags = new Set(product.tags);
  if (tags.has('retinoid') && hasReviewedSafetyRule('retinoid', rules)) return 'retinoid';
  if (tags.has('hydroquinone') && hasReviewedSafetyRule('hydroquinone', rules)) {
    return 'hydroquinone';
  }
  if (tags.has('bha') && product.concentration !== 'low' && hasReviewedSafetyRule('bha', rules)) {
    return 'bha_not_confirmed_low';
  }
  return null;
}
