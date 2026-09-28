import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

function devProfileSaveFailureMode(): 'once' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return process.env.EXPO_PUBLIC_E2E_PROFILE_SAVE_FAILURE === 'once' ? 'once' : null;
}

export default function AnalyzingScreen() {
  const { goals, persistSkinProfile, profileResult, quizAnswers } = useOnboarding();
  const quizCompletion = getQuizCompletionState(quizAnswers);
  const hasProfileResult = profileResult !== null || quizCompletion.complete;
  const [pulse] = useState(() => new Animated.Value(0));
  const [saveError, setSaveError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const simulatedProfileSaveFailureUsed = useRef(false);
  const profileSaveFailureMode = devProfileSaveFailureMode();
  const useNativeAnimationDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (!hasProfileResult) {
      router.replace('/onboarding/quiz');
      return;
    }
    if (goals.length === 0) {
      router.replace('/onboarding/goals');
      return;
    }

    track('personalization_shown');
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNativeAnimationDriver,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNativeAnimationDriver,
        }),
      ]),
    );
    loop.start();

    let revealTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const profileSave = profileResult
      ? Promise.resolve(profileResult)
      : profileSaveFailureMode === 'once' && !simulatedProfileSaveFailureUsed.current
        ? (() => {
            simulatedProfileSaveFailureUsed.current = true;
            return Promise.reject(new Error('E2E_PROFILE_SAVE_FAILURE'));
          })()
        : persistSkinProfile();

    void profileSave
      .then(() => {
        if (cancelled) return;
        revealTimer = setTimeout(() => router.replace('/onboarding/reveal'), 2600);
      })
      .catch(() => {
        if (!cancelled) {
          loop.stop();
          setSaveError(true);
        }
      });

    return () => {
      cancelled = true;
      loop.stop();
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [
    goals.length,
    hasProfileResult,
    persistSkinProfile,
    profileResult,
    profileSaveFailureMode,
    pulse,
    retryKey,
    useNativeAnimationDriver,
  ]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.82] });

  if (saveError) {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <Text variant="title" className="text-center">
            We could not save your profile.
          </Text>
          <Text variant="body" tone="muted" className="mt-2 text-center">
            Try again. Your quiz answers are still here.
          </Text>
        </View>
        <View className="gap-2 pb-4">
          <Button
            label="Try again"
            onPress={() => {
              setSaveError(false);
              setRetryKey((value) => value + 1);
            }}
          />
          <Button
            label="Back to quiz"
            variant="ghost"
            onPress={() => router.replace('/onboarding/quiz')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-4">
        <View className="h-[148px] w-[148px] items-center justify-center rounded-full bg-clay-tint">
          <Animated.View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              borderWidth: 1,
              borderColor: 'rgba(165,105,75,0.28)',
              backgroundColor: colors.paperRaised,
              transform: [{ scale }],
              opacity,
            }}
          />
          <View
            className="absolute h-7 w-7 rounded-[9px]"
            style={{ backgroundColor: colors.clay }}
          />
        </View>
        <Text variant="eyebrow" tone="clay" className="mt-10 text-center">
          BUILDING YOUR PLAN
        </Text>
        <Text variant="title" className="mt-2 text-center">
          Turning your answers into something useful.
        </Text>
        <Text variant="body" tone="muted" className="mt-3 max-w-[310px] text-center">
          We&apos;re organizing your skin profile and the products you added into a simpler first
          routine.
        </Text>
      </View>
    </Screen>
  );
}
