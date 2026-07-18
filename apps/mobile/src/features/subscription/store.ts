import {
  ACCOUNT_GENERATION_CHANGED,
  getAccountGeneration,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { env, isSupabaseConfigured, type AppEnvironment } from '@/lib/env';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { invokeEdgeFunction } from '@/lib/network/edgeFunctions';
import {
  runRequestWithLease,
  supabaseRequestFailure,
} from '@/lib/network/requestPolicy';
import { supabase } from '@/lib/supabase/client';
import {
  PRIVATE_KV_DECRYPTION_FAILED,
  PRIVATE_KV_ENVELOPE_INVALID,
  PRIVATE_KV_ENVELOPE_UNSUPPORTED,
  getPrivateItem,
  multiRemovePrivateItems,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

import { deriveState, type StoredEntitlement } from './entitlement';
import { classifyEntitlementEvidence } from './entitlementEvidence';
import { selectLatestAuthoritativeEntitlementEvidence } from './entitlementOrdering';

/**
 * Local-first entitlement cache. This is only a cache of RevenueCat CustomerInfo
 * or service-role Supabase grants; production flows never create paid/trial access
 * locally. Offline Pro access remains usable only after a verified grant has been
 * cached on this device.
 */
const KEY = 'onskin.entitlement.v2';
const LEGACY_KEY = 'onskin.entitlement.v1';
const REVENUECAT_EMPTY_KEY = LEGACY_KEY;
const LOCAL_REVERSE_TRIAL_DAYS = 7;
const PROOF_ENVELOPE_VERSION = 1 as const;
const WATERMARK_SCHEMA_VERSION = 2 as const;
const VERIFICATION_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export const ENTITLEMENT_CACHE_INVALID = 'ENTITLEMENT_CACHE_INVALID';
export const ENTITLEMENT_CACHE_UNSUPPORTED_VERSION = 'ENTITLEMENT_CACHE_UNSUPPORTED_VERSION';
export const ENTITLEMENT_ACTIVE_PROVIDER_BARRIER =
  'ENTITLEMENT_ACTIVE_PROVIDER_BARRIER';

type RevenueCatEmptyWatermark = Readonly<{
  verifiedAt: string;
  managementUrl: string | null;
  storeUserId: string | null;
}>;

type EntitlementCacheState = Readonly<{
  entitlement: StoredEntitlement | null;
  revenueCatEmpty: RevenueCatEmptyWatermark | null;
  trustedRevenueCatProof: TrustedRevenueCatProofMarker | null;
  /** Mutation-only ordering barrier recovered from a durable proof whose
   * sidecar phase did not commit. Public reads never authorize from it. */
  provisionalProviderBarrier?: ProvisionalProviderBarrier | null;
}>;

type ProvisionalProviderBarrier = Readonly<{
  kind: 'active_proof' | 'revocation';
  verifiedAt: string;
  managementUrl: string | null;
  storeUserId: string | null;
  /** Allows the exact trusted CustomerInfo retry to complete phase three. */
  exactRevenueCatProofIdentity: string | null;
}>;

type RevenueCatEmptyEnvelope = {
  version: typeof WATERMARK_SCHEMA_VERSION;
  revenueCatEmpty: RevenueCatEmptyWatermark | null;
  trustedRevenueCatProof: TrustedRevenueCatProofMarker | null;
};

type TrustedRevenueCatProofMarker = Readonly<{
  storeUserId: string;
  proofIdentity: string;
}>;

type RevenueCatSidecar = Readonly<{
  revenueCatEmpty: RevenueCatEmptyWatermark | null;
  trustedRevenueCatProof: TrustedRevenueCatProofMarker | null;
}>;

const ENTITLEMENT_CACHE_V1_ENVELOPE_KEYS = ['version', 'entitlement'] as const;
const REVENUECAT_EMPTY_ENVELOPE_KEYS = [
  'version',
  'revenueCatEmpty',
  'trustedRevenueCatProof',
] as const;
const REVENUECAT_EMPTY_WATERMARK_KEYS = [
  'verifiedAt',
  'managementUrl',
  'storeUserId',
] as const;
const TRUSTED_REVENUECAT_PROOF_KEYS = ['storeUserId', 'proofIdentity'] as const;
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

export type RevenueCatVerifiedEmptyEvidence = Readonly<{
  verifiedAt: string;
  managementUrl?: string | null;
  storeUserId?: string | null;
}>;

export type EntitlementCacheRead =
  | {
      status: 'available';
      entitlement: StoredEntitlement;
      revenueCatEmpty?: RevenueCatVerifiedEmptyEvidence;
    }
  | {
      status: 'absent' | 'unavailable' | 'corrupt' | 'unsupported_version';
      entitlement: null;
      revenueCatEmpty?: RevenueCatVerifiedEmptyEvidence;
    };

export type EntitlementAcceptance = Readonly<{
  entitlement: StoredEntitlement | null;
  revenueCatEmpty: RevenueCatVerifiedEmptyEvidence | null;
  persisted: boolean;
}>;

export type ServerEntitlementFetchResult =
  | Readonly<{ status: 'evidence'; acceptance: EntitlementAcceptance }>
  | Readonly<{ status: 'no_evidence' }>
  | Readonly<{ status: 'failure' }>;

export type ReverseTrialStartAcceptance = EntitlementAcceptance &
  Readonly<{
    /** True only when this action's exact owner-bound grant won the commit race. */
    started: boolean;
  }>;

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
};

function nowISO(): string {
  return new Date().toISOString();
}

function daysFromNowISO(days: number): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
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
    value === 'test_store'
  ) {
    return value;
  }
  return null;
}

function asSource(value: string | null | undefined): StoredEntitlement['source'] {
  if (
    value === 'revenuecat' ||
    value === 'app_granted' ||
    value === 'server' ||
    value === 'local_cache'
  )
    return value;
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

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function isoOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function isCanonicalNullableText(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && stringOrNull(value) === value);
}

function isCanonicalNullableISO(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isoOrNull(value) === value);
}

function isCanonicalNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function isStrictCurrentEntitlement(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !hasExactKeys(value, ENTITLEMENT_CACHE_RECORD_KEYS)) return false;

  const tier = typeof value.tier === 'string' ? asTier(value.tier) : null;
  const periodType =
    value.periodType === null ||
    (typeof value.periodType === 'string' && asPeriod(value.periodType) === value.periodType);
  const store =
    value.store === null ||
    (typeof value.store === 'string' && asStore(value.store) === value.store);
  const source =
    value.source === null ||
    (typeof value.source === 'string' && asSource(value.source) === value.source);
  const environment =
    value.environment === null ||
    (typeof value.environment === 'string' &&
      asEnvironment(value.environment) === value.environment);
  const managementUrl =
    value.managementUrl === null ||
    (typeof value.managementUrl === 'string' &&
      safeExternalHttpsUrl(value.managementUrl) === value.managementUrl);

  return (
    tier !== null &&
    tier === value.tier &&
    typeof value.isActive === 'boolean' &&
    periodType &&
    store &&
    isCanonicalNullableText(value.productId) &&
    isCanonicalNullableISO(value.expiresAt) &&
    isCanonicalNullableBoolean(value.willRenew) &&
    isCanonicalNullableISO(value.grantedAt) &&
    source &&
    environment &&
    managementUrl &&
    isCanonicalNullableISO(value.verifiedAt) &&
    isCanonicalNullableText(value.offeringId) &&
    isCanonicalNullableText(value.packageId) &&
    isCanonicalNullableText(value.storeUserId) &&
    isCanonicalNullableText(value.priceLabel)
  );
}

function normalizeStoredEntitlement(value: unknown): StoredEntitlement | null {
  if (!isRecord(value)) return null;

  const tier = asTier(stringOrNull(value.tier));
  if (!tier) return null;

  const periodType = asPeriod(stringOrNull(value.periodType));
  const store = asStore(stringOrNull(value.store));
  const source = asSource(stringOrNull(value.source));
  const environment = asEnvironment(stringOrNull(value.environment));
  const verifiedAt = isoOrNull(value.verifiedAt);
  const grantedAt = isoOrNull(value.grantedAt);
  const expiresAt = isoOrNull(value.expiresAt);
  const rawActive = booleanOrNull(value.isActive) ?? false;
  const activeHasVerifiedSource = Boolean(source && verifiedAt);
  const timeBoxed =
    periodType === 'reverse_trial' ||
    periodType === 'trial' ||
    periodType === 'intro' ||
    periodType === 'prepaid' ||
    source === 'app_granted' ||
    store === 'app_granted';
  const activeHasRequiredExpiry = !timeBoxed || Boolean(expiresAt);
  const devGrantedInNonDev =
    source === 'app_granted' &&
    environment === 'development' &&
    env.appEnvironment !== 'development';
  const testStoreInProduction =
    env.appEnvironment === 'production' && (store === 'test_store' || environment === 'test_store');
  const reverseTrialHasAppGrantShape =
    periodType !== 'reverse_trial' ||
    (store === 'app_granted' && (source === 'app_granted' || source === 'server'));

  if (!reverseTrialHasAppGrantShape) return null;

  return {
    tier,
    isActive:
      rawActive &&
      activeHasVerifiedSource &&
      activeHasRequiredExpiry &&
      !devGrantedInNonDev &&
      !testStoreInProduction,
    periodType,
    store,
    productId: stringOrNull(value.productId),
    expiresAt,
    willRenew: booleanOrNull(value.willRenew),
    grantedAt,
    source,
    environment,
    managementUrl: safeExternalHttpsUrl(stringOrNull(value.managementUrl)),
    verifiedAt,
    offeringId: stringOrNull(value.offeringId),
    packageId: stringOrNull(value.packageId),
    storeUserId: stringOrNull(value.storeUserId),
    priceLabel: stringOrNull(value.priceLabel),
  };
}

function normalizeRevenueCatEmptyWatermark(
  value: unknown,
): RevenueCatEmptyWatermark | null {
  if (!isRecord(value)) return null;
  const verifiedAt = isoOrNull(value.verifiedAt);
  const managementUrl = safeExternalHttpsUrl(stringOrNull(value.managementUrl));
  const storeUserId = stringOrNull(value.storeUserId);
  if (
    !verifiedAt ||
    (value.managementUrl !== null && !managementUrl) ||
    (value.storeUserId !== null && !storeUserId)
  ) {
    return null;
  }
  return { verifiedAt, managementUrl, storeUserId };
}

