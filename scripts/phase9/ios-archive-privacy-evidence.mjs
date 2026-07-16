import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { inflateRawSync } from 'node:zlib';

import plist from '@expo/plist';
import { DOMParser } from '@xmldom/xmldom';
import bplistParser from 'bplist-parser';
import forge from 'node-forge';
import { parseDocument } from 'yaml';

const plistParser = plist.default ?? plist;

export const IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION = 1;
export const IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH =
  'docs/phase-9/generated/ios-privacy-source-audit.json';

export const IOS_ARCHIVE_PRIVACY_EVIDENCE_ARTIFACT_NAMES = Object.freeze([
  'nativeLock',
  'privacyManifestLedger',
  'mergedPrivacyReport',
  'requiredReasonApiReport',
  'nativeBinaryLedger',
  'sdkSignatureReport',
  'entitlementsSigningReport',
  'symbolsProcessingReport',
  'trafficStorageReconciliation',
  'appPrivacyAnswers',
]);

export const IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS = Object.freeze({
  maxArchiveBytes: 512 * 1024 * 1024,
  maxArchiveEntries: 25_000,
  maxArchiveEntryBytes: 512 * 1024 * 1024,
  maxArchiveExpandedBytes: 1024 * 1024 * 1024,
  maxArchiveCompressionRatio: 200,
  maxArchiveInfoPlistBytes: 4 * 1024 * 1024,
  maxArchiveMobileProvisionBytes: 16 * 1024 * 1024,
  maxEasBuildLogBytes: 512 * 1024 * 1024,
  maxEvidenceArtifactBytes: 512 * 1024 * 1024,
  maxEvidenceJsonBytes: 4 * 1024 * 1024,
  maxEvidenceJsonDepth: 64,
  maxPathBytes: 4096,
  maxReviewerNameLength: 160,
  maxSourceAuditBytes: 64 * 1024 * 1024,
  maxTotalEvidenceBytes: 16 * 1024 * 1024 * 1024,
});

export const IOS_ARCHIVE_PRIVACY_EVIDENCE_MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'kind',
  'source',
  'archive',
  'build',
  'toolchain',
  'provenance',
  'artifacts',
  'review',
  'attestations',
]);
const SOURCE_KEYS = Object.freeze(['gitSha', 'iosPrivacySourceAudit', 'ledgerHashes']);
const ARCHIVE_KEYS = Object.freeze(['format', 'immutable', 'file']);
const BUILD_KEYS = Object.freeze([
  'appVersion',
  'buildNumber',
  'bundleIdentifier',
  'teamIdentifier',
  'builtAt',
]);
const EXPECTED_BUILD_KEYS = Object.freeze([
  'appVersion',
  'buildNumber',
  'bundleIdentifier',
  'teamIdentifier',
]);
const TOOLCHAIN_KEYS = Object.freeze([
  'easBuildImage',
  'xcodeVersion',
  'iosSdkVersion',
  'nodeVersion',
  'cocoaPodsVersion',
]);
const PROVENANCE_KEYS = Object.freeze([
  'easBuildId',
  'easGitCommitSha',
  'easCliVersion',
  'easBuildLog',
  'macosVersion',
  'xcodeBuild',
  'fastlaneVersion',
]);
const REFERENCE_KEYS = Object.freeze(['path', 'sha256', 'sizeBytes', 'capturedAt']);
const REVIEW_KEYS = Object.freeze(['privacy', 'release']);
const REVIEWER_KEYS = Object.freeze(['name', 'reviewedAt', 'decision']);
const ATTESTATION_KEYS = Object.freeze([
  'archiveInspected',
  'evidenceComplete',
  'sourceAuditMatched',
  'artifactsImmutable',
]);
const LEDGER_HASH_KEYS = Object.freeze([
  'nativePackagesSha256',
  'privacyManifestsSha256',
  'podspecsSha256',
  'xcframeworksSha256',
  'frameworksSha256',
  'nativeBinaryFilesSha256',
  'appleSdkIntersectionsSha256',
]);
const SOURCE_AUDIT_CLAIM_KEYS = Object.freeze([
  'appStoreAcceptanceProven',
  'appStorePrivacyLabelsVerified',
  'archiveInspected',
  'binarySignaturesVerified',
  'mergedPrivacyReportVerified',
]);
const GIT_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const BUNDLE_IDENTIFIER = /^(?=.{3,255}$)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const TEAM_IDENTIFIER = /^[A-Z0-9]{10}$/;
const APP_VERSION = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}$/;
const BUILD_NUMBER = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}$/;
const VERSION = /^v?(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){1,2}$/;
const FULL_EAS_IMAGE = /^macos-[a-z][a-z0-9-]*-(\d+\.\d+(?:\.\d+)?)-xcode-(\d+\.\d+(?:\.\d+)?)$/;
const EAS_BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const XCODE_BUILD = /^\d{1,3}[A-Z][0-9A-Za-z]{1,12}$/;
const CANONICAL_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ZIP_LOCAL_FILE_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const ZIP_MINIMUM_EOCD_BYTES = 22;
const ZIP_MAXIMUM_COMMENT_BYTES = 65_535;
const ZIP64_UINT16_SENTINEL = 0xffff;
const ZIP64_UINT32_SENTINEL = 0xffffffff;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const PLACEHOLDER_REVIEWER =
  /^(?:tbd|blocked|pending|unknown|n\/?a|none|reviewer|privacy reviewer|release reviewer)$/i;
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export class IosArchivePrivacyEvidenceError extends Error {
  constructor(code, message, path = null, options) {
    super(message, options);
    this.name = 'IosArchivePrivacyEvidenceError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, message, path = null, cause) {
  throw new IosArchivePrivacyEvidenceError(code, message, path, cause ? { cause } : undefined);
}

function isRecord(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, path) {
  if (!isRecord(value)) fail('SCHEMA_TYPE', `${path} must be a plain object.`, path);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    fail('SCHEMA_KEYS', `${path} must contain exactly: ${expectedKeys.join(', ')}.`, path);
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function checkedRoot(rootValue) {
  if (typeof rootValue !== 'string' || rootValue.length === 0) {
    fail('ROOT_INVALID', 'root must be a non-empty filesystem path.', 'options.root');
  }
  const absolute = resolve(rootValue);
  let identity;
  try {
    identity = lstatSync(absolute, { bigint: true });
  } catch (error) {
    fail('ROOT_MISSING', 'The evidence root does not exist.', 'options.root', error);
  }
  if (identity.isSymbolicLink() || !identity.isDirectory()) {
    fail('ROOT_INVALID', 'The evidence root must be a real directory, not a link.', 'options.root');
  }
  let real;
  try {
    real = realpathSync(absolute);
  } catch (error) {
    fail('ROOT_REALPATH', 'The evidence root could not be resolved.', 'options.root', error);
  }
  return Object.freeze({ absolute, identity, real });
}

function withinRoot(root, candidate) {
  const fromRoot = relative(root.real, candidate);
  return (
    fromRoot === '' ||
    (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
  );
}

function validatedBounds(overrides) {
  if (overrides === undefined) return IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS;
  if (!isRecord(overrides)) {
    fail('BOUNDS_TYPE', 'options.bounds must be a plain object.', 'options.bounds');
  }
  const keys = Object.keys(overrides);
  for (const key of keys) {
    if (!Object.hasOwn(IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS, key)) {
      fail('BOUNDS_KEY', `Unknown evidence bound: ${key}.`, `options.bounds.${key}`);
    }
    const value = overrides[key];
    const maximum = IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS[key];
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
      fail(
        'BOUNDS_VALUE',
        `${key} must be a positive safe integer no greater than ${maximum}.`,
        `options.bounds.${key}`,
      );
    }
  }
  return Object.freeze({ ...IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS, ...overrides });
}

function normalizeRelativePath(value, bounds, path) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.includes('\\') ||
    value.includes('\0') ||
    isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    Buffer.byteLength(value, 'utf8') > bounds.maxPathBytes
  ) {
    fail(
      'PATH_INVALID',
      'Evidence paths must be bounded normalized repository-relative paths.',
      path,
    );
  }
  const segments = value.split('/');
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment !== segment.trim() ||
        /[\0-\x1f\x7f:*?"<>|]/.test(segment) ||
        segment.endsWith('.') ||
        WINDOWS_RESERVED_SEGMENT.test(segment),
    )
  ) {
    fail('PATH_INVALID', 'Evidence paths contain an unsafe or non-portable segment.', path);
  }
  return value;
}

function checkedFile(root, relativePath, bounds, path) {
  const normalized = normalizeRelativePath(relativePath, bounds, path);
  let rootNow;
  try {
    rootNow = lstatSync(root.absolute, { bigint: true });
  } catch (error) {
    fail('ROOT_RACE', 'The evidence root became unavailable during validation.', path, error);
  }
  if (rootNow.isSymbolicLink() || !rootNow.isDirectory() || !sameIdentity(root.identity, rootNow)) {
    fail('ROOT_RACE', 'The evidence root identity changed during validation.', path);
  }

  let current = root.absolute;
  for (const [index, segment] of normalized.split('/').entries()) {
    current = join(current, segment);
    let identity;
    try {
      identity = lstatSync(current, { bigint: true });
    } catch (error) {
      fail('PATH_MISSING', 'A required evidence file is missing.', normalized, error);
    }
    if (identity.isSymbolicLink()) {
      fail('PATH_SYMLINK', 'Evidence paths must not contain symlinks or junctions.', normalized);
    }
    const final = index === normalized.split('/').length - 1;
    if (!final && !identity.isDirectory()) {
      fail('PATH_TYPE', 'An evidence path parent is not a directory.', normalized);
    }
    if (final && !identity.isFile()) {
      fail('PATH_TYPE', 'Evidence must be a regular file.', normalized);
    }
  }

  let identity;
  try {
    identity = lstatSync(current, { bigint: true });
  } catch (error) {
    fail('PATH_RACE', 'The evidence path changed during inspection.', normalized, error);
  }
  if (identity.isSymbolicLink() || !identity.isFile()) {
    fail('PATH_TYPE', 'Evidence must be a non-link regular file.', normalized);
  }
  if (identity.nlink !== 1n) {
    fail('PATH_HARDLINK', 'Evidence files must have exactly one filesystem link.', normalized);
  }
  let real;
  try {
    real = realpathSync(current);
  } catch (error) {
    fail('PATH_REALPATH', 'An evidence path could not be resolved.', normalized, error);
  }
  if (!withinRoot(root, real)) {
    fail('PATH_ESCAPE', 'An evidence path resolves outside the evidence root.', normalized);
  }
  return Object.freeze({ absolute: current, identity, relative: normalized, real });
}

