import { createHash } from 'node:crypto';
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync, writeSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { lockSuccession23, nativeTree23, LOCK_SUCCESSION23_SHA256 } from './ios-privacy-lock-succession23.mjs';

export const IOS_PRIVACY_LOCK_SUCCESSION46_PATH = 'docs/phase-9/ios-sdk-lock-succession46.v1.json';
export const LOCK_SUCCESSION46_SHA256 = 'a29190ab7022381d759d2d38b6198784ed7e393ed78f15c368ce259e94942d2a';
export const CURRENT_LOCK46_SHA256 = '71aef9b618c23b3d15c94251f5d9548d4a3c6a1a88af42471ed03ad3d0b062aa';
const BASE = '20c761fa5e3fbf427fb33ab319218bd0c1d022bd';
const BASE_TREE = '23563c36af990df5fc74d6a79507cfc24a1ff8ac';
const PREDECESSOR = 'deafce53190f8437867a4c969cb85b0ec8e183d5';
const PREDECESSOR_TREE = '832a196ca7b6dda4a9888ade5680e8ba211c6020';
const BASE_LOCK = '1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95';
const STATUS = 'NATIVE_LOCK_SUCCESSOR_SOURCE_CANDIDATE_REVIEW_REQUIRED';
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const reject = message => { throw new Error(`CURRENT_NATIVE_SOURCE46_${message}`); };
const identityKeys = ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'nlink'];
let sourceTraceSequence09 = 0;
function sourceStage09(site) {
  if (process.env.C47_SOURCE_TRACE09 !== '1' || sourceTraceSequence09 >= 128) return;
  try { writeSync(2, JSON.stringify({ event: 'C47_SOURCE_STAGE09', site, pid: process.pid, sequence: ++sourceTraceSequence09 }) + '\n'); }
  catch { /* Observation cannot alter the original assertion. */ }
}

const sameStat = (a, b) => identityKeys.every(key => a[key] === b[key]);
const stamp = stat => identityKeys.map(key => String(stat[key]));

function chain(path) {
  const paths = [];
  for (let current = resolve(path);;) {
    paths.unshift(current);
    const parent = resolve(current, '..');
    if (current === parent) return paths;
    current = parent;
  }
}

function checkedChain(path) {
  return chain(path).map(absolute => {
    const stat = lstatSync(absolute, { bigint: true });
    if (stat.isSymbolicLink()) reject('LINK');
    return { absolute, stat, real: realpathSync(absolute) };
  });
}

function recheckChain(before) {
  for (const entry of before) {
    const after = lstatSync(entry.absolute, { bigint: true });
    // Directory timestamps/link counts also change for unrelated siblings.
    // Identity/type/canonical path remain authoritative for ancestors; file
    // leaves retain every before/open/after timestamp, size and link check.
    const keys = entry.stat.isDirectory() ? ['dev', 'ino'] : identityKeys;
    if (after.isSymbolicLink() || entry.stat.isDirectory() !== after.isDirectory() ||
        keys.some(key => entry.stat[key] !== after[key]) ||
        (entry.real !== undefined && realpathSync(entry.absolute) !== entry.real)) {
      reject(`PATH_RACE:${entry.absolute}:${keys.filter(key => entry.stat[key] !== after[key]).join(',')}`);
    }
  }
}

// Node identifies symbolic links and junctions. Windows additionally exposes
// other reparse tags through FileAttributes; enumerate before following them.
const WINDOWS_REPARSE_CHECK = String.raw`
$ErrorActionPreference = 'Stop'
$spec = [Console]::In.ReadToEnd() | ConvertFrom-Json
$checked = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
function Check-Path([string]$path) {
  if ($checked.Add($path)) {
    $attributes = [IO.File]::GetAttributes($path)
    if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'NATIVE46_REPARSE_POINT' }
  }
}
foreach ($path in $spec.paths) {
  $current = [IO.Path]::GetFullPath($path)
  while ($null -ne $current) {
    Check-Path $current
    $parent = [IO.Directory]::GetParent($current)
    $current = if ($null -eq $parent) { $null } else { $parent.FullName }
  }
}
foreach ($tree in $spec.trees) {
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($tree)
  $count = 0
  $enumerated = 0
  while ($pending.Count -gt 0) {
    $path = $pending.Pop()
    Check-Path $path
    $count += 1
    if ($count -gt 20000) { throw 'NATIVE46_REPARSE_INVENTORY_BOUND' }
    if (([IO.File]::GetAttributes($path) -band [IO.FileAttributes]::Directory) -ne 0) {
      foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($path)) {
        $enumerated += 1
        if ($enumerated -ge 20000) { throw 'NATIVE46_REPARSE_INVENTORY_BOUND' }
        Check-Path $entry
        $pending.Push($entry)
      }
    }
  }
}
[Console]::Out.Write('{"checked":' + $checked.Count + '}')
`;

