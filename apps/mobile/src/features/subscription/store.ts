import type { QueryClient } from '@tanstack/react-query';
import type { CustomerInfo } from 'react-native-purchases';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { localDataOwnerBinding, readLocalDataOwnerProofBinding } from '@/lib/auth/sessionOwner';
import { env, isSupabaseConfigured } from '@/lib/env';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { supabase } from '@/lib/supabase/client';
import {
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  getPrivateItem,
  multiRemovePrivateItems,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

import {
  ENTITLEMENT_OWNER_BINDING_PATTERN,
  deriveState,
  entitlementQueryKey,
  type EntitlementOwnerContext,
  type StoredEntitlement,
} from './entitlement';
import {
  ENTITLEMENT_CACHE_SCHEMA_VERSION,
  advanceEntitlementClock,
  effectiveEntitlementProjection,
  emptyEntitlementEnvelope,
  entitlementEvidenceFingerprint,
  mergeEntitlementEnvelope,
  storeCursorProviderAt,
  type AppGrantConflict,
  type AppGrantProof,
  type EntitlementCacheEnvelopeV2,
  type EntitlementEvidence,
  type LegacyPositiveProof,
  type StoreConflict,
  type StoreDefinitiveProof,
  type StoreEvidenceCursor,
  type StoreProvisionalProof,
} from './entitlementEvidence';

/**
 * Owner-bound local entitlement evidence. Store and app-granted authority live
 * in separate lanes so a lagging webhook, a verified-empty RevenueCat snapshot,
 * or a transport failure cannot erase an unrelated reverse trial.
 */
const KEY = 'layerwell.entitlement.v2';
const LEGACY_KEY = 'layerwell.entitlement.v1';

export const ENTITLEMENT_CACHE_INVALID = 'ENTITLEMENT_CACHE_INVALID';
export const ENTITLEMENT_CACHE_UNSUPPORTED_VERSION = 'ENTITLEMENT_CACHE_UNSUPPORTED_VERSION';
export const ENTITLEMENT_CACHE_LEGACY_UNBOUND = 'ENTITLEMENT_CACHE_LEGACY_UNBOUND';
export const ENTITLEMENT_CACHE_FOREIGN_OWNER = 'ENTITLEMENT_CACHE_FOREIGN_OWNER';
export const ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED = 'ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED';
export const ENTITLEMENT_EVIDENCE_CURSOR_REQUIRED = 'ENTITLEMENT_EVIDENCE_CURSOR_REQUIRED';

type EntitlementRow = {
  entitlement: string | null;
  is_active: boolean;
  period_type: string | null;
  store: string | null;
  product_id: string | null;
  expires_at: string | null;
  will_renew: boolean | null;
  original_purchase_at: string | null;
  offering_id?: string | null;
  package_id?: string | null;
  source?: string | null;
  environment?: string | null;
  management_url?: string | null;
  verified_at?: string | null;
  store_user_id?: string | null;
  updated_at?: string | null;
  rc_event_at?: string | null;
  rc_event_priority?: number | null;
  rc_event_id?: string | null;
};

type ProjectionCursor =
  | Readonly<{ kind: 'rc_webhook'; at: string; priority: number; event_id: string }>
  | Readonly<{ kind: 'rc_snapshot'; at: string; fingerprint: string }>
  | null;

type ProjectionRow = Readonly<{
  tier: string | null;
  is_active: boolean;
  product_id: string | null;
  expires_at: string | null;
  store: string | null;
  period_type: string | null;
  will_renew: boolean | null;
  granted_at: string | null;
  source: string | null;
  environment: string | null;
  management_url: string | null;
  verified_at: string | null;
  offering_id: string | null;
  package_id: string | null;
  cursor: ProjectionCursor;
}>;

type EntitlementProjectionResponse = Readonly<{
  schema_version: 1;
  store_projection: Readonly<{
    state: 'active' | 'inactive' | 'legacy_unknown' | 'absent';
    row: ProjectionRow | null;
  }>;
  app_grant_projection: Readonly<{
    state: 'active' | 'inactive' | 'absent';
    row: ProjectionRow | null;
  }>;
}>;

export type EntitlementSnapshot = Readonly<{
  ownerBinding: string;
  revision: number;
  entitlement: StoredEntitlement | null;
  activeStoreEntitlement: StoredEntitlement | null;
  activeAppGrantEntitlement: StoredEntitlement | null;
  priorEntitlement: StoredEntitlement | null;
  effectiveNowISO: string;
  hasConflict: boolean;
  requiresUncachedRefresh: boolean;
}>;

export type EntitlementSnapshotRead =
  | Readonly<{ status: 'available'; snapshot: EntitlementSnapshot }>
  | Readonly<{
      status:
        | 'absent'
        | 'unavailable'
        | 'corrupt'
        | 'unsupported_version'
        | 'legacy_unbound'
        | 'foreign_owner';
      snapshot: null;
    }>;

export type EntitlementCacheRead =
  | Readonly<{
      status: 'available';
      entitlement: StoredEntitlement | null;
      snapshot: EntitlementSnapshot;
    }>
  | Readonly<{
      status: Exclude<EntitlementSnapshotRead['status'], 'available'>;
      entitlement: null;
      snapshot: null;
    }>;

export type EvidenceConversion =
  | Readonly<{ status: 'evidence'; evidence: EntitlementEvidence }>
  | Readonly<{
      status: 'ignored' | 'rejected';
      reason:
        | 'verification_failed'
        | 'verification_mismatch'
        | 'verification_unknown'
        | 'invalid_request_date'
        | 'verified_on_device_empty'
        | 'verification_not_requested'
        | 'inactive_weak_evidence'
        | 'invalid_entitlement'
        | 'missing_store_cursor'
        | 'missing_app_grant_cursor';
    }>;

type EvidenceConversionReason = Extract<
  EvidenceConversion,
  { status: 'ignored' | 'rejected' }
>['reason'];

export type MergeEntitlementEvidenceResult = Readonly<{
  status: 'committed' | 'unchanged' | 'conflict' | 'blocked';
  disposition: 'applied' | 'conflict' | 'duplicate' | 'stale' | 'ignored' | 'blocked';
  snapshot: EntitlementSnapshot | null;
  requiresUncachedRefresh: boolean;
  reason?: string;
}>;

export type PublishCustomerInfoEvidenceResult =
  | MergeEntitlementEvidenceResult
  | Readonly<{
      status: 'ignored' | 'rejected';
      disposition: 'ignored';
      snapshot: EntitlementSnapshot | null;
      requiresUncachedRefresh: boolean;
      reason: EvidenceConversionReason;
    }>;

export type ServerEvidenceResult =
  | Readonly<{ status: 'evidence'; evidence: readonly EntitlementEvidence[] }>
  | Readonly<{ status: 'absent' | 'unconfigured' }>
  | Readonly<{ status: 'transport_error' | 'blocked'; reason: string }>
  | Readonly<{
      status: 'ignored' | 'rejected';
      reason: string;
    }>;

type EntitlementVerificationValue = `${CustomerInfo['entitlements']['verification']}`;

export function isDurablyAdmissibleStoreResult(
  verification: EntitlementVerificationValue,
  result: PublishCustomerInfoEvidenceResult,
): boolean {
  return (
    (verification === 'VERIFIED' || verification === 'VERIFIED_ON_DEVICE') &&
    (result.status === 'committed' || result.status === 'unchanged') &&
    (result.disposition === 'applied' || result.disposition === 'duplicate') &&
    result.snapshot?.hasConflict === false &&
    result.snapshot.activeStoreEntitlement?.isActive === true
  );
}

const ENTITLEMENT_CACHE_RECORD_KEYS = [
  'tier',
  'isActive',
  'periodType',
  'store',
  'productId',
  'expiresAt',
  'willRenew',
  'grantedAt',
  'source',
  'environment',
  'managementUrl',
  'verifiedAt',
  'offeringId',
  'packageId',
  'storeUserId',
  'priceLabel',
] as const satisfies readonly (keyof StoredEntitlement)[];
const ENVELOPE_KEYS = [
  'version',
  'ownerBinding',
  'revision',
  'clockAnchor',
  'store',
  'appGrant',
  'legacy',
] as const;
const STORE_LANE_KEYS = ['definitive', 'provisionalActive', 'conflict'] as const;
const APP_GRANT_LANE_KEYS = ['definitive', 'conflict'] as const;
const STORE_DEFINITIVE_KEYS = [
  'cursor',
  'state',
  'entitlement',
  'priorEntitlement',
  'provenance',
  'fingerprint',
] as const;
const STORE_PROVISIONAL_KEYS = ['cursor', 'entitlement', 'provenance', 'fingerprint'] as const;
const STORE_CONFLICT_KEYS = [
  'providerAt',
  'leftFingerprint',
  'rightFingerprint',
  'leftProvenance',
  'rightProvenance',
] as const;
const APP_GRANT_PROOF_KEYS = ['grantAt', 'entitlement', 'fingerprint'] as const;
const APP_GRANT_CONFLICT_KEYS = ['grantAt', 'leftFingerprint', 'rightFingerprint'] as const;
const LEGACY_PROOF_KEYS = ['provenance', 'entitlement', 'fingerprint'] as const;
const PROJECTION_RESPONSE_KEYS = [
  'schema_version',
  'store_projection',
  'app_grant_projection',
] as const;
const PROJECTION_KEYS = ['state', 'row'] as const;
const PROJECTION_ROW_KEYS = [
  'tier',
  'is_active',
  'product_id',
  'expires_at',
  'store',
  'period_type',
  'will_renew',
  'granted_at',
  'source',
  'environment',
  'management_url',
  'verified_at',
  'offering_id',
  'package_id',
  'cursor',
] as const satisfies readonly (keyof ProjectionRow)[];

function nowISO(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => hasOwn(value, key));
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function isoOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asTier(value: string | null): StoredEntitlement['tier'] {
  return value === 'pro' || value === 'pro_plus' ? value : null;
}

function asPeriod(value: string | null): StoredEntitlement['periodType'] {
  if (
    value === 'reverse_trial' ||
    value === 'trial' ||
    value === 'intro' ||
    value === 'normal' ||
    value === 'prepaid'
  ) {
    return value;
  }
  return null;
}

function asStore(value: string | null): StoredEntitlement['store'] {
  if (
    value === 'app_store' ||
    value === 'play_store' ||
    value === 'web' ||
    value === 'app_granted' ||
    value === 'promotional' ||
    value === 'test_store'
  ) {
    return value;
  }
  return null;
}

function asSource(value: string | null | undefined): StoredEntitlement['source'] {
  if (value === 'revenuecat' || value === 'app_granted' || value === 'server') return value;
  return null;
}

function asEnvironment(value: string | null | undefined): StoredEntitlement['environment'] {
  if (
    value === 'production' ||
    value === 'sandbox' ||
    value === 'test_store' ||
    value === 'development' ||
    value === 'unknown'
  ) {
    return value;
  }
  return null;
}

function normalizeStoredEntitlement(value: unknown): StoredEntitlement | null {
  if (!isRecord(value)) return null;
  const tier = asTier(stringOrNull(value.tier));
  if (!tier) return null;

  const periodType = asPeriod(stringOrNull(value.periodType));
  const store = asStore(stringOrNull(value.store));
  const source = asSource(stringOrNull(value.source));
  const environment = asEnvironment(stringOrNull(value.environment));
  const expiresAt = isoOrNull(value.expiresAt);
  const grantedAt = isoOrNull(value.grantedAt);
  const verifiedAt = isoOrNull(value.verifiedAt);
  const rawActive = booleanOrNull(value.isActive) ?? false;
  const timeBoxed =
    periodType === 'reverse_trial' ||
    periodType === 'trial' ||
    periodType === 'intro' ||
    periodType === 'prepaid' ||
    source === 'app_granted' ||
    store === 'app_granted';
  const devGrantedInNonDev =
    source === 'app_granted' &&
    environment === 'development' &&
    env.appEnvironment !== 'development';
  const testStoreInProduction =
    env.appEnvironment === 'production' && (store === 'test_store' || environment === 'test_store');
  const appGranted = store === 'app_granted' || source === 'app_granted';

  return {
    tier,
    isActive:
      rawActive &&
      source !== null &&
      (!timeBoxed || expiresAt !== null) &&
      !devGrantedInNonDev &&
      !testStoreInProduction,
    periodType,
    store,
    productId: appGranted ? null : stringOrNull(value.productId),
    expiresAt,
    willRenew: booleanOrNull(value.willRenew),
    grantedAt,
    source: appGranted ? 'app_granted' : source,
    environment,
    managementUrl: safeExternalHttpsUrl(stringOrNull(value.managementUrl)),
    verifiedAt,
    offeringId: appGranted ? null : stringOrNull(value.offeringId),
    packageId: appGranted ? null : stringOrNull(value.packageId),
    storeUserId: stringOrNull(value.storeUserId),
    priceLabel: stringOrNull(value.priceLabel),
  };
}

function storedEntitlementEquals(left: unknown, right: StoredEntitlement): boolean {
  if (!isRecord(left) || !hasExactKeys(left, ENTITLEMENT_CACHE_RECORD_KEYS)) return false;
  return ENTITLEMENT_CACHE_RECORD_KEYS.every((key) => left[key] === right[key]);
}

function strictStoredEntitlement(value: unknown): StoredEntitlement | null {
  const normalized = normalizeStoredEntitlement(value);
  return normalized && storedEntitlementEquals(value, normalized) ? normalized : null;
}

function canonicalISO(value: unknown): value is string {
  return typeof value === 'string' && isoOrNull(value) === value;
}

function printableAscii(value: unknown, maxLength = 255): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[\x21-\x7e]+$/.test(value)
  );
}

