import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { trackProductAddStarted } from '@/features/shelf/analytics';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { isSafeOpaqueId, sanitizeAttribution } from '@/lib/growth/attribution';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PublicShareLinkScreen() {
  const params = useLocalSearchParams<{
    shareId?: string | string[];
    source?: string | string[];
    medium?: string | string[];
    campaign?: string | string[];
    content?: string | string[];
    creative_variant?: string | string[];
    platform?: string | string[];
    app_version?: string | string[];
    build_number?: string | string[];
  }>();
  const rawShareId = firstParam(params.shareId);
  const safeShareId = rawShareId && isSafeOpaqueId(rawShareId) ? rawShareId : null;
  const attribution = useMemo(
    () =>
      sanitizeAttribution({
        source: firstParam(params.source),
        medium: firstParam(params.medium),
        campaign: firstParam(params.campaign),
        content: firstParam(params.content),
        creative_variant: firstParam(params.creative_variant),
        platform: firstParam(params.platform),
        app_version: firstParam(params.app_version),
        build_number: firstParam(params.build_number),
        share_id: safeShareId,
      }),
    [
      params.source,
      params.medium,
      params.campaign,
      params.content,
      params.creative_variant,
      params.platform,
      params.app_version,
      params.build_number,
      safeShareId,
    ],
  );

  useEffect(() => {
    const landingProps = safeShareId
      ? { ...attribution, share_id: safeShareId }
      : { reason: 'invalid_share_id' };
    track('landing_viewed', landingProps);
    track('share_link_opened', landingProps);
  }, [attribution, safeShareId]);

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
          <Button
            label="Scan a product"
            onPress={() => {
              trackProductAddStarted('share_scan');
              router.replace('/shelf/scan');
            }}
          />
          <Button
            label="Add manually"
            variant="ghost"
            onPress={() => {
              trackProductAddStarted('share_manual');
              router.replace('/shelf/manual');
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
