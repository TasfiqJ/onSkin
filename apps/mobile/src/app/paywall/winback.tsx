import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { dismissPaywall } from '@/features/subscription/dismissPaywall';
import { planPriceDisplay } from '@/features/subscription/priceDisplay';
import { useEntitlementActions } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// Honest win-back (design 09, docs/08 §6). Value restated, a respectful 30%-off
// offer, an easy "no". Sparse, ARL-clean, never pressuring. Dark surface.
const BG = '#1B1813';

export default function WinbackScreen() {
  const insets = useSafeAreaInsets();
  const { winback } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const offer = offering.data?.winBack ?? null;
  const canWinBack = offering.data?.status === 'available' && offer?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);

  function onComeBack() {
    if (!canWinBack) {
      router.replace('/paywall/upsell?feature=full_routine');
      return;
    }
    winback.mutate(undefined, {
      onSuccess: (result) => {
        if (result.active) router.replace('/paywall/success');
        else if (result.offerUnavailable)
          Alert.alert(
            'Offer unavailable',
            'This welcome-back offer is not available for this account right now.',
          );
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

  useEffect(() => {
    track('winback_shown');
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BG,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 16,
        paddingHorizontal: 30,
      }}
    >
      <View className="flex-1 justify-center">
        <Text variant="label" style={{ color: 'rgba(244,239,231,0.5)', letterSpacing: 2 }}>
          {PAYWALL_COPY.winback.eyebrow.toUpperCase()}
        </Text>
        <Text
          variant="display"
          className="mt-3.5"
          style={{ color: colors.cream, fontSize: 40, lineHeight: 43 }}
        >
          {PAYWALL_COPY.winback.title}
        </Text>
        <Text
          variant="body"
          className="mt-4"
          style={{ color: 'rgba(244,239,231,0.7)', lineHeight: 25 }}
        >
          {PAYWALL_COPY.winback.body}
        </Text>
        <View className="mt-6 rounded-card p-5" style={{ backgroundColor: colors.nightSurface }}>
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
        </View>
        {!canWinBack ? (
          <Text
            variant="label"
            className="mt-3"
            style={{ color: 'rgba(244,239,231,0.55)', fontSize: 11.5, lineHeight: 16 }}
          >
            A native welcome-back offer is not available on this account. You can still choose the
            current Pro plan.
          </Text>
        ) : null}
      </View>
      <View className="gap-3">
        <Pressable
          accessibilityRole="button"
          disabled={winback.isPending}
          onPress={onComeBack}
          className="h-[54px] items-center justify-center rounded-pill"
          style={{ backgroundColor: colors.cream }}
        >
          <Text className="font-sans-semibold" style={{ color: colors.ink, fontSize: 16 }}>
            {canWinBack ? PAYWALL_COPY.winback.cta : 'See current Pro plan'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => dismissPaywall(router)}
          className="h-[40px] items-center justify-center"
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
