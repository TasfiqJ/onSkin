import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const SHARE_CARD_EXPORT_SIZE = { width: 1080, height: 1920 } as const;

function e2eShareCardExportFailure(): 'unavailable' | 'capture_failure' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const fixture = process.env.EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT?.trim().toLowerCase();
  if (fixture === 'unavailable' || fixture === 'share_unavailable') return 'unavailable';
  if (fixture === 'capture_failure' || fixture === 'capture_error') return 'capture_failure';

  return null;
}

// One-tap watermarked export of the Shelf Conflict Card. Captures the branded card
// View to a 1080x1920 PNG and hands it to the OS share sheet. The watermark, CTA,
// and public link label are baked into the image, so a screenshot or re-share still
// credits the app and points back to the funnel. Returns false when the device can't
// share or the card isn't mounted yet.
export async function shareConflictCard(ref: RefObject<View | null>): Promise<boolean> {
  if (!ref.current) return false;
  const e2eFailure = e2eShareCardExportFailure();
  if (e2eFailure === 'unavailable') return false;
  if (e2eFailure === 'capture_failure') throw new Error('E2E_SHARE_CARD_EXPORT_CAPTURE_FAILURE');

  const uri = await captureRef(ref, {
    ...SHARE_CARD_EXPORT_SIZE,
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  try {
    try {
      if (!(await Sharing.isAvailableAsync())) return false;
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your shelf check',
        UTI: 'public.png',
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
