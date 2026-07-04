import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { saveVerifiedEntitlement } from '@/features/subscription/store';
import {
  configureRevenueCat,
  customerInfoToStoredEntitlement,
  getCustomerInfo,
  subscribeToCustomerInfoUpdates,
} from '@/lib/iap/revenuecat';
import { setSentryUser } from '@/lib/observability/sentry';

import { supabase } from '../supabase/client';
import { getAppleIdToken } from './apple';
import { getGoogleIdToken } from './google';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  initializing: boolean;
  /** Guest-first entry: create an anonymous session if none exists (docs/01 §1). */
  ensureAnonymousSession: (captchaToken?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Start/stop token auto-refresh with app foreground/background (docs/01 §5).
  useEffect(() => {
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
      if (__DEV__) console.warn('[revenuecat] configuration failed', error);
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
        const result = await getAppleIdToken();
        if (!result) return;
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: result.idToken });
        if (error) throw error;
      },
      async signInWithGoogle() {
        const result = await getGoogleIdToken();
        if (!result) return;
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken });
        if (error) throw error;
      },
      async sendEmailOtp(email: string) {
        // OTP code (not magic link) for mobile reliability (docs/01 §1).
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (error) throw error;
      },
      async verifyEmailOtp(email: string, token: string) {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        if (error) throw error;
      },
      async signOut() {
        await supabase.auth.signOut();
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