function isStrictRevenueCatEmptyWatermark(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, REVENUECAT_EMPTY_WATERMARK_KEYS)) return false;
  const normalized = normalizeRevenueCatEmptyWatermark(value);
  return (
    normalized !== null &&
    REVENUECAT_EMPTY_WATERMARK_KEYS.every((key) => value[key] === normalized[key])
  );
}

function entitlementCacheError(code: string): Error {
  return new Error(code);
}

function decodeEntitlementProof(raw: string): StoredEntitlement {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }

  if (!isRecord(parsed)) throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);

  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== PROOF_ENVELOPE_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > PROOF_ENVELOPE_VERSION
      ) {
        throw entitlementCacheError(ENTITLEMENT_CACHE_UNSUPPORTED_VERSION);
      }
      throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
    }
    if (
      !hasExactKeys(parsed, ENTITLEMENT_CACHE_V1_ENVELOPE_KEYS) ||
      !isStrictCurrentEntitlement(parsed.entitlement)
    ) {
      throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
    }
    parsed = parsed.entitlement;
  }

  if (
    isRecord(parsed) &&
    parsed.expiresAt !== null &&
    parsed.expiresAt !== undefined &&
    isoOrNull(parsed.expiresAt) === null
  ) {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }
  if (isRecord(parsed)) {
    const invalidOptionalEnum = <T extends string>(
      key: string,
      normalize: (value: string | null) => T | null,
    ) =>
      hasOwn(parsed, key) &&
      parsed[key] !== null &&
      (typeof parsed[key] !== 'string' || normalize(parsed[key] as string) !== parsed[key]);
    if (
      invalidOptionalEnum('periodType', asPeriod) ||
      invalidOptionalEnum('store', asStore) ||
      invalidOptionalEnum('source', (value) => asSource(value) ?? null) ||
      invalidOptionalEnum('environment', (value) => asEnvironment(value) ?? null) ||
      (hasOwn(parsed, 'storeUserId') &&
        parsed.storeUserId !== null &&
        (typeof parsed.storeUserId !== 'string' ||
          stringOrNull(parsed.storeUserId) !== parsed.storeUserId))
    ) {
      throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
    }
    const appGranted =
      parsed.source === 'app_granted' || parsed.store === 'app_granted';
    if (
      appGranted &&
      (typeof parsed.environment !== 'string' ||
        asEnvironment(parsed.environment) !== parsed.environment)
    ) {
      throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
    }
  }

  const entitlement = normalizeStoredEntitlement(parsed);
  if (!entitlement) throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  return entitlement;
}

/**
 * Keep v2 bytes readable by both older raw-record readers and the immediately
 * preceding version-1 envelope reader. New writes deliberately use the raw,
 * fully-normalized record instead of introducing another physical cache key.
 */
function encodeEntitlementProof(entitlement: StoredEntitlement): string {
  return JSON.stringify(entitlement);
}

function normalizeTrustedRevenueCatProofMarker(
  value: unknown,
): TrustedRevenueCatProofMarker | null {
  if (!isRecord(value) || !hasExactKeys(value, TRUSTED_REVENUECAT_PROOF_KEYS)) return null;
  const storeUserId = stringOrNull(value.storeUserId);
  const proofIdentity = stringOrNull(value.proofIdentity);
  if (!storeUserId || !proofIdentity) return null;
  if (value.storeUserId !== storeUserId || value.proofIdentity !== proofIdentity) return null;
  return { storeUserId, proofIdentity };
}

function decodeRevenueCatEmpty(raw: string): RevenueCatSidecar {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }
  if (!isRecord(parsed)) throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  if (parsed.version !== WATERMARK_SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > WATERMARK_SCHEMA_VERSION
    ) {
      throw entitlementCacheError(ENTITLEMENT_CACHE_UNSUPPORTED_VERSION);
    }
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }
  if (
    !hasExactKeys(parsed, REVENUECAT_EMPTY_ENVELOPE_KEYS) ||
    (parsed.revenueCatEmpty !== null &&
      !isStrictRevenueCatEmptyWatermark(parsed.revenueCatEmpty)) ||
    (parsed.trustedRevenueCatProof !== null &&
      normalizeTrustedRevenueCatProofMarker(parsed.trustedRevenueCatProof) === null)
  ) {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }
  const revenueCatEmpty =
    parsed.revenueCatEmpty === null
      ? null
      : normalizeRevenueCatEmptyWatermark(parsed.revenueCatEmpty);
  const trustedRevenueCatProof =
    parsed.trustedRevenueCatProof === null
      ? null
      : normalizeTrustedRevenueCatProofMarker(parsed.trustedRevenueCatProof);
  if (
    (parsed.revenueCatEmpty !== null && !revenueCatEmpty) ||
    (parsed.trustedRevenueCatProof !== null && !trustedRevenueCatProof) ||
    (!revenueCatEmpty && !trustedRevenueCatProof)
  ) {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }
  return { revenueCatEmpty, trustedRevenueCatProof };
}

function encodeRevenueCatEmpty(sidecar: RevenueCatSidecar): string {
  return JSON.stringify({
    version: WATERMARK_SCHEMA_VERSION,
    revenueCatEmpty: sidecar.revenueCatEmpty,
    trustedRevenueCatProof: sidecar.trustedRevenueCatProof,
  } satisfies RevenueCatEmptyEnvelope);
}

function decodeRevenueCatEmptyOrLegacyProof(raw: string): RevenueCatSidecar | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }
  if (isRecord(parsed) && parsed.version === WATERMARK_SCHEMA_VERSION) {
    return decodeRevenueCatEmpty(raw);
  }
  decodeEntitlementProof(raw);
  return null;
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

type PrivateDomainRead<T> =
  | { status: 'available'; value: T }
  | { status: 'absent' | 'unavailable' | 'corrupt' | 'unsupported_version'; value: null };

function classifyPrivateReadError<T>(error: unknown): PrivateDomainRead<T> {
  const message = errorMessage(error);
  if (
    message === ENTITLEMENT_CACHE_UNSUPPORTED_VERSION ||
    message === PRIVATE_KV_ENVELOPE_UNSUPPORTED
  ) {
    return { status: 'unsupported_version', value: null };
  }
  if (
    message === ENTITLEMENT_CACHE_INVALID ||
    message === PRIVATE_KV_ENVELOPE_INVALID ||
    message === PRIVATE_KV_DECRYPTION_FAILED
  ) {
    return { status: 'corrupt', value: null };
  }
  return { status: 'unavailable', value: null };
}

async function readPrivateDomainKey<T>(
  key: string,
  decode: (raw: string) => T,
): Promise<PrivateDomainRead<T>> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(key);
  } catch (error) {
    return classifyPrivateReadError(error);
  }
  if (raw === null) return { status: 'absent', value: null };
  try {
    return { status: 'available', value: decode(raw) };
  } catch (error) {
    return classifyPrivateReadError(error);
  }
}

function readEntitlementKey(key: string): Promise<PrivateDomainRead<StoredEntitlement>> {
  return readPrivateDomainKey(key, decodeEntitlementProof);
}

async function readRevenueCatEmptyKey(): Promise<PrivateDomainRead<RevenueCatSidecar>> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(REVENUECAT_EMPTY_KEY);
  } catch (error) {
    return classifyPrivateReadError(error);
  }
  if (raw === null) return { status: 'absent', value: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return classifyPrivateReadError(entitlementCacheError(ENTITLEMENT_CACHE_INVALID));
  }
  if (isRecord(parsed) && parsed.version === WATERMARK_SCHEMA_VERSION) {
    try {
      return { status: 'available', value: decodeRevenueCatEmpty(raw) };
    } catch (error) {
      return classifyPrivateReadError(error);
    }
  }

  // Raw v0 and strict-envelope v1 are legacy entitlement proofs, not a
  // watermark. Validate them here so malformed/future bytes still fail closed.
  try {
    decodeEntitlementProof(raw);
    return { status: 'absent', value: null };
  } catch (error) {
    return classifyPrivateReadError(error);
  }
}

export function rowToStoredEntitlement(row: EntitlementRow): StoredEntitlement {
  const tier = asTier(row.entitlement);
  const periodType = asPeriod(row.period_type);
  const store = asStore(row.store);
  const source = asSource(row.source);
  const environment = asEnvironment(row.environment);
  if (
    (row.entitlement !== null && tier === null) ||
    (row.period_type !== null && periodType === null) ||
    (row.store !== null && store === null) ||
    (row.source !== null && row.source !== undefined && source === null) ||
    (row.environment !== null && row.environment !== undefined && environment === null)
  ) {
    throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  }
  return {
    tier,
    isActive: row.is_active,
    periodType,
    store,
    productId: row.product_id,
    expiresAt: row.expires_at,
    willRenew: row.will_renew,
    grantedAt: row.original_purchase_at,
    source: source ?? (row.store === 'app_granted' ? 'app_granted' : 'server'),
    environment,
    managementUrl: safeExternalHttpsUrl(row.management_url),
    // Both fields are server-authored. Never turn the device clock into proof.
    verifiedAt: row.verified_at ?? row.updated_at ?? null,
    offeringId: row.offering_id ?? null,
    packageId: row.package_id ?? null,
    storeUserId: row.store_user_id ?? null,
  };
}

function isStoreBackedEntitlement(e: StoredEntitlement | null): boolean {
  if (!e) return false;
  return (
    e.source === 'revenuecat' ||
    e.store === 'app_store' ||
    e.store === 'play_store' ||
    e.store === 'test_store' ||
    e.store === 'web'
  );
}

function revenueCatProofIdentity(e: StoredEntitlement): string {
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
    e.storeUserId ?? null,
  ]);
}

function provisionalBarrierFromRevenueCatProof(
  proof: StoredEntitlement,
  reviewedAt: string,
): ProvisionalProviderBarrier | null {
  if (proof.source !== 'revenuecat' || !proof.verifiedAt) return null;
  return {
    kind: isLiveEntitlementAt(proof, reviewedAt) ? 'active_proof' : 'revocation',
    verifiedAt: proof.verifiedAt,
    managementUrl: proof.managementUrl ?? null,
    storeUserId: proof.storeUserId ?? null,
    exactRevenueCatProofIdentity: revenueCatProofIdentity(proof),
  };
}

