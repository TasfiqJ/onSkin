import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { auditIosPrivacySource, validateIosPrivacyAuditClaims } from '../phase9/ios-privacy-contract.mjs';
import { IOS_PRIVACY_LOCK_SUCCESSION23_PATH, checkCurrentAuditSnapshot23 } from '../phase9/ios-privacy-lock-succession23.mjs';
import { validateIosExtensionConfig, validateIosExtensionConfig23 } from '../phase5/ios-extension-contract.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'apps/mobile/package.json')));
const packageLock = JSON.parse(readFileSync(resolve(ROOT, 'package-lock.json')));

test('actual current checkout audits installed native source and exact successor snapshot with all claims false', () => {
  const report = auditIosPrivacySource({ root: ROOT });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.ok(report.summary.nativePackageCount > 0);
  assert.ok(report.summary.privacyManifestCount > 0);
  assert.equal(report.inputs.lockSuccession13, undefined);
  assert.equal(checkCurrentAuditSnapshot23(report, readFileSync(resolve(ROOT, IOS_PRIVACY_LOCK_SUCCESSION23_PATH))), true);
  assert.equal(validateIosPrivacyAuditClaims(report), true);
  const forged = structuredClone(report); forged.claims.archiveInspected = true;
  assert.throws(() => validateIosPrivacyAuditClaims(forged), /must remain false/);
  assert.throws(() => checkCurrentAuditSnapshot23(forged, readFileSync(resolve(ROOT, IOS_PRIVACY_LOCK_SUCCESSION23_PATH))), /SNAPSHOT_DRIFT/);
});

test('actual current CLI enforces current source snapshot while preserving historical reports and mandatory patches', () => {
  const historicalPaths = ['docs/phase-9/generated/ios-privacy-source-audit.json',
    'docs/phase-9/generated/ios-privacy-source-audit.md'];
  const historicalBytes = historicalPaths.map((path) => readFileSync(resolve(ROOT, path)));
  for (const argv of [
    ['scripts/phase9/ios-privacy-source-audit.mjs', '--strict', '--check'],
    ['scripts/postinstall.mjs', '--check'],
  ]) {
    const probe = spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    assert.equal(probe.status, 0, probe.stderr);
  }
  for (const argv of [
    ['scripts/phase9/ios-privacy-source-audit.mjs', '--strict', '--write'],
    ['scripts/phase9/ios-privacy-source-audit.mjs', '--strict', '--check',
      '--json', 'docs/phase-9/generated/missing-current23.json',
      '--markdown', 'docs/phase-9/generated/missing-current23.md'],
  ]) {
    const probe = spawnSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    assert.equal(probe.status, 1);
  }
  historicalPaths.forEach((path, index) => assert.deepEqual(readFileSync(resolve(ROOT, path)), historicalBytes[index]));
});

test('current widget compatibility authenticates real source; historical validator and config refusals remain', () => {
  const configProbe = spawnSync(process.execPath,
    ['scripts/phase5/resolve-ios-extension-config.mjs', 'development'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert.equal(configProbe.status, 0, configProbe.stderr);
  const config = JSON.parse(configProbe.stdout);
  const input = { root: ROOT, config, packageJson, packageLock, variant: 'development' };
  const historical = validateIosExtensionConfig(input);
  assert.equal(historical.errors.length, 6);
  assert.equal(historical.identity, null);
  const current = validateIosExtensionConfig23(input);
  assert.deepEqual(current.errors, []);
  assert.ok(current.identity);
  assert.equal(current.sourceCompatibility.sourceOnly, true);
  assert.equal(current.sourceCompatibility.nativeAccepted, false);
  const malformed = structuredClone(input);
  malformed.config.extra.eas.build.experimental.ios.appExtensions[0].entitlements['aps-environment'] = 'production';
  const refused = validateIosExtensionConfig23(malformed);
  assert.equal(refused.identity, null);
  assert.ok(refused.errors.some((value) => value.includes('entitlements')));
  const wrongLock = structuredClone(input);
  wrongLock.packageLock.packages['node_modules/@expo/ui'].version = '57.0.25';
  assert.equal(validateIosExtensionConfig23(wrongLock).identity, null);
});

test('actual current non-strict default write refuses tampered and missing witnesses without historical overwrite', (t) => {
  const witness = resolve(ROOT, IOS_PRIVACY_LOCK_SUCCESSION23_PATH);
  const witnessBytes = readFileSync(witness);
  const witnessStat = statSync(witness, { bigint: true });
  const historical = ['docs/phase-9/generated/ios-privacy-source-audit.json',
    'docs/phase-9/generated/ios-privacy-source-audit.md'].map((path) => ({
    path: resolve(ROOT, path), bytes: readFileSync(resolve(ROOT, path)),
    stat: statSync(resolve(ROOT, path), { bigint: true }),
  }));
  const directory = mkdtempSync(join(tmpdir(), 'layerwell-native23-write-'));
  t.after(() => {
    assert.match(relative(resolve(tmpdir()), directory), /^layerwell-native23-write-[^\\/]+$/);
    rmSync(directory, { recursive: true, force: true });
  });
  const backup = join(directory, 'original-witness.json');
  const status = () => {
    const result = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0);
    return result.stdout;
  };
  const baselineStatus = status();
  const cli = (args) => spawnSync(process.execPath,
    ['scripts/phase9/ios-privacy-source-audit.mjs', ...args],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  const positive = () => {
    const result = cli(['--strict', '--check']);
    assert.equal(result.status, 0, 'The actual restored current source snapshot must pass.');
    return result.status;
  };
  const unchanged = () => {
    assert.deepEqual(readFileSync(witness), witnessBytes);
    const actual = statSync(witness, { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(actual[key], witnessStat[key]);
    for (const record of historical) {
      assert.deepEqual(readFileSync(record.path), record.bytes);
      const current = statSync(record.path, { bigint: true });
      for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(current[key], record.stat[key]);
    }
    assert.equal(status(), baselineStatus);
  };
  const initial = positive();
  const controls = [];
  for (const state of ['tampered', 'missing']) {
    renameSync(witness, backup);
    try {
      if (state === 'tampered') writeFileSync(witness, '{"schemaVersion":false}\n');
      const refused = cli(['--write']);
      assert.equal(refused.status, 1);
      assert.equal(refused.stdout, '');
      assert.equal(refused.stderr.trim(), 'CURRENT_NATIVE_SOURCE23_HISTORICAL_OUTPUTS_READ_ONLY');
      controls.push({ state, exits: [initial, refused.status] });
    } finally {
      if (state === 'tampered') rmSync(witness);
      renameSync(backup, witness);
    }
    unchanged();
    controls.at(-1).exits.push(positive());
  }
  unchanged();
  t.diagnostic(JSON.stringify({ qualification: 'ACTUAL_CURRENT_NATIVE_CLI_SOURCE_ONLY', controls,
    exactWitnessRestoration: true, historicalOutputsUnchanged: true,
    cleanBefore: baselineStatus === '', cleanAfter: status() === '', acceptanceGranted: false }));
});
