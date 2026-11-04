import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync,
  statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import test from 'node:test';
import { auditIosPrivacySource, canonicalAuditJson, proveCurrentNativeSource46,
  validateIosPrivacyAuditClaims } from './ios-privacy-contract.mjs';
import { nativeTree23 } from './ios-privacy-lock-succession23.mjs';
import { IOS_PRIVACY_LOCK_SUCCESSION46_PATH, LOCK_SUCCESSION46_SHA256,
  checkedNativeRoot46, checkCurrentAuditSnapshot46, nativeSourceIdentity46,
  readNativeFile46, verifyNativeCandidate46, assertCurrentNativeHead46, checkWindowsReparse } from './ios-privacy-lock-succession46.mjs';
import { validateIosExtensionConfig } from '../phase5/ios-extension-contract.mjs';
import { validateIosExtensionConfig46 } from '../release/full-app-j01/native_current46.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const WITNESS_BYTES = readFileSync(join(ROOT, IOS_PRIVACY_LOCK_SUCCESSION46_PATH));
const WITNESS = JSON.parse(WITNESS_BYTES);
const LOCK_BYTES = readFileSync(join(ROOT, 'package-lock.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (path, value) => writeFileSync(path, canonicalAuditJson(value));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-native46-'));
  t.after(() => {
    assert.match(relative(resolve(tmpdir()), root), /^layerwell-native46-[^\\/]+$/);
    rmSync(root, { recursive: true, force: true });
  });
  for (const tree of WITNESS.installedNativeTrees) {
    cpSync(join(ROOT, tree.path), join(root, tree.path), { recursive: true, dereference: false });
  }
  const paths = new Set([IOS_PRIVACY_LOCK_SUCCESSION46_PATH, 'package-lock.json',
    'scripts/phase9/ios-privacy-lock-succession46.mjs',
    ...WITNESS.unchangedInputs.filter(pin => pin.status !== 'ABSENT').map(pin => pin.path),
    ...WITNESS.currentSourceInputs.map(pin => pin.path), WITNESS.rootPackage.path]);
  const old = JSON.parse(readFileSync(join(ROOT, 'docs/phase-9/ios-sdk-lock-succession13.v1.json')));
  for (const pin of [old.dependencyWitness, old.provenance,
    ...old.registry.flatMap(row => [row.metadata, row.attestations])]) paths.add(pin.path);
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), readFileSync(join(ROOT, path)));
  }
  // Share only authenticated, read-only Git object/ref discovery. No original
  // index, object, ref or worktree file is written by fixture operations.
  const git = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert.equal(git.status, 0);
  writeFileSync(join(root, '.git'), `gitdir: ${git.stdout.trim()}\n`);
  return root;
}

function refused(root) {
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'source_invalid');
  assert.ok(report.errors.length > 0);
  assert.ok(Object.values(report.claims).every(value => value === false));
  return report;
}

test('current46 actual checkout proves complete current audit, finite transition and false admissions', () => {
  const proof = verifyNativeCandidate46(ROOT);
  assert.equal(proof.file.sha256, LOCK_SUCCESSION46_SHA256);
  assert.equal(WITNESS.status, 'NATIVE_LOCK_SUCCESSOR_SOURCE_CANDIDATE_REVIEW_REQUIRED');
  assert.equal(WITNESS.changedNodes.length, 12);
  assert.equal(proof.trees.length, 3);
  assert.equal(proof.trees.reduce((sum, tree) => sum + tree.files, 0), 1559);
  const { report } = proveCurrentNativeSource46(ROOT);
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.ok(report.summary.nativePackageCount > 0);
  assert.ok(report.summary.privacyManifestCount > 0);
  assert.equal(report.inputs.lockSuccession13, undefined);
  assert.equal(report.inputs.lockSuccession23, undefined);
  assert.ok(Object.values(report.claims).every(value => value === false));
  assert.ok(Object.values(WITNESS.admissions).every(value => value === false));
  assert.equal(validateIosPrivacyAuditClaims(report), true);
  assert.equal(checkCurrentAuditSnapshot46(report, WITNESS_BYTES), true);
});

