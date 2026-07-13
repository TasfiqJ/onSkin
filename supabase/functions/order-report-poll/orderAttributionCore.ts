export const ORDER_ATTRIBUTION_LOOKUP_BATCH_SIZE = 500;
export const ORDER_REPORT_PAGE_SIZE = 500;
export const ORDER_REPORT_MAX_PAGES = 200;
export const ORDER_REPORT_UPSTREAM_FAILED = 'ORDER_REPORT_UPSTREAM_FAILED';
export const ORDER_REPORT_PAGE_LIMIT_EXCEEDED = 'ORDER_REPORT_PAGE_LIMIT_EXCEEDED';
export const ORDER_ATTRIBUTION_PERSIST_FAILED = 'ORDER_ATTRIBUTION_PERSIST_FAILED';

export type ShopMyOrderInput = {
  orderId: string;
  orderAmountUSD?: number;
  commissionAmountUSD?: number;
  status?: string;
  transactionDate?: string;
  recordUpdatedDate?: string;
  clickToken?: string;
};

// Exact documented ShopMy wire keys. The public Order Report currently does
// not expose a click-token/click-id field, so the adapter must not invent one.
export type ShopMyOrderReportWireItem = {
  'Order ID': unknown;
  'Transaction Date'?: unknown;
  'Record Updated Date'?: unknown;
  'Click Date'?: unknown;
  'Order Amount USD'?: unknown;
  'Commission Amount USD'?: unknown;
  'Creator Name'?: unknown;
  'Creator ShopMy'?: unknown;
  Domain?: unknown;
  Code?: unknown;
  Currency?: unknown;
  'Click-Order Delta (Hours)'?: unknown;
  SKU?: unknown;
  'Customer Status'?: unknown;
  'Ship-to Country'?: unknown;
  'Gross Sales'?: unknown;
  'Number of Items'?: unknown;
};

export type OrderAttributionRow = {
  external_order_id: string;
  click_token: string | null;
  order_amount_cents: number | null;
  commission_cents: number | null;
  status: 'pending' | 'locked' | 'returned';
  transaction_date: string | null;
  record_updated_at: string | null;
};

export type OrderAttributionGateway = {
  findKnownClickTokens: (tokens: readonly string[]) => Promise<readonly string[]>;
  upsertOrderAttributions: (rows: readonly OrderAttributionRow[]) => Promise<void>;
};

export type OrderReportPageRequest = {
  recordUpdatedStartDate: string;
  recordUpdatedEndDate: string;
  page: number;
  limit: number;
};

export type OrderReportPollGateway<ResponseType extends { ok: boolean }> = {
  fetchPage: (request: OrderReportPageRequest) => Promise<ResponseType>;
  readJson: (response: ResponseType) => Promise<unknown>;
  persistPage: (orders: readonly ShopMyOrderInput[]) => Promise<number>;
};

function stableFailure(code: string): Error {
  return new Error(code);
}

function optionalUsdNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (normalized.length > 64 || !/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) {
      throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
}

function optionalTimestamp(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
  }
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > 64 || !Number.isFinite(Date.parse(normalized))) {
    throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
  }
  return normalized;
}

export function normalizeShopMyBrandDomain(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/i.test(
      normalized,
    )
  ) {
    return '';
  }
  return normalized;
}

export function adaptShopMyOrderReportItem(value: unknown): ShopMyOrderInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
  }
  const wire = value as ShopMyOrderReportWireItem;
  if (typeof wire['Order ID'] !== 'string') {
    throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
  }
  const orderId = wire['Order ID'].trim();
  if (!orderId || orderId.length > 255) {
    throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
  }

  return {
    orderId,
    orderAmountUSD: optionalUsdNumber(wire['Order Amount USD']),
    commissionAmountUSD: optionalUsdNumber(wire['Commission Amount USD']),
    transactionDate: optionalTimestamp(wire['Transaction Date']),
    recordUpdatedDate: optionalTimestamp(wire['Record Updated Date']),
  };
}

