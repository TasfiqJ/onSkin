import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { auditIosPrivacySource, canonicalAuditJson } from './ios-privacy-contract.mjs';
import { IOS_PRIVACY_LOCK_SUCCESSION23_PATH, checkCurrentAuditSnapshot23, nativeTree23 } from './ios-privacy-lock-succession23.mjs';

const REPO = resolve(import.meta.dirname, '../..');
const WITNESS_BYTES = readFileSync(join(REPO, IOS_PRIVACY_LOCK_SUCCESSION23_PATH));
const WITNESS = JSON.parse(WITNESS_BYTES);
const LOCK_BYTES = readFileSync(join(REPO, 'package-lock.json'));
const writeJson = (path, value) => writeFileSync(path, canonicalAuditJson(value));

function currentFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-native23-'));
  t.after(() => {
    assert.match(relative(resolve(tmpdir()), root), /^layerwell-native23-[^\\/]+$/);
    rmSync(root, { recursive: true, force: true });
  });
  const old = JSON.parse(readFileSync(join(REPO, 'docs/phase-9/ios-sdk-lock-succession13.v1.json')));
  for (const tree of WITNESS.installedNativeTrees) {
    cpSync(join(REPO, tree.path), join(root, tree.path), { recursive: true, dereference: false });
  }
  const paths = new Set([IOS_PRIVACY_LOCK_SUCCESSION23_PATH, 'package-lock.json',
    ...WITNESS.immutableInputs.map((pin) => pin.path), ...WITNESS.sourcePins.map((pin) => pin.path),
    ...WITNESS.mandatoryPatchInputs.map((pin) => pin.path), WITNESS.mobilePackage.path,
    old.dependencyWitness.path, old.provenance.path,
    ...old.registry.flatMap((row) => [row.metadata.path, row.attestations.path])]);
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), readFileSync(join(REPO, path)));
  }
  return root;
}

function refusal(root) {
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'source_invalid');
  assert.ok(report.errors.length > 0);
  assert.ok(Object.values(report.claims).every((value) => value === false));
  return report;
}

test('current23 fixture proves its exact two-node complete-lock delta and installed native denominators', (t) => {
  const root = currentFixture(t);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.ok(report.inputs.lockSuccession23);
  assert.equal(report.inputs.lockSuccession13, undefined);
  assert.ok(Object.values(report.claims).every((value) => value === false));
  assert.deepEqual(WITNESS.changedNodes, ['', 'node_modules/node-forge']);
  assert.equal(WITNESS.installedNativeTrees.length, 3);
  assert.ok(WITNESS.installedNativeTrees.every((tree) => tree.files > 0 && tree.directories > 0 && tree.bytes > 0));
  // This bounded fixture is deliberately not labelled as the complete installed audit.
  assert.throws(() => checkCurrentAuditSnapshot23(report, WITNESS_BYTES), /SNAPSHOT_DRIFT/);
});

test('current23 refuses complete-lock changes, native transitive changes, missing and extra nodes', (t) => {
  const root = currentFixture(t);
  const path = join(root, 'package-lock.json');
  const mutations = [
    (lock) => { lock.packages[''].devDependencies['node-forge'] = '1.4.0'; },
    (lock) => { lock.packages['node_modules/node-forge'].integrity = 'forged'; },
    ...Object.keys(WITNESS.unchangedNativeNodes).flatMap((name) => [
      (lock) => { lock.packages[name].version = '0.0.0'; },
      (lock) => { lock.packages[name].dependencies = { forged: '1.0.0' }; },
    ]),
    (lock) => { lock.packages['node_modules/extra23'] = { version: '1.0.0' }; },
    (lock) => { delete lock.packages['node_modules/react-native']; },
  ];
  for (const mutate of mutations) {
    const lock = JSON.parse(LOCK_BYTES);
    mutate(lock);
    writeJson(path, lock);
    refusal(root);
  }
  writeFileSync(path, LOCK_BYTES);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current23 refuses stale/forged/missing witness, every admission flag, duplicate keys and traversal', (t) => {
  const root = currentFixture(t);
  const path = join(root, IOS_PRIVACY_LOCK_SUCCESSION23_PATH);
  const mutations = [
    (w) => { w.base.commit = '0'.repeat(40); },
    (w) => { w.immutableInputs[1].sha256 = '0'.repeat(64); },
    (w) => { w.sourcePins[0].path = '../outside'; },
    (w) => { w.sourcePins[0].path = '/outside'; },
    (w) => { w.currentAuditSnapshot.sha256 = '0'.repeat(64); },
    (w) => { w.installedNativeTrees[0].files -= 1; },
    ...Object.keys(WITNESS.admissions).map((key) => (w) => { w.admissions[key] = true; }),
    ...Object.keys(WITNESS.claims).map((key) => (w) => { w.claims[key] = !w.claims[key]; }),
    (w) => { w.gates.G97 = 'PASS'; },
    (w) => { w.spendUsd = 1; },
  ];
  for (const mutate of mutations) {
    const witness = structuredClone(WITNESS); mutate(witness); writeJson(path, witness);
    refusal(root);
  }
  writeFileSync(path, WITNESS_BYTES.toString().replace('"schemaVersion": 1,', '"schemaVersion": 1,"schemaVersion": 1,'));
  refusal(root);
  writeFileSync(path, WITNESS_BYTES);
  renameSync(path, `${path}.missing`);
  refusal(root);
  renameSync(`${path}.missing`, path);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current23 refuses missing/changed native files, omitted directories, aliases and actual contained links', (t) => {
  const root = currentFixture(t);
  const file = join(root, 'node_modules/@expo/ui/ios/ExpoUI.podspec');
  const bytes = readFileSync(file);
  writeFileSync(file, Buffer.concat([bytes, Buffer.from('\n')]));
  refusal(root); writeFileSync(file, bytes);
  renameSync(file, `${file}.missing`); refusal(root); renameSync(`${file}.missing`, file);
  const directory = join(root, 'node_modules/@expo/ui/ios');
  renameSync(directory, `${directory}.missing`); refusal(root); renameSync(`${directory}.missing`, directory);
  const base = join(root, 'node_modules/@expo/ui');
  mkdirSync(join(base, 'K23')); mkdirSync(join(base, 'Ｋ23'));
  refusal(root); rmSync(join(base, 'K23'), { recursive: true }); rmSync(join(base, 'Ｋ23'), { recursive: true });
  const link = join(base, 'native-link23');
  symlinkSync(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
  refusal(root); rmSync(link);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current23 bounds actual directory enumeration before any child content read', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-native23-'));
  t.after(() => {
    assert.match(relative(resolve(tmpdir()), root), /^layerwell-native23-[^\\/]+$/);
    rmSync(root, { recursive: true, force: true });
  });
  const tree = join(root, 'tree'); mkdirSync(tree);
  // This is a real oversized directory, not a supplied count or a reader mock.
  for (let index = 0; index < 20000; index += 1) {
    writeFileSync(join(tree, `entry-${String(index).padStart(5, '0')}`), Buffer.alloc(0));
  }
  let pathChecks = 0;
  let contentReads = 0;
  assert.throws(() => nativeTree23(root, 'tree', {
    checkedPath: () => { pathChecks += 1; return { absolute: tree }; },
    readBoundedFile: () => { contentReads += 1; throw new Error('CHILD_CONTENT_MUST_NOT_BE_READ'); },
    reject: (message) => { throw new Error(message); },
  }), /exceeds its bounds/);
  assert.equal(pathChecks, 1);
  assert.equal(contentReads, 0);
});
