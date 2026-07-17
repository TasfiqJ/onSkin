import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { extname, isAbsolute, posix, relative, resolve, sep } from 'node:path';

import { normalizeNamedSignoff, placeholderEnvValue } from '../phase9/lib.mjs';

export const WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION = 3;
export const WIDGET_LIFECYCLE_EVIDENCE_ROOT = 'docs/phase-5/evidence/widget-lifecycle/';
export const WIDGET_LIFECYCLE_SUPPORTED_FAMILIES = Object.freeze([
  'accessoryInline',
  'accessoryRectangular',
  'systemMedium',
  'systemSmall',
]);
export const WIDGET_LIFECYCLE_SCENARIO_IDS = Object.freeze([
  'archiveInspection',
  'interactionPrivacy',
  'liveActivity',
  'widgetDevice',
]);

const RAW_SIGNED_ARTIFACT_KEYS = ['appBundle', 'archive', 'extensionBundle'];
const REPORT_SIGNED_ARTIFACT_KEYS = [
  'appEntitlements',
  'appPrivacyManifest',
  'extensionEntitlements',
  'extensionPrivacyManifest',
];
const SIGNED_ARTIFACT_KEYS = [
  'appBundle',
  'appEntitlements',
  'appPrivacyManifest',
  'archive',
  'extensionBundle',
  'extensionEntitlements',
  'extensionPrivacyManifest',
];
const TOP_LEVEL_KEYS = [
  'build',
  'capturedAt',
  'device',
  'identifiers',
  'scenarioArtifacts',
  'schemaVersion',
  'signedArtifacts',
  'signoff',
  'sourceGitSha',
];
const BUILD_KEYS = ['configuration', 'easIosBuildId', 'platform'];
const DEVICE_KEYS = ['model', 'osVersion', 'physical'];
const IDENTIFIER_KEYS = [
  'appBundleIdentifier',
  'appGroupIdentifier',
  'extensionBundleIdentifier',
  'final',
  'teamIdentifier',
];
const ARTIFACT_REFERENCE_KEYS = ['mediaType', 'path', 'sha256'];
const REPORT_KEYS = ['binding', 'capturedAt', 'claims', 'reportType', 'schemaVersion'];
const SCENARIO_REPORT_KEYS = [
  'binding',
  'capturedAt',
  'claims',
  'proofAttachments',
  'reportType',
  'schemaVersion',
];
const BINDING_KEYS = [
  'device',
  'easIosBuildId',
  'identifiers',
  'rawArtifactSha256',
  'sourceGitSha',
];
const REPORT_IDENTIFIER_KEYS = [
  'appBundleIdentifier',
  'appGroupIdentifier',
  'extensionBundleIdentifier',
  'teamIdentifier',
];
const RAW_HASH_KEYS = ['appBundle', 'archive', 'extensionBundle'];
const ENTITLEMENT_CLAIM_KEYS = [
  'appGroups',
  'applicationIdentifier',
  'apsEnvironment',
  'bundleIdentifier',
  'codeSignatureValid',
  'serviceCapabilityKeys',
  'teamIdentifier',
];
const PRIVACY_CLAIM_KEYS = [
  'accessedApiTypes',
  'collectedDataTypes',
  'tracking',
  'trackingDomains',
];
const ACCESSED_API_KEYS = ['apiType', 'reasons'];
const SIGNOFF_KEYS = ['decision', 'signedAt', 'signedOffBy'];
const ARCHIVE_CLAIM_KEYS = [
  'appGroupEntitlementsMatch',
  'appCodeSignatureValid',
  'appPrivacyManifestEmbedded',
  'extensionCodeSignatureValid',
  'extensionEmbedded',
  'extensionPrivacyManifestEmbedded',
  'frequentUpdatesEnabled',
  'identitiesMatch',
  'interactivePublicationEnabled',
  'lifecycleVersion',
  'liveActivityStartEnabled',
  'sqlite3Linked',
  'unapprovedExtensionCapabilitiesAbsent',
];
const INTERACTION_CLAIM_KEYS = [
  'accountDeletionCleanup',
  'accountSwitchCleanup',
  'allOrRedactReconciliation',
  'atomicConcurrentCheckOff',
  'authorityNonceCas',
  'boundedCrossProcessLock',
  'canonicalSnapshotEquality',
  'corruptBytesCleanup',
  'expiredTokenNoWrite',
  'expiryCleanup',
  'foreignOwnerCleanup',
  'healthConsentWithdrawalCleanup',
  'killedAppReconciliation',
  'lockedStateRedaction',
  'nativeActionImplementation',
  'outboxCommittedBeforeIntentReturn',
  'oversizedBytesCleanup',
  'ownerSnapshotBinding',
  'repeatedTapIdempotent',
  'signOutCleanup',
  'sqliteTimelineAuthority',
  'staleTokenNoWrite',
  'tombstoneCleanup',
  'twoEntryStaleTimeline',
  'unclaimedOwnerCleanup',
  'unknownTokenNoWrite',
];
const LIVE_ACTIVITY_CLAIM_KEYS = [
  'consentWithdrawalCleanup',
  'deviceRestartRecovery',
  'disablementCleanup',
  'explicitCompletionEnd',
  'finiteStaleDeadline',
  'immediatePrivacyEnd',
  'lockedStateRedaction',
  'ownerFilteredRecovery',
  'processDeathRecovery',
  'startUpdateAuthorization',
];
const WIDGET_DEVICE_CLAIM_KEYS = [
  'accessibilityPass',
  'coldStartDeepLinkPass',
  'dynamicTypePass',
  'killedAppDeepLinkPass',
  'lockedStateRedaction',
  'repeatedConcurrentInteractionPass',
  'supportedFamilies',
  'voiceOverPass',
  'warmDeepLinkPass',
];
const GIT_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const EAS_BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EAS_BUILD_URL =
  /^https:\/\/expo\.dev\/accounts\/[^/\s]+\/projects\/[^/\s]+\/builds\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[?#].*)?$/i;
const BUNDLE_ID = /^(?:[A-Za-z0-9][A-Za-z0-9-]*\.){2,}[A-Za-z0-9][A-Za-z0-9-]*$/;
const TEAM_ID = /^[A-Z0-9]{10}$/;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 512 * 1024 * 1024;
const MAX_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_PROOF_ATTACHMENTS = 8;
const NATIVE_ACTION_IMPLEMENTATIONS = new Set(['sqlite_app_group_outbox_cas']);
const MEDIA_TYPES = Object.freeze({
  json: 'application/json',
  zip: 'application/zip',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  text: 'text/plain',
});
const PROOF_MEDIA_TYPES = new Set([
  MEDIA_TYPES.jpeg,
  MEDIA_TYPES.mp4,
  MEDIA_TYPES.png,
  MEDIA_TYPES.text,
]);
const RAW_ARTIFACT_RULES = Object.freeze({
  appBundle: { mediaType: MEDIA_TYPES.zip, suffix: '.app.zip' },
  archive: { mediaType: MEDIA_TYPES.zip, suffix: '.xcarchive.zip' },
  extensionBundle: { mediaType: MEDIA_TYPES.zip, suffix: '.appex.zip' },
});
const REPORT_TYPES = Object.freeze({
  appEntitlements: 'app-entitlements',
  appPrivacyManifest: 'app-privacy-manifest',
  extensionEntitlements: 'extension-entitlements',
  extensionPrivacyManifest: 'extension-privacy-manifest',
});

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected, prefix, errors) {
  if (!isObject(value)) {
    errors.push(`${prefix} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    errors.push(`${prefix} keys must be exactly: ${wanted.join(', ')}.`);
    return false;
  }
  return true;
}

function exactStringArray(value, expected, prefix, errors) {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((entry, index) => entry !== expected[index])
  ) {
    errors.push(`${prefix} must be exactly: ${expected.join(', ')}.`);
    return false;
  }
  return true;
}

function sortedUniqueStringArray(value, prefix, errors, maximum = 32) {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some((entry) => typeof entry !== 'string' || !entry || entry !== entry.trim()) ||
    new Set(value).size !== value.length ||
    value.some((entry, index) => index > 0 && entry <= value[index - 1])
  ) {
    errors.push(`${prefix} must be a sorted, unique, bounded array of non-empty strings.`);
    return false;
  }
  return true;
}

function isoTimestamp(value, prefix, errors, nowMs = Date.now()) {
  if (typeof value !== 'string' || value !== value.trim() || !value) {
    errors.push(`${prefix} must be a non-empty canonical ISO timestamp.`);
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    errors.push(`${prefix} must be a canonical ISO timestamp.`);
    return null;
  }
  if (parsed > nowMs + 5 * 60 * 1000) {
    errors.push(`${prefix} must not be in the future.`);
    return null;
  }
  return parsed;
}

function realText(value, minimumLength = 3) {
  const text = String(value ?? '').trim();
  return text.length >= minimumLength && !placeholderEnvValue(text);
}

function safeRepoArtifactPath(value) {
  if (typeof value !== 'string' || value !== value.trim() || !value) return null;
  if (
    value.includes('\\') ||
    value.includes('\0') ||
    value.includes('%') ||
    /\s/.test(value) ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return null;
  }
  const normalized = posix.normalize(value);
  if (
    normalized !== value ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
    !normalized.startsWith(WIDGET_LIFECYCLE_EVIDENCE_ROOT)
  ) {
    return null;
  }
  return normalized;
}

function extensionMatches(path, mediaType) {
  if (mediaType === MEDIA_TYPES.json) return extname(path).toLowerCase() === '.json';
  if (mediaType === MEDIA_TYPES.zip) return extname(path).toLowerCase() === '.zip';
  if (mediaType === MEDIA_TYPES.png) return extname(path).toLowerCase() === '.png';
  if (mediaType === MEDIA_TYPES.jpeg) return /\.jpe?g$/i.test(path);
  if (mediaType === MEDIA_TYPES.mp4) return extname(path).toLowerCase() === '.mp4';
  if (mediaType === MEDIA_TYPES.text) return /\.(?:log|txt)$/i.test(path);
  return false;
}

function bytesMatchMediaType(bytes, mediaType) {
  if (mediaType === MEDIA_TYPES.zip) {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    );
  }
  if (mediaType === MEDIA_TYPES.png) {
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mediaType === MEDIA_TYPES.jpeg) {
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mediaType === MEDIA_TYPES.mp4) {
    return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mediaType === MEDIA_TYPES.json) {
    return bytes.length >= 3 && bytes.toString('utf8').trimStart().startsWith('{');
  }
  if (mediaType === MEDIA_TYPES.text) {
    const text = bytes.toString('utf8');
    return !text.includes('\u0000') && text.trim().length >= 16 && !text.includes('\ufffd');
  }
  return false;
}

function hashAndPrefix(path, prefixBytes = 16) {
  const hash = createHash('sha256');
  const prefix = Buffer.alloc(prefixBytes);
  let prefixLength = 0;
  const chunk = Buffer.alloc(1024 * 1024);
  const file = openSync(path, 'r');
  try {
    while (true) {
      const count = readSync(file, chunk, 0, chunk.length, null);
      if (count === 0) break;
      if (prefixLength < prefix.length) {
        const copyLength = Math.min(count, prefix.length - prefixLength);
        chunk.copy(prefix, prefixLength, 0, copyLength);
        prefixLength += copyLength;
      }
      hash.update(chunk.subarray(0, count));
    }
  } finally {
    closeSync(file);
  }
  return { hash: hash.digest('hex'), prefix: prefix.subarray(0, prefixLength) };
}

function artifactFile(root, reference, prefix, errors, allowedMediaTypes) {
  if (!exactKeys(reference, ARTIFACT_REFERENCE_KEYS, prefix, errors)) return null;
  const path = safeRepoArtifactPath(reference.path);
  if (!path) {
    errors.push(
      `${prefix}.path must be a normalized whitespace-free repo-relative file under ${WIDGET_LIFECYCLE_EVIDENCE_ROOT}.`,
    );
  }
  const mediaType = String(reference.mediaType ?? '').trim();
  if (!allowedMediaTypes.has(mediaType)) {
    errors.push(`${prefix}.mediaType is not permitted for this artifact.`);
  }
  const expectedHash = String(reference.sha256 ?? '')
    .trim()
    .toLowerCase();
  if (!SHA256.test(expectedHash)) errors.push(`${prefix}.sha256 must be 64 lowercase hex digits.`);
  if (!path || !allowedMediaTypes.has(mediaType) || !SHA256.test(expectedHash)) return null;
  if (!extensionMatches(path, mediaType)) {
    errors.push(`${prefix}.path extension does not match ${mediaType}.`);
    return null;
  }

  const rootPath = resolve(root);
  const absolute = resolve(rootPath, path);
  const relativePath = relative(rootPath, absolute);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    errors.push(`${prefix}.path escapes the repository root.`);
    return null;
  }
  if (!existsSync(absolute)) {
    errors.push(`${prefix}.path does not exist: ${path}.`);
    return null;
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    errors.push(`${prefix}.path must be a regular non-symlink file: ${path}.`);
    return null;
  }
  const realRoot = realpathSync(rootPath);
  const realFile = realpathSync(absolute);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${sep}`)) {
    errors.push(`${prefix}.path resolves outside the repository root.`);
    return null;
  }
  const maximumBytes =
    mediaType === MEDIA_TYPES.json
      ? MAX_JSON_BYTES
      : mediaType === MEDIA_TYPES.text
        ? MAX_TEXT_BYTES
        : MAX_ATTACHMENT_BYTES;
  if (stat.size === 0 || stat.size > maximumBytes) {
    errors.push(`${prefix}.path has an invalid size for ${mediaType}: ${path}.`);
    return null;
  }
  const buffered = mediaType === MEDIA_TYPES.json || mediaType === MEDIA_TYPES.text;
  const bytes = buffered ? readFileSync(realFile) : null;
  const streamed = buffered ? null : hashAndPrefix(realFile);
  if (!bytesMatchMediaType(bytes ?? streamed.prefix, mediaType)) {
    errors.push(`${prefix}.path content does not match declared ${mediaType}: ${path}.`);
    return null;
  }
  const actualHash = streamed?.hash ?? createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash) {
    errors.push(`${prefix}.sha256 does not match ${path}.`);
    return null;
  }
  return Object.freeze({ path, sha256: actualHash, mediaType, bytes: stat.size });
}

