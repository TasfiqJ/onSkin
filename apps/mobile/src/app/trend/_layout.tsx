import { Stack } from 'expo-router';

// Preserve exact stale/direct-entry URLs while PHOTO-05A admission is closed.
// Each child owns its analytics-free unavailable surface so the layout never
// canonicalizes one route into the other.
export default function TrendLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="optin" />
      <Stack.Screen name="fairness" />
    </Stack>
  );
}
