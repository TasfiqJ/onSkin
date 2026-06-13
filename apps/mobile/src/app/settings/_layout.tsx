import { Stack } from 'expo-router';

// Settings surfaces presented over the tabs (docs/07): the tiered notification hub
// and the timing / quiet-hours / discretion screen.
export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="notifications" />
      <Stack.Screen name="timing" />
    </Stack>
  );
}
