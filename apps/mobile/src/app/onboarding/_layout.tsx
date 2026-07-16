import { Stack } from 'expo-router';

import {
  shouldReduceMotion,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';

export default function OnboardingLayout() {
  const reduceMotion = useReduceMotionPreference();
  return (
    <>
      {/* Horizontal slide reinforces sequential progress (docs/01 §8). */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: shouldReduceMotion(reduceMotion) ? 'none' : 'slide_from_right',
        }}
      />
    </>
  );
}
