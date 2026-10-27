import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { patchToolingSecurity22 } from './patch-tooling.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(import.meta.dirname, 'backports.json')));
const hash = raw => createHash('sha256').update(raw).digest('hex');
const code = value => error => error.code === value;

function original(path) {
  const file = manifest.files.find(f => f.path === path);
  const raw = readFileSync(join(ROOT, 'node_modules/zod', path));
  if (hash(raw) === file.originalSHA256) return raw;
  assert.equal(hash(raw), file.patchedSHA256);
  const lines = raw.toString('utf8').split('\n');
  for (const [marker, length] of [
    ['// security22: enforce declared upper bounds before walking elements.', 5],
    ['// security22: preserve the size issue and avoid walking oversized sets.', 4],
  ]) {
    const index = lines.findIndex(line => line.trim() === marker);
    assert.ok(index >= 0); lines.splice(index, length);
  }
  const before = Buffer.from(lines.join('\n'));
  assert.equal(hash(before), file.originalSHA256);
  return before;
}

function fixture(t, { nested = false, full = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'security22-zod-')));
  t.after(() => {
    assert.equal(realpathSync(root), root);
    assert.equal(dirname(root), realpathSync(tmpdir()));
    assert.ok(root.split(sep).at(-1).startsWith('security22-zod-'));
    rmSync(root, { recursive: true, force: true });
  });
  const lock = { lockfileVersion: 3, packages: { '': { name: 'synthetic-root', version: '1.0.0' } } };
  const copies = ['node_modules/zod'];
  if (nested) {
    lock.packages['node_modules/synthetic-parent'] = { version: '1.0.0', resolved: 'https://registry.npmjs.org/synthetic-parent/-/synthetic-parent-1.0.0.tgz', integrity: 'sha512-YQ==' };
    mkdirSync(join(root, 'node_modules/synthetic-parent'), { recursive: true });
    writeFileSync(join(root, 'node_modules/synthetic-parent/package.json'), JSON.stringify({ name: 'synthetic-parent', version: '1.0.0' }));
    copies.push('node_modules/synthetic-parent/node_modules/zod');
  }
  for (const copy of copies) {
    lock.packages[copy] = { version: manifest.package.version, resolved: manifest.package.resolved, integrity: manifest.package.integrity };
    if (full) cpSync(join(ROOT, 'node_modules/zod'), join(root, copy), { recursive: true });
    for (const name of Object.keys(manifest.immutableSourcePins)) {
      const target = join(root, copy, name); mkdirSync(dirname(target), { recursive: true }); copyFileSync(join(ROOT, 'node_modules/zod', name), target);
    }
    for (const file of manifest.files) {
      const target = join(root, copy, file.path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, original(file.path));
    }
  }
  mkdirSync(join(root, 'scripts/security22'), { recursive: true });
  copyFileSync(join(import.meta.dirname, 'backports.json'), join(root, 'scripts/security22/backports.json'));
  const save = () => writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock)); save();
  writeFileSync(join(root, 'package.json'), JSON.stringify(lock.packages['']));
  return { root, lock, save, copies };
}

test('all declared installed copies and three source dialects require exact application, then check idempotently', t => {
  const f = fixture(t, { nested: true });
  assert.throws(() => patchToolingSecurity22({ root: f.root, check: true }), code('SECURITY22_PATCH_UNAPPLIED'));
  const applied = patchToolingSecurity22({ root: f.root });
  assert.equal(applied.changed, 6); assert.equal(applied.advisoryClearance, false);
  assert.equal(applied.treatment, 'NON_ADMITTING_TECHNICAL_PROPOSAL');
  assert.equal(patchToolingSecurity22({ root: f.root, check: true }).files, 6);
  assert.equal(patchToolingSecurity22({ root: f.root }).changed, 0);
  for (const copy of f.copies) for (const file of manifest.files) assert.equal(hash(readFileSync(join(f.root, copy, file.path))), file.patchedSHA256);
});

test('unknown later-copy source refuses before any other file is written', t => {
  const f = fixture(t, { nested: true });
  const last = join(f.root, f.copies[1], manifest.files.at(-1).path); writeFileSync(last, 'SYNTHETIC_UNKNOWN_SOURCE');
  assert.throws(() => patchToolingSecurity22({ root: f.root }), code('SECURITY22_PATCH_UNKNOWN_SOURCE'));
  for (const file of manifest.files) assert.equal(hash(readFileSync(join(f.root, f.copies[0], file.path))), file.originalSHA256);
});

