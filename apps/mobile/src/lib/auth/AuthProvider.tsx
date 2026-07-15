import type { Session, User } from '@supabase/supabase-js';
import { router, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
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
import {
  AnonymousOnboardingRequestSupersededError,
  anonymousHandoffNeedsSessionPublication,
  createWelcomeHandoffCoordinator,
  decideAnonymousSessionResolution,
  type PendingAnonymousOnboardingHandoff,
} from '@/features/onboarding/welcomeSessionHandoff';
import { isSupabaseConfigured } from '@/lib/env';
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/errors/userFacing';
import {
  configureRevenueCat,
  customerInfoToStoredEntitlement,
  getCustomerInfo,
  prepareRevenueCatIdentityForSessionPublication,
  subscribeToCustomerInfoUpdates,
} from '@/lib/iap/revenuecat';
import { devWarn } from '@/lib/observability/safeLog';
import { setSentryUser } from '@/lib/observability/sentry';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import {
  invalidateLocalSupabaseSession,
  runSupabaseAuthStorageMutation,
  supabase,
} from '../supabase/client';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from './accountGeneration';
import {
  blockAccountDeletionVendorWritesUntilHydrated,
  hydrateAccountDeletionVendorFreeze,
} from './accountDeletionVendorFreeze';
import { reconcileAccountDeletionCompletionReceipt } from './accountDeletionCompletion';
import {
  getAccountIsolationE2EFixture,
  seedAccountIsolationE2EFixture,
} from './accountIsolationE2E';
import {
  authSessionFingerprint,
  authenticateWithProviderToken,
  requestEmailAccountCode,
  verifyEmailAccountCode,
  type PendingEmailAccountCode,
} from './accountUpgrade';
import { createAuthMutationFence } from './authMutationFence';
import {
  createDevLocalResetCoordinator,
  latestSessionForDevLocalReset,
} from './devLocalResetCoordinator';
import { clearAccountIsolatedState, prepareLocalDataForSession } from './localAccountIsolation';
import {
  createProviderAuthTransitionTracker,
  createProviderSignInCoordinator,
  requestTokenFromLazyProviderModule,
} from './providerSignIn';
import { createProviderAuthCommitCoordinator } from './providerAuthCommit';
import {
  createSessionBoundaryQueueState,
  enqueueSessionBoundaryOperation,
} from './sessionBoundaryQueue';
import { latestSessionForCompletedBoundary } from './sessionBoundary';
import { claimLocalDataOwnership } from './sessionOwner';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  initializing: boolean;
  sessionBoundaryError: boolean;
  anonymousOnboardingHandoff: PendingAnonymousOnboardingHandoff | null;
  completedSessionPublication: number;
  retrySessionBoundary: () => Promise<void>;
  resetLocalStateForE2E: () => Promise<void>;
  /** Guest-first entry: create an anonymous session if none exists (docs/01 §1). */
  ensureAnonymousSession: (
    captchaToken?: string,
  ) => Promise<PendingAnonymousOnboardingHandoff | null>;
  isAnonymousOnboardingHandoffCurrent: (requestId: number) => boolean;
  registerAnonymousOnboardingConsumer: () => () => void;
  settleAnonymousOnboardingHandoff: (requestId: number) => boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const accountIsolationE2EFixture = useMemo(() => getAccountIsolationE2EFixture(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [completedSessionPublication, setCompletedSessionPublication] = useState(0);
  const [anonymousOnboardingHandoff, setAnonymousOnboardingHandoff] =
    useState<PendingAnonymousOnboardingHandoff | null>(null);
  const [initializing, setInitializing] = useState(
    isSupabaseConfigured || accountIsolationE2EFixture !== null,
  );
  const [sessionBoundaryError, setSessionBoundaryError] = useState(false);
  const activeUserIdRef = useRef<string | null>(null);
  const publishedSessionRef = useRef<Session | null>(session);
  const publishedSessionUserIdRef = useRef<string | null>(null);
  const completedSessionPublicationRef = useRef(0);
  const pendingEmailCodeRef = useRef<PendingEmailAccountCode | null>(null);
  const sessionBoundaryActiveRef = useRef(false);
  const publishedProviderSessionRef = useRef(authSessionFingerprint(session));
  const sessionBoundaryWriteLockHeldRef = useRef(false);
  const pendingBoundarySessionRef = useRef<{ session: Session | null } | null>(null);
  const authEffectEpochRef = useRef(0);
  const sessionBoundaryQueueRef = useRef(createSessionBoundaryQueueState());
  const boundaryClearFailureConsumedRef = useRef(false);
  const accountIsolationE2ESeededRef = useRef(false);
  const explicitSignOutPendingRef = useRef(false);
  const retrySessionRestoreRef = useRef<(() => Promise<void>) | null>(null);
  const applySessionBoundaryRef = useRef<
    (
      nextSession: Session | null,
      initialRestore?: boolean,
      forceQueue?: boolean,
    ) => Promise<void>
  >(async () => {});
  const showSessionBoundaryRef = useRef<(nextSession: Session | null) => void>(() => {});
  const [welcomeHandoffCoordinator] = useState(() =>
    createWelcomeHandoffCoordinator({
      onChange: setAnonymousOnboardingHandoff,
    }),
  );
  const [authMutationFence] = useState(createAuthMutationFence);
  const [devLocalResetCoordinator] = useState(() =>
    createDevLocalResetCoordinator({
      claimOwnership: claimLocalDataOwnership,
      clearAccountState: clearAccountIsolatedState,
    }),
  );
  const [providerAuthTransitionTracker] = useState(() =>
    createProviderAuthTransitionTracker(authSessionFingerprint(session)),
  );
  const [providerAuthCommitCoordinator] = useState(() =>
    createProviderAuthCommitCoordinator({
      authMutationFence,
      isAppActive: () => AppState.currentState === 'active',
      startAutoRefresh: () => supabase.auth.startAutoRefresh(),
      stopAutoRefresh: () => supabase.auth.stopAutoRefresh(),
    }),
  );
  const [providerSignInCoordinator] = useState(createProviderSignInCoordinator);
  const isAnonymousOnboardingHandoffCurrent = useCallback(
    (requestId: number) => welcomeHandoffCoordinator.isCurrent(requestId),
    [welcomeHandoffCoordinator],
  );
  const registerAnonymousOnboardingConsumer = useCallback(
    () =>
      welcomeHandoffCoordinator.registerConsumer(
        () => sessionBoundaryActiveRef.current,
      ),
    [welcomeHandoffCoordinator],
  );
  const settleAnonymousOnboardingHandoff = useCallback(
    (requestId: number) => welcomeHandoffCoordinator.settle(requestId),
    [welcomeHandoffCoordinator],
  );
  const resetLocalStateForE2E = useCallback(() => {
    if (
      typeof __DEV__ === 'undefined' ||
      !__DEV__ ||
      process.env.EXPO_PUBLIC_E2E_LOCAL_RESET !== '1'
    ) {
      return Promise.reject(new Error('E2E_LOCAL_RESET_UNAVAILABLE'));
    }
    return devLocalResetCoordinator.requestSingleFlight(() =>
      authMutationFence.runExclusive(async () => {
        const targetSession = latestSessionForDevLocalReset(
          pendingBoundarySessionRef.current,
          publishedSessionRef.current,
        );
        await applySessionBoundaryRef.current(targetSession, false, true);
      }),
    );
  }, [authMutationFence, devLocalResetCoordinator]);

  useEffect(() => {
    let mounted = true;
    const effectEpoch = ++authEffectEpochRef.current;

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
      blockAccountDeletionVendorWritesUntilHydrated();
      pendingBoundarySessionRef.current = { session: nextSession };
      sessionBoundaryActiveRef.current = true;
      holdSessionBoundaryWriteLock();
      pendingEmailCodeRef.current = null;
      setSessionBoundaryError(false);
      setInitializing(true);
      publishedProviderSessionRef.current = authSessionFingerprint(null);
      setSession(null);
      setSentryUser(null);
    }
    showSessionBoundaryRef.current = showSessionBoundary;

    function applySessionBoundary(
      nextSession: Session | null,
      initialRestore = false,
      forceQueue = false,
    ): Promise<void> {
      providerAuthTransitionTracker.observe(authSessionFingerprint(nextSession));
      const targetUserId = nextSession?.user.id ?? null;
      if (explicitSignOutPendingRef.current && targetUserId && !forceQueue) {
        return Promise.resolve();
      }
      pendingBoundarySessionRef.current = { session: nextSession };
      return enqueueSessionBoundaryOperation(sessionBoundaryQueueRef.current, {
        effectEpoch,
        forceQueue,
        targetUserId,
        onQueued: () => {
          if (
            forceQueue ||
            initialRestore ||
            sessionBoundaryActiveRef.current ||
            targetUserId !== activeUserIdRef.current
          ) {
            showSessionBoundary(nextSession);
          }
        },
        resumeAfterInherited: async () => {
          if (!mounted) return;
          const inheritedSuccessor = sessionBoundaryQueueRef.current.inFlight;
          if (inheritedSuccessor) return inheritedSuccessor.promise;
          await applySessionBoundary(nextSession, initialRestore, forceQueue);
        },
        run: async ({ isCurrent }) => {
          if (!mounted || !isCurrent()) return;

          let resolvedSession = nextSession;
          let resolvedTargetUserId = targetUserId;
          const previousUserId = activeUserIdRef.current;

          try {
            if (accountIsolationE2EFixture && !accountIsolationE2ESeededRef.current) {
              await seedAccountIsolationE2EFixture(accountIsolationE2EFixture);
              accountIsolationE2ESeededRef.current = true;
            }
            const deletionCompleted = accountIsolationE2EFixture
              ? false
              : await reconcileAccountDeletionCompletionReceipt();
            if (deletionCompleted) {
              resolvedSession = null;
              resolvedTargetUserId = null;
              providerAuthTransitionTracker.observe(authSessionFingerprint(null));
              pendingBoundarySessionRef.current = { session: null };
              showSessionBoundary(null);
              await invalidateLocalSupabaseSession();
            }
            if (
              !resolvedTargetUserId &&
              explicitSignOutPendingRef.current &&
              !accountIsolationE2EFixture &&
              !deletionCompleted
            ) {
              await invalidateLocalSupabaseSession();
            }
            let result = await prepareLocalDataForSession(
              previousUserId,
              resolvedTargetUserId,
              undefined,
              async () => {
                if (!mounted || !isCurrent()) return;
                showSessionBoundary(resolvedSession);
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
            );
            if (deletionCompleted && !result.cleared) {
              await clearAccountIsolatedState();
              result = { cleared: true, resetRoute: true };
            }
            await devLocalResetCoordinator.runIfRequired(resolvedTargetUserId, isCurrent);
            if (devLocalResetCoordinator.isPublicationBlocked()) {
              throw new Error('E2E_LOCAL_RESET_INCOMPLETE');
            }
            // Hydrate the durable deletion receipt before publishing the session.
            // The RevenueCat effect below can therefore never reconfigure an
            // owner whose deletion survived a force-quit/relaunch.
            const revenueCatFreezeState = await hydrateAccountDeletionVendorFreeze(
              resolvedTargetUserId,
            );
            // A native RevenueCat singleton can outlive the local JS/session
            // owner (for example across a reload). Keep the session unpublished
            // until it is anonymous or, only with an open deletion gate, proves
            // this exact target. Failure remains behind SessionBoundaryGate and
            // its explicit retry path.
            if (sessionBoundaryActiveRef.current && !accountIsolationE2EFixture) {
              await prepareRevenueCatIdentityForSessionPublication(
                revenueCatFreezeState === 'frozen' ? null : resolvedTargetUserId,
              );
            }

            if (devLocalResetCoordinator.isPublicationBlocked()) {
              throw new Error('E2E_LOCAL_RESET_INCOMPLETE');
            }
            if (!mounted || !isCurrent()) return;
            activeUserIdRef.current = resolvedTargetUserId;
            if (!resolvedTargetUserId) explicitSignOutPendingRef.current = false;
            const latestPendingSession = latestSessionForCompletedBoundary(
              pendingBoundarySessionRef.current?.session,
              resolvedSession,
              resolvedTargetUserId,
            );
            pendingBoundarySessionRef.current = null;
            sessionBoundaryActiveRef.current = false;
            releaseSessionBoundaryWriteLock();
            setSessionBoundaryError(false);
            publishedSessionUserIdRef.current = latestPendingSession?.user.id ?? null;
            completedSessionPublicationRef.current += 1;
            setCompletedSessionPublication(completedSessionPublicationRef.current);
            providerAuthTransitionTracker.observe(authSessionFingerprint(latestPendingSession));
            publishedProviderSessionRef.current = authSessionFingerprint(latestPendingSession);
            publishedSessionRef.current = latestPendingSession;
            setSession(latestPendingSession);
            const redirectAfterDevReset =
              devLocalResetCoordinator.consumeRedirectAfterSuccessfulPublication();
            if (result.resetRoute || redirectAfterDevReset) router.replace('/');
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
            if (!mounted || !isCurrent()) return;
            showSessionBoundary(resolvedSession);
            setInitializing(false);
            setSessionBoundaryError(true);
          }
        },
      });
    }

    applySessionBoundaryRef.current = applySessionBoundary;

    async function restoreSession(): Promise<void> {
      if (!mounted) return;
      const seqBeforeRestore = sessionBoundaryQueueRef.current.sequence;
      showSessionBoundary(null);
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!mounted || seqBeforeRestore !== sessionBoundaryQueueRef.current.sequence) return;
        retrySessionRestoreRef.current = null;
        await applySessionBoundary(data.session, true);
      } catch (error: unknown) {
        devWarn('[auth] initial session restore failed', error);
        if (!mounted || seqBeforeRestore !== sessionBoundaryQueueRef.current.sequence) return;
        retrySessionRestoreRef.current = restoreSession;
        showSessionBoundary(null);
        setInitializing(false);
        setSessionBoundaryError(true);
      }
    }

    if (accountIsolationE2EFixture) {
      const globalLike = globalThis as AccountIsolationE2EGlobal;
      globalLike.__ROUTINEKIND_E2E_NAVIGATE__ = (href) => router.replace(href as Href);
      // The fixture follows the real cold-start isolation path. Publishing its
      // synthetic owner eagerly would bypass the durable owner claim and make
      // the private-storage startup gate correctly reject a clean namespace.
      void applySessionBoundary(accountIsolationE2EFixture.session, true);
      return () => {
        mounted = false;
        delete globalLike.__ROUTINEKIND_E2E_NAVIGATE__;
        applySessionBoundaryRef.current = async () => {};
        showSessionBoundaryRef.current = () => {};
        retrySessionRestoreRef.current = null;
        releaseSessionBoundaryWriteLock();
      };
    }

    if (!isSupabaseConfigured) {
      activeUserIdRef.current = null;
      void hydrateAccountDeletionVendorFreeze(null).catch((error: unknown) => {
        devWarn('[auth] account-deletion vendor freeze hydration failed', error);
      });
      return () => {
        mounted = false;
        applySessionBoundaryRef.current = async () => {};
        showSessionBoundaryRef.current = () => {};
        retrySessionRestoreRef.current = null;
        releaseSessionBoundaryWriteLock();
      };
    }

    void restoreSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySessionBoundary(nextSession);
    });
    return () => {
      mounted = false;
      applySessionBoundaryRef.current = async () => {};
      showSessionBoundaryRef.current = () => {};
      retrySessionRestoreRef.current = null;
      releaseSessionBoundaryWriteLock();
      sub.subscription.unsubscribe();
    };
  }, [accountIsolationE2EFixture, devLocalResetCoordinator, providerAuthTransitionTracker]);

  // Start/stop token auto-refresh with app foreground/background (docs/01 §5).
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const handle = (state: AppStateStatus) =>
      providerAuthCommitCoordinator.handleAppStateChange(state);
    handle(AppState.currentState);
    const subscription = AppState.addEventListener('change', handle);
    return () => subscription.remove();
  }, [providerAuthCommitCoordinator]);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    setSentryUser(userId);
    if (!userId || initializing || accountIsolationE2EFixture) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;
    const canWriteForUser = () =>
      !cancelled && !sessionBoundaryActiveRef.current && activeUserIdRef.current === userId;

    void runAccountGenerationOperation(async (lease) => {
      const revenueCatOwner = { appUserId: userId, lease } as const;
      await configureRevenueCat(revenueCatOwner);
      lease.assertCurrent();
      if (!canWriteForUser()) return;
      const current = await getCustomerInfo(revenueCatOwner);
      lease.assertCurrent();
      if (!canWriteForUser()) return;
      const entitlement = current ? customerInfoToStoredEntitlement(current) : null;
      if (entitlement) await saveVerifiedEntitlement(entitlement);
      else if (current) await clearStoreEntitlementIfRevenueCatVerifiedEmpty();
      lease.assertCurrent();
      if (!canWriteForUser()) return;

      const listenerGeneration = lease.generation;
      cleanup = await subscribeToCustomerInfoUpdates(revenueCatOwner, (customerInfo) => {
        if (!canWriteForUser()) return;
        void runAccountGenerationOperation(async (callbackLease) => {
          if (callbackLease.generation !== listenerGeneration || !canWriteForUser()) return;
          callbackLease.assertCurrent();
          const next = customerInfoToStoredEntitlement(customerInfo);
          if (next) await saveVerifiedEntitlement(next);
          else await clearStoreEntitlementIfRevenueCatVerifiedEmpty();
          callbackLease.assertCurrent();
        }).catch((error: unknown) => {
          devWarn('[revenuecat] listener update failed', error);
        });
      });
      if (cancelled && cleanup) cleanup();
    }).catch((error: unknown) => {
      devWarn('[revenuecat] configuration failed', error);
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [accountIsolationE2EFixture, initializing, session?.user.id]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    return {
      session,
      user,
      isAnonymous: user?.is_anonymous ?? false,
      initializing,
      sessionBoundaryError,
      anonymousOnboardingHandoff,
      completedSessionPublication,
      resetLocalStateForE2E,
      async retrySessionBoundary() {
        const restoreSession = retrySessionRestoreRef.current;
        if (restoreSession) {
          await restoreSession();
          return;
        }
        const pending = pendingBoundarySessionRef.current;
        if (!pending) return;
        showSessionBoundaryRef.current(pending.session);
        await applySessionBoundaryRef.current(
          pending.session,
          false,
          devLocalResetCoordinator.isPublicationBlocked(),
        );
      },
      async ensureAnonymousSession(captchaToken?: string) {
        if (!isSupabaseConfigured) return null;
        return authMutationFence.runExclusive(async () => {
          const resolving = welcomeHandoffCoordinator.begin(
            sessionBoundaryQueueRef.current.sequence,
          );
          const { requestId } = resolving;

          const latestAuthTargetUserId = (): string | null => {
            const pendingBoundary = pendingBoundarySessionRef.current;
            if (pendingBoundary) return pendingBoundary.session?.user.id ?? null;
            const inFlightBoundary = sessionBoundaryQueueRef.current.inFlight;
            if (inFlightBoundary) return inFlightBoundary.targetUserId;
            return publishedSessionUserIdRef.current;
          };

          const registerSessionHandoff = (nextSession: Session) => {
            if (!welcomeHandoffCoordinator.isCurrent(requestId)) {
              throw new AnonymousOnboardingRequestSupersededError();
            }

            const expectedUserId = nextSession.user.id;
            const resolution = decideAnonymousSessionResolution({
              authTransitionEpochAtStart: resolving.authTransitionEpochAtStart,
              currentAuthTransitionEpoch: sessionBoundaryQueueRef.current.sequence,
              expectedUserId,
              latestAuthTargetUserId: latestAuthTargetUserId(),
            });
            if (resolution === 'superseded_by_newer_target') {
              welcomeHandoffCoordinator.settle(requestId);
              throw new AnonymousOnboardingRequestSupersededError();
            }

            let requiresSessionPublication = anonymousHandoffNeedsSessionPublication(
              expectedUserId,
              publishedSessionUserIdRef.current,
              sessionBoundaryActiveRef.current,
            );
            if (resolution === 'apply_returned_session') {
              // No auth callback ran after this request started. Publish this exact
              // returned session through the normal isolation boundary ourselves.
              requiresSessionPublication = true;
              void applySessionBoundaryRef.current(nextSession);
            }

            const pending = welcomeHandoffCoordinator.advanceToAwaitingPublication({
              completedSessionPublication: completedSessionPublicationRef.current,
              expectedUserId,
              requestId,
              requiresSessionPublication,
            });
            if (!pending) throw new AnonymousOnboardingRequestSupersededError();
            return pending;
          };

          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (data.session) return registerSessionHandoff(data.session);
            // BLOCKED: B-TURNSTILE. CaptchaToken expected here once Turnstile is wired.
            const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously(
              captchaToken ? { options: { captchaToken } } : undefined,
            );
            if (signInError) throw signInError;
            if (!signInData.session) throw new Error(AUTH_UNAVAILABLE_MESSAGE);
            return registerSessionHandoff(signInData.session);
          } catch (error) {
            welcomeHandoffCoordinator.settle(requestId);
            throw error;
          }
        });
      },
      isAnonymousOnboardingHandoffCurrent,
      registerAnonymousOnboardingConsumer,
      settleAnonymousOnboardingHandoff,
      async signInWithApple() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const authenticated = await providerSignInCoordinator.run(
          'apple',
          (assertRequestCurrent) =>
            requestTokenFromLazyProviderModule(
              async () => (await import('./apple')).getAppleIdToken,
              assertRequestCurrent,
            ),
          {
            authenticate: (provider, token, expectedSession, assertRequestCurrent) =>
              providerAuthCommitCoordinator.runExclusive(() => {
                assertRequestCurrent();
                return authenticateWithProviderToken(
                  supabase.auth,
                  { provider, token },
                  expectedSession,
                  assertRequestCurrent,
                  runSupabaseAuthStorageMutation,
                );
              }),
            getAuthTransitionEpoch: providerAuthTransitionTracker.getEpoch,
            getPublishedSessionFingerprint: () => publishedProviderSessionRef.current,
            isSessionStable: () => !sessionBoundaryActiveRef.current,
          },
        );
        if (authenticated) pendingEmailCodeRef.current = null;
        return authenticated;
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const authenticated = await providerSignInCoordinator.run(
          'google',
          (assertRequestCurrent) =>
            requestTokenFromLazyProviderModule(
              async () => (await import('./google')).getGoogleIdToken,
              assertRequestCurrent,
            ),
          {
            authenticate: (provider, token, expectedSession, assertRequestCurrent) =>
              providerAuthCommitCoordinator.runExclusive(() => {
                assertRequestCurrent();
                return authenticateWithProviderToken(
                  supabase.auth,
                  { provider, token },
                  expectedSession,
                  assertRequestCurrent,
                  runSupabaseAuthStorageMutation,
                );
              }),
            getAuthTransitionEpoch: providerAuthTransitionTracker.getEpoch,
            getPublishedSessionFingerprint: () => publishedProviderSessionRef.current,
            isSessionStable: () => !sessionBoundaryActiveRef.current,
          },
        );
        if (authenticated) pendingEmailCodeRef.current = null;
        return authenticated;
      },
      async sendEmailOtp(email: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        // OTP code (not magic link) for mobile reliability (docs/01 §1).
        return authMutationFence.runExclusive(async () => {
          pendingEmailCodeRef.current = null;
          const request = await requestEmailAccountCode(supabase.auth, email);
          if (request.kind === 'anonymous_upgrade_complete') return 'complete';
          pendingEmailCodeRef.current = request;
          return 'code_sent';
        });
      },
      async verifyEmailOtp(email: string, token: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        return authMutationFence.runExclusive(async () => {
          const pending = pendingEmailCodeRef.current;
          if (!pending) throw new Error('Request a new email code before verifying.');
          await verifyEmailAccountCode(supabase.auth, pending, email, token);
          pendingEmailCodeRef.current = null;
        });
      },
      async signOut() {
        return authMutationFence.runExclusive(async () => {
          pendingEmailCodeRef.current = null;
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
        });
      },
    };
  }, [
    accountIsolationE2EFixture,
    anonymousOnboardingHandoff,
    authMutationFence,
    completedSessionPublication,
    devLocalResetCoordinator,
    initializing,
    isAnonymousOnboardingHandoffCurrent,
    providerAuthCommitCoordinator,
    providerAuthTransitionTracker,
    providerSignInCoordinator,
    registerAnonymousOnboardingConsumer,
    resetLocalStateForE2E,
    session,
    sessionBoundaryError,
    settleAnonymousOnboardingHandoff,
    welcomeHandoffCoordinator,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
