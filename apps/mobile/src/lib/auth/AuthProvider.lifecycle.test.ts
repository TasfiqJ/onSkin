import {
  AuthApiError,
  AuthInvalidTokenResponseError,
  AuthRefreshDiscardedError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthProvider';

type AppStateValue = 'active' | 'background' | 'inactive' | null;
type AppStateListener = (state: AppStateValue) => void;
type OnlineListener = (online: boolean) => void;
type AuthStateListener = (event: string, session: Session | null) => void;
type AppleCheckResult =
  | { status: 'blocked'; reason: 'credential_check_failed' | 'credential_state_unknown' }
  | { status: 'invalid'; reason: 'credential_not_found' | 'credential_revoked' }
  | { status: 'not_applicable' }
  | { status: 'valid' };
type LocalOwnerProof =
  | { kind: 'cleanup_required'; ownerBinding: string | null }
  | { kind: 'owned'; ownerBinding: string; retained: boolean }
  | { kind: 'quarantined' }
  | { kind: 'unclaimed' };

const h = vi.hoisted(() => {
  const state = {
    admissionPaused: false,
    activeSessionId: null as string | null,
    activeUserId: null as string | null,
    appStateListener: null as AppStateListener | null,
    authStateListener: null as AuthStateListener | null,
    customerInfoListener: null as ((customerInfo: unknown) => void | Promise<void>) | null,
    customerInfoListenerError: null as
      | ((error: unknown, customerInfo: unknown) => void | Promise<void>)
      | null,
    deletionBlocked: false,
    deletionIntakeHoldActive: false,
    deletionIntakeHoldListener: null as ((active: boolean) => void) | null,
    events: [] as string[],
    online: true,
    onlineListener: null as OnlineListener | null,
    publicationClosedListener: null as ((reason: string) => void) | null,
    remoteState: 'closed' as 'active' | 'candidate' | 'closed' | 'deletion',
    remoteToken: null as string | null,
  };
  const auth = {
    admin: { signOut: vi.fn() },
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((listener: AuthStateListener) => {
      state.authStateListener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    refreshSession: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
    startAutoRefresh: vi.fn(() => state.events.push('auto:start')),
    stopAutoRefresh: vi.fn(() => state.events.push('auto:stop')),
  };
  const appState = {
    currentState: 'active' as AppStateValue,
    addEventListener: vi.fn((_event: string, listener: AppStateListener) => {
      state.appStateListener = listener;
      return { remove: vi.fn() };
    }),
  };
  const onlineManager = {
    isOnline: vi.fn(() => state.online),
    subscribe: vi.fn((listener: OnlineListener) => {
      state.onlineListener = listener;
      return () => {
        if (state.onlineListener === listener) state.onlineListener = null;
      };
    }),
  };
  return {
    state,
    auth,
    appState,
    onlineManager,
    clearAuthDerivedCleanupRequired: vi.fn(async () => {}),
    checkAppleCredentialForSession: vi.fn<(_user: User) => Promise<AppleCheckResult>>(async () => ({
      status: 'not_applicable',
    })),
    clearPersistedSession: vi.fn(async () => {}),
    fetchBarrier: vi.fn(),
    prepareLocalDataForSession: vi.fn(async () => ({ cleared: false, resetRoute: false })),
    assertRevenueCatResultCurrent: vi.fn(),
    clearStoreEntitlement: vi.fn(async () => 'committed' as const),
    customerInfoToStoredEntitlement: vi.fn<(customerInfo: unknown) => unknown | null>(() => null),
    entitlementOwnerContextForUser: vi.fn(async () => ({ ownerBinding: 'a'.repeat(64) })),
    getCustomerInfo: vi.fn<() => Promise<unknown | null>>(async () => null),
    getUncachedCustomerInfo: vi.fn<() => Promise<unknown | null>>(async () => null),
    invalidateEntitlementQueries: vi.fn(async () => {}),
    loadEntitlement: vi.fn(async () => null),
    localDataOwnerBinding: vi.fn(async (userId: string) => `binding:${userId}`),
    markAuthDerivedCleanupRequired: vi.fn(async () => {}),
    readAuthDerivedCleanupRequired: vi.fn(async () => false),
    readLocalDataOwnerProof: vi.fn<() => Promise<LocalOwnerProof>>(),
    publishCustomerInfoEvidence: vi.fn(),
    renewRevenueCatPublication: vi.fn<(userId: string, token: string) => Promise<void>>(),
    reserveRevenueCatPublication: vi.fn<(userId: string, token: string) => Promise<void>>(),
    retryRevenueCatPublicationDrain: vi.fn(async () => {
      state.events.push('drain:retry');
    }),
    runRevenueCatResultWrite: vi.fn(async (_result: unknown, write: () => Promise<void>) =>
      write(),
    ),
    saveVerifiedEntitlement: vi.fn(),
    setEntitlementQueryData: vi.fn(),
    subscribeToCustomerInfoUpdates: vi.fn(
      async (
        listener: (customerInfo: unknown) => void | Promise<void>,
        onError?: (error: unknown, customerInfo: unknown) => void | Promise<void>,
      ) => {
        state.customerInfoListener = listener;
        state.customerInfoListenerError = onError ?? null;
        return () => {
          if (state.customerInfoListener === listener) state.customerInfoListener = null;
          if (state.customerInfoListenerError === onError) state.customerInfoListenerError = null;
        };
      },
    ),
  };
});

function decodeClaim(token: string, claim: 'sub' | 'session_id'): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as Record<string, unknown> | undefined;
    return typeof payload?.[claim] === 'string' ? payload[claim] : null;
  } catch {
    return null;
  }
}

vi.mock('react-native', () => ({ AppState: h.appState }));
vi.mock('@tanstack/react-query', () => ({ onlineManager: h.onlineManager }));
vi.mock('expo-notifications', () => ({ cancelAllScheduledNotificationsAsync: vi.fn() }));
vi.mock('expo-router', () => ({ router: { replace: vi.fn() } }));
vi.mock('@/features/subscription/store', () => ({
  clearStoreEntitlementIfRevenueCatVerifiedEmpty: h.clearStoreEntitlement,
  entitlementOwnerContextForUser: h.entitlementOwnerContextForUser,
  loadEntitlement: h.loadEntitlement,
  publishCustomerInfoEvidence: h.publishCustomerInfoEvidence,
  saveVerifiedEntitlement: h.saveVerifiedEntitlement,
}));
vi.mock('@/features/settings/accountDeletionBarrier', () => ({
  isAccountActivityBlockedForDeletion: () => h.state.deletionBlocked,
  isAccountDeletionIntakeHoldActive: () => h.state.deletionIntakeHoldActive,
  subscribeToAccountDeletionIntakeHold: (listener: (active: boolean) => void) => {
    h.state.deletionIntakeHoldListener = listener;
    return () => {
      if (h.state.deletionIntakeHoldListener === listener) {
        h.state.deletionIntakeHoldListener = null;
      }
    };
  },
}));
vi.mock('@/features/photos/encryptedStorage', () => ({
  beginEncryptedPhotoAccountBoundary: vi.fn(),
  endEncryptedPhotoAccountBoundary: vi.fn(),
  waitForEncryptedPhotoWritesToSettle: vi.fn(),
}));
vi.mock('@/features/photos/sensitiveImageMemory', () => ({ purgeSensitiveImageMemory: vi.fn() }));
vi.mock('@/features/notifications/deliver', () => ({ rescheduleReminders: vi.fn() }));
vi.mock('@/lib/env', () => ({
  env: {
    supabasePublishableKey: 'publishable-key',
    supabaseUrl: 'https://project.supabase.co',
  },
  isSupabaseConfigured: true,
}));
vi.mock('@/lib/errors/userFacing', () => ({ AUTH_UNAVAILABLE_MESSAGE: 'unavailable' }));
vi.mock('@/lib/analytics/track', () => ({ resetAnalyticsIdentity: vi.fn() }));
vi.mock('@/lib/iap/revenuecat', () => ({
  activateRevenueCatPublication: vi.fn(async (userId: string, token: string) => {
    h.state.events.push(`activate:${token}`);
    h.state.activeUserId = userId;
    h.state.activeSessionId = decodeClaim(token, 'session_id');
  }),
  assertRevenueCatResultCurrent: h.assertRevenueCatResultCurrent,
  closeRevenueCatPublication: vi.fn((reason: string) => {
    h.state.events.push(`close:${reason}`);
    h.state.activeUserId = null;
    h.state.activeSessionId = null;
    return Promise.resolve();
  }),
  configureRevenueCat: vi.fn(),
  customerInfoToStoredEntitlement: h.customerInfoToStoredEntitlement,
  getCustomerInfo: h.getCustomerInfo,
  getUncachedCustomerInfo: h.getUncachedCustomerInfo,
  hasActiveRevenueCatPublication: vi.fn(
    (userId: string, token: string) =>
      h.state.activeUserId === userId &&
      h.state.activeSessionId === decodeClaim(token, 'session_id'),
  ),
  onRevenueCatPublicationClosed: vi.fn((listener: (reason: string) => void) => {
    h.state.publicationClosedListener = listener;
    return () => {
      if (h.state.publicationClosedListener === listener) {
        h.state.publicationClosedListener = null;
      }
    };
  }),
  pauseRevenueCatPublicationAdmission: vi.fn(() => {
    h.state.admissionPaused = true;
    h.state.events.push('admission:pause');
  }),
  renewRevenueCatPublication: h.renewRevenueCatPublication,
  reserveRevenueCatPublication: h.reserveRevenueCatPublication,
  resetRevenueCatIdentity: vi.fn(),
  resumeRevenueCatPublicationAdmission: vi.fn(() => {
    h.state.admissionPaused = false;
    h.state.events.push('admission:resume');
    return h.state.activeUserId !== null && h.state.activeSessionId !== null;
  }),
  retryRevenueCatPublicationDrain: h.retryRevenueCatPublicationDrain,
  runRevenueCatResultWrite: h.runRevenueCatResultWrite,
  subscribeToCustomerInfoUpdates: h.subscribeToCustomerInfoUpdates,
}));
vi.mock('@/lib/observability/safeLog', () => ({ devWarn: vi.fn() }));
vi.mock('@/lib/query/queryClient', () => ({
  queryClient: {
    cancelQueries: vi.fn(),
    clear: vi.fn(),
    invalidateQueries: h.invalidateEntitlementQueries,
    setQueryData: h.setEntitlementQueryData,
  },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  beginPrivateKVAccountBoundary: vi.fn(),
  endPrivateKVAccountBoundary: vi.fn(),
  waitForPrivateKVWritesToSettle: vi.fn(),
}));
vi.mock('../supabase/client', () => ({
  clearPersistedSupabaseSession: h.clearPersistedSession,
  isSupabaseControlledRefreshTerminalError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    ((error as { name?: unknown }).name === 'SupabaseControlledRefreshTerminalError' ||
      ('code' in error &&
        [
          'refresh_token_not_found',
          'refresh_token_already_used',
          'session_expired',
          'session_not_found',
          'user_banned',
          'user_not_found',
        ].includes(String((error as { code?: unknown }).code)))),
  readPersistedSupabaseSessionCandidate: async () => {
    const result = await h.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  },
  refreshPersistedSupabaseSessionCandidate: async (
    refreshToken: string,
    expectedSubject: string,
  ) => {
    const result = await h.auth.refreshSession({ refresh_token: refreshToken });
    if (result.error) throw result.error;
    if (!result.data.session) throw new Error('SUPABASE_CONTROLLED_REFRESH_RESPONSE_INVALID');
    if (
      result.data.session.user.id !== expectedSubject ||
      decodeClaim(result.data.session.access_token, 'sub') !== expectedSubject
    ) {
      const error = new Error('SUPABASE_CONTROLLED_REFRESH_TERMINAL');
      error.name = 'SupabaseControlledRefreshTerminalError';
      throw error;
    }
    return result.data.session;
  },
  supabase: { auth: h.auth },
}));
vi.mock('../supabase/remoteRequestGate', () => {
  const binding = (token: string, expectedSubject: string) => {
    const subject = decodeClaim(token, 'sub');
    const sessionId = decodeClaim(token, 'session_id');
    if (subject !== expectedSubject || !sessionId) {
      throw new Error('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
    }
    return { accessToken: token, sessionId, subject };
  };
  return {
    activateSupabaseRemoteRequest: (token: string, expectedSubject: string) => {
      const next = binding(token, expectedSubject);
      h.state.remoteState = 'active';
      h.state.remoteToken = token;
      h.state.events.push(`remote:activate:${token}`);
      return next;
    },
    closeSupabaseRemoteRequestBoundary: async () => {
      h.state.remoteState = 'closed';
      h.state.remoteToken = null;
      h.state.events.push('remote:close');
    },
    isSupabaseRemoteRequestAdmissionError: () => false,
    requireSupabaseRemoteSessionBinding: binding,
    runWithSupabaseAuthLogoutPermit: async (_binding: unknown, operation: () => Promise<unknown>) =>
      operation(),
    runWithSupabaseAuthRefreshPermit: async (
      previous: { subject: string },
      _refreshToken: string,
      operation: () => Promise<Session>,
    ) => {
      const result = await operation();
      binding(result.access_token, previous.subject);
      h.state.remoteState = 'candidate';
      h.state.remoteToken = result.access_token;
      h.state.events.push(`remote:refresh:${result.access_token}`);
      return result;
    },
    runWithSupabaseFreshAuthPermit: async (operation: () => Promise<unknown>) => operation(),
    setSupabaseRemoteRequestCandidate: (token: string, expectedSubject: string) => {
      const next = binding(token, expectedSubject);
      h.state.remoteState = 'candidate';
      h.state.remoteToken = token;
      h.state.events.push(`remote:candidate:${token}`);
      return next;
    },
    supabaseRemoteRequestAdmission: { waitForResidualSettlement: vi.fn(async () => {}) },
    supabaseRemoteRequestSnapshot: () => ({
      generation: 0,
      inFlight: 0,
      quarantined: 0,
      sessionId:
        h.state.remoteToken === null ? null : decodeClaim(h.state.remoteToken, 'session_id'),
      state: h.state.remoteState,
      subject: h.state.remoteToken === null ? null : decodeClaim(h.state.remoteToken, 'sub'),
    }),
  };
});
vi.mock('./accountGeneration', () => ({
  beginAccountGenerationBoundary: vi.fn(),
  endAccountGenerationBoundary: vi.fn(),
  waitForAccountGenerationOperationsToSettle: vi.fn(),
}));
vi.mock('./accountIsolationE2E', () => ({ getAccountIsolationE2EFixture: () => null }));
vi.mock('./accountUpgrade', () => ({
  authenticateWithProviderToken: vi.fn(),
  requestEmailAccountCode: vi.fn(),
  verifyEmailAccountCode: vi.fn(),
}));
vi.mock('./accountDeletionBarrier', () => ({
  activeAccountDeletionOwnsLocalData: vi.fn(),
  fetchAccountDeletionBarrierState: h.fetchBarrier,
  isAccountDeletionBarrierSessionRejected: () => false,
}));
vi.mock('./accountPublicationFence', () => ({
  accountPublicationSessionBinding: (token: string, expectedUserId: string) => {
    const subject = decodeClaim(token, 'sub');
    const sessionId = decodeClaim(token, 'session_id');
    return subject === expectedUserId && sessionId
      ? { subject, sessionId, accessToken: token }
      : null;
  },
  isAccountPublicationFenceError: () => false,
}));
vi.mock('./authDerivedCleanupRequired', () => ({
  clearAuthDerivedCleanupRequired: h.clearAuthDerivedCleanupRequired,
  markAuthDerivedCleanupRequired: h.markAuthDerivedCleanupRequired,
  readAuthDerivedCleanupRequired: h.readAuthDerivedCleanupRequired,
}));
vi.mock('./apple', () => ({ getAppleIdToken: vi.fn() }));
vi.mock('./appleCredentialQuarantine', () => ({
  clearAppleCredentialQuarantine: vi.fn(),
  isAppleCredentialQuarantined: vi.fn(async () => false),
  markAppleCredentialQuarantined: vi.fn(),
}));
vi.mock('./appleCredentialLifecycle', () => ({
  checkAppleCredentialForSession: h.checkAppleCredentialForSession,
  hasAppleIdentity: (user: User) =>
    user.app_metadata?.provider === 'apple' ||
    user.app_metadata?.providers?.includes('apple') === true ||
    user.identities?.some((identity) => identity.provider === 'apple') === true,
  monitorAppleCredentialLifecycle: vi.fn(() => vi.fn()),
  monitorAppleCredentialRevocation: vi.fn(() => vi.fn()),
}));
vi.mock('./google', () => ({ getGoogleIdToken: vi.fn() }));
vi.mock('./localAccountIsolation', () => ({
  clearAccountIsolatedState: vi.fn(),
  prepareLocalDataForSession: h.prepareLocalDataForSession,
}));
vi.mock('./revokedCredentialActivity', () => ({ clearAuthDerivedLocalActivity: vi.fn() }));
vi.mock('./sessionOwner', () => ({
  localDataOwnerBinding: h.localDataOwnerBinding,
  markLocalDataCleanupRequired: vi.fn(),
  preserveLocalDataForForcedSignOut: vi.fn(async () => 'retain'),
  readLocalDataOwnerProof: h.readLocalDataOwnerProof,
  readLocalDataOwnership: vi.fn(),
}));
vi.mock('./sessionInvalidation', () => ({
  clearRejectedSessionActivityDurably: vi.fn(
    async (dependencies: Record<string, () => unknown>) => {
      await dependencies.markAuthDerivedCleanupRequired?.();
      await dependencies.signOut?.();
      await dependencies.clearPersistedSession?.();
      await dependencies.clearAuthDerivedActivity?.();
      await dependencies.clearAuthDerivedCleanupRequired?.();
    },
  ),
}));
vi.mock('./sessionBoundary', () => ({
  latestSessionForCompletedBoundary: (
    pending: Session | null | undefined,
    fallback: Session | null,
    userId: string | null,
  ) => ((pending?.user.id ?? null) === userId ? (pending ?? null) : fallback),
}));

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

function jwt(subject: string, sessionId: string, expiresAt: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: subject, session_id: sessionId, exp: expiresAt }),
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function session(
  userId: string,
  sessionId: string,
  accessLabel: string,
  refreshToken: string,
  expiresAt = 4_000_000_000,
): Session {
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${userId}@example.test`,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-01-01T00:00:00.000Z',
  } as User;
  return {
    access_token: jwt(userId, sessionId, expiresAt),
    refresh_token: `${refreshToken}:${accessLabel}`,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    token_type: 'bearer',
    user,
  };
}

function appleSession(
  userId: string,
  sessionId: string,
  accessLabel: string,
  refreshToken: string,
  expiresAt = 4_000_000_000,
): Session {
  const value = session(userId, sessionId, accessLabel, refreshToken, expiresAt);
  value.user.app_metadata = { provider: 'apple', providers: ['apple'] };
  value.user.identities = [
    {
      id: `apple-${userId}`,
      identity_id: `apple-identity-${userId}`,
      provider: 'apple',
      user_id: userId,
      identity_data: { sub: `apple-${userId}` },
    },
  ];
  return value;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
  });
}

let renderer: ReactTestRenderer | null = null;
let currentAuth: ReturnType<typeof useAuth> | null = null;

function Probe() {
  const auth = useAuth();
  useEffect(() => {
    currentAuth = auth;
  }, [auth]);
  return null;
}

async function mount(): Promise<void> {
  await act(async () => {
    renderer = create(createElement(AuthProvider, null, createElement(Probe)));
  });
  await flush();
}

async function emitAppState(state: AppStateValue): Promise<void> {
  h.appState.currentState = state;
  await act(async () => {
    h.state.appStateListener?.(state);
    await Promise.resolve();
  });
}

async function emitOnline(online: boolean): Promise<void> {
  h.state.online = online;
  await act(async () => {
    h.state.onlineListener?.(online);
    await Promise.resolve();
  });
}

async function emitAuthState(event: string, nextSession: Session | null): Promise<void> {
  await act(async () => {
    h.state.authStateListener?.(event, nextSession);
    await Promise.resolve();
  });
}

async function beginDeletionIntakeHold(): Promise<void> {
  h.state.deletionIntakeHoldActive = true;
  h.state.deletionBlocked = true;
  h.state.events.push('intake-hold:begin');
  await act(async () => {
    h.state.deletionIntakeHoldListener?.(true);
    await Promise.resolve();
  });
}

async function releaseDeletionIntakeHold(durableBlock: boolean): Promise<void> {
  h.state.deletionIntakeHoldActive = false;
  h.state.deletionBlocked = durableBlock;
  h.state.events.push(`intake-hold:release:${durableBlock ? 'durable' : 'transient'}`);
  await act(async () => {
    h.state.deletionIntakeHoldListener?.(false);
    await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  currentAuth = null;
  h.state.admissionPaused = false;
  h.state.activeSessionId = null;
  h.state.activeUserId = null;
  h.state.appStateListener = null;
  h.state.authStateListener = null;
  h.state.customerInfoListener = null;
  h.state.customerInfoListenerError = null;
  h.state.deletionBlocked = false;
  h.state.deletionIntakeHoldActive = false;
  h.state.deletionIntakeHoldListener = null;
  h.state.events.length = 0;
  h.state.online = true;
  h.state.onlineListener = null;
  h.state.publicationClosedListener = null;
  h.state.remoteState = 'closed';
  h.state.remoteToken = null;
  h.appState.currentState = 'active';
  vi.clearAllMocks();
  h.auth.getSession.mockReset();
  h.auth.refreshSession.mockReset();
  h.auth.signOut.mockReset().mockResolvedValue({ error: null });
  h.auth.admin.signOut.mockReset().mockResolvedValue({ data: null, error: null });
  h.checkAppleCredentialForSession.mockReset().mockResolvedValue({ status: 'not_applicable' });
  h.clearAuthDerivedCleanupRequired.mockReset().mockResolvedValue(undefined);
  h.clearPersistedSession.mockReset().mockResolvedValue(undefined);
  h.markAuthDerivedCleanupRequired.mockReset().mockResolvedValue(undefined);
  h.readAuthDerivedCleanupRequired.mockReset().mockResolvedValue(false);
  h.localDataOwnerBinding.mockReset().mockImplementation(async (userId) => `binding:${userId}`);
  h.readLocalDataOwnerProof.mockReset().mockResolvedValue({
    kind: 'owned',
    ownerBinding: `binding:${USER_A}`,
    retained: false,
  });
  h.renewRevenueCatPublication.mockReset().mockImplementation(async (userId, token) => {
    h.state.events.push(`renew:${token}`);
    h.state.activeUserId = userId;
    h.state.activeSessionId = decodeClaim(token, 'session_id');
  });
  h.reserveRevenueCatPublication.mockReset().mockImplementation(async (_userId, token) => {
    h.state.events.push(`reserve:${token}`);
  });
  h.assertRevenueCatResultCurrent.mockReset();
  h.clearStoreEntitlement.mockReset().mockResolvedValue('committed');
  h.customerInfoToStoredEntitlement.mockReset().mockReturnValue(null);
  h.fetchBarrier.mockReset();
  h.fetchBarrier.mockImplementation(async (token: string) => {
    h.state.events.push(`preflight:${token}`);
    return { ownerSubject: decodeClaim(token, 'sub'), status: 'none' };
  });
  h.getCustomerInfo.mockReset().mockResolvedValue(null);
  h.getUncachedCustomerInfo.mockReset().mockResolvedValue(null);
  h.invalidateEntitlementQueries.mockReset().mockResolvedValue(undefined);
  h.loadEntitlement.mockReset().mockResolvedValue(null);
  h.prepareLocalDataForSession.mockReset().mockResolvedValue({ cleared: false, resetRoute: false });
  h.entitlementOwnerContextForUser.mockReset().mockResolvedValue({ ownerBinding: 'a'.repeat(64) });
  h.publishCustomerInfoEvidence.mockReset().mockResolvedValue({
    status: 'committed',
    disposition: 'applied',
    snapshot: { hasConflict: false, activeStoreEntitlement: null },
    requiresUncachedRefresh: false,
  });
  h.retryRevenueCatPublicationDrain.mockReset().mockImplementation(async () => {
    h.state.events.push('drain:retry');
  });
  h.runRevenueCatResultWrite
    .mockReset()
    .mockImplementation(async (_result: unknown, write: () => Promise<void>) => write());
  h.saveVerifiedEntitlement.mockReset().mockImplementation(async (entitlement) => entitlement);
  h.setEntitlementQueryData.mockReset();
});

afterEach(async () => {
  if (renderer) {
    await act(async () => renderer?.unmount());
    renderer = null;
  }
});

describe('AuthProvider cold restore and foreground publication lifecycle', () => {
  it('does not let an initial active event cancel a delayed cold restore', async () => {
    const restored = session(USER_A, SESSION_A, 'cold', 'refresh-cold');
    const restore = deferred<{ data: { session: Session }; error: null }>();
    h.auth.getSession.mockReturnValueOnce(restore.promise);

    await mount();
    expect(currentAuth?.initializing).toBe(true);
    expect(currentAuth?.session).toBeNull();
    expect(h.auth.refreshSession).not.toHaveBeenCalled();

    await emitAppState('active');
    expect(currentAuth?.session).toBeNull();

    restore.resolve({ data: { session: restored }, error: null });
    await flush();

    expect(currentAuth?.session?.access_token).toBe(restored.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledTimes(1);
    expect(h.fetchBarrier).toHaveBeenCalledWith(restored.access_token, USER_A);
    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(h.state.events).toContain(`reserve:${restored.access_token}`);
    expect(h.state.events).toContain(`activate:${restored.access_token}`);
  });

  it('mounts exact owner-bound local data when remote deletion preflight is unavailable', async () => {
    const restored = session(USER_A, SESSION_A, 'offline-cold', 'refresh-offline');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
    h.fetchBarrier.mockRejectedValueOnce(new Error('network unavailable'));

    await mount();

    expect(currentAuth?.session?.access_token).toBe(restored.access_token);
    expect(currentAuth?.initializing).toBe(false);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.prepareLocalDataForSession).toHaveBeenCalledWith(
      null,
      USER_A,
      undefined,
      expect.any(Function),
      expect.any(Object),
    );
    expect(h.state.events).not.toContain(`reserve:${restored.access_token}`);
    expect(h.state.events).not.toContain(`activate:${restored.access_token}`);
    expect(h.state.activeUserId).toBeNull();
    expect(h.auth.startAutoRefresh).not.toHaveBeenCalled();
  });

  it('retries a failed online preflight without waiting for a connectivity edge', async () => {
    vi.useFakeTimers();
    try {
      const restored = session(USER_A, SESSION_A, 'online-retry', 'refresh-online-retry');
      h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
      h.auth.refreshSession.mockResolvedValue({
        data: { session: restored, user: restored.user },
        error: null,
      });
      h.fetchBarrier.mockRejectedValueOnce(new Error('transient preflight failure'));

      await mount();
      expect(currentAuth?.session?.access_token).toBe(restored.access_token);
      expect(h.fetchBarrier).toHaveBeenCalledOnce();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      await flush();

      expect(h.fetchBarrier).toHaveBeenCalledTimes(2);
      expect(h.auth.refreshSession).not.toHaveBeenCalled();
      expect(h.state.events).toContain(`activate:${restored.access_token}`);
      expect(h.state.activeUserId).toBe(USER_A);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes near expiry through the controlled foreground path, never SDK auto-refresh', async () => {
    vi.useFakeTimers();
    try {
      const expiresAt = Math.floor(Date.now() / 1_000) + 61;
      const restored = session(
        USER_A,
        SESSION_A,
        'controlled-expiry',
        'refresh-controlled',
        expiresAt,
      );
      const refreshed = session(
        USER_A,
        SESSION_A,
        'controlled-fresh',
        'refresh-controlled-rotated',
      );
      h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
      h.auth.refreshSession.mockResolvedValueOnce({
        data: { session: refreshed, user: refreshed.user },
        error: null,
      });

      await mount();
      expect(h.auth.startAutoRefresh).not.toHaveBeenCalled();
      expect(h.auth.refreshSession).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      await flush();

      expect(h.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: restored.refresh_token,
      });
      expect(currentAuth?.session?.access_token).toBe(refreshed.access_token);
      expect(h.state.events).toContain(`reserve:${refreshed.access_token}`);
      expect(h.state.events).toContain(`activate:${refreshed.access_token}`);
      expect(h.state.events).toContain(`remote:activate:${refreshed.access_token}`);
      expect(h.auth.startAutoRefresh).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits while offline and retries immediately on the next online level', async () => {
    const restored = session(USER_A, SESSION_A, 'offline-edge', 'refresh-offline-edge');
    h.state.online = false;
    h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
    h.auth.refreshSession.mockResolvedValue({
      data: { session: restored, user: restored.user },
      error: null,
    });
    h.fetchBarrier.mockRejectedValueOnce(new Error('offline'));

    await mount();
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.auth.refreshSession).not.toHaveBeenCalled();

    await emitOnline(true);
    await flush();

    expect(h.fetchBarrier).toHaveBeenCalledTimes(2);
    expect(h.state.events).toContain(`activate:${restored.access_token}`);
  });

  it('cancels an online recovery timer when the app backgrounds', async () => {
    vi.useFakeTimers();
    try {
      const restored = session(USER_A, SESSION_A, 'background-cancel', 'refresh-cancel');
      h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
      h.fetchBarrier.mockRejectedValueOnce(new Error('transient preflight failure'));

      await mount();
      await emitAppState('background');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await flush();

      expect(h.fetchBarrier).toHaveBeenCalledOnce();
      expect(h.auth.refreshSession).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels an online recovery timer at account and deletion-intake boundaries', async () => {
    vi.useFakeTimers();
    try {
      const owner = session(USER_A, SESSION_A, 'owner-cancel', 'refresh-owner');
      const replacement = session(USER_B, SESSION_B, 'replacement-cancel', 'refresh-replacement');
      h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
      h.fetchBarrier.mockRejectedValueOnce(new Error('transient preflight failure'));

      await mount();
      await emitAuthState('SIGNED_IN', replacement);
      await beginDeletionIntakeHold();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await flush();

      expect(h.fetchBarrier).toHaveBeenCalledTimes(2);
      expect(h.fetchBarrier).toHaveBeenNthCalledWith(1, owner.access_token, USER_A);
      expect(h.fetchBarrier).toHaveBeenNthCalledWith(2, replacement.access_token, USER_B);
      expect(h.auth.refreshSession).not.toHaveBeenCalled();
      expect(currentAuth?.session).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { label: 'unclaimed', proof: { kind: 'unclaimed' } as LocalOwnerProof },
    {
      label: 'foreign',
      proof: {
        kind: 'owned',
        ownerBinding: `binding:${USER_B}`,
        retained: false,
      } as LocalOwnerProof,
    },
    {
      label: 'cleanup-required',
      proof: {
        kind: 'cleanup_required',
        ownerBinding: `binding:${USER_A}`,
      } as LocalOwnerProof,
    },
    { label: 'quarantined', proof: { kind: 'quarantined' } as LocalOwnerProof },
  ])(
    'does not mutate or mount $label local data from an offline cached session',
    async ({ proof }) => {
      const restored = session(USER_A, SESSION_A, 'offline-closed', 'refresh-offline');
      h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
      h.fetchBarrier.mockRejectedValueOnce(new Error('network unavailable'));
      h.readLocalDataOwnerProof.mockResolvedValueOnce(proof);

      await mount();

      expect(currentAuth?.session).toBeNull();
      expect(currentAuth?.initializing).toBe(false);
      expect(currentAuth?.sessionBoundaryError).toBe(true);
      expect(h.prepareLocalDataForSession).not.toHaveBeenCalled();
      expect(h.state.events).not.toContain(`reserve:${restored.access_token}`);
      expect(h.state.events).not.toContain(`activate:${restored.access_token}`);
      expect(h.auth.startAutoRefresh).not.toHaveBeenCalled();
    },
  );

  it('fails closed when the offline local-owner proof cannot be validated', async () => {
    const restored = session(USER_A, SESSION_A, 'offline-corrupt', 'refresh-offline');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
    h.fetchBarrier.mockRejectedValueOnce(new Error('network unavailable'));
    h.readLocalDataOwnerProof.mockRejectedValueOnce(new Error('LOCAL_DATA_OWNER_PROOF_INVALID'));

    await mount();

    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.sessionBoundaryError).toBe(true);
    expect(h.prepareLocalDataForSession).not.toHaveBeenCalled();
  });

  it('recovers a closed offline owner boundary after server proof returns', async () => {
    const restored = session(USER_A, SESSION_A, 'offline-recovery', 'refresh-offline');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
    h.fetchBarrier.mockRejectedValueOnce(new Error('network unavailable'));
    h.readLocalDataOwnerProof.mockResolvedValueOnce({ kind: 'unclaimed' });

    await mount();
    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.sessionBoundaryError).toBe(true);
    expect(h.prepareLocalDataForSession).not.toHaveBeenCalled();

    await act(async () => {
      await currentAuth?.retrySessionBoundary();
    });
    await flush();

    expect(currentAuth?.session?.access_token).toBe(restored.access_token);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.fetchBarrier).toHaveBeenCalledTimes(2);
    expect(h.prepareLocalDataForSession).toHaveBeenCalledOnce();
    expect(h.state.events).toContain(`reserve:${restored.access_token}`);
    expect(h.state.events).toContain(`activate:${restored.access_token}`);
  });

  it('invalidates a stale cold read when a different account signs in during restore', async () => {
    const staleOwner = session(USER_A, SESSION_A, 'stale-owner', 'refresh-stale');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    const staleRead = deferred<{ data: { session: Session }; error: null }>();
    h.auth.getSession
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce({ data: { session: replacement }, error: null });

    await mount();
    expect(h.auth.getSession).toHaveBeenCalledOnce();

    await emitAuthState('SIGNED_IN', replacement);
    staleRead.resolve({ data: { session: staleOwner }, error: null });
    await flush();

    await vi.waitFor(() => expect(h.auth.getSession).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(currentAuth?.session?.access_token).toBe(replacement.access_token),
    );
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.fetchBarrier).toHaveBeenCalledWith(replacement.access_token, USER_B);
    expect(h.state.events).not.toContain(`preflight:${staleOwner.access_token}`);
    expect(h.state.events).not.toContain(`reserve:${staleOwner.access_token}`);
    expect(h.state.events).not.toContain(`activate:${staleOwner.access_token}`);
    expect(h.state.events).toContain(`activate:${replacement.access_token}`);
  });

  it('closes admission and never activates a stale account changed during reserve', async () => {
    const staleOwner = session(USER_A, SESSION_A, 'stale-owner', 'refresh-stale');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    const staleReserve = deferred<void>();
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: staleOwner }, error: null })
      .mockResolvedValueOnce({ data: { session: replacement }, error: null });
    h.reserveRevenueCatPublication.mockImplementationOnce(async (_userId, token) => {
      h.state.events.push(`reserve:pending:${token}`);
      await staleReserve.promise;
      h.state.events.push(`reserve:settled:${token}`);
    });

    await mount();
    await vi.waitFor(() =>
      expect(h.state.events).toContain(`reserve:pending:${staleOwner.access_token}`),
    );

    await emitAuthState('SIGNED_IN', replacement);
    expect(h.state.events).toContain('close:account_boundary');
    staleReserve.resolve();
    await flush();

    await vi.waitFor(() =>
      expect(currentAuth?.session?.access_token).toBe(replacement.access_token),
    );
    expect(h.auth.getSession).toHaveBeenCalledTimes(2);
    expect(h.state.events).not.toContain(`activate:${staleOwner.access_token}`);
    expect(h.state.events).toContain(`reserve:${replacement.access_token}`);
    expect(h.state.events).toContain(`activate:${replacement.access_token}`);
  });

  it('publishes only owner-bound local access while launch state is unknown', async () => {
    const restored = session(USER_A, SESSION_A, 'null-launch', 'refresh-null');
    h.appState.currentState = null;
    h.auth.getSession.mockResolvedValueOnce({ data: { session: restored }, error: null });
    h.auth.refreshSession.mockResolvedValueOnce({
      data: { session: restored, user: restored.user },
      error: null,
    });

    await mount();
    expect(currentAuth?.session?.access_token).toBe(restored.access_token);
    expect(h.auth.stopAutoRefresh).toHaveBeenCalled();
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.state.events).not.toContain(`reserve:${restored.access_token}`);
    expect(h.state.events).not.toContain(`activate:${restored.access_token}`);

    await emitAppState('active');
    await flush();

    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(currentAuth?.session?.access_token).toBe(restored.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledTimes(2);
  });

  it('retains local access while refreshing and revalidating commerce after background', async () => {
    const expired = session(
      USER_A,
      SESSION_A,
      'expired',
      'refresh-old',
      Math.floor(Date.now() / 1_000) + 120,
    );
    const refreshed = session(USER_A, SESSION_A, 'fresh', 'refresh-new');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    expect(currentAuth?.session?.access_token).toBe(expired.access_token);

    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;
    expect(currentAuth?.session?.access_token).toBe(expired.access_token);
    expect(h.auth.stopAutoRefresh).toHaveBeenCalled();

    const refresh = deferred<{
      data: { session: Session; user: User };
      error: null;
    }>();
    h.auth.refreshSession.mockImplementationOnce(async () => {
      h.state.events.push(`refresh:${refreshed.access_token}`);
      return refresh.promise;
    });

    await emitAppState('active');
    expect(currentAuth?.session?.access_token).toBe(expired.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledTimes(1);

    refresh.resolve({ data: { session: refreshed, user: refreshed.user }, error: null });
    await flush();

    expect(h.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: expired.refresh_token,
    });
    expect(currentAuth?.session?.access_token).toBe(refreshed.access_token);
    expect(h.fetchBarrier).toHaveBeenNthCalledWith(2, refreshed.access_token, USER_A);
    const refreshIndex = h.state.events.indexOf(`refresh:${refreshed.access_token}`);
    const drainRetryIndex = h.state.events.indexOf('drain:retry');
    const preflightIndex = h.state.events.indexOf(`preflight:${refreshed.access_token}`);
    const reserveIndex = h.state.events.indexOf(`reserve:${refreshed.access_token}`);
    const activateIndex = h.state.events.indexOf(`activate:${refreshed.access_token}`);
    expect(refreshIndex).toBeGreaterThan(-1);
    expect(drainRetryIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(drainRetryIndex);
    expect(preflightIndex).toBeGreaterThan(refreshIndex);
    expect(reserveIndex).toBeGreaterThan(preflightIndex);
    expect(activateIndex).toBeGreaterThan(reserveIndex);
  });

  it('keeps commerce authority across transient inactive system UI', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.auth.refreshSession.mockClear();
    await emitAppState('inactive');

    expect(currentAuth?.session?.access_token).toBe(owner.access_token);
    expect(h.state.activeUserId).toBe(USER_A);
    expect(h.state.activeSessionId).toBe(SESSION_A);
    expect(h.state.events).not.toContain('close:app_backgrounded');

    await emitAppState('active');
    await flush();

    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.state.events.some((event) => event.startsWith('reserve:'))).toBe(false);
    expect(h.state.events.some((event) => event.startsWith('activate:'))).toBe(false);
  });

  it('checks Apple before reopening a transient inactive boundary', async () => {
    const owner = appleSession(USER_A, SESSION_A, 'apple-owner', 'refresh-apple-owner');
    const foregroundCheck = deferred<AppleCheckResult>();
    h.checkAppleCredentialForSession
      .mockResolvedValueOnce({ status: 'valid' })
      .mockReturnValueOnce(foregroundCheck.promise);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.auth.refreshSession.mockClear();
    await emitAppState('inactive');
    await emitAppState('active');

    expect(currentAuth?.initializing).toBe(true);
    expect(h.state.admissionPaused).toBe(true);
    expect(h.state.events).toContain('admission:pause');
    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.state.events.some((event) => event.startsWith('reserve:'))).toBe(false);
    expect(h.state.events.some((event) => event.startsWith('activate:'))).toBe(false);

    foregroundCheck.resolve({ status: 'valid' });
    await flush();

    expect(currentAuth?.session?.access_token).toBe(owner.access_token);
    expect(currentAuth?.initializing).toBe(false);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.state.admissionPaused).toBe(false);
    expect(h.state.events).toContain('admission:resume');
    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
  });

  it('checks Apple before reacquiring remote authority after background', async () => {
    const expired = appleSession(
      USER_A,
      SESSION_A,
      'apple-expired',
      'refresh-apple-old',
      Math.floor(Date.now() / 1_000) + 120,
    );
    const refreshed = appleSession(USER_A, SESSION_A, 'apple-fresh', 'refresh-apple-new');
    const foregroundCheck = deferred<AppleCheckResult>();
    h.checkAppleCredentialForSession
      .mockResolvedValueOnce({ status: 'valid' })
      .mockReturnValueOnce(foregroundCheck.promise);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.auth.refreshSession.mockClear();
    h.auth.refreshSession.mockResolvedValueOnce({
      data: { session: refreshed, user: refreshed.user },
      error: null,
    });
    await emitAppState('active');

    expect(currentAuth?.initializing).toBe(true);
    expect(h.state.admissionPaused).toBe(true);
    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.state.events.some((event) => event.startsWith('reserve:'))).toBe(false);

    foregroundCheck.resolve({ status: 'valid' });
    await flush();

    expect(h.auth.refreshSession).toHaveBeenCalledWith({ refresh_token: expired.refresh_token });
    expect(currentAuth?.session?.access_token).toBe(refreshed.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledWith(refreshed.access_token, USER_A);
    expect(h.state.events).toContain(`reserve:${refreshed.access_token}`);
    expect(h.state.events).toContain(`activate:${refreshed.access_token}`);
  });

  it.each([
    {
      expectedError: false,
      result: { status: 'invalid', reason: 'credential_revoked' } as const,
    },
    {
      expectedError: true,
      result: { status: 'blocked', reason: 'credential_check_failed' } as const,
    },
  ])(
    'keeps Apple foreground publication closed for $result.status evidence',
    async ({ expectedError, result }) => {
      const owner = appleSession(USER_A, SESSION_A, 'apple-owner', 'refresh-apple-owner');
      h.checkAppleCredentialForSession
        .mockResolvedValueOnce({ status: 'valid' })
        .mockResolvedValueOnce(result);
      h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
      await mount();

      h.state.events.length = 0;
      h.fetchBarrier.mockClear();
      h.auth.refreshSession.mockClear();
      await emitAppState('inactive');
      await emitAppState('active');
      await flush();

      expect(currentAuth?.session).toBeNull();
      expect(currentAuth?.initializing).toBe(false);
      expect(currentAuth?.sessionBoundaryError).toBe(expectedError);
      expect(h.state.admissionPaused).toBe(true);
      expect(h.auth.refreshSession).not.toHaveBeenCalled();
      expect(h.fetchBarrier).not.toHaveBeenCalled();
      expect(h.state.events.some((event) => event.startsWith('reserve:'))).toBe(false);
      expect(h.state.events.some((event) => event.startsWith('activate:'))).toBe(false);
      if (result.status === 'invalid') {
        expect(h.clearPersistedSession).toHaveBeenCalled();
      } else {
        expect(h.clearPersistedSession).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps local access when foreground token refresh is offline', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();
    await emitAppState('background');
    owner.access_token = jwt(USER_A, SESSION_A, 1);
    owner.expires_at = 1;
    h.auth.refreshSession.mockRejectedValueOnce(new Error('network unavailable'));

    await emitAppState('active');
    await flush();

    expect(currentAuth?.session?.access_token).toBe(owner.access_token);
    expect(currentAuth?.initializing).toBe(false);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.state.activeUserId).toBeNull();
    expect(h.state.activeSessionId).toBeNull();
  });

  it('fails closed when a foreground refresh returns a foreign binding', async () => {
    const expired = session(USER_A, SESSION_A, 'expired', 'refresh-old');
    const foreign = session(USER_B, SESSION_B, 'foreign', 'refresh-foreign');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;

    h.auth.refreshSession.mockImplementationOnce(async () => {
      return { data: { session: foreign, user: foreign.user }, error: null };
    });
    await emitAppState('active');
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(h.fetchBarrier).toHaveBeenCalledTimes(1);
    expect(h.auth.signOut).not.toHaveBeenCalled();
    expect(h.clearPersistedSession).toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${foreign.access_token}`);
    expect(h.state.events).not.toContain(`activate:${foreign.access_token}`);
  });

  it('fails closed when Supabase rejects the retained refresh token', async () => {
    const expired = session(USER_A, SESSION_A, 'expired', 'refresh-rejected');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;

    h.auth.refreshSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    });
    await emitAppState('active');
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(h.fetchBarrier).toHaveBeenCalledTimes(1);
    expect(h.auth.signOut).not.toHaveBeenCalled();
    expect(h.clearPersistedSession).toHaveBeenCalled();
  });

  it.each([
    new AuthApiError('rate limited', 429, 'over_request_rate_limit'),
    new AuthApiError('service degraded', 500, 'unexpected_failure'),
    new AuthApiError('unknown response', 400, 'future_auth_code'),
    new AuthInvalidTokenResponseError(),
    new AuthRefreshDiscardedError(),
  ])('retains local access for ambiguous foreground refresh error %#', async (error) => {
    const expired = session(USER_A, SESSION_A, 'expired', 'refresh-ambiguous');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;

    h.auth.refreshSession.mockResolvedValueOnce({
      data: { session: null, user: null },
      error,
    });
    await emitAppState('active');
    await flush();

    expect(currentAuth?.session?.access_token).toBe(expired.access_token);
    expect(currentAuth?.initializing).toBe(false);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.auth.signOut).not.toHaveBeenCalled();
    expect(h.clearPersistedSession).not.toHaveBeenCalled();
    expect(h.state.activeUserId).toBeNull();
  });

  it('does not republish a deferred foreground refresh after explicit sign-out completes', async () => {
    const expired = session(USER_A, SESSION_A, 'expired', 'refresh-old');
    const refreshed = session(USER_A, SESSION_A, 'fresh', 'refresh-new');
    const refresh = deferred<{
      data: { session: Session; user: User };
      error: null;
    }>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;
    h.fetchBarrier.mockClear();
    h.state.events.length = 0;
    h.auth.refreshSession.mockImplementationOnce(async () => {
      return refresh.promise;
    });

    await emitAppState('active');
    expect(h.auth.refreshSession).toHaveBeenCalledTimes(1);

    let signOut!: Promise<void>;
    await act(async () => {
      signOut = currentAuth!.signOut();
      await Promise.resolve();
    });
    expect(currentAuth?.session).toBeNull();

    refresh.resolve({ data: { session: refreshed, user: refreshed.user }, error: null });
    await act(async () => signOut);
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.state.events).not.toContain(`preflight:${refreshed.access_token}`);
    expect(h.state.events).not.toContain(`reserve:${refreshed.access_token}`);
    expect(h.state.events).not.toContain(`activate:${refreshed.access_token}`);
  });

  it('durably commits local sign-out before awaiting remote token revocation', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const remoteSignOut = deferred<{ data: null; error: null }>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    h.auth.admin.signOut.mockReturnValueOnce(remoteSignOut.promise);
    await mount();

    let signOut!: Promise<void>;
    await act(async () => {
      signOut = currentAuth!.signOut();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(h.auth.admin.signOut).toHaveBeenCalledOnce());

    expect(currentAuth?.session).toBeNull();
    expect(h.markAuthDerivedCleanupRequired).toHaveBeenCalledOnce();
    expect(h.clearPersistedSession).toHaveBeenCalledOnce();
    expect(h.auth.admin.signOut).toHaveBeenCalledWith(owner.access_token, 'global');
    expect(h.markAuthDerivedCleanupRequired.mock.invocationCallOrder[0]).toBeLessThan(
      h.clearPersistedSession.mock.invocationCallOrder[0]!,
    );
    expect(h.clearPersistedSession.mock.invocationCallOrder[0]).toBeLessThan(
      h.auth.admin.signOut.mock.invocationCallOrder[0]!,
    );
    expect(h.clearAuthDerivedCleanupRequired).not.toHaveBeenCalled();

    remoteSignOut.resolve({ data: null, error: null });
    await act(async () => signOut);
    expect(h.clearAuthDerivedCleanupRequired).toHaveBeenCalledOnce();
  });

  it('never republishes a persisted session while sign-out cleanup recovery is marked', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    h.readAuthDerivedCleanupRequired.mockResolvedValueOnce(true);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });

    await mount();
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(h.auth.getSession).not.toHaveBeenCalled();
    expect(h.auth.signOut).not.toHaveBeenCalled();
    expect(h.clearPersistedSession).toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${owner.access_token}`);
    expect(h.state.events).not.toContain(`activate:${owner.access_token}`);
  });

  it('publishes a newer account boundary instead of a stale deferred foreground refresh', async () => {
    const expired = session(USER_A, SESSION_A, 'expired', 'refresh-old');
    const refreshed = session(USER_A, SESSION_A, 'fresh', 'refresh-new');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    const refresh = deferred<{
      data: { session: Session; user: User };
      error: null;
    }>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null });
    await mount();
    await emitAppState('background');
    expired.access_token = jwt(USER_A, SESSION_A, 1);
    expired.expires_at = 1;
    h.fetchBarrier.mockClear();
    h.state.events.length = 0;
    h.auth.refreshSession.mockImplementationOnce(async () => {
      return refresh.promise;
    });

    await emitAppState('active');
    expect(h.auth.refreshSession).toHaveBeenCalledTimes(1);
    await emitAuthState('SIGNED_IN', replacement);

    // A non-matching auth callback is an account boundary even while the
    // foreground refresh promise is unresolved. Private account A state must
    // disappear before any deferred reconciliation work can run.
    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.initializing).toBe(true);
    expect(h.state.events).toContain('close:account_boundary');

    refresh.resolve({ data: { session: refreshed, user: refreshed.user }, error: null });
    await flush();

    expect(currentAuth?.session?.access_token).toBe(replacement.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.fetchBarrier).toHaveBeenCalledWith(replacement.access_token, USER_B);
    expect(h.state.events).not.toContain(`preflight:${refreshed.access_token}`);
    expect(h.state.events).not.toContain(`reserve:${refreshed.access_token}`);
    expect(h.state.events).not.toContain(`activate:${refreshed.access_token}`);
    expect(h.state.events).toContain(`reserve:${replacement.access_token}`);
    expect(h.state.events).toContain(`activate:${replacement.access_token}`);
  });

  it('keeps B and every local/provider publication deferred across the durable deletion handoff', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.prepareLocalDataForSession.mockClear();
    await beginDeletionIntakeHold();
    await emitAuthState('SIGNED_IN', replacement);
    await emitAuthState('TOKEN_REFRESHED', owner);
    await releaseDeletionIntakeHold(true);
    await act(async () => currentAuth?.retrySessionBoundary());
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.prepareLocalDataForSession).not.toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${replacement.access_token}`);
    expect(h.state.events).not.toContain(`activate:${replacement.access_token}`);
    expect(h.state.events).toContain('intake-hold:release:durable');
  });

  it('keeps a deferred B boundary neutral when the stable Supabase session still reports A', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: owner }, error: null })
      // The singleton and persisted Auth slot still contradict the deferred B
      // event, so publishing either identity would split UI/vendor and RLS.
      .mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.prepareLocalDataForSession.mockClear();
    await beginDeletionIntakeHold();
    await emitAuthState('SIGNED_IN', replacement);
    await emitAuthState('TOKEN_REFRESHED', owner);
    await releaseDeletionIntakeHold(false);
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.sessionBoundaryError).toBe(true);
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.prepareLocalDataForSession).not.toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${replacement.access_token}`);
    expect(h.state.events).not.toContain(`activate:${replacement.access_token}`);
    expect(h.state.events).not.toContain(`preflight:${owner.access_token}`);

    // The exact deferred B candidate remains available for a bounded user retry
    // once the Supabase singleton and persisted slot agree with it.
    h.auth.getSession.mockResolvedValueOnce({ data: { session: replacement }, error: null });
    await act(async () => currentAuth?.retrySessionBoundary());
    await flush();

    expect(currentAuth?.session?.access_token).toBe(replacement.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledWith(replacement.access_token, USER_B);
    expect(h.state.events).toContain(`reserve:${replacement.access_token}`);
    expect(h.state.events).toContain(`activate:${replacement.access_token}`);
  });

  it('keeps deferred SIGNED_OUT neutral while the stable Supabase session still reports A', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: owner }, error: null })
      .mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.prepareLocalDataForSession.mockClear();
    await beginDeletionIntakeHold();
    await emitAuthState('SIGNED_OUT', null);
    await emitAuthState('TOKEN_REFRESHED', owner);
    await releaseDeletionIntakeHold(false);
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.sessionBoundaryError).toBe(true);
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.prepareLocalDataForSession).not.toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${owner.access_token}`);
    expect(h.state.events).not.toContain(`activate:${owner.access_token}`);
  });

  it('re-reads when B arrives during an in-flight A session read and publishes only verified B', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    const staleRead = deferred<{ data: { session: Session }; error: null }>();
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: owner }, error: null })
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce({ data: { session: replacement }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.prepareLocalDataForSession.mockClear();
    await beginDeletionIntakeHold();
    await releaseDeletionIntakeHold(false);
    await vi.waitFor(() => expect(h.auth.getSession).toHaveBeenCalledTimes(2));

    await emitAuthState('SIGNED_IN', replacement);
    staleRead.resolve({ data: { session: owner }, error: null });
    await flush();

    expect(h.auth.getSession).toHaveBeenCalledTimes(3);
    expect(currentAuth?.session?.access_token).toBe(replacement.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.fetchBarrier).toHaveBeenCalledWith(replacement.access_token, USER_B);
    expect(h.state.events).not.toContain(`preflight:${owner.access_token}`);
    expect(h.state.events).toContain(`activate:${replacement.access_token}`);
  });

  it('publishes the freshly read token when a hold-time refresh keeps the same binding', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const refreshed = session(USER_A, SESSION_A, 'refreshed', 'refresh-new', 4_000_000_100);
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: owner }, error: null })
      .mockResolvedValueOnce({ data: { session: refreshed }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    await beginDeletionIntakeHold();
    await emitAuthState('TOKEN_REFRESHED', refreshed);
    await releaseDeletionIntakeHold(false);
    await flush();

    expect(currentAuth?.session?.access_token).toBe(refreshed.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledOnce();
    expect(h.fetchBarrier).toHaveBeenCalledWith(refreshed.access_token, USER_A);
    expect(h.state.events).not.toContain(`preflight:${owner.access_token}`);
    expect(h.state.events).toContain(`reserve:${refreshed.access_token}`);
    expect(h.state.events).toContain(`activate:${refreshed.access_token}`);
  });

  it('fails closed on an unsolicited auth-js token refresh callback', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const refreshed = session(USER_A, SESSION_A, 'refreshed', 'refresh-new', 4_000_000_100);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.clearPersistedSession.mockClear();

    await emitAuthState('TOKEN_REFRESHED', refreshed);
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.clearPersistedSession).toHaveBeenCalledOnce();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${refreshed.access_token}`);
    expect(h.state.events).not.toContain(`activate:${refreshed.access_token}`);
    expect(h.auth.signOut).not.toHaveBeenCalled();
  });

  it('retains exact-owner local access and retries after provider reserve fails', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const refreshed = session(USER_A, SESSION_A, 'refreshed', 'refresh-new', 4_000_000_100);
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.reserveRevenueCatPublication.mockImplementationOnce(async (_userId, token) => {
      h.state.events.push(`reserve:failed:${token}`);
      throw new Error('ACCOUNT_PUBLICATION_UNAVAILABLE');
    });

    await emitAuthState('SIGNED_IN', refreshed);
    await flush();

    expect(currentAuth?.session?.access_token).toBe(refreshed.access_token);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.state.activeUserId).toBeNull();
    expect(h.state.remoteState).toBe('closed');
    expect(h.state.events).toContain(`reserve:failed:${refreshed.access_token}`);

    await act(async () => currentAuth?.retrySessionBoundary());
    await flush();

    expect(currentAuth?.session?.access_token).toBe(refreshed.access_token);
    expect(h.fetchBarrier).toHaveBeenCalledTimes(2);
    expect(h.state.events).toContain(`reserve:${refreshed.access_token}`);
    expect(h.state.events).toContain(`activate:${refreshed.access_token}`);
    expect(h.state.events).toContain(`remote:activate:${refreshed.access_token}`);
    expect(h.auth.signOut).not.toHaveBeenCalled();
  });

  it('does not invoke a pre-existing restore retry after deletion authority becomes durable', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    h.state.activeUserId = null;
    h.state.activeSessionId = null;
    await act(async () => {
      h.state.publicationClosedListener?.('renewal_failed');
      await Promise.resolve();
    });
    await flush();
    expect(currentAuth?.session?.access_token).toBe(owner.access_token);
    expect(currentAuth?.sessionBoundaryError).toBe(false);
    expect(h.auth.getSession).toHaveBeenCalledOnce();
    h.fetchBarrier.mockClear();
    h.state.events.length = 0;

    await beginDeletionIntakeHold();
    await releaseDeletionIntakeHold(true);
    await act(async () => currentAuth?.retrySessionBoundary());
    await flush();

    expect(h.auth.getSession).toHaveBeenCalledOnce();
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(currentAuth?.session).toBeNull();
    expect(h.state.events).not.toContain(`reserve:${owner.access_token}`);
  });

  it('keeps a quarantined drain private and retryable after a pre-durable failure', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const replacement = session(USER_B, SESSION_B, 'replacement', 'refresh-replacement');
    h.auth.getSession
      .mockResolvedValueOnce({ data: { session: owner }, error: null })
      .mockResolvedValueOnce({ data: { session: replacement }, error: null });
    h.retryRevenueCatPublicationDrain.mockRejectedValueOnce(
      new Error('ACCOUNT_PUBLICATION_OPERATION_QUARANTINED'),
    );
    await mount();

    h.state.events.length = 0;
    h.fetchBarrier.mockClear();
    await beginDeletionIntakeHold();
    await emitAuthState('SIGNED_IN', replacement);
    await releaseDeletionIntakeHold(false);
    await flush();

    expect(currentAuth?.session).toBeNull();
    expect(currentAuth?.sessionBoundaryError).toBe(true);
    expect(h.fetchBarrier).not.toHaveBeenCalled();
    expect(h.state.events).not.toContain(`reserve:${replacement.access_token}`);

    h.retryRevenueCatPublicationDrain.mockImplementationOnce(async () => {
      h.state.events.push('drain:retry-after-quarantine');
    });
    await act(async () => currentAuth?.retrySessionBoundary());
    await flush();

    expect(currentAuth?.session?.access_token).toBe(replacement.access_token);
    expect(h.state.events).toContain('drain:retry-after-quarantine');
    expect(h.state.events).toContain(`activate:${replacement.access_token}`);
  });

  it('installs the listener first and publishes every buffered and initial snapshot FIFO', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const stale = { requestDate: '2026-07-14T00:00:00.000Z', product: 'stale' };
    const newer = { requestDate: '2026-07-14T00:00:01.000Z', product: 'newer' };
    const staleEntitlement = {
      tier: 'pro' as const,
      isActive: false,
      productId: 'pro.stale',
    };
    const newerEntitlement = {
      tier: 'pro' as const,
      isActive: true,
      productId: 'pro.newer',
    };
    const initialRead = deferred<unknown>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    h.getCustomerInfo.mockReturnValueOnce(initialRead.promise);
    h.customerInfoToStoredEntitlement.mockImplementation((customerInfo) =>
      customerInfo === newer ? newerEntitlement : staleEntitlement,
    );

    await mount();
    await vi.waitFor(() => expect(h.getCustomerInfo).toHaveBeenCalledOnce());
    expect(h.subscribeToCustomerInfoUpdates.mock.invocationCallOrder[0]).toBeLessThan(
      h.getCustomerInfo.mock.invocationCallOrder[0]!,
    );
    const listener = h.state.customerInfoListener;
    expect(listener).not.toBeNull();
    let bufferedWrite!: Promise<void>;
    await act(async () => {
      bufferedWrite = Promise.resolve(listener?.(newer));
      await Promise.resolve();
    });

    initialRead.resolve(stale);
    await act(async () => {
      await bufferedWrite;
    });
    await flush();

    expect(h.customerInfoToStoredEntitlement.mock.calls).toEqual([[newer], [stale]]);
    expect(h.publishCustomerInfoEvidence).toHaveBeenCalledTimes(2);
    expect(h.publishCustomerInfoEvidence).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ customerInfo: newer, entitlement: newerEntitlement }),
    );
    expect(h.publishCustomerInfoEvidence).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ customerInfo: stale, entitlement: staleEntitlement }),
    );
    expect(h.runRevenueCatResultWrite).toHaveBeenNthCalledWith(1, newer, expect.any(Function));
    expect(h.runRevenueCatResultWrite).toHaveBeenNthCalledWith(2, stale, expect.any(Function));
    expect(h.saveVerifiedEntitlement).not.toHaveBeenCalled();
    expect(h.clearStoreEntitlement).not.toHaveBeenCalled();
  });

  it('does not hide an equal-or-older queued snapshot from the evidence conflict engine', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const older = { requestDate: '2026-07-14T00:00:00.000Z', product: 'older' };
    const newer = { requestDate: '2026-07-14T00:00:01.000Z', product: 'newer' };
    const olderEntitlement = {
      tier: 'pro' as const,
      isActive: false,
      productId: 'pro.older',
    };
    const newerEntitlement = {
      tier: 'pro' as const,
      isActive: true,
      productId: 'pro.newer',
    };
    const initialRead = deferred<unknown>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    h.getCustomerInfo.mockReturnValueOnce(initialRead.promise);
    h.customerInfoToStoredEntitlement.mockImplementation((customerInfo) =>
      customerInfo === newer ? newerEntitlement : olderEntitlement,
    );

    await mount();
    await vi.waitFor(() => expect(h.getCustomerInfo).toHaveBeenCalledOnce());
    const listener = h.state.customerInfoListener;
    expect(listener).not.toBeNull();
    let bufferedWrite!: Promise<void>;
    await act(async () => {
      bufferedWrite = Promise.resolve(listener?.(older));
      await Promise.resolve();
    });

    initialRead.resolve(newer);
    await act(async () => {
      await bufferedWrite;
    });
    await flush();

    expect(h.customerInfoToStoredEntitlement.mock.calls).toEqual([[older], [newer]]);
    expect(h.publishCustomerInfoEvidence).toHaveBeenCalledTimes(2);
    expect(h.publishCustomerInfoEvidence).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ customerInfo: older, entitlement: olderEntitlement }),
    );
    expect(h.publishCustomerInfoEvidence).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ customerInfo: newer, entitlement: newerEntitlement }),
    );
    expect(h.runRevenueCatResultWrite).toHaveBeenNthCalledWith(1, older, expect.any(Function));
    expect(h.runRevenueCatResultWrite).toHaveBeenNthCalledWith(2, newer, expect.any(Function));
  });

  it('serializes CustomerInfo callback persistence in arrival order', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const first = { requestDate: '2026-07-14T00:00:01.000Z', product: 'first' };
    const second = { requestDate: '2026-07-14T00:00:02.000Z', product: 'second' };
    const firstEntitlement = { tier: 'pro' as const, isActive: true, productId: 'pro.first' };
    const secondEntitlement = { tier: 'pro' as const, isActive: true, productId: 'pro.second' };
    const firstPublish = deferred<{
      status: 'committed';
      disposition: 'applied';
      snapshot: { hasConflict: false; activeStoreEntitlement: unknown };
      requiresUncachedRefresh: false;
    }>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    h.customerInfoToStoredEntitlement.mockImplementation((customerInfo) =>
      customerInfo === first ? firstEntitlement : secondEntitlement,
    );
    h.publishCustomerInfoEvidence.mockReturnValueOnce(firstPublish.promise).mockResolvedValueOnce({
      status: 'committed',
      disposition: 'applied',
      snapshot: { hasConflict: false, activeStoreEntitlement: secondEntitlement },
      requiresUncachedRefresh: false,
    });

    await mount();
    const listener = h.state.customerInfoListener;
    expect(listener).not.toBeNull();
    const firstWrite = Promise.resolve(listener?.(first));
    await vi.waitFor(() => expect(h.publishCustomerInfoEvidence).toHaveBeenCalledOnce());
    const secondWrite = Promise.resolve(listener?.(second));
    expect(h.customerInfoToStoredEntitlement).toHaveBeenCalledOnce();
    expect(h.publishCustomerInfoEvidence).toHaveBeenCalledOnce();

    firstPublish.resolve({
      status: 'committed',
      disposition: 'applied',
      snapshot: { hasConflict: false, activeStoreEntitlement: firstEntitlement },
      requiresUncachedRefresh: false,
    });
    await act(async () => {
      await Promise.all([firstWrite, secondWrite]);
    });

    expect(h.publishCustomerInfoEvidence).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ customerInfo: first, entitlement: firstEntitlement }),
    );
    expect(h.publishCustomerInfoEvidence).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ customerInfo: second, entitlement: secondEntitlement }),
    );
  });

  it('re-asserts ticket authority after durable owner-bound evidence publication', async () => {
    const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
    const customerInfo = { requestDate: '2026-07-14T00:00:00.000Z' };
    const activeEntitlement = {
      tier: 'pro' as const,
      isActive: true,
      periodType: 'normal' as const,
      store: 'app_store' as const,
      productId: 'pro.monthly',
      expiresAt: null,
      willRenew: true,
      grantedAt: '2026-07-14T00:00:00.000Z',
    };
    const saved = deferred<{
      status: 'committed';
      disposition: 'applied';
      snapshot: { hasConflict: false; activeStoreEntitlement: typeof activeEntitlement };
      requiresUncachedRefresh: false;
    }>();
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    h.getCustomerInfo.mockResolvedValueOnce(customerInfo);
    h.customerInfoToStoredEntitlement.mockReturnValueOnce(activeEntitlement);
    h.publishCustomerInfoEvidence.mockReturnValueOnce(saved.promise);

    await mount();
    await vi.waitFor(() =>
      expect(h.publishCustomerInfoEvidence).toHaveBeenCalledWith(
        expect.objectContaining({ customerInfo, entitlement: activeEntitlement }),
      ),
    );
    expect(h.assertRevenueCatResultCurrent).toHaveBeenCalledTimes(2);

    saved.resolve({
      status: 'committed',
      disposition: 'applied',
      snapshot: { hasConflict: false, activeStoreEntitlement: activeEntitlement },
      requiresUncachedRefresh: false,
    });
    await flush();

    expect(h.assertRevenueCatResultCurrent).toHaveBeenCalledTimes(3);
    expect(h.assertRevenueCatResultCurrent.mock.invocationCallOrder[2]).toBeGreaterThan(
      h.publishCustomerInfoEvidence.mock.invocationCallOrder[0]!,
    );
    expect(h.saveVerifiedEntitlement).not.toHaveBeenCalled();
    expect(h.clearStoreEntitlement).not.toHaveBeenCalled();
  });

  it.each(['empty', 'publish_failure', 'stale_after_publish', 'conflict'] as const)(
    'never falls back to legacy entitlement mutation after %s evidence handling',
    async (mode) => {
      const owner = session(USER_A, SESSION_A, 'owner', 'refresh-owner');
      const customerInfo = { requestDate: '2026-07-14T00:00:00.000Z' };
      const activeEntitlement = {
        tier: 'pro' as const,
        isActive: true,
        periodType: 'normal' as const,
        store: 'app_store' as const,
        productId: 'pro.monthly',
        expiresAt: null,
        willRenew: true,
        grantedAt: '2026-07-14T00:00:00.000Z',
      };
      h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
      h.getCustomerInfo.mockResolvedValueOnce(customerInfo);
      h.customerInfoToStoredEntitlement.mockReturnValueOnce(
        mode === 'empty' ? null : activeEntitlement,
      );
      if (mode === 'publish_failure') {
        h.publishCustomerInfoEvidence.mockRejectedValueOnce(new Error('storage unavailable'));
      }
      if (mode === 'stale_after_publish') {
        h.assertRevenueCatResultCurrent.mockImplementationOnce(() => undefined);
        h.assertRevenueCatResultCurrent.mockImplementationOnce(() => undefined);
        h.assertRevenueCatResultCurrent.mockImplementationOnce(() => {
          h.state.activeUserId = null;
          h.state.activeSessionId = null;
          throw new Error('ACCOUNT_PUBLICATION_RESULT_STALE');
        });
      }
      if (mode === 'conflict') {
        h.publishCustomerInfoEvidence.mockResolvedValueOnce({
          status: 'conflict',
          disposition: 'conflict',
          snapshot: { hasConflict: true, activeStoreEntitlement: null },
          requiresUncachedRefresh: true,
        });
      }

      await mount();
      await flush();

      expect(h.publishCustomerInfoEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          customerInfo,
          entitlement: mode === 'empty' ? null : activeEntitlement,
        }),
      );
      expect(h.clearStoreEntitlement).not.toHaveBeenCalled();
      expect(h.saveVerifiedEntitlement).not.toHaveBeenCalled();
      if (mode === 'publish_failure' || mode === 'conflict') {
        await vi.waitFor(() => expect(h.getUncachedCustomerInfo).toHaveBeenCalledOnce());
      } else {
        expect(h.getUncachedCustomerInfo).not.toHaveBeenCalled();
      }
    },
  );

  it('recovers a listener publication failure from an uncached CustomerInfo read', async () => {
    const owner = session(USER_A, SESSION_A, 'listener-recovery', 'refresh-listener');
    const uncached = { requestDate: '2026-07-14T00:00:03.000Z', source: 'uncached' };
    const entitlement = {
      tier: 'pro' as const,
      isActive: true,
      productId: 'pro.monthly',
    };
    h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
    h.getUncachedCustomerInfo.mockResolvedValueOnce(uncached);
    h.customerInfoToStoredEntitlement.mockReturnValueOnce(entitlement);

    await mount();
    const onListenerError = h.state.customerInfoListenerError;
    expect(onListenerError).not.toBeNull();
    await act(async () => {
      await onListenerError?.(new Error('listener publication failed'), { stale: true });
    });
    await flush();

    expect(h.getUncachedCustomerInfo).toHaveBeenCalledOnce();
    expect(h.publishCustomerInfoEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ customerInfo: uncached, entitlement }),
    );
  });

  it('bounds uncached listener recovery to two attempts', async () => {
    vi.useFakeTimers();
    try {
      const owner = session(USER_A, SESSION_A, 'listener-bounded', 'refresh-listener');
      h.auth.getSession.mockResolvedValueOnce({ data: { session: owner }, error: null });
      h.getUncachedCustomerInfo.mockRejectedValue(new Error('RevenueCat unavailable'));

      await mount();
      const onListenerError = h.state.customerInfoListenerError;
      expect(onListenerError).not.toBeNull();
      await act(async () => {
        await onListenerError?.(new Error('listener publication failed'), { stale: true });
      });
      await flush();
      expect(h.getUncachedCustomerInfo).toHaveBeenCalledOnce();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      await flush();
      expect(h.getUncachedCustomerInfo).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      await flush();
      expect(h.getUncachedCustomerInfo).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
