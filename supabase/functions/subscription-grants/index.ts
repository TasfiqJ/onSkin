// App-granted subscription actions. V1 only supports the no-card reverse trial.
// Runs with the service-role key and verify_jwt=true. Clients can request a grant,
// but cannot write entitlements directly.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerToken } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appEnvironment = Deno.env.get('APP_ENV') ?? Deno.env.get('EXPO_PUBLIC_APP_ENV') ?? 'unknown';
const maxBodyBytes = userEdgeBodyMaxBytes();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function grantErrorCode(
  error: unknown,
): 'active_subscription_exists' | 'reverse_trial_already_used' | 'reverse_trial_grant_failed' {
  const message =
    typeof (error as { message?: unknown })?.message === 'string'
      ? (error as { message: string }).message
      : '';
  if (message.includes('ACTIVE_SUBSCRIPTION_EXISTS')) return 'active_subscription_exists';
  if (message.includes('REVERSE_TRIAL_ALREADY_USED')) return 'reverse_trial_already_used';
  return 'reverse_trial_grant_failed';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const token = bearerToken(req);
  if (!token) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (userErr || !userId) return json({ error: 'unauthorized' }, 401);

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (parsed instanceof Response) return parsed;
  const body = isRecord(parsed) ? parsed : {};
  if (body?.action !== 'start_reverse_trial') return json({ error: 'unknown_action' }, 400);

  const expiresAt = addDays(REVERSE_TRIAL_DAYS);
  const environment =
    appEnvironment === 'production'
      ? 'production'
      : appEnvironment === 'development'
        ? 'development'
        : 'unknown';
  const { data, error } = await supabase.rpc('grant_app_granted_reverse_trial', {
    p_user_id: userId,
    p_expires_at: expiresAt,
    p_environment: environment,
    p_product_id: null,
  });
  if (error) {
    const code = grantErrorCode(error);
    console.error('[subscription-grants]', code);
    const status =
      code === 'active_subscription_exists' || code === 'reverse_trial_already_used' ? 409 : 500;
    return json({ error: code }, status);
  }

  const entitlement = Array.isArray(data) ? data[0] : data;
  if (!entitlement) {
    console.error('[subscription-grants]', 'reverse_trial_grant_failed');
    return json({ error: 'reverse_trial_grant_failed' }, 500);
  }
  return json({ entitlement });
});
