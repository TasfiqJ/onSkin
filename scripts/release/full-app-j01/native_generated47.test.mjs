import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, renameSync, statSync, symlinkSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, truncateSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { dirname, join, relative, resolve } from 'node:path';
import test, { beforeEach, afterEach } from 'node:test';

// END records hook completion, never a test PASS; TAP remains authoritative.
beforeEach(t => { writeSync(2, JSON.stringify({ event: 'C47_SOURCE_CASE_BEGIN', name: t.name, utc: new Date().toISOString() }) + '\n'); });
afterEach(t => { writeSync(2, JSON.stringify({ event: 'C47_SOURCE_CASE_END', name: t.name, utc: new Date().toISOString() }) + '\n'); });
import { DESCRIPTOR47, MAP47, strictJson47, validateDescriptor47, validateMapping47,
  validateAutolinking47, validateResolvedLock47, readSourceProof47,
  validateDevelopmentProjection47, validateOutput47, SOURCE_PATHS47, SWIFT_SUCCESSION47, validateSwiftSuccession47,
  CONSENT_DOC04, validateConsentDoc04, currentPrivacyProjection47, STORAGE_ORIGIN05,
  CONSENT_APP04, validateConsentApp04, firstLegacySourcePin04, SELECTIVE_CLEANUP05, validateSelectiveCleanup05, SELECTIVE_CLEANUP_TEST05, validateSelectiveCleanupTest05,
  auditCurrentNative47 as auditIosPrivacySource, proveCurrentNativeSource47 as proveCurrentNativeSource46,
  verifyCurrentNative47 as verifyNativeCandidate46, validateIosExtensionConfig47 as validateIosExtensionConfig46 } from './native_generated47.mjs';


import { canonicalAuditJson, validateIosPrivacyAuditClaims,
  auditIosPrivacySource as legacyAuditIosPrivacySource } from '../../phase9/ios-privacy-contract.mjs';
import { nativeTree23 } from '../../phase9/ios-privacy-lock-succession23.mjs';
import { IOS_PRIVACY_LOCK_SUCCESSION46_PATH, LOCK_SUCCESSION46_SHA256,
  checkedNativeRoot46, checkCurrentAuditSnapshot46, nativeSourceIdentity46,
  readNativeFile46, assertCurrentNativeHead46, checkWindowsReparse } from '../../phase9/ios-privacy-lock-succession46.mjs';
import { validateIosExtensionConfig } from '../../phase5/ios-extension-contract.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const descriptor = () => strictJson47(readFileSync(resolve(ROOT, DESCRIPTOR47)));
const map = () => strictJson47(readFileSync(resolve(ROOT, MAP47)));
const predecessor = () => strictJson47(readFileSync(resolve(ROOT, 'scripts/phase9/ios-native-obligations46.json')));