export function checkWindowsReparse(paths, trees = []) {
  if (process.platform !== 'win32') return;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_REPARSE_CHECK], {
    input: JSON.stringify({ paths, trees }), encoding: 'utf8', windowsHide: true,
    timeout: 30_000, maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0 && result.stderr?.includes('NATIVE46_REPARSE_INVENTORY_BOUND')) reject('WINDOWS_REPARSE_BOUND');
  if (result.status !== 0 || !Number.isSafeInteger(JSON.parse(result.stdout || '{}').checked)) reject('WINDOWS_REPARSE');
}

export function checkedNativeRoot46(value) {
  const absolute = resolve(value);
  const ancestors = checkedChain(absolute);
  if (!ancestors.at(-1).stat.isDirectory()) reject('ROOT');
  checkWindowsReparse([absolute]);
  return { absolute, real: realpathSync(absolute), ancestors };
}

export function checkedNativePath46(root, name) {
  if (typeof name !== 'string' || !name || isAbsolute(name) || /[\\:\u0000-\u001f]/u.test(name) ||
      name.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/u.test(part))) reject('PATH');
  let absolute = root.absolute;
  const ancestors = [];
  for (const part of ['', ...name.split('/')]) {
    if (part) absolute = join(absolute, part);
    const stat = lstatSync(absolute, { bigint: true });
    if (stat.isSymbolicLink()) reject('LINK');
    ancestors.push({ absolute, stat });
  }
  const real = realpathSync(absolute);
  ancestors.at(-1).real = real;
  const rel = relative(root.real, real);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) reject('ESCAPE');
  return { absolute, ancestors };
}

export function readNativeFile46(root, name, maximum = 16 * 1024 * 1024) {
  const entry = checkedNativePath46(root, name);
  const before = entry.ancestors.at(-1).stat;
  if (!before.isFile() || before.nlink !== 1n || before.size < 1n || before.size > BigInt(maximum)) reject('FILE');
  const descriptor = openSync(entry.absolute, 'r');
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || !sameStat(before, opened)) reject('OPEN_RACE');
    // Allocate only the already validated size. readFileSync(fd) performs its
    // own later stat and can allocate an attacker-grown size before refusal.
    const bytes = Buffer.alloc(Number(before.size));
    let position = 0;
    while (position < bytes.length) {
      const count = readSync(descriptor, bytes, position, bytes.length - position, null);
      if (count === 0) reject('READ_RACE');
      position += count;
    }
    if (readSync(descriptor, Buffer.alloc(1), 0, 1, null) !== 0) reject('READ_RACE');
    if (!sameStat(before, fstatSync(descriptor, { bigint: true })) || BigInt(bytes.length) !== before.size) reject('READ_RACE');
    recheckChain(entry.ancestors);
    return { absolute: entry.absolute, relative: name, bytes, sha256: hash(bytes), identity: stamp(before) };
  } finally { closeSync(descriptor); }
}

function git(root, args, maximum = 32 * 1024 * 1024, input) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith('GIT_')) delete env[name];
  env.GIT_NO_REPLACE_OBJECTS = '1';
  env.GIT_OPTIONAL_LOCKS = '0';
  const result = spawnSync('git', ['--no-replace-objects', ...args], {
    cwd: root.absolute, env, input, windowsHide: true, timeout: 30_000, maxBuffer: maximum,
  });
  if (result.status !== 0) reject('GIT_SOURCE_IDENTITY');
  return result.stdout;
}

function decodeCommit09(sha, bytes) {
  if (createHash('sha1').update(`commit ${bytes.length}\0`).update(bytes).digest('hex') !== sha) reject('COMMIT_OBJECT');
  const header = bytes.toString('utf8').split('\n\n', 1)[0].split('\n');
  const tree = header.find(line => line.startsWith('tree '))?.slice(5);
  const parents = header.filter(line => line.startsWith('parent ')).map(line => line.slice(7));
  if (!/^[a-f0-9]{40}$/u.test(tree ?? '') || parents.some(parent => !/^[a-f0-9]{40}$/u.test(parent))) reject('COMMIT_HEADER');
  return { sha, tree, parents };
}

