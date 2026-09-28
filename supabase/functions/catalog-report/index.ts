// User correction reports. Users can report wrong/missing product data without
// writing global catalog tables.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { type AccountAccessSnapshot, preflightAccountAccess } from '../_shared/accountAccess.ts';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import {
  HEALTH_PROCESSING_EPOCH_HEADER,
  healthProcessingCallerHeaders,
  preflightActiveHealthProcessing,
  readHealthProcessingEpochHeader,
} from '../_shared/healthProcessingEpoch.ts';
import { readSupabasePublishableKey } from '../_shared/supabasePublishableKey.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import {
  allowedContextKeys,
  allowedPayloadKeys,
  allowedTopLevelKeys,
  catalogReportIdentityError,
  correctionTypes,
  isPlainObject,
  normalizeBarcode,
  normalizeProductId,
  normalizeReportRequestId,
  safeString,
  sanitizeObject,
  validateAllowedKeys,
} from './privacy.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = readSupabasePublishableKey();
const serviceKey = readSupabaseSecretKey();
const maxBodyBytes = userEdgeBodyMaxBytes();
const catalogReportRetryAfterSeconds = 15 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-health-processing-epoch',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

type HealthProcessingPreflightClient = Parameters<typeof preflightActiveHealthProcessing>[0];
type AccountAccessPreflightClient = Parameters<typeof preflightAccountAccess>[0];

async function requireActiveHealthProcessing(
  caller: HealthProcessingPreflightClient,
  userId: string,
  epoch: string,
): Promise<Response | null> {
  const result = await preflightActiveHealthProcessing(caller, userId, epoch);
  return result.ok ? null : json({ error: result.error }, result.status);
}

async function requireSameAccountAccess(
  caller: AccountAccessPreflightClient,
  userId: string,
  snapshot: AccountAccessSnapshot,
): Promise<Response | null> {
  const result = await preflightAccountAccess(caller, userId, snapshot);
  return result.ok ? null : json({ error: result.error }, result.status);
}

/**
 * Contribution-back is intentionally disabled even when the legacy feature
 * flag is true. The existing service-role enqueue RPC does not accept an
 * expected health epoch or assert active consent inside its transaction.
 * Re-enable only after that atomic database guard exists.
 */
function noteSuppressedObfContributionRequest(correctionType: string): void {
  if (Deno.env.get('OBF_CONTRIBUTION_ENABLED') === 'true' && correctionType === 'missing_product') {
    console.warn('[catalog-report]', 'obf_contribution_enqueue_disabled_health_guard_required');
  }
}

function assertAllowedKeys(
  input: Record<string, unknown>,
  allowed: Set<string>,
  code: string,
): Response | null {
  return validateAllowedKeys(input, allowed) ? null : json({ error: code }, 400);
}

async function requestBody(req: Request): Promise<Record<string, unknown> | Response> {
  const body = await readLimitedJson(req, maxBodyBytes, json, {
    error: 'bad_json',
  });
  if (body instanceof Response) return body;
  if (!isPlainObject(body)) return json({ error: 'bad_json' }, 400);
  return assertAllowedKeys(body, allowedTopLevelKeys, 'unexpected_field') ?? body;
}

function hasExactDatabaseError(error: unknown, message: string): boolean {
  return isPlainObject(error) && error.message === message;
}

type CorrectionResult = {
  id: string;
  status: 'open' | 'triaged' | 'accepted' | 'rejected' | 'closed';
  created_at: string;
  created: boolean;
};

const correctionStatuses = new Set<CorrectionResult['status']>([
  'open',
  'triaged',
  'accepted',
  'rejected',
  'closed',
]);

function correctionResult(data: unknown): CorrectionResult | null {
  if (!Array.isArray(data) || data.length !== 1 || !isPlainObject(data[0])) return null;
  const row = data[0];
  if (
    typeof row.id !== 'string' ||
    !normalizeProductId(row.id) ||
    !correctionStatuses.has(row.status as CorrectionResult['status']) ||
    typeof row.created_at !== 'string' ||
    !row.created_at ||
    typeof row.created !== 'boolean'
  ) {
    return null;
  }
  return {
    id: row.id,
    status: row.status as CorrectionResult['status'],
    created_at: row.created_at,
    created: row.created,
  };
}

