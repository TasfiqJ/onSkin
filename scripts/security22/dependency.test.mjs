import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { generatedToolCache, installedInventory, lockInventory, npmCli, sanitizeAudit, strictJson } from './dependency.mjs';

const require = createRequire(import.meta.url);
const forge = require('node-forge');
const SENTINEL = 'SYNTHETIC_SENSITIVE_SENTINEL_NEVER_PUBLIC_7d380';
const audit = () => ({ auditReportVersion: 2, vulnerabilities: { braces: { name: 'braces', severity: 'high', isDirect: false, nodes: [SENTINEL], via: [{ name: 'braces', url: 'https://github.com/advisories/GHSA-grv7-fg5c-xmjg', title: SENTINEL, details: SENTINEL }] } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } }, errorMessage: SENTINEL });
const known = new Set(['braces']);

test('canonical npm discovery ignores injected npm paths, prefixes and Node startup options', () => {
  const names = ['npm_execpath', 'npm_config_prefix', 'NPM_CONFIG_PREFIX', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_AUTH_TOKEN'];
  const saved = new Map(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = join(tmpdir(), SENTINEL);
    process.env.NODE_OPTIONS = '--require=' + join(tmpdir(), SENTINEL);
    const tool = npmCli();
    assert.equal(tool.version, '11.20.0');
    assert.match(tool.cliSHA256, /^[a-f0-9]{64}$/);
    assert.equal(tool.path.includes(SENTINEL), false);
    assert.equal(tool.path.endsWith('npm-cli.js'), true);
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('allowlisted audit publication drops synthetic paths, snippets and error text', () => {
  const result = sanitizeAudit(audit(), 1, known);
  assert.equal(JSON.stringify(result).includes(SENTINEL), false);
  assert.deepEqual(result.findings[0].ids, ['GHSA-grv7-fg5c-xmjg']);
  assert.equal(result.counts.total, 1);
  for (const bytes of [Buffer.from(`{"message":"${SENTINEL}",`), Buffer.from(`{"x":1,"x":"${SENTINEL}"}`), Buffer.from([0xff])]) {
    assert.throws(() => strictJson(bytes), error => error.message === 'DEPENDENCY_JSON_INVALID' && !error.message.includes(SENTINEL));
  }
});

test('audit success cannot conceal findings, false counts, unknown packages or malformed advisory IDs', () => {
  assert.throws(() => sanitizeAudit(audit(), 0, known), /DEPENDENCY_AUDIT_COUNTS/);
  for (const change of [
    v => { v.metadata.vulnerabilities.total = true; },
    v => { v.metadata.vulnerabilities.high = false; },
    v => { v.vulnerabilities.braces.via[0].url += SENTINEL; },
    v => { v.vulnerabilities.braces.name = SENTINEL; },
    v => { v.error = { message: SENTINEL }; },
  ]) {
    const value = audit(); change(value);
    assert.throws(() => sanitizeAudit(value, 1, known), error => /^DEPENDENCY_AUDIT_/.test(error.message) && !error.message.includes(SENTINEL));
  }
});

test('strict JSON refuses escaped duplicate keys, deep nesting and nonfinite input', () => {
  for (const raw of ['{"schema":1,"s\\u0063hema":2}', '[1e999]', '['.repeat(102) + '0' + ']'.repeat(102), '{"x":NaN}']) {
    assert.throws(() => strictJson(Buffer.from(raw)), /DEPENDENCY_JSON_INVALID/);
  }
});

function lock() {
  return { lockfileVersion: 3, packages: {
    '': { name: 'synthetic-root', version: '1.0.0' },
    'node_modules/braces': { version: '1.0.0', integrity: 'sha512-YQ==', resolved: 'https://registry.npmjs.org/braces/-/braces-1.0.0.tgz' },
  } };
}

test('lock inventory rejects aliases, traversal, altered registry identity and undeclared workspace targets', () => {
  assert.equal(lockInventory(lock()).length, 2);
  for (const change of [
    v => { v.packages['node_modules/BRACES'] = v.packages['node_modules/braces']; },
    v => { v.packages['../outside'] = { name: 'synthetic-root', version: '1.0.0' }; },
    v => { v.packages['node_modules/braces'].resolved = `https://${SENTINEL}/package`; },
    v => { v.packages['node_modules/braces'] = { link: true, resolved: 'outside' }; },
  ]) {
    const value = lock(); change(value);
    assert.throws(() => lockInventory(value), /^Error: DEPENDENCY_/);
  }
});

test('installed-source reconciliation refuses changed package identity and records all expected entries', t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'security22-dependency-')));
  t.after(() => { assert.equal(resolve(root), root); assert.match(root, /security22-dependency-/); rmSync(root, { recursive: true, force: true }); });
  mkdirSync(join(root, 'node_modules/braces'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'synthetic-root', version: '1.0.0' }));
  writeFileSync(join(root, 'node_modules/braces/package.json'), JSON.stringify({ name: 'braces', version: '1.0.0' }));
  const inventory = lockInventory(lock());
  const good = installedInventory(root, inventory);
  assert.equal(good.state, 'PASS'); assert.equal(good.accounted, good.expected);
  mkdirSync(join(root, 'node_modules/braces/node_modules/omitted'), { recursive: true });
  assert.equal(installedInventory(root, inventory).state, 'INCOMPLETE');
  rmSync(join(root, 'node_modules/braces/node_modules/omitted'), { recursive: true });
  writeFileSync(join(root, 'node_modules/braces/package.json'), JSON.stringify({ name: 'braces', version: '9.9.9', privateError: SENTINEL }));
  const bad = installedInventory(root, inventory);
  assert.equal(bad.state, 'INCOMPLETE');
  assert.equal(JSON.stringify(bad).includes(SENTINEL), false);
});

