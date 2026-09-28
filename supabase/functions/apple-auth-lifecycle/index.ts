import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { bearerToken } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import {
  externalFetchTimeoutMs,
  externalResponseMaxBytes,
  fetchWithTimeout,
} from '../_shared/fetch.ts';
import { loadAppleLifecycleSecrets } from '../_shared/appleLifecycleSecrets.ts';
import { readSupabasePublishableKey } from '../_shared/supabasePublishableKey.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { verifiedAuthSessionClaimsFromJwt } from '../_shared/verifiedAuthSessionClaims.ts';
import { loadAppleVaultKeyring } from '../_shared/appleVault.ts';
import { createAppleDeletionNetwork } from '../account-deletion/appleDeletionNetwork.ts';
import { requireAppleRevocationConfiguration } from '../account-deletion/providerDeletion.ts';
import {
  AppleAuthLifecycleError,
  captureAppleCredential,
  invalidateAppleCredential,
  parseAppleAuthLifecycleRequest,
} from './core.ts';
import { createAppleAuthLifecycleDatabase } from './database.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const maxBodyBytes = userEdgeBodyMaxBytes();
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

const configuration = requireAppleRevocationConfiguration({
  teamId: Deno.env.get('APPLE_TEAM_ID'),
  keyId: Deno.env.get('APPLE_SIWA_KEY_ID'),
  clientId: Deno.env.get('APPLE_SIWA_CLIENT_ID'),
  nativeBundleId: Deno.env.get('APP_IOS_BUNDLE_IDENTIFIER'),
  privateKey: Deno.env.get('APPLE_SIWA_PRIVATE_KEY'),
});
const [secrets, vault, network] = await Promise.all([
  loadAppleLifecycleSecrets(),
  loadAppleVaultKeyring(),
  createAppleDeletionNetwork({
    config: configuration,
    fetcher: (input, init, timeoutMs) => fetchWithTimeout(input, init, timeoutMs),
    now: () => Date.now(),
    timeoutMs: externalFetchTimeoutMs(),
    maxResponseBytes: Math.min(externalResponseMaxBytes(), 32_768),
  }),
]);
const admin = createClient(supabaseUrl, readSupabaseSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = createAppleAuthLifecycleDatabase(admin);

Deno.serve(async (request) => {
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (contentLengthTooLarge(request, maxBodyBytes)) {
    return json({ error: 'payload_too_large' }, 413);
  }
  const token = bearerToken(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  const caller = createClient(supabaseUrl, readSupabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await caller.auth.getUser();
  const user = data.user;
  if (error || !user) return json({ error: 'unauthorized' }, 401);
  const claims = verifiedAuthSessionClaimsFromJwt(token, user.id);
  if (!claims) return json({ error: 'unauthorized' }, 401);

  const parsed = await readLimitedJson(request, maxBodyBytes, json, {
    error: 'bad_json',
  });
  if (parsed instanceof Response) return parsed;
  const lifecycleRequest = parseAppleAuthLifecycleRequest(parsed);
  if (!lifecycleRequest) return json({ error: 'invalid_request' }, 400);

  try {
    const result =
      lifecycleRequest.action === 'capture'
        ? await captureAppleCredential({
            request: lifecycleRequest,
            user,
            sessionId: claims.sessionId,
            clientId: configuration.clientId,
            secrets,
            vault,
            network,
            database,
          })
        : await invalidateAppleCredential({
            request: lifecycleRequest,
            user,
            sessionId: claims.sessionId,
            database,
          });
    return json(result);
  } catch (failure) {
    if (failure instanceof AppleAuthLifecycleError) {
      return json({ error: failure.code }, failure.status);
    }
    console.warn('APPLE_AUTH_LIFECYCLE_UNAVAILABLE');
    return json({ error: 'APPLE_AUTH_LIFECYCLE_UNAVAILABLE' }, 503);
  }
});
