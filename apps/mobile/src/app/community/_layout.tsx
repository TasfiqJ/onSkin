import { Stack } from 'expo-router';

// Community / "Skin Notes" surfaces (docs/11 §9), presented over the tabs. A calm
// reference library. The hub + the myth-vs-evidence card (Phase 1, live); the
// anonymous ask + "people like you" are Phase-2 previews (peer posting deferred).
export default function CommunityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="note/[id]" />
      <Stack.Screen name="ask" />
      <Stack.Screen name="people-like-you" />
    </Stack>
  );
}
