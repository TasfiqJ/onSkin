import { router, useIsFocused, usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';
import type { GatedFeature } from '@onskin/types';

import { ComplianceRow } from './ComplianceRow';
import { PAYWALL_COPY, UPSELL_COPY } from './copy';
import { dismissPaywall, paywallDismissFallbackForFeature } from './dismissPaywall';
import { canStartContextualReverseTrial } from './entitlement';
import { PAYWALL_FEEDBACK, PaywallFeedback, type PaywallFeedbackState } from './PaywallFeedback';
import { planPriceDisplay } from './priceDisplay';
import { useEntitlement, useEntitlementActions } from './useEntitlement';
import { useSubscriptionOffering } from './useSubscriptionOffering';

// Feature gate (docs/08 §3.2/§4). When the user is Pro (incl. the reverse trial /
// carded trial), render the feature; otherwise render a calm, honest contextual
// paywall framed around THIS feature, with the same compliance posture. Dismissible,
// never nagging. The infra is generic. Applying it to more surfaces is mechanical.
export function ProGate({ feature, children }: { feature: GatedFeature; children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const { data, isLoading } = useEntitlement();
  const { startReverseTrial, startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const [actionFeedback, setActionFeedback] = useState<PaywallFeedbackState | null>(null);
  const locked = data ? !data.isPro : false;
  const compactPaywall = height < 640;
  const shortPaywall = height < 600;
  const ultraShortPaywall = height < 460;
  const microShortPaywall = height < 380;
  const narrowShortPaywall = shortPaywall && width < 360;
  const storeUnavailableReason =
    ultraShortPaywall && offering.data?.reason
      ? 'Store unavailable in this preview.'
      : offering.data?.reason;
  const insideProgressPhotoPaywall =
    feature === 'photo_timeline' && pathname.startsWith('/progress');
  const splitShortProgressTabPaywall =
    height < 410 && feature === 'photo_timeline' && pathname === '/progress';
  const compactProgressPhotoPaywall = compactPaywall && insideProgressPhotoPaywall;
  const headerCompliancePaywall = shortPaywall || compactProgressPhotoPaywall;
  const microShortDeferredCtaStyle = microShortPaywall
    ? {
        marginTop: splitShortProgressTabPaywall ? 0 : 88,
        position: 'relative' as const,
        zIndex: 2,
      }
    : undefined;
  const showExploreFirst = data ? canStartContextualReverseTrial(data) : false;
  const lapsedEntitlement = data?.expired === true;
  const lapsedReverseTrial = lapsedEntitlement && data?.priorPeriodType === 'reverse_trial';
  const paywallDismissFallback = paywallDismissFallbackForFeature(feature);

  useEffect(() => {
    if (isFocused && locked) track('contextual_paywall_shown', { feature });
  }, [isFocused, locked, feature]);

  if (!isFocused) return null;

  if (isLoading || !data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 justify-center">
          <View
            className="rounded-card bg-paper-raised p-5"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <View
              className="mb-4 h-10 w-10 items-center justify-center rounded-[12px]"
              style={{ backgroundColor: colors.clayTint }}
            >
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.clay }} />
            </View>
            <Text variant="label" tone="muted">
              PRO ACCESS
            </Text>
            <Text variant="title" className="mt-2" style={{ fontSize: 28, lineHeight: 32 }}>
              Checking your access
            </Text>
            <Text variant="body" tone="muted" className="mt-2">
              We will keep Pro-only screens hidden until your subscription status is confirmed.
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  if (!locked) return <>{children}</>;

  const copy = UPSELL_COPY[feature];
  const paywallTitle = microShortPaywall
    ? feature === 'photo_timeline'
      ? 'Unlock photos.'
      : 'Unlock Pro.'
    : copy.title;
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const priceIntroLabel = lapsedEntitlement ? 'Restore Pro for' : annualDisplay.introLabel;
  const primaryCtaLabel = lapsedEntitlement
    ? lapsedReverseTrial
      ? PAYWALL_COPY.reoffer.keepCta
      : PAYWALL_COPY.downgrade.renewCta
    : PAYWALL_COPY.offer.cta;

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

  function onStartReverseTrial() {
    setActionFeedback(null);
    startReverseTrial.mutate(undefined, {
      onError: () => setActionFeedback(PAYWALL_FEEDBACK.exploreFirstUnavailable),
    });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View
        className={
          headerCompliancePaywall
            ? splitShortProgressTabPaywall
              ? 'min-h-[48px] flex-row items-start justify-between gap-2 pt-0'
              : narrowShortPaywall
                ? 'min-h-[48px] flex-row items-start justify-between gap-2 pt-0'
                : ultraShortPaywall
                  ? 'min-h-[96px] items-stretch pt-0'
                  : 'min-h-[48px] flex-row items-start justify-between gap-2 pt-1'
            : 'flex-row justify-end pt-1'
        }
      >
        {headerCompliancePaywall ? <ComplianceRow density="compactHeader" /> : null}
        {splitShortProgressTabPaywall || narrowShortPaywall ? (
          <RouteIconButton
            accessibilityLabel="Maybe later"
            glyph="x"
            tone="muted"
            onPress={() => dismissPaywall(router, paywallDismissFallback)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => dismissPaywall(router, paywallDismissFallback)}
            className={
              headerCompliancePaywall && ultraShortPaywall
                ? 'h-[48px] self-end justify-center px-2'
                : 'h-[48px] justify-center px-2'
            }
          >
            <Text variant="body" tone="muted" className="font-sans-medium">
              Maybe later
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: compactPaywall ? 'flex-start' : 'center',
          paddingTop: shortPaywall ? 0 : compactPaywall ? 4 : 0,
          paddingBottom: compactProgressPhotoPaywall
            ? 96
            : shortPaywall
              ? 16
              : compactPaywall
                ? 112
                : 24,
        }}
      >
        {shortPaywall ? null : (
          <View
            className={
              compactPaywall
                ? 'mb-2 h-10 w-10 self-start items-center justify-center rounded-[12px]'
                : 'mb-5 h-[52px] w-[52px] items-center justify-center rounded-[14px]'
            }
            style={{ backgroundColor: colors.clayTint }}
          >
            <View
              className={compactPaywall ? 'h-2.5 w-2.5 rounded-full' : 'h-3.5 w-3.5 rounded-full'}
              style={{ backgroundColor: colors.clay }}
            />
          </View>
        )}
        <Text
          variant="title"
          adjustsFontSizeToFit={microShortPaywall}
          minimumFontScale={0.86}
          numberOfLines={microShortPaywall ? 1 : undefined}
          style={{
            fontSize: microShortPaywall
              ? 18
              : narrowShortPaywall
              ? 22
              : ultraShortPaywall
                ? 24
                : shortPaywall
                  ? 26
                  : compactPaywall
                    ? 28
                    : 32,
            lineHeight: microShortPaywall
              ? 21
              : narrowShortPaywall
              ? 25
              : ultraShortPaywall
                ? 27
                : shortPaywall
                  ? 29
                  : compactPaywall
                    ? 32
                    : 36,
          }}
          accessibilityLabel={copy.title}
        >
          {paywallTitle}
        </Text>
        {splitShortProgressTabPaywall || microShortPaywall || narrowShortPaywall ? null : (
          <Text
            variant="body"
            tone="muted"
            className={shortPaywall ? 'mt-1.5' : compactPaywall ? 'mt-2' : 'mt-3'}
            numberOfLines={ultraShortPaywall ? 2 : undefined}
            ellipsizeMode="tail"
            style={{
              fontSize: ultraShortPaywall
                ? 13
                : shortPaywall
                  ? 14
                  : compactPaywall
                    ? 15
                    : undefined,
              lineHeight: ultraShortPaywall ? 17 : shortPaywall ? 18 : compactPaywall ? 21 : 24,
            }}
          >
            {copy.body}
          </Text>
        )}
        <View
          className={
            narrowShortPaywall
              ? 'mt-1 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-1.5'
              : ultraShortPaywall
                ? microShortPaywall
                  ? 'mt-1 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-1'
                  : 'mt-1.5 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-1.5'
                : shortPaywall
                  ? 'mt-2 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-2'
                  : compactPaywall
                    ? 'mt-3 flex-row items-center justify-between rounded-card bg-paper-raised px-3.5 py-3'
                    : 'mt-7 flex-row items-center justify-between rounded-card bg-paper-raised p-4'
          }
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <View>
            {narrowShortPaywall ? null : (
              <Text variant="bodySm" tone="muted">
                {priceIntroLabel}
              </Text>
            )}
            <Text
              variant="title"
              adjustsFontSizeToFit={microShortPaywall || narrowShortPaywall}
              minimumFontScale={0.82}
              numberOfLines={microShortPaywall || narrowShortPaywall ? 1 : undefined}
              style={{
                fontSize: microShortPaywall
                  ? 18
                  : narrowShortPaywall
                    ? 20
                    : shortPaywall
                      ? 22
                      : compactPaywall
                        ? 24
                        : 26,
                lineHeight: microShortPaywall
                  ? 21
                  : narrowShortPaywall
                    ? 23
                    : shortPaywall
                      ? 25
                      : compactPaywall
                        ? 28
                        : 30,
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
          {annualDisplay.pricePerMonthLabel && !ultraShortPaywall && !narrowShortPaywall ? (
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
              narrowShortPaywall
                ? 'mt-0.5 text-center'
                : ultraShortPaywall
                  ? 'mt-0.5 text-center'
                  : shortPaywall
                    ? 'mt-1 text-center'
                    : compactPaywall
                      ? 'mt-1 text-center'
                      : 'mt-2 text-center'
            }
            style={{
              fontSize: narrowShortPaywall
                ? 10
                : ultraShortPaywall
                  ? 10
                  : shortPaywall
                    ? 10.5
                    : compactPaywall
                      ? 11
                      : 12,
              lineHeight: narrowShortPaywall
                ? 12
                : ultraShortPaywall
                  ? 12
                  : shortPaywall
                    ? 14
                    : compactPaywall
                      ? 15
                      : 17,
            }}
          >
            {storeUnavailableReason}
          </Text>
        ) : null}
        <Pressable
          accessibilityLabel={primaryCtaLabel}
          accessibilityRole="button"
          disabled={startTrial.isPending}
          onPress={onStartTrial}
          className={
            narrowShortPaywall
              ? 'mt-1 h-[48px] items-center justify-center rounded-pill'
              : ultraShortPaywall
                ? microShortPaywall
                  ? 'mt-0 h-[48px] items-center justify-center rounded-pill'
                  : 'mt-1 h-[48px] items-center justify-center rounded-pill'
                : shortPaywall
                  ? 'mt-1.5 h-[48px] items-center justify-center rounded-pill'
                  : compactPaywall
                    ? 'mt-2 h-[50px] items-center justify-center rounded-pill'
                    : 'mt-4 h-[54px] items-center justify-center rounded-pill'
          }
          style={[
            microShortDeferredCtaStyle,
            { backgroundColor: canPurchase ? colors.clay : colors.mutedLight },
          ]}
        >
          <Text
            adjustsFontSizeToFit
            className="font-sans-semibold"
            minimumFontScale={0.86}
            numberOfLines={1}
            style={{
              color: colors.paper,
              fontSize: microShortPaywall ? 15.5 : 17,
              lineHeight: microShortPaywall ? 18 : undefined,
            }}
          >
            {primaryCtaLabel}
          </Text>
        </Pressable>
        {showExploreFirst && !ultraShortPaywall && !narrowShortPaywall ? (
          <Pressable
            accessibilityRole="button"
            disabled={startReverseTrial.isPending}
            onPress={onStartReverseTrial}
            className={
              ultraShortPaywall
                ? 'mt-1 min-h-[48px] flex-row items-center gap-2 rounded-card px-3 py-1.5'
                : shortPaywall
                  ? 'mt-1.5 min-h-[48px] flex-row items-center gap-2 rounded-card px-3 py-1.5'
                  : compactPaywall
                    ? 'mt-2 min-h-[48px] flex-row items-center gap-2 rounded-card px-3 py-2'
                    : 'mt-3 min-h-[52px] flex-row items-center gap-3 rounded-card px-3.5 py-3'
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
              <View
                className="h-3 w-3 rounded-full border-2"
                style={{ borderColor: colors.clay }}
              />
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
                {PAYWALL_COPY.offer.exploreTitle}
              </Text>
              <Text
                variant="label"
                numberOfLines={ultraShortPaywall ? 1 : undefined}
                ellipsizeMode="tail"
                style={{
                  color: colors.clay,
                  fontSize: compactPaywall ? 10.5 : 11.5,
                  lineHeight: compactPaywall ? 13 : undefined,
                }}
              >
                {PAYWALL_COPY.offer.exploreBody}
              </Text>
            </View>
            <Text style={{ color: colors.clay, fontSize: 18 }}>›</Text>
          </Pressable>
        ) : null}
        <PaywallFeedback
          compact={compactPaywall}
          feedback={actionFeedback}
          className={
            shortPaywall
              ? 'mt-1.5 rounded-card px-3 py-2'
              : compactPaywall
                ? 'mt-2 rounded-card px-3 py-2'
                : undefined
          }
        />
        {headerCompliancePaywall ? null : <ComplianceRow />}
      </ScrollView>
    </Screen>
  );
}

/** HOC to gate a whole screen behind Pro with one line at the default export. */
export function withProGate<P extends object>(
  feature: GatedFeature,
  Component: (props: P) => ReactNode,
) {
  return function Gated(props: P) {
    return (
      <ProGate feature={feature}>
        <Component {...props} />
      </ProGate>
    );
  };
}
