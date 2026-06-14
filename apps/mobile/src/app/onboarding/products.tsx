import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';

// 06 · Current products intake. Barcode scan / search / skip, with skip clearly
// visible (docs/01 §2). The actual barcode-scan + catalog-search UI is the Shelf
// slice (build-order #4, needs Document 4); here the path is navigable with skip
// primary so onboarding completes.
export default function ProductsScreen() {
  function go() {
    track('screen_viewed', { screen_name: 'products_intake' });
    router.push('/onboarding/analyzing');
  }

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="title">What&apos;s on your shelf?</Text>
        <Text variant="body" tone="muted" className="mt-3">
          Add the products you already use so we can build around them. Or skip and add them later
          from your shelf.
        </Text>
        <Card className="mt-7">
          <Text variant="bodySm" tone="muted">
            Barcode scanning and product search live on your Shelf. {/* BLOCKED: needs Document 4 */}
            You can add everything there anytime.
          </Text>
        </Card>
      </View>
      <View className="pb-4">
        <Button label="Skip for now" onPress={go} />
      </View>
    </Screen>
  );
}
