import { describe, expect, it } from 'vitest';

import type { SubscriptionOfferingView, SubscriptionPackageView } from '@/lib/iap/revenuecat';

import { planLineLabel, planPriceDisplay } from './priceDisplay';

function packageView(overrides: Partial<SubscriptionPackageView> = {}): SubscriptionPackageView {
  return {
    plan: 'annual',
    packageId: 'pkg',
    offeringId: 'offering',
    productId: 'routinekind_pro_annual_dev',
    title: 'OnSkin Pro Annual',
    priceLabel: '$59.99',
    pricePerMonthLabel: '$4.99',
    periodLabel: 'year',
    subscriptionPeriod: 'P1Y',
    trialDays: 14,
    introLabel: '14 days free',
    canPurchase: true,
    ...overrides,
  };
}

describe('subscription price display', () => {
  it('withholds static fallback labels while the offering is still loading', () => {
    for (const plan of ['annual', 'monthly'] as const) {
      const display = planPriceDisplay(plan, undefined);

      expect(display.introLabel).toBe('Store pricing');
      expect(display.priceLabel).toBe('Checking price');
      expect(display.priceLabel).not.toMatch(/\$\d/);
      expect(display.periodLabel).toBeNull();
      expect(display.pricePerMonthLabel).toBeNull();
      expect(display.canShowPurchasePrice).toBe(false);
      expect(planLineLabel(display)).toBe('Checking price');
    }
  });

  it('uses RevenueCat package labels when available', () => {
    const offering: SubscriptionOfferingView = {
      status: 'available',
      offeringId: 'current',
      annual: packageView(),
      monthly: packageView({ plan: 'monthly', priceLabel: '$9.99', periodLabel: 'month' }),
      winBack: null,
    };

    const display = planPriceDisplay('annual', offering);

    expect(display.priceLabel).toBe('$59.99');
    expect(display.pricePerMonthLabel).toBe('$4.99');
    expect(display.reason).toBeNull();
    expect(planLineLabel(display)).toBe('$59.99/year');
  });

  it('keeps development fallback pricing with a user-facing disabled-store reason', () => {
    const offering: SubscriptionOfferingView = {
      status: 'development_fallback',
      offeringId: 'development-fallback',
      annual: packageView({
        priceLabel: '$49.99',
        pricePerMonthLabel: '$4.16',
        canPurchase: false,
      }),
      monthly: packageView({
        plan: 'monthly',
        priceLabel: '$8.99',
        periodLabel: 'month',
        canPurchase: false,
      }),
      winBack: null,
      reason: 'Store checkout is unavailable in this preview. You can keep exploring.',
    };

    const display = planPriceDisplay('annual', offering);

    expect(display.priceLabel).toBe('$49.99');
    expect(display.reason).toBe(
      'Store checkout is unavailable in this preview. You can keep exploring.',
    );
    expect(display.reason).not.toContain('RevenueCat');
    expect(display.canShowPurchasePrice).toBe(true);
  });

  it('never formats unavailable pricing as a slash-period price', () => {
    const offering: SubscriptionOfferingView = {
      status: 'unavailable',
      offeringId: null,
      annual: null,
      monthly: null,
      winBack: null,
      reason: 'Store checkout is unavailable right now. Please try again later.',
    };

    const display = planPriceDisplay('annual', offering);

    expect(display.priceLabel).toBe('Price unavailable');
    expect(display.periodLabel).toBeNull();
    expect(display.canShowPurchasePrice).toBe(false);
    expect(planLineLabel(display)).toBe('Price unavailable');
  });
});
