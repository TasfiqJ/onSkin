import { env } from '@/lib/env';

import { deriveState, type SubscriptionState } from './entitlement';

const MAX_E2E_ENTITLEMENT_DELAY_MS = 3_000;

/** Browser-only deterministic latency for human-simulated Expo web evidence. */
export function e2eEntitlementDelayMs(): number {
  if (env.appEnvironment !== 'development') return 0;

  const raw = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS;
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_E2E_ENTITLEMENT_DELAY_MS);
}

/**
 * Browser-only visual fixture. Metro resolves the fail-closed `.native.ts`
 * module for iOS and Android, so this authority cannot enter a native bundle.
 */
export function e2eEntitlementState(): SubscriptionState | null {
  if (env.appEnvironment !== 'development') return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT;
  if (
    fixture !== 'pro' &&
    fixture !== 'store_pro' &&
    fixture !== 'expired_store' &&
    fixture !== 'expired_reverse_trial'
  )
    return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  if (fixture === 'store_pro') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: 'layerwell_pro_annual_dev',
        expiresAt,
        willRenew: true,
        grantedAt: now.toISOString(),
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: 'https://apps.apple.com/account/subscriptions',
        verifiedAt: now.toISOString(),
        offeringId: 'local_store_fixture',
        packageId: 'annual',
        storeUserId: 'e2e-store-user',
        priceLabel: '$49.99/year',
      },
      now.toISOString(),
    );
  }
  if (fixture === 'expired_store') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'normal',
        store: 'app_store',
        productId: 'layerwell_pro_annual_dev',
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'revenuecat',
        environment: 'sandbox',
        managementUrl: 'https://apps.apple.com/account/subscriptions',
        verifiedAt: now.toISOString(),
        offeringId: 'local_store_fixture',
        packageId: 'annual',
        storeUserId: 'e2e-expired-store-user',
        priceLabel: '$49.99/year',
      },
      now.toISOString(),
    );
  }
  if (fixture === 'expired_reverse_trial') {
    return deriveState(
      {
        tier: 'pro',
        isActive: true,
        periodType: 'reverse_trial',
        store: 'app_granted',
        productId: null,
        expiresAt: expiredAt,
        willRenew: false,
        grantedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'app_granted',
        environment: 'development',
        managementUrl: null,
        verifiedAt: now.toISOString(),
        offeringId: null,
        packageId: null,
        storeUserId: null,
        priceLabel: null,
      },
      now.toISOString(),
    );
  }

  return deriveState(
    {
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      productId: null,
      expiresAt,
      willRenew: false,
      grantedAt: now.toISOString(),
      source: 'app_granted',
      environment: 'development',
      managementUrl: null,
      verifiedAt: now.toISOString(),
      offeringId: null,
      packageId: null,
      storeUserId: null,
      priceLabel: null,
    },
    now.toISOString(),
  );
}
