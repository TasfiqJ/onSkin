import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <>
      {/* Horizontal slide reinforces sequential progress (docs/01 §8). */}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </>
  );
}
