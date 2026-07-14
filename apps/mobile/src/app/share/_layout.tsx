import { router, Stack } from 'expo-router';

import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { APP_SHELF_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

function ShareScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShelfDataAvailabilityGate
      onExit={() => backOrReplace(router, APP_SHELF_ROUTE)}
      exitLabel="Back to Shelf"
    >
      {children}
    </ShelfDataAvailabilityGate>
  );
}

export default function ShareLayout() {
  return <Stack screenLayout={ShareScreenLayout} screenOptions={{ headerShown: false }} />;
}
