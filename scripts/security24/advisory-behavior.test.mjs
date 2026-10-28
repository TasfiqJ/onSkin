import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import { patchToolingSecurity24 } from './patch-tooling.mjs';
import { fixture } from './probe.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
function probe(root, mode = 'libraries') {
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--stack-size=512',
    resolve(import.meta.dirname, 'probe.mjs'), root, mode], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 512 * 1024, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const value = JSON.parse(result.stdout);
  assert.equal(value.qualification, 'BOUNDED_SYNTHETIC_PUBLIC_ADVISORY_BEHAVIOR');
  assert.equal(value.acceptanceGranted, false);
  assert.equal(value.release, 'NO_GO');
  return value.result;
}

test('genuine original-to-patched bounded probes retain every unresolved collection path', t => {
  const f = fixture(t), before = probe(f.root);
  assert.equal(patchToolingSecurity24({ root: f.root }).status, 'patched');
  const after = probe(f.root);
  for (const value of [before, after]) {
    assert.equal(value.zod.length, 118);
    assert.equal(value.deepmerge.length, 60);
  }
  for (let index = 0; index < before.zod.length; index++) {
    const original = before.zod[index], current = after.zod[index];
    for (const key of ['entry', 'kind', 'async']) assert.equal(original[key], current[key]);
    if (original.unboundedIssues) {
      assert.deepEqual(current.unboundedIssues, original.unboundedIssues);
      assert.equal(current.unboundedIssues[1], 4 * current.unboundedIssues[0]);
      if (current.constrainedSupported) assert.equal(current.constrainedIssues, 1);
      else assert.equal(current.constrainedIssues, null);
      if (current.entry.startsWith('v4') && current.constrainedSupported) assert.ok(original.constrainedIssues > 256);
    } else if (current.kind === 'post-bound-refinement') {
      assert.equal(current.calls, 0);
      if (current.entry.startsWith('v4')) assert.equal(original.calls, 1);
    } else if (['preprocess-shrink', 'overwrite-before-bound'].includes(current.kind)) {
      assert.deepEqual(current, original);
      assert.equal(current.success, true);
      assert.equal(current.outputLength, 2);
    } else if (current.kind === 'transformed-unbounded') {
      assert.deepEqual(current, original);
      assert.equal(current.issues, 128);
    } else if (current.kind === 'async-element-transform') {
      assert.equal(current.calls, 0);
      assert.equal(current.issues, 1);
      assert.equal(original.calls, current.entry.startsWith('v4') ? 32 : 0);
    } else if (current.kind.startsWith('custom-')) {
      assert.deepEqual(current, original);
      assert.ok(current.issues >= 2);
    } else assert.fail('UNACCOUNTED_ZOD_CASE');
  }
  assert.ok(before.deepmerge.some(record => record.inheritedPoison));
  for (const record of after.deepmerge) {
    if (record.targetKind === 'inherited-keys') assert.equal(record.absent, true);
    else if (record.targetKind === 'compatibility') assert.equal(record.success, true);
    else if (['primitive-compatible', 'nested-null-compatible'].includes(record.targetKind)) assert.equal(record.success, true);
    else if (record.targetKind === 'trusted-clone-false') assert.equal(record.existingPrototypeRetained, true);
    else if (record.targetKind === 'trusted-custom-merge') assert.equal(record.callbackPrototypeRetained, true);
    else if (record.targetKind === 'inherited-setter') { assert.equal(record.setterCalls, 0); assert.equal(record.ownValue, true); }
    else if (record.targetKind === 'throwing-in') assert.equal(record.omitted, true);
    else for (const key of ['inheritedPoison', 'ownForbidden', 'globalPoison']) assert.equal(record[key], false);
  }
});

test('real installed Expo config consumer blocks returned-prototype poison and retains open unbounded output schema', () => {
  patchToolingSecurity24({ root: ROOT, check: true });
  const report = probe(ROOT, 'consumers');
  assert.equal(report.expoConfigDryRun, true);
  assert.equal(report.expoInheritedPoison, false);
  assert.equal(report.expoOutputUnboundedIssues, 128);
  assert.deepEqual(report.validationErrors, [{ entry: 'v3', issues: 1, formatted: true }, { entry: 'v4', issues: 1, formatted: true }]);
  assert.equal(report.eslintHooksValidConsumer, true);
});
