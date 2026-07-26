import {
  CATALOG_CORRECTION_EXPORT_COLUMNS,
  paginateCatalogCorrections,
  type CatalogCorrectionExportCursor,
} from './catalogCorrectionExportCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function row(index: number, total: number): Record<string, unknown> {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return {
    export_total_count: total,
    id,
    user_id: '00000000-0000-4000-8000-000000000001',
    product_id: null,
    barcode: null,
    correction_type: 'other',
    status: 'open',
    description: `Report ${index}`,
    proposed_payload: {},
    client_context: {},
    source_id: null,
    created_at: `2026-07-22T00:00:${String(index).padStart(2, '0')}.000Z`,
    updated_at: `2026-07-22T00:00:${String(index).padStart(2, '0')}.000Z`,
  };
}

Deno.test(
  'catalog-correction RPC pagination is keyset-bound, count-guarded, and strips metadata',
  async () => {
    const source = [row(1, 3), row(2, 3), row(3, 3)];
    const calls: Array<CatalogCorrectionExportCursor | null> = [];
    const result = await paginateCatalogCorrections({
      expectedUserId: '00000000-0000-4000-8000-000000000001',
      pageSize: 2,
      maxRows: 10,
      fetchPage: async (cursor, limit) => {
        calls.push(cursor);
        const start = cursor ? source.findIndex((value) => value.id === cursor.id) + 1 : 0;
        return source.slice(start, start + limit);
      },
    });

    assert(result.rows.length === 3, 'all owned rows were not exported.');
    assert(result.manifest.count_before === 3, 'initial RPC count was not retained.');
    assert(result.manifest.count_after === 3, 'final RPC count was not rechecked.');
    assert(result.manifest.page_requests === 4, 'expected two complete keyset passes.');
    assert(calls[1]?.id === source[1]?.id, 'the next page did not use the last exact keyset.');
    assert(calls[2] === null, 'the verification pass must restart from the first owned row.');
    assert(calls[3]?.id === source[1]?.id, 'the verification pass lost its exact keyset.');
    assert(
      !Object.hasOwn(result.rows[0]!, 'export_total_count'),
      'internal count metadata leaked into the export.',
    );
    assert(
      Object.keys(result.rows[0]!).every((column) =>
        CATALOG_CORRECTION_EXPORT_COLUMNS.includes(
          column as (typeof CATALOG_CORRECTION_EXPORT_COLUMNS)[number],
        ),
      ),
      'the exported row exceeded the reviewed column allowlist.',
    );
  },
);

Deno.test(
  'catalog-correction RPC pagination fails closed when the owner count changes',
  async () => {
    let call = 0;
    await Promise.resolve(
      paginateCatalogCorrections({
        expectedUserId: '00000000-0000-4000-8000-000000000001',
        pageSize: 2,
        maxRows: 10,
        fetchPage: async (cursor) => {
          call += 1;
          if (cursor === null && call === 1) return [row(1, 2), row(2, 2)];
          if (cursor !== null) return [];
          return [row(1, 3)];
        },
      }).then(
        () => {
          throw new Error('expected count mismatch rejection.');
        },
        (error) => {
          assert(error instanceof Error, 'expected an Error rejection.');
          assert(
            error.message === 'EXPORT_SOURCE_INCOMPLETE:catalog_corrections:COUNT_MISMATCH',
            `unexpected rejection: ${error.message}`,
          );
        },
      ),
    );
  },
);

Deno.test('catalog-correction RPC pagination rejects unreviewed columns', async () => {
  const unsafe = { ...row(1, 1), operator_review_note: 'private' };
  await paginateCatalogCorrections({
    expectedUserId: '00000000-0000-4000-8000-000000000001',
    pageSize: 1,
    maxRows: 10,
    fetchPage: async () => [unsafe],
  }).then(
    () => {
      throw new Error('expected unexpected-column rejection.');
    },
    (error) => {
      assert(error instanceof Error, 'expected an Error rejection.');
      assert(
        error.message === 'EXPORT_SOURCE_INCOMPLETE:catalog_corrections:UNEXPECTED_COLUMN',
        `unexpected rejection: ${error.message}`,
      );
    },
  );
});

