import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerInfo } from 'react-native-purchases';

import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { deriveState, type StoredEntitlement, type SubscriptionState } from './entitlement';
import {
  publishEntitlementQueryAcceptance,
  publishEntitlementVerificationFailure,
} from './entitlementQuery';
import { applyRefreshedCustomerInfo } from './entitlementRevenueCatRefresh';
import type { EntitlementAcceptance } from './store';

vi.mock('@/lib/iap/revenuecat', () => ({
  classifyRevenueCatEntitlement: vi.fn(),
}));
vi.mock('./store', () => ({
  acceptRevenueCatVerifiedEmpty: vi.fn(),
  acceptTrustedRevenueCatEntitlement: vi.fn(),
}));
vi.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'ios' },
}));

const NOW = '2026-07-05T12:00:00.000Z';

afterEach(() => vi.useRealTimers());

function proof(productId: string): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId,
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
    priceLabel: null,
  };
}

describe('RevenueCat entitlement recovery refresh', () => {
  it('recovers untrusted Retry with later trusted CustomerInfo and preserves valid proof', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(NOW));
    const client = new QueryClient();
    const scope = createOwnerQueryScope();
    const valid = deriveState(
      { ...proof('cached-valid'), verifiedAt: '2026-07-05T11:59:00.000Z' },
      NOW,
      'fresh',
    );
    client.setQueryData(queryKeys.entitlement(scope), valid);
    const classify = vi
      .fn()
      .mockReturnValueOnce({ status: 'untrusted', reason: 'verification_failed' })
      .mockReturnValueOnce({
        status: 'trusted',
        entitlement: proof('refreshed-trusted'),
        emptyEvidence: null,
      });
    const publishAcceptance = (acceptance: EntitlementAcceptance): SubscriptionState =>
      publishEntitlementQueryAcceptance(
        client,
        scope,
        acceptance,
        NOW,
        'production',
      );
    const common = {
      customerInfo: {} as CustomerInfo,
      configuredAppUserId: 'owner-a',
      assertCurrentOwner: () => {},
      publishAcceptance,
      publishVerificationFailure: () =>
        publishEntitlementVerificationFailure(client, scope, NOW),
      classify,
      acceptEntitlement: vi.fn(async (entitlement: StoredEntitlement) => ({
        entitlement,
        revenueCatEmpty: null,
        persisted: true,
      })),
    } as const;

    await expect(applyRefreshedCustomerInfo(common)).resolves.toBe('untrusted');
    expect(client.getQueryData(queryKeys.entitlement(scope))).toEqual(valid);

    await expect(applyRefreshedCustomerInfo(common)).resolves.toBe('trusted');
    expect(client.getQueryData<SubscriptionState>(queryKeys.entitlement(scope))).toMatchObject({
      isPro: true,
      productId: 'refreshed-trusted',
      evidenceStatus: 'fresh',
    });
    client.clear();
  });
});
