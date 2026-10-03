import type { EntitlementStore, PeriodType, SubscriptionTier } from '@layerwell/types';

export const ENTITLEMENT_QUERY_KEY = ['entitlement'] as const;
export const ENTITLEMENT_OWNER_BINDING_PATTERN = /^[a-f0-9]{64}$/;

export type EntitlementOwnerContext = Readonly<{ ownerBinding: string }>;

/** Exact account-scoped query identity. The root constant is retained only as
 * a prefix for deliberate all-owner cancellation/removal at account boundaries. */
export function entitlementQueryKey(ownerBinding: string) {
  if (!ENTITLEMENT_OWNER_BINDING_PATTERN.test(ownerBinding)) {
    throw new Error('ENTITLEMENT_OWNER_BINDING_INVALID');
  }
  return [...ENTITLEMENT_QUERY_KEY, ownerBinding] as const;
}

/**
 * Pure entitlement-state derivation (docs/08 §4 "gate on the cached entitlement,
 * offline-safe"). Lean V1 grants only finite, current, admitted store access.
 * Historical app grants and reverse trials never produce `isPro`.
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
  source?: 'revenuecat' | 'app_granted' | 'server' | null;
  environment?: 'production' | 'sandbox' | 'test_store' | 'development' | 'unknown' | null;
  managementUrl?: string | null;
  verifiedAt?: string | null; // ISO; when RC/server last confirmed this row
  offeringId?: string | null;
  packageId?: string | null;
  storeUserId?: string | null;
  priceLabel?: string | null;
};

export type EntitlementEvidenceStatus =
  | 'fresh'
  | 'reconciliation_due'
  | 'stale'
  | 'expired'
  | 'invalid'
  | 'absent'
  | 'unavailable'
  | 'corrupt'
  | 'unsupported_version';

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
  /** Configured, owner-fenced RevenueCat app user id for this proof. */
  storeUserId: string | null;
  /** Stable identity of the authoritative row before time-derived fields are
   * cleared. It is only used to order equal-verification-time cache updates. */
  evidenceIdentity: string | null;
  /** Newest authoritative non-authorizing store observation retained while an
   * independent app grant wins. It blocks delayed older store grants. */
  storeRevocationVerifiedAt?: string | null;
  storeRevocationStoreUserId?: string | null;
  inReverseTrial: boolean;
  inTrial: boolean;
  /** Had an entitlement that has lapsed. Drives the graceful downgrade + win-back. */
  expired: boolean;
  /** Why this local cache may or may not authorize access. */
  evidenceStatus: EntitlementEvidenceStatus;
};

const MS_PER_DAY = 86_400_000;

function evidenceIdentity(e: StoredEntitlement | null): string | null {
  if (!e) return null;
  return JSON.stringify([
    e.source ?? null,
    e.verifiedAt ?? null,
    e.tier,
    e.isActive,
    e.periodType,
    e.store,
    e.productId,
    e.expiresAt,
    e.willRenew,
    e.grantedAt,
    e.environment ?? null,
    e.offeringId ?? null,
    e.packageId ?? null,
  ]);
}

/** Whole days from `nowISO` until `expiresAt` (≥0; null when no expiry). */
export function daysUntil(expiresAt: string | null, nowISO: string): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - new Date(nowISO).getTime();
  return Number.isFinite(diff) ? Math.max(0, Math.ceil(diff / MS_PER_DAY)) : null;
}

function isLive(e: StoredEntitlement, nowISO: string): boolean {
  if (e.isActive !== true || (e.tier !== 'pro' && e.tier !== 'pro_plus')) return false;
  if (e.store === 'app_granted' || e.source === 'app_granted' || e.periodType === 'reverse_trial') return false;
  const expiry = e.expiresAt === null ? NaN : Date.parse(e.expiresAt);
  const now = Date.parse(nowISO);
  return Number.isFinite(expiry) && Number.isFinite(now) && expiry > now;
}

