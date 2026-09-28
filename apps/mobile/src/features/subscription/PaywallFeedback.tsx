import { View } from 'react-native';

import { Text } from '@/components/ui';
import { storeTransactionRecoveryMessage } from '@/lib/iap/storeTransactionNotice';
import { colors } from '@/theme/tokens';

export type PaywallFeedbackState = {
  title: string;
  body: string;
};

export const PAYWALL_FEEDBACK = {
  storePricingUnavailable: (reason?: string | null): PaywallFeedbackState => ({
    title: 'Store pricing unavailable',
    body: reason ?? 'Please try again later.',
  }),
  purchaseNotActive: {
    title: 'Purchase not active',
    body: 'No active subscription was found for this account.',
  },
  purchaseCancelled: {
    title: 'Purchase not completed',
    body: 'No new charge was made. If you expected access from an earlier purchase, use Restore purchases.',
  },
  purchaseUnavailable: {
    title: 'Purchase unavailable',
    body: 'We could not open the store purchase sheet. Please try again.',
  },
  purchaseError: (error: unknown): PaywallFeedbackState => {
    const uncertain = storeTransactionRecoveryMessage(error, 'purchase');
    return uncertain
      ? { title: 'Purchase status needs confirmation', body: uncertain }
      : {
          title: 'Purchase unavailable',
          body: 'We could not open the store purchase sheet. Please try again.',
        };
  },
  exploreFirstUnavailable: {
    title: 'Explore first unavailable',
    body: 'We could not start the no-card Pro week for this account.',
  },
  offerUnavailable: {
    title: 'Offer unavailable',
    body: 'This welcome-back offer is not available for this account right now.',
  },
} as const;

export function PaywallFeedback({
  feedback,
  tone = 'light',
  compact = false,
  className,
}: {
  feedback: PaywallFeedbackState | null;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}) {
  if (!feedback) return null;

  const dark = tone === 'dark';

  return (
    <View
      accessibilityRole="alert"
      className={className ?? (compact ? 'mt-2 rounded-card px-3 py-2' : 'mt-3 rounded-card p-3')}
      style={{
        backgroundColor: dark ? 'rgba(244,239,231,0.08)' : colors.clayTint,
        borderWidth: 1,
        borderColor: dark ? 'rgba(244,239,231,0.16)' : 'rgba(165,105,75,0.22)',
      }}
    >
      <Text
        variant="bodySm"
        className="font-sans-semibold"
        style={{
          color: dark ? colors.cream : colors.clayDeep,
          fontSize: compact ? 12.5 : undefined,
          lineHeight: compact ? 16 : undefined,
        }}
      >
        {feedback.title}
      </Text>
      <Text
        variant="label"
        className="mt-0.5"
        style={{
          color: dark ? 'rgba(244,239,231,0.68)' : colors.clay,
          fontSize: compact ? 10.8 : 11.5,
          lineHeight: compact ? 14 : 16,
        }}
      >
        {feedback.body}
      </Text>
    </View>
  );
}
