export const LABEL_PHOTO_CACHE_PREFIX = 'catalog-label-photo-temp-';
export const LABEL_PHOTO_STALE_DELETE_LIMIT = 32;
export const LABEL_PHOTO_SCAVENGE_INCOMPLETE = 'LABEL_PHOTO_SCAVENGE_INCOMPLETE';

const LABEL_PHOTO_CACHE_NAME =
  /^catalog-label-photo-temp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export type LabelPhotoCleanupReason = 'cancel' | 'continue' | 'retake' | 'capture_failure';

export type LabelPhotoFileSystem = Readonly<{
  cacheDirectory: string | null;
  deleteAsync: (uri: string, options: { idempotent: true }) => Promise<void>;
  moveAsync: (options: { from: string; to: string }) => Promise<void>;
  readDirectoryAsync: (uri: string) => Promise<string[]>;
}>;

function cacheUri(cacheDirectory: string, name: string): string {
  return `${cacheDirectory.endsWith('/') ? cacheDirectory : `${cacheDirectory}/`}${name}`;
}

export async function scavengeStaleLabelPhotos(fileSystem: LabelPhotoFileSystem): Promise<number> {
  const cacheDirectory = fileSystem.cacheDirectory;
  if (!cacheDirectory) return 0;
  const entries = await fileSystem.readDirectoryAsync(cacheDirectory);
  const staleNames = entries
    .filter((name) => LABEL_PHOTO_CACHE_NAME.test(name))
    .sort()
    .slice(0, LABEL_PHOTO_STALE_DELETE_LIMIT);
  const results = await Promise.allSettled(
    staleNames.map((name) =>
      fileSystem.deleteAsync(cacheUri(cacheDirectory, name), { idempotent: true }),
    ),
  );
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failed) throw failed.reason;
  // Keep capture fail-closed while a bounded pass knowingly leaves managed
  // label photos behind. The visible retry performs the next bounded batch;
  // success means this listing proved that no additional managed photo exists.
  if (entries.filter((name) => LABEL_PHOTO_CACHE_NAME.test(name)).length > staleNames.length) {
    throw new Error(LABEL_PHOTO_SCAVENGE_INCOMPLETE);
  }
  return results.filter(({ status }) => status === 'fulfilled').length;
}

export function createLabelPhotoLifecycle(
  fileSystem: LabelPhotoFileSystem,
  createId: () => string,
) {
  let currentUri: string | null = null;
  let disposed = false;
  let operationVersion = 0;
  let operationTail = Promise.resolve();
  const pendingDeletionUris = new Set<string>();

  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const deleteTrackedPhotos = async (): Promise<void> => {
    if (currentUri !== null) pendingDeletionUris.add(currentUri);
    let firstError: unknown = null;
    for (const uri of [...pendingDeletionUris]) {
      try {
        await fileSystem.deleteAsync(uri, { idempotent: true });
        pendingDeletionUris.delete(uri);
        if (currentUri === uri) currentUri = null;
      } catch (error) {
        if (firstError === null) firstError = error;
      }
    }
    if (firstError !== null) throw firstError;
  };

  const cleanup = (_reason: LabelPhotoCleanupReason): Promise<void> => {
    operationVersion += 1;
    return serialize(deleteTrackedPhotos);
  };

  const adoptCapturedPhoto = (rawUri: string): Promise<string> => {
    const version = ++operationVersion;
    return serialize(async () => {
      const cacheDirectory = fileSystem.cacheDirectory;
      const id = createId().trim().toLowerCase();
      if (!cacheDirectory || !UUID.test(id)) {
        pendingDeletionUris.add(rawUri);
        await deleteTrackedPhotos();
        throw new Error('LABEL_PHOTO_CACHE_UNAVAILABLE');
      }
      const managedUri = cacheUri(cacheDirectory, `${LABEL_PHOTO_CACHE_PREFIX}${id}.jpg`);

      try {
        await deleteTrackedPhotos();
      } catch (error) {
        pendingDeletionUris.add(rawUri);
        await deleteTrackedPhotos();
        throw error;
      }

      try {
        await fileSystem.moveAsync({ from: rawUri, to: managedUri });
      } catch (error) {
        // A failed move may leave either endpoint behind. Retain both so a
        // visible retry can use idempotent deletion.
        pendingDeletionUris.add(rawUri);
        pendingDeletionUris.add(managedUri);
        await deleteTrackedPhotos();
        throw error;
      }
      if (disposed || version !== operationVersion) {
        // A capture resolving after unmount is moved under the managed prefix
        // first. Failed deletion remains retryable and next-start scavengable.
        pendingDeletionUris.add(managedUri);
        await deleteTrackedPhotos();
        throw new Error('LABEL_PHOTO_CAPTURE_STALE');
      }
      currentUri = managedUri;
      return managedUri;
    });
  };

  const dispose = (): Promise<void> => {
    disposed = true;
    operationVersion += 1;
    return serialize(deleteTrackedPhotos);
  };

  return {
    adoptCapturedPhoto,
    cleanup,
    current: () => currentUri,
    hasPendingCleanup: () => currentUri !== null || pendingDeletionUris.size > 0,
    dispose,
    drain: () => operationTail,
  };
}
