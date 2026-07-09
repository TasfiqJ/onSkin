import { createClient } from 'jsr:@supabase/supabase-js@2';
import { booleanEnv, readEdgeAppEnvironment } from '../_shared/env.ts';
import { fetchWithTimeout, readLimitedResponseJson } from '../_shared/fetch.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appEnvironment = readEdgeAppEnvironment();
const turnstileSecret =
  Deno.env.get('TURNSTILE_SECRET_KEY') ?? Deno.env.get('CF_TURNSTILE_SECRET_KEY') ?? '';
const publicFormsRateLimitMax = intEnv('PUBLIC_FORMS_RATE_LIMIT_MAX', 20, 1, 1000);
const publicFormsRateLimitWindowSeconds = intEnv(
  'PUBLIC_FORMS_RATE_LIMIT_WINDOW_SECONDS',
  900,
  60,
  86400,
);
const publicFormsMaxBytes = intEnv('PUBLIC_FORMS_MAX_BYTES', 8192, 1024, 65536);
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let rateLimitHmacKey: CryptoKey | null = null;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, cf-turnstile-response, x-turnstile-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedEvents = new Set([
  'landing_viewed',
  'store_click',
  'install',
  'onboarding_started',
  'first_product_added',
  'first_reviewed_insight_viewed',
  'trial_started',
  'paid_started',
]);

const allowedKeys = new Set([
  'event',
  'source',
  'medium',
  'campaign',
  'content',
  'term',
  'creative_variant',
  'landing_variant',
  'platform',
  'app_version',
  'build_number',
  'store',
  'share_id',
]);

const sensitive =
  /(barcode|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|age|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|token|jwt|secret|signed_url)/i;
const opaqueId = /^[A-Za-z0-9_-]{8,64}$/;
const attributionValue = /^[A-Za-z0-9._~-]{1,120}$/;

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function contentLengthTooLarge(req: Request): boolean {
  const contentLength = Number(req.headers.get('content-length'));
  return Number.isFinite(contentLength) && contentLength > publicFormsMaxBytes;
}

async function readLimitedText(req: Request): Promise<string | null> {
  if (contentLengthTooLarge(req)) return null;
  if (!req.body) return '';

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > publicFormsMaxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The request is already rejected; reader cancellation is best effort.
      }
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('@') || /\s/.test(trimmed)) return null;
  if (!attributionValue.test(trimmed)) return null;
  if (sensitive.test(trimmed)) return null;
  return trimmed;
}

function sanitize(input: Record<string, unknown>): Record<string, string> | null {
  const event = safeValue(input.event);
  if (!event || !allowedEvents.has(event)) return null;
  const out: Record<string, string> = { event };
  for (const [key, value] of Object.entries(input)) {
    if (key === 'event') continue;
    if (!allowedKeys.has(key) || sensitive.test(key)) continue;
    const safe = safeValue(value);
    if (key === 'share_id' && safe && !opaqueId.test(safe)) continue;
    if (safe) out[key] = safe;
  }
  return out;
}

async function body(req: Request): Promise<Record<string, unknown> | Response> {
  const contentType = req.headers.get('content-type') ?? '';
  const raw = await readLimitedText(req);
  if (raw === null) return new Response('payload too large', { status: 413, headers: cors });
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    const parsed = JSON.parse(raw || '{}') as unknown;
    return isRecord(parsed) ? parsed : new Response('bad json', { status: 400, headers: cors });
  }
  if (contentType.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw).entries());
  return new Response('unsupported media type', { status: 415, headers: cors });
}

function turnstileRequired(): boolean {
  return (
    appEnvironment === 'production' ||
    booleanEnv('PUBLIC_FORMS_TURNSTILE_REQUIRED', { invalidValue: true })
  );
}

function clientAddress(req: Request): string {
  const cloudflareIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwardedIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedIp) return forwardedIp;
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
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

async function enforceRateLimit(req: Request, scope: string): Promise<Response | null> {
  const userAgent = (req.headers.get('user-agent') ?? 'unknown').slice(0, 200);
  const keyHash = await hmacSha256Hex(`${scope}|${clientAddress(req)}|${userAgent}`);
  const { data, error } = await supabase.rpc('consume_edge_rate_limit', {
    p_scope: scope,
    p_key_hash: keyHash,
    p_limit: publicFormsRateLimitMax,
    p_window_seconds: publicFormsRateLimitWindowSeconds,
  });

  if (error) {
    console.warn('EDGE_RATE_LIMIT_FAILED');
    return new Response('rate limit unavailable', { status: 503, headers: cors });
  }
  if (data !== true) {
    return new Response('rate limited', {
      status: 429,
      headers: { ...cors, 'Retry-After': String(publicFormsRateLimitWindowSeconds) },
    });
  }
  return null;
}

function turnstileToken(req: Request, input: Record<string, unknown>): string {
  const bodyToken =
    typeof input.turnstileToken === 'string'
      ? input.turnstileToken
      : typeof input['cf-turnstile-response'] === 'string'
        ? input['cf-turnstile-response']
        : '';
  return req.headers.get('cf-turnstile-response') ?? req.headers.get('x-turnstile-token') ?? bodyToken;
}

async function verifyTurnstile(req: Request, input: Record<string, unknown>): Promise<Response | null> {
  if (!turnstileRequired()) return null;
  if (!turnstileSecret) return new Response('turnstile not configured', { status: 503, headers: cors });

  const token = turnstileToken(req, input);
  if (!token) return new Response('turnstile required', { status: 403, headers: cors });

  const body = new URLSearchParams({ secret: turnstileSecret, response: token });
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for');
  if (ip) body.set('remoteip', ip.split(',')[0]!.trim());

  const response = await fetchWithTimeout('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).catch(() => null);
  if (!response?.ok) return new Response('turnstile failed', { status: 403, headers: cors });
  const result = (await readLimitedResponseJson<{ success?: boolean }>(response)) ?? {};
  return result.success ? null : new Response('turnstile failed', { status: 403, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });
  if (contentLengthTooLarge(req)) return new Response('payload too large', { status: 413, headers: cors });

  const rateLimitError = await enforceRateLimit(req, 'growth-event');
  if (rateLimitError) return rateLimitError;

  let parsed: Record<string, unknown>;
  try {
    const parsedBody = await body(req);
    if (parsedBody instanceof Response) return parsedBody;
    parsed = parsedBody;
  } catch {
    return new Response('bad json', { status: 400, headers: cors });
  }

  const turnstileError = await verifyTurnstile(req, parsed);
  if (turnstileError) return turnstileError;

  const payload = sanitize(parsed);
  if (!payload) return new Response('invalid event', { status: 400, headers: cors });

  const { error } = await supabase.from('growth_events').insert(payload);
  if (error) return new Response('insert failed', { status: 500, headers: cors });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
