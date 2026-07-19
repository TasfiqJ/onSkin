#!/usr/bin/env node
import assert from 'node:assert/strict';

import { loadLaunchContract } from '../launch/contract.mjs';
import {
  parseReleaseManifestIdentity,
  validateReleaseArtifactEvidence,
} from './release-artifact-contract.mjs';

const NOW = Date.parse('2026-07-18T16:00:00.000Z');
const GIT_SHA = '1234567890abcdef1234567890abcdef12345678';
const BUILD_ID = '11111111-1111-4111-8111-111111111111';
const BINARY_UUID = '22222222-2222-4222-8222-222222222222';
const EXTRA_DSYM_UUID = '33333333-3333-4333-8333-333333333333';
const HERMES_DEBUG_ID = '44444444-4444-4444-8444-444444444444';
const UPLOADED_AT = '2026-07-18T14:00:00.000Z';
const RECOVERED_AT = '2026-07-18T15:00:00.000Z';
const RECEIPT_ID = 'upload-receipt-1234567890abcdef';
const JAVASCRIPT_EVENT_ID = 'abcdefabcdefabcdefabcdefabcdefab';
const NATIVE_EVENT_ID = '1234567890abcdef1234567890abcdef';
const SIGNING_TEAM_IDENTIFIER = 'ABCDE12345';

const hashes = Object.freeze({
  performanceEvidence: '1'.repeat(64),
  iosBinary: '2'.repeat(64),
  iosDsymArchive: '3'.repeat(64),
  iosHermesSourceMap: '4'.repeat(64),
  iosBinaryUuidEvidence: '5'.repeat(64),
  iosDsymUuidEvidence: '6'.repeat(64),
  iosHermesDebugIdEvidence: '7'.repeat(64),
  iosSentryUploadReceipt: '8'.repeat(64),
  iosSentryRecoveryReceipt: '9'.repeat(64),
});

function validFixture() {
  const release = 'com.routinekind.app@1.2.3+42';
  const dist = '42';
  return {
    evidence: {
      schemaVersion: 1,
      gitSha: GIT_SHA,
      performanceEvidence: {
        sha256: hashes.performanceEvidence,
        gitSha: GIT_SHA,
        iosBuildId: BUILD_ID,
      },
      ios: {
        status: 'required',
        easBuildId: BUILD_ID,
        bundleIdentifier: 'com.routinekind.app',
        appVersion: '1.2.3',
        buildNumber: '42',
        runtimeVersion: '1.2.3',
        signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
        release,
        dist,
        binary: {
          sha256: hashes.iosBinary,
          uuids: [BINARY_UUID],
          uuidEvidenceSha256: hashes.iosBinaryUuidEvidence,
        },
        dsym: {
          sha256: hashes.iosDsymArchive,
          uuids: [BINARY_UUID, EXTRA_DSYM_UUID],
          uuidEvidenceSha256: hashes.iosDsymUuidEvidence,
        },
        hermesSourceMap: {
          sha256: hashes.iosHermesSourceMap,
          debugId: HERMES_DEBUG_ID,
          debugIdEvidenceSha256: hashes.iosHermesDebugIdEvidence,
        },
        sentry: {
          uploadReceipt: {
            receiptId: RECEIPT_ID,
            sha256: hashes.iosSentryUploadReceipt,
            recordedAt: UPLOADED_AT,
          },
          recoveryReceipt: {
            javascriptEventId: JAVASCRIPT_EVENT_ID,
            nativeEventId: NATIVE_EVENT_ID,
            sha256: hashes.iosSentryRecoveryReceipt,
            recordedAt: RECOVERED_AT,
            status: 'symbolicated',
          },
        },
      },
      android: { status: 'not_applicable' },
    },
    performanceEvidence: {
      gitSha: GIT_SHA,
      capturedAt: '2026-07-18T13:00:00.000Z',
      devices: { ios: { buildId: BUILD_ID } },
    },
    attachments: {
      iosBinaryUuid: {
        schemaVersion: 1,
        kind: 'ios_binary_uuids',
        uuids: [BINARY_UUID],
      },
      iosDsymUuids: {
        schemaVersion: 1,
        kind: 'ios_dsym_uuids',
        uuids: [BINARY_UUID, EXTRA_DSYM_UUID],
      },
      iosHermesDebugId: {
        schemaVersion: 1,
        kind: 'ios_hermes_debug_id',
        uuid: HERMES_DEBUG_ID,
      },
      iosSentryUploadReceipt: {
        schemaVersion: 1,
        kind: 'sentry_artifact_upload',
        platform: 'ios',
        gitSha: GIT_SHA,
        buildId: BUILD_ID,
        release,
        dist,
        binaryUuids: [BINARY_UUID],
        dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
        hermesDebugId: HERMES_DEBUG_ID,
        receiptId: RECEIPT_ID,
        recordedAt: UPLOADED_AT,
        status: 'uploaded',
      },
      iosSentryRecoveryReceipt: {
        schemaVersion: 1,
        kind: 'sentry_symbolication_recovery',
        platform: 'ios',
        gitSha: GIT_SHA,
        buildId: BUILD_ID,
        release,
        dist,
        binaryUuids: [BINARY_UUID],
        dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
        hermesDebugId: HERMES_DEBUG_ID,
        javascriptEventId: JAVASCRIPT_EVENT_ID,
        nativeEventId: NATIVE_EVENT_ID,
        recordedAt: RECOVERED_AT,
        status: 'symbolicated',
      },
    },
  };
}

