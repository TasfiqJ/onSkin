import type { PlanId } from '@onskin/types';

import { PLANS } from '@/features/subscription/plans';

// BLOCKED: B-REVENUECAT. Real `react-native-purchases` wiring lands with a custom
// dev build + the RevenueCat account (docs/08 §4/§13). The SDK is initialised with
// the **Supabase user ID as appUserID** from first launch (anonymous), preserving
// identity through account linking so the reverse-trial/purchase carries over
// without aliasing breakage. Offerings supply the LOCALIZED prices (never hardcode,
// docs/08 §12); `purchasePackage()` opens the native StoreKit/Play sheet;
// `restorePurchases()` re-syncs entitlements. Until then these are guarded stubs so
// the paywall flow is fully navigable, and the v1 trial/purchase is granted via the
// local-first entitlement store (the app-granted reverse trial is fully functional).

/** Forward-compat: bind RevenueCat to the stable Supabase user id (docs/08 §4). */
export async function configureRevenueCat(_appUserId: string): Promise<void> {
  // no-op until the SDK is installed (B-REVENUECAT)
}

/** Opens the native purchase sheet. Stub returns purchased:false (no SDK); the
 *  caller grants the v1 entitlement locally so the flow completes (B-REVENUECAT). */
export async function purchasePackage(_plan: PlanId): Promise<{ purchased: boolean }> {
  return { purchased: false };
}

/** Re-syncs entitlements for reinstalls/device-switches (docs/08 §3.3). */
export async function restorePurchases(): Promise<{ restored: boolean }> {
  return { restored: false };
}

/** Deep-links to the OS subscription settings for one-tap cancel/manage (docs/08
 *  §3.4). The real link is the App Store / Play subscription URL. */
export const MANAGE_SUBSCRIPTION_URL_IOS = 'https://apps.apple.com/account/subscriptions';
export const MANAGE_SUBSCRIPTION_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';

export const STUB_PRODUCTS = { annual: PLANS.annual.productId, monthly: PLANS.monthly.productId } as const;
