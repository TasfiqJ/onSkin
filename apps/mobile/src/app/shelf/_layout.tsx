import { router, Stack } from 'expo-router';

import { ShelfDataAvailabilityBoundary } from '@/features/shelf/ShelfDataAvailabilityGate';
import {
  ShelfRouteSourcesProvider,
  useShelfRouteSources,
} from '@/features/shelf/ShelfRouteSources';
import {
  shouldReduceMotion,
  useReduceMotionPreference,
} from '@/lib/accessibility/useReduceMotionPreference';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

function ShelfScreenLayout({ children }: { children: React.ReactNode }) {
  const { shelf } = useShelfRouteSources();
  return (
    <ShelfDataAvailabilityBoundary
      query={shelf}
      onExit={() => backOrReplace(router, APP_SHELF_ROUTE)}
      exitLabel="Back to Shelf"
    >
      {children}
    </ShelfDataAvailabilityBoundary>
  );
}

// Shelf intake + management stack (docs/04), presented over the tabs. The root
// IntakeProvider keeps one transient draft across onboarding and Shelf routes.
export default function ShelfLayout() {
  const reduceMotion = useReduceMotionPreference();
  const modalAnimation = shouldReduceMotion(reduceMotion) ? 'none' : 'fade';
  return (
    <ShelfRouteSourcesProvider>
      <Stack
        screenLayout={(props) => <ShelfScreenLayout>{props.children}</ShelfScreenLayout>}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="scan" />
        <Stack.Screen name="search" />
        <Stack.Screen name="manual" />
        <Stack.Screen name="ocr" />
        <Stack.Screen name="[id]" />
        <Stack.Screen name="archive" />
        <Stack.Screen
          name="no-match"
          options={{ presentation: 'transparentModal', animation: modalAnimation }}
        />
        <Stack.Screen
          name="opened"
          options={{ presentation: 'transparentModal', animation: modalAnimation }}
        />
        <Stack.Screen
          name="replenish"
          options={{ presentation: 'transparentModal', animation: modalAnimation }}
        />
      </Stack>
    </ShelfRouteSourcesProvider>
  );
}
