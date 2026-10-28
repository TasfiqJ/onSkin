// Bounded synthetic probes. No source input, arbitrary error, or finding text is
// emitted: the caller enforces heap, output and process deadline limits.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = raw => createHash('sha256').update(raw).digest('hex');
export function original24(bytes, file, packageName) {
  if (hash(bytes) === file.originalSHA256) return bytes;
  assert.equal(hash(bytes), file.patchedSHA256);
  let text = bytes.toString('utf8');
  if (packageName === 'zod') {
    const begin = text.indexOf('// security24: only leading pure size checks may reject before parsing.');
    const end = text.indexOf('const result = inst._zod.parse(payload, ctx);', begin);
    assert.ok(begin >= 0 && end > begin);
    text = text.slice(0, begin) + text.slice(end);
  } else {
    const begin = text.indexOf('// security24: key names are forbidden regardless of target shape.');
    const end = text.indexOf('function propertyIsOnObject(object, property) {', begin);
    assert.ok(begin >= 0 && end > begin);
    text = text.slice(0, begin) + text.slice(end);
    text = text.replace(/catch\(_\) \{\n(\s*)return true/, 'catch(_) {\n$1return false');
    text = text.replace(/\n[\t ]*if \(object === null \|\| \(typeof object !== 'object' && typeof object !== 'function'\)\) return false/, '');
    text = text.replace(/\n[\t ]*if \(forbiddenMergeKey\(key\)\) return/g, '');
    for (const expression of ['cloneUnlessOtherwiseSpecified(target[key], options)', 'getMergeFunction(key, options)(target[key], source[key], options)', 'cloneUnlessOtherwiseSpecified(source[key], options)']) text = text.replace(`writeMergeValue(destination, key, ${expression})`, `destination[key] = ${expression}`);
  }
  const raw = Buffer.from(text);
  assert.equal(hash(raw), file.originalSHA256);
  return raw;
}

export function fixture(t, { nested = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'security24-')));
  t.after(() => {
    assert.equal(realpathSync(root), root);
    assert.equal(dirname(root), realpathSync(tmpdir()));
    assert.ok(root.split(sep).at(-1).startsWith('security24-'));
    rmSync(root, { recursive: true, force: true });
  });
  const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/security24/backports.json')));
  const lock = { lockfileVersion: 3, packages: { '': { name: 'synthetic', version: '1.0.0' } } };
  for (const owner of ['', ...(nested ? ['node_modules/synthetic-parent/'] : [])]) {
    if (owner) {
      lock.packages['node_modules/synthetic-parent'] = { version: '1.0.0', resolved: 'https://registry.npmjs.org/synthetic-parent/-/synthetic-parent-1.0.0.tgz', integrity: 'sha512-YQ==' };
      mkdirSync(join(root, 'node_modules/synthetic-parent'), { recursive: true });
      writeFileSync(join(root, 'node_modules/synthetic-parent/package.json'), '{"name":"synthetic-parent","version":"1.0.0"}');
    }
    for (const pkg of manifest.packages) {
      const path = owner + 'node_modules/' + pkg.name;
      cpSync(join(ROOT, 'node_modules', pkg.name), join(root, path), { recursive: true });
      for (const file of pkg.files) {
        const target = join(root, path, file.path);
        writeFileSync(target, original24(readFileSync(target), file, pkg.name));
      }
      lock.packages[path] = { version: pkg.version, resolved: pkg.resolved, integrity: pkg.integrity };
    }
  }
  for (const path of ['scripts/security22/backports.json', 'scripts/security24/backports.json']) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(ROOT, path), join(root, path));
  }
  const save = () => writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
  save(); return { root, lock, save, manifest };
}

