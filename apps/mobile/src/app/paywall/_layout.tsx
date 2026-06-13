import { Stack } from 'expo-router';

// Paywall / subscription-lifecycle surfaces (docs/08), presented over the tabs.
// The contextual upsell is a dimmed bottom sheet; the rest are full screens.
export default function PaywallLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="success" />
      <Stack.Screen name="reoffer" />
      <Stack.Screen name="downgrade" />
      <Stack.Screen name="winback" />
      <Stack.Screen name="upsell" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
