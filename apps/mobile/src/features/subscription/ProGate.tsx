import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';
import type { GatedFeature } from '@onskin/types';

import { ComplianceRow } from './ComplianceRow';
import { UPSELL_COPY } from './copy';
import { useEntitlement, useEntitlementActions } from './useEntitlement';
import { useSubscriptionOffering } from './useSubscriptionOffering';

// Feature gate (docs/08 §3.2/§4). When the user is Pro (incl. the reverse trial /
// carded trial), render the feature; otherwise render a calm, honest contextual
// paywall framed around THIS feature, with the same compliance posture. Dismissible,
// never nagging. The infra is generic. Applying it to more surfaces is mechanical.
export function ProGate({ feature, children }: { feature: GatedFeature; children: ReactNode }) {
  const { data } = useEntitlement();
  const { startTrial } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const locked = data ? !data.isPro : false; // while loading, don't flash the wall

  useEffect(() => {
    if (locked) track('contextual_paywall_shown', { feature });
  }, [locked, feature]);

  if (!locked) return <>{children}</>;

  const copy = UPSELL_COPY[feature];
  const annual = offering.data?.annual ?? null;
  const canPurchase = offering.data?.status === 'available' && annual?.canPurchase;

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

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row justify-end pt-1">
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'))}
          hitSlop={8}>
          <Text variant="body" tone="muted" className="font-sans-medium">
            Maybe later
          </Text>
        </Pressable>
      </View>
      <View className="flex-1 justify-center">
        <View
          className="mb-5 h-[52px] w-[52px] items-center justify-center rounded-[14px]"
          style={{ backgroundColor: colors.clayTint }}>
          <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: colors.clay }} />
        </View>
        <Text variant="title" style={{ fontSize: 32, lineHeight: 36 }}>
          {copy.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-3" style={{ lineHeight: 24 }}>
          {copy.body}
        </Text>
        <View
          className="mt-7 flex-row items-center justify-between rounded-card bg-paper-raised p-4"
          style={{ borderWidth: 1, borderColor: colors.hairline }}>
          <View>
            <Text variant="bodySm" tone="muted">
              {annual?.trialDays ? `Start ${annual.trialDays} days free, then` : 'Subscribe for'}
            </Text>
            <Text variant="title" style={{ fontSize: 26, lineHeight: 30 }}>
              {annual?.priceLabel ?? 'Unavailable'}
              <Text variant="bodySm" tone="muted">
                /{annual?.periodLabel ?? 'year'}
              </Text>
            </Text>
          </View>
          {annual?.pricePerMonthLabel ? <Text variant="label" tone="muted">{`${annual.pricePerMonthLabel}\n/mo`}</Text> : null}
        </View>
        {offering.data?.status && offering.data.status !== 'available' ? (
          <Text variant="label" tone="muted" className="mt-2 text-center" style={{ fontSize: 11.5, lineHeight: 16 }}>
            {offering.data.reason}
          </Text>
        ) : null}
      </View>
      <View className="pb-4">
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}>
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 17 }}>
            Start free trial
          </Text>
        </Pressable>
        <ComplianceRow />
      </View>
    </Screen>
  );
}

/** HOC to gate a whole screen behind Pro with one line at the default export. */
export function withProGate<P extends object>(feature: GatedFeature, Component: (props: P) => ReactNode) {
  return function Gated(props: P) {
    return (
      <ProGate feature={feature}>
        <Component {...props} />
      </ProGate>
    );
  };
}
