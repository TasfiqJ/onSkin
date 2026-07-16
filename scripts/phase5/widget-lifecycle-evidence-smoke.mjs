#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  createWidgetLifecycleEvidenceTemplate,
  validateWidgetLifecycleEvidence,
  WIDGET_LIFECYCLE_EVIDENCE_ROOT,
  WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
  WIDGET_LIFECYCLE_SUPPORTED_FAMILIES,
} from './widget-lifecycle-evidence-contract.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const checker = resolve(import.meta.dirname, 'check-widget-lifecycle-evidence.mjs');
const BUILD_ID = '123e4567-e89b-42d3-a456-426614174000';
const APP_ID = 'com.acme.glow';
const EXTENSION_ID = `${APP_ID}.ExpoWidgetsTarget`;
const APP_GROUP_ID = `group.${APP_ID}`;
const SIGNOFF = 'Alex Reviewer';
const SOURCE_SHA = 'a'.repeat(40);
const CLOCK_NOW = Date.now();
const CAPTURED_AT = new Date(CLOCK_NOW - 2 * 60 * 60 * 1000).toISOString();
const SIGNED_AT = new Date(CLOCK_NOW - 60 * 60 * 1000).toISOString();
const NOW_MS = CLOCK_NOW;
const TEAM_ID = 'ABCDE12345';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeBytes(root, path, bytes, mediaType) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return { path, sha256: sha256(bytes), mediaType };
}

function writeZip(root, path, label) {
  const bytes = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from(`${label}\n`.padEnd(64, '.')),
  ]);
  return writeBytes(root, path, bytes, 'application/zip');
}

function writeJson(root, path, value) {
  return writeBytes(
    root,
    path,
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'),
    'application/json',
  );
}

function writeText(root, path, content) {
  return writeBytes(root, path, Buffer.from(`${content}\n`, 'utf8'), 'text/plain');
}

function binding(evidence, device) {
  return {
    sourceGitSha: evidence.sourceGitSha,
    easIosBuildId: evidence.build.easIosBuildId,
    identifiers: {
      appBundleIdentifier: evidence.identifiers.appBundleIdentifier,
      extensionBundleIdentifier: evidence.identifiers.extensionBundleIdentifier,
      appGroupIdentifier: evidence.identifiers.appGroupIdentifier,
      teamIdentifier: evidence.identifiers.teamIdentifier,
    },
    rawArtifactSha256: {
      appBundle: evidence.signedArtifacts.appBundle.sha256,
      archive: evidence.signedArtifacts.archive.sha256,
      extensionBundle: evidence.signedArtifacts.extensionBundle.sha256,
    },
    device,
  };
}

function entitlementClaims(bundleIdentifier, target) {
  return {
    appGroups: [APP_GROUP_ID],
    applicationIdentifier: `${TEAM_ID}.${bundleIdentifier}`,
    apsEnvironment: target === 'extension' ? null : 'development',
    bundleIdentifier,
    codeSignatureValid: true,
    serviceCapabilityKeys: ['com.apple.security.application-groups'],
    teamIdentifier: TEAM_ID,
  };
}

function privacyClaims() {
  return {
    accessedApiTypes: [
      {
        apiType: 'NSPrivacyAccessedAPICategoryUserDefaults',
        reasons: ['1C8F.1'],
      },
    ],
    collectedDataTypes: [],
    tracking: false,
    trackingDomains: [],
  };
}

