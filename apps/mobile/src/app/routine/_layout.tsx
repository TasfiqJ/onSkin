import { Stack } from 'expo-router';

// Routine-builder screens (docs/03): plan-built, sequencing/reorder, ramp,
// tolerance, adaptation, widgets. Presented over the tabs.
export default function RoutineLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
