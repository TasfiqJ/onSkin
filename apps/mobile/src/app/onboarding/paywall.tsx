import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY, standardSubscriptionDisclosure } from '@/features/subscription/copy';
import {
  PAYWALL_FEEDBACK,
  PaywallFeedback,
  type PaywallFeedbackState,
} from '@/features/subscription/PaywallFeedback';
import { planLineLabel, planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { SubscriptionPlanSelector, SubscriptionPurchaseRecovery, useStandardSubscriptionOffering } from '@/features/subscription/SubscriptionPurchaseRecovery';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

// 10 · Onboarding offer. Two honest paths (docs/08 §3.1, design 01): the native
// StoreKit subscription/introductory-offer path and a visible free-plan path.
// The custom no-card full-Pro grant is absent from the iOS release UI. Annual is
// pre-selected, the billed amount is conspicuous, and Terms/Privacy/Restore
// remain visible (Apple 3.1.2).
function ValueProp({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <View className={cn('flex-row items-center', compact ? 'gap-2' : 'gap-3')}>
      <View
        className={cn(
          'items-center justify-center',
          compact ? 'h-5 w-5 rounded-[7px]' : 'h-8 w-8 rounded-[9px]',
        )}
        style={{ backgroundColor: colors.clayTint }}
      >
        <View
          className={compact ? 'h-2 w-2 rounded-[3px]' : 'h-2.5 w-2.5 rounded-[3px]'}
          style={{ backgroundColor: colors.clay }}
        />
      </View>
      <Text
        variant="bodySm"
        className="flex-1 font-sans-semibold"
        style={{ fontSize: compact ? 11.5 : undefined, lineHeight: compact ? 14 : 18 }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function PaywallScreen() {
  const { fontScale = 1, height, width } = useWindowDimensions();
  const { goals, quizAnswers, profileResult, computeResult } = useOnboarding();
  const { purchasePlan: startTrial } = useEntitlementActions();
  const { access, offering, canPurchase, plan, setPlan } = useStandardSubscriptionOffering();
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const annual = offering.data?.[plan] ?? null;
  const hasEligibleIntroTrial = (annual?.trialDays ?? 0) > 0;
  const primaryCtaLabel = hasEligibleIntroTrial
    ? PAYWALL_COPY.offer.cta
    : PAYWALL_COPY.offer.subscribeCta;
  const annualDisplay = planPriceDisplay(plan, offering.data);
  const monthlyDisplay = planPriceDisplay(plan === 'annual' ? 'monthly' : 'annual', offering.data);
  const monthlyEquivalent = annualDisplay.pricePerMonthLabel;
  const quizCompletion = getQuizCompletionState(quizAnswers);
  const supportFloorTextPressurePaywall =
    width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const tallTextPressurePaywall =
    width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPaywall = height < 640 || supportFloorTextPressurePaywall || tallTextPressurePaywall;
  const headerCompliancePaywall = compactPaywall;

  function onStartTrial() {
    setActionFeedback(null);
    if (!canPurchase) {
      setActionFeedback(PAYWALL_FEEDBACK.storePricingUnavailable(offering.data?.reason));
      return;
    }
    startTrial.mutate(plan, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (result.cancelled) setActionFeedback(PAYWALL_FEEDBACK.purchaseCancelled);
        else setActionFeedback(PAYWALL_FEEDBACK.purchaseNotActive);
      },
      onError: (error) => setActionFeedback(PAYWALL_FEEDBACK.purchaseError(error)),
    });
  }

  function onContinueFree() {
    setActionFeedback(null);
    router.replace('/(tabs)/today');
  }

  useEffect(() => {
    track('paywall_shown', { count: goals.length });
  }, [goals.length]);

  // Personalized headline from the quiz axes (sign convention per the reveal: axes
  // >= 0.5 is the positive pole). Only when the quiz was actually taken.
  let headline: string = PAYWALL_COPY.offer.headlineFallback;
  const result = profileResult ?? (quizCompletion.complete ? computeResult() : null);
  if (result) {
    const r = result;
    const descriptor = `${r.axes.oily_dry < 0.5 ? 'dry' : 'oily'}, ${r.axes.sensitive_resistant >= 0.5 ? 'sensitive' : 'resistant'} skin`;
    headline = PAYWALL_COPY.offer.headlineFor(descriptor);
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPaywall ? 'pb-6' : 'pb-8'}
      >
        <Text
          variant="title"
          className={compactPaywall ? 'mt-0' : 'mt-2'}
          style={{ fontSize: compactPaywall ? 24 : 30, lineHeight: compactPaywall ? 27 : 34 }}
        >
          {headline}
        </Text>
        <Text
          variant="bodySm"
          tone="muted"
          className={compactPaywall ? 'mt-1' : 'mt-1.5'}
          style={compactPaywall ? { fontSize: 11.5, lineHeight: 15 } : undefined}
        >
          {PAYWALL_COPY.offer.subhead}
        </Text>
        {headerCompliancePaywall ? <ComplianceRow density="compactHeader" /> : null}

        {/* four value props */}
        <View className={compactPaywall ? 'mt-2.5 gap-1' : 'mt-5 gap-2.5'}>
          {PAYWALL_COPY.offer.valueProps.map((v) => (
            <ValueProp key={v} label={v} compact={compactPaywall} />
          ))}
        </View>

        <SubscriptionPlanSelector plan={plan} onChange={setPlan} disabled={startTrial.isPending} />

        {/* the offer. Billed amount most conspicuous (Apple 3.1.2) */}
        <View
          className={compactPaywall ? 'mt-2.5 rounded-card p-3' : 'mt-5 rounded-card p-5'}
          style={{ backgroundColor: colors.ink }}
        >
          <View
            className={
              compactPaywall
                ? 'mb-1 self-start rounded-pill px-3 py-1'
                : 'mb-2 self-start rounded-pill px-3 py-1'
            }
            style={{ backgroundColor: colors.clay }}
          >
            <Text variant="label" style={{ color: colors.paper, fontSize: 10.5 }}>
              {plan === 'annual' ? 'ANNUAL' : 'MONTHLY'}
            </Text>
          </View>
          <View className="flex-row items-baseline justify-between">
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <Text variant="bodySm" style={{ color: 'rgba(250,247,242,0.6)' }}>
                {annualDisplay.introLabel}
              </Text>
              <Text
                variant="title"
                style={{
                  color: colors.paper,
                  fontSize: compactPaywall ? 26 : 34,
                  lineHeight: compactPaywall ? 30 : 38,
                }}
              >
                {annualDisplay.priceLabel}
                {annualDisplay.periodLabel ? (
                  <Text variant="bodySm" style={{ color: 'rgba(250,247,242,0.6)' }}>
                    /{annualDisplay.periodLabel}
                  </Text>
                ) : null}
              </Text>
            </View>
            {monthlyEquivalent ? (
              <Text
                variant="bodySm"
                adjustsFontSizeToFit
                minimumFontScale={0.86}
                numberOfLines={1}
                style={{
                  color: 'rgba(250,247,242,0.55)',
                  flexShrink: 0,
                  fontSize: compactPaywall ? 10.5 : undefined,
                  letterSpacing: 0,
                  lineHeight: compactPaywall ? 13 : undefined,
                  minWidth: compactPaywall ? 104 : 92,
                  textAlign: 'right',
                }}
              >{`${monthlyEquivalent}/mo`}</Text>
            ) : null}
          </View>
        </View>

        {/* monthly secondary */}
        <View
          className={
            compactPaywall
              ? 'mt-1.5 flex-row items-center justify-between rounded-card bg-paper-raised px-3.5 py-1.5'
              : 'mt-3 flex-row items-center justify-between rounded-card bg-paper-raised px-[18px] py-3'
          }
          style={{ borderWidth: 1, borderColor: colors.hairlineStrong }}
        >
          <Text variant="bodySm" className="font-sans-semibold" tone="muted">
            {plan === 'annual' ? 'Monthly option' : 'Annual option'}
          </Text>
          <Text variant="label" tone="muted" style={{ fontSize: 13 }}>
            {planLineLabel(monthlyDisplay)}
          </Text>
        </View>

        {offering.data?.status && offering.data.status !== 'available' ? (
          <Text
            variant="bodySm"
            tone="muted"
            className={compactPaywall ? 'mt-0.5 px-2 text-center' : 'mt-2 px-2 text-center'}
            style={{ fontSize: compactPaywall ? 10.8 : 12, lineHeight: compactPaywall ? 14 : 17 }}
          >
            {offering.data.reason}
          </Text>
        ) : null}

        <SubscriptionPurchaseRecovery access={access} offering={offering} />

        {/* primary CTA */}
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className={
            compactPaywall
              ? 'mt-2 h-[48px] items-center justify-center rounded-pill'
              : 'mt-5 h-[54px] items-center justify-center rounded-pill'
          }
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
            {primaryCtaLabel}
          </Text>
        </Pressable>
        <Text
          variant="bodySm"
          tone="muted"
          className={compactPaywall ? 'mt-1 text-center' : 'mt-2.5 text-center'}
          style={compactPaywall ? { fontSize: 11, lineHeight: 14 } : undefined}
        >
          {hasEligibleIntroTrial
            ? PAYWALL_COPY.offer.trialReassurance
            : PAYWALL_COPY.offer.subscriptionReassurance}
        </Text>

        {/* The non-purchase path remains visible and grants no Pro authority. */}
        <Pressable
          accessibilityRole="button"
          onPress={onContinueFree}
          className={
            compactPaywall
              ? 'mt-1.5 flex-row items-center gap-2 rounded-card px-3 py-2'
              : 'mt-3 flex-row items-center gap-3 rounded-card p-3.5'
          }
          style={{
            backgroundColor: colors.clayTint,
            borderWidth: 1,
            borderColor: 'rgba(165,105,75,0.22)',
          }}
        >
          <View
            className={
              compactPaywall
                ? 'h-7 w-7 items-center justify-center rounded-full'
                : 'h-[34px] w-[34px] items-center justify-center rounded-full'
            }
            style={{ backgroundColor: 'rgba(165,105,75,0.15)' }}
          >
            <View className="h-3 w-3 rounded-full border-2" style={{ borderColor: colors.clay }} />
          </View>
          <View className="flex-1">
            <Text
              variant="bodySm"
              className="font-sans-semibold"
              style={{
                color: colors.clayDeep,
                fontSize: compactPaywall ? 12.5 : undefined,
                lineHeight: compactPaywall ? 16 : undefined,
              }}
            >
              {PAYWALL_COPY.offer.continueFreeTitle}
            </Text>
            <Text
              variant="label"
              style={{
                color: colors.clay,
                fontSize: compactPaywall ? 10.5 : 11.5,
                lineHeight: compactPaywall ? 13 : undefined,
              }}
            >
              {PAYWALL_COPY.offer.continueFreeBody}
            </Text>
          </View>
          <Text style={{ color: colors.clay, fontSize: 18 }}>›</Text>
        </Pressable>

        <PaywallFeedback compact={compactPaywall} feedback={actionFeedback} />

        {/* compliance (Apple 3.1.2) */}
        {headerCompliancePaywall ? null : <ComplianceRow />}

        {/* auto-renew disclosure (plain, honest) */}
        <Text
          variant="label"
          tone="muted"
          className="px-2 text-center"
          style={{ fontSize: 10.5, lineHeight: 15 }}
        >
          {standardSubscriptionDisclosure(plan, hasEligibleIntroTrial)}
        </Text>

        {/* trust block. Below the plans (Flo pattern) */}
        <View
          className="mt-4 flex-row items-center justify-center gap-2 border-t pt-3.5"
          style={{ borderColor: colors.hairline }}
        >
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.clay }} />
          <Text variant="label" tone="muted" className="text-center" style={{ fontSize: 11 }}>
            {PAYWALL_COPY.offer.trustBlock}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
