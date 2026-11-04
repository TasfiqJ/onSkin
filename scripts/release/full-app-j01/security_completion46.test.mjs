import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import decode from 'decode-uri-component';

const root = resolve(import.meta.dirname, '../../..');

test('C46 URI decoding preserves valid, malformed and mixed input', () => {
  for (const [input, expected] of [
    ['hello%20world', 'hello world'],
    ['%E2%9C%93', '✓'],
    ['%zz', '%zz'],
    ['plain%20text%zz', 'plain text%zz'],
    ['', ''],
  ]) assert.equal(decode(input), expected);
  for (const value of [null, undefined, 3, {}]) assert.throws(() => decode(value), TypeError);
});

test('C46 distinct malformed percent runs finish in a bounded real dependency process', () => {
  // GHSA-qr28-fpjm-wq7f: the former decoder rescanned the whole input once
  // per distinct run. Use the actual installed decoder and Router dependency,
  // with a subprocess bound so a regression cannot stall the test runner.
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import decode from 'decode-uri-component';
    import queryString from 'query-string';
    const payload = Array.from({ length: 32000 }, (_, n) =>
      '%' + (n >> 8).toString(16).padStart(2, '0') +
      '%' + (n & 255).toString(16).padStart(2, '0') + 'x').join('') + '%zz';
    const decoded = decode(payload);
    assert.equal(typeof decoded, 'string');
    assert.ok(decoded.endsWith('%zz'));
    assert.equal(queryString.parse('value=' + payload).value, decoded);
    console.log(JSON.stringify({ inputBytes: payload.length, completed: true }));
  `], { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 8192, windowsHide: true });
  assert.equal(result.error, undefined, 'real decoder must complete before the subprocess deadline');
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { inputBytes: 224003, completed: true });
});

test('C46 canonical URI package and callable consumer adapter are installed', () => {
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const entry = lock.packages['packages/decode-uri-component-compat/node_modules/decode-uri-component'];
  assert.equal(entry.version, '0.5.1');
  assert.equal(entry.resolved, 'https://registry.npmjs.org/decode-uri-component/-/decode-uri-component-0.5.1.tgz');
  const require = createRequire(resolve(root, 'node_modules/query-string/index.js'));
  assert.equal(typeof require('decode-uri-component'), 'function');
  assert.equal(require('decode-uri-component')('a%20b'), 'a b');
  const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath.js');
  const state = getStateFromPath('/details?name=hello%20world', { screens: { details: 'details' } });
  assert.equal(state.routes[0].params.name, 'hello world');
});

test('C46 minimatch preprocessing respects its caller expansion bound', () => {
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--eval', `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const requireFingerprint = createRequire(require.resolve('@expo/fingerprint/package.json'));
    const { Minimatch } = requireFingerprint('minimatch');
    const pattern = Array(30).fill('**/../a/b').join('/');
    const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 });
    assert.equal(matcher.set.length, 64);
    assert.equal(new Minimatch('**/../a/b/**/../c/d', { optimizationLevel: 2 }).match('x/a/b/y/c/d'), true);
    console.log('BOUNDED');
  `], { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 8192, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'BOUNDED');
});

test('C46 glob abort stops subsequent real filesystem traversal', async () => {
  const require = createRequire(import.meta.url);
  const { glob } = require('glob');
  const directory = fs.mkdtempSync(resolve(tmpdir(), 'c46-glob-'));
  try {
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
      const child = resolve(directory, String(a), String(b));
      fs.mkdirSync(child, { recursive: true });
      fs.writeFileSync(resolve(child, 'synthetic.txt'), 'synthetic');
    }
    const controller = new AbortController();
    let readsAfterAbort = 0;
    const nativePort = { ...fs, readdir(...args) {
      if (controller.signal.aborted) readsAfterAbort++;
      const callback = args.pop();
      fs.readdir(...args, (...data) => {
        if (!controller.signal.aborted) controller.abort(new Error('synthetic-abort'));
        callback(...data);
      });
    } };
    await assert.rejects(glob('**/*', { cwd: directory, fs: nativePort, signal: controller.signal }), /synthetic-abort/);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(readsAfterAbort, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
