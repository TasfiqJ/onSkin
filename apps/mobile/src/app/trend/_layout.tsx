import { Stack } from 'expo-router';

import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_PROGRESS_ROUTE } from '@/lib/navigation/safeBack';

function TrendScreenGate({ children: _children }: { children: React.ReactElement }) {
  return (
    <DeferredSurface
      surface="trend"
      fallbackRoute={APP_PROGRESS_ROUTE}
      fallbackLabel="Back to Progress"
      fallbackBehavior="replace"
      trackView={false}
    />
  );
}

// Preserve exact stale/direct-entry URLs while withholding the matched child before
// any private hook can mount. Each child also fails closed when rendered in isolation.
export default function TrendLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      screenLayout={({ children }) => <TrendScreenGate>{children}</TrendScreenGate>}
    >
      <Stack.Screen name="optin" />
      <Stack.Screen name="fairness" />
    </Stack>
  );
}