function inspectFile(
  root,
  relativePath,
  maximumBytes,
  bounds,
  path,
  collectBytes = false,
  requiredTokens = [],
) {
  const file = checkedFile(root, relativePath, bounds, path);
  if (file.identity.size <= 0n || file.identity.size > BigInt(maximumBytes)) {
    fail('FILE_SIZE_BOUND', `Evidence file size must be between 1 and ${maximumBytes}.`, path);
  }
  const digest = createHash('sha256');
  const collectedBytes = collectBytes ? Buffer.alloc(Number(file.identity.size)) : null;
  const prefix = Buffer.alloc(4);
  let prefixBytes = 0;
  const buffer = Buffer.alloc(1024 * 1024);
  const tokenBuffers = requiredTokens.map((token) => Buffer.from(token, 'utf8'));
  const foundTokens = new Set();
  const maximumTokenBytes = tokenBuffers.reduce(
    (maximum, token) => Math.max(maximum, token.length),
    0,
  );
  let tokenTail = Buffer.alloc(0);
  let descriptor;
  let bytesRead = 0n;
  try {
    descriptor = openSync(file.absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      !sameIdentity(file.identity, opened) ||
      opened.size !== file.identity.size ||
      opened.mtimeNs !== file.identity.mtimeNs ||
      opened.size > BigInt(maximumBytes)
    ) {
      fail('PATH_RACE', 'Evidence file identity changed before hashing.', file.relative);
    }
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      const collectedOffset = Number(bytesRead);
      bytesRead += BigInt(count);
      if (bytesRead > BigInt(maximumBytes)) {
        fail('FILE_SIZE_BOUND', 'Evidence file grew beyond its reviewed bound.', file.relative);
      }
      const part = buffer.subarray(0, count);
      if (prefixBytes < prefix.length) {
        const copied = part.copy(prefix, prefixBytes, 0, prefix.length - prefixBytes);
        prefixBytes += copied;
      }
      digest.update(part);
      if (collectedBytes) part.copy(collectedBytes, collectedOffset);
      if (tokenBuffers.length > 0) {
        const searchable = tokenTail.length > 0 ? Buffer.concat([tokenTail, part]) : part;
        for (let index = 0; index < tokenBuffers.length; index += 1) {
          if (!foundTokens.has(index) && searchable.indexOf(tokenBuffers[index]) !== -1) {
            foundTokens.add(index);
          }
        }
        tokenTail = Buffer.from(
          searchable.subarray(Math.max(0, searchable.length - maximumTokenBytes + 1)),
        );
      }
    }
    const finished = fstatSync(descriptor, { bigint: true });
    if (
      !finished.isFile() ||
      finished.nlink !== 1n ||
      !sameIdentity(opened, finished) ||
      opened.size !== finished.size ||
      opened.mtimeNs !== finished.mtimeNs ||
      bytesRead !== finished.size
    ) {
      fail('PATH_RACE', 'Evidence file changed while it was hashed.', file.relative);
    }
  } catch (error) {
    if (error instanceof IosArchivePrivacyEvidenceError) throw error;
    fail('FILE_READ', 'Evidence file could not be read safely.', file.relative, error);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }

  const after = checkedFile(root, file.relative, bounds, path);
  if (
    !sameIdentity(file.identity, after.identity) ||
    after.identity.size !== file.identity.size ||
    after.identity.mtimeNs !== file.identity.mtimeNs ||
    after.real !== file.real
  ) {
    fail('PATH_RACE', 'Evidence file path changed after hashing.', file.relative);
  }
  if (foundTokens.size !== tokenBuffers.length) {
    fail(
      'REFERENCE_CONTENT_BINDING',
      'Referenced build metadata/log is missing a required release-identity value.',
      path,
    );
  }
  return Object.freeze({
    bytes: collectedBytes,
    identity: file.identity,
    path: file.relative,
    prefix,
    sha256: digest.digest('hex'),
    sizeBytes: Number(bytesRead),
  });
}

const CRC32_TABLE = Object.freeze(
  Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return value >>> 0;
  }),
);

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ CRC32_TABLE[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

function readArchiveBytes(source, position, length, path) {
  if (Buffer.isBuffer(source)) {
    if (
      !Number.isSafeInteger(position) ||
      !Number.isSafeInteger(length) ||
      position < 0 ||
      length < 0 ||
      position + length > source.length
    ) {
      fail('ARCHIVE_ZIP_TRUNCATED', 'The ZIP archive ended before a declared record.', path);
    }
    return source.subarray(position, position + length);
  }
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const count = readSync(source, bytes, offset, length - offset, position + offset);
    if (count === 0) {
      fail('ARCHIVE_ZIP_TRUNCATED', 'The ZIP archive ended before a declared record.', path);
    }
    offset += count;
  }
  return bytes;
}

function decodeZipEntryName(bytes, flags, bounds, path) {
  if (bytes.length === 0 || bytes.length > bounds.maxPathBytes) {
    fail('ARCHIVE_ZIP_PATH', 'ZIP entry paths must be non-empty and bounded.', path);
  }
  if ((flags & 0x0800) === 0 && bytes.some((byte) => byte > 0x7f)) {
    fail('ARCHIVE_ZIP_ENCODING', 'Non-ASCII ZIP entry paths must declare UTF-8 encoding.', path);
  }
  let name;
  try {
    name = UTF8.decode(bytes);
  } catch (error) {
    fail('ARCHIVE_ZIP_ENCODING', 'ZIP entry paths must be valid UTF-8.', path, error);
  }
  const directory = name.endsWith('/');
  const pathValue = directory ? name.slice(0, -1) : name;
  const segments = pathValue.split('/');
  if (
    pathValue.length === 0 ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.startsWith('/') ||
    /^[A-Za-z]:/u.test(name) ||
    /[\x00-\x1f\x7f:*?"<>|]/u.test(name) ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        segment !== segment.trim() ||
        segment.endsWith('.') ||
        WINDOWS_RESERVED_SEGMENT.test(segment),
    )
  ) {
    fail('ARCHIVE_ZIP_PATH', 'ZIP entries must use safe normalized repository-style paths.', path);
  }
  return Object.freeze({ directory, name, pathValue });
}

function validateZipExtraFields(bytes, path) {
  const reviewedNonPathExtraFields = new Set([0x000a, 0x5455, 0x5855, 0x7875]);
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) {
      fail('ARCHIVE_ZIP_EXTRA', 'A ZIP extra-field header is truncated.', path);
    }
    const identifier = bytes.readUInt16LE(offset);
    const size = bytes.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + size > bytes.length) {
      fail('ARCHIVE_ZIP_EXTRA', 'A ZIP extra-field value is truncated.', path);
    }
    if (identifier === 0x0001) {
      fail(
        'ARCHIVE_ZIP64_UNSUPPORTED',
        'ZIP64 archives are not accepted by this bounded release validator.',
        path,
      );
    }
    if (!reviewedNonPathExtraFields.has(identifier)) {
      fail(
        'ARCHIVE_ZIP_EXTRA_UNSUPPORTED',
        'ZIP entries may use only reviewed non-path metadata extra fields.',
        path,
      );
    }
    offset += size;
  }
}

function locateZipEndRecord(descriptor, archiveSize, path) {
  if (archiveSize < ZIP_MINIMUM_EOCD_BYTES) {
    fail('ARCHIVE_ZIP_TRUNCATED', 'The ZIP archive is too short for an end record.', path);
  }
  const tailLength = Math.min(archiveSize, ZIP_MINIMUM_EOCD_BYTES + ZIP_MAXIMUM_COMMENT_BYTES);
  const tailOffset = archiveSize - tailLength;
  const tail = readArchiveBytes(descriptor, tailOffset, tailLength, path);
  for (let offset = tail.length - ZIP_MINIMUM_EOCD_BYTES; offset >= 0; offset -= 1) {
    if (tail.readUInt32LE(offset) !== ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = tail.readUInt16LE(offset + 20);
    if (offset + ZIP_MINIMUM_EOCD_BYTES + commentLength === tail.length) {
      return Object.freeze({ bytes: tail.subarray(offset), offset: tailOffset + offset });
    }
  }
  fail(
    'ARCHIVE_ZIP_EOCD',
    'The ZIP archive has no canonical end-of-central-directory record.',
    path,
  );
}

function assertSupportedZipEntry(entry, path) {
  if ((entry.flags & 0x0001) !== 0 || (entry.flags & 0x0040) !== 0) {
    fail('ARCHIVE_ZIP_ENCRYPTED', 'Encrypted ZIP entries are not accepted.', path);
  }
  if ((entry.flags & 0x0020) !== 0) {
    fail('ARCHIVE_ZIP_UNSUPPORTED', 'Patched-data ZIP entries are not accepted.', path);
  }
  if (entry.method !== 0 && entry.method !== 8) {
    fail(
      'ARCHIVE_ZIP_COMPRESSION',
      'ZIP entries must use stored or raw-DEFLATE compression.',
      path,
    );
  }
  const allowedFlags = 0x0808 | (entry.method === 8 ? 0x0006 : 0);
  if ((entry.flags & ~allowedFlags) !== 0) {
    fail(
      'ARCHIVE_ZIP_FLAGS',
      'A ZIP entry uses reserved or unsupported general-purpose flags.',
      path,
    );
  }
}

function validateZipPayload(bytes, entry, bounds, path) {
  let payload;
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.uncompressedSize) {
      fail('ARCHIVE_ZIP_SIZE', 'A stored ZIP entry has inconsistent sizes.', path);
    }
    payload = bytes;
  } else {
    try {
      const inflated = inflateRawSync(bytes, {
        info: true,
        maxOutputLength: bounds.maxArchiveEntryBytes,
      });
      if (inflated.engine.bytesWritten !== bytes.length) {
        fail(
          'ARCHIVE_ZIP_DEFLATE_TRAILING_DATA',
          'A DEFLATE entry contains bytes after its end-of-stream marker.',
          path,
        );
      }
      payload = inflated.buffer;
    } catch (error) {
      if (error instanceof IosArchivePrivacyEvidenceError) throw error;
      fail('ARCHIVE_ZIP_DEFLATE', 'A ZIP entry could not be decompressed safely.', path, error);
    }
  }
  if (payload.length !== entry.uncompressedSize) {
    fail('ARCHIVE_ZIP_SIZE', 'A ZIP entry has an incorrect uncompressed size.', path);
  }
  if (crc32(payload) !== entry.crc32) {
    fail('ARCHIVE_ZIP_CRC', 'A ZIP entry failed its CRC-32 integrity check.', path);
  }
  return payload;
}

function identifyArchiveLayout(format, entries, path) {
  const fileNames = entries.filter((entry) => !entry.directory).map((entry) => entry.name);
  if (format === 'ipa') {
    const appInfoPlists = fileNames.filter((name) =>
      /^Payload\/[^/]+\.app\/Info\.plist$/u.test(name),
    );
    if (appInfoPlists.length !== 1) {
      fail(
        'ARCHIVE_LAYOUT',
        'An IPA must contain exactly one Payload/<name>.app/Info.plist entry.',
        path,
      );
    }
    const appInfoPath = appInfoPlists[0];
    const appRoot = appInfoPath.slice(0, -'/Info.plist'.length);
    if (
      fileNames.some(
        (name) => /^Payload\/[^/]+\.app\//u.test(name) && !name.startsWith(`${appRoot}/`),
      )
    ) {
      fail(
        'ARCHIVE_LAYOUT',
        'An IPA may contain only one direct Payload application bundle.',
        path,
      );
    }
    return Object.freeze({
      appInfoPath,
      appRoot,
      archiveInfoPath: null,
      kind: 'ipa_payload_app',
    });
  }

  const archiveInfoPlists = fileNames.filter((name) =>
    /^[^/]+\.xcarchive\/Info\.plist$/u.test(name),
  );
  if (archiveInfoPlists.length !== 1) {
    fail(
      'ARCHIVE_LAYOUT',
      'An xcarchive ZIP must contain exactly one top-level <name>.xcarchive/Info.plist entry.',
      path,
    );
  }
  const archiveInfoPath = archiveInfoPlists[0];
  const archiveRoot = archiveInfoPath.slice(0, -'/Info.plist'.length);
  const appInfoPlists = fileNames.filter((name) => {
    if (!name.startsWith(`${archiveRoot}/Products/Applications/`)) return false;
    return /^[^/]+\.xcarchive\/Products\/Applications\/[^/]+\.app\/Info\.plist$/u.test(name);
  });
  if (appInfoPlists.length !== 1) {
    fail(
      'ARCHIVE_LAYOUT',
      'An xcarchive ZIP must contain exactly one Products/Applications/<name>.app/Info.plist.',
      path,
    );
  }
  const appInfoPath = appInfoPlists[0];
  const appRoot = appInfoPath.slice(0, -'/Info.plist'.length);
  if (
    fileNames.some(
      (name) =>
        new RegExp(
          `^${archiveRoot.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/Products/Applications/[^/]+\\.app/`,
          'u',
        ).test(name) && !name.startsWith(`${appRoot}/`),
    )
  ) {
    fail(
      'ARCHIVE_LAYOUT',
      'An xcarchive may contain only one direct Products/Applications app bundle.',
      path,
    );
  }
  return Object.freeze({
    appInfoPath,
    appRoot,
    archiveInfoPath,
    archiveRoot,
    kind: 'xcarchive_bundle',
  });
}

