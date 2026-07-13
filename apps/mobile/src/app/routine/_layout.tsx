import { Stack, usePathname } from 'expo-router';

import { ProGate } from '@/features/subscription/ProGate';
import { routineGateFeatureForPath } from '@/features/subscription/gatedRoutes';

// Routine-builder screens (docs/03): plan-built, sequencing/reorder, ramp,
// tolerance, adaptation, widgets. Presented over the tabs.
// The unavailable widgets route bypasses the Pro paywall so direct entries see
// the truthful deferred surface instead of an upgrade solicitation.
export default function RoutineLayout() {
  const pathname = usePathname();
  const gateFeature = routineGateFeatureForPath(pathname);
  const stack = <Stack screenOptions={{ headerShown: false }} />;

  if (!gateFeature) return stack;

  return <ProGate feature={gateFeature}>{stack}</ProGate>;
}
