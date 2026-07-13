import {
  ORDER_ATTRIBUTION_LOOKUP_BATCH_SIZE,
  ORDER_ATTRIBUTION_PERSIST_FAILED,
  ORDER_REPORT_MAX_PAGES,
  ORDER_REPORT_PAGE_LIMIT_EXCEEDED,
  ORDER_REPORT_PAGE_SIZE,
  ORDER_REPORT_UPSTREAM_FAILED,
  adaptShopMyOrderReportItem,
  normalizeShopMyBrandDomain,
  type OrderAttributionGateway,
  type OrderAttributionRow,
  type OrderReportPageRequest,
  orderReportFailure,
  persistOrderAttributionPage,
  pollOrderReportPages,
  type ShopMyOrderInput,
} from './orderAttributionCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class Gateway implements OrderAttributionGateway {
  readonly lookups: string[][] = [];
  readonly writes: OrderAttributionRow[][] = [];
  readonly known = new Set<string>();
  failLookup = false;
  failWrite = false;

  async findKnownClickTokens(tokens: readonly string[]): Promise<readonly string[]> {
    this.lookups.push([...tokens]);
    if (this.failLookup) throw new Error('raw lookup failure');
    return tokens.filter((token) => this.known.has(token));
  }

  async upsertOrderAttributions(rows: readonly OrderAttributionRow[]): Promise<void> {
    if (this.failWrite) throw new Error('raw write failure');
    this.writes.push(structuredClone([...rows]));
  }
}

type PollResponse = { ok: boolean; payload: unknown };

class PollGateway {
  readonly requests: OrderReportPageRequest[] = [];
  readonly writes: ShopMyOrderInput[][] = [];
  readonly responses: PollResponse[] = [];
  fetchError: unknown = null;
  readError: unknown = null;
  persistError: unknown = null;

  async fetchPage(request: OrderReportPageRequest): Promise<PollResponse> {
    this.requests.push(structuredClone(request));
    if (this.fetchError) throw this.fetchError;
    return this.responses.shift() ?? { ok: true, payload: [] };
  }

  async readJson(response: PollResponse): Promise<unknown> {
    if (this.readError) throw this.readError;
    return response.payload;
  }

  async persistPage(orders: readonly ShopMyOrderInput[]): Promise<number> {
    if (this.persistError) throw this.persistError;
    this.writes.push(structuredClone([...orders]));
    return orders.length;
  }
}

function order(index: number, clickToken?: string): ShopMyOrderInput {
  return {
    orderId: `order-${index}`,
    clickToken,
    orderAmountUSD: 12.345,
    commissionAmountUSD: 1.234,
    status: 'LOCKED',
  };
}

function wireOrder(index: number) {
  return {
    'Order ID': `order-${index}`,
    'Transaction Date': '2026-07-12T12:00:00Z',
    'Record Updated Date': '2026-07-13T12:00:00Z',
    'Click Date': '2026-07-11T12:00:00Z',
    'Order Amount USD': '12.34',
    'Commission Amount USD': '1.23',
    'Creator Name': 'Fixture Creator',
    'Creator ShopMy': 'https://shopmy.us/fixture',
    Domain: 'example.com',
    Code: 'FIXTURE',
    Currency: 'USD',
    'Click-Order Delta (Hours)': '24',
    SKU: 'fixture-sku',
    'Customer Status': 'New',
    'Ship-to Country': 'US',
    'Gross Sales': '12.34',
    'Number of Items': '1',
  };
}

async function expectStableFailure(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected Error');
    assert(error.message === 'ORDER_ATTRIBUTION_PERSIST_FAILED', 'failure was not stable');
    return;
  }
  throw new Error('expected operation to fail');
}

async function expectFailureCode(operation: () => Promise<unknown>, code: string): Promise<Error> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected Error');
    assert(error.message === code, `expected ${code}, got ${error.message}`);
    return error;
  }
  throw new Error(`expected ${code}`);
}

function pollOptions(overrides: { pageSize?: number; maxPages?: number } = {}) {
  return {
    recordUpdatedStartDate: '2026-06-13 00:00:00',
    recordUpdatedEndDate: '2026-07-13 00:00:00',
    ...overrides,
  };
}

Deno.test('ShopMy brand domain accepts only a bare registered-style hostname', () => {
  assert(
    normalizeShopMyBrandDomain('  Brand.Example.COM  ') === 'brand.example.com',
    'valid hostname was not normalized',
  );
  for (const invalid of [
    undefined,
    '',
    'localhost',
    'https://brand.example.com',
    'brand.example.com/path',
    'brand.example.com:443',
    'user@brand.example.com',
    '.brand.example.com',
  ]) {
    assert(normalizeShopMyBrandDomain(invalid) === '', `accepted invalid domain: ${invalid}`);
  }
});

