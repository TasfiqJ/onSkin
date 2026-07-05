import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { deferredSurfaceCopy, type DeferredSurfaceKind } from '@/lib/launch/phase7';
import { backOrReplace, type AppFallbackRoute } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

export function DeferredSurface({
  surface,
  fallbackRoute,
}: {
  surface: DeferredSurfaceKind;
  fallbackRoute?: AppFallbackRoute;
}) {
  const copy = deferredSurfaceCopy[surface];

  useEffect(() => {
    track('phase7_deferred_surface_viewed', { surface });
  }, [surface]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 justify-center">
        <View
          className="mb-6 h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.clayTint }}
        >
          <Text variant="label" tone="clay">
            BETA
          </Text>
        </View>
        <Text variant="title" className="text-[34px] leading-[37px]">
          {copy.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-4" style={{ lineHeight: 24 }}>
          {copy.body}
        </Text>
        <View
          className="mt-5 rounded-card bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <Text variant="bodySm" tone="muted" style={{ lineHeight: 20 }}>
            {copy.detail}
          </Text>
        </View>
      </View>
      <Button
        label={copy.cta}
        variant="ghost"
        onPress={() => backOrReplace(router, fallbackRoute)}
      />
    </Screen>
  );
}
