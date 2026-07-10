// Exact barcode lookup. Bulk import must use export files; this function only
// supports one scan-time lookup at a time.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerAuthorizationHeader } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import { fetchWithTimeout, readLimitedResponseJson } from '../_shared/fetch.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
type OpenBeautyFactsBody = {
  status?: number;
  product?: {
    product_name?: unknown;
    brands?: unknown;
    ingredients_text?: unknown;
    last_modified_t?: unknown;
  };
};

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

function normalizeBarcode(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function externalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
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
  admin: EdgeSupabaseClient,
  scope: string,
  userId: string,
): Promise<Response | null> {
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

async function requestBarcode(req: Request): Promise<string | null | Response> {
  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (parsed instanceof Response) return parsed;
  const body = isRecord(parsed) ? parsed : {};
  return normalizeBarcode(body.barcode);
}

async function fetchOpenBeautyFacts(barcode: string) {
  if (Deno.env.get('OBF_API_ENABLED') !== 'true') return null;
  const userAgent = Deno.env.get('OBF_USER_AGENT') ?? '';
  if (!/^[^/\s]+\/[^\s]+\s+\([^)@]+@[^)@]+\.[^)]+\)$/.test(userAgent)) return null;

  const fields = 'code,product_name,brands,ingredients_text,categories_tags,last_modified_t';
  const res = await fetchWithTimeout(
    `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json?fields=${fields}`,
    {
      headers: { 'User-Agent': userAgent },
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  const body = await readLimitedResponseJson<OpenBeautyFactsBody>(res);
  if (!body) return null;
  if (body.status !== 1 || !body.product) return null;
  const product = body.product;
  return {
    id: null,
    barcode,
    name: externalText(product.product_name, 180) ?? 'Unknown product',
    brand: externalText(product.brands, 180),
    category: null,
    source: 'open_beauty_facts',
    sourceRef: barcode,
    sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`,
    sourceSnapshotDate:
      typeof product.last_modified_t === 'number'
        ? new Date(product.last_modified_t * 1000).toISOString().slice(0, 10)
        : null,
    qualityGrade: 'unverified',
    reviewStatus: 'unreviewed',
    ingredientParseStatus: product.ingredients_text ? 'not_parsed' : 'failed',
    ingredientParseConfidence: 0,
    defaultPaoMonths: null,
    rawIngredientsText: externalText(product.ingredients_text, 4000),
    external: true,
  };
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
  const rateLimitError = await enforceRateLimit(admin, 'catalog-lookup', userId);
  if (rateLimitError) return rateLimitError;

  const barcode = await requestBarcode(req);
  if (barcode instanceof Response) return barcode;
  if (!barcode) return json({ error: 'invalid_barcode' }, 400);

  const { data: barcodeRow, error: barcodeError } = await admin
    .from('product_barcodes')
    .select('barcode, product_id, confidence')
    .eq('barcode', barcode)
    .maybeSingle();
  if (barcodeError) return json({ error: 'lookup_failed' }, 500);

  if (barcodeRow?.product_id) {
    const { data: product, error: productError } = await admin
      .from('products')
      .select(
        'id, name, brand, category, default_pao_months, source, source_ref, source_url, source_snapshot_date, quality_grade, review_status, data_quality_score, ingredient_parse_status, ingredient_parse_confidence, catalog_sources:source_id(display_name, source_key, attribution_text, attribution_url)',
      )
      .eq('id', barcodeRow.product_id)
      .maybeSingle();
    if (productError) return json({ error: 'lookup_failed' }, 500);
    if (product) {
      await caller.from('catalog_lookup_events').insert({
        user_id: userId,
        lookup_type: 'barcode',
        barcode,
        result: 'matched',
        matched_product_id: product.id,
        source_key: product.source,
        quality_grade: product.quality_grade,
      });
      return json({ result: 'matched', product: { ...product, barcode } });
    }
  }

  const external = await fetchOpenBeautyFacts(barcode);
  await caller.from('catalog_lookup_events').insert({
    user_id: userId,
    lookup_type: 'barcode',
    barcode,
    result: external ? 'ambiguous' : 'no_match',
    source_key: external ? 'open_beauty_facts' : null,
    quality_grade: external ? 'unverified' : null,
  });

  if (external) return json({ result: 'external_candidate', product: external });
  return json({ result: 'no_match', manualFallback: true });
});
