import {
  HEALTH_SYNC_EXPORT_SOURCES,
  paginateHealthSyncSource,
  type HealthSyncExportCursor,
  type HealthSyncExportSource,
} from './healthSyncExportCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

function row(
  source: HealthSyncExportSource,
  index: number,
  total: number,
): Record<string, unknown> {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const shared = {
    export_total_count: total,
    user_id: USER_ID,
    created_at: `2026-07-26T00:00:${String(index).padStart(2, '0')}.000Z`,
  };
  if (source === 'shelf_product_identities') {
    return {
      ...shared,
      id,
      deleted_effective_at: null,
      deleted_received_at: null,
    };
  }
  if (source === 'shelf_sync_receipts') {
    return {
      ...shared,
      operation_id: id,
      state: 'accepted',
      result_code: null,
      finalized_at: `2026-07-26T00:01:${String(index).padStart(2, '0')}.000Z`,
    };
  }
  return {
    ...shared,
    event_id: id,
    state: 'terminal',
    result_code: 'COMPLETION_REQUEST_INVALID',
    finalized_at: `2026-07-26T00:01:${String(index).padStart(2, '0')}.000Z`,
  };
}

for (const source of Object.keys(HEALTH_SYNC_EXPORT_SOURCES) as HealthSyncExportSource[]) {
  Deno.test(
    `${source} RPC pagination is owner/count/keyset bound and exact-column projected`,
    async () => {
      const rows = [row(source, 1, 3), row(source, 2, 3), row(source, 3, 3)];
      const idColumn = HEALTH_SYNC_EXPORT_SOURCES[source].idColumn;
      const calls: Array<HealthSyncExportCursor | null> = [];
      const result = await paginateHealthSyncSource({
        source,
        expectedUserId: USER_ID,
        pageSize: 2,
        maxRows: 10,
        fetchPage: async (cursor, limit) => {
          calls.push(cursor);
          const start = cursor ? rows.findIndex((value) => value[idColumn] === cursor.id) + 1 : 0;
          return rows.slice(start, start + limit);
        },
      });

      assert(result.rows.length === 3, `${source} omitted an owned row.`);
      assert(
        result.manifest.count_before === 3 && result.manifest.count_after === 3,
        `${source} did not verify the exact count twice.`,
      );
      assert(result.manifest.page_requests === 4, `${source} did not run two keyset passes.`);
      assert(calls[1]?.id === rows[1]?.[idColumn], `${source} used the wrong next keyset.`);
      assert(calls[2] === null, `${source} did not restart its verification pass.`);
      assert(
        !Object.hasOwn(result.rows[0]!, 'export_total_count'),
        `${source} leaked count metadata.`,
      );
      assert(
        !Object.hasOwn(result.rows[0]!, 'request_sha256'),
        `${source} leaked internal request-fingerprint metadata.`,
      );
      assert(
        Object.keys(result.rows[0]!).every((column) =>
          (HEALTH_SYNC_EXPORT_SOURCES[source].columns as readonly string[]).includes(column),
        ),
        `${source} exceeded its reviewed column allowlist.`,
      );
    },
  );
}

Deno.test(
  'health-sync export rejects owner crossing and internal request fingerprints',
  async () => {
    for (const unsafe of [
      { ...row('shelf_sync_receipts', 1, 1), user_id: OTHER_USER_ID },
      { ...row('shelf_sync_receipts', 1, 1), request_sha256: 'a'.repeat(64) },
    ]) {
      await paginateHealthSyncSource({
        source: 'shelf_sync_receipts',
        expectedUserId: USER_ID,
        pageSize: 2,
        maxRows: 10,
        fetchPage: async () => [unsafe],
      }).then(
        () => {
          throw new Error('expected sealed health-sync export rejection.');
        },
        (error) => {
          assert(error instanceof Error, 'expected an Error rejection.');
          const expected =
            'user_id' in unsafe && unsafe.user_id === OTHER_USER_ID
              ? 'OWNER_MISMATCH'
              : 'UNEXPECTED_COLUMN';
          assert(
            error.message === `EXPORT_SOURCE_INCOMPLETE:shelf_sync_receipts:${expected}`,
            `unexpected rejection: ${error.message}`,
          );
        },
      );
    }
  },
);

Deno.test('health-sync export rejects missing fields and invalid cursor values', async () => {
  const missing = { ...row('routine_completion_sync_receipts', 1, 1) };
  delete missing.state;
  for (const [unsafe, expected] of [
    [missing, 'MISSING_COLUMN:state'],
    [
      { ...row('routine_completion_sync_receipts', 1, 1), created_at: '2026-07-26 00:00:01' },
      'INVALID_CURSOR',
    ],
    [
      { ...row('routine_completion_sync_receipts', 1, 1), event_id: 'not-a-uuid' },
      'INVALID_CURSOR',
    ],
  ] as const) {
    await paginateHealthSyncSource({
      source: 'routine_completion_sync_receipts',
      expectedUserId: USER_ID,
      pageSize: 2,
      maxRows: 10,
      fetchPage: async () => [unsafe],
    }).then(
      () => {
        throw new Error(`expected ${expected} rejection.`);
      },
      (error) => {
        assert(error instanceof Error, 'expected an Error rejection.');
        assert(
          error.message === `EXPORT_SOURCE_INCOMPLETE:routine_completion_sync_receipts:${expected}`,
          `unexpected rejection: ${error.message}`,
        );
      },
    );
  }
});

Deno.test(
  'health-sync export rejects count/content drift and verifies stable zero rows',
  async () => {
    let pass = 0;
    await paginateHealthSyncSource({
      source: 'shelf_product_identities',
      expectedUserId: USER_ID,
      pageSize: 2,
      maxRows: 10,
      fetchPage: async () => {
        pass += 1;
        return [
          {
            ...row('shelf_product_identities', 1, 1),
            deleted_effective_at: pass === 1 ? null : '2026-07-26T01:00:00.000Z',
            deleted_received_at: pass === 1 ? null : '2026-07-26T01:00:01.000Z',
          },
        ];
      },
    }).then(
      () => {
        throw new Error('expected unstable snapshot rejection.');
      },
      (error) => {
        assert(error instanceof Error, 'expected an Error rejection.');
        assert(
          error.message === 'EXPORT_SOURCE_INCOMPLETE:shelf_product_identities:UNSTABLE_SNAPSHOT',
          `unexpected rejection: ${error.message}`,
        );
      },
    );

    let zeroCalls = 0;
    const zero = await paginateHealthSyncSource({
      source: 'shelf_product_identities',
      expectedUserId: USER_ID,
      pageSize: 2,
      maxRows: 10,
      fetchPage: async () => {
        zeroCalls += 1;
        return [];
      },
    });
    assert(zeroCalls === 2, 'zero-row export did not run two verification passes.');
    assert(
      zero.rows.length === 0 && zero.manifest.count_before === 0 && zero.manifest.count_after === 0,
      'zero-row export manifest is not exact.',
    );
  },
);