const XML_PLIST_VALUE_ELEMENTS = new Set([
  'array',
  'data',
  'date',
  'dict',
  'false',
  'integer',
  'real',
  'string',
  'true',
]);

function assertXml10Characters(value, path) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0d ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff)
    ) {
      continue;
    }
    fail('ARCHIVE_PLIST_XML', 'Archive plists must contain only XML 1.0 characters.', path);
  }
}

function validateXmlDeclaration(xml, path) {
  const declarationStart = xml.search(/<\?xml/iu);
  if (declarationStart === -1) return;
  if (declarationStart !== 0) {
    fail('ARCHIVE_PLIST_XML', 'An XML declaration must be the first plist bytes.', path);
  }
  const declarationEnd = xml.indexOf('?>');
  if (declarationEnd === -1) {
    fail('ARCHIVE_PLIST_XML', 'The archive plist XML declaration is incomplete.', path);
  }
  const declaration = xml.slice(0, declarationEnd + 2);
  if (
    !/^<\?xml\s+version\s*=\s*(["'])1\.0\1(?:\s+encoding\s*=\s*(["'])[Uu][Tt][Ff]-8\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*\?>$/u.test(
      declaration,
    )
  ) {
    fail('ARCHIVE_PLIST_XML', 'Archive plist declarations must use XML 1.0 and UTF-8 bytes.', path);
  }
}

function xmlElementChildren(element, path) {
  const children = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) children.push(child);
    else if (child.nodeType === 8) continue;
    else if (child.nodeType !== 3 || (child.nodeValue ?? '').trim() !== '') {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist containers contain invalid nodes.', path);
    }
  }
  return children;
}

function xmlScalarText(element, path) {
  if (element.attributes.length !== 0) {
    fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist values cannot have attributes.', path);
  }
  let text = '';
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) text += child.nodeValue ?? '';
    else if (child.nodeType !== 8) {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist scalar values must contain only text.', path);
    }
  }
  assertXml10Characters(text, path);
  return text;
}

function validateXmlPlistValue(element, path) {
  const name = element.nodeName;
  if (!XML_PLIST_VALUE_ELEMENTS.has(name)) {
    fail('ARCHIVE_PLIST_GRAMMAR', `Unsupported archive plist value element ${name}.`, path);
  }
  if (name === 'dict') {
    if (element.attributes.length !== 0) {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist dictionaries cannot have attributes.', path);
    }
    const children = xmlElementChildren(element, path);
    if (children.length % 2 !== 0) {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist dictionaries require key/value pairs.', path);
    }
    const keys = new Set();
    for (let index = 0; index < children.length; index += 2) {
      const keyElement = children[index];
      if (keyElement.nodeName !== 'key') {
        fail(
          'ARCHIVE_PLIST_GRAMMAR',
          'Archive plist dictionary entries must begin with key.',
          path,
        );
      }
      const key = xmlScalarText(keyElement, path);
      if (keys.has(key)) {
        fail('ARCHIVE_PLIST_DUPLICATE_KEY', 'Archive plists cannot repeat dictionary keys.', path);
      }
      keys.add(key);
      validateXmlPlistValue(children[index + 1], `${path}.${key}`);
    }
    return;
  }
  if (name === 'array') {
    if (element.attributes.length !== 0) {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist arrays cannot have attributes.', path);
    }
    for (const [index, child] of xmlElementChildren(element, path).entries()) {
      validateXmlPlistValue(child, `${path}[${index}]`);
    }
    return;
  }
  const text = xmlScalarText(element, path);
  if ((name === 'true' || name === 'false') && text !== '') {
    fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist booleans must be empty elements.', path);
  }
  if (name === 'integer') {
    const integer = Number(text);
    if (
      text !== text.trim() ||
      !/^-?(?:0|[1-9]\d*)$/u.test(text) ||
      Object.is(integer, -0) ||
      !Number.isSafeInteger(integer)
    ) {
      fail(
        'ARCHIVE_PLIST_GRAMMAR',
        'Archive plist integers must use canonical safe decimal text.',
        path,
      );
    }
  }
  if (
    name === 'real' &&
    (text !== text.trim() ||
      !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(text) ||
      !Number.isFinite(Number(text)))
  ) {
    fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist real values must be finite numbers.', path);
  }
  if (name === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u.exec(text);
    const milliseconds = match?.[7] ? Number(match[7].padEnd(3, '0')) : 0;
    const timestamp = match ? Date.parse(text) : Number.NaN;
    const date = new Date(timestamp);
    if (
      !match ||
      !Number.isFinite(timestamp) ||
      date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() + 1 !== Number(match[2]) ||
      date.getUTCDate() !== Number(match[3]) ||
      date.getUTCHours() !== Number(match[4]) ||
      date.getUTCMinutes() !== Number(match[5]) ||
      date.getUTCSeconds() !== Number(match[6]) ||
      date.getUTCMilliseconds() !== milliseconds
    ) {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist dates must be valid UTC instants.', path);
    }
  }
  if (name === 'data') {
    const base64 = text.replace(/[\u0009\u000a\u000d\u0020]/gu, '');
    if (
      base64.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(base64) ||
      Buffer.from(base64, 'base64').toString('base64') !== base64
    ) {
      fail('ARCHIVE_PLIST_GRAMMAR', 'Archive plist data values must be canonical base64.', path);
    }
  }
}

function validateXmlPlistDocument(document, path) {
  const plist = document.documentElement;
  const attributes = Array.from(plist.attributes);
  if (
    attributes.length !== 1 ||
    attributes[0].name !== 'version' ||
    attributes[0].value !== '1.0'
  ) {
    fail('ARCHIVE_PLIST_GRAMMAR', 'The archive plist root must declare only version 1.0.', path);
  }
  const values = xmlElementChildren(plist, path);
  if (values.length !== 1) {
    fail('ARCHIVE_PLIST_GRAMMAR', 'The archive plist root must contain exactly one value.', path);
  }
  validateXmlPlistValue(values[0], path);
}

function parseArchivePlist(bytes, bounds, path, maximumBytes = bounds.maxArchiveInfoPlistBytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maximumBytes) {
    fail('ARCHIVE_PLIST_BOUND', 'A required archive Info.plist is empty or too large.', path);
  }
  let value;
  try {
    if (bytes.subarray(0, 8).equals(Buffer.from('bplist00', 'ascii'))) {
      const values = bplistParser.parseBuffer(bytes);
      if (!Array.isArray(values) || values.length !== 1) {
        fail('ARCHIVE_PLIST_SCHEMA', 'A binary Info.plist must contain one root value.', path);
      }
      [value] = values;
    } else {
      const xml = UTF8.decode(bytes);
      assertXml10Characters(xml, path);
      validateXmlDeclaration(xml, path);
      if (/<!ENTITY/iu.test(xml)) {
        fail('ARCHIVE_PLIST_XML', 'XML entity declarations are not accepted.', path);
      }
      const doctypes = xml.match(/<!DOCTYPE[^>]*>/giu) ?? [];
      if (
        doctypes.some(
          (declaration) =>
            !/^<!DOCTYPE\s+plist\s+PUBLIC\s+"-\/\/Apple\/\/DTD PLIST 1\.0\/\/EN"\s+"http:\/\/www\.apple\.com\/DTDs\/PropertyList-1\.0\.dtd"\s*>$/iu.test(
              declaration,
            ),
        )
      ) {
        fail('ARCHIVE_PLIST_XML', 'Only the standard fixed Apple plist DOCTYPE is accepted.', path);
      }
      const xmlDiagnostics = [];
      const document = new DOMParser({
        errorHandler: {
          error(message) {
            xmlDiagnostics.push(message);
          },
          fatalError(message) {
            xmlDiagnostics.push(message);
          },
          warning(message) {
            xmlDiagnostics.push(message);
          },
        },
      }).parseFromString(xml);
      const rootElements = Array.from(document.childNodes).filter((node) => node.nodeType === 1);
      const invalidTopLevelNode = Array.from(document.childNodes).some(
        (node) =>
          ![1, 7, 8, 10].includes(node.nodeType) &&
          !(node.nodeType === 3 && (node.nodeValue ?? '').trim() === ''),
      );
      const plistValues = Array.from(document.documentElement?.childNodes ?? []).filter(
        (node) => node.nodeType === 1,
      );
      const invalidPlistNode = Array.from(document.documentElement?.childNodes ?? []).some(
        (node) =>
          ![1, 8].includes(node.nodeType) &&
          !(node.nodeType === 3 && (node.nodeValue ?? '').trim() === ''),
      );
      if (
        xmlDiagnostics.length > 0 ||
        invalidTopLevelNode ||
        invalidPlistNode ||
        rootElements.length !== 1 ||
        document.documentElement?.nodeName !== 'plist' ||
        plistValues.length !== 1
      ) {
        fail('ARCHIVE_PLIST_PARSE', 'A required archive plist has malformed XML.', path);
      }
      validateXmlPlistDocument(document, path);
      value = plistParser.parse(xml);
    }
  } catch (error) {
    if (error instanceof IosArchivePrivacyEvidenceError) throw error;
    fail('ARCHIVE_PLIST_PARSE', 'A required archive Info.plist is malformed.', path, error);
  }
  if (!isRecord(value)) {
    fail('ARCHIVE_PLIST_SCHEMA', 'A required archive Info.plist must contain a dictionary.', path);
  }
  return value;
}

function requireArchiveIdentityValue(value, key, expected, path) {
  if (typeof value[key] !== 'string' || value[key] !== expected) {
    fail(
      'ARCHIVE_BUILD_IDENTITY',
      `${path}.${key} does not match the expected release identity.`,
      `${path}.${key}`,
    );
  }
}

function validateAppInfoPlist(value, expectedBuild, path) {
  requireArchiveIdentityValue(value, 'CFBundleIdentifier', expectedBuild.bundleIdentifier, path);
  requireArchiveIdentityValue(value, 'CFBundleShortVersionString', expectedBuild.appVersion, path);
  requireArchiveIdentityValue(value, 'CFBundleVersion', expectedBuild.buildNumber, path);
  const executable = value.CFBundleExecutable;
  if (
    typeof executable !== 'string' ||
    executable.length === 0 ||
    executable !== executable.trim() ||
    !/^[A-Za-z0-9._-]+$/u.test(executable) ||
    executable === '.' ||
    executable === '..' ||
    WINDOWS_RESERVED_SEGMENT.test(executable)
  ) {
    fail(
      'ARCHIVE_EXECUTABLE',
      'CFBundleExecutable must be one safe non-placeholder path segment.',
      `${path}.CFBundleExecutable`,
    );
  }
  return executable;
}

function requiredArchiveEntry(entriesByName, name, path) {
  const entry = entriesByName.get(name);
  if (!entry || entry.directory || entry.uncompressedSize <= 0) {
    fail('ARCHIVE_LAYOUT', `The archive is missing required non-empty entry ${name}.`, path);
  }
  return entry;
}

