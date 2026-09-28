import {
  type HealthConsentWorkerDependencies,
  HealthConsentWorkerError,
  runHealthConsentWorker,
} from './workerCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

async function assertRejectsCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof HealthConsentWorkerError, 'expected HealthConsentWorkerError');
    assertEquals(error.code, code, 'worker error code');
    return;
  }
  throw new Error(`expected ${code}`);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000002';
const CLAIM_TOKEN = 'a'.repeat(64);

function claimRow() {
  return { operation_id: OPERATION_ID, user_id: USER_ID, epoch: 3 };
}

function completedRow() {
  return [
    {
      user_id: USER_ID,
      state: 'withdrawn',
      epoch: 3,
      operation_id: OPERATION_ID,
      operation_state: 'completed',
      result_code: 'HEALTH_WITHDRAWAL_COMPLETED',
      server_verified_at: '2026-07-15T12:00:00.000Z',
      consent_version: null,
      consent_text_hash: null,
    },
  ];
}

function harness(overrides: Partial<HealthConsentWorkerDependencies> = {}) {
  const calls: string[] = [];
  const dependencies: HealthConsentWorkerDependencies = {
    claim: async () => {
      calls.push('claim');
      return { data: [claimRow()], error: null };
    },
    prepare: async () => {
      calls.push('prepare');
      return {
        data: [
          {
            operation_state: 'running',
            result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
            pending_storage_objects: 0,
          },
        ],
        error: null,
      };
    },
    listStorage: async () => {
      calls.push('list');
      return { data: [], error: null };
    },
    removeStorage: async () => {
      calls.push('remove');
      return { error: null };
    },
    complete: async () => {
      calls.push('complete');
      return { data: completedRow(), error: null };
    },
    defer: async (operationId, _claimToken, resultCode) => {
      calls.push(`defer:${resultCode}`);
      return {
        data: [
          {
            operation_id: operationId,
            operation_state: 'storage_pending',
            result_code: resultCode,
            next_attempt_at: '2026-07-15T12:01:00.000Z',
          },
        ],
        error: null,
      };
    },
    ...overrides,
  };
  return { calls, dependencies };
}

function run(
  dependencies: HealthConsentWorkerDependencies,
  overrides: Partial<Parameters<typeof runHealthConsentWorker>[0]> = {},
) {
  return runHealthConsentWorker({
    claimToken: CLAIM_TOKEN,
    claimLimit: 10,
    storageBatchSize: 100,
    maxStorageBatches: 5,
    retryAfterSeconds: 60,
    actionRequiredRetryAfterSeconds: 86_400,
    deadlineAtMs: 50_000,
    now: () => 1_000,
    dependencies,
    ...overrides,
  });
}

Deno.test(
  'worker claims due operations and completes only after exact Storage absence',
  async () => {
    const { calls, dependencies } = harness();
    const report = await run(dependencies);
    assertEquals(calls, ['claim', 'prepare', 'list', 'complete'], 'worker call order');
    assertEquals(
      report,
      {
        claimed: 1,
        completed: 1,
        deferred: 0,
        actionRequired: 0,
        deadlineReached: false,
      },
      'worker report',
    );
  },
);

Deno.test('worker threads the exact claim capability through every mutation RPC', async () => {
  const seen: string[] = [];
  const { dependencies } = harness({
    prepare: async (_operationId, claimToken) => {
      seen.push(`prepare:${claimToken}`);
      return {
        data: [
          {
            operation_state: 'running',
            result_code: 'DATABASE_AND_PROCESSORS_RECONCILED',
            pending_storage_objects: 0,
          },
        ],
        error: null,
      };
    },
    listStorage: async (_operationId, _limit, claimToken) => {
      seen.push(`list:${claimToken}`);
      return { data: [], error: null };
    },
    complete: async (_operationId, claimToken) => {
      seen.push(`complete:${claimToken}`);
      return { data: completedRow(), error: null };
    },
  });
  await run(dependencies);
  assertEquals(
    seen,
    [`prepare:${CLAIM_TOKEN}`, `list:${CLAIM_TOKEN}`, `complete:${CLAIM_TOKEN}`],
    'claim token propagation',
  );
});

