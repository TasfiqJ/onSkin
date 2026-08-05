import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY } from '@/features/subscription/copy';
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
import { env } from '@/lib/env';
import { colors } from '@/theme/tokens';

// PAY-08 keeps the ordinary current-plan path neutral. Welcome-back copy and
// pricing are admitted only for an exact SDK offer in an explicitly enabled build.
const BG = '#1B1813';

export default function WinbackScreen() {
  const insets = useSafeAreaInsets();
  const { fontScale = 1, height, width } = useWindowDimensions();
  const { winback } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const eligibleOffer =
    env.iosWinBackEnabled &&
    offering.data?.status === 'available' &&
    offering.data.winBack?.canPurchase === true
      ? offering.data.winBack
      : null;
  const canWinBack = eligibleOffer !== null;
  const winBackCopy = canWinBack ? PAYWALL_COPY.winback.offer : PAYWALL_COPY.winback.currentPlan;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const fallbackActionCopy =
    'No welcome-back offer is available. You can still review the standard Pro options.';
  const tallTextPressurePaywall =
    width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPaywall = height < 640 || tallTextPressurePaywall;

  function onComeBack() {
    setActionFeedback(null);
    if (!canWinBack) {
      router.replace('/paywall/upsell?feature=full_routine');
      return;
    }
    winback.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (result.offerUnavailable) setActionFeedback(PAYWALL_FEEDBACK.offerUnavailable);
        else if (result.cancelled) setActionFeedback(PAYWALL_FEEDBACK.purchaseCancelled);
        else setActionFeedback(PAYWALL_FEEDBACK.purchaseNotActive);
      },
      onError: (error) => setActionFeedback(PAYWALL_FEEDBACK.purchaseError(error)),
    });
  }

  useEffect(() => {
    track('winback_shown');
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BG,
        paddingTop: insets.top + (compactPaywall ? 24 : 40),
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 30,
      }}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={{ overflow: 'hidden' }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: compactPaywall ? 'flex-start' : 'center',
          paddingBottom: compactPaywall ? 10 : 16,
        }}
      >
        <Text variant="label" style={{ color: 'rgba(244,239,231,0.5)', letterSpacing: 2 }}>
          {winBackCopy.eyebrow.toUpperCase()}
        </Text>
        <Text
          variant="display"
          className={compactPaywall ? 'mt-2.5' : 'mt-3.5'}
          style={{
            color: colors.cream,
            fontSize: compactPaywall ? 34 : 40,
            lineHeight: compactPaywall ? 37 : 43,
          }}
        >
          {winBackCopy.title}
        </Text>
        <Text
          variant="body"
          className={compactPaywall ? 'mt-3' : 'mt-4'}
          style={{
            color: 'rgba(244,239,231,0.7)',
            lineHeight: compactPaywall ? 22 : 25,
            fontSize: compactPaywall ? 15 : undefined,
          }}
        >
          {winBackCopy.body}
        </Text>
        <View
          className={compactPaywall ? 'mt-4 rounded-card p-4' : 'mt-6 rounded-card p-5'}
          style={{ backgroundColor: colors.nightSurface }}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                {winBackCopy.priceLabel}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-2">
                <Text variant="title" style={{ color: colors.cream, fontSize: 28 }}>
                  {eligibleOffer?.priceLabel ?? annualDisplay.priceLabel}
                </Text>
                {eligibleOffer?.originalPriceLabel ? (
                  <Text
                    variant="bodySm"
                    style={{ color: 'rgba(244,239,231,0.45)', textDecorationLine: 'line-through' }}
                  >
                    {eligibleOffer.originalPriceLabel}
                  </Text>
                ) : null}
                <Text variant="bodySm" style={{ color: colors.clayBright }}>
                  {eligibleOffer?.periodLabel
                    ? `/ ${eligibleOffer.periodLabel}`
                    : annualDisplay.periodLabel
                      ? `/ ${annualDisplay.periodLabel}`
                      : ''}
                </Text>
              </View>
            </View>
            {eligibleOffer?.percentOff ? (
              <View
                className="rounded-pill px-3 py-1.5"
                style={{ backgroundColor: 'rgba(217,161,131,0.2)' }}
              >
                <Text
                  variant="label"
                  className="font-sans-bold"
                  style={{ color: colors.clayBright, fontSize: 11 }}
                >
                  {eligibleOffer.percentOff}% off
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {compactPaywall ? null : <ComplianceRow tone="dark" />}
      </ScrollView>
      <View className="gap-2.5" style={{ backgroundColor: BG, paddingTop: compactPaywall ? 8 : 0 }}>
        {compactPaywall ? <ComplianceRow tone="dark" /> : null}
        {!canWinBack ? (
          <Text
            variant="label"
            className="px-2 text-center"
            style={{
              color: 'rgba(244,239,231,0.6)',
              fontSize: compactPaywall ? 11 : 11.5,
              lineHeight: compactPaywall ? 15 : 16,
            }}
          >
            {fallbackActionCopy}
          </Text>
        ) : null}
        <PaywallFeedback
          compact={compactPaywall}
          feedback={actionFeedback}
          tone="dark"
          className="rounded-card px-3 py-2"
        />
        <Pressable
          accessibilityRole="button"
          disabled={winback.isPending}
          onPress={onComeBack}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: colors.cream }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.ink, fontSize: 16 }}>
            {winBackCopy.cta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => dismissPaywall(router)}
          className="h-[48px] items-center justify-center"
        >
          <Text
            className="font-sans-semibold"
            style={{ color: 'rgba(244,239,231,0.5)', fontSize: 15 }}
          >
            {winBackCopy.declineCta}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