function decodeStoreCursor(value: unknown): StoreEvidenceCursor | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  if (value.kind === 'revenuecat_snapshot') {
    if (
      !hasExactKeys(value, ['kind', 'requestDate', 'fingerprint']) ||
      !canonicalISO(value.requestDate) ||
      typeof value.fingerprint !== 'string' ||
      value.fingerprint.length === 0 ||
      value.fingerprint.length > 2_048
    ) {
      return null;
    }
    return {
      kind: 'revenuecat_snapshot',
      requestDate: value.requestDate,
      fingerprint: value.fingerprint,
    };
  }
  if (value.kind === 'revenuecat_webhook') {
    if (
      !hasExactKeys(value, ['kind', 'eventAt', 'priority', 'eventId']) ||
      !canonicalISO(value.eventAt) ||
      !Number.isSafeInteger(value.priority) ||
      (value.priority as number) < 0 ||
      (value.priority as number) > 32_767 ||
      !printableAscii(value.eventId)
    ) {
      return null;
    }
    return {
      kind: 'revenuecat_webhook',
      eventAt: value.eventAt,
      priority: value.priority as number,
      eventId: value.eventId,
    };
  }
  return null;
}

function decodeStoreDefinitive(value: unknown): StoreDefinitiveProof | null {
  if (!isRecord(value) || !hasExactKeys(value, STORE_DEFINITIVE_KEYS)) return null;
  const cursor = decodeStoreCursor(value.cursor);
  const state = value.state;
  const entitlement =
    value.entitlement === null ? null : strictStoredEntitlement(value.entitlement);
  const priorEntitlement =
    value.priorEntitlement === null ? null : strictStoredEntitlement(value.priorEntitlement);
  const provenance = value.provenance;
  if (
    !cursor ||
    (state !== 'active' && state !== 'inactive' && state !== 'empty') ||
    (value.entitlement !== null && entitlement === null) ||
    (value.priorEntitlement !== null && priorEntitlement === null) ||
    (provenance !== 'revenuecat_verified' &&
      provenance !== 'server_snapshot' &&
      provenance !== 'server_webhook') ||
    typeof value.fingerprint !== 'string'
  ) {
    return null;
  }
  if (
    (state === 'empty' && entitlement !== null) ||
    (state === 'active' && !entitlement?.isActive) ||
    (state === 'inactive' && (entitlement === null || entitlement.isActive)) ||
    value.fingerprint !== entitlementEvidenceFingerprint(state, entitlement)
  ) {
    return null;
  }
  return {
    cursor,
    state,
    entitlement,
    priorEntitlement,
    provenance,
    fingerprint: value.fingerprint,
  };
}

