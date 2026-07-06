import { Alert, Linking } from 'react-native';

export type OpenAppSettingsOptions = {
  failureTitle?: string;
  failureMessage?: string;
};

const DEFAULT_FAILURE_TITLE = 'Settings unavailable';
const DEFAULT_FAILURE_MESSAGE =
  "We couldn't open Settings. You can still use another path in the app.";

export async function openAppSettings(options: OpenAppSettingsOptions = {}): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    Alert.alert(
      options.failureTitle ?? DEFAULT_FAILURE_TITLE,
      options.failureMessage ?? DEFAULT_FAILURE_MESSAGE,
    );
    return false;
  }
}
