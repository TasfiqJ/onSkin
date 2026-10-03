import type { Session, User } from '@supabase/supabase-js';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountDeletionIntakeHold,
  isAccountActivityBlockedForDeletion,
  isAccountDeletionIntakeHoldActive,
  setAccountActivityBlockedForDeletion,
} from '@/features/settings/accountDeletionBarrier';
import {
  accountPublicationSnapshot,
  closeRevenueCatPublication,
  hasActiveRevenueCatPublication,
  startRevenueCatDeletionQuiesce,
} from '@/lib/iap/revenuecat';

import { AuthProvider, useAuth } from './AuthProvider';
import { runAccountGenerationOperation } from './accountGeneration';

vi.mock('expo-network', () => ({
  getNetworkStateAsync: vi.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
}));

type AuthStateListener = (event: string, session: Session | null) => void;
type TransportEvent = Readonly<{
  action: string;
  subject: string | null;
}>;

const h = vi.hoisted(() => {
  const state = {
    appStateListener: null as ((state: 'active' | 'background' | 'inactive' | null) => void) | null,
    authStateListener: null as AuthStateListener | null,
    capabilitySeed: 0,
    nativeConfigured: false,
    releaseFenceGate: null as {
      promise: Promise<Response>;
      resolve: (response: Response) => void;
    } | null,
    transportEvents: [] as TransportEvent[],
  };
  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((listener: AuthStateListener) => {
      state.authStateListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    refreshSession: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  };
  const appState = {
    currentState: 'active' as 'active' | 'background' | 'inactive' | null,
    addEventListener: vi.fn(
      (_event: string, listener: (state: 'active' | 'background' | 'inactive' | null) => void) => {
        state.appStateListener = listener;
        return { remove: vi.fn() };
      },
    ),
  };
  const purchases = {
    ENTITLEMENT_VERIFICATION_MODE: { INFORMATIONAL: 'INFORMATIONAL' },
    IN_APP_MESSAGE_TYPE: {
      BILLING_ISSUE: 0,
      PRICE_INCREASE_CONSENT: 1,
      GENERIC: 2,
      WIN_BACK_OFFER: 3,
    },
    LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
    PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR' },
    addCustomerInfoUpdateListener: vi.fn(),
    configure: vi.fn(() => {
      state.nativeConfigured = true;
    }),
    getCustomerInfo: vi.fn(),
    invalidateCustomerInfoCache: vi.fn(async () => {}),
    isConfigured: vi.fn(async () => state.nativeConfigured),
    logIn: vi.fn(async () => ({ created: false })),
    removeCustomerInfoUpdateListener: vi.fn(),
    setLogLevel: vi.fn(async () => {}),
    showInAppMessages: vi.fn(async (_messageTypes?: number[]) => {}),
  };
  return {
    appState,
    auth,
    clearPersistedSession: vi.fn(async () => {}),
    clearStoreEntitlement: vi.fn(async () => 'committed' as const),
    devWarn: vi.fn(),
    entitlementOwnerContextForUser: vi.fn(async () => ({ ownerBinding: 'a'.repeat(64) })),
    fetchTransport: vi.fn(),
    loadEntitlement: vi.fn(async () => null),
    prepareLocalDataForSession: vi.fn(),
    publishCustomerInfoEvidence: vi.fn(async () => ({
      status: 'committed' as const,
      disposition: 'applied' as const,
      requiresUncachedRefresh: false,
      snapshot: { activeStoreEntitlement: null, hasConflict: false },
    })),
    purchases,
    setEntitlementQueryData: vi.fn(),
    state,
  };
});

vi.mock('react-native', () => ({ AppState: h.appState, Platform: { OS: 'ios' } }));
vi.mock('react-native-purchases', () => ({ default: h.purchases }));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => {
    h.state.capabilitySeed += 1;
    return new Uint8Array(length).fill(h.state.capabilitySeed);
  }),
}));
vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: vi.fn(async () => undefined),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  clearLastNotificationResponseAsync: vi.fn(async () => undefined),
  dismissAllNotificationsAsync: vi.fn(async () => undefined),
  dismissNotificationAsync: vi.fn(async () => undefined),
  scheduleNotificationAsync: vi.fn(async () => 'notice'),
  setBadgeCountAsync: vi.fn(async () => true),
}));
vi.mock('expo-router', () => ({ router: { replace: vi.fn() } }));
vi.mock('@/features/subscription/store', () => ({
  clearStoreEntitlementIfRevenueCatVerifiedEmpty: h.clearStoreEntitlement,
  entitlementOwnerContextForUser: h.entitlementOwnerContextForUser,
  loadEntitlement: h.loadEntitlement,
  publishCustomerInfoEvidence: h.publishCustomerInfoEvidence,
  saveVerifiedEntitlement: vi.fn(async (entitlement: unknown) => entitlement),
}));
vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: vi.fn(),
  endEncryptedPhotoAccountBoundary: vi.fn(),
  waitForEncryptedPhotoWritesToSettle: vi.fn(async () => {}),
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({ purgeSensitiveImageMemory: vi.fn() }));
vi.mock('@/features/notifications/deliver', () => ({ rescheduleReminders: vi.fn() }));
vi.mock('@/lib/env', () => ({
  env: {
    appEnvironment: 'production',
    revenueCatAndroidKey: '',
    revenueCatEntitlementId: 'pro',
    revenueCatIosKey: 'appl_integration_key',
    revenueCatTestStoreKey: '',
    supabasePublishableKey: 'sb_publishable_test',
    supabaseUrl: 'https://example.supabase.co',
  },
  isSupabaseConfigured: true,
}));
vi.mock('@/lib/errors/userFacing', () => ({ AUTH_UNAVAILABLE_MESSAGE: 'unavailable' }));
vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: vi.fn() }));
vi.mock('@/lib/analytics/publicationGate', () => ({ closeAnalyticsPublication: vi.fn() }));
vi.mock('@/lib/observability/safeLog', () => ({ devWarn: h.devWarn }));
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: {
    cancelQueries: vi.fn(async () => {}),
    clear: vi.fn(),
    invalidateQueries: vi.fn(async () => {}),
    setQueryData: h.setEntitlementQueryData,
  },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: vi.fn(),
  endPrivateKVAccountBoundary: vi.fn(),
  removePrivateItem: vi.fn(async () => {}),
  waitForPrivateKVWritesToSettle: vi.fn(async () => {}),
}));
vi.mock('../supabase/client', () => ({
  clearPersistedSupabaseSession: h.clearPersistedSession,
  isSupabaseControlledRefreshTerminalError: () => false,
  readPersistedSupabaseSessionCandidate: async () => {
    const result = await h.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  },
  refreshPersistedSupabaseSessionCandidate: async (refreshToken: string) => {
    const result = await h.auth.refreshSession({ refresh_token: refreshToken });
    if (result.error) throw result.error;
    if (!result.data.session) throw new Error('SUPABASE_CONTROLLED_REFRESH_RESPONSE_INVALID');
    return result.data.session;
  },
  supabase: { auth: h.auth },
}));
vi.mock('./accountIsolationE2E', () => ({ getAccountIsolationE2EFixture: () => null }));
vi.mock('./accountUpgrade', () => ({
  authenticateWithAppleCredential: vi.fn(),
  authenticateWithProviderToken: vi.fn(),
  requestEmailAccountCode: vi.fn(),
  verifyEmailAccountCode: vi.fn(),
}));
vi.mock('./authDerivedCleanupRequired', () => ({
  clearAuthDerivedCleanupRequired: vi.fn(async () => {}),
  markAuthDerivedCleanupRequired: vi.fn(async () => {}),
  readAuthDerivedCleanupRequired: vi.fn(async () => false),
}));
vi.mock('./apple', () => ({ getAppleIdToken: vi.fn() }));
vi.mock('./appleCredentialQuarantine', () => ({
  clearAppleCredentialQuarantine: vi.fn(async () => {}),
  isAppleCredentialQuarantined: vi.fn(async () => false),
  markAppleCredentialQuarantined: vi.fn(async () => {}),
}));
vi.mock('./appleCredentialLifecycle', () => ({
  checkAppleCredentialForSession: vi.fn(async () => ({ status: 'not_applicable' })),
  hasAppleIdentity: vi.fn(() => false),
  monitorAppleCredentialLifecycle: vi.fn(() => vi.fn()),
  monitorAppleCredentialRevocation: vi.fn(() => vi.fn()),
}));
vi.mock('./google', () => ({ getGoogleIdToken: vi.fn() }));
vi.mock('./localAccountIsolation', () => ({
  clearAccountIsolatedState: vi.fn(async () => {}),
  prepareLocalDataForSession: h.prepareLocalDataForSession,
}));
vi.mock('./revokedCredentialActivity', () => ({ clearAuthDerivedLocalActivity: vi.fn() }));
vi.mock('./sessionOwner', () => ({
  localDataOwnerBinding: vi.fn(async () => 'integration-owner-binding'),
  markLocalDataCleanupRequired: vi.fn(async () => {}),
  preserveLocalDataForForcedSignOut: vi.fn(async () => 'retain'),
  readLocalDataOwnerProof: vi.fn(async () => ({
    kind: 'owned',
    ownerBinding: 'integration-owner-binding',
    retained: false,
  })),
  readLocalDataOwnership: vi.fn(async () => 'match'),
}));
vi.mock('./sessionInvalidation', () => ({
  clearRejectedSessionActivityDurably: vi.fn(
    async (dependencies: Record<string, (() => unknown) | undefined>) => {
      await dependencies.markAuthDerivedCleanupRequired?.();
      await dependencies.signOut?.();
      await dependencies.clearPersistedSession?.();
      await dependencies.clearAuthDerivedActivity?.();
      await dependencies.clearAuthDerivedCleanupRequired?.();
    },
  ),
}));

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function jwt(subject: string, sessionId: string, expiresAt: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: subject, session_id: sessionId, exp: expiresAt }),
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function decodeSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function session(userId: string, sessionId: string, label: string): Session {
  const expiresAt = 4_000_000_000;
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${label}@example.test`,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-01-01T00:00:00.000Z',
  } as User;
  return {
    access_token: jwt(userId, sessionId, expiresAt),
    refresh_token: `refresh-${label}`,
    expires_at: expiresAt,
    expires_in: expiresAt - Math.floor(Date.now() / 1_000),
    token_type: 'bearer',
    user,
  };
}

function response(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyCustomerInfo() {
  return {
    entitlements: { active: {}, all: {}, verification: 'VERIFIED' },
    managementURL: null,
    originalAppUserId: USER_A,
    requestDate: '2026-07-14T00:00:00.000Z',
    subscriptionsByProductIdentifier: {},
  };
}

function installTransport(): void {
  h.fetchTransport.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const body = (await request.clone().json()) as { action?: unknown };
    const action = typeof body.action === 'string' ? body.action : 'invalid';
    const authorization = request.headers.get('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const subject = decodeSubject(token);
    h.state.transportEvents.push({ action, subject });

    if (action === 'preflight') {
      if (!subject) throw new Error('missing preflight subject');
      return response({ status: 'clear', ownerSubject: subject });
    }
    if (action === 'publication_reserve') return response({ status: 'reserved' });
    if (action === 'publication_activate' || action === 'publication_renew') {
      return response({ status: 'active' });
    }
    if (action === 'publication_release') {
      return h.state.releaseFenceGate?.promise ?? response({ status: 'released' });
    }
    throw new Error(`unexpected transport action: ${action}`);
  });
  vi.stubGlobal('fetch', h.fetchTransport);
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });
}

let renderer: ReactTestRenderer | null = null;
let currentAuth: ReturnType<typeof useAuth> | null = null;
let activeReleases: (() => void)[] = [];

function Probe() {
  const auth = useAuth();
  useEffect(() => {
    currentAuth = auth;
  }, [auth]);
  return null;
}

async function mountOwner(owner: Session): Promise<void> {
  h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
  await act(async () => {
    renderer = create(createElement(AuthProvider, null, createElement(Probe)));
  });
  await vi.waitFor(() => {
    expect(h.devWarn.mock.calls).toEqual([]);
    expect(currentAuth?.session?.access_token).toBe(owner.access_token);
    expect(accountPublicationSnapshot()).toMatchObject({
      state: 'active',
      subject: owner.user.id,
    });
    expect(h.purchases.addCustomerInfoUpdateListener).toHaveBeenCalledOnce();
  });
}

async function emitAuthState(event: string, nextSession: Session | null): Promise<void> {
  await act(async () => {
    h.state.authStateListener?.(event, nextSession);
    await Promise.resolve();
  });
}

async function beginDeletionHandoff(
  ownerId: string,
  holdCount = 1,
): Promise<{
  publicationQuiescence: Promise<void>;
  releases: (() => void)[];
  signal: AbortSignal;
  synchronousSnapshot: ReturnType<typeof accountPublicationSnapshot>;
}> {
  return runAccountGenerationOperation((lease) => {
    lease.assertCurrent();
    const releases = Array.from({ length: holdCount }, () => beginAccountDeletionIntakeHold());
    activeReleases.push(...releases);
    const synchronousSnapshot = accountPublicationSnapshot();
    const publicationQuiescence = startRevenueCatDeletionQuiesce(ownerId);
    return { publicationQuiescence, releases, signal: lease.signal, synchronousSnapshot };
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  currentAuth = null;
  activeReleases = [];
  h.state.appStateListener = null;
  h.state.authStateListener = null;
  h.state.capabilitySeed = 0;
  h.state.nativeConfigured = false;
  h.state.releaseFenceGate = null;
  h.state.transportEvents.length = 0;
  h.appState.currentState = 'active';
  vi.clearAllMocks();
  h.auth.getSession.mockReset();
  h.auth.refreshSession.mockReset();
  h.auth.signOut.mockReset().mockResolvedValue({ error: null });
  h.prepareLocalDataForSession
    .mockReset()
    .mockImplementation(
      async (
        _previousUserId: string | null,
        _targetUserId: string | null,
        _dependencies: unknown,
        _beforeClear?: () => Promise<void>,
      ) => {
        return { cleared: false, resetRoute: false };
      },
    );
  h.purchases.getCustomerInfo.mockReset().mockImplementation(async () => emptyCustomerInfo());
  setAccountActivityBlockedForDeletion(false);
  vi.stubGlobal('__DEV__', false);
  installTransport();
});

afterEach(async () => {
  h.state.releaseFenceGate?.resolve(response({ status: 'released' }));
  // A resolved gate owns one Response body. Clear it before unmount triggers a
  // second publication release so the transport creates a fresh Response
  // instead of reusing an already-consumed body and poisoning the next test's
  // fail-closed controller state.
  h.state.releaseFenceGate = null;
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = null;
  }
  for (const release of activeReleases) release();
  activeReleases = [];
  await closeRevenueCatPublication('shutdown').catch(() => {});
  setAccountActivityBlockedForDeletion(false);
  vi.unstubAllGlobals();
});

describe('mounted deletion-intake publication integration', () => {
  it('closes synchronously, ignores stale A token state, and publishes stable B only after release proof', async () => {
    const owner = session(USER_A, SESSION_A, 'owner-a');
    const replacement = session(USER_B, SESSION_B, 'replacement-b');
    await mountOwner(owner);
    h.state.transportEvents.length = 0;

    const releaseFence = deferred<Response>();
    h.state.releaseFenceGate = releaseFence;
    const handoff = await beginDeletionHandoff(USER_A);

    expect(handoff.signal.aborted).toBe(true);
    expect(handoff.synchronousSnapshot).toMatchObject({
      state: 'draining',
      subject: USER_A,
      sessionId: SESSION_A,
    });
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
    expect(hasActiveRevenueCatPublication(USER_A, owner.access_token)).toBe(false);

    await emitAuthState('SIGNED_IN', replacement);
    await emitAuthState('TOKEN_REFRESHED', owner);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: replacement }, error: null });
    await vi.waitFor(() =>
      expect(h.state.transportEvents.some(({ action }) => action === 'publication_release')).toBe(
        true,
      ),
    );

    await act(async () => {
      handoff.releases[0]?.();
      await Promise.resolve();
    });
    expect(currentAuth?.session).toBeNull();
    expect(h.auth.getSession).toHaveBeenCalledTimes(1);
    expect(
      h.state.transportEvents.some(
        ({ action, subject }) => action === 'preflight' && subject === USER_B,
      ),
    ).toBe(false);

    releaseFence.resolve(response({ status: 'released' }));
    await handoff.publicationQuiescence;
    await vi.waitFor(() => {
      expect(currentAuth?.session?.access_token).toBe(replacement.access_token);
      expect(accountPublicationSnapshot()).toMatchObject({
        state: 'active',
        subject: USER_B,
        sessionId: SESSION_B,
      });
    });

    const releaseIndex = h.state.transportEvents.findIndex(
      ({ action }) => action === 'publication_release',
    );
    const preflightBIndex = h.state.transportEvents.findIndex(
      ({ action, subject }) => action === 'preflight' && subject === USER_B,
    );
    const reserveBIndex = h.state.transportEvents.findIndex(
      ({ action, subject }) => action === 'publication_reserve' && subject === USER_B,
    );
    const activateBIndex = h.state.transportEvents.findIndex(
      ({ action, subject }) => action === 'publication_activate' && subject === USER_B,
    );
    expect(releaseIndex).toBeGreaterThanOrEqual(0);
    expect(preflightBIndex).toBeGreaterThan(releaseIndex);
    expect(reserveBIndex).toBeGreaterThan(preflightBIndex);
    expect(activateBIndex).toBeGreaterThan(reserveBIndex);
    expect(
      h.state.transportEvents.filter(
        ({ action, subject }) => action === 'preflight' && subject === USER_A,
      ),
    ).toHaveLength(0);
    expect(h.purchases.logIn).toHaveBeenCalledWith(USER_B);
  });

  it('never resumes Auth or provider publication after authority hands off to the durable block', async () => {
    const owner = session(USER_A, SESSION_A, 'owner-a');
    const replacement = session(USER_B, SESSION_B, 'replacement-b');
    await mountOwner(owner);
    h.state.transportEvents.length = 0;

    const handoff = await beginDeletionHandoff(USER_A);
    await emitAuthState('SIGNED_IN', replacement);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: replacement }, error: null });
    setAccountActivityBlockedForDeletion(true);

    await act(async () => {
      handoff.releases[0]?.();
      await Promise.resolve();
    });
    await handoff.publicationQuiescence;
    await flush();

    expect(isAccountDeletionIntakeHoldActive()).toBe(false);
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
    expect(currentAuth?.session).toBeNull();
    expect(accountPublicationSnapshot()).toMatchObject({
      state: 'closed',
      subject: null,
      sessionId: null,
    });
    expect(h.auth.getSession).toHaveBeenCalledTimes(1);
    expect(
      h.state.transportEvents.some(
        ({ action, subject }) => action === 'preflight' && subject === USER_B,
      ),
    ).toBe(false);

    await act(async () => currentAuth?.retrySessionBoundary());
    await flush();
    expect(currentAuth?.session).toBeNull();
    expect(accountPublicationSnapshot().state).toBe('closed');
    expect(h.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('does not reopen early when one owner releases a ref-counted intake hold', async () => {
    const owner = session(USER_A, SESSION_A, 'owner-a');
    const replacement = session(USER_B, SESSION_B, 'replacement-b');
    await mountOwner(owner);
    h.state.transportEvents.length = 0;

    const handoff = await beginDeletionHandoff(USER_A, 2);
    await emitAuthState('SIGNED_IN', replacement);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: replacement }, error: null });
    await handoff.publicationQuiescence;

    await act(async () => {
      handoff.releases[0]?.();
      await Promise.resolve();
    });
    expect(isAccountDeletionIntakeHoldActive()).toBe(true);
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
    expect(currentAuth?.session).toBeNull();
    expect(h.auth.getSession).toHaveBeenCalledTimes(1);
    expect(
      h.state.transportEvents.some(
        ({ action, subject }) => action === 'preflight' && subject === USER_B,
      ),
    ).toBe(false);

    await act(async () => {
      handoff.releases[1]?.();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(isAccountDeletionIntakeHoldActive()).toBe(false);
      expect(currentAuth?.session?.access_token).toBe(replacement.access_token);
      expect(accountPublicationSnapshot()).toMatchObject({ state: 'active', subject: USER_B });
    });
    expect(h.auth.getSession).toHaveBeenCalledTimes(2);
  });
});
