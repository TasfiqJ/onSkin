import * as Sharing from 'expo-sharing';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';

import {
  createPhotoShareFile as createIdentityBoundPhotoShareFile,
  deletePhotoShareFile,
} from './encryptedStorage';

type ShareablePhoto = {
  id: string;
  localUri?: string | null;
  captureSessionId?: string | null;
};

function shouldForcePhotoShareFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return process.env.EXPO_PUBLIC_E2E_SHARE_PHOTO_FAILURE === '1';
}

export async function sharePhotoImageOnly(photo?: ShareablePhoto | null): Promise<boolean> {
  const localUri = photo?.localUri;
  if (!localUri) {
    return false;
  }

  if (shouldForcePhotoShareFailure()) {
    return false;
  }

  try {
    return await runAccountGenerationOperation(async (lease) => {
      const sharingAvailable = await Sharing.isAvailableAsync();
      lease.assertCurrent();
      if (!sharingAvailable) return false;

      let shareUri: string | null = null;
      const createPhotoShareFile = (uri: string) =>
        createIdentityBoundPhotoShareFile(uri, {
          photoId: photo!.id,
          captureSessionId: photo!.captureSessionId ?? null,
          rendition: 'original',
          allowLegacyEnvelope: true,
        });
      try {
        shareUri = await createPhotoShareFile(localUri);
        lease.assertCurrent();
        await Sharing.shareAsync(shareUri);
        lease.assertCurrent();
        return true;
      } finally {
        await deletePhotoShareFile(shareUri, localUri);
      }
    });
  } catch {
    return false;
  }
}
