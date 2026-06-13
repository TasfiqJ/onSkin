import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase/client';

import type { StoredEntitlement } from './entitlement';
import { PLANS, REVERSE_TRIAL_DAYS } from './plans';

/**
 * Local-first entitlement cache (docs/08 §4 "gate on the cached entitlement,
 * offline-safe", the D-029 pattern). The server `entitlements` row is the eventual
 * source of truth (written service-role by the RevenueCat webhook + the reverse-
 * trial grant Edge Function), but clients can only SELECT it (RLS) and there is no
 * live backend yet (B-SUPABASE) — so this AsyncStorage cache is the v1 authority,
 * reconciled from the server when present. The app-granted reverse trial is fully
 * functional locally; the carded trial/purchase are STUBBED until B-REVENUECAT.
 */
const KEY = 'onskin.entitlement.v1';

function nowISO(): string {
  return new Date().toISOString();
}
function plusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function loadEntitlement(): Promise<StoredEntitlement | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredEntitlement) : null;
  } catch {
    return null;
  }
}

async function persist(e: StoredEntitlement | null): Promise<void> {
  if (e === null) await AsyncStorage.removeItem(KEY);
  else await AsyncStorage.setItem(KEY, JSON.stringify(e));
}

/** The app-granted reverse trial: full Pro, no card, ~7 days (docs/08 §2.2/§4). */
export async function grantReverseTrial(): Promise<StoredEntitlement> {
  const e: StoredEntitlement = {
    tier: 'pro',
    isActive: true,
    periodType: 'reverse_trial',
    store: 'app_granted',
    productId: null,
    expiresAt: plusDays(REVERSE_TRIAL_DAYS),
    willRenew: false, // never auto-renews — no card, no store txn
    grantedAt: nowISO(),
  };
  await persist(e);
  return e;
}

/** The carded 14-day store trial (STUBBED purchase, B-REVENUECAT). Real StoreKit/
 *  Play purchase replaces this grant when the SDK lands. */
export async function grantTrial(): Promise<StoredEntitlement> {
  const e: StoredEntitlement = {
    tier: 'pro',
    isActive: true,
    periodType: 'trial',
    store: 'app_store',
    productId: PLANS.annual.productId,
    expiresAt: plusDays(PLANS.annual.trialDays),
    willRenew: true,
    grantedAt: nowISO(),
  };
  await persist(e);
  return e;
}

/** A converted/paid subscription (or a direct purchase). One year out for annual. */
export async function setActivePaid(productId = PLANS.annual.productId): Promise<StoredEntitlement> {
  const e: StoredEntitlement = {
    tier: 'pro',
    isActive: true,
    periodType: 'normal',
    store: 'app_store',
    productId,
    expiresAt: plusDays(365),
    willRenew: true,
    grantedAt: nowISO(),
  };
  await persist(e);
  return e;
}

/** Graceful downgrade: deactivate but KEEP the record (so `expired` + priorPeriodType
 *  survive for the re-offer / downgrade framing). Data is never deleted (docs/08 §6). */
export async function downgradeToFree(): Promise<void> {
  const cur = await loadEntitlement();
  if (cur) await persist({ ...cur, isActive: false });
}

/** Best-effort read of the server entitlements row (forward-compat; B-SUPABASE).
 *  Returns null when there is no backend or no row — the local cache then stands. */
export async function fetchServerEntitlement(): Promise<StoredEntitlement | null> {
  try {
    const { data } = await supabase
      .from('entitlements')
      .select('entitlement, is_active, period_type, store, product_id, expires_at, will_renew, original_purchase_at')
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      tier: (data.entitlement as 'pro' | 'pro_plus' | null) ?? null,
      isActive: data.is_active,
      periodType: (data.period_type as StoredEntitlement['periodType']) ?? null,
      store: (data.store as StoredEntitlement['store']) ?? null,
      productId: data.product_id,
      expiresAt: data.expires_at,
      willRenew: data.will_renew,
      grantedAt: data.original_purchase_at,
    };
  } catch {
    return null;
  }
}

/** Test/seed reset. */
export async function clearEntitlement(): Promise<void> {
  await persist(null);
}
