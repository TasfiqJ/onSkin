import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';

// 01 · Welcome — the anonymous session starts silently here (docs/01 §1/§2).
export default function WelcomeScreen() {
  const { ensureAnonymousSession } = useAuth();
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    track('onboarding_started');
    try {
      // Silent guest session. BLOCKED: B-SUPABASE/B-TURNSTILE — non-fatal so the
      // flow is navigable before the backend is configured.
      await ensureAnonymousSession();
    } catch {
      // Continue regardless; data persistence is best-effort until configured.
    }
    setBusy(false);
    router.push('/onboarding/goals');
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="display">
          Healthier skin in eight weeks, built around{' '}
          <Text variant="display" italic tone="clay">
            your
          </Text>{' '}
          skin.
        </Text>
        <Text variant="body" tone="muted" className="mt-4">
          A routine that fits what&apos;s already on your shelf — and photos that never leave your
          phone.
        </Text>
      </View>
      <View className="pb-4">
        <Button label="Begin" onPress={begin} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          className="mt-3 items-center py-3"
          onPress={() => router.push('/onboarding/account')}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            I already have an account
          </Text>
        </Pressable>
        <Text variant="label" tone="clay" className="mt-2 text-center">
          No ads · no data sales · photos stay on device
        </Text>
      </View>
    </Screen>
  );
}
