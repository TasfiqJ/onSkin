#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  platformRequirementStatus,
  validateLaunchContract,
} from '../launch/contract.mjs';
import {
  auditGovernedEvidenceChain,
  captureGovernedEvidenceWorkingBindings,
  governedEvidenceLedgerPath,
  renderGovernedEvidenceLedger,
  validateGovernedPublicationCompletion,
  verifyGovernedEvidenceWorkingBindings,
} from '../launch/governed-evidence-chain.mjs';
import { GOVERNED_POST_F_COMMANDS } from '../launch/governed-publication-coverage.mjs';
import {
  atomicWriteReleaseQaOutputs,
  canonicalReleaseRepoPath,
  captureReleaseQaSnapshot,
  PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES,
  PHASE9_RELEASE_INPUT_MAX_BYTES,
  readStableRootBoundWorkingFile,
  runTrustedGit,
  trustedGitEnvironment,
  trustedGitExecutable,
  verifyReleaseQaSnapshot,
} from '../phase9/release-qa-integrity.mjs';

export const READINESS_INPUT_MAX_BYTES = Math.min(PHASE9_RELEASE_INPUT_MAX_BYTES, 4 * 1024 * 1024);
export const READINESS_INPUT_AGGREGATE_MAX_BYTES = Math.min(
  PHASE9_RELEASE_INPUT_AGGREGATE_MAX_BYTES,
  16 * 1024 * 1024,
);
export const READINESS_MOBILE_INVENTORY_MAX_ENTRIES = 20_000;
export const READINESS_EXPECTED_MOBILE_TEST_FILES = 336;
export const READINESS_EXPECTED_MOBILE_TESTS = 4183;
export const READINESS_OUTPUT_JSON_PATH = 'docs/generated/readiness-status-audit.json';
export const READINESS_OUTPUT_MD_PATH = 'docs/generated/readiness-status-audit.md';
export const READINESS_PROVENANCE_CONTRACT = 'governed-evidence-chain-final-output-pair-v2';
export const READINESS_GOVERNED_PACKET_CHECK_COMMAND = GOVERNED_POST_F_COMMANDS.map(
  (command) => `npm run ${command}`,
).join(' && ');

const READINESS_FULL_GIT_SHA = /^[0-9a-f]{40}$/u;
const READINESS_SHA256 = /^[0-9a-f]{64}$/u;

export function readinessVerificationLifecycleBlockers(packageJson) {
  const blockers = [];
  const scripts = packageJson?.scripts ?? {};
  const phase9Commands = new Set(String(scripts['phase9:verify'] ?? '').split(' && '));
  const launchCommands = new Set(String(scripts['launch:verify'] ?? '').split(' && '));
  const commonPreSnapshotCommands = [
    'npm run phase9:governed-publication-coverage:test',
    'npm run phase9:dependency-sbom:test',
    'npm run e2e:human:manifest:contract:test',
    'npm run phase7:qa-packet:contract:test',
  ];
  for (const [parentScript, commands] of [
    ['phase9:verify', phase9Commands],
    ['launch:verify', launchCommands],
  ]) {
    for (const requiredCommand of commonPreSnapshotCommands) {
      if (!commands.has(requiredCommand)) {
        blockers.push(`${parentScript} is missing source-safe command ${requiredCommand}.`);
      }
    }
  }
  if (!launchCommands.has('npm run docs:readiness-status-audit:test')) {
    blockers.push(
      'launch:verify is missing source-safe command npm run docs:readiness-status-audit:test.',
    );
  }

  for (const [parentScript, commands, forbiddenCommands] of [
    [
      'phase9:verify',
      phase9Commands,
      [
        'npm run e2e:human:manifest:check',
        'npm run phase4:beta-coverage-report:check',
        'npm run docs:device-support-policy-audit:check',
        'npm run phase5:qa-packet:check',
        'npm run phase7:qa-packet:check',
        'npm run phase9:qa-packet',
        'npm run phase9:qa-packet:check',
        'npm run phase10:support-handoff:check',
        'npm run docs:generated-packet-status-audit:check',
        'npm run docs:generated-packet-status-audit:strict',
        'npm run docs:readiness-status-audit:check',
      ],
    ],
    [
      'launch:verify',
      launchCommands,
      [
        'npm run e2e:human:manifest:check',
        'npm run phase4:beta-coverage-report:check',
        'npm run docs:device-support-policy-audit:check',
        'npm run phase5:qa-packet:check',
        'npm run phase7:qa-packet:check',
        'npm run phase9:qa-packet:check',
        'npm run phase10:support-handoff:check',
        'npm run docs:readiness-status-audit:check',
        'npm run docs:generated-packet-status-audit:check',
        'npm run docs:generated-packet-status-audit:strict',
      ],
    ],
  ]) {
    for (const forbiddenCommand of forbiddenCommands) {
      if (commands.has(forbiddenCommand)) {
        blockers.push(`${parentScript} must not run post-E/F command ${forbiddenCommand}.`);
      }
    }
  }
  if (scripts['release:governed-packets:check'] !== READINESS_GOVERNED_PACKET_CHECK_COMMAND) {
    blockers.push(
      'release:governed-packets:check must own the ordered post-F deterministic packet, packet-status, and readiness checks.',
    );
  }
  return blockers;
}

export function canonicalReadinessRepoPath(root, value) {
  return canonicalReleaseRepoPath(root, value);
}

export function trustedReadinessGitExecutable() {
  return trustedGitExecutable();
}

export function trustedReadinessGitEnvironment() {
  return trustedGitEnvironment();
}

export function resolveReadinessOutputPaths(root, environment = {}) {
  const jsonPath = canonicalReadinessRepoPath(
    root,
    environment.READINESS_STATUS_AUDIT_JSON ?? READINESS_OUTPUT_JSON_PATH,
  );
  const mdPath = canonicalReadinessRepoPath(
    root,
    environment.READINESS_STATUS_AUDIT_MD ?? READINESS_OUTPUT_MD_PATH,
  );
  if (jsonPath !== READINESS_OUTPUT_JSON_PATH || mdPath !== READINESS_OUTPUT_MD_PATH) {
    throw new Error('readiness outputs must use the governed generated pair');
  }
  return Object.freeze({ jsonPath, mdPath });
}

export function reviewedReadinessTestBaseline(environment = {}) {
  for (const [key, expected] of [
    ['READINESS_TEST_FILES', READINESS_EXPECTED_MOBILE_TEST_FILES],
    ['READINESS_TESTS', READINESS_EXPECTED_MOBILE_TESTS],
  ]) {
    if (environment[key] !== undefined && String(environment[key]).trim() !== String(expected)) {
      throw new Error(`${key} cannot override the reviewed readiness baseline`);
    }
  }
  return Object.freeze({
    expectedMobileTestFiles: READINESS_EXPECTED_MOBILE_TEST_FILES,
    expectedMobileTests: READINESS_EXPECTED_MOBILE_TESTS,
  });
}

export function parseReadinessMobileTestFileList(
  root,
  output,
  { maxEntries = READINESS_MOBILE_INVENTORY_MAX_ENTRIES } = {},
) {
  if (!Buffer.isBuffer(output)) throw new TypeError('mobile test inventory must be bytes');
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError('mobile test inventory entry ceiling is invalid');
  }
  if (output.length > READINESS_INPUT_AGGREGATE_MAX_BYTES) {
    throw new Error('mobile test inventory exceeds its byte ceiling');
  }
  let decoded;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(output);
  } catch {
    throw new Error('mobile test inventory is not valid UTF-8');
  }
  const fields = decoded.split('\0');
  if (fields.at(-1) !== '') throw new Error('mobile test inventory is not NUL-terminated');
  fields.pop();
  if (fields.length > maxEntries) throw new Error('mobile test inventory has too many entries');
  const portablePaths = new Map();
  const paths = [];
  for (const rawPath of fields) {
    const repoPath = canonicalReadinessRepoPath(root, rawPath);
    if (!repoPath.startsWith('apps/mobile/')) {
      throw new Error('mobile test inventory contains an out-of-scope path');
    }
    const portableKey = repoPath.normalize('NFC').toLowerCase();
    if (portablePaths.has(portableKey)) {
      throw new Error('mobile test inventory contains a duplicate or portable path collision');
    }
    portablePaths.set(portableKey, repoPath);
    if (/\.(?:test|spec)\.(?:ts|tsx)$/u.test(repoPath)) paths.push(repoPath);
  }
  return paths.sort();
}

