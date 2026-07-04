import { Stack } from 'expo-router';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { phase7Flags } from '@/lib/launch/phase7';

// Commerce surfaces (docs/10 §3/§4/§7). Presented over the tabs. The consent gate is
// a dimmed bottom sheet; the transparency page + stacks are normal pushed screens.
export default function CommerceLayout() {
  if (!phase7Flags.commerce) return <DeferredSurface surface="commerce" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="transparency" />
      <Stack.Screen name="stacks" />
      <Stack.Screen name="stack/[slug]" />
      <Stack.Screen name="consent" options={{ presentation: 'transparentModal', animation: 'fade' }} />
    </Stack>
  );
}
