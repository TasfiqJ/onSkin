import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs, { appendFileSync, fstatSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { patchToolingSecurity24 } from './patch-tooling.mjs';
import { fixture } from './probe.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const code = token => error => error.code === token;
function targets(f) {
  return f.manifest.packages.flatMap(pkg => Object.keys(f.lock.packages).filter(path => path.endsWith('/' + pkg.name)).flatMap(path => pkg.files.map(file => [join(f.root, path, file.path), file])));
}
function assertOriginal(f) {
  for (const [path, file] of targets(f)) assert.equal(hash(readFileSync(path)), file.originalSHA256);
}

test('production check verifies all six patched forms without granting advisory clearance', () => {
  assert.deepEqual(patchToolingSecurity24({ root: ROOT, check: true }), { status: 'checked', files: 6, advisoryClearance: false, release: 'NO_GO' });
});
test('exact original bytes patch atomically, recheck and remain idempotent', t => {
  const f = fixture(t); assertOriginal(f);
  assert.throws(() => patchToolingSecurity24({ root: f.root, check: true }), code('SECURITY24_UNAPPLIED'));
  const result = patchToolingSecurity24({ root: f.root });
  assert.equal(result.files, 6); assert.equal(result.changed, 6); assert.equal(result.advisoryClearance, false);
  assert.equal(patchToolingSecurity24({ root: f.root }).changed, 0);
  assert.equal(patchToolingSecurity24({ root: f.root, check: true }).status, 'checked');
});
test('every lock-declared nested copy is independently pinned and patched', t => {
  const f = fixture(t, { nested: true });
  assert.equal(patchToolingSecurity24({ root: f.root }).files, 12);
  for (const [path, file] of targets(f)) assert.equal(hash(readFileSync(path)), file.patchedSHA256);
});
test('changed target bytes refuse before any target is written', t => {
  const f = fixture(t);
  for (const [path] of targets(f)) {
    const raw = readFileSync(path); writeFileSync(path, Buffer.concat([raw, Buffer.from('\n')]));
    assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_SOURCE'));
    writeFileSync(path, raw); assertOriginal(f);
  }
});
test('changed dispatch metadata or immutable helper source refuses', t => {
  const f = fixture(t);
  for (const path of ['node_modules/deepmerge/package.json', 'node_modules/zod/v4/core/checks.cjs']) {
    const file = join(f.root, path), raw = readFileSync(file);
    writeFileSync(file, Buffer.concat([raw, Buffer.from('\n')]));
    assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_SOURCE'));
    writeFileSync(file, raw); assertOriginal(f);
  }
});
test('wrong lock version integrity resolved source and alias are refused', t => {
  const f = fixture(t), entry = f.lock.packages['node_modules/deepmerge'];
  for (const [key, wrong] of [['version', '4.3.2'], ['integrity', 'sha512-YQ=='], ['resolved', 'https://example.invalid/package.tgz']]) {
    const original = entry[key]; entry[key] = wrong; f.save();
    assert.throws(() => patchToolingSecurity24({ root: f.root }));
    entry[key] = original; f.save(); assertOriginal(f);
  }
  f.lock.packages['node_modules/DeepMerge'] = { ...entry }; f.save();
  assert.throws(() => patchToolingSecurity24({ root: f.root }));
  delete f.lock.packages['node_modules/DeepMerge']; f.save(); assertOriginal(f);
});
test('missing source or undeclared nested installations cannot be omitted', t => {
  const f = fixture(t), source = join(f.root, 'node_modules/deepmerge/dist/umd.js'), raw = readFileSync(source);
  rmSync(source); assert.throws(() => patchToolingSecurity24({ root: f.root }));
  writeFileSync(source, raw); assertOriginal(f);
  mkdirSync(join(f.root, 'node_modules/zod/node_modules/omitted-zod'), { recursive: true });
  assert.throws(() => patchToolingSecurity24({ root: f.root })); assertOriginal(f);
});
test('changed malformed duplicate-key and invalid-byte manifests cannot redefine accepted source', t => {
  const f = fixture(t), file = join(f.root, 'scripts/security24/backports.json'), raw = readFileSync(file);
  for (const bytes of [Buffer.from('{}'), Buffer.from('{"schema":1,"schema":1}'), Buffer.from([255, 254])]) {
    writeFileSync(file, bytes);
    assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_MANIFEST'));
    assertOriginal(f);
  }
  writeFileSync(file, raw);
});
test('Unicode parent aliases and linked package directories fail closed', t => {
  const f = fixture(t), alias = join(f.root, 'node_modules/ｚod');
  mkdirSync(alias); assert.throws(() => patchToolingSecurity24({ root: f.root }));
  rmdirSync(alias); assertOriginal(f);
  const original = join(f.root, 'node_modules/deepmerge'), parked = join(f.root, 'parked-deepmerge');
  renameSync(original, parked);
  symlinkSync(parked, original, process.platform === 'win32' ? 'junction' : 'dir');
  try { assert.throws(() => patchToolingSecurity24({ root: f.root })); }
  finally { unlinkSync(original); renameSync(parked, original); }
  assertOriginal(f);
});
test('a rename failure rolls actual earlier writes back to the exact preimages', t => {
  const f = fixture(t), original = fs.renameSync;
  let attempted = 0;
  fs.renameSync = (...args) => {
    if (String(args[0]).includes('.security24-') && ++attempted === 3) throw new Error('SYNTHETIC_RENAME_DENIAL');
    return original(...args);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_INPUT_OR_IO_INCOMPLETE')); }
  finally { fs.renameSync = original; syncBuiltinESMExports(); }
  assert.ok(attempted >= 5); assertOriginal(f);
  for (const [path] of targets(f)) assert.ok(!readdirSync(resolve(path, '..')).some(name => name.startsWith('.security24-')));
  assert.equal(patchToolingSecurity24({ root: f.root }).changed, 6);
});
test('original bounded Zod mitigation remains mandatory before any successor write', t => {
  const f = fixture(t), path = join(f.root, 'node_modules/zod/v3/types.cjs'), raw = readFileSync(path);
  writeFileSync(path, Buffer.concat([raw, Buffer.from('\n')]));
  assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_INPUT_OR_IO_INCOMPLETE'));
  writeFileSync(path, raw); assertOriginal(f);
});
test('growth after opening is read with a fixed sentinel bound and refused', t => {
  const f = fixture(t), target = join(f.root, 'node_modules/zod/v4/core/schemas.cjs');
  const before = readFileSync(target), identity = lstatSync(target), original = fs.readSync;
  let changed = false, maximumRead = 0;
  fs.readSync = (fd, buffer, offset, length, position) => {
    const info = fstatSync(fd);
    if (info.dev === identity.dev && info.ino === identity.ino) {
      maximumRead = Math.max(maximumRead, length);
      if (!changed) { changed = true; appendFileSync(target, Buffer.alloc(4 * 1024 * 1024)); }
    }
    return original(fd, buffer, offset, length, position);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_CHANGED')); }
  finally { fs.readSync = original; syncBuiltinESMExports(); writeFileSync(target, before); }
  assert.equal(changed, true); assert.ok(maximumRead <= before.length + 1); assertOriginal(f);
});
test('a mutation between actual renames is refused without overwriting unknown bytes', t => {
  const f = fixture(t), files = targets(f), target = files[1][0], before = readFileSync(target), original = fs.renameSync;
  const changed = Buffer.concat([before, Buffer.from('\n')]);
  let injected = false;
  fs.renameSync = (...args) => {
    const result = original(...args);
    if (!injected && String(args[0]).includes('.security24-')) { injected = true; writeFileSync(target, changed); }
    return result;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(() => patchToolingSecurity24({ root: f.root }), code('SECURITY24_CHANGED'));
    assert.deepEqual(readFileSync(target), changed);
    assert.equal(hash(readFileSync(files[0][0])), files[0][1].originalSHA256);
  } finally { fs.renameSync = original; syncBuiltinESMExports(); writeFileSync(target, before); }
  assert.equal(injected, true); assertOriginal(f);
});
test('invalid arguments and secret-like synthetic input emit only the fixed refusal schema', () => {
  const sentinel = 'security24-synthetic-secret-like-marker';
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, 'patch-tooling.mjs'), '--' + sentinel], { encoding: 'utf8', timeout: 30000, maxBuffer: 65536, windowsHide: true });
  assert.equal(result.status, 1); assert.equal(result.stderr, '');
  assert.equal(result.stdout.includes(sentinel), false);
  assert.deepEqual(JSON.parse(result.stdout), { status: 'REFUSED', reason: 'SECURITY24_PATCH_INCOMPLETE', advisoryClearance: false, release: 'NO_GO' });
});