Deno.test('catalog-correction RPC pagination fails closed on a cross-owner row', async () => {
  const unsafe = {
    ...row(1, 1),
    user_id: '00000000-0000-4000-8000-000000000002',
  };
  await paginateCatalogCorrections({
    expectedUserId: '00000000-0000-4000-8000-000000000001',
    pageSize: 2,
    maxRows: 10,
    fetchPage: async () => [unsafe],
  }).then(
    () => {
      throw new Error('expected owner-mismatch rejection.');
    },
    (error) => {
      assert(error instanceof Error, 'expected an Error rejection.');
      assert(
        error.message === 'EXPORT_SOURCE_INCOMPLETE:catalog_corrections:OWNER_MISMATCH',
        `unexpected rejection: ${error.message}`,
      );
    },
  );
});

Deno.test('catalog-correction RPC pagination rejects non-monotonic unique rows', async () => {
  await paginateCatalogCorrections({
    expectedUserId: '00000000-0000-4000-8000-000000000001',
    pageSize: 2,
    maxRows: 10,
    fetchPage: async () => [row(2, 2), row(1, 2)],
  }).then(
    () => {
      throw new Error('expected non-monotonic rejection.');
    },
    (error) => {
      assert(error instanceof Error, 'expected an Error rejection.');
      assert(
        error.message === 'EXPORT_SOURCE_INCOMPLETE:catalog_corrections:NON_MONOTONIC_ORDER',
        `unexpected rejection: ${error.message}`,
      );
    },
  );
});

Deno.test('catalog-correction RPC pagination rejects same-count content drift', async () => {
  let pass = 0;
  await paginateCatalogCorrections({
    expectedUserId: '00000000-0000-4000-8000-000000000001',
    pageSize: 2,
    maxRows: 10,
    fetchPage: async () => {
      pass += 1;
      return [{ ...row(1, 1), status: pass === 1 ? 'open' : 'triaged' }];
    },
  }).then(
    () => {
      throw new Error('expected unstable-snapshot rejection.');
    },
    (error) => {
      assert(error instanceof Error, 'expected an Error rejection.');
      assert(
        error.message === 'EXPORT_SOURCE_INCOMPLETE:catalog_corrections:UNSTABLE_SNAPSHOT',
        `unexpected rejection: ${error.message}`,
      );
    },
  );
});

Deno.test('catalog-correction RPC pagination verifies a stable zero-row export twice', async () => {
  let calls = 0;
  const result = await paginateCatalogCorrections({
    expectedUserId: '00000000-0000-4000-8000-000000000001',
    pageSize: 2,
    maxRows: 10,
    fetchPage: async () => {
      calls += 1;
      return [];
    },
  });
  assert(calls === 2, 'zero-row export did not run two complete verification passes.');
  assert(result.rows.length === 0, 'zero-row export returned data.');
  assert(
    result.manifest.count_before === 0 && result.manifest.count_after === 0,
    'zero-row export manifest counts are incorrect.',
  );
});

Deno.test(
  'catalog-correction RPC pagination rejects missing fields and invalid cursors',
  async () => {
    const missing = { ...row(1, 1) };
    delete missing.description;
    for (const [unsafe, expected] of [
      [missing, 'MISSING_COLUMN:description'],
      [{ ...row(1, 1), created_at: '2026-07-22 00:00:01' }, 'INVALID_CURSOR'],
      [{ ...row(1, 1), id: 'not-a-uuid' }, 'INVALID_CURSOR'],
    ] as const) {
      await paginateCatalogCorrections({
        expectedUserId: '00000000-0000-4000-8000-000000000001',
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
            error.message === `EXPORT_SOURCE_INCOMPLETE:catalog_corrections:${expected}`,
            `unexpected rejection: ${error.message}`,
          );
        },
      );
    }
  },
);
