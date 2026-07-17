#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isReleasePlatformRequired, loadLaunchContract } from '../launch/contract.mjs';
import {
  validateIosExtensionConfig,
  validateIosExtensionVariantIsolation,
} from './ios-extension-contract.mjs';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const launchContract = loadLaunchContract(root);
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function pluginNames(plugins) {
  return new Set((plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)));
}

function pluginNameList(plugins) {
  return (plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
}

function pluginOptions(plugins, name) {
  const plugin = (plugins ?? []).find((candidate) =>
    Array.isArray(candidate) ? candidate[0] === name : candidate === name,
  );
  return Array.isArray(plugin) && typeof plugin[1] === 'object' && plugin[1] !== null
    ? plugin[1]
    : {};
}

const app = readJson('apps/mobile/app.base.json').expo;
const eas = readJson('apps/mobile/eas.json');
const pkg = readJson('apps/mobile/package.json');
const packageLock = readJson('package-lock.json');
const rootPkg = readJson('package.json');
const plugins = pluginNames(app.plugins);
const orderedPlugins = pluginNameList(app.plugins);
const buildProperties = pluginOptions(app.plugins, 'expo-build-properties');
const androidPermissions = new Set(app.android?.permissions ?? []);
const errors = [];
const warnings = [];

function require(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function resolveNonProductionExpoConfig(variant) {
  const probe = spawnSync(
    process.execPath,
    [resolve(root, 'scripts/phase5/resolve-ios-extension-config.mjs'), variant],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env },
      windowsHide: true,
    },
  );
  if (probe.status !== 0) {
    errors.push(
      `${variant}: Expo iOS extension config could not be resolved: ${String(
        probe.stderr || probe.stdout || 'unknown probe failure',
      ).trim()}`,
    );
    return null;
  }
  try {
    return JSON.parse(probe.stdout);
  } catch {
    errors.push(`${variant}: Expo iOS extension config probe returned invalid JSON.`);
    return null;
  }
}

const iosWidgetIdentities = [];
for (const variant of ['development', 'staging']) {
  const resolvedConfig = resolveNonProductionExpoConfig(variant);
  if (!resolvedConfig) continue;
  const validation = validateIosExtensionConfig({
    config: resolvedConfig,
    packageJson: pkg,
    packageLock,
    variant,
  });
  errors.push(...validation.errors);
  if (validation.identity) iosWidgetIdentities.push(validation.identity);
}
errors.push(...validateIosExtensionVariantIsolation(iosWidgetIdentities));
require(iosWidgetIdentities.length ===
  2, 'Both development and staging iOS widget extension identities must resolve.');

