import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking } from 'react-native';

import { safeExternalHttpsUrl } from './externalUrl';

export type ExternalOpenMode = 'browser' | 'linking';

export type ExternalOpenOptions = {
  mode?: ExternalOpenMode;
  invalidTitle?: string;
  invalidMessage?: string;
  failureTitle?: string;
  failureMessage?: string;
};

const DEFAULT_INVALID_TITLE = 'Link not configured';
const DEFAULT_INVALID_MESSAGE = 'This link must be configured before launch.';
const DEFAULT_FAILURE_TITLE = 'Link unavailable';
const DEFAULT_FAILURE_MESSAGE = 'We could not open this link. Please try again.';

export async function openExternalHttpsUrl(
  url: string | null | undefined,
  options: ExternalOpenOptions = {},
): Promise<boolean> {
  const safeUrl = safeExternalHttpsUrl(url);
  if (!safeUrl) {
    Alert.alert(
      options.invalidTitle ?? DEFAULT_INVALID_TITLE,
      options.invalidMessage ?? DEFAULT_INVALID_MESSAGE,
    );
    return false;
  }

  try {
    if (options.mode === 'linking') {
      await Linking.openURL(safeUrl);
    } else {
      await WebBrowser.openBrowserAsync(safeUrl);
    }
    return true;
  } catch {
    Alert.alert(
      options.failureTitle ?? DEFAULT_FAILURE_TITLE,
      options.failureMessage ?? DEFAULT_FAILURE_MESSAGE,
    );
    return false;
  }
}
