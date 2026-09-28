import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { openPolicy, PRIVACY_URL, TERMS_URL } from '@/features/subscription/ComplianceRow';
import { shouldTrackSubscriptionCancelIntent } from '@/features/subscription/cancelIntent';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { confirmedFreePlan } from '@/features/subscription/clientEntitlement';
import { billingStatusCopy } from '@/features/subscription/clientBilling';
import { useSubscriptionBilling } from '@/features/subscription/useSubscriptionBilling';
import { restoreFeedbackMessage } from '@/features/subscription/restoreFeedback';
import { subscriptionStorefrontCopy } from '@/features/subscription/storefrontCopy';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import {
  MANAGE_SUBSCRIPTION_URL_ANDROID,
  MANAGE_SUBSCRIPTION_URL_IOS,
  showNativeManageSubscriptions,
} from '@/lib/iap/revenuecat';
import { storeTransactionRecoveryMessage } from '@/lib/iap/storeTransactionNotice';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

const POLICY_LINK_UNAVAILABLE_MESSAGE =
  'Link unavailable. We could not open this policy link. Please try again.';
const SUBSCRIPTION_STOREFRONT_COPY = subscriptionStorefrontCopy(Platform.OS);
const SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE = SUBSCRIPTION_STOREFRONT_COPY.managementUnavailable;
const RESTORE_UNAVAILABLE_MESSAGE = 'We could not restore purchases. Please try again.';

