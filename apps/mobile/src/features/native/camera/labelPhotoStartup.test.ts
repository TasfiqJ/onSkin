import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EXPO_CAMERA_STARTUP_DELETE_LIMIT,
  EXPO_CAMERA_STARTUP_SCAVENGE_INCOMPLETE,
  createExpoCameraStartupScavenger,
  createLabelPhotoStartupCoordinator,
  type LabelPhotoStartupFileSystem,
} from './labelPhotoStartup';

const expoFileSystem = vi.hoisted(() => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: vi.fn(async () => undefined),
  getInfoAsync: vi.fn(async () => ({
    exists: false as const,
    isDirectory: false as const,
    uri: 'file:///cache/Camera',
  })),
  moveAsync: vi.fn(async () => undefined),
  readDirectoryAsync: vi.fn(async () => [] as string[]),
}));

vi.mock('expo-file-system/legacy', () => expoFileSystem);

const OCR_ROUTE = fileURLToPath(new URL('../../../app/shelf/ocr.tsx', import.meta.url));
const PROGRESS_CAPTURE_ROUTE = fileURLToPath(
  new URL('../../../app/progress/capture.tsx', import.meta.url),
);

function expoCameraName(index: number, casing: 'upper' | 'lower' = 'upper'): string {
  const suffix = index.toString(16).padStart(12, '0');
  const name = `00000000-0000-4000-8000-${suffix}.jpg`;
  return casing === 'upper' ? name.toUpperCase().replace('.JPG', '.jpg') : name;
}

function harness(initialEntries: readonly string[]) {
  const entries = new Set(initialEntries);
  const deletionFailures = new Set<string>();
  let directoryExists = true;
  let listingError: Error | null = null;

  const fileSystem: LabelPhotoStartupFileSystem = {
    cacheDirectory: 'file:///cache/',
    deleteAsync: vi.fn(async (uri: string) => {
      const name = uri.slice(uri.lastIndexOf('/') + 1);
      if (deletionFailures.has(name)) throw new Error('DELETE_FAILED');
      entries.delete(name);
    }),
    getInfoAsync: vi.fn(async () => ({ exists: directoryExists, isDirectory: directoryExists })),
    moveAsync: vi.fn(async () => undefined),
    readDirectoryAsync: vi.fn(async () => {
      if (listingError !== null) throw listingError;
      return [...entries];
    }),
  };

  return {
    entries,
    deletionFailures,
    fileSystem,
    setDirectoryExists(value: boolean) {
      directoryExists = value;
    },
    setListingError(value: Error | null) {
      listingError = value;
    },
  };
}

