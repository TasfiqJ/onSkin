import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  createLabelPhotoLifecycle,
  LABEL_PHOTO_CAPTURE_URI_INVALID,
  LABEL_PHOTO_SCAVENGE_INCOMPLETE,
  LABEL_PHOTO_STALE_DELETE_LIMIT,
  scavengeStaleLabelPhotos,
  trustedExpoCameraCaptureUri,
  type LabelPhotoFileSystem,
} from './labelPhotoLifecycle';

const OCR_ROUTE = fileURLToPath(new URL('../../../app/shelf/ocr.tsx', import.meta.url));
const ROOT_LAYOUT = fileURLToPath(new URL('../../../app/_layout.tsx', import.meta.url));

function harness(initialFiles: string[] = []) {
  const files = new Set(initialFiles);
  const events: string[] = [];
  const fileSystem: LabelPhotoFileSystem = {
    cacheDirectory: 'file://cache/',
    deleteAsync: vi.fn(async (uri: string) => {
      events.push(`delete:${uri}`);
      files.delete(uri);
    }),
    moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
      events.push(`move:${from}->${to}`);
      if (!files.has(from)) throw new Error('SOURCE_MISSING');
      files.delete(from);
      files.add(to);
    }),
    readDirectoryAsync: vi.fn(async () =>
      [...files]
        .filter((uri) => uri.startsWith('file://cache/'))
        .map((uri) => uri.slice('file://cache/'.length)),
    ),
  };
  return { events, files, fileSystem };
}

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];

function rawCameraUri(id: string, casing: 'upper' | 'lower' = 'lower'): string {
  const name = casing === 'upper' ? id.toUpperCase() : id;
  return `file://cache/Camera/${name}.jpg`;
}

