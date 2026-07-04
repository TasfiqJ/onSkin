// App-granted subscription actions. V1 only supports the no-card reverse trial.
// Runs with the service-role key and verify_jwt=true. Clients can request a grant,
// but cannot write entitlements directly.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appEnvironment = Deno.env.get('APP_ENV') ?? Deno.env.get('EXPO_PUBLIC_APP_ENV') ?? 'unknown';

const REVERSE_TRIAL_DAYS = 7;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function isStillActive(row: { is_active: boolean; expires_at: string | null; store: string | null; period_type: string | null }): boolean {
  if (!row.is_active) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
  return !(row.store === 'app_granted' && row.period_type === 'reverse_trial');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (userErr || !userId) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'start_reverse_trial') return json({ error: 'unknown_action' }, 400);

  await supabase.rpc('expire_app_granted_reverse_trials').catch(() => null);

  const { data: current } = await supabase
    .from('entitlements')
    .select('is_active, expires_at, store, period_type')
    .eq('user_id', userId)
    .maybeSingle();
  if (current && isStillActive(current)) {
    return json({ error: 'active_subscription_exists' }, 409);
  }

  const { data: priorGrant } = await supabase
    .from('reverse_trial_grants')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (priorGrant) return json({ error: 'reverse_trial_already_used' }, 409);

  const now = new Date().toISOString();
  const expiresAt = addDays(REVERSE_TRIAL_DAYS);
  const { error: grantErr } = await supabase.from('reverse_trial_grants').insert({
    user_id: userId,
    granted_at: now,
    expires_at: expiresAt,
    source: 'server',
    metadata: { action: 'start_reverse_trial' },
  });
  if (grantErr) return json({ error: grantErr.message }, 500);

  const entitlement = {
    user_id: userId,
    entitlement: 'pro',
    is_active: true,
    product_id: null,
    expires_at: expiresAt,
    rc_event_id: null,
    updated_at: now,
    store: 'app_granted',
    period_type: 'reverse_trial',
    will_renew: false,
    original_purchase_at: now,
    offering_id: null,
    package_id: null,
    source: 'app_granted',
    environment: appEnvironment === 'production' ? 'production' : appEnvironment === 'development' ? 'development' : 'unknown',
    management_url: null,
    verified_at: now,
    store_user_id: userId,
    last_reconciled_at: now,
    raw_status: { action: 'start_reverse_trial', days: REVERSE_TRIAL_DAYS },
  };

  const { data, error } = await supabase
    .from('entitlements')
    .upsert(entitlement, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ entitlement: data });
});
