import { describe, expect, it } from 'vitest';

import type { StoredEntitlement } from './entitlement';
import { prepareRevenueCatActionProof } from './entitlementPurchaseAttribution';

function proof(productId = 'annual-old'): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId,
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: '2026-07-05T12:00:00.000Z',
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: '2026-07-05T12:00:00.000Z',
    offeringId: null,
    packageId: null,
    storeUserId: 'owner-a',
    priceLabel: null,
  };
}

describe('RevenueCat paid-action attribution', () => {
  it('attaches commercial terms only for an exact classified product match', () => {
    expect(
      prepareRevenueCatActionProof(proof('annual-new'), {
        productId: 'annual-new',
        packageId: '$rc_annual',
        offeringId: 'default',
        renewalPriceLabel: '$49.99',
      }),
    ).toMatchObject({
      actionProductMatched: true,
      entitlement: {
        productId: 'annual-new',
        packageId: '$rc_annual',
        offeringId: 'default',
        priceLabel: '$49.99',
      },
    });
  });

  it('publishes stale CustomerInfo proof without action attribution on mismatch', () => {
    const stale = proof('annual-old');
    expect(
      prepareRevenueCatActionProof(stale, {
        productId: 'annual-new',
        packageId: '$rc_annual',
        offeringId: 'default',
        renewalPriceLabel: '$49.99',
      }),
    ).toEqual({ entitlement: stale, actionProductMatched: false });
  });

  it('keeps non-action restore proof publishable without minting attribution', () => {
    const restored = proof();
    expect(prepareRevenueCatActionProof(restored, {})).toEqual({
      entitlement: restored,
      actionProductMatched: true,
    });
  });
});
