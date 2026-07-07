#!/usr/bin/env node
import { createRequire } from 'node:module';

import {
  block,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  hash,
  printResult,
  read,
  strict,
  warn,
  write,
} from './lib.mjs';

const errors = [];
const warnings = [];
const env = envSnapshot();
const app = JSON.parse(read('apps/mobile/app.base.json')).expo;
const eas = JSON.parse(read('apps/mobile/eas.json'));
const artifacts = {};
const require = createRequire(import.meta.url);
const appConfigPath = require.resolve('../../apps/mobile/app.config.js');
const variants = ['development', 'staging', 'production'];
const productionIdentityConfigErrorPatterns = [
  /BRAND_LEGAL_CLEARANCE=cleared/,
  /explicit final native identity env values/,
];

function appConfigForVariant(variant) {
  const previousVariant = process.env.APP_VARIANT;
  const previousEnv = process.env.EXPO_PUBLIC_APP_ENV;
  process.env.APP_VARIANT = variant;
  process.env.EXPO_PUBLIC_APP_ENV = variant;
  delete require.cache[appConfigPath];

  try {
    return { config: require(appConfigPath)().expo, error: null };
  } catch (error) {
    return {
      config: null,
      error: error instanceof Error ? error.message : `Unable to resolve ${variant} app config.`,
    };
  } finally {
    delete require.cache[appConfigPath];
    if (previousVariant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previousVariant;
    if (previousEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = previousEnv;
  }
}

function expectedVariantValue(baseValue, variant) {
  return variant === 'production' ? baseValue : `${baseValue}.${variant}`;
}

function isProductionIdentityConfigBlock(variant, error) {
  return (
    variant === 'production' &&
    productionIdentityConfigErrorPatterns.some((pattern) => pattern.test(error ?? ''))
  );
}

block(errors, Boolean(app.version), 'App version is missing.');
block(
  errors,
  app.runtimeVersion?.policy === 'fingerprint',
  'runtimeVersion must use the fingerprint policy for native-compatible OTA updates.',
);
block(errors, Boolean(app.ios?.bundleIdentifier), 'iOS bundle identifier is missing.');
block(errors, Boolean(app.android?.package), 'Android package is missing.');
block(
  errors,
  app.android?.allowBackup === false,
  'Android Auto Backup must be disabled for local health-adjacent stores.',
);
block(
  errors,
  eas?.cli?.appVersionSource === 'local',
  'EAS appVersionSource must stay local for reviewed release manifests.',
);
block(
  errors,
  eas?.build?.production?.channel === 'production',
  'Production EAS build must use production channel.',
);
block(
  errors,
  eas?.build?.production?.distribution === 'store',
  'Production EAS build must use store distribution.',
);
block(
  errors,
  eas?.build?.production?.autoIncrement === true,
  'Production EAS build should auto-increment native build numbers.',
);
block(
  errors,
  /NSCameraUsageDescription/.test(JSON.stringify(app.ios ?? {})),
  'iOS camera privacy string is missing.',
);
block(
  errors,
  /NSFaceIDUsageDescription/.test(JSON.stringify(app.ios ?? {})),
  'iOS Face ID privacy string is missing.',
);

for (const variant of variants) {
  const profile = eas.build?.[variant];
  block(errors, Boolean(profile), `EAS build profile is missing: ${variant}.`);
  if (!profile) continue;
  block(
    errors,
    profile.channel === variant,
    `EAS ${variant} build must publish to ${variant} channel.`,
  );
  block(
    errors,
    profile.env?.APP_VARIANT === variant,
    `EAS ${variant} build must set APP_VARIANT=${variant}.`,
  );
  block(
    errors,
    profile.env?.EXPO_PUBLIC_APP_ENV === variant,
    `EAS ${variant} build must set EXPO_PUBLIC_APP_ENV=${variant}.`,
  );
}

block(
  errors,
  eas.build?.development?.developmentClient === true,
  'Development profile must be a development client.',
);
block(
  errors,
  eas.build?.development?.distribution === 'internal',
  'Development profile must use internal distribution.',
);
block(
  errors,
  eas.build?.staging?.distribution === 'internal',
  'Staging profile must use internal distribution.',
);
block(
  errors,
  eas.build?.production?.developmentClient !== true,
  'Production profile must not enable developmentClient.',
);

const variantResults = Object.fromEntries(
  variants.map((variant) => [variant, appConfigForVariant(variant)]),
);
const variantConfigs = Object.fromEntries(
  variants.map((variant) => [variant, variantResults[variant].config]),
);
for (const variant of variants) {
  const config = variantConfigs[variant];
  if (!config) {
    const message = `Resolved ${variant} app config failed: ${variantResults[variant].error}`;
    if (!strict && isProductionIdentityConfigBlock(variant, variantResults[variant].error)) {
      warn(
        warnings,
        false,
        'Resolved production app config blocked until BRAND_LEGAL_CLEARANCE=cleared and explicit final native identity env values are supplied.',
      );
    } else {
      block(errors, false, message);
    }
    continue;
  }
  block(
    errors,
    config.extra?.appVariant === variant,
    `Resolved ${variant} config extra.appVariant mismatch.`,
  );
  block(
    errors,
    config.extra?.appEnvironment === variant,
    `Resolved ${variant} config extra.appEnvironment mismatch.`,
  );
  block(
    errors,
    config.scheme === (variant === 'production' ? app.scheme : `${app.scheme}-${variant}`),
    `Resolved ${variant} scheme is not isolated.`,
  );
  block(
    errors,
    config.ios?.bundleIdentifier === expectedVariantValue(app.ios?.bundleIdentifier, variant),
    `Resolved ${variant} iOS bundle identifier is not isolated.`,
  );
  block(
    errors,
    config.android?.package === expectedVariantValue(app.android?.package, variant),
    `Resolved ${variant} Android package is not isolated.`,
  );
  block(
    errors,
    config.android?.allowBackup === false,
    `Resolved ${variant} Android config must keep allowBackup=false.`,
  );
}

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

warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_IOS_TESTFLIGHT_PASS),
  'Missing TestFlight evidence: PHASE9_IOS_TESTFLIGHT_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_ANDROID_CLOSED_TEST_PASS),
  'Missing Play internal/closed testing evidence: PHASE9_ANDROID_CLOSED_TEST_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_ANDROID_TARGET_API_PASS),
  'Missing Android target API proof from built artifact: PHASE9_ANDROID_TARGET_API_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_ANDROID_16KB_PASS),
  'Missing Android 16 KB page-size proof: PHASE9_ANDROID_16KB_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_IOS_PRIVACY_REPORT_PASS),
  'Missing iOS privacy report/privacy manifest evidence: PHASE9_IOS_PRIVACY_REPORT_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_APP_STORE_PACKET_PASS),
  'Missing App Store review packet evidence: PHASE9_APP_STORE_PACKET_PASS=true.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_PLAY_PACKET_PASS),
  'Missing Google Play review packet evidence: PHASE9_PLAY_PACKET_PASS=true.',
);

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
        androidAllowBackup: app.android?.allowBackup ?? true,
        androidPermissions: [...androidPermissions],
      },
      easBuildProfiles: Object.fromEntries(
        variants.map((variant) => [
          variant,
          {
            channel: eas.build?.[variant]?.channel ?? null,
            distribution: eas.build?.[variant]?.distribution ?? null,
            developmentClient: eas.build?.[variant]?.developmentClient === true,
            appVariant: eas.build?.[variant]?.env?.APP_VARIANT ?? null,
            appEnvironment: eas.build?.[variant]?.env?.EXPO_PUBLIC_APP_ENV ?? null,
          },
        ]),
      ),
      resolvedVariants: Object.fromEntries(
        variants.map((variant) => [
          variant,
          variantConfigs[variant]
            ? {
                name: variantConfigs[variant].name,
                scheme: variantConfigs[variant].scheme,
                iosBundleIdentifier: variantConfigs[variant].ios?.bundleIdentifier,
                androidPackage: variantConfigs[variant].android?.package,
                androidAllowBackup: variantConfigs[variant].android?.allowBackup ?? true,
                appVariant: variantConfigs[variant].extra?.appVariant,
                appEnvironment: variantConfigs[variant].extra?.appEnvironment,
              }
            : {
                error: variantResults[variant].error,
              },
        ]),
      ),
      artifacts,
      blockers: errors,
      warnings,
    },
    null,
    2,
  )}\n`,
);

printResult('Phase 9 store build inspection', errors, warnings);
