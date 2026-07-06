import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { isSafeOpaqueId } from '@/lib/growth/attribution';

export default function PublicShareLinkScreen() {
  const { shareId } = useLocalSearchParams<{ shareId?: string }>();
  const safeShareId = shareId && isSafeOpaqueId(shareId) ? shareId : null;

  useEffect(() => {
    track(
      'share_link_opened',
      safeShareId ? { share_id: safeShareId } : { reason: 'invalid_share_id' },
    );
  }, [safeShareId]);

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
