import { Stack } from 'expo-router';

// Actives & skin-cycling scheduler surfaces (docs/05 §6), presented over the tabs.
// The "why tonight?", disruption hub, and phased-intro are dimmed bottom sheets.
export default function CycleLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="week" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="procedure" />
      <Stack.Screen name="recovery" />
      <Stack.Screen name="why-tonight" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="disruption" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="phased-intro" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
