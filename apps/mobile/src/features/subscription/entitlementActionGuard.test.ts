import { describe, expect, it } from 'vitest';

import { deriveState, type StoredEntitlement } from './entitlement';
import {
  ENTITLEMENT_ACTION_PRECONDITION_FAILED,
  assertEntitlementActionAllowed,
  type EntitlementActionInput,
} from './entitlementActionGuard';

const NOW = '2026-07-05T12:00:00.000Z';

function proof(overrides: Partial<StoredEntitlement> = {}): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId: 'annual',
    expiresAt: '2027-07-05T12:00:00.000Z',
    willRenew: true,
    grantedAt: NOW,
    source: 'revenuecat',
    environment: 'production',
    managementUrl: null,
    verifiedAt: NOW,
    offeringId: null,
    packageId: null,
    storeUserId: 'owner-a',
    priceLabel: '$49.99',
    ...overrides,
  };
}

function input(
  kind: EntitlementActionInput['kind'],
  expectedEvidenceIdentity: string | null,
): EntitlementActionInput {
  return { kind, expectedEvidenceIdentity };
}

describe('entitlement action commit guard', () => {
  it('allows null identity only for exact authoritative first-use absence', () => {
    const absent = deriveState(null, NOW, 'absent');
    expect(() =>
      assertEntitlementActionAllowed(
        absent,
        input('onboarding_purchase', null),
        ['onboarding_purchase'],
      ),
    ).not.toThrow();

    for (const state of [
      deriveState(null, NOW, 'unavailable'),
      deriveState(null, NOW, 'stale'),
      deriveState(proof(), NOW, 'fresh'),
    ]) {
      expect(() =>
        assertEntitlementActionAllowed(
          state,
          input('onboarding_purchase', null),
          ['onboarding_purchase'],
        ),
      ).toThrow(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
    }
  });

  it('rejects stale identities and active paid access before a native purchase', () => {
    const active = deriveState(proof(), NOW, 'fresh');
    expect(() =>
      assertEntitlementActionAllowed(
        active,
        input('upsell_purchase', active.evidenceIdentity),
        ['upsell_purchase'],
      ),
    ).toThrow(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
    expect(() =>
      assertEntitlementActionAllowed(
        deriveState(null, NOW, 'absent'),
        input('upsell_purchase', 'stale-screen-proof'),
        ['upsell_purchase'],
      ),
    ).toThrow(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
  });

  it('rejects reoffer purchase for historical app-granted reverse-trial evidence', () => {
    const reverseTrial = deriveState(
      proof({
        periodType: 'reverse_trial',
        store: 'app_granted',
        source: 'app_granted',
        productId: 'reverse-trial',
        willRenew: false,
      }),
      NOW,
      'fresh',
    );
    expect(() =>
      assertEntitlementActionAllowed(
        reverseTrial,
        input('reoffer_purchase', reverseTrial.evidenceIdentity),
        ['reoffer_purchase'],
        'owner-a',
      ),
    ).toThrow(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
  });

  it('requires exact lapsed paid evidence and rejects expired reverse-trial actions', () => {
    const lapsed = deriveState(
      proof({ isActive: false, expiresAt: '2026-07-04T12:00:00.000Z' }),
      NOW,
      'expired',
    );
    expect(() =>
      assertEntitlementActionAllowed(
        lapsed,
        input('winback_purchase', lapsed.evidenceIdentity),
        ['winback_purchase'],
      ),
    ).not.toThrow();

    const expiredReverse = deriveState(
      proof({
        isActive: false,
        periodType: 'reverse_trial',
        store: 'app_granted',
        source: 'app_granted',
        willRenew: false,
        expiresAt: '2026-07-04T12:00:00.000Z',
      }),
      NOW,
      'expired',
    );
    expect(() =>
      assertEntitlementActionAllowed(
        expiredReverse,
        input('decline_expired_reverse_trial', expiredReverse.evidenceIdentity),
        ['decline_expired_reverse_trial'],
        'owner-a',
      ),
    ).toThrow(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
    expect(() =>
      assertEntitlementActionAllowed(
        { ...expiredReverse, storeUserId: 'owner-b' },
        input('decline_expired_reverse_trial', expiredReverse.evidenceIdentity),
        ['decline_expired_reverse_trial'],
        'owner-a',
      ),
    ).toThrow(ENTITLEMENT_ACTION_PRECONDITION_FAILED);
  });
});