export function listReadinessMobileTestFiles(root) {
  const output = runTrustedGit(root, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    'apps/mobile',
  ]);
  return parseReadinessMobileTestFileList(root, output);
}

export function captureReadinessStatusSnapshot({
  root,
  inputPaths,
  outputPaths,
  maxInputBytes = READINESS_INPUT_MAX_BYTES,
  maxAggregateInputBytes = READINESS_INPUT_AGGREGATE_MAX_BYTES,
}) {
  return captureReleaseQaSnapshot({
    root,
    inputPaths,
    outputPaths,
    maxInputBytes,
    maxAggregateInputBytes,
    optionalWorkingInputMaxBytes: Math.min(maxInputBytes, maxAggregateInputBytes),
  });
}

export function verifyReadinessStatusSnapshot(snapshot) {
  return verifyReleaseQaSnapshot(snapshot);
}

export function readStableReadinessInput(root, repoPath, options = {}) {
  return readStableRootBoundWorkingFile(root, repoPath, {
    maxBytes: options.maxBytes ?? READINESS_INPUT_MAX_BYTES,
    onPhase: options.onPhase ?? null,
  });
}

export function atomicWriteReadinessStatusOutputs({
  root,
  snapshot,
  jsonPath,
  mdPath,
  jsonContent,
  mdContent,
  onPhase = null,
  verifyAdditional = null,
}) {
  return atomicWriteReleaseQaOutputs({
    root,
    snapshot,
    outputs: [
      { path: jsonPath, bytes: jsonContent },
      { path: mdPath, bytes: mdContent },
    ],
    onPhase,
    verifyAdditional,
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameStringArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sameJsonValue(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

export function buildReadinessGovernedEvidenceChainSummary(
  chain,
  { allowFinalReadinessCommit = false } = {},
) {
  if (
    chain?.status !== 'pass' ||
    !READINESS_FULL_GIT_SHA.test(String(chain.sourceGitSha ?? '')) ||
    !READINESS_FULL_GIT_SHA.test(String(chain.headGitSha ?? '')) ||
    !READINESS_FULL_GIT_SHA.test(String(chain.evidenceCommitSha ?? '')) ||
    chain.ledger?.sourceGitSha !== chain.sourceGitSha ||
    chain.ledger?.releaseCandidateDir !== chain.releaseCandidateDir ||
    chain.ledgerPath !== governedEvidenceLedgerPath(chain.releaseCandidateDir) ||
    !Array.isArray(chain.ledger?.entries) ||
    chain.ledger.entries.length === 0 ||
    !Array.isArray(chain.downstreamCommits) ||
    chain.downstreamCommits.length === 0 ||
    chain.downstreamCommits.at(-1)?.commitSha !== chain.headGitSha
  ) {
    throw new Error(
      'readiness requires one passing governed evidence-chain audit with a post-evidence generated tail',
    );
  }
  const completion = validateGovernedPublicationCompletion(chain, {
    stage: allowFinalReadinessCommit ? 'F' : 'R',
  });
  if (completion.status !== 'pass') {
    throw new Error(
      `readiness requires the exact governed ${completion.stage} publication set: ${completion.errors.join('; ')}`,
    );
  }
  const readinessOutputCommits = chain.downstreamCommits
    .map((commit, index) => ({ commit, index }))
    .filter(({ commit }) =>
      commit.changedPaths.some((repoPath) =>
        [READINESS_OUTPUT_JSON_PATH, READINESS_OUTPUT_MD_PATH].includes(repoPath),
      ),
    );
  const finalDownstreamIndex = chain.downstreamCommits.length - 1;
  if (
    readinessOutputCommits.length > 0 &&
    (!allowFinalReadinessCommit ||
      readinessOutputCommits.length !== 1 ||
      readinessOutputCommits[0].index !== finalDownstreamIndex ||
      !sameStringArray(readinessOutputCommits[0].commit.changedPaths, [
        READINESS_OUTPUT_JSON_PATH,
        READINESS_OUTPUT_MD_PATH,
      ]))
  ) {
    throw new Error('readiness outputs may appear only together in the unique final F commit');
  }
  const ledgerBytes = renderGovernedEvidenceLedger(chain.ledger);
  return Object.freeze({
    schemaVersion: 1,
    sourceGitSha: chain.sourceGitSha,
    evidenceCommitSha: chain.evidenceCommitSha,
    releaseCandidateDir: chain.releaseCandidateDir,
    ledgerPath: chain.ledgerPath,
    ledgerSha256: sha256(ledgerBytes),
    ledgerEntryCount: chain.ledger.entries.length,
    publicationPolicyId: chain.ledger.publicationPolicy.policyId,
    sourceSnapshotUnitCount: chain.ledger.publicationPolicy.sourceSnapshotUnits.length,
    postEvidenceRequiredUnitCount:
      chain.ledger.publicationPolicy.postEvidenceRequiredUnitIds.length,
    readinessSourceHeadSha: chain.headGitSha,
  });
}

function validReadinessGovernedEvidenceChainSummary(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const expectedKeys = [
    'schemaVersion',
    'sourceGitSha',
    'evidenceCommitSha',
    'releaseCandidateDir',
    'ledgerPath',
    'ledgerSha256',
    'ledgerEntryCount',
    'publicationPolicyId',
    'sourceSnapshotUnitCount',
    'postEvidenceRequiredUnitCount',
    'readinessSourceHeadSha',
  ].sort();
  if (!sameStringArray(Object.keys(value).sort(), expectedKeys)) return false;
  if (
    value.schemaVersion !== 1 ||
    !READINESS_FULL_GIT_SHA.test(String(value.sourceGitSha ?? '')) ||
    !READINESS_FULL_GIT_SHA.test(String(value.evidenceCommitSha ?? '')) ||
    !READINESS_FULL_GIT_SHA.test(String(value.readinessSourceHeadSha ?? '')) ||
    !READINESS_SHA256.test(String(value.ledgerSha256 ?? '')) ||
    !Number.isSafeInteger(value.ledgerEntryCount) ||
    value.ledgerEntryCount < 1 ||
    value.publicationPolicyId !== 'ios-all-features-generated-publication-v1' ||
    value.sourceSnapshotUnitCount !== 12 ||
    value.postEvidenceRequiredUnitCount !== 22
  ) {
    return false;
  }
  try {
    return value.ledgerPath === governedEvidenceLedgerPath(value.releaseCandidateDir);
  } catch {
    return false;
  }
}

function canonicalReadinessPathInventory(root, paths) {
  const portablePaths = new Map();
  const normalized = [];
  for (const value of paths) {
    const repoPath = canonicalReadinessRepoPath(root, value);
    const portableKey = repoPath.normalize('NFC').toLowerCase();
    if (portablePaths.has(portableKey)) {
      throw new Error('readiness source inventory contains a duplicate or portable path collision');
    }
    portablePaths.set(portableKey, repoPath);
    normalized.push(repoPath);
  }
  return normalized;
}

function parseReadinessNulRepoPathList(root, output, { maxEntries, label }) {
  if (!Buffer.isBuffer(output)) throw new TypeError(`${label} must be bytes`);
  if (output.length > READINESS_INPUT_AGGREGATE_MAX_BYTES) {
    throw new Error(`${label} exceeds its byte ceiling`);
  }
  let decoded;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(output);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
  const fields = decoded.split('\0');
  if (fields.at(-1) !== '') throw new Error(`${label} is not NUL-terminated`);
  fields.pop();
  if (fields.length > maxEntries) throw new Error(`${label} has too many entries`);
  return canonicalReadinessPathInventory(root, fields).sort();
}

export function listPinnedReadinessMobileTestFiles(root, headSha) {
  if (!READINESS_FULL_GIT_SHA.test(String(headSha))) {
    throw new TypeError('pinned readiness source commit must be a full Git SHA');
  }
  const output = runTrustedGit(
    root,
    ['ls-tree', '-r', '-z', '--name-only', headSha, '--', 'apps/mobile'],
    { maxBuffer: READINESS_INPUT_AGGREGATE_MAX_BYTES },
  );
  return parseReadinessMobileTestFileList(root, output);
}

export function readPinnedReadinessInputHashes(root, headSha, inputPaths) {
  if (!READINESS_FULL_GIT_SHA.test(String(headSha))) {
    throw new TypeError('pinned readiness source commit must be a full Git SHA');
  }
  const normalizedPaths = canonicalReadinessPathInventory(root, inputPaths);
  if (normalizedPaths.length > READINESS_MOBILE_INVENTORY_MAX_ENTRIES) {
    throw new Error('readiness source inventory has too many entries');
  }
  const input = Buffer.from(
    normalizedPaths.map((repoPath) => `${headSha}:${repoPath}\n`).join(''),
    'utf8',
  );
  if (input.length > READINESS_INPUT_AGGREGATE_MAX_BYTES) {
    throw new Error('readiness source inventory exceeds its byte ceiling');
  }
  const maxBuffer =
    READINESS_INPUT_AGGREGATE_MAX_BYTES + input.length + normalizedPaths.length * 128;
  if (!Number.isSafeInteger(maxBuffer)) throw new Error('readiness Git output ceiling is invalid');
  const output = runTrustedGit(root, ['cat-file', '--batch'], { input, maxBuffer });
  const hashes = {};
  let aggregateBytes = 0;
  let offset = 0;
  for (const repoPath of normalizedPaths) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) throw new Error('Git returned a truncated readiness blob header');
    const header = output.subarray(offset, newline).toString('utf8');
    offset = newline + 1;
    const match = header.match(/^([0-9a-f]{40}) blob ([0-9]+)$/u);
    if (!match) throw new Error(`${repoPath} is missing or is not a blob at pinned source HEAD`);
    const size = Number(match[2]);
    aggregateBytes += size;
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > READINESS_INPUT_MAX_BYTES ||
      aggregateBytes > READINESS_INPUT_AGGREGATE_MAX_BYTES ||
      offset + size >= output.length
    ) {
      throw new Error('Git returned an invalid readiness blob length');
    }
    const bytes = output.subarray(offset, offset + size);
    offset += size;
    if (output[offset] !== 0x0a) throw new Error('Git omitted a readiness blob terminator');
    offset += 1;
    hashes[repoPath] = sha256(bytes);
  }
  if (offset !== output.length) throw new Error('Git returned unexpected readiness blob bytes');
  return hashes;
}

export function readinessSnapshotIntegrityBlockers(snapshot) {
  const blockers = [];
  const statusEntries = Array.isArray(snapshot?.gitStatusEntries)
    ? snapshot.gitStatusEntries
        .map((entry) => {
          const status = String(entry?.status ?? '??');
          const path = String(entry?.path ?? '<missing-path>');
          const from =
            entry?.from === undefined ? '' : ` from ${JSON.stringify(String(entry.from))}`;
          return `${status} ${JSON.stringify(path)}${from}`;
        })
        .sort()
    : ['<invalid-status-snapshot>'];
  if (statusEntries.length > 0) {
    blockers.push(
      `Repository must have zero output-excluded Git status entries; found ${statusEntries.length}: ${statusEntries.join('; ')}.`,
    );
  }
  const integrityIssues = Array.isArray(snapshot?.integrityIssues)
    ? [...new Set(snapshot.integrityIssues.map(String))].sort()
    : ['readiness source integrity snapshot is invalid'];
  for (const issue of integrityIssues) {
    blockers.push(`Pinned readiness source integrity failed: ${issue}.`);
  }
  return blockers;
}

function readinessInputInventorySha256(inputPaths) {
  return sha256(Buffer.from(`${inputPaths.join('\0')}\0`, 'utf8'));
}

function readinessMobileInventorySha256(mobileTestPaths) {
  return sha256(Buffer.from(`${mobileTestPaths.join('\0')}\0`, 'utf8'));
}

export function buildReadinessSourceSnapshotSummary({
  root,
  snapshot,
  sourceInputPaths,
  mobileTestPaths,
  governedEvidenceChain = null,
}) {
  const normalizedInputs = canonicalReadinessPathInventory(root, sourceInputPaths);
  const normalizedMobileTests = canonicalReadinessPathInventory(root, mobileTestPaths).sort();
  const inputSha256 = Object.fromEntries(
    normalizedInputs.map((repoPath) => [
      repoPath,
      READINESS_SHA256.test(String(snapshot.records[repoPath]?.headSha256 ?? ''))
        ? snapshot.records[repoPath].headSha256
        : null,
    ]),
  );
  return {
    provenanceContract: READINESS_PROVENANCE_CONTRACT,
    headSha: snapshot.headSha,
    governedEvidenceChain,
    gitStatusSha256: snapshot.gitStatusSha256,
    gitStatusDirty: snapshot.gitStatusEntries.length > 0,
    inputCount: normalizedInputs.length,
    inputInventorySha256: readinessInputInventorySha256(normalizedInputs),
    inputSha256Basis: 'pinned-head-blob-bytes',
    inputSha256,
    mobileTestInventorySha256: readinessMobileInventorySha256(normalizedMobileTests),
    integrityIssues: [...snapshot.integrityIssues],
  };
}

function expectedReadinessSourceSnapshotAtHead({
  root,
  headSha,
  staticInputPaths,
  governedEvidenceChain,
}) {
  const mobileTestPaths = listPinnedReadinessMobileTestFiles(root, headSha);
  const sourceInputPaths = canonicalReadinessPathInventory(root, [
    ...staticInputPaths,
    ...mobileTestPaths,
  ]);
  const inputSha256 = readPinnedReadinessInputHashes(root, headSha, sourceInputPaths);
  return {
    mobileTestPaths,
    sourceInputPaths,
    sourceSnapshot: {
      provenanceContract: READINESS_PROVENANCE_CONTRACT,
      headSha,
      governedEvidenceChain,
      gitStatusSha256: sha256(Buffer.alloc(0)),
      gitStatusDirty: false,
      inputCount: sourceInputPaths.length,
      inputInventorySha256: readinessInputInventorySha256(sourceInputPaths),
      inputSha256Basis: 'pinned-head-blob-bytes',
      inputSha256,
      mobileTestInventorySha256: readinessMobileInventorySha256(mobileTestPaths),
      integrityIssues: [],
    },
  };
}

function validateReadinessMarkdownProvenance(markdown, expected) {
  const blockers = [];
  const inputMapSha = sha256(Buffer.from(JSON.stringify(expected.inputSha256), 'utf8'));
  const bindings = [
    ['Provenance contract', expected.provenanceContract],
    ['Pinned HEAD', expected.headSha],
    ['Governed build source', expected.governedEvidenceChain?.sourceGitSha],
    ['Governed evidence commit', expected.governedEvidenceChain?.evidenceCommitSha],
    ['Governed release candidate', expected.governedEvidenceChain?.releaseCandidateDir],
    ['Governed ledger', expected.governedEvidenceChain?.ledgerPath],
    ['Governed ledger SHA-256', expected.governedEvidenceChain?.ledgerSha256],
    ['NUL Git status SHA-256', expected.gitStatusSha256],
    ['Source-input inventory SHA-256', expected.inputInventorySha256],
    ['Input SHA snapshot', inputMapSha],
    ['Mobile test inventory SHA-256', expected.mobileTestInventorySha256],
  ];
  const lines = String(markdown ?? '')
    .replace(/\r\n/gu, '\n')
    .split('\n');
  for (const [label, value] of bindings) {
    const matches = lines.filter((line) => line.startsWith(`${label}: `));
    if (matches.length !== 1 || matches[0] !== `${label}: ${value}`) {
      blockers.push(`Generated Markdown ${label} binding is missing, duplicated, or stale.`);
    }
  }
  return blockers;
}

export function validateReadinessCommittedProvenance({
  root,
  currentHeadSha,
  outputPaths,
  staticInputPaths,
  recordedSourceSnapshot,
  recordedMarkdown,
}) {
  const blockers = [];
  const normalizedOutputs = canonicalReadinessPathInventory(root, outputPaths).sort();
  const governedOutputs = [READINESS_OUTPUT_JSON_PATH, READINESS_OUTPUT_MD_PATH].sort();
  if (!sameStringArray(normalizedOutputs, governedOutputs)) {
    blockers.push('Final readiness provenance must use the exact governed JSON/Markdown pair.');
  }
  const sourceHeadSha = String(recordedSourceSnapshot?.headSha ?? '');
  const recordedGovernedEvidenceChain = recordedSourceSnapshot?.governedEvidenceChain ?? null;
  if (!READINESS_FULL_GIT_SHA.test(sourceHeadSha)) {
    blockers.push('Generated JSON sourceSnapshot.headSha is not one full Git commit SHA.');
    return { blockers, expectedSourceSnapshot: null, mobileTestPaths: [], sourceInputPaths: [] };
  }
  const recordedGovernedSummaryValid = validReadinessGovernedEvidenceChainSummary(
    recordedGovernedEvidenceChain,
  );
  if (!recordedGovernedSummaryValid) {
    blockers.push('Generated JSON governedEvidenceChain binding is malformed or incomplete.');
  } else if (recordedGovernedEvidenceChain.readinessSourceHeadSha !== sourceHeadSha) {
    blockers.push('Generated governed evidence-chain readiness source does not match pinned HEAD.');
  }
  if (!READINESS_FULL_GIT_SHA.test(String(currentHeadSha))) {
    blockers.push('Current readiness check HEAD is not one full Git commit SHA.');
    return { blockers, expectedSourceSnapshot: null, mobileTestPaths: [], sourceInputPaths: [] };
  }

  try {
    runTrustedGit(root, ['cat-file', '-e', `${sourceHeadSha}^{commit}`]);
  } catch {
    blockers.push('Generated readiness source commit does not exist as a commit.');
    return { blockers, expectedSourceSnapshot: null, mobileTestPaths: [], sourceInputPaths: [] };
  }

  try {
    const revision = runTrustedGit(root, ['rev-list', '--parents', '-n', '1', currentHeadSha])
      .toString('utf8')
      .trim()
      .split(/\s+/u);
    if (revision[0] !== currentHeadSha || revision.length !== 2 || revision[1] !== sourceHeadSha) {
      blockers.push(
        'Current readiness evidence commit must have the recorded clean source commit as its only direct parent.',
      );
    }
  } catch {
    blockers.push('Current readiness evidence commit parentage could not be verified.');
  }

  try {
    runTrustedGit(root, ['merge-base', '--is-ancestor', sourceHeadSha, currentHeadSha]);
  } catch {
    blockers.push('Recorded readiness source commit is not an ancestor of the current commit.');
  }

  try {
    const changedPaths = parseReadinessNulRepoPathList(
      root,
      runTrustedGit(root, [
        'diff',
        '--name-only',
        '--no-renames',
        '-z',
        sourceHeadSha,
        currentHeadSha,
        '--',
      ]),
      { label: 'readiness evidence diff', maxEntries: READINESS_MOBILE_INVENTORY_MAX_ENTRIES },
    );
    if (!sameStringArray(changedPaths, normalizedOutputs)) {
      blockers.push(
        'Source-to-evidence commit diff must contain exactly the governed JSON/Markdown pair.',
      );
    }
  } catch {
    blockers.push('Source-to-evidence commit diff could not be verified safely.');
  }

  let expectedGovernedEvidenceChain = null;
  if (recordedGovernedSummaryValid) {
    try {
      const chain = auditGovernedEvidenceChain({
        root,
        sourceGitSha: recordedGovernedEvidenceChain.sourceGitSha,
        releaseCandidateDir: recordedGovernedEvidenceChain.releaseCandidateDir,
        expectedHeadSha: currentHeadSha,
      });
      if (chain.status !== 'pass') {
        blockers.push(
          ...chain.errors.map((error) => `Governed evidence chain is invalid: ${error}`),
        );
      } else {
        const finalTail = chain.downstreamCommits.at(-1);
        const readinessSourceTail = chain.downstreamCommits.at(-2);
        if (
          finalTail?.commitSha !== currentHeadSha ||
          finalTail?.parentSha !== sourceHeadSha ||
          readinessSourceTail?.commitSha !== sourceHeadSha ||
          !sameStringArray(finalTail?.changedPaths, normalizedOutputs)
        ) {
          blockers.push(
            'Governed evidence chain must end in the exact readiness-only F commit whose parent is R.',
          );
        }
        expectedGovernedEvidenceChain = {
          ...buildReadinessGovernedEvidenceChainSummary(chain, {
            allowFinalReadinessCommit: true,
          }),
          readinessSourceHeadSha: sourceHeadSha,
        };
        if (!sameJsonValue(recordedGovernedEvidenceChain, expectedGovernedEvidenceChain)) {
          blockers.push(
            'Generated JSON governedEvidenceChain does not exactly match recomputed Git provenance.',
          );
        }
      }
    } catch {
      blockers.push('Governed evidence chain could not be evaluated safely.');
    }
  }

  let expected;
  try {
    expected = expectedReadinessSourceSnapshotAtHead({
      root,
      headSha: sourceHeadSha,
      staticInputPaths,
      governedEvidenceChain: expectedGovernedEvidenceChain ?? recordedGovernedEvidenceChain ?? null,
    });
  } catch {
    blockers.push(
      'Recorded source commit inputs could not be inventoried and hashed within bounds.',
    );
    return { blockers, expectedSourceSnapshot: null, mobileTestPaths: [], sourceInputPaths: [] };
  }

  try {
    const currentMobileTestPaths = listPinnedReadinessMobileTestFiles(root, currentHeadSha);
    if (!sameStringArray(currentMobileTestPaths, expected.mobileTestPaths)) {
      blockers.push('Mobile test-file inventory changed from source commit to evidence commit.');
    }
    const currentInputHashes = readPinnedReadinessInputHashes(
      root,
      currentHeadSha,
      expected.sourceInputPaths,
    );
    if (!sameJsonValue(currentInputHashes, expected.sourceSnapshot.inputSha256)) {
      blockers.push('Readiness source inputs changed from source commit to evidence commit.');
    }
  } catch {
    blockers.push(
      'Evidence commit source inputs could not be inventoried and hashed within bounds.',
    );
  }

  if (!sameJsonValue(recordedSourceSnapshot, expected.sourceSnapshot)) {
    blockers.push(
      'Generated JSON sourceSnapshot does not exactly match recomputed source provenance.',
    );
  }
  blockers.push(...validateReadinessMarkdownProvenance(recordedMarkdown, expected.sourceSnapshot));
  return {
    blockers: [...new Set(blockers)],
    expectedSourceSnapshot: expected.sourceSnapshot,
    mobileTestPaths: expected.mobileTestPaths,
    sourceInputPaths: expected.sourceInputPaths,
  };
}

const invokedAsCli =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');

const launchReadinessPath = 'LAUNCH_READINESS.md';
const blockersPath = 'BLOCKERS.md';
const progressPath = 'PROGRESS.md';
const testingStrategyPath = 'docs/TESTING_STRATEGY.md';
const packagePath = 'package.json';
const launchContractPath = 'docs/hugeToDo/launch-contract.json';
const humanE2eManifestPath = 'docs/e2e/generated/human-e2e-manifest.json';
let outJson;
let outMd;
try {
  ({ jsonPath: outJson, mdPath: outMd } = resolveReadinessOutputPaths(root, process.env));
} catch {
  if (invokedAsCli) {
    console.error(
      'FAIL Readiness audit outputs must use the exact governed docs/generated readiness pair.',
    );
    process.exit(1);
  }
  throw new Error('readiness audit output paths are invalid');
}

export const READINESS_STATIC_INPUT_PATHS = Object.freeze([
  launchReadinessPath,
  blockersPath,
  progressPath,
  testingStrategyPath,
  packagePath,
  launchContractPath,
  humanE2eManifestPath,
  'scripts/docs/readiness-status-audit.mjs',
  'scripts/docs/readiness-status-audit.test.mjs',
  // Complete repository-local static import closure for this CLI and its shared integrity helper.
  'scripts/launch/contract.mjs',
  'scripts/launch/governed-evidence-chain.mjs',
  'scripts/launch/governed-evidence-chain.test.mjs',
  'scripts/launch/governed-publication-coverage.mjs',
  'scripts/launch/governed-publication-coverage.test.mjs',
  'scripts/phase9/release-qa-integrity.mjs',
  'scripts/phase9/release-qa-integrity.test.mjs',
  'scripts/phase9/build-evidence-chain-ledger.mjs',
  'scripts/phase9/build-evidence-chain-ledger.test.mjs',
  'scripts/phase9/release-candidate-git-contract.mjs',
  'scripts/phase9/release-candidate-git-contract.test.mjs',
  'scripts/e2e/cat07-committed-evidence.mjs',
  'scripts/e2e/evidence-diagnostic-hygiene.mjs',
  'scripts/e2e/human-e2e-manifest-render.mjs',
  'docs/phase-9/release-candidates/_template/evidence-chain.json',
  'docs/phase-9/release-candidates/README.md',
  'docs/phase-9/source-of-truth.md',
]);
const readinessStaticInputPaths = READINESS_STATIC_INPUT_PATHS;
let mobileTestPaths;
let readinessSourceInputPaths;
let sourceSnapshot;
try {
  mobileTestPaths = listReadinessMobileTestFiles(root);
  readinessSourceInputPaths = canonicalReadinessPathInventory(root, [
    ...readinessStaticInputPaths,
    ...mobileTestPaths,
  ]);
  sourceSnapshot = captureReadinessStatusSnapshot({
    root,
    inputPaths: [...readinessSourceInputPaths, ...(check ? [outJson, outMd] : [])],
    outputPaths: [outJson, outMd],
  });
} catch {
  if (invokedAsCli) {
    console.error('FAIL Readiness status audit could not capture a bounded source snapshot.');
    process.exit(1);
  }
  throw new Error('readiness status source snapshot failed');
}

const launchContractBytes = sourceSnapshot.records[launchContractPath]?.workingBytes;
let launchContract;
try {
  if (!Buffer.isBuffer(launchContractBytes)) throw new Error('missing launch contract');
  launchContract = JSON.parse(launchContractBytes.toString('utf8'));
  if (validateLaunchContract(launchContract).length > 0) throw new Error('invalid launch contract');
} catch {
  if (invokedAsCli) {
    console.error('FAIL Readiness status audit requires one valid snapshotted launch contract.');
    process.exit(1);
  }
  throw new Error('readiness status launch contract is invalid');
}
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);