function revenueCatProofIdentityKindAt(
  proofIdentity: string,
  storeUserId: string | null,
  reviewedAt: string,
): Readonly<{
  kind: ProvisionalProviderBarrier['kind'];
  verifiedAt: string;
}> | null {
  let identity: unknown;
  try {
    identity = JSON.parse(proofIdentity) as unknown;
  } catch {
    return null;
  }
  if (
    !Array.isArray(identity) ||
    identity.length !== 12 ||
    JSON.stringify(identity) !== proofIdentity ||
    identity[0] !== 'revenuecat' ||
    typeof identity[1] !== 'string' ||
    isoOrNull(identity[1]) !== identity[1] ||
    typeof identity[3] !== 'boolean' ||
    (identity[7] !== null &&
      (typeof identity[7] !== 'string' || isoOrNull(identity[7]) !== identity[7])) ||
    identity[11] !== storeUserId
  ) {
    return null;
  }
  const expiryTime = identity[7] === null ? Number.POSITIVE_INFINITY : Date.parse(identity[7]);
  const live =
    identity[3] &&
    Number.isFinite(Date.parse(reviewedAt)) &&
    expiryTime > Date.parse(reviewedAt);
  return {
    kind: live ? 'active_proof' : 'revocation',
    verifiedAt: identity[1],
  };
}

function provisionalBarrierAt(
  barrier: ProvisionalProviderBarrier | null | undefined,
  reviewedAt: string,
): ProvisionalProviderBarrier | null {
  if (!barrier) return null;
  const kind = barrier.exactRevenueCatProofIdentity
    ? revenueCatProofIdentityKindAt(
        barrier.exactRevenueCatProofIdentity,
        barrier.storeUserId,
        reviewedAt,
      )
    : null;
  return kind && kind.kind !== barrier.kind ? { ...barrier, kind: kind.kind } : barrier;
}

function provisionalBarrierFromTrustedMarker(
  marker: TrustedRevenueCatProofMarker | null,
  reviewedAt: string,
): ProvisionalProviderBarrier | null {
  if (!marker) return null;
  const kind = revenueCatProofIdentityKindAt(
    marker.proofIdentity,
    marker.storeUserId,
    reviewedAt,
  );
  if (!kind) return null;
  return {
    kind: kind.kind,
    verifiedAt: kind.verifiedAt,
    managementUrl: null,
    storeUserId: marker.storeUserId,
    exactRevenueCatProofIdentity: marker.proofIdentity,
  };
}

function selectNewestProvisionalBarrier(
  current: ProvisionalProviderBarrier | null,
  incoming: ProvisionalProviderBarrier | null,
): ProvisionalProviderBarrier | null {
  if (!current) return incoming;
  if (!incoming) return current;
  return Date.parse(incoming.verifiedAt) >= Date.parse(current.verifiedAt)
    ? incoming
    : current;
}

function rollbackBarrierForPhysicalProof(
  proof: StoredEntitlement,
  marker: TrustedRevenueCatProofMarker | null,
  reviewedAt: string,
): ProvisionalProviderBarrier | null {
  if (markerMatchesRevenueCatProof(marker, proof)) return null;
  const physical = provisionalBarrierFromRevenueCatProof(proof, reviewedAt);
  const trusted = provisionalBarrierFromTrustedMarker(marker, reviewedAt);
  const markerCanOrderProof = Boolean(
    trusted && (!proof.storeUserId || trusted.storeUserId === proof.storeUserId),
  );
  return selectNewestProvisionalBarrier(
    physical,
    markerCanOrderProof ? trusted : null,
  );
}

function trustedRevenueCatProofMarkerFor(
  entitlement: StoredEntitlement,
): TrustedRevenueCatProofMarker | null {
  return entitlement.source === 'revenuecat' && entitlement.storeUserId
    ? {
        storeUserId: entitlement.storeUserId,
        proofIdentity: revenueCatProofIdentity(entitlement),
      }
    : null;
}

function markerMatchesRevenueCatProof(
  marker: TrustedRevenueCatProofMarker | null,
  entitlement: StoredEntitlement,
): boolean {
  return Boolean(
    marker &&
      entitlement.source === 'revenuecat' &&
      marker.storeUserId === entitlement.storeUserId &&
      marker.proofIdentity === revenueCatProofIdentity(entitlement),
  );
}

function isAppGrantedEntitlement(e: StoredEntitlement | null): boolean {
  return Boolean(e && (e.source === 'app_granted' || e.store === 'app_granted'));
}

function isLiveEntitlementAt(e: StoredEntitlement | null, reviewedAt: string): boolean {
  if (!e?.isActive || !e.tier) return false;
  const reviewedTime = Date.parse(reviewedAt);
  const expiresTime = e.expiresAt ? Date.parse(e.expiresAt) : Number.POSITIVE_INFINITY;
  return (
    Number.isFinite(reviewedTime) &&
    (e.expiresAt === null || (Number.isFinite(expiresTime) && expiresTime > reviewedTime))
  );
}

function isLiveAppGrantAt(e: StoredEntitlement | null, reviewedAt: string): boolean {
  return isAppGrantedEntitlement(e) && isLiveEntitlementAt(e, reviewedAt);
}

function isLiveStoreProofAt(
  e: StoredEntitlement | null,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): boolean {
  if (!e || !isStoreBackedEntitlement(e) || !isLiveEntitlementAt(e, reviewedAt)) return false;
  const evidence = classifyEntitlementEvidence(e, reviewedAt, appEnvironment);
  return evidence === 'fresh' || evidence === 'reconciliation_due';
}

function isRevenueCatEmptyTombstone(e: StoredEntitlement | null): boolean {
  return Boolean(
    e &&
      e.tier === 'pro' &&
      e.isActive === false &&
      e.periodType === null &&
      e.store === null &&
      e.productId === null &&
      e.expiresAt === null &&
      e.willRenew === false &&
      e.grantedAt === null &&
      e.source === 'local_cache' &&
      e.environment === null &&
      e.managementUrl === null &&
      e.verifiedAt !== null &&
      e.offeringId === null &&
      e.packageId === null &&
      e.storeUserId === null &&
      e.priceLabel === null,
  );
}

function revenueCatEmptyTombstone(verifiedAt: string): StoredEntitlement {
  return {
    tier: 'pro',
    isActive: false,
    periodType: null,
    store: null,
    productId: null,
    expiresAt: null,
    willRenew: false,
    grantedAt: null,
    source: 'local_cache',
    environment: null,
    managementUrl: null,
    verifiedAt,
    offeringId: null,
    packageId: null,
    storeUserId: null,
    priceLabel: null,
  };
}

function isTimeBoxedEntitlement(entitlement: StoredEntitlement): boolean {
  return (
    entitlement.periodType === 'reverse_trial' ||
    entitlement.periodType === 'trial' ||
    entitlement.periodType === 'intro' ||
    entitlement.periodType === 'prepaid' ||
    entitlement.source === 'app_granted' ||
    entitlement.store === 'app_granted'
  );
}

function normalizeVerifiedEntitlement(
  e: StoredEntitlement,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): StoredEntitlement {
  const raw = e as StoredEntitlement & Record<string, unknown>;
  if (
    (raw.periodType !== null && asPeriod(String(raw.periodType)) !== raw.periodType) ||
    (raw.store !== null && asStore(String(raw.store)) !== raw.store) ||
    (raw.source !== null &&
      raw.source !== undefined &&
      asSource(String(raw.source)) !== raw.source) ||
    (raw.environment !== null &&
      raw.environment !== undefined &&
      asEnvironment(String(raw.environment)) !== raw.environment)
  ) {
    throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  }
  // Callers must supply provider/server evidence; this cache writer never mints it.
  const verified = normalizeStoredEntitlement(e);
  const reviewedTime = Date.parse(reviewedAt);
  const verifiedTime = verified?.verifiedAt ? Date.parse(verified.verifiedAt) : Number.NaN;
  const expiresWasMalformed = e.expiresAt !== null && isoOrNull(e.expiresAt) === null;
  const appGranted =
    verified?.source === 'app_granted' || verified?.store === 'app_granted';
  const wrongEnvironment = Boolean(
    verified &&
      ((appEnvironment !== 'development' && verified.environment === 'development') ||
        (appEnvironment === 'production' &&
          (verified.store === 'test_store' || verified.environment === 'test_store'))),
  );

  if (
    !verified ||
    !verified.verifiedAt ||
    !Number.isFinite(reviewedTime) ||
    !Number.isFinite(verifiedTime) ||
    verifiedTime - reviewedTime > VERIFICATION_CLOCK_SKEW_MS ||
    (verified.source !== 'revenuecat' &&
      verified.source !== 'server' &&
      verified.source !== 'app_granted') ||
    wrongEnvironment ||
    expiresWasMalformed ||
    (isTimeBoxedEntitlement(verified) && !verified.expiresAt) ||
    (appGranted &&
      (verified.store !== 'app_granted' ||
        verified.periodType !== 'reverse_trial' ||
        verified.willRenew !== false ||
        verified.environment === null ||
        !verified.expiresAt))
  ) {
    throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  }
  return verified;
}

function normalizeRevenueCatVerifiedEmptyEvidence(
  evidence: RevenueCatVerifiedEmptyEvidence,
  reviewedAt: string,
): RevenueCatEmptyWatermark {
  const normalized = normalizeRevenueCatEmptyWatermark({
    verifiedAt: evidence.verifiedAt,
    managementUrl: evidence.managementUrl ?? null,
    storeUserId: evidence.storeUserId ?? null,
  });
  const reviewedTime = Date.parse(reviewedAt);
  const verifiedTime = normalized ? Date.parse(normalized.verifiedAt) : Number.NaN;
  if (
    !normalized ||
    !normalized.storeUserId ||
    !Number.isFinite(reviewedTime) ||
    !Number.isFinite(verifiedTime) ||
    verifiedTime - reviewedTime > VERIFICATION_CLOCK_SKEW_MS
  ) {
    throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  }
  return normalized;
}

function currentEntitlementIsOrderable(
  entitlement: StoredEntitlement,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): boolean {
  try {
    normalizeVerifiedEntitlement(entitlement, reviewedAt, appEnvironment);
    return true;
  } catch {
    return false;
  }
}

