import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  auditRevenueCatV2AccessEvidence,
  normalizePhase6Reviewer,
  revenueCatV1SecretKeyFingerprint,
  revenueCatV2SecretKeyFingerprint,
} from './payments-revenuecat-access-evidence.mjs';

const PROJECT_ID = 'projlivevalue123';
const V2_SECRET_KEY = 'sk_V2LiveAccessKey2026Alpha9';
const LEGACY_SECRET_KEY = 'sk_LegacyV1AccessKey2026Beta8';
const SIGNED_OFF_BY = 'Tas Mohammed';
const NOW_MS = Date.parse('2026-07-16T12:00:00.000Z');

function validDocument() {
  return {
    schemaVersion: 1,
    status: 'complete',
    provider: 'revenuecat',
    environment: 'production',
    projectId: PROJECT_ID,
    legacyV1SecretKeyFingerprintSha256: revenueCatV1SecretKeyFingerprint(LEGACY_SECRET_KEY),
    v2SecretKeyFingerprintSha256: revenueCatV2SecretKeyFingerprint(V2_SECRET_KEY),
    permissions: [
      'customer_information:customers:read_write',
      'project_configuration:projects:read',
    ],
    observations: {
      bearerProjectListHttpStatus: 200,
      customerReadBeforeDeleteHttpStatus: 200,
      customerDeleteHttpStatus: 200,
      customerReadAfterDeleteHttpStatus: 404,
      fullFamilyAbsenceReconciled: true,
      legacyCustomerInfoReadHttpStatus: 200,
    },
    redacted: true,
    reviewedAt: '2026-07-16T12:00:00.000Z',
    reviewedBy: SIGNED_OFF_BY,
  };
}

