// User correction reports. Users can report wrong/missing product data without
// writing global catalog tables.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey =
  Deno.env.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const maxBodyBytes = userEdgeBodyMaxBytes();

const correctionTypes = new Set([
  'wrong_match',
  'missing_product',
  'ingredient_issue',
  'duplicate',
  'source_issue',
  'expiry_issue',
  'category_issue',
]);
const allowedTopLevelKeys = new Set([
  'correctionType',
  'productId',
  'barcode',
  'description',
  'proposedPayload',
  'clientContext',
]);
const allowedPayloadKeys = new Set([
  'productName',
  'brand',
  'barcode',
  'category',
  'ingredientsText',
  'sourceUrl',
  'sourceName',
  'defaultPaoMonths',
  'qualityIssue',
  'suggestedCorrection',
]);
const allowedContextKeys = new Set(['addedVia', 'quality', 'source', 'platform', 'appVersion', 'buildNumber', 'route']);
const sensitiveText =
  /(access[_-]?token|refresh[_-]?token|authorization|bearer|jwt|signed[_-]?url|localuri|local_uri|file:|[a-z]:\\|\/data\/|\/var\/mobile\/|photo|image|email|phone|address|user[_-]?id|app[_-]?user[_-]?id|pregnan|diagnos|medical|medication|prescription|allerg|free[_-]?text|message|ask prompt)/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeBarcode(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function assertAllowedKeys(input: Record<string, unknown>, allowed: Set<string>, code: string): Response | null {
  const unexpected = Object.keys(input).find((key) => !allowed.has(key));
  return unexpected ? json({ error: code }, 400) : null;
}

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > maxLength || sensitiveText.test(trimmed)) return null;
  return trimmed;
}

function safeUrl(value: unknown): string | null {
  const raw = safeString(value, 300);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const normalized = `${url.origin}${url.pathname}`;
    return normalized.length <= 300 && !sensitiveText.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function safeScalar(value: unknown, maxStringLength = 200): string | number | boolean | null {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return safeString(value, maxStringLength);
}

function sanitizeObject(
  value: unknown,
  allowed: Set<string>,
  code: string,
): { value: Record<string, string | number | boolean | null>; error: Response | null } {
  if (value === undefined || value === null) return { value: {}, error: null };
  if (!isPlainObject(value)) return { value: {}, error: json({ error: code }, 400) };

  const unexpected = assertAllowedKeys(value, allowed, code);
  if (unexpected) return { value: {}, error: unexpected };

  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    const maxLength = key === 'ingredientsText' ? 1500 : key === 'sourceUrl' ? 300 : 200;
    const safe = key === 'sourceUrl' ? safeUrl(raw) : safeScalar(raw, maxLength);
    if (safe !== null || raw === null) out[key] = safe;
  }
  if (JSON.stringify(out).length > 3000) return { value: {}, error: json({ error: code }, 400) };
  return { value: out, error: null };
}

async function requestBody(req: Request): Promise<Record<string, unknown> | Response> {
  const body = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (body instanceof Response) return body;
  if (!isPlainObject(body)) return json({ error: 'bad_json' }, 400);
  return assertAllowedKeys(body, allowedTopLevelKeys, 'unexpected_field') ?? body;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const parsed = await requestBody(req);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const correctionType = String(body.correctionType ?? '');
  if (!correctionTypes.has(correctionType)) return json({ error: 'invalid_correction_type' }, 400);
  const productId = typeof body.productId === 'string' && UUID_RE.test(body.productId) ? body.productId : null;
  const description = safeString(body.description, 500);
  const proposedPayload = sanitizeObject(body.proposedPayload, allowedPayloadKeys, 'invalid_proposed_payload');
  if (proposedPayload.error) return proposedPayload.error;
  const clientContext = sanitizeObject(body.clientContext, allowedContextKeys, 'invalid_client_context');
  if (clientContext.error) return clientContext.error;

  const { data: correction, error } = await caller
    .from('catalog_corrections')
    .insert({
      user_id: userId,
      product_id: productId,
      barcode: normalizeBarcode(body.barcode),
      correction_type: correctionType,
      description,
      proposed_payload: proposedPayload.value,
      client_context: clientContext.value,
    })
    .select('id, status, created_at')
    .single();
  if (error) return json({ error: 'report_failed' }, 500);

  if (Deno.env.get('OBF_CONTRIBUTION_ENABLED') === 'true' && correctionType === 'missing_product') {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from('obf_contribution_queue').insert({
      correction_id: correction.id,
      user_id: userId,
      barcode: normalizeBarcode(body.barcode),
      payload: proposedPayload.value,
      status: 'held',
      hold_reason: 'awaiting_source_review_and_moderation',
    });
  }

  return json({ result: 'reported', correction });
});
