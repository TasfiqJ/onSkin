import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { PLANS } from '@/features/subscription/plans';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { useSubscriptionOffering } from '@/features/subscription/useSubscriptionOffering';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors } from '@/theme/tokens';

// Purchase success (design 05, docs/08 §3.3). A calm confirmation with honest
// renewal terms, routing straight into the value (Day-0 is decisive). The copy
// branches on whether this is a carded TRIAL (14 days, will convert) or an
// immediate PAID entitlement (win-back / direct buy, no trial), so we never tell a
// paid win-back user they are in a free trial that will convert.
function fmt(iso: string | null, fallbackDays: number): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + fallbackDays * 86_400_000);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function SuccessScreen() {
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const { data } = useEntitlement();
  const offering = useSubscriptionOffering();
  const compactPhone = height < 640;
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    null;

  const inTrial = data?.inTrial ?? true; // default to the trial flow (the common path)
  const price = data?.priceLabel ?? offering.data?.annual?.priceLabel ?? 'the store price';
  const endDate = fmt(data?.expiresAt ?? null, inTrial ? PLANS.annual.trialDays : 365);
  const body = inTrial
    ? PAYWALL_COPY.success.bodyFor(price)
    : PAYWALL_COPY.success.bodyForPaid(price);
  const metaRows = inTrial
    ? PAYWALL_COPY.success.metaRowsFor(endDate, price)
    : PAYWALL_COPY.success.metaRowsForPaid(endDate, price);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center">
        <View
          className="mb-7 h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{ backgroundColor: colors.clay }}
        >
          <Text
            style={{
              color: colors.paper,
              fontSize: 34,
              includeFontPadding: false,
              lineHeight: 38,
              textAlign: 'center',
            }}
          >
            {'\u2713'}
          </Text>
        </View>
        <Text variant="display" className="text-center" style={{ fontSize: 42, lineHeight: 45 }}>
          {PAYWALL_COPY.success.titleFor(firstName)}
        </Text>
        <Text
          variant="body"
          tone="muted"
          className="mt-3.5 text-center"
          style={{ lineHeight: 25, maxWidth: 320 }}
        >
          {body}
        </Text>
        <View
          className="mt-4 w-full max-w-[272px] rounded-card px-4 py-3"
          style={{ backgroundColor: colors.greige, borderColor: colors.hairline, borderWidth: 1 }}
        >
          {metaRows.map((row) => (
            <Text
              key={row}
              variant="label"
              tone="muted"
              className="text-center"
              style={{ lineHeight: 18 }}
            >
              {row}
            </Text>
          ))}
        </View>
      </View>
      <View className={compactPhone ? 'pb-4' : 'pb-2'}>
        <Button label={PAYWALL_COPY.success.cta} onPress={() => router.replace('/(tabs)/today')} />
      </View>
    </Screen>
  );
}
