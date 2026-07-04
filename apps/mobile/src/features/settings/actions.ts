import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { HEALTH_DATA_WITHDRAWAL } from '@/features/onboarding/consentCopy';
import { clearStoredSkinProfile } from '@/features/onboarding/skinProfileStore';
import { recordConsent } from '@/lib/consent/consent';
import { getAppleAuthorizationCodeForRevocation } from '@/lib/auth/apple';
import { supabase } from '@/lib/supabase/client';

// Account deletion (Apple 5.1.1(v) / docs/01 §4): calls the service-role Edge
// Function which revokes the SIWA token, deletes the auth user (FK-cascades all
// tables), purges Storage, and removes the RC/PostHog records, then signs out.
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const appleAuthorizationCode = data.user
    ? await getAppleAuthorizationCodeForRevocation(data.user).catch(() => null)
    : null;
  const { error } = await supabase.functions.invoke('account-deletion', {
    method: 'POST',
    body: appleAuthorizationCode ? { appleAuthorizationCode } : {},
  });
  if (error) throw error;
  // Clear the device-global local-first onboarding record so the next (fresh
  // anonymous) session is correctly routed back through onboarding rather than
  // inheriting the deleted account's "already onboarded" entry-gate signal.
  await clearStoredSkinProfile();
  await supabase.auth.signOut();
}

// Health-data consent withdrawal (docs/01 §4: MHMDA/GDPR right to withdraw,
// which must be as easy as granting). The skin profile, quiz answers, and
// goals ARE the account, so withdrawing health-data-collection consent records
// an immutable granted=false ledger row (proof of the withdrawal) and then
// deletes the account and all data via the same cascade as deleteAccount. The
// You-tab copy that promises "your data is then deleted" is now backed by code.
export async function withdrawHealthDataConsent(): Promise<void> {
  try {
    await recordConsent({
      type: 'health_data_collection',
      granted: false,
      version: HEALTH_DATA_WITHDRAWAL.version,
      consentText: HEALTH_DATA_WITHDRAWAL.fullText,
    });
  } catch {
    // Best-effort ledger write until the backend is configured (B-SUPABASE).
    // The deletion below is the substantive guarantee and runs regardless.
  }
  await deleteAccount();
}

// GDPR Art. 20 export (docs/01 §4): the Edge Function assembles a JSON bundle;
// we write it to a cache file and hand it to the OS share sheet.
export async function exportData(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('data-export', { method: 'POST' });
  if (error) throw error;
  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const uri = `${FileSystem.cacheDirectory ?? ''}onskin-export.json`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export your OnSkin data' });
  }
}
