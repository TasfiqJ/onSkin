import assert from 'node:assert/strict';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, truncateSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import { DESCRIPTOR47, MAP47, strictJson47, validateDescriptor47, validateMapping47,
  validateAutolinking47, validateResolvedLock47, readSourceProof47 } from './native_generated47.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const descriptor = () => strictJson47(readFileSync(resolve(ROOT, DESCRIPTOR47)));
const map = () => strictJson47(readFileSync(resolve(ROOT, MAP47)));
const predecessor = () => strictJson47(readFileSync(resolve(ROOT, 'scripts/phase9/ios-native-obligations46.json')));

test('current47 descriptor is finite generated-only successor with every admission false', () => {
  assert.equal(validateDescriptor47(descriptor()), true);
});

test('current47 rejects root default-subspec expansion, extra pod options, global scope and admission claims', () => {
  const changes = [
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
    value => value.sourcePins.push(structuredClone(value.sourcePins[0])),
    value => value.sourceBinding.externalCurrentSource47SealRequired = false,
    value => value.predecessor46.sha256 = '0'.repeat(64),
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
  const temporaryRoot = realpathSync(tmpdir());
  const directory = mkdtempSync(join(temporaryRoot, 'c47-proof-bound-'));
  t.after(() => {
    assert.match(relative(temporaryRoot, directory), /^c47-proof-bound-[^\\/]+$/);
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
