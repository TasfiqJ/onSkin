// RevenueCat webhook -> entitlements mirror (docs/01 §3).
// Runs on Supabase Edge (Deno) with the service-role key (bypasses RLS).
// Deploy: `supabase functions deploy revenuecat-webhook --no-verify-jwt`
//
// Key correctness rules from docs/01 §3:
//   * Read event.app_user_id (NOT body.app_user_id) — the common 400 bug.
//   * Idempotent on event.id (RC delivers at-least-once, not exactly-once).
//   * Return 200 fast so RC doesn't retry.
//   * Handle event TYPES correctly (don't grant on a CANCELLATION/EXPIRATION).
//
// BLOCKED: B-REVENUECAT + B-VERIFY-RC — confirm the exact payload shape and the
// shared webhook auth value against live RC docs/account.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // or new secret key
const webhookAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';

// Grant access + auto-renew (docs/08 §4).
const GRANT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE']);
// Revoke access immediately.
const REVOKE_TYPES = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']);
// NEVER revoke on these — access continues until expires_at; only stop auto-renew
// (CANCELLATION) or keep access during the grace window (BILLING_ISSUE).
const STOP_RENEW_TYPES = new Set(['CANCELLATION', 'BILLING_ISSUE']);
// Auto-renewing types → will_renew = true. Excludes NON_RENEWING_PURCHASE (a
// consumable/lifetime product, which never auto-renews) and CANCELLATION (renewal
// stopped); BILLING_ISSUE is a retry/grace window that still INTENDS to renew, so
// it stays true here (docs/08 §6/§8 — will_renew is false only after a cancellation).
const RENEWING_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'BILLING_ISSUE']);

function mapStore(s: string | undefined): string | null {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes('APP_STORE')) return 'app_store';
  if (u.includes('PLAY')) return 'play_store';
  if (u.includes('STRIPE') || u.includes('WEB')) return 'web';
  return null;
}

Deno.serve(async (req) => {
  // Verify the shared secret RC is configured to send.
  if (webhookAuth && req.headers.get('Authorization') !== webhookAuth) {
    return new Response('unauthorized', { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event?.id) return new Response('bad request', { status: 400 });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Idempotency: skip if we've already processed this event.id.
  const { data: seen } = await supabase
    .from('subscriptions_events')
    .select('id')
    .eq('rc_event_id', event.id)
    .maybeSingle();
  if (seen) return new Response('ok (duplicate)', { status: 200 });

  const userId: string | undefined = event.app_user_id; // NOT body.app_user_id
  const eventType: string = event.type;

  await supabase.from('subscriptions_events').insert({
    rc_event_id: event.id,
    user_id: userId ?? null,
    event_type: eventType,
    payload: body,
  });

  if (userId) {
    const grant = GRANT_TYPES.has(eventType);
    const revoke = REVOKE_TYPES.has(eventType);
    const stopRenew = STOP_RENEW_TYPES.has(eventType);
    if (grant || revoke || stopRenew) {
      // is_active: granted types true; revoked false; CANCELLATION/BILLING_ISSUE
      // KEEP access (true) — access continues until expires_at (docs/08 §4).
      const isActive = grant || stopRenew;
      // entitlement_ids -> our 'pro' / 'pro_plus' tier. Default to 'pro'.
      const entitlement = (event.entitlement_ids?.[0] as string | undefined) ?? 'pro';
      await supabase.from('entitlements').upsert(
        {
          user_id: userId,
          entitlement,
          is_active: isActive,
          product_id: event.product_id ?? null,
          expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
          rc_event_id: event.id,
          updated_at: new Date().toISOString(),
          store: mapStore(event.store),
          // RC's period_type ('TRIAL' | 'INTRO' | 'NORMAL'); the reverse trial is
          // app-granted, never from RC. Lowercased to our enum.
          period_type: (event.period_type as string | undefined)?.toLowerCase() ?? null,
          will_renew: RENEWING_TYPES.has(eventType), // false after a cancellation; true during a billing retry
          original_purchase_at: event.original_purchase_date_ms
            ? new Date(event.original_purchase_date_ms).toISOString()
            : null,
        },
        { onConflict: 'user_id' },
      );
    }
  }

  return new Response('ok', { status: 200 });
});
