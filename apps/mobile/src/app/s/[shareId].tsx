import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { APP_SHELF_ROUTE } from '@/lib/navigation/safeBack';

// Every path value receives the same product-free recovery. This route does not
// read or validate the path value and therefore cannot imply that a valid-looking
// value maps to a public record.
export default function PublicShareLinkScreen() {
  return (
    <Screen>
      <View className="flex-1 justify-center gap-6">
        <View>
          <Text variant="title">Public sharing is unavailable.</Text>
          <Text variant="body" tone="muted" className="mt-3">
            This address does not load another person&apos;s products, profile, or shelf details.
            You can start a private check with products you add yourself.
          </Text>
        </View>
        <View className="gap-3">
          <Button label="Go to Shelf" onPress={() => router.replace(APP_SHELF_ROUTE)} />
          <Button
            label="Add a product"
            variant="ghost"
            onPress={() => router.replace('/shelf/manual')}
          />
        </View>
      </View>
    </Screen>
  );
}
