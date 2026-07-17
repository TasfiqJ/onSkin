import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

import {
  acceptAccountDeletionAndSignOut,
  accountDeletionCleanupOptions,
  type AccountDeletionOwnershipDependencies,
  completeAccountDeletionLocalSignOut,
  fetchAccountDeletionStatus,
  finalizeCompletedAccountDeletion,
  parseAccountDeletionStatusResponse,
  quarantineAccountDeletionSession,
  resolveAccountDeletionRecoveryOwnership,
} from './accountDeletionRecovery';
import {
  closeSupabaseRemoteRequestBoundary,
  supabaseRemoteRequestAdmission,
} from '@/lib/supabase/remoteRequestGate';
import { SupabaseRemoteRequestAdmissionError } from '@/lib/supabase/remoteRequestAdmission';

const CAPABILITY = '02'.repeat(32);
const OWNER_A = 'a1'.repeat(32);
const OWNER_B = 'b2'.repeat(32);
const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b2';
const RECORD_A = {
  version: 2,
  ownerBinding: OWNER_A,
  state: 'ambiguous',
  createdAt: '2026-07-13T20:00:00.000Z',
  idempotencyKey: '01'.repeat(32),
  statusCapability: CAPABILITY,
} as const;
const SESSION_A = '10000000-0000-4000-8000-0000000000a1';

function recoveryJwt(subject = USER_A): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: 4_000_000_000, session_id: SESSION_A, sub: subject }),
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const mocks = vi.hoisted(() => ({
  cancelQueries: vi.fn(),
  cancelScheduledNotifications: vi.fn(),
  clearCompletedAccountDeletionState: vi.fn(),
  clearDependentConsentWithdrawalTombstonesByOwnerBinding: vi.fn(),
  clearPendingHealthWithdrawalIntentByOwnerBinding: vi.fn(),
  clearAccountIsolatedState: vi.fn(),
  clearPersistedSupabaseSession: vi.fn(),
  convertStoreTransactionNoticeForTerminalDeletion: vi.fn(),
  clearQueries: vi.fn(),
  clearRoutineWidgetActions: vi.fn(),
  clearRoutineWidgetNativeState: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  localDataOwnerBinding: vi.fn(),
  markAccountDeletionIntakeState: vi.fn(),
  purgeSensitiveImageMemory: vi.fn(),
  quarantineUnclaimedLocalData: vi.fn(),
  readLocalDataOwnerProofBinding: vi.fn(),
  queueAppleManualRevocationNotice: vi.fn(),
  retainLocalDataOwner: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
  resetRevenueCatIdentity: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: mocks.cancelScheduledNotifications,
}));

vi.mock('@/features/photos/sensitiveImageMemory', () => ({
  purgeSensitiveImageMemory: mocks.purgeSensitiveImageMemory,
}));

vi.mock('@/features/widgets/lifecycleCoordinator', () => ({
  clearRoutineWidgetLifecycleForPrivacy: mocks.clearRoutineWidgetNativeState,
}));

vi.mock('@/features/widgets/actionRegistry', () => ({
  clearRoutineWidgetActions: mocks.clearRoutineWidgetActions,
}));

vi.mock('@/features/healthConsent/pendingIntent', () => ({
  clearPendingHealthWithdrawalIntentByOwnerBinding:
    mocks.clearPendingHealthWithdrawalIntentByOwnerBinding,
}));

vi.mock('@/lib/consent/dependentConsentLocal', () => ({
  clearAllDependentConsentWithdrawalTombstonesByOwnerBinding:
    mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding,
}));

vi.mock('@/lib/analytics/track', () => ({
  resetAnalyticsIdentity: mocks.resetAnalyticsIdentity,
}));

vi.mock('@/lib/iap/revenuecat', () => ({
  resetRevenueCatIdentity: mocks.resetRevenueCatIdentity,
}));

vi.mock('@/lib/iap/storeTransactionNotice', () => ({
  convertStoreTransactionNoticeForTerminalDeletion:
    mocks.convertStoreTransactionNoticeForTerminalDeletion,
}));

vi.mock('@/lib/query/queryClient', () => ({
  queryClient: {
    cancelQueries: mocks.cancelQueries,
    clear: mocks.clearQueries,
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://project.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
  },
  isSupabaseConfigured: true,
}));

vi.mock('@/lib/auth/localAccountIsolation', () => ({
  clearAccountIsolatedState: mocks.clearAccountIsolatedState,
}));

vi.mock('@/lib/auth/sessionOwner', () => ({
  localDataOwnerBinding: mocks.localDataOwnerBinding,
  quarantineUnclaimedLocalDataForSignedOutRestore: mocks.quarantineUnclaimedLocalData,
  readLocalDataOwnerProofBinding: mocks.readLocalDataOwnerProofBinding,
  retainLocalDataOwnerForSignedOutRestore: mocks.retainLocalDataOwner,
}));

vi.mock('@/lib/supabase/client', () => ({
  clearPersistedSupabaseSession: mocks.clearPersistedSupabaseSession,
  readPersistedSupabaseSessionCandidate: async () => {
    const result = await mocks.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  },
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
  },
}));