function scenarioClaims(id) {
  if (id === 'archiveInspection') {
    return {
      appCodeSignatureValid: true,
      appPrivacyManifestEmbedded: true,
      extensionCodeSignatureValid: true,
      extensionEmbedded: true,
      extensionPrivacyManifestEmbedded: true,
      frequentUpdatesEnabled: false,
      identitiesMatch: true,
      unapprovedExtensionCapabilitiesAbsent: true,
    };
  }
  if (id === 'interactionPrivacy') {
    return {
      accountDeletionCleanup: true,
      accountSwitchCleanup: true,
      atomicConcurrentCheckOff: true,
      corruptBytesCleanup: true,
      expiredTokenNoWrite: true,
      expiryCleanup: true,
      healthConsentWithdrawalCleanup: true,
      killedAppReconciliation: true,
      lockedStateRedaction: true,
      nativeActionImplementation: 'append_only_app_group_outbox',
      repeatedTapIdempotent: true,
      signOutCleanup: true,
      staleTokenNoWrite: true,
      unknownTokenNoWrite: true,
    };
  }
  if (id === 'liveActivity') {
    return {
      consentWithdrawalCleanup: true,
      deviceRestartRecovery: true,
      disablementCleanup: true,
      explicitEnd: true,
      lockedStateRedaction: true,
      processDeathRecovery: true,
      staleDateNonNull: true,
    };
  }
  return {
    accessibilityPass: true,
    coldStartDeepLinkPass: true,
    killedAppDeepLinkPass: true,
    lockedStateRedaction: true,
    supportedFamilies: [...WIDGET_LIFECYCLE_SUPPORTED_FAMILIES],
    warmDeepLinkPass: true,
  };
}

function createFixture(root, sourceGitSha = SOURCE_SHA) {
  const evidence = createWidgetLifecycleEvidenceTemplate();
  evidence.capturedAt = CAPTURED_AT;
  evidence.sourceGitSha = sourceGitSha;
  evidence.build.easIosBuildId = BUILD_ID;
  evidence.device.model = 'iPhone 15 Pro';
  evidence.device.osVersion = 'iOS 18.5';
  evidence.identifiers.appBundleIdentifier = APP_ID;
  evidence.identifiers.extensionBundleIdentifier = EXTENSION_ID;
  evidence.identifiers.appGroupIdentifier = APP_GROUP_ID;
  evidence.identifiers.teamIdentifier = TEAM_ID;
  evidence.signoff.decision = 'pass';
  evidence.signoff.signedOffBy = SIGNOFF;
  evidence.signoff.signedAt = SIGNED_AT;

  evidence.signedArtifacts.archive = writeZip(
    root,
    `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}candidate.xcarchive.zip`,
    `archive ${BUILD_ID}`,
  );
  evidence.signedArtifacts.appBundle = writeZip(
    root,
    `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}candidate.app.zip`,
    `app ${BUILD_ID}`,
  );
  evidence.signedArtifacts.extensionBundle = writeZip(
    root,
    `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}candidate.appex.zip`,
    `extension ${BUILD_ID}`,
  );

  for (const [key, reportType, claims] of [
    ['appEntitlements', 'app-entitlements', entitlementClaims(APP_ID, 'app')],
    ['appPrivacyManifest', 'app-privacy-manifest', privacyClaims()],
    [
      'extensionEntitlements',
      'extension-entitlements',
      entitlementClaims(EXTENSION_ID, 'extension'),
    ],
    ['extensionPrivacyManifest', 'extension-privacy-manifest', privacyClaims()],
  ]) {
    evidence.signedArtifacts[key] = writeJson(
      root,
      `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}${reportType}.json`,
      {
        schemaVersion: WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
        capturedAt: CAPTURED_AT,
        reportType,
        binding: binding(evidence, null),
        claims,
      },
    );
  }

  for (const id of ['archiveInspection', 'interactionPrivacy', 'liveActivity', 'widgetDevice']) {
    const proof = writeText(
      root,
      `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}${id}-proof.txt`,
      `Physical evidence transcript for ${id} and build ${BUILD_ID}`,
    );
    evidence.scenarioArtifacts[id] = writeJson(
      root,
      `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}${id}.json`,
      {
        schemaVersion: WIDGET_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
        capturedAt: CAPTURED_AT,
        reportType: id,
        binding: binding(evidence, id === 'archiveInspection' ? null : clone(evidence.device)),
        claims: scenarioClaims(id),
        proofAttachments: [proof],
      },
    );
  }
  return evidence;
}

function options(root, sourceGitSha = SOURCE_SHA) {
  return {
    root,
    expectedGitSha: sourceGitSha,
    expectedBuildId: BUILD_ID,
    expectedSignedOffBy: SIGNOFF,
    expectedAppBundleIdentifier: APP_ID,
    expectedTeamIdentifier: TEAM_ID,
    nowMs: NOW_MS,
  };
}

function validate(root, evidence, overrides = {}) {
  return validateWidgetLifecycleEvidence(evidence, { ...options(root), ...overrides });
}

