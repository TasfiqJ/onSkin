import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';

// Barcode scan & add-to-shelf (design spec, docs/02 §7.5). The on-device camera
// scan → Open Beauty Facts lookup (one call/scan) → parsed actives → "opened
// when?" → shelf, with search / OCR / manual fallbacks and ODbL contribute-back,
// is the next slice. It needs the live OBF API + the catalog seed.
// BLOCKED: B-CATALOG-SEED (+ camera capture, shared with the photo slice).
export default function ScanScreen() {
  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text variant="title">Add a product</Text>
        <Card className="mt-6">
          <Text variant="bodySm" tone="muted">
            Barcode scanning (camera → Open Beauty Facts), with search, ingredient-list OCR, and
            manual entry fallbacks, is the next build slice. Scanning happens on your device.
          </Text>
        </Card>
      </View>
      <View className="pb-4">
        <Button label="Back to shelf" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
