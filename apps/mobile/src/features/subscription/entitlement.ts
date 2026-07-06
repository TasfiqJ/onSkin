import type { EntitlementStore, PeriodType, SubscriptionTier } from '@onskin/types';

/**
 * Pure entitlement-state derivation (docs/08 §4 "gate on the cached entitlement,
 * offline-safe"). The app gates on `is_active` regardless of SOURCE. A store
 * purchase, a carded trial, or the app-granted reverse trial all produce `isPro`.
 * A lapsed entitlement falls back to the free tier with `expired` set so the
 * downgrade / win-back surfaces can frame it honestly (never data-deleting). All
 * deterministic + unit-tested; mirrors the server `entitlements` row.
 */

export type StoredEntitlement = {
  tier: 'pro' | 'pro_plus' | null;
  isActive: boolean;
  periodType: PeriodType | null;
  store: EntitlementStore | null;
  productId: string | null;
  expiresAt: string | null; // ISO; null = no expiry known
  willRenew: boolean | null;
  grantedAt: string | null; // ISO
  source?: 'revenuecat' | 'app_granted' | 'server' | 'local_cache' | null;
  environment?: 'production' | 'sandbox' | 'test_store' | 'development' | 'unknown' | null;
  managementUrl?: string | null;
  verifiedAt?: string | null; // ISO; when RC/server last confirmed this row
  offeringId?: string | null;
  packageId?: string | null;
  storeUserId?: string | null;
  priceLabel?: string | null;
};

export type SubscriptionState = {
  tier: SubscriptionTier;
  isPro: boolean;
  periodType: PeriodType | null;
  /** The stored record's period_type even when lapsed. Lets the UI pick the
   *  reverse-trial re-offer (design 03) vs the paid graceful-downgrade (design 08). */
  priorPeriodType: PeriodType | null;
  expiresAt: string | null;
  daysLeft: number | null; // whole days until expiry (reverse trial / trial / renewal)
  willRenew: boolean | null;
  /** Active product id (lets the success screen tell a win-back from a normal buy). */
  productId: string | null;
  store: StoredEntitlement['store'];
  priceLabel: string | null;
  managementUrl: string | null;
  source: StoredEntitlement['source'];
  environment: StoredEntitlement['environment'];
  verifiedAt: string | null;
  inReverseTrial: boolean;
  inTrial: boolean;
  /** Had an entitlement that has lapsed. Drives the graceful downgrade + win-back. */
  expired: boolean;
};

const MS_PER_DAY = 86_400_000;

/** Whole days from `nowISO` until `expiresAt` (≥0; null when no expiry). */
export function daysUntil(expiresAt: string | null, nowISO: string): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - new Date(nowISO).getTime();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

function isLive(e: StoredEntitlement, nowISO: string): boolean {
  if (!e.isActive || !e.tier) return false;
  if (e.expiresAt && new Date(e.expiresAt).getTime() <= new Date(nowISO).getTime()) return false;
  return true;
}

export function deriveState(e: StoredEntitlement | null, nowISO: string): SubscriptionState {
  const free: SubscriptionState = {
    tier: 'free',
    isPro: false,
    periodType: null,
    priorPeriodType: e?.periodType ?? null,
    expiresAt: null,
    daysLeft: null,
    willRenew: null,
    productId: null,
    store: e?.store ?? null,
    priceLabel: e?.priceLabel ?? null,
    managementUrl: e?.managementUrl ?? null,
    source: e?.source ?? null,
    environment: e?.environment ?? null,
    verifiedAt: e?.verifiedAt ?? null,
    inReverseTrial: false,
    inTrial: false,
    expired: false,
  };
  if (!e || !e.tier) return free;

  if (isLive(e, nowISO)) {
    return {
      tier: e.tier,
      isPro: true,
      periodType: e.periodType,
      priorPeriodType: e.periodType,
      expiresAt: e.expiresAt,
      daysLeft: daysUntil(e.expiresAt, nowISO),
      willRenew: e.willRenew,
      productId: e.productId,
      store: e.store,
      priceLabel: e.priceLabel ?? null,
      managementUrl: e.managementUrl ?? null,
      source: e.source ?? null,
      environment: e.environment ?? null,
      verifiedAt: e.verifiedAt ?? null,
      inReverseTrial: e.periodType === 'reverse_trial',
      inTrial: e.periodType === 'trial',
      expired: false,
    };
  }
  // A record exists but has lapsed → free, but flagged as expired for honest framing.
  return { ...free, expired: true };
}

/** Convenience for the gate sites (docs/08 §4. Gate at the UI). */
export function isProState(s: SubscriptionState): boolean {
  return s.isPro;
}

/**
 * The no-card reverse trial is a first-value path, not a repeat win-back.
 * Contextual gates can offer it only to a free user with no prior entitlement
 * record; lapsed reverse trials and paid expiries should see the paid re-offer.
 */
export function canStartContextualReverseTrial(
  s: Pick<SubscriptionState, 'expired' | 'isPro' | 'priorPeriodType'>,
): boolean {
  return !s.isPro && !s.expired && s.priorPeriodType === null;
}