vi.mock('./accountDeletionClientState', () => ({
  accountDeletionRecordMatchesOwner: (
    record: { version: number; ownerBinding?: string },
    ownerBinding: string,
  ) => record.version === 2 && record.ownerBinding === ownerBinding,
  clearCompletedAccountDeletionState: mocks.clearCompletedAccountDeletionState,
  markAccountDeletionIntakeState: mocks.markAccountDeletionIntakeState,
}));

vi.mock('./accountDeletionNotice', () => ({
  queueAppleManualRevocationNotice: mocks.queueAppleManualRevocationNotice,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ownershipDependencies(input: {
  localOwnerBinding: string | null;
  sessionUserId: string | null;
  verifiedUserId?: string | null;
}): AccountDeletionOwnershipDependencies {
  const session = input.sessionUserId
    ? {
        access_token: `token-${input.sessionUserId}`,
        user: { id: input.sessionUserId },
      }
    : null;
  return {
    readSessionCandidate: vi.fn(
      async () => session as unknown as Session | null,
    ) as unknown as AccountDeletionOwnershipDependencies['readSessionCandidate'],
    verifyUser: vi.fn(async () => ({
      data: {
        user:
          input.verifiedUserId === null
            ? null
            : { id: input.verifiedUserId ?? input.sessionUserId },
      },
      error: null,
    })) as unknown as AccountDeletionOwnershipDependencies['verifyUser'],
    readLocalOwnerBinding: vi.fn(async () => input.localOwnerBinding),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cancelQueries.mockResolvedValue(undefined);
  mocks.cancelScheduledNotifications.mockResolvedValue(undefined);
  mocks.clearAccountIsolatedState.mockResolvedValue(undefined);
  mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding.mockResolvedValue(undefined);
  mocks.clearPersistedSupabaseSession.mockResolvedValue(undefined);
  mocks.convertStoreTransactionNoticeForTerminalDeletion.mockResolvedValue(undefined);
  mocks.clearQueries.mockReturnValue(undefined);
  mocks.clearRoutineWidgetNativeState.mockResolvedValue(undefined);
  mocks.clearRoutineWidgetActions.mockResolvedValue(undefined);
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: 'quarantined-access-token', user: { id: USER_A } } },
    error: null,
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_A } }, error: null });
  mocks.localDataOwnerBinding.mockImplementation(async (userId: string) =>
    userId === USER_A ? OWNER_A : OWNER_B,
  );
  mocks.markAccountDeletionIntakeState.mockResolvedValue({
    version: 2,
    ownerBinding: OWNER_A,
    state: 'accepted',
    createdAt: '2026-07-13T20:00:00.000Z',
    idempotencyKey: '01'.repeat(32),
    statusCapability: CAPABILITY,
  });
  mocks.purgeSensitiveImageMemory.mockResolvedValue(undefined);
  mocks.quarantineUnclaimedLocalData.mockResolvedValue(undefined);
  mocks.readLocalDataOwnerProofBinding.mockResolvedValue(OWNER_A);
  mocks.retainLocalDataOwner.mockResolvedValue(undefined);
  mocks.resetAnalyticsIdentity.mockResolvedValue(undefined);
  mocks.resetRevenueCatIdentity.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue({ error: null });
});

