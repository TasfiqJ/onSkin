import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  createProgressCaptureReviewLifecycle,
  trustedExpoCameraCaptureUri,
  trustedProgressCaptureLocalDate,
  trustedProgressCaptureSessionId,
  trustedProgressCaptureTimeOfDay,
} from './progressCapturePrivacy';

const CACHE_DIRECTORY = 'file:///private/app/Library/Caches/';
const CAMERA_NAME = '00000000-0000-4000-8000-000000000001.jpg';
const CAMERA_URI = `${CACHE_DIRECTORY}Camera/${CAMERA_NAME}`;
const CAPTURE_ROUTE = fileURLToPath(new URL('../../app/progress/capture.tsx', import.meta.url));
const REVIEW_ROUTE = fileURLToPath(new URL('../../app/progress/review.tsx', import.meta.url));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('Progress raw capture trust boundary', () => {
  it('accepts only direct canonical Expo Camera v4 JPEG children', () => {
    expect(trustedExpoCameraCaptureUri(CAMERA_URI, CACHE_DIRECTORY)).toBe(CAMERA_URI);
    const upper = CAMERA_URI.replace(
      CAMERA_NAME,
      CAMERA_NAME.toUpperCase().replace('.JPG', '.jpg'),
    );
    expect(trustedExpoCameraCaptureUri(upper, CACHE_DIRECTORY)).toBe(upper);

    for (const candidate of [
      undefined,
      '',
      ` ${CAMERA_URI}`,
      `${CAMERA_URI} `,
      `file:///private/app/Documents/${CAMERA_NAME}`,
      `${CACHE_DIRECTORY}Camera/nested/${CAMERA_NAME}`,
      `${CACHE_DIRECTORY}Camera/../${CAMERA_NAME}`,
      `${CACHE_DIRECTORY}Camera/%2e%2e/${CAMERA_NAME}`,
      `${CAMERA_URI}?source=route`,
      `${CAMERA_URI}#fragment`,
      `${CACHE_DIRECTORY}Camera/${CAMERA_NAME.replace('-4000-', '-1000-')}`,
      `${CACHE_DIRECTORY}Camera/${CAMERA_NAME.replace('-8000-', '-7000-')}`,
      `${CAMERA_URI.slice(0, -4)}.png`,
      CAMERA_URI.replace('.jpg', '.JPG'),
    ]) {
      expect(trustedExpoCameraCaptureUri(candidate, CACHE_DIRECTORY)).toBeNull();
    }
    expect(trustedExpoCameraCaptureUri(CAMERA_URI, null)).toBeNull();
    expect(trustedExpoCameraCaptureUri(CAMERA_URI, 'https://example.com/cache/')).toBeNull();
  });

  it('validates native output before any capture-route lifecycle or handoff', () => {
    const source = readFileSync(CAPTURE_ROUTE, 'utf8');
    const validation = source.indexOf(
      'rawCaptureUri = trustedExpoCameraCaptureUri(shot.uri, FileSystem.cacheDirectory);',
    );

    expect(validation).toBeGreaterThan(source.indexOf('takePictureAsync'));
    expect(validation).toBeLessThan(
      source.indexOf('captureBoundary.adoptRawCapture(rawCaptureUri)'),
    );
    expect(validation).toBeLessThan(source.indexOf('capturedUri: rawCaptureUri'));
    expect(source).toContain("throw new Error('UNTRUSTED_PROGRESS_CAPTURE_URI')");
    expect(source).not.toContain('capturedUri: shot.uri');
  });

  it('wires trusted capture adoption into the route owner outside replacing gates', () => {
    const source = readFileSync(CAPTURE_ROUTE, 'utf8');
    const validation = source.indexOf(
      'rawCaptureUri = trustedExpoCameraCaptureUri(shot.uri, FileSystem.cacheDirectory);',
    );
    const adoption = source.indexOf('captureBoundary.adoptRawCapture(rawCaptureUri)');
    const handoff = source.indexOf('capturedUri: rawCaptureUri');

    expect(adoption).toBeGreaterThan(validation);
    expect(adoption).toBeLessThan(handoff);
    expect(source).toContain('createProgressCaptureRouteBoundary<NavigationAction>({');
    expect(source).toContain('useSyncExternalStore(');
    expect(source).toContain('mountAllowed: consented === true && !captureBoundary.cleanupPending');
    expect(source).toContain('usePreventRemove(!boundaryState.routeRemovalReady');
    expect(source).toContain('Temporary photo cleanup needs another try');
    expect(source).toContain('Finish cleanup');
    expect(source).toContain('Close after cleanup');
    const outerBoundary = source.indexOf('const captureBoundary = useProgressCaptureBoundary();');
    const outerRecovery = source.indexOf('if (captureBoundary.cleanupFailed) {');
    const gate = source.indexOf('<ProGate feature="photo_timeline">');
    expect(outerBoundary).toBeGreaterThan(-1);
    expect(outerRecovery).toBeGreaterThan(outerBoundary);
    expect(outerRecovery).toBeLessThan(gate);
    expect(outerBoundary).toBeLessThan(gate);
    expect(source.slice(outerRecovery, gate)).toContain('<PhotoTimelineLockGate>');
    expect(source.slice(outerRecovery, gate)).toContain('<RawCaptureCleanupGate');
    expect(source).toContain('<PhotoStorageGate onExit={captureBoundary.requestProgressExit}>');
    expect(source).not.toContain(
      'FileSystem.deleteAsync(rawCaptureUri, { idempotent: true }).catch(() => undefined)',
    );
  });

  it('canonicalizes only bounded UUIDv4 capture sessions', () => {
    const canonical = '123e4567-e89b-42d3-a456-426614174000';
    expect(trustedProgressCaptureSessionId(canonical)).toBe(canonical);
    expect(trustedProgressCaptureSessionId(canonical.toUpperCase())).toBe(canonical);
    expect(trustedProgressCaptureSessionId('123E4567-e89B-42d3-A456-426614174000')).toBe(canonical);

    for (const candidate of [
      undefined,
      '',
      ` ${canonical}`,
      `${canonical} `,
      `${canonical}-unbounded`,
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-42d3-7456-426614174000',
      'e2e-progress-capture',
    ]) {
      expect(trustedProgressCaptureSessionId(candidate)).toBeNull();
    }
  });

  it('accepts only closed time-of-day values and real canonical local dates', () => {
    expect(trustedProgressCaptureTimeOfDay('morning')).toBe('morning');
    expect(trustedProgressCaptureTimeOfDay('evening')).toBe('evening');
    expect(trustedProgressCaptureLocalDate('2024-02-29')).toBe('2024-02-29');

    for (const candidate of [undefined, null, '', 'Morning', 'night', ' morning ']) {
      expect(trustedProgressCaptureTimeOfDay(candidate)).toBeNull();
    }
    for (const candidate of [
      undefined,
      null,
      '',
      '2026-2-03',
      '2026-02-29',
      '2026-04-31',
      ' 2026-07-03',
      '2026-07-03T00:00:00Z',
    ]) {
      expect(trustedProgressCaptureLocalDate(candidate)).toBeNull();
    }
  });

  it('validates and canonicalizes a shutter session before route handoff', () => {
    const source = readFileSync(CAPTURE_ROUTE, 'utf8');
    const uriValidation = source.indexOf(
      'rawCaptureUri = trustedExpoCameraCaptureUri(shot.uri, FileSystem.cacheDirectory);',
    );
    const sessionValidation = source.indexOf(
      'const captureSessionId = trustedProgressCaptureSessionId(randomUUID());',
    );

    expect(sessionValidation).toBeGreaterThan(uriValidation);
    expect(source).toContain(
      "if (captureSessionId === null) throw new Error('INVALID_PROGRESS_CAPTURE_SESSION');",
    );
    expect(sessionValidation).toBeLessThan(source.indexOf("track('photo_capture_still_taken'"));
    expect(sessionValidation).toBeLessThan(
      source.indexOf(
        'captureBoundary.handoffToReview({\n        captureSessionId,\n        capturedUri',
      ),
    );
  });

  it('keeps validation, no-cache rendering, and lifecycle cleanup outside review gates', () => {
    const source = readFileSync(REVIEW_ROUTE, 'utf8');
    const guard = source.indexOf('usePreventRemove(source !== null && !routeRemovalReady');
    const gates = source.indexOf('<ProGate feature="photo_timeline">');

    expect(source).toContain(
      'trustedExpoCameraCaptureUri(params.capturedUri, FileSystem.cacheDirectory)',
    );
    expect(source).toContain('cachePolicy="none"');
    expect(source).toContain('localUri: trustedUri');
    expect(source).toContain('await lifecycle.save(persist');
    expect(source).toContain('await lifecycle.discard();');
    expect(source).toContain('void lifecycle.dispose().catch(() => undefined);');
    expect(source).toContain(
      'source !== null && captureMetadata.nativeMetadataValid ? source.uri : null',
    );
    expect(source).toContain(
      '(captureSessionId !== null && timeOfDay !== null && trustedTakenLocalDate !== null)',
    );
    expect(source).toContain('captureSessionId: captureMetadata.captureSessionId');
    expect(source).toContain('takenLocalDate: captureMetadata.takenLocalDate');
    expect(source).toContain('timeOfDay: captureMetadata.timeOfDay');
    expect(source).not.toContain('FileSystem.deleteAsync(capturedUri');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(gates);
  });
});

