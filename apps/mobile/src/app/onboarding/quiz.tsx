import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Chip, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { ONBOARDING_QUIZ, toggleExclusiveNoneSelection } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';

// 04 · Quiz. Original 4-axis questions, data-driven from the engine. The content
// is still pending final B-QUIZ-COPY/legal review. The pregnancy/sensitivities
// questions live at the end of the set, so this also covers docs/01 §2 step 5.
export default function QuizScreen() {
  const { height } = useWindowDimensions();
  const { quizAnswers, setAnswer } = useOnboarding();
  const [index, setIndex] = useState(0);
  const compactPhone = height < 640;

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
        <ProgressBar total={total} current={index + 1} />
        <Text variant="label" tone="muted" className="mt-2">
          {index + 1} / {total}
        </Text>
      </View>
      <View className="flex-1 overflow-hidden">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
        >
          <Text variant="eyebrow" tone="clay" className={compactPhone ? 'mt-5' : 'mt-7'}>
            {question.eyebrow}
          </Text>
          <Text variant="title" className="mt-2">
            {question.prompt}
          </Text>
          {isMulti ? (
            <View
              className={
                compactPhone ? 'mt-4 flex-row flex-wrap gap-2' : 'mt-6 flex-row flex-wrap gap-2'
              }
            >
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
            <View className={compactPhone ? 'mt-4 gap-2' : 'mt-6 gap-3'}>
              {question.options.map((o) => (
                <OptionCard
                  key={o.id}
                  title={o.label}
                  subtitle={o.subtitle}
                  selected={current === o.id}
                  onPress={() => selectSingle(o.id)}
                  compact={compactPhone}
                  tight={compactPhone}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
      <View className="bg-paper pb-4 pt-2">
        <Button
          label={index < total - 1 ? 'Next' : 'See my profile'}
          disabled={!answered}
          onPress={next}
        />
      </View>
    </Screen>
  );
}
