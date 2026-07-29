import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { NO_SCORE_COPY } from '@/features/photos/copy';
import { APP_PROGRESS_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// The honest, differentiating no-AI-score stance (docs/06 §8, design screen 07),
// stated plainly to the user. Reachable from the Progress tab + the You tab.

function Bullet({ children }: { children: string }) {
  return (
    <View className="flex-row items-start gap-3.5">
      <View
        className="mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.sageTint }}
      >
        <Text style={{ color: colors.sage, fontSize: 11 }}>✓</Text>
      </View>
      <Text variant="body" tone="ink" className="flex-1" style={{ color: colors.inkSoft }}>
        {children}
      </Text>
    </View>
  );
}

export default function AboutNoScoreScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row justify-end pt-1">
        <RouteIconButton
          accessibilityLabel="Close"
          glyph="x"
          tone="muted"
          onPress={() => backOrReplace(router, APP_PROGRESS_ROUTE)}
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View
          className="mb-6 mt-4 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.sageTint }}
        >
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
      </ScrollView>
    </Screen>
  );
}
