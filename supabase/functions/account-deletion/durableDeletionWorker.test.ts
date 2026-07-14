import {
  type AccountDeletionClaim,
  type AccountDeletionClaimMode,
  type AccountDeletionStepExecutor,
  type AccountDeletionStepName,
  type AccountDeletionWorkerGateway,
  DurableDeletionWorkerError,
  runAccountDeletionWorker,
} from './durableDeletionWorker.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${left} !== ${right}`);
}

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OPERATION_ID = '22222222-2222-4222-8222-222222222222';

function claim(
  stepName: AccountDeletionStepName,
  claimMode: AccountDeletionClaimMode,
): AccountDeletionClaim {
  return {
    operationId: OPERATION_ID,
    userId: USER_ID,
    operationState: 'running',
    stepName,
    stepStatus: 'leased',
    claimMode,
    claimToken: 'ab'.repeat(32),
    attemptCount: 1,
    requestStartedAt: claimMode === 'reconcile' ? '2026-07-13T12:00:00.000Z' : null,
    leaseExpiresAt: '2026-07-13T12:10:00.000Z',
    encryptedPayload: null,
  };
}

function executors(
  handler: AccountDeletionStepExecutor,
): Record<AccountDeletionStepName, AccountDeletionStepExecutor> {
  return {
    apple_revoke: handler,
    revenuecat_delete: handler,
    posthog_delete: handler,
    photo_storage_delete: handler,
    service_rows_scrub: handler,
    auth_user_delete: handler,
  };
}

Deno.test('worker alternates reconcile and dispatch, then finalizes and purges', async () => {
  const modes: AccountDeletionClaimMode[] = [];
  const executed: string[] = [];
  const queue: Record<AccountDeletionClaimMode, AccountDeletionClaim[]> = {
    reconcile: [claim('photo_storage_delete', 'reconcile')],
    dispatch: [claim('service_rows_scrub', 'dispatch')],
  };
  const gateway: AccountDeletionWorkerGateway = {
    claimNext(mode) {
      modes.push(mode);
      return Promise.resolve(queue[mode].shift() ?? null);
    },
    listReadyToFinalize(limit) {
      assert(limit === 10, 'bounded finalization batch');
      return Promise.resolve([{ operationId: OPERATION_ID, userId: USER_ID }]);
    },
    finalize(candidate) {
      executed.push(`finalize:${candidate.operationId}`);
      return Promise.resolve();
    },
    purgeExpiredArtifacts(limit) {
      assert(limit === 100, 'bounded maintenance batch');
      executed.push('purge');
      return Promise.resolve();
    },
  };
  const report = await runAccountDeletionWorker({
    gateway,
    executors: executors((current) => {
      executed.push(`${current.claimMode}:${current.stepName}`);
      return Promise.resolve();
    }),
    deadlineAtMs: 10_000,
    maxClaims: 10,
    finalizationBatchSize: 10,
    maintenanceBatchSize: 100,
    now: () => 1_000,
  });
  assertDeepEqual(modes, ['reconcile', 'dispatch', 'reconcile', 'dispatch']);
  assertDeepEqual(executed, [
    'reconcile:photo_storage_delete',
    'dispatch:service_rows_scrub',
    `finalize:${OPERATION_ID}`,
    'purge',
  ]);
  assertDeepEqual(report, {
    claimsProcessed: 2,
    executorFailures: 0,
    finalized: 1,
    finalizationFailures: 0,
    maintenanceFailed: false,
    deadlineReached: false,
  });
});

