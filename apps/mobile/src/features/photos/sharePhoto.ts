import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { PHOTO_COPY } from './copy';
import { createPhotoShareFile, deletePhotoShareFile } from './encryptedStorage';

type ShareablePhoto = {
  id: string;
  localUri?: string | null;
};

function alertShareUnavailable(): void {
  Alert.alert(PHOTO_COPY.detail.shareTitle, PHOTO_COPY.detail.shareUnavailable);
}

export async function sharePhotoImageOnly(photo?: ShareablePhoto | null): Promise<boolean> {
  if (!photo?.localUri) {
    alertShareUnavailable();
    return false;
  }

  let sharingAvailable = false;
  try {
    sharingAvailable = await Sharing.isAvailableAsync();
  } catch {
    alertShareUnavailable();
    return false;
  }

  if (!sharingAvailable) {
    alertShareUnavailable();
    return false;
  }

  let shareUri: string | null = null;
  try {
    shareUri = await createPhotoShareFile(photo.localUri, photo.id);
    await Sharing.shareAsync(shareUri);
    return true;
  } catch {
    alertShareUnavailable();
    return false;
  } finally {
    await deletePhotoShareFile(shareUri, photo.localUri);
  }
}