function withEvidence(document, callback) {
  const root = mkdtempSync(join(tmpdir(), 'routinekind-phase6-access-evidence-'));
  const evidencePath = 'docs/phase-6/revenuecat-v2-access-evidence.test.json';
  const directory = join(root, 'docs', 'phase-6');
  const absolutePath = join(root, evidencePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(document, null, 2)}\n`);
  try {
    return callback({ root, evidencePath, absolutePath });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function withEvidenceBytes(bytes, callback) {
  const root = mkdtempSync(join(tmpdir(), 'routinekind-phase6-access-evidence-'));
  const evidencePath = 'docs/phase-6/revenuecat-v2-access-evidence.test.json';
  const directory = join(root, 'docs', 'phase-6');
  const absolutePath = join(root, evidencePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(absolutePath, bytes);
  try {
    return callback({ root, evidencePath, absolutePath });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function audit(root, evidencePath, overrides = {}) {
  return auditRevenueCatV2AccessEvidence({
    root,
    evidencePath,
    nowMs: NOW_MS,
    projectId: PROJECT_ID,
    legacySecretKey: LEGACY_SECRET_KEY,
    v2SecretKey: V2_SECRET_KEY,
    signedOffBy: SIGNED_OFF_BY,
    ...overrides,
  });
}

test('accepts and hashes exact project/key-bound redacted evidence', () => {
  withEvidence(validDocument(), ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, true);
    assert.match(result.artifactSha256, /^[0-9a-f]{64}$/);
    assert.equal(result.projectId, PROJECT_ID);
    assert.equal(
      result.v2SecretKeyFingerprintSha256,
      revenueCatV2SecretKeyFingerprint(V2_SECRET_KEY),
    );
    assert.deepEqual(result.errors, []);
  });
});

test('rejects missing and unsafe evidence locators', () => {
  const missing = auditRevenueCatV2AccessEvidence({
    root: 'C:/repo',
    evidencePath: '',
    nowMs: NOW_MS,
    projectId: PROJECT_ID,
    legacySecretKey: LEGACY_SECRET_KEY,
    v2SecretKey: V2_SECRET_KEY,
    signedOffBy: SIGNED_OFF_BY,
  });
  assert.match(missing.errors.join('\n'), /Missing PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH/);

  const unsafe = auditRevenueCatV2AccessEvidence({
    root: 'C:/repo',
    evidencePath: '../evidence.json',
    nowMs: NOW_MS,
    projectId: PROJECT_ID,
    legacySecretKey: LEGACY_SECRET_KEY,
    v2SecretKey: V2_SECRET_KEY,
    signedOffBy: SIGNED_OFF_BY,
  });
  assert.match(unsafe.errors.join('\n'), /normalized repo-relative JSON path/);
});

test('rejects project, key fingerprint, and reviewer mismatches without exposing the key', () => {
  const document = validDocument();
  document.projectId = 'projother12345';
  document.v2SecretKeyFingerprintSha256 = '0'.repeat(64);
  document.reviewedBy = 'Different Reviewer';
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /projectId does not match/);
    assert.match(result.errors.join('\n'), /key fingerprint does not match/);
    assert.match(result.errors.join('\n'), /reviewedBy does not match/);
    assert.equal(JSON.stringify(result).includes(V2_SECRET_KEY), false);
  });
});

test('rejects secret material used as reviewer metadata or embedded in evidence', () => {
  assert.equal(
    normalizePhase6Reviewer(V2_SECRET_KEY, { REVENUECAT_V2_SECRET_API_KEY: V2_SECRET_KEY }),
    '',
  );
  assert.equal(normalizePhase6Reviewer('whsec_not_a_reviewer', {}), '');
  assert.equal(
    normalizePhase6Reviewer(`Tas ${V2_SECRET_KEY} Mohammed`, {
      REVENUECAT_V2_SECRET_API_KEY: V2_SECRET_KEY,
    }),
    '',
  );
  assert.equal(normalizePhase6Reviewer(SIGNED_OFF_BY, {}), SIGNED_OFF_BY);

  const document = validDocument();
  document.reviewedBy = V2_SECRET_KEY;
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath, { signedOffBy: V2_SECRET_KEY });
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /must never contain a configured secret key/);
    assert.equal(JSON.stringify(result).includes(V2_SECRET_KEY), false);
  });
});

test('rejects duplicate-key evidence and scans overwritten raw secret values', () => {
  const canonical = `${JSON.stringify(validDocument(), null, 2)}\n`;
  const duplicate = canonical.replace(
    `  "reviewedBy": "${SIGNED_OFF_BY}"`,
    `  "reviewedBy": "${V2_SECRET_KEY}",\n  "reviewedBy": "${SIGNED_OFF_BY}"`,
  );
  withEvidenceBytes(Buffer.from(duplicate, 'utf8'), ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /canonical duplicate-free JSON encoding/);
    assert.match(result.errors.join('\n'), /must never contain a configured secret key/);
    assert.equal(JSON.stringify(result).includes(V2_SECRET_KEY), false);
  });
});

test('rejects a mismatched legacy V1 key binding or observation', () => {
  const document = validDocument();
  document.legacyV1SecretKeyFingerprintSha256 = '0'.repeat(64);
  document.observations.legacyCustomerInfoReadHttpStatus = 401;
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /legacy key fingerprint does not match/);
    assert.match(result.errors.join('\n'), /legacy V1 CustomerInfo read/);
  });
});

test('rejects incomplete permissions and provider observations', () => {
  const document = validDocument();
  document.permissions = ['project_configuration:projects:read'];
  document.observations.customerDeleteHttpStatus = 403;
  document.observations.fullFamilyAbsenceReconciled = false;
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /permissions are incomplete or noncanonical/);
    assert.match(result.errors.join('\n'), /observations do not record/);
  });
});

test('rejects evidence older than the seven-day launch window', () => {
  const document = validDocument();
  document.reviewedAt = new Date(NOW_MS - 7 * 24 * 60 * 60 * 1000 - 1).toISOString();
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /older than the seven-day launch window/);
  });
});

test('rejects evidence dated more than five minutes in the future', () => {
  const document = validDocument();
  document.reviewedAt = new Date(NOW_MS + 5 * 60 * 1000 + 1).toISOString();
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /too far in the future/);
  });
});

test('rejects invalid UTF-8 before JSON schema validation', () => {
  withEvidenceBytes(Buffer.from([0x22, 0xc3, 0x28, 0x22]), ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /must contain valid UTF-8 JSON/);
    assert.doesNotMatch(result.errors.join('\n'), /invalid top-level schema/);
  });
});

test('rejects the blocked template state and malformed schemas', () => {
  const template = validDocument();
  template.status = 'template';
  withEvidence(template, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /completed, redacted production RevenueCat record/);
  });

  const malformed = validDocument();
  malformed.extra = true;
  withEvidence(malformed, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /invalid top-level schema/);
  });
});

test('rejects malformed audit input', () => {
  assert.throws(
    () =>
      auditRevenueCatV2AccessEvidence({
        root: 'C:/repo',
        evidencePath: '',
        nowMs: NOW_MS,
        projectId: PROJECT_ID,
        legacySecretKey: LEGACY_SECRET_KEY,
        v2SecretKey: V2_SECRET_KEY,
        signedOffBy: SIGNED_OFF_BY,
        extra: true,
      }),
    TypeError,
  );
});
