import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';

import { normalizeNamedSignoff } from '../phase9/lib.mjs';

const MAX_EVIDENCE_BYTES = 64 * 1024;
const MAX_REVIEW_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const REVENUECAT_SECRET_KEY_PATTERN = /^sk_[A-Za-z0-9]{20,997}$/;
const EVIDENCE_PATH_PATTERN =
  /^docs\/phase-6\/revenuecat-v2-access-evidence\.[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.json$/;
const REQUIRED_PERMISSIONS = Object.freeze([
  'customer_information:customers:read_write',
  'project_configuration:projects:read',
]);
const EVIDENCE_KEYS = Object.freeze([
  'environment',
  'legacyV1SecretKeyFingerprintSha256',
  'observations',
  'permissions',
  'projectId',
  'provider',
  'redacted',
  'reviewedAt',
  'reviewedBy',
  'schemaVersion',
  'status',
  'v2SecretKeyFingerprintSha256',
]);
const OBSERVATION_KEYS = Object.freeze([
  'bearerProjectListHttpStatus',
  'customerDeleteHttpStatus',
  'customerReadAfterDeleteHttpStatus',
  'customerReadBeforeDeleteHttpStatus',
  'fullFamilyAbsenceReconciled',
  'legacyCustomerInfoReadHttpStatus',
]);

function exactKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\n') === [...expectedKeys].sort().join('\n')
  );
}

function canonicalIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function safeReviewedBy(value) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 2 &&
    value.length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function freezeResult(result) {
  Object.freeze(result.errors);
  return Object.freeze(result);
}

function revenueCatSecretKeyFingerprint(secretKey) {
  if (typeof secretKey !== 'string' || !REVENUECAT_SECRET_KEY_PATTERN.test(secretKey)) return '';
  return createHash('sha256').update(secretKey, 'utf8').digest('hex');
}

export const revenueCatV1SecretKeyFingerprint = revenueCatSecretKeyFingerprint;
export const revenueCatV2SecretKeyFingerprint = revenueCatSecretKeyFingerprint;

export function normalizePhase6Reviewer(value, environment) {
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new TypeError('Phase 6 reviewer environment is malformed.');
  }
  const normalized = normalizeNamedSignoff(value);
  if (
    normalized === null ||
    /(?:sk_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9_-]{8,}|bearer\s)/i.test(normalized)
  ) {
    return '';
  }
  const sensitiveValues = Object.entries(environment)
    .filter(([name]) =>
      /(?:secret|token|password|auth|api_key|private_key|service_role|hmac)/i.test(name),
    )
    .map(([, configuredValue]) => String(configuredValue ?? '').trim())
    .filter((configuredValue) => configuredValue.length >= 8);
  return sensitiveValues.some((configuredValue) => normalized.includes(configuredValue))
    ? ''
    : normalized;
}

