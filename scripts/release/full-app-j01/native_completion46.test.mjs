import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { LOCK_DELTA46, proveNativeCompletion46, validateNativeWidget46,
  verifyLockDelta46, verifyNativeTree46 } from './native_completion46.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('actual current lock has exactly the approved twelve-node security delta and reverses to accepted parent', () => {
  const original = spawnSync('git', ['--no-replace-objects', 'show',
    '20c761fa5e3fbf427fb33ab319218bd0c1d022bd:package-lock.json'], { cwd: root, windowsHide: true });
  assert.equal(original.status, 0);
  const current = readFileSync(join(root, 'package-lock.json'));
  assert.deepEqual(verifyLockDelta46(original.stdout, current).changed, LOCK_DELTA46);
  for (const tamper of [
    (value) => { value.packages['node_modules/expo-widgets'].version = '99.0.0'; },
    (value) => { delete value.packages['packages/decode-uri-component-compat']; },
    (value) => { value.packages['node_modules/undeclared'] = { version: '1.0.0' }; },
  ]) {
    const changed = JSON.parse(current);
    tamper(changed);
    assert.throws(() => verifyLockDelta46(original.stdout, Buffer.from(`${JSON.stringify(changed, null, 2)}\n`)), /LOCK_IDENTITY/u);
  }
  assert.throws(() => verifyLockDelta46(Buffer.from('untrusted parent'), current), /LOCK_IDENTITY/u);
});

test('native source inventory rejects changed, extra, missing, linked and escaping content against a fixed denominator', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'c46-native-denominator-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const native = join(directory, 'node_modules', 'synthetic-native');
  mkdirSync(native, { recursive: true });
  const file = join(native, 'Native.swift');
  const content = Buffer.from('fixed native source\n');
  writeFileSync(file, content);
  const path = 'node_modules/synthetic-native';
  const rows = [{ path, kind: 'directory' },
    { path: `${path}/Native.swift`, kind: 'file', bytes: content.length, sha256: hash(content) }];
  const expected = { path, files: 1, directories: 1, bytes: content.length,
    sha256: hash(Buffer.from(`${JSON.stringify(rows, null, 2)}\n`)) };
  assert.deepEqual(verifyNativeTree46(directory, expected), expected);
  writeFileSync(file, Buffer.from('other native source\n'));
  assert.throws(() => verifyNativeTree46(directory, expected), /TREE_DENOMINATOR/u);
  writeFileSync(file, content);
  const extra = join(native, 'unexpected.swift');
  writeFileSync(extra, content);
  assert.throws(() => verifyNativeTree46(directory, expected), /TREE_DENOMINATOR/u);
  unlinkSync(extra);
  unlinkSync(file);
  assert.throws(() => verifyNativeTree46(directory, expected), /TREE_DENOMINATOR/u);
  const outside = join(directory, 'outside.swift');
  writeFileSync(outside, content);
  linkSync(outside, file);
  assert.throws(() => verifyNativeTree46(directory, expected), /C46_NATIVE_FILE/u);
  unlinkSync(file);
  writeFileSync(file, content);
  const linked = join(native, 'linked-directory');
  symlinkSync(directory, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => verifyNativeTree46(directory, expected), /C46_NATIVE_LINK/u);
  unlinkSync(linked);
  assert.deepEqual(verifyNativeTree46(directory, expected), expected);
  assert.throws(() => verifyNativeTree46(directory, { ...expected, path: '../outside' }), /C46_NATIVE_PATH/u);
});

test('current actual installed native proof precedes unchanged pure config assertions and never grants acceptance', () => {
  const proof = proveNativeCompletion46(root);
  assert.equal(proof.status, 'C46_NATIVE_SOURCE_TECHNICAL_ONLY');
  assert.equal(proof.installedNativeTrees.length, 3);
  assert.equal(proof.installedNativeTrees.reduce((sum, tree) => sum + tree.files, 0), 1559);
  assert.equal(proof.nativeAccepted, false);
  assert.equal(proof.archiveInspected, false);
  assert.equal(proof.acceptanceGranted, false);
  assert.equal(proof.publicReleaseAuthorized, false);
  assert.equal(proof.release, 'NO_GO');
  const packageJson = JSON.parse(readFileSync(join(root, 'apps/mobile/package.json')));
  const packageLock = JSON.parse(readFileSync(join(root, 'package-lock.json')));
  const result = spawnSync(process.execPath, ['scripts/phase5/resolve-ios-extension-config.mjs', 'development'],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0);
  const config = JSON.parse(result.stdout);
  const input = { config, packageJson, packageLock, variant: 'development' };
  assert.deepEqual(validateNativeWidget46(proof, input).errors, []);
  assert.throws(() => validateNativeWidget46({ ...proof }, input), /PROOF_REQUIRED/u);
  const alteredPackage = structuredClone(packageJson);
  alteredPackage.dependencies['expo-widgets'] = '99.0.0';
  assert.throws(() => validateNativeWidget46(proof, { ...input, packageJson: alteredPackage }), /CONFIG_INPUT_DRIFT/u);
  const alteredLock = structuredClone(packageLock);
  alteredLock.packages['node_modules/expo-widgets'].integrity = 'untrusted';
  assert.throws(() => validateNativeWidget46(proof, { ...input, packageLock: alteredLock }), /CONFIG_INPUT_DRIFT/u);
  for (const tamper of [
    (value) => { value.ios.supportsTablet = true; },
    (value) => { value.scheme = 'wrong-source-scheme'; },
    (value) => { value.extra.eas.build.experimental.ios.appExtensions[0].entitlements['aps-environment'] = 'production'; },
    (value) => { value.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-widgets')[1].enablePushNotifications = true; },
  ]) {
    const changed = structuredClone(config);
    tamper(changed);
    assert.ok(validateNativeWidget46(proof, { ...input, config: changed }).errors.length > 0);
  }
});
