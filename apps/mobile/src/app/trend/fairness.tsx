import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { RouteIconButton, Screen, Text } from '@/components/ui';
import { TREND_COPY } from '@/features/trend/copy';
import { useMonkBand } from '@/features/trend/useTrend';
import { phase7Flags } from '@/lib/launch/phase7';
import {
  APP_PROGRESS_ROUTE,
  APP_TREND_OPTIN_ROUTE,
  backOrReplace,
} from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// 05 · The fairness floor (docs/12 §7, design 05). Monk scale (never Fitzpatrick),
// equal-or-higher noise thresholds for darker tones, texture/evenness not redness, and
// no "works for everyone" claim until a Monk-stratified cohort shows parity. The Monk
// swatch row is illustrative; the user's own band drives the fairness-adjusted floor.
const MONK_SWATCHES = ['#F4E3D2', '#E9CBAA', '#D2A77E', '#B07E52', '#8A5A36', '#5E3A22', '#3D2417'];

export default function FairnessScreen() {
  const { data: monkBand } = useMonkBand();
  // Map Monk 1-10 onto the 7-swatch illustrative row.
  const activeIdx =
    monkBand == null
      ? -1
      : Math.min(MONK_SWATCHES.length - 1, Math.floor(((monkBand - 1) / 9) * MONK_SWATCHES.length));

  if (!phase7Flags.trend) {
    return (
      <DeferredSurface
        surface="trend"
        fallbackRoute={APP_PROGRESS_ROUTE}
        fallbackLabel="Back to Progress"
      />
    );
  }

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <RouteIconButton
          accessibilityLabel="Back"
          onPress={() => backOrReplace(router, APP_TREND_OPTIN_ROUTE)}
        />
        <Text variant="body" className="font-sans-semibold" tone="muted">
          {TREND_COPY.fairness.title}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 pt-1">
        <Text variant="title" className="mt-1">
          {TREND_COPY.fairness.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1">
          {TREND_COPY.fairness.subtitle}
        </Text>

        {/* Monk tone band */}
        <View
          className="mt-5 rounded-[20px] bg-paper-raised p-5"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <Text variant="label" tone="muted" className="mb-3">
            {TREND_COPY.fairness.monkLabel.toUpperCase()}
          </Text>
          <View className="mb-3.5 flex-row gap-1.5">
            {MONK_SWATCHES.map((c, i) => (
              <View
                key={c}
                className="h-[26px] flex-1 rounded"
                style={
                  i === activeIdx
                    ? { backgroundColor: c, borderWidth: 2, borderColor: colors.clay }
                    : { backgroundColor: c }
                }
              />
            ))}
          </View>
          <Text
            variant="bodySm"
            className="text-[12.5px]"
            style={{ color: colors.inkSoft, lineHeight: 18 }}
          >
            {TREND_COPY.fairness.monkNote}
          </Text>
        </View>

        {/* redness is never the metric */}
        <View
          className="mt-3.5 rounded-[18px] p-4"
          style={{
            backgroundColor: colors.clayTint,
            borderWidth: 1,
            borderColor: 'rgba(165,105,75,0.18)',
          }}
        >
          <View className="mb-2 flex-row items-center gap-2">
            <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-paper-raised">
              <Text className="text-[10px]" style={{ color: colors.clay }}>
                ✕
              </Text>
            </View>
            <Text className="font-sans-bold text-[13px]" style={{ color: colors.clayDeep }}>
              {TREND_COPY.fairness.rednessTitle}
            </Text>
          </View>
          <Text className="text-[12px]" style={{ color: '#6F4A36', lineHeight: 17 }}>
            {TREND_COPY.fairness.rednessBody}
          </Text>
        </View>

        {/* the gate */}
        <View
          className="mt-3.5 flex-row items-center gap-3 rounded-[18px] p-4"
          style={{ backgroundColor: colors.greige }}
        >
          <Text className="font-mono text-[11px]" style={{ color: colors.clay }}>
            {TREND_COPY.fairness.gateLabel}
          </Text>
          <Text className="flex-1 text-[11.5px]" tone="muted" style={{ lineHeight: 16 }}>
            {TREND_COPY.fairness.gateNote}
          </Text>
        </View>

        <Text
          variant="label"
          tone="muted"
          className="mt-6 px-2 text-center"
          style={{ lineHeight: 17 }}
        >
          {TREND_COPY.fairness.footer}
        </Text>
      </ScrollView>
    </Screen>
  );
}