Deno.test(
  'official ShopMy wire fixture adapts exact display keys without inventing attribution',
  async () => {
    const adapted = adaptShopMyOrderReportItem(wireOrder(7));
    assert(adapted.orderId === 'order-7', 'official Order ID was not adapted');
    assert(adapted.orderAmountUSD === 12.34, 'official order amount was not adapted');
    assert(adapted.commissionAmountUSD === 1.23, 'official commission amount was not adapted');
    assert(
      adapted.transactionDate === '2026-07-12T12:00:00Z' &&
        adapted.recordUpdatedDate === '2026-07-13T12:00:00Z',
      'official timestamps were not adapted',
    );
    assert(
      adapted.clickToken === undefined && !Object.hasOwn(adapted, 'clickToken'),
      'undocumented ShopMy click attribution was invented',
    );

    const gateway = new Gateway();
    await persistOrderAttributionPage([adapted], gateway);
    assert(gateway.lookups.length === 0, 'wire item triggered an invented click-token lookup');
    assert(
      gateway.writes[0]?.[0]?.click_token === null,
      'wire item did not persist a null click token',
    );
    assert(
      gateway.writes[0]?.[0]?.status === 'pending',
      'undocumented provider status was invented',
    );
  },
);

Deno.test(
  'order report polling starts at page zero and accepts a terminal short page',
  async () => {
    const gateway = new PollGateway();
    gateway.responses.push({ ok: true, payload: [wireOrder(1)] });

    const count = await pollOrderReportPages(pollOptions({ pageSize: 2 }), gateway);

    assert(count === 1, 'short page count mismatch');
    assert(gateway.requests.length === 1, 'short terminal page made another request');
    assert(gateway.requests[0]?.page === 0, 'poll did not start at zero-indexed page 0');
    assert(gateway.requests[0]?.limit === 2, 'poll did not send the configured limit');
    assert(
      gateway.requests[0]?.recordUpdatedStartDate === '2026-06-13 00:00:00' &&
        gateway.requests[0]?.recordUpdatedEndDate === '2026-07-13 00:00:00',
      'poll changed the fixed reconciliation window',
    );
  },
);

Deno.test('order report polling stops on an empty page after a full page', async () => {
  const gateway = new PollGateway();
  gateway.responses.push(
    { ok: true, payload: [wireOrder(1), wireOrder(2)] },
    { ok: true, payload: [] },
  );

  const count = await pollOrderReportPages(pollOptions({ pageSize: 2 }), gateway);

  assert(count === 2, 'full plus empty page count mismatch');
  assert(
    JSON.stringify(gateway.requests.map((request) => request.page)) === JSON.stringify([0, 1]),
    'poll did not request exactly pages 0 and 1',
  );
  assert(gateway.writes.length === 1, 'empty page was persisted');
});

Deno.test('order report upstream failures map to a stable non-2xx response contract', async () => {
  const cases: Array<{ label: string; configure: (gateway: PollGateway) => void }> = [
    {
      label: 'fetch timeout',
      configure: (gateway) => {
        gateway.fetchError = new Error('AbortError with provider details');
      },
    },
    {
      label: 'non-2xx response',
      configure: (gateway) => {
        gateway.responses.push({ ok: false, payload: [] });
      },
    },
    {
      label: 'oversize response null',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: null });
      },
    },
    {
      label: 'malformed JSON null',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: null });
      },
    },
    {
      label: 'response body read failure',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: [] });
        gateway.readError = new Error('raw stream failure');
      },
    },
    {
      label: 'malformed legacy object envelope',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: { orders: [] } });
      },
    },
    {
      label: 'malformed object response',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: {} });
      },
    },
    {
      label: 'non-array orders',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: { orders: {} } });
      },
    },
    {
      label: 'malformed order item',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: [null] });
      },
    },
    {
      label: 'guessed camelCase order item',
      configure: (gateway) => {
        gateway.responses.push({ ok: true, payload: [order(1)] });
      },
    },
    {
      label: 'provider returned more than requested limit',
      configure: (gateway) => {
        gateway.responses.push({
          ok: true,
          payload: [wireOrder(1), wireOrder(2), wireOrder(3)],
        });
      },
    },
  ];

  for (const testCase of cases) {
    const gateway = new PollGateway();
    testCase.configure(gateway);
    const failure = await expectFailureCode(
      () => pollOrderReportPages(pollOptions({ pageSize: 2 }), gateway),
      ORDER_REPORT_UPSTREAM_FAILED,
    );
    const response = orderReportFailure(failure);
    assert(response.status === 502, `${testCase.label}: expected HTTP 502 mapping`);
    assert(
      response.publicCode === 'order_report_upstream_failed',
      `${testCase.label}: unstable public failure code`,
    );
    assert(gateway.writes.length === 0, `${testCase.label}: malformed page was persisted`);
  }
});

