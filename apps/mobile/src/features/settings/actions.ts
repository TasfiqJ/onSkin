import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase/client';

// Account deletion (Apple 5.1.1(v) / docs/01 §4): calls the service-role Edge
// Function which revokes the SIWA token, deletes the auth user (FK-cascades all
// tables), purges Storage, and removes the RC/PostHog records, then signs out.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('account-deletion', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
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
