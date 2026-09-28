import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

import plistModule from '@expo/plist';
import xmldomModule from '@xmldom/xmldom';

const plist = plistModule?.default ?? plistModule;
const DOMParser = xmldomModule?.DOMParser ?? xmldomModule?.default?.DOMParser;

export const IOS_PRIVACY_AUDIT_SCHEMA_VERSION = 1;
export const IOS_PRIVACY_BASELINE_PATH = 'docs/phase-9/apple-ios-privacy-baseline.json';
export const IOS_PRIVACY_MAPPING_PATH = 'docs/phase-9/ios-sdk-package-mapping.json';
export const IOS_PRIVACY_LOCKFILE_PATH = 'package-lock.json';
export const IOS_PRIVACY_AUDIT_JSON_PATH = 'docs/phase-9/generated/ios-privacy-source-audit.json';
export const IOS_PRIVACY_AUDIT_MARKDOWN_PATH = 'docs/phase-9/generated/ios-privacy-source-audit.md';

const MAX_BASELINE_BYTES = 2 * 1024 * 1024;
const MAX_MAPPING_BYTES = 4 * 1024 * 1024;
const MAX_LOCKFILE_BYTES = 64 * 1024 * 1024;
const MAX_PACKAGE_JSON_BYTES = 2 * 1024 * 1024;
const MAX_PRIVACY_MANIFEST_BYTES = 256 * 1024;
const MAX_PODSPEC_BYTES = 4 * 1024 * 1024;
const MAX_NATIVE_PACKAGE_ENTRIES = 20_000;
const MAX_TOTAL_WALK_ENTRIES = 200_000;
const MAX_WALK_DEPTH = 40;
const MAX_XCFRAMEWORK_FILES = 10_000;
const MAX_XCFRAMEWORK_BYTES = 512 * 1024 * 1024;
const MAX_XCFRAMEWORK_FILE_BYTES = 256 * 1024 * 1024;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const SHA256 = /^[0-9a-f]{64}$/;
const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/;
const PINNED_APPLE_BASELINE_SHA256 =
  'fe04db2c5ce694c4f0269f9056aec49dd528e8421b54079a4fc2b97254c90921';
const PINNED_APPLE_SDK_PUBLISHED_ORDER_SHA256 =
  '1f22a3111f95c0afb64849e785c4ade36dd22ff536a2f6a63118dd5ca6ac2cca';
const PINNED_APPLE_SDK_SORTED_SHA256 =
  '85fc210619400bc347bcff7c6cc843eac83a4e7969d6716b954bd03428b049a1';
const PRIVACY_TOP_LEVEL_KEYS = new Set([
  'NSPrivacyAccessedAPITypes',
  'NSPrivacyCollectedDataTypes',
  'NSPrivacyTracking',
  'NSPrivacyTrackingDomains',
]);
const ACCESSED_API_KEYS = ['NSPrivacyAccessedAPIType', 'NSPrivacyAccessedAPITypeReasons'];
const COLLECTED_DATA_KEYS = [
  'NSPrivacyCollectedDataType',
  'NSPrivacyCollectedDataTypeLinked',
  'NSPrivacyCollectedDataTypePurposes',
  'NSPrivacyCollectedDataTypeTracking',
];
const COLLECTED_DATA_TYPES = new Set(
  [
    'Name',
    'EmailAddress',
    'PhoneNumber',
    'PhysicalAddress',
    'OtherUserContactInfo',
    'Health',
    'Fitness',
    'PaymentInfo',
    'CreditInfo',
    'OtherFinancialInfo',
    'PreciseLocation',
    'CoarseLocation',
    'SensitiveInfo',
    'Contacts',
    'EmailsOrTextMessages',
    'PhotosorVideos',
    'AudioData',
    'GameplayContent',
    'CustomerSupport',
    'OtherUserContent',
    'BrowsingHistory',
    'SearchHistory',
    'UserID',
    'DeviceID',
    'PurchaseHistory',
    'ProductInteraction',
    'AdvertisingData',
    'OtherUsageData',
    'CrashData',
    'PerformanceData',
    'OtherDiagnosticData',
    'EnvironmentScanning',
    'Hands',
    'Head',
    'OtherDataTypes',
  ].map((suffix) => `NSPrivacyCollectedDataType${suffix}`),
);
const COLLECTED_DATA_PURPOSES = new Set(
  [
    'ThirdPartyAdvertising',
    'DeveloperAdvertising',
    'Analytics',
    'ProductPersonalization',
    'AppFunctionality',
    'Other',
  ].map((suffix) => `NSPrivacyCollectedDataTypePurpose${suffix}`),
);
const FALSE_ARCHIVE_CLAIMS = Object.freeze({
  appStoreAcceptanceProven: false,
  appStorePrivacyLabelsVerified: false,
  archiveInspected: false,
  binarySignaturesVerified: false,
  mergedPrivacyReportVerified: false,
});
const SOURCE_ONLY_FALSE_KEYS = new Set([
  ...Object.keys(FALSE_ARCHIVE_CLAIMS),
  'archiveInclusionProven',
  'signatureProven',
]);

export const IOS_PRIVACY_DEFAULT_BOUNDS = Object.freeze({
  maxNativePackageEntries: MAX_NATIVE_PACKAGE_ENTRIES,
  maxTotalWalkEntries: MAX_TOTAL_WALK_ENTRIES,
  maxWalkDepth: MAX_WALK_DEPTH,
  maxXcframeworkFiles: MAX_XCFRAMEWORK_FILES,
  maxXcframeworkBytes: MAX_XCFRAMEWORK_BYTES,
  maxXcframeworkFileBytes: MAX_XCFRAMEWORK_FILE_BYTES,
  maxPrivacyManifestBytes: MAX_PRIVACY_MANIFEST_BYTES,
  maxPodspecBytes: MAX_PODSPEC_BYTES,
});

function validatedBounds(overrides) {
  if (overrides === undefined) return IOS_PRIVACY_DEFAULT_BOUNDS;
  if (!isRecord(overrides)) {
    fail('AUDIT_BOUNDS', 'Audit bounds must be an object containing reviewed bound names.', null);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(IOS_PRIVACY_DEFAULT_BOUNDS, key)) {
      fail('AUDIT_BOUNDS', `Unknown audit bound ${key}.`, null);
    }
    if (!Number.isSafeInteger(value) || value <= 0 || value > IOS_PRIVACY_DEFAULT_BOUNDS[key]) {
      fail(
        'AUDIT_BOUNDS',
        `${key} must be a positive safe integer no greater than ${IOS_PRIVACY_DEFAULT_BOUNDS[key]}.`,
        null,
      );
    }
  }
  return Object.freeze({ ...IOS_PRIVACY_DEFAULT_BOUNDS, ...overrides });
}

