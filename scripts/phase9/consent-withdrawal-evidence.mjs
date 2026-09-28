#!/usr/bin/env node
import { createHash } from 'node:crypto';

export const LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION = 3;
export const LIVE_CONSENT_WITHDRAWAL_EVIDENCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const LIVE_CONSENT_WITHDRAWAL_EVIDENCE_FUTURE_SKEW_MS = 5 * 60 * 1_000;
export const HEALTH_CONSENT_SCHEMA_PATH =
  'supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql';
export const LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH = 'scripts/phase9/live-consent-withdrawal.mjs';
export const LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH =
  'scripts/phase9/consent-withdrawal-evidence.mjs';

export const REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS = Object.freeze([
  'authoritative base and dependent grant RPCs establish exact owner-bound authorities',
  'photo_cloud_backup withdrawal is accepted pending and the scheduled worker removes owned Storage before terminal relocalization',
  'ask_layerwell withdrawal deletes the complete server-side Ask graph',
  'photo_trend_insights withdrawal deletes trend rows',
  'community_participation withdrawal deletes owner community rows',
  'data_sharing withdrawal preserves COM-01A zero publication and returns truthful zero cleanup',
  'photo_capture withdrawal is accepted pending and the scheduled worker deletes remaining photo metadata',
  'synthetic harness cleanup removes owned Storage, fixtures, and Auth identity',
]);

export const LIVE_HEALTH_CONSENT_COPY = Object.freeze({
  baseGrant: Object.freeze({
    version: 'draft-v1-2026-07-10',
    hash: '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd',
  }),
  dependent: Object.freeze({
    photo_capture: Object.freeze({
      grant: Object.freeze({
        version: 'draft-v1-2026-07-10',
        hash: '2ed9ac0c1009327c08389040d0a1db05462c39102f8730038a90ecd62de8e8c2',
      }),
      withdrawal: Object.freeze({
        version: 'draft-v1-2026-07-10',
        hash: '553229a2862dd3d280058e7413b3bc85795932dec2f6ca9bed420b7598e54c51',
      }),
    }),
    photo_cloud_backup: Object.freeze({
      grant: Object.freeze({
        version: 'draft-v1-2026-07-10',
        hash: '3964f0829f0c5a1369b3e413d6edaa2585cda671333a6efb0d1f8d84d6f5e8b8',
      }),
      withdrawal: Object.freeze({
        version: 'draft-v1-2026-07-10',
        hash: 'cd32873fec948532c00ed92b5052f5df95a59eef52faa5cc7e1f431e6ddd0113',
      }),
    }),
    photo_trend_insights: Object.freeze({
      grant: Object.freeze({
        version: 'photo-trend-insights-2026-06-13-placeholder',
        hash: '58997d5c3ef5098edf6544aa2752e6878765065831ddbf42c24a364ab36cd1aa',
      }),
      withdrawal: Object.freeze({
        version: 'photo-trend-insights-2026-06-13-placeholder',
        hash: 'd6bd89ffbb0900784d4af6d8ae1501c7e10385eeba199e1bd8e932d957eec6ba',
      }),
    }),
    ask_layerwell: Object.freeze({
      grant: Object.freeze({
        version: 'ask-advisor-2026-06-14-placeholder',
        hash: '242f45399eb0fc3a792124b641f733feae9bf8321291d7e2c49e2799b8623303',
      }),
      withdrawal: Object.freeze({
        version: 'ask-advisor-2026-06-14-placeholder',
        hash: '4d0b588ed43f4680adaf6e7699641c706e113bed7b9212b408532235e4fe1e57',
      }),
    }),
    community_participation: Object.freeze({
      grant: Object.freeze({
        version: 'community-participation-2026-06-13-placeholder',
        hash: '416da3ba3cd3496c1008cff937b4d7ad0efa7093d40bcfed2636b480e603ca5e',
      }),
      withdrawal: Object.freeze({
        version: 'community-participation-2026-06-13-placeholder',
        hash: 'c6ac514c090e7ba197b3f66497aff3b8615c5ffdda7ed2e21eb81f62870aff2e',
      }),
    }),
    data_sharing: Object.freeze({
      grant: Object.freeze({
        version: 'commerce-consent-2026-06-13-placeholder',
        hash: 'b02cf2e0dd7fa1a1e0be10122b9a363109b0d6adbd7d3c478c168ff811c17b7a',
      }),
      withdrawal: Object.freeze({
        version: 'commerce-consent-2026-06-13-placeholder',
        hash: '91f4958177a5d38507536c281726094938df5675555547576b5d18e799bc89b4',
      }),
    }),
  }),
});

