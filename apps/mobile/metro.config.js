// Metro config: Sentry source maps + NativeWind + Turborepo monorepo resolution.
// Follows Expo's documented monorepo pattern (watch the repo root, resolve
// node_modules from both the app and the hoisted root).
// BLOCKED: B-VERIFY-METRO — monorepo resolution can't be runtime-verified in
// this environment; confirm `expo start` resolves @onskin/* on first device build.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot, {
  // Session replay is prohibited by the privacy contract. The supported
  // Sentry resolver flag keeps its web packages out of production exports.
  includeWebReplay: false,
});

// 1. Watch all files in the monorepo (so changes in packages/* trigger reloads).
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Allow importing the workspace TS source of @onskin/* packages directly.
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: './src/global.css' });
