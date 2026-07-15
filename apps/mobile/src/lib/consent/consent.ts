import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { requireAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { isSupabaseConfigured } from '@/lib/env';

import { supabase } from '../supabase/client';

// Records an unbundled consent into the immutable ledger (docs/01 §3/§4). Stores
// a SHA-256 hash of the EXACT text the user agreed to + the version, so we can
// prove what was shown. Revocation is a NEW row with granted=false (the DB blocks
// UPDATEs). Final consent copy/versions are BLOCKED: B-PRIVACY-COPY.
export async function recordConsent(params: {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentText: string;
}): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');

  await runAccountGenerationOperation(async (lease) => {
    const { userId } = await requireAuthenticatedAccountOwner(lease);
    const consentTextHash = await awaitAccountGenerationLease(lease, () =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, params.consentText),
    );
    lease.assertCurrent();

    const { error } = await supabase
      .from('consents')
      .insert({
        user_id: userId,
        consent_type: params.type,
        granted: params.granted,
        version: params.version,
        consent_text_hash: consentTextHash,
      })
      .abortSignal(lease.signal);
    lease.assertCurrent();
    if (error) throw error;
  });
}

/** Latest consent state per type for the leased owner (a revocation is a newer row). */
export async function getLatestConsentsWithLease(
  lease: AccountGenerationLease,
): Promise<Record<string, boolean>> {
  lease.assertCurrent();
  if (!isSupabaseConfigured) return {};

  const { data, error } = await awaitAccountGenerationLease(lease, () =>
    supabase
      .from('consents')
      .select('consent_type, granted, granted_at')
      .order('granted_at', { ascending: false })
      // Match public.has_current_consent: an equal-time revocation wins.
      .order('granted', { ascending: true })
      .abortSignal(lease.signal),
  );
  lease.assertCurrent();
  if (error) throw error;
  const latest: Record<string, boolean> = {};
  for (const row of data ?? []) {
    if (!(row.consent_type in latest)) latest[row.consent_type] = row.granted;
  }
  return latest;
}

/** Compatibility entry point for non-query callers. Owner-bound queries reuse their lease. */
export function getLatestConsents(): Promise<Record<string, boolean>> {
  return runAccountGenerationOperation(getLatestConsentsWithLease);
}
