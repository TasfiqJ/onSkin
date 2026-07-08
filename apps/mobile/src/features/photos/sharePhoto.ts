import * as Sharing from 'expo-sharing';

import { createPhotoShareFile, deletePhotoShareFile } from './encryptedStorage';

type ShareablePhoto = {
  id: string;
  localUri?: string | null;
};

function shouldForcePhotoShareFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE === '1';
}

export async function sharePhotoImageOnly(photo?: ShareablePhoto | null): Promise<boolean> {
  if (!photo?.localUri) {
    return false;
  }

  if (shouldForcePhotoShareFailure()) {
    return false;
  }

  let sharingAvailable = false;
  try {
    sharingAvailable = await Sharing.isAvailableAsync();
  } catch {
    return false;
  }

  if (!sharingAvailable) {
    return false;
  }

  let shareUri: string | null = null;
  try {
    shareUri = await createPhotoShareFile(photo.localUri, photo.id);
    await Sharing.shareAsync(shareUri);
    return true;
  } catch {
    return false;
  } finally {
    await deletePhotoShareFile(shareUri, photo.localUri);
  }
}
