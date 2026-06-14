import { Stack } from 'expo-router';

// Ask OnSkin route group (docs/13). A plain stack — the chat home + the privacy gate.
export default function AskLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
