import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// Reverse-trial expired → honest loss-aversion re-offer (design 03, docs/08 §3.2/§6).
// Earned by real use, data preserved, an easy "no". Never a data-deleting lock.
export default function ReofferScreen() {
  const { startTrial, downgrade } = useEntitlementActions();
  const offering = useSubscriptionOffering();
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
        else if (!result.cancelled) Alert.alert('Purchase not active', 'No active subscription was found for this account.');
      },
      onError: () => Alert.alert('Purchase unavailable', 'We could not open the store purchase sheet. Please try again.'),
    });
  }

  useEffect(() => {
    track('paywall_shown', { context: 'reverse_trial_reoffer' });
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1">
        <View className="mt-2 flex-row items-center gap-2 self-start rounded-pill px-4 py-2" style={{ backgroundColor: colors.greige }}>
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clay }} />
          <Text variant="label" className="font-sans-bold" tone="muted" style={{ fontSize: 12.5 }}>
            {PAYWALL_COPY.reoffer.pill}
          </Text>
        </View>
        <Text variant="title" className="mt-5" style={{ fontSize: 32, lineHeight: 36 }}>
          {PAYWALL_COPY.reoffer.title}
        </Text>
        <Text variant="body" tone="muted" className="mt-2.5" style={{ lineHeight: 24 }}>
          {PAYWALL_COPY.reoffer.body}
        </Text>
        <View className="mt-5 rounded-card bg-paper-raised px-[18px]" style={{ borderWidth: 1, borderColor: colors.hairline }}>
          {PAYWALL_COPY.reoffer.continues.map((c, i) => (
            <View
              key={c}
              className="flex-row items-center gap-3 py-3"
              style={i < PAYWALL_COPY.reoffer.continues.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.hairline } : undefined}>
              <View className="h-[18px] w-[18px] items-center justify-center rounded-full" style={{ backgroundColor: colors.clayTint }}>
                <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clay }} />
              </View>
              <Text variant="bodySm" style={{ color: colors.inkSoft }}>
                {c}
              </Text>
            </View>
          ))}
        </View>
        <View className="mt-4 flex-row items-center justify-between rounded-card p-4" style={{ backgroundColor: colors.clayTint }}>
          <Text variant="bodySm" style={{ color: colors.clayDeep }}>
            {annualDisplay.introLabel}
          </Text>
          <Text variant="title" style={{ color: colors.clayDeep, fontSize: 24 }}>
            {annualDisplay.priceLabel}
            {annualDisplay.periodLabel ? (
              <Text variant="bodySm" style={{ color: colors.clayDeep }}>
                /{annualDisplay.periodLabel}
              </Text>
            ) : null}
          </Text>
        </View>
        {offering.data?.status && offering.data.status !== 'available' ? (
          <Text variant="label" tone="muted" className="mt-2 text-center" style={{ fontSize: 11.5, lineHeight: 16 }}>
            {offering.data.reason}
          </Text>
        ) : null}
      </View>
      <View className="gap-2.5 pb-2">
        <Pressable
          accessibilityRole="button"
          disabled={!canPurchase || startTrial.isPending}
          onPress={onStartTrial}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: canPurchase ? colors.clay : colors.mutedLight }}>
          <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
            {PAYWALL_COPY.reoffer.keepCta}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => downgrade.mutate(undefined, { onSettled: () => router.replace('/(tabs)/today') })}
          className="h-[42px] items-center justify-center">
          <Text className="font-sans-semibold" tone="muted" variant="body">
            {PAYWALL_COPY.reoffer.declineCta}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
