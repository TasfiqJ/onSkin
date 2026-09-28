#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  auditStoreOnlyRelease,
  readStoreOnlyReleaseInputs,
} from '../optimization/store-only-release-audit.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..', '..');

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const EXPO_RUNTIME_FINGERPRINT = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BUILD_NUMBER = /^[1-9][0-9]{0,17}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const PLACEHOLDER = /\b(?:tbd|todo|unknown|pending|example|placeholder|replace[-_ ]?me)\b/i;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function object(value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path} must be an object.`);
    return {};
  }
  return value;
}

function exactKeys(value, keys, path, errors) {
  const actual = Object.keys(object(value, path, errors)).sort();
  const expected = [...keys].sort();
  if (actual.join('\0') !== expected.join('\0')) {
    errors.push(`${path} must contain exactly: ${expected.join(', ')}.`);
    return false;
  }
  return true;
}

function safeString(value, path, errors, pattern = SAFE_ID) {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    PLACEHOLDER.test(value) ||
    !pattern.test(value)
  ) {
    errors.push(`${path} is missing, placeholder, or malformed.`);
    return '';
  }
  return value;
}

function timestamp(value, path, errors, now) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    errors.push(`${path} must be a canonical UTC timestamp.`);
    return null;
  }
  const parsed = Date.parse(value);
  const canonicalInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== canonicalInput) {
    errors.push(`${path} must be a real canonical UTC timestamp.`);
    return null;
  }
  if (parsed > now) errors.push(`${path} must not be in the future.`);
  if (now - parsed > MAX_AGE_MS)
    errors.push(`${path} is older than the 30-day IOS-11 drill window.`);
  return parsed;
}

function exactStringSet(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return [];
  }
  const result = value.map((entry, index) => safeString(entry, `${path}[${index}]`, errors));
  if (result.some((entry) => !entry)) return result;
  if (new Set(result).size !== result.length) errors.push(`${path} must not contain duplicates.`);
  if ([...result].sort().join('\0') !== result.join('\0')) {
    errors.push(`${path} must be sorted for deterministic review.`);
  }
  return result;
}

function sameSet(left, right) {
  return [...left].sort().join('\0') === [...right].sort().join('\0');
}

function buildNumberInventory(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return [];
  }
  const result = value.map((entry, index) =>
    safeString(entry, `${path}[${index}]`, errors, BUILD_NUMBER),
  );
  if (result.some((entry) => !entry)) return result;
  if (new Set(result).size !== result.length) errors.push(`${path} must not contain duplicates.`);
  for (let index = 1; index < result.length; index += 1) {
    if (BigInt(result[index - 1]) >= BigInt(result[index])) {
      errors.push(`${path} must be in strictly increasing numeric order.`);
      break;
    }
  }
  return result;
}

export function auditIos11SourceReadiness(inputs = readStoreOnlyReleaseInputs()) {
  const result = auditStoreOnlyRelease(inputs);
  if (result.clientDelivery !== 'store-build-only' || result.easUpdateEnabled !== false) {
    throw new Error('IOS-11 source readiness requires store-only client delivery.');
  }
  return {
    ...result,
    status: 'source-ready',
    ios11Complete: false,
    acceptanceBoundary:
      'Signed staging halt, reviewed containment, hotfix, and supported-binary evidence remain required.',
  };
}

export function validateIos11ReleaseContainmentEvidence(
  input,
  { now = Date.now(), expectedSourceGitSha = '' } = {},
) {
  const errors = [];
  const evidence = object(input, 'evidence', errors);
  exactKeys(
    evidence,
    [
      'schemaVersion',
      'status',
      'releaseCandidate',
      'releaseHalt',
      'serverContainment',
      'supportedBinaryPolicy',
      'supportedBinaries',
      'hotfix',
      'review',
    ],
    'evidence',
    errors,
  );
  if (evidence.schemaVersion !== 1) errors.push('evidence.schemaVersion must be 1.');
  if (evidence.status !== 'completed') errors.push('evidence.status must be completed.');

  const candidate = object(evidence.releaseCandidate, 'evidence.releaseCandidate', errors);
  exactKeys(
    candidate,
    [
      'sourceGitSha',
      'easBuildId',
      'artifactSha256',
      'runtimeFingerprint',
      'appVersion',
      'buildNumber',
    ],
    'evidence.releaseCandidate',
    errors,
  );
  const sourceGitSha = safeString(
    candidate.sourceGitSha,
    'releaseCandidate.sourceGitSha',
    errors,
    SHA40,
  );
  const candidateBuildId = safeString(
    candidate.easBuildId,
    'releaseCandidate.easBuildId',
    errors,
    UUID,
  );
  const candidateArtifact = safeString(
    candidate.artifactSha256,
    'releaseCandidate.artifactSha256',
    errors,
    SHA256,
  );
  const candidateRuntime = safeString(
    candidate.runtimeFingerprint,
    'releaseCandidate.runtimeFingerprint',
    errors,
    EXPO_RUNTIME_FINGERPRINT,
  );
  safeString(candidate.appVersion, 'releaseCandidate.appVersion', errors, /^\d+\.\d+\.\d+$/);
  const candidateBuild = safeString(
    candidate.buildNumber,
    'releaseCandidate.buildNumber',
    errors,
    BUILD_NUMBER,
  );
  if (expectedSourceGitSha && sourceGitSha !== expectedSourceGitSha) {
    errors.push('releaseCandidate.sourceGitSha must match the exact checked-out source revision.');
  }

  const halt = object(evidence.releaseHalt, 'evidence.releaseHalt', errors);
  exactKeys(
    halt,
    [
      'environment',
      'incidentId',
      'declaredAt',
      'confirmedAt',
      'expansionFrozen',
      'buildSelectionBlocked',
      'submissionBlocked',
      'marketingBlocked',
      'independentReadback',
      'receiptSha256',
    ],
    'evidence.releaseHalt',
    errors,
  );
  if (halt.environment !== 'staging') errors.push('releaseHalt.environment must be staging.');
  safeString(halt.incidentId, 'releaseHalt.incidentId', errors);
  const declaredAt = timestamp(halt.declaredAt, 'releaseHalt.declaredAt', errors, now);
  const haltConfirmedAt = timestamp(halt.confirmedAt, 'releaseHalt.confirmedAt', errors, now);
  if (declaredAt !== null && haltConfirmedAt !== null && haltConfirmedAt < declaredAt) {
    errors.push('releaseHalt.confirmedAt must not precede declaredAt.');
  }
  for (const field of [
    'expansionFrozen',
    'buildSelectionBlocked',
    'submissionBlocked',
    'marketingBlocked',
    'independentReadback',
  ]) {
    if (halt[field] !== true) errors.push(`releaseHalt.${field} must be true.`);
  }
  safeString(halt.receiptSha256, 'releaseHalt.receiptSha256', errors, SHA256);

  const containment = object(evidence.serverContainment, 'evidence.serverContainment', errors);
  exactKeys(
    containment,
    [
      'faultDomain',
      'mechanismId',
      'activatedAt',
      'confirmedAt',
      'reviewedBeforeDrill',
      'failClosed',
      'independentReadback',
      'affectedFlows',
      'receiptSha256',
    ],
    'evidence.serverContainment',
    errors,
  );
  if (
    !['function', 'feature_flag', 'job', 'forward_migration', 'provider'].includes(
      containment.faultDomain,
    )
  ) {
    errors.push('serverContainment.faultDomain is not an approved containment class.');
  }
  safeString(containment.mechanismId, 'serverContainment.mechanismId', errors);
  const activatedAt = timestamp(
    containment.activatedAt,
    'serverContainment.activatedAt',
    errors,
    now,
  );
  const containmentConfirmedAt = timestamp(
    containment.confirmedAt,
    'serverContainment.confirmedAt',
    errors,
    now,
  );
  if (activatedAt !== null && declaredAt !== null && activatedAt < declaredAt) {
    errors.push('serverContainment.activatedAt must not precede the release halt.');
  }
  if (
    activatedAt !== null &&
    containmentConfirmedAt !== null &&
    containmentConfirmedAt < activatedAt
  ) {
    errors.push('serverContainment.confirmedAt must not precede activatedAt.');
  }
  for (const field of ['reviewedBeforeDrill', 'failClosed', 'independentReadback']) {
    if (containment[field] !== true) errors.push(`serverContainment.${field} must be true.`);
  }
  const affectedFlows = exactStringSet(
    containment.affectedFlows,
    'serverContainment.affectedFlows',
    errors,
  );
  safeString(containment.receiptSha256, 'serverContainment.receiptSha256', errors, SHA256);

  const policy = object(evidence.supportedBinaryPolicy, 'evidence.supportedBinaryPolicy', errors);
  exactKeys(
    policy,
    [
      'inventoryComplete',
      'minimumSupportedBuildNumber',
      'maximumSupportedBuildNumber',
      'supportedBuildNumbers',
      'capturedAt',
    ],
    'evidence.supportedBinaryPolicy',
    errors,
  );
  if (policy.inventoryComplete !== true) {
    errors.push('supportedBinaryPolicy.inventoryComplete must be true.');
  }
  const minimumBuild = safeString(
    policy.minimumSupportedBuildNumber,
    'supportedBinaryPolicy.minimumSupportedBuildNumber',
    errors,
    BUILD_NUMBER,
  );
  const maximumBuild = safeString(
    policy.maximumSupportedBuildNumber,
    'supportedBinaryPolicy.maximumSupportedBuildNumber',
    errors,
    BUILD_NUMBER,
  );
  if (minimumBuild && maximumBuild && BigInt(minimumBuild) > BigInt(maximumBuild)) {
    errors.push('supportedBinaryPolicy build-number bounds are inverted.');
  }
  const supportedBuildNumbers = buildNumberInventory(
    policy.supportedBuildNumbers,
    'supportedBinaryPolicy.supportedBuildNumbers',
    errors,
  );
  if (
    supportedBuildNumbers.length > 0 &&
    (supportedBuildNumbers[0] !== minimumBuild || supportedBuildNumbers.at(-1) !== maximumBuild)
  ) {
    errors.push(
      'supportedBinaryPolicy bounds must exactly match the supportedBuildNumbers endpoints.',
    );
  }
  timestamp(policy.capturedAt, 'supportedBinaryPolicy.capturedAt', errors, now);

  const binaries = Array.isArray(evidence.supportedBinaries) ? evidence.supportedBinaries : [];
  if (binaries.length < 2) {
    errors.push('supportedBinaries must include the affected binary and the hotfix candidate.');
  }
  const seenBuilds = new Set();
  let candidateSeen = false;
  for (const [index, rawBinary] of binaries.entries()) {
    const path = `supportedBinaries[${index}]`;
    const binary = object(rawBinary, path, errors);
    exactKeys(
      binary,
      [
        'buildNumber',
        'sourceGitSha',
        'easBuildId',
        'artifactSha256',
        'runtimeFingerprint',
        'role',
        'containmentActive',
        'noOtaPath',
        'testedFlows',
        'result',
        'receiptSha256',
      ],
      path,
      errors,
    );
    const buildNumber = safeString(binary.buildNumber, `${path}.buildNumber`, errors, BUILD_NUMBER);
    safeString(binary.sourceGitSha, `${path}.sourceGitSha`, errors, SHA40);
    safeString(binary.easBuildId, `${path}.easBuildId`, errors, UUID);
    safeString(binary.artifactSha256, `${path}.artifactSha256`, errors, SHA256);
    safeString(
      binary.runtimeFingerprint,
      `${path}.runtimeFingerprint`,
      errors,
      EXPO_RUNTIME_FINGERPRINT,
    );
    if (!['affected', 'hotfix'].includes(binary.role)) errors.push(`${path}.role is invalid.`);
    if (binary.containmentActive !== true) errors.push(`${path}.containmentActive must be true.`);
    if (binary.noOtaPath !== true) errors.push(`${path}.noOtaPath must be true.`);
    const testedFlows = exactStringSet(binary.testedFlows, `${path}.testedFlows`, errors);
    if (!sameSet(testedFlows, affectedFlows)) {
      errors.push(`${path}.testedFlows must exactly cover serverContainment.affectedFlows.`);
    }
    if (binary.result !== 'pass') errors.push(`${path}.result must be pass.`);
    safeString(binary.receiptSha256, `${path}.receiptSha256`, errors, SHA256);
    if (seenBuilds.has(buildNumber)) errors.push('supportedBinaries build numbers must be unique.');
    seenBuilds.add(buildNumber);
    if (buildNumber && minimumBuild && maximumBuild) {
      const value = BigInt(buildNumber);
      if (value < BigInt(minimumBuild) || value > BigInt(maximumBuild)) {
        errors.push(`${path}.buildNumber is outside the declared supported range.`);
      }
    }
    if (
      binary.role === 'affected' &&
      buildNumber === candidateBuild &&
      binary.sourceGitSha === sourceGitSha &&
      binary.easBuildId === candidateBuildId &&
      binary.artifactSha256 === candidateArtifact &&
      binary.runtimeFingerprint === candidateRuntime
    ) {
      candidateSeen = true;
    }
  }
  if (!candidateSeen) {
    errors.push('supportedBinaries must contain the exact affected release candidate identity.');
  }
  const observedBuildNumbers = binaries
    .map((binary) => binary?.buildNumber)
    .filter((buildNumber) => BUILD_NUMBER.test(buildNumber ?? ''))
    .sort((left, right) =>
      BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0,
    );
  if (observedBuildNumbers.join('\0') !== supportedBuildNumbers.join('\0')) {
    errors.push(
      'supportedBinaries build numbers must exactly match supportedBinaryPolicy.supportedBuildNumbers.',
    );
  }

  const hotfix = object(evidence.hotfix, 'evidence.hotfix', errors);
  exactKeys(
    hotfix,
    [
      'sourceGitSha',
      'easBuildId',
      'artifactSha256',
      'runtimeFingerprint',
      'buildNumber',
      'storeBinaryOnly',
      'otaPublished',
      'testedWithContainmentOn',
      'testedWithContainmentOff',
      'readyForStoreReview',
      'receiptSha256',
    ],
    'evidence.hotfix',
    errors,
  );
  const hotfixSha = safeString(hotfix.sourceGitSha, 'hotfix.sourceGitSha', errors, SHA40);
  const hotfixBuildId = safeString(hotfix.easBuildId, 'hotfix.easBuildId', errors, UUID);
  const hotfixArtifact = safeString(hotfix.artifactSha256, 'hotfix.artifactSha256', errors, SHA256);
  const hotfixRuntime = safeString(
    hotfix.runtimeFingerprint,
    'hotfix.runtimeFingerprint',
    errors,
    EXPO_RUNTIME_FINGERPRINT,
  );
  const hotfixBuild = safeString(hotfix.buildNumber, 'hotfix.buildNumber', errors, BUILD_NUMBER);
  if (hotfixSha && hotfixSha === sourceGitSha)
    errors.push('hotfix.sourceGitSha must differ from the affected source.');
  if (hotfixBuild && candidateBuild && BigInt(hotfixBuild) <= BigInt(candidateBuild)) {
    errors.push('hotfix.buildNumber must be greater than the affected build number.');
  }
  if (hotfix.storeBinaryOnly !== true) errors.push('hotfix.storeBinaryOnly must be true.');
  if (hotfix.otaPublished !== false) errors.push('hotfix.otaPublished must be false.');
  for (const field of [
    'testedWithContainmentOn',
    'testedWithContainmentOff',
    'readyForStoreReview',
  ]) {
    if (hotfix[field] !== true) errors.push(`hotfix.${field} must be true.`);
  }
  safeString(hotfix.receiptSha256, 'hotfix.receiptSha256', errors, SHA256);
  const hotfixBinary = binaries.find((binary) => binary?.role === 'hotfix');
  if (
    !hotfixBinary ||
    hotfixBinary.sourceGitSha !== hotfixSha ||
    hotfixBinary.easBuildId !== hotfixBuildId ||
    hotfixBinary.artifactSha256 !== hotfixArtifact ||
    hotfixBinary.runtimeFingerprint !== hotfixRuntime ||
    hotfixBinary.buildNumber !== hotfixBuild
  ) {
    errors.push('The hotfix entry must exactly match the supported-binary hotfix row.');
  }

  const review = object(evidence.review, 'evidence.review', errors);
  exactKeys(
    review,
    ['releaseManager', 'serverOwner', 'independentReviewer', 'reviewedAt'],
    'evidence.review',
    errors,
  );
  const owners = [
    safeString(
      review.releaseManager,
      'review.releaseManager',
      errors,
      /^[A-Za-z][A-Za-z .'-]{2,79}$/,
    ),
    safeString(review.serverOwner, 'review.serverOwner', errors, /^[A-Za-z][A-Za-z .'-]{2,79}$/),
    safeString(
      review.independentReviewer,
      'review.independentReviewer',
      errors,
      /^[A-Za-z][A-Za-z .'-]{2,79}$/,
    ),
  ];
  if (owners.every(Boolean) && new Set(owners.map((owner) => owner.toLowerCase())).size !== 3) {
    errors.push('review roles must name three distinct people.');
  }
  const reviewedAt = timestamp(review.reviewedAt, 'review.reviewedAt', errors, now);
  if (
    reviewedAt !== null &&
    containmentConfirmedAt !== null &&
    reviewedAt < containmentConfirmedAt
  ) {
    errors.push('review.reviewedAt must not precede containment confirmation.');
  }

  return {
    status: errors.length === 0 ? 'pass' : 'fail',
    ios11Complete: errors.length === 0,
    errors,
    summary: {
      sourceGitSha,
      candidateBuild,
      hotfixBuild,
      supportedBinaryCount: binaries.length,
      affectedFlowCount: affectedFlows.length,
    },
  };
}

function assertSourceRevisionExistsAndIsAncestor(sourceGitSha) {
  execFileSync('git', ['cat-file', '-e', `${sourceGitSha}^{commit}`], {
    cwd: repositoryRoot,
    stdio: 'ignore',
    windowsHide: true,
  });
  execFileSync('git', ['merge-base', '--is-ancestor', sourceGitSha, 'HEAD'], {
    cwd: repositoryRoot,
    stdio: 'ignore',
    windowsHide: true,
  });
}

function run(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === '--source-check')) {
    process.stdout.write(`${JSON.stringify(auditIos11SourceReadiness(), null, 2)}\n`);
    return;
  }
  if (
    argv.length !== 4 ||
    argv[0] !== '--evidence' ||
    argv[2] !== '--expected-source-sha' ||
    !SHA40.test(argv[3])
  ) {
    throw new Error(
      'Usage: node scripts/phase9/ios11-release-containment-contract.mjs [--source-check | --evidence path --expected-source-sha sha]',
    );
  }
  const evidencePath = resolve(repositoryRoot, argv[1]);
  const expectedSourceGitSha = argv[3];
  assertSourceRevisionExistsAndIsAncestor(expectedSourceGitSha);
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const result = validateIos11ReleaseContainmentEvidence(evidence, {
    expectedSourceGitSha,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
