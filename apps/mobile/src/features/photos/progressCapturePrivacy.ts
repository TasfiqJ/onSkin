import type { TimeOfDay } from '@onskin/types';

const EXPO_CAMERA_CAPTURE_NAME =
  /^(?:[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.jpg$/u;
const CAPTURE_SESSION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export type ProgressCaptureFileSystem = Readonly<{
  deleteAsync: (uri: string, options: { idempotent: true }) => Promise<void>;
}>;

export type ProgressCaptureSource = Readonly<{
  uri: string;
  disposable: boolean;
}>;

export type ProgressCaptureReviewLifecycle = Readonly<{
  discard: () => Promise<void>;
  dispose: () => Promise<void>;
  hasPendingCleanup: () => boolean;
  hasPersisted: () => boolean;
  save: (
    persist: (uri: string) => Promise<void>,
    onPersisted?: () => void,
  ) => Promise<{ persistedNow: boolean }>;
  uri: () => string | null;
}>;

function childDirectory(directory: string, name: string): string {
  return `${directory.endsWith('/') ? directory : `${directory}/`}${name}/`;
}

/**
 * Accept only the direct cache child shape emitted by Expo Camera. This keeps
 * route parameters from becoming an arbitrary local-file read/delete oracle.
 */
export function trustedExpoCameraCaptureUri(
  value: unknown,
  cacheDirectory: string | null | undefined,
): string | null {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return null;
  if (!cacheDirectory || !cacheDirectory.startsWith('file://')) return null;

  const cameraDirectory = childDirectory(cacheDirectory, 'Camera');
  if (!value.startsWith(cameraDirectory)) return null;
  const name = value.slice(cameraDirectory.length);
  return EXPO_CAMERA_CAPTURE_NAME.test(name) ? value : null;
}

/** Canonical, bounded idempotency key generated for one native shutter event. */
export function trustedProgressCaptureSessionId(value: unknown): string | null {
  if (typeof value !== 'string' || !CAPTURE_SESSION_ID.test(value)) return null;
  return value.toLowerCase();
}

export function trustedProgressCaptureTimeOfDay(value: unknown): TimeOfDay | null {
  return value === 'morning' || value === 'evening' ? value : null;
}

export function trustedProgressCaptureLocalDate(value: unknown): string | null {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

/**
 * Owns one trusted raw capture until encrypted storage commits or the route is
 * discarded. Save and removal share the same promise so a back/swipe/unmount
 * can never delete the source while encryption is still reading it.
 */
export function createProgressCaptureReviewLifecycle(
  fileSystem: ProgressCaptureFileSystem,
  source: ProgressCaptureSource | null,
): ProgressCaptureReviewLifecycle {
  let sourceReleased = source === null || !source.disposable;
  let persisted = false;
  let deleteInFlight: Promise<void> | null = null;
  let saveInFlight: Promise<{ persistedNow: boolean }> | null = null;

  const deleteSource = (): Promise<void> => {
    if (source === null || sourceReleased) return Promise.resolve();
    if (deleteInFlight !== null) return deleteInFlight;

    const deletion = fileSystem.deleteAsync(source.uri, { idempotent: true }).then(() => {
      sourceReleased = true;
    });
    const trackedDeletion = deletion.finally(() => {
      if (deleteInFlight === trackedDeletion) deleteInFlight = null;
    });
    deleteInFlight = trackedDeletion;
    return trackedDeletion;
  };

  const save = (
    persist: (uri: string) => Promise<void>,
    onPersisted?: () => void,
  ): Promise<{ persistedNow: boolean }> => {
    if (source === null) return Promise.reject(new Error('PROGRESS_CAPTURE_SOURCE_MISSING'));
    if (saveInFlight !== null) return saveInFlight;

    const operation = (async () => {
      if (persisted) {
        await deleteSource();
        return { persistedNow: false };
      }

      await persist(source.uri);
      persisted = true;
      try {
        onPersisted?.();
      } catch {
        // Analytics/UI callbacks cannot roll back an already committed photo.
      }
      await deleteSource();
      return { persistedNow: true };
    })();
    const trackedOperation = operation.finally(() => {
      if (saveInFlight === trackedOperation) saveInFlight = null;
    });
    saveInFlight = trackedOperation;
    return trackedOperation;
  };

  const discard = async (): Promise<void> => {
    const activeSave = saveInFlight;
    if (activeSave !== null) {
      try {
        await activeSave;
      } catch {
        // Whether persistence or its first cleanup attempt failed, the route
        // removal now owns an idempotent cleanup retry.
      }
    }
    await deleteSource();
  };

  return Object.freeze({
    discard,
    dispose: discard,
    hasPendingCleanup: () => source !== null && !sourceReleased,
    hasPersisted: () => persisted,
    save,
    uri: () => source?.uri ?? null,
  });
}
