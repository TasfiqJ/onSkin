import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

import { useEntitlementActions } from './useEntitlement';

// Terms · Privacy · Restore — Apple Guideline 3.1.2 requires all three present and
// FUNCTIONAL in the paywall binary (docs/08 §3.1/§7). Terms/Privacy open the policy
// pages (placeholder URLs until counsel supplies final copy — B-PRIVACY-COPY);
// Restore re-syncs entitlements (docs/08 §3.3).
// Placeholder policy pages — final text is B-PRIVACY-COPY / B-LEGAL; the LINKS are
// functional (Apple 3.1.2 requires functional Terms/Privacy in the binary).
export const TERMS_URL = 'https://onskin.app/terms';
export const PRIVACY_URL = 'https://onskin.app/privacy';

export function openPolicy(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => {});
}

export function ComplianceRow({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { restore } = useEntitlementActions();
  const color = tone === 'dark' ? 'rgba(244,239,231,0.7)' : colors.muted;
  const sep = tone === 'dark' ? 'rgba(244,239,231,0.3)' : colors.greigeDeep;

  function onRestore() {
    restore.mutate(undefined, {
      onSettled: () =>
        Alert.alert('Restore purchases', 'We re-synced your account. Any active subscription is now restored on this device.'),
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