test('current46 bounded fixture proves exact transition and refuses using it as complete installed receipt', t => {
  const root = fixture(t);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required', JSON.stringify(report.errors));
  assert.deepEqual(report.errors, []);
  assert.ok(report.inputs.lockSuccession46);
  assert.equal(report.inputs.lockSuccession23, undefined);
  assert.equal(report.inputs.lockSuccession13, undefined);
  assert.ok(Object.values(report.claims).every(value => value === false));
  assert.throws(() => checkCurrentAuditSnapshot46(report, WITNESS_BYTES), /SNAPSHOT_DRIFT/u);
});

test('current46 refuses every native node, integrity, thirteenth node, ordering and complete-lock drift', t => {
  const root = fixture(t);
  const path = join(root, 'package-lock.json');
  const mutations = [
    lock => { lock.packages[''].devDependencies['node-forge'] = '1.4.0'; },
    lock => { lock.packages['node_modules/node-forge'].integrity = 'forged'; },
    ...Object.keys(WITNESS.unchangedNativeNodes).flatMap(name => [
      lock => { lock.packages[name].version = '0.0.0'; },
      lock => { lock.packages[name].dependencies = { forged: '1.0.0' }; },
      lock => { lock.packages[name].integrity = 'sha512-forged'; },
      lock => { lock.packages[name].resolved = 'https://untrusted.invalid/native.tgz'; },
    ]),
    lock => { lock.packages['node_modules/extra46'] = { version: '1.0.0' }; },
    lock => { delete lock.packages['node_modules/react-native']; },
    lock => { delete lock.packages['packages/decode-uri-component-compat']; },
    lock => { lock.packages = Object.fromEntries(Object.entries(lock.packages).reverse()); },
  ];
  for (const mutate of mutations) {
    const lock = JSON.parse(LOCK_BYTES); mutate(lock); writeJson(path, lock); refused(root);
  }
  writeFileSync(path, Buffer.concat([LOCK_BYTES, Buffer.from(' ')])); refused(root);
  writeFileSync(path, LOCK_BYTES);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current46 refuses wrong authority owner base head, all admission fields, omitted scope and forged witness', t => {
  const root = fixture(t);
  const path = join(root, IOS_PRIVACY_LOCK_SUCCESSION46_PATH);
  const mutations = [
    w => { w.authority = 'forged'; }, w => { w.repository = 'attacker/onSkin'; },
    w => { w.acceptedBase.commit = '0'.repeat(40); }, w => { w.acceptedBase.tree = '0'.repeat(40); },
    w => { w.predecessor.commit = '0'.repeat(40); }, w => { w.predecessor.tree = '0'.repeat(40); },
    w => { w.acceptedBase.lockSHA256 = '0'.repeat(64); }, w => { w.predecessor.lockSHA256 = '0'.repeat(64); },
    w => { w.predecessor.rootPackageSHA256 = '0'.repeat(64); }, w => { w.originalC23Profile.witnessSHA256 = '0'.repeat(64); },
    w => { w.unchangedInputs[1].sha256 = '0'.repeat(64); },
    w => { w.currentSourceInputs[0].path = '../outside'; },
    w => { w.currentSourceInputs[0].path = '/outside'; },
    w => { w.currentAuditSnapshot.sha256 = '0'.repeat(64); },
    w => { w.installedNativeTrees[0].files -= 1; },
    w => { w.unchangedInputs.pop(); }, w => { w.changedNodes.pop(); },
    ...Object.keys(WITNESS.admissions).map(key => w => { w.admissions[key] = true; }),
    ...Object.keys(WITNESS.claims).map(key => w => { w.claims[key] = !w.claims[key]; }),
    w => { w.gates.G97 = 'PASS'; }, w => { w.gates.M1_03 = 'ACCEPTED'; },
    w => { w.spendUsd = 1; }, w => { w.release = 'GO'; },
  ];
  for (const mutate of mutations) {
    const witness = structuredClone(WITNESS); mutate(witness); writeJson(path, witness); refused(root);
  }
  for (const invalid of [WITNESS_BYTES.toString().replace('"schemaVersion": 1,', '"schemaVersion": 1,"schemaVersion": 1,'), '{}', `${WITNESS_BYTES} `]) {
    writeFileSync(path, invalid); refused(root);
  }
  writeFileSync(path, WITNESS_BYTES); renameSync(path, `${path}.missing`); refused(root);
  renameSync(`${path}.missing`, path);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current46 refuses changed missing extra native files, omitted directories, aliases, links and hardlinks', t => {
  const root = fixture(t);
  const path = join(root, 'node_modules/@expo/ui/ios/ExpoUI.podspec');
  const bytes = readFileSync(path);
  writeFileSync(path, Buffer.concat([bytes, Buffer.from('\n')])); refused(root); writeFileSync(path, bytes);
  renameSync(path, `${path}.missing`); refused(root); renameSync(`${path}.missing`, path);
  const directory = dirname(path);
  renameSync(directory, `${directory}.missing`); refused(root); renameSync(`${directory}.missing`, directory);
  const base = join(root, 'node_modules/@expo/ui');
  const extra = join(base, 'Native46.swift'); writeFileSync(extra, 'extra native input'); refused(root); unlinkSync(extra);
  mkdirSync(join(base, 'K46')); mkdirSync(join(base, 'Ｋ46')); refused(root);
  rmSync(join(base, 'K46'), { recursive: true }); rmSync(join(base, 'Ｋ46'), { recursive: true });
  const linked = join(base, 'linked-native46');
  symlinkSync(directory, linked, process.platform === 'win32' ? 'junction' : 'dir'); refused(root); unlinkSync(linked);
  const hardlink = join(base, 'hardlinked-native46'); linkSync(path, hardlink); refused(root); unlinkSync(hardlink);
  const patch = join(root, WITNESS.mandatoryPatchPaths[0]); const originalPatch = readFileSync(patch);
  writeFileSync(patch, Buffer.concat([originalPatch, Buffer.from('\n')])); refused(root); writeFileSync(patch, originalPatch);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current46 retains the original actual enumeration ceiling before child content reads', t => {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-native46-'));
  t.after(() => { assert.match(relative(resolve(tmpdir()), root), /^layerwell-native46-[^\\/]+$/); rmSync(root, { recursive: true, force: true }); });
  const tree = join(root, 'tree'); mkdirSync(tree);
  for (let index = 0; index < 20000; index += 1) writeFileSync(join(tree, `entry-${String(index).padStart(5, '0')}`), Buffer.alloc(0));
  let paths = 0; let reads = 0;
  assert.throws(() => nativeTree23(root, 'tree', {
    checkedPath: () => { paths += 1; return { absolute: tree }; },
    readBoundedFile: () => { reads += 1; throw new Error('CHILD_CONTENT_MUST_NOT_BE_READ'); },
    reject: message => { throw new Error(message); },
  }), /exceeds its bounds/u);
  assert.equal(paths, 1); assert.equal(reads, 0);
  if (process.platform === 'win32') {
    assert.throws(() => checkWindowsReparse([tree], [tree]), /WINDOWS_REPARSE_BOUND/u);
  }
});