function canonicalJson(root, artifact, prefix, errors) {
  let parsed;
  const raw = readFileSync(resolve(root, artifact.path), 'utf8');
  try {
    parsed = JSON.parse(raw);
  } catch {
    errors.push(`${prefix} must contain valid JSON.`);
    return null;
  }
  if (raw !== `${JSON.stringify(parsed, null, 2)}\n`) {
    errors.push(`${prefix} must use canonical two-space JSON with one trailing newline.`);
    return null;
  }
  return parsed;
}

function iosVersion(value) {
  const match = String(value ?? '').match(/^iOS (\d{1,2})(?:\.(\d{1,2})){0,2}$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function normalizeEasBuildId(value, { allowUrl = false } = {}) {
  const text = String(value ?? '').trim();
  if (placeholderEnvValue(text)) return null;
  if (EAS_BUILD_ID.test(text)) return text.toLowerCase();
  if (allowUrl) return text.match(EAS_BUILD_URL)?.[1]?.toLowerCase() ?? null;
  return null;
}

function expectedIdentity(options, errors) {
  const appBundleIdentifier = String(options.expectedAppBundleIdentifier ?? '').trim();
  const teamIdentifier = String(options.expectedTeamIdentifier ?? '').trim();
  if (!BUNDLE_ID.test(appBundleIdentifier) || placeholderEnvValue(appBundleIdentifier)) {
    errors.push('Expected final app bundle identifier is missing or invalid.');
    return null;
  }
  if (!TEAM_ID.test(teamIdentifier) || placeholderEnvValue(teamIdentifier)) {
    errors.push('Expected final Apple Team ID is missing or invalid.');
    return null;
  }
  return Object.freeze({
    appBundleIdentifier,
    extensionBundleIdentifier: `${appBundleIdentifier}.ExpoWidgetsTarget`,
    appGroupIdentifier: `group.${appBundleIdentifier}`,
    teamIdentifier,
  });
}

function emptyArtifact(mediaType) {
  return { path: null, sha256: null, mediaType };
}

export function createWidgetLifecycleEvidenceTemplate() {
  return {
    schemaVersion: WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
    capturedAt: null,
    sourceGitSha: null,
    build: { platform: 'ios', configuration: 'Release', easIosBuildId: null },
    device: { physical: true, model: null, osVersion: 'iOS 17.0 or newer' },
    identifiers: {
      final: true,
      appBundleIdentifier: null,
      extensionBundleIdentifier: null,
      appGroupIdentifier: null,
      teamIdentifier: null,
    },
    signedArtifacts: {
      appBundle: emptyArtifact(MEDIA_TYPES.zip),
      appEntitlements: emptyArtifact(MEDIA_TYPES.json),
      appPrivacyManifest: emptyArtifact(MEDIA_TYPES.json),
      archive: emptyArtifact(MEDIA_TYPES.zip),
      extensionBundle: emptyArtifact(MEDIA_TYPES.zip),
      extensionEntitlements: emptyArtifact(MEDIA_TYPES.json),
      extensionPrivacyManifest: emptyArtifact(MEDIA_TYPES.json),
    },
    scenarioArtifacts: Object.fromEntries(
      WIDGET_LIFECYCLE_SCENARIO_IDS.map((id) => [id, emptyArtifact(MEDIA_TYPES.json)]),
    ),
    signoff: { decision: null, signedOffBy: null, signedAt: null },
  };
}

export function widgetLifecycleArtifactReferences(evidence, validatedArtifacts = []) {
  if (!isObject(evidence)) return [];
  const references = [];
  for (const [container, keys] of [
    ['signedArtifacts', SIGNED_ARTIFACT_KEYS],
    ['scenarioArtifacts', WIDGET_LIFECYCLE_SCENARIO_IDS],
  ]) {
    if (!isObject(evidence[container])) continue;
    for (const key of keys) {
      if (isObject(evidence[container][key])) {
        references.push({ id: `${container}.${key}`, ...evidence[container][key] });
      }
    }
  }
  for (const artifact of validatedArtifacts) {
    if (isObject(artifact) && typeof artifact.path === 'string') references.push(artifact);
  }
  return [...new Map(references.map((reference) => [reference.path, reference])).values()];
}

function validateTopDevice(device, prefix, errors) {
  if (!exactKeys(device, DEVICE_KEYS, prefix, errors)) return null;
  if (device.physical !== true) errors.push(`${prefix}.physical must be true.`);
  const model = String(device.model ?? '').trim();
  if (
    !realText(model, 8) ||
    !/^iPhone [A-Za-z0-9][A-Za-z0-9 .()+-]{1,39}$/.test(model) ||
    /\b(?:simulator|emulator|generic|device|model)\b/i.test(model)
  ) {
    errors.push(`${prefix}.model must name a specific physical iPhone model.`);
  }
  const major = iosVersion(device.osVersion);
  if (major === null || major < 17) errors.push(`${prefix}.osVersion must be iOS 17.0 or newer.`);
  return { physical: device.physical, model, osVersion: device.osVersion };
}

function validateBinding(binding, expected, deviceRequired, prefix, errors) {
  if (!exactKeys(binding, BINDING_KEYS, prefix, errors)) return;
  if (binding.sourceGitSha !== expected.sourceGitSha) {
    errors.push(`${prefix}.sourceGitSha must match the evidence sourceGitSha.`);
  }
  if (normalizeEasBuildId(binding.easIosBuildId) !== expected.easIosBuildId) {
    errors.push(`${prefix}.easIosBuildId must match the exact evidence build UUID.`);
  }
  if (exactKeys(binding.identifiers, REPORT_IDENTIFIER_KEYS, `${prefix}.identifiers`, errors)) {
    for (const key of REPORT_IDENTIFIER_KEYS) {
      if (binding.identifiers[key] !== expected.identifiers?.[key]) {
        errors.push(`${prefix}.identifiers.${key} must match the final evidence identity.`);
      }
    }
  }
  if (exactKeys(binding.rawArtifactSha256, RAW_HASH_KEYS, `${prefix}.rawArtifactSha256`, errors)) {
    for (const key of RAW_HASH_KEYS) {
      if (binding.rawArtifactSha256[key] !== expected.rawArtifactSha256[key]) {
        errors.push(`${prefix}.rawArtifactSha256.${key} must match the validated raw artifact.`);
      }
    }
  }
  if (deviceRequired) {
    if (!exactKeys(binding.device, DEVICE_KEYS, `${prefix}.device`, errors)) return;
    for (const key of DEVICE_KEYS) {
      if (binding.device[key] !== expected.device?.[key]) {
        errors.push(`${prefix}.device.${key} must match the physical evidence device.`);
      }
    }
  } else if (binding.device !== null) {
    errors.push(`${prefix}.device must be null for archive-only inspection reports.`);
  }
}

function validateCommonReport(
  report,
  reportType,
  expected,
  prefix,
  errors,
  { deviceRequired = false, scenario = false } = {},
) {
  if (!exactKeys(report, scenario ? SCENARIO_REPORT_KEYS : REPORT_KEYS, prefix, errors))
    return false;
  if (report.schemaVersion !== WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`${prefix}.schemaVersion must be ${WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION}.`);
  }
  if (report.reportType !== reportType) errors.push(`${prefix}.reportType must be ${reportType}.`);
  const reportCapturedAt = isoTimestamp(
    report.capturedAt,
    `${prefix}.capturedAt`,
    errors,
    expected.nowMs,
  );
  if (
    reportCapturedAt !== null &&
    expected.capturedAt !== null &&
    reportCapturedAt > expected.capturedAt
  ) {
    errors.push(`${prefix}.capturedAt must be at or before the evidence capturedAt.`);
  }
  validateBinding(report.binding, expected, deviceRequired, `${prefix}.binding`, errors);
  return true;
}

function validateEntitlementReport(report, target, expected, prefix, errors) {
  if (
    !validateCommonReport(report, REPORT_TYPES[`${target}Entitlements`], expected, prefix, errors)
  ) {
    return;
  }
  const claims = report.claims;
  if (!exactKeys(claims, ENTITLEMENT_CLAIM_KEYS, `${prefix}.claims`, errors)) return;
  const bundleIdentifier =
    target === 'app'
      ? expected.identifiers?.appBundleIdentifier
      : expected.identifiers?.extensionBundleIdentifier;
  if (claims.bundleIdentifier !== bundleIdentifier) {
    errors.push(`${prefix}.claims.bundleIdentifier must match the signed target identity.`);
  }
  if (!TEAM_ID.test(String(claims.teamIdentifier ?? ''))) {
    errors.push(`${prefix}.claims.teamIdentifier must be a 10-character Apple Team ID.`);
  }
  if (claims.teamIdentifier !== expected.identifiers?.teamIdentifier) {
    errors.push(`${prefix}.claims.teamIdentifier must match the final evidence Team ID.`);
  }
  if (claims.applicationIdentifier !== `${claims.teamIdentifier}.${bundleIdentifier}`) {
    errors.push(`${prefix}.claims.applicationIdentifier must equal TeamID.bundleIdentifier.`);
  }
  if (claims.codeSignatureValid !== true) {
    errors.push(`${prefix}.claims.codeSignatureValid must be true.`);
  }
  exactStringArray(
    claims.appGroups,
    [expected.identifiers?.appGroupIdentifier],
    `${prefix}.claims.appGroups`,
    errors,
  );
  if (
    !sortedUniqueStringArray(
      claims.serviceCapabilityKeys,
      `${prefix}.claims.serviceCapabilityKeys`,
      errors,
    )
  ) {
    return;
  }
  if (target === 'extension') {
    exactStringArray(
      claims.serviceCapabilityKeys,
      ['com.apple.security.application-groups'],
      `${prefix}.claims.serviceCapabilityKeys`,
      errors,
    );
    if (claims.apsEnvironment !== null) {
      errors.push(`${prefix}.claims.apsEnvironment must be null for the extension.`);
    }
  } else {
    if (!claims.serviceCapabilityKeys.includes('com.apple.security.application-groups')) {
      errors.push(`${prefix}.claims.serviceCapabilityKeys must include App Groups.`);
    }
    if (![null, 'development', 'production'].includes(claims.apsEnvironment)) {
      errors.push(`${prefix}.claims.apsEnvironment must be null, development, or production.`);
    }
  }
}

function validatePrivacyReport(report, target, expected, prefix, errors) {
  if (
    !validateCommonReport(
      report,
      REPORT_TYPES[`${target}PrivacyManifest`],
      expected,
      prefix,
      errors,
    )
  ) {
    return;
  }
  const claims = report.claims;
  if (!exactKeys(claims, PRIVACY_CLAIM_KEYS, `${prefix}.claims`, errors)) return;
  if (claims.tracking !== false) errors.push(`${prefix}.claims.tracking must be false.`);
  exactStringArray(claims.trackingDomains, [], `${prefix}.claims.trackingDomains`, errors);
  exactStringArray(claims.collectedDataTypes, [], `${prefix}.claims.collectedDataTypes`, errors);
  if (!Array.isArray(claims.accessedApiTypes) || claims.accessedApiTypes.length !== 1) {
    errors.push(
      `${prefix}.claims.accessedApiTypes must contain exactly the App Group UserDefaults entry.`,
    );
    return;
  }
  const api = claims.accessedApiTypes[0];
  if (!exactKeys(api, ACCESSED_API_KEYS, `${prefix}.claims.accessedApiTypes[0]`, errors)) return;
  if (api.apiType !== 'NSPrivacyAccessedAPICategoryUserDefaults') {
    errors.push(`${prefix}.claims.accessedApiTypes[0].apiType must be UserDefaults.`);
  }
  exactStringArray(api.reasons, ['1C8F.1'], `${prefix}.claims.accessedApiTypes[0].reasons`, errors);
}

function allTrueClaims(claims, keys, prefix, errors) {
  for (const key of keys) {
    if (claims[key] !== true) errors.push(`${prefix}.${key} must be true.`);
  }
}

function validateScenarioClaims(id, claims, prefix, errors) {
  if (id === 'archiveInspection') {
    if (!exactKeys(claims, ARCHIVE_CLAIM_KEYS, prefix, errors)) return;
    allTrueClaims(
      claims,
      ARCHIVE_CLAIM_KEYS.filter(
        (key) => key !== 'frequentUpdatesEnabled' && key !== 'lifecycleVersion',
      ),
      prefix,
      errors,
    );
    if (claims.frequentUpdatesEnabled !== false) {
      errors.push(`${prefix}.frequentUpdatesEnabled must be false.`);
    }
    if (claims.lifecycleVersion !== 1) {
      errors.push(`${prefix}.lifecycleVersion must be 1.`);
    }
    return;
  }
  if (id === 'interactionPrivacy') {
    if (!exactKeys(claims, INTERACTION_CLAIM_KEYS, prefix, errors)) return;
    allTrueClaims(
      claims,
      INTERACTION_CLAIM_KEYS.filter((key) => key !== 'nativeActionImplementation'),
      prefix,
      errors,
    );
    if (!NATIVE_ACTION_IMPLEMENTATIONS.has(claims.nativeActionImplementation)) {
      errors.push(`${prefix}.nativeActionImplementation must be sqlite_app_group_outbox_cas.`);
    }
    return;
  }
  if (id === 'liveActivity') {
    if (!exactKeys(claims, LIVE_ACTIVITY_CLAIM_KEYS, prefix, errors)) return;
    allTrueClaims(claims, LIVE_ACTIVITY_CLAIM_KEYS, prefix, errors);
    return;
  }
  if (!exactKeys(claims, WIDGET_DEVICE_CLAIM_KEYS, prefix, errors)) return;
  allTrueClaims(
    claims,
    WIDGET_DEVICE_CLAIM_KEYS.filter((key) => key !== 'supportedFamilies'),
    prefix,
    errors,
  );
  exactStringArray(
    claims.supportedFamilies,
    WIDGET_LIFECYCLE_SUPPORTED_FAMILIES,
    `${prefix}.supportedFamilies`,
    errors,
  );
}

function validateScenarioReport(report, id, expected, prefix, errors, artifacts, root) {
  const deviceRequired = id !== 'archiveInspection';
  if (
    !validateCommonReport(report, id, expected, prefix, errors, { deviceRequired, scenario: true })
  ) {
    return;
  }
  validateScenarioClaims(id, report.claims, `${prefix}.claims`, errors);
  if (
    !Array.isArray(report.proofAttachments) ||
    report.proofAttachments.length < 1 ||
    report.proofAttachments.length > MAX_PROOF_ATTACHMENTS
  ) {
    errors.push(`${prefix}.proofAttachments must contain 1-${MAX_PROOF_ATTACHMENTS} typed proofs.`);
    return;
  }
  report.proofAttachments.forEach((reference, index) => {
    const artifact = artifactFile(
      root,
      reference,
      `${prefix}.proofAttachments[${index}]`,
      errors,
      PROOF_MEDIA_TYPES,
    );
    if (artifact) artifacts.push({ id: `${prefix}.proofAttachments.${index}`, ...artifact });
  });
}

export function validateWidgetLifecycleEvidence(evidence, options = {}) {
  const errors = [];
  const warnings = [];
  const root = resolve(options.root ?? process.cwd());
  const artifacts = [];
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();

  if (!exactKeys(evidence, TOP_LEVEL_KEYS, 'evidence', errors)) {
    return {
      errors,
      warnings,
      artifacts,
      summary: {
        artifactCount: 0,
        baseArtifactCount: 0,
        proofAttachmentCount: 0,
        scenarioCount: 0,
      },
    };
  }
  if (evidence.schemaVersion !== WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION}.`);
  }
  const capturedAt = isoTimestamp(evidence.capturedAt, 'capturedAt', errors, nowMs);
  const expectedGitSha = String(options.expectedGitSha ?? '')
    .trim()
    .toLowerCase();
  const sourceGitSha = String(evidence.sourceGitSha ?? '')
    .trim()
    .toLowerCase();
  if (!GIT_SHA.test(sourceGitSha)) errors.push('sourceGitSha must be 40 lowercase hex digits.');
  if (!GIT_SHA.test(expectedGitSha))
    errors.push('Expected current HEAD Git SHA is missing or invalid.');
  else if (sourceGitSha !== expectedGitSha) {
    errors.push(`sourceGitSha must equal the current source HEAD ${expectedGitSha}.`);
  }

  let easIosBuildId = null;
  if (exactKeys(evidence.build, BUILD_KEYS, 'build', errors)) {
    if (evidence.build.platform !== 'ios') errors.push('build.platform must be ios.');
    if (evidence.build.configuration !== 'Release')
      errors.push('build.configuration must be Release.');
    easIosBuildId = normalizeEasBuildId(evidence.build.easIosBuildId);
    const expectedBuildId = normalizeEasBuildId(options.expectedBuildId, { allowUrl: true });
    if (!easIosBuildId) errors.push('build.easIosBuildId must be an exact EAS build UUID.');
    if (!expectedBuildId) {
      errors.push('PHASE5_IOS_BUILD_ID must be an EAS build UUID or canonical expo.dev build URL.');
    } else if (easIosBuildId !== expectedBuildId) {
      errors.push('build.easIosBuildId does not match PHASE5_IOS_BUILD_ID.');
    }
  }

  const device = validateTopDevice(evidence.device, 'device', errors);
  const expectedIds = expectedIdentity(options, errors);
  if (exactKeys(evidence.identifiers, IDENTIFIER_KEYS, 'identifiers', errors)) {
    if (evidence.identifiers.final !== true) errors.push('identifiers.final must be true.');
    for (const key of REPORT_IDENTIFIER_KEYS) {
      const value = String(evidence.identifiers[key] ?? '').trim();
      if (!realText(value, 8))
        errors.push(`identifiers.${key} must be a final non-placeholder ID.`);
      if (expectedIds && value !== expectedIds[key]) {
        errors.push(`identifiers.${key} must equal ${expectedIds[key]}.`);
      }
    }
  }

  const baseArtifacts = new Map();
  if (exactKeys(evidence.signedArtifacts, SIGNED_ARTIFACT_KEYS, 'signedArtifacts', errors)) {
    for (const key of SIGNED_ARTIFACT_KEYS) {
      const rule = RAW_ARTIFACT_RULES[key];
      const allowed = new Set([rule?.mediaType ?? MEDIA_TYPES.json]);
      const artifact = artifactFile(
        root,
        evidence.signedArtifacts[key],
        `signedArtifacts.${key}`,
        errors,
        allowed,
      );
      if (artifact && rule && !artifact.path.endsWith(rule.suffix)) {
        errors.push(`signedArtifacts.${key}.path must end with ${rule.suffix}.`);
      }
      if (artifact) {
        const value = { id: `signedArtifacts.${key}`, ...artifact };
        artifacts.push(value);
        baseArtifacts.set(`signedArtifacts.${key}`, value);
      }
    }
  }
  if (
    exactKeys(
      evidence.scenarioArtifacts,
      WIDGET_LIFECYCLE_SCENARIO_IDS,
      'scenarioArtifacts',
      errors,
    )
  ) {
    for (const key of WIDGET_LIFECYCLE_SCENARIO_IDS) {
      const artifact = artifactFile(
        root,
        evidence.scenarioArtifacts[key],
        `scenarioArtifacts.${key}`,
        errors,
        new Set([MEDIA_TYPES.json]),
      );
      if (artifact) {
        const value = { id: `scenarioArtifacts.${key}`, ...artifact };
        artifacts.push(value);
        baseArtifacts.set(`scenarioArtifacts.${key}`, value);
      }
    }
  }

  const expected = {
    sourceGitSha,
    easIosBuildId,
    identifiers: expectedIds,
    device,
    capturedAt,
    nowMs,
    rawArtifactSha256: Object.fromEntries(
      RAW_SIGNED_ARTIFACT_KEYS.map((key) => [
        key,
        baseArtifacts.get(`signedArtifacts.${key}`)?.sha256 ?? null,
      ]),
    ),
  };
  for (const key of REPORT_SIGNED_ARTIFACT_KEYS) {
    const artifact = baseArtifacts.get(`signedArtifacts.${key}`);
    if (!artifact) continue;
    const report = canonicalJson(root, artifact, `signedArtifacts.${key}`, errors);
    if (!report) continue;
    if (key.endsWith('Entitlements')) {
      validateEntitlementReport(
        report,
        key.startsWith('app') ? 'app' : 'extension',
        expected,
        `signedArtifacts.${key}`,
        errors,
      );
    } else {
      validatePrivacyReport(
        report,
        key.startsWith('app') ? 'app' : 'extension',
        expected,
        `signedArtifacts.${key}`,
        errors,
      );
    }
  }
  for (const id of WIDGET_LIFECYCLE_SCENARIO_IDS) {
    const artifact = baseArtifacts.get(`scenarioArtifacts.${id}`);
    if (!artifact) continue;
    const report = canonicalJson(root, artifact, `scenarioArtifacts.${id}`, errors);
    if (!report) continue;
    validateScenarioReport(
      report,
      id,
      expected,
      `scenarioArtifacts.${id}`,
      errors,
      artifacts,
      root,
    );
  }

  const artifactPaths = artifacts.map(({ path }) => path);
  if (new Set(artifactPaths).size !== artifactPaths.length) {
    errors.push('Every signed/report/proof artifact must use a distinct file path.');
  }
  const artifactHashes = artifacts.map(({ sha256 }) => sha256);
  if (new Set(artifactHashes).size !== artifactHashes.length) {
    errors.push('Every signed/report/proof artifact must have distinct bytes and SHA-256.');
  }

  if (exactKeys(evidence.signoff, SIGNOFF_KEYS, 'signoff', errors)) {
    if (evidence.signoff.decision !== 'pass') errors.push('signoff.decision must be pass.');
    const signoff = normalizeNamedSignoff(evidence.signoff.signedOffBy);
    const expectedSignoff = normalizeNamedSignoff(options.expectedSignedOffBy);
    if (!signoff) errors.push('signoff.signedOffBy must name a real reviewer.');
    if (!expectedSignoff) errors.push('Expected Phase 5 named signoff is missing or invalid.');
    else if (signoff !== expectedSignoff) {
      errors.push('signoff.signedOffBy does not match PHASE5_SIGNED_OFF_BY.');
    }
    const signedAt = isoTimestamp(evidence.signoff.signedAt, 'signoff.signedAt', errors, nowMs);
    if (capturedAt !== null && signedAt !== null && signedAt < capturedAt) {
      errors.push('signoff.signedAt must be at or after capturedAt.');
    }
  }

  const baseArtifactCount = [...baseArtifacts.values()].length;
  const proofAttachmentCount = artifacts.length - baseArtifactCount;
  return {
    errors,
    warnings,
    artifacts,
    summary: {
      artifactCount: artifacts.length,
      baseArtifactCount,
      requiredBaseArtifactCount: SIGNED_ARTIFACT_KEYS.length + WIDGET_LIFECYCLE_SCENARIO_IDS.length,
      minimumProofAttachmentCount: WIDGET_LIFECYCLE_SCENARIO_IDS.length,
      proofAttachmentCount,
      scenarioCount: WIDGET_LIFECYCLE_SCENARIO_IDS.filter((id) =>
        baseArtifacts.has(`scenarioArtifacts.${id}`),
      ).length,
    },
  };
}
