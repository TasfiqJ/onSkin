#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function pluginNames(plugins) {
  return new Set((plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)));
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
const rootPkg = readJson('package.json');
const plugins = pluginNames(app.plugins);
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

require(Boolean(pkg.dependencies?.['expo-camera']), 'expo-camera dependency is missing.');
require(Boolean(
  pkg.dependencies?.['expo-build-properties'],
), 'expo-build-properties dependency is missing; Android minSdk support floor is not enforceable.');
require(plugins.has('expo-camera'), 'expo-camera config plugin is missing.');
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
  '17.0', 'iOS deployment target must stay at 17.0+ for the launch support floor.');
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
  resolve(root, 'apps/mobile/src/features/native/camera/barcode.ts'),
), 'Barcode normalization module is missing.');

for (const profile of ['development', 'staging', 'production']) {
  const env = eas.build?.[profile]?.env ?? {};
  require(Boolean(eas.build?.[profile]), `EAS profile ${profile} is missing.`);
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
  'APP_ANDROID_PACKAGE',
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
  Boolean(rootPkg.scripts?.['phase5:qa-packet']),
  'Root package is missing phase5:qa-packet script.',
);
warn(Boolean(rootPkg.scripts?.['phase5:verify']), 'Root package is missing phase5:verify script.');

const qaPacketBuilder = readFileSync(
  resolve(root, 'scripts/phase5/build-device-qa-packet.mjs'),
  'utf8',
);
require(/function gitStatusExcludingGeneratedPacket\(\)/.test(qaPacketBuilder) &&
  /device-qa-packet\.json/.test(qaPacketBuilder) &&
  /device-qa-packet\.md/.test(qaPacketBuilder) &&
  /gitStatus = gitStatusExcludingGeneratedPacket\(\)/.test(
    qaPacketBuilder,
  ), 'Phase 5 device QA packet must ignore only its own generated outputs when recording Git status.');
require(/Phase 5 device QA packet generated with a dirty Git worktree/.test(qaPacketBuilder) &&
  /Git status: \$\{packet\.gitStatus \? 'DIRTY' : 'clean'\}/.test(
    qaPacketBuilder,
  ), 'Phase 5 device QA packet must warn on dirty worktrees and expose Git status in Markdown.');
for (const file of [
  'package.json',
  'apps/mobile/app.base.json',
  'apps/mobile/app.config.js',
  'apps/mobile/eas.json',
  'apps/mobile/src/lib/iap/revenuecat.ts',
  'scripts/phase5/build-device-qa-packet.mjs',
  'scripts/phase5/check-native-config.mjs',
  'scripts/phase5/check-performance-evidence.mjs',
  'scripts/phase5/device-qa-packet-smoke.mjs',
  'scripts/phase5/performance-evidence-contract.mjs',
  'scripts/phase5/performance-evidence-smoke.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/phase9/lib.mjs',
  'docs/DEVICE_SUPPORT_POLICY.md',
  'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  'docs/E2E_TESTING_CHECKLIST.md',
  'docs/USER_FLOW_TREE.md',
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
  'docs/phase-5/native-build-runbook.md',
  'docs/phase-5/device-qa-checklist.md',
  'docs/phase-5/performance-evidence-runbook.md',
  'docs/phase-5/performance-evidence.template.json',
  'docs/phase-5/phase-5-exit-review.md',
]) {
  require(qaPacketBuilder.includes(`'${file}'`) ||
    qaPacketBuilder.includes(`"${file}"`), `Phase 5 device QA packet must hash ${file}.`);
}

console.log('Phase 5 native config check');
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
