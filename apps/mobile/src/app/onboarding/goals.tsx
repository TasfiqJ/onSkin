import { GOALS, type GoalId } from '@onskin/types';
import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { track } from '@/lib/analytics/track';

// 02 · Goals. Large tappable cards, multi-select up to two (design spec p.3).
export default function GoalsScreen() {
  const { height } = useWindowDimensions();
  const { goals, toggleGoal } = useOnboarding();
  const compactPhone = height < 640;

  return (
    <Screen>
      <View className="pt-2">
        <ProgressBar total={5} current={1} />
      </View>
      <View className="flex-1 overflow-hidden">
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
          <View className={compactPhone ? 'mt-4 gap-1' : 'mt-6 gap-3'}>
            {GOALS.map((g) => (
              <OptionCard
                key={g.id}
                title={g.title}
                subtitle={g.subtitle}
                selected={goals.includes(g.id)}
                onPress={() => toggleGoal(g.id as GoalId)}
                compact={compactPhone}
                tight={compactPhone}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      <View className="bg-paper pb-4 pt-2">
        <Button
          label="Continue"
          disabled={goals.length === 0}
          onPress={() => {
            track('screen_viewed', { screen_name: 'goals' });
            router.push('/onboarding/consent');
          }}
        />
      </View>
    </Screen>
  );
}
