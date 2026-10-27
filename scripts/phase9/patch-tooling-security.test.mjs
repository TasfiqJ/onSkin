import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { patchToolingSecurity } from './patch-tooling-security.mjs';

const sourceRoot = resolve(import.meta.dirname, '../..');
const script = readFileSync(join(import.meta.dirname, 'patch-tooling-security.mjs'), 'utf8');
const profiles = JSON.parse(script.match(/const PROFILES = ([\s\S]*?);\nconst SCRIPT_ROOT/)[1]);
const originals = JSON.parse(gunzipSync(readFileSync(join(import.meta.dirname, 'tooling-security-backports/originals.json.gz'))));
const hash = value => createHash('sha256').update(value).digest('hex');
function fixture(t, nested = false, unpatched = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tooling-security-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const lock = { lockfileVersion: 3, packages: {} };
  const targets = [];
  for (const profile of profiles) {
    const paths = [`node_modules/${profile.name}`];
    if (nested) paths.push(`node_modules/fixture/node_modules/${profile.name}`);
    for (const path of paths) {
      lock.packages[path] = { version: profile.version, resolved: profile.resolved, integrity: profile.integrity };
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify({ name: profile.name, version: profile.version }));
      for (const file of profile.files) {
        const target = join(root, path, file.path);
        mkdirSync(dirname(target), { recursive: true });
        mkdirSync(dirname(join(root, file.payload)), { recursive: true });
        copyFileSync(join(sourceRoot, file.payload), join(root, file.payload));
        const bytes = unpatched ? Buffer.from(originals[`${profile.name}/${file.path}`], 'base64') : readFileSync(join(sourceRoot, file.payload));
        const expected = unpatched ? file.original : file.patched;
        assert.equal(hash(bytes), expected);
        writeFileSync(target, bytes);
        targets.push({ path: target, hash: expected });
      }
    }
  }
  const save = () => writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
  save();
  return { root, lock, save, targets };
}
const code = expected => error => error.code === expected;

test('exact reviewed files and every nested copy are checked without audit clearance', t => {
  const f = fixture(t, true);
  assert.deepEqual(patchToolingSecurity({ root: f.root, check: true }), {
    status: 'checked', files: 10, versionsChanged: false, auditClearance: false,
  });
  assert.equal(patchToolingSecurity({ root: f.root }).status, 'already-patched');
  for (const file of f.targets) assert.equal(hash(readFileSync(file.path)), file.hash);
});

test('exact upstream forge 1.4.2 preserves the inherited capture hardening and unknown-source refusal', t => {
  const f = fixture(t);
  const profile = {
    version: '1.4.2',
    resolved: 'https://registry.npmjs.org/node-forge/-/node-forge-1.4.2.tgz',
    integrity: 'sha512-rRtAR5XLJ8gCKd9du4qrKAsgCG1ObGP4gLeNJMa4vYSeq4bmBMOJk5IHkrviBV0q7uoAJlVd8HEQYQSVUb4FGQ==',
  };
  f.lock.packages['node_modules/node-forge'] = profile; f.save();
  const packageRoot = join(f.root, 'node_modules/node-forge');
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: 'node-forge', version: profile.version }));
  const files = ['rsa.js', 'asn1.js', 'pem.js', 'tls.js', 'pkcs12.js', 'pbe.js', 'x509.js'];
  for (const file of files) copyFileSync(join(sourceRoot, 'node_modules/node-forge/lib', file), join(packageRoot, 'lib', file));
  const rsa = join(packageRoot, 'lib/rsa.js');
  const patched = readFileSync(rsa);
  assert.equal(hash(patched), 'be37cddddcbbbdc59855dc6c025d206c25295803d5f9fc7ce4594c12be02b6ce');
  const original = Buffer.from(patched.toString('utf8').replace('          // validate DigestInfo structure and element count\n          var capture = Object.create(null);', '          // validate DigestInfo structure and element count\n          var capture = {};'));
  assert.equal(hash(original), '6632e195295ce76f6bb9131ee770dcd6cc1ee4ffac7906302208b00faf95a87f');
  writeFileSync(rsa, original);
  assert.throws(() => patchToolingSecurity({ root: f.root, check: true }), code('SECURITY_PATCH_UNAPPLIED'));
  assert.equal(patchToolingSecurity({ root: f.root }).changed, 1);
  assert.equal(hash(readFileSync(rsa)), hash(patched));
  assert.equal(patchToolingSecurity({ root: f.root, check: true }).files, 11);
  const asn1 = join(packageRoot, 'lib/asn1.js');
  writeFileSync(asn1, 'unrecognized upstream source');
  assert.throws(() => patchToolingSecurity({ root: f.root }), code('SECURITY_PATCH_TARGET'));
  assert.equal(hash(readFileSync(rsa)), hash(patched));
});