describe('account-deletion recovery session boundary', () => {
  it('quarantines local/vendor/query state without touching the encrypted auth session', async () => {
    await expect(quarantineAccountDeletionSession()).resolves.toBeUndefined();

    expect(mocks.clearAccountIsolatedState).toHaveBeenCalledOnce();
    expect(mocks.cancelQueries).toHaveBeenCalledTimes(2);
    expect(mocks.clearQueries).toHaveBeenCalledTimes(2);
    expect(mocks.purgeSensitiveImageMemory).toHaveBeenCalledOnce();
    expect(mocks.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(mocks.cancelScheduledNotifications).toHaveBeenCalledOnce();
    expect(mocks.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
  });

  it('attempts every vendor/auth-derived stage and fails closed after isolated cleanup fails', async () => {
    mocks.clearAccountIsolatedState.mockRejectedValueOnce(new Error('private cleanup failed'));
    mocks.resetAnalyticsIdentity.mockRejectedValueOnce(new Error('analytics reset failed'));

    await expect(quarantineAccountDeletionSession()).rejects.toThrow('private cleanup failed');

    expect(mocks.cancelQueries).toHaveBeenCalledTimes(2);
    expect(mocks.clearQueries).toHaveBeenCalledTimes(2);
    expect(mocks.cancelScheduledNotifications).toHaveBeenCalledOnce();
    expect(mocks.clearRoutineWidgetNativeState).toHaveBeenCalledOnce();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
  });

  it('clears persisted auth directly after capability polling proves acceptance', async () => {
    await expect(completeAccountDeletionLocalSignOut()).resolves.toBeUndefined();

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).toHaveBeenCalledOnce();
    expect(mocks.clearAccountIsolatedState).toHaveBeenCalledOnce();
    expect(mocks.cancelQueries).toHaveBeenCalledTimes(2);
    expect(mocks.clearQueries).toHaveBeenCalledTimes(2);
    expect(mocks.cancelScheduledNotifications).toHaveBeenCalledOnce();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding).not.toHaveBeenCalled();
  });

  it('persists acceptance before clearing a committed-response-loss retry session', async () => {
    const order: string[] = [];
    await expect(
      acceptAccountDeletionAndSignOut(RECORD_A, {
        markAccepted: vi.fn(async (ownerBinding: string) => {
          expect(ownerBinding).toBe(OWNER_A);
          order.push('accepted');
          return { ...RECORD_A, state: 'accepted' } as const;
        }),
        clearSession: vi.fn(async () => {
          order.push('session');
        }),
        clearIsolatedState: vi.fn(async () => {
          order.push('local');
        }),
        clearAuthDerivedActivity: vi.fn(async () => {
          order.push('derived');
        }),
        quarantineUnclaimedLocalData: vi.fn(async () => {}),
        retainLocalDataOwner: vi.fn(async () => {}),
      }),
    ).resolves.toBeUndefined();

    expect(order).toEqual(['derived', 'accepted', 'session', 'local']);
    expect(mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding).not.toHaveBeenCalled();
  });

  it('closes native admission before accepted-marker I/O and awaits that purge before session clear', async () => {
    const acceptedMarker = deferred<void>();
    const authDerivedCleanup = deferred<void>();
    const clearAuthDerivedActivity = vi.fn(() => authDerivedCleanup.promise);
    const markAccepted = vi.fn(async () => {
      await acceptedMarker.promise;
      return { ...RECORD_A, state: 'accepted' } as const;
    });
    const clearSession = vi.fn(async () => {});

    const completion = acceptAccountDeletionAndSignOut(RECORD_A, {
      markAccepted,
      clearSession,
      clearIsolatedState: vi.fn(async () => {}),
      clearAuthDerivedActivity,
      quarantineUnclaimedLocalData: vi.fn(async () => {}),
      retainLocalDataOwner: vi.fn(async () => {}),
    });

    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
    expect(markAccepted).toHaveBeenCalledOnce();
    expect(clearAuthDerivedActivity.mock.invocationCallOrder[0]).toBeLessThan(
      markAccepted.mock.invocationCallOrder[0]!,
    );
    expect(clearSession).not.toHaveBeenCalled();

    acceptedMarker.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(clearSession).not.toHaveBeenCalled();

    authDerivedCleanup.resolve();
    await completion;
    expect(clearSession).toHaveBeenCalledOnce();
    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });

  it('attempts all three cleanup stages and reports the first failure', async () => {
    const clearIsolatedState = vi.fn().mockRejectedValue(new Error('isolated clear unavailable'));
    const clearAuthDerivedActivity = vi.fn().mockResolvedValue(undefined);
    await expect(
      completeAccountDeletionLocalSignOut({
        clearSession: vi.fn().mockRejectedValue(new Error('session clear unavailable')),
        clearIsolatedState,
        clearAuthDerivedActivity,
        quarantineUnclaimedLocalData: vi.fn(async () => {}),
        retainLocalDataOwner: vi.fn(async () => {}),
      }),
    ).rejects.toThrow('session clear unavailable');

    expect(clearIsolatedState).toHaveBeenCalledOnce();
    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });

  it('starts native-bearing auth cleanup before owner retention and observes that same promise', async () => {
    let releaseOwnerRetention!: () => void;
    let releaseAuthDerivedCleanup!: () => void;
    const retainLocalDataOwner = vi.fn(
      () => new Promise<void>((resolve) => (releaseOwnerRetention = resolve)),
    );
    const clearAuthDerivedActivity = vi.fn(
      () => new Promise<void>((resolve) => (releaseAuthDerivedCleanup = resolve)),
    );
    const clearSession = vi.fn(async () => {});

    const completion = completeAccountDeletionLocalSignOut(
      {
        clearSession,
        clearIsolatedState: vi.fn(async () => {}),
        clearAuthDerivedActivity,
        quarantineUnclaimedLocalData: vi.fn(async () => {}),
        retainLocalDataOwner,
      },
      {
        clearSession: true,
        clearIsolatedState: false,
        quarantineUnclaimedLocalData: false,
        retainLocalDataOwner: true,
      },
    );

    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
    expect(retainLocalDataOwner).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();

    releaseAuthDerivedCleanup();
    await vi.waitFor(() => expect(retainLocalDataOwner).toHaveBeenCalledOnce());
    expect(clearAuthDerivedActivity.mock.invocationCallOrder[0]).toBeLessThan(
      retainLocalDataOwner.mock.invocationCallOrder[0]!,
    );
    expect(clearSession).not.toHaveBeenCalled();

    releaseOwnerRetention();
    await vi.waitFor(() => expect(clearSession).toHaveBeenCalledOnce());
    await completion;
    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });
});

