import 'react-native-url-polyfill/auto'; // supabase-js needs a WHATWG URL on RN
import type { Database } from '@onskin/types/database';
import { createClient } from '@supabase/supabase-js';

import { env } from '../env';
import { LargeSecureStore } from './largeSecureStore';

// docs/01 §5 client flags. Storage is the encrypted LargeSecureStore.
// BLOCKED: B-SUPABASE — url/key read from env placeholders until the project exists.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