test('registry, dispatch metadata and omitted nested installations cannot bypass the source preflight', t => {
  const f = fixture(t);
  const lock = f.lock.packages['node_modules/zod']; const saved = lock.integrity;
  lock.integrity = lock.integrity.replace('sha512-g', 'sha512-A'); f.save();
  assert.throws(() => patchToolingSecurity22({ root: f.root }), code('SECURITY22_PATCH_PACKAGE_IDENTITY'));
  lock.integrity = saved; f.save();
  const pkg = join(f.root, 'node_modules/zod/package.json'); const raw = readFileSync(pkg);
  const identity = JSON.parse(raw); identity.exports['.'].require = './unreviewed.cjs'; writeFileSync(pkg, JSON.stringify(identity));
  assert.throws(() => patchToolingSecurity22({ root: f.root }), code('SECURITY22_PATCH_UNKNOWN_SOURCE'));
  writeFileSync(pkg, raw);
  mkdirSync(join(f.root, 'node_modules/zod/node_modules/omitted-zod'), { recursive: true });
  assert.throws(() => patchToolingSecurity22({ root: f.root }), code('SECURITY22_PATCH_UNDECLARED_COPY'));
  for (const file of manifest.files) assert.equal(hash(readFileSync(join(f.root, 'node_modules/zod', file.path))), file.originalSHA256);
});

test('a linked source parent refuses without changing target or original bytes', t => {
  const f = fixture(t); const directory = join(f.root, 'node_modules/zod/v3'); const outside = join(f.root, 'synthetic-outside-v3');
  renameSync(directory, outside); symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => patchToolingSecurity22({ root: f.root }), code('SECURITY22_PATCH_PATH'));
  for (const file of manifest.files.filter(f => f.path.startsWith('v3/'))) assert.equal(hash(readFileSync(join(outside, file.path.slice(3)))), file.originalSHA256);
});

test('a later atomic rename failure restores every prior file and retires temporary files', t => {
  const f = fixture(t); const originalRename = fs.renameSync; let refused = false;
  try {
    fs.renameSync = (from, to) => {
      if (!refused && to.endsWith('types.cjs')) { refused = true; throw new Error('SYNTHETIC_COMMIT_FAILURE'); }
      return originalRename(from, to);
    };
    syncBuiltinESMExports();
    assert.throws(() => patchToolingSecurity22({ root: f.root }), error => error.code === 'SECURITY22_PATCH_INPUT_OR_IO_INCOMPLETE' && error.stack === error.code);
  } finally { fs.renameSync = originalRename; syncBuiltinESMExports(); }
  for (const file of manifest.files) assert.equal(hash(readFileSync(join(f.root, 'node_modules/zod', file.path))), file.originalSHA256);
  function noTemporary(path) { for (const name of readdirSync(path)) { assert.equal(name.startsWith('.security22-'), false); if (fs.lstatSync(join(path, name)).isDirectory()) noTemporary(join(path, name)); } }
  noTemporary(f.root);
});

test('known Vite caches are checked fully and cannot hide another dependency copy', t => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'node_modules/.vite/deps'), { recursive: true });
  mkdirSync(join(f.root, 'node_modules/.vite-temp'), { recursive: true });
  writeFileSync(join(f.root, 'node_modules/.vite/deps/config.js'), 'synthetic Vite cache');
  assert.equal(patchToolingSecurity22({ root: f.root }).changed, 3);
  assert.equal(patchToolingSecurity22({ root: f.root, check: true }).files, 3);
  mkdirSync(join(f.root, 'node_modules/.vite/deps/node_modules/hidden-copy'), { recursive: true });
  assert.throws(() => patchToolingSecurity22({ root: f.root, check: true }), error => error.code === 'SECURITY22_PATCH_INPUT_OR_IO_INCOMPLETE' && error.stack === error.code);
});

test('uncaught exported API failures disclose only a fixed code, including native filesystem errors', t => {
  const f = fixture(t); const sentinel = 'SYNTHETIC_PATH_SENTINEL_MUST_NOT_DISCLOSE';
  const script = "const{patchToolingSecurity22}=await import(process.argv[1]);patchToolingSecurity22({root:process.argv[2]});";
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script, pathToFileURL(join(import.meta.dirname, 'patch-tooling.mjs')).href, join(f.root, sentinel)], { encoding: 'utf8', timeout: 10000, maxBuffer: 8192, windowsHide: true });
  assert.equal(child.status, 1);
  assert.equal((child.stdout + child.stderr).includes(sentinel), false);
  assert.equal((child.stdout + child.stderr).includes(f.root), false);
  assert.equal((child.stdout + child.stderr).includes(ROOT.replace(/\\/g, '/')), false);
  assert.match(child.stderr, /SECURITY22_PATCH_INPUT_OR_IO_INCOMPLETE/);
});

test('real before/after child behavior changes 2001 issues to one without claiming the version advisory clean', t => {
  const f = fixture(t, { full: true });
  const script = "const{z}=require(process.argv[1]);const a=z.array(z.string()).max(1).safeParse(Array(2000).fill(0));const s=z.set(z.string()).max(1).safeParse(new Set(Array.from({length:2000},(_,i)=>i)));const result={arrayIssues:a.error.issues.length,setIssues:s.error.issues.length};console.log(JSON.stringify(result));process.exitCode=result.arrayIssues===1&&result.setIssues===1?0:1;";
  const run = () => spawnSync(process.execPath, ['-e', script, join(f.root, 'node_modules/zod')], { encoding: 'utf8', timeout: 15000, maxBuffer: 4096, windowsHide: true });
  const before = run(); assert.equal(before.status, 1); assert.deepEqual(JSON.parse(before.stdout), { arrayIssues: 2001, setIssues: 2001 });
  const result = patchToolingSecurity22({ root: f.root }); assert.equal(result.advisoryClearance, false);
  const after = run(); assert.equal(after.status, 0); assert.deepEqual(JSON.parse(after.stdout), { arrayIssues: 1, setIssues: 1 });
});

