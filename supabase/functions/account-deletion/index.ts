// In-app account deletion (Apple Guideline 5.1.1(v), Google equivalent, docs/01 §4).
// Deploy with JWT verification enabled: `supabase functions deploy account-deletion`
//
// The caller's JWT proves they are deleting their own account. The service-role key
// is used only inside this function for provider deletion, storage purge, and the
// final auth.users delete.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const revenueCatSecretKey =
  Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? Deno.env.get('REVENUECAT_REST_API_KEY') ?? '';

type AuthUser = {
  id: string;
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ id?: string; provider?: string; identity_data?: Record<string, unknown> }>;
};

type DeletionBody = {
  appleAuthorizationCode?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' },
  });
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/APPLE_/i.test(message)) return message;
  if (/POSTHOG_/i.test(message)) return message;
  if (/REVENUECAT_/i.test(message)) return message;
  if (/STORAGE_/i.test(message)) return message;
  return 'ACCOUNT_DELETION_FAILED';
}

function userHasProvider(user: AuthUser, provider: string): boolean {
  const providers = user.app_metadata?.providers;
  return (
    user.app_metadata?.provider === provider ||
    (Array.isArray(providers) && providers.includes(provider)) ||
    Boolean(user.identities?.some((identity) => identity.provider === provider))
  );
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToPkcs8(privateKey: string): ArrayBuffer {
  const normalized = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createAppleClientSecret(): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID') ?? '';
  const keyId = Deno.env.get('APPLE_SIWA_KEY_ID') ?? '';
  const clientId =
    Deno.env.get('APPLE_SIWA_CLIENT_ID') ??
    Deno.env.get('APPLE_SIWA_SERVICE_ID') ??
    Deno.env.get('APPLE_BUNDLE_ID') ??
    Deno.env.get('APP_IOS_BUNDLE_IDENTIFIER') ??
    '';
  const privateKey = Deno.env.get('APPLE_SIWA_PRIVATE_KEY') ?? '';

  if (!teamId || !keyId || !clientId || !privateKey) {
    throw new Error('APPLE_REVOCATION_NOT_CONFIGURED');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 10,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function revokeAppleTokenIfNeeded(user: AuthUser, authorizationCode?: string): Promise<'skipped' | 'revoked'> {
  if (!userHasProvider(user, 'apple')) return 'skipped';
  if (!authorizationCode) throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');

  const clientId =
    Deno.env.get('APPLE_SIWA_CLIENT_ID') ??
    Deno.env.get('APPLE_SIWA_SERVICE_ID') ??
    Deno.env.get('APPLE_BUNDLE_ID') ??
    Deno.env.get('APP_IOS_BUNDLE_IDENTIFIER') ??
    '';
  const clientSecret = await createAppleClientSecret();
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams,
  });
  const tokenBody = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (!tokenResponse.ok) throw new Error(`APPLE_TOKEN_EXCHANGE_FAILED:${tokenBody.error ?? tokenResponse.status}`);

  const token = tokenBody.refresh_token ?? tokenBody.access_token;
  if (!token) throw new Error('APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN');

  const revokeParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenBody.refresh_token ? 'refresh_token' : 'access_token',
  });
  const revokeResponse = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: revokeParams,
  });
  if (!revokeResponse.ok) {
    const text = await revokeResponse.text();
    throw new Error(`APPLE_TOKEN_REVOKE_FAILED:${revokeResponse.status}:${text.slice(0, 80)}`);
  }
  return 'revoked';
}