function decodeStoreProvisional(value: unknown): StoreProvisionalProof | null {
  if (!isRecord(value) || !hasExactKeys(value, STORE_PROVISIONAL_KEYS)) return null;
  const cursor = decodeStoreCursor(value.cursor);
  const entitlement = strictStoredEntitlement(value.entitlement);
  if (
    cursor?.kind !== 'revenuecat_snapshot' ||
    !entitlement?.isActive ||
    value.provenance !== 'revenuecat_verified_on_device' ||
    typeof value.fingerprint !== 'string' ||
    value.fingerprint !== entitlementEvidenceFingerprint('active', entitlement)
  ) {
    return null;
  }
  return {
    cursor,
    entitlement,
    provenance: 'revenuecat_verified_on_device',
    fingerprint: value.fingerprint,
  };
}

function isStoreProvenance(value: unknown): value is StoreConflict['leftProvenance'] {
  return (
    value === 'revenuecat_verified' ||
    value === 'revenuecat_verified_on_device' ||
    value === 'server_snapshot' ||
    value === 'server_webhook'
  );
}

function decodeStoreConflict(value: unknown): StoreConflict | null {
  if (!isRecord(value) || !hasExactKeys(value, STORE_CONFLICT_KEYS)) return null;
  if (
    !canonicalISO(value.providerAt) ||
    typeof value.leftFingerprint !== 'string' ||
    typeof value.rightFingerprint !== 'string' ||
    !isStoreProvenance(value.leftProvenance) ||
    !isStoreProvenance(value.rightProvenance)
  ) {
    return null;
  }
  return {
    providerAt: value.providerAt,
    leftFingerprint: value.leftFingerprint,
    rightFingerprint: value.rightFingerprint,
    leftProvenance: value.leftProvenance,
    rightProvenance: value.rightProvenance,
  };
}

function decodeAppGrantProof(value: unknown): AppGrantProof | null {
  if (!isRecord(value) || !hasExactKeys(value, APP_GRANT_PROOF_KEYS)) return null;
  const entitlement = strictStoredEntitlement(value.entitlement);
  if (
    !canonicalISO(value.grantAt) ||
    !entitlement ||
    entitlement.source !== 'app_granted' ||
    entitlement.store !== 'app_granted' ||
    entitlement.grantedAt !== value.grantAt ||
    typeof value.fingerprint !== 'string' ||
    value.fingerprint !== entitlementEvidenceFingerprint('app_grant', entitlement)
  ) {
    return null;
  }
  return { grantAt: value.grantAt, entitlement, fingerprint: value.fingerprint };
}

function decodeAppGrantConflict(value: unknown): AppGrantConflict | null {
  if (!isRecord(value) || !hasExactKeys(value, APP_GRANT_CONFLICT_KEYS)) return null;
  if (
    !canonicalISO(value.grantAt) ||
    typeof value.leftFingerprint !== 'string' ||
    typeof value.rightFingerprint !== 'string'
  ) {
    return null;
  }
  return {
    grantAt: value.grantAt,
    leftFingerprint: value.leftFingerprint,
    rightFingerprint: value.rightFingerprint,
  };
}

function decodeLegacyProof(value: unknown): LegacyPositiveProof | null {
  if (!isRecord(value) || !hasExactKeys(value, LEGACY_PROOF_KEYS)) return null;
  const entitlement = strictStoredEntitlement(value.entitlement);
  if (
    value.provenance !== 'server_missing_cursor' ||
    !entitlement?.isActive ||
    typeof value.fingerprint !== 'string' ||
    value.fingerprint !== entitlementEvidenceFingerprint('legacy', entitlement)
  ) {
    return null;
  }
  return {
    provenance: value.provenance,
    entitlement,
    fingerprint: value.fingerprint,
  };
}

/**
 * Releases before the Trusted Entitlements boundary could persist an
 * owner-bound V2 legacy proof from RevenueCat verification=NOT_REQUESTED.
 * That proof must never grant access, but treating the otherwise-valid
 * envelope as generic corruption prevents a fresh authoritative response
 * from repairing an upgraded installation. Recognize only that exact retired
 * shape so merge can atomically discard it after the current owner has
 * received definitive evidence.
 */
function decodeDeprecatedNotRequestedEnvelope(raw: string): EntitlementCacheEnvelopeV2 | null {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (
    !isRecord(value) ||
    value.version !== ENTITLEMENT_CACHE_SCHEMA_VERSION ||
    !hasExactKeys(value, ENVELOPE_KEYS) ||
    !isRecord(value.legacy) ||
    !hasExactKeys(value.legacy, LEGACY_PROOF_KEYS) ||
    value.legacy.provenance !== 'revenuecat_not_requested'
  ) {
    return null;
  }
  const entitlement = strictStoredEntitlement(value.legacy.entitlement);
  if (
    !entitlement?.isActive ||
    typeof value.legacy.fingerprint !== 'string' ||
    value.legacy.fingerprint !== entitlementEvidenceFingerprint('legacy', entitlement)
  ) {
    return null;
  }
  try {
    return decodeEntitlementEnvelope(JSON.stringify({ ...value, legacy: null }));
  } catch {
    return null;
  }
}

function hasDefinitiveReplacementEvidence(
  evidence: readonly (EntitlementEvidence | null)[],
): boolean {
  return evidence.some((item) => item?.kind === 'store_definitive' || item?.kind === 'app_grant');
}

function decodeEntitlementEnvelope(raw: string): EntitlementCacheEnvelopeV2 {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(ENTITLEMENT_CACHE_INVALID);
  }
  if (!isRecord(value)) throw new Error(ENTITLEMENT_CACHE_INVALID);
  if (value.version !== ENTITLEMENT_CACHE_SCHEMA_VERSION) {
    if (
      typeof value.version === 'number' &&
      Number.isSafeInteger(value.version) &&
      value.version > ENTITLEMENT_CACHE_SCHEMA_VERSION
    ) {
      throw new Error(ENTITLEMENT_CACHE_UNSUPPORTED_VERSION);
    }
    throw new Error(ENTITLEMENT_CACHE_LEGACY_UNBOUND);
  }
  if (
    !hasExactKeys(value, ENVELOPE_KEYS) ||
    typeof value.ownerBinding !== 'string' ||
    !ENTITLEMENT_OWNER_BINDING_PATTERN.test(value.ownerBinding) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    (value.clockAnchor !== null && !canonicalISO(value.clockAnchor)) ||
    !isRecord(value.store) ||
    !hasExactKeys(value.store, STORE_LANE_KEYS) ||
    !isRecord(value.appGrant) ||
    !hasExactKeys(value.appGrant, APP_GRANT_LANE_KEYS)
  ) {
    throw new Error(ENTITLEMENT_CACHE_INVALID);
  }

  const definitive =
    value.store.definitive === null ? null : decodeStoreDefinitive(value.store.definitive);
  const provisionalActive =
    value.store.provisionalActive === null
      ? null
      : decodeStoreProvisional(value.store.provisionalActive);
  const storeConflict =
    value.store.conflict === null ? null : decodeStoreConflict(value.store.conflict);
  const appGrantDefinitive =
    value.appGrant.definitive === null ? null : decodeAppGrantProof(value.appGrant.definitive);
  const appGrantConflict =
    value.appGrant.conflict === null ? null : decodeAppGrantConflict(value.appGrant.conflict);
  const legacy = value.legacy === null ? null : decodeLegacyProof(value.legacy);
  if (
    (value.store.definitive !== null && !definitive) ||
    (value.store.provisionalActive !== null && !provisionalActive) ||
    (value.store.conflict !== null && !storeConflict) ||
    (value.appGrant.definitive !== null && !appGrantDefinitive) ||
    (value.appGrant.conflict !== null && !appGrantConflict) ||
    (value.legacy !== null && !legacy)
  ) {
    throw new Error(ENTITLEMENT_CACHE_INVALID);
  }

  return {
    version: ENTITLEMENT_CACHE_SCHEMA_VERSION,
    ownerBinding: value.ownerBinding,
    revision: value.revision as number,
    clockAnchor: value.clockAnchor,
    store: { definitive, provisionalActive, conflict: storeConflict },
    appGrant: { definitive: appGrantDefinitive, conflict: appGrantConflict },
    legacy,
  };
}

