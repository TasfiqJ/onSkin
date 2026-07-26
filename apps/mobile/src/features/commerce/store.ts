import { randomUUID } from 'expo-crypto';

import {
  AccountGenerationLeaseError,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { runRequestWithLease, supabaseRequestFailure } from '@/lib/network/requestPolicy';
import { runOwnerQueryOperation, type OwnerQueryScope } from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase/client';
import {
  readPrivateBoolean,
  type PrivateBooleanReadResult,
  updatePrivateBoolean,
} from '@/lib/storage/privateBoolean';
import { removePrivateItem } from '@/lib/storage/privateKV';

import { isHealthSafePayload, type ClickPayload } from './attribution';

// Local-first commerce state (docs/10 §5/§6, the D-029 pattern). The commerce-consent
// flag is the v1 source of truth (offline-safe; the "where to buy" gate must work
// before the backend exists, B-SUPABASE), with a guarded mirror. The click token is an
// OPAQUE correlation handle tied to NO skin data; recordClick mirrors a content-free
// click_event (owner-RLS) and is belt-and-suspenders guarded so a health-adjacent key
// can never be persisted.

const CONSENT_KEY = 'onskin.commerceConsent.v1';
export const COMMERCE_CONSENT_WITHDRAWAL_PENDING = 'COMMERCE_CONSENT_WITHDRAWAL_PENDING';

export async function readCommerceConsentLocal(): Promise<PrivateBooleanReadResult> {
  return readPrivateBoolean(CONSENT_KEY);
}

export async function setCommerceConsentLocal(granted: boolean): Promise<void> {
  await updatePrivateBoolean(CONSENT_KEY, (current) => {
    if (granted && current === false) {
      throw new Error(COMMERCE_CONSENT_WITHDRAWAL_PENDING);
    }
    return granted;
  });
}

/** Remove the existing local/pending marker after server cleanup is acknowledged. */
export async function clearCommerceConsentLocal(): Promise<void> {
  await removePrivateItem(CONSENT_KEY);
}

/** An opaque, random click token. Carries no profile/concern/photo (docs/10 §5). */
export function buildClickToken(): string {
  return randomUUID().replace(/-/g, '');
}

/** Keep owner attribution and the eventual external handoff in one mounted-owner
 * lease. Account isolation can abort and drain the whole tap before owner B mounts. */
export async function runCommerceClickOperation<T>(
  ownerScope: OwnerQueryScope,
  payload: ClickPayload,
  operation: (lease: AccountGenerationLease) => T | Promise<T>,
): Promise<T | undefined> {
  if (!isHealthSafePayload(payload as unknown as Record<string, unknown>)) return undefined;

  return runOwnerQueryOperation(ownerScope, async (lease) => {
    try {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (owner) {
        lease.assertCurrent();
        await runRequestWithLease(
          lease,
          {
            endpoint: 'commerce_click_event',
            deadlineMs: 8_000,
            idempotent: true,
            maxAttempts: 2,
            maxResponseBytes: 16 * 1024,
          },
          async ({ signal }) => {
            const response = await supabase
              .from('commerce_click_events')
              .insert({
                user_id: owner.userId,
                click_token: payload.clickToken,
                product_type: payload.productType,
                source: payload.source,
                consented: payload.consented,
              })
              .abortSignal(signal);
            // The owner/token unique index turns a response-lost retry into an
            // exact replay of the same content-free event.
            if (response.error?.code === '23505') return null;
            if (response.error) {
              throw supabaseRequestFailure(response.error, response.status);
            }
            return null;
          },
        );
        lease.assertCurrent();
      }
    } catch (error) {
      if (error instanceof AccountGenerationLeaseError) throw error;
      lease.assertCurrent();
      /* offline / no DB */
    }

    lease.assertCurrent();
    const result = await operation(lease);
    lease.assertCurrent();
    return result;
  });
}

/** Mirror a content-free click event (owner-RLS). Never persists a health-adjacent
 *  key (guarded). Guarded for offline / no backend (B-SUPABASE). */
export async function recordClick(
  ownerScope: OwnerQueryScope,
  payload: ClickPayload,
): Promise<void> {
  await runCommerceClickOperation(ownerScope, payload, () => undefined);
}

/** Test/seed reset. */
export async function clearCommerceState(): Promise<void> {
  await clearCommerceConsentLocal();
}
