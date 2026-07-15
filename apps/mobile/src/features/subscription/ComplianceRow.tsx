import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { storeTransactionRecoveryMessage } from '@/lib/iap/storeTransactionNotice';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { openExternalHttpsUrl } from '@/lib/navigation/externalOpen';
import { colors } from '@/theme/tokens';

import { useEntitlementActions } from './useEntitlement';

// Terms · Privacy · Restore. Apple Guideline 3.1.2 requires all three present and
// FUNCTIONAL in the paywall binary (docs/08 §3.1/§7). Terms/Privacy open the policy
// pages (placeholder URLs until counsel supplies final copy. B-PRIVACY-COPY);
// Restore re-syncs entitlements (docs/08 §3.3).
// Placeholder policy pages. Final text is B-PRIVACY-COPY / B-LEGAL; the LINKS are
// functional (Apple 3.1.2 requires functional Terms/Privacy in the binary).
export const TERMS_URL = POLICY_LINKS.terms.url;
export const PRIVACY_URL = POLICY_LINKS.privacy.url;

const POLICY_LINK_UNAVAILABLE_MESSAGE =
  'Link unavailable. We could not open this policy link. Please try again.';

function restoreFeedbackMessage(active: boolean): string {
  return active
    ? 'Your active subscription is restored on this device.'
    : 'No active subscription was found for this account.';
}

export function openPolicy(url: string): Promise<boolean> {
  return openExternalHttpsUrl(url, {
    invalidTitle: 'Link not configured',
    invalidMessage: 'This policy URL must be configured before launch.',
    failureTitle: 'Link unavailable',
    failureMessage: 'We could not open this policy link. Please try again.',
    alertOnFailure: false,
  });
}

export function ComplianceRow({
  tone = 'light',
  density = 'default',
}: {
  tone?: 'light' | 'dark';
  density?: 'default' | 'compactHeader';
}) {
  const { restore } = useEntitlementActions();
  const compactHeader = density === 'compactHeader';
  const color = tone === 'dark' ? 'rgba(244,239,231,0.7)' : colors.muted;
  const sep = tone === 'dark' ? 'rgba(244,239,231,0.3)' : colors.greigeDeep;
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onPolicy(url: string) {
    setFeedback(null);
    const opened = await openPolicy(url);
    if (!opened) setFeedback(POLICY_LINK_UNAVAILABLE_MESSAGE);
  }

  function onRestore() {
    setFeedback(null);
    restore.mutate(undefined, {
      onSuccess: (result) => {
        const message = restoreFeedbackMessage(result.active);
        setFeedback(message);
      },
      onError: (error) => {
        const message =
          storeTransactionRecoveryMessage(error, 'restore') ??
          'We could not restore purchases. Please try again.';
        setFeedback(message);
      },
    });
  }

  const label = (text: string) => (
    <Text className="font-sans-semibold" style={{ fontSize: compactHeader ? 11 : 12, color }}>
      {text}
    </Text>
  );

  return (
    <View className={compactHeader ? 'flex-1 items-start' : 'items-center'}>
      <View
        className={
          compactHeader
            ? 'min-h-[48px] flex-row items-center justify-start gap-1'
            : 'min-h-[48px] flex-row items-center justify-center gap-2.5'
        }
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => void onPolicy(TERMS_URL)}
          className={
            compactHeader
              ? 'min-h-[48px] min-w-[48px] items-center justify-center px-0'
              : 'min-h-[48px] min-w-[48px] items-center justify-center px-1'
          }
          style={{ minHeight: 48, minWidth: 48 }}
        >
          {label('Terms')}
        </Pressable>
        <Text style={{ color: sep }}>·</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onPolicy(PRIVACY_URL)}
          className={
            compactHeader
              ? 'min-h-[48px] min-w-[48px] items-center justify-center px-0'
              : 'min-h-[48px] min-w-[48px] items-center justify-center px-1'
          }
          style={{ minHeight: 48, minWidth: 48 }}
        >
          {label('Privacy')}
        </Pressable>
        <Text style={{ color: sep }}>·</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRestore}
          className={
            compactHeader
              ? 'min-h-[48px] min-w-[48px] items-center justify-center px-0'
              : 'min-h-[48px] min-w-[48px] items-center justify-center px-1'
          }
          style={{ minHeight: 48, minWidth: 48 }}
        >
          {label('Restore')}
        </Pressable>
      </View>
      {feedback ? (
        <Text
          accessibilityRole="alert"
          variant="bodySm"
          className={compactHeader ? 'pb-1 pr-2 text-left' : 'px-4 pb-2 text-center'}
          style={{
            color,
            fontSize: compactHeader ? 10.5 : 12,
            lineHeight: compactHeader ? 14 : 16,
          }}
        >
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}
