import type { SkinAxis } from '@onskin/types';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { AXIS_LABELS, getQuizCompletionState } from '@/features/onboarding/quiz';
import { recordFirstUsefulInsightAnalytics } from '@/features/routine/activationAnalytics';
import { routineFirstInsightCopy, routineInsightCount } from '@/features/routine/firstInsight';
import { usePlan } from '@/features/routine/usePlan';
import { track } from '@/lib/analytics/track';

// 07b · Reveal. The "aha" payoff (docs/01 §2/§8, design spec p.6). Shows the
// computed 4-axis profile as sliders. The poetic headline + routine prose on the
// spec are final product/health copy (BLOCKED: B-QUIZ-COPY). Here we show the
// factual axis descriptor and claim-safe draft routine framing.
const AXIS_ORDER: SkinAxis[] = [
  'oily_dry',
  'sensitive_resistant',
  'pigmented_non',
  'wrinkled_tight',
];

function AxisSlider({ axis, value }: { axis: SkinAxis; value: number }) {
  const { posLabel, negLabel } = AXIS_LABELS[axis];
  const leansPositive = value >= 0.5;
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row justify-between">
        <Text
          variant="bodySm"
          tone={leansPositive ? 'muted' : 'ink'}
          className={leansPositive ? '' : 'font-sans-semibold'}
        >
          {negLabel}
        </Text>
        <Text
          variant="bodySm"
          tone={leansPositive ? 'ink' : 'muted'}
          className={leansPositive ? 'font-sans-semibold' : ''}
        >
          {posLabel}
        </Text>
      </View>
      <View className="h-1.5 rounded-pill bg-greige-deep">
        <View
          className="absolute -top-1 h-3.5 w-3.5 rounded-full bg-clay"
          style={{ left: `${Math.round(value * 100)}%`, marginLeft: -7 }}
        />
      </View>
    </View>
  );
}

export default function RevealScreen() {
  const { computeResult, quizAnswers } = useOnboarding();
  const planResult = usePlan();
  const trackedRevealInsight = useRef(false);
  const quizCompletion = useMemo(() => getQuizCompletionState(quizAnswers), [quizAnswers]);
  const result = useMemo(
    () => (quizCompletion.complete ? computeResult() : null),
    [computeResult, quizCompletion.complete],
  );
  const firstInsight = planResult.data
    ? routineFirstInsightCopy(planResult.data.plan, planResult.data.isExample)
    : null;

  const descriptor = useMemo(() => {
    if (!result) return '';
    const traits = AXIS_ORDER.map((axis) => {
      const { posLabel, negLabel } = AXIS_LABELS[axis];
      return result.axes[axis] >= 0.5 ? posLabel : negLabel;
    });
    return traits.join(' · ');
  }, [result]);

  useEffect(() => {
    if (!result || !planResult.data || trackedRevealInsight.current) return;

    trackedRevealInsight.current = true;
    void recordFirstUsefulInsightAnalytics({
      insightCount: routineInsightCount(planResult.data.plan),
      isExample: planResult.data.isExample,
      source: 'reveal',
    });
  }, [planResult.data, result]);

  if (!result) {
    return (
      <Screen tone="night">
        <View className="flex-1 justify-center">
          <Text variant="eyebrow" tone="inverseMuted">
            PROFILE PAUSED
          </Text>
          <Text variant="title" tone="inverse" className="mt-2">
            Finish the quiz to see your profile.
          </Text>
          <Text variant="body" tone="inverseMuted" className="mt-3">
            Your reveal needs the quiz answers first, so the result reflects your skin.
          </Text>
        </View>
        <View className="pb-4">
          <Button
            label="Back to quiz"
            variant="inverse"
            onPress={() => router.replace('/onboarding/quiz')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen tone="night">
      <View className="flex-1 justify-center">
        <Text variant="eyebrow" tone="inverseMuted">
          YOUR SKIN PROFILE
        </Text>
        <Text variant="title" tone="inverse" className="mt-2">
          {descriptor}.
        </Text>
        <Text variant="label" tone="inverseMuted" className="mt-1">
          Type {result.dspt}
        </Text>

        <View className="mt-8">
          {AXIS_ORDER.map((axis) => (
            <AxisSlider key={axis} axis={axis} value={result.axes[axis]} />
          ))}
        </View>

        <Card tone="night" className="mt-4">
          <Text variant="label" tone="inverseMuted" className="font-mono">
            {(planResult.isError
              ? 'Routine preview unavailable'
              : (firstInsight?.eyebrow ?? 'Routine preview')
            ).toUpperCase()}
          </Text>
          <Text variant="body" tone="inverse" className="mt-1 font-sans-semibold">
            {planResult.isError
              ? 'Your saved products could not be read safely.'
              : planResult.isLoading
                ? 'Building your routine preview.'
                : (firstInsight?.title ?? 'Your routine preview is ready after setup.')}
          </Text>
          <Text variant="bodySm" tone="inverseMuted" className="mt-1">
            {planResult.isError
              ? 'Nothing was reset or removed. Shelf-based guidance is paused until OnSkin can read it again.'
              : planResult.isLoading
                ? 'Checking your Shelf and profile without changing them.'
                : (firstInsight?.body ??
                  'Your full plan and conflict checks are ready after this setup step.')}
          </Text>
          {planResult.isError ? (
            <Pressable
              accessibilityLabel="Retry routine preview"
              accessibilityRole="button"
              accessibilityState={{ disabled: planResult.isFetching }}
              disabled={planResult.isFetching}
              onPress={() => void planResult.retry()}
              className="mt-3 min-h-[48px] items-center justify-center rounded-pill border border-paper/20 px-4 py-2.5"
              style={{ opacity: planResult.isFetching ? 0.68 : 1 }}
            >
              <Text variant="bodySm" tone="inverse" className="font-sans-semibold">
                {planResult.isFetching ? 'Trying again...' : 'Try preview again'}
              </Text>
            </Pressable>
          ) : null}
        </Card>
      </View>
      <View className="pb-4">
        <Button
          label="Continue"
          variant="inverse"
          onPress={() => {
            track('screen_viewed', { screen_name: 'reveal' });
            router.push('/onboarding/notifications');
          }}
        />
      </View>
    </Screen>
  );
}
