import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCandidateLaunchScope34, loadLaunchContract, launchContractSnapshot, REQUIRED_FEATURE_IDS,
  DEFERRED_FEATURE_IDS, isFeatureRequired, REQUIRED_SURFACE_KEYS } from './contract.mjs';
import { buildCandidateExecutionObligations34, buildExecutionStatus, buildTaskGraph, buildFeatureInventory } from './execution-baseline.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const base = '4ca36e915608460a1ed97d7fff94a3ece61296ab';
test('new named contract and baseline entry points use the same independent read-only candidate', () => {
  const planning = loadCandidateLaunchScope34(root);
  const verification = buildCandidateExecutionObligations34();
  assert.equal(planning.mode, 'planning');
  assert.equal(verification.mode, 'verification');
  assert.deepEqual(planning.requiredIds, verification.requiredIds);
  assert.deepEqual(planning.provenance, verification.provenance);
  assert.equal(planning.requiredRows, 38);
  assert.equal(verification.deferredRows, 27);
  for (const value of [planning, verification]) {
    assert.equal(value.release, 'NO_GO');
    assert.equal(value.acceptanceGranted, false);
    assert.equal(value.candidateReady, false);
    assert.equal(value.externalReady, false);
  }
  assert.throws(() => loadCandidateLaunchScope34(root, 'runtime'), /R34_READ_MODE/);
  assert.throws(() => buildCandidateExecutionObligations34(root, 'release'), /R34_READ_MODE/);
});

test('all existing contract exports retain their default technical meanings', async () => {
  const before = execFileSync('git', ['show', base + ':scripts/launch/contract.mjs'], { cwd: root });
  const original = await import('data:text/javascript;base64,' + before.toString('base64'));
  const actual = loadLaunchContract(root);
  const expected = original.loadLaunchContract(root);
  assert.deepEqual(actual, expected);
  assert.deepEqual(launchContractSnapshot(actual), original.launchContractSnapshot(expected));
  assert.deepEqual(REQUIRED_FEATURE_IDS, [1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(DEFERRED_FEATURE_IDS, [4, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(REQUIRED_SURFACE_KEYS, []);
  assert.equal(isFeatureRequired('J01', actual), false);
  assert.equal(isFeatureRequired(18, actual), false);
  assert.equal(actual.evidenceLevels.length, 7);
  assert.equal(launchContractSnapshot(actual).releaseMode, 'lean-v1');
});

test('opt-in reading does not write existing status, graph, provenance or runtime config', () => {
  const paths = ['apps/mobile/app.config.js', 'docs/hugeToDo/execution-status.json',
    'docs/hugeToDo/task-graph.json', 'docs/hugeToDo/feature-inventory.json',
    'scripts/launch/governed-evidence-chain.mjs'];
  const before = paths.map((p) => readFileSync(resolve(root, p)));
  const status = buildExecutionStatus(); const graph = buildTaskGraph(); const inventory = buildFeatureInventory();
  loadCandidateLaunchScope34(root); buildCandidateExecutionObligations34(root);
  assert.deepEqual(buildExecutionStatus(), status);
  assert.deepEqual(buildTaskGraph(), graph);
  assert.deepEqual(buildFeatureInventory(), inventory);
  paths.forEach((p, i) => assert.deepEqual(readFileSync(resolve(root, p)), before[i]));
  for (const p of ['apps/mobile/app.config.js', 'scripts/launch/governed-evidence-chain.mjs'])
    assert.deepEqual(readFileSync(resolve(root, p)), execFileSync('git', ['show', base + ':' + p], { cwd: root }));
});