function parseProvisioningProfileCms(bytes, bounds, path) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length === 0 ||
    bytes.length > bounds.maxArchiveMobileProvisionBytes
  ) {
    fail('ARCHIVE_PROFILE_BOUND', 'The embedded provisioning profile is empty or too large.', path);
  }
  let message;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(bytes.toString('binary'), 'raw'), true);
    message = forge.pkcs7.messageFromAsn1(asn1);
  } catch (error) {
    fail(
      'ARCHIVE_PROFILE_CMS',
      'The embedded provisioning profile is not a valid CMS SignedData container.',
      path,
      error,
    );
  }
  const signerInfos = message.rawCapture?.signerInfos;
  if (
    message.type !== forge.pki.oids.signedData ||
    !Array.isArray(message.certificates) ||
    message.certificates.length === 0 ||
    !Array.isArray(signerInfos) ||
    signerInfos.length === 0 ||
    !message.content
  ) {
    fail(
      'ARCHIVE_PROFILE_CMS',
      'The provisioning profile CMS must contain content, certificates, and signer metadata.',
      path,
    );
  }
  const contentParts = [];
  const collectOctetStrings = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.tagClass === forge.asn1.Class.UNIVERSAL &&
      node.type === forge.asn1.Type.OCTETSTRING &&
      typeof node.value === 'string'
    ) {
      contentParts.push(Buffer.from(node.value, 'binary'));
      return;
    }
    if (Array.isArray(node.value)) {
      for (const child of node.value) collectOctetStrings(child);
    }
  };
  try {
    collectOctetStrings(message.rawCapture.content);
  } catch (error) {
    fail('ARCHIVE_PROFILE_CMS', 'The provisioning profile CMS content is unreadable.', path, error);
  }
  const content = Buffer.concat(contentParts);
  return parseArchivePlist(content, bounds, path, bounds.maxArchiveMobileProvisionBytes);
}

function exactStringArray(value, path) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    fail('ARCHIVE_PROFILE_SCHEMA', `${path} must be a non-empty string array.`, path);
  }
  return value;
}

