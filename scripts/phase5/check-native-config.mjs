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

const app = readJson('apps/mobile/app.base.json').expo;
const eas = readJson('apps/mobile/eas.json');
const pkg = readJson('apps/mobile/package.json');
const rootPkg = readJson('package.json');
const plugins = pluginNames(app.plugins);
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
require(plugins.has('expo-camera'), 'expo-camera config plugin is missing.');
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
  Boolean(rootPkg.scripts?.['phase5:qa-packet']),
  'Root package is missing phase5:qa-packet script.',
);
warn(Boolean(rootPkg.scripts?.['phase5:verify']), 'Root package is missing phase5:verify script.');

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
