import { platformRequirementStatus } from '../launch/contract.mjs';

export const RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION = 1;
export const RELEASE_ARTIFACT_RECEIPT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const SHA256 = /^[0-9a-f]{64}$/i;
const GIT_SHA = /^[0-9a-f]{40}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EAS_BUILD_URL =
  /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[?#].*)?$/i;
const RELEASE_ID = /^[A-Za-z0-9._+@-]{3,128}$/;
const DIST_ID = /^[A-Za-z0-9._+-]{1,64}$/;
const BUNDLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)+$/;
const APP_VERSION = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;
const BUILD_NUMBER = /^[1-9]\d{0,8}$/;
const RUNTIME_VERSION = /^[A-Za-z0-9._+-]{1,128}$/;
const APPLE_TEAM_IDENTIFIER = /^[A-Z0-9]{10}$/;
const RECEIPT_ID = /^[A-Za-z0-9._:-]{16,160}$/;
const SENTRY_EVENT_ID = /^[0-9a-f]{32}$/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeUuid(value) {
  return normalize(value).toLowerCase();
}

function normalizeBuildId(value) {
  const candidate = normalize(value);
  if (UUID.test(candidate)) return candidate.toLowerCase();
  return candidate.match(EAS_BUILD_URL)?.[1]?.toLowerCase() ?? '';
}

function markdownTableValue(source, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    String(source ?? '')
      .match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\s*\\|\\s*$`, 'im'))?.[1]
      ?.trim() ?? ''
  );
}

export function parseReleaseManifestIdentity(source) {
  const versionBuild = markdownTableValue(source, 'App version/build').match(
    /^([^\s/]+)\s*\/\s*([^\s/]+)$/,
  );
  return {
    iosBuildId: markdownTableValue(source, 'iOS build ID'),
    bundleIdentifier: markdownTableValue(source, 'Bundle ID'),
    appVersion: versionBuild?.[1] ?? '',
    buildNumber: versionBuild?.[2] ?? '',
    runtimeVersion: markdownTableValue(source, 'Runtime version'),
    signingTeamIdentifier: markdownTableValue(source, 'Signing team ID'),
    artifactContract: markdownTableValue(source, 'Artifact contract'),
  };
}

function exactKeys(value, expected, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join('\0') !== wanted.join('\0')) {
    errors.push(`${path} must contain exactly: ${wanted.join(', ')}.`);
    return false;
  }
  return true;
}

function requireSha256(value, path, errors) {
  if (!SHA256.test(normalize(value)) || /^0{64}$/i.test(normalize(value))) {
    errors.push(`${path} must be a non-zero SHA-256 digest.`);
    return '';
  }
  return normalize(value).toLowerCase();
}

function requireUuid(value, path, errors) {
  if (!UUID.test(normalize(value))) {
    errors.push(`${path} must be a UUID.`);
    return '';
  }
  return normalizeUuid(value);
}

function requireTimestamp(value, path, errors) {
  const candidate = normalize(value);
  const parsed = Date.parse(candidate);
  if (!candidate || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== candidate) {
    errors.push(`${path} must be a canonical ISO timestamp.`);
    return null;
  }
  return parsed;
}

function compareHash(expected, actual, label, errors) {
  const normalizedExpected = requireSha256(expected, label, errors);
  const normalizedActual = normalize(actual).toLowerCase();
  if (!SHA256.test(normalizedActual) || /^0{64}$/i.test(normalizedActual)) {
    errors.push(`${label} requires the SHA-256 digest of the supplied file.`);
  } else if (normalizedExpected && normalizedExpected !== normalizedActual) {
    errors.push(`${label} must match the supplied file.`);
  }
}

function validateStringSafety(value, path, errors) {
  if (typeof value === 'string') {
    const candidate = value.trim();
    if (
      /https?:\/\//i.test(candidate) ||
      /(?:^|\s)[A-Za-z]:[\\/]/.test(candidate) ||
      /(?:^|\s)\/(?:Users|home|var|tmp|private)\//i.test(candidate) ||
      /(?:dsn|token|secret|password|authorization|cookie|stacktrace|stack_trace|raw_stack)/i.test(
        candidate,
      ) ||
      /(?:sntrys_|phx_|Bearer\s+|-----BEGIN\s)/i.test(candidate) ||
      EMAIL.test(candidate)
    ) {
      errors.push(`${path} contains a URL, path, credential, or raw diagnostic payload.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateStringSafety(item, `${path}[${index}]`, errors));
    return;
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (
        /(?:dsn|token|secret|password|authorization|cookie|username|email|stack|exception|request|url|path)/i.test(
          key,
        )
      ) {
        errors.push(`${path}.${key} is not an allowed content-free evidence field.`);
      }
      validateStringSafety(item, `${path}.${key}`, errors);
    }
  }
}

