import assert from 'node:assert/strict';
import test from 'node:test';
import { CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS, runWithCanonicalPostgresPullRetry } from './local-supabase-reset-retry.mjs';

function failure(originReason, diagnostic, overrides = {}) {
  return new Error('sanitized canonical pull failure', { cause: {
    reason: originReason, originReason, diagnostic, containment: 'posix-process-group-empty', ...overrides,
  } });
}

test('canonical pull retries only throttling, then returns the successful original result', async () => {
  const waits = [], retries = [];
  let calls = 0;
  const result = { stdout: 'Digest: immutable-reviewed-image', stderr: '' };
  const observed = await runWithCanonicalPostgresPullRetry({
    operation: async () => {
      calls += 1;
      if (calls <= 3) throw failure('exit-nonzero', 'Error response from daemon: toomanyrequests: Rate exceeded');
      return result;
    },
    onRetry: attempt => retries.push(attempt), wait: async ms => waits.push(ms),
  });
  assert.equal(observed, result);
  assert.equal(calls, 4);
  assert.deepEqual(retries, [1, 2, 3]);
  assert.deepEqual(waits, CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS);
});

test('persistent throttling stops after four attempts and preserves the last failure', async () => {
  let calls = 0;
  const error = failure('exit-nonzero', '429 Too Many Requests');
  await assert.rejects(runWithCanonicalPostgresPullRetry({
    operation: async () => { calls += 1; throw error; }, onRetry() {}, wait: async () => {},
  }), actual => actual === error);
  assert.equal(calls, 4);
});

test('ECR data allowance exhaustion fails once without treating it as transient request throttling', async () => {
  // Quality 39330376557, attempt 3, job 118333051806: no SQL or reset ran.
  // A monthly data allowance is separate from the per-second pull rate.
  const error = failure('exit-nonzero', 'Error response from daemon: toomanyrequests: Data limit exceeded');
  let calls = 0;
  await assert.rejects(runWithCanonicalPostgresPullRetry({
    operation: async () => { calls += 1; throw error; },
    onRetry: () => assert.fail('data exhaustion must not retry'),
    wait: async () => assert.fail('data exhaustion must not back off'),
  }), actual => actual === error);
  assert.equal(calls, 1);
});

test('timeouts, cancellation, output bounds, auth, network and unstructured errors never retry', async () => {
  for (const error of [
    ...['timeout', 'aborted', 'cancelled', 'output-limit'].map(reason => failure(reason, 'toomanyrequests: Rate exceeded')),
    ...['unconfirmed', 'not-started', 'windows-primary-process-only', undefined].map(containment =>
      failure('exit-nonzero', 'toomanyrequests: Rate exceeded', { containment })),
    failure('exit-nonzero', 'toomanyrequests: Rate exceeded', { reason: 'containment-failed' }),
    failure('exit-nonzero', 'denied: authentication required'),
    failure('exit-nonzero', 'network unavailable'), new Error('429 Too Many Requests'),
  ]) {
    let calls = 0;
    await assert.rejects(runWithCanonicalPostgresPullRetry({
      operation: async () => { calls += 1; throw error; },
      onRetry: () => assert.fail('must not retry'), wait: async () => assert.fail('must not wait'),
    }), actual => actual === error);
    assert.equal(calls, 1);
  }
});

test('the real default timer obeys cancellation and a pre-aborted signal cannot start a pull', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(runWithCanonicalPostgresPullRetry({
    operation: async () => { calls += 1; throw failure('exit-nonzero', '429 Too Many Requests'); },
    onRetry: () => controller.abort(), signal: controller.signal,
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
  await assert.rejects(runWithCanonicalPostgresPullRetry({
    operation: async () => assert.fail('a pre-aborted signal must not start Docker'),
    onRetry() {}, signal: controller.signal,
  }), { name: 'AbortError' });
});

test('a cancelled backoff cannot start another pull', async () => {
  let calls = 0;
  const cancelled = new Error('cancelled wait');
  await assert.rejects(runWithCanonicalPostgresPullRetry({
    operation: async () => { calls += 1; throw failure('exit-nonzero', '429 Too Many Requests'); },
    onRetry() {}, wait: async () => { throw cancelled; },
  }), actual => actual === cancelled);
  assert.equal(calls, 1);
});
