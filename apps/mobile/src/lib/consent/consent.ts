import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { isSupabaseConfigured } from '@/lib/env';

import { getPersistedSupabaseUser, supabase } from '../supabase/client';

// Records an unbundled consent into the immutable ledger (docs/01 §3/§4). Stores
// a SHA-256 hash of the EXACT text the user agreed to + the version, so we can
// prove what was shown. Revocation is a NEW row with granted=false (the DB blocks
// UPDATEs). Final consent copy/versions are BLOCKED: B-PRIVACY-COPY.
export async function recordConsent(params: {
  type: ConsentType;
  granted: boolean;
  version: string;
  consentText: string;
  /** Optional in-memory owner fence for a larger destructive workflow. */
  expectedUserId?: string;
}): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');

  const consentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    params.consentText,
  );
  const { data: userData } = await getPersistedSupabaseUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('recordConsent requires an authenticated session');
  if (params.expectedUserId !== undefined && userId !== params.expectedUserId) {
    throw new Error('CONSENT_OWNER_CHANGED');
  }

  const { error } = await supabase.from('consents').insert({
    user_id: userId,
    consent_type: params.type,
    granted: params.granted,
    version: params.version,
    consent_text_hash: consentTextHash,
  });
  if (error) throw error;
}

/** Latest consent state per type for the current user (a revocation is a newer row). */
export async function getLatestConsents(): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured) return {};

  const { data, error } = await supabase
    .from('consents')
    .select('consent_type, granted, granted_at')
    .order('granted_at', { ascending: false });
  if (error) throw error;
  const latest: Record<string, boolean> = {};
  for (const row of data ?? []) {
    if (!(row.consent_type in latest)) latest[row.consent_type] = row.granted;
  }
  return latest;
}