function encodeEntitlementEnvelope(envelope: EntitlementCacheEnvelopeV2): string {
  return JSON.stringify(envelope);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'UNKNOWN_ERROR';
}

function readFailureStatus(
  error: unknown,
): Exclude<EntitlementSnapshotRead['status'], 'available'> {
  const message = errorMessage(error);
  if (
    message === ENTITLEMENT_CACHE_UNSUPPORTED_VERSION ||
    message === PRIVATE_KV_ENVELOPE_UNSUPPORTED
  ) {
    return 'unsupported_version';
  }
  if (message === ENTITLEMENT_CACHE_LEGACY_UNBOUND) return 'legacy_unbound';
  if (message === ENTITLEMENT_CACHE_FOREIGN_OWNER) return 'foreign_owner';
  if (
    message === ENTITLEMENT_CACHE_INVALID ||
    message === PRIVATE_KV_ENVELOPE_INVALID ||
    message === PRIVATE_KV_DECRYPTION_FAILED
  ) {
    return 'corrupt';
  }
  return 'unavailable';
}

function assertContextShape(context: EntitlementOwnerContext): void {
  if (!ENTITLEMENT_OWNER_BINDING_PATTERN.test(context.ownerBinding)) {
    throw new Error('ENTITLEMENT_OWNER_BINDING_INVALID');
  }
}

async function assertCurrentOwnerContext(context: EntitlementOwnerContext): Promise<void> {
  assertContextShape(context);
  const currentBinding = await readLocalDataOwnerProofBinding();
  if (currentBinding !== context.ownerBinding) throw new Error(ENTITLEMENT_CACHE_FOREIGN_OWNER);
}

export async function entitlementOwnerContextForUser(
  userId: string,
): Promise<EntitlementOwnerContext> {
  if (!userId.trim()) throw new Error('ENTITLEMENT_OWNER_USER_ID_REQUIRED');
  const context = { ownerBinding: await localDataOwnerBinding(userId) } as const;
  await assertCurrentOwnerContext(context);
  return context;
}

export async function currentEntitlementOwnerContext(): Promise<EntitlementOwnerContext> {
  const ownerBinding = await readLocalDataOwnerProofBinding();
  if (!ownerBinding || !ENTITLEMENT_OWNER_BINDING_PATTERN.test(ownerBinding)) {
    throw new Error(ENTITLEMENT_CACHE_FOREIGN_OWNER);
  }
  return { ownerBinding };
}

function maxISO(left: string | null, right: string): string {
  return left === null || left < right ? right : left;
}

function snapshotFromEnvelope(
  envelope: EntitlementCacheEnvelopeV2,
  observedAtISO: string,
): EntitlementSnapshot {
  const effectiveNowISO = maxISO(envelope.clockAnchor, observedAtISO);
  const projection = effectiveEntitlementProjection(envelope, effectiveNowISO);
  return {
    ownerBinding: envelope.ownerBinding,
    revision: envelope.revision,
    entitlement: projection.entitlement,
    activeStoreEntitlement: projection.activeStoreEntitlement,
    activeAppGrantEntitlement: projection.activeAppGrantEntitlement,
    priorEntitlement: projection.priorEntitlement,
    effectiveNowISO,
    hasConflict: projection.hasConflict,
    requiresUncachedRefresh: projection.hasConflict,
  };
}

/**
 * Read and advance the separate nondecreasing expiry clock atomically. The
 * local time affects expiry only; it is never used as an evidence cursor.
 */
export async function readEntitlementSnapshot(
  context: EntitlementOwnerContext,
  observedAtISO = nowISO(),
): Promise<EntitlementSnapshotRead> {
  const canonicalObservedAt = isoOrNull(observedAtISO);
  if (!canonicalObservedAt) return { status: 'unavailable', snapshot: null };
  try {
    await assertCurrentOwnerContext(context);
    let absent = false;
    let snapshot: EntitlementSnapshot | null = null;
    await updatePrivateItem(KEY, (raw) => {
      if (raw === null) {
        absent = true;
        return null;
      }
      const current = decodeEntitlementEnvelope(raw);
      if (current.ownerBinding !== context.ownerBinding) {
        throw new Error(ENTITLEMENT_CACHE_FOREIGN_OWNER);
      }
      const advanced = advanceEntitlementClock(current, canonicalObservedAt);
      snapshot = snapshotFromEnvelope(advanced, canonicalObservedAt);
      return advanced === current ? raw : encodeEntitlementEnvelope(advanced);
    });
    if (snapshot) return { status: 'available', snapshot };
    if (!absent) return { status: 'unavailable', snapshot: null };

    // Unbound bytes are never adopted or granted to whichever account happens
    // to sign in next. They remain intact until verified owner-bound evidence
    // replaces them or explicit account cleanup removes them.
    const legacy = await getPrivateItem(LEGACY_KEY);
    return legacy === null
      ? { status: 'absent', snapshot: null }
      : { status: 'legacy_unbound', snapshot: null };
  } catch (error) {
    return { status: readFailureStatus(error), snapshot: null };
  }
}

export async function readEntitlementCache(): Promise<EntitlementCacheRead> {
  let context: EntitlementOwnerContext;
  try {
    context = await currentEntitlementOwnerContext();
  } catch (error) {
    return { status: readFailureStatus(error), entitlement: null, snapshot: null };
  }
  const read = await readEntitlementSnapshot(context);
  return read.status === 'available'
    ? { status: 'available', entitlement: read.snapshot.entitlement, snapshot: read.snapshot }
    : { status: read.status, entitlement: null, snapshot: null };
}

export async function loadEntitlement(): Promise<StoredEntitlement | null> {
  const result = await readEntitlementCache();
  return result.status === 'available' ? result.entitlement : null;
}