describe('account-deletion recovery ownership boundary', () => {
  it('uses a one-shot candidate verification permit while the pre-Auth gate is closed', async () => {
    const accessToken = recoveryJwt();
    let observedState: string | null = null;
    mocks.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: accessToken,
          expires_at: 4_000_000_000,
          refresh_token: 'retained-refresh-token',
          user: { id: USER_A },
        },
      },
      error: null,
    });
    mocks.getUser.mockImplementationOnce(async (observedToken: string) => {
      observedState = supabaseRemoteRequestAdmission.snapshot().state;
      const response = await supabaseRemoteRequestAdmission.createFetch(async () =>
        jsonResponse(200, { id: USER_A }),
      )('https://project.supabase.co/auth/v1/user', {
        method: 'GET',
        headers: {
          apikey: 'sb_publishable_test',
          Authorization: `Bearer ${observedToken}`,
        },
      });
      return { data: { user: await response.json() }, error: null };
    });

    await expect(resolveAccountDeletionRecoveryOwnership(RECORD_A)).resolves.toEqual({
      localData: 'match',
      session: 'match',
    });

    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(observedState).toBe('candidate');
    expect(supabaseRemoteRequestAdmission.snapshot()).toMatchObject({
      inFlight: 0,
      state: 'closed',
      subject: null,
    });
  });

  it('holds the pre-Auth gate when local owner storage cannot be read', async () => {
    const dependencies = ownershipDependencies({
      localOwnerBinding: OWNER_B,
      sessionUserId: USER_B,
    });
    vi.mocked(dependencies.readLocalOwnerBinding).mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    await expect(resolveAccountDeletionRecoveryOwnership(RECORD_A, dependencies)).rejects.toThrow(
      'ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE',
    );

    expect(dependencies.readSessionCandidate).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'session storage throws',
      arrange(dependencies: AccountDeletionOwnershipDependencies) {
        vi.mocked(dependencies.readSessionCandidate).mockRejectedValueOnce(
          new Error('storage offline'),
        );
      },
    },
    {
      label: 'encrypted session reader rejects malformed state',
      arrange(dependencies: AccountDeletionOwnershipDependencies) {
        vi.mocked(dependencies.readSessionCandidate).mockRejectedValueOnce(
          new Error('SUPABASE_PERSISTED_SESSION_INVALID'),
        );
      },
    },
    {
      label: 'bearer verification throws',
      arrange(dependencies: AccountDeletionOwnershipDependencies) {
        vi.mocked(dependencies.verifyUser).mockRejectedValueOnce(new Error('Auth offline'));
      },
    },
    {
      label: 'bearer verification returns a non-authoritative error',
      arrange(dependencies: AccountDeletionOwnershipDependencies) {
        vi.mocked(dependencies.verifyUser).mockResolvedValueOnce({
          data: { user: null },
          error: { status: 503 },
        } as never);
      },
    },
    {
      label: 'bearer verification returns no user without an error',
      arrange(dependencies: AccountDeletionOwnershipDependencies) {
        vi.mocked(dependencies.verifyUser).mockResolvedValueOnce({
          data: { user: null },
          error: null,
        } as never);
      },
    },
  ])('retains retry authority when $label', async ({ arrange }) => {
    const dependencies = ownershipDependencies({
      localOwnerBinding: OWNER_A,
      sessionUserId: USER_A,
    });
    arrange(dependencies);

    await expect(resolveAccountDeletionRecoveryOwnership(RECORD_A, dependencies)).rejects.toThrow(
      'ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE',
    );

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
    expect(mocks.markAccountDeletionIntakeState).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    'consumes retry authority only after authoritative bearer rejection %s',
    async (status) => {
      const dependencies = ownershipDependencies({
        localOwnerBinding: OWNER_A,
        sessionUserId: USER_A,
      });
      vi.mocked(dependencies.verifyUser).mockResolvedValueOnce({
        data: { user: null },
        error: { status },
      } as never);

      await expect(
        resolveAccountDeletionRecoveryOwnership(RECORD_A, dependencies),
      ).resolves.toEqual({ localData: 'match', session: 'rejected' });
    },
  );

  it('uses the verified bearer subject instead of a mismatched cached session user', async () => {
    await expect(
      resolveAccountDeletionRecoveryOwnership(
        RECORD_A,
        ownershipDependencies({
          localOwnerBinding: OWNER_A,
          sessionUserId: USER_B,
          verifiedUserId: USER_A,
        }),
      ),
    ).resolves.toEqual({ localData: 'match', session: 'match' });
  });

  it('retains retry authority when Auth returns a malformed successful subject', async () => {
    const dependencies = ownershipDependencies({
      localOwnerBinding: OWNER_A,
      sessionUserId: USER_A,
      verifiedUserId: '00000000-0000-4000-8000-0000000000A1',
    });

    await expect(resolveAccountDeletionRecoveryOwnership(RECORD_A, dependencies)).rejects.toThrow(
      'ACCOUNT_DELETION_OWNERSHIP_UNAVAILABLE',
    );

    expect(mocks.localDataOwnerBinding).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
  });

  it('authorizes private cleanup only with matching local and server-verified owners', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      RECORD_A,
      ownershipDependencies({
        localOwnerBinding: OWNER_A,
        sessionUserId: USER_A,
      }),
    );

    expect(ownership).toEqual({ localData: 'match', session: 'match' });
    expect(accountDeletionCleanupOptions(ownership)).toEqual({
      clearSession: true,
      clearIsolatedState: true,
      quarantineUnclaimedLocalData: false,
      retainLocalDataOwner: false,
    });
  });

  it('clears B Auth/vendor/query identity for an A record but preserves B private data', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      RECORD_A,
      ownershipDependencies({
        localOwnerBinding: OWNER_B,
        sessionUserId: USER_B,
      }),
    );
    const options = accountDeletionCleanupOptions(ownership);

    expect(ownership).toEqual({ localData: 'foreign', session: 'foreign' });
    expect(options).toEqual({
      clearSession: true,
      clearIsolatedState: false,
      quarantineUnclaimedLocalData: false,
      retainLocalDataOwner: true,
    });

    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-user-b', user: { id: USER_B } } },
      error: null,
    });
    await expect(completeAccountDeletionLocalSignOut(undefined, options)).resolves.toBeUndefined();

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).toHaveBeenCalledOnce();
    expect(mocks.cancelQueries).toHaveBeenCalledTimes(2);
    expect(mocks.clearQueries).toHaveBeenCalledTimes(2);
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
    expect(mocks.retainLocalDataOwner).toHaveBeenCalledOnce();
    expect(mocks.retainLocalDataOwner.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearPersistedSupabaseSession.mock.invocationCallOrder[0]!,
    );
  });

  it('uses matching v2 and local bindings to clear A private data after A Auth is absent', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      RECORD_A,
      ownershipDependencies({
        localOwnerBinding: OWNER_A,
        sessionUserId: null,
      }),
    );

    expect(ownership).toEqual({ localData: 'match', session: 'none' });
    expect(accountDeletionCleanupOptions(ownership)).toEqual({
      clearSession: true,
      clearIsolatedState: true,
      quarantineUnclaimedLocalData: false,
      retainLocalDataOwner: false,
    });
  });

  it('commits ownerless quarantine before clearing an unclaimed recovery session', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      RECORD_A,
      ownershipDependencies({
        localOwnerBinding: null,
        sessionUserId: USER_A,
      }),
    );
    const options = accountDeletionCleanupOptions(ownership);

    expect(ownership).toEqual({ localData: 'unclaimed', session: 'match' });
    expect(options).toEqual({
      clearSession: true,
      clearIsolatedState: false,
      quarantineUnclaimedLocalData: true,
      retainLocalDataOwner: false,
    });

    await expect(completeAccountDeletionLocalSignOut(undefined, options)).resolves.toBeUndefined();

    expect(mocks.quarantineUnclaimedLocalData).toHaveBeenCalledOnce();
    expect(mocks.quarantineUnclaimedLocalData.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearPersistedSupabaseSession.mock.invocationCallOrder[0]!,
    );
    expect(mocks.retainLocalDataOwner).not.toHaveBeenCalled();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
  });

  it('gives legacy evidence no private cleanup authority while preserving an existing owner', async () => {
    const legacy = {
      version: 1,
      ownerBinding: null,
      state: 'invalid',
      createdAt: RECORD_A.createdAt,
      idempotencyKey: RECORD_A.idempotencyKey,
      statusCapability: RECORD_A.statusCapability,
    } as const;
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      legacy,
      ownershipDependencies({
        localOwnerBinding: OWNER_A,
        sessionUserId: USER_A,
      }),
    );

    expect(ownership).toEqual({ localData: 'foreign', session: 'unverified' });
    expect(accountDeletionCleanupOptions(ownership)).toEqual({
      clearSession: true,
      clearIsolatedState: false,
      quarantineUnclaimedLocalData: false,
      retainLocalDataOwner: true,
    });
  });
});

