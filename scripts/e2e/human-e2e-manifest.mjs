#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { PNG } from 'pngjs';

import {
  applyCat07CaptureMarkerToRgba,
  assertCat07CaptureMarker,
  decodeStrictCat07Png,
  CAT07_MAX_SCREENSHOT_BYTES,
} from './cat07-png-contract.mjs';
import {
  classifyCat07ProjectedBrowserFailures,
  CAT07_BROWSER_EVIDENCE_SCHEMA_VERSION,
  CAT07_BROWSER_LAUNCH_SCHEMA_VERSION,
  CAT07_CAPTURE_ARTIFACT_ORDER,
  CAT07_CAPTURE_BINDING_SCHEMA_VERSION,
  CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION,
  CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION,
  CAT07_MAX_CDP_FRAME_BYTES,
  CAT07_MAX_BROWSER_EVENT_BYTES,
  CAT07_MAX_INPUT_CDP_BYTES,
  CAT07_MAX_INPUT_CDP_FRAMES,
  CAT07_MAX_RETAINED_BROWSER_EVENTS,
  CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION,
  cat07BrowserArguments,
  createCat07TrustedGitContext,
} from './cat07-shelf-freshness-audit.mjs';
import { renderHumanE2eManifestMarkdown } from './human-e2e-manifest-render.mjs';
import {
  HUMAN_E2E_REQUIRED_GATE_IDS,
  validateHumanE2eManifestReleaseRole,
} from './human-e2e-manifest-contract.mjs';
import {
  canonicalEvidenceJsonBytes,
  collectEvidenceDiagnosticPolicyFailures,
  collectEvidenceDiagnosticValueFailures,
  collectEvidenceTextArtifactHygieneFailures,
  inspectCanonicalEvidenceJson,
  readBoundedRegularFile,
} from './evidence-diagnostic-hygiene.mjs';
import {
  atomicWriteReleaseQaOutputs,
  captureReleaseQaSnapshot,
  hashStableRootBoundWorkingFile,
  readStableRootBoundWorkingFile,
  verifyReleaseQaSnapshot,
} from '../phase9/release-qa-integrity.mjs';
import {
  GOVERNED_DOWNSTREAM_GENERATED_PATHS,
  GOVERNED_DOWNSTREAM_PUBLICATION_UNITS,
  GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID,
  GOVERNED_LAUNCH_CONTRACT_PATH,
  GOVERNED_POST_E_PUBLICATION_DAG_EDGES,
  GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS,
  GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS,
  auditGovernedEvidenceChain,
  captureGovernedEvidenceWorkingBindings,
  captureGovernedPublicationPolicy,
  renderGovernedEvidenceLedger,
  validateGovernedEvidenceChainBinding,
  validateGovernedGeneratedPublication,
  verifyGovernedEvidenceWorkingBindings,
} from '../launch/governed-evidence-chain.mjs';

const root = process.cwd();
const HUMAN_EVIDENCE_FILE_MAX_BYTES = 64 * 1024 * 1024;
const HUMAN_EVIDENCE_AGGREGATE_MAX_BYTES = 512 * 1024 * 1024;
const args = new Set(process.argv.slice(2));
const dateArg = process.argv.find((arg) => arg.startsWith('--date='));
const expectedHeadShaArg = process.argv.find((arg) => arg.startsWith('--expected-head-sha='));
const strict = args.has('--strict');
const check = args.has('--check');
const manifestOutputPaths = Object.freeze([
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
]);
if (String(process.env.E2E_MANIFEST_OUT_DIR ?? '').trim().length > 0) {
  console.error('FAIL E2E_MANIFEST_OUT_DIR cannot redirect the governed human-E2E manifest.');
  process.exit(1);
}

function abs(path) {
  return resolve(root, path);
}

function rel(path) {
  return normalizeRepoPath(relative(root, path));
}

function normalizeRepoPath(path) {
  return String(path).replace(/\\/g, '/').replace(/^\.\//, '');
}

function gitArgs(commandArgs) {
  return ['-c', `safe.directory=${resolve(root)}`, ...commandArgs];
}

let cachedCat07GitContext = null;

function cat07TrustedGitContext() {
  if (!cachedCat07GitContext) cachedCat07GitContext = createCat07TrustedGitContext();
  cachedCat07GitContext.assertStable();
  return cachedCat07GitContext;
}

function cat07RunTrustedGit(
  commandArgs,
  {
    encoding = 'buffer',
    input = undefined,
    maxBuffer = 16 * 1024 * 1024,
    stdio = input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    timeout = 30_000,
  } = {},
) {
  if (
    !Array.isArray(commandArgs) ||
    commandArgs.some((argument) => typeof argument !== 'string' || argument.includes('\0'))
  ) {
    throw new Error('CAT07 trusted Git arguments must be NUL-free strings');
  }
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 1 || maxBuffer > 600 * 1024 * 1024) {
    throw new Error('CAT07 trusted Git output ceiling is invalid');
  }
  const context = cat07TrustedGitContext();
  let result;
  try {
    result = execFileSync(
      context.gitExecutable,
      gitArgs(['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...commandArgs]),
      {
        cwd: root,
        encoding,
        env: context.environment,
        input,
        maxBuffer,
        stdio,
        timeout,
        windowsHide: true,
      },
    );
  } finally {
    context.assertStable();
  }
  return result;
}

function validateCat07RepoPath(candidate, seen = null) {
  if (
    typeof candidate !== 'string' ||
    candidate.length < 1 ||
    candidate !== candidate.normalize('NFC') ||
    Buffer.byteLength(candidate, 'utf8') > 4_096 ||
    candidate.startsWith('/') ||
    candidate.startsWith('\\') ||
    /^[A-Za-z]:/u.test(candidate) ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f-\u009f:]/u.test(candidate)
  ) {
    throw new Error('CAT07 trusted Git returned an unsafe repository path');
  }
  const segments = candidate.split('/');
  if (
    segments.some(
      (segment) =>
        segment.length < 1 ||
        segment === '.' ||
        segment === '..' ||
        /[. ]$/u.test(segment) ||
        segment.toLowerCase() === '.git' ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(segment),
    )
  ) {
    throw new Error('CAT07 trusted Git returned an unsafe repository path');
  }
  if (seen) {
    const folded = candidate.toLowerCase();
    if (seen.has(folded)) throw new Error('CAT07 trusted Git returned a duplicate path');
    seen.add(folded);
  }
  return candidate;
}

function parseCat07NulRepoPaths(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 16 * 1024 * 1024) {
    throw new Error(`CAT07 ${label} output is outside its byte ceiling`);
  }
  if (bytes.length === 0) return [];
  if (bytes.at(-1) !== 0) throw new Error(`CAT07 ${label} output is not NUL-terminated`);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, -1));
  } catch {
    throw new Error(`CAT07 ${label} output is not valid UTF-8`);
  }
  const seen = new Set();
  const nodes = new Map();
  const paths = text.split('\0').map((candidate) => {
    const validated = validateCat07RepoPath(candidate, seen);
    const segments = validated.split('/');
    for (let index = 0; index < segments.length; index += 1) {
      const node = segments
        .slice(0, index + 1)
        .join('/')
        .toLowerCase();
      const kind = index === segments.length - 1 ? 'file' : 'directory';
      const previous = nodes.get(node);
      if (previous && previous !== kind) {
        throw new Error(`CAT07 ${label} output has a file/directory collision`);
      }
      nodes.set(node, kind);
    }
    return validated;
  });
  if (paths.length > 200_000) throw new Error(`CAT07 ${label} output has too many paths`);
  return paths;
}

const governedDownstreamGeneratedPathSet = new Set(GOVERNED_DOWNSTREAM_GENERATED_PATHS);

const ignoredUntrackedRuntimeOutputPatterns = [/^\.tmp(?:\/|$)/];

const HUMAN_E2E_GENERATED_MANIFEST_PATHS = Object.freeze([
  'docs/e2e/generated/human-e2e-manifest.json',
  'docs/e2e/generated/human-e2e-manifest.md',
]);
const CAT04_CATALOG_RECOVERY_EVIDENCE_FOLDER_NAME = 'cat04-catalog-recovery-current';
const CAT05_NATIVE_OCR_EVIDENCE_FOLDER_NAME = 'cat05-native-ocr-web-ui-current';
const CAT07_SHELF_FRESHNESS_EVIDENCE_DATE = '2026-07-22';
const CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_NAME = 'cat07-shelf-freshness-current';
const CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_PREFIX =
  `test-results/human-e2e/${CAT07_SHELF_FRESHNESS_EVIDENCE_DATE}/` +
  `${CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_NAME}/`;

function ignoredGeneratedOutputPath(path) {
  const normalized = normalizeRepoPath(path);
  return governedDownstreamGeneratedPathSet.has(normalized);
}

function ignoredUntrackedRuntimeOutputPath(path) {
  const normalized = normalizeRepoPath(path);
  return ignoredUntrackedRuntimeOutputPatterns.some((pattern) => pattern.test(normalized));
}

function collectDisallowedUntrackedRepoFiles(
  paths,
  { allowedExactPaths = [], allowedPrefixes = [] } = {},
) {
  const exact = new Set([...allowedExactPaths].map(normalizeRepoPath));
  const prefixes = [...allowedPrefixes].map(normalizeRepoPath);
  return [...new Set(paths.map(normalizeRepoPath).filter(Boolean))]
    .filter(
      (path) =>
        !exact.has(path) &&
        !prefixes.some((prefix) => path.startsWith(prefix)) &&
        !ignoredGeneratedOutputPath(path) &&
        !ignoredUntrackedRuntimeOutputPath(path),
    )
    .sort();
}

function governedHumanEvidenceFolderPrefix(
  folder,
  expectedFolderName,
  governingFolder,
  expectedGoverningFolderName,
) {
  const normalized = normalizeRepoPath(folder).replace(/\/$/, '');
  const governingNormalized = normalizeRepoPath(governingFolder).replace(/\/$/, '');
  const match = normalized.match(/^test-results\/human-e2e\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/);
  const governingMatch = governingNormalized.match(
    /^test-results\/human-e2e\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/,
  );
  if (
    !match ||
    match[2] !== expectedFolderName ||
    !governingMatch ||
    governingMatch[2] !== expectedGoverningFolderName ||
    match[1] !== governingMatch[1]
  ) {
    return null;
  }
  return `${normalized}/`;
}

function exists(path) {
  return existsSync(abs(path));
}

let humanEvidenceBindingsByPath = null;

function readJson(path) {
  return JSON.parse(readEvidenceBytes(path, 16 * 1024 * 1024).toString('utf8'));
}

function readEvidenceBytes(path, maxBytes = 64 * 1024 * 1024) {
  const normalized = normalizeRepoPath(path);
  const bytes = readBoundedRegularFile(abs(normalized), {
    containmentRoot: root,
    maxBytes,
  });
  const binding = humanEvidenceBindingsByPath?.get(normalized);
  if (
    binding &&
    (bytes.length !== binding.sizeBytes ||
      createHash('sha256').update(bytes).digest('hex') !== binding.sha256)
  ) {
    throw new Error(`${normalized} changed after the human-E2E evidence snapshot`);
  }
  return bytes;
}

function readEvidenceText(path, maxBytes = 16 * 1024 * 1024) {
  return readEvidenceBytes(path, maxBytes).toString('utf8');
}

function captureHumanEvidenceBinding(repoPath) {
  const normalized = validateCat07RepoPath(normalizeRepoPath(repoPath));
  const bounded = readStableRootBoundWorkingFile(root, normalized, {
    maxBytes: HUMAN_EVIDENCE_FILE_MAX_BYTES,
  });
  if (bounded.kind !== 'file' || !bounded.bytes || !bounded.sha256) {
    throw new Error(`${normalized} is not one bounded root-contained regular evidence file`);
  }
  const streamed = hashStableRootBoundWorkingFile(root, normalized, {
    expectedSizeBytes: bounded.bytes.length,
  });
  if (
    streamed.kind !== 'file' ||
    typeof streamed.identity !== 'string' ||
    streamed.sizeBytes !== bounded.bytes.length ||
    streamed.sha256 !== bounded.sha256
  ) {
    throw new Error(`${normalized} changed while the human-E2E evidence snapshot was captured`);
  }
  return Object.freeze({
    identity: streamed.identity,
    path: normalized,
    sha256: streamed.sha256,
    sizeBytes: streamed.sizeBytes,
  });
}

function captureHumanEvidenceBindings(repoPaths) {
  const bindings = new Map();
  let aggregateBytes = 0;
  for (const repoPath of [...new Set(repoPaths)].sort()) {
    const binding = captureHumanEvidenceBinding(repoPath);
    aggregateBytes += binding.sizeBytes;
    if (
      !Number.isSafeInteger(aggregateBytes) ||
      aggregateBytes > HUMAN_EVIDENCE_AGGREGATE_MAX_BYTES
    ) {
      throw new Error('active human-E2E evidence exceeds the 512 MiB aggregate byte ceiling');
    }
    bindings.set(binding.path, binding);
  }
  return bindings;
}

function verifyHumanEvidenceBindings(bindings, hashWorkingFile = hashStableRootBoundWorkingFile) {
  const errors = [];
  for (const binding of bindings.values()) {
    const current = hashWorkingFile(root, binding.path, {
      expectedSizeBytes: binding.sizeBytes,
    });
    if (
      current.kind !== 'file' ||
      current.identity !== binding.identity ||
      current.sha256 !== binding.sha256 ||
      current.sizeBytes !== binding.sizeBytes
    ) {
      errors.push(`${binding.path} changed during human-E2E manifest assembly`);
    }
  }
  return errors;
}

function invalidGovernedEvidenceChainAudit(message) {
  return Object.freeze({
    schemaVersion: 1,
    kind: 'governed_evidence_chain_audit',
    status: 'invalid',
    sourceGitSha: null,
    headGitSha: null,
    evidenceCommitSha: null,
    releaseCandidateDir: null,
    ledgerPath: null,
    directEvidenceCommit: false,
    evidenceOnlyCommit: false,
    cleanWorktree: false,
    normalIndexState: false,
    ledgerValid: false,
    hashesValid: false,
    downstreamGeneratedOnly: false,
    ledger: null,
    downstreamCommits: [],
    errors: [message],
  });
}

function auditConfiguredGovernedEvidenceChain({
  auditRoot = root,
  environment = process.env,
  expectedHeadSha = null,
} = {}) {
  const canonicalSourceGitSha = environment.PHASE9_IOS_SOURCE_GIT_SHA;
  const aliasSourceGitSha = environment.GOVERNED_EVIDENCE_SOURCE_GIT_SHA;
  const canonicalReleaseCandidateDir = environment.PHASE9_RELEASE_CANDIDATE_DIR;
  const aliasReleaseCandidateDir = environment.GOVERNED_EVIDENCE_RC_DIR;
  if (
    canonicalSourceGitSha != null &&
    aliasSourceGitSha != null &&
    canonicalSourceGitSha !== aliasSourceGitSha
  ) {
    return invalidGovernedEvidenceChainAudit(
      'PHASE9_IOS_SOURCE_GIT_SHA and GOVERNED_EVIDENCE_SOURCE_GIT_SHA select different source commits',
    );
  }
  if (
    canonicalReleaseCandidateDir != null &&
    aliasReleaseCandidateDir != null &&
    canonicalReleaseCandidateDir !== aliasReleaseCandidateDir
  ) {
    return invalidGovernedEvidenceChainAudit(
      'PHASE9_RELEASE_CANDIDATE_DIR and GOVERNED_EVIDENCE_RC_DIR select different release-candidate directories',
    );
  }
  const sourceGitSha = canonicalSourceGitSha ?? aliasSourceGitSha;
  const releaseCandidateDir = canonicalReleaseCandidateDir ?? aliasReleaseCandidateDir;
  if (!/^[0-9a-f]{40}$/u.test(String(sourceGitSha ?? ''))) {
    return invalidGovernedEvidenceChainAudit(
      'PHASE9_IOS_SOURCE_GIT_SHA (or its governed-evidence alias) must select one lowercase source commit',
    );
  }
  if (
    !/^docs\/phase-9\/release-candidates\/rc-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(
      String(releaseCandidateDir ?? ''),
    )
  ) {
    return invalidGovernedEvidenceChainAudit(
      'PHASE9_RELEASE_CANDIDATE_DIR (or its governed-evidence alias) must select one immutable release-candidate directory',
    );
  }
  try {
    return auditGovernedEvidenceChain({
      root: auditRoot,
      sourceGitSha,
      releaseCandidateDir,
      expectedHeadSha,
    });
  } catch (error) {
    return invalidGovernedEvidenceChainAudit(
      `governed evidence chain could not be audited: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function governedEvidenceChainBinding(audit) {
  const ledgerBytes = audit?.ledger ? renderGovernedEvidenceLedger(audit.ledger) : null;
  return Object.freeze({
    status: audit?.status === 'pass' ? 'pass' : 'blocked',
    sourceGitSha: audit?.sourceGitSha ?? null,
    evidenceCommitSha: audit?.evidenceCommitSha ?? null,
    currentGitSha: audit?.headGitSha ?? null,
    releaseCandidateDir: audit?.releaseCandidateDir ?? null,
    ledgerPath: audit?.ledgerPath ?? null,
    ledgerSha256: ledgerBytes ? createHash('sha256').update(ledgerBytes).digest('hex') : null,
    ledgerEntryCount: Array.isArray(audit?.ledger?.entries) ? audit.ledger.entries.length : 0,
    downstreamCommitCount: Array.isArray(audit?.downstreamCommits)
      ? audit.downstreamCommits.length
      : 0,
  });
}

function collectGovernedHumanEvidenceFailures({
  audit,
  bindingsByPath,
  requiredEvidencePaths,
  recordedSourceGitShas,
}) {
  const failures = [];
  if (audit?.status !== 'pass' || !audit.ledger) {
    failures.push('the selected S to E to current governed evidence chain is invalid');
    return failures;
  }
  const entries = new Map(audit.ledger.entries.map((entry) => [entry.path, entry]));
  for (const repoPath of requiredEvidencePaths) {
    const binding = bindingsByPath.get(repoPath);
    const entry = entries.get(repoPath);
    if (!binding || !entry || entry.role !== 'human-e2e' || entry.sha256 !== binding.sha256) {
      failures.push(`${repoPath} is not an exact digest-bound human-e2e ledger entry at E`);
    }
  }
  for (const sourceGitSha of recordedSourceGitShas) {
    if (sourceGitSha !== audit.sourceGitSha) {
      failures.push('source-bound human evidence does not record the selected source commit S');
      break;
    }
  }
  return failures;
}

function collectRecordedGovernedDescendantFailures(recorded, audit) {
  return validateGovernedEvidenceChainBinding(recorded, audit).errors;
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function parseJpegDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 11 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('invalid JPEG start marker');
  }
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('invalid JPEG marker boundary');
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (offset + 2 > bytes.length) throw new Error('truncated JPEG segment');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length)
      throw new Error('invalid JPEG segment length');
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 7) throw new Error('truncated JPEG frame header');
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (width < 1 || height < 1) throw new Error('invalid JPEG dimensions');
      return { width, height };
    }
    if (marker === 0xda || marker === 0xd9) break;
    offset += length;
  }
  throw new Error('JPEG frame dimensions not found');
}

function readJpegDimensions(path) {
  return parseJpegDimensions(readEvidenceBytes(path));
}

function normalizeEvidenceRelativePath(path) {
  if (typeof path !== 'string') return null;
  const normalized = normalizeRepoPath(path.trim());
  const segments = normalized.split('/');
  if (
    normalized.length === 0 ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    return null;
  }
  return normalized;
}

function collectEvidenceProvenanceFailures({
  folder,
  evidence,
  requiredFiles = [],
  summaryArtifacts,
  trackedRepoFiles,
  fileExists = exists,
  validateRequiredFiles = true,
  validateSummaryArtifacts = false,
}) {
  const failures = [];

  if (validateRequiredFiles) {
    for (const requiredFile of requiredFiles) {
      const normalized = normalizeEvidenceRelativePath(requiredFile);
      if (!normalized) {
        failures.push(`required evidence file uses an unsafe path: ${String(requiredFile)}`);
        continue;
      }
      const requiredPath = `${folder}/${normalized}`;
      if (!fileExists(requiredPath)) {
        failures.push(`missing required evidence file ${normalized}`);
      } else if (!trackedRepoFiles.has(normalizeRepoPath(requiredPath))) {
        failures.push(`required evidence file is not Git-tracked: ${normalized}`);
      }
    }
  }

  if (!validateSummaryArtifacts) return failures;
  if (!Array.isArray(summaryArtifacts)) {
    failures.push('summary.artifacts must be an array');
    return failures;
  }

  const declaredArtifacts = new Set();
  for (const artifact of summaryArtifacts) {
    const normalized = normalizeEvidenceRelativePath(artifact);
    if (!normalized) {
      failures.push(`summary.artifacts contains an unsafe path: ${String(artifact)}`);
      continue;
    }
    if (declaredArtifacts.has(normalized)) {
      failures.push(`summary.artifacts contains a duplicate path: ${normalized}`);
      continue;
    }
    declaredArtifacts.add(normalized);

    const artifactPath = `${folder}/${normalized}`;
    if (!fileExists(artifactPath)) {
      failures.push(`missing summary artifact ${normalized}`);
    } else if (!trackedRepoFiles.has(normalizeRepoPath(artifactPath))) {
      failures.push(`summary artifact is not Git-tracked: ${normalized}`);
    }
  }

  const normalizedEvidence = normalizeEvidenceRelativePath(evidence);
  for (const requiredFile of requiredFiles) {
    const normalized = normalizeEvidenceRelativePath(requiredFile);
    if (!normalized || normalized === normalizedEvidence) continue;
    if (!declaredArtifacts.has(normalized)) {
      failures.push(`summary.artifacts is missing required evidence file ${normalized}`);
    }
  }

  return failures;
}

function collectRequiredTextFailures({ label, text, requiredText = [] }) {
  const failures = [];
  for (const requiredFragment of requiredText) {
    if (typeof requiredFragment !== 'string' || requiredFragment.length === 0) {
      failures.push(`${label} contains an invalid required text fragment`);
    } else if (!text.includes(requiredFragment)) {
      failures.push(`${label} is missing required text: ${requiredFragment}`);
    }
  }
  return failures;
}

function hasExactObjectKeys(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const CAT07_SHELF_FRESHNESS_SCHEMA_VERSION = 2;
const CAT07_SHELF_FRESHNESS_ARTIFACT_COUNT = 99;
const CAT07_SHELF_FRESHNESS_SCREENSHOT_COUNT = 45;
const CAT07_SHELF_FRESHNESS_MAX_EXPO_LOG_BYTES = 256 * 1024;
const CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_ARTIFACT_BYTES = 8 * 1024 * 1024;
const CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_STRING_BYTES = 128 * 1024;
const CAT07_SHELF_FRESHNESS_MAX_BROWSER_EVENT_BYTES = 4 * 1024 * 1024;
const CAT07_BROWSER_EVENT_KEYS = Object.freeze({
  'Inspector.targetCrashed': ['failureClass', 'method', 'observedAt'],
  'Log.entryAdded': ['failureClass', 'level', 'method', 'observedAt'],
  'Network.loadingFailed': [
    'canceled',
    'errorCode',
    'method',
    'observedAt',
    'requestId',
    'type',
    'url',
    'urlPolicyViolation',
  ],
  'Network.requestWillBeSent': [
    'method',
    'observedAt',
    'requestId',
    'requestMethod',
    'type',
    'url',
    'urlPolicyViolation',
  ],
  'Network.responseReceived': [
    'method',
    'observedAt',
    'requestId',
    'status',
    'type',
    'url',
    'urlPolicyViolation',
  ],
  'Network.webSocketCreated': ['method', 'observedAt', 'requestId', 'url', 'urlPolicyViolation'],
  'Network.webSocketFrameError': [
    'errorCode',
    'method',
    'observedAt',
    'requestId',
    'url',
    'urlPolicyViolation',
  ],
  'Page.crashed': ['failureClass', 'method', 'observedAt'],
  'Page.frameNavigated': ['method', 'observedAt', 'requestId', 'url', 'urlPolicyViolation'],
  'Page.frameStartedNavigating': ['method', 'observedAt', 'requestId', 'url', 'urlPolicyViolation'],
  'Page.javascriptDialogOpening': ['failureClass', 'method', 'observedAt'],
  'Page.navigatedWithinDocument': [
    'method',
    'observedAt',
    'requestId',
    'url',
    'urlPolicyViolation',
  ],
  'Runtime.consoleAPICalled': ['level', 'method', 'observedAt'],
  'Runtime.exceptionThrown': ['failureClass', 'method', 'observedAt'],
  'Runtime.executionContextCreated': ['method', 'observedAt'],
});
const CAT07_SHELF_FRESHNESS_RUN_ID =
  /^cat07-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CAT07_SHELF_FRESHNESS_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);
const CAT07_SHELF_FRESHNESS_LIMITATIONS = Object.freeze([
  'This is deterministic Expo-web UI-state evidence produced by development-only local fixtures.',
  'It proves neither native encrypted storage nor an iOS binary, physical-iPhone relaunch, notifications, VoiceOver, Dynamic Type, Reduce Motion, hosted RLS, live catalog truth, or migration execution.',
  'It does not approve category estimates; category_default remains unavailable and non-actionable.',
  'It does not provide cosmetic-chemistry, privacy, security, legal, App Review, production, market, or revenue approval.',
  'The evidence run verifies committed Git blobs, performs a clean offline lockfile install, and hashes the installed dependency tree, but it is not a reproducible-build or operating-system attestation and still trusts the recorded host tool executables and their installations.',
]);
const CAT07_SHELF_FRESHNESS_VERIFIED_OUTCOMES = Object.freeze([
  'Manual Shelf intake requires an explicit opening state before save.',
  'A future opened date is rejected and cannot enable save.',
  'A user-confirmed label PAO remains source-labelled and drives freshness only after opening.',
  'A package date is user-recorded from the exact package and can become the earlier winning freshness candidate.',
  'Replacement exposes today, exact-past-date, and unopened choices without assuming an opening state.',
  'A future replacement date is rejected.',
  'Replacement archives the prior package, creates a distinct active identity, preserves PAO provenance, and clears package-specific dates.',
  'The new unopened package has no PAO clock and stays out of the Expiring filter.',
  'The archived package retains its recorded opening, label PAO, and printed-package provenance.',
  'Every captured supported viewport has no horizontal overflow, visible sub-44 control, clipped visible control, or blocked center hit target.',
]);
const CAT07_SHELF_FRESHNESS_STEPS = Object.freeze([
  '01-manual',
  '02-opening-required',
  '03-future-opened-date-blocked',
  '04-label-pao-ready',
  '05-shelf-countdown',
  '06-label-pao-detail',
  '07-package-date-recorded',
  '08-replacement-choices',
  '09-future-replacement-date-blocked',
  '10-unopened-replacement-shelf',
  '11-unopened-replacement-detail',
  '12-unknown-excluded-from-expiring',
  '13-archive-history',
  '14-archived-provenance',
]);
const CAT07_SHELF_FRESHNESS_SUMMARY_KEYS = Object.freeze([
  'artifacts',
  'artifactManifest',
  'bootstrapResults',
  'completedAt',
  'expectedBootstrapCount',
  'expectedExecutionCount',
  'limitations',
  'nativeDeviceProof',
  'requiredViewports',
  'runId',
  'runtimeProvenance',
  'scenarios',
  'schemaVersion',
  'screenshots',
  'sourceGitSha',
  'startedAt',
  'surface',
  'verdict',
  'verifiedOutcomes',
]);
const CAT07_SHELF_FRESHNESS_BOOTSTRAP_KEYS = Object.freeze([
  'artifactPrefix',
  'browserFailures',
  'completedAt',
  'endUrl',
  'error',
  'fixtureGroup',
  'nativeDeviceProof',
  'runId',
  'startedAt',
  'surface',
  'verdict',
  'viewport',
]);
const CAT07_SHELF_FRESHNESS_SCENARIO_KEYS = Object.freeze([
  'artifactPrefix',
  'browserFailures',
  'completedAt',
  'distinctReplacementIdentity',
  'endUrl',
  'error',
  'nativeDeviceProof',
  'productName',
  'runId',
  'scenarioId',
  'startedAt',
  'surface',
  'verdict',
  'viewport',
]);

function cat07ShelfFreshnessViewportKey(viewport) {
  if (!hasExactObjectKeys(viewport, ['id', 'width', 'height'])) return null;
  const expected = CAT07_SHELF_FRESHNESS_VIEWPORTS.find(({ id }) => id === viewport.id);
  if (!expected || viewport.width !== expected.width || viewport.height !== expected.height) {
    return null;
  }
  return expected.id;
}

function cat07ShelfFreshnessMarker(runId, viewportId, step) {
  return `cat07:${runId}:${viewportId}:${step}`;
}

const CAT07_DETAIL_PATH =
  /^\/shelf\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function cat07SnapshotContract(artifact, viewport, runId) {
  const productName = `CAT07 Label PAO ${viewport.width}`;
  const base = {
    forbiddenBodyText: [],
    requiredBodyText: [],
    requiredControls: [],
    requiredMarker: null,
  };
  if (artifact === `bootstrap-cat07-freshness-${viewport.id}-catalog-ready.png`) {
    return {
      ...base,
      path: '/shelf/search',
      requiredBodyText: ['Search catalog', 'Add by hand'],
      requiredMarker: [
        'cat04ConsentProbe',
        cat07ShelfFreshnessMarker(runId, viewport.id, 'consent-probe'),
      ],
    };
  }
  const prefix = `freshness-lifecycle-${viewport.id}-`;
  const step =
    artifact.startsWith(prefix) && artifact.endsWith('.png')
      ? artifact.slice(prefix.length, -4)
      : null;
  const contracts = {
    '01-manual': {
      path: '/shelf/manual',
      requiredBodyText: ['Add by hand', 'Product name', 'Continue'],
      requiredControls: [{ disabled: false, label: 'Continue' }],
      requiredMarker: ['cat04Audit', cat07ShelfFreshnessMarker(runId, viewport.id, 'manual')],
    },
    '02-opening-required': {
      path: '/shelf/opened',
      requiredBodyText: ['When did you open it?', 'Choose the state that matches this package'],
      requiredControls: [{ disabled: true, label: 'Add to shelf' }],
    },
    '03-future-opened-date-blocked': {
      path: '/shelf/opened',
      requiredBodyText: ['Enter a real date no later than today'],
      requiredControls: [{ disabled: true, label: 'Add to shelf' }],
    },
    '04-label-pao-ready': {
      path: '/shelf/opened',
      requiredBodyText: ['PAO: 12 months after opening', 'from label'],
      requiredControls: [{ disabled: false, label: 'Add to shelf' }],
    },
    '05-shelf-countdown': {
      path: '/shelf',
      requiredBodyText: [productName, '12 mo PAO'],
    },
    '06-label-pao-detail': {
      path: CAT07_DETAIL_PATH,
      requiredBodyText: [productName, 'PAO 12 months', 'from label', 'Date unknown'],
    },
    '07-package-date-recorded': {
      path: CAT07_DETAIL_PATH,
      requiredBodyText: [productName, 'recorded as printed'],
    },
    '08-replacement-choices': {
      path: '/shelf/replenish',
      requiredBodyText: [
        productName,
        'I opened a new unit today',
        'New unit was opened earlier',
        'New unit is unopened',
        'This reminder comes from the package date recorded on your Shelf.',
      ],
    },
    '09-future-replacement-date-blocked': {
      path: '/shelf/replenish',
      requiredBodyText: ['Enter a real date no later than today'],
      requiredControls: [{ disabled: true, label: 'Save replacement with this date' }],
    },
    '10-unopened-replacement-shelf': {
      path: '/shelf',
      requiredBodyText: [productName, 'unopened', 'Date unknown', 'View archive'],
    },
    '11-unopened-replacement-detail': {
      path: CAT07_DETAIL_PATH,
      requiredBodyText: [
        productName,
        'Opened not opened yet',
        'PAO 12 months',
        'from label',
        'Recorded package date not entered',
        'Date unknown',
      ],
    },
    '12-unknown-excluded-from-expiring': {
      forbiddenBodyText: [productName],
      path: '/shelf',
      requiredBodyText: ['Nothing needs replacing right now.'],
      requiredMarker: [
        'cat04Audit',
        cat07ShelfFreshnessMarker(runId, viewport.id, 'persisted-shelf'),
      ],
    },
    '13-archive-history': {
      path: '/shelf/archive',
      requiredBodyText: [productName, 'finished'],
    },
    '14-archived-provenance': {
      path: CAT07_DETAIL_PATH,
      requiredBodyText: [productName, 'PAO 12 months', 'from label', 'recorded as printed'],
    },
  };
  return step && contracts[step] ? { ...base, ...contracts[step] } : null;
}

function cat07ScreenshotContentFailure(decoded) {
  const totalPixels = decoded.width * decoded.height;
  if (totalPixels < 1 || decoded.data.length !== totalPixels * 4) {
    return 'decoded pixel buffer is incomplete';
  }
  const quantized = new Map();
  let opaquePixels = 0;
  let minRed = 255;
  let minGreen = 255;
  let minBlue = 255;
  let maxRed = 0;
  let maxGreen = 0;
  let maxBlue = 0;
  for (let offset = 0; offset < decoded.data.length; offset += 4) {
    const red = decoded.data[offset];
    const green = decoded.data[offset + 1];
    const blue = decoded.data[offset + 2];
    const alpha = decoded.data[offset + 3];
    if (alpha >= 250) opaquePixels += 1;
    minRed = Math.min(minRed, red);
    minGreen = Math.min(minGreen, green);
    minBlue = Math.min(minBlue, blue);
    maxRed = Math.max(maxRed, red);
    maxGreen = Math.max(maxGreen, green);
    maxBlue = Math.max(maxBlue, blue);
    const bucket = `${red >> 4}:${green >> 4}:${blue >> 4}:${alpha >> 6}`;
    quantized.set(bucket, (quantized.get(bucket) ?? 0) + 1);
  }
  const dominantPixels = Math.max(...quantized.values());
  const channelRange = maxRed - minRed + (maxGreen - minGreen) + (maxBlue - minBlue);
  if (
    opaquePixels / totalPixels < 0.99 ||
    quantized.size < 3 ||
    dominantPixels / totalPixels > 0.995 ||
    channelRange < 48
  ) {
    return 'image is blank or near-blank';
  }
  return null;
}

function expectedCat07ShelfFreshnessArtifacts() {
  const artifacts = [
    'browser-events-cat07-freshness.json',
    'expo-cat07-freshness.log',
    'report.md',
  ];
  for (const viewport of CAT07_SHELF_FRESHNESS_VIEWPORTS) {
    const bootstrapPrefix = `bootstrap-cat07-freshness-${viewport.id}`;
    artifacts.push(
      `${bootstrapPrefix}-catalog-ready.json`,
      `${bootstrapPrefix}-catalog-ready.png`,
      `${bootstrapPrefix}-result.json`,
    );
    const scenarioPrefix = `freshness-lifecycle-${viewport.id}`;
    for (const step of CAT07_SHELF_FRESHNESS_STEPS) {
      artifacts.push(`${scenarioPrefix}-${step}.json`, `${scenarioPrefix}-${step}.png`);
    }
    artifacts.push(`${scenarioPrefix}-result.json`);
  }
  return artifacts.sort();
}

function buildExpectedCat07ShelfFreshnessReport(summary) {
  const bootstrapRows = summary.bootstrapResults.map(
    (result) =>
      `| ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${result.error ?? ''} |`,
  );
  const scenarioRows = summary.scenarios.map(
    (result) =>
      `| ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${result.error ?? ''} |`,
  );
  const lines = [
    '# CAT07 Shelf Freshness Expo-Web Audit',
    '',
    `- Verdict: ${summary.verdict}`,
    '- Surface: Expo web deterministic local-development fixture',
    '- Native-device proof: No',
    `- Source Git SHA: ${summary.sourceGitSha}`,
    `- Run ID: ${summary.runId}`,
    `- Package-lock SHA-256: ${summary.runtimeProvenance?.packageLock?.sha256 ?? 'unavailable'}`,
    `- Installed runtime tree SHA-256: ${summary.runtimeProvenance?.runtimeTree?.sha256 ?? 'unavailable'}`,
    ...summary.limitations.map((limitation) => `- Limitation: ${limitation}`),
    '',
    '## Explicit-consent bootstrap',
    '',
    '| Viewport | Verdict | Error |',
    '| --- | --- | --- |',
    ...bootstrapRows,
    '',
    '## Freshness and replacement lifecycle',
    '',
    '| Viewport | Verdict | Error |',
    '| --- | --- | --- |',
    ...scenarioRows,
    '',
    '## Verified local UI outcomes',
    '',
    ...summary.verifiedOutcomes.map((outcome) => `- ${outcome}`),
    '',
    'Machine-readable result: `summary.json`',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

const CAT07_APP_ENVIRONMENT_COMMON_KEYS = Object.freeze([
  'BROWSER',
  'CI',
  'EXPO_NO_DOTENV',
  'EXPO_NO_TELEMETRY',
  'EXPO_OFFLINE',
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_E2E_APP_LOCK_ENABLED',
  'EXPO_PUBLIC_E2E_LOCAL_RESET',
  'EXPO_PUBLIC_E2E_SHELF_SCAN_BARCODE',
  'EXPO_PUBLIC_NATIVE_CAMERA_ENABLED',
  'EXPO_PUBLIC_NATIVE_OCR_ENABLED',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'FORCE_COLOR',
  'NODE_ENV',
  'NO_COLOR',
  'NO_PROXY',
]);
const CAT07_APP_ENVIRONMENT_PLATFORM_KEY_SETS = Object.freeze([
  Object.freeze(
    [
      ...CAT07_APP_ENVIRONMENT_COMMON_KEYS,
      'APPDATA',
      'LOCALAPPDATA',
      'PATHEXT',
      'Path',
      'SystemRoot',
      'TEMP',
      'TMP',
      'USERPROFILE',
      'WINDIR',
    ].sort(),
  ),
  Object.freeze(
    [...CAT07_APP_ENVIRONMENT_COMMON_KEYS, 'HOME', 'PATH', 'TEMP', 'TMP', 'TMPDIR'].sort(),
  ),
]);

function collectCat07RuntimeProvenanceFailures(runtimeProvenance, sourceGitState) {
  const failures = [];
  if (
    !hasExactObjectKeys(runtimeProvenance, [
      'browserLaunch',
      'childEnvironment',
      'environmentBootstrap',
      'installMode',
      'packageLock',
      'runtimeTree',
      'schemaVersion',
      'sourceTree',
      'tools',
    ]) ||
    runtimeProvenance?.schemaVersion !== CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION
  ) {
    return ['runtimeProvenance must use the exact reviewed CAT07 schema'];
  }
  const browserLaunch = runtimeProvenance.browserLaunch;
  const expectedBrowserArgs = cat07BrowserArguments({
    debugPort: 9820,
    userDataDir: '<fresh-profile>',
  });
  if (
    !hasExactObjectKeys(browserLaunch, ['args', 'schemaVersion']) ||
    browserLaunch?.schemaVersion !== CAT07_BROWSER_LAUNCH_SCHEMA_VERSION ||
    !isDeepStrictEqual(browserLaunch?.args, expectedBrowserArgs)
  ) {
    failures.push('runtimeProvenance browserLaunch does not use the exact loopback-only posture');
  }
  if (
    runtimeProvenance.installMode !== 'isolated-npm-ci-offline-ignore-scripts-then-repo-postinstall'
  ) {
    failures.push('runtimeProvenance installMode must be the reviewed offline npm-ci mode');
  }
  const environmentBootstrap = runtimeProvenance.environmentBootstrap;
  if (
    !hasExactObjectKeys(environmentBootstrap, ['bytes', 'schemaVersion', 'sha256']) ||
    environmentBootstrap?.schemaVersion !== CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION ||
    !Number.isSafeInteger(environmentBootstrap?.bytes) ||
    environmentBootstrap.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(String(environmentBootstrap?.sha256 ?? ''))
  ) {
    failures.push('runtimeProvenance environmentBootstrap binding is invalid');
  }
  const childEnvironment = runtimeProvenance.childEnvironment;
  const environmentKeys = childEnvironment?.keys;
  if (
    !hasExactObjectKeys(childEnvironment, ['keys', 'schemaVersion']) ||
    childEnvironment?.schemaVersion !== CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION ||
    !Array.isArray(environmentKeys) ||
    !CAT07_APP_ENVIRONMENT_PLATFORM_KEY_SETS.some((keys) =>
      isDeepStrictEqual(environmentKeys, keys),
    )
  ) {
    failures.push('runtimeProvenance childEnvironment is not the exact positive allowlist');
  }
  const packageLock = runtimeProvenance.packageLock;
  if (
    !hasExactObjectKeys(packageLock, ['bytes', 'sha256']) ||
    !Number.isSafeInteger(packageLock?.bytes) ||
    packageLock.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(String(packageLock?.sha256 ?? ''))
  ) {
    failures.push('runtimeProvenance packageLock must bind positive bytes and one SHA-256');
  } else if (!sourceGitState?.packageLockAtSource) {
    failures.push('sourceGitSha package-lock provenance is unavailable');
  } else if (!isDeepStrictEqual(packageLock, sourceGitState.packageLockAtSource)) {
    failures.push('runtimeProvenance packageLock does not match sourceGitSha');
  }
  const sourceTree = runtimeProvenance.sourceTree;
  if (
    !hasExactObjectKeys(sourceTree, ['bytes', 'entryCount', 'fileCount', 'sha256']) ||
    !Number.isSafeInteger(sourceTree?.bytes) ||
    sourceTree.bytes <= 0 ||
    !Number.isSafeInteger(sourceTree?.entryCount) ||
    sourceTree.entryCount <= 0 ||
    sourceTree.fileCount !== sourceTree.entryCount ||
    !/^[0-9a-f]{64}$/u.test(String(sourceTree?.sha256 ?? ''))
  ) {
    failures.push('runtimeProvenance sourceTree must bind the reviewed committed file tree');
  } else if (!sourceGitState?.sourceTreeAtSource) {
    failures.push('sourceGitSha tree provenance is unavailable');
  } else if (!isDeepStrictEqual(sourceTree, sourceGitState.sourceTreeAtSource)) {
    failures.push('runtimeProvenance sourceTree does not match sourceGitSha');
  }
  const runtimeTree = runtimeProvenance.runtimeTree;
  if (
    !hasExactObjectKeys(runtimeTree, [
      'bytes',
      'directoryCount',
      'entryCount',
      'fileCount',
      'linkCount',
      'rootCount',
      'roots',
      'sha256',
    ]) ||
    !Number.isSafeInteger(runtimeTree?.bytes) ||
    runtimeTree.bytes <= 0 ||
    !Number.isSafeInteger(runtimeTree?.directoryCount) ||
    runtimeTree.directoryCount < 0 ||
    !Number.isSafeInteger(runtimeTree?.fileCount) ||
    runtimeTree.fileCount <= 0 ||
    !Number.isSafeInteger(runtimeTree?.linkCount) ||
    runtimeTree.linkCount < 0 ||
    !Number.isSafeInteger(runtimeTree?.rootCount) ||
    runtimeTree.rootCount <= 0 ||
    !Array.isArray(runtimeTree?.roots) ||
    runtimeTree.roots.length !== runtimeTree.rootCount ||
    runtimeTree.entryCount !==
      runtimeTree.directoryCount + runtimeTree.fileCount + runtimeTree.linkCount ||
    !/^[0-9a-f]{64}$/u.test(String(runtimeTree?.sha256 ?? ''))
  ) {
    failures.push('runtimeProvenance runtimeTree must bind one complete installed tree');
  } else {
    const rootPaths = [];
    for (const root of runtimeTree.roots) {
      if (
        !hasExactObjectKeys(root, [
          'bytes',
          'directoryCount',
          'entryCount',
          'fileCount',
          'linkCount',
          'path',
          'sha256',
        ]) ||
        typeof root.path !== 'string' ||
        root.path.length === 0 ||
        !Number.isSafeInteger(root.bytes) ||
        root.bytes < 0 ||
        !Number.isSafeInteger(root.entryCount) ||
        root.entryCount !== root.directoryCount + root.fileCount + root.linkCount ||
        !/^[0-9a-f]{64}$/u.test(String(root.sha256 ?? ''))
      ) {
        failures.push('runtimeProvenance contains an invalid runtime root record');
        continue;
      }
      rootPaths.push(root.path);
    }
    if (
      !isDeepStrictEqual(rootPaths, sourceGitState?.runtimeRootPathsAtSource) ||
      runtimeTree.bytes !== runtimeTree.roots.reduce((sum, root) => sum + root.bytes, 0) ||
      runtimeTree.entryCount !== runtimeTree.roots.reduce((sum, root) => sum + root.entryCount, 0)
    ) {
      failures.push('runtimeProvenance runtime roots do not match the source lock inventory');
    }
    const combined = { ...runtimeTree };
    delete combined.sha256;
    if (
      runtimeTree.sha256 !==
      createHash('sha256').update(canonicalEvidenceJsonBytes(combined)).digest('hex')
    ) {
      failures.push('runtimeProvenance combined runtime-tree digest is invalid');
    }
  }
  const tools = runtimeProvenance.tools;
  if (!hasExactObjectKeys(tools, ['browser', 'expoCli', 'git', 'node', 'npmCli'])) {
    failures.push('runtimeProvenance tools must bind the exact reviewed tool set');
  } else {
    for (const [name, record] of Object.entries(tools)) {
      if (
        !hasExactObjectKeys(record, ['basename', 'bytes', 'sha256', 'version']) ||
        typeof record.basename !== 'string' ||
        record.basename.length < 1 ||
        record.basename.length > 128 ||
        !Number.isSafeInteger(record.bytes) ||
        record.bytes <= 0 ||
        !/^[0-9a-f]{64}$/u.test(String(record.sha256 ?? '')) ||
        typeof record.version !== 'string' ||
        record.version.length < 1 ||
        Buffer.byteLength(record.version, 'utf8') > 256 ||
        record.version === 'version-not-recorded' ||
        (name === 'browser' &&
          !/^(?:Chrome|HeadlessChrome)\/[0-9]+(?:\.[0-9]+){1,4}$/u.test(record.version))
      ) {
        failures.push(`runtimeProvenance ${name} tool record is invalid`);
      }
    }
  }
  return failures;
}

function collectCat07BrowserEvidenceIntegrityFailures(
  events,
  {
    bootstrapResults = [],
    completedAt = null,
    runId = null,
    scenarios = [],
    startedAt = null,
  } = {},
) {
  const failures = [];
  if (!Array.isArray(events) || events.length === 0) {
    return [{ type: 'empty-browser-event-evidence' }];
  }

  const requestIds = new Set();
  const responseIds = new Set();
  const requestUrls = new Map();
  const navigationUrls = [];
  const methodCounts = new Map();
  let previousObservedAt = -Infinity;
  const evidenceStartedAt = Date.parse(String(startedAt ?? ''));
  const evidenceCompletedAt = Date.parse(String(completedAt ?? ''));
  const enforceEvidenceWindow =
    Number.isFinite(evidenceStartedAt) && Number.isFinite(evidenceCompletedAt);

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedKeys = CAT07_BROWSER_EVENT_KEYS[event?.method];
    if (
      !expectedKeys ||
      !hasExactObjectKeys(event, expectedKeys) ||
      typeof event.method !== 'string' ||
      event.method.length === 0
    ) {
      failures.push({ index, type: 'invalid-browser-event-shape' });
      continue;
    }
    if (expectedKeys.includes('urlPolicyViolation') && event.urlPolicyViolation !== false) {
      failures.push({ index, type: 'unreviewed-url-components' });
    }
    if (typeof event.url === 'string') {
      try {
        const parsedEventUrl = new URL(event.url);
        if (parsedEventUrl.hash.length > 0) {
          failures.push({ index, type: 'unreviewed-url-fragment' });
        }
        if (
          event.method.startsWith('Network.') &&
          parsedEventUrl.search.length > 0 &&
          parsedEventUrl.search !== '?redacted-query'
        ) {
          failures.push({ index, type: 'unredacted-network-query' });
        }
      } catch {
        failures.push({ index, type: 'invalid-browser-event-url' });
      }
    }
    const observedAt = Date.parse(event.observedAt);
    if (!Number.isFinite(observedAt)) {
      failures.push({ index, type: 'invalid-browser-event-timestamp' });
    } else {
      if (observedAt < previousObservedAt) {
        failures.push({ index, type: 'nonmonotonic-browser-event-timestamp' });
      }
      if (
        enforceEvidenceWindow &&
        (observedAt < evidenceStartedAt || observedAt > evidenceCompletedAt)
      ) {
        failures.push({ index, type: 'browser-event-outside-summary-window' });
      }
      previousObservedAt = observedAt;
    }
    methodCounts.set(event.method, (methodCounts.get(event.method) ?? 0) + 1);

    if (
      event.method === 'Page.frameStartedNavigating' ||
      event.method === 'Page.navigatedWithinDocument'
    ) {
      if (typeof event.url === 'string') {
        navigationUrls.push({ observedAt: event.observedAt, url: event.url });
      }
    } else if (event.method === 'Page.frameNavigated' && typeof event.url === 'string') {
      navigationUrls.push({ observedAt: event.observedAt, url: event.url });
    }
    if (event.method === 'Network.requestWillBeSent') {
      const requestId = event.requestId;
      if (typeof requestId !== 'string' || requestId.length === 0) {
        failures.push({ index, type: 'missing-network-request-id' });
      } else if (requestIds.has(requestId)) {
        failures.push({ index, requestId, type: 'duplicate-network-request-id' });
      } else {
        requestIds.add(requestId);
        requestUrls.set(requestId, event.url);
      }
    } else if (event.method === 'Network.responseReceived') {
      const requestId = event.requestId;
      if (typeof requestId !== 'string' || requestId.length === 0) {
        failures.push({ index, type: 'missing-network-response-id' });
      } else if (responseIds.has(requestId)) {
        failures.push({ index, requestId, type: 'duplicate-network-response-id' });
      } else {
        responseIds.add(requestId);
        if (!requestIds.has(requestId)) {
          failures.push({ index, requestId, type: 'network-response-before-request' });
        } else if (event.url !== requestUrls.get(requestId)) {
          failures.push({ index, requestId, type: 'network-request-response-url-mismatch' });
        }
      }
    }
  }

  const matchedRequestIds = [...requestIds].filter((requestId) => responseIds.has(requestId));
  if (matchedRequestIds.length === 0) {
    failures.push({ type: 'missing-matched-request-response-ids' });
  }
  const unmatchedRequestIds = [...requestIds].filter((requestId) => !responseIds.has(requestId));
  const unmatchedResponseIds = [...responseIds].filter((requestId) => !requestIds.has(requestId));
  if (unmatchedRequestIds.length > 0 || unmatchedResponseIds.length > 0) {
    failures.push({ type: 'unmatched-request-response-ids' });
  }

  for (const method of [
    'Page.frameNavigated',
    'Page.navigatedWithinDocument',
    'Runtime.executionContextCreated',
  ]) {
    if ((methodCounts.get(method) ?? 0) < CAT07_SHELF_FRESHNESS_VIEWPORTS.length) {
      failures.push({ method, type: 'insufficient-browser-lifecycle-coverage' });
    }
  }

  const markerDefinitions = [];
  for (const viewport of CAT07_SHELF_FRESHNESS_VIEWPORTS) {
    const bootstrap = bootstrapResults.find(
      (result) => cat07ShelfFreshnessViewportKey(result?.viewport) === viewport.id,
    );
    const scenario = scenarios.find(
      (result) => cat07ShelfFreshnessViewportKey(result?.viewport) === viewport.id,
    );
    markerDefinitions.push(
      {
        completedAt: bootstrap?.completedAt,
        marker: cat07ShelfFreshnessMarker(runId, viewport.id, 'bootstrap'),
        parameter: 'cat04Bootstrap',
        step: 'bootstrap',
        startedAt: bootstrap?.startedAt,
        viewportId: viewport.id,
      },
      {
        completedAt: bootstrap?.completedAt,
        marker: cat07ShelfFreshnessMarker(runId, viewport.id, 'consent-probe'),
        parameter: 'cat04ConsentProbe',
        step: 'consent-probe',
        startedAt: bootstrap?.startedAt,
        viewportId: viewport.id,
      },
      {
        completedAt: scenario?.completedAt,
        marker: cat07ShelfFreshnessMarker(runId, viewport.id, 'manual'),
        parameter: 'cat04Audit',
        step: 'manual',
        startedAt: scenario?.startedAt,
        viewportId: viewport.id,
      },
      {
        completedAt: scenario?.completedAt,
        marker: cat07ShelfFreshnessMarker(runId, viewport.id, 'persisted-shelf'),
        parameter: 'cat04Audit',
        step: 'persisted-shelf',
        startedAt: scenario?.startedAt,
        viewportId: viewport.id,
      },
    );
  }
  const allowedMarkersByParameter = new Map();
  for (const { marker, parameter } of markerDefinitions) {
    const allowed = allowedMarkersByParameter.get(parameter) ?? new Set();
    allowed.add(marker);
    allowedMarkersByParameter.set(parameter, allowed);
  }
  const parsedNavigations = navigationUrls.flatMap((entry, index) => {
    try {
      return [{ ...entry, parsed: new URL(entry.url) }];
    } catch {
      failures.push({ index, type: 'invalid-navigation-url', url: entry.url });
      return [];
    }
  });
  for (const navigation of parsedNavigations) {
    const pairs = [...navigation.parsed.searchParams];
    const canonicalSearch = pairs.length > 0 ? `?${new URLSearchParams(pairs).toString()}` : '';
    const bootstrapQuery =
      pairs.length === 2 &&
      pairs[0][0] === 'e2eReset' &&
      pairs[0][1] === 'local' &&
      pairs[1][0] === 'cat04Bootstrap' &&
      allowedMarkersByParameter.get('cat04Bootstrap')?.has(pairs[1][1]);
    const singleMarkerQuery =
      pairs.length === 1 &&
      ['cat04Audit', 'cat04ConsentProbe'].includes(pairs[0][0]) &&
      allowedMarkersByParameter.get(pairs[0][0])?.has(pairs[0][1]);
    const singleRouteIdentifierQuery =
      pairs.length === 1 &&
      ((navigation.parsed.pathname === '/shelf/opened' && pairs[0][0] === 'intakeId') ||
        (navigation.parsed.pathname === '/shelf/replenish' && pairs[0][0] === 'id')) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(pairs[0][1]);
    if (
      navigation.parsed.hash.length > 0 ||
      navigation.parsed.search !== canonicalSearch ||
      (pairs.length > 0 && !bootstrapQuery && !singleMarkerQuery && !singleRouteIdentifierQuery)
    ) {
      failures.push({ type: 'unreviewed-navigation-query' });
    }
    for (const [parameter, allowed] of allowedMarkersByParameter) {
      const values = navigation.parsed.searchParams.getAll(parameter);
      if (values.length > 1) {
        failures.push({ parameter, type: 'duplicate-cat07-browser-marker' });
      }
      for (const marker of values) {
        if (!allowed.has(marker)) {
          failures.push({ marker, parameter, type: 'unexpected-cat07-browser-marker' });
        }
      }
    }
  }
  const markerObservedAt = new Map();
  for (const definition of markerDefinitions) {
    const matches = parsedNavigations.filter(
      ({ parsed }) =>
        parsed.searchParams.getAll(definition.parameter).length === 1 &&
        parsed.searchParams.get(definition.parameter) === definition.marker,
    );
    if (matches.length === 0) {
      failures.push({ marker: definition.marker, type: 'missing-cat07-browser-marker' });
      continue;
    }
    markerObservedAt.set(
      `${definition.viewportId}:${definition.step}`,
      Math.min(...matches.map(({ observedAt }) => Date.parse(observedAt))),
    );
    const markerStartedAt = Date.parse(String(definition.startedAt ?? ''));
    const markerCompletedAt = Date.parse(String(definition.completedAt ?? ''));
    if (
      !Number.isFinite(markerStartedAt) ||
      !Number.isFinite(markerCompletedAt) ||
      matches.some(({ observedAt }) => {
        const observed = Date.parse(observedAt);
        return (
          !Number.isFinite(observed) || observed < markerStartedAt || observed > markerCompletedAt
        );
      })
    ) {
      failures.push({
        marker: definition.marker,
        type: 'cat07-browser-marker-outside-child-window',
      });
    }
  }
  for (const viewport of CAT07_SHELF_FRESHNESS_VIEWPORTS) {
    for (const [before, after] of [
      ['bootstrap', 'consent-probe'],
      ['manual', 'persisted-shelf'],
    ]) {
      const beforeAt = markerObservedAt.get(`${viewport.id}:${before}`);
      const afterAt = markerObservedAt.get(`${viewport.id}:${after}`);
      if (Number.isFinite(beforeAt) && Number.isFinite(afterAt) && beforeAt > afterAt) {
        failures.push({
          after,
          before,
          type: 'cat07-browser-marker-order',
          viewportId: viewport.id,
        });
      }
    }
  }

  return failures;
}

function inspectCat07BrowserEvidenceEnvelope(contents, summary) {
  const failures = [];
  if (
    !hasExactObjectKeys(contents, ['evidenceBinding', 'events', 'retention', 'schemaVersion']) ||
    contents?.schemaVersion !== CAT07_BROWSER_EVIDENCE_SCHEMA_VERSION ||
    !Array.isArray(contents?.events)
  ) {
    return {
      events: [],
      failures: ['browser-events-cat07-freshness.json must use the exact projected-event schema'],
    };
  }
  if (
    !hasExactObjectKeys(contents.evidenceBinding, ['runId', 'sourceGitSha']) ||
    contents.evidenceBinding.runId !== summary?.runId ||
    contents.evidenceBinding.sourceGitSha !== summary?.sourceGitSha
  ) {
    failures.push('browser event evidenceBinding must match summary runId and sourceGitSha');
  }
  const retention = contents.retention;
  if (
    !hasExactObjectKeys(retention, [
      'ignoredFrameCount',
      'inputFrameBytes',
      'inputFrameCount',
      'limits',
      'retainedEventCount',
      'responseFrameCount',
      'sanitizedBytes',
      'truncated',
    ]) ||
    !hasExactObjectKeys(retention?.limits, [
      'maxFrameBytes',
      'maxInputBytes',
      'maxInputFrames',
      'maxRetainedBytes',
      'maxRetainedEvents',
    ])
  ) {
    failures.push('browser event retention must use the exact reviewed schema');
  } else {
    for (const field of [
      'ignoredFrameCount',
      'inputFrameBytes',
      'inputFrameCount',
      'retainedEventCount',
      'responseFrameCount',
      'sanitizedBytes',
    ]) {
      if (!Number.isSafeInteger(retention[field]) || retention[field] < 0) {
        failures.push(`browser event retention.${field} must be a non-negative safe integer`);
      }
    }
    if (
      retention.limits.maxFrameBytes !== CAT07_MAX_CDP_FRAME_BYTES ||
      retention.limits.maxInputBytes !== CAT07_MAX_INPUT_CDP_BYTES ||
      retention.limits.maxInputFrames !== CAT07_MAX_INPUT_CDP_FRAMES ||
      retention.limits.maxRetainedBytes !== CAT07_MAX_BROWSER_EVENT_BYTES ||
      retention.limits.maxRetainedEvents !== CAT07_MAX_RETAINED_BROWSER_EVENTS
    ) {
      failures.push('browser event retention limits do not match the runner limits');
    }
    const exactSanitizedBytes = Buffer.byteLength(JSON.stringify(contents.events), 'utf8');
    if (
      retention.retainedEventCount !== contents.events.length ||
      retention.inputFrameCount !==
        retention.retainedEventCount + retention.ignoredFrameCount + retention.responseFrameCount ||
      retention.inputFrameCount > CAT07_MAX_INPUT_CDP_FRAMES ||
      retention.inputFrameBytes > CAT07_MAX_INPUT_CDP_BYTES ||
      retention.inputFrameBytes < exactSanitizedBytes ||
      retention.retainedEventCount > CAT07_MAX_RETAINED_BROWSER_EVENTS ||
      retention.sanitizedBytes !== exactSanitizedBytes ||
      exactSanitizedBytes > CAT07_MAX_BROWSER_EVENT_BYTES ||
      retention.truncated !== false
    ) {
      failures.push('browser event retention counts, bytes, or truncation state are inconsistent');
    }
  }
  return { events: contents.events, failures };
}

const CAT04_CATALOG_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);

const CAT04_CATALOG_FIXTURE_GROUPS = Object.freeze([
  'matched',
  'no-match',
  'offline',
  'scan-error',
  'camera-recovery',
  'ocr-capture-failure',
]);

const CAT04_CATALOG_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'search-matched',
    fixture: 'matched',
    groupId: 'matched',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-matched',
    fixture: 'matched',
    groupId: 'matched',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-wrong-match-recovery',
    fixture: 'matched_wrong_match_recovery',
    groupId: 'matched',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'search-no-match',
    fixture: 'no_match',
    groupId: 'no-match',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-no-match',
    fixture: 'no_match',
    groupId: 'no-match',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'search-wrong-match-recovery',
    fixture: 'wrong_match',
    groupId: 'scan-error',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'search-offline',
    fixture: 'offline',
    groupId: 'offline',
    route: '/shelf/search',
  }),
  Object.freeze({
    id: 'scan-offline',
    fixture: 'offline',
    groupId: 'offline',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-error',
    fixture: 'error',
    groupId: 'scan-error',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'scan-camera-denied-settings-failure',
    fixture: 'denied_no_retry',
    groupId: 'camera-recovery',
    route: '/shelf/scan',
  }),
  Object.freeze({
    id: 'ocr-camera-denied-settings-failure',
    fixture: 'denied_no_retry',
    groupId: 'camera-recovery',
    route: '/shelf/ocr',
  }),
  Object.freeze({
    id: 'ocr-capture-failure',
    fixture: 'capture_failure_once',
    groupId: 'ocr-capture-failure',
    route: '/shelf/ocr',
  }),
  Object.freeze({
    id: 'no-match-missing-barcode',
    fixture: 'missing_barcode',
    groupId: 'ocr-capture-failure',
    route: '/shelf/no-match',
  }),
  Object.freeze({
    id: 'catalog-recovery-malformed',
    fixture: 'malformed_params',
    groupId: 'ocr-capture-failure',
    route: '/shelf/catalog-recovery',
  }),
  Object.freeze({
    id: 'manual-barcode-validation',
    fixture: 'manual_barcode_validation',
    groupId: 'ocr-capture-failure',
    route: '/shelf/manual',
  }),
]);

function cat04ViewportKey(viewport) {
  if (!hasExactObjectKeys(viewport, ['id', 'width', 'height'])) return null;
  const expected = CAT04_CATALOG_VIEWPORTS.find(({ id }) => id === viewport.id);
  if (!expected || viewport.width !== expected.width || viewport.height !== expected.height) {
    return null;
  }
  return expected.id;
}

const CAT05_NATIVE_OCR_EVIDENCE_DATE = '2026-07-22';
const CAT05_NATIVE_OCR_SCHEMA_VERSION = 2;
const CAT05_NATIVE_OCR_ARTIFACT_COUNT = 139;
const CAT05_NATIVE_OCR_SCREENSHOT_COUNT = 55;
const CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES = 256 * 1024;
const CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_ARTIFACT_BYTES = 8 * 1024 * 1024;
const CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_STRING_BYTES = 128 * 1024;
const CAT05_NATIVE_OCR_MAX_SCREENSHOT_BYTES = 16 * 1024 * 1024;
const CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS = 5_000;
const CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES = 4 * 1024 * 1024;
const CAT05_NATIVE_OCR_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'iphone-375x667', width: 375, height: 667 }),
  Object.freeze({ id: 'iphone-390x844', width: 390, height: 844 }),
  Object.freeze({ id: 'iphone-430x932', width: 430, height: 932 }),
]);
const CAT05_NATIVE_OCR_FIXTURE_GROUPS = Object.freeze([
  'recognized',
  'no-text',
  'timed-out',
  'failed',
]);
const CAT05_NATIVE_OCR_SCENARIOS = Object.freeze([
  Object.freeze({
    fixture: 'recognized',
    groupId: 'recognized',
    id: 'recognized-review-retake-continue',
  }),
  Object.freeze({
    fixture: 'recognized',
    groupId: 'recognized',
    id: 'edit-fence-suggestion-adoption',
  }),
  Object.freeze({
    fixture: 'no_text',
    groupId: 'no-text',
    id: 'no-text-manual-recovery',
  }),
  Object.freeze({
    fixture: 'timed_out',
    groupId: 'timed-out',
    id: 'timeout-manual-recovery',
  }),
  Object.freeze({ fixture: 'failed', groupId: 'failed', id: 'failure-manual-recovery' }),
]);
const CAT05_NATIVE_OCR_CANDIDATE_BUILD = Object.freeze({
  archiveSha256: null,
  easIosBuildId: null,
  executedByThisAudit: false,
  profile: 'staging',
  proofStatus: 'not_applicable_to_expo_web_ui_audit',
});
const CAT05_NATIVE_OCR_LIMITATIONS = Object.freeze([
  'This is deterministic Expo-web UI-state evidence produced by a development-only fixture.',
  'It does not execute Apple Vision, the Swift bridge, a camera, a real label image, or an iOS binary.',
  'Its raw-photo cache and cleanup checks are source assertions only; they do not prove runtime deletion, cache behavior, or privacy on a native device.',
  'It is not physical-iPhone, iOS Simulator, native accessibility, OCR accuracy, OCR latency, runtime cleanup, native privacy, zero-network, archive, App Review, or release evidence.',
  'Its local-only browser-request assertion covers this synthetic web run only and must not be used as a native photo or transcript privacy claim.',
]);
const CAT05_NATIVE_OCR_PROVES = Object.freeze([
  'The Expo-web route renders and permits user interaction with the declared deterministic OCR review states.',
  'The route preserves a user edit against a late deterministic fixture result and requires explicit suggestion adoption.',
  'The route preserves the fixture Unicode transcript through the editable review and supported manual handoff surface.',
  'The supported web viewports pass the scripted control-name, 44px proxy, center-hit, clipping, and horizontal-overflow checks.',
  'The synthetic browser run emitted no disallowed console/page/network/dialog failure under the local-only fixture environment.',
  'The source candidate contains the declared no-cache preview, trusted-cache-URI, guarded-navigation, and awaited-cleanup assertions; this is source proof only.',
]);
const CAT05_NATIVE_OCR_PRIVACY_ASSERTIONS = Object.freeze([
  'label-preview-hidden-during-cleanup-and-cache-disabled',
  'label-route-removal-cancels-recognition-before-photo-cleanup',
  'progress-capture-accepts-only-trusted-camera-cache-uri',
  'progress-review-preview-cache-disabled',
  'progress-review-route-removal-awaits-discard',
  'progress-helper-restricts-and-deletes-owned-cache-source',
]);
const CAT05_NATIVE_OCR_PRIVACY_FILES = Object.freeze([
  'apps/mobile/src/app/progress/capture.tsx',
  'apps/mobile/src/app/progress/review.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/features/photos/progressCapturePrivacy.ts',
]);
const CAT05_DOCUMENTATION_ONLY_ROOT_PATHS = new Set([
  'BLOCKERS.md',
  'LAUNCH_READINESS.md',
  'PROGRESS.md',
]);

function cat05DocumentationOnlyPath(path) {
  const normalized = normalizeRepoPath(path);
  return normalized.startsWith('docs/') || CAT05_DOCUMENTATION_ONLY_ROOT_PATHS.has(normalized);
}
const CAT05_NATIVE_OCR_SUMMARY_KEYS = Object.freeze([
  'artifactCount',
  'artifactManifest',
  'artifacts',
  'browserFailureCount',
  'browserPath',
  'candidateNativeBuild',
  'completedAt',
  'evidenceBinding',
  'evidenceSchemaVersion',
  'expectedBootstrapCount',
  'expectedExecutionCount',
  'fixtureGroups',
  'groupBrowserAudits',
  'limitations',
  'nativeDeviceProof',
  'passedBootstrapCount',
  'passedExecutionCount',
  'privacySourceContract',
  'results',
  'runId',
  'scenarioMatrix',
  'screenshots',
  'sourceGitSha',
  'startedAt',
  'surface',
  'verdict',
  'viewports',
  'webFixtureBuild',
]);
const CAT05_NATIVE_OCR_BINDING_KEYS = Object.freeze([
  'candidateNativeBuild',
  'evidenceSchemaVersion',
  'expectedSourceGitSha',
  'fixtureConfigurationSha256',
  'runId',
  'scenarioMatrixSha256',
  'sourceGitSha',
  'viewportMatrixSha256',
  'webFixtureBuild',
]);
const CAT05_NATIVE_OCR_ARTIFACT_BINDING_KEYS = Object.freeze([
  ...CAT05_NATIVE_OCR_BINDING_KEYS,
  'artifactName',
  'fixtureGroup',
  'scenarioId',
  'viewport',
]);

function cat05Sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cat05Sha256Json(value) {
  return cat05Sha256(JSON.stringify(value));
}

function cat05ViewportKey(viewport) {
  if (!hasExactObjectKeys(viewport, ['id', 'width', 'height'])) return null;
  const expected = CAT05_NATIVE_OCR_VIEWPORTS.find(({ id }) => id === viewport.id);
  if (!expected || viewport.width !== expected.width || viewport.height !== expected.height) {
    return null;
  }
  return expected.id;
}

function cat05ArtifactPair(prefix) {
  return [`${prefix}.json`, `${prefix}.png`];
}

function expectedCat05NativeOcrArtifacts() {
  const artifacts = ['report.md', 'scope.json'];
  const bootstrapViewport = CAT05_NATIVE_OCR_VIEWPORTS[1];
  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    const prefix = `bootstrap-${fixtureGroup}-${bootstrapViewport.id}`;
    artifacts.push(
      `browser-events-${fixtureGroup}.json`,
      `expo-${fixtureGroup}.log`,
      ...cat05ArtifactPair(`${prefix}-ocr-ready`),
      `${prefix}-result.json`,
    );
  }
  for (const scenario of CAT05_NATIVE_OCR_SCENARIOS) {
    for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
      const prefix = `${scenario.id}-${viewport.id}`;
      artifacts.push(...cat05ArtifactPair(`${prefix}-initial`), `${prefix}-result.json`);
      if (scenario.id === 'recognized-review-retake-continue') {
        artifacts.push(
          ...cat05ArtifactPair(`${prefix}-recognized-ready`),
          ...cat05ArtifactPair(`${prefix}-retake-ready`),
          ...cat05ArtifactPair(`${prefix}-manual-handoff`),
        );
      } else if (scenario.id === 'edit-fence-suggestion-adoption') {
        artifacts.push(
          ...cat05ArtifactPair(`${prefix}-edit-kept`),
          ...cat05ArtifactPair(`${prefix}-suggestion-adopted`),
          ...cat05ArtifactPair(`${prefix}-manual-handoff`),
        );
      } else {
        const stateSuffix = {
          'failure-manual-recovery': 'failed',
          'no-text-manual-recovery': 'no-text',
          'timeout-manual-recovery': 'timed-out',
        }[scenario.id];
        artifacts.push(
          ...cat05ArtifactPair(`${prefix}-${stateSuffix}`),
          ...cat05ArtifactPair(`${prefix}-manual-handoff`),
        );
      }
    }
  }
  return [...new Set(artifacts)].sort();
}

function expectedCat05ArtifactBindingMetadata(artifact) {
  if (artifact === 'scope.json') return null;
  const artifactName = artifact.replace(/\.json$/u, '');
  for (const scenario of CAT05_NATIVE_OCR_SCENARIOS) {
    for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
      if (!artifactName.startsWith(`${scenario.id}-${viewport.id}-`)) continue;
      return {
        artifactName,
        fixtureGroup: scenario.groupId,
        scenarioId: scenario.id,
        viewport: { height: viewport.height, id: viewport.id, width: viewport.width },
      };
    }
  }
  const bootstrapViewport = CAT05_NATIVE_OCR_VIEWPORTS[1];
  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    if (artifactName.startsWith(`bootstrap-${fixtureGroup}-${bootstrapViewport.id}-`)) {
      return {
        artifactName,
        fixtureGroup,
        scenarioId: null,
        viewport: {
          height: bootstrapViewport.height,
          id: bootstrapViewport.id,
          width: bootstrapViewport.width,
        },
      };
    }
    if (artifactName === `browser-events-${fixtureGroup}`) {
      return { artifactName, fixtureGroup, scenarioId: null, viewport: null };
    }
  }
  return undefined;
}

function cat05ExpectedScreenshotDimensions(artifact) {
  for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
    if (artifact.includes(`-${viewport.id}-`)) {
      return { height: viewport.height, width: viewport.width };
    }
  }
  return null;
}

function parsePngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(bytes) || bytes.length < 45 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error('invalid PNG signature or complete chunk stream');
  }
  if (bytes.length > CAT05_NATIVE_OCR_MAX_SCREENSHOT_BYTES) {
    throw new Error(`PNG exceeds ${CAT05_NATIVE_OCR_MAX_SCREENSHOT_BYTES} bytes`);
  }

  let offset = signature.length;
  let chunkIndex = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  let headerDimensions = null;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('truncated PNG chunk header');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const nextOffset = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/.test(type) || nextOffset > bytes.length) {
      throw new Error('invalid or truncated PNG chunk');
    }
    if (type === 'IHDR') {
      if (chunkIndex !== 0 || sawHeader || length !== 13) {
        throw new Error('PNG must contain one leading 13-byte IHDR chunk');
      }
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) {
        throw new Error('invalid or unsafe PNG dimensions');
      }
      headerDimensions = { height, width };
      sawHeader = true;
    } else if (type === 'IDAT') {
      if (!sawHeader || sawEnd) throw new Error('PNG IDAT appears outside the image stream');
      sawImageData = true;
    } else if (type === 'IEND') {
      if (!sawHeader || !sawImageData || sawEnd || length !== 0 || nextOffset !== bytes.length) {
        throw new Error('PNG must end with one terminal zero-byte IEND chunk');
      }
      sawEnd = true;
    }
    offset = nextOffset;
    chunkIndex += 1;
  }
  if (!sawHeader || !sawImageData || !sawEnd || !headerDimensions) {
    throw new Error('PNG is missing IHDR, IDAT, or IEND');
  }

  let decoded;
  try {
    decoded = PNG.sync.read(bytes, { checkCRC: true });
  } catch (error) {
    throw new Error(
      `PNG decode or CRC validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    decoded.width !== headerDimensions.width ||
    decoded.height !== headerDimensions.height ||
    !decoded.data ||
    decoded.data.length !== decoded.width * decoded.height * 4
  ) {
    throw new Error('decoded PNG pixels do not match the declared IHDR dimensions');
  }
  return headerDimensions;
}

function cat05DiagnosticPolicyFailures(label, value) {
  return collectEvidenceDiagnosticPolicyFailures(label, value);
}

function cat05DiagnosticValueFailures(label, value) {
  return collectEvidenceDiagnosticValueFailures(label, value, {
    maxStringBytes: CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_STRING_BYTES,
  });
}

function cat05TextArtifactHygieneFailures(label, bytes, maxBytes) {
  return collectEvidenceTextArtifactHygieneFailures(label, bytes, { maxBytes });
}

const CAT05_BROWSER_EVENT_KEYS = Object.freeze({
  'Log.entryAdded': ['method', 'observedAt', 'params'],
  'Network.requestWillBeSent': [
    'documentURL',
    'method',
    'observedAt',
    'requestId',
    'requestMethod',
    'type',
    'url',
  ],
  'Network.responseReceived': [
    'method',
    'mimeType',
    'observedAt',
    'requestId',
    'status',
    'type',
    'url',
  ],
  'Network.webSocketCreated': ['method', 'observedAt', 'params'],
  'Runtime.consoleAPICalled': ['method', 'observedAt', 'text', 'type'],
});

const CAT05_REJECTED_BROWSER_EVENT_KEYS = Object.freeze({
  'Inspector.targetCrashed': ['method', 'observedAt', 'params'],
  'Network.loadingFailed': ['canceled', 'errorText', 'method', 'observedAt', 'requestId', 'type'],
  'Network.webSocketFrameError': ['method', 'observedAt', 'params'],
  'Page.crashed': ['method', 'observedAt', 'params'],
  'Page.javascriptDialogOpening': ['method', 'observedAt', 'params'],
  'Runtime.exceptionThrown': ['method', 'observedAt', 'params'],
});

function parseCat05ReviewedLocalUrl(label, value, expectedProtocol) {
  try {
    const parsed = new URL(String(value ?? ''));
    if (
      parsed.protocol !== expectedProtocol ||
      parsed.hostname !== 'localhost' ||
      !/^\d+$/.test(parsed.port) ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      (parsed.search && parsed.search !== '?redacted-query')
    ) {
      return { failure: `${label} must be a sanitized localhost ${expectedProtocol} URL` };
    }
    return { parsed };
  } catch {
    return { failure: `${label} must be a valid sanitized localhost URL` };
  }
}

function collectCat05BrowserEventFailures(artifact, contents) {
  const failures = [];
  if (
    !hasExactObjectKeys(contents, ['evidenceBinding', 'events', 'retention']) ||
    !Array.isArray(contents?.events)
  ) {
    return [`${artifact} must use the exact bound browser-event and retention schema`];
  }

  const { events, retention } = contents;
  if (
    !hasExactObjectKeys(retention, [
      'ignoredEventCount',
      'inputEventCount',
      'limits',
      'retainedEventCount',
      'sanitizedBytes',
      'truncated',
    ]) ||
    !hasExactObjectKeys(retention?.limits, ['maxRetainedBytes', 'maxRetainedEvents'])
  ) {
    failures.push(`${artifact} retention must use the exact reviewed schema`);
  } else {
    for (const key of [
      'ignoredEventCount',
      'inputEventCount',
      'retainedEventCount',
      'sanitizedBytes',
    ]) {
      if (!Number.isSafeInteger(retention[key]) || retention[key] < 0) {
        failures.push(`${artifact} retention.${key} must be a non-negative safe integer`);
      }
    }
    if (
      retention.limits.maxRetainedBytes !== CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES ||
      retention.limits.maxRetainedEvents !== CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS
    ) {
      failures.push(`${artifact} retention limits do not match the reviewed runner limits`);
    }
    if (
      retention.retainedEventCount !== events.length ||
      retention.inputEventCount !== retention.retainedEventCount + retention.ignoredEventCount
    ) {
      failures.push(`${artifact} retention event counts are inconsistent`);
    }
    const serializedBytes = Buffer.byteLength(JSON.stringify(events), 'utf8');
    if (
      retention.sanitizedBytes !== serializedBytes ||
      serializedBytes > CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES ||
      events.length > CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS
    ) {
      failures.push(`${artifact} retention byte or event limits are inconsistent`);
    }
    if (retention.truncated !== false) {
      failures.push(`${artifact} retention.truncated must be false`);
    }
  }

  const requestIds = [];
  const responseIds = [];
  const httpOrigins = new Set();
  const websocketPorts = new Set();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const label = `${artifact} event ${index + 1}`;
    const expectedKeys =
      CAT05_BROWSER_EVENT_KEYS[event?.method] ?? CAT05_REJECTED_BROWSER_EVENT_KEYS[event?.method];
    if (!expectedKeys) {
      failures.push(`${label} has an unreviewed method: ${String(event?.method ?? 'missing')}`);
      continue;
    }
    if (!hasExactObjectKeys(event, expectedKeys)) {
      failures.push(`${label} does not use the exact ${event.method} schema`);
    }
    if (!Number.isFinite(Date.parse(String(event?.observedAt ?? '')))) {
      failures.push(`${label} must contain a valid observedAt timestamp`);
    }
    if (Object.hasOwn(CAT05_REJECTED_BROWSER_EVENT_KEYS, event.method)) {
      failures.push(`${label} contains disallowed browser failure method ${event.method}`);
      continue;
    }

    if (event.method === 'Network.requestWillBeSent') {
      if (
        typeof event.requestId !== 'string' ||
        event.requestId.length === 0 ||
        event.requestId.length > 256 ||
        typeof event.requestMethod !== 'string' ||
        !/^[A-Z]+$/.test(event.requestMethod) ||
        typeof event.type !== 'string' ||
        event.type.length === 0
      ) {
        failures.push(`${label} has invalid request identity metadata`);
      }
      requestIds.push(event.requestId);
      for (const [field, value] of [
        ['documentURL', event.documentURL],
        ['url', event.url],
      ]) {
        const parsed = parseCat05ReviewedLocalUrl(`${label}.${field}`, value, 'http:');
        if (parsed.failure) failures.push(parsed.failure);
        else httpOrigins.add(parsed.parsed.origin);
      }
    } else if (event.method === 'Network.responseReceived') {
      if (
        typeof event.requestId !== 'string' ||
        event.requestId.length === 0 ||
        event.requestId.length > 256 ||
        typeof event.mimeType !== 'string' ||
        event.mimeType.length === 0 ||
        typeof event.type !== 'string' ||
        event.type.length === 0 ||
        !Number.isFinite(event.status) ||
        event.status < 100 ||
        event.status >= 400
      ) {
        failures.push(`${label} has invalid response identity metadata`);
      }
      responseIds.push(event.requestId);
      const parsed = parseCat05ReviewedLocalUrl(`${label}.url`, event.url, 'http:');
      if (parsed.failure) failures.push(parsed.failure);
      else httpOrigins.add(parsed.parsed.origin);
    } else if (event.method === 'Network.webSocketCreated') {
      if (!event.params || typeof event.params !== 'object' || Array.isArray(event.params)) {
        failures.push(`${label}.params must be a sanitized object`);
      } else {
        const parsed = parseCat05ReviewedLocalUrl(`${label}.params.url`, event.params.url, 'ws:');
        if (parsed.failure) failures.push(parsed.failure);
        else websocketPorts.add(parsed.parsed.port);
      }
    } else if (event.method === 'Runtime.consoleAPICalled') {
      if (
        typeof event.text !== 'string' ||
        typeof event.type !== 'string' ||
        event.type.length === 0
      ) {
        failures.push(`${label} must contain bounded console text and type strings`);
      }
      if (['assert', 'error'].includes(String(event.type).toLowerCase())) {
        failures.push(`${label} contains an error-class browser console event`);
      }
    } else if (event.method === 'Log.entryAdded') {
      if (!event.params || typeof event.params !== 'object' || Array.isArray(event.params)) {
        failures.push(`${label}.params must be a sanitized object`);
      }
      if (String(event.params?.entry?.level ?? '').toLowerCase() === 'error') {
        failures.push(`${label} contains an error-level browser log`);
      }
    }
  }

  if (requestIds.length === 0 || responseIds.length === 0) {
    failures.push(`${artifact} must contain nonzero localhost request and response coverage`);
  }
  if (
    requestIds.length !== responseIds.length ||
    !isDeepStrictEqual([...new Set(requestIds)].sort(), [...new Set(responseIds)].sort())
  ) {
    failures.push(`${artifact} request and response IDs are not coherent`);
  }
  if (httpOrigins.size !== 1) {
    failures.push(`${artifact} must bind all HTTP traffic to one localhost origin`);
  } else if ([...websocketPorts].some((port) => port !== new URL([...httpOrigins][0]).port)) {
    failures.push(`${artifact} WebSocket traffic does not match the localhost HTTP port`);
  }

  return failures;
}

function buildExpectedCat05NativeOcrReport(summary) {
  const lines = [
    '# CAT05 Native OCR Review UI — Human-Simulated Expo-Web Audit',
    '',
    '## Scope Boundary',
    '',
    summary.verdict === 'pass'
      ? '**PASS — deterministic Expo-web OCR review UI-state evidence only.**'
      : '**FAIL — deterministic Expo-web OCR review UI-state audit.**',
    '',
    'This report is deliberately not native Vision, device, camera, label-image, OCR accuracy, runtime privacy, archive, App Review, or release evidence. Its cache/cleanup findings are source assertions only. A pass must never be used to enable or clear the native OCR launch gate.',
    '',
    ...CAT05_NATIVE_OCR_LIMITATIONS.map((limitation) => `- ${limitation}`),
    '',
    '## Run',
    '',
    `- Run ID: \`${summary.runId}\``,
    `- Source Git SHA: \`${summary.sourceGitSha}\``,
    `- Web fixture build ID: \`${summary.webFixtureBuild.buildId}\``,
    `- Web fixture profile: \`${summary.webFixtureBuild.profile}\``,
    `- Candidate source profile: \`${summary.candidateNativeBuild.profile}\``,
    '- Native EAS build ID: not applicable (this audit does not execute an iOS binary)',
    `- Started: ${summary.startedAt}`,
    `- Completed: ${summary.completedAt}`,
    `- Surface: ${summary.surface}`,
    `- Browser: ${summary.browserPath ?? 'unavailable'}`,
    `- Consent bootstraps: ${summary.passedBootstrapCount}/${summary.expectedBootstrapCount}`,
    `- Scenario executions: ${summary.passedExecutionCount}/${summary.expectedExecutionCount}`,
    `- Browser failures: ${summary.browserFailureCount}`,
    '- Native device proof: false',
    '',
    '## Scenario Matrix',
    '',
    '| Scenario | Viewport | Result | Error |',
    '| --- | --- | --- | --- |',
    ...summary.results
      .filter(({ kind }) => kind === 'scenario')
      .map(
        (result) =>
          `| ${result.scenarioId} | ${result.viewport.width}x${result.viewport.height} | ${result.verdict} | ${String(result.error ?? '').replace(/\|/g, '\\|')} |`,
      ),
    '',
    '## Human-Simulated Actions',
    '',
    '- Completed the real local age gate and explicit health-data consent UI for every fixture server.',
    '- Tapped Capture label, observed the reading state, reviewed the resulting state, typed and corrected text, adopted a recognized suggestion explicitly, retook, continued, and followed the manual fallback.',
    '- Exercised recognized, no-text, timeout, and failure branches at 375 x 667, 390 x 844, and 430 x 932.',
    '- Inspected accessible names, alert/live-region semantics, touch-target geometry, center hit tests, clipping, horizontal overflow, browser console/page errors, dialogs, and remote requests.',
    '',
    '## Remaining Native Gates',
    '',
    '- Compile and sign the Swift/Expo module on the release macOS/Xcode toolchain.',
    '- Exercise clear, curved, tiny, multilingual, and glare-heavy real labels on the required physical-iPhone matrix.',
    '- Prove native cancellation, timeout, edit-fence, retake, background/foreground, memory, cleanup, and process-death behavior.',
    '- Complete VoiceOver, Dynamic Type, traffic inspection, privacy/App Privacy reconciliation, performance thresholds, corpus rights, professional review, archive inspection, and exact-build evidence.',
    '',
    '## Command',
    '',
    '```text',
    'node scripts/e2e/cat05-native-ocr-ui-audit.mjs',
    '```',
  ];
  return `${lines.join('\n')}\n`;
}

function collectCat04CatalogRecoveryFailures({
  folder,
  peerEvidenceFolder,
  summary,
  trackedRepoFiles,
  sourceGitState,
  fileExists = exists,
  readJsonFile = readJson,
  readTextFile = readEvidenceText,
}) {
  const failures = [];
  const checkedFiles = new Set();
  const requiredArtifacts = new Set(['report.md']);
  const folderPrefix = `${normalizeRepoPath(folder).replace(/\/$/, '')}/`;
  const peerEvidenceFolderPrefix = governedHumanEvidenceFolderPrefix(
    peerEvidenceFolder,
    CAT05_NATIVE_OCR_EVIDENCE_FOLDER_NAME,
    folder,
    CAT04_CATALOG_RECOVERY_EVIDENCE_FOLDER_NAME,
  );
  if (!peerEvidenceFolderPrefix) {
    failures.push(
      'CAT04 peer evidence folder must be the exact dated CAT05 evidence directory on the same date as CAT04',
    );
  }
  const cat07EvidenceFolderPrefix = CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_PREFIX;
  const trackedFolderFiles = [...trackedRepoFiles]
    .filter((path) => normalizeRepoPath(path).startsWith(folderPrefix))
    .map((path) => normalizeRepoPath(path).slice(folderPrefix.length));

  const requireTrackedFile = (relativePath, label = relativePath) => {
    const normalized = normalizeEvidenceRelativePath(relativePath);
    if (!normalized || normalized !== relativePath) {
      failures.push(`${label} uses an unsafe evidence path`);
      return false;
    }
    requiredArtifacts.add(normalized);
    if (checkedFiles.has(normalized)) {
      return (
        fileExists(`${folder}/${normalized}`) &&
        trackedRepoFiles.has(normalizeRepoPath(`${folder}/${normalized}`))
      );
    }
    checkedFiles.add(normalized);
    const repoPath = normalizeRepoPath(`${folder}/${normalized}`);
    if (!fileExists(repoPath)) {
      failures.push(`missing CAT04 evidence file ${normalized}`);
      return false;
    }
    if (!trackedRepoFiles.has(repoPath)) {
      failures.push(`CAT04 evidence file is not Git-tracked: ${normalized}`);
      return false;
    }
    return true;
  };

  if (summary?.schemaVersion !== 1) {
    failures.push(
      `schemaVersion must be 1, received ${String(summary?.schemaVersion ?? 'missing')}`,
    );
  }
  if (summary?.surface !== 'expo-web') {
    failures.push(`surface must be expo-web, received ${String(summary?.surface ?? 'missing')}`);
  }
  if (summary?.nativeDeviceProof !== false) {
    failures.push('nativeDeviceProof must be false for this Expo-web compatibility gate');
  }
  if (summary?.verdict !== 'pass') {
    failures.push(
      `summary verdict must be pass, received ${String(summary?.verdict ?? 'missing')}`,
    );
  }
  if (!isDeepStrictEqual(summary?.requiredViewports, CAT04_CATALOG_VIEWPORTS)) {
    failures.push('requiredViewports must be exactly 375x667, 390x844, and 430x932');
  }
  if (!isDeepStrictEqual(summary?.fixtureGroups, CAT04_CATALOG_FIXTURE_GROUPS)) {
    failures.push('fixtureGroups must match the six reviewed CAT04 fixture groups');
  }
  if (!isDeepStrictEqual(summary?.scenarioDefinitions, CAT04_CATALOG_SCENARIOS)) {
    failures.push('scenarioDefinitions must match the 15 reviewed CAT04 recovery scenarios');
  }

  const expectedScenarioCount = CAT04_CATALOG_SCENARIOS.length * CAT04_CATALOG_VIEWPORTS.length;
  const expectedBootstrapCount =
    CAT04_CATALOG_FIXTURE_GROUPS.length * CAT04_CATALOG_VIEWPORTS.length;
  if (summary?.expectedExecutionCount !== expectedScenarioCount) {
    failures.push(
      `expectedExecutionCount must be ${expectedScenarioCount}, received ${String(summary?.expectedExecutionCount ?? 'missing')}`,
    );
  }
  if (summary?.expectedBootstrapCount !== expectedBootstrapCount) {
    failures.push(
      `expectedBootstrapCount must be ${expectedBootstrapCount}, received ${String(summary?.expectedBootstrapCount ?? 'missing')}`,
    );
  }

  const expectedScenarioById = new Map(
    CAT04_CATALOG_SCENARIOS.map((scenario) => [scenario.id, scenario]),
  );
  const scenarioKeys = new Set();
  const bootstrapKeys = new Set();
  const expectedPrefixes = [];

  const validateResult = ({ result, expectedPrefix, resultFile, context }) => {
    expectedPrefixes.push(expectedPrefix);
    if (result?.artifactPrefix !== expectedPrefix) {
      failures.push(
        `${context} artifactPrefix must be ${expectedPrefix}, received ${String(result?.artifactPrefix ?? 'missing')}`,
      );
    }
    if (result?.surface !== 'expo-web' || result?.nativeDeviceProof !== false) {
      failures.push(`${context} must retain Expo-web surface and nativeDeviceProof false`);
    }
    if (result?.verdict !== 'pass' || result?.error != null || result?.timedOut === true) {
      failures.push(`${context} must have a clean pass verdict`);
    }
    if (!Array.isArray(result?.browserFailures) || result.browserFailures.length !== 0) {
      failures.push(`${context} browserFailures must be an empty array`);
    }
    if (requireTrackedFile(resultFile, `${context} result`)) {
      try {
        const persisted = readJsonFile(`${folder}/${resultFile}`);
        if (!isDeepStrictEqual(persisted, result)) {
          failures.push(`${resultFile} does not match its summary record`);
        }
      } catch (error) {
        failures.push(
          `${resultFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  if (!Array.isArray(summary?.scenarios) || summary.scenarios.length !== expectedScenarioCount) {
    failures.push(`scenarios must contain exactly ${expectedScenarioCount} executions`);
  } else {
    for (const result of summary.scenarios) {
      const definition = expectedScenarioById.get(result?.scenarioId);
      const viewportId = cat04ViewportKey(result?.viewport);
      const key = `${String(result?.scenarioId)}::${String(viewportId)}`;
      if (!definition || !viewportId) {
        failures.push(`scenario result has an unknown scenario or viewport: ${key}`);
        continue;
      }
      if (scenarioKeys.has(key)) failures.push(`duplicate scenario execution ${key}`);
      scenarioKeys.add(key);
      if (
        result.fixture !== definition.fixture ||
        result.fixtureGroup !== definition.groupId ||
        result.route !== definition.route
      ) {
        failures.push(`${key} does not match its reviewed fixture, group, and route`);
      }
      const prefix = `${definition.id}-${viewportId}`;
      validateResult({
        result,
        expectedPrefix: prefix,
        resultFile: `${prefix}-result.json`,
        context: `scenario ${key}`,
      });
    }
  }
  for (const scenario of CAT04_CATALOG_SCENARIOS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const key = `${scenario.id}::${viewport.id}`;
      if (!scenarioKeys.has(key)) failures.push(`missing scenario execution ${key}`);
    }
  }

  if (
    !Array.isArray(summary?.bootstrapResults) ||
    summary.bootstrapResults.length !== expectedBootstrapCount
  ) {
    failures.push(`bootstrapResults must contain exactly ${expectedBootstrapCount} executions`);
  } else {
    for (const result of summary.bootstrapResults) {
      const viewportId = cat04ViewportKey(result?.viewport);
      const fixtureGroup = String(result?.fixtureGroup ?? '');
      const key = `${fixtureGroup}::${String(viewportId)}`;
      if (!CAT04_CATALOG_FIXTURE_GROUPS.includes(fixtureGroup) || !viewportId) {
        failures.push(`bootstrap result has an unknown fixture group or viewport: ${key}`);
        continue;
      }
      if (bootstrapKeys.has(key)) failures.push(`duplicate consent bootstrap ${key}`);
      bootstrapKeys.add(key);
      const prefix = `bootstrap-${fixtureGroup}-${viewportId}`;
      validateResult({
        result,
        expectedPrefix: prefix,
        resultFile: `${prefix}-result.json`,
        context: `bootstrap ${key}`,
      });
    }
  }
  for (const fixtureGroup of CAT04_CATALOG_FIXTURE_GROUPS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const key = `${fixtureGroup}::${viewport.id}`;
      if (!bootstrapKeys.has(key)) failures.push(`missing consent bootstrap ${key}`);
    }
  }

  const screenshots = Array.isArray(summary?.screenshots) ? summary.screenshots : [];
  if (!Array.isArray(summary?.screenshots) || screenshots.length === 0) {
    failures.push('screenshots must be a non-empty array');
  }
  const screenshotSet = new Set();
  for (const screenshot of screenshots) {
    const normalized = normalizeEvidenceRelativePath(screenshot);
    if (
      !normalized ||
      normalized !== screenshot ||
      screenshot.includes('/') ||
      !screenshot.endsWith('.png')
    ) {
      failures.push(`screenshots contains an unsafe or non-PNG path: ${String(screenshot)}`);
      continue;
    }
    if (screenshotSet.has(screenshot)) {
      failures.push(`screenshots contains a duplicate path: ${screenshot}`);
      continue;
    }
    screenshotSet.add(screenshot);
    requireTrackedFile(screenshot, `screenshot ${screenshot}`);
    requireTrackedFile(`${screenshot.slice(0, -4)}.json`, `snapshot for ${screenshot}`);
  }
  const trackedPngs = trackedFolderFiles.filter((path) => path.endsWith('.png')).sort();
  if (!isDeepStrictEqual([...screenshotSet].sort(), trackedPngs)) {
    failures.push('screenshots must enumerate every Git-tracked CAT04 PNG exactly once');
  }
  for (const prefix of expectedPrefixes) {
    if (![...screenshotSet].some((screenshot) => screenshot.startsWith(`${prefix}-`))) {
      failures.push(`${prefix} has no screenshot provenance`);
    }
  }

  if (requireTrackedFile('report.md', 'CAT04 report')) {
    try {
      const report = readTextFile(`${folder}/report.md`);
      for (const fragment of [
        '# CAT04 Catalog Recovery Expo-Web Audit',
        '- Verdict: pass',
        '- Surface: Expo web deterministic development fixtures',
        '- Native-device proof: No',
        `- Source Git SHA: ${String(summary?.sourceGitSha ?? '')}`,
        'Machine-readable result: `summary.json`',
      ]) {
        if (!report.includes(fragment))
          failures.push(`report.md is missing required text: ${fragment}`);
      }
      for (const fixtureGroup of CAT04_CATALOG_FIXTURE_GROUPS) {
        for (const viewport of CAT04_CATALOG_VIEWPORTS) {
          const row = `| ${fixtureGroup} | ${viewport.width}x${viewport.height} | pass |`;
          if (!report.includes(row)) failures.push(`report.md is missing bootstrap row: ${row}`);
        }
      }
      for (const scenario of CAT04_CATALOG_SCENARIOS) {
        for (const viewport of CAT04_CATALOG_VIEWPORTS) {
          const row = `| ${scenario.id} | ${viewport.width}x${viewport.height} | pass |`;
          if (!report.includes(row)) failures.push(`report.md is missing scenario row: ${row}`);
        }
      }
    } catch (error) {
      failures.push(
        `report.md could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const sourceGitSha = String(summary?.sourceGitSha ?? '');
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) {
    failures.push('sourceGitSha must be a lowercase full 40-character Git SHA');
  } else if (!sourceGitState) {
    failures.push('sourceGitSha consistency state is unavailable');
  } else {
    if (sourceGitState.sourceGitSha !== sourceGitSha) {
      failures.push('sourceGitSha consistency state does not match summary.sourceGitSha');
    }
    if (sourceGitState.commitExists !== true) {
      failures.push('sourceGitSha does not identify a local Git commit');
    }
    if (sourceGitState.isAncestorOfHead !== true) {
      failures.push('sourceGitSha must be an ancestor of the manifest HEAD');
    }
    if (sourceGitState.runnerMatchesSource !== true) {
      failures.push('CAT04 runner source does not match the recorded sourceGitSha');
    }
    const allowedGeneratedPaths = new Set(HUMAN_E2E_GENERATED_MANIFEST_PATHS);
    const sourceChangeAllowed = (path) => {
      const normalized = normalizeRepoPath(path);
      return (
        normalized.startsWith(folderPrefix) ||
        (peerEvidenceFolderPrefix != null && normalized.startsWith(peerEvidenceFolderPrefix)) ||
        (cat07EvidenceFolderPrefix != null && normalized.startsWith(cat07EvidenceFolderPrefix)) ||
        allowedGeneratedPaths.has(normalized) ||
        ignoredGeneratedOutputPath(normalized)
      );
    };
    const laterSourceChanges = (sourceGitState.changedRepoFilesSinceSource ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (laterSourceChanges.length > 0) {
      failures.push(`sourceGitSha predates later source changes: ${laterSourceChanges.join(', ')}`);
    }
    const dirtySourceChanges = (sourceGitState.dirtyTrackedRepoFiles ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (dirtySourceChanges.length > 0) {
      failures.push(
        `tracked source files changed after the recorded sourceGitSha: ${dirtySourceChanges.join(', ')}`,
      );
    }
    const untrackedSourceChanges = collectDisallowedUntrackedRepoFiles(
      sourceGitState.untrackedRepoFiles ?? [],
      {
        allowedExactPaths: allowedGeneratedPaths,
        allowedPrefixes: [folderPrefix, peerEvidenceFolderPrefix, cat07EvidenceFolderPrefix].filter(
          Boolean,
        ),
      },
    );
    if (untrackedSourceChanges.length > 0) {
      failures.push(
        `nonignored untracked source is not bound to sourceGitSha: ${untrackedSourceChanges.join(', ')}`,
      );
    }
  }

  if (!Array.isArray(summary?.artifacts)) {
    failures.push('artifacts must be a deterministic evidence-relative array');
  } else {
    const artifacts = new Set();
    for (const artifact of summary.artifacts) {
      const normalized = normalizeEvidenceRelativePath(artifact);
      if (!normalized || normalized !== artifact) {
        failures.push(`artifacts contains an unsafe path: ${String(artifact)}`);
        continue;
      }
      if (artifacts.has(normalized)) {
        failures.push(`artifacts contains a duplicate path: ${normalized}`);
        continue;
      }
      artifacts.add(normalized);
      requireTrackedFile(normalized, `artifact ${normalized}`);
    }
    if (!isDeepStrictEqual(summary.artifacts, [...summary.artifacts].sort())) {
      failures.push('artifacts must use deterministic lexical ordering');
    }
    for (const requiredArtifact of requiredArtifacts) {
      if (!artifacts.has(requiredArtifact)) {
        failures.push(`artifacts is missing required CAT04 evidence ${requiredArtifact}`);
      }
    }
    const expectedTrackedArtifacts = trackedFolderFiles
      .filter((trackedFile) => trackedFile !== 'summary.json')
      .sort();
    if (!isDeepStrictEqual([...artifacts].sort(), expectedTrackedArtifacts)) {
      failures.push(
        'artifacts must enumerate every Git-tracked CAT04 evidence file except summary.json exactly once',
      );
    }
  }

  return failures;
}

function collectCat05NativeOcrReviewFailures({
  folder,
  peerEvidenceFolder,
  summary,
  trackedRepoFiles,
  sourceGitState,
  fileExists = exists,
  readJsonFile = readJson,
  readTextFile = readEvidenceText,
  readBytesFile = readEvidenceBytes,
}) {
  const failures = [];
  const checkedFiles = new Set();
  const bytesByArtifact = new Map();
  const folderPrefix = `${normalizeRepoPath(folder).replace(/\/$/, '')}/`;
  const peerEvidenceFolderPrefix = governedHumanEvidenceFolderPrefix(
    peerEvidenceFolder,
    CAT04_CATALOG_RECOVERY_EVIDENCE_FOLDER_NAME,
    folder,
    CAT05_NATIVE_OCR_EVIDENCE_FOLDER_NAME,
  );
  if (!peerEvidenceFolderPrefix) {
    failures.push(
      'CAT05 peer evidence folder must be the exact dated CAT04 evidence directory on the same date as CAT05',
    );
  }
  const cat07EvidenceFolderPrefix = CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_PREFIX;
  const expectedArtifacts = expectedCat05NativeOcrArtifacts();
  const expectedScreenshots = expectedArtifacts.filter((artifact) => artifact.endsWith('.png'));
  const trackedFolderFiles = [...trackedRepoFiles]
    .filter((path) => normalizeRepoPath(path).startsWith(folderPrefix))
    .map((path) => normalizeRepoPath(path).slice(folderPrefix.length))
    .sort();

  const requireTrackedFile = (relativePath, label = relativePath) => {
    const normalized = normalizeEvidenceRelativePath(relativePath);
    if (!normalized || normalized !== relativePath) {
      failures.push(`${label} uses an unsafe evidence path`);
      return false;
    }
    if (checkedFiles.has(normalized)) {
      return (
        fileExists(`${folder}/${normalized}`) &&
        trackedRepoFiles.has(normalizeRepoPath(`${folder}/${normalized}`))
      );
    }
    checkedFiles.add(normalized);
    const repoPath = normalizeRepoPath(`${folder}/${normalized}`);
    if (!fileExists(repoPath)) {
      failures.push(`missing CAT05 evidence file ${normalized}`);
      return false;
    }
    if (!trackedRepoFiles.has(repoPath)) {
      failures.push(`CAT05 evidence file is not Git-tracked: ${normalized}`);
      return false;
    }
    return true;
  };

  const artifactBytes = (artifact) => {
    if (bytesByArtifact.has(artifact)) return bytesByArtifact.get(artifact);
    try {
      const raw = readBytesFile(`${folder}/${artifact}`);
      const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
      bytesByArtifact.set(artifact, bytes);
      return bytes;
    } catch (error) {
      failures.push(
        `${artifact} could not be read as bytes: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  };

  if (expectedArtifacts.length !== CAT05_NATIVE_OCR_ARTIFACT_COUNT) {
    failures.push('internal CAT05 artifact contract does not contain exactly 139 artifacts');
  }
  if (expectedScreenshots.length !== CAT05_NATIVE_OCR_SCREENSHOT_COUNT) {
    failures.push('internal CAT05 artifact contract does not contain exactly 55 PNGs');
  }
  if (!hasExactObjectKeys(summary, CAT05_NATIVE_OCR_SUMMARY_KEYS)) {
    failures.push('summary.json must use the exact reviewed CAT05 PASS schema');
  }
  if (summary?.evidenceSchemaVersion !== CAT05_NATIVE_OCR_SCHEMA_VERSION) {
    failures.push(
      `evidenceSchemaVersion must be ${CAT05_NATIVE_OCR_SCHEMA_VERSION}, received ${String(summary?.evidenceSchemaVersion ?? 'missing')}`,
    );
  }
  if (summary?.surface !== 'Expo web / deterministic development-only OCR review fixture') {
    failures.push('summary surface must remain the deterministic Expo-web OCR review fixture');
  }
  if (summary?.verdict !== 'pass') {
    failures.push(
      `summary verdict must be pass, received ${String(summary?.verdict ?? 'missing')}`,
    );
  }
  if (summary?.nativeDeviceProof !== false) {
    failures.push('nativeDeviceProof must be false for the CAT05 Expo-web compatibility gate');
  }
  if (!isDeepStrictEqual(summary?.candidateNativeBuild, CAT05_NATIVE_OCR_CANDIDATE_BUILD)) {
    failures.push(
      'candidateNativeBuild must be the exact staging source candidate with no native proof',
    );
  }
  if (!isDeepStrictEqual(summary?.viewports, CAT05_NATIVE_OCR_VIEWPORTS)) {
    failures.push('viewports must be exactly 375x667, 390x844, and 430x932');
  }
  if (!isDeepStrictEqual(summary?.fixtureGroups, CAT05_NATIVE_OCR_FIXTURE_GROUPS)) {
    failures.push('fixtureGroups must match the four reviewed CAT05 fixture groups');
  }
  if (!isDeepStrictEqual(summary?.scenarioMatrix, CAT05_NATIVE_OCR_SCENARIOS)) {
    failures.push('scenarioMatrix must match the five reviewed CAT05 scenarios');
  }
  if (!isDeepStrictEqual(summary?.limitations, CAT05_NATIVE_OCR_LIMITATIONS)) {
    failures.push('limitations must retain the exact native-proof boundary');
  }
  if (
    summary?.expectedExecutionCount !== 15 ||
    summary?.passedExecutionCount !== 15 ||
    summary?.expectedBootstrapCount !== 4 ||
    summary?.passedBootstrapCount !== 4
  ) {
    failures.push('CAT05 must record exactly 15/15 scenario results and 4/4 consent bootstraps');
  }
  if (summary?.browserFailureCount !== 0) {
    failures.push('browserFailureCount must be zero');
  }
  if (typeof summary?.browserPath !== 'string' || summary.browserPath.trim().length === 0) {
    failures.push('browserPath must identify the browser used for the evidence run');
  } else if (
    summary.browserPath !== summary.browserPath.trim() ||
    summary.browserPath.length > 256 ||
    /[\\/]/u.test(summary.browserPath) ||
    summary.browserPath === '.' ||
    summary.browserPath === '..'
  ) {
    failures.push('browserPath must be a bounded browser executable basename, not a host path');
  }
  failures.push(...cat05DiagnosticValueFailures('summary.json', summary));
  const summaryBytes = artifactBytes('summary.json');
  if (summaryBytes) {
    failures.push(
      ...cat05TextArtifactHygieneFailures(
        'summary.json',
        summaryBytes,
        CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      ),
    );
  }
  const startedAt = Date.parse(String(summary?.startedAt ?? ''));
  const completedAt = Date.parse(String(summary?.completedAt ?? ''));
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    failures.push('summary timestamps must be valid and complete in chronological order');
  }

  const sourceGitSha = String(summary?.sourceGitSha ?? '');
  const binding = summary?.evidenceBinding;
  const fixtureConfigurationSha256 = String(binding?.fixtureConfigurationSha256 ?? '');
  const scenarioMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_SCENARIOS);
  const viewportMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_VIEWPORTS);
  const webFixtureBuild = {
    buildId: cat05Sha256Json({
      evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
      fixtureConfigurationSha256,
      scenarioMatrixSha256,
      sourceGitSha,
      viewportMatrixSha256,
    }),
    profile: 'development-only-deterministic-expo-web',
  };
  const expectedBinding = {
    candidateNativeBuild: CAT05_NATIVE_OCR_CANDIDATE_BUILD,
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    expectedSourceGitSha: sourceGitSha,
    fixtureConfigurationSha256,
    runId: String(summary?.runId ?? ''),
    scenarioMatrixSha256,
    sourceGitSha,
    viewportMatrixSha256,
    webFixtureBuild,
  };

  if (!hasExactObjectKeys(binding, CAT05_NATIVE_OCR_BINDING_KEYS)) {
    failures.push('summary evidenceBinding must use the exact CAT05 binding schema');
  }
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) {
    failures.push('sourceGitSha must be a lowercase full 40-character Git SHA');
  }
  if (!/^[a-f0-9]{64}$/.test(fixtureConfigurationSha256)) {
    failures.push('fixtureConfigurationSha256 must be a lowercase SHA-256 digest');
  }
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      expectedBinding.runId,
    )
  ) {
    failures.push('runId must be a lowercase UUID v4');
  }
  if (!isDeepStrictEqual(binding, expectedBinding)) {
    failures.push(
      'summary evidenceBinding does not match the reviewed source/matrix/build binding',
    );
  }
  if (
    summary?.runId !== expectedBinding.runId ||
    summary?.sourceGitSha !== expectedBinding.sourceGitSha ||
    !isDeepStrictEqual(summary?.webFixtureBuild, webFixtureBuild)
  ) {
    failures.push('summary duplicate run/source/web-build fields do not match evidenceBinding');
  }

  const validateArtifactBinding = (actual, artifact, metadata) => {
    const label = `${artifact} evidenceBinding`;
    if (!hasExactObjectKeys(actual, CAT05_NATIVE_OCR_ARTIFACT_BINDING_KEYS)) {
      failures.push(`${label} must use the exact bound-artifact schema`);
      return;
    }
    if (!isDeepStrictEqual(actual, { ...expectedBinding, ...metadata })) {
      failures.push(`${label} does not match the summary run and artifact identity`);
    }
  };

  const privacySourceContract = summary?.privacySourceContract;
  if (
    !hasExactObjectKeys(privacySourceContract, [
      'assertionIds',
      'files',
      'nativeDeviceProof',
      'proofKind',
    ]) ||
    privacySourceContract?.nativeDeviceProof !== false ||
    privacySourceContract?.proofKind !== 'source-assertions-only' ||
    !isDeepStrictEqual(privacySourceContract?.assertionIds, CAT05_NATIVE_OCR_PRIVACY_ASSERTIONS)
  ) {
    failures.push('privacySourceContract must retain the exact source-assertion-only schema');
  }
  if (
    !Array.isArray(privacySourceContract?.files) ||
    privacySourceContract.files.length !== CAT05_NATIVE_OCR_PRIVACY_FILES.length
  ) {
    failures.push('privacySourceContract must bind the four reviewed privacy source files');
  } else {
    privacySourceContract.files.forEach((file, index) => {
      if (
        !hasExactObjectKeys(file, ['bytes', 'path', 'sha256']) ||
        file.path !== CAT05_NATIVE_OCR_PRIVACY_FILES[index] ||
        !Number.isSafeInteger(file.bytes) ||
        file.bytes < 1 ||
        !/^[a-f0-9]{64}$/.test(String(file.sha256 ?? ''))
      ) {
        failures.push(`privacySourceContract file ${index + 1} is not exactly bound`);
      }
    });
  }
  const recordedPrivacyFiles = sourceGitState?.privacySourceFiles;
  if (
    !Array.isArray(recordedPrivacyFiles) ||
    recordedPrivacyFiles.length !== CAT05_NATIVE_OCR_PRIVACY_FILES.length
  ) {
    failures.push('recorded CAT05 privacy source hashes are unavailable');
  } else {
    const expectedPrivacyFiles = [];
    recordedPrivacyFiles.forEach((record, index) => {
      const expectedPath = CAT05_NATIVE_OCR_PRIVACY_FILES[index];
      if (
        !hasExactObjectKeys(record, ['bytes', 'currentBytes', 'currentSha256', 'path', 'sha256']) ||
        record.path !== expectedPath ||
        !Number.isSafeInteger(record.bytes) ||
        record.bytes < 1 ||
        !/^[a-f0-9]{64}$/.test(String(record.sha256 ?? ''))
      ) {
        failures.push(`recorded CAT05 privacy source file ${index + 1} is unavailable or invalid`);
        return;
      }
      expectedPrivacyFiles.push({ bytes: record.bytes, path: record.path, sha256: record.sha256 });
      if (record.currentBytes !== record.bytes || record.currentSha256 !== record.sha256) {
        failures.push(
          `current CAT05 privacy source does not match ${sourceGitSha}: ${record.path}`,
        );
      }
    });
    if (
      expectedPrivacyFiles.length === CAT05_NATIVE_OCR_PRIVACY_FILES.length &&
      !isDeepStrictEqual(privacySourceContract?.files, expectedPrivacyFiles)
    ) {
      failures.push(
        'privacySourceContract byte/hash records do not match the recorded sourceGitSha',
      );
    }
  }

  const expectedScenarioById = new Map(
    CAT05_NATIVE_OCR_SCENARIOS.map((scenario) => [scenario.id, scenario]),
  );
  const scenarioKeys = new Set();
  const bootstrapGroups = new Set();
  if (!Array.isArray(summary?.results) || summary.results.length !== 19) {
    failures.push('results must contain exactly 15 scenarios and 4 consent bootstraps');
  } else {
    for (const result of summary.results) {
      const resultKind = result?.kind;
      let expectedPrefix;
      let resultFile;
      let expectedMetadata;
      if (resultKind === 'scenario') {
        const definition = expectedScenarioById.get(result?.scenarioId);
        const viewportId = cat05ViewportKey(result?.viewport);
        const key = `${String(result?.scenarioId)}::${String(viewportId)}`;
        if (!definition || !viewportId) {
          failures.push(`scenario result has an unknown scenario or viewport: ${key}`);
          continue;
        }
        if (scenarioKeys.has(key)) failures.push(`duplicate CAT05 scenario execution ${key}`);
        scenarioKeys.add(key);
        if (result.fixture !== definition.fixture || result.fixtureGroup !== definition.groupId) {
          failures.push(`${key} does not match its reviewed fixture and group`);
        }
        expectedPrefix = `${definition.id}-${viewportId}`;
        resultFile = `${expectedPrefix}-result.json`;
        expectedMetadata = expectedCat05ArtifactBindingMetadata(resultFile);
      } else if (resultKind === 'consent-bootstrap') {
        const fixtureGroup = String(result?.fixtureGroup ?? '');
        if (!CAT05_NATIVE_OCR_FIXTURE_GROUPS.includes(fixtureGroup)) {
          failures.push(`bootstrap result has an unknown fixture group: ${fixtureGroup}`);
          continue;
        }
        if (!isDeepStrictEqual(result?.viewport, CAT05_NATIVE_OCR_VIEWPORTS[1])) {
          failures.push(`bootstrap ${fixtureGroup} must use the exact 390x844 viewport`);
        }
        if (bootstrapGroups.has(fixtureGroup)) {
          failures.push(`duplicate CAT05 consent bootstrap ${fixtureGroup}`);
        }
        bootstrapGroups.add(fixtureGroup);
        expectedPrefix = `bootstrap-${fixtureGroup}-${CAT05_NATIVE_OCR_VIEWPORTS[1].id}`;
        resultFile = `${expectedPrefix}-result.json`;
        expectedMetadata = expectedCat05ArtifactBindingMetadata(resultFile);
      } else {
        failures.push(`result has an unknown kind: ${String(resultKind ?? 'missing')}`);
        continue;
      }

      if (result?.artifactPrefix !== expectedPrefix) {
        failures.push(`${resultKind} ${expectedPrefix} has an incorrect artifactPrefix`);
      }
      if (
        result?.nativeDeviceProof !== false ||
        result?.verdict !== 'pass' ||
        result?.error !== null ||
        !Array.isArray(result?.browserFailures) ||
        result.browserFailures.length !== 0
      ) {
        failures.push(`${resultKind} ${expectedPrefix} must retain a clean non-native pass`);
      }
      const expectedSurface =
        resultKind === 'scenario' ? 'expo-web-deterministic-ui-fixture' : 'expo-web';
      if (result?.surface !== expectedSurface) {
        failures.push(`${resultKind} ${expectedPrefix} has an incorrect surface`);
      }
      validateArtifactBinding(result?.evidenceBinding, resultFile, expectedMetadata);
      try {
        const endUrl = new URL(String(result?.endUrl ?? ''));
        if (
          endUrl.protocol !== 'http:' ||
          endUrl.hostname !== 'localhost' ||
          !/^\d+$/.test(endUrl.port) ||
          endUrl.username ||
          endUrl.password
        ) {
          failures.push(`${resultKind} ${expectedPrefix} endUrl must remain local HTTP`);
        }
      } catch {
        failures.push(`${resultKind} ${expectedPrefix} endUrl is not a valid local URL`);
      }
      if (requireTrackedFile(resultFile, `${resultKind} ${expectedPrefix} result`)) {
        try {
          if (!isDeepStrictEqual(readJsonFile(`${folder}/${resultFile}`), result)) {
            failures.push(`${resultFile} does not match its summary record`);
          }
        } catch (error) {
          failures.push(
            `${resultFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }
  for (const scenario of CAT05_NATIVE_OCR_SCENARIOS) {
    for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
      const key = `${scenario.id}::${viewport.id}`;
      if (!scenarioKeys.has(key)) failures.push(`missing CAT05 scenario execution ${key}`);
    }
  }
  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    if (!bootstrapGroups.has(fixtureGroup)) {
      failures.push(`missing CAT05 consent bootstrap ${fixtureGroup}`);
    }
  }

  if (
    !Array.isArray(summary?.groupBrowserAudits) ||
    summary.groupBrowserAudits.length !== CAT05_NATIVE_OCR_FIXTURE_GROUPS.length
  ) {
    failures.push('groupBrowserAudits must contain exactly four fixture-group audits');
  } else {
    const auditedGroups = new Set();
    for (const audit of summary.groupBrowserAudits) {
      const fixtureGroup = String(audit?.fixtureGroup ?? '');
      if (!CAT05_NATIVE_OCR_FIXTURE_GROUPS.includes(fixtureGroup)) {
        failures.push(`groupBrowserAudits contains an unknown fixture group: ${fixtureGroup}`);
        continue;
      }
      if (auditedGroups.has(fixtureGroup)) {
        failures.push(`groupBrowserAudits contains duplicate fixture group ${fixtureGroup}`);
      }
      auditedGroups.add(fixtureGroup);
      if (!Array.isArray(audit.browserFailures) || audit.browserFailures.length !== 0) {
        failures.push(`groupBrowserAudits ${fixtureGroup} must contain zero browser failures`);
      }
      const artifact = `browser-events-${fixtureGroup}.json`;
      validateArtifactBinding(
        audit.evidenceBinding,
        artifact,
        expectedCat05ArtifactBindingMetadata(artifact),
      );
    }
  }

  requireTrackedFile('summary.json', 'CAT05 summary');
  for (const artifact of expectedArtifacts) requireTrackedFile(artifact, `artifact ${artifact}`);
  if (!isDeepStrictEqual(trackedFolderFiles, ['summary.json', ...expectedArtifacts].sort())) {
    failures.push(
      'Git-tracked CAT05 evidence must contain summary.json plus the exact 139 non-summary artifacts',
    );
  }
  if (
    summary?.artifactCount !== CAT05_NATIVE_OCR_ARTIFACT_COUNT ||
    !isDeepStrictEqual(summary?.artifacts, expectedArtifacts)
  ) {
    failures.push(
      'artifacts must enumerate the exact 139 CAT05 non-summary files in lexical order',
    );
  }
  if (
    !Array.isArray(summary?.screenshots) ||
    summary.screenshots.length !== CAT05_NATIVE_OCR_SCREENSHOT_COUNT ||
    !isDeepStrictEqual(summary.screenshots, expectedScreenshots)
  ) {
    failures.push('screenshots must enumerate the exact 55 CAT05 PNG artifacts in lexical order');
  }
  if (
    !Array.isArray(summary?.artifactManifest) ||
    summary.artifactManifest.length !== CAT05_NATIVE_OCR_ARTIFACT_COUNT
  ) {
    failures.push('artifactManifest must contain exactly 139 byte/hash records');
  } else {
    summary.artifactManifest.forEach((manifestEntry, index) => {
      const artifact = expectedArtifacts[index];
      if (
        !hasExactObjectKeys(manifestEntry, ['bytes', 'path', 'sha256']) ||
        manifestEntry.path !== artifact ||
        !Number.isSafeInteger(manifestEntry.bytes) ||
        manifestEntry.bytes < 1 ||
        !/^[a-f0-9]{64}$/.test(String(manifestEntry.sha256 ?? ''))
      ) {
        failures.push(`artifactManifest entry ${index + 1} is not exactly bound to ${artifact}`);
        return;
      }
      const bytes = artifactBytes(artifact);
      if (
        bytes &&
        (manifestEntry.bytes !== bytes.length || manifestEntry.sha256 !== cat05Sha256(bytes))
      ) {
        failures.push(`artifactManifest hash/byte mismatch for ${artifact}`);
      }
    });
  }

  for (const artifact of expectedArtifacts) {
    if (artifact.endsWith('.png')) {
      const bytes = artifactBytes(artifact);
      const expectedDimensions = cat05ExpectedScreenshotDimensions(artifact);
      try {
        const actualDimensions = parsePngDimensions(bytes);
        if (!isDeepStrictEqual(actualDimensions, expectedDimensions)) {
          failures.push(
            `${artifact} dimensions must be ${expectedDimensions.width} x ${expectedDimensions.height}`,
          );
        }
      } catch (error) {
        failures.push(
          `${artifact} is not a readable CAT05 PNG: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      continue;
    }
    const bytes = artifactBytes(artifact);
    if (bytes) {
      failures.push(
        ...cat05TextArtifactHygieneFailures(
          artifact,
          bytes,
          artifact.endsWith('.log')
            ? CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES
            : CAT05_NATIVE_OCR_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
        ),
      );
    }
    if (!artifact.endsWith('.json')) continue;
    let contents;
    try {
      contents = readJsonFile(`${folder}/${artifact}`);
    } catch (error) {
      failures.push(
        `${artifact} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    failures.push(...cat05DiagnosticValueFailures(artifact, contents));
    if (artifact === 'scope.json') continue;
    const metadata = expectedCat05ArtifactBindingMetadata(artifact);
    if (metadata === undefined) {
      failures.push(`${artifact} has no reviewed CAT05 artifact-binding identity`);
    } else {
      validateArtifactBinding(contents?.evidenceBinding, artifact, metadata);
    }
    if (artifact.startsWith('browser-events-')) {
      failures.push(...collectCat05BrowserEventFailures(artifact, contents));
    }
  }

  if (requireTrackedFile('scope.json', 'CAT05 scope')) {
    try {
      const scope = readJsonFile(`${folder}/scope.json`);
      const expectedScope = {
        candidateNativeBuild: CAT05_NATIVE_OCR_CANDIDATE_BUILD,
        evidenceKind: 'deterministic_expo_web_ocr_review_ui_state',
        evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
        fixtureConfigurationSha256,
        nativeDeviceProof: false,
        proves: CAT05_NATIVE_OCR_PROVES,
        doesNotProve: CAT05_NATIVE_OCR_LIMITATIONS.slice(1),
        evidenceBinding: expectedBinding,
        fixtureEnvironmentVariable: 'EXPO_PUBLIC_E2E_SHELF_OCR_RESULT',
        fixtureTranscript: 'Aqua, Glycerin, Niacinamide, 水, Ниацинамид',
        privacySourceContract,
        runId: expectedBinding.runId,
        scenarioMatrix: CAT05_NATIVE_OCR_SCENARIOS,
        scenarioMatrixSha256,
        sourceGitSha,
        surface: 'Expo web / headless Chromium / development-only deterministic fixture',
        viewportMatrix: CAT05_NATIVE_OCR_VIEWPORTS,
        viewportMatrixSha256,
        webFixtureBuild,
      };
      if (!isDeepStrictEqual(scope, expectedScope)) {
        failures.push('scope.json does not match the exact CAT05 source/build/proof boundary');
      }
    } catch (error) {
      failures.push(
        `scope.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (requireTrackedFile('report.md', 'CAT05 report')) {
    try {
      if (readTextFile(`${folder}/report.md`) !== buildExpectedCat05NativeOcrReport(summary)) {
        failures.push('report.md does not match the exact CAT05 PASS report contract');
      }
    } catch (error) {
      failures.push(
        `report.md could not be read: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!sourceGitState) {
    failures.push('sourceGitSha consistency state is unavailable');
  } else {
    if (sourceGitState.sourceGitSha !== sourceGitSha) {
      failures.push('sourceGitSha consistency state does not match summary.sourceGitSha');
    }
    if (sourceGitState.commitExists !== true) {
      failures.push('sourceGitSha does not identify a local Git commit');
    }
    if (sourceGitState.isAncestorOfHead !== true) {
      failures.push('sourceGitSha must be an ancestor of the manifest HEAD');
    }
    if (sourceGitState.runnerMatchesSource !== true) {
      failures.push('CAT05 runner source does not match the recorded sourceGitSha');
    }
    const allowedGeneratedPaths = new Set(HUMAN_E2E_GENERATED_MANIFEST_PATHS);
    const sourceChangeAllowed = (path) => {
      const normalized = normalizeRepoPath(path);
      return (
        normalized.startsWith(folderPrefix) ||
        (peerEvidenceFolderPrefix != null && normalized.startsWith(peerEvidenceFolderPrefix)) ||
        (cat07EvidenceFolderPrefix != null && normalized.startsWith(cat07EvidenceFolderPrefix)) ||
        cat05DocumentationOnlyPath(normalized) ||
        allowedGeneratedPaths.has(normalized) ||
        ignoredGeneratedOutputPath(normalized)
      );
    };
    const laterSourceChanges = (sourceGitState.changedRepoFilesSinceSource ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (laterSourceChanges.length > 0) {
      failures.push(`sourceGitSha predates later source changes: ${laterSourceChanges.join(', ')}`);
    }
    const dirtySourceChanges = (sourceGitState.dirtyTrackedRepoFiles ?? []).filter(
      (path) => !sourceChangeAllowed(path),
    );
    if (dirtySourceChanges.length > 0) {
      failures.push(
        `tracked source files changed after the recorded sourceGitSha: ${dirtySourceChanges.join(', ')}`,
      );
    }
    const untrackedSourceChanges = collectDisallowedUntrackedRepoFiles(
      sourceGitState.untrackedRepoFiles ?? [],
      {
        allowedExactPaths: allowedGeneratedPaths,
        allowedPrefixes: [folderPrefix, peerEvidenceFolderPrefix, cat07EvidenceFolderPrefix].filter(
          Boolean,
        ),
      },
    );
    if (untrackedSourceChanges.length > 0) {
      failures.push(
        `nonignored untracked source is not bound to sourceGitSha: ${untrackedSourceChanges.join(', ')}`,
      );
    }
  }

  return failures;
}

function collectCat07ShelfFreshnessFailures({
  folder,
  summary,
  trackedRepoFiles,
  sourceGitState,
  fileExists = exists,
  readJsonFile: providedReadJsonFile = null,
  readTextFile: providedReadTextFile = null,
  readBytesFile: providedReadBytesFile = (path) =>
    readBoundedRegularFile(abs(path), {
      containmentRoot: root,
      maxBytes: CAT07_MAX_SCREENSHOT_BYTES,
    }),
}) {
  const failures = [];
  const bytesCache = new Map();
  const jsonCache = new Map();
  const textCache = new Map();
  const readBytesFile = (repoPath) => {
    if (!bytesCache.has(repoPath)) bytesCache.set(repoPath, providedReadBytesFile(repoPath));
    return bytesCache.get(repoPath);
  };
  const readJsonFile = (repoPath) => {
    if (!jsonCache.has(repoPath)) {
      jsonCache.set(
        repoPath,
        providedReadJsonFile
          ? providedReadJsonFile(repoPath)
          : JSON.parse(readBytesFile(repoPath).toString('utf8')),
      );
    }
    return jsonCache.get(repoPath);
  };
  const readTextFile = (repoPath) => {
    if (!textCache.has(repoPath)) {
      textCache.set(
        repoPath,
        providedReadTextFile
          ? providedReadTextFile(repoPath)
          : readBytesFile(repoPath).toString('utf8'),
      );
    }
    return textCache.get(repoPath);
  };
  const checkedFiles = new Set();
  const folderPrefix = `${normalizeRepoPath(folder).replace(/\/$/, '')}/`;
  const expectedArtifacts = expectedCat07ShelfFreshnessArtifacts();
  const expectedScreenshots = expectedArtifacts.filter((artifact) => artifact.endsWith('.png'));
  const trackedFolderFiles = [...trackedRepoFiles]
    .filter((repoPath) => normalizeRepoPath(repoPath).startsWith(folderPrefix))
    .map((repoPath) => normalizeRepoPath(repoPath).slice(folderPrefix.length))
    .sort();

  const requireTrackedFile = (relativePath, label = relativePath) => {
    const normalized = normalizeEvidenceRelativePath(relativePath);
    if (!normalized || normalized !== relativePath || relativePath.includes('/')) {
      failures.push(`${label} uses an unsafe evidence path`);
      return false;
    }
    if (checkedFiles.has(normalized)) {
      return (
        fileExists(`${folder}/${normalized}`) &&
        trackedRepoFiles.has(normalizeRepoPath(`${folder}/${normalized}`))
      );
    }
    checkedFiles.add(normalized);
    const repoPath = normalizeRepoPath(`${folder}/${normalized}`);
    if (!fileExists(repoPath)) {
      failures.push(`missing CAT07 evidence file ${normalized}`);
      return false;
    }
    if (!trackedRepoFiles.has(repoPath)) {
      failures.push(`CAT07 evidence file is not Git-tracked: ${normalized}`);
      return false;
    }
    return true;
  };

  if (expectedArtifacts.length !== CAT07_SHELF_FRESHNESS_ARTIFACT_COUNT) {
    failures.push('internal CAT07 artifact contract does not contain exactly 99 artifacts');
  }
  if (expectedScreenshots.length !== CAT07_SHELF_FRESHNESS_SCREENSHOT_COUNT) {
    failures.push('internal CAT07 artifact contract does not contain exactly 45 PNGs');
  }
  failures.push(
    ...collectEvidenceDiagnosticValueFailures('summary.json', summary, {
      allowLocalhostUrlQuery: true,
      maxStringBytes: CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_STRING_BYTES,
    }),
  );
  if (requireTrackedFile('summary.json', 'summary.json')) {
    try {
      const inspection = inspectCanonicalEvidenceJson(
        'summary.json',
        readBytesFile(`${folder}/summary.json`),
        {
          allowLocalhostUrlQuery: true,
          maxBytes: CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
          maxStringBytes: CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_STRING_BYTES,
        },
      );
      failures.push(...inspection.failures);
      if (inspection.value !== null && !isDeepStrictEqual(inspection.value, summary)) {
        failures.push('summary.json parsed bytes do not match the summary under validation');
      }
    } catch {
      failures.push('summary.json could not be inspected as bytes');
    }
  }
  if (!hasExactObjectKeys(summary, CAT07_SHELF_FRESHNESS_SUMMARY_KEYS)) {
    failures.push('summary.json must use the exact reviewed CAT07 PASS schema');
  }
  if (summary?.schemaVersion !== CAT07_SHELF_FRESHNESS_SCHEMA_VERSION) {
    failures.push(
      `schemaVersion must be ${CAT07_SHELF_FRESHNESS_SCHEMA_VERSION}, received ${String(summary?.schemaVersion ?? 'missing')}`,
    );
  }
  if (summary?.surface !== 'expo-web') {
    failures.push(`surface must be expo-web, received ${String(summary?.surface ?? 'missing')}`);
  }
  if (summary?.nativeDeviceProof !== false) {
    failures.push('nativeDeviceProof must be false for the CAT07 Expo-web compatibility gate');
  }
  if (summary?.verdict !== 'pass') {
    failures.push(
      `summary verdict must be pass, received ${String(summary?.verdict ?? 'missing')}`,
    );
  }
  if (!isDeepStrictEqual(summary?.requiredViewports, CAT07_SHELF_FRESHNESS_VIEWPORTS)) {
    failures.push('requiredViewports must be exactly 375x667, 390x844, and 430x932');
  }
  if (!isDeepStrictEqual(summary?.limitations, CAT07_SHELF_FRESHNESS_LIMITATIONS)) {
    failures.push('limitations must match the reviewed CAT07 Expo-web proof boundary');
  }
  if (!isDeepStrictEqual(summary?.verifiedOutcomes, CAT07_SHELF_FRESHNESS_VERIFIED_OUTCOMES)) {
    failures.push('verifiedOutcomes must match the ten reviewed CAT07 outcomes');
  }
  if (summary?.expectedBootstrapCount !== CAT07_SHELF_FRESHNESS_VIEWPORTS.length) {
    failures.push('expectedBootstrapCount must be 3');
  }
  if (summary?.expectedExecutionCount !== CAT07_SHELF_FRESHNESS_VIEWPORTS.length) {
    failures.push('expectedExecutionCount must be 3');
  }
  if (!CAT07_SHELF_FRESHNESS_RUN_ID.test(String(summary?.runId ?? ''))) {
    failures.push('runId must be one canonical CAT07 UUID-bound run identifier');
  }
  failures.push(
    ...collectCat07RuntimeProvenanceFailures(summary?.runtimeProvenance, sourceGitState),
  );

  const parseCanonicalTimestamp = (value) => {
    const text = String(value ?? '');
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === text ? parsed : null;
  };
  const startedAt = parseCanonicalTimestamp(summary?.startedAt);
  const completedAt = parseCanonicalTimestamp(summary?.completedAt);
  if (
    startedAt == null ||
    completedAt == null ||
    completedAt < startedAt ||
    !String(summary?.startedAt ?? '').startsWith(`${CAT07_SHELF_FRESHNESS_EVIDENCE_DATE}T`) ||
    !String(summary?.completedAt ?? '').startsWith(`${CAT07_SHELF_FRESHNESS_EVIDENCE_DATE}T`)
  ) {
    failures.push(
      `summary timestamps must be canonical UTC values within ${CAT07_SHELF_FRESHNESS_EVIDENCE_DATE}`,
    );
  }

  const resultOrigins = new Set();
  const validateLocalUrl = (value, context) => {
    try {
      const url = new URL(String(value));
      if (
        url.protocol !== 'http:' ||
        url.hostname !== 'localhost' ||
        url.port.length === 0 ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        url.hash.length > 0
      ) {
        failures.push(
          `${context} endUrl must use credential-free localhost HTTP with an explicit app port`,
        );
      } else {
        resultOrigins.add(url.origin);
      }
    } catch {
      failures.push(`${context} endUrl must be a valid URL`);
    }
  };

  const validateResult = ({ context, expectedKeys, expectedPrefix, result, resultFile }) => {
    if (!hasExactObjectKeys(result, expectedKeys)) {
      failures.push(`${context} must use the exact reviewed CAT07 result schema`);
    }
    if (result?.artifactPrefix !== expectedPrefix) {
      failures.push(`${context} artifactPrefix must be ${expectedPrefix}`);
    }
    if (result?.surface !== 'expo-web' || result?.nativeDeviceProof !== false) {
      failures.push(`${context} must retain Expo-web surface and nativeDeviceProof false`);
    }
    if (result?.runId !== summary?.runId) {
      failures.push(`${context} runId must equal summary.runId`);
    }
    if (result?.verdict !== 'pass' || result?.error != null) {
      failures.push(`${context} must have a clean pass verdict`);
    }
    if (!Array.isArray(result?.browserFailures) || result.browserFailures.length !== 0) {
      failures.push(`${context} browserFailures must be an empty array`);
    }
    const resultStartedAt = parseCanonicalTimestamp(result?.startedAt);
    const resultCompletedAt = parseCanonicalTimestamp(result?.completedAt);
    if (
      resultStartedAt == null ||
      resultCompletedAt == null ||
      resultCompletedAt < resultStartedAt ||
      (startedAt != null && resultStartedAt < startedAt) ||
      (completedAt != null && resultCompletedAt > completedAt)
    ) {
      failures.push(`${context} timestamps must be canonical and inside the summary window`);
    }
    validateLocalUrl(result?.endUrl, context);
    if (requireTrackedFile(resultFile, `${context} result`)) {
      try {
        if (!isDeepStrictEqual(readJsonFile(`${folder}/${resultFile}`), result)) {
          failures.push(`${resultFile} does not match its summary record`);
        }
      } catch {
        failures.push(`${resultFile} is not valid JSON`);
      }
    }
  };

  const bootstrapKeys = new Set();
  if (
    !Array.isArray(summary?.bootstrapResults) ||
    summary.bootstrapResults.length !== CAT07_SHELF_FRESHNESS_VIEWPORTS.length
  ) {
    failures.push('bootstrapResults must contain exactly 3 consent bootstraps');
  } else {
    if (
      !isDeepStrictEqual(
        summary.bootstrapResults.map((result) => result?.viewport),
        CAT07_SHELF_FRESHNESS_VIEWPORTS,
      )
    ) {
      failures.push('bootstrapResults must follow the exact reviewed viewport order');
    }
    for (const result of summary.bootstrapResults) {
      const viewportId = cat07ShelfFreshnessViewportKey(result?.viewport);
      if (!viewportId) {
        failures.push('CAT07 consent bootstrap has an unknown viewport');
        continue;
      }
      if (bootstrapKeys.has(viewportId)) {
        failures.push(`duplicate CAT07 consent bootstrap ${viewportId}`);
      }
      bootstrapKeys.add(viewportId);
      if (result?.fixtureGroup !== 'cat07-freshness') {
        failures.push(`${viewportId} consent bootstrap must use cat07-freshness fixtureGroup`);
      }
      const prefix = `bootstrap-cat07-freshness-${viewportId}`;
      validateResult({
        context: `CAT07 consent bootstrap ${viewportId}`,
        expectedKeys: CAT07_SHELF_FRESHNESS_BOOTSTRAP_KEYS,
        expectedPrefix: prefix,
        result,
        resultFile: `${prefix}-result.json`,
      });
      try {
        const endUrl = new URL(String(result?.endUrl ?? ''));
        if (
          endUrl.pathname !== '/shelf/search' ||
          endUrl.searchParams.getAll('cat04ConsentProbe').length !== 1 ||
          endUrl.searchParams.get('cat04ConsentProbe') !==
            cat07ShelfFreshnessMarker(summary?.runId, viewportId, 'consent-probe') ||
          endUrl.search !==
            `?${new URLSearchParams([
              [
                'cat04ConsentProbe',
                cat07ShelfFreshnessMarker(summary?.runId, viewportId, 'consent-probe'),
              ],
            ]).toString()}` ||
          endUrl.hash.length > 0
        ) {
          failures.push(
            `${viewportId} consent bootstrap endUrl does not bind the exact run marker`,
          );
        }
      } catch {
        // validateLocalUrl already records the malformed URL.
      }
    }
  }
  for (const viewport of CAT07_SHELF_FRESHNESS_VIEWPORTS) {
    if (!bootstrapKeys.has(viewport.id)) {
      failures.push(`missing CAT07 consent bootstrap ${viewport.id}`);
    }
  }

  const scenarioKeys = new Set();
  if (
    !Array.isArray(summary?.scenarios) ||
    summary.scenarios.length !== CAT07_SHELF_FRESHNESS_VIEWPORTS.length
  ) {
    failures.push('scenarios must contain exactly 3 freshness lifecycle executions');
  } else {
    if (
      !isDeepStrictEqual(
        summary.scenarios.map((result) => result?.viewport),
        CAT07_SHELF_FRESHNESS_VIEWPORTS,
      )
    ) {
      failures.push('scenarios must follow the exact reviewed viewport order');
    }
    for (const result of summary.scenarios) {
      const viewportId = cat07ShelfFreshnessViewportKey(result?.viewport);
      if (!viewportId) {
        failures.push('CAT07 freshness lifecycle has an unknown viewport');
        continue;
      }
      if (scenarioKeys.has(viewportId)) {
        failures.push(`duplicate CAT07 freshness lifecycle ${viewportId}`);
      }
      scenarioKeys.add(viewportId);
      if (result?.scenarioId !== 'freshness-replacement-lifecycle') {
        failures.push(`${viewportId} must use freshness-replacement-lifecycle scenarioId`);
      }
      if (result?.distinctReplacementIdentity !== true) {
        failures.push(`${viewportId} must prove a distinct replacement identity`);
      }
      const viewport = CAT07_SHELF_FRESHNESS_VIEWPORTS.find(({ id }) => id === viewportId);
      if (result?.productName !== `CAT07 Label PAO ${viewport.width}`) {
        failures.push(`${viewportId} productName does not match the deterministic fixture`);
      }
      const prefix = `freshness-lifecycle-${viewportId}`;
      validateResult({
        context: `CAT07 freshness lifecycle ${viewportId}`,
        expectedKeys: CAT07_SHELF_FRESHNESS_SCENARIO_KEYS,
        expectedPrefix: prefix,
        result,
        resultFile: `${prefix}-result.json`,
      });
      try {
        const endUrl = new URL(String(result?.endUrl ?? ''));
        if (
          !CAT07_DETAIL_PATH.test(endUrl.pathname) ||
          endUrl.search.length > 0 ||
          endUrl.hash.length > 0
        ) {
          failures.push(`${viewportId} scenario endUrl must be one exact local Shelf detail route`);
        }
      } catch {
        // validateLocalUrl already records the malformed URL.
      }
    }
  }
  for (const viewport of CAT07_SHELF_FRESHNESS_VIEWPORTS) {
    if (!scenarioKeys.has(viewport.id)) {
      failures.push(`missing CAT07 freshness lifecycle ${viewport.id}`);
    }
  }
  if (resultOrigins.size !== 1) {
    failures.push('all six CAT07 result endUrls must share one exact local app origin');
  }
  if (
    Array.isArray(summary?.bootstrapResults) &&
    summary.bootstrapResults.length === CAT07_SHELF_FRESHNESS_VIEWPORTS.length &&
    Array.isArray(summary?.scenarios) &&
    summary.scenarios.length === CAT07_SHELF_FRESHNESS_VIEWPORTS.length
  ) {
    let previousCompletedAt = startedAt;
    for (let index = 0; index < CAT07_SHELF_FRESHNESS_VIEWPORTS.length; index += 1) {
      for (const result of [summary.bootstrapResults[index], summary.scenarios[index]]) {
        const childStartedAt = parseCanonicalTimestamp(result?.startedAt);
        const childCompletedAt = parseCanonicalTimestamp(result?.completedAt);
        if (
          previousCompletedAt == null ||
          childStartedAt == null ||
          childCompletedAt == null ||
          childStartedAt < previousCompletedAt
        ) {
          failures.push(
            'CAT07 bootstraps and scenarios must execute serially in reviewed viewport order',
          );
          break;
        }
        previousCompletedAt = childCompletedAt;
      }
    }
  }

  if (!isDeepStrictEqual(summary?.artifacts, expectedArtifacts)) {
    failures.push('artifacts must list the exact 99 CAT07 files in lexical order');
  }
  if (
    !Array.isArray(summary?.artifactManifest) ||
    summary.artifactManifest.length !== expectedArtifacts.length
  ) {
    failures.push('artifactManifest must bind the exact 99 CAT07 artifacts');
  } else {
    for (let index = 0; index < expectedArtifacts.length; index += 1) {
      const expectedPath = expectedArtifacts[index];
      const entry = summary.artifactManifest[index];
      if (
        !hasExactObjectKeys(entry, ['bytes', 'path', 'sha256']) ||
        entry?.path !== expectedPath ||
        !Number.isSafeInteger(entry?.bytes) ||
        entry.bytes < 0 ||
        !/^[0-9a-f]{64}$/u.test(String(entry?.sha256 ?? ''))
      ) {
        failures.push(`artifactManifest entry ${index + 1} does not bind ${expectedPath}`);
        continue;
      }
      try {
        const bytes = readBytesFile(`${folder}/${expectedPath}`);
        const actualSha256 = createHash('sha256').update(bytes).digest('hex');
        if (entry.bytes !== bytes.length || entry.sha256 !== actualSha256) {
          failures.push(`artifactManifest bytes/hash do not match ${expectedPath}`);
        }
      } catch {
        failures.push(`artifactManifest could not read ${expectedPath}`);
      }
    }
  }
  for (const artifact of expectedArtifacts) {
    if (!requireTrackedFile(artifact, `artifact ${artifact}`)) continue;
    try {
      const bytes = readBytesFile(`${folder}/${artifact}`);
      if (artifact.endsWith('.json')) {
        failures.push(
          ...inspectCanonicalEvidenceJson(artifact, bytes, {
            allowLocalhostUrlQuery: true,
            maxBytes:
              artifact === 'browser-events-cat07-freshness.json'
                ? CAT07_SHELF_FRESHNESS_MAX_BROWSER_EVENT_BYTES
                : CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
            maxStringBytes: CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_STRING_BYTES,
          }).failures,
        );
      } else if (/\.(?:log|md)$/iu.test(artifact)) {
        failures.push(
          ...collectEvidenceTextArtifactHygieneFailures(artifact, bytes, {
            allowLocalhostUrlQuery: true,
            maxBytes: artifact.endsWith('.log')
              ? CAT07_SHELF_FRESHNESS_MAX_EXPO_LOG_BYTES
              : CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
          }),
        );
      }
    } catch {
      failures.push(`${artifact} could not be inspected as bytes`);
    }
  }
  if (!isDeepStrictEqual(summary?.screenshots, expectedScreenshots)) {
    failures.push('screenshots must list the exact 45 CAT07 PNGs in lexical order');
  }
  if (!isDeepStrictEqual(trackedFolderFiles, [...expectedArtifacts, 'summary.json'].sort())) {
    failures.push(
      'Git-tracked CAT07 evidence must contain summary.json plus the exact 99 declared artifacts',
    );
  }

  const snapshotEvidenceByViewport = new Map(
    CAT07_SHELF_FRESHNESS_VIEWPORTS.map(({ id }) => [id, new Map()]),
  );
  const captureEvidenceByArtifact = new Map();
  const expectedCaptureOrdinalByArtifact = new Map(
    CAT07_CAPTURE_ARTIFACT_ORDER.map((artifact, index) => [artifact, index + 1]),
  );
  for (const screenshot of expectedScreenshots) {
    const viewport = CAT07_SHELF_FRESHNESS_VIEWPORTS.find(({ id }) =>
      screenshot.includes(`-${id}-`),
    );
    if (!viewport) {
      failures.push(`CAT07 screenshot has no reviewed viewport: ${screenshot}`);
      continue;
    }
    let screenshotBytes = null;
    let screenshotSha256 = null;
    try {
      screenshotBytes = readBytesFile(`${folder}/${screenshot}`);
      screenshotSha256 = createHash('sha256').update(screenshotBytes).digest('hex');
      const decoded = decodeStrictCat07Png(screenshotBytes);
      if (decoded.width !== viewport.width || decoded.height !== viewport.height) {
        failures.push(
          `${screenshot} dimensions must be ${viewport.width} x ${viewport.height}, received ${decoded.width} x ${decoded.height}`,
        );
      }
      assertCat07CaptureMarker(decoded, {
        artifact: screenshot,
        runId: summary?.runId,
        viewportId: viewport.id,
      });
      const contentFailure = cat07ScreenshotContentFailure(decoded);
      if (contentFailure) failures.push(`${screenshot} ${contentFailure}`);
    } catch (error) {
      failures.push(
        `${screenshot} is not a readable CAT07 PNG: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const snapshotFile = `${screenshot.slice(0, -4)}.json`;
    try {
      const snapshot = readJsonFile(`${folder}/${snapshotFile}`);
      if (
        !hasExactObjectKeys(snapshot, [
          'alerts',
          'bodyText',
          'captureBinding',
          'controls',
          'inputs',
          'issues',
          'overflowX',
          'title',
          'url',
          'viewport',
        ])
      ) {
        failures.push(`${snapshotFile} must use the exact CAT07 capture schema`);
      }
      const captureBinding = snapshot?.captureBinding;
      const expectedCaptureOrdinal = expectedCaptureOrdinalByArtifact.get(screenshot);
      const capturedAt = parseCanonicalTimestamp(captureBinding?.capturedAt);
      const child = screenshot.startsWith('bootstrap-')
        ? summary?.bootstrapResults?.find(
            (result) => cat07ShelfFreshnessViewportKey(result?.viewport) === viewport.id,
          )
        : summary?.scenarios?.find(
            (result) => cat07ShelfFreshnessViewportKey(result?.viewport) === viewport.id,
          );
      const childStartedAt = parseCanonicalTimestamp(child?.startedAt);
      const childCompletedAt = parseCanonicalTimestamp(child?.completedAt);
      if (
        !hasExactObjectKeys(captureBinding, [
          'artifact',
          'browserEventCursor',
          'capturedAt',
          'captureOrdinal',
          'runId',
          'schemaVersion',
          'screenshotBytes',
          'screenshotSha256',
          'sourceGitSha',
          'viewportId',
        ]) ||
        captureBinding?.schemaVersion !== CAT07_CAPTURE_BINDING_SCHEMA_VERSION ||
        captureBinding?.artifact !== screenshot ||
        captureBinding?.runId !== summary?.runId ||
        captureBinding?.sourceGitSha !== summary?.sourceGitSha ||
        captureBinding?.viewportId !== viewport.id ||
        captureBinding?.captureOrdinal !== expectedCaptureOrdinal ||
        !Number.isSafeInteger(captureBinding?.browserEventCursor) ||
        captureBinding.browserEventCursor < 1 ||
        capturedAt == null ||
        childStartedAt == null ||
        childCompletedAt == null ||
        capturedAt < childStartedAt ||
        capturedAt > childCompletedAt ||
        screenshotBytes == null ||
        captureBinding?.screenshotBytes !== screenshotBytes.length ||
        captureBinding?.screenshotSha256 !== screenshotSha256
      ) {
        failures.push(`${snapshotFile} does not bind its exact run, capture, and screenshot bytes`);
      } else {
        captureEvidenceByArtifact.set(screenshot, {
          browserEventCursor: captureBinding.browserEventCursor,
          capturedAt,
          captureOrdinal: captureBinding.captureOrdinal,
        });
      }
      if (
        !isDeepStrictEqual(snapshot?.viewport, {
          height: viewport.height,
          width: viewport.width,
        })
      ) {
        failures.push(`${snapshotFile} viewport does not match ${viewport.id}`);
      }
      if (!Array.isArray(snapshot?.issues) || snapshot.issues.length !== 0) {
        failures.push(`${snapshotFile} must record zero geometry/control issues`);
      }
      if (snapshot?.overflowX !== 0) {
        failures.push(`${snapshotFile} must record zero horizontal overflow`);
      }
      const contract = cat07SnapshotContract(screenshot, viewport, summary?.runId);
      if (!contract) {
        failures.push(`${snapshotFile} has no reviewed CAT07 step contract`);
        continue;
      }
      let snapshotUrl = null;
      try {
        snapshotUrl = new URL(String(snapshot?.url ?? ''));
      } catch {
        failures.push(`${snapshotFile} must record a valid local CAT07 URL`);
      }
      const expectedOrigin = resultOrigins.size === 1 ? [...resultOrigins][0] : null;
      if (
        snapshotUrl &&
        (snapshotUrl.protocol !== 'http:' ||
          snapshotUrl.hostname !== 'localhost' ||
          snapshotUrl.port.length === 0 ||
          snapshotUrl.username.length > 0 ||
          snapshotUrl.password.length > 0 ||
          snapshotUrl.hash.length > 0 ||
          snapshotUrl.origin !== expectedOrigin)
      ) {
        failures.push(`${snapshotFile} URL must match the exact CAT07 local app origin`);
      }
      if (
        snapshotUrl &&
        (typeof contract.path === 'string'
          ? snapshotUrl.pathname !== contract.path
          : !contract.path.test(snapshotUrl.pathname))
      ) {
        failures.push(`${snapshotFile} URL does not match its reviewed CAT07 route`);
      }
      if (snapshotUrl && contract.requiredMarker) {
        const [parameter, marker] = contract.requiredMarker;
        const values = snapshotUrl.searchParams.getAll(parameter);
        if (values.length !== 1 || values[0] !== marker) {
          failures.push(`${snapshotFile} does not contain its exact CAT07 run marker`);
        }
        const exactSearch = `?${new URLSearchParams([[parameter, marker]]).toString()}`;
        if (snapshotUrl.search !== exactSearch) {
          failures.push(`${snapshotFile} contains unreviewed query components`);
        }
      } else if (
        snapshotUrl &&
        [
          '-02-opening-required.png',
          '-03-future-opened-date-blocked.png',
          '-04-label-pao-ready.png',
        ].some((suffix) => screenshot.endsWith(suffix))
      ) {
        const values = snapshotUrl.searchParams.getAll('intakeId');
        const exactSearch =
          values.length === 1
            ? `?${new URLSearchParams([['intakeId', values[0]]]).toString()}`
            : null;
        if (
          values.length !== 1 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
            values[0] ?? '',
          ) ||
          snapshotUrl.search !== exactSearch
        ) {
          failures.push(`${snapshotFile} contains an invalid or unreviewed intake query`);
        }
      } else if (
        snapshotUrl &&
        (screenshot.includes('-08-replacement-choices.png') ||
          screenshot.includes('-09-future-replacement-date-blocked.png'))
      ) {
        const values = snapshotUrl.searchParams.getAll('id');
        const exactSearch =
          values.length === 1 ? `?${new URLSearchParams([['id', values[0]]]).toString()}` : null;
        if (
          values.length !== 1 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
            values[0] ?? '',
          ) ||
          snapshotUrl.search !== exactSearch
        ) {
          failures.push(`${snapshotFile} contains an invalid or unreviewed replacement id query`);
        }
      } else if (snapshotUrl && snapshotUrl.search.length > 0) {
        failures.push(`${snapshotFile} contains unreviewed query components`);
      }
      const bodyText = typeof snapshot?.bodyText === 'string' ? snapshot.bodyText : '';
      for (const requiredText of contract.requiredBodyText) {
        if (!bodyText.includes(requiredText)) {
          failures.push(`${snapshotFile} is missing reviewed state text: ${requiredText}`);
        }
      }
      for (const forbiddenText of contract.forbiddenBodyText) {
        if (bodyText.includes(forbiddenText)) {
          failures.push(`${snapshotFile} contains forbidden state text: ${forbiddenText}`);
        }
      }
      if (!Array.isArray(snapshot?.controls)) {
        failures.push(`${snapshotFile} controls must be an array`);
      } else {
        for (const expectedControl of contract.requiredControls) {
          const control = snapshot.controls.find((candidate) =>
            String(candidate?.label ?? '').includes(expectedControl.label),
          );
          if (!control || control.disabled !== expectedControl.disabled) {
            failures.push(
              `${snapshotFile} must record ${expectedControl.label} disabled=${expectedControl.disabled}`,
            );
          }
        }
      }
      if (!Array.isArray(snapshot?.inputs) || !Array.isArray(snapshot?.alerts)) {
        failures.push(`${snapshotFile} inputs and alerts must be arrays`);
      }
      const stepKey = screenshot
        .replace(`bootstrap-cat07-freshness-${viewport.id}-`, 'bootstrap-')
        .replace(`freshness-lifecycle-${viewport.id}-`, '')
        .replace(/\.png$/u, '');
      snapshotEvidenceByViewport.get(viewport.id).set(stepKey, {
        path: snapshotUrl?.pathname ?? null,
        searchParams: snapshotUrl?.searchParams ?? null,
      });
    } catch {
      failures.push(`${snapshotFile} is not valid JSON`);
    }
  }

  let previousCaptureAt = Number.NEGATIVE_INFINITY;
  let previousBrowserEventCursor = 0;
  for (let index = 0; index < CAT07_CAPTURE_ARTIFACT_ORDER.length; index += 1) {
    const artifact = CAT07_CAPTURE_ARTIFACT_ORDER[index];
    const capture = captureEvidenceByArtifact.get(artifact);
    if (!capture) {
      failures.push(`${artifact} is missing its valid captureBinding chronology`);
      continue;
    }
    if (
      capture.captureOrdinal !== index + 1 ||
      capture.capturedAt < previousCaptureAt ||
      capture.browserEventCursor < previousBrowserEventCursor
    ) {
      failures.push(`${artifact} violates the exact CAT07 capture chronology`);
    }
    previousCaptureAt = capture.capturedAt;
    previousBrowserEventCursor = capture.browserEventCursor;
  }

  for (const viewport of CAT07_SHELF_FRESHNESS_VIEWPORTS) {
    const snapshots = snapshotEvidenceByViewport.get(viewport.id);
    const originalPath = snapshots.get('06-label-pao-detail')?.path;
    const recordedPath = snapshots.get('07-package-date-recorded')?.path;
    const replacementPath = snapshots.get('11-unopened-replacement-detail')?.path;
    const archivedPath = snapshots.get('14-archived-provenance')?.path;
    const replenishedId = snapshots.get('08-replacement-choices')?.searchParams?.get('id');
    if (
      !CAT07_DETAIL_PATH.test(String(originalPath ?? '')) ||
      recordedPath !== originalPath ||
      archivedPath !== originalPath ||
      replenishedId !== originalPath.slice('/shelf/'.length) ||
      !CAT07_DETAIL_PATH.test(String(replacementPath ?? '')) ||
      replacementPath === originalPath
    ) {
      failures.push(
        `${viewport.id} snapshots do not prove one archived and one distinct replacement identity`,
      );
    }
  }

  let reviewedBrowserEvents = null;
  try {
    const browserEvidence = readJsonFile(`${folder}/browser-events-cat07-freshness.json`);
    const inspected = inspectCat07BrowserEvidenceEnvelope(browserEvidence, summary);
    failures.push(...inspected.failures);
    if (inspected.failures.length === 0) {
      const browserEvents = inspected.events;
      reviewedBrowserEvents = browserEvents;
      const integrityFailures = collectCat07BrowserEvidenceIntegrityFailures(browserEvents, {
        bootstrapResults: summary?.bootstrapResults,
        completedAt: summary?.completedAt,
        runId: summary?.runId,
        scenarios: summary?.scenarios,
        startedAt: summary?.startedAt,
      });
      const browserFailures = classifyCat07ProjectedBrowserFailures(browserEvents);
      const rawEvidenceFailures = [...integrityFailures, ...browserFailures];
      if (rawEvidenceFailures.length > 0) {
        const failureTypes = [
          ...new Set(rawEvidenceFailures.map((failure) => failure.type).filter(Boolean)),
        ];
        failures.push(
          `browser-events-cat07-freshness.json contains ${rawEvidenceFailures.length} browser/integrity failure${rawEvidenceFailures.length === 1 ? '' : 's'}: ${failureTypes.join(', ')}`,
        );
      }
    }
  } catch {
    failures.push('browser-events-cat07-freshness.json is not valid JSON');
  }

  if (reviewedBrowserEvents) {
    for (const artifact of CAT07_CAPTURE_ARTIFACT_ORDER) {
      const capture = captureEvidenceByArtifact.get(artifact);
      if (!capture) continue;
      if (capture.browserEventCursor > reviewedBrowserEvents.length) {
        failures.push(`${artifact} captureBinding browser cursor exceeds retained evidence`);
        continue;
      }
      const priorEvent = reviewedBrowserEvents[capture.browserEventCursor - 1];
      const nextEvent = reviewedBrowserEvents[capture.browserEventCursor];
      const priorAt = Date.parse(String(priorEvent?.observedAt ?? ''));
      const nextAt = nextEvent ? Date.parse(String(nextEvent.observedAt ?? '')) : null;
      if (
        !Number.isFinite(priorAt) ||
        priorAt > capture.capturedAt ||
        (nextEvent && (!Number.isFinite(nextAt) || nextAt < capture.capturedAt))
      ) {
        failures.push(`${artifact} captureBinding browser cursor does not bracket capture time`);
      }
    }
  }

  try {
    if (readTextFile(`${folder}/report.md`) !== buildExpectedCat07ShelfFreshnessReport(summary)) {
      failures.push('report.md does not match the exact CAT07 PASS report contract');
    }
  } catch {
    failures.push('report.md could not be read');
  }

  const sourceGitSha = String(summary?.sourceGitSha ?? '');
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) {
    failures.push('sourceGitSha must be a lowercase full 40-character Git SHA');
  } else if (!sourceGitState) {
    failures.push('sourceGitSha consistency state is unavailable');
  } else {
    if (sourceGitState.sourceGitSha !== sourceGitSha) {
      failures.push('sourceGitSha consistency state does not match summary.sourceGitSha');
    }
    if (sourceGitState.commitExists !== true) {
      failures.push('sourceGitSha does not identify a local Git commit');
    }
    if (sourceGitState.isAncestorOfHead !== true) {
      failures.push('sourceGitSha must be an ancestor of the manifest HEAD');
    }
    if (sourceGitState.runnerMatchesSource !== true) {
      failures.push('CAT07 runner source does not match the recorded sourceGitSha');
    }
    if (sourceGitState.sharedHarnessMatchesSource !== true) {
      failures.push('CAT07 shared CAT04 harness does not match the recorded sourceGitSha');
    }

    const allowedAuditPaths = new Set(HUMAN_E2E_GENERATED_MANIFEST_PATHS);
    const sourceChangeAllowed = (repoPath) => {
      const normalized = normalizeRepoPath(repoPath);
      return (
        normalized.startsWith(folderPrefix) ||
        cat05DocumentationOnlyPath(normalized) ||
        allowedAuditPaths.has(normalized) ||
        ignoredGeneratedOutputPath(normalized)
      );
    };
    const laterSourceChanges = (sourceGitState.changedRepoFilesSinceSource ?? []).filter(
      (repoPath) => !sourceChangeAllowed(repoPath),
    );
    if (laterSourceChanges.length > 0) {
      failures.push(`sourceGitSha predates later source changes: ${laterSourceChanges.join(', ')}`);
    }
    const dirtySourceChanges = (sourceGitState.dirtyTrackedRepoFiles ?? []).filter(
      (repoPath) => !sourceChangeAllowed(repoPath),
    );
    if (dirtySourceChanges.length > 0) {
      failures.push(
        `tracked source files changed after the recorded sourceGitSha: ${dirtySourceChanges.join(', ')}`,
      );
    }
    const untrackedSourceChanges = (sourceGitState.untrackedRepoFiles ?? [])
      .map(normalizeRepoPath)
      .filter(
        (repoPath) =>
          !ignoredUntrackedRuntimeOutputPath(repoPath) && !sourceChangeAllowed(repoPath),
      );
    if (untrackedSourceChanges.length > 0) {
      failures.push(
        `nonignored untracked source is not bound to sourceGitSha: ${untrackedSourceChanges.join(', ')}`,
      );
    }
  }

  return failures;
}

function collectCat07CommittedHeadByteFailures(
  folder,
  relativePaths = ['summary.json', ...expectedCat07ShelfFreshnessArtifacts()],
  headSha = 'HEAD',
) {
  const failures = [];
  for (const relativePath of relativePaths) {
    const repoPath = normalizeRepoPath(`${folder}/${relativePath}`);
    let committed;
    try {
      committed = cat07RunTrustedGit(['show', `${headSha}:${repoPath}`], {
        encoding: 'buffer',
        maxBuffer: CAT07_MAX_SCREENSHOT_BYTES + 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      });
    } catch {
      failures.push(`${repoPath} must exist in HEAD`);
      continue;
    }

    let working;
    try {
      working = readBoundedRegularFile(abs(repoPath), {
        containmentRoot: root,
        maxBytes: CAT07_MAX_SCREENSHOT_BYTES,
      });
    } catch {
      failures.push(`${repoPath} must exist in the working tree`);
      continue;
    }

    if (!committed.equals(working)) {
      failures.push(`${repoPath} working bytes do not match HEAD`);
    }
  }
  return failures;
}

function collectAccountDeletionRecoveryObservationFailures(observations) {
  const failures = [];
  const topLevelKeys = [
    'schemaVersion',
    'surface',
    'capture',
    'browserErrorCount',
    'expectedWarningClasses',
    'liveCredentialsUsed',
    'externalLinksOpened',
    'destructiveRequestsPermittedByFixture',
    'states',
    'limitations',
  ];
  if (!hasExactObjectKeys(observations, topLevelKeys)) {
    return ['observations.json must use the exact reviewed top-level schema'];
  }
  if (
    observations.schemaVersion !== 1 ||
    !hasExactObjectKeys(observations.capture, ['format', 'width', 'height']) ||
    observations.capture.format !== 'jpeg' ||
    observations.capture.width !== 1279 ||
    observations.capture.height !== 720
  ) {
    failures.push('observations.json capture contract must be schema 1 JPEG 1279 x 720');
  }
  if (observations.browserErrorCount !== 0) {
    failures.push('observations.json browserErrorCount must be zero');
  }
  if (
    observations.liveCredentialsUsed !== false ||
    observations.externalLinksOpened !== false ||
    observations.destructiveRequestsPermittedByFixture !== false
  ) {
    failures.push('observations.json fixture safety flags must remain exact false values');
  }
  const expectedWarnings = [
    'placeholder_supabase_configuration',
    'expo_notifications_web_unsupported',
  ];
  if (JSON.stringify(observations.expectedWarningClasses) !== JSON.stringify(expectedWarnings)) {
    failures.push('observations.json expected warning classes changed');
  }
  const expectedStates = [
    {
      id: 'pending',
      fixture: 'pending_then_completed_manual',
      actions: ['launch'],
      alertCount: 1,
      buttons: ['Check status now'],
      screenshot: '01-pending-1279x720.jpg',
    },
    {
      id: 'apple_manual',
      fixture: 'pending_then_completed_manual',
      actions: ['launch', 'click:Check status now'],
      alertCount: 1,
      buttons: ['Open Apple instructions', 'Continue'],
      screenshot: '02-apple-manual-1279x720.jpg',
    },
    {
      id: 'signed_out',
      fixture: 'pending_then_completed_manual',
      actions: ['launch', 'click:Check status now', 'click:Continue'],
      alertCount: 0,
      buttons: ['Begin', 'I already have an account'],
      screenshot: '03-signed-out-landing-1279x720.jpg',
    },
    {
      id: 'invalid_retryable',
      fixture: 'invalid',
      actions: ['launch', 'click:Check status now', 'click:Retry deletion request'],
      alertCount: 1,
      buttons: ['Check status now', 'Retry deletion request', 'Open support'],
      screenshot: '04-invalid-receipt-1279x720.jpg',
    },
    {
      id: 'expired',
      fixture: 'expired',
      actions: ['launch', 'click:Check status now'],
      alertCount: 1,
      buttons: ['Check status now', 'Open support'],
      screenshot: '05-expired-receipt-1279x720.jpg',
    },
    {
      id: 'ownerless_support_only',
      fixture: 'invalid_support_only',
      actions: ['launch', 'click:Check status now'],
      alertCount: 1,
      buttons: ['Check status now', 'Open support'],
      screenshot: '06-ownerless-support-only-1279x720.jpg',
    },
  ];
  if (!Array.isArray(observations.states) || observations.states.length !== expectedStates.length) {
    failures.push('observations.json must contain exactly six reviewed states');
  } else {
    for (let index = 0; index < expectedStates.length; index += 1) {
      const actual = observations.states[index];
      const expected = expectedStates[index];
      if (
        !hasExactObjectKeys(actual, [
          'id',
          'fixture',
          'actions',
          'alertCount',
          'dialogCount',
          'buttons',
          'screenshot',
        ]) ||
        actual.id !== expected.id ||
        actual.fixture !== expected.fixture ||
        JSON.stringify(actual.actions) !== JSON.stringify(expected.actions) ||
        actual.alertCount !== expected.alertCount ||
        actual.dialogCount !== 0 ||
        JSON.stringify(actual.buttons) !== JSON.stringify(expected.buttons) ||
        actual.screenshot !== expected.screenshot
      ) {
        failures.push(`observations.json state ${index + 1} does not match the reviewed trace`);
      }
    }
  }
  if (!Array.isArray(observations.limitations) || observations.limitations.length < 3) {
    failures.push('observations.json must retain explicit evidence limitations');
  }
  return failures;
}

function runEvidenceProvenanceSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/trend-route-group-gate-current';
  const evidence = 'summary.json';
  const requiredFiles = [
    evidence,
    'report.md',
    'pre-fix-route-evidence.json',
    'pre-fix-optin-canonicalized-to-fairness.png',
    'post-fix-route-evidence.json',
    'post-fix-trend-optin.png',
    'post-fix-trend-fairness.png',
  ];
  const artifacts = requiredFiles.slice(1);
  const repoPaths = requiredFiles.map((file) => `${folder}/${file}`);
  const existing = new Set(repoPaths);
  const tracked = new Set(repoPaths);
  const validate = (overrides = {}) =>
    collectEvidenceProvenanceFailures({
      folder,
      evidence,
      requiredFiles,
      summaryArtifacts: artifacts,
      trackedRepoFiles: tracked,
      fileExists: (path) => existing.has(path),
      ...overrides,
      validateSummaryArtifacts: true,
    });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  assert(validate().length === 0, 'complete tracked Trend evidence should pass provenance');

  const missingReport = validate({
    fileExists: (path) => existing.has(path) && !path.endsWith('/report.md'),
  });
  assert(
    missingReport.includes('missing required evidence file report.md') &&
      missingReport.includes('missing summary artifact report.md'),
    'missing files must fail both the gate requirement and summary artifact provenance',
  );

  const untrackedFairness = validate({
    trackedRepoFiles: new Set(
      repoPaths.filter((path) => !path.endsWith('/post-fix-trend-fairness.png')),
    ),
  });
  assert(
    untrackedFairness.includes(
      'required evidence file is not Git-tracked: post-fix-trend-fairness.png',
    ) &&
      untrackedFairness.includes(
        'summary artifact is not Git-tracked: post-fix-trend-fairness.png',
      ),
    'untracked files must fail both the gate requirement and summary artifact provenance',
  );

  const incompleteSummary = validate({ summaryArtifacts: artifacts.slice(1) });
  assert(
    incompleteSummary.includes('summary.artifacts is missing required evidence file report.md'),
    'summary.artifacts must enumerate every required auxiliary artifact',
  );

  const unsafeSummary = validate({ summaryArtifacts: [...artifacts, '../outside.png'] });
  assert(
    unsafeSummary.includes('summary.artifacts contains an unsafe path: ../outside.png'),
    'summary.artifacts must not escape the evidence folder',
  );

  const reportText = [
    'App surface: Expo web development fixtures',
    'native iPhone evidence remains required',
  ].join('\n');
  assert(
    collectRequiredTextFailures({
      label: 'report.md',
      text: reportText,
      requiredText: ['Expo web development fixtures', 'native iPhone evidence remains required'],
    }).length === 0,
    'complete report text should pass required-text provenance',
  );
  assert(
    collectRequiredTextFailures({
      label: 'report.md',
      text: reportText,
      requiredText: ['physical iPhone provider proof'],
    }).includes('report.md is missing required text: physical iPhone provider proof'),
    'missing report claims must fail required-text provenance',
  );

  assert(
    isDeepStrictEqual(
      collectDisallowedUntrackedRepoFiles([
        '.tmp/browser-profile/runtime.json',
        'apps/mobile/src/app/untracked-route.tsx',
        'docs/generated/readiness-status-audit.json',
        'docs/phase-9/generated/near-miss.json',
      ]),
      ['apps/mobile/src/app/untracked-route.tsx', 'docs/phase-9/generated/near-miss.json'],
    ),
    'manifest provenance must reject source and generated near-misses while allowing exact declared outputs',
  );
  assert(
    GOVERNED_DOWNSTREAM_GENERATED_PATHS.length === 67 &&
      governedDownstreamGeneratedPathSet.size === 67,
    'human manifest must consume the central exact 67-path generated-output inventory',
  );

  const jpegHeader = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x04, 0xff, 0x03, 0x01, 0x11, 0x00, 0x02,
    0x11, 0x00, 0x03, 0x11, 0x00,
  ]);
  assert(
    JSON.stringify(parseJpegDimensions(jpegHeader)) ===
      JSON.stringify({ width: 1279, height: 720 }),
    'JPEG evidence dimensions must be parsed from the committed bytes',
  );
  let invalidJpegRejected = false;
  try {
    parseJpegDimensions(Buffer.from('not-a-jpeg'));
  } catch {
    invalidJpegRejected = true;
  }
  assert(invalidJpegRejected, 'non-JPEG evidence must fail dimension parsing');

  const evidenceBindingFixture = new Map([
    [
      'test-results/human-e2e/2099-01-01/example/summary.json',
      {
        identity: 'fixture-identity',
        path: 'test-results/human-e2e/2099-01-01/example/summary.json',
        sha256: 'a'.repeat(64),
        sizeBytes: 42,
      },
    ],
  ]);
  const fixtureHash = (_root, path, { expectedSizeBytes }) => ({
    identity: 'fixture-identity',
    kind: 'file',
    sha256: 'a'.repeat(64),
    sizeBytes: expectedSizeBytes,
    path,
  });
  assert(
    verifyHumanEvidenceBindings(evidenceBindingFixture, fixtureHash).length === 0,
    'unchanged active evidence bindings must pass the final manifest recheck',
  );
  assert(
    verifyHumanEvidenceBindings(evidenceBindingFixture, (...hashArgs) => ({
      ...fixtureHash(...hashArgs),
      identity: 'replacement-identity',
    })).includes(
      'test-results/human-e2e/2099-01-01/example/summary.json changed during human-E2E manifest assembly',
    ),
    'same-size active evidence path replacement must fail the final manifest recheck',
  );

  let redirectedManifestOutputRejected = false;
  try {
    execFileSync(
      process.execPath,
      [resolve(root, 'scripts/e2e/human-e2e-manifest.mjs'), '--check'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          E2E_MANIFEST_OUT_DIR: 'docs/phase-9/release-candidates/forged',
        },
        maxBuffer: 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
        windowsHide: true,
      },
    );
  } catch (error) {
    redirectedManifestOutputRejected =
      error?.status === 1 &&
      String(error?.stderr ?? '').includes(
        'FAIL E2E_MANIFEST_OUT_DIR cannot redirect the governed human-E2E manifest.',
      );
  }
  assert(
    redirectedManifestOutputRejected,
    'the governed human-E2E manifest must reject caller-selected output directories',
  );

  assert(
    exactIsoTimestamp('2026-07-22T12:34:56.789Z') &&
      !exactIsoTimestamp('2026-07-22T12:34:56Z') &&
      !exactIsoTimestamp('<generatedAt>'),
    'committed human-E2E generatedAt validation must accept only canonical ISO timestamps',
  );
  const manifestBuilderSource = readBoundedRegularFile(abs('scripts/e2e/human-e2e-manifest.mjs'), {
    containmentRoot: root,
    maxBytes: 16 * 1024 * 1024,
  }).toString('utf8');
  assert(
    manifestBuilderSource.includes(
      'inputPaths: check\n      ? [...manifestSourceInputPaths, ...manifestOutputPaths]',
    ) &&
      manifestBuilderSource.includes('outputPaths: check ? [] : manifestOutputPaths') &&
      manifestBuilderSource.includes("record?.workingKind !== 'file'") &&
      manifestBuilderSource.includes('!record.workingTreeMatchesHead') &&
      manifestBuilderSource.includes(
        'humanManifestStabilityErrors({ includeSourceSnapshot: true })',
      ) &&
      manifestBuilderSource.includes('HUMAN_E2E_MANIFEST_CHECK_COMPARISON_COMPLETE'),
    'human-E2E check mode must bind committed output bytes and perform a final post-comparison drift recheck',
  );

  let unsafeEvidenceDateRejected = false;
  try {
    execFileSync(
      process.execPath,
      [resolve(root, 'scripts/e2e/human-e2e-manifest.mjs'), '--check', '--date=../escape'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          E2E_MANIFEST_OUT_DIR: '',
        },
        maxBuffer: 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
        windowsHide: true,
      },
    );
  } catch (error) {
    unsafeEvidenceDateRejected =
      error?.status === 1 &&
      String(error?.stderr ?? '').includes(
        'FAIL Human-E2E evidence date must use exact YYYY-MM-DD syntax.',
      );
  }
  assert(
    unsafeEvidenceDateRejected,
    'the human-E2E manifest must reject evidence-date path traversal',
  );
}

function runGovernedEvidenceChainConsumerSmoke() {
  const fixtureRoots = [];
  const rcDir = 'docs/phase-9/release-candidates/rc-2099-01-01-b001';
  const rcManifestPath = `${rcDir}/manifest.md`;
  const ledgerPath = `${rcDir}/evidence-chain.json`;
  const humanPath = 'test-results/human-e2e/2099-01-01/cat07-shelf-freshness-current/summary.json';
  const historicalRequiredPath =
    'test-results/human-e2e/2099-01-01/trend-route-group-gate-current/summary.json';
  const publicationUnitById = new Map(
    GOVERNED_DOWNSTREAM_PUBLICATION_UNITS.map((unit) => [unit.id, unit]),
  );
  const requiredPostEvidenceOrder = (() => {
    const remaining = new Set(GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS);
    const completed = new Set();
    const ordered = [];
    while (remaining.size > 0) {
      const next = [...remaining]
        .sort()
        .find((unitId) =>
          GOVERNED_POST_E_PUBLICATION_DAG_EDGES.filter(({ after }) => after === unitId).every(
            ({ before }) => completed.has(before),
          ),
        );
      if (!next) throw new Error('governed consumer-smoke publication policy contains a cycle');
      ordered.push(next);
      completed.add(next);
      remaining.delete(next);
    }
    return ordered;
  })();
  const gitContext = cat07TrustedGitContext();
  const git = (fixtureRoot, commandArgs) =>
    execFileSync(
      gitContext.gitExecutable,
      ['-c', `safe.directory=${resolve(fixtureRoot)}`, ...commandArgs],
      {
        cwd: fixtureRoot,
        encoding: 'utf8',
        env: gitContext.environment,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
        windowsHide: true,
      },
    ).trim();
  const write = (fixtureRoot, repoPath, bytes) => {
    const absolute = resolve(fixtureRoot, ...repoPath.split('/'));
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes);
  };
  const writePublicationUnit = (fixtureRoot, unitId, marker) => {
    const unit = publicationUnitById.get(unitId);
    if (!unit) throw new Error(`unknown governed consumer-smoke publication unit: ${unitId}`);
    for (const repoPath of unit.paths) {
      write(
        fixtureRoot,
        repoPath,
        repoPath.endsWith('.json')
          ? `${JSON.stringify({ marker, unitId })}\n`
          : `# ${marker}: ${unitId}\n`,
      );
    }
    return unit;
  };
  const commit = (fixtureRoot, message) => {
    git(fixtureRoot, ['add', '--all']);
    git(fixtureRoot, [
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=Human Evidence Consumer Smoke',
      '-c',
      'user.email=human-evidence@example.invalid',
      'commit',
      '--quiet',
      '-m',
      message,
    ]);
    return git(fixtureRoot, ['rev-parse', 'HEAD']);
  };
  const createFixture = ({ omitHumanEntry = false, stopAtEvidence = false } = {}) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'routinekind-human-chain-consumer-'));
    fixtureRoots.push(fixtureRoot);
    git(fixtureRoot, ['init', '--quiet', '--initial-branch=main']);
    write(fixtureRoot, '.gitattributes', '* text=auto eol=lf\n');
    write(fixtureRoot, 'source.txt', 'immutable source\n');
    write(
      fixtureRoot,
      GOVERNED_LAUNCH_CONTRACT_PATH,
      readFileSync(resolve(root, ...GOVERNED_LAUNCH_CONTRACT_PATH.split('/'))),
    );
    for (const unitId of GOVERNED_SOURCE_SNAPSHOT_PUBLICATION_UNIT_IDS) {
      writePublicationUnit(fixtureRoot, unitId, 'source snapshot S');
    }
    const historicalRequiredBytes = Buffer.from(
      `${JSON.stringify({ status: 'pass', surface: 'expo-web' }, null, 2)}\n`,
      'utf8',
    );
    write(fixtureRoot, historicalRequiredPath, historicalRequiredBytes);
    const sourceGitSha = commit(fixtureRoot, 'source S');
    const publicationPolicy = captureGovernedPublicationPolicy(fixtureRoot, sourceGitSha);
    const humanBytes = Buffer.from(
      `${JSON.stringify({ sourceGitSha, status: 'pass' }, null, 2)}\n`,
      'utf8',
    );
    const rcBytes = Buffer.from('# Selected release candidate\n', 'utf8');
    write(fixtureRoot, humanPath, humanBytes);
    write(fixtureRoot, rcManifestPath, rcBytes);
    const entries = [
      {
        path: rcManifestPath,
        role: 'release-candidate',
        sha256: createHash('sha256').update(rcBytes).digest('hex'),
      },
    ];
    if (!omitHumanEntry) {
      entries.push({
        path: humanPath,
        role: 'human-e2e',
        sha256: createHash('sha256').update(humanBytes).digest('hex'),
      });
    }
    write(
      fixtureRoot,
      ledgerPath,
      renderGovernedEvidenceLedger({
        sourceGitSha,
        releaseCandidateDir: rcDir,
        publicationPolicy,
        entries,
      }),
    );
    const evidenceGitSha = commit(fixtureRoot, 'evidence E');
    if (stopAtEvidence) {
      return {
        evidenceGitSha,
        finalGitSha: evidenceGitSha,
        fixtureRoot,
        historicalRequiredBytes,
        humanBytes,
        releasePacketGitSha: null,
        sourceGitSha,
      };
    }
    const publicationCommits = new Map();
    for (const unitId of requiredPostEvidenceOrder) {
      writePublicationUnit(fixtureRoot, unitId, 'generated R');
      publicationCommits.set(unitId, commit(fixtureRoot, `generated R ${unitId}`));
    }
    const releasePacketGitSha = publicationCommits.get(
      'docs/generated/generated-packet-status-audit',
    );
    writePublicationUnit(fixtureRoot, GOVERNED_FINAL_READINESS_PUBLICATION_UNIT_ID, 'readiness F');
    const finalGitSha = commit(fixtureRoot, 'readiness F');
    return {
      evidenceGitSha,
      finalGitSha,
      fixtureRoot,
      historicalRequiredBytes,
      humanBytes,
      releasePacketGitSha,
      sourceGitSha,
    };
  };
  const auditFixture = (fixture) =>
    auditGovernedEvidenceChain({
      root: fixture.fixtureRoot,
      sourceGitSha: fixture.sourceGitSha,
      releaseCandidateDir: rcDir,
      expectedHeadSha: fixture.finalGitSha,
    });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  try {
    const accepted = createFixture();
    const acceptedAudit = auditFixture(accepted);
    assert(
      acceptedAudit.status === 'pass',
      'S to E to every required R publication to F fixture must pass',
    );
    assert(
      acceptedAudit.evidenceCommitSha === accepted.evidenceGitSha &&
        acceptedAudit.headGitSha === accepted.finalGitSha &&
        acceptedAudit.downstreamCommits.length ===
          GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.length + 1,
      'consumer audit must record exact S, E, every one-unit R commit, and the final F commit',
    );
    const acceptedBinding = governedEvidenceChainBinding(acceptedAudit);
    assert(
      acceptedBinding.sourceGitSha === accepted.sourceGitSha &&
        acceptedBinding.evidenceCommitSha === accepted.evidenceGitSha &&
        acceptedBinding.currentGitSha === accepted.finalGitSha &&
        acceptedBinding.releaseCandidateDir === rcDir &&
        /^[0-9a-f]{64}$/u.test(acceptedBinding.ledgerSha256) &&
        acceptedBinding.ledgerEntryCount === 2,
      'consumer binding must record S, E, selected RC, ledger hash/count, and current F',
    );
    assert(
      collectRecordedGovernedDescendantFailures(
        {
          ...acceptedBinding,
          currentGitSha: accepted.releasePacketGitSha,
          downstreamCommitCount: GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.length,
        },
        acceptedAudit,
      ).length === 0,
      'a manifest recorded at the complete R prefix must remain valid when checked at F',
    );
    assert(
      collectRecordedGovernedDescendantFailures(
        {
          ...acceptedBinding,
          currentGitSha: 'f'.repeat(40),
          downstreamCommitCount: 1,
        },
        acceptedAudit,
      ).some((error) => error.includes('currentGitSha is not E')),
      'a forged governed current commit must fail before descendant fields are masked',
    );
    assert(
      collectRecordedGovernedDescendantFailures(
        {
          ...acceptedBinding,
          currentGitSha: accepted.releasePacketGitSha,
          downstreamCommitCount: GOVERNED_REQUIRED_POST_E_PUBLICATION_UNIT_IDS.length + 1,
        },
        acceptedAudit,
      ).some((error) => error.includes('exact prefix position')),
      'a forged governed downstream count must fail before descendant fields are masked',
    );
    const acceptedFailures = collectGovernedHumanEvidenceFailures({
      audit: acceptedAudit,
      bindingsByPath: new Map([
        [
          humanPath,
          {
            path: humanPath,
            sha256: createHash('sha256').update(accepted.humanBytes).digest('hex'),
            sizeBytes: accepted.humanBytes.length,
          },
        ],
      ]),
      requiredEvidencePaths: [humanPath],
      recordedSourceGitShas: [accepted.sourceGitSha],
    });
    assert(
      acceptedFailures.length === 0,
      'exact ledger-bound human evidence at E must clear the consumer binding gate',
    );

    const freshPublication = createFixture({ stopAtEvidence: true });
    const freshAudit = auditFixture(freshPublication);
    assert(freshAudit.status === 'pass', 'fresh human-manifest publication audit must pass at E');
    const freshBindings = captureGovernedEvidenceWorkingBindings(
      freshAudit,
      freshPublication.fixtureRoot,
    );
    const freshSnapshot = captureReleaseQaSnapshot({
      root: freshPublication.fixtureRoot,
      inputPaths: ['source.txt'],
      outputPaths: manifestOutputPaths,
    });
    const freshJsonBytes = Buffer.from('{"fresh":true}\n', 'utf8');
    const freshMarkdownBytes = Buffer.from('# Fresh human manifest\n', 'utf8');
    atomicWriteReleaseQaOutputs({
      root: freshPublication.fixtureRoot,
      snapshot: freshSnapshot,
      outputs: [
        { path: manifestOutputPaths[0], bytes: freshJsonBytes },
        { path: manifestOutputPaths[1], bytes: freshMarkdownBytes },
      ],
      verifyAdditional() {
        return verifyGovernedEvidenceWorkingBindings(freshBindings, freshPublication.fixtureRoot, {
          context: 'fresh human-E2E manifest publication smoke',
        });
      },
    });
    assert(
      readBoundedRegularFile(resolve(freshPublication.fixtureRoot, manifestOutputPaths[0]), {
        containmentRoot: freshPublication.fixtureRoot,
        maxBytes: 1024,
      }).equals(freshJsonBytes) &&
        readBoundedRegularFile(resolve(freshPublication.fixtureRoot, manifestOutputPaths[1]), {
          containmentRoot: freshPublication.fixtureRoot,
          maxBytes: 1024,
        }).equals(freshMarkdownBytes),
      'fresh human-E2E output pair must publish atomically without a post-write clean-tree audit',
    );
    const historicalRequiredFailures = collectGovernedHumanEvidenceFailures({
      audit: acceptedAudit,
      bindingsByPath: new Map([
        [
          historicalRequiredPath,
          {
            path: historicalRequiredPath,
            sha256: createHash('sha256').update(accepted.historicalRequiredBytes).digest('hex'),
            sizeBytes: accepted.historicalRequiredBytes.length,
          },
        ],
      ]),
      requiredEvidencePaths: [historicalRequiredPath],
      recordedSourceGitShas: [],
    });
    assert(
      historicalRequiredFailures.includes(
        `${historicalRequiredPath} is not an exact digest-bound human-e2e ledger entry at E`,
      ),
      'a required non-CAT active gate must not clear from historical unledgered evidence',
    );

    const equalAliasAudit = auditConfiguredGovernedEvidenceChain({
      auditRoot: accepted.fixtureRoot,
      environment: {
        GOVERNED_EVIDENCE_RC_DIR: rcDir,
        GOVERNED_EVIDENCE_SOURCE_GIT_SHA: accepted.sourceGitSha,
        PHASE9_IOS_SOURCE_GIT_SHA: accepted.sourceGitSha,
        PHASE9_RELEASE_CANDIDATE_DIR: rcDir,
      },
      expectedHeadSha: accepted.finalGitSha,
    });
    assert(
      equalAliasAudit.status === 'pass',
      'exact-equality governed aliases must preserve the canonical Phase 9 selection',
    );
    const conflictingSourceAliasAudit = auditConfiguredGovernedEvidenceChain({
      auditRoot: accepted.fixtureRoot,
      environment: {
        GOVERNED_EVIDENCE_RC_DIR: rcDir,
        GOVERNED_EVIDENCE_SOURCE_GIT_SHA: 'b'.repeat(40),
        PHASE9_IOS_SOURCE_GIT_SHA: accepted.sourceGitSha,
        PHASE9_RELEASE_CANDIDATE_DIR: rcDir,
      },
      expectedHeadSha: accepted.finalGitSha,
    });
    assert(
      conflictingSourceAliasAudit.status === 'invalid' &&
        conflictingSourceAliasAudit.errors.some((error) =>
          error.includes('select different source commits'),
        ),
      'conflicting canonical and alias source commits must fail closed',
    );
    const conflictingRcAliasAudit = auditConfiguredGovernedEvidenceChain({
      auditRoot: accepted.fixtureRoot,
      environment: {
        GOVERNED_EVIDENCE_RC_DIR: 'docs/phase-9/release-candidates/rc-2099-01-02-b002',
        GOVERNED_EVIDENCE_SOURCE_GIT_SHA: accepted.sourceGitSha,
        PHASE9_IOS_SOURCE_GIT_SHA: accepted.sourceGitSha,
        PHASE9_RELEASE_CANDIDATE_DIR: rcDir,
      },
      expectedHeadSha: accepted.finalGitSha,
    });
    assert(
      conflictingRcAliasAudit.status === 'invalid' &&
        conflictingRcAliasAudit.errors.some((error) =>
          error.includes('select different release-candidate directories'),
        ),
      'conflicting canonical and alias release-candidate directories must fail closed',
    );

    const unledgered = createFixture({ omitHumanEntry: true, stopAtEvidence: true });
    assert(
      auditFixture(unledgered).status === 'invalid',
      'an unledgered human evidence file in E must fail',
    );

    const mutated = createFixture({ stopAtEvidence: true });
    write(mutated.fixtureRoot, humanPath, '{"sourceGitSha":"forged"}\n');
    mutated.finalGitSha = commit(mutated.fixtureRoot, 'mutate raw evidence after E');
    assert(auditFixture(mutated).status === 'invalid', 'post-E raw evidence mutation must fail');

    const nearMiss = createFixture({ stopAtEvidence: true });
    write(nearMiss.fixtureRoot, 'docs/phase-7/generated/near-miss.json', '{}\n');
    nearMiss.finalGitSha = commit(nearMiss.fixtureRoot, 'generated near miss');
    assert(
      auditFixture(nearMiss).status === 'invalid',
      'an arbitrary phase generated near-miss must fail exact membership',
    );
  } finally {
    for (const fixtureRoot of fixtureRoots) rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

function runCat04CatalogRecoveryContractSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/cat04-catalog-recovery-current';
  const peerEvidenceFolder = 'test-results/human-e2e/2099-01-01/cat05-native-ocr-web-ui-current';
  const cat07EvidenceFolder = CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_PREFIX.slice(0, -1);
  const timestamp = '2099-01-01T00:00:00.000Z';
  const files = new Map();
  const screenshots = [];
  const scenarios = [];
  const bootstrapResults = [];
  const reportLines = [
    '# CAT04 Catalog Recovery Expo-Web Audit',
    '- Verdict: pass',
    '- Surface: Expo web deterministic development fixtures',
    '- Native-device proof: No',
    `- Source Git SHA: ${'a'.repeat(40)}`,
    'Machine-readable result: `summary.json`',
  ];

  const persistResult = (prefix, result) => {
    files.set(`${prefix}-result.json`, result);
    const screenshot = `${prefix}-proof.png`;
    screenshots.push(screenshot);
    files.set(screenshot, '<png>');
    files.set(`${prefix}-proof.json`, { url: 'http://localhost/proof' });
  };

  for (const fixtureGroup of CAT04_CATALOG_FIXTURE_GROUPS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const prefix = `bootstrap-${fixtureGroup}-${viewport.id}`;
      const result = {
        artifactPrefix: prefix,
        browserFailures: [],
        completedAt: timestamp,
        endUrl: 'http://localhost/shelf/search',
        error: null,
        fixtureGroup,
        nativeDeviceProof: false,
        startedAt: timestamp,
        surface: 'expo-web',
        verdict: 'pass',
        viewport: { ...viewport },
      };
      bootstrapResults.push(result);
      persistResult(prefix, result);
      reportLines.push(`| ${fixtureGroup} | ${viewport.width}x${viewport.height} | pass |  |`);
    }
  }

  for (const scenario of CAT04_CATALOG_SCENARIOS) {
    for (const viewport of CAT04_CATALOG_VIEWPORTS) {
      const prefix = `${scenario.id}-${viewport.id}`;
      const result = {
        artifactPrefix: prefix,
        browserFailures: [],
        completedAt: timestamp,
        endUrl: `http://localhost${scenario.route}`,
        error: null,
        fixture: scenario.fixture,
        fixtureGroup: scenario.groupId,
        nativeDeviceProof: false,
        route: scenario.route,
        scenarioId: scenario.id,
        startedAt: timestamp,
        surface: 'expo-web',
        verdict: 'pass',
        viewport: { ...viewport },
      };
      scenarios.push(result);
      persistResult(prefix, result);
      reportLines.push(`| ${scenario.id} | ${viewport.width}x${viewport.height} | pass |  |`);
    }
  }

  files.set('report.md', reportLines.join('\n'));
  const summary = {
    artifacts: [...files.keys()].sort(),
    bootstrapResults,
    completedAt: timestamp,
    expectedBootstrapCount: 18,
    expectedExecutionCount: 45,
    fixtureGroups: [...CAT04_CATALOG_FIXTURE_GROUPS],
    limitations: ['Expo web only.'],
    nativeDeviceProof: false,
    requiredViewports: CAT04_CATALOG_VIEWPORTS.map((viewport) => ({ ...viewport })),
    scenarioDefinitions: CAT04_CATALOG_SCENARIOS.map((scenario) => ({ ...scenario })),
    scenarios,
    schemaVersion: 1,
    screenshots: [...screenshots].sort(),
    sourceGitSha: 'a'.repeat(40),
    startedAt: timestamp,
    surface: 'expo-web',
    verdict: 'pass',
  };
  files.set('summary.json', summary);
  const trackedRepoFiles = new Set([...files.keys()].map((file) => `${folder}/${file}`));
  const sourceGitState = {
    changedRepoFilesSinceSource: [],
    commitExists: true,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: true,
    runnerMatchesSource: true,
    sourceGitSha: summary.sourceGitSha,
    untrackedRepoFiles: [],
  };
  const validate = (candidate = summary, overrides = {}) =>
    collectCat04CatalogRecoveryFailures({
      folder,
      peerEvidenceFolder: overrides.peerEvidenceFolder ?? peerEvidenceFolder,
      summary: candidate,
      sourceGitState,
      trackedRepoFiles,
      fileExists: (path) => files.has(path.slice(`${folder}/`.length)),
      readJsonFile: (path) => files.get(path.slice(`${folder}/`.length)),
      readTextFile: (path) => files.get(path.slice(`${folder}/`.length)),
      ...overrides,
    });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  assert(validate().length === 0, 'complete tracked CAT04 evidence should pass');

  const browserFailure = structuredClone(summary);
  browserFailure.scenarios[0].browserFailures = [{ kind: 'console-error' }];
  assert(
    validate(browserFailure).some((failure) =>
      failure.includes('browserFailures must be an empty array'),
    ),
    'scenario browser failures must fail the CAT04 contract',
  );

  const duplicateScenario = structuredClone(summary);
  duplicateScenario.scenarios[1] = duplicateScenario.scenarios[0];
  const duplicateFailures = validate(duplicateScenario);
  assert(
    duplicateFailures.some((failure) => failure.includes('duplicate scenario execution')) &&
      duplicateFailures.some((failure) => failure.includes('missing scenario execution')),
    'duplicate scenario/viewport pairs must fail exact matrix coverage',
  );

  const missingArtifact = structuredClone(summary);
  missingArtifact.artifacts = missingArtifact.artifacts.filter(
    (artifact) => artifact !== 'report.md',
  );
  assert(
    validate(missingArtifact).some((failure) =>
      failure.includes('artifacts is missing required CAT04 evidence report.md'),
    ),
    'optional artifacts provenance must cover the CAT04 report when present',
  );

  const untrackedScreenshot = screenshots[0];
  const reducedTracked = new Set(trackedRepoFiles);
  reducedTracked.delete(`${folder}/${untrackedScreenshot}`);
  assert(
    validate(summary, { trackedRepoFiles: reducedTracked }).some((failure) =>
      failure.includes(`CAT04 evidence file is not Git-tracked: ${untrackedScreenshot}`),
    ),
    'untracked CAT04 screenshots must fail provenance',
  );

  const invalidSourceSha = { ...summary, sourceGitSha: 'short' };
  assert(
    validate(invalidSourceSha).includes(
      'sourceGitSha must be a lowercase full 40-character Git SHA',
    ),
    'sourceGitSha must be mandatory and validated',
  );

  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['apps/mobile/src/app/(tabs)/shelf.tsx'],
      },
    }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
    'later production changes must invalidate the recorded source SHA',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [`${folder}/report.md`],
      },
    }).length === 0,
    'the evidence commit itself may descend from the recorded source SHA',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [
          `${peerEvidenceFolder}/report.md`,
          'docs/e2e/generated/human-e2e-manifest.json',
        ],
        dirtyTrackedRepoFiles: [
          `${peerEvidenceFolder}/summary.json`,
          'docs/e2e/generated/human-e2e-manifest.md',
        ],
        untrackedRepoFiles: [`${peerEvidenceFolder}/rerun-screenshot.png`],
      },
    }).length === 0,
    'an exact CAT05 sibling refresh and generated human manifest outputs may follow CAT04 source',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [`${cat07EvidenceFolder}/summary.json`],
        dirtyTrackedRepoFiles: [`${cat07EvidenceFolder}/report.md`],
        untrackedRepoFiles: [`${cat07EvidenceFolder}/rerun-screenshot.png`],
      },
    }).length === 0,
    'the exact governed 2026-07-22 CAT07 evidence folder may follow older CAT04 source',
  );
  for (const unrelatedEvidencePath of [
    'test-results/human-e2e/2099-01-01/cat06-camera-lifecycle-current/summary.json',
    'test-results/human-e2e/2099-01-02/cat05-native-ocr-web-ui-current/summary.json',
    'test-results/human-e2e/2099-01-01/cat07-shelf-freshness-current/summary.json',
    'test-results/human-e2e/2026-07-21/cat07-shelf-freshness-current/summary.json',
    'test-results/human-e2e/2026-07-22/unscoped-evidence.json',
  ]) {
    assert(
      validate(summary, {
        sourceGitState: {
          ...sourceGitState,
          changedRepoFilesSinceSource: [unrelatedEvidencePath],
        },
      }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
      `unrelated CAT04 evidence path must remain source-invalidating: ${unrelatedEvidencePath}`,
    );
  }
  assert(
    validate(summary, {
      peerEvidenceFolder: 'test-results/human-e2e/2099-01-01',
    }).some((failure) =>
      failure.includes(
        'CAT04 peer evidence folder must be the exact dated CAT05 evidence directory',
      ),
    ),
    'CAT04 must reject a broad human-E2E peer evidence prefix',
  );
  assert(
    validate(summary, {
      peerEvidenceFolder: 'test-results/human-e2e/2099-01-02/cat05-native-ocr-web-ui-current',
    }).some((failure) => failure.includes('on the same date as CAT04')),
    'CAT04 must reject an exact CAT05 peer evidence folder from a different date',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        untrackedRepoFiles: ['apps/mobile/src/app/shelf/untracked-route.tsx'],
      },
    }).some((failure) => failure.includes('nonignored untracked source is not bound')),
    'untracked app source must invalidate source-bound CAT04 evidence',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        untrackedRepoFiles: [
          `${folder}/rerun-screenshot.png`,
          '.tmp/cat04-browser-profile/runtime.json',
          'docs/generated/readiness-status-audit.json',
        ],
      },
    }).length === 0,
    'only declared CAT04 evidence, generated packets, and runtime scratch may remain untracked',
  );
  assert(
    validate(summary, {
      sourceGitState: { ...sourceGitState, runnerMatchesSource: false },
    }).includes('CAT04 runner source does not match the recorded sourceGitSha'),
    'runner drift must invalidate source-bound CAT04 evidence',
  );

  const missingArtifacts = { ...summary };
  delete missingArtifacts.artifacts;
  assert(
    validate(missingArtifacts).includes(
      'artifacts must be a deterministic evidence-relative array',
    ),
    'artifacts provenance must be mandatory',
  );
}

function runCat05NativeOcrReviewContractSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/cat05-native-ocr-web-ui-current';
  const peerEvidenceFolder = 'test-results/human-e2e/2099-01-01/cat04-catalog-recovery-current';
  const cat07EvidenceFolder = CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_PREFIX.slice(0, -1);
  const timestamp = '2099-01-01T00:00:00.000Z';
  const sourceGitSha = 'a'.repeat(40);
  const runId = '00000000-0000-4000-8000-000000000001';
  const fixtureConfigurationSha256 = 'b'.repeat(64);
  const scenarioMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_SCENARIOS);
  const viewportMatrixSha256 = cat05Sha256Json(CAT05_NATIVE_OCR_VIEWPORTS);
  const webFixtureBuild = {
    buildId: cat05Sha256Json({
      evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
      fixtureConfigurationSha256,
      scenarioMatrixSha256,
      sourceGitSha,
      viewportMatrixSha256,
    }),
    profile: 'development-only-deterministic-expo-web',
  };
  const binding = {
    candidateNativeBuild: { ...CAT05_NATIVE_OCR_CANDIDATE_BUILD },
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    expectedSourceGitSha: sourceGitSha,
    fixtureConfigurationSha256,
    runId,
    scenarioMatrixSha256,
    sourceGitSha,
    viewportMatrixSha256,
    webFixtureBuild,
  };
  const privacySourceContract = {
    assertionIds: [...CAT05_NATIVE_OCR_PRIVACY_ASSERTIONS],
    files: CAT05_NATIVE_OCR_PRIVACY_FILES.map((path, index) => ({
      bytes: index + 1,
      path,
      sha256: String(index + 1).repeat(64),
    })),
    nativeDeviceProof: false,
    proofKind: 'source-assertions-only',
  };
  const artifactBinding = (artifact) => ({
    ...binding,
    ...expectedCat05ArtifactBindingMetadata(artifact),
  });
  const results = [];
  const groupBrowserAudits = [];
  const resultByFile = new Map();
  const bootstrapViewport = CAT05_NATIVE_OCR_VIEWPORTS[1];

  for (const fixtureGroup of CAT05_NATIVE_OCR_FIXTURE_GROUPS) {
    const prefix = `bootstrap-${fixtureGroup}-${bootstrapViewport.id}`;
    const resultFile = `${prefix}-result.json`;
    const result = {
      artifactPrefix: prefix,
      browserFailures: [],
      completedAt: timestamp,
      evidenceBinding: artifactBinding(resultFile),
      error: null,
      fixtureGroup,
      nativeDeviceProof: false,
      startedAt: timestamp,
      surface: 'expo-web',
      verdict: 'pass',
      viewport: { ...bootstrapViewport },
      endUrl: 'http://localhost:8620/shelf/ocr',
      kind: 'consent-bootstrap',
    };
    results.push(result);
    resultByFile.set(resultFile, result);
    groupBrowserAudits.push({
      browserFailures: [],
      evidenceBinding: artifactBinding(`browser-events-${fixtureGroup}.json`),
      fixtureGroup,
    });
    for (const scenario of CAT05_NATIVE_OCR_SCENARIOS.filter(
      ({ groupId }) => groupId === fixtureGroup,
    )) {
      for (const viewport of CAT05_NATIVE_OCR_VIEWPORTS) {
        const scenarioPrefix = `${scenario.id}-${viewport.id}`;
        const scenarioResultFile = `${scenarioPrefix}-result.json`;
        const scenarioResult = {
          artifactPrefix: scenarioPrefix,
          browserFailures: [],
          completedAt: timestamp,
          evidenceBinding: artifactBinding(scenarioResultFile),
          error: null,
          fixture: scenario.fixture,
          fixtureGroup,
          kind: 'scenario',
          nativeDeviceProof: false,
          scenarioId: scenario.id,
          startedAt: timestamp,
          surface: 'expo-web-deterministic-ui-fixture',
          verdict: 'pass',
          viewport: { ...viewport },
          endUrl: 'http://localhost:8620/shelf/manual',
        };
        results.push(scenarioResult);
        resultByFile.set(scenarioResultFile, scenarioResult);
      }
    }
  }

  const artifacts = expectedCat05NativeOcrArtifacts();
  const summary = {
    artifactCount: CAT05_NATIVE_OCR_ARTIFACT_COUNT,
    artifactManifest: [],
    artifacts,
    browserFailureCount: 0,
    browserPath: 'chrome.exe',
    candidateNativeBuild: { ...CAT05_NATIVE_OCR_CANDIDATE_BUILD },
    completedAt: timestamp,
    evidenceBinding: binding,
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    expectedBootstrapCount: 4,
    expectedExecutionCount: 15,
    fixtureGroups: [...CAT05_NATIVE_OCR_FIXTURE_GROUPS],
    groupBrowserAudits,
    limitations: [...CAT05_NATIVE_OCR_LIMITATIONS],
    nativeDeviceProof: false,
    passedBootstrapCount: 4,
    passedExecutionCount: 15,
    privacySourceContract,
    results,
    runId,
    scenarioMatrix: CAT05_NATIVE_OCR_SCENARIOS.map((scenario) => ({ ...scenario })),
    sourceGitSha,
    startedAt: timestamp,
    surface: 'Expo web / deterministic development-only OCR review fixture',
    verdict: 'pass',
    viewports: CAT05_NATIVE_OCR_VIEWPORTS.map((viewport) => ({ ...viewport })),
    webFixtureBuild,
    screenshots: artifacts.filter((artifact) => artifact.endsWith('.png')),
  };
  const scope = {
    candidateNativeBuild: { ...CAT05_NATIVE_OCR_CANDIDATE_BUILD },
    evidenceKind: 'deterministic_expo_web_ocr_review_ui_state',
    evidenceSchemaVersion: CAT05_NATIVE_OCR_SCHEMA_VERSION,
    fixtureConfigurationSha256,
    nativeDeviceProof: false,
    proves: [...CAT05_NATIVE_OCR_PROVES],
    doesNotProve: CAT05_NATIVE_OCR_LIMITATIONS.slice(1),
    evidenceBinding: binding,
    fixtureEnvironmentVariable: 'EXPO_PUBLIC_E2E_SHELF_OCR_RESULT',
    fixtureTranscript: 'Aqua, Glycerin, Niacinamide, 水, Ниацинамид',
    privacySourceContract,
    runId,
    scenarioMatrix: CAT05_NATIVE_OCR_SCENARIOS.map((scenario) => ({ ...scenario })),
    scenarioMatrixSha256,
    sourceGitSha,
    surface: 'Expo web / headless Chromium / development-only deterministic fixture',
    viewportMatrix: CAT05_NATIVE_OCR_VIEWPORTS.map((viewport) => ({ ...viewport })),
    viewportMatrixSha256,
    webFixtureBuild,
  };
  const files = new Map();
  const writeJsonFixture = (name, value) => {
    files.set(name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  };
  const pngFixtures = new Map();
  const pngFixture = ({ height, width }) => {
    const key = `${width}x${height}`;
    if (pngFixtures.has(key)) return pngFixtures.get(key);
    const bytes = PNG.sync.write({
      data: Buffer.alloc(width * height * 4, 255),
      height,
      width,
    });
    pngFixtures.set(key, bytes);
    return bytes;
  };

  for (const artifact of artifacts) {
    if (artifact === 'report.md' || artifact === 'scope.json') continue;
    if (artifact.endsWith('.png')) {
      files.set(artifact, pngFixture(cat05ExpectedScreenshotDimensions(artifact)));
    } else if (artifact.endsWith('.log')) {
      files.set(artifact, Buffer.from('Expo fixture ready at http://localhost:8620\n'));
    } else if (resultByFile.has(artifact)) {
      writeJsonFixture(artifact, resultByFile.get(artifact));
    } else if (artifact.startsWith('browser-events-')) {
      const browserEvents = [
        {
          documentURL: 'http://localhost:8620/shelf/ocr',
          method: 'Network.requestWillBeSent',
          observedAt: timestamp,
          requestId: 'request-1',
          requestMethod: 'GET',
          type: 'Document',
          url: 'http://localhost:8620/shelf/ocr',
        },
        {
          method: 'Network.responseReceived',
          mimeType: 'text/html',
          observedAt: timestamp,
          requestId: 'request-1',
          status: 200,
          type: 'Document',
          url: 'http://localhost:8620/shelf/ocr',
        },
        {
          method: 'Network.webSocketCreated',
          observedAt: timestamp,
          params: { requestId: 'socket-1', url: 'ws://localhost:8620/hot' },
        },
      ];
      writeJsonFixture(artifact, {
        evidenceBinding: artifactBinding(artifact),
        events: browserEvents,
        retention: {
          ignoredEventCount: 1,
          inputEventCount: browserEvents.length + 1,
          limits: {
            maxRetainedBytes: CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES,
            maxRetainedEvents: CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS,
          },
          retainedEventCount: browserEvents.length,
          sanitizedBytes: Buffer.byteLength(JSON.stringify(browserEvents), 'utf8'),
          truncated: false,
        },
      });
    } else {
      const metadata = expectedCat05ArtifactBindingMetadata(artifact);
      writeJsonFixture(artifact, {
        issues: [],
        url: 'http://localhost:8620/shelf/ocr',
        viewport: metadata.viewport
          ? { height: metadata.viewport.height, width: metadata.viewport.width }
          : null,
        evidenceBinding: artifactBinding(artifact),
      });
    }
  }
  writeJsonFixture('scope.json', scope);
  files.set('report.md', Buffer.from(buildExpectedCat05NativeOcrReport(summary)));
  summary.artifactManifest = artifacts.map((artifact) => ({
    bytes: files.get(artifact).length,
    path: artifact,
    sha256: cat05Sha256(files.get(artifact)),
  }));
  writeJsonFixture('summary.json', summary);

  const sourceGitState = {
    changedRepoFilesSinceSource: [],
    commitExists: true,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: true,
    privacySourceFiles: privacySourceContract.files.map((file) => ({
      ...file,
      currentBytes: file.bytes,
      currentSha256: file.sha256,
    })),
    runnerMatchesSource: true,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  const trackedRepoFiles = new Set([...files.keys()].map((file) => `${folder}/${file}`));
  const validate = (candidate = summary, overrides = {}) => {
    const fixtureFiles = overrides.files ?? files;
    const tracked = overrides.trackedRepoFiles ?? trackedRepoFiles;
    return collectCat05NativeOcrReviewFailures({
      folder,
      peerEvidenceFolder: overrides.peerEvidenceFolder ?? peerEvidenceFolder,
      summary: candidate,
      sourceGitState: overrides.sourceGitState ?? sourceGitState,
      trackedRepoFiles: tracked,
      fileExists: (path) => fixtureFiles.has(path.slice(`${folder}/`.length)),
      readBytesFile: (path) => fixtureFiles.get(path.slice(`${folder}/`.length)),
      readJsonFile: (path) =>
        JSON.parse(fixtureFiles.get(path.slice(`${folder}/`.length)).toString('utf8')),
      readTextFile: (path) => fixtureFiles.get(path.slice(`${folder}/`.length)).toString('utf8'),
    });
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  const completeFailures = validate();
  assert(
    completeFailures.length === 0,
    `complete tracked CAT05 evidence should pass: ${completeFailures.join('; ')}`,
  );

  const forgedPrivacyContract = structuredClone(summary);
  forgedPrivacyContract.privacySourceContract.files[0].sha256 = '0'.repeat(64);
  assert(
    validate(forgedPrivacyContract).some((failure) =>
      failure.includes('do not match the recorded sourceGitSha'),
    ),
    'privacy source hashes must be recomputed from the recorded source commit',
  );
  const changedCurrentPrivacyState = structuredClone(sourceGitState);
  changedCurrentPrivacyState.privacySourceFiles[0].currentSha256 = '0'.repeat(64);
  assert(
    validate(summary, { sourceGitState: changedCurrentPrivacyState }).some((failure) =>
      failure.includes('current CAT05 privacy source does not match'),
    ),
    'current privacy source bytes must still match the recorded source commit',
  );

  const hostPathSummary = structuredClone(summary);
  hostPathSummary.browserPath = 'C:\\Users\\person\\AppData\\chrome.exe';
  assert(
    validate(hostPathSummary).some(
      (failure) =>
        failure.includes('browser executable basename') ||
        failure.includes('contains a user-profile'),
    ),
    'summary browser identity must not expose a host path',
  );

  const nativeClaim = structuredClone(summary);
  nativeClaim.nativeDeviceProof = true;
  assert(
    validate(nativeClaim).includes(
      'nativeDeviceProof must be false for the CAT05 Expo-web compatibility gate',
    ),
    'CAT05 Expo-web evidence must never claim native-device proof',
  );

  const changedManifest = structuredClone(summary);
  changedManifest.artifactManifest[0].sha256 = '0'.repeat(64);
  assert(
    validate(changedManifest).some((failure) => failure.includes('hash/byte mismatch')),
    'artifact bytes and hashes must be verified against committed evidence',
  );

  const changedBindingFiles = new Map(files);
  const snapshotArtifact = artifacts.find(
    (artifact) => artifact.endsWith('-initial.json') && !artifact.startsWith('bootstrap-'),
  );
  const changedSnapshot = JSON.parse(changedBindingFiles.get(snapshotArtifact).toString('utf8'));
  changedSnapshot.evidenceBinding.runId = '00000000-0000-4000-8000-000000000002';
  changedBindingFiles.set(snapshotArtifact, Buffer.from(`${JSON.stringify(changedSnapshot)}\n`));
  assert(
    validate(summary, { files: changedBindingFiles }).some((failure) =>
      failure.includes(`${snapshotArtifact} evidenceBinding does not match`),
    ),
    'every JSON artifact must remain bound to the exact CAT05 run',
  );

  const externalNetworkFiles = new Map(files);
  const browserArtifact = 'browser-events-recognized.json';
  const externalBrowserEvents = JSON.parse(externalNetworkFiles.get(browserArtifact).toString());
  externalBrowserEvents.events[0].url = 'https://api.example.com/private-label';
  externalNetworkFiles.set(
    browserArtifact,
    Buffer.from(`${JSON.stringify(externalBrowserEvents)}\n`),
  );
  assert(
    validate(summary, { files: externalNetworkFiles }).some((failure) =>
      failure.includes('contains a disallowed https: URL literal'),
    ),
    'external HTTPS literals must fail CAT05 browser-event evidence',
  );

  const inconsistentRetentionFiles = new Map(files);
  const inconsistentRetention = JSON.parse(
    inconsistentRetentionFiles.get(browserArtifact).toString(),
  );
  inconsistentRetention.retention.retainedEventCount = 0;
  inconsistentRetentionFiles.set(
    browserArtifact,
    Buffer.from(`${JSON.stringify(inconsistentRetention)}\n`),
  );
  assert(
    validate(summary, { files: inconsistentRetentionFiles }).some((failure) =>
      failure.includes('retention event counts are inconsistent'),
    ),
    'browser-event retention counts must be recomputed from stored events',
  );

  const browserFailureFiles = new Map(files);
  const browserFailureEvidence = JSON.parse(browserFailureFiles.get(browserArtifact).toString());
  browserFailureEvidence.events.push({
    canceled: false,
    errorText: 'net::ERR_FAILED',
    method: 'Network.loadingFailed',
    observedAt: timestamp,
    requestId: 'request-1',
    type: 'Document',
  });
  browserFailureEvidence.retention.inputEventCount += 1;
  browserFailureEvidence.retention.retainedEventCount += 1;
  browserFailureEvidence.retention.sanitizedBytes = Buffer.byteLength(
    JSON.stringify(browserFailureEvidence.events),
    'utf8',
  );
  browserFailureFiles.set(
    browserArtifact,
    Buffer.from(`${JSON.stringify(browserFailureEvidence)}\n`),
  );
  assert(
    validate(summary, { files: browserFailureFiles }).some((failure) =>
      failure.includes('disallowed browser failure method Network.loadingFailed'),
    ),
    'stored browser failures must invalidate a zero-failure summary',
  );

  const emptyNetworkFiles = new Map(files);
  const emptyNetworkEvidence = JSON.parse(emptyNetworkFiles.get(browserArtifact).toString());
  emptyNetworkEvidence.events = [];
  emptyNetworkEvidence.retention = {
    ignoredEventCount: 0,
    inputEventCount: 0,
    limits: {
      maxRetainedBytes: CAT05_NATIVE_OCR_MAX_BROWSER_EVENT_BYTES,
      maxRetainedEvents: CAT05_NATIVE_OCR_MAX_RETAINED_BROWSER_EVENTS,
    },
    retainedEventCount: 0,
    sanitizedBytes: 2,
    truncated: false,
  };
  emptyNetworkFiles.set(browserArtifact, Buffer.from(`${JSON.stringify(emptyNetworkEvidence)}\n`));
  assert(
    validate(summary, { files: emptyNetworkFiles }).some((failure) =>
      failure.includes('nonzero localhost request and response coverage'),
    ),
    'an empty retained browser trace must not prove local network behavior',
  );

  const leakedPathFiles = new Map(files);
  leakedPathFiles.set(
    'expo-recognized.log',
    Buffer.from('C:\\Users\\person\\Desktop\\onSkin\\private.log\n'),
  );
  assert(
    validate(summary, { files: leakedPathFiles }).some((failure) =>
      failure.includes('contains a user-profile'),
    ),
    'user-profile paths must fail CAT05 diagnostic evidence',
  );

  const sensitiveSnapshotFiles = new Map(files);
  const sensitiveSnapshot = JSON.parse(sensitiveSnapshotFiles.get(snapshotArtifact).toString());
  sensitiveSnapshot.privatePhoto = 'data:image/jpeg;base64,raw-photo-bytes';
  sensitiveSnapshotFiles.set(
    snapshotArtifact,
    Buffer.from(`${JSON.stringify(sensitiveSnapshot)}\n`),
  );
  assert(
    validate(summary, { files: sensitiveSnapshotFiles }).some((failure) =>
      failure.includes('contains a sensitive URI literal'),
    ),
    'every JSON snapshot must reject sensitive photo URI schemes',
  );

  const credentialLogFiles = new Map(files);
  credentialLogFiles.set(
    'expo-recognized.log',
    Buffer.from('NPM_TOKEN=must-not-survive Authorization: Basic dXNlcjpwYXNz\n'),
  );
  const credentialFailures = validate(summary, { files: credentialLogFiles });
  assert(
    credentialFailures.some(
      (failure) =>
        failure.includes('authorization credential') ||
        failure.includes('credential or token value'),
    ),
    'environment tokens and HTTP authorization credentials must be rejected',
  );

  const queryLeakFiles = new Map(files);
  const queryLeak = JSON.parse(queryLeakFiles.get(snapshotArtifact).toString());
  queryLeak.url = 'http://localhost:8620/shelf/ocr?token=must-not-survive';
  queryLeakFiles.set(snapshotArtifact, Buffer.from(`${JSON.stringify(queryLeak)}\n`));
  assert(
    validate(summary, { files: queryLeakFiles }).some((failure) =>
      failure.includes('unredacted URL query value'),
    ),
    'localhost URLs must not retain query values',
  );

  const payloadLeakFiles = new Map(files);
  payloadLeakFiles.set('expo-recognized.log', Buffer.from(`${'A'.repeat(200)}\n`));
  assert(
    validate(summary, { files: payloadLeakFiles }).some((failure) =>
      failure.includes('long base64-like payload'),
    ),
    'long base64-like payloads must not survive in textual evidence',
  );

  const oversizedLogFiles = new Map(files);
  oversizedLogFiles.set(
    'expo-recognized.log',
    Buffer.alloc(CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES + 1, 120),
  );
  assert(
    validate(summary, { files: oversizedLogFiles }).some((failure) =>
      failure.includes(`exceeds ${CAT05_NATIVE_OCR_MAX_EXPO_LOG_BYTES} reviewed bytes`),
    ),
    'oversized diagnostic logs must fail the evidence contract',
  );

  const controlCharacterFiles = new Map(files);
  const controlCharacterSnapshot = JSON.parse(
    controlCharacterFiles.get(snapshotArtifact).toString(),
  );
  controlCharacterSnapshot.note = '\u0001';
  controlCharacterFiles.set(
    snapshotArtifact,
    Buffer.from(`${JSON.stringify(controlCharacterSnapshot)}\n`),
  );
  assert(
    validate(summary, { files: controlCharacterFiles }).some((failure) =>
      failure.includes('disallowed control character'),
    ),
    'control characters inside parsed JSON strings must fail diagnostic hygiene',
  );

  const corruptPngFiles = new Map(files);
  const corruptPngArtifact = summary.screenshots[0];
  corruptPngFiles.set(corruptPngArtifact, corruptPngFiles.get(corruptPngArtifact).subarray(0, 24));
  assert(
    validate(summary, { files: corruptPngFiles }).some((failure) =>
      failure.includes('is not a readable CAT05 PNG'),
    ),
    'truncated header-only PNG evidence must fail complete decode validation',
  );

  const duplicateScenario = structuredClone(summary);
  const scenarioIndexes = duplicateScenario.results
    .map((result, index) => (result.kind === 'scenario' ? index : null))
    .filter((index) => index !== null);
  duplicateScenario.results[scenarioIndexes[1]] = duplicateScenario.results[scenarioIndexes[0]];
  const duplicateFailures = validate(duplicateScenario);
  assert(
    duplicateFailures.some((failure) => failure.includes('duplicate CAT05 scenario')) &&
      duplicateFailures.some((failure) => failure.includes('missing CAT05 scenario')),
    'CAT05 scenario coverage must be exact and duplicate-free',
  );

  const reducedTracked = new Set(trackedRepoFiles);
  reducedTracked.delete(`${folder}/${summary.screenshots[0]}`);
  assert(
    validate(summary, { trackedRepoFiles: reducedTracked }).some((failure) =>
      failure.includes('CAT05 evidence file is not Git-tracked'),
    ),
    'all CAT05 artifacts must be Git-tracked',
  );

  assert(
    validate(summary, {
      sourceGitState: { ...sourceGitState, runnerMatchesSource: false },
    }).includes('CAT05 runner source does not match the recorded sourceGitSha'),
    'CAT05 runner drift must invalidate source-bound evidence',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        untrackedRepoFiles: ['apps/mobile/src/app/shelf/untracked-ocr.tsx'],
      },
    }).some((failure) => failure.includes('nonignored untracked source is not bound')),
    'untracked app source must invalidate CAT05 evidence',
  );

  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [
          `${peerEvidenceFolder}/report.md`,
          'docs/e2e/generated/human-e2e-manifest.json',
        ],
        dirtyTrackedRepoFiles: [
          `${peerEvidenceFolder}/summary.json`,
          'docs/e2e/generated/human-e2e-manifest.md',
        ],
        untrackedRepoFiles: [`${peerEvidenceFolder}/rerun-screenshot.png`],
      },
    }).length === 0,
    'an exact CAT04 sibling refresh and generated human manifest outputs may follow CAT05 source',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [`${cat07EvidenceFolder}/summary.json`],
        dirtyTrackedRepoFiles: [`${cat07EvidenceFolder}/report.md`],
        untrackedRepoFiles: [`${cat07EvidenceFolder}/rerun-screenshot.png`],
      },
    }).length === 0,
    'the exact governed 2026-07-22 CAT07 evidence folder may follow older CAT05 source',
  );
  for (const unrelatedEvidencePath of [
    'test-results/human-e2e/2099-01-01/cat06-camera-lifecycle-current/summary.json',
    'test-results/human-e2e/2099-01-02/cat04-catalog-recovery-current/summary.json',
    'test-results/human-e2e/2099-01-01/cat07-shelf-freshness-current/summary.json',
    'test-results/human-e2e/2026-07-21/cat07-shelf-freshness-current/summary.json',
    'test-results/human-e2e/2026-07-22/unscoped-evidence.json',
  ]) {
    assert(
      validate(summary, {
        sourceGitState: {
          ...sourceGitState,
          changedRepoFilesSinceSource: [unrelatedEvidencePath],
        },
      }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
      `unrelated CAT05 evidence path must remain source-invalidating: ${unrelatedEvidencePath}`,
    );
  }
  assert(
    validate(summary, {
      peerEvidenceFolder: 'test-results/human-e2e/2099-01-01',
    }).some((failure) =>
      failure.includes(
        'CAT05 peer evidence folder must be the exact dated CAT04 evidence directory',
      ),
    ),
    'CAT05 must reject a broad human-E2E peer evidence prefix',
  );
  assert(
    validate(summary, {
      peerEvidenceFolder: 'test-results/human-e2e/2099-01-02/cat04-catalog-recovery-current',
    }).some((failure) => failure.includes('on the same date as CAT05')),
    'CAT05 must reject an exact CAT04 peer evidence folder from a different date',
  );

  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['docs/hugeToDo/CAT-05-closeout.md'],
        dirtyTrackedRepoFiles: ['BLOCKERS.md', 'LAUNCH_READINESS.md', 'PROGRESS.md'],
        untrackedRepoFiles: ['docs/e2e/cat05-review-notes.md'],
      },
    }).some((failure) => failure.includes('nonignored untracked source is not bound')),
    'untracked CAT05 documentation must not bypass exact governed-path membership',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['scripts/docs/readiness-status-audit.mjs'],
      },
    }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
    'script changes must still invalidate CAT05 source-bound evidence',
  );
}

function runCat07ShelfFreshnessContractSmoke() {
  const folder = 'test-results/human-e2e/2099-01-01/cat07-shelf-freshness-current';
  const folderPrefix = `${folder}/`;
  const timestamp = '2026-07-22T00:00:00.000Z';
  const completedTimestamp = '2026-07-22T00:01:05.000Z';
  const runId = 'cat07-11111111-1111-4111-8111-111111111111';
  const sourceGitSha = 'a'.repeat(40);
  const artifacts = expectedCat07ShelfFreshnessArtifacts();
  const screenshots = artifacts.filter((artifact) => artifact.endsWith('.png'));
  const bootstrapResults = [];
  const scenarios = [];
  const files = new Map();
  const originalIds = new Map();
  const replacementIds = new Map();
  const atSecond = (seconds) => new Date(Date.parse(timestamp) + seconds * 1_000).toISOString();

  const representativePng = (viewport, artifact) => {
    const data = Buffer.alloc(viewport.width * viewport.height * 4);
    for (let y = 0; y < viewport.height; y += 1) {
      for (let x = 0; x < viewport.width; x += 1) {
        const offset = (y * viewport.width + x) * 4;
        const header = y < Math.floor(viewport.height * 0.12);
        const card =
          x > Math.floor(viewport.width * 0.08) &&
          x < Math.floor(viewport.width * 0.92) &&
          y > Math.floor(viewport.height * 0.22) &&
          y < Math.floor(viewport.height * 0.72);
        const textBar =
          card &&
          y % 48 < 9 &&
          x > Math.floor(viewport.width * 0.16) &&
          x < Math.floor(viewport.width * 0.78);
        const color = textBar
          ? [45, 52, 61]
          : header
            ? [221, 117, 99]
            : card
              ? [244, 233, 225]
              : [252, 249, 246];
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
      }
    }
    applyCat07CaptureMarkerToRgba(
      data,
      viewport.width,
      viewport.height,
      runId,
      viewport.id,
      artifact,
    );
    return PNG.sync.write({ data, height: viewport.height, width: viewport.width });
  };

  for (const [viewportIndex, viewport] of CAT07_SHELF_FRESHNESS_VIEWPORTS.entries()) {
    const originalId = `0000000${viewportIndex + 1}-0000-4000-8000-00000000000${viewportIndex + 1}`;
    const replacementId = `1000000${viewportIndex + 1}-0000-4000-8000-00000000000${viewportIndex + 1}`;
    originalIds.set(viewport.id, originalId);
    replacementIds.set(viewport.id, replacementId);
    const intervalStart = viewportIndex * 20;
    const bootstrapPrefix = `bootstrap-cat07-freshness-${viewport.id}`;
    const bootstrapResult = {
      artifactPrefix: bootstrapPrefix,
      browserFailures: [],
      completedAt: atSecond(intervalStart + 5),
      endUrl:
        `http://localhost:8720/shelf/search?cat04ConsentProbe=` +
        encodeURIComponent(cat07ShelfFreshnessMarker(runId, viewport.id, 'consent-probe')),
      error: null,
      fixtureGroup: 'cat07-freshness',
      nativeDeviceProof: false,
      runId,
      startedAt: atSecond(intervalStart + 1),
      surface: 'expo-web',
      verdict: 'pass',
      viewport: { ...viewport },
    };
    bootstrapResults.push(bootstrapResult);
    files.set(`${bootstrapPrefix}-result.json`, bootstrapResult);

    const scenarioPrefix = `freshness-lifecycle-${viewport.id}`;
    const scenarioResult = {
      artifactPrefix: scenarioPrefix,
      browserFailures: [],
      completedAt: atSecond(intervalStart + 19),
      distinctReplacementIdentity: true,
      endUrl: `http://localhost:8720/shelf/${originalId}`,
      error: null,
      nativeDeviceProof: false,
      productName: `CAT07 Label PAO ${viewport.width}`,
      runId,
      scenarioId: 'freshness-replacement-lifecycle',
      startedAt: atSecond(intervalStart + 6),
      surface: 'expo-web',
      verdict: 'pass',
      viewport: { ...viewport },
    };
    scenarios.push(scenarioResult);
    files.set(`${scenarioPrefix}-result.json`, scenarioResult);
  }

  const summary = {
    artifactManifest: [],
    artifacts,
    bootstrapResults,
    completedAt: completedTimestamp,
    expectedBootstrapCount: 3,
    expectedExecutionCount: 3,
    limitations: [...CAT07_SHELF_FRESHNESS_LIMITATIONS],
    nativeDeviceProof: false,
    requiredViewports: CAT07_SHELF_FRESHNESS_VIEWPORTS.map((viewport) => ({ ...viewport })),
    runId,
    runtimeProvenance: {
      browserLaunch: {
        args: [
          '--headless',
          '--remote-debugging-port=0',
          '--user-data-dir=<fresh-profile>',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-extensions',
          '--disable-gpu-sandbox',
          '--disable-sync',
          '--hide-scrollbars',
          '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
          '--in-process-gpu',
          '--proxy-server=127.0.0.1:9',
          '--proxy-bypass-list=localhost;127.0.0.1',
          '--safebrowsing-disable-auto-update',
          'about:blank',
        ],
        schemaVersion: CAT07_BROWSER_LAUNCH_SCHEMA_VERSION,
      },
      childEnvironment: {
        keys: [...CAT07_APP_ENVIRONMENT_PLATFORM_KEY_SETS[1]],
        schemaVersion: CAT07_CHILD_ENVIRONMENT_SCHEMA_VERSION,
      },
      environmentBootstrap: {
        bytes: 256,
        schemaVersion: CAT07_ENVIRONMENT_BOOTSTRAP_SCHEMA_VERSION,
        sha256: '9'.repeat(64),
      },
      installMode: 'isolated-npm-ci-offline-ignore-scripts-then-repo-postinstall',
      packageLock: { bytes: 4_096, sha256: '1'.repeat(64) },
      runtimeTree: (() => {
        const roots = [
          {
            bytes: 8_192,
            directoryCount: 2,
            entryCount: 6,
            fileCount: 3,
            linkCount: 1,
            path: 'node_modules',
            sha256: '2'.repeat(64),
          },
        ];
        const combined = {
          bytes: 8_192,
          directoryCount: 2,
          entryCount: 6,
          fileCount: 3,
          linkCount: 1,
          rootCount: 1,
          roots,
        };
        return {
          ...combined,
          sha256: createHash('sha256').update(canonicalEvidenceJsonBytes(combined)).digest('hex'),
        };
      })(),
      schemaVersion: CAT07_RUNTIME_PROVENANCE_SCHEMA_VERSION,
      sourceTree: {
        bytes: 12_288,
        entryCount: 3,
        fileCount: 3,
        sha256: '3'.repeat(64),
      },
      tools: Object.fromEntries(
        ['browser', 'expoCli', 'git', 'node', 'npmCli'].map((name, index) => [
          name,
          {
            basename: `${name}.fixture`,
            bytes: index + 1,
            sha256: String(index + 4).repeat(64),
            version: name === 'browser' ? 'HeadlessChrome/140.0.0.0' : 'fixture-version',
          },
        ]),
      ),
    },
    scenarios,
    schemaVersion: CAT07_SHELF_FRESHNESS_SCHEMA_VERSION,
    screenshots,
    sourceGitSha,
    startedAt: timestamp,
    surface: 'expo-web',
    verdict: 'pass',
    verifiedOutcomes: [...CAT07_SHELF_FRESHNESS_VERIFIED_OUTCOMES],
  };

  for (const artifact of artifacts) {
    if (files.has(artifact)) continue;
    const viewport = CAT07_SHELF_FRESHNESS_VIEWPORTS.find(({ id }) => artifact.includes(`-${id}-`));
    if (artifact.endsWith('.png')) {
      files.set(artifact, representativePng(viewport, artifact));
    } else if (artifact.endsWith('.json') && artifact !== 'browser-events-cat07-freshness.json') {
      const contract = cat07SnapshotContract(`${artifact.slice(0, -5)}.png`, viewport, runId);
      const originalId = originalIds.get(viewport.id);
      const replacementId = replacementIds.get(viewport.id);
      let pathname = typeof contract.path === 'string' ? contract.path : `/shelf/${originalId}`;
      if (artifact.includes('11-unopened-replacement-detail')) pathname = `/shelf/${replacementId}`;
      const url = new URL(pathname, 'http://localhost:8720');
      if (artifact.includes('08-replacement-choices') || artifact.includes('09-future')) {
        url.searchParams.set('id', originalId);
      }
      if (
        artifact.includes('02-opening-required') ||
        artifact.includes('03-future-opened-date-blocked') ||
        artifact.includes('04-label-pao-ready')
      ) {
        url.searchParams.set('intakeId', originalId);
      }
      if (contract.requiredMarker) {
        url.searchParams.set(contract.requiredMarker[0], contract.requiredMarker[1]);
      }
      files.set(artifact, {
        alerts: [],
        bodyText: ['Rendered CAT07 reviewed state', ...contract.requiredBodyText].join(' | '),
        controls: contract.requiredControls.map((control) => ({ ...control })),
        inputs: [],
        issues: [],
        overflowX: 0,
        title: 'CAT07 reviewed fixture',
        url: url.toString(),
        viewport: { height: viewport.height, width: viewport.width },
      });
    }
  }
  const browserEvents = [];
  const browserTimestampBase = Date.parse(timestamp);
  let previousBrowserTimestamp = browserTimestampBase;
  const pushBrowserEvent = (method, fields, observedAt) => {
    const timestampValue = Date.parse(observedAt);
    if (timestampValue < previousBrowserTimestamp) throw new Error('nonmonotonic smoke fixture');
    browserEvents.push({
      ...fields,
      method,
      observedAt,
      ...('url' in fields ? { urlPolicyViolation: false } : {}),
    });
    previousBrowserTimestamp = timestampValue;
  };
  let browserRequestIndex = 0;
  for (const [viewportIndex, viewport] of CAT07_SHELF_FRESHNESS_VIEWPORTS.entries()) {
    const intervalStart = viewportIndex * 20;
    const urls = [
      `http://localhost:8720/?e2eReset=local&cat04Bootstrap=${encodeURIComponent(cat07ShelfFreshnessMarker(runId, viewport.id, 'bootstrap'))}`,
      `http://localhost:8720/shelf/search?cat04ConsentProbe=${encodeURIComponent(cat07ShelfFreshnessMarker(runId, viewport.id, 'consent-probe'))}`,
      `http://localhost:8720/shelf/manual?cat04Audit=${encodeURIComponent(cat07ShelfFreshnessMarker(runId, viewport.id, 'manual'))}`,
      `http://localhost:8720/shelf?cat04Audit=${encodeURIComponent(cat07ShelfFreshnessMarker(runId, viewport.id, 'persisted-shelf'))}`,
    ];
    const eventSeconds = [
      intervalStart + 1.1,
      intervalStart + 3,
      intervalStart + 6.1,
      intervalStart + 14,
    ];
    pushBrowserEvent('Runtime.executionContextCreated', {}, atSecond(intervalStart + 1));
    for (let index = 0; index < urls.length; index += 1) {
      const url = urls[index];
      pushBrowserEvent(
        index === 0 ? 'Page.frameNavigated' : 'Page.navigatedWithinDocument',
        { requestId: null, url },
        atSecond(eventSeconds[index]),
      );
      const requestId = `request-${browserRequestIndex}`;
      browserRequestIndex += 1;
      const networkUrl = new URL(url);
      if (networkUrl.search.length > 0) networkUrl.search = '?redacted-query';
      pushBrowserEvent(
        'Network.requestWillBeSent',
        {
          requestId,
          requestMethod: 'GET',
          type: 'Document',
          url: networkUrl.toString(),
        },
        atSecond(eventSeconds[index] + 0.1),
      );
      pushBrowserEvent(
        'Network.responseReceived',
        {
          requestId,
          status: 200,
          type: 'Document',
          url: networkUrl.toString(),
        },
        atSecond(eventSeconds[index] + 0.2),
      );
    }
  }
  pushBrowserEvent(
    'Page.frameStartedNavigating',
    {
      requestId: 'reviewed-local-aborted-navigation',
      url: 'http://localhost:8720/',
    },
    atSecond(60),
  );
  pushBrowserEvent(
    'Network.loadingFailed',
    {
      canceled: true,
      errorCode: 'net::ERR_ABORTED',
      requestId: 'reviewed-local-aborted-navigation',
      type: 'Document',
      url: 'http://localhost:8720/',
    },
    atSecond(60.1),
  );
  pushBrowserEvent(
    'Network.webSocketCreated',
    {
      requestId: 'hmr-socket',
      url: 'ws://localhost:8720/hot',
    },
    atSecond(60.2),
  );
  pushBrowserEvent(
    'Log.entryAdded',
    {
      failureClass: 'hmr-connection-refused',
      level: 'error',
    },
    atSecond(60.3),
  );
  pushBrowserEvent(
    'Network.webSocketFrameError',
    {
      errorCode: 'net::ERR_CONNECTION_REFUSED',
      requestId: 'hmr-socket',
      url: 'ws://localhost:8720/hot',
    },
    atSecond(60.4),
  );
  const browserEvidence = {
    evidenceBinding: { runId, sourceGitSha },
    events: browserEvents,
    retention: {
      ignoredFrameCount: 0,
      inputFrameBytes: Buffer.byteLength(JSON.stringify(browserEvents), 'utf8'),
      inputFrameCount: browserEvents.length,
      limits: {
        maxFrameBytes: CAT07_MAX_CDP_FRAME_BYTES,
        maxInputBytes: CAT07_MAX_INPUT_CDP_BYTES,
        maxInputFrames: CAT07_MAX_INPUT_CDP_FRAMES,
        maxRetainedBytes: CAT07_MAX_BROWSER_EVENT_BYTES,
        maxRetainedEvents: CAT07_MAX_RETAINED_BROWSER_EVENTS,
      },
      retainedEventCount: browserEvents.length,
      responseFrameCount: 0,
      sanitizedBytes: Buffer.byteLength(JSON.stringify(browserEvents), 'utf8'),
      truncated: false,
    },
    schemaVersion: CAT07_BROWSER_EVIDENCE_SCHEMA_VERSION,
  };
  files.set('browser-events-cat07-freshness.json', browserEvidence);
  for (const [index, screenshot] of CAT07_CAPTURE_ARTIFACT_ORDER.entries()) {
    const viewportIndex = CAT07_SHELF_FRESHNESS_VIEWPORTS.findIndex(({ id }) =>
      screenshot.includes(`-${id}-`),
    );
    const viewport = CAT07_SHELF_FRESHNESS_VIEWPORTS[viewportIndex];
    if (!viewport) throw new Error(`capture fixture has no viewport: ${screenshot}`);
    const viewportArtifacts = CAT07_CAPTURE_ARTIFACT_ORDER.filter((artifact) =>
      artifact.includes(`-${viewport.id}-`),
    );
    const viewportCaptureIndex = viewportArtifacts.indexOf(screenshot);
    const captureSecond =
      viewportIndex * 20 +
      (screenshot.startsWith('bootstrap-') ? 4 : 6.5 + (viewportCaptureIndex - 1) * 0.8);
    const capturedAt = atSecond(captureSecond);
    const browserEventCursor = browserEvents.filter(
      (event) => Date.parse(event.observedAt) <= Date.parse(capturedAt),
    ).length;
    const screenshotBytes = files.get(screenshot);
    const snapshot = files.get(screenshot.replace(/\.png$/u, '.json'));
    if (!Buffer.isBuffer(screenshotBytes) || !snapshot || typeof snapshot !== 'object') {
      throw new Error(`capture fixture is incomplete: ${screenshot}`);
    }
    snapshot.captureBinding = {
      artifact: screenshot,
      browserEventCursor,
      capturedAt,
      captureOrdinal: index + 1,
      runId,
      schemaVersion: CAT07_CAPTURE_BINDING_SCHEMA_VERSION,
      screenshotBytes: screenshotBytes.length,
      screenshotSha256: createHash('sha256').update(screenshotBytes).digest('hex'),
      sourceGitSha,
      viewportId: viewport.id,
    };
  }
  files.set('expo-cat07-freshness.log', 'Expo fixture ready at http://localhost:8720\n');
  files.set('report.md', buildExpectedCat07ShelfFreshnessReport(summary));
  const fixtureBytes = (value) => {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string') return Buffer.from(value, 'utf8');
    return canonicalEvidenceJsonBytes(value);
  };
  summary.artifactManifest = artifacts.map((artifact) => {
    const bytes = fixtureBytes(files.get(artifact));
    return {
      bytes: bytes.length,
      path: artifact,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  files.set('summary.json', summary);

  const trackedRepoFiles = new Set(
    ['summary.json', ...artifacts].map((artifact) => `${folder}/${artifact}`),
  );
  const sourceGitState = {
    changedRepoFilesSinceSource: [],
    commitExists: true,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: true,
    packageLockAtSource: { ...summary.runtimeProvenance.packageLock },
    runtimeRootPathsAtSource: ['node_modules'],
    runnerMatchesSource: true,
    sharedHarnessMatchesSource: true,
    sourceTreeAtSource: { ...summary.runtimeProvenance.sourceTree },
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  const relativeFile = (repoPath) => normalizeRepoPath(repoPath).slice(folderPrefix.length);
  const readJsonFixture = (repoPath) => {
    const value = files.get(relativeFile(repoPath));
    if (value === undefined) throw new Error(`missing fixture ${repoPath}`);
    return value;
  };
  const readBytesFixture = (repoPath, fixtureFiles = files) => {
    const value = fixtureFiles.get(relativeFile(repoPath));
    if (value === undefined) throw new Error(`missing fixture ${repoPath}`);
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string') return Buffer.from(value, 'utf8');
    return canonicalEvidenceJsonBytes(value);
  };
  const validate = (candidate = summary, overrides = {}) =>
    collectCat07ShelfFreshnessFailures({
      folder,
      summary: candidate,
      trackedRepoFiles,
      sourceGitState,
      fileExists: (repoPath) => files.has(relativeFile(repoPath)),
      readBytesFile: readBytesFixture,
      readJsonFile: readJsonFixture,
      readTextFile: (repoPath) => readJsonFixture(repoPath),
      ...overrides,
    });
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const rawBrowserFailureTypes = (events) =>
    [
      ...collectCat07BrowserEvidenceIntegrityFailures(events, {
        bootstrapResults: summary.bootstrapResults,
        completedAt: summary.completedAt,
        runId: summary.runId,
        scenarios: summary.scenarios,
        startedAt: summary.startedAt,
      }),
      ...classifyCat07ProjectedBrowserFailures(events),
    ].map((failure) => failure.type);

  const completeFailures = validate();
  assert(
    completeFailures.length === 0,
    `complete tracked CAT07 evidence should pass: ${completeFailures.join('; ')}`,
  );

  const firstSnapshot = screenshots[0].replace(/\.png$/u, '.json');
  const firstScenarioScreenshot = CAT07_CAPTURE_ARTIFACT_ORDER.find(
    (artifact) => !artifact.startsWith('bootstrap-'),
  );
  const firstScenarioSnapshot = firstScenarioScreenshot.replace(/\.png$/u, '.json');

  const alteredArtifactFiles = new Map(files);
  alteredArtifactFiles.set('report.md', `${alteredArtifactFiles.get('report.md')}Safe drift.\n`);
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, alteredArtifactFiles),
      readTextFile: (repoPath) => {
        const value = alteredArtifactFiles.get(relativeFile(repoPath));
        return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
      },
    }).some((failure) => failure.includes('artifactManifest bytes/hash do not match report.md')),
    'CAT07 artifactManifest must reject post-summary byte drift',
  );

  const staleCaptureBindingFiles = new Map(files);
  const staleCapture = structuredClone(staleCaptureBindingFiles.get(firstScenarioSnapshot));
  staleCapture.captureBinding.captureOrdinal += 1;
  staleCaptureBindingFiles.set(firstScenarioSnapshot, staleCapture);
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, staleCaptureBindingFiles),
      readJsonFile: (repoPath) => staleCaptureBindingFiles.get(relativeFile(repoPath)),
    }).some(
      (failure) =>
        failure.includes('does not bind its exact run, capture, and screenshot bytes') ||
        failure.includes('violates the exact CAT07 capture chronology'),
    ),
    'CAT07 capture ordinals must reject reordered or transplanted snapshot evidence',
  );

  const stalePixelBindingFiles = new Map(files);
  const stalePixelPng = PNG.sync.read(stalePixelBindingFiles.get(firstScenarioScreenshot));
  stalePixelPng.data[0] ^= 0x01;
  stalePixelBindingFiles.set(firstScenarioScreenshot, PNG.sync.write(stalePixelPng));
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, stalePixelBindingFiles),
    }).some((failure) =>
      failure.includes(
        `${firstScenarioSnapshot} does not bind its exact run, capture, and screenshot bytes`,
      ),
    ),
    'CAT07 must reject a screenshot whose marker remains valid while its snapshot binding is stale',
  );

  const outOfRangeCursorFiles = new Map(files);
  const outOfRangeCursor = structuredClone(outOfRangeCursorFiles.get(firstScenarioSnapshot));
  outOfRangeCursor.captureBinding.browserEventCursor = browserEvents.length + 1;
  outOfRangeCursorFiles.set(firstScenarioSnapshot, outOfRangeCursor);
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, outOfRangeCursorFiles),
      readJsonFile: (repoPath) => outOfRangeCursorFiles.get(relativeFile(repoPath)),
    }).some((failure) => failure.includes('browser cursor exceeds retained evidence')),
    'CAT07 capture cursors must bind to a real prefix of the retained browser trace',
  );

  const reorderedJsonFiles = new Map(files);
  const reorderedSnapshot = reorderedJsonFiles.get(firstScenarioSnapshot);
  reorderedJsonFiles.set(
    firstScenarioSnapshot,
    Buffer.from(
      `${JSON.stringify(
        Object.fromEntries(Object.entries(reorderedSnapshot).reverse()),
        null,
        2,
      )}\n`,
      'utf8',
    ),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, reorderedJsonFiles),
    }).some((failure) => failure.includes('is not canonical JSON')),
    'CAT07 canonical JSON must reject semantically equal reordered object keys',
  );

  const markdownSeparatorFailures = collectEvidenceTextArtifactHygieneFailures(
    'safe-markdown.md',
    Buffer.from(`# Safe heading\n\n${'-'.repeat(200)}\n`, 'utf8'),
  );
  assert(
    !markdownSeparatorFailures.some((failure) => failure.includes('long base64-like payload')),
    'ordinary long Markdown separators must not be mistaken for encoded payloads',
  );
  assert(
    collectEvidenceTextArtifactHygieneFailures(
      'unsafe-markdown.md',
      Buffer.from(`${'A'.repeat(200)}\n`, 'utf8'),
    ).some((failure) => failure.includes('long base64-like payload')),
    'long encoded-looking Markdown payloads must still fail closed',
  );

  const hostileDiagnosticFiles = new Map(files);
  hostileDiagnosticFiles.set(firstSnapshot, {
    ...hostileDiagnosticFiles.get(firstSnapshot),
    controls: [
      {
        [`NPM_TOKEN=${'n'.repeat(32)}`]: 'ordinary',
        label:
          `C:\\Users\\reviewer\\secret.txt | \\\\server\\share\\secret.txt | ` +
          `/home/reviewer/secret.txt | /tmp/secret.txt | /etc/private | /Volumes/private | ` +
          `.claude/worktrees/private | postgresql://reviewer:secret@db.example.com/app | ` +
          `Basic ${'b'.repeat(24)} | Bearer ${'c'.repeat(24)} | ` +
          `sbp_${'a'.repeat(40)} | sb_secret_${'s'.repeat(22)}_${'z'.repeat(8)} | ` +
          `SUPABASE_SERVICE_ROLE_KEY=${'k'.repeat(32)} | ` +
          `-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----\r\u001b]0;forged\u0007`,
      },
    ],
  });
  const hostileDiagnosticFailures = validate(summary, {
    readBytesFile: (repoPath) => readBytesFixture(repoPath, hostileDiagnosticFiles),
  });
  for (const expectedFailure of [
    'absolute path',
    'database or service credential URI literal',
    'HTTP authorization credential literal',
    'Supabase credential literal',
    'unredacted credential or token value',
    'private-key header',
    'disallowed control character',
  ]) {
    assert(
      hostileDiagnosticFailures.some((failure) => failure.includes(expectedFailure)),
      `CAT07 recursive diagnostic hygiene must reject ${expectedFailure}`,
    );
  }

  const duplicateJsonFiles = new Map(files);
  duplicateJsonFiles.set(
    firstSnapshot,
    Buffer.from('{\n  "bodyText": "first",\n  "bodyText": "second"\n}\n', 'utf8'),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, duplicateJsonFiles),
    }).some((failure) => failure.includes('is not canonical JSON')),
    'CAT07 must reject duplicate-key JSON bytes even when JSON.parse accepts them',
  );
  const noncanonicalJsonFiles = new Map(files);
  noncanonicalJsonFiles.set(
    firstSnapshot,
    Buffer.from(JSON.stringify(noncanonicalJsonFiles.get(firstSnapshot)), 'utf8'),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, noncanonicalJsonFiles),
    }).some((failure) => failure.includes('is not canonical JSON')),
    'CAT07 must reject alternate JSON whitespace or missing trailing newline',
  );

  const pngCrc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const pngChunk = (type, data) => {
    const typeBytes = Buffer.from(type, 'ascii');
    const chunk = Buffer.alloc(12 + data.length);
    chunk.writeUInt32BE(data.length, 0);
    typeBytes.copy(chunk, 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(pngCrc32(Buffer.concat([typeBytes, data])), 8 + data.length);
    return chunk;
  };
  const addPngChunkAfterHeader = (png, type, data) => {
    const headerEnd = 8 + 12 + png.readUInt32BE(8);
    return Buffer.concat([
      png.subarray(0, headerEnd),
      pngChunk(type, data),
      png.subarray(headerEnd),
    ]);
  };
  const metadataPngFiles = new Map(files);
  metadataPngFiles.set(
    screenshots[0],
    addPngChunkAfterHeader(
      metadataPngFiles.get(screenshots[0]),
      'tEXt',
      Buffer.from(`Comment\0C:\\Users\\reviewer\\sbp_${'a'.repeat(40)}`, 'latin1'),
    ),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, metadataPngFiles),
    }).some((failure) => failure.includes('disallowed tEXt chunk')),
    'CAT07 PNGs must reject even valid-CRC textual metadata chunks',
  );
  const trailingPngFiles = new Map(files);
  trailingPngFiles.set(
    screenshots[0],
    Buffer.concat([trailingPngFiles.get(screenshots[0]), Buffer.from('x')]),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, trailingPngFiles),
    }).some((failure) => failure.includes('terminal zero-byte IEND')),
    'CAT07 PNGs must reject trailing bytes after IEND',
  );
  const interlacedPngFiles = new Map(files);
  const interlacedSource = interlacedPngFiles.get(screenshots[0]);
  const interlacedHeader = Buffer.from(interlacedSource.subarray(16, 29));
  interlacedHeader[12] = 1;
  interlacedPngFiles.set(
    screenshots[0],
    Buffer.concat([
      interlacedSource.subarray(0, 8),
      pngChunk('IHDR', interlacedHeader),
      interlacedSource.subarray(33),
    ]),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, interlacedPngFiles),
    }).some((failure) => failure.includes('no interlace')),
    'CAT07 PNGs must reject interlaced images before pixel decode',
  );
  const copiedScreenshotFiles = new Map(files);
  const sameViewportScreenshots = screenshots.filter((artifact) =>
    artifact.includes('-iphone-375x667-'),
  );
  copiedScreenshotFiles.set(
    sameViewportScreenshots[1],
    copiedScreenshotFiles.get(sameViewportScreenshots[0]),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, copiedScreenshotFiles),
    }).some((failure) => failure.includes('capture marker does not match')),
    'copying a same-viewport CAT07 screenshot into another step must fail its image binding',
  );
  const oversizedPngFiles = new Map(files);
  oversizedPngFiles.set(screenshots[0], Buffer.alloc(CAT07_MAX_SCREENSHOT_BYTES + 1));
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, oversizedPngFiles),
    }).some((failure) => failure.includes(`exceeds ${CAT07_MAX_SCREENSHOT_BYTES} bytes`)),
    'CAT07 PNGs must reject oversized screenshot artifacts before decode',
  );

  const blankScreenshotFiles = new Map(files);
  const blankPixels = Buffer.alloc(
    CAT07_SHELF_FRESHNESS_VIEWPORTS[0].width * CAT07_SHELF_FRESHNESS_VIEWPORTS[0].height * 4,
    255,
  );
  applyCat07CaptureMarkerToRgba(
    blankPixels,
    CAT07_SHELF_FRESHNESS_VIEWPORTS[0].width,
    CAT07_SHELF_FRESHNESS_VIEWPORTS[0].height,
    runId,
    CAT07_SHELF_FRESHNESS_VIEWPORTS[0].id,
    screenshots[0],
  );
  blankScreenshotFiles.set(
    screenshots[0],
    PNG.sync.write({
      data: blankPixels,
      height: CAT07_SHELF_FRESHNESS_VIEWPORTS[0].height,
      width: CAT07_SHELF_FRESHNESS_VIEWPORTS[0].width,
    }),
  );
  assert(
    validate(summary, {
      readBytesFile: (repoPath) => readBytesFixture(repoPath, blankScreenshotFiles),
    }).some((failure) => failure.includes('blank or near-blank')),
    'blank CAT07 screenshots must fail persisted visual evidence validation',
  );
  const remoteSnapshotFiles = new Map(files);
  const remoteSnapshotArtifact = screenshots[0].replace(/\.png$/u, '.json');
  remoteSnapshotFiles.set(remoteSnapshotArtifact, {
    ...remoteSnapshotFiles.get(remoteSnapshotArtifact),
    url: 'https://example.com/forged-cat07-state',
  });
  assert(
    validate(summary, {
      readJsonFile: (repoPath) => remoteSnapshotFiles.get(relativeFile(repoPath)),
    }).some((failure) => failure.includes('exact CAT07 local app origin')),
    'remote CAT07 snapshot origins must fail',
  );
  assert(
    validate({
      ...summary,
      bootstrapResults: summary.bootstrapResults.map((result, index) =>
        index === 0 ? { ...result, startedAt: '2026-07-21T23:59:59.000Z' } : result,
      ),
    }).some((failure) => failure.includes('inside the summary window')),
    'child timestamps outside the CAT07 summary window must fail',
  );
  assert(
    validate({
      ...summary,
      bootstrapResults: [
        summary.bootstrapResults[1],
        summary.bootstrapResults[0],
        summary.bootstrapResults[2],
      ],
    }).some((failure) => failure.includes('exact reviewed viewport order')),
    'CAT07 child records must remain in deterministic execution order',
  );
  assert(
    validate({ ...summary, nativeDeviceProof: true }).includes(
      'nativeDeviceProof must be false for the CAT07 Expo-web compatibility gate',
    ),
    'CAT07 evidence must never claim native-device proof',
  );
  assert(
    validate({ ...summary, artifacts: artifacts.slice(1) }).some((failure) =>
      failure.includes('exact 99 CAT07 files'),
    ),
    'CAT07 artifacts must remain exact and complete',
  );
  const untrackedArtifactFiles = new Set(trackedRepoFiles);
  untrackedArtifactFiles.delete(`${folder}/${screenshots[0]}`);
  assert(
    validate(summary, { trackedRepoFiles: untrackedArtifactFiles }).some((failure) =>
      failure.includes('CAT07 evidence file is not Git-tracked'),
    ),
    'CAT07 must reject an untracked declared artifact',
  );
  assert(
    validate({
      ...summary,
      scenarios: summary.scenarios.map((result, index) =>
        index === 0 ? { ...result, browserFailures: ['console error'] } : result,
      ),
    }).some((failure) => failure.includes('browserFailures must be an empty array')),
    'CAT07 result evidence must reject browser failures',
  );
  assert(
    validate(summary, {
      readJsonFile: (repoPath) =>
        repoPath.endsWith('/freshness-lifecycle-iphone-375x667-result.json')
          ? { ...readJsonFixture(repoPath), verdict: 'fail' }
          : readJsonFixture(repoPath),
    }).includes('freshness-lifecycle-iphone-375x667-result.json does not match its summary record'),
    'CAT07 persisted results must equal their summary records',
  );
  assert(
    validate(summary, {
      sourceGitState: { ...sourceGitState, sharedHarnessMatchesSource: false },
    }).includes('CAT07 shared CAT04 harness does not match the recorded sourceGitSha'),
    'CAT07 evidence must bind the shared CAT04 browser/consent harness',
  );
  assert(
    validate(summary, {
      sourceGitState: { ...sourceGitState, runnerMatchesSource: false },
    }).includes('CAT07 runner source does not match the recorded sourceGitSha'),
    'CAT07 evidence must bind its dedicated runner',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: ['apps/mobile/src/features/shelf/store.ts'],
      },
    }).some((failure) => failure.includes('sourceGitSha predates later source changes')),
    'later runtime source changes must invalidate CAT07 evidence',
  );
  assert(
    validate(summary, {
      sourceGitState: {
        ...sourceGitState,
        changedRepoFilesSinceSource: [
          'docs/hugeToDo/CAT-07-closeout.md',
          'docs/e2e/generated/human-e2e-manifest.json',
        ],
      },
    }).length === 0,
    'CAT07 closeout documentation and generated manifest output must not stale runtime evidence',
  );
  for (const [field, repoPath, expectedFailure] of [
    [
      'changedRepoFilesSinceSource',
      'scripts/e2e/human-e2e-manifest.mjs',
      'sourceGitSha predates later source changes',
    ],
    [
      'dirtyTrackedRepoFiles',
      'scripts/phase7/build-core-loop-qa-packet.mjs',
      'tracked source files changed after the recorded sourceGitSha',
    ],
    [
      'untrackedRepoFiles',
      'scripts/phase7/untracked-packet-validator.mjs',
      'nonignored untracked source is not bound to sourceGitSha',
    ],
  ]) {
    assert(
      validate(summary, {
        sourceGitState: { ...sourceGitState, [field]: [repoPath] },
      }).some((failure) => failure.includes(expectedFailure)),
      `post-source CAT07 validator/packet drift must fail closed: ${repoPath}`,
    );
  }

  assert(
    rawBrowserFailureTypes(browserEvents).length === 0,
    'the complete local browser fixture, including its exact HMR exceptions, must pass',
  );
  const prefixedHmrFailureEvents = browserEvents.map((event) =>
    event.method === 'Log.entryAdded' ? { ...event, failureClass: 'error' } : event,
  );
  assert(
    rawBrowserFailureTypes(prefixedHmrFailureEvents).includes('browser-log-error'),
    'CAT07 HMR exemption must reject prefixed or suffixed browser errors',
  );
  const forgedRunMarkerEvents = browserEvents.map((event) => {
    if (event.method !== 'Page.frameNavigated') return event;
    const url = new URL(event.url);
    url.searchParams.set(
      'cat04Bootstrap',
      `${cat07ShelfFreshnessMarker(runId, CAT07_SHELF_FRESHNESS_VIEWPORTS[0].id, 'bootstrap')}-forged`,
    );
    return { ...event, url: url.toString() };
  });
  assert(
    rawBrowserFailureTypes(forgedRunMarkerEvents).includes('unexpected-cat07-browser-marker'),
    'CAT07 browser markers must match the bound run ID and step exactly',
  );
  const firstViewport = CAT07_SHELF_FRESHNESS_VIEWPORTS[0];
  const manualMarker = cat07ShelfFreshnessMarker(runId, firstViewport.id, 'manual');
  const persistedMarker = cat07ShelfFreshnessMarker(runId, firstViewport.id, 'persisted-shelf');
  const reorderedMarkerEvents = browserEvents.map((event) => {
    if (event.method !== 'Page.navigatedWithinDocument' || typeof event.url !== 'string') {
      return event;
    }
    const url = new URL(event.url);
    const marker = url.searchParams.get('cat04Audit');
    if (marker === manualMarker) url.searchParams.set('cat04Audit', persistedMarker);
    else if (marker === persistedMarker) url.searchParams.set('cat04Audit', manualMarker);
    else return event;
    return { ...event, url: url.toString() };
  });
  assert(
    rawBrowserFailureTypes(reorderedMarkerEvents).includes('cat07-browser-marker-order'),
    'CAT07 browser markers must preserve manual-before-persisted chronology',
  );
  assert(
    rawBrowserFailureTypes([]).includes('empty-browser-event-evidence'),
    'empty CAT07 browser evidence must fail',
  );
  const outsideSummaryWindowEvents = browserEvents.map((event, index) =>
    index === 0 ? { ...event, observedAt: '2098-12-31T23:59:59.999Z' } : event,
  );
  assert(
    rawBrowserFailureTypes(outsideSummaryWindowEvents).includes(
      'browser-event-outside-summary-window',
    ),
    'CAT07 browser timestamps must remain inside the summary execution window',
  );
  assert(
    validate(summary, {
      readJsonFile: (repoPath) =>
        repoPath.endsWith('/browser-events-cat07-freshness.json')
          ? {
              ...browserEvidence,
              events: [],
              retention: {
                ...browserEvidence.retention,
                inputFrameBytes: 2,
                inputFrameCount: 0,
                retainedEventCount: 0,
                sanitizedBytes: 2,
              },
            }
          : readJsonFixture(repoPath),
    }).some((failure) => failure.includes('empty-browser-event-evidence')),
    'the CAT07 manifest validator must reject an empty persisted browser event artifact',
  );
  const truncatedBrowserEvents = browserEvents.filter(
    (event, index) =>
      !(
        index ===
        browserEvents.findIndex((candidate) => candidate.method === 'Network.responseReceived')
      ),
  );
  assert(
    rawBrowserFailureTypes(truncatedBrowserEvents).includes('unmatched-request-response-ids'),
    'truncated CAT07 request/response evidence must fail',
  );
  const mutateFirstEvent = (method, mutateEvent) => {
    let mutated = false;
    return browserEvents.map((event) => {
      if (mutated || event.method !== method) return event;
      mutated = true;
      return mutateEvent(event);
    });
  };
  const malformedBrowserEvents = mutateFirstEvent('Network.requestWillBeSent', (event) => ({
    ...event,
    url: null,
  }));
  assert(
    rawBrowserFailureTypes(malformedBrowserEvents).includes('invalid-or-remote-network-request'),
    'invalid or remote CAT07 network requests must fail without persisting the raw URL',
  );
  const malformedNavigationEvents = mutateFirstEvent('Page.frameNavigated', (event) => ({
    ...event,
    url: null,
  }));
  assert(
    rawBrowserFailureTypes(malformedNavigationEvents).includes('invalid-or-remote-navigation'),
    'invalid or remote CAT07 navigations must fail without persisting the raw URL',
  );
  const fragmentMarkerNavigationEvents = mutateFirstEvent('Page.frameNavigated', (event) => ({
    ...event,
    url: 'http://localhost:8720/',
  }));
  assert(
    rawBrowserFailureTypes(fragmentMarkerNavigationEvents).includes('missing-cat07-browser-marker'),
    'CAT07 browser markers must be exact query parameters rather than URL substrings',
  );
  const unexpectedWebSocketEvents = mutateFirstEvent('Network.webSocketCreated', (event) => ({
    ...event,
    url: 'ws://localhost:8720/unreviewed-channel',
  }));
  assert(
    rawBrowserFailureTypes(unexpectedWebSocketEvents).includes('unexpected-websocket-endpoint'),
    'CAT07 must only allow the reviewed same-origin Expo websocket endpoints',
  );
  const responseUrlMismatchEvents = mutateFirstEvent('Network.responseReceived', (event) => ({
    ...event,
    url: 'http://localhost:8720/different-resource',
  }));
  assert(
    rawBrowserFailureTypes(responseUrlMismatchEvents).includes(
      'network-request-response-url-mismatch',
    ),
    'CAT07 request and response URLs must match for each requestId',
  );
  const firstResponseIndex = browserEvents.findIndex(
    (event) => event.method === 'Network.responseReceived',
  );
  const responseBeforeRequestEvents = [
    browserEvents[firstResponseIndex],
    ...browserEvents.filter((_, index) => index !== firstResponseIndex),
  ];
  assert(
    rawBrowserFailureTypes(responseBeforeRequestEvents).includes('network-response-before-request'),
    'CAT07 responses observed before their request must fail',
  );
  const httpErrorBrowserEvents = mutateFirstEvent('Network.responseReceived', (event) => ({
    ...event,
    status: 500,
  }));
  assert(
    rawBrowserFailureTypes(httpErrorBrowserEvents).includes('http-error-response'),
    'CAT07 HTTP error responses must fail',
  );
  const invalidHttpStatusBrowserEvents = mutateFirstEvent('Network.responseReceived', (event) => ({
    ...event,
    status: null,
  }));
  assert(
    rawBrowserFailureTypes(invalidHttpStatusBrowserEvents).includes('invalid-http-response-status'),
    'CAT07 HTTP responses must carry a finite numeric status',
  );
  assert(
    validate({
      ...summary,
      scenarios: summary.scenarios.map((result, index) =>
        index === 0 ? { ...result, endUrl: 'http://localhost:8721/shelf/origin-drift' } : result,
      ),
    }).includes('all six CAT07 result endUrls must share one exact local app origin'),
    'all CAT07 result records must bind one exact local app origin',
  );
  assert(
    validate({
      ...summary,
      scenarios: summary.scenarios.map((result, index) =>
        index === 0 ? { ...result, endUrl: 'http://localhost/shelf/missing-port' } : result,
      ),
    }).some((failure) => failure.includes('explicit app port')),
    'CAT07 result endUrls must include the explicit local app port',
  );
  const loadingFailureBrowserEvents = [
    ...browserEvents,
    {
      canceled: false,
      errorCode: 'other',
      method: 'Network.loadingFailed',
      observedAt: atSecond(61),
      requestId: 'failed-request',
      type: 'Document',
      url: null,
    },
  ];
  assert(
    rawBrowserFailureTypes(loadingFailureBrowserEvents).includes('network-loading-failed'),
    'uncancelled CAT07 loading failures must fail',
  );
  const unboundCanceledLoadingFailureEvents = [
    ...browserEvents,
    {
      canceled: true,
      errorCode: 'net::ERR_ABORTED',
      method: 'Network.loadingFailed',
      observedAt: atSecond(61),
      requestId: 'unbound-canceled-request',
      type: 'Document',
      url: null,
    },
  ];
  assert(
    rawBrowserFailureTypes(unboundCanceledLoadingFailureEvents).includes('network-loading-failed'),
    'canceled CAT07 loads must bind the reviewed same-origin navigation exception',
  );
  const missingCommittedFixturePath = `${folder}/missing-summary.json`;
  const missingCommittedFailures = collectCat07CommittedHeadByteFailures(folder, [
    'missing-summary.json',
  ]);
  assert(
    isDeepStrictEqual(missingCommittedFailures, [
      `${missingCommittedFixturePath} must exist in HEAD`,
    ]),
    'missing committed CAT07 evidence must use a deterministic repo-relative diagnostic',
  );
  assert(
    !missingCommittedFailures.some((failure) =>
      /(?:[A-Za-z]:[\\/]|[\\/]Users[\\/]|\.claude[\\/]worktrees[\\/])/u.test(failure),
    ),
    'CAT07 committed-evidence diagnostics must not leak an absolute user or worktree path',
  );
}

if (args.has('--provenance-smoke')) {
  try {
    runEvidenceProvenanceSmoke();
    console.log('PASS Human-E2E evidence provenance smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL Human-E2E evidence provenance smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--governed-chain-smoke')) {
  try {
    runGovernedEvidenceChainConsumerSmoke();
    console.log('PASS Human-E2E governed evidence-chain consumer smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL Human-E2E governed evidence-chain consumer smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--cat04-contract-smoke')) {
  try {
    runCat04CatalogRecoveryContractSmoke();
    console.log('PASS CAT04 catalog-recovery evidence contract smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL CAT04 catalog-recovery evidence contract smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--cat05-contract-smoke')) {
  try {
    runCat05NativeOcrReviewContractSmoke();
    console.log('PASS CAT05 native-OCR review evidence contract smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL CAT05 native-OCR review evidence contract smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--cat07-contract-smoke')) {
  try {
    runCat07ShelfFreshnessContractSmoke();
    console.log('PASS CAT07 shelf-freshness evidence contract smoke');
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL CAT07 shelf-freshness evidence contract smoke: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

if (args.has('--cat07-committed-check')) {
  try {
    const folder = CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_PREFIX.slice(0, -1);
    const expectedHeadSha = expectedHeadShaArg?.slice('--expected-head-sha='.length) ?? null;
    if (expectedHeadSha !== null && !/^[a-f0-9]{40}$/u.test(expectedHeadSha)) {
      throw new Error('CAT07 committed check expected HEAD must be one full lowercase SHA');
    }
    const currentHeadSha = cat07RunTrustedGit(['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024,
    }).trim();
    if (expectedHeadSha !== null && currentHeadSha !== expectedHeadSha) {
      throw new Error('CAT07 committed check HEAD does not match its expected pinned SHA');
    }
    const headSha = expectedHeadSha ?? currentHeadSha;
    if (!/^[a-f0-9]{40}$/u.test(headSha)) {
      throw new Error('CAT07 committed check could not pin one full HEAD SHA');
    }
    const relativePaths = ['summary.json', ...expectedCat07ShelfFreshnessArtifacts()];
    const committedBytes = new Map();
    for (const relativePath of relativePaths) {
      const repoPath = `${folder}/${relativePath}`;
      let bytes;
      try {
        bytes = cat07RunTrustedGit(['show', `${headSha}:${repoPath}`], {
          encoding: 'buffer',
          maxBuffer: CAT07_MAX_SCREENSHOT_BYTES + 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        });
      } catch {
        throw new Error(`${repoPath} must exist in the pinned HEAD`);
      }
      const working = readBoundedRegularFile(abs(repoPath), {
        containmentRoot: root,
        maxBytes: CAT07_MAX_SCREENSHOT_BYTES,
      });
      if (!bytes.equals(working)) throw new Error(`${repoPath} working bytes do not match HEAD`);
      committedBytes.set(repoPath, bytes);
    }
    const parsedJson = new Map();
    const readCommittedBytes = (repoPath) => {
      const normalized = normalizeRepoPath(repoPath);
      const bytes = committedBytes.get(normalized);
      if (!bytes) throw new Error(`${normalized} is outside the pinned CAT07 evidence snapshot`);
      return bytes;
    };
    const readCommittedJson = (repoPath) => {
      const normalized = normalizeRepoPath(repoPath);
      if (parsedJson.has(normalized)) return parsedJson.get(normalized);
      const inspection = inspectCanonicalEvidenceJson(normalized, readCommittedBytes(normalized), {
        allowLocalhostUrlQuery: true,
        maxBytes: CAT07_MAX_SCREENSHOT_BYTES,
        maxStringBytes: CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_STRING_BYTES,
      });
      if (inspection.value === null) throw new Error(`${normalized} is not valid canonical JSON`);
      parsedJson.set(normalized, inspection.value);
      return inspection.value;
    };
    const summary = readCommittedJson(`${folder}/summary.json`);
    const trackedRepoFiles = listGitTrackedRepoFilesAtCommit(headSha);
    const failures = [
      ...collectCat07ShelfFreshnessFailures({
        folder,
        summary,
        fileExists: (repoPath) => committedBytes.has(normalizeRepoPath(repoPath)),
        readBytesFile: readCommittedBytes,
        readJsonFile: readCommittedJson,
        readTextFile: (repoPath) => readCommittedBytes(repoPath).toString('utf8'),
        sourceGitState: inspectCat07SourceGitState(String(summary?.sourceGitSha ?? ''), headSha),
        trackedRepoFiles,
      }),
    ];
    if (failures.length > 0) {
      throw new Error([...new Set(failures)].join('; '));
    }
    if (
      cat07RunTrustedGit(['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024,
      }).trim() !== headSha
    ) {
      throw new Error('HEAD changed during the committed CAT07 full evidence check');
    }
    for (const [repoPath, bytes] of committedBytes) {
      if (
        !bytes.equals(
          readBoundedRegularFile(abs(repoPath), {
            containmentRoot: root,
            maxBytes: CAT07_MAX_SCREENSHOT_BYTES,
          }),
        )
      ) {
        throw new Error(`${repoPath} working bytes changed during committed validation`);
      }
    }
    console.log(`PASS committed CAT07 full evidence contract ${headSha}`);
    process.exit(0);
  } catch (error) {
    console.error(
      `FAIL committed CAT07 full evidence contract: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

const manifestSourceInputPaths = Object.freeze([
  'package.json',
  'package-lock.json',
  'scripts/e2e/human-e2e-manifest.mjs',
  'scripts/e2e/human-e2e-manifest-render.mjs',
  'scripts/e2e/human-e2e-manifest-contract.mjs',
  'scripts/e2e/human-e2e-manifest-contract.test.mjs',
  'scripts/e2e/evidence-diagnostic-hygiene.mjs',
  'scripts/e2e/cat07-png-contract.mjs',
  'scripts/e2e/cat07-shelf-freshness-audit.mjs',
  'scripts/e2e/cat04-catalog-recovery-audit.mjs',
  'scripts/e2e/cat05-native-ocr-ui-audit.mjs',
  'scripts/launch/governed-evidence-chain.mjs',
  'scripts/launch/governed-evidence-chain.test.mjs',
  'scripts/phase9/build-evidence-chain-ledger.mjs',
  'scripts/phase9/build-evidence-chain-ledger.test.mjs',
  'scripts/phase9/release-qa-integrity.mjs',
]);
let manifestSourceSnapshot;
try {
  manifestSourceSnapshot = captureReleaseQaSnapshot({
    root,
    inputPaths: check
      ? [...manifestSourceInputPaths, ...manifestOutputPaths]
      : manifestSourceInputPaths,
    outputPaths: check ? [] : manifestOutputPaths,
    maxAggregateInputBytes: 256 * 1024 * 1024,
    maxInputBytes: 64 * 1024 * 1024,
  });
} catch (error) {
  console.error(
    `FAIL Human-E2E source snapshot could not be captured safely: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}

let trackedRepoFiles;
try {
  trackedRepoFiles = listGitTrackedRepoFiles();
} catch (error) {
  console.error(
    `FAIL Could not enumerate Git-tracked evidence files: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
const governedEvidenceChainAudit = auditConfiguredGovernedEvidenceChain({
  expectedHeadSha: manifestSourceSnapshot.headSha,
});
const governedEvidenceChain = governedEvidenceChainBinding(governedEvidenceChainAudit);

function hashFile(path) {
  return createHash('sha256')
    .update(
      readBoundedRegularFile(abs(path), {
        containmentRoot: root,
        maxBytes: 64 * 1024 * 1024,
      }),
    )
    .digest('hex');
}

function commandRequired(name, commandArgs) {
  if (name !== 'git') throw new Error('human-E2E trusted command supports Git only');
  return cat07RunTrustedGit(commandArgs, { encoding: 'utf8' }).trim();
}

function commandNulRepoPaths(commandArgs, label) {
  return parseCat07NulRepoPaths(cat07RunTrustedGit(commandArgs, { encoding: 'buffer' }), label);
}

function parseNulGitStatusRecords(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 16 * 1024 * 1024) {
    throw new Error(`${label} exceeds its byte ceiling`);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
  const fields = text.split('\0');
  if (fields.pop() !== '') throw new Error(`${label} is not NUL terminated`);
  const records = [];
  const seen = new Set();
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (field.length < 4 || field[2] !== ' ' || !/^[ MADRCU?!]{2}$/u.test(field.slice(0, 2))) {
      throw new Error(`${label} contains a malformed porcelain record`);
    }
    const status = field.slice(0, 2);
    const paths = [validateCat07RepoPath(field.slice(3), seen)];
    if (/[RC]/u.test(status)) {
      index += 1;
      if (index >= fields.length) throw new Error(`${label} contains a truncated rename record`);
      paths.push(validateCat07RepoPath(fields[index], seen));
    }
    records.push({ paths, status });
  }
  return records;
}

function inspectCat04SourceGitState(sourceGitSha) {
  const state = {
    changedRepoFilesSinceSource: [],
    commitExists: false,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: false,
    runnerMatchesSource: false,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) return state;

  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}^{commit}`]);
    state.commitExists = true;
  } catch {
    return state;
  }

  try {
    commandRequired('git', ['merge-base', '--is-ancestor', sourceGitSha, 'HEAD']);
    state.isAncestorOfHead = true;
  } catch {
    state.isAncestorOfHead = false;
  }

  const runnerPath = 'scripts/e2e/cat04-catalog-recovery-audit.mjs';
  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}:${runnerPath}`]);
    cat07RunTrustedGit(['diff', '--quiet', sourceGitSha, '--', runnerPath], {
      maxBuffer: 256 * 1024,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    state.runnerMatchesSource = true;
  } catch {
    state.runnerMatchesSource = false;
  }

  try {
    state.changedRepoFilesSinceSource = commandNulRepoPaths(
      ['diff', '--name-only', '-z', `${sourceGitSha}..HEAD`],
      'CAT04 changed-source inventory',
    );
  } catch {
    state.changedRepoFilesSinceSource = ['<unable-to-compare-source-sha>'];
  }

  try {
    state.dirtyTrackedRepoFiles = [
      ...commandNulRepoPaths(['diff', '--name-only', '-z'], 'CAT04 dirty-worktree inventory'),
      ...commandNulRepoPaths(
        ['diff', '--cached', '--name-only', '-z'],
        'CAT04 staged-worktree inventory',
      ),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
  } catch {
    state.dirtyTrackedRepoFiles = ['<unable-to-enumerate-dirty-files>'];
  }

  try {
    state.untrackedRepoFiles = listGitUntrackedRepoFiles();
  } catch {
    state.untrackedRepoFiles = ['<unable-to-enumerate-untracked-files>'];
  }

  return state;
}

function inspectCat05SourceGitState(sourceGitSha) {
  const state = {
    changedRepoFilesSinceSource: [],
    commitExists: false,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: false,
    privacySourceFiles: [],
    runnerMatchesSource: false,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) return state;

  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}^{commit}`]);
    state.commitExists = true;
  } catch {
    return state;
  }

  try {
    commandRequired('git', ['merge-base', '--is-ancestor', sourceGitSha, 'HEAD']);
    state.isAncestorOfHead = true;
  } catch {
    state.isAncestorOfHead = false;
  }

  try {
    state.privacySourceFiles = CAT05_NATIVE_OCR_PRIVACY_FILES.map((repoPath) => {
      const committedBytes = cat07RunTrustedGit(['show', `${sourceGitSha}:${repoPath}`], {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
      });
      const currentBytes = readBoundedRegularFile(abs(repoPath), {
        containmentRoot: root,
        maxBytes: 16 * 1024 * 1024,
      });
      return {
        bytes: committedBytes.length,
        currentBytes: currentBytes.length,
        currentSha256: cat05Sha256(currentBytes),
        path: repoPath,
        sha256: cat05Sha256(committedBytes),
      };
    });
  } catch {
    state.privacySourceFiles = [];
  }

  const runnerPath = 'scripts/e2e/cat05-native-ocr-ui-audit.mjs';
  try {
    commandRequired('git', ['cat-file', '-e', `${sourceGitSha}:${runnerPath}`]);
    cat07RunTrustedGit(['diff', '--quiet', sourceGitSha, '--', runnerPath], {
      maxBuffer: 256 * 1024,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    state.runnerMatchesSource = true;
  } catch {
    state.runnerMatchesSource = false;
  }

  try {
    state.changedRepoFilesSinceSource = commandNulRepoPaths(
      ['diff', '--name-only', '-z', `${sourceGitSha}..HEAD`],
      'CAT05 changed-source inventory',
    );
  } catch {
    state.changedRepoFilesSinceSource = ['<unable-to-compare-source-sha>'];
  }

  try {
    state.dirtyTrackedRepoFiles = [
      ...commandNulRepoPaths(['diff', '--name-only', '-z'], 'CAT05 dirty-worktree inventory'),
      ...commandNulRepoPaths(
        ['diff', '--cached', '--name-only', '-z'],
        'CAT05 staged-worktree inventory',
      ),
    ].filter((path, index, paths) => paths.indexOf(path) === index);
  } catch {
    state.dirtyTrackedRepoFiles = ['<unable-to-enumerate-dirty-files>'];
  }

  try {
    state.untrackedRepoFiles = listGitUntrackedRepoFiles();
  } catch {
    state.untrackedRepoFiles = ['<unable-to-enumerate-untracked-files>'];
  }

  return state;
}

function inspectCat07SourceTreeAtCommit(sourceGitSha) {
  try {
    const raw = cat07RunTrustedGit(['ls-tree', '-r', '-l', '-z', '--full-tree', sourceGitSha], {
      encoding: 'buffer',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    if (raw.length === 0 || raw.at(-1) !== 0) return null;
    let treeText;
    try {
      treeText = new TextDecoder('utf-8', { fatal: true }).decode(raw.subarray(0, -1));
    } catch {
      throw new Error('CAT07 source tree is not valid UTF-8');
    }
    const seenPaths = new Set();
    const topology = new Map();
    const entries = treeText
      .split('\0')
      .map((record) => {
        const match = /^(100644|100755) blob ([0-9a-f]{40}) +([0-9]+)\t(.+)$/u.exec(record);
        if (!match) throw new Error('unsupported CAT07 source tree entry');
        const size = Number(match[3]);
        if (!Number.isSafeInteger(size) || size < 0 || size > 32 * 1024 * 1024) {
          throw new Error('oversized CAT07 source blob');
        }
        const repoPath = validateCat07RepoPath(match[4], seenPaths);
        const segments = repoPath.split('/');
        for (let index = 0; index < segments.length; index += 1) {
          const node = segments
            .slice(0, index + 1)
            .join('/')
            .toLowerCase();
          const kind = index === segments.length - 1 ? 'file' : 'directory';
          const prior = topology.get(node);
          if (prior && prior !== kind) throw new Error('CAT07 source tree path collision');
          topology.set(node, kind);
        }
        return { mode: match[1], oid: match[2], path: repoPath, size };
      })
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    if (entries.length < 1 || entries.length > 20_000) return null;
    const digest = createHash('sha256');
    let bytes = 0;
    for (const entry of entries) {
      bytes += entry.size;
      if (!Number.isSafeInteger(bytes) || bytes > 512 * 1024 * 1024) return null;
      digest.update(`${entry.mode}\0${entry.path}\0${entry.oid}\0${entry.size}\0`, 'utf8');
    }
    return {
      bytes,
      entryCount: entries.length,
      fileCount: entries.length,
      sha256: digest.digest('hex'),
    };
  } catch {
    return null;
  }
}

function inspectCat07SourceGitState(sourceGitSha, headSha = 'HEAD') {
  const state = {
    changedRepoFilesSinceSource: [],
    commitExists: false,
    dirtyTrackedRepoFiles: [],
    isAncestorOfHead: false,
    packageLockAtSource: null,
    runtimeRootPathsAtSource: null,
    runnerMatchesSource: false,
    sharedHarnessMatchesSource: false,
    sourceTreeAtSource: null,
    sourceGitSha,
    untrackedRepoFiles: [],
  };
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) return state;

  try {
    cat07RunTrustedGit(['cat-file', '-e', `${sourceGitSha}^{commit}`], {
      maxBuffer: 256 * 1024,
      stdio: 'ignore',
    });
    state.commitExists = true;
  } catch {
    return state;
  }

  try {
    cat07RunTrustedGit(['merge-base', '--is-ancestor', sourceGitSha, headSha], {
      maxBuffer: 256 * 1024,
      stdio: 'ignore',
    });
    state.isAncestorOfHead = true;
  } catch {
    state.isAncestorOfHead = false;
  }

  const sourcePathMatches = (repoPath) => {
    try {
      validateCat07RepoPath(repoPath);
      cat07RunTrustedGit(['cat-file', '-e', `${sourceGitSha}:${repoPath}`], {
        maxBuffer: 256 * 1024,
        stdio: 'ignore',
      });
      cat07RunTrustedGit(['diff', '--quiet', sourceGitSha, headSha, '--', repoPath], {
        maxBuffer: 256 * 1024,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  };
  state.runnerMatchesSource = sourcePathMatches('scripts/e2e/cat07-shelf-freshness-audit.mjs');
  state.sharedHarnessMatchesSource = sourcePathMatches(
    'scripts/e2e/cat04-catalog-recovery-audit.mjs',
  );
  try {
    const packageLock = cat07RunTrustedGit(['show', `${sourceGitSha}:package-lock.json`], {
      encoding: 'buffer',
      maxBuffer: CAT07_SHELF_FRESHNESS_MAX_DIAGNOSTIC_ARTIFACT_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    state.packageLockAtSource = {
      bytes: packageLock.length,
      sha256: createHash('sha256').update(packageLock).digest('hex'),
    };
    const packageLockJson = JSON.parse(packageLock.toString('utf8'));
    const roots = new Set(['node_modules']);
    for (const packagePath of Object.keys(packageLockJson?.packages ?? {})) {
      const normalized = normalizeRepoPath(packagePath);
      const marker = normalized.indexOf('node_modules/');
      if (marker >= 0) roots.add(`${normalized.slice(0, marker)}node_modules`);
    }
    state.runtimeRootPathsAtSource = [...roots].sort();
  } catch {
    state.packageLockAtSource = null;
    state.runtimeRootPathsAtSource = null;
  }
  state.sourceTreeAtSource = inspectCat07SourceTreeAtCommit(sourceGitSha);

  try {
    state.changedRepoFilesSinceSource = parseCat07NulRepoPaths(
      cat07RunTrustedGit(['diff', '--name-only', '-z', `${sourceGitSha}..${headSha}`]),
      'changed-file inventory',
    );
  } catch {
    state.changedRepoFilesSinceSource = ['<unable-to-compare-source-sha>'];
  }
  try {
    state.dirtyTrackedRepoFiles = [
      ...parseCat07NulRepoPaths(
        cat07RunTrustedGit(['diff', '--name-only', '-z']),
        'dirty-file inventory',
      ),
      ...parseCat07NulRepoPaths(
        cat07RunTrustedGit(['diff', '--cached', '--name-only', '-z', headSha]),
        'staged-file inventory',
      ),
    ].filter((repoPath, index, repoPaths) => repoPaths.indexOf(repoPath) === index);
  } catch {
    state.dirtyTrackedRepoFiles = ['<unable-to-enumerate-dirty-files>'];
  }
  try {
    state.untrackedRepoFiles = parseCat07NulRepoPaths(
      cat07RunTrustedGit(['ls-files', '--others', '--exclude-standard', '-z']),
      'untracked-file inventory',
    );
  } catch {
    state.untrackedRepoFiles = ['<unable-to-enumerate-untracked-files>'];
  }

  return state;
}

function listGitTrackedRepoFiles() {
  return new Set(
    parseCat07NulRepoPaths(
      cat07RunTrustedGit(['ls-files', '-z'], { encoding: 'buffer' }),
      'tracked-file inventory',
    ),
  );
}

function listGitTrackedRepoFilesAtCommit(headSha) {
  if (!/^[a-f0-9]{40}$/u.test(headSha)) {
    throw new Error('CAT07 tracked-file inventory requires one pinned full HEAD SHA');
  }
  return new Set(
    parseCat07NulRepoPaths(
      cat07RunTrustedGit(['ls-tree', '-r', '-z', '--name-only', headSha], {
        encoding: 'buffer',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      }),
      'tracked-file inventory',
    ),
  );
}

function listGitUntrackedRepoFiles() {
  return parseCat07NulRepoPaths(
    cat07RunTrustedGit(['ls-files', '--others', '--exclude-standard', '-z'], {
      encoding: 'buffer',
    }),
    'untracked-file inventory',
  );
}

function gateEvidencePath(gate) {
  return `${gate.folder}/${gate.evidence}`;
}

function textPressureRetainedNarrowGate(date) {
  return {
    id: 'support-floor-360-640-200-text-pressure',
    title: '360 x 640 retained narrow-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${date}/text-pressure-200-supported-360-640-postfix`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero retained narrow-phone text-pressure geometry/log failures.',
  };
}

function textPressureLegacyFloorGate(date, scale, suffix, titleScale = `${scale}%`) {
  return {
    id: `legacy-320-480-${scale}-text-pressure`,
    title: `320 x 480 stress ${titleScale} text-pressure route sweep`,
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${date}/text-pressure-${scale}-support-floor-480-${suffix}`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero legacy 320-wide stress geometry/log failures.',
  };
}

function legacySupportFloorGate(date) {
  return {
    id: 'short-phone-480-route-rerun',
    title: '320 x 480 stress route rerun',
    kind: 'failures',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${date}/current-main-short-phone-480-rerun`,
    evidence: 'failures.json',
    expected: '49 Expo web direct-entry routes have zero legacy 320-wide geometry/log failures.',
  };
}

function supportFloorGateForDate(date) {
  return textPressureRetainedNarrowGate(date);
}

function requiredGateEvidenceFiles(date) {
  return [
    `test-results/human-e2e/${date}/text-pressure-200-iphone-375-667-full-postfix3-clear/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-iphone-375-812-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-modern-390-postfix-7/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-boundary-414-896-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-modern-430-postfix-5/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-375-667-postfix3/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-390-844-postfix/summary.json`,
    `test-results/human-e2e/${date}/text-pressure-200-skipped-routes-430-932-postfix/summary.json`,
  ];
}

function trackedHumanEvidenceDates() {
  return [
    ...new Set(
      [...trackedRepoFiles]
        .map((path) => path.match(/^test-results\/human-e2e\/(\d{4}-\d{2}-\d{2})\//u)?.[1])
        .filter(Boolean),
    ),
  ].sort();
}

function latestEvidenceDate() {
  const dates = trackedHumanEvidenceDates();
  return (
    [...dates]
      .reverse()
      .find((date) =>
        requiredGateEvidenceFiles(date).every((evidencePath) =>
          trackedRepoFiles.has(normalizeRepoPath(evidencePath)),
        ),
      ) ?? null
  );
}

function latestEvidenceDateForFolder(folder, evidence = 'summary.json') {
  return (
    trackedHumanEvidenceDates()
      .reverse()
      .find((date) =>
        trackedRepoFiles.has(
          normalizeRepoPath(`test-results/human-e2e/${date}/${folder}/${evidence}`),
        ),
      ) ?? null
  );
}

function walkEvidence(path, trackedRepoFiles) {
  const folderPrefix = `${normalizeRepoPath(path).replace(/\/$/u, '')}/`;
  const result = { files: 0, bytes: 0 };
  for (const [repoPath, binding] of humanEvidenceBindingsByPath ?? []) {
    if (
      repoPath.startsWith(folderPrefix) &&
      trackedRepoFiles.has(repoPath) &&
      !repoPath.endsWith('/expo-web.log')
    ) {
      result.files += 1;
      result.bytes += binding.sizeBytes;
    }
  }
  return result;
}

function parseFailureCount(path) {
  const data = readJson(path);
  if (Array.isArray(data)) return data.length;
  if (typeof data?.failedRouteCount === 'number') return data.failedRouteCount;
  if (Array.isArray(data?.failedRoutes)) return data.failedRoutes.length;
  throw new Error(`${path} does not expose failedRouteCount or failedRoutes.`);
}

const requestedEvidenceDate =
  dateArg?.slice('--date='.length) || process.env.E2E_MANIFEST_DATE || null;
if (requestedEvidenceDate !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(requestedEvidenceDate)) {
  console.error('FAIL Human-E2E evidence date must use exact YYYY-MM-DD syntax.');
  process.exit(1);
}
const evidenceDate = requestedEvidenceDate || latestEvidenceDate();
if (!evidenceDate) {
  console.error('FAIL No complete baseline human-E2E evidence date found.');
  process.exit(1);
}

const timelapseEvidenceDate = latestEvidenceDateForFolder('progress-timelapse-current');
if (!timelapseEvidenceDate) {
  console.error('FAIL Missing supported-phone Progress time-lapse evidence.');
  process.exit(1);
}
const captureAnalysisEvidenceDate = latestEvidenceDateForFolder(
  'progress-capture-analysis-current',
);
if (!captureAnalysisEvidenceDate) {
  console.error('FAIL Missing supported-phone Progress capture-analysis evidence.');
  process.exit(1);
}
const deviceOnlyBackupEvidenceDate = latestEvidenceDateForFolder(
  'progress-device-only-backup-current',
);
if (!deviceOnlyBackupEvidenceDate) {
  console.error('FAIL Missing device-only Progress photo storage evidence.');
  process.exit(1);
}
const progressDirectRouteLockEvidenceDate = latestEvidenceDateForFolder(
  'progress-direct-route-lock-current',
);
if (!progressDirectRouteLockEvidenceDate) {
  console.error('FAIL Missing direct-route Progress app-lock evidence.');
  process.exit(1);
}
const progressStorageRecoveryEvidenceDate = latestEvidenceDateForFolder(
  'progress-storage-recovery-current',
);
if (!progressStorageRecoveryEvidenceDate) {
  console.error('FAIL Missing encrypted Progress storage recovery evidence.');
  process.exit(1);
}
const privateEnvelopeCorruptionEvidenceDate = latestEvidenceDateForFolder(
  'private-envelope-corruption-current',
);
if (!privateEnvelopeCorruptionEvidenceDate) {
  console.error('FAIL Missing private-envelope corruption and app-lock recovery evidence.');
  process.exit(1);
}
const pregnancySafetyStatusEvidenceDate = latestEvidenceDateForFolder(
  'pregnancy-safety-status-current',
);
if (!pregnancySafetyStatusEvidenceDate) {
  console.error('FAIL Missing pregnancy-safety status consistency evidence.');
  process.exit(1);
}
const multiActivePlanTodayEvidenceDate = latestEvidenceDateForFolder(
  'multi-active-plan-today-current',
);
if (!multiActivePlanTodayEvidenceDate) {
  console.error('FAIL Missing canonical multi-active Plan/Today evidence.');
  process.exit(1);
}
const routineOrderPersistenceEvidenceDate = latestEvidenceDateForFolder(
  'routine-order-persistence-current',
);
if (!routineOrderPersistenceEvidenceDate) {
  console.error('FAIL Missing persistent AM/PM routine-order evidence.');
  process.exit(1);
}
const conflictChoiceScheduleEvidenceDate = latestEvidenceDateForFolder(
  'conflict-choice-schedule-current',
);
if (!conflictChoiceScheduleEvidenceDate) {
  console.error('FAIL Missing exact-pair conflict-choice schedule evidence.');
  process.exit(1);
}
const cycleDisruptionReconciliationEvidenceDate = latestEvidenceDateForFolder(
  'cycle-disruption-reconciliation-current',
);
if (!cycleDisruptionReconciliationEvidenceDate) {
  console.error('FAIL Missing cycle disruption and reconciliation evidence.');
  process.exit(1);
}
const cycleCustomizationEvidenceDate = latestEvidenceDateForFolder('cycle-customization-current');
if (!cycleCustomizationEvidenceDate) {
  console.error('FAIL Missing authored-cycle customization and reconciliation evidence.');
  process.exit(1);
}
const dataExportDisclosureEvidenceDate = latestEvidenceDateForFolder(
  'data-export-local-photo-disclosure-current',
);
if (!dataExportDisclosureEvidenceDate) {
  console.error('FAIL Missing account-export local-photo disclosure evidence.');
  process.exit(1);
}
const combinedDataExportEvidenceDate = latestEvidenceDateForFolder(
  'data-export-combined-device-current',
);
if (!combinedDataExportEvidenceDate) {
  console.error('FAIL Missing combined account/current-device export evidence.');
  process.exit(1);
}
const accountGenerationExportEvidenceDate = latestEvidenceDateForFolder(
  'data-export-account-generation-current',
);
if (!accountGenerationExportEvidenceDate) {
  console.error('FAIL Missing account-generation export-isolation evidence.');
  process.exit(1);
}
const accountUpgradeEvidenceDate = latestEvidenceDateForFolder(
  'onboarding-account-upgrade-current',
);
if (!accountUpgradeEvidenceDate) {
  console.error('FAIL Missing identity-preserving account-upgrade UI evidence.');
  process.exit(1);
}
const accountIsolationEvidenceDate = latestEvidenceDateForFolder(
  'onboarding-account-isolation-current',
);
if (!accountIsolationEvidenceDate) {
  console.error('FAIL Missing account-transition private-data isolation evidence.');
  process.exit(1);
}
const cat07ShelfFreshnessEvidenceDate = CAT07_SHELF_FRESHNESS_EVIDENCE_DATE;
const cat07ShelfFreshnessEvidenceFolder = `test-results/human-e2e/${cat07ShelfFreshnessEvidenceDate}/${CAT07_SHELF_FRESHNESS_EVIDENCE_FOLDER_NAME}`;
if (!exists(`${cat07ShelfFreshnessEvidenceFolder}/summary.json`)) {
  console.error(
    `FAIL Missing ${cat07ShelfFreshnessEvidenceDate} CAT07 Shelf freshness Expo-web evidence.`,
  );
  process.exit(1);
}
const requiredSurfaceHonestyEvidenceDate = latestEvidenceDateForFolder(
  'required-surface-honesty-rerun',
  'route-evidence.json',
);
if (!requiredSurfaceHonestyEvidenceDate) {
  console.error('FAIL Missing required-surface honesty route evidence.');
  process.exit(1);
}
const trendRouteGroupGateEvidenceDate = latestEvidenceDateForFolder(
  'trend-route-group-gate-current',
);
if (!trendRouteGroupGateEvidenceDate) {
  console.error('FAIL Missing Trend route-group privacy and recovery evidence.');
  process.exit(1);
}
const accountDeletionRecoveryEvidenceDate = latestEvidenceDateForFolder(
  'account-deletion-durable-recovery-current',
  'report.md',
);
if (!accountDeletionRecoveryEvidenceDate) {
  console.error('FAIL Missing durable account-deletion recovery evidence.');
  process.exit(1);
}
const healthConsentWithdrawalEvidenceDate = latestEvidenceDateForFolder(
  'health-consent-withdrawal-current',
);
if (!healthConsentWithdrawalEvidenceDate) {
  console.error('FAIL Missing health-consent withdrawal and reconsent evidence.');
  process.exit(1);
}
const cat04CatalogRecoveryEvidenceDate = latestEvidenceDateForFolder(
  CAT04_CATALOG_RECOVERY_EVIDENCE_FOLDER_NAME,
);
if (!cat04CatalogRecoveryEvidenceDate) {
  console.error('FAIL Missing CAT04 catalog-recovery Expo-web evidence.');
  process.exit(1);
}
const cat05NativeOcrReviewEvidenceDate = CAT05_NATIVE_OCR_EVIDENCE_DATE;
const cat04CatalogRecoveryEvidenceFolder = `test-results/human-e2e/${cat04CatalogRecoveryEvidenceDate}/${CAT04_CATALOG_RECOVERY_EVIDENCE_FOLDER_NAME}`;
const cat05NativeOcrReviewEvidenceFolder = `test-results/human-e2e/${cat05NativeOcrReviewEvidenceDate}/${CAT05_NATIVE_OCR_EVIDENCE_FOLDER_NAME}`;
if (
  !trackedRepoFiles.has(normalizeRepoPath(`${cat05NativeOcrReviewEvidenceFolder}/summary.json`))
) {
  console.error(
    `FAIL Missing ${cat05NativeOcrReviewEvidenceDate} CAT05 native-OCR review Expo-web evidence.`,
  );
  process.exit(1);
}
const latestManifestEvidenceDate = [
  evidenceDate,
  timelapseEvidenceDate,
  captureAnalysisEvidenceDate,
  deviceOnlyBackupEvidenceDate,
  progressDirectRouteLockEvidenceDate,
  progressStorageRecoveryEvidenceDate,
  privateEnvelopeCorruptionEvidenceDate,
  pregnancySafetyStatusEvidenceDate,
  multiActivePlanTodayEvidenceDate,
  routineOrderPersistenceEvidenceDate,
  conflictChoiceScheduleEvidenceDate,
  cycleDisruptionReconciliationEvidenceDate,
  cycleCustomizationEvidenceDate,
  dataExportDisclosureEvidenceDate,
  combinedDataExportEvidenceDate,
  accountGenerationExportEvidenceDate,
  accountUpgradeEvidenceDate,
  accountIsolationEvidenceDate,
  cat07ShelfFreshnessEvidenceDate,
  requiredSurfaceHonestyEvidenceDate,
  trendRouteGroupGateEvidenceDate,
  accountDeletionRecoveryEvidenceDate,
  healthConsentWithdrawalEvidenceDate,
  cat04CatalogRecoveryEvidenceDate,
  cat05NativeOcrReviewEvidenceDate,
]
  .sort()
  .at(-1);

const gates = [
  supportFloorGateForDate(evidenceDate),
  {
    id: 'android-360-740-200-text-pressure',
    title: '360 x 740 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-360-740-postfix`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero Android 360-class failures.',
  },
  {
    id: 'iphone-375-667-200-text-pressure',
    title: '375 x 667 compact iPhone-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-iphone-375-667-full-postfix3-clear`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero compact iPhone-class 200% text-pressure failures.',
  },
  {
    id: 'iphone-375-200-text-pressure',
    title: '375 x 812 supported iPhone-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-iphone-375-812-postfix`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero iPhone-class 200% text-pressure failures.',
  },
  {
    id: 'modern-390-200-text-pressure',
    title: '390 x 844 supported-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-modern-390-postfix-7`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero modern-phone 200% text-pressure failures.',
  },
  {
    id: 'android-412-640-200-text-pressure',
    title: '412 x 640 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-412-640-current`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero wide support-floor 200% text-pressure failures.',
  },
  {
    id: 'android-412-200-text-pressure',
    title: '412 x 915 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-412-915-postfix2`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero Android-class 200% text-pressure failures.',
  },
  {
    id: 'boundary-414-896-200-text-pressure',
    title: '414 x 896 boundary-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-boundary-414-896-postfix3`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero boundary-phone 200% text-pressure failures.',
  },
  {
    id: 'android-430-640-200-text-pressure',
    title: '430 x 640 retained Android-class 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-android-430-640-postfix3`,
    evidence: 'summary.json',
    expected:
      '49 Expo web direct-entry routes have zero wide support-floor 200% text-pressure failures.',
  },
  {
    id: 'modern-430-200-text-pressure',
    title: '430 x 932 supported-phone 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-modern-430-postfix-5`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero tall-phone 200% text-pressure failures.',
  },
  {
    id: 'skipped-routes-360-640-200-text-pressure',
    title: '360 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-360-640-current`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero launch-floor failures.',
  },
  {
    id: 'skipped-routes-375-667-200-text-pressure',
    title: '375 x 667 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-375-667-postfix3`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero compact iPhone failures.',
  },
  {
    id: 'skipped-routes-390-844-200-text-pressure',
    title: '390 x 844 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-390-844-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero modern-phone failures.',
  },
  {
    id: 'skipped-routes-412-640-200-text-pressure',
    title: '412 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-412-640-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero wide support-floor failures.',
  },
  {
    id: 'skipped-routes-430-640-200-text-pressure',
    title: '430 x 640 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-430-640-current`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero wide support-floor failures.',
  },
  {
    id: 'skipped-routes-430-932-200-text-pressure',
    title: '430 x 932 skipped/direct-entry 200% text-pressure route sweep',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-200-skipped-routes-430-932-postfix`,
    evidence: 'summary.json',
    expected:
      '21 onboarding, paywall, recovery, conflict, share, shelf, and progress routes have zero tall-phone failures.',
  },
  {
    id: 'modern-390-170-text-pressure',
    title: '390 x 844 supported-phone 170% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-170-modern-390-postfix-6`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero modern-phone text-pressure failures.',
  },
  {
    id: 'modern-430-170-text-pressure',
    title: '430 x 932 supported-phone 170% text-pressure route sweep',
    kind: 'summary-status',
    required: false,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${evidenceDate}/text-pressure-170-modern-430-postfix-3`,
    evidence: 'summary.json',
    expected: '49 Expo web direct-entry routes have zero tall-phone text-pressure failures.',
  },
  {
    ...textPressureLegacyFloorGate(evidenceDate, 200, 'postfix-12'),
  },
  {
    ...textPressureLegacyFloorGate(evidenceDate, 170, 'postfix-16'),
  },
  {
    ...legacySupportFloorGate(evidenceDate),
  },
  {
    id: 'short-phone-430-final-clearance',
    title: '320 x 430 resilience route clearance',
    kind: 'failures',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/current-main-short-phone-430-final-clearance-sweep`,
    evidence: 'failures.json',
    expected: '49 Expo web direct-entry routes have zero ultra-short geometry failures.',
  },
  {
    id: 'split-short-390-clearance',
    title: '320 x 390 split-short stress clearance',
    kind: 'failures',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/current-main-split-short-phone-390-sweep-postfix`,
    evidence: 'failures.json',
    expected: '49 Expo web direct-entry routes have zero split-short failures.',
  },
  {
    id: 'first-session-430-activation',
    title: '320 x 430 first-session activation stress pass',
    kind: 'summary-verdict',
    required: false,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${evidenceDate}/onboarding-first-session-430-current`,
    evidence: 'summary.json',
    expected: 'Fresh onboarding to shelf intake, routine plan, and Today check-off passes.',
  },
  {
    id: 'account-upgrade-supported-phone',
    title: '360 x 640 resilience account-upgrade error and recovery pass',
    kind: 'summary-verdict',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${accountUpgradeEvidenceDate}/onboarding-account-upgrade-current`,
    evidence: 'summary.json',
    expected:
      'Invalid email code recovers, valid fixture code reaches paywall, and first-session activation completes.',
  },
  {
    id: 'account-isolation-supported-phone',
    title: '360 x 640 resilience account-transition isolation and cleanup recovery pass',
    kind: 'summary-verdict',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${accountIsolationEvidenceDate}/onboarding-account-isolation-current`,
    evidence: 'summary.json',
    expected:
      'Cleanup failure stays gated, retry succeeds, and signed-out Shelf/Today expose no account A data.',
  },
  {
    id: 'account-deletion-durable-recovery-expo-web-stress',
    title: 'Account-deletion recovery Expo-web compatibility pass',
    kind: 'report-contract',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${accountDeletionRecoveryEvidenceDate}/account-deletion-durable-recovery-current`,
    evidence: 'report.md',
    requiredFiles: [
      '01-pending-1279x720.jpg',
      '02-apple-manual-1279x720.jpg',
      '03-signed-out-landing-1279x720.jpg',
      '04-invalid-receipt-1279x720.jpg',
      '05-expired-receipt-1279x720.jpg',
      '06-ownerless-support-only-1279x720.jpg',
      'observations.json',
    ],
    requiredJpegDimensions: {
      '01-pending-1279x720.jpg': { width: 1279, height: 720 },
      '02-apple-manual-1279x720.jpg': { width: 1279, height: 720 },
      '03-signed-out-landing-1279x720.jpg': { width: 1279, height: 720 },
      '04-invalid-receipt-1279x720.jpg': { width: 1279, height: 720 },
      '05-expired-receipt-1279x720.jpg': { width: 1279, height: 720 },
      '06-ownerless-support-only-1279x720.jpg': { width: 1279, height: 720 },
    },
    observations: 'observations.json',
    requiredReportText: [
      `Run window: ${accountDeletionRecoveryEvidenceDate} to 2026-07-14 (America/Toronto)`,
      'App surface: actual Expo web app with credential-free development fixtures; native iPhone evidence remains required',
      'Browser/device: Codex in-app Chromium browser on Windows; saved JPEG capture surface 1279 x 720',
      'Overall verdict: Expo-web compatibility pass with the source-level publication-fence gap and native/hosted/provider gates still explicitly blocking launch',
      'No live Supabase URL, user session, provider credential, status capability, or destructive operation was used.',
      '`01-pending-1279x720.jpg`',
      '`02-apple-manual-1279x720.jpg`',
      '`03-signed-out-landing-1279x720.jpg`',
      '`04-invalid-receipt-1279x720.jpg`',
      '`05-expired-receipt-1279x720.jpg`',
      '`06-ownerless-support-only-1279x720.jpg`',
      '`observations.json`',
      'Browser error count was zero.',
      'This run does not claim a compact-phone viewport pass.',
      'Repeat the recovery branches on a supported physical iPhone',
      'This credential-free Expo-web pass is not evidence of hosted-provider completion, legal approval, Apple approval, or revenue readiness.',
    ],
    expected:
      'Credential-free Expo web fixtures cover pending, manual-Apple, signed-out continuation, retryable invalid, expired, and ownerless support-only recovery; compact-phone, native-iPhone, hosted Supabase, and live-provider proof remain launch gates.',
  },
  {
    id: 'health-consent-withdrawal-expo-web-compatibility',
    title: 'Health-consent withdrawal and fresh-reconsent Expo-web compatibility pass',
    kind: 'summary-status',
    required: true,
    supportClass: 'resilience',
    folder: `test-results/human-e2e/${healthConsentWithdrawalEvidenceDate}/health-consent-withdrawal-current`,
    evidence: 'summary.json',
    requiredFiles: [
      'report.md',
      'results.json',
      '13-goals-stable-postfix-390x844.png',
      '15-privacy-active-postfix-390x844.png',
      '16-withdrawal-confirm-postfix-390x844.png',
      '17-withdrawn-paused-postfix-390x844.png',
      '18-withdrawn-reload-postfix-390x844.png',
      '19-fresh-consent-postfix-390x844.png',
      '20-reconsent-goals-stable-postfix-390x844.png',
      '21-consent-360x640-postfix.png',
      '22-reconsent-goals-reload-postfix-390x844.png',
      '23-fresh-grant-goals-final-390x844.png',
      '24-fresh-grant-goals-reload-final-390x844.png',
    ],
    validateSummaryArtifacts: true,
    requiredSchemaVersion: 1,
    requiredStatus: 'pass',
    requiredFailedRouteCount: 0,
    requiredViewports: ['390 x 844', '360 x 640'],
    requiredVerified: [
      'current consent before goals',
      'direct goals entry recovers to consent',
      'fresh grant stays on /onboarding/goals through 6.5 seconds and reload',
      'confirm reaches the paused shell',
      'paused state survives reload',
      'fresh-consent refusal remains paused',
      'fresh reconsent stays on /onboarding/goals through 6.5 seconds and reload',
      'compact 360 x 640 consent controls',
    ],
    expected:
      'Credential-free Expo web proves consent-before-goals, decline/direct-route denial, non-destructive withdrawal, durable paused state, and stable fresh reconsent; hosted, native-iPhone, accessibility, and legal-review gates remain open.',
  },
  {
    id: 'cat04-catalog-recovery-supported-phone',
    title: 'CAT04 catalog search, scan, report, and recovery Expo-web pass',
    kind: 'cat04-catalog-recovery',
    required: true,
    supportClass: 'supported-phone',
    folder: cat04CatalogRecoveryEvidenceFolder,
    evidence: 'summary.json',
    requiredFiles: ['report.md'],
    expected:
      'Fifteen deterministic catalog search, barcode, permission, reporting, manual-entry, offline, and recovery scenarios plus six consent bootstraps pass exactly once at 375 x 667, 390 x 844, and 430 x 932 with tracked result and screenshot provenance; native camera, physical-iPhone, restart-to-ready, staging, accessibility, legal, and App Store gates remain separate.',
  },
  {
    id: 'cat05-native-ocr-review-supported-phone',
    title: 'CAT05 native OCR review Expo-web pass',
    kind: 'cat05-native-ocr-review',
    required: true,
    supportClass: 'supported-phone',
    folder: cat05NativeOcrReviewEvidenceFolder,
    evidence: 'summary.json',
    requiredFiles: ['report.md', 'scope.json'],
    expected:
      'This dated, source-bound checkpoint records five deterministic OCR review and manual-recovery scenarios exactly once at 375 x 667, 390 x 844, and 430 x 932, with four clean consent bootstraps and exact source/build/artifact provenance; later runtime changes require new evidence, and Apple Vision, camera, native privacy, physical-iPhone, accessibility, legal, and App Store gates remain separate.',
  },
  {
    id: 'progress-timelapse-supported-phone',
    title: '390 x 844 local Progress time-lapse and reduced-motion pass',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${timelapseEvidenceDate}/progress-timelapse-current`,
    evidence: 'summary.json',
    expected:
      'Real bitmap frames, finite playback, controls, close recovery, and reduced-motion manual review pass.',
  },
  {
    id: 'progress-capture-analysis-supported-phone',
    title: 'Progress quality states and support-floor save recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${captureAnalysisEvidenceDate}/progress-capture-analysis-current`,
    evidence: 'summary.json',
    expected:
      '390 x 844 quality states stay explicit and operable; 360 x 640 save failure stays inline and recoverable.',
  },
  {
    id: 'progress-device-only-backup-supported-phone',
    title: 'Device-only Progress photo storage',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${deviceOnlyBackupEvidenceDate}/progress-device-only-backup-current`,
    evidence: 'summary.json',
    expected:
      'Settings and locked Progress show device-only storage with no backup switch, dialogs, backup analytics, or photo-backend traffic.',
  },
  {
    id: 'progress-direct-route-lock-supported-phone',
    title: 'Progress direct-route app-lock coverage',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${progressDirectRouteLockEvidenceDate}/progress-direct-route-lock-current`,
    evidence: 'summary.json',
    expected:
      'Progress tab, capture, review, and detail direct entries stay locked at 360 x 640 and 390 x 844; one active-session unlock persists until background relock.',
  },
  {
    id: 'progress-storage-recovery-supported-phone',
    title: 'Progress encrypted-storage recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${progressStorageRecoveryEvidenceDate}/progress-storage-recovery-current`,
    evidence: 'summary.json',
    expected:
      'Progress tab, capture, review, and detail block false empty/missing states during encrypted read failure; persistent retry and one-shot recovery pass at supported phone sizes.',
  },
  {
    id: 'private-envelope-corruption-supported-phone',
    title: 'Private envelope corruption and app-lock recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${privateEnvelopeCorruptionEvidenceDate}/private-envelope-corruption-current`,
    evidence: 'summary.json',
    expected:
      'Malformed private envelopes block and remain byte-identical through retry; restored data and authenticated app-lock reset recover the requested route.',
  },
  {
    id: 'pregnancy-safety-status-supported-phone',
    title: 'Pregnancy-safety status and routine exclusion consistency',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${pregnancySafetyStatusEvidenceDate}/pregnancy-safety-status-current`,
    evidence: 'summary.json',
    expected:
      'All four encrypted status choices keep Plan and Today consistent; profile/consent write retries, legacy-consent regrant, missing-profile caution, prefer-not reload, and explicit-none restoration pass at 360 x 640 and 390 x 844.',
  },
  {
    id: 'multi-active-plan-today-supported-phone',
    title: 'Canonical multi-active Plan and Today consistency',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${multiActivePlanTodayEvidenceDate}/multi-active-plan-today-current`,
    evidence: 'summary.json',
    expected:
      'Every supported cycle product, BP AM placement, explicit undefined-cadence withholding, one-active PM projection, completion reload, and supported-phone geometry pass from one canonical schedule.',
  },
  {
    id: 'routine-order-persistence-supported-phone',
    title: 'Persistent Morning and Evening routine order',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${routineOrderPersistenceEvidenceDate}/routine-order-persistence-current`,
    evidence: 'summary.json',
    expected:
      'Stable product-ID AM/PM edits survive reopen, reload, Cancel, recompute, Today projection, one failed save, and retry without changing safety/cycle authority.',
  },
  {
    id: 'conflict-choice-schedule-supported-phone',
    title: 'Exact-pair conflict choice and reviewed-schedule consistency',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${conflictChoiceScheduleEvidenceDate}/conflict-choice-schedule-current`,
    evidence: 'summary.json',
    expected:
      'Two same-rule pairs keep independent current-version choices, suppress only resolved prompts, preserve one-active schedule authority, recover from one failed encrypted write, and pass supported-phone geometry/keyboard checks.',
  },
  {
    id: 'cycle-disruption-reconciliation-supported-phone',
    title: 'Cycle disruption persistence and deterministic reconciliation',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${cycleDisruptionReconciliationEvidenceDate}/cycle-disruption-reconciliation-current`,
    evidence: 'summary.json',
    expected:
      'Pause, resume, recovery, variant, Start Today, and irritation flows persist before success, recover from failed private writes, reconcile one canonical projection, and remain reachable at 360 x 640 and 390 x 844.',
  },
  {
    id: 'authored-cycle-customization-supported-phone',
    title: 'Authored cycle customization and deterministic reconciliation',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${cycleCustomizationEvidenceDate}/cycle-customization-current`,
    evidence: 'summary.json',
    requiredSchemaVersion: 1,
    requiredViewports: ['360 x 640', '390 x 844'],
    requiredVerified: [
      'Auto-to-Custom initialization',
      'non-mutating Cancel',
      'browser Back prevention',
      'stable product identity',
      'retained cadence-excess intent',
      'closed cadence-review gate',
      'Settings, Week, Why Tonight, Plan, and Today agreement',
      'zero horizontal overflow',
    ],
    expected:
      'Custom Save/Cancel, stable authored identity, retained intent, failed-write and pending-Back recovery, closed review-gate behavior, exact reconciliation provenance, and Settings/Week/Why Tonight/Plan/Today agreement pass at 360 x 640 and 390 x 844.',
  },
  {
    id: 'cat07-shelf-freshness-supported-phone',
    title: 'CAT07 Shelf freshness and replacement provenance lifecycle',
    kind: 'cat07-shelf-freshness',
    required: true,
    supportClass: 'supported-phone',
    folder: cat07ShelfFreshnessEvidenceFolder,
    evidence: 'summary.json',
    expected:
      'Three exact supported Expo-web phone viewports pass explicit-consent bootstrap and the full manual-intake, provenance, replacement, archive, and Expiring-filter lifecycle with 45 tracked screenshots, zero browser failures, and nativeDeviceProof false.',
  },
  {
    id: 'required-surface-honesty-supported-phone',
    title: 'Required-surface honest direct-entry and recovery pass',
    kind: 'required-surface-honesty',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${requiredSurfaceHonestyEvidenceDate}/required-surface-honesty-rerun`,
    evidence: 'route-evidence.json',
    requiredFiles: [
      'browser-warn-error-logs.json',
      'widgets-route.png',
      'trend-optin-route.png',
      'trend-fairness-route.png',
      'community-ask-route.png',
      'community-people-like-you-route.png',
    ],
    expected:
      'Widgets, Trend opt-in/fairness, and Community ask/aggregate direct entries remain exact, expose no fake controls or data, state their unavailable-beta posture, and provide working recovery actions at the compact iPhone viewport.',
  },
  {
    id: 'trend-route-group-gate-supported-phone',
    title: 'Trend navigator privacy and exact-route recovery',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${trendRouteGroupGateEvidenceDate}/trend-route-group-gate-current`,
    evidence: 'summary.json',
    requiredFiles: [
      'summary.json',
      'report.md',
      'pre-fix-route-evidence.json',
      'pre-fix-optin-canonicalized-to-fairness.png',
      'post-fix-route-evidence.json',
      'post-fix-trend-optin.png',
      'post-fix-trend-fairness.png',
    ],
    validateSummaryArtifacts: true,
    requiredSchemaVersion: 1,
    requiredStatus: 'pass',
    requiredFailedRouteCount: 0,
    requiredViewports: ['375 x 667'],
    requiredVerified: [
      'exact /trend/optin direct-entry and refresh identity',
      'exact /trend/fairness direct-entry and refresh identity',
      'disabled child scene withheld',
      'Monk-band hook withheld',
      'Back to Progress recovery',
      'zero unexpected browser warn or error logs',
    ],
    expected:
      'The hard-disabled Trend navigator preserves both direct URLs through refresh, withholds child data access, exposes no consent control, and returns safely to Progress at the compact iPhone viewport.',
  },
  {
    id: 'data-export-local-photo-disclosure-supported-phone',
    title: 'Account export local-photo scope disclosure',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${dataExportDisclosureEvidenceDate}/data-export-local-photo-disclosure-current`,
    evidence: 'summary.json',
    expected:
      'Settings discloses the device-only Progress-photo exclusion before export and preserves it through inline failure recovery.',
  },
  {
    id: 'data-export-combined-device-supported-phone',
    title: 'Combined account and current-device export',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${combinedDataExportEvidenceDate}/data-export-combined-device-current`,
    evidence: 'summary.json',
    expected:
      'Settings names the account/current-device scope and Progress media exclusion; backend-free recovery keeps zero dialogs, overflow, unexpected logs, analytics, or Edge requests.',
  },
  {
    id: 'data-export-account-generation-supported-phone',
    title: 'Account-generation-bound combined export',
    kind: 'summary-status',
    required: true,
    supportClass: 'supported-phone',
    folder: `test-results/human-e2e/${accountGenerationExportEvidenceDate}/data-export-account-generation-current`,
    evidence: 'summary.json',
    requiredSchemaVersion: 1,
    requiredViewports: ['360 x 640', '390 x 844'],
    requiredVerified: [
      'one cancellable account-generation lease',
      'sign-out during a delayed export',
      'configured server user_id',
      'account boundary aborts the Edge request',
      'post-write invalidation deletes',
      'nested boundaries',
      '360 x 640',
      '390 x 844',
    ],
    expected:
      'One account generation owns authenticated capture, local snapshot, Edge response, plaintext cache, share, and deletion; sign-out/A-to-B aborts and drains stale work before the next account can publish.',
  },
];

const configuredRequiredGateIds = gates
  .filter(({ required }) => required === true)
  .map(({ id }) => id);
if (
  configuredRequiredGateIds.length !== HUMAN_E2E_REQUIRED_GATE_IDS.length ||
  new Set(configuredRequiredGateIds).size !== configuredRequiredGateIds.length ||
  configuredRequiredGateIds.some((id) => !HUMAN_E2E_REQUIRED_GATE_IDS.includes(id))
) {
  console.error('FAIL Human-E2E required gate inventory diverges from its canonical contract.');
  process.exit(1);
}

const activeEvidenceFolderPrefixes = [
  ...new Set(gates.map(({ folder }) => `${normalizeRepoPath(folder).replace(/\/$/u, '')}/`)),
].sort();
const activeEvidencePaths = [...trackedRepoFiles]
  .filter((repoPath) =>
    activeEvidenceFolderPrefixes.some((folderPrefix) => repoPath.startsWith(folderPrefix)),
  )
  .sort();
try {
  humanEvidenceBindingsByPath = captureHumanEvidenceBindings(activeEvidencePaths);
} catch (error) {
  console.error(
    `FAIL Active human-E2E evidence could not be captured safely: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
let governedEvidenceWorkingBindings = null;
if (governedEvidenceChainAudit.status === 'pass') {
  try {
    governedEvidenceWorkingBindings = captureGovernedEvidenceWorkingBindings(
      governedEvidenceChainAudit,
      root,
    );
  } catch (error) {
    console.error(
      `FAIL Governed evidence-chain files could not be bound safely: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}
const sourceBoundHumanGateKinds = new Set([
  'cat04-catalog-recovery',
  'cat05-native-ocr-review',
  'cat07-shelf-freshness',
]);
const governedHumanFailuresByGateId = new Map();
for (const gate of gates.filter(({ required }) => required === true)) {
  const folderPrefix = `${normalizeRepoPath(gate.folder).replace(/\/$/u, '')}/`;
  const requiredEvidencePaths = activeEvidencePaths.filter((repoPath) =>
    repoPath.startsWith(folderPrefix),
  );
  let recordedSourceGitSha = null;
  try {
    recordedSourceGitSha = readJson(`${gate.folder}/${gate.evidence}`)?.sourceGitSha ?? null;
  } catch {
    // The gate's ordinary evidence parser reports malformed or missing summary bytes below.
  }
  governedHumanFailuresByGateId.set(
    gate.id,
    collectGovernedHumanEvidenceFailures({
      audit: governedEvidenceChainAudit,
      bindingsByPath: humanEvidenceBindingsByPath,
      requiredEvidencePaths,
      recordedSourceGitShas: sourceBoundHumanGateKinds.has(gate.kind) ? [recordedSourceGitSha] : [],
    }),
  );
}

const warnings = [
  'This manifest verifies committed local Expo web evidence only; it does not replace physical-iPhone and iOS build QA.',
  'Supported-phone 200% text-pressure gates listed in this manifest are launch-required local Expo web evidence. Android-class, 360-wide, and sub-667-height folder names are retained resilience baselines, not Android release evidence; 320-wide browser sizes also remain resilience stress evidence unless tied to a supported physical iPhone.',
  'Native keyboard events, Dynamic Type, VoiceOver, camera hardware, notification delivery, StoreKit, RevenueCat, and live Supabase remain separate iOS release gates.',
  'The account-deletion recovery gate uses credential-free Expo web development fixtures on a desktop capture surface; it does not prove compact-phone layout, Keychain persistence, native lifecycle behavior, hosted Supabase, live-provider deletion, physical-iPhone accessibility, or App Store acceptance.',
  'The health-consent withdrawal gate uses credential-free Expo web and placeholder Supabase configuration; it does not prove hosted cleanup, Storage deletion, worker scheduling, physical-iPhone lifecycle or accessibility behavior, professional legal approval, or App Store acceptance.',
  'The CAT04 catalog-recovery gate uses deterministic Expo web fixtures; it does not prove native camera hardware or permission sheets, a restart-to-ready offline worker cycle, hosted catalog/reporting behavior, physical-iPhone accessibility, professional legal approval, or App Store acceptance.',
  'The CAT05 native-OCR review gate is a dated, source-bound checkpoint using deterministic Expo web fixtures and source assertions; it must be regenerated after later runtime changes and does not execute Apple Vision, a camera, an iOS binary, native cleanup/privacy behavior, physical-iPhone accessibility, professional legal approval, or App Store acceptance.',
  'The CAT07 Shelf-freshness gate is source-bound deterministic Expo-web evidence with nativeDeviceProof false; it does not prove native encrypted storage or relaunch, notifications, physical-iPhone accessibility, migration execution, hosted RLS, live catalog truth, category estimates, professional review, legal compliance, App Review acceptance, production readiness, market demand, or revenue.',
];
const blockers = [];
for (const issue of manifestSourceSnapshot.integrityIssues) {
  blockers.push(`Human-E2E source snapshot: ${issue}.`);
}
if (governedEvidenceChainAudit.status !== 'pass') {
  blockers.push(
    `Governed evidence chain: ${governedEvidenceChainAudit.errors.join('; ') || 'invalid audit'}.`,
  );
}
for (const entry of manifestSourceSnapshot.gitStatusEntries) {
  const affectedPaths = [entry.path, entry.from].filter(Boolean);
  if (
    affectedPaths.some((repoPath) =>
      activeEvidenceFolderPrefixes.some((folderPrefix) => repoPath.startsWith(folderPrefix)),
    )
  ) {
    blockers.push(
      `Active human-E2E evidence differs from pinned HEAD: ${entry.status} ${affectedPaths.join(' -> ')}.`,
    );
  }
}
const gateResults = gates.map((gate) => {
  const evidencePath = `${gate.folder}/${gate.evidence}`;
  const folderPrefix = `${normalizeRepoPath(gate.folder).replace(/\/$/u, '')}/`;
  const normalizedEvidencePath = normalizeRepoPath(evidencePath);
  const folderExists = [...humanEvidenceBindingsByPath.keys()].some((path) =>
    path.startsWith(folderPrefix),
  );
  const evidenceExists = humanEvidenceBindingsByPath.has(normalizedEvidencePath);
  const evidenceTracked = trackedRepoFiles.has(normalizeRepoPath(evidencePath));
  const footprint = walkEvidence(gate.folder, trackedRepoFiles);
  let status = 'blocked';
  let detail = 'Missing evidence folder or file.';
  let failureCount = null;
  let verdict = null;
  const requirementFailures = [];

  if (!gate.required && (!folderExists || !evidenceExists)) {
    status = 'skipped';
    detail = `Optional ${gate.supportClass} evidence not present for this date.`;
  } else if (gate.required && evidenceExists && !evidenceTracked) {
    detail = 'Required evidence file is not Git-tracked.';
  } else if (folderExists && evidenceExists) {
    try {
      requirementFailures.push(
        ...collectEvidenceProvenanceFailures({
          folder: gate.folder,
          evidence: gate.evidence,
          requiredFiles: gate.requiredFiles,
          trackedRepoFiles,
        }),
      );
      if (gate.kind === 'failures') {
        failureCount = parseFailureCount(evidencePath);
        status = failureCount === 0 ? 'pass' : 'fail';
        detail = `${failureCount} failure${failureCount === 1 ? '' : 's'} recorded.`;
      } else if (gate.kind === 'summary-verdict') {
        const summary = readJson(evidencePath);
        verdict = String(summary.verdict ?? '')
          .trim()
          .toLowerCase();
        status = verdict === 'pass' ? 'pass' : 'fail';
        detail = `summary verdict: ${verdict || 'missing'}.`;
      } else if (gate.kind === 'summary-status') {
        const summary = readJson(evidencePath);
        requirementFailures.push(
          ...collectEvidenceProvenanceFailures({
            folder: gate.folder,
            evidence: gate.evidence,
            requiredFiles: gate.requiredFiles,
            summaryArtifacts: summary?.artifacts,
            trackedRepoFiles,
            validateRequiredFiles: false,
            validateSummaryArtifacts: gate.validateSummaryArtifacts === true,
          }),
        );
        verdict = String(summary.status ?? summary.verdict ?? '')
          .trim()
          .toLowerCase();
        if (typeof summary?.failedRouteCount === 'number') {
          failureCount = summary.failedRouteCount;
        } else if (Array.isArray(summary?.failedRoutes)) {
          failureCount = summary.failedRoutes.length;
        }
        if (
          typeof gate.requiredSchemaVersion === 'number' &&
          summary?.schemaVersion !== gate.requiredSchemaVersion
        ) {
          requirementFailures.push(
            `schemaVersion must be ${gate.requiredSchemaVersion}, received ${String(summary?.schemaVersion ?? 'missing')}`,
          );
        }
        if (
          typeof gate.requiredStatus === 'string' &&
          String(summary?.status ?? '')
            .trim()
            .toLowerCase() !== gate.requiredStatus
        ) {
          requirementFailures.push(
            `status must be ${gate.requiredStatus}, received ${String(summary?.status ?? 'missing')}`,
          );
        }
        if (
          typeof gate.requiredFailedRouteCount === 'number' &&
          summary?.failedRouteCount !== gate.requiredFailedRouteCount
        ) {
          requirementFailures.push(
            `failedRouteCount must be ${gate.requiredFailedRouteCount}, received ${String(summary?.failedRouteCount ?? 'missing')}`,
          );
        }
        const summaryViewports = Array.isArray(summary?.viewports)
          ? summary.viewports.map((value) => String(value))
          : [];
        for (const viewport of gate.requiredViewports ?? []) {
          if (!summaryViewports.includes(viewport)) {
            requirementFailures.push(`missing required viewport ${viewport}`);
          }
        }
        const verified = Array.isArray(summary?.verified)
          ? summary.verified.map((value) => String(value))
          : [];
        for (const needle of gate.requiredVerified ?? []) {
          if (!verified.some((value) => value.includes(needle))) {
            requirementFailures.push(`missing verified coverage: ${needle}`);
          }
        }
        status =
          verdict === 'pass' &&
          (failureCount == null || failureCount === 0) &&
          requirementFailures.length === 0
            ? 'pass'
            : 'fail';
        detail =
          failureCount == null
            ? `summary status: ${verdict || 'missing'}.`
            : `summary status: ${verdict || 'missing'}; ${failureCount} failed route${
                failureCount === 1 ? '' : 's'
              }.`;
        if (requirementFailures.length > 0) {
          detail = `${detail} ${requirementFailures.join('; ')}.`;
        }
      } else if (gate.kind === 'cat04-catalog-recovery') {
        const summary = readJson(evidencePath);
        requirementFailures.push(
          ...collectCat04CatalogRecoveryFailures({
            folder: gate.folder,
            peerEvidenceFolder: cat05NativeOcrReviewEvidenceFolder,
            summary,
            sourceGitState: inspectCat04SourceGitState(String(summary?.sourceGitSha ?? '')),
            trackedRepoFiles,
          }),
        );
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? '45 scenario executions and 18 explicit-consent bootstraps passed exactly once across the three supported Expo-web phone viewports with clean browser logs and tracked result, report, snapshot, and screenshot provenance.'
            : `${failureCount} CAT04 evidence-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'cat05-native-ocr-review') {
        const summary = readJson(evidencePath);
        requirementFailures.push(
          ...collectCat05NativeOcrReviewFailures({
            folder: gate.folder,
            peerEvidenceFolder: cat04CatalogRecoveryEvidenceFolder,
            summary,
            sourceGitState: inspectCat05SourceGitState(String(summary?.sourceGitSha ?? '')),
            trackedRepoFiles,
          }),
        );
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? 'This dated source-bound checkpoint has 15 scenario executions and 4 consent bootstraps exactly once across the three supported Expo-web phone viewports with zero browser failures and exact tracked source/build/result/report/scope/snapshot/screenshot byte provenance; nativeDeviceProof remains false and later runtime changes require a new run.'
            : `${failureCount} CAT05 evidence-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'cat07-shelf-freshness') {
        const summary = readJson(evidencePath);
        requirementFailures.push(
          ...collectCat07ShelfFreshnessFailures({
            folder: gate.folder,
            summary,
            sourceGitState: inspectCat07SourceGitState(String(summary?.sourceGitSha ?? '')),
            trackedRepoFiles,
          }),
        );
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? 'Three explicit-consent bootstraps and three complete Shelf freshness/replacement lifecycle executions passed exactly once across 375x667, 390x844, and 430x932 with zero browser failures, 45 tracked screenshots, 99 declared artifacts, distinct replacement identities, and nativeDeviceProof false.'
            : `${failureCount} CAT07 evidence-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'report-contract') {
        const report = readEvidenceText(evidencePath);
        requirementFailures.push(
          ...collectRequiredTextFailures({
            label: gate.evidence,
            text: report,
            requiredText: gate.requiredReportText,
          }),
        );
        for (const [file, expectedDimensions] of Object.entries(
          gate.requiredJpegDimensions ?? {},
        )) {
          try {
            const actualDimensions = readJpegDimensions(`${gate.folder}/${file}`);
            if (
              actualDimensions.width !== expectedDimensions.width ||
              actualDimensions.height !== expectedDimensions.height
            ) {
              requirementFailures.push(
                `${file} dimensions must be ${expectedDimensions.width} x ${expectedDimensions.height}, received ${actualDimensions.width} x ${actualDimensions.height}`,
              );
            }
          } catch (error) {
            requirementFailures.push(
              `${file} is not a readable reviewed JPEG: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        if (typeof gate.observations === 'string') {
          try {
            requirementFailures.push(
              ...collectAccountDeletionRecoveryObservationFailures(
                readJson(`${gate.folder}/${gate.observations}`),
              ),
            );
          } catch {
            requirementFailures.push(`${gate.observations} is not valid JSON`);
          }
        }
        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? '6 credential-free Expo web recovery states passed on the recorded desktop capture surface; compact-phone, native-iPhone, hosted-service, and provider proof remain open.'
            : `${failureCount} report-contract failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      } else if (gate.kind === 'required-surface-honesty') {
        const summary = readJson(evidencePath);
        const expectedRoutes = {
          widget: {
            path: '/routine/widgets',
            copy: [
              'Widgets are not in this beta',
              'No native home-screen widget or live activity target ships in this release.',
              'This route does not offer a preview, OS control, or paid widget upgrade.',
            ],
          },
          trendOptIn: {
            path: '/trend/optin',
            inputs: 0,
            copy: [
              'Photo trend insights are not in this beta',
              'No validated trend engine ships in this release.',
              'No Trend consent is requested.',
            ],
          },
          trendFairness: {
            path: '/trend/fairness',
            inputs: 0,
            copy: [
              'Photo trend insights are not in this beta',
              'No validated trend engine ships in this release.',
              'No Trend consent is requested.',
            ],
          },
          communityAsk: {
            path: '/community/ask',
            inputs: 0,
            copy: [
              'Community posting is not in this beta',
              'no question-submission service or reviewed peer-aggregate dataset.',
              'No consent or question is collected',
            ],
          },
          communityAggregates: {
            path: '/community/people-like-you',
            copy: [
              'Community posting is not in this beta',
              'no question-submission service or reviewed peer-aggregate dataset.',
              'No consent or question is collected',
            ],
          },
        };
        const pathFromUrl = (value) => {
          try {
            return new URL(String(value)).pathname;
          } catch {
            return null;
          }
        };

        if (summary.evidenceDate !== requiredSurfaceHonestyEvidenceDate) {
          requirementFailures.push(
            `evidenceDate must be ${requiredSurfaceHonestyEvidenceDate}, received ${String(summary.evidenceDate ?? 'missing')}`,
          );
        }
        if (
          summary?.viewportRequested?.width !== 375 ||
          summary?.viewportRequested?.height !== 667
        ) {
          requirementFailures.push('requested viewport must be 375 x 667');
        }

        for (const [routeId, expectation] of Object.entries(expectedRoutes)) {
          const route = summary?.routes?.[routeId];
          const geometry = route?.geometry;
          if (!route || !geometry) {
            requirementFailures.push(`${routeId} route evidence is missing`);
            continue;
          }
          if (pathFromUrl(route.url) !== expectation.path) {
            requirementFailures.push(`${routeId} URL must remain ${expectation.path}`);
          }
          if (pathFromUrl(geometry.href) !== expectation.path) {
            requirementFailures.push(`${routeId} geometry href must remain ${expectation.path}`);
          }
          if (typeof expectation.inputs === 'number' && geometry.inputs !== expectation.inputs) {
            requirementFailures.push(`${routeId} must expose ${expectation.inputs} inputs`);
          }
          const viewportWidth = Number(
            geometry?.viewport?.width ?? summary?.viewportObserved?.width,
          );
          if (!Number.isFinite(viewportWidth) || geometry.scrollWidth > viewportWidth) {
            requirementFailures.push(`${routeId} has horizontal overflow`);
          }
          const controls = Array.isArray(geometry.controls) ? geometry.controls : [];
          if (
            controls.length === 0 ||
            controls.some((control) => !Number.isFinite(control?.height) || control.height < 44)
          ) {
            requirementFailures.push(`${routeId} recovery controls must be at least 44 px tall`);
          }
          for (const needle of expectation.copy) {
            if (!String(geometry.text ?? '').includes(needle)) {
              requirementFailures.push(`${routeId} is missing honest copy: ${needle}`);
            }
          }
        }

        const recoveryExpectations = {
          trendBackToProgress: '/progress',
          communityBackToSkinNotes: '/community',
          widgetsBackToToday: '/paywall/reoffer',
        };
        for (const [recoveryId, expectedPath] of Object.entries(recoveryExpectations)) {
          const recovery = summary?.recoveryActions?.[recoveryId];
          if (recovery?.controlCount !== 1 || pathFromUrl(recovery?.resultUrl) !== expectedPath) {
            requirementFailures.push(
              `${recoveryId} must use one control and recover to ${expectedPath}`,
            );
          }
        }

        const browserLogPath = `${gate.folder}/browser-warn-error-logs.json`;
        if (exists(browserLogPath)) {
          const browserLogs = readJson(browserLogPath);
          if (!Array.isArray(browserLogs)) {
            requirementFailures.push('browser warn/error log evidence must be an array');
          } else if (browserLogs.some((entry) => String(entry?.level).toLowerCase() === 'error')) {
            requirementFailures.push('browser evidence contains error-level logs');
          }
        }

        failureCount = requirementFailures.length;
        verdict = failureCount === 0 ? 'pass' : 'fail';
        status = verdict;
        detail =
          failureCount === 0
            ? '5 exact direct-entry routes and 3 recovery actions passed without fake inputs, overflow, undersized controls, or browser errors.'
            : `${failureCount} required-surface evidence failure${failureCount === 1 ? '' : 's'}: ${requirementFailures.join('; ')}.`;
      }
      if (
        requirementFailures.length > 0 &&
        gate.kind !== 'summary-status' &&
        gate.kind !== 'cat04-catalog-recovery' &&
        gate.kind !== 'cat05-native-ocr-review' &&
        gate.kind !== 'cat07-shelf-freshness' &&
        gate.kind !== 'report-contract' &&
        gate.kind !== 'required-surface-honesty'
      ) {
        status = 'fail';
        detail = `${detail} ${requirementFailures.join('; ')}.`;
      }
    } catch (error) {
      status = 'fail';
      detail = error instanceof Error ? error.message : String(error);
    }
  }

  const governedGateFailures = governedHumanFailuresByGateId.get(gate.id) ?? [];
  if (governedGateFailures.length > 0) {
    requirementFailures.push(...governedGateFailures);
    status = 'fail';
    verdict = 'fail';
    failureCount = requirementFailures.length;
    detail = `${failureCount} governed source/evidence failure${
      failureCount === 1 ? '' : 's'
    }: ${requirementFailures.join('; ')}.`;
  }

  if (gate.required && status !== 'pass') blockers.push(`${gate.title}: ${detail}`);

  return {
    ...gate,
    status,
    detail,
    failureCount,
    verdict,
    ...(gate.requiredSchemaVersion != null ||
    gate.requiredStatus != null ||
    gate.requiredFailedRouteCount != null ||
    gate.requiredViewports ||
    gate.requiredVerified ||
    gate.requiredReportText ||
    gate.kind === 'cat04-catalog-recovery' ||
    gate.kind === 'cat05-native-ocr-review' ||
    gate.kind === 'cat07-shelf-freshness'
      ? { requirementFailures }
      : {}),
    folderExists,
    evidenceExists,
    evidenceTracked,
    fileCount: footprint.files,
    bytes: footprint.bytes,
    evidenceSha256: evidenceExists && evidenceTracked ? hashFile(evidencePath) : null,
  };
});

const packet = {
  generatedAt: new Date().toISOString(),
  gitSha: manifestSourceSnapshot.headSha,
  evidenceDate: latestManifestEvidenceDate,
  baselineEvidenceDate: evidenceDate,
  status: blockers.length === 0 ? 'pass' : 'blocked',
  purpose: 'Durable local human-simulated E2E manifest for Expo web-compatible launch gates.',
  governedEvidenceChain,
  gateResults,
  warnings,
  blockers,
};

const jsonPath = abs(manifestOutputPaths[0]);
const mdPath = abs(manifestOutputPaths[1]);

const markdown = renderHumanE2eManifestMarkdown(packet);

function exactIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function replaceExactlyOnce(text, search, replacement, errors, label) {
  const first = text.indexOf(search);
  if (first < 0 || text.indexOf(search, first + search.length) >= 0) {
    errors.push(`canonical human-E2E Markdown does not contain exactly one ${label}`);
    return text;
  }
  return `${text.slice(0, first)}${replacement}${text.slice(first + search.length)}`;
}

const initialGovernedEvidenceAuditJson = JSON.stringify(governedEvidenceChainAudit);

function humanManifestStabilityErrors({ includeSourceSnapshot }) {
  const errors = [];
  if (includeSourceSnapshot) {
    errors.push(...verifyReleaseQaSnapshot(manifestSourceSnapshot).errors);
  }
  errors.push(...verifyHumanEvidenceBindings(humanEvidenceBindingsByPath));
  if (governedEvidenceChainAudit.status === 'pass') {
    if (!governedEvidenceWorkingBindings) {
      errors.push('human-E2E manifest has no retained governed evidence file bindings');
    } else {
      errors.push(
        ...verifyGovernedEvidenceWorkingBindings(governedEvidenceWorkingBindings, root, {
          context: 'human-E2E manifest assembly',
        }),
      );
    }
  }
  if (includeSourceSnapshot) {
    const finalAudit = auditConfiguredGovernedEvidenceChain({
      expectedHeadSha: manifestSourceSnapshot.headSha,
    });
    if (JSON.stringify(finalAudit) !== initialGovernedEvidenceAuditJson) {
      errors.push('governed evidence-chain audit changed during human-E2E manifest assembly');
    }
  }
  try {
    cat07TrustedGitContext().assertStable();
  } catch {
    errors.push('trusted Git identity changed during human-E2E manifest assembly');
  }
  return errors;
}

async function waitForCheckDriftTestWindow(errors) {
  if (!process.argv.includes('--test-check-drift-window')) return;
  const rawMilliseconds = String(process.env.HUMAN_E2E_MANIFEST_CHECK_TEST_PAUSE_MS ?? '');
  const milliseconds = Number(rawMilliseconds);
  if (
    process.env.NODE_ENV !== 'test' ||
    !/^[1-9][0-9]{2,4}$/u.test(rawMilliseconds) ||
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 100 ||
    milliseconds > 10_000
  ) {
    errors.push('human-E2E check drift window is restricted to one bounded test-only pause');
    return;
  }
  console.log('HUMAN_E2E_MANIFEST_CHECK_COMPARISON_COMPLETE');
  await new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
}

if (check) {
  const checkErrors = [];
  const jsonRecord = manifestSourceSnapshot.records[manifestOutputPaths[0]];
  const markdownRecord = manifestSourceSnapshot.records[manifestOutputPaths[1]];
  for (const [path, record] of [
    [manifestOutputPaths[0], jsonRecord],
    [manifestOutputPaths[1], markdownRecord],
  ]) {
    if (
      record?.workingKind !== 'file' ||
      !Buffer.isBuffer(record.workingBytes) ||
      !record.workingTreeMatchesHead ||
      !Buffer.isBuffer(record.headBytes) ||
      !record.headBytes.equals(record.workingBytes)
    ) {
      checkErrors.push(`${path} must be one committed regular file whose working bytes match HEAD`);
    }
  }

  let existingPacket;
  try {
    if (!Buffer.isBuffer(jsonRecord?.workingBytes)) {
      throw new Error(`${rel(jsonPath)} is missing from the committed source snapshot`);
    }
    existingPacket = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(jsonRecord.workingBytes),
    );
  } catch (error) {
    console.error(
      `FAIL Could not parse ${rel(jsonPath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
  if (!canonicalEvidenceJsonBytes(existingPacket).equals(jsonRecord.workingBytes)) {
    checkErrors.push(`${rel(jsonPath)} is not canonical generated JSON`);
  }
  if (!exactIsoTimestamp(existingPacket.generatedAt)) {
    checkErrors.push(`${rel(jsonPath)} generatedAt must be one canonical ISO timestamp`);
  }

  const recordedManifestValidation = validateHumanE2eManifestReleaseRole(
    existingPacket,
    governedEvidenceChainAudit,
  );
  const recordedPublicationValidation = validateGovernedGeneratedPublication(
    existingPacket.governedEvidenceChain,
    governedEvidenceChainAudit,
    manifestOutputPaths,
  );
  if (
    recordedManifestValidation.status !== 'pass' ||
    recordedPublicationValidation.status !== 'pass'
  ) {
    console.error(
      `FAIL ${rel(jsonPath)} has forged, incomplete, or stale governed release provenance: ${[
        ...recordedManifestValidation.errors,
        ...recordedPublicationValidation.errors,
      ].join('; ')}.`,
    );
    process.exit(1);
  }

  let existingMarkdown;
  try {
    if (!Buffer.isBuffer(markdownRecord?.workingBytes)) {
      throw new Error(`${rel(mdPath)} is missing from the committed source snapshot`);
    }
    existingMarkdown = new TextDecoder('utf-8', { fatal: true }).decode(
      markdownRecord.workingBytes,
    );
  } catch (error) {
    console.error(
      `FAIL Could not read ${rel(mdPath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
  const expectedDescendantMarkdownLines = [
    `- Current R/F HEAD: ${existingPacket.governedEvidenceChain.currentGitSha}`,
    `- Downstream generated commits: ${existingPacket.governedEvidenceChain.downstreamCommitCount}`,
  ];
  for (const expectedLine of expectedDescendantMarkdownLines) {
    const label = expectedLine.slice(0, expectedLine.indexOf(':') + 1);
    const matches = existingMarkdown
      .replace(/\r\n/gu, '\n')
      .split('\n')
      .filter((line) => line.startsWith(label));
    if (matches.length !== 1 || matches[0] !== expectedLine) {
      console.error(
        `FAIL ${rel(mdPath)} does not exactly mirror the validated governed descendant provenance.`,
      );
      process.exit(1);
    }
  }

  const projectedPacket = JSON.parse(JSON.stringify(packet));
  const comparableExistingPacket = JSON.parse(JSON.stringify(existingPacket));
  projectedPacket.generatedAt = '<generatedAt>';
  comparableExistingPacket.generatedAt = '<generatedAt>';
  projectedPacket.gitSha = existingPacket.gitSha;
  projectedPacket.governedEvidenceChain.currentGitSha =
    existingPacket.governedEvidenceChain.currentGitSha;
  projectedPacket.governedEvidenceChain.downstreamCommitCount =
    existingPacket.governedEvidenceChain.downstreamCommitCount;
  const expected = JSON.stringify(projectedPacket, null, 2);
  const actual = JSON.stringify(comparableExistingPacket, null, 2);
  if (actual !== expected) {
    console.error(
      `FAIL ${rel(jsonPath)} is stale or does not match current evidence. Run npm run e2e:human:manifest.`,
    );
    process.exit(1);
  }

  const recordedSha = String(existingPacket.gitSha ?? '').trim();
  if (!/^[a-f0-9]{40}$/i.test(recordedSha)) {
    console.error(`FAIL ${rel(jsonPath)} does not record a full source Git SHA.`);
    process.exit(1);
  }

  const allowedGeneratedPaths = new Set([rel(jsonPath), rel(mdPath)]);
  let changedSinceRecorded = [];
  try {
    changedSinceRecorded = commandNulRepoPaths(
      ['diff', '--name-only', '-z', `${recordedSha}..HEAD`],
      'manifest changed-source inventory',
    );
  } catch (error) {
    console.error(
      `FAIL Could not compare ${recordedSha} to HEAD: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }

  const disallowedCommittedChanges = changedSinceRecorded.filter(
    (path) =>
      !allowedGeneratedPaths.has(normalizeRepoPath(path)) && !ignoredGeneratedOutputPath(path),
  );
  if (disallowedCommittedChanges.length > 0) {
    console.error(
      `FAIL ${rel(jsonPath)} was generated before later committed source/evidence changes: ${disallowedCommittedChanges.join(', ')}. Run npm run e2e:human:manifest after those changes and commit the generated outputs separately.`,
    );
    process.exit(1);
  }

  let dirtyGeneratedOrTracked;
  try {
    dirtyGeneratedOrTracked = parseNulGitStatusRecords(
      cat07RunTrustedGit(
        ['status', '--porcelain=v1', '-z', '--untracked-files=no', '--ignore-submodules=none'],
        { encoding: 'buffer' },
      ),
      'manifest tracked-status inventory',
    ).filter(({ paths }) =>
      paths.some(
        (statusPath) =>
          !allowedGeneratedPaths.has(statusPath) && !ignoredGeneratedOutputPath(statusPath),
      ),
    );
  } catch (error) {
    console.error(
      `FAIL Could not enumerate tracked status safely: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
  if (dirtyGeneratedOrTracked.length > 0) {
    console.error(
      `FAIL tracked files outside the generated manifest are dirty: ${dirtyGeneratedOrTracked
        .map(({ paths, status }) => `${status} ${paths.join(' -> ')}`)
        .join(', ')}.`,
    );
    process.exit(1);
  }

  let untrackedSourceFiles;
  try {
    untrackedSourceFiles = collectDisallowedUntrackedRepoFiles(listGitUntrackedRepoFiles(), {
      allowedExactPaths: allowedGeneratedPaths,
    });
  } catch (error) {
    console.error(
      `FAIL Could not enumerate nonignored untracked source files: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
  if (untrackedSourceFiles.length > 0) {
    console.error(
      `FAIL nonignored untracked source files are outside the declared generated/evidence/runtime outputs: ${untrackedSourceFiles.join(', ')}.`,
    );
    process.exit(1);
  }

  let expectedMarkdown = replaceExactlyOnce(
    markdown,
    `Generated: ${packet.generatedAt}`,
    'Generated: <generatedAt>',
    checkErrors,
    'fresh generatedAt line',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `Git SHA: ${packet.gitSha}`,
    `Git SHA: ${existingPacket.gitSha}`,
    checkErrors,
    'fresh Git SHA line',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `- Current R/F HEAD: ${packet.governedEvidenceChain.currentGitSha}`,
    `- Current R/F HEAD: ${existingPacket.governedEvidenceChain.currentGitSha}`,
    checkErrors,
    'fresh governed current-commit line',
  );
  expectedMarkdown = replaceExactlyOnce(
    expectedMarkdown,
    `- Downstream generated commits: ${packet.governedEvidenceChain.downstreamCommitCount}`,
    `- Downstream generated commits: ${existingPacket.governedEvidenceChain.downstreamCommitCount}`,
    checkErrors,
    'fresh governed downstream-count line',
  );
  const actualMarkdown = replaceExactlyOnce(
    existingMarkdown,
    `Generated: ${existingPacket.generatedAt}`,
    'Generated: <generatedAt>',
    checkErrors,
    'committed generatedAt line',
  );
  if (actualMarkdown !== expectedMarkdown) {
    console.error(
      `FAIL ${rel(mdPath)} is stale or does not match current evidence. Run npm run e2e:human:manifest.`,
    );
    process.exit(1);
  }

  if (checkErrors.length === 0) {
    await waitForCheckDriftTestWindow(checkErrors);
  }
  checkErrors.push(...humanManifestStabilityErrors({ includeSourceSnapshot: true }));
  if (checkErrors.length > 0) {
    console.error(
      `FAIL Human-E2E manifest inputs changed during checking: ${[...new Set(checkErrors)].join(
        '; ',
      )}.`,
    );
    process.exit(1);
  }

  console.log('Human E2E manifest is current.');
} else {
  const prePublicationErrors = humanManifestStabilityErrors({ includeSourceSnapshot: true });
  if (prePublicationErrors.length > 0) {
    console.error(
      `FAIL Human-E2E manifest inputs changed before publication: ${[
        ...new Set(prePublicationErrors),
      ].join('; ')}.`,
    );
    process.exit(1);
  }
  try {
    atomicWriteReleaseQaOutputs({
      root,
      snapshot: manifestSourceSnapshot,
      outputs: [
        { path: manifestOutputPaths[0], bytes: canonicalEvidenceJsonBytes(packet) },
        { path: manifestOutputPaths[1], bytes: Buffer.from(markdown, 'utf8') },
      ],
      verifyAdditional() {
        return humanManifestStabilityErrors({ includeSourceSnapshot: false });
      },
    });
  } catch (error) {
    console.error(
      `FAIL Human-E2E manifest publication was rejected: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }

  console.log(`Wrote ${rel(jsonPath)}`);
  console.log(`Wrote ${rel(mdPath)}`);
}

if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

console.log('Human E2E manifest passed local evidence gates.');