function currentWatermarkIsOrderable(
  watermark: RevenueCatEmptyWatermark,
  reviewedAt: string,
): boolean {
  try {
    normalizeRevenueCatVerifiedEmptyEvidence(watermark, reviewedAt);
    return true;
  } catch {
    return false;
  }
}

function selectEffectiveEntitlement(
  current: StoredEntitlement | null,
  incoming: StoredEntitlement,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): StoredEntitlement {
  if (!current || !currentEntitlementIsOrderable(current, reviewedAt, appEnvironment)) {
    return incoming;
  }

  // The app-granted reverse trial is an independent access grant. Provider
  // inactivity/empty evidence must not revoke it, even when provider evidence
  // has a newer timestamp. A live store proof, however, is the stronger active
  // authority and takes over in either direction.
  if (isAppGrantedEntitlement(current) && !isAppGrantedEntitlement(incoming)) {
    if (isLiveStoreProofAt(incoming, reviewedAt, appEnvironment)) return incoming;
    if (isLiveAppGrantAt(current, reviewedAt)) return current;
  }
  if (isAppGrantedEntitlement(incoming) && !isAppGrantedEntitlement(current)) {
    if (isLiveStoreProofAt(current, reviewedAt, appEnvironment)) return current;
    if (isLiveAppGrantAt(incoming, reviewedAt)) return incoming;
  }
  const selected = selectLatestAuthoritativeEntitlementEvidence(current, incoming);
  const other = selected === current ? incoming : current;
  const sameCoreProviderProof =
    current.verifiedAt === incoming.verifiedAt &&
    current.source === incoming.source &&
    current.storeUserId === incoming.storeUserId &&
    current.tier === incoming.tier &&
    current.isActive === incoming.isActive &&
    current.periodType === incoming.periodType &&
    current.store === incoming.store &&
    current.productId === incoming.productId &&
    current.expiresAt === incoming.expiresAt &&
    current.willRenew === incoming.willRenew &&
    current.grantedAt === incoming.grantedAt;
  if (!sameCoreProviderProof) return selected;
  return {
    ...selected,
    offeringId: selected.offeringId ?? other.offeringId ?? null,
    packageId: selected.packageId ?? other.packageId ?? null,
    priceLabel: selected.priceLabel ?? other.priceLabel ?? null,
    managementUrl: selected.managementUrl ?? other.managementUrl ?? null,
  };
}

function watermarkBlocksStoreEvidence(
  watermark: RevenueCatEmptyWatermark | null,
  incoming: StoredEntitlement,
  reviewedAt: string,
): boolean {
  if (
    !watermark ||
    !isStoreBackedEntitlement(incoming) ||
    !isLiveEntitlementAt(incoming, reviewedAt) ||
    !currentWatermarkIsOrderable(watermark, reviewedAt) ||
    !incoming.verifiedAt
  ) {
    return false;
  }
  // RevenueCat app-user IDs are owner binding, not ordering metadata. A
  // rollback build may leave this newer key behind during an account switch;
  // never let account A's watermark revoke account B's v2 proof.
  if (watermark.storeUserId !== incoming.storeUserId) return false;
  if (incoming.storeUserId !== null && watermark.storeUserId === null) return false;
  return Date.parse(watermark.verifiedAt) >= Date.parse(incoming.verifiedAt);
}

function watermarkMatchesProofOwner(
  watermark: RevenueCatEmptyWatermark,
  proof: StoredEntitlement,
): boolean {
  return watermark.storeUserId === proof.storeUserId;
}

function canonicalizeCacheState(
  state: EntitlementCacheState,
  reviewedAt: string,
): EntitlementCacheState {
  const provisionalProviderBarrier = provisionalBarrierAt(
    state.provisionalProviderBarrier,
    reviewedAt,
  );
  if (provisionalProviderBarrier !== (state.provisionalProviderBarrier ?? null)) {
    state = { ...state, provisionalProviderBarrier };
  }
  if (
    state.entitlement &&
    watermarkBlocksStoreEvidence(state.revenueCatEmpty, state.entitlement, reviewedAt)
  ) {
    return { ...state, entitlement: null, trustedRevenueCatProof: null };
  }
  if (
    state.trustedRevenueCatProof &&
    (!state.entitlement ||
      !markerMatchesRevenueCatProof(state.trustedRevenueCatProof, state.entitlement))
  ) {
    return { ...state, trustedRevenueCatProof: null };
  }
  return state;
}

function applyVerifiedEntitlement(
  state: EntitlementCacheState,
  incoming: StoredEntitlement,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): EntitlementCacheState {
  if (
    incoming.storeUserId &&
    state.entitlement &&
    state.entitlement.storeUserId !== incoming.storeUserId
  ) {
    state = {
      entitlement: null,
      revenueCatEmpty:
        state.revenueCatEmpty?.storeUserId === incoming.storeUserId
          ? state.revenueCatEmpty
          : null,
      trustedRevenueCatProof: null,
      provisionalProviderBarrier:
        !state.provisionalProviderBarrier?.storeUserId ||
        state.provisionalProviderBarrier.storeUserId === incoming.storeUserId
          ? state.provisionalProviderBarrier
          : null,
    };
  }
  let existingWatermark =
    state.revenueCatEmpty &&
    incoming.storeUserId &&
    state.revenueCatEmpty.storeUserId !== incoming.storeUserId
      ? null
      : state.revenueCatEmpty;
  const provisional = state.provisionalProviderBarrier;
  const provisionalApplies = Boolean(
    provisional &&
      (!provisional.storeUserId || provisional.storeUserId === incoming.storeUserId),
  );
  const exactProvisionalRetry = Boolean(
    provisionalApplies &&
      provisional?.exactRevenueCatProofIdentity &&
      incoming.source === 'revenuecat' &&
      incoming.storeUserId === (provisional.storeUserId ?? incoming.storeUserId) &&
      revenueCatProofIdentity(incoming) === provisional.exactRevenueCatProofIdentity,
  );
  if (
    provisionalApplies &&
    provisional?.kind === 'revocation' &&
    !exactProvisionalRetry &&
    incoming.storeUserId
  ) {
    existingWatermark = selectRevenueCatEmptyWatermark(
      existingWatermark,
      {
        verifiedAt: provisional!.verifiedAt,
        managementUrl: provisional!.managementUrl,
        storeUserId: provisional!.storeUserId ?? incoming.storeUserId,
      },
      reviewedAt,
    );
  }
  const incomingRevocation =
    isStoreBackedEntitlement(incoming) && !isLiveEntitlementAt(incoming, reviewedAt)
      ? normalizeRevenueCatEmptyWatermark({
          verifiedAt: incoming.verifiedAt,
          managementUrl: incoming.managementUrl ?? null,
          storeUserId: incoming.storeUserId ?? null,
        })
      : null;
  const revenueCatEmpty = incomingRevocation
    ? selectRevenueCatEmptyWatermark(
        existingWatermark,
        incomingRevocation,
        reviewedAt,
      )
    : existingWatermark;
  const provisionalBlocksIncoming = Boolean(
    provisionalApplies &&
      !exactProvisionalRetry &&
      isStoreBackedEntitlement(incoming) &&
      incoming.verifiedAt &&
      Date.parse(incoming.verifiedAt) <= Date.parse(provisional!.verifiedAt),
  );
  if (provisionalBlocksIncoming) {
    const current = state.entitlement;
    const currentIsIndependentAppGrant = isLiveAppGrantAt(current, reviewedAt);
    const currentIsNewerStoreProof = Boolean(
      current &&
        isStoreBackedEntitlement(current) &&
        current.verifiedAt &&
        Date.parse(current.verifiedAt) > Date.parse(provisional!.verifiedAt),
    );
    const preserveCurrent = currentIsIndependentAppGrant || currentIsNewerStoreProof;
    const consumeBarrier =
      provisional!.kind === 'revocation' || currentIsNewerStoreProof;
    return {
      entitlement: preserveCurrent ? current : null,
      revenueCatEmpty:
        provisional!.kind === 'revocation' ? revenueCatEmpty : state.revenueCatEmpty,
      trustedRevenueCatProof:
        preserveCurrent &&
        current &&
        markerMatchesRevenueCatProof(state.trustedRevenueCatProof, current)
          ? state.trustedRevenueCatProof
          : null,
      provisionalProviderBarrier: consumeBarrier ? null : provisional,
    };
  }
  if (watermarkBlocksStoreEvidence(revenueCatEmpty, incoming, reviewedAt)) {
    return {
      entitlement: state.entitlement,
      revenueCatEmpty,
      trustedRevenueCatProof: state.trustedRevenueCatProof,
      provisionalProviderBarrier: null,
    };
  }
  const entitlement = selectEffectiveEntitlement(
    state.entitlement,
    incoming,
    reviewedAt,
    appEnvironment,
  );
  return {
    revenueCatEmpty,
    entitlement,
    trustedRevenueCatProof: markerMatchesRevenueCatProof(
      state.trustedRevenueCatProof,
      entitlement,
    )
      ? state.trustedRevenueCatProof
      : null,
    provisionalProviderBarrier:
      provisionalApplies &&
      provisional?.kind === 'active_proof' &&
      !exactProvisionalRetry &&
      isAppGrantedEntitlement(incoming)
        ? provisional
        : null,
  };
}

function selectRevenueCatEmptyWatermark(
  current: RevenueCatEmptyWatermark | null,
  incoming: RevenueCatEmptyWatermark,
  reviewedAt: string,
): RevenueCatEmptyWatermark {
  if (!current || !currentWatermarkIsOrderable(current, reviewedAt)) return incoming;
  if (
    current.storeUserId &&
    incoming.storeUserId &&
    current.storeUserId !== incoming.storeUserId
  ) {
    return incoming;
  }
  if (incoming.storeUserId && current.storeUserId !== incoming.storeUserId) return incoming;
  if (!incoming.storeUserId && current.storeUserId) return current;
  return Date.parse(current.verifiedAt) >= Date.parse(incoming.verifiedAt) ? current : incoming;
}

