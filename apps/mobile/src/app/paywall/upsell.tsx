import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { UPSELL_COPY } from '@/features/subscription/copy';
import { monthlyEquivalent, PLANS } from '@/features/subscription/plans';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';
import type { GatedFeature } from '@onskin/types';

// Contextual upsell (design 04, docs/08 §3.2). A dimmed bottom sheet framed around
// the gated feature, same compliance elements, dismissible. Reached when a free /
// expired-reverse-trial user taps a Pro action mid-flow.
export default function UpsellSheet() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { startTrial } = useEntitlementActions();
  const key = (feature as GatedFeature) in UPSELL_COPY ? (feature as GatedFeature) : 'full_routine';
  const copy = UPSELL_COPY[key];
  const annual = PLANS.annual;

  useEffect(() => {
    track('contextual_paywall_shown', { feature: key });
  }, [key]);

  return (
    <Sheet>
      <View className="mb-4 h-[52px] w-[52px] items-center justify-center rounded-[14px]" style={{ backgroundColor: colors.clayTint }}>
        <View className="h-4 w-4 rounded-[5px]" style={{ backgroundColor: colors.clay }} />
      </View>
      <Text variant="title" style={{ fontSize: 30, lineHeight: 34 }}>
        {copy.title}
      </Text>
      <Text variant="body" tone="muted" className="mt-3" style={{ lineHeight: 24 }}>
        {copy.body}
      </Text>
      <View
        className="mt-5 flex-row items-center justify-between rounded-card bg-paper-raised p-4"
        style={{ borderWidth: 1, borderColor: colors.hairline }}>
        <View>
          <Text variant="bodySm" tone="muted">
            Start {annual.trialDays} days free, then
          </Text>
          <Text variant="title" style={{ fontSize: 26, lineHeight: 30 }}>
            {annual.priceLabel}
            <Text variant="bodySm" tone="muted">
              /year
            </Text>
          </Text>
        </View>
        <Text variant="label" tone="muted">{`${monthlyEquivalent(annual.priceLabel)}\n/mo`}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => startTrial.mutate(undefined, { onSettled: () => router.replace('/paywall/success') })}
        className="mt-4 h-[54px] items-center justify-center rounded-pill"
        style={{ backgroundColor: colors.clay }}>
        <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
          Start free trial
        </Text>
      </Pressable>
      <ComplianceRow />
      <Pressable accessibilityRole="button" onPress={() => router.back()} className="h-[40px] items-center justify-center">
        <Text className="font-sans-semibold" tone="muted" variant="body">
          Maybe later
        </Text>
      </Pressable>
    </Sheet>
  );
}
