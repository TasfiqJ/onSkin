export const SENSITIVE_IMAGE_CACHE_POLICY = 'none' as const;
export const SENSITIVE_IMAGE_TRANSITION_MS = 0;
/**
 * Photo-v1 amplifies one image through JSON, hex, base64, and a data URI. Keep
 * it serial until native rendition traces prove that two concurrent decrypts
 * fit the supported-device memory budget. The public plan ceiling remains two.
 */
export const SENSITIVE_IMAGE_MAX_CONCURRENT_DECRYPTS = 1;

export type SensitiveImageAppState = 'active' | 'background' | 'extension' | 'inactive' | 'unknown';

export function shouldPurgeSensitiveImagesForAppState(state: SensitiveImageAppState): boolean {
  return state !== 'active';
}
