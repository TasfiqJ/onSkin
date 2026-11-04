/** Current C47 generated native-input successor. No device, owner or release admission. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseDocument } from 'yaml';
import { runNativeCurrent46 } from './native_current46.mjs';
import { checkedNativeRoot46, nativeSourceIdentity46, readNativeFile46, verifyNativeTree46,
  LOCK_SUCCESSION46_SHA256 } from '../../phase9/ios-privacy-lock-succession46.mjs';

export const DESCRIPTOR47 = 'docs/phase-9/ios-generated-input-succession47.v1.json';
export const MAP47 = 'scripts/phase9/ios-native-obligations47.json';
export const SOURCE_PATHS47 = [
  'scripts/release/full-app-j01/pods_compat47.py',
  'scripts/release/full-app-j01/pods_compat47.test.py',
  'scripts/release/full-app-j01/native_generated47.mjs',
  'scripts/release/full-app-j01/native_generated47.test.mjs', MAP47,
  'scripts/release/full-app-j01/native_runtime47.py',
  'scripts/release/full-app-j01/native_runtime47.test.py',
].sort();
export const PODS47 = [{ name: 'GoogleUtilities/Environment', modular_headers: true },
  { name: 'RecaptchaInterop', modular_headers: true }];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = '02aa4ba879fb844f3ca0aa929591203ee45f4163';
const BASE_TREE = '02f4b093d399631c4e36b32bf163fa543b61fc3e';
const hash = raw => createHash('sha256').update(raw).digest('hex');
const same = (a, b) => assert.deepEqual(a, b);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function strictJson47(raw) {
  assert.ok(Buffer.isBuffer(raw) && raw.length > 0 && raw.length <= 16 * 1024 * 1024);
  const document = parseDocument(raw.toString('utf8'), { uniqueKeys: true, merge: false, strict: true });
  same(document.errors, []);
  same(document.warnings, []);
  document.toJS({ maxAliasCount: 0 });
  return JSON.parse(raw);
}

export function validateDescriptor47(value) {
  same(Object.keys(value).sort(), ['schemaVersion', 'kind', 'authority', 'repository', 'acceptedParent',
    'predecessor46', 'sourceBinding', 'sourcePins', 'registry', 'installedConsumers', 'generatedTransition',
    'obligations', 'claims', 'admissions', 'release'].sort());
  same(value.schemaVersion, 1);
  same(value.kind, 'ios_generated_input_succession47_source_candidate');
  same(value.authority, 'BRAIN-M1X-NATIVE-RUNTIME47-AUTONOMOUS-01');
  same(value.repository, 'TasfiqJ/onSkin');
  same(value.acceptedParent, { commit: BASE, tree: BASE_TREE });
  same(value.predecessor46.path, 'docs/phase-9/ios-sdk-lock-succession46.v1.json');
  same(value.predecessor46.sha256, LOCK_SUCCESSION46_SHA256);
  same(value.sourceBinding.selfHashExclusions, [DESCRIPTOR47]);
  same(value.sourceBinding.externalCurrentSource47SealRequired, true);
  same(value.sourcePins.map(pin => pin.path).sort(), SOURCE_PATHS47);
  same(value.registry.map(pin => pin.path).sort(), ['node_modules/expo', 'node_modules/expo-build-properties',
    'node_modules/expo-modules-autolinking'].sort());
  same(value.installedConsumers.map(pin => pin.path).sort(), [
    'node_modules/expo-build-properties/build/ios.js',
    'node_modules/expo-modules-autolinking/build/platforms/apple/apple.js',
    'node_modules/expo-modules-autolinking/build/autolinking/resolveModules.js',
    'node_modules/expo-modules-autolinking/scripts/ios/autolinking_manager.rb'].sort());
  for (const pin of [...value.sourcePins, ...value.installedConsumers]) {
    same(Object.keys(pin).sort(), ['bytes', 'path', 'sha256']);
    assert.ok(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && /^[a-f0-9]{64}$/.test(pin.sha256));
  }
  const transition = value.generatedTransition;
  same(Object.keys(transition).sort(), ['property', 'beforeState', 'pods', 'representation',
    'propertiesPreimage', 'podfilePreimage', 'scope', 'primarySources'].sort());
  same(transition.property, 'apple.extraPods');
  same(transition.beforeState, 'ABSENT');
  same(transition.pods, PODS47);
  same(transition.representation, 'JSON_STRING_OF_EXACT_ORDERED_POD_TUPLES');
  same(transition.scope, 'GENERATED_UNSIGNED_STAGING_SIMULATOR_ONLY_NO_APP_CONFIG_OR_DEPENDENCY_CHANGE');
  same(value.obligations.path, MAP47);
  same(value.obligations.originalTests, 90);
  same(value.claims, { sourceOnly: true, archiveInspected: false, binarySignaturesVerified: false,
    nativeAccepted: false, physicalDeviceQualified: false, appStoreAcceptanceProven: false,
    publicReleaseAuthorized: false });
  same(value.admissions, { security: false, db_custody: false, M1_03: false, M2: false, J01: false,
    paid: false, native: false, apple: false, public_release: false });
  same(value.release, 'NO_GO');
  return true;
}

export function validateMapping47(value, predecessor) {
  same(value.originalTests, 90);
  same(value.cases.length, 90);
  same(new Set(value.cases.map(row => row.id)).size, 90);
  same(value.originalPrograms, predecessor.originalPrograms);
  same(value.archiveAndConfig, predecessor.archiveAndConfig);
  for (let index = 0; index < 90; index++) {
    const { current47, ...unchanged } = value.cases[index];
    same(unchanged, predecessor.cases[index]);
    same(current47.required, true);
    same(current47.sourceGateRequired, true);
    same(current47.generatedGateRequired, true);
    same(current47.freshCurrentSourceReceiptRequired, true);
    same(current47.parentReceiptSubstitutionAllowed, false);
    same(current47.unchangedInvocationRequired, unchanged.currentInvocation);
    same(current47.unchangedNamedTestRequired, unchanged.currentTest);
    same(current47.predecessorCaseSHA256, hash(Buffer.from(JSON.stringify(canonical(unchanged)))));
  }
  same(value.acceptanceGranted, false);
  same(value.nativeAccepted, false);
  same(value.release, 'NO_GO');
  return true;
}

export function validateAutolinking47(value) {
  same(value.extraDependencies, PODS47);
  assert.ok(Array.isArray(value.modules));
  for (const name of ['NativeLabelOcr', 'NativeAgeAssurance']) {
    assert.ok(value.modules.some(module => module.pods?.some(pod => pod.podName === name)), name);
  }
  return true;
}

export function validateResolvedLock47(value) {
  assert.ok(Array.isArray(value.PODS));
  const selected = value.PODS.map(row => typeof row === 'string' ? row : Object.keys(row)[0]);
  for (const name of ['GoogleUtilities/Environment (8.1.5)', 'GoogleUtilities/UserDefaults (8.1.5)',
    'RecaptchaInterop (101.0.0)', 'AppCheckCore (11.3.2)', 'NativeLabelOcr (1.0.0)']) {
    assert.ok(selected.includes(name), 'RESOLVED_REQUIRED_' + name);
  }
  assert.ok(!selected.some(name => name.startsWith('GoogleUtilities/SwizzlerTestHelpers ')));
  assert.ok(Array.isArray(value.DEPENDENCIES));
  assert.ok(value.DEPENDENCIES.includes('GoogleUtilities/Environment'));
  assert.ok(value.DEPENDENCIES.includes('RecaptchaInterop'));
  assert.ok(!value.DEPENDENCIES.includes('GoogleUtilities'));
  for (const name of ['GoogleUtilities', 'RecaptchaInterop', 'AppCheckCore']) {
    assert.match(value['SPEC CHECKSUMS'][name], /^[a-f0-9]{40}$/);
  }
  return selected;
}

export function readSourceProof47(path) {
  assert.ok(isAbsolute(path));
  return readNativeFile46(checkedNativeRoot46(dirname(path)), basename(path), 16 * 1024 * 1024).bytes;
}

function git47(root, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')));
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    cwd: root.absolute, env, windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  same(result.status, 0);
  return result.stdout;
}

function inputs47(rootValue) {
  const root = checkedNativeRoot46(rootValue);
  const source = nativeSourceIdentity46(root);
  same(source.checkoutHead, source.sourceHead);
  same(process.env.C47_EXPECTED_HEAD ?? source.sourceHead, source.sourceHead);
  same(git47(root, 'merge-base', BASE, source.sourceHead).toString().trim(), BASE);
  same(git47(root, 'rev-parse', BASE + '^{tree}').toString().trim(), BASE_TREE);
  const file = readNativeFile46(root, DESCRIPTOR47, 4 * 1024 * 1024);
  same(git47(root, 'show', source.sourceHead + ':' + DESCRIPTOR47), file.bytes);
  const descriptor = strictJson47(file.bytes);
  validateDescriptor47(descriptor);
  for (const pin of descriptor.sourcePins) {
    const actual = readNativeFile46(root, pin.path);
    same(actual.sha256, pin.sha256);
    same(actual.bytes.length, pin.bytes);
    same(git47(root, 'show', source.sourceHead + ':' + pin.path), actual.bytes);
  }
  const prior = readNativeFile46(root, descriptor.predecessor46.path);
  same(prior.sha256, LOCK_SUCCESSION46_SHA256);
  const witness = strictJson47(prior.bytes);
  const oldMap = readNativeFile46(root, 'scripts/phase9/ios-native-obligations46.json');
  same(oldMap.sha256, descriptor.obligations.predecessorSHA256);
  const mapping = readNativeFile46(root, MAP47);
  same(mapping.sha256, descriptor.obligations.sha256);
  validateMapping47(strictJson47(mapping.bytes), strictJson47(oldMap.bytes));
  for (const program of [...strictJson47(oldMap.bytes).originalPrograms,
    ...Object.values(strictJson47(oldMap.bytes).archiveAndConfig)]) {
    // archiveAndConfig may be a structured mapping rather than a flat pin list.
    if (!program?.path || !program?.sha256) continue;
    same(readNativeFile46(root, program.path).sha256, program.sha256);
  }
  const lock = strictJson47(readNativeFile46(root, 'package-lock.json').bytes);
  same(hash(readNativeFile46(root, 'package-lock.json').bytes), witness.candidateLock.sha256);
  for (const pin of descriptor.registry) {
    const actual = lock.packages[pin.path];
    for (const key of ['version', 'resolved', 'integrity']) same(actual[key], pin[key]);
    assert.ok(pin.resolved.startsWith('https://registry.npmjs.org/') && pin.integrity.startsWith('sha512-'));
    same(strictJson47(readNativeFile46(root, pin.path + '/package.json').bytes).version, pin.version);
  }
  for (const pin of descriptor.installedConsumers) {
    const actual = readNativeFile46(root, pin.path);
    same(actual.sha256, pin.sha256);
    same(actual.bytes.length, pin.bytes);
  }
  return { root, source, file, descriptor, witness };
}

function projectedInputs47(root, witness, sourceHead) {
  const pins = [...witness.unchangedInputs, ...witness.currentSourceInputs, witness.rootPackage];
  same(pins.length, 202);
  for (const pin of pins) {
    if (pin.status === 'ABSENT') { same(existsSync(resolve(root.absolute, pin.path)), false); continue; }
    const actual = readNativeFile46(root, pin.path);
    if (pin.path !== 'apps/mobile/package.json' || actual.sha256 === pin.sha256) {
      same(actual.sha256, pin.sha256);
      same(actual.bytes.length, pin.bytes);
      continue;
    }
    const committed = git47(root, 'show', sourceHead + ':' + pin.path);
    same(hash(committed), pin.sha256);
    const before = strictJson47(committed), after = strictJson47(actual.bytes);
    const projected = structuredClone(before);
    for (const name of ['ios', 'android']) {
      if (before.scripts[name] !== after.scripts[name]) {
        same(before.scripts[name], 'expo start --' + name);
        same(after.scripts[name], 'expo run:' + name);
        projected.scripts[name] = after.scripts[name];
      }
    }
    same(projected, after);
  }
  return { verifiedInputCount: pins.length,
    installedNativeTrees: witness.installedNativeTrees.map(expected => verifyNativeTree46(root, expected)),
    qualification: 'ACTUAL_CURRENT_INPUTS_WITH_ONLY_DECLARED_ISOLATED_PREBUILD_PACKAGE_SCRIPT_PROJECTION' };
}

export function runGenerated47({ root = ROOT, phase, receipt, sourceProof }) {
  assert.ok(['SOURCE', 'GENERATED', 'RESOLVED'].includes(phase));
  const current = inputs47(root);
  let details;
  if (phase === 'SOURCE') {
    details = { currentNative46: runNativeCurrent46(root) };
    same(details.currentNative46.source.sourceHead, current.source.sourceHead);
    same(details.currentNative46.verifiedInputCount, 202);
  } else {
    assert.ok(isAbsolute(receipt) && isAbsolute(sourceProof));
    const proofBytes = readSourceProof47(sourceProof);
    const proof = strictJson47(proofBytes);
    same(proof.phase, 'SOURCE');
    same(proof.sourceHead, current.source.sourceHead);
    same(proof.descriptorSHA256, current.file.sha256);
    same(proof.currentNative46.verifiedInputCount, 202);
    same(proof.currentNative46.source.sourceHead, current.source.sourceHead);
    const verification = projectedInputs47(current.root, current.witness, current.source.sourceHead);
    const helper = resolve(root, 'scripts/release/full-app-j01/pods_compat47.py');
    const processResult = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', '-B', helper,
      '--ios-directory', resolve(root, 'apps/mobile/ios'), '--source-proof', sourceProof, '--verify-receipt', receipt],
      { cwd: root, env: { ...process.env, C47_EXPECTED_HEAD: current.source.sourceHead },
        windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(processResult.status, 0, processResult.stderr || processResult.stdout);
    const auto = spawnSync(process.execPath, ['--no-warnings', '--eval', "require('expo/bin/autolinking')",
      'expo-modules-autolinking', 'resolve', '--platform', 'apple', '--json'], {
      cwd: resolve(root, 'apps/mobile/ios'), env: process.env, windowsHide: true,
      timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(resolve(dirname(receipt), 'autolinking-' + phase.toLowerCase() + '.stdout'), auto.stdout ?? Buffer.alloc(0));
    writeFileSync(resolve(dirname(receipt), 'autolinking-' + phase.toLowerCase() + '.stderr'), auto.stderr ?? Buffer.alloc(0));
    assert.equal(auto.status, 0, auto.stderr?.toString() || auto.stdout?.toString());
    const autolinking = strictJson47(auto.stdout);
    validateAutolinking47(autolinking);
    details = { generatedInputVerification: verification, helperReceipt: strictJson47(Buffer.from(processResult.stdout)),
      actualAutolinking: { extraDependencies: autolinking.extraDependencies, modules: autolinking.modules.length,
        stdoutSHA256: hash(auto.stdout), stderrSHA256: hash(auto.stderr),
        command: 'node --no-warnings --eval require(expo/bin/autolinking) expo-modules-autolinking resolve --platform apple --json',
        cwd: 'apps/mobile/ios', exit: auto.status },
      sourceProofSHA256: hash(proofBytes),
      nativeBuildStatus: 'NOT_ESTABLISHED_BY_GENERATED_INPUT_CHECK; ACTUAL_POD_INSTALL_BUILD_LAUNCH_UI_REQUIRED' };
    if (phase === 'RESOLVED') {
      const lockFile = readNativeFile46(current.root, 'apps/mobile/ios/Podfile.lock');
      const parsed = parseDocument(lockFile.bytes.toString(), { uniqueKeys: true, merge: false, strict: true });
      same(parsed.errors, []);
      same(parsed.warnings, []);
      const podLock = parsed.toJS({ maxAliasCount: 0 });
      const selected = validateResolvedLock47(podLock);
      const maps = [];
      for (const name of ['GoogleUtilities', 'RecaptchaInterop']) {
        const pin = readNativeFile46(current.root, `apps/mobile/ios/Pods/Target Support Files/${name}/${name}.modulemap`);
        assert.match(pin.bytes.toString(), new RegExp('\\bmodule\\s+' + name + '\\b'));
        maps.push({ name, bytes: pin.bytes.length, sha256: pin.sha256 });
      }
      const ruby = spawnSync('ruby', ['-r', 'cocoapods-core', '-r', 'digest', '-r', 'json', '-e',
        "s=Gem.loaded_specs.fetch('cocoapods-core');p=File.join(s.full_gem_path,'lib/cocoapods-core/podfile/target_definition.rb');puts JSON.generate({version:s.version.to_s,bytes:File.size(p),sha256:Digest::SHA256.file(p).hexdigest})"],
        { cwd: root, windowsHide: true, timeout: 30000, maxBuffer: 65536 });
      assert.equal(ruby.status, 0, ruby.stderr?.toString() || ruby.stdout?.toString());
      const core = strictJson47(ruby.stdout);
      same(core, { version: '1.17.0', bytes: 40937,
        sha256: 'cd734a2d77537bbfaccb392ae7d34374a70fa6090ad7907cc8df73db46c25ef7' });
      details.resolvedNativeInputs = { podfileLockSHA256: lockFile.sha256,
        pods: selected, specChecksums: podLock['SPEC CHECKSUMS'], moduleMaps: maps,
        actualCocoaPodsCore: core, qualification: 'ACTUAL_POD_RESOLUTION_MODULE_MAPS_NOT_BUILD_OR_RELEASE_PROOF' };
    }
  }
  same(nativeSourceIdentity46(current.root), current.source);
  return { schema: 1, phase, status: 'CURRENT_GENERATED47_' + phase + '_VERIFIED_NO_ADMISSION',
    sourceHead: current.source.sourceHead, sourceTree: current.source.sourceTree,
    descriptorSHA256: current.file.sha256, originalNativeObligations: 90,
    mappingSHA256: current.descriptor.obligations.sha256, ...details,
    acceptanceGranted: false, nativeAccepted: false, release: 'NO_GO' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { phase: { type: 'string' }, receipt: { type: 'string' },
    'source-proof': { type: 'string' }, output: { type: 'string' } } });
  const result = runGenerated47({ phase: values.phase, receipt: values.receipt, sourceProof: values['source-proof'] });
  const raw = JSON.stringify(result, null, 2) + '\n';
  if (values.output) {
    const destination = resolve(values.output);
    assert.ok(relative(ROOT, destination).startsWith('..' + sep));
    writeFileSync(destination, raw, { flag: 'wx' });
  }
  console.log(raw.trimEnd());
}
