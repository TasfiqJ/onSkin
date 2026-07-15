import type { AppEnvironment } from '@/lib/env';

import { deriveState } from './entitlement';
import type {
  EntitlementEvidenceStatus,
  StoredEntitlement,
  SubscriptionState,
} from './entitlement';
import type { EntitlementCacheRead } from './store';

export const ENTITLEMENT_RECONCILIATION_INTERVAL_MS = 5 * 60 * 1_000;
export const ENTITLEMENT_OFFLINE_GRACE_MS = 72 * 60 * 60 * 1_000;
export const ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export type EntitlementCacheEvidenceStatus = Extract<
  EntitlementEvidenceStatus,
  'fresh' | 'reconciliation_due' | 'stale' | 'expired' | 'invalid' | 'absent'
>;

function canonicalTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) return null;
  return parsed;
}

function hasWrongEnvironment(
  entitlement: StoredEntitlement,
  appEnvironment: AppEnvironment,
): boolean {
  if (appEnvironment !== 'development' && entitlement.environment === 'development') return true;
  return (
    appEnvironment === 'production' &&
    (entitlement.store === 'test_store' || entitlement.environment === 'test_store')
  );
}

function isTimeBoxed(entitlement: StoredEntitlement): boolean {
  return (
    entitlement.periodType === 'reverse_trial' ||
    entitlement.periodType === 'trial' ||
    entitlement.periodType === 'intro' ||
    entitlement.periodType === 'prepaid' ||
    entitlement.store === 'app_granted' ||
    entitlement.source === 'app_granted'
  );
}

function isAppGrantedReverseTrial(entitlement: StoredEntitlement): boolean {
  return (
    entitlement.store === 'app_granted' &&
    entitlement.periodType === 'reverse_trial' &&
    entitlement.willRenew === false &&
    canonicalTimestamp(entitlement.expiresAt) !== null
  );
}

/** Classify whether encrypted local bytes still carry usable authority. */
export function classifyEntitlementEvidence(
  entitlement: StoredEntitlement,
  nowISO: string,
  appEnvironment: AppEnvironment,
): EntitlementCacheEvidenceStatus {
  const now = canonicalTimestamp(nowISO);
  const verifiedAt = canonicalTimestamp(entitlement.verifiedAt);
  const expiresAt = canonicalTimestamp(entitlement.expiresAt);
  const sourceIsAuthoritative =
    entitlement.source === 'revenuecat' ||
    entitlement.source === 'server' ||
    entitlement.source === 'app_granted';

  if (
    now === null ||
    verifiedAt === null ||
    !sourceIsAuthoritative ||
    !entitlement.tier ||
    hasWrongEnvironment(entitlement, appEnvironment) ||
    (entitlement.expiresAt !== null && expiresAt === null) ||
    (isTimeBoxed(entitlement) && expiresAt === null) ||
    ((entitlement.source === 'app_granted' || entitlement.store === 'app_granted') &&
      !isAppGrantedReverseTrial(entitlement))
  ) {
    return 'invalid';
  }

  const futureSkew = verifiedAt - now;
  if (futureSkew > ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS) return 'invalid';

  if (!entitlement.isActive || (expiresAt !== null && expiresAt <= now)) return 'expired';

  const age = Math.max(0, now - verifiedAt);
  if (age < ENTITLEMENT_RECONCILIATION_INTERVAL_MS) return 'fresh';
  if (isAppGrantedReverseTrial(entitlement)) return 'reconciliation_due';
  if (age >= ENTITLEMENT_OFFLINE_GRACE_MS) return 'stale';
  return 'reconciliation_due';
}

export function resolveEntitlementCacheRead(
  read: EntitlementCacheRead,
  nowISO: string,
  appEnvironment: AppEnvironment,
): SubscriptionState {
  if (read.status === 'available') {
    const evidence = classifyEntitlementEvidence(read.entitlement, nowISO, appEnvironment);
    const state = deriveState(read.entitlement, nowISO, evidence);
    return read.revenueCatEmpty
      ? {
          ...state,
          storeRevocationVerifiedAt: read.revenueCatEmpty.verifiedAt,
          storeRevocationStoreUserId: read.revenueCatEmpty.storeUserId ?? null,
        }
      : state;
  }

  if (read.status === 'absent' && read.revenueCatEmpty) {
    const now = canonicalTimestamp(nowISO);
    const verifiedAt = canonicalTimestamp(read.revenueCatEmpty.verifiedAt);
    const evidenceStatus = (() => {
      if (
        now === null ||
        verifiedAt === null ||
        verifiedAt - now > ENTITLEMENT_VERIFICATION_CLOCK_SKEW_MS
      ) {
        return 'invalid' as const;
      }
      return Math.max(0, now - verifiedAt) >= ENTITLEMENT_OFFLINE_GRACE_MS
        ? ('stale' as const)
        : ('absent' as const);
    })();
    return {
      ...deriveState(null, nowISO, evidenceStatus),
      source: 'revenuecat',
      verifiedAt: read.revenueCatEmpty.verifiedAt,
      storeUserId: read.revenueCatEmpty.storeUserId ?? null,
      managementUrl: read.revenueCatEmpty.managementUrl ?? null,
      evidenceIdentity: JSON.stringify([
        'revenuecat_empty',
        read.revenueCatEmpty.verifiedAt,
        read.revenueCatEmpty.storeUserId ?? null,
      ]),
    };
  }

  return deriveState(null, nowISO, read.status);
}