Deno.test('order report persistence failures map to a stable 503 contract', async () => {
  const gateway = new PollGateway();
  gateway.responses.push({ ok: true, payload: [wireOrder(1)] });
  gateway.persistError = new Error('raw database details');

  const failure = await expectFailureCode(
    () => pollOrderReportPages(pollOptions({ pageSize: 2 }), gateway),
    ORDER_ATTRIBUTION_PERSIST_FAILED,
  );
  const response = orderReportFailure(failure);
  assert(response.status === 503, 'persistence failure must return HTTP 503');
  assert(
    response.publicCode === 'order_attribution_persist_failed',
    'persistence failure public code was not stable',
  );
});

Deno.test('order report polling fails instead of hiding max-page truncation', async () => {
  const gateway = new PollGateway();
  gateway.responses.push(
    { ok: true, payload: [wireOrder(1), wireOrder(2)] },
    { ok: true, payload: [wireOrder(3), wireOrder(4)] },
    { ok: true, payload: [wireOrder(5), wireOrder(6)] },
  );

  const failure = await expectFailureCode(
    () => pollOrderReportPages(pollOptions({ pageSize: 2, maxPages: 3 }), gateway),
    ORDER_REPORT_PAGE_LIMIT_EXCEEDED,
  );
  const response = orderReportFailure(failure);
  assert(response.status === 502, 'page-limit truncation must be non-2xx');
  assert(
    response.publicCode === 'order_report_page_limit_exceeded',
    'page-limit truncation public code mismatch',
  );
  assert(
    JSON.stringify(gateway.requests.map((request) => request.page)) === JSON.stringify([0, 1, 2]),
    'page-limit detection requested outside the bounded page budget',
  );
  assert(gateway.writes.length === 3, 'complete fetched pages were not persisted idempotently');
  assert(
    ORDER_REPORT_PAGE_SIZE === 500 && ORDER_REPORT_MAX_PAGES === 200,
    'production ShopMy page/request limits changed',
  );
});

Deno.test('order attribution keeps only exact known click tokens', async () => {
  const gateway = new Gateway();
  gateway.known.add('known_token');
  const count = await persistOrderAttributionPage(
    [order(1, 'known_token'), order(2, 'unknown_token'), order(3, 'bad token'), order(4)],
    gateway,
  );
  assert(count === 4, 'successful count mismatch');
  assert(gateway.writes.length === 1, 'expected one upsert');
  const rows = gateway.writes[0]!;
  assert(rows[0]?.click_token === 'known_token', 'known token was detached');
  assert(
    rows.slice(1).every((row) => row.click_token === null),
    'unknown token was retained',
  );
  assert(rows[0]?.order_amount_cents === 1235, 'order cents were not normalized');
  assert(rows[0]?.commission_cents === 123, 'commission cents were not normalized');
  assert(rows[0]?.status === 'locked', 'status was not normalized');
});

Deno.test('order attribution lookup batches never exceed 500 tokens', async () => {
  const gateway = new Gateway();
  const orders = Array.from({ length: 1_201 }, (_, index) => order(index, `token_${index}`));
  await persistOrderAttributionPage(orders, gateway);
  assert(gateway.lookups.length === 3, 'lookup was not batched');
  assert(
    gateway.lookups.every((batch) => batch.length <= ORDER_ATTRIBUTION_LOOKUP_BATCH_SIZE),
    'lookup exceeded batch limit',
  );
});

Deno.test('order attribution lookup failure prevents any write', async () => {
  const gateway = new Gateway();
  gateway.failLookup = true;
  await expectStableFailure(() => persistOrderAttributionPage([order(1, 'token_1')], gateway));
  assert(gateway.writes.length === 0, 'lookup failure still wrote rows');
});

Deno.test('order attribution write failure is stable and never returns a count', async () => {
  const gateway = new Gateway();
  gateway.failWrite = true;
  await expectStableFailure(() => persistOrderAttributionPage([order(1)], gateway));
});

Deno.test(
  'order attribution rejects an invalid external order id before lookup or write',
  async () => {
    const gateway = new Gateway();
    await expectStableFailure(() =>
      persistOrderAttributionPage([{ ...order(1), orderId: '' }], gateway),
    );
    assert(
      gateway.lookups.length === 0 && gateway.writes.length === 0,
      'invalid id reached gateway',
    );
  },
);
