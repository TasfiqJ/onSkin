import { GOALS, type GoalId } from '@onskin/types';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { track } from '@/lib/analytics/track';

// 02 · Goals. Large tappable cards, multi-select up to two (design spec p.3).
export default function GoalsScreen() {
  const { goals, toggleGoal } = useOnboarding();

  return (
    <Screen>
      <View className="pt-2">
        <ProgressBar total={5} current={1} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4">
        <Text variant="title" className="mt-8">
          What brings you here?
        </Text>
        <Text variant="body" tone="muted" className="mt-2">
          Choose up to two. This shapes your plan.
        </Text>
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
      </ScrollView>
      <View className="pb-4">
        <Button
          label="Continue"
          disabled={goals.length === 0}
          onPress={() => {
            track('screen_viewed', { screen_name: 'goals', goals });
            router.push('/onboarding/consent');
          }}
        />
      </View>
    </Screen>
  );
}