test('only exact Vite cache roots are fully hashed; cache modules, aliases and links refuse', t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'security22-cache-')));
  t.after(() => { assert.equal(realpathSync(root), root); assert.equal(dirname(root), realpathSync(tmpdir())); rmSync(root, { recursive: true, force: true }); });
  mkdirSync(join(root, 'node_modules/.vite/deps'), { recursive: true });
  mkdirSync(join(root, 'node_modules/.vite-temp'), { recursive: true });
  mkdirSync(join(root, 'node_modules/braces'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'synthetic-root', version: '1.0.0' }));
  writeFileSync(join(root, 'node_modules/braces/package.json'), JSON.stringify({ name: 'braces', version: '1.0.0' }));
  writeFileSync(join(root, 'node_modules/.vite/deps/config.js'), 'synthetic cache bytes');
  const registry = lockInventory(lock());
  const good = installedInventory(root, registry);
  assert.equal(good.state, 'PASS');
  const cache = good.generated.filter(item => item.kind === 'npm-tool-cache');
  assert.equal(cache.length, 2); assert.equal(cache.reduce((n, item) => n + item.files, 0), 1);
  const before = cache.find(item => item.path === 'node_modules/.vite').sha256;
  writeFileSync(join(root, 'node_modules/.vite/deps/config.js'), 'changed synthetic cache bytes');
  assert.notEqual(generatedToolCache(root, 'node_modules', '.vite').sha256, before);
  mkdirSync(join(root, 'node_modules/.vite/deps/Node_Modules/extra'), { recursive: true });
  assert.equal(installedInventory(root, registry).state, 'INCOMPLETE');
  rmSync(join(root, 'node_modules/.vite/deps/Node_Modules'), { recursive: true });
  const target = join(root, 'synthetic-outside'); mkdirSync(target);
  fs.symlinkSync(target, join(root, 'node_modules/.vite/deps/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => generatedToolCache(root, 'node_modules', '.vite'), error => error.message === 'DEPENDENCY_CACHE_INCOMPLETE' && error.stack === error.message);
  fs.rmSync(join(root, 'node_modules/.vite/deps/linked'), { recursive: true });
  mkdirSync(join(root, 'node_modules/undeclared'), { recursive: true });
  assert.equal(installedInventory(root, registry).state, 'INCOMPLETE');
});

test('upgraded forge bounds nested BIT STRING decoding and retains exact DER roundtrip', () => {
  const asn1 = forge.asn1;
  let obj = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '');
  for (let n = 0; n < 80; n++) obj = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.BITSTRING, false, [obj]);
  const der = asn1.toDer(obj).getBytes();
  const parsed = asn1.fromDer(der, { maxDepth: 2 });
  let depth = 0; let node = parsed;
  while (Array.isArray(node.value)) { depth++; node = node.value[0]; }
  assert.ok(depth <= 2, `decoded depth ${depth} exceeds the local limit`);
  assert.equal(asn1.toDer(parsed).getBytes(), der);
});

test('forge 1.4.2 PEM decoding preserves Buffer input compatibility', () => {
  const pem = Buffer.from('-----BEGIN TEST-----\nYWJj\n-----END TEST-----\n');
  assert.deepEqual(forge.pem.decode(pem), forge.pem.decode(pem.toString('utf8')));
});