export function orderReportFailure(error: unknown): {
  status: 502 | 503;
  publicCode:
    | 'order_report_upstream_failed'
    | 'order_report_page_limit_exceeded'
    | 'order_attribution_persist_failed';
  logCode: string;
} {
  const code = error instanceof Error ? error.message : '';
  if (code === ORDER_ATTRIBUTION_PERSIST_FAILED) {
    return {
      status: 503,
      publicCode: 'order_attribution_persist_failed',
      logCode: ORDER_ATTRIBUTION_PERSIST_FAILED,
    };
  }
  if (code === ORDER_REPORT_PAGE_LIMIT_EXCEEDED) {
    return {
      status: 502,
      publicCode: 'order_report_page_limit_exceeded',
      logCode: ORDER_REPORT_PAGE_LIMIT_EXCEEDED,
    };
  }
  return {
    status: 502,
    publicCode: 'order_report_upstream_failed',
    logCode: ORDER_REPORT_UPSTREAM_FAILED,
  };
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export async function pollOrderReportPages<ResponseType extends { ok: boolean }>(
  options: {
    recordUpdatedStartDate: string;
    recordUpdatedEndDate: string;
    pageSize?: number;
    maxPages?: number;
  },
  gateway: OrderReportPollGateway<ResponseType>,
): Promise<number> {
  const pageSize = options.pageSize ?? ORDER_REPORT_PAGE_SIZE;
  const maxPages = options.maxPages ?? ORDER_REPORT_MAX_PAGES;
  if (
    !options.recordUpdatedStartDate ||
    !options.recordUpdatedEndDate ||
    !positiveSafeInteger(pageSize) ||
    !positiveSafeInteger(maxPages)
  ) {
    throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
  }

  let persistedTotal = 0;
  for (let page = 0; page < maxPages; page += 1) {
    let response: ResponseType;
    try {
      response = await gateway.fetchPage({
        recordUpdatedStartDate: options.recordUpdatedStartDate,
        recordUpdatedEndDate: options.recordUpdatedEndDate,
        page,
        limit: pageSize,
      });
    } catch {
      throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
    }
    if (!response || response.ok !== true) {
      throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
    }

    let payload: unknown;
    try {
      payload = await gateway.readJson(response);
    } catch {
      throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
    }
    if (!Array.isArray(payload) || payload.length > pageSize) {
      throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
    }
    if (payload.length === 0) return persistedTotal;

    let orders: ShopMyOrderInput[];
    try {
      orders = payload.map(adaptShopMyOrderReportItem);
    } catch {
      throw stableFailure(ORDER_REPORT_UPSTREAM_FAILED);
    }

    let persisted: number;
    try {
      persisted = await gateway.persistPage(orders);
    } catch {
      throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
    }
    if (!Number.isSafeInteger(persisted) || persisted !== orders.length) {
      throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
    }
    persistedTotal += persisted;

    if (orders.length < pageSize) return persistedTotal;
    if (page === maxPages - 1) {
      throw stableFailure(ORDER_REPORT_PAGE_LIMIT_EXCEEDED);
    }
  }

  throw stableFailure(ORDER_REPORT_PAGE_LIMIT_EXCEEDED);
}

function mapStatus(status: string | undefined): OrderAttributionRow['status'] {
  const normalized = (status ?? '').toLowerCase();
  return normalized === 'locked' ? 'locked' : normalized === 'returned' ? 'returned' : 'pending';
}

function safeClickToken(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

function finiteCents(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function assertOrderId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) {
    throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
  }
}

export async function persistOrderAttributionPage(
  orders: readonly ShopMyOrderInput[],
  gateway: OrderAttributionGateway,
): Promise<number> {
  if (orders.length === 0) return 0;
  for (const order of orders) assertOrderId(order.orderId);

  const candidateTokens = [
    ...new Set(
      orders
        .map((order) => safeClickToken(order.clickToken))
        .filter((token): token is string => token !== null),
    ),
  ].sort();
  const knownTokens = new Set<string>();
  for (const tokenBatch of chunks(candidateTokens, ORDER_ATTRIBUTION_LOOKUP_BATCH_SIZE)) {
    let resolved: readonly string[];
    try {
      resolved = await gateway.findKnownClickTokens(tokenBatch);
    } catch {
      throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
    }
    if (!Array.isArray(resolved)) throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
    const requested = new Set(tokenBatch);
    for (const token of resolved) {
      if (typeof token !== 'string' || !requested.has(token)) {
        throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
      }
      knownTokens.add(token);
    }
  }

  const rows = orders.map((order): OrderAttributionRow => {
    const candidate = safeClickToken(order.clickToken);
    return {
      external_order_id: order.orderId,
      click_token: candidate && knownTokens.has(candidate) ? candidate : null,
      order_amount_cents: finiteCents(order.orderAmountUSD),
      commission_cents: finiteCents(order.commissionAmountUSD),
      status: mapStatus(order.status),
      transaction_date: order.transactionDate ?? null,
      record_updated_at: order.recordUpdatedDate ?? null,
    };
  });

  try {
    await gateway.upsertOrderAttributions(rows);
  } catch {
    throw stableFailure(ORDER_ATTRIBUTION_PERSIST_FAILED);
  }
  return rows.length;
}
