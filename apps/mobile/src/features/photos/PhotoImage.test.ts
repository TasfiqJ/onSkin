import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, 'PhotoImage.tsx'), 'utf8');
const memorySource = readFileSync(resolve(import.meta.dirname, 'sensitiveImageMemory.ts'), 'utf8');

describe('PhotoImage sensitive-memory contract', () => {
  it('never allows decrypted photos into expo-image caches or crossfades', () => {
    expect(source).toContain('cachePolicy={SENSITIVE_IMAGE_CACHE_POLICY}');
    expect(source).toContain('transition={SENSITIVE_IMAGE_TRANSITION_MS}');
    expect(source).not.toContain('transition={120}');
  });

  it('drops resolved data URIs at privacy and lifecycle boundaries', () => {
    expect(source).toContain('subscribeToSensitiveImageLifecycle');
    expect(source).toContain("event === 'purge'");
    expect(source).toContain('setResolved(null)');
    expect(source).toContain('purgeSensitiveImageMemory');
    expect(source).toContain('appUnlocked && (!enabled || photoTimelineUnlocked)');
    expect(memorySource).toContain("AppState.addEventListener('change'");
    expect(memorySource).toContain("AppState.addEventListener('memoryWarning'");
    expect(memorySource).toContain('Image.clearMemoryCache()');
  });
});
