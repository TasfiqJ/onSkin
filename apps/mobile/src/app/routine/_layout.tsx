import { Stack, usePathname } from 'expo-router';

import { ProGate } from '@/features/subscription/ProGate';
import { routineGateFeatureForPath } from '@/features/subscription/gatedRoutes';

// Routine-builder screens (docs/03): plan-built, sequencing/reorder, ramp,
// tolerance, adaptation, widgets. Presented over the tabs.
// Full routine intelligence is Pro (docs/08 §2.2); streak/widgets use the
// reminders/widgets value-prop copy while builder and ramp routes use full_routine.
export default function RoutineLayout() {
  const pathname = usePathname();

  return (
    <ProGate feature={routineGateFeatureForPath(pathname)}>
      <Stack screenOptions={{ headerShown: false }} />
    </ProGate>
  );
}
