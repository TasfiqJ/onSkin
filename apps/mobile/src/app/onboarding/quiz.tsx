import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Chip, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import { ONBOARDING_QUIZ, toggleExclusiveNoneSelection } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';

export default function QuizScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const { quizAnswers, setAnswer } = useOnboarding();
  const [index, setIndex] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);

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
          <Text variant="body" tone="muted" className="mt-3 text-center">
            One moment while we confirm the quiz can start.
          </Text>
        </View>
      </Screen>
    );
  }

  const total = ONBOARDING_QUIZ.length;
  const question = ONBOARDING_QUIZ[index]!;
  const current = quizAnswers[question.id];
  const isMulti = question.multiSelect === true;
  const answered = isMulti
    ? Array.isArray(current) && current.length > 0
    : typeof current === 'string';

  function selectSingle(optionId: string) {
    setAnswer(question.id, optionId);
    track('quiz_question_answered', { count: index + 1, type: 'single' });
  }

  function toggleMulti(optionId: string) {
    const prev = Array.isArray(current) ? current : [];
    setAnswer(question.id, toggleExclusiveNoneSelection(prev, optionId));
  }

  function next() {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      return;
    }
    track('quiz_completed');
    router.push('/onboarding/products');
  }

  return (
    <Screen>
      <View className="pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            SKIN PROFILE
          </Text>
          <Text variant="label" tone="muted">
            {index + 1} OF {total}
          </Text>
        </View>
        <ProgressBar total={total} current={index + 1} />
      </View>

      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          key={question.id}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
        >
          <Text variant="eyebrow" tone="clay" className={compact ? 'mt-3' : 'mt-7'}>
            {question.eyebrow}
          </Text>
          <Text variant="title" className="mt-2">
            {question.prompt}
          </Text>
          {isMulti ? (
            <View className="mt-6 flex-row flex-wrap gap-2">
              {question.options.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={Array.isArray(current) && current.includes(o.id)}
                  onPress={() => toggleMulti(o.id)}
                />
              ))}
            </View>
          ) : (
            <View className={compact ? 'mt-3 gap-2' : 'mt-6 gap-2.5'}>
              {question.options.map((o) => (
                <OptionCard
                  key={o.id}
                  title={o.label}
                  subtitle={o.subtitle}
                  selected={current === o.id}
                  onPress={() => selectSingle(o.id)}
                  compact
                  tight={compact}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <View className="bg-paper pb-4 pt-2">
        {index > 0 ? (
          <Button
            label="Back"
            variant="ghost"
            className="mb-1 min-h-[48px] py-2"
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
          />
        ) : null}
        <Button
          label={index < total - 1 ? 'Next' : 'See my profile'}
          disabled={!answered}
          onPress={next}
        />
      </View>
    </Screen>
  );
}
