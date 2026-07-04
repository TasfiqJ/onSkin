import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const SHARE_CARD_EXPORT_SIZE = { width: 1080, height: 1920 } as const;

// One-tap watermarked export of the Shelf Conflict Card. Captures the branded card
// View to a 1080x1920 PNG and hands it to the OS share sheet. The watermark, CTA,
// and public link label are baked into the image, so a screenshot or re-share still
// credits OnSkin and points back to the funnel. Returns false when the device can't
// share or the card isn't mounted yet.
export async function shareConflictCard(ref: RefObject<View | null>): Promise<boolean> {
  if (!ref.current) return false;
  const uri = await captureRef(ref, {
    ...SHARE_CARD_EXPORT_SIZE,
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share your shelf check',
    UTI: 'public.png',
  });
  return true;
}
