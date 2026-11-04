import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockInventory, strictJson } from '../../security22/dependency.mjs';
import { readSecurity24PublicFile as read } from '../../security24/patch-tooling.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const SRI = 'sha512-3p1qL/pvWblGNwDE1bt2wh/NUiGpSer61s5GKKFfpEpBkZTYnqve0pdK1UvEFzJGT6PW9vX2RofQQ2LP6MgvDQ==';
const PACKAGE_HASH = '62186cebf9699c0f2bd8ddccdcf863c5e8aba6a2f177696200112edc88b52f67';
export const COLLECTION_LIMIT46 = 1024;
export const OUTPUT_BUDGET46 = 1024 * 1024;
export const EXPO_BOUNDS_FILES46 = [
  { path: 'build/src/start/server/DevToolsPlugin.schema.js', before: '4da5edad8daa6eda49fecc646934d372008952004b2c19abc03e27bcffc904a5', after: '51fe90ef5a41227d330f047326a646172e787693edf27f5c3e0ad6d0f956c28b' },
  { path: 'build/src/start/server/DevToolsPluginCliExtensionResults.js', before: 'ab531966e34f5009d65fab4a00204cc999580d21b921f58ef58e00c568801c02', after: '17d132616071ed41057ffdba8444f3f932b916b4ac5198d602ff3f924954a230' },
];
function refuse(code) { throw Object.assign(new Error(code), { code }); }
function transform(raw, path) {
  let text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const once = (before, after) => {
    if (text.split(before).length !== 2) refuse('C46_BOUNDS_TRANSFORM');
    text = text.replace(before, after);
  };
  if (path.endsWith('DevToolsPlugin.schema.js')) {
    once('const DevToolsPluginOutputSchema = _zod().z.array(DevToolsPluginOutputLinesSchema);',
      'const DevToolsPluginOutputSchema = _zod().z.array(DevToolsPluginOutputLinesSchema).max(1024);');
  } else {
    once('const MAX_OUTPUT_LENGTH = _nodebuffer().constants.MAX_STRING_LENGTH;',
      'const MAX_OUTPUT_LENGTH = Math.min(_nodebuffer().constants.MAX_STRING_LENGTH, 1024 * 1024);\nconst MAX_OUTPUT_LINES = 1024;');
    const start = text.indexOf("    append(output, level = 'info') {");
    const end = text.indexOf('    isTruncated() {', start);
    if (start < 0 || end < start) refuse('C46_BOUNDS_TRANSFORM');
    text = text.slice(0, start) + [
      "    append(output, level = 'info') {",
      '        if (this._truncated) return;',
      "        const bytes = _nodebuffer().Buffer.byteLength(output, 'utf8');",
      '        if (this._totalLength + bytes > MAX_OUTPUT_LENGTH) {',
      "            this.truncate('Output truncated: plugin exceeded the ' + MAX_OUTPUT_LENGTH + '-byte output budget. Reduce output, paginate, or write to a file.');",
      '            return;',
      '        }',
      '        this._totalLength += bytes;',
      '        const results = this.parseOutputText(output, level);',
      '        if (this._truncated) return;',
      '        if (this._output.length + results.length > MAX_OUTPUT_LINES) {',
      "            this.truncate('Output truncated: plugin exceeded ' + MAX_OUTPUT_LINES + ' output records. Reduce output, paginate, or write to a file.');",
      '            return;',
      '        }',
      '        this._output.push(...results);',
      '        this.onOutput == null ? void 0 : this.onOutput.call(this, results);',
      '    }',
      '    truncate(text) {',
      '        this._truncated = true;',
      "        const message = { type: 'text', text, level: 'error' };",
      '        this._output.splice(MAX_OUTPUT_LINES - 1);',
      '        this._output.push(message);',
      '        this.onOutput == null ? void 0 : this.onOutput.call(this, [message]);',
      '    }',
      '',
    ].join('\n') + text.slice(end);
    once("            const lines = txt.split('\\n');",
      "            const lines = txt.split('\\n', MAX_OUTPUT_LINES + 1);\n" +
      '            if (lines.length > MAX_OUTPUT_LINES) {\n' +
      "                this.truncate('Output truncated: plugin exceeded ' + MAX_OUTPUT_LINES + ' output records. Reduce output, paginate, or write to a file.');\n" +
      '                return [];\n' +
      '            }');
  }
  return Buffer.from(text);
}
function syncDirectory(path) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(path, fs.constants.O_RDONLY);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function stage(target, raw) {
  const path = join(target.parent, '.c46-bounds-' + process.pid + '-' + randomBytes(12).toString('hex') + '.tmp');
  let fd;
  try {
    fd = fs.openSync(path, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, target.mode);
    fs.writeFileSync(fd, raw); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    if (hash(read(target.parent, basename(path)).raw) !== hash(raw)) refuse('C46_BOUNDS_STAGE');
    return path;
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(path, { force: true }); throw error;
  }
}
export function patchExpoCollectionBounds46({ root = ROOT, check = false } = {}) {
  if (typeof root !== 'string' || !root || typeof check !== 'boolean') refuse('C46_BOUNDS_ARGUMENTS');
  root = resolve(root);
  for (let parent = root; ; parent = dirname(parent)) {
    const info = fs.lstatSync(parent);
    if (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync(parent) !== parent) refuse('C46_BOUNDS_PATH');
    if (dirname(parent) === parent) break;
  }
  const packages = lockInventory(strictJson(read(root, 'package-lock.json', 16 * 1024 * 1024).raw));
  const copies = packages.filter(p => p.kind === 'registry' && p.name === '@expo/cli');
  if (!copies.length) refuse('C46_BOUNDS_PACKAGE');
  const plan = copies.flatMap(copy => {
    if (copy.version !== '57.0.32' || copy.entry.resolved !== 'https://registry.npmjs.org/@expo/cli/-/cli-57.0.32.tgz' || copy.integrity !== SRI ||
        hash(read(root, copy.path + '/package.json').raw) !== PACKAGE_HASH) refuse('C46_BOUNDS_PACKAGE');
    return EXPO_BOUNDS_FILES46.map(profile => {
      const name = copy.path + '/' + profile.path, target = read(root, name), current = hash(target.raw);
      if (current !== profile.before && current !== profile.after) refuse('C46_BOUNDS_SOURCE');
      const raw = current === profile.before ? transform(target.raw, profile.path) : target.raw;
      if (hash(raw) !== profile.after) refuse('C46_BOUNDS_POSTIMAGE');
      return { name, target, raw, pending: current === profile.before };
    });
  });
  const pending = plan.filter(item => item.pending);
  if (check) {
    if (pending.length) refuse('C46_BOUNDS_UNAPPLIED');
    return { status: 'checked', files: plan.length, upstreamAdvisoryCleared: false, acceptanceGranted: false };
  }
  const staged = [], committed = [];
  try {
    for (const item of pending) staged.push({ item, path: stage(item.target, item.raw) });
    for (const { item, path } of staged) {
      if (hash(read(root, item.name).raw) !== hash(item.target.raw)) refuse('C46_BOUNDS_CHANGED');
      fs.renameSync(path, item.target.absolute); committed.push(item); syncDirectory(item.target.parent);
    }
    for (const item of plan) if (hash(read(root, item.name).raw) !== hash(item.raw)) refuse('C46_BOUNDS_VERIFY');
  } catch (error) {
    let incomplete = false;
    for (const { path } of staged) try { fs.rmSync(path, { force: true }); } catch { incomplete = true; }
    for (const item of committed.reverse()) try {
      const path = stage(item.target, item.target.raw);
      fs.renameSync(path, item.target.absolute); syncDirectory(item.target.parent);
      if (hash(read(root, item.name).raw) !== hash(item.target.raw)) incomplete = true;
    } catch { incomplete = true; }
    if (incomplete) refuse('C46_BOUNDS_ROLLBACK');
    throw error;
  }
  return { status: pending.length ? 'patched' : 'already-patched', files: plan.length, changed: pending.length, upstreamAdvisoryCleared: false, acceptanceGranted: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && args[0] !== '--check') refuse('C46_BOUNDS_ARGUMENTS');
  console.log(JSON.stringify(patchExpoCollectionBounds46({ check: args[0] === '--check' })));
}

