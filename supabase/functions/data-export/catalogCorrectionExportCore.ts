import { checksumRows, type PaginatedRows } from './exportCore.ts';

export const CATALOG_CORRECTION_EXPORT_COLUMNS = [
  'id',
  'user_id',
  'product_id',
  'barcode',
  'correction_type',
  'status',
  'description',
  'proposed_payload',
  'client_context',
  'source_id',
  'created_at',
  'updated_at',
] as const;

export type CatalogCorrectionExportCursor = {
  createdAt: string;
  id: string;
};

type RpcRow = Record<string, unknown> & {
  export_total_count?: unknown;
  created_at?: unknown;
  id?: unknown;
};

function sourceFailure(reason: string): Error {
  return new Error(`EXPORT_SOURCE_INCOMPLETE:catalog_corrections:${reason}`);
}

function exactCount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw sourceFailure('EXACT_COUNT_UNAVAILABLE');
  }
  return value as number;
}

function cursorFor(row: RpcRow): CatalogCorrectionExportCursor & { sortKey: string } {
  const match =
    typeof row.created_at === 'string'
      ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(
          row.created_at,
        )
      : null;
  if (
    !match ||
    !Number.isFinite(Date.parse(row.created_at as string)) ||
    typeof row.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.id)
  ) {
    throw sourceFailure('INVALID_CURSOR');
  }
  return {
    createdAt: row.created_at as string,
    id: row.id,
    sortKey: `${match.slice(1, 7).join('')}${(match[7] ?? '').padEnd(6, '0')}`,
  };
}

function projectRow(row: RpcRow): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const column of CATALOG_CORRECTION_EXPORT_COLUMNS) {
    if (!Object.hasOwn(row, column)) {
      throw sourceFailure(`MISSING_COLUMN:${column}`);
    }
    projected[column] = row[column];
  }
  if (
    Object.keys(row).some(
      (column) =>
        column !== 'export_total_count' &&
        !CATALOG_CORRECTION_EXPORT_COLUMNS.includes(
          column as (typeof CATALOG_CORRECTION_EXPORT_COLUMNS)[number],
        ),
    )
  ) {
    throw sourceFailure('UNEXPECTED_COLUMN');
  }
  return projected;
}

export async function paginateCatalogCorrections(options: {
  expectedUserId: string;
  pageSize: number;
  maxRows: number;
  fetchPage: (cursor: CatalogCorrectionExportCursor | null, limit: number) => Promise<RpcRow[]>;
}): Promise<PaginatedRows> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      options.expectedUserId,
    )
  ) {
    throw new Error('INVALID_CATALOG_CORRECTION_EXPORT_OWNER');
  }
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 500) {
    throw new Error('INVALID_CATALOG_CORRECTION_EXPORT_PAGE_SIZE');
  }
  if (!Number.isInteger(options.maxRows) || options.maxRows < options.pageSize) {
    throw new Error('INVALID_CATALOG_CORRECTION_EXPORT_ROW_LIMIT');
  }

  const readPass = async (): Promise<{
    rows: Record<string, unknown>[];
    count: number;
    pageRequests: number;
    checksum: string;
  }> => {
    const rows: Record<string, unknown>[] = [];
    const identities = new Set<string>();
    let cursor: CatalogCorrectionExportCursor | null = null;
    let previousOrder: { sortKey: string; id: string } | null = null;
    let count: number | null = null;
    let pageRequests = 0;

    while (true) {
      const page = await options.fetchPage(cursor, options.pageSize);
      pageRequests += 1;
      if (!Array.isArray(page) || page.length > options.pageSize) {
        throw sourceFailure('INVALID_PAGE');
      }
      if (count === null) {
        count = page.length === 0 ? 0 : exactCount(page[0]?.export_total_count);
        if (count > options.maxRows) throw sourceFailure('ROW_LIMIT_EXCEEDED');
      }

      for (const rawRow of page) {
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
          throw sourceFailure('INVALID_ROW');
        }
        if (rawRow.user_id !== options.expectedUserId) {
          throw sourceFailure('OWNER_MISMATCH');
        }
        if (exactCount(rawRow.export_total_count) !== count) {
          throw sourceFailure('COUNT_CHANGED_DURING_PAGINATION');
        }
        const nextCursor = cursorFor(rawRow);
        const identity = JSON.stringify([nextCursor.createdAt, nextCursor.id]);
        if (identities.has(identity)) throw sourceFailure('DUPLICATE_ORDER_KEY');
        if (
          previousOrder &&
          (nextCursor.sortKey < previousOrder.sortKey ||
            (nextCursor.sortKey === previousOrder.sortKey && nextCursor.id <= previousOrder.id))
        ) {
          throw sourceFailure('NON_MONOTONIC_ORDER');
        }
        identities.add(identity);
        rows.push(projectRow(rawRow));
        cursor = { createdAt: nextCursor.createdAt, id: nextCursor.id };
        previousOrder = { sortKey: nextCursor.sortKey, id: nextCursor.id };
        if (rows.length > count || rows.length > options.maxRows) {
          throw sourceFailure('COUNT_CHANGED_DURING_PAGINATION');
        }
      }

      if (page.length < options.pageSize) break;
    }

    if (rows.length !== count) throw sourceFailure('COUNT_MISMATCH');
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
    throw sourceFailure('UNSTABLE_SNAPSHOT');
  }

  return {
    rows: second.rows,
    manifest: {
      kind: 'database_table',
      scope: 'caller_rpc_owner',
      order_by: ['created_at', 'id'],
      count: second.rows.length,
      count_before: first.count,
      count_after: second.count,
      page_requests: first.pageRequests + second.pageRequests,
      checksum: second.checksum,
      checksum_algorithm: 'sha256-canonical-json-v1',
      complete: true,
      note: 'Read only through the owner-scoped SECURITY DEFINER export RPC; internal assignment, reviewer, intake, and operator fields are excluded.',
    },
  };
}
