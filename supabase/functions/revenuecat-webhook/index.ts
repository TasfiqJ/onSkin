// RevenueCat webhook -> entitlements mirror.
// Deploy: `supabase functions deploy revenuecat-webhook --no-verify-jwt`
//
// Correctness rules:
//   * Verify the raw body before JSON parsing when HMAC signing is enabled.
//   * Use event.app_user_id / original_app_user_id / aliases for user resolution.
//   * Idempotency key = event.id; RevenueCat delivery is at-least-once.
//   * Cancellation stops renewal but keeps access until expiration.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildRevenueCatAtomicArgs,
  persistRevenueCatEvent,
  type RevenueCatAtomicArgs,
  type RevenueCatEvent,
} from './webhookCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const signingSecret = Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET') ?? '';
const signatureToleranceSeconds = intEnv(
  'REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS',
  300,
  1,
  3600,
);
const maxBodyBytes = intEnv('REVENUECAT_WEBHOOK_MAX_BYTES', 65536, 1024, 262144);

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(Deno.env.get(name));
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function json(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
    },
  });
}

async function readLimitedText(
  req: Request,
  maxBytes: number,
): Promise<{ ok: true; body: string } | { ok: false }> {
  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false };
  }
  if (!req.body) return { ok: true, body: '' };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancellation failures after the request is already too large.
      }
      return { ok: false };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body: new TextDecoder().decode(bytes) };
}

function parseSignature(header: string | null): { timestamp: string; signature: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, value] = part.trim().split('=');
      return [key, value];
    }),
  );
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function constantTimeEqualString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

async function verifySignature(
  req: Request,
  rawBody: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!signingSecret) return { ok: false, reason: 'not_configured' };
  const parsed = parseSignature(req.headers.get('X-RevenueCat-Webhook-Signature'));
  if (!parsed) return { ok: false, reason: 'missing_signature' };

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'bad_timestamp' };
  }
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (signatureToleranceSeconds > 0 && age > signatureToleranceSeconds) {
    return { ok: false, reason: 'stale_signature' };
  }

  const expected = await hmacHex(signingSecret, `${parsed.timestamp}.${rawBody}`);
  return constantTimeEqualHex(expected, parsed.signature)
    ? { ok: true, reason: 'verified' }
    : { ok: false, reason: 'mismatch' };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json('method not allowed', 405);

  if (!webhookAuth && !signingSecret) {
    return json('webhook verification not configured', 503);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const authVerified = webhookAuth ? constantTimeEqualString(authHeader, webhookAuth) : false;
  if (webhookAuth && !authVerified) return json('unauthorized', 401);

  const limitedBody = await readLimitedText(req, maxBodyBytes);
  if (!limitedBody.ok) return json('payload too large', 413);
  const rawBody = limitedBody.body;

  const signature = await verifySignature(req, rawBody);
  if (signingSecret && !signature.ok) {
    console.warn('REVENUECAT_WEBHOOK_BAD_SIGNATURE');
    return json('bad signature', 401);
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return json('bad request', 400);
  }
  const event = body?.event as RevenueCatEvent | undefined;
  if (!event) {
    return json('bad request', 400);
  }

  let atomicArgs: RevenueCatAtomicArgs;
  try {
    atomicArgs = buildRevenueCatAtomicArgs(event, {
      signatureVerified: signature.ok,
      authVerified,
    });
  } catch {
    return json('bad request', 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  try {
    const result = await persistRevenueCatEvent(supabase, atomicArgs);
    if (result.outcome === 'duplicate') return json('ok (duplicate)', 200);
  } catch {
    console.warn('REVENUECAT_WEBHOOK_ATOMIC_PROCESSING_FAILED');
    return json('processing failed', 503);
  }

  return json('ok', 200);
});
