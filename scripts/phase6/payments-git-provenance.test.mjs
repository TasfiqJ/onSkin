import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { auditPhase6GitProvenance } from './payments-git-provenance.mjs';

const SHA = 'a'.repeat(40);

test('accepts canonical clean Git provenance', () => {
  const result = auditPhase6GitProvenance({ captured: true, sha: SHA, status: '' });
  assert.equal(result.valid, true);
  assert.equal(result.captured, true);
  assert.equal(result.gitSha, SHA);
  assert.equal(result.gitStatus, '');
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.warnings, []);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.blockers));
  assert.ok(Object.isFrozen(result.warnings));
});

test('rejects dirty Git provenance', () => {
  const result = auditPhase6GitProvenance({
    captured: true,
    sha: SHA,
    status: ' M scripts/phase6/check-payments-env.mjs',
  });
  assert.equal(result.valid, false);
  assert.equal(result.captured, true);
  assert.equal(result.gitSha, SHA);
  assert.match(result.blockers.join('\n'), /clean Git worktree/);
  assert.match(result.warnings.join('\n'), /dirty Git worktree/);
});

test('rejects unavailable Git provenance', () => {
  const result = auditPhase6GitProvenance({ captured: false, sha: '', status: '' });
  assert.equal(result.valid, false);
  assert.equal(result.captured, false);
  assert.equal(result.gitSha, 'unknown');
  assert.equal(result.gitStatus, 'unknown');
  assert.match(result.blockers.join('\n'), /unavailable or noncanonical/);
});

test('rejects noncanonical Git SHAs', () => {
  for (const sha of ['A'.repeat(40), 'a'.repeat(39), 'a'.repeat(41), 'unknown']) {
    const result = auditPhase6GitProvenance({ captured: true, sha, status: '' });
    assert.equal(result.valid, false, sha);
    assert.equal(result.captured, false, sha);
    assert.match(result.blockers.join('\n'), /unavailable or noncanonical/);
  }
});

test('rejects malformed Git provenance input', () => {
  assert.throws(
    () => auditPhase6GitProvenance({ captured: true, sha: SHA, status: '', extra: true }),
    TypeError,
  );
});

test('Git status collection forces all untracked files visible despite local config', () => {
  const repository = mkdtempSync(join(tmpdir(), 'layerwell-phase6-git-status-'));
  try {
    for (const args of [
      ['init', '--quiet'],
      ['config', 'status.showUntrackedFiles', 'no'],
    ]) {
      const result = spawnSync('git', args, { cwd: repository, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    writeFileSync(join(repository, 'untracked.txt'), 'required evidence\n');
    const moduleUrl = pathToFileURL(resolve(import.meta.dirname, '../phase9/lib.mjs')).href;
    const script = `import { gitStatusExcludingPaths } from ${JSON.stringify(moduleUrl)}; console.log(gitStatusExcludingPaths([]));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: repository,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\?\? untracked\.txt/);
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
});
