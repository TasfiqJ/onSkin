import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { planLineLabel, planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// 10 · Onboarding offer. Two honest paths (docs/08 §3.1, design 01). "Start free
// trial" (the committed path → carded 14-day trial) AND a visible "Explore first"
// (→ the app-granted 7-day reverse trial, no card). Annual pre-selected, the billed
// amount most conspicuous, no trial toggle, Terms/Privacy/Restore present, trust
// block below the plans (Apple 3.1.2). Purchase is STUBBED (B-REVENUECAT); the v1
// trial/reverse-trial are granted via the local-first entitlement store.
function ValueProp({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-8 w-8 items-center justify-center rounded-[9px]" style={{ backgroundColor: colors.clayTint }}>
        <View className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: colors.clay }} />
      </View>
      <Text variant="bodySm" className="flex-1 font-sans-semibold" style={{ lineHeight: 18 }}>
        {label}
      </Text>
    </View>
  );
}

export default function PaywallScreen() {
  const { goals, quizAnswers, computeResult } = useOnboarding();
  const { startTrial, startReverseTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const monthlyDisplay = planPriceDisplay('monthly', offering.data);
  const monthlyEquivalent = annualDisplay.pricePerMonthLabel;
  const quizCompletion = getQuizCompletionState(quizAnswers);

  function onStartTrial() {
    if (!canPurchase) {
      Alert.alert('Store pricing unavailable', offering.data?.reason ?? 'Please try again later.');
      return;
    }
    startTrial.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (!result.cancelled) Alert.alert('Purchase not active', 'No active subscription was found for this account.');
      },
      onError: () => Alert.alert('Purchase unavailable', 'We could not open the store purchase sheet. Please try again.'),
    });
  }

  function onStartReverseTrial() {
    startReverseTrial.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/routine/plan');
      },
      onError: () => Alert.alert('Explore first unavailable', 'We could not start the no-card Pro week for this account.'),
    });
  }

  useEffect(() => {
    track('paywall_shown', { count: goals.length });
  }, [goals.length]);

  // Personalized headline from the quiz axes (sign convention per the reveal: axes
  // >= 0.5 is the positive pole). Only when the quiz was actually taken.
  let headline: string = PAYWALL_COPY.offer.headlineFallback;
  if (quizCompletion.complete) {
    const r = computeResult();
    const descriptor = `${r.axes.oily_dry < 0.5 ? 'dry' : 'oily'}, ${r.axes.sensitive_resistant >= 0.5 ? 'sensitive' : 'resistant'} skin`;
    headline = PAYWALL_COPY.offer.headlineFor(descriptor);
  }

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <Text variant="title" className="mt-2" style={{ fontSize: 30, lineHeight: 34 }}>
          {headline}
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5">
          {PAYWALL_COPY.offer.subhead}
        </Text>

        {/* four value props */}
        <View className="mt-5 gap-2.5">
          {PAYWALL_COPY.offer.valueProps.map((v) => (
            <ValueProp key={v} label={v} />
          ))}
        </View>

        {/* the offer. Billed amount most conspicuous (Apple 3.1.2) */}
        <View className="mt-5 rounded-card p-5" style={{ backgroundColor: colors.ink }}>
          <View className="mb-2 self-start rounded-pill px-3 py-1" style={{ backgroundColor: colors.clay }}>
            <Text variant="label" style={{ color: colors.paper, fontSize: 10.5 }}>
              {PAYWALL_COPY.offer.annualBadge.toUpperCase()}
            </Text>
          </View>
          <View className="flex-row items-baseline justify-between">
            <View>
              <Text variant="bodySm" style={{ color: 'rgba(250,247,242,0.6)' }}>
                {annualDisplay.introLabel}
              </Text>
              <Text variant="title" style={{ color: colors.paper, fontSize: 34, lineHeight: 38 }}>
                {annualDisplay.priceLabel}
                {annualDisplay.periodLabel ? (
                  <Text variant="bodySm" style={{ color: 'rgba(250,247,242,0.6)' }}>
                    /{annualDisplay.periodLabel}
                  </Text>
                ) : null}
              </Text>
            </View>
            {monthlyEquivalent ? (
              <Text variant="bodySm" style={{ color: 'rgba(250,247,242,0.55)', textAlign: 'right' }}>{`just\n${monthlyEquivalent}/mo`}</Text>
            ) : null}
          </View>
        </View>

        {/* monthly secondary */}
        <View
          className="mt-3 flex-row items-center justify-between rounded-card bg-paper-raised px-[18px] py-3"
          style={{ borderWidth: 1, borderColor: colors.hairlineStrong }}>
          <Text variant="bodySm" className="font-sans-semibold" tone="muted">
            Monthly
          </Text>
          <Text variant="label" tone="muted" style={{ fontSize: 13 }}>
            {planLineLabel(monthlyDisplay)}
          </Text>
        </View>

        {offering.data?.status && offering.data.status !== 'available' ? (
          <Text variant="label" tone="muted" className="mt-2 px-2 text-center" style={{ fontSize: 11.5, lineHeight: 16 }}>
            {offering.data.reason}
          </Text>
        ) : null}

        {/* primary CTA */}
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className="mt-5 h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}>
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
            {PAYWALL_COPY.offer.cta}
          </Text>
        </Pressable>
        <Text variant="bodySm" tone="muted" className="mt-2.5 text-center">
          {PAYWALL_COPY.offer.trialReassurance}
        </Text>

        {/* the second honest path. The reverse trial */}
        <Pressable
          accessibilityRole="button"
          disabled={startReverseTrial.isPending}
          onPress={onStartReverseTrial}
          className="mt-3 flex-row items-center gap-3 rounded-card p-3.5"
          style={{ backgroundColor: colors.clayTint, borderWidth: 1, borderColor: 'rgba(165,105,75,0.22)' }}>
          <View className="h-[34px] w-[34px] items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(165,105,75,0.15)' }}>
            <View className="h-3 w-3 rounded-full border-2" style={{ borderColor: colors.clay }} />
          </View>
          <View className="flex-1">
            <Text variant="bodySm" className="font-sans-semibold" style={{ color: colors.clayDeep }}>
              {PAYWALL_COPY.offer.exploreTitle}
            </Text>
            <Text variant="label" style={{ color: colors.clay, fontSize: 11.5 }}>
              {PAYWALL_COPY.offer.exploreBody}
            </Text>
          </View>
          <Text style={{ color: colors.clay, fontSize: 18 }}>›</Text>
        </Pressable>

        {/* compliance (Apple 3.1.2) */}
        <ComplianceRow />

        {/* auto-renew disclosure (plain, honest) */}
        <Text variant="label" tone="muted" className="px-2 text-center" style={{ fontSize: 10.5, lineHeight: 15 }}>
          {PAYWALL_COPY.offer.autoRenewDisclosure}
        </Text>

        {/* trust block. Below the plans (Flo pattern) */}
        <View className="mt-4 flex-row items-center justify-center gap-2 border-t pt-3.5" style={{ borderColor: colors.hairline }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.clay }} />
          <Text variant="label" tone="muted" className="text-center" style={{ fontSize: 11 }}>
            {PAYWALL_COPY.offer.trustBlock}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
