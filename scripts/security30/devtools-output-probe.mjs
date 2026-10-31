// Finite synthetic observations of installed consumers; no plugin is executed.
import assert from 'node:assert/strict';
import { constants } from 'node:buffer';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const require = createRequire(resolve(root, 'package.json'));
const base = resolve(root, 'node_modules/@expo/cli/build/src/start/server');
const pins = {
  'DevToolsPlugin.schema.js': '4da5edad8daa6eda49fecc646934d372008952004b2c19abc03e27bcffc904a5',
  'DevToolsPluginCliExtensionResults.js': 'ab531966e34f5009d65fab4a00204cc999580d21b921f58ef58e00c568801c02',
  'DevToolsPluginCliExtensionExecutor.js': 'f4ee6307896aee35bcac074f7305bfd56fa593c7501ad547f3b5169af1f31236',
  'createMCPDevToolsExtensionSchema.js': '9feffc368c805c3188bb1a4dd88617a3986cd71a4f3358821a1ab6da8e44b10d',
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const text = { type: 'text', text: 'synthetic', level: 'info' };
const image = { type: 'image', url: 'https://example.invalid/synthetic.png', text: 'synthetic' };
const bounded = value => {
  const input = JSON.stringify(value);
  assert.ok(!Array.isArray(value) || value.length <= 512);
  assert.ok(Buffer.byteLength(input) <= 65536);
  return input;
};

async function probe(mode) {
  assert.ok(['ordinary', 'ordering', 'executor', 'controller-timeout', 'controller-output',
    ...['invalid', 'valid'].flatMap(kind => [32, 128, 512].map(n => `${kind}-${n}`))].includes(mode));
  // Controller fault controls have no dependency or plugin side effects.
  if (mode === 'controller-timeout') return await new Promise(() => setInterval(() => {}, 1000));
  if (mode === 'controller-output') {
    process.stdout.write('x'.repeat(65537));
    return await new Promise(() => setInterval(() => {}, 1000));
  }
  assert.equal(require(resolve(root, 'node_modules/@expo/cli/package.json')).version, '57.0.32');
  assert.equal(require(resolve(root, 'node_modules/zod/package.json')).version, '3.25.76');
  for (const [file, expected] of Object.entries(pins)) assert.equal(hash(readFileSync(resolve(base, file))), expected);
  const schema = require(resolve(base, 'DevToolsPlugin.schema.js')).DevToolsPluginOutputSchema;
  const Results = require(resolve(base, 'DevToolsPluginCliExtensionResults.js')).DevToolsPluginCliExtensionResults;
  if (/^(invalid|valid)-/.test(mode)) {
    const [kind, size] = mode.split('-'), n = Number(size);
    const value = Array(n).fill(kind === 'valid' ? text : 0), input = bounded(value);
    const direct = schema.safeParse(value);
    const original = schema.safeParse;
    let calls = 0, issues = 0;
    // Observe the real call/result without changing validation or fabricating issues.
    schema.safeParse = function (...args) {
      calls++;
      const result = original.apply(this, args);
      issues = result.success ? 0 : result.error.issues.length;
      return result;
    };
    let callbackRecords = 0;
    const consumer = new Results(lines => { callbackRecords += lines.length; });
    try { consumer.append(input); } finally { schema.safeParse = original; }
    const output = consumer.getOutput();
    if (kind === 'valid') assert.deepEqual(output, value);
    else assert.deepEqual(output, [{ type: 'text', level: 'error',
      text: `Invalid JSON: ${direct.error.issues.map(issue => issue.message).join(', ')}` }]);
    return { kind, members: n, inputBytes: Buffer.byteLength(input), directIssues: direct.success ? 0 : direct.error.issues.length,
      consumerIssues: issues, schemaCalls: calls, outputRecords: output.length, callbackRecords,
      outputTextLength: output.reduce((n, row) => n + (row.text?.length ?? 0), 0),
      outputJSONBytes: Buffer.byteLength(JSON.stringify(output)), truncated: consumer.isTruncated() };
  }
  if (mode === 'ordinary') {
    const consumer = new Results();
    consumer.append(bounded([text, image]));
    consumer.append('{synthetic\nplain');
    consumer.append('');
    consumer.append('synthetic stderr', 'error');
    consumer.append('synthetic warning', 'warning');
    consumer.exit(0);
    consumer.exit(7);
    assert.deepEqual(consumer.getOutput(), [text, image,
      { type: 'text', text: '{synthetic', level: 'info' }, { type: 'text', text: 'plain', level: 'info' },
      { type: 'text', text: 'synthetic stderr', level: 'error' },
      { type: 'text', text: 'synthetic warning', level: 'warning' },
      { type: 'text', text: 'Process exited with code 7', level: 'error' }]);
    return { compatibilityAssertions: 7, outputRecords: 7, maxStringLength: constants.MAX_STRING_LENGTH,
      truncationExercise: 'NOT_RUN_NO_DOCUMENTED_LIMIT_OVERRIDE' };
  }
  if (mode === 'ordering') {
    const order = [], original = schema.safeParse;
    const timer = new Promise(done => setTimeout(() => { order.push('timer'); done(); }, 0));
    schema.safeParse = function (...args) {
      order.push('schema-enter'); const result = original.apply(this, args); order.push('schema-exit'); return result;
    };
    try {
      order.push('before');
      new Results(() => order.push('output')).append(bounded(Array(512).fill(0)));
      order.push('after');
    } finally { schema.safeParse = original; }
    await timer;
    assert.deepEqual(order, ['before', 'schema-enter', 'schema-exit', 'output', 'after', 'timer']);
    return { order, orderingOnly: true };
  }
  const Executor = require(resolve(base, 'DevToolsPluginCliExtensionExecutor.js')).DevToolsPluginCliExtensionExecutor;
  const makeSchema = require(resolve(base, 'createMCPDevToolsExtensionSchema.js')).createMCPDevToolsExtensionSchema;
  const plugin = { packageName: 'synthetic', packageRoot: root, cliExtensions: { entryPoint: 'synthetic-never-run.js',
    commands: [{ name: 'synthetic', title: 'Synthetic', environments: ['mcp'], parameters: [{ name: 'value', type: 'text' }] }] } };
  const options = { command: 'synthetic', args: { value: 'synthetic' }, metroServerOrigin: 'https://example.invalid' };
  let spawnCalls = 0, callbackCalls = 0;
  const fake = () => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.kills = 0; child.kill = signal => { assert.equal(signal, 'SIGKILL'); child.kills++; return true; }; return child;
  };
  const child = fake();
  const spawn = (executable, args, settings) => {
    spawnCalls++; assert.equal(executable, process.execPath); assert.equal(args[0], resolve(root, plugin.cliExtensions.entryPoint));
    assert.equal(settings.cwd, root); return child;
  };
  const executor = new Executor(plugin, root, spawn);
  assert.equal(executor.timeoutMs, 10000);
  assert.throws(() => new Executor({ ...plugin, cliExtensions: { ...plugin.cliExtensions, entryPoint: '../escape.js' } }, root, spawn));
  await assert.rejects(executor.execute({ ...options, command: 'unknown' }));
  await assert.rejects(executor.execute({ ...options, args: { value: 1 } }));
  await assert.rejects(executor.execute({ ...options, args: {} }));
  assert.equal(spawnCalls, 0);
  const inputSchema = makeSchema(plugin);
  assert.equal(inputSchema.safeParse({ command: 'synthetic', value: 'synthetic' }).success, true);
  assert.equal(inputSchema.safeParse({ command: 'unknown' }).success, false);
  assert.equal(inputSchema.safeParse({ command: 'synthetic', value: 1 }).success, false);
  assert.equal(inputSchema.safeParse({ command: 'synthetic', extra: true }).success, false);
  const pending = executor.execute({ ...options, onOutput: () => callbackCalls++ });
  child.stdout.emit('data', Buffer.from(bounded([text, image])));
  child.stderr.emit('data', Buffer.from('synthetic stderr'));
  child.emit('close', 7);
  const output = await pending;
  assert.equal(output.length, 4); assert.equal(callbackCalls, 3); assert.equal(child.kills, 0);
  const terminal = [];
  for (const ending of ['error', 'timeout']) {
    const injected = fake(); let callbacks = 0;
    const run = new Executor(plugin, root, () => injected, 10).execute({ ...options, onOutput: () => callbacks++ });
    if (ending === 'error') injected.emit('error', new Error('SYNTHETIC'));
    const returned = await run;
    assert.equal(returned.length, 1);
    assert.equal(injected.kills, ending === 'timeout' ? 1 : 0);
    // Observe late stream callbacks after settlement, without creating an OS child.
    const before = returned.length, callbacksBefore = callbacks;
    injected.stdout.emit('data', Buffer.from(bounded([text])));
    injected.emit('close', 0);
    terminal.push({ ending, before, after: returned.length, lateCallbacks: callbacks - callbacksBefore, kills: injected.kills });
  }
  const thrown = await new Executor(plugin, root, () => { throw new Error('SYNTHETIC'); }).execute(options);
  assert.equal(thrown.length, 1); assert.equal(thrown[0].level, 'error');
  return { injectedOnly: true, defaultTimeoutMs: executor.timeoutMs, ordinaryRecords: output.length,
    commandAndParameterRefusals: 3, entrypointRefusals: 1, inputSchemaControls: 4, terminal };
}

try {
  assert.equal(process.argv.length, 3);
  const result = await probe(process.argv[2]);
  process.stdout.write(JSON.stringify({ mode: process.argv[2], result, qualification: 'BOUNDED_SYNTHETIC_INSTALLED_CONSUMER',
    acceptanceGranted: false, release: 'NO_GO' }) + '\n');
} catch {
  process.stdout.write('{"status":"REFUSED","reason":"SECURITY30_PROBE_INCOMPLETE","release":"NO_GO"}\n');
  process.exitCode = 1;
}
