import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  accessSync,
  closeSync,
  constants as FS_CONSTANTS,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import {
  CAT07_COMMITTED_INPUT_PATHS,
  CAT07_COMMITTED_MANIFEST_JSON_PATH,
  CAT07_COMMITTED_MANIFEST_MD_PATH,
  CAT07_COMMITTED_SUMMARY_PATH,
} from '../e2e/cat07-committed-evidence.mjs';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const PHASE9_RELEASE_CANDIDATE_DIR =
  /^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const PHASE9_RELEASE_INPUT_MAX_BYTES = 8 * 1024 * 1024;
export const PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES = 64 * 1024 * 1024;
export const PHASE9_RELEASE_OPTIONAL_INPUT_MAX_BYTES = 256 * 1024;
const MAX_GIT_STATUS_BYTES = 8 * 1024 * 1024;
const MAX_GIT_INDEX_BYTES = 8 * 1024 * 1024;

export const PHASE9_RELEASE_CANDIDATE_METADATA_FILE_NAMES = Object.freeze([
  'manifest.md',
  'commands.md',
  'evidence-chain.json',
  'automated-verification.md',
  'manual-qa-matrix.md',
  'security-review.md',
  'privacy-review.md',
  'ios-archive-privacy-evidence.json',
  'payments-review.md',
  'observability-review.md',
  'store-review-packet.md',
  'rollout-plan.md',
  'incident-plan.md',
  'signoff.md',
]);

export const PHASE9_CAT07_VALIDATOR_SOURCE_PATHS = Object.freeze([
  'scripts/e2e/cat07-committed-evidence.mjs',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/e2e/human-e2e-manifest-render.mjs',
  'scripts/e2e/evidence-diagnostic-hygiene.mjs',
  'scripts/e2e/cat07-png-contract.mjs',
  'scripts/e2e/cat07-shelf-freshness-audit.mjs',
]);

export const PHASE9_CAT07_BOUND_INPUT_PATHS = Object.freeze([
  ...CAT07_COMMITTED_INPUT_PATHS,
  ...PHASE9_CAT07_VALIDATOR_SOURCE_PATHS,
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isGitControlSegment(segment) {
  return segment.replace(/[. ]+$/gu, '').toLowerCase() === '.git';
}

let resolvedGitExecutable = null;

function trustedGitCandidates() {
  if (process.platform === 'win32') {
    const driveRoot = parse(process.execPath).root;
    return [
      join(driveRoot, 'Program Files', 'Git', 'cmd', 'git.exe'),
      join(driveRoot, 'Program Files', 'Git', 'bin', 'git.exe'),
      join(driveRoot, 'Program Files (x86)', 'Git', 'cmd', 'git.exe'),
    ];
  }
  return ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git', '/opt/local/bin/git'];
}

export function trustedGitExecutable() {
  if (resolvedGitExecutable) return resolvedGitExecutable;
  for (const candidate of trustedGitCandidates()) {
    try {
      if (!isAbsolute(candidate)) continue;
      const stats = lstatSync(candidate, { bigint: true });
      if (!stats.isFile() || stats.isSymbolicLink()) continue;
      accessSync(candidate, FS_CONSTANTS.R_OK | FS_CONSTANTS.X_OK);
      const real = realpathSync(candidate);
      if (!isAbsolute(real)) continue;
      resolvedGitExecutable = real;
      return resolvedGitExecutable;
    } catch {
      // Continue through the fixed trusted installation candidates.
    }
  }
  throw new Error('no trusted absolute Git executable is installed');
}

export function trustedGitEnvironment(executable = trustedGitExecutable()) {
  const environment = {
    GIT_ATTR_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    LANG: 'C',
    LC_ALL: 'C',
  };
  if (process.platform === 'win32') {
    const windowsRoot = join(parse(process.execPath).root, 'Windows');
    environment.PATH = [dirname(executable), join(windowsRoot, 'System32'), windowsRoot].join(';');
    environment.SystemRoot = windowsRoot;
    environment.WINDIR = windowsRoot;
  } else {
    environment.PATH = [dirname(executable), '/usr/bin', '/bin'].join(':');
  }
  return environment;
}

export function runTrustedGit(root, args, options = {}) {
  const executable = trustedGitExecutable();
  const resolvedRoot = resolve(root);
  const {
    encoding = 'buffer',
    input = undefined,
    maxBuffer = MAX_GIT_STATUS_BYTES,
    timeout = 30_000,
  } = options;
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) {
    throw new TypeError('trusted Git arguments must be NUL-free strings');
  }
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 1) {
    throw new TypeError('trusted Git maxBuffer must be a positive safe integer');
  }
  return execFileSync(
    executable,
    [
      '--no-replace-objects',
      '-C',
      resolvedRoot,
      '-c',
      `safe.directory=${resolvedRoot}`,
      '-c',
      'core.fsmonitor=false',
      '-c',
      'core.untrackedCache=false',
      ...args,
    ],
    {
      cwd: resolvedRoot,
      env: trustedGitEnvironment(executable),
      encoding,
      input,
      maxBuffer,
      stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      timeout,
      windowsHide: true,
    },
  );
}

export function canonicalReleaseRepoPath(root, value) {
  const raw = String(value ?? '');
  if (!raw || raw.includes('\0') || raw.includes('\n') || raw.includes('\r')) {
    throw new Error('release input path is empty or contains a control character');
  }
  const normalized = raw.replaceAll('\\', '/').replace(/^\.\//u, '');
  const hasGitControlSegment = normalized.split('/').some(isGitControlSegment);
  if (
    normalized.startsWith('/') ||
    /^[a-z]:/iu.test(normalized) ||
    normalized.includes(':') ||
    Buffer.byteLength(normalized, 'utf8') > 4096 ||
    normalized.endsWith('/') ||
    path.posix.normalize(normalized) !== normalized ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    hasGitControlSegment
  ) {
    throw new Error('release input path must be one canonical repository-relative file');
  }
  const resolvedRoot = resolve(root);
  const absolute = resolve(resolvedRoot, ...normalized.split('/'));
  const prefix = `${resolvedRoot}${sep}`;
  if (!absolute.startsWith(prefix)) {
    throw new Error('release input path escapes the repository root');
  }
  return normalized;
}

export function readPinnedHeadSha(root) {
  const value = runTrustedGit(root, ['rev-parse', '--verify', 'HEAD^{commit}'])
    .toString('utf8')
    .trim();
  if (!FULL_GIT_SHA.test(value)) throw new Error('release snapshot HEAD is not a full SHA');
  return value;
}

function readHeadBlobs(
  root,
  headSha,
  repoPaths,
  {
    maxInputBytes = PHASE9_RELEASE_INPUT_MAX_BYTES,
    maxAggregateBytes = PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES,
  } = {},
) {
  if (!FULL_GIT_SHA.test(headSha)) throw new Error('release snapshot HEAD is invalid');
  if (
    !Number.isSafeInteger(maxInputBytes) ||
    maxInputBytes < 0 ||
    !Number.isSafeInteger(maxAggregateBytes) ||
    maxAggregateBytes < 0 ||
    maxInputBytes > maxAggregateBytes
  ) {
    throw new TypeError('release HEAD blob byte ceilings are invalid');
  }
  const input = Buffer.from(
    repoPaths.map((repoPath) => `${headSha}:${repoPath}\n`).join(''),
    'utf8',
  );
  const gitMaxBuffer = maxAggregateBytes + input.length + repoPaths.length * 128;
  if (!Number.isSafeInteger(gitMaxBuffer)) {
    throw new TypeError('release HEAD blob output ceiling is invalid');
  }
  const output = runTrustedGit(root, ['cat-file', '--batch'], {
    input,
    maxBuffer: gitMaxBuffer,
  });
  const records = new Map();
  let offset = 0;
  let aggregateBytes = 0;

  for (const repoPath of repoPaths) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error('git cat-file returned a truncated header');
    const header = output.subarray(offset, newline).toString('utf8');
    offset = newline + 1;
    if (header.endsWith(' missing')) {
      records.set(repoPath, null);
      continue;
    }
    const match = header.match(/^([0-9a-f]{40}) blob ([0-9]+)$/u);
    if (!match) throw new Error('git cat-file returned a non-blob release input');
    const size = Number(match[2]);
    aggregateBytes += size;
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > maxInputBytes ||
      aggregateBytes > maxAggregateBytes ||
      offset + size >= output.length
    ) {
      throw new Error('git cat-file returned an invalid release input length');
    }
    const bytes = Buffer.from(output.subarray(offset, offset + size));
    offset += size;
    if (output[offset] !== 0x0a) throw new Error('git cat-file omitted a blob terminator');
    offset += 1;
    records.set(repoPath, { bytes, gitObjectId: match[1], sha256: sha256(bytes) });
  }
  if (offset !== output.length) throw new Error('git cat-file returned unexpected trailing bytes');
  return records;
}

