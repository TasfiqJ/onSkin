// Local catalog search only. Do not proxy Open Beauty Facts search-as-you-type.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { type AccountAccessSnapshot, preflightAccountAccess } from '../_shared/accountAccess.ts';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import {
  healthProcessingCallerHeaders,
  preflightActiveHealthProcessing,
  readHealthProcessingEpochHeader,
} from '../_shared/healthProcessingEpoch.ts';
import { readSupabasePublishableKey } from '../_shared/supabasePublishableKey.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import {
  CATALOG_SEARCH_MIN_QUERY_LENGTH,
  CATALOG_SEARCH_RPC,
  catalogSearchLimit,
  catalogSearchTerm,
  normalizeCatalogSearchQuery,
} from './catalogContract.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = readSupabasePublishableKey();
const serviceKey = readSupabaseSecretKey();
const catalogRateLimitMax = intEnv('CATALOG_RATE_LIMIT_MAX', 120, 1, 1000);
const catalogRateLimitWindowSeconds = intEnv('CATALOG_RATE_LIMIT_WINDOW_SECONDS', 900, 60, 86400);
const maxBodyBytes = userEdgeBodyMaxBytes();
let rateLimitHmacKey: CryptoKey | null = null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-health-processing-epoch',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EdgeRateLimitClient = {
  rpc(
    functionName: 'consume_edge_rate_limit',
    args: Record<string, string | number>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};
type HealthProcessingPreflightClient = Parameters<typeof preflightActiveHealthProcessing>[0];
type AccountAccessPreflightClient = Parameters<typeof preflightAccountAccess>[0];

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

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

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function hmacSha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  rateLimitHmacKey ??= await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', rateLimitHmacKey, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

async function enforceRateLimit(
  admin: EdgeRateLimitClient,
  scope: string,
  userId: string,
): Promise<Response | null> {
  const keyHash = await hmacSha256Hex(`${scope}|${userId}`);
  const { data, error } = await admin.rpc('consume_edge_rate_limit', {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: catalogRateLimitMax,
    p_window_seconds: catalogRateLimitWindowSeconds,
    p_owner_user_id: userId,
  });

  if (error) {
    console.warn('CATALOG_RATE_LIMIT_FAILED');
    return json({ error: 'rate_limit_unavailable' }, 503);
  }
  if (data !== true) {
    return json({ error: 'rate_limited' }, 429, {
      'Retry-After': String(catalogRateLimitWindowSeconds),
    });
  }
  return null;
}

Deno.serve(async (req) => {
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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rateLimitError = await enforceRateLimit(admin, 'catalog-search', userId);
  if (rateLimitError) return rateLimitError;

  const bodyHealthError = await requireActiveHealthProcessing(
    caller,
    userId,
    healthProcessingEpoch,
  );
  if (bodyHealthError) return bodyHealthError;
  const bodyAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (bodyAccountError) return bodyAccountError;

  const parsed = await readLimitedJson(req, maxBodyBytes, json, {
    error: 'bad_json',
  });
  if (parsed instanceof Response) return parsed;
  const body = isRecord(parsed) ? parsed : {};
  const query = normalizeCatalogSearchQuery(body.query);
  const searchTerm = catalogSearchTerm(query);
  const limit = catalogSearchLimit(body.limit);
  if (searchTerm.length < CATALOG_SEARCH_MIN_QUERY_LENGTH) {
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
    return json({ result: 'too_short', products: [] });
  }

  const searchHealthError = await requireActiveHealthProcessing(
    caller,
    userId,
    healthProcessingEpoch,
  );
  if (searchHealthError) return searchHealthError;
  const searchAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (searchAccountError) return searchAccountError;

  const { data, error } = await admin.rpc(CATALOG_SEARCH_RPC, {
    p_query: searchTerm,
    p_limit: limit,
  });
  if (error) return json({ error: 'search_failed' }, 500);

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

  // The direct-write trigger atomically rechecks active state and this exact epoch.
  const { error: eventError } = await caller.from('catalog_lookup_events').insert({
    user_id: userId,
    lookup_type: 'search',
    query,
    result: data?.length ? 'matched' : 'no_match',
    matched_product_id: data?.[0]?.id ?? null,
    source_key: data?.[0]?.source ?? null,
    quality_grade: data?.[0]?.quality_grade ?? null,
  });

  if (eventError) {
    const withdrawalError = await requireActiveHealthProcessing(
      caller,
      userId,
      healthProcessingEpoch,
    );
    return withdrawalError ?? json({ error: 'search_failed' }, 500);
  }

  const responseAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (responseAccountError) return responseAccountError;

  return json({
    result: data?.length ? 'matched' : 'no_match',
    products: data ?? [],
  });
});