describe('account-deletion public status contract', () => {
  it('uses only the capability plus the public project key and accepts exact pending state', async () => {
    const transport = vi.fn().mockResolvedValue(
      jsonResponse(202, {
        status: 'pending',
        phase: 'provider_verifying',
        nextPollAfterSeconds: 30,
      }),
    );

    await expect(fetchAccountDeletionStatus(CAPABILITY, transport)).resolves.toEqual({
      kind: 'pending',
      status: 'pending',
      phase: 'provider_verifying',
      nextPollAfterSeconds: 30,
    });

    expect(transport).toHaveBeenCalledOnce();
    const request = transport.mock.calls[0]![0] as Request;
    expect(request).toBeInstanceOf(Request);
    expect(request.url).toBe('https://project.supabase.co/functions/v1/account-deletion');
    expect(request.method).toBe('POST');
    expect(request.cache).toBe('no-store');
    expect(request.credentials).toBe('omit');
    expect(request.redirect).toBe('manual');
    expect(request.headers.get('apikey')).toBe('sb_publishable_test');
    expect(request.headers.get('accept')).toBe('application/json');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.has('authorization')).toBe(false);
    await expect(request.clone().text()).resolves.toBe(
      JSON.stringify({ action: 'status', capability: CAPABILITY }),
    );
    expect(request.signal.aborted).toBe(false);
  });

  it('aborts status polling at 15 seconds and preserves every recovery authority', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    try {
      const transport = vi.fn(
        (input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const request = new Request(input, init);
            requestSignal = request.signal;
            request.signal.addEventListener(
              'abort',
              () => {
                const error = new Error('request aborted');
                error.name = 'AbortError';
                reject(error);
              },
              { once: true },
            );
          }),
      );
      const status = fetchAccountDeletionStatus(CAPABILITY, transport);
      const observedError = status.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(14_999);
      expect(requestSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await expect(observedError).resolves.toMatchObject({
        message: 'ACCOUNT_DELETION_STATUS_UNAVAILABLE',
      });
      expect(requestSignal?.aborted).toBe(true);
      expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
      expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
      expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
      expect(mocks.queueAppleManualRevocationNotice).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the status deadline after an early response without a later signal abort', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    try {
      const transport = vi.fn((input: string | URL | Request, init?: RequestInit) => {
        requestSignal = new Request(input, init).signal;
        return Promise.resolve(
          jsonResponse(202, {
            status: 'pending',
            phase: 'queued',
            nextPollAfterSeconds: 2,
          }),
        );
      });

      await expect(fetchAccountDeletionStatus(CAPABILITY, transport)).resolves.toEqual({
        kind: 'pending',
        status: 'pending',
        phase: 'queued',
        nextPollAfterSeconds: 2,
      });

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(requestSignal?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a timed-out status result unavailable when an abort-ignoring transport completes late', async () => {
    vi.useFakeTimers();
    let completeTransport: ((response: Response) => void) | undefined;
    try {
      const transport = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            completeTransport = resolve;
          }),
      );
      const settlements: string[] = [];
      const observed = fetchAccountDeletionStatus(CAPABILITY, transport).then(
        () => {
          settlements.push('completed');
          return 'completed';
        },
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          settlements.push(message);
          return message;
        },
      );

      await vi.advanceTimersByTimeAsync(15_000);
      await expect(observed).resolves.toBe('ACCOUNT_DELETION_STATUS_UNAVAILABLE');

      completeTransport?.(jsonResponse(200, { status: 'completed' }));
      await vi.advanceTimersByTimeAsync(0);

      expect(settlements).toEqual(['ACCOUNT_DELETION_STATUS_UNAVAILABLE']);
      expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
      expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
      expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a capability result when an account boundary invalidates its semantic permit', async () => {
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const transport = vi.fn(
      (input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const request = new Request(input, init);
          requestStarted();
          request.signal.addEventListener(
            'abort',
            () => reject(new Error('aborted by account boundary')),
            { once: true },
          );
        }),
    );

    const status = fetchAccountDeletionStatus(CAPABILITY, transport);
    await started;
    const closed = closeSupabaseRemoteRequestBoundary();

    await expect(status).rejects.toThrow('ACCOUNT_DELETION_STATUS_UNAVAILABLE');
    await closed;
    expect(transport).toHaveBeenCalledOnce();
  });

  it('accepts the exact completed response and optional Apple notice', () => {
    expect(parseAccountDeletionStatusResponse(200, { status: 'completed' })).toEqual({
      kind: 'completed',
      notice: null,
    });
    expect(
      parseAccountDeletionStatusResponse(200, {
        status: 'completed',
        notice: 'remove_apple_authorization',
      }),
    ).toEqual({ kind: 'completed', notice: 'remove_apple_authorization' });
  });

  it('maps exact invalid and expired receipts without treating them as completion', async () => {
    const invalid = vi.fn().mockResolvedValue(jsonResponse(404, { status: 'invalid' }));
    const expired = vi.fn().mockResolvedValue(jsonResponse(410, { status: 'expired' }));

    await expect(fetchAccountDeletionStatus(CAPABILITY, invalid)).resolves.toEqual({
      kind: 'invalid',
    });
    await expect(fetchAccountDeletionStatus(CAPABILITY, expired)).resolves.toEqual({
      kind: 'expired',
    });
  });

  it.each([
    [200, { status: 'completed', extra: true }],
    [200, { status: 'completed', notice: 'provider_copy' }],
    [202, { status: 'accepted', phase: 'queued', nextPollAfterSeconds: 2 }],
    [202, { status: 'pending', phase: 'delayed', nextPollAfterSeconds: 60 }],
    [202, { status: 'delayed', phase: 'processing', nextPollAfterSeconds: 60 }],
    [202, { status: 'pending', phase: 'queued', nextPollAfterSeconds: 1 }],
    [404, { status: 'expired' }],
    [410, { status: 'invalid' }],
  ])('rejects malformed or status/body-mismatched response %#', (status, body) => {
    expect(() => parseAccountDeletionStatusResponse(status, body)).toThrow(
      'ACCOUNT_DELETION_STATUS_RESPONSE_INVALID',
    );
  });

  it('preserves recovery on transport, unexpected HTTP, and malformed JSON failures', async () => {
    await expect(
      fetchAccountDeletionStatus(CAPABILITY, vi.fn().mockRejectedValue(new Error('offline'))),
    ).rejects.toThrow('ACCOUNT_DELETION_STATUS_UNAVAILABLE');
    await expect(
      fetchAccountDeletionStatus(
        CAPABILITY,
        vi.fn().mockResolvedValue(jsonResponse(503, { error: 'unavailable' })),
      ),
    ).rejects.toThrow('ACCOUNT_DELETION_STATUS_UNAVAILABLE');
    await expect(
      fetchAccountDeletionStatus(
        CAPABILITY,
        vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })),
      ),
    ).rejects.toThrow('ACCOUNT_DELETION_STATUS_RESPONSE_INVALID');
  });
});

