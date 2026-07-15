import 'react-native-url-polyfill/auto'; // supabase-js needs a WHATWG URL on RN
import type { Database } from '@onskin/types/database';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

import { env } from '../env';
import {
  createSupabaseAuthRefreshProtectiveFetch,
  parseSupabaseAccessTokenClaims,
} from './authRefreshProtection';
import { LargeSecureStore } from './largeSecureStore';
import { createSupabaseRemoteRequestGatedFetch } from './remoteRequestGate';

const isServerRender = typeof window === 'undefined';
const serverAuthStorage = {
  async getItem(): Promise<string | null> {
    return null;
  },
  async setItem(): Promise<void> {},
  async removeItem(): Promise<void> {},
};
const authStorage = isServerRender ? serverAuthStorage : new LargeSecureStore();
const authStorageKey = `sb-${new URL(env.supabaseUrl).hostname.split('.')[0]}-auth-token`;
const authRefreshProtectiveFetch = createSupabaseAuthRefreshProtectiveFetch({
  fetchImplementation: (input, init) => fetch(input, init),
  supabaseUrl: env.supabaseUrl,
});
const remotelyAdmittedFetch = createSupabaseRemoteRequestGatedFetch(
  authRefreshProtectiveFetch,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read the encrypted auth candidate without invoking auth-js. `getSession()`
 * performs an implicit refresh when a token is near expiry, which would create
 * an untyped network lane before AuthProvider can bind the central admission
 * controller. Invalid encrypted content is an explicit fail-closed error, not
 * a signed-out result that could authorize destructive local cleanup.
 */
export async function readPersistedSupabaseSessionCandidate(): Promise<Session | null> {
  const serialized = await authStorage.getItem(authStorageKey);
  if (serialized === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('SUPABASE_PERSISTED_SESSION_INVALID');
  }
  const user = isRecord(value) && isRecord(value.user) ? value.user : null;
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    value.access_token.length === 0 ||
    typeof value.refresh_token !== 'string' ||
    value.refresh_token.length === 0 ||
    typeof value.expires_at !== 'number' ||
    !Number.isSafeInteger(value.expires_at) ||
    value.expires_at <= 0 ||
    user === null ||
    typeof user.id !== 'string' ||
    user.id.length === 0
  ) {
    throw new Error('SUPABASE_PERSISTED_SESSION_INVALID');
  }
  return value as unknown as Session;
}

export class SupabaseControlledRefreshTerminalError extends Error {
  constructor(readonly authCode: string | null) {
    super('SUPABASE_CONTROLLED_REFRESH_TERMINAL');
    this.name = 'SupabaseControlledRefreshTerminalError';
  }
}

export function isSupabaseControlledRefreshTerminalError(
  error: unknown,
): error is SupabaseControlledRefreshTerminalError {
  return error instanceof SupabaseControlledRefreshTerminalError;
}

/**
 * Refresh exactly once through the process-wide gated transport, then durably
 * replace the encrypted candidate. This deliberately avoids auth-js
 * `refreshSession()`: that method first calls `getSession()` and can perform an
 * implicit near-expiry refresh before issuing its requested refresh.
 */
export async function refreshPersistedSupabaseSessionCandidate(
  refreshToken: string,
  expectedSubject: string,
): Promise<Session> {
  const response = await remotelyAdmittedFetch(
    `${env.supabaseUrl.replace(/\/+$/u, '')}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      redirect: 'manual',
      headers: {
        apikey: env.supabasePublishableKey,
        Authorization: `Bearer ${env.supabasePublishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const code =
      isRecord(payload) &&
      (typeof payload.code === 'string' || typeof payload.error_code === 'string')
        ? typeof payload.code === 'string'
          ? payload.code
          : (payload.error_code as string)
        : null;
    throw new SupabaseControlledRefreshTerminalError(code);
  }
  const user = isRecord(payload) && isRecord(payload.user) ? payload.user : null;
  const accessToken =
    isRecord(payload) && typeof payload.access_token === 'string'
      ? payload.access_token
      : null;
  const nextRefreshToken =
    isRecord(payload) && typeof payload.refresh_token === 'string'
      ? payload.refresh_token
      : null;
  const claims = parseSupabaseAccessTokenClaims(accessToken);
  if (
    !isRecord(payload) ||
    user === null ||
    accessToken === null ||
    nextRefreshToken === null ||
    claims === null ||
    claims.subject !== expectedSubject ||
    user.id !== expectedSubject ||
    nextRefreshToken.length === 0 ||
    typeof payload.expires_in !== 'number' ||
    !Number.isFinite(payload.expires_in) ||
    payload.expires_in <= 0
  ) {
    // A parsed 2xx response is an authoritative refresh result. If its
    // identity/session envelope is malformed or foreign, retaining the prior
    // local session would turn a protocol-integrity failure into owner access.
    // Body-read/network failures above remain ambiguous because the server may
    // have rotated the token without the client receiving the response.
    throw new SupabaseControlledRefreshTerminalError('invalid_success_response');
  }

  const session = {
    ...payload,
    access_token: accessToken,
    refresh_token: nextRefreshToken,
    expires_at: claims.expiresAt,
    token_type: 'bearer',
    user,
  } as unknown as Session;
  await authStorage.setItem(authStorageKey, JSON.stringify(session));
  return session;
}

export async function clearPersistedSupabaseSession(): Promise<void> {
  const results = await Promise.allSettled([
    authStorage.removeItem(authStorageKey),
    authStorage.removeItem(`${authStorageKey}-code-verifier`),
  ]);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`SUPABASE_AUTH_STORAGE_CLEAR_FAILED:${failures.length}`);
  }
}

// docs/01 §5 client flags. Storage is the encrypted LargeSecureStore.
// BLOCKED: B-SUPABASE. Url/key read from env placeholders until the project exists.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  global: { fetch: remotelyAdmittedFetch },
  auth: {
    storage: authStorage,
    storageKey: authStorageKey,
    // AuthProvider starts refresh after the account-deletion recovery gate opens.
    // Keeping construction passive prevents a persisted session from refreshing
    // while a durable deletion request is still unresolved.
    autoRefreshToken: false,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
  },
});

/** Verify the encrypted candidate without auth-js performing an implicit refresh. */
export async function getPersistedSupabaseUser() {
  const candidate = await readPersistedSupabaseSessionCandidate();
  if (!candidate) return { data: { user: null }, error: null } as const;
  return supabase.auth.getUser(candidate.access_token);
}
