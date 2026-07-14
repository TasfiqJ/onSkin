import {
  executePhotoStorageDeletionStep,
  type PhotoStorageDeletionExecutorDependencies,
} from './photoStorageDeletionExecutor.ts';
import {
  executeServiceRowsDeletionStep,
  type ServiceRowsDeletionExecutorDependencies,
} from './serviceRowsDeletionExecutor.ts';
import type { AccountDeletionClaim } from './durableDeletionWorker.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function claim(
  stepName: 'photo_storage_delete' | 'service_rows_scrub',
  mode: 'dispatch' | 'reconcile' = 'dispatch',
): AccountDeletionClaim {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    operationState: 'running',
    stepName,
    stepStatus: 'leased',
    claimMode: mode,
    claimToken: 'ab'.repeat(32),
    attemptCount: 1,
    requestStartedAt: mode === 'reconcile' ? '2026-07-13T12:00:00.000Z' : null,
    leaseExpiresAt: '2026-07-13T12:10:00.000Z',
    encryptedPayload: null,
  };
}

function photoHarness(counts: number[], names = ['legacy/object.jpg']) {
  const calls: string[] = [];
  const records: unknown[][] = [];
  const dependencies: PhotoStorageDeletionExecutorDependencies = {
    countOwnedObjects() {
      calls.push('count');
      const value = counts.shift();
      if (value === undefined) throw new Error('missing test count');
      return Promise.resolve(value);
    },
    listOwnedObjectNames(_userId, limit) {
      calls.push(`list:${limit}`);
      return Promise.resolve(names);
    },
    removeObjectNames(paths) {
      calls.push(`remove:${paths.join(',')}`);
      return Promise.resolve();
    },
    markRequestStarted() {
      calls.push('started');
      return Promise.resolve();
    },
    record(_claim, outcome, code, retryAt) {
      calls.push('record');
      records.push([outcome, code, retryAt]);
      return Promise.resolve();
    },
    now: () => Date.parse('2026-07-13T12:00:00.000Z'),
  };
  return { calls, records, dependencies };
}

Deno.test('Storage exact zero succeeds without a fake deletion request', async () => {
  const h = photoHarness([0]);
  await executePhotoStorageDeletionStep(
    claim('photo_storage_delete'),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(JSON.stringify(h.calls) === JSON.stringify(['count', 'record']), 'read-only path');
  assert(h.records[0]?.[1] === 'PHOTO_STORAGE_ALREADY_ABSENT', 'exact evidence');
});

Deno.test('Storage uses the attested worklist and re-counts after removal', async () => {
  const h = photoHarness([1, 0]);
  await executePhotoStorageDeletionStep(
    claim('photo_storage_delete'),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(
    JSON.stringify(h.calls) ===
      JSON.stringify([
        'count',
        'list:100',
        'started',
        'remove:legacy/object.jpg',
        'count',
        'record',
      ]),
    'safe ordering',
  );
  assert(h.records[0]?.[1] === 'PHOTO_STORAGE_DELETE_ATTESTED', 'terminal count zero');
});

Deno.test('Storage dispatch loss becomes ambiguous and reconcile remains retryable', async () => {
  for (const mode of ['dispatch', 'reconcile'] as const) {
    const h = photoHarness([1]);
    h.dependencies.removeObjectNames = () => Promise.reject(new Error('private'));
    await executePhotoStorageDeletionStep(
      claim('photo_storage_delete', mode),
      { deadlineAtMs: h.dependencies.now() + 10_000 },
      h.dependencies,
    );
    assert(
      h.records[0]?.[0] === (mode === 'dispatch' ? 'ambiguous' : 'retryable'),
      'side-effect-aware retry',
    );
  }
});

Deno.test('Storage inconsistent positive count and empty worklist requires action', async () => {
  const h = photoHarness([1], []);
  await executePhotoStorageDeletionStep(
    claim('photo_storage_delete'),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(h.records[0]?.[0] === 'action_required', 'cannot silently complete');
  assert(!h.calls.includes('started'), 'no mutation attempted');
});

Deno.test('Service scrub attests atomic success without a fake network marker', async () => {
  const calls: string[] = [];
  const records: unknown[][] = [];
  const dependencies: ServiceRowsDeletionExecutorDependencies = {
    scrub(userId) {
      calls.push(`scrub:${userId}`);
      return Promise.resolve();
    },
    record(_claim, outcome, code, retryAt) {
      calls.push('record');
      records.push([outcome, code, retryAt]);
      return Promise.resolve();
    },
    now: () => Date.parse('2026-07-13T12:00:00.000Z'),
  };
  const c = claim('service_rows_scrub');
  await executeServiceRowsDeletionStep(
    c,
    { deadlineAtMs: dependencies.now() + 10_000 },
    dependencies,
  );
  assert(calls[0] === `scrub:${c.userId}`, 'atomic RPC first');
  assert(records[0]?.[1] === 'SERVICE_ROWS_SCRUBBED', 'scrub attested');
});

Deno.test('Service scrub failure schedules an idempotent retry', async () => {
  const records: unknown[][] = [];
  const dependencies: ServiceRowsDeletionExecutorDependencies = {
    scrub: () => Promise.reject(new Error('private')),
    record(_claim, outcome, code, retryAt) {
      records.push([outcome, code, retryAt]);
      return Promise.resolve();
    },
    now: () => Date.parse('2026-07-13T12:00:00.000Z'),
  };
  await executeServiceRowsDeletionStep(
    claim('service_rows_scrub'),
    { deadlineAtMs: dependencies.now() + 10_000 },
    dependencies,
  );
  assert(records[0]?.[0] === 'retryable', 'safe retry');
  assert(typeof records[0]?.[2] === 'string', 'retry scheduled');
});