function canonicalFsPath(value) {
  const real = realpathSync(value);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function pathInsideRoot(realRoot, candidate) {
  const canonicalCandidate = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
  return canonicalCandidate === realRoot || canonicalCandidate.startsWith(`${realRoot}${sep}`);
}

function realPathUsesGitControlSegment(realRoot, candidate) {
  if (!pathInsideRoot(realRoot, candidate) || candidate === realRoot) return false;
  return candidate
    .slice(realRoot.length + 1)
    .split(/[\\/]/u)
    .some(isGitControlSegment);
}

function statIdentity(stats) {
  return [
    stats.dev,
    stats.ino,
    stats.mode,
    stats.nlink,
    stats.size,
    stats.mtimeNs,
    stats.ctimeNs,
    stats.birthtimeNs,
  ].join(':');
}

function directoryObjectIdentity(stats) {
  return [stats.dev, stats.ino, stats.mode, stats.birthtimeNs].join(':');
}

function fileObjectIdentity(stats) {
  return [stats.dev, stats.ino, stats.mode].join(':');
}

function captureRootDirectoryBinding(root) {
  const resolvedRoot = resolve(root);
  const stats = lstatSync(resolvedRoot, { bigint: true });
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error('release repository root must be a real directory');
  }
  return {
    identity: directoryObjectIdentity(stats),
    real: canonicalFsPath(resolvedRoot),
    resolvedRoot,
  };
}

function assertRootDirectoryBinding(binding) {
  const stats = lstatSync(binding.resolvedRoot, { bigint: true });
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    directoryObjectIdentity(stats) !== binding.identity ||
    canonicalFsPath(binding.resolvedRoot) !== binding.real
  ) {
    throw new Error('release repository root identity changed during packet assembly');
  }
}

function inspectAncestorChain(root, repoPath) {
  const resolvedRoot = resolve(root);
  const realRoot = canonicalFsPath(resolvedRoot);
  const segments = repoPath.split('/');
  segments.pop();
  let current = resolvedRoot;
  const records = [];
  for (const segment of segments) {
    current = resolve(current, segment);
    const stats = lstatSync(current, { bigint: true });
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('unsafe-ancestor');
    }
    const real = canonicalFsPath(current);
    if (!pathInsideRoot(realRoot, real)) throw new Error('outside-root');
    if (realPathUsesGitControlSegment(realRoot, real)) throw new Error('unsafe-ancestor');
    records.push({ identity: statIdentity(stats), real });
  }
  return { realRoot, records };
}

function sameAncestorChain(before, after) {
  return (
    before.realRoot === after.realRoot &&
    before.records.length === after.records.length &&
    before.records.every(
      (record, index) =>
        record.identity === after.records[index].identity &&
        record.real === after.records[index].real,
    )
  );
}

export function readStableRootBoundWorkingFile(
  root,
  repoPath,
  { maxBytes = PHASE9_RELEASE_INPUT_MAX_BYTES, onPhase = null } = {},
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError('working-file byte ceiling must be a non-negative safe integer');
  }
  const resolvedRoot = resolve(root);
  const normalized = canonicalReleaseRepoPath(resolvedRoot, repoPath);
  const absolute = resolve(resolvedRoot, ...normalized.split('/'));
  let descriptor = null;
  try {
    const ancestorsBefore = inspectAncestorChain(resolvedRoot, normalized);
    const pathBefore = lstatSync(absolute, { bigint: true });
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink() || pathBefore.nlink !== 1n) {
      return { bytes: null, kind: 'not-regular', sha256: null };
    }
    if (pathBefore.size > BigInt(maxBytes)) {
      return { bytes: null, kind: 'too-large', sha256: null };
    }
    const realBefore = canonicalFsPath(absolute);
    if (!pathInsideRoot(ancestorsBefore.realRoot, realBefore)) {
      return { bytes: null, kind: 'outside-root', sha256: null };
    }
    const noFollow = FS_CONSTANTS.O_NOFOLLOW ?? 0;
    descriptor = openSync(absolute, FS_CONSTANTS.O_RDONLY | noFollow);
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    if (
      !descriptorBefore.isFile() ||
      descriptorBefore.nlink !== 1n ||
      statIdentity(descriptorBefore) !== statIdentity(pathBefore) ||
      descriptorBefore.size > BigInt(maxBytes)
    ) {
      return { bytes: null, kind: 'unstable', sha256: null };
    }
    onPhase?.('after-open');
    const size = Number(descriptorBefore.size);
    const bytes = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const read = readSync(descriptor, bytes, offset, size - offset, offset);
      if (read === 0) return { bytes: null, kind: 'unstable', sha256: null };
      offset += read;
    }
    if (readSync(descriptor, Buffer.allocUnsafe(1), 0, 1, size) !== 0) {
      return { bytes: null, kind: 'unstable', sha256: null };
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolute, { bigint: true });
    const ancestorsAfter = inspectAncestorChain(resolvedRoot, normalized);
    const realAfter = canonicalFsPath(absolute);
    if (
      statIdentity(descriptorBefore) !== statIdentity(descriptorAfter) ||
      statIdentity(pathBefore) !== statIdentity(pathAfter) ||
      statIdentity(descriptorAfter) !== statIdentity(pathAfter) ||
      realBefore !== realAfter ||
      !sameAncestorChain(ancestorsBefore, ancestorsAfter)
    ) {
      return { bytes: null, kind: 'unstable', sha256: null };
    }
    return { bytes, kind: 'file', sha256: sha256(bytes) };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return { bytes: null, kind: 'missing', sha256: null };
    }
    if (error?.message === 'unsafe-ancestor') {
      return { bytes: null, kind: 'unsafe-ancestor', sha256: null };
    }
    if (error?.message === 'outside-root') {
      return { bytes: null, kind: 'outside-root', sha256: null };
    }
    return { bytes: null, kind: 'unreadable', sha256: null };
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

