import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { AccountDeletionBarrierTransport } from './accountDeletionBarrier';
import { env, isSupabaseConfigured } from '@/lib/env';

const E2E_USER_ID = '00000000-0000-4000-8000-0000000000a1';
const E2E_EMAIL = 'tas.account-a.e2e@example.com';
const E2E_OWNER_KEY = 'routinekind.e2e.accountIsolationOwner.v1';
const E2E_SIGNED_OUT_KEY = 'routinekind.e2e.accountIsolationSignedOut.v1';

export type AccountIsolationE2EFixture = {
  clearDelayMs: number;
  clearFailures: number;
  mode: 'signout_clear_retry' | 'cross_owner';
  session: Session | null;
};

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function fixtureSession(owner: 'a' | 'b' = 'a', crossOwner = false): Session {
  const userId = owner === 'a' ? E2E_USER_ID : '00000000-0000-4000-8000-0000000000b2';
  const payload = btoa(JSON.stringify({ sub: userId, session_id: userId, exp: 4000000000 }));
  const createdAt = '2026-07-10T00:00:00.000Z';
  return {
    access_token: crossOwner
      ? `e30.${payload.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}.synthetic`
      : 'e2e-account-a-access-token',
    expires_in: 3600,
    refresh_token: 'e2e-account-a-refresh-token',
    token_type: 'bearer',
    user: {
      app_metadata: { provider: 'email', providers: ['email'] },
      aud: 'authenticated',
      created_at: createdAt,
      email: owner === 'a' ? E2E_EMAIL : 'tas.account-b.e2e@example.com',
      id: userId,
      identities: [],
      is_anonymous: false,
      role: 'authenticated',
      updated_at: createdAt,
      user_metadata: {},
    },
  };
}

export function getAccountIsolationE2EFixture(
  isDev = isDevRuntime(),
  appEnvironment = env.appEnvironment,
  supabaseConfigured = isSupabaseConfigured,
  platform = Platform.OS,
): AccountIsolationE2EFixture | null {
  if (!isDev || platform !== 'web' || appEnvironment !== 'development' || supabaseConfigured)
    return null;
  const mode = process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION?.trim().toLowerCase();
  if (mode !== 'signout_clear_retry' && mode !== 'cross_owner') return null;
  return {
    clearDelayMs: 700,
    clearFailures: 2,
    mode,
    session:
      fixtureStorage()?.getItem(E2E_SIGNED_OUT_KEY) === '1'
        ? null
        : fixtureSession(
            mode === 'cross_owner' && fixtureStorage()?.getItem(E2E_OWNER_KEY) === 'b' ? 'b' : 'a',
          ),
  };
}

// The synthetic transport must retain its terminal logout across document
// reloads. This state is reachable only behind the same DEV/unconfigured gate.
function fixtureStorage() {
  return (globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage;
}

export function completeAccountIsolationE2ESignOut(): void {
  if (getAccountIsolationE2EFixture()) {
    fixtureStorage()?.setItem(E2E_SIGNED_OUT_KEY, '1');
  }
}

// Synthetic Auth singleton/event transport only. Persist the candidate before
// emitting, just as a provider may change before local cleanup can complete.
// No owner/age/consent/private-data records are written by this transport.
export function accountIsolationE2EEvent(owner: 'a' | 'b'): Session {
  if (getAccountIsolationE2EFixture()?.mode !== 'cross_owner' || !['a', 'b'].includes(owner)) {
    throw new Error('E2E_ACCOUNT_TRANSPORT_DISABLED');
  }
  fixtureStorage()?.setItem(E2E_OWNER_KEY, owner);
  return fixtureSession(owner, true);
}

export function accountIsolationE2EPreflightTransport():
  | AccountDeletionBarrierTransport
  | undefined {
  if (getAccountIsolationE2EFixture()?.mode !== 'cross_owner') return undefined;
  return async (input, init) => {
    const request = new Request(input, init);
    // Exercise the real permit and bounded response parser. This attests only
    // the local synthetic identity, never provider authentication or commerce.
    const candidate = getAccountIsolationE2EFixture()?.session;
    if (
      !candidate ||
      request.headers.get('Authorization') !== `Bearer ${candidate.access_token}` ||
      (await request.text()) !== JSON.stringify({ action: 'preflight' })
    ) {
      return new Response(JSON.stringify({ error: 'ACCOUNT_DELETION_SESSION_REJECTED' }), {
        status: 401,
      });
    }
    return new Response(JSON.stringify({ status: 'clear', ownerSubject: candidate.user.id }), {
      status: 200,
    });
  };
}
