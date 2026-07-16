// App-granted subscription actions. V1 only supports the no-card reverse trial.
// Runs with the service-role key and verify_jwt=true. Clients can request a grant,
// but cannot write either entitlement authority lane directly.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { type AccountAccessSnapshot, preflightAccountAccess } from '../_shared/accountAccess.ts';
import { bearerAuthorizationHeader, bearerToken } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import { readEdgeAppEnvironment } from '../_shared/env.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { reverseTrialGrantErrorCode, reverseTrialGrantErrorStatus } from './grantErrors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = readSupabaseSecretKey();
const appEnvironment = readEdgeAppEnvironment();
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

async function requireSameAccountAccess(
  caller: Parameters<typeof preflightAccountAccess>[0],
  userId: string,
  snapshot: AccountAccessSnapshot,
): Promise<Response | null> {
  const result = await preflightAccountAccess(caller, userId, snapshot);
  return result.ok ? null : json({ error: result.error }, result.status);
}

Deno.serve(async (req) => {
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const token = bearerToken(req);
  const authorization = bearerAuthorizationHeader(req);
  if (!token || !authorization) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(supabaseUrl, serviceKey);
  const caller = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const userId = userData.user?.id;
  if (userErr || !userId) return json({ error: 'unauthorized' }, 401);

  const initialAccountAccess = await preflightAccountAccess(caller, userId);
  if (!initialAccountAccess.ok) {
    return json({ error: initialAccountAccess.error }, initialAccountAccess.status);
  }

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'bad_json' });
  if (parsed instanceof Response) return parsed;
  const body = isRecord(parsed) ? parsed : {};
  if (body?.action !== 'start_reverse_trial') return json({ error: 'unknown_action' }, 400);

  const grantAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (grantAccountError) return grantAccountError;

  const expiresAt = addDays(REVERSE_TRIAL_DAYS);
  const { data, error } = await supabase.rpc('grant_app_granted_reverse_trial', {
    p_user_id: userId,
    p_expires_at: expiresAt,
    p_environment: appEnvironment,
  });
  if (error) {
    const responseAccountError = await requireSameAccountAccess(
      caller,
      userId,
      initialAccountAccess.snapshot,
    );
    if (responseAccountError) return responseAccountError;
    const code = reverseTrialGrantErrorCode(error);
    console.error('[subscription-grants]', code);
    return json({ error: code }, reverseTrialGrantErrorStatus(code));
  }

  const entitlement = Array.isArray(data) ? data[0] : data;
  if (!entitlement) {
    console.error('[subscription-grants]', 'reverse_trial_grant_failed');
    return json({ error: 'reverse_trial_grant_failed' }, 500);
  }
  const responseAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (responseAccountError) return responseAccountError;
  return json({ entitlement });
});
