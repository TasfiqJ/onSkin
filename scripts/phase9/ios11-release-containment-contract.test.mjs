import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditIos11SourceReadiness,
  validateIos11ReleaseContainmentEvidence,
} from './ios11-release-containment-contract.mjs';

const SOURCE = 'a'.repeat(40);
const HOTFIX_SOURCE = 'b'.repeat(40);
const HASH_A = '1'.repeat(64);
const HASH_B = '2'.repeat(64);
const RUNTIME_A = '3'.repeat(40);
const RUNTIME_B = '4'.repeat(40);
const RECEIPT = '5'.repeat(64);
const NOW = Date.parse('2026-09-26T12:00:00Z');

function fixture() {
  return {
    schemaVersion: 1,
    status: 'completed',
    releaseCandidate: {
      sourceGitSha: SOURCE,
      easBuildId: '11111111-1111-4111-8111-111111111111',
      artifactSha256: HASH_A,
      runtimeFingerprint: RUNTIME_A,
      appVersion: '1.0.0',
      buildNumber: '100',
    },
    releaseHalt: {
      environment: 'staging',
      incidentId: 'ios11-drill-001',
      declaredAt: '2026-09-26T10:00:00Z',
      confirmedAt: '2026-09-26T10:01:00Z',
      expansionFrozen: true,
      buildSelectionBlocked: true,
      submissionBlocked: true,
      marketingBlocked: true,
      independentReadback: true,
      receiptSha256: RECEIPT,
    },
    serverContainment: {
      faultDomain: 'feature_flag',
      mechanismId: 'routine-write-kill-switch',
      activatedAt: '2026-09-26T10:02:00Z',
      confirmedAt: '2026-09-26T10:03:00Z',
      reviewedBeforeDrill: true,
      failClosed: true,
      independentReadback: true,
      affectedFlows: ['routine_read', 'routine_write'],
      receiptSha256: RECEIPT,
    },
    supportedBinaryPolicy: {
      inventoryComplete: true,
      minimumSupportedBuildNumber: '100',
      maximumSupportedBuildNumber: '101',
      supportedBuildNumbers: ['100', '101'],
      capturedAt: '2026-09-26T10:04:00Z',
    },
    supportedBinaries: [
      {
        buildNumber: '100',
        sourceGitSha: SOURCE,
        easBuildId: '11111111-1111-4111-8111-111111111111',
        artifactSha256: HASH_A,
        runtimeFingerprint: RUNTIME_A,
        role: 'affected',
        containmentActive: true,
        noOtaPath: true,
        testedFlows: ['routine_read', 'routine_write'],
        result: 'pass',
        receiptSha256: RECEIPT,
      },
      {
        buildNumber: '101',
        sourceGitSha: HOTFIX_SOURCE,
        easBuildId: '22222222-2222-4222-8222-222222222222',
        artifactSha256: HASH_B,
        runtimeFingerprint: RUNTIME_B,
        role: 'hotfix',
        containmentActive: true,
        noOtaPath: true,
        testedFlows: ['routine_read', 'routine_write'],
        result: 'pass',
        receiptSha256: RECEIPT,
      },
    ],
    hotfix: {
      sourceGitSha: HOTFIX_SOURCE,
      easBuildId: '22222222-2222-4222-8222-222222222222',
      artifactSha256: HASH_B,
      runtimeFingerprint: RUNTIME_B,
      buildNumber: '101',
      storeBinaryOnly: true,
      otaPublished: false,
      testedWithContainmentOn: true,
      testedWithContainmentOff: true,
      readyForStoreReview: true,
      receiptSha256: RECEIPT,
    },
    review: {
      releaseManager: 'Alice Release',
      serverOwner: 'Bob Server',
      independentReviewer: 'Casey Review',
      reviewedAt: '2026-09-26T11:00:00Z',
    },
  };
}

test('repository remains source-ready while external IOS-11 evidence is incomplete', () => {
  const result = auditIos11SourceReadiness();
  assert.equal(result.status, 'source-ready');
  assert.equal(result.ios11Complete, false);
  assert.equal(result.easUpdateEnabled, false);
});

test('exact RC, halt, containment, hotfix, and supported-binary drill passes', () => {
  const result = validateIos11ReleaseContainmentEvidence(fixture(), {
    now: NOW,
    expectedSourceGitSha: SOURCE,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.status, 'pass');
  assert.equal(result.ios11Complete, true);
});

test('OTA publication and incomplete release halt fail closed', () => {
  const evidence = fixture();
  evidence.hotfix.otaPublished = true;
  evidence.releaseHalt.submissionBlocked = false;
  const result = validateIos11ReleaseContainmentEvidence(evidence, { now: NOW });
  assert.match(result.errors.join('\n'), /otaPublished must be false/);
  assert.match(result.errors.join('\n'), /submissionBlocked must be true/);
});

test('partial or mismatched supported-binary coverage fails closed', () => {
  const evidence = fixture();
  evidence.supportedBinaries[0].testedFlows = ['routine_read'];
  evidence.supportedBinaries[1].runtimeFingerprint = RUNTIME_A;
  const result = validateIos11ReleaseContainmentEvidence(evidence, { now: NOW });
  assert.match(result.errors.join('\n'), /testedFlows must exactly cover/);
  assert.match(result.errors.join('\n'), /hotfix entry must exactly match/);
});

test('sparse or incomplete supported-build inventory fails closed', () => {
  const evidence = fixture();
  evidence.supportedBinaryPolicy.maximumSupportedBuildNumber = '999';
  evidence.supportedBinaryPolicy.supportedBuildNumbers = ['100', '999'];
  const result = validateIos11ReleaseContainmentEvidence(evidence, { now: NOW });
  assert.match(result.errors.join('\n'), /must exactly match supportedBinaryPolicy/);
});

test('affected row must bind candidate build ID and artifact hash', () => {
  const evidence = fixture();
  evidence.supportedBinaries[0].easBuildId = '33333333-3333-4333-8333-333333333333';
  evidence.supportedBinaries[0].artifactSha256 = '6'.repeat(64);
  const result = validateIos11ReleaseContainmentEvidence(evidence, { now: NOW });
  assert.match(result.errors.join('\n'), /exact affected release candidate identity/);
});

test('stale, unsigned-shape, and same-source hotfix evidence fails closed', () => {
  const evidence = fixture();
  evidence.releaseHalt.declaredAt = '2026-01-01T00:00:00Z';
  evidence.hotfix.sourceGitSha = SOURCE;
  evidence.supportedBinaries[1].sourceGitSha = SOURCE;
  evidence.review.independentReviewer = evidence.review.releaseManager;
  const result = validateIos11ReleaseContainmentEvidence(evidence, { now: NOW });
  assert.match(result.errors.join('\n'), /older than the 30-day/);
  assert.match(result.errors.join('\n'), /must differ from the affected source/);
  assert.match(result.errors.join('\n'), /three distinct people/);
});
