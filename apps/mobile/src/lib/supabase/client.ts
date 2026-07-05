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

// docs/01 §5 client flags. Storage is the encrypted LargeSecureStore.
// BLOCKED: B-SUPABASE. Url/key read from env placeholders until the project exists.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: isServerRender ? serverAuthStorage : new LargeSecureStore(),
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
  },
});
