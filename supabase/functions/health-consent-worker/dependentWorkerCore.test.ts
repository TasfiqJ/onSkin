// deno-lint-ignore-file require-await
import { GranularActionRequiredError } from '../consent-withdrawal/granularWithdrawalCore.ts';
import {
  type HealthDependentWorkerDependencies,
  HealthDependentWorkerError,
  runHealthDependentConsentWorker,
} from './dependentWorkerCore.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    );
  }
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '10000000-0000-4000-8000-000000000001';
const CLAIM_TOKEN = 'b'.repeat(64);

function claimRow(consentType = 'ask_onskin') {
  return {
    operation_id: OPERATION_ID,
    user_id: USER_ID,
    consent_type: consentType,
    processing_epoch: 7,
    consent_generation: 4,
  };
}

function completedRow(consentType = 'ask_onskin') {
  return [{
    operation_id: OPERATION_ID,
    user_id: USER_ID,
    consent_type: consentType,
    state: 'withdrawn',
    processing_epoch: 7,
    consent_generation: 4,
  }];
}

function harness(
  overrides: Partial<HealthDependentWorkerDependencies> = {},
) {
  const calls: string[] = [];
  const dependencies: HealthDependentWorkerDependencies = {
    claim: async (claimToken, limit) => {
      calls.push(`claim:${claimToken}:${limit}`);
      return { data: [claimRow()], error: null };
    },
    cleanup: async (operation) => {
      calls.push(
        `cleanup:${operation.userId}:${operation.consentType}:${operation.processingEpoch}:${operation.consentGeneration}`,
      );
      return {
        ask_safety_audit_deleted: 0,
        ask_turn_audit_deleted: 0,
        ask_sessions_deleted: 1,
        more_pending: false,
      };
    },
    listStorage: async (operationId, limit, claimToken) => {
      calls.push(`list-storage:${operationId}:${limit}:${claimToken}`);
      return { data: [], error: null };
    },
    removeStorage: async (paths) => {
      calls.push(`remove-storage:${paths.join(',')}`);
      return { error: null };
    },
    complete: async (operationId) => {
      calls.push(`complete:${operationId}`);
      return { data: completedRow(), error: null };
    },
    markActionRequired: async (operationId, claimToken, resultCode) => {
      calls.push(`action:${operationId}:${claimToken}:${resultCode}`);
      return {
        data: [{
          operation_id: operationId,
          state: 'action_required',
          result_code: resultCode,
        }],
        error: null,
      };
    },
    defer: async (operationId, claimToken, resultCode, retryAfterSeconds) => {
      calls.push(
        `defer:${operationId}:${claimToken}:${resultCode}:${retryAfterSeconds}`,
      );
      return {
        data: [{
          operation_id: operationId,
          state: 'pending',
          result_code: resultCode,
          next_attempt_at: '2026-07-15T12:01:00.000Z',
        }],
        error: null,
      };
    },
    ...overrides,
  };
  return { calls, dependencies };
}

function run(
  dependencies: HealthDependentWorkerDependencies,
  overrides: Partial<Parameters<typeof runHealthDependentConsentWorker>[0]> =
    {},
) {
  return runHealthDependentConsentWorker({
    claimToken: CLAIM_TOKEN,
    claimLimit: 10,
    retryAfterSeconds: 60,
    deadlineAtMs: 50_000,
    now: () => 1_000,
    dependencies,
    ...overrides,
  });
}

Deno.test('dependent worker adopts claim, shared cleanup, and exact completion contracts', async () => {
  const { calls, dependencies } = harness();
  const report = await run(dependencies);
  assertEquals(
    calls,
    [
      `claim:${CLAIM_TOKEN}:10`,
      `cleanup:${USER_ID}:ask_onskin:7:4`,
      `complete:${OPERATION_ID}`,
    ],
    'dependent lost-device order',
  );
  assertEquals(
    report,
    {
      claimed: 1,
      completed: 1,
      deferred: 0,
      actionRequired: 0,
      deadlineReached: false,
    },
    'dependent report',
  );
});

Deno.test('photo withdrawal drains DB-attested storage before shared metadata cleanup', async () => {
  const events: string[] = [];
  let listAttempt = 0;
  const path = `${USER_ID}/e7/photo.enc`;
  const { dependencies } = harness({
    claim: async () => ({
      data: [claimRow('photo_capture')],
      error: null,
    }),
    listStorage: async (operationId, limit, claimToken) => {
      events.push(`list:${operationId}:${limit}:${claimToken}`);
      listAttempt += 1;
      return {
        data: listAttempt === 1 ? [{ storage_path: path }] : [],
        error: null,
      };
    },
    removeStorage: async (paths) => {
      events.push(`remove:${paths.join(',')}`);
      return { error: null };
    },
    cleanup: async () => {
      events.push('cleanup');
      return {
        remote_photo_rows_deleted: 1,
        storage_objects_removed: 0,
        skipped_storage_paths: 0,
        local_device_cleanup_claimed: false,
        photo_trend_deleted: 0,
      };
    },
    complete: async () => {
      events.push('complete');
      return { data: completedRow('photo_capture'), error: null };
    },
  });

  const report = await run(dependencies);

  assertEquals(
    events,
    [
      `list:${OPERATION_ID}:100:${CLAIM_TOKEN}`,
      `remove:${path}`,
      `list:${OPERATION_ID}:100:${CLAIM_TOKEN}`,
      'cleanup',
      'complete',
    ],
    'storage attestation and deletion must precede metadata cleanup',
  );
  assert(
    report.completed === 1 && report.deferred === 0 &&
      report.actionRequired === 0,
    'photo withdrawal should complete only after the storage lane is empty',
  );
});

