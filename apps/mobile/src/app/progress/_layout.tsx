import { Stack } from 'expo-router';

// Photo-progress surfaces presented over the tabs (docs/06). Capture, review and
// single-photo detail are dark (the spec's capture palette); "about" (the no-AI-
// score stance) is light. The Progress TAB itself lives at (tabs)/progress.
export default function ProgressLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="capture" />
      <Stack.Screen name="review" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="about" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
