import * as FileSystem from 'expo-file-system/legacy';

import {
  isCanonicalExpoCameraCaptureName,
  scavengeStaleLabelPhotos,
  type LabelPhotoFileSystem,
} from './labelPhotoLifecycle';

export const EXPO_CAMERA_STARTUP_DELETE_LIMIT = 32;
export const EXPO_CAMERA_STARTUP_SCAVENGE_INCOMPLETE = 'EXPO_CAMERA_STARTUP_SCAVENGE_INCOMPLETE';
export const EXPO_CAMERA_STARTUP_SNAPSHOT_UNAVAILABLE = 'EXPO_CAMERA_STARTUP_SNAPSHOT_UNAVAILABLE';

const EXPO_CAMERA_CACHE_DIRECTORY = 'Camera';

export type LabelPhotoStartupFileSystem = LabelPhotoFileSystem &
  Readonly<{
    getInfoAsync: (uri: string) => Promise<Readonly<{ exists: boolean; isDirectory: boolean }>>;
  }>;

export const labelPhotoFileSystem: LabelPhotoStartupFileSystem = Object.freeze({
  cacheDirectory: FileSystem.cacheDirectory,
  deleteAsync: FileSystem.deleteAsync,
  getInfoAsync: FileSystem.getInfoAsync,
  moveAsync: FileSystem.moveAsync,
  readDirectoryAsync: FileSystem.readDirectoryAsync,
});

function childUri(directory: string, name: string): string {
  return `${directory.endsWith('/') ? directory : `${directory}/`}${name}`;
}

/**
 * Expo Camera writes `takePictureAsync` results to `Caches/Camera/<UUID>.jpg`
 * before JavaScript can move them under the label-photo prefix. Snapshot those
 * exact direct children once at app boot so a later visible retry can never
 * mistake a new progress or label capture for a stale startup orphan.
 */
export function createExpoCameraStartupScavenger(fileSystem: LabelPhotoStartupFileSystem) {
  let snapshotAcquired = false;
  let remainingBootNames: Set<string> | null = null;
  let operationTail = Promise.resolve();

  const captureBootSnapshot = async (): Promise<Set<string>> => {
    if (snapshotAcquired) {
      if (remainingBootNames === null) {
        throw new Error(EXPO_CAMERA_STARTUP_SNAPSHOT_UNAVAILABLE);
      }
      return remainingBootNames;
    }

    // Every app shutter is gated on this serialized drain. Until one listing
    // succeeds, no post-boot Camera file can be created, so a failed filesystem
    // read may be retried safely. The first successful snapshot is immutable.
    const cacheDirectory = fileSystem.cacheDirectory;
    if (!cacheDirectory) {
      remainingBootNames = new Set();
      snapshotAcquired = true;
      return remainingBootNames;
    }

    const cameraDirectory = childUri(cacheDirectory, EXPO_CAMERA_CACHE_DIRECTORY);
    const info = await fileSystem.getInfoAsync(cameraDirectory);
    if (!info.exists) {
      remainingBootNames = new Set();
      snapshotAcquired = true;
      return remainingBootNames;
    }
    if (!info.isDirectory) {
      throw new Error(EXPO_CAMERA_STARTUP_SNAPSHOT_UNAVAILABLE);
    }

    const entries = await fileSystem.readDirectoryAsync(cameraDirectory);
    remainingBootNames = new Set(entries.filter(isCanonicalExpoCameraCaptureName).sort());
    snapshotAcquired = true;
    return remainingBootNames;
  };

  const run = async (): Promise<number> => {
    const remaining = await captureBootSnapshot();
    if (remaining.size === 0) return 0;

    const cacheDirectory = fileSystem.cacheDirectory;
    if (!cacheDirectory) throw new Error(EXPO_CAMERA_STARTUP_SNAPSHOT_UNAVAILABLE);
    const cameraDirectory = childUri(cacheDirectory, EXPO_CAMERA_CACHE_DIRECTORY);
    const batch = [...remaining].sort().slice(0, EXPO_CAMERA_STARTUP_DELETE_LIMIT);
    const results = await Promise.allSettled(
      batch.map((name) =>
        fileSystem.deleteAsync(childUri(cameraDirectory, name), { idempotent: true }),
      ),
    );

    let firstError: unknown = null;
    results.forEach((result, index) => {
      const name = batch[index];
      if (name === undefined) return;
      if (result.status === 'fulfilled') {
        remaining.delete(name);
      } else if (firstError === null) {
        firstError = result.reason;
      }
    });
    if (firstError !== null) throw firstError;
    if (remaining.size > 0) throw new Error(EXPO_CAMERA_STARTUP_SCAVENGE_INCOMPLETE);
    return results.length;
  };

  const scavenge = (): Promise<number> => {
    const result = operationTail.then(run, run);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return Object.freeze({ scavenge });
}

const expoCameraStartupScavenger = createExpoCameraStartupScavenger(labelPhotoFileSystem);

async function runLabelPhotoStartupScavenge(): Promise<number> {
  const results = await Promise.allSettled([
    scavengeStaleLabelPhotos(labelPhotoFileSystem),
    expoCameraStartupScavenger.scavenge(),
  ]);
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failed) throw failed.reason;
  return results.reduce(
    (sum, result) => sum + (result.status === 'fulfilled' ? result.value : 0),
    0,
  );
}

export function createLabelPhotoStartupCoordinator(run: () => Promise<number>) {
  let state: 'not_started' | 'pending' | 'fulfilled' | 'rejected' = 'not_started';
  let current: Promise<number> | null = null;

  const launch = (): Promise<number> => {
    state = 'pending';
    current = Promise.resolve()
      .then(run)
      .then(
        (count) => {
          state = 'fulfilled';
          return count;
        },
        (error: unknown) => {
          state = 'rejected';
          throw error;
        },
      );
    return current;
  };

  const start = (): Promise<number> => current ?? launch();
  const retry = (): Promise<number> => {
    if (current === null || state === 'rejected') return launch();
    return current;
  };

  return Object.freeze({ start, retry });
}

const startupCoordinator = createLabelPhotoStartupCoordinator(runLabelPhotoStartupScavenge);

/** One shared bounded pass, started at app boot and observed again by the OCR route. */
export function startLabelPhotoStartupScavenge(): Promise<number> {
  return startupCoordinator.start();
}

/** Retry a settled failure; deduplicate in-flight work and preserve a success. */
export function retryLabelPhotoStartupScavenge(): Promise<number> {
  return startupCoordinator.retry();
}
