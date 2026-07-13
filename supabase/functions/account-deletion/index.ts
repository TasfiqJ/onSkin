// In-app account deletion (Apple Guideline 5.1.1(v), Google equivalent, docs/01 §4).
// Deploy with JWT verification enabled: `supabase functions deploy account-deletion`
//
// The caller's JWT proves they are deleting their own account. The service-role key
// is used only inside this function for provider deletion, storage purge, and the
// final auth.users delete.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { bearerToken } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson, userEdgeBodyMaxBytes } from '../_shared/body.ts';
import {
  fetchWithTimeout,
  readLimitedResponseJson,
  readLimitedResponseText,
} from '../_shared/fetch.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { deletePhotoStorage } from './photoStorageCleanup.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = readSupabaseSecretKey();
const revenueCatSecretKey =
  Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? Deno.env.get('REVENUECAT_REST_API_KEY') ?? '';
const maxBodyBytes = userEdgeBodyMaxBytes();

type AuthUser = {
  id: string;
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ id?: string; provider?: string; identity_data?: Record<string, unknown> }>;
};

type DeletionBody = {
  appleAuthorizationCode?: string;
};

type EdgeSupabaseClient = any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
    },
  });
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.match(/^[A-Z0-9_]+/)?.[0] ?? '';
  const publicCodes = new Set([
    'APPLE_REVOCATION_NOT_CONFIGURED',
    'APPLE_AUTHORIZATION_CODE_REQUIRED',
    'APPLE_TOKEN_EXCHANGE_FAILED',
    'APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN',
    'APPLE_TOKEN_REVOKE_FAILED',
    'REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED',
    'REVENUECAT_DELETION_FAILED',
    'POSTHOG_DELETION_NOT_CONFIGURED',
    'POSTHOG_DELETION_FAILED',
    'STORAGE_LIST_FAILED',
    'STORAGE_REMOVE_FAILED',
    'AUTH_USER_DELETE_FAILED',
  ]);
  return publicCodes.has(code) ? code : 'ACCOUNT_DELETION_FAILED';
}

function userHasProvider(user: AuthUser, provider: string): boolean {
  const providers = user.app_metadata?.providers;
  return (
    user.app_metadata?.provider === provider ||
    (Array.isArray(providers) && providers.includes(provider)) ||
    Boolean(user.identities?.some((identity) => identity.provider === provider))
  );
}

function appleClientId(): string {
  return (
    Deno.env.get('APPLE_SIWA_CLIENT_ID') ??
    Deno.env.get('APPLE_SIWA_SERVICE_ID') ??
    Deno.env.get('APPLE_BUNDLE_ID') ??
    Deno.env.get('APP_IOS_BUNDLE_IDENTIFIER') ??
    ''
  );
}

function assertAppleRevocationConfigured(): void {
  const teamId = Deno.env.get('APPLE_TEAM_ID') ?? '';
  const keyId = Deno.env.get('APPLE_SIWA_KEY_ID') ?? '';
  const privateKey = Deno.env.get('APPLE_SIWA_PRIVATE_KEY') ?? '';
  if (!teamId || !keyId || !appleClientId() || !privateKey) {
    throw new Error('APPLE_REVOCATION_NOT_CONFIGURED');
  }
}

function posthogDeletionRequired(): boolean {
  return Boolean(
    Deno.env.get('EXPO_PUBLIC_POSTHOG_KEY') ||
    Deno.env.get('POSTHOG_PROJECT_ID') ||
    Deno.env.get('POSTHOG_PERSONAL_API_KEY') ||
    Deno.env.get('POSTHOG_ENVIRONMENT_ID'),
  );
}

function assertPostHogDeletionConfigured(): void {
  const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY') ?? '';
  const projectId =
    Deno.env.get('POSTHOG_PROJECT_ID') ?? Deno.env.get('POSTHOG_ENVIRONMENT_ID') ?? '';
  const approvedAlternate = Deno.env.get('POSTHOG_DELETION_APPROVED_ALTERNATE') === 'true';

  if (!posthogDeletionRequired()) return;
  if ((!personalApiKey || !projectId) && approvedAlternate) return;
  if (!personalApiKey || !projectId) throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');
}

function assertDeletionPreconditions(user: AuthUser, body: DeletionBody): void {
  if (userHasProvider(user, 'apple')) {
    if (!body.appleAuthorizationCode) throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');
    assertAppleRevocationConfigured();
  }
  if (!revenueCatSecretKey) throw new Error('REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED');
  assertPostHogDeletionConfigured();
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function pseudonymousUserId(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`onskin:user:${userId}`),
  );
  return `u_${bytesToHex(digest).slice(0, 32)}`;
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
  const clientId = appleClientId();
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