async function zodProbe(root) {
  const require = createRequire(join(root, 'package.json'));
  const variants = [
    ['default-cjs', require('zod'), 3], ['v3-cjs', require('zod/v3'), 3], ['v4-cjs', require('zod/v4'), 4],
    ['default-esm', await import(pathToFileURL(join(root, 'node_modules/zod/index.js'))), 3],
    ['v3-esm', await import(pathToFileURL(join(root, 'node_modules/zod/v3/index.js'))), 3],
    ['v4-esm', await import(pathToFileURL(join(root, 'node_modules/zod/v4/index.js'))), 4],
  ];
  const records = [];
  for (const [entry, z, version] of variants) for (const async of [false, true]) {
    const parse = (schema, value) => async ? schema.safeParseAsync(value) : schema.safeParse(value);
    for (const kind of ['array', 'set', 'map']) {
      const make = count => kind === 'array' ? Array(count).fill(0) : kind === 'set' ? new Set(Array.from({ length: count }, (_, i) => i)) : new Map(Array.from({ length: count }, (_, i) => [i, 0]));
      const create = () => kind === 'array' ? z.array(z.string()) : kind === 'set' ? z.set(z.string()) : z.map(z.string(), z.string());
      const issues = [];
      for (const count of [64, 256]) { const result = await parse(create(), make(count)); issues.push(result.error.issues.length); }
      const bounded = kind !== 'map' || version === 4;
      let cappedIssues = null;
      if (bounded) {
        const schema = kind === 'map' ? create().check(z.maxSize(4)) : create().max(4);
        cappedIssues = (await parse(schema, make(256))).error.issues.length;
      }
      records.push({ entry, async, kind, unboundedIssues: issues, constrainedSupported: bounded, constrainedIssues: cappedIssues });
    }
    let refined = 0;
    const refinedSchema = z.array(z.string()).max(4).refine(() => { refined++; return true; });
    await parse(refinedSchema, Array(32).fill('valid'));
    records.push({ entry, async, kind: 'post-bound-refinement', calls: refined });
    const pre = z.preprocess(input => input.slice(0, 2), z.array(z.string()).max(4));
    const transformed = await parse(pre, Array(32).fill('valid'));
    records.push({ entry, async, kind: 'preprocess-shrink', success: transformed.success, outputLength: transformed.data?.length ?? null });
    const expanded = await parse(z.string().transform(() => Array(128).fill(0)).pipe(z.array(z.string())), 'synthetic');
    records.push({ entry, async, kind: 'transformed-unbounded', issues: expanded.error.issues.length });
    if (async) {
      let calls = 0;
      const schema = z.array(z.string().transform(async value => { calls++; return value; })).max(4);
      const result = await schema.safeParseAsync(Array(32).fill('valid'));
      records.push({ entry, async, kind: 'async-element-transform', issues: result.error.issues.length, calls });
    }
    if (version === 4) {
      const overwrite = await parse(z.array(z.string()).overwrite(input => input.slice(0, 2)).max(4), Array(32).fill('valid'));
      records.push({ entry, async, kind: 'overwrite-before-bound', success: overwrite.success, outputLength: overwrite.data?.length ?? null });
    }
    for (const kind of ['array', 'set', 'map']) {
      const input = kind === 'array' ? [0, 1] : kind === 'set' ? new Set([0, 1]) : new Map([[0, 0], [1, 1]]);
      function* expanded() { for (let i = 0; i < 128; i++) yield kind === 'map' ? [i, i] : i; }
      input[Symbol.iterator] = expanded;
      if (kind === 'set') input.values = expanded;
      if (kind === 'map') input.entries = expanded;
      let schema = kind === 'array' ? z.array(z.string()).max(4) : kind === 'set' ? z.set(z.string()).max(4) : z.map(z.string(), z.string());
      if (kind === 'map' && version === 4) schema = schema.check(z.maxSize(4));
      const result = await parse(schema, input);
      records.push({ entry, async, kind: 'custom-' + kind, issues: result.error.issues.length });
    }
  }
  return records;
}

