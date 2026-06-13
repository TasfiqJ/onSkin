import { Text, View } from 'react-native';

// Placeholder baseline screen — the real welcome / onboarding flow is built in
// the onboarding slice. Kept minimal so the scaffold typechecks and renders.
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <Text className="font-serif text-6xl text-ink">OnSkin</Text>
      <Text className="mt-3 text-center text-base text-muted">
        Healthier skin in eight weeks, built around your skin.
      </Text>
    </View>
  );
}
