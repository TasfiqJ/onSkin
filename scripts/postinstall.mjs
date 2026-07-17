import { resolve } from 'node:path';

import { patchExpoWidgetsLifecycle } from './phase5/patch-expo-widgets-lifecycle.mjs';
import { patchReactNativeViewShotPrivacy } from './phase9/patch-react-native-view-shot-privacy.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Usage: node scripts/postinstall.mjs [--check]');
}

const check = args[0] === '--check';
const root = resolve(import.meta.dirname, '..');
const viewShot = patchReactNativeViewShotPrivacy({ root, check });
const widgets = patchExpoWidgetsLifecycle({ root, check });

process.stdout.write(
  `${JSON.stringify({ check, viewShot: viewShot.status, widgets: widgets.status })}\n`,
);
