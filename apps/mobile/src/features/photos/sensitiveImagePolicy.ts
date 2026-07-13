export const SENSITIVE_IMAGE_CACHE_POLICY = 'none' as const;
export const SENSITIVE_IMAGE_TRANSITION_MS = 0;

export type SensitiveImageAppState = 'active' | 'background' | 'extension' | 'inactive' | 'unknown';

export function shouldPurgeSensitiveImagesForAppState(state: SensitiveImageAppState): boolean {
  return state !== 'active';
}
