import { createHash, randomBytes } from 'node:crypto';
import { constants, closeSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The generated constant below binds the unchanged published package identities
// and exact local source backports. Version-based audit findings remain open.
const PROFILES = [
  {
    "files": [
      {
        "original": "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310",
        "patched": "fe5bcc00e2aa9afa6e85b3697f10c7cb9eacc38323d3d375247475406bc07176",
        "path": "lib/parse.js",
        "payload": "scripts/phase9/tooling-security-backports/braces-3.0.3/lib/parse.js"
      },
      {
        "original": "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f",
        "patched": "cb2c9b0f9d18879b392bdaca7e026f7b4c1047177806551ea707e9b3f7f16d4f",
        "path": "lib/compile.js",
        "payload": "scripts/phase9/tooling-security-backports/braces-3.0.3/lib/compile.js"
      },
      {
        "original": "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7",
        "patched": "5b35d437861daf886cae53ba00e1e936e3145f2dad065cdf6fb6f26ce192e10b",
        "path": "lib/expand.js",
        "payload": "scripts/phase9/tooling-security-backports/braces-3.0.3/lib/expand.js"
      },
      {
        "original": "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a",
        "patched": "a81e69c3c345c0582c3f65184199543a85cbad70974b03d2dea737e66367857e",
        "path": "lib/stringify.js",
        "payload": "scripts/phase9/tooling-security-backports/braces-3.0.3/lib/stringify.js"
      }
    ],
    "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
    "name": "braces",
    "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
    "version": "3.0.3"
  },
  {
    "files": [
      {
        "original": "fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50",
        "patched": "22ad28b10041635f3d4aa7ba6198b2c4d5cca0307bbcaac8cdc44885a536db5a",
        "path": "lib/rsa.js",
        "payload": "scripts/phase9/tooling-security-backports/node-forge-1.4.0/lib/rsa.js"
      }
    ],
    "integrity": "sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==",
    "name": "node-forge",
    "resolved": "https://registry.npmjs.org/node-forge/-/node-forge-1.4.0.tgz",
    "version": "1.4.0"
  }
];
const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function within(root, value) {
  const rel = relative(root, value);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}
function parent(root, name) {
  if (typeof name !== 'string' || isAbsolute(name) || name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..')) fail('SECURITY_PATCH_PATH');
  const parts = name.split('/'); const leaf = parts.pop(); let current = root;
  for (const part of parts) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('SECURITY_PATCH_PATH');
  }
  if (!within(root, realpathSync(current))) fail('SECURITY_PATCH_PATH');
  return { parent: current, absolute: join(current, leaf), leaf };
}
function read(root, name, limit = 256 * 1024) {
  const path = parent(root, name); const before = lstatSync(path.absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size <= 0 || before.size > limit) fail('SECURITY_PATCH_FILE');
  const bytes = readFileSync(path.absolute); const after = lstatSync(path.absolute);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) fail('SECURITY_PATCH_RACE');
  return { ...path, bytes, mode: before.mode & 0o777 };
}
function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const fd = openSync(path, constants.O_RDONLY); try { fsyncSync(fd); } finally { closeSync(fd); }
}
function stage(root, item, bytes) {
  const path = parent(root, item.name);
  const temporary = join(path.parent, `.${path.leaf}.security-${process.pid}-${randomBytes(8).toString('hex')}.tmp`);
  let fd;
  try {
    fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, item.target.mode);
    writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
    if (hash(readFileSync(temporary)) !== hash(bytes)) fail('SECURITY_PATCH_STAGE');
    return temporary;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    rmSync(temporary, { force: true }); throw error;
  }
}

export function patchToolingSecurity({ root = SCRIPT_ROOT, check = false } = {}) {
  if (typeof root !== 'string' || !root) fail('SECURITY_PATCH_ROOT');
  root = resolve(root); const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || realpathSync(root) !== root) fail('SECURITY_PATCH_ROOT');
  const lock = JSON.parse(read(root, 'package-lock.json', 32 * 1024 * 1024).bytes);
  if (lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object') fail('SECURITY_PATCH_LOCK');
  const plan = [];
  for (const profile of PROFILES) {
    const paths = Object.keys(lock.packages).filter(path => path === `node_modules/${profile.name}` || path.endsWith(`/node_modules/${profile.name}`));
    if (!paths.length) fail('SECURITY_PATCH_PACKAGE_MISSING');
    for (const path of paths) {
      const entry = lock.packages[path];
      if (entry.version !== profile.version || entry.resolved !== profile.resolved || entry.integrity !== profile.integrity || entry.link) fail('SECURITY_PATCH_LOCK_IDENTITY');
      const pkg = JSON.parse(read(root, `${path}/package.json`, 1024 * 1024).bytes);
      if (pkg.name !== profile.name || pkg.version !== profile.version) fail('SECURITY_PATCH_PACKAGE_IDENTITY');
      for (const file of profile.files) {
        const payload = read(root, file.payload);
        if (hash(payload.bytes) !== file.patched) fail('SECURITY_PATCH_PAYLOAD');
        const name = `${path}/${file.path}`; const target = read(root, name); const observed = hash(target.bytes);
        if (observed !== file.original && observed !== file.patched) fail('SECURITY_PATCH_TARGET');
        plan.push({ name, target, payload, expected: file.patched, original: observed === file.original });
      }
    }
  }
  const pending = plan.filter(item => item.original);
  if (check) {
    if (pending.length) fail('SECURITY_PATCH_UNAPPLIED');
    return { status: 'checked', files: plan.length, versionsChanged: false, auditClearance: false };
  }
  const staged = []; const committed = [];
  try {
    for (const item of pending) staged.push({ item, temporary: stage(root, item, item.payload.bytes) });
    for (const { item } of staged) {
      if (hash(read(root, item.name).bytes) !== hash(item.target.bytes)) fail('SECURITY_PATCH_RACE');
    }
    for (const { item, temporary } of staged) {
      parent(root, item.name); renameSync(temporary, item.target.absolute); committed.push(item); syncDirectory(item.target.parent);
    }
    for (const item of plan) if (hash(read(root, item.name).bytes) !== item.expected) fail('SECURITY_PATCH_VERIFY');
  } catch (error) {
    const failures = [error];
    for (const { temporary } of staged) {
      try { rmSync(temporary, { force: true }); }
      catch (cleanup) { failures.push(cleanup); }
    }
    for (const item of committed.reverse()) {
      try {
        const temporary = stage(root, item, item.target.bytes); renameSync(temporary, item.target.absolute); syncDirectory(item.target.parent);
        if (hash(read(root, item.name).bytes) !== hash(item.target.bytes)) fail('SECURITY_PATCH_RESTORE');
      } catch (rollback) { failures.push(rollback); }
    }
    if (failures.length > 1) throw new AggregateError(failures, 'SECURITY_PATCH_ROLLBACK_FAILED');
    throw error;
  }
  return { status: pending.length ? 'patched' : 'already-patched', files: plan.length, changed: pending.length, versionsChanged: false, auditClearance: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== '--check')) fail('SECURITY_PATCH_ARGUMENTS');
    console.log(JSON.stringify(patchToolingSecurity({ check: args[0] === '--check' })));
  } catch (error) { console.error(error.code ?? error.message); process.exitCode = 1; }
}