function validateProvisioningProfile(value, expectedBuild, path) {
  const teamIdentifiers = exactStringArray(value.TeamIdentifier, `${path}.TeamIdentifier`);
  if (!teamIdentifiers.includes(expectedBuild.teamIdentifier)) {
    fail(
      'ARCHIVE_TEAM_IDENTITY',
      'The provisioning profile TeamIdentifier does not include the expected team.',
      `${path}.TeamIdentifier`,
    );
  }
  const prefixes = exactStringArray(
    value.ApplicationIdentifierPrefix,
    `${path}.ApplicationIdentifierPrefix`,
  );
  if (!isRecord(value.Entitlements)) {
    fail(
      'ARCHIVE_PROFILE_SCHEMA',
      'The provisioning profile Entitlements must be a dictionary.',
      `${path}.Entitlements`,
    );
  }
  const entitlements = value.Entitlements;
  const applicationIdentifier = entitlements['application-identifier'];
  if (
    typeof applicationIdentifier !== 'string' ||
    !applicationIdentifier.endsWith(`.${expectedBuild.bundleIdentifier}`)
  ) {
    fail(
      'ARCHIVE_APPLICATION_IDENTIFIER',
      'The profile application-identifier does not end in the expected bundle identifier.',
      `${path}.Entitlements.application-identifier`,
    );
  }
  const prefix = applicationIdentifier.slice(0, -`.${expectedBuild.bundleIdentifier}`.length);
  if (!prefixes.includes(prefix)) {
    fail(
      'ARCHIVE_APPLICATION_IDENTIFIER',
      'The profile application-identifier prefix is not declared by the profile.',
      `${path}.Entitlements.application-identifier`,
    );
  }
  if (entitlements['com.apple.developer.team-identifier'] !== expectedBuild.teamIdentifier) {
    fail(
      'ARCHIVE_TEAM_IDENTITY',
      'The profile developer team entitlement does not match the expected team.',
      `${path}.Entitlements.com.apple.developer.team-identifier`,
    );
  }
  if (
    entitlements['get-task-allow'] !== false ||
    Object.hasOwn(value, 'ProvisionedDevices') ||
    value.ProvisionsAllDevices === true
  ) {
    fail(
      'ARCHIVE_PROFILE_DISTRIBUTION',
      'The production profile must disable debugging and omit device-development distribution.',
      path,
    );
  }
  if (!exactStringArray(value.Platform, `${path}.Platform`).includes('iOS')) {
    fail(
      'ARCHIVE_PROFILE_PLATFORM',
      'The provisioning profile must include iOS.',
      `${path}.Platform`,
    );
  }
  if (
    !(value.CreationDate instanceof Date) ||
    !(value.ExpirationDate instanceof Date) ||
    !Number.isFinite(value.CreationDate.getTime()) ||
    !Number.isFinite(value.ExpirationDate.getTime()) ||
    value.CreationDate.getTime() > expectedBuild.builtAtMilliseconds ||
    value.ExpirationDate.getTime() <= expectedBuild.builtAtMilliseconds ||
    value.ExpirationDate.getTime() <= expectedBuild.evaluatedAtMilliseconds
  ) {
    fail(
      'ARCHIVE_PROFILE_VALIDITY',
      'The provisioning profile must be valid at the recorded build completion time.',
      path,
    );
  }
  if (
    typeof value.Name !== 'string' ||
    value.Name.length === 0 ||
    typeof value.UUID !== 'string' ||
    !/^[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/iu.test(value.UUID)
  ) {
    fail('ARCHIVE_PROFILE_SCHEMA', 'The provisioning profile name or UUID is invalid.', path);
  }
  return Object.freeze({
    applicationIdentifierPrefixSha256: sha256(Buffer.from(prefix, 'utf8')),
    cmsSignedDataStructureParsed: true,
    structuredIdentityFieldsMatched: true,
  });
}

function validateArchiveIdentity(layout, entriesByName, expectedBuild, bounds, path) {
  const appInfoEntry = requiredArchiveEntry(entriesByName, layout.appInfoPath, path);
  const appInfo = parseArchivePlist(appInfoEntry.payload, bounds, layout.appInfoPath);
  const executable = validateAppInfoPlist(appInfo, expectedBuild, layout.appInfoPath);
  requiredArchiveEntry(entriesByName, `${layout.appRoot}/${executable}`, path);
  requiredArchiveEntry(entriesByName, `${layout.appRoot}/_CodeSignature/CodeResources`, path);
  const mobileProvisionPath = `${layout.appRoot}/embedded.mobileprovision`;
  const mobileProvision = requiredArchiveEntry(entriesByName, mobileProvisionPath, path);
  const profile = validateProvisioningProfile(
    parseProvisioningProfileCms(mobileProvision.payload, bounds, mobileProvisionPath),
    expectedBuild,
    mobileProvisionPath,
  );

  if (layout.archiveInfoPath) {
    const archiveInfoEntry = requiredArchiveEntry(entriesByName, layout.archiveInfoPath, path);
    const archiveInfo = parseArchivePlist(archiveInfoEntry.payload, bounds, layout.archiveInfoPath);
    if (!isRecord(archiveInfo.ApplicationProperties)) {
      fail(
        'ARCHIVE_PLIST_SCHEMA',
        'xcarchive ApplicationProperties must be a dictionary.',
        `${layout.archiveInfoPath}.ApplicationProperties`,
      );
    }
    const properties = archiveInfo.ApplicationProperties;
    requireArchiveIdentityValue(
      properties,
      'CFBundleIdentifier',
      expectedBuild.bundleIdentifier,
      `${layout.archiveInfoPath}.ApplicationProperties`,
    );
    requireArchiveIdentityValue(
      properties,
      'CFBundleShortVersionString',
      expectedBuild.appVersion,
      `${layout.archiveInfoPath}.ApplicationProperties`,
    );
    requireArchiveIdentityValue(
      properties,
      'CFBundleVersion',
      expectedBuild.buildNumber,
      `${layout.archiveInfoPath}.ApplicationProperties`,
    );
    requireArchiveIdentityValue(
      properties,
      'Team',
      expectedBuild.teamIdentifier,
      `${layout.archiveInfoPath}.ApplicationProperties`,
    );
    const expectedApplicationPath = layout.appRoot.slice(`${layout.archiveRoot}/Products/`.length);
    requireArchiveIdentityValue(
      properties,
      'ApplicationPath',
      expectedApplicationPath,
      `${layout.archiveInfoPath}.ApplicationProperties`,
    );
  }

  return Object.freeze({
    ...profile,
    applicationIdentityValidated: true,
    codeResourcesPresent: true,
    executablePresent: true,
  });
}

function validateZipArchive(archiveBytes, format, expectedBuild, bounds) {
  const path = 'archive.file';
  if (!Buffer.isBuffer(archiveBytes) || archiveBytes.length === 0) {
    fail('ARCHIVE_ZIP_BYTES', 'Validated archive bytes are unavailable.', path);
  }
  const archiveSize = archiveBytes.length;
  const descriptor = archiveBytes;
  try {
    const end = locateZipEndRecord(descriptor, archiveSize, path);
    const endBytes = end.bytes;
    const diskNumber = endBytes.readUInt16LE(4);
    const centralDisk = endBytes.readUInt16LE(6);
    const diskEntries = endBytes.readUInt16LE(8);
    const totalEntries = endBytes.readUInt16LE(10);
    const centralSize = endBytes.readUInt32LE(12);
    const centralOffset = endBytes.readUInt32LE(16);
    if (
      diskNumber !== 0 ||
      centralDisk !== 0 ||
      diskEntries !== totalEntries ||
      totalEntries === ZIP64_UINT16_SENTINEL ||
      centralSize === ZIP64_UINT32_SENTINEL ||
      centralOffset === ZIP64_UINT32_SENTINEL
    ) {
      fail(
        'ARCHIVE_ZIP64_UNSUPPORTED',
        'Multi-disk and ZIP64 archives are not accepted by this release validator.',
        path,
      );
    }
    if (totalEntries === 0 || totalEntries > bounds.maxArchiveEntries) {
      fail('ARCHIVE_ZIP_ENTRIES', 'The ZIP entry count is empty or exceeds its bound.', path);
    }
    if (centralOffset + centralSize !== end.offset || centralOffset < ZIP_MINIMUM_EOCD_BYTES) {
      fail(
        'ARCHIVE_ZIP_CENTRAL_DIRECTORY',
        'The ZIP central directory has inconsistent bounds.',
        path,
      );
    }

    const entries = [];
    const names = new Map();
    const localOffsets = new Set();
    let totalExpandedBytes = 0n;
    let cursor = centralOffset;
    for (let index = 0; index < totalEntries; index += 1) {
      const header = readArchiveBytes(descriptor, cursor, 46, path);
      if (header.readUInt32LE(0) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
        fail('ARCHIVE_ZIP_CENTRAL_DIRECTORY', 'A central-directory record is invalid.', path);
      }
      const madeBy = header.readUInt16LE(4);
      const versionNeeded = header.readUInt16LE(6);
      const flags = header.readUInt16LE(8);
      const method = header.readUInt16LE(10);
      const crc = header.readUInt32LE(16);
      const compressedSize = header.readUInt32LE(20);
      const uncompressedSize = header.readUInt32LE(24);
      const nameLength = header.readUInt16LE(28);
      const extraLength = header.readUInt16LE(30);
      const commentLength = header.readUInt16LE(32);
      const startDisk = header.readUInt16LE(34);
      const externalAttributes = header.readUInt32LE(38);
      const localOffset = header.readUInt32LE(42);
      const madeByHost = madeBy >>> 8;
      if (
        ![0, 3, 19].includes(madeByHost) ||
        ![10, 20].includes(versionNeeded) ||
        (method === 8 && versionNeeded !== 20)
      ) {
        fail(
          'ARCHIVE_ZIP_VERSION',
          'ZIP entries must use a reviewed DOS/Unix/macOS host and 1.0/2.0 feature version.',
          path,
        );
      }
      if (
        compressedSize === ZIP64_UINT32_SENTINEL ||
        uncompressedSize === ZIP64_UINT32_SENTINEL ||
        localOffset === ZIP64_UINT32_SENTINEL ||
        startDisk !== 0
      ) {
        fail('ARCHIVE_ZIP64_UNSUPPORTED', 'ZIP64 or multi-disk entries are not accepted.', path);
      }
      if (
        compressedSize > bounds.maxArchiveEntryBytes ||
        uncompressedSize > bounds.maxArchiveEntryBytes
      ) {
        fail('ARCHIVE_ZIP_ENTRY_BOUND', 'A ZIP entry exceeds its reviewed byte bound.', path);
      }
      totalExpandedBytes += BigInt(uncompressedSize);
      if (totalExpandedBytes > BigInt(bounds.maxArchiveExpandedBytes)) {
        fail(
          'ARCHIVE_ZIP_EXPANSION_BOUND',
          'Combined ZIP entry output exceeds its reviewed expansion bound.',
          path,
        );
      }
      if (
        uncompressedSize > 0 &&
        (compressedSize === 0 ||
          BigInt(uncompressedSize) >
            BigInt(compressedSize) * BigInt(bounds.maxArchiveCompressionRatio))
      ) {
        fail(
          'ARCHIVE_ZIP_COMPRESSION_RATIO',
          'A ZIP entry exceeds its reviewed compression-ratio bound.',
          path,
        );
      }
      assertSupportedZipEntry({ flags, method }, path);
      const recordLength = 46 + nameLength + extraLength + commentLength;
      if (cursor + recordLength > end.offset) {
        fail('ARCHIVE_ZIP_CENTRAL_DIRECTORY', 'A central-directory record is truncated.', path);
      }
      const variable = readArchiveBytes(descriptor, cursor + 46, recordLength - 46, path);
      const nameBytes = variable.subarray(0, nameLength);
      const extra = variable.subarray(nameLength, nameLength + extraLength);
      validateZipExtraFields(extra, path);
      const decoded = decodeZipEntryName(nameBytes, flags, bounds, path);
      const nameKey = decoded.pathValue.normalize('NFC').toLowerCase();
      if (names.has(nameKey)) {
        fail('ARCHIVE_ZIP_DUPLICATE', 'ZIP entry paths must be unique case-insensitively.', path);
      }
      if (localOffsets.has(localOffset)) {
        fail('ARCHIVE_ZIP_DUPLICATE', 'ZIP entries must have distinct local records.', path);
      }
      localOffsets.add(localOffset);
      const unixType = [3, 19].includes(madeByHost) ? (externalAttributes >>> 16) & 0xf000 : 0;
      if (unixType === 0xa000 || (unixType !== 0 && unixType !== 0x4000 && unixType !== 0x8000)) {
        fail('ARCHIVE_ZIP_FILE_TYPE', 'ZIP symlinks and special files are not accepted.', path);
      }
      const directoryByAttributes =
        unixType === 0x4000 || (unixType === 0 && (externalAttributes & 0x10) !== 0);
      if (decoded.directory !== directoryByAttributes) {
        fail(
          'ARCHIVE_ZIP_FILE_TYPE',
          'ZIP directory path markers and file attributes must agree.',
          path,
        );
      }
      if (decoded.directory && (compressedSize !== 0 || uncompressedSize !== 0)) {
        fail('ARCHIVE_ZIP_SIZE', 'ZIP directory entries must be empty.', path);
      }
      const entry = {
        compressedSize,
        crc32: crc,
        directory: decoded.directory,
        flags,
        localOffset,
        method,
        versionNeeded,
        name: decoded.name,
        nameBytes,
        uncompressedSize,
      };
      entries.push(entry);
      names.set(nameKey, entry);
      cursor += recordLength;
    }
    if (cursor !== end.offset) {
      fail('ARCHIVE_ZIP_CENTRAL_DIRECTORY', 'The ZIP central directory has trailing bytes.', path);
    }

    for (const [nameKey] of names) {
      const segments = nameKey.split('/');
      for (let length = 1; length < segments.length; length += 1) {
        const ancestor = names.get(segments.slice(0, length).join('/'));
        if (ancestor && !ancestor.directory) {
          fail(
            'ARCHIVE_ZIP_PATH_COLLISION',
            'A ZIP regular-file path cannot be the ancestor of another entry.',
            path,
          );
        }
      }
    }
    const layout = identifyArchiveLayout(format, entries, path);
    const retainedPayloadNames = new Set(
      [
        layout.appInfoPath,
        layout.archiveInfoPath,
        `${layout.appRoot}/embedded.mobileprovision`,
      ].filter(Boolean),
    );

    const ranges = [];
    for (const entry of entries) {
      if (entry.localOffset + 30 > centralOffset) {
        fail('ARCHIVE_ZIP_LOCAL_HEADER', 'A ZIP local header is outside the data region.', path);
      }
      const local = readArchiveBytes(descriptor, entry.localOffset, 30, path);
      if (local.readUInt32LE(0) !== ZIP_LOCAL_FILE_SIGNATURE) {
        fail('ARCHIVE_ZIP_LOCAL_HEADER', 'A ZIP local-file record is invalid.', path);
      }
      const localFlags = local.readUInt16LE(6);
      const localMethod = local.readUInt16LE(8);
      const localVersionNeeded = local.readUInt16LE(4);
      const localCrc = local.readUInt32LE(14);
      const localCompressedSize = local.readUInt32LE(18);
      const localUncompressedSize = local.readUInt32LE(22);
      const localNameLength = local.readUInt16LE(26);
      const localExtraLength = local.readUInt16LE(28);
      if (
        localVersionNeeded !== entry.versionNeeded ||
        localFlags !== entry.flags ||
        localMethod !== entry.method
      ) {
        fail('ARCHIVE_ZIP_LOCAL_HEADER', 'ZIP local and central metadata disagree.', path);
      }
      const variableLength = localNameLength + localExtraLength;
      const localVariable = readArchiveBytes(
        descriptor,
        entry.localOffset + 30,
        variableLength,
        path,
      );
      const localName = localVariable.subarray(0, localNameLength);
      if (!localName.equals(entry.nameBytes)) {
        fail('ARCHIVE_ZIP_LOCAL_HEADER', 'ZIP local and central entry paths disagree.', path);
      }
      validateZipExtraFields(localVariable.subarray(localNameLength), path);
      const usesDescriptor = (entry.flags & 0x0008) !== 0;
      if (
        (!usesDescriptor &&
          (localCrc !== entry.crc32 ||
            localCompressedSize !== entry.compressedSize ||
            localUncompressedSize !== entry.uncompressedSize)) ||
        (usesDescriptor &&
          (localCrc !== 0 || localCompressedSize !== 0 || localUncompressedSize !== 0))
      ) {
        fail('ARCHIVE_ZIP_LOCAL_HEADER', 'ZIP local and central sizes or CRC disagree.', path);
      }
      const dataOffset = entry.localOffset + 30 + variableLength;
      const dataEnd = dataOffset + entry.compressedSize;
      if (dataEnd > centralOffset) {
        fail('ARCHIVE_ZIP_TRUNCATED', 'ZIP entry data extends into the central directory.', path);
      }
      const compressed = readArchiveBytes(descriptor, dataOffset, entry.compressedSize, path);
      const payload = validateZipPayload(compressed, entry, bounds, path);
      if (retainedPayloadNames.has(entry.name)) entry.payload = Buffer.from(payload);

      let recordEnd = dataEnd;
      if (usesDescriptor) {
        const descriptorPrefix = readArchiveBytes(descriptor, dataEnd, 4, path);
        const hasSignature = descriptorPrefix.readUInt32LE(0) === ZIP_DATA_DESCRIPTOR_SIGNATURE;
        const dataDescriptor = hasSignature
          ? readArchiveBytes(descriptor, dataEnd + 4, 12, path)
          : readArchiveBytes(descriptor, dataEnd, 12, path);
        if (
          dataDescriptor.readUInt32LE(0) !== entry.crc32 ||
          dataDescriptor.readUInt32LE(4) !== entry.compressedSize ||
          dataDescriptor.readUInt32LE(8) !== entry.uncompressedSize
        ) {
          fail('ARCHIVE_ZIP_DATA_DESCRIPTOR', 'A ZIP data descriptor is inconsistent.', path);
        }
        recordEnd += hasSignature ? 16 : 12;
        if (recordEnd > centralOffset) {
          fail('ARCHIVE_ZIP_TRUNCATED', 'A ZIP data descriptor is truncated.', path);
        }
      }
      ranges.push({ end: recordEnd, start: entry.localOffset });
    }
    ranges.sort((left, right) => left.start - right.start);
    if (ranges[0]?.start !== 0 || ranges.at(-1)?.end !== centralOffset) {
      fail(
        'ARCHIVE_ZIP_UNREFERENCED_BYTES',
        'ZIP local records must cover the complete pre-central-directory region.',
        path,
      );
    }
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].start !== ranges[index - 1].end) {
        fail(
          'ARCHIVE_ZIP_UNREFERENCED_BYTES',
          'ZIP local records must be contiguous and non-overlapping.',
          path,
        );
      }
    }

    const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
    const identity = validateArchiveIdentity(layout, entriesByName, expectedBuild, bounds, path);
    return Object.freeze({ entryCount: entries.length, identity, layout: layout.kind });
  } catch (error) {
    if (error instanceof IosArchivePrivacyEvidenceError) throw error;
    fail('ARCHIVE_ZIP_INVALID', 'The archive ZIP structure is invalid.', path, error);
  }
}

function canonicalIsoTimestamp(value, path) {
  if (typeof value !== 'string' || !CANONICAL_ISO_UTC.test(value)) {
    fail('TIMESTAMP_FORMAT', 'Timestamps must be canonical ISO-8601 UTC with milliseconds.', path);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    fail('TIMESTAMP_FORMAT', 'Timestamp is not a real canonical UTC instant.', path);
  }
  return Object.freeze({ milliseconds: time, value });
}

function rejectFutureTimestamps(timestamps, latestAllowedMilliseconds) {
  for (const timestamp of timestamps) {
    if (timestamp.milliseconds > latestAllowedMilliseconds) {
      fail(
        'TIMESTAMP_FUTURE',
        'Evidence timestamps cannot be later than validation time plus five minutes of clock skew.',
        timestamp.path,
      );
    }
  }
}

function registerReference(state, inspected, path, maximumBytes) {
  const caseKey = inspected.path.toLowerCase();
  if (state.paths.has(caseKey)) {
    fail('REFERENCE_DUPLICATE_PATH', 'Evidence roles must use distinct file paths.', path);
  }
  state.paths.add(caseKey);
  const identityKey = `${inspected.identity.dev}:${inspected.identity.ino}`;
  if (state.identities.has(identityKey)) {
    fail('REFERENCE_DUPLICATE_FILE', 'Evidence roles must use distinct physical files.', path);
  }
  state.identities.add(identityKey);
  if (state.fileHashes.has(inspected.sha256)) {
    fail('REFERENCE_DUPLICATE_HASH', 'Evidence roles must not reuse identical file bytes.', path);
  }
  state.fileHashes.add(inspected.sha256);
  state.totalBytes += BigInt(inspected.sizeBytes);
  if (state.totalBytes > BigInt(state.bounds.maxTotalEvidenceBytes)) {
    fail('TOTAL_SIZE_BOUND', 'Combined evidence exceeds the reviewed total-size bound.', path);
  }
  state.references.push(
    Object.freeze({
      identity: inspected.identity,
      maximumBytes,
      path: inspected.path,
      schemaPath: path,
      sha256: inspected.sha256,
      sizeBytes: inspected.sizeBytes,
    }),
  );
}

