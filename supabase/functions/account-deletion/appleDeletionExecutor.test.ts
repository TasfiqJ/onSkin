import { executeAppleDeletionStep } from './appleDeletionExecutor.ts';
import type { DurableAppleDeletionPayload } from './durableDeletionPayloads.ts';
import type { AccountDeletionClaim } from './durableDeletionWorker.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function claim(mode: 'dispatch' | 'reconcile' = 'dispatch'): AccountDeletionClaim {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    operationState: 'running',
    stepName: 'apple_revoke',
    stepStatus: 'leased',
    claimMode: mode,
    claimToken: 'ab'.repeat(32),
    attemptCount: 1,
    requestStartedAt: mode === 'reconcile' ? '2026-07-13T12:00:00.000Z' : null,
    leaseExpiresAt: '2026-07-13T12:10:00.000Z',
    encryptedPayload: '\\x00',
  };
}

function harness(initial: DurableAppleDeletionPayload) {
  const calls: string[] = [];
  const records: unknown[][] = [];
  let payload = initial;
  return {
    calls,
    records,
    get payload() {
      return payload;
    },
    dependencies: {
      loadPayload() {
        calls.push('load');
        return Promise.resolve(payload);
      },
      savePayload(_claim: AccountDeletionClaim, next: DurableAppleDeletionPayload) {
        calls.push('save');
        payload = next;
        return Promise.resolve();
      },
      markRequestStarted() {
        calls.push('started');
        return Promise.resolve();
      },
      record(
        _claim: AccountDeletionClaim,
        outcome: 'succeeded' | 'retryable' | 'action_required',
        code: string,
        retryAt: string | null,
      ) {
        calls.push('record');
        records.push([outcome, code, retryAt]);
        return Promise.resolve();
      },
      exchangeAuthorizationCode(code: string, subject: string) {
        calls.push(`exchange:${code}:${subject}`);
        return Promise.resolve({
          token: 'revocation-token',
          tokenTypeHint: 'refresh_token' as const,
        });
      },
      revokeToken(token: string) {
        calls.push(`revoke:${token}`);
        return Promise.resolve({ status: 200, body: '', responseBytes: 0 });
      },
      now: () => Date.parse('2026-07-13T12:00:00.000Z'),
    },
  };
}

Deno.test('not-linked and manual Apple states succeed without a fake request marker', async () => {
  for (const [payload, code] of [
    [{ version: 1, appleLinked: false, phase: 'not_linked' }, 'APPLE_NOT_LINKED'],
    [{ version: 1, appleLinked: true, phase: 'manual' }, 'APPLE_MANUAL_REVOCATION_RECORDED'],
  ] as const) {
    const h = harness(payload);
    await executeAppleDeletionStep(
      claim(),
      { deadlineAtMs: h.dependencies.now() + 10_000 },
      h.dependencies,
    );
    assert(!h.calls.includes('started'), 'no provider mutation was attempted');
    assert(h.records[0]?.[0] === 'succeeded' && h.records[0]?.[1] === code, 'honest success');
  }
});

