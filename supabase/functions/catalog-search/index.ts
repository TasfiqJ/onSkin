// Local catalog search only. Do not proxy Open Beauty Facts search-as-you-type.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const catalogRateLimitMax = intEnv('CATALOG_RATE_LIMIT_MAX', 120, 1, 1000);
const catalogRateLimitWindowSeconds = intEnv('CATALOG_RATE_LIMIT_WINDOW_SECONDS', 900, 60, 86400);
const maxBodyBytes = userEdgeBodyMaxBytes();
let rateLimitHmacKey: CryptoKey | null = null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EdgeSupabaseClient = any;

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function cleanQuery(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
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
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function enforceRateLimit(admin: EdgeSupabaseClient, scope: string, userId: string): Promise<Response | null> {
  const keyHash = await hmacSha256Hex(`${scope}|${userId}`);
  const { data, error } = await admin.rpc('consume_edge_rate_limit', {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: catalogRateLimitMax,
    p_window_seconds: catalogRateLimitWindowSeconds,
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const authHeader = bearerAuthorizationHeader(req);
  if (!authHeader) return json({ error: 'unauthorized' }, 401);
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rateLimitError = await enforceRateLimit(admin, 'catalog-search', userId);
  if (rateLimitError) return rateLimitError;

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (parsed instanceof Response) return parsed;
  const body = isRecord(parsed) ? parsed : {};
  const query = cleanQuery(body.query);
  const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 20);
  if (query.length < 2) return json({ result: 'too_short', products: [] });

  const escaped = query.replace(/[%_,()]/g, ' ');

  const { data, error } = await admin
    .from('products')
    .select(
      'id, barcode, name, brand, category, default_pao_months, source, source_ref, source_url, source_snapshot_date, quality_grade, review_status, data_quality_score, ingredient_parse_status, ingredient_parse_confidence',
    )
    .or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%`)
    .neq('status', 'blocked')
    .order('data_quality_score', { ascending: false })
    .limit(limit);
  if (error) return json({ error: 'search_failed' }, 500);

  await caller.from('catalog_lookup_events').insert({
    user_id: userId,
    lookup_type: 'search',
    query,
    result: data?.length ? 'matched' : 'no_match',
    matched_product_id: data?.[0]?.id ?? null,
    source_key: data?.[0]?.source ?? null,
    quality_grade: data?.[0]?.quality_grade ?? null,
  });

  return json({ result: data?.length ? 'matched' : 'no_match', products: data ?? [] });
});