function recheckReferenceSet(state, root) {
  for (const reference of state.references) {
    const rechecked = inspectFile(
      root,
      reference.path,
      reference.maximumBytes,
      state.bounds,
      reference.schemaPath,
    );
    if (
      !sameIdentity(reference.identity, rechecked.identity) ||
      reference.identity.size !== rechecked.identity.size ||
      reference.identity.mtimeNs !== rechecked.identity.mtimeNs ||
      reference.sha256 !== rechecked.sha256 ||
      reference.sizeBytes !== rechecked.sizeBytes
    ) {
      fail(
        'EVIDENCE_SET_RACE',
        'A referenced evidence file changed before validation completed.',
        reference.schemaPath,
      );
    }
  }
}

function validateReference({
  value,
  path,
  root,
  bounds,
  maximumBytes,
  state,
  collectBytes = false,
  requiredTokens = [],
}) {
  assertExactKeys(value, REFERENCE_KEYS, path);
  if (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) {
    fail(
      'REFERENCE_HASH',
      'Reference SHA-256 must be 64 lowercase hexadecimal digits.',
      `${path}.sha256`,
    );
  }
  if (!Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0) {
    fail(
      'REFERENCE_SIZE',
      'Reference sizeBytes must be a positive safe integer.',
      `${path}.sizeBytes`,
    );
  }
  const capturedAt = canonicalIsoTimestamp(value.capturedAt, `${path}.capturedAt`);
  const inspected = inspectFile(
    root,
    value.path,
    maximumBytes,
    bounds,
    `${path}.path`,
    collectBytes,
    requiredTokens,
  );
  if (inspected.sha256 !== value.sha256) {
    fail('REFERENCE_HASH_DRIFT', 'Referenced file SHA-256 does not match current bytes.', path);
  }
  if (inspected.sizeBytes !== value.sizeBytes) {
    fail('REFERENCE_SIZE_DRIFT', 'Referenced file size does not match current bytes.', path);
  }
  registerReference(state, inspected, path, maximumBytes);
  state.timestamps.push({ milliseconds: capturedAt.milliseconds, path: `${path}.capturedAt` });
  return Object.freeze({
    bytes: inspected.bytes,
    capturedAt: capturedAt.value,
    path: inspected.path,
    prefix: inspected.prefix,
    sha256: inspected.sha256,
    sizeBytes: inspected.sizeBytes,
  });
}

function validateLedgerHashes(value, path) {
  assertExactKeys(value, LEDGER_HASH_KEYS, path);
  const normalized = {};
  for (const key of LEDGER_HASH_KEYS) {
    if (typeof value[key] !== 'string' || !SHA256.test(value[key])) {
      fail('LEDGER_HASH', `${key} must be a lowercase SHA-256.`, `${path}.${key}`);
    }
    normalized[key] = value[key];
  }
  return Object.freeze(normalized);
}

function decodeCanonicalSourceAudit(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    fail(
      'SOURCE_AUDIT_BYTES',
      'The source-audit JSON bytes are unavailable.',
      'source.iosPrivacySourceAudit',
    );
  }
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    fail(
      'SOURCE_AUDIT_ENCODING',
      'The source-audit JSON must be BOM-free UTF-8.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
    );
  }
  let text;
  try {
    text = UTF8.decode(bytes);
  } catch (error) {
    fail(
      'SOURCE_AUDIT_ENCODING',
      'The source-audit JSON must be valid UTF-8.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
      error,
    );
  }
  let report;
  try {
    report = JSON.parse(text);
  } catch (error) {
    fail(
      'SOURCE_AUDIT_JSON',
      'The source-audit JSON is malformed.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
      error,
    );
  }
  if (!isRecord(report)) {
    fail(
      'SOURCE_AUDIT_SCHEMA',
      'The source-audit JSON root must be an object.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
    );
  }
  const canonical = `${JSON.stringify(report, null, 2)}\n`;
  if (!bytes.equals(Buffer.from(canonical, 'utf8'))) {
    fail(
      'SOURCE_AUDIT_CANONICAL',
      'The source-audit JSON must use canonical generated bytes.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
    );
  }
  return report;
}

function decodeEvidenceJson(bytes, bounds, path) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    fail('EVIDENCE_JSON_BYTES', 'The archive-evidence JSON file must not be empty.', path);
  }
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    fail('EVIDENCE_JSON_ENCODING', 'The archive-evidence JSON must be BOM-free UTF-8.', path);
  }
  let text;
  try {
    text = UTF8.decode(bytes);
  } catch (error) {
    fail('EVIDENCE_JSON_ENCODING', 'The archive-evidence JSON must be valid UTF-8.', path, error);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') {
      depth += 1;
      if (depth > bounds.maxEvidenceJsonDepth) {
        fail(
          'EVIDENCE_JSON_DEPTH',
          `Archive-evidence JSON exceeds depth ${bounds.maxEvidenceJsonDepth}.`,
          path,
        );
      }
    } else if (character === '}' || character === ']') {
      depth -= 1;
      if (depth < 0) break;
    }
  }

  let duplicateCheck;
  try {
    duplicateCheck = parseDocument(text, {
      maxAliasCount: 0,
      prettyErrors: false,
      schema: 'json',
      strict: true,
      uniqueKeys: true,
    });
  } catch (error) {
    fail('EVIDENCE_JSON_SYNTAX', 'The archive-evidence JSON could not be parsed.', path, error);
  }
  const duplicate = duplicateCheck.errors.find(({ code }) => code === 'DUPLICATE_KEY');
  if (duplicate) {
    fail(
      'EVIDENCE_JSON_DUPLICATE_KEY',
      'The archive-evidence JSON contains a duplicate key.',
      path,
    );
  }
  if (duplicateCheck.errors.length > 0) {
    fail('EVIDENCE_JSON_SYNTAX', 'The archive-evidence JSON is malformed.', path);
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail(
      'EVIDENCE_JSON_SYNTAX',
      'The archive-evidence file must use strict JSON syntax.',
      path,
      error,
    );
  }
  if (!isRecord(value)) {
    fail('EVIDENCE_JSON_ROOT', 'The archive-evidence JSON root must be an object.', path);
  }
  return value;
}

function validateSourceAuditReport(report, expectedLedgerHashes) {
  if (
    report.schemaVersion !== 1 ||
    report.kind !== 'ios_privacy_source_audit' ||
    report.status !== 'archive_required'
  ) {
    fail(
      'SOURCE_AUDIT_STATUS',
      'The current iOS source audit must be schema v1 with archive_required status.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
    );
  }
  assertExactKeys(report.claims, SOURCE_AUDIT_CLAIM_KEYS, 'sourceAudit.claims');
  for (const key of SOURCE_AUDIT_CLAIM_KEYS) {
    if (report.claims[key] !== false) {
      fail('SOURCE_AUDIT_FALSE_CLAIM', `${key} must remain false.`, `sourceAudit.claims.${key}`);
    }
  }
  if (!isRecord(report.scope) || report.scope.releaseArchiveAudited !== false) {
    fail(
      'SOURCE_AUDIT_SCOPE',
      'The source audit must retain releaseArchiveAudited=false.',
      'sourceAudit.scope',
    );
  }
  if (
    !Array.isArray(report.errors) ||
    report.errors.length !== 0 ||
    !isRecord(report.summary) ||
    report.summary.errorCount !== 0
  ) {
    fail(
      'SOURCE_AUDIT_ERRORS',
      'The source audit must contain zero source errors.',
      IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH,
    );
  }
  const actualLedgerHashes = validateLedgerHashes(report.ledgerHashes, 'sourceAudit.ledgerHashes');
  for (const key of LEDGER_HASH_KEYS) {
    if (actualLedgerHashes[key] !== expectedLedgerHashes[key]) {
      fail(
        'SOURCE_AUDIT_LEDGER_DRIFT',
        `${key} does not match the bound source audit.`,
        `source.ledgerHashes.${key}`,
      );
    }
  }
}

function validateExpectedContext(options) {
  if (
    typeof options.expectedSourceGitSha !== 'string' ||
    !GIT_SHA.test(options.expectedSourceGitSha)
  ) {
    fail(
      'EXPECTED_SOURCE_GIT_SHA',
      'options.expectedSourceGitSha must be the current 40-character lowercase Git SHA.',
      'options.expectedSourceGitSha',
    );
  }
  assertExactKeys(options.expectedBuild, EXPECTED_BUILD_KEYS, 'options.expectedBuild');
  return Object.freeze({
    expectedBuild: options.expectedBuild,
    expectedSourceGitSha: options.expectedSourceGitSha,
  });
}

function validateOptionsShape(options) {
  if (!isRecord(options)) {
    fail('OPTIONS_TYPE', 'Validation options must be a plain object.', 'options');
  }
  const allowed = new Set(['root', 'expectedSourceGitSha', 'expectedBuild', 'bounds']);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) {
      fail('OPTIONS_KEY', `Unknown validation option: ${key}.`, `options.${key}`);
    }
  }
}

function validateBuild(value, expectedBuild) {
  assertExactKeys(value, BUILD_KEYS, 'build');
  const checks = [
    ['appVersion', APP_VERSION, 'a one-to-three component numeric version'],
    ['buildNumber', BUILD_NUMBER, 'a one-to-three component numeric build number'],
    ['bundleIdentifier', BUNDLE_IDENTIFIER, 'a reverse-DNS bundle identifier'],
    ['teamIdentifier', TEAM_IDENTIFIER, 'a ten-character uppercase Apple team identifier'],
  ];
  for (const [key, pattern, description] of checks) {
    if (
      typeof value[key] !== 'string' ||
      value[key] !== value[key].trim() ||
      !pattern.test(value[key])
    ) {
      fail('BUILD_VALUE', `build.${key} must be ${description}.`, `build.${key}`);
    }
    if (typeof expectedBuild[key] !== 'string' || value[key] !== expectedBuild[key]) {
      fail(
        'BUILD_MISMATCH',
        `build.${key} does not match the expected release identity.`,
        `build.${key}`,
      );
    }
  }
  const builtAt = canonicalIsoTimestamp(value.builtAt, 'build.builtAt');
  return Object.freeze({
    ...value,
    builtAt: builtAt.value,
    builtAtMilliseconds: builtAt.milliseconds,
  });
}

function versionMajor(value, path) {
  if (typeof value !== 'string' || value !== value.trim() || !VERSION.test(value)) {
    fail('TOOLCHAIN_VERSION', `${path} must be a resolved numeric version.`, path);
  }
  return Number.parseInt(value.replace(/^v/, '').split('.')[0], 10);
}

