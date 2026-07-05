import type { Session, User } from '@supabase/supabase-js';
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

import { clearLocalPrivateData } from '@/features/settings/localPrivateData';
import { saveVerifiedEntitlement } from '@/features/subscription/store';
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

import { supabase } from '../supabase/client';
import { getAppleIdToken } from './apple';
import { getGoogleIdToken } from './google';
import { shouldClearLocalPrivateDataForSessionChange } from './sessionBoundary';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  initializing: boolean;
  /** Guest-first entry: create an anonymous session if none exists (docs/01 §1). */
  ensureAnonymousSession: (captchaToken?: string) => Promise<void>;
  signInWithApple: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(isSupabaseConfigured);
  const activeUserIdRef = useRef<string | null>(null);
  const sessionChangeSeqRef = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      activeUserIdRef.current = null;
      return;
    }

    let mounted = true;

    async function applySessionBoundary(
      nextSession: Session | null,
      initialRestore = false,
    ): Promise<void> {
      const seq = ++sessionChangeSeqRef.current;
      const previousUserId = activeUserIdRef.current;
      const nextUserId = nextSession?.user.id ?? null;
      const mustClear =
        !initialRestore && shouldClearLocalPrivateDataForSessionChange(previousUserId, nextUserId);

      if (mustClear) setInitializing(true);
      try {
        if (mustClear) await clearLocalPrivateData();
      } catch (error: unknown) {
        devWarn('[auth] local private data clear failed during session transition', error);
        activeUserIdRef.current = null;
        await supabase.auth.signOut().catch(() => {});
        nextSession = null;
      }

      if (!mounted || seq !== sessionChangeSeqRef.current) return;
      activeUserIdRef.current = nextSession?.user.id ?? null;
      setSession(nextSession);
      setInitializing(false);
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        void applySessionBoundary(data.session, true);
      })
      .catch((error: unknown) => {
        devWarn('[auth] initial session restore failed', error);
        if (!mounted) return;
        activeUserIdRef.current = null;
        setSession(null);
        setInitializing(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySessionBoundary(nextSession);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
    if (!userId) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      await configureRevenueCat(userId);
      const current = await getCustomerInfo();
      const entitlement = current ? customerInfoToStoredEntitlement(current) : null;
      if (entitlement) await saveVerifiedEntitlement(entitlement);

      cleanup = await subscribeToCustomerInfoUpdates((customerInfo) => {
        const next = customerInfoToStoredEntitlement(customerInfo);
        if (next) void saveVerifiedEntitlement(next);
      });
      if (cancelled && cleanup) cleanup();
    })().catch((error: unknown) => {
      devWarn('[revenuecat] configuration failed', error);
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    return {
      session,
      user,
      isAnonymous: user?.is_anonymous ?? false,
      initializing,
      async ensureAnonymousSession(captchaToken?: string) {
        if (!isSupabaseConfigured) return;

        const { data } = await supabase.auth.getSession();
        if (data.session) return;
        // BLOCKED: B-TURNSTILE. CaptchaToken expected here once Turnstile is wired.
        const { error } = await supabase.auth.signInAnonymously(
          captchaToken ? { options: { captchaToken } } : undefined,
        );
        if (error) throw error;
      },
      // NOTE: anon -> social linking in RN is fragile (docs/01 §1). signInWithIdToken
      // while anonymous may create a NEW user unless the anon user's email matches
      // the provider's (automatic email-based linking). Verify on a real device with
      // real provider accounts. BLOCKED: B-VERIFY-AUTH-LINKING.
      async signInWithApple() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const result = await getAppleIdToken();
        if (!result) return false;
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.idToken,
        });
        if (error) throw error;
        return true;
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const result = await getGoogleIdToken();
        if (!result) return false;
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });
        if (error) throw error;
        return true;
      },
      async sendEmailOtp(email: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        // OTP code (not magic link) for mobile reliability (docs/01 §1).
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      },
      async verifyEmailOtp(email: string, token: string) {
        if (!isSupabaseConfigured) throw new Error(AUTH_UNAVAILABLE_MESSAGE);

        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
      },
      async signOut() {
        try {
          if (isSupabaseConfigured) await supabase.auth.signOut();
        } finally {
          await clearLocalPrivateData();
        }
      },
    };
  }, [session, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
