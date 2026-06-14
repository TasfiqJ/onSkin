import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { PLANS } from '@/features/subscription/plans';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors } from '@/theme/tokens';

// Purchase success (design 05, docs/08 §3.3). A calm confirmation with honest
// renewal terms, routing straight into the value (Day-0 is decisive).
function fmt(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + PLANS.annual.trialDays * 86_400_000);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function SuccessScreen() {
  const { user } = useAuth();
  const { data } = useEntitlement();
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    null;
  const price = PLANS.annual.priceLabel;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center">
        <View className="mb-7 h-[72px] w-[72px] items-center justify-center rounded-full" style={{ backgroundColor: colors.clay }}>
          <Text style={{ color: colors.paper, fontSize: 34 }}>✓</Text>
        </View>
        <Text variant="display" className="text-center" style={{ fontSize: 42, lineHeight: 45 }}>
          {PAYWALL_COPY.success.titleFor(firstName)}
        </Text>
        <Text variant="body" tone="muted" className="mt-3.5 text-center" style={{ lineHeight: 25, maxWidth: 320 }}>
          {PAYWALL_COPY.success.bodyFor(price)}
        </Text>
        <Text variant="label" tone="muted" className="mt-3.5">
          {PAYWALL_COPY.success.metaFor(fmt(data?.expiresAt ?? null), price)}
        </Text>
      </View>
      <Button label={PAYWALL_COPY.success.cta} onPress={() => router.replace('/(tabs)/today')} />
    </Screen>
  );
}