function applyRevenueCatVerifiedEmpty(
  state: EntitlementCacheState,
  incoming: RevenueCatEmptyWatermark,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): EntitlementCacheState {
  if (
    state.entitlement &&
    state.entitlement.storeUserId !== incoming.storeUserId
  ) {
    state = {
      entitlement: null,
      revenueCatEmpty:
        state.revenueCatEmpty?.storeUserId === incoming.storeUserId
          ? state.revenueCatEmpty
          : null,
      trustedRevenueCatProof: null,
      provisionalProviderBarrier:
        !state.provisionalProviderBarrier?.storeUserId ||
        state.provisionalProviderBarrier.storeUserId === incoming.storeUserId
          ? state.provisionalProviderBarrier
          : null,
    };
  }
  const provisional = state.provisionalProviderBarrier;
  const activeBarrierBlocksIncoming = Boolean(
    provisional &&
      provisional.kind === 'active_proof' &&
      (!provisional.storeUserId || provisional.storeUserId === incoming.storeUserId) &&
      Date.parse(incoming.verifiedAt) < Date.parse(provisional.verifiedAt),
  );
  if (activeBarrierBlocksIncoming) {
    return state;
  }
  const provisionalWatermark =
    provisional &&
    provisional.kind === 'revocation' &&
    (!provisional.storeUserId || provisional.storeUserId === incoming.storeUserId)
      ? {
          verifiedAt: provisional.verifiedAt,
          managementUrl: provisional.managementUrl,
          storeUserId: provisional.storeUserId ?? incoming.storeUserId,
        }
      : null;
  const revenueCatEmpty = selectRevenueCatEmptyWatermark(
    provisionalWatermark
      ? selectRevenueCatEmptyWatermark(
          state.revenueCatEmpty,
          provisionalWatermark,
          reviewedAt,
        )
      : state.revenueCatEmpty,
    incoming,
    reviewedAt,
  );
  const current = state.entitlement;
  if (!current || !isStoreBackedEntitlement(current) || isLiveAppGrantAt(current, reviewedAt)) {
    return {
      entitlement: current,
      revenueCatEmpty,
      trustedRevenueCatProof:
        current && markerMatchesRevenueCatProof(state.trustedRevenueCatProof, current)
          ? state.trustedRevenueCatProof
          : null,
      provisionalProviderBarrier: null,
    };
  }
  const preserveCurrent =
    currentEntitlementIsOrderable(current, reviewedAt, appEnvironment) &&
    Boolean(current.verifiedAt) &&
    Date.parse(current.verifiedAt as string) > Date.parse(revenueCatEmpty.verifiedAt);
  return {
    entitlement: preserveCurrent ? current : null,
    revenueCatEmpty,
    trustedRevenueCatProof:
      preserveCurrent && markerMatchesRevenueCatProof(state.trustedRevenueCatProof, current)
        ? state.trustedRevenueCatProof
        : null,
    provisionalProviderBarrier: null,
  };
}

const EMPTY_CACHE_STATE: EntitlementCacheState = Object.freeze({
  entitlement: null,
  revenueCatEmpty: null,
  trustedRevenueCatProof: null,
});

function acceptanceFor(
  state: EntitlementCacheState,
  persisted: boolean,
): EntitlementAcceptance {
  return {
    entitlement: isRevenueCatEmptyTombstone(state.entitlement) ? null : state.entitlement,
    revenueCatEmpty: state.revenueCatEmpty,
    persisted,
  };
}

type EntitlementPersistenceAttempt = Readonly<{
  acceptance: EntitlementAcceptance;
  error: unknown | null;
}>;

type PersistenceSnapshot = Readonly<{
  state: EntitlementCacheState;
  error: unknown | null;
  mayWriteAppGrant: boolean;
}>;

function privateReadError(key: string, status: PrivateDomainRead<unknown>['status']): Error {
  if (status === 'corrupt') return entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  if (status === 'unsupported_version') {
    return entitlementCacheError(ENTITLEMENT_CACHE_UNSUPPORTED_VERSION);
  }
  return new Error(`ENTITLEMENT_CACHE_${key}_${status.toUpperCase()}`);
}

function readStatusResult(
  status: Exclude<PrivateDomainRead<unknown>['status'], 'available' | 'absent'>,
): EntitlementCacheRead {
  return { status, entitlement: null };
}

function mismatchedTombstoneRead(
  watermark: PrivateDomainRead<RevenueCatEmptyWatermark>,
): EntitlementCacheRead {
  if (watermark.status !== 'available' && watermark.status !== 'absent') {
    return readStatusResult(watermark.status);
  }
  return { status: 'unavailable', entitlement: null };
}

function resolvePhysicalProof(
  proof: StoredEntitlement,
  watermark: PrivateDomainRead<RevenueCatEmptyWatermark>,
  trustedMarker: TrustedRevenueCatProofMarker | null,
  reviewedAt: string,
): EntitlementCacheRead {
  const markerBarrier = rollbackBarrierForPhysicalProof(
    proof,
    trustedMarker,
    reviewedAt,
  );
  const proofTime = proof.verifiedAt ? Date.parse(proof.verifiedAt) : Number.NEGATIVE_INFINITY;
  const trustedMarkerDominates = Boolean(
    markerBarrier &&
      trustedMarker &&
      markerBarrier.exactRevenueCatProofIdentity === trustedMarker.proofIdentity &&
      Date.parse(markerBarrier.verifiedAt) >= proofTime,
  );
  if (trustedMarkerDominates && !isLiveAppGrantAt(proof, reviewedAt)) {
    return { status: 'unavailable', entitlement: null };
  }

  if (isRevenueCatEmptyTombstone(proof)) {
    if (
      watermark.status === 'available' &&
      proof.verifiedAt &&
      Date.parse(watermark.value.verifiedAt) >= Date.parse(proof.verifiedAt)
    ) {
      return {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: watermark.value,
      };
    }
    return mismatchedTombstoneRead(watermark);
  }

  if (isAppGrantedEntitlement(proof)) {
    return {
      status: 'available',
      entitlement: proof,
      ...(watermark.status === 'available' && watermarkMatchesProofOwner(watermark.value, proof)
        ? { revenueCatEmpty: watermark.value }
        : {}),
    };
  }

  if (isStoreBackedEntitlement(proof)) {
    if (watermark.status !== 'available' && watermark.status !== 'absent') {
      return readStatusResult(watermark.status);
    }
    if (
      watermark.status === 'available' &&
      watermarkBlocksStoreEvidence(watermark.value, proof, reviewedAt)
    ) {
      return {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: watermark.value,
      };
    }
  }

  // A pre-marker build may have written source=revenuecat bytes without ever
  // passing RevenueCat's trusted verification classifier. A trusted, newer
  // same-owner empty watermark may still revoke those bytes; otherwise they
  // are uncertainty and never an offline grant.
  if (proof.source === 'revenuecat' && !markerMatchesRevenueCatProof(trustedMarker, proof)) {
    return { status: 'unavailable', entitlement: null };
  }

  return {
    status: 'available',
    entitlement: proof,
    ...(watermark.status === 'available' && watermarkMatchesProofOwner(watermark.value, proof)
      ? { revenueCatEmpty: watermark.value }
      : {}),
  };
}

/**
 * Read the watermark before the proof. A v2 tombstone masks v1 even if the
 * second phase of the empty write crashed; that state is uncertainty, never a
 * reason to revive stale v1 access.
 */
async function readPhysicalEntitlementCache(
  expectedStoreUserId?: string,
): Promise<EntitlementCacheRead> {
  const sidecarRead = await readRevenueCatEmptyKey();
  let sidecar =
    sidecarRead.status === 'available'
      ? sidecarRead.value
      : null;
  if (
    sidecar &&
    expectedStoreUserId &&
    ((sidecar.revenueCatEmpty &&
      sidecar.revenueCatEmpty.storeUserId !== expectedStoreUserId) ||
      (sidecar.trustedRevenueCatProof &&
        sidecar.trustedRevenueCatProof.storeUserId !== expectedStoreUserId))
  ) {
    sidecar = {
      revenueCatEmpty:
        sidecar.revenueCatEmpty?.storeUserId === expectedStoreUserId
          ? sidecar.revenueCatEmpty
          : null,
      trustedRevenueCatProof:
        sidecar.trustedRevenueCatProof?.storeUserId === expectedStoreUserId
          ? sidecar.trustedRevenueCatProof
          : null,
    };
  }
  const watermark: PrivateDomainRead<RevenueCatEmptyWatermark> =
    sidecar?.revenueCatEmpty
      ? { status: 'available', value: sidecar.revenueCatEmpty }
      : sidecarRead.status === 'available' || sidecarRead.status === 'absent'
        ? { status: 'absent', value: null }
        : { status: sidecarRead.status, value: null };
  const trustedMarker = sidecar?.trustedRevenueCatProof ?? null;
  const proof = await readEntitlementKey(KEY);
  if (proof.status === 'available') {
    if (
      expectedStoreUserId &&
      !isRevenueCatEmptyTombstone(proof.value) &&
      proof.value.storeUserId !== expectedStoreUserId
    ) {
      return { status: 'unavailable', entitlement: null };
    }
    return resolvePhysicalProof(proof.value, watermark, trustedMarker, nowISO());
  }
  if (proof.status !== 'absent') return readStatusResult(proof.status);

  if (watermark.status === 'available') {
    const markerBarrier = provisionalBarrierFromTrustedMarker(trustedMarker, nowISO());
    if (
      markerBarrier?.kind === 'active_proof' &&
      Date.parse(markerBarrier.verifiedAt) > Date.parse(watermark.value.verifiedAt)
    ) {
      return { status: 'unavailable', entitlement: null };
    }
    return {
      status: 'absent',
      entitlement: null,
      revenueCatEmpty: watermark.value,
    };
  }
  if (watermark.status !== 'absent') return readStatusResult(watermark.status);

  // A marker-only schema-v2 sidecar can remain when a rollback build removed
  // v2. It is not a legacy entitlement proof and cannot authorize by itself.
  if (sidecarRead.status === 'available') {
    return { status: 'unavailable', entitlement: null };
  }

  const legacy = await readEntitlementKey(LEGACY_KEY);
  if (legacy.status === 'available') {
    if (legacy.value.source === 'revenuecat') {
      return { status: 'unavailable', entitlement: null };
    }
    if (
      expectedStoreUserId &&
      legacy.value.storeUserId !== expectedStoreUserId
    ) {
      return { status: 'unavailable', entitlement: null };
    }
    return { status: 'available', entitlement: legacy.value };
  }
  return legacy.status === 'absent'
    ? { status: 'absent', entitlement: null }
    : readStatusResult(legacy.status);
}

