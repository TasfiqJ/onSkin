import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getAccountUpgradeE2EFixture } from '@/lib/auth/accountUpgradeE2E';
import {
  getEmailCodeChallengeState,
  startEmailCodeChallenge,
  type EmailCodeChallenge,
} from '@/lib/auth/emailCodeRecovery';
import { isAppleAuthAvailable } from '@/lib/auth/apple';
import { isSupabaseConfigured } from '@/lib/env';
import { AUTH_UNAVAILABLE_MESSAGE, authUserMessage } from '@/lib/errors/userFacing';

// 09 · Account creation at the value moment (docs/01 §1/§2). SIWA mandatory on iOS
// because Google is offered (Guideline 4.8). Email uses OTP codes (not magic
// links) for mobile reliability. Anonymous upgrades must preserve the current
// user id; real-provider device proof remains BLOCKED: B-APPLE / B-GOOGLE.
export default function AccountScreen() {
  const { fontScale = 1, height, width } = useWindowDimensions();
  const { signInWithApple, signInWithGoogle, sendEmailOtp, resendEmailOtp, verifyEmailOtp } =
    useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'menu' | 'code'>('menu');
  const [challenge, setChallenge] = useState<EmailCodeChallenge | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const operationPendingRef = useRef(false);
  const accountUpgradeE2EFixture = getAccountUpgradeE2EFixture();
  const authAvailable = isSupabaseConfigured || accountUpgradeE2EFixture !== null;
  const supportFloorTextPressurePhone =
    width <= 390 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPhone = height < 640 || supportFloorTextPressurePhone;
  const codeState = challenge ? getEmailCodeChallengeState(challenge, nowMs) : null;

  useEffect(() => {
    if (stage !== 'code') return;
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !authAvailable) return;
    let active = true;
    void isAppleAuthAvailable()
      .then((available) => {
        if (active) setAppleAuthAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAuthAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [authAvailable]);

  async function finish() {
    if (!accountUpgradeE2EFixture) {
      try {
        await recordAccountConsent();
      } catch {
        setError(ACCOUNT_CONSENT.saveFailedBody);
        return;
      }
    }
    track('account_created');
    router.replace('/onboarding/paywall');
  }

  async function run(fn: () => Promise<void>) {
    // State updates are not synchronous. This ref is the admission gate that
    // prevents two native provider sheets or OTP requests from a rapid tap.
    if (operationPendingRef.current) return;
    if (!authAvailable) {
      setError(AUTH_UNAVAILABLE_MESSAGE);
      return;
    }

    operationPendingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authUserMessage(e));
    } finally {
      operationPendingRef.current = false;
      setBusy(false);
    }
  }

  async function requestCode(resend = false) {
    const normalizedEmail = email.trim();
    if (resend) {
      if (!challenge || getEmailCodeChallengeState(challenge, Date.now()).resendSeconds > 0) return;
      if (!accountUpgradeE2EFixture) await resendEmailOtp();
    } else if (!accountUpgradeE2EFixture) {
      const result = await sendEmailOtp(normalizedEmail);
      if (result === 'complete') {
        await finish();
        return;
      }
    }
    const sentAtMs = Date.now();
    setEmail(normalizedEmail);
    setCode('');
    setChallenge(startEmailCodeChallenge(sentAtMs));
    setNowMs(sentAtMs);
    setStage('code');
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
                {Platform.OS === 'ios' && appleAuthAvailable ? (
                  <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.55 : 1 }}>
                    <AppleAuthentication.AppleAuthenticationButton
                      accessibilityState={{ disabled: busy }}
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={999}
                      style={{ height: 56 }}
                      onPress={() =>
                        void run(async () => {
                          if (accountUpgradeE2EFixture || (await signInWithApple())) await finish();
                        })
                      }
                    />
                  </View>
                ) : null}
                <Button
                  label="Continue with Google"
                  variant="inverse"
                  onPress={() =>
                    run(async () => {
                      if (accountUpgradeE2EFixture || (await signInWithGoogle())) await finish();
                    })
                  }
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
                    className="rounded-card border border-hairline bg-paper-raised px-4 py-4 font-sans text-base text-ink"
                  />
                  <Button
                    className="mt-3"
                    label="Email me a code"
                    disabled={busy || !email.includes('@')}
                    onPress={() => run(() => requestCode())}
                  />
                </View>
              </View>
            ) : (
              <View className="mt-8 gap-3">
                <Text variant="body" tone="muted">
                  Enter the 6-digit code we sent to {email}.
                </Text>
                {codeState?.expired ? (
                  <Text variant="bodySm" tone="clay">
                    This code may have expired. Request a new one to continue.
                  </Text>
                ) : null}
                <TextInput
                  accessibilityLabel="Verification code"
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/gu, '').slice(0, 6))}
                  placeholder="123456"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  className="rounded-card border border-hairline bg-paper-raised px-4 py-4 text-center font-mono text-2xl tracking-[8px] text-ink"
                />
                <Button
                  label="Verify"
                  disabled={busy || codeState?.expired !== false || !/^\d{6}$/u.test(code)}
                  onPress={() =>
                    run(async () => {
                      if (!challenge || getEmailCodeChallengeState(challenge, Date.now()).expired) {
                        throw new Error('Request a new email code before verifying.');
                      }
                      if (
                        accountUpgradeE2EFixture &&
                        code.trim() !== accountUpgradeE2EFixture.emailCode
                      ) {
                        throw new Error('OTP code is invalid.');
                      }
                      if (!accountUpgradeE2EFixture) await verifyEmailOtp(email, code);
                      await finish();
                    })
                  }
                />
                <Button
                  label={
                    codeState && codeState.resendSeconds > 0
                      ? `Resend code in ${codeState.resendSeconds}s`
                      : 'Resend code'
                  }
                  variant="ghost"
                  className="min-h-[48px] py-2"
                  disabled={busy || !challenge || (codeState?.resendSeconds ?? 0) > 0}
                  onPress={() => run(() => requestCode(true))}
                />
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[48px] items-center justify-center py-2"
                  disabled={busy}
                  onPress={() => {
                    if (operationPendingRef.current) return;
                    setChallenge(null);
                    setCode('');
                    setStage('menu');
                  }}
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
          className="min-h-[48px] items-center justify-center py-2"
          disabled={busy}
          onPress={() => {
            if (operationPendingRef.current) return;
            router.replace('/onboarding/paywall');
          }}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            Not now
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
