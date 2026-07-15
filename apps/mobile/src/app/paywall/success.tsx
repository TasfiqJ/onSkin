import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import { DirectPaywallLoading } from '@/features/subscription/DirectPaywallResolution';
import {
  consumePurchaseSuccessReceipt,
  type PurchaseSuccessReceipt,
} from '@/features/subscription/purchaseSuccessReceipt';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

// Purchase success (design 05, docs/08 section 3.3). A calm confirmation with honest
// renewal terms, routing straight into the value (Day-0 is decisive). The copy
// branches on whether the verified action is a carded TRIAL or an
// immediate PAID entitlement (win-back / direct buy, no trial), so we never tell a
// paid win-back user they are in a free trial that will convert.
function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function SuccessScreen() {
  const params = useLocalSearchParams<{ receipt?: string | string[] }>();
  const receiptId = Array.isArray(params.receipt) ? params.receipt[0] : params.receipt;
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const redemptionKey = `${ownerScope.generation}:${receiptId ?? ''}`;
  const attemptedRedemptionKey = useRef<string | null>(null);
  const [redemption, setRedemption] = useState<{
    key: string | null;
    receipt: PurchaseSuccessReceipt | null | undefined;
  }>({ key: null, receipt: undefined });
  const compactPhone = height < 640;
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    null;

  useEffect(() => {
    // The ref survives React's development effect replay, while the vault's
    // atomic consume prevents refresh/back/direct-link success fabrication.
    if (attemptedRedemptionKey.current === redemptionKey) return;
    attemptedRedemptionKey.current = redemptionKey;
    setRedemption({
      key: redemptionKey,
      receipt: consumePurchaseSuccessReceipt(ownerScope, receiptId),
    });
  }, [ownerScope, receiptId, redemptionKey]);

  const currentReceipt = !isOwnerQueryScopeCurrent(ownerScope)
    ? null
    : redemption.key === redemptionKey
      ? redemption.receipt
      : undefined;

  if (currentReceipt === undefined) return <DirectPaywallLoading />;

  if (currentReceipt === null) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <Text variant="title" className="text-center" style={{ fontSize: 30, lineHeight: 34 }}>
            No recent purchase to confirm
          </Text>
          <Text
            accessibilityRole="alert"
            variant="body"
            tone="muted"
            className="mt-3 text-center"
            style={{ lineHeight: 24, maxWidth: 320 }}
          >
            Purchase confirmation is shown only immediately after this account’s verified store
            action.
          </Text>
        </View>
        <View className={compactPhone ? 'pb-4' : 'pb-2'}>
          <Button label="Back to Today" onPress={() => router.replace('/(tabs)/today')} />
        </View>
      </Screen>
    );
  }

  const inTrial = currentReceipt.inTrial;
  const endDate = fmt(currentReceipt.expiresAt);
  const body = inTrial
    ? PAYWALL_COPY.success.bodyForTrial(
        currentReceipt.willRenew,
        currentReceipt.renewalPriceLabel,
        currentReceipt.renewalPeriodLabel,
      )
    : PAYWALL_COPY.success.bodyForPaid(
        currentReceipt.action,
        currentReceipt.purchasePriceLabel,
        currentReceipt.purchasePeriodLabel,
        currentReceipt.offerDurationLabel,
        currentReceipt.willRenew,
        currentReceipt.renewalPriceLabel,
        currentReceipt.renewalPeriodLabel,
      );
  const metaRows = inTrial
    ? PAYWALL_COPY.success.metaRowsForTrial(
        endDate,
        currentReceipt.willRenew,
        currentReceipt.renewalPriceLabel,
        currentReceipt.renewalPeriodLabel,
      )
    : PAYWALL_COPY.success.metaRowsForPaid(
        currentReceipt.action,
        endDate,
        currentReceipt.purchasePriceLabel,
        currentReceipt.purchasePeriodLabel,
        currentReceipt.offerDurationLabel,
        currentReceipt.willRenew,
        currentReceipt.renewalPriceLabel,
        currentReceipt.renewalPeriodLabel,
      );

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
