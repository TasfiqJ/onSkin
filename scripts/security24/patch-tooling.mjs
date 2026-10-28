import { createHash, randomBytes } from 'node:crypto';
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockInventory, strictJson } from '../security22/dependency.mjs';
import { patchToolingSecurity22 } from '../security22/patch-tooling.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = '8872705c5952fcb602532aedaa242232d6b3af0fbe1d5fe6bdb8673fdea91f7c';
const hash = raw => createHash('sha256').update(raw).digest('hex');
function refuse(code) { const error = new Error(code); error.code = code; error.stack = code; throw error; }
function read(root, name, limit = 2 * 1024 * 1024) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9@._/-]+$/.test(name) || isAbsolute(name) || name.split('/').some(p => !p || p === '.' || p === '..' || /[ .]$/.test(p))) refuse('SECURITY24_PATH');
  const absolute = join(root, name), parent = dirname(absolute), rel = relative(root, absolute);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`) || realpathSync(parent) !== parent) refuse('SECURITY24_PATH');
  const info = lstatSync(absolute);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > limit || info.mode & 0o7000) refuse('SECURITY24_FILE');
  const fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    if (opened.dev !== info.dev || opened.ino !== info.ino) refuse('SECURITY24_CHANGED');
    // Read at most the already bounded size plus one sentinel byte, even if a
    // concurrent writer grows the opened file after lstat/fstat.
    const buffer = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, length);
      if (!count) break;
      length += count;
    }
    const raw = buffer.subarray(0, length), after = lstatSync(absolute), final = fstatSync(fd);
    for (const observed of [opened, after, final]) if (!observed.isFile() || observed.isSymbolicLink() || observed.nlink !== 1 || observed.dev !== info.dev || observed.ino !== info.ino || observed.size !== info.size || observed.mtimeMs !== info.mtimeMs || raw.length !== info.size) refuse('SECURITY24_CHANGED');
    return { absolute, parent, raw, mode: info.mode & 0o777 };
  } finally { closeSync(fd); }
}

function transform(raw, path, name) {
  let text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  function once(before, after) {
    if (text.split(before).length !== 2) refuse('SECURITY24_TRANSFORM');
    text = text.replace(before, after);
  }
  if (name === 'deepmerge') {
    const tabs = path === 'dist/umd.js' ? '\t' : '';
    once(tabs + 'function propertyIsOnObject(object, property) {', tabs + "// security24: key names are forbidden regardless of target shape.\n" + tabs + "function forbiddenMergeKey(key) {\n" + tabs + "\treturn key === '__proto__' || key === 'constructor' || key === 'prototype'\n" + tabs + "}\n" + tabs + "function writeMergeValue(object, key, value) {\n" + tabs + "\tObject.defineProperty(object, key, { value: value, writable: true, enumerable: true, configurable: true })\n" + tabs + "}\n\n" + tabs + 'function propertyIsOnObject(object, property) {');
    once('function propertyIsOnObject(object, property) {', "function propertyIsOnObject(object, property) {\n" + tabs + "\tif (object === null || (typeof object !== 'object' && typeof object !== 'function')) return false");
    once(tabs + '\t} catch(_) {\n' + tabs + '\t\treturn false', tabs + '\t} catch(_) {\n' + tabs + '\t\treturn true');
    once('getKeys(target).forEach(function(key) {', "getKeys(target).forEach(function(key) {\n" + tabs + "\t\t\tif (forbiddenMergeKey(key)) return");
    once('getKeys(source).forEach(function(key) {', "getKeys(source).forEach(function(key) {\n" + tabs + "\t\tif (forbiddenMergeKey(key)) return");
    for (const expression of ['cloneUnlessOtherwiseSpecified(target[key], options)', 'getMergeFunction(key, options)(target[key], source[key], options)', 'cloneUnlessOtherwiseSpecified(source[key], options)']) once(`destination[key] = ${expression}`, `writeMergeValue(destination, key, ${expression})`);
  } else if (name === 'zod') {
    const ts = path.endsWith('.ts'), indent = ts ? '      ' : '            ';
    const definition = ts ? 'ch._zod.def as checks.$ZodCheckDef & { maximum?: number; length?: number; size?: number }' : 'ch._zod.def';
    const addition = [
      '// security24: only leading pure size checks may reject before parsing.',
      'if (def.type === "array" || def.type === "set" || def.type === "map") {',
      '    const input = payload.value;',
      '    const n = Array.isArray(input) ? input.length : input instanceof Set || input instanceof Map ? input.size : -1;',
      '    for (const ch of checks) {',
      `        const d = ${definition};`,
      '        if (!["max_length", "min_length", "length_equals", "max_size", "min_size", "size_equals"].includes(d.check)) break;',
      '        const maximum = d.maximum ?? d.length ?? d.size;',
      '        if (typeof maximum === "number" && Number.isFinite(maximum) && maximum >= 0 && n > maximum && ch._zod.def.when?.(payload)) {',
      '            const start = payload.issues.length;',
      ts ? '            ch._zod.check(payload as any);' : '            ch._zod.check(payload);',
      '            if (payload.issues.length > start) {',
      ts ? '                payload.issues[start] = { ...payload.issues[start], continue: false };' : '                payload.issues[start].continue = false;',
      '                return payload;',
      '            }',
      '        }',
      '    }',
      '}',
    ].map(line => indent + line).join('\n') + '\n';
    const anchor = indent + 'const result = inst._zod.parse(payload, ctx);';
    once(anchor, addition + anchor);
  } else refuse('SECURITY24_PACKAGE');
  return Buffer.from(text, 'utf8');
}

function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const fd = openSync(path, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function stage(target, raw) {
  const path = join(target.parent, `.security24-${process.pid}-${randomBytes(12).toString('hex')}.tmp`);
  let fd;
  try {
    fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, target.mode);
    writeFileSync(fd, raw); fsyncSync(fd); closeSync(fd); fd = undefined;
    if (hash(read(target.parent, basename(path)).raw) !== hash(raw)) refuse('SECURITY24_STAGE');
    return path;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    rmSync(path, { force: true }); throw error;
  }
}
function apply({ root = ROOT, check = false } = {}) {
  if (typeof root !== 'string' || !root || typeof check !== 'boolean') refuse('SECURITY24_ARGUMENTS');
  root = resolve(root);
  for (let parent = root; ; parent = dirname(parent)) {
    const info = lstatSync(parent);
    if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(parent) !== parent) refuse('SECURITY24_PATH');
    if (dirname(parent) === parent) break;
  }
  // The original Zod safeguards and complete installation-directory checks run
  // first. Neither this patch nor standalone --check can bypass their refusal.
  patchToolingSecurity22({ root, check: true });
  const manifestBytes = read(root, 'scripts/security24/backports.json').raw;
  if (hash(manifestBytes) !== MANIFEST) refuse('SECURITY24_MANIFEST');
  const manifest = strictJson(manifestBytes);
  const packages = lockInventory(strictJson(read(root, 'package-lock.json', 16 * 1024 * 1024).raw));
  const plan = [];
  for (const profile of manifest.packages) {
    const copies = packages.filter(p => p.kind === 'registry' && p.name === profile.name);
    if (!copies.length) refuse('SECURITY24_PACKAGE');
    for (const copy of copies) {
      if (copy.version !== profile.version || copy.entry.resolved !== profile.resolved || copy.integrity !== profile.integrity) refuse('SECURITY24_PACKAGE');
      for (const [name, expected] of Object.entries(profile.immutableSourcePins)) if (hash(read(root, `${copy.path}/${name}`).raw) !== expected) refuse('SECURITY24_SOURCE');
      for (const file of profile.files) {
        const name = `${copy.path}/${file.path}`, target = read(root, name), observed = hash(target.raw);
        if (observed !== file.originalSHA256 && observed !== file.patchedSHA256) refuse('SECURITY24_SOURCE');
        const raw = observed === file.originalSHA256 ? transform(target.raw, file.path, profile.name) : target.raw;
        if (hash(raw) !== file.patchedSHA256) refuse('SECURITY24_POSTIMAGE');
        plan.push({ name, target, raw, expected: file.patchedSHA256, pending: observed === file.originalSHA256 });
      }
    }
  }
  const pending = plan.filter(item => item.pending);
  if (check) {
    if (pending.length) refuse('SECURITY24_UNAPPLIED');
    return { status: 'checked', files: plan.length, advisoryClearance: false, release: 'NO_GO' };
  }
  const staged = [], committed = [];
  try {
    for (const item of pending) staged.push({ item, path: stage(item.target, item.raw) });
    for (const { item } of staged) if (hash(read(root, item.name).raw) !== hash(item.target.raw)) refuse('SECURITY24_CHANGED');
    for (const { item, path } of staged) {
      if (hash(read(root, item.name).raw) !== hash(item.target.raw)) refuse('SECURITY24_CHANGED');
      renameSync(path, item.target.absolute); committed.push(item); syncDirectory(item.target.parent);
    }
    for (const item of plan) if (hash(read(root, item.name).raw) !== item.expected) refuse('SECURITY24_VERIFY');
  } catch (error) {
    let incomplete = false;
    for (const { path } of staged) try { rmSync(path, { force: true }); } catch { incomplete = true; }
    for (const item of committed.reverse()) try {
      const path = stage(item.target, item.target.raw); renameSync(path, item.target.absolute); syncDirectory(item.target.parent);
      if (hash(read(root, item.name).raw) !== hash(item.target.raw)) incomplete = true;
    } catch { incomplete = true; }
    if (incomplete) refuse('SECURITY24_ROLLBACK');
    throw error;
  }
  return { status: pending.length ? 'patched' : 'already-patched', files: plan.length, changed: pending.length, advisoryClearance: false, release: 'NO_GO' };
}
export function patchToolingSecurity24(options) {
  try { return apply(options); }
  catch (error) {
    const codes = new Set(['SECURITY24_PATH', 'SECURITY24_FILE', 'SECURITY24_CHANGED', 'SECURITY24_TRANSFORM', 'SECURITY24_PACKAGE', 'SECURITY24_STAGE', 'SECURITY24_ARGUMENTS', 'SECURITY24_MANIFEST', 'SECURITY24_SOURCE', 'SECURITY24_POSTIMAGE', 'SECURITY24_UNAPPLIED', 'SECURITY24_VERIFY', 'SECURITY24_ROLLBACK']);
    refuse(codes.has(error?.code) ? error.code : 'SECURITY24_INPUT_OR_IO_INCOMPLETE');
  }
}
export { read as readSecurity24PublicFile };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.length === 1 && args[0] !== '--check') refuse('SECURITY24_ARGUMENTS');
    process.stdout.write(JSON.stringify(patchToolingSecurity24({ check: args[0] === '--check' })) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ status: 'REFUSED', reason: 'SECURITY24_PATCH_INCOMPLETE', advisoryClearance: false, release: 'NO_GO' }) + '\n');
    process.exitCode = 1;
  }
}
