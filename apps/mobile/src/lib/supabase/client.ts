import 'react-native-url-polyfill/auto'; // supabase-js needs a WHATWG URL on RN
import type { Database } from '@onskin/types/database';
import { createClient, processLock } from '@supabase/supabase-js';

import { env } from '../env';
import { LargeSecureStore } from './largeSecureStore';

const isServerRender = typeof window === 'undefined';
const serverAuthStorage = {
  async getItem(): Promise<string | null> {
    return null;
  },
  async setItem(): Promise<void> {},
  async removeItem(): Promise<void> {},
};
const authStorage = isServerRender ? serverAuthStorage : new LargeSecureStore();
const authStorageKey = `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`;
const authStorageLockName = `lock:${authStorageKey}`;

export function runSupabaseAuthStorageMutation<T>(operation: () => Promise<T>): Promise<T> {
  return processLock(authStorageLockName, -1, operation);
}

export async function clearPersistedSupabaseSession(): Promise<void> {
  const results = await Promise.allSettled([
    authStorage.removeItem(authStorageKey),
    authStorage.removeItem(`${authStorageKey}-code-verifier`),
  ]);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`SUPABASE_AUTH_STORAGE_CLEAR_FAILED:${failures.length}`);
  }
}

// docs/01 §5 client flags. Storage is the encrypted LargeSecureStore.
// BLOCKED: B-SUPABASE. Url/key read from env placeholders until the project exists.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    lock: processLock,
    storage: authStorage,
    storageKey: authStorageKey,
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
  },
});

/**
 * Invalidate auth-js state through its public local-sign-out path before any
 * direct storage verification. `_removeSession` advances auth-js's internal
 * removal epoch synchronously, so a refresh already between its final storage
 * read and token save must discard the rotated session instead of resurrecting
 * it after account deletion.
 */
export async function invalidateLocalSupabaseSession(): Promise<void> {
  supabase.auth.stopAutoRefresh();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error('SUPABASE_LOCAL_SESSION_INVALIDATION_FAILED');
  await clearPersistedSupabaseSession();
}
