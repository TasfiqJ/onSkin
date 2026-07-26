import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { SOFT_ASK } from '@/features/notifications/copy';
import {
  acceptRoutineReminderSoftAsk,
  declineRoutineReminderSoftAsk,
  PROPOSED_ROUTINE_REMINDER_TIMES,
} from '@/features/notifications/onboarding';
import { colors } from '@/theme/tokens';

// 08 · Notification soft-ask (docs/07 §3.2, design screen 01). A value-moment
// pre-permission explainer. It displays the exact proposed AM/PM times before
// asking the OS and activates only those two purposes after deliverable
// authorization. We deliberately do not claim the system sheet was shown.
function CheckRow({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View
        className="h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.sageTint }}
      >
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

  async function finish(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch {
      /* Unsupported local notification/storage environments should not trap onboarding. */
    } finally {
      setBusy(false);
      router.push('/onboarding/account');
    }
  }

  function enable() {
    void finish(async () => {
      await acceptRoutineReminderSoftAsk(PROPOSED_ROUTINE_REMINDER_TIMES);
    });
  }

  function skip() {
    void finish(declineRoutineReminderSoftAsk);
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <View
          className="mb-6 h-14 w-14 items-center justify-center rounded-[18px]"
          style={{ backgroundColor: colors.clayTint }}
        >
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
          accessibilityState={{ disabled: busy }}
          className="mt-3 items-center py-3"
          disabled={busy}
          onPress={skip}
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            {SOFT_ASK.no}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