Deno.serve(async (req) => {
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) {
    return json({ error: 'payload_too_large' }, 413);
  }

  const authHeader = bearerAuthorizationHeader(req);
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const healthProcessingEpoch = readHealthProcessingEpochHeader(req.headers);
  const caller = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: healthProcessingEpoch
        ? healthProcessingCallerHeaders(authHeader, healthProcessingEpoch)
        : { Authorization: authHeader },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);
  if (!healthProcessingEpoch) {
    return json({ error: 'HEALTH_PROCESSING_EPOCH_REQUIRED' }, 409);
  }

  const initialAccountAccess = await preflightAccountAccess(caller, userId);
  if (!initialAccountAccess.ok) {
    return json({ error: initialAccountAccess.error }, initialAccountAccess.status);
  }

  const initialHealthError = await requireActiveHealthProcessing(
    caller,
    userId,
    healthProcessingEpoch,
  );
  if (initialHealthError) return initialHealthError;

  const parsed = await requestBody(req);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const correctionType = String(body.correctionType ?? '');
  if (!correctionTypes.has(correctionType)) {
    return json({ error: 'invalid_correction_type' }, 400);
  }
  const reportRequestId = normalizeReportRequestId(body.reportRequestId);
  if (!reportRequestId) return json({ error: 'invalid_report_request_id' }, 400);
  const productId = normalizeProductId(body.productId);
  if (body.productId !== undefined && body.productId !== null && !productId) {
    return json({ error: 'invalid_product_id' }, 400);
  }
  const barcode = normalizeBarcode(body.barcode);
  if (body.barcode !== undefined && body.barcode !== null && !barcode) {
    return json({ error: 'invalid_barcode' }, 400);
  }
  const description = safeString(body.description, 500);
  const proposedPayload = sanitizeObject(
    body.proposedPayload,
    allowedPayloadKeys,
    'invalid_proposed_payload',
  );
  if (proposedPayload.errorCode) {
    return json({ error: proposedPayload.errorCode }, 400);
  }
  const clientContext = sanitizeObject(
    body.clientContext,
    allowedContextKeys,
    'invalid_client_context',
  );
  if (clientContext.errorCode) {
    return json({ error: clientContext.errorCode }, 400);
  }
  const identityError = catalogReportIdentityError({
    correctionType,
    productId,
    barcode,
    productName: proposedPayload.value.productName,
  });
  if (identityError) return json({ error: identityError }, 400);

  const persistHealthError = await requireActiveHealthProcessing(
    caller,
    userId,
    healthProcessingEpoch,
  );
  if (persistHealthError) return persistHealthError;
  const persistAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (persistAccountError) return persistAccountError;

  // Only the service-only RPC can create a serving hold. It fixes workflow
  // fields server-side and atomically rechecks account state plus this epoch;
  // its trigger receives the same exact epoch as defense in depth.
  const admin = createClient(supabaseUrl, serviceKey, {
    global: {
      headers: { [HEALTH_PROCESSING_EPOCH_HEADER]: healthProcessingEpoch },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('submit_catalog_correction', {
    p_user_id: userId,
    p_expected_health_epoch: healthProcessingEpoch,
    p_report_request_id: reportRequestId,
    p_product_id: productId,
    p_barcode: barcode,
    p_correction_type: correctionType,
    p_description: description,
    p_proposed_payload: proposedPayload.value,
    p_client_context: clientContext.value,
  });
  if (error) {
    const withdrawalError = await requireActiveHealthProcessing(
      caller,
      userId,
      healthProcessingEpoch,
    );
    if (withdrawalError) return withdrawalError;
    const accountError = await requireSameAccountAccess(
      caller,
      userId,
      initialAccountAccess.snapshot,
    );
    if (accountError) return accountError;
    if (hasExactDatabaseError(error, 'CATALOG_REPORT_RATE_LIMITED')) {
      return json({ error: 'rate_limited' }, 429, {
        'Retry-After': String(catalogReportRetryAfterSeconds),
      });
    }
    if (hasExactDatabaseError(error, 'CATALOG_REPORT_IDEMPOTENCY_CONFLICT')) {
      return json({ error: 'report_request_conflict' }, 422);
    }
    if (hasExactDatabaseError(error, 'HEALTH_PROCESSING_BUSY')) {
      return json({ error: 'report_busy' }, 423, { 'Retry-After': '1' });
    }
    if (
      hasExactDatabaseError(error, 'CATALOG_REPORT_INPUT_INVALID') ||
      hasExactDatabaseError(error, 'CATALOG_REPORT_PRODUCT_INVALID')
    ) {
      return json({ error: 'invalid_report' }, 400);
    }
    return json({ error: 'report_failed' }, 500);
  }

  const correction = correctionResult(data);
  if (!correction) return json({ error: 'report_failed' }, 500);

  noteSuppressedObfContributionRequest(correctionType);

  const responseHealthError = await requireActiveHealthProcessing(
    caller,
    userId,
    healthProcessingEpoch,
  );
  if (responseHealthError) return responseHealthError;
  const responseAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (responseAccountError) return responseAccountError;

  return json({ result: correction.created ? 'reported' : 'already_received', correction });
});
