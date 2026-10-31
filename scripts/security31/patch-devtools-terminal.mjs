import { createHash, randomBytes } from 'node:crypto';
import { closeSync, constants, fsyncSync, lstatSync, openSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockInventory, strictJson } from '../security22/dependency.mjs';
import { readSecurity24PublicFile as read } from '../security24/patch-tooling.mjs';

export const PREIMAGE = 'f4ee6307896aee35bcac074f7305bfd56fa593c7501ad547f3b5169af1f31236';
export const POSTIMAGE = '89dc50f0e8fdfe229c73eb529db6fb93f6b336c0af10433713d3249e6182dbf3';
export const EXECUTOR = 'build/src/start/server/DevToolsPluginCliExtensionExecutor.js';
const ROOT = resolve(import.meta.dirname, '../..');
const SRI = 'sha512-3p1qL/pvWblGNwDE1bt2wh/NUiGpSer61s5GKKFfpEpBkZTYnqve0pdK1UvEFzJGT6PW9vX2RofQQ2LP6MgvDQ==';
const PACKAGE_HASH = '62186cebf9699c0f2bd8ddccdcf863c5e8aba6a2f177696200112edc88b52f67';
const hash = raw => createHash('sha256').update(raw).digest('hex');
function refuse(code) { const error = new Error(code); error.code = code; throw error; }
function transform(raw) {
  let text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  for (const stream of ['stdout', 'stderr']) {
    const before = `child.${stream}.on('data', (data)=>{`;
    if (text.split(before).length !== 2) refuse('SECURITY31_TRANSFORM');
    text = text.replace(before, before + '\n                    if (finished) return;');
  }
  const result = Buffer.from(text);
  if (hash(result) !== POSTIMAGE) refuse('SECURITY31_POSTIMAGE');
  return result;
}
function stage(target, raw) {
  const path = join(target.parent, `.security31-${process.pid}-${randomBytes(12).toString('hex')}.tmp`);
  let fd;
  try {
    fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, target.mode);
    writeFileSync(fd, raw); fsyncSync(fd); closeSync(fd); fd = undefined;
    if (hash(read(target.parent, basename(path)).raw) !== hash(raw)) refuse('SECURITY31_STAGE');
    return path;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    rmSync(path, { force: true }); throw error;
  }
}
function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const fd = openSync(path, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function apply({ root = ROOT, check = false } = {}) {
  if (typeof root !== 'string' || !root || typeof check !== 'boolean') refuse('SECURITY31_ARGUMENTS');
  root = resolve(root);
  for (let parent = root; ; parent = dirname(parent)) {
    const info = lstatSync(parent);
    if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(parent) !== parent) refuse('SECURITY31_PATH');
    if (dirname(parent) === parent) break;
  }
  const copies = lockInventory(strictJson(read(root, 'package-lock.json', 16 * 1024 * 1024).raw))
    .filter(p => p.kind === 'registry' && p.name === '@expo/cli');
  if (!copies.length) refuse('SECURITY31_PACKAGE');
  const plan = copies.map(copy => {
    if (copy.version !== '57.0.32' || copy.entry.resolved !== 'https://registry.npmjs.org/@expo/cli/-/cli-57.0.32.tgz' || copy.integrity !== SRI) refuse('SECURITY31_PACKAGE');
    if (hash(read(root, `${copy.path}/package.json`).raw) !== PACKAGE_HASH) refuse('SECURITY31_PACKAGE');
    const name = `${copy.path}/${EXECUTOR}`, target = read(root, name), observed = hash(target.raw);
    if (observed !== PREIMAGE && observed !== POSTIMAGE) refuse('SECURITY31_SOURCE');
    return { name, target, raw: observed === PREIMAGE ? transform(target.raw) : target.raw, pending: observed === PREIMAGE };
  });
  const pending = plan.filter(item => item.pending);
  if (check) {
    if (pending.length) refuse('SECURITY31_UNAPPLIED');
    return { status: 'checked', files: plan.length, advisoryClearance: false, release: 'NO_GO' };
  }
  const staged = [], committed = [];
  try {
    for (const item of pending) staged.push({ item, path: stage(item.target, item.raw) });
    for (const { item, path } of staged) {
      if (hash(read(root, item.name).raw) !== hash(item.target.raw)) refuse('SECURITY31_CHANGED');
      renameSync(path, item.target.absolute); committed.push(item); syncDirectory(item.target.parent);
    }
    for (const item of plan) if (hash(read(root, item.name).raw) !== POSTIMAGE) refuse('SECURITY31_VERIFY');
  } catch (error) {
    let incomplete = false;
    for (const { path } of staged) try { rmSync(path, { force: true }); } catch { incomplete = true; }
    for (const item of committed.reverse()) try {
      const path = stage(item.target, item.target.raw); renameSync(path, item.target.absolute); syncDirectory(item.target.parent);
      if (hash(read(root, item.name).raw) !== hash(item.target.raw)) incomplete = true;
    } catch { incomplete = true; }
    if (incomplete) refuse('SECURITY31_ROLLBACK');
    throw error;
  }
  return { status: pending.length ? 'patched' : 'already-patched', files: plan.length, changed: pending.length, advisoryClearance: false, release: 'NO_GO' };
}
export function patchDevToolsTerminal(options) {
  try { return apply(options); }
  catch (error) {
    const codes = new Set(['SECURITY31_ARGUMENTS', 'SECURITY31_PATH', 'SECURITY31_PACKAGE', 'SECURITY31_SOURCE', 'SECURITY31_TRANSFORM', 'SECURITY31_POSTIMAGE', 'SECURITY31_STAGE', 'SECURITY31_UNAPPLIED', 'SECURITY31_CHANGED', 'SECURITY31_VERIFY', 'SECURITY31_ROLLBACK']);
    refuse(codes.has(error?.code) ? error.code : 'SECURITY31_INPUT_OR_IO_INCOMPLETE');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.length === 1 && args[0] !== '--check') refuse('SECURITY31_ARGUMENTS');
    console.log(JSON.stringify(patchDevToolsTerminal({ check: args[0] === '--check' })));
  } catch {
    console.log(JSON.stringify({ status: 'REFUSED', reason: 'SECURITY31_PATCH_INCOMPLETE', advisoryClearance: false, release: 'NO_GO' }));
    process.exitCode = 1;
  }
}
