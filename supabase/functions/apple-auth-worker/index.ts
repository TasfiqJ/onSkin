import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { intEnv } from '../_shared/body.ts';
import {
  externalFetchTimeoutMs,
  externalResponseMaxBytes,
  fetchWithTimeout,
} from '../_shared/fetch.ts';
import { loadAppleLifecycleSecrets } from '../_shared/appleLifecycleSecrets.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { loadAppleVaultKeyring } from '../_shared/appleVault.ts';
import { createAppleDeletionNetwork } from '../account-deletion/appleDeletionNetwork.ts';
import { requireAppleRevocationConfiguration } from '../account-deletion/providerDeletion.ts';
import { runAppleAuthWorker } from './core.ts';
import { createAppleAuthWorkerDatabase } from './database.ts';
import { createAppleAuthWorkerHttpHandler } from './httpHandler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const workerSecret = Deno.env.get('APPLE_AUTH_WORKER_SECRET') ?? '';
const claimLimit = intEnv('APPLE_AUTH_WORKER_CLAIM_LIMIT', 25, 1, 25);
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
    // Keep a full 25-claim run inside the hosted function budget even when a
    // broader Edge timeout is configured for unrelated provider requests.
    timeoutMs: Math.min(externalFetchTimeoutMs(), 5_000),
    maxResponseBytes: Math.min(externalResponseMaxBytes(), 32_768),
  }),
]);
const admin = createClient(supabaseUrl, readSupabaseSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const database = createAppleAuthWorkerDatabase(admin);

const handler = createAppleAuthWorkerHttpHandler({
  workerSecret,
  runWorker: async () => {
    const claimToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    return await runAppleAuthWorker({
      claimToken,
      limit: claimLimit,
      secrets,
      vault,
      network,
      database,
      loadUser: async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        return error ? null : data.user;
      },
    });
  },
});

Deno.serve((request) => stagingTrafficFreezeResponse() ?? handler(request));
