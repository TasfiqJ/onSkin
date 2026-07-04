import { Stack } from 'expo-router';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { phase7Flags } from '@/lib/launch/phase7';

// Ask OnSkin route group (docs/13). A plain stack. The chat home + the privacy gate.
export default function AskLayout() {
  if (!phase7Flags.cloudAsk) return <DeferredSurface surface="cloudAsk" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
