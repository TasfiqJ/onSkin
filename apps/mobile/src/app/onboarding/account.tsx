import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { track, identify } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getAccountUpgradeE2EFixture } from '@/lib/auth/accountUpgradeE2E';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
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
  const { signInWithApple, signInWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();
  const ownerScope = useOwnerQueryScope();
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

  async function finish() {
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      if (!accountUpgradeE2EFixture) {
        try {
          await recordAccountConsent();
          lease.assertCurrent();
        } catch {
          lease.assertCurrent();
          setError(ACCOUNT_CONSENT.saveFailedBody);
          return;
        }

        const owner = await captureAuthenticatedAccountOwner(lease);
        if (owner) await identify(lease, owner.userId, { method: 'account_created' });
      }

      lease.assertCurrent();
      track('account_created');
      lease.assertCurrent();
      router.replace('/onboarding/paywall');
    });
  }

  async function run(fn: () => Promise<void>) {
    if (!authAvailable) {
      setError(AUTH_UNAVAILABLE_MESSAGE);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      setError(authUserMessage(e));
    } finally {
      if (isOwnerQueryScopeCurrent(ownerScope)) setBusy(false);
    }
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
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={999}
                    style={{ height: 56 }}
                    onPress={() =>
                      run(async () => {
                        if (accountUpgradeE2EFixture || (await signInWithApple())) await finish();
                      })
                    }
                  />
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
                    onPress={() =>
                      run(async () => {
                        if (!accountUpgradeE2EFixture) {
                          const result = await sendEmailOtp(email);
                          if (result === 'complete') {
                            await finish();
                            return;
                          }
                        }
                        setStage('code');
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
                  className="rounded-card border border-hairline bg-paper-raised px-4 py-4 text-center font-mono text-2xl tracking-[8px] text-ink"
                />
                <Button
                  label="Verify"
                  disabled={busy || code.length !== 6}
                  onPress={() =>
                    run(async () => {
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
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[48px] items-center justify-center py-2"
                  onPress={() => setStage('menu')}
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
          onPress={() => router.replace('/onboarding/paywall')}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            Not now
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
