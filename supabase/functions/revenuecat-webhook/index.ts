// RevenueCat webhook -> entitlements mirror.
// Deploy: `supabase functions deploy revenuecat-webhook --no-verify-jwt`
//
// Correctness rules:
//   * Verify the raw body before JSON parsing when HMAC signing is enabled.
//   * Use event.app_user_id / original_app_user_id / aliases for user resolution.
//   * Idempotency key = event.id; RevenueCat delivery is at-least-once.
//   * Cancellation stops renewal but keeps access until expiration.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const signingSecret = Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET') ?? '';
const signatureToleranceSeconds = Number(Deno.env.get('REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS') ?? '300');

const GRANT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE']);
const REVOKE_TYPES = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']);
const STOP_RENEW_TYPES = new Set(['CANCELLATION', 'BILLING_ISSUE']);
const RENEWING_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'BILLING_ISSUE']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  store?: string;
  environment?: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number;
  original_purchase_date_ms?: number;
  period_type?: string;
  is_sandbox?: boolean;
  presented_offering_id?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' },
  });
}

function mapStore(s: string | undefined): string | null {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes('APP_STORE') || u.includes('MAC_APP_STORE')) return 'app_store';
  if (u.includes('PLAY')) return 'play_store';
  if (u.includes('TEST_STORE')) return 'test_store';
  if (u.includes('PROMOTIONAL')) return 'app_granted';
  if (u.includes('STRIPE') || u.includes('PADDLE') || u.includes('WEB') || u.includes('RC_BILLING')) return 'web';
  return null;
}

function mapEnvironment(event: RevenueCatEvent): string {
  if (event.store === 'TEST_STORE') return 'test_store';
  if (event.is_sandbox) return 'sandbox';
  const env = event.environment?.toLowerCase();
  if (env === 'production' || env === 'sandbox') return env;
  return 'unknown';
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

async function verifySignature(req: Request, rawBody: string): Promise<{ ok: boolean; reason: string }> {
  if (!signingSecret) return { ok: false, reason: 'not_configured' };
  const parsed = parseSignature(req.headers.get('X-RevenueCat-Webhook-Signature'));
  if (!parsed) return { ok: false, reason: 'missing_signature' };

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'bad_timestamp' };
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (signatureToleranceSeconds > 0 && age > signatureToleranceSeconds) return { ok: false, reason: 'stale_signature' };

  const expected = await hmacHex(signingSecret, `${parsed.timestamp}.${rawBody}`);
  return constantTimeEqualHex(expected, parsed.signature)
    ? { ok: true, reason: 'verified' }
    : { ok: false, reason: 'mismatch' };
}

function userCandidates(event: RevenueCatEvent): string[] {
  return [...new Set([event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(Boolean) as string[])];
}

async function resolveUserId(supabase: ReturnType<typeof createClient>, event: RevenueCatEvent): Promise<string | null> {
  for (const candidate of userCandidates(event)) {
    if (!UUID_RE.test(candidate)) continue;
    const { data } = await supabase.auth.admin.getUserById(candidate);
    if (data.user) return candidate;
  }
  return null;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const authVerified = webhookAuth ? req.headers.get('Authorization') === webhookAuth : null;
  if (webhookAuth && !authVerified) return json('unauthorized', 401);

  const signature = await verifySignature(req, rawBody);
  if (signingSecret && !signature.ok) return json(`bad signature: ${signature.reason}`, 401);

  let body: { event?: RevenueCatEvent };
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return json('bad request', 400);
  }
  const event = body?.event as RevenueCatEvent | undefined;
  if (!event?.id || !event.type) return json('bad request', 400);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: seen } = await supabase
    .from('subscriptions_events')
    .select('id')
    .eq('rc_event_id', event.id)
    .maybeSingle();
  if (seen) return json('ok (duplicate)', 200);

  const resolvedUserId = await resolveUserId(supabase, event);
  const store = mapStore(event.store);
  const environment = mapEnvironment(event);
  const eventBase = {
    rc_event_id: event.id,
    user_id: resolvedUserId,
    event_type: event.type,
    payload: body,
    app_user_id: event.app_user_id ?? null,
    original_app_user_id: event.original_app_user_id ?? null,
    aliases: event.aliases ?? null,
    resolved_user_id: resolvedUserId,
    environment,
    store,
    product_id: event.product_id ?? null,
    signature_verified: signature.ok,
    auth_verified: authVerified,
  };

  const grant = GRANT_TYPES.has(event.type);
  const revoke = REVOKE_TYPES.has(event.type);
  const stopRenew = STOP_RENEW_TYPES.has(event.type);
  const shouldMirror = Boolean(resolvedUserId && (grant || revoke || stopRenew));

  await supabase.from('subscriptions_events').insert({
    ...eventBase,
    processing_status: shouldMirror ? 'processing' : resolvedUserId ? 'ignored_event_type' : 'unresolved_user',
  });

  if (shouldMirror && resolvedUserId) {
    const now = new Date().toISOString();
    const isActive = grant || stopRenew;
    const entitlement = (event.entitlement_ids?.[0] as string | undefined) ?? 'pro';
    const { error } = await supabase.from('entitlements').upsert(
      {
        user_id: resolvedUserId,
        entitlement: entitlement === 'pro_plus' ? 'pro_plus' : 'pro',
        is_active: isActive,
        product_id: event.product_id ?? null,
        expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
        rc_event_id: event.id,
        updated_at: now,
        store,
        period_type: (event.period_type as string | undefined)?.toLowerCase() ?? null,
        will_renew: RENEWING_TYPES.has(event.type),
        original_purchase_at: event.original_purchase_date_ms ? new Date(event.original_purchase_date_ms).toISOString() : null,
        offering_id: event.presented_offering_id ?? null,
        source: 'revenuecat',
        environment,
        verified_at: now,
        store_user_id: event.app_user_id ?? event.original_app_user_id ?? null,
        last_reconciled_at: now,
        raw_status: event,
      },
      { onConflict: 'user_id' },
    );

    await supabase
      .from('subscriptions_events')
      .update({
        processed_at: now,
        processing_status: error ? 'error' : 'processed',
        error: error?.message ?? null,
      })
      .eq('rc_event_id', event.id);
  }

  return json('ok', 200);
});
