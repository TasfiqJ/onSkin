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
    expect(source).toContain('recyclingKey={recyclingKey ?? undefined}');
    expect(source).toContain('`${ownerGeneration}:${photoId}:${storageRendition}:${rendition}`');
    expect(source).toContain('onLoad={onDisplayReady}');
    expect(source).toContain('onError={onDisplayError}');
    expect(source).toContain('if (reportDisplayError) onDisplayError?.();');
  });

  it('uses the bounded in-flight coordinator and detaches off-screen demand', () => {
    expect(source).toContain('requestSensitiveImage(');
    expect(source).toContain('ownerGeneration, requestPriority');
    expect(source).toContain('request.cancel()');
    expect(source).toContain('if (!active)');
    expect(source).toContain('key={stateIdentity}');
    expect(source).toContain('!isSensitiveImageLifecycleActive()');
    expect(source).toContain('!diskCacheReady');
    expect(source).toContain('prepareSensitiveImageDiskCacheMigration()');
    expect(source).toContain("${rendition}:${props.uri ?? 'missing'}`");
    expect(source).toContain('function ActivePhotoImage(');
    expect(source).not.toContain('decryptPhotoToDataUri(uri)');
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
    expect(memorySource).toContain('purgeSensitiveImageCoordinator()');
  });

  it('unmounts encrypted and plaintext staging image views when lifecycle admission closes', () => {
    const lifecycleGate = source.indexOf('if (!lifecycleActive)');
    const plaintextDisplay = source.indexOf('const displayUri = uri && !encrypted');
    const nativeImage = source.indexOf('<Image', plaintextDisplay);

    expect(lifecycleGate).toBeGreaterThan(-1);
    expect(plaintextDisplay).toBeGreaterThan(lifecycleGate);
    expect(nativeImage).toBeGreaterThan(plaintextDisplay);
  });

  it('reports every terminal pre-image failure so frame-gated playback cannot hang', () => {
    const lifecycleFallback = source.indexOf('if (!lifecycleActive)');
    const identityFallback = source.indexOf('if (!canDisplaySensitivePhoto || identityUnavailable)');
    const diskMigrationFailure = source.indexOf('setDiskCacheFailed(true)');

    expect(lifecycleFallback).toBeGreaterThan(-1);
    expect(source.indexOf('reportDisplayError={encrypted}', lifecycleFallback)).toBeGreaterThan(
      lifecycleFallback,
    );
    expect(identityFallback).toBeGreaterThan(-1);
    expect(source.indexOf('reportDisplayError', identityFallback)).toBeGreaterThan(identityFallback);
    expect(diskMigrationFailure).toBeGreaterThan(-1);
    expect(source).toContain('const failed = encrypted && (diskCacheFailed ||');
    expect(source).toContain('reportDisplayError={failed}');
    expect(source).toContain('onDisplayError={props.onDisplayError}');
  });
});
