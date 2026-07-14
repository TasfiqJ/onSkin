import { Stack, usePathname } from 'expo-router';

import { ShelfDataAvailabilityGate } from '@/features/shelf/ShelfDataAvailabilityGate';
import { ProGate } from '@/features/subscription/ProGate';
import { routineGateFeatureForPath } from '@/features/subscription/gatedRoutes';

// Routine-builder screens (docs/03): plan-built, sequencing/reorder, ramp,
// tolerance, adaptation, widgets. Presented over the tabs.
// The unavailable widgets route bypasses the Pro paywall so direct entries see
// the truthful deferred surface instead of an upgrade solicitation.
export default function RoutineLayout() {
  const pathname = usePathname();
  const gateFeature = routineGateFeatureForPath(pathname);
  const stack = <Stack screenLayout={RoutineScreenLayout} screenOptions={{ headerShown: false }} />;

  if (!gateFeature) return stack;

  return <ProGate feature={gateFeature}>{stack}</ProGate>;
}

const ROUTES_REQUIRING_SHELF_DATA = new Set(['plan', 'reorder', 'adaptation', 'ramp', 'tolerance']);

function RoutineScreenLayout({
  children,
  route,
}: {
  children: React.ReactNode;
  route: { name: string };
}) {
  if (!ROUTES_REQUIRING_SHELF_DATA.has(route.name)) return <>{children}</>;

  return <ShelfDataAvailabilityGate>{children}</ShelfDataAvailabilityGate>;
}
