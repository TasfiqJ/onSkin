import {
  boundedMap,
  checksumRows,
  createExportMemoryBudget,
  encodeJsonWithinByteLimit,
  EXPORT_CONSISTENCY,
  EXPORT_RETAINED_ITEM_OVERHEAD_BYTES,
  listStoragePathsVerified,
  paginateRows,
  type StorageListOptions,
} from './exportCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejectsReason(
  operation: () => Promise<unknown>,
  reason: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof Error, 'expected an Error rejection.');
    assert(
      error.message.includes(reason),
      `expected rejection containing ${reason}, received ${error.message}.`,
    );
    return;
  }
  throw new Error(`expected ${reason} rejection.`);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';

Deno.test('database export paginates and verifies more than 1,000 deterministic rows', async () => {
  const sourceRows = Array.from({ length: 1_205 }, (_, index) => ({
    id: `row-${String(index).padStart(4, '0')}`,
    nested: { z: index, a: index % 3 },
  }));
  const pageCalls: Array<{ offset: number; limit: number }> = [];

  const result = await paginateRows({
    source: 'routine_completions',
    scope: 'caller_rls',
    orderBy: ['id'],
    pageSize: 250,
    maxRows: 2_000,
    fetchCount: () => Promise.resolve(sourceRows.length),
    fetchPage: (offset, limit) => {
      pageCalls.push({ offset, limit });
      return Promise.resolve(sourceRows.slice(offset, offset + limit));
    },
  });

  assert(result.rows.length === 1_205, 'expected every row above the platform default cap.');
  assert(result.rows[1_204]?.id === 'row-1204', 'expected deterministic final-row ordering.');
  assert(
    pageCalls.some((call) => call.offset === 1_000),
    'expected a page request beyond 1,000 rows.',
  );
  assert(result.manifest.count_before === 1_205, 'expected exact pre-read count evidence.');
  assert(result.manifest.count_after === 1_205, 'expected exact post-read count evidence.');
  assert(result.manifest.count === 1_205, 'expected exported count evidence.');
  assert(result.manifest.complete === true, 'expected an explicitly complete source manifest.');
  assert(
    result.manifest.checksum === (await checksumRows(sourceRows)),
    'expected the manifest checksum to cover every ordered row.',
  );
});

Deno.test('database export fails closed when a response cap truncates a page', async () => {
  const rows = Array.from({ length: 1_205 }, (_, index) => ({ id: `row-${index}` }));

  await assertRejectsReason(
    () =>
      paginateRows({
        source: 'notification_log',
        scope: 'caller_rls',
        orderBy: ['id'],
        pageSize: 500,
        maxRows: 2_000,
        fetchCount: () => Promise.resolve(rows.length),
        // Simulates a lower PostgREST max-rows setting than the requested page.
        fetchPage: (offset) => Promise.resolve(rows.slice(offset, offset + 100)),
      }),
    'COUNT_MISMATCH',
  );
});

Deno.test('database export rejects cardinality changes and duplicate ordering keys', async () => {
  let countCall = 0;
  await assertRejectsReason(
    () =>
      paginateRows({
        source: 'consents',
        scope: 'caller_rls',
        orderBy: ['id'],
        pageSize: 100,
        maxRows: 1_000,
        fetchCount: () => Promise.resolve(countCall++ === 0 ? 2 : 3),
        fetchPage: (offset) => Promise.resolve(offset === 0 ? [{ id: 'a' }, { id: 'b' }] : []),
      }),
    'COUNT_MISMATCH',
  );

  await assertRejectsReason(
    () =>
      paginateRows({
        source: 'community_blocks',
        scope: 'caller_rls',
        orderBy: ['user_id', 'blocked_handle'],
        pageSize: 100,
        maxRows: 1_000,
        fetchCount: () => Promise.resolve(2),
        fetchPage: (offset) =>
          Promise.resolve(
            offset === 0
              ? [
                  { user_id: USER_ID, blocked_handle: 'same' },
                  { user_id: USER_ID, blocked_handle: 'same' },
                ]
              : [],
          ),
      }),
    'DUPLICATE_ORDER_KEY',
  );
});

Deno.test('canonical checksums do not depend on object property insertion order', async () => {
  const left = [{ id: 'a', nested: { z: 2, a: 1 } }];
  const right = [{ nested: { a: 1, z: 2 }, id: 'a' }];
  assert(
    (await checksumRows(left)) === (await checksumRows(right)),
    'expected canonical checksum.',
  );
});

type StorageEntry = { name: string; id: string | null };

class FakeStorageBucket {
  readonly paths: Set<string>;
  readonly listCalls: Array<{ prefix: string; options: StorageListOptions }> = [];
  mutateAtSecondRootPass = false;
  hardPageCap: number | null = null;
  private rootPasses = 0;

  constructor(paths: string[]) {
    this.paths = new Set(paths);
  }