export function hashStableRootBoundWorkingFile(
  root,
  repoPath,
  { expectedSizeBytes = null, onPhase = null } = {},
) {
  if (
    expectedSizeBytes !== null &&
    (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes < 0)
  ) {
    throw new TypeError('expected working-file size must be a non-negative safe integer');
  }
  const resolvedRoot = resolve(root);
  const normalized = canonicalReleaseRepoPath(resolvedRoot, repoPath);
  const absolute = resolve(resolvedRoot, ...normalized.split('/'));
  let descriptor = null;
  try {
    const ancestorsBefore = inspectAncestorChain(resolvedRoot, normalized);
    const pathBefore = lstatSync(absolute, { bigint: true });
    if (!pathBefore.isFile() || pathBefore.isSymbolicLink() || pathBefore.nlink !== 1n) {
      return { identity: null, kind: 'not-regular', sha256: null, sizeBytes: null };
    }
    if (expectedSizeBytes !== null && pathBefore.size !== BigInt(expectedSizeBytes)) {
      return { identity: null, kind: 'size-mismatch', sha256: null, sizeBytes: null };
    }
    const realBefore = canonicalFsPath(absolute);
    if (!pathInsideRoot(ancestorsBefore.realRoot, realBefore)) {
      return { identity: null, kind: 'outside-root', sha256: null, sizeBytes: null };
    }
    const noFollow = FS_CONSTANTS.O_NOFOLLOW ?? 0;
    descriptor = openSync(absolute, FS_CONSTANTS.O_RDONLY | noFollow);
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    if (
      !descriptorBefore.isFile() ||
      descriptorBefore.nlink !== 1n ||
      statIdentity(descriptorBefore) !== statIdentity(pathBefore)
    ) {
      return { identity: null, kind: 'unstable', sha256: null, sizeBytes: null };
    }
    const sizeBytes = Number(descriptorBefore.size);
    if (!Number.isSafeInteger(sizeBytes)) {
      return { identity: null, kind: 'too-large', sha256: null, sizeBytes: null };
    }
    onPhase?.('after-open', normalized);
    const digest = createHash('sha256');
    const chunk = Buffer.allocUnsafe(64 * 1024);
    let offset = 0;
    while (offset < sizeBytes) {
      const length = Math.min(chunk.length, sizeBytes - offset);
      const read = readSync(descriptor, chunk, 0, length, offset);
      if (read === 0) {
        return { identity: null, kind: 'unstable', sha256: null, sizeBytes: null };
      }
      digest.update(chunk.subarray(0, read));
      offset += read;
    }
    if (readSync(descriptor, chunk, 0, 1, sizeBytes) !== 0) {
      return { identity: null, kind: 'unstable', sha256: null, sizeBytes: null };
    }
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolute, { bigint: true });
    const ancestorsAfter = inspectAncestorChain(resolvedRoot, normalized);
    const realAfter = canonicalFsPath(absolute);
    if (
      statIdentity(descriptorBefore) !== statIdentity(descriptorAfter) ||
      statIdentity(pathBefore) !== statIdentity(pathAfter) ||
      statIdentity(descriptorAfter) !== statIdentity(pathAfter) ||
      realBefore !== realAfter ||
      !sameAncestorChain(ancestorsBefore, ancestorsAfter)
    ) {
      return { identity: null, kind: 'unstable', sha256: null, sizeBytes: null };
    }
    return {
      identity: statIdentity(descriptorAfter),
      kind: 'file',
      sha256: digest.digest('hex'),
      sizeBytes,
    };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return { identity: null, kind: 'missing', sha256: null, sizeBytes: null };
    }
    if (error?.message === 'unsafe-ancestor') {
      return { identity: null, kind: 'unsafe-ancestor', sha256: null, sizeBytes: null };
    }
    if (error?.message === 'outside-root') {
      return { identity: null, kind: 'outside-root', sha256: null, sizeBytes: null };
    }
    return { identity: null, kind: 'unreadable', sha256: null, sizeBytes: null };
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function statusPathspec(repoPath) {
  return `:(exclude,literal)${repoPath}`;
}

export function readNulGitStatus(root, excludedPaths = []) {
  const exclusions = [
    ...new Set(excludedPaths.map((value) => canonicalReleaseRepoPath(root, value))),
  ];
  return runTrustedGit(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
    '--ignore-submodules=none',
    '--',
    '.',
    ...exclusions.map(statusPathspec),
  ]);
}

export function parseNulGitStatus(statusBytes) {
  const fields = Buffer.from(statusBytes).toString('utf8').split('\0');
  if (fields.at(-1) === '') fields.pop();
  const entries = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.length < 4 || field[2] !== ' ') {
      entries.push({ status: '??', path: '<malformed-status-entry>' });
      continue;
    }
    const status = field.slice(0, 2);
    const entry = { status, path: field.slice(3) };
    if (/[RC]/u.test(status)) {
      entry.from = fields[index + 1] ?? '<missing-rename-source>';
      index += 1;
    }
    entries.push(entry);
  }
  return entries;
}

function statusDisplay(entries) {
  return entries
    .map(
      (entry) =>
        `${entry.status} ${JSON.stringify(entry.path)}${entry.from ? ` from ${JSON.stringify(entry.from)}` : ''}`,
    )
    .join('\n');
}

function decodeBoundedNulRecords(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_GIT_INDEX_BYTES) {
    throw new Error(`${label} is empty or exceeds its byte ceiling`);
  }
  if (bytes.at(-1) !== 0) throw new Error(`${label} is not NUL-terminated`);
  let decoded;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
  const records = decoded.slice(0, -1).split('\0');
  if (records.some((record) => record.length === 0)) {
    throw new Error(`${label} contains an empty record`);
  }
  return records;
}

function assertUniqueIndexPaths(paths, label) {
  const portablePaths = new Map();
  for (const repoPath of paths) {
    const key = repoPath.normalize('NFC').toLowerCase();
    if (portablePaths.has(key)) {
      throw new Error(`${label} contains a duplicate or portable path collision`);
    }
    portablePaths.set(key, repoPath);
  }
}

