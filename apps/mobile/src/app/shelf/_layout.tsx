import { Redirect, Stack } from 'expo-router';

import {
  shouldReduceMotion,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';

// Shelf intake + management stack (docs/04), presented over the tabs. The root
// IntakeProvider keeps one transient draft across onboarding and Shelf routes.
export default function ShelfLayout() {
  const reduceMotion = useReduceMotionPreference();
  const modalAnimation = shouldReduceMotion(reduceMotion) ? 'none' : 'fade';
  return (
    <Stack
      screenLayout={({ route, children }) =>
        ['scan', 'search', 'catalog-recovery'].includes(route.name)
          ? <Redirect href="/shelf/manual" />
          : children
      }
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="scan" />
      <Stack.Screen name="search" />
      <Stack.Screen name="manual" />
      <Stack.Screen name="ocr" />
      <Stack.Screen name="catalog-recovery" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="archive" />
      <Stack.Screen
        name="no-match"
        options={{ presentation: 'transparentModal', animation: modalAnimation }}
      />
      <Stack.Screen
        name="opened"
        options={{ presentation: 'transparentModal', animation: modalAnimation }}
      />
      <Stack.Screen
        name="replenish"
        options={{ presentation: 'transparentModal', animation: modalAnimation }}
      />
    </Stack>
  );
}
