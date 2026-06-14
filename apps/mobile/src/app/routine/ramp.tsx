import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

// 03 · Retinoid ramp. Offer-only step-up (design screen 03, docs/03 §4). The app
// only ever OFFERS a step-up (never auto-escalates) and de-escalates on reported
// irritation. The chart shows nights/week toward a target of 3.
const BARS = [
  { label: 'wk1', height: 46, color: '#E3D8C9', striped: false, accent: false },
  { label: 'wk2', height: 46, color: '#E3D8C9', striped: false, accent: false },
  { label: 'wk3', height: 46, color: colors.clayBright, striped: false, accent: false },
  { label: 'now', height: 72, color: colors.clay, striped: false, accent: true },
  { label: 'next?', height: 72, color: 'transparent', striped: true, accent: false },
];

export default function RampScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 pt-4">
        <Text variant="label" tone="clay" className="font-mono">
          RETINOID · RAMP-UP
        </Text>
        <Text variant="title" className="mt-2 text-[32px]">
          Low and slow, on your terms.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5 text-[14px]">
          Consistency matters more than frequency. We only ever{' '}
          <Text variant="bodySm" italic tone="muted">
            offer
          </Text>{' '}
          a step-up. Never increase it for you.
        </Text>

        {/* Ramp chart card */}
        <View className="mt-6 rounded-card bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text variant="body" className="font-sans-bold text-[14px]">
              Nights per week
            </Text>
            <Text variant="label" tone="muted" className="font-mono">
              target 3
            </Text>
          </View>
          <View className="h-[108px] flex-row items-end gap-2.5">
            {BARS.map((b) => (
              <View key={b.label} className="flex-1 items-center">
                <View
                  className="w-full rounded-md"
                  style={{
                    height: b.height,
                    backgroundColor: b.striped ? '#F1ECE3' : b.color,
                    ...(b.striped ? { borderWidth: 1.5, borderColor: 'rgba(165,105,75,0.4)', borderStyle: 'dashed' } : {}),
                  }}
                />
                <Text
                  className="mt-1.5 font-mono text-[10px]"
                  style={{ color: b.accent ? colors.clay : '#C0B7A6' }}>
                  {b.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Offer card (dark) */}
        <View className="mt-4 rounded-card p-5" style={{ backgroundColor: colors.ink }}>
          <Text className="font-sans-semibold text-[15px]" style={{ color: colors.paper }}>
            You&apos;ve held steady at 2 nights for three weeks.
          </Text>
          <Text className="mt-1 text-[13.5px]" style={{ color: 'rgba(250,247,242,0.6)' }}>
            Skin felt comfortable each week. Want to try a third night?
          </Text>
          <View className="mt-4 flex-row gap-2.5">
            <Pressable
              accessibilityRole="button"
              className="h-[46px] flex-1 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.clay }}
              onPress={() => router.back()}>
              <Text className="font-sans-semibold text-[14.5px]" style={{ color: colors.paper }}>
                Add a night
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="h-[46px] flex-1 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(250,247,242,0.1)' }}
              onPress={() => router.back()}>
              <Text className="font-sans-semibold text-[14.5px]" style={{ color: colors.paper }}>
                Not yet
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}