export function readNormalGitIndexSnapshot(root) {
  const resolvedRoot = resolve(root);
  const flagBytes = runTrustedGit(resolvedRoot, ['ls-files', '-v', '-z', '--cached'], {
    maxBuffer: MAX_GIT_INDEX_BYTES,
  });
  const stageBytes = runTrustedGit(resolvedRoot, ['ls-files', '--stage', '-z'], {
    maxBuffer: MAX_GIT_INDEX_BYTES,
  });
  const flagPaths = decodeBoundedNulRecords(flagBytes, 'Git index flag inventory').map((record) => {
    if (!record.startsWith('H ') || record.length <= 2) {
      throw new Error('Git index contains a non-normal flag entry');
    }
    return canonicalReleaseRepoPath(resolvedRoot, record.slice(2));
  });
  const stagePaths = decodeBoundedNulRecords(stageBytes, 'Git index stage inventory').map(
    (record) => {
      const match = /^(100644|100755|120000|160000) ([0-9a-f]{40,64}) 0\t([\s\S]+)$/u.exec(record);
      if (!match || /^0+$/u.test(match?.[2] ?? '')) {
        throw new Error('Git index contains a non-normal stage entry');
      }
      return canonicalReleaseRepoPath(resolvedRoot, match[3]);
    },
  );
  assertUniqueIndexPaths(flagPaths, 'Git index flag inventory');
  assertUniqueIndexPaths(stagePaths, 'Git index stage inventory');
  if (
    flagPaths.length !== stagePaths.length ||
    flagPaths.some((repoPath, index) => repoPath !== stagePaths[index])
  ) {
    throw new Error('Git index flag and stage inventories do not match');
  }
  return {
    flagBytes: Buffer.from(flagBytes),
    flagSha256: sha256(flagBytes),
    stageBytes: Buffer.from(stageBytes),
    stageSha256: sha256(stageBytes),
  };
}

export function captureReleaseQaSnapshot({
  root,
  inputPaths,
  outputPaths,
  expectedHeadSha = null,
  workingInputPaths = [],
  maxInputBytes = PHASE9_RELEASE_INPUT_MAX_BYTES,
  maxAggregateInputBytes = PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES,
  optionalWorkingInputMaxBytes = PHASE9_RELEASE_OPTIONAL_INPUT_MAX_BYTES,
}) {
  if (
    !Number.isSafeInteger(maxInputBytes) ||
    maxInputBytes < 0 ||
    !Number.isSafeInteger(maxAggregateInputBytes) ||
    maxAggregateInputBytes < 0 ||
    !Number.isSafeInteger(optionalWorkingInputMaxBytes) ||
    optionalWorkingInputMaxBytes < 0 ||
    maxInputBytes > maxAggregateInputBytes ||
    optionalWorkingInputMaxBytes > maxAggregateInputBytes
  ) {
    throw new TypeError('release snapshot byte ceilings are invalid');
  }
  const resolvedRoot = resolve(root);
  const rootBinding = captureRootDirectoryBinding(resolvedRoot);
  const normalizedInputs = [
    ...new Set(inputPaths.map((value) => canonicalReleaseRepoPath(resolvedRoot, value))),
  ];
  const normalizedOutputs = [
    ...new Set(outputPaths.map((value) => canonicalReleaseRepoPath(resolvedRoot, value))),
  ];
  const normalizedWorkingInputs = [
    ...new Set(workingInputPaths.map((value) => canonicalReleaseRepoPath(resolvedRoot, value))),
  ].filter((repoPath) => !normalizedInputs.includes(repoPath));
  const headSha = readPinnedHeadSha(resolvedRoot);
  if (
    expectedHeadSha !== null &&
    (!FULL_GIT_SHA.test(expectedHeadSha) || headSha !== expectedHeadSha)
  ) {
    throw new Error('release snapshot HEAD does not match the expected commit');
  }
  const statusBytes = readNulGitStatus(resolvedRoot, normalizedOutputs);
  const indexSnapshot = readNormalGitIndexSnapshot(resolvedRoot);
  const headBlobs = readHeadBlobs(resolvedRoot, headSha, normalizedInputs, {
    maxAggregateBytes: maxAggregateInputBytes,
    maxInputBytes,
  });
  const records = {};
  const workingRecords = {};
  const integrityIssues = [];
  let aggregateWorkingBytes = 0;

  for (const repoPath of normalizedInputs) {
    const head = headBlobs.get(repoPath);
    const working = readStableRootBoundWorkingFile(resolvedRoot, repoPath, {
      maxBytes: maxInputBytes,
    });
    aggregateWorkingBytes += working.bytes?.length ?? 0;
    if (aggregateWorkingBytes > maxAggregateInputBytes) {
      throw new Error('release working inputs exceed the aggregate byte ceiling');
    }
    const workingTreeMatchesHead = Boolean(
      head && working.bytes && head.bytes.equals(working.bytes),
    );
    const retainedWorkingBytes = workingTreeMatchesHead ? head.bytes : working.bytes;
    records[repoPath] = {
      gitObjectId: head?.gitObjectId ?? null,
      headBytes: head?.bytes ?? null,
      headSha256: head?.sha256 ?? null,
      workingBytes: retainedWorkingBytes,
      workingKind: working.kind,
      workingSha256: working.sha256,
      workingTreeMatchesHead,
    };
    if (!head) integrityIssues.push(`${repoPath} does not exist as a blob in pinned HEAD`);
    if (working.kind !== 'file') {
      integrityIssues.push(`${repoPath} is ${working.kind} in the working tree`);
    } else if (!workingTreeMatchesHead) {
      integrityIssues.push(`${repoPath} working bytes do not match pinned HEAD`);
    }
  }

  for (const repoPath of normalizedWorkingInputs) {
    const working = readStableRootBoundWorkingFile(resolvedRoot, repoPath, {
      maxBytes: optionalWorkingInputMaxBytes,
    });
    aggregateWorkingBytes += working.bytes?.length ?? 0;
    if (aggregateWorkingBytes > maxAggregateInputBytes) {
      throw new Error('release working inputs exceed the aggregate byte ceiling');
    }
    workingRecords[repoPath] = working;
    if (!['file', 'missing'].includes(working.kind)) {
      integrityIssues.push(`${repoPath} optional working input is ${working.kind}`);
    }
  }

  const gitStatusEntries = parseNulGitStatus(statusBytes);
  assertRootDirectoryBinding(rootBinding);
  return {
    root: resolvedRoot,
    rootBinding,
    headSha,
    inputPaths: normalizedInputs,
    workingInputPaths: normalizedWorkingInputs,
    outputPaths: normalizedOutputs,
    records,
    workingRecords,
    integrityIssues,
    indexFlagBytes: indexSnapshot.flagBytes,
    indexFlagSha256: indexSnapshot.flagSha256,
    indexStageBytes: indexSnapshot.stageBytes,
    indexStageSha256: indexSnapshot.stageSha256,
    gitStatus: statusDisplay(gitStatusEntries),
    gitStatusEntries,
    gitStatusSha256: sha256(statusBytes),
    maxAggregateInputBytes,
    maxInputBytes,
    optionalWorkingInputMaxBytes,
    statusBytes,
  };
}

function sameOptionalBytes(left, right) {
  if (left === null || right === null) return left === right;
  return left.equals(right);
}