Deno.test('worker removes only attested owner-and-epoch paths and rechecks absence', async () => {
  const path = `${USER_ID}/e3/photo.enc`;
  let lists = 0;
  const { calls, dependencies } = harness({
    listStorage: async () => {
      calls.push('list');
      lists += 1;
      return { data: lists === 1 ? [{ storage_path: path }] : [], error: null };
    },
    removeStorage: async (paths) => {
      calls.push(`remove:${paths.join(',')}`);
      return { error: null };
    },
  });
  const report = await run(dependencies);
  assertEquals(
    calls,
    ['claim', 'prepare', 'list', `remove:${path}`, 'list', 'complete'],
    'Storage drain order',
  );
  assertEquals(report.completed, 1, 'operation completed');
});

Deno.test(
  'worker drains canonical pre-epoch Storage without opening cross-epoch deletion',
  async () => {
    const path = `${USER_ID}/legacy-photo.enc`;
    let lists = 0;
    const { calls, dependencies } = harness({
      listStorage: async () => {
        calls.push('list');
        lists += 1;
        return { data: lists === 1 ? [{ storage_path: path }] : [], error: null };
      },
      removeStorage: async (paths) => {
        calls.push(`remove:${paths.join(',')}`);
        return { error: null };
      },
    });
    const report = await run(dependencies);
    assertEquals(
      calls,
      ['claim', 'prepare', 'list', `remove:${path}`, 'list', 'complete'],
      'legacy Storage drain order',
    );
    assertEquals(report.completed, 1, 'legacy operation completed');
  },
);

Deno.test(
  'worker rejects an invalid or duplicate claim set before touching an operation',
  async () => {
    const { calls, dependencies } = harness({
      claim: async () => {
        calls.push('claim');
        return { data: [claimRow(), claimRow()], error: null };
      },
    });
    await assertRejectsCode(() => run(dependencies), 'HEALTH_WORKER_CLAIM_ATTESTATION_INVALID');
    assertEquals(calls, ['claim'], 'invalid claims must not be prepared');
  },
);

Deno.test('cross-epoch Storage work is never removed and is durably deferred', async () => {
  let removed = false;
  const { calls, dependencies } = harness({
    listStorage: async () => {
      calls.push('list');
      return {
        data: [{ storage_path: `${USER_ID}/e2/stale.enc` }],
        error: null,
      };
    },
    removeStorage: async () => {
      removed = true;
      return { error: null };
    },
  });
  const report = await run(dependencies);
  assert(!removed, 'cross-epoch object must not be removed');
  assert(calls.includes('defer:HEALTH_STORAGE_ATTESTATION_INVALID'), 'defer receipt required');
  assertEquals(report.actionRequired, 1, 'unsafe path requires operator attention');
});

Deno.test(
  'durable action-required prepare result is reported without an invalid defer',
  async () => {
    const { calls, dependencies } = harness({
      prepare: async () => {
        calls.push('prepare');
        return {
          data: [
            {
              operation_state: 'action_required',
              result_code: 'UNSAFE_PHOTO_STORAGE_OWNERSHIP',
              pending_storage_objects: 1,
            },
          ],
          error: null,
        };
      },
    });
    const report = await run(dependencies);
    assertEquals(calls, ['claim', 'prepare'], 'prepare already cleared the worker lease');
    assertEquals(report.deferred, 0, 'terminal operator lane is not a retry deferral');
    assertEquals(report.actionRequired, 1, 'operator attention is reported');
  },
);

Deno.test('Storage provider failure clears the lease through a stable retry receipt', async () => {
  const path = `${USER_ID}/e3/photo.enc`;
  const { calls, dependencies } = harness({
    listStorage: async () => {
      calls.push('list');
      return { data: [{ storage_path: path }], error: null };
    },
    removeStorage: async () => {
      calls.push('remove');
      return { error: new Error('raw provider detail') };
    },
  });
  const report = await run(dependencies);
  assert(calls.includes('defer:HEALTH_STORAGE_DELETE_FAILED'), 'failure must be persisted');
  assertEquals(report.deferred, 1, 'provider failure is retryable');
  assert(!JSON.stringify(report).includes('provider detail'), 'provider error is redacted');
});

