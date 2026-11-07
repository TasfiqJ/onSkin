/** Current C47 generated native-input successor. No device, owner or release admission. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseDocument } from 'yaml';
import { auditIosPrivacySource as legacyAuditIosPrivacySource, canonicalAuditJson } from '../../phase9/ios-privacy-contract.mjs';
import { nativeTree23, lockSuccession23 } from '../../phase9/ios-privacy-lock-succession23.mjs';
import { validateIosExtensionConfig, validateIosExtensionVariantIsolation, IOS_WIDGET_EXTENSION_CONTRACT } from '../../phase5/ios-extension-contract.mjs';
import { checkedNativeRoot46, nativeSourceIdentity46, readNativeFile46, verifyNativeTree46,
  LOCK_SUCCESSION46_SHA256, checkedNativePath46, assertCurrentNativeHead46, checkCurrentAuditSnapshot46, checkWindowsReparse } from '../../phase9/ios-privacy-lock-succession46.mjs';

export const DESCRIPTOR47 = 'docs/phase-9/ios-generated-input-succession47.v1.json';
export const MAP47 = 'scripts/phase9/ios-native-obligations47.json';
export const STORAGE_ORIGIN05 = {
  "authority": "BRAIN-C47-STORAGE-ROOT-CAUSE-RUNTIME-05",
  "checkpointHead": "fa4275986b727b3e6d855b059d5688210a09e440",
  "checkpointTree": "ce88d3d7b8a674e3fae2e9aa2ff3c594efe2ecbd",
  "sourcePaths": [
    "scripts/release/full-app-j01/storage_origin47.mjs",
    "scripts/release/full-app-j01/storage_trace47.py",
    "scripts/release/full-app-j01/storage_trace47.test.py"
  ],
  "entryFile": "apps/mobile/.expo/C47StorageOrigin05.js",
  "marker": "C47_STORAGE_ORIGIN_DIAGNOSTIC_05",
  "nativeIdentityFile": "C47StorageOrigin05Identity.json",
  "diagnosticOnly": true,
  "exactRestoreRequired": true,
  "ordinaryProductRebuildRequired": true,
  "normalProductReuseAllowed": false,
  "privateStorageQueryChangesAllowed": false,
  "ordinaryAdmission": false,
  "internalAdmission": false
};
export const SOURCE_PATHS47 = [
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx',
  'apps/mobile/src/features/healthConsent/lifecycle.test.ts',
  'apps/mobile/src/lib/auth/privateMutationRecovery46.test.ts',
  'apps/mobile/src/features/healthConsent/lifecycle.ts',
  'apps/mobile/src/features/onboarding/healthConsentStore.test.ts',
  'apps/mobile/src/features/onboarding/healthConsentStore.ts',
  'apps/mobile/src/features/settings/settingsRoutes.test.ts',
  'docs/USER_FLOW_TREE.md',
  'apps/mobile/src/features/notifications/nativeMutation.ts',
  'apps/mobile/src/features/notifications/nativeMutation.test.ts',
  'scripts/release/full-app-j01/storage_origin47.mjs',
  'scripts/release/full-app-j01/storage_trace47.py',
  'scripts/release/full-app-j01/storage_trace47.test.py',
  'scripts/release/full-app-j01/pods_compat47.py',
  'scripts/release/full-app-j01/pods_compat47.test.py',
  'scripts/release/full-app-j01/native_generated47.mjs',
  'scripts/release/full-app-j01/native_generated47.test.mjs', MAP47,
  'scripts/release/full-app-j01/native_runtime47.py',
  'scripts/release/full-app-j01/native_runtime47.test.py',
  'scripts/release/full-app-j01/swift_behavior47.py',
  'scripts/release/full-app-j01/simulator_signing47.py',
  'scripts/release/full-app-j01/simulator_signing47.test.py',
  'scripts/phase5/expo-widgets-57.0.26/AppIntent.swift',
  'scripts/phase5/expo-widgets-57.0.26/LayerwellWidgetLifecycleStore.swift',
  'scripts/phase5/patch-expo-widgets-lifecycle.mjs',
].sort();
export const PODS47 = [{ name: 'GoogleUtilities/Environment', modular_headers: true },
  { name: 'RecaptchaInterop', modular_headers: true }];
export const SIMULATOR_SIGNING03 = {
  authority: 'BRAIN-C47-SIMULATOR-KEYCHAIN-RUNTIME-03',
  sdk: 'iphonesimulator', mechanism: 'XCODE_APP_TARGET_SDK_CONDITIONAL_LINKED_SIMULATED_ENTITLEMENTS',
  prefix: 'C47SIMTEST.', bundles: ['com.layerwell.app.staging', 'com.layerwell.app.development'],
  appleTeam: false, profiles: false, deviceSigning: false, sharing: false,
  appEntitlementsOnFrameworksOrTestHost: false,
  appProcessSecureStoreRequired: true, ordinaryWithoutDiagnosticRebuildRequired: true,
};
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = '02aa4ba879fb844f3ca0aa929591203ee45f4163';
const BASE_TREE = '02f4b093d399631c4e36b32bf163fa543b61fc3e';
const hash = raw => createHash('sha256').update(raw).digest('hex');
const same = (a, b) => assert.deepEqual(a, b);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export const CONSENT_DOC04 = {
  authority: 'BRAIN-C47-CONSENT-RUNTIME-CLOSURE-04',
  checkpointHead: 'f21831f5731be928c8e323c509fb62b3d12a654e',
  path: 'docs/USER_FLOW_TREE.md',
  before: { bytes: 540330, sha256: '1525743f161ec725f2fe1a812b1e619c1f4ac12dbd60a8a2a089c1c5429cdedf' },
  after: { bytes: 543738, sha256: 'e192ec9df7352b9ea9c778a1a5fbc984fb7e7b1b3b02c6fa46c73a64d18cae06' },
  append: { bytes: 3408, sha256: 'c06a5f77e9b51874d893cf4b04e342ad92776ce36a8e2a45ba556a78e524a93b' },
};
export function validateConsentDoc04(pin, original, actual) {
  same(pin.path, CONSENT_DOC04.path);
  same({ bytes: pin.bytes, sha256: pin.sha256 }, CONSENT_DOC04.before);
  assert.ok(Buffer.isBuffer(original) && Buffer.isBuffer(actual));
  same({ bytes: original.length, sha256: hash(original) }, CONSENT_DOC04.before);
  same({ bytes: actual.length, sha256: hash(actual) }, CONSENT_DOC04.after);
  same(actual.subarray(0, original.length), original);
  const append = actual.subarray(original.length);
  same({ bytes: append.subarray(0, 477).length, sha256: hash(append.subarray(0, 477)) },
    { bytes: 477, sha256: 'c78b144360006df907cc5ec7370c9feb225ba87b3520fa26e1afaa7cd0d8eaf1' });
  same({ bytes: append.length, sha256: hash(append) }, CONSENT_DOC04.append);
  return true;
}

export const CONSENT_APP04 = {
  "authority": "BRAIN-C47-CONSENT-RUNTIME-CLOSURE-04",
  "checkpointHead": "f21831f5731be928c8e323c509fb62b3d12a654e",
  "sourceInputs": [
    {
      "path": "apps/mobile/src/app/(tabs)/you.tsx",
      "before": {
        "bytes": 37030,
        "sha256": "1ac5a527ba8f0ded50374d0d542abd6d12825e3f34de9b3fd566e6e93888ab23"
      },
      "after": {
        "bytes": 37704,
        "sha256": "3cf0bd5d363ca18ca133f749d917a4afd4c8bfcda629e1ef81a98b96c20e53d4"
      }
    },
    {
      "path": "apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts",
      "before": {
        "bytes": 8740,
        "sha256": "a23b04419c4e31c3327943eac96cb0176cacceb6730927e60269de5f12a0967b"
      },
      "after": {
        "bytes": 24849,
        "sha256": "0a9b3584c7a5b79c06a6df024949e9b8697da64b4402cf2023ec9e2486b50874"
      },
      "previousAfter": {
        "head": "c36fecd16c605a49e06b599d89dae8a988a42939",
        "bytes": 22489,
        "sha256": "00bd1de21061fbdf8e7081a38c116e1a8c925856889c59e8fdcefcfc96f8c308"
      }
    },
    {
      "path": "apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx",
      "before": {
        "bytes": 33702,
        "sha256": "95ae7915a0cc2793f8697ba1e6bda72e20d66f64b3f20e6b2cc89f58ac968a83"
      },
      "after": {
        "bytes": 36277,
        "sha256": "0fc3cfe1cb14606ae3396892d942c568fd858f9e36f147233ba03d24463d3117"
      }
    }
  ],
  "currentInputs": [
    {
      "path": "apps/mobile/src/features/healthConsent/lifecycle.test.ts",
      "bytes": 54151,
      "sha256": "a18f325558a383a76f78bc70744395fdfe532000b3038c2e6893d43e140c3021"
    },
    {
      "path": "apps/mobile/src/features/healthConsent/lifecycle.ts",
      "bytes": 53459,
      "sha256": "8ee8efd825a5be6fb8691cb74d96fbc4d7dd9c339a690194b52f67053abb549b"
    },
    {
      "path": "apps/mobile/src/features/onboarding/healthConsentStore.test.ts",
      "bytes": 13103,
      "sha256": "bda08282da2f98cbb5c75ead51207707b81c1aca0667efc65f1c53f2fb7451ca"
    },
    {
      "path": "apps/mobile/src/features/onboarding/healthConsentStore.ts",
      "bytes": 8373,
      "sha256": "089f705454098c108c03628738a6640cf497791369148f82e03248040b4a9a8f"
    },
    {
      "path": "apps/mobile/src/features/settings/settingsRoutes.test.ts",
      "bytes": 39901,
      "sha256": "cc24ee27facd247ba9d3abbbe11b246b4021aa1c11ef76f16b1d61244ca6121b"
    },
    {
      "path": "apps/mobile/src/lib/auth/privateMutationRecovery46.test.ts",
      "bytes": 24461,
      "sha256": "d7732158e808f4d038f0ae998e9f25e00c1faab86db5e5df28f35080fbb2e012"
    }
  ]
};
export function validateConsentApp04(pin, original, actual) {
  const row = CONSENT_APP04.sourceInputs.find(row => row.path === pin.path);
  assert.ok(row, 'CURRENT47_EXACT_APP04_WITNESS_PATH_REQUIRED');
  same({ bytes: pin.bytes, sha256: pin.sha256 }, row.before);
  assert.ok(Buffer.isBuffer(original) && Buffer.isBuffer(actual));
  same({ bytes: original.length, sha256: hash(original) }, row.before);
  same({ bytes: actual.length, sha256: hash(actual) }, row.after);
  return true;
}
export function firstLegacySourcePin04(witness) {
  const known = [...SWIFT_SUCCESSION47.sourceInputs, ...SWIFT_SUCCESSION47.installedFiles,
    CONSENT_DOC04, ...CONSENT_APP04.sourceInputs];
  const pins = [...witness.unchangedInputs, ...witness.currentSourceInputs, witness.rootPackage];
  const first = pins.find(pin => known.some(row => row.path === pin.path &&
    (row.after.bytes !== pin.bytes || row.after.sha256 !== pin.sha256)));
  assert.ok(first, 'CURRENT47_VERIFIED_KNOWN_LEGACY_RED_REQUIRED');
  return first.path;
}

export const SWIFT_SUCCESSION47 = {
  "authority": "BRAIN-C47-SWIFT-BUILD-RUNTIME-CLOSURE-02",
  "checkpointHead": "a1fc7ab64d6f66b9d1ecd1d3fc948233e76c3886",
  "checkpointTree": "33898bf4d4e7424a8479139fd0906f8df6f94ae2",
  "sourceInputs": [
    {
      "path": "scripts/phase5/expo-widgets-57.0.26/AppIntent.swift",
      "before": {
        "bytes": 5224,
        "sha256": "4ecf0709fb2c62982cc7c52b375c160a2a9f45916ef9e40e3914f0579fcecb29"
      },
      "after": {
        "bytes": 5325,
        "sha256": "1a4086ce1131d3618ca0ffe08dbd31e9a0f508d31918c73f57dc47bb9bec815e"
      }
    },
    {
      "path": "scripts/phase5/expo-widgets-57.0.26/LayerwellWidgetLifecycleStore.swift",
      "before": {
        "bytes": 75303,
        "sha256": "b49a743650facb13f2d1d3ae583d02f3e60f38feec11937accbbd03be9e34f30"
      },
      "after": {
        "bytes": 75347,
        "sha256": "9d3dccefb2d9967a6bb3fd577506a6579ee3060809fb050267625984c750787c"
      }
    },
    {
      "path": "scripts/phase5/patch-expo-widgets-lifecycle.mjs",
      "before": {
        "bytes": 16969,
        "sha256": "6367427b96fe641d376ba9c6742cfb5b60b5ac1988bd4fce8831dbd90b94e83c"
      },
      "after": {
        "bytes": 16969,
        "sha256": "d205c83d944e89a7f52d1e5c44be264281e2d3665674f0d32438bf6295b1bef7"
      }
    }
  ],
  "installedFiles": [
    {
      "path": "node_modules/expo-widgets/ios/Widgets/AppIntent.swift",
      "sourcePath": "scripts/phase5/expo-widgets-57.0.26/AppIntent.swift",
      "before": {
        "bytes": 5224,
        "sha256": "4ecf0709fb2c62982cc7c52b375c160a2a9f45916ef9e40e3914f0579fcecb29"
      },
      "after": {
        "bytes": 5325,
        "sha256": "1a4086ce1131d3618ca0ffe08dbd31e9a0f508d31918c73f57dc47bb9bec815e"
      }
    },
    {
      "path": "node_modules/expo-widgets/ios/LayerwellWidgetLifecycleStore.swift",
      "sourcePath": "scripts/phase5/expo-widgets-57.0.26/LayerwellWidgetLifecycleStore.swift",
      "before": {
        "bytes": 75303,
        "sha256": "b49a743650facb13f2d1d3ae583d02f3e60f38feec11937accbbd03be9e34f30"
      },
      "after": {
        "bytes": 75347,
        "sha256": "9d3dccefb2d9967a6bb3fd577506a6579ee3060809fb050267625984c750787c"
      }
    }
  ],
  "projection": "VERIFY_CURRENT_POSTIMAGES_THEN_INVERT_ONLY_TWO_FILES_FOR_IMMUTABLE_TREE_COMPARISON",
  "legacy46": "EXPECTED_IDENTITY_REFUSAL_RETAINED_NOT_RELABELLED_PASS",
  "admissions": false
};
export function validateSwiftSuccession47(value) { same(value, SWIFT_SUCCESSION47); return true; }

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
    'obligations', 'claims', 'admissions', 'release', 'swiftSourceSuccession', 'simulatorSigning03', 'storageOrigin05'].sort());
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
  const doc04 = value.sourcePins.find(pin => pin.path === CONSENT_DOC04.path);
  same({ bytes: doc04.bytes, sha256: doc04.sha256 }, CONSENT_DOC04.after);
  for (const expected of [...CONSENT_APP04.sourceInputs.map(row => ({ path: row.path, ...row.after })),
    ...CONSENT_APP04.currentInputs]) {
    const pin = value.sourcePins.find(pin => pin.path === expected.path);
    same(pin, expected);
  }
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
  validateSwiftSuccession47(value.swiftSourceSuccession);
  same(value.simulatorSigning03, SIMULATOR_SIGNING03);
  same(value.storageOrigin05, STORAGE_ORIGIN05);
  const transition = value.generatedTransition;
  same(Object.keys(transition).sort(), ['property', 'beforeState', 'pods', 'representation',
    'propertiesPreimage', 'podfilePreimage', 'scope', 'primarySources', 'allowedProfiles',
    'developmentProjection'].sort());
  same(transition.property, 'apple.extraPods');
  same(transition.beforeState, 'ABSENT');
  same(transition.pods, PODS47);
  same(transition.representation, 'JSON_STRING_OF_EXACT_ORDERED_POD_TUPLES');
  same(transition.scope, 'GENERATED_UNSIGNED_SIMULATOR_STAGING_AND_INTERNAL_DEVELOPMENT_ONLY');
  same(transition.allowedProfiles, ['staging', 'development']);
  validateDevelopmentProjection47(transition);
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

export function validateDevelopmentProjection47(transition) {
  const declared = transition.developmentProjection;
  same(declared.provenance, 'DECLARED_TARGET_NAME_PROJECTION_NOT_OBSERVED_MACOS_GENERATION');
  const properties = Buffer.from(declared.stagingPropertiesUTF8), podfile = Buffer.from(declared.stagingPodfileUTF8);
  same(hash(properties), transition.propertiesPreimage.sha256);
  same(hash(podfile), transition.podfilePreimage.sha256);
  const value = strictJson47(properties);
  const key = 'expo.inlineModules.xcodeProjectTargets';
  same(strictJson47(Buffer.from(value[key])), { mainTarget: 'LayerwellStaging', targets: [] });
  value[key] = JSON.stringify({ mainTarget: 'LayerwellDev', targets: [] });
  const generated = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  const needle = "target 'LayerwellStaging' do";
  same(declared.stagingPodfileUTF8.split(needle).length, 2);
  const devPodfile = Buffer.from(declared.stagingPodfileUTF8.replace(needle, "target 'LayerwellDev' do"));
  same(hash(generated), declared.propertiesPreimage.sha256);
  same(generated.length, declared.propertiesPreimage.bytes);
  same(hash(devPodfile), declared.podfilePreimage.sha256);
  same(devPodfile.length, declared.podfilePreimage.bytes);
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
    if (unchanged.execution === 'CURRENT46_SUCCESSOR') {
      const continued = current47.continuation02;
      same(continued.required, true);
      same(continued.effectiveInvocation, 'node --test scripts/release/full-app-j01/native_generated47.test.mjs');
      same(continued.effectiveNamedTest, unchanged.currentTest.replace(/^current46 /, 'current47 continuation02 '));
      same(continued.actualCurrentSourceReceiptRequired, true);
      same(continued.installedNativeInventoryRequired, true);
      same(continued.parentOrHistoricalPassSubstitutionAllowed, false);
    } else same(current47.continuation02, undefined);
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

export function validateOutput47(value, root = ROOT) {
  const destination = resolve(value);
  assert.ok(relative(root, destination).startsWith('..' + sep), 'CURRENT47_OUTPUT_OUTSIDE_SOURCE');
  checkedNativeRoot46(dirname(destination));
  assert.equal(existsSync(destination), false, 'CURRENT47_OUTPUT_ALREADY_EXISTS');
  return destination;
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

function projectedInputs47(root, witness, sourceHead, descriptor, allowGeneration = true) {
  const pins = [...witness.unchangedInputs, ...witness.currentSourceInputs, witness.rootPackage];
  const stamps = {};
  let consentDoc04 = null;
  const app04Seen = [];
  same(pins.length, 202);
  for (const pin of pins) {
    if (pin.status === 'ABSENT') { absentInput47(root, pin.path); continue; }
    const actual = readNativeFile46(root, pin.path);
    stamps[pin.path] = actual.identity;
    const changed = [...descriptor.swiftSourceSuccession.sourceInputs,
      ...descriptor.swiftSourceSuccession.installedFiles].find(row => row.path === pin.path);
    if (changed) {
      same({ bytes: pin.bytes, sha256: pin.sha256 }, changed.before);
      same({ bytes: actual.bytes.length, sha256: actual.sha256 }, changed.after);
      continue;
    }
    if (pin.path === CONSENT_DOC04.path) {
      const original = git47(root, 'show', CONSENT_DOC04.checkpointHead + ':' + pin.path);
      validateConsentDoc04(pin, original, actual.bytes);
      consentDoc04 = CONSENT_DOC04;
      continue;
    }
    if (CONSENT_APP04.sourceInputs.some(row => row.path === pin.path)) {
      const original = git47(root, 'show', CONSENT_APP04.checkpointHead + ':' + pin.path);
      validateConsentApp04(pin, original, actual.bytes);
      app04Seen.push(pin.path);
      continue;
    }
    assert.ok(allowGeneration || actual.sha256 === pin.sha256, 'CURRENT47_UNPROJECTED_SOURCE_REQUIRED:' + pin.path);
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
  same(consentDoc04, CONSENT_DOC04);
  same(app04Seen.sort(), CONSENT_APP04.sourceInputs.map(row => row.path).sort());
  return { verifiedInputCount: pins.length, stamps, consentDoc04, consentApp04: CONSENT_APP04,
    legacyFirstSourcePin04: firstLegacySourcePin04(witness),
    installedNativeTrees: witness.installedNativeTrees.map(expected => currentTree47(root, expected, descriptor.swiftSourceSuccession, stamps)),
    qualification: 'ACTUAL_CURRENT_INPUTS_WITH_ONLY_DECLARED_ISOLATED_PREBUILD_PACKAGE_SCRIPT_PROJECTION' };
}


function absentInput47(root, name) {
  let prefix = '';
  for (const part of name.split('/')) {
    prefix += (prefix ? '/' : '') + part;
    try { const found = checkedNativePath46(root, prefix); checkWindowsReparse([found.absolute]); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
  }
  assert.fail('CURRENT47_EXPECTED_ABSENCE:' + name);
}

function currentTree47(root, expected, transition, stamps) {
  if (expected.path !== 'node_modules/expo-widgets') return verifyNativeTree46(root, expected, stamps);
  const rows = [], seen = new Set();
  let actualBytes = 0;
  const prior = new Map(transition.installedFiles.map(change => {
    const before = git47(root, 'show', transition.checkpointHead + ':' + change.sourcePath);
    same({ bytes: before.length, sha256: hash(before) }, change.before);
    return [change.path, { change, before }];
  }));
  const projected = nativeTree23(root, expected.path, {
    checkedPath(current, path) {
      const entry = checkedNativePath46(current, path);
      const stat = entry.ancestors.at(-1).stat;
      stamps[path] = ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'nlink'].map(key => String(stat[key]));
      if (entry.ancestors.at(-1).stat.isDirectory()) rows.push({ path, kind: 'directory' });
      return entry;
    },
    readBoundedFile(current, path, maximum) {
      const actual = readNativeFile46(current, path, maximum);
      rows.push({ path, kind: 'file', bytes: actual.bytes.length, sha256: actual.sha256 });
      actualBytes += actual.bytes.length;
      if (!prior.has(path)) return actual;
      const { change, before } = prior.get(path);
      same({ bytes: actual.bytes.length, sha256: actual.sha256 }, change.after);
      same(actual.bytes, readNativeFile46(current, change.sourcePath).bytes);
      seen.add(path);
      return { ...actual, bytes: before, sha256: change.before.sha256 };
    },
    reject(message) { assert.fail('CURRENT47_NATIVE_TREE:' + message); },
  });
  same([...seen].sort(), [...prior.keys()].sort());
  same(projected, expected);
  return { actualHashDomain: 'SHA256(JSON.stringify(actual preorder directory/file rows,null,2)+newline)',
    path: expected.path, files: projected.files, directories: projected.directories,
    bytes: actualBytes, sha256: hash(Buffer.from(JSON.stringify(rows, null, 2) + '\n')),
    immutable46InverseProjection: projected, verifiedInstalledFileSuccessors: 2 };
}

function verifyLockAndPackage47(root, witness, lockFile) {
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
  const historicalBase = witness.acceptedBase.commit, predecessor = witness.predecessor.commit;
  const baseLock = witness.acceptedBase.lockSHA256, currentLock = witness.candidateLock.sha256;
  const reject = message => assert.fail('CURRENT47_LOCK_PACKAGE:' + message);
  const currentPackage = readNativeFile46(root, 'package.json');
  const basePackage = git47(root, ...['show', `${historicalBase}:package.json`]);
  const priorPackage = git47(root, ...['show', `${predecessor}:package.json`]);
  const priorLock = git47(root, ...['show', `${predecessor}:package-lock.json`]);
  const transition = witness.rootPackageTransition;
  if (hash(basePackage) !== transition.acceptedParent.sha256 || basePackage.length !== transition.acceptedParent.bytes ||
      hash(priorPackage) !== transition.predecessor.sha256 || priorPackage.length !== transition.predecessor.bytes ||
      transition.predecessor.sha256 !== 'cc37998ca18d43326f11e47cc78f2b3aa62231b0381d1948578804190ec2269b' ||
      hash(basePackage) !== witness.acceptedBase.rootPackageSHA256 ||
      hash(priorPackage) !== witness.predecessor.rootPackageSHA256 ||
      hash(priorLock) !== witness.predecessor.lockSHA256 || !priorLock.equals(lockFile.bytes) ||
      !equal(transition.closureChangedScripts, ['postinstall', 'postinstall:check'])) reject('PACKAGE_predecessor');
  const expectedPackage = JSON.parse(priorPackage);
  expectedPackage.scripts.postinstall += ` && ${transition.appendedHook}`;
  expectedPackage.scripts['postinstall:check'] += ` && ${transition.appendedHook} --check`;
  if (!jsonBytes(expectedPackage).equals(currentPackage.bytes)) reject('EXACT_PACKAGE_HOOK_DELTA');
  const baseBytes = git47(root, ...['show', `${historicalBase}:package-lock.json`]);
  if (hash(baseBytes) !== baseLock) reject('baseLock');
  const lock = JSON.parse(lockFile.bytes);
  const before = JSON.parse(baseBytes);
  const changed = [...new Set([...Object.keys(lock.packages), ...Object.keys(before.packages)])]
    .filter(path => !equal(lock.packages[path], before.packages[path])).sort();
  if (!equal(changed, witness.changedNodes)) reject('FINITE_LOCK_DELTA');
  const historical = structuredClone(lock);
  for (const path of changed) {
    if (!equal(lock.packages[path], witness.candidateNodes[path]) ||
        !equal(before.packages[path] ?? null, witness.originalNodes[path])) reject('NODE_IDENTITY');
    if (Object.hasOwn(before.packages, path)) historical.packages[path] = before.packages[path];
    else delete historical.packages[path];
  }
  if (!jsonBytes(historical).equals(baseBytes)) reject('LOSSLESS_predecessor');
  for (const [path, node] of Object.entries(witness.unchangedNativeNodes)) {
    if (!equal(lock.packages[path], node)) reject('NATIVE_NODE');
  }

  return { changedLockNodes: changed, historicalLockSHA256: hash(baseBytes) };
}


function verifyHistorical23And13Assertions47(root, witness, history, succession) {
  // Current actual identities have already passed. Only five byte-exact inverse
  // identities are exposed to the unchanged C23 historical predicate.
  const changes = [...succession.sourceInputs, ...succession.installedFiles];
  const originals = new Map(changes.map(change => {
    const bytes = git47(root, 'show', succession.checkpointHead + ':' + (change.sourcePath ?? change.path));
    same({ bytes: bytes.length, sha256: hash(bytes) }, change.before);
    return [change.path, { change, bytes }];
  }));
  const readBoundedFile = (current, path, maximum) => {
    const actual = readNativeFile46(current, path, maximum);
    if (!originals.has(path)) return actual;
    const { change, bytes } = originals.get(path);
    same({ bytes: actual.bytes.length, sha256: actual.sha256 }, change.after);
    return { ...actual, bytes, sha256: change.before.sha256 };
  };
  const readJson = (current, path, maximum) => {
    const file = readBoundedFile(current, path, maximum);
    return { ...file, relative: path, value: strictJson47(file.bytes) };
  };
  const fail = (code, message, path) => assert.fail(code + ':' + path + ':' + message);
  const decodeUtf8 = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const sha256 = hash, MAX_MAPPING_BYTES = 4 * 1024 * 1024;
  const IOS_PRIVACY_LOCK_SUCCESSION13_PATH = 'docs/phase-9/ios-sdk-lock-succession13.v1.json';
  const IOS_PRIVACY_LOCKFILE_PATH = 'package-lock.json';
  const LOCK_SUCCESSION13_SHA256 = '824d99e0f57bee122af6b89f640c1bfe401b367b8f7211b1c0abf61b5a249409';
  const ORIGINAL_LOCK13_SHA256 = '99aa497f2d0cc2ca237167403fbbb9d9aee0a4e42fa991ea44f9661487ecf568';
function lockSuccession13({ mapping, mappingFile, lock, lockFile, root }) {
  const file = readJson(root, IOS_PRIVACY_LOCK_SUCCESSION13_PATH, MAX_MAPPING_BYTES);
  const successor = file.value;
  const reject = (message) => fail('LOCK_SUCCESSION13_IDENTITY', message, file.relative);
  // This is one independently anchored source version, never a mutable hash alias.
  if (file.sha256 !== LOCK_SUCCESSION13_SHA256) reject('Successor bytes are not exact v1.');
  if (
    successor.schemaVersion !== 1 ||
    successor.base.commit !== 'bbbd59073b7add22ac350bced0d9a34124c12ffb' ||
    mappingFile.sha256 !== successor.originalMapping.sha256 ||
    lockFile.sha256 !== successor.candidateLock.sha256 ||
    successor.originalLock.sha256 !== ORIGINAL_LOCK13_SHA256 ||
    JSON.stringify(mapping.mappings) !== JSON.stringify(successor.unchangedNativeMappings)
  ) reject('Original mapping, source version or complete lock identity drifted.');
  const original = JSON.parse(decodeUtf8(lockFile.bytes, IOS_PRIVACY_LOCKFILE_PATH));
  if (successor.changedNodes.length !== 8) reject('Exactly eight reviewed nodes are required.');
  for (const path of successor.changedNodes) {
    if (JSON.stringify(lock.packages[path]) !== JSON.stringify(successor.candidateNodes[path])) {
      reject(`Reviewed testing-tool node drifted: ${path}`);
    }
    original.packages[path] = successor.originalNodes[path];
  }
  if (sha256(Buffer.from(canonicalAuditJson(original))) !== ORIGINAL_LOCK13_SHA256) {
    reject('All other lock bytes, records and ordering must reproduce the original lock.');
  }
  for (const [path, node] of Object.entries(successor.unchangedNativeNodes)) {
    if (JSON.stringify(lock.packages[path]) !== JSON.stringify(node)) {
      reject(`Mapped native lock record drifted: ${path}`);
    }
  }
  for (const pin of [successor.dependencyWitness, successor.provenance,
    ...successor.registry.flatMap((row) => [row.metadata, row.attestations])]) {
    if (readBoundedFile(root, pin.path, MAX_MAPPING_BYTES).sha256 !== pin.sha256) {
      reject(`Authenticated dependency provenance drifted: ${pin.path}`);
    }
  }
  // The original mappingErrors loop still checks every installed native source pin,
  // SDK classification and absent/archive-required claim with its original errors.
  return file;
}
  // The private predicate is deliberately copied verbatim, not reimplemented or
  // evaluated dynamically. Bind its complete definition to immutable source.
  const source = readNativeFile46(root, 'scripts/phase9/ios-privacy-contract.mjs');
  assert.ok(source.bytes.includes(Buffer.from(lockSuccession13.toString())), 'CURRENT47_ORIGINAL_C13_ASSERTION_BODY');
  const historicalBytes = git47(root, 'show', witness.acceptedBase.commit + ':package-lock.json');
  same(hash(historicalBytes), history.historicalLockSHA256);
  const mappingFile = readJson(root, 'docs/phase-9/ios-sdk-package-mapping.json', MAX_MAPPING_BYTES);
  const result = lockSuccession23({
    mapping: mappingFile.value, mappingFile,
    lock: strictJson47(historicalBytes),
    lockFile: { ...readNativeFile46(root, 'package-lock.json'), bytes: historicalBytes, sha256: hash(historicalBytes) },
    root, readJson, readBoundedFile, checkedPath: checkedNativePath46,
    historicalCheck: lockSuccession13, fail,
  });
  return { qualification: 'UNCHANGED_C23_AND_VERBATIM_C13_ASSERTIONS_AFTER_EXACT_CURRENT_FIVE_FILE_IDENTITY_PROOF',
    c23WitnessSHA256: result.sha256, c13PredicateSHA256: hash(Buffer.from(lockSuccession13.toString())),
    currentFilesRewritten: false, inverseSourceInputs: 3, inverseInstalledFiles: 2 };
}

export function currentPrivacyProjection47(legacy, witnessBytes, requireSnapshot = true, verifiedDoc04 = null, verifiedApp04 = null) {
  // Historical no-proof and doc-only predicates remain distinct. Current app
  // adapters supply both exact proofs after the complete 202-input validation.
  if (verifiedDoc04 !== null) same(verifiedDoc04, CONSENT_DOC04);
  let expectedSourcePin = verifiedDoc04 === null
    ? 'node_modules/expo-widgets/ios/LayerwellWidgetLifecycleStore.swift' : CONSENT_DOC04.path;
  if (verifiedApp04 !== null) {
    same(verifiedDoc04, CONSENT_DOC04);
    same(verifiedApp04, CONSENT_APP04);
    same(hash(witnessBytes), LOCK_SUCCESSION46_SHA256);
    expectedSourcePin = firstLegacySourcePin04(strictJson47(witnessBytes));
  }
  same(legacy.status, 'source_invalid');
  same(legacy.errors, [
    ...['@react-native-google-signin/google-signin', 'expo-image', 'react-native'].map(name => ({
      code: 'MAPPING_LOCK_DRIFT', path: 'docs/phase-9/ios-sdk-package-mapping.json#' + name,
      message: 'Mapping package-lock path/hash do not match current bytes.',
    })),
    { code: 'UNEXPECTED_AUDIT_ERROR', path: 'docs/phase-9/ios-sdk-lock-succession46.v1.json',
      message: 'CURRENT_NATIVE_SOURCE46_SOURCE_PIN:' + expectedSourcePin },
  ]);
  const report = structuredClone(legacy);
  same(report.summary.errorCount, 4);
  report.status = 'archive_required'; report.errors = []; report.summary.errorCount = 0;
  report.inputs.lockSuccession46 = { path: 'docs/phase-9/ios-sdk-lock-succession46.v1.json',
    bytes: witnessBytes.length, sha256: hash(witnessBytes) };
  // The raw RED remains intact. This only accepts the complete unchanged privacy
  // inventory hash after an independently proven exact current-source successor.
  if (requireSnapshot) checkCurrentAuditSnapshot46(report, witnessBytes);
  return report;
}

export function verifyCurrentNative47(rootValue = ROOT, { audit = true, evidenceDirectory } = {}) {
  if (evidenceDirectory) {
    checkedNativeRoot46(evidenceDirectory);
    assert.ok(relative(ROOT, resolve(evidenceDirectory)).startsWith('..' + sep), 'CURRENT47_OUTPUT_OUTSIDE_SOURCE');
  }
  const current = inputs47(rootValue);
  const committed = assertCurrentNativeHead46(rootValue, current.source.sourceHead);
  const finite = [...current.witness.unchangedInputs, ...current.witness.currentSourceInputs, current.witness.rootPackage];
  const regular = finite.filter(pin => pin.status !== 'ABSENT').map(pin => resolve(current.root.absolute, pin.path));
  const trees = current.witness.installedNativeTrees.map(tree => resolve(current.root.absolute, tree.path));
  checkWindowsReparse(regular, trees);
  const verification = projectedInputs47(current.root, current.witness, current.source.sourceHead, current.descriptor, false);
  const lockFile = readNativeFile46(current.root, 'package-lock.json');
  const history = verifyLockAndPackage47(current.root, current.witness, lockFile);
  const historicalAssertions = verifyHistorical23And13Assertions47(current.root, current.witness, history, current.descriptor.swiftSourceSuccession);
  const legacy46File = readNativeFile46(current.root, current.descriptor.predecessor46.path);
  let legacyAudit, privacyInventory;
  if (audit) {
    legacyAudit = legacyAuditIosPrivacySource({ root: current.root.absolute });
    if (evidenceDirectory) writeFileSync(resolve(evidenceDirectory, 'legacy46-audit-current47.json'),
      canonicalAuditJson(legacyAudit), { flag: 'wx' });
    privacyInventory = currentPrivacyProjection47(legacyAudit, legacy46File.bytes, true, verification.consentDoc04, verification.consentApp04);
  }
  checkWindowsReparse(regular, trees);
  same(nativeSourceIdentity46(current.root), current.source);
  return { status: 'CURRENT_NATIVE_SOURCE47_SWIFT_SUCCESSOR_REVIEW_REQUIRED', source: current.source,
    descriptorSHA256: current.file.sha256, committedSourceProof: committed,
    verifiedInputCount: verification.verifiedInputCount, committedCriticalInputs: committed.committedCriticalInputs,
    consentDoc04: verification.consentDoc04, consentApp04: verification.consentApp04,
    legacyFirstSourcePin04: verification.legacyFirstSourcePin04, stamps: verification.stamps, installedNativeTrees: verification.installedNativeTrees, trees: verification.installedNativeTrees, sourceSuccessors: 3, installedFileSuccessors: 2,
    historical46Identity: 'EXPECTED_SOURCE_PIN_RED_NOT_CURRENT_PASS',
    legacy46File, witness: current.witness, file: current.file, root: current.root,
    lockHistory: history, historicalAssertions, legacyAudit, privacyInventory,
    claims: current.witness.claims, admissions: current.witness.admissions,
    sourceOnly: true, acceptanceGranted: false, nativeAccepted: false, release: 'NO_GO' };
}

export function validateIosExtensionConfig47({ root, config, packageJson, packageLock, variant }) {
  try {
    const proof = verifyCurrentNative47(root, { audit: false });
    same(proof.source, nativeSourceIdentity46(checkedNativeRoot46(root)));
    same(hash(Buffer.from(JSON.stringify(packageJson, null, 2) + '\n')), proof.witness.mobilePackage.sha256);
    same(hash(Buffer.from(JSON.stringify(packageLock, null, 2) + '\n')), proof.witness.candidateLock.sha256);
    const old = strictJson47(readNativeFile46(proof.root, 'docs/phase-9/ios-sdk-lock-succession23.v1.json').bytes);
    for (const [name, expected] of Object.entries(old.widgetCompatibility)) {
      const actual = packageLock.packages['node_modules/' + name];
      same(packageJson.dependencies[name], expected.specifier);
      same(packageLock.packages['apps/mobile'].dependencies[name], expected.specifier);
      for (const key of ['version', 'resolved', 'integrity']) same(actual[key], expected[key]);
    }
    const historicalPackage = structuredClone(packageJson), historicalLock = structuredClone(packageLock);
    for (const [name, expected] of Object.entries(IOS_WIDGET_EXTENSION_CONTRACT.reviewedDependencyLocks)) {
      historicalPackage.dependencies[name] = expected.specifier;
      historicalLock.packages['apps/mobile'].dependencies[name] = expected.specifier;
      for (const key of ['version', 'resolved', 'integrity']) historicalLock.packages[expected.path][key] = expected[key];
    }
    return { ...validateIosExtensionConfig({ config, packageJson: historicalPackage,
      packageLock: historicalLock, variant }), sourceCompatibility: { kind: 'CURRENT_NATIVE_SOURCE47',
        sourceOnly: true, nativeAccepted: false, acceptanceGranted: false, descriptorSHA256: proof.descriptorSHA256 } };
  } catch { return { errors: [variant + ': CURRENT_NATIVE_SOURCE47_IDENTITY_REQUIRED'], identity: null }; }
}
export { validateIosExtensionConfig47 as validateIosExtensionConfig46 };


export function auditCurrentNative47({ root = ROOT } = {}) {
  try {
    const proof = verifyCurrentNative47(root, { audit: false });
    const legacy = legacyAuditIosPrivacySource({ root });
    return currentPrivacyProjection47(legacy, proof.legacy46File.bytes, false, proof.consentDoc04, proof.consentApp04);
  } catch (error) {
    return { status: 'source_invalid', errors: [{ code: 'CURRENT_NATIVE_SOURCE47_REFUSAL', path: null,
      message: String(error.message ?? error) }], claims: { appStoreAcceptanceProven: false, appStorePrivacyLabelsVerified: false,
      archiveInspected: false, binarySignaturesVerified: false, mergedPrivacyReportVerified: false }, qualification: 'CURRENT_INPUT_REFUSED_BEFORE_COMPLETE_AUDIT' };
  }
}
export function proveCurrentNativeSource47(root = ROOT) {
  const proof = verifyCurrentNative47(root);
  return { report: proof.privacyInventory, witness: proof.witness, source47: proof };
}
export { auditCurrentNative47 as auditIosPrivacySource, proveCurrentNativeSource47 as proveCurrentNativeSource46 };
export { IOS_PRIVACY_AUDIT_JSON_PATH, IOS_PRIVACY_AUDIT_MARKDOWN_PATH, IosPrivacyContractError,
  canonicalAuditJson, renderIosPrivacySourceAuditMarkdown, validateIosPrivacyAuditClaims }
  from '../../phase9/ios-privacy-contract.mjs';


// The explicit fourth bridge preserves the frozen release-install tests and
// original auditor. Only this exactly verified current47 step is inverted.
export const RELEASE_INSTALL_STEP47_TEXT = "      - name: Verify installed iOS native sources\n        env:\n          CURRENT_SOURCE_BRANCH: ${{ github.head_ref || github.ref_name }}\n          C47_EXPECTED_HEAD: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n        run: |\n          npm run postinstall:check\n          npm run phase5:expo-widgets-lifecycle:test\n          npm run phase9:view-shot-privacy:test\n          npm run phase9:ios-privacy-source-audit:test\n          if [ \"$CURRENT_SOURCE_BRANCH\" = stage/m1-native-runtime47 ]; then\n            node scripts/release/full-app-j01/native_generated47.mjs --native-audit47 --strict --check\n          else\n            npm run phase9:ios-privacy-source-audit:check\n          fi\n          npm run phase9:ios-archive-privacy-evidence:test\n          npm run phase9:release-candidate-git-contract:test\n          npm run phase9:verification-wiring:test\n          if [ \"$CURRENT_SOURCE_BRANCH\" = stage/m1-native-runtime47 ]; then\n            node scripts/release/full-app-j01/native_generated47.mjs --native-store47 --check\n          else\n            npm run phase9:store-build-inspect:check\n          fi\n\n\n";
const RELEASE_INSTALL_STEP46_TEXT = "      - name: Verify installed iOS native sources\n        run: |\n          npm run postinstall:check\n          npm run phase5:expo-widgets-lifecycle:test\n          npm run phase9:view-shot-privacy:test\n          npm run phase9:ios-privacy-source-audit:test\n          npm run phase9:ios-privacy-source-audit:check\n          npm run phase9:ios-archive-privacy-evidence:test\n          npm run phase9:release-candidate-git-contract:test\n          npm run phase9:verification-wiring:test\n          npm run phase9:store-build-inspect:check\n\n\n";
const RELEASE_INSTALL_STEP47_DOCUMENT = parseDocument(RELEASE_INSTALL_STEP47_TEXT,
  { uniqueKeys: true, merge: false, strict: true });
same(RELEASE_INSTALL_STEP47_DOCUMENT.errors, []); same(RELEASE_INSTALL_STEP47_DOCUMENT.warnings, []);
const RELEASE_INSTALL_STEP47_NODES = RELEASE_INSTALL_STEP47_DOCUMENT.toJS({ maxAliasCount: 0 });
same(RELEASE_INSTALL_STEP47_NODES.length, 1);
const RELEASE_INSTALL_STEP47_VALUE = RELEASE_INSTALL_STEP47_NODES[0];
export function projectReleaseInstallWorkflow47(workflowText) {
  assert.ok(typeof workflowText === 'string' && Buffer.byteLength(workflowText) <= 1024 * 1024);
  const document = parseDocument(workflowText, { uniqueKeys: true, merge: false, strict: true });
  same(document.errors, []); same(document.warnings, []);
  const workflow = document.toJS({ maxAliasCount: 0 });
  const steps = workflow?.jobs?.checks?.steps;
  assert.ok(Array.isArray(steps));
  const candidates = steps.filter(step => step?.name === 'Verify installed iOS native sources');
  same(candidates.length, 1);
  same(candidates[0], RELEASE_INSTALL_STEP47_VALUE);
  same(workflowText.split(RELEASE_INSTALL_STEP47_TEXT).length, 2);
  return workflowText.replace(RELEASE_INSTALL_STEP47_TEXT, RELEASE_INSTALL_STEP46_TEXT);
}
export function auditReleaseInstallWiring47(options, originalAudit) {
  assert.equal(typeof originalAudit, 'function');
  let workflowText;
  try { workflowText = projectReleaseInstallWorkflow47(options.workflowText); }
  catch {
    const original = originalAudit(options);
    // Preserve original refusal errors; an unknown old-flat fixture also refuses.
    return original.status === 'invalid' ? original : Object.freeze({ ...original,
      status: 'invalid', errors: Object.freeze([...original.errors,
        'Current47 native install step is not the exact reviewed successor.']) });
  }
  return originalAudit({ ...options, workflowText });
}
let releaseInstallOriginalAuditor47;
export function auditVerificationWiring(options) {
  return auditReleaseInstallWiring47(options, releaseInstallOriginalAuditor47);
}

async function originalProgramBridge47(mode, arguments47) {
  const root = checkedNativeRoot46(ROOT), source = nativeSourceIdentity46(root);
  const expectedHead = process.env.C47_EXPECTED_HEAD ??
    (mode === 'releaseInstall' ? process.env.C46_EXPECTED_HEAD : undefined) ?? source.sourceHead;
  same(expectedHead, source.sourceHead);
  // Pin from actual Git, so tampered/missing-witness WRITE refusal controls can
  // still execute the immutable original refusal before any current positive.
  same(git47(root, 'show', source.sourceHead + ':scripts/release/full-app-j01/native_generated47.mjs'),
    readNativeFile46(root, 'scripts/release/full-app-j01/native_generated47.mjs').bytes);
  const witnessBytes = git47(root, 'show', source.sourceHead + ':docs/phase-9/ios-sdk-lock-succession46.v1.json');
  same(hash(witnessBytes), LOCK_SUCCESSION46_SHA256);
  const witness = strictJson47(witnessBytes);
  const profiles = {
    config: ['scripts/phase5/check-native-config.mjs', '../release/full-app-j01/native_current46.mjs'],
    audit: ['scripts/phase9/ios-privacy-source-audit.mjs', './ios-privacy-contract.mjs'],
    store: ['scripts/phase9/store-build-inspect.mjs', './ios-privacy-contract.mjs'],
    releaseInstall: ['scripts/phase9/release-install-wiring46.test.mjs', './verification-wiring-contract.mjs'],
  };
  const [path, specifier47] = profiles[mode];
  const pin = [...witness.unchangedInputs, ...witness.currentSourceInputs].find(row => row.path === path);
  assert.ok(pin && pin.status !== 'ABSENT');
  const checker = readNativeFile46(root, path);
  same({ bytes: checker.bytes.length, sha256: checker.sha256 }, { bytes: pin.bytes, sha256: pin.sha256 });
  same(checker.bytes, git47(root, 'show', source.sourceHead + ':' + path));
  if (mode === 'releaseInstall') {
    same(arguments47, []);
    assertCurrentNativeHead46(root.absolute, source.sourceHead);
    const qualityPath = '.github/workflows/quality.yml';
    same(readNativeFile46(root, qualityPath).bytes,
      git47(root, 'show', source.sourceHead + ':' + qualityPath));
    same(checker.bytes, git47(root, 'show', BASE + ':' + path));
    const auditorPath = 'scripts/phase9/verification-wiring-contract.mjs';
    const auditor = readNativeFile46(root, auditorPath);
    same(auditor.bytes, git47(root, 'show', BASE + ':' + auditorPath));
    same(auditor.bytes, git47(root, 'show', source.sourceHead + ':' + auditorPath));
    releaseInstallOriginalAuditor47 = (await import(pathToFileURL(resolve(root.absolute, auditorPath)).href))
      .auditVerificationWiring;
    assert.equal(typeof releaseInstallOriginalAuditor47, 'function');
  }
  const filename = resolve(ROOT, path), parent = pathToFileURL(filename).href;
  let redirected = 0;
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (context.parentURL === parent && specifier === specifier47) {
      redirected += 1;
      return { url: import.meta.url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  const originalArgv = process.argv;
  process.argv = [process.execPath, filename, ...arguments47];
  try { await import(parent); same(redirected, 1); }
  finally { process.argv = originalArgv; hooks.deregister(); }
}

function runCurrentSource47(root, evidenceDirectory) {
  const proof = verifyCurrentNative47(root, { evidenceDirectory });
  const identities = [];
  for (const variant of ['development', 'staging']) {
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/phase5/resolve-ios-extension-config.mjs'), variant],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
    const checked = validateIosExtensionConfig47({ root, config: JSON.parse(result.stdout), variant,
      packageJson: JSON.parse(readFileSync(resolve(root, 'apps/mobile/package.json'))),
      packageLock: JSON.parse(readFileSync(resolve(root, 'package-lock.json'))) });
    same(checked.errors, []); assert.ok(checked.identity); identities.push(checked.identity);
  }
  same(validateIosExtensionVariantIsolation(identities), []);
  const native = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--native-config47'],
    { cwd: root, env: process.env, windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(native.status, 0, native.stderr || native.stdout);
  const after = verifyCurrentNative47(root, { audit: false });
  same(proof.source, after.source); same(proof.installedNativeTrees, after.installedNativeTrees); same(proof.stamps, after.stamps);
  return { ...proof, root: undefined, file: undefined, legacy46File: undefined, witness: undefined,
    legacyAudit: undefined, privacyInventory: undefined, stamps: undefined, identities,
    inputStampsSHA256: hash(Buffer.from(JSON.stringify(proof.stamps))),
    completeInstalledAudit: proof.privacyInventory.summary,
    privacyInventorySHA256: hash(canonicalAuditJson(proof.privacyInventory)),
    rawLegacy46AuditSHA256: hash(canonicalAuditJson(proof.legacyAudit)),
    originalPurposeNativeConfig: { exit: native.status, stdoutSHA256: hash(native.stdout), stderrSHA256: hash(native.stderr),
      qualification: 'UNCHANGED_FULL_CHECKER_SOURCE_ONE_EXACT_CONFIG_VALIDATOR_IMPORT_REDIRECT' } };
}

export function runGenerated47({ root = ROOT, phase, receipt, sourceProof, profile = 'staging', evidenceDirectory }) {
  assert.ok(['SOURCE', 'GENERATED', 'RESOLVED'].includes(phase));
  assert.ok(['staging', 'development'].includes(profile));
  const current = inputs47(root);
  let details;
  if (phase === 'SOURCE') {
    details = { currentNative47: runCurrentSource47(root, evidenceDirectory) };
    same(details.currentNative47.source.sourceHead, current.source.sourceHead);
    same(details.currentNative47.verifiedInputCount, 202);
    same(details.currentNative47.identities.map(value => value.variant).sort(), ['development', 'staging']);
  } else {
    assert.ok(isAbsolute(receipt) && isAbsolute(sourceProof));
    const proofBytes = readSourceProof47(sourceProof);
    const proof = strictJson47(proofBytes);
    same(proof.phase, 'SOURCE');
    same(proof.profiles, ['development', 'staging']);
    same(proof.sourceHead, current.source.sourceHead);
    same(proof.descriptorSHA256, current.file.sha256);
    same(proof.currentNative47.status, 'CURRENT_NATIVE_SOURCE47_SWIFT_SUCCESSOR_REVIEW_REQUIRED');
    same(proof.currentNative47.verifiedInputCount, 202);
    same(proof.currentNative47.consentDoc04, CONSENT_DOC04);
    same(proof.currentNative47.consentApp04, CONSENT_APP04);
    same(proof.currentNative47.legacyFirstSourcePin04, firstLegacySourcePin04(current.witness));
    same(proof.currentNative47.source.sourceHead, current.source.sourceHead);
    const verification = projectedInputs47(current.root, current.witness, current.source.sourceHead, current.descriptor);
    const helper = resolve(root, 'scripts/release/full-app-j01/pods_compat47.py');
    const processResult = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', '-B', helper,
      '--ios-directory', resolve(root, 'apps/mobile/ios'), '--source-proof', sourceProof, '--verify-receipt', receipt,
      '--profile', profile],
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
  return { schema: 1, phase, profile, profiles: ['development', 'staging'],
    status: 'CURRENT_GENERATED47_' + phase + '_VERIFIED_NO_ADMISSION',
    sourceHead: current.source.sourceHead, sourceTree: current.source.sourceTree,
    descriptorSHA256: current.file.sha256, originalNativeObligations: 90,
    mappingSHA256: current.descriptor.obligations.sha256, ...details,
    acceptanceGranted: false, nativeAccepted: false, release: 'NO_GO' };
}

const bridge47 = { '--native-config47': 'config', '--native-audit47': 'audit', '--native-store47': 'store',
  '--release-install-wiring47-test': 'releaseInstall' };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && bridge47[process.argv[2]]) {
  setImmediate(() => originalProgramBridge47(bridge47[process.argv[2]], process.argv.slice(3))
    .catch(error => { console.error(error.message); process.exitCode = 1; }));
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { phase: { type: 'string' }, receipt: { type: 'string' },
    'source-proof': { type: 'string' }, output: { type: 'string' }, profile: { type: 'string', default: 'staging' } } });
  if (values.output) validateOutput47(values.output);
  const result = runGenerated47({ phase: values.phase, receipt: values.receipt,
    sourceProof: values['source-proof'], profile: values.profile,
    evidenceDirectory: values.output ? dirname(resolve(values.output)) : undefined });
  const raw = JSON.stringify(result, null, 2) + '\n';
  if (values.output) {
    const destination = resolve(values.output);
    assert.ok(relative(ROOT, destination).startsWith('..' + sep));
    writeFileSync(destination, raw, { flag: 'wx' });
  }
  console.log(raw.trimEnd());
}
