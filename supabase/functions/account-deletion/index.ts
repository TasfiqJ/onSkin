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
import {
  ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
  attestAppleTokenExchange,
  attestAppleTokenRevocation,
  buildPostHogBulkDeleteRequest,
  buildRevenueCatDeletionRequest,
  normalizePostHogApiHost,
  planAppleDeletion,
  postHogDeletionRequiredForEnvironment,
  postHogDeletionDisposition,
  requireAppleRevocationConfiguration,
  resolveAppleAutomaticRevocation,
  revenueCatDeletionDisposition,
  type AppleDeletionOutcome,
  type AppleRevocationConfiguration,
} from './providerDeletion.ts';
import { scrubAccountServiceRows } from './serviceRoleCleanup.ts';

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
  appleAuthorizationCode?: unknown;
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
    'REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED',
    'REVENUECAT_DELETION_FAILED',
    'POSTHOG_DELETION_NOT_CONFIGURED',
    'POSTHOG_DELETION_FAILED',
    'POSTHOG_DELETION_PENDING',
    'STORAGE_LIST_FAILED',
    'STORAGE_REMOVE_FAILED',
    'ACCOUNT_SERVICE_SCRUB_FAILED',
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

function appleRevocationConfiguration(): AppleRevocationConfiguration {
  return requireAppleRevocationConfiguration({
    teamId: Deno.env.get('APPLE_TEAM_ID'),
    keyId: Deno.env.get('APPLE_SIWA_KEY_ID'),
    clientId: Deno.env.get('APPLE_SIWA_CLIENT_ID'),
    nativeBundleId: Deno.env.get('APP_IOS_BUNDLE_IDENTIFIER'),
    privateKey: Deno.env.get('APPLE_SIWA_PRIVATE_KEY'),
  });
}

function assertAppleRevocationConfigured(): AppleRevocationConfiguration {
  return appleRevocationConfiguration();
}

function posthogDeletionRequired(): boolean {
  return postHogDeletionRequiredForEnvironment({
    appEnvironment: Deno.env.get('APP_ENV'),
    publicAppEnvironment: Deno.env.get('EXPO_PUBLIC_APP_ENV'),
    mobileKey: Deno.env.get('EXPO_PUBLIC_POSTHOG_KEY'),
    projectId: Deno.env.get('POSTHOG_PROJECT_ID'),
    personalApiKey: Deno.env.get('POSTHOG_PERSONAL_API_KEY'),
  });
}

function assertPostHogDeletionConfigured(): void {
  const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY') ?? '';
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID') ?? '';

  if (!posthogDeletionRequired()) return;
  if (!personalApiKey || !projectId) throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');
  posthogApiHost();
}

function assertDeletionPreconditions(user: AuthUser, body: DeletionBody): void {
  // Apple configuration cannot withhold deletion under TN3194. It is validated
  // inside the best-effort revocation attempt and falls back to manual removal.
  void user;
  void body;
  if (!revenueCatSecretKey) throw new Error('REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED');
  assertPostHogDeletionConfigured();
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

async function createAppleClientSecret(config: AppleRevocationConfiguration): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: config.keyId };
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + 60 * 10,
    aud: 'https://appleid.apple.com',
    sub: config.clientId,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(config.privateKey),
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
  authorizationCode: unknown,
): Promise<AppleDeletionOutcome> {
  const plan = planAppleDeletion(userHasProvider(user, 'apple'), authorizationCode);
  if (plan.action !== 'attempt_revocation') return plan.outcome;

  const resolution = await resolveAppleAutomaticRevocation(async () => {
    const config = assertAppleRevocationConfigured();
    const clientSecret = await createAppleClientSecret(config);
    const tokenParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code: plan.authorizationCode,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetchWithTimeout('https://appleid.apple.com/auth/token', {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    }).catch(() => null);
    if (!tokenResponse) throw new Error('APPLE_TOKEN_EXCHANGE_FAILED:FETCH_FAILED');
    const tokenBody = await readLimitedResponseJson<unknown>(
      tokenResponse,
      ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
    );
    const token = attestAppleTokenExchange(tokenResponse.status, tokenBody);

    const revokeParams = new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      token: token.token,
      token_type_hint: token.tokenTypeHint,
    });
    const revokeResponse = await fetchWithTimeout('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: revokeParams,
    }).catch(() => null);
    if (!revokeResponse) throw new Error('APPLE_TOKEN_REVOKE_FAILED:FETCH_FAILED');
    if (revokeResponse.status !== 200) {
      await readLimitedResponseText(revokeResponse, ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES);
    }
    attestAppleTokenRevocation(revokeResponse.status);
    await revokeResponse.body?.cancel().catch(() => undefined);
  });
  if (resolution.warningCode) {
    // Never log provider bodies, credentials, or codes; this stable reason is
    // sufficient for operations while deletion continues as TN3194 requires.
    console.warn('[account-deletion]', resolution.warningCode);
  }
  return resolution.outcome;
}

