import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text, ToggleSwitch } from '@/components/ui';
import { SETTINGS_COPY } from '@/features/notifications/copy';
import { useNotifPrefs, useUpdateNotifPrefs } from '@/features/notifications/useNotifications';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Notification settings hub (docs/07 §3.1, design screen 02). Three tiers, each
// independently toggleable; the non-utility "gentle nudges" are frequency-capped.
export function fmtTime(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  const ap = (h ?? 0) < 12 ? 'AM' : 'PM';
  const hr = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${hr}:${String(m ?? 0).padStart(2, '0')} ${ap}`;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="label"
      tone="muted"
      className="mb-2 ml-2 mt-4"
      style={{ fontSize: 10, letterSpacing: 1 }}
    >
      {children}
    </Text>
  );
}

function Row({
  title,
  subtitle,
  value,
  onChange,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <View
      className="min-h-[56px] flex-row items-center justify-between py-3.5"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgba(32,27,21,0.06)' }}
    >
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          className="min-h-[44px] flex-1 justify-center pr-3"
        >
          <Text variant="body" className="font-sans-semibold">
            {title}
          </Text>
          {subtitle ? <Text variant="bodySm" tone="muted">{`\n${subtitle}`}</Text> : null}
        </Pressable>
      ) : (
        <View className="min-h-[44px] flex-1 justify-center pr-3">
          <Text variant="body" className="font-sans-semibold">
            {title}
          </Text>
          {subtitle ? <Text variant="bodySm" tone="muted">{`\n${subtitle}`}</Text> : null}
        </View>
      )}
      <ToggleSwitch accessibilityLabel={title} value={value} onChange={onChange} />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { data: p } = useNotifPrefs();
  const update = useUpdateNotifPrefs();
  const set = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);
  if (!p) return null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        <View className="mb-1 flex-row items-center gap-3 pt-1">
          <RouteIconButton
            accessibilityLabel="Back"
            onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
          />
          <Text variant="title" style={{ fontSize: 28 }}>
            Notifications
          </Text>
        </View>

        <SectionLabel>UTILITY · YOUR ROUTINE</SectionLabel>
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <Row
            title="Morning routine"
            subtitle={fmtTime(p.amTime)}
            value={p.amEnabled}
            onChange={(v) => set({ amEnabled: v })}
            onPress={() => router.push('/settings/timing')}
          />
          <Row
            title="Evening · tonight’s step"
            subtitle={fmtTime(p.pmTime)}
            value={p.pmEnabled}
            onChange={(v) => set({ pmEnabled: v })}
            onPress={() => router.push('/settings/timing')}
            last
          />
        </View>

        <SectionLabel>GENTLE NUDGES · CAPPED</SectionLabel>
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <Row
            title="Streak &amp; adherence"
            value={p.streakNudges}
            onChange={(v) => set({ streakNudges: v })}
          />
          <Row
            title="Replenishment"
            value={p.replenishmentAlerts}
            onChange={(v) => set({ replenishmentAlerts: v })}
          />
          <Row
            title="Progress-photo nudge"
            value={p.captureReminders}
            onChange={(v) => set({ captureReminders: v })}
            last
          />
        </View>

        <SectionLabel>PROMOTIONAL</SectionLabel>
        <View className="rounded-[18px] bg-paper-raised px-[18px]">
          <Row
            title="Tips &amp; announcements"
            subtitle="off by default"
            value={p.promotionalOptIn}
            onChange={(v) => set({ promotionalOptIn: v })}
            last
          />
        </View>

        <Text variant="label" tone="muted" className="mt-6 text-center" style={{ fontSize: 10.5 }}>
          {SETTINGS_COPY.capNote}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
