import { resolve } from 'node:path';

import { patchExpoWidgetsLifecycle } from './phase5/patch-expo-widgets-lifecycle.mjs';
import { patchReactNativeViewShotPrivacy } from './phase9/patch-react-native-view-shot-privacy.mjs';
import { patchToolingSecurity } from './phase9/patch-tooling-security.mjs';
import { patchToolingSecurity22 } from './security22/patch-tooling.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Usage: node scripts/postinstall.mjs [--check]');
}

const check = args[0] === '--check';
const root = resolve(import.meta.dirname, '..');
const viewShot = patchReactNativeViewShotPrivacy({ root, check });
const widgets = patchExpoWidgetsLifecycle({ root, check });
const toolingSecurity = patchToolingSecurity({ root, check });
const toolingSecurity22 = patchToolingSecurity22({ root, check });

process.stdout.write(
  `${JSON.stringify({ check, viewShot: viewShot.status, widgets: widgets.status, toolingSecurity: toolingSecurity.status })}\n`,
);
