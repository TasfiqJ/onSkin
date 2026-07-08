import { Linking } from 'react-native';

export type OpenAppSettingsOptions = {
  failureTitle?: string;
  failureMessage?: string;
  alertOnFailure?: boolean;
};

function shouldForceAppSettingsFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE === '1';
}

export async function openAppSettings(_options: OpenAppSettingsOptions = {}): Promise<boolean> {
  try {
    if (shouldForceAppSettingsFailure()) {
      throw new Error('E2E_APP_SETTINGS_FAILURE');
    }
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