test('current46 refuses actual unrelated HEAD and ancestor junction rather than trusting source booleans', t => {
  const root = fixture(t);
  const git = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-path', 'objects'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert.equal(git.status, 0);
  unlinkSync(join(root, '.git')); mkdirSync(join(root, '.git/objects/info'), { recursive: true });
  mkdirSync(join(root, '.git/refs/heads'), { recursive: true });
  writeFileSync(join(root, '.git/objects/info/alternates'), `${git.stdout.trim()}\n`);
  writeFileSync(join(root, '.git/HEAD'), 'ref: refs/heads/wrong-source\n');
  writeFileSync(join(root, '.git/refs/heads/wrong-source'), `${WITNESS.acceptedBase.commit}\n`);
  writeFileSync(join(root, '.git/config'), '[core]\nrepositoryformatversion = 0\nbare = false\n[remote "origin"]\nurl = https://github.com/TasfiqJ/onSkin.git\n');
  assert.throws(() => nativeSourceIdentity46(checkedNativeRoot46(root)), /GIT_SOURCE_IDENTITY|HEAD_LINEAGE/u);
  refused(root);
  writeFileSync(join(root, '.git/refs/heads/wrong-source'), `${WITNESS.predecessor.commit}\n`);
  writeFileSync(join(root, '.git/config'), '[core]\nrepositoryformatversion = 0\nbare = false\n[remote "origin"]\nurl = https://github.com/attacker/onSkin.git\n');
  assert.throws(() => nativeSourceIdentity46(checkedNativeRoot46(root)), /REPOSITORY_OWNER/u);
  const parent = mkdtempSync(join(tmpdir(), 'layerwell-native46-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const actual = join(parent, 'actual'); mkdirSync(join(actual, 'child'), { recursive: true });
  const linked = join(parent, 'linked'); symlinkSync(actual, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => checkedNativeRoot46(join(linked, 'child')), /LINK|REPARSE/u);
});

test('current46 actual CLI checks current receipt, preserves historical bytes and refuses default writes', () => {
  const paths = ['docs/phase-9/generated/ios-privacy-source-audit.json', 'docs/phase-9/generated/ios-privacy-source-audit.md'];
  const originals = paths.map(path => ({ bytes: readFileSync(join(ROOT, path)), stat: statSync(join(ROOT, path), { bigint: true }) }));
  const cli = args => spawnSync(process.execPath, ['scripts/phase9/ios-privacy-source-audit.mjs', ...args],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const positive = cli(['--strict', '--check']); assert.equal(positive.status, 0, positive.stderr);
  const patches = spawnSync(process.execPath, ['scripts/postinstall.mjs', '--check'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert.equal(patches.status, 0, patches.stderr);
  assert.equal(cli(['--strict', '--write']).status, 1);
  assert.equal(cli(['--strict', '--check', '--json', 'docs/phase-9/generated/missing-current46.json',
    '--markdown', 'docs/phase-9/generated/missing-current46.md']).status, 1);
  paths.forEach((path, index) => {
    assert.deepEqual(readFileSync(join(ROOT, path)), originals[index].bytes);
    const now = statSync(join(ROOT, path), { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(now[key], originals[index].stat[key]);
  });
});

test('current46 widget proof preserves historical six dependency refusals and every current config assertion', () => {
  const probe = spawnSync(process.execPath, ['scripts/phase5/resolve-ios-extension-config.mjs', 'development'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(probe.status, 0, probe.stderr);
  const input = { root: ROOT, config: JSON.parse(probe.stdout),
    packageJson: JSON.parse(readFileSync(join(ROOT, 'apps/mobile/package.json'))), packageLock: JSON.parse(LOCK_BYTES), variant: 'development' };
  assert.equal(validateIosExtensionConfig(input).errors.length, 6);
  assert.equal(validateIosExtensionConfig(input).identity, null);
  const current = validateIosExtensionConfig46(input); assert.deepEqual(current.errors, []); assert.ok(current.identity);
  assert.equal(current.sourceCompatibility.sourceOnly, true); assert.equal(current.sourceCompatibility.nativeAccepted, false);
  for (const mutate of [
    v => { v.config.ios.supportsTablet = true; }, v => { v.config.scheme = 'wrong-identity'; },
    v => { v.config.extra.eas.build.experimental.ios.appExtensions[0].entitlements['aps-environment'] = 'production'; },
    v => { v.packageLock.packages['node_modules/@expo/ui'].version = '57.0.25'; },
    v => { v.packageJson.dependencies['expo-widgets'] = '99.0.0'; },
  ]) { const value = structuredClone(input); mutate(value); const result = validateIosExtensionConfig46(value); assert.equal(result.identity, null); assert.ok(result.errors.length); }
});

test('current46 rejects forged audit, omitted scope and stale pre-repair receipts', () => {
  const { report } = proveCurrentNativeSource46(ROOT);
  for (const mutate of [
    v => { v.claims.archiveInspected = true; }, v => { delete v.scope.releaseArchiveAudited; },
    v => { v.inputs.packageLock.sha256 = WITNESS.acceptedBase.lockSHA256; },
    v => { v.inputs.lockSuccession23 = v.inputs.lockSuccession46; delete v.inputs.lockSuccession46; },
    v => { v.summary.nativePackageCount -= 1; }, v => { v.nativePackages.pop(); },
  ]) { const value = structuredClone(report); mutate(value); assert.throws(() => checkCurrentAuditSnapshot46(value, WITNESS_BYTES), /SNAPSHOT_DRIFT|AUDIT_INVALID/u); }
  const forged = structuredClone(report); forged.claims.archiveInspected = true;
  assert.throws(() => validateIosPrivacyAuditClaims(forged), /must remain false/u);
  const stale = JSON.parse(readFileSync(join(ROOT, 'docs/phase-9/generated/ios-privacy-source-audit.json')));
  assert.throws(() => checkCurrentAuditSnapshot46(stale, WITNESS_BYTES), /AUDIT_INVALID/u);
  assert.equal(hash(WITNESS_BYTES), LOCK_SUCCESSION46_SHA256);
});

test('current46 actual non-strict tampered and missing descriptor writes preserve original inode and historical outputs', t => {
  const witness = join(ROOT, IOS_PRIVACY_LOCK_SUCCESSION46_PATH);
  const before = statSync(witness, { bigint: true });
  const parent = resolve(ROOT, '..'); const directory = mkdtempSync(join(parent, 'layerwell-native46-write-'));
  t.after(() => { assert.match(relative(parent, directory), /^layerwell-native46-write-[^\\/]+$/); rmSync(directory, { recursive: true, force: true }); });
  assert.equal(statSync(directory, { bigint: true }).dev, before.dev);
  const backup = join(directory, 'original.json');
  const historical = ['docs/phase-9/generated/ios-privacy-source-audit.json', 'docs/phase-9/generated/ios-privacy-source-audit.md']
    .map(path => ({ path: join(ROOT, path), bytes: readFileSync(join(ROOT, path)), stat: statSync(join(ROOT, path), { bigint: true }) }));
  const cli = args => spawnSync(process.execPath, ['scripts/phase9/ios-privacy-source-audit.mjs', ...args],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const positive = () => { const result = cli(['--strict', '--check']); assert.equal(result.status, 0, result.stderr); };
  const status = () => {
    const result = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0); return result.stdout;
  };
  const baselineStatus = status();
  positive();
  for (const state of ['tampered', 'missing']) {
    renameSync(witness, backup);
    try {
      if (state === 'tampered') writeFileSync(witness, '{"schemaVersion":false}\n');
      const result = cli(['--write']); assert.equal(result.status, 1); assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim(), 'CURRENT_NATIVE_SOURCE46_HISTORICAL_OUTPUTS_READ_ONLY');
    } finally { if (state === 'tampered') rmSync(witness); renameSync(backup, witness); }
    assert.deepEqual(readFileSync(witness), WITNESS_BYTES);
    const restored = statSync(witness, { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(restored[key], before[key]);
    for (const record of historical) {
      assert.deepEqual(readFileSync(record.path), record.bytes);
      const now = statSync(record.path, { bigint: true });
      for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(now[key], record.stat[key]);
    }
    positive();
    assert.equal(status(), baselineStatus);
  }
  assert.equal(status(), baselineStatus);
});

test('current46 final entrypoint authenticates expected HEAD and committed critical bytes', t => {
  const identity = assertCurrentNativeHead46(ROOT);
  assert.ok(identity.committedCriticalInputs > 0);
  assert.equal(assertCurrentNativeHead46(ROOT, identity.sourceHead).sourceHead, identity.sourceHead);
  for (const stale of ['0'.repeat(40), WITNESS.acceptedBase.commit, 'main']) {
    assert.throws(() => assertCurrentNativeHead46(ROOT, stale), /EXPECTED_HEAD/u);
  }
  const wrongExpected = spawnSync(process.execPath, ['scripts/release/full-app-j01/native_current46.mjs'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30_000,
      env: { ...process.env, C46_EXPECTED_HEAD: '0'.repeat(40) } });
  assert.equal(wrongExpected.status, 1); assert.match(wrongExpected.stderr, /EXPECTED_HEAD/u);
  const root = fixture(t);
  assert.equal(assertCurrentNativeHead46(root, identity.sourceHead).sourceHead, identity.sourceHead);
  // Reader itself is excluded from the descriptor's self-hash domain, but the
  // final entrypoint must compare its exact body with the real Git HEAD blob.
  const reader = join(root, 'scripts/phase9/ios-privacy-lock-succession46.mjs');
  mkdirSync(dirname(reader), { recursive: true });
  writeFileSync(reader, Buffer.concat([readFileSync(join(ROOT, 'scripts/phase9/ios-privacy-lock-succession46.mjs')), Buffer.from('\n')]));
  assert.throws(() => assertCurrentNativeHead46(root, identity.sourceHead), /COMMITTED_INPUT_DRIFT/u);
});

test('current46 real concurrent native-file mutation is detected before accepting read bytes', async t => {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-native46-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'Native.swift'); writeFileSync(file, Buffer.alloc(8 * 1024 * 1024, 65));
  const port = new Int32Array(new SharedArrayBuffer(8));
  const worker = new Worker(`const {workerData}=require('node:worker_threads');const fs=require('node:fs');const port=new Int32Array(workerData.port);const data=Buffer.alloc(8*1024*1024,66);const fd=fs.openSync(workerData.file,'r+');try{while(!Atomics.load(port,1)){fs.writeSync(fd,data,0,data.length,0);Atomics.store(port,0,1);Atomics.notify(port,0);}}finally{fs.closeSync(fd);}`, { eval: true, workerData: { file, port: port.buffer } });
  try {
    for (let attempt = 0; attempt < 30 && !Atomics.load(port, 0); attempt += 1) Atomics.wait(port, 0, 0, 1000);
    assert.equal(Atomics.load(port, 0), 1, 'The real filesystem race worker must start within its finite bound.');
    const checked = checkedNativeRoot46(root); let refusals = 0;
    for (let attempt = 0; attempt < 100 && refusals === 0; attempt += 1) {
      try { readNativeFile46(checked, 'Native.swift'); }
      catch (error) { assert.match(String(error), /RACE/u); refusals += 1; }
    }
    assert.ok(refusals > 0, 'A real overlapping write must never be accepted as a stable native input.');
  } finally { Atomics.store(port, 1, 1); await worker.terminate(); }
});

test('current46 parity inventory retains every original ninety executable obligation', () => {
  const parity = JSON.parse(readFileSync(join(ROOT, 'scripts/phase9/ios-native-obligations46.json')));
  assert.equal(parity.originalTests, 90); assert.equal(parity.cases.length, 90);
  assert.equal(new Set(parity.cases.map(row => row.id)).size, 90);
  assert.ok(parity.cases.every(row => row.currentInvocation && row.assertions.length > 0));
  assert.equal(parity.cases.filter(row => row.execution === 'UNCHANGED_CURRENT').length, 81);
  assert.equal(parity.cases.filter(row => row.execution === 'CURRENT46_SUCCESSOR').length, 9);
  for (const program of parity.originalPrograms) assert.equal(hash(readFileSync(join(ROOT, program.path))), program.sha256);
});
