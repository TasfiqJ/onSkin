import { Alert, Linking } from 'react-native';

export type OpenAppSettingsOptions = {
  failureTitle?: string;
  failureMessage?: string;
  alertOnFailure?: boolean;
};

const DEFAULT_FAILURE_TITLE = 'Settings unavailable';
const DEFAULT_FAILURE_MESSAGE =
  "We couldn't open Settings. You can still use another path in the app.";

function shouldForceAppSettingsFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE === '1';
}

export async function openAppSettings(options: OpenAppSettingsOptions = {}): Promise<boolean> {
  try {
    if (shouldForceAppSettingsFailure()) {
      throw new Error('E2E_APP_SETTINGS_FAILURE');
    }
    await Linking.openSettings();
    return true;
  } catch {
    if (options.alertOnFailure !== false) {
      Alert.alert(
        options.failureTitle ?? DEFAULT_FAILURE_TITLE,
        options.failureMessage ?? DEFAULT_FAILURE_MESSAGE,
      );
    }
    return false;
  }
}
