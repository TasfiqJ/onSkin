import { photoPathBelongsToUser } from '../_shared/storagePath.ts';

const STORAGE_LIST_PAGE_SIZE = 1000;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const STORAGE_REMOVE_CONCURRENCY = 4;
const STORAGE_CLEANUP_MAX_LIST_PAGES = 10_000;

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

export type PhotoStorageCleanupResult = 'deleted';

function storageFailure(code: 'STORAGE_LIST_FAILED' | 'STORAGE_REMOVE_FAILED'): Error {
  // Storage paths are private. Keep failures content-free so callers can safely
  // persist the code in the account-deletion receipt.
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

async function listFirstPage(
  bucket: PhotoStorageBucket,
  prefix: string,
): Promise<StorageListEntry[]> {
  try {
    const { data, error } = await bucket.list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error || !data) throw storageFailure('STORAGE_LIST_FAILED');
    return data;
  } catch {
    throw storageFailure('STORAGE_LIST_FAILED');
  }
}

async function removeOwnedPhotoPaths(
  bucket: PhotoStorageBucket,
  ownedPaths: string[],
): Promise<void> {
  const chunks: string[][] = [];
  for (let index = 0; index < ownedPaths.length; index += STORAGE_REMOVE_CHUNK_SIZE) {
    chunks.push(ownedPaths.slice(index, index + STORAGE_REMOVE_CHUNK_SIZE));
  }

  let nextChunk = 0;
  let failed = false;
  const workerCount = Math.min(STORAGE_REMOVE_CONCURRENCY, chunks.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (!failed) {
      const index = nextChunk;
      nextChunk += 1;
      const chunk = chunks[index];
      if (!chunk) return;

      try {
        const { error } = await bucket.remove(chunk);
        if (error) failed = true;
      } catch {
        failed = true;
      }
    }
  });

  await Promise.all(workers);
  if (failed) throw storageFailure('STORAGE_REMOVE_FAILED');
}

/**
 * Drains the user's storage tree from the first sorted page on every iteration.
 *
 * Deleting an offset page and then advancing the offset skips objects because
 * later rows shift left. Relisting offset zero avoids that race, uses only one
 * bounded page of memory, and makes a retry after any partial removal start at
 * the first remaining object. Nested virtual folders are drained before their
 * parent is relisted, so they disappear rather than pinning the first page.
 */
export async function deletePhotoStorage(
  userId: string,
  supabase: PhotoStorageClient,
): Promise<PhotoStorageCleanupResult> {
  if (!photoPathBelongsToUser(userId, `${userId}/ownership-check`)) {
    throw storageFailure('STORAGE_LIST_FAILED');
  }

  const bucket = supabase.storage.from('photos');
  const pendingPrefixes = [userId];
  let listedPages = 0;

  while (pendingPrefixes.length > 0) {
    if (listedPages >= STORAGE_CLEANUP_MAX_LIST_PAGES) {
      throw storageFailure('STORAGE_LIST_FAILED');
    }

    const prefix = pendingPrefixes[pendingPrefixes.length - 1]!;
    const page = await listFirstPage(bucket, prefix);
    listedPages += 1;

    if (page.length === 0) {
      pendingPrefixes.pop();
      continue;
    }

    // Validate the entire returned page before deleting anything from it.
    const childPrefixes = new Set<string>();
    const ownedPaths = new Set<string>();
    for (const entry of page) {
      const path = ownedChildPath(userId, prefix, entry.name);
      if (entry.id === null) {
        childPrefixes.add(path);
      } else if (typeof entry.id === 'string' && entry.id.length > 0) {
        ownedPaths.add(path);
      } else {
        throw storageFailure('STORAGE_LIST_FAILED');
      }
    }

    await removeOwnedPhotoPaths(bucket, [...ownedPaths].sort());

    // The stack is in-memory only by design: the durable deletion checkpoint
    // remains at `storage` until the root verifies empty. A process retry safely
    // rediscovers the remaining prefixes from offset zero.
    const sortedChildren = [...childPrefixes].sort().reverse();
    pendingPrefixes.push(...sortedChildren);
  }

  return 'deleted';
}

export const photoStorageCleanupLimits = {
  listPageSize: STORAGE_LIST_PAGE_SIZE,
  removeChunkSize: STORAGE_REMOVE_CHUNK_SIZE,
  removeConcurrency: STORAGE_REMOVE_CONCURRENCY,
  maxListPages: STORAGE_CLEANUP_MAX_LIST_PAGES,
} as const;
