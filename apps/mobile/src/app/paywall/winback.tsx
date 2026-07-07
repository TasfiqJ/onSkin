import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { ComplianceRow } from '@/features/subscription/ComplianceRow';
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
  const { height } = useWindowDimensions();
  const { winback } = useEntitlementActions();
  const offering = useSubscriptionOffering();
  const offer = offering.data?.winBack ?? null;
  const canWinBack = offering.data?.status === 'available' && offer?.canPurchase;
  const annualDisplay = planPriceDisplay('annual', offering.data);
  const unavailableOfferCopy =
    'A native welcome-back offer is not available on this account. You can still choose the current Pro plan.';
  const compactPaywall = height < 640;

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
        </View>
        <ComplianceRow tone="dark" />
      </ScrollView>
      <View className="gap-2.5" style={{ backgroundColor: BG, paddingTop: compactPaywall ? 8 : 0 }}>
        {!canWinBack ? (
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