// The inventory only supplies candidates. Every object is independently hashed,
// and the original parent walk below proves ancestry without trusting rev-list,
// grafts, replacement objects, cached receipts or a previous invocation.
export function parseNativeCommitBatch09(raw, names) {
  if (!Buffer.isBuffer(raw) || names.length < 1 || names.length > 263 ||
      new Set(names).size !== names.length || names.some(name => !/^[a-f0-9]{40}$/u.test(name))) reject('COMMIT_OBJECT');
  const commits = new Map(); let offset = 0;
  for (const expected of names) {
    const end = raw.indexOf(10, offset);
    if (end < offset) reject('COMMIT_OBJECT');
    const header = raw.subarray(offset, end).toString('ascii');
    const match = /^([a-f0-9]{40}) commit (0|[1-9][0-9]*)$/u.exec(header);
    if (!match || match[1] !== expected) reject('COMMIT_OBJECT');
    const size = Number(match[2]); offset = end + 1;
    if (!Number.isSafeInteger(size) || size > 32 * 1024 * 1024 ||
        offset + size >= raw.length || raw[offset + size] !== 10) reject('COMMIT_OBJECT');
    commits.set(expected, decodeCommit09(expected, raw.subarray(offset, offset + size)));
    offset += size + 1;
  }
  if (offset !== raw.length) reject('COMMIT_OBJECT');
  return commits;
}

function commitInventory09(root) {
  const refs = new Map();
  for (const reference of [BASE, PREDECESSOR, 'HEAD']) {
    const sha = git(root, ['rev-parse', '--verify', reference]).toString('ascii').trim();
    if (!/^[a-f0-9]{40}$/u.test(sha)) reject('HEAD');
    refs.set(reference, sha);
  }
  const checkout = decodeCommit09(refs.get('HEAD'), git(root, ['cat-file', 'commit', refs.get('HEAD')]));
  const source = checkout.parents.length === 2 ? checkout.parents[1] : checkout.sha;
  const candidates = git(root, ['rev-list', '--first-parent', '--max-count=257', source])
    .toString('ascii').trim().split('\n');
  if (candidates.length > 260 || candidates.some(name => !/^[a-f0-9]{40}$/u.test(name))) reject('COMMIT_OBJECT');
  const names = [...new Set([...refs.values(), ...candidates])];
  const commits = parseNativeCommitBatch09(git(root, ['cat-file', '--batch'],
    32 * 1024 * 1024, names.map(name => name + '\n').join('')), names);
  for (const [reference, sha] of refs) commits.set(reference, commits.get(sha));
  return commits;
}

export function nativeSourceIdentity46(root) {
  sourceStage09('IDENTITY_BEGIN');
  const commits = commitInventory09(root);
  const commit = (_root, reference) => {
    const value = commits.get(reference);
    if (!value) reject('APPEND_ONLY_LINEAGE');
    return value;
  };
  const base = commit(root, BASE);
  const predecessor = commit(root, PREDECESSOR);
  if (base.tree !== BASE_TREE || predecessor.tree !== PREDECESSOR_TREE) reject('PREDECESSOR');
  const origin = git(root, ['remote', 'get-url', 'origin']).toString('utf8').trim();
  if (!/^(?:https:\/\/github\.com\/|git@github\.com:)TasfiqJ\/onSkin(?:\.git)?$/iu.test(origin)) reject('REPOSITORY_OWNER');
  const checkout = commit(root, 'HEAD');
  let source = checkout;
  if (checkout.parents.length === 2) {
    source = commit(root, checkout.parents[1]);
    if (checkout.parents[0] !== BASE || source.tree !== checkout.tree) reject('SERVICE_MERGE');
  } else if (checkout.parents.length !== 1) reject('HEAD_LINEAGE');
  if (source.sha === BASE) reject('HEAD_LINEAGE');
  let cursor = source;
  const visited = new Set();
  while (cursor.sha !== PREDECESSOR) {
    if (cursor.parents.length !== 1 || visited.has(cursor.sha) || visited.size >= 256) reject('APPEND_ONLY_LINEAGE');
    visited.add(cursor.sha);
    // Read and rehash the actual commit object. Repository grafts or a forged
    // rev-list/merge-base view must never manufacture accepted ancestry.
    cursor = commit(root, cursor.parents[0]);
  }
  sourceStage09('IDENTITY_COMPLETE');
  sourceStage09('IDENTITY_COMPLETE');
  return { checkoutHead: checkout.sha, sourceHead: source.sha, sourceTree: source.tree,
    acceptedBase: BASE, acceptedBaseTree: BASE_TREE, predecessor: PREDECESSOR, predecessorTree: PREDECESSOR_TREE };
}

