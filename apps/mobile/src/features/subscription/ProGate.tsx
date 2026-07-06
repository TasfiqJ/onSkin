import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';
import type { GatedFeature } from '@onskin/types';

import { ComplianceRow } from './ComplianceRow';
import { UPSELL_COPY } from './copy';
import { dismissPaywall } from './dismissPaywall';
import { planPriceDisplay } from './priceDisplay';
import { useEntitlement, useEntitlementActions } from './useEntitlement';
import { useSubscriptionOffering } from './useSubscriptionOffering';

// Feature gate (docs/08 §3.2/§4). When the user is Pro (incl. the reverse trial /
// carded trial), render the feature; otherwise render a calm, honest contextual
// paywall framed around THIS feature, with the same compliance posture. Dismissible,
// never nagging. The infra is generic. Applying it to more surfaces is mechanical.
export function ProGate({ feature, children }: { feature: GatedFeature; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const { data, isLoading } = useEntitlement();
  const { startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const locked = data ? !data.isPro : false;
  const compactPaywall = height < 640;

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
          paddingTop: compactPaywall ? 4 : 0,
          paddingBottom: compactPaywall ? 112 : 24,
        }}
      >
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
        <Text
          variant="title"
          style={{ fontSize: compactPaywall ? 28 : 32, lineHeight: compactPaywall ? 32 : 36 }}
        >
          {copy.title}
        </Text>
        <Text
          variant="body"
          tone="muted"
          className={compactPaywall ? 'mt-2' : 'mt-3'}
          style={{ fontSize: compactPaywall ? 15 : undefined, lineHeight: compactPaywall ? 21 : 24 }}
        >
          {copy.body}
        </Text>
        <View
          className={
            compactPaywall
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
              style={{ fontSize: compactPaywall ? 24 : 26, lineHeight: compactPaywall ? 28 : 30 }}
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
            variant="label"
            tone="muted"
            className={compactPaywall ? 'mt-1 text-center' : 'mt-2 text-center'}
            style={{ fontSize: compactPaywall ? 10.5 : 11.5, lineHeight: compactPaywall ? 14 : 16 }}
          >
            {offering.data.reason}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className={
            compactPaywall
              ? 'mt-2 h-[50px] items-center justify-center rounded-pill'
              : 'mt-4 h-[54px] items-center justify-center rounded-pill'
          }
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
            Start free trial
          </Text>
        </Pressable>
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