export function verifyReleaseQaSnapshot(snapshot) {
  const errors = [];
  try {
    assertRootDirectoryBinding(snapshot.rootBinding ?? captureRootDirectoryBinding(snapshot.root));
  } catch {
    errors.push('repository root identity changed during Phase 9 packet assembly');
  }
  let currentHeadSha = null;
  try {
    currentHeadSha = readPinnedHeadSha(snapshot.root);
    if (currentHeadSha !== snapshot.headSha)
      errors.push('Git HEAD changed during Phase 9 packet assembly');
  } catch {
    errors.push('Git HEAD could not be rechecked during Phase 9 packet assembly');
  }

  try {
    const currentStatus = readNulGitStatus(snapshot.root, snapshot.outputPaths);
    if (!currentStatus.equals(snapshot.statusBytes)) {
      errors.push('non-output NUL-delimited Git status changed during Phase 9 packet assembly');
    }
  } catch {
    errors.push('non-output Git status could not be rechecked during Phase 9 packet assembly');
  }

  try {
    const currentIndex = readNormalGitIndexSnapshot(snapshot.root);
    if (
      !currentIndex.flagBytes.equals(snapshot.indexFlagBytes) ||
      !currentIndex.stageBytes.equals(snapshot.indexStageBytes)
    ) {
      errors.push('complete Git index changed during Phase 9 packet assembly');
    }
  } catch {
    errors.push('complete normal Git index could not be rechecked during Phase 9 packet assembly');
  }

  let currentHeadBlobs = null;
  try {
    currentHeadBlobs = readHeadBlobs(snapshot.root, snapshot.headSha, snapshot.inputPaths, {
      maxAggregateBytes:
        snapshot.maxAggregateInputBytes ?? PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES,
      maxInputBytes: snapshot.maxInputBytes ?? PHASE9_RELEASE_INPUT_MAX_BYTES,
    });
  } catch {
    errors.push('pinned HEAD inputs could not be re-read during Phase 9 packet assembly');
  }
  for (const repoPath of snapshot.inputPaths) {
    const original = snapshot.records[repoPath];
    const currentHead = currentHeadBlobs?.get(repoPath) ?? null;
    if (!sameOptionalBytes(original.headBytes, currentHead?.bytes ?? null)) {
      errors.push(`${repoPath} pinned HEAD bytes changed during Phase 9 packet assembly`);
    }
    const currentWorking = readStableRootBoundWorkingFile(snapshot.root, repoPath, {
      maxBytes: snapshot.maxInputBytes ?? PHASE9_RELEASE_INPUT_MAX_BYTES,
    });
    if (
      original.workingKind !== currentWorking.kind ||
      !sameOptionalBytes(original.workingBytes, currentWorking.bytes)
    ) {
      errors.push(`${repoPath} working bytes changed during Phase 9 packet assembly`);
    }
  }
  for (const repoPath of snapshot.workingInputPaths ?? []) {
    const original = snapshot.workingRecords[repoPath];
    const current = readStableRootBoundWorkingFile(snapshot.root, repoPath, {
      maxBytes: snapshot.optionalWorkingInputMaxBytes ?? PHASE9_RELEASE_OPTIONAL_INPUT_MAX_BYTES,
    });
    if (original.kind !== current.kind || !sameOptionalBytes(original.bytes, current.bytes)) {
      errors.push(`${repoPath} optional working input changed during Phase 9 packet assembly`);
    }
  }
  try {
    assertRootDirectoryBinding(snapshot.rootBinding ?? captureRootDirectoryBinding(snapshot.root));
  } catch {
    errors.push('repository root identity changed during Phase 9 packet assembly');
  }
  return { errors: [...new Set(errors)], status: errors.length === 0 ? 'pass' : 'blocked' };
}

export function listPinnedHeadFiles(root, headSha, directory) {
  if (!FULL_GIT_SHA.test(headSha)) throw new TypeError('pinned tree SHA must be a full Git SHA');
  const normalizedDirectory = canonicalReleaseRepoPath(root, directory);
  const output = runTrustedGit(root, [
    'ls-tree',
    '-r',
    '-z',
    '--name-only',
    headSha,
    '--',
    normalizedDirectory,
  ]);
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((repoPath) => canonicalReleaseRepoPath(root, repoPath))
    .sort();
}

export function expectedReleaseCandidateMetadataPaths(root, releaseCandidateDir) {
  const normalized = canonicalReleaseRepoPath(root, releaseCandidateDir);
  if (!PHASE9_RELEASE_CANDIDATE_DIR.test(normalized)) {
    throw new TypeError('release candidate directory must be one strict non-template RC path');
  }
  return PHASE9_RELEASE_CANDIDATE_METADATA_FILE_NAMES.map(
    (fileName) => `${normalized}/${fileName}`,
  ).sort();
}

function exactManifestSourceSha(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  const matches = bytes
    .toString('utf8')
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .filter((line) => /^\|.*\|$/u.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length === 2 && cells[0] === 'Build-source Git SHA')
    .map((cells) => cells[1]);
  return matches.length === 1 && FULL_GIT_SHA.test(matches[0]) ? matches[0] : null;
}

