import { GOALS, type GoalId } from '@onskin/types';
import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';

// One-column choices are intentional: onboarding should remain readable under
// Dynamic Type and short-phone pressure rather than turning into a tiny grid.
export default function GoalsScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const { goals, quizAnswers, toggleGoal } = useOnboarding();
  const quizCompletion = getQuizCompletionState(quizAnswers);

  return (
    <Screen>
      <View className="pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            SETUP
          </Text>
          <Text variant="label" tone="muted">
            1 OF 5
          </Text>
        </View>
        <ProgressBar total={5} current={1} />
      </View>

      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
        >
          <Text variant="title" className={compact ? 'mt-3' : 'mt-7'}>
            What brings you here?
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-2">
            Choose up to two. We&apos;ll use these to keep your plan focused.
          </Text>

          <View className={compact ? 'mt-3 gap-2' : 'mt-6 gap-2.5'}>
            {GOALS.map((g) => (
              <OptionCard
                key={g.id}
                title={g.title}
                subtitle={g.subtitle}
                selected={goals.includes(g.id)}
                onPress={() => toggleGoal(g.id as GoalId)}
                compact
                tight={compact}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View className="bg-paper pb-4 pt-2">
        <Text variant="bodySm" tone="muted" className="mb-2 text-center">
          {goals.length === 0 ? 'Choose at least one' : `${goals.length} selected · up to 2`}
        </Text>
        <Button
          label="Continue"
          disabled={goals.length === 0}
          onPress={() => {
            track('screen_viewed', { screen_name: 'goals' });
            router.push(quizCompletion.complete ? '/onboarding/products' : '/onboarding/consent');
          }}
        />
      </View>
    </Screen>
  );
}
