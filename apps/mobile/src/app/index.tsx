import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';

// Design-system showcase / welcome placeholder. The real welcome + onboarding
// flow (with the anonymous session) is built in the onboarding slice.
export default function Index() {
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="display">
          Healthier skin in eight weeks, built around{' '}
          <Text variant="display" italic tone="clay">
            your
          </Text>{' '}
          skin.
        </Text>
        <Text variant="body" tone="muted" className="mt-4">
          A routine that fits what&apos;s already on your shelf — and photos that never leave your
          phone.
        </Text>
      </View>
      <View className="pb-4">
        <Button label="Begin" />
        <Text variant="label" tone="muted" className="mt-5 text-center">
          No ads · no data sales · photos stay on device
        </Text>
      </View>
    </Screen>
  );
}
