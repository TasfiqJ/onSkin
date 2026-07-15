import { describe, expect, it } from 'vitest';

import { deriveState, type StoredEntitlement } from './entitlement';
import { selectLatestAuthoritativeEntitlementEvidence } from './entitlementOrdering';

function evidence(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'current',
    expiresAt: null,
    willRenew: true,
    grantedAt: '2026-06-05T12:00:00.000Z',
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: '2026-07-05T12:02:00.000Z',
    offeringId: null,
    packageId: null,
    storeUserId: 'owner-a',
    priceLabel: null,
    ...overrides,
  };
}

describe('authoritative entitlement evidence ordering', () => {
  it('retains current evidence for older or equal authoritative timestamps', () => {
    const current = evidence();
    expect(
      selectLatestAuthoritativeEntitlementEvidence(
        current,
        evidence({ verifiedAt: '2026-07-05T12:01:00.000Z' }),
      ),
    ).toBe(current);
    expect(
      selectLatestAuthoritativeEntitlementEvidence(
        current,
        evidence({ productId: 'equal-duplicate' }),
      ),
    ).toBe(current);
  });

  it('accepts newer inactive evidence', () => {
    const incoming = evidence({
      isActive: false,
      productId: 'newer-revocation',
      verifiedAt: '2026-07-05T12:03:00.000Z',
    });
    expect(selectLatestAuthoritativeEntitlementEvidence(evidence(), incoming)).toBe(incoming);
  });

  it('accepts deterministic ageing of the exact same equal-time proof', () => {
    const proof = evidence({ expiresAt: '2026-07-10T12:00:00.000Z' });
    const fresh = deriveState(proof, '2026-07-05T12:00:00.000Z', 'fresh');
    const reconciliationDue = { ...fresh, evidenceStatus: 'reconciliation_due' as const };
    const fewerDays = deriveState(proof, '2026-07-06T12:00:00.000Z', 'fresh');
    const expired = deriveState(proof, '2026-07-10T12:00:00.000Z', 'expired');

    expect(selectLatestAuthoritativeEntitlementEvidence(fresh, reconciliationDue)).toBe(
      reconciliationDue,
    );
    expect(selectLatestAuthoritativeEntitlementEvidence(fresh, fewerDays)).toBe(fewerDays);
    expect(selectLatestAuthoritativeEntitlementEvidence(fresh, expired)).toBe(expired);
  });

  it('prefers an access-reducing conflicting equal-time derived proof', () => {
    const current = deriveState(
      evidence({ productId: 'current', expiresAt: '2026-07-10T12:00:00.000Z' }),
      '2026-07-05T12:00:00.000Z',
      'fresh',
    );
    const conflicting = deriveState(
      evidence({ productId: 'conflict', expiresAt: '2026-07-09T12:00:00.000Z' }),
      '2026-07-10T12:00:00.000Z',
      'expired',
    );

    expect(selectLatestAuthoritativeEntitlementEvidence(current, conflicting)).toBe(conflicting);
  });

  it('makes equal-time conflicts conservatively access-reducing', () => {
    const active = evidence();
    const inactive = evidence({ isActive: false, productId: 'equal-revocation' });

    expect(selectLatestAuthoritativeEntitlementEvidence(active, inactive)).toBe(inactive);
    expect(selectLatestAuthoritativeEntitlementEvidence(inactive, active)).toBe(inactive);
  });
});
