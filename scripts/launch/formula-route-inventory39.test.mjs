import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as technicalContract from './contract.mjs';
import {
  baselinePaths,
  buildFeatureInventory,
  buildTaskGraph,
  stableJson,
} from './execution-baseline.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const parent = '92f62f60e47237dd1f06750d8f7d9d2006b82617';
const oldHash = '620d798e86c2fd0f8adb810cac1b11eaa3a1d9551f14db474454bb49f6148178';
const newHash = '166193bb73f389565aa141848546ee56e6f76967c0fdee3086dcc935772cf8a3';
const inventoryPath = baselinePaths.featureInventory;
const row = {
  id: 'route:shelf/formula-history.tsx',
  category: 'route',
  source: 'apps/mobile/src/app/shelf/formula-history.tsx',
  featureIds: ['F-03', 'F-04'],
  readiness: 'needs-device-verification',
};
const sha = (body) => createHash('sha256').update(body).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root });
const originalRaw = git('show', `${parent}:${inventoryPath}`);
assert.equal(sha(originalRaw), oldHash);
const original = JSON.parse(originalRaw);
const expected = structuredClone(original);
expected.categoryCounts.route = 94;
expected.items.push(row);
expected.items.sort((left, right) => left.id.localeCompare(right.id));

function assertProjection(value) {
  assert.equal(Number.isInteger(value.categoryCounts.route), true);
  assert.equal(value.categoryCounts.route, 94);
  assert.deepEqual(value.items.filter((entry) => entry.id === row.id), [row]);
  assert.deepEqual(value, expected);
}

test('unchanged pure builder and canonical bytes equal the externally pinned exact projection', async () => {
  assert.equal(original.categoryCounts.route, 93);
  assert.equal(original.items.some((entry) => entry.id === row.id), false);
  const calculated = buildFeatureInventory();
  assertProjection(calculated);
  const computedRaw = Buffer.from(await stableJson(calculated));
  assert.equal(sha(computedRaw), newHash);
  assert.deepEqual(computedRaw, Buffer.from(await stableJson(expected)));
  assert.equal(sha(readFileSync(resolve(root, inventoryPath))), sha(computedRaw));
  assert.deepEqual(calculated.items.map(({ id }) => id),
    calculated.items.map(({ id }) => id).sort((left, right) => left.localeCompare(right)));
  const reversed = structuredClone(calculated);
  reversed.items.reverse();
  assert.throws(() => assertProjection(reversed));
});

test('route omissions, duplicates, wrong mapping/path, admissions and stale/excess counts refuse', () => {
  const mutations = [
    (v) => { v.items = v.items.filter((entry) => entry.id !== row.id); },
    (v) => { v.items.push(structuredClone(row)); },
    ...[['F-18'], ['J05'], ['F-03'], ['F-04'], ['F-04', 'F-03'], ['F-03', 'F-04', 'F-18']]
      .map((ids) => (v) => { v.items.find((entry) => entry.id === row.id).featureIds = ids; }),
    ...['implemented', 'admitted', 'launch-blocked'].map((readiness) =>
      (v) => { v.items.find((entry) => entry.id === row.id).readiness = readiness; }),
    (v) => { v.items.find((entry) => entry.id === row.id).source = 'apps/mobile/src/app/shelf/history.tsx'; },
    (v) => { v.items.find((entry) => entry.id === row.id).ownerAdmitted = true; },
    ...[93, 95, true, '94', 94.5].map((count) => (v) => { v.categoryCounts.route = count; }),
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(expected);
    mutate(changed);
    assert.throws(() => assertProjection(changed));
  }
  assert.throws(() => assertProjection(original));
});

test('every unrelated member/field, feature flag, readiness and grouped surface stays identical', () => {
  let negatives = 0;
  function leaves(value, path = []) {
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, item]) => leaves(item, [...path, key]));
    }
    return [path];
  }
  for (const path of leaves(expected)) {
    if (path.join('.') === 'categoryCounts.route') continue;
    if (path[0] === 'items' && expected.items[path[1]].id === row.id) continue;
    const changed = structuredClone(expected);
    let target = changed;
    for (const key of path.slice(0, -1)) target = target[key];
    const key = path.at(-1);
    target[key] = typeof target[key] === 'boolean' ? !target[key] :
      typeof target[key] === 'number' ? target[key] + 1 : `${target[key]}-tampered`;
    assert.throws(() => assertProjection(changed), path.join('.'));
    negatives++;
  }
  assert.ok(negatives > 2000, `expected complete field coverage, got ${negatives}`);
  for (const key of Object.keys(expected)) {
    const omitted = structuredClone(expected);
    delete omitted[key];
    assert.throws(() => assertProjection(omitted), `omitted ${key}`);
    const extended = structuredClone(expected);
    extended[key] = Array.isArray(extended[key]) ? [...extended[key], 'unrelated addition'] :
      { ...extended[key], unauthorized: true };
    assert.throws(() => assertProjection(extended), `extended ${key}`);
  }
});

