import { StateNotice } from '@/components/ui';
import type { InterfaceStateKind } from '@/theme/stateTokens';

export type PaywallFeedbackState = {
  title: string;
  body: string;
  kind: Extract<InterfaceStateKind, 'loading' | 'error' | 'unavailable'>;
};

export const PAYWALL_FEEDBACK = {
  storePricingUnavailable: (reason?: string | null): PaywallFeedbackState => ({
    kind: 'unavailable',
    title: 'Store pricing unavailable',
    body: reason ?? 'Please try again later.',
  }),
  purchaseNotActive: {
    kind: 'unavailable',
    title: 'Purchase not active',
    body: 'No active subscription was found for this account.',
  },
  purchaseUnavailable: {
    kind: 'error',
    title: 'Purchase unavailable',
    body: 'We could not open the store purchase sheet. Please try again.',
  },
  verificationPending: {
    kind: 'loading',
    title: 'Store verification pending',
    body: 'The store result could not be verified yet. Do not purchase again. Check your connection, retry verification, or use Restore.',
  },
  purchasePending: {
    kind: 'loading',
    title: 'Purchase pending',
    body: 'Approval or payment is still pending. Do not purchase again. Access will unlock after the store confirms it; use Restore if needed.',
  },
  exploreFirstUnavailable: {
    kind: 'error',
    title: 'Explore first unavailable',
    body: 'We could not start the no-card Pro week for this account.',
  },
  offerUnavailable: {
    kind: 'unavailable',
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

  return (
    <StateNotice
      kind={feedback.kind}
      tone={tone === 'dark' ? 'night' : 'paper'}
      compact={compact}
      className={className ?? (compact ? 'mt-2' : 'mt-3')}
      title={feedback.title}
      body={feedback.body}
      showIndicator={false}
    />
  );
}