const widgetPluginIndex = orderedPlugins.indexOf('expo-widgets');
const widgetPrivacyPluginName = './plugins/withRoutineKindWidgetPrivacyManifest';
const widgetPrivacyPluginIndexes = orderedPlugins.flatMap((name, index) =>
  name === widgetPrivacyPluginName ? [index] : [],
);
const userDefaultsPrivacyEntries = (
  app.ios?.privacyManifests?.NSPrivacyAccessedAPITypes ?? []
).filter((entry) => entry.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults');
require(userDefaultsPrivacyEntries.length === 1 &&
  Array.isArray(userDefaultsPrivacyEntries[0]?.NSPrivacyAccessedAPITypeReasons) &&
  userDefaultsPrivacyEntries[0].NSPrivacyAccessedAPITypeReasons.length === 1 &&
  userDefaultsPrivacyEntries[0].NSPrivacyAccessedAPITypeReasons[0] ===
    '1C8F.1', 'The main iOS privacy manifest must declare exactly UserDefaults reason 1C8F.1 for App Group access.');
require(widgetPluginIndex >= 0 &&
  widgetPrivacyPluginIndexes.length === 1 &&
  widgetPrivacyPluginIndexes[0] ===
    widgetPluginIndex +
      1, 'The widget privacy-manifest plugin must appear exactly once, immediately after expo-widgets.');
require(existsSync(
  resolve(root, 'apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js'),
), 'The widget extension privacy-manifest config plugin source is missing.');
require(String(rootPkg.scripts?.['phase5:ios-extension-contract:smoke'] ?? '').includes(
  'scripts/phase5/widget-privacy-manifest.test.mjs',
), 'The Phase 5 iOS extension smoke command must run the widget privacy-manifest tests.');

const widgetRuntimeGateSource = readFileSync(
  resolve(root, 'apps/mobile/src/features/widgets/runtimeGate.ts'),
  'utf8',
);
const widgetRuntimeGateTestSource = readFileSync(
  resolve(root, 'apps/mobile/src/features/widgets/runtimeGate.test.ts'),
  'utf8',
);
const widgetControllerCoreSource = readFileSync(
  resolve(root, 'apps/mobile/src/features/widgets/controllerCore.ts'),
  'utf8',
);
const widgetControllerCoreTestSource = readFileSync(
  resolve(root, 'apps/mobile/src/features/widgets/controllerCore.test.ts'),
  'utf8',
);
const appConfigSource = readFileSync(resolve(root, 'apps/mobile/app.config.js'), 'utf8');
const appConfigTestSource = readFileSync(
  resolve(root, 'apps/mobile/src/lib/appConfig.test.ts'),
  'utf8',
);
const phase7Source = readFileSync(resolve(root, 'apps/mobile/src/lib/launch/phase7.ts'), 'utf8');
const phase7TestSource = readFileSync(
  resolve(root, 'apps/mobile/src/lib/launch/phase7.test.ts'),
  'utf8',
);
require(/input\.platform === 'ios'/.test(widgetRuntimeGateSource) &&
  /input\.iosWidgetExtensionBuildEnabled === true/.test(widgetRuntimeGateSource) &&
  /input\.appEnvironment !== 'production'/.test(widgetRuntimeGateSource) &&
  /ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED:\s*false\s*=\s*false/.test(
    widgetRuntimeGateSource,
  ) &&
  /ROUTINE_LIVE_ACTIVITY_START_ENABLED:\s*false\s*=\s*false/.test(
    widgetRuntimeGateSource,
  ), 'Widget runtime must require exact iOS/non-production extension opt-in and keep interactive publication plus Live Activity start independently hard-disabled.');
require(/rejects missing, string, numeric, and otherwise truthy config values/.test(
  widgetRuntimeGateTestSource,
) &&
  /keeps interactive publication compile-time hard-disabled/.test(widgetRuntimeGateTestSource) &&
  /keeps Live Activity start\/update independently compile-time hard-disabled/.test(
    widgetRuntimeGateTestSource,
  ), 'Widget runtime gate tests must pin exact-boolean opt-in and both hard-disabled interactive contracts.');
const widgetControllerOrder = [
  'await dependencies.resolveActions({',
  'await dependencies.completeAction(',
  'const nativeResult =',
  'await dependencies.acknowledgeActions({',
].map((needle) => widgetControllerCoreSource.indexOf(needle));
require(widgetControllerOrder.every((index) => index >= 0) &&
  widgetControllerOrder.every((index, position) =>
    position === 0 ? true : index > widgetControllerOrder[position - 1],
  ) &&
  /acknowledged !== acceptedTokens\.length/.test(widgetControllerCoreSource) &&
  /expectedRevision: outbox\.records\[outbox\.records\.length - 1\]/.test(
    widgetControllerCoreSource,
  ) &&
  /dependencies\.commitReconciliation\(reconciliationInput\)/.test(widgetControllerCoreSource) &&
  /dependencies\.commitCapturedReconciliation\(\{\s*\.\.\.reconciliationInput,\s*quiescenceNonce,\s*\}\)/.test(
    widgetControllerCoreSource,
  ) &&
  /record\.snapshotNonce !== first\.snapshotNonce/.test(widgetControllerCoreSource) &&
  /outbox\.authorityNonce !== authority\.authorityNonce/.test(widgetControllerCoreSource) &&
  /capturedGeneration !== this\.generation/.test(widgetControllerCoreSource) &&
  !/from ['"]expo-widgets['"]/.test(
    widgetControllerCoreSource,
  ), 'The widget controller core must remain injected and enforce native outbox binding, resolve -> canonical completion -> normal or captured native CAS/redaction -> exact private acknowledgement, with generation invalidation.');
require(/orders resolve-all, canonical writes, native CAS, then private acknowledgement/.test(
  widgetControllerCoreTestSource,
) &&
  /passes only resolved tokens so any unknown capability atomically redacts native state/.test(
    widgetControllerCoreTestSource,
  ) &&
  /does not consume native or private state after a canonical failure/.test(
    widgetControllerCoreTestSource,
  ) &&
  /invalidates an awaiting generation before native CAS or private acknowledgement/.test(
    widgetControllerCoreTestSource,
  ) &&
  /rejects a mixed snapshot batch before any canonical or private work/.test(
    widgetControllerCoreTestSource,
  ), 'Widget controller tests must pin one-binding native outbox reconciliation, all-or-redact ordering, and generation invalidation.');
require(/\(isProduction \|\| appEnvironment === 'production'\) &&\s*iosWidgetExtensionBuildEnabled/.test(
  appConfigSource,
) &&
  /Production iOS widget extension builds remain blocked/.test(appConfigSource) &&
  /keeps the unfinished iOS extension out of ordinary builds and requires an exact opt-in/.test(
    appConfigTestSource,
  ), 'Production variant or production runtime must reject the iOS extension opt-in and retain a pinned app-config test.');
require(/nativeWidgets:\s*false/.test(phase7Source) &&
  /expect\(phase7Flags\.widgets\)\.toBe\(false\)/.test(
    phase7TestSource,
  ), 'The public Phase 7 widget capability must remain hard-disabled and covered by tests.');
const widgetRuntimeSmoke = String(rootPkg.scripts?.['phase5:widget-runtime-contract:smoke'] ?? '');
for (const file of [
  'runtimeGate.test.ts',
  'nativeLifecycleContract.test.ts',
  'nativeLifecycleBridge.test.ts',
  'nativeOutboxModel.test.ts',
  'ownerAuthority.test.ts',
  'controllerCore.test.ts',
  'lifecycleCoordinator.test.ts',
  'lifecycleRuntime.test.ts',
  'RoutineWidgetLifecycleHost.test.ts',
  'actionRegistry.test.ts',
  'contract.test.ts',
  'widgetViews.test.ts',
]) {
  require(widgetRuntimeSmoke.includes(
    file,
  ), `The Phase 5 widget runtime smoke command must run ${file}.`);
}
require(String(rootPkg.scripts?.['phase5:verify'] ?? '').includes(
  'phase5:widget-runtime-contract:smoke',
) &&
  String(rootPkg.scripts?.['launch:verify'] ?? '').includes(
    'phase5:widget-runtime-contract:smoke',
  ), 'Phase 5 and launch verification must run the explicit widget runtime contract smoke.');
for (const script of [
  'phase5:widget-lifecycle-evidence',
  'phase5:widget-lifecycle-evidence:strict',
  'phase5:widget-lifecycle-evidence:smoke',
  'phase5:widget-lifecycle-evidence:template',
  'phase5:widget-lifecycle-evidence:template:check',
]) {
  require(Boolean(rootPkg.scripts?.[script]), `Root package is missing ${script}.`);
}
require(String(rootPkg.scripts?.['phase5:verify'] ?? '').includes(
  'phase5:widget-lifecycle-evidence:smoke',
) &&
  String(rootPkg.scripts?.['phase5:verify'] ?? '').includes(
    'phase5:widget-lifecycle-evidence:template:check',
  ) &&
  String(rootPkg.scripts?.['launch:verify'] ?? '').includes(
    'phase5:widget-lifecycle-evidence',
  ), 'Phase 5 and launch verification must execute the artifact-bound widget lifecycle evidence gates.');

require(Boolean(pkg.dependencies?.['expo-camera']), 'expo-camera dependency is missing.');
require(Boolean(
  pkg.dependencies?.['expo-apple-authentication'],
), 'expo-apple-authentication dependency is missing.');
require(Boolean(
  pkg.dependencies?.['@infinitered/react-native-mlkit-face-detection'],
), 'on-device post-capture face detection dependency is missing.');
require(Boolean(
  pkg.dependencies?.['expo-image-manipulator'],
), 'on-device post-capture image sampling dependency is missing.');
require(Boolean(pkg.dependencies?.['jpeg-js']), 'post-capture luminance decoder is missing.');
require(Boolean(
  pkg.dependencies?.['expo-build-properties'],
), 'expo-build-properties dependency is missing; Android minSdk support floor is not enforceable.');
require(plugins.has('expo-camera'), 'expo-camera config plugin is missing.');
require(plugins.has(
  'expo-apple-authentication',
), 'expo-apple-authentication config plugin is missing; standalone iOS builds would lack the native Sign in with Apple setup.');
require(app.ios?.usesAppleSignIn ===
  true, 'ios.usesAppleSignIn must be true so signed iOS builds declare the Sign in with Apple capability.');
require(plugins.has(
  'expo-build-properties',
), 'expo-build-properties config plugin is missing; Android minSdk support floor is not enforceable.');
require(plugins.has('expo-notifications'), 'expo-notifications config plugin is missing.');
require(Boolean(
  app.runtimeVersion,
), 'runtimeVersion is missing; OTA/native mismatches are not guarded.');
require(app.runtimeVersion?.policy ===
  'fingerprint', 'runtimeVersion should use the fingerprint policy for native-code-aware updates.');
require(androidPermissions.has(
  'android.permission.CAMERA',
), 'Android CAMERA permission is missing.');
require(!androidPermissions.has(
  'android.permission.RECORD_AUDIO',
), 'Android RECORD_AUDIO is present but V1 camera flows do not need microphone access.');
require(!androidPermissions.has(
  'android.permission.USE_EXACT_ALARM',
), 'USE_EXACT_ALARM must not be requested for V1 skincare reminders.');
require(!androidPermissions.has(
  'android.permission.SCHEDULE_EXACT_ALARM',
), 'SCHEDULE_EXACT_ALARM must not be requested for V1 skincare reminders.');
require(app.ios?.deploymentTarget ===
  launchContract.release
    .minimumIosVersion, `iOS deployment target must stay at ${launchContract.release.minimumIosVersion}+ for the launch support floor.`);
require(buildProperties.android?.minSdkVersion ===
  29, 'Android minSdkVersion must stay at API 29 / Android 10+ for the launch support floor.');
require(buildProperties.android?.compileSdkVersion ===
  36, 'Android compileSdkVersion must stay at API 36 for Expo SDK 56 native builds.');
require(buildProperties.android?.targetSdkVersion ===
  36, 'Android targetSdkVersion must stay at API 36 for current Play target policy.');
require(Boolean(
  app.ios?.infoPlist?.NSCameraUsageDescription,
), 'iOS NSCameraUsageDescription is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/encryptedStorage.ts'),
), 'Encrypted photo storage module is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/captureAnalysis.ts'),
), 'Measured post-capture quality analysis module is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/useCaptureAnalysis.ts'),
), 'Post-capture quality analysis orchestration is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/CaptureAnalysisProvider.native.tsx'),
), 'Native post-capture analysis provider is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/CaptureAnalysisProvider.tsx'),
), 'Web-safe post-capture analysis provider fallback is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/useDetectedFaces.native.ts'),
), 'Native on-device face detection adapter is missing.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/photos/useDetectedFaces.ts'),
), 'Web-safe face detection adapter fallback is missing.');
const photoConsentSource = readFileSync(
  resolve(root, 'apps/mobile/src/features/photos/consent.ts'),
  'utf8',
);
const photoStoreSource = readFileSync(
  resolve(root, 'apps/mobile/src/features/photos/store.ts'),
  'utf8',
);
const rootLayoutSource = readFileSync(resolve(root, 'apps/mobile/src/app/_layout.tsx'), 'utf8');
const settingsSource = readFileSync(resolve(root, 'apps/mobile/src/app/(tabs)/you.tsx'), 'utf8');
require(/PHOTO_CLOUD_BACKUP_AVAILABLE\s*=\s*false/.test(photoConsentSource) &&
  /clearUnavailableCloudBackupPreference/.test(photoConsentSource) &&
  !/setCloudBackupEnabled/.test(
    photoConsentSource,
  ), 'Unavailable photo backup must have no runtime setter and must clear stale enablement.');
