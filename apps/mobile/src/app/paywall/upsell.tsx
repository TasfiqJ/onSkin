import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View, useWindowDimensions } from 'react-native';

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
  const { height, width } = useWindowDimensions();
  const { startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const key = (feature as GatedFeature) in UPSELL_COPY ? (feature as GatedFeature) : 'full_routine';
  const copy = UPSELL_COPY[key];
  const compactPaywall = height < 640;
  const longCompactTitle = compactPaywall && width < 420 && key === 'reminders_widgets';
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
    <Sheet
      scroll
      backdropAccessible={false}
      className={compactPaywall ? 'px-7 pb-8 pt-4' : undefined}
      onClose={() => dismissPaywall(router)}
    >
      <View
        className={
          compactPaywall
            ? 'mb-2 h-[48px] w-[48px] items-center justify-center rounded-[14px]'
            : 'mb-4 h-[52px] w-[52px] items-center justify-center rounded-[14px]'
        }
        style={{ backgroundColor: colors.clayTint }}
      >
        <View className="h-4 w-4 rounded-[5px]" style={{ backgroundColor: colors.clay }} />
      </View>
      <Text
        variant="title"
        style={{ fontSize: longCompactTitle ? 24 : 30, lineHeight: longCompactTitle ? 27 : 34 }}
      >
        {copy.title}
      </Text>
      <Text
        variant="body"
        tone="muted"
        className={compactPaywall ? 'mt-2' : 'mt-3'}
        style={{ lineHeight: compactPaywall ? 20 : 24 }}
      >
        {copy.body}
      </Text>
      <View
        className={
          compactPaywall
            ? 'mt-3 flex-row items-center justify-between rounded-card bg-paper-raised p-3'
            : 'mt-5 flex-row items-center justify-between rounded-card bg-paper-raised p-4'
        }
        style={{ borderWidth: 1, borderColor: colors.hairline }}
      >
        <View>
          <Text variant="bodySm" tone="muted">
            {annualDisplay.introLabel}
          </Text>
          <Text
            variant="title"
            style={{ fontSize: compactPaywall ? 24 : 26, lineHeight: compactPaywall ? 28 : 30 }}
          >
            {annualDisplay.priceLabel}
            {annualDisplay.periodLabel ? (
              <Text variant="bodySm" tone="muted">
                /{annualDisplay.periodLabel}
              </Text>
            ) : null}
          </Text>
        </View>
        {annualDisplay.pricePerMonthLabel ? (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.86}
            numberOfLines={1}
            variant="label"
            tone="muted"
            style={{ letterSpacing: 0, textAlign: 'right' }}
          >{`${annualDisplay.pricePerMonthLabel}/mo`}</Text>
        ) : null}
      </View>
      {offering.data?.status && offering.data.status !== 'available' ? (
        <Text
          variant="bodySm"
          tone="muted"
          className={compactPaywall ? 'mt-1.5 px-3 text-center' : 'mt-2 px-3 text-center'}
          style={{ fontSize: 12, lineHeight: compactPaywall ? 16 : 17 }}
        >
          {offering.data.reason}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!canPurchase || startTrial.isPending}
        onPress={onStartTrial}
        className={
          compactPaywall
            ? 'mt-2 h-[54px] items-center justify-center rounded-pill'
            : 'mt-4 h-[54px] items-center justify-center rounded-pill'
        }
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
        className="h-[48px] items-center justify-center"
      >
        <Text className="font-sans-semibold" tone="muted" variant="body">
          Maybe later
        </Text>
      </Pressable>
    </Sheet>
  );
}