Deno.test('Apple code exchange persists token before idempotent revoke', async () => {
  const h = harness({
    version: 1,
    appleLinked: true,
    phase: 'authorization_code',
    authorizationCode: 'one-time-code',
    expectedAppleSubject: 'apple-subject',
  });
  await executeAppleDeletionStep(
    claim(),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(
    JSON.stringify(h.calls) ===
      JSON.stringify([
        'load',
        'started',
        'exchange:one-time-code:apple-subject',
        'save',
        'revoke:revocation-token',
        'record',
      ]),
    'commit ordering must be stable',
  );
  assert(h.payload.phase === 'revocation_token', 'consumed code replaced by token');
  assert(h.records[0]?.[1] === 'APPLE_REVOKED', 'revocation attested');
});

Deno.test(
  'ambiguous token persistence reconciles instead of discarding a committed token',
  async () => {
    const h = harness({
      version: 1,
      appleLinked: true,
      phase: 'authorization_code',
      authorizationCode: 'one-time-code',
      expectedAppleSubject: 'apple-subject',
    });
    const commitThenLoseResponse = h.dependencies.savePayload;
    h.dependencies.savePayload = async (value, payload) => {
      await commitThenLoseResponse(value, payload);
      throw new Error('database response lost after commit');
    };

    let failed = false;
    try {
      await executeAppleDeletionStep(
        claim(),
        { deadlineAtMs: h.dependencies.now() + 10_000 },
        h.dependencies,
      );
    } catch {
      failed = true;
    }
    assert(failed, 'ambiguous durable save leaves the lease for reconciliation');
    assert(h.payload.phase === 'revocation_token', 'committed token retained');
    assert(h.records.length === 0, 'manual success was not falsely recorded');
    assert(
      !h.calls.some((call) => call.startsWith('revoke:')),
      'no revoke before the durable save is attested',
    );

    h.dependencies.savePayload = commitThenLoseResponse;
    await executeAppleDeletionStep(
      claim('reconcile'),
      { deadlineAtMs: h.dependencies.now() + 10_000 },
      h.dependencies,
    );
    assert(h.calls.includes('revoke:revocation-token'), 'persisted token reused');
    assert(h.records[0]?.[1] === 'APPLE_REVOKED', 'revocation completed');
  },
);

Deno.test('Apple reconciliation never replays an unpersisted one-time exchange', async () => {
  const h = harness({
    version: 1,
    appleLinked: true,
    phase: 'authorization_code',
    authorizationCode: 'possibly-consumed',
    expectedAppleSubject: 'apple-subject',
  });
  await executeAppleDeletionStep(
    claim('reconcile'),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(!h.calls.some((call) => call.startsWith('exchange:')), 'no unsafe exchange replay');
  assert(h.records[0]?.[1] === 'APPLE_MANUAL_REVOCATION_RECORDED', 'manual fallback');
});

Deno.test('persisted Apple token safely retries after crash and transport loss', async () => {
  const h = harness({
    version: 1,
    appleLinked: true,
    phase: 'revocation_token',
    revocationToken: 'persisted-token',
    tokenTypeHint: 'refresh_token',
  });
  h.dependencies.revokeToken = () => Promise.reject(new Error('private network detail'));
  await executeAppleDeletionStep(
    claim('reconcile'),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(h.calls.includes('started'), 'reconcile lease is committed');
  assert(h.records[0]?.[0] === 'retryable', 'idempotent revoke can retry');
  assert(h.records[0]?.[1] === 'APPLE_REVOKE_RETRY', 'stable code only');
  assert(typeof h.records[0]?.[2] === 'string', 'retry is scheduled');
});

Deno.test('Apple 200 responses with any body bytes never claim automatic revocation', async () => {
  for (const response of [
    { status: 200, body: 'unexpected', responseBytes: 10 },
    { status: 200, body: ' ', responseBytes: 1 },
    { status: 200, body: '', responseBytes: 3 },
  ]) {
    const h = harness({
      version: 1,
      appleLinked: true,
      phase: 'revocation_token',
      revocationToken: 'persisted-token',
      tokenTypeHint: 'refresh_token',
    });
    h.dependencies.revokeToken = () => Promise.resolve(response);
    await executeAppleDeletionStep(
      claim('reconcile'),
      { deadlineAtMs: h.dependencies.now() + 10_000 },
      h.dependencies,
    );
    assert(h.records[0]?.[0] === 'succeeded', 'manual fallback permits local erasure');
    assert(
      h.records[0]?.[1] === 'APPLE_MANUAL_REVOCATION_RECORDED',
      'nonzero response body bytes must preserve the truthful manual fallback',
    );
  }
});

Deno.test('Apple malformed payload fails closed without provider calls', async () => {
  const h = harness({ version: 1, appleLinked: true, phase: 'manual' });
  h.dependencies.loadPayload = () => Promise.reject(new Error('ciphertext detail'));
  await executeAppleDeletionStep(
    claim(),
    { deadlineAtMs: h.dependencies.now() + 10_000 },
    h.dependencies,
  );
  assert(!h.calls.includes('started'), 'no request on missing evidence');
  assert(h.records[0]?.[0] === 'action_required', 'operator recovery is explicit');
  assert(h.records[0]?.[1] === 'APPLE_PAYLOAD_UNAVAILABLE', 'stable code');
});

Deno.test('Apple deadline before request schedules a safe retry', async () => {
  const h = harness({
    version: 1,
    appleLinked: true,
    phase: 'revocation_token',
    revocationToken: 'persisted-token',
    tokenTypeHint: 'access_token',
  });
  await executeAppleDeletionStep(claim(), { deadlineAtMs: h.dependencies.now() }, h.dependencies);
  assert(!h.calls.includes('started'), 'no side effect after deadline');
  assert(h.records[0]?.[0] === 'retryable', 'safe pre-dispatch retry');
});