function cacheReadFromState(
  state: EntitlementCacheState,
  reviewedAt: string,
): EntitlementCacheRead {
  const barrier = provisionalBarrierAt(state.provisionalProviderBarrier, reviewedAt);
  if (state.entitlement && !isRevenueCatEmptyTombstone(state.entitlement)) {
    const barrierApplies = Boolean(
      barrier &&
        (!barrier.storeUserId || barrier.storeUserId === state.entitlement.storeUserId),
    );
    const barrierDominates = Boolean(
      barrierApplies &&
        (!state.entitlement.verifiedAt ||
          Date.parse(barrier!.verifiedAt) >= Date.parse(state.entitlement.verifiedAt)),
    );
    if (
      barrierApplies &&
      !isLiveAppGrantAt(state.entitlement, reviewedAt) &&
      (isAppGrantedEntitlement(state.entitlement) || barrierDominates)
    ) {
      return { status: 'unavailable', entitlement: null };
    }
    return {
      status: 'available',
      entitlement: state.entitlement,
      ...(state.revenueCatEmpty
        ? { revenueCatEmpty: state.revenueCatEmpty }
        : {}),
    };
  }
  if (
    barrier?.kind === 'active_proof' &&
    (!state.revenueCatEmpty ||
      Date.parse(barrier.verifiedAt) >
        Date.parse(state.revenueCatEmpty.verifiedAt))
  ) {
    return { status: 'unavailable', entitlement: null };
  }
  return state.revenueCatEmpty
    ? {
        status: 'absent',
        entitlement: null,
        revenueCatEmpty: state.revenueCatEmpty,
      }
    : barrier
      ? { status: 'unavailable', entitlement: null }
      : { status: 'absent', entitlement: null };
}

export async function readEntitlementCache(options: {
  expectedStoreUserId?: string;
} = {}): Promise<EntitlementCacheRead> {
  const physical = await readPhysicalEntitlementCache(options.expectedStoreUserId);
  const generation = getAccountGeneration();
  const shadow = volatileStateFor(generation);
  if (shadow === EMPTY_CACHE_STATE) return physical;

  const physicalState: EntitlementCacheState =
    physical.status === 'available'
      ? {
          entitlement: physical.entitlement,
          revenueCatEmpty: physical.revenueCatEmpty
            ? normalizeRevenueCatEmptyWatermark({
                verifiedAt: physical.revenueCatEmpty.verifiedAt,
                managementUrl: physical.revenueCatEmpty.managementUrl ?? null,
                storeUserId: physical.revenueCatEmpty.storeUserId ?? null,
              })
            : null,
          trustedRevenueCatProof: null,
        }
      : physical.status === 'absent' && physical.revenueCatEmpty
        ? {
            entitlement: null,
            revenueCatEmpty:
              normalizeRevenueCatEmptyWatermark({
                verifiedAt: physical.revenueCatEmpty.verifiedAt,
                managementUrl: physical.revenueCatEmpty.managementUrl ?? null,
                storeUserId: physical.revenueCatEmpty.storeUserId ?? null,
              }) ?? null,
            trustedRevenueCatProof: null,
          }
        : EMPTY_CACHE_STATE;
  const reviewedAt = nowISO();
  return cacheReadFromState(
    mergeCacheStates(
      physicalState,
      shadow,
      reviewedAt,
      env.appEnvironment,
    ),
    reviewedAt,
  );
}

export async function loadEntitlement(): Promise<StoredEntitlement | null> {
  const result = await readEntitlementCache();
  return result.status === 'available' ? result.entitlement : null;
}

async function persistenceSnapshot(reviewedAt: string): Promise<PersistenceSnapshot> {
  const sidecar = await readRevenueCatEmptyKey();
  const watermark: PrivateDomainRead<RevenueCatEmptyWatermark> =
    sidecar.status === 'available' && sidecar.value.revenueCatEmpty
      ? { status: 'available', value: sidecar.value.revenueCatEmpty }
      : sidecar.status === 'available' || sidecar.status === 'absent'
        ? { status: 'absent', value: null }
        : { status: sidecar.status, value: null };
  const trustedMarker =
    sidecar.status === 'available' ? sidecar.value.trustedRevenueCatProof : null;
  const proof = await readEntitlementKey(KEY);

  if (proof.status === 'available') {
    const rollbackBarrier = rollbackBarrierForPhysicalProof(
      proof.value,
      trustedMarker,
      reviewedAt,
    );
    const resolved = resolvePhysicalProof(
      proof.value,
      watermark,
      trustedMarker,
      reviewedAt,
    );
    if (resolved.status === 'unavailable' && rollbackBarrier) {
      return {
        state: {
          entitlement: null,
          revenueCatEmpty:
            watermark.status === 'available' ? watermark.value : null,
          trustedRevenueCatProof: null,
          provisionalProviderBarrier: rollbackBarrier,
        },
        error: null,
        mayWriteAppGrant: true,
      };
    }
    if (resolved.status === 'available') {
      const implicitRevocation =
        isStoreBackedEntitlement(resolved.entitlement) &&
        !isLiveEntitlementAt(resolved.entitlement, reviewedAt)
          ? normalizeRevenueCatEmptyWatermark({
              verifiedAt: resolved.entitlement.verifiedAt,
              managementUrl: resolved.entitlement.managementUrl ?? null,
              storeUserId: resolved.entitlement.storeUserId ?? null,
            })
          : null;
      return {
        state: {
          entitlement: resolved.entitlement,
          revenueCatEmpty:
            watermark.status === 'available'
              ? watermark.value
              : implicitRevocation,
          trustedRevenueCatProof: markerMatchesRevenueCatProof(
            trustedMarker,
            resolved.entitlement,
          )
            ? trustedMarker
            : null,
          provisionalProviderBarrier: rollbackBarrier,
        },
        error:
          watermark.status === 'available' || watermark.status === 'absent'
            ? null
            : privateReadError(REVENUECAT_EMPTY_KEY, watermark.status),
        mayWriteAppGrant: true,
      };
    }
    if (resolved.status === 'absent') {
      const revenueCatEmpty = resolved.revenueCatEmpty
        ? normalizeRevenueCatEmptyWatermark({
            verifiedAt: resolved.revenueCatEmpty.verifiedAt,
            managementUrl: resolved.revenueCatEmpty.managementUrl ?? null,
            storeUserId: resolved.revenueCatEmpty.storeUserId ?? null,
          })
        : null;
      return {
        state: {
          entitlement: null,
          revenueCatEmpty,
          trustedRevenueCatProof: null,
          provisionalProviderBarrier: rollbackBarrier,
        },
        error: null,
        mayWriteAppGrant: true,
      };
    }
    if (
      resolved.status === 'unavailable' &&
      isRevenueCatEmptyTombstone(proof.value) &&
      (watermark.status === 'available' || watermark.status === 'absent') &&
      (sidecar.status === 'available' || sidecar.status === 'absent')
    ) {
      return {
        // A tombstone written before its final sidecar is intentionally
        // non-authorizing to public reads. An explicit trusted mutation may
        // nevertheless repair it. Retain any older owner-bound watermark so
        // the incoming proof still has to pass normal ordering.
        state: {
          entitlement: null,
          revenueCatEmpty: watermark.status === 'available' ? watermark.value : null,
          trustedRevenueCatProof: null,
          provisionalProviderBarrier: selectNewestProvisionalBarrier(
            {
              kind: 'revocation',
              verifiedAt: proof.value.verifiedAt!,
              managementUrl: proof.value.managementUrl ?? null,
              storeUserId:
                watermark.status === 'available'
                  ? watermark.value.storeUserId
                  : null,
              exactRevenueCatProofIdentity: null,
            },
            rollbackBarrier,
          ),
        },
        error: null,
        mayWriteAppGrant: true,
      };
    }
    return {
      state: EMPTY_CACHE_STATE,
      error: privateReadError(
        isRevenueCatEmptyTombstone(proof.value) ? REVENUECAT_EMPTY_KEY : KEY,
        resolved.status,
      ),
      mayWriteAppGrant: true,
    };
  }

  if (proof.status !== 'absent') {
    return {
      state: EMPTY_CACHE_STATE,
      error: privateReadError(KEY, proof.status),
      mayWriteAppGrant: false,
    };
  }

  if (watermark.status === 'available') {
    return {
      state: {
        entitlement: null,
        revenueCatEmpty: watermark.value,
        trustedRevenueCatProof: null,
        provisionalProviderBarrier: provisionalBarrierFromTrustedMarker(
          trustedMarker,
          reviewedAt,
        ),
      },
      error: null,
      mayWriteAppGrant: true,
    };
  }
  if (watermark.status !== 'absent') {
    return {
      state: EMPTY_CACHE_STATE,
      error: privateReadError(REVENUECAT_EMPTY_KEY, watermark.status),
      mayWriteAppGrant: true,
    };
  }

  if (sidecar.status === 'available') {
    const provisionalProviderBarrier = provisionalBarrierFromTrustedMarker(
      trustedMarker,
      reviewedAt,
    );
    return {
      state: provisionalProviderBarrier
        ? { ...EMPTY_CACHE_STATE, provisionalProviderBarrier }
        : EMPTY_CACHE_STATE,
      error:
        trustedMarker && !provisionalProviderBarrier
          ? entitlementCacheError(ENTITLEMENT_ACTIVE_PROVIDER_BARRIER)
          : null,
      mayWriteAppGrant: true,
    };
  }

  const legacy = await readEntitlementKey(LEGACY_KEY);
  if (legacy.status === 'available') {
    if (legacy.value.source === 'revenuecat') {
      const provisionalProviderBarrier = provisionalBarrierFromRevenueCatProof(
        legacy.value,
        reviewedAt,
      );
      return {
        state: provisionalProviderBarrier
          ? { ...EMPTY_CACHE_STATE, provisionalProviderBarrier }
          : EMPTY_CACHE_STATE,
        error: provisionalProviderBarrier
          ? null
          : entitlementCacheError(ENTITLEMENT_ACTIVE_PROVIDER_BARRIER),
        mayWriteAppGrant: true,
      };
    }
    return {
      state: {
        entitlement: legacy.value,
        revenueCatEmpty: null,
        trustedRevenueCatProof: null,
      },
      error: null,
      mayWriteAppGrant: true,
    };
  }
  return {
    state: EMPTY_CACHE_STATE,
    error:
      legacy.status === 'absent' ? null : privateReadError(LEGACY_KEY, legacy.status),
    mayWriteAppGrant: legacy.status === 'absent',
  };
}