function validateUuidList(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must contain at least one UUID.`);
    return [];
  }
  const uuids = value.map((item, index) => requireUuid(item, `${path}[${index}]`, errors));
  if (new Set(uuids.filter(Boolean)).size !== uuids.filter(Boolean).length) {
    errors.push(`${path} must not contain duplicate UUIDs.`);
  }
  return uuids.filter(Boolean).sort();
}

function validateIdentityAttachment(attachment, kind, path, errors, multiple = false) {
  const valueKey = multiple ? 'uuids' : 'uuid';
  if (!exactKeys(attachment, ['schemaVersion', 'kind', valueKey], path, errors)) return [];
  if (attachment.schemaVersion !== RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`${path}.schemaVersion must be ${RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION}.`);
  }
  if (attachment.kind !== kind) errors.push(`${path}.kind must be ${kind}.`);
  return multiple
    ? validateUuidList(attachment.uuids, `${path}.uuids`, errors)
    : [requireUuid(attachment.uuid, `${path}.uuid`, errors)].filter(Boolean);
}

function validateReceipt(
  receipt,
  {
    kind,
    status,
    path,
    gitSha,
    buildId,
    release,
    dist,
    binaryUuids,
    dsymUuids,
    hermesDebugId,
    now,
    maxAgeMs,
  },
  errors,
) {
  const identifierKeys =
    status === 'uploaded' ? ['receiptId'] : ['javascriptEventId', 'nativeEventId'];
  if (
    !exactKeys(
      receipt,
      [
        'schemaVersion',
        'kind',
        'platform',
        'gitSha',
        'buildId',
        'release',
        'dist',
        'binaryUuids',
        'dsymUuids',
        'hermesDebugId',
        ...identifierKeys,
        'recordedAt',
        'status',
      ],
      path,
      errors,
    )
  ) {
    return { identifiers: {}, recordedAt: null };
  }

  if (receipt.schemaVersion !== RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`${path}.schemaVersion must be ${RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION}.`);
  }
  if (receipt.kind !== kind) errors.push(`${path}.kind must be ${kind}.`);
  if (receipt.platform !== 'ios') errors.push(`${path}.platform must be ios.`);
  if (receipt.status !== status) errors.push(`${path}.status must be ${status}.`);
  if (normalize(receipt.gitSha).toLowerCase() !== gitSha) {
    errors.push(`${path}.gitSha must match the release candidate.`);
  }
  if (normalizeBuildId(receipt.buildId) !== buildId) {
    errors.push(`${path}.buildId must match the iOS EAS build.`);
  }
  if (normalize(receipt.release) !== release) {
    errors.push(`${path}.release must match the Sentry release.`);
  }
  if (normalize(receipt.dist) !== dist) errors.push(`${path}.dist must match the Sentry dist.`);
  const receiptBinaryUuids = validateUuidList(receipt.binaryUuids, `${path}.binaryUuids`, errors);
  if (receiptBinaryUuids.join('\0') !== binaryUuids.join('\0')) {
    errors.push(`${path}.binaryUuids must match the app Mach-O UUID inventory.`);
  }
  const receiptDsymUuids = validateUuidList(receipt.dsymUuids, `${path}.dsymUuids`, errors);
  if (receiptDsymUuids.join('\0') !== dsymUuids.join('\0')) {
    errors.push(`${path}.dsymUuids must match the dSYM UUID inventory.`);
  }
  if (normalizeUuid(receipt.hermesDebugId) !== hermesDebugId) {
    errors.push(`${path}.hermesDebugId must match the Hermes source-map debug ID.`);
  }

  const identifiers = Object.fromEntries(
    identifierKeys.map((identifierKey) => [identifierKey, normalize(receipt[identifierKey])]),
  );
  for (const [identifierKey, identifier] of Object.entries(identifiers)) {
    const valid =
      identifierKey === 'receiptId'
        ? RECEIPT_ID.test(identifier)
        : SENTRY_EVENT_ID.test(identifier);
    if (!valid) {
      errors.push(`${path}.${identifierKey} must be a real content-free receipt identifier.`);
    }
  }
  const recordedAt = requireTimestamp(receipt.recordedAt, `${path}.recordedAt`, errors);
  if (recordedAt !== null) {
    if (recordedAt > now) errors.push(`${path}.recordedAt must not be in the future.`);
    if (now - recordedAt > maxAgeMs) {
      errors.push(`${path}.recordedAt is older than the ${maxAgeMs / 86_400_000}-day RC window.`);
    }
  }
  return { identifiers, recordedAt };
}

export function validateReleaseArtifactEvidence(
  evidence,
  {
    currentGitSha = '',
    performanceEvidence = null,
    performanceEvidenceSha256 = '',
    artifactHashes = {},
    attachments = {},
    inspectedIdentities = {},
    providerVerification = null,
    manifestIdentity = {},
    launchContract,
    now = Date.now(),
    receiptMaxAgeMs = RELEASE_ARTIFACT_RECEIPT_MAX_AGE_MS,
  } = {},
) {
  const errors = [];
  const warnings = [];
  validateStringSafety(evidence, 'evidence', errors);
  validateStringSafety(attachments, 'attachments', errors);

  if (
    !exactKeys(
      evidence,
      ['schemaVersion', 'gitSha', 'performanceEvidence', 'ios', 'android'],
      'evidence',
      errors,
    )
  ) {
    return { errors, warnings };
  }
  if (evidence.schemaVersion !== RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${RELEASE_ARTIFACT_EVIDENCE_SCHEMA_VERSION}.`);
  }

  const gitSha = normalize(evidence.gitSha).toLowerCase();
  if (!GIT_SHA.test(gitSha)) errors.push('gitSha must be a 40-character commit SHA.');
  if (currentGitSha && gitSha !== normalize(currentGitSha).toLowerCase()) {
    errors.push('gitSha must match the clean commit being verified.');
  }

  if (
    exactKeys(
      evidence.performanceEvidence,
      ['sha256', 'gitSha', 'iosBuildId'],
      'performanceEvidence',
      errors,
    )
  ) {
    compareHash(
      evidence.performanceEvidence.sha256,
      performanceEvidenceSha256 || artifactHashes.performanceEvidence,
      'performanceEvidence.sha256',
      errors,
    );
    if (normalize(evidence.performanceEvidence.gitSha).toLowerCase() !== gitSha) {
      errors.push('performanceEvidence.gitSha must match the release candidate.');
    }
    if (normalize(performanceEvidence?.gitSha).toLowerCase() !== gitSha) {
      errors.push('The attached performance evidence gitSha must match the release candidate.');
    }
  }

  const iosExpectedStatus = launchContract
    ? platformRequirementStatus('ios', launchContract)
    : 'required';
  const androidExpectedStatus = launchContract
    ? platformRequirementStatus('android', launchContract)
    : 'not_applicable';
  if (iosExpectedStatus !== 'required') {
    errors.push('This contract requires iOS to be an active release platform.');
  }
  if (androidExpectedStatus === 'required') {
    errors.push(
      'Android is now release-required; add a versioned Android mapping/native-symbol/deobfuscation evidence branch before release.',
    );
  }
  if (!exactKeys(evidence.android, ['status'], 'android', errors)) {
    // exactKeys records the blocker.
  } else if (evidence.android.status !== androidExpectedStatus) {
    errors.push(`android.status must be ${androidExpectedStatus}.`);
  }

  if (
    !exactKeys(
      evidence.ios,
      [
        'status',
        'easBuildId',
        'bundleIdentifier',
        'appVersion',
        'buildNumber',
        'runtimeVersion',
        'signingTeamIdentifier',
        'release',
        'dist',
        'binary',
        'dsym',
        'hermesSourceMap',
        'sentry',
      ],
      'ios',
      errors,
    )
  ) {
    return { errors, warnings };
  }
  if (evidence.ios.status !== iosExpectedStatus) {
    errors.push(`ios.status must be ${iosExpectedStatus}.`);
  }

  const buildId = normalizeBuildId(evidence.ios.easBuildId);
  if (!buildId) errors.push('ios.easBuildId must be an EAS build UUID.');
  const performanceBuildId = normalizeBuildId(performanceEvidence?.devices?.ios?.buildId);
  const recordedPerformanceBuildId = normalizeBuildId(evidence.performanceEvidence?.iosBuildId);
  if (!performanceBuildId || performanceBuildId !== buildId) {
    errors.push('The attached performance evidence iOS build ID must match the release candidate.');
  }
  if (!recordedPerformanceBuildId || recordedPerformanceBuildId !== buildId) {
    errors.push('performanceEvidence.iosBuildId must match the release candidate.');
  }

  const bundleIdentifier = normalize(evidence.ios.bundleIdentifier);
  const appVersion = normalize(evidence.ios.appVersion);
  const buildNumber = normalize(evidence.ios.buildNumber);
  const runtimeVersion = normalize(evidence.ios.runtimeVersion);
  const signingTeamIdentifier = normalize(evidence.ios.signingTeamIdentifier);
  if (!BUNDLE_IDENTIFIER.test(bundleIdentifier)) {
    errors.push('ios.bundleIdentifier must be a reverse-DNS app identifier.');
  }
  if (!APP_VERSION.test(appVersion)) errors.push('ios.appVersion must be a semantic app version.');
  if (!BUILD_NUMBER.test(buildNumber)) {
    errors.push('ios.buildNumber must be a positive integer string.');
  }
  if (!RUNTIME_VERSION.test(runtimeVersion)) {
    errors.push('ios.runtimeVersion must be a bounded runtime identifier.');
  }
  if (!APPLE_TEAM_IDENTIFIER.test(signingTeamIdentifier)) {
    errors.push('ios.signingTeamIdentifier must be a 10-character Apple team ID.');
  }
  if (normalizeBuildId(manifestIdentity.iosBuildId) !== buildId) {
    errors.push('The RC manifest iOS build ID must match release-artifacts.json.');
  }
  if (normalize(manifestIdentity.bundleIdentifier) !== bundleIdentifier) {
    errors.push('The RC manifest Bundle ID must match release-artifacts.json.');
  }
  if (normalize(manifestIdentity.appVersion) !== appVersion) {
    errors.push('The RC manifest app version must match release-artifacts.json.');
  }
  if (normalize(manifestIdentity.buildNumber) !== buildNumber) {
    errors.push('The RC manifest build number must match release-artifacts.json.');
  }
  if (normalize(manifestIdentity.runtimeVersion) !== runtimeVersion) {
    errors.push('The RC manifest Runtime version must match release-artifacts.json.');
  }
  if (normalize(manifestIdentity.signingTeamIdentifier) !== signingTeamIdentifier) {
    errors.push('The RC manifest Signing team ID must match release-artifacts.json.');
  }
  if (normalize(manifestIdentity.artifactContract) !== 'release-artifacts.json') {
    errors.push('The RC manifest Artifact contract must be release-artifacts.json.');
  }

  const release = normalize(evidence.ios.release);
  const dist = normalize(evidence.ios.dist);
  if (!RELEASE_ID.test(release)) errors.push('ios.release must be a bounded Sentry release ID.');
  if (!DIST_ID.test(dist)) errors.push('ios.dist must be a bounded Sentry dist ID.');
  if (release !== `${bundleIdentifier}@${appVersion}+${buildNumber}`) {
    errors.push(
      'ios.release must be derived from bundle identifier, app version, and build number.',
    );
  }
  if (dist !== buildNumber) errors.push('ios.dist must equal ios.buildNumber.');

  let binaryUuids = [];
  if (
    exactKeys(evidence.ios.binary, ['sha256', 'uuids', 'uuidEvidenceSha256'], 'ios.binary', errors)
  ) {
    compareHash(evidence.ios.binary.sha256, artifactHashes.iosBinary, 'ios.binary.sha256', errors);
    binaryUuids = validateUuidList(evidence.ios.binary.uuids, 'ios.binary.uuids', errors);
    compareHash(
      evidence.ios.binary.uuidEvidenceSha256,
      artifactHashes.iosBinaryUuidEvidence,
      'ios.binary.uuidEvidenceSha256',
      errors,
    );
  }

  let dsymUuids = [];
  if (exactKeys(evidence.ios.dsym, ['sha256', 'uuids', 'uuidEvidenceSha256'], 'ios.dsym', errors)) {
    compareHash(evidence.ios.dsym.sha256, artifactHashes.iosDsymArchive, 'ios.dsym.sha256', errors);
    dsymUuids = validateUuidList(evidence.ios.dsym.uuids, 'ios.dsym.uuids', errors);
    compareHash(
      evidence.ios.dsym.uuidEvidenceSha256,
      artifactHashes.iosDsymUuidEvidence,
      'ios.dsym.uuidEvidenceSha256',
      errors,
    );
    if (binaryUuids.some((uuid) => !dsymUuids.includes(uuid))) {
      errors.push('ios.dsym.uuids must include every ios.binary.uuids entry.');
    }
  }

  let hermesDebugId = '';
  if (
    exactKeys(
      evidence.ios.hermesSourceMap,
      ['sha256', 'debugId', 'debugIdEvidenceSha256'],
      'ios.hermesSourceMap',
      errors,
    )
  ) {
    compareHash(
      evidence.ios.hermesSourceMap.sha256,
      artifactHashes.iosHermesSourceMap,
      'ios.hermesSourceMap.sha256',
      errors,
    );
    hermesDebugId = requireUuid(
      evidence.ios.hermesSourceMap.debugId,
      'ios.hermesSourceMap.debugId',
      errors,
    );
    compareHash(
      evidence.ios.hermesSourceMap.debugIdEvidenceSha256,
      artifactHashes.iosHermesDebugIdEvidence,
      'ios.hermesSourceMap.debugIdEvidenceSha256',
      errors,
    );
  }

  const identityAttachments = [
    validateIdentityAttachment(
      attachments.iosBinaryUuid,
      'ios_binary_uuids',
      'attachments.iosBinaryUuid',
      errors,
      true,
    ),
    validateIdentityAttachment(
      attachments.iosDsymUuids,
      'ios_dsym_uuids',
      'attachments.iosDsymUuids',
      errors,
      true,
    ),
    validateIdentityAttachment(
      attachments.iosHermesDebugId,
      'ios_hermes_debug_id',
      'attachments.iosHermesDebugId',
      errors,
    ),
  ];
  if (identityAttachments[0].join('\0') !== binaryUuids.join('\0')) {
    errors.push('The binary UUID attachment must match ios.binary.uuids.');
  }
  if (identityAttachments[1].join('\0') !== dsymUuids.join('\0')) {
    errors.push('The dSYM UUID attachment must match ios.dsym.uuids.');
  }
  if (identityAttachments[2][0] && identityAttachments[2][0] !== hermesDebugId) {
    errors.push('The Hermes debug-ID attachment must match ios.hermesSourceMap.debugId.');
  }
  const inspectedBinaryUuids = validateUuidList(
    inspectedIdentities.binaryUuids,
    'inspectedIdentities.binaryUuids',
    errors,
  );
  const inspectedDsymUuids = validateUuidList(
    inspectedIdentities.dsymUuids,
    'inspectedIdentities.dsymUuids',
    errors,
  );
  const inspectedHermesDebugId = requireUuid(
    inspectedIdentities.hermesDebugId,
    'inspectedIdentities.hermesDebugId',
    errors,
  );
  if (inspectedBinaryUuids.join('\0') !== binaryUuids.join('\0')) {
    errors.push('Direct Mach-O inspection must match ios.binary.uuids.');
  }
  if (inspectedDsymUuids.join('\0') !== dsymUuids.join('\0')) {
    errors.push('Direct dSYM inspection must match ios.dsym.uuids.');
  }
  if (inspectedHermesDebugId !== hermesDebugId) {
    errors.push('Direct source-map inspection must match ios.hermesSourceMap.debugId.');
  }
  for (const [field, expected] of [
    ['bundleIdentifier', bundleIdentifier],
    ['appVersion', appVersion],
    ['buildNumber', buildNumber],
    ['runtimeVersion', runtimeVersion],
    ['signingTeamIdentifier', signingTeamIdentifier],
  ]) {
    if (normalize(inspectedIdentities[field]) !== expected) {
      errors.push(`Signed IPA ${field} must match release-artifacts.json.`);
    }
  }
  if (inspectedIdentities.signatureVerified !== true) {
    errors.push('The IPA must pass Apple distribution-signature verification.');
  }
  if (inspectedIdentities.bundledSourceMapCount !== 0) {
    errors.push('The shipped iOS artifact must not contain source-map files.');
  }

  if (!exactKeys(evidence.ios.sentry, ['uploadReceipt', 'recoveryReceipt'], 'ios.sentry', errors)) {
    return { errors, warnings };
  }
  const uploadEvidence = evidence.ios.sentry.uploadReceipt;
  const recoveryEvidence = evidence.ios.sentry.recoveryReceipt;
  if (
    exactKeys(
      uploadEvidence,
      ['receiptId', 'sha256', 'recordedAt'],
      'ios.sentry.uploadReceipt',
      errors,
    )
  ) {
    compareHash(
      uploadEvidence.sha256,
      artifactHashes.iosSentryUploadReceipt,
      'ios.sentry.uploadReceipt.sha256',
      errors,
    );
  }
  if (
    exactKeys(
      recoveryEvidence,
      ['javascriptEventId', 'nativeEventId', 'sha256', 'recordedAt', 'status'],
      'ios.sentry.recoveryReceipt',
      errors,
    )
  ) {
    compareHash(
      recoveryEvidence.sha256,
      artifactHashes.iosSentryRecoveryReceipt,
      'ios.sentry.recoveryReceipt.sha256',
      errors,
    );
    if (recoveryEvidence.status !== 'symbolicated') {
      errors.push('ios.sentry.recoveryReceipt.status must be symbolicated.');
    }
  }

  const upload = validateReceipt(
    attachments.iosSentryUploadReceipt,
    {
      kind: 'sentry_artifact_upload',
      status: 'uploaded',
      path: 'attachments.iosSentryUploadReceipt',
      gitSha,
      buildId,
      release,
      dist,
      binaryUuids,
      dsymUuids,
      hermesDebugId,
      now,
      maxAgeMs: receiptMaxAgeMs,
    },
    errors,
  );
  const recovery = validateReceipt(
    attachments.iosSentryRecoveryReceipt,
    {
      kind: 'sentry_symbolication_recovery',
      status: 'symbolicated',
      path: 'attachments.iosSentryRecoveryReceipt',
      gitSha,
      buildId,
      release,
      dist,
      binaryUuids,
      dsymUuids,
      hermesDebugId,
      now,
      maxAgeMs: receiptMaxAgeMs,
    },
    errors,
  );
  if (
    recovery.identifiers.javascriptEventId &&
    recovery.identifiers.javascriptEventId === recovery.identifiers.nativeEventId
  ) {
    errors.push('JavaScript and native recovery receipts must use distinct Sentry events.');
  }
  if (
    upload.identifiers.receiptId &&
    upload.identifiers.receiptId !== normalize(uploadEvidence?.receiptId)
  ) {
    errors.push('The upload receipt attachment ID must match ios.sentry.uploadReceipt.receiptId.');
  }
  if (
    recovery.identifiers.javascriptEventId &&
    recovery.identifiers.javascriptEventId !== normalize(recoveryEvidence?.javascriptEventId)
  ) {
    errors.push('The recovery attachment JavaScript event ID must match the evidence manifest.');
  }
  if (
    recovery.identifiers.nativeEventId &&
    recovery.identifiers.nativeEventId !== normalize(recoveryEvidence?.nativeEventId)
  ) {
    errors.push('The recovery attachment native event ID must match the evidence manifest.');
  }
  if (upload.recordedAt !== null && upload.recordedAt !== Date.parse(uploadEvidence?.recordedAt)) {
    errors.push('The upload receipt attachment timestamp must match the evidence manifest.');
  }
  if (
    recovery.recordedAt !== null &&
    recovery.recordedAt !== Date.parse(recoveryEvidence?.recordedAt)
  ) {
    errors.push('The recovery receipt attachment timestamp must match the evidence manifest.');
  }
  if (
    upload.recordedAt !== null &&
    recovery.recordedAt !== null &&
    recovery.recordedAt < upload.recordedAt
  ) {
    errors.push('The symbolication recovery receipt must be recorded after the upload receipt.');
  }
  if (providerVerification?.verified !== true) {
    errors.push('Sentry recovery must be independently verified against the provider API.');
  } else {
    if (
      normalize(providerVerification.javascriptEventId) !==
      normalize(recoveryEvidence?.javascriptEventId)
    ) {
      errors.push('Provider-verified JavaScript event ID must match the recovery evidence.');
    }
    if (
      normalize(providerVerification.nativeEventId) !== normalize(recoveryEvidence?.nativeEventId)
    ) {
      errors.push('Provider-verified native event ID must match the recovery evidence.');
    }
    if (normalize(providerVerification.release) !== release) {
      errors.push('Provider-verified Sentry release must match the release candidate.');
    }
    if (normalize(providerVerification.dist) !== dist) {
      errors.push('Provider-verified Sentry dist must match the release candidate.');
    }
  }

  return { errors, warnings };
}
