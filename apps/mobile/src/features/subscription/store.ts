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

import type { StoredEntitlement } from './entitlement';

/**
 * Local-first entitlement cache. This is only a cache of RevenueCat CustomerInfo
 * or service-role Supabase grants; production flows never create paid/trial access
 * locally. Offline Pro access remains usable only after a verified grant has been
 * cached on this device.
 */
const KEY = 'onskin.entitlement.v2';
const LEGACY_KEY = 'onskin.entitlement.v1';
const LOCAL_REVERSE_TRIAL_DAYS = 7;
const SCHEMA_VERSION = 1 as const;

export const ENTITLEMENT_CACHE_INVALID = 'ENTITLEMENT_CACHE_INVALID';
export const ENTITLEMENT_CACHE_UNSUPPORTED_VERSION =
  'ENTITLEMENT_CACHE_UNSUPPORTED_VERSION';

type EntitlementCacheEnvelope = {
  version: typeof SCHEMA_VERSION;
  entitlement: StoredEntitlement;
};

const ENTITLEMENT_CACHE_ENVELOPE_KEYS = ['version', 'entitlement'] as const;
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

export type EntitlementCacheRead =
  | { status: 'available'; entitlement: StoredEntitlement }
  | {
      status: 'absent' | 'unavailable' | 'corrupt' | 'unsupported_version';
      entitlement: null;
    };

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

function entitlementCacheError(code: string): Error {
  return new Error(code);
}

function decodeEntitlementCache(raw: string): StoredEntitlement {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  }

  if (!isRecord(parsed)) throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);

  let value: unknown = parsed;
  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > SCHEMA_VERSION
      ) {
        throw entitlementCacheError(ENTITLEMENT_CACHE_UNSUPPORTED_VERSION);
      }
      throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
    }
    if (
      !hasExactKeys(parsed, ENTITLEMENT_CACHE_ENVELOPE_KEYS) ||
      !isStrictCurrentEntitlement(parsed.entitlement)
    ) {
      throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
    }
    value = parsed.entitlement;
  }

  const normalized = normalizeStoredEntitlement(value);
  if (!normalized) throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
  return normalized;
}

function encodeEntitlementCache(entitlement: StoredEntitlement): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    entitlement,
  } satisfies EntitlementCacheEnvelope);
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function isEntitlementCodecError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    message === ENTITLEMENT_CACHE_INVALID ||
    message === ENTITLEMENT_CACHE_UNSUPPORTED_VERSION
  );
}

function classifyPrivateReadError(error: unknown): EntitlementCacheRead {
  const message = errorMessage(error);
  if (
    message === ENTITLEMENT_CACHE_UNSUPPORTED_VERSION ||
    message === PRIVATE_KV_ENVELOPE_UNSUPPORTED
  ) {
    return { status: 'unsupported_version', entitlement: null };
  }
  if (
    message === ENTITLEMENT_CACHE_INVALID ||
    message === PRIVATE_KV_ENVELOPE_INVALID ||
    message === PRIVATE_KV_DECRYPTION_FAILED
  ) {
    return { status: 'corrupt', entitlement: null };
  }
  return { status: 'unavailable', entitlement: null };
}

async function readEntitlementKey(key: string): Promise<EntitlementCacheRead> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(key);
  } catch (error) {
    return classifyPrivateReadError(error);
  }
  if (raw === null) return { status: 'absent', entitlement: null };
  try {
    return { status: 'available', entitlement: decodeEntitlementCache(raw) };
  } catch (error) {
    return classifyPrivateReadError(error);
  }
}

export function rowToStoredEntitlement(row: EntitlementRow): StoredEntitlement {
  return {
    tier: asTier(row.entitlement),
    isActive: row.is_active,
    periodType: asPeriod(row.period_type),
    store: asStore(row.store),
    productId: row.product_id,
    expiresAt: row.expires_at,
    willRenew: row.will_renew,
    grantedAt: row.original_purchase_at,
    source: asSource(row.source) ?? (row.store === 'app_granted' ? 'app_granted' : 'server'),
    environment: asEnvironment(row.environment),
    managementUrl: safeExternalHttpsUrl(row.management_url),
    verifiedAt: row.verified_at ?? row.updated_at ?? nowISO(),
    offeringId: row.offering_id ?? null,
    packageId: row.package_id ?? null,
    storeUserId: row.store_user_id ?? null,
  };
}

/**
 * Read the effective local proof without repairing, deleting, or migrating bytes.
 * A non-absent primary record is authoritative: unreadable/future primary bytes
 * must not revive potentially stale access from the older key.
 */
export async function readEntitlementCache(): Promise<EntitlementCacheRead> {
  const current = await readEntitlementKey(KEY);
  if (current.status !== 'absent') return current;

  return readEntitlementKey(LEGACY_KEY);
}

