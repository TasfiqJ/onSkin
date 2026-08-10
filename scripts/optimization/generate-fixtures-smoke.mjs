import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createOptimizationFixture, fixtureDocument } from './generate-fixtures.mjs';

const first = fixtureDocument('stress');
const second = fixtureDocument('stress');
assert.deepEqual(first, second);
assert.equal(first.manifest.counts.shelf, 750);
assert.equal(first.manifest.counts.completions, 730);
assert.equal(first.manifest.counts.photos, 250);
assert.equal(first.manifest.counts.outbox, 1000);
assert.equal(first.manifest.counts.exportRows, 1205);
assert.equal(first.data.metadata.containsImageBytes, false);
assert.doesNotMatch(JSON.stringify(first), /base64|data:image|file:\/\//i);
assert.throws(() => createOptimizationFixture('unknown'), /Unknown fixture scale/);

const directory = await mkdtemp(join(tmpdir(), 'layerwell-optimization-fixtures-'));
try {
  const output = join(directory, 'empty.json');
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./generate-fixtures.mjs', import.meta.url)),
      '--scale',
      'empty',
      '--output',
      output,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const written = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(written.manifest.scale, 'empty');
  assert.deepEqual(written.manifest.counts, {
    shelf: 0,
    completions: 0,
    photos: 0,
    outbox: 0,
    askMessages: 0,
    exportRows: 0,
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('Optimization fixture smoke tests passed.');