function clone(value) {
  return structuredClone(value);
}

function validate(fixture, overrides = {}) {
  return validateReleaseArtifactEvidence(fixture.evidence, {
    currentGitSha: GIT_SHA,
    performanceEvidence: fixture.performanceEvidence,
    performanceEvidenceSha256: hashes.performanceEvidence,
    artifactHashes: hashes,
    attachments: fixture.attachments,
    inspectedIdentities: {
      binaryUuids: [BINARY_UUID],
      dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
      hermesDebugId: HERMES_DEBUG_ID,
      bundledSourceMapCount: 0,
      bundleIdentifier: 'com.routinekind.app',
      appVersion: '1.2.3',
      buildNumber: '42',
      runtimeVersion: '1.2.3',
      signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
      signatureVerified: true,
    },
    providerVerification: {
      verified: true,
      javascriptEventId: JAVASCRIPT_EVENT_ID,
      nativeEventId: NATIVE_EVENT_ID,
      release: fixture.evidence.ios.release,
      dist: fixture.evidence.ios.dist,
    },
    manifestIdentity: {
      iosBuildId: BUILD_ID,
      bundleIdentifier: 'com.routinekind.app',
      appVersion: '1.2.3',
      buildNumber: '42',
      runtimeVersion: '1.2.3',
      signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
      artifactContract: 'release-artifacts.json',
    },
    launchContract: loadLaunchContract(),
    now: NOW,
    ...overrides,
  });
}

function expectFailure(label, mutate, pattern, overrides) {
  const fixture = clone(validFixture());
  mutate(fixture);
  const result = validate(fixture, overrides);
  assert.ok(
    result.errors.some((error) => pattern.test(error)),
    `${label}: ${result.errors.join('\n')}`,
  );
}

const valid = validate(validFixture());
assert.deepEqual(valid.errors, [], valid.errors.join('\n'));
assert.deepEqual(
  parseReleaseManifestIdentity(`
| Field | Value |
| --- | --- |
| iOS build ID | ${BUILD_ID} |
| Artifact contract | release-artifacts.json |
| Runtime version | 1.2.3 |
| App version/build | 1.2.3 / 42 |
| Bundle ID | com.routinekind.app |
| Signing team ID | ${SIGNING_TEAM_IDENTIFIER} |
`),
  {
    iosBuildId: BUILD_ID,
    bundleIdentifier: 'com.routinekind.app',
    appVersion: '1.2.3',
    buildNumber: '42',
    runtimeVersion: '1.2.3',
    signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
    artifactContract: 'release-artifacts.json',
  },
);