function validateToolchain(value) {
  assertExactKeys(value, TOOLCHAIN_KEYS, 'toolchain');
  const easImageMatch =
    typeof value.easBuildImage === 'string' &&
    value.easBuildImage === value.easBuildImage.trim() &&
    value.easBuildImage.length <= 200
      ? FULL_EAS_IMAGE.exec(value.easBuildImage)
      : null;
  if (!easImageMatch) {
    fail(
      'TOOLCHAIN_EAS_IMAGE',
      'toolchain.easBuildImage must be a full resolved macOS/Xcode image name, not an alias.',
      'toolchain.easBuildImage',
    );
  }
  const xcodeMajor = versionMajor(value.xcodeVersion, 'toolchain.xcodeVersion');
  const iosSdkMajor = versionMajor(value.iosSdkVersion, 'toolchain.iosSdkVersion');
  const nodeMajor = versionMajor(value.nodeVersion, 'toolchain.nodeVersion');
  versionMajor(value.cocoaPodsVersion, 'toolchain.cocoaPodsVersion');
  const imageXcodeVersion = easImageMatch[2];
  const resolvedXcodeVersion = value.xcodeVersion.replace(/^v/, '');
  if (
    resolvedXcodeVersion !== imageXcodeVersion &&
    !resolvedXcodeVersion.startsWith(`${imageXcodeVersion}.`)
  ) {
    fail(
      'TOOLCHAIN_EAS_IMAGE_MISMATCH',
      'The resolved Xcode version must match the Xcode version pinned by the EAS image.',
      'toolchain.xcodeVersion',
    );
  }
  if (xcodeMajor < 26 || iosSdkMajor < 26) {
    fail(
      'TOOLCHAIN_APPLE_MINIMUM',
      'Xcode and the iOS SDK must both be version 26 or later.',
      'toolchain',
    );
  }
  if (nodeMajor < 20) {
    fail(
      'TOOLCHAIN_NODE_MINIMUM',
      'The resolved Node version must be 20 or later.',
      'toolchain.nodeVersion',
    );
  }
  return Object.freeze({ ...value });
}

function validateProvenance(value, { root, bounds, state, build, toolchain, sourceGitSha }) {
  assertExactKeys(value, PROVENANCE_KEYS, 'provenance');
  if (typeof value.easBuildId !== 'string' || !EAS_BUILD_ID.test(value.easBuildId)) {
    fail(
      'PROVENANCE_EAS_BUILD_ID',
      'provenance.easBuildId must be a canonical lowercase EAS build UUID.',
      'provenance.easBuildId',
    );
  }
  if (typeof value.easGitCommitSha !== 'string' || !GIT_SHA.test(value.easGitCommitSha)) {
    fail(
      'PROVENANCE_EAS_GIT_SHA',
      'provenance.easGitCommitSha must be a 40-character lowercase Git SHA.',
      'provenance.easGitCommitSha',
    );
  }
  if (value.easGitCommitSha !== sourceGitSha) {
    fail(
      'PROVENANCE_EAS_GIT_MISMATCH',
      'The EAS build Git commit must match the bound build-source commit.',
      'provenance.easGitCommitSha',
    );
  }
  const easCliMajor = versionMajor(value.easCliVersion, 'provenance.easCliVersion');
  if (easCliMajor < 21) {
    fail(
      'PROVENANCE_EAS_CLI_MINIMUM',
      'The resolved EAS CLI version must be 21 or later.',
      'provenance.easCliVersion',
    );
  }
  const macosMajor = versionMajor(value.macosVersion, 'provenance.macosVersion');
  const fastlaneMajor = versionMajor(value.fastlaneVersion, 'provenance.fastlaneVersion');
  if (macosMajor < 26) {
    fail(
      'PROVENANCE_MACOS_MINIMUM',
      'The resolved EAS macOS version must be 26 or later.',
      'provenance.macosVersion',
    );
  }
  if (fastlaneMajor < 2) {
    fail(
      'PROVENANCE_FASTLANE_MINIMUM',
      'The resolved Fastlane version must be 2 or later.',
      'provenance.fastlaneVersion',
    );
  }
  if (typeof value.xcodeBuild !== 'string' || !XCODE_BUILD.test(value.xcodeBuild)) {
    fail(
      'PROVENANCE_XCODE_BUILD',
      'provenance.xcodeBuild must be a resolved Apple Xcode build identifier.',
      'provenance.xcodeBuild',
    );
  }

  const imageVersions = FULL_EAS_IMAGE.exec(toolchain.easBuildImage);
  const imageMacosVersion = imageVersions[1];
  const resolvedMacosVersion = value.macosVersion.replace(/^v/, '');
  if (
    resolvedMacosVersion !== imageMacosVersion &&
    !resolvedMacosVersion.startsWith(`${imageMacosVersion}.`)
  ) {
    fail(
      'PROVENANCE_EAS_IMAGE_MISMATCH',
      'The resolved macOS version must match the macOS version pinned by the EAS image.',
      'provenance.macosVersion',
    );
  }

  const easBuildLog = validateReference({
    value: value.easBuildLog,
    path: 'provenance.easBuildLog',
    root,
    bounds,
    maximumBytes: bounds.maxEasBuildLogBytes,
    state,
    requiredTokens: [
      value.easBuildId,
      value.easGitCommitSha,
      value.easCliVersion,
      toolchain.easBuildImage,
      value.macosVersion,
      toolchain.xcodeVersion,
      value.xcodeBuild,
      toolchain.iosSdkVersion,
      toolchain.nodeVersion,
      toolchain.cocoaPodsVersion,
      value.fastlaneVersion,
    ],
  });
  const logCapturedAt = canonicalIsoTimestamp(
    easBuildLog.capturedAt,
    'provenance.easBuildLog.capturedAt',
  );
  if (logCapturedAt.milliseconds < build.builtAtMilliseconds) {
    fail(
      'PROVENANCE_TIMESTAMP_ORDER',
      'The retained EAS build log cannot predate build completion.',
      'provenance.easBuildLog.capturedAt',
    );
  }

  return Object.freeze({
    easBuildId: value.easBuildId,
    easGitCommitSha: value.easGitCommitSha,
    easCliVersion: value.easCliVersion,
    easBuildLog: normalizedReference(easBuildLog),
    macosVersion: value.macosVersion,
    xcodeBuild: value.xcodeBuild,
    fastlaneVersion: value.fastlaneVersion,
  });
}

function reviewerIdentity(value, path, bounds) {
  assertExactKeys(value, REVIEWER_KEYS, path);
  if (
    typeof value.name !== 'string' ||
    value.name !== value.name.trim() ||
    value.name.length < 2 ||
    value.name.length > bounds.maxReviewerNameLength ||
    PLACEHOLDER_REVIEWER.test(value.name) ||
    /[\0-\x1f\x7f]/.test(value.name) ||
    hasUnpairedSurrogate(value.name)
  ) {
    fail(
      'REVIEWER_NAME',
      'Reviewer name must be a bounded non-placeholder identity.',
      `${path}.name`,
    );
  }
  if (value.decision !== 'approve') {
    fail('REVIEW_DECISION', 'Reviewer decision must be exactly approve.', `${path}.decision`);
  }
  const reviewedAt = canonicalIsoTimestamp(value.reviewedAt, `${path}.reviewedAt`);
  return Object.freeze({
    identityKey: value.name.normalize('NFKC').toLowerCase(),
    identitySha256: sha256(Buffer.from(value.name, 'utf8')),
    reviewedAt: reviewedAt.value,
    reviewedAtMilliseconds: reviewedAt.milliseconds,
  });
}

function validateReview(value, bounds, timestamps) {
  assertExactKeys(value, REVIEW_KEYS, 'review');
  const privacy = reviewerIdentity(value.privacy, 'review.privacy', bounds);
  const release = reviewerIdentity(value.release, 'review.release', bounds);
  if (privacy.identityKey === release.identityKey) {
    fail(
      'REVIEWER_DUPLICATE',
      'Privacy and release reviewers must be distinct named people.',
      'review',
    );
  }
  if (release.reviewedAtMilliseconds < privacy.reviewedAtMilliseconds) {
    fail(
      'REVIEW_TIMESTAMP_ORDER',
      'The release approval cannot predate the required privacy approval.',
      'review.release.reviewedAt',
    );
  }
  for (const reviewer of [privacy, release]) {
    for (const timestamp of timestamps) {
      if (timestamp.milliseconds > reviewer.reviewedAtMilliseconds) {
        fail(
          'REVIEW_TIMESTAMP_ORDER',
          `${timestamp.path} occurs after a required review decision.`,
          timestamp.path,
        );
      }
    }
  }
  return Object.freeze({ privacy, release });
}

function normalizedReference(reference) {
  return Object.freeze({
    capturedAt: reference.capturedAt,
    path: reference.path,
    sha256: reference.sha256,
    sizeBytes: reference.sizeBytes,
  });
}

function validationReferenceDescriptors(validation, bounds) {
  if (
    !isRecord(validation) ||
    validation.kind !== 'ios_archive_privacy_evidence_index_validation' ||
    validation.status !== 'evidence_index_validated'
  ) {
    fail(
      'VALIDATION_RESULT',
      'A validated iOS archive privacy-evidence index is required for reinspection.',
      'validation',
    );
  }
  return [
    {
      reference: validation.source.iosPrivacySourceAudit,
      maximumBytes: bounds.maxSourceAuditBytes,
      schemaPath: 'source.iosPrivacySourceAudit',
    },
    {
      reference: validation.archive.file,
      maximumBytes: bounds.maxArchiveBytes,
      schemaPath: 'archive.file',
    },
    {
      reference: validation.provenance.easBuildLog,
      maximumBytes: bounds.maxEasBuildLogBytes,
      schemaPath: 'provenance.easBuildLog',
    },
    ...IOS_ARCHIVE_PRIVACY_EVIDENCE_ARTIFACT_NAMES.map((name) => ({
      reference: validation.artifacts[name],
      maximumBytes: bounds.maxEvidenceArtifactBytes,
      schemaPath: `artifacts.${name}`,
    })),
  ];
}

function recheckNormalizedReferenceSet(validation, root, bounds) {
  for (const { reference, maximumBytes, schemaPath } of validationReferenceDescriptors(
    validation,
    bounds,
  )) {
    const rechecked = inspectFile(root, reference.path, maximumBytes, bounds, schemaPath);
    if (rechecked.sha256 !== reference.sha256 || rechecked.sizeBytes !== reference.sizeBytes) {
      fail(
        'EVIDENCE_SET_RACE',
        'A referenced evidence file changed before validation completed.',
        schemaPath,
      );
    }
  }
}

export function recheckIosArchivePrivacyEvidenceReferences(validation, options = {}) {
  if (!isRecord(options)) {
    fail('OPTIONS_TYPE', 'Recheck options must be a plain object.', 'options');
  }
  for (const key of Object.keys(options)) {
    if (!['root', 'bounds'].includes(key)) {
      fail('OPTIONS_KEY', `Unknown recheck option: ${key}.`, `options.${key}`);
    }
  }
  const bounds = validatedBounds(options.bounds);
  const root = checkedRoot(options.root ?? process.cwd());
  recheckNormalizedReferenceSet(validation, root, bounds);
  return true;
}

/**
 * Validate one immutable iOS archive privacy-evidence record against current,
 * repository-confined files. This function performs no writes or subprocesses.
 */
