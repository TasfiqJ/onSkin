import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HEALTH_CONSENT_SCHEMA_PATH,
  LIVE_CONSENT_COPY_CONTRACT_SHA256,
  LIVE_CONSENT_WITHDRAWAL_CHECK_MANIFEST_SHA256,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_FUTURE_SKEW_MS,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_MAX_AGE_MS,
  LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION,
  LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH,
  REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS,
  validateLiveConsentWithdrawalArtifact,
} from './consent-withdrawal-evidence.mjs';

const nowMs = Date.parse('2026-07-15T16:00:00.000Z');
const context = Object.freeze({
  nowMs,
  sourceSha: 'a'.repeat(40),
  currentSourceTreeClean: true,
  expectedProjectRef: 'b'.repeat(20),
  schemaSha256: 'c'.repeat(64),
  harnessSha256: 'd'.repeat(64),
  evidenceContractSha256: 'e'.repeat(64),
});

function validArtifact() {
  return {
    schemaVersion: LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION,
    status: 'pass',
    sourceSha: context.sourceSha,
    sourceTreeClean: true,
    appEnvironment: 'staging',
    expectedSupabaseProjectRef: context.expectedProjectRef,
    actualSupabaseProjectRef: context.expectedProjectRef,
    supabaseHost: `${context.expectedProjectRef}.supabase.co`,
    schemaRevision: {
      path: HEALTH_CONSENT_SCHEMA_PATH,
      sha256: context.schemaSha256,
    },
    harnessRevision: {
      path: LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH,
      sha256: context.harnessSha256,
    },
    evidenceContractRevision: {
      path: LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH,
      sha256: context.evidenceContractSha256,
    },
    copyContractSha256: LIVE_CONSENT_COPY_CONTRACT_SHA256,
    checkManifest: {
      names: [...REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS],
      sha256: LIVE_CONSENT_WITHDRAWAL_CHECK_MANIFEST_SHA256,
    },
    checks: REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS.map((name) => ({
      name,
      status: 'pass',
      detail: '',
    })),
    warnings: [],
    errors: [],
    ranAt: new Date(nowMs - 60_000).toISOString(),
  };
}

test('accepts only a complete current artifact for the reviewed source and host', () => {
  assert.deepEqual(validateLiveConsentWithdrawalArtifact(validArtifact(), context), {
    valid: true,
    reasons: [],
  });
});

test('rejects a pass-shaped artifact from a different revision or host', () => {
  const artifact = validArtifact();
  artifact.sourceSha = 'f'.repeat(40);
  artifact.actualSupabaseProjectRef = 'g'.repeat(20);
  const result = validateLiveConsentWithdrawalArtifact(artifact, context);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('source_revision'));
  assert.ok(result.reasons.includes('host'));
});

test('rejects stale evidence and incomplete or reordered check manifests', () => {
  const artifact = validArtifact();
  artifact.ranAt = new Date(nowMs - LIVE_CONSENT_WITHDRAWAL_EVIDENCE_MAX_AGE_MS - 1).toISOString();
  artifact.checkManifest.names.reverse();
  artifact.checks.pop();
  const result = validateLiveConsentWithdrawalArtifact(artifact, context);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('timestamp'));
  assert.ok(result.reasons.includes('check_manifest'));
  assert.ok(result.reasons.includes('checks'));
});

test('rejects future-dated evidence and altered evidence, copy, or manifest contracts', () => {
  const artifact = validArtifact();
  artifact.ranAt = new Date(
    nowMs + LIVE_CONSENT_WITHDRAWAL_EVIDENCE_FUTURE_SKEW_MS + 1,
  ).toISOString();
  artifact.evidenceContractRevision.sha256 = '0'.repeat(64);
  artifact.copyContractSha256 = '1'.repeat(64);
  artifact.checkManifest.sha256 = '2'.repeat(64);
  const result = validateLiveConsentWithdrawalArtifact(artifact, context);
  assert.equal(result.valid, false);
  for (const reason of [
    'timestamp',
    'evidence_contract_revision',
    'copy_contract',
    'check_manifest',
  ]) {
    assert.ok(result.reasons.includes(reason));
  }
});

test('rejects warnings, errors, dirty source, and wrong schema/harness bindings', () => {
  const artifact = validArtifact();
  artifact.sourceTreeClean = false;
  artifact.schemaRevision.sha256 = '0'.repeat(64);
  artifact.harnessRevision.sha256 = '1'.repeat(64);
  artifact.warnings.push('warning');
  artifact.errors.push('error');
  const result = validateLiveConsentWithdrawalArtifact(artifact, context);
  assert.equal(result.valid, false);
  for (const reason of [
    'source_tree',
    'schema_revision',
    'harness_revision',
    'warnings',
    'errors',
  ]) {
    assert.ok(result.reasons.includes(reason));
  }
});

test('rejects a valid historical artifact when the current source tree is dirty', () => {
  const result = validateLiveConsentWithdrawalArtifact(validArtifact(), {
    ...context,
    currentSourceTreeClean: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('current_source_tree'));
});

test('rejects a boolean-style status object without the bound artifact schema', () => {
  const result = validateLiveConsentWithdrawalArtifact({ status: 'pass' }, context);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('schema_version'));
  assert.ok(result.reasons.includes('check_manifest'));
});