let expectedMobileTestFiles;
let expectedMobileTests;
try {
  ({ expectedMobileTestFiles, expectedMobileTests } = reviewedReadinessTestBaseline(process.env));
} catch {
  if (invokedAsCli) {
    console.error(
      'FAIL Readiness test baselines are fixed reviewed constants and cannot be overridden.',
    );
    process.exit(1);
  }
  throw new Error('readiness test baseline override is invalid');
}

const cat07ShelfFreshnessGateContract = Object.freeze({
  id: 'cat07-shelf-freshness-supported-phone',
  title: 'CAT07 Shelf freshness and replacement provenance lifecycle',
  kind: 'cat07-shelf-freshness',
  required: true,
  supportClass: 'supported-phone',
  folder: 'test-results/human-e2e/2026-07-22/cat07-shelf-freshness-current',
  evidence: 'summary.json',
  status: 'pass',
  verdict: 'pass',
  failureCount: 0,
});

const staleTestPatterns = [
  /\b170\s+(?:mobile\s+)?test files?\b/i,
  /\b171\s+(?:mobile\s+)?test files?\b/i,
  /\b172\s+(?:mobile\s+)?test files?\b/i,
  /\b173\s+(?:mobile\s+)?test files?\b/i,
  /\b175\s+(?:mobile\s+)?test files?\b/i,
  /\b176\s+(?:mobile\s+)?test files?\b/i,
  /\b177\s+(?:mobile\s+)?test files?\b/i,
  /\b183\s+(?:mobile\s+)?test files?\b/i,
  /\b185\s+(?:mobile\s+)?test files?\b/i,
  /\b186\s+(?:mobile\s+)?test files?\b/i,
  /\b190\s+(?:mobile\s+)?test files?\b/i,
  /\b191\s+(?:mobile\s+)?test files?\b/i,
  /\b192\s+(?:mobile\s+)?test files?\b/i,
  /\b196\s+(?:mobile\s+)?test files?\b/i,
  /\b204\s+(?:mobile\s+)?test files?\b/i,
  /\b205\s+(?:mobile\s+)?test files?\b/i,
  /\b209\s+(?:mobile\s+)?test files?\b/i,
  /\b210\s+(?:mobile\s+)?test files?\b/i,
  /\b273\s+(?:mobile\s+)?test files?\b/i,
  /\b282\s+(?:mobile\s+)?test files?\b/i,
  /\b287\s+(?:mobile\s+)?test files?\b/i,
  /\b301\s+(?:mobile\s+)?test files?\b/i,
  /\b1743\s+tests?\b/i,
  /\b1744\s+tests?\b/i,
  /\b1748\s+tests?\b/i,
  /\b1751\s+tests?\b/i,
  /\b1760\s+tests?\b/i,
  /\b1762\s+tests?\b/i,
  /\b1764\s+tests?\b/i,
  /\b1765\s+tests?\b/i,
  /\b1767\s+tests?\b/i,
  /\b1770\s+tests?\b/i,
  /\b1777\s+tests?\b/i,
  /\b1778\s+tests?\b/i,
  /\b1782\s+tests?\b/i,
  /\b1786\s+tests?\b/i,
  /\b1792\s+tests?\b/i,
  /\b1804\s+tests?\b/i,
  /\b1823\s+tests?\b/i,
  /\b1834\s+tests?\b/i,
  /\b1838\s+tests?\b/i,
  /\b1881\s+tests?\b/i,
  /\b1937\s+tests?\b/i,
  /\b1939\s+tests?\b/i,
  /\b1940\s+tests?\b/i,
  /\b1951\s+tests?\b/i,
  /\b1997\s+tests?\b/i,
  /\b2010\s+tests?\b/i,
  /\b2037\s+tests?\b/i,
  /\b2048\s+tests?\b/i,
  /\b2094\s+tests?\b/i,
  /\b2137\s+tests?\b/i,
  /\b2172\s+tests?\b/i,
  /\b2,?243\s+tests?\b/i,
  /\b2,?244\s+tests?\b/i,
  /\b2,?246\s+tests?\b/i,
  /\b2,?248\s+tests?\b/i,
  /\b2,?250\s+tests?\b/i,
  /\b2,?251\s+tests?\b/i,
  /\b2,?780\s+tests?\b/i,
  /\b3,?139\s+tests?\b/i,
  /\b3,?251\s+tests?\b/i,
  /\b3,?335\s+tests?\b/i,
  /\b3,?529\s+tests?\b/i,
  /320 x 480 support-floor 200%\s+text-pressure/i,
  /support-floor\s+170%\s+text-pressure/i,
];

