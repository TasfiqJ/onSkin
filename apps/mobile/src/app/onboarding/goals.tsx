import { GOALS, type GoalId } from '@layerwell/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';

// One-column choices are intentional: onboarding should remain readable under
// Dynamic Type and short-phone pressure rather than turning into a tiny grid.
export default function GoalsScreen() {
  const { goals, profileResult, quizAnswers, toggleGoal } = useOnboarding();
  const [consentChecked, setConsentChecked] = useState(false);
  const quizCompletion = getQuizCompletionState(quizAnswers);
  const hasProfileResult = profileResult !== null || quizCompletion.complete;

  useEffect(() => {
    let active = true;
    void hasCurrentHealthDataCollectionConsent()
      .then((hasCurrentConsent) => {
        if (!active) return;
        if (hasCurrentConsent) setConsentChecked(true);
        else router.replace('/onboarding/consent');
      })
      .catch(() => {
        if (active) router.replace('/onboarding/consent');
      });
    return () => {
      active = false;
    };
  }, []);

  if (!consentChecked) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="clay" className="text-center">
            Privacy check
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Checking your privacy choice
          </Text>
        </View>
      </Screen>
    );
  }

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
          <Text variant="title" className="mt-7">
            What brings you here?
          </Text>
          <Text variant="body" tone="muted" className="mt-2">
            Choose up to two. We&apos;ll use these to keep your plan focused.
          </Text>

          <View className="mt-6 gap-2.5">
            {GOALS.map((g) => (
              <OptionCard
                key={g.id}
                title={g.title}
                subtitle={g.subtitle}
                selected={goals.includes(g.id)}
                onPress={() => toggleGoal(g.id as GoalId)}
                compact
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
            router.push(hasProfileResult ? '/onboarding/products' : '/onboarding/quiz');
          }}
        />
      </View>
    </Screen>
  );
}
