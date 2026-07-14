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

import {
  clearStoreEntitlementIfRevenueCatVerifiedEmpty,
  saveVerifiedEntitlement,
} from '@/features/subscription/store';
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
  configureRevenueCat,
  customerInfoToStoredEntitlement,
  getCustomerInfo,
  resetRevenueCatIdentity,
  subscribeToCustomerInfoUpdates,
} from '@/lib/iap/revenuecat';
import { devWarn } from '@/lib/observability/safeLog';
import { queryClient } from '@/lib/query/queryClient';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import { clearPersistedSupabaseSession, supabase } from '../supabase/client';
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
  monitorAppleCredentialLifecycle,
  type AppleCredentialCheckBlockedReason,
  type AppleCredentialInvalidReason,
} from './appleCredentialLifecycle';
import { getGoogleIdToken } from './google';
import { clearAccountIsolatedState, prepareLocalDataForSession } from './localAccountIsolation';
import { clearAuthDerivedLocalActivity } from './revokedCredentialActivity';
import {
  markLocalDataCleanupRequired,
  preserveLocalDataForForcedSignOut,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const accountIsolationE2EFixture = useMemo(() => getAccountIsolationE2EFixture(), []);
  const initialSession = accountIsolationE2EFixture?.session ?? null;
  const [session, setSession] = useState<Session | null>(initialSession);
  const [initializing, setInitializing] = useState(
    isSupabaseConfigured && accountIsolationE2EFixture === null,
  );
  const [sessionBoundaryError, setSessionBoundaryError] = useState(false);
  const activeUserIdRef = useRef<string | null>(initialSession?.user.id ?? null);
  const pendingEmailCodeRef = useRef<PendingEmailAccountCode | null>(null);
  const sessionChangeSeqRef = useRef(0);
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
  const applySessionBoundaryRef = useRef<
    (nextSession: Session | null, initialRestore?: boolean) => Promise<void>
  >(async () => {});
  const showSessionBoundaryRef = useRef<(nextSession: Session | null) => void>(() => {});
  const handleAppleCredentialInvalidRef = useRef<
    (reason: AppleCredentialInvalidReason) => Promise<void>
  >(async () => {});
  const handleAppleCredentialCheckBlockedRef = useRef<
    (blockedSession: Session, reason: AppleCredentialCheckBlockedReason) => Promise<void>
  >(async () => {});
  const appleCredentialQuarantinedRef = useRef(false);
  const freshAuthenticationPendingRef = useRef(false);

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
    let initialSessionRestorePending = true;

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

    function showSessionBoundary(nextSession: Session | null): void {
      pendingBoundarySessionRef.current = { session: nextSession };
      sessionBoundaryActiveRef.current = true;
      holdSessionBoundaryWriteLock();
      pendingEmailCodeRef.current = null;
      setSessionBoundaryError(false);
      setInitializing(true);
      setSession(null);
    }
    showSessionBoundaryRef.current = showSessionBoundary;

    function handleAppleCredentialInvalid(reason: AppleCredentialInvalidReason): Promise<void> {
      if (appleRevocationBoundaryPromise) return appleRevocationBoundaryPromise;

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
              const { error } = await supabase.auth.signOut({ scope: 'global' });
              if (error) throw error;
              appleRemoteSignOutAttempted = true;
            },
            // Remove the encrypted local session even if the Auth client
            // already removed it. This closes response-loss ambiguity.
            clearPersistedSession: clearPersistedSupabaseSession,
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
              const { error } = await supabase.auth.signOut({ scope: 'local' });
              if (error) throw error;
              rejectedSessionLocalSignOutAttempted = true;
            },
            clearPersistedSession: clearPersistedSupabaseSession,
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
              const { error } = await supabase.auth.signOut({ scope: 'local' });
              if (error) throw error;
              accountDeletionLocalSignOutAttempted = true;
            },
            clearPersistedSession: clearPersistedSupabaseSession,
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

    function applySessionBoundary(
      nextSession: Session | null,
      initialRestore = false,
    ): Promise<void> {
      let targetUserId = nextSession?.user.id ?? null;
      if (explicitSignOutPendingRef.current && targetUserId) return Promise.resolve();
      pendingBoundarySessionRef.current = { session: nextSession };
      const existing = boundaryInFlightRef.current;
      if (existing?.targetUserId === targetUserId) return existing.promise;

      const previousTransition = existing?.promise;
      const seq = ++sessionChangeSeqRef.current;
      if (
        nextSession !== null ||
        initialRestore ||
        sessionBoundaryActiveRef.current ||
        targetUserId !== activeUserIdRef.current
      ) {
        showSessionBoundary(nextSession);
      }

      const promise = (async () => {
        if (previousTransition) await previousTransition;
        if (!mounted || seq !== sessionChangeSeqRef.current) return;
        const previousUserId = activeUserIdRef.current;

        try {
          if (nextSession) {
            let barrierState: Awaited<ReturnType<typeof fetchAccountDeletionBarrierState>>;
            try {
              barrierState = await fetchAccountDeletionBarrierState(nextSession.access_token);
            } catch (error: unknown) {
              if (isAccountDeletionBarrierSessionRejected(error)) {
                await handleRejectedSession();
                return;
              }
              throw error;
            }
            if (!mounted || seq !== sessionChangeSeqRef.current) return;
            if (nextSession.user.id !== barrierState.ownerSubject) {
              // The encrypted Supabase session contains a mutable cached user
              // object. Only the subject authenticated by the same preflight
              // response may become the local/vendor publication target.
              await handleRejectedSession();
              return;
            }
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
          if (!targetUserId && explicitSignOutPendingRef.current && !accountIsolationE2EFixture) {
            await clearPersistedSupabaseSession();
          }
          const result = await prepareLocalDataForSession(
            previousUserId,
            targetUserId,
            undefined,
            async () => {
              if (!mounted || seq !== sessionChangeSeqRef.current) return;
              showSessionBoundary(nextSession);
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
          activeUserIdRef.current = targetUserId;
          if (!targetUserId) explicitSignOutPendingRef.current = false;
          const latestPendingSession = latestSessionForCompletedBoundary(
            pendingBoundarySessionRef.current?.session,
            nextSession,
            targetUserId,
          );
          pendingBoundarySessionRef.current = null;
          sessionBoundaryActiveRef.current = false;
          releaseSessionBoundaryWriteLock();
          setSessionBoundaryError(false);
          setSession(latestPendingSession);
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
          showSessionBoundary(nextSession);
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

    async function restoreSession(): Promise<void> {
      if (!mounted) return;
      initialSessionRestorePending = true;
      const seqBeforeRestore = sessionChangeSeqRef.current;
      showSessionBoundary(null);
      try {
        if (await isAppleCredentialQuarantined()) {
          if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
          appleCredentialQuarantinedRef.current = true;
          initialSessionRestorePending = false;
          retrySessionRestoreRef.current = null;
          await handleAppleCredentialInvalid('persisted_revocation');
          return;
        }
        if (await readAuthDerivedCleanupRequired()) {
          if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
          initialSessionRestorePending = false;
          retrySessionRestoreRef.current = null;
          await handleRejectedSession();
          return;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
        retrySessionRestoreRef.current = null;
        if (data.session) {
          const appleCredential = await checkAppleCredentialForSession(data.session.user);
          if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
          if (appleCredential.status === 'invalid') {
            initialSessionRestorePending = false;
            await handleAppleCredentialInvalid(appleCredential.reason);
            return;
          }
          if (appleCredential.status === 'blocked') {
            initialSessionRestorePending = false;
            await handleAppleCredentialCheckBlocked(data.session, appleCredential.reason);
            return;
          }
        }
        initialSessionRestorePending = false;
        await applySessionBoundary(data.session, true);
      } catch (error: unknown) {
        initialSessionRestorePending = false;
        devWarn('[auth] initial session restore failed', error);
        if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
        retrySessionRestoreRef.current = restoreSession;
        showSessionBoundary(null);
        setInitializing(false);
        setSessionBoundaryError(true);
      }
    }

    if (accountIsolationE2EFixture) {
      const globalLike = globalThis as AccountIsolationE2EGlobal;
      globalLike.__ROUTINEKIND_E2E_NAVIGATE__ = (href) => router.replace(href as Href);
      return () => {
        mounted = false;
        delete globalLike.__ROUTINEKIND_E2E_NAVIGATE__;
        applySessionBoundaryRef.current = async () => {};
        showSessionBoundaryRef.current = () => {};
        retrySessionRestoreRef.current = null;
        handleAppleCredentialInvalidRef.current = async () => {};
        handleAppleCredentialCheckBlockedRef.current = async () => {};
        releaseSessionBoundaryWriteLock();
      };
    }

    if (!isSupabaseConfigured) {
      activeUserIdRef.current = null;
      return () => {
        mounted = false;
        applySessionBoundaryRef.current = async () => {};
        showSessionBoundaryRef.current = () => {};
        retrySessionRestoreRef.current = null;
        handleAppleCredentialInvalidRef.current = async () => {};
        handleAppleCredentialCheckBlockedRef.current = async () => {};
        releaseSessionBoundaryWriteLock();
      };
    }

    void restoreSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (initialSessionRestorePending) return;
      if (appleRevocationBoundaryActive) return;
      if (appleCredentialCheckBoundaryActive) return;
      if (accountDeletionBarrierBoundaryActive) return;
      if (rejectedSessionBoundaryActive) return;
      if (
        appleCredentialQuarantinedRef.current &&
        !(freshAuthenticationPendingRef.current && nextSession)
      ) {
        return;
      }
      void applySessionBoundary(nextSession);
    });
    return () => {
      mounted = false;
      applySessionBoundaryRef.current = async () => {};
      showSessionBoundaryRef.current = () => {};
      retrySessionRestoreRef.current = null;
      handleAppleCredentialInvalidRef.current = async () => {};
      handleAppleCredentialCheckBlockedRef.current = async () => {};
      appleRevocationBoundaryActive = false;
      appleCredentialCheckBoundaryActive = false;
      accountDeletionBarrierBoundaryActive = false;
      rejectedSessionBoundaryActive = false;
      releaseSessionBoundaryWriteLock();
      sub.subscription.unsubscribe();
    };
  }, [accountIsolationE2EFixture]);

  useEffect(() => {
    if (!isSupabaseConfigured || accountIsolationE2EFixture || initializing || !session?.user) {
      return;
    }

    return monitorAppleCredentialLifecycle(session.user, {
      onCredentialCheckBlocked: (reason) =>
        handleAppleCredentialCheckBlockedRef.current(session, reason),
      onCredentialInvalid: (reason) => handleAppleCredentialInvalidRef.current(reason),
    });
  }, [accountIsolationE2EFixture, initializing, session]);

  // Start/stop token auto-refresh with app foreground/background (docs/01 §5).
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const handle = (state: AppStateStatus) => {
      if (state === 'active' && session && !sessionBoundaryActiveRef.current) {
        supabase.auth.startAutoRefresh();
      } else supabase.auth.stopAutoRefresh();
    };
    handle(AppState.currentState);
    const subscription = AppState.addEventListener('change', handle);
    return () => {
      subscription.remove();
      // AccountDeletionRecoveryGate can unmount AuthProvider while a durable
      // deletion remains unresolved. Do not leave the singleton refresh loop
      // running behind that pre-Auth gate.
      supabase.auth.stopAutoRefresh();
    };
  }, [session]);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (!userId || initializing || accountIsolationE2EFixture) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;
    const canWriteForUser = () =>
      !cancelled && !sessionBoundaryActiveRef.current && activeUserIdRef.current === userId;

    void (async () => {
      await configureRevenueCat(userId);
      if (!canWriteForUser()) return;
      const current = await getCustomerInfo();
      if (!canWriteForUser()) return;
      const entitlement = current ? customerInfoToStoredEntitlement(current) : null;
      if (entitlement) await saveVerifiedEntitlement(entitlement);
      else if (current) await clearStoreEntitlementIfRevenueCatVerifiedEmpty();
      if (!canWriteForUser()) return;

      cleanup = await subscribeToCustomerInfoUpdates((customerInfo) => {
        if (!canWriteForUser()) return;
        const next = customerInfoToStoredEntitlement(customerInfo);
        if (next) void saveVerifiedEntitlement(next);
        else void clearStoreEntitlementIfRevenueCatVerifiedEmpty();
      });
      if (cancelled && cleanup) cleanup();
    })().catch((error: unknown) => {
      devWarn('[revenuecat] configuration failed', error);
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [accountIsolationE2EFixture, initializing, session?.user.id]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const runFreshAuthentication = async <T,>(operation: () => Promise<T>): Promise<T> => {
      freshAuthenticationPendingRef.current = true;
      try {
        return await operation();
      } catch (error: unknown) {
        freshAuthenticationPendingRef.current = false;
        throw error;
      }
    };
    return {
      session,
      user,
      isAnonymous: user?.is_anonymous ?? false,
      initializing,
      sessionBoundaryError,
      async retrySessionBoundary() {
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

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session && !appleCredentialQuarantinedRef.current) return;
        // BLOCKED: B-TURNSTILE. CaptchaToken expected here once Turnstile is wired.
        const { error: signInError } = await runFreshAuthentication(() =>
          supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined),
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
          authenticateWithProviderToken(supabase.auth, {
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
          authenticateWithProviderToken(supabase.auth, {
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
          requestEmailAccountCode(supabase.auth, email),
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
          verifyEmailAccountCode(supabase.auth, pending, email, token),
        );
        pendingEmailCodeRef.current = null;
      },
      async signOut() {
        pendingEmailCodeRef.current = null;
        freshAuthenticationPendingRef.current = false;
        explicitSignOutPendingRef.current = true;
        showSessionBoundaryRef.current(null);
        try {
          if (isSupabaseConfigured && !accountIsolationE2EFixture) {
            const { error } = await supabase.auth.signOut();
            if (error) devWarn('[auth] remote sign-out failed; completing local sign-out', error);
          }
        } catch (error: unknown) {
          devWarn('[auth] remote sign-out failed; completing local sign-out', error);
        } finally {
          await applySessionBoundaryRef.current(null);
        }
      },
    };
  }, [accountIsolationE2EFixture, initializing, session, sessionBoundaryError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