function checkSync(z) {
  let elements = 0; let outer = 0;
  const element = z.string().transform(value => { elements++; return value.trim().toUpperCase(); });
  const array = z.array(element).max(2).superRefine(() => { outer++; });
  assert.deepEqual(array.parse([' a ', 'b']), ['A', 'B']); assert.equal(elements, 2); assert.equal(outer, 1);
  elements = outer = 0;
  const bad = array.safeParse(['a', 'b', 'c']); assert.equal(bad.success, false); assert.equal(bad.error.issues.length, 1); assert.equal(elements, 0); assert.equal(outer, 0);
  const nested = z.object({ items: z.array(z.string()).max(1, { message: 'synthetic cap' }) }).safeParse({ items: [0, 1] });
  assert.deepEqual(nested.error.issues.map(i => ({ code: i.code, path: i.path, message: i.message, maximum: i.maximum, exact: i.exact })), [{ code: 'too_big', path: ['items'], message: 'synthetic cap', maximum: 1, exact: false }]);
  const mapped = z.array(z.string()).max(0).safeParse([0], { errorMap: () => ({ message: 'synthetic mapped cap' }) }); assert.equal(mapped.error.issues[0].message, 'synthetic mapped cap');
  assert.deepEqual(z.array(z.string()).max(0).parse([]), []);
  assert.equal(z.array(z.string()).length(1).safeParse([0, 1]).error.issues[0].exact, true);
  assert.equal(z.array(z.string()).length(2).safeParse([0]).error.issues.length, 2);
  assert.equal(z.array(z.string()).length(1).max(0).safeParse([0, 1]).error.issues.length, 2);
  assert.equal(z.array(z.string()).safeParse([0, 1, 2]).error.issues.length, 3); // Unbounded collection behavior remains explicit.
  assert.deepEqual(z.set(z.string().transform(v => v.trim())).max(2).parse(new Set([' a ', 'b '])), new Set(['a', 'b']));
  const set = z.object({ items: z.set(z.string()).max(1) }).safeParse({ items: new Set([0, 1]) }); assert.equal(set.error.issues.length, 1); assert.deepEqual(set.error.issues[0].path, ['items']);
  assert.equal(z.set(z.string()).min(2).safeParse(new Set([0])).error.issues.length, 2);
  assert.deepEqual(z.preprocess(v => v.slice(0, 1), z.array(z.string()).max(1)).parse(['a', 'b']), ['a']);
}

async function checkAsync(z) {
  let elements = 0; let outer = 0;
  const child = z.string().superRefine(async () => { elements++; });
  const array = z.array(child).max(1).superRefine(async () => { outer++; });
  assert.deepEqual(await array.parseAsync(['a']), ['a']); assert.equal(elements, 1); assert.equal(outer, 1);
  elements = outer = 0;
  const bad = await array.safeParseAsync(['a', 'b']); assert.equal(bad.error.issues.length, 1); assert.equal(elements, 0); assert.equal(outer, 0);
  const set = await z.set(child).max(1).safeParseAsync(new Set(['a', 'b'])); assert.equal(set.error.issues.length, 1); assert.equal(elements, 0);
}

test('CommonJS and ESM v3 entrypoints preserve ordinary sync/async/error-map/refinement semantics', async () => {
  const cjs = require('zod'); const esm = await import(pathToFileURL(join(ROOT, 'node_modules/zod/v3/index.js')).href);
  for (const api of [cjs, esm]) { checkSync(api.z); await checkAsync(api.z); }
});

test('the patched published TypeScript source dialect compiles and exercises the same behavior', async t => {
  const f = fixture(t, { full: true }); patchToolingSecurity22({ root: f.root });
  const ts = require('typescript'); const source = join(f.root, 'node_modules/zod/src/v3'); const output = join(f.root, 'compiled-source-v3'); mkdirSync(output);
  function compile(directory, prefix = '') {
    for (const name of readdirSync(directory)) {
      const from = join(directory, name); const rel = prefix ? `${prefix}/${name}` : name;
      if (fs.lstatSync(from).isDirectory()) compile(from, rel);
      else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        const result = ts.transpileModule(readFileSync(from, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
        assert.equal((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
        const target = join(output, rel.replace(/\.ts$/, '.js')); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, result.outputText);
      }
    }
  }
  compile(source); writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
  const api = require(join(output, 'index.js')); checkSync(api.z); await checkAsync(api.z);
});