export function canonicalSha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export const LIVE_CONSENT_WITHDRAWAL_CHECK_MANIFEST_SHA256 = canonicalSha256(
  REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS,
);
export const LIVE_CONSENT_COPY_CONTRACT_SHA256 = canonicalSha256(LIVE_HEALTH_CONSENT_COPY);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactStringArray(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  );
}

function canonicalProjectRef(value) {
  return typeof value === 'string' && /^[a-z0-9]{20}$/.test(value);
}

/**
 * Validate a checked-in or downloaded artifact without consulting a boolean
 * pass flag. The caller supplies the reviewed source/host and current file
 * hashes so an old, hand-edited, or wrong-project artifact cannot satisfy the
 * strict release smoke.
 */
export function validateLiveConsentWithdrawalArtifact(artifact, context) {
  const reasons = [];
  if (!isRecord(artifact)) return { valid: false, reasons: ['artifact_shape'] };

  if (artifact.schemaVersion !== LIVE_CONSENT_WITHDRAWAL_EVIDENCE_SCHEMA_VERSION) {
    reasons.push('schema_version');
  }
  if (artifact.status !== 'pass') reasons.push('status');
  if (artifact.sourceSha !== context.sourceSha) reasons.push('source_revision');
  if (context.currentSourceTreeClean !== true) reasons.push('current_source_tree');
  if (artifact.sourceTreeClean !== true) reasons.push('source_tree');
  if (artifact.appEnvironment !== 'staging') reasons.push('environment');

  const expectedRef = context.expectedProjectRef;
  if (!canonicalProjectRef(expectedRef)) {
    reasons.push('reviewed_host_missing');
  } else if (
    artifact.expectedSupabaseProjectRef !== expectedRef ||
    artifact.actualSupabaseProjectRef !== expectedRef ||
    artifact.supabaseHost !== `${expectedRef}.supabase.co`
  ) {
    reasons.push('host');
  }

  if (
    !isRecord(artifact.schemaRevision) ||
    artifact.schemaRevision.path !== HEALTH_CONSENT_SCHEMA_PATH ||
    artifact.schemaRevision.sha256 !== context.schemaSha256
  ) {
    reasons.push('schema_revision');
  }
  if (
    !isRecord(artifact.harnessRevision) ||
    artifact.harnessRevision.path !== LIVE_CONSENT_WITHDRAWAL_HARNESS_PATH ||
    artifact.harnessRevision.sha256 !== context.harnessSha256
  ) {
    reasons.push('harness_revision');
  }
  if (
    !isRecord(artifact.evidenceContractRevision) ||
    artifact.evidenceContractRevision.path !== LIVE_CONSENT_WITHDRAWAL_EVIDENCE_CONTRACT_PATH ||
    artifact.evidenceContractRevision.sha256 !== context.evidenceContractSha256
  ) {
    reasons.push('evidence_contract_revision');
  }
  if (artifact.copyContractSha256 !== LIVE_CONSENT_COPY_CONTRACT_SHA256) {
    reasons.push('copy_contract');
  }

  if (
    !isRecord(artifact.checkManifest) ||
    !exactStringArray(artifact.checkManifest.names, REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS) ||
    artifact.checkManifest.sha256 !== LIVE_CONSENT_WITHDRAWAL_CHECK_MANIFEST_SHA256
  ) {
    reasons.push('check_manifest');
  }
  if (
    !Array.isArray(artifact.checks) ||
    artifact.checks.length !== REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS.length ||
    artifact.checks.some(
      (check, index) =>
        !isRecord(check) ||
        check.name !== REQUIRED_LIVE_CONSENT_WITHDRAWAL_CHECKS[index] ||
        check.status !== 'pass' ||
        check.detail !== '',
    )
  ) {
    reasons.push('checks');
  }
  if (!Array.isArray(artifact.warnings) || artifact.warnings.length !== 0) {
    reasons.push('warnings');
  }
  if (!Array.isArray(artifact.errors) || artifact.errors.length !== 0) {
    reasons.push('errors');
  }

  const ranAtMs = typeof artifact.ranAt === 'string' ? Date.parse(artifact.ranAt) : Number.NaN;
  if (
    !Number.isFinite(ranAtMs) ||
    ranAtMs < context.nowMs - LIVE_CONSENT_WITHDRAWAL_EVIDENCE_MAX_AGE_MS ||
    ranAtMs > context.nowMs + LIVE_CONSENT_WITHDRAWAL_EVIDENCE_FUTURE_SKEW_MS
  ) {
    reasons.push('timestamp');
  }

  return { valid: reasons.length === 0, reasons };
}
