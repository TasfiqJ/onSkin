import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import {
  DirectPaywallLoading,
  DirectPaywallRecovery,
  DirectPaywallRedirecting,
} from '@/features/subscription/DirectPaywallResolution';
import { directPaywallDecision } from '@/features/subscription/directPaywallPolicy';
import {
  acknowledgeLifecyclePromptPresented,
  supersedeLifecyclePrompt,
} from '@/features/subscription/lifecycle';
import {
  PAYWALL_FEEDBACK,
  PaywallFeedback,
  type PaywallFeedbackState,
} from '@/features/subscription/PaywallFeedback';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { usePaidActionHold } from '@/features/subscription/usePaidActionHold';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// Graceful downgrade after a PAID expiry (design 08, docs/08 §6). Never a
// data-deleting hard lock; data preserved, Pro re-offered calmly.
export default function DowngradeScreen() {
  const params = useLocalSearchParams<{ lifecyclePromptId?: string | string[] }>();
  const lifecyclePromptId = Array.isArray(params.lifecyclePromptId)
    ? params.lifecyclePromptId[0]
    : params.lifecyclePromptId;
  const { fontScale = 1, height, width } = useWindowDimensions();
  const ownerScope = useOwnerQueryScope();
  const entitlement = useEntitlement();
  const decision = directPaywallDecision('downgrade', {
    state: entitlement.data,
    isLoading: entitlement.isLoading,
    isError: entitlement.isError,
  });
  const { purchase } = useEntitlementActions();
  const offering = useSubscriptionOffering({ enabled: decision.loadOffering });
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const paidAction = usePaidActionHold(ownerScope.generation);
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const supportFloorTextPressurePaywall =
    width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web');
  const compactPaywall = height < 640 || supportFloorTextPressurePaywall;

  useEffect(() => {
    // The downgrade copy is the mounted target surface; settle only a delivery
    // carrying the exact opaque prompt ID routed by the startup coordinator.
    if (decision.lifecycleDisposition !== 'present' || !lifecyclePromptId) return;
    void acknowledgeLifecyclePromptPresented({
      promptId: lifecyclePromptId,
      route: '/paywall/downgrade',
    });
  }, [decision.lifecycleDisposition, lifecyclePromptId]);

  useEffect(() => {
    if (decision.phase !== 'redirect') return;
    if (decision.lifecycleDisposition === 'supersede' && lifecyclePromptId) {
      // Journal settlement remains owner-fenced and drain-held, but a native
      // storage stall must not strand this deep link on a blank route.
      void supersedeLifecyclePrompt({
        promptId: lifecyclePromptId,
        route: '/paywall/downgrade',
      });
    }
    if (!isOwnerQueryScopeCurrent(ownerScope)) return;
    if (decision.redirect === 'reoffer') {
      router.replace('/paywall/reoffer');
      return;
    }
    router.replace('/(tabs)/today');
  }, [
    decision.lifecycleDisposition,
    decision.phase,
    decision.redirect,
    lifecyclePromptId,
    ownerScope,
  ]);

  function onRenew() {
    if (!decision.allowPurchase || paidAction.isHeld) return;
    setActionFeedback(null);
    if (!canPurchase) {
      setActionFeedback(PAYWALL_FEEDBACK.storePricingUnavailable(offering.data?.reason));
      return;
    }
    purchase.mutate(
      {
        kind: 'downgrade_purchase',
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
          } else if (outcome.kind === 'inactive' && !result.cancelled) {
            setActionFeedback(PAYWALL_FEEDBACK.purchaseNotActive);
          }
        },
        onError: () => setActionFeedback(PAYWALL_FEEDBACK.purchaseUnavailable),
      },
    );
  }

  if (decision.phase === 'loading') return <DirectPaywallLoading />;
  if (decision.phase === 'recovery') {
    return (
      <DirectPaywallRecovery
        isRetrying={entitlement.isVerificationRetrying}
        onClose={() => router.replace('/(tabs)/today')}
        onRetry={() => void entitlement.retryVerification()}
      />
    );
  }
  if (decision.phase === 'redirect') return <DirectPaywallRedirecting />;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPaywall ? 'pb-44' : 'pb-4'}
      >
        <View
          className="mt-2 flex-row items-center gap-2 self-start rounded-pill px-4 py-2"
          style={{ backgroundColor: colors.greige }}
        >
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.muted }} />
          <Text variant="label" className="font-sans-bold" tone="muted" style={{ fontSize: 12.5 }}>
            {PAYWALL_COPY.downgrade.pill}
          </Text>
        </View>
        <Text variant="title" className="mt-5" style={{ fontSize: 33, lineHeight: 37 }}>
          {PAYWALL_COPY.downgrade.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-2.5" style={{ lineHeight: 24 }}>
          {PAYWALL_COPY.downgrade.body}
        </Text>
        <View
          className="mt-5 rounded-card bg-paper-raised px-5"
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          {PAYWALL_COPY.downgrade.kept.map((k, i) => (
            <View
              key={k}
              className="flex-row items-center gap-3 py-3"
              style={
                i < PAYWALL_COPY.downgrade.kept.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: colors.hairline }
                  : undefined
              }
            >
              <View
                className="h-5 w-5 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.sageTint }}
              >
                <Text style={{ color: colors.sage, fontSize: 11 }}>✓</Text>
              </View>
              <Text variant="body" style={{ color: colors.inkSoft }}>
                {k}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodySm" tone="muted" className="mt-4" style={{ lineHeight: 19 }}>
          {PAYWALL_COPY.downgrade.floorNote}
        </Text>
        {compactPaywall ? null : <ComplianceRow />}
      </ScrollView>
      <View className={compactPaywall ? 'gap-2.5 pb-8' : 'gap-3 pb-2'}>
        {compactPaywall ? <ComplianceRow /> : null}
        {offering.data?.status && offering.data.status !== 'available' ? (
          <Text
            variant="bodySm"
            tone="muted"
            className="px-2 text-center"
            style={{ fontSize: 12, lineHeight: 17 }}
          >
            {offering.data.reason}
          </Text>
        ) : null}
        <PaywallFeedback
          compact={compactPaywall}
          feedback={paidAction.feedback ?? actionFeedback}
        />
        <Pressable
          accessibilityRole="button"
          disabled={
            !decision.allowPurchase || !canPurchase || paidAction.isHeld || purchase.isPending
          }
          onPress={onRenew}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{
            backgroundColor: canPurchase && !paidAction.isHeld ? colors.clay : colors.mutedLight,
          }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
            {PAYWALL_COPY.downgrade.renewCta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)/today')}
          className="h-[48px] items-center justify-center"
        >
          <Text className="font-sans-semibold" tone="muted" variant="body">
            {PAYWALL_COPY.downgrade.declineCta}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