/** Final entrypoints require actual committed bytes, not a development receipt. */
export function assertCurrentNativeHead46(rootValue, expectedHead = process.env.C46_EXPECTED_HEAD) {
  sourceStage09('COMMITTED_INPUTS_BEGIN');
  const root = checkedNativeRoot46(rootValue);
  const identity = nativeSourceIdentity46(root);
  if (expectedHead !== undefined &&
      (!/^[a-f0-9]{40}$/u.test(expectedHead) || expectedHead !== identity.sourceHead)) reject('EXPECTED_HEAD');
  const descriptor = readNativeFile46(root, IOS_PRIVACY_LOCK_SUCCESSION46_PATH, 4 * 1024 * 1024);
  if (descriptor.sha256 !== LOCK_SUCCESSION46_SHA256) reject('WITNESS_DRIFT');
  const witness = JSON.parse(descriptor.bytes);
  const paths = [...new Set([IOS_PRIVACY_LOCK_SUCCESSION46_PATH,
    'scripts/phase9/ios-privacy-lock-succession46.mjs', 'package-lock.json', witness.rootPackage.path,
    ...witness.currentSourceInputs.map(pin => pin.path),
    ...witness.unchangedInputs.filter(pin => pin.status !== 'ABSENT').map(pin => pin.path)])]
    .filter(path => !path.startsWith('node_modules/')).sort();
  // cat-file receives an explicit finite input inventory; never trust git status
  // or a report's clean/source boolean as content identity evidence.
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith('GIT_')) delete env[name];
  env.GIT_NO_REPLACE_OBJECTS = '1'; env.GIT_OPTIONAL_LOCKS = '0';
  const batch = spawnSync('git', ['--no-replace-objects', 'cat-file', '--batch'], {
    cwd: root.absolute, env, input: paths.map(path => `${identity.sourceHead}:${path}\n`).join(''),
    windowsHide: true, timeout: 30_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (batch.status !== 0) reject('COMMITTED_INPUTS');
  let offset = 0;
  for (const path of paths) {
    const end = batch.stdout.indexOf(10, offset);
    const [object, kind, sizeText] = batch.stdout.subarray(offset, end).toString('ascii').split(' ');
    const size = Number(sizeText);
    if (end < offset || !/^[a-f0-9]{40}$/u.test(object) || kind !== 'blob' ||
        !Number.isSafeInteger(size) || size < 0 || size > 16 * 1024 * 1024) reject(`UNCOMMITTED_INPUT:${path}`);
    offset = end + 1;
    const bytes = batch.stdout.subarray(offset, offset + size);
    if (bytes.length !== size || batch.stdout[offset + size] !== 10 ||
        createHash('sha1').update(`blob ${size}\0`).update(bytes).digest('hex') !== object ||
        !readNativeFile46(root, path).bytes.equals(bytes)) reject(`COMMITTED_INPUT_DRIFT:${path}`);
    offset += size + 1;
  }
  if (offset !== batch.stdout.length || !same(identity, nativeSourceIdentity46(root))) reject('COMMITTED_INPUT_RACE');
  sourceStage09('COMMITTED_INPUTS_COMPLETE');
  sourceStage09('COMMITTED_INPUTS_COMPLETE');
  return { ...identity, expectedHead: expectedHead ?? identity.sourceHead,
    committedCriticalInputs: paths.length, descriptorSHA256: descriptor.sha256 };
}

function absentNativeInput(root, name) {
  let path = root.absolute;
  for (const part of name.split('/')) {
    path = join(path, part);
    try { if (lstatSync(path).isSymbolicLink()) reject('ABSENCE_LINK'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
  }
  reject('EXPECTED_ABSENCE');
}

export function verifyNativeTree46(root, expected, stamps = null) {
  const actual = nativeTree23(root, expected.path, {
    checkedPath: (current, path) => {
      const entry = checkedNativePath46(current, path);
      if (stamps) stamps[path] = stamp(entry.ancestors.at(-1).stat);
      return entry;
    }, readBoundedFile: readNativeFile46, reject,
  });
  if (!same(actual, expected)) reject('TREE_DENOMINATOR');
  return actual;
}

export function verifyNativeCandidate46(rootValue) {
  const root = checkedNativeRoot46(rootValue);
  const source = nativeSourceIdentity46(root);
  checkWindowsReparse([join(root.absolute, IOS_PRIVACY_LOCK_SUCCESSION46_PATH)]);
  const file = readNativeFile46(root, IOS_PRIVACY_LOCK_SUCCESSION46_PATH, 4 * 1024 * 1024);
  if (file.sha256 !== LOCK_SUCCESSION46_SHA256) reject('WITNESS_DRIFT');
  const witness = JSON.parse(file.bytes);
  if (witness.schemaVersion !== 1 || witness.kind !== 'ios_privacy_lock_succession46_source_candidate' ||
      witness.status !== STATUS || witness.authority !== 'BRAIN-C46-CURRENT-NATIVE-SECURITY-CLOSURE-02' ||
      witness.repository !== 'TasfiqJ/onSkin' || witness.acceptedBase.commit !== BASE || witness.acceptedBase.tree !== BASE_TREE ||
      witness.predecessor.commit !== PREDECESSOR || witness.predecessor.tree !== PREDECESSOR_TREE ||
      witness.acceptedBase.lockSHA256 !== BASE_LOCK || witness.predecessor.lockSHA256 !== CURRENT_LOCK46_SHA256 ||
      witness.predecessor.rootPackageSHA256 !== 'cc37998ca18d43326f11e47cc78f2b3aa62231b0381d1948578804190ec2269b' ||
      witness.originalC23Profile.witnessSHA256 !== LOCK_SUCCESSION23_SHA256 || witness.originalC23Profile.completeLockSHA256 !== BASE_LOCK ||
      witness.candidateLock.sha256 !== CURRENT_LOCK46_SHA256 || witness.claims.sourceOnly !== true ||
      witness.claims.archiveRequired !== true || Object.entries(witness.claims).some(([key, value]) =>
        !['sourceOnly', 'archiveRequired'].includes(key) && value !== false) ||
      Object.values(witness.admissions).some(value => value !== false) || witness.release !== 'NO_GO' || witness.spendUsd !== 0) reject('CANDIDATE_BOUNDARY');
  const lockFile = readNativeFile46(root, 'package-lock.json');
  if (lockFile.sha256 !== witness.candidateLock.sha256 || lockFile.bytes.length !== witness.candidateLock.bytes) reject('LOCK_IDENTITY');
  const paths = [...witness.unchangedInputs, ...witness.currentSourceInputs, witness.rootPackage];
  const names = new Set();
  for (const pin of paths) {
    const alias = pin.path.normalize('NFKC').toLowerCase();
    if (names.has(alias)) reject('INPUT_ALIAS');
    names.add(alias);
  }
  const regularPaths = paths.filter(pin => pin.status !== 'ABSENT').map(pin => join(root.absolute, pin.path));
  checkWindowsReparse(regularPaths, witness.installedNativeTrees.map(tree => join(root.absolute, tree.path)));
  const inputs = [];
  const stamps = { [IOS_PRIVACY_LOCK_SUCCESSION46_PATH]: file.identity,
    'package-lock.json': lockFile.identity,
    'scripts/phase9/ios-privacy-lock-succession46.mjs': readNativeFile46(root, 'scripts/phase9/ios-privacy-lock-succession46.mjs').identity };
  for (const pin of paths) {
    if (pin.status === 'ABSENT') { absentNativeInput(root, pin.path); inputs.push(pin); continue; }
    const actual = readNativeFile46(root, pin.path);
    if (actual.sha256 !== pin.sha256 || actual.bytes.length !== pin.bytes) reject(`SOURCE_PIN:${pin.path}`);
    stamps[pin.path] = actual.identity;
    inputs.push({ path: pin.path, bytes: actual.bytes.length, sha256: actual.sha256 });
  }
  const currentPackage = readNativeFile46(root, 'package.json');
  const basePackage = git(root, ['show', `${BASE}:package.json`]);
  const priorPackage = git(root, ['show', `${PREDECESSOR}:package.json`]);
  const priorLock = git(root, ['show', `${PREDECESSOR}:package-lock.json`]);
  const transition = witness.rootPackageTransition;
  if (hash(basePackage) !== transition.acceptedParent.sha256 || basePackage.length !== transition.acceptedParent.bytes ||
      hash(priorPackage) !== transition.predecessor.sha256 || priorPackage.length !== transition.predecessor.bytes ||
      transition.predecessor.sha256 !== 'cc37998ca18d43326f11e47cc78f2b3aa62231b0381d1948578804190ec2269b' ||
      hash(basePackage) !== witness.acceptedBase.rootPackageSHA256 ||
      hash(priorPackage) !== witness.predecessor.rootPackageSHA256 ||
      hash(priorLock) !== witness.predecessor.lockSHA256 || !priorLock.equals(lockFile.bytes) ||
      !same(transition.closureChangedScripts, ['postinstall', 'postinstall:check'])) reject('PACKAGE_PREDECESSOR');
  const expectedPackage = JSON.parse(priorPackage);
  expectedPackage.scripts.postinstall += ` && ${transition.appendedHook}`;
  expectedPackage.scripts['postinstall:check'] += ` && ${transition.appendedHook} --check`;
  if (!jsonBytes(expectedPackage).equals(currentPackage.bytes)) reject('EXACT_PACKAGE_HOOK_DELTA');
  const baseBytes = git(root, ['show', `${BASE}:package-lock.json`]);
  if (hash(baseBytes) !== BASE_LOCK) reject('BASE_LOCK');
  const lock = JSON.parse(lockFile.bytes);
  const before = JSON.parse(baseBytes);
  const changed = [...new Set([...Object.keys(lock.packages), ...Object.keys(before.packages)])]
    .filter(path => !same(lock.packages[path], before.packages[path])).sort();
  if (!same(changed, witness.changedNodes)) reject('FINITE_LOCK_DELTA');
  const historical = structuredClone(lock);
  for (const path of changed) {
    if (!same(lock.packages[path], witness.candidateNodes[path]) ||
        !same(before.packages[path] ?? null, witness.originalNodes[path])) reject('NODE_IDENTITY');
    if (Object.hasOwn(before.packages, path)) historical.packages[path] = before.packages[path];
    else delete historical.packages[path];
  }
  if (!jsonBytes(historical).equals(baseBytes)) reject('LOSSLESS_PREDECESSOR');
  for (const [path, node] of Object.entries(witness.unchangedNativeNodes)) {
    if (!same(lock.packages[path], node)) reject('NATIVE_NODE');
  }
  const trees = witness.installedNativeTrees.map(expected => verifyNativeTree46(root, expected, stamps));
  const finalSource = nativeSourceIdentity46(root);
  if (!same(source, finalSource)) reject('HEAD_RACE');
  recheckChain(root.ancestors);
  checkWindowsReparse(regularPaths, witness.installedNativeTrees.map(tree => join(root.absolute, tree.path)));
  return { root, file, witness, source, lock, lockFile, historical, historicalBytes: baseBytes, inputs, trees, stamps };
}

export function lockSuccession46({ mapping, mappingFile, lockFile, root, readJson, historicalCheck, fail }) {
  const candidate = verifyNativeCandidate46(root.absolute);
  if (!candidate.lockFile.bytes.equals(lockFile.bytes)) reject('AUDIT_LOCK_RACE');
  // This projection is lossless and occurs only after current source, package,
  // lock, native nodes and complete installed-tree identities have all passed.
  lockSuccession23({ mapping, mappingFile, lock: candidate.historical,
    lockFile: { ...lockFile, bytes: candidate.historicalBytes, sha256: BASE_LOCK }, root,
    readJson, readBoundedFile: readNativeFile46, checkedPath: checkedNativePath46, historicalCheck, fail });
  return { ...candidate.file, kind: 'succession46' };
}

export function checkCurrentAuditSnapshot46(report, witnessBytes) {
  if (!Buffer.isBuffer(witnessBytes) || hash(witnessBytes) !== LOCK_SUCCESSION46_SHA256) reject('WITNESS_DRIFT');
  const witness = JSON.parse(witnessBytes);
  if (report.status !== 'archive_required' || report.errors?.length !== 0 ||
      !report.inputs?.lockSuccession46 || report.inputs.lockSuccession23 || report.inputs.lockSuccession13 ||
      report.inputs.lockSuccession46.sha256 !== LOCK_SUCCESSION46_SHA256 ||
      report.inputs.packageLock.sha256 !== CURRENT_LOCK46_SHA256) reject('AUDIT_INVALID');
  const snapshot = structuredClone(report);
  delete snapshot.inputs.lockSuccession46;
  if (witness.currentAuditSnapshot.hashDomain !== 'canonicalAuditJson(report) with only inputs.lockSuccession46 omitted' ||
      hash(jsonBytes(snapshot)) !== witness.currentAuditSnapshot.sha256) reject('SNAPSHOT_DRIFT');
  return true;
}
