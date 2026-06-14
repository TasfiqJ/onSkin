import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { rescheduleReminders, requestPermission } from '@/features/notifications/deliver';
import { SOFT_ASK } from '@/features/notifications/copy';
import { saveNotifPrefs } from '@/features/notifications/store';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// 08 · Notification soft-ask (docs/07 §3.2, design screen 01). A value-moment
// pre-permission explainer; only "Yes" fires the single OS prompt (55-70% vs
// 30-40% cold, docs/01 §8). On grant we enable the utility AM/PM reminders at the
// default times and schedule them locally; the user tunes times/quiet hours later.
function CheckRow({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: colors.sageTint }}>
        <Text style={{ color: colors.sage, fontSize: 11 }}>✓</Text>
      </View>
      <Text variant="bodySm" style={{ color: colors.inkSoft }}>
        {label}
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    track('notification_prompt_shown');
    const granted = await requestPermission();
    track(granted ? 'notification_prompt_granted' : 'notification_prompt_denied');
    if (granted) {
      const prefs = await saveNotifPrefs({ amEnabled: true, pmEnabled: true });
      await rescheduleReminders(prefs);
    }
    setBusy(false);
    router.push('/onboarding/account');
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <View className="mb-6 h-14 w-14 items-center justify-center rounded-[18px]" style={{ backgroundColor: colors.clayTint }}>
          <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: colors.clay }} />
        </View>
        <Text variant="title">{SOFT_ASK.title}</Text>
        <Text variant="body" tone="muted" className="mt-3" style={{ lineHeight: 24 }}>
          {SOFT_ASK.body}
        </Text>
        <View className="mt-6 gap-1">
          {SOFT_ASK.bullets.map((b) => (
            <CheckRow key={b} label={b} />
          ))}
        </View>
      </View>
      <View className="pb-4">
        <Button label={SOFT_ASK.yes} onPress={enable} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          className="mt-3 items-center py-3"
          onPress={() => router.push('/onboarding/account')}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            {SOFT_ASK.no}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