export class IosPrivacyContractError extends Error {
  constructor(code, message, path = null, options) {
    super(message, options);
    this.name = 'IosPrivacyContractError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, message, path, cause) {
  throw new IosPrivacyContractError(code, message, path, cause ? { cause } : undefined);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left, right) {
  const a = String(left);
  const b = String(right);
  return a === b ? 0 : a < b ? -1 : 1;
}

function deepFreeze(value, seen = new WeakSet()) {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function issue(code, path, message) {
  return Object.freeze({ code, path: path ?? null, message });
}

function issueFromError(error, fallbackPath = null) {
  if (error instanceof IosPrivacyContractError) {
    return issue(error.code, error.path ?? fallbackPath, error.message);
  }
  return issue(
    'UNEXPECTED_AUDIT_ERROR',
    fallbackPath,
    error instanceof Error ? error.message : String(error),
  );
}

function issueSort(left, right) {
  return (
    compareText(left.code, right.code) ||
    compareText(left.path ?? '', right.path ?? '') ||
    compareText(left.message, right.message)
  );
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalLinesHash(values) {
  return sha256(Buffer.from(`${values.join('\n')}\n`, 'utf8'));
}

export function canonicalAuditJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeRelativePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.includes('\\') ||
    value.includes('\0') ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    fail('PATH_INVALID', 'The path must be a normalized repository-relative path.', String(value));
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    fail('PATH_INVALID', 'The path must not contain empty, dot, or parent segments.', value);
  }
  return value;
}

function checkedRoot(value) {
  const absolute = resolve(value ?? process.cwd());
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch (error) {
    fail('ROOT_MISSING', 'The audit root does not exist.', absolute, error);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail('ROOT_INVALID', 'The audit root must be a real directory, not a link.', absolute);
  }
  const real = realpathSync(absolute);
  return Object.freeze({ absolute, real });
}

function withinRoot(root, candidate) {
  const rel = relative(root.real, candidate);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function checkedPath(root, relativePath, expectedType = null) {
  const normalized = normalizeRelativePath(relativePath);
  let current = root.absolute;
  for (const segment of normalized.split('/')) {
    current = join(current, segment);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      fail('PATH_MISSING', 'The required audit path is missing.', normalized, error);
    }
    if (stat.isSymbolicLink()) {
      fail(
        'PATH_SYMLINK',
        'Audit inputs must not contain symbolic links or junctions.',
        normalized,
      );
    }
  }
  const stat = lstatSync(current);
  if (expectedType === 'file' && !stat.isFile()) {
    fail('PATH_TYPE', 'The audit path must be a regular file.', normalized);
  }
  if (expectedType === 'directory' && !stat.isDirectory()) {
    fail('PATH_TYPE', 'The audit path must be a directory.', normalized);
  }
  const real = realpathSync(current);
  if (!withinRoot(root, real))
    fail('PATH_ESCAPE', 'The audit path escapes the repository.', normalized);
  const identity = lstatSync(current, { bigint: true });
  if (identity.isSymbolicLink()) {
    fail('PATH_SYMLINK', 'Audit inputs must not contain symbolic links or junctions.', normalized);
  }
  if (expectedType === 'file' && !identity.isFile()) {
    fail('PATH_TYPE', 'The audit path must be a regular file.', normalized);
  }
  if (expectedType === 'directory' && !identity.isDirectory()) {
    fail('PATH_TYPE', 'The audit path must be a directory.', normalized);
  }
  return Object.freeze({ absolute: current, relative: normalized, stat, identity, real });
}

function tryCheckedPath(root, relativePath, expectedType = null) {
  try {
    return checkedPath(root, relativePath, expectedType);
  } catch (error) {
    if (error instanceof IosPrivacyContractError && error.code === 'PATH_MISSING') return null;
    throw error;
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function readBoundedFile(root, relativePath, maximumBytes, { allowEmpty = false } = {}) {
  const file = checkedPath(root, relativePath, 'file');
  if ((!allowEmpty && file.identity.size === 0n) || file.identity.size > BigInt(maximumBytes)) {
    fail(
      'FILE_SIZE',
      `File size must be ${allowEmpty ? 'at most' : 'between 1 and'} ${maximumBytes} bytes.`,
      relativePath,
    );
  }
  let descriptor;
  try {
    descriptor = openSync(file.absolute, constants.O_RDONLY);
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      !sameIdentity(file.identity, opened) ||
      opened.size > BigInt(maximumBytes)
    ) {
      fail('PATH_RACE', 'The file identity changed before it was read.', relativePath);
    }
    const bytes = readFileSync(descriptor);
    const finished = fstatSync(descriptor, { bigint: true });
    if (
      !sameIdentity(opened, finished) ||
      opened.size !== finished.size ||
      opened.mtimeNs !== finished.mtimeNs ||
      BigInt(bytes.length) !== finished.size ||
      bytes.length > maximumBytes
    ) {
      fail('PATH_RACE', 'The file changed while it was read.', relativePath);
    }
    return Object.freeze({ ...file, bytes, sha256: sha256(bytes) });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function decodeUtf8(bytes, path) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    fail('UTF8_BOM', 'Audit text files must use BOM-free UTF-8.', path);
  }
  try {
    return UTF8.decode(bytes);
  } catch (error) {
    fail('UTF8_INVALID', 'Audit text files must contain valid UTF-8.', path, error);
  }
}

function readJson(root, path, maximumBytes) {
  const file = readBoundedFile(root, path, maximumBytes);
  let value;
  try {
    value = JSON.parse(decodeUtf8(file.bytes, path));
  } catch (error) {
    if (error instanceof IosPrivacyContractError) throw error;
    fail('JSON_INVALID', 'The JSON input is malformed.', path, error);
  }
  if (!isRecord(value)) fail('JSON_ROOT', 'The JSON root must be an object.', path);
  return Object.freeze({ ...file, value });
}

function validateBaseline(file) {
  const value = file.value;
  const path = file.relative;
  if (file.sha256 !== PINNED_APPLE_BASELINE_SHA256) {
    fail(
      'BASELINE_HASH',
      `The Apple privacy baseline bytes must match reviewed SHA-256 ${PINNED_APPLE_BASELINE_SHA256}.`,
      path,
    );
  }
  if (
    !exactKeys(value, [
      'effectiveRequirements',
      'generatedFromOfficialSource',
      'provenance',
      'requiredReasonApiCategories',
      'requiredThirdPartySdks',
      'schemaVersion',
      'semanticRules',
    ]) ||
    value.schemaVersion !== 1
  ) {
    fail('BASELINE_SCHEMA', 'The Apple privacy baseline top-level schema is not exact v1.', path);
  }
  if (
    !exactKeys(value.generatedFromOfficialSource, ['retrievedAt', 'sourceTitle', 'url']) ||
    !exactKeys(value.effectiveRequirements, [
      'requiredReasonApis',
      'thirdPartySdks',
      'toolchain',
    ]) ||
    !exactKeys(value.effectiveRequirements.toolchain, [
      'effectiveDate',
      'minimumIosSdkMajor',
      'minimumXcodeMajor',
      'scope',
    ]) ||
    !exactKeys(value.effectiveRequirements.requiredReasonApis, ['effectiveDate', 'scope']) ||
    !exactKeys(value.effectiveRequirements.thirdPartySdks, [
      'anyVersionAndRepackagedSdkIncluded',
      'privacyManifestRequired',
      'signatureRequiredForBinaryDependencies',
    ])
  ) {
    fail('BASELINE_SCHEMA', 'The Apple effective-requirements schema is not exact.', path);
  }
  if (
    !Array.isArray(value.requiredReasonApiCategories) ||
    value.requiredReasonApiCategories.length !== 5 ||
    value.requiredReasonApiCategories.some(
      (entry) =>
        !exactKeys(entry, ['allowedReasonIds', 'category']) ||
        typeof entry.category !== 'string' ||
        !Array.isArray(entry.allowedReasonIds) ||
        entry.allowedReasonIds.length === 0 ||
        entry.allowedReasonIds.some((reason) => typeof reason !== 'string') ||
        new Set(entry.allowedReasonIds).size !== entry.allowedReasonIds.length,
    ) ||
    new Set(value.requiredReasonApiCategories.map(({ category }) => category)).size !== 5
  ) {
    fail('BASELINE_REASONS', 'Required-reason categories must be five unique exact entries.', path);
  }
  if (
    !Array.isArray(value.requiredThirdPartySdks) ||
    value.requiredThirdPartySdks.length !== 86 ||
    value.requiredThirdPartySdks.some((name) => typeof name !== 'string' || !name) ||
    new Set(value.requiredThirdPartySdks).size !== value.requiredThirdPartySdks.length
  ) {
    fail('BASELINE_SDK_LIST', 'The Apple SDK list must contain 86 unique names.', path);
  }
  if (
    !Array.isArray(value.semanticRules) ||
    value.semanticRules.some(
      (entry) =>
        !exactKeys(entry, ['id', 'rule']) ||
        typeof entry.id !== 'string' ||
        typeof entry.rule !== 'string',
    ) ||
    !exactKeys(value.provenance, [
      'hashCanonicalization',
      'officialSources',
      'publishedOrderSha256',
      'requiredThirdPartySdkCount',
      'sortedSha256',
    ]) ||
    !Array.isArray(value.provenance.officialSources) ||
    value.provenance.officialSources.some(
      (entry) => !exactKeys(entry, ['retrievedAt', 'sourceTitle', 'url']),
    )
  ) {
    fail('BASELINE_PROVENANCE', 'The baseline semantic-rule/provenance schema is invalid.', path);
  }
  const publishedHash = canonicalLinesHash(value.requiredThirdPartySdks);
  const sortedHash = canonicalLinesHash([...value.requiredThirdPartySdks].sort());
  if (
    value.provenance.requiredThirdPartySdkCount !== 86 ||
    value.provenance.publishedOrderSha256 !== publishedHash ||
    value.provenance.sortedSha256 !== sortedHash ||
    value.provenance.publishedOrderSha256 !== PINNED_APPLE_SDK_PUBLISHED_ORDER_SHA256 ||
    value.provenance.sortedSha256 !== PINNED_APPLE_SDK_SORTED_SHA256
  ) {
    fail(
      'BASELINE_HASH',
      'The Apple SDK list hashes/count do not match the reviewed canonical bytes.',
      path,
    );
  }
  return Object.freeze({
    file,
    categoryReasons: new Map(
      value.requiredReasonApiCategories.map(({ category, allowedReasonIds }) => [
        category,
        new Set(allowedReasonIds),
      ]),
    ),
    sdkNames: new Set(value.requiredThirdPartySdks),
    value,
  });
}

function validateMappingShape(file) {
  const value = file.value;
  const path = file.relative;
  if (
    !exactKeys(value, ['generatedAgainst', 'mappings', 'schemaVersion']) ||
    value.schemaVersion !== 1 ||
    !exactKeys(value.generatedAgainst, ['baselinePath', 'baselineSchemaVersion', 'sha256']) ||
    !Array.isArray(value.mappings)
  ) {
    fail('MAPPING_SCHEMA', 'The iOS SDK package mapping top-level schema is not exact v1.', path);
  }
  for (const entry of value.mappings) {
    if (
      !exactKeys(entry, [
        'appleSdkMatches',
        'archiveRequired',
        'lockIntegrity',
        'nativeArtifactNames',
        'notes',
        'packageName',
        'version',
      ]) ||
      !exactKeys(entry.lockIntegrity, ['entries', 'packageLockPath', 'packageLockSha256']) ||
      !Array.isArray(entry.lockIntegrity.entries) ||
      entry.lockIntegrity.entries.some(
        (item) => !exactKeys(item, ['integrity', 'path', 'version']),
      ) ||
      !Array.isArray(entry.nativeArtifactNames) ||
      !Array.isArray(entry.appleSdkMatches) ||
      entry.appleSdkMatches.some(
        (item) => !exactKeys(item, ['canonicalName', 'matchBasis', 'status']),
      ) ||
      !exactKeys(entry.notes, [
        'evidenceLevel',
        'nativeInventory',
        'neverClaimArchiveRules',
        'repoAliases',
        'sourcePins',
      ]) ||
      !Array.isArray(entry.notes.sourcePins) ||
      entry.notes.sourcePins.some((pin) => !exactKeys(pin, ['path', 'sha256'])) ||
      !exactKeys(entry.notes.nativeInventory, [
        'podfileLock',
        'privacyManifestLedger',
        'xcframeworkLedger',
      ]) ||
      !exactKeys(entry.notes.nativeInventory.podfileLock, ['path', 'sha256', 'status']) ||
      !exactKeys(entry.notes.nativeInventory.privacyManifestLedger, ['sha256', 'status']) ||
      !exactKeys(entry.notes.nativeInventory.xcframeworkLedger, ['sha256', 'status'])
    ) {
      fail('MAPPING_SCHEMA', 'A package mapping entry does not match the exact v1 schema.', path);
    }
  }
  return value;
}

function manifestIssue(code, path, message) {
  return issue(code, path, message);
}

function containsOnlyXmlMisc(fragment, { allowDoctype }) {
  let remaining = fragment;
  while (true) {
    remaining = remaining.trimStart();
    if (!remaining) return true;
    let terminator;
    if (remaining.startsWith('<!--')) {
      terminator = '-->';
    } else if (remaining.startsWith('<?')) {
      terminator = '?>';
    } else if (allowDoctype && remaining.startsWith('<!DOCTYPE')) {
      const end = remaining.indexOf('>');
      if (end < 0 || remaining.slice(0, end).includes('[')) return false;
      remaining = remaining.slice(end + 1);
      continue;
    } else {
      return false;
    }
    const end = remaining.indexOf(terminator);
    if (end < 0) return false;
    remaining = remaining.slice(end + terminator.length);
  }
}

function strictPlistXmlDiagnostics(text) {
  if (typeof DOMParser !== 'function') {
    return ['The pinned XML parser does not expose the required DOMParser constructor.'];
  }
  const parserDiagnostics = [];
  let document;
  try {
    document = new DOMParser({
      errorHandler: {
        warning: (message) => parserDiagnostics.push(String(message)),
        error: (message) => parserDiagnostics.push(String(message)),
        fatalError: (message) => parserDiagnostics.push(String(message)),
      },
    }).parseFromString(text, 'application/xml');
  } catch (error) {
    parserDiagnostics.push(error instanceof Error ? error.message : String(error));
  }
  if (parserDiagnostics.length > 0) return parserDiagnostics;
  const documentChildren = Array.from(document?.childNodes ?? []);
  const documentElements = documentChildren.filter((child) => child?.nodeType === 1);
  const nonWhitespaceOutsideRoot = documentChildren.some(
    (child) => child?.nodeType === 3 && String(child.nodeValue ?? '').trim().length > 0,
  );
  const unsupportedOutsideRoot = documentChildren.some(
    (child) => ![1, 3, 7, 8, 10].includes(child?.nodeType),
  );
  if (
    !document?.documentElement ||
    document.documentElement.tagName !== 'plist' ||
    documentElements.length !== 1 ||
    nonWhitespaceOutsideRoot ||
    unsupportedOutsideRoot
  ) {
    return ['The XML document must have exactly one plist document element.'];
  }
  const duplicateKeys = [];
  const walk = (element) => {
    const children = Array.from(element?.childNodes ?? []).filter((child) => child?.nodeType === 1);
    if (element?.tagName === 'dict') {
      const keys = new Set();
      for (const key of children.filter((child) => child?.tagName === 'key')) {
        const value = key.textContent ?? '';
        if (keys.has(value)) duplicateKeys.push(value);
        keys.add(value);
      }
    }
    for (const child of children) walk(child);
  };
  walk(document.documentElement);
  return duplicateKeys.map((key) => `Duplicate plist dictionary key: ${key}.`);
}

function isValidTrackingDomain(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > 253 ||
    /[\\/:?#@*\s]/.test(value) ||
    /^\[.*\]$/.test(value)
  ) {
    return false;
  }
  const labels = value.split('.');
  if (labels.length < 2 || labels.some((label) => label.length < 1 || label.length > 63)) {
    return false;
  }
  if (labels.every((label) => /^\d+$/.test(label))) return false;
  return labels.every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}

export function validatePrivacyManifestBytes({ bytes, path, requiredReasonCategories }) {
  const errors = [];
  const categoryReasons =
    requiredReasonCategories instanceof Map
      ? requiredReasonCategories
      : new Map(
          (requiredReasonCategories ?? []).map(({ category, allowedReasonIds }) => [
            category,
            new Set(allowedReasonIds),
          ]),
        );
  if (!Buffer.isBuffer(bytes)) {
    return {
      status: 'source_invalid',
      errors: [manifestIssue('MANIFEST_BYTES', path, 'Manifest input must be a Buffer.')],
      normalized: null,
    };
  }
  if (bytes.subarray(0, 8).toString('ascii') === 'bplist00') {
    return {
      status: 'source_invalid',
      errors: [
        manifestIssue(
          'MANIFEST_BINARY',
          path,
          'Binary privacy manifests are unsupported for deterministic source review.',
        ),
      ],
      normalized: null,
    };
  }
  let text;
  try {
    text = decodeUtf8(bytes, path);
  } catch (error) {
    return { status: 'source_invalid', errors: [issueFromError(error, path)], normalized: null };
  }
  if (!/<plist(?:\s|>)/.test(text)) {
    return {
      status: 'source_invalid',
      errors: [
        manifestIssue(
          'MANIFEST_XML',
          path,
          'Privacy manifest XML must contain one complete plist document.',
        ),
      ],
      normalized: null,
    };
  }
  const plistStart = text.indexOf('<plist');
  const closingTag = '</plist>';
  const plistEnd = text.lastIndexOf(closingTag);
  if (
    plistStart < 0 ||
    plistEnd < plistStart ||
    !containsOnlyXmlMisc(text.slice(0, plistStart), { allowDoctype: true }) ||
    !containsOnlyXmlMisc(text.slice(plistEnd + closingTag.length), { allowDoctype: false })
  ) {
    return {
      status: 'source_invalid',
      errors: [
        manifestIssue(
          'MANIFEST_XML',
          path,
          'Privacy manifest XML contains non-document content outside the plist root.',
        ),
      ],
      normalized: null,
    };
  }
  const xmlDiagnostics = strictPlistXmlDiagnostics(text);
  if (xmlDiagnostics.length > 0) {
    return {
      status: 'source_invalid',
      errors: [
        manifestIssue(
          'MANIFEST_XML',
          path,
          `Privacy manifest XML failed strict parsing: ${xmlDiagnostics.join(' ')}`,
        ),
      ],
      normalized: null,
    };
  }
  let parsed;
  if (typeof plist?.parse !== 'function') {
    return {
      status: 'source_invalid',
      errors: [
        manifestIssue(
          'MANIFEST_PARSER',
          path,
          'The pinned plist parser does not expose the required parse function.',
        ),
      ],
      normalized: null,
    };
  }
  try {
    parsed = plist.parse(text);
  } catch {
    return {
      status: 'source_invalid',
      errors: [manifestIssue('MANIFEST_XML', path, 'Privacy manifest XML is malformed.')],
      normalized: null,
    };
  }
  if (!isRecord(parsed)) {
    return {
      status: 'source_invalid',
      errors: [
        manifestIssue('MANIFEST_ROOT', path, 'Privacy manifest plist root must be a dictionary.'),
      ],
      normalized: null,
    };
  }
  for (const key of Object.keys(parsed)) {
    if (!PRIVACY_TOP_LEVEL_KEYS.has(key)) {
      errors.push(
        manifestIssue('MANIFEST_UNKNOWN_KEY', path, `Unknown privacy-manifest key: ${key}.`),
      );
    }
  }
  const tracking = parsed.NSPrivacyTracking;
  if (tracking !== undefined && typeof tracking !== 'boolean') {
    errors.push(
      manifestIssue('MANIFEST_TRACKING_TYPE', path, 'NSPrivacyTracking must be a boolean.'),
    );
  }
  const domains = parsed.NSPrivacyTrackingDomains ?? [];
  if (
    !Array.isArray(domains) ||
    domains.some((domain) => !isValidTrackingDomain(domain)) ||
    new Set(domains.map((domain) => (typeof domain === 'string' ? domain.toLowerCase() : domain)))
      .size !== domains.length
  ) {
    errors.push(
      manifestIssue(
        'MANIFEST_TRACKING_DOMAINS',
        path,
        'Tracking domains must be unique bounded hostnames.',
      ),
    );
  }
  if (
    (tracking === false || tracking === undefined) &&
    Array.isArray(domains) &&
    domains.length > 0
  ) {
    errors.push(
      manifestIssue(
        'MANIFEST_TRACKING_CONTRADICTION',
        path,
        'Tracking domains require NSPrivacyTracking=true.',
      ),
    );
  }
  if (tracking === true && (!Array.isArray(domains) || domains.length === 0)) {
    errors.push(
      manifestIssue(
        'MANIFEST_TRACKING_CONTRADICTION',
        path,
        'NSPrivacyTracking=true requires at least one tracking domain.',
      ),
    );
  }

  const accessed = parsed.NSPrivacyAccessedAPITypes;
  const normalizedAccessed = [];
  if (accessed !== undefined) {
    if (!Array.isArray(accessed) || accessed.length === 0) {
      errors.push(
        manifestIssue(
          'MANIFEST_ACCESSED_API_EMPTY',
          path,
          'NSPrivacyAccessedAPITypes must be omitted when no category is declared.',
        ),
      );
    } else {
      const categories = new Set();
      for (const entry of accessed) {
        if (!exactKeys(entry, ACCESSED_API_KEYS)) {
          errors.push(
            manifestIssue(
              'MANIFEST_ACCESSED_API_SHAPE',
              path,
              'Each accessed-API declaration must use the exact Apple keys.',
            ),
          );
          continue;
        }
        const category = entry.NSPrivacyAccessedAPIType;
        const reasons = entry.NSPrivacyAccessedAPITypeReasons;
        if (typeof category !== 'string' || !categoryReasons.has(category)) {
          errors.push(
            manifestIssue(
              'MANIFEST_ACCESSED_API_CATEGORY',
              path,
              `Unknown required-reason category: ${String(category)}.`,
            ),
          );
          continue;
        }
        if (categories.has(category)) {
          errors.push(
            manifestIssue(
              'MANIFEST_ACCESSED_API_DUPLICATE',
              path,
              `Duplicate required-reason category: ${category}.`,
            ),
          );
        }
        categories.add(category);
        if (
          !Array.isArray(reasons) ||
          reasons.length === 0 ||
          reasons.some((reason) => typeof reason !== 'string') ||
          new Set(reasons).size !== reasons.length
        ) {
          errors.push(
            manifestIssue(
              'MANIFEST_REASON_DUPLICATE_OR_EMPTY',
              path,
              `Reasons for ${category} must be non-empty and unique.`,
            ),
          );
          continue;
        }
        const allowed = categoryReasons.get(category);
        for (const reason of reasons) {
          if (!allowed.has(reason)) {
            errors.push(
              manifestIssue(
                'MANIFEST_REASON_MISMATCH',
                path,
                `${reason} is not allowed for ${category}.`,
              ),
            );
          }
        }
        normalizedAccessed.push({ category, reasons: [...reasons].sort() });
      }
    }
  }

  const collected = parsed.NSPrivacyCollectedDataTypes ?? [];
  const normalizedCollected = [];
  if (!Array.isArray(collected)) {
    errors.push(
      manifestIssue(
        'MANIFEST_COLLECTED_TYPE',
        path,
        'NSPrivacyCollectedDataTypes must be an array.',
      ),
    );
  } else {
    const types = new Set();
    for (const entry of collected) {
      if (!exactKeys(entry, COLLECTED_DATA_KEYS)) {
        errors.push(
          manifestIssue(
            'MANIFEST_COLLECTED_SHAPE',
            path,
            'Each collected-data declaration must use the exact Apple keys.',
          ),
        );
        continue;
      }
      const type = entry.NSPrivacyCollectedDataType;
      const linked = entry.NSPrivacyCollectedDataTypeLinked;
      const itemTracking = entry.NSPrivacyCollectedDataTypeTracking;
      const purposes = entry.NSPrivacyCollectedDataTypePurposes;
      if (typeof type !== 'string' || !COLLECTED_DATA_TYPES.has(type)) {
        errors.push(
          manifestIssue(
            'MANIFEST_COLLECTED_NAME',
            path,
            `Unknown Apple collected data type: ${String(type)}.`,
          ),
        );
        continue;
      }
      if (types.has(type)) {
        errors.push(
          manifestIssue(
            'MANIFEST_COLLECTED_DUPLICATE',
            path,
            `Duplicate collected data type: ${type}.`,
          ),
        );
      }
      types.add(type);
      if (typeof linked !== 'boolean' || typeof itemTracking !== 'boolean') {
        errors.push(
          manifestIssue(
            'MANIFEST_COLLECTED_BOOLEAN',
            path,
            `Collected data booleans are invalid for ${type}.`,
          ),
        );
      }
      if (
        !Array.isArray(purposes) ||
        purposes.length === 0 ||
        purposes.some(
          (purpose) => typeof purpose !== 'string' || !COLLECTED_DATA_PURPOSES.has(purpose),
        ) ||
        new Set(purposes).size !== purposes.length
      ) {
        errors.push(
          manifestIssue(
            'MANIFEST_COLLECTED_PURPOSE',
            path,
            `Purposes for ${type} must be recognized Apple values, non-empty, and unique.`,
          ),
        );
      }
      if (itemTracking === true && tracking !== true) {
        errors.push(
          manifestIssue(
            'MANIFEST_TRACKING_CONTRADICTION',
            path,
            `${type} is tracking data but top-level tracking is not true.`,
          ),
        );
      }
      normalizedCollected.push({
        dataType: type,
        linked: typeof linked === 'boolean' ? linked : null,
        tracking: typeof itemTracking === 'boolean' ? itemTracking : null,
        purposes: Array.isArray(purposes) ? [...purposes].sort() : [],
      });
    }
  }

  errors.sort(issueSort);
  return {
    status: errors.length ? 'source_invalid' : 'source_valid',
    errors,
    normalized:
      errors.length === 0
        ? Object.freeze({
            accessedApiTypes: normalizedAccessed.sort((a, b) =>
              compareText(a.category, b.category),
            ),
            collectedDataTypes: normalizedCollected.sort((a, b) =>
              compareText(a.dataType, b.dataType),
            ),
            tracking: tracking ?? null,
            trackingDomains: Array.isArray(domains)
              ? domains.map((domain) => domain.toLowerCase()).sort()
              : [],
          })
        : null,
  };
}

function nativeRootSignal(names, packageJson) {
  const signals = new Set();
  for (const name of names) {
    if (/\.(?:podspec|podspec\.json)$/i.test(name)) signals.add('podspec');
    if (/\.(?:xcframework|framework|a|dylib)$/i.test(name)) signals.add('native-binary');
    if (
      [
        'ios',
        'apple',
        'macos',
        'prebuilds',
        'sdks',
        'React',
        'ReactCommon',
        'third-party-podspecs',
      ].includes(name)
    ) {
      signals.add(name);
    }
    if (name === 'Package.swift' || name === 'spm.config.json') signals.add(name);
  }
  if (packageJson && Object.prototype.hasOwnProperty.call(packageJson, 'react-native')) {
    signals.add('react-native-field');
  }
  return [...signals].sort();
}

function checkedTraversalDirectory(root, absolute, path, expectedIdentity = null) {
  const stat = lstatSync(absolute, { bigint: true });
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail('PATH_SYMLINK', 'Traversal directories must be real directories, not links.', path);
  }
  if (expectedIdentity && !sameIdentity(stat, expectedIdentity)) {
    fail('PATH_RACE', 'Traversal directory identity changed.', path);
  }
  const real = realpathSync(absolute);
  if (!withinRoot(root, real))
    fail('PATH_ESCAPE', 'Traversal directory escapes the repository.', path);
  return stat;
}

function assertSafeTreeEntryName(name, path) {
  if (!name || /[\0-\x1f\x7f]/.test(name) || name.includes('/') || name.includes('\\')) {
    fail('TREE_ENTRY_NAME', 'Native source entry name contains unsafe characters.', path);
  }
}

function walkNativePackage(root, packagePath, bounds, totalCounter) {
  const packageDir = checkedPath(root, packagePath, 'directory');
  const manifests = [];
  const podspecs = [];
  const xcframeworks = [];
  const frameworks = [];
  const nativeBinaryFiles = [];
  let entries = 0;
  const stack = [
    {
      absolute: packageDir.absolute,
      relative: packagePath,
      depth: 0,
      identity: packageDir.identity,
    },
  ];
  while (stack.length) {
    const current = stack.pop();
    if (current.depth > bounds.maxWalkDepth) {
      fail('WALK_DEPTH', 'Native package traversal exceeded the depth bound.', current.relative);
    }
    checkedTraversalDirectory(root, current.absolute, current.relative, current.identity);
    const children = readdirSync(current.absolute, { withFileTypes: true }).sort((a, b) =>
      compareText(a.name, b.name),
    );
    for (const child of children) {
      if (child.name === 'node_modules' || child.name === '.git' || child.name === '.bin') continue;
      assertSafeTreeEntryName(child.name, `${current.relative}/${child.name}`);
      entries += 1;
      totalCounter.count += 1;
      if (
        entries > bounds.maxNativePackageEntries ||
        totalCounter.count > bounds.maxTotalWalkEntries
      ) {
        fail('WALK_COUNT', 'Native source traversal exceeded the entry bound.', packagePath);
      }
      const relativePath = `${current.relative}/${child.name}`;
      const absolutePath = join(current.absolute, child.name);
      const childStat = lstatSync(absolutePath, { bigint: true });
      if (childStat.isSymbolicLink()) {
        fail(
          'PATH_SYMLINK',
          'Native package source contains a symbolic link or junction.',
          relativePath,
        );
      }
      if (childStat.isDirectory()) {
        const real = realpathSync(absolutePath);
        if (!withinRoot(root, real)) {
          fail(
            'PATH_ESCAPE',
            'Native package source directory escapes the repository.',
            relativePath,
          );
        }
        if (child.name.toLowerCase().endsWith('.xcframework')) {
          xcframeworks.push(relativePath);
        } else if (
          child.name.toLowerCase().endsWith('.framework') &&
          !/\.xcframework\//i.test(relativePath)
        ) {
          frameworks.push(relativePath);
        }
        stack.push({
          absolute: absolutePath,
          relative: relativePath,
          depth: current.depth + 1,
          identity: childStat,
        });
      } else if (childStat.isFile()) {
        if (child.name === 'PrivacyInfo.xcprivacy') manifests.push(relativePath);
        if (/\.(?:podspec|podspec\.json)$/i.test(child.name)) podspecs.push(relativePath);
        if (
          /\.(?:a|dylib)$/i.test(child.name) &&
          !/\.(?:xcframework|framework)\//i.test(relativePath)
        ) {
          nativeBinaryFiles.push(relativePath);
        }
      } else {
        fail(
          'TREE_ENTRY_TYPE',
          'Native package source contains an unsupported special file.',
          relativePath,
        );
      }
    }
  }
  return Object.freeze({
    entryCount: entries,
    manifestPaths: manifests.sort(),
    podspecPaths: podspecs.sort(),
    xcframeworkPaths: xcframeworks.sort(),
    frameworkPaths: frameworks.sort(),
    nativeBinaryFilePaths: nativeBinaryFiles.sort(),
  });
}

function stripRubyComments(text) {
  let inBlockComment = false;
  return text
    .split('\n')
    .map((line) => {
      if (inBlockComment) {
        if (/^\s*=end(?:\s|$)/.test(line)) inBlockComment = false;
        return '';
      }
      if (/^\s*=begin(?:\s|$)/.test(line)) {
        inBlockComment = true;
        return '';
      }
      let quote = null;
      let escaped = false;
      let output = '';
      for (const character of line) {
        if (quote !== null) {
          output += character;
          if (escaped) {
            escaped = false;
          } else if (character === '\\') {
            escaped = true;
          } else if (character === quote) {
            quote = null;
          }
          continue;
        }
        if (character === '"' || character === "'") {
          quote = character;
          output += character;
        } else if (character === '#') {
          break;
        } else {
          output += character;
        }
      }
      return output;
    })
    .join('\n');
}

function rubyResourceAssignmentExpressions(text) {
  const expressions = [];
  let outerQuote = null;
  let outerEscaped = false;
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    const outerCharacter = text[cursor];
    if (outerQuote !== null) {
      if (outerEscaped) {
        outerEscaped = false;
      } else if (outerCharacter === '\\') {
        outerEscaped = true;
      } else if (outerCharacter === outerQuote) {
        outerQuote = null;
      }
      continue;
    }
    if (outerCharacter === '"' || outerCharacter === "'") {
      outerQuote = outerCharacter;
      continue;
    }
    if (outerCharacter !== '.') continue;
    const assignment = text.slice(cursor).match(/^\.(?:resources|resource_bundles)\s*=/);
    if (!assignment) continue;
    const start = cursor + assignment[0].length;
    let index = start;
    let quote = null;
    let escaped = false;
    let depth = 0;
    let sawToken = false;
    for (; index < text.length; index += 1) {
      const character = text[index];
      if (quote !== null) {
        sawToken = true;
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        sawToken = true;
      } else if (character === '{' || character === '[' || character === '(') {
        depth += 1;
        sawToken = true;
      } else if (character === '}' || character === ']' || character === ')') {
        depth = Math.max(0, depth - 1);
        sawToken = true;
      } else if ((character === '\n' || character === ';') && sawToken && depth === 0) {
        break;
      } else if (!/\s/.test(character)) {
        sawToken = true;
      }
    }
    expressions.push(text.slice(start, index));
    cursor = Math.max(cursor, index - 1);
  }
  return expressions;
}