async function revokeAppleTokenIfNeeded(
  user: AuthUser,
  authorizationCode?: string,
): Promise<'skipped' | 'revoked'> {
  if (!userHasProvider(user, 'apple')) return 'skipped';
  if (!authorizationCode) throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');

  const clientId = appleClientId();
  const clientSecret = await createAppleClientSecret();
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetchWithTimeout('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams,
  }).catch(() => null);
  if (!tokenResponse) throw new Error('APPLE_TOKEN_EXCHANGE_FAILED:FETCH_FAILED');
  const tokenBody =
    (await readLimitedResponseJson<{
      access_token?: string;
      refresh_token?: string;
      error?: string;
    }>(tokenResponse)) ?? {};
  if (!tokenResponse.ok)
    throw new Error(`APPLE_TOKEN_EXCHANGE_FAILED:${tokenBody.error ?? tokenResponse.status}`);

  const token = tokenBody.refresh_token ?? tokenBody.access_token;
  if (!token) throw new Error('APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN');

  const revokeParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenBody.refresh_token ? 'refresh_token' : 'access_token',
  });
  const revokeResponse = await fetchWithTimeout('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: revokeParams,
  }).catch(() => null);
  if (!revokeResponse) throw new Error('APPLE_TOKEN_REVOKE_FAILED:FETCH_FAILED');
  if (!revokeResponse.ok) {
    const text = (await readLimitedResponseText(revokeResponse)) ?? 'RESPONSE_TOO_LARGE';
    throw new Error(`APPLE_TOKEN_REVOKE_FAILED:${revokeResponse.status}:${text.slice(0, 80)}`);
  }
  return 'revoked';
}

async function deleteRevenueCatSubscriber(
  userId: string,
  supabase: EdgeSupabaseClient,
): Promise<void> {
  if (!revenueCatSecretKey) throw new Error('REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED');

  const response = await fetchWithTimeout(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${revenueCatSecretKey}` },
    },
  ).catch(() => null);
  if (!response) throw new Error('REVENUECAT_DELETION_FAILED:FETCH_FAILED');
  const body = (await readLimitedResponseText(response)) ?? 'RESPONSE_TOO_LARGE';
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
  const projectId =
    Deno.env.get('POSTHOG_PROJECT_ID') ?? Deno.env.get('POSTHOG_ENVIRONMENT_ID') ?? '';
  const approvedAlternate = Deno.env.get('POSTHOG_DELETION_APPROVED_ALTERNATE') === 'true';
  const posthogEnabled =
    Boolean(Deno.env.get('EXPO_PUBLIC_POSTHOG_KEY')) || Boolean(Deno.env.get('POSTHOG_PROJECT_ID'));

  if (!posthogEnabled && !personalApiKey && !projectId) return 'skipped';
  if ((!personalApiKey || !projectId) && approvedAlternate) return 'skipped';
  if (!personalApiKey || !projectId) throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');

  const host = posthogApiHost();
  const payload = JSON.stringify({
    // Delete the current pseudonymous identity and the legacy raw Supabase id
    // used by builds before SEC-P1-003.
    distinct_ids: [await pseudonymousUserId(userId), userId],
  });
  const endpoints = [
    `${host}/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
    `${host}/api/environments/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
  ];

  let lastStatus = 0;
  let lastBody = '';
  for (const endpoint of endpoints) {
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${personalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    }).catch(() => null);
    if (!response) {
      lastStatus = 0;
      lastBody = 'FETCH_FAILED';
      break;
    }
    lastStatus = response.status;
    lastBody = (await readLimitedResponseText(response)) ?? 'RESPONSE_TOO_LARGE';
    if (response.ok || response.status === 404) {
      if (response.ok) return 'deleted';
      continue;
    }
    break;
  }

  throw new Error(`POSTHOG_DELETION_FAILED:${lastStatus}:${lastBody.slice(0, 80)}`);
}

async function scrubServiceRoleOnlyRows(
  userId: string,
  supabase: EdgeSupabaseClient,
): Promise<void> {
  const { data: clicks } = await supabase
    .from('commerce_click_events')
    .select('click_token')
    .eq('user_id', userId);
  const clickTokens = ((clicks ?? []) as Array<{ click_token?: string | null }>)
    .map((row: { click_token?: string | null }) => row.click_token)
    .filter((token): token is string => Boolean(token));
  if (clickTokens.length > 0) {
    await supabase
      .from('order_attributions')
      .update({ click_token: null })
      .in('click_token', clickTokens);
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
    .or(
      `user_id.eq.${userId},resolved_user_id.eq.${userId},app_user_id.eq.${userId},original_app_user_id.eq.${userId}`,
    );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const token = bearerToken(req);
  if (!token) return json({ error: 'UNAUTHORIZED' }, 401);
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData.user as AuthUser | null;
  if (userErr || !user?.id) return json({ error: 'UNAUTHORIZED' }, 401);

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'BAD_JSON' });
  if (parsed instanceof Response) return parsed;
  const body =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as DeletionBody) : {};

  try {
    assertDeletionPreconditions(user, body);
    const apple = await revokeAppleTokenIfNeeded(user, body.appleAuthorizationCode);
    await deleteRevenueCatSubscriber(user.id, supabase);
    const posthog = await deletePostHogPerson(user.id);
    await deletePhotoStorage(user.id, supabase);
    await scrubServiceRoleOnlyRows(user.id, supabase);

    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error(`AUTH_USER_DELETE_FAILED:${delErr.message}`);

    return json({ deleted: true, apple, posthog }, 200);
  } catch (error) {
    const code = publicError(error);
    console.error('[account-deletion]', code);
    return json({ deleted: false, error: code }, 409);
  }
});
