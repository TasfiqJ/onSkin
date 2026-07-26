import {
  boundedMap,
  checksumRows,
  EXPORT_CONSISTENCY,
  healthLifecycleExportDecision,
  healthReadEpochForExport,
  listStoragePathsVerified,
  paginateRows,
  type StorageListOptions,
} from './exportCore.ts';
import type { HealthLifecycleExportSnapshot } from '../consent-withdrawal/healthLifecycleCore.ts';

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

function healthLifecycle(
  overrides: Partial<HealthLifecycleExportSnapshot> = {},
): HealthLifecycleExportSnapshot {
  return {
    state: 'active',
    processing_epoch: 3,
    operation_state: null,
    result_code: null,
    consent_version: 'draft-v1-2026-07-10',
    consent_text_hash: 'a'.repeat(64),
    server_verified_at: '2026-07-15T12:00:00.000Z',
    ...overrides,
  };
}

Deno.test('export is blocked while health withdrawal is nonterminal', () => {
  const decision = healthLifecycleExportDecision(
    healthLifecycle(),
    healthLifecycle({
      state: 'withdrawing',
      operation_state: 'storage_pending',
      result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
    }),
  );
  assert(!decision.allowed, 'nonterminal withdrawal must block a partial export');
  assert(
    decision.error === 'HEALTH_DATA_WITHDRAWAL_IN_PROGRESS' && decision.retryAfterSeconds > 0,
    'blocked export must return a stable retry contract',
  );
});

Deno.test('export requires one stable terminal or active health lifecycle snapshot', () => {
  const stable = healthLifecycleExportDecision(
    healthLifecycle(),
    healthLifecycle({ server_verified_at: '2026-07-15T12:01:00.000Z' }),
  );
  assert(stable.allowed, 'server verification timestamp can advance between guarded reads');
  if (stable.allowed) {
    assert(
      stable.snapshot.server_verified_at === '2026-07-15T12:01:00.000Z',
      'export should include the final sanitized verification time',
    );
  }

  const changed = healthLifecycleExportDecision(
    healthLifecycle({ state: 'unconsented', processing_epoch: 0 }),
    healthLifecycle({ state: 'active', processing_epoch: 1 }),
  );
  assert(
    !changed.allowed && changed.error === 'HEALTH_DATA_LIFECYCLE_CHANGED',
    'a lifecycle transition during collection must retry instead of mixing snapshots',
  );
});

Deno.test('export pins active health reads and gives terminal empty reads a valid header', () => {
  assert(
    healthReadEpochForExport(healthLifecycle({ processing_epoch: 7 })) === 7,
    'active export did not retain the exact health epoch.',
  );
  assert(
    healthReadEpochForExport(healthLifecycle({ state: 'unconsented', processing_epoch: 0 })) === 1,
    'never-active export did not receive a syntactically valid deny-by-policy epoch.',
  );
  assert(
    healthReadEpochForExport(healthLifecycle({ state: 'withdrawn', processing_epoch: 8 })) === 8,
    'terminal export did not retain its lifecycle epoch.',
  );

  for (const unsafe of [
    healthLifecycle({ processing_epoch: -1 }),
    healthLifecycle({ state: 'active', processing_epoch: 0 }),
    healthLifecycle({ processing_epoch: Number.NaN }),
  ]) {
    try {
      healthReadEpochForExport(unsafe);
      throw new Error('expected invalid health export epoch rejection.');
    } catch (error) {
      assert(error instanceof Error, 'expected an Error rejection.');
      assert(
        error.message === 'EXPORT_HEALTH_PROCESSING_EPOCH_INVALID',
        `unexpected rejection: ${error.message}`,
      );
    }
  }
});

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

Deno.test('storage export fails closed at the configured traversal depth', async () => {
  const bucket = new FakeStorageBucket([`${USER_ID}/level-one/level-two/too-deep.enc`]);
  await assertRejectsReason(
    () =>
      listStoragePathsVerified({
        userId: USER_ID,
        bucket,
        pageSize: 100,
        maxObjects: 1_000,
        maxDepth: 2,
      }),
    'PATH_DEPTH_LIMIT_EXCEEDED',
  );
});

Deno.test('storage export fails closed at the configured prefix bound', async () => {
  const bucket = new FakeStorageBucket([
    `${USER_ID}/folder-a/photo.enc`,
    `${USER_ID}/folder-b/photo.enc`,
  ]);
  await assertRejectsReason(
    () =>
      listStoragePathsVerified({
        userId: USER_ID,
        bucket,
        pageSize: 100,
        maxObjects: 1_000,
        maxPrefixes: 2,
      }),
    'PREFIX_LIMIT_EXCEEDED',
  );
});

Deno.test('storage export fails closed before exceeding the page-request bound', async () => {
  const bucket = new FakeStorageBucket([`${USER_ID}/photo.enc`]);
  bucket.hardPageCap = 1;
  await assertRejectsReason(
    () =>
      listStoragePathsVerified({
        userId: USER_ID,
        bucket,
        pageSize: 100,
        maxObjects: 1_000,
        maxPageRequests: 1,
      }),
    'PAGE_REQUEST_LIMIT_EXCEEDED',
  );
  assert(bucket.listCalls.length === 1, 'the hard request cap must be prospective');
});

Deno.test('storage page-request bound covers both verification passes in total', async () => {
  const bucket = new FakeStorageBucket([`${USER_ID}/photo.enc`]);
  await assertRejectsReason(
    () =>
      listStoragePathsVerified({
        userId: USER_ID,
        bucket,
        pageSize: 100,
        maxObjects: 1_000,
        maxPageRequests: 3,
      }),
    'PAGE_REQUEST_LIMIT_EXCEEDED',
  );
  assert(
    bucket.listCalls.length === 3,
    'two-pass verification must share one prospective request budget',
  );
});

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
