import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/OnboardingContext';
import { getQuizCompletionState } from '@/features/onboarding/quiz';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { paywallPurchasePresentation, PAYWALL_COPY } from '@/features/subscription/copy';
import {
  DirectPaywallLoading,
  DirectPaywallRecovery,
  DirectPaywallRedirecting,
} from '@/features/subscription/DirectPaywallResolution';
import { directPaywallDecision } from '@/features/subscription/directPaywallPolicy';
import {
  PAYWALL_FEEDBACK,
  PaywallFeedback,
  type PaywallFeedbackState,
} from '@/features/subscription/PaywallFeedback';
import { planLineLabel, planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { usePaidActionHold } from '@/features/subscription/usePaidActionHold';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// 10 · Onboarding offer. Two honest paths (docs/08 §3.1, design 01). "Start free
// trial" (the committed path → carded 14-day trial) AND a visible "Explore first"
// (→ the app-granted 7-day reverse trial, no card). Annual pre-selected, the billed
// amount most conspicuous, no trial toggle, Terms/Privacy/Restore present, trust
// block below the plans (Apple 3.1.2). Store purchase opens RevenueCat when an
// offering is available; previews fail closed while the no-card reverse trial remains
// a server/app-granted entitlement.
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
  const { goals, quizAnswers, computeResult } = useOnboarding();
  const ownerScope = useOwnerQueryScope();
  const entitlement = useEntitlement();
  const decision = directPaywallDecision('onboarding', {
    state: entitlement.data,
    isLoading: entitlement.isLoading,
    isError: entitlement.isError,
  });
  const { startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering({ enabled: decision.loadOffering });
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const paidAction = usePaidActionHold(ownerScope.generation);
  const annual = offering.data?.annual ?? null;
  const purchasePresentation = paywallPurchasePresentation(annual);
  const canPurchase =
    decision.allowPurchase && offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const monthlyDisplay = planPriceDisplay('monthly', offering.data);
  const monthlyEquivalent = annualDisplay.pricePerMonthLabel;
  const quizCompletion = getQuizCompletionState(quizAnswers);
  const supportFloorTextPressurePaywall =
    width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const tallTextPressurePaywall =
    width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPaywall = height < 640 || supportFloorTextPressurePaywall || tallTextPressurePaywall;
  const headerCompliancePaywall = compactPaywall;

  function onStartTrial() {
    if (!decision.allowPurchase || paidAction.isHeld) return;
    setActionFeedback(null);
    if (!canPurchase) {
      setActionFeedback(PAYWALL_FEEDBACK.storePricingUnavailable(offering.data?.reason));
      return;
    }
    startTrial.mutate(
      {
        kind: 'onboarding_purchase',
        expectedEvidenceIdentity: entitlement.data?.evidenceIdentity ?? null,
      },
      {
        onSuccess: (result) => {
          if (!isOwnerQueryScopeCurrent(ownerScope)) return;
          const outcome = paidAction.resolve(result);
          if (outcome.kind === 'success') {
            router.replace({
              pathname: '/paywall/success',
              params: { receipt: outcome.receiptId },
            });
          } else if (outcome.kind === 'active_without_receipt') {
            router.replace('/routine/plan');
          } else if (outcome.kind === 'inactive' && !result.cancelled) {
            setActionFeedback(PAYWALL_FEEDBACK.purchaseNotActive);
          }
        },
        onError: () => setActionFeedback(PAYWALL_FEEDBACK.purchaseUnavailable),
      },
    );
  }

  useEffect(() => {
    if (!decision.trackPresentation) return;
    track('paywall_shown', { count: goals.length });
  }, [decision.trackPresentation, goals.length]);

  useEffect(() => {
    if (decision.phase !== 'redirect' || !isOwnerQueryScopeCurrent(ownerScope)) return;
    if (decision.redirect === 'routine_plan') {
      router.replace('/routine/plan');
      return;
    }
    router.replace('/(tabs)/today');
  }, [decision.phase, decision.redirect, ownerScope]);

  if (decision.phase === 'loading') return <DirectPaywallLoading />;
  if (decision.phase === 'recovery') {
    return (
      <DirectPaywallRecovery
        isRetrying={entitlement.isVerificationRetrying}
        onClose={() => router.replace('/onboarding/reveal')}
        onRetry={() => void entitlement.retryVerification()}
      />
    );
  }
  if (decision.phase === 'redirect') return <DirectPaywallRedirecting />;

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
              {PAYWALL_COPY.offer.annualBadge.toUpperCase()}
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
            Monthly
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

        {/* primary CTA */}
        <Pressable
          accessibilityRole="button"
          disabled={
            !decision.allowPurchase || !canPurchase || paidAction.isHeld || startTrial.isPending
          }
          onPress={onStartTrial}
          className={
            compactPaywall
              ? 'mt-2 h-[48px] items-center justify-center rounded-pill'
              : 'mt-5 h-[54px] items-center justify-center rounded-pill'
          }
          style={{
            backgroundColor: canPurchase && !paidAction.isHeld ? colors.clay : colors.mutedLight,
          }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
            {purchasePresentation.cta}
          </Text>
        </Pressable>
        <Text
          variant="bodySm"
          tone="muted"
          className={compactPaywall ? 'mt-1 text-center' : 'mt-2.5 text-center'}
          style={compactPaywall ? { fontSize: 11, lineHeight: 14 } : undefined}
        >
          {purchasePresentation.reassurance}
        </Text>

        <Button
          label="Continue free"
          variant="ghost"
          className="mt-3"
          disabled={paidAction.isHeld}
          onPress={() => router.replace('/today')}
        />

        <PaywallFeedback
          compact={compactPaywall}
          feedback={paidAction.feedback ?? actionFeedback}
        />

        {/* compliance (Apple 3.1.2) */}
        {headerCompliancePaywall ? null : <ComplianceRow />}

        {/* auto-renew disclosure (plain, honest) */}
        <Text
          variant="label"
          tone="muted"
          className="px-2 text-center"
          style={{ fontSize: 10.5, lineHeight: 15 }}
        >
          {purchasePresentation.autoRenewDisclosure}
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
