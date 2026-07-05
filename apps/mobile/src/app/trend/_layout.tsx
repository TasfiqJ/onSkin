import { Stack } from 'expo-router';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { phase7Flags } from '@/lib/launch/phase7';
import { APP_PROGRESS_ROUTE } from '@/lib/navigation/safeBack';

// "Changes in your own photos" surfaces (docs/12 §5). The off-by-default opt-in and
// the fairness floor, presented over the tabs. The refusal (docs/06) is preserved and
// remains the default; this is the optional, on-device, no-number opt-in.
export default function TrendLayout() {
  if (!phase7Flags.trend)
    return <DeferredSurface surface="trend" fallbackRoute={APP_PROGRESS_ROUTE} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="optin" />
      <Stack.Screen name="fairness" />
    </Stack>
  );
}