async function mergeProbe(root) {
  const require = createRequire(join(root, 'package.json'));
  const records = [];
  for (const entry of ['dist/cjs.js', 'dist/umd.js']) {
    const merge = require(join(root, 'node_modules/deepmerge', entry));
    const payload = () => JSON.parse('{"__proto__":{"security24Inherited":true},"constructor":{"prototype":{"security24Inherited":true}},"prototype":{"security24Inherited":true}}');
    for (const targetKind of ['null-prototype', 'null', 'primitive', 'own-proto', 'nested-null', 'nested-primitive', 'nested-array', 'frozen', 'deep']) {
      let target = targetKind === 'null-prototype' ? Object.create(null) : targetKind === 'null' ? null : targetKind === 'primitive' ? 1 : targetKind === 'own-proto' ? payload() : {};
      let source = payload(), select = value => value;
      if (targetKind.startsWith('nested-')) {
        target = { session: targetKind === 'nested-null' ? null : targetKind === 'nested-primitive' ? 1 : [null] };
        source = { session: targetKind === 'nested-array' ? [payload()] : payload() };
        select = value => targetKind === 'nested-array' ? value.session[1] : value.session;
      }
      if (targetKind === 'frozen') { target = Object.freeze(payload()); source = Object.freeze({ normal: true }); }
      if (targetKind === 'deep') {
        target = { child: null }; source = { child: payload() };
        for (let n = 0; n < 32; n++) { target = { child: target }; source = { child: source }; }
        select = value => { for (let n = 0; n < 33; n++) value = value.child; return value; };
      }
      for (const async of [false, true]) {
        const result = select(async ? await Promise.resolve().then(() => merge(target, source)) : merge(target, source));
        records.push({ entry, targetKind, async, inheritedPoison: result.security24Inherited === true && !Object.hasOwn(result, 'security24Inherited'), ownForbidden: ['__proto__', 'constructor', 'prototype'].some(key => Object.hasOwn(result, key)), globalPoison: Object.hasOwn(Object.prototype, 'security24Inherited') });
      }
    }
    const inherited = merge(Object.create({ inheritedTarget: true }), Object.assign(Object.create({ inheritedSource: true }), { normal: true }));
    records.push({ entry, targetKind: 'inherited-keys', absent: inherited.inheritedTarget === undefined && inherited.inheritedSource === undefined && inherited.normal === true });
    const compatibility = merge({ nested: { one: 1 }, values: [1], untouched: true }, { nested: { two: 2 }, values: [2] });
    records.push({ entry, targetKind: 'compatibility', success: JSON.stringify(compatibility) === '{"nested":{"one":1,"two":2},"values":[1,2],"untouched":true}' });
    for (const target of [null, undefined, 1, false, 'synthetic']) {
      const value = merge(target, { normal: true, nested: { accepted: 1 } });
      records.push({ entry, targetKind: 'primitive-compatible', success: value.normal === true && value.nested.accepted === 1 });
    }
    const nestedNull = merge({ session: null }, { session: { normal: true } });
    records.push({ entry, targetKind: 'nested-null-compatible', success: nestedNull.session.normal === true });
    const existingPrototype = Object.assign(Object.create({ security24Inherited: true }), { normal: true });
    const uncloned = merge({}, { session: existingPrototype }, { clone: false });
    records.push({ entry, targetKind: 'trusted-clone-false', existingPrototypeRetained: uncloned.session === existingPrototype && uncloned.session.security24Inherited === true });
    const custom = merge({ session: {} }, { session: { normal: true } }, { customMerge: key => key === 'session' ? () => Object.create({ security24Inherited: true }) : undefined });
    records.push({ entry, targetKind: 'trusted-custom-merge', callbackPrototypeRetained: custom.session.security24Inherited === true });
    let setterCalls = 0;
    Object.defineProperty(Object.prototype, 'security24Setter', { configurable: true, set() { setterCalls++; } });
    try {
      const value = merge({ security24Setter: 'synthetic' }, {});
      records.push({ entry, targetKind: 'inherited-setter', setterCalls, ownValue: Object.hasOwn(value, 'security24Setter') && value.security24Setter === 'synthetic' });
    } finally { delete Object.prototype.security24Setter; }
    const proxy = new Proxy({}, { has() { throw new Error('SYNTHETIC_HAS_DENIAL'); } });
    const proxyResult = merge(proxy, { synthetic: true });
    records.push({ entry, targetKind: 'throwing-in', omitted: !Object.hasOwn(proxyResult, 'synthetic') });
  }
  return records;
}
async function consumerProbe(root) {
  const require = createRequire(join(root, 'package.json'));
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'security24-consumer-')));
  try {
    writeFileSync(join(project, 'package.json'), '{"name":"synthetic","version":"1.0.0"}');
    writeFileSync(join(project, 'app.json'), '{"expo":{"name":"synthetic","slug":"synthetic","sdkVersion":"57.0.0","extra":{"session":null}}}');
    const config = require(join(root, 'node_modules/@expo/config'));
    const result = await config.modifyConfigAsync(project, JSON.parse('{"extra":{"session":{"__proto__":{"security24Inherited":true}}}}'), {}, { dryRun: true });
    const plugins = require(join(root, 'node_modules/@expo/cli/build/src/start/server/DevToolsPlugin.schema.js'));
    const pluginResult = plugins.DevToolsPluginOutputSchema.safeParse(Array(128).fill(0));
    const validationErrors = [];
    for (const entry of ['v3', 'v4']) {
      const z = require('zod/' + entry), formatter = require('zod-validation-error/' + entry);
      const error = z.array(z.string()).max(4).safeParse(Array(16).fill(0)).error;
      const formatted = formatter.fromZodError(error);
      validationErrors.push({ entry, issues: error.issues.length, formatted: typeof formatted.message === 'string' && formatted.message.length > 0 });
    }
    const hooks = require('eslint-plugin-react-hooks'), { Linter } = require('eslint');
    const messages = new Linter().verify('function Component(){return null;} export default Component;', [{
      plugins: { 'react-hooks': hooks }, rules: { 'react-hooks/static-components': 'error', 'react-hooks/rules-of-hooks': 'error' },
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    }]);
    return { expoConfigDryRun: result.type === 'success', expoInheritedPoison: result.config.extra.session.security24Inherited === true, expoOutputUnboundedIssues: pluginResult.error.issues.length,
      validationErrors, eslintHooksValidConsumer: messages.length === 0 };
  } finally {
    assert.equal(dirname(project), realpathSync(tmpdir()));
    assert.ok(project.split(sep).at(-1).startsWith('security24-consumer-'));
    rmSync(project, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [root, mode = 'libraries'] = process.argv.slice(2);
    if (!root || !['libraries', 'consumers'].includes(mode)) throw new Error('ARGUMENTS');
    const result = mode === 'consumers' ? await consumerProbe(resolve(root)) : { zod: await zodProbe(resolve(root)), deepmerge: await mergeProbe(resolve(root)) };
    process.stdout.write(JSON.stringify({ qualification: 'BOUNDED_SYNTHETIC_PUBLIC_ADVISORY_BEHAVIOR', result, acceptanceGranted: false, release: 'NO_GO' }) + '\n');
  } catch {
    process.stdout.write('{"state":"INCOMPLETE","reason":"SECURITY24_PROBE_INCOMPLETE","acceptanceGranted":false,"release":"NO_GO"}\n');
    process.exitCode = 1;
  }
}
