const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../../apps/mobile/metro.config.js');
const source = fs.readFileSync(filename, 'utf8');

for (const linked of [false, true]) {
  test(`Metro watches both dependency targets, linked=${linked}`, () => {
    const app = path.resolve('/synthetic/repo/apps/mobile');
    const root = path.resolve(app, '../..');
    const appModules = path.join(app, 'node_modules');
    const rootModules = path.join(root, 'node_modules');
    const targets = new Map([
      [appModules, linked ? path.resolve('/installed/apps/mobile/node_modules') : appModules],
      [rootModules, linked ? path.resolve('/installed/node_modules') : rootModules],
    ]);
    const context = {
      __dirname: app,
      module: { exports: {} },
      require: (name) => {
        if (name === 'path') return path;
        if (name === 'fs')
          return {
            existsSync: (name) => targets.has(name),
            realpathSync: (name) => targets.get(name),
          };
        if (name === '@sentry/react-native/metro')
          return { getSentryExpoConfig: () => ({ resolver: {} }) };
        if (name === 'nativewind/metro') return { withNativeWind: (value) => value };
        throw new Error(name);
      },
    };
    vm.runInNewContext(source, context, { filename });
    const config = context.module.exports;
    assert.deepEqual(Array.from(config.resolver.nodeModulesPaths), [appModules, rootModules]);
    for (const target of targets.values()) {
      assert(
        target.startsWith(root + path.sep) || config.watchFolders.includes(target),
        `Unwatched target ${target}`,
      );
    }
    assert.equal(new Set(config.watchFolders).size, config.watchFolders.length);
    assert.equal(config.resolver.disableHierarchicalLookup, false);
  });
}
