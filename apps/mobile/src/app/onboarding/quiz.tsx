import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Chip, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import { ONBOARDING_QUIZ, toggleExclusiveNoneSelection } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';

function CompactQuizOptionCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      aria-pressed={selected}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={cn(
        'min-h-[52px] rounded-card border px-3 py-2',
        selected ? 'border-clay bg-clay/5' : 'border-hairline bg-paper-raised',
      )}
      style={{ width: '48%' }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text
          className="flex-1 font-sans-medium text-[13.5px] leading-[16px] text-ink"
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.86}
        >
          {label}
        </Text>
        <View
          className={cn(
            'h-4 w-4 items-center justify-center rounded-full border',
            selected ? 'border-clay bg-clay' : 'border-greige-deep bg-transparent',
          )}
        >
          {selected ? <View className="h-1.5 w-1.5 rounded-full bg-paper" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

// 04 · Quiz. Original 4-axis questions, data-driven from the engine. The content
// is still pending final B-QUIZ-COPY/legal review. The pregnancy/sensitivities
// questions live at the end of the set, so this also covers docs/01 §2 step 5.
export default function QuizScreen() {
  const { height } = useWindowDimensions();
  const { quizAnswers, setAnswer } = useOnboarding();
  const [index, setIndex] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const compactPhone = height < 640;
  const splitShortPhone = height < 460;

  useEffect(() => {
    let active = true;
    void hasCurrentHealthDataCollectionConsent()
      .then((hasCurrentConsent) => {
        if (!active) return;
        if (hasCurrentConsent) {
          setConsentChecked(true);
          return;
        }
        router.replace('/onboarding/consent');
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
        <ProgressBar total={total} current={index + 1} />
        <Text variant="label" tone="muted" className="mt-2">
          {index + 1} / {total}
        </Text>
      </View>
      <View className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
        >
          <Text
            variant="eyebrow"
            tone="clay"
            className={splitShortPhone ? 'mt-3' : compactPhone ? 'mt-5' : 'mt-7'}
          >
            {question.eyebrow}
          </Text>
          <Text
            variant="title"
            className={splitShortPhone ? 'mt-1' : 'mt-2'}
            style={splitShortPhone ? { fontSize: 24, lineHeight: 27 } : undefined}
          >
            {question.prompt}
          </Text>
          {isMulti ? (
            <View
              className={
                splitShortPhone
                  ? 'mt-3 flex-row flex-wrap gap-1.5'
                  : compactPhone
                    ? 'mt-4 flex-row flex-wrap gap-2'
                    : 'mt-6 flex-row flex-wrap gap-2'
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
          ) : splitShortPhone ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {question.options.map((o) => (
                <CompactQuizOptionCard
                  key={o.id}
                  label={o.label}
                  selected={current === o.id}
                  onPress={() => selectSingle(o.id)}
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
