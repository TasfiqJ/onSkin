import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { track, identify } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ACCOUNT_CONSENT } from '@/features/onboarding/consentCopy';
import { recordConsent } from '@/lib/consent/consent';
import { supabase } from '@/lib/supabase/client';

// 09 · Account creation at the value moment (docs/01 §1/§2). SIWA mandatory on iOS
// because Google is offered (Guideline 4.8). Email uses OTP codes (not magic
// links) for mobile reliability. Anonymous data carries over by user-id.
// BLOCKED: B-APPLE / B-GOOGLE / B-VERIFY-AUTH-LINKING.
export default function AccountScreen() {
  const { signInWithApple, signInWithGoogle, sendEmailOtp, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'menu' | 'code'>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    try {
      await recordConsent({
        type: 'account',
        granted: true,
        version: ACCOUNT_CONSENT.version,
        consentText: ACCOUNT_CONSENT.fullText,
      });
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) identify(data.user.id, { method: 'account_created' });
    } catch {
      // best-effort until backend configured
    }
    track('account_created');
    router.replace('/onboarding/paywall');
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="title">
          Save your plan,{' '}
          <Text variant="title" italic tone="clay">
            keep it private.
          </Text>
        </Text>
        <Text variant="body" tone="muted" className="mt-3">
          Create an account so your routine and progress are yours on any device. Your photos still
          stay on this phone.
        </Text>

        {stage === 'menu' ? (
          <View className="mt-8 gap-3">
            {Platform.OS === 'ios' ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={999}
                style={{ height: 56 }}
                onPress={() => run(async () => {
                  await signInWithApple();
                  await finish();
                })}
              />
            ) : null}
            <Button
              label="Continue with Google"
              variant="inverse"
              onPress={() => run(async () => {
                await signInWithGoogle();
                await finish();
              })}
              disabled={busy}
            />
            <View className="mt-2">
              <Text variant="label" tone="muted" className="mb-2">
                OR WITH EMAIL
              </Text>
              <TextInput
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
                onPress={() => run(async () => {
                  await sendEmailOtp(email);
                  setStage('code');
                })}
              />
            </View>
          </View>
        ) : (
          <View className="mt-8 gap-3">
            <Text variant="body" tone="muted">
              Enter the 6-digit code we sent to {email}.
            </Text>
            <TextInput
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
              onPress={() => run(async () => {
                await verifyEmailOtp(email, code);
                await finish();
              })}
            />
            <Pressable accessibilityRole="button" className="items-center py-2" onPress={() => setStage('menu')}>
              <Text variant="body" tone="muted">
                Use a different method
              </Text>
            </Pressable>
          </View>
        )}

        {error ? (
          <Text variant="bodySm" tone="clay" className="mt-4">
            {error}
          </Text>
        ) : null}
      </View>

      <View className="pb-4">
        <Pressable
          accessibilityRole="button"
          className="items-center py-3"
          onPress={() => router.replace('/onboarding/paywall')}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            Not now
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
