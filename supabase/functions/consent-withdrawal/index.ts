// Granular consent withdrawal for privacy-rights flows. Deploy with JWT
// verification enabled: `supabase functions deploy consent-withdrawal`.
//
// The caller's JWT proves whose data can be touched. The service role is used
// only after that proof to append the revocation ledger row and perform the
// promised cleanup for prior cloud/shared data.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerAuthorizationHeader, bearerToken } from '../_shared/auth.ts';
import {
  contentLengthTooLarge,
  readLimitedJson,
  userEdgeBodyMaxBytes,
} from '../_shared/body.ts';
import { readEdgeAppEnvironment } from '../_shared/env.ts';
import { readSupabasePublishableKey } from '../_shared/supabasePublishableKey.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { verifiedAuthSessionClaimsFromJwt } from '../_shared/verifiedAuthSessionClaims.ts';
import {
  assertBaseHealthGrantCopyEnvironment,
  CONSENT_GRANT_COPY_PRODUCTION_ERROR,
  parseGranularWithdrawalRequest,
  runGranularWithdrawalLifecycle,
} from './granularWithdrawalCore.ts';
import { runAuthenticatedHealthDependentCleanup } from './dependentCleanupRuntime.ts';
import {
  type HealthLifecycleDependencies,
  parseHealthLifecycleRequest,
  runHealthLifecycle,
} from './healthLifecycleCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = readSupabasePublishableKey();
const serviceKey = readSupabaseSecretKey();
const maxBodyBytes = userEdgeBodyMaxBytes();
const appEnvironment = readEdgeAppEnvironment();
let ownerClaimHmacKey: CryptoKey | null = null;

// Supabase's ungenerated Edge client deliberately has no table schema generic.
// deno-lint-ignore no-explicit-any
type EdgeSupabaseClient = any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function ownerClaimToken(
  userId: string,
  operationId: string,
): Promise<string> {
  const encoder = new TextEncoder();
  ownerClaimHmacKey ??= await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    ownerClaimHmacKey,
    encoder.encode(`health-owner-claim-v1|${userId}|${operationId}`),
  );
  return Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) {
    return json({ error: 'payload_too_large' }, 413);
  }

  const token = bearerToken(req);
  const authorization = bearerAuthorizationHeader(req);
  if (!token || !authorization) return json({ error: 'UNAUTHORIZED' }, 401);
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (userErr || !userId || !verifiedAuthSessionClaimsFromJwt(token, userId)) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const parsed = await readLimitedJson(req, maxBodyBytes, json, {
    error: 'BAD_JSON',
  });
  if (parsed instanceof Response) return parsed;

  const healthRequest = parseHealthLifecycleRequest(parsed);
  const granularRequest = healthRequest
    ? null
    : parseGranularWithdrawalRequest(parsed);
  if (!healthRequest && !granularRequest) {
    return json({ error: 'INVALID_BODY' }, 400);
  }
  if (healthRequest?.action === 'reconsent') {
    try {
      assertBaseHealthGrantCopyEnvironment(appEnvironment);
    } catch {
      return json({ error: CONSENT_GRANT_COPY_PRODUCTION_ERROR }, 503);
    }
  }

  try {
    if (healthRequest) {
      const operationClaims = new Map<string, Promise<string | null>>();
      const claimOperation = (operationId: string): Promise<string | null> => {
        const existing = operationClaims.get(operationId);
        if (existing) return existing;
        const claimed = (async () => {
          const claimToken = await ownerClaimToken(userId, operationId);
          // Audited RPC contract: 'claim_health_consent_withdrawal_for_owner'.
          const { data, error } = await admin.rpc(
            'claim_health_consent_withdrawal_for_owner',
            {
              p_user_id: userId,
              p_operation_id: operationId,
              p_claim_token: claimToken,
            },
          );
          const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
          if (
            error ||
            !isObject(row) ||
            row.operation_id !== operationId ||
            row.user_id !== userId ||
            !Number.isSafeInteger(row.epoch) ||
            (row.epoch as number) < 1
          ) {
            return null;
          }
          return claimToken;
        })();
        operationClaims.set(operationId, claimed);
        return claimed;
      };
      const dependencies: HealthLifecycleDependencies = {
        authenticatedUserId: userId,
        begin: (request) =>
          caller.rpc('begin_health_data_consent_withdrawal', {
            p_expected_epoch: request.expectedProcessingEpoch,
            p_idempotency_key: request.idempotencyKey,
            p_version: request.version,
            p_consent_text_hash: request.consentTextHash,
          }),
        readStatus: () => caller.rpc('get_health_data_consent_status'),
        prepare: async (operationId) => {
          const claimToken = await claimOperation(operationId);
          return claimToken
            ? admin.rpc('prepare_health_data_consent_withdrawal', {
              p_operation_id: operationId,
              p_claim_token: claimToken,
            })
            : { data: null, error: 'HEALTH_WITHDRAWAL_CLAIM_UNAVAILABLE' };
        },
        listStorage: async (operationId, limit) => {
          const claimToken = await claimOperation(operationId);
          return claimToken
            ? admin.rpc('list_health_consent_storage_work', {
              p_operation_id: operationId,
              p_limit: limit,
              p_claim_token: claimToken,
            })
            : { data: null, error: 'HEALTH_WITHDRAWAL_CLAIM_UNAVAILABLE' };
        },
        removeStorage: (paths) => admin.storage.from('photos').remove(paths),
        complete: async (operationId) => {
          const claimToken = await claimOperation(operationId);
          return claimToken
            ? admin.rpc('complete_health_data_consent_withdrawal', {
              p_operation_id: operationId,
              p_claim_token: claimToken,
            })
            : { data: null, error: 'HEALTH_WITHDRAWAL_CLAIM_UNAVAILABLE' };
        },
        reconsent: (request) =>
          caller.rpc('grant_health_data_consent', {
            p_expected_epoch: request.expectedProcessingEpoch,
            p_version: request.version,
            p_consent_text_hash: request.consentTextHash,
          }),
        decline: (request) =>
          caller.rpc('decline_initial_health_data_consent', {
            p_expected_epoch: request.expectedProcessingEpoch,
            p_version: request.version,
            p_consent_text_hash: request.consentTextHash,
          }),
      };
      const result = await runHealthLifecycle(healthRequest, dependencies);
      return json(result.body, result.status);
    }

    const result = await runGranularWithdrawalLifecycle(granularRequest!, {
      authenticatedUserId: userId,
      begin: (request) =>
        caller.rpc('begin_health_dependent_consent_withdrawal', {
          p_expected_epoch: request.expectedProcessingEpoch,
          p_expected_generation: request.expectedConsentGeneration,
          p_consent_type: request.consentType,
          p_idempotency_key: request.idempotencyKey,
          p_version: request.version,
          p_consent_text_hash: request.consentTextHash,
        }),
      cleanup: (operation) =>
        runAuthenticatedHealthDependentCleanup(admin, operation),
      complete: (operationId) =>
        admin.rpc('complete_health_dependent_consent_withdrawal', {
          p_operation_id: operationId,
        }),
    });
    return json(result.body, result.status);
  } catch {
    console.error('[consent-withdrawal]', 'CONSENT_WITHDRAWAL_FAILED');
    return json({ withdrawn: false, error: 'CONSENT_WITHDRAWAL_FAILED' }, 500);
  }
});