function sameStringSetInOrder(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function evaluateReleaseCandidateReadiness({
  root,
  releaseCandidateDir,
  observedTrackedFiles,
  snapshot,
  configuredArchiveEvidencePath,
  configuredSourceGitSha,
  claimsComplete,
  auditGitContract,
  auditCrossBinding,
}) {
  const errors = [];
  let normalizedDir = null;
  let expectedFiles = [];
  try {
    normalizedDir = canonicalReleaseRepoPath(root, releaseCandidateDir);
    expectedFiles = expectedReleaseCandidateMetadataPaths(root, normalizedDir);
  } catch {
    errors.push('PHASE9_RELEASE_CANDIDATE_DIR must name one strict non-template RC directory');
  }

  let observedFiles = [];
  try {
    if (!Array.isArray(observedTrackedFiles)) throw new TypeError('not an array');
    observedFiles = observedTrackedFiles
      .map((repoPath) => canonicalReleaseRepoPath(root, repoPath))
      .sort();
    if (new Set(observedFiles).size !== observedFiles.length) throw new TypeError('duplicate path');
  } catch {
    errors.push('release-candidate tracked inventory is malformed');
  }
  const inventoryStatus =
    expectedFiles.length > 0 && sameStringSetInOrder(observedFiles, expectedFiles)
      ? 'pass'
      : 'blocked';
  if (inventoryStatus !== 'pass') {
    errors.push('release-candidate tracked inventory must exactly match the required metadata set');
  }

  const pinnedMetadataStatus =
    expectedFiles.length > 0 &&
    expectedFiles.every((repoPath) => {
      const record = snapshot?.records?.[repoPath];
      return (
        Buffer.isBuffer(record?.headBytes) &&
        record?.workingKind === 'file' &&
        record?.workingTreeMatchesHead === true &&
        SHA256.test(String(record?.headSha256 ?? ''))
      );
    })
      ? 'pass'
      : 'blocked';
  if (pinnedMetadataStatus !== 'pass') {
    errors.push('release-candidate metadata must be byte-pinned to regular files in HEAD');
  }

  if (claimsComplete !== true) {
    errors.push('all required external RC evidence and named signoff must be complete');
  }
  const expectedArchiveEvidencePath = normalizedDir
    ? `${normalizedDir}/ios-archive-privacy-evidence.json`
    : null;
  if (
    expectedArchiveEvidencePath === null ||
    configuredArchiveEvidencePath !== expectedArchiveEvidencePath
  ) {
    errors.push('the configured iOS archive evidence path must bind the selected RC index');
  }

  const manifestPath = normalizedDir ? `${normalizedDir}/manifest.md` : null;
  const manifestSourceGitSha = manifestPath
    ? exactManifestSourceSha(snapshot?.records?.[manifestPath]?.headBytes)
    : null;
  if (!manifestSourceGitSha) {
    errors.push('the pinned RC manifest must contain exactly one full build-source Git SHA');
  }
  if (!manifestSourceGitSha || configuredSourceGitSha !== manifestSourceGitSha) {
    errors.push('PHASE9_IOS_SOURCE_GIT_SHA must match the pinned RC manifest');
  }

  let gitContract = { errors: [], status: 'blocked' };
  let crossBinding = { status: 'blocked' };
  const staticPrerequisitesPass = errors.length === 0;
  if (staticPrerequisitesPass) {
    try {
      const audit = auditGitContract({
        root,
        sourceGitSha: manifestSourceGitSha,
        releaseCandidateDir: normalizedDir,
        requiredTrackedFiles: expectedFiles,
      });
      gitContract = {
        errors: validatorErrors(audit),
        headGitSha: FULL_GIT_SHA.test(String(audit?.headGitSha ?? '')) ? audit.headGitSha : null,
        status: audit?.status === 'pass' ? 'pass' : 'blocked',
      };
    } catch {
      gitContract = { errors: ['release-candidate Git contract threw'], status: 'blocked' };
    }
    if (gitContract.status !== 'pass') {
      errors.push('release-candidate Git contract did not pass');
      errors.push(...gitContract.errors.map((error) => `release-candidate Git contract: ${error}`));
    } else {
      try {
        const audit = auditCrossBinding({
          releaseCandidateDir: normalizedDir,
          sourceGitSha: manifestSourceGitSha,
        });
        crossBinding = { status: audit === true || audit?.status === 'pass' ? 'pass' : 'blocked' };
      } catch {
        crossBinding = { status: 'blocked' };
      }
      if (crossBinding.status !== 'pass') {
        errors.push('strict iOS archive/store cross-binding did not pass');
      }
    }
  }

  return {
    status: errors.length === 0 ? 'pass' : 'blocked',
    dir: normalizedDir,
    expectedFiles,
    observedTrackedFiles: observedFiles,
    inventoryStatus,
    pinnedMetadataStatus,
    manifestSourceGitSha,
    gitContract,
    crossBinding,
    errors: [...new Set(errors)],
  };
}

function rawEvidenceReferences(index) {
  if (
    index === null ||
    typeof index !== 'object' ||
    Array.isArray(index) ||
    index.archive?.file === undefined ||
    index.provenance?.easBuildLog === undefined ||
    index.artifacts === null ||
    typeof index.artifacts !== 'object' ||
    Array.isArray(index.artifacts)
  ) {
    throw new TypeError('pinned iOS archive evidence index is malformed');
  }
  const references = [
    index.archive.file,
    index.provenance.easBuildLog,
    ...Object.values(index.artifacts),
  ];
  if (references.length < 3) {
    throw new TypeError('pinned iOS archive evidence index has no raw artifact inventory');
  }
  return references;
}

export function captureReleaseCandidateRawEvidenceBindings({
  root,
  releaseCandidateDir,
  indexBytes,
  onFilePhase = null,
}) {
  const normalizedDir = canonicalReleaseRepoPath(root, releaseCandidateDir);
  if (!PHASE9_RELEASE_CANDIDATE_DIR.test(normalizedDir)) {
    throw new TypeError('raw evidence binding requires one strict RC directory');
  }
  if (!Buffer.isBuffer(indexBytes) || indexBytes.length > PHASE9_RELEASE_INPUT_MAX_BYTES) {
    throw new TypeError('raw evidence binding requires one bounded pinned index');
  }
  let index;
  try {
    index = JSON.parse(indexBytes.toString('utf8'));
  } catch {
    throw new TypeError('pinned iOS archive evidence index is not valid JSON');
  }
  const records = {};
  const evidencePrefix = `${normalizedDir}/evidence/ios/`;
  for (const reference of rawEvidenceReferences(index)) {
    if (
      reference === null ||
      typeof reference !== 'object' ||
      Array.isArray(reference) ||
      !SHA256.test(String(reference.sha256 ?? '')) ||
      !Number.isSafeInteger(reference.sizeBytes) ||
      reference.sizeBytes < 0
    ) {
      throw new TypeError('pinned iOS archive evidence reference is malformed');
    }
    const repoPath = canonicalReleaseRepoPath(root, reference.path);
    if (!repoPath.startsWith(evidencePrefix) || Object.hasOwn(records, repoPath)) {
      throw new TypeError('raw iOS evidence paths must be unique and RC-confined');
    }
    const actual = hashStableRootBoundWorkingFile(root, repoPath, {
      expectedSizeBytes: reference.sizeBytes,
      onPhase: onFilePhase,
    });
    if (
      actual.kind !== 'file' ||
      actual.sha256 !== reference.sha256 ||
      actual.sizeBytes !== reference.sizeBytes
    ) {
      throw new Error(`raw iOS evidence binding failed for ${repoPath}`);
    }
    records[repoPath] = {
      identity: actual.identity,
      sha256: reference.sha256,
      sizeBytes: reference.sizeBytes,
    };
  }
  return {
    root: resolve(root),
    releaseCandidateDir: normalizedDir,
    records,
  };
}

export function verifyReleaseCandidateRawEvidenceBindings(binding) {
  const errors = [];
  if (
    binding === null ||
    typeof binding !== 'object' ||
    !binding.root ||
    !binding.records ||
    Object.keys(binding.records).length < 3
  ) {
    return { errors: ['raw iOS evidence binding is missing'], status: 'blocked' };
  }
  for (const [repoPath, expected] of Object.entries(binding.records)) {
    const actual = hashStableRootBoundWorkingFile(binding.root, repoPath, {
      expectedSizeBytes: expected.sizeBytes,
    });
    if (
      actual.kind !== 'file' ||
      actual.identity !== expected.identity ||
      actual.sha256 !== expected.sha256 ||
      actual.sizeBytes !== expected.sizeBytes
    ) {
      errors.push(`${repoPath} raw evidence changed during Phase 9 packet assembly`);
    }
  }
  return { errors, status: errors.length === 0 ? 'pass' : 'blocked' };
}

function validatorErrors(value) {
  return Array.isArray(value?.errors)
    ? value.errors.filter((error) => typeof error === 'string' && error.length > 0).slice(0, 100)
    : [];
}

export function evaluateCat07ReleaseEvidence({
  expectedHeadSha,
  snapshot,
  validateCommitted,
  validateFull,
}) {
  const errors = [];
  let committed;
  let full;
  try {
    committed = validateCommitted(snapshot.root, { expectedHeadSha });
  } catch {
    committed = { errors: ['committed CAT07 validator threw'], headSha: null, status: 'blocked' };
  }
  try {
    full = validateFull(snapshot.root, { expectedHeadSha });
  } catch {
    full = { errors: ['full CAT07 validator threw'], headSha: null, status: 'blocked' };
  }

  if (committed?.status !== 'pass') errors.push('CAT07 committed evidence validator did not pass');
  if (full?.status !== 'pass') errors.push('CAT07 full evidence contract validator did not pass');
  if (committed?.headSha !== expectedHeadSha) {
    errors.push('CAT07 committed evidence validator was not bound to the pinned HEAD');
  }
  if (full?.headSha !== expectedHeadSha) {
    errors.push('CAT07 full evidence validator was not bound to the pinned HEAD');
  }

  const boundInputHashes = Object.fromEntries(
    PHASE9_CAT07_BOUND_INPUT_PATHS.map((repoPath) => [
      repoPath,
      snapshot.records[repoPath]?.headSha256 ?? null,
    ]),
  );
  for (const [repoPath, digest] of Object.entries(boundInputHashes)) {
    if (!SHA256.test(String(digest ?? ''))) {
      errors.push(`${repoPath} is not hash-bound to pinned HEAD`);
    }
  }
  for (const [label, actual, repoPath] of [
    ['summary', committed?.summarySha256, CAT07_COMMITTED_SUMMARY_PATH],
    ['manifest JSON', committed?.manifestSha256, CAT07_COMMITTED_MANIFEST_JSON_PATH],
    ['manifest Markdown', committed?.markdownSha256, CAT07_COMMITTED_MANIFEST_MD_PATH],
  ]) {
    if (actual !== boundInputHashes[repoPath]) {
      errors.push(`CAT07 ${label} validator hash does not match the pinned HEAD input`);
    }
  }
  errors.push(...validatorErrors(committed).map((error) => `CAT07 committed evidence: ${error}`));
  errors.push(...validatorErrors(full).map((error) => `CAT07 full evidence contract: ${error}`));

  return {
    status: errors.length === 0 ? 'pass' : 'blocked',
    expectedHeadSha,
    committed: {
      status: committed?.status === 'pass' ? 'pass' : 'blocked',
      headSha: committed?.headSha ?? null,
      summarySha256: committed?.summarySha256 ?? null,
      manifestSha256: committed?.manifestSha256 ?? null,
      markdownSha256: committed?.markdownSha256 ?? null,
      errors: validatorErrors(committed),
    },
    full: {
      status: full?.status === 'pass' ? 'pass' : 'blocked',
      headSha: full?.headSha ?? null,
      errors: validatorErrors(full),
    },
    boundInputHashes,
    errors: [...new Set(errors)],
  };
}

function prepareOutputBinding(rootBinding, repoPath) {
  assertRootDirectoryBinding(rootBinding);
  const normalized = canonicalReleaseRepoPath(rootBinding.resolvedRoot, repoPath);
  const segments = normalized.split('/');
  segments.pop();
  let current = rootBinding.resolvedRoot;
  const parentRecords = [];
  for (const segment of segments) {
    assertRootDirectoryBinding(rootBinding);
    current = resolve(current, segment);
    let stats;
    try {
      stats = lstatSync(current, { bigint: true });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      mkdirSync(current, { mode: 0o700 });
      stats = lstatSync(current, { bigint: true });
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('release packet output parent is not a regular repository directory');
    }
    const real = canonicalFsPath(current);
    if (
      !pathInsideRoot(rootBinding.real, real) ||
      realPathUsesGitControlSegment(rootBinding.real, real)
    ) {
      throw new Error('release packet output parent escapes the repository root');
    }
    parentRecords.push({
      absolute: current,
      identity: directoryObjectIdentity(stats),
      real,
    });
    assertRootDirectoryBinding(rootBinding);
  }
  return {
    absolute: resolve(rootBinding.resolvedRoot, ...normalized.split('/')),
    normalized,
    parentRecords,
    rootBinding,
  };
}

function assertOutputParentBinding(binding) {
  assertRootDirectoryBinding(binding.rootBinding);
  for (const record of binding.parentRecords) {
    const stats = lstatSync(record.absolute, { bigint: true });
    if (
      !stats.isDirectory() ||
      stats.isSymbolicLink() ||
      directoryObjectIdentity(stats) !== record.identity ||
      canonicalFsPath(record.absolute) !== record.real
    ) {
      throw new Error('release packet output parent identity changed during publication');
    }
  }
  assertRootDirectoryBinding(binding.rootBinding);
}

function assertBoundRegularOutputFile(binding, absolute, expectedIdentity = null) {
  assertOutputParentBinding(binding);
  const stats = lstatSync(absolute, { bigint: true });
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1n) {
    throw new Error('release packet output is not one regular single-link file');
  }
  if (expectedIdentity !== null && fileObjectIdentity(stats) !== expectedIdentity) {
    throw new Error('release packet output identity changed during publication');
  }
  const real = canonicalFsPath(absolute);
  if (
    !pathInsideRoot(binding.rootBinding.real, real) ||
    realPathUsesGitControlSegment(binding.rootBinding.real, real)
  ) {
    throw new Error('release packet output escapes the repository root');
  }
  assertOutputParentBinding(binding);
  return stats;
}