Deno.test('dependent storage ownership ambiguity enters the durable operator lane', async () => {
  let cleanupCalled = false;
  let removeCalled = false;
  const { calls, dependencies } = harness({
    claim: async () => ({
      data: [claimRow('photo_cloud_backup')],
      error: null,
    }),
    listStorage: async () => ({
      data: null,
      error: { message: 'HEALTH_DEPENDENT_STORAGE_WORK_PATH_INVALID' },
    }),
    removeStorage: async () => {
      removeCalled = true;
      return { error: null };
    },
    cleanup: async () => {
      cleanupCalled = true;
      return {};
    },
  });

  const report = await run(dependencies);

  assert(
    !removeCalled && !cleanupCalled,
    'ambiguous ownership forbids deletion',
  );
  assert(
    calls.includes(
      `action:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_STORAGE_OWNERSHIP_INVALID`,
    ),
    'ownership ambiguity must be durably recorded',
  );
  assert(
    report.actionRequired === 1 && report.deferred === 0,
    'operator report',
  );
});

Deno.test('dependent storage global bound is marked before any partial deletion', async () => {
  let cleanupCalled = false;
  let removeCalled = false;
  const { calls, dependencies } = harness({
    claim: async () => ({
      data: [claimRow('photo_capture')],
      error: null,
    }),
    listStorage: async () => ({
      data: null,
      error: { message: 'HEALTH_DEPENDENT_STORAGE_WORK_BOUND_EXCEEDED' },
    }),
    removeStorage: async () => {
      removeCalled = true;
      return { error: null };
    },
    cleanup: async () => {
      cleanupCalled = true;
      return {};
    },
  });

  const report = await run(dependencies);

  assert(
    !removeCalled && !cleanupCalled,
    'over-bound set forbids partial deletion',
  );
  assert(
    calls.includes(
      `action:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_STORAGE_BOUND_EXCEEDED`,
    ),
    'storage bound must use its exact durable result code',
  );
  assert(
    report.actionRequired === 1 && report.deferred === 0,
    'operator report',
  );
});

Deno.test('worker independently rejects a cross-owner storage path', async () => {
  let removeCalled = false;
  let cleanupCalled = false;
  const { calls, dependencies } = harness({
    claim: async () => ({
      data: [claimRow('photo_capture')],
      error: null,
    }),
    listStorage: async () => ({
      data: [{
        storage_path: '00000000-0000-4000-8000-000000000099/e7/foreign.enc',
      }],
      error: null,
    }),
    removeStorage: async () => {
      removeCalled = true;
      return { error: null };
    },
    cleanup: async () => {
      cleanupCalled = true;
      return {};
    },
  });

  const report = await run(dependencies);

  assert(
    !removeCalled && !cleanupCalled,
    'cross-owner path must never be deleted',
  );
  assert(
    calls.includes(
      `action:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_STORAGE_OWNERSHIP_INVALID`,
    ),
    'worker defense-in-depth must enter the ownership operator lane',
  );
  assert(report.actionRequired === 1, 'operator report');
});

Deno.test('dependent storage provider failure releases the lease for retry', async () => {
  let cleanupCalled = false;
  const path = `${USER_ID}/e7/photo.enc`;
  const { calls, dependencies } = harness({
    claim: async () => ({
      data: [claimRow('photo_capture')],
      error: null,
    }),
    listStorage: async () => ({
      data: [{ storage_path: path }],
      error: null,
    }),
    removeStorage: async () => ({ error: { message: 'provider unavailable' } }),
    cleanup: async () => {
      cleanupCalled = true;
      return {};
    },
  });

  const report = await run(dependencies);

  assert(!cleanupCalled, 'metadata cleanup must wait for storage deletion');
  assert(
    calls.includes(
      `defer:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_STORAGE_DELETE_FAILED:60`,
    ),
    'transient storage failure must durably release the lease',
  );
  assert(report.deferred === 1 && report.completed === 0, 'retry report');
});

Deno.test('dependent cleanup failure durably releases the exact lease', async () => {
  const { calls, dependencies } = harness({
    cleanup: async () => {
      throw new Error('raw provider detail');
    },
  });
  const report = await run(dependencies);
  assert(
    calls.includes(
      `defer:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_CLEANUP_FAILED:60`,
    ),
    'claim token must reach dependent defer',
  );
  assert(
    report.deferred === 1 && report.completed === 0,
    'failure remains retryable',
  );
  assert(
    !JSON.stringify(report).includes('provider detail'),
    'report must be redacted',
  );
});

