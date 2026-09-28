import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteIconButton, Text } from '@/components/ui';
import { openPolicy, PRIVACY_URL, TERMS_URL } from '@/features/subscription/ComplianceRow';
import { shouldTrackSubscriptionCancelIntent } from '@/features/subscription/cancelIntent';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { isEntitlementEvidenceUncertain } from '@/features/subscription/entitlement';
import { PLANS } from '@/features/subscription/plans';
import { restoreFeedbackMessage } from '@/features/subscription/restoreFeedback';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { MANAGE_SUBSCRIPTION_URL_ANDROID, MANAGE_SUBSCRIPTION_URL_IOS } from '@/lib/iap/revenuecat';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

const POLICY_LINK_UNAVAILABLE_MESSAGE =
  'Link unavailable. We could not open this policy link. Please try again.';
const SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE =
  'We could not open subscription management. You can manage billing from your App Store or Google Play account settings.';
const RESTORE_UNAVAILABLE_MESSAGE = 'We could not restore purchases. Please try again.';

// Manage subscription (design 06, docs/08 §3.4). Plan/state, renewal date, one-tap
// OS cancel deep-link, Restore, Terms/Privacy. ARL-compliant: cancel as easy as
// signup, no maze. Shows a calm free-state when not subscribed.
function fmtDate(iso: string | null): string {
  if (!iso) return 'date unavailable';
  return new Date(iso).toLocaleDateString('en-US', {
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
}: {
  label: string;
  accessibilityLabel?: string;
  last?: boolean;
  onPress: () => void;
  compact?: boolean;
  supportFloor?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
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
  const {
    data,
    isError,
    isLoading,
    isVerificationRetrying,
    retryVerification,
  } = useEntitlement();
  const { manage, restore } = useEntitlementActions();
  const [subscriptionFeedback, setSubscriptionFeedback] = useState<string | null>(null);
  const ultraShortSubscription = height < 460;
  const splitShortSubscription = height < 410;
  const supportFloorSubscription = width <= 320 && height < 520;
  const compactSubscription = true;
  const hideFreeSubscriptionBody = true;
  const freePlanTitle = supportFloorSubscription ? 'Free plan' : PAYWALL_COPY.manage.freeTitle;
  const upgradeCtaLabel = supportFloorSubscription ? 'See Pro' : PAYWALL_COPY.manage.upgradeCta;
  const restoreLabel = supportFloorSubscription ? 'Restore' : PAYWALL_COPY.manage.restoreRow;
  const entitlementChecking = isLoading || (!data && !isError);
  const entitlementUncertain = !data ? isError : isEntitlementEvidenceUncertain(data);
  const isPro = data?.isPro === true && !entitlementUncertain;
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
    let openedNative: boolean;
    try {
      openedNative = await manage.mutateAsync();
    } catch {
      setSubscriptionFeedback(SUBSCRIPTION_LINK_UNAVAILABLE_MESSAGE);
      return;
    }
    if (openedNative) return;
    const fallbackUrl =
      Platform.OS === 'android' ? MANAGE_SUBSCRIPTION_URL_ANDROID : MANAGE_SUBSCRIPTION_URL_IOS;
    const url = safeExternalHttpsUrl(data?.managementUrl) ?? fallbackUrl;
    const opened = await openExternalHttpsUrl(url, {
      mode: 'linking',
      failureTitle: 'Subscription link unavailable',
      failureMessage:
        'We could not open subscription management. You can manage billing from your App Store or Google Play account settings.',
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
    setSubscriptionFeedback(null);
    restore.mutate(undefined, {
      onSuccess: (result) => {
        setSubscriptionFeedback(restoreFeedbackMessage(result));
      },
      onError: () => {
        setSubscriptionFeedback(RESTORE_UNAVAILABLE_MESSAGE);
      },
    });
  }

  async function onPolicy(url: string) {
    setSubscriptionFeedback(null);
    const opened = await openPolicy(url);
    if (!opened) setSubscriptionFeedback(POLICY_LINK_UNAVAILABLE_MESSAGE);
  }

  const currentPlan = Object.values(PLANS).find((plan) => plan.productId === data?.productId);
  const exactEntitlementPriceLabel = currentPlan ? data?.priceLabel : null;
  const periodLabel = data?.inReverseTrial
    ? 'Reverse trial'
    : data?.inTrial
      ? 'Free trial'
      : `${BRAND.proName}${exactEntitlementPriceLabel ? ` · ${exactEntitlementPriceLabel}` : ''}`;
  const isAppGrantedAccess = data?.store === 'app_granted';
  const isReverseTrialAccess = isAppGrantedAccess && data?.inReverseTrial === true;
  const manageLabel =
    data?.store === 'play_store'
      ? 'Manage in Google Play'
      : isReverseTrialAccess
        ? PAYWALL_COPY.reverseTrial.keepCta
        : isAppGrantedAccess
          ? 'Review Pro options'
          : PAYWALL_COPY.manage.manageRow;
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
      : PAYWALL_COPY.manage.cancelNote(endDateLabel);
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
                    {statusPillLabel}
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
                  {data?.inReverseTrial ? 'Free until' : data?.willRenew ? 'Renews' : 'Ends'}
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
            {entitlementChecking || entitlementUncertain ? (
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
                  accessibilityRole={entitlementUncertain ? 'alert' : undefined}
                  variant="titleSm"
                  style={supportFloorSubscription ? { fontSize: 19, lineHeight: 22 } : undefined}
                >
                  {entitlementUncertain ? 'Plan status unavailable' : 'Checking your plan'}
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1.5">
                  {entitlementUncertain
                    ? 'We could not verify this plan. Retry before changing access.'
                    : 'Confirming your subscription before we show plan options.'}
                </Text>
                {entitlementUncertain ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry plan verification"
                    disabled={isVerificationRetrying}
                    onPress={() => void retryVerification()}
                    className={
                      supportFloorSubscription
                        ? 'mt-1.5 h-[44px] items-center justify-center rounded-pill'
                        : 'mt-3 h-[48px] items-center justify-center rounded-pill'
                    }
                    style={{
                      backgroundColor: isVerificationRetrying
                        ? colors.mutedLight
                        : colors.clay,
                    }}
                  >
                    <Text
                      className="font-sans-semibold"
                      style={{ color: colors.paper, fontSize: supportFloorSubscription ? 13 : 16 }}
                    >
                      {isVerificationRetrying ? 'Checking...' : 'Retry'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
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
                {hideFreeSubscriptionBody ? null : (
                  <Text
                    variant="bodySm"
                    tone="muted"
                    className={compactSubscription ? 'mt-1.5' : 'mt-2'}
                    style={{ lineHeight: compactSubscription ? 19 : 21 }}
                  >
                    {PAYWALL_COPY.manage.freeBody}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={PAYWALL_COPY.manage.upgradeCta}
                  onPress={() => router.push('/paywall/upsell?feature=full_routine')}
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
            )}
            <View
              className={
                supportFloorSubscription
                  ? 'rounded-[18px] bg-paper-raised px-3'
                  : 'rounded-[18px] bg-paper-raised px-[18px]'
              }
            >
              <Row
                label={restoreLabel}
                accessibilityLabel={PAYWALL_COPY.manage.restoreRow}
                onPress={onRestore}
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
            {!entitlementChecking && !entitlementUncertain && data?.expired ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/paywall/upsell')}
                className="mt-4 min-h-[48px] items-center justify-center py-2"
              >
                <Text variant="body" tone="clay" className="font-sans-semibold">
                  See subscription plans →
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
