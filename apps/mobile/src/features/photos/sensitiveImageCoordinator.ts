import { captureAccountIdentityGeneration } from '@/lib/auth/accountGeneration';

import { decryptPhotoToDataUri, type PhotoRenditionReadExpectation } from './encryptedStorage';
import {
  SensitiveImageDecryptCoordinator,
  type SensitiveImageRequest,
  type SensitiveImageRequestPriority,
} from './sensitiveImageCoordinatorCore';
import { SENSITIVE_IMAGE_MAX_CONCURRENT_DECRYPTS } from './sensitiveImagePolicy';

const expectations = new Map<string, PhotoRenditionReadExpectation>();
const coordinator = new SensitiveImageDecryptCoordinator(
  (uri) => {
    const expected = expectations.get(uri);
    if (!expected) throw new Error('PHOTO_RENDITION_IDENTITY_REQUIRED');
    return decryptPhotoToDataUri(uri, expected);
  }, {
  maxConcurrent: SENSITIVE_IMAGE_MAX_CONCURRENT_DECRYPTS,
  getOwnerGeneration: captureAccountIdentityGeneration,
  });

export function requestSensitiveImage(
  requestKey: string,
  uri: string,
  expectedOwnerGeneration: number,
  expected: PhotoRenditionReadExpectation,
  priority: SensitiveImageRequestPriority = 'interactive',
): SensitiveImageRequest {
  try {
    expectations.set(uri, expected);
    return coordinator.request(requestKey, uri, priority, expectedOwnerGeneration);
  } catch (error) {
    return Object.freeze({
      promise: Promise.reject(error),
      cancel: () => undefined,
      promote: () => undefined,
    });
  }
}

export function purgeSensitiveImageCoordinator(): void {
  coordinator.purge();
}
