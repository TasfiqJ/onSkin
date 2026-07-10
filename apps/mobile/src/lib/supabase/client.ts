import 'react-native-url-polyfill/auto'; // supabase-js needs a WHATWG URL on RN
import type { Database } from '@onskin/types/database';
import { createClient } from '@supabase/supabase-js';

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
    storage: authStorage,
    storageKey: authStorageKey,
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
  },
});
