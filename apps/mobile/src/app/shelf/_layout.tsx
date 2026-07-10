import { Stack } from 'expo-router';

import { IntakeProvider } from '@/features/shelf/IntakeContext';

// Shelf intake + management stack (docs/04), presented over the tabs. The intake
// draft (manual / OCR / no-match → opened-date) is shared via IntakeProvider.
// The linchpin, no-match fork, and replenishment are dimmed bottom sheets.
export default function ShelfLayout() {
  return (
    <IntakeProvider>
      <Stack screenOptions={{ headerShown: false }}>
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
    </IntakeProvider>
  );
}