export function validateIosArchivePrivacyEvidence(evidence, options = {}) {
  validateOptionsShape(options);
  const evaluatedAtMilliseconds = Date.now();
  const latestAllowedTimestampMilliseconds =
    evaluatedAtMilliseconds + IOS_ARCHIVE_PRIVACY_EVIDENCE_MAX_FUTURE_CLOCK_SKEW_MS;
  assertExactKeys(evidence, TOP_LEVEL_KEYS, 'evidence');
  if (evidence.schemaVersion !== IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION) {
    fail(
      'SCHEMA_VERSION',
      'Unsupported iOS archive privacy-evidence schema version.',
      'schemaVersion',
    );
  }
  if (evidence.kind !== 'ios_archive_privacy_evidence_index') {
    fail('SCHEMA_KIND', 'Evidence kind must be ios_archive_privacy_evidence_index.', 'kind');
  }

  const context = validateExpectedContext(options);
  const bounds = validatedBounds(options.bounds);
  const root = checkedRoot(options.root ?? process.cwd());
  const state = {
    bounds,
    fileHashes: new Set(),
    identities: new Set(),
    paths: new Set(),
    references: [],
    timestamps: [],
    totalBytes: 0n,
  };

  assertExactKeys(evidence.source, SOURCE_KEYS, 'source');
  if (typeof evidence.source.gitSha !== 'string' || !GIT_SHA.test(evidence.source.gitSha)) {
    fail(
      'SOURCE_GIT_SHA',
      'source.gitSha must be 40 lowercase hexadecimal digits.',
      'source.gitSha',
    );
  }
  if (evidence.source.gitSha !== context.expectedSourceGitSha) {
    fail(
      'SOURCE_GIT_MISMATCH',
      'source.gitSha does not match the current source revision.',
      'source.gitSha',
    );
  }
  const ledgerHashes = validateLedgerHashes(evidence.source.ledgerHashes, 'source.ledgerHashes');
  if (evidence.source.iosPrivacySourceAudit?.path !== IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH) {
    fail(
      'SOURCE_AUDIT_PATH',
      `The source audit must use ${IOS_ARCHIVE_PRIVACY_SOURCE_AUDIT_PATH}.`,
      'source.iosPrivacySourceAudit.path',
    );
  }
  const sourceAuditReference = validateReference({
    value: evidence.source.iosPrivacySourceAudit,
    path: 'source.iosPrivacySourceAudit',
    root,
    bounds,
    maximumBytes: bounds.maxSourceAuditBytes,
    state,
    collectBytes: true,
  });
  validateSourceAuditReport(decodeCanonicalSourceAudit(sourceAuditReference.bytes), ledgerHashes);

  const build = validateBuild(evidence.build, context.expectedBuild);
  state.timestamps.push({ milliseconds: build.builtAtMilliseconds, path: 'build.builtAt' });
  const sourceAuditCapturedAt = canonicalIsoTimestamp(
    sourceAuditReference.capturedAt,
    'source.iosPrivacySourceAudit.capturedAt',
  );
  if (sourceAuditCapturedAt.milliseconds > build.builtAtMilliseconds) {
    fail(
      'SOURCE_AUDIT_TIMESTAMP_ORDER',
      'The source-audit capture cannot occur after build completion.',
      'source.iosPrivacySourceAudit.capturedAt',
    );
  }
  const toolchain = validateToolchain(evidence.toolchain);
  const provenance = validateProvenance(evidence.provenance, {
    root,
    bounds,
    state,
    build,
    toolchain,
    sourceGitSha: evidence.source.gitSha,
  });

  assertExactKeys(evidence.archive, ARCHIVE_KEYS, 'archive');
  if (!['xcarchive_zip', 'ipa'].includes(evidence.archive.format)) {
    fail('ARCHIVE_FORMAT', 'archive.format must be xcarchive_zip or ipa.', 'archive.format');
  }
  if (evidence.archive.immutable !== true) {
    fail('ARCHIVE_IMMUTABLE', 'archive.immutable must be true.', 'archive.immutable');
  }
  const archivePath = evidence.archive.file?.path;
  if (
    (evidence.archive.format === 'xcarchive_zip' &&
      (typeof archivePath !== 'string' || !archivePath.endsWith('.xcarchive.zip'))) ||
    (evidence.archive.format === 'ipa' &&
      (typeof archivePath !== 'string' || !archivePath.endsWith('.ipa')))
  ) {
    fail(
      'ARCHIVE_EXTENSION',
      'Archive extension does not match archive.format.',
      'archive.file.path',
    );
  }
  const archiveReference = validateReference({
    value: evidence.archive.file,
    path: 'archive.file',
    root,
    bounds,
    maximumBytes: bounds.maxArchiveBytes,
    state,
    collectBytes: true,
  });
  if (!archiveReference.prefix.equals(ZIP_LOCAL_FILE_MAGIC)) {
    fail('ARCHIVE_MAGIC', 'Archive must begin with ZIP local-file magic bytes.', 'archive.file');
  }
  const archiveContainer = validateZipArchive(
    archiveReference.bytes,
    evidence.archive.format,
    { ...build, evaluatedAtMilliseconds },
    bounds,
  );
  const archiveCapturedAt = canonicalIsoTimestamp(
    archiveReference.capturedAt,
    'archive.file.capturedAt',
  );
  if (archiveCapturedAt.milliseconds < build.builtAtMilliseconds) {
    fail(
      'ARCHIVE_TIMESTAMP_ORDER',
      'Archive capture cannot predate build completion.',
      'archive.file.capturedAt',
    );
  }

  assertExactKeys(evidence.artifacts, IOS_ARCHIVE_PRIVACY_EVIDENCE_ARTIFACT_NAMES, 'artifacts');
  const artifacts = {};
  for (const name of IOS_ARCHIVE_PRIVACY_EVIDENCE_ARTIFACT_NAMES) {
    const reference = validateReference({
      value: evidence.artifacts[name],
      path: `artifacts.${name}`,
      root,
      bounds,
      maximumBytes: bounds.maxEvidenceArtifactBytes,
      state,
    });
    const capturedAt = canonicalIsoTimestamp(reference.capturedAt, `artifacts.${name}.capturedAt`);
    if (capturedAt.milliseconds < build.builtAtMilliseconds) {
      fail(
        'ARTIFACT_TIMESTAMP_ORDER',
        'Archive-derived evidence cannot predate build completion.',
        `artifacts.${name}.capturedAt`,
      );
    }
    artifacts[name] = normalizedReference(reference);
  }

  assertExactKeys(evidence.attestations, ATTESTATION_KEYS, 'attestations');
  for (const key of ATTESTATION_KEYS) {
    if (evidence.attestations[key] !== true) {
      fail('ATTESTATION_FALSE', `attestations.${key} must be exactly true.`, `attestations.${key}`);
    }
  }

  const review = validateReview(evidence.review, bounds, state.timestamps);
  rejectFutureTimestamps(
    [
      ...state.timestamps,
      {
        milliseconds: review.privacy.reviewedAtMilliseconds,
        path: 'review.privacy.reviewedAt',
      },
      {
        milliseconds: review.release.reviewedAtMilliseconds,
        path: 'review.release.reviewedAt',
      },
    ],
    latestAllowedTimestampMilliseconds,
  );
  const normalized = {
    schemaVersion: IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION,
    kind: 'ios_archive_privacy_evidence_index_validation',
    status: 'evidence_index_validated',
    source: {
      gitSha: evidence.source.gitSha,
      iosPrivacySourceAudit: normalizedReference(sourceAuditReference),
      ledgerHashes,
    },
    archive: {
      format: evidence.archive.format,
      immutable: true,
      file: normalizedReference(archiveReference),
      containerIntegrity: {
        ...archiveContainer.identity,
        centralDirectoryValidated: true,
        entryCount: archiveContainer.entryCount,
        entryPayloadsValidated: true,
        layout: archiveContainer.layout,
      },
    },
    build: {
      appVersion: build.appVersion,
      buildNumber: build.buildNumber,
      bundleIdentifier: build.bundleIdentifier,
      teamIdentifier: build.teamIdentifier,
      builtAt: build.builtAt,
    },
    toolchain,
    provenance,
    artifacts,
    review: {
      privacy: {
        identitySha256: review.privacy.identitySha256,
        reviewedAt: review.privacy.reviewedAt,
        decision: 'approve',
      },
      release: {
        identitySha256: review.release.identitySha256,
        reviewedAt: review.release.reviewedAt,
        decision: 'approve',
      },
    },
    attestations: { ...evidence.attestations },
    claims: {
      appStoreAcceptanceProven: false,
      appStorePrivacyLabelsLegallyApproved: false,
      archiveCodeSignatureCryptographicallyVerified: false,
      derEncodedProfileValidated: false,
      legalComplianceProven: false,
      provisioningCmsSignatureTrusted: false,
    },
  };
  recheckReferenceSet(state, root);
  return deepFreeze(normalized);
}

/**
 * Safely load and validate one repository-confined archive privacy-evidence
 * JSON file. The JSON record is re-inspected after validation so a caller
 * never receives a result for a file that changed during the operation.
 */
export function loadAndValidateIosArchivePrivacyEvidence(evidenceJsonPath, options = {}) {
  validateOptionsShape(options);
  const bounds = validatedBounds(options.bounds);
  const root = checkedRoot(options.root ?? process.cwd());
  const inspected = inspectFile(
    root,
    evidenceJsonPath,
    bounds.maxEvidenceJsonBytes,
    bounds,
    'evidenceJsonPath',
    true,
  );
  const evidence = decodeEvidenceJson(inspected.bytes, bounds, inspected.path);
  const validation = validateIosArchivePrivacyEvidence(evidence, options);
  const referencedFiles = [
    validation.source.iosPrivacySourceAudit,
    validation.archive.file,
    validation.provenance.easBuildLog,
    ...Object.values(validation.artifacts),
  ];

  const evidencePathKey = inspected.path.toLowerCase();
  for (const reference of referencedFiles) {
    if (reference.path.toLowerCase() === evidencePathKey) {
      fail(
        'EVIDENCE_JSON_REFERENCE_PATH',
        'The evidence JSON file must be distinct from every referenced evidence file.',
        'evidenceJsonPath',
      );
    }
    if (reference.sha256 === inspected.sha256) {
      fail(
        'EVIDENCE_JSON_REFERENCE_HASH',
        'The evidence JSON file must not reuse bytes from a referenced evidence file.',
        'evidenceJsonPath',
      );
    }
  }

  const referencedBytes = referencedFiles.reduce(
    (total, reference) => total + BigInt(reference.sizeBytes),
    BigInt(inspected.sizeBytes),
  );
  if (referencedBytes > BigInt(bounds.maxTotalEvidenceBytes)) {
    fail(
      'TOTAL_SIZE_BOUND',
      'Combined evidence, including its JSON record, exceeds the reviewed total-size bound.',
      'evidenceJsonPath',
    );
  }

  const rechecked = inspectFile(
    root,
    evidenceJsonPath,
    bounds.maxEvidenceJsonBytes,
    bounds,
    'evidenceJsonPath',
  );
  if (
    !sameIdentity(inspected.identity, rechecked.identity) ||
    inspected.identity.size !== rechecked.identity.size ||
    inspected.identity.mtimeNs !== rechecked.identity.mtimeNs ||
    inspected.sha256 !== rechecked.sha256 ||
    inspected.sizeBytes !== rechecked.sizeBytes
  ) {
    fail(
      'EVIDENCE_JSON_RACE',
      'The archive-evidence JSON file changed during validation.',
      'evidenceJsonPath',
    );
  }

  recheckNormalizedReferenceSet(validation, root, bounds);
  const finalJsonRecheck = inspectFile(
    root,
    evidenceJsonPath,
    bounds.maxEvidenceJsonBytes,
    bounds,
    'evidenceJsonPath',
  );
  if (
    !sameIdentity(inspected.identity, finalJsonRecheck.identity) ||
    inspected.identity.size !== finalJsonRecheck.identity.size ||
    inspected.identity.mtimeNs !== finalJsonRecheck.identity.mtimeNs ||
    inspected.sha256 !== finalJsonRecheck.sha256 ||
    inspected.sizeBytes !== finalJsonRecheck.sizeBytes
  ) {
    fail(
      'EVIDENCE_JSON_RACE',
      'The archive-evidence JSON file changed during validation.',
      'evidenceJsonPath',
    );
  }

  return deepFreeze({
    schemaVersion: IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION,
    kind: 'ios_archive_privacy_evidence_index_file_validation',
    status: validation.status,
    evidenceRecord: {
      path: inspected.path,
      sha256: inspected.sha256,
      sizeBytes: inspected.sizeBytes,
    },
    validation,
  });
}
