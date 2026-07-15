import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { PAYWALL_COPY } from './copy';
import type { SubscriptionState } from './entitlement';
import { useEntitlement } from './useEntitlement';

// A calm, non-nagging "you're exploring Pro" banner (design 02, docs/08 §6/§12).
// Renders only during the reverse trial; taps through to the manage/keep screen.
// During a carded trial we stay quiet (the 2-day reminder + manage screen cover it).
export type ReverseTrialBannerProps = {
  compact?: boolean;
  tone?: 'light' | 'night';
};

export function ReverseTrialBannerFromEntitlement({
  data,
  compact = false,
  tone = 'light',
}: ReverseTrialBannerProps & { data: SubscriptionState | undefined }) {
  if (!data?.inReverseTrial) return null;
  const daysLeft = data.daysLeft ?? 0;
  const night = tone === 'night';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="You're exploring Pro. Manage your plan"
      onPress={() => router.push('/settings/subscription')}
      className={
        compact
          ? 'mb-3 flex-row items-center gap-2.5 rounded-card p-3'
          : 'mb-4 flex-row items-center gap-3 rounded-card p-4'
      }
      style={{
        backgroundColor: night ? colors.nightSurface : colors.clayTint,
        borderWidth: 1,
        borderColor: night ? colors.hairlineDark : 'rgba(165,105,75,0.22)',
      }}
    >
      <View
        className={
          compact
            ? 'h-8 w-8 items-center justify-center rounded-full'
            : 'h-[38px] w-[38px] items-center justify-center rounded-full'
        }
        style={{ backgroundColor: colors.clay }}
      >
        <View className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: colors.paper }} />
      </View>
      <View className="flex-1">
        <Text
          variant="body"
          className="font-sans-bold"
          style={{ color: night ? colors.cream : colors.clayDeep }}
        >
          {PAYWALL_COPY.reverseTrial.bannerTitle(daysLeft)}
        </Text>
        {compact ? null : (
          <Text variant="bodySm" style={{ color: night ? colors.clayBright : colors.clay }}>
            {PAYWALL_COPY.reverseTrial.bannerBody}
          </Text>
        )}
      </View>
      <Text style={{ color: night ? colors.clayBright : colors.clay, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

/** Standalone banner. Route view models should pass their owned entitlement data. */
export function ReverseTrialBanner(props: ReverseTrialBannerProps) {
  const { data } = useEntitlement();
  return <ReverseTrialBannerFromEntitlement {...props} data={data} />;
}