  list(prefix: string, options: StorageListOptions) {
    this.listCalls.push({ prefix, options });
    if (prefix === USER_ID && options.offset === 0) {
      this.rootPasses += 1;
      if (this.mutateAtSecondRootPass && this.rootPasses === 2) {
        this.paths.add(`${USER_ID}/new-during-export.enc`);
      }
    }

    const childKinds = new Map<string, 'file' | 'folder'>();
    const prefixWithSlash = `${prefix}/`;
    for (const path of this.paths) {
      if (!path.startsWith(prefixWithSlash)) continue;
      const remainder = path.slice(prefixWithSlash.length);
      const [child, ...descendants] = remainder.split('/');
      if (!child) continue;
      childKinds.set(child, descendants.length > 0 ? 'folder' : 'file');
    }
    const entries: StorageEntry[] = [...childKinds]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, kind]) => ({
        name,
        id: kind === 'folder' ? null : `object:${prefix}/${name}`,
      }));
    const effectiveLimit = Math.min(options.limit, this.hardPageCap ?? options.limit);
    return Promise.resolve({
      data: entries.slice(options.offset, options.offset + effectiveLimit),
      error: null,
    });
  }
}

Deno.test('storage export verifies every path after the first 1,000', async () => {
  const paths = Array.from(
    { length: 1_205 },
    (_, index) => `${USER_ID}/photo-${String(index).padStart(4, '0')}.enc`,
  );
  const bucket = new FakeStorageBucket(paths);
  // Simulates Storage returning fewer rows than requested without an error.
  bucket.hardPageCap = 100;

  const result = await listStoragePathsVerified({
    userId: USER_ID,
    bucket,
    pageSize: 500,
    maxObjects: 2_000,
  });

  assert(result.paths.length === 1_205, 'expected every owned storage object.');
  assert(result.paths[1_204] === paths[1_204], 'expected stable path ordering.');
  assert(
    bucket.listCalls.filter(
      (call) =>
        call.prefix === USER_ID && call.options.offset === 1_000 && call.options.limit === 500,
    ).length === 2,
    'expected both verification passes to follow the effective cap beyond 1,000 objects.',
  );
  assert(result.manifest.count === 1_205, 'expected a storage source count.');
  assert(result.manifest.verification_passes === 2, 'expected two stable inventory passes.');
  assert(result.manifest.complete === true, 'expected explicit storage completeness evidence.');
});

Deno.test(
  'storage export fails closed when the inventory changes between verification passes',
  async () => {
    const bucket = new FakeStorageBucket([`${USER_ID}/existing.enc`]);
    bucket.mutateAtSecondRootPass = true;

    await assertRejectsReason(
      () =>
        listStoragePathsVerified({
          userId: USER_ID,
          bucket,
          pageSize: 100,
          maxObjects: 1_000,
        }),
      'UNSTABLE_INVENTORY',
    );
  },
);

Deno.test('bounded export concurrency preserves result order and respects the cap', async () => {
  let active = 0;
  let maximumActive = 0;
  const values = Array.from({ length: 20 }, (_, index) => index);

  const results = await boundedMap(values, 3, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return value * 2;
  });

  assert(maximumActive === 3, `expected concurrency 3, observed ${maximumActive}.`);
  assert(
    results.every((value, index) => value === index * 2),
    'expected stable output order.',
  );
});

Deno.test(
  'bounded export concurrency drains in-flight work and stops scheduling after failure',
  async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const starts: number[] = [];
    let settled = false;
    const outcome = boundedMap([0, 1, 2, 3], 2, async (value) => {
      starts.push(value);
      if (value === 0) await firstGate;
      if (value === 1) throw new Error('EXPECTED_WORKER_FAILURE');
      return value;
    }).finally(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(starts.includes(0) && starts.includes(1), 'expected both initial workers to start.');
    assert(!starts.includes(2), 'expected no new task after the first worker failure.');
    assert(!settled, 'expected the failed batch to wait for its in-flight sibling.');

    releaseFirst();
    await assertRejectsReason(() => outcome, 'EXPECTED_WORKER_FAILURE');
    assert(settled, 'expected the batch to settle after its in-flight sibling drained.');
  },
);

Deno.test('export consistency contract explicitly declines unsupported snapshot guarantees', () => {
  assert(
    EXPORT_CONSISTENCY.model === 'independent_count_guarded_reads',
    'expected independent source semantics.',
  );
  assert(
    EXPORT_CONSISTENCY.limitations.some((line) => line.includes('do not share')),
    'expected the lack of a shared transaction/snapshot to be explicit.',
  );
  assert(
    EXPORT_CONSISTENCY.limitations.some((line) => line.includes('delete and insert')),
    'expected the count-guard replacement limitation to be explicit.',
  );
});

