import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { COLLECTION_LIMIT46, OUTPUT_BUDGET46, EXPO_BOUNDS_FILES46, patchExpoCollectionBounds46 } from './patch-expo-collection-bounds46.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const CLI = 'node_modules/@expo/cli';
const hash = raw => createHash('sha256').update(raw).digest('hex');
const original = profile => fs.readFileSync(join(import.meta.dirname, 'fixtures46/expo-cli57.0.32', profile.path.split('/').at(-1).replace(/\.js$/, '.cjs')));
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'c46-expo-bounds-')));
  t.after(() => { assert.equal(dirname(root), fs.realpathSync(tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const entry = JSON.parse(fs.readFileSync(join(ROOT, 'package-lock.json'))).packages[CLI];
  const lock = { lockfileVersion: 3, packages: { '': { name: 'synthetic', version: '1.0.0' }, [CLI]: structuredClone(entry) } };
  const save = () => fs.writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
  for (const profile of EXPO_BOUNDS_FILES46) {
    const path = join(root, CLI, profile.path), raw = original(profile);
    assert.equal(hash(raw), profile.before);
    fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, raw);
  }
  fs.copyFileSync(join(ROOT, CLI, 'package.json'), join(root, CLI, 'package.json')); save();
  return { root, lock, save, target: profile => join(root, CLI, profile.path) };
}

test('official source fixture and real installed Zod retain the actual unbounded baseline', () => {
  const profile = EXPO_BOUNDS_FILES46[0], raw = original(profile);
  assert.equal(hash(raw), profile.before);
  const code = "const{Module}=require('node:module');const fs=require('node:fs');const m=new Module(process.argv[1]);m.filename=process.argv[1];m.paths=Module._nodeModulePaths(require('node:path').dirname(m.filename));m._compile(fs.readFileSync(process.argv[2],'utf8'),m.filename);const r=m.exports.DevToolsPluginOutputSchema.safeParse(Array(1025).fill(0));console.log(r.error.issues.length);";
  const result = spawnSync(process.execPath, ['--max-old-space-size=96', '-e', code, join(ROOT, CLI, profile.path), join(import.meta.dirname, 'fixtures46/expo-cli57.0.32/DevToolsPlugin.schema.cjs')], { cwd: ROOT, encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), '1025');
});

test('exact install patch is atomic, checks identities before writes, and refuses drift and aliases', t => {
  const f = fixture(t);
  assert.throws(() => patchExpoCollectionBounds46({ root: f.root, check: true }), /C46_BOUNDS_UNAPPLIED/);
  assert.equal(patchExpoCollectionBounds46({ root: f.root }).changed, 2);
  for (const p of EXPO_BOUNDS_FILES46) assert.equal(hash(fs.readFileSync(f.target(p))), p.after);
  assert.equal(patchExpoCollectionBounds46({ root: f.root }).status, 'already-patched');
  assert.equal(patchExpoCollectionBounds46({ root: f.root, check: true }).status, 'checked');
  for (const p of EXPO_BOUNDS_FILES46) fs.writeFileSync(f.target(p), original(p));
  fs.appendFileSync(f.target(EXPO_BOUNDS_FILES46[1]), '\n');
  assert.throws(() => patchExpoCollectionBounds46({ root: f.root }), /C46_BOUNDS_SOURCE/);
  assert.equal(hash(fs.readFileSync(f.target(EXPO_BOUNDS_FILES46[0]))), EXPO_BOUNDS_FILES46[0].before);
  fs.writeFileSync(f.target(EXPO_BOUNDS_FILES46[1]), original(EXPO_BOUNDS_FILES46[1]));
  const linked = f.target(EXPO_BOUNDS_FILES46[0]) + '.link';
  fs.linkSync(f.target(EXPO_BOUNDS_FILES46[0]), linked);
  try { assert.throws(() => patchExpoCollectionBounds46({ root: f.root })); } finally { fs.unlinkSync(linked); }
  f.lock.packages[CLI].integrity = 'sha512-YQ=='; f.save();
  assert.throws(() => patchExpoCollectionBounds46({ root: f.root }), /C46_BOUNDS_PACKAGE/);
});

test('a real second commit failure restores exact first-file bytes and removes staged files', t => {
  const f = fixture(t), rename = fs.renameSync; let calls = 0;
  const mocked = t.mock.method(fs, 'renameSync', (...args) => {
    if (++calls === 2) throw new Error('SYNTHETIC_SECOND_RENAME_FAILURE');
    return rename(...args);
  });
  try { assert.throws(() => patchExpoCollectionBounds46({ root: f.root }), /SYNTHETIC_SECOND_RENAME_FAILURE/); }
  finally { mocked.mock.restore(); }
  for (const p of EXPO_BOUNDS_FILES46) {
    assert.equal(hash(fs.readFileSync(f.target(p))), p.before);
    assert.ok(fs.readdirSync(dirname(f.target(p))).every(name => !name.startsWith('.c46-bounds-')));
  }
});

test('real installed consumer rejects 200k malformed entries within96MB and preserves normal schemas', () => {
  patchExpoCollectionBounds46({ check: true });
  const code = "const{DevToolsPluginOutputSchema:s}=require(process.argv[1]);const{DevToolsPluginCliExtensionResults:C}=require(process.argv[2]);const r=s.safeParse(Array(200000).fill(0));if(r.success||r.error.issues.length!==1)throw Error('UNBOUNDED');const c=new C();c.append(JSON.stringify(Array(200000).fill(0)));if(c.getOutput().length!==1)throw Error('OUTPUT');console.log('BOUNDED');";
  const result = spawnSync(process.execPath, ['--max-old-space-size=96', '-e', code, ...EXPO_BOUNDS_FILES46.map(p => join(ROOT, CLI, p.path))], { cwd: ROOT, timeout: 10000, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'BOUNDED');
  const require = createRequire(join(ROOT, CLI, 'package.json'));
  const { DevToolsPluginOutputSchema: schema } = require('./build/src/start/server/DevToolsPlugin.schema.js');
  const { DevToolsPluginCliExtensionResults: Results } = require('./build/src/start/server/DevToolsPluginCliExtensionResults.js');
  const records = [{ type: 'text', text: 'ordinary', level: 'info' }, { type: 'audio', url: 'https://example.invalid/a' }, { type: 'image', url: 'https://example.invalid/i' }];
  assert.deepEqual(schema.parse(records), records);
  assert.equal(schema.parse(Array(COLLECTION_LIMIT46).fill(records[0])).length, COLLECTION_LIMIT46);
  const seen = [], normal = new Results(rows => seen.push(...rows));
  normal.append(JSON.stringify(records)); normal.append('plain\nsecond', 'warning'); normal.exit(7);
  assert.deepEqual(normal.getOutput(), [...records, { type: 'text', text: 'plain', level: 'warning' }, { type: 'text', text: 'second', level: 'warning' }, { type: 'text', text: 'Process exited with code 7', level: 'error' }]);
  assert.deepEqual(seen, normal.getOutput()); assert.equal(normal.isTruncated(), false);
  for (const value of ['x'.repeat(OUTPUT_BUDGET46 + 1), '\u{1F600}'.repeat(OUTPUT_BUDGET46 / 4 + 1), 'x\n'.repeat(200000)]) {
    const limited = new Results(); limited.append(value);
    assert.equal(limited.isTruncated(), true); assert.equal(limited.getOutput().length, 1);
    const before = JSON.stringify(limited.getOutput()); limited.append('late');
    assert.equal(JSON.stringify(limited.getOutput()), before);
  }
  const fragments = new Results();
  for (let i = 0; i <= COLLECTION_LIMIT46; i++) fragments.append('x');
  assert.equal(fragments.isTruncated(), true); assert.equal(fragments.getOutput().length, COLLECTION_LIMIT46);
});

test('real executor terminates once on output budget and keeps terminal output stable', async () => {
  const require = createRequire(join(ROOT, CLI, 'package.json'));
  const { DevToolsPluginCliExtensionExecutor: Executor } = require('./build/src/start/server/DevToolsPluginCliExtensionExecutor.js');
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  let kills = 0; child.kill = signal => { assert.equal(signal, 'SIGKILL'); kills++; return true; };
  const plugin = { packageName: 'synthetic', packageRoot: ROOT, cliExtensions: { entryPoint: 'never-executed.js', commands: [{ name: 'synthetic', parameters: [] }] } };
  const promise = new Executor(plugin, ROOT, () => child).execute({ command: 'synthetic', args: {}, metroServerOrigin: 'https://example.invalid' });
  child.stdout.emit('data', Buffer.from('x'.repeat(OUTPUT_BUDGET46 + 1)));
  const result = await promise, frozen = JSON.stringify(result);
  assert.equal(kills, 1); assert.equal(result.length, 1); assert.equal(result[0].level, 'error');
  child.stdout.emit('data', Buffer.from('late')); child.stderr.emit('data', Buffer.from('late')); child.emit('close', 0);
  assert.equal(JSON.stringify(result), frozen); assert.equal(kills, 1);
});

