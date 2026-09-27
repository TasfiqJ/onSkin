import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import {
  cleanupPlaintextStaging,
  isCanonicalImageManipulatorJpegName,
  markPlaintextStagingState,
  reservePlaintextStaging,
  retryPlaintextStagingRecovery,
  runPlaintextImageManipulatorOperation,
  type PlaintextStagingHandle,
} from '@/lib/storage/plaintextStaging';

import {
  deleteEncryptedPhoto,
  encryptPhotoRendition,
  type EncryptedPhotoWrite,
} from './encryptedStorage';

const THUMBNAIL_WIDTH = 320;

type ThumbnailDependencies = Readonly<{
  cacheDirectory: string | null;
  cleanup: (handle: PlaintextStagingHandle) => Promise<void>;
  deleteEncrypted: (uri: string) => Promise<void>;
  encrypt: (
    uri: string,
    identity: { photoId: string; captureSessionId: string | null; rendition: 'thumbnail' },
  ) => Promise<EncryptedPhotoWrite>;
  manipulate: (uri: string) => Promise<{ uri: string }>;
  markWritten: (handle: PlaintextStagingHandle) => Promise<void>;
  move: (input: { from: string; to: string }) => Promise<void>;
  reserve: () => Promise<PlaintextStagingHandle>;
  retryRecovery: () => Promise<unknown>;
  runGenerated: <T>(operation: () => Promise<T>) => Promise<T>;
}>;

export function trustedThumbnailManipulatorUri(
  value: unknown,
  cacheDirectory: string | null | undefined,
): string | null {
  if (typeof value !== 'string' || !cacheDirectory?.startsWith('file://')) return null;
  const directory = `${cacheDirectory.replace(/\/+$/u, '')}/ImageManipulator/`;
  if (!value.startsWith(directory)) return null;
  const name = value.slice(directory.length);
  return isCanonicalImageManipulatorJpegName(name) ? value : null;
}

export function createEncryptedPhotoThumbnailPipeline(deps: ThumbnailDependencies) {
  return async function createThumbnail(input: {
    sourceUri: string;
    photoId: string;
    captureSessionId: string | null;
  }): Promise<EncryptedPhotoWrite> {
    let handle: PlaintextStagingHandle;
    try {
      // The durable, content-free reservation precedes native manipulation so
      // process death cannot create an unowned plaintext derivative.
      handle = await deps.reserve();
    } catch (error) {
      await deps.retryRecovery().catch(() => undefined);
      throw error;
    }

    let encrypted: EncryptedPhotoWrite | null = null;
    let primaryError: unknown = null;
    try {
      await deps.runGenerated(async () => {
        const generated = await deps.manipulate(input.sourceUri);
        const generatedUri = trustedThumbnailManipulatorUri(generated.uri, deps.cacheDirectory);
        if (generatedUri === null) throw new Error('PHOTO_THUMBNAIL_URI_UNTRUSTED');
        await deps.move({ from: generatedUri, to: handle.uri });
        await deps.markWritten(handle);
      });
      encrypted = await deps.encrypt(handle.uri, {
        photoId: input.photoId,
        captureSessionId: input.captureSessionId,
        rendition: 'thumbnail',
      });
    } catch (error) {
      primaryError = error;
    }

    try {
      await deps.cleanup(handle);
    } catch (cleanupError) {
      try {
        await deps.retryRecovery();
      } catch (recoveryError) {
        if (encrypted) await deps.deleteEncrypted(encrypted.encryptedLocalUri);
        throw new Error('PHOTO_THUMBNAIL_PLAINTEXT_CLEANUP_REQUIRED', {
          cause: recoveryError ?? cleanupError,
        });
      }
    }
    if (primaryError !== null) throw primaryError;
    return encrypted!;
  };
}

const defaultPipeline = createEncryptedPhotoThumbnailPipeline({
  cacheDirectory: FileSystem.cacheDirectory,
  cleanup: cleanupPlaintextStaging,
  deleteEncrypted: (uri) => deleteEncryptedPhoto(uri),
  encrypt: encryptPhotoRendition,
  manipulate: (uri) =>
    manipulateAsync(uri, [{ resize: { width: THUMBNAIL_WIDTH } }], {
      compress: 0.72,
      format: SaveFormat.JPEG,
    }),
  markWritten: (handle) => markPlaintextStagingState(handle, 'plaintext_written'),
  move: FileSystem.moveAsync,
  reserve: () => reservePlaintextStaging('photo_thumbnail_jpeg'),
  retryRecovery: retryPlaintextStagingRecovery,
  runGenerated: runPlaintextImageManipulatorOperation,
});

export function createEncryptedPhotoThumbnail(input: {
  sourceUri: string;
  photoId: string;
  captureSessionId: string | null;
}): Promise<EncryptedPhotoWrite> {
  return defaultPipeline(input);
}
