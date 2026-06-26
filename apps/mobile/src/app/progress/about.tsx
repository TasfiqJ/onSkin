import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { NO_SCORE_COPY } from '@/features/photos/copy';
import { TREND_COPY } from '@/features/trend/copy';
import { useTrendConsent } from '@/features/trend/useTrend';
import { colors } from '@/theme/tokens';

// The honest, differentiating no-AI-score stance (docs/06 §8, design screen 07),
// stated plainly to the user. Reachable from the Progress tab + the You tab.

function Bullet({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-3.5">
      <View
        className="mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.sageTint }}>
        <Text style={{ color: colors.sage, fontSize: 11 }}>✓</Text>
      </View>
      <Text variant="body" tone="ink" className="flex-1" style={{ color: colors.inkSoft }}>
        {children}
      </Text>
    </View>
  );
}

export default function AboutNoScoreScreen() {
  const { data: trendConsented } = useTrendConsent();
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row justify-end pt-1">
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()}>
          <Text variant="body" tone="muted" style={{ fontSize: 22 }}>
            ✕
          </Text>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View
          className="mb-6 mt-4 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.sageTint }}>
          <Text style={{ color: colors.sage, fontSize: 22 }}>⊘</Text>
        </View>
        <Text variant="title" style={{ fontSize: 38, lineHeight: 40 }}>
          {NO_SCORE_COPY.title}
        </Text>
        <Text variant="body" className="mt-4" style={{ color: colors.inkSoft, lineHeight: 24 }}>
          {NO_SCORE_COPY.body}
        </Text>
        <View className="mt-7 gap-3">
          {NO_SCORE_COPY.bullets.map((b) => (
            <Bullet key={b}>{b}</Bullet>
          ))}
        </View>
        <Text variant="label" tone="muted" className="mt-10 text-center" style={{ lineHeight: 18 }}>
          {NO_SCORE_COPY.footer}
        </Text>

        {/* docs/12. The optional, on-device, off-by-default opt-in. The refusal above
            is preserved as the default; this never overrides it. Once opted in, the
            copy switches to "manage" so it doesn't invite enabling what is already on. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/trend/optin')}
          className="mt-7 flex-row items-center justify-between rounded-card bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <Text variant="bodySm" className="flex-1 pr-3 font-sans-medium text-[12.5px]" style={{ color: colors.inkSoft, lineHeight: 18 }}>
            {trendConsented ? TREND_COPY.manageLink : TREND_COPY.refusalLink}
          </Text>
          <Text style={{ color: colors.mutedLight, fontSize: 18 }}>›</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
