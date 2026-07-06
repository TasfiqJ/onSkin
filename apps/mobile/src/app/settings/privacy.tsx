import { Redirect } from 'expo-router';

// Privacy controls currently live on the You tab; this keeps direct entries
// inside the app instead of showing Expo Router's unmatched-route page.
export default function SettingsPrivacyAlias() {
  return <Redirect href="/(tabs)/you" />;
}