const allRequiredManifestNeedles = [
  '360 x 640 launch-floor 200% text-pressure',
  '360 x 740',
  '375 x 812',
  '390 x 844',
  '412 x 915',
  '414 x 896',
  '430 x 932',
  'API 36',
  'text-pressure-200-supported-360-640-postfix',
  'text-pressure-200-android-360-740-postfix',
  'text-pressure-200-iphone-375-812-postfix',
  'text-pressure-200-android-412-915-postfix2',
  'text-pressure-200-boundary-414-896-postfix3',
  '390 x 844 local Progress time-lapse',
  'progress-timelapse-current',
  'Progress quality states and support-floor save recovery',
  'progress-capture-analysis-current',
  'Device-only Progress photo storage',
  'progress-device-only-backup-current',
  'Progress direct-route app-lock coverage',
  'progress-direct-route-lock-current',
  'Progress encrypted-storage recovery',
  'progress-storage-recovery-current',
  'Account export local-photo scope disclosure',
  'data-export-local-photo-disclosure-current',
  'Combined account and current-device export',
  'data-export-combined-device-current',
  'Account-generation-bound combined export',
  'data-export-account-generation-current',
  '360 x 640 account-upgrade error and recovery pass',
  'onboarding-account-upgrade-current',
  '360 x 640 account-transition isolation and cleanup recovery pass',
  'onboarding-account-isolation-current',
  'Pregnancy-safety status and routine exclusion consistency',
  'pregnancy-safety-status-current',
  'Canonical multi-active Plan and Today consistency',
  'multi-active-plan-today-current',
  'Persistent Morning and Evening routine order',
  'routine-order-persistence-current',
  'Exact-pair conflict choice and reviewed-schedule consistency',
  'conflict-choice-schedule-current',
  'Cycle disruption persistence and deterministic reconciliation',
  'cycle-disruption-reconciliation-current',
  'Authored cycle customization and deterministic reconciliation',
  'cycle-customization-current',
  cat07ShelfFreshnessGateContract.title,
  cat07ShelfFreshnessGateContract.folder,
  'CAT04 catalog search, scan, report, and recovery Expo-web pass',
  'cat04-catalog-recovery-current',
  'CAT05 native OCR review Expo-web pass',
  'cat05-native-ocr-web-ui-current',
  'Required-surface honest direct-entry and recovery pass',
  'required-surface-honesty-rerun',
  'Trend navigator privacy and exact-route recovery',
  'trend-route-group-gate-current',
];

