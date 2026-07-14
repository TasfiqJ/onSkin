import { router, Stack } from 'expo-router';

import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

function ShelfScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShelfDataAvailabilityGate
      onExit={() => backOrReplace(router, APP_SHELF_ROUTE)}
      exitLabel="Back to Shelf"
    >
      {children}
    </ShelfDataAvailabilityGate>
  );
}

// Shelf intake + management stack (docs/04), presented over the tabs. The root
// IntakeProvider keeps one transient draft across onboarding and Shelf routes.
export default function ShelfLayout() {
  return (
    <Stack screenLayout={ShelfScreenLayout} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="scan" />
      <Stack.Screen name="search" />
      <Stack.Screen name="manual" />
      <Stack.Screen name="ocr" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="archive" />
      <Stack.Screen
        name="no-match"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="opened"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="replenish"
        options={{ presentation: 'transparentModal', animation: 'fade' }}
      />
    </Stack>
  );
}