// Manage subscription (design 06, docs/08 §3.4). Plan/state, renewal date, one-tap
// OS cancel deep-link, Restore, Terms/Privacy. ARL-compliant: cancel as easy as
// signup, no maze. Shows a calm free-state when not subscribed.
function fmtDate(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'date unavailable';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function Row({
  label,
  accessibilityLabel,
  last,
  onPress,
  compact = false,
  supportFloor = false,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  last?: boolean;
  onPress: () => void;
  compact?: boolean;
  supportFloor?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      className={
        supportFloor
          ? 'min-h-[44px] flex-row items-center justify-between py-1'
          : compact
            ? 'min-h-[48px] flex-row items-center justify-between py-2.5'
            : 'min-h-[48px] flex-row items-center justify-between py-3.5'
      }
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: colors.hairline }}
    >
      <Text
        variant="body"
        className="font-sans-semibold"
        numberOfLines={supportFloor ? 1 : undefined}
        style={supportFloor ? { fontSize: 14, lineHeight: 17 } : undefined}
      >
        {label}
      </Text>
      <Text style={{ color: colors.mutedLight, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export default function SubscriptionScreen() {
  const { height, width } = useWindowDimensions();
  const entitlement = useEntitlement();
  const { data } = entitlement;
  const billing = useSubscriptionBilling(data);
  const billingCopy = billingStatusCopy(billing.data);
  const recovery = !data?.isPro && !confirmedFreePlan(entitlement);
  const checkingAccess = entitlement.isPending || entitlement.isFetching;
  const { restore } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const [subscriptionFeedback, setSubscriptionFeedback] = useState<string | null>(null);
  const ultraShortSubscription = height < 460;
  const splitShortSubscription = height < 410;
  const supportFloorSubscription = width <= 320 && height < 520;
  const compactSubscription = true;
  const hideFreeSubscriptionBody = true;
  const freePlanTitle = recovery
    ? checkingAccess ? 'Checking your plan...' : 'Plan status unavailable'
    : data?.expired ? 'Pro ended · free plan' : supportFloorSubscription ? 'Free plan' : PAYWALL_COPY.manage.freeTitle;
  const upgradeCtaLabel = recovery
    ? 'Check access' : supportFloorSubscription ? 'See Pro' : PAYWALL_COPY.manage.upgradeCta;
  const restoreLabel = supportFloorSubscription ? 'Restore' : PAYWALL_COPY.manage.restoreRow;
  const isPro = data?.isPro ?? false;
  const eligibleWinBackOffer =
    env.iosWinBackEnabled &&
    offering.data?.status === 'available' &&
    offering.data.winBack?.canPurchase === true;
  const expiredPlanCta = eligibleWinBackOffer
    ? PAYWALL_COPY.winback.offer.settingsCta
    : PAYWALL_COPY.winback.currentPlan.settingsCta;

  function openExpiredPlanOptions() {
    router.push(eligibleWinBackOffer ? '/paywall/winback' : '/paywall/upsell?feature=full_routine');
  }

  async function openStore() {
    setSubscriptionFeedback(null);
    track('manage_subscription_opened');
    const entitlementState = data;
    if (entitlementState && shouldTrackSubscriptionCancelIntent(entitlementState)) {
      track('subscription_cancel_intent', {
        source: 'subscription_settings',
        period_type: entitlementState.periodType,
      });
    }
    const openedNative = await showNativeManageSubscriptions();
    if (openedNative) {
      await Promise.allSettled([entitlement.refetch(), billing.refetch()]);
      return;
    }
    const fallbackUrl =
      Platform.OS === 'android' ? MANAGE_SUBSCRIPTION_URL_ANDROID : MANAGE_SUBSCRIPTION_URL_IOS;
    const url = safeExternalHttpsUrl(data?.managementUrl) ?? fallbackUrl;
    const opened = await openExternalHttpsUrl(url, {
      mode: 'linking',
      failureTitle: 'Subscription link unavailable',
      failureMessage: SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE,
      alertOnFailure: false,
    });
    if (!opened) setSubscriptionFeedback(SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE);
  }
  function openReverseTrialOptions() {
    router.push('/paywall/reoffer');
  }
  function openAppGrantedProOptions() {
    router.push('/paywall/upsell?feature=full_routine');
  }
  function onRestore() {
    if (restore.isPending) return;
    setSubscriptionFeedback(null);
    restore.mutate(undefined, {
      onSuccess: (result) => {
        setSubscriptionFeedback(restoreFeedbackMessage(result));
        void billing.refetch();
      },
      onError: (error) => {
        setSubscriptionFeedback(
          storeTransactionRecoveryMessage(error, 'restore') ?? RESTORE_UNAVAILABLE_MESSAGE,
        );
      },
    });
  }

  async function onPolicy(url: string) {
    setSubscriptionFeedback(null);
    const opened = await openPolicy(url);
    if (!opened) setSubscriptionFeedback(POLICY_LINK_UNAVAILABLE_MESSAGE);
  }

  const periodLabel = data?.inReverseTrial
    ? 'Reverse trial'
    : data?.inTrial
      ? 'Free trial'
      : `${BRAND.proName}${data?.priceLabel ? ` · ${data.priceLabel}` : ''}`;
  const isAppGrantedAccess = data?.store === 'app_granted';
  const isReverseTrialAccess = isAppGrantedAccess && data?.inReverseTrial === true;
  const manageLabel = isReverseTrialAccess
    ? PAYWALL_COPY.reverseTrial.keepCta
    : isAppGrantedAccess
      ? 'Review Pro options'
      : SUBSCRIPTION_STOREFRONT_COPY.manageLabel;
  const manageAction = isAppGrantedAccess
    ? isReverseTrialAccess
      ? openReverseTrialOptions
      : openAppGrantedProOptions
    : openStore;
  const endDateLabel = fmtDate(data?.expiresAt ?? null);
  const supportNote = isReverseTrialAccess
    ? PAYWALL_COPY.reverseTrial.settingsNote(endDateLabel)
    : isAppGrantedAccess
      ? PAYWALL_COPY.manage.appGrantedNote(endDateLabel)
      : SUBSCRIPTION_STOREFRONT_COPY.cancellationNote(endDateLabel);
  const statusPillLabel = data?.inReverseTrial
    ? 'No card'
    : data?.inTrial
      ? 'Store trial'
      : PAYWALL_COPY.manage.activeLabel;
  const feedbackLabel = subscriptionFeedback ? (
    <Text accessibilityRole="alert" variant="bodySm" tone="muted" className="pb-4 text-center">
      {subscriptionFeedback}
    </Text>
  ) : null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={
          supportFloorSubscription ? 'px-5 pb-4' : compactSubscription ? 'px-5 pb-8' : 'px-5 pb-10'
        }
      >
        <View
          className={
            supportFloorSubscription
              ? 'mb-1 flex-row items-center gap-2 pt-0'
              : ultraShortSubscription
                ? 'mb-1 flex-row items-center gap-3 pt-1'
                : 'mb-3 flex-row items-center gap-3 pt-1'
          }
        >
          <RouteIconButton
            accessibilityLabel="Back"
            onPress={() => backOrReplace(router, APP_YOU_ROUTE)}
          />
          <Text
            variant="title"
            style={{ fontSize: supportFloorSubscription ? 21 : ultraShortSubscription ? 26 : 28 }}
          >
            {PAYWALL_COPY.manage.title}
          </Text>
        </View>

        {isPro ? (
          <>
            <View className="mb-4 rounded-card p-5" style={{ backgroundColor: colors.ink }}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="titleSm" style={{ color: colors.cream, fontSize: 22 }}>
                  {BRAND.proName}
                </Text>
                <View
                  className="rounded-pill px-2.5 py-1"
                  style={{ backgroundColor: 'rgba(157,177,138,0.2)' }}
                >
                  <Text
                    variant="label"
                    className="font-sans-bold"
                    style={{ color: '#9DB18A', fontSize: 11 }}
                  >
                    {billing.data.kind === 'grace' || billing.data.kind === 'billing_issue' || billing.data.kind === 'renewal_off' ? billingCopy.label : statusPillLabel}
                  </Text>
                </View>
              </View>
              <View
                className="flex-row justify-between py-2"
                style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(244,239,231,0.1)' }}
              >
                <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                  Plan
                </Text>
                <Text
                  variant="bodySm"
                  className="font-sans-semibold"
                  style={{ color: colors.cream }}
                >
                  {periodLabel}
                </Text>
              </View>
              <View className="flex-row justify-between py-2">
                <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                  {data?.willRenew === true ? 'Verified through' : data?.willRenew === false ? 'Ends' : 'Verified through'}
                </Text>
                <Text
                  variant="bodySm"
                  className="font-sans-semibold"
                  style={{ color: colors.cream }}
                >
                  {endDateLabel}
                </Text>
              </View>
            </View>

            <View className="mb-4 rounded-[18px] bg-paper-raised px-[18px]">
              <Row label={manageLabel} onPress={manageAction} compact={compactSubscription} />
              <Row
                label={PAYWALL_COPY.manage.restoreRow}
                onPress={onRestore}
                disabled={restore.isPending}
                compact={compactSubscription}
              />
              <Row
                label="Terms"
                onPress={() => void onPolicy(TERMS_URL)}
                compact={compactSubscription}
              />
              <Row
                label="Privacy"
                last
                onPress={() => void onPolicy(PRIVACY_URL)}
                compact={compactSubscription}
              />
              {feedbackLabel}
            </View>

            <View
              className="flex-row gap-3 rounded-card bg-paper-raised p-4"
              style={{ borderWidth: 1, borderColor: colors.hairline }}
            >
              <View
                className="mt-1.5 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: '#9DB18A' }}
              />
              <Text
                variant="bodySm"
                className="flex-1"
                style={{ color: colors.mutedStrong, lineHeight: 19 }}
              >
                {supportNote}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View
              className={
                supportFloorSubscription
                  ? 'mb-1 rounded-card bg-paper-raised p-2'
                  : splitShortSubscription
                    ? 'mb-2 rounded-card bg-paper-raised p-3'
                    : compactSubscription
                      ? 'mb-3 rounded-card bg-paper-raised p-4'
                      : 'mb-4 rounded-card bg-paper-raised p-5'
              }
              style={{ borderWidth: 1, borderColor: colors.hairline }}
            >
              <Text
                variant="titleSm"
                style={supportFloorSubscription ? { fontSize: 19, lineHeight: 22 } : undefined}
              >
                {freePlanTitle}
              </Text>
              {hideFreeSubscriptionBody && !recovery ? null : (
                <Text
                  variant="bodySm"
                  tone="muted"
                  className={compactSubscription ? 'mt-1.5' : 'mt-2'}
                  style={{ lineHeight: compactSubscription ? 19 : 21 }}
                >
                  {recovery ? 'We could not confirm your plan. Do not buy again yet. Your free-plan features remain available; use Check access, Restore, or Manage subscriptions.' : PAYWALL_COPY.manage.freeBody}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={upgradeCtaLabel}
                disabled={recovery && checkingAccess}
                accessibilityState={{ disabled: recovery && checkingAccess }}
                onPress={() => recovery ? void entitlement.refetch() : router.push('/paywall/upsell?feature=full_routine')}
                className={
                  supportFloorSubscription
                    ? 'mt-1.5 h-[44px] items-center justify-center rounded-pill'
                    : splitShortSubscription
                      ? 'mt-2.5 h-[48px] items-center justify-center rounded-pill'
                      : compactSubscription
                        ? 'mt-3 h-[48px] items-center justify-center rounded-pill'
                        : 'mt-4 h-[50px] items-center justify-center rounded-pill'
                }
                style={{ backgroundColor: colors.clay }}
              >
                <Text
                  className="font-sans-semibold"
                  style={{
                    color: colors.paper,
                    fontSize: supportFloorSubscription ? 13 : 16,
                    lineHeight: supportFloorSubscription ? 15 : undefined,
                  }}
                >
                  {upgradeCtaLabel}
                </Text>
              </Pressable>
            </View>
            <View
              className={
                supportFloorSubscription
                  ? 'rounded-[18px] bg-paper-raised px-3'
                  : 'rounded-[18px] bg-paper-raised px-[18px]'
              }
            >
              <Row
                label={SUBSCRIPTION_STOREFRONT_COPY.manageLabel}
                onPress={() => void openStore()}
                compact={compactSubscription}
                supportFloor={supportFloorSubscription}
              />
              <Row
                label={restoreLabel}
                accessibilityLabel={PAYWALL_COPY.manage.restoreRow}
                onPress={onRestore}
                disabled={restore.isPending}
                compact={compactSubscription}
                supportFloor={supportFloorSubscription}
              />
              <Row
                label="Terms"
                onPress={() => void onPolicy(TERMS_URL)}
                compact={compactSubscription}
                supportFloor={supportFloorSubscription}
              />
              <Row
                label="Privacy"
                last
                onPress={() => void onPolicy(PRIVACY_URL)}
                compact={compactSubscription}
                supportFloor={supportFloorSubscription}
              />
              {feedbackLabel}
            </View>
            {data?.expired && !recovery ? (
              <Pressable
                accessibilityRole="button"
                onPress={openExpiredPlanOptions}
                className="mt-4 min-h-[48px] items-center justify-center py-2"
              >
                <Text variant="body" tone="clay" className="font-sans-semibold">
                  {expiredPlanCta} →
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
        <View className="mt-4 rounded-card bg-paper-raised p-4">
          <Text variant="bodySm" className="font-sans-semibold">{billingCopy.label}</Text>
          <Text variant="bodySm" tone="muted" className="mt-2">{billingCopy.message}</Text>
          {billing.data.kind === 'grace' && billing.data.date ? (
            <Text variant="bodySm" tone="muted">Store-reported grace end: {fmtDate(billing.data.date)}</Text>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh subscription status"
            disabled={billing.isFetching || entitlement.isFetching}
            onPress={() => { void billing.refetch(); void entitlement.refetch(); }}
            className="mt-2 min-h-[48px] justify-center">
            <Text variant="bodySm" tone="clay">Refresh subscription status</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