function parsePodspec(file) {
  const text = decodeUtf8(file.bytes, file.relative);
  const dependencyMap = new Map();
  const privacyResourceRefs = new Set();
  const format = file.relative.toLowerCase().endsWith('.json') ? 'json' : 'ruby_source_text';
  if (file.relative.toLowerCase().endsWith('.json')) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      fail('PODSPEC_JSON', 'Podspec JSON is malformed.', file.relative);
    }
    if (!isRecord(parsed))
      fail('PODSPEC_JSON', 'Podspec JSON root must be an object.', file.relative);
    if (isRecord(parsed.dependencies)) {
      for (const [name, constraint] of Object.entries(parsed.dependencies)) {
        dependencyMap.set(
          name,
          Array.isArray(constraint) ? constraint.map(String).sort() : [String(constraint)],
        );
      }
    }
    const scanResource = (value) => {
      if (typeof value === 'string' && value.includes('PrivacyInfo.xcprivacy')) {
        privacyResourceRefs.add(value);
      } else if (Array.isArray(value)) {
        value.forEach(scanResource);
      } else if (isRecord(value)) {
        Object.values(value).forEach(scanResource);
      }
    };
    scanResource(parsed.resources);
    scanResource(parsed.resource_bundles);
  } else {
    const uncommented = stripRubyComments(text);
    const dependencyPattern =
      /\.dependency\s*(?:\(\s*)?["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/g;
    for (const match of uncommented.matchAll(dependencyPattern)) {
      const constraints = dependencyMap.get(match[1]) ?? [];
      if (match[2]) constraints.push(match[2]);
      dependencyMap.set(match[1], [...new Set(constraints)].sort());
    }
    const resourcePattern = /["']([^"']*PrivacyInfo\.xcprivacy)["']/g;
    for (const expression of rubyResourceAssignmentExpressions(uncommented)) {
      for (const match of expression.matchAll(resourcePattern)) privacyResourceRefs.add(match[1]);
    }
  }
  return Object.freeze({
    dependencies: [...dependencyMap.entries()]
      .map(([name, constraints]) => ({
        name,
        constraints,
        evidenceType:
          format === 'json' ? 'podspec_json_dependency' : 'source_text_podspec_dependency',
      }))
      .sort((a, b) => compareText(a.name, b.name)),
    format,
    privacyManifestReferenceEvidenceType:
      format === 'json'
        ? 'podspec_json_resource_declaration'
        : 'podspec_source_resource_assignment_token',
    privacyManifestResourceReferences: [...privacyResourceRefs].sort(),
  });
}

function bindPrivacyResourceReference({
  podspecPath,
  packagePath,
  reference,
  evidenceType,
  manifestPaths,
}) {
  if (
    typeof reference !== 'string' ||
    !reference ||
    reference !== reference.trim() ||
    reference.includes('\\') ||
    reference.includes('\0') ||
    posix.isAbsolute(reference) ||
    /^[A-Za-z]:/.test(reference) ||
    /[*?{}[\]$#%]/.test(reference) ||
    !/(?:^|\/)PrivacyInfo\.xcprivacy$/.test(reference)
  ) {
    fail(
      'PODSPEC_PRIVACY_RESOURCE',
      `Privacy manifest resource reference is not an exact relative source path: ${String(reference)}.`,
      podspecPath,
    );
  }
  const resolvedPath = posix.normalize(posix.join(posix.dirname(podspecPath), reference));
  if (resolvedPath !== packagePath && !resolvedPath.startsWith(`${packagePath}/`)) {
    fail(
      'PODSPEC_PRIVACY_RESOURCE_ESCAPE',
      `Privacy manifest resource reference escapes package ${packagePath}: ${reference}.`,
      podspecPath,
    );
  }
  if (!manifestPaths.has(resolvedPath)) {
    fail(
      'PODSPEC_PRIVACY_RESOURCE_MISSING',
      `Privacy manifest resource reference does not bind to an inventoried manifest: ${reference}.`,
      podspecPath,
    );
  }
  return Object.freeze({
    archiveInclusionProven: false,
    evidenceType,
    reference,
    resolvedPath,
    status:
      evidenceType === 'podspec_json_resource_declaration'
        ? 'source_reference_bound'
        : 'source_reference_candidate',
  });
}

function hashFileStreaming(absolute, maximumBytes, path) {
  const initial = lstatSync(absolute, { bigint: true });
  if (initial.isSymbolicLink() || !initial.isFile() || initial.size > BigInt(maximumBytes)) {
    fail('XCFRAMEWORK_FILE', 'XCFramework member is linked, non-regular, or oversized.', path);
  }
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(1024 * 1024);
  let descriptor;
  let bytes = 0;
  try {
    descriptor = openSync(absolute, constants.O_RDONLY);
    const opened = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(initial, opened) || opened.size > BigInt(maximumBytes)) {
      fail('PATH_RACE', 'XCFramework member identity or size changed.', path);
    }
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      bytes += count;
      if (bytes > maximumBytes) {
        fail('XCFRAMEWORK_FILE', 'XCFramework member grew beyond the size bound.', path);
      }
      hash.update(buffer.subarray(0, count));
    }
    const finished = fstatSync(descriptor, { bigint: true });
    if (
      !sameIdentity(opened, finished) ||
      BigInt(bytes) !== finished.size ||
      opened.mtimeNs !== finished.mtimeNs
    ) {
      fail('PATH_RACE', 'XCFramework member changed while hashing.', path);
    }
    return { bytes, sha256: hash.digest('hex') };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function hashNativeBundle(root, path, bounds, packageName, packagePath, artifactKind) {
  const tree = checkedPath(root, path, 'directory');
  const files = [];
  let totalBytes = 0;
  const stack = [{ absolute: tree.absolute, relative: '', depth: 0, identity: tree.identity }];
  while (stack.length) {
    const current = stack.pop();
    if (current.depth > bounds.maxWalkDepth)
      fail('XCFRAMEWORK_DEPTH', 'XCFramework depth bound exceeded.', path);
    checkedTraversalDirectory(
      root,
      current.absolute,
      current.relative ? `${path}/${current.relative}` : path,
      current.identity,
    );
    const children = readdirSync(current.absolute, { withFileTypes: true }).sort((a, b) =>
      compareText(a.name, b.name),
    );
    for (const child of children) {
      const member = current.relative ? `${current.relative}/${child.name}` : child.name;
      const fullPath = `${path}/${member}`;
      assertSafeTreeEntryName(child.name, fullPath);
      const absolutePath = join(current.absolute, child.name);
      const childStat = lstatSync(absolutePath, { bigint: true });
      if (childStat.isSymbolicLink()) {
        fail('XCFRAMEWORK_SYMLINK', 'XCFramework trees must not contain links.', fullPath);
      }
      if (childStat.isDirectory()) {
        const real = realpathSync(absolutePath);
        if (!withinRoot(root, real)) {
          fail('PATH_ESCAPE', 'XCFramework directory escapes the repository.', fullPath);
        }
        stack.push({
          absolute: absolutePath,
          relative: member,
          depth: current.depth + 1,
          identity: childStat,
        });
      } else if (childStat.isFile()) {
        if (files.length >= bounds.maxXcframeworkFiles) {
          fail('XCFRAMEWORK_COUNT', 'XCFramework file-count bound exceeded.', path);
        }
        const hashed = hashFileStreaming(absolutePath, bounds.maxXcframeworkFileBytes, fullPath);
        totalBytes += hashed.bytes;
        if (totalBytes > bounds.maxXcframeworkBytes) {
          fail('XCFRAMEWORK_SIZE', 'XCFramework total-size bound exceeded.', path);
        }
        files.push({ path: member, bytes: hashed.bytes, sha256: hashed.sha256 });
      } else {
        fail(
          'XCFRAMEWORK_FILE',
          'XCFramework tree contains an unsupported special file.',
          fullPath,
        );
      }
    }
  }
  files.sort((a, b) => compareText(a.path, b.path));
  return Object.freeze({
    path,
    packageName,
    packagePath,
    artifactName: basename(path),
    artifactKind,
    fileCount: files.length,
    totalBytes,
    treeSha256: sha256(Buffer.from(canonicalAuditJson(files), 'utf8')),
    privacyManifestPaths: files
      .filter(
        ({ path: member }) =>
          member.endsWith('/PrivacyInfo.xcprivacy') || member === 'PrivacyInfo.xcprivacy',
      )
      .map(({ path: member }) => `${path}/${member}`),
    sourceCandidate: true,
    archiveInclusionProven: false,
    signatureProven: false,
    status: 'archive_required',
  });
}

function hashNativeBinarySourceFile(root, path, bounds, packageName, packagePath) {
  const file = checkedPath(root, path, 'file');
  const hashed = hashFileStreaming(file.absolute, bounds.maxXcframeworkFileBytes, path);
  return Object.freeze({
    path,
    packageName,
    packagePath,
    artifactName: basename(path),
    artifactKind: path.toLowerCase().endsWith('.dylib') ? 'dylib' : 'static_library',
    bytes: hashed.bytes,
    sha256: hashed.sha256,
    sourceCandidate: true,
    archiveInclusionProven: false,
    signatureProven: false,
    status: 'archive_required',
  });
}

function mappingErrors({ mapping, baseline, lock, lockFile, root }) {
  const errors = [];
  if (
    mapping.generatedAgainst.baselinePath !== IOS_PRIVACY_BASELINE_PATH ||
    mapping.generatedAgainst.baselineSchemaVersion !== baseline.value.schemaVersion ||
    mapping.generatedAgainst.sha256 !== baseline.file.sha256
  ) {
    errors.push(
      issue(
        'MAPPING_BASELINE_DRIFT',
        IOS_PRIVACY_MAPPING_PATH,
        'Mapping baseline path/schema/hash do not match the exact baseline bytes.',
      ),
    );
  }
  const packageNames = new Set();
  for (const entry of mapping.mappings) {
    const prefix = `${IOS_PRIVACY_MAPPING_PATH}#${entry.packageName}`;
    if (packageNames.has(entry.packageName)) {
      errors.push(
        issue('MAPPING_DUPLICATE_PACKAGE', prefix, 'Mapping package names must be unique.'),
      );
    }
    packageNames.add(entry.packageName);
    if (
      typeof entry.packageName !== 'string' ||
      typeof entry.version !== 'string' ||
      entry.archiveRequired !== true ||
      entry.notes.evidenceLevel !== 'source_candidate'
    ) {
      errors.push(
        issue(
          'MAPPING_VALUE',
          prefix,
          'Mapping identity, version, evidence level, and archiveRequired must be exact source-candidate values.',
        ),
      );
    }
    if (
      entry.lockIntegrity.packageLockPath !== IOS_PRIVACY_LOCKFILE_PATH ||
      entry.lockIntegrity.packageLockSha256 !== lockFile.sha256
    ) {
      errors.push(
        issue(
          'MAPPING_LOCK_DRIFT',
          prefix,
          'Mapping package-lock path/hash do not match current bytes.',
        ),
      );
    }
    for (const expected of entry.lockIntegrity.entries) {
      const actual = lock.packages[expected.path];
      if (
        !isRecord(actual) ||
        actual.version !== expected.version ||
        actual.integrity !== expected.integrity
      ) {
        errors.push(
          issue(
            'MAPPING_LOCK_ENTRY_DRIFT',
            expected.path,
            'Mapped lock entry version/integrity drifted.',
          ),
        );
      }
    }
    for (const pin of entry.notes.sourcePins) {
      if (!SHA256.test(String(pin.sha256 ?? ''))) {
        errors.push(issue('MAPPING_SOURCE_PIN', pin.path, 'Source-pin SHA-256 is invalid.'));
        continue;
      }
      try {
        const file = readBoundedFile(root, pin.path, MAX_PODSPEC_BYTES);
        if (file.sha256 !== pin.sha256) {
          errors.push(
            issue('MAPPING_SOURCE_PIN_DRIFT', pin.path, 'Mapped source-pin hash drifted.'),
          );
        }
      } catch (error) {
        errors.push(issueFromError(error, pin.path));
      }
    }
    for (const match of entry.appleSdkMatches) {
      if (
        !baseline.sdkNames.has(match.canonicalName) ||
        !['direct_source_candidate', 'source_candidate'].includes(match.status) ||
        typeof match.matchBasis !== 'string' ||
        match.matchBasis.trim().length < 20
      ) {
        errors.push(
          issue('MAPPING_APPLE_MATCH', prefix, 'Apple SDK match name/status/basis is invalid.'),
        );
      }
    }
    if (
      new Set(entry.nativeArtifactNames).size !== entry.nativeArtifactNames.length ||
      entry.nativeArtifactNames.some(
        (name) => typeof name !== 'string' || !/\.(?:framework|xcframework)$/.test(name),
      )
    ) {
      errors.push(
        issue(
          'MAPPING_NATIVE_ARTIFACTS',
          prefix,
          'Native artifact names must be unique framework/XCFramework names.',
        ),
      );
    }
    const inventory = entry.notes.nativeInventory;
    const podfilePathIsExact = inventory.podfileLock.path === 'apps/mobile/ios/Podfile.lock';
    let podfileExists = false;
    if (podfilePathIsExact) {
      try {
        podfileExists = tryCheckedPath(root, 'apps/mobile/ios/Podfile.lock', 'file') !== null;
      } catch (error) {
        errors.push(issueFromError(error, 'apps/mobile/ios/Podfile.lock'));
        podfileExists = true;
      }
    }
    if (
      !podfilePathIsExact ||
      inventory.podfileLock.status !== 'absent' ||
      inventory.podfileLock.sha256 !== null ||
      podfileExists ||
      inventory.privacyManifestLedger.status !== 'unavailable_without_release_archive' ||
      inventory.privacyManifestLedger.sha256 !== null ||
      inventory.xcframeworkLedger.status !== 'unavailable_without_release_archive' ||
      inventory.xcframeworkLedger.sha256 !== null
    ) {
      errors.push(
        issue(
          'MAPPING_ARCHIVE_CLAIM',
          prefix,
          'Mapping native inventory must retain exact absent/archive-required claims.',
        ),
      );
    }
  }
  return errors.sort(issueSort);
}

function validateLockfile(file) {
  if (
    file.value.lockfileVersion !== 3 ||
    !isRecord(file.value.packages) ||
    typeof file.value.name !== 'string'
  ) {
    fail(
      'LOCKFILE_SCHEMA',
      'package-lock.json must use npm lockfile v3 with a packages object.',
      file.relative,
    );
  }
  return file.value;
}

function packageNameFromPath(path) {
  const marker = path.lastIndexOf('node_modules/');
  const tail = marker >= 0 ? path.slice(marker + 'node_modules/'.length) : path;
  const parts = tail.split('/');
  return parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1] ?? ''}` : parts[0];
}

function buildIntersections({
  mapping,
  podspecs,
  xcframeworks,
  frameworks,
  baseline,
  invalidPackages,
}) {
  const intersections = [];
  const keys = new Set();
  const add = (entry) => {
    const key = `${entry.canonicalName}\0${entry.packageName}\0${entry.matchType}\0${entry.evidencePath}`;
    if (!keys.has(key)) {
      keys.add(key);
      intersections.push(entry);
    }
  };
  for (const entry of mapping.mappings) {
    for (const match of entry.appleSdkMatches) {
      add({
        canonicalName: match.canonicalName,
        packageName: entry.packageName,
        packageVersion: entry.version,
        matchType: match.status,
        matchBasis: match.matchBasis,
        evidencePath: entry.notes.sourcePins[0]?.path ?? IOS_PRIVACY_MAPPING_PATH,
        archiveInclusionProven: false,
        signatureProven: false,
        status: invalidPackages.has(entry.packageName) ? 'source_invalid' : 'archive_required',
      });
    }
  }
  for (const podspec of podspecs) {
    for (const dependency of podspec.dependencies) {
      if (!baseline.sdkNames.has(dependency.name)) continue;
      add({
        canonicalName: dependency.name,
        packageName: podspec.packageName,
        packageVersion: podspec.packageVersion,
        matchType: dependency.evidenceType,
        matchBasis:
          dependency.evidenceType === 'podspec_json_dependency'
            ? `Exact case-sensitive dependency key ${dependency.name} in parsed podspec JSON ${podspec.path}.`
            : `Case-sensitive dependency token ${dependency.name} in comment-stripped podspec source text ${podspec.path}; Ruby evaluation and archive inclusion are not claimed.`,
        evidencePath: podspec.path,
        archiveInclusionProven: false,
        signatureProven: false,
        status: invalidPackages.has(podspec.packageName) ? 'source_invalid' : 'archive_required',
      });
    }
  }
  for (const framework of xcframeworks) {
    const name = framework.artifactName.replace(/\.xcframework$/, '');
    if (!baseline.sdkNames.has(name)) continue;
    add({
      canonicalName: name,
      packageName: framework.packageName,
      packageVersion: null,
      matchType: 'exact_xcframework_basename',
      matchBasis: `Exact case-sensitive XCFramework source-candidate basename ${framework.artifactName} at ${framework.path}.`,
      evidencePath: framework.path,
      archiveInclusionProven: false,
      signatureProven: false,
      status: invalidPackages.has(framework.packageName) ? 'source_invalid' : 'archive_required',
    });
  }
  for (const framework of frameworks) {
    const name = framework.artifactName.replace(/\.framework$/, '');
    if (!baseline.sdkNames.has(name)) continue;
    add({
      canonicalName: name,
      packageName: framework.packageName,
      packageVersion: null,
      matchType: 'exact_framework_basename',
      matchBasis: `Exact case-sensitive Framework source-candidate basename ${framework.artifactName} at ${framework.path}.`,
      evidencePath: framework.path,
      archiveInclusionProven: false,
      signatureProven: false,
      status: invalidPackages.has(framework.packageName) ? 'source_invalid' : 'archive_required',
    });
  }
  return intersections.sort(
    (a, b) =>
      compareText(a.canonicalName, b.canonicalName) ||
      compareText(a.packageName, b.packageName) ||
      compareText(a.matchType, b.matchType) ||
      compareText(a.evidencePath, b.evidencePath),
  );
}

export function validateIosPrivacyAuditClaims(report) {
  if (!isRecord(report) || !exactKeys(report.claims, Object.keys(FALSE_ARCHIVE_CLAIMS))) {
    fail('AUDIT_CLAIMS_SCHEMA', 'Audit claims must use the exact false-claim boundary.', null);
  }
  for (const [key, expected] of Object.entries(FALSE_ARCHIVE_CLAIMS)) {
    if (report.claims[key] !== expected) {
      fail('AUDIT_FALSE_CLAIM', `${key} must remain false in a source-only audit.`, null);
    }
  }
  const seen = new WeakSet();
  const inspect = (value, path = '$') => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (SOURCE_ONLY_FALSE_KEYS.has(key) && child !== false) {
        fail('AUDIT_FALSE_CLAIM', `${childPath} must remain false in a source-only audit.`, null);
      }
      inspect(child, childPath);
    }
  };
  inspect(report);
  if (!['source_valid', 'source_invalid', 'archive_required'].includes(report.status)) {
    fail('AUDIT_STATUS', 'Audit status is invalid.', null);
  }
  return true;
}

export function auditIosPrivacySource(options = {}) {
  const errors = [];
  const warnings = [];
  const root = checkedRoot(options.root ?? process.cwd());
  const bounds = validatedBounds(options.bounds);
  let baselineFile;
  let mappingFile;
  let lockFile;
  let baseline;
  let mapping;
  let lock;
  try {
    baselineFile = readJson(root, IOS_PRIVACY_BASELINE_PATH, MAX_BASELINE_BYTES);
    baseline = validateBaseline(baselineFile);
  } catch (error) {
    errors.push(issueFromError(error, IOS_PRIVACY_BASELINE_PATH));
  }
  try {
    mappingFile = readJson(root, IOS_PRIVACY_MAPPING_PATH, MAX_MAPPING_BYTES);
    mapping = validateMappingShape(mappingFile);
  } catch (error) {
    errors.push(issueFromError(error, IOS_PRIVACY_MAPPING_PATH));
  }
  try {
    lockFile = readJson(root, IOS_PRIVACY_LOCKFILE_PATH, MAX_LOCKFILE_BYTES);
    lock = validateLockfile(lockFile);
  } catch (error) {
    errors.push(issueFromError(error, IOS_PRIVACY_LOCKFILE_PATH));
  }

  const nativePackages = [];
  const privacyManifests = [];
  const podspecs = [];
  const xcframeworks = [];
  const frameworks = [];
  const nativeBinaryFiles = [];
  const invalidPackages = new Set();
  const totalCounter = { count: 0 };
  if (baseline && mapping && lock && lockFile) {
    errors.push(...mappingErrors({ mapping, baseline, lock, lockFile, root }));
    const mappedNames = new Set(mapping.mappings.map(({ packageName }) => packageName));
    for (const [packagePath, entry] of Object.entries(lock.packages).sort(([a], [b]) =>
      compareText(a, b),
    )) {
      if (!packagePath.includes('node_modules/') || entry?.link === true) continue;
      const packageDir = tryCheckedPath(root, packagePath, 'directory');
      if (!packageDir) continue;
      const pathName = packageNameFromPath(packagePath);
      const rootNames = readdirSync(packageDir.absolute).sort();
      let packageFile;
      let packageJson;
      let packageJsonError = null;
      try {
        packageFile = readJson(root, `${packagePath}/package.json`, MAX_PACKAGE_JSON_BYTES);
        packageJson = packageFile.value;
      } catch (error) {
        packageJsonError = issueFromError(error, `${packagePath}/package.json`);
      }
      const rootSignals = nativeRootSignal(rootNames, packageJson);
      if (packageJsonError) rootSignals.push('package-json-invalid');
      if (rootSignals.length === 0 && !mappedNames.has(packageJson?.name ?? pathName)) continue;
      const packageErrors = [];
      if (packageJsonError) packageErrors.push(packageJsonError);
      const name = typeof packageJson?.name === 'string' ? packageJson.name : pathName;
      const version = typeof packageJson?.version === 'string' ? packageJson.version : null;
      if (name !== pathName) {
        packageErrors.push(
          issue(
            'PACKAGE_NAME_DRIFT',
            packagePath,
            'Installed package name does not match its lock path.',
          ),
        );
      }
      if (version !== entry.version) {
        packageErrors.push(
          issue(
            'PACKAGE_VERSION_DRIFT',
            packagePath,
            'Installed package version does not match package-lock.',
          ),
        );
      }
      if (typeof entry.integrity !== 'string' || !INTEGRITY.test(entry.integrity)) {
        packageErrors.push(
          issue(
            'PACKAGE_INTEGRITY',
            packagePath,
            'Native package lock entry lacks a valid registry integrity.',
          ),
        );
      }
      let inventory;
      try {
        inventory = walkNativePackage(root, packagePath, bounds, totalCounter);
      } catch (error) {
        packageErrors.push(issueFromError(error, packagePath));
        inventory = {
          entryCount: 0,
          manifestPaths: [],
          podspecPaths: [],
          xcframeworkPaths: [],
          frameworkPaths: [],
          nativeBinaryFilePaths: [],
        };
      }
      const packageManifestPaths = new Set(inventory.manifestPaths);
      const boundPrivacyManifestPaths = new Set();
      const privacyBindingsByPath = new Map();
      const packageManifestRecords = [];
      for (const manifestPath of inventory.manifestPaths) {
        try {
          const file = readBoundedFile(root, manifestPath, bounds.maxPrivacyManifestBytes);
          const validation = validatePrivacyManifestBytes({
            bytes: file.bytes,
            path: manifestPath,
            requiredReasonCategories: baseline.categoryReasons,
          });
          const manifestRecord = {
            path: manifestPath,
            packageName: name,
            packagePath,
            bytes: file.bytes.length,
            sha256: file.sha256,
            status: validation.status,
            normalized: validation.normalized,
            errors: validation.errors,
          };
          privacyManifests.push(manifestRecord);
          packageManifestRecords.push(manifestRecord);
          if (validation.errors.length) packageErrors.push(...validation.errors);
        } catch (error) {
          packageErrors.push(issueFromError(error, manifestPath));
        }
      }
      for (const podspecPath of inventory.podspecPaths) {
        try {
          const file = readBoundedFile(root, podspecPath, bounds.maxPodspecBytes);
          const parsed = parsePodspec(file);
          const bindings = parsed.privacyManifestResourceReferences
            .map((reference) =>
              bindPrivacyResourceReference({
                podspecPath,
                packagePath,
                reference,
                evidenceType: parsed.privacyManifestReferenceEvidenceType,
                manifestPaths: packageManifestPaths,
              }),
            )
            .sort(
              (left, right) =>
                compareText(left.reference, right.reference) ||
                compareText(left.resolvedPath, right.resolvedPath),
            );
          for (const binding of bindings) {
            if (binding.status === 'source_reference_bound') {
              boundPrivacyManifestPaths.add(binding.resolvedPath);
            }
            const current = privacyBindingsByPath.get(binding.resolvedPath) ?? [];
            current.push({ ...binding, podspecPath });
            privacyBindingsByPath.set(binding.resolvedPath, current);
          }
          podspecs.push({
            path: podspecPath,
            packageName: name,
            packageVersion: version,
            packagePath,
            bytes: file.bytes.length,
            sha256: file.sha256,
            status: 'source_valid',
            format: parsed.format,
            dependencies: parsed.dependencies,
            privacyManifestResourceReferences: parsed.privacyManifestResourceReferences,
            privacyManifestResourceBindings: bindings,
          });
        } catch (error) {
          packageErrors.push(issueFromError(error, podspecPath));
        }
      }
      for (const manifest of packageManifestRecords) {
        const bindings = privacyBindingsByPath.get(manifest.path) ?? [];
        const frameworkPath = inventory.xcframeworkPaths.find((candidate) =>
          manifest.path.startsWith(`${candidate}/`),
        );
        if (frameworkPath) {
          bindings.push({
            archiveInclusionProven: false,
            evidenceType: 'xcframework_source_container',
            reference: null,
            resolvedPath: manifest.path,
            status: 'source_container_bound',
            xcframeworkPath: frameworkPath,
          });
          boundPrivacyManifestPaths.add(manifest.path);
        }
        bindings.sort(
          (left, right) =>
            compareText(left.evidenceType, right.evidenceType) ||
            compareText(
              left.podspecPath ?? left.xcframeworkPath ?? '',
              right.podspecPath ?? right.xcframeworkPath ?? '',
            ),
        );
        manifest.sourceBindings = bindings;
        const bindingProven = bindings.some((binding) =>
          ['source_reference_bound', 'source_container_bound'].includes(binding.status),
        );
        manifest.bindingStatus = bindingProven ? 'source_reference_bound' : 'archive_required';
        if (!bindingProven) {
          warnings.push(
            issue(
              'MANIFEST_BINDING_ARCHIVE_REQUIRED',
              manifest.path,
              'No exact podspec or XCFramework source-container binding was proven; archive inspection is required.',
            ),
          );
        }
      }
      for (const frameworkPath of inventory.xcframeworkPaths) {
        try {
          xcframeworks.push(
            hashNativeBundle(root, frameworkPath, bounds, name, packagePath, 'xcframework'),
          );
        } catch (error) {
          packageErrors.push(issueFromError(error, frameworkPath));
        }
      }
      for (const frameworkPath of inventory.frameworkPaths) {
        try {
          frameworks.push(
            hashNativeBundle(root, frameworkPath, bounds, name, packagePath, 'framework'),
          );
        } catch (error) {
          packageErrors.push(issueFromError(error, frameworkPath));
        }
      }
      for (const binaryPath of inventory.nativeBinaryFilePaths) {
        try {
          nativeBinaryFiles.push(
            hashNativeBinarySourceFile(root, binaryPath, bounds, name, packagePath),
          );
        } catch (error) {
          packageErrors.push(issueFromError(error, binaryPath));
        }
      }
      if (packageErrors.length) {
        invalidPackages.add(name);
        errors.push(...packageErrors);
      }
      const archiveRequired = true;
      nativePackages.push({
        packageName: name,
        packagePath,
        version,
        resolved: typeof entry.resolved === 'string' ? entry.resolved : null,
        integrity: typeof entry.integrity === 'string' ? entry.integrity : null,
        packageJsonSha256: packageFile?.sha256 ?? null,
        rootSignals,
        scannedEntryCount: inventory.entryCount,
        privacyManifestPaths: inventory.manifestPaths,
        boundPrivacyManifestPaths: [...boundPrivacyManifestPaths].sort(),
        podspecPaths: inventory.podspecPaths,
        xcframeworkPaths: inventory.xcframeworkPaths,
        frameworkPaths: inventory.frameworkPaths,
        nativeBinaryFilePaths: inventory.nativeBinaryFilePaths,
        status: packageErrors.length
          ? 'source_invalid'
          : archiveRequired
            ? 'archive_required'
            : 'source_valid',
      });
    }
  }

  nativePackages.sort((a, b) => compareText(a.packagePath, b.packagePath));
  privacyManifests.sort((a, b) => compareText(a.path, b.path));
  podspecs.sort((a, b) => compareText(a.path, b.path));
  xcframeworks.sort((a, b) => compareText(a.path, b.path));
  frameworks.sort((a, b) => compareText(a.path, b.path));
  nativeBinaryFiles.sort((a, b) => compareText(a.path, b.path));
  errors.sort(issueSort);
  const intersections =
    baseline && mapping
      ? buildIntersections({
          mapping,
          podspecs,
          xcframeworks,
          frameworks,
          baseline,
          invalidPackages,
        })
      : [];
  const archiveRequired = true;
  warnings.push(
    issue(
      'ARCHIVE_REQUIRED',
      null,
      'A source-only audit cannot prove release-archive inclusion, binary signatures, merged privacy report, privacy labels, or App Store acceptance.',
    ),
  );
  warnings.sort(issueSort);
  const status = errors.length
    ? 'source_invalid'
    : archiveRequired
      ? 'archive_required'
      : 'source_valid';
  const report = {
    schemaVersion: IOS_PRIVACY_AUDIT_SCHEMA_VERSION,
    kind: 'ios_privacy_source_audit',
    status,
    claims: { ...FALSE_ARCHIVE_CLAIMS },
    scope: {
      installedRegistryNativeCandidatesAudited: true,
      allInstalledRegistryPackagesAudited: false,
      nativeCandidateDiscovery:
        'reviewed root signals, mapped packages, or malformed installed package metadata',
      linkedWorkspacePackagesAudited: false,
      firstPartyAppAndExtensionSourcesAudited: false,
      generatedPrebuildAudited: false,
      cocoaPodsResolvedSourcesAudited: false,
      swiftPackageResolvedSourcesAudited: false,
      releaseArchiveAudited: false,
    },
    inputs: {
      baseline: baselineFile
        ? {
            path: IOS_PRIVACY_BASELINE_PATH,
            bytes: baselineFile.bytes.length,
            sha256: baselineFile.sha256,
          }
        : { path: IOS_PRIVACY_BASELINE_PATH, bytes: null, sha256: null },
      mapping: mappingFile
        ? {
            path: IOS_PRIVACY_MAPPING_PATH,
            bytes: mappingFile.bytes.length,
            sha256: mappingFile.sha256,
          }
        : { path: IOS_PRIVACY_MAPPING_PATH, bytes: null, sha256: null },
      packageLock: lockFile
        ? { path: IOS_PRIVACY_LOCKFILE_PATH, bytes: lockFile.bytes.length, sha256: lockFile.sha256 }
        : { path: IOS_PRIVACY_LOCKFILE_PATH, bytes: null, sha256: null },
    },
    summary: {
      nativePackageCount: nativePackages.length,
      privacyManifestCount: privacyManifests.length,
      validPrivacyManifestCount: privacyManifests.filter(
        ({ status: value }) => value === 'source_valid',
      ).length,
      invalidPrivacyManifestCount: privacyManifests.filter(
        ({ status: value }) => value === 'source_invalid',
      ).length,
      manifestBindingArchiveRequiredCount: privacyManifests.filter(
        ({ bindingStatus }) => bindingStatus === 'archive_required',
      ).length,
      podspecCount: podspecs.length,
      xcframeworkSourceCandidateCount: xcframeworks.length,
      frameworkSourceCandidateCount: frameworks.length,
      nativeBinaryFileSourceCandidateCount: nativeBinaryFiles.length,
      appleSdkIntersectionCount: intersections.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    ledgerHashes: {
      nativePackagesSha256: sha256(Buffer.from(canonicalAuditJson(nativePackages))),
      privacyManifestsSha256: sha256(Buffer.from(canonicalAuditJson(privacyManifests))),
      podspecsSha256: sha256(Buffer.from(canonicalAuditJson(podspecs))),
      xcframeworksSha256: sha256(Buffer.from(canonicalAuditJson(xcframeworks))),
      frameworksSha256: sha256(Buffer.from(canonicalAuditJson(frameworks))),
      nativeBinaryFilesSha256: sha256(Buffer.from(canonicalAuditJson(nativeBinaryFiles))),
      appleSdkIntersectionsSha256: sha256(Buffer.from(canonicalAuditJson(intersections))),
    },
    nativePackages,
    privacyManifests,
    podspecs,
    xcframeworkSourceCandidates: xcframeworks,
    frameworkSourceCandidates: frameworks,
    nativeBinaryFileSourceCandidates: nativeBinaryFiles,
    appleSdkIntersections: intersections,
    errors,
    warnings,
  };
  validateIosPrivacyAuditClaims(report);
  return deepFreeze(report);
}

function markdownTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index] ?? '').length)),
  );
  const line = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join(
    '\n',
  );
}

export function renderIosPrivacySourceAuditMarkdown(report) {
  validateIosPrivacyAuditClaims(report);
  const packageRows = report.nativePackages.map((entry) => [
    entry.packageName,
    entry.version ?? '',
    entry.status,
    entry.privacyManifestPaths.length,
    entry.podspecPaths.length,
    entry.xcframeworkPaths.length,
    entry.frameworkPaths.length,
    entry.nativeBinaryFilePaths.length,
  ]);
  const manifestRows = report.privacyManifests.map((entry) => [
    entry.path,
    entry.status,
    entry.sha256,
  ]);
  const intersectionRows = report.appleSdkIntersections.map((entry) => [
    entry.canonicalName,
    entry.packageName,
    entry.matchType,
    entry.status,
    entry.evidencePath,
  ]);
  const issueList = (values) =>
    values.length
      ? values
          .map(
            (entry) => `- ${entry.code}${entry.path ? ` - ${entry.path}` : ''}: ${entry.message}`,
          )
          .join('\n')
      : '- none';
  return [
    '# iOS Privacy Source Audit',
    '',
    `Status: \`${report.status}\``,
    '',
    'This is a deterministic installed-source and package-lock audit. It does not prove',
    'release-archive inclusion, binary signatures, a merged privacy report, App Store',
    'privacy labels, legal clearance, App Review acceptance, or commercial outcomes.',
    '',
    'Scope is limited to installed non-linked npm registry native candidates discovered',
    'from reviewed root signals, mappings, or malformed metadata. First-party',
    'app/extension sources, linked workspaces, generated prebuild, CocoaPods/SPM',
    'resolution, and the release archive require separate verification.',
    '',
    '## Input bindings',
    '',
    `- Baseline: \`${report.inputs.baseline.path}\` - \`${report.inputs.baseline.sha256 ?? 'unavailable'}\``,
    `- Mapping: \`${report.inputs.mapping.path}\` - \`${report.inputs.mapping.sha256 ?? 'unavailable'}\``,
    `- Package lock: \`${report.inputs.packageLock.path}\` - \`${report.inputs.packageLock.sha256 ?? 'unavailable'}\``,
    '',
    '## Summary',
    '',
    `- Native packages: ${report.summary.nativePackageCount}`,
    `- Privacy manifests: ${report.summary.privacyManifestCount} (${report.summary.validPrivacyManifestCount} source-valid; ${report.summary.invalidPrivacyManifestCount} source-invalid)`,
    `- Manifest bindings requiring archive verification: ${report.summary.manifestBindingArchiveRequiredCount}`,
    `- Podspecs: ${report.summary.podspecCount}`,
    `- XCFramework source candidates: ${report.summary.xcframeworkSourceCandidateCount}`,
    `- Framework source candidates: ${report.summary.frameworkSourceCandidateCount}`,
    `- Static-library/dylib source candidates: ${report.summary.nativeBinaryFileSourceCandidateCount}`,
    `- Exact Apple-list intersections: ${report.summary.appleSdkIntersectionCount}`,
    '',
    '## Native package ledger',
    '',
    packageRows.length
      ? markdownTable(
          [
            'Package',
            'Version',
            'Status',
            'Manifests',
            'Podspecs',
            'XCFrameworks',
            'Frameworks',
            'Binary files',
          ],
          packageRows,
        )
      : '_No native packages inventoried._',
    '',
    '## Privacy manifest ledger',
    '',
    manifestRows.length
      ? markdownTable(['Path', 'Status', 'SHA-256'], manifestRows)
      : '_No privacy manifests inventoried._',
    '',
    '## Exact Apple-list intersections',
    '',
    intersectionRows.length
      ? markdownTable(
          ['Apple SDK', 'Package', 'Match basis', 'Status', 'Evidence'],
          intersectionRows,
        )
      : '_No exact source intersections found._',
    '',
    '## Errors',
    '',
    issueList(report.errors),
    '',
    '## Warnings',
    '',
    issueList(report.warnings),
    '',
  ].join('\n');
}