export async function loadEntitlement(): Promise<StoredEntitlement | null> {
  const result = await readEntitlementCache();
  return result.status === 'available' ? result.entitlement : null;
}

type EntitlementMutationOutcome = 'present' | 'absent' | 'blocked';

async function mutateEntitlementKey(
  key: string,
  transform: (current: StoredEntitlement) => StoredEntitlement | null,
): Promise<EntitlementMutationOutcome> {
  let updaterRan = false;
  let present = false;
  try {
    await updatePrivateItem(key, (raw) => {
      updaterRan = true;
      if (raw === null) return null;
      present = true;
      const current = decodeEntitlementCache(raw);
      const next = transform(current);
      if (next === current) return raw;
      if (next === null) return null;
      const normalized = normalizeStoredEntitlement(next);
      if (!normalized) throw entitlementCacheError(ENTITLEMENT_CACHE_INVALID);
      return encodeEntitlementCache(normalized);
    });
  } catch (error) {
    // Fail-soft only when the current bytes could not be read/decoded. Failures
    // after a successful transform (for example, disk write failure) still reject.
    if (!updaterRan || isEntitlementCodecError(error)) return 'blocked';
    throw error;
  }
  return present ? 'present' : 'absent';
}

export async function saveVerifiedEntitlement(e: StoredEntitlement): Promise<StoredEntitlement> {
  const verified = normalizeStoredEntitlement({
    ...e,
    verifiedAt: e.verifiedAt ?? nowISO(),
  });
  if (!verified) throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  const encoded = encodeEntitlementCache(verified);
  await updatePrivateItem(KEY, (current) => {
    if (current !== null) decodeEntitlementCache(current);
    return current === encoded ? current : encoded;
  });
  return verified;
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

/**
 * A configured RevenueCat sync with no entitlement is a verified empty store
 * state. Clear only store-backed access; app-granted reverse trials are not
 * store purchases and must survive a user tapping Restore.
 */
export async function clearStoreEntitlementIfRevenueCatVerifiedEmpty(): Promise<void> {
  const clearStoreBacked = (current: StoredEntitlement): StoredEntitlement | null =>
    isStoreBackedEntitlement(current) ? null : current;
  const primary = await mutateEntitlementKey(KEY, clearStoreBacked);
  if (primary === 'blocked') return;
  await mutateEntitlementKey(LEGACY_KEY, clearStoreBacked);
}

/** Graceful local dismissal for expired/app-granted records only. Never cancels a store subscription. */
export async function downgradeToFree(): Promise<void> {
  const downgrade = (current: StoredEntitlement): StoredEntitlement => {
    const expired = Boolean(
      current.expiresAt && new Date(current.expiresAt).getTime() <= Date.now(),
    );
    return current.periodType === 'reverse_trial' || expired
      ? { ...current, isActive: false, willRenew: false }
      : current;
  };
  const primary = await mutateEntitlementKey(KEY, downgrade);
  if (primary === 'absent') await mutateEntitlementKey(LEGACY_KEY, downgrade);
}

/** Read the server entitlement mirror and refresh the local cache when available. */
export async function fetchServerEntitlement(): Promise<StoredEntitlement | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from('entitlements').select('*').limit(1).maybeSingle();
    if (error || !data) return null;
    const entitlement = rowToStoredEntitlement(data as EntitlementRow);
    return saveVerifiedEntitlement(entitlement);
  } catch {
    return null;
  }
}

export async function startReverseTrialOnServer(): Promise<StoredEntitlement> {
  if (!isSupabaseConfigured) {
    if (env.appEnvironment !== 'development') {
      throw new Error('Reverse trial is unavailable until Supabase is configured.');
    }

    return saveVerifiedEntitlement({
      tier: 'pro',
      isActive: true,
      periodType: 'reverse_trial',
      store: 'app_granted',
      productId: env.revenueCatReverseTrialProductId,
      expiresAt: daysFromNowISO(LOCAL_REVERSE_TRIAL_DAYS),
      willRenew: false,
      grantedAt: nowISO(),
      source: 'app_granted',
      environment: 'development',
      managementUrl: null,
      verifiedAt: nowISO(),
      offeringId: 'local_reverse_trial',
      packageId: 'reverse_trial_7d',
      storeUserId: null,
      priceLabel: null,
    });
  }

  const { data, error } = await supabase.functions.invoke('subscription-grants', {
    body: { action: 'start_reverse_trial' },
  });
  if (error) throw error;

  const row = (data as { entitlement?: EntitlementRow })?.entitlement;
  if (!row) throw new Error('Reverse trial grant did not return an entitlement.');

  const entitlement = rowToStoredEntitlement(row);
  return saveVerifiedEntitlement(entitlement);
}

/** Test/seed reset. */
export async function clearEntitlement(): Promise<void> {
  await multiRemovePrivateItems([KEY, LEGACY_KEY]);
}
