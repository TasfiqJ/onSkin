import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { dismissPaywall } from '@/features/subscription/dismissPaywall';
import {
  PAYWALL_FEEDBACK,
  PaywallFeedback,
  type PaywallFeedbackState,
} from '@/features/subscription/PaywallFeedback';
import { planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { APP_YOU_ROUTE } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Reverse-trial keep/re-offer surface (design 02/03, docs/08 §3.2/§6).
// Active trials can choose a plan without store-management confusion; expired
// trials get the honest loss-aversion re-offer. Never a data-deleting lock.
export default function ReofferScreen() {
  const { height } = useWindowDimensions();
  const { data, isLoading } = useEntitlement();
  const { startTrial, downgrade } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const unavailableReason =
    offering.data?.status && offering.data.status !== 'available' ? offering.data.reason : null;
  const activeReverseTrial = data?.inReverseTrial === true;
  const compactPaywall = height < 640;
  const screenCopy = activeReverseTrial
    ? {
        pill: PAYWALL_COPY.reverseTrial.keepPill,
        title: PAYWALL_COPY.reverseTrial.keepTitle,
        body: PAYWALL_COPY.reverseTrial.keepBody,
        cta: PAYWALL_COPY.reverseTrial.keepCta,
        declineCta: PAYWALL_COPY.reverseTrial.keepDeclineCta,
      }
    : {
        pill: PAYWALL_COPY.reoffer.pill,
        title: PAYWALL_COPY.reoffer.title,
        body: PAYWALL_COPY.reoffer.body,
        cta: PAYWALL_COPY.reoffer.keepCta,
        declineCta: PAYWALL_COPY.reoffer.declineCta,
      };

  function onStartTrial() {
    setActionFeedback(null);
    if (!canPurchase) {
      setActionFeedback(PAYWALL_FEEDBACK.storePricingUnavailable(offering.data?.reason));
      return;
    }
    startTrial.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (result.cancelled) setActionFeedback(PAYWALL_FEEDBACK.purchaseCancelled);
        else setActionFeedback(PAYWALL_FEEDBACK.purchaseNotActive);
      },
      onError: (error) => setActionFeedback(PAYWALL_FEEDBACK.purchaseError(error)),
    });
  }

  function onDecline() {
    if (activeReverseTrial) {
      dismissPaywall(router, APP_YOU_ROUTE);
      return;
    }

    downgrade.mutate(undefined, { onSettled: () => router.replace('/(tabs)/today') });
  }

  useEffect(() => {
    if (isLoading) return;
    track('paywall_shown', {
      context: activeReverseTrial ? 'reverse_trial_keep_options' : 'reverse_trial_reoffer',
    });
  }, [activeReverseTrial, isLoading]);

  if (isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View />
      </Screen>
    );
  }

  function renderPriceSummary(compact: boolean) {
    return (
      <View
        className={
          compact
            ? 'flex-row items-center justify-between rounded-card px-4 py-3'
            : 'mt-4 flex-row items-center justify-between rounded-card p-4'
        }
        style={{ backgroundColor: colors.clayTint }}
      >
        <Text
          variant="bodySm"
          numberOfLines={compact ? 2 : undefined}
          style={{
            color: colors.clayDeep,
            fontSize: compact ? 12.5 : undefined,
            lineHeight: compact ? 17 : undefined,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {annualDisplay.introLabel}
        </Text>
        <View
          style={{
            alignItems: 'flex-end',
            flexShrink: 0,
            maxWidth: compact ? 136 : undefined,
            minWidth: compact ? 116 : undefined,
          }}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            variant="title"
            style={{
              color: colors.clayDeep,
              fontSize: compact ? 20 : 24,
              letterSpacing: 0,
              textAlign: 'right',
            }}
          >
            {annualDisplay.priceLabel}
          </Text>
          {annualDisplay.periodLabel ? (
            <Text
              numberOfLines={1}
              variant="bodySm"
              style={{ color: colors.clayDeep, fontSize: compact ? 11.5 : undefined }}
            >
              /{annualDisplay.periodLabel}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPaywall ? 'pb-56' : 'pb-4'}
      >
        <View
          className="mt-2 flex-row items-center gap-2 self-start rounded-pill px-4 py-2"
          style={{ backgroundColor: colors.greige }}
        >
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clay }} />
          <Text variant="label" className="font-sans-bold" tone="muted" style={{ fontSize: 12.5 }}>
            {screenCopy.pill}
          </Text>
        </View>
        <Text variant="title" className="mt-5" style={{ fontSize: 32, lineHeight: 36 }}>
          {screenCopy.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-2.5" style={{ lineHeight: 24 }}>
          {screenCopy.body}
        </Text>
        <View
          className="mt-5 rounded-card bg-paper-raised px-[18px]"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          {PAYWALL_COPY.reoffer.continues.map((c, i) => (
            <View
              key={c}
              className="flex-row items-center gap-3 py-3"
              style={
                i < PAYWALL_COPY.reoffer.continues.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: colors.hairline }
                  : undefined
              }
            >
              <View
                className="h-[18px] w-[18px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.clayTint }}
              >
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colors.clay }}
                />
              </View>
              <Text variant="bodySm" style={{ color: colors.inkSoft }}>
                {c}
              </Text>
            </View>
          ))}
        </View>
        {compactPaywall ? null : renderPriceSummary(false)}
        {!compactPaywall && unavailableReason ? (
          <Text
            variant="bodySm"
            tone="muted"
            className="mt-2 px-2 text-center"
            style={{ fontSize: 12, lineHeight: 17 }}
          >
            {unavailableReason}
          </Text>
        ) : null}
        {compactPaywall ? null : <ComplianceRow />}
      </ScrollView>
      <View className={compactPaywall ? 'gap-2.5 pb-8' : 'gap-2.5 pb-2'}>
        {compactPaywall ? renderPriceSummary(true) : null}
        {compactPaywall && unavailableReason ? (
          <Text
            variant="bodySm"
            tone="muted"
            className="px-2 text-center"
            style={{ fontSize: 11.5, lineHeight: 15 }}
          >
            {unavailableReason}
          </Text>
        ) : null}
        {compactPaywall ? <ComplianceRow /> : null}
        <PaywallFeedback compact={compactPaywall} feedback={actionFeedback} />
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
            {screenCopy.cta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onDecline}
          className="h-[48px] items-center justify-center"
        >
          <Text className="font-sans-semibold" tone="muted" variant="body">
            {screenCopy.declineCta}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
