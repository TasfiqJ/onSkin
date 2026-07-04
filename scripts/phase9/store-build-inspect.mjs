#!/usr/bin/env node
import { block, envSnapshot, exists, hash, printResult, read, warn, write } from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const app = JSON.parse(read('apps/mobile/app.base.json')).expo;
const eas = JSON.parse(read('apps/mobile/eas.json'));
const artifacts = {};

block(errors, Boolean(app.version), 'App version is missing.');
block(errors, Boolean(app.runtimeVersion), 'runtimeVersion is missing.');
block(errors, Boolean(app.ios?.bundleIdentifier), 'iOS bundle identifier is missing.');
block(errors, Boolean(app.android?.package), 'Android package is missing.');
block(errors, eas?.build?.production?.channel === 'production', 'Production EAS build must use production channel.');
block(errors, eas?.build?.production?.autoIncrement === true, 'Production EAS build should auto-increment native build numbers.');
block(errors, /NSCameraUsageDescription/.test(JSON.stringify(app.ios ?? {})), 'iOS camera privacy string is missing.');
block(errors, /NSFaceIDUsageDescription/.test(JSON.stringify(app.ios ?? {})), 'iOS Face ID privacy string is missing.');

const androidPermissions = new Set(app.android?.permissions ?? []);
for (const permission of androidPermissions) {
  block(
    errors,
    ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'].includes(permission),
    `Unexpected Android permission requires review: ${permission}.`,
  );
}

for (const [key, label] of [
  ['PHASE9_IOS_ARTIFACT', 'iOS artifact'],
  ['PHASE9_ANDROID_ARTIFACT', 'Android artifact'],
]) {
  const path = env[key];
  if (path && exists(path)) artifacts[key] = { path, sha256: hash(path) };
  else warn(warnings, false, `${label} not supplied for hashing: set ${key}=path.`);
}

warn(warnings, env.PHASE9_IOS_TESTFLIGHT_PASS === 'true', 'Missing TestFlight evidence: PHASE9_IOS_TESTFLIGHT_PASS=true.');
warn(warnings, env.PHASE9_ANDROID_CLOSED_TEST_PASS === 'true', 'Missing Play internal/closed testing evidence: PHASE9_ANDROID_CLOSED_TEST_PASS=true.');
warn(warnings, env.PHASE9_ANDROID_TARGET_API_PASS === 'true', 'Missing Android target API proof from built artifact: PHASE9_ANDROID_TARGET_API_PASS=true.');
warn(warnings, env.PHASE9_ANDROID_16KB_PASS === 'true', 'Missing Android 16 KB page-size proof: PHASE9_ANDROID_16KB_PASS=true.');
warn(warnings, env.PHASE9_IOS_PRIVACY_REPORT_PASS === 'true', 'Missing iOS privacy report/privacy manifest evidence: PHASE9_IOS_PRIVACY_REPORT_PASS=true.');
warn(warnings, env.PHASE9_APP_STORE_PACKET_PASS === 'true', 'Missing App Store review packet evidence: PHASE9_APP_STORE_PACKET_PASS=true.');
warn(warnings, env.PHASE9_PLAY_PACKET_PASS === 'true', 'Missing Google Play review packet evidence: PHASE9_PLAY_PACKET_PASS=true.');

write(
  'docs/phase-9/generated/store-build-inspection.json',
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      app: {
        name: app.name,
        slug: app.slug,
        version: app.version,
        runtimeVersion: app.runtimeVersion,
        scheme: app.scheme,
        iosBundleIdentifier: app.ios?.bundleIdentifier,
        androidPackage: app.android?.package,
        androidPermissions: [...androidPermissions],
      },
      easProduction: eas.build?.production ?? null,
      artifacts,
      blockers: errors,
      warnings,
    },
    null,
    2,
  )}\n`,
);

printResult('Phase 9 store build inspection', errors, warnings);
