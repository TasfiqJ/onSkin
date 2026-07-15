import { randomUUID } from 'expo-crypto';

import { runHealthDependentConsentOperation } from '@/lib/consent/dependentConsentLease';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';
import { getPrivateBoolean, setPrivateBoolean } from '@/lib/storage/privateBoolean';
import { removePrivateItem } from '@/lib/storage/privateKV';

import { isHealthSafePayload, type ClickPayload } from './attribution';

// Local-first commerce state (docs/10 §5/§6, the D-029 pattern). The commerce-consent
// flag is the v1 source of truth (offline-safe; the "where to buy" gate must work
// before the backend exists, B-SUPABASE), with a guarded mirror. The click token is an
// OPAQUE correlation handle tied to NO skin data; recordClick mirrors a content-free
// click_event (owner-RLS) and is belt-and-suspenders guarded so a health-adjacent key
// can never be persisted.

const CONSENT_KEY = 'onskin.commerceConsent.v1';

export async function getCommerceConsentLocal(): Promise<boolean> {
  return getPrivateBoolean(CONSENT_KEY);
}

export async function setCommerceConsentLocal(granted: boolean): Promise<void> {
  await setPrivateBoolean(CONSENT_KEY, granted);
}

/** An opaque, random click token. Carries no profile/concern/photo (docs/10 §5). */
export function buildClickToken(): string {
  return randomUUID().replace(/-/g, '');
}

/** Mirror a content-free click event (owner-RLS). Never persists a health-adjacent
 *  key (guarded). Guarded for offline / no backend (B-SUPABASE). */
export async function recordClick(payload: ClickPayload): Promise<void> {
  if (!isHealthSafePayload(payload as unknown as Record<string, unknown>)) {
    throw new Error('COMMERCE_CLICK_PAYLOAD_INVALID');
  }
  await runHealthDependentConsentOperation('data_sharing', async (lease) => {
    lease.assertCurrent();
    const { data } = await getPersistedSupabaseUser();
    lease.assertCurrent();
    if (data.user?.id !== lease.ownerUserId) {
      throw new Error('HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED');
    }
    lease.assertCurrent();
    const { error } = await supabase
      .from('commerce_click_events')
      .insert({
        user_id: lease.ownerUserId,
        click_token: payload.clickToken,
        product_type: payload.productType,
        source: payload.source,
        consented: payload.consented,
      })
      .abortSignal(lease.signal);
    lease.assertCurrent();
    if (error) throw error;
  });
}

/** Test/seed reset. */
export async function clearCommerceState(): Promise<void> {
  await removePrivateItem(CONSENT_KEY);
}
