import { photoPathBelongsToUser } from '../_shared/storagePath.ts';

export type DatabaseSourceManifest = {
  kind: 'database_table';
  scope: 'caller_rls' | 'service_role_filtered';
  order_by: readonly string[];
  count: number;
  count_before: number;
  count_after: number;
  page_requests: number;
  checksum: string;
  checksum_algorithm: 'sha256-canonical-json-v1';
  complete: true;
  note?: string;
};

export type StorageSourceManifest = {
  kind: 'storage_inventory';
  scope: 'service_role_owner_prefix';
  order_by: readonly ['path'];
  count: number;
  verification_passes: 2;
  page_requests: number;
  checksum: string;
  checksum_algorithm: 'sha256-canonical-json-v1';
  complete: true;
};

export type DerivedSourceManifest = {
  kind: 'derived';
  count: number;
  checksum: string;
  checksum_algorithm: 'sha256-canonical-json-v1';
  checksum_fields: readonly string[];
  complete: true;
  note?: string;
};

export type ExportSourceManifest =
  | DatabaseSourceManifest
  | StorageSourceManifest
  | DerivedSourceManifest;

export type PaginatedRows = {
  rows: Record<string, unknown>[];
  manifest: DatabaseSourceManifest;
};

export type ExportMemoryBudgetSnapshot = Readonly<{
  maxBytes: number;
  maxItems: number;
  retainedBytes: number;
  retainedItems: number;
  peakRetainedBytes: number;
  peakRetainedItems: number;
}>;

export type ExportMemoryBudget = Readonly<{
  reserveJson: (source: string, value: unknown) => number;
  release: (bytes: number, items: number) => void;
  snapshot: () => ExportMemoryBudgetSnapshot;
}>;

export const EXPORT_RETAINED_ITEM_OVERHEAD_BYTES = 128;

export type StorageListEntry = {
  name?: unknown;
  id?: unknown;
};

export type StorageListOptions = {
  limit: number;
  offset: number;
  sortBy: { column: 'name'; order: 'asc' };
};

export type StorageBucket = {
  list: (
    prefix: string,
    options: StorageListOptions,
  ) => Promise<{
    data: StorageListEntry[] | null;
    error: { message?: string } | null;
  }>;
};

export const EXPORT_CONSISTENCY = {
  model: 'independent_count_guarded_reads',
  guarantees: [
    'Every database source is read in deterministic unique-key order using bounded pages.',
    'A database source is returned only when its exact count before pagination, exported row count, and exact count after pagination are equal.',
    'Storage pagination advances by the rows actually returned and probes every short-page boundary, so a service-side page cap cannot silently skip objects.',
    'The owner-prefixed photo-storage inventory is returned only when two complete, deterministically ordered listings have identical counts and checksums.',
    'Every returned source has a count and a SHA-256 checksum over canonical JSON.',
  ],
  limitations: [
    'Supabase PostgREST and Storage reads in this Edge Function do not share a database transaction or cross-source snapshot.',
    'Rows updated while a source is paginated can contain values from different instants even when the source count is stable.',
    'A concurrent delete and insert that preserve a source count can evade the count guard; duplicate ordering keys and unstable storage inventories still fail closed.',
    'Rows committed after a source finishes, or storage objects committed after the verified inventory, are not part of this export.',
  ],
} as const;

function sourceFailure(source: string, reason: string): Error {
  return new Error(`EXPORT_SOURCE_INCOMPLETE:${source}:${reason}`);
}

