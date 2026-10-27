import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalogEvidenceJson } from '../phase4/source-policy.mjs';

// Public dependency metadata only. No raw stdout, errors, descriptions, URLs,
// finding snippets or secret-derived fingerprints enter the returned object.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ADVISORY = /^(?:GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}|CVE-\d{4}-\d{4,}|(?:PYSEC|GO|RUSTSEC|OSV)-[0-9A-Za-z-]+)$/;
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];
const MAX_OUTPUT = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const require = (ok, code) => { if (!ok) throw new Error(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;

export function strictJson(bytes) {
  try {
    const result = parseCatalogEvidenceJson(bytes, 'DEPENDENCY_JSON', { maxBytes: MAX_OUTPUT });
    function finite(value) {
      if (typeof value === 'number') require(Number.isFinite(value), 'DEPENDENCY_JSON_INVALID');
      else if (value && typeof value === 'object') for (const child of Object.values(value)) finite(child);
    }
    finite(result); return result;
  }
  catch { throw new Error('DEPENDENCY_JSON_INVALID'); }
}

function contained(root, path) {
  const rel = relative(root, path);
  require(!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`), 'DEPENDENCY_PATH');
}

function regular(path, limit = MAX_OUTPUT) {
  require(realpathSync(dirname(path)) === dirname(path), 'DEPENDENCY_INSTALLED_LINK');
  const before = lstatSync(path);
  require(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= limit, 'DEPENDENCY_FILE');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    require(opened.dev === before.dev && opened.ino === before.ino, 'DEPENDENCY_CHANGED');
    const bytes = readFileSync(fd);
    const after = fstatSync(fd);
    require(after.dev === before.dev && after.ino === before.ino && after.size === bytes.length && after.size === before.size && after.mtimeMs === before.mtimeMs, 'DEPENDENCY_CHANGED');
    return bytes;
  } finally { closeSync(fd); }
}

function safePath(value) {
  require(typeof value === 'string' && value.length <= 512 && /^[A-Za-z0-9@._/-]+$/.test(value) && !value.startsWith('/') && value.split('/').every(p => p && p !== '.' && p !== '..' && !/[ .]$/.test(p)), 'DEPENDENCY_PATH');
  return value;
}

export function lockInventory(lock) {
  require(object(lock) && lock.lockfileVersion === 3 && object(lock.packages), 'DEPENDENCY_LOCK_SCHEMA');
  const packages = [];
  const names = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    require(object(entry), 'DEPENDENCY_LOCK_SCHEMA');
    if (path) {
      safePath(path);
      const parts = path.split('/');
      for (let count = 1; count <= parts.length; count++) {
        const parent = parts.slice(0, count).join('/');
        const key = parent.normalize('NFKC').toLowerCase();
        require(!names.has(key) || names.get(key) === parent, 'DEPENDENCY_PATH_ALIAS');
        names.set(key, parent);
      }
    }
    if (entry.link === true) {
      safePath(entry.resolved);
      require(object(lock.packages[entry.resolved]) && !lock.packages[entry.resolved].link && !entry.version, 'DEPENDENCY_WORKSPACE');
      packages.push({ path, kind: 'workspace-link', target: entry.resolved });
    } else if (path.includes('node_modules/')) {
      const name = path.slice(path.lastIndexOf('node_modules/') + 13);
      require(PACKAGE.test(name) && VERSION.test(entry.version), 'DEPENDENCY_COORDINATE');
      require(entry.resolved === `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${entry.version}.tgz` && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity), 'DEPENDENCY_REGISTRY_IDENTITY');
      packages.push({ path, kind: 'registry', name, version: entry.version, integrity: entry.integrity, entry });
    } else {
      require(typeof entry.name === 'string' && PACKAGE.test(entry.name) && VERSION.test(entry.version), 'DEPENDENCY_WORKSPACE');
      packages.push({ path, kind: 'workspace', name: entry.name, version: entry.version });
    }
  }
  require(packages.length > 1 && packages.length <= 10000 && packages.filter(p => p.path === '').length === 1, 'DEPENDENCY_LOCK_SCHEMA');
  return packages.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

function supports(values, current) {
  if (values === undefined) return true;
  require(Array.isArray(values) && values.length > 0 && values.every(v => typeof v === 'string' && /^!?[a-z0-9_-]+$/.test(v)), 'DEPENDENCY_PLATFORM_SCHEMA');
  return !values.includes(`!${current}`) && (!values.some(v => !v.startsWith('!')) || values.includes(current));
}

function sourceDigest(root, budget) {
  const digest = createHash('sha256');
  let files = 0; let bytes = 0;
  function walk(path, prefix, depth) {
    require(depth <= 64 && realpathSync(path) === path, 'DEPENDENCY_INSTALLED_LINK');
    const aliases = new Set();
    for (const name of readdirSync(path).sort()) {
      // Each nested node_modules installation is enumerated separately by lockInventory.
      if (name === 'node_modules') continue;
      require(/^[\x20-\x7E]+$/.test(name) && name !== '.' && name !== '..' && !name.includes('\\') && !name.includes(':') && !/[ .]$/.test(name) && !aliases.has(name.toLowerCase()), 'DEPENDENCY_INSTALLED_PATH');
      aliases.add(name.toLowerCase());
      const child = join(path, name); const stat = lstatSync(child);
      require(!stat.isSymbolicLink(), 'DEPENDENCY_INSTALLED_LINK');
      const rel = prefix ? `${prefix}/${name}` : name;
      if (stat.isDirectory()) walk(child, rel, depth + 1);
      else {
        const data = regular(child, 256 * 1024 * 1024);
        files++; bytes += data.length; budget.files++; budget.bytes += data.length;
        require(budget.files <= 250000 && budget.bytes <= 3 * 1024 * 1024 * 1024, 'DEPENDENCY_INSTALLED_BOUND');
        digest.update(JSON.stringify([rel, stat.mode & 0o777, data.length, hash(data)]) + '\n');
      }
    }
  }
  walk(root, '', 0);
  return { files, bytes, sourceSHA256: digest.digest('hex') };
}

export function installedInventory(root, packages) {
  const budget = { files: 0, bytes: 0 };
  const records = []; const errors = [];
  const declared = new Set(packages.map(p => p.path));
  const generated = [];
  // Inventory module directories independently; an extra nested installation
  // cannot disappear behind sourceDigest's separately-accounted node_modules.
  for (const owner of packages.filter(p => p.kind !== 'workspace-link')) {
    const modulePath = owner.path ? `${owner.path}/node_modules` : 'node_modules';
    const directory = resolve(root, modulePath);
    try {
      let present = true;
      try { lstatSync(directory); } catch (error) { require(error.code === 'ENOENT', 'DEPENDENCY_INSTALLED_ACCESS'); present = false; }
      if (!present) continue;
      require(realpathSync(directory) === directory, 'DEPENDENCY_INSTALLED_LINK');
      for (const name of readdirSync(directory)) {
        if (name === '.package-lock.json') {
          const raw = regular(join(directory, name)); strictJson(raw);
          generated.push({ kind: 'npm-install-lock', bytes: raw.length, sha256: hash(raw) });
        } else if (name === '.bin') {
          const bin = join(directory, name); require(realpathSync(bin) === bin, 'DEPENDENCY_INSTALLED_LINK');
          const digest = createHash('sha256'); let files = 0;
          for (const shim of readdirSync(bin).sort()) {
            const path = join(bin, shim); const info = lstatSync(path);
            if (info.isSymbolicLink()) { const target = realpathSync(path); contained(root, target); digest.update(JSON.stringify([shim, relative(root, target).split(sep).join('/')]) + '\n'); }
            else digest.update(JSON.stringify([shim, hash(regular(path))]) + '\n');
            files++;
          }
          generated.push({ kind: 'npm-bin-shims', files, sha256: digest.digest('hex') });
        } else if (name.startsWith('@')) {
          const scope = join(directory, name); require(realpathSync(scope) === scope && lstatSync(scope).isDirectory(), 'DEPENDENCY_INSTALLED_LINK');
          for (const leaf of readdirSync(scope)) require(declared.has(`${modulePath}/${name}/${leaf}`), 'DEPENDENCY_UNDECLARED_INSTALLATION');
        } else require(declared.has(`${modulePath}/${name}`), 'DEPENDENCY_UNDECLARED_INSTALLATION');
      }
    } catch { errors.push({ path: modulePath, reason: 'INSTALLED_DIRECTORY_INCOMPLETE' }); }
  }
  for (const pkg of packages) {
    try {
      const path = resolve(root, pkg.path); contained(root, path);
      if (pkg.kind === 'workspace-link') {
        require(realpathSync(path) === realpathSync(resolve(root, pkg.target)), 'DEPENDENCY_WORKSPACE_TARGET');
        records.push({ path: pkg.path, kind: pkg.kind, state: 'LINK_VERIFIED', target: pkg.target });
        continue;
      }
      const platformMismatch = pkg.kind === 'registry' && (!supports(pkg.entry.os, process.platform) || !supports(pkg.entry.cpu, process.arch));
      if (platformMismatch || (pkg.kind === 'registry' && pkg.entry.optional === true)) {
        require(pkg.entry.optional === true, 'DEPENDENCY_REQUIRED_PLATFORM');
        let present = true;
        try { lstatSync(path); } catch (error) { require(error.code === 'ENOENT', 'DEPENDENCY_INSTALLED_ACCESS'); present = false; }
        if (!present) { records.push({ path: pkg.path, kind: pkg.kind, name: pkg.name, version: pkg.version, state: platformMismatch ? 'OPTIONAL_PLATFORM_NOT_INSTALLED' : 'OPTIONAL_NOT_INSTALLED' }); continue; }
      }
      const raw = regular(join(path, 'package.json'));
      const identity = strictJson(raw);
      require(identity.name === pkg.name && identity.version === pkg.version, 'DEPENDENCY_INSTALLED_IDENTITY');
      const source = pkg.kind === 'registry' ? sourceDigest(path, budget) : { files: 1, bytes: raw.length, sourceSHA256: hash(raw) };
      records.push({ path: pkg.path, kind: pkg.kind, name: pkg.name, version: pkg.version, state: 'INSTALLED_VERIFIED', packageJSONSHA256: hash(raw), ...source });
    } catch {
      errors.push({ path: pkg.path, reason: 'INSTALLED_SOURCE_INCOMPLETE' });
    }
  }
  return { state: errors.length ? 'INCOMPLETE' : 'PASS', expected: packages.length, accounted: records.length, installed: records.filter(p => p.state === 'INSTALLED_VERIFIED').length, platformOptionalAbsent: records.filter(p => p.state === 'OPTIONAL_PLATFORM_NOT_INSTALLED').length, otherOptionalAbsent: records.filter(p => p.state === 'OPTIONAL_NOT_INSTALLED').length, workspaceLinks: records.filter(p => p.state === 'LINK_VERIFIED').length, files: budget.files, bytes: budget.bytes, records, generated, errors };
}

export function sanitizeAudit(report, exit, knownNames) {
  require([0, 1].includes(exit) && object(report) && report.auditReportVersion === 2 && !report.error && object(report.vulnerabilities) && object(report.metadata?.vulnerabilities), 'DEPENDENCY_AUDIT_INCOMPLETE');
  const counts = report.metadata.vulnerabilities;
  require(SEVERITIES.every(s => integer(counts[s])) && integer(counts.total) && SEVERITIES.reduce((n, s) => n + counts[s], 0) === counts.total, 'DEPENDENCY_AUDIT_COUNTS');
  const findings = [];
  for (const [name, item] of Object.entries(report.vulnerabilities)) {
    require(PACKAGE.test(name) && knownNames.has(name) && object(item) && item.name === name && SEVERITIES.includes(item.severity) && typeof item.isDirect === 'boolean' && Array.isArray(item.via) && Array.isArray(item.nodes), 'DEPENDENCY_AUDIT_SCHEMA');
    const ids = [];
    const propagatesFrom = [];
    for (const via of item.via) {
      if (typeof via === 'string') { require(knownNames.has(via), 'DEPENDENCY_AUDIT_SCHEMA'); propagatesFrom.push(via); }
      else {
        require(object(via) && knownNames.has(via.name) && typeof via.url === 'string', 'DEPENDENCY_AUDIT_SCHEMA');
        const id = via.url.match(/^https:\/\/github\.com\/advisories\/(GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4})$/)?.[1];
        require(id && ADVISORY.test(id), 'DEPENDENCY_AUDIT_ADVISORY'); ids.push(id);
      }
    }
    require(item.nodes.every(node => typeof node === 'string' && node.length <= 512), 'DEPENDENCY_AUDIT_SCHEMA');
    findings.push({ name, severity: item.severity, direct: item.isDirect, installedPaths: item.nodes.length, ids: [...new Set(ids)].sort(), propagatesFrom: [...new Set(propagatesFrom)].sort() });
  }
  require(findings.length === counts.total && SEVERITIES.every(s => findings.filter(f => f.severity === s).length === counts[s]) && (exit === 0) === (findings.length === 0), 'DEPENDENCY_AUDIT_COUNTS');
  return { state: findings.length ? 'FINDINGS' : 'PASS', exit, counts: Object.fromEntries([...SEVERITIES, 'total'].map(s => [s, counts[s]])), findings: findings.sort((a, b) => a.name.localeCompare(b.name, 'en')) };
}

function npmEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:NODE_OPTIONS|NODE_PATH|NODE_AUTH_TOKEN|NPM_.*)$/i.test(key)));
}

export function npmCli() {
  const nodeDirectory = dirname(realpathSync(process.execPath));
  const bundled = [join(nodeDirectory, 'node_modules/npm/bin/npm-cli.js'), resolve(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js')];
  function approved(path) {
    const bytes = regular(path);
    const identity = strictJson(regular(resolve(dirname(path), '../package.json')));
    require(identity.name === 'npm' && identity.version === '11.20.0', 'DEPENDENCY_NPM_IDENTITY');
    return { path, cliSHA256: hash(bytes), version: identity.version };
  }
  for (const path of bundled) {
    try {
      return approved(path);
    } catch { /* A bundled older npm may still resolve its normal global prefix. */ }
  }
  for (const path of bundled) {
    try {
      regular(path);
      const identity = strictJson(regular(resolve(dirname(path), '../package.json')));
      require(identity.name === 'npm' && VERSION.test(identity.version), 'DEPENDENCY_NPM_IDENTITY');
      // npm.cmd uses this installed global prefix on Windows. Ask the canonical
      // bundled CLI locally; never trust npm_execpath, PATH scripts or NPM_*.
      const actual = spawnSync(process.execPath, [path, 'prefix', '--global', '--logs-max=0'], { cwd: ROOT, env: npmEnvironment(), encoding: null, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000, maxBuffer: 4096, killSignal: 'SIGKILL', windowsHide: true });
      require(!actual.error && !actual.signal && actual.status === 0 && actual.stderr.length === 0, 'DEPENDENCY_NPM_PREFIX');
      const prefix = new TextDecoder('utf-8', { fatal: true }).decode(actual.stdout).trim();
      require(prefix && !/[\r\n\x00]/.test(prefix) && isAbsolute(prefix) && !prefix.startsWith('\\\\') &&
        realpathSync(prefix) === resolve(prefix) && lstatSync(prefix).isDirectory() && !lstatSync(prefix).isSymbolicLink(), 'DEPENDENCY_NPM_PREFIX');
      for (const relativePath of ['node_modules/npm/bin/npm-cli.js', 'lib/node_modules/npm/bin/npm-cli.js']) {
        try { return approved(join(prefix, relativePath)); }
        catch { /* Only exact existing npm 11.20.0 installations can run audit. */ }
      }
    } catch { /* A missing installation candidate is not tool completion. */ }
  }
  throw new Error('DEPENDENCY_NPM_UNAVAILABLE');
}

async function queryOsv(coordinates) {
  const findings = []; let queried = 0; let batches = 0;
  try {
    for (let start = 0; start < coordinates.length; start += 100) {
      const batch = coordinates.slice(start, start + 100);
      const response = await fetch('https://api.osv.dev/v1/querybatch', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries: batch.map(p => ({ package: { ecosystem: 'npm', name: p.name }, version: p.version })) }) });
      require(response.ok && response.body, 'DEPENDENCY_OSV_HTTP');
      const chunks = []; let length = 0;
      for await (const chunk of response.body) { length += chunk.length; require(length <= MAX_OUTPUT, 'DEPENDENCY_OSV_BOUND'); chunks.push(chunk); }
      const data = strictJson(Buffer.concat(chunks));
      require(object(data) && Array.isArray(data.results) && data.results.length === batch.length, 'DEPENDENCY_OSV_SCHEMA');
      for (let i = 0; i < batch.length; i++) {
        const result = data.results[i]; require(object(result) && !result.next_page_token && (!result.vulns || Array.isArray(result.vulns)), 'DEPENDENCY_OSV_SCHEMA');
        const ids = (result.vulns ?? []).map(v => { require(object(v) && ADVISORY.test(v.id), 'DEPENDENCY_OSV_ADVISORY'); return v.id; });
        if (ids.length) findings.push({ name: batch[i].name, version: batch[i].version, ids: [...new Set(ids)].sort() });
      }
      queried += batch.length; batches++;
    }
    return { state: findings.length ? 'FINDINGS' : 'PASS', expected: coordinates.length, queried, batches, findings };
  } catch (error) {
    const codes = new Set(['DEPENDENCY_OSV_HTTP', 'DEPENDENCY_OSV_BOUND', 'DEPENDENCY_OSV_SCHEMA', 'DEPENDENCY_OSV_ADVISORY', 'DEPENDENCY_JSON_INVALID']);
    return { state: 'INCOMPLETE', expected: coordinates.length, queried, batches, findings, reason: codes.has(error.message) ? error.message : 'OSV_QUERY_INCOMPLETE' };
  }
}

export async function runDependency(root = ROOT) {
  root = realpathSync(root);
  const lockBytes = regular(join(root, 'package-lock.json'));
  const packages = lockInventory(strictJson(lockBytes));
  const registry = packages.filter(p => p.kind === 'registry');
  const unique = [...new Map(registry.map(p => [`${p.name}@${p.version}`, { name: p.name, version: p.version }])).values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'));
  const installed = installedInventory(root, packages);
  const sourceSHA256 = hash(JSON.stringify([installed.records, installed.generated]));
  let npm = { state: 'INCOMPLETE', exit: null, reason: 'NPM_NOT_EXECUTED' }; let tool = null;
  try {
    tool = npmCli();
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:NODE_OPTIONS|NODE_PATH|NODE_AUTH_TOKEN|NPM_.*)$/i.test(key)));
    const actual = spawnSync(process.execPath, [tool.path, 'audit', '--json', '--ignore-scripts', '--no-fund', '--logs-max=0', '--registry=https://registry.npmjs.org/'], { cwd: root, env, encoding: null, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000, maxBuffer: MAX_OUTPUT, killSignal: 'SIGKILL', windowsHide: true });
    npm = actual.error || actual.signal ? { state: 'INCOMPLETE', exit: actual.status, reason: 'NPM_EXECUTION_INCOMPLETE' } : sanitizeAudit(strictJson(actual.stdout), actual.status, new Set(registry.map(p => p.name)));
  } catch (error) {
    const codes = new Set(['DEPENDENCY_JSON_INVALID', 'DEPENDENCY_NPM_UNAVAILABLE', 'DEPENDENCY_AUDIT_INCOMPLETE', 'DEPENDENCY_AUDIT_COUNTS', 'DEPENDENCY_AUDIT_SCHEMA', 'DEPENDENCY_AUDIT_ADVISORY']);
    npm = { state: 'INCOMPLETE', exit: null, reason: codes.has(error.message) ? error.message : 'NPM_OUTPUT_INCOMPLETE' };
  }
  const osv = await queryOsv(unique);
  const after = installedInventory(root, packages);
  require(hash(regular(join(root, 'package-lock.json'))) === hash(lockBytes) && sourceSHA256 === hash(JSON.stringify([after.records, after.generated])) && JSON.stringify(installed.errors) === JSON.stringify(after.errors), 'DEPENDENCY_INPUT_CHANGED');
  const npmIds = new Set((npm.findings ?? []).flatMap(f => f.ids));
  const osvIds = new Set(osv.findings.flatMap(f => f.ids));
  const disagreements = { npmOnly: [...npmIds].filter(id => !osvIds.has(id)).sort(), osvOnly: [...osvIds].filter(id => !npmIds.has(id)).sort() };
  const state = [installed, npm, osv].some(c => c.state === 'INCOMPLETE') ? 'INCOMPLETE' : [npm, osv].some(c => c.state === 'FINDINGS') ? 'FINDINGS' : 'PASS';
  return { schema: 1, component: 'dependency22', qualification: 'PUBLIC_DEPENDENCY_TECHNICAL_ONLY', lockSHA256: hash(lockBytes), installedSourceSHA256: sourceSHA256, nodeVersion: process.version, npmVersion: tool?.version ?? null, npmCliSHA256: tool?.cliSHA256 ?? null, coverage: { lockEntries: packages.length, registryEntries: registry.length, workspaceEntries: packages.filter(p => p.kind === 'workspace').length, workspaceLinks: packages.filter(p => p.kind === 'workspace-link').length, uniqueNpmCoordinates: unique.length }, installed, npm, osv, disagreements, state, admission: 'NOT_GRANTED' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    require(process.argv.length === 2, 'DEPENDENCY_ARGUMENTS');
    const result = await runDependency();
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.state === 'PASS' ? 0 : result.state === 'FINDINGS' ? 1 : 2;
  } catch {
    process.stdout.write(JSON.stringify({ schema: 1, component: 'dependency22', qualification: 'PUBLIC_DEPENDENCY_TECHNICAL_ONLY', state: 'INCOMPLETE', reason: 'DEPENDENCY_REFUSED', admission: 'NOT_GRANTED' }) + '\n');
    process.exitCode = 2;
  }
}
