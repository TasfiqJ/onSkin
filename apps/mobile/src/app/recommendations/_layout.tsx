import { Stack } from 'expo-router';

// Personalized recommendations surfaces (docs/09 §7), presented over the tabs.
// The "For you" hub, the what/why/how card, and the preferences screen. Calm,
// contextual, never a storefront.
export default function RecommendationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
