import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const probe = resolve(import.meta.dirname, 'devtools-output-probe.mjs');
let invocations = 0;
function run(mode, deadline = 5000) {
  assert.ok(Number.isInteger(deadline) && deadline > 0 && deadline <= 5000);
  assert.ok(++invocations <= 32);
  const env = { CI: '1', EXPO_NO_TELEMETRY: '1' };
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'ComSpec', 'PATHEXT']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const start = performance.now();
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, ['--max-old-space-size=128', '--stack-size=512', probe, mode],
      { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let reason = null, bytes = 0, captured = 0;
    const stdout = [], stderr = [];
    const stop = why => { if (!reason) { reason = why; child.kill('SIGKILL'); } };
    const timer = setTimeout(() => stop('TIMEOUT'), deadline);
    for (const [stream, pieces] of [[child.stdout, stdout], [child.stderr, stderr]]) stream.on('data', chunk => {
      bytes += chunk.length;
      const keep = chunk.subarray(0, Math.max(0, 65536 - captured));
      captured += keep.length; pieces.push(keep);
      if (bytes > 65536) stop('OUTPUT_LIMIT');
    });
    child.on('error', () => { clearTimeout(timer); reject(new Error('CHILD_START_FAILED')); });
    // close waits for the owned process and both pipes; killing alone is insufficient.
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      done({ mode, code, signal, reason, captured, closed: true, durationMs: Math.round(performance.now() - start),
        stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
  });
}

async function observation(mode) {
  const result = await run(mode);
  assert.equal(result.reason, null); assert.equal(result.signal, null); assert.equal(result.code, 0);
  assert.equal(result.stderr, ''); assert.equal(result.closed, true);
  const value = JSON.parse(result.stdout);
  assert.equal(value.qualification, 'BOUNDED_SYNTHETIC_INSTALLED_CONSUMER');
  assert.equal(value.acceptanceGranted, false); assert.equal(value.release, 'NO_GO');
  console.log(JSON.stringify({ mode, ...value.result, childMs: result.durationMs, capturedBytes: result.captured }));
  return value.result;
}

test('installed Results consumer preserves ordinary compatibility', async () => {
  const result = await observation('ordinary');
  assert.equal(result.outputRecords, 7);
  assert.equal(result.truncationExercise, 'NOT_RUN_NO_DOCUMENTED_LIMIT_OVERRIDE');
});

test('real invalid-array issue counts and consumer formatting at 32/128/512', async () => {
  const rows = [];
  for (const n of [32, 128, 512]) {
    const result = await observation(`invalid-${n}`); rows.push(result);
    assert.equal(result.directIssues, n); assert.equal(result.consumerIssues, n);
    assert.equal(result.schemaCalls, 1); assert.equal(result.outputRecords, 1);
    assert.equal(result.callbackRecords, 1); assert.equal(result.truncated, false);
    assert.ok(result.inputBytes <= 65536);
  }
  assert.ok(rows[2].outputTextLength > rows[1].outputTextLength && rows[1].outputTextLength > rows[0].outputTextLength);
});

test('valid arrays retain all records at the same finite sizes', async () => {
  for (const n of [32, 128, 512]) {
    const result = await observation(`valid-${n}`);
    assert.equal(result.directIssues, 0); assert.equal(result.consumerIssues, 0);
    assert.equal(result.schemaCalls, 1); assert.equal(result.outputRecords, n);
    assert.equal(result.callbackRecords, n); assert.equal(result.truncated, false);
    assert.ok(result.inputBytes <= 65536);
  }
});

test('timer callback follows real synchronous schema validation and output callback', async () => {
  const result = await observation('ordering');
  assert.deepEqual(result.order, ['before', 'schema-enter', 'schema-exit', 'output', 'after', 'timer']);
});

test('genuine executor injection observes controls and unresolved late callbacks', async () => {
  const result = await observation('executor');
  assert.equal(result.injectedOnly, true); assert.equal(result.defaultTimeoutMs, 10000);
  assert.equal(result.ordinaryRecords, 4);
  // This is an observation harness, not a passing safety regression or a repair.
  if (process.env.SECURITY30_REQUIRE_TERMINAL_FENCE === '1') {
    assert.deepEqual(result.terminal.map(row => [row.after - row.before, row.lateCallbacks]), [[0, 0], [0, 0]],
      'UNREPAIRED_POST_SETTLEMENT_OUTPUT');
  } else for (const row of result.terminal) {
    assert.equal(row.before, 1); assert.equal(row.after, 2); assert.equal(row.lateCallbacks, 1);
  }
});

test('unknown mode refuses without running a consumer', async () => {
  const result = await run('unknown');
  assert.equal(result.code, 1); assert.equal(result.stderr, ''); assert.equal(result.reason, null);
  assert.equal(JSON.parse(result.stdout).reason, 'SECURITY30_PROBE_INCOMPLETE');
});

test('controller terminates and awaits timed-out owned child', async () => {
  const result = await run('controller-timeout', 500);
  assert.equal(result.reason, 'TIMEOUT'); assert.equal(result.closed, true);
  assert.ok(result.captured <= 65536);
  console.log(JSON.stringify({ mode: result.mode, reason: result.reason, closed: result.closed, childMs: result.durationMs }));
});

test('controller bounds combined output and awaits termination', async () => {
  const result = await run('controller-output');
  assert.equal(result.reason, 'OUTPUT_LIMIT'); assert.equal(result.closed, true);
  assert.equal(result.captured, 65536);
  console.log(JSON.stringify({ mode: result.mode, reason: result.reason, closed: result.closed, capturedBytes: result.captured, childMs: result.durationMs }));
  assert.equal(invocations, 12);
});