test('other default-producer outputs and preserved static guards retain exact committed bytes', async () => {
  for (const [path, build] of [
    [baselinePaths.taskGraph, buildTaskGraph],
  ]) {
    const computed = Buffer.from(await stableJson(build()));
    const committed = git('show', `${parent}:${path}`);
    assert.equal(sha(computed), sha(committed), path);
    assert.equal(sha(readFileSync(resolve(root, path))), sha(committed), path);
  }
  // The unchanged default producer preserves an existing execution-status.json.
  // Its optional --reset-status output is not an authorized Campaign39 write.
  for (const path of [baselinePaths.executionStatus, baselinePaths.launchContract, baselinePaths.credentials,
    baselinePaths.evidenceGovernance, baselinePaths.worktreeBoundary,
    'scripts/launch/contract.mjs', 'scripts/launch/execution-baseline.mjs',
    'scripts/launch/build-execution-baseline.mjs', 'scripts/launch/validate-execution-baseline.mjs',
    'scripts/launch/execution-baseline-smoke.mjs', 'scripts/launch/candidate-scope34.mjs']) {
    assert.equal(sha(readFileSync(resolve(root, path))), sha(git('show', `${parent}:${path}`)), path);
  }
});

test('all default Lean V1 exports and snapshots retain original technical meanings', async () => {
  const before = git('show', '4ca36e915608460a1ed97d7fff94a3ece61296ab:scripts/launch/contract.mjs');
  const original = await import(`data:text/javascript;base64,${before.toString('base64')}`);
  const actual = technicalContract.loadLaunchContract(root);
  const expectedContract = original.loadLaunchContract(root);
  assert.deepEqual(actual, expectedContract);
  assert.deepEqual(technicalContract.validateLaunchContract(actual), original.validateLaunchContract(expectedContract));
  assert.deepEqual(technicalContract.launchContractSnapshot(actual), original.launchContractSnapshot(expectedContract));
  for (const [name, value] of Object.entries(original)) {
    if (typeof value !== 'function') assert.deepEqual(technicalContract[name], value, name);
  }
  assert.deepEqual(technicalContract.REQUIRED_FEATURE_IDS, [1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(technicalContract.DEFERRED_FEATURE_IDS, [4, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(technicalContract.REQUIRED_SURFACE_KEYS, []);
  assert.equal(actual.evidenceLevels.length, 7);
  assert.equal(technicalContract.launchContractSnapshot(actual).releaseMode, 'lean-v1');
  assert.deepEqual(technicalContract.requiredReleasePlatforms(actual), original.requiredReleasePlatforms(expectedContract));
  for (const platform of ['ios', 'android', 'web', 'unknown']) {
    assert.equal(technicalContract.isReleasePlatformRequired(platform, actual), original.isReleasePlatformRequired(platform, expectedContract));
    assert.deepEqual(technicalContract.platformRequirementStatus(platform, actual), original.platformRequirementStatus(platform, expectedContract));
    for (const passed of [true, false]) {
      assert.deepEqual(technicalContract.platformEvidenceStatus(platform, passed, actual), original.platformEvidenceStatus(platform, passed, expectedContract));
    }
  }
  for (const id of [...Array.from({ length: 20 }, (_, i) => i + 1), 'J01', 'F18', 'shelf_intake', 'catalog']) {
    assert.equal(technicalContract.isFeatureRequired(id, actual), original.isFeatureRequired(id, expectedContract));
  }
  for (const surface of [...expected.gatedSurfaces.flatMap(({ surfaceKeys }) => surfaceKeys), 'unknown']) {
    assert.equal(technicalContract.isSurfaceRequired(surface, actual), original.isSurfaceRequired(surface, expectedContract));
  }
});
