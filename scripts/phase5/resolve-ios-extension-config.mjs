#!/usr/bin/env node
import { getConfig } from '@expo/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const variant = process.argv[2];
if (!['development', 'staging'].includes(variant)) {
  throw new Error('Only non-production source variants may be resolved by this probe.');
}

for (const key of [
  'APP_DISPLAY_NAME',
  'EXPO_PUBLIC_APP_DISPLAY_NAME',
  'APP_SLUG',
  'APP_SCHEME',
  'EXPO_PUBLIC_APP_SCHEME',
  'APP_IOS_BUNDLE_IDENTIFIER',
  'APP_ANDROID_PACKAGE',
  'BRAND_LEGAL_CLEARANCE',
  'IOS_WIDGET_EXTENSION_BUILD_ENABLED',
]) {
  delete process.env[key];
}
process.env.APP_VARIANT = variant;
process.env.EXPO_PUBLIC_APP_ENV = variant;
process.env.IOS_WIDGET_EXTENSION_BUILD_ENABLED = 'true';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..', '..', 'apps', 'mobile');
const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true });
process.stdout.write(`${JSON.stringify(exp)}\n`);
