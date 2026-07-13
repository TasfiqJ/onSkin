import { photoPathBelongsToUser } from '../_shared/storagePath.ts';

const STORAGE_LIST_PAGE_SIZE = 1000;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const STORAGE_CLEANUP_MAX_PASSES = 3;

type StorageListEntry = {
  name?: unknown;
  id?: unknown;
};

type StorageError = {
  message?: string;
};

type PhotoStorageBucket = {
  list: (
    prefix: string,
    options: {
      limit: number;
      offset: number;
      sortBy: { column: 'name'; order: 'asc' };
    },
  ) => Promise<{ data: StorageListEntry[] | null; error: StorageError | null }>;
  remove: (paths: string[]) => Promise<{ error: StorageError | null }>;
};

type PhotoStorageClient = {
  storage: {
    from: (bucket: 'photos') => PhotoStorageBucket;
  };
};

function storageFailure(code: 'STORAGE_LIST_FAILED' | 'STORAGE_REMOVE_FAILED'): Error {
  return new Error(code);
}

function ownedChildPath(userId: string, prefix: string, name: unknown): string {
  if (typeof name !== 'string' || name.length === 0 || name.includes('/')) {
    throw storageFailure('STORAGE_LIST_FAILED');
  }

  const path = `${prefix}/${name}`;
  if (!photoPathBelongsToUser(userId, path)) {
    throw storageFailure('STORAGE_LIST_FAILED');
  }
  return path;
}

async function listPage(
  bucket: PhotoStorageBucket,
  prefix: string,
  offset: number,
): Promise<StorageListEntry[]> {
  try {
    const { data, error } = await bucket.list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !data) throw storageFailure('STORAGE_LIST_FAILED');
    return data;
  } catch {
    throw storageFailure('STORAGE_LIST_FAILED');
  }
}

export async function collectOwnedPhotoPaths(
  userId: string,
  bucket: PhotoStorageBucket,
): Promise<string[]> {
  if (!photoPathBelongsToUser(userId, `${userId}/ownership-check`)) {
    throw storageFailure('STORAGE_LIST_FAILED');
  }

  const pendingPrefixes = [userId];
  const visitedPrefixes = new Set<string>();
  const ownedPaths = new Set<string>();

  for (let prefixIndex = 0; prefixIndex < pendingPrefixes.length; prefixIndex += 1) {
    const prefix = pendingPrefixes[prefixIndex]!;
    if (visitedPrefixes.has(prefix)) continue;
    visitedPrefixes.add(prefix);

    for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
      const page = await listPage(bucket, prefix, offset);
      for (const entry of page) {
        const path = ownedChildPath(userId, prefix, entry.name);
        if (entry.id === null) {
          if (!visitedPrefixes.has(path)) pendingPrefixes.push(path);
        } else if (typeof entry.id === 'string' && entry.id.length > 0) {
          ownedPaths.add(path);
        } else {
          throw storageFailure('STORAGE_LIST_FAILED');
        }
      }
      if (page.length < STORAGE_LIST_PAGE_SIZE) break;
    }
  }

  return [...ownedPaths].sort();
}

async function removeOwnedPhotoPaths(
  bucket: PhotoStorageBucket,
  ownedPaths: string[],
): Promise<void> {
  for (let index = 0; index < ownedPaths.length; index += STORAGE_REMOVE_CHUNK_SIZE) {
    const chunk = ownedPaths.slice(index, index + STORAGE_REMOVE_CHUNK_SIZE);
    try {
      const { error } = await bucket.remove(chunk);
      if (error) throw storageFailure('STORAGE_REMOVE_FAILED');
    } catch {
      throw storageFailure('STORAGE_REMOVE_FAILED');
    }
  }
}

export async function deletePhotoStorage(
  userId: string,
  supabase: PhotoStorageClient,
): Promise<void> {
  const bucket = supabase.storage.from('photos');

  for (let pass = 0; pass < STORAGE_CLEANUP_MAX_PASSES; pass += 1) {
    // Collection completes before the first removal so offset pagination is never
    // evaluated against a list that this function is simultaneously shrinking.
    const ownedPaths = await collectOwnedPhotoPaths(userId, bucket);
    if (ownedPaths.length === 0) return;
    await removeOwnedPhotoPaths(bucket, ownedPaths);
  }

  // Do not delete auth.users while storage is still changing or a remove call
  // silently left owned objects behind. A later account-deletion retry is safe.
  throw storageFailure('STORAGE_REMOVE_FAILED');
}

export const photoStorageCleanupLimits = {
  listPageSize: STORAGE_LIST_PAGE_SIZE,
  removeChunkSize: STORAGE_REMOVE_CHUNK_SIZE,
  maxPasses: STORAGE_CLEANUP_MAX_PASSES,
} as const;
