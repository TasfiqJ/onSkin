import { Stack } from 'expo-router';

import {
  shouldReduceMotion,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';

// Paywall / subscription-lifecycle surfaces (docs/08), presented over the tabs.
// The contextual upsell is a dimmed bottom sheet; the rest are full screens.
export default function PaywallLayout() {
  const reduceMotion = useReduceMotionPreference();
  const modalAnimation = shouldReduceMotion(reduceMotion) ? 'none' : 'fade';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="success" />
      <Stack.Screen name="reoffer" />
      <Stack.Screen name="downgrade" />
      <Stack.Screen name="winback" />
      <Stack.Screen
        name="upsell"
        options={{ presentation: 'transparentModal', animation: modalAnimation }}
      />
    </Stack>
  );
}
