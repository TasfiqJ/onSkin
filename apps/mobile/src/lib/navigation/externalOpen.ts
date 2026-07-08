import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { safeExternalHttpsUrl } from './externalUrl';

export type ExternalOpenMode = 'browser' | 'linking';

export type ExternalOpenOptions = {
  mode?: ExternalOpenMode;
  alertOnFailure?: boolean;
  invalidTitle?: string;
  invalidMessage?: string;
  failureTitle?: string;
  failureMessage?: string;
};

function shouldForceExternalOpenFailure(mode: ExternalOpenMode): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_EXTERNAL_OPEN_FAILURE?.trim().toLowerCase();
  if (!fixture) return false;
  const tokens = fixture
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return tokens.includes('all') || tokens.includes(mode);
}

export async function openExternalHttpsUrl(
  url: string | null | undefined,
  options: ExternalOpenOptions = {},
): Promise<boolean> {
  const safeUrl = safeExternalHttpsUrl(url);
  if (!safeUrl) {
    return false;
  }

  try {
    const mode = options.mode ?? 'browser';
    if (shouldForceExternalOpenFailure(mode)) {
      throw new Error('E2E_EXTERNAL_OPEN_FAILURE');
    }
    if (mode === 'linking') {
      await Linking.openURL(safeUrl);
    } else {
      await WebBrowser.openBrowserAsync(safeUrl);
    }
    return true;
  } catch {
    return false;
  }
}
