import { router, Stack } from 'expo-router';

import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

// Personalized recommendations surfaces (docs/09 §7), presented over the tabs.
// The "For you" hub, the what/why/how card, and the preferences screen. Calm,
// contextual, never a storefront.
function RecommendationsScreenLayout({
  children,
  route,
}: {
  children: React.ReactNode;
  route: { name: string };
}) {
  // Preference editing remains reachable because it does not make claims from
  // Shelf contents. Result and detail routes pause when Shelf state is unreadable.
  if (route.name === 'preferences') return <>{children}</>;

  return (
    <ShelfDataAvailabilityGate
      onExit={() => backOrReplace(router, APP_HOME_ROUTE)}
      exitLabel="Back to Today"
    >
      {children}
    </ShelfDataAvailabilityGate>
  );
}

export default function RecommendationsLayout() {
  return (
    <Stack screenLayout={RecommendationsScreenLayout} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
