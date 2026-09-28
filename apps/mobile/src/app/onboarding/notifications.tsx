import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, ProgressBar, Screen, Text } from '@/components/ui';
import { SOFT_ASK } from '@/features/notifications/copy';
import {
  acceptRoutineReminderSoftAsk,
  declineRoutineReminderSoftAsk,
  PROPOSED_ROUTINE_REMINDER_TIMES,
} from '@/features/notifications/onboarding';
import { colors } from '@/theme/tokens';

function CheckRow({ label }: { label: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2">
      <View
        className="mt-0.5 h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.sageTint }}
      >
        <Text style={{ color: colors.sageDeep, fontSize: 11, lineHeight: 13 }}>✓</Text>
      </View>
      <Text variant="bodySm" className="flex-1" style={{ color: colors.inkSoft }}>
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
      // Unsupported local notification/storage environments must not trap onboarding.
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
      <View className="pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            SETUP
          </Text>
          <Text variant="label" tone="muted">
            4 OF 5
          </Text>
        </View>
        <ProgressBar total={5} current={4} />
      </View>

      <View className="flex-1 justify-center py-5">
        <View
          className="mb-6 h-14 w-14 items-center justify-center rounded-[19px]"
          style={{ backgroundColor: colors.clayTint }}
        >
          <View className="h-4 w-4 rounded-full" style={{ backgroundColor: colors.clay }} />
        </View>
        <Text variant="title">{SOFT_ASK.title}</Text>
        <Text variant="body" tone="muted" className="mt-3">
          {SOFT_ASK.body}
        </Text>

        <Card className="mt-6 px-4 py-3">
          {SOFT_ASK.bullets.map((bullet, index) => (
            <View key={bullet}>
              {index > 0 ? <View className="h-px bg-hairline" /> : null}
              <CheckRow label={bullet} />
            </View>
          ))}
        </Card>
      </View>

      <View className="pb-4">
        <Button label={SOFT_ASK.yes} onPress={enable} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          className="mt-2 min-h-[48px] items-center justify-center py-3"
          disabled={busy}
          onPress={skip}
        >
          <Text variant="body" tone="muted" className="font-sans-semibold">
            {SOFT_ASK.no}
          </Text>
        </Pressable>
        <Text variant="bodySm" tone="muted" className="mt-1 text-center text-[11.5px]">
          You can change this anytime in You → Reminders.
        </Text>
      </View>
    </Screen>
  );
}
