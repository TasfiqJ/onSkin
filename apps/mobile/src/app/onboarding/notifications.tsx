import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { supabase } from '@/lib/supabase/client';

// 08 · Notification pre-permission priming (docs/01 §2/§8): a soft in-app explainer
// before the OS prompt, fired at the value moment (not at launch) to lift opt-in.
export default function NotificationsScreen() {
  const [busy, setBusy] = useState(false);

  async function persistDefaults(granted: boolean) {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      await supabase.from('notification_preferences').upsert({
        user_id: userId,
        streak_nudges: granted,
        replenishment_alerts: granted,
      });
    } catch {
      // Non-fatal until backend configured (B-SUPABASE).
    }
  }

  async function enable() {
    setBusy(true);
    track('notification_prompt_shown');
    let granted = false;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      granted = status === 'granted';
    } catch {
      // ignore — emulator/unsupported
    }
    track(granted ? 'notification_prompt_granted' : 'notification_prompt_denied');
    await persistDefaults(granted);
    setBusy(false);
    router.push('/onboarding/account');
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="title">
          Gentle nudges,{' '}
          <Text variant="title" italic tone="clay">
            never noise.
          </Text>
        </Text>
        <Text variant="body" tone="muted" className="mt-3">
          A quiet reminder for your AM and PM steps, and a heads-up before a product runs out. You
          choose the times — change or turn them off anytime.
        </Text>
        <Card className="mt-7">
          <Text variant="bodySm" tone="muted">
            Reminders are scheduled on your device. We don&apos;t need your location and never use it
            for targeting.
          </Text>
        </Card>
      </View>
      <View className="pb-4">
        <Button label="Turn on reminders" onPress={enable} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          className="mt-3 items-center py-3"
          onPress={() => router.push('/onboarding/account')}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            Not now
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
