import { GOALS, type GoalId } from '@onskin/types';
import { router } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

function CompactGoalCard({
  goal,
  selected,
  onPress,
}: {
  goal: (typeof GOALS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${goal.title}. ${goal.subtitle}`}
      aria-pressed={selected}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={cn(
        'min-h-[74px] rounded-card border px-3 py-2.5',
        selected ? 'border-clay bg-clay/5' : 'border-hairline bg-paper-raised',
      )}
      style={{ width: '48%' }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text
          className="flex-1 font-sans-medium text-[14px] leading-[17px] text-ink"
          numberOfLines={2}
        >
          {goal.title}
        </Text>
        <View
          className={cn(
            'mt-0.5 h-4 w-4 items-center justify-center rounded-full border',
            selected ? 'border-clay bg-clay' : 'border-greige-deep bg-transparent',
          )}
        >
          {selected ? <View className="h-1.5 w-1.5 rounded-full bg-paper" /> : null}
        </View>
      </View>
      <Text className="mt-1 font-sans text-[11px] leading-[14px] text-muted" numberOfLines={2}>
        {goal.subtitle}
      </Text>
    </Pressable>
  );
}

// 02 · Goals. Large tappable cards, multi-select up to two (design spec p.3).
export default function GoalsScreen() {
  const { height } = useWindowDimensions();
  const { goals, quizAnswers, toggleGoal } = useOnboarding();
  const compactPhone = height < 640;
  const quizCompletion = getQuizCompletionState(quizAnswers);

  return (
    <Screen>
      <View className="pt-2">
        <ProgressBar total={5} current={1} />
      </View>
      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
        >
          <Text variant="title" className={compactPhone ? 'mt-5' : 'mt-8'}>
            What brings you here?
          </Text>
          <Text variant="body" tone="muted" className="mt-2">
            Choose up to two. This shapes your plan.
          </Text>
          {compactPhone ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              {GOALS.map((g) => (
                <CompactGoalCard
                  key={g.id}
                  goal={g}
                  selected={goals.includes(g.id)}
                  onPress={() => toggleGoal(g.id as GoalId)}
                />
              ))}
            </View>
          ) : (
            <View className="mt-6 gap-3">
              {GOALS.map((g) => (
                <OptionCard
                  key={g.id}
                  title={g.title}
                  subtitle={g.subtitle}
                  selected={goals.includes(g.id)}
                  onPress={() => toggleGoal(g.id as GoalId)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
      <View className="bg-paper pb-4 pt-2">
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
