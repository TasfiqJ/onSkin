import { router } from 'expo-router';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
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
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';

type QuizAdmission = { token: number; lease: HealthDataWriteLease };

export default function QuizScreen() {
  const { height } = useWindowDimensions();
  const navigation = useContext(NavigationContext);
  const compact = height < 740;
  const { quizAnswers, setAnswer, reset } = useOnboarding();
  const latestAnswers = useRef(quizAnswers);
  useLayoutEffect(() => {
    latestAnswers.current = quizAnswers;
  }, [quizAnswers]);
  const currentLease = useSyncExternalStore(
    subscribeActiveHealthProcessingLeaseChanges,
    activeHealthProcessingLeaseSnapshot,
    () => null,
  );
  // The protected provider does not tag drafts with an owner. Only a draft
  // started empty in this mounted route's admitted window can be restored.
  const answerGeneration = useRef<number | null>(null);
  const focusToken = useRef(0);
  const authority = useRef<QuizAdmission | null>(null);
  const [admission, setAdmission] = useState<QuizAdmission | null>(null);
  const [privacyState, setPrivacyState] = useState<'checking' | 'denied' | 'ready' | 'restart'>(
    'checking',
  );
  const [index, setIndex] = useState(0);
  const navigationIndex = useRef(0);
  const visibleIndex = useRef(0);
  useEffect(() => {
    visibleIndex.current = index;
  }, [index]);
  useEffect(() => {
    let focused = false;
    let lease: HealthDataWriteLease | null = null;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    function retire(state: 'checking' | 'denied') {
      ++focusToken.current;
      authority.current = null;
      navigationIndex.current = -1;
      clearTimeout(expiry);
      setAdmission(null);
      setPrivacyState(state);
    }
    function deny() {
      lease = null;
      retire('denied');
      router.replace('/onboarding/consent');
    }
    function focus() {
      retire('checking');
      focused = true;
      const token = focusToken.current;
      try {
        lease = captureHealthDataWriteLease();
      } catch {
        deny();
        return;
      }
      const acceptedLease = lease;
      if (lease.expiresAt !== null) {
        expiry = setTimeout(
          () => {
            if (focused && token === focusToken.current) deny();
          },
          Math.max(0, lease.expiresAt - Date.now()),
        );
      }
      void hasCurrentHealthDataCollectionConsent()
        .then((hasCurrentConsent) => {
          if (!focused || token !== focusToken.current) return;
          assertHealthDataWriteLease(acceptedLease);
          if (hasCurrentConsent) {
            const accepted = { token, lease: acceptedLease };
            authority.current = accepted;
            setAdmission(accepted);
            if (
              answerGeneration.current !== acceptedLease.generation &&
              Object.keys(latestAnswers.current).length > 0
            ) {
              setPrivacyState('restart');
              return;
            }
            answerGeneration.current = acceptedLease.generation;
            navigationIndex.current = visibleIndex.current;
            setPrivacyState('ready');
          } else deny();
        })
        .catch(() => {
          if (focused && token === focusToken.current) deny();
        });
    }
    const blur = () => {
      focused = false;
      lease = null;
      retire('checking');
    };
    // Standalone mounts retain the original consent check; navigator-hosted
    // routes additionally reset on each real focus, including Products→Back.
    if (!navigation || navigation.isFocused()) focus();
    const offFocus = navigation?.addListener('focus', focus);
    const offBlur = navigation?.addListener('blur', blur);
    const offLease = subscribeActiveHealthProcessingLeaseChanges(() => {
      if (!focused || !lease) return;
      try {
        assertHealthDataWriteLease(lease);
      } catch {
        deny();
      }
    });
    return () => {
      offFocus?.();
      offBlur?.();
      offLease();
      blur();
    };
  }, [navigation]);

  function isCurrent() {
    if (!admission || authority.current !== admission || focusToken.current !== admission.token)
      return false;
    try {
      assertHealthDataWriteLease(admission.lease);
      return true;
    } catch {
      return false;
    }
  }
  const consentChecked =
    privacyState === 'ready' &&
    admission !== null &&
    currentLease?.generation === admission.lease.generation;
  if (!consentChecked) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="clay" className="text-center">
            Privacy check
          </Text>
          <Text variant="title" className="mt-2 text-center">
            {privacyState === 'checking'
              ? 'Checking your privacy choice'
              : privacyState === 'restart'
                ? 'Start your quiz again'
                : 'Your privacy choice could not be confirmed'}
          </Text>
          <Text variant="body" tone="muted" className="mt-3 text-center">
            {privacyState === 'checking'
              ? 'One moment while we confirm the quiz can start.'
              : privacyState === 'restart'
                ? 'We cannot verify who started this draft. Start a new quiz to clear the previous answers and choose your goals again.'
                : 'Return to privacy before answering the quiz.'}
          </Text>
          {privacyState === 'restart' ? (
            <Button
              label="Start a new quiz"
              className="mt-6"
              onPress={() => {
                if (!isCurrent()) return;
                authority.current = null;
                reset();
                router.replace('/onboarding/goals');
              }}
            />
          ) : privacyState !== 'checking' ? (
            <Button
              label="Return to privacy"
              className="mt-6"
              onPress={() => router.replace('/onboarding/consent')}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  const total = ONBOARDING_QUIZ.length;
  const question = ONBOARDING_QUIZ[index]!;
  const current = quizAnswers[question.id];
  const isMulti = question.multiSelect === true;
  const answered = isQuizQuestionAnswered(question, current);

  function canAnswer() {
    return isCurrent() && navigationIndex.current === index;
  }

  function selectSingle(optionId: string) {
    if (!canAnswer()) return;
    latestAnswers.current = { ...latestAnswers.current, [question.id]: optionId };
    setAnswer(question.id, optionId);
    track('quiz_question_answered', { count: index + 1, type: 'single' });
  }

  function toggleMulti(optionId: string) {
    if (!canAnswer()) return;
    const value = latestAnswers.current[question.id];
    const prev = Array.isArray(value) ? value : [];
    const nextSelection = toggleExclusiveNoneSelection(prev, optionId);
    latestAnswers.current = { ...latestAnswers.current, [question.id]: nextSelection };
    setAnswer(question.id, nextSelection);
  }

  function next() {
    if (!canAnswer()) return;
    const nextIndex = quizNavigation16(
      navigationIndex.current,
      index,
      total,
      isQuizQuestionAnswered(question, latestAnswers.current[question.id]),
      'next',
    );
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
              if (!canAnswer()) return;
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