function expectFailure(root, evidence, pattern, overrides = {}) {
  const result = validate(root, evidence, overrides);
  assert.ok(result.errors.length > 0, 'fixture unexpectedly passed');
  assert.match(result.errors.join('\n'), pattern);
}

function readReport(root, reference) {
  return JSON.parse(readFileSync(resolve(root, reference.path), 'utf8'));
}

function replaceReport(root, reference, report) {
  const updated = writeJson(root, reference.path, report);
  Object.assign(reference, updated);
}

function command(cwd, name, args) {
  return execFileSync(name, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runChecker(cwd, evidencePath, extraEnv = {}) {
  return spawnSync(process.execPath, [checker, '--strict'], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH: evidencePath,
      PHASE5_IOS_BUILD_ID: BUILD_ID,
      PHASE5_SIGNED_OFF_BY: SIGNOFF,
      APP_IOS_BUNDLE_IDENTIFIER: APP_ID,
      APPLE_TEAM_ID: TEAM_ID,
      ...extraEnv,
    },
  });
}

const temporaryRoots = [];
function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'routinekind-widget-lifecycle-'));
  temporaryRoots.push(root);
  return root;
}

const cases = [];
function test(name, run) {
  cases.push({ name, run });
}

test('accepts exact cross-bound machine-readable reports plus typed proof attachments', () => {
  const root = temporaryRoot();
  const result = validate(root, createFixture(root));
  assert.deepEqual(result.errors, []);
  assert.equal(result.summary.baseArtifactCount, 11);
  assert.equal(result.summary.proofAttachmentCount, 4);
  assert.equal(result.summary.artifactCount, 15);
  assert.equal(result.summary.scenarioCount, 4);
});

test('rejects arbitrary blobs masquerading as signed ZIPs or JSON reports', () => {
  const root = temporaryRoot();
  const raw = createFixture(root);
  const rawBytes = Buffer.from('not a signed archive\n', 'utf8');
  writeFileSync(resolve(root, raw.signedArtifacts.archive.path), rawBytes);
  raw.signedArtifacts.archive.sha256 = sha256(rawBytes);
  expectFailure(root, raw, /content does not match declared application\/zip/);

  const report = createFixture(root);
  const reportBytes = Buffer.from('{"pass":true}\n', 'utf8');
  writeFileSync(resolve(root, report.signedArtifacts.appEntitlements.path), reportBytes);
  report.signedArtifacts.appEntitlements.sha256 = sha256(reportBytes);
  expectFailure(root, report, /canonical two-space JSON|keys must be exactly/);
});

