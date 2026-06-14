import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// 07a · Personalization theater. "Analyzing your skin profile…" (docs/01 §2/§8).
// Uses a lightweight RN Animated pulse as a PLACEHOLDER for the recommended Rive
// hero (BLOCKED: B-VERIFY-RIVE-LOTTIE). Persists the skin profile, then reveals.
export default function AnalyzingScreen() {
  const { persistSkinProfile } = useOnboarding();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    track('personalization_shown');
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();

    // Persist (best-effort) while the theater plays, then reveal after ~2.6s.
    void persistSkinProfile().catch(() => {});
    const t = setTimeout(() => router.replace('/onboarding/reveal'), 2600);
    return () => {
      loop.stop();
      clearTimeout(t);
    };
  }, [persistSkinProfile, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <Animated.View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.clayBright,
            transform: [{ scale }],
            opacity,
          }}
        />
        <Text variant="title" className="mt-12 text-center">
          Building your plan…
        </Text>
        <Text variant="body" tone="muted" className="mt-2 text-center">
          Reading your answers and shaping a routine around your skin.
        </Text>
      </View>
    </Screen>
  );
}