Deno.test('bounded Storage batches defer remaining work instead of overrunning', async () => {
  const path = `${USER_ID}/e3/photo.enc`;
  let removes = 0;
  const { calls, dependencies } = harness({
    listStorage: async () => ({ data: [{ storage_path: path }], error: null }),
    removeStorage: async () => {
      removes += 1;
      return { error: null };
    },
  });
  const report = await run(dependencies, { maxStorageBatches: 2 });
  assertEquals(removes, 2, 'bounded removal attempts');
  assert(calls.includes('defer:HEALTH_STORAGE_WORK_REMAINS'), 'remaining work is deferred');
  assertEquals(report.completed, 0, 'bounded run cannot claim completion');
});

Deno.test('deadline exhaustion releases every claimed operation for retry', async () => {
  const { calls, dependencies } = harness();
  const report = await run(dependencies, {
    deadlineAtMs: 1_000,
    now: () => 1_000,
  });
  assertEquals(calls, ['claim', 'defer:HEALTH_WORKER_BUDGET_EXHAUSTED'], 'deadline path');
  assert(report.deadlineReached, 'deadline reported');
});

Deno.test('worker configuration matches the database claim and deferral bounds', async () => {
  const { calls, dependencies } = harness();
  await assertRejectsCode(
    () => run(dependencies, { claimLimit: 26 }),
    'HEALTH_WORKER_CONFIGURATION_INVALID',
  );
  await assertRejectsCode(
    () => run(dependencies, { retryAfterSeconds: 4 }),
    'HEALTH_WORKER_CONFIGURATION_INVALID',
  );
  await assertRejectsCode(
    () => run(dependencies, { actionRequiredRetryAfterSeconds: 86_401 }),
    'HEALTH_WORKER_CONFIGURATION_INVALID',
  );
  assertEquals(calls, [], 'invalid database-bound configuration must fail before claiming');
});

Deno.test(
  'the thousandth base defer response is durable action-required, not a failed deferral',
  async () => {
    const { calls, dependencies } = harness({
      prepare: async () => {
        calls.push('prepare');
        return { data: null, error: new Error('retryable prepare failure') };
      },
      defer: async (operationId, _claimToken, resultCode) => {
        calls.push(`defer:${resultCode}`);
        return {
          data: [
            {
              operation_id: operationId,
              operation_state: 'action_required',
              result_code: 'WORKER_RETRY_EXHAUSTED',
              next_attempt_at: '2026-07-15T12:00:00.000Z',
            },
          ],
          error: null,
        };
      },
    });
    const report = await run(dependencies);
    assertEquals(
      calls,
      ['claim', 'prepare', 'defer:HEALTH_DATABASE_PREPARE_FAILED'],
      'threshold response call order',
    );
    assertEquals(report.deferred, 0, 'terminal exhaustion is not reported retryable');
    assertEquals(report.actionRequired, 1, 'terminal exhaustion is durable operator work');
  },
);

Deno.test('worker fails closed when durable deferral cannot be recorded', async () => {
  const { dependencies } = harness({
    prepare: async () => ({
      data: null,
      error: new Error('database unavailable'),
    }),
    defer: async () => ({
      data: null,
      error: new Error('lease release unavailable'),
    }),
  });
  await assertRejectsCode(() => run(dependencies), 'HEALTH_WORKER_DEFER_FAILED');
});

Deno.test('worker fails closed when durable deferral is not attested', async () => {
  const { dependencies } = harness({
    prepare: async () => ({
      data: null,
      error: new Error('database unavailable'),
    }),
    defer: async () => ({
      data: [{ operation_state: 'storage_pending' }],
      error: null,
    }),
  });
  await assertRejectsCode(() => run(dependencies), 'HEALTH_WORKER_DEFER_FAILED');
});

Deno.test('thrown dependency failures are converted into durable redacted deferrals', async () => {
  const { calls, dependencies } = harness({
    prepare: async () => {
      throw new Error('raw transport failure');
    },
  });
  const report = await run(dependencies);
  assert(
    calls.includes('defer:HEALTH_DATABASE_PREPARE_FAILED'),
    'thrown prepare failure must release the claim for retry',
  );
  assertEquals(report.deferred, 1, 'thrown dependency failure is retryable');
  assert(!JSON.stringify(report).includes('transport failure'), 'raw failure must be redacted');
});