Deno.test('dependent worker rejects wrong-purpose cleanup attestation', async () => {
  const { calls, dependencies } = harness({
    cleanup: async () => ({ photo_trend_deleted: 1 }),
  });
  const report = await run(dependencies);
  assert(
    calls.includes(
      `defer:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_CLEANUP_ATTESTATION_INVALID:60`,
    ),
    'wrong-purpose cleanup must never reach completion',
  );
  assert(
    report.deferred === 1 && report.completed === 0,
    'invalid cleanup remains pending',
  );
});

Deno.test('provider-bound cleanup enters the durable non-reclaimable operator lane', async () => {
  const { calls, dependencies } = harness({
    cleanup: async () => {
      throw new GranularActionRequiredError();
    },
  });
  const report = await run(dependencies);
  assert(
    calls.includes(
      `action:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_PROVIDER_BOUND_EXCEEDED`,
    ),
    'provider bound must use the leased durable action-required transition',
  );
  assert(
    report.deferred === 0 && report.actionRequired === 1,
    'terminal operator lane must not remain pending/deferred',
  );
});

Deno.test('dependent worker rejects malformed claim tuples before cleanup', async () => {
  const { calls, dependencies } = harness({
    claim: async () => {
      calls.push('claim');
      return {
        data: [{ ...claimRow(), consent_type: 'marketing' }],
        error: null,
      };
    },
  });
  try {
    await run(dependencies);
  } catch (error) {
    assert(
      error instanceof HealthDependentWorkerError &&
        error.code === 'HEALTH_DEPENDENT_WORKER_CLAIM_ATTESTATION_INVALID',
      'malformed claim must fail closed',
    );
    assertEquals(calls, ['claim'], 'no malformed claim may reach cleanup');
    return;
  }
  throw new Error('expected malformed claim rejection');
});

Deno.test('completion mismatch is deferred and never counted terminal', async () => {
  const { calls, dependencies } = harness({
    complete: async () => {
      calls.push('complete');
      return {
        data: [{
          ...completedRow()[0],
          user_id: '00000000-0000-4000-8000-000000000099',
        }],
        error: null,
      };
    },
  });
  const report = await run(dependencies);
  assert(
    calls.includes(
      `defer:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_COMPLETION_FAILED:60`,
    ),
    'completion mismatch must release the lease',
  );
  assert(
    report.completed === 0 && report.deferred === 1,
    'false terminal state forbidden',
  );
});

Deno.test('deadline exhaustion defers claims before destructive cleanup', async () => {
  let cleaned = false;
  const { calls, dependencies } = harness({
    cleanup: async () => {
      cleaned = true;
      return {};
    },
  });
  const report = await run(dependencies, {
    deadlineAtMs: 1_000,
    now: () => 1_000,
  });
  assert(!cleaned, 'expired budget must issue no cleanup');
  assert(
    calls.includes(
      `defer:${OPERATION_ID}:${CLAIM_TOKEN}:DEPENDENT_WORKER_BUDGET_EXHAUSTED:60`,
    ),
    'deadline must durably defer',
  );
  assert(report.deadlineReached, 'deadline reported');
});

Deno.test('dependent worker fails closed when a claimed lease cannot be deferred', async () => {
  const { dependencies } = harness({
    cleanup: async () => {
      throw new Error('cleanup failed');
    },
    defer: async () => ({
      data: null,
      error: new Error('database unavailable'),
    }),
  });
  try {
    await run(dependencies);
  } catch (error) {
    assert(
      error instanceof HealthDependentWorkerError &&
        error.code === 'HEALTH_DEPENDENT_WORKER_DEFER_FAILED',
      'unreleased lease must fail the scheduler invocation',
    );
    return;
  }
  throw new Error('expected dependent defer failure');
});

Deno.test('dependent worker fails closed when operator transition is not attested', async () => {
  const { dependencies } = harness({
    cleanup: async () => {
      throw new GranularActionRequiredError();
    },
    markActionRequired: async () => ({
      data: [{
        operation_id: OPERATION_ID,
        state: 'pending',
        result_code: 'DEPENDENT_PROVIDER_BOUND_EXCEEDED',
      }],
      error: null,
    }),
  });
  try {
    await run(dependencies);
  } catch (error) {
    assert(
      error instanceof HealthDependentWorkerError &&
        error.code === 'HEALTH_DEPENDENT_WORKER_ACTION_REQUIRED_FAILED',
      'unattested operator transition must fail the scheduler invocation',
    );
    return;
  }
  throw new Error('expected action-required attestation failure');
});

Deno.test('defer exhaustion is counted as durable action-required, not pending', async () => {
  const { dependencies } = harness({
    cleanup: async () => {
      throw new Error('transient cleanup failure at final attempt');
    },
    defer: async (operationId) => ({
      data: [{
        operation_id: operationId,
        state: 'action_required',
        result_code: 'WORKER_RETRY_EXHAUSTED',
        next_attempt_at: '2026-07-15T12:01:00.000Z',
      }],
      error: null,
    }),
  });
  const report = await run(dependencies);
  assert(
    report.actionRequired === 1 && report.deferred === 0,
    'worker report must match the non-reclaimable database state',
  );
});