function normalizeForCanonicalJson(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : normalizeForCanonicalJson(item)));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) normalized[key] = normalizeForCanonicalJson(record[key]);
    }
    return normalized;
  }
  throw new Error('EXPORT_CHECKSUM_UNSUPPORTED_VALUE');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeForCanonicalJson(value));
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function createExportMemoryBudget(maxBytes: number, maxItems: number): ExportMemoryBudget {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('INVALID_EXPORT_MEMORY_BUDGET');
  }
  if (!Number.isSafeInteger(maxItems) || maxItems < 1) {
    throw new Error('INVALID_EXPORT_MEMORY_ITEM_BUDGET');
  }

  let retainedBytes = 0;
  let retainedItems = 0;
  let peakRetainedBytes = 0;
  let peakRetainedItems = 0;
  return Object.freeze({
    reserveJson(source: string, value: unknown): number {
      // The fixed allowance covers the retained array/set/map/object reference
      // cost around each value; one more byte covers its JSON delimiter.
      const bytes = utf8ByteLength(canonicalJson(value)) + EXPORT_RETAINED_ITEM_OVERHEAD_BYTES + 1;
      if (bytes > maxBytes - retainedBytes || retainedItems >= maxItems) {
        throw sourceFailure(source, 'MEMORY_BUDGET_EXCEEDED');
      }
      retainedBytes += bytes;
      retainedItems += 1;
      peakRetainedBytes = Math.max(peakRetainedBytes, retainedBytes);
      peakRetainedItems = Math.max(peakRetainedItems, retainedItems);
      return bytes;
    },
    release(bytes: number, items: number): void {
      if (
        !Number.isSafeInteger(bytes) ||
        bytes < 0 ||
        bytes > retainedBytes ||
        !Number.isSafeInteger(items) ||
        items < 0 ||
        items > retainedItems
      ) {
        throw new Error('INVALID_EXPORT_MEMORY_RELEASE');
      }
      retainedBytes -= bytes;
      retainedItems -= items;
    },
    snapshot(): ExportMemoryBudgetSnapshot {
      return Object.freeze({
        maxBytes,
        maxItems,
        retainedBytes,
        retainedItems,
        peakRetainedBytes,
        peakRetainedItems,
      });
    },
  });
}

export function encodeJsonWithinByteLimit(
  value: unknown,
  maxBytes: number,
): Readonly<{ body: string; byteLength: number }> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('INVALID_EXPORT_RESPONSE_BYTE_LIMIT');
  }
  const body = JSON.stringify(value);
  if (typeof body !== 'string') throw new Error('EXPORT_RESPONSE_INVALID');
  const byteLength = utf8ByteLength(body);
  if (byteLength > maxBytes) throw new Error('EXPORT_RESPONSE_BYTE_LIMIT_EXCEEDED');
  return Object.freeze({ body, byteLength });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function checksumRows(rows: readonly unknown[]): Promise<string> {
  return `sha256:${await sha256Hex(canonicalJson(rows))}`;
}

function exactCount(source: string, count: number | null): number {
  if (!Number.isSafeInteger(count) || (count as number) < 0) {
    throw sourceFailure(source, 'EXACT_COUNT_UNAVAILABLE');
  }
  return count as number;
}

function orderIdentity(
  source: string,
  row: Record<string, unknown>,
  orderBy: readonly string[],
): string {
  const values = orderBy.map((column) => {
    const value = row[column];
    if (value === null || value === undefined) {
      throw sourceFailure(source, `NULL_ORDER_KEY:${column}`);
    }
    return value;
  });
  return canonicalJson(values);
}

export async function paginateRows(options: {
  source: string;
  scope: DatabaseSourceManifest['scope'];
  orderBy: readonly string[];
  pageSize: number;
  maxRows: number;
  note?: string;
  memoryBudget?: ExportMemoryBudget;
  fetchCount: () => Promise<number | null>;
  fetchPage: (offset: number, limit: number) => Promise<Record<string, unknown>[]>;
}): Promise<PaginatedRows> {
  const { source, pageSize, maxRows, orderBy } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('INVALID_EXPORT_PAGE_SIZE');
  if (!Number.isInteger(maxRows) || maxRows < pageSize) throw new Error('INVALID_EXPORT_ROW_LIMIT');
  if (orderBy.length === 0) throw new Error('EXPORT_ORDER_REQUIRED');

  const countBefore = exactCount(source, await options.fetchCount());
  if (countBefore > maxRows) throw sourceFailure(source, 'ROW_LIMIT_EXCEEDED');

  const rows: Record<string, unknown>[] = [];
  const orderIdentities = new Set<string>();
  let pageRequests = 0;
  let reservedBytes = 0;
  let reservedItems = 0;

  try {
    for (let offset = 0; ; offset += pageSize) {
      const page = await options.fetchPage(offset, pageSize);
      pageRequests += 1;
      if (!Array.isArray(page) || page.length > pageSize) {
        throw sourceFailure(source, 'INVALID_PAGE');
      }

      for (const row of page) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          throw sourceFailure(source, 'INVALID_ROW');
        }
        const identity = orderIdentity(source, row, orderBy);
        if (orderIdentities.has(identity)) {
          throw sourceFailure(source, 'DUPLICATE_ORDER_KEY');
        }
        const rowBytes = options.memoryBudget?.reserveJson(source, row) ?? 0;
        reservedBytes += rowBytes;
        if (options.memoryBudget) reservedItems += 1;
        orderIdentities.add(identity);
        rows.push(row);
        if (rows.length > countBefore || rows.length > maxRows) {
          throw sourceFailure(source, 'COUNT_CHANGED_DURING_PAGINATION');
        }
      }

      if (page.length < pageSize) break;
    }

    const countAfter = exactCount(source, await options.fetchCount());
    if (countBefore !== countAfter || rows.length !== countBefore) {
      throw sourceFailure(source, 'COUNT_MISMATCH');
    }

    return {
      rows,
      manifest: {
        kind: 'database_table',
        scope: options.scope,
        order_by: [...orderBy],
        count: rows.length,
        count_before: countBefore,
        count_after: countAfter,
        page_requests: pageRequests,
        checksum: await checksumRows(rows),
        checksum_algorithm: 'sha256-canonical-json-v1',
        complete: true,
        ...(options.note ? { note: options.note } : {}),
      },
    };
  } catch (error) {
    options.memoryBudget?.release(reservedBytes, reservedItems);
    throw error;
  }
}

