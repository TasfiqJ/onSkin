import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import {
  GOVERNED_EVIDENCE_AGGREGATE_MAX_BYTES,
  GOVERNED_EVIDENCE_ENTRY_MAX_BYTES,
  buildGovernedEvidenceLedger,
  canonicalGovernedEvidencePath,
  captureGovernedPublicationPolicy,
  governedEvidenceLedgerPath,
  governedEvidenceRoleForPath,
  renderGovernedEvidenceLedger,
} from '../launch/governed-evidence-chain.mjs';
import {
  atomicWriteReleaseQaOutputs,
  captureReleaseQaSnapshot,
  readStableRootBoundWorkingFile,
  runTrustedGit,
} from './release-qa-integrity.mjs';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/u;
const GIT_OBJECT_ID = /^[0-9a-f]{40,64}$/u;
const MAX_GIT_METADATA_BYTES = 64 * 1024 * 1024;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function utf8Compare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function pathIdentity(repoPath) {
  return repoPath.normalize('NFC').toLowerCase();
}

function assertNoPathCollisions(paths, label) {
  const seen = new Map();
  for (const repoPath of paths) {
    const identity = pathIdentity(repoPath);
    if (seen.has(identity)) {
      throw new Error(`${label} contains colliding paths: ${seen.get(identity)} and ${repoPath}`);
    }
    seen.set(identity, repoPath);
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} contains invalid UTF-8`);
  }
}

function parseNulRecords(bytes, label) {
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new Error(`${label} is not NUL terminated`);
  const records = [];
  let offset = 0;
  while (offset < bytes.length) {
    const end = bytes.indexOf(0, offset);
    if (end <= offset) throw new Error(`${label} contains an empty record`);
    records.push(decodeUtf8(bytes.subarray(offset, end), label));
    offset = end + 1;
  }
  return records;
}

function gitBuffer(root, args, options = {}) {
  return runTrustedGit(root, args, { maxBuffer: MAX_GIT_METADATA_BYTES, ...options });
}

function gitText(root, args) {
  return gitBuffer(root, args).toString('utf8');
}

function canonicalRealPath(value) {
  const real = realpathSync(value);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function captureExactRepositoryRoot(root) {
  const stat = lstatSync(root, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('evidence-ledger root must be a real directory');
  }
  const topLevel = gitText(root, ['rev-parse', '--show-toplevel']).trim();
  if (canonicalRealPath(topLevel) !== canonicalRealPath(root)) {
    throw new Error('supplied root is not the exact Git worktree root');
  }
  return {
    identity: [stat.dev, stat.ino, stat.mode].join(':'),
    realPath: canonicalRealPath(root),
    root,
  };
}

function assertRepositoryRootBinding(binding) {
  const stat = lstatSync(binding.root, { bigint: true });
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    [stat.dev, stat.ino, stat.mode].join(':') !== binding.identity ||
    canonicalRealPath(binding.root) !== binding.realPath
  ) {
    throw new Error('evidence-ledger repository root identity changed during assembly');
  }
}

function readHeadSha(root) {
  const value = gitText(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  if (!FULL_GIT_SHA.test(value)) throw new Error('Git HEAD is not one full SHA-1 commit ID');
  return value;
}

function readIndex(root) {
  const verboseBytes = gitBuffer(root, ['ls-files', '-v', '-z']);
  const verboseRecords = parseNulRecords(verboseBytes, 'Git index flags');
  if (verboseRecords.length === 0) throw new Error('Git index is empty');
  const paths = [];
  for (const record of verboseRecords) {
    if (!record.startsWith('H ') || record.length <= 2) {
      throw new Error(
        'Git index contains skip-worktree, assume-unchanged, or another non-normal entry',
      );
    }
    paths.push(canonicalGovernedEvidencePath(record.slice(2)));
  }
  assertNoPathCollisions(paths, 'Git index');

  const stageBytes = gitBuffer(root, ['ls-files', '--stage', '-z']);
  const stageRecords = parseNulRecords(stageBytes, 'Git staged index');
  const entries = new Map();
  for (const record of stageRecords) {
    const match = /^(\d{6}) ([0-9a-f]{40,64}) ([0-3])\t(.+)$/u.exec(record);
    if (!match) throw new Error('Git returned one malformed staged-index record');
    const repoPath = canonicalGovernedEvidencePath(match[4]);
    if (match[3] !== '0' || entries.has(repoPath)) {
      throw new Error('Git index contains an unmerged or duplicate path');
    }
    entries.set(repoPath, { mode: match[1], objectId: match[2] });
  }
  if (entries.size !== paths.length) throw new Error('Git index views do not exactly agree');
  return { entries, stageBytes, verboseBytes };
}

function readStagedPaths(root, sourceGitSha) {
  const records = parseNulRecords(
    gitBuffer(root, [
      'diff',
      '--cached',
      '--no-renames',
      '--no-ext-diff',
      '--no-textconv',
      '--name-only',
      '-z',
      sourceGitSha,
      '--',
    ]),
    'staged evidence diff',
  ).map(canonicalGovernedEvidencePath);
  if (records.length === 0) throw new Error('no direct evidence files are staged');
  if (new Set(records).size !== records.length)
    throw new Error('staged evidence diff is not unique');
  assertNoPathCollisions(records, 'staged evidence diff');
  return records.sort(utf8Compare);
}

function readUnstagedPaths(root) {
  return parseNulRecords(
    gitBuffer(root, [
      'diff',
      '--no-renames',
      '--no-ext-diff',
      '--no-textconv',
      '--name-only',
      '-z',
      '--',
    ]),
    'unstaged tracked diff',
  ).map(canonicalGovernedEvidencePath);
}

function readNonignoredUntrackedPaths(root, ledgerPath) {
  return parseNulRecords(
    gitBuffer(root, ['ls-files', '--others', '--exclude-standard', '-z', '--']),
    'nonignored untracked files',
  )
    .map(canonicalGovernedEvidencePath)
    .filter((repoPath) => repoPath !== ledgerPath)
    .sort(utf8Compare);
}

function readIndexBlobs(root, paths, { maxEntryBytes, maxAggregateBytes }) {
  const input = Buffer.from(paths.map((repoPath) => `:${repoPath}\n`).join(''), 'utf8');
  const maxBuffer = maxAggregateBytes + input.length + paths.length * 256;
  if (!Number.isSafeInteger(maxBuffer)) throw new TypeError('index-blob byte ceiling is invalid');
  const output = runTrustedGit(root, ['cat-file', '--batch'], { input, maxBuffer });
  const records = new Map();
  let offset = 0;
  let aggregateBytes = 0;
  for (const repoPath of paths) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error('Git returned a truncated staged-blob header');
    const header = decodeUtf8(output.subarray(offset, newline), 'staged-blob header');
    offset = newline + 1;
    if (header.endsWith(' missing')) throw new Error(`${repoPath} is missing from the Git index`);
    const match = /^([0-9a-f]{40,64}) blob ([0-9]+)$/u.exec(header);
    if (!match) throw new Error(`${repoPath} is not a staged Git blob`);
    const size = Number(match[2]);
    aggregateBytes += size;
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > maxEntryBytes ||
      aggregateBytes > maxAggregateBytes ||
      offset + size >= output.length
    ) {
      throw new Error('staged evidence exceeds its byte ceiling');
    }
    const bytes = Buffer.from(output.subarray(offset, offset + size));
    offset += size;
    if (output[offset] !== 0x0a) throw new Error('Git omitted a staged-blob terminator');
    offset += 1;
    records.set(repoPath, { bytes, objectId: match[1], sha256: sha256(bytes) });
  }
  if (offset !== output.length) throw new Error('Git returned trailing staged-blob bytes');
  return records;
}

function captureBuilderState({
  root,
  sourceGitSha,
  releaseCandidateDir,
  maxEntryBytes,
  maxAggregateBytes,
}) {
  const headGitSha = readHeadSha(root);
  if (headGitSha !== sourceGitSha) {
    throw new Error('ledger assembly requires HEAD to equal the build-source SHA');
  }
  const ledgerPath = governedEvidenceLedgerPath(releaseCandidateDir);
  const index = readIndex(root);
  if (index.entries.has(ledgerPath)) {
    throw new Error('selected RC evidence-chain.json must be absent from the source index');
  }
  const stagedPaths = readStagedPaths(root, sourceGitSha);
  if (stagedPaths.includes(ledgerPath)) {
    throw new Error('evidence-chain.json must not include or hash itself');
  }
  const unstagedPaths = readUnstagedPaths(root);
  if (unstagedPaths.length > 0) {
    throw new Error(`unstaged tracked changes are forbidden: ${unstagedPaths.join(', ')}`);
  }
  const untrackedPaths = readNonignoredUntrackedPaths(root, ledgerPath);
  if (untrackedPaths.length > 0) {
    throw new Error(
      `nonignored untracked files must be staged first: ${untrackedPaths.join(', ')}`,
    );
  }

  const entries = [];
  for (const repoPath of stagedPaths) {
    const indexEntry = index.entries.get(repoPath);
    if (!indexEntry || indexEntry.mode !== '100644' || !GIT_OBJECT_ID.test(indexEntry.objectId)) {
      throw new Error(`${repoPath} must be one added/modified normal 100644 staged blob`);
    }
    const role = governedEvidenceRoleForPath(repoPath, releaseCandidateDir);
    if (role === null)
      throw new Error(`${repoPath} is outside every governed direct-evidence root`);
    entries.push({ path: repoPath, role });
  }

  const blobs = readIndexBlobs(root, stagedPaths, { maxAggregateBytes, maxEntryBytes });
  for (const { path: repoPath } of entries) {
    if (blobs.get(repoPath)?.objectId !== index.entries.get(repoPath)?.objectId) {
      throw new Error(`${repoPath} staged blob identity changed during ledger assembly`);
    }
    const working = readStableRootBoundWorkingFile(root, repoPath, { maxBytes: maxEntryBytes });
    if (working.kind !== 'file' || !working.bytes?.equals(blobs.get(repoPath).bytes)) {
      throw new Error(`${repoPath} working bytes do not exactly match its staged blob`);
    }
  }

  const publicationPolicy = captureGovernedPublicationPolicy(root, sourceGitSha, {
    maxAggregateBytes,
    maxEntryBytes,
  });
  const ledger = buildGovernedEvidenceLedger({
    sourceGitSha,
    releaseCandidateDir,
    publicationPolicy,
    entries: entries.map(({ path: repoPath, role }) => ({
      role,
      path: repoPath,
      sha256: blobs.get(repoPath).sha256,
    })),
  });
  return {
    blobs,
    headGitSha,
    index,
    ledger,
    publicationPolicy,
    ledgerPath,
    stagedPaths,
  };
}

function compareBuilderState(original, current) {
  const errors = [];
  if (current.headGitSha !== original.headGitSha) errors.push('Git HEAD changed');
  if (!current.index.verboseBytes.equals(original.index.verboseBytes)) {
    errors.push('Git index flags or paths changed');
  }
  if (!current.index.stageBytes.equals(original.index.stageBytes)) {
    errors.push('Git staged index changed');
  }
  if (
    current.stagedPaths.length !== original.stagedPaths.length ||
    current.stagedPaths.some((repoPath, index) => repoPath !== original.stagedPaths[index])
  ) {
    errors.push('staged evidence path set changed');
  }
  for (const repoPath of original.stagedPaths) {
    const before = original.blobs.get(repoPath);
    const after = current.blobs.get(repoPath);
    if (!after || before.objectId !== after.objectId || !before.bytes.equals(after.bytes)) {
      errors.push(`${repoPath} staged evidence bytes changed`);
    }
  }
  if (JSON.stringify(current.publicationPolicy) !== JSON.stringify(original.publicationPolicy)) {
    errors.push('pinned S publication policy changed');
  }
  return errors;
}

export function buildEvidenceChainLedger({
  root: rootPath,
  sourceGitSha,
  releaseCandidateDir,
  maxEntryBytes = GOVERNED_EVIDENCE_ENTRY_MAX_BYTES,
  maxAggregateBytes = GOVERNED_EVIDENCE_AGGREGATE_MAX_BYTES,
  onPhase = null,
}) {
  if (!FULL_GIT_SHA.test(String(sourceGitSha ?? ''))) {
    throw new TypeError('sourceGitSha must be a lowercase 40-character Git SHA.');
  }
  if (
    !Number.isSafeInteger(maxEntryBytes) ||
    maxEntryBytes < 0 ||
    !Number.isSafeInteger(maxAggregateBytes) ||
    maxAggregateBytes < maxEntryBytes
  ) {
    throw new TypeError('evidence-ledger byte ceilings are invalid');
  }
  if (onPhase !== null && typeof onPhase !== 'function') {
    throw new TypeError('onPhase must be null or a function');
  }

  const root = resolve(rootPath);
  const rootBinding = captureExactRepositoryRoot(root);
  const original = captureBuilderState({
    maxAggregateBytes,
    maxEntryBytes,
    releaseCandidateDir,
    root,
    sourceGitSha,
  });
  assertRepositoryRootBinding(rootBinding);
  onPhase?.('after-builder-capture');
  assertRepositoryRootBinding(rootBinding);
  const ledgerBytes = renderGovernedEvidenceLedger(original.ledger);
  const snapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: [],
    outputPaths: [original.ledgerPath],
    expectedHeadSha: sourceGitSha,
    workingInputPaths: original.stagedPaths,
    maxInputBytes: maxEntryBytes,
    maxAggregateInputBytes: maxAggregateBytes,
    optionalWorkingInputMaxBytes: maxEntryBytes,
  });
  if (snapshot.integrityIssues.length > 0) {
    throw new Error(`staged evidence snapshot is invalid: ${snapshot.integrityIssues.join('; ')}`);
  }
  assertRepositoryRootBinding(rootBinding);

  const verifyAdditional = () => {
    try {
      const current = captureBuilderState({
        maxAggregateBytes,
        maxEntryBytes,
        releaseCandidateDir,
        root,
        sourceGitSha,
      });
      return compareBuilderState(original, current);
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
  };
  atomicWriteReleaseQaOutputs({
    root,
    snapshot,
    outputs: [{ path: original.ledgerPath, bytes: ledgerBytes }],
    onPhase(phase) {
      assertRepositoryRootBinding(rootBinding);
      onPhase?.(phase);
      assertRepositoryRootBinding(rootBinding);
    },
    verifyAdditional,
  });
  assertRepositoryRootBinding(rootBinding);

  return Object.freeze({
    schemaVersion: 1,
    kind: 'governed_evidence_chain_ledger_build',
    status: 'written',
    sourceGitSha,
    releaseCandidateDir: original.ledger.releaseCandidateDir,
    ledgerPath: original.ledgerPath,
    entryCount: original.ledger.entries.length,
    sourceSnapshotUnitCount: original.ledger.publicationPolicy.sourceSnapshotUnits.length,
    postEvidenceRequiredUnitCount:
      original.ledger.publicationPolicy.postEvidenceRequiredUnitIds.length,
    ledgerSha256: sha256(ledgerBytes),
  });
}

function selectConsistentEnvironmentValue(environment, names, label) {
  const configured = names
    .filter((name) => environment[name] !== undefined)
    .map((name) => ({ name, value: environment[name] }));
  if (configured.length > 1 && configured.some(({ value }) => value !== configured[0].value)) {
    throw new Error(`${label} environment aliases must agree exactly`);
  }
  return configured[0]?.value;
}

export function parseCliArguments(argv, environment) {
  let sourceGitSha = null;
  let releaseCandidateDir = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument.startsWith('--source-git-sha=')) {
      if (sourceGitSha !== null) throw new Error('--source-git-sha may be provided only once');
      sourceGitSha = argument.slice('--source-git-sha='.length);
    } else if (argument === '--source-git-sha') {
      if (sourceGitSha !== null || index + 1 >= argv.length) {
        throw new Error('--source-git-sha requires one value');
      }
      sourceGitSha = argv[(index += 1)];
    } else if (argument.startsWith('--release-candidate-dir=')) {
      if (releaseCandidateDir !== null) {
        throw new Error('--release-candidate-dir may be provided only once');
      }
      releaseCandidateDir = argument.slice('--release-candidate-dir='.length);
    } else if (argument === '--release-candidate-dir') {
      if (releaseCandidateDir !== null || index + 1 >= argv.length) {
        throw new Error('--release-candidate-dir requires one value');
      }
      releaseCandidateDir = argv[(index += 1)];
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  const environmentSourceGitSha = selectConsistentEnvironmentValue(
    environment,
    ['PHASE9_IOS_SOURCE_GIT_SHA', 'GOVERNED_EVIDENCE_SOURCE_GIT_SHA'],
    'source Git SHA',
  );
  const environmentReleaseCandidateDir = selectConsistentEnvironmentValue(
    environment,
    ['PHASE9_RELEASE_CANDIDATE_DIR', 'GOVERNED_EVIDENCE_RC_DIR'],
    'release-candidate directory',
  );
  return {
    sourceGitSha: sourceGitSha ?? environmentSourceGitSha,
    releaseCandidateDir: releaseCandidateDir ?? environmentReleaseCandidateDir,
  };
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  try {
    const options = parseCliArguments(process.argv.slice(2), process.env);
    const result = buildEvidenceChainLedger({ root: process.cwd(), ...options });
    process.stdout.write(
      `Wrote ${result.ledgerPath} with ${result.entryCount} immutable evidence bindings.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Evidence-chain ledger build blocked: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
