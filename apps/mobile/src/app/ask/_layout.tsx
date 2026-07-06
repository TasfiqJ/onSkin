import { Stack } from 'expo-router';

// Ask route group (docs/13). The deterministic chat home must stay reachable
// even while the deeper cloud Ask layer remains deferred.
export default function AskLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
