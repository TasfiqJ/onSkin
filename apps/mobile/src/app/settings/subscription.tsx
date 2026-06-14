import { router } from 'expo-router';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { openPolicy, PRIVACY_URL } from '@/features/subscription/ComplianceRow';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { PLANS } from '@/features/subscription/plans';
import { useEntitlement, useEntitlementActions } from '@/features/subscription/useEntitlement';
import { MANAGE_SUBSCRIPTION_URL_ANDROID, MANAGE_SUBSCRIPTION_URL_IOS } from '@/lib/iap/revenuecat';
import { track } from '@/lib/analytics/track';
import { colors } from '@/theme/tokens';

// Manage subscription (design 06, docs/08 §3.4). Plan/state, renewal date, one-tap
// OS cancel deep-link, Restore, Terms/Privacy. ARL-compliant: cancel as easy as
// signup, no maze. Shows a calm free-state when not subscribed.
function fmtDate(iso: string | null): string {
  if (!iso) return ', ';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Row({ label, last, onPress }: { label: string; last?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between py-3.5"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
      <Text variant="body" className="font-sans-semibold">
        {label}
      </Text>
      <Text style={{ color: colors.mutedLight, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export default function SubscriptionScreen() {
  const { data } = useEntitlement();
  const { restore } = useEntitlementActions();
  const isPro = data?.isPro ?? false;

  function openStore() {
    track('manage_subscription_opened');
    void Linking.openURL(Platform.OS === 'android' ? MANAGE_SUBSCRIPTION_URL_ANDROID : MANAGE_SUBSCRIPTION_URL_IOS).catch(() => {});
  }
  function onRestore() {
    restore.mutate(undefined, {
      onSettled: () => Alert.alert('Restore purchases', 'We re-synced your account on this device.'),
    });
  }

  const periodLabel = data?.inReverseTrial
    ? 'Reverse trial'
    : data?.inTrial
      ? 'Free trial'
      : `Annual · ${PLANS.annual.priceLabel}/yr`;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.greige }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-10">
        <View className="mb-3 flex-row items-center gap-3 pt-1">
          <Text accessibilityRole="button" onPress={() => router.back()} variant="body" style={{ fontSize: 22 }}>
            ‹
          </Text>
          <Text variant="title" style={{ fontSize: 28 }}>
            {PAYWALL_COPY.manage.title}
          </Text>
        </View>

        {isPro ? (
          <>
            <View className="mb-4 rounded-card p-5" style={{ backgroundColor: colors.ink }}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="titleSm" style={{ color: colors.cream, fontSize: 22 }}>
                  OnSkin Pro
                </Text>
                <View className="rounded-pill px-2.5 py-1" style={{ backgroundColor: 'rgba(157,177,138,0.2)' }}>
                  <Text variant="label" className="font-sans-bold" style={{ color: '#9DB18A', fontSize: 11 }}>
                    {data?.inReverseTrial || data?.inTrial ? 'Trial' : PAYWALL_COPY.manage.activeLabel}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(244,239,231,0.1)' }}>
                <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                  Plan
                </Text>
                <Text variant="bodySm" className="font-sans-semibold" style={{ color: colors.cream }}>
                  {periodLabel}
                </Text>
              </View>
              <View className="flex-row justify-between py-2">
                <Text variant="bodySm" style={{ color: 'rgba(244,239,231,0.55)' }}>
                  {data?.inReverseTrial ? 'Free until' : data?.willRenew ? 'Renews' : 'Ends'}
                </Text>
                <Text variant="bodySm" className="font-sans-semibold" style={{ color: colors.cream }}>
                  {fmtDate(data?.expiresAt ?? null)}
                </Text>
              </View>
            </View>

            <View className="mb-4 rounded-[18px] bg-paper-raised px-[18px]">
              <Row label={PAYWALL_COPY.manage.manageRow} onPress={openStore} />
              <Row label={PAYWALL_COPY.manage.restoreRow} onPress={onRestore} />
              <Row label={PAYWALL_COPY.manage.termsRow} last onPress={() => openPolicy(PRIVACY_URL)} />
            </View>

            <View className="flex-row gap-3 rounded-card bg-paper-raised p-4" style={{ borderWidth: 1, borderColor: colors.hairline }}>
              <View className="mt-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#9DB18A' }} />
              <Text variant="bodySm" className="flex-1" style={{ color: colors.mutedStrong, lineHeight: 19 }}>
                {PAYWALL_COPY.manage.cancelNote(fmtDate(data?.expiresAt ?? null))}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View className="mb-4 rounded-card bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
              <Text variant="titleSm">{PAYWALL_COPY.manage.freeTitle}</Text>
              <Text variant="bodySm" tone="muted" className="mt-2" style={{ lineHeight: 21 }}>
                {PAYWALL_COPY.manage.freeBody}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/paywall/upsell?feature=full_routine')}
                className="mt-4 h-[50px] items-center justify-center rounded-pill"
                style={{ backgroundColor: colors.clay }}>
                <Text className="font-sans-semibold" style={{ color: colors.paper, fontSize: 16 }}>
                  {PAYWALL_COPY.manage.upgradeCta}
                </Text>
              </Pressable>
            </View>
            <View className="rounded-[18px] bg-paper-raised px-[18px]">
              <Row label={PAYWALL_COPY.manage.restoreRow} last onPress={onRestore} />
            </View>
            {data?.expired ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/paywall/winback')}
                className="mt-4 items-center py-2">
                <Text variant="body" tone="clay" className="font-sans-semibold">
                  See your welcome-back offer →
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