test('current47 descriptor is finite generated-only successor with every admission false', () => {
  assert.equal(validateDescriptor47(descriptor()), true);
  assert.equal(STORAGE_ORIGIN05.authority, 'BRAIN-C47-STORAGE-ROOT-CAUSE-RUNTIME-05');
  assert.deepEqual(SOURCE_PATHS47.filter(path => STORAGE_ORIGIN05.sourcePaths.includes(path)), STORAGE_ORIGIN05.sourcePaths);
  assert.equal(STORAGE_ORIGIN05.sourcePaths.length, 3);
  // New current source is independently pinned; the historical202 witness remains exact.
  assert.equal(SOURCE_PATHS47.length, 40);
  const photo07 = ['scripts/photo07/photo07-source-contract.mjs', 'scripts/photo07/photo07-source-contract.test.mjs'];
  assert.deepEqual(SOURCE_PATHS47.filter(path => path.startsWith('scripts/photo07/')), photo07);
  for (const path of photo07) {
    const missing = descriptor(); missing.sourcePins = missing.sourcePins.filter(pin => pin.path !== path);
    assert.throws(() => validateDescriptor47(missing));
    const wildcard = descriptor(); wildcard.sourcePins.find(pin => pin.path === path).path = 'scripts/photo07/**';
    assert.throws(() => validateDescriptor47(wildcard));
  }
  assert.ok(SOURCE_PATHS47.includes('apps/mobile/src/lib/storage/privateKVBoundaryRead39.test.ts'));
  const oldCleanup = spawnSync('git', ['--no-replace-objects', 'show',
    SELECTIVE_CLEANUP05.checkpointHead + ':' + SELECTIVE_CLEANUP05.path],
    { cwd: ROOT, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(oldCleanup.status, 0);
  const currentCleanup = readFileSync(resolve(ROOT, SELECTIVE_CLEANUP05.path));
  const currentCleanupPin = descriptor().sourcePins.find(row => row.path === SELECTIVE_CLEANUP05.path);
  const cleanupBeforePin = { path: SELECTIVE_CLEANUP05.path, ...SELECTIVE_CLEANUP05.before };
  const cleanupProof = validateSelectiveCleanup05(cleanupBeforePin, oldCleanup.stdout, currentCleanup, currentCleanupPin);
  assert.deepEqual(cleanupProof.before, SELECTIVE_CLEANUP05.before);
  assert.deepEqual(cleanupProof.after, { bytes: currentCleanupPin.bytes, sha256: currentCleanupPin.sha256 });
  const wrongCleanupBefore = Buffer.from(oldCleanup.stdout); wrongCleanupBefore[0] ^= 1;
  const wrongCleanupAfter = Buffer.from(currentCleanup); wrongCleanupAfter[0] ^= 1;
  for (const args of [[cleanupBeforePin, wrongCleanupBefore, currentCleanup, currentCleanupPin],
    [cleanupBeforePin, oldCleanup.stdout, wrongCleanupAfter, currentCleanupPin],
    [{ ...cleanupBeforePin, path: 'apps/mobile/src/unrelated.ts' }, oldCleanup.stdout, currentCleanup, currentCleanupPin],
    [cleanupBeforePin, oldCleanup.stdout, currentCleanup, { ...currentCleanupPin, sha256: '0'.repeat(64) }],
    [cleanupBeforePin, oldCleanup.stdout, currentCleanup, { ...currentCleanupPin, path: 'apps/mobile/src/unrelated.ts' }]]) {
    assert.throws(() => validateSelectiveCleanup05(...args));
  }

  // The owned mock-adapter successor is a separate existing202 test input.
  const oldCleanupTest = spawnSync('git', ['--no-replace-objects', 'show',
    SELECTIVE_CLEANUP_TEST05.checkpointHead + ':' + SELECTIVE_CLEANUP_TEST05.path],
    { cwd: ROOT, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(oldCleanupTest.status, 0);
  const currentCleanupTest = readFileSync(resolve(ROOT, SELECTIVE_CLEANUP_TEST05.path));
  const currentCleanupTestPin = descriptor().sourcePins.find(row => row.path === SELECTIVE_CLEANUP_TEST05.path);
  const cleanupTestBeforePin = { path: SELECTIVE_CLEANUP_TEST05.path, ...SELECTIVE_CLEANUP_TEST05.before };
  const cleanupTestProof = validateSelectiveCleanupTest05(cleanupTestBeforePin, oldCleanupTest.stdout, currentCleanupTest, currentCleanupTestPin);
  assert.deepEqual(cleanupTestProof.before, SELECTIVE_CLEANUP_TEST05.before);
  assert.deepEqual(cleanupTestProof.after, { bytes: currentCleanupTestPin.bytes, sha256: currentCleanupTestPin.sha256 });
  const wrongCleanupTestBefore = Buffer.from(oldCleanupTest.stdout); wrongCleanupTestBefore[0] ^= 1;
  const wrongCleanupTestAfter = Buffer.from(currentCleanupTest); wrongCleanupTestAfter[0] ^= 1;
  for (const args of [[cleanupTestBeforePin, wrongCleanupTestBefore, currentCleanupTest, currentCleanupTestPin],
    [cleanupTestBeforePin, oldCleanupTest.stdout, wrongCleanupTestAfter, currentCleanupTestPin],
    [{ ...cleanupTestBeforePin, path: 'apps/mobile/src/unrelated.test.ts' }, oldCleanupTest.stdout, currentCleanupTest, currentCleanupTestPin],
    [cleanupTestBeforePin, oldCleanupTest.stdout, currentCleanupTest, { ...currentCleanupTestPin, sha256: '0'.repeat(64) }]]) {
    assert.throws(() => validateSelectiveCleanupTest05(...args));
  }
  const historical = spawnSync('git', ['--no-replace-objects', 'show',
    CONSENT_DOC04.checkpointHead + ':' + CONSENT_DOC04.path],
    { cwd: ROOT, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  assert.equal(historical.status, 0);
  const original = historical.stdout, actual = readFileSync(resolve(ROOT, CONSENT_DOC04.path));
  const pin = { path: CONSENT_DOC04.path, ...CONSENT_DOC04.before };
  assert.equal(validateConsentDoc04(pin, original, actual), true);
  const alteredPrefix = Buffer.from(original); alteredPrefix[0] ^= 1;
  const alteredAppend = Buffer.from(actual); alteredAppend[alteredAppend.length - 2] ^= 1;
  const alteredFirst04 = Buffer.from(actual); alteredFirst04[original.length + 10] ^= 1;
  for (const [declared, before, after] of [
    [pin, alteredPrefix, actual], [pin, original, alteredAppend],
    [pin, original, alteredFirst04],
    [pin, original, original], [{ ...pin, path: 'docs/OTHER.md' }, original, actual],
  ]) assert.throws(() => validateConsentDoc04(declared, before, after));
  // Historical and current legacy REDs are distinct; neither grants the other.
  const legacy = { status: 'source_invalid', summary: { errorCount: 4 }, inputs: {}, errors: [
    ...['@react-native-google-signin/google-signin', 'expo-image', 'react-native'].map(name => ({
      code: 'MAPPING_LOCK_DRIFT', path: 'docs/phase-9/ios-sdk-package-mapping.json#' + name,
      message: 'Mapping package-lock path/hash do not match current bytes.',
    })), { code: 'UNEXPECTED_AUDIT_ERROR', path: 'docs/phase-9/ios-sdk-lock-succession46.v1.json',
      message: 'CURRENT_NATIVE_SOURCE46_SOURCE_PIN:node_modules/expo-widgets/ios/LayerwellWidgetLifecycleStore.swift' },
  ] };
  assert.equal(currentPrivacyProjection47(legacy, Buffer.from('{}'), false).status, 'archive_required');
  assert.throws(() => currentPrivacyProjection47(legacy, Buffer.from('{}'), false, CONSENT_DOC04));
  legacy.errors[3].message = 'CURRENT_NATIVE_SOURCE46_SOURCE_PIN:' + CONSENT_DOC04.path;
  assert.throws(() => currentPrivacyProjection47(legacy, Buffer.from('{}'), false));
  assert.equal(currentPrivacyProjection47(legacy, Buffer.from('{}'), false, CONSENT_DOC04).status, 'archive_required');
  for (const row of CONSENT_APP04.sourceInputs) {
    const found = spawnSync('git', ['--no-replace-objects', 'show', CONSENT_APP04.checkpointHead + ':' + row.path],
      { cwd: ROOT, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    assert.equal(found.status, 0);
    const prior = found.stdout, current = readFileSync(resolve(ROOT, row.path));
    const declared = { path: row.path, ...row.before };
    assert.equal(validateConsentApp04(declared, prior, current), true);
    if (row.previousAfter) {
      assert.equal(row.path, 'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts');
      assert.equal(row.previousAfter.head, 'c36fecd16c605a49e06b599d89dae8a988a42939');
      const previous = spawnSync('git', ['--no-replace-objects', 'show', row.previousAfter.head + ':' + row.path],
        { cwd: ROOT, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
      assert.equal(previous.status, 0);
      assert.deepEqual({ bytes: previous.stdout.length, sha256: createHash('sha256').update(previous.stdout).digest('hex') },
        { bytes: row.previousAfter.bytes, sha256: row.previousAfter.sha256 });
      assert.throws(() => validateConsentApp04(declared, prior, previous.stdout));
    }
    const changed = Buffer.from(current); changed[0] ^= 1;
    const wrongPrior = Buffer.from(prior); wrongPrior[0] ^= 1;
    for (const args of [[declared, prior, prior], [declared, prior, changed],
      [declared, wrongPrior, current], [{ ...declared, path: 'apps/mobile/src/unrelated.ts' }, prior, current]]) {
      assert.throws(() => validateConsentApp04(...args));
    }
  }
  // Exact pre-readwindow witnesses remain historical, never current targets.
  for (const old of [{"path": "apps/mobile/src/features/healthConsent/lifecycle.ts", "head": "c36fecd16c605a49e06b599d89dae8a988a42939", "bytes": 52276, "sha256": "aa526292eee5164d13d5238ecd9e92f8493a231b308e63c21a376c234c453d00"}, {"path": "apps/mobile/src/features/healthConsent/lifecycle.test.ts", "head": "c36fecd16c605a49e06b599d89dae8a988a42939", "bytes": 53859, "sha256": "8db7b566311e5634058ebc38aa0522b1747280f70ef89c4e98f8ef371197ba4a"}, {"path": "apps/mobile/src/lib/auth/privateMutationRecovery46.test.ts", "head": "02aa4ba879fb844f3ca0aa929591203ee45f4163", "bytes": 17708, "sha256": "9d00f6586c1bb2e7f13c2197e8f8b8de6eeacd4b8d6fb95e31ad694bfab01f75"}]) {
    const before = spawnSync('git', ['--no-replace-objects', 'show', old.head + ':' + old.path],
      { cwd: ROOT, windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    assert.equal(before.status, 0);
    assert.deepEqual({ bytes: before.stdout.length, sha256: createHash('sha256').update(before.stdout).digest('hex') },
      { bytes: old.bytes, sha256: old.sha256 });
    const current = CONSENT_APP04.currentInputs.find(pin => pin.path === old.path);
    assert.ok(current);
    assert.notEqual(current.sha256, old.sha256);
    const stale = descriptor();
    Object.assign(stale.sourcePins.find(pin => pin.path === old.path), { bytes: old.bytes, sha256: old.sha256 });
    assert.throws(() => validateDescriptor47(stale));
  }
  const immutable = readFileSync(resolve(ROOT, 'docs/phase-9/ios-sdk-lock-succession46.v1.json'));
  const expectedPin = firstLegacySourcePin04(strictJson47(immutable));
  assert.equal(expectedPin, 'apps/mobile/src/app/(tabs)/you.tsx');
  const currentLegacy = structuredClone(legacy);
  currentLegacy.errors[3].message = 'CURRENT_NATIVE_SOURCE46_SOURCE_PIN:' + expectedPin;
  assert.throws(() => currentPrivacyProjection47(currentLegacy, immutable, false, CONSENT_DOC04));
  assert.throws(() => currentPrivacyProjection47(legacy, immutable, false, CONSENT_DOC04, CONSENT_APP04));
  assert.throws(() => currentPrivacyProjection47(currentLegacy, immutable, false, null, CONSENT_APP04));
  assert.equal(currentPrivacyProjection47(currentLegacy, immutable, false, CONSENT_DOC04, CONSENT_APP04).status, 'archive_required');
});

test('current47 rejects root default-subspec expansion, extra pod options, global scope and admission claims', () => {
  const changes = [
    value => value.storageOrigin05.sourcePaths.push('scripts/release/full-app-j01/unreviewed.py'),
    value => value.storageOrigin05.diagnosticOnly = false,
    value => value.storageOrigin05.normalProductReuseAllowed = true,
    value => value.storageOrigin05.privateStorageQueryChangesAllowed = true,
    value => value.storageOrigin05.ordinaryAdmission = true,
    value => value.storageOrigin05.internalAdmission = true,
    value => value.storageOrigin05.checkpointHead = '0'.repeat(40),
    value => value.sourcePins = value.sourcePins.filter(pin => pin.path !== STORAGE_ORIGIN05.sourcePaths[0]),
    value => value.generatedTransition.pods[0].name = 'GoogleUtilities',
    value => value.generatedTransition.pods[0].modular_headers = false,
    value => value.generatedTransition.pods[0].path = '../outside',
    value => value.generatedTransition.pods.push({ name: 'Other', modular_headers: true }),
    value => value.generatedTransition.beforeState = 'PRESENT',
    value => value.generatedTransition.scope = 'GLOBAL_MODULAR_HEADERS',
    value => value.admissions.native = true,
    value => value.claims.nativeAccepted = true,
    value => value.claims.physicalDeviceQualified = true,
    value => value.authorization = 'extra unreviewed authority',
    value => value.sourcePins.pop(),
    value => value.sourcePins.find(pin => pin.path === CONSENT_APP04.currentInputs[0].path).sha256 = '0'.repeat(64),
    value => value.sourcePins.find(pin => pin.path === CONSENT_APP04.sourceInputs[0].path).sha256 = '0'.repeat(64),
    value => value.sourcePins.push(structuredClone(value.sourcePins[0])),
    value => value.sourceBinding.externalCurrentSource47SealRequired = false,
    value => value.predecessor46.sha256 = '0'.repeat(64),
    value => value.simulatorSigning03.sdk = 'iphoneos',
    value => value.simulatorSigning03.prefix = 'REALTEAM00.',
    value => value.simulatorSigning03.bundles.push('com.foreign.app'),
    value => value.simulatorSigning03.profiles = true,
    value => value.simulatorSigning03.sharing = true,
    value => value.simulatorSigning03.appEntitlementsOnFrameworksOrTestHost = true,
    value => value.simulatorSigning03.appProcessSecureStoreRequired = false,
    value => value.simulatorSigning03.ordinaryWithoutDiagnosticRebuildRequired = false,
  ];
  for (const change of changes) {
    const value = descriptor();
    change(value);
    assert.throws(() => validateDescriptor47(value));
  }
});

test('every original90 row, assertion and current executable is retained exactly in current47 mapping', () => {
  assert.equal(validateMapping47(map(), predecessor()), true);
  for (const change of [value => value.cases.pop(), value => value.cases[0].assertions.pop(),
    value => value.cases[0].currentInvocation = 'true',
    value => value.cases[0].currentTest = 'unexecuted substitute',
    value => value.cases[0].current47.parentReceiptSubstitutionAllowed = true,
    value => value.cases[0].current47.predecessorCaseSHA256 = '0'.repeat(64),
    value => value.cases[0].current47.sourceGateRequired = false,
    value => value.cases[0].current47.generatedGateRequired = false]) {
    const value = map();
    change(value);
    assert.throws(() => validateMapping47(value, predecessor()));
  }
});

test('strict current descriptor reader rejects duplicates, malformed JSON and alias amplification', () => {
  for (const raw of ['{"release":"NO_GO","release":"GO"}', '{invalid', 'anchor: &a [*a]']) {
    assert.throws(() => strictJson47(Buffer.from(raw)));
  }
  assert.throws(() => strictJson47(Buffer.alloc(16 * 1024 * 1024 + 1)));
});

test('actual autolinking gate requires exact extraDependencies and retains both first-party native modules', () => {
  const value = { extraDependencies: [{ name: 'GoogleUtilities/Environment', modular_headers: true },
    { name: 'RecaptchaInterop', modular_headers: true }], modules: [
      { pods: [{ podName: 'NativeLabelOcr' }] }, { pods: [{ podName: 'NativeAgeAssurance' }] }] };
  assert.equal(validateAutolinking47(value), true);
  for (const change of [v => v.extraDependencies[0].name = 'GoogleUtilities',
    v => v.extraDependencies[1].modular_headers = false, v => v.modules.pop()]) {
    const altered = structuredClone(value);
    change(altered);
    assert.throws(() => validateAutolinking47(altered));
  }
});

test('resolved native gate retains existing transitive pods and rejects root default-subspec expansion', () => {
  const value = { PODS: ['GoogleUtilities/Environment (8.1.5)', 'GoogleUtilities/UserDefaults (8.1.5)',
    'RecaptchaInterop (101.0.0)', 'AppCheckCore (11.3.2)', 'NativeLabelOcr (1.0.0)'],
    DEPENDENCIES: ['GoogleUtilities/Environment', 'RecaptchaInterop'],
    'SPEC CHECKSUMS': { GoogleUtilities: 'a'.repeat(40), RecaptchaInterop: 'b'.repeat(40), AppCheckCore: 'c'.repeat(40) } };
  assert.equal(validateResolvedLock47(value).length, 5);
  for (const change of [v => v.PODS.push('GoogleUtilities/SwizzlerTestHelpers (8.1.5)'),
    v => v.PODS.pop(), v => v.DEPENDENCIES.push('GoogleUtilities'),
    v => v['SPEC CHECKSUMS'].AppCheckCore = 'invalid']) {
    const altered = structuredClone(value);
    change(altered);
    assert.throws(() => validateResolvedLock47(altered));
  }
});

test('source proof reader refuses oversized files before allocation and actual hardlinked evidence', t => {
  const directory = mkdtempSync(join(realpathSync(tmpdir()), 'c47-proof-bound-'));
  t.after(() => {
    assert.match(relative(realpathSync(tmpdir()), directory), /^c47-proof-bound-[^\\/]+$/);
    rmSync(directory, { recursive: true });
  });
  const path = join(directory, 'source.json');
  writeFileSync(path, '{}');
  assert.equal(readSourceProof47(path).toString(), '{}');
  truncateSync(path, 16 * 1024 * 1024 + 1);
  assert.throws(() => readSourceProof47(path));
  writeFileSync(path, '{}');
  linkSync(path, join(directory, 'second-link'));
  assert.throws(() => readSourceProof47(path));
  unlinkSync(join(directory, 'second-link'));
  assert.equal(readSourceProof47(path).toString(), '{}');
});

test('two explicit profiles retain source-bound declared target projection and refuse production or forged development input', () => {
  const transition = descriptor().generatedTransition;
  assert.equal(validateDevelopmentProjection47(transition), true);
  for (const change of [value => value.generatedTransition.allowedProfiles.push('production'),
    value => value.generatedTransition.developmentProjection.stagingPropertiesUTF8 += '\n',
    value => value.generatedTransition.developmentProjection.podfilePreimage.sha256 = '0'.repeat(64),
    value => value.generatedTransition.developmentProjection.provenance = 'OBSERVED_MACOS_BUILD']) {
    const value = descriptor();
    change(value);
    assert.throws(() => validateDescriptor47(value));
  }
});

test('installed Expo extra-pod consumer requires native command cwd rather than the app directory', t => {
  const temporaryRoot = realpathSync(tmpdir());
  const directory = mkdtempSync(join(temporaryRoot, 'c47-pod-cwd-'));
  t.after(() => {
    assert.match(relative(temporaryRoot, directory), /^c47-pod-cwd-[^\\/]+$/);
    rmSync(directory, { recursive: true });
  });
  const native = join(directory, 'ios');
  mkdirSync(native);
  const pods = [{ name: 'GoogleUtilities/Environment', modular_headers: true },
    { name: 'RecaptchaInterop', modular_headers: true }];
  writeFileSync(join(native, 'Podfile.properties.json'), JSON.stringify({ 'apple.extraPods': JSON.stringify(pods) }));
  const consumer = resolve(ROOT, 'node_modules/expo-modules-autolinking/build/autolinking/resolveModules.js');
  const code = "require(process.argv[1]).resolveExtraBuildDependenciesAsync({commandRoot:process.cwd(),platform:'apple'}).then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(e);process.exit(1)})";
  const run = cwd => {
    const result = spawnSync(process.execPath, ['-e', code, consumer], { cwd, windowsHide: true,
      encoding: 'utf8', timeout: 30000, maxBuffer: 65536 });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.deepEqual(run(directory), []);
  assert.deepEqual(run(native), pods);
});

test('current47 continuation02 refuses omitted third source, unrelated fourth change and stale generation', () => {
  assert.equal(validateSwiftSuccession47(structuredClone(SWIFT_SUCCESSION47)), true);
  for (const mutate of [v => v.sourceInputs.pop(), v => v.sourceInputs.push(structuredClone(v.sourceInputs[0])),
    v => v.installedFiles[0].after.sha256 = v.installedFiles[0].before.sha256,
    v => v.authority = 'parent-pass', v => v.admissions = true]) {
    const value = structuredClone(SWIFT_SUCCESSION47); mutate(value);
    assert.throws(() => validateSwiftSuccession47(value));
  }
});

test('current47 output refusal happens before any diagnostic write in source or an existing destination', t => {
  const directory = mkdtempSync(join(realpathSync(tmpdir()), 'c47-output-refusal-'));
  t.after(() => { assert.match(relative(realpathSync(tmpdir()), directory), /^c47-output-refusal-[^\\/]+$/); rmSync(directory, { recursive: true }); });
  const source = join(directory, 'source'); mkdirSync(source);
  const target = join(source, 'receipt.json');
  assert.throws(() => validateOutput47(target, source), /OUTPUT_OUTSIDE_SOURCE/);
  assert.equal(existsSync(target), false);
  assert.equal(existsSync(join(source, 'legacy46-audit-current47.json')), false);
  const existing = join(directory, 'existing.json'); writeFileSync(existing, 'original');
  assert.throws(() => validateOutput47(existing, source), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(existing, 'utf8'), 'original');
});

// CURRENT47 FULL NATIVE EQUIVALENTS: original assertion bodies retained; explicit current47 APIs/CLI.
const WITNESS_BYTES = readFileSync(join(ROOT, IOS_PRIVACY_LOCK_SUCCESSION46_PATH));
const WITNESS = JSON.parse(WITNESS_BYTES);
const LOCK_BYTES = readFileSync(join(ROOT, 'package-lock.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (path, value) => writeFileSync(path, canonicalAuditJson(value));

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'layerwell-native46-'));
  t.after(() => {
    assert.match(relative(realpathSync(tmpdir()), root), /^layerwell-native46-[^\\/]+$/);
    rmSync(root, { recursive: true, force: true });
  });
  for (const tree of WITNESS.installedNativeTrees) {
    cpSync(join(ROOT, tree.path), join(root, tree.path), { recursive: true, dereference: false });
  }
  const paths = new Set([DESCRIPTOR47, ...SOURCE_PATHS47, IOS_PRIVACY_LOCK_SUCCESSION46_PATH, 'package-lock.json',
    'scripts/phase9/ios-privacy-lock-succession46.mjs',
    ...WITNESS.unchangedInputs.filter(pin => pin.status !== 'ABSENT').map(pin => pin.path),
    ...WITNESS.currentSourceInputs.map(pin => pin.path), WITNESS.rootPackage.path]);
  const currentDescriptor = descriptor();
  for (const pin of currentDescriptor.registry) paths.add(pin.path + '/package.json');
  for (const pin of currentDescriptor.installedConsumers) paths.add(pin.path);
  const originalMap = predecessor();
  for (const pin of [...originalMap.originalPrograms, ...Object.values(originalMap.archiveAndConfig)]) {
    if (pin?.path && pin?.sha256) paths.add(pin.path);
  }
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

test('current47 continuation02 actual checkout proves complete current audit, finite transition and false admissions', () => {
  const proof = verifyNativeCandidate46(ROOT);
  assert.equal(proof.legacy46File.sha256, LOCK_SUCCESSION46_SHA256);
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

test('current47 continuation02 bounded fixture proves exact transition and refuses using it as complete installed receipt', t => {
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

test('current47 continuation02 refuses every native node, integrity, thirteenth node, ordering and complete-lock drift', t => {
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

test('current47 continuation02 refuses wrong authority owner base head, all admission fields, omitted scope and forged witness', t => {
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

test('current47 continuation02 refuses changed missing extra native files, omitted directories, aliases, links and hardlinks', t => {
  const root = fixture(t);
  const path = join(root, 'node_modules/@expo/ui/ios/ExpoUI.podspec');
  const bytes = readFileSync(path);
  writeFileSync(path, Buffer.concat([bytes, Buffer.from('\n')])); refused(root); writeFileSync(path, bytes);
  renameSync(path, `${path}.missing`); refused(root); renameSync(`${path}.missing`, path);
  const directory = dirname(path);
  renameSync(directory, `${directory}.missing`); refused(root); renameSync(`${directory}.missing`, directory);
  const base = join(root, 'node_modules/@expo/ui');
  const extra = join(base, 'Native46.swift'); writeFileSync(extra, 'extra native input'); refused(root); unlinkSync(extra);
  mkdirSync(join(base, 'K46')); mkdirSync(join(base, '\uFF2B46')); refused(root);
  rmSync(join(base, 'K46'), { recursive: true }); rmSync(join(base, '\uFF2B46'), { recursive: true });
  const linked = join(base, 'linked-native46');
  symlinkSync(directory, linked, process.platform === 'win32' ? 'junction' : 'dir'); refused(root); unlinkSync(linked);
  const hardlink = join(base, 'hardlinked-native46'); linkSync(path, hardlink); refused(root); unlinkSync(hardlink);
  const patch = join(root, WITNESS.mandatoryPatchPaths[0]); const originalPatch = readFileSync(patch);
  writeFileSync(patch, Buffer.concat([originalPatch, Buffer.from('\n')])); refused(root); writeFileSync(patch, originalPatch);
  assert.deepEqual(auditIosPrivacySource({ root }).errors, []);
});

test('current47 continuation02 retains the original actual enumeration ceiling before child content reads', t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'layerwell-native46-'));
  t.after(() => { assert.match(relative(realpathSync(tmpdir()), root), /^layerwell-native46-[^\\/]+$/); rmSync(root, { recursive: true, force: true }); });
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

test('current47 continuation02 refuses actual unrelated HEAD and ancestor junction rather than trusting source booleans', t => {
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
  const parent = mkdtempSync(join(realpathSync(tmpdir()), 'layerwell-native46-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const actual = join(parent, 'actual'); mkdirSync(join(actual, 'child'), { recursive: true });
  const linked = join(parent, 'linked'); symlinkSync(actual, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => checkedNativeRoot46(join(linked, 'child')), /LINK|REPARSE/u);
});

test('current47 continuation02 actual CLI checks current receipt, preserves historical bytes and refuses default writes', () => {
  const paths = ['docs/phase-9/generated/ios-privacy-source-audit.json', 'docs/phase-9/generated/ios-privacy-source-audit.md'];
  const originals = paths.map(path => ({ bytes: readFileSync(join(ROOT, path)), stat: statSync(join(ROOT, path), { bigint: true }) }));
  const cli = args => spawnSync(process.execPath, ['scripts/release/full-app-j01/native_generated47.mjs', '--native-audit47', ...args],
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

test('current47 continuation02 widget proof preserves historical six dependency refusals and every current config assertion', () => {
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

test('current47 continuation02 rejects forged audit, omitted scope and stale pre-repair receipts', () => {
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

test('current47 continuation02 actual non-strict tampered and missing descriptor writes preserve original inode and historical outputs', t => {
  const witness = join(ROOT, IOS_PRIVACY_LOCK_SUCCESSION46_PATH);
  const before = statSync(witness, { bigint: true });
  const parent = resolve(ROOT, '..'); const directory = mkdtempSync(join(parent, 'layerwell-native46-write-'));
  t.after(() => { assert.match(relative(parent, directory), /^layerwell-native46-write-[^\\/]+$/); rmSync(directory, { recursive: true, force: true }); });
  assert.equal(statSync(directory, { bigint: true }).dev, before.dev);
  const backup = join(directory, 'original.json');
  const oldInputs = ['package-lock.json', 'package.json'].map(name => {
    const path = join(ROOT, name);
    const old = spawnSync('git', ['--no-replace-objects', 'show', `${WITNESS.acceptedBase.commit}:${name}`],
      { cwd: ROOT, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(old.status, 0);
    assert.equal(hash(old.stdout), name === 'package-lock.json' ? WITNESS.acceptedBase.lockSHA256 : WITNESS.acceptedBase.rootPackageSHA256);
    return { name, path, old: old.stdout, bytes: readFileSync(path), stat: statSync(path, { bigint: true }), backup: join(directory, name) };
  });
  const historical = ['docs/phase-9/generated/ios-privacy-source-audit.json', 'docs/phase-9/generated/ios-privacy-source-audit.md']
    .map(path => ({ path: join(ROOT, path), bytes: readFileSync(join(ROOT, path)), stat: statSync(join(ROOT, path), { bigint: true }) }));
  const cli = args => spawnSync(process.execPath, ['scripts/release/full-app-j01/native_generated47.mjs', '--native-audit47', ...args],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const positive = () => { const result = cli(['--strict', '--check']); assert.equal(result.status, 0, result.stderr); };
  const status = () => {
    const result = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0); return result.stdout;
  };
  const baselineStatus = status();
  positive();
  for (const state of ['tampered', 'missing', 'old-profile']) {
    renameSync(witness, backup);
    const moved = [];
    try {
      if (state === 'tampered') writeFileSync(witness, '{"schemaVersion":false}\n');
      if (state === 'old-profile') {
        for (const item of oldInputs) {
          renameSync(item.path, item.backup); moved.push(item);
          assert.equal(hash(readFileSync(item.backup)), hash(item.bytes));
          writeFileSync(item.path, item.old);
        }
        assert.equal(lstatSync(join(ROOT, 'node_modules/decode-uri-component')).isSymbolicLink(), true);
        assert.throws(() => legacyAuditIosPrivacySource({ root: ROOT }), error =>
          error.code === 'PATH_SYMLINK' && error.path === 'node_modules/decode-uri-component',
        'The genuine current workspace link also prevents calling this an old-profile positive.');
        const sourceCheck = cli(['--strict', '--check']);
        assert.equal(sourceCheck.status, 1);
        assert.match(sourceCheck.stderr, /ios-sdk-lock-succession46\.v1\.json/u,
          'Current source validation must require its current witness, not fall back to the legacy link refusal.');
        const store = spawnSync(process.execPath, ['scripts/release/full-app-j01/native_generated47.mjs', '--native-store47', '--check'],
          { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
        assert.equal(store.status, 1);
        assert.match(store.stdout + store.stderr, /Installed iOS privacy source audit/u);
        assert.match(store.stdout + store.stderr, /ios-sdk-lock-succession46\.v1\.json/u);
        t.diagnostic(JSON.stringify({ state, legacyAudit: 'PATH_SYMLINK',
          legacyProfileSnapshotValidated: false, counterexamplePassManufactured: false,
          currentSourceExit: sourceCheck.status, currentStoreExit: store.status,
          currentWitnessMandatory: true, acceptanceGranted: false }));
      }
      const result = cli(['--write']); assert.equal(result.status, 1); assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim(), 'CURRENT_NATIVE_SOURCE46_HISTORICAL_OUTPUTS_READ_ONLY');
    } finally {
      for (const item of moved.reverse()) {
        assert.equal(hash(readFileSync(item.backup)), hash(item.bytes));
        if (existsSync(item.path)) rmSync(item.path);
        renameSync(item.backup, item.path);
      }
      if (state === 'tampered') rmSync(witness);
      renameSync(backup, witness);
    }
    assert.deepEqual(readFileSync(witness), WITNESS_BYTES);
    const restored = statSync(witness, { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(restored[key], before[key]);
    for (const record of historical) {
      assert.deepEqual(readFileSync(record.path), record.bytes);
      const now = statSync(record.path, { bigint: true });
      for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(now[key], record.stat[key]);
    }
    for (const item of oldInputs) {
      assert.deepEqual(readFileSync(item.path), item.bytes);
      const restored = statSync(item.path, { bigint: true });
      for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs']) assert.equal(restored[key], item.stat[key]);
    }
    positive();
    assert.equal(status(), baselineStatus);
  }
  assert.equal(status(), baselineStatus);
});

test('current47 continuation02 final entrypoint authenticates expected HEAD and committed critical bytes', t => {
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
  const wrongCurrent = spawnSync(process.execPath, ['scripts/release/full-app-j01/native_generated47.mjs', '--phase', 'SOURCE'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30_000,
      env: { ...process.env, C47_EXPECTED_HEAD: '0'.repeat(40) } });
  assert.equal(wrongCurrent.status, 1);
  assert.match(wrongCurrent.stderr, /0{40}/u);
  const root = fixture(t);
  assert.equal(assertCurrentNativeHead46(root, identity.sourceHead).sourceHead, identity.sourceHead);
  // Reader itself is excluded from the descriptor's self-hash domain, but the
  // final entrypoint must compare its exact body with the real Git HEAD blob.
  const reader = join(root, 'scripts/phase9/ios-privacy-lock-succession46.mjs');
  mkdirSync(dirname(reader), { recursive: true });
  writeFileSync(reader, Buffer.concat([readFileSync(join(ROOT, 'scripts/phase9/ios-privacy-lock-succession46.mjs')), Buffer.from('\n')]));
  assert.throws(() => assertCurrentNativeHead46(root, identity.sourceHead), /COMMITTED_INPUT_DRIFT/u);
});

test('current47 continuation02 real concurrent native-file mutation is detected before accepting read bytes', async t => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'layerwell-native46-'));
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

test('current47 continuation02 parity inventory retains every original ninety executable obligation', () => {
  const parity = JSON.parse(readFileSync(join(ROOT, 'scripts/phase9/ios-native-obligations46.json')));
  assert.equal(parity.originalTests, 90); assert.equal(parity.cases.length, 90);
  assert.equal(new Set(parity.cases.map(row => row.id)).size, 90);
  assert.ok(parity.cases.every(row => row.currentInvocation && row.assertions.length > 0));
  assert.equal(parity.cases.filter(row => row.execution === 'UNCHANGED_CURRENT').length, 81);
  assert.equal(parity.cases.filter(row => row.execution === 'CURRENT46_SUCCESSOR').length, 9);
  for (const program of parity.originalPrograms) assert.equal(hash(readFileSync(join(ROOT, program.path))), program.sha256);
});


import vm from 'node:vm';
import { auditVerificationWiring as originalReleaseWiringAudit47 } from '../../phase9/verification-wiring-contract.mjs';
import { projectReleaseInstallWorkflow47, auditReleaseInstallWiring47,
  RELEASE_INSTALL_STEP47_TEXT } from './native_generated47.mjs';

function releaseWiringFixture47() {
  const smoke = readFileSync(resolve(ROOT, 'scripts/phase9/release-smoke.mjs'), 'utf8');
  const literal = smoke.match(/const iosPrivacyVerifierDefinitions = (\{[\s\S]*?\n\});/u)?.[1];
  assert.ok(literal);
  return { packageJson: JSON.parse(readFileSync(resolve(ROOT, 'package.json'))),
    workflowText: readFileSync(resolve(ROOT, '.github/workflows/quality.yml'), 'utf8').replace(/\r\n/gu, '\n'),
    verifierDefinitions: JSON.parse(JSON.stringify(vm.runInNewContext('(' + literal + ')'))) };
}

test('current47 release wiring projects only the exact step and retains original direct refusal', () => {
  const options = releaseWiringFixture47();
  assert.equal(originalReleaseWiringAudit47(options).status, 'invalid');
  const projected = projectReleaseInstallWorkflow47(options.workflowText);
  assert.equal(originalReleaseWiringAudit47({ ...options, workflowText: projected }).status, 'pass');
  assert.equal(auditReleaseInstallWiring47(options, originalReleaseWiringAudit47).status, 'pass');
  const [before, after] = options.workflowText.split(RELEASE_INSTALL_STEP47_TEXT);
  assert.ok(projected.startsWith(before) && projected.endsWith(after));
  assert.throws(() => projectReleaseInstallWorkflow47(projected));
  assert.equal(auditReleaseInstallWiring47({ ...options, workflowText: projected },
    originalReleaseWiringAudit47).status, 'invalid');
});

test('current47 release wiring refuses every unreviewed step branch flag alias duplicate or omission', () => {
  const options = releaseWiringFixture47();
  const variants = [
    step => step.replace('stage/m1-native-runtime47', 'main'),
    step => step.replace('--native-audit47 --strict --check', '--native-audit47 --strict'),
    step => step.replace('--native-store47 --check', '--native-store47'),
    step => step.replace('npm run postinstall:check', 'npm run postinstall:check || true'),
    step => step.replace('        env:\n', '        if: false\n        env:\n'),
    step => step.replace('        env:\n', '        shell: bash\n        env:\n'),
    step => step.replace('        env:\n', '        env:\n          EXTRA: value\n'),
    step => step.replace('        env:\n', '        env:\n          CURRENT_SOURCE_BRANCH: other\n'),
    step => step.replace('        run: |\n', '        run: *unreviewed\n        ignored: |\n'),
    step => step + step,
    () => '',
    step => step.replace('Verify installed iOS native sources', 'Unreviewed substitute'),
  ];
  for (const change of variants) {
    const workflowText = options.workflowText.replace(RELEASE_INSTALL_STEP47_TEXT,
      change(RELEASE_INSTALL_STEP47_TEXT));
    assert.notEqual(workflowText, options.workflowText);
    assert.throws(() => projectReleaseInstallWorkflow47(workflowText));
    assert.equal(auditReleaseInstallWiring47({ ...options, workflowText },
      originalReleaseWiringAudit47).status, 'invalid');
  }
});

test('current47 release wiring retains all sixteen hook mutation error predicates', () => {
  const options = releaseWiringFixture47();
  const native = 'node scripts/postinstall.mjs';
  const security = 'node scripts/release/full-app-j01/patch-expo-collection-bounds46.mjs';
  for (const script of ['postinstall', 'postinstall:check']) {
    const suffix = script.endsWith(':check') ? ' --check' : '';
    const first = native + suffix, second = security + suffix;
    const complete = first + ' && ' + second;
    for (const replacement of [first, second, second + ' && ' + first,
      complete + ' && ' + second, complete + ' && node unreviewed.mjs',
      complete + ' || true', 'echo "' + complete + '"', undefined]) {
      const packageJson = structuredClone(options.packageJson);
      packageJson.scripts[script] = replacement;
      const expected = originalReleaseWiringAudit47({ ...options, packageJson,
        workflowText: projectReleaseInstallWorkflow47(options.workflowText) });
      assert.deepEqual(auditReleaseInstallWiring47({ ...options, packageJson },
        originalReleaseWiringAudit47), expected);
      if (script === 'postinstall') assert.equal(expected.status, 'pass');
      else assert.deepEqual(expected.errors,
        ['postinstall:check does not have the exact reviewed command definition.']);
    }
  }
});

test('current47 release bridge runs all twenty-one untouched original tests with zero skips', () => {
  const identity = spawnSync('git', ['--no-replace-objects', 'rev-parse', 'HEAD'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(identity.status, 0, identity.stderr);
  const childEnvironment = { ...process.env, C47_EXPECTED_HEAD: identity.stdout.trim() };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [resolve(ROOT,
    'scripts/release/full-app-j01/native_generated47.mjs'), '--release-install-wiring47-test'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
      env: childEnvironment });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const line of ['# tests 21', '# pass 21', '# fail 0', '# skipped 0'])
    assert.ok(result.stdout.split(/\r?\n/u).includes(line), line + '\n' + result.stdout);
});

test('current47 release bridge refuses extra arguments before original test admission', () => {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [resolve(ROOT,
    'scripts/release/full-app-j01/native_generated47.mjs'), '--release-install-wiring47-test', '--unreviewed'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30000,
      maxBuffer: 2 * 1024 * 1024, env: childEnvironment });
  assert.notEqual(result.status, 0);
  assert.ok(!result.stdout.includes('# tests 21'));
});