expectFailure(
  'wrong source SHA',
  (fixture) => {
    fixture.evidence.gitSha = 'a'.repeat(40);
  },
  /gitSha must match the clean commit/,
);
expectFailure(
  'wrong performance SHA',
  (fixture) => {
    fixture.evidence.performanceEvidence.sha256 = 'a'.repeat(64);
  },
  /performanceEvidence\.sha256 must match/,
);
expectFailure(
  'wrong performance build',
  (fixture) => {
    fixture.performanceEvidence.devices.ios.buildId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  },
  /attached performance evidence iOS build ID/,
);
expectFailure(
  'wrong artifact hash',
  (fixture) => {
    fixture.evidence.ios.hermesSourceMap.sha256 = 'a'.repeat(64);
  },
  /ios\.hermesSourceMap\.sha256 must match/,
);
expectFailure(
  'missing supplied artifact digest',
  () => {},
  /ios\.binary\.sha256 requires the SHA-256 digest of the supplied file/,
  { artifactHashes: { ...hashes, iosBinary: '' } },
);
expectFailure(
  'missing binary UUID from dSYM',
  (fixture) => {
    fixture.evidence.ios.dsym.uuids = [EXTRA_DSYM_UUID];
    fixture.attachments.iosDsymUuids.uuids = [EXTRA_DSYM_UUID];
    fixture.attachments.iosSentryUploadReceipt.dsymUuids = [EXTRA_DSYM_UUID];
    fixture.attachments.iosSentryRecoveryReceipt.dsymUuids = [EXTRA_DSYM_UUID];
  },
  /must include every ios\.binary\.uuids/,
);
expectFailure(
  'direct binary inspection mismatch',
  () => {},
  /Direct Mach-O inspection must match/,
  {
    inspectedIdentities: {
      binaryUuids: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
      hermesDebugId: HERMES_DEBUG_ID,
      bundledSourceMapCount: 0,
      bundleIdentifier: 'com.routinekind.app',
      appVersion: '1.2.3',
      buildNumber: '42',
      runtimeVersion: '1.2.3',
      signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
      signatureVerified: true,
    },
  },
);
expectFailure('source map bundled into IPA', () => {}, /must not contain source-map files/, {
  inspectedIdentities: {
    binaryUuids: [BINARY_UUID],
    dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
    hermesDebugId: HERMES_DEBUG_ID,
    bundledSourceMapCount: 1,
    bundleIdentifier: 'com.routinekind.app',
    appVersion: '1.2.3',
    buildNumber: '42',
    runtimeVersion: '1.2.3',
    signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
    signatureVerified: true,
  },
});
expectFailure('signed IPA identity mismatch', () => {}, /Signed IPA bundleIdentifier must match/, {
  inspectedIdentities: {
    binaryUuids: [BINARY_UUID],
    dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
    hermesDebugId: HERMES_DEBUG_ID,
    bundledSourceMapCount: 0,
    bundleIdentifier: 'com.example.other',
    appVersion: '1.2.3',
    buildNumber: '42',
    runtimeVersion: '1.2.3',
    signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
    signatureVerified: true,
  },
});
expectFailure(
  'invalid distribution signature',
  () => {},
  /must pass Apple distribution-signature verification/,
  {
    inspectedIdentities: {
      binaryUuids: [BINARY_UUID],
      dsymUuids: [BINARY_UUID, EXTRA_DSYM_UUID],
      hermesDebugId: HERMES_DEBUG_ID,
      bundledSourceMapCount: 0,
      bundleIdentifier: 'com.routinekind.app',
      appVersion: '1.2.3',
      buildNumber: '42',
      runtimeVersion: '1.2.3',
      signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
      signatureVerified: false,
    },
  },
);
expectFailure(
  'mismatched debug ID attachment',
  (fixture) => {
    fixture.attachments.iosHermesDebugId.uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  },
  /Hermes debug-ID attachment must match/,
);
expectFailure(
  'missing Hermes debug ID',
  (fixture) => {
    delete fixture.evidence.ios.hermesSourceMap.debugId;
  },
  /ios\.hermesSourceMap must contain exactly/,
);
expectFailure(
  'fake upload receipt',
  (fixture) => {
    fixture.evidence.ios.sentry.uploadReceipt.receiptId = 'TBD';
    fixture.attachments.iosSentryUploadReceipt.receiptId = 'TBD';
  },
  /real content-free receipt identifier/,
);
expectFailure(
  'wrong Sentry release',
  (fixture) => {
    fixture.attachments.iosSentryRecoveryReceipt.release = 'com.routinekind.app@9.9.9+99';
  },
  /release must match/,
);
expectFailure(
  'provider recovery not verified',
  () => {},
  /independently verified against the provider API/,
  { providerVerification: { verified: false } },
);
expectFailure(
  'same event used for JavaScript and native recovery',
  (fixture) => {
    fixture.evidence.ios.sentry.recoveryReceipt.nativeEventId = JAVASCRIPT_EVENT_ID;
    fixture.attachments.iosSentryRecoveryReceipt.nativeEventId = JAVASCRIPT_EVENT_ID;
  },
  /must use distinct Sentry events/,
);
expectFailure('RC manifest build mismatch', () => {}, /RC manifest iOS build ID must match/, {
  manifestIdentity: {
    iosBuildId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    bundleIdentifier: 'com.routinekind.app',
    appVersion: '1.2.3',
    buildNumber: '42',
    runtimeVersion: '1.2.3',
    signingTeamIdentifier: SIGNING_TEAM_IDENTIFIER,
    artifactContract: 'release-artifacts.json',
  },
});
expectFailure(
  'stale upload receipt',
  (fixture) => {
    const stale = '2026-05-01T00:00:00.000Z';
    fixture.evidence.ios.sentry.uploadReceipt.recordedAt = stale;
    fixture.attachments.iosSentryUploadReceipt.recordedAt = stale;
  },
  /older than the 30-day RC window/,
);
expectFailure(
  'future recovery receipt',
  (fixture) => {
    const future = '2026-07-19T00:00:00.000Z';
    fixture.evidence.ios.sentry.recoveryReceipt.recordedAt = future;
    fixture.attachments.iosSentryRecoveryReceipt.recordedAt = future;
  },
  /must not be in the future/,
);
expectFailure(
  'sensitive receipt content',
  (fixture) => {
    fixture.evidence.ios.sentry.uploadReceipt.receiptId = 'https://sentry.example/secret';
    fixture.attachments.iosSentryUploadReceipt.receiptId = 'https://sentry.example/secret';
  },
  /contains a URL, path, credential, or raw diagnostic payload/,
);
expectFailure(
  'email-shaped release content',
  (fixture) => {
    fixture.evidence.ios.release = 'owner@example.com';
  },
  /contains a URL, path, credential, or raw diagnostic payload/,
);
expectFailure(
  'unsupported schema',
  (fixture) => {
    fixture.evidence.schemaVersion = 2;
  },
  /schemaVersion must be 1/,
);
expectFailure(
  'Android cannot be falsely marked not applicable after reactivation',
  () => {},
  /Android is now release-required/,
  {
    launchContract: { release: { platforms: ['ios', 'android'] } },
  },
);

console.log('Release artifact contract smoke passed (1 positive, 22 negative cases).');
