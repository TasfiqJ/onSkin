import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { UPSELL_COPY } from '@/features/subscription/copy';
import { dismissPaywall } from '@/features/subscription/dismissPaywall';
import {
  PAYWALL_FEEDBACK,
  PaywallFeedback,
  type PaywallFeedbackState,
} from '@/features/subscription/PaywallFeedback';
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
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const key = (feature as GatedFeature) in UPSELL_COPY ? (feature as GatedFeature) : 'full_routine';
  const copy = UPSELL_COPY[key];
  const compactPaywall = height < 640;
  const shortPaywall = height < 600;
  const longCompactTitle = compactPaywall && width < 420 && key === 'reminders_widgets';
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const splitShortPaywall = height < 410;

  function onStartTrial() {
    setActionFeedback(null);
    if (!canPurchase) {
      setActionFeedback(PAYWALL_FEEDBACK.storePricingUnavailable(offering.data?.reason));
      return;
    }
    startTrial.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (!result.cancelled) setActionFeedback(PAYWALL_FEEDBACK.purchaseNotActive);
      },
      onError: () => setActionFeedback(PAYWALL_FEEDBACK.purchaseUnavailable),
    });
  }

  useEffect(() => {
    track('contextual_paywall_shown', { feature: key });
  }, [key]);

  return (
    <Sheet
      scroll
      backdropAccessible={false}
      className={
        splitShortPaywall
          ? 'px-6 pb-3 pt-2'
          : shortPaywall
            ? 'px-7 pb-5 pt-3'
            : compactPaywall
              ? 'px-7 pb-8 pt-4'
              : undefined
      }
      onClose={() => dismissPaywall(router)}
    >
      {shortPaywall ? (
        splitShortPaywall ? (
          <View className="mb-0 flex-row items-center justify-between">
            <ComplianceRow density="compactHeader" />
            <Pressable
              accessibilityRole="button"
              onPress={() => dismissPaywall(router)}
              className="h-[48px] justify-center pl-2"
            >
              <Text className="font-sans-semibold" tone="muted" variant="body">
                Maybe later
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => dismissPaywall(router)}
            className="mb-1 h-[48px] self-end justify-center px-2"
          >
            <Text className="font-sans-semibold" tone="muted" variant="body">
              Maybe later
            </Text>
          </Pressable>
        )
      ) : null}
      {shortPaywall ? null : (
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
      )}
      {shortPaywall && !splitShortPaywall ? <ComplianceRow density="compactHeader" /> : null}
      <Text
        variant="title"
        style={{
          fontSize: splitShortPaywall ? 24 : shortPaywall ? 27 : longCompactTitle ? 24 : 30,
          lineHeight: splitShortPaywall ? 27 : shortPaywall ? 30 : longCompactTitle ? 27 : 34,
        }}
      >
        {copy.title}
      </Text>
      {!splitShortPaywall ? (
        <Text
          variant="body"
          tone="muted"
          className={shortPaywall ? 'mt-1.5' : compactPaywall ? 'mt-2' : 'mt-3'}
          style={{
            fontSize: shortPaywall ? 14 : undefined,
            lineHeight: shortPaywall ? 18 : compactPaywall ? 20 : 24,
          }}
        >
          {copy.body}
        </Text>
      ) : null}
      <View
        className={
          shortPaywall
            ? 'mt-2 flex-row items-center justify-between rounded-card bg-paper-raised p-2.5'
            : compactPaywall
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
            style={{
              fontSize: shortPaywall ? 22 : compactPaywall ? 24 : 26,
              lineHeight: shortPaywall ? 25 : compactPaywall ? 28 : 30,
            }}
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
          className={
            shortPaywall
              ? 'mt-1 px-3 text-center'
              : compactPaywall
                ? 'mt-1.5 px-3 text-center'
                : 'mt-2 px-3 text-center'
          }
          style={{
            fontSize: shortPaywall ? 11.5 : 12,
            lineHeight: shortPaywall ? 15 : compactPaywall ? 16 : 17,
          }}
        >
          {offering.data.reason}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!canPurchase || startTrial.isPending}
        onPress={onStartTrial}
        className={
          shortPaywall
            ? 'mt-1.5 h-[52px] items-center justify-center rounded-pill'
            : compactPaywall
            ? 'mt-2 h-[54px] items-center justify-center rounded-pill'
            : 'mt-4 h-[54px] items-center justify-center rounded-pill'
        }
        style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}
      >
        <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
          Start free trial
        </Text>
      </Pressable>
      <PaywallFeedback compact={compactPaywall} feedback={actionFeedback} />
      {shortPaywall ? null : <ComplianceRow />}
      {shortPaywall ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => dismissPaywall(router)}
          className="h-[48px] items-center justify-center"
        >
          <Text className="font-sans-semibold" tone="muted" variant="body">
            Maybe later
          </Text>
        </Pressable>
      )}
    </Sheet>
  );
}
