import type { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

import {
  entitlementOwnerContextForUser,
  publishCustomerInfoEvidence,
} from '@/features/subscription/store';
import {
  isAccountActivityBlockedForDeletion,
  isAccountDeletionIntakeHoldActive,
  subscribeToAccountDeletionIntakeHold,
} from '@/features/settings/accountDeletionBarrier';
import {
  beginEncryptedPhotoAccountBoundary,
  endEncryptedPhotoAccountBoundary,
  waitForEncryptedPhotoWritesToSettle,
} from '@/features/photos/encryptedStorage';
import { purgeSensitiveImageMemory } from '@/features/photos/sensitiveImageMemory';
import { rescheduleReminders } from '@/features/notifications/deliver';
import { isSupabaseConfigured } from '@/lib/env';
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/errors/userFacing';
import { resetAnalyticsIdentity } from '@/lib/analytics/track';
import {
  activateRevenueCatPublication,
  assertRevenueCatResultCurrent,
  closeRevenueCatPublication,
  configureRevenueCat,
  customerInfoToStoredEntitlement,
  getCustomerInfo,
  getUncachedCustomerInfo,
  hasActiveRevenueCatPublication,
  onRevenueCatPublicationClosed,
  pauseRevenueCatPublicationAdmission,
  reserveRevenueCatPublication,
  resetRevenueCatIdentity,
  resumeRevenueCatPublicationAdmission,
  retryRevenueCatPublicationDrain,
  runRevenueCatResultWrite,
  subscribeToCustomerInfoUpdates,
} from '@/lib/iap/revenuecat';
import { devWarn } from '@/lib/observability/safeLog';
import { queryClient } from '@/lib/query/queryClient';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import {
  clearPersistedSupabaseSession,
  isSupabaseControlledRefreshTerminalError,
  readPersistedSupabaseSessionCandidate,
  refreshPersistedSupabaseSessionCandidate,
  supabase,
} from '../supabase/client';
import { parseSupabaseAccessTokenClaims } from '../supabase/authRefreshProtection';
import {
  activateSupabaseRemoteRequest,
  closeSupabaseRemoteRequestBoundary,
  isSupabaseRemoteRequestAdmissionError,
  requireSupabaseRemoteSessionBinding,
  runWithSupabaseAuthLogoutPermit,
  runWithSupabaseAuthRefreshPermit,
  runWithSupabaseFreshAuthPermit,
  setSupabaseRemoteRequestCandidate,
  supabaseRemoteRequestAdmission,
  supabaseRemoteRequestSnapshot,
  type SupabaseRemoteSessionBinding,
} from '../supabase/remoteRequestGate';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import { getAccountIsolationE2EFixture } from './accountIsolationE2E';
import {
  authenticateWithProviderToken,
  requestEmailAccountCode,
  verifyEmailAccountCode,
  type PendingEmailAccountCode,
} from './accountUpgrade';
import {
  activeAccountDeletionOwnsLocalData,
  fetchAccountDeletionBarrierState,
  isAccountDeletionBarrierSessionRejected,
} from './accountDeletionBarrier';
import {
  accountPublicationSessionBinding,
  isAccountPublicationFenceError,
} from './accountPublicationFence';
import {
  clearAuthDerivedCleanupRequired,
  markAuthDerivedCleanupRequired,
  readAuthDerivedCleanupRequired,
} from './authDerivedCleanupRequired';
import { getAppleIdToken } from './apple';
import {
  clearAppleCredentialQuarantine,
  isAppleCredentialQuarantined,
  markAppleCredentialQuarantined,
} from './appleCredentialQuarantine';
import {
  checkAppleCredentialForSession,
  hasAppleIdentity,
  monitorAppleCredentialRevocation,
  type AppleCredentialCheckBlockedReason,
  type AppleCredentialInvalidReason,
} from './appleCredentialLifecycle';
import { getGoogleIdToken } from './google';
import { clearAccountIsolatedState, prepareLocalDataForSession } from './localAccountIsolation';
import { clearAuthDerivedLocalActivity } from './revokedCredentialActivity';
import {
  localDataOwnerBinding,
  markLocalDataCleanupRequired,
  preserveLocalDataForForcedSignOut,
  readLocalDataOwnerProof,
  readLocalDataOwnership,
} from './sessionOwner';
import { clearRejectedSessionActivityDurably } from './sessionInvalidation';
import { latestSessionForCompletedBoundary } from './sessionBoundary';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  initializing: boolean;
  sessionBoundaryError: boolean;
  retrySessionBoundary: () => Promise<void>;
  /** Guest-first entry: create an anonymous session if none exists (docs/01 §1). */
  ensureAnonymousSession: (captchaToken?: string) => Promise<void>;
  signInWithApple: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  sendEmailOtp: (email: string) => Promise<'code_sent' | 'complete'>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AccountIsolationE2EGlobal = typeof globalThis & {
  __ROUTINEKIND_E2E_NAVIGATE__?: (href: string) => void;
};

const revokedCredentialActivityDependencies = {
  cancelQueries: () => queryClient.cancelQueries(),
  cancelScheduledNotifications: () => Notifications.cancelAllScheduledNotificationsAsync(),
  clearQueries: () => queryClient.clear(),
  purgeSensitiveImageMemory,
  resetAnalyticsIdentity,
  resetRevenueCatIdentity,
};

const activeAccountDeletionOwnerProofDependencies = {
  readLocalDataOwnership,
};

function hasUnchangedSessionBinding(previous: Session, refreshed: Session): boolean {
  const previousBinding = accountPublicationSessionBinding(previous.access_token, previous.user.id);
  const refreshedBinding = accountPublicationSessionBinding(
    refreshed.access_token,
    refreshed.user.id,
  );
  return Boolean(
    previousBinding &&
    refreshedBinding &&
    previousBinding.subject === refreshedBinding.subject &&
    previousBinding.sessionId === refreshedBinding.sessionId,
  );
}

function hasMatchingSessionStateBinding(
  expected: Session | null,
  observed: Session | null,
): boolean {
  if (expected === null || observed === null) return expected === observed;
  return hasUnchangedSessionBinding(expected, observed);
}

const REMOTE_SIGN_OUT_DEADLINE_MS = 5_000;
const PUBLICATION_RECOVERY_INITIAL_DELAY_MS = 1_000;
const PUBLICATION_RECOVERY_MAX_DELAY_MS = 30_000;
const CONTROLLED_SESSION_REFRESH_LEAD_MS = 60_000;
const CONTROLLED_SESSION_REFRESH_FALLBACK_MS = 60_000;
const MAX_JAVASCRIPT_TIMER_DELAY_MS = 2_147_000_000;

function requiresControlledSessionRefresh(candidate: Session, nowMs = Date.now()): boolean {
  const claims = parseSupabaseAccessTokenClaims(candidate.access_token);
  return claims === null || claims.expiresAt * 1_000 <= nowMs + CONTROLLED_SESSION_REFRESH_LEAD_MS;
}

async function revokeSupabaseRefreshTokens(binding: SupabaseRemoteSessionBinding): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('SUPABASE_REMOTE_SIGN_OUT_TIMEOUT')),
      REMOTE_SIGN_OUT_DEADLINE_MS,
    );
  });
  try {
    const result = await runWithSupabaseAuthLogoutPermit(binding, () =>
      Promise.race([supabase.auth.admin.signOut(binding.accessToken, 'global'), deadline]),
    );
    if (result.error) throw result.error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const accountIsolationE2EFixture = useMemo(() => getAccountIsolationE2EFixture(), []);
  const initialSession = accountIsolationE2EFixture?.session ?? null;
  const [session, setSession] = useState<Session | null>(initialSession);
  const [initializing, setInitializing] = useState(
    isSupabaseConfigured && accountIsolationE2EFixture === null,
  );
  const [sessionBoundaryError, setSessionBoundaryError] = useState(false);
  const activeUserIdRef = useRef<string | null>(initialSession?.user.id ?? null);
  const publishedSessionRef = useRef<Session | null>(initialSession);
  const pendingEmailCodeRef = useRef<PendingEmailAccountCode | null>(null);
  const sessionChangeSeqRef = useRef(0);
  const authBoundaryEpochRef = useRef(0);
  const sessionBoundaryActiveRef = useRef(false);
  const sessionBoundaryWriteLockHeldRef = useRef(false);
  const pendingBoundarySessionRef = useRef<{ session: Session | null } | null>(null);
  const boundaryInFlightRef = useRef<{
    promise: Promise<void>;
    targetUserId: string | null;
  } | null>(null);
  const boundaryClearFailureConsumedRef = useRef(false);
  const explicitSignOutPendingRef = useRef(false);
  const retrySessionRestoreRef = useRef<(() => Promise<void>) | null>(null);
  const publicationDrainPromiseRef = useRef<Promise<void> | null>(null);
  const remoteRequestDrainPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const clearPersistedSessionAfterRemoteDrainRef = useRef<() => Promise<void>>(
    clearPersistedSupabaseSession,
  );
  const closeRemoteRequestAuthorityRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const accountDeletionIntakeBoundaryActiveRef = useRef(isAccountDeletionIntakeHoldActive());
  const deferredAccountDeletionAuthBoundaryRef = useRef<{
    session: Session | null;
  } | null>(null);
  const accountDeletionAuthStateEpochRef = useRef(0);
  const accountDeletionIntakeResumePromiseRef = useRef<Promise<void> | null>(null);
  const resumeAfterAccountDeletionIntakeHoldRef = useRef<() => Promise<void>>(async () => {});
  const foregroundResumePromiseRef = useRef<Promise<void> | null>(null);
  const appleForegroundCredentialCheckPromiseRef = useRef<Promise<void> | null>(null);
  const initialSessionRestorePendingRef = useRef(true);
  const foregroundResumeRequestedRef = useRef(false);
  const publicationRecoveryNeededRef = useRef(false);
  const schedulePublicationRecoveryRef = useRef<() => void>(() => {});
  const cancelPublicationRecoveryRef = useRef<() => void>(() => {});
  const scheduleControlledSessionRefreshRef = useRef<(session: Session) => void>(() => {});
  const cancelControlledSessionRefreshRef = useRef<() => void>(() => {});
  const resumeForegroundPublicationRef = useRef<() => Promise<void>>(async () => {});
  const applySessionBoundaryRef = useRef<
    (nextSession: Session | null, initialRestore?: boolean) => Promise<void>
  >(async () => {});
  const showSessionBoundaryRef = useRef<
    (
      nextSession: Session | null,
      reason?: 'account_boundary' | 'app_backgrounded' | 'account_deletion',
    ) => void
  >(() => {});
  const handleAppleCredentialInvalidRef = useRef<
    (reason: AppleCredentialInvalidReason) => Promise<void>
  >(async () => {});
  const handleAppleCredentialCheckBlockedRef = useRef<
    (blockedSession: Session, reason: AppleCredentialCheckBlockedReason) => Promise<void>
  >(async () => {});
  const handleRejectedSessionRef = useRef<() => Promise<void>>(async () => {});
  const appleCredentialQuarantinedRef = useRef(false);
  const freshAuthenticationPendingRef = useRef(false);
  const authSemanticOperationPendingRef = useRef(false);
  const deferredAuthSemanticBoundaryRef = useRef<{ session: Session | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    let appleRevocationBoundaryActive = false;
    let appleRevocationBoundaryPromise: Promise<void> | null = null;
    let appleRemoteSignOutAttempted = false;
    let appleCredentialCheckBoundaryActive = false;
    let appleCredentialCheckPromise: Promise<void> | null = null;
    let accountDeletionBarrierBoundaryActive = false;
    let accountDeletionBarrierBoundaryPromise: Promise<void> | null = null;
    let accountDeletionLocalSignOutAttempted = false;
    let rejectedSessionBoundaryActive = false;
    let rejectedSessionBoundaryPromise: Promise<void> | null = null;
    let rejectedSessionLocalSignOutAttempted = false;
    let initialSessionRestoreRereadRequested = false;
    initialSessionRestorePendingRef.current = true;

    function holdSessionBoundaryWriteLock(): void {
      if (sessionBoundaryWriteLockHeldRef.current) return;
      beginAccountGenerationBoundary();
      beginPrivateKVAccountBoundary();
      beginEncryptedPhotoAccountBoundary();
      sessionBoundaryWriteLockHeldRef.current = true;
    }

    function releaseSessionBoundaryWriteLock(): void {
      if (!sessionBoundaryWriteLockHeldRef.current) return;
      endEncryptedPhotoAccountBoundary();
      endPrivateKVAccountBoundary();
      endAccountGenerationBoundary();
      sessionBoundaryWriteLockHeldRef.current = false;
    }

    function invalidateForAccountDeletionIntake(): void {
      accountDeletionAuthStateEpochRef.current += 1;
      authBoundaryEpochRef.current += 1;
      sessionChangeSeqRef.current += 1;
      foregroundResumeRequestedRef.current = false;
    }

    function deferForAccountDeletionIntake(nextSession: Session | null): void {
      invalidateForAccountDeletionIntake();
      deferredAccountDeletionAuthBoundaryRef.current = { session: nextSession };
    }

    function observeAuthStateDuringAccountDeletionIntake(
      event: string,
      nextSession: Session | null,
    ): void {
      // Every callback invalidates a read that may already be in flight. A
      // TOKEN_REFRESHED callback captured before the hold must not replace a
      // newer explicit SIGNED_IN/SIGNED_OUT boundary, but the Supabase singleton
      // must still be read again before either boundary can be published.
      invalidateForAccountDeletionIntake();
      if (event !== 'TOKEN_REFRESHED') {
        deferredAccountDeletionAuthBoundaryRef.current = { session: nextSession };
      }
    }

    function closeRemoteRequestAuthority(
      options: {
        preserveEnteredDeletion?: boolean;
      } = {},
    ): Promise<void> {
      if (options.preserveEnteredDeletion && supabaseRemoteRequestSnapshot().state === 'deletion') {
        return remoteRequestDrainPromiseRef.current;
      }
      const drain = closeSupabaseRemoteRequestBoundary();
      remoteRequestDrainPromiseRef.current = drain;
      void drain.catch(() => {
        // Admission is already synchronously closed. Cleanup/reacquisition
        // calls await true residual settlement before touching auth storage.
      });
      return drain;
    }
    closeRemoteRequestAuthorityRef.current = () => closeRemoteRequestAuthority();

    async function awaitRemoteRequestAuthorityClosed(): Promise<void> {
      try {
        await remoteRequestDrainPromiseRef.current;
      } catch (error: unknown) {
        if (
          !isSupabaseRemoteRequestAdmissionError(error, 'SUPABASE_REMOTE_REQUEST_DRAIN_QUARANTINED')
        ) {
          throw error;
        }
        await supabaseRemoteRequestAdmission.waitForResidualSettlement();
        await closeRemoteRequestAuthority();
      }
    }

    async function clearPersistedSessionAfterRemoteDrain(): Promise<void> {
      await awaitRemoteRequestAuthorityClosed();
      await clearPersistedSupabaseSession();
    }
    clearPersistedSessionAfterRemoteDrainRef.current = clearPersistedSessionAfterRemoteDrain;

    function showSessionBoundary(
      nextSession: Session | null,
      reason: 'account_boundary' | 'app_backgrounded' | 'account_deletion' = 'account_boundary',
    ): void {
      // Any new private boundary invalidates a foreground refresh captured for
      // the prior candidate, even when a completed null boundary later clears
      // explicitSignOutPendingRef before that refresh promise resolves.
      authBoundaryEpochRef.current += 1;
      publicationRecoveryNeededRef.current = false;
      cancelPublicationRecoveryRef.current();
      cancelControlledSessionRefreshRef.current();
      closeRemoteRequestAuthority({
        preserveEnteredDeletion: reason === 'account_deletion',
      });
      const publicationDrain = closeRevenueCatPublication(reason);
      publicationDrainPromiseRef.current = publicationDrain;
      void publicationDrain.catch(() => {
        // The neutral recovery gate owns retry. Admission is already closed
        // synchronously, so a failed reset/release cannot republish the tree.
      });
      pendingBoundarySessionRef.current = { session: nextSession };
      sessionBoundaryActiveRef.current = true;
      holdSessionBoundaryWriteLock();
      pendingEmailCodeRef.current = null;
      setSessionBoundaryError(false);
      setInitializing(true);
      setSession(null);
    }
    showSessionBoundaryRef.current = showSessionBoundary;

    function shutdownPublication(): void {
      closeRemoteRequestAuthorityRef.current();
      const publicationDrain = closeRevenueCatPublication('shutdown');
      publicationDrainPromiseRef.current = publicationDrain;
      void publicationDrain.catch(() => {
        // Admission closed synchronously. A later process/root recovery pass
        // owns retrying a protected provider reset and capability release.
      });
    }

    const unsubscribePublicationClosed = onRevenueCatPublicationClosed((reason) => {
      if (reason === 'account_boundary' || reason === 'app_backgrounded' || reason === 'shutdown') {
        return;
      }
      const publishedSession = publishedSessionRef.current;
      if (!mounted || !publishedSession || sessionBoundaryActiveRef.current) return;
      const pendingSession = pendingBoundarySessionRef.current?.session;
      if (reason === 'renewal_failed' || reason === 'renewal_stale') {
        if (pendingSession && !hasUnchangedSessionBinding(publishedSession, pendingSession)) {
          // A different Auth session arrived while renewal was in flight. Its
          // callback cannot be collapsed into a commerce-only outage; close
          // the local tree and reconcile the encrypted Auth singleton.
          supabase.auth.stopAutoRefresh();
          showSessionBoundary(publishedSession, 'account_boundary');
          retrySessionRestoreRef.current = restoreSession;
          setInitializing(false);
          setSessionBoundaryError(true);
          return;
        }
        // RevenueCat/lease availability is not authority to unmount the exact
        // locally verified owner. Local shelf, routine, and encrypted-photo
        // access remain available while every commerce entry stays closed by
        // the publication controller. Foreground/network recovery retries the
        // lease without converting a vendor outage into an account boundary.
        retrySessionRestoreRef.current = () => resumeForegroundPublicationRef.current();
        publicationRecoveryNeededRef.current = true;
        schedulePublicationRecoveryRef.current();
        if (AppState.currentState === 'active') {
          // Defer until the operation that emitted this synchronous close has
          // installed its boundary promise; otherwise recovery can re-enter
          // ahead of the current commit and refresh the wrong snapshot.
          void Promise.resolve().then(() => resumeForegroundPublicationRef.current());
        }
        return;
      }
      // A same-binding TOKEN_REFRESHED transition stores its fresh candidate
      // before renewing the publication lease. If renewal closes synchronously,
      // preserve that candidate instead of replacing it with the superseded
      // session that was last visible to the tree. A different-session callback
      // must be reconciled against the Supabase singleton before retry instead
      // of being trusted merely because its cached user id matches.
      const pendingHasPublishedBinding = Boolean(
        pendingSession && hasUnchangedSessionBinding(publishedSession, pendingSession),
      );
      const blockedSession =
        pendingHasPublishedBinding && pendingSession ? pendingSession : publishedSession;
      supabase.auth.stopAutoRefresh();
      showSessionBoundary(
        blockedSession,
        reason === 'account_deletion' ? 'account_deletion' : 'account_boundary',
      );
      retrySessionRestoreRef.current =
        pendingHasPublishedBinding || reason === 'account_deletion'
          ? () => applySessionBoundaryRef.current(blockedSession)
          : restoreSession;
      setInitializing(false);
      setSessionBoundaryError(true);
    });

    function handleAppleCredentialInvalid(reason: AppleCredentialInvalidReason): Promise<void> {
      if (appleRevocationBoundaryPromise) return appleRevocationBoundaryPromise;

      const invalidatedSession =
        pendingBoundarySessionRef.current?.session ?? publishedSessionRef.current;
      let invalidatedBinding: SupabaseRemoteSessionBinding | null = null;
      if (invalidatedSession) {
        try {
          invalidatedBinding = requireSupabaseRemoteSessionBinding(
            invalidatedSession.access_token,
            invalidatedSession.user.id,
          );
        } catch {
          // No structurally valid remote credential remains to revoke.
        }
      }

      appleRevocationBoundaryActive = true;
      appleCredentialQuarantinedRef.current = true;
      freshAuthenticationPendingRef.current = false;
      supabase.auth.stopAutoRefresh();
      showSessionBoundary(null);
      const seq = ++sessionChangeSeqRef.current;

      const promise = (async () => {
        try {
          // Provider credential invalidation proves only that this session may
          // no longer publish authenticated state. It does not authorize
          // erasing local data or letting a later account adopt ownerless data.
          // Resume an already-authorized cleanup, or commit owner-bound
          // retention/ownerless quarantine, before the forced local sign-out.
          const localDataAction = await preserveLocalDataForForcedSignOut();
          await clearRejectedSessionActivityDurably({
            markAuthDerivedCleanupRequired,
            clearAuthDerivedCleanupRequired,
            persistInvalidationMarker: () => markAppleCredentialQuarantined(),
            async signOut() {
              if (appleRemoteSignOutAttempted) return;
              if (invalidatedBinding) {
                await revokeSupabaseRefreshTokens(invalidatedBinding);
              }
              appleRemoteSignOutAttempted = true;
            },
            // Remove the encrypted local session even if the Auth client
            // already removed it. This closes response-loss ambiguity.
            clearPersistedSession: clearPersistedSessionAfterRemoteDrain,
            waitForAccountOperations: waitForAccountGenerationOperationsToSettle,
            waitForPrivateWrites: waitForPrivateKVWritesToSettle,
            waitForPhotoWrites: waitForEncryptedPhotoWritesToSettle,
            ...(localDataAction === 'resume-cleanup' ? { clearAccountIsolatedState } : {}),
            clearAuthDerivedActivity: () =>
              clearAuthDerivedLocalActivity(revokedCredentialActivityDependencies),
          });

          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = null;
          pendingBoundarySessionRef.current = null;
          activeUserIdRef.current = null;
          publishedSessionRef.current = null;
          explicitSignOutPendingRef.current = false;
          sessionBoundaryActiveRef.current = false;
          appleRevocationBoundaryActive = false;
          releaseSessionBoundaryWriteLock();
          setSessionBoundaryError(false);
          setSession(null);
          router.replace('/');
          setInitializing(false);
        } catch (error: unknown) {
          devWarn(`[auth] Apple credential invalidation failed closed (${reason})`, error);
          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = () => handleAppleCredentialInvalid(reason);
          showSessionBoundary(null);
          setInitializing(false);
          setSessionBoundaryError(true);
        }
      })();

      appleRevocationBoundaryPromise = promise;
      void promise.finally(() => {
        if (appleRevocationBoundaryPromise === promise) appleRevocationBoundaryPromise = null;
      });
      return promise;
    }
    handleAppleCredentialInvalidRef.current = handleAppleCredentialInvalid;

    function handleAppleCredentialCheckBlocked(
      blockedSession: Session,
      reason: AppleCredentialCheckBlockedReason,
    ): Promise<void> {
      appleCredentialCheckBoundaryActive = true;
      supabase.auth.stopAutoRefresh();
      showSessionBoundary(blockedSession);
      devWarn('[auth] Apple credential-state validation blocked', new Error(reason));
      retrySessionRestoreRef.current = () => retryAppleCredentialCheck(blockedSession);
      setInitializing(false);
      setSessionBoundaryError(true);
      return Promise.resolve();
    }

    function retryAppleCredentialCheck(blockedSession: Session): Promise<void> {
      if (appleCredentialCheckPromise) return appleCredentialCheckPromise;

      showSessionBoundary(blockedSession);
      const seq = ++sessionChangeSeqRef.current;
      const promise = (async () => {
        const result = await checkAppleCredentialForSession(blockedSession.user);
        if (!mounted || seq !== sessionChangeSeqRef.current) return;

        if (result.status === 'valid' || result.status === 'not_applicable') {
          appleCredentialCheckBoundaryActive = false;
          retrySessionRestoreRef.current = null;
          await applySessionBoundary(blockedSession);
          return;
        }
        if (result.status === 'invalid') {
          appleCredentialCheckBoundaryActive = false;
          await handleAppleCredentialInvalid(result.reason);
          return;
        }
        await handleAppleCredentialCheckBlocked(blockedSession, result.reason);
      })().catch((error: unknown) => {
        if (!mounted || seq !== sessionChangeSeqRef.current) return;
        devWarn('[auth] Apple credential-state retry failed closed', error);
        void handleAppleCredentialCheckBlocked(blockedSession, 'credential_check_failed');
      });

      appleCredentialCheckPromise = promise;
      void promise.finally(() => {
        if (appleCredentialCheckPromise === promise) appleCredentialCheckPromise = null;
      });
      return promise;
    }
    handleAppleCredentialCheckBlockedRef.current = handleAppleCredentialCheckBlocked;

    function handleRejectedSession(): Promise<void> {
      if (rejectedSessionBoundaryPromise) return rejectedSessionBoundaryPromise;

      rejectedSessionBoundaryActive = true;
      freshAuthenticationPendingRef.current = false;
      supabase.auth.stopAutoRefresh();
      showSessionBoundary(null);
      const seq = ++sessionChangeSeqRef.current;

      const promise = (async () => {
        try {
          // A rejected bearer proves only that the candidate session is no
          // longer valid. Resume a previously authorized cleanup, preserve a
          // known owner's proof, or quarantine ownerless data before local
          // sign-out can expose a signed-out restore to a later account.
          const localDataAction = await preserveLocalDataForForcedSignOut();
          await clearRejectedSessionActivityDurably({
            markAuthDerivedCleanupRequired,
            clearAuthDerivedCleanupRequired,
            async signOut() {
              if (rejectedSessionLocalSignOutAttempted) return;
              // auth-js `signOut({scope:'local'})` first calls getSession(),
              // which can refresh a near-expiry token and also posts to the
              // remote logout endpoint. The separately awaited encrypted
              // storage clear below is the exact local sign-out operation.
              rejectedSessionLocalSignOutAttempted = true;
            },
            clearPersistedSession: clearPersistedSessionAfterRemoteDrain,
            waitForAccountOperations: waitForAccountGenerationOperationsToSettle,
            waitForPrivateWrites: waitForPrivateKVWritesToSettle,
            waitForPhotoWrites: waitForEncryptedPhotoWritesToSettle,
            ...(localDataAction === 'resume-cleanup' ? { clearAccountIsolatedState } : {}),
            clearAuthDerivedActivity: () =>
              clearAuthDerivedLocalActivity(revokedCredentialActivityDependencies),
          });

          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = null;
          pendingBoundarySessionRef.current = null;
          activeUserIdRef.current = null;
          publishedSessionRef.current = null;
          explicitSignOutPendingRef.current = false;
          sessionBoundaryActiveRef.current = false;
          rejectedSessionBoundaryActive = false;
          rejectedSessionLocalSignOutAttempted = false;
          releaseSessionBoundaryWriteLock();
          setSessionBoundaryError(false);
          setSession(null);
          router.replace('/');
          setInitializing(false);
        } catch (error: unknown) {
          devWarn('[auth] rejected session cleanup failed closed', error);
          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = handleRejectedSession;
          showSessionBoundary(null);
          setInitializing(false);
          setSessionBoundaryError(true);
        }
      })();

      rejectedSessionBoundaryPromise = promise;
      void promise.finally(() => {
        if (rejectedSessionBoundaryPromise === promise) {
          rejectedSessionBoundaryPromise = null;
        }
      });
      return promise;
    }
    handleRejectedSessionRef.current = handleRejectedSession;

    function handleAccountDeletionBarrierActive(
      localDataDecision: Awaited<ReturnType<typeof activeAccountDeletionOwnsLocalData>>,
    ): Promise<void> {
      if (accountDeletionBarrierBoundaryPromise) return accountDeletionBarrierBoundaryPromise;

      accountDeletionBarrierBoundaryActive = true;
      freshAuthenticationPendingRef.current = false;
      supabase.auth.stopAutoRefresh();
      showSessionBoundary(null);
      const seq = ++sessionChangeSeqRef.current;

      const promise = (async () => {
        try {
          let resumeAuthorizedPrivateCleanup = localDataDecision === 'clear';
          if (resumeAuthorizedPrivateCleanup) {
            // Persist owner-data cleanup authority before the generic crash
            // marker and before local Auth removal. A cold restore can then
            // finish the exact destructive boundary even if this process dies
            // immediately after sign-out.
            await markLocalDataCleanupRequired();
          } else {
            // Commit either the retained owner's proof or an ownerless
            // quarantine before invalidating the active-barrier session. A
            // later signed-out restore must not erase or reassign that data.
            resumeAuthorizedPrivateCleanup =
              (await preserveLocalDataForForcedSignOut()) === 'resume-cleanup';
          }
          await clearRejectedSessionActivityDurably({
            markAuthDerivedCleanupRequired,
            clearAuthDerivedCleanupRequired,
            async signOut() {
              if (accountDeletionLocalSignOutAttempted) return;
              // The durable deletion marker plus encrypted storage clear is
              // the local sign-out. Do not let auth-js implicitly refresh the
              // very session whose deletion barrier is already active.
              accountDeletionLocalSignOutAttempted = true;
            },
            clearPersistedSession: clearPersistedSessionAfterRemoteDrain,
            waitForAccountOperations: waitForAccountGenerationOperationsToSettle,
            waitForPrivateWrites: waitForPrivateKVWritesToSettle,
            waitForPhotoWrites: waitForEncryptedPhotoWritesToSettle,
            ...(resumeAuthorizedPrivateCleanup ? { clearAccountIsolatedState } : {}),
            clearAuthDerivedActivity: () =>
              clearAuthDerivedLocalActivity(revokedCredentialActivityDependencies),
          });

          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = null;
          pendingBoundarySessionRef.current = null;
          activeUserIdRef.current = null;
          publishedSessionRef.current = null;
          explicitSignOutPendingRef.current = false;
          sessionBoundaryActiveRef.current = false;
          accountDeletionBarrierBoundaryActive = false;
          accountDeletionLocalSignOutAttempted = false;
          releaseSessionBoundaryWriteLock();
          setSessionBoundaryError(false);
          setSession(null);
          router.replace('/');
          setInitializing(false);
        } catch (error: unknown) {
          devWarn('[auth] rejected account session cleanup failed closed', error);
          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = () =>
            handleAccountDeletionBarrierActive(localDataDecision);
          showSessionBoundary(null);
          setInitializing(false);
          setSessionBoundaryError(true);
        }
      })();

      accountDeletionBarrierBoundaryPromise = promise;
      void promise.finally(() => {
        if (accountDeletionBarrierBoundaryPromise === promise) {
          accountDeletionBarrierBoundaryPromise = null;
        }
      });
      return promise;
    }

    async function enterRemotePublicationCandidate(
      candidate: Session,
    ): Promise<SupabaseRemoteSessionBinding> {
      const revenueCatDrain = closeRevenueCatPublication('app_backgrounded');
      publicationDrainPromiseRef.current = revenueCatDrain;
      const remoteDrain = closeRemoteRequestAuthority();
      await Promise.all([revenueCatDrain, remoteDrain.catch(() => undefined)]);
      await awaitRemoteRequestAuthorityClosed();
      return setSupabaseRemoteRequestCandidate(candidate.access_token, candidate.user.id);
    }

    async function refreshRemotePublicationCandidate(
      candidate: Session,
      binding: SupabaseRemoteSessionBinding,
    ): Promise<Session> {
      const refreshed = await runWithSupabaseAuthRefreshPermit(
        binding,
        candidate.refresh_token,
        () => refreshPersistedSupabaseSessionCandidate(candidate.refresh_token, candidate.user.id),
      );
      if (
        refreshed.user.id !== candidate.user.id ||
        !hasUnchangedSessionBinding(candidate, refreshed)
      ) {
        throw new Error('CONTROLLED_REFRESH_SESSION_BINDING_CHANGED');
      }
      return refreshed;
    }

    function applySessionBoundary(
      nextSession: Session | null,
      initialRestore = false,
    ): Promise<void> {
      if (accountDeletionIntakeBoundaryActiveRef.current) {
        deferForAccountDeletionIntake(nextSession);
        return Promise.resolve();
      }
      let transitionSession = nextSession;
      let targetUserId = transitionSession?.user.id ?? null;
      if (explicitSignOutPendingRef.current && targetUserId) return Promise.resolve();
      const publishedLocalSession = publishedSessionRef.current;
      const sameLocalSession = Boolean(
        !initialRestore &&
        transitionSession &&
        publishedLocalSession &&
        !sessionBoundaryActiveRef.current &&
        activeUserIdRef.current === targetUserId &&
        hasUnchangedSessionBinding(publishedLocalSession, transitionSession),
      );
      // Reacquire both remote authorities for every explicit transition. A
      // RevenueCat-only fast path cannot prove that the central Supabase gate
      // still owns the exact same bearer after backgrounding or response loss.
      pendingBoundarySessionRef.current = { session: transitionSession };
      const existing = boundaryInFlightRef.current;
      if (existing?.targetUserId === targetUserId) return existing.promise;

      const previousTransition = existing?.promise;
      const seq = ++sessionChangeSeqRef.current;
      if (
        !sameLocalSession &&
        (nextSession !== null ||
          initialRestore ||
          sessionBoundaryActiveRef.current ||
          targetUserId !== activeUserIdRef.current)
      ) {
        showSessionBoundary(nextSession);
      }

      const promise = (async () => {
        if (previousTransition) await previousTransition;
        if (!mounted || seq !== sessionChangeSeqRef.current) return;
        const previousUserId = activeUserIdRef.current;

        try {
          if (transitionSession === null && !accountIsolationE2EFixture) {
            await awaitRemoteRequestAuthorityClosed();
          }
          let commercePreflightVerified = transitionSession === null;
          if (transitionSession) {
            let localBinding = accountPublicationSessionBinding(
              transitionSession.access_token,
              transitionSession.user.id,
            );
            if (!localBinding) {
              await handleRejectedSession();
              return;
            }
            let skipRemotePreflight = false;
            try {
              let remoteBinding = await enterRemotePublicationCandidate(transitionSession);
              if (
                !mounted ||
                seq !== sessionChangeSeqRef.current ||
                explicitSignOutPendingRef.current
              ) {
                return;
              }
              if (
                !freshAuthenticationPendingRef.current &&
                requiresControlledSessionRefresh(transitionSession)
              ) {
                try {
                  transitionSession = await refreshRemotePublicationCandidate(
                    transitionSession,
                    remoteBinding,
                  );
                  if (
                    !mounted ||
                    seq !== sessionChangeSeqRef.current ||
                    explicitSignOutPendingRef.current
                  ) {
                    return;
                  }
                  pendingBoundarySessionRef.current = { session: transitionSession };
                  targetUserId = transitionSession.user.id;
                  localBinding = accountPublicationSessionBinding(
                    transitionSession.access_token,
                    transitionSession.user.id,
                  );
                  remoteBinding = requireSupabaseRemoteSessionBinding(
                    transitionSession.access_token,
                    transitionSession.user.id,
                  );
                  if (!localBinding || remoteBinding.subject !== localBinding.subject) {
                    await handleRejectedSession();
                    return;
                  }
                } catch (error: unknown) {
                  if (isSupabaseControlledRefreshTerminalError(error)) {
                    await handleRejectedSession();
                    return;
                  }
                  // Ambiguous refresh/network/storage failure retains only the
                  // exact encrypted owner's local tree. The candidate gate
                  // stays non-active and no expired bearer is sent to preflight.
                  commercePreflightVerified = false;
                  skipRemotePreflight = true;
                  devWarn(
                    '[auth] controlled session refresh unavailable; retaining local-only access',
                    error,
                  );
                }
              }
            } catch (error: unknown) {
              commercePreflightVerified = false;
              skipRemotePreflight = true;
              devWarn('[auth] remote admission candidate unavailable', error);
            }
            if (!localBinding) {
              await handleRejectedSession();
              return;
            }
            const localOwnerSubject = localBinding.subject;
            let barrierState:
              | Awaited<ReturnType<typeof fetchAccountDeletionBarrierState>>
              | undefined;
            if (!skipRemotePreflight) {
              try {
                barrierState = await fetchAccountDeletionBarrierState(
                  transitionSession.access_token,
                  transitionSession.user.id,
                );
              } catch (error: unknown) {
                if (isAccountDeletionBarrierSessionRejected(error)) {
                  await handleRejectedSession();
                  return;
                }
                // Remote deletion/commerce authority is unavailable. The exact
                // cached JWT subject may still unlock only its already-bound
                // local data; every RevenueCat operation remains closed until a
                // later foreground or online retry obtains server proof.
                commercePreflightVerified = false;
                targetUserId = localOwnerSubject;
                devWarn(
                  '[auth] commerce preflight unavailable; retaining local-only access',
                  error,
                );
              }
            }
            if (!mounted || seq !== sessionChangeSeqRef.current) return;
            if (!barrierState) {
              // A syntactically valid cached JWT cannot claim, clear, or
              // unlock ownerless/foreign/quarantined data while server
              // authority is unavailable. Only the complete durable proof
              // for this exact subject may enter local-only mode.
              let exactLocalOwner = false;
              try {
                const [ownerProof, expectedOwnerBinding] = await Promise.all([
                  readLocalDataOwnerProof(),
                  localDataOwnerBinding(localOwnerSubject),
                ]);
                exactLocalOwner =
                  ownerProof.kind === 'owned' && ownerProof.ownerBinding === expectedOwnerBinding;
              } catch (error: unknown) {
                devWarn('[auth] local owner proof unavailable during offline restore', error);
              }
              if (!mounted || seq !== sessionChangeSeqRef.current) return;
              if (!exactLocalOwner) {
                retrySessionRestoreRef.current = () =>
                  applySessionBoundary(transitionSession, initialRestore);
                showSessionBoundary(transitionSession);
                publicationRecoveryNeededRef.current = true;
                schedulePublicationRecoveryRef.current();
                setInitializing(false);
                setSessionBoundaryError(true);
                return;
              }
            } else {
              if (transitionSession.user.id !== barrierState.ownerSubject) {
                // The encrypted Supabase session contains a mutable cached user
                // object. Only the subject authenticated by the same preflight
                // response may become the local/vendor publication target.
                await handleRejectedSession();
                return;
              }
              commercePreflightVerified = true;
              targetUserId = barrierState.ownerSubject;
              if (barrierState.status === 'active') {
                const localDataDecision = await activeAccountDeletionOwnsLocalData(
                  barrierState.ownerSubject,
                  activeAccountDeletionOwnerProofDependencies,
                );
                if (!mounted || seq !== sessionChangeSeqRef.current) return;
                await handleAccountDeletionBarrierActive(localDataDecision);
                return;
              }
            }
          }
          if (!targetUserId && explicitSignOutPendingRef.current && !accountIsolationE2EFixture) {
            await clearPersistedSessionAfterRemoteDrain();
          }
          const result = sameLocalSession
            ? { cleared: false, resetRoute: false }
            : await prepareLocalDataForSession(
                previousUserId,
                targetUserId,
                undefined,
                async () => {
                  if (!mounted || seq !== sessionChangeSeqRef.current) return;
                  showSessionBoundary(transitionSession);
                  await waitForAccountGenerationOperationsToSettle();
                  await waitForPrivateKVWritesToSettle();
                  await waitForEncryptedPhotoWritesToSettle();
                  if (accountIsolationE2EFixture) {
                    await new Promise((resolve) =>
                      setTimeout(resolve, accountIsolationE2EFixture.clearDelayMs),
                    );
                    if (
                      accountIsolationE2EFixture.failFirstClear &&
                      !boundaryClearFailureConsumedRef.current
                    ) {
                      boundaryClearFailureConsumedRef.current = true;
                      throw new Error('E2E_ACCOUNT_ISOLATION_CLEAR_FAILED');
                    }
                  }
                },
                {
                  clearUnclaimed:
                    targetUserId !== null &&
                    freshAuthenticationPendingRef.current &&
                    appleCredentialQuarantinedRef.current,
                },
              );

          if (targetUserId && freshAuthenticationPendingRef.current) {
            if (appleCredentialQuarantinedRef.current) {
              await rescheduleReminders();
              await clearAppleCredentialQuarantine();
              appleCredentialQuarantinedRef.current = false;
              appleRemoteSignOutAttempted = false;
            }
            freshAuthenticationPendingRef.current = false;
          }

          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          let latestPendingSession = latestSessionForCompletedBoundary(
            pendingBoundarySessionRef.current?.session,
            transitionSession,
            targetUserId,
          );
          if (
            targetUserId &&
            latestPendingSession &&
            !accountIsolationE2EFixture &&
            commercePreflightVerified &&
            AppState.currentState === 'active'
          ) {
            try {
              await publicationDrainPromiseRef.current;
              if (!mounted || seq !== sessionChangeSeqRef.current) return;
              if (AppState.currentState === 'active') {
                await reserveRevenueCatPublication(targetUserId, latestPendingSession.access_token);
                if (!mounted || seq !== sessionChangeSeqRef.current) return;
              }
              if (AppState.currentState === 'active') {
                await activateRevenueCatPublication(
                  targetUserId,
                  latestPendingSession.access_token,
                );
                if (!mounted || seq !== sessionChangeSeqRef.current) return;
              }
              latestPendingSession = latestSessionForCompletedBoundary(
                pendingBoundarySessionRef.current?.session,
                latestPendingSession,
                targetUserId,
              );
              if (
                AppState.currentState === 'active' &&
                (!latestPendingSession ||
                  !hasActiveRevenueCatPublication(targetUserId, latestPendingSession.access_token))
              ) {
                throw new Error('ACCOUNT_PUBLICATION_SESSION_REJECTED');
              }
              if (AppState.currentState === 'active' && latestPendingSession) {
                activateSupabaseRemoteRequest(latestPendingSession.access_token, targetUserId);
              }
            } catch (error: unknown) {
              if (!mounted || seq !== sessionChangeSeqRef.current) return;
              if (isAccountPublicationFenceError(error, 'ACCOUNT_DELETION_ACTIVE')) {
                const localDataDecision = await activeAccountDeletionOwnsLocalData(
                  targetUserId,
                  activeAccountDeletionOwnerProofDependencies,
                );
                if (!mounted || seq !== sessionChangeSeqRef.current) return;
                await handleAccountDeletionBarrierActive(localDataDecision);
                return;
              }
              if (
                isAccountPublicationFenceError(error, 'ACCOUNT_PUBLICATION_SESSION_REJECTED') ||
                (error instanceof Error && error.message === 'ACCOUNT_PUBLICATION_SESSION_REJECTED')
              ) {
                await handleRejectedSession();
                return;
              }
              commercePreflightVerified = false;
              publicationRecoveryNeededRef.current = true;
              devWarn(
                '[auth] commerce publication unavailable; retaining local-only access',
                error,
              );
              const publicationDrain = closeRevenueCatPublication('app_backgrounded');
              publicationDrainPromiseRef.current = publicationDrain;
              void publicationDrain.catch(() => {});
              closeRemoteRequestAuthority();
            }
          }
          setSession(latestPendingSession);
          publishedSessionRef.current = latestPendingSession;
          activeUserIdRef.current = targetUserId;
          if (!targetUserId) explicitSignOutPendingRef.current = false;
          pendingBoundarySessionRef.current = null;
          sessionBoundaryActiveRef.current = false;
          releaseSessionBoundaryWriteLock();
          setSessionBoundaryError(false);
          if (latestPendingSession && targetUserId && AppState.currentState === 'active') {
            scheduleControlledSessionRefreshRef.current(latestPendingSession);
            const publicationActive = hasActiveRevenueCatPublication(
              targetUserId,
              latestPendingSession.access_token,
            );
            retrySessionRestoreRef.current = publicationActive
              ? null
              : () => resumeForegroundPublicationRef.current();
            publicationRecoveryNeededRef.current = !publicationActive;
            schedulePublicationRecoveryRef.current();
          } else if (!latestPendingSession) {
            publicationRecoveryNeededRef.current = false;
            schedulePublicationRecoveryRef.current();
            supabase.auth.stopAutoRefresh();
          }
          if (result.resetRoute) router.replace('/');
          setInitializing(false);
        } catch (error: unknown) {
          if (
            !(
              accountIsolationE2EFixture &&
              error instanceof Error &&
              error.message.startsWith('E2E_')
            )
          ) {
            devWarn(
              initialRestore
                ? '[auth] local account isolation failed during session restore'
                : '[auth] local account isolation failed during session transition',
              error,
            );
          }
          if (!mounted || seq !== sessionChangeSeqRef.current) return;
          showSessionBoundary(pendingBoundarySessionRef.current?.session ?? transitionSession);
          setInitializing(false);
          setSessionBoundaryError(true);
        }
      })();

      boundaryInFlightRef.current = { promise, targetUserId };
      void promise.finally(() => {
        if (boundaryInFlightRef.current?.promise === promise) {
          boundaryInFlightRef.current = null;
        }
      });
      return promise;
    }

    applySessionBoundaryRef.current = applySessionBoundary;

    function resumeAfterAccountDeletionIntakeHold(): Promise<void> {
      const existing = accountDeletionIntakeResumePromiseRef.current;
      if (existing) return existing;

      const completion = (async () => {
        if (
          !mounted ||
          isAccountDeletionIntakeHoldActive() ||
          isAccountActivityBlockedForDeletion()
        ) {
          return;
        }

        try {
          const publicationDrain = retryRevenueCatPublicationDrain();
          publicationDrainPromiseRef.current = publicationDrain;
          await publicationDrain;
          if (
            !mounted ||
            isAccountDeletionIntakeHoldActive() ||
            isAccountActivityBlockedForDeletion()
          ) {
            return;
          }

          let latestSession: Session | null | undefined;
          const maxStableReadAttempts = 3;
          for (let attempt = 0; attempt < maxStableReadAttempts; attempt += 1) {
            const readEpoch = accountDeletionAuthStateEpochRef.current;
            const observedSession = await readPersistedSupabaseSessionCandidate();
            if (
              !mounted ||
              isAccountDeletionIntakeHoldActive() ||
              isAccountActivityBlockedForDeletion()
            ) {
              return;
            }
            if (readEpoch !== accountDeletionAuthStateEpochRef.current) {
              continue;
            }

            const deferredBoundary = deferredAccountDeletionAuthBoundaryRef.current;
            if (
              !deferredBoundary ||
              !hasMatchingSessionStateBinding(deferredBoundary.session, observedSession)
            ) {
              throw new Error('ACCOUNT_DELETION_INTAKE_SESSION_STATE_UNVERIFIED');
            }
            // Use the freshly verified singleton session so a same-binding token
            // refresh cannot republish the retained pre-hold bearer.
            latestSession = observedSession;
            break;
          }
          if (latestSession === undefined) {
            throw new Error('ACCOUNT_DELETION_INTAKE_SESSION_STATE_UNSTABLE');
          }

          deferredAccountDeletionAuthBoundaryRef.current = null;
          accountDeletionIntakeBoundaryActiveRef.current = false;
          retrySessionRestoreRef.current = null;
          await applySessionBoundary(latestSession);
        } catch (error: unknown) {
          if (!mounted) return;
          devWarn('[auth] deletion-intake publication recovery remains blocked', error);
          accountDeletionIntakeBoundaryActiveRef.current = true;
          retrySessionRestoreRef.current = resumeAfterAccountDeletionIntakeHold;
          setInitializing(false);
          setSessionBoundaryError(true);
        }
      })();

      accountDeletionIntakeResumePromiseRef.current = completion;
      void completion.finally(() => {
        if (accountDeletionIntakeResumePromiseRef.current === completion) {
          accountDeletionIntakeResumePromiseRef.current = null;
        }
      });
      return completion;
    }
    resumeAfterAccountDeletionIntakeHoldRef.current = resumeAfterAccountDeletionIntakeHold;

    const unsubscribeDeletionIntakeHold = subscribeToAccountDeletionIntakeHold((active) => {
      if (!mounted) return;
      if (active) {
        accountDeletionIntakeBoundaryActiveRef.current = true;
        const retainedSession =
          pendingBoundarySessionRef.current?.session ?? publishedSessionRef.current;
        deferForAccountDeletionIntake(retainedSession);
        supabase.auth.stopAutoRefresh();
        if (!sessionBoundaryActiveRef.current) {
          showSessionBoundary(retainedSession, 'account_deletion');
        }
        return;
      }

      // A successful SecureStore prepare keeps the effective durable block
      // closed while the temporary ref-counted hold releases. Only a genuinely
      // pre-durable failure may resume the exact latest Auth session.
      if (isAccountActivityBlockedForDeletion()) return;
      void resumeAfterAccountDeletionIntakeHold();
    });

    async function restoreSession(): Promise<void> {
      if (!mounted) return;
      if (isAccountDeletionIntakeHoldActive() || isAccountActivityBlockedForDeletion()) {
        // Deletion intake owns Auth/provider authority. A restore closure that
        // predates the hold must not read the singleton or enter quarantine /
        // rejected-session cleanup while that authority remains closed.
        initialSessionRestoreRereadRequested = false;
        initialSessionRestorePendingRef.current = false;
        return;
      }
      // A callback observed before this read starts is already reflected by the
      // singleton. Any callback after this point invalidates the read below and
      // schedules another pass from the persisted source of truth.
      initialSessionRestoreRereadRequested = false;
      initialSessionRestorePendingRef.current = true;
      const seqBeforeRestore = sessionChangeSeqRef.current;
      showSessionBoundary(null);
      try {
        if (await isAppleCredentialQuarantined()) {
          if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
          appleCredentialQuarantinedRef.current = true;
          retrySessionRestoreRef.current = null;
          await handleAppleCredentialInvalid('persisted_revocation');
          return;
        }
        if (await readAuthDerivedCleanupRequired()) {
          if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
          retrySessionRestoreRef.current = null;
          await handleRejectedSession();
          return;
        }
        const restoredSession = await readPersistedSupabaseSessionCandidate();
        if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
        retrySessionRestoreRef.current = null;
        if (restoredSession) {
          const appleCredential = await checkAppleCredentialForSession(restoredSession.user);
          if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
          if (appleCredential.status === 'invalid') {
            await handleAppleCredentialInvalid(appleCredential.reason);
            return;
          }
          if (appleCredential.status === 'blocked') {
            await handleAppleCredentialCheckBlocked(restoredSession, appleCredential.reason);
            return;
          }
        }
        await applySessionBoundary(restoredSession, true);
      } catch (error: unknown) {
        devWarn('[auth] initial session restore failed', error);
        if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
        retrySessionRestoreRef.current = restoreSession;
        showSessionBoundary(null);
        setInitializing(false);
        setSessionBoundaryError(true);
      } finally {
        initialSessionRestorePendingRef.current = false;
        if (
          mounted &&
          initialSessionRestoreRereadRequested &&
          !accountDeletionIntakeBoundaryActiveRef.current &&
          !isAccountDeletionIntakeHoldActive() &&
          !isAccountActivityBlockedForDeletion()
        ) {
          initialSessionRestoreRereadRequested = false;
          void restoreSession();
          return;
        }
        if (
          mounted &&
          foregroundResumeRequestedRef.current &&
          AppState.currentState === 'active' &&
          pendingBoundarySessionRef.current &&
          sessionBoundaryActiveRef.current
        ) {
          foregroundResumeRequestedRef.current = false;
          void resumeForegroundPublicationRef.current();
        }
      }
    }

    if (accountIsolationE2EFixture) {
      const globalLike = globalThis as AccountIsolationE2EGlobal;
      globalLike.__ROUTINEKIND_E2E_NAVIGATE__ = (href) => router.replace(href as Href);
      return () => {
        shutdownPublication();
        mounted = false;
        unsubscribePublicationClosed();
        unsubscribeDeletionIntakeHold();
        delete globalLike.__ROUTINEKIND_E2E_NAVIGATE__;
        applySessionBoundaryRef.current = async () => {};
        showSessionBoundaryRef.current = () => {};
        retrySessionRestoreRef.current = null;
        handleAppleCredentialInvalidRef.current = async () => {};
        handleAppleCredentialCheckBlockedRef.current = async () => {};
        handleRejectedSessionRef.current = async () => {};
        releaseSessionBoundaryWriteLock();
      };
    }

    if (!isSupabaseConfigured) {
      activeUserIdRef.current = null;
      return () => {
        shutdownPublication();
        mounted = false;
        unsubscribePublicationClosed();
        unsubscribeDeletionIntakeHold();
        applySessionBoundaryRef.current = async () => {};
        showSessionBoundaryRef.current = () => {};
        retrySessionRestoreRef.current = null;
        handleAppleCredentialInvalidRef.current = async () => {};
        handleAppleCredentialCheckBlockedRef.current = async () => {};
        handleRejectedSessionRef.current = async () => {};
        releaseSessionBoundaryWriteLock();
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (accountDeletionIntakeBoundaryActiveRef.current) {
        observeAuthStateDuringAccountDeletionIntake(event, nextSession);
        return;
      }
      if (authSemanticOperationPendingRef.current) {
        // Supabase notifies listeners before sign-in/link/verify promises
        // settle. Closing the gate here would invalidate the exact semantic
        // permit that produced this callback. Reconcile only after the helper
        // and all of its tracked requests have truly settled.
        deferredAuthSemanticBoundaryRef.current = { session: nextSession };
        return;
      }
      if (initialSessionRestorePendingRef.current) {
        // Never trust or discard an event racing a singleton read. Invalidate
        // the captured result and re-read after this pass settles so UI,
        // provider identity, and the persisted Supabase session cannot split.
        initialSessionRestoreRereadRequested = true;
        sessionChangeSeqRef.current += 1;
        // Admission must close synchronously as well as invalidating the local
        // continuation: a reserve/activate call may already be awaiting its
        // server response when the Auth singleton changes.
        showSessionBoundary(null);
        return;
      }
      if (appleRevocationBoundaryActive) return;
      if (appleCredentialCheckBoundaryActive) return;
      if (accountDeletionBarrierBoundaryActive) return;
      if (rejectedSessionBoundaryActive) return;
      if (event === 'TOKEN_REFRESHED') {
        // All legitimate refreshes are owned by the explicit gated transport
        // and do not use auth-js notification paths. An unsolicited refresh
        // therefore has no matching semantic authority and fails closed.
        showSessionBoundary(null);
        void Promise.resolve().then(() => handleRejectedSessionRef.current());
        return;
      }
      if (
        appleCredentialQuarantinedRef.current &&
        !(freshAuthenticationPendingRef.current && nextSession)
      ) {
        return;
      }
      void applySessionBoundary(nextSession);
    });
    // Subscribe first so no Auth mutation can land between taking the initial
    // singleton snapshot and installing the invalidation listener.
    void restoreSession();
    return () => {
      shutdownPublication();
      mounted = false;
      unsubscribePublicationClosed();
      unsubscribeDeletionIntakeHold();
      applySessionBoundaryRef.current = async () => {};
      showSessionBoundaryRef.current = () => {};
      retrySessionRestoreRef.current = null;
      handleAppleCredentialInvalidRef.current = async () => {};
      handleAppleCredentialCheckBlockedRef.current = async () => {};
      handleRejectedSessionRef.current = async () => {};
      initialSessionRestorePendingRef.current = false;
      foregroundResumeRequestedRef.current = false;
      appleRevocationBoundaryActive = false;
      appleCredentialCheckBoundaryActive = false;
      accountDeletionBarrierBoundaryActive = false;
      rejectedSessionBoundaryActive = false;
      releaseSessionBoundaryWriteLock();
      sub.subscription.unsubscribe();
    };
  }, [accountIsolationE2EFixture]);

  useEffect(() => {
    if (!isSupabaseConfigured || accountIsolationE2EFixture || !session?.user) return;

    return monitorAppleCredentialRevocation(session.user, {
      onCredentialCheckBlocked: (reason) =>
        handleAppleCredentialCheckBlockedRef.current(session, reason),
      onCredentialInvalid: (reason) => handleAppleCredentialInvalidRef.current(reason),
    });
  }, [accountIsolationE2EFixture, session]);

  // Own token refresh explicitly so every network refresh can enter the same
  // account-bound admission lease as foreground recovery (docs/01 §5).
  useEffect(() => {
    if (!isSupabaseConfigured || accountIsolationE2EFixture) return;

    let disposed = false;
    let publicationRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let controlledSessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let publicationRecoveryAttempt = 0;
    let publicationRecoveryIdentity: string | null = null;

    const currentBoundarySession = (): Session | null => {
      const pending = pendingBoundarySessionRef.current;
      return pending === null ? publishedSessionRef.current : pending.session;
    };

    const currentPublicationRecoveryIdentity = (): string | null => {
      const retained = currentBoundarySession();
      if (!retained) return null;
      const binding = accountPublicationSessionBinding(retained.access_token, retained.user.id);
      return binding ? `${binding.subject}:${binding.sessionId}` : null;
    };

    const cancelPublicationRecovery = (): void => {
      if (publicationRecoveryTimer !== null) {
        clearTimeout(publicationRecoveryTimer);
        publicationRecoveryTimer = null;
      }
    };

    const cancelControlledSessionRefresh = (): void => {
      if (controlledSessionRefreshTimer !== null) {
        clearTimeout(controlledSessionRefreshTimer);
        controlledSessionRefreshTimer = null;
      }
    };

    const canSchedulePublicationRecovery = (): boolean =>
      publicationRecoveryNeededRef.current &&
      onlineManager.isOnline() &&
      !disposed &&
      AppState.currentState === 'active' &&
      !accountDeletionIntakeBoundaryActiveRef.current &&
      !isAccountDeletionIntakeHoldActive() &&
      !isAccountActivityBlockedForDeletion() &&
      !explicitSignOutPendingRef.current &&
      !appleForegroundCredentialCheckPromiseRef.current &&
      currentPublicationRecoveryIdentity() !== null;

    const resumeForegroundPublication = (): Promise<void> => {
      if (accountDeletionIntakeBoundaryActiveRef.current) {
        foregroundResumeRequestedRef.current = true;
        return Promise.resolve();
      }
      if (foregroundResumePromiseRef.current) {
        foregroundResumeRequestedRef.current = true;
        return foregroundResumePromiseRef.current;
      }
      if (disposed) return Promise.resolve();
      foregroundResumeRequestedRef.current = false;
      const completion = (async () => {
        // A background event can arrive while reserve/activate is in flight.
        // Wait for that attempt to observe the synchronous drain, then reacquire
        // from the still-private pending session instead of stranding restore.
        const inFlight = boundaryInFlightRef.current?.promise;
        if (inFlight) await inFlight;
        if (
          disposed ||
          accountDeletionIntakeBoundaryActiveRef.current ||
          AppState.currentState !== 'active'
        ) {
          return;
        }

        const retainedSession = currentBoundarySession();
        if (!retainedSession) {
          publicationRecoveryNeededRef.current = false;
          schedulePublicationRecoveryRef.current();
          supabase.auth.stopAutoRefresh();
          return;
        }
        publicationRecoveryNeededRef.current = true;

        try {
          // A bounded native StoreKit drain can reject into a process-local
          // quarantine while its underlying SDK promise is still unsettled.
          // Retry that protected reset/release first and replace the rejected
          // promise so applySessionBoundary never awaits stale drain evidence.
          const publicationDrain = retryRevenueCatPublicationDrain();
          publicationDrainPromiseRef.current = publicationDrain;
          await publicationDrain;
        } catch (error: unknown) {
          if (disposed || accountDeletionIntakeBoundaryActiveRef.current) return;
          devWarn('[auth] foreground publication drain remains quarantined', error);
          retrySessionRestoreRef.current = () => resumeForegroundPublicationRef.current();
          publicationRecoveryNeededRef.current = true;
          setInitializing(false);
          setSessionBoundaryError(false);
          return;
        }

        await applySessionBoundaryRef.current(retainedSession);
        if (disposed || AppState.currentState !== 'active') return;

        const published = publishedSessionRef.current;
        if (published && !sessionBoundaryActiveRef.current) {
          const publicationActive = hasActiveRevenueCatPublication(
            published.user.id,
            published.access_token,
          );
          retrySessionRestoreRef.current = publicationActive
            ? null
            : () => resumeForegroundPublicationRef.current();
          publicationRecoveryNeededRef.current = !publicationActive;
          scheduleControlledSessionRefresh(published);
        } else {
          if (!published) publicationRecoveryNeededRef.current = false;
          supabase.auth.stopAutoRefresh();
        }
      })();
      foregroundResumePromiseRef.current = completion;
      void completion
        .catch(() => {
          // applySessionBoundary owns the neutral recovery state. No private
          // tree or provider operation is admitted after a failed reacquire.
          supabase.auth.stopAutoRefresh();
          publicationRecoveryNeededRef.current = true;
        })
        .finally(() => {
          if (foregroundResumePromiseRef.current === completion) {
            foregroundResumePromiseRef.current = null;
          }
          if (
            !disposed &&
            !initialSessionRestorePendingRef.current &&
            foregroundResumeRequestedRef.current &&
            AppState.currentState === 'active' &&
            pendingBoundarySessionRef.current &&
            sessionBoundaryActiveRef.current
          ) {
            foregroundResumeRequestedRef.current = false;
            void resumeForegroundPublication();
            return;
          }
          schedulePublicationRecoveryRef.current();
        });
      return completion;
    };

    function schedulePublicationRecovery(): void {
      if (!publicationRecoveryNeededRef.current) {
        cancelPublicationRecovery();
        publicationRecoveryAttempt = 0;
        publicationRecoveryIdentity = null;
        return;
      }
      if (!canSchedulePublicationRecovery()) {
        cancelPublicationRecovery();
        return;
      }

      const identity = currentPublicationRecoveryIdentity();
      if (identity !== publicationRecoveryIdentity) {
        cancelPublicationRecovery();
        publicationRecoveryAttempt = 0;
        publicationRecoveryIdentity = identity;
      }
      if (publicationRecoveryTimer !== null || identity === null) return;

      const delay = Math.min(
        PUBLICATION_RECOVERY_INITIAL_DELAY_MS * 2 ** publicationRecoveryAttempt,
        PUBLICATION_RECOVERY_MAX_DELAY_MS,
      );
      publicationRecoveryAttempt = Math.min(publicationRecoveryAttempt + 1, 30);
      publicationRecoveryTimer = setTimeout(() => {
        publicationRecoveryTimer = null;
        if (
          !canSchedulePublicationRecovery() ||
          currentPublicationRecoveryIdentity() !== identity
        ) {
          return;
        }
        void resumeForegroundPublication();
      }, delay);
    }

    function scheduleControlledSessionRefresh(candidate: Session): void {
      cancelControlledSessionRefresh();
      const published = publishedSessionRef.current;
      if (
        disposed ||
        AppState.currentState !== 'active' ||
        accountDeletionIntakeBoundaryActiveRef.current ||
        isAccountDeletionIntakeHoldActive() ||
        isAccountActivityBlockedForDeletion() ||
        explicitSignOutPendingRef.current ||
        sessionBoundaryActiveRef.current ||
        !published ||
        published.access_token !== candidate.access_token ||
        !hasUnchangedSessionBinding(published, candidate)
      ) {
        return;
      }

      const expiresAtMs =
        typeof candidate.expires_at === 'number' && Number.isFinite(candidate.expires_at)
          ? candidate.expires_at * 1_000
          : null;
      const desiredDelay =
        expiresAtMs === null
          ? CONTROLLED_SESSION_REFRESH_FALLBACK_MS
          : Math.max(1_000, expiresAtMs - Date.now() - CONTROLLED_SESSION_REFRESH_LEAD_MS);
      const delay = Math.min(desiredDelay, MAX_JAVASCRIPT_TIMER_DELAY_MS);
      controlledSessionRefreshTimer = setTimeout(() => {
        controlledSessionRefreshTimer = null;
        const current = publishedSessionRef.current;
        if (
          !current ||
          current.access_token !== candidate.access_token ||
          !hasUnchangedSessionBinding(candidate, current)
        ) {
          return;
        }
        // `resumeForegroundPublication` owns the typed refresh, exact-session
        // verification, deletion preflight, provider renewal, and publication.
        void resumeForegroundPublication();
      }, delay);
    }

    resumeForegroundPublicationRef.current = resumeForegroundPublication;
    schedulePublicationRecoveryRef.current = schedulePublicationRecovery;
    cancelPublicationRecoveryRef.current = cancelPublicationRecovery;
    scheduleControlledSessionRefreshRef.current = scheduleControlledSessionRefresh;
    cancelControlledSessionRefreshRef.current = cancelControlledSessionRefresh;

    const checkAppleCredentialBeforeForeground = (
      retainedSession: Session,
      priorState: AppStateStatus | null,
    ): Promise<void> => {
      const existing = appleForegroundCredentialCheckPromiseRef.current;
      if (existing) return existing;

      // Stop automatic token work and block every new RevenueCat admission
      // synchronously. Existing native store tickets remain valid long enough
      // to settle, while SessionBoundaryGate hides all interactive children.
      supabase.auth.stopAutoRefresh();
      pauseRevenueCatPublicationAdmission();
      setSessionBoundaryError(false);
      setInitializing(true);
      const boundaryEpoch = authBoundaryEpochRef.current;

      const completion = (async () => {
        const result = await checkAppleCredentialForSession(retainedSession.user);
        if (
          disposed ||
          AppState.currentState !== 'active' ||
          authBoundaryEpochRef.current !== boundaryEpoch
        ) {
          return;
        }
        const current = currentBoundarySession();
        if (!current || !hasUnchangedSessionBinding(retainedSession, current)) return;

        if (result.status === 'invalid') {
          await handleAppleCredentialInvalidRef.current(result.reason);
          return;
        }
        if (result.status === 'blocked') {
          await handleAppleCredentialCheckBlockedRef.current(current, result.reason);
          return;
        }

        const retainedPublication =
          resumeRevenueCatPublicationAdmission() &&
          hasActiveRevenueCatPublication(current.user.id, current.access_token);
        if (priorState === 'inactive' && retainedPublication) {
          // The transient overlay never closed the publication. Re-open the UI
          // only after Apple's result, without detaching the native store flow.
          setSession(current);
          setInitializing(false);
          retrySessionRestoreRef.current = null;
          scheduleControlledSessionRefresh(current);
          return;
        }

        // A true background/unknown state closed publication authority. Clear
        // this single-flight marker before entering the normal reacquisition
        // path so it cannot self-wait.
        appleForegroundCredentialCheckPromiseRef.current = null;
        await resumeForegroundPublication();
      })();
      appleForegroundCredentialCheckPromiseRef.current = completion;
      void completion.finally(() => {
        if (appleForegroundCredentialCheckPromiseRef.current === completion) {
          appleForegroundCredentialCheckPromiseRef.current = null;
        }
      });
      return completion;
    };

    let previousAppState: AppStateStatus | null = AppState.currentState;
    const handle = (state: AppStateStatus | null) => {
      const priorState = previousAppState;
      previousAppState = state;
      if (state === 'active') {
        if (initialSessionRestorePendingRef.current) {
          foregroundResumeRequestedRef.current = true;
          return;
        }
        const published = publishedSessionRef.current;
        const retained = currentBoundarySession();
        if (retained && hasAppleIdentity(retained.user)) {
          void checkAppleCredentialBeforeForeground(retained, priorState);
          return;
        }
        if (
          priorState === 'inactive' &&
          published &&
          !sessionBoundaryActiveRef.current &&
          hasActiveRevenueCatPublication(published.user.id, published.access_token)
        ) {
          // iOS uses `inactive` for StoreKit/Face ID/system overlays. Those
          // overlays are privacy-shielded elsewhere and must not revoke the
          // in-flight purchase/restore ticket. A real background transition
          // closes commerce authority below.
          scheduleControlledSessionRefresh(published);
          return;
        }
        void resumeForegroundPublication();
        return;
      }

      supabase.auth.stopAutoRefresh();
      if (state === 'inactive') {
        // Keep the exact publication ticket alive across transient iOS system
        // UI. AppLock's privacy shield still obscures sensitive content.
        return;
      }
      authBoundaryEpochRef.current += 1;
      publicationRecoveryNeededRef.current = currentBoundarySession() !== null;
      cancelPublicationRecovery();
      cancelControlledSessionRefresh();

      // `currentState` can be null while React Native is discovering launch
      // state. Close commerce authority for true background/unknown states,
      // but retain an exact owner-bound local session so vendor or network
      // downtime cannot block offline shelf/routine/photo use.
      closeRemoteRequestAuthorityRef.current();
      const publicationDrain = closeRevenueCatPublication('app_backgrounded');
      publicationDrainPromiseRef.current = publicationDrain;
      void publicationDrain.catch(() => {});
    };
    // restoreSession owns the initial active publication. Calling the normal
    // foreground path here would race its first awaited storage read, publish
    // the pending null candidate, and invalidate the restore sequence.
    if (AppState.currentState !== 'active') handle(AppState.currentState);
    const subscription = AppState.addEventListener('change', handle);
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (
        !online ||
        disposed ||
        AppState.currentState !== 'active' ||
        appleForegroundCredentialCheckPromiseRef.current
      ) {
        return;
      }
      const published = publishedSessionRef.current;
      if (
        (published &&
          !sessionBoundaryActiveRef.current &&
          !hasActiveRevenueCatPublication(published.user.id, published.access_token)) ||
        (sessionBoundaryActiveRef.current && currentBoundarySession() !== null)
      ) {
        publicationRecoveryNeededRef.current = true;
        cancelPublicationRecovery();
        void resumeForegroundPublication();
      }
    });
    return () => {
      disposed = true;
      cancelPublicationRecovery();
      cancelControlledSessionRefresh();
      publicationRecoveryNeededRef.current = false;
      schedulePublicationRecoveryRef.current = () => {};
      cancelPublicationRecoveryRef.current = () => {};
      scheduleControlledSessionRefreshRef.current = () => {};
      cancelControlledSessionRefreshRef.current = () => {};
      resumeForegroundPublicationRef.current = async () => {};
      foregroundResumeRequestedRef.current = false;
      appleForegroundCredentialCheckPromiseRef.current = null;
      subscription.remove();
      unsubscribeOnline();
      // AccountDeletionRecoveryGate can unmount AuthProvider while a durable
      // deletion remains unresolved. Do not leave the singleton refresh loop
      // running behind that pre-Auth gate.
      supabase.auth.stopAutoRefresh();
    };
  }, [accountIsolationE2EFixture]);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    const accessToken = session?.access_token ?? null;
    if (!userId || !accessToken || initializing || accountIsolationE2EFixture) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;
    type CustomerInfo = Parameters<typeof customerInfoToStoredEntitlement>[0];
    type CustomerInfoPublishResult = Awaited<ReturnType<typeof publishCustomerInfoEvidence>>;
    let customerInfoWriteTail: Promise<void> = Promise.resolve();
    let uncachedRefreshAttempts = 0;
    let uncachedRefreshPromise: Promise<void> | null = null;
    let uncachedRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let releaseInitialListenerWrites = () => {};
    const MAX_UNCACHED_REFRESH_ATTEMPTS = 2;
    const canWriteForUser = () =>
      !cancelled &&
      !sessionBoundaryActiveRef.current &&
      activeUserIdRef.current === userId &&
      hasActiveRevenueCatPublication(userId, accessToken);
    const persistCustomerInfo = async (
      customerInfo: CustomerInfo,
    ): Promise<CustomerInfoPublishResult | null> => {
      if (!canWriteForUser()) return null;
      assertRevenueCatResultCurrent(customerInfo);
      const context = await entitlementOwnerContextForUser(userId);
      assertRevenueCatResultCurrent(customerInfo);
      if (!canWriteForUser()) return null;
      const entitlement = customerInfoToStoredEntitlement(customerInfo);
      const result = await publishCustomerInfoEvidence({
        context,
        customerInfo,
        entitlement,
        queryClient,
      });
      assertRevenueCatResultCurrent(customerInfo);
      if (!canWriteForUser()) return null;
      if (result.status === 'blocked' || result.status === 'rejected') {
        throw new Error(result.reason);
      }
      return result;
    };
    const enqueueCustomerInfoWrite = (
      customerInfo: CustomerInfo,
    ): Promise<CustomerInfoPublishResult | null> => {
      const operation = customerInfoWriteTail.then(
        () => persistCustomerInfo(customerInfo),
        () => persistCustomerInfo(customerInfo),
      );
      customerInfoWriteTail = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    };
    const publishTicketBoundCustomerInfo = (customerInfo: CustomerInfo) =>
      runRevenueCatResultWrite(customerInfo, () => enqueueCustomerInfoWrite(customerInfo));

    const scheduleUncachedRefresh = (delayMs = 0): void => {
      if (
        !canWriteForUser() ||
        uncachedRefreshPromise ||
        uncachedRetryTimer ||
        uncachedRefreshAttempts >= MAX_UNCACHED_REFRESH_ATTEMPTS
      ) {
        return;
      }
      if (delayMs > 0) {
        uncachedRetryTimer = setTimeout(() => {
          uncachedRetryTimer = null;
          scheduleUncachedRefresh();
        }, delayMs);
        return;
      }

      uncachedRefreshAttempts += 1;
      const attempt = uncachedRefreshAttempts;
      let retry = false;
      const operation = (async () => {
        const current = await getUncachedCustomerInfo();
        if (!current || !canWriteForUser()) return;
        const result = await publishTicketBoundCustomerInfo(current);
        retry = Boolean(result?.requiresUncachedRefresh || result?.status === 'conflict');
        if (!retry) uncachedRefreshAttempts = 0;
      })()
        .catch((error: unknown) => {
          if (!canWriteForUser()) return;
          retry = true;
          devWarn('[revenuecat] uncached CustomerInfo recovery failed', error);
        })
        .finally(() => {
          uncachedRefreshPromise = null;
          if (retry && canWriteForUser() && attempt < MAX_UNCACHED_REFRESH_ATTEMPTS) {
            scheduleUncachedRefresh(250 * 2 ** (attempt - 1));
          }
        });
      uncachedRefreshPromise = operation;
    };
    const handleCustomerInfoFailure = (error: unknown): void => {
      if (!canWriteForUser()) return;
      devWarn('[revenuecat] CustomerInfo evidence publication failed', error);
      scheduleUncachedRefresh();
    };

    void (async () => {
      await configureRevenueCat(userId);
      if (!canWriteForUser()) return;

      // RevenueCat does not replay the latest CustomerInfo when a listener is
      // added. Establish the listener before reading the initial snapshot, and
      // buffer bridge events until that snapshot settles. Every ticket-valid
      // arrival is then committed FIFO; the evidence engine, not arrival
      // filtering, owns cursor ordering and equal-time conflict detection.
      let bufferingInitialRead = true;
      let initialListenerWritesReleased = false;
      let resolveInitialListenerWrites!: () => void;
      const initialListenerWrites = new Promise<void>((resolve) => {
        resolveInitialListenerWrites = resolve;
      });
      const releaseInitialWrites = () => {
        if (initialListenerWritesReleased) return;
        initialListenerWritesReleased = true;
        resolveInitialListenerWrites();
      };
      releaseInitialListenerWrites = releaseInitialWrites;
      const bufferedCustomerInfo: CustomerInfo[] = [];
      cleanup = await subscribeToCustomerInfoUpdates(
        (customerInfo) => {
          if (bufferingInitialRead) {
            bufferedCustomerInfo.push(customerInfo);
            return initialListenerWrites;
          }
          return publishTicketBoundCustomerInfo(customerInfo).then((result) => {
            if (result?.requiresUncachedRefresh || result?.status === 'conflict') {
              scheduleUncachedRefresh();
            }
          });
        },
        (error) => handleCustomerInfoFailure(error),
      );
      if (cancelled) {
        cleanup();
        bufferingInitialRead = false;
        releaseInitialWrites();
        return;
      }

      let currentCustomerInfo: CustomerInfo | null = null;
      let initialReadError: unknown = null;
      try {
        const current = await getCustomerInfo();
        if (current) currentCustomerInfo = current;
      } catch (error: unknown) {
        initialReadError = error;
      }

      const initialCustomerInfo = currentCustomerInfo
        ? [...bufferedCustomerInfo, currentCustomerInfo]
        : bufferedCustomerInfo;
      bufferingInitialRead = false;
      try {
        for (const customerInfo of initialCustomerInfo) {
          if (!canWriteForUser()) break;
          const result = await publishTicketBoundCustomerInfo(customerInfo);
          if (result?.requiresUncachedRefresh || result?.status === 'conflict') {
            scheduleUncachedRefresh();
          }
        }
      } finally {
        releaseInitialWrites();
      }
      if (initialReadError) throw initialReadError;
    })().catch((error: unknown) => {
      handleCustomerInfoFailure(error);
    });

    return () => {
      cancelled = true;
      if (uncachedRetryTimer) clearTimeout(uncachedRetryTimer);
      uncachedRetryTimer = null;
      releaseInitialListenerWrites();
      if (cleanup) cleanup();
    };
  }, [accountIsolationE2EFixture, initializing, session?.access_token, session?.user.id]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const runFreshAuthentication = async <T,>(operation: () => Promise<T>): Promise<T> => {
      if (authSemanticOperationPendingRef.current) {
        throw new Error('AUTH_SEMANTIC_OPERATION_ALREADY_ACTIVE');
      }
      authBoundaryEpochRef.current += 1;
      freshAuthenticationPendingRef.current = true;
      authSemanticOperationPendingRef.current = true;
      try {
        return await operation();
      } catch (error: unknown) {
        freshAuthenticationPendingRef.current = false;
        throw error;
      } finally {
        authSemanticOperationPendingRef.current = false;
        const deferred = deferredAuthSemanticBoundaryRef.current;
        deferredAuthSemanticBoundaryRef.current = null;
        if (deferred) {
          void applySessionBoundaryRef.current(deferred.session);
        }
      }
    };
    const completeExplicitSignOut = async (): Promise<void> => {
      authBoundaryEpochRef.current += 1;
      // Invalidate every account-publication continuation before its next
      // request. Closing admission aborts transport leases; this sequence
      // fence also stops an already-settled refresh result from reaching the
      // deletion preflight or provider activation path.
      sessionChangeSeqRef.current += 1;
      pendingEmailCodeRef.current = null;
      freshAuthenticationPendingRef.current = false;
      explicitSignOutPendingRef.current = true;
      const signOutSession =
        publishedSessionRef.current ??
        session ??
        pendingBoundarySessionRef.current?.session ??
        null;
      let signOutBinding: SupabaseRemoteSessionBinding | null = null;
      if (signOutSession) {
        try {
          signOutBinding = requireSupabaseRemoteSessionBinding(
            signOutSession.access_token,
            signOutSession.user.id,
          );
        } catch {
          // A malformed cached bearer cannot authorize a remote logout. Local
          // durable cleanup remains authoritative and still proceeds.
        }
      }
      showSessionBoundaryRef.current(null);

      if (isSupabaseConfigured && !accountIsolationE2EFixture) {
        try {
          // The marker is the crash-recovery authority. Never remove the
          // encrypted session until this commit succeeds; once it does, a cold
          // launch must finish cleanup instead of republishing the account.
          await markAuthDerivedCleanupRequired();
          await clearPersistedSessionAfterRemoteDrainRef.current();
        } catch (error: unknown) {
          devWarn('[auth] local sign-out durability failed closed', error);
          retrySessionRestoreRef.current = completeExplicitSignOut;
          setInitializing(false);
          setSessionBoundaryError(true);
          throw error;
        }

        if (signOutBinding) {
          try {
            // Global refresh-token revocation is best-effort and bounded. The
            // local session and recovery marker are already durable, so a
            // provider outage cannot resurrect the account on this device.
            await revokeSupabaseRefreshTokens(signOutBinding);
          } catch (error: unknown) {
            devWarn('[auth] remote sign-out failed; completing local sign-out', error);
          }
        }
      }

      await applySessionBoundaryRef.current(null);
      const localBoundaryCommitted =
        !sessionBoundaryActiveRef.current &&
        pendingBoundarySessionRef.current === null &&
        publishedSessionRef.current === null &&
        activeUserIdRef.current === null &&
        !explicitSignOutPendingRef.current;
      if (!localBoundaryCommitted) {
        retrySessionRestoreRef.current = completeExplicitSignOut;
        setInitializing(false);
        setSessionBoundaryError(true);
        throw new Error('EXPLICIT_SIGN_OUT_LOCAL_BOUNDARY_INCOMPLETE');
      }

      if (isSupabaseConfigured && !accountIsolationE2EFixture) {
        try {
          await clearAuthDerivedCleanupRequired();
        } catch (error: unknown) {
          // Retaining the marker is fail-closed: a cold launch repeats the
          // idempotent cleanup rather than trusting an unproven sign-out.
          devWarn('[auth] sign-out recovery marker clear failed closed', error);
          showSessionBoundaryRef.current(null);
          retrySessionRestoreRef.current = completeExplicitSignOut;
          setInitializing(false);
          setSessionBoundaryError(true);
          throw error;
        }
      }
      retrySessionRestoreRef.current = null;
    };
    return {
      session,
      user,
      isAnonymous: user?.is_anonymous ?? false,
      initializing,
      sessionBoundaryError,
      async retrySessionBoundary() {
        if (isAccountDeletionIntakeHoldActive() || isAccountActivityBlockedForDeletion()) {
          return;
        }
        const restoreSession = retrySessionRestoreRef.current;
        if (restoreSession) {
          await restoreSession();
          return;
        }
        const pending = pendingBoundarySessionRef.current;
        if (!pending) return;
        showSessionBoundaryRef.current(pending.session);
        await applySessionBoundaryRef.current(pending.session);
      },
      async ensureAnonymousSession(captchaToken?: string) {
        if (!isSupabaseConfigured) return;

        if (session && !appleCredentialQuarantinedRef.current) return;
        // BLOCKED: B-TURNSTILE. CaptchaToken expected here once Turnstile is wired.
        const { error: signInError } = await runFreshAuthentication(() =>
          runWithSupabaseFreshAuthPermit(() =>
            supabase.auth.signInAnonymously(
              captchaToken ? { options: { captchaToken } } : undefined,
            ),
          ),
        );
        if (signInError) {
          freshAuthenticationPendingRef.current = false;
          throw signInError;
        }
      },
      async signInWithApple() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const result = await getAppleIdToken();
        if (!result) return false;
        await runFreshAuthentication(() =>
          authenticateWithProviderToken(supabase.auth, session, {
            provider: 'apple',
            token: result.idToken,
          }),
        );
        pendingEmailCodeRef.current = null;
        return true;
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const result = await getGoogleIdToken();
        if (!result) return false;
        await runFreshAuthentication(() =>
          authenticateWithProviderToken(supabase.auth, session, {
            provider: 'google',
            token: result.idToken,
          }),
        );
        pendingEmailCodeRef.current = null;
        return true;
      },
      async sendEmailOtp(email: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        // OTP code (not magic link) for mobile reliability (docs/01 §1).
        pendingEmailCodeRef.current = null;
        const request = await runFreshAuthentication(() =>
          requestEmailAccountCode(supabase.auth, session, email),
        );
        if (request.kind === 'anonymous_upgrade_complete') return 'complete';
        freshAuthenticationPendingRef.current = false;
        pendingEmailCodeRef.current = request;
        return 'code_sent';
      },
      async verifyEmailOtp(email: string, token: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const pending = pendingEmailCodeRef.current;
        if (!pending) throw new Error('Request a new email code before verifying.');
        await runFreshAuthentication(() =>
          verifyEmailAccountCode(supabase.auth, session, pending, email, token),
        );
        pendingEmailCodeRef.current = null;
      },
      signOut: completeExplicitSignOut,
    };
  }, [accountIsolationE2EFixture, initializing, session, sessionBoundaryError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