test('an unexpected nested copy fails the entire preflight without writing any other target', t => {
  const f = fixture(t, true);
  const last = f.targets.at(-1);
  writeFileSync(last.path, 'unexpected source');
  assert.throws(() => patchToolingSecurity({ root: f.root }), code('SECURITY_PATCH_TARGET'));
  for (const file of f.targets.slice(0, -1)) assert.equal(hash(readFileSync(file.path)), file.hash);
});

test('wrong lock version, SRI, registry URL, package version and link records fail closed', async t => {
  for (const mutation of [
    f => { f.lock.lockfileVersion = 2; },
    f => { f.lock.packages['node_modules/braces'].integrity += 'x'; },
    f => { f.lock.packages['node_modules/braces'].resolved = 'https://invalid.example/braces.tgz'; },
    f => { f.lock.packages['node_modules/braces'].version = '3.0.4'; },
    f => { f.lock.packages['node_modules/braces'].link = true; },
  ]) {
    await t.test('identity mismatch', child => {
      const f = fixture(child); mutation(f); f.save();
      assert.throws(() => patchToolingSecurity({ root: f.root }), /SECURITY_PATCH_(LOCK|LOCK_IDENTITY)/);
      for (const file of f.targets) assert.equal(hash(readFileSync(file.path)), file.hash);
    });
  }
});

test('installed identity and payload tampering fail before writes', async t => {
  await t.test('installed package', child => {
    const f = fixture(child);
    writeFileSync(join(f.root, 'node_modules/braces/package.json'), JSON.stringify({ name: 'braces', version: '3.0.4' }));
    assert.throws(() => patchToolingSecurity({ root: f.root }), code('SECURITY_PATCH_PACKAGE_IDENTITY'));
  });
  await t.test('payload', child => {
    const f = fixture(child);
    writeFileSync(join(f.root, profiles[0].files[0].payload), 'unreviewed patch');
    assert.throws(() => patchToolingSecurity({ root: f.root }), code('SECURITY_PATCH_PAYLOAD'));
  });
});

test('junction targets cannot redirect a reviewed package outside its root', t => {
  const f = fixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'tooling-security-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const packageDir = join(f.root, 'node_modules/braces');
  rmSync(packageDir, { recursive: true });
  symlinkSync(outside, packageDir, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => patchToolingSecurity({ root: f.root }), code('SECURITY_PATCH_PATH'));
});

test('official original preimages require application; application is exact and idempotent', t => {
  const f = fixture(t, false, true);
  assert.throws(() => patchToolingSecurity({ root: f.root, check: true }), code('SECURITY_PATCH_UNAPPLIED'));
  assert.equal(patchToolingSecurity({ root: f.root }).changed, 5);
  assert.equal(patchToolingSecurity({ root: f.root, check: true }).status, 'checked');
  assert.equal(patchToolingSecurity({ root: f.root }).changed, 0);
});

test('a commit failure still restores earlier files when temporary cleanup also fails', t => {
  const f = fixture(t, false, true);
  const rename = fs.renameSync; const remove = fs.rmSync;
  let renames = 0; let cleanupFailed = false;
  fs.renameSync = (...args) => {
    if (++renames === 2) throw Object.assign(new Error('injected rename failure'), { code: 'EPERM' });
    return rename(...args);
  };
  fs.rmSync = (path, ...args) => {
    if (!cleanupFailed && String(path).endsWith('.tmp')) {
      cleanupFailed = true; throw Object.assign(new Error('injected cleanup failure'), { code: 'EPERM' });
    }
    return remove(path, ...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(() => patchToolingSecurity({ root: f.root }));
    assert.ok(renames >= 3 && cleanupFailed);
    for (const file of f.targets) assert.equal(hash(readFileSync(file.path)), file.hash);
  } finally {
    fs.renameSync = rename; fs.rmSync = remove; syncBuiltinESMExports();
  }
});
