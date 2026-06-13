import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { supabase } from '@/lib/supabase/client';

import { isHealthSafePayload, type ClickPayload } from './attribution';

// Local-first commerce state (docs/10 §5/§6, the D-029 pattern). The commerce-consent
// flag is the v1 source of truth (offline-safe; the "where to buy" gate must work
// before the backend exists, B-SUPABASE), with a guarded mirror. The click token is an
// OPAQUE correlation handle tied to NO skin data; recordClick mirrors a content-free
// click_event (owner-RLS) and is belt-and-suspenders guarded so a health-adjacent key
// can never be persisted.

const CONSENT_KEY = 'onskin.commerceConsent.v1';

export async function getCommerceConsentLocal(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setCommerceConsentLocal(granted: boolean): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, granted ? 'true' : 'false');
}

/** An opaque, random click token — carries no profile/concern/photo (docs/10 §5). */
export function buildClickToken(): string {
  return randomUUID().replace(/-/g, '');
}

/** Mirror a content-free click event (owner-RLS). Never persists a health-adjacent
 *  key (guarded). Guarded for offline / no backend (B-SUPABASE). */
export async function recordClick(payload: ClickPayload): Promise<void> {
  if (!isHealthSafePayload(payload as unknown as Record<string, unknown>)) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.id) return;
    await supabase.from('commerce_click_events').insert({
      user_id: data.user.id,
      click_token: payload.clickToken,
      product_type: payload.productType,
      source: payload.source,
      consented: payload.consented,
    });
  } catch {
    /* offline / no DB */
  }
}

/** Test/seed reset. */
export async function clearCommerceState(): Promise<void> {
  await AsyncStorage.removeItem(CONSENT_KEY);
}
