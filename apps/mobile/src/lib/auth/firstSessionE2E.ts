import type { Session } from '@supabase/supabase-js';

import { env, isSupabaseConfigured, type AppEnvironment } from '@/lib/env';

// Match the established unconfigured-backend health owner so publishing the
// E2E session cannot create an artificial owner transition after a signed-out
// protected-route probe.
const FIRST_SESSION_E2E_USER_ID = 'local-device-unclaimed';

export type FirstSessionE2EFixture = Readonly<{
  mode: 'anonymous_owner';
  session: Session;
}>;

let publishedSession: Session | null = null;

type FirstSessionE2EFixtureOptions = Readonly<{
  appEnvironment?: AppEnvironment;
  isDev?: boolean;
  mode?: string;
  supabaseConfigured?: boolean;
}>;

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function fixtureSession(): Session {
  const createdAt = '2026-07-26T00:00:00.000Z';
  return {
    access_token: 'e2e-first-session-local-access-token',
    expires_in: 3600,
    refresh_token: 'e2e-first-session-local-refresh-token',
    token_type: 'bearer',
    user: {
      app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
      aud: 'authenticated',
      created_at: createdAt,
      id: FIRST_SESSION_E2E_USER_ID,
      identities: [],
      is_anonymous: true,
      role: 'authenticated',
      updated_at: createdAt,
      user_metadata: {},
    },
  };
}

/**
 * Local-only auth identity for the real first-session browser flow.
 *
 * This cannot activate in a configured auth environment or a release runtime.
 * AuthProvider still has to claim the durable local owner before it may publish
 * this session to consumers.
 */
export function getFirstSessionE2EFixture(
  options: FirstSessionE2EFixtureOptions = {},
): FirstSessionE2EFixture | null {
  const isDev = options.isDev ?? isDevRuntime();
  const appEnvironment = options.appEnvironment ?? env.appEnvironment;
  const supabaseConfigured = options.supabaseConfigured ?? isSupabaseConfigured;
  const mode = (options.mode ?? process.env.EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH)
    ?.trim()
    .toLowerCase();

  if (
    !isDev ||
    appEnvironment !== 'development' ||
    supabaseConfigured ||
    mode !== 'anonymous_owner'
  ) {
    return null;
  }

  return { mode, session: fixtureSession() };
}

/**
 * The age receipt swaps Expo Router's bootstrap and protected navigators. Web
 * may remount the root provider during that handoff, so the exact dev fixture
 * retains its already-owner-claimed session in memory for the life of the
 * process. No release, configured backend, or persisted storage path can read
 * this value.
 */
export function publishFirstSessionE2ESession(fixture: FirstSessionE2EFixture): void {
  publishedSession = fixture.session;
}

export function getPublishedFirstSessionE2ESession(
  fixture: FirstSessionE2EFixture | null,
): Session | null {
  if (!fixture || publishedSession?.user.id !== fixture.session.user.id) return null;
  return publishedSession;
}

export function clearPublishedFirstSessionE2ESession(): void {
  publishedSession = null;
}
