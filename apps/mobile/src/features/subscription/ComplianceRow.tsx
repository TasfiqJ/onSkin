import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { POLICY_LINKS } from '@/lib/legal/policyLinks';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';
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
  const safeUrl = safeExternalHttpsUrl(url);
  if (!safeUrl) {
    Alert.alert('Link not configured', 'This policy URL must be configured before launch.');
    return;
  }
  void WebBrowser.openBrowserAsync(safeUrl).catch(() => {});
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
      onError: () => Alert.alert('Restore purchases', 'We could not restore purchases. Please try again.'),
    });
  }

  const label = (text: string) => (
    <Text className="font-sans-semibold" style={{ fontSize: 12, color }}>
      {text}
    </Text>
  );

  return (
    <View className="flex-row items-center justify-center gap-3.5 py-3">
      <Pressable accessibilityRole="button" onPress={() => openPolicy(TERMS_URL)} hitSlop={8}>
        {label('Terms')}
      </Pressable>
      <Text style={{ color: sep }}>·</Text>
      <Pressable accessibilityRole="button" onPress={() => openPolicy(PRIVACY_URL)} hitSlop={8}>
        {label('Privacy')}
      </Pressable>
      <Text style={{ color: sep }}>·</Text>
      <Pressable accessibilityRole="button" onPress={onRestore} hitSlop={8}>
        {label('Restore')}
      </Pressable>
    </View>
  );
}
