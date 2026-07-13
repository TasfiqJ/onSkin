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
import { runAccountDeletionStateMachine } from './deletionCore.ts';
import { deletePhotoStorage } from './photoStorageCleanup.ts';
import { createSupabaseAccountDeletionStateStore } from './supabaseDeletionState.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
  completionToken?: string;
  statusOnly?: boolean;
};

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
    'APPLE_REVOCATION_STATUS_UNKNOWN',
    'REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED',
    'REVENUECAT_DELETION_FAILED',
    'POSTHOG_DELETION_NOT_CONFIGURED',
    'POSTHOG_DELETION_FAILED',
    'STORAGE_LIST_FAILED',
    'STORAGE_REMOVE_FAILED',
    'DATABASE_ERASURE_FAILED',
    'AUTH_USER_DELETE_FAILED',
    'AUTH_SESSION_REVOCATION_FAILED',
    'AUTH_DELETE_NOT_CONFIRMED',
    'ACCOUNT_DELETION_AUTH_NOT_READY',
    'ACCOUNT_DELETION_AUTH_FROZEN',
    'ACCOUNT_DELETION_SESSION_UNAVAILABLE',
    'ACCOUNT_DELETION_SESSION_MISMATCH',
    'ACCOUNT_DELETION_IN_PROGRESS',
    'ACCOUNT_DELETION_APPLE_REAUTHORIZATION_REQUIRED',
    'ACCOUNT_DELETION_STATE_INVALID',
    'ACCOUNT_DELETION_STATE_NOT_FOUND',
    'ACCOUNT_DELETION_STATE_CONFLICT',
    'ACCOUNT_DELETION_STATE_UNAVAILABLE',
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

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const COMPLETION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function verifiedSessionId(token: string, expectedUserId: string): string {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) throw new Error('missing payload');
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
    if (payload.sub !== expectedUserId || !UUID_PATTERN.test(sessionId)) {
      throw new Error('owner or session mismatch');
    }
    return sessionId;
  } catch {
    // The token has already been verified by auth.getUser(token). Requiring its
    // bound session_id lets the durable freeze preserve exactly this session's
    // refresh path while rejecting every other session or provider re-login.
    throw new Error('ACCOUNT_DELETION_SESSION_UNAVAILABLE');
  }
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

async function completionTokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`onskin:account-deletion-completion:${token}`),
  );
  return `t_${bytesToHex(digest)}`;
}

