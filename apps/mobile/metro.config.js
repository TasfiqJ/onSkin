// Metro config: Sentry source maps + NativeWind + Turborepo monorepo resolution.
// Follows Expo's documented monorepo pattern (watch the repo root, resolve
// node_modules from both the app and the hoisted root).
// Supports linked-dependency worktrees by watching the resolved dependency
// target. Expo web verifies the current installed worktree; native release
// builds remain part of Phase 5 QA.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const hoistedNodeModules = path.resolve(monorepoRoot, 'node_modules');
const appNodeModules = path.resolve(projectRoot, 'node_modules');
// Metro's file map must contain each junction target before the resolver can
// honor the app-first search path. The hoisted target does not contain the
// separately installed app dependencies (including @noble/ciphers 2.x).
const linkedDependencyWatchFolders = [
  ...new Set(
    [appNodeModules, hoistedNodeModules]
      .filter((folder) => fs.existsSync(folder))
      .map((folder) => fs.realpathSync(folder))
      .filter((folder) => !folder.startsWith(`${monorepoRoot}${path.sep}`)),
  ),
];

const config = getSentryExpoConfig(projectRoot);
const repoTempPattern = new RegExp(
  `^${path
    .resolve(monorepoRoot, '.tmp')
    .split(path.sep)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\\\/]')}[\\\\/]`,
);

// 1. Watch all files in the monorepo (so changes in packages/* trigger reloads).
config.watchFolders = [monorepoRoot, ...linkedDependencyWatchFolders];

// 2. Resolve modules from the app first, then the hoisted root.
config.resolver.nodeModulesPaths = [appNodeModules, hoistedNodeModules];
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  repoTempPattern,
];

// 3. Allow importing the workspace TS source of @layerwell/* packages directly.
config.resolver.disableHierarchicalLookup = false;
config.resolver.enableGlobalPackages = true;

module.exports = withNativeWind(config, { input: './src/global.css' });
