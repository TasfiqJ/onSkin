import { describe, expect, it } from 'vitest';

import type { StoredEntitlement } from './entitlement';
import { activeResult } from './entitlementActionResult';
import { ENTITLEMENT_OFFLINE_GRACE_MS } from './entitlementEvidence';

const NOW = '2026-07-05T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);

function entitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    verifiedAt: NOW,
    ...overrides,
  };
}

describe('entitlement action result', () => {
  it('does not report stale or evidence-invalid rows as active', () => {
    const stale = entitlement({
      verifiedAt: new Date(NOW_MS - ENTITLEMENT_OFFLINE_GRACE_MS).toISOString(),
    });
    const future = entitlement({ verifiedAt: '2026-07-05T12:05:00.001Z' });
    const malformedTimeBox = entitlement({ periodType: 'trial', expiresAt: null });

    expect(activeResult(stale, undefined, { nowISO: NOW, appEnvironment: 'production' }).active).toBe(
      false,
    );
    expect(
      activeResult(future, undefined, { nowISO: NOW, appEnvironment: 'production' }).active,
    ).toBe(false);
    expect(
      activeResult(malformedTimeBox, undefined, {
        nowISO: NOW,
        appEnvironment: 'production',
      }).active,
    ).toBe(false);
  });

  it('reports valid current proof active while retaining honest restore metadata', () => {
    expect(
      activeResult(
        entitlement(),
        { storePurchaseFound: false },
        { nowISO: NOW, appEnvironment: 'production' },
      ),
    ).toMatchObject({
      active: true,
      storePurchaseFound: false,
      entitlement: { productId: 'routinekind_pro_annual' },
    });
  });
});
