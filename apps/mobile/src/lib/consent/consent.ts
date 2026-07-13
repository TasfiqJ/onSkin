import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
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
    const consentTextHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      params.consentText,
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

/** Latest consent state per type for the current user (a revocation is a newer row). */
export async function getLatestConsents(): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured) return {};

  return runAccountGenerationOperation(async (lease) => {
    const { data, error } = await supabase
      .from('consents')
      .select('consent_type, granted, granted_at')
      .order('granted_at', { ascending: false })
      .abortSignal(lease.signal);
    lease.assertCurrent();
    if (error) throw error;
    const latest: Record<string, boolean> = {};
    for (const row of data ?? []) {
      if (!(row.consent_type in latest)) latest[row.consent_type] = row.granted;
    }
    return latest;
  });
}