Deno.test('executor failure is contained and the other lane still progresses', async () => {
  const queues: Record<AccountDeletionClaimMode, AccountDeletionClaim[]> = {
    reconcile: [claim('auth_user_delete', 'reconcile')],
    dispatch: [claim('apple_revoke', 'dispatch')],
  };
  const processed: string[] = [];
  const report = await runAccountDeletionWorker({
    gateway: {
      claimNext(mode) {
        return Promise.resolve(queues[mode].shift() ?? null);
      },
      listReadyToFinalize() {
        return Promise.resolve([]);
      },
      finalize() {
        return Promise.resolve();
      },
      purgeExpiredArtifacts() {
        return Promise.resolve();
      },
    },
    executors: executors((current) => {
      processed.push(current.stepName);
      if (current.stepName === 'auth_user_delete') {
        return Promise.reject(new Error('secret provider body'));
      }
      return Promise.resolve();
    }),
    deadlineAtMs: 10_000,
    maxClaims: 10,
    finalizationBatchSize: 10,
    maintenanceBatchSize: 100,
    now: () => 1_000,
  });
  assertDeepEqual(processed, ['auth_user_delete', 'apple_revoke']);
  assert(report.executorFailures === 1, 'one generic failure counted');
});

Deno.test('deadline prevents new side effects, finalization, and maintenance', async () => {
  let called = false;
  const report = await runAccountDeletionWorker({
    gateway: {
      claimNext() {
        called = true;
        return Promise.resolve(null);
      },
      listReadyToFinalize() {
        called = true;
        return Promise.resolve([]);
      },
      finalize() {
        called = true;
        return Promise.resolve();
      },
      purgeExpiredArtifacts() {
        called = true;
        return Promise.resolve();
      },
    },
    executors: executors(() => {
      called = true;
      return Promise.resolve();
    }),
    deadlineAtMs: 1_000,
    maxClaims: 10,
    finalizationBatchSize: 10,
    maintenanceBatchSize: 100,
    now: () => 1_000,
  });
  assert(!called, 'no gateway action after deadline');
  assert(report.deadlineReached, 'deadline is reported');
});

Deno.test('finalization and maintenance failures remain isolated', async () => {
  let finalizations = 0;
  const report = await runAccountDeletionWorker({
    gateway: {
      claimNext() {
        return Promise.resolve(null);
      },
      listReadyToFinalize() {
        return Promise.resolve([
          { operationId: OPERATION_ID, userId: USER_ID },
          {
            operationId: '33333333-3333-4333-8333-333333333333',
            userId: USER_ID,
          },
        ]);
      },
      finalize() {
        finalizations += 1;
        return finalizations === 1
          ? Promise.reject(new Error('private detail'))
          : Promise.resolve();
      },
      purgeExpiredArtifacts() {
        return Promise.reject(new Error('private detail'));
      },
    },
    executors: executors(() => Promise.resolve()),
    deadlineAtMs: 10_000,
    maxClaims: 10,
    finalizationBatchSize: 10,
    maintenanceBatchSize: 100,
    now: () => 1_000,
  });
  assert(report.finalized === 1, 'second finalization succeeds');
  assert(report.finalizationFailures === 1, 'first failure counted');
  assert(report.maintenanceFailed, 'maintenance failure contained');
});

Deno.test('worker options reject missing executors and unsafe bounds', async () => {
  const gateway: AccountDeletionWorkerGateway = {
    claimNext() {
      return Promise.resolve(null);
    },
    listReadyToFinalize() {
      return Promise.resolve([]);
    },
    finalize() {
      return Promise.resolve();
    },
    purgeExpiredArtifacts() {
      return Promise.resolve();
    },
  };
  for (const overrides of [
    { maxClaims: 0 },
    { maxClaims: 101 },
    { finalizationBatchSize: 0 },
    { maintenanceBatchSize: 1_001 },
    {
      executors: {
        ...executors(() => Promise.resolve()),
        apple_revoke: undefined,
      },
    },
  ]) {
    try {
      await runAccountDeletionWorker({
        gateway,
        executors: executors(() => Promise.resolve()),
        deadlineAtMs: 10_000,
        maxClaims: 10,
        finalizationBatchSize: 10,
        maintenanceBatchSize: 100,
        now: () => 1_000,
        ...overrides,
      } as never);
      throw new Error('expected rejection');
    } catch (error) {
      assert(
        error instanceof DurableDeletionWorkerError &&
          error.code === 'DELETION_WORKER_INPUT_INVALID',
        'invalid worker options must fail closed',
      );
    }
  }
});