Deno.test('export response byte limits use exact UTF-8 accounting', async () => {
  const payload = { message: 'calm skin é✨' };
  const exactBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  const encoded = encodeJsonWithinByteLimit(payload, exactBytes);

  assert(encoded.byteLength === exactBytes, 'expected the exact compact UTF-8 byte length.');
  assert(encoded.body === JSON.stringify(payload), 'expected one compact JSON representation.');
  await assertRejectsReason(
    () => Promise.resolve(encodeJsonWithinByteLimit(payload, exactBytes - 1)),
    'EXPORT_RESPONSE_BYTE_LIMIT_EXCEEDED',
  );
});

Deno.test('one shared memory budget bounds 34 individually valid sources', async () => {
  const sourceRows = Array.from({ length: 34 }, (_, sourceIndex) =>
    Array.from({ length: 25 }, (_, rowIndex) => ({
      id: `${String(sourceIndex).padStart(2, '0')}-${String(rowIndex).padStart(2, '0')}`,
      value: `fixture-${sourceIndex}-${rowIndex}`,
    })),
  );
  const exactRetainedBytes = sourceRows
    .flat()
    .reduce(
      (total, row) =>
        total +
        new TextEncoder().encode(JSON.stringify(row)).byteLength +
        EXPORT_RETAINED_ITEM_OVERHEAD_BYTES +
        1,
      0,
    );

  const run = (maxBytes: number) => {
    const memoryBudget = createExportMemoryBudget(maxBytes, 34 * 25);
    return boundedMap(sourceRows, 4, (rows, sourceIndex) =>
      paginateRows({
        source: `source_${sourceIndex}`,
        scope: 'caller_rls',
        orderBy: ['id'],
        pageSize: 10,
        maxRows: 100,
        memoryBudget,
        fetchCount: () => Promise.resolve(rows.length),
        fetchPage: (offset, limit) => Promise.resolve(rows.slice(offset, offset + limit)),
      }),
    ).then(() => memoryBudget.snapshot());
  };

  const exact = await run(exactRetainedBytes);
  assert(exact.retainedBytes === exactRetainedBytes, 'expected the exact aggregate byte claim.');
  assert(exact.retainedItems === 34 * 25, 'expected every retained row in the item claim.');
  await assertRejectsReason(() => run(exactRetainedBytes - 1), 'MEMORY_BUDGET_EXCEEDED');
});

Deno.test('an oversized row fails closed and rolls back its source reservation', async () => {
  const privatePayload = 'private-note-that-must-not-enter-the-error';
  const memoryBudget = createExportMemoryBudget(64, 10);
  let thrown: unknown;
  try {
    await paginateRows({
      source: 'photos',
      scope: 'caller_rls',
      orderBy: ['id'],
      pageSize: 10,
      maxRows: 10,
      memoryBudget,
      fetchCount: () => Promise.resolve(1),
      fetchPage: (offset) =>
        Promise.resolve(offset === 0 ? [{ id: 'photo-1', notes: privatePayload }] : []),
    });
  } catch (error) {
    thrown = error;
  }

  assert(thrown instanceof Error, 'expected the oversized source to reject.');
  assert(thrown.message.includes('MEMORY_BUDGET_EXCEEDED'), 'expected a stable budget code.');
  assert(!thrown.message.includes(privatePayload), 'expected no private content in the error.');
  assert(
    memoryBudget.snapshot().retainedBytes === 0,
    'expected the failed source to release bytes.',
  );
  assert(
    memoryBudget.snapshot().retainedItems === 0,
    'expected the failed source to release items.',
  );
});

Deno.test(
  'storage verification budgets both passes and releases the discarded inventory',
  async () => {
    const paths = [`${USER_ID}/a.enc`, `${USER_ID}/b.enc`];
    const memoryBudget = createExportMemoryBudget(1_000, 4);
    const result = await listStoragePathsVerified({
      userId: USER_ID,
      bucket: new FakeStorageBucket(paths),
      pageSize: 2,
      maxObjects: 10,
      memoryBudget,
    });
    const snapshot = memoryBudget.snapshot();

    assert(result.paths.length === 2, 'expected the verified storage inventory.');
    assert(snapshot.peakRetainedItems === 4, 'expected both verification passes to be bounded.');
    assert(snapshot.retainedItems === 2, 'expected only the returned inventory to remain claimed.');
  },
);

Deno.test('the aggregate item ceiling rejects tiny-row object overhead', async () => {
  const memoryBudget = createExportMemoryBudget(10_000, 1);
  memoryBudget.reserveJson('profiles', { id: 'a' });

  await assertRejectsReason(
    () => Promise.resolve(memoryBudget.reserveJson('profiles', { id: 'b' })),
    'MEMORY_BUDGET_EXCEEDED',
  );
  assert(
    memoryBudget.snapshot().retainedItems === 1,
    'expected the rejected item not to enter memory.',
  );
});
