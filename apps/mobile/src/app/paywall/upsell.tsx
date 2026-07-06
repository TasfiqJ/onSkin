import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { UPSELL_COPY } from '@/features/subscription/copy';
import { dismissPaywall } from '@/features/subscription/dismissPaywall';
import { planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';
import type { GatedFeature } from '@onskin/types';

// Contextual upsell (design 04, docs/08 §3.2). A dimmed bottom sheet framed around
// the gated feature, same compliance elements, dismissible. Reached when a free /
// expired-reverse-trial user taps a Pro action mid-flow.
export default function UpsellSheet() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const key = (feature as GatedFeature) in UPSELL_COPY ? (feature as GatedFeature) : 'full_routine';
  const copy = UPSELL_COPY[key];
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);

  function onStartTrial() {
    if (!canPurchase) {
      Alert.alert('Store pricing unavailable', offering.data?.reason ?? 'Please try again later.');
      return;
    }
    startTrial.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (!result.cancelled)
          Alert.alert('Purchase not active', 'No active subscription was found for this account.');
      },
      onError: () =>
        Alert.alert(
          'Purchase unavailable',
          'We could not open the store purchase sheet. Please try again.',
        ),
    });
  }

  useEffect(() => {
    track('contextual_paywall_shown', { feature: key });
  }, [key]);

  return (
    <Sheet onClose={() => dismissPaywall(router)}>
      <View
        className="mb-4 h-[52px] w-[52px] items-center justify-center rounded-[14px]"
        style={{ backgroundColor: colors.clayTint }}
      >
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
        style={{ borderWidth: 1, borderColor: colors.hairline }}
      >
        <View>
          <Text variant="bodySm" tone="muted">
            {annualDisplay.introLabel}
          </Text>
          <Text variant="title" style={{ fontSize: 26, lineHeight: 30 }}>
            {annualDisplay.priceLabel}
            {annualDisplay.periodLabel ? (
              <Text variant="bodySm" tone="muted">
                /{annualDisplay.periodLabel}
              </Text>
            ) : null}
          </Text>
        </View>
        {annualDisplay.pricePerMonthLabel ? (
          <Text variant="label" tone="muted">{`${annualDisplay.pricePerMonthLabel}\n/mo`}</Text>
        ) : null}
      </View>
      {offering.data?.status && offering.data.status !== 'available' ? (
        <Text
          variant="label"
          tone="muted"
          className="mt-2 text-center"
          style={{ fontSize: 11.5, lineHeight: 16 }}
        >
          {offering.data.reason}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!canPurchase || startTrial.isPending}
        onPress={onStartTrial}
        className="mt-4 h-[54px] items-center justify-center rounded-pill"
        style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}
      >
        <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
          Start free trial
        </Text>
      </Pressable>
      <ComplianceRow />
      <Pressable
        accessibilityRole="button"
        onPress={() => dismissPaywall(router)}
        className="h-[40px] items-center justify-center"
      >
        <Text className="font-sans-semibold" tone="muted" variant="body">
          Maybe later
        </Text>
      </Pressable>
    </Sheet>
  );
}
