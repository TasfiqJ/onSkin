import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { userEdgeBodyMaxBytes } from '../_shared/body.ts';
import {
  externalFetchTimeoutMs,
  externalResponseMaxBytes,
  fetchWithTimeout,
} from '../_shared/fetch.ts';
import { loadAppleLifecycleSecrets } from '../_shared/appleLifecycleSecrets.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { persistVerifiedAppleAccountEvent } from './core.ts';
import { createAppleAccountEventDatabase } from './database.ts';
import { createAppleAccountEventHttpHandler } from './httpHandler.ts';
import { createAppleServerEventVerifier } from './verifier.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const clientId = Deno.env.get('APPLE_SIWA_CLIENT_ID') ?? '';
const maxBodyBytes = Math.min(userEdgeBodyMaxBytes(), 40_000);
const secrets = await loadAppleLifecycleSecrets();
const verify = await createAppleServerEventVerifier({
  clientId,
  fetcher: (input, init, timeoutMs) => fetchWithTimeout(input, init, timeoutMs),
  now: () => Date.now(),
  timeoutMs: externalFetchTimeoutMs(),
  maxResponseBytes: Math.min(externalResponseMaxBytes(), 32_768),
});
const admin = createClient(supabaseUrl, readSupabaseSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = createAppleAccountEventDatabase(admin);

const handler = createAppleAccountEventHttpHandler({
  maxBodyBytes,
  verify,
  persist: (compactJws, claims) =>
    persistVerifiedAppleAccountEvent({
      compactJws,
      claims,
      secrets,
      database,
    }),
  onUnavailable() {
    console.warn('APPLE_ACCOUNT_EVENT_UNAVAILABLE');
  },
});

Deno.serve((request) => stagingTrafficFreezeResponse() ?? handler(request));
