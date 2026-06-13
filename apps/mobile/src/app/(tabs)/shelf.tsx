import { View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';

// Shelf — products, PAO/expiry, calm evidence-graded conflict banners (design
// spec p.12/13). The user_products schema (incl. generated expiry_computed)
// exists, but the "smart shelf" (catalog search, barcode scan, conflict rules)
// is build-order #4 + the conflict matrix is BLOCKED: B-CONFLICT-RULES (Document 2).
export default function ShelfScreen() {
  return (
    <Screen edges={['top']}>
      <Text variant="title" className="mt-2">
        Shelf
      </Text>
      <View className="flex-1 justify-center">
        <Card>
          <Text variant="titleSm">Your products, with care</Text>
          <Text variant="bodySm" tone="muted" className="mt-2">
            PAO/expiry tracking, barcode scan, and calm conflict checks (always with an evidence
            grade and a non-alarmist resolution) are build-order #2 and #4. The conflict-rules data
            needs curation + review before it ships.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
