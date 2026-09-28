import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { deferredSurfaceCopy, type DeferredSurfaceKind } from '@/lib/launch/phase7';
import { backOrReplace, type AppFallbackRoute } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

export function DeferredSurface({
  surface,
  fallbackRoute,
  fallbackLabel,
  trackView = true,
  replaceFallback = false,
}: {
  surface: DeferredSurfaceKind;
  fallbackRoute?: AppFallbackRoute;
  fallbackLabel?: string;
  trackView?: boolean;
  replaceFallback?: boolean;
}) {
  const copy = deferredSurfaceCopy[surface];

  useEffect(() => {
    if (!trackView) return;
    track('phase7_deferred_surface_viewed', { surface });
  }, [surface, trackView]);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow justify-center pb-6 pt-4"
      >
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
      </ScrollView>
      <View className="pb-3 pt-2">
        <Button
          label={fallbackLabel ?? copy.cta}
          variant="ghost"
          className="mb-6"
          onPress={() =>
            replaceFallback && fallbackRoute
              ? router.replace(fallbackRoute)
              : backOrReplace(router, fallbackRoute)
          }
        />
      </View>
    </Screen>
  );
}