function mergeCacheStates(
  left: EntitlementCacheState,
  right: EntitlementCacheState,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
): EntitlementCacheState {
  const revenueCatEmpty = right.revenueCatEmpty
    ? selectRevenueCatEmptyWatermark(left.revenueCatEmpty, right.revenueCatEmpty, reviewedAt)
    : left.revenueCatEmpty;
  const entitlement = right.entitlement
    ? selectEffectiveEntitlement(left.entitlement, right.entitlement, reviewedAt, appEnvironment)
    : left.entitlement;
  const trustedRevenueCatProof =
    entitlement && markerMatchesRevenueCatProof(right.trustedRevenueCatProof, entitlement)
      ? right.trustedRevenueCatProof
      : entitlement && markerMatchesRevenueCatProof(left.trustedRevenueCatProof, entitlement)
        ? left.trustedRevenueCatProof
        : null;
  const rightMatchesLeftBarrier = Boolean(
    right.entitlement &&
      left.provisionalProviderBarrier?.exactRevenueCatProofIdentity &&
      right.entitlement.source === 'revenuecat' &&
      right.entitlement.storeUserId === left.provisionalProviderBarrier.storeUserId &&
      revenueCatProofIdentity(right.entitlement) ===
        left.provisionalProviderBarrier.exactRevenueCatProofIdentity,
  );
  const provisionalProviderBarrier =
    right.provisionalProviderBarrier ??
    (rightMatchesLeftBarrier ? null : left.provisionalProviderBarrier) ??
    null;
  return canonicalizeCacheState(
    {
      entitlement,
      revenueCatEmpty,
      trustedRevenueCatProof,
      provisionalProviderBarrier,
    },
    reviewedAt,
  );
}

let entitlementMutationTail: Promise<void> = Promise.resolve();
let volatileAccepted:
  | Readonly<{ generation: number; state: EntitlementCacheState }>
  | null = null;

function volatileStateFor(generation: number): EntitlementCacheState {
  return volatileAccepted?.generation === generation
    ? volatileAccepted.state
    : EMPTY_CACHE_STATE;
}

function setVolatileState(generation: number, state: EntitlementCacheState): void {
  volatileAccepted = { generation, state };
}

function runSerializedEntitlementMutation<T>(
  generation: number,
  operation: () => Promise<T>,
): Promise<T> {
  const completion = entitlementMutationTail.catch(() => undefined).then(async () => {
    if (getAccountGeneration() !== generation) throw new Error(ACCOUNT_GENERATION_CHANGED);
    return operation();
  });
  entitlementMutationTail = completion.then(
    () => undefined,
    () => undefined,
  );
  return completion;
}

