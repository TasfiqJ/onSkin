import { Stack } from 'expo-router';

import { CycleDataAvailabilityGate } from '@/features/scheduler/CycleDataAvailabilityGate';
import { ProGate } from '@/features/subscription/ProGate';

// Actives & skin-cycling scheduler surfaces (docs/05 §6), presented over the tabs.
// The "why tonight?", disruption hub, and phased-intro are dimmed bottom sheets.
// The full scheduler route group is a Pro value prop (docs/08 §2.2), so direct
// links into nested cycle screens must be gated as tightly as the week view.
export default function CycleLayout() {
  return (
    <ProGate feature="scheduler">
      <CycleDataAvailabilityGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="week" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="procedure" />
          <Stack.Screen name="recovery" />
          <Stack.Screen
            name="why-tonight"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="disruption"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="phased-intro"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
        </Stack>
      </CycleDataAvailabilityGate>
    </ProGate>
  );
}