describe('Expo Camera startup-orphan scavenger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes only direct canonical v4 UUID.jpg children from the Expo Camera cache', async () => {
    const upper = expoCameraName(1, 'upper');
    const lower = expoCameraName(2, 'lower');
    const test = harness([
      upper,
      lower,
      upper.replace('.jpg', '.JPG'),
      upper.replace('.jpg', '.png'),
      upper.replace('.jpg', '.mov'),
      upper.replace('-4000-', '-1000-'),
      'A0000000-0000-4000-8000-00000000000b.jpg',
      `nested/${upper}`,
      `catalog-label-photo-temp-${lower}`,
      'not-a-camera-photo.jpg',
    ]);

    const scavenger = createExpoCameraStartupScavenger(test.fileSystem);
    await expect(scavenger.scavenge()).resolves.toBe(2);

    expect(test.fileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledWith(`file:///cache/Camera/${upper}`, {
      idempotent: true,
    });
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledWith(`file:///cache/Camera/${lower}`, {
      idempotent: true,
    });
  });

  it('deletes at most 32 names per pass and retries only the remaining boot snapshot', async () => {
    const bootNames = Array.from({ length: EXPO_CAMERA_STARTUP_DELETE_LIMIT + 8 }, (_, index) =>
      expoCameraName(index + 1),
    );
    const postBootName = expoCameraName(9_999);
    const test = harness(bootNames);
    const scavenger = createExpoCameraStartupScavenger(test.fileSystem);

    await expect(scavenger.scavenge()).rejects.toThrow(EXPO_CAMERA_STARTUP_SCAVENGE_INCOMPLETE);
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledTimes(EXPO_CAMERA_STARTUP_DELETE_LIMIT);

    test.entries.add(postBootName);
    await expect(scavenger.scavenge()).resolves.toBe(8);

    expect(test.fileSystem.readDirectoryAsync).toHaveBeenCalledOnce();
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledTimes(bootNames.length);
    expect(test.fileSystem.deleteAsync).not.toHaveBeenCalledWith(
      `file:///cache/Camera/${postBootName}`,
      { idempotent: true },
    );
    expect(test.entries.has(postBootName)).toBe(true);
  });

  it('keeps failed names retryable without repeating successful deletion', async () => {
    const failedName = expoCameraName(1);
    const successfulName = expoCameraName(2);
    const test = harness([failedName, successfulName]);
    test.deletionFailures.add(failedName);
    const scavenger = createExpoCameraStartupScavenger(test.fileSystem);

    await expect(scavenger.scavenge()).rejects.toThrow('DELETE_FAILED');
    expect(test.entries.has(failedName)).toBe(true);
    expect(test.entries.has(successfulName)).toBe(false);

    test.deletionFailures.clear();
    await expect(scavenger.scavenge()).resolves.toBe(1);
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledTimes(3);
  });

  it('freezes an empty snapshot when the Camera directory does not exist at boot', async () => {
    const postBootName = expoCameraName(1);
    const test = harness([]);
    test.setDirectoryExists(false);
    const scavenger = createExpoCameraStartupScavenger(test.fileSystem);

    await expect(scavenger.scavenge()).resolves.toBe(0);
    test.setDirectoryExists(true);
    test.entries.add(postBootName);
    await expect(scavenger.scavenge()).resolves.toBe(0);

    expect(test.fileSystem.getInfoAsync).toHaveBeenCalledOnce();
    expect(test.fileSystem.readDirectoryAsync).not.toHaveBeenCalled();
    expect(test.fileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('retries snapshot acquisition before the first successful immutable listing', async () => {
    const test = harness([expoCameraName(1)]);
    test.setListingError(new Error('LIST_FAILED'));
    const scavenger = createExpoCameraStartupScavenger(test.fileSystem);

    await expect(scavenger.scavenge()).rejects.toThrow('LIST_FAILED');
    test.setListingError(null);
    await expect(scavenger.scavenge()).resolves.toBe(1);

    expect(test.fileSystem.getInfoAsync).toHaveBeenCalledTimes(2);
    expect(test.fileSystem.readDirectoryAsync).toHaveBeenCalledTimes(2);
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledOnce();
  });

  it('serializes concurrent callers against one boot snapshot', async () => {
    const test = harness([expoCameraName(1)]);
    const scavenger = createExpoCameraStartupScavenger(test.fileSystem);

    await expect(Promise.all([scavenger.scavenge(), scavenger.scavenge()])).resolves.toEqual([
      1, 0,
    ]);
    expect(test.fileSystem.getInfoAsync).toHaveBeenCalledOnce();
    expect(test.fileSystem.readDirectoryAsync).toHaveBeenCalledOnce();
    expect(test.fileSystem.deleteAsync).toHaveBeenCalledOnce();
  });

  it('gates every app takePictureAsync call until the shared boot snapshot drains', () => {
    const ocr = readFileSync(OCR_ROUTE, 'utf8');
    const progressCapture = readFileSync(PROGRESS_CAPTURE_ROUTE, 'utf8');

    expect(ocr).toContain('await labelPhotoStartupRef.current;');
    expect(ocr.indexOf('await labelPhotoStartupRef.current;')).toBeLessThan(
      ocr.indexOf('takePictureAsync'),
    );
    expect(progressCapture).toContain('await waitForLabelPhotoStartupScavenge();');
    expect(progressCapture.indexOf('await waitForLabelPhotoStartupScavenge();')).toBeLessThan(
      progressCapture.indexOf('takePictureAsync'),
    );
  });

  it('wires late Progress capture validation into the executable route owner', () => {
    const source = readFileSync(PROGRESS_CAPTURE_ROUTE, 'utf8');

    expect(source).toContain('const mountedRef = useRef(false);');
    expect(source).toContain('const captureLeaseGenerationRef = useRef(0);');
    expect(source).toContain('const captureInFlightRef = useRef<number | null>(null);');
    expect(source).toContain('mountedRef.current = false;');
    expect(source).toContain(
      'if (!cameraAccess.isForegroundFocused) captureLeaseGenerationRef.current += 1;',
    );
    expect(source).toContain('cameraAccess.beginCameraOperation()');
    expect(source).toContain(
      '(cameraOperation !== null && !cameraAccess.isCameraOperationCurrent(cameraOperation))',
    );
    expect(source).toContain('createProgressCaptureRouteBoundary<NavigationAction>({');
    expect(source).toContain('captureBoundary.adoptRawCapture(rawCaptureUri);');
    expect(source).not.toContain('FileSystem.deleteAsync(rawCaptureUri');
    expect(source).not.toContain(
      'FileSystem.deleteAsync(rawCaptureUri, { idempotent: true }).catch(() => undefined)',
    );

    const operationFence = source.indexOf('cameraAccess.isCameraOperationCurrent(cameraOperation)');
    const takePicture = source.indexOf('takePictureAsync');
    const trustedCapture = source.indexOf('rawCaptureUri = trustedExpoCameraCaptureUri(');
    const routeOwnedAdoption = source.indexOf('captureBoundary.adoptRawCapture(rawCaptureUri);');
    const analytics = source.indexOf("track('photo_capture_still_taken'");
    expect(operationFence).toBeGreaterThan(-1);
    expect(operationFence).toBeLessThan(takePicture);
    expect(takePicture).toBeLessThan(trustedCapture);
    expect(trustedCapture).toBeLessThan(routeOwnedAdoption);
    expect(routeOwnedAdoption).toBeLessThan(analytics);
  });
});

describe('combined label-photo startup coordinator', () => {
  it('deduplicates overlapping retries after a settled failure', async () => {
    let resolveRetry!: (value: number) => void;
    const retryResult = new Promise<number>((resolve) => {
      resolveRetry = resolve;
    });
    const run = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('FIRST_PASS_FAILED'))
      .mockReturnValueOnce(retryResult);
    const coordinator = createLabelPhotoStartupCoordinator(run);

    await expect(coordinator.start()).rejects.toThrow('FIRST_PASS_FAILED');
    const firstRetry = coordinator.retry();
    const overlappingRetry = coordinator.retry();

    expect(overlappingRetry).toBe(firstRetry);
    resolveRetry(7);
    await expect(Promise.all([firstRetry, overlappingRetry])).resolves.toEqual([7, 7]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('never reruns filesystem scans after the first successful combined pass', async () => {
    const run = vi.fn(async () => 3);
    const coordinator = createLabelPhotoStartupCoordinator(run);

    const initial = coordinator.start();
    expect(coordinator.start()).toBe(initial);
    expect(coordinator.retry()).toBe(initial);
    await expect(initial).resolves.toBe(3);
    const postSuccessRetry = coordinator.retry();

    expect(postSuccessRetry).toBe(initial);
    await expect(postSuccessRetry).resolves.toBe(3);
    expect(run).toHaveBeenCalledOnce();
  });
});