const androidReleaseManifestNeedles = new Set([
  '360 x 640 launch-floor 200% text-pressure',
  '360 x 740',
  '412 x 915',
  'API 36',
  'text-pressure-200-supported-360-640-postfix',
  'text-pressure-200-android-360-740-postfix',
  'text-pressure-200-android-412-915-postfix2',
]);
const requiredManifestNeedles = androidReleaseRequired
  ? allRequiredManifestNeedles
  : allRequiredManifestNeedles.filter((needle) => !androidReleaseManifestNeedles.has(needle));

const requiredLaunchCommands = [
  'npm run launch:verify',
  'npm run typecheck',
  'npm run lint',
  'npm test',
  'npm run docs:source-packet-audit:check',
  'npm run docs:tas-todo-audit:check',
  'npm run brand:audit:strict',
  'npm run docs:device-support-policy-audit:check',
  'npm run docs:performance-readiness-audit:check',
  'npm run release:governed-packets:check',
  'npm run phase5:check-native-config',
  'npm run phase5:widget-runtime-contract:smoke',
  'npm run phase5:widget-lifecycle-evidence:smoke',
  'npm run phase7:check-core-loop',
  'npm run phase8:check-growth-store',
  'npm run phase10:beta-analytics-audit',
  'npm run phase9:verify',
  'npm run phase10-11:verify',
];

