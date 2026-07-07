import { env, isSupabaseConfigured } from '@/lib/env';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { supabase } from '@/lib/supabase/client';
import {
  getPrivateItem,
  multiRemovePrivateItems,
  removePrivateItem,
  setPrivateItem,
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

  return {
    tier,
    isActive:
      rawActive && activeHasVerifiedSource && activeHasRequiredExpiry && !devGrantedInNonDev,
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

type EntitlementRead =
  | { status: 'missing' | 'invalid'; entitlement: null }
  | { status: 'valid'; entitlement: StoredEntitlement };

async function readEntitlementKey(key: string): Promise<EntitlementRead> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(key);
  } catch {
    return { status: 'missing', entitlement: null };
  }
  if (!raw) return { status: 'missing', entitlement: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeStoredEntitlement(parsed);
    if (!normalized) {
      await removePrivateItem(key).catch(() => undefined);
      return { status: 'invalid', entitlement: null };
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await setPrivateItem(key, JSON.stringify(normalized)).catch(() => undefined);
    }
    return { status: 'valid', entitlement: normalized };
  } catch {
    await removePrivateItem(key).catch(() => undefined);
    return { status: 'invalid', entitlement: null };
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

export async function loadEntitlement(): Promise<StoredEntitlement | null> {
  const current = await readEntitlementKey(KEY);
  if (current.status === 'valid') return current.entitlement;

  const legacy = await readEntitlementKey(LEGACY_KEY);
  if (legacy.status === 'valid') {
    await persist(legacy.entitlement).catch(() => undefined);
    return legacy.entitlement;
  }
  return null;
}

async function persist(e: StoredEntitlement | null): Promise<void> {
  if (e === null) {
    await multiRemovePrivateItems([KEY, LEGACY_KEY]);
  } else {
    await setPrivateItem(KEY, JSON.stringify(e));
  }
}

export async function saveVerifiedEntitlement(e: StoredEntitlement): Promise<StoredEntitlement> {
  const verified = normalizeStoredEntitlement({
    ...e,
    verifiedAt: e.verifiedAt ?? nowISO(),
  });
  if (!verified) throw new Error('INVALID_ENTITLEMENT_CACHE_RECORD');
  await persist(verified);
  return verified;
}

/** Graceful local dismissal for expired/app-granted records only. Never cancels a store subscription. */
export async function downgradeToFree(): Promise<void> {
  const cur = await loadEntitlement();
  if (!cur) return;
  const expired = Boolean(cur.expiresAt && new Date(cur.expiresAt).getTime() <= Date.now());
  if (cur.periodType === 'reverse_trial' || expired) {
    await persist({ ...cur, isActive: false, willRenew: false });
  }
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
  await persist(null);
}
