import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import {
  DirectPaywallLoading,
  DirectPaywallRecovery,
  DirectPaywallRedirecting,
} from '@/features/subscription/DirectPaywallResolution';
import { directPaywallDecision } from '@/features/subscription/directPaywallPolicy';
import { dismissPaywall } from '@/features/subscription/dismissPaywall';
import {
  PAYWALL_FEEDBACK,
  PaywallFeedback,
  type PaywallFeedbackState,
} from '@/features/subscription/PaywallFeedback';
import { planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { usePaidActionHold } from '@/features/subscription/usePaidActionHold';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { winBackOfferingDecision } from '@/features/subscription/winBackOfferingPolicy';
import { track } from '@/lib/analytics/track';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// Honest win-back (design 09, docs/08 §6). Value restated, a respectful 30%-off
// offer, an easy "no". Sparse, ARL-clean, never pressuring. Dark surface.
const BG = '#1B1813';

export default function WinbackScreen() {
  const insets = useSafeAreaInsets();
  const { fontScale = 1, height, width } = useWindowDimensions();
  const ownerScope = useOwnerQueryScope();
  const entitlement = useEntitlement();
  const decision = directPaywallDecision('winback', {
    state: entitlement.data,
    isLoading: entitlement.isLoading,
    isError: entitlement.isError,
  });
  const { winback } = useEntitlementActions();
  const offering = useSubscriptionOffering({ enabled: decision.loadOffering });
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const paidAction = usePaidActionHold(ownerScope.generation);
  const offer = offering.data?.winBack ?? null;
  const offeringDecision = winBackOfferingDecision(offering.data);
  const canWinBack = decision.allowPurchase && offeringDecision === 'purchase';
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const unavailableOfferCopy =
    'A native welcome-back offer is not available on this account. You can still choose the current Pro plan.';
  const tallTextPressurePaywall =
    width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPaywall = height < 640 || tallTextPressurePaywall;

  function onComeBack() {
    if (!decision.allowPurchase || paidAction.isHeld) return;
    if (offeringDecision === 'loading') return;
    setActionFeedback(null);
    if (!canWinBack) {
      router.replace('/paywall/upsell?feature=full_routine');
      return;
    }
    winback.mutate(
      {
        kind: 'winback_purchase',
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
            router.replace('/(tabs)/today');
          } else if (outcome.kind === 'inactive' && result.offerUnavailable) {
            setActionFeedback(PAYWALL_FEEDBACK.offerUnavailable);
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
    track('winback_shown');
  }, [decision.trackPresentation]);

  useEffect(() => {
    if (decision.phase !== 'redirect' || !isOwnerQueryScopeCurrent(ownerScope)) return;
    if (decision.redirect === 'upsell') {
      router.replace('/paywall/upsell?feature=full_routine');
      return;
    }
    router.replace('/(tabs)/today');
  }, [decision.phase, decision.redirect, ownerScope]);

  if (decision.phase === 'loading') return <DirectPaywallLoading />;
  if (decision.phase === 'recovery') {
    return (
      <DirectPaywallRecovery
        isRetrying={entitlement.isVerificationRetrying}
        onClose={() => dismissPaywall(router)}
        onRetry={() => void entitlement.retryVerification()}
      />
    );
  }
  if (decision.phase === 'redirect') return <DirectPaywallRedirecting />;

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
          {PAYWALL_COPY.winback.eyebrow.toUpperCase()}
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
          {PAYWALL_COPY.winback.title}
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
          {PAYWALL_COPY.winback.body}
        </Text>
        <View
          className={compactPaywall ? 'mt-4 rounded-card p-4' : 'mt-6 rounded-card p-5'}
          style={{ backgroundColor: colors.nightSurface }}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                {PAYWALL_COPY.winback.offerLabel}
              </Text>
              <View className="mt-1 flex-row items-baseline gap-2">
                <Text variant="title" style={{ color: colors.cream, fontSize: 28 }}>
                  {offer?.priceLabel ?? annualDisplay.priceLabel}
                </Text>
                {offer?.originalPriceLabel ? (
                  <Text
                    variant="bodySm"
                    style={{ color: 'rgba(244,239,231,0.45)', textDecorationLine: 'line-through' }}
                  >
                    {offer.originalPriceLabel}
                  </Text>
                ) : null}
                <Text variant="bodySm" style={{ color: colors.clayBright }}>
                  {offer?.periodLabel
                    ? `/ ${offer.periodLabel}`
                    : annualDisplay.periodLabel
                      ? `/ ${annualDisplay.periodLabel}`
                      : ''}
                </Text>
              </View>
            </View>
            {offer?.percentOff ? (
              <View
                className="rounded-pill px-3 py-1.5"
                style={{ backgroundColor: 'rgba(217,161,131,0.2)' }}
              >
                <Text
                  variant="label"
                  className="font-sans-bold"
                  style={{ color: colors.clayBright, fontSize: 11 }}
                >
                  {offer.percentOff}% off
                </Text>
              </View>
            ) : null}
          </View>
          {offer ? (
            <Text
              variant="label"
              className="mt-2"
              style={{ color: 'rgba(244,239,231,0.6)', lineHeight: 16 }}
            >
              {PAYWALL_COPY.winback.termsFor(
                offer.offerDurationLabel,
                offer.renewalPriceLabel,
                offer.renewalPeriodLabel,
              )}
            </Text>
          ) : null}
        </View>
        {compactPaywall ? null : <ComplianceRow tone="dark" />}
      </ScrollView>
      <View className="gap-2.5" style={{ backgroundColor: BG, paddingTop: compactPaywall ? 8 : 0 }}>
        {compactPaywall ? <ComplianceRow tone="dark" /> : null}
        {offeringDecision === 'fallback' ? (
          <Text
            variant="label"
            className="px-2 text-center"
            style={{
              color: 'rgba(244,239,231,0.6)',
              fontSize: compactPaywall ? 11 : 11.5,
              lineHeight: compactPaywall ? 15 : 16,
            }}
          >
            {unavailableOfferCopy}
          </Text>
        ) : null}
        <PaywallFeedback
          compact={compactPaywall}
          feedback={paidAction.feedback ?? actionFeedback}
          tone="dark"
          className="rounded-card px-3 py-2"
        />
        <Pressable
          accessibilityRole="button"
          disabled={
            !decision.allowPurchase ||
            offeringDecision === 'loading' ||
            paidAction.isHeld ||
            winback.isPending
          }
          onPress={onComeBack}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{
            backgroundColor:
              paidAction.isHeld || offeringDecision === 'loading'
                ? 'rgba(244,239,231,0.35)'
                : colors.cream,
          }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.ink, fontSize: 16 }}>
            {offeringDecision === 'loading'
              ? 'Checking offer…'
              : canWinBack
                ? PAYWALL_COPY.winback.cta
                : 'See current Pro plan'}
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
            {PAYWALL_COPY.winback.declineCta}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
