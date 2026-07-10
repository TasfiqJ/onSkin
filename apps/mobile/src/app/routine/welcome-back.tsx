import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { WELCOME_BACK } from '@/features/notifications/copy';
import { useProgress } from '@/features/routine/useProgress';
import { colors } from '@/theme/tokens';

// Calm earn-back after a lapse (design screen 04, docs/07 §4.2). No shame screen:
// if grace days absorbed the gap, the streak is shown safe; if it lapsed, a gentle
// invite back. Either way the next action is simply tonight's step.
export default function WelcomeBackScreen() {
  const { data } = useProgress();
  const frozen = data?.graceUsed ?? false;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 justify-center">
        <View
          className="mb-6 h-[60px] w-[60px] items-center justify-center rounded-full"
          style={{ backgroundColor: colors.sageTint }}
        >
          <Text style={{ color: colors.sage, fontSize: 26 }}>✓</Text>
        </View>
        <Text variant="display" style={{ fontSize: 44, lineHeight: 47 }}>
          {WELCOME_BACK.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-4" style={{ lineHeight: 26, fontSize: 16 }}>
          {frozen ? WELCOME_BACK.safeBody : WELCOME_BACK.lapsedBody}
        </Text>

        {frozen ? (
          <View
            className="mt-7 flex-row items-center gap-3.5 rounded-card bg-paper-raised p-5"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <View
              className="h-[38px] w-[38px] items-center justify-center rounded-full"
              style={{ backgroundColor: colors.sageTint }}
            >
              <View
                className="h-4 w-3.5 rounded-[3px] border-2"
                style={{ borderColor: colors.sage }}
              />
            </View>
            <View className="flex-1">
              <Text variant="body" className="font-sans-bold" style={{ color: colors.sageDeep }}>
                {WELCOME_BACK.safeTagTitle(data?.streak ?? 0)}
              </Text>
              <Text variant="bodySm" style={{ color: colors.sageEyebrow }}>
                {WELCOME_BACK.safeTagBody}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      <View className="pb-4 pt-2">
        <Button label={WELCOME_BACK.cta} onPress={() => router.replace('/(tabs)/today')} />
      </View>
    </Screen>
  );
}