function normalizedEvidence(evidence: EntitlementEvidence): EntitlementEvidence | null {
  if (!isRecord(evidence)) return null;
  if (evidence.kind === 'store_definitive') {
    const cursor = decodeStoreCursor(evidence.cursor);
    const entitlement =
      evidence.entitlement === null ? null : normalizeStoredEntitlement(evidence.entitlement);
    if (
      !cursor ||
      (evidence.state !== 'active' &&
        evidence.state !== 'inactive' &&
        evidence.state !== 'empty') ||
      (evidence.provenance !== 'revenuecat_verified' &&
        evidence.provenance !== 'server_snapshot' &&
        evidence.provenance !== 'server_webhook') ||
      (evidence.provenance === 'server_webhook') !== (cursor.kind === 'revenuecat_webhook') ||
      (evidence.entitlement !== null && !entitlement) ||
      (evidence.state === 'empty' && entitlement !== null) ||
      (evidence.state === 'active' && !entitlement?.isActive) ||
      (evidence.state === 'inactive' && (entitlement === null || entitlement.isActive))
    ) {
      return null;
    }
    return { ...evidence, cursor, entitlement };
  }
  if (
    evidence.kind !== 'store_provisional_active' &&
    evidence.kind !== 'legacy_positive' &&
    evidence.kind !== 'app_grant'
  ) {
    return null;
  }
  const entitlement = normalizeStoredEntitlement(evidence.entitlement);
  if (!entitlement) return null;
  if (evidence.kind === 'store_provisional_active') {
    const cursor = decodeStoreCursor(evidence.cursor);
    if (
      !entitlement.isActive ||
      evidence.provenance !== 'revenuecat_verified_on_device' ||
      cursor?.kind !== 'revenuecat_snapshot'
    ) {
      return null;
    }
    return { ...evidence, cursor, entitlement };
  }
  if (
    evidence.kind === 'legacy_positive' &&
    (!entitlement.isActive || evidence.provenance !== 'server_missing_cursor')
  ) {
    return null;
  }
  if (
    evidence.kind === 'app_grant' &&
    (entitlement.source !== 'app_granted' ||
      entitlement.store !== 'app_granted' ||
      entitlement.grantedAt !== evidence.grantAt)
  ) {
    return null;
  }
  return { ...evidence, entitlement };
}

export async function mergeEntitlementEvidenceBatch(
  context: EntitlementOwnerContext,
  candidates: readonly EntitlementEvidence[],
  observedAtISO = nowISO(),
): Promise<MergeEntitlementEvidenceResult> {
  const evidence = candidates.map(normalizedEvidence);
  const canonicalObservedAt = isoOrNull(observedAtISO);
  if (evidence.length === 0 || evidence.some((item) => item === null) || !canonicalObservedAt) {
    return {
      status: 'blocked',
      disposition: 'blocked',
      snapshot: null,
      requiresUncachedRefresh: false,
      reason: 'invalid_evidence',
    };
  }
  try {
    await assertCurrentOwnerContext(context);
    const mutation: {
      changed?: boolean;
      disposition?: MergeEntitlementEvidenceResult['disposition'];
      snapshot?: EntitlementSnapshot;
      storageChanged?: boolean;
      requiresUncachedRefresh?: boolean;
    } = {};
    await updatePrivateItem(KEY, (raw) => {
      let current: EntitlementCacheEnvelopeV2;
      let sanitizedRetiredCache = false;
      if (raw === null) {
        current = emptyEntitlementEnvelope(context.ownerBinding);
      } else {
        try {
          current = decodeEntitlementEnvelope(raw);
        } catch (error) {
          // Only definitive/provisional/app-grant evidence may replace old
          // owner-unbound formats. Weak evidence must not adopt their access.
          if (
            errorMessage(error) === ENTITLEMENT_CACHE_LEGACY_UNBOUND &&
            evidence.some((item) => item?.kind !== 'legacy_positive')
          ) {
            current = emptyEntitlementEnvelope(context.ownerBinding);
          } else if (
            errorMessage(error) === ENTITLEMENT_CACHE_INVALID &&
            hasDefinitiveReplacementEvidence(evidence)
          ) {
            const deprecated = decodeDeprecatedNotRequestedEnvelope(raw);
            if (!deprecated || deprecated.ownerBinding !== context.ownerBinding) throw error;
            current = deprecated;
            sanitizedRetiredCache = true;
          } else {
            throw error;
          }
        }
      }
      if (current.ownerBinding !== context.ownerBinding) {
        throw new Error(ENTITLEMENT_CACHE_FOREIGN_OWNER);
      }
      let merged = current;
      const dispositions: MergeEntitlementEvidenceResult['disposition'][] = [];
      let evidenceChanged = false;
      for (const item of evidence) {
        const result = mergeEntitlementEnvelope(merged, item!);
        merged = result.envelope;
        dispositions.push(result.disposition);
        evidenceChanged ||= result.changed;
      }
      merged = advanceEntitlementClock(merged, canonicalObservedAt);
      const projection = effectiveEntitlementProjection(merged, canonicalObservedAt);
      mutation.changed = evidenceChanged;
      mutation.disposition =
        projection.hasConflict && dispositions.includes('conflict')
          ? 'conflict'
          : dispositions.includes('applied')
            ? 'applied'
            : dispositions.every((item) => item === 'duplicate')
              ? 'duplicate'
              : dispositions.includes('stale')
                ? 'stale'
                : 'ignored';
      mutation.requiresUncachedRefresh = projection.hasConflict;
      mutation.storageChanged = sanitizedRetiredCache || merged !== current;
      mutation.snapshot = snapshotFromEnvelope(merged, canonicalObservedAt);
      if (!mutation.storageChanged) return raw;
      return encodeEntitlementEnvelope(merged);
    });
    const snapshot = mutation.snapshot;
    if (
      mutation.changed === undefined ||
      !mutation.disposition ||
      mutation.requiresUncachedRefresh === undefined ||
      !snapshot
    ) {
      return {
        status: 'blocked',
        disposition: 'blocked',
        snapshot: null,
        requiresUncachedRefresh: false,
        reason: 'merge_not_executed',
      };
    }
    return {
      status:
        mutation.disposition === 'conflict'
          ? 'conflict'
          : mutation.changed
            ? 'committed'
            : 'unchanged',
      disposition: mutation.disposition,
      snapshot,
      requiresUncachedRefresh: mutation.requiresUncachedRefresh,
    };
  } catch (error) {
    return {
      status: 'blocked',
      disposition: 'blocked',
      snapshot: null,
      requiresUncachedRefresh: false,
      reason: errorMessage(error),
    };
  }
}

export function mergeEntitlementEvidence(
  context: EntitlementOwnerContext,
  candidate: EntitlementEvidence,
  observedAtISO = nowISO(),
): Promise<MergeEntitlementEvidenceResult> {
  return mergeEntitlementEvidenceBatch(context, [candidate], observedAtISO);
}

export function customerInfoToEvidence(
  customerInfo: Pick<CustomerInfo, 'requestDate' | 'entitlements'>,
  entitlement: StoredEntitlement | null,
): EvidenceConversion {
  const requestDate = isoOrNull(customerInfo.requestDate);
  if (!requestDate) return { status: 'rejected', reason: 'invalid_request_date' };
  const normalized = entitlement ? normalizeStoredEntitlement(entitlement) : null;
  if (entitlement && !normalized) return { status: 'rejected', reason: 'invalid_entitlement' };
  const verification = customerInfo.entitlements.verification;
  const selected = customerInfo.entitlements.active[env.revenueCatEntitlementId] ?? null;
  const selectedActive = selected?.isActive === true;
  if (
    verification === 'FAILED' ||
    Object.values(customerInfo.entitlements.active).some((info) => info.verification === 'FAILED')
  ) {
    return { status: 'rejected', reason: 'verification_failed' };
  }
  if (verification === 'NOT_REQUESTED') {
    return { status: 'rejected', reason: 'verification_not_requested' };
  }
  if (
    selectedActive !== (normalized?.isActive === true) ||
    (selectedActive && selected?.verification !== verification)
  ) {
    return { status: 'rejected', reason: 'verification_mismatch' };
  }
  const attributed = normalized
    ? { ...normalized, source: 'revenuecat' as const, verifiedAt: requestDate }
    : null;

  if (verification === 'VERIFIED') {
    const state = attributed?.isActive ? 'active' : attributed ? 'inactive' : 'empty';
    return {
      status: 'evidence',
      evidence: {
        kind: 'store_definitive',
        cursor: {
          kind: 'revenuecat_snapshot',
          requestDate,
          fingerprint: entitlementEvidenceFingerprint(state, attributed),
        },
        state,
        entitlement: attributed,
        provenance: 'revenuecat_verified',
      },
    };
  }
  if (verification === 'VERIFIED_ON_DEVICE') {
    if (!attributed?.isActive) return { status: 'ignored', reason: 'verified_on_device_empty' };
    // This lane is intentionally positive-only and never advances the
    // definitive empty/inactive watermark.
    return {
      status: 'evidence',
      evidence: {
        kind: 'store_provisional_active',
        cursor: {
          kind: 'revenuecat_snapshot',
          requestDate,
          fingerprint: entitlementEvidenceFingerprint('active', attributed),
        },
        entitlement: { ...attributed, verifiedAt: null },
        provenance: 'revenuecat_verified_on_device',
      },
    };
  }
  return { status: 'rejected', reason: 'verification_unknown' };
}

