import { router, Stack } from 'expo-router';

import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

function AskScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShelfDataAvailabilityGate
      onExit={() => backOrReplace(router, APP_HOME_ROUTE)}
      exitLabel="Back to Today"
    >
      {children}
    </ShelfDataAvailabilityGate>
  );
}

// Ask route group (docs/13). The deterministic chat home must stay reachable
// even while the deeper cloud Ask layer remains deferred.
export default function AskLayout() {
  return <Stack screenLayout={AskScreenLayout} screenOptions={{ headerShown: false }} />;
}
