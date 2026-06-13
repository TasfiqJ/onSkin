import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { WINBACK } from '@/features/subscription/plans';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// Honest win-back (design 09, docs/08 §6) — value restated, a respectful 30%-off
// offer, an easy "no". Sparse, ARL-clean, never pressuring. Dark surface.
const BG = '#1B1813';

export default function WinbackScreen() {
  const insets = useSafeAreaInsets();
  const { winback } = useEntitlementActions();

  useEffect(() => {
    track('winback_shown');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16, paddingHorizontal: 30 }}>
      <View className="flex-1 justify-center">
        <Text variant="label" style={{ color: 'rgba(244,239,231,0.5)', letterSpacing: 2 }}>
          {PAYWALL_COPY.winback.eyebrow.toUpperCase()}
        </Text>
        <Text variant="display" className="mt-3.5" style={{ color: colors.cream, fontSize: 40, lineHeight: 43 }}>
          {PAYWALL_COPY.winback.title}
        </Text>
        <Text variant="body" className="mt-4" style={{ color: 'rgba(244,239,231,0.7)', lineHeight: 25 }}>
          {PAYWALL_COPY.winback.body}
        </Text>
        <View className="mt-6 rounded-card p-5" style={{ backgroundColor: colors.nightSurface }}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                {PAYWALL_COPY.winback.offerLabel}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-2">
                <Text variant="title" style={{ color: colors.cream, fontSize: 28 }}>
                  {WINBACK.priceLabel}
                </Text>
                <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.45)', textDecorationLine: 'line-through' }}>
                  {WINBACK.originalLabel}
                </Text>
                <Text variant="bodySm" style={{ color: colors.clayBright }}>
                  / first year
                </Text>
              </View>
            </View>
            <View className="rounded-pill px-3 py-1.5" style={{ backgroundColor: 'rgba(217,161,131,0.2)' }}>
              <Text variant="label" className="font-sans-bold" style={{ color: colors.clayBright, fontSize: 11 }}>
                {WINBACK.percentOff}% off
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View className="gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => winback.mutate(undefined, { onSettled: () => router.replace('/paywall/success') })}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: colors.cream }}>
          <Text className="font-sans-semibold" style={{ color: colors.ink, fontSize: 16 }}>
            {PAYWALL_COPY.winback.cta}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="h-[40px] items-center justify-center">
          <Text className="font-sans-semibold" style={{ color: 'rgba(244,239,231,0.5)', fontSize: 15 }}>
            {PAYWALL_COPY.winback.declineCta}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