describe('temporary label-photo lifecycle', () => {
  it.each(['cancel', 'continue'] as const)(
    'awaits idempotent deletion before %s',
    async (reason) => {
      const raw = rawCameraUri(ids[0]!, reason === 'cancel' ? 'upper' : 'lower');
      const test = harness([raw]);
      const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[0]!);
      const managed = await lifecycle.adoptCapturedPhoto(raw);

      await lifecycle.cleanup(reason);

      expect(test.fileSystem.deleteAsync).toHaveBeenCalledWith(managed, { idempotent: true });
      expect(test.files.has(managed)).toBe(false);
      expect(lifecycle.current()).toBeNull();
    },
  );

  it('deletes the old managed photo before a retake replacement is adopted', async () => {
    const firstRaw = rawCameraUri(ids[0]!, 'upper');
    const secondRaw = rawCameraUri(ids[1]!);
    const test = harness([firstRaw, secondRaw]);
    let idIndex = 0;
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[idIndex++]!);
    const firstManaged = await lifecycle.adoptCapturedPhoto(firstRaw);

    await lifecycle.cleanup('retake');
    const secondManaged = await lifecycle.adoptCapturedPhoto(secondRaw);

    expect(test.events.indexOf(`delete:${firstManaged}`)).toBeLessThan(
      test.events.indexOf(`move:${secondRaw}->${secondManaged}`),
    );
    expect(test.files.has(firstManaged)).toBe(false);
    expect(test.files.has(secondManaged)).toBe(true);
  });

  it('deletes the retained photo on capture failure and on unmount', async () => {
    const failedRaw = rawCameraUri(ids[0]!);
    const unmountRaw = rawCameraUri(ids[1]!);
    const test = harness([failedRaw, unmountRaw]);
    let idIndex = 0;
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[idIndex++]!);
    const failedManaged = await lifecycle.adoptCapturedPhoto(failedRaw);
    await lifecycle.cleanup('capture_failure');
    expect(test.files.has(failedManaged)).toBe(false);

    const unmountManaged = await lifecycle.adoptCapturedPhoto(unmountRaw);
    await lifecycle.dispose();
    expect(test.files.has(unmountManaged)).toBe(false);
  });

  it('keeps a failed post-dispose deletion retryable under the managed prefix', async () => {
    const raw = rawCameraUri(ids[0]!);
    const test = harness([raw]);
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[0]!);
    await lifecycle.dispose();
    vi.mocked(test.fileSystem.deleteAsync).mockRejectedValueOnce(new Error('DELETE_FAILED'));

    await expect(lifecycle.adoptCapturedPhoto(raw)).rejects.toThrow('DELETE_FAILED');

    const managed = `file://cache/catalog-label-photo-temp-${ids[0]}.jpg`;
    expect(test.fileSystem.moveAsync).toHaveBeenCalledWith({ from: raw, to: managed });
    expect(test.files.has(raw)).toBe(false);
    expect(test.files.has(managed)).toBe(true);
    expect(lifecycle.hasPendingCleanup()).toBe(true);

    await lifecycle.cleanup('capture_failure');
    expect(test.files.has(managed)).toBe(false);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
  });

  it('deletes the raw camera file if managed-name generation fails', async () => {
    const raw = rawCameraUri(ids[0]!);
    const test = harness([raw]);
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => {
      throw new Error('UUID_UNAVAILABLE');
    });

    await expect(lifecycle.adoptCapturedPhoto(raw)).rejects.toThrow('UUID_UNAVAILABLE');
    expect(test.fileSystem.moveAsync).not.toHaveBeenCalled();
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledWith(raw, { idempotent: true });
    expect(test.files.has(raw)).toBe(false);
  });

  it('accepts only exact direct Expo Camera UUIDv4 JPEG children', () => {
    const lower = rawCameraUri(ids[0]!);
    const upper = rawCameraUri(ids[0]!, 'upper');
    expect(trustedExpoCameraCaptureUri(lower, 'file://cache/')).toBe(lower);
    expect(trustedExpoCameraCaptureUri(upper, 'file://cache/')).toBe(upper);

    for (const value of [
      null,
      undefined,
      '',
      ` ${lower}`,
      `file://cache/${ids[0]}.jpg`,
      `file://cache/Documents/${ids[0]}.jpg`,
      `file://cache/Camera/nested/${ids[0]}.jpg`,
      `file://cache/Camera/${ids[0]}.jpg?secret=1`,
      `file://cache/Camera/${ids[0]}.JPG`,
      `file://cache/Camera/${ids[0]!.replace('-4000-', '-1000-')}.jpg`,
      'file://cache/Camera/aAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.jpg',
    ]) {
      expect(trustedExpoCameraCaptureUri(value, 'file://cache/')).toBeNull();
    }
    expect(trustedExpoCameraCaptureUri(lower, 'https://cache.example/')).toBeNull();
  });

  it('never deletes or moves invalid, null, or arbitrary runtime capture URIs', async () => {
    const arbitrary = 'file://cache/Documents/private-user-file.jpg';
    const test = harness([arbitrary]);
    const lifecycle = createLabelPhotoLifecycle(test.fileSystem, () => ids[0]!);

    for (const value of [null, undefined, arbitrary, 'file://cache/Camera/not-a-photo.jpg']) {
      await expect(lifecycle.adoptCapturedPhoto(value)).rejects.toThrow(
        LABEL_PHOTO_CAPTURE_URI_INVALID,
      );
    }

    expect(test.fileSystem.moveAsync).not.toHaveBeenCalled();
    expect(test.fileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(test.files.has(arbitrary)).toBe(true);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
  });

  it('does not construct a move target when the native cache directory is unavailable', async () => {
    const raw = rawCameraUri(ids[0]!);
    const test = harness([raw]);
    const createId = vi.fn(() => ids[0]!);
    const lifecycle = createLabelPhotoLifecycle(
      { ...test.fileSystem, cacheDirectory: null },
      createId,
    );

    await expect(lifecycle.adoptCapturedPhoto(raw)).rejects.toThrow(
      LABEL_PHOTO_CAPTURE_URI_INVALID,
    );
    expect(createId).not.toHaveBeenCalled();
    expect(test.fileSystem.moveAsync).not.toHaveBeenCalled();
    expect(test.fileSystem.deleteAsync).not.toHaveBeenCalled();
    expect(test.files.has(raw)).toBe(true);
  });

  it('bounds relaunch scavenging and never deletes unrelated cache files', async () => {
    const stale = Array.from(
      { length: LABEL_PHOTO_STALE_DELETE_LIMIT + 3 },
      (_, index) =>
        `file://cache/catalog-label-photo-temp-00000000-0000-4000-8000-${String(index).padStart(12, '0')}.jpg`,
    );
    const unrelated = [
      'file://cache/public-cache.json',
      'file://cache/catalog-label-photo-temp-not-a-uuid.jpg',
    ];
    const test = harness([...stale, ...unrelated]);

    await expect(scavengeStaleLabelPhotos(test.fileSystem)).rejects.toThrow(
      LABEL_PHOTO_SCAVENGE_INCOMPLETE,
    );
    expect(stale.filter((uri) => test.files.has(uri))).toHaveLength(3);
    expect(unrelated.every((uri) => test.files.has(uri))).toBe(true);
    await expect(scavengeStaleLabelPhotos(test.fileSystem)).resolves.toBe(3);
    expect(unrelated.every((uri) => test.files.has(uri))).toBe(true);
  });

  it('reports a stale-file deletion failure and succeeds when cleanup is retried', async () => {
    const stale = `file://cache/catalog-label-photo-temp-${ids[0]}.jpg`;
    const test = harness([stale]);
    vi.mocked(test.fileSystem.deleteAsync).mockRejectedValueOnce(new Error('DELETE_FAILED'));

    await expect(scavengeStaleLabelPhotos(test.fileSystem)).rejects.toThrow('DELETE_FAILED');
    expect(test.files.has(stale)).toBe(true);

    await expect(scavengeStaleLabelPhotos(test.fileSystem)).resolves.toBe(1);
    expect(test.files.has(stale)).toBe(false);
  });

  it('drains native OCR before every route-owned temporary-photo cleanup', () => {
    const source = readFileSync(OCR_ROUTE, 'utf8');
    const rootLayout = readFileSync(ROOT_LAYOUT, 'utf8');
    for (const reason of ['cancel', 'continue', 'retake', 'capture_failure']) {
      expect(source).toContain(`cleanupLabelPhoto('${reason}')`);
    }
    expect(source).toContain('startLabelPhotoStartupScavenge');
    expect(rootLayout).toContain('startLabelPhotoStartupScavenge');
    expect(rootLayout).toContain('void startLabelPhotoStartupScavenge().catch(() => undefined);');
    expect(source).toContain('setPhotoScavengeFailed(true)');
    expect(source).toContain('retryPhotoScavenging');
    expect(source).toContain(
      'coordinator\n        .dispose()\n        .then(() => lifecycle.dispose())',
    );
    expect(source).toContain("cancelAndDrainRecognition('manual_continue')");
    expect(source).toContain("cancelAndDrainRecognition('navigation')");
    expect(source).toContain("cancelAndDrainRecognition('retake')");
    expect(source).toContain("cancelAndDrainRecognition('camera_failure')");
    expect(source).toContain(
      'void recognizeManagedPhoto(lifecycle, managedUri, captureReviewState)',
    );
    expect(source).toContain('const shouldPreventRouteRemoval = !routeRemovalReady;');
    expect(source).toContain('usePreventRemove(shouldPreventRouteRemoval');
    expect(source.split('await captureDrainRef.current;').length - 1).toBe(5);
    expect(source).toContain("{ kind: 'action', action: data.action }");
    expect(source).toContain('navigation.dispatch(pendingNavigation.action)');
    expect(source).toContain('cachePolicy="none"');
    expect(source).toContain('const recognitionStartedAt = performance.now();');
    expect(source).toContain('trackLabelRecognitionCompleted({');
    expect(source).toContain('key={cameraAccess.cameraKey}');
    expect(source).toContain(
      'onCameraReady={() => cameraAccess.markCameraReady(cameraAccess.cameraGeneration)}',
    );
    expect(source).toContain(
      'onMountError={() => void handleCameraMountError(cameraAccess.cameraGeneration)}',
    );
    expect(source).toContain(
      'const cameraLease = usesNativeCamera ? cameraAccess.acquireCameraOperationLease() : null;',
    );
    expect(source).toContain('(usesNativeCamera && cameraLease === null)');
    expect(source.split('cameraAccess.isCameraOperationLeaseCurrent(cameraLease)').length - 1).toBe(
      3,
    );
    expect(source.indexOf('cameraAccess.acquireCameraOperationLease()')).toBeLessThan(
      source.indexOf('takePictureAsync'),
    );
    expect(source).toContain('if (captureInFlightRef.current || photoCleanupBusy) return;');
    expect(source).toContain("disabled={state === 'capturing' || photoCleanupBusy}");
    expect(source).toContain('adoptCapturedPhoto(photo?.uri)');
    expect(source).toContain('source: LABEL_CAPTURE_ANALYTICS_SOURCE');
    expect(source).not.toContain("source: 'ocr_label_capture'");
    expect(source).toContain('A Vision failure must');
    expect(source).not.toContain('const NATIVE_OCR_ADAPTER_AVAILABLE = false');
  });
});
