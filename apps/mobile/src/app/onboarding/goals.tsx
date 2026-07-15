import { GOALS, type GoalId } from '@onskin/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

function CompactGoalCard({
  goal,
  selected,
  onPress,
  splitShort,
}: {
  goal: (typeof GOALS)[number];
  selected: boolean;
  onPress: () => void;
  splitShort?: boolean;
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
        splitShort
          ? 'min-h-[60px] rounded-card border px-2.5 py-2'
          : 'min-h-[74px] rounded-card border px-3 py-2.5',
        selected ? 'border-clay bg-clay/5' : 'border-hairline bg-paper-raised',
      )}
      style={{ width: '48%' }}
    >
      <View
        className={
          splitShort
            ? 'flex-row items-start justify-between gap-1.5'
            : 'flex-row items-start justify-between gap-2'
        }
      >
        <Text
          className={cn(
            'flex-1 font-sans-medium text-ink',
            splitShort ? 'text-[13px] leading-[16px]' : 'text-[14px] leading-[17px]',
          )}
          numberOfLines={splitShort ? 1 : 2}
        >
          {goal.title}
        </Text>
        <View
          className={cn(
            splitShort
              ? 'mt-0.5 h-3.5 w-3.5 items-center justify-center rounded-full border'
              : 'mt-0.5 h-4 w-4 items-center justify-center rounded-full border',
            selected ? 'border-clay bg-clay' : 'border-greige-deep bg-transparent',
          )}
        >
          {selected ? <View className="h-1.5 w-1.5 rounded-full bg-paper" /> : null}
        </View>
      </View>
      <Text
        className={cn(
          'font-sans text-muted',
          splitShort ? 'mt-0.5 text-[10px] leading-[12px]' : 'mt-1 text-[11px] leading-[14px]',
        )}
        numberOfLines={splitShort ? 1 : 2}
      >
        {goal.subtitle}
      </Text>
    </Pressable>
  );
}

// 03 · Goals. Large tappable cards, multi-select up to two, after consent.
export default function GoalsScreen() {
  const { fontScale = 1, height, width } = useWindowDimensions();
  const { goals, quizAnswers, toggleGoal } = useOnboarding();
  const [consentChecked, setConsentChecked] = useState(false);
  const supportFloorTextPressurePhone =
    width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPhone = height < 640 || supportFloorTextPressurePhone;
  const splitShortPhone = height < 420;
  const quizCompletion = getQuizCompletionState(quizAnswers);

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
        <ProgressBar total={5} current={2} />
      </View>
      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
        >
          <Text
            variant="title"
            className={splitShortPhone ? 'mt-3' : compactPhone ? 'mt-5' : 'mt-8'}
          >
            What brings you here?
          </Text>
          <Text variant="body" tone="muted" className={splitShortPhone ? 'mt-1' : 'mt-2'}>
            Choose up to two. This shapes your plan.
          </Text>
          {compactPhone ? (
            <View
              className={
                splitShortPhone
                  ? 'mt-2 flex-row flex-wrap gap-1.5'
                  : 'mt-4 flex-row flex-wrap gap-2'
              }
            >
              {GOALS.map((g) => (
                <CompactGoalCard
                  key={g.id}
                  goal={g}
                  selected={goals.includes(g.id)}
                  onPress={() => toggleGoal(g.id as GoalId)}
                  splitShort={splitShortPhone}
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
            router.push(quizCompletion.complete ? '/onboarding/products' : '/onboarding/quiz');
          }}
        />
      </View>
    </Screen>
  );
}