export function deriveState(
  e: StoredEntitlement | null,
  nowISO: string,
  evidenceStatus?: EntitlementEvidenceStatus,
): SubscriptionState {
  // Lean V1 does not adopt historical custom grants, including cached ones.
  if (e && (e.store === 'app_granted' || e.source === 'app_granted' || e.periodType === 'reverse_trial')) {
    return deriveState(null, nowISO, evidenceStatus && isEntitlementEvidenceUncertain({ evidenceStatus }) ? evidenceStatus : undefined);
  }
  const invalid = !Number.isFinite(Date.parse(nowISO)) || (e !== null && (
    (e.tier !== 'pro' && e.tier !== 'pro_plus') ||
    (e.isActive === true && (e.expiresAt === null || !Number.isFinite(Date.parse(e.expiresAt))))
  ));
  const resolvedEvidence = invalid ? 'invalid' :
    evidenceStatus ?? (!e ? 'absent' : isLive(e, nowISO) ? 'fresh' : 'expired');
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
    storeUserId: e?.storeUserId ?? null,
    evidenceIdentity: evidenceIdentity(e),
    storeRevocationVerifiedAt: null,
    storeRevocationStoreUserId: null,
    inReverseTrial: false,
    inTrial: false,
    expired: resolvedEvidence === 'expired',
    evidenceStatus: resolvedEvidence,
  };
  if (!e || !e.tier) return free;

  if (
    isLive(e, nowISO) &&
    (resolvedEvidence === 'fresh' || resolvedEvidence === 'reconciliation_due')
  ) {
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
      storeUserId: e.storeUserId ?? null,
      evidenceIdentity: evidenceIdentity(e),
      storeRevocationVerifiedAt: null,
      storeRevocationStoreUserId: null,
      inReverseTrial: e.periodType === 'reverse_trial',
      inTrial: e.periodType === 'trial',
      expired: false,
      evidenceStatus: resolvedEvidence,
    };
  }
  // Expired is distinct from stale, corrupt, or otherwise uncertain evidence.
  return free;
}

/** Convenience for the gate sites (docs/08 §4. Gate at the UI). */
export function isProState(s: SubscriptionState): boolean {
  return s.isPro;
}

/**
 * Evidence failures are not a verified Free state. Callers must keep paid
 * content closed while presenting recovery UI instead of a paywall or upgrade
 * prompt until reconciliation produces authoritative evidence.
 */
export function isEntitlementEvidenceUncertain(
  s: Pick<SubscriptionState, 'evidenceStatus'> | null | undefined,
): boolean {
  return (
    s?.evidenceStatus === 'stale' ||
    s?.evidenceStatus === 'invalid' ||
    s?.evidenceStatus === 'unavailable' ||
    s?.evidenceStatus === 'corrupt' ||
    s?.evidenceStatus === 'unsupported_version'
  );
}

/**
 * The no-card reverse trial is a first-value path, not a repeat win-back.
 * Contextual gates can offer it only to a free user with no prior entitlement
 * record; lapsed reverse trials and paid expiries should see the paid re-offer.
 */
export function canStartContextualReverseTrial(
  _s: Pick<SubscriptionState, 'evidenceStatus' | 'expired' | 'isPro' | 'priorPeriodType'>,
): boolean {
  // Lean V1 never offers a custom grant, even with a valid free entitlement.
  return false;
}

/**
 * A contextual gate needs store metadata only after access has resolved to Free.
 * Keeping the query disabled while access is unknown also prevents an active Pro
 * user from paying the native-store/configuration startup cost on every gate.
 */
export function shouldLoadContextualOffering(
  s: Pick<SubscriptionState, 'evidenceStatus' | 'isPro'> | null | undefined,
): boolean {
  return s?.isPro === false && (s.evidenceStatus === 'absent' || s.evidenceStatus === 'expired');
}
