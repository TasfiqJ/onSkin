import { describe, expect, it } from 'vitest';

import {
  SENSITIVE_IMAGE_CACHE_POLICY,
  SENSITIVE_IMAGE_TRANSITION_MS,
  shouldPurgeSensitiveImagesForAppState,
} from './sensitiveImagePolicy';

describe('sensitive photo image policy', () => {
  it('disables expo-image memory and disk caching plus crossfades', () => {
    expect(SENSITIVE_IMAGE_CACHE_POLICY).toBe('none');
    expect(SENSITIVE_IMAGE_TRANSITION_MS).toBe(0);
  });

  it('purges private image state for every non-active lifecycle state', () => {
    expect(shouldPurgeSensitiveImagesForAppState('active')).toBe(false);
    expect(shouldPurgeSensitiveImagesForAppState('inactive')).toBe(true);
    expect(shouldPurgeSensitiveImagesForAppState('background')).toBe(true);
    expect(shouldPurgeSensitiveImagesForAppState('unknown')).toBe(true);
  });
});