async function deleteRevenueCatSubscriber(userId: string, supabase: ReturnType<typeof createClient>): Promise<void> {
  if (!revenueCatSecretKey) throw new Error('REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED');

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${revenueCatSecretKey}` },
  });
  const body = await response.text();
  if (!response.ok && response.status !== 404) {
    throw new Error(`REVENUECAT_DELETION_FAILED:${response.status}:${body.slice(0, 80)}`);
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  const userHash = base64UrlEncode(digest).slice(0, 20);
  await supabase.from('subscriptions_events').insert({
    rc_event_id: `account_deletion_${userHash}_${Date.now()}`,
    user_id: null,
    event_type: 'CUSTOMER_DELETION_REQUESTED',
    payload: {
      provider: 'revenuecat',
      status: response.status,
      note: 'RevenueCat customer data deletion does not cancel Apple or Google subscriptions.',
    },
    resolved_user_id: null,
    processing_status: 'processed',
    processed_at: new Date().toISOString(),
  });
}

function posthogApiHost(): string {
  const host =
    Deno.env.get('POSTHOG_API_HOST') ??
    Deno.env.get('POSTHOG_HOST') ??
    Deno.env.get('EXPO_PUBLIC_POSTHOG_HOST') ??
    'https://us.posthog.com';
  return host
    .replace(/\/+$/g, '')
    .replace('https://us.i.posthog.com', 'https://us.posthog.com')
    .replace('https://eu.i.posthog.com', 'https://eu.posthog.com');
}

async function deletePostHogPerson(userId: string): Promise<'deleted' | 'skipped'> {
  const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY') ?? '';
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID') ?? Deno.env.get('POSTHOG_ENVIRONMENT_ID') ?? '';
  const approvedAlternate = Deno.env.get('POSTHOG_DELETION_APPROVED_ALTERNATE') === 'true';
  const posthogEnabled =
    Boolean(Deno.env.get('EXPO_PUBLIC_POSTHOG_KEY')) || Boolean(Deno.env.get('POSTHOG_PROJECT_ID'));

  if (!posthogEnabled && !personalApiKey && !projectId) return 'skipped';
  if ((!personalApiKey || !projectId) && approvedAlternate) return 'skipped';
  if (!personalApiKey || !projectId) throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');

  const host = posthogApiHost();
  const payload = JSON.stringify({ distinct_ids: [userId] });
  const endpoints = [
    `${host}/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
    `${host}/api/environments/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
  ];

  let lastStatus = 0;
  let lastBody = '';
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    lastStatus = response.status;
    lastBody = await response.text();
    if (response.ok || response.status === 404) {
      if (response.ok) return 'deleted';
      continue;
    }
    break;
  }

  throw new Error(`POSTHOG_DELETION_FAILED:${lastStatus}:${lastBody.slice(0, 80)}`);
}

async function deletePhotoStorage(userId: string, supabase: ReturnType<typeof createClient>): Promise<void> {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from('photos').list(userId, { limit: 1000, offset });
    if (error) throw new Error(`STORAGE_LIST_FAILED:${error.message}`);
    if (!data || data.length === 0) break;
    const paths = data.map((object) => `${userId}/${object.name}`);
    const { error: removeError } = await supabase.storage.from('photos').remove(paths);
    if (removeError) throw new Error(`STORAGE_REMOVE_FAILED:${removeError.message}`);
    if (data.length < 1000) break;
  }
}

async function scrubServiceRoleOnlyRows(userId: string, supabase: ReturnType<typeof createClient>): Promise<void> {
  const { data: clicks } = await supabase
    .from('commerce_click_events')
    .select('click_token')
    .eq('user_id', userId);
  const clickTokens = (clicks ?? [])
    .map((row: { click_token?: string | null }) => row.click_token)
    .filter((token): token is string => Boolean(token));
  if (clickTokens.length > 0) {
    await supabase.from('order_attributions').update({ click_token: null }).in('click_token', clickTokens);
  }

  await supabase
    .from('subscriptions_events')
    .update({
      user_id: null,
      resolved_user_id: null,
      app_user_id: null,
      original_app_user_id: null,
      aliases: null,
      payload: { erased: true, erased_at: new Date().toISOString(), reason: 'account_deletion' },
    })
    .or(`user_id.eq.${userId},resolved_user_id.eq.${userId},app_user_id.eq.${userId},original_app_user_id.eq.${userId}`);
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(supabaseUrl, serviceKey);

  const rawBody = await req.text();
  let body: DeletionBody = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as DeletionBody) : {};
  } catch {
    return json({ error: 'BAD_JSON' }, 400);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData.user as AuthUser | null;
  if (userErr || !user?.id) return json({ error: 'UNAUTHORIZED' }, 401);

  try {
    const apple = await revokeAppleTokenIfNeeded(user, body.appleAuthorizationCode);
    await deletePhotoStorage(user.id, supabase);
    await deleteRevenueCatSubscriber(user.id, supabase);
    const posthog = await deletePostHogPerson(user.id);
    await scrubServiceRoleOnlyRows(user.id, supabase);

    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error(`AUTH_USER_DELETE_FAILED:${delErr.message}`);

    return json({ deleted: true, apple, posthog }, 200);
  } catch (error) {
    console.error('[account-deletion]', error);
    return json({ deleted: false, error: publicError(error) }, 409);
  }
});
