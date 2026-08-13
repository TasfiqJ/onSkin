import { describe, expect, it } from 'vitest';

import { winBackOfferingDecision } from './winBackOfferingPolicy';

describe('win-back offering policy', () => {
  it('keeps the CTA inert until the offering query resolves', () => {
    expect(winBackOfferingDecision(undefined)).toBe('loading');
  });

  it('purchases only an exact available native offer', () => {
    expect(winBackOfferingDecision({ status: 'available', winBack: { canPurchase: true } })).toBe(
      'purchase',
    );
    expect(winBackOfferingDecision({ status: 'available', winBack: { canPurchase: false } })).toBe(
      'fallback',
    );
  });

  it('falls back only after a resolved no-offer or unavailable response', () => {
    expect(winBackOfferingDecision({ status: 'available', winBack: null })).toBe('fallback');
    expect(winBackOfferingDecision({ status: 'unavailable', winBack: null })).toBe('fallback');
  });
});