export function rowToStoredEntitlement(row: EntitlementRow): StoredEntitlement {
  const appGranted = row.store === 'app_granted' || row.source === 'app_granted';
  return {
    tier: asTier(row.entitlement),
    isActive: row.is_active,
    periodType: asPeriod(row.period_type),
    store: asStore(row.store),
    productId: appGranted ? null : row.product_id,
    expiresAt: isoOrNull(row.expires_at),
    willRenew: row.will_renew,
    grantedAt: isoOrNull(row.original_purchase_at),
    source: appGranted ? 'app_granted' : (asSource(row.source) ?? 'server'),
    environment: asEnvironment(row.environment),
    managementUrl: safeExternalHttpsUrl(row.management_url),
    // Processing times are display provenance only. They are never an ordering
    // cursor and there is deliberately no updated_at/Date.now fallback.
    verifiedAt: isoOrNull(row.verified_at),
    offeringId: appGranted ? null : (row.offering_id ?? null),
    packageId: appGranted ? null : (row.package_id ?? null),
    storeUserId: row.store_user_id ?? null,
    priceLabel: null,
  };
}

export function rowToEvidence(row: EntitlementRow): EvidenceConversion {
  const entitlement = normalizeStoredEntitlement(rowToStoredEntitlement(row));
  if (!entitlement) return { status: 'rejected', reason: 'invalid_entitlement' };
  if (entitlement.store === 'app_granted' || entitlement.source === 'app_granted') {
    if (!entitlement.grantedAt) {
      return { status: 'rejected', reason: 'missing_app_grant_cursor' };
    }
    return {
      status: 'evidence',
      evidence: { kind: 'app_grant', grantAt: entitlement.grantedAt, entitlement },
    };
  }

  const eventAt = isoOrNull(row.rc_event_at);
  const priority = row.rc_event_priority;
  const eventId = row.rc_event_id;
  if (
    !eventAt ||
    !Number.isSafeInteger(priority) ||
    (priority as number) < 0 ||
    (priority as number) > 32_767 ||
    !printableAscii(eventId)
  ) {
    if (!entitlement.isActive) return { status: 'ignored', reason: 'missing_store_cursor' };
    return {
      status: 'evidence',
      evidence: {
        kind: 'legacy_positive',
        provenance: 'server_missing_cursor',
        entitlement,
      },
    };
  }
  return {
    status: 'evidence',
    evidence: {
      kind: 'store_definitive',
      cursor: {
        kind: 'revenuecat_webhook',
        eventAt,
        priority: priority as number,
        eventId,
      },
      state: entitlement.isActive ? 'active' : 'inactive',
      entitlement,
      provenance: 'server_webhook',
    },
  };
}

type StrictDecode<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>;

const WIRE_ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function nullableBoundedString(value: unknown, maxLength = 2_048): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= maxLength &&
      value.trim() === value)
  );
}

function decodeNullableISO(value: unknown): StrictDecode<string | null> {
  if (value === null) return { ok: true, value: null };
  const normalized =
    typeof value === 'string' && WIRE_ISO_INSTANT_PATTERN.test(value) ? isoOrNull(value) : null;
  return normalized ? { ok: true, value: normalized } : { ok: false };
}

function decodeProjectionCursor(value: unknown): StrictDecode<ProjectionCursor> {
  if (value === null) return { ok: true, value: null };
  if (!isRecord(value) || typeof value.kind !== 'string') return { ok: false };
  if (value.kind === 'rc_webhook') {
    const at =
      typeof value.at === 'string' && WIRE_ISO_INSTANT_PATTERN.test(value.at)
        ? isoOrNull(value.at)
        : null;
    if (
      !hasExactKeys(value, ['kind', 'at', 'priority', 'event_id']) ||
      !at ||
      !Number.isSafeInteger(value.priority) ||
      (value.priority as number) < 0 ||
      (value.priority as number) > 32_767 ||
      !printableAscii(value.event_id)
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      value: {
        kind: 'rc_webhook',
        at,
        priority: value.priority as number,
        event_id: value.event_id,
      },
    };
  }
  if (value.kind === 'rc_snapshot') {
    const at =
      typeof value.at === 'string' && WIRE_ISO_INSTANT_PATTERN.test(value.at)
        ? isoOrNull(value.at)
        : null;
    if (
      !hasExactKeys(value, ['kind', 'at', 'fingerprint']) ||
      !at ||
      typeof value.fingerprint !== 'string' ||
      value.fingerprint.length === 0 ||
      value.fingerprint.length > 2_048
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      value: { kind: 'rc_snapshot', at, fingerprint: value.fingerprint },
    };
  }
  return { ok: false };
}

function decodeProjectionRow(value: unknown): StrictDecode<ProjectionRow> {
  if (!isRecord(value) || !hasExactKeys(value, PROJECTION_ROW_KEYS)) return { ok: false };
  const cursor = decodeProjectionCursor(value.cursor);
  const expiresAt = decodeNullableISO(value.expires_at);
  const grantedAt = decodeNullableISO(value.granted_at);
  const verifiedAt = decodeNullableISO(value.verified_at);
  const store =
    value.store === null ? null : typeof value.store === 'string' ? value.store : undefined;
  const periodType =
    value.period_type === null
      ? null
      : typeof value.period_type === 'string'
        ? value.period_type
        : undefined;
  const source =
    value.source === null ? null : typeof value.source === 'string' ? value.source : undefined;
  const environment =
    value.environment === null
      ? null
      : typeof value.environment === 'string'
        ? value.environment
        : undefined;
  if (
    !cursor.ok ||
    !(value.tier === null || value.tier === 'pro' || value.tier === 'pro_plus') ||
    typeof value.is_active !== 'boolean' ||
    !nullableBoundedString(value.product_id) ||
    !expiresAt.ok ||
    store === undefined ||
    (store !== null && asStore(store) === null) ||
    periodType === undefined ||
    (periodType !== null && asPeriod(periodType) === null) ||
    !(value.will_renew === null || typeof value.will_renew === 'boolean') ||
    !grantedAt.ok ||
    source === undefined ||
    (source !== null && asSource(source) === null) ||
    environment === undefined ||
    (environment !== null && asEnvironment(environment) === null) ||
    !nullableBoundedString(value.management_url) ||
    (value.management_url !== null &&
      safeExternalHttpsUrl(value.management_url) !== value.management_url) ||
    !verifiedAt.ok ||
    !nullableBoundedString(value.offering_id) ||
    !nullableBoundedString(value.package_id)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      tier: value.tier,
      is_active: value.is_active,
      product_id: value.product_id,
      expires_at: expiresAt.value,
      store,
      period_type: periodType,
      will_renew: value.will_renew,
      granted_at: grantedAt.value,
      source,
      environment,
      management_url: value.management_url,
      verified_at: verifiedAt.value,
      offering_id: value.offering_id,
      package_id: value.package_id,
      cursor: cursor.value,
    },
  };
}

