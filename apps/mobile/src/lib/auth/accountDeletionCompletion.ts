import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

import { env, isSupabaseConfigured } from '@/lib/env';
import { runRequest } from '@/lib/network/requestPolicy';
import {
  markAccountDeletionBackendDeletedFromCompletion,
  readAccountDeletionRecoveryCapability,
} from './accountDeletionVendorFreeze';

const COMPLETION_TOKEN = /^[0-9a-f]{64}$/i;
const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createAnonymousCompletionClient() {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: 'onskin-account-deletion-completion-anonymous',
    },
  });
}

let anonymousCompletionClient: ReturnType<typeof createAnonymousCompletionClient> | null = null;

function getAnonymousCompletionClient() {
  anonymousCompletionClient ??= createAnonymousCompletionClient();
  return anonymousCompletionClient;
}

export type AccountDeletionCompletion = Readonly<{
  requestId: string;
  apple: 'revoked' | 'skipped';
  posthog: 'deleted' | 'already_absent' | 'skipped';
}>;

async function hashCompletionToken(token: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `onskin:account-deletion-completion:${token}`,
  );
  if (!/^[0-9a-f]{64}$/i.test(digest)) {
    throw new Error('ACCOUNT_DELETION_COMPLETION_HASH_INVALID');
  }
  return `t_${digest.toLowerCase()}`;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' && !Array.isArray(row)
    ? (row as Record<string, unknown>)
    : null;
}

function parseCompletion(value: unknown): AccountDeletionCompletion | null {
  if (Array.isArray(value) && value.length === 0) return null;
  const row = firstRow(value);
  if (!row) return null;
  if (
    typeof row.request_id !== 'string' ||
    !REQUEST_ID.test(row.request_id) ||
    row.next_step !== 'complete' ||
    (row.apple_result !== 'revoked' && row.apple_result !== 'skipped') ||
    (row.posthog_result !== 'deleted' &&
      row.posthog_result !== 'already_absent' &&
      row.posthog_result !== 'skipped')
  ) {
    throw new Error('ACCOUNT_DELETION_COMPLETION_RESPONSE_INVALID');
  }
  return {
    requestId: row.request_id,
    apple: row.apple_result,
    posthog: row.posthog_result,
  };
}

/**
 * Capability-only, anonymous lookup. The RPC can reveal only a terminal receipt
 * and cannot create, advance, or rebind account deletion.
 */
export async function lookupAccountDeletionCompletion(
  completionToken: string,
  signal?: AbortSignal,
): Promise<AccountDeletionCompletion | null> {
  const normalizedToken = completionToken.trim().toLowerCase();
  if (!COMPLETION_TOKEN.test(normalizedToken)) {
    throw new Error('ACCOUNT_DELETION_COMPLETION_TOKEN_INVALID');
  }
  if (!isSupabaseConfigured) throw new Error('DATA_RIGHTS_BACKEND_UNAVAILABLE');
  const completionTokenHash = await hashCompletionToken(normalizedToken);

  return runRequest(
    {
      endpoint: 'account_deletion',
      deadlineMs: 8_000,
      idempotent: true,
      maxAttempts: 2,
      maxResponseBytes: 64 * 1024,
      ownerScoped: false,
      signal,
    },
    async ({ signal: attemptSignal }) => {
      const request = getAnonymousCompletionClient().rpc('account_deletion_completion_status', {
        p_completion_token_hash: completionTokenHash,
      });
      const { data, error } = await request.abortSignal(attemptSignal);
      if (error) throw error;
      return parseCompletion(data);
    },
  );
}

/**
 * Reconcile a response-lost deletion before AuthProvider publishes a restored
 * session. Network uncertainty preserves the pending receipt and returns false.
 */
export async function reconcileAccountDeletionCompletionReceipt(
  signal?: AbortSignal,
): Promise<boolean> {
  const capability = await readAccountDeletionRecoveryCapability();
  if (!capability) return false;
  if (capability.state === 'backend_deleted') return true;

  let completion: AccountDeletionCompletion | null;
  try {
    completion = await lookupAccountDeletionCompletion(capability.completionToken, signal);
  } catch {
    return false;
  }
  if (!completion) return false;
  await markAccountDeletionBackendDeletedFromCompletion(capability.completionToken);
  return true;
}
