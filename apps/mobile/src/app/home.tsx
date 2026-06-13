import { View } from 'react-native';

import { Screen, Text } from '@/components/ui';

// Temporary post-onboarding destination. Replaced by the Today/Progress/Shelf/You
// tab bar in the Today slice (build-order #3+). Kept so the onboarding flow has a
// real endpoint and routes resolve.
export default function Home() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <Text variant="title" className="text-center">
          You&apos;re all set.
        </Text>
        <Text variant="body" tone="muted" className="mt-3 text-center">
          Your Today screen, routine, shelf and progress timeline arrive in the next build slices.
        </Text>
      </View>
    </Screen>
  );
}
