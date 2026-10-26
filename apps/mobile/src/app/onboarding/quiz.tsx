import { router } from 'expo-router';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Chip, OptionCard, ProgressBar, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import {
  isQuizQuestionAnswered,
  ONBOARDING_QUIZ,
  toggleExclusiveNoneSelection,
} from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';
import { quizNavigation16 } from '@/features/onboarding/quizNavigation16';

export default function QuizScreen() {
  const { height } = useWindowDimensions();
  const navigation = useContext(NavigationContext);
  const compact = height < 740;
  const { quizAnswers, setAnswer } = useOnboarding();
  const [index, setIndex] = useState(0);
  const navigationIndex = useRef(0);
  const visibleIndex = useRef(0);
  useEffect(() => {
    visibleIndex.current = index;
  }, [index]);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    function focus() {
      cleanup?.();
      let active = true;
      navigationIndex.current = -1;
      void hasCurrentHealthDataCollectionConsent()
        .then((hasCurrentConsent) => {
          if (!active) return;
          if (hasCurrentConsent) {
            navigationIndex.current = visibleIndex.current;
            setConsentChecked(true);
          } else router.replace('/onboarding/consent');
        })
        .catch(() => {
          if (active) router.replace('/onboarding/consent');
        });
      cleanup = () => {
        active = false;
        navigationIndex.current = -1;
      };
    }
    const blur = () => {
      cleanup?.();
      cleanup = undefined;
    };
    // Standalone mounts retain the original consent check; navigator-hosted
    // routes additionally reset on each real focus, including Products→Back.
    if (!navigation || navigation.isFocused()) focus();
    const offFocus = navigation?.addListener('focus', focus);
    const offBlur = navigation?.addListener('blur', blur);
    return () => {
      offFocus?.();
      offBlur?.();
      blur();
    };
  }, [navigation]);

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
  const answered = isQuizQuestionAnswered(question, current);

  function selectSingle(optionId: string) {
    setAnswer(question.id, optionId);
    track('quiz_question_answered', { count: index + 1, type: 'single' });
  }

  function toggleMulti(optionId: string) {
    const prev = Array.isArray(current) ? current : [];
    setAnswer(question.id, toggleExclusiveNoneSelection(prev, optionId));
  }

  function next() {
    const nextIndex = quizNavigation16(navigationIndex.current, index, total, answered, 'next');
    if (nextIndex === null) return;
    navigationIndex.current = nextIndex;
    if (index < total - 1) {
      setIndex(index + 1);
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
            onPress={() => {
              const previous = quizNavigation16(
                navigationIndex.current,
                index,
                total,
                answered,
                'back',
              );
              if (previous === null) return;
              navigationIndex.current = previous;
              setIndex(previous);
            }}
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
