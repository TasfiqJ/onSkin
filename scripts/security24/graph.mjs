import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedInventory, lockInventory, strictJson } from '../security22/dependency.mjs';
import { readSecurity24PublicFile } from './patch-tooling.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = raw => createHash('sha256').update(raw).digest('hex');
export function advisoryGraph(root = ROOT) {
  root = realpathSync(root);
  const bytes = readSecurity24PublicFile(root, 'package-lock.json', 16 * 1024 * 1024).raw;
  const document = strictJson(bytes), packages = lockInventory(document);
  const byPath = new Map(packages.map(pkg => [pkg.path, pkg]));
  const edges = [];
  for (const owner of packages.filter(pkg => pkg.kind !== 'workspace-link')) {
    const entry = document.packages[owner.path];
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of Object.keys(entry[field] ?? {}).sort()) {
        const parts = owner.path.split('/');
        let target = null;
        for (let length = parts.length; length >= 0; length--) {
          const prefix = parts.slice(0, length).join('/');
          const candidate = (prefix ? prefix + '/' : '') + 'node_modules/' + name;
          if (byPath.has(candidate)) { target = candidate; break; }
        }
        edges.push({ from: owner.path, field, name, target,
          state: target === null ? 'NOT_IN_LOCK_INSTALLATION' : 'LOCK_RESOLUTION' });
      }
    }
  }
  const installed = installedInventory(root, packages);
  if (installed.state !== 'PASS') throw new Error('INCOMPLETE');
  const advisories = [['zod', 'GHSA-mrhx-c7xc-m3w5'], ['deepmerge', 'GHSA-gcqx-w48m-w2h4']].map(([name, advisory]) => {
    const targets = packages.filter(pkg => pkg.name === name && pkg.kind === 'registry').map(pkg => pkg.path);
    return { name, advisory, installedCopies: targets, directConsumers: edges.filter(edge => targets.includes(edge.target)),
      disposition: 'OPEN_REQUIRED', upstreamAdvisoryCleared: false };
  });
  const consumers = [
    'node_modules/@expo/config/build/Config.js',
    'node_modules/@expo/cli/build/src/start/server/createMCPDevToolsExtensionSchema.js',
    'node_modules/@expo/cli/build/src/start/server/DevToolsPlugin.schema.js',
    'node_modules/eslint-plugin-react-hooks/cjs/eslint-plugin-react-hooks.development.js',
    'node_modules/eslint-plugin-react-hooks/cjs/eslint-plugin-react-hooks.production.js',
    'node_modules/zod-validation-error/v3/index.js',
    'node_modules/zod-validation-error/v3/index.mjs',
    'node_modules/zod-validation-error/v4/index.js',
    'node_modules/zod-validation-error/v4/index.mjs',
  ].map(path => ({ path, sha256: hash(readSecurity24PublicFile(root, path, 4 * 1024 * 1024).raw) }));
  const after = installedInventory(root, packages);
  if (JSON.stringify(installed) !== JSON.stringify(after) || hash(readSecurity24PublicFile(root, 'package-lock.json', 16 * 1024 * 1024).raw) !== hash(bytes)) throw new Error('INCOMPLETE');
  return { schema: 1, qualification: 'PUBLIC_COMPLETE_LOCK_INSTALLATION_GRAPH_NOT_REACHABILITY_OR_ACCEPTANCE',
    lockSHA256: hash(bytes), lockEntries: packages.length, graphEdges: edges.length,
    registryCoordinates: new Set(packages.filter(pkg => pkg.kind === 'registry').map(pkg => pkg.name + '@' + pkg.version)).size,
    packages: packages.map(pkg => ({ path: pkg.path, kind: pkg.kind, ...(pkg.name ? { name: pkg.name, version: pkg.version } : {}), ...(pkg.integrity ? { integrity: pkg.integrity } : {}), ...(pkg.target ? { target: pkg.target } : {}) })),
    edges, installed, installationSnapshot: 'REPEATED_COMPLETE_INVENTORY_EQUAL', consumers, advisories, candidateReady: false, acceptanceGranted: false, release: 'NO_GO' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('ARGUMENTS');
    process.stdout.write(JSON.stringify(advisoryGraph()) + '\n');
  } catch {
    process.stdout.write('{"state":"INCOMPLETE","reason":"SECURITY24_GRAPH_INCOMPLETE","candidateReady":false,"acceptanceGranted":false,"release":"NO_GO"}\n');
    process.exitCode = 1;
  }
}