const requiredPackageScripts = [
  'launch:verify',
  'phase9:verify',
  'phase3:review-signoff-template',
  'phase3:review-signoff-template:smoke',
  'brand:audit',
  'brand:audit:strict',
  'docs:readiness-status-audit',
  'docs:readiness-status-audit:test',
  'docs:readiness-status-audit:strict',
  'docs:readiness-status-audit:check',
  'docs:generated-packet-status-audit:check',
  'docs:device-support-policy-audit',
  'docs:device-support-policy-audit:strict',
  'docs:device-support-policy-audit:test',
  'docs:device-support-policy-audit:check',
  'docs:performance-readiness-audit',
  'docs:performance-readiness-audit:strict',
  'docs:performance-readiness-audit:check',
  'phase5:widget-runtime-contract:smoke',
  'phase5:native-ocr-evidence:smoke',
  'phase5:native-ocr-evidence:template:check',
  'phase5:camera-lifecycle-evidence:smoke',
  'phase5:camera-lifecycle-evidence:template:check',
  'phase5:performance-evidence:smoke',
  'phase5:performance-evidence:template:check',
  'phase5:widget-lifecycle-evidence:strict',
  'phase5:widget-lifecycle-evidence:smoke',
  'phase5:widget-lifecycle-evidence:template:check',
  'phase7:qa-packet:contract:test',
  'phase7:qa-packet:check',
  'phase9:governed-publication-coverage:test',
  'phase9:dependency-sbom:test',
  'phase9:qa-packet:check',
  'e2e:human:manifest:contract:test',
  'e2e:human:manifest:check',
  'release:governed-packets:check',
];

const requiredLaunchVerifyScriptParts = [
  'docs:source-packet-audit:check',
  'docs:tas-todo-audit:check',
  'docs:readiness-status-audit:test',
  'brand:audit:strict',
  'docs:device-support-policy-audit:test',
  'docs:performance-readiness-audit:check',
  'phase9:governed-publication-coverage:test',
  'phase9:dependency-sbom:test',
  'e2e:human:manifest:contract:test',
  'phase7:qa-packet:contract:test',
  'phase3:review-signoff-template:smoke',
  'phase5:check-native-config',
  'phase5:widget-runtime-contract:smoke',
  'phase5:native-ocr-evidence:smoke',
  'phase5:native-ocr-evidence:template:check',
  'phase5:camera-lifecycle-evidence:smoke',
  'phase5:camera-lifecycle-evidence:template:check',
  'phase5:performance-evidence:smoke',
  'phase5:performance-evidence:template:check',
  'phase5:widget-lifecycle-evidence:smoke',
  'phase5:widget-lifecycle-evidence:template:check',
  'phase7:check-core-loop',
  'phase8:check-growth-store',
  'phase9:release-smoke',
  'phase10:beta-readiness',
  'phase10:beta-analytics-audit',
  'phase11:launch-readiness',
  'phase11:ring-gates',
  'typecheck',
  'lint',
  'test',
];

function exists(path) {
  const normalized = canonicalReadinessRepoPath(root, path);
  return sourceSnapshot.records[normalized]?.workingKind === 'file';
}

function read(path) {
  const normalized = canonicalReadinessRepoPath(root, path);
  const record = sourceSnapshot.records[normalized];
  if (record?.workingKind !== 'file' || !Buffer.isBuffer(record.workingBytes)) {
    throw new Error(`snapshotted input is unavailable: ${normalized}`);
  }
  return record.workingBytes.toString('utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
}

function walkFiles(path) {
  if (path !== 'apps/mobile') throw new Error('unsupported snapshotted inventory root');
  return mobileTestPaths.filter(
    (repoPath) => sourceSnapshot.records[repoPath]?.workingKind === 'file',
  );
}

function markdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length), 3),
  );
  const render = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [
    render(headers),
    render(widths.map((width) => '-'.repeat(width))),
    ...rows.map(render),
  ].join('\n');
}

function normalizeGeneratedMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  if (
    typeof parsed.generatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(parsed.generatedAt)
  ) {
    throw new Error('generatedAt must be one ISO timestamp');
  }
  parsed.generatedAt = '<ignored>';
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run docs:readiness-status-audit:strict.`);
    return false;
  }
  let current;
  let expected;
  try {
    current = normalize(read(path));
    expected = normalize(expectedContent);
  } catch {
    console.error(`FAIL ${path} is invalid. Run npm run docs:readiness-status-audit:strict.`);
    return false;
  }
  if (current !== expected) {
    console.error(`FAIL ${path} is stale. Run npm run docs:readiness-status-audit:strict.`);
    return false;
  }
  return true;
}

function extractDate(text) {
  return text.match(/^Date:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1] ?? null;
}

function matchingStalePatterns(text) {
  return staleTestPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => String(pattern));
}

function extractTestBaselines(text) {
  return [
    ...text.matchAll(/\b([\d,]+)\s+(?:mobile\s+)?test files?\s*\/\s*([\d,]+)\s+tests?\b/gi),
  ].map((match) => ({
    testFiles: Number(match[1].replaceAll(',', '')),
    tests: Number(match[2].replaceAll(',', '')),
    source: match[0],
  }));
}

const blockers = [];
const warnings = [];

for (const path of readinessStaticInputPaths) {
  if (!exists(path)) blockers.push(`Missing ${path}.`);
}
const sourceIntegrityBlockers = readinessSnapshotIntegrityBlockers(sourceSnapshot);
blockers.push(...sourceIntegrityBlockers);

const launchText = exists(launchReadinessPath) ? read(launchReadinessPath) : '';
const blockersText = exists(blockersPath) ? read(blockersPath) : '';
const progressText = exists(progressPath) ? read(progressPath) : '';
const testingStrategyText = exists(testingStrategyPath) ? read(testingStrategyPath) : '';
const packageJson = exists(packagePath) ? readJson(packagePath) : { scripts: {} };
const humanManifest = exists(humanE2eManifestPath) ? readJson(humanE2eManifestPath) : {};

const evidenceDate = String(humanManifest.evidenceDate ?? '').trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDate)) {
  blockers.push(`${humanE2eManifestPath} does not expose a valid evidenceDate.`);
}
if (humanManifest.status !== 'pass') {
  blockers.push(`${humanE2eManifestPath} status is ${humanManifest.status ?? 'missing'}.`);
}

const cat07ShelfFreshnessGateFailures = [];
const cat07ShelfFreshnessGateResults = Array.isArray(humanManifest.gateResults)
  ? humanManifest.gateResults.filter((gate) => gate?.id === cat07ShelfFreshnessGateContract.id)
  : [];
const cat07ShelfFreshnessGate = cat07ShelfFreshnessGateResults[0] ?? null;
if (cat07ShelfFreshnessGateResults.length !== 1) {
  cat07ShelfFreshnessGateFailures.push(
    `must contain exactly one ${cat07ShelfFreshnessGateContract.id} gate result; found ${cat07ShelfFreshnessGateResults.length}`,
  );
} else {
  for (const field of [
    'title',
    'kind',
    'required',
    'supportClass',
    'folder',
    'evidence',
    'status',
    'verdict',
    'failureCount',
  ]) {
    if (cat07ShelfFreshnessGate[field] !== cat07ShelfFreshnessGateContract[field]) {
      cat07ShelfFreshnessGateFailures.push(
        `${cat07ShelfFreshnessGateContract.id}.${field} must be ${JSON.stringify(cat07ShelfFreshnessGateContract[field])}; received ${JSON.stringify(cat07ShelfFreshnessGate[field] ?? null)}`,
      );
    }
  }
  if (
    !Array.isArray(cat07ShelfFreshnessGate.requirementFailures) ||
    cat07ShelfFreshnessGate.requirementFailures.length !== 0
  ) {
    cat07ShelfFreshnessGateFailures.push(
      `${cat07ShelfFreshnessGateContract.id}.requirementFailures must be an empty array`,
    );
  }
}
for (const failure of cat07ShelfFreshnessGateFailures) {
  blockers.push(`${humanE2eManifestPath} ${failure}.`);
}

const actualMobileTestFiles = walkFiles('apps/mobile').filter(
  (path) => /\.test\.(?:ts|tsx)$/.test(path) || /\.spec\.(?:ts|tsx)$/.test(path),
).length;

if (actualMobileTestFiles !== expectedMobileTestFiles) {
  blockers.push(
    `Expected ${expectedMobileTestFiles} mobile test files, but found ${actualMobileTestFiles}. Update the reviewed readiness constants and source-of-truth docs only after a verified full mobile test run.`,
  );
}

const formattedExpectedMobileTests = expectedMobileTests.toLocaleString('en-US');
const expectedTestPhrase = `${expectedMobileTestFiles} mobile test files / ${formattedExpectedMobileTests} tests`;
const expectedWorkspaceTestPhrase = `${expectedMobileTestFiles} test files / ${formattedExpectedMobileTests} tests`;

const docs = [
  {
    path: launchReadinessPath,
    text: launchText,
    requireCommands: true,
    requireCurrentEvidence: true,
  },
  {
    path: blockersPath,
    text: blockersText,
    requireCommands: false,
    requireCurrentEvidence: true,
  },
  {
    path: testingStrategyPath,
    text: testingStrategyText,
    requireCommands: true,
    requireCurrentEvidence: false,
  },
];

const docResults = docs.map((doc) => {
  const date = extractDate(doc.text);
  const stalePatterns = matchingStalePatterns(doc.text);
  const testBaselines = extractTestBaselines(doc.text);
  const unexpectedTestBaselines = testBaselines.filter(
    (baseline) =>
      baseline.testFiles !== expectedMobileTestFiles || baseline.tests !== expectedMobileTests,
  );
  const hasExpectedTestPhrase =
    doc.text.includes(expectedTestPhrase) || doc.text.includes(expectedWorkspaceTestPhrase);
  const missingManifestNeedles = requiredManifestNeedles.filter(
    (needle) => !doc.text.includes(needle),
  );
  const missingCommands = doc.requireCommands
    ? requiredLaunchCommands.filter((command) => !doc.text.includes(command))
    : [];

  if (doc.requireCurrentEvidence && evidenceDate && date !== evidenceDate) {
    blockers.push(`${doc.path} Date is ${date ?? 'missing'}, expected ${evidenceDate}.`);
  }
  if (doc.requireCurrentEvidence && stalePatterns.length > 0) {
    blockers.push(`${doc.path} contains stale test-count pattern(s): ${stalePatterns.join(', ')}.`);
  }
  if (doc.requireCurrentEvidence && unexpectedTestBaselines.length > 0) {
    blockers.push(
      `${doc.path} contains contradictory test baseline(s): ${unexpectedTestBaselines.map(({ source }) => source).join(', ')}. Expected ${expectedTestPhrase}.`,
    );
  }
  if (doc.requireCurrentEvidence && !hasExpectedTestPhrase) {
    blockers.push(`${doc.path} does not mention current test baseline ${expectedTestPhrase}.`);
  }
  for (const command of missingCommands) {
    blockers.push(`${doc.path} does not mention ${command}.`);
  }
  if (doc.requireCurrentEvidence) {
    for (const needle of missingManifestNeedles) {
      blockers.push(`${doc.path} does not mention current human-E2E manifest evidence: ${needle}.`);
    }
  }

  return {
    path: doc.path,
    requireCurrentEvidence: doc.requireCurrentEvidence,
    date,
    expectedDate: evidenceDate,
    hasExpectedTestPhrase,
    testBaselines,
    unexpectedTestBaselines,
    missingManifestNeedles,
    stalePatterns,
    missingCommands,
  };
});

for (const command of requiredPackageScripts) {
  if (!Object.hasOwn(packageJson.scripts ?? {}, command)) {
    blockers.push(`${packagePath} is missing ${command}.`);
  }
}

if (
  packageJson.scripts?.['docs:readiness-status-audit:check'] !==
  'npm run docs:readiness-status-audit:test && node scripts/docs/readiness-status-audit.mjs --strict --check'
) {
  blockers.push(
    `${packagePath} docs:readiness-status-audit:check must run the focused adversarial suite before strict check mode.`,
  );
}

const launchVerifyScript = String(packageJson.scripts?.['launch:verify'] ?? '');
for (const scriptPart of requiredLaunchVerifyScriptParts) {
  if (!launchVerifyScript.includes(scriptPart)) {
    blockers.push(`${packagePath} launch:verify is missing ${scriptPart}.`);
  }
}

for (const lifecycleBlocker of readinessVerificationLifecycleBlockers(packageJson)) {
  blockers.push(`${packagePath} ${lifecycleBlocker}`);
}

if (!progressText.includes('readiness-status-audit')) {
  warnings.push(`${progressPath} does not mention the readiness status audit yet.`);
}

let governedEvidenceChainSummary = null;
let governedEvidenceWorkingBindings = null;
if (invokedAsCli && !check) {
  const governedSourceGitSha = String(process.env.PHASE9_IOS_SOURCE_GIT_SHA ?? '');
  const governedReleaseCandidateDir = String(process.env.PHASE9_RELEASE_CANDIDATE_DIR ?? '');
  try {
    const chain = auditGovernedEvidenceChain({
      root,
      sourceGitSha: governedSourceGitSha,
      releaseCandidateDir: governedReleaseCandidateDir,
      expectedHeadSha: sourceSnapshot.headSha,
    });
    if (chain.status !== 'pass') {
      blockers.push(...chain.errors.map((error) => `Governed evidence chain is invalid: ${error}`));
    } else {
      governedEvidenceChainSummary = buildReadinessGovernedEvidenceChainSummary(chain);
      governedEvidenceWorkingBindings = captureGovernedEvidenceWorkingBindings(chain, root);
    }
  } catch {
    blockers.push(
      'Readiness generation requires valid PHASE9_IOS_SOURCE_GIT_SHA and PHASE9_RELEASE_CANDIDATE_DIR values for the governed evidence chain.',
    );
  }
}

let sourceSnapshotSummary = buildReadinessSourceSnapshotSummary({
  root,
  snapshot: sourceSnapshot,
  sourceInputPaths: readinessSourceInputPaths,
  mobileTestPaths,
  governedEvidenceChain: governedEvidenceChainSummary,
});

if (check) {
  let recordedAudit = null;
  let recordedMarkdown = '';
  try {
    if (exists(outJson)) recordedAudit = JSON.parse(read(outJson));
  } catch {
    blockers.push(`${outJson} is not valid JSON.`);
  }
  if (exists(outMd)) recordedMarkdown = read(outMd);
  const provenance = validateReadinessCommittedProvenance({
    root,
    currentHeadSha: sourceSnapshot.headSha,
    outputPaths: [outJson, outMd],
    staticInputPaths: readinessStaticInputPaths,
    recordedSourceSnapshot: recordedAudit?.sourceSnapshot ?? null,
    recordedMarkdown,
  });
  blockers.push(...provenance.blockers);
  if (provenance.expectedSourceSnapshot) {
    sourceSnapshotSummary = provenance.expectedSourceSnapshot;
  }
  const recorded = sourceSnapshotSummary?.governedEvidenceChain ?? null;
  if (validReadinessGovernedEvidenceChainSummary(recorded)) {
    try {
      const chain = auditGovernedEvidenceChain({
        root,
        sourceGitSha: recorded.sourceGitSha,
        releaseCandidateDir: recorded.releaseCandidateDir,
        expectedHeadSha: sourceSnapshot.headSha,
      });
      if (chain.status === 'pass') {
        governedEvidenceWorkingBindings = captureGovernedEvidenceWorkingBindings(chain, root);
      }
    } catch {
      governedEvidenceWorkingBindings = null;
    }
  }
}

const audit = {
  generatedAt: new Date().toISOString(),
  sourceSnapshot: sourceSnapshotSummary,
  launchContract: launchContractSnapshot(launchContract),
  platformStatus: {
    ios: platformRequirementStatus('ios', launchContract),
    android: platformRequirementStatus('android', launchContract),
  },
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Audit the governed S-to-E evidence chain and exact generated tail through readiness source R, bind committed source inputs to R, then require one final readiness-only child F.',
  evidenceDate,
  humanE2eManifestPath,
  cat07ShelfFreshnessGateContract: {
    expected: cat07ShelfFreshnessGateContract,
    actual: cat07ShelfFreshnessGate,
    failures: cat07ShelfFreshnessGateFailures,
  },
  expectedMobileTestFiles,
  expectedMobileTests,
  actualMobileTestFiles,
  expectedTestPhrase,
  docs: docResults,
  requiredLaunchCommands,
  requiredPackageScripts,
  requiredLaunchVerifyScriptParts,
  summary: {
    blockerCount: blockers.length,
    warningCount: warnings.length,
    checkedDocCount: docResults.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;

const mdContent = [
  '# Readiness Status Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  `Provenance contract: ${audit.sourceSnapshot.provenanceContract}`,
  `Pinned HEAD: ${audit.sourceSnapshot.headSha}`,
  `Governed build source: ${audit.sourceSnapshot.governedEvidenceChain?.sourceGitSha ?? 'invalid'}`,
  `Governed evidence commit: ${audit.sourceSnapshot.governedEvidenceChain?.evidenceCommitSha ?? 'invalid'}`,
  `Governed release candidate: ${audit.sourceSnapshot.governedEvidenceChain?.releaseCandidateDir ?? 'invalid'}`,
  `Governed ledger: ${audit.sourceSnapshot.governedEvidenceChain?.ledgerPath ?? 'invalid'}`,
  `Governed ledger SHA-256: ${audit.sourceSnapshot.governedEvidenceChain?.ledgerSha256 ?? 'invalid'}`,
  `NUL Git status SHA-256: ${audit.sourceSnapshot.gitStatusSha256}`,
  `Source-input inventory SHA-256: ${audit.sourceSnapshot.inputInventorySha256}`,
  `Input SHA snapshot: ${sha256(Buffer.from(JSON.stringify(audit.sourceSnapshot.inputSha256), 'utf8'))}`,
  `Mobile test inventory SHA-256: ${audit.sourceSnapshot.mobileTestInventorySha256}`,
  '',
  'This generated audit keeps the launch source-of-truth docs aligned with',
  'the latest committed human-simulated E2E evidence and current verification',
  'baseline. It intentionally checks documentation freshness only; it does not',
  'replace the launch gates, physical-device QA, live Supabase, RevenueCat,',
  'store, legal, clinical, beta, or launch signoff evidence.',
  'A pass requires zero output-excluded Git status entries and every bounded',
  'working input byte-for-byte equal to its pinned-HEAD blob.',
  'It also requires one immutable governed evidence commit E, an exact',
  'allowlisted generated tail through R, and one final readiness-only child F.',
  `Required release platforms: ${launchContract.release.platforms.join(', ')}. Android release evidence: ${platformRequirementStatus('android', launchContract)}.`,
  '',
  '## Summary',
  '',
  `- Evidence date: ${audit.evidenceDate || 'missing'}`,
  `- CAT07 Shelf freshness manifest gate: ${audit.cat07ShelfFreshnessGateContract.failures.length === 0 ? 'pass' : 'blocked'}`,
  `- Expected mobile test baseline: ${audit.expectedTestPhrase}`,
  `- Actual mobile test files found: ${audit.actualMobileTestFiles}`,
  `- Blockers: ${audit.summary.blockerCount}`,
  `- Warnings: ${audit.summary.warningCount}`,
  '',
  '## Docs',
  '',
  markdownTable(
    [
      'Doc',
      'Date',
      'Expected date',
      'Current test phrase',
      'Manifest evidence',
      'Stale patterns',
      'Missing commands',
    ],
    docResults.map((doc) => [
      doc.path,
      doc.requireCurrentEvidence ? (doc.date ?? 'missing') : 'n/a',
      doc.requireCurrentEvidence ? doc.expectedDate || 'missing' : 'n/a',
      doc.requireCurrentEvidence ? (doc.hasExpectedTestPhrase ? 'yes' : 'no') : 'n/a',
      doc.requireCurrentEvidence ? (doc.missingManifestNeedles.length === 0 ? 'yes' : 'no') : 'n/a',
      doc.requireCurrentEvidence ? doc.stalePatterns.length : 'n/a',
      doc.missingCommands.length,
    ]),
  ),
  '',
  '## Required Launch Commands',
  '',
  ...requiredLaunchCommands.map((command) => `- \`${command}\``),
  '',
  '## Blockers',
  '',
  ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length > 0 ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
  '',
].join('\n');