describe('account-deletion local terminal commit', () => {
  const completed = {
    version: 2,
    ownerBinding: OWNER_A,
    state: 'completed',
    createdAt: '2026-07-13T20:00:00.000Z',
    idempotencyKey: '01'.repeat(32),
    statusCapability: CAPABILITY,
    notice: 'remove_apple_authorization',
  } as const;

  it('waits for quarantined remote work and recloses before auth storage mutation', async () => {
    const close = vi
      .spyOn(supabaseRemoteRequestAdmission, 'close')
      .mockRejectedValueOnce(
        new SupabaseRemoteRequestAdmissionError('SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED'),
      )
      .mockResolvedValue(undefined);
    const waitForResidual = vi
      .spyOn(supabaseRemoteRequestAdmission, 'waitForResidualSettlement')
      .mockResolvedValue(undefined);

    try {
      await expect(completeAccountDeletionLocalSignOut()).resolves.toBeUndefined();

      expect(close).toHaveBeenCalledTimes(3);
      expect(close.mock.invocationCallOrder[0]).toBeLessThan(
        waitForResidual.mock.invocationCallOrder[0]!,
      );
      expect(waitForResidual.mock.invocationCallOrder[0]).toBeLessThan(
        close.mock.invocationCallOrder[1]!,
      );
      expect(close.mock.invocationCallOrder[1]).toBeLessThan(close.mock.invocationCallOrder[2]!);
      expect(close.mock.invocationCallOrder[2]).toBeLessThan(
        mocks.clearPersistedSupabaseSession.mock.invocationCallOrder[0]!,
      );
    } finally {
      close.mockRestore();
      waitForResidual.mockRestore();
    }
  });

  it('closes native admission before terminal journal I/O and awaits that purge before session clear', async () => {
    const storeSafety = deferred<void>();
    const authDerivedCleanup = deferred<void>();
    const clearAuthDerivedActivity = vi.fn(() => authDerivedCleanup.promise);
    const convertStoreSafetyNotice = vi.fn(() => storeSafety.promise);
    const clearSession = vi.fn(async () => {});

    const completion = finalizeCompletedAccountDeletion(
      { ...completed, notice: null },
      {
        clearSession,
        clearIsolatedState: vi.fn(async () => {}),
        clearAuthDerivedActivity,
        quarantineUnclaimedLocalData: vi.fn(async () => {}),
        retainLocalDataOwner: vi.fn(async () => {}),
        convertStoreSafetyNotice,
        queueAppleNotice: vi.fn(),
        clearCompletedState: vi.fn(async () => {}),
      },
    );

    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
    expect(convertStoreSafetyNotice).toHaveBeenCalledOnce();
    expect(clearAuthDerivedActivity.mock.invocationCallOrder[0]).toBeLessThan(
      convertStoreSafetyNotice.mock.invocationCallOrder[0]!,
    );
    expect(clearSession).not.toHaveBeenCalled();

    storeSafety.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(clearSession).not.toHaveBeenCalled();

    authDerivedCleanup.resolve();
    await completion;
    expect(clearSession).toHaveBeenCalledOnce();
    expect(clearAuthDerivedActivity).toHaveBeenCalledOnce();
  });

  it('keeps the completed capability durable until Apple instructions are acknowledged', async () => {
    const order: string[] = [];
    await expect(
      finalizeCompletedAccountDeletion(completed, {
        clearSession: vi.fn(async () => {
          order.push('session');
        }),
        clearIsolatedState: vi.fn(async () => {
          order.push('local');
        }),
        clearAuthDerivedActivity: vi.fn(async () => {
          order.push('derived');
        }),
        quarantineUnclaimedLocalData: vi.fn(async () => {}),
        retainLocalDataOwner: vi.fn(async () => {}),
        convertStoreSafetyNotice: vi.fn(async () => {
          order.push('store-safety');
        }),
        queueAppleNotice: vi.fn(() => order.push('notice')),
        clearCompletedState: vi.fn(async () => {
          order.push('capability');
        }),
      }),
    ).resolves.toBe('manual_notice_pending');

    expect(order).toEqual(['derived', 'store-safety', 'session', 'local', 'notice']);
  });

  it('removes capability after local cleanup when no manual notice remains', async () => {
    const order: string[] = [];
    await expect(
      finalizeCompletedAccountDeletion(
        { ...completed, notice: null },
        {
          clearSession: vi.fn(async () => {
            order.push('session');
          }),
          clearIsolatedState: vi.fn(async () => {
            order.push('local');
          }),
          clearAuthDerivedActivity: vi.fn(async () => {
            order.push('derived');
          }),
          quarantineUnclaimedLocalData: vi.fn(async () => {}),
          retainLocalDataOwner: vi.fn(async () => {}),
          convertStoreSafetyNotice: vi.fn(async () => {
            order.push('store-safety');
          }),
          queueAppleNotice: vi.fn(() => order.push('notice')),
          clearCompletedState: vi.fn(async () => {
            order.push('capability');
          }),
        },
      ),
    ).resolves.toBe('cleared');
    expect(order).toEqual(['derived', 'store-safety', 'session', 'local', 'capability']);
  });

  it('clears only the terminally deleted owner withdrawal journal', async () => {
    await expect(finalizeCompletedAccountDeletion({ ...completed, notice: null })).resolves.toBe(
      'cleared',
    );

    expect(mocks.clearPendingHealthWithdrawalIntentByOwnerBinding).toHaveBeenCalledOnce();
    expect(mocks.clearPendingHealthWithdrawalIntentByOwnerBinding).toHaveBeenCalledWith(OWNER_A);
    expect(
      mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding,
    ).toHaveBeenCalledExactlyOnceWith(OWNER_A);
  });

  it('replays exact-owner dependent cleanup after completion-proof response loss', async () => {
    mocks.clearCompletedAccountDeletionState.mockRejectedValueOnce(
      new Error('completion proof delete lost'),
    );

    await expect(finalizeCompletedAccountDeletion({ ...completed, notice: null })).rejects.toThrow(
      'completion proof delete lost',
    );
    await expect(finalizeCompletedAccountDeletion({ ...completed, notice: null })).resolves.toBe(
      'cleared',
    );

    expect(mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding).toHaveBeenCalledTimes(2);
    expect(mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding).toHaveBeenNthCalledWith(
      1,
      OWNER_A,
    );
    expect(mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding).toHaveBeenNthCalledWith(
      2,
      OWNER_A,
    );
  });

  it('keeps terminal recovery retryable when dependent cleanup fails', async () => {
    mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding.mockRejectedValueOnce(
      new Error('dependent recovery unavailable'),
    );

    await expect(finalizeCompletedAccountDeletion({ ...completed, notice: null })).rejects.toThrow(
      'dependent recovery unavailable',
    );
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();

    await expect(finalizeCompletedAccountDeletion({ ...completed, notice: null })).resolves.toBe(
      'cleared',
    );
    expect(mocks.clearDependentConsentWithdrawalTombstonesByOwnerBinding).toHaveBeenCalledTimes(2);
  });

  it('finalizes completed A evidence without erasing B private data', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      { ...completed, notice: null },
      ownershipDependencies({
        localOwnerBinding: OWNER_B,
        sessionUserId: USER_B,
      }),
    );
    const options = accountDeletionCleanupOptions(ownership);

    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-user-b', user: { id: USER_B } } },
      error: null,
    });
    await expect(
      finalizeCompletedAccountDeletion({ ...completed, notice: null }, undefined, options),
    ).resolves.toBe('cleared');

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).toHaveBeenCalledOnce();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
    expect(mocks.retainLocalDataOwner).toHaveBeenCalledOnce();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
    expect(mocks.clearCompletedAccountDeletionState).toHaveBeenCalledOnce();
  });

  it('keeps recovery proof and the foreign session when retained-owner commit fails', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      { ...completed, notice: null },
      ownershipDependencies({
        localOwnerBinding: OWNER_B,
        sessionUserId: USER_B,
      }),
    );
    mocks.retainLocalDataOwner.mockRejectedValueOnce(new Error('owner marker unavailable'));

    await expect(
      finalizeCompletedAccountDeletion(
        { ...completed, notice: null },
        undefined,
        accountDeletionCleanupOptions(ownership),
      ),
    ).rejects.toThrow('owner marker unavailable');

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
  });

  it('keeps recovery proof and the unclaimed session when quarantine commit fails', async () => {
    const ownership = await resolveAccountDeletionRecoveryOwnership(
      { ...completed, notice: null },
      ownershipDependencies({
        localOwnerBinding: null,
        sessionUserId: null,
      }),
    );
    mocks.quarantineUnclaimedLocalData.mockRejectedValueOnce(
      new Error('unclaimed marker unavailable'),
    );

    await expect(
      finalizeCompletedAccountDeletion(
        { ...completed, notice: null },
        undefined,
        accountDeletionCleanupOptions(ownership),
      ),
    ).rejects.toThrow('unclaimed marker unavailable');

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearPersistedSupabaseSession).not.toHaveBeenCalled();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
    expect(mocks.resetAnalyticsIdentity).toHaveBeenCalledOnce();
    expect(mocks.resetRevenueCatIdentity).toHaveBeenCalledOnce();
  });

  it('does not remove capability when local cleanup cannot be committed', async () => {
    const clearCompletedState = vi.fn();
    await expect(
      finalizeCompletedAccountDeletion(completed, {
        clearSession: vi.fn().mockResolvedValue(undefined),
        clearIsolatedState: vi.fn().mockRejectedValue(new Error('cleanup unavailable')),
        clearAuthDerivedActivity: vi.fn().mockResolvedValue(undefined),
        quarantineUnclaimedLocalData: vi.fn().mockResolvedValue(undefined),
        retainLocalDataOwner: vi.fn().mockResolvedValue(undefined),
        convertStoreSafetyNotice: vi.fn().mockResolvedValue(undefined),
        queueAppleNotice: vi.fn(),
        clearCompletedState,
      }),
    ).rejects.toThrow('cleanup unavailable');

    expect(clearCompletedState).not.toHaveBeenCalled();
  });

  it('keeps terminal recovery retryable when owner-correlation conversion cannot commit', async () => {
    mocks.convertStoreTransactionNoticeForTerminalDeletion.mockRejectedValueOnce(
      new Error('store safety unavailable'),
    );

    await expect(finalizeCompletedAccountDeletion({ ...completed, notice: null })).rejects.toThrow(
      'store safety unavailable',
    );

    expect(mocks.convertStoreTransactionNoticeForTerminalDeletion).toHaveBeenCalledWith(OWNER_A);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearAccountIsolatedState).not.toHaveBeenCalled();
    expect(mocks.clearCompletedAccountDeletionState).not.toHaveBeenCalled();
  });
});
