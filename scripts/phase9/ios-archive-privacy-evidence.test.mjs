import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';

import forge from 'node-forge';

import {
  IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS,
  IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION,
  IosArchivePrivacyEvidenceError,
  loadAndValidateIosArchivePrivacyEvidence,
  recheckIosArchivePrivacyEvidenceReferences,
  validateIosArchivePrivacyEvidence,
} from './ios-archive-privacy-evidence.mjs';
import { auditIosReleaseCandidateCrossBinding } from './ios-release-candidate-cross-binding.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_AUDIT_RELATIVE_PATH = 'docs/phase-9/generated/ios-privacy-source-audit.json';
const EVIDENCE_JSON_RELATIVE_PATH = 'evidence/ios/archive-privacy-evidence.json';
const CURRENT_SOURCE_AUDIT_BYTES = readFileSync(join(REPOSITORY_ROOT, SOURCE_AUDIT_RELATIVE_PATH));
const CURRENT_SOURCE_AUDIT = JSON.parse(CURRENT_SOURCE_AUDIT_BYTES.toString('utf8'));
const CHECKED_IN_TEMPLATE = JSON.parse(
  readFileSync(
    join(
      REPOSITORY_ROOT,
      'docs/phase-9/release-candidates/_template/ios-archive-privacy-evidence.json',
    ),
    'utf8',
  ),
);
const EXPECTED_SOURCE_GIT_SHA = '0123456789abcdef0123456789abcdef01234567';
const EAS_BUILD_ID = '123e4567-e89b-42d3-a456-426614174000';
const SOURCE_CAPTURED_AT = '2026-07-16T12:00:00.000Z';
const BUILT_AT = '2026-07-16T13:00:00.000Z';
const ARTIFACT_CAPTURED_AT = '2026-07-16T13:15:00.000Z';
const REVIEWED_AT = '2026-07-16T14:00:00.000Z';
const EXPECTED_BUILD = Object.freeze({
  appVersion: '1.0.0',
  buildNumber: '42',
  bundleIdentifier: 'com.layerwell.app',
  teamIdentifier: 'ABCDE12345',
});

