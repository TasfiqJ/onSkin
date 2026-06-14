import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { grantTrendInsightsConsent, revokeTrendInsightsConsent } from '@/features/trend/consent';
import { TREND_COPY } from '@/features/trend/copy';
import { useTrendConsent } from '@/features/trend/useTrend';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// 02 · The opt-in (docs/12 §5/§8, design 02). OFF by default, a plain-language
// disclosure, a SEPARATE photo_trend_insights consent. The honest engine is classical
// computer vision ("your phone comparing your own photos"), not marketed as AI. Never
// default-on; the installed base is re-consented here, never silently enrolled.
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-start gap-2.5">
      <View className="mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.sageTint }}>
        <Text className="text-[10px]" style={{ color: colors.sage }}>
          ✓
        </Text>
      </View>
      <Text variant="bodySm" className="flex-1 text-[12.5px]" style={{ color: colors.inkSoft, lineHeight: 18 }}>
        {children}
      </Text>
    </View>
  );
}

export default function TrendOptInScreen() {
  const qc = useQueryClient();
  const { data: consented } = useTrendConsent();

  const setEnabled = async (on: boolean) => {
    haptics.select();
    if (on) await grantTrendInsightsConsent();
    else await revokeTrendInsightsConsent();
    await qc.invalidateQueries({ queryKey: ['trendConsent'] });
  };

  return (
    <Screen edges={['top']}>
      <View className="flex-row items-center gap-3 pb-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-7 w-7 items-center justify-center rounded-full bg-paper-raised"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text style={{ color: colors.ink }}>‹</Text>
        </Pressable>
        <Text variant="body" className="font-sans-semibold" tone="muted">
          {TREND_COPY.optIn.title}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="mt-2 rounded-[22px] bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text variant="title" className="text-[25px] leading-[29px]" accessibilityRole="header">
            {TREND_COPY.optIn.heading}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-3 text-[13px]" style={{ lineHeight: 20 }}>
            {TREND_COPY.optIn.body}
          </Text>
          <View className="mt-4 gap-2.5">
            {TREND_COPY.optIn.bullets.map((b) => (
              <Bullet key={b}>{b}</Bullet>
            ))}
          </View>
          <View className="mt-4 flex-row items-center gap-2 pt-3.5" style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
            <Text style={{ color: colors.clay, fontSize: 12 }}>✦</Text>
            <Text className="flex-1 text-[11px]" tone="muted" style={{ lineHeight: 15 }}>
              {TREND_COPY.optIn.consentLine}
            </Text>
          </View>
        </View>

        {/* the toggle. OFF by default */}
        <View
          className="mt-3.5 flex-row items-center justify-between rounded-2xl bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <View>
            <Text variant="body" className="font-sans-semibold text-[14px]">
              {TREND_COPY.optIn.toggleLabel}
            </Text>
            <Text className="text-[11px]" tone="muted">
              {TREND_COPY.optIn.toggleHint}
            </Text>
          </View>
          <Switch
            value={consented ?? false}
            onValueChange={(v) => void setEnabled(v)}
            trackColor={{ true: colors.sage, false: colors.greigeDeep }}
            thumbColor={colors.paperRaised}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/trend/fairness')}
          className="mt-3 flex-row items-center justify-between rounded-2xl bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text variant="bodySm" className="font-sans-medium text-[13px]">
            How it stays fair across skin tones
          </Text>
          <Text style={{ color: colors.mutedLight, fontSize: 18 }}>›</Text>
        </Pressable>

        <Text variant="label" tone="muted" className="mt-5 px-2 text-center" style={{ lineHeight: 17 }}>
          {TREND_COPY.optIn.footer}
        </Text>
      </ScrollView>
    </Screen>
  );
}