test('rejects report binding drift across source, build, identities, device, and raw hashes', () => {
  const root = temporaryRoot();
  const fields = [
    ['sourceGitSha', 'b'.repeat(40), /sourceGitSha must match/],
    ['easIosBuildId', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', /easIosBuildId must match/],
  ];
  for (const [key, value, pattern] of fields) {
    const evidence = createFixture(root);
    const report = readReport(root, evidence.scenarioArtifacts.widgetDevice);
    report.binding[key] = value;
    replaceReport(root, evidence.scenarioArtifacts.widgetDevice, report);
    expectFailure(root, evidence, pattern);
  }

  const identity = createFixture(root);
  const identityReport = readReport(root, identity.signedArtifacts.appEntitlements);
  identityReport.binding.identifiers.appBundleIdentifier = 'com.acme.other';
  replaceReport(root, identity.signedArtifacts.appEntitlements, identityReport);
  expectFailure(root, identity, /identifiers\.appBundleIdentifier must match/);

  const device = createFixture(root);
  const deviceReport = readReport(root, device.scenarioArtifacts.liveActivity);
  deviceReport.binding.device.model = 'iPhone 14 Pro';
  replaceReport(root, device.scenarioArtifacts.liveActivity, deviceReport);
  expectFailure(root, device, /device\.model must match/);

  const rawHash = createFixture(root);
  const hashReport = readReport(root, rawHash.signedArtifacts.extensionPrivacyManifest);
  hashReport.binding.rawArtifactSha256.archive = '0'.repeat(64);
  replaceReport(root, rawHash.signedArtifacts.extensionPrivacyManifest, hashReport);
  expectFailure(root, rawHash, /rawArtifactSha256\.archive must match/);
});

test('parses and rejects false entitlement, privacy, lifecycle, and family claims', () => {
  const root = temporaryRoot();
  const entitlement = createFixture(root);
  const entitlementReport = readReport(root, entitlement.signedArtifacts.extensionEntitlements);
  entitlementReport.claims.apsEnvironment = 'production';
  replaceReport(root, entitlement.signedArtifacts.extensionEntitlements, entitlementReport);
  expectFailure(root, entitlement, /apsEnvironment must be null for the extension/);

  const privacy = createFixture(root);
  const privacyReport = readReport(root, privacy.signedArtifacts.extensionPrivacyManifest);
  privacyReport.claims.accessedApiTypes[0].reasons = ['CA92.1'];
  replaceReport(root, privacy.signedArtifacts.extensionPrivacyManifest, privacyReport);
  expectFailure(root, privacy, /must be exactly: 1C8F\.1/);

  const lifecycle = createFixture(root);
  const lifecycleReport = readReport(root, lifecycle.scenarioArtifacts.liveActivity);
  lifecycleReport.claims.processDeathRecovery = false;
  replaceReport(root, lifecycle.scenarioArtifacts.liveActivity, lifecycleReport);
  expectFailure(root, lifecycle, /processDeathRecovery must be true/);

  const family = createFixture(root);
  const familyReport = readReport(root, family.scenarioArtifacts.widgetDevice);
  familyReport.claims.supportedFamilies.push('systemExtraLarge');
  replaceReport(root, family.scenarioArtifacts.widgetDevice, familyReport);
  expectFailure(root, family, /supportedFamilies must be exactly/);
});

test('requires supported proof suffixes and matching PNG JPEG MP4 or text magic', () => {
  const root = temporaryRoot();
  const evidence = createFixture(root);
  const report = readReport(root, evidence.scenarioArtifacts.widgetDevice);
  report.proofAttachments[0].mediaType = 'image/png';
  replaceReport(root, evidence.scenarioArtifacts.widgetDevice, report);
  expectFailure(root, evidence, /extension does not match image\/png|content does not match/);
});

test('rejects duplicate artifact paths and duplicate bytes under different paths', () => {
  const root = temporaryRoot();
  const duplicatePath = createFixture(root);
  duplicatePath.scenarioArtifacts.widgetDevice = clone(
    duplicatePath.scenarioArtifacts.archiveInspection,
  );
  expectFailure(root, duplicatePath, /distinct file path/);

  const duplicateHash = createFixture(root);
  const interaction = readReport(root, duplicateHash.scenarioArtifacts.interactionPrivacy);
  const live = readReport(root, duplicateHash.scenarioArtifacts.liveActivity);
  const interactionProof = interaction.proofAttachments[0];
  const duplicatedBytes = readFileSync(resolve(root, interactionProof.path));
  const liveProof = live.proofAttachments[0];
  writeFileSync(resolve(root, liveProof.path), duplicatedBytes);
  liveProof.sha256 = sha256(duplicatedBytes);
  replaceReport(root, duplicateHash.scenarioArtifacts.liveActivity, live);
  expectFailure(root, duplicateHash, /distinct bytes and SHA-256/);
});

test('rejects unsafe paths, hashes, future timestamps, and pre-capture signoff', () => {
  const root = temporaryRoot();
  const unsafe = createFixture(root);
  unsafe.scenarioArtifacts.archiveInspection.path = '../outside.json';
  expectFailure(root, unsafe, /normalized whitespace-free repo-relative file/);

  const mismatch = createFixture(root);
  mismatch.signedArtifacts.archive.sha256 = '0'.repeat(64);
  expectFailure(root, mismatch, /sha256 does not match/);

  const future = createFixture(root);
  future.capturedAt = '2999-01-01T00:00:00.000Z';
  expectFailure(root, future, /must not be in the future/);

  const timestamp = createFixture(root);
  timestamp.signoff.signedAt = new Date(Date.parse(CAPTURED_AT) - 1000).toISOString();
  expectFailure(root, timestamp, /at or after capturedAt/);
});

test('rejects source SHA, build ID, final identity, and signoff mismatches', () => {
  const root = temporaryRoot();
  const source = createFixture(root);
  source.sourceGitSha = 'b'.repeat(40);
  expectFailure(root, source, /must equal the current source HEAD/);

  const build = createFixture(root);
  build.build.easIosBuildId = 'your-build-id';
  expectFailure(root, build, /exact EAS build UUID/);

  const identity = createFixture(root);
  identity.identifiers.appGroupIdentifier = 'group.com.acme.other';
  expectFailure(root, identity, /appGroupIdentifier must equal/);

  const signoff = createFixture(root);
  signoff.signoff.signedOffBy = 'Jane Doe';
  expectFailure(root, signoff, /real reviewer|does not match/);
});

test('normalizes the existing expo.dev Phase 5 build URL contract to its exact UUID', () => {
  const root = temporaryRoot();
  const result = validate(root, createFixture(root), {
    expectedBuildId: `https://expo.dev/accounts/acme/projects/glow/builds/${BUILD_ID}`,
  });
  assert.deepEqual(result.errors, []);
});

test('strict CLI binds evidence to current HEAD and rejects unrelated dirty source', () => {
  const root = temporaryRoot();
  command(root, 'git', ['init']);
  command(root, 'git', ['config', 'user.email', 'widget-smoke@example.invalid']);
  command(root, 'git', ['config', 'user.name', 'Widget Smoke']);
  writeFileSync(join(root, 'source.txt'), 'source\n');
  command(root, 'git', ['add', 'source.txt']);
  command(root, 'git', ['commit', '-m', 'source']);
  const head = command(root, 'git', ['rev-parse', 'HEAD']).toLowerCase();
  const evidence = createFixture(root, head);
  const evidencePath = `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}evidence.json`;
  writeFileSync(resolve(root, evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);

  const valid = runChecker(root, evidencePath);
  assert.equal(valid.status, 0, `${valid.stdout}\n${valid.stderr}`);
  assert.match(valid.stdout, /Base reports\/artifacts: 11\/11; proof attachments: 4/);

  writeFileSync(join(root, 'dirty-source.txt'), 'not represented by sourceGitSha\n');
  const dirty = runChecker(root, evidencePath);
  assert.equal(dirty.status, 1);
  assert.match(`${dirty.stdout}\n${dirty.stderr}`, /Source worktree differs from sourceGitSha/);
});

test('strict CLI rejects missing evidence and source/build/signoff environment mismatches', () => {
  const root = temporaryRoot();
  command(root, 'git', ['init']);
  command(root, 'git', ['config', 'user.email', 'widget-smoke@example.invalid']);
  command(root, 'git', ['config', 'user.name', 'Widget Smoke']);
  writeFileSync(join(root, 'source.txt'), 'source\n');
  command(root, 'git', ['add', 'source.txt']);
  command(root, 'git', ['commit', '-m', 'source']);

  const missing = spawnSync(process.execPath, [checker, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH: '' },
  });
  assert.equal(missing.status, 1);
  assert.match(
    `${missing.stdout}\n${missing.stderr}`,
    /Missing PHASE5_WIDGET_LIFECYCLE_EVIDENCE_PATH/,
  );

  const head = command(root, 'git', ['rev-parse', 'HEAD']).toLowerCase();
  const evidence = createFixture(root, head);
  const evidencePath = `${WIDGET_LIFECYCLE_EVIDENCE_ROOT}evidence.json`;
  writeFileSync(resolve(root, evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
  const mismatch = runChecker(root, evidencePath, {
    PHASE5_IOS_BUILD_ID: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    PHASE5_SIGNED_OFF_BY: 'Morgan Reviewer',
    APP_IOS_BUNDLE_IDENTIFIER: 'com.acme.other',
  });
  assert.equal(mismatch.status, 1);
  assert.match(
    `${mismatch.stdout}\n${mismatch.stderr}`,
    /does not match PHASE5_IOS_BUILD_ID|must equal com\.acme\.other/,
  );
});

test('checked-in operator template exactly matches schema v2', () => {
  const result = spawnSync(process.execPath, [checker, '--check-template'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /template is current/);
});

let failures = 0;
try {
  for (const entry of cases) {
    try {
      entry.run();
      console.log(`OK ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error instanceof Error ? error.stack : String(error));
    }
  }
} finally {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
}

if (failures > 0) process.exit(1);