async function clearSupersededTrustedMarkerBeforeProof(
  state: EntitlementCacheState,
): Promise<void> {
  await updatePrivateItem(REVENUECAT_EMPTY_KEY, (raw) => {
    if (raw === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
    if (!isRecord(parsed) || parsed.version !== WATERMARK_SCHEMA_VERSION) return raw;
    let sidecar: RevenueCatSidecar;
    try {
      sidecar = decodeRevenueCatEmpty(raw);
    } catch {
      return raw;
    }
    if (!sidecar.trustedRevenueCatProof) return raw;
    if (
      state.trustedRevenueCatProof?.storeUserId ===
        sidecar.trustedRevenueCatProof.storeUserId &&
      state.trustedRevenueCatProof.proofIdentity ===
        sidecar.trustedRevenueCatProof.proofIdentity
    ) {
      return raw;
    }
    return sidecar.revenueCatEmpty
      ? encodeRevenueCatEmpty({
          revenueCatEmpty: sidecar.revenueCatEmpty,
          trustedRevenueCatProof: null,
        })
      : null;
  });
}

async function writeCanonicalState(state: EntitlementCacheState): Promise<void> {
  const physicalProof =
    state.entitlement ??
    (state.revenueCatEmpty
      ? revenueCatEmptyTombstone(state.revenueCatEmpty.verifiedAt)
      : null);
  if (physicalProof) {
    // A trusted marker for proof P must not coexist with a newly durable
    // non-RC proof S. Clear the known marker first; a crash then leaves P
    // unchanged or unmarked, never S plus replayable trust for P.
    await clearSupersededTrustedMarkerBeforeProof(state);
    const encoded = encodeEntitlementProof(physicalProof);
    await updatePrivateItem(KEY, (raw) => {
      if (raw !== null) decodeEntitlementProof(raw);
      return raw === encoded ? raw : encoded;
    });
  }
  if (state.revenueCatEmpty || state.trustedRevenueCatProof) {
    const incomingWatermark = state.revenueCatEmpty;
    const incomingMarker = state.trustedRevenueCatProof;
    await updatePrivateItem(REVENUECAT_EMPTY_KEY, (raw) => {
      const currentSidecar = raw === null ? null : decodeRevenueCatEmptyOrLegacyProof(raw);
      const currentWatermark = currentSidecar?.revenueCatEmpty ?? null;
      const selectedWatermark =
        incomingWatermark &&
        currentWatermark &&
        currentWatermark.storeUserId === incomingWatermark.storeUserId &&
        Date.parse(currentWatermark.verifiedAt) >= Date.parse(incomingWatermark.verifiedAt)
          ? currentWatermark
          : incomingWatermark;
      const encoded = encodeRevenueCatEmpty({
        revenueCatEmpty: selectedWatermark,
        trustedRevenueCatProof: incomingMarker,
      });
      return raw === encoded ? raw : encoded;
    });
  } else {
    // v2 is already durable at this point. Remove only our schema-v2 sidecar
    // so a marker for an old proof cannot be replayed after a server/app-grant
    // winner replaces it. A raw/envelope legacy proof is rollback data and is
    // deliberately preserved.
    await updatePrivateItem(REVENUECAT_EMPTY_KEY, (raw) => {
      if (raw === null) return null;
      try {
        return decodeRevenueCatEmptyOrLegacyProof(raw) === null ? raw : null;
      } catch (error) {
        // App grants are independent of the provider sidecar. Once their v2
        // proof is durable, an unreadable/future v1 record must be preserved
        // byte-for-byte but cannot make that independent proof memory-only.
        if (isAppGrantedEntitlement(state.entitlement)) return raw;
        throw error;
      }
    });
  }
}

async function persistAcceptedState(
  generation: number,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
  apply: (state: EntitlementCacheState) => EntitlementCacheState,
): Promise<EntitlementPersistenceAttempt> {
  return runSerializedEntitlementMutation(generation, async () => {
    const snapshot = await persistenceSnapshot(reviewedAt);
    const durableAndVolatile = mergeCacheStates(
      snapshot.state,
      volatileStateFor(generation),
      reviewedAt,
      appEnvironment,
    );
    const accepted = canonicalizeCacheState(apply(durableAndVolatile), reviewedAt);

    // This shadow is the ordering authority even when either physical write
    // fails. A later delayed mutation must encode this winner, not its own T1.
    setVolatileState(generation, accepted);

    const appGrantOnly = isAppGrantedEntitlement(accepted.entitlement);
    if (snapshot.error && !(snapshot.mayWriteAppGrant && appGrantOnly)) {
      return { acceptance: acceptanceFor(accepted, false), error: snapshot.error };
    }
    if (accepted.provisionalProviderBarrier) {
      // An active unmarked proof is a mutation-order barrier, not a revocation.
      // Rejecting older evidence must leave its durable bytes untouched so an
      // exact trusted retry can still finish the marker phase.
      return {
        acceptance: acceptanceFor(accepted, false),
        error: accepted.entitlement
          ? null
          : entitlementCacheError(ENTITLEMENT_ACTIVE_PROVIDER_BARRIER),
      };
    }
    try {
      await writeCanonicalState(accepted);
      return { acceptance: acceptanceFor(accepted, true), error: null };
    } catch (error) {
      return { acceptance: acceptanceFor(accepted, false), error };
    }
  });
}

async function persistVerifiedEntitlement(
  verified: StoredEntitlement,
  reviewedAt: string,
  appEnvironment: AppEnvironment,
  trustedRevenueCat: boolean,
): Promise<EntitlementPersistenceAttempt> {
  const generation = getAccountGeneration();
  return persistAcceptedState(generation, reviewedAt, appEnvironment, (state) => {
    const accepted = applyVerifiedEntitlement(state, verified, reviewedAt, appEnvironment);
    if (!trustedRevenueCat) return accepted;
    const marker = trustedRevenueCatProofMarkerFor(verified);
    return marker &&
      accepted.entitlement &&
      markerMatchesRevenueCatProof(marker, accepted.entitlement)
      ? { ...accepted, trustedRevenueCatProof: marker }
      : accepted;
  });
}

export async function acceptVerifiedEntitlement(
  e: StoredEntitlement,
  options: {
    reviewedAt?: string;
    appEnvironment?: AppEnvironment;
    storeUserId?: string;
  } = {},
): Promise<EntitlementAcceptance> {
  const reviewedAt = options.reviewedAt ?? nowISO();
  const appEnvironment = options.appEnvironment ?? env.appEnvironment;
  const verified = normalizeVerifiedEntitlement(
    options.storeUserId ? { ...e, storeUserId: options.storeUserId } : e,
    reviewedAt,
    appEnvironment,
  );
  const attempt = await persistVerifiedEntitlement(
    verified,
    reviewedAt,
    appEnvironment,
    false,
  );
  if ((attempt.error as Error | null)?.message === ENTITLEMENT_ACTIVE_PROVIDER_BARRIER) {
    throw attempt.error;
  }
  return attempt.acceptance;
}

/**
 * Persist an SDK proof only after `classifyRevenueCatEntitlement` returned its
 * trusted branch. Keeping this separate prevents server/generic call sites from
 * accidentally minting the offline-trust marker.
 */
export async function acceptTrustedRevenueCatEntitlement(
  e: StoredEntitlement,
  options: { reviewedAt?: string; appEnvironment?: AppEnvironment } = {},
): Promise<EntitlementAcceptance> {
  const reviewedAt = options.reviewedAt ?? nowISO();
  const appEnvironment = options.appEnvironment ?? env.appEnvironment;
  const verified = normalizeVerifiedEntitlement(e, reviewedAt, appEnvironment);
  if (verified.source !== 'revenuecat' || !verified.storeUserId) {
    throw new Error('TRUSTED_REVENUECAT_PROOF_REQUIRED');
  }
  const attempt = await persistVerifiedEntitlement(
    verified,
    reviewedAt,
    appEnvironment,
    true,
  );
  if ((attempt.error as Error | null)?.message === ENTITLEMENT_ACTIVE_PROVIDER_BARRIER) {
    throw attempt.error;
  }
  return attempt.acceptance;
}

export async function saveVerifiedEntitlement(e: StoredEntitlement): Promise<StoredEntitlement> {
  const reviewedAt = nowISO();
  const verified = normalizeVerifiedEntitlement(e, reviewedAt, env.appEnvironment);
  const persisted = await persistVerifiedEntitlement(
    verified,
    reviewedAt,
    env.appEnvironment,
    false,
  );
  if (persisted.error) throw persisted.error;
  if (!persisted.acceptance.entitlement) throw new Error('ENTITLEMENT_EVIDENCE_SUPERSEDED');
  return persisted.acceptance.entitlement;
}

export async function acceptRevenueCatVerifiedEmpty(
  evidence: RevenueCatVerifiedEmptyEvidence,
  options: { reviewedAt?: string; appEnvironment?: AppEnvironment } = {},
): Promise<EntitlementAcceptance> {
  const reviewedAt = options.reviewedAt ?? nowISO();
  const appEnvironment = options.appEnvironment ?? env.appEnvironment;
  const verifiedEmpty = normalizeRevenueCatVerifiedEmptyEvidence(evidence, reviewedAt);
  const generation = getAccountGeneration();
  const attempt = await persistAcceptedState(
    generation,
    reviewedAt,
    appEnvironment,
    (state) =>
      applyRevenueCatVerifiedEmpty(state, verifiedEmpty, reviewedAt, appEnvironment),
  );
  if ((attempt.error as Error | null)?.message === ENTITLEMENT_ACTIVE_PROVIDER_BARRIER) {
    throw attempt.error;
  }
  return attempt.acceptance;
}

/** Persist an ordered RevenueCat-empty watermark while preserving independent app grants. */
export async function clearStoreEntitlementIfRevenueCatVerifiedEmpty(
  evidence: RevenueCatVerifiedEmptyEvidence,
): Promise<StoredEntitlement | null> {
  return (await acceptRevenueCatVerifiedEmpty(evidence)).entitlement;
}

/** Graceful local dismissal for expired/app-granted records only. Never cancels a store subscription. */
export async function downgradeToFree(
  expectedEvidenceIdentity: string,
  expectedStoreUserId: string,
): Promise<boolean> {
  const generation = getAccountGeneration();
  return runSerializedEntitlementMutation(generation, async () => {
    const reviewedAt = nowISO();
    const snapshot = await persistenceSnapshot(reviewedAt);
    if (snapshot.error) return false;
    const current = mergeCacheStates(
      snapshot.state,
      volatileStateFor(generation),
      reviewedAt,
      env.appEnvironment,
    );
    if (!current.entitlement) return false;
    if (
      current.entitlement.storeUserId !== expectedStoreUserId ||
      deriveState(current.entitlement, reviewedAt).evidenceIdentity !==
      expectedEvidenceIdentity
    ) {
      return false;
    }
    const expired = Boolean(
      current.entitlement.expiresAt &&
        Date.parse(current.entitlement.expiresAt) <= Date.parse(reviewedAt),
    );
    if (
      current.entitlement.periodType !== 'reverse_trial' ||
      current.entitlement.store !== 'app_granted' ||
      (current.entitlement.source !== 'app_granted' &&
        current.entitlement.source !== 'server') ||
      !expired
    ) {
      return false;
    }
    const entitlement = { ...current.entitlement, isActive: false, willRenew: false };
    const accepted = { ...current, entitlement };
    setVolatileState(generation, accepted);
    try {
      await writeCanonicalState(accepted);
    } catch {
      // A dismissal is advisory and must remain fail-soft when protected
      // storage becomes unavailable between the read and atomic transform.
    }
    return true;
  });
}

/** Read the server entitlement mirror and refresh the local cache when available. */
export async function fetchServerEntitlement(
  assertCurrentOwner: () => void = () => {},
): Promise<ServerEntitlementFetchResult> {
  if (!isSupabaseConfigured) return { status: 'no_evidence' };
  return runAccountGenerationOperation(async (lease) => {
    assertCurrentOwner();
    let owner: Awaited<ReturnType<typeof captureAuthenticatedAccountOwner>>;
    try {
      owner = await captureAuthenticatedAccountOwner(lease);
    } catch {
      lease.assertCurrent();
      assertCurrentOwner();
      return { status: 'failure' };
    }
    if (!owner) return { status: 'failure' };
    let entitlement: StoredEntitlement;
    try {
      const data = await runRequestWithLease(
        lease,
        {
          endpoint: 'entitlement_server',
          deadlineMs: 10_000,
          idempotent: true,
          maxAttempts: 2,
          maxResponseBytes: 256 * 1024,
        },
        async ({ signal }) => {
          const response = await supabase
            .from('entitlements')
            .select('*')
            .eq('user_id', owner.userId)
            .limit(1)
            .abortSignal(signal)
            .maybeSingle();
          if (response.error) {
            throw supabaseRequestFailure(response.error, response.status);
          }
          return response.data;
        },
      );
      lease.assertCurrent();
      assertCurrentOwner();
      if (!data) return { status: 'no_evidence' };
      const mapped = rowToStoredEntitlement(data as EntitlementRow);
      entitlement = isStoreBackedEntitlement(mapped)
        ? { ...mapped, source: 'server', storeUserId: owner.userId }
        : { ...mapped, storeUserId: owner.userId };
    } catch {
      lease.assertCurrent();
      assertCurrentOwner();
      return { status: 'failure' };
    }
    let accepted: EntitlementAcceptance;
    try {
      accepted = await acceptVerifiedEntitlement(entitlement);
    } catch {
      lease.assertCurrent();
      assertCurrentOwner();
      return { status: 'failure' };
    }
    lease.assertCurrent();
    assertCurrentOwner();
    // Valid current-account server evidence remains usable in memory even when
    // protected bytes cannot be decoded or updated. The failed write never
    // mutates those bytes, and invalid server rows were rejected above.
    return { status: 'evidence', acceptance: accepted };
  });
}

export async function startReverseTrialOnServer(
  assertCurrentOwner: () => void = () => {},
  storeUserId?: string,
  assertCanDispatch: () => void = () => {},
): Promise<ReverseTrialStartAcceptance> {
  return runAccountGenerationOperation(async (lease) => {
    assertCurrentOwner();
    lease.assertCurrent();
    if (!isSupabaseConfigured) {
      if (env.appEnvironment !== 'development') {
        throw new Error('Reverse trial is unavailable until Supabase is configured.');
      }

      assertCanDispatch();
      const reviewedAt = nowISO();
      const actionEntitlement = normalizeVerifiedEntitlement({
        tier: 'pro',
        isActive: true,
        periodType: 'reverse_trial',
        store: 'app_granted',
        productId: env.revenueCatReverseTrialProductId,
        expiresAt: daysFromNowISO(LOCAL_REVERSE_TRIAL_DAYS),
        willRenew: false,
        grantedAt: reviewedAt,
        source: 'app_granted',
        environment: 'development',
        managementUrl: null,
        verifiedAt: reviewedAt,
        offeringId: 'local_reverse_trial',
        packageId: 'reverse_trial_7d',
        storeUserId: storeUserId ?? null,
        priceLabel: null,
      }, reviewedAt, env.appEnvironment);
      const accepted = (
        await persistVerifiedEntitlement(
          actionEntitlement,
          reviewedAt,
          env.appEnvironment,
          false,
        )
      ).acceptance;
      lease.assertCurrent();
      assertCurrentOwner();
      if (!accepted.entitlement) throw new Error('ENTITLEMENT_EVIDENCE_SUPERSEDED');
      return {
        ...accepted,
        started:
          accepted.entitlement.storeUserId === actionEntitlement.storeUserId &&
          deriveState(accepted.entitlement, reviewedAt).evidenceIdentity ===
            deriveState(actionEntitlement, reviewedAt).evidenceIdentity,
      };
    }

    assertCanDispatch();
    const data = await invokeEdgeFunction<{ entitlement?: EntitlementRow }>(
      'subscription-grants',
      {
        signal: lease.signal,
        body: { action: 'start_reverse_trial' },
      },
    );
    lease.assertCurrent();
    assertCurrentOwner();

    const row = data?.entitlement;
    if (!row) throw new Error('Reverse trial grant did not return an entitlement.');

    const reviewedAt = nowISO();
    const entitlement = normalizeVerifiedEntitlement(
      storeUserId
        ? { ...rowToStoredEntitlement(row), storeUserId }
        : rowToStoredEntitlement(row),
      reviewedAt,
      env.appEnvironment,
    );
    assertCurrentOwner();
    lease.assertCurrent();
    const accepted = (
      await persistVerifiedEntitlement(
        entitlement,
        reviewedAt,
        env.appEnvironment,
        false,
      )
    ).acceptance;
    lease.assertCurrent();
    assertCurrentOwner();
    if (!accepted.entitlement) throw new Error('ENTITLEMENT_EVIDENCE_SUPERSEDED');
    return {
      ...accepted,
      started:
        accepted.entitlement.storeUserId === entitlement.storeUserId &&
        deriveState(accepted.entitlement, reviewedAt).evidenceIdentity ===
          deriveState(entitlement, reviewedAt).evidenceIdentity,
    };
  });
}

/** Test/seed reset. */
export async function clearEntitlement(): Promise<void> {
  const generation = getAccountGeneration();
  await runSerializedEntitlementMutation(generation, async () => {
    await multiRemovePrivateItems([KEY, LEGACY_KEY]);
    if (volatileAccepted?.generation === generation) volatileAccepted = null;
  });
}