function decodeProjectionResponse(value: unknown): StrictDecode<EntitlementProjectionResponse> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, PROJECTION_RESPONSE_KEYS) ||
    value.schema_version !== 1 ||
    !isRecord(value.store_projection) ||
    !hasExactKeys(value.store_projection, PROJECTION_KEYS) ||
    !isRecord(value.app_grant_projection) ||
    !hasExactKeys(value.app_grant_projection, PROJECTION_KEYS)
  ) {
    return { ok: false };
  }

  const storeState = value.store_projection.state;
  const appGrantState = value.app_grant_projection.state;
  const storeRow =
    value.store_projection.row === null
      ? ({ ok: true, value: null } as const)
      : decodeProjectionRow(value.store_projection.row);
  const appGrantRow =
    value.app_grant_projection.row === null
      ? ({ ok: true, value: null } as const)
      : decodeProjectionRow(value.app_grant_projection.row);
  if (
    !storeRow.ok ||
    !appGrantRow.ok ||
    (storeState !== 'active' &&
      storeState !== 'inactive' &&
      storeState !== 'legacy_unknown' &&
      storeState !== 'absent') ||
    (appGrantState !== 'active' && appGrantState !== 'inactive' && appGrantState !== 'absent')
  ) {
    return { ok: false };
  }

  const coherentStore =
    (storeState === 'absent' && storeRow.value === null) ||
    (storeState === 'legacy_unknown' &&
      storeRow.value !== null &&
      storeRow.value.tier !== null &&
      !storeRow.value.is_active &&
      storeRow.value.cursor === null &&
      storeRow.value.source === 'revenuecat') ||
    ((storeState === 'active' || storeState === 'inactive') &&
      storeRow.value !== null &&
      storeRow.value.cursor !== null &&
      storeRow.value.source === 'revenuecat' &&
      storeRow.value.is_active === (storeState === 'active'));
  const coherentAppGrant =
    (appGrantState === 'absent' && appGrantRow.value === null) ||
    ((appGrantState === 'active' || appGrantState === 'inactive') &&
      appGrantRow.value !== null &&
      appGrantRow.value.cursor === null &&
      appGrantRow.value.tier !== null &&
      appGrantRow.value.source === 'app_granted' &&
      appGrantRow.value.store === 'app_granted' &&
      appGrantRow.value.period_type === 'reverse_trial' &&
      appGrantRow.value.product_id === null &&
      appGrantRow.value.offering_id === null &&
      appGrantRow.value.package_id === null &&
      appGrantRow.value.management_url === null &&
      appGrantRow.value.will_renew === false &&
      appGrantRow.value.granted_at !== null &&
      appGrantRow.value.expires_at !== null &&
      appGrantRow.value.is_active === (appGrantState === 'active'));
  if (!coherentStore || !coherentAppGrant) return { ok: false };

  return {
    ok: true,
    value: {
      schema_version: 1,
      store_projection: { state: storeState, row: storeRow.value },
      app_grant_projection: { state: appGrantState, row: appGrantRow.value },
    },
  };
}

function projectionRowToEntitlement(row: ProjectionRow): StoredEntitlement | null {
  return normalizeStoredEntitlement({
    tier: row.tier,
    isActive: row.is_active,
    periodType: row.period_type,
    store: row.store,
    productId: row.product_id,
    expiresAt: row.expires_at,
    willRenew: row.will_renew,
    grantedAt: row.granted_at,
    source: row.source,
    environment: row.environment,
    managementUrl: row.management_url,
    verifiedAt: row.verified_at,
    offeringId: row.offering_id,
    packageId: row.package_id,
    storeUserId: null,
    priceLabel: null,
  });
}

function projectionCursorToStoreCursor(
  cursor: Exclude<ProjectionCursor, null>,
): StoreEvidenceCursor {
  return cursor.kind === 'rc_webhook'
    ? {
        kind: 'revenuecat_webhook',
        eventAt: cursor.at,
        priority: cursor.priority,
        eventId: cursor.event_id,
      }
    : {
        kind: 'revenuecat_snapshot',
        requestDate: cursor.at,
        fingerprint: cursor.fingerprint,
      };
}

function projectionEvidence(
  response: EntitlementProjectionResponse,
): StrictDecode<readonly EntitlementEvidence[]> {
  const evidence: EntitlementEvidence[] = [];
  const store = response.store_projection;
  if (store.state === 'active' || store.state === 'inactive') {
    const row = store.row;
    if (!row || !row.cursor) return { ok: false };
    const entitlement = row.tier === null ? null : projectionRowToEntitlement(row);
    const state = row.tier === null ? 'empty' : store.state;
    if (
      (row.tier !== null && !entitlement) ||
      (state === 'active' && !entitlement?.isActive) ||
      (state === 'inactive' && (entitlement === null || entitlement.isActive)) ||
      (state === 'empty' && row.is_active)
    ) {
      return { ok: false };
    }
    evidence.push({
      kind: 'store_definitive',
      cursor: projectionCursorToStoreCursor(row.cursor),
      state,
      entitlement,
      provenance: row.cursor.kind === 'rc_webhook' ? 'server_webhook' : 'server_snapshot',
    });
  }

  const appGrant = response.app_grant_projection;
  if (appGrant.state === 'active' || appGrant.state === 'inactive') {
    const row = appGrant.row;
    if (!row?.granted_at) return { ok: false };
    const entitlement = projectionRowToEntitlement(row);
    if (!entitlement || entitlement.isActive !== (appGrant.state === 'active')) {
      return { ok: false };
    }
    evidence.push({ kind: 'app_grant', grantAt: row.granted_at, entitlement });
  }
  return { ok: true, value: evidence };
}

export async function publishCustomerInfoEvidence(
  input: Readonly<{
    context: EntitlementOwnerContext;
    customerInfo: Pick<CustomerInfo, 'requestDate' | 'entitlements'>;
    entitlement: StoredEntitlement | null;
    queryClient: Pick<QueryClient, 'cancelQueries' | 'setQueryData'>;
    observedAtISO?: string;
  }>,
): Promise<PublishCustomerInfoEvidenceResult> {
  const queryKey = entitlementQueryKey(input.context.ownerBinding);
  try {
    await input.queryClient.cancelQueries({ queryKey, exact: true });
  } catch (error) {
    return {
      status: 'blocked',
      disposition: 'blocked',
      snapshot: null,
      requiresUncachedRefresh: false,
      reason: errorMessage(error),
    };
  }

  const conversion = customerInfoToEvidence(input.customerInfo, input.entitlement);
  if (conversion.status !== 'evidence') {
    const current = await readEntitlementSnapshot(input.context, input.observedAtISO ?? nowISO());
    if (current.status === 'available') {
      input.queryClient.setQueryData(
        queryKey,
        deriveState(current.snapshot.entitlement, current.snapshot.effectiveNowISO),
      );
    }
    return {
      status: conversion.status,
      disposition: 'ignored',
      snapshot: current.status === 'available' ? current.snapshot : null,
      requiresUncachedRefresh:
        current.status === 'available' ? current.snapshot.requiresUncachedRefresh : false,
      reason: conversion.reason,
    };
  }

  const merged = await mergeEntitlementEvidence(
    input.context,
    conversion.evidence,
    input.observedAtISO ?? nowISO(),
  );
  if (merged.snapshot) {
    input.queryClient.setQueryData(
      queryKey,
      deriveState(merged.snapshot.entitlement, merged.snapshot.effectiveNowISO),
    );
  }
  return merged;
}

