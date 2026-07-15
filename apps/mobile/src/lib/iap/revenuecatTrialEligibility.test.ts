import { describe, expect, it } from 'vitest';

import { mapRevenueCatTrialEligibility } from './revenuecatTrialEligibility';

describe('RevenueCat trial eligibility mapping', () => {
  it('accepts only the exact iOS eligible status', () => {
    expect(mapRevenueCatTrialEligibility('ios', 2)).toBe('eligible');
    expect(mapRevenueCatTrialEligibility('ios', 1)).toBe('ineligible');
    expect(mapRevenueCatTrialEligibility('ios', 3)).toBe('ineligible');
  });

  it('fails closed for unknown, malformed, Android, and web results', () => {
    for (const status of [undefined, null, 0, -1, 4, Number.NaN]) {
      expect(mapRevenueCatTrialEligibility('ios', status)).toBe('unknown');
    }
    expect(mapRevenueCatTrialEligibility('android', 2)).toBe('unknown');
    expect(mapRevenueCatTrialEligibility('web', 2)).toBe('unknown');
  });
});
