import { describe, expect, it } from 'vitest';

import {
  comparableWinBackPercentOff,
  revenueCatOfferDurationLabel,
  revenueCatPeriodLabel,
} from './revenuecatWinBackTerms';

describe('RevenueCat win-back commercial terms', () => {
  it('keeps the per-cycle billing period separate from the total offer duration', () => {
    const offer = { periodUnit: 'MONTH', periodNumberOfUnits: 2, cycles: 3 };

    expect(revenueCatPeriodLabel(offer)).toBe('2 months');
    expect(revenueCatOfferDurationLabel(offer)).toBe('6 months');
    expect(
      revenueCatOfferDurationLabel({
        periodUnit: 'YEAR',
        periodNumberOfUnits: 1,
        cycles: 1,
      }),
    ).toBe('1 year');
  });

  it('omits percent-off when the offer and standard product periods differ', () => {
    expect(
      comparableWinBackPercentOff({
        offerPeriod: 'P1M',
        standardPeriod: 'P1Y',
        offerPrice: 4.99,
        standardPrice: 49.99,
      }),
    ).toBeNull();
    expect(
      comparableWinBackPercentOff({
        offerPeriod: 'P1Y',
        standardPeriod: 'P1Y',
        offerPrice: 34.99,
        standardPrice: 49.99,
      }),
    ).toBe(30);
  });

  it('fails closed for malformed period and price metadata', () => {
    expect(
      revenueCatOfferDurationLabel({
        periodUnit: 'UNKNOWN',
        periodNumberOfUnits: 1,
        cycles: 1,
      }),
    ).toBeNull();
    expect(
      revenueCatPeriodLabel({ periodUnit: 'MONTH', periodNumberOfUnits: 0 }),
    ).toBeNull();
    expect(
      comparableWinBackPercentOff({
        offerPeriod: 'P1Y',
        standardPeriod: 'P1Y',
        offerPrice: Number.NaN,
        standardPrice: 49.99,
      }),
    ).toBeNull();
  });
});
