import { getAccountGeneration } from '@/lib/auth/accountGeneration';

import { decryptPhotoToDataUri } from './encryptedStorage';
import {
  SensitiveImageDecryptCoordinator,
  type SensitiveImageRequest,
  type SensitiveImageRequestPriority,
} from './sensitiveImageCoordinatorCore';
import { SENSITIVE_IMAGE_MAX_CONCURRENT_DECRYPTS } from './sensitiveImagePolicy';

const coordinator = new SensitiveImageDecryptCoordinator(decryptPhotoToDataUri, {
  maxConcurrent: SENSITIVE_IMAGE_MAX_CONCURRENT_DECRYPTS,
  getOwnerGeneration: getAccountGeneration,
});

export function requestSensitiveImage(
  requestKey: string,
  uri: string,
  expectedOwnerGeneration: number,
  priority: SensitiveImageRequestPriority = 'interactive',
): SensitiveImageRequest {
  try {
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
