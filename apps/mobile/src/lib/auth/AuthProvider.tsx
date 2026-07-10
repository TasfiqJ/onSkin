import type { Session, User } from '@supabase/supabase-js';
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
import { isSupabaseConfigured } from '@/lib/env';
import { AUTH_UNAVAILABLE_MESSAGE } from '@/lib/errors/userFacing';
import {
  configureRevenueCat,
  customerInfoToStoredEntitlement,
  getCustomerInfo,
  subscribeToCustomerInfoUpdates,
} from '@/lib/iap/revenuecat';
import { devWarn } from '@/lib/observability/safeLog';
import { setSentryUser } from '@/lib/observability/sentry';
import {
  beginPrivateKVAccountBoundary,
  endPrivateKVAccountBoundary,
  waitForPrivateKVWritesToSettle,
} from '@/lib/storage/privateKV';

import { clearPersistedSupabaseSession, supabase } from '../supabase/client';
import { getAccountIsolationE2EFixture } from './accountIsolationE2E';
import {
  authenticateWithProviderToken,
  requestEmailAccountCode,
  verifyEmailAccountCode,
  type PendingEmailAccountCode,
} from './accountUpgrade';
import { getAppleIdToken } from './apple';
import { getGoogleIdToken } from './google';
import { prepareLocalDataForSession } from './localAccountIsolation';
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

  useEffect(() => {
    let mounted = true;

    function holdSessionBoundaryWriteLock(): void {
      if (sessionBoundaryWriteLockHeldRef.current) return;
      beginPrivateKVAccountBoundary();
      beginEncryptedPhotoAccountBoundary();
      sessionBoundaryWriteLockHeldRef.current = true;
    }

    function releaseSessionBoundaryWriteLock(): void {
      if (!sessionBoundaryWriteLockHeldRef.current) return;
      endEncryptedPhotoAccountBoundary();
      endPrivateKVAccountBoundary();
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
      setSentryUser(null);
    }
    showSessionBoundaryRef.current = showSessionBoundary;

    function applySessionBoundary(
      nextSession: Session | null,
      initialRestore = false,
    ): Promise<void> {
      const targetUserId = nextSession?.user.id ?? null;
      if (explicitSignOutPendingRef.current && targetUserId) return Promise.resolve();
      pendingBoundarySessionRef.current = { session: nextSession };
      const existing = boundaryInFlightRef.current;
      if (existing?.targetUserId === targetUserId) return existing.promise;

      const previousTransition = existing?.promise;
      const seq = ++sessionChangeSeqRef.current;
      if (
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
      const seqBeforeRestore = sessionChangeSeqRef.current;
      showSessionBoundary(null);
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!mounted || seqBeforeRestore !== sessionChangeSeqRef.current) return;
        retrySessionRestoreRef.current = null;
        await applySessionBoundary(data.session, true);
      } catch (error: unknown) {
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
  }, [accountIsolationE2EFixture]);

  // Start/stop token auto-refresh with app foreground/background (docs/01 §5).
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const handle = (state: AppStateStatus) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    handle(AppState.currentState);
    const subscription = AppState.addEventListener('change', handle);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const userId = session?.user.id ?? null;
    setSentryUser(userId);
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
        if (data.session) return;
        // BLOCKED: B-TURNSTILE. CaptchaToken expected here once Turnstile is wired.
        const { error: signInError } = await supabase.auth.signInAnonymously(
          captchaToken ? { options: { captchaToken } } : undefined,
        );
        if (signInError) throw signInError;
      },
      async signInWithApple() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const result = await getAppleIdToken();
        if (!result) return false;
        await authenticateWithProviderToken(supabase.auth, {
          provider: 'apple',
          token: result.idToken,
        });
        pendingEmailCodeRef.current = null;
        return true;
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const result = await getGoogleIdToken();
        if (!result) return false;
        await authenticateWithProviderToken(supabase.auth, {
          provider: 'google',
          token: result.idToken,
        });
        pendingEmailCodeRef.current = null;
        return true;
      },
      async sendEmailOtp(email: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        // OTP code (not magic link) for mobile reliability (docs/01 §1).
        pendingEmailCodeRef.current = null;
        const request = await requestEmailAccountCode(supabase.auth, email);
        if (request.kind === 'anonymous_upgrade_complete') return 'complete';
        pendingEmailCodeRef.current = request;
        return 'code_sent';
      },
      async verifyEmailOtp(email: string, token: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const pending = pendingEmailCodeRef.current;
        if (!pending) throw new Error('Request a new email code before verifying.');
        await verifyEmailAccountCode(supabase.auth, pending, email, token);
        pendingEmailCodeRef.current = null;
      },
      async signOut() {
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
