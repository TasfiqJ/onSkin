import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { isSafeOpaqueId } from '@/lib/growth/attribution';
import { APP_SHELF_ROUTE } from '@/lib/navigation/safeBack';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PublicShareLinkScreen() {
  const params = useLocalSearchParams<{ shareId?: string | string[] }>();
  const rawShareId = firstParam(params.shareId);
  const hasValidShareId = Boolean(rawShareId && isSafeOpaqueId(rawShareId));

  if (!hasValidShareId) {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-6">
          <View>
            <Text variant="title">This shared link isn’t available.</Text>
            <Text variant="body" tone="muted" className="mt-3">
              You can still check products from your own shelf.
            </Text>
          </View>
          <Button label="Go to Shelf" onPress={() => router.replace(APP_SHELF_ROUTE)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-6">
        <View>
          <Text variant="label" tone="muted">
            SHELF CHECK
          </Text>
          <Text variant="title" className="mt-3">
            Check your own shelf.
          </Text>
          <Text variant="body" tone="muted" className="mt-3">
            Shared cards open to a fresh shelf check. {BRAND.appName} never puts product names,
            profile details, photos, or health context in public links.
          </Text>
        </View>
        <View className="gap-3">
          <Button label="Scan a product" onPress={() => router.replace('/shelf/scan')} />
          <Button
            label="Add manually"
            variant="ghost"
            onPress={() => router.replace('/shelf/manual')}
          />
        </View>
      </View>
    </Screen>
  );
}
