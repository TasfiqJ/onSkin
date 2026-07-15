// Authenticated, owner-derived RevenueCat CustomerInfo reconciliation. The
// caller supplies no subject or provider state: this function derives auth,
// fetches a fresh bounded provider response, then invokes the service-only
// snapshot RPC with RevenueCat request_date as the only watermark.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerToken } from '../_shared/auth.ts';
import {
  contentLengthTooLarge,
  intEnv,
  readLimitedJson,
  userEdgeBodyMaxBytes,
} from '../_shared/body.ts';
import { fetchWithTimeout, readLimitedResponseJson } from '../_shared/fetch.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { verifiedAuthSessionClaimsFromJwt } from '../_shared/verifiedAuthSessionClaims.ts';
import {
  RevenueCatSnapshotError,
  buildRevenueCatCustomerInfoRequest,
  parseRevenueCatCustomerInfoSnapshot,
} from './reconciliationCore.ts';
import { PublicationLeaseError, withAccountPublicationLease } from './publicationLease.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = readSupabaseSecretKey();
const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';
const maxBodyBytes = userEdgeBodyMaxBytes();
const maxSnapshotAgeMs =
  intEnv('ENTITLEMENT_RECONCILIATION_MAX_SNAPSHOT_AGE_SECONDS', 120, 15, 300) * 1000;
const rateLimitMax = intEnv('ENTITLEMENT_RECONCILIATION_RATE_LIMIT_MAX', 6, 1, 30);
const rateLimitWindowSeconds = intEnv(
  'ENTITLEMENT_RECONCILIATION_RATE_LIMIT_WINDOW_SECONDS',
  300,
  60,
  3600,
);
let rateLimitHmacKey: CryptoKey | null = null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EdgeSupabaseClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function rateLimitHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  rateLimitHmacKey ??= await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', rateLimitHmacKey, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function enforceRateLimit(
  admin: EdgeSupabaseClient,
  userId: string,
): Promise<Response | null> {
  const keyHash = await rateLimitHash(`subscription-reconciliation|${userId}`);
  const { data, error } = await admin.rpc('consume_edge_rate_limit', {
    p_scope: 'subscription-reconciliation',
    p_key_hash: keyHash,
    p_limit: rateLimitMax,
    p_window_seconds: rateLimitWindowSeconds,
    p_owner_user_id: userId,
  });
  if (error) {
    console.warn('[subscription-reconciliation]', 'rate_limit_unavailable');
    return json({ error: 'reconciliation_unavailable' }, 503);
  }
  if (data !== true) {
    return json({ error: 'rate_limited' }, 429, {
      'Retry-After': String(rateLimitWindowSeconds),
    });
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (parsed instanceof Response) return parsed;
  if (!isRecord(parsed) || Object.keys(parsed).length !== 0) {
    return json({ error: 'unexpected_input' }, 400);
  }

  const token = bearerToken(req);
  if (!token) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) return json({ error: 'unauthorized' }, 401);
  const verifiedSession = verifiedAuthSessionClaimsFromJwt(token, userId);
  if (!verifiedSession) return json({ error: 'unauthorized' }, 401);

  const rateLimitResponse = await enforceRateLimit(admin, userId);
  if (rateLimitResponse) return rateLimitResponse;

  let providerRequest: ReturnType<typeof buildRevenueCatCustomerInfoRequest>;
  try {
    providerRequest = buildRevenueCatCustomerInfoRequest(userId, revenueCatSecretKey);
  } catch {
    console.error('[subscription-reconciliation]', 'provider_not_configured');
    return json({ error: 'reconciliation_unavailable' }, 503);
  }

  try {
    return await withAccountPublicationLease({
      client: admin,
      userId: verifiedSession.subject,
      sessionId: verifiedSession.sessionId,
      operation: async ({ renew }) => {
        // withAccountPublicationLease has renewed the active migration-0052
        // lease immediately before this callback. No RevenueCat get-or-create
        // request exists outside this fenced scope.
        const providerResponse = await fetchWithTimeout(
          providerRequest.url,
          providerRequest.init,
        ).catch(() => null);
        if (!providerResponse) {
          console.warn('[subscription-reconciliation]', 'provider_request_failed');
          return json({ error: 'reconciliation_unavailable' }, 503);
        }
        const providerBody = await readLimitedResponseJson<unknown>(providerResponse);
        if (![200, 201].includes(providerResponse.status) || providerBody === null) {
          console.warn('[subscription-reconciliation]', 'provider_response_rejected');
          return json({ error: 'reconciliation_unavailable' }, 503);
        }

        let snapshot;
        try {
          snapshot = parseRevenueCatCustomerInfoSnapshot(
            providerBody,
            verifiedSession.subject,
            Date.now(),
            maxSnapshotAgeMs,
          );
        } catch (error) {
          const code =
            error instanceof RevenueCatSnapshotError
              ? error.code
              : 'REVENUECAT_CUSTOMER_INFO_INVALID';
          console.warn('[subscription-reconciliation]', code);
          return json({ error: 'reconciliation_unavailable' }, 503);
        }

        // If deletion began, the active lease is now draining and this renew
        // fails before any local projection can be committed. Deletion waits
        // for the capability release/TTL before provider erasure proceeds.
        await renew();
        const { data, error } = await admin.rpc(
          'reconcile_revenuecat_entitlement_snapshot',
          snapshot,
        );
        if (error) {
          const message = typeof error.message === 'string' ? error.message : '';
          if (message.includes('ACCOUNT_DELETION_IN_PROGRESS')) {
            return json({ error: 'account_deletion_in_progress' }, 409);
          }
          if (
            message.includes('REVENUECAT_SNAPSHOT_CONFLICT') ||
            message.includes('REVENUECAT_SNAPSHOT_CURSOR_CONFLICT')
          ) {
            return json({ error: 'entitlement_reconciliation_conflict' }, 409);
          }
          console.error('[subscription-reconciliation]', 'snapshot_write_failed');
          return json({ error: 'reconciliation_failed' }, 500);
        }

        const outcome = typeof data === 'string' ? data : Array.isArray(data) ? data[0] : null;
        if (
          outcome !== 'reconciled_snapshot' &&
          outcome !== 'duplicate_snapshot' &&
          outcome !== 'stale_snapshot'
        ) {
          console.error('[subscription-reconciliation]', 'snapshot_outcome_invalid');
          return json({ error: 'reconciliation_failed' }, 500);
        }
        return json({
          outcome: outcome === 'reconciled_snapshot' ? 'reconciled' : 'already_current',
        });
      },
    });
  } catch (error) {
    if (error instanceof PublicationLeaseError) {
      if (error.code === 'ACCOUNT_DELETION_IN_PROGRESS') {
        return json({ error: 'account_deletion_in_progress' }, 409);
      }
      if (error.code === 'ACCOUNT_PUBLICATION_SESSION_REJECTED') {
        return json({ error: 'unauthorized' }, 401);
      }
      console.warn('[subscription-reconciliation]', error.code);
      return json({ error: 'reconciliation_unavailable' }, 503);
    }
    console.error('[subscription-reconciliation]', 'reconciliation_failed');
    if (String(error).includes('ACCOUNT_DELETION_IN_PROGRESS')) {
      return json({ error: 'account_deletion_in_progress' }, 409);
    }
    return json({ error: 'reconciliation_unavailable' }, 503);
  }
});