export async function fetchServerEvidence(
  context: EntitlementOwnerContext,
  signal: AbortSignal,
): Promise<ServerEvidenceResult> {
  if (!isSupabaseConfigured) return { status: 'unconfigured' };
  try {
    await assertCurrentOwnerContext(context);
    const readProjection = async (): Promise<
      | Readonly<{ status: 'available'; response: EntitlementProjectionResponse }>
      | Readonly<{ status: 'transport_error' | 'rejected'; reason: string }>
    > => {
      await assertCurrentOwnerContext(context);
      const { data, error } = await supabase
        .rpc('read_entitlement_projections')
        .abortSignal(signal);
      await assertCurrentOwnerContext(context);
      if (error) return { status: 'transport_error', reason: 'server_projection_query_failed' };
      const decoded = decodeProjectionResponse(data);
      return decoded.ok
        ? { status: 'available', response: decoded.value }
        : { status: 'rejected', reason: 'server_projection_invalid' };
    };

    const resultForProjection = (response: EntitlementProjectionResponse): ServerEvidenceResult => {
      const converted = projectionEvidence(response);
      if (!converted.ok) return { status: 'rejected', reason: 'server_projection_invalid' };
      if (converted.value.length > 0) return { status: 'evidence', evidence: converted.value };
      return response.store_projection.state === 'legacy_unknown'
        ? { status: 'ignored', reason: 'legacy_store_projection_unresolved' }
        : { status: 'absent' };
    };

    const first = await readProjection();
    if (first.status !== 'available') return first;
    const firstResult = resultForProjection(first.response);
    if (firstResult.status === 'rejected') return firstResult;
    if (first.response.store_projection.state !== 'legacy_unknown') return firstResult;

    // The owner-scoped reconciliation function receives no subject or row
    // identifier from the client. It derives the authenticated owner on the
    // server and only two terminal outcomes authorize one fresh RPC read.
    await assertCurrentOwnerContext(context);
    const { data: reconciliation, error: reconciliationError } = await supabase.functions.invoke(
      'subscription-reconciliation',
      { body: {}, signal },
    );
    await assertCurrentOwnerContext(context);
    const reconciliationAccepted =
      !reconciliationError &&
      isRecord(reconciliation) &&
      hasExactKeys(reconciliation, ['outcome']) &&
      (reconciliation.outcome === 'reconciled' || reconciliation.outcome === 'already_current');
    if (!reconciliationAccepted) {
      return firstResult.status === 'evidence'
        ? firstResult
        : { status: 'transport_error', reason: 'subscription_reconciliation_failed' };
    }

    const second = await readProjection();
    if (second.status !== 'available') {
      return firstResult.status === 'evidence' ? firstResult : second;
    }
    return resultForProjection(second.response);
  } catch (error) {
    return {
      status:
        errorMessage(error) === ENTITLEMENT_CACHE_FOREIGN_OWNER ? 'blocked' : 'transport_error',
      reason: errorMessage(error),
    };
  }
}

/** Compatibility fetch: absence and transport failure return the local union. */
export async function fetchServerEntitlement(): Promise<StoredEntitlement | null> {
  if (!isSupabaseConfigured) return loadEntitlement();
  try {
    return await runAccountGenerationOperation(async (lease) => {
      const context = await currentEntitlementOwnerContext();
      lease.assertCurrent();
      const fetched = await fetchServerEvidence(context, lease.signal);
      lease.assertCurrent();
      if (fetched.status === 'evidence') {
        const merged = await mergeEntitlementEvidenceBatch(context, fetched.evidence);
        lease.assertCurrent();
        return merged.snapshot?.entitlement ?? null;
      }
      const local = await readEntitlementSnapshot(context);
      lease.assertCurrent();
      return local.status === 'available' ? local.snapshot.entitlement : null;
    });
  } catch {
    return null;
  }
}

/**
 * Compatibility wrapper retained only for app-granted evidence. Store evidence
 * without its verification result and ordering cursor is rejected.
 */
export async function saveVerifiedEntitlement(
  entitlement: StoredEntitlement,
): Promise<StoredEntitlement> {
  const normalized = normalizeStoredEntitlement(entitlement);
  if (!normalized) throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  if (
    normalized.store !== 'app_granted' ||
    normalized.source !== 'app_granted' ||
    !normalized.grantedAt
  ) {
    throw new Error(ENTITLEMENT_EVIDENCE_CURSOR_REQUIRED);
  }
  const context = await currentEntitlementOwnerContext();
  const result = await mergeEntitlementEvidence(context, {
    kind: 'app_grant',
    grantAt: normalized.grantedAt,
    entitlement: normalized,
  });
  if (!result.snapshot || result.status === 'blocked' || result.status === 'conflict') {
    throw new Error(result.reason ?? ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
  }
  return normalized;
}

/** Compatibility helper that still requires the complete aggregate verification
 * result. A timestamp alone is never accepted as proof of a definitive empty. */
export async function clearStoreEntitlementIfRevenueCatVerifiedEmpty(
  customerInfo?: Pick<CustomerInfo, 'requestDate' | 'entitlements'>,
): Promise<'committed' | 'blocked'> {
  if (!customerInfo) return 'blocked';
  const conversion = customerInfoToEvidence(customerInfo, null);
  if (
    conversion.status !== 'evidence' ||
    conversion.evidence.kind !== 'store_definitive' ||
    conversion.evidence.state !== 'empty'
  ) {
    return 'blocked';
  }
  try {
    const context = await currentEntitlementOwnerContext();
    const result = await mergeEntitlementEvidence(context, conversion.evidence);
    return result.status === 'blocked' ? 'blocked' : 'committed';
  } catch {
    return 'blocked';
  }
}

/** Expiry is derived from the nondecreasing clock; no authority lane is erased. */
export async function downgradeToFree(): Promise<void> {
  try {
    const context = await currentEntitlementOwnerContext();
    await readEntitlementSnapshot(context);
  } catch {
    // This UI convenience must never overwrite unreadable or foreign bytes.
  }
}

async function commitAppGrant(
  context: EntitlementOwnerContext,
  entitlement: StoredEntitlement,
): Promise<StoredEntitlement> {
  const normalized = normalizeStoredEntitlement(entitlement);
  if (!normalized?.grantedAt) throw new Error('INVALID_APP_GRANT_EVIDENCE');
  const result = await mergeEntitlementEvidence(context, {
    kind: 'app_grant',
    grantAt: normalized.grantedAt,
    entitlement: normalized,
  });
  if (!result.snapshot || result.status === 'blocked' || result.status === 'conflict') {
    throw new Error(result.reason ?? ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED);
  }
  return normalized;
}

export async function startReverseTrialOnServer(): Promise<StoredEntitlement> {
  return runAccountGenerationOperation(async (lease) => {
    if (!env.customProGrantEnabled) {
      throw new Error('CUSTOM_PRO_GRANT_DISABLED');
    }
    if (!isSupabaseConfigured) {
      throw new Error('Reverse trial is unavailable until Supabase is configured.');
    }

    const context = await currentEntitlementOwnerContext();
    lease.assertCurrent();
    const { data, error } = await supabase.functions.invoke('subscription-grants', {
      body: { action: 'start_reverse_trial' },
      signal: lease.signal,
    });
    lease.assertCurrent();
    if (error) throw error;
    const row = (data as { entitlement?: EntitlementRow })?.entitlement;
    if (!row) throw new Error('Reverse trial grant did not return an entitlement.');
    const conversion = rowToEvidence(row);
    if (conversion.status !== 'evidence' || conversion.evidence.kind !== 'app_grant') {
      throw new Error('Reverse trial grant returned invalid app-grant evidence.');
    }
    const entitlement = await commitAppGrant(context, conversion.evidence.entitlement);
    lease.assertCurrent();
    return entitlement;
  });
}

/** Explicit account-cleanup/test reset. */
export async function clearEntitlement(): Promise<void> {
  await multiRemovePrivateItems([KEY, LEGACY_KEY]);
}

export const entitlementCacheStorageKeys = { current: KEY, legacy: LEGACY_KEY } as const;
export const entitlementCacheSchemaVersion = ENTITLEMENT_CACHE_SCHEMA_VERSION;
export const entitlementCursorProviderAt = storeCursorProviderAt;