export async function boundedMap<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('INVALID_EXPORT_CONCURRENCY');
  }
  if (values.length === 0) return [];

  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (failure === null && nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await operation(values[index]!, index);
      } catch (error) {
        failure ??= error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  if (failure !== null) throw failure;
  return results;
}

function ownedChildPath(userId: string, prefix: string, name: unknown): string {
  if (typeof name !== 'string' || name.length === 0 || name.includes('/')) {
    throw sourceFailure('photo_storage_objects', 'INVALID_LIST_ENTRY');
  }
  const path = `${prefix}/${name}`;
  if (!photoPathBelongsToUser(userId, path)) {
    throw sourceFailure('photo_storage_objects', 'INVALID_LIST_ENTRY');
  }
  return path;
}

async function listStorageOnce(options: {
  userId: string;
  bucket: StorageBucket;
  pageSize: number;
  maxObjects: number;
  memoryBudget?: ExportMemoryBudget;
}): Promise<{
  paths: string[];
  pageRequests: number;
  reservedBytes: number;
  reservedItems: number;
}> {
  const { userId, bucket, pageSize, maxObjects } = options;
  const pendingPrefixes = [userId];
  const knownPrefixes = new Set(pendingPrefixes);
  const visitedPrefixes = new Set<string>();
  const paths = new Set<string>();
  let pageRequests = 0;
  let reservedBytes = 0;
  let reservedItems = 0;

  try {
    for (let prefixIndex = 0; prefixIndex < pendingPrefixes.length; prefixIndex += 1) {
      const prefix = pendingPrefixes[prefixIndex]!;
      if (visitedPrefixes.has(prefix)) continue;
      visitedPrefixes.add(prefix);
      if (visitedPrefixes.size > maxObjects) {
        throw sourceFailure('photo_storage_objects', 'PREFIX_LIMIT_EXCEEDED');
      }

      let offset = 0;
      while (true) {
        let page: StorageListEntry[];
        try {
          const { data, error } = await bucket.list(prefix, {
            limit: pageSize,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          });
          pageRequests += 1;
          if (error || !data || data.length > pageSize) {
            throw sourceFailure('photo_storage_objects', 'LIST_FAILED');
          }
          page = data;
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('EXPORT_SOURCE_INCOMPLETE:')) {
            throw error;
          }
          throw sourceFailure('photo_storage_objects', 'LIST_FAILED');
        }

        for (const entry of page) {
          const path = ownedChildPath(userId, prefix, entry.name);
          if (entry.id === null) {
            if (!knownPrefixes.has(path)) {
              const pathBytes =
                options.memoryBudget?.reserveJson('photo_storage_objects', path) ?? 0;
              reservedBytes += pathBytes;
              if (options.memoryBudget) reservedItems += 1;
              knownPrefixes.add(path);
              pendingPrefixes.push(path);
            }
          } else if (typeof entry.id === 'string' && entry.id.length > 0) {
            if (paths.has(path)) {
              throw sourceFailure('photo_storage_objects', 'DUPLICATE_PATH');
            }
            const pathBytes = options.memoryBudget?.reserveJson('photo_storage_objects', path) ?? 0;
            reservedBytes += pathBytes;
            if (options.memoryBudget) reservedItems += 1;
            paths.add(path);
            if (paths.size > maxObjects) {
              throw sourceFailure('photo_storage_objects', 'OBJECT_LIMIT_EXCEEDED');
            }
          } else {
            throw sourceFailure('photo_storage_objects', 'INVALID_LIST_ENTRY');
          }
        }

        offset += page.length;
        if (page.length === 0) break;
        if (page.length < pageSize) {
          try {
            const { data, error } = await bucket.list(prefix, {
              limit: 1,
              offset,
              sortBy: { column: 'name', order: 'asc' },
            });
            pageRequests += 1;
            if (error || !data || data.length > 1) {
              throw sourceFailure('photo_storage_objects', 'LIST_FAILED');
            }
            if (data.length === 0) break;
          } catch (error) {
            if (error instanceof Error && error.message.startsWith('EXPORT_SOURCE_INCOMPLETE:')) {
              throw error;
            }
            throw sourceFailure('photo_storage_objects', 'LIST_FAILED');
          }
        }
      }
    }

    return { paths: [...paths].sort(), pageRequests, reservedBytes, reservedItems };
  } catch (error) {
    options.memoryBudget?.release(reservedBytes, reservedItems);
    throw error;
  }
}

