import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { SOFT_ASK } from '@/features/notifications/copy';
import {
  acceptRoutineReminderSoftAsk,
  declineRoutineReminderSoftAsk,
} from '@/features/notifications/onboarding';
import { track } from '@/lib/analytics/track';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// 08 · Notification soft-ask (docs/07 §3.2, design screen 01). A value-moment
// pre-permission explainer; only "Yes" fires the single OS prompt (55-70% vs
// 30-40% cold, docs/01 §8). On grant we enable the utility AM/PM reminders at the
// default times and schedule them locally; the user tunes times/quiet hours later.
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
  const ownerScope = useOwnerQueryScope();
  const [busy, setBusy] = useState(false);
  const [failedChoice, setFailedChoice] = useState<'enable' | 'skip' | null>(null);

  async function finish(choice: 'enable' | 'skip', retry = false) {
    if (busy || !isOwnerQueryScopeCurrent(ownerScope)) return;
    setBusy(true);
    setFailedChoice(null);
    try {
      if (choice === 'enable') {
        if (!retry) track('notification_prompt_shown');
        const granted = await acceptRoutineReminderSoftAsk();
        if (granted) track('notification_prompt_granted');
        else track('notification_prompt_denied');
      } else {
        await declineRoutineReminderSoftAsk();
      }
    } catch {
      if (!isOwnerQueryScopeCurrent(ownerScope)) return;
      setBusy(false);
      setFailedChoice(choice);
      return;
    }
    if (!isOwnerQueryScopeCurrent(ownerScope)) return;
    setBusy(false);
    router.push('/onboarding/account');
  }

  function enable() {
    void finish('enable').catch(() => undefined);
  }

  function skip() {
    void finish('skip').catch(() => undefined);
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center py-6">
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
          {failedChoice ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="mb-4 rounded-[16px] p-4"
              style={{ backgroundColor: colors.clayTint }}
            >
              <Text variant="bodySm" className="font-sans-bold">
                Notification choice incomplete
              </Text>
              <Text variant="bodySm" tone="muted" className="mt-1" style={{ lineHeight: 19 }}>
                We couldn&apos;t safely save that choice on this device. You&apos;re still on this
                step, and nothing was silently skipped.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                className="mt-3 min-h-[56px] items-center justify-center rounded-pill px-4 py-3"
                disabled={busy}
                onPress={() => void finish(failedChoice, true).catch(() => undefined)}
                style={{ backgroundColor: colors.paperRaised, opacity: busy ? 0.68 : 1 }}
              >
                <Text variant="bodySm" className="font-sans-semibold">
                  {busy ? 'Trying again...' : 'Try again'}
                </Text>
              </Pressable>
            </View>
          ) : null}
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
      </ScrollView>
    </Screen>
  );
}