test('keeps the checked-in invalid template synchronized with the exact index schema', () => {
  assert.equal(CHECKED_IN_TEMPLATE.schemaVersion, IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION);
  assert.equal(CHECKED_IN_TEMPLATE.kind, 'ios_archive_privacy_evidence_index');
  assert.deepEqual(Object.keys(CHECKED_IN_TEMPLATE.provenance).sort(), [
    'easBuildId',
    'easBuildLog',
    'easCliVersion',
    'easGitCommitSha',
    'fastlaneVersion',
    'macosVersion',
    'xcodeBuild',
  ]);
  assert.equal(CHECKED_IN_TEMPLATE.provenance.easCliVersion, '21.0.1');
  assert.equal(CHECKED_IN_TEMPLATE.archive.immutable, false);
  assert.ok(Object.values(CHECKED_IN_TEMPLATE.attestations).every((value) => value === false));
});
const ARTIFACT_KEYS = Object.freeze([
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
const FALSE_SOURCE_CLAIM_KEYS = Object.freeze([
  'appStoreAcceptanceProven',
  'appStorePrivacyLabelsVerified',
  'archiveInspected',
  'binarySignaturesVerified',
  'mergedPrivacyReportVerified',
]);
const ATTESTATION_KEYS = Object.freeze([
  'archiveInspected',
  'evidenceComplete',
  'sourceAuditMatched',
  'artifactsImmutable',
]);
const SHA256 = /^[0-9a-f]{64}$/;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function safeCleanup(root) {
  const absolute = resolve(root);
  const temporaryRoot = resolve(tmpdir());
  const rel = relative(temporaryRoot, absolute);
  if (
    isAbsolute(rel) ||
    rel.startsWith('..') ||
    rel.includes(sep) ||
    !rel.startsWith('layerwell-ios-archive-privacy-')
  ) {
    throw new Error('Refusing to clean an unexpected archive-evidence fixture path.');
  }
  rmSync(absolute, { force: true, recursive: true });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZipEntries(values, zipOptions = {}) {
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  for (const [index, [fileName, contents, entryOptions = {}]] of values.entries()) {
    const name = Buffer.from(fileName, 'utf8');
    const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
    const method = entryOptions.method ?? 0;
    const compressed =
      method === 8
        ? Buffer.concat([deflateRawSync(data), entryOptions.trailingData ?? Buffer.alloc(0)])
        : data;
    const flags = entryOptions.flags ?? 0x0800;
    const versionNeeded = entryOptions.versionNeeded ?? 20;
    const extra = entryOptions.extra ?? Buffer.alloc(0);
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(versionNeeded, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(extra.length, 28);
    const localRecord = Buffer.concat([localHeader, name, extra, compressed]);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(entryOptions.madeBy ?? 20, 4);
    centralHeader.writeUInt16LE(versionNeeded, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(extra.length, 30);
    centralHeader.writeUInt32LE(entryOptions.externalAttributes ?? 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    localRecords.push(localRecord);
    centralRecords.push(Buffer.concat([centralHeader, name, extra]));
    localOffset += localRecord.length;
    if (zipOptions.gapAfterIndex === index) {
      const gap = zipOptions.gapBytes ?? Buffer.from([0]);
      localRecords.push(gap);
      localOffset += gap.length;
    }
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(values.length, 8);
  end.writeUInt16LE(values.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localRecords, centralDirectory, end]);
}

function storedZip(fileName, contents) {
  return storedZipEntries([[fileName, contents]]);
}

function appInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${EXPECTED_BUILD.bundleIdentifier}</string>
<key>CFBundleShortVersionString</key><string>${EXPECTED_BUILD.appVersion}</string>
<key>CFBundleVersion</key><string>${EXPECTED_BUILD.buildNumber}</string>
<key>CFBundleExecutable</key><string>Layerwell</string>
</dict></plist>\n`;
}

function archiveInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>ApplicationProperties</key><dict>
<key>ApplicationPath</key><string>Applications/Layerwell.app</string>
<key>CFBundleIdentifier</key><string>${EXPECTED_BUILD.bundleIdentifier}</string>
<key>CFBundleShortVersionString</key><string>${EXPECTED_BUILD.appVersion}</string>
<key>CFBundleVersion</key><string>${EXPECTED_BUILD.buildNumber}</string>
<key>Team</key><string>${EXPECTED_BUILD.teamIdentifier}</string>
</dict></dict></plist>\n`;
}

let cachedProvisioningProfile;

function provisioningProfileCms(overrides = {}) {
  const cacheable = Object.keys(overrides).length === 0;
  if (cacheable && cachedProvisioningProfile) return cachedProvisioningProfile;
  const prefix = overrides.prefix ?? 'LEGACY1234';
  const teamIdentifier = overrides.teamIdentifier ?? EXPECTED_BUILD.teamIdentifier;
  const applicationIdentifier =
    overrides.applicationIdentifier ?? `${prefix}.${EXPECTED_BUILD.bundleIdentifier}`;
  const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Name</key><string>Layerwell App Store</string>
<key>UUID</key><string>123E4567-E89B-42D3-A456-426614174111</string>
<key>CreationDate</key><date>2026-07-15T00:00:00Z</date>
<key>ExpirationDate</key><date>${overrides.expirationDate ?? '2030-07-15T00:00:00Z'}</date>
<key>Platform</key><array><string>iOS</string></array>
<key>TeamIdentifier</key><array><string>${teamIdentifier}</string></array>
<key>ApplicationIdentifierPrefix</key><array><string>${prefix}</string></array>
<key>Entitlements</key><dict>
<key>application-identifier</key><string>${applicationIdentifier}</string>
<key>com.apple.developer.team-identifier</key><string>${teamIdentifier}</string>
<key>get-task-allow</key>${overrides.getTaskAllow === true ? '<true/>' : '<false/>'}
</dict></dict></plist>\n`;
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date('2026-01-01T00:00:00.000Z');
  certificate.validity.notAfter = new Date('2031-01-01T00:00:00.000Z');
  const attributes = [{ name: 'commonName', value: 'Unsigned Test Profile Signer' }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  const signed = forge.pkcs7.createSignedData();
  signed.content = forge.util.createBuffer(profile, 'utf8');
  signed.addCertificate(certificate);
  signed.addSigner({
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    key: keys.privateKey,
  });
  signed.sign();
  const result = Buffer.from(forge.asn1.toDer(signed.toAsn1()).getBytes(), 'binary');
  if (cacheable) cachedProvisioningProfile = result;
  return result;
}

function archiveZipFixture(format, options = {}) {
  const appRoot =
    format === 'ipa'
      ? 'Payload/Layerwell.app'
      : 'Layerwell.xcarchive/Products/Applications/Layerwell.app';
  const entries = [
    [`${appRoot}/Info.plist`, options.appInfo ?? appInfoPlist(), options.appInfoOptions],
    [`${appRoot}/Layerwell`, Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), options.executableOptions],
    [`${appRoot}/_CodeSignature/CodeResources`, 'sealed resources\n', options.codeResourcesOptions],
    [
      `${appRoot}/embedded.mobileprovision`,
      options.mobileProvision ?? provisioningProfileCms(),
      options.mobileProvisionOptions,
    ],
  ];
  if (format === 'xcarchive_zip') {
    entries.unshift([
      'Layerwell.xcarchive/Info.plist',
      options.archiveInfo ?? archiveInfoPlist(),
      options.archiveInfoOptions,
    ]);
  }
  if (options.extraEntries) entries.push(...options.extraEntries);
  return storedZipEntries(entries, options.zipOptions);
}

function writeReference(root, path, bytes, capturedAt = ARTIFACT_CAPTURED_AT) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const absolute = join(root, ...path.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
  return {
    path,
    sha256: sha256(value),
    sizeBytes: value.length,
    capturedAt,
  };
}

function rewriteReference(root, reference, bytes) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  writeFileSync(join(root, ...reference.path.split('/')), value);
  reference.sha256 = sha256(value);
  reference.sizeBytes = value.length;
}

function rewriteSourceAudit(fixture, value) {
  rewriteReference(
    fixture.root,
    fixture.evidence.source.iosPrivacySourceAudit,
    canonicalJson(value),
  );
}

function writeEvidenceJson(fixture, bytes = canonicalJson(fixture.evidence)) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, 'utf8');
  const absolute = join(fixture.root, ...fixture.evidenceJsonPath.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
  return value;
}

function createFixture(t, { format = 'xcarchive_zip' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-ios-archive-privacy-'));
  t.after(() => safeCleanup(root));

  const sourceAudit = structuredClone(CURRENT_SOURCE_AUDIT);
  const sourceAuditReference = writeReference(
    root,
    SOURCE_AUDIT_RELATIVE_PATH,
    CURRENT_SOURCE_AUDIT_BYTES,
    SOURCE_CAPTURED_AT,
  );
  const archivePath =
    format === 'ipa' ? 'evidence/ios/candidate.ipa' : 'evidence/ios/candidate.xcarchive.zip';
  const archiveReference = writeReference(root, archivePath, archiveZipFixture(format));
  const artifacts = {
    nativeLock: writeReference(root, 'evidence/ios/Podfile.lock', 'PODS:\n  - Expo (56.0.0)\n'),
    privacyManifestLedger: writeReference(
      root,
      'evidence/ios/privacy-manifest-ledger.json',
      '{"manifests":["PrivacyInfo.xcprivacy"]}\n',
    ),
    mergedPrivacyReport: writeReference(
      root,
      'evidence/ios/merged-privacy-report.pdf',
      '%PDF-1.7\n% aggregate privacy report fixture\n%%EOF\n',
    ),
    requiredReasonApiReport: writeReference(
      root,
      'evidence/ios/required-reason-api-report.json',
      '{"categories":[]}\n',
    ),
    nativeBinaryLedger: writeReference(
      root,
      'evidence/ios/native-binary-ledger.json',
      '{"frameworks":[],"libraries":[]}\n',
    ),
    sdkSignatureReport: writeReference(
      root,
      'evidence/ios/sdk-signatures.txt',
      'All reviewed SDK signatures verified.\n',
    ),
    entitlementsSigningReport: writeReference(
      root,
      'evidence/ios/entitlements-signing.txt',
      'Application identifier and TeamIdentifier verified.\n',
    ),
    symbolsProcessingReport: writeReference(
      root,
      'evidence/ios/symbols-processing.txt',
      'dSYM UUIDs and processing warnings reconciled.\n',
    ),
    trafficStorageReconciliation: writeReference(
      root,
      'evidence/ios/traffic-storage-reconciliation.json',
      '{"network":"reconciled","storage":"reconciled"}\n',
    ),
    appPrivacyAnswers: writeReference(
      root,
      'evidence/ios/app-privacy-answers.json',
      '{"reviewStatus":"approved"}\n',
    ),
  };
  const evidence = {
    schemaVersion: IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION,
    kind: 'ios_archive_privacy_evidence_index',
    source: {
      gitSha: EXPECTED_SOURCE_GIT_SHA,
      iosPrivacySourceAudit: sourceAuditReference,
      ledgerHashes: structuredClone(sourceAudit.ledgerHashes),
    },
    archive: {
      format,
      immutable: true,
      file: archiveReference,
    },
    build: {
      ...EXPECTED_BUILD,
      builtAt: BUILT_AT,
    },
    toolchain: {
      easBuildImage: 'macos-tahoe-26.4-xcode-26.4',
      xcodeVersion: '26.4',
      iosSdkVersion: '26.4',
      nodeVersion: '22.22.2',
      cocoaPodsVersion: '1.16.2',
    },
    provenance: {
      easBuildId: EAS_BUILD_ID,
      easGitCommitSha: EXPECTED_SOURCE_GIT_SHA,
      easCliVersion: '21.0.1',
      easBuildLog: writeReference(
        root,
        'evidence/ios/eas-build.log',
        [
          'EAS build ' + EAS_BUILD_ID,
          'Git commit ' + EXPECTED_SOURCE_GIT_SHA,
          'EAS CLI 21.0.1',
          'Image macos-tahoe-26.4-xcode-26.4',
          'macOS 26.4.1',
          'Xcode 26.4 (17E202)',
          'iOS SDK 26.4',
          'Node 22.22.2',
          'CocoaPods 1.16.2',
          'Fastlane 2.233.1',
          '',
        ].join('\n'),
      ),
      macosVersion: '26.4.1',
      xcodeBuild: '17E202',
      fastlaneVersion: '2.233.1',
    },
    artifacts,
    review: {
      privacy: {
        name: 'Avery Privacy Reviewer',
        reviewedAt: REVIEWED_AT,
        decision: 'approve',
      },
      release: {
        name: 'Riley Release Owner',
        reviewedAt: REVIEWED_AT,
        decision: 'approve',
      },
    },
    attestations: {
      archiveInspected: true,
      evidenceComplete: true,
      sourceAuditMatched: true,
      artifactsImmutable: true,
    },
  };
  const fixture = {
    root,
    evidence,
    evidenceJsonPath: EVIDENCE_JSON_RELATIVE_PATH,
    sourceAudit,
    expectedBuild: structuredClone(EXPECTED_BUILD),
  };
  writeEvidenceJson(fixture);
  return fixture;
}

function validateFixture(fixture, overrides = {}) {
  return validateIosArchivePrivacyEvidence(fixture.evidence, {
    root: fixture.root,
    expectedSourceGitSha: EXPECTED_SOURCE_GIT_SHA,
    expectedBuild: fixture.expectedBuild,
    ...overrides,
  });
}

function loadFixture(fixture, evidenceJsonPath = fixture.evidenceJsonPath, overrides = {}) {
  return loadAndValidateIosArchivePrivacyEvidence(evidenceJsonPath, {
    root: fixture.root,
    expectedSourceGitSha: EXPECTED_SOURCE_GIT_SHA,
    expectedBuild: fixture.expectedBuild,
    ...overrides,
  });
}

function validationFailure(fixture, overrides = {}) {
  let thrown;
  try {
    validateFixture(fixture, overrides);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'Expected archive privacy evidence validation to fail.');
  assert.ok(
    thrown instanceof IosArchivePrivacyEvidenceError,
    'Validation failures must use the typed archive privacy evidence error.',
  );
  assert.match(thrown.code, /^[A-Z][A-Z0-9_]*$/);
  return thrown;
}

function loaderFailure(fixture, evidenceJsonPath = fixture.evidenceJsonPath, overrides = {}) {
  let thrown;
  try {
    loadFixture(fixture, evidenceJsonPath, overrides);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'Expected archive privacy evidence JSON loading to fail.');
  assert.ok(
    thrown instanceof IosArchivePrivacyEvidenceError,
    'Loader failures must use the typed archive privacy evidence error.',
  );
  assert.match(thrown.code, /^[A-Z][A-Z0-9_]*$/);
  return thrown;
}

function assertDeepFrozen(value, seen = new WeakSet()) {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

test('exports a bounded schema contract and the checked-in source audit has source-only claims', () => {
  assert.equal(IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION, 1);
  assert.equal(Object.isFrozen(IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS), true);
  const entries = Object.entries(IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS);
  assert.ok(entries.length > 0);
  for (const [name, value] of entries) {
    assert.match(name, /^[A-Za-z][A-Za-z0-9]*$/);
    assert.equal(Number.isSafeInteger(value), true);
    assert.ok(value > 0);
  }
  assert.equal(CURRENT_SOURCE_AUDIT.status, 'archive_required');
  assert.deepEqual(
    Object.keys(CURRENT_SOURCE_AUDIT.claims).sort(),
    [...FALSE_SOURCE_CLAIM_KEYS].sort(),
  );
  for (const key of FALSE_SOURCE_CLAIM_KEYS) assert.equal(CURRENT_SOURCE_AUDIT.claims[key], false);
  assert.equal(CURRENT_SOURCE_AUDIT.scope.releaseArchiveAudited, false);
  assert.deepEqual(CURRENT_SOURCE_AUDIT.errors, []);
  assert.equal(CURRENT_SOURCE_AUDIT.summary.errorCount, 0);
  assert.equal(Object.keys(CURRENT_SOURCE_AUDIT.ledgerHashes).length, 7);
  for (const digest of Object.values(CURRENT_SOURCE_AUDIT.ledgerHashes)) {
    assert.match(digest, SHA256);
  }
});

test('accepts exact xcarchive ZIP evidence and returns a redacted isolated deep-frozen value', (t) => {
  const fixture = createFixture(t);
  const privacyReviewerName = fixture.evidence.review.privacy.name;
  const releaseReviewerName = fixture.evidence.review.release.name;
  const originalNativeLock = structuredClone(fixture.evidence.artifacts.nativeLock);
  const validated = validateFixture(fixture);
  assert.equal(validated.schemaVersion, IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION);
  assert.equal(validated.kind, 'ios_archive_privacy_evidence_index_validation');
  assert.equal(validated.status, 'evidence_index_validated');
  assert.notEqual(validated, fixture.evidence);
  assert.notEqual(validated.source, fixture.evidence.source);
  assert.deepEqual(
    validated.source.iosPrivacySourceAudit,
    fixture.evidence.source.iosPrivacySourceAudit,
  );
  assert.deepEqual(validated.source.ledgerHashes, fixture.evidence.source.ledgerHashes);
  assert.deepEqual(
    {
      format: validated.archive.format,
      immutable: validated.archive.immutable,
      file: validated.archive.file,
    },
    fixture.evidence.archive,
  );
  assert.deepEqual(validated.archive.containerIntegrity, {
    applicationIdentifierPrefixSha256: sha256(Buffer.from('LEGACY1234', 'utf8')),
    applicationIdentityValidated: true,
    centralDirectoryValidated: true,
    cmsSignedDataStructureParsed: true,
    codeResourcesPresent: true,
    entryCount: 5,
    entryPayloadsValidated: true,
    executablePresent: true,
    layout: 'xcarchive_bundle',
    structuredIdentityFieldsMatched: true,
  });
  assert.deepEqual(validated.build, fixture.evidence.build);
  assert.deepEqual(validated.toolchain, fixture.evidence.toolchain);
  assert.deepEqual(validated.provenance, fixture.evidence.provenance);
  assert.deepEqual(validated.artifacts, fixture.evidence.artifacts);
  assert.deepEqual(validated.attestations, fixture.evidence.attestations);
  assert.equal(Object.hasOwn(validated.review.privacy, 'name'), false);
  assert.equal(Object.hasOwn(validated.review.release, 'name'), false);
  assert.equal(
    validated.review.privacy.identitySha256,
    sha256(Buffer.from(privacyReviewerName, 'utf8')),
  );
  assert.equal(
    validated.review.release.identitySha256,
    sha256(Buffer.from(releaseReviewerName, 'utf8')),
  );
  assert.match(validated.review.privacy.identitySha256, SHA256);
  assert.match(validated.review.release.identitySha256, SHA256);
  assert.ok(Object.values(validated.claims).length > 0);
  assert.equal(
    Object.values(validated.claims).every((value) => value === false),
    true,
  );
  assertDeepFrozen(validated);

  fixture.evidence.build.buildNumber = '999';
  fixture.evidence.source.ledgerHashes.nativePackagesSha256 = 'f'.repeat(64);
  fixture.evidence.artifacts.nativeLock.path = 'mutated/path';
  fixture.evidence.review.privacy.name = 'Mutated Reviewer';
  assert.equal(validated.build.buildNumber, '42');
  assert.equal(
    validated.source.ledgerHashes.nativePackagesSha256,
    CURRENT_SOURCE_AUDIT.ledgerHashes.nativePackagesSha256,
  );
  assert.deepEqual(validated.artifacts.nativeLock, originalNativeLock);
  assert.equal(
    validated.review.privacy.identitySha256,
    sha256(Buffer.from(privacyReviewerName, 'utf8')),
  );
  assert.throws(() => {
    validated.build.buildNumber = '1000';
  }, TypeError);
});

test('accepts an exact IPA ZIP container', (t) => {
  const fixture = createFixture(t, { format: 'ipa' });
  const validated = validateFixture(fixture);
  assert.equal(validated.archive.format, 'ipa');
  assert.equal(validated.archive.file.path.endsWith('.ipa'), true);
  assert.equal(validated.archive.containerIntegrity.layout, 'ipa_payload_app');
});

test('redacts referenced file contents from typed failures', (t) => {
  const fixture = createFixture(t);
  const secret = 'DO_NOT_LEAK_ARCHIVE_REVIEW_SECRET_8d3e41';
  rewriteReference(
    fixture.root,
    fixture.evidence.artifacts.sdkSignatureReport,
    'signature report\n' + secret + '\n',
  );
  fixture.evidence.artifacts.sdkSignatureReport.sha256 = '0'.repeat(64);
  const error = validationFailure(fixture);
  const rendered = [
    error.message,
    error.stack,
    error.cause instanceof Error ? error.cause.message : String(error.cause ?? ''),
  ].join('\n');
  assert.equal(rendered.includes(secret), false);
});

test('rejects missing, extra, and wrong-typed exact-schema fields', async (t) => {
  const cases = [
    ['missing top-level field', (value) => delete value.review],
    ['extra top-level field', (value) => (value.unreviewed = true)],
    ['wrong top-level type', (value) => (value.artifacts = [])],
    ['wrong schema version', (value) => (value.schemaVersion = 2)],
    ['wrong kind', (value) => (value.kind = 'ios_archive_evidence')],
    ['missing source field', (value) => delete value.source.ledgerHashes],
    ['extra source field', (value) => (value.source.archiveValidated = true)],
    ['missing archive field', (value) => delete value.archive.immutable],
    ['extra archive field', (value) => (value.archive.path = value.archive.file.path)],
    ['wrong build type', (value) => (value.build = null)],
    ['extra build field', (value) => (value.build.marketingName = 'Layerwell')],
    ['missing toolchain field', (value) => delete value.toolchain.xcodeVersion],
    ['extra toolchain field', (value) => (value.toolchain.fastlaneVersion = '2.0.0')],
    ['missing provenance field', (value) => delete value.provenance.easBuildLog],
    ['extra provenance field', (value) => (value.provenance.workerId = 'worker-1')],
    ['missing artifact', (value) => delete value.artifacts.nativeLock],
    [
      'extra artifact',
      (value) => (value.artifacts.screenshots = value.artifacts.appPrivacyAnswers),
    ],
    ['missing review lane', (value) => delete value.review.privacy],
    ['extra review lane', (value) => (value.review.legal = value.review.privacy)],
    ['missing attestation', (value) => delete value.attestations.archiveInspected],
    ['extra attestation', (value) => (value.attestations.appStoreAccepted = true)],
    [
      'missing reference field',
      (value) => delete value.artifacts.requiredReasonApiReport.capturedAt,
    ],
    [
      'extra reference field',
      (value) => (value.artifacts.requiredReasonApiReport.mediaType = 'application/json'),
    ],
    [
      'wrong reference size type',
      (value) => (value.artifacts.requiredReasonApiReport.sizeBytes = '10'),
    ],
    [
      'wrong reference digest type',
      (value) => (value.artifacts.requiredReasonApiReport.sha256 = 123),
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture.evidence);
      validationFailure(fixture);
    });
  }
});

test('rejects missing files, directories, symlinks, hardlinks, and path escapes', async (t) => {
  await t.test('missing referenced file', (child) => {
    const fixture = createFixture(child);
    rmSync(join(fixture.root, ...fixture.evidence.artifacts.nativeBinaryLedger.path.split('/')));
    validationFailure(fixture);
  });

  await t.test('directory in place of referenced file', (child) => {
    const fixture = createFixture(child);
    const path = join(
      fixture.root,
      ...fixture.evidence.artifacts.nativeBinaryLedger.path.split('/'),
    );
    rmSync(path);
    mkdirSync(path);
    validationFailure(fixture);
  });

  await t.test('file symlink', (child) => {
    const fixture = createFixture(child);
    const reference = fixture.evidence.artifacts.sdkSignatureReport;
    const path = join(fixture.root, ...reference.path.split('/'));
    const target = join(fixture.root, 'evidence/ios/unreferenced-signatures.txt');
    writeFileSync(target, readFileSync(path));
    rmSync(path);
    try {
      symlinkSync(target, path, 'file');
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        child.skip('File symlink creation is unavailable on this Windows host.');
        return;
      }
      throw error;
    }
    validationFailure(fixture);
  });

  await t.test('hardlinked referenced file', (child) => {
    const fixture = createFixture(child);
    const reference = fixture.evidence.artifacts.entitlementsSigningReport;
    const path = join(fixture.root, ...reference.path.split('/'));
    const target = join(fixture.root, 'evidence/ios/unreferenced-entitlements.txt');
    writeFileSync(target, readFileSync(path));
    rmSync(path);
    linkSync(target, path);
    validationFailure(fixture);
  });

  for (const [name, path] of [
    ['parent escape', '../outside.json'],
    ['absolute path', resolve(tmpdir(), 'outside.json')],
    ['backslash path', 'evidence\\ios\\native-binary-ledger.json'],
    ['dot segment', 'evidence/./ios/native-binary-ledger.json'],
  ]) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      fixture.evidence.artifacts.nativeBinaryLedger.path = path;
      validationFailure(fixture);
    });
  }
});

test('rejects duplicate reference paths and duplicate artifact digests', async (t) => {
  await t.test('duplicate path', (child) => {
    const fixture = createFixture(child);
    fixture.evidence.artifacts.appPrivacyAnswers = structuredClone(
      fixture.evidence.artifacts.trafficStorageReconciliation,
    );
    validationFailure(fixture);
  });

  await t.test('duplicate digest at distinct paths', (child) => {
    const fixture = createFixture(child);
    const source = fixture.evidence.artifacts.trafficStorageReconciliation;
    const duplicate = fixture.evidence.artifacts.appPrivacyAnswers;
    rewriteReference(
      fixture.root,
      duplicate,
      readFileSync(join(fixture.root, ...source.path.split('/'))),
    );
    assert.notEqual(source.path, duplicate.path);
    assert.equal(source.sha256, duplicate.sha256);
    validationFailure(fixture);
  });
});

test('enforces reviewed validation bounds and rejects invalid overrides', async (t) => {
  const boundEntries = Object.entries(IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS);
  const [firstName, firstMaximum] = boundEntries[0];
  const cases = [
    ['bounds must be an object', []],
    ['unknown bound', { unreviewedMaximum: 1 }],
    ['zero bound', { [firstName]: 0 }],
    ['fractional bound', { [firstName]: 1.5 }],
    ['bound above reviewed maximum', { [firstName]: firstMaximum + 1 }],
  ];
  for (const [name, bounds] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      validationFailure(fixture, { bounds });
    });
  }

  await t.test('restrictive bounds reject the evidence set', (child) => {
    const fixture = createFixture(child);
    const bounds = Object.fromEntries(boundEntries.map(([name]) => [name, 1]));
    validationFailure(fixture, { bounds });
  });
});

test('rejects digest, byte-size, content, and empty-file tampering', async (t) => {
  const cases = [
    [
      'digest mismatch',
      (fixture) => (fixture.evidence.artifacts.nativeLock.sha256 = 'f'.repeat(64)),
    ],
    [
      'uppercase digest',
      (fixture) =>
        (fixture.evidence.artifacts.nativeLock.sha256 =
          fixture.evidence.artifacts.nativeLock.sha256.toUpperCase()),
    ],
    ['size mismatch', (fixture) => (fixture.evidence.artifacts.nativeLock.sizeBytes += 1)],
    [
      'content changed after capture',
      (fixture) =>
        writeFileSync(
          join(fixture.root, ...fixture.evidence.artifacts.nativeLock.path.split('/')),
          'mutated lock bytes\n',
        ),
    ],
    [
      'empty referenced file',
      (fixture) =>
        rewriteReference(fixture.root, fixture.evidence.artifacts.nativeLock, Buffer.alloc(0)),
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture);
      validationFailure(fixture);
    });
  }
});

test('binds archive format to reviewed ZIP magic and exact extensions', async (t) => {
  await t.test('rejects non-ZIP archive bytes even with a matching reference', (child) => {
    const fixture = createFixture(child);
    rewriteReference(fixture.root, fixture.evidence.archive.file, 'not a ZIP container\n');
    validationFailure(fixture);
  });

  await t.test('rejects a truncated local header with ZIP magic', (child) => {
    const fixture = createFixture(child);
    rewriteReference(
      fixture.root,
      fixture.evidence.archive.file,
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(26)]),
    );
    const error = validationFailure(fixture);
    assert.match(error.code, /^ARCHIVE_ZIP_/u);
  });

  await t.test('rejects payload corruption even when the outer reference is rehashed', (child) => {
    const fixture = createFixture(child);
    const reference = fixture.evidence.archive.file;
    const bytes = Buffer.from(readFileSync(join(fixture.root, ...reference.path.split('/'))));
    const nameLength = bytes.readUInt16LE(26);
    bytes[30 + nameLength] ^= 0xff;
    rewriteReference(fixture.root, reference, bytes);
    const error = validationFailure(fixture);
    assert.equal(error.code, 'ARCHIVE_ZIP_CRC');
  });

  await t.test('rejects traversal entry paths', (child) => {
    const fixture = createFixture(child);
    rewriteReference(
      fixture.root,
      fixture.evidence.archive.file,
      storedZip('../Layerwell.xcarchive/Info.plist', 'unsafe'),
    );
    const error = validationFailure(fixture);
    assert.equal(error.code, 'ARCHIVE_ZIP_PATH');
  });

  await t.test('rejects an archive without the required platform layout', (child) => {
    const fixture = createFixture(child);
    rewriteReference(
      fixture.root,
      fixture.evidence.archive.file,
      storedZip('unrelated/Info.plist', 'wrong layout'),
    );
    const error = validationFailure(fixture);
    assert.equal(error.code, 'ARCHIVE_LAYOUT');
  });

  await t.test('rejects xcarchive ZIP with IPA extension', (child) => {
    const fixture = createFixture(child);
    const reference = fixture.evidence.archive.file;
    const previous = join(fixture.root, ...reference.path.split('/'));
    reference.path = 'evidence/ios/candidate.ipa';
    const next = join(fixture.root, ...reference.path.split('/'));
    renameSync(previous, next);
    validationFailure(fixture);
  });

  await t.test('rejects IPA with xcarchive ZIP extension', (child) => {
    const fixture = createFixture(child, { format: 'ipa' });
    const reference = fixture.evidence.archive.file;
    const previous = join(fixture.root, ...reference.path.split('/'));
    reference.path = 'evidence/ios/candidate.xcarchive.zip';
    const next = join(fixture.root, ...reference.path.split('/'));
    renameSync(previous, next);
    validationFailure(fixture);
  });

  await t.test('rejects unreviewed archive format', (child) => {
    const fixture = createFixture(child);
    fixture.evidence.archive.format = 'xcarchive';
    validationFailure(fixture);
  });
});

test('rejects adversarial ZIP, plist, layout, and provisioning-profile differentials', async (t) => {
  async function archiveCase(name, format, archiveBytes, expectedCode) {
    await t.test(name, (child) => {
      const fixture = createFixture(child, { format });
      rewriteReference(fixture.root, fixture.evidence.archive.file, archiveBytes);
      const error = validationFailure(fixture);
      assert.equal(error.code, expectedCode);
    });
  }

  function appInfoWithExtraValue(value) {
    return appInfoPlist().replace('</dict>', `<key>Extra</key>${value}</dict>`);
  }

  await archiveCase(
    'app Info.plist identity drift',
    'xcarchive_zip',
    archiveZipFixture('xcarchive_zip', {
      appInfo: appInfoPlist().replace(EXPECTED_BUILD.bundleIdentifier, 'com.attacker.app'),
    }),
    'ARCHIVE_BUILD_IDENTITY',
  );
  await archiveCase(
    'unsigned fake mobileprovision',
    'ipa',
    archiveZipFixture('ipa', { mobileProvision: '<plist><dict/></plist>' }),
    'ARCHIVE_PROFILE_CMS',
  );
  await archiveCase(
    'profile team drift',
    'ipa',
    archiveZipFixture('ipa', {
      mobileProvision: provisioningProfileCms({ teamIdentifier: 'ZZZZZ99999' }),
    }),
    'ARCHIVE_TEAM_IDENTITY',
  );
  await archiveCase(
    'profile expired after build but before validation',
    'ipa',
    archiveZipFixture('ipa', {
      mobileProvision: provisioningProfileCms({
        expirationDate: '2026-07-16T14:30:00Z',
      }),
    }),
    'ARCHIVE_PROFILE_VALIDITY',
  );
  await archiveCase(
    'reserved general-purpose flag',
    'ipa',
    archiveZipFixture('ipa', {
      codeResourcesOptions: { flags: 0x2800 },
    }),
    'ARCHIVE_ZIP_FLAGS',
  );
  await archiveCase(
    'DEFLATE trailing data',
    'ipa',
    archiveZipFixture('ipa', {
      codeResourcesOptions: { method: 8, trailingData: Buffer.from('trailer') },
    }),
    'ARCHIVE_ZIP_DEFLATE_TRAILING_DATA',
  );
  await archiveCase(
    'unreferenced gap between local records',
    'ipa',
    archiveZipFixture('ipa', {
      zipOptions: { gapAfterIndex: 0, gapBytes: Buffer.from('gap') },
    }),
    'ARCHIVE_ZIP_UNREFERENCED_BYTES',
  );
  await archiveCase(
    'second direct Payload app bundle',
    'ipa',
    archiveZipFixture('ipa', {
      extraEntries: [['Payload/Evil.app/Evil', 'evil executable']],
    }),
    'ARCHIVE_LAYOUT',
  );
  await archiveCase(
    'file-directory extraction collision',
    'ipa',
    archiveZipFixture('ipa', {
      extraEntries: [
        ['Payload/Layerwell.app/Collision', 'file'],
        ['Payload/Layerwell.app/Collision/', Buffer.alloc(0), { externalAttributes: 0x10 }],
      ],
    }),
    'ARCHIVE_ZIP_DUPLICATE',
  );
  const unicodePathExtra = Buffer.alloc(5);
  unicodePathExtra.writeUInt16LE(0x7075, 0);
  unicodePathExtra.writeUInt16LE(1, 2);
  await archiveCase(
    'Unicode-path extra-field alias',
    'ipa',
    archiveZipFixture('ipa', {
      codeResourcesOptions: { extra: unicodePathExtra },
    }),
    'ARCHIVE_ZIP_EXTRA_UNSUPPORTED',
  );
  await archiveCase(
    'unreviewed ZIP extraction version',
    'ipa',
    archiveZipFixture('ipa', {
      codeResourcesOptions: { versionNeeded: 63 },
    }),
    'ARCHIVE_ZIP_VERSION',
  );
  await archiveCase(
    'malformed app plist XML',
    'ipa',
    archiveZipFixture('ipa', {
      appInfo: '<plist><dict><key>CFBundleIdentifier</key><string>',
    }),
    'ARCHIVE_PLIST_PARSE',
  );
  await archiveCase(
    'duplicate app plist dictionary key',
    'ipa',
    archiveZipFixture('ipa', {
      appInfo: appInfoPlist().replace(
        '</dict>',
        `<key>CFBundleIdentifier</key><string>${EXPECTED_BUILD.bundleIdentifier}</string></dict>`,
      ),
    }),
    'ARCHIVE_PLIST_DUPLICATE_KEY',
  );
  await archiveCase(
    'DTD-invalid nested plist key element',
    'ipa',
    archiveZipFixture('ipa', {
      appInfo: appInfoPlist().replace(
        '</dict>',
        '<key><string>Malformed</string></key><string>x</string></dict>',
      ),
    }),
    'ARCHIVE_PLIST_GRAMMAR',
  );
  for (const [name, appInfo, expectedCode] of [
    [
      'UTF-16 declaration over UTF-8 plist bytes',
      appInfoPlist().replace('encoding="UTF-8"', 'encoding="UTF-16"'),
      'ARCHIVE_PLIST_XML',
    ],
    [
      'unsupported XML 1.1 declaration',
      appInfoPlist().replace('<?xml version="1.0"', '<?xml version="1.1"'),
      'ARCHIVE_PLIST_XML',
    ],
    [
      'whitespace content in EMPTY plist boolean',
      appInfoWithExtraValue('<true> </true>'),
      'ARCHIVE_PLIST_GRAMMAR',
    ],
    [
      'unsafe plist integer precision',
      appInfoWithExtraValue('<integer>9007199254740992</integer>'),
      'ARCHIVE_PLIST_GRAMMAR',
    ],
    [
      'non-finite plist real',
      appInfoWithExtraValue('<real>1e9999</real>'),
      'ARCHIVE_PLIST_GRAMMAR',
    ],
    [
      'impossible plist calendar date',
      appInfoWithExtraValue('<date>2026-02-31T00:00:00Z</date>'),
      'ARCHIVE_PLIST_GRAMMAR',
    ],
    [
      'non-canonical plist base64 data',
      appInfoWithExtraValue('<data>AB==</data>'),
      'ARCHIVE_PLIST_GRAMMAR',
    ],
    [
      'child element in scalar plist boolean',
      appInfoWithExtraValue('<false><string>x</string></false>'),
      'ARCHIVE_PLIST_GRAMMAR',
    ],
    [
      'XML 1.0 forbidden control character',
      appInfoWithExtraValue('<string>bad\u0001value</string>'),
      'ARCHIVE_PLIST_XML',
    ],
  ]) {
    await archiveCase(name, 'ipa', archiveZipFixture('ipa', { appInfo }), expectedCode);
  }
});

test('binds the evidence to the exact expected source SHA and canonical source-audit path', async (t) => {
  await t.test('expected source SHA mismatch', (child) => {
    const fixture = createFixture(child);
    validationFailure(fixture, { expectedSourceGitSha: 'f'.repeat(40) });
  });

  for (const [name, gitSha] of [
    ['malformed source SHA', 'abc'],
    ['uppercase source SHA', EXPECTED_SOURCE_GIT_SHA.toUpperCase()],
  ]) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      fixture.evidence.source.gitSha = gitSha;
      validationFailure(fixture);
    });
  }

  await t.test('source audit moved from canonical path', (child) => {
    const fixture = createFixture(child);
    const reference = fixture.evidence.source.iosPrivacySourceAudit;
    const previous = join(fixture.root, ...reference.path.split('/'));
    reference.path = 'evidence/ios/source-audit.json';
    const next = join(fixture.root, ...reference.path.split('/'));
    mkdirSync(dirname(next), { recursive: true });
    renameSync(previous, next);
    validationFailure(fixture);
  });
});

test('rejects source-audit semantic tampering even when its reference is rehashed', async (t) => {
  const cases = [
    ['source status', (audit) => (audit.status = 'source_valid')],
    ['release archive scope', (audit) => (audit.scope.releaseArchiveAudited = true)],
    ['non-empty source errors', (audit) => audit.errors.push({ code: 'DRIFT' })],
    ['nonzero source error count', (audit) => (audit.summary.errorCount = 1)],
    ['source ledger digest', (audit) => (audit.ledgerHashes.nativePackagesSha256 = 'f'.repeat(64))],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      const audit = structuredClone(fixture.sourceAudit);
      mutate(audit);
      rewriteSourceAudit(fixture, audit);
      validationFailure(fixture);
    });
  }

  for (const claim of FALSE_SOURCE_CLAIM_KEYS) {
    await t.test('false source claim ' + claim, (child) => {
      const fixture = createFixture(child);
      const audit = structuredClone(fixture.sourceAudit);
      audit.claims[claim] = true;
      rewriteSourceAudit(fixture, audit);
      validationFailure(fixture);
    });
  }

  await t.test('evidence ledger differs from source audit', (child) => {
    const fixture = createFixture(child);
    fixture.evidence.source.ledgerHashes.nativePackagesSha256 = 'f'.repeat(64);
    validationFailure(fixture);
  });

  await t.test('malformed source audit JSON', (child) => {
    const fixture = createFixture(child);
    rewriteReference(
      fixture.root,
      fixture.evidence.source.iosPrivacySourceAudit,
      '{"schemaVersion":',
    );
    validationFailure(fixture);
  });

  await t.test('BOM-prefixed source audit JSON', (child) => {
    const fixture = createFixture(child);
    rewriteReference(
      fixture.root,
      fixture.evidence.source.iosPrivacySourceAudit,
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), CURRENT_SOURCE_AUDIT_BYTES]),
    );
    validationFailure(fixture);
  });
});

test('requires exact true archive attestations and immutable archive evidence', async (t) => {
  await t.test('archive immutable false', (child) => {
    const fixture = createFixture(child);
    fixture.evidence.archive.immutable = false;
    validationFailure(fixture);
  });

  await t.test('archive immutable string', (child) => {
    const fixture = createFixture(child);
    fixture.evidence.archive.immutable = 'true';
    validationFailure(fixture);
  });

  for (const key of ATTESTATION_KEYS) {
    await t.test(key + ' false', (child) => {
      const fixture = createFixture(child);
      fixture.evidence.attestations[key] = false;
      validationFailure(fixture);
    });
    await t.test(key + ' string', (child) => {
      const fixture = createFixture(child);
      fixture.evidence.attestations[key] = 'true';
      validationFailure(fixture);
    });
  }
});

test('rejects malformed and chronologically impossible timestamps', async (t) => {
  const cases = [
    ['date-only capturedAt', (value) => (value.artifacts.nativeLock.capturedAt = '2026-07-16')],
    [
      'offset timestamp',
      (value) => (value.artifacts.nativeLock.capturedAt = '2026-07-16T09:15:00-04:00'),
    ],
    [
      'source captured after build',
      (value) => (value.source.iosPrivacySourceAudit.capturedAt = '2026-07-16T13:30:00.000Z'),
    ],
    [
      'archive captured before build',
      (value) => (value.archive.file.capturedAt = '2026-07-16T12:30:00.000Z'),
    ],
    [
      'EAS build log captured before build',
      (value) => (value.provenance.easBuildLog.capturedAt = '2026-07-16T12:30:00.000Z'),
    ],
    [
      'privacy review before artifact capture',
      (value) => (value.review.privacy.reviewedAt = '2026-07-16T13:01:00.000Z'),
    ],
    [
      'release review before build',
      (value) => (value.review.release.reviewedAt = '2026-07-16T12:00:00.000Z'),
    ],
    [
      'release approval before privacy approval',
      (value) => (value.review.privacy.reviewedAt = '2026-07-16T15:00:00.000Z'),
    ],
    ['malformed builtAt', (value) => (value.build.builtAt = 'today')],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture.evidence);
      validationFailure(fixture);
    });
  }
});

test('rejects otherwise ordered approvals dated beyond current clock skew', (t) => {
  const fixture = createFixture(t);
  fixture.evidence.review.privacy.reviewedAt = '9999-12-31T23:59:59.999Z';
  fixture.evidence.review.release.reviewedAt = '9999-12-31T23:59:59.999Z';
  const error = validationFailure(fixture);
  assert.equal(error.code, 'TIMESTAMP_FUTURE');
  assert.equal(error.path, 'review.privacy.reviewedAt');
});

test('rejects placeholder, malformed, or non-approving reviewers', async (t) => {
  const cases = [
    ['placeholder reviewer', (value) => (value.review.privacy.name = 'TBD')],
    ['empty reviewer', (value) => (value.review.release.name = ' ')],
    ['control character', (value) => (value.review.release.name = 'Release\nOwner')],
    ['unpaired high surrogate', (value) => (value.review.privacy.name = 'A\ud800 Privacy')],
    ['unpaired low surrogate', (value) => (value.review.privacy.name = 'A\udfff Privacy')],
    ['privacy rejection', (value) => (value.review.privacy.decision = 'reject')],
    ['release conditional decision', (value) => (value.review.release.decision = 'conditional')],
    ['reviewer timestamp type', (value) => (value.review.privacy.reviewedAt = 123)],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture.evidence);
      validationFailure(fixture);
    });
  }
});

test('accepts paired Unicode reviewer identities without returning their names', (t) => {
  const fixture = createFixture(t);
  fixture.evidence.review.privacy.name = 'Avery 🧴 Privacy';
  const validated = validateFixture(fixture);
  assert.equal(Object.hasOwn(validated.review.privacy, 'name'), false);
  assert.equal(
    validated.review.privacy.identitySha256,
    sha256(Buffer.from(fixture.evidence.review.privacy.name, 'utf8')),
  );
});

test('rejects mutable image aliases and unreviewed or malformed toolchains', async (t) => {
  const cases = [
    ['mutable SDK image alias', (value) => (value.toolchain.easBuildImage = 'sdk-56')],
    ['mutable latest image alias', (value) => (value.toolchain.easBuildImage = 'latest')],
    ['pre-Xcode-26 toolchain', (value) => (value.toolchain.xcodeVersion = '25.4')],
    ['pre-iOS-26 SDK', (value) => (value.toolchain.iosSdkVersion = '25.4')],
    ['malformed Node version', (value) => (value.toolchain.nodeVersion = 'latest')],
    ['malformed CocoaPods version', (value) => (value.toolchain.cocoaPodsVersion = 'stable')],
    ['placeholder EAS image', (value) => (value.toolchain.easBuildImage = 'TBD')],
    [
      'incomplete EAS image name',
      (value) => (value.toolchain.easBuildImage = 'macos-tahoe-xcode-26.4'),
    ],
    [
      'EAS image Xcode mismatch',
      (value) => (value.toolchain.easBuildImage = 'macos-tahoe-26.4-xcode-26.3'),
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture.evidence);
      validationFailure(fixture);
    });
  }
});

test('binds retained EAS build provenance and resolved environment details', async (t) => {
  const cases = [
    ['malformed EAS build ID', (value) => (value.provenance.easBuildId = 'build-123')],
    [
      'non-canonical EAS build ID',
      (value) => (value.provenance.easBuildId = EAS_BUILD_ID.toUpperCase()),
    ],
    ['malformed EAS Git SHA', (value) => (value.provenance.easGitCommitSha = 'main')],
    ['mismatched EAS Git SHA', (value) => (value.provenance.easGitCommitSha = 'f'.repeat(40))],
    ['malformed EAS CLI version', (value) => (value.provenance.easCliVersion = 'latest')],
    ['pre-EAS-CLI-21 version', (value) => (value.provenance.easCliVersion = '20.9.9')],
    ['macOS image mismatch', (value) => (value.provenance.macosVersion = '26.5.0')],
    ['pre-macOS-26 environment', (value) => (value.provenance.macosVersion = '25.4.1')],
    ['malformed Xcode build', (value) => (value.provenance.xcodeBuild = 'Xcode 17E202')],
    ['malformed Fastlane version', (value) => (value.provenance.fastlaneVersion = 'latest')],
    ['pre-Fastlane-2 environment', (value) => (value.provenance.fastlaneVersion = '1.99.0')],
    [
      'EAS build-log digest drift',
      (value) => (value.provenance.easBuildLog.sha256 = 'f'.repeat(64)),
    ],
    [
      'EAS build-log identity value removed',
      (value, fixture) =>
        rewriteReference(
          fixture.root,
          value.provenance.easBuildLog,
          'complete-looking log without the bound source or toolchain\n',
        ),
    ],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture.evidence, fixture);
      validationFailure(fixture);
    });
  }
});

test('binds exact build identity and rejects malformed build metadata', async (t) => {
  for (const key of Object.keys(EXPECTED_BUILD)) {
    await t.test('expected build mismatch for ' + key, (child) => {
      const fixture = createFixture(child);
      const expectedBuild = {
        ...fixture.expectedBuild,
        [key]: fixture.expectedBuild[key] + '-drift',
      };
      validationFailure(fixture, { expectedBuild });
    });
  }

  const cases = [
    ['malformed app version', (value) => (value.build.appVersion = 'version one')],
    ['malformed build number', (value) => (value.build.buildNumber = '42-beta')],
    ['malformed bundle identifier', (value) => (value.build.bundleIdentifier = 'not a bundle id')],
    ['malformed team identifier', (value) => (value.build.teamIdentifier = 'TEAM')],
    ['placeholder build number', (value) => (value.build.buildNumber = 'TBD')],
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      mutate(fixture.evidence);
      validationFailure(fixture);
    });
  }
});

test('requires the exact ten-artifact inventory', (t) => {
  const fixture = createFixture(t);
  assert.deepEqual(Object.keys(fixture.evidence.artifacts), ARTIFACT_KEYS);
  validateFixture(fixture);
});

test('safe loader returns a redacted deep-frozen file-validation wrapper', (t) => {
  const fixture = createFixture(t);
  const evidenceJsonBytes = readFileSync(
    join(fixture.root, ...fixture.evidenceJsonPath.split('/')),
  );
  const loaded = loadFixture(fixture);

  assert.equal(loaded.schemaVersion, IOS_ARCHIVE_PRIVACY_EVIDENCE_SCHEMA_VERSION);
  assert.equal(loaded.kind, 'ios_archive_privacy_evidence_index_file_validation');
  assert.equal(loaded.status, 'evidence_index_validated');
  assert.deepEqual(loaded.evidenceRecord, {
    path: fixture.evidenceJsonPath,
    sha256: sha256(evidenceJsonBytes),
    sizeBytes: evidenceJsonBytes.length,
  });
  assert.equal(loaded.validation.kind, 'ios_archive_privacy_evidence_index_validation');
  assert.equal(loaded.validation.status, 'evidence_index_validated');
  assert.equal(loaded.validation.source.gitSha, EXPECTED_SOURCE_GIT_SHA);
  assert.deepEqual(loaded.validation.build, fixture.evidence.build);
  assert.deepEqual(loaded.validation.toolchain, fixture.evidence.toolchain);
  assert.deepEqual(loaded.validation.provenance, fixture.evidence.provenance);
  assert.deepEqual(loaded.validation.archive.file, fixture.evidence.archive.file);
  assert.deepEqual(loaded.validation.artifacts, fixture.evidence.artifacts);
  assert.equal(Object.hasOwn(loaded.validation.review.privacy, 'name'), false);
  assert.equal(Object.hasOwn(loaded.validation.review.release, 'name'), false);
  assert.match(loaded.validation.review.privacy.identitySha256, SHA256);
  assert.match(loaded.validation.review.release.identitySha256, SHA256);
  assert.equal(
    Object.values(loaded.validation.claims).every((value) => value === false),
    true,
  );
  const serialized = JSON.stringify(loaded);
  assert.equal(serialized.includes(fixture.evidence.review.privacy.name), false);
  assert.equal(serialized.includes(fixture.evidence.review.release.name), false);
  assertDeepFrozen(loaded);

  writeEvidenceJson(fixture, '{"mutated":true}\n');
  fixture.evidence.build.buildNumber = '999';
  assert.equal(loaded.validation.build.buildNumber, '42');
  assert.equal(loaded.evidenceRecord.sha256, sha256(evidenceJsonBytes));
  assert.throws(() => {
    loaded.evidenceRecord.path = 'mutated.json';
  }, TypeError);
});

test('final referenced-file recheck rejects post-validation evidence drift', (t) => {
  const fixture = createFixture(t);
  const loaded = loadFixture(fixture);
  const nativeLockPath = join(
    fixture.root,
    ...loaded.validation.artifacts.nativeLock.path.split('/'),
  );
  writeFileSync(nativeLockPath, 'mutated after validation\n', 'utf8');
  assert.throws(
    () =>
      recheckIosArchivePrivacyEvidenceReferences(loaded.validation, {
        root: fixture.root,
      }),
    (error) =>
      error instanceof IosArchivePrivacyEvidenceError && error.code === 'EVIDENCE_SET_RACE',
  );
});

test('safe loader rejects unsafe JSON paths and non-regular evidence files', async (t) => {
  for (const [name, pathForFixture] of [
    ['absolute path', (fixture) => join(fixture.root, ...fixture.evidenceJsonPath.split('/'))],
    ['parent escape', () => '../archive-privacy-evidence.json'],
    ['backslash path', () => 'evidence\\ios\\archive-privacy-evidence.json'],
    ['dot segment', () => 'evidence/./ios/archive-privacy-evidence.json'],
    ['missing file', () => 'evidence/ios/missing-archive-privacy-evidence.json'],
  ]) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      loaderFailure(fixture, pathForFixture(fixture));
    });
  }

  await t.test('directory in place of JSON file', (child) => {
    const fixture = createFixture(child);
    const directoryPath = 'evidence/ios/evidence-json-directory';
    mkdirSync(join(fixture.root, ...directoryPath.split('/')));
    loaderFailure(fixture, directoryPath);
  });

  await t.test('symlinked JSON file', (child) => {
    const fixture = createFixture(child);
    const path = join(fixture.root, ...fixture.evidenceJsonPath.split('/'));
    const target = join(fixture.root, 'evidence/ios/unreferenced-evidence.json');
    writeFileSync(target, readFileSync(path));
    rmSync(path);
    try {
      symlinkSync(target, path, 'file');
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
        child.skip('File symlink creation is unavailable on this Windows host.');
        return;
      }
      throw error;
    }
    loaderFailure(fixture);
  });

  await t.test('hardlinked JSON file', (child) => {
    const fixture = createFixture(child);
    const path = join(fixture.root, ...fixture.evidenceJsonPath.split('/'));
    const target = join(fixture.root, 'evidence/ios/unreferenced-evidence.json');
    writeFileSync(target, readFileSync(path));
    rmSync(path);
    linkSync(target, path);
    loaderFailure(fixture);
  });
});

test('safe loader enforces its evidence-JSON byte bound', (t) => {
  const fixture = createFixture(t);
  assert.ok(Object.hasOwn(IOS_ARCHIVE_PRIVACY_EVIDENCE_DEFAULT_BOUNDS, 'maxEvidenceJsonBytes'));
  loaderFailure(fixture, fixture.evidenceJsonPath, {
    bounds: { maxEvidenceJsonBytes: 1 },
  });
});

test('safe loader enforces JSON depth and counts its record in the total bound', async (t) => {
  await t.test('JSON depth', (child) => {
    const fixture = createFixture(child);
    loaderFailure(fixture, fixture.evidenceJsonPath, {
      bounds: { maxEvidenceJsonDepth: 1 },
    });
  });

  await t.test('combined evidence bytes', (child) => {
    const fixture = createFixture(child);
    const references = [
      fixture.evidence.source.iosPrivacySourceAudit,
      fixture.evidence.archive.file,
      fixture.evidence.provenance.easBuildLog,
      ...Object.values(fixture.evidence.artifacts),
    ];
    const referencedBytes = references.reduce((total, reference) => total + reference.sizeBytes, 0);
    validateFixture(fixture, { bounds: { maxTotalEvidenceBytes: referencedBytes } });
    loaderFailure(fixture, fixture.evidenceJsonPath, {
      bounds: { maxTotalEvidenceBytes: referencedBytes },
    });
  });
});

test('safe loader rejects empty, invalidly encoded, and malformed JSON', async (t) => {
  const cases = [
    ['empty JSON', Buffer.alloc(0)],
    [
      'BOM-prefixed JSON',
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonicalJson({ ok: true })]),
    ],
    ['invalid UTF-8', Buffer.from([0xc3, 0x28])],
    ['malformed JSON', Buffer.from('{"schemaVersion":', 'utf8')],
    ['trailing comma', Buffer.from('{"schemaVersion":1,}\n', 'utf8')],
    ['trailing second JSON value', Buffer.from('{"schemaVersion":1}\n{"kind":"second"}\n', 'utf8')],
  ];
  for (const [name, bytes] of cases) {
    await t.test(name, (child) => {
      const fixture = createFixture(child);
      writeEvidenceJson(fixture, bytes);
      loaderFailure(fixture);
    });
  }
});

test('safe loader rejects literal and escaped-equivalent duplicate JSON keys', async (t) => {
  await t.test('duplicate literal key', (child) => {
    const fixture = createFixture(child);
    const original = canonicalJson(fixture.evidence).toString('utf8');
    const duplicate = original.replace(
      '  "kind": "ios_archive_privacy_evidence_index",',
      '  "schemaVersion": 1,\n  "kind": "ios_archive_privacy_evidence_index",',
    );
    assert.notEqual(duplicate, original);
    writeEvidenceJson(fixture, duplicate);
    loaderFailure(fixture);
  });

  await t.test('escaped-equivalent duplicate key', (child) => {
    const fixture = createFixture(child);
    const original = canonicalJson(fixture.evidence).toString('utf8');
    const duplicate = original.replace(
      '  "kind": "ios_archive_privacy_evidence_index",',
      '  "\\u006b\\u0069\\u006e\\u0064": "ios_archive_privacy_evidence_index",\n  "kind": "ios_archive_privacy_evidence_index",',
    );
    assert.notEqual(duplicate, original);
    writeEvidenceJson(fixture, duplicate);
    loaderFailure(fixture);
  });
});

test('safe loader rejects escaped unpaired-surrogate reviewer identities', (t) => {
  const fixture = createFixture(t);
  fixture.evidence.review.privacy.name = 'A\ud800 Privacy';
  const bytes = writeEvidenceJson(fixture);
  assert.equal(bytes.toString('utf8').includes('\\ud800'), true);
  loaderFailure(fixture);
});

test('safe loader redacts malformed JSON contents from typed failures', (t) => {
  const fixture = createFixture(t);
  const secret = 'DO_NOT_LEAK_EVIDENCE_JSON_SECRET_57a6c9';
  writeEvidenceJson(fixture, '{"private":"' + secret + '"');
  const error = loaderFailure(fixture);
  const rendered = [
    error.message,
    error.stack,
    error.cause instanceof Error ? error.cause.message : String(error.cause ?? ''),
  ].join('\n');
  assert.equal(rendered.includes(secret), false);
});

const RC_BINDING_DIRECTORY = 'docs/phase-9/release-candidates/rc-2026-07-16-b001';
const RC_BINDING_ARCHIVE_SHA = 'a'.repeat(64);
const RC_BINDING_SYMBOLS_SHA = 'b'.repeat(64);
const RC_BINDING_APP_PRIVACY_SHA = 'c'.repeat(64);
const RC_BINDING_PRIVACY_REVIEWER = 'Avery Privacy Reviewer';
const RC_BINDING_RELEASE_REVIEWER = 'Riley Release Owner';

function rcBindingIdentitySha256(value) {
  return createHash('sha256').update(Buffer.from(value, 'utf8')).digest('hex');
}

function rcBindingFixture() {
  const rc = RC_BINDING_DIRECTORY;
  return {
    releaseCandidateDirectory: rc,
    references: [
      { path: `${rc}/evidence/ios/candidate.ipa` },
      { path: `${rc}/evidence/ios/eas-build.log` },
      { path: `${rc}/evidence/ios/privacy-report.pdf` },
    ],
    manifestSource: [
      '| Field | Value |',
      '| --- | --- |',
      `| Build-source Git SHA | ${EXPECTED_SOURCE_GIT_SHA} |`,
      `| iOS EAS build ID | ${EAS_BUILD_ID} |`,
      '| iOS app version | 1.0.0 |',
      '| iOS build number | 42 |',
      '| iOS bundle identifier | com.layerwell.app |',
      '| EAS channel | production |',
      '',
    ].join('\n'),
    storePacketSource: [
      '# Store Review Packet',
      '',
      `- EAS build ID: ${EAS_BUILD_ID}`,
      '- iOS app version: 1.0.0',
      '- iOS build number: 42',
      '- iOS bundle identifier: com.layerwell.app',
      `- Archive SHA-256: ${RC_BINDING_ARCHIVE_SHA}`,
      `- Processing/symbols report SHA-256: ${RC_BINDING_SYMBOLS_SHA}`,
      `- App Privacy answers SHA-256: ${RC_BINDING_APP_PRIVACY_SHA}`,
      '',
    ].join('\n'),
    signoffSource: [
      '| Area | Owner | Decision | Date | Residual risk |',
      '| --- | --- | --- | --- | --- |',
      `| Security/privacy | ${RC_BINDING_PRIVACY_REVIEWER} | APPROVE | 2026-07-16 | Reviewed |`,
      `| Release manager | ${RC_BINDING_RELEASE_REVIEWER} | APPROVE | 2026-07-16 | Reviewed |`,
      '',
    ].join('\n'),
    sourceGitSha: EXPECTED_SOURCE_GIT_SHA,
    expectedEasBuildId: EAS_BUILD_ID,
    reviewedBuildEnvironment: {
      easCliVersion: '21.0.1',
      image: 'macos-tahoe-26.4-xcode-26.4',
      macosVersion: '26.4.1',
      xcodeVersion: '26.4',
      xcodeBuild: '17E202',
      iosSdkVersion: '26.4',
      nodeVersion: '22.22.2',
      cocoapodsVersion: '1.16.2',
      fastlaneVersion: '2.233.1',
    },
    signedOffBy: RC_BINDING_RELEASE_REVIEWER,
    validation: {
      source: { gitSha: EXPECTED_SOURCE_GIT_SHA },
      archive: { file: { sha256: RC_BINDING_ARCHIVE_SHA } },
      build: {
        appVersion: '1.0.0',
        buildNumber: '42',
        bundleIdentifier: 'com.layerwell.app',
      },
      toolchain: {
        easBuildImage: 'macos-tahoe-26.4-xcode-26.4',
        xcodeVersion: '26.4',
        iosSdkVersion: '26.4',
        nodeVersion: '22.22.2',
        cocoaPodsVersion: '1.16.2',
      },
      provenance: {
        easBuildId: EAS_BUILD_ID,
        easGitCommitSha: EXPECTED_SOURCE_GIT_SHA,
        easCliVersion: '21.0.1',
        macosVersion: '26.4.1',
        xcodeBuild: '17E202',
        fastlaneVersion: '2.233.1',
      },
      artifacts: {
        symbolsProcessingReport: { sha256: RC_BINDING_SYMBOLS_SHA },
        appPrivacyAnswers: { sha256: RC_BINDING_APP_PRIVACY_SHA },
      },
      review: {
        privacy: {
          identitySha256: rcBindingIdentitySha256(RC_BINDING_PRIVACY_REVIEWER),
          reviewedAt: REVIEWED_AT,
        },
        release: {
          identitySha256: rcBindingIdentitySha256(RC_BINDING_RELEASE_REVIEWER),
          reviewedAt: REVIEWED_AT,
        },
      },
    },
  };
}

function invalidRcBinding(value) {
  const result = auditIosReleaseCandidateCrossBinding(value);
  assert.equal(result.status, 'invalid');
  assert.equal(result.validated, false);
  return result;
}

test('accepts one exact evidence-present RC cross-binding and returns a frozen pass', () => {
  const result = auditIosReleaseCandidateCrossBinding(rcBindingFixture());
  assert.equal(result.status, 'pass');
  assert.equal(result.validated, true);
  assert.equal(result.reviewedEnvironmentMatched, true);
  assert.equal(result.referencePathsConfined, true);
  assert.equal(result.manifestMatched, true);
  assert.equal(result.storePacketMatched, true);
  assert.equal(result.reviewersMatched, true);
  assert.deepEqual(result.errors, []);
  assert.throws(() => result.errors.push('mutate'), TypeError);
});

test('store inspector delegates its evidence-present decision to the tested RC contract', () => {
  const inspector = readFileSync(
    join(REPOSITORY_ROOT, 'scripts/phase9/store-build-inspect.mjs'),
    'utf8',
  );
  assert.match(
    inspector,
    /import \{ auditIosReleaseCandidateCrossBinding \} from '\.\/ios-release-candidate-cross-binding\.mjs';/u,
  );
  assert.match(inspector, /const crossBinding = auditIosReleaseCandidateCrossBinding\(\{/u);
  assert.match(inspector, /expectedEasBuildId,/u);
  assert.match(inspector, /reviewedBuildEnvironment: reviewedIosBuildEnvironment,/u);
  assert.match(
    inspector,
    /iosArchivePrivacyEvidenceIndexValidated\s*=\s*releaseCandidateGitValid && crossBinding\.validated;/u,
  );
  assert.match(
    inspector,
    /archiveEvidenceIndexValidated: iosArchivePrivacyEvidenceIndexValidated,/u,
  );
  assert.doesNotMatch(inspector, /function markdownTableValue|reviewedEnvironmentMatched/u);
});

test('rejects duplicate or ambiguous RC manifest and store-packet values', async (t) => {
  await t.test('duplicate manifest row', () => {
    const value = rcBindingFixture();
    value.manifestSource += `| Build-source Git SHA | ${'f'.repeat(40)} |\n`;
    const result = invalidRcBinding(value);
    assert.equal(result.manifestMatched, false);
    assert.match(result.errors.join('\n'), /Build-source Git SHA must appear exactly once/u);
  });

  await t.test('ambiguous three-cell manifest row', () => {
    const value = rcBindingFixture();
    value.manifestSource = value.manifestSource.replace(
      '| iOS build number | 42 |',
      '| iOS build number | 42 | contradictory |',
    );
    const result = invalidRcBinding(value);
    assert.equal(result.manifestMatched, false);
  });

  await t.test('duplicate store packet bullet', () => {
    const value = rcBindingFixture();
    value.storePacketSource += `- Archive SHA-256: ${'d'.repeat(64)}\n`;
    const result = invalidRcBinding(value);
    assert.equal(result.storePacketMatched, false);
    assert.match(result.errors.join('\n'), /Archive SHA-256 must appear exactly once/u);
  });
});

test('rejects drift in every reviewed toolchain and provenance equality', async (t) => {
  const cases = [
    ['toolchain', 'easBuildImage', 'macos-tahoe-26.4-xcode-26.3'],
    ['toolchain', 'xcodeVersion', '26.3'],
    ['toolchain', 'iosSdkVersion', '26.3'],
    ['toolchain', 'nodeVersion', '22.22.1'],
    ['toolchain', 'cocoaPodsVersion', '1.16.1'],
    ['provenance', 'easBuildId', '223e4567-e89b-42d3-a456-426614174000'],
    ['provenance', 'easGitCommitSha', 'f'.repeat(40)],
    ['provenance', 'easCliVersion', '21.0.0'],
    ['provenance', 'macosVersion', '26.4.0'],
    ['provenance', 'xcodeBuild', '17E999'],
    ['provenance', 'fastlaneVersion', '2.233.0'],
  ];
  for (const [recordName, key, alternate] of cases) {
    await t.test(`${recordName}.${key}`, () => {
      const value = rcBindingFixture();
      value.validation[recordName][key] = alternate;
      const result = invalidRcBinding(value);
      assert.equal(result.reviewedEnvironmentMatched, false);
      assert.match(result.errors.join('\n'), new RegExp(`${recordName} ${key}`, 'u'));
    });
  }
  await t.test('aggregates multiple reviewed-environment drifts', () => {
    const value = rcBindingFixture();
    value.validation.toolchain.nodeVersion = '22.22.1';
    value.validation.provenance.fastlaneVersion = '2.233.0';
    const result = invalidRcBinding(value);
    assert.equal(result.errors.filter((error) => /reviewed build context/u.test(error)).length, 2);
  });
});

test('rejects RC identity, hash, and evidence-path drift', async (t) => {
  await t.test('manifest bundle identity', () => {
    const value = rcBindingFixture();
    value.manifestSource = value.manifestSource.replace('com.layerwell.app', 'com.attacker.app');
    const result = invalidRcBinding(value);
    assert.equal(result.manifestMatched, false);
    assert.match(result.errors.join('\n'), /iOS bundle identifier does not match/u);
  });

  await t.test('store packet identity', () => {
    const value = rcBindingFixture();
    value.storePacketSource = value.storePacketSource.replace(
      '- iOS build number: 42',
      '- iOS build number: 43',
    );
    const result = invalidRcBinding(value);
    assert.equal(result.storePacketMatched, false);
  });

  await t.test('store packet archive hash', () => {
    const value = rcBindingFixture();
    value.storePacketSource = value.storePacketSource.replace(
      RC_BINDING_ARCHIVE_SHA,
      'd'.repeat(64),
    );
    const result = invalidRcBinding(value);
    assert.equal(result.storePacketMatched, false);
    assert.match(result.errors.join('\n'), /Archive SHA-256 does not match/u);
  });

  await t.test('archive source SHA', () => {
    const value = rcBindingFixture();
    value.validation.source.gitSha = 'e'.repeat(40);
    const result = invalidRcBinding(value);
    assert.match(result.errors.join('\n'), /source SHA does not match/u);
  });

  await t.test('reference outside selected RC evidence subtree', () => {
    const value = rcBindingFixture();
    value.references[1].path = 'docs/phase-9/release-candidates/rc-other/evidence/ios/eas.log';
    const result = invalidRcBinding(value);
    assert.equal(result.referencePathsConfined, false);
  });
});

test('rejects RC reviewer name, date, duplicate row, and signed-owner drift', async (t) => {
  await t.test('privacy reviewer name', () => {
    const value = rcBindingFixture();
    value.signoffSource = value.signoffSource.replace(
      RC_BINDING_PRIVACY_REVIEWER,
      'Different Reviewer',
    );
    const result = invalidRcBinding(value);
    assert.equal(result.reviewersMatched, false);
  });

  await t.test('release review date', () => {
    const value = rcBindingFixture();
    value.signoffSource = value.signoffSource.replace(
      `| Release manager | ${RC_BINDING_RELEASE_REVIEWER} | APPROVE | 2026-07-16 |`,
      `| Release manager | ${RC_BINDING_RELEASE_REVIEWER} | APPROVE | 2026-07-15 |`,
    );
    const result = invalidRcBinding(value);
    assert.equal(result.reviewersMatched, false);
  });

  await t.test('duplicate release-manager row', () => {
    const value = rcBindingFixture();
    value.signoffSource += `| Release manager | ${RC_BINDING_RELEASE_REVIEWER} | APPROVE | 2026-07-16 | Duplicate |\n`;
    const result = invalidRcBinding(value);
    assert.equal(result.reviewersMatched, false);
  });

  await t.test('PHASE9_SIGNED_OFF_BY identity', () => {
    const value = rcBindingFixture();
    value.signedOffBy = 'Different Release Owner';
    const result = invalidRcBinding(value);
    assert.equal(result.reviewersMatched, false);
  });
});

test('rejects malformed RC cross-binding inputs without manufacturing validation', () => {
  assert.throws(
    () => auditIosReleaseCandidateCrossBinding({ ...rcBindingFixture(), references: [] }),
    /references must be a non-empty list/u,
  );
  assert.throws(
    () => auditIosReleaseCandidateCrossBinding({ ...rcBindingFixture(), manifestSource: '' }),
    /manifestSource must be a non-empty UTF-8 packet/u,
  );
  assert.throws(
    () => auditIosReleaseCandidateCrossBinding({ ...rcBindingFixture(), sourceGitSha: 'main' }),
    /sourceGitSha must be a lowercase 40-character Git SHA/u,
  );
  assert.throws(
    () =>
      auditIosReleaseCandidateCrossBinding({
        ...rcBindingFixture(),
        expectedEasBuildId: 'not-a-build-id',
      }),
    /expectedEasBuildId must be one canonical lowercase EAS build UUID/u,
  );
  assert.throws(
    () =>
      auditIosReleaseCandidateCrossBinding({
        ...rcBindingFixture(),
        reviewedBuildEnvironment: null,
      }),
    /reviewedBuildEnvironment must be the reviewed EAS environment record/u,
  );
});