function inventoryStabilityErrors() {
  try {
    const current = listReadinessMobileTestFiles(root);
    return current.length === mobileTestPaths.length &&
      current.every((repoPath, index) => repoPath === mobileTestPaths[index])
      ? []
      : ['mobile test-file inventory changed during readiness audit publication'];
  } catch {
    return ['mobile test-file inventory could not be rechecked during readiness audit publication'];
  }
}

function governedEvidenceChainStabilityErrors() {
  const recorded = sourceSnapshotSummary?.governedEvidenceChain ?? null;
  if (!validReadinessGovernedEvidenceChainSummary(recorded)) {
    return ['governed evidence-chain binding is unavailable during readiness publication'];
  }
  try {
    const chain = auditGovernedEvidenceChain({
      root,
      sourceGitSha: recorded.sourceGitSha,
      releaseCandidateDir: recorded.releaseCandidateDir,
      expectedHeadSha: sourceSnapshot.headSha,
    });
    if (chain.status !== 'pass') {
      return chain.errors.map((error) => `governed evidence chain changed: ${error}`);
    }
    const current = {
      ...buildReadinessGovernedEvidenceChainSummary(chain, {
        allowFinalReadinessCommit: check,
      }),
      readinessSourceHeadSha: recorded.readinessSourceHeadSha,
    };
    const errors = sameJsonValue(current, recorded)
      ? []
      : ['governed evidence-chain binding changed during readiness publication'];
    errors.push(...governedEvidenceWorkingBindingStabilityErrors());
    return errors;
  } catch {
    return ['governed evidence chain could not be rechecked during readiness publication'];
  }
}

function governedEvidenceWorkingBindingStabilityErrors() {
  return verifyGovernedEvidenceWorkingBindings(governedEvidenceWorkingBindings, root, {
    context: 'readiness audit publication',
  });
}

if (invokedAsCli) {
  if (check) {
    const jsonCurrent = checkGeneratedFile(outJson, jsonContent, normalizeGeneratedJson);
    const mdCurrent = checkGeneratedFile(outMd, mdContent, normalizeGeneratedMarkdown);
    const finalSnapshotCheck = verifyReadinessStatusSnapshot(sourceSnapshot);
    finalSnapshotCheck.errors.push(...inventoryStabilityErrors());
    finalSnapshotCheck.errors.push(...governedEvidenceChainStabilityErrors());
    if (finalSnapshotCheck.errors.length > 0) {
      console.error('FAIL Readiness status audit inputs drifted during check mode.');
      process.exit(1);
    }
    if (blockers.length > 0) {
      for (const blocker of blockers) console.error(`FAIL ${blocker}`);
      process.exit(1);
    }
    if (!jsonCurrent || !mdCurrent) process.exit(1);
    if (strict && warnings.length > 0) {
      for (const warning of warnings) console.warn(`WARN ${warning}`);
    }
    console.log('Readiness status audit is current.');
    console.log('Readiness status audit passed.');
    process.exit(0);
  }

  try {
    const prePublicationChainErrors = governedEvidenceChainStabilityErrors();
    if (prePublicationChainErrors.length > 0) {
      throw new Error(prePublicationChainErrors.join('; '));
    }
    atomicWriteReadinessStatusOutputs({
      root,
      snapshot: sourceSnapshot,
      jsonPath: outJson,
      mdPath: outMd,
      jsonContent,
      mdContent,
      verifyAdditional: () => [
        ...inventoryStabilityErrors(),
        ...governedEvidenceWorkingBindingStabilityErrors(),
      ],
    });
  } catch {
    console.error(
      'FAIL Readiness status audit inputs drifted or atomic output publication failed; both outputs were removed.',
    );
    process.exit(1);
  }

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outMd}`);

  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(`FAIL ${blocker}`);
    process.exit(1);
  }

  if (strict && warnings.length > 0) {
    for (const warning of warnings) console.warn(`WARN ${warning}`);
  }

  console.log('Readiness status audit passed.');
}
