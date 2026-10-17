import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { buildCutoverPreparation } from './prepare-staging-cutover.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const projectRef = 'abcdefghijklmnopqrst';

test('N34: pure cutover planning emits safe hashes; supplied commit data conveys no approval', () => {
  const root = mkdtempSync(join(tmpdir(), 'db06-preparation-'));
  try {
    for (const file of [
      'traffic-provider-freeze.json',
      'account-deletion.json',
      'publication-fence.json',
      'entitlement-authority.json',
      'health-consent.json',
      'apple-auth.json',
    ]) {
      writeFileSync(join(root, file), `${JSON.stringify({ file })}\n`, 'utf8');
    }
    const summary = buildCutoverPreparation({
      repoRoot,
      projectRef,
      sourceGitCommit: 'a'.repeat(40),
      evidenceDirectory: root,
    });
    assert.equal(summary.migrationCount, 97);
    assert.equal(summary.migrationIds.at(-1), '20261010000081');
    assert.equal(summary.projectRefLast4, 'qrst');
    assert.equal(
      summary.projectRefFingerprint,
      createHash('sha256').update(`db06-project-ref-v1\0${projectRef}`, 'utf8').digest('hex'),
    );
    assert.equal(
      summary.projectRefFingerprintAlgorithm,
      'sha256(utf8("db06-project-ref-v1\\0" + fullProjectRef))',
    );
    assert.equal(summary.migrationPlanSha256.length, 64);
    assert.equal(
      Object.values(summary.expectedArtifactReferences).every(
        ({ sha256: hash }) => typeof hash === 'string' && hash.length === 64,
      ),
      true,
    );
    assert.equal(JSON.stringify(summary).includes(projectRef), false);
    const otherCommit = buildCutoverPreparation({
      repoRoot,
      projectRef,
      sourceGitCommit: 'b'.repeat(40),
      evidenceDirectory: root,
    });
    assert.equal(summary.sourceGitCommit, 'a'.repeat(40));
    assert.equal(otherCommit.sourceGitCommit, 'b'.repeat(40));
    assert.deepEqual({ ...otherCommit, sourceGitCommit: summary.sourceGitCommit }, summary);
    for (const key of ['approved', 'integrationAuthorized', 'replayAuthorized', 'independentApproval']) {
      assert.equal(Object.hasOwn(summary, key), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
