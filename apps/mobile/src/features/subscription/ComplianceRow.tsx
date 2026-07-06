import { Alert, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
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

export function openPolicy(url: string) {
  void openExternalHttpsUrl(url, {
    invalidTitle: 'Link not configured',
    invalidMessage: 'This policy URL must be configured before launch.',
    failureTitle: 'Link unavailable',
    failureMessage: 'We could not open this policy link. Please try again.',
  });
}

export function ComplianceRow({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { restore } = useEntitlementActions();
  const color = tone === 'dark' ? 'rgba(244,239,231,0.7)' : colors.muted;
  const sep = tone === 'dark' ? 'rgba(244,239,231,0.3)' : colors.greigeDeep;

  function onRestore() {
    restore.mutate(undefined, {
      onSuccess: (result) =>
        Alert.alert(
          'Restore purchases',
          result.active
            ? 'Your active subscription is restored on this device.'
            : 'No active subscription was found for this account.',
        ),
      onError: () =>
        Alert.alert('Restore purchases', 'We could not restore purchases. Please try again.'),
    });
  }

  const label = (text: string) => (
    <Text className="font-sans-semibold" style={{ fontSize: 12, color }}>
      {text}
    </Text>
  );

  return (
    <View className="min-h-[48px] flex-row items-center justify-center gap-2.5">
      <Pressable
        accessibilityRole="button"
        onPress={() => openPolicy(TERMS_URL)}
        className="min-h-[48px] min-w-[48px] items-center justify-center px-1"
        style={{ minHeight: 48, minWidth: 48 }}
      >
        {label('Terms')}
      </Pressable>
      <Text style={{ color: sep }}>·</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => openPolicy(PRIVACY_URL)}
        className="min-h-[48px] min-w-[48px] items-center justify-center px-1"
        style={{ minHeight: 48, minWidth: 48 }}
      >
        {label('Privacy')}
      </Pressable>
      <Text style={{ color: sep }}>·</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRestore}
        className="min-h-[48px] min-w-[48px] items-center justify-center px-1"
        style={{ minHeight: 48, minWidth: 48 }}
      >
        {label('Restore')}
      </Pressable>
    </View>
  );
}
