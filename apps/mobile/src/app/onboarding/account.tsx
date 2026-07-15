import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useIsFocused } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { recordAccountConsent } from '@/features/onboarding/accountConsent';
import { ACCOUNT_CONSENT } from '@/features/onboarding/consentCopy';
import { canPublishAccountRouteRequest } from '@/features/onboarding/accountRouteLifecycle';
import { track, identify } from '@/lib/analytics/track';
import { ProviderAuthSessionChangedError } from '@/lib/auth/accountUpgrade';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getAccountUpgradeE2EFixture } from '@/lib/auth/accountUpgradeE2E';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import {
  ProviderSignInInFlightError,
  ProviderSignInRequestSupersededError,
} from '@/lib/auth/providerSignIn';
import { isSupabaseConfigured } from '@/lib/env';
import { AUTH_UNAVAILABLE_MESSAGE, authUserMessage } from '@/lib/errors/userFacing';
import { isOwnerQueryScopeCurrent, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

// 09 · Account creation at the value moment (docs/01 §1/§2). SIWA mandatory on iOS
// because Google is offered (Guideline 4.8). Email uses OTP codes (not magic
// links) for mobile reliability. Anonymous upgrades must preserve the current
// user id; real-provider device proof remains BLOCKED: B-APPLE / B-GOOGLE.
export default function AccountScreen() {
  const { fontScale = 1, height, width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const { signInWithApple, signInWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const mountedRef = useRef(true);
  const focusedRef = useRef(isFocused);
  const requestSeqRef = useRef(0);
  const requestInFlightRef = useRef<number | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'menu' | 'code'>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountUpgradeE2EFixture = getAccountUpgradeE2EFixture();
  const authAvailable = isSupabaseConfigured || accountUpgradeE2EFixture !== null;
  const supportFloorTextPressurePhone =
    width <= 390 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPhone = height < 640 || supportFloorTextPressurePhone;

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    focusedRef.current = isFocused;
    let active = true;
    if (isFocused && requestInFlightRef.current === null) {
      void Promise.resolve().then(() => {
        if (!active || !mountedRef.current || !focusedRef.current) return;
        setBusy(false);
      });
    }
    return () => {
      active = false;
      focusedRef.current = false;
      requestSeqRef.current += 1;
    };
  }, [isFocused]);

  async function finish(isCurrent: () => boolean) {
    if (!isOwnerQueryScopeCurrent(ownerScope)) return;
    if (!isCurrent()) return;
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      if (!isCurrent()) return;
      if (!accountUpgradeE2EFixture) {
        try {
          await recordAccountConsent();
          lease.assertCurrent();
          if (!isCurrent()) return;
        } catch {
          lease.assertCurrent();
          if (!isCurrent()) return;
          setError(ACCOUNT_CONSENT.saveFailedBody);
          return;
        }

        const owner = await captureAuthenticatedAccountOwner(lease);
        if (!isCurrent()) return;
        if (owner) {
          await identify(lease, owner.userId, { method: 'account_created' });
          if (!isCurrent()) return;
        }
      }

      lease.assertCurrent();
      if (!isCurrent()) return;
      track('account_created');
      lease.assertCurrent();
      if (!isCurrent()) return;
      router.replace('/onboarding/paywall');
    });
  }

  function run(fn: (isCurrent: () => boolean) => Promise<void>): void {
    if (requestInFlightRef.current !== null) return;
    if (!authAvailable) {
      setError(AUTH_UNAVAILABLE_MESSAGE);
      return;
    }

    const requestId = ++requestSeqRef.current;
    requestInFlightRef.current = requestId;
    const isCurrent = () =>
      canPublishAccountRouteRequest({
        currentRequestId: requestInFlightRef.current,
        focused: focusedRef.current,
        mounted: mountedRef.current,
        ownerCurrent: isOwnerQueryScopeCurrent(ownerScope),
        requestId,
        requestSequence: requestSeqRef.current,
      });

    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await fn(isCurrent);
      } catch (e) {
        if (
          e instanceof ProviderSignInInFlightError ||
          e instanceof ProviderSignInRequestSupersededError ||
          e instanceof ProviderAuthSessionChangedError ||
          !isCurrent()
        ) {
          return;
        }
        setError(authUserMessage(e));
      } finally {
        if (requestInFlightRef.current === requestId) requestInFlightRef.current = null;
        if (mountedRef.current && focusedRef.current && isOwnerQueryScopeCurrent(ownerScope)) {
          setBusy(false);
        }
      }
    })();
  }

  return (
    <Screen>
      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: compactPhone ? 'flex-start' : 'center',
            paddingBottom: compactPhone ? 24 : 32,
            paddingTop: compactPhone ? 8 : 0,
          }}
        >
          <Text variant="title">
            Protect your plan,{' '}
            <Text variant="title" italic tone="clay">
              keep it private.
            </Text>
          </Text>
          <Text variant="body" tone="muted" className="mt-3">
            Create an account for sign-in, subscription, and privacy controls. Routine checks stay
            local-first on this device for this beta, and photos still stay on this device.
          </Text>
          {!authAvailable ? (
            <Text variant="bodySm" tone="clay" className="mt-4">
              {AUTH_UNAVAILABLE_MESSAGE}
            </Text>
          ) : null}

          {authAvailable ? (
            stage === 'menu' ? (
              <View className="mt-8 gap-3">
                {Platform.OS === 'ios' ? (
                  <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.5 : 1 }}>
                    <AppleAuthentication.AppleAuthenticationButton
                      accessibilityState={{ disabled: busy }}
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={999}
                      style={{ height: 56 }}
                      onPress={() => {
                        if (busy || requestInFlightRef.current !== null) return;
                        run(async (isCurrent) => {
                          if (accountUpgradeE2EFixture || (await signInWithApple())) {
                            if (isCurrent()) await finish(isCurrent);
                          }
                        });
                      }}
                    />
                  </View>
                ) : null}
                <Button
                  label="Continue with Google"
                  variant="inverse"
                  onPress={() => {
                    if (busy || requestInFlightRef.current !== null) return;
                    run(async (isCurrent) => {
                      if (accountUpgradeE2EFixture || (await signInWithGoogle())) {
                        if (isCurrent()) await finish(isCurrent);
                      }
                    });
                  }}
                  disabled={busy}
                />
                <View className="mt-2">
                  <Text variant="label" tone="muted" className="mb-2">
                    OR WITH EMAIL
                  </Text>
                  <TextInput
                    accessibilityLabel="Email address"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    inputMode="email"
                    editable={!busy}
                    className="rounded-card border border-hairline bg-paper-raised px-4 py-4 font-sans text-base text-ink"
                  />
                  <Button
                    className="mt-3"
                    label="Email me a code"
                    disabled={busy || !email.includes('@')}
                    onPress={() =>
                      run(async (isCurrent) => {
                        if (!accountUpgradeE2EFixture) {
                          const result = await sendEmailOtp(email);
                          if (!isCurrent()) return;
                          if (result === 'complete') {
                            await finish(isCurrent);
                            return;
                          }
                        }
                        if (isCurrent()) setStage('code');
                      })
                    }
                  />
                </View>
              </View>
            ) : (
              <View className="mt-8 gap-3">
                <Text variant="body" tone="muted">
                  Enter the 6-digit code we sent to {email}.
                </Text>
                <TextInput
                  accessibilityLabel="Verification code"
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  editable={!busy}
                  className="rounded-card border border-hairline bg-paper-raised px-4 py-4 text-center font-mono text-2xl tracking-[8px] text-ink"
                />
                <Button
                  label="Verify"
                  disabled={busy || code.length !== 6}
                  onPress={() =>
                    run(async (isCurrent) => {
                      if (
                        accountUpgradeE2EFixture &&
                        code.trim() !== accountUpgradeE2EFixture.emailCode
                      ) {
                        throw new Error('OTP code is invalid.');
                      }
                      if (!accountUpgradeE2EFixture) await verifyEmailOtp(email, code);
                      if (isCurrent()) await finish(isCurrent);
                    })
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  className="min-h-[48px] items-center justify-center py-2"
                  disabled={busy}
                  onPress={() => {
                    if (!busy && requestInFlightRef.current === null) setStage('menu');
                  }}
                  style={{ opacity: busy ? 0.5 : 1 }}
                >
                  <Text variant="body" tone="muted">
                    Use a different method
                  </Text>
                </Pressable>
              </View>
            )
          ) : null}

          {error ? (
            <Text variant="bodySm" tone="clay" className="mt-4">
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </View>

      <View className="bg-paper pb-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          className="min-h-[48px] items-center justify-center py-2"
          disabled={busy}
          onPress={() => {
            if (!busy && requestInFlightRef.current === null) {
              router.replace('/onboarding/paywall');
            }
          }}
          style={{ opacity: busy ? 0.5 : 1 }}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            Not now
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
