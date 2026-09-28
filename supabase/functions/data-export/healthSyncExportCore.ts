import { checksumRows, type PaginatedRows } from './exportCore.ts';

export const HEALTH_SYNC_EXPORT_SOURCES = {
  shelf_product_identities: {
    rpc: 'export_shelf_product_identities_for_subject',
    idColumn: 'id',
    columns: ['id', 'user_id', 'created_at', 'deleted_effective_at', 'deleted_received_at'],
    note: 'Read only through the authenticated-subject Shelf-identity export RPC. Shelf content and internal sync integrity digests are not part of this identity record.',
  },
  shelf_sync_receipts: {
    rpc: 'export_shelf_sync_receipts_for_subject',
    idColumn: 'operation_id',
    columns: ['operation_id', 'user_id', 'state', 'result_code', 'created_at', 'finalized_at'],
    note: 'Read only through the authenticated-subject Shelf-sync receipt RPC. Internal request fingerprints are excluded security metadata.',
  },
  routine_completion_sync_receipts: {
    rpc: 'export_routine_completion_sync_receipts_for_subject',
    idColumn: 'event_id',
    columns: ['event_id', 'user_id', 'state', 'result_code', 'created_at', 'finalized_at'],
    note: 'Read only through the authenticated-subject routine-completion receipt RPC. Internal request fingerprints are excluded security metadata.',
  },
} as const;

export type HealthSyncExportSource = keyof typeof HEALTH_SYNC_EXPORT_SOURCES;

export type HealthSyncExportCursor = {
  createdAt: string;
  id: string;
};

type RpcRow = Record<string, unknown> & {
  export_total_count?: unknown;
  created_at?: unknown;
  user_id?: unknown;
};

function sourceFailure(source: HealthSyncExportSource, reason: string): Error {
  return new Error(`EXPORT_SOURCE_INCOMPLETE:${source}:${reason}`);
}

function exactCount(source: HealthSyncExportSource, value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw sourceFailure(source, 'EXACT_COUNT_UNAVAILABLE');
  }
  return value as number;
}

function cursorFor(
  source: HealthSyncExportSource,
  row: RpcRow,
): HealthSyncExportCursor & { sortKey: string } {
  const definition = HEALTH_SYNC_EXPORT_SOURCES[source];
  const match =
    typeof row.created_at === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(
          row.created_at,
        )
      : null;
  const id = row[definition.idColumn];
  if (
    !match ||
    !Number.isFinite(Date.parse(row.created_at as string)) ||
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw sourceFailure(source, 'INVALID_CURSOR');
  }
  return {
    createdAt: row.created_at as string,
    id,
    sortKey: `${match.slice(1, 7).join('')}${(match[7] ?? '').padEnd(6, '0')}`,
  };
}

function projectRow(source: HealthSyncExportSource, row: RpcRow): Record<string, unknown> {
  const columns = HEALTH_SYNC_EXPORT_SOURCES[source].columns as readonly string[];
  const projected: Record<string, unknown> = {};
  for (const column of columns) {
    if (!Object.hasOwn(row, column)) {
      throw sourceFailure(source, `MISSING_COLUMN:${column}`);
    }
    projected[column] = row[column];
  }
  if (
    Object.keys(row).some((column) => column !== 'export_total_count' && !columns.includes(column))
  ) {
    throw sourceFailure(source, 'UNEXPECTED_COLUMN');
  }
  return projected;
}

export async function paginateHealthSyncSource(options: {
  source: HealthSyncExportSource;
  expectedUserId: string;
  pageSize: number;
  maxRows: number;
  fetchPage: (cursor: HealthSyncExportCursor | null, limit: number) => Promise<RpcRow[]>;
}): Promise<PaginatedRows> {
  const { source } = options;
  const definition = HEALTH_SYNC_EXPORT_SOURCES[source];
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.expectedUserId,
    )
  ) {
    throw new Error('INVALID_HEALTH_SYNC_EXPORT_OWNER');
  }
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) {
    throw new Error('INVALID_HEALTH_SYNC_EXPORT_PAGE_SIZE');
  }
  if (!Number.isInteger(options.maxRows) || options.maxRows < options.pageSize) {
    throw new Error('INVALID_HEALTH_SYNC_EXPORT_ROW_LIMIT');
  }

  const readPass = async (): Promise<{
    rows: Record<string, unknown>[];
    count: number;
    pageRequests: number;
    checksum: string;
  }> => {
    const rows: Record<string, unknown>[] = [];
    const identities = new Set<string>();
    let cursor: HealthSyncExportCursor | null = null;
    let previousOrder: { sortKey: string; id: string } | null = null;
    let count: number | null = null;
    let pageRequests = 0;

    while (true) {
      const page = await options.fetchPage(cursor, options.pageSize);
      pageRequests += 1;
      if (!Array.isArray(page) || page.length > options.pageSize) {
        throw sourceFailure(source, 'INVALID_PAGE');
      }
      if (count === null) {
        count = page.length === 0 ? 0 : exactCount(source, page[0]?.export_total_count);
        if (count > options.maxRows) throw sourceFailure(source, 'ROW_LIMIT_EXCEEDED');
      }

      for (const rawRow of page) {
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
          throw sourceFailure(source, 'INVALID_ROW');
        }
        if (rawRow.user_id !== options.expectedUserId) {
          throw sourceFailure(source, 'OWNER_MISMATCH');
        }
        if (exactCount(source, rawRow.export_total_count) !== count) {
          throw sourceFailure(source, 'COUNT_CHANGED_DURING_PAGINATION');
        }
        const nextCursor = cursorFor(source, rawRow);
        const identity = JSON.stringify([nextCursor.createdAt, nextCursor.id]);
        if (identities.has(identity)) throw sourceFailure(source, 'DUPLICATE_ORDER_KEY');
        if (
          previousOrder &&
          (nextCursor.sortKey < previousOrder.sortKey ||
            (nextCursor.sortKey === previousOrder.sortKey && nextCursor.id <= previousOrder.id))
        ) {
          throw sourceFailure(source, 'NON_MONOTONIC_ORDER');
        }
        identities.add(identity);
        rows.push(projectRow(source, rawRow));
        cursor = { createdAt: nextCursor.createdAt, id: nextCursor.id };
        previousOrder = { sortKey: nextCursor.sortKey, id: nextCursor.id };
        if (rows.length > count || rows.length > options.maxRows) {
          throw sourceFailure(source, 'COUNT_CHANGED_DURING_PAGINATION');
        }
      }

      if (page.length < options.pageSize) break;
    }

    if (rows.length !== count) throw sourceFailure(source, 'COUNT_MISMATCH');
    return {
      rows,
      count,
      pageRequests,
      checksum: await checksumRows(rows),
    };
  };

  const first = await readPass();
  const second = await readPass();
  if (first.count !== second.count || first.checksum !== second.checksum) {
    throw sourceFailure(source, 'UNSTABLE_SNAPSHOT');
  }

  return {
    rows: second.rows,
    manifest: {
      kind: 'database_table',
      scope: 'caller_rpc_owner',
      order_by: ['created_at', definition.idColumn],
      count: second.rows.length,
      count_before: first.count,
      count_after: second.count,
      page_requests: first.pageRequests + second.pageRequests,
      checksum: second.checksum,
      checksum_algorithm: 'sha256-canonical-json-v1',
      complete: true,
      note: definition.note,
    },
  };
}
