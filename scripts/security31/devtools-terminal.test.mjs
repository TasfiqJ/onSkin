import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { EXECUTOR, POSTIMAGE, PREIMAGE, patchDevToolsTerminal } from './patch-devtools-terminal.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const TARGET = resolve(ROOT, 'node_modules/@expo/cli', EXECUTOR);
const require = createRequire(TARGET);
const hash = raw => createHash('sha256').update(raw).digest('hex');
const text = { type: 'text', text: 'synthetic', level: 'info' };
const image = { type: 'image', url: 'https://example.invalid/image', text: 'synthetic' };
const audio = { type: 'audio', url: 'https://example.invalid/audio', text: 'synthetic' };
const plugin = { packageName: 'synthetic', packageRoot: ROOT, cliExtensions: { entryPoint: 'never-executed.js',
  commands: [{ name: 'synthetic', parameters: [{ name: 'value', type: 'text' }] }] } };
const options = { command: 'synthetic', args: { value: 'synthetic' }, metroServerOrigin: 'https://example.invalid' };
const flags = ['--max-old-space-size=128', '--stack-size=512'];
function cleanEnv() {
  const env = { CI: '1', EXPO_NO_TELEMETRY: '1' };
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'ComSpec', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key];
  return env;
}
function originalBytes() {
  let raw = readFileSync(TARGET);
  if (hash(raw) === POSTIMAGE) {
    let source = raw.toString('utf8');
    for (const stream of ['stdout', 'stderr']) {
      const before = `child.${stream}.on('data', (data)=>{`;
      const after = before + '\n                    if (finished) return;';
      assert.equal(source.split(after).length, 2); source = source.replace(after, before);
    }
    raw = Buffer.from(source);
  }
  assert.equal(hash(raw), PREIMAGE); return raw;
}
function executor(baseline = false) {
  const raw = baseline ? originalBytes() : readFileSync(TARGET);
  assert.ok([PREIMAGE, POSTIMAGE].includes(hash(raw)));
  // Compile authenticated package bytes, retaining the real installed Results/schema.
  // No consumer implementation or schema algorithm is copied into a test double.
  const loaded = new Module(TARGET); loaded.filename = TARGET;
  loaded.paths = Module._nodeModulePaths(dirname(TARGET)); loaded._compile(raw.toString('utf8'), TARGET);
  return { Executor: loaded.exports.DevToolsPluginCliExtensionExecutor, sourceHash: hash(raw) };
}
function fake() {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.kills = 0; child.kill = signal => { assert.equal(signal, 'SIGKILL'); child.kills++; return true; }; return child;
}
async function behavior(baseline) {
  const { Executor, sourceHash } = executor(baseline);
  const ordinary = fake(); let spawnCalls = 0;
  const instance = new Executor(plugin, ROOT, (exe, args, settings) => {
    assert.equal(exe, process.execPath); assert.equal(args[0], resolve(ROOT, plugin.cliExtensions.entryPoint));
    assert.equal(settings.cwd, ROOT); spawnCalls++; return ordinary;
  });
  assert.equal(instance.timeoutMs, 10000);
  for (const value of [{ ...options, command: 'unknown' }, { ...options, args: {} }, { ...options, args: { value: 1 } }, { ...options, args: { other: 'synthetic' } }]) await assert.rejects(instance.execute(value));
  assert.equal(spawnCalls, 0);
  assert.throws(() => new Executor({ ...plugin, cliExtensions: { ...plugin.cliExtensions, entryPoint: '../escape.js' } }, ROOT));
  const pending = instance.execute(options);
  ordinary.stdout.emit('data', Buffer.from(JSON.stringify([text, image, audio])));
  ordinary.stderr.emit('data', Buffer.from('{malformed\nplain'));
  ordinary.stdout.emit('data', Buffer.from(''));
  ordinary.emit('close', 7);
  assert.deepEqual(await pending, [text, image, audio, { type: 'text', text: '{malformed', level: 'error' },
    { type: 'text', text: 'plain', level: 'error' }, { type: 'text', text: 'Process exited with code 7', level: 'error' }]);
  const thrown = await new Executor(plugin, ROOT, () => { throw new Error('SYNTHETIC_SPAWN'); }).execute(options);
  assert.deepEqual(thrown, [{ type: 'text', level: 'error', text: 'Error: SYNTHETIC_SPAWN' }]);
  const terminal = [];
  for (const ending of ['error', 'timeout', 'close']) {
    const child = fake(); let callbacks = 0;
    const pending = new Executor(plugin, ROOT, () => child, 20).execute({ ...options, onOutput: () => callbacks++ });
    child.stdout.emit('data', Buffer.from(JSON.stringify([text])));
    if (ending === 'error') child.emit('error', new Error('SYNTHETIC_ERROR'));
    if (ending === 'close') child.emit('close', 0);
    const returned = await pending, snapshot = JSON.stringify(returned), count = callbacks;
    assert.equal(returned.length, ending === 'close' ? 1 : 2);
    if (ending !== 'close') assert.equal(returned[1].text, ending === 'error' ? 'Error: SYNTHETIC_ERROR' : 'Command timed out');
    assert.equal(child.kills, ending === 'timeout' ? 1 : 0);
    child.stdout.emit('data', Buffer.from(JSON.stringify([text])));
    child.stderr.emit('data', Buffer.from('late synthetic stderr'));
    child.emit('error', new Error('REPEATED_SYNTHETIC')); child.emit('close', 7); child.emit('close', 0);
    if (sourceHash === POSTIMAGE) for (const stream of [child.stdout, child.stderr]) stream.emit('data', { toString() { throw new Error('POST_TERMINAL_CONVERSION'); } });
    terminal.push({ ending, lateRecords: returned.length - JSON.parse(snapshot).length, lateCallbacks: callbacks - count,
      stable: JSON.stringify(returned) === snapshot });
  }
  return { sourceHash, ordinaryRecords: 6, parameterRefusals: 4, terminal, injectedProcessOnly: true };
}
function patchControls() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'security31-')));
  const original = originalBytes(), pkg = readFileSync(resolve(ROOT, 'node_modules/@expo/cli/package.json'));
  const lockEntry = JSON.parse(readFileSync(resolve(ROOT, 'package-lock.json'))).packages['node_modules/@expo/cli'];
  const path = 'node_modules/@expo/cli';
  const lock = { lockfileVersion: 3, packages: { '': { name: 'synthetic', version: '1.0.0' }, [path]: lockEntry } };
  const target = join(directory, path, EXECUTOR), packageFile = join(directory, path, 'package.json');
  const save = () => writeFileSync(join(directory, 'package-lock.json'), JSON.stringify(lock));
  try {
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, original); writeFileSync(packageFile, pkg); save();
    assert.throws(() => patchDevToolsTerminal({ root: directory, check: true }), /SECURITY31_UNAPPLIED/);
    assert.equal(patchDevToolsTerminal({ root: directory }).status, 'patched');
    assert.equal(hash(readFileSync(target)), POSTIMAGE);
    assert.equal(patchDevToolsTerminal({ root: directory }).status, 'already-patched');
    assert.equal(patchDevToolsTerminal({ root: directory, check: true }).status, 'checked');
    writeFileSync(target, Buffer.concat([original, Buffer.from('\n')]));
    assert.throws(() => patchDevToolsTerminal({ root: directory }), /SECURITY31_SOURCE/);
    assert.equal(hash(readFileSync(target)), hash(Buffer.concat([original, Buffer.from('\n')])));
    writeFileSync(target, original); writeFileSync(packageFile, Buffer.concat([pkg, Buffer.from('\n')]));
    assert.throws(() => patchDevToolsTerminal({ root: directory }), /SECURITY31_PACKAGE/); writeFileSync(packageFile, pkg);
    lock.packages[path] = { ...lockEntry, integrity: 'sha512-YQ==' }; save();
    assert.throws(() => patchDevToolsTerminal({ root: directory }), /SECURITY31_PACKAGE/);
    lock.packages[path] = lockEntry; save();
    const link = target + '.hardlink'; linkSync(target, link);
    try { assert.throws(() => patchDevToolsTerminal({ root: directory }), /SECURITY31_/); } finally { unlinkSync(link); }
    const nested = 'node_modules/synthetic-parent/node_modules/@expo/cli';
    lock.packages['node_modules/synthetic-parent'] = { version: '1.0.0', resolved: 'https://registry.npmjs.org/synthetic-parent/-/synthetic-parent-1.0.0.tgz', integrity: 'sha512-YQ==' };
    lock.packages[nested] = lockEntry;
    const nestedTarget = join(directory, nested, EXECUTOR); mkdirSync(dirname(nestedTarget), { recursive: true });
    writeFileSync(join(directory, nested, 'package.json'), pkg); writeFileSync(nestedTarget, 'UNKNOWN'); save();
    assert.throws(() => patchDevToolsTerminal({ root: directory }), /SECURITY31_SOURCE/);
    assert.equal(hash(readFileSync(target)), PREIMAGE); // all declared targets validate before any mutation
    writeFileSync(nestedTarget, original);
    assert.equal(patchDevToolsTerminal({ root: directory }).changed, 2);
    assert.equal(patchDevToolsTerminal({ root: directory, check: true }).files, 2);
    return { checkMode: true, idempotent: true, sourcePackageIntegrityHardlinkRefusals: true, nestedCopies: 2, preflightAtomic: true };
  } finally {
    assert.equal(dirname(directory), realpathSync(tmpdir()));
    assert.ok(directory.split(/[\\/]/).at(-1).startsWith('security31-'));
    rmSync(directory, { recursive: true, force: true });
  }
}
let invocations = 0;
function spawnOwned(args, deadline = 4500) {
  assert.ok(++invocations <= 32); assert.ok(deadline > 0 && deadline <= 5000);
  const child = spawn(process.execPath, [...flags, ...args], { env: cleanEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let bytes = 0, captured = 0, reason = null;
  const stdout = [], stderr = [];
  const stop = value => { if (!reason) { reason = value; child.kill('SIGKILL'); } };
  const timer = setTimeout(() => stop('TIMEOUT'), deadline);
  for (const [stream, pieces] of [[child.stdout, stdout], [child.stderr, stderr]]) stream.on('data', raw => {
    bytes += raw.length; const keep = raw.subarray(0, Math.max(0, 65536 - captured)); captured += keep.length; pieces.push(keep);
    if (bytes > 65536) stop('OUTPUT_LIMIT');
  });
  child.on('error', () => { reason ??= 'SPAWN_ERROR'; });
  const closed = new Promise(done => child.on('close', (code, signal) => {
    clearTimeout(timer); done({ code, signal, reason, captured, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'), closed: true });
  }));
  return { child, closed };
}
async function probe(mode, deadline) {
  const owned = spawnOwned([import.meta.filename, '--probe', mode], deadline);
  return await owned.closed;
}
async function observation(mode) {
  const result = await probe(mode);
  assert.equal(result.reason, null); assert.equal(result.signal, null); assert.equal(result.code, 0); assert.equal(result.stderr, '');
  const value = JSON.parse(result.stdout); assert.equal(value.release, 'NO_GO'); assert.equal(value.acceptanceGranted, false);
  console.log(JSON.stringify({ mode, ...value.result })); return value.result;
}
async function realChild(ending) {
  const { Executor, sourceHash } = executor(); assert.equal(sourceHash, POSTIMAGE);
  const events = []; let owned, callbacks = 0;
  const source = `process.stdout.write(${JSON.stringify(JSON.stringify([text]))});` +
    (ending === 'close' ? "process.stderr.write('synthetic stderr');process.exitCode=7;" : 'setInterval(()=>{},1000);');
  try {
    const result = await new Executor(plugin, ROOT, () => {
      owned = spawnOwned(['-e', source]);
      const kill = owned.child.kill.bind(owned.child);
      owned.child.kill = signal => { events.push('kill-request'); return kill(signal); };
      owned.child.stdout.on('data', () => events.push('stdout'));
      owned.child.on('close', () => events.push('close'));
      return owned.child;
    }, 1000).execute({ ...options, onOutput: () => callbacks++ });
    events.push('settled'); const snapshot = JSON.stringify(result), before = callbacks;
    const closed = await owned.closed;
    assert.equal(closed.reason, null); assert.equal(closed.closed, true); assert.ok(events.includes('stdout'));
    assert.equal(JSON.stringify(result), snapshot); assert.equal(callbacks, before);
    assert.ok(result.some(row => row.text === 'synthetic'));
    if (ending === 'close') {
      assert.equal(closed.code, 7); assert.equal(closed.signal, null);
      assert.ok(result.some(row => row.text === 'synthetic stderr' && row.level === 'error'));
      assert.ok(result.some(row => row.text === 'Process exited with code 7'));
      assert.ok(events.indexOf('close') < events.indexOf('settled')); assert.ok(!events.includes('kill-request'));
    } else {
      assert.ok(result.some(row => row.text === 'Command timed out'));
      assert.ok(events.indexOf('kill-request') < events.indexOf('settled')); assert.ok(events.includes('close'));
    }
    console.log(JSON.stringify({ realSyntheticChild: ending, events, resultRecords: result.length,
      code: closed.code, signal: closed.signal, captured: closed.captured, awaitedClose: true, lateOSDataObserved: false }));
  } finally {
    if (owned && owned.child.exitCode === null && owned.child.signalCode === null) owned.child.kill('SIGKILL');
    if (owned) await owned.closed;
  }
}
if (process.argv[2] === '--probe') {
  try {
    const mode = process.argv[3]; let result;
    if (mode === 'baseline') result = await behavior(true);
    else if (mode === 'installed') result = await behavior(false);
    else if (mode === 'patch') result = patchControls();
    else if (mode === 'timeout') await new Promise(() => setInterval(() => {}, 1000));
    else if (mode === 'output') { process.stdout.write('x'.repeat(65537)); await new Promise(() => setInterval(() => {}, 1000)); }
    else throw new Error('MODE');
    console.log(JSON.stringify({ result, acceptanceGranted: false, release: 'NO_GO' }));
  } catch {
    console.log(JSON.stringify({ reason: 'SECURITY31_PROBE_INCOMPLETE', release: 'NO_GO' })); process.exitCode = 1;
  }
} else {
  test('authenticated baseline retains the independently observed defect', async () => {
    const result = await observation('baseline'); assert.equal(result.sourceHash, PREIMAGE);
    assert.deepEqual(result.terminal.map(row => [row.lateRecords, row.lateCallbacks]), [[2, 2], [2, 2], [2, 2]]);
  });
  test('installed terminal invariant and ordinary compatibility', async () => {
    const result = await observation('installed');
    assert.deepEqual(result.terminal.map(row => [row.lateRecords, row.lateCallbacks]), [[0, 0], [0, 0], [0, 0]], 'POST_SETTLEMENT_OUTPUT');
    assert.equal(result.sourceHash, POSTIMAGE); assert.ok(result.terminal.every(row => row.stable));
  });
  test('exact-source patch refuses unknown inputs and is idempotent', async () => { await observation('patch'); });
  test('real synthetic Node child ordinary close is awaited', async () => { await realChild('close'); });
  test('real synthetic Node child timeout kill and close are awaited', async () => { await realChild('timeout'); });
  test('unknown probe mode refuses', async () => {
    const result = await probe('unknown'); assert.equal(result.code, 1); assert.equal(result.reason, null);
    assert.equal(JSON.parse(result.stdout).reason, 'SECURITY31_PROBE_INCOMPLETE');
  });
  test('controller terminates and awaits its timed-out child', async () => {
    const result = await probe('timeout', 500); assert.equal(result.reason, 'TIMEOUT'); assert.equal(result.closed, true);
  });
  test('controller caps output and awaits its owned child', async () => {
    const result = await probe('output'); assert.equal(result.reason, 'OUTPUT_LIMIT'); assert.equal(result.captured, 65536); assert.equal(result.closed, true);
  });
}
