import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { buildCutoverPreparation } from './prepare-staging-cutover.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const projectRef = 'abcdefghijklmnopqrst';

test('cutover preparation emits exact safe hashes without the raw project ref', () => {
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
    assert.equal(summary.migrationCount, 69);
    assert.equal(summary.migrationIds.at(-1), '20260726000070');
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
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