export async function listStoragePathsVerified(options: {
  userId: string;
  bucket: StorageBucket;
  pageSize: number;
  maxObjects: number;
  memoryBudget?: ExportMemoryBudget;
}): Promise<{ paths: string[]; manifest: StorageSourceManifest }> {
  if (!photoPathBelongsToUser(options.userId, `${options.userId}/ownership-check`)) {
    throw sourceFailure('photo_storage_objects', 'INVALID_OWNER');
  }
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1) {
    throw new Error('INVALID_STORAGE_PAGE_SIZE');
  }
  if (!Number.isInteger(options.maxObjects) || options.maxObjects < options.pageSize) {
    throw new Error('INVALID_STORAGE_OBJECT_LIMIT');
  }

  let first: Awaited<ReturnType<typeof listStorageOnce>> | null = null;
  let second: Awaited<ReturnType<typeof listStorageOnce>> | null = null;
  try {
    first = await listStorageOnce(options);
    const firstChecksum = await checksumRows(first.paths.map((path) => ({ path })));
    second = await listStorageOnce(options);
    const secondChecksum = await checksumRows(second.paths.map((path) => ({ path })));

    if (first.paths.length !== second.paths.length || firstChecksum !== secondChecksum) {
      throw sourceFailure('photo_storage_objects', 'UNSTABLE_INVENTORY');
    }

    const pageRequests = first.pageRequests + second.pageRequests;
    options.memoryBudget?.release(first.reservedBytes, first.reservedItems);
    first = null;
    return {
      paths: second.paths,
      manifest: {
        kind: 'storage_inventory',
        scope: 'service_role_owner_prefix',
        order_by: ['path'],
        count: second.paths.length,
        verification_passes: 2,
        page_requests: pageRequests,
        checksum: secondChecksum,
        checksum_algorithm: 'sha256-canonical-json-v1',
        complete: true,
      },
    };
  } catch (error) {
    if (first) options.memoryBudget?.release(first.reservedBytes, first.reservedItems);
    if (second) options.memoryBudget?.release(second.reservedBytes, second.reservedItems);
    throw error;
  }
}

export async function derivedManifest(options: {
  rows: readonly unknown[];
  checksumRows?: readonly unknown[];
  checksumFields: readonly string[];
  note?: string;
}): Promise<DerivedSourceManifest> {
  return {
    kind: 'derived',
    count: options.rows.length,
    checksum: await checksumRows(options.checksumRows ?? options.rows),
    checksum_algorithm: 'sha256-canonical-json-v1',
    checksum_fields: [...options.checksumFields],
    complete: true,
    ...(options.note ? { note: options.note } : {}),
  };
}
