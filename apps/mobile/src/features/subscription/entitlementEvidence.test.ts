import { describe, expect, it } from 'vitest';

import { shouldLoadContextualOffering, type StoredEntitlement } from './entitlement';
import {
  ENTITLEMENT_OFFLINE_GRACE_MS,
  ENTITLEMENT_RECONCILIATION_INTERVAL_MS,
  ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS,
  classifyEntitlementEvidence,
  resolveEntitlementCacheRead,
} from './entitlementEvidence';

const NOW_MS = Date.parse('2026-07-05T12:00:00.000Z');
const NOW = new Date(NOW_MS).toISOString();

function entitlement(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'routinekind_pro_annual',
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: '2026-06-05T12:00:00.000Z',
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: NOW,
    offeringId: null,
    packageId: null,
    storeUserId: 'owner-a',
    priceLabel: null,
    ...overrides,
  };
}

function verifiedAtAge(ageMs: number): string {
  return new Date(NOW_MS - ageMs).toISOString();
}

describe('entitlement cache evidence policy', () => {
  it.each([
    [ENTITLEMENT_RECONCILIATION_INTERVAL_MS - 1, 'fresh'],
    [ENTITLEMENT_RECONCILIATION_INTERVAL_MS, 'reconciliation_due'],
    [ENTITLEMENT_OFFLINE_GRACE_MS - 1, 'reconciliation_due'],
    [ENTITLEMENT_OFFLINE_GRACE_MS, 'stale'],
  ] as const)('classifies exact store-evidence age %s as %s', (ageMs, expected) => {
    expect(
      classifyEntitlementEvidence(entitlement({ verifiedAt: verifiedAtAge(ageMs) }), NOW, 'production'),
    ).toBe(expected);
  });

  it('allows at most five minutes of provider clock skew and clamps its age to zero', () => {
    expect(
      classifyEntitlementEvidence(
        entitlement({
          verifiedAt: new Date(NOW_MS + ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS).toISOString(),
        }),
        NOW,
        'production',
      ),
    ).toBe('fresh');
    expect(
      classifyEntitlementEvidence(
        entitlement({
          verifiedAt: new Date(
            NOW_MS + ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS + 1,
          ).toISOString(),
        }),
        NOW,
        'production',
      ),
    ).toBe('invalid');
  });

  it('keeps a verified app-granted reverse trial authorized beyond 72 hours until exact expiry', () => {
    const reverseTrial = entitlement({
      periodType: 'reverse_trial',
      store: 'app_granted',
      willRenew: false,
      source: 'server',
      verifiedAt: verifiedAtAge(ENTITLEMENT_OFFLINE_GRACE_MS + 24 * 60 * 60 * 1_000),
      expiresAt: new Date(NOW_MS + 1).toISOString(),
    });

    expect(classifyEntitlementEvidence(reverseTrial, NOW, 'production')).toBe(
      'reconciliation_due',
    );
    expect(
      resolveEntitlementCacheRead(
        { status: 'available', entitlement: reverseTrial },
        NOW,
        'production',
      ),
    ).toMatchObject({ isPro: true, evidenceStatus: 'reconciliation_due', expired: false });

    const atExpiry = { ...reverseTrial, expiresAt: NOW };
    expect(classifyEntitlementEvidence(atExpiry, NOW, 'production')).toBe('expired');
    expect(
      resolveEntitlementCacheRead(
        { status: 'available', entitlement: atExpiry },
        NOW,
        'production',
      ),
    ).toMatchObject({ isPro: false, evidenceStatus: 'expired', expired: true });
  });

  it.each([
    ['missing verification time', { verifiedAt: null }, 'production'],
    ['client-cache source', { source: 'local_cache' }, 'production'],
    ['missing source', { source: null }, 'production'],
    ['development proof in staging', { environment: 'development' }, 'staging'],
    [
      'Test Store proof in production',
      { store: 'test_store', environment: 'test_store' },
      'production',
    ],
    [
      'malformed app grant',
      { source: 'server', store: 'app_granted', periodType: 'normal' },
      'development',
    ],
  ] as const)('rejects %s', (_label, overrides, appEnvironment) => {
    expect(
      classifyEntitlementEvidence(
        entitlement(overrides as Partial<StoredEntitlement>),
        NOW,
        appEnvironment,
      ),
    ).toBe('invalid');
  });

  it('classifies authoritative inactive evidence as expired', () => {
    expect(
      classifyEntitlementEvidence(entitlement({ isActive: false }), NOW, 'production'),
    ).toBe('expired');
  });

  it.each(['stale', 'invalid', 'unavailable', 'corrupt', 'unsupported_version'] as const)(
    'keeps %s evidence uncertain instead of presenting an ordinary paywall',
    (status) => {
      const state =
        status === 'stale' || status === 'invalid'
          ? resolveEntitlementCacheRead(
              {
                status: 'available',
                entitlement:
                  status === 'stale'
                    ? entitlement({ verifiedAt: verifiedAtAge(ENTITLEMENT_OFFLINE_GRACE_MS) })
                    : entitlement({ verifiedAt: null }),
              },
              NOW,
              'production',
            )
          : resolveEntitlementCacheRead({ status, entitlement: null }, NOW, 'production');

      expect(state).toMatchObject({ isPro: false, expired: false, evidenceStatus: status });
      expect(shouldLoadContextualOffering(state)).toBe(false);
    },
  );

  it('requires a RevenueCat empty watermark to satisfy the clock-skew policy', () => {
    const valid = resolveEntitlementCacheRead(
      {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: { verifiedAt: NOW },
      },
      NOW,
      'production',
    );
    const future = resolveEntitlementCacheRead(
      {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: {
          verifiedAt: new Date(
            NOW_MS + ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS + 1,
          ).toISOString(),
        },
      },
      NOW,
      'production',
    );

    expect(valid).toMatchObject({
      isPro: false,
      source: 'revenuecat',
      verifiedAt: NOW,
      evidenceStatus: 'absent',
    });
    expect(future).toMatchObject({
      isPro: false,
      source: 'revenuecat',
      evidenceStatus: 'invalid',
    });
    expect(shouldLoadContextualOffering(future)).toBe(false);
  });

  it('ages a RevenueCat empty watermark into uncertainty at the 72-hour boundary', () => {
    const before = resolveEntitlementCacheRead(
      {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: {
          verifiedAt: new Date(NOW_MS - ENTITLEMENT_OFFLINE_GRACE_MS + 1).toISOString(),
          storeUserId: 'owner-a',
        },
      },
      NOW,
      'production',
    );
    const atBoundary = resolveEntitlementCacheRead(
      {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: {
          verifiedAt: new Date(NOW_MS - ENTITLEMENT_OFFLINE_GRACE_MS).toISOString(),
          storeUserId: 'owner-a',
        },
      },
      NOW,
      'production',
    );

    expect(before).toMatchObject({
      isPro: false,
      evidenceStatus: 'absent',
      source: 'revenuecat',
    });
    expect(before.evidenceIdentity).not.toBeNull();
    expect(atBoundary).toMatchObject({
      isPro: false,
      evidenceStatus: 'stale',
      source: 'revenuecat',
    });
    expect(shouldLoadContextualOffering(atBoundary)).toBe(false);
  });
});