function completedResponse(state: {
  requestId: string;
  appleResult: 'revoked' | 'skipped' | null;
  posthogResult: 'deleted' | 'already_absent' | 'skipped' | null;
}): Response {
  if (!state.appleResult || !state.posthogResult) {
    throw new Error('ACCOUNT_DELETION_STATE_INVALID');
  }
  return json({
    deleted: true,
    request_id: state.requestId,
    apple: state.appleResult,
    posthog: state.posthogResult,
  });
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
  authorizationCode?: string,
  clientSecret?: string,
): Promise<'revoked'> {
  if (!authorizationCode) throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');
  if (!clientSecret) throw new Error('APPLE_REVOCATION_NOT_CONFIGURED');

  const clientId = appleClientId();
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

async function deleteRevenueCatSubscriber(userId: string): Promise<'deleted' | 'already_absent'> {
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
  return response.status === 404 ? 'already_absent' : 'deleted';
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
  assertPostHogDeletionConfigured();
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

  let lastStatus = 404;
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

function authUserAlreadyAbsent(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return (
    candidate.status === 404 ||
    candidate.code === 'user_not_found' ||
    message.includes('user not found')
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) return json({ error: 'payload_too_large' }, 413);

  const parsed = await readLimitedJson(req, maxBodyBytes, json, { error: 'BAD_JSON' });
  if (parsed instanceof Response) return parsed;
  const body =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as DeletionBody) : {};
  const completionToken =
    typeof body.completionToken === 'string' ? body.completionToken.trim().toLowerCase() : '';
  if (!COMPLETION_TOKEN_PATTERN.test(completionToken)) {
    return json({ deleted: false, error: 'ACCOUNT_DELETION_COMPLETION_TOKEN_INVALID' }, 400);
  }

  const token = bearerToken(req);
  if (!token) return json({ error: 'UNAUTHORIZED' }, 401);
  const supabase = createClient(supabaseUrl, serviceKey);
  const stateStore = createSupabaseAccountDeletionStateStore(supabase);
  const tokenHash = await completionTokenHash(completionToken);

  if (body.statusOnly === true) {
    try {
      const completed = await stateStore.lookupCompleted({ completionTokenHash: tokenHash });
      if (!completed) {
        return json({ deleted: false, error: 'ACCOUNT_DELETION_NOT_COMPLETE' }, 409);
      }
      return completedResponse(completed);
    } catch (error) {
      const code = publicError(error);
      console.error('[account-deletion-status]', code);
      return json({ deleted: false, error: code }, 409);
    }
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData.user as AuthUser | null;
  if (userErr || !user?.id) {
    try {
      const completed = await stateStore.lookupCompleted({ completionTokenHash: tokenHash });
      return completed ? completedResponse(completed) : json({ error: 'UNAUTHORIZED' }, 401);
    } catch {
      return json({ error: 'UNAUTHORIZED' }, 401);
    }
  }

  try {
    const sessionId = verifiedSessionId(token, user.id);
    const userHash = await pseudonymousUserId(user.id);
    const durablePreflight = await stateStore.preflight({ userId: user.id, userHash });
    const appleRequired = userHasProvider(user, 'apple') || durablePreflight.appleRequired;
    const appleAuthorizationCode =
      typeof body.appleAuthorizationCode === 'string'
        ? body.appleAuthorizationCode.trim()
        : undefined;
    let appleClientSecret: string | undefined;
    if (appleRequired) {
      if (!appleAuthorizationCode) throw new Error('APPLE_AUTHORIZATION_CODE_REQUIRED');
      // Validate every required Apple setting and the private key before the
      // durable claim freezes the account. Reuse this short-lived secret for
      // the later Apple step so no local configuration error can strand it.
      appleClientSecret = await createAppleClientSecret();
    }

    const leaseToken = crypto.randomUUID();
    const result = await runAccountDeletionStateMachine({
      userId: user.id,
      userHash,
      appleRequired,
      appleAuthorizationCode,
      sessionId,
      leaseToken,
      completionTokenHash: tokenHash,
      store: stateStore,
      actions: {
        deleteRevenueCatSubscriber: () => deleteRevenueCatSubscriber(user.id),
        deletePostHogPerson: () => deletePostHogPerson(user.id),
        async deletePhotoStorage() {
          await deletePhotoStorage(user.id, supabase);
          return 'deleted';
        },
        async eraseDatabaseState({ requestId }) {
          await stateStore.eraseDatabaseState({
            requestId,
            userId: user.id,
            leaseToken,
          });
          return 'deleted';
        },
        async revokeOtherAuthSessions() {
          const { error } = await supabase.auth.admin.signOut(token, 'others');
          if (error) throw new Error(`AUTH_SESSION_REVOCATION_FAILED:${error.message}`);
          return 'revoked';
        },
        async revokeAppleToken(authorizationCode) {
          return await revokeAppleTokenIfNeeded(authorizationCode, appleClientSecret);
        },
        async reconcileProviders() {
          await deleteRevenueCatSubscriber(user.id);
          await deletePostHogPerson(user.id);
          return 'reconciled';
        },
        async deleteAuthIdentity() {
          const { error } = await supabase.auth.admin.deleteUser(user.id);
          if (!error) return 'deleted';
          if (authUserAlreadyAbsent(error)) return 'already_absent';
          throw new Error(`AUTH_USER_DELETE_FAILED:${error.message}`);
        },
      },
      errorCode: publicError,
    });

    return json({
      deleted: true,
      request_id: result.requestId,
      apple: result.apple,
      posthog: result.posthog,
    });
  } catch (error) {
    const code = publicError(error);
    console.error('[account-deletion]', code);
    return json({ deleted: false, error: code }, 409);
  }
});