require(/clearUnavailableCloudBackupPreference/.test(
  rootLayoutSource,
), 'Root startup must clear stale photo-backup enablement.');
require(!/supabase\.from\(['"]photos['"]\)\.insert/.test(photoStoreSource) &&
  !/getCloudBackupEnabled/.test(
    photoStoreSource,
  ), 'Local photo save must not mirror images or metadata to Supabase.');
require(/Progress photo storage/.test(settingsSource) &&
  /Cloud backup is not available in this build/.test(settingsSource) &&
  !/accessibilityLabel=['"]Encrypted cloud backup['"]/.test(settingsSource) &&
  !/cloud_backup_opted_in/.test(
    settingsSource,
  ), 'Settings must expose device-only photo storage without a backup toggle or opt-in event.');
require(!existsSync(
  resolve(root, 'apps/mobile/src/features/native/camera/guidedSignals.ts'),
), 'Synthetic timer-driven camera quality signals must not be restored.');
require(!existsSync(
  resolve(root, 'apps/mobile/src/features/photos/mockSignals.ts'),
), 'Synthetic captured-photo quality scores must not be restored.');
require(existsSync(
  resolve(root, 'apps/mobile/src/features/native/camera/barcode.ts'),
), 'Barcode normalization module is missing.');

require(eas.cli?.version === '21.0.1', 'EAS CLI must be pinned to the reviewed 21.0.1 release.');
require(eas.cli?.requireCommit === true, 'EAS builds must require committed source before upload.');
require(eas.cli?.appVersionSource ===
  'local', 'EAS app-version source must remain local for reviewed release manifests.');

for (const profile of ['development', 'staging', 'production']) {
  const env = eas.build?.[profile]?.env ?? {};
  require(Boolean(eas.build?.[profile]), `EAS profile ${profile} is missing.`);
  require(eas.build?.[profile]?.ios?.image ===
    'macos-tahoe-26.4-xcode-26.4', `EAS profile ${profile} must use the reviewed full Expo iOS image name (Xcode 26.4 / iOS 26.4 SDK); confirm the resolved image and toolchain in every build log because Expo may apply minor image updates.`);
  require(env.APP_VARIANT === profile, `EAS profile ${profile} must set APP_VARIANT=${profile}.`);
  require(env.EXPO_PUBLIC_NATIVE_CAMERA_ENABLED ===
    'true', `EAS profile ${profile} must enable native camera explicitly.`);
  require(env.EXPO_PUBLIC_CAMERA_STACK ===
    'expo-camera', `EAS profile ${profile} must declare EXPO_PUBLIC_CAMERA_STACK=expo-camera.`);
  warn(
    env.EXPO_PUBLIC_NATIVE_OCR_ENABLED === 'true',
    `EAS profile ${profile} has native OCR disabled; label capture remains editable/manual until ML Kit/Vision passes QA.`,
  );
}

const productionEnv = eas.build?.production?.env ?? {};
const productionIdentityKeys = [
  'BRAND_LEGAL_CLEARANCE',
  'APP_DISPLAY_NAME',
  'APP_SLUG',
  'APP_SCHEME',
  'APP_IOS_BUNDLE_IDENTIFIER',
  ...(androidReleaseRequired ? ['APP_ANDROID_PACKAGE'] : []),
];
const missingProductionIdentityKeys = productionIdentityKeys.filter((key) => !productionEnv[key]);
warn(
  missingProductionIdentityKeys.length === 0,
  `Production EAS profile does not declare final native identity keys (${missingProductionIdentityKeys.join(
    ', ',
  )}); supply them as EAS env/secrets after brand clearance before building production.`,
);

warn(
  productionEnv.PHASE3_RELEASE_CLEARANCE === 'cleared',
  'Production EAS environment is missing PHASE3_RELEASE_CLEARANCE=cleared; supply it only after the signed Phase 3 review packet, release-disposition worklist, detached item signoffs, current source/signoff hashes, and strict copy audit are complete.',
);

warn(
  productionEnv.EXPORT_COMPLIANCE_CLEARANCE === 'cleared' &&
    ['exempt', 'non_exempt'].includes(productionEnv.APP_ENCRYPTION_CLASSIFICATION),
  'Production EAS environment is missing a reviewed export declaration. Supply EXPORT_COMPLIANCE_CLEARANCE=cleared and APP_ENCRYPTION_CLASSIFICATION=exempt|non_exempt only after the exact binary and launch territories are classified.',
);
if (productionEnv.APP_ENCRYPTION_CLASSIFICATION === 'non_exempt') {
  warn(
    Boolean(productionEnv.APP_ENCRYPTION_EXPORT_COMPLIANCE_CODE),
    'Non-exempt encryption classification requires the App Store Connect compliance code in APP_ENCRYPTION_EXPORT_COMPLIANCE_CODE.',
  );
}

warn(
  Boolean(rootPkg.scripts?.['phase5:qa-packet']),
  'Root package is missing phase5:qa-packet script.',
);
warn(Boolean(rootPkg.scripts?.['phase5:verify']), 'Root package is missing phase5:verify script.');

const qaPacketBuilder = readFileSync(
  resolve(root, 'scripts/phase5/build-device-qa-packet.mjs'),
  'utf8',
);
const qaPacketSmoke = readFileSync(
  resolve(root, 'scripts/phase5/device-qa-packet-smoke.mjs'),
  'utf8',
);
require(/validateWidgetLifecycleEvidence/.test(qaPacketBuilder) &&
  /PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH/.test(qaPacketBuilder) &&
  /widgetLifecycleEvidence/.test(
    qaPacketBuilder,
  ), 'Phase 5 device QA packet must validate and retain artifact-bound widget lifecycle evidence; booleans alone are insufficient.');
require(/rejects widget booleans without artifact-bound evidence/.test(qaPacketSmoke) &&
  /widgetLifecycleEvidence\.summary\.baseArtifactCount === 11/.test(qaPacketSmoke) &&
  /widgetLifecycleEvidence\.summary\.proofAttachmentCount === 4/.test(
    qaPacketSmoke,
  ), 'Phase 5 QA packet smoke must reject boolean-only widget claims and require all 11 parsed base artifacts/reports plus typed proofs.');
require(/function gitStatusExcludingGeneratedPacket\(validatedEvidencePaths = \[\]\)/.test(
  qaPacketBuilder,
) &&
  /gitStatusExcludingGeneratedEvidence/.test(qaPacketBuilder) &&
  /device-qa-packet\.json/.test(qaPacketBuilder) &&
  /device-qa-packet\.md/.test(qaPacketBuilder) &&
  /gitStatus = gitStatusExcludingGeneratedPacket\(validatedWidgetEvidencePaths\)/.test(
    qaPacketBuilder,
  ), 'Phase 5 device QA packet must ignore central generated evidence, its own outputs, and only fully validated lifecycle evidence when recording Git status.');
require(/Phase 5 device QA packet generated with a dirty Git worktree/.test(qaPacketBuilder) &&
  /if \(strict\) blockers\.push\(dirtyMessage\)/.test(qaPacketBuilder) &&
  /strict Phase 5 QA packet rejects a dirty source worktree/.test(qaPacketSmoke) &&
  /non-strict Phase 5 QA packet warns on dirty source/.test(qaPacketSmoke) &&
  /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(
    qaPacketBuilder,
  ), 'Phase 5 strict QA must reject dirty source, while non-strict warns and Markdown exposes Git status.');
for (const file of [
  '.env.example',
  'package.json',
  'package-lock.json',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/src/lib/appConfig.test.ts',
  'apps/mobile/src/lib/launch/phase7.ts',
  'apps/mobile/src/lib/launch/phase7.test.ts',
  'apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js',
  'apps/mobile/eas.json',
  'apps/mobile/package.json',
  'apps/mobile/src/app/_layout.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
  'apps/mobile/src/features/photos/analyzePhotoLighting.ts',
  'apps/mobile/src/features/photos/CaptureAnalysisProvider.native.tsx',
  'apps/mobile/src/features/photos/CaptureAnalysisProvider.tsx',
  'apps/mobile/src/features/photos/captureAnalysis.ts',
  'apps/mobile/src/features/photos/consent.ts',
  'apps/mobile/src/features/photos/useCaptureAnalysis.ts',
  'apps/mobile/src/features/photos/useDetectedFaces.native.ts',
  'apps/mobile/src/features/photos/useDetectedFaces.ts',
  'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  'apps/mobile/src/features/today/completionsStore.ts',
  'apps/mobile/src/features/today/completionsStore.test.ts',
  'apps/mobile/src/features/today/routineProjection.ts',
  'apps/mobile/src/features/today/routineProjection.test.ts',
  'apps/mobile/src/features/widgets/actionRegistry.ts',
  'apps/mobile/src/features/widgets/actionRegistry.test.ts',
  'apps/mobile/src/features/widgets/contract.ts',
  'apps/mobile/src/features/widgets/contract.test.ts',
  'apps/mobile/src/features/widgets/controllerCore.ts',
  'apps/mobile/src/features/widgets/controllerCore.test.ts',
  'apps/mobile/src/features/widgets/nativeLifecycle.ts',
  'apps/mobile/src/features/widgets/nativeLifecycle.ios.ts',
  'apps/mobile/src/features/widgets/nativeLifecycleContract.ts',
  'apps/mobile/src/features/widgets/nativeLifecycleContract.test.ts',
  'apps/mobile/src/features/widgets/nativeLifecycleBridge.test.ts',
  'apps/mobile/src/features/widgets/nativeOutboxModel.ts',
  'apps/mobile/src/features/widgets/nativeOutboxModel.test.ts',
  'apps/mobile/src/features/widgets/ownerAuthority.ts',
  'apps/mobile/src/features/widgets/ownerAuthority.test.ts',
  'apps/mobile/src/features/widgets/lifecycleCoordinator.ts',
  'apps/mobile/src/features/widgets/lifecycleCoordinator.test.ts',
  'apps/mobile/src/features/widgets/lifecycleRuntime.ts',
  'apps/mobile/src/features/widgets/lifecycleRuntime.ios.ts',
  'apps/mobile/src/features/widgets/lifecycleRuntime.test.ts',
  'apps/mobile/src/features/widgets/RoutineWidgetLifecycleHost.tsx',
  'apps/mobile/src/features/widgets/RoutineWidgetLifecycleHost.test.ts',
  'apps/mobile/src/features/widgets/runtimeGate.ts',
  'apps/mobile/src/features/widgets/runtimeGate.test.ts',
  'apps/mobile/src/features/widgets/TodayWidget.ios.tsx',
  'apps/mobile/src/features/widgets/TonightActivity.ios.tsx',
  'apps/mobile/src/features/widgets/widgetViews.test.ts',
  'packages/types/src/database.types.ts',
  'supabase/migrations/20260710000036_photo_quality_provenance.sql',
  'supabase/migrations/20260713000045_anonymous_photo_storage_guard.sql',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts',
  'apps/mobile/src/features/healthConsent/HealthDataActivationMount.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataActivationMount.test.ts',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx',
  'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.navigation.test.ts',
  'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
  'apps/mobile/src/features/healthConsent/selectiveCleanup.ts',
  'apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts',
  'apps/mobile/src/features/settings/accountDeletionRecovery.ts',
  'apps/mobile/src/features/settings/accountDeletionRecovery.test.ts',
  'apps/mobile/src/features/settings/localPrivateData.ts',
  'apps/mobile/src/features/settings/localPrivateData.test.ts',
  'apps/mobile/src/lib/auth/AuthProvider.tsx',
  'apps/mobile/src/lib/auth/authDerivedCleanupAuthProviderContracts.test.ts',
  'apps/mobile/src/lib/auth/revokedCredentialActivity.ts',
  'apps/mobile/src/lib/auth/revokedCredentialActivity.test.ts',
  'scripts/postinstall.mjs',
  'scripts/phase5/patch-expo-widgets-lifecycle.mjs',
  'scripts/phase5/patch-expo-widgets-lifecycle.test.mjs',
  'scripts/phase5/expo-widgets-lifecycle-source.test.mjs',
  'scripts/phase5/expo-widgets-56.0.23/RoutineKindWidgetLifecycleStore.swift',
  'scripts/phase5/expo-widgets-56.0.23/AppIntent.swift',
  'scripts/phase5/expo-widgets-56.0.23/EntryView.swift',
  'scripts/phase5/expo-widgets-56.0.23/ExpoWidgets.podspec',
  'scripts/phase5/expo-widgets-56.0.23/LiveActivity.swift',
  'scripts/phase5/expo-widgets-56.0.23/LiveActivityFactory.swift',
  'scripts/phase5/expo-widgets-56.0.23/TimelineProvider.swift',
  'scripts/phase5/expo-widgets-56.0.23/Utils.swift',
  'scripts/phase5/expo-widgets-56.0.23/WidgetLiveActivity.swift',
  'scripts/phase5/expo-widgets-56.0.23/WidgetObject.swift',
  'scripts/phase5/expo-widgets-56.0.23/WidgetsModule.swift',
  'scripts/phase5/build-device-qa-packet.mjs',
  'scripts/phase5/check-native-config.mjs',
  'scripts/phase5/ios-extension-contract.mjs',
  'scripts/phase5/ios-extension-contract.test.mjs',
  'scripts/phase5/widget-privacy-manifest.test.mjs',
  'scripts/phase5/widget-lifecycle-evidence-contract.mjs',
  'scripts/phase5/check-widget-lifecycle-evidence.mjs',
  'scripts/phase5/widget-lifecycle-evidence-smoke.mjs',
  'scripts/phase5/resolve-ios-extension-config.mjs',
  'scripts/phase5/check-performance-evidence.mjs',
  'scripts/phase5/device-qa-packet-smoke.mjs',
  'scripts/phase5/performance-evidence-contract.mjs',
  'scripts/phase5/performance-evidence-smoke.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/phase2/supabase-rls-smoke.mjs',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/live-supabase-adversarial.mjs',
  'scripts/phase9/rls-adversarial-smoke.mjs',
  'scripts/phase9/rls-adversarial.mjs',
  'docs/DEVICE_SUPPORT_POLICY.md',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-5/native-build-runbook.md',
  'docs/phase-5/widget-lifecycle-evidence.template.json',
  'docs/phase-5/device-qa-checklist.md',
  'docs/phase-5/performance-evidence-runbook.md',
  'docs/phase-5/performance-evidence.template.json',
  'docs/phase-5/phase-5-exit-review.md',
]) {
  require(qaPacketBuilder.includes(`'${file}'`) ||
    qaPacketBuilder.includes(`"${file}"`), `Phase 5 device QA packet must hash ${file}.`);
}

console.log('Phase 5 native config check');
if (!androidReleaseRequired) {
  console.log('N/A Android production identity and device evidence: excluded by launch contract.');
}
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`FAIL ${error}`);

if (errors.length > 0) {
  console.error(
    `\nPhase 5 native config has ${errors.length} blocker${errors.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

if (warnings.length > 0 && strict) {
  console.error(
    `\nPhase 5 strict mode failed on ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
  );
  process.exit(1);
}

console.log('\nPhase 5 native config baseline is present.');
