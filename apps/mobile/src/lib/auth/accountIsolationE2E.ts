import type { Session } from '@supabase/supabase-js';

const E2E_USER_ID = '00000000-0000-4000-8000-0000000000a1';
const E2E_EMAIL = 'tas.account-a.e2e@example.com';

export type AccountIsolationE2EFixture = {
  clearDelayMs: number;
  failFirstClear: boolean;
  mode: 'signout_clear_retry';
  session: Session;
};

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function fixtureSession(): Session {
  const createdAt = '2026-07-10T00:00:00.000Z';
  return {
    access_token: 'e2e-account-a-access-token',
    expires_in: 3600,
    refresh_token: 'e2e-account-a-refresh-token',
    token_type: 'bearer',
    user: {
      app_metadata: { provider: 'email', providers: ['email'] },
      aud: 'authenticated',
      created_at: createdAt,
      email: E2E_EMAIL,
      id: E2E_USER_ID,
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
): AccountIsolationE2EFixture | null {
  if (!isDev) return null;
  const mode = process.env.EXPO_PUBLIC_E2E_ACCOUNT_ISOLATION?.trim().toLowerCase();
  if (mode !== 'signout_clear_retry') return null;
  return {
    clearDelayMs: 700,
    failFirstClear: true,
    mode,
    session: fixtureSession(),
  };
}