async function deleteRevenueCatSubscriber(userId: string): Promise<void> {
  if (!revenueCatSecretKey) throw new Error('REVENUECAT_SECRET_API_KEY_NOT_CONFIGURED');

  const request = buildRevenueCatDeletionRequest(userId, revenueCatSecretKey);
  const response = await fetchWithTimeout(request.url, request.init).catch(() => null);
  if (!response) throw new Error('REVENUECAT_DELETION_FAILED:FETCH_FAILED');

  if (response.status !== 200) {
    await readLimitedResponseText(response, ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES);
    throw new Error(`REVENUECAT_DELETION_FAILED:${response.status}`);
  }

  const body = await readLimitedResponseJson<unknown>(
    response,
    ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
  );
  if (revenueCatDeletionDisposition(response.status, body, userId) !== 'deleted') {
    throw new Error('REVENUECAT_DELETION_FAILED:UNATTESTED_RESPONSE');
  }
}

function posthogApiHost(): string {
  const host = Deno.env.get('POSTHOG_API_HOST') ?? 'https://eu.posthog.com';
  return normalizePostHogApiHost(host);
}

async function deletePostHogPerson(userId: string): Promise<'already_absent' | 'skipped'> {
  const personalApiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY') ?? '';
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID') ?? '';

  if (!posthogDeletionRequired()) return 'skipped';
  if (!personalApiKey || !projectId) throw new Error('POSTHOG_DELETION_NOT_CONFIGURED');

  const request = await buildPostHogBulkDeleteRequest({
    host: posthogApiHost(),
    projectId,
    personalApiKey,
    userId,
  });
  const response = await fetchWithTimeout(request.url, request.init).catch(() => null);
  if (!response) throw new Error('POSTHOG_DELETION_FAILED:FETCH_FAILED');
  if (response.status !== 202) {
    await readLimitedResponseText(response, ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES);
    throw new Error(`POSTHOG_DELETION_FAILED:${response.status}`);
  }

  const body = await readLimitedResponseJson<unknown>(
    response,
    ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
  );
  const disposition = postHogDeletionDisposition(response.status, body);
  if (disposition === 'unattested') {
    throw new Error('POSTHOG_DELETION_FAILED:UNATTESTED_RESPONSE');
  }
  if (disposition === 'already_absent') return 'already_absent';

  // PostHog confirms only that asynchronous event/recording deletion is queued.
  // Do not delete local storage or Auth until durable state and status polling exist.
  throw new Error('POSTHOG_DELETION_PENDING');
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
    await deleteRevenueCatSubscriber(user.id);
    const posthog = await deletePostHogPerson(user.id);
    await deletePhotoStorage(user.id, supabase);
    await scrubAccountServiceRows(user.id, supabase);

    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error(`AUTH_USER_DELETE_FAILED:${delErr.message}`);

    return json({ deleted: true, apple, posthog }, 200);
  } catch (error) {
    const code = publicError(error);
    console.error('[account-deletion]', code);
    return json({ deleted: false, error: code }, 409);
  }
});
