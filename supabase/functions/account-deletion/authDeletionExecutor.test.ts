import {
  AUTH_ABSENCE_SETTLING_MAX_ATTEMPTS,
  executeAuthDeletionStep,
} from './authDeletionExecutor.ts';
import type { AuthDeletionExecutorDependencies } from './authDeletionExecutor.ts';
import type { AccountDeletionClaim } from './durableDeletionWorker.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function claim(
  mode: 'dispatch' | 'reconcile' = 'dispatch',
  attemptCount = 1,
): AccountDeletionClaim {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    operationState: 'running',
    stepName: 'auth_user_delete',
    stepStatus: 'leased',
    claimMode: mode,
    claimToken: 'ab'.repeat(32),
    attemptCount,
    requestStartedAt: mode === 'reconcile' ? '2026-07-13T12:00:00.000Z' : null,
    leaseExpiresAt: '2026-07-13T12:10:00.000Z',
    encryptedPayload: null,
  };
}

function harness() {
  const calls: string[] = [];
  const records: unknown[][] = [];
  let now = Date.parse('2026-07-13T12:00:00.000Z');
  const dependencies: AuthDeletionExecutorDependencies = {
    markRequestStarted() {
      calls.push('started');
      return Promise.resolve();
    },
    record(
      _claim: AccountDeletionClaim,
      outcome: 'succeeded' | 'retryable' | 'ambiguous' | 'action_required',
      code: string,
      retryAt: string | null,
    ) {
      calls.push('record');
      records.push([outcome, code, retryAt]);
      return Promise.resolve();
    },
    hardDeleteUser(userId: string) {
      calls.push(`delete:${userId}`);
      return Promise.resolve({ data: {}, error: null });
    },
    lookupUser(userId: string) {
      calls.push(`lookup:${userId}`);
      return Promise.resolve({
        data: null,
        error: { code: 'user_not_found', status: 404 },
      });
    },
    now: () => now,
  };
  return {
    calls,
    records,
    setNow(value: number) {
      now = value;
    },
    dependencies,
  };
}

Deno.test('Auth dispatch hard-deletes once then verifies exact absence', async () => {
  const h = harness();
  const c = claim();
  await executeAuthDeletionStep(c, { deadlineAtMs: h.dependencies.now() + 10_000 }, h.dependencies);
  assert(
    JSON.stringify(h.calls) ===
      JSON.stringify(['started', `delete:${c.userId}`, `lookup:${c.userId}`, 'record']),
    'destructive ordering',
  );
  assert(
    h.records[0]?.[0] === 'succeeded' && h.records[0]?.[1] === 'AUTH_USER_ABSENT',
    'absence attested',
  );
});

Deno.test('Auth DELETE transport loss becomes ambiguous without replay', async () => {
  const h = harness();
  h.dependencies.hardDeleteUser = (userId: string) => {
    h.calls.push(`delete:${userId}`);
    return Promise.reject(new Error('private'));
  };
  await executeAuthDeletionStep(
    claim(),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(
    h.calls.filter((call) => call.startsWith('delete:')).length === 1,
    'exactly one destructive attempt',
  );
  assert(!h.calls.some((call) => call.startsWith('lookup:')), 'no inline guess');
  assert(h.records[0]?.[0] === 'ambiguous', 'outcome remains unknown');
});

Deno.test('Auth reconciliation is GET-only and succeeds on exact 404', async () => {
  const h = harness();
  const c = claim('reconcile', 2);
  await executeAuthDeletionStep(c, { deadlineAtMs: h.dependencies.now() + 10_000 }, h.dependencies);
  assert(!h.calls.some((call) => call.startsWith('delete:')), 'never redispatch');
  assert(h.calls.includes(`lookup:${c.userId}`), 'exact user lookup');
  assert(h.records[0]?.[1] === 'AUTH_USER_ABSENT', 'terminal absence');
});

Deno.test('Auth present result settles for a bounded window then requires action', async () => {
  for (const [attempt, outcome, code] of [
    [2, 'retryable', 'AUTH_ABSENCE_SETTLING'],
    [AUTH_ABSENCE_SETTLING_MAX_ATTEMPTS, 'action_required', 'AUTH_USER_STILL_PRESENT'],
  ] as const) {
    const h = harness();
    h.dependencies.lookupUser = (userId: string) => {
      h.calls.push(`lookup:${userId}`);
      return Promise.resolve({ data: { user: { id: userId } }, error: null });
    };
    await executeAuthDeletionStep(
      claim('reconcile', attempt),
      { deadlineAtMs: h.dependencies.now() + 10_000 },
      h.dependencies,
    );
    assert(h.records[0]?.[0] === outcome, 'bounded outcome');
    assert(h.records[0]?.[1] === code, 'stable result code');
  }
});

Deno.test('Auth malformed dispatch lookup cannot authorize another DELETE', async () => {
  const h = harness();
  h.dependencies.lookupUser = () => Promise.resolve({ unexpected: true });
  await executeAuthDeletionStep(
    claim(),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(h.records[0]?.[0] === 'ambiguous', 'fail closed after request');
  assert(h.records[0]?.[1] === 'AUTH_DELETE_OUTCOME_UNKNOWN', 'stable code');
});

Deno.test('Auth exact delete user_not_found still requires read verification', async () => {
  const h = harness();
  h.dependencies.hardDeleteUser = (userId: string) => {
    h.calls.push(`delete:${userId}`);
    return Promise.resolve({
      data: null,
      error: { code: 'user_not_found', status: 404 },
    });
  };
  await executeAuthDeletionStep(
    claim(),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(
    h.calls.some((call) => call.startsWith('lookup:')),
    '404 is verified',
  );
  assert(h.records[0]?.[0] === 'succeeded', 'verified absence');
});

Deno.test('Auth deadline before dispatch schedules without side effects', async () => {
  const h = harness();
  h.setNow(Date.parse('2026-07-13T12:00:10.000Z'));
  await executeAuthDeletionStep(claim(), { deadlineAtMs: h.dependencies.now() }, h.dependencies);
  assert(!h.calls.includes('started'), 'no marker after deadline');
  assert(!h.calls.some((call) => call.startsWith('delete:')), 'no DELETE');
  assert(h.records[0]?.[0] === 'retryable', 'safe retry');
});