function assertReplaceableOutput(binding) {
  assertOutputParentBinding(binding);
  try {
    assertBoundRegularOutputFile(binding, binding.absolute);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

function removeBoundPath(binding, absolute, expectedIdentity = null) {
  try {
    assertOutputParentBinding(binding);
    const stats = lstatSync(absolute, { bigint: true });
    if (stats.isDirectory()) return;
    if (expectedIdentity !== null && fileObjectIdentity(stats) !== expectedIdentity) return;
    if (!stats.isSymbolicLink()) {
      const real = canonicalFsPath(absolute);
      if (!pathInsideRoot(binding.rootBinding.real, real)) return;
    }
    assertOutputParentBinding(binding);
    unlinkSync(absolute);
    assertOutputParentBinding(binding);
  } catch {
    // A failed cleanup is surfaced by the caller's fixed integrity error.
  }
}

function removeOutputs(outputBindings) {
  for (const binding of outputBindings) removeBoundPath(binding, binding.absolute);
}

function createBoundTemporaryOutput(binding, bytes, onPhase) {
  assertOutputParentBinding(binding);
  const absolute = `${binding.absolute}.${process.pid}.${randomUUID()}.tmp`;
  onPhase?.('before-temporary-open', binding.normalized);
  assertOutputParentBinding(binding);
  let descriptor = null;
  let identity = null;
  let failed = false;
  try {
    const noFollow = FS_CONSTANTS.O_NOFOLLOW ?? 0;
    descriptor = openSync(
      absolute,
      FS_CONSTANTS.O_CREAT | FS_CONSTANTS.O_EXCL | FS_CONSTANTS.O_RDWR | noFollow,
      0o600,
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    identity = fileObjectIdentity(descriptorBefore);
    onPhase?.('after-temporary-open', binding.normalized, absolute);
    assertOutputParentBinding(binding);
    const pathBefore = lstatSync(absolute, { bigint: true });
    if (
      !descriptorBefore.isFile() ||
      descriptorBefore.nlink !== 1n ||
      fileObjectIdentity(descriptorBefore) !== fileObjectIdentity(pathBefore)
    ) {
      throw new Error('release packet temporary output identity is unstable');
    }
    const real = canonicalFsPath(absolute);
    if (
      !pathInsideRoot(binding.rootBinding.real, real) ||
      realPathUsesGitControlSegment(binding.rootBinding.real, real)
    ) {
      throw new Error('release packet temporary output escapes the repository root');
    }
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);

    const readback = Buffer.allocUnsafe(bytes.length);
    let offset = 0;
    while (offset < readback.length) {
      const count = readSync(descriptor, readback, offset, readback.length - offset, offset);
      if (count === 0) throw new Error('release packet temporary output readback was truncated');
      offset += count;
    }
    if (readSync(descriptor, Buffer.allocUnsafe(1), 0, 1, bytes.length) !== 0) {
      throw new Error('release packet temporary output grew during readback');
    }
    if (!readback.equals(bytes)) {
      throw new Error('release packet temporary output bytes failed readback');
    }

    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(absolute, { bigint: true });
    identity = fileObjectIdentity(descriptorAfter);
    if (
      descriptorAfter.size !== BigInt(bytes.length) ||
      identity !== fileObjectIdentity(descriptorBefore) ||
      identity !== fileObjectIdentity(pathAfter)
    ) {
      throw new Error('release packet temporary output changed during write');
    }
    assertOutputParentBinding(binding);
    return { absolute, binding, identity };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    if (failed && identity !== null) removeBoundPath(binding, absolute, identity);
  }
}

function publishBoundTemporaryOutput(temporary, onPhase) {
  const { binding } = temporary;
  onPhase?.('before-rename', binding.normalized);
  assertOutputParentBinding(binding);
  assertBoundRegularOutputFile(binding, temporary.absolute, temporary.identity);
  assertReplaceableOutput(binding);
  assertOutputParentBinding(binding);
  renameSync(temporary.absolute, binding.absolute);
  onPhase?.('after-rename', binding.normalized);
  const published = assertBoundRegularOutputFile(binding, binding.absolute, temporary.identity);
  return fileObjectIdentity(published);
}

function verifyPublishedOutputs(outputBindings, normalizedOutputs, publishedIdentities) {
  const errors = [];
  for (let index = 0; index < normalizedOutputs.length; index += 1) {
    const binding = outputBindings[index];
    const output = normalizedOutputs[index];
    try {
      assertBoundRegularOutputFile(binding, binding.absolute, publishedIdentities[index]);
      const readback = readStableRootBoundWorkingFile(
        binding.rootBinding.resolvedRoot,
        output.path,
        {
          maxBytes: output.bytes.length,
        },
      );
      if (readback.kind !== 'file' || !readback.bytes?.equals(output.bytes)) {
        throw new Error('published bytes do not exactly match the assembled packet');
      }
      assertBoundRegularOutputFile(binding, binding.absolute, publishedIdentities[index]);
    } catch (error) {
      errors.push(
        `${output.path} publication verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return errors;
}

export class ReleaseQaSnapshotDriftError extends Error {
  constructor(errors) {
    super(`Phase 9 release packet snapshot drift: ${errors.join('; ')}`);
    this.name = 'ReleaseQaSnapshotDriftError';
    this.errors = errors;
  }
}

export function atomicWriteReleaseQaOutputs({
  root,
  snapshot,
  outputs,
  onPhase = null,
  verifyAdditional = null,
}) {
  const resolvedRoot = resolve(root);
  const snapshotRoot = resolve(snapshot?.root ?? '');
  const comparable = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
  if (comparable(resolvedRoot) !== comparable(snapshotRoot)) {
    throw new Error('atomic release output root does not match the snapshotted repository root');
  }
  const normalizedOutputs = outputs.map(({ path: outputPath, bytes }) => ({
    path: canonicalReleaseRepoPath(root, outputPath),
    bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8'),
  }));
  const expected = new Set(snapshot.outputPaths);
  if (
    normalizedOutputs.length !== expected.size ||
    normalizedOutputs.some(({ path: outputPath }) => !expected.has(outputPath))
  ) {
    throw new Error('atomic release outputs do not exactly match the snapshotted output set');
  }

  const rootBinding = snapshot.rootBinding ?? captureRootDirectoryBinding(resolvedRoot);
  if (comparable(rootBinding.resolvedRoot) !== comparable(resolvedRoot)) {
    throw new Error('atomic release output root binding does not match the requested repository');
  }
  assertRootDirectoryBinding(rootBinding);
  const outputBindings = normalizedOutputs.map(({ path: outputPath }) =>
    prepareOutputBinding(rootBinding, outputPath),
  );
  const temporaryOutputs = [];
  const publishedIdentities = [];
  const preflight = verifyReleaseQaSnapshot(snapshot);
  if (verifyAdditional) preflight.errors.push(...verifyAdditional());
  try {
    assertRootDirectoryBinding(rootBinding);
    for (const binding of outputBindings) assertOutputParentBinding(binding);
  } catch (error) {
    preflight.errors.push(error instanceof Error ? error.message : String(error));
  }
  preflight.status = preflight.errors.length === 0 ? 'pass' : 'blocked';
  if (preflight.status !== 'pass') {
    removeOutputs(outputBindings);
    throw new ReleaseQaSnapshotDriftError(preflight.errors);
  }
  onPhase?.('after-preflight');

  try {
    assertRootDirectoryBinding(rootBinding);
    for (let index = 0; index < normalizedOutputs.length; index += 1) {
      const temporary = createBoundTemporaryOutput(
        outputBindings[index],
        normalizedOutputs[index].bytes,
        onPhase,
      );
      temporaryOutputs.push(temporary);
    }
    for (const temporary of temporaryOutputs) {
      publishedIdentities.push(publishBoundTemporaryOutput(temporary, onPhase));
    }
    onPhase?.('after-write');
    const postflight = verifyReleaseQaSnapshot(snapshot);
    if (verifyAdditional) postflight.errors.push(...verifyAdditional());
    onPhase?.('before-output-verification');
    postflight.errors.push(
      ...verifyPublishedOutputs(outputBindings, normalizedOutputs, publishedIdentities),
    );
    onPhase?.('after-output-verification');
    const finalSourceCheck = verifyReleaseQaSnapshot(snapshot);
    postflight.errors.push(...finalSourceCheck.errors);
    if (verifyAdditional) postflight.errors.push(...verifyAdditional());
    postflight.errors.push(
      ...verifyPublishedOutputs(outputBindings, normalizedOutputs, publishedIdentities),
    );
    postflight.errors = [...new Set(postflight.errors)];
    postflight.status = postflight.errors.length === 0 ? 'pass' : 'blocked';
    if (postflight.status !== 'pass') throw new ReleaseQaSnapshotDriftError(postflight.errors);
  } catch (error) {
    for (const temporary of temporaryOutputs) {
      removeBoundPath(temporary.binding, temporary.absolute, temporary.identity);
    }
    removeOutputs(outputBindings);
    throw error;
  }
}

export function pinnedSourceHashes(snapshot, repoPaths) {
  return Object.fromEntries(
    repoPaths
      .map((repoPath) => canonicalReleaseRepoPath(snapshot.root, repoPath))
      .filter((repoPath) => SHA256.test(String(snapshot.records[repoPath]?.headSha256 ?? '')))
      .map((repoPath) => [repoPath, snapshot.records[repoPath].headSha256]),
  );
}