export function auditRevenueCatV2AccessEvidence(input) {
  if (
    !exactKeys(input, [
      'evidencePath',
      'legacySecretKey',
      'nowMs',
      'projectId',
      'root',
      'signedOffBy',
      'v2SecretKey',
    ]) ||
    typeof input.root !== 'string' ||
    typeof input.evidencePath !== 'string' ||
    typeof input.legacySecretKey !== 'string' ||
    !Number.isSafeInteger(input.nowMs) ||
    input.nowMs < 0 ||
    typeof input.projectId !== 'string' ||
    typeof input.v2SecretKey !== 'string' ||
    typeof input.signedOffBy !== 'string'
  ) {
    throw new TypeError('RevenueCat V2 access evidence audit input is malformed.');
  }

  const errors = [];
  const expectedFingerprint = revenueCatV2SecretKeyFingerprint(input.v2SecretKey);
  const expectedLegacyFingerprint = revenueCatV1SecretKeyFingerprint(input.legacySecretKey);
  let artifactSha256 = '';
  let decodedText = '';
  let document = null;
  let normalizedPath = '';

  if (!input.evidencePath) {
    errors.push('Missing PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH.');
  } else if (
    input.evidencePath !== input.evidencePath.trim() ||
    input.evidencePath.includes('\\') ||
    !EVIDENCE_PATH_PATTERN.test(input.evidencePath)
  ) {
    errors.push(
      'PHASE6_REVENUECAT_V2_ACCESS_EVIDENCE_PATH must be one normalized repo-relative JSON path named docs/phase-6/revenuecat-v2-access-evidence.<release>.json.',
    );
  } else {
    normalizedPath = input.evidencePath;
    const absolutePath = resolve(input.root, normalizedPath);
    const evidenceRoot = `${resolve(input.root, 'docs/phase-6')}${sep}`.toLowerCase();
    if (!absolutePath.toLowerCase().startsWith(evidenceRoot)) {
      errors.push('RevenueCat V2 access evidence path escapes docs/phase-6.');
    } else if (!existsSync(absolutePath)) {
      errors.push('RevenueCat V2 access evidence artifact is missing.');
    } else {
      try {
        const fileStat = lstatSync(absolutePath);
        const realPath = realpathSync(absolutePath);
        if (
          fileStat.isSymbolicLink() ||
          !fileStat.isFile() ||
          realPath.toLowerCase() !== absolutePath.toLowerCase()
        ) {
          errors.push('RevenueCat V2 access evidence artifact must be one direct regular file.');
        } else if (fileStat.size === 0 || fileStat.size > MAX_EVIDENCE_BYTES) {
          errors.push('RevenueCat V2 access evidence artifact exceeds its bounded file size.');
        } else {
          const bytes = readFileSync(absolutePath);
          if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_BYTES) {
            errors.push('RevenueCat V2 access evidence artifact exceeds its bounded file size.');
          } else {
            artifactSha256 = createHash('sha256').update(bytes).digest('hex');
            try {
              decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
              document = JSON.parse(decodedText);
            } catch {
              errors.push('RevenueCat V2 access evidence artifact must contain valid UTF-8 JSON.');
            }
          }
        }
      } catch {
        errors.push('RevenueCat V2 access evidence artifact could not be read safely.');
      }
    }
  }

  if (document !== null) {
    const canonicalText = `${JSON.stringify(document, null, 2)}\n`;
    if (decodedText !== canonicalText) {
      errors.push('RevenueCat access evidence must use canonical duplicate-free JSON encoding.');
    }
    if (
      (expectedFingerprint.length > 0 && decodedText.includes(input.v2SecretKey)) ||
      (expectedLegacyFingerprint.length > 0 && decodedText.includes(input.legacySecretKey))
    ) {
      errors.push('RevenueCat access evidence must never contain a configured secret key.');
    }
    if (!exactKeys(document, EVIDENCE_KEYS)) {
      errors.push('RevenueCat V2 access evidence artifact has an invalid top-level schema.');
    } else {
      if (
        document.schemaVersion !== 1 ||
        document.status !== 'complete' ||
        document.provider !== 'revenuecat' ||
        document.environment !== 'production' ||
        document.redacted !== true
      ) {
        errors.push(
          'RevenueCat V2 access evidence must be a completed, redacted production RevenueCat record.',
        );
      }
      if (document.projectId !== input.projectId) {
        errors.push(
          'RevenueCat V2 access evidence projectId does not match REVENUECAT_PROJECT_ID.',
        );
      }
      if (!/^proj[A-Za-z0-9]{5,251}$/.test(input.projectId)) {
        errors.push('RevenueCat V2 access evidence cannot bind a noncanonical project ID.');
      }
      if (
        expectedFingerprint.length === 0 ||
        document.v2SecretKeyFingerprintSha256 !== expectedFingerprint
      ) {
        errors.push(
          'RevenueCat V2 access evidence key fingerprint does not match the configured V2 secret key.',
        );
      }
      if (
        expectedLegacyFingerprint.length === 0 ||
        document.legacyV1SecretKeyFingerprintSha256 !== expectedLegacyFingerprint
      ) {
        errors.push(
          'RevenueCat access evidence legacy key fingerprint does not match REVENUECAT_SECRET_API_KEY.',
        );
      }
      if (
        !Array.isArray(document.permissions) ||
        document.permissions.length !== REQUIRED_PERMISSIONS.length ||
        document.permissions.some((permission, index) => permission !== REQUIRED_PERMISSIONS[index])
      ) {
        errors.push('RevenueCat V2 access evidence permissions are incomplete or noncanonical.');
      }
      if (
        !exactKeys(document.observations, OBSERVATION_KEYS) ||
        document.observations.bearerProjectListHttpStatus !== 200 ||
        document.observations.customerReadBeforeDeleteHttpStatus !== 200 ||
        ![200, 202].includes(document.observations.customerDeleteHttpStatus) ||
        document.observations.customerReadAfterDeleteHttpStatus !== 404 ||
        document.observations.fullFamilyAbsenceReconciled !== true ||
        document.observations.legacyCustomerInfoReadHttpStatus !== 200
      ) {
        errors.push(
          'RevenueCat access evidence observations do not record the required V2 Bearer project/delete/full-family sequence and legacy V1 CustomerInfo read.',
        );
      }
      if (!canonicalIsoTimestamp(document.reviewedAt)) {
        errors.push('RevenueCat V2 access evidence reviewedAt must be a canonical UTC timestamp.');
      } else {
        const reviewedAtMs = Date.parse(document.reviewedAt);
        if (reviewedAtMs > input.nowMs + MAX_FUTURE_SKEW_MS) {
          errors.push('RevenueCat V2 access evidence reviewedAt is too far in the future.');
        }
        if (reviewedAtMs < input.nowMs - MAX_REVIEW_AGE_MS) {
          errors.push('RevenueCat V2 access evidence is older than the seven-day launch window.');
        }
      }
      if (!safeReviewedBy(document.reviewedBy) || document.reviewedBy !== input.signedOffBy) {
        errors.push(
          'RevenueCat V2 access evidence reviewedBy does not match PHASE6_SIGNED_OFF_BY.',
        );
      }
    }
  }

  const reviewerSecretTainted =
    typeof document?.reviewedBy === 'string' &&
    ((input.v2SecretKey.length >= 8 && document.reviewedBy.includes(input.v2SecretKey)) ||
      (input.legacySecretKey.length >= 8 && document.reviewedBy.includes(input.legacySecretKey)) ||
      /(?:sk_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9_-]{8,}|bearer\s)/i.test(document.reviewedBy));
  const reviewedBySafe =
    safeReviewedBy(document?.reviewedBy) &&
    document.reviewedBy === input.signedOffBy &&
    !reviewerSecretTainted;

  return freezeResult({
    valid: errors.length === 0,
    path: normalizedPath,
    artifactSha256,
    projectId: /^proj[A-Za-z0-9]{5,251}$/.test(input.projectId) ? input.projectId : '',
    legacyV1SecretKeyFingerprintSha256: expectedLegacyFingerprint,
    v2SecretKeyFingerprintSha256: expectedFingerprint,
    reviewedAt: canonicalIsoTimestamp(document?.reviewedAt) ? document.reviewedAt : '',
    reviewedBy: reviewedBySafe ? document.reviewedBy : '',
    errors,
  });
}
