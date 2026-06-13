import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { colors } from '@/theme/tokens';

// Graceful downgrade after a PAID expiry (design 08, docs/08 §6) — never a
// data-deleting hard lock; data preserved, Pro re-offered calmly.
export default function DowngradeScreen() {
  const { startTrial } = useEntitlementActions();
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1">
        <View className="mt-2 flex-row items-center gap-2 self-start rounded-pill px-4 py-2" style={{ backgroundColor: colors.greige }}>
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.muted }} />
          <Text variant="label" className="font-sans-bold" tone="muted" style={{ fontSize: 12.5 }}>
            {PAYWALL_COPY.downgrade.pill}
          </Text>
        </View>
        <Text variant="title" className="mt-5" style={{ fontSize: 33, lineHeight: 37 }}>
          {PAYWALL_COPY.downgrade.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-2.5" style={{ lineHeight: 24 }}>
          {PAYWALL_COPY.downgrade.body}
        </Text>
        <View className="mt-5 rounded-card bg-paper-raised px-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          {PAYWALL_COPY.downgrade.kept.map((k, i) => (
            <View
              key={k}
              className="flex-row items-center gap-3 py-3"
              style={i < PAYWALL_COPY.downgrade.kept.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.hairline } : undefined}>
              <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: colors.sageTint }}>
                <Text style={{ color: colors.sage, fontSize: 11 }}>✓</Text>
              </View>
              <Text variant="body" style={{ color: colors.inkSoft }}>
                {k}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodySm" tone="muted" className="mt-4" style={{ lineHeight: 19 }}>
          {PAYWALL_COPY.downgrade.floorNote}
        </Text>
      </View>
      <View className="gap-3 pb-2">
        <Pressable
          accessibilityRole="button"
          onPress={() => startTrial.mutate(undefined, { onSettled: () => router.replace('/paywall/success') })}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: colors.clay }}>
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
            {PAYWALL_COPY.downgrade.renewCta}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/today')} className="h-[42px] items-center justify-center">
          <Text className="font-sans-semibold" tone="muted" variant="body">
            {PAYWALL_COPY.downgrade.declineCta}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
