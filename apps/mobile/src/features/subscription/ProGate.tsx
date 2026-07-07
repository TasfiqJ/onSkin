import { router, usePathname } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';
import type { GatedFeature } from '@onskin/types';

import { ComplianceRow } from './ComplianceRow';
import { PAYWALL_COPY, UPSELL_COPY } from './copy';
import { dismissPaywall } from './dismissPaywall';
import { canStartContextualReverseTrial } from './entitlement';
import { planPriceDisplay } from './priceDisplay';
import { useEntitlement, useEntitlementActions } from './useEntitlement';
import { useSubscriptionOffering } from './useSubscriptionOffering';

// Feature gate (docs/08 §3.2/§4). When the user is Pro (incl. the reverse trial /
// carded trial), render the feature; otherwise render a calm, honest contextual
// paywall framed around THIS feature, with the same compliance posture. Dismissible,
// never nagging. The infra is generic. Applying it to more surfaces is mechanical.
export function ProGate({ feature, children }: { feature: GatedFeature; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const pathname = usePathname();
  const { data, isLoading } = useEntitlement();
  const { startReverseTrial, startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const locked = data ? !data.isPro : false;
  const compactPaywall = height < 640;
  const insideTabbedPhotoPaywall = pathname === '/progress' && feature === 'photo_timeline';
  const compactTabbedPhotoPaywall = compactPaywall && insideTabbedPhotoPaywall;
  const compactComplianceSpacer = compactTabbedPhotoPaywall ? 112 : 0;
  const showExploreFirst = data ? canStartContextualReverseTrial(data) : false;

  useEffect(() => {
    if (locked) track('contextual_paywall_shown', { feature });
  }, [locked, feature]);

  if (isLoading || !data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View />
      </Screen>
    );
  }

  if (!locked) return <>{children}</>;

  const copy = UPSELL_COPY[feature];
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);

  function onStartTrial() {
    if (!canPurchase) {
      Alert.alert('Store pricing unavailable', offering.data?.reason ?? 'Please try again later.');
      return;
    }
    startTrial.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (!result.cancelled)
          Alert.alert('Purchase not active', 'No active subscription was found for this account.');
      },
      onError: () =>
        Alert.alert(
          'Purchase unavailable',
          'We could not open the store purchase sheet. Please try again.',
        ),
    });
  }

  function onStartReverseTrial() {
    startReverseTrial.mutate(undefined, {
      onError: () =>
        Alert.alert(
          'Explore first unavailable',
          'We could not start the no-card Pro week for this account.',
        ),
    });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row justify-end pt-1">
        <Pressable
          accessibilityRole="button"
          onPress={() => dismissPaywall(router)}
          className="h-[48px] justify-center px-2"
        >
          <Text variant="body" tone="muted" className="font-sans-medium">
            Maybe later
          </Text>
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: compactPaywall ? 'flex-start' : 'center',
          paddingTop: compactTabbedPhotoPaywall ? 0 : compactPaywall ? 4 : 0,
          paddingBottom: compactTabbedPhotoPaywall ? 144 : compactPaywall ? 112 : 24,
        }}
      >
        {compactTabbedPhotoPaywall ? null : (
          <View
            className={
              compactPaywall
                ? 'mb-2 h-10 w-10 self-start items-center justify-center rounded-[12px]'
                : 'mb-5 h-[52px] w-[52px] items-center justify-center rounded-[14px]'
            }
            style={{ backgroundColor: colors.clayTint }}
          >
            <View
              className={
                compactPaywall ? 'h-2.5 w-2.5 rounded-full' : 'h-3.5 w-3.5 rounded-full'
              }
              style={{ backgroundColor: colors.clay }}
            />
          </View>
        )}
        <Text
          variant="title"
          style={{
            fontSize: compactTabbedPhotoPaywall ? 26 : compactPaywall ? 28 : 32,
            lineHeight: compactTabbedPhotoPaywall ? 29 : compactPaywall ? 32 : 36,
          }}
        >
          {copy.title}
        </Text>
        <Text
          variant="body"
          tone="muted"
          className={compactPaywall ? 'mt-2' : 'mt-3'}
          style={{
            fontSize: compactTabbedPhotoPaywall ? 14 : compactPaywall ? 15 : undefined,
            lineHeight: compactTabbedPhotoPaywall ? 19 : compactPaywall ? 21 : 24,
          }}
        >
          {copy.body}
        </Text>
        <View
          className={
            compactTabbedPhotoPaywall
              ? 'mt-2.5 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-2.5'
              : compactPaywall
                ? 'mt-3 flex-row items-center justify-between rounded-card bg-paper-raised px-3.5 py-3'
                : 'mt-7 flex-row items-center justify-between rounded-card bg-paper-raised p-4'
          }
          style={{ borderWidth: 1, borderColor: colors.hairline }}
        >
          <View>
            <Text variant="bodySm" tone="muted">
              {annualDisplay.introLabel}
            </Text>
            <Text
              variant="title"
              style={{
                fontSize: compactTabbedPhotoPaywall ? 22 : compactPaywall ? 24 : 26,
                lineHeight: compactTabbedPhotoPaywall ? 25 : compactPaywall ? 28 : 30,
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
          {annualDisplay.pricePerMonthLabel ? (
            <Text variant="label" tone="muted">{`${annualDisplay.pricePerMonthLabel}\n/mo`}</Text>
          ) : null}
        </View>
        {offering.data?.status && offering.data.status !== 'available' ? (
          <Text
            variant="bodySm"
            tone="muted"
            className={compactPaywall ? 'mt-1 text-center' : 'mt-2 text-center'}
            style={{
              fontSize: compactTabbedPhotoPaywall ? 10.5 : compactPaywall ? 11 : 12,
              lineHeight: compactTabbedPhotoPaywall ? 14 : compactPaywall ? 15 : 17,
            }}
          >
            {offering.data.reason}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className={
            compactTabbedPhotoPaywall
              ? 'mt-1.5 h-[48px] items-center justify-center rounded-pill'
              : compactPaywall
                ? 'mt-2 h-[50px] items-center justify-center rounded-pill'
                : 'mt-4 h-[54px] items-center justify-center rounded-pill'
          }
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
            Start free trial
          </Text>
        </Pressable>
        {showExploreFirst ? (
          <Pressable
            accessibilityRole="button"
            disabled={startReverseTrial.isPending}
            onPress={onStartReverseTrial}
            className={
              compactTabbedPhotoPaywall
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
        {compactComplianceSpacer > 0 ? <View style={{ height: compactComplianceSpacer }} /> : null}
        <ComplianceRow />
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
