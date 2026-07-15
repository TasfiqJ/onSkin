export type TrialEligibility = 'eligible' | 'ineligible' | 'unknown';

/**
 * RevenueCat only computes introductory-offer eligibility on iOS. Fail closed
 * for every other platform and for any status the SDK cannot prove exactly.
 */
export function mapRevenueCatTrialEligibility(
  platform: string,
  status: number | null | undefined,
): TrialEligibility {
  if (platform !== 'ios') return 'unknown';
  if (status === 2) return 'eligible';
  if (status === 1 || status === 3) return 'ineligible';
  return 'unknown';
}