describe('Progress capture review lifecycle', () => {
  it('deduplicates concurrent discard and releases only after deletion succeeds', async () => {
    const deletion = deferred<void>();
    const fileSystem = {
      deleteAsync: vi.fn(() => deletion.promise),
    };
    const lifecycle = createProgressCaptureReviewLifecycle(fileSystem, {
      uri: CAMERA_URI,
      disposable: true,
    });

    const first = lifecycle.discard();
    const second = lifecycle.discard();
    expect(fileSystem.deleteAsync).toHaveBeenCalledOnce();
    expect(lifecycle.hasPendingCleanup()).toBe(true);

    deletion.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
    await lifecycle.dispose();
    expect(fileSystem.deleteAsync).toHaveBeenCalledOnce();
  });

  it('retains a failed deletion for an idempotent visible retry', async () => {
    const fileSystem = {
      deleteAsync: vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('DELETE_FAILED'))
        .mockResolvedValueOnce(undefined),
    };
    const lifecycle = createProgressCaptureReviewLifecycle(fileSystem, {
      uri: CAMERA_URI,
      disposable: true,
    });

    await expect(lifecycle.discard()).rejects.toThrow('DELETE_FAILED');
    expect(lifecycle.hasPendingCleanup()).toBe(true);
    await expect(lifecycle.discard()).resolves.toBeUndefined();
    expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
  });

  it('waits for active persistence before a back/removal cleanup can delete', async () => {
    const persistence = deferred<void>();
    const events: string[] = [];
    const fileSystem = {
      deleteAsync: vi.fn(async () => {
        events.push('delete');
      }),
    };
    const lifecycle = createProgressCaptureReviewLifecycle(fileSystem, {
      uri: CAMERA_URI,
      disposable: true,
    });

    const save = lifecycle.save(async () => {
      events.push('persist:start');
      await persistence.promise;
      events.push('persist:end');
    });
    await Promise.resolve();
    const removal = lifecycle.discard();
    expect(fileSystem.deleteAsync).not.toHaveBeenCalled();

    persistence.resolve();
    await expect(Promise.all([save, removal])).resolves.toEqual([
      { persistedNow: true },
      undefined,
    ]);
    expect(events).toEqual(['persist:start', 'persist:end', 'delete']);
  });

  it('deletes on removal after persistence fails instead of orphaning the source', async () => {
    const fileSystem = { deleteAsync: vi.fn(async () => undefined) };
    const lifecycle = createProgressCaptureReviewLifecycle(fileSystem, {
      uri: CAMERA_URI,
      disposable: true,
    });
    const save = lifecycle.save(async () => {
      throw new Error('STORE_FAILED');
    });
    const removal = lifecycle.discard();

    await expect(save).rejects.toThrow('STORE_FAILED');
    await expect(removal).resolves.toBeUndefined();
    expect(lifecycle.hasPersisted()).toBe(false);
    expect(fileSystem.deleteAsync).toHaveBeenCalledOnce();
  });

  it('retries only raw cleanup after storage commits and never creates a duplicate photo', async () => {
    const fileSystem = {
      deleteAsync: vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('DELETE_FAILED'))
        .mockResolvedValueOnce(undefined),
    };
    const persist = vi.fn(async () => undefined);
    const onPersisted = vi.fn();
    const lifecycle = createProgressCaptureReviewLifecycle(fileSystem, {
      uri: CAMERA_URI,
      disposable: true,
    });

    await expect(lifecycle.save(persist, onPersisted)).rejects.toThrow('DELETE_FAILED');
    expect(lifecycle.hasPersisted()).toBe(true);
    await expect(lifecycle.save(persist, onPersisted)).resolves.toEqual({ persistedNow: false });

    expect(persist).toHaveBeenCalledOnce();
    expect(onPersisted).toHaveBeenCalledOnce();
    expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(lifecycle.hasPendingCleanup()).toBe(false);
  });

  it('never sends an explicit development data fixture to filesystem deletion', async () => {
    const fixture = 'data:image/png;base64,aA==';
    const fileSystem = { deleteAsync: vi.fn(async () => undefined) };
    const persist = vi.fn(async () => undefined);
    const lifecycle = createProgressCaptureReviewLifecycle(fileSystem, {
      uri: fixture,
      disposable: false,
    });

    await expect(lifecycle.save(persist)).resolves.toEqual({ persistedNow: true });
    await expect(lifecycle.discard()).resolves.toBeUndefined();
    expect(persist).toHaveBeenCalledWith(fixture);
    expect(fileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
