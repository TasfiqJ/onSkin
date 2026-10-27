import { createHash, randomBytes } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedToolCache, lockInventory, strictJson } from './dependency.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = '8d1a0492c716c76ed2c8121cc3c74054c5ee3422d9989580c953c2ffb7618df8';
const hash = raw => createHash('sha256').update(raw).digest('hex');
const fail = code => { const error = new Error(code); error.code = code; error.stack = code; throw error; };
function read(root, name, limit = 1024 * 1024) {
  if (typeof name !== 'string' || isAbsolute(name) || name.includes('\\') || name.includes(':') || name.split('/').some(p => !p || p === '.' || p === '..' || /[ .]$/.test(p))) fail('SECURITY22_PATCH_PATH');
  const absolute = join(root, name); const parent = dirname(absolute);
  const rel = relative(root, absolute);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`) || realpathSync(parent) !== parent) fail('SECURITY22_PATCH_PATH');
  const before = lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > limit) fail('SECURITY22_PATCH_FILE');
  const fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino) fail('SECURITY22_PATCH_CHANGED');
    const raw = readFileSync(fd); const after = lstatSync(absolute); const final = fstatSync(fd);
    for (const info of [after, final]) if (!info.isFile() || info.isSymbolicLink() || before.dev !== info.dev || before.ino !== info.ino || before.size !== info.size || before.mtimeMs !== info.mtimeMs || raw.length !== info.size) fail('SECURITY22_PATCH_CHANGED');
    return { absolute, parent, raw, mode: before.mode & 0o777 };
  } finally { closeSync(fd); }
}

function transform(raw, path) {
  let text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const indent = path.endsWith('.ts') ? '    ' : '        ';
  const invalid = path.endsWith('.cjs') ? 'parseUtil_js_1.INVALID' : 'INVALID';
  function insert(marker, end, anchor, addition) {
    const first = text.indexOf(marker); const last = text.indexOf(end, first);
    if (first < 0 || last < first || text.indexOf(marker, first + marker.length) !== -1) fail('SECURITY22_PATCH_TRANSFORM');
    const part = text.slice(first, last);
    if (part.split(anchor).length !== 2) fail('SECURITY22_PATCH_TRANSFORM');
    text = text.slice(0, first) + part.replace(anchor, addition + anchor) + text.slice(last);
  }
  // Existing size issues, messages/error maps and paths are constructed before
  // the abort. Only the subsequent unsafe element walk/refinement is stopped.
  insert('class ZodArray', 'function deepPartialify', indent + 'if (ctx.common.async) {',
    indent + '// security22: enforce declared upper bounds before walking elements.\n' +
    indent + 'if ((def.exactLength !== null && ctx.data.length > def.exactLength.value) ||\n' +
    indent + '    (def.maxLength !== null && ctx.data.length > def.maxLength.value)) {\n' +
    indent + '    return ' + invalid + ';\n' + indent + '}\n');
  insert('class ZodSet', 'class ZodFunction', indent + 'const valueType = this._def.valueType;',
    indent + '// security22: preserve the size issue and avoid walking oversized sets.\n' +
    indent + 'if (def.maxSize !== null && ctx.data.size > def.maxSize.value) {\n' +
    indent + '    return ' + invalid + ';\n' + indent + '}\n');
  return Buffer.from(text, 'utf8');
}

function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const fd = openSync(path, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function stage(target, raw) {
  const path = join(target.parent, `.security22-${process.pid}-${randomBytes(12).toString('hex')}.tmp`);
  let fd;
  try {
    fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, target.mode);
    writeFileSync(fd, raw); fsyncSync(fd); closeSync(fd); fd = undefined;
    if (hash(readFileSync(path)) !== hash(raw)) fail('SECURITY22_PATCH_STAGE');
    return path;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    rmSync(path, { force: true }); throw error;
  }
}

function applyPatch({ root = ROOT, check = false } = {}) {
  if (typeof root !== 'string' || !root || typeof check !== 'boolean') fail('SECURITY22_PATCH_ARGUMENTS');
  root = resolve(root);
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink() || realpathSync(root) !== root) fail('SECURITY22_PATCH_ROOT');
  const rawManifest = read(root, 'scripts/security22/backports.json').raw;
  if (hash(rawManifest) !== MANIFEST) fail('SECURITY22_PATCH_MANIFEST');
  const manifest = strictJson(rawManifest);
  if (manifest.treatment !== 'NON_ADMITTING_TECHNICAL_PROPOSAL' || manifest.versionFindingUnresolved !== true) fail('SECURITY22_PATCH_NO_ADMISSION');
  const packages = lockInventory(strictJson(read(root, 'package-lock.json', 16 * 1024 * 1024).raw));
  const declared = new Set(packages.map(p => p.path));
  const cacheBudget = { files: 0, bytes: 0 };
  // Every standard nested installation is accounted independently. An omitted
  // copy cannot hide behind a clean top-level zod installation.
  for (const owner of packages.filter(p => p.kind !== 'workspace-link')) {
    const name = owner.path ? `${owner.path}/node_modules` : 'node_modules';
    const directory = resolve(root, name);
    try { lstatSync(directory); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (realpathSync(directory) !== directory || !lstatSync(directory).isDirectory()) fail('SECURITY22_PATCH_INSTALLED_PATH');
    for (const child of readdirSync(directory)) {
      if (child === '.vite' || child === '.vite-temp') { generatedToolCache(root, name, child, cacheBudget); continue; }
      if (child === '.bin' || child === '.package-lock.json') continue;
      if (child.startsWith('@')) {
        const scope = join(directory, child);
        if (realpathSync(scope) !== scope || !lstatSync(scope).isDirectory()) fail('SECURITY22_PATCH_INSTALLED_PATH');
        for (const leaf of readdirSync(scope)) if (!declared.has(`${name}/${child}/${leaf}`)) fail('SECURITY22_PATCH_UNDECLARED_COPY');
      } else if (!declared.has(`${name}/${child}`)) fail('SECURITY22_PATCH_UNDECLARED_COPY');
    }
  }
  const copies = packages.filter(p => p.kind === 'registry' && p.name === manifest.package.name);
  if (!copies.length) fail('SECURITY22_PATCH_PACKAGE_MISSING');
  const plan = [];
  for (const copy of copies) {
    if (copy.version !== manifest.package.version || copy.entry.resolved !== manifest.package.resolved || copy.integrity !== manifest.package.integrity || copy.entry.link) fail('SECURITY22_PATCH_PACKAGE_IDENTITY');
    for (const [name, expected] of Object.entries(manifest.immutableSourcePins)) if (hash(read(root, `${copy.path}/${name}`).raw) !== expected) fail('SECURITY22_PATCH_UNKNOWN_SOURCE');
    const identity = strictJson(read(root, `${copy.path}/package.json`).raw);
    if (identity.name !== manifest.package.name || identity.version !== manifest.package.version) fail('SECURITY22_PATCH_PACKAGE_IDENTITY');
    for (const file of manifest.files) {
      const name = `${copy.path}/${file.path}`; const target = read(root, name); const observed = hash(target.raw);
      if (observed !== file.originalSHA256 && observed !== file.patchedSHA256) fail('SECURITY22_PATCH_UNKNOWN_SOURCE');
      const raw = observed === file.originalSHA256 ? transform(target.raw, file.path) : target.raw;
      if (hash(raw) !== file.patchedSHA256) fail('SECURITY22_PATCH_POSTIMAGE');
      plan.push({ name, target, raw, expected: file.patchedSHA256, pending: observed === file.originalSHA256 });
    }
  }
  const pending = plan.filter(item => item.pending);
  if (check) {
    if (pending.length) fail('SECURITY22_PATCH_UNAPPLIED');
    return { status: 'checked', files: plan.length, advisoryClearance: false, treatment: 'NON_ADMITTING_TECHNICAL_PROPOSAL' };
  }
  const staged = []; const committed = [];
  try {
    for (const item of pending) staged.push({ item, path: stage(item.target, item.raw) });
    for (const { item } of staged) if (hash(read(root, item.name).raw) !== hash(item.target.raw)) fail('SECURITY22_PATCH_CHANGED');
    for (const { item, path } of staged) {
      read(root, item.name); renameSync(path, item.target.absolute); committed.push(item); syncDirectory(item.target.parent);
    }
    for (const item of plan) if (hash(read(root, item.name).raw) !== item.expected) fail('SECURITY22_PATCH_VERIFY');
  } catch (error) {
    let restoreFailed = false;
    for (const { path } of staged) { try { rmSync(path, { force: true }); } catch { restoreFailed = true; } }
    for (const item of committed.reverse()) {
      try {
        const path = stage(item.target, item.target.raw); renameSync(path, item.target.absolute); syncDirectory(item.target.parent);
        if (hash(read(root, item.name).raw) !== hash(item.target.raw)) restoreFailed = true;
      } catch { restoreFailed = true; }
    }
    if (restoreFailed) fail('SECURITY22_PATCH_ROLLBACK_INCOMPLETE');
    throw error;
  }
  return { status: pending.length ? 'patched' : 'already-patched', files: plan.length, changed: pending.length, advisoryClearance: false, treatment: 'NON_ADMITTING_TECHNICAL_PROPOSAL' };
}

export function patchToolingSecurity22(options) {
  try { return applyPatch(options); }
  catch (error) {
    const codes = new Set(['SECURITY22_PATCH_PATH', 'SECURITY22_PATCH_FILE', 'SECURITY22_PATCH_CHANGED',
      'SECURITY22_PATCH_TRANSFORM', 'SECURITY22_PATCH_STAGE', 'SECURITY22_PATCH_ARGUMENTS', 'SECURITY22_PATCH_ROOT',
      'SECURITY22_PATCH_MANIFEST', 'SECURITY22_PATCH_NO_ADMISSION', 'SECURITY22_PATCH_INSTALLED_PATH',
      'SECURITY22_PATCH_UNDECLARED_COPY', 'SECURITY22_PATCH_PACKAGE_MISSING', 'SECURITY22_PATCH_PACKAGE_IDENTITY',
      'SECURITY22_PATCH_UNKNOWN_SOURCE', 'SECURITY22_PATCH_POSTIMAGE', 'SECURITY22_PATCH_UNAPPLIED',
      'SECURITY22_PATCH_VERIFY', 'SECURITY22_PATCH_ROLLBACK_INCOMPLETE']);
    fail(codes.has(error?.code) ? error.code : 'SECURITY22_PATCH_INPUT_OR_IO_INCOMPLETE');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.length === 1 && args[0] !== '--check') fail('SECURITY22_PATCH_ARGUMENTS');
    process.stdout.write(JSON.stringify(patchToolingSecurity22({ check: args[0] === '--check' })) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ status: 'REFUSED', reason: 'SECURITY22_PATCH_INCOMPLETE', advisoryClearance: false }) + '\n');
    process.exitCode = 1;
  }
}
