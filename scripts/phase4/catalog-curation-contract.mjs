import { createPublicKey, verify as verifyCryptographicSignature } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  canonicalJson,
  catalogTrustRootFromEnvironment,
  parseCatalogEvidenceJson,
  sha256,
  validateCatalogSourceTrustRegistry,
  writeJsonAtomically,
} from './source-policy.mjs';

export const CATALOG_TARGET_POLICY_CONTRACT_ID = 'catalog-launch-target-policy-v1';
export const CATALOG_BETA_CORPUS_CONTRACT_ID = 'catalog-beta-shelf-corpus-v1';
export const CATALOG_CURATION_REVIEW_CONTRACT_ID = 'catalog-curation-review-v1';
export const CATALOG_CURATION_ENVELOPE_CONTRACT_ID = 'catalog-curation-evidence-envelope-v1';
export const CATALOG_CURATION_REPORT_CONTRACT_ID = 'catalog-launch-curation-report-v1';
export const CATALOG_DATABASE_READBACK_CONTRACT_ID = 'catalog-curation-database-readback-v1';
export const CATALOG_PREHOLDOUT_DECISION_CONTRACT_ID =
  'catalog-curation-preholdout-decision-commitment-v1';
export const CATALOG_CAT02_MEMBERSHIP_PROOF_CONTRACT_ID =
  'catalog-cat02-curation-membership-proof-v1';
export const CATALOG_HOLDOUT_CONTROL_RECEIPT_CONTRACT_ID =
  'catalog-holdout-custody-evaluation-receipt-v1';
export const CATALOG_PRIVACY_EXECUTION_RECEIPT_CONTRACT_ID = 'catalog-privacy-execution-receipt-v1';
export const CATALOG_TARGET_SIGNATURE_ENVELOPE = 'catalog-launch-target-policy-signature-v1';
export const CATALOG_CURATION_SIGNATURE_ENVELOPE = 'catalog-curation-review-signature-v1';
export const CATALOG_DATABASE_READBACK_SIGNATURE_ENVELOPE =
  'catalog-curation-database-readback-signature-v1';
export const CATALOG_PREHOLDOUT_DECISION_SIGNATURE_ENVELOPE =
  'catalog-curation-preholdout-decision-signature-v1';
export const CATALOG_CAT02_MEMBERSHIP_PROOF_SIGNATURE_ENVELOPE =
  'catalog-cat02-curation-membership-proof-signature-v1';
export const CATALOG_HOLDOUT_CONTROL_SIGNATURE_ENVELOPE =
  'catalog-holdout-custody-evaluation-receipt-signature-v1';
export const CATALOG_PRIVACY_EXECUTION_SIGNATURE_ENVELOPE =
  'catalog-privacy-execution-receipt-signature-v1';
export const CATALOG_TARGET_SIGNING_DOMAIN = 'layerwell.catalog-launch-target-policy.v1';
export const CATALOG_CURATION_SIGNING_DOMAIN = 'layerwell.catalog-curation-review.v1';
export const CATALOG_DATABASE_READBACK_SIGNING_DOMAIN =
  'layerwell.catalog-curation-database-readback.v1';
export const CATALOG_PREHOLDOUT_DECISION_SIGNING_DOMAIN =
  'layerwell.catalog-curation-preholdout-decision.v1';
export const CATALOG_CAT02_MEMBERSHIP_PROOF_SIGNING_DOMAIN =
  'layerwell.catalog-cat02-curation-membership-proof.v1';
export const CATALOG_HOLDOUT_CONTROL_SIGNING_DOMAIN =
  'layerwell.catalog-holdout-custody-evaluation-receipt.v1';
export const CATALOG_PRIVACY_EXECUTION_SIGNING_DOMAIN =
  'layerwell.catalog-privacy-execution-receipt.v1';
export const CATALOG_ACTIVATION_AUTHORIZATION_SIGNATURE_ENVELOPE =
  'catalog-curation-activation-authorization-signature-v1';
export const CATALOG_ACTIVATION_AUTHORIZATION_SIGNING_DOMAIN =
  'layerwell.catalog-curation-activation-authorization.v1';
export const CATALOG_DATABASE_REVIEW_SIGNATURE_ENVELOPE =
  'catalog-curation-database-review-authorization-signature-v1';
export const CATALOG_DATABASE_REVIEW_SIGNING_DOMAIN =
  'layerwell.catalog-curation-database-review-authorization.v1';
export const CATALOG_EXTERNAL_TIMESTAMP_SIGNATURE_ENVELOPE =
  'catalog-curation-external-timestamp-receipt-signature-v1';
export const CATALOG_EXTERNAL_TIMESTAMP_SIGNING_DOMAIN =
  'layerwell.catalog-curation-external-timestamp-receipt.v1';
export const CATALOG_CURATION_DECISION_COMMITMENT_ID = 'catalog-curation-decision-commitment-v1';
export const CATALOG_CURATION_CANDIDATE_SET_ID = 'catalog-curation-candidate-set-v1';
export const CATALOG_DB_ELIGIBILITY_POLICY_ID = 'catalog-launch-db-eligibility-policy-v1';
export const CATALOG_DB_ELIGIBILITY_POLICY_GOLDEN_CANONICAL_JSON =
  '{"contractId":"catalog-launch-db-eligibility-policy-v1","minimumBarcodeQualityScore":95.00,"minimumCategoryQualityScore":95.00,"minimumDataQualityScore":95.00,"minimumIngredientQualityScore":95.00,"minimumMappedIngredientCount":1,"minimumParseConfidence":0.9800,"minimumTokenMatchConfidence":0.9800,"regulatedCategoryMode":"qualified-review-required","requireBarcode":true,"requiredQualityGrade":"verified","territory":"US"}';
export const CATALOG_DB_ELIGIBILITY_POLICY_GOLDEN_SHA256 =
  '9b1fd33edaec8cf3c8582f3f9298ec9e70f5f4140b6426afb1e710eee4845e9d';
export const CATALOG_CURATION_REQUIRED_SCHEMA_MIGRATION_VERSION = '20260722000062';
export const CATALOG_CURATION_REQUIRED_MIGRATION_SHA256 = sha256(
  readFileSync(
    new URL(
      '../../supabase/migrations/20260722000062_catalog_curation_statement_guard.sql',
      import.meta.url,
    ),
  ),
);
export const CATALOG_CURATION_REQUIRED_DATABASE_CONTRACT_TEST_SHA256 = sha256(
  readFileSync(
    new URL('../../supabase/tests/database/catalog_launch_curation.test.sql', import.meta.url),
  ),
);
export const CATALOG_CURATION_REVIEWED_RECORD_AUTHORITY_ID =
  'catalog-launch-curation-offline-reviewed-record-authority-v1';
export const CATALOG_CURATION_REVIEWED_RECORD_MAPPING_ID =
  'catalog-launch-curation-reviewed-record-mapping-v1';
export const CATALOG_CURATION_CAMPAIGN_AUTHORITY_ID =
  'catalog-launch-curation-campaign-authority-v1';
export const CATALOG_CURATION_ACTIVATION_AUTHORIZATION_ID =
  'catalog-launch-curation-activation-authorization-v1';
export const CATALOG_CURATION_ACTIVATION_AUTHORIZATION_SET_ID =
  'catalog-launch-curation-activation-authorization-set-v1';
export const CATALOG_CURATION_OUTCOME_REVIEWER_SIGNATURE_SET_ID =
  'catalog-curation-outcome-reviewer-signature-set-v1';
export const CATALOG_SERVED_STATE_MUTATION_ROOT_SET_ID =
  'catalog-launch-curation-served-state-mutation-root-set-v1';
export const CATALOG_CAT02_MEMBERSHIP_SET_ID = 'catalog-curation-cat02-membership-set-v1';
export const CATALOG_DATABASE_RECORD_SET_ID = 'catalog-launch-curation-database-record-set-v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/u;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const PLACEHOLDER_PATTERN =
  /(?:^|[._:-])(?:example|fixture|placeholder|replace|sample|test|todo|tbd|unknown)(?:$|[._:-])/iu;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const MAX_CONTROL_BYTES = 32 * 1024 * 1024;
const MAX_BUCKETS = 100_000;
const MAX_RECORDS = 100_000;
const MAX_DEPENDENCY_MEMBERSHIPS_PER_RECORD = 512;
const ALLOWED_TERRITORIES = new Set(['US']);
const CATEGORY_CODES = new Set([
  'acne_treatment',
  'cleanser',
  'moisturizer',
  'other',
  'serum',
  'sunscreen',
  'toner',
]);
const DEMAND_REASON_CODES = new Set([
  'lookup_no_match',
  'lookup_wrong_match',
  'recommendation_expected',
  'shelf_present',
]);
const SUPPRESSION_KINDS = new Set(['none', 'primary_small_cell', 'complementary']);
const OPERATIONAL_STRATUM_KEYS = Object.freeze([
  'barcode:offline',
  'barcode:online',
  'manual_recovery:offline',
  'search_ocr:online',
]);
const INTAKE_ROUTE_CODES = new Set(['barcode', 'manual_recovery', 'search_ocr']);
const NETWORK_STATES = new Set(['offline', 'online']);
const PRODUCT_CLASSES = new Set(['cosmetic', 'otc_drug', 'combination_cosmetic_drug']);
const DEPENDENCY_FIELD_SCOPES = new Set([
  'barcode_identity',
  'category',
  'ingredients',
  'regulatory_classification',
]);
const LINEAGE_KEYS = Object.freeze([
  'cat01PolicySha256',
  'cat01TrustRegistrySha256',
  'cat01ApprovalSetSha256',
  'cat02StageEnvelopeSha256',
  'cat02DatabaseReceiptCompletionSha256',
  'cat02PromotionReceiptSha256',
  'cat02QaReportSha256',
  'buildSourceGitSha',
]);
const SIGNER_KEYS = Object.freeze([
  'decisionRole',
  'reviewerId',
  'trustRegistryKeyId',
  'trustRegistryRole',
  'independenceGroup',
  'publicKeySha256',
  'qualificationEvidenceSha256',
]);
const SIGNATURE_KEYS = Object.freeze([
  'decisionRole',
  'reviewerId',
  'trustRegistryKeyId',
  'algorithm',
  'signedAt',
  'valueBase64',
]);

function fail(message) {
  throw new Error(`CAT-03 catalog curation contract rejected input: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, keys, label) {
  if (!isObject(value)) fail(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} has missing or unknown fields (expected: ${expected.join(', ')}).`);
  }
}

function assertArray(value, label, { min = 0, max = MAX_RECORDS } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${label} must contain between ${min} and ${max} entries.`);
  }
}

function assertInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer between ${min} and ${max}.`);
  }
}

function assertBoolean(value, expected, label) {
  if (value !== expected) fail(`${label} must be exactly ${String(expected)}.`);
}

function assertId(value, label) {
  if (
    typeof value !== 'string' ||
    !ID_PATTERN.test(value) ||
    PLACEHOLDER_PATTERN.test(value) ||
    CONTROL_PATTERN.test(value)
  ) {
    fail(`${label} must be a non-placeholder lowercase stable identifier.`);
  }
}

function assertKeyId(value, label) {
  if (
    typeof value !== 'string' ||
    !KEY_ID_PATTERN.test(value) ||
    PLACEHOLDER_PATTERN.test(value) ||
    CONTROL_PATTERN.test(value)
  ) {
    fail(`${label} must be a non-placeholder stable trust key identifier.`);
  }
}

function assertDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value) || new Set(value).size < 2) {
    fail(`${label} must be a non-placeholder lowercase SHA-256 digest.`);
  }
}

function assertGitSha(value, label) {
  if (typeof value !== 'string' || !GIT_SHA_PATTERN.test(value) || new Set(value).size < 2) {
    fail(`${label} must be a non-placeholder lowercase 40-character Git commit SHA.`);
  }
}

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    fail(`${label} must be a canonical lowercase UUID.`);
  }
}

function assertTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !RFC3339_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value
  ) {
    fail(`${label} must be a strict valid UTC RFC3339 instant with milliseconds.`);
  }
}

function timestamp(value) {
  return Date.parse(value);
}

function assertSortedUniqueStrings(value, label, allowed, { min = 1, max = 32 } = {}) {
  assertArray(value, label, { min, max });
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !allowed.has(entry)) {
      fail(`${label}[${index}] is not an allowed value.`);
    }
  }
  const sorted = [...value].sort((left, right) => left.localeCompare(right, 'en-US'));
  if (new Set(value).size !== value.length || canonicalJson(sorted) !== canonicalJson(value)) {
    fail(`${label} must be unique and lexicographically sorted.`);
  }
}

function assertCanonicalBase64Signature(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) {
    fail(`${label} must be canonical base64.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== value) {
    fail(`${label} must encode exactly one canonical 64-byte Ed25519 signature.`);
  }
  return bytes;
}

function assertCanonicalEqual(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} does not exactly match its signed authority.`);
  }
}

function validateLineage(lineage, label) {
  assertExactKeys(lineage, LINEAGE_KEYS, label);
  for (const key of LINEAGE_KEYS) {
    if (key === 'buildSourceGitSha') assertGitSha(lineage[key], `${label}.${key}`);
    else assertDigest(lineage[key], `${label}.${key}`);
  }
  return lineage;
}

function validateSignerDescriptor(signer, label, expectedRole, expectedTrustRole) {
  assertExactKeys(signer, SIGNER_KEYS, label);
  if (signer.decisionRole !== expectedRole) fail(`${label}.decisionRole is invalid.`);
  assertId(signer.reviewerId, `${label}.reviewerId`);
  assertKeyId(signer.trustRegistryKeyId, `${label}.trustRegistryKeyId`);
  if (signer.trustRegistryRole !== expectedTrustRole) {
    fail(`${label}.trustRegistryRole must be ${expectedTrustRole}.`);
  }
  assertId(signer.independenceGroup, `${label}.independenceGroup`);
  assertDigest(signer.publicKeySha256, `${label}.publicKeySha256`);
  assertDigest(signer.qualificationEvidenceSha256, `${label}.qualificationEvidenceSha256`);
}

function signaturePayload(document, signature, { envelopeVersion, signingDomain }) {
  const unsigned = { ...document };
  delete unsigned.signatures;
  return Buffer.from(
    canonicalJson({
      signatureEnvelopeVersion: envelopeVersion,
      signingDomain,
      decisionRole: signature.decisionRole,
      reviewerId: signature.reviewerId,
      trustRegistryKeyId: signature.trustRegistryKeyId,
      signedAt: signature.signedAt,
      document: unsigned,
    }),
    'utf8',
  );
}

export function catalogTargetPolicySigningPayload(policy, signature) {
  return signaturePayload(policy, signature, {
    envelopeVersion: CATALOG_TARGET_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_TARGET_SIGNING_DOMAIN,
  });
}

export function catalogCurationReviewSigningPayload(review, signature) {
  // Reviewers seal the decision and activation intent first. The exact four-
  // signature root, derived request set, operator signature, and DB plan are
  // downstream artifacts and are deliberately excluded to avoid a hash cycle.
  const approvalDocument = structuredClone(review);
  delete approvalDocument.signatures;
  delete approvalDocument.curationOutcomeReviewerSignatureSetSha256;
  delete approvalDocument.databaseCampaignPlan;
  delete approvalDocument.databaseCampaignPlanSha256;
  approvalDocument.activation = {
    decision: review.activation.decision,
    operator: review.activation.operator,
    plannedAt: review.activation.plannedAt,
    operationKeyPrefix: review.activation.operationKeyPrefix,
    reasonCode: review.activation.reasonCode,
  };
  return Buffer.from(
    canonicalJson({
      signatureEnvelopeVersion: CATALOG_CURATION_SIGNATURE_ENVELOPE,
      signingDomain: CATALOG_CURATION_SIGNING_DOMAIN,
      decisionRole: signature.decisionRole,
      reviewerId: signature.reviewerId,
      trustRegistryKeyId: signature.trustRegistryKeyId,
      signedAt: signature.signedAt,
      document: approvalDocument,
    }),
    'utf8',
  );
}

export function catalogDatabaseReadbackSigningPayload(receipt, signature) {
  return signaturePayload(receipt, signature, {
    envelopeVersion: CATALOG_DATABASE_READBACK_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_DATABASE_READBACK_SIGNING_DOMAIN,
  });
}

export function catalogPreholdoutDecisionSigningPayload(authority, signature) {
  return signaturePayload(authority, signature, {
    envelopeVersion: CATALOG_PREHOLDOUT_DECISION_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_PREHOLDOUT_DECISION_SIGNING_DOMAIN,
  });
}

export function catalogCat02MembershipProofSigningPayload(proof, signature) {
  return signaturePayload(proof, signature, {
    envelopeVersion: CATALOG_CAT02_MEMBERSHIP_PROOF_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_CAT02_MEMBERSHIP_PROOF_SIGNING_DOMAIN,
  });
}

export function catalogHoldoutControlReceiptSigningPayload(receipt, signature) {
  return signaturePayload(receipt, signature, {
    envelopeVersion: CATALOG_HOLDOUT_CONTROL_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_HOLDOUT_CONTROL_SIGNING_DOMAIN,
  });
}

export function catalogPrivacyExecutionReceiptSigningPayload(receipt, signature) {
  return signaturePayload(receipt, signature, {
    envelopeVersion: CATALOG_PRIVACY_EXECUTION_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_PRIVACY_EXECUTION_SIGNING_DOMAIN,
  });
}

export function catalogActivationAuthorizationSigningPayload(review, signature) {
  return Buffer.from(
    canonicalJson({
      signatureEnvelopeVersion: CATALOG_ACTIVATION_AUTHORIZATION_SIGNATURE_ENVELOPE,
      signingDomain: CATALOG_ACTIVATION_AUTHORIZATION_SIGNING_DOMAIN,
      decisionRole: signature.decisionRole,
      reviewerId: signature.reviewerId,
      trustRegistryKeyId: signature.trustRegistryKeyId,
      signedAt: signature.signedAt,
      document: {
        contractId: 'catalog-curation-activation-authorization-signature-payload-v1',
        releaseId: review.releaseId,
        campaignAuthoritySha256: catalogCurationCampaignAuthoritySha256(review),
        curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
        activationAuthorizationSetSha256: catalogCurationActivationAuthorizationSetSha256(review),
        activationDecision: review.activation.decision,
        plannedAt: review.activation.plannedAt,
      },
    }),
    'utf8',
  );
}

export function catalogDatabaseReviewAuthorizationSigningPayload(authorization, signature) {
  return signaturePayload(authorization, signature, {
    envelopeVersion: CATALOG_DATABASE_REVIEW_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_DATABASE_REVIEW_SIGNING_DOMAIN,
  });
}

export function catalogExternalTimestampReceiptSigningPayload(authority, signature) {
  return Buffer.from(
    canonicalJson({
      signatureEnvelopeVersion: CATALOG_EXTERNAL_TIMESTAMP_SIGNATURE_ENVELOPE,
      signingDomain: CATALOG_EXTERNAL_TIMESTAMP_SIGNING_DOMAIN,
      decisionRole: signature.decisionRole,
      reviewerId: signature.reviewerId,
      trustRegistryKeyId: signature.trustRegistryKeyId,
      signedAt: signature.signedAt,
      document: authority.externalWitnessReceipt,
    }),
    'utf8',
  );
}

function assertScaledDecimal(value, label, { scale, min, max }) {
  const multiplier = 10 ** scale;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    !Number.isSafeInteger(Math.round(value * multiplier)) ||
    Math.abs(value * multiplier - Math.round(value * multiplier)) > 1e-8
  ) {
    fail(`${label} must be a finite decimal from ${min} to ${max} with at most ${scale} places.`);
  }
}

export function validateCatalogDbEligibilityPolicy(policy) {
  assertExactKeys(
    policy,
    [
      'contractId',
      'territory',
      'requiredQualityGrade',
      'minimumDataQualityScore',
      'minimumIngredientQualityScore',
      'minimumBarcodeQualityScore',
      'minimumCategoryQualityScore',
      'minimumParseConfidence',
      'minimumTokenMatchConfidence',
      'minimumMappedIngredientCount',
      'requireBarcode',
      'regulatedCategoryMode',
    ],
    'target policy.databaseEligibilityPolicy',
  );
  if (
    policy.contractId !== CATALOG_DB_ELIGIBILITY_POLICY_ID ||
    policy.territory !== 'US' ||
    !['verified', 'usable'].includes(policy.requiredQualityGrade) ||
    policy.requireBarcode !== true ||
    policy.regulatedCategoryMode !== 'qualified-review-required'
  ) {
    fail('target database eligibility policy does not match the exact 0058 vocabulary.');
  }
  for (const key of [
    'minimumDataQualityScore',
    'minimumIngredientQualityScore',
    'minimumBarcodeQualityScore',
    'minimumCategoryQualityScore',
  ]) {
    assertScaledDecimal(policy[key], `target policy.databaseEligibilityPolicy.${key}`, {
      scale: 2,
      min: 90,
      max: 100,
    });
  }
  for (const key of ['minimumParseConfidence', 'minimumTokenMatchConfidence']) {
    assertScaledDecimal(policy[key], `target policy.databaseEligibilityPolicy.${key}`, {
      scale: 4,
      min: 0.95,
      max: 1,
    });
  }
  assertInteger(
    policy.minimumMappedIngredientCount,
    'target policy.databaseEligibilityPolicy.minimumMappedIngredientCount',
    { min: 1, max: 1_000 },
  );
  return policy;
}

export function catalogDbEligibilityPolicyCanonicalJson(policy) {
  validateCatalogDbEligibilityPolicy(policy);
  const text = (value) => JSON.stringify(value);
  return [
    '{',
    `"contractId":${text(policy.contractId)},`,
    `"minimumBarcodeQualityScore":${policy.minimumBarcodeQualityScore.toFixed(2)},`,
    `"minimumCategoryQualityScore":${policy.minimumCategoryQualityScore.toFixed(2)},`,
    `"minimumDataQualityScore":${policy.minimumDataQualityScore.toFixed(2)},`,
    `"minimumIngredientQualityScore":${policy.minimumIngredientQualityScore.toFixed(2)},`,
    `"minimumMappedIngredientCount":${policy.minimumMappedIngredientCount},`,
    `"minimumParseConfidence":${policy.minimumParseConfidence.toFixed(4)},`,
    `"minimumTokenMatchConfidence":${policy.minimumTokenMatchConfidence.toFixed(4)},`,
    `"regulatedCategoryMode":${text(policy.regulatedCategoryMode)},`,
    `"requireBarcode":true,`,
    `"requiredQualityGrade":${text(policy.requiredQualityGrade)},`,
    `"territory":${text(policy.territory)}`,
    '}',
  ].join('');
}

export function catalogDbEligibilityPolicySha256(policy) {
  return sha256(Buffer.from(catalogDbEligibilityPolicyCanonicalJson(policy), 'utf8'));
}

function validateTrustRegistry(registry, registrySha256, trustedRoot, now) {
  assertDigest(registrySha256, 'trust registry artifact SHA-256');
  const errors = validateCatalogSourceTrustRegistry(registry, {
    now,
    registrySha256,
    requireActive: true,
    trustedRoot,
  });
  if (errors.length > 0)
    fail(`trust registry is not current active authority: ${errors.join(' ')}`);
}

function trustedSigner(signer, signature, trustRegistry, label) {
  const trusted = trustRegistry.reviewers.find(
    (entry) => entry.keyId === signer.trustRegistryKeyId,
  );
  if (
    !trusted ||
    trusted.status !== 'active' ||
    trusted.reviewerId !== signer.reviewerId ||
    trusted.role !== signer.trustRegistryRole ||
    trusted.independenceGroup !== signer.independenceGroup ||
    trusted.publicKeySha256 !== signer.publicKeySha256 ||
    trusted.evidence?.sha256 !== signer.qualificationEvidenceSha256
  ) {
    fail(`${label} does not exactly match an active trust-registry identity and credential.`);
  }
  if (trusted.validFrom && timestamp(signature.signedAt) < timestamp(trusted.validFrom)) {
    fail(`${label} signed before its trust key became valid.`);
  }
  if (trusted.validUntil && timestamp(signature.signedAt) >= timestamp(trusted.validUntil)) {
    fail(`${label} signed after its trust key expired.`);
  }
  let publicKeyBytes;
  let publicKey;
  try {
    publicKeyBytes = Buffer.from(trusted.publicKeySpkiBase64, 'base64');
    if (
      publicKeyBytes.length === 0 ||
      publicKeyBytes.toString('base64') !== trusted.publicKeySpkiBase64 ||
      sha256(publicKeyBytes) !== signer.publicKeySha256
    ) {
      throw new Error('encoding/fingerprint mismatch');
    }
    publicKey = createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
    if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('not Ed25519');
  } catch {
    fail(`${label} has an invalid trusted Ed25519 public key.`);
  }
  return publicKey;
}

function validateSignedRoles({
  document,
  signers,
  signatures,
  requiredRoles,
  trustRegistry,
  payload,
  earliestSignedAt,
  latestSignedAt,
  label,
}) {
  assertArray(signers, `${label} signers`, {
    min: requiredRoles.length,
    max: requiredRoles.length,
  });
  assertArray(signatures, `${label} signatures`, {
    min: requiredRoles.length,
    max: requiredRoles.length,
  });
  const signerByRole = new Map();
  const signatureByRole = new Map();
  for (const [index, required] of requiredRoles.entries()) {
    const signer = signers[index];
    validateSignerDescriptor(
      signer,
      `${label} signers[${index}]`,
      required.decisionRole,
      required.trustRegistryRole,
    );
    signerByRole.set(required.decisionRole, signer);
  }
  for (const [index, signature] of signatures.entries()) {
    assertExactKeys(signature, SIGNATURE_KEYS, `${label} signatures[${index}]`);
    const required = requiredRoles[index];
    if (signature.decisionRole !== required.decisionRole || signature.algorithm !== 'Ed25519') {
      fail(`${label} signatures must exactly follow the required decision-role order.`);
    }
    assertId(signature.reviewerId, `${label} signatures[${index}].reviewerId`);
    assertKeyId(signature.trustRegistryKeyId, `${label} signatures[${index}].trustRegistryKeyId`);
    assertTimestamp(signature.signedAt, `${label} signatures[${index}].signedAt`);
    if (
      (earliestSignedAt && timestamp(signature.signedAt) < timestamp(earliestSignedAt)) ||
      (latestSignedAt && timestamp(signature.signedAt) > timestamp(latestSignedAt))
    ) {
      fail(`${label} signature time is outside the permitted decision window.`);
    }
    const signer = signerByRole.get(signature.decisionRole);
    if (
      signature.reviewerId !== signer.reviewerId ||
      signature.trustRegistryKeyId !== signer.trustRegistryKeyId
    ) {
      fail(`${label} signature identity/key does not match its signed signer snapshot.`);
    }
    signatureByRole.set(signature.decisionRole, signature);
    const signatureBytes = assertCanonicalBase64Signature(
      signature.valueBase64,
      `${label} signatures[${index}].valueBase64`,
    );
    const publicKey = trustedSigner(
      signer,
      signature,
      trustRegistry,
      `${label} ${signer.reviewerId}`,
    );
    if (
      !verifyCryptographicSignature(null, payload(document, signature), publicKey, signatureBytes)
    ) {
      fail(`${label} ${signer.reviewerId} signature does not authorize the exact document.`);
    }
  }
  if (signerByRole.size !== requiredRoles.length || signatureByRole.size !== requiredRoles.length) {
    fail(`${label} roles must be present exactly once.`);
  }
  const identities = signers.map((entry) => entry.reviewerId.toLowerCase());
  const keys = signers.map((entry) => entry.trustRegistryKeyId.toLowerCase());
  const groups = signers.map((entry) => entry.independenceGroup.toLowerCase());
  const publicKeys = signers.map((entry) => entry.publicKeySha256);
  for (const [values, name] of [
    [identities, 'identities'],
    [keys, 'trust keys'],
    [groups, 'independence groups'],
    [publicKeys, 'public keys'],
  ]) {
    if (new Set(values).size !== values.length) {
      fail(`${label} requires independent ${name} for every decision role.`);
    }
  }
  return { signerByRole, signatureByRole };
}

function signerIdentityValues(signer) {
  return [
    `reviewer:${signer.reviewerId.toLowerCase()}`,
    `key:${signer.trustRegistryKeyId.toLowerCase()}`,
    `group:${signer.independenceGroup.toLowerCase()}`,
    `public:${signer.publicKeySha256}`,
  ];
}

function assertSignerIndependentFrom(signer, priorSigners, label) {
  const occupied = new Set(priorSigners.flatMap(signerIdentityValues));
  if (signerIdentityValues(signer).some((value) => occupied.has(value))) {
    fail(`${label} must be independent by identity, key, group, and public key.`);
  }
}

function validateTargetPrivacy(privacy, label) {
  assertExactKeys(
    privacy,
    [
      'consentPurpose',
      'consentVersionSha256',
      'noticeSha256',
      'queryDefinitionSha256',
      'retentionPolicySha256',
      'deletionWorkflowSha256',
      'aggregateReleaseRegistrySha256',
      'overlapPolicySha256',
      'cohortWindowQueryReleaseKeyCommitmentSha256',
      'productDemandCommitmentMethod',
      'productDemandCommitmentKeyEpochId',
      'productDemandCommitmentKeyReceiptSha256',
      'productDemandCommitmentImplementationSha256',
      'productDemandCanonicalInputDefinitionSha256',
      'productDemandDomainSeparationContextSha256',
      'suppressionAuditPolicySha256',
      'releaseRegistryContractSha256',
      'rawShelfDataTracked',
      'rawUserIdentifiersTracked',
      'rawBarcodesTracked',
      'rawProductNamesTracked',
      'rawFreeTextTracked',
      'minCellSize',
      'complementarySuppression',
      'maxContributionsPerParticipantSku',
    ],
    label,
  );
  if (privacy.consentPurpose !== 'optional_catalog_coverage_curation') {
    fail(`${label}.consentPurpose is invalid.`);
  }
  for (const key of [
    'consentVersionSha256',
    'noticeSha256',
    'queryDefinitionSha256',
    'retentionPolicySha256',
    'deletionWorkflowSha256',
    'aggregateReleaseRegistrySha256',
    'overlapPolicySha256',
    'cohortWindowQueryReleaseKeyCommitmentSha256',
    'productDemandCommitmentKeyReceiptSha256',
    'productDemandCommitmentImplementationSha256',
    'productDemandCanonicalInputDefinitionSha256',
    'productDemandDomainSeparationContextSha256',
    'suppressionAuditPolicySha256',
    'releaseRegistryContractSha256',
  ]) {
    assertDigest(privacy[key], `${label}.${key}`);
  }
  assertId(privacy.productDemandCommitmentKeyEpochId, `${label}.productDemandCommitmentKeyEpochId`);
  if (
    privacy.productDemandCommitmentMethod !==
    'hmac_sha256_secret_epoch_key_domain_separated_by_release_and_cohort'
  ) {
    fail(
      `${label}.productDemandCommitmentMethod must use a secret epoch-keyed, release/cohort-domain-separated HMAC.`,
    );
  }
  for (const key of [
    'rawShelfDataTracked',
    'rawUserIdentifiersTracked',
    'rawBarcodesTracked',
    'rawProductNamesTracked',
    'rawFreeTextTracked',
  ]) {
    assertBoolean(privacy[key], false, `${label}.${key}`);
  }
  assertInteger(privacy.minCellSize, `${label}.minCellSize`, { min: 5, max: 50 });
  assertBoolean(privacy.complementarySuppression, true, `${label}.complementarySuppression`);
  if (privacy.maxContributionsPerParticipantSku !== 1) {
    fail(`${label}.maxContributionsPerParticipantSku must be exactly 1.`);
  }
}

function validateTargetDefinitions(targets) {
  assertExactKeys(
    targets,
    [
      'confidenceMethod',
      'confidenceLevelBasisPoints',
      'zScoreMillionths',
      'minimumParticipants',
      'minimumContributors',
      'minimumDenominators',
      'minimumDistinctDemandDigests',
      'minimumCategoryDenominators',
      'minimumOperationalStratumDenominators',
      'inventory',
      'thresholdsBasisPoints',
      'zeroTolerance',
      'requiredCategoryCodes',
      'requiredOperationalStrata',
    ],
    'target policy.targets',
  );
  if (
    targets.confidenceMethod !== 'wilson_score_one_sided' ||
    targets.confidenceLevelBasisPoints !== 9500 ||
    targets.zScoreMillionths !== 1_644_854
  ) {
    fail('target policy confidence method must be the fixed one-sided 95% Wilson contract.');
  }
  assertExactKeys(
    targets.minimumParticipants,
    ['curation', 'holdout'],
    'target policy.targets.minimumParticipants',
  );
  assertInteger(targets.minimumParticipants.curation, 'minimum curation participants', {
    min: 20,
    max: 1_000_000,
  });
  assertInteger(targets.minimumParticipants.holdout, 'minimum holdout participants', {
    min: 20,
    max: 1_000_000,
  });
  assertExactKeys(
    targets.minimumContributors,
    ['curation', 'holdout'],
    'target policy.targets.minimumContributors',
  );
  for (const cohortName of ['curation', 'holdout']) {
    assertInteger(
      targets.minimumContributors[cohortName],
      `target policy.targets.minimumContributors.${cohortName}`,
      { min: 20, max: 1_000_000 },
    );
    if (targets.minimumContributors[cohortName] !== targets.minimumParticipants[cohortName]) {
      fail('target policy contributor floors must equal participant floors for both cohorts.');
    }
  }
  assertExactKeys(
    targets.minimumDenominators,
    [
      'holdoutLookupEvaluations',
      'holdoutMatchedEvaluations',
      'holdoutIngredientEvaluations',
      'holdoutRecommendationEvaluations',
      'holdoutManualFallbackEvaluations',
      'holdoutShelfFlowEvaluations',
    ],
    'target policy.targets.minimumDenominators',
  );
  const denominatorHardFloors = {
    holdoutLookupEvaluations: 200,
    holdoutMatchedEvaluations: 200,
    holdoutIngredientEvaluations: 300,
    holdoutRecommendationEvaluations: 100,
    holdoutManualFallbackEvaluations: 100,
    holdoutShelfFlowEvaluations: 100,
  };
  for (const [key, hardFloor] of Object.entries(denominatorHardFloors)) {
    assertInteger(
      targets.minimumDenominators[key],
      `target policy.targets.minimumDenominators.${key}`,
      { min: hardFloor, max: 100_000_000 },
    );
  }
  assertExactKeys(
    targets.minimumDistinctDemandDigests,
    ['curation', 'holdout'],
    'target policy.targets.minimumDistinctDemandDigests',
  );
  for (const [key, value] of Object.entries(targets.minimumDistinctDemandDigests)) {
    assertInteger(value, `target policy.targets.minimumDistinctDemandDigests.${key}`, {
      min: 1,
      max: MAX_BUCKETS,
    });
  }
  assertExactKeys(
    targets.minimumCategoryDenominators,
    [
      'lookupEvaluations',
      'matchedEvaluations',
      'ingredientEvaluations',
      'recommendationEvaluations',
    ],
    'target policy.targets.minimumCategoryDenominators',
  );
  for (const [key, value] of Object.entries(targets.minimumCategoryDenominators)) {
    assertInteger(value, `target policy.targets.minimumCategoryDenominators.${key}`, {
      min: 50,
      max: 100_000_000,
    });
  }
  assertExactKeys(
    targets.minimumOperationalStratumDenominators,
    ['manualFallbackEvaluations', 'shelfFlowEvaluations'],
    'target policy.targets.minimumOperationalStratumDenominators',
  );
  for (const [key, value] of Object.entries(targets.minimumOperationalStratumDenominators)) {
    assertInteger(value, `target policy.targets.minimumOperationalStratumDenominators.${key}`, {
      min: 50,
      max: 100_000_000,
    });
  }
  assertExactKeys(
    targets.inventory,
    [
      'minimumEligibleCatalogRecords',
      'minimumPrioritizedEligibleRecords',
      'minimumEligibleByRequiredCategory',
    ],
    'target policy.targets.inventory',
  );
  assertInteger(
    targets.inventory.minimumEligibleCatalogRecords,
    'target policy.targets.inventory.minimumEligibleCatalogRecords',
    { min: 2_000, max: MAX_RECORDS },
  );
  assertInteger(
    targets.inventory.minimumPrioritizedEligibleRecords,
    'target policy.targets.inventory.minimumPrioritizedEligibleRecords',
    { min: 100, max: MAX_RECORDS },
  );
  if (
    targets.inventory.minimumPrioritizedEligibleRecords >
    targets.inventory.minimumEligibleCatalogRecords
  ) {
    fail('prioritized eligible inventory floor cannot exceed the eligible catalog floor.');
  }
  assertExactKeys(
    targets.inventory.minimumEligibleByRequiredCategory,
    targets.requiredCategoryCodes,
    'target policy.targets.inventory.minimumEligibleByRequiredCategory',
  );
  let categoryInventoryFloor = 0;
  for (const categoryCode of targets.requiredCategoryCodes) {
    const value = targets.inventory.minimumEligibleByRequiredCategory[categoryCode];
    assertInteger(
      value,
      `target policy.targets.inventory.minimumEligibleByRequiredCategory.${categoryCode}`,
      { min: 1, max: MAX_RECORDS },
    );
    categoryInventoryFloor += value;
  }
  if (categoryInventoryFloor < targets.inventory.minimumEligibleCatalogRecords) {
    fail('required-category eligible inventory floors must cover the 2,000-record launch floor.');
  }
  if (categoryInventoryFloor > MAX_RECORDS) {
    fail('required-category eligible inventory floors exceed the bounded review-record maximum.');
  }
  assertExactKeys(
    targets.thresholdsBasisPoints,
    [
      'holdoutCorrectMatchLowerBoundMin',
      'holdoutWrongMatchUpperBoundMax',
      'holdoutUnknownTokenUpperBoundMax',
      'holdoutBelowUsableRecommendationUpperBoundMax',
      'holdoutManualFallbackCompletionLowerBoundMin',
      'holdoutShelfFlowCompletionLowerBoundMin',
    ],
    'target policy.targets.thresholdsBasisPoints',
  );
  for (const [key, value] of Object.entries(targets.thresholdsBasisPoints)) {
    assertInteger(value, `target policy.targets.thresholdsBasisPoints.${key}`, {
      min: 0,
      max: 10_000,
    });
  }
  if (
    targets.thresholdsBasisPoints.holdoutCorrectMatchLowerBoundMin < 9_000 ||
    targets.thresholdsBasisPoints.holdoutWrongMatchUpperBoundMax > 200 ||
    targets.thresholdsBasisPoints.holdoutUnknownTokenUpperBoundMax > 1_500 ||
    targets.thresholdsBasisPoints.holdoutBelowUsableRecommendationUpperBoundMax > 200 ||
    targets.thresholdsBasisPoints.holdoutManualFallbackCompletionLowerBoundMin < 8_000 ||
    targets.thresholdsBasisPoints.holdoutShelfFlowCompletionLowerBoundMin < 8_000
  ) {
    fail(
      'target policy cannot weaken the product-quality guardrails (these are product targets, not legal or Apple thresholds).',
    );
  }
  assertExactKeys(
    targets.zeroTolerance,
    ['belowUsableRecommendations', 'openWrongMatchReports', 'openP0P1Incidents'],
    'target policy.targets.zeroTolerance',
  );
  for (const [key, value] of Object.entries(targets.zeroTolerance)) {
    assertBoolean(value, true, `target policy.targets.zeroTolerance.${key}`);
  }
  assertSortedUniqueStrings(
    targets.requiredCategoryCodes,
    'target policy.targets.requiredCategoryCodes',
    CATEGORY_CODES,
  );
  const databaseRequiredCategories = [
    'acne_treatment',
    'cleanser',
    'moisturizer',
    'serum',
    'sunscreen',
    'toner',
  ];
  if (canonicalJson(targets.requiredCategoryCodes) !== canonicalJson(databaseRequiredCategories)) {
    fail(
      'target policy required categories must exactly match the 0058 six-category launch floor.',
    );
  }
  assertArray(
    targets.requiredOperationalStrata,
    'target policy.targets.requiredOperationalStrata',
    { min: OPERATIONAL_STRATUM_KEYS.length, max: OPERATIONAL_STRATUM_KEYS.length },
  );
  const operationalKeys = targets.requiredOperationalStrata.map((entry, index) => {
    const label = `target policy.targets.requiredOperationalStrata[${index}]`;
    assertExactKeys(entry, ['routeCode', 'networkState'], label);
    if (!INTAKE_ROUTE_CODES.has(entry.routeCode) || !NETWORK_STATES.has(entry.networkState)) {
      fail(`${label} route/network state is invalid.`);
    }
    return `${entry.routeCode}:${entry.networkState}`;
  });
  if (canonicalJson(operationalKeys) !== canonicalJson(OPERATIONAL_STRATUM_KEYS)) {
    fail('target policy operational strata must exactly match the fixed route/network launch set.');
  }
  const categoryCount = targets.requiredCategoryCodes.length;
  const operationalCount = targets.requiredOperationalStrata.length;
  const minimumIndependentHoldoutParticipants = Math.max(
    ...Object.values(targets.minimumCategoryDenominators).map((value) => value * categoryCount),
    ...Object.values(targets.minimumOperationalStratumDenominators).map(
      (value) => value * operationalCount,
    ),
    ...Object.values(targets.minimumDenominators),
  );
  if (targets.minimumParticipants.holdout < minimumIndependentHoldoutParticipants) {
    fail(
      'holdout participant floor must cover every disjoint participant-level endpoint stratum denominator.',
    );
  }
}

export function catalogDocumentSha256(value) {
  return sha256(Buffer.from(canonicalJson(value), 'utf8'));
}

export function validateCatalogTargetPolicy(policy, { trustRegistry } = {}) {
  assertExactKeys(
    policy,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'policyId',
      'authoredAt',
      'collectionWindow',
      'population',
      'sampling',
      'analysis',
      'split',
      'privacy',
      'lineage',
      'databaseEligibilityPolicy',
      'databaseEligibilityPolicySha256',
      'targets',
      'signers',
      'signatures',
    ],
    'target policy',
  );
  if (
    policy.schemaVersion !== 1 ||
    policy.contractId !== CATALOG_TARGET_POLICY_CONTRACT_ID ||
    policy.signatureEnvelopeVersion !== CATALOG_TARGET_SIGNATURE_ENVELOPE ||
    policy.signingDomain !== CATALOG_TARGET_SIGNING_DOMAIN
  ) {
    fail('target policy schema, contract, signature envelope, or signing domain is invalid.');
  }
  assertId(policy.policyId, 'target policy.policyId');
  assertTimestamp(policy.authoredAt, 'target policy.authoredAt');
  assertExactKeys(
    policy.collectionWindow,
    ['opensAt', 'closesAt'],
    'target policy.collectionWindow',
  );
  assertTimestamp(policy.collectionWindow.opensAt, 'target policy.collectionWindow.opensAt');
  assertTimestamp(policy.collectionWindow.closesAt, 'target policy.collectionWindow.closesAt');
  if (
    timestamp(policy.authoredAt) >= timestamp(policy.collectionWindow.opensAt) ||
    timestamp(policy.collectionWindow.opensAt) >= timestamp(policy.collectionWindow.closesAt) ||
    timestamp(policy.collectionWindow.closesAt) - timestamp(policy.collectionWindow.opensAt) >
      180 * 86_400_000
  ) {
    fail('target policy must be authored before a positive collection window of at most 180 days.');
  }
  assertExactKeys(
    policy.population,
    ['corpusType', 'inferenceScope', 'territories'],
    'target policy.population',
  );
  if (
    policy.population.corpusType !== 'consented_self_selected_beta_shelves' ||
    policy.population.inferenceScope !== 'defined_beta_shelf_coverage_corpus_only'
  ) {
    fail('target policy must not claim population or market representativeness.');
  }
  assertSortedUniqueStrings(
    policy.population.territories,
    'target policy.population.territories',
    ALLOWED_TERRITORIES,
  );
  assertExactKeys(
    policy.sampling,
    [
      'method',
      'populationRepresentativenessClaimed',
      'skuDefinition',
      'oneObservationPerParticipantSku',
      'wilsonEvaluationUnit',
      'maxWilsonEvaluationsPerParticipantPerEndpoint',
      'clusteredWilsonInputsAllowed',
    ],
    'target policy.sampling',
  );
  if (
    policy.sampling.method !== 'self_selected_non_probability' ||
    policy.sampling.skuDefinition !== 'gtin_market_formula_package_revision' ||
    policy.sampling.wilsonEvaluationUnit !== 'one_distinct_participant_per_endpoint' ||
    policy.sampling.maxWilsonEvaluationsPerParticipantPerEndpoint !== 1 ||
    policy.sampling.clusteredWilsonInputsAllowed !== false
  ) {
    fail(
      'target policy sampling method, SKU definition, or participant-level Wilson unit is invalid.',
    );
  }
  assertBoolean(
    policy.sampling.populationRepresentativenessClaimed,
    false,
    'target policy.sampling.populationRepresentativenessClaimed',
  );
  assertBoolean(
    policy.sampling.oneObservationPerParticipantSku,
    true,
    'target policy.sampling.oneObservationPerParticipantSku',
  );
  assertExactKeys(
    policy.analysis,
    [
      'analysisPlanSha256',
      'metricImplementationSha256',
      'collectionBuildSha256',
      'holdoutQuerySha256',
      'evaluationUnitDefinitionSha256',
      'allowedAnalysisLookCount',
      'priorHoldoutUseCount',
      'holdoutReuseAllowed',
      'alternativeBuildOrQueryLooksAllowed',
      'confidenceBoundsAreMarginalNotSimultaneous',
      'multipleComparisonDecisionRule',
    ],
    'target policy.analysis',
  );
  for (const key of [
    'analysisPlanSha256',
    'metricImplementationSha256',
    'collectionBuildSha256',
    'holdoutQuerySha256',
    'evaluationUnitDefinitionSha256',
  ]) {
    assertDigest(policy.analysis[key], `target policy.analysis.${key}`);
  }
  assertInteger(
    policy.analysis.allowedAnalysisLookCount,
    'target policy.analysis.allowedAnalysisLookCount',
    {
      min: 1,
      max: 1,
    },
  );
  assertInteger(
    policy.analysis.priorHoldoutUseCount,
    'target policy.analysis.priorHoldoutUseCount',
    {
      min: 0,
      max: 0,
    },
  );
  assertBoolean(
    policy.analysis.holdoutReuseAllowed,
    false,
    'target policy.analysis.holdoutReuseAllowed',
  );
  assertBoolean(
    policy.analysis.alternativeBuildOrQueryLooksAllowed,
    false,
    'target policy.analysis.alternativeBuildOrQueryLooksAllowed',
  );
  assertBoolean(
    policy.analysis.confidenceBoundsAreMarginalNotSimultaneous,
    true,
    'target policy.analysis.confidenceBoundsAreMarginalNotSimultaneous',
  );
  if (policy.analysis.multipleComparisonDecisionRule !== 'intersection_union_all_gates_must_pass') {
    fail('target policy analysis must use the predeclared all-gates intersection-union rule.');
  }
  assertExactKeys(
    policy.split,
    ['method', 'curationBasisPoints', 'holdoutBasisPoints', 'assignmentSeedCommitmentSha256'],
    'target policy.split',
  );
  if (policy.split.method !== 'sha256_committed_deterministic_assignment') {
    fail('target policy.split.method is invalid.');
  }
  assertInteger(policy.split.curationBasisPoints, 'target policy.split.curationBasisPoints', {
    min: 1_000,
    max: 9_000,
  });
  assertInteger(policy.split.holdoutBasisPoints, 'target policy.split.holdoutBasisPoints', {
    min: 1_000,
    max: 9_000,
  });
  if (policy.split.curationBasisPoints + policy.split.holdoutBasisPoints !== 10_000) {
    fail('target policy split basis points must total exactly 10000.');
  }
  assertDigest(
    policy.split.assignmentSeedCommitmentSha256,
    'target policy.split.assignmentSeedCommitmentSha256',
  );
  validateTargetPrivacy(policy.privacy, 'target policy.privacy');
  if (policy.analysis.holdoutQuerySha256 !== policy.privacy.queryDefinitionSha256) {
    fail('target policy holdout query must bind the exact predeclared privacy query definition.');
  }
  validateLineage(policy.lineage, 'target policy.lineage');
  validateCatalogDbEligibilityPolicy(policy.databaseEligibilityPolicy);
  assertDigest(
    policy.databaseEligibilityPolicySha256,
    'target policy.databaseEligibilityPolicySha256',
  );
  if (
    policy.databaseEligibilityPolicySha256 !==
    catalogDbEligibilityPolicySha256(policy.databaseEligibilityPolicy)
  ) {
    fail(
      'target policy database eligibility digest does not match the exact PostgreSQL 0058 canonical policy.',
    );
  }
  validateTargetDefinitions(policy.targets);
  if (!trustRegistry) fail('target policy validation requires the active trust registry.');
  validateSignedRoles({
    document: policy,
    signers: policy.signers,
    signatures: policy.signatures,
    requiredRoles: [
      { decisionRole: 'quality_target_owner', trustRegistryRole: 'engineering' },
      { decisionRole: 'privacy_reviewer', trustRegistryRole: 'legal' },
    ],
    trustRegistry,
    payload: catalogTargetPolicySigningPayload,
    earliestSignedAt: policy.authoredAt,
    latestSignedAt: policy.collectionWindow.opensAt,
    label: 'target policy',
  });
  if (
    policy.signatures.some(
      (signature) => timestamp(signature.signedAt) >= timestamp(policy.collectionWindow.opensAt),
    )
  ) {
    fail('target policy signatures must strictly predate outcome collection.');
  }
  return policy;
}

export function catalogCat02ArtifactSetSha256(artifactSet) {
  return sha256(
    Buffer.from(
      canonicalJson({ contractId: 'catalog-cat02-curation-artifact-set-v1', artifactSet }),
      'utf8',
    ),
  );
}

export function catalogCat02ProductionIntegritySetSha256(artifactSets) {
  if (!Array.isArray(artifactSets)) {
    fail('CAT-02 production-integrity set requires artifact sets.');
  }
  const batches = artifactSets.map((artifactSet) => ({
    batchId: artifactSet.batchId,
    batchEvidenceSha256: artifactSet.batchEvidenceSha256,
    productionIntegrityEvidenceSha256: artifactSet.productionIntegrityEvidenceSha256,
  }));
  return sha256(
    Buffer.from(
      canonicalJson({ contractId: 'catalog-cat02-production-batch-integrity-set-v1', batches }),
      'utf8',
    ),
  );
}

export function catalogCat02DatabaseNormalizedRecordSha256(
  productRecordSha256,
  fieldScope,
  snapshot,
) {
  assertDigest(productRecordSha256, 'CAT-02 normalized membership productRecordSha256');
  if (!DEPENDENCY_FIELD_SCOPES.has(fieldScope) || !isObject(snapshot)) {
    fail('CAT-02 normalized membership scope/snapshot is invalid.');
  }
  const snapshotKeys = {
    barcode_identity: ['barcode', 'productSnapshotSha256', 'dependencyEntitySha256'],
    category: ['categoryCode', 'productSnapshotSha256', 'dependencyEntitySha256'],
    ingredients: ['dependencySha256', 'productSnapshotSha256', 'dependencyEntitySha256'],
    regulatory_classification: [
      'categoryCode',
      'regulatoryClassification',
      'regulatoryReviewEvidenceSha256',
      'regulatoryReviewerIds',
      'dependencyEntitySha256',
    ],
  };
  assertExactKeys(snapshot, snapshotKeys[fieldScope], 'CAT-02 normalized membership snapshot');
  assertDigest(
    snapshot.dependencyEntitySha256,
    'CAT-02 normalized membership snapshot.dependencyEntitySha256',
  );
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-launch-curation-cat02-database-normalized-record-v1',
        productRecordSha256,
        fieldScope,
        snapshot,
      }),
      'utf8',
    ),
  );
}

export function catalogCat02DependencyEntitySha256({
  productRecordSha256,
  fieldScope,
  entityType,
  entityId,
  projectionSha256,
}) {
  assertDigest(productRecordSha256, 'CAT-02 dependency entity.productRecordSha256');
  if (!DEPENDENCY_FIELD_SCOPES.has(fieldScope)) {
    fail('CAT-02 dependency entity.fieldScope is invalid.');
  }
  const expectedEntityType =
    fieldScope === 'barcode_identity'
      ? 'barcode'
      : fieldScope === 'ingredients'
        ? 'ingredient'
        : 'product';
  if (entityType !== expectedEntityType) {
    fail('CAT-02 dependency entity type does not match its field scope.');
  }
  if (typeof entityId !== 'string' || entityId.length < 1 || entityId.length > 256) {
    fail('CAT-02 dependency entity.entityId is invalid.');
  }
  assertDigest(projectionSha256, 'CAT-02 dependency entity.projectionSha256');
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-cat02-retained-dependency-entity-v1',
        productRecordSha256,
        fieldScope,
        entityType,
        entityId,
        projectionSha256,
      }),
      'utf8',
    ),
  );
}

function cat02MembershipSortKey(membership) {
  return `${membership.productRecordSha256}:${membership.fieldScope}:${membership.dependencyEntitySha256}:${membership.batchId}`;
}

function cat02RecordMembershipSortKey(membership) {
  return `${membership.fieldScope}:${membership.dependencyEntitySha256}:${membership.batchId}`;
}

function cat02ArtifactMatchesTargetLineage(artifactSet, targetPolicy) {
  return (
    artifactSet.stageEnvelopeSha256 === targetPolicy.lineage.cat02StageEnvelopeSha256 &&
    artifactSet.databaseReceiptCompletionSha256 ===
      targetPolicy.lineage.cat02DatabaseReceiptCompletionSha256 &&
    artifactSet.promotionReceiptSha256 === targetPolicy.lineage.cat02PromotionReceiptSha256 &&
    artifactSet.qaReportSha256 === targetPolicy.lineage.cat02QaReportSha256
  );
}

function catalogCat02PrimaryArtifactAuthority(proof, targetPolicy) {
  const matches = proof.artifactSets.filter((artifactSet) =>
    cat02ArtifactMatchesTargetLineage(artifactSet, targetPolicy),
  );
  if (matches.length !== 1) {
    fail(
      'CAT-02 membership proof must contain exactly one artifact matching all four target-policy primary lineage hashes.',
    );
  }
  return {
    artifactSet: matches[0],
    batchId: matches[0].batchId,
    artifactSetSha256: catalogCat02ArtifactSetSha256(matches[0]),
  };
}

function assertCat02DependencyMembershipCardinality(
  memberships,
  label,
  { productRecordSha256, primaryArtifactAuthority },
) {
  const byScope = new Map([...DEPENDENCY_FIELD_SCOPES].map((fieldScope) => [fieldScope, []]));
  for (const membership of memberships) {
    byScope.get(membership.fieldScope)?.push(membership);
  }
  for (const [fieldScope, scopedMemberships] of byScope) {
    const requiredCount = fieldScope === 'ingredients' ? null : 1;
    if (
      (requiredCount === null && scopedMemberships.length < 1) ||
      (requiredCount !== null && scopedMemberships.length !== requiredCount)
    ) {
      fail(
        `${label} must contain ${fieldScope === 'ingredients' ? 'at least one' : 'exactly one'} ${fieldScope} dependency entity.`,
      );
    }
    const entityDigests = scopedMemberships.map((membership) => membership.dependencyEntitySha256);
    if (new Set(entityDigests).size !== entityDigests.length) {
      fail(`${label} dependency entities must be unique within each field scope.`);
    }
  }
  const primaryProductMembership = byScope.get('barcode_identity')[0];
  // Release v1 permits cross-batch lineage only for ingredient entities. A future
  // multi-source product-fact model requires a versioned contract and migration.
  for (const fieldScope of ['barcode_identity', 'category', 'regulatory_classification']) {
    const membership = byScope.get(fieldScope)[0];
    if (
      membership.batchId !== primaryArtifactAuthority.batchId ||
      membership.artifactSetSha256 !== primaryArtifactAuthority.artifactSetSha256
    ) {
      fail(
        `${label} ${fieldScope} must bind the exact target-policy primary artifact; only ingredient entities may use contributing batches.`,
      );
    }
  }
  if (
    primaryProductMembership.cat02StageRecordSha256 !== productRecordSha256 ||
    primaryProductMembership.sourceQaSha256 !== primaryArtifactAuthority.artifactSet.qaReportSha256
  ) {
    fail(
      `${label} barcode membership must bind the product record as its primary stage row and the primary artifact QA report.`,
    );
  }
  for (const fieldScope of ['category', 'regulatory_classification']) {
    const membership = byScope.get(fieldScope)[0];
    if (
      membership.cat02StageRecordSha256 !== primaryProductMembership.cat02StageRecordSha256 ||
      membership.sourceApprovalSha256 !== primaryProductMembership.sourceApprovalSha256 ||
      membership.sourceQaSha256 !== primaryProductMembership.sourceQaSha256
    ) {
      fail(
        `${label} ${fieldScope} must be a projection of the exact primary product stage/source authority.`,
      );
    }
  }
}

export function catalogCat02ProofMembershipSetSha256(memberships) {
  const members = structuredClone(memberships).sort((left, right) =>
    cat02MembershipSortKey(left).localeCompare(cat02MembershipSortKey(right), 'en-US'),
  );
  return sha256(
    Buffer.from(canonicalJson({ contractId: CATALOG_CAT02_MEMBERSHIP_SET_ID, members }), 'utf8'),
  );
}

export function catalogCat02DatabaseObservationSha256(proof) {
  if (!isObject(proof?.databaseObservation)) {
    fail('CAT-02 database-observation digest requires an exact observation object.');
  }
  return catalogDocumentSha256(proof.databaseObservation);
}

export function catalogCat02VerifierSignatureSetSha256(proof) {
  if (!Array.isArray(proof?.signatures)) {
    fail('CAT-02 verifier signature-set digest requires exact proof signatures.');
  }
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-cat02-membership-verifier-signature-set-v1',
        signatures: proof.signatures,
      }),
      'utf8',
    ),
  );
}

export function validateCatalogCat02MembershipProof(proof, { targetPolicy, trustRegistry } = {}) {
  if (!targetPolicy || !trustRegistry) {
    fail('CAT-02 membership proof validation requires target policy and trust registry.');
  }
  assertExactKeys(
    proof,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'proofId',
      'releaseId',
      'targetPolicySha256',
      'databaseEligibilityPolicySha256',
      'artifactSets',
      'artifactSetSha256',
      'memberships',
      'membershipSetSha256',
      'databaseObservation',
      'verifiedAt',
      'signers',
      'signatures',
    ],
    'CAT-02 membership proof',
  );
  if (
    proof.schemaVersion !== 1 ||
    proof.contractId !== CATALOG_CAT02_MEMBERSHIP_PROOF_CONTRACT_ID ||
    proof.signatureEnvelopeVersion !== CATALOG_CAT02_MEMBERSHIP_PROOF_SIGNATURE_ENVELOPE ||
    proof.signingDomain !== CATALOG_CAT02_MEMBERSHIP_PROOF_SIGNING_DOMAIN
  ) {
    fail('CAT-02 membership proof schema, contract, signature envelope, or domain is invalid.');
  }
  assertId(proof.proofId, 'CAT-02 membership proof.proofId');
  assertId(proof.releaseId, 'CAT-02 membership proof.releaseId');
  assertDigest(proof.targetPolicySha256, 'CAT-02 membership proof.targetPolicySha256');
  assertDigest(
    proof.databaseEligibilityPolicySha256,
    'CAT-02 membership proof.databaseEligibilityPolicySha256',
  );
  if (
    proof.targetPolicySha256 !== catalogDocumentSha256(targetPolicy) ||
    proof.databaseEligibilityPolicySha256 !== targetPolicy.databaseEligibilityPolicySha256
  ) {
    fail('CAT-02 membership proof does not bind the exact target/DB eligibility authority.');
  }
  assertArray(proof.artifactSets, 'CAT-02 membership proof.artifactSets', {
    min: 1,
    max: MAX_RECORDS,
  });
  const artifactByBatch = new Map();
  const artifactSetKeys = [];
  for (const [index, artifactSet] of proof.artifactSets.entries()) {
    const label = `CAT-02 membership proof.artifactSets[${index}]`;
    assertExactKeys(
      artifactSet,
      [
        'batchId',
        'artifactKind',
        'batchEvidenceSha256',
        'recordsArtifactSha256',
        'candidatesArtifactSha256',
        'stageEnvelopeSha256',
        'databaseReceiptCompletionSha256',
        'promotionReceiptSha256',
        'qaReportSha256',
        'productionIntegrityEvidenceSha256',
      ],
      label,
    );
    assertUuid(artifactSet.batchId, `${label}.batchId`);
    if (artifactSet.artifactKind !== 'production') {
      fail(`${label}.artifactKind must be production.`);
    }
    for (const [key, value] of Object.entries(artifactSet)) {
      if (!['batchId', 'artifactKind'].includes(key)) {
        assertDigest(value, `${label}.${key}`);
      }
    }
    if (artifactByBatch.has(artifactSet.batchId)) fail(`${label}.batchId must be unique.`);
    artifactByBatch.set(artifactSet.batchId, artifactSet);
    artifactSetKeys.push(artifactSet.batchId);
  }
  const sortedArtifactKeys = [...artifactSetKeys].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
  if (canonicalJson(artifactSetKeys) !== canonicalJson(sortedArtifactKeys)) {
    fail('CAT-02 membership proof artifact sets must be sorted by batchId.');
  }
  const primaryArtifactAuthority = catalogCat02PrimaryArtifactAuthority(proof, targetPolicy);
  assertDigest(proof.artifactSetSha256, 'CAT-02 membership proof.artifactSetSha256');
  const expectedArtifactSetSha256 = sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-cat02-curation-complete-artifact-set-v1',
        artifactSets: proof.artifactSets,
      }),
      'utf8',
    ),
  );
  if (proof.artifactSetSha256 !== expectedArtifactSetSha256) {
    fail('CAT-02 membership proof artifact-set digest does not match every contributing batch.');
  }
  assertArray(proof.memberships, 'CAT-02 membership proof.memberships', {
    min: 1,
    max: MAX_RECORDS * MAX_DEPENDENCY_MEMBERSHIPS_PER_RECORD,
  });
  const membershipKeys = [];
  const usedBatches = new Set();
  const membershipsByProduct = new Map();
  for (const [index, membership] of proof.memberships.entries()) {
    const label = `CAT-02 membership proof.memberships[${index}]`;
    assertExactKeys(
      membership,
      [
        'productRecordSha256',
        'fieldScope',
        'dependencyEntitySha256',
        'batchId',
        'artifactSetSha256',
        'cat02StageRecordSha256',
        'cat02DatabaseNormalizedRecordSha256',
        'sourceApprovalSha256',
        'sourceQaSha256',
        'membershipEvidenceSha256',
      ],
      label,
    );
    assertDigest(membership.productRecordSha256, `${label}.productRecordSha256`);
    if (!DEPENDENCY_FIELD_SCOPES.has(membership.fieldScope)) {
      fail(`${label}.fieldScope is invalid.`);
    }
    assertDigest(membership.dependencyEntitySha256, `${label}.dependencyEntitySha256`);
    assertUuid(membership.batchId, `${label}.batchId`);
    for (const key of [
      'artifactSetSha256',
      'cat02StageRecordSha256',
      'cat02DatabaseNormalizedRecordSha256',
      'sourceApprovalSha256',
      'sourceQaSha256',
      'membershipEvidenceSha256',
    ]) {
      assertDigest(membership[key], `${label}.${key}`);
    }
    const artifactSet = artifactByBatch.get(membership.batchId);
    if (
      !artifactSet ||
      membership.artifactSetSha256 !== catalogCat02ArtifactSetSha256(artifactSet)
    ) {
      fail(`${label} does not bind an exact declared CAT-02 batch artifact set.`);
    }
    usedBatches.add(membership.batchId);
    membershipKeys.push(cat02MembershipSortKey(membership));
    const productMemberships = membershipsByProduct.get(membership.productRecordSha256) ?? [];
    productMemberships.push(membership);
    membershipsByProduct.set(membership.productRecordSha256, productMemberships);
  }
  const sortedMembershipKeys = [...membershipKeys].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
  if (
    new Set(membershipKeys).size !== membershipKeys.length ||
    canonicalJson(membershipKeys) !== canonicalJson(sortedMembershipKeys)
  ) {
    fail('CAT-02 memberships must be unique and sorted by record/scope/dependency entity/batch.');
  }
  for (const [productRecordSha256, memberships] of membershipsByProduct) {
    if (memberships.length > MAX_DEPENDENCY_MEMBERSHIPS_PER_RECORD) {
      fail(
        `CAT-02 memberships for product ${productRecordSha256} exceed the bounded dependency-entity limit.`,
      );
    }
    assertCat02DependencyMembershipCardinality(
      memberships,
      `CAT-02 memberships for product ${productRecordSha256}`,
      { productRecordSha256, primaryArtifactAuthority },
    );
  }
  if (usedBatches.size !== artifactByBatch.size) {
    fail('every declared CAT-02 artifact batch must contribute at least one exact membership.');
  }
  assertDigest(proof.membershipSetSha256, 'CAT-02 membership proof.membershipSetSha256');
  if (proof.membershipSetSha256 !== catalogCat02ProofMembershipSetSha256(proof.memberships)) {
    fail('CAT-02 membership proof set digest does not match all exact memberships.');
  }
  assertExactKeys(
    proof.databaseObservation,
    [
      'projectRefSha256',
      'schemaMigrationVersion',
      'schemaMigrationSha256',
      'verificationQuerySha256',
      'observationMode',
      'observedArtifactSetSha256',
      'observedMembershipSetSha256',
      'observedProductionIntegritySetSha256',
      'observedServedStateMutationRootSetSha256',
      'capturedAt',
      'promotedBatchCount',
      'membershipRowCount',
      'missingMembershipCount',
      'extraMembershipCount',
      'mismatchedMembershipCount',
      'allBatchesLivePromoted',
      'allBatchesProductionIntegrityVerified',
    ],
    'CAT-02 membership proof.databaseObservation',
  );
  for (const key of [
    'projectRefSha256',
    'schemaMigrationSha256',
    'verificationQuerySha256',
    'observedArtifactSetSha256',
    'observedMembershipSetSha256',
    'observedProductionIntegritySetSha256',
    'observedServedStateMutationRootSetSha256',
  ]) {
    assertDigest(
      proof.databaseObservation[key],
      `CAT-02 membership proof.databaseObservation.${key}`,
    );
  }
  if (!/^\d{14}$/u.test(proof.databaseObservation.schemaMigrationVersion)) {
    fail('CAT-02 database observation schema migration version is invalid.');
  }
  if (
    proof.databaseObservation.observationMode !== 'live_database_exact_set_receipt' ||
    proof.databaseObservation.observedArtifactSetSha256 !== proof.artifactSetSha256 ||
    proof.databaseObservation.observedMembershipSetSha256 !== proof.membershipSetSha256 ||
    proof.databaseObservation.observedProductionIntegritySetSha256 !==
      catalogCat02ProductionIntegritySetSha256(proof.artifactSets)
  ) {
    fail('CAT-02 database observation does not bind the exact live batch/membership result sets.');
  }
  assertTimestamp(
    proof.databaseObservation.capturedAt,
    'CAT-02 membership proof.databaseObservation.capturedAt',
  );
  const expectedObservationCounts = {
    promotedBatchCount: proof.artifactSets.length,
    membershipRowCount: proof.memberships.length,
    missingMembershipCount: 0,
    extraMembershipCount: 0,
    mismatchedMembershipCount: 0,
  };
  for (const [key, expected] of Object.entries(expectedObservationCounts)) {
    assertInteger(
      proof.databaseObservation[key],
      `CAT-02 membership proof.databaseObservation.${key}`,
      { min: expected, max: expected },
    );
  }
  assertBoolean(
    proof.databaseObservation.allBatchesLivePromoted,
    true,
    'CAT-02 membership proof.databaseObservation.allBatchesLivePromoted',
  );
  assertBoolean(
    proof.databaseObservation.allBatchesProductionIntegrityVerified,
    true,
    'CAT-02 membership proof.databaseObservation.allBatchesProductionIntegrityVerified',
  );
  assertTimestamp(proof.verifiedAt, 'CAT-02 membership proof.verifiedAt');
  if (proof.databaseObservation.capturedAt !== proof.verifiedAt) {
    fail('CAT-02 membership proof must sign the exact database observation instant.');
  }
  validateSignedRoles({
    document: proof,
    signers: proof.signers,
    signatures: proof.signatures,
    requiredRoles: [
      {
        decisionRole: 'cat02_database_membership_verifier',
        trustRegistryRole: 'engineering',
      },
    ],
    trustRegistry,
    payload: catalogCat02MembershipProofSigningPayload,
    earliestSignedAt: proof.verifiedAt,
    latestSignedAt: proof.verifiedAt,
    label: 'CAT-02 membership proof',
  });
  assertSignerIndependentFrom(proof.signers[0], targetPolicy.signers, 'CAT-02 membership verifier');
  return proof;
}

export function catalogPreholdoutLedgerEntrySha256(authority) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-preholdout-ledger-entry-v1',
        priorLedgerRootSha256: authority.priorLedgerRootSha256,
        decisionId: authority.decisionId,
        releaseId: authority.releaseId,
        targetPolicySha256: authority.targetPolicySha256,
        databaseEligibilityPolicySha256: authority.databaseEligibilityPolicySha256,
        reviewedRecordCount: authority.reviewedRecordCount,
        eligibleRecordCount: authority.eligibleRecordCount,
        prioritizedEligibleRecordCount: authority.prioritizedEligibleRecordCount,
        curationDecisionCommitmentSha256: authority.curationDecisionCommitmentSha256,
        candidateSetSha256: authority.candidateSetSha256,
        cat02MembershipProofSha256: authority.cat02MembershipProofSha256,
        cat02MembershipSetSha256: authority.cat02MembershipSetSha256,
        databaseReviewAuthorizationSha256: authority.databaseReviewAuthorizationSha256,
        databaseReviewerSignatureSetSha256: authority.databaseReviewerSignatureSetSha256,
        ledgerSequence: authority.ledgerSequence,
        ledgerUriSha256: authority.ledgerUriSha256,
        externalTimestampAuthoritySha256: authority.externalTimestampAuthoritySha256,
        externalTimestampReceiptSha256: authority.externalTimestampReceiptSha256,
        committedAt: authority.committedAt,
      }),
      'utf8',
    ),
  );
}

export function catalogPreholdoutLedgerRootSha256(authority) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-preholdout-ledger-root-v1',
        priorLedgerRootSha256: authority.priorLedgerRootSha256,
        appendOnlyLedgerEntrySha256: authority.appendOnlyLedgerEntrySha256,
      }),
      'utf8',
    ),
  );
}

export function validateCatalogPreholdoutDecisionAuthority(
  authority,
  { targetPolicy, cat02MembershipProof, trustRegistry, holdoutOpenedAt } = {},
) {
  if (!targetPolicy || !cat02MembershipProof || !trustRegistry || !holdoutOpenedAt) {
    fail('pre-holdout decision validation requires target, CAT-02 proof, trust, and holdout time.');
  }
  assertExactKeys(
    authority,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'decisionId',
      'releaseId',
      'targetPolicySha256',
      'databaseEligibilityPolicySha256',
      'reviewedRecordCount',
      'eligibleRecordCount',
      'prioritizedEligibleRecordCount',
      'curationDecisionCommitmentSha256',
      'candidateSetSha256',
      'cat02MembershipProofSha256',
      'cat02MembershipSetSha256',
      'databaseReviewAuthorization',
      'databaseReviewAuthorizationSha256',
      'databaseReviewerSignatureSetSha256',
      'ledgerSequence',
      'ledgerUriSha256',
      'externalTimestampAuthoritySha256',
      'externalTimestampReceiptSha256',
      'externalWitnessReceipt',
      'externalTimestampSigner',
      'externalTimestampSignature',
      'priorLedgerRootSha256',
      'appendOnlyLedgerEntrySha256',
      'appendOnlyLedgerRootSha256',
      'committedAt',
      'signers',
      'signatures',
    ],
    'pre-holdout decision authority',
  );
  if (
    authority.schemaVersion !== 1 ||
    authority.contractId !== CATALOG_PREHOLDOUT_DECISION_CONTRACT_ID ||
    authority.signatureEnvelopeVersion !== CATALOG_PREHOLDOUT_DECISION_SIGNATURE_ENVELOPE ||
    authority.signingDomain !== CATALOG_PREHOLDOUT_DECISION_SIGNING_DOMAIN
  ) {
    fail(
      'pre-holdout decision authority schema, contract, signature envelope, or domain is invalid.',
    );
  }
  assertId(authority.decisionId, 'pre-holdout decision authority.decisionId');
  assertId(authority.releaseId, 'pre-holdout decision authority.releaseId');
  for (const key of [
    'targetPolicySha256',
    'databaseEligibilityPolicySha256',
    'curationDecisionCommitmentSha256',
    'candidateSetSha256',
    'cat02MembershipProofSha256',
    'cat02MembershipSetSha256',
    'databaseReviewAuthorizationSha256',
    'databaseReviewerSignatureSetSha256',
    'ledgerUriSha256',
    'externalTimestampAuthoritySha256',
    'externalTimestampReceiptSha256',
    'priorLedgerRootSha256',
    'appendOnlyLedgerEntrySha256',
    'appendOnlyLedgerRootSha256',
  ]) {
    assertDigest(authority[key], `pre-holdout decision authority.${key}`);
  }
  const databaseReviewAuthorization = authority.databaseReviewAuthorization;
  assertExactKeys(
    databaseReviewAuthorization,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'releaseId',
      'targetPolicySha256',
      'databaseEligibilityPolicySha256',
      'curationDecisionCommitmentSha256',
      'candidateSetSha256',
      'cat02MembershipSetSha256',
      'reviewedRecordCount',
      'eligibleRecordCount',
      'prioritizedEligibleRecordCount',
      'authorizedAt',
      'validUntil',
      'signers',
      'signatures',
    ],
    'pre-holdout database review authorization',
  );
  if (
    databaseReviewAuthorization.schemaVersion !== 1 ||
    databaseReviewAuthorization.contractId !==
      'catalog-curation-database-review-authorization-v1' ||
    databaseReviewAuthorization.signatureEnvelopeVersion !==
      CATALOG_DATABASE_REVIEW_SIGNATURE_ENVELOPE ||
    databaseReviewAuthorization.signingDomain !== CATALOG_DATABASE_REVIEW_SIGNING_DOMAIN ||
    databaseReviewAuthorization.releaseId !== authority.releaseId ||
    databaseReviewAuthorization.targetPolicySha256 !== authority.targetPolicySha256 ||
    databaseReviewAuthorization.databaseEligibilityPolicySha256 !==
      authority.databaseEligibilityPolicySha256 ||
    databaseReviewAuthorization.curationDecisionCommitmentSha256 !==
      authority.curationDecisionCommitmentSha256 ||
    databaseReviewAuthorization.candidateSetSha256 !== authority.candidateSetSha256 ||
    databaseReviewAuthorization.cat02MembershipSetSha256 !== authority.cat02MembershipSetSha256 ||
    databaseReviewAuthorization.reviewedRecordCount !== authority.reviewedRecordCount ||
    databaseReviewAuthorization.eligibleRecordCount !== authority.eligibleRecordCount ||
    databaseReviewAuthorization.prioritizedEligibleRecordCount !==
      authority.prioritizedEligibleRecordCount
  ) {
    fail('pre-holdout database review authorization does not bind the exact decision authority.');
  }
  assertTimestamp(
    databaseReviewAuthorization.authorizedAt,
    'pre-holdout database review authorization.authorizedAt',
  );
  assertTimestamp(
    databaseReviewAuthorization.validUntil,
    'pre-holdout database review authorization.validUntil',
  );
  if (
    timestamp(databaseReviewAuthorization.authorizedAt) > timestamp(authority.committedAt) ||
    timestamp(databaseReviewAuthorization.validUntil) <= timestamp(holdoutOpenedAt)
  ) {
    fail('pre-holdout database review authorization timing is invalid.');
  }
  validateSignedRoles({
    document: databaseReviewAuthorization,
    signers: databaseReviewAuthorization.signers,
    signatures: databaseReviewAuthorization.signatures,
    requiredRoles: [
      { decisionRole: 'catalog_quality_reviewer', trustRegistryRole: 'engineering' },
      { decisionRole: 'data_quality_reviewer', trustRegistryRole: 'engineering' },
      { decisionRole: 'regulatory_reviewer', trustRegistryRole: 'legal' },
    ],
    trustRegistry,
    payload: catalogDatabaseReviewAuthorizationSigningPayload,
    earliestSignedAt: databaseReviewAuthorization.authorizedAt,
    latestSignedAt: databaseReviewAuthorization.authorizedAt,
    label: 'pre-holdout database review authorization',
  });
  const expectedDatabaseReviewerSignatureSetSha256 = sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-database-reviewer-signature-set-v1',
        signatures: databaseReviewAuthorization.signatures.slice(0, 2),
      }),
      'utf8',
    ),
  );
  if (
    catalogDocumentSha256(databaseReviewAuthorization) !==
      authority.databaseReviewAuthorizationSha256 ||
    expectedDatabaseReviewerSignatureSetSha256 !== authority.databaseReviewerSignatureSetSha256
  ) {
    fail('pre-holdout database review authorization/signature-set digest is invalid.');
  }
  assertInteger(authority.ledgerSequence, 'pre-holdout decision authority.ledgerSequence', {
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  assertExactKeys(
    authority.externalWitnessReceipt,
    [
      'contractId',
      'logId',
      'logUriSha256',
      'sequence',
      'requestNonceSha256',
      'witnessedDecisionCommitmentSha256',
      'priorCheckpointSha256',
      'checkpointSha256',
      'inclusionProofSha256',
      'observedAt',
    ],
    'pre-holdout decision authority.externalWitnessReceipt',
  );
  if (
    authority.externalWitnessReceipt.contractId !== 'catalog-curation-external-timestamp-receipt-v1'
  ) {
    fail('external commitment timestamp receipt contract is invalid.');
  }
  assertId(
    authority.externalWitnessReceipt.logId,
    'pre-holdout decision authority.externalWitnessReceipt.logId',
  );
  for (const key of [
    'logUriSha256',
    'requestNonceSha256',
    'witnessedDecisionCommitmentSha256',
    'priorCheckpointSha256',
    'checkpointSha256',
    'inclusionProofSha256',
  ]) {
    assertDigest(
      authority.externalWitnessReceipt[key],
      `pre-holdout decision authority.externalWitnessReceipt.${key}`,
    );
  }
  assertInteger(
    authority.externalWitnessReceipt.sequence,
    'pre-holdout decision authority.externalWitnessReceipt.sequence',
    { min: 1 },
  );
  assertTimestamp(
    authority.externalWitnessReceipt.observedAt,
    'pre-holdout decision authority.externalWitnessReceipt.observedAt',
  );
  if (
    authority.externalWitnessReceipt.sequence !== authority.ledgerSequence ||
    authority.externalWitnessReceipt.logUriSha256 !== authority.ledgerUriSha256 ||
    authority.externalWitnessReceipt.witnessedDecisionCommitmentSha256 !==
      authority.curationDecisionCommitmentSha256 ||
    authority.externalWitnessReceipt.observedAt !== authority.committedAt ||
    authority.externalWitnessReceipt.checkpointSha256 ===
      authority.externalWitnessReceipt.priorCheckpointSha256 ||
    catalogDocumentSha256(authority.externalWitnessReceipt) !==
      authority.externalTimestampReceiptSha256
  ) {
    fail(
      'external timestamp receipt does not independently bind the exact decision, nonce, log extension, and observed time.',
    );
  }
  validateSignerDescriptor(
    authority.externalTimestampSigner,
    'pre-holdout external timestamp signer',
    'external_timestamp_authority',
    'engineering',
  );
  assertExactKeys(
    authority.externalTimestampSignature,
    SIGNATURE_KEYS,
    'pre-holdout external timestamp signature',
  );
  const timestampSignature = authority.externalTimestampSignature;
  if (
    timestampSignature.decisionRole !== 'external_timestamp_authority' ||
    timestampSignature.reviewerId !== authority.externalTimestampSigner.reviewerId ||
    timestampSignature.trustRegistryKeyId !==
      authority.externalTimestampSigner.trustRegistryKeyId ||
    timestampSignature.algorithm !== 'Ed25519' ||
    timestampSignature.signedAt !== authority.externalWitnessReceipt.observedAt ||
    authority.externalTimestampAuthoritySha256 !== authority.externalTimestampSigner.publicKeySha256
  ) {
    fail('external timestamp signature does not match the pinned independent timestamp authority.');
  }
  const timestampSignatureBytes = assertCanonicalBase64Signature(
    timestampSignature.valueBase64,
    'pre-holdout external timestamp signature.valueBase64',
  );
  const timestampPublicKey = trustedSigner(
    authority.externalTimestampSigner,
    timestampSignature,
    trustRegistry,
    'pre-holdout external timestamp authority',
  );
  if (
    !verifyCryptographicSignature(
      null,
      catalogExternalTimestampReceiptSigningPayload(authority, timestampSignature),
      timestampPublicKey,
      timestampSignatureBytes,
    )
  ) {
    fail('external timestamp authority signature does not authorize the exact witnessed receipt.');
  }
  for (const key of [
    'reviewedRecordCount',
    'eligibleRecordCount',
    'prioritizedEligibleRecordCount',
  ]) {
    assertInteger(authority[key], `pre-holdout decision authority.${key}`, {
      min: key === 'prioritizedEligibleRecordCount' ? 100 : 2_000,
      max: MAX_RECORDS,
    });
  }
  if (
    authority.eligibleRecordCount > authority.reviewedRecordCount ||
    authority.prioritizedEligibleRecordCount > authority.eligibleRecordCount ||
    authority.targetPolicySha256 !== catalogDocumentSha256(targetPolicy) ||
    authority.databaseEligibilityPolicySha256 !== targetPolicy.databaseEligibilityPolicySha256 ||
    authority.cat02MembershipProofSha256 !== catalogDocumentSha256(cat02MembershipProof) ||
    authority.cat02MembershipSetSha256 !== cat02MembershipProof.membershipSetSha256
  ) {
    fail('pre-holdout decision authority counts or bound policy/CAT-02 roots are inconsistent.');
  }
  if (
    authority.appendOnlyLedgerEntrySha256 !== catalogPreholdoutLedgerEntrySha256(authority) ||
    authority.appendOnlyLedgerRootSha256 !== catalogPreholdoutLedgerRootSha256(authority) ||
    authority.appendOnlyLedgerRootSha256 === authority.priorLedgerRootSha256
  ) {
    fail('pre-holdout decision authority lacks an exact append-only ledger extension proof.');
  }
  assertTimestamp(authority.committedAt, 'pre-holdout decision authority.committedAt');
  assertTimestamp(holdoutOpenedAt, 'pre-holdout holdoutOpenedAt');
  if (timestamp(authority.committedAt) >= timestamp(holdoutOpenedAt)) {
    fail('pre-holdout decision authority must be committed strictly before holdout opening.');
  }
  validateSignedRoles({
    document: authority,
    signers: authority.signers,
    signatures: authority.signatures,
    requiredRoles: [
      { decisionRole: 'curation_decision_owner', trustRegistryRole: 'engineering' },
      { decisionRole: 'commitment_ledger_witness', trustRegistryRole: 'engineering' },
    ],
    trustRegistry,
    payload: catalogPreholdoutDecisionSigningPayload,
    earliestSignedAt: authority.committedAt,
    latestSignedAt: authority.committedAt,
    label: 'pre-holdout decision authority',
  });
  assertSignerIndependentFrom(
    authority.signers[0],
    [...targetPolicy.signers, ...cat02MembershipProof.signers],
    'pre-holdout curation decision owner',
  );
  assertSignerIndependentFrom(
    authority.signers[1],
    [...targetPolicy.signers, ...cat02MembershipProof.signers],
    'external commitment-ledger witness',
  );
  for (const signer of databaseReviewAuthorization.signers) {
    assertSignerIndependentFrom(
      signer,
      [...targetPolicy.signers, ...cat02MembershipProof.signers, ...authority.signers],
      `pre-holdout database review role ${signer.decisionRole}`,
    );
  }
  assertSignerIndependentFrom(
    authority.externalTimestampSigner,
    [
      ...targetPolicy.signers,
      ...cat02MembershipProof.signers,
      ...authority.signers,
      ...databaseReviewAuthorization.signers,
    ],
    'external timestamp authority',
  );
  return authority;
}

function validateCorpusPrivacy(privacy, targetPrivacy) {
  assertExactKeys(
    privacy,
    [
      'consentVersionSha256',
      'noticeSha256',
      'retentionPolicySha256',
      'deletionWorkflowSha256',
      'aggregationOnly',
      'oneParticipantPerSkuCapApplied',
      'smallCellSuppressionApplied',
      'complementarySuppressionApplied',
      'rawShelfDataTracked',
      'rawUserIdentifiersTracked',
      'rawBarcodesTracked',
      'rawProductNamesTracked',
      'rawFreeTextTracked',
      'deletionAppliedAt',
    ],
    'beta corpus.privacy',
  );
  for (const key of [
    'consentVersionSha256',
    'noticeSha256',
    'retentionPolicySha256',
    'deletionWorkflowSha256',
  ]) {
    assertDigest(privacy[key], `beta corpus.privacy.${key}`);
    if (privacy[key] !== targetPrivacy[key]) {
      fail(`beta corpus.privacy.${key} does not match the pre-outcome policy.`);
    }
  }
  for (const key of [
    'aggregationOnly',
    'oneParticipantPerSkuCapApplied',
    'smallCellSuppressionApplied',
    'complementarySuppressionApplied',
  ]) {
    assertBoolean(privacy[key], true, `beta corpus.privacy.${key}`);
  }
  for (const key of [
    'rawShelfDataTracked',
    'rawUserIdentifiersTracked',
    'rawBarcodesTracked',
    'rawProductNamesTracked',
    'rawFreeTextTracked',
  ]) {
    assertBoolean(privacy[key], false, `beta corpus.privacy.${key}`);
  }
  assertTimestamp(privacy.deletionAppliedAt, 'beta corpus.privacy.deletionAppliedAt');
}

function bucketSortKey(bucket) {
  return `${bucket.productDemandCommitmentSha256}:${bucket.categoryCode}:${bucket.demandReasonCode}`;
}

function validateDemandBuckets(buckets, cohortName, minCellSize, contributors) {
  assertArray(buckets, `${cohortName}.demandBuckets`, { min: 1, max: MAX_BUCKETS });
  let primarySuppressed = 0;
  let complementarySuppressed = 0;
  const keys = [];
  for (const [index, bucket] of buckets.entries()) {
    const label = `${cohortName}.demandBuckets[${index}]`;
    assertExactKeys(
      bucket,
      ['productDemandCommitmentSha256', 'categoryCode', 'demandReasonCode', 'count', 'suppression'],
      label,
    );
    assertDigest(bucket.productDemandCommitmentSha256, `${label}.productDemandCommitmentSha256`);
    if (!CATEGORY_CODES.has(bucket.categoryCode)) fail(`${label}.categoryCode is invalid.`);
    if (!DEMAND_REASON_CODES.has(bucket.demandReasonCode)) {
      fail(`${label}.demandReasonCode is invalid.`);
    }
    if (!SUPPRESSION_KINDS.has(bucket.suppression)) fail(`${label}.suppression is invalid.`);
    if (bucket.suppression === 'none') {
      assertInteger(bucket.count, `${label}.count`, { min: minCellSize, max: contributors });
    } else {
      if (bucket.count !== null) fail(`${label}.count must be null when suppressed.`);
      if (bucket.suppression === 'primary_small_cell') primarySuppressed += 1;
      else complementarySuppressed += 1;
    }
    keys.push(bucketSortKey(bucket));
  }
  const sorted = [...keys].sort((left, right) => left.localeCompare(right, 'en-US'));
  if (new Set(keys).size !== keys.length || canonicalJson(keys) !== canonicalJson(sorted)) {
    fail(`${cohortName}.demandBuckets must be unique and sorted by digest/category/reason.`);
  }
  if (
    (primarySuppressed > 0 && complementarySuppressed < 1) ||
    (complementarySuppressed > 0 && primarySuppressed < 1) ||
    primarySuppressed + complementarySuppressed === 1
  ) {
    fail(`${cohortName} suppression requires both primary and complementary suppressed cells.`);
  }
  const commitments = buckets.map((bucket) => bucket.productDemandCommitmentSha256);
  if (new Set(commitments).size !== commitments.length) {
    fail(`${cohortName}.demandBuckets must use one unique commitment per product demand cell.`);
  }
}

function assertPrivacySafeAggregate(value, label, minCellSize, { max = 1_000_000 } = {}) {
  assertInteger(value, label, { min: 0, max });
  if (value > 0 && value < minCellSize) {
    fail(`${label} is a nonzero cell below the signed minimum-cell threshold.`);
  }
}

function assertParticipantEvaluationDenominator(value, label, minCellSize, contributors) {
  assertPrivacySafeAggregate(value, label, minCellSize, { max: contributors });
}

function validateOutcomes(outcomes, cohortName, minCellSize, contributors) {
  const label = `${cohortName}.outcomes`;
  assertExactKeys(
    outcomes,
    [
      'lookupEvaluations',
      'correctMatches',
      'incorrectMatches',
      'noMatches',
      'matchedEvaluations',
      'ingredientEvaluations',
      'ingredientEvaluationsWithUnknownTokens',
      'recommendationEvaluations',
      'belowUsableRecommendations',
      'manualFallbackEvaluations',
      'manualFallbackCompletions',
      'shelfFlowEvaluations',
      'shelfFlowCompletions',
      'wrongMatchReports',
      'openWrongMatchReports',
      'openP0P1Incidents',
    ],
    label,
  );
  for (const key of [
    'lookupEvaluations',
    'matchedEvaluations',
    'ingredientEvaluations',
    'recommendationEvaluations',
    'manualFallbackEvaluations',
    'shelfFlowEvaluations',
  ]) {
    assertParticipantEvaluationDenominator(
      outcomes[key],
      `${label}.${key}`,
      minCellSize,
      contributors,
    );
  }
  for (const key of [
    'correctMatches',
    'incorrectMatches',
    'noMatches',
    'ingredientEvaluationsWithUnknownTokens',
    'belowUsableRecommendations',
    'manualFallbackCompletions',
    'shelfFlowCompletions',
    'wrongMatchReports',
    'openWrongMatchReports',
    'openP0P1Incidents',
  ]) {
    assertPrivacySafeAggregate(outcomes[key], `${label}.${key}`, minCellSize, {
      max: contributors,
    });
  }
  if (
    outcomes.correctMatches + outcomes.incorrectMatches + outcomes.noMatches !==
      outcomes.lookupEvaluations ||
    outcomes.correctMatches + outcomes.incorrectMatches !== outcomes.matchedEvaluations ||
    outcomes.ingredientEvaluationsWithUnknownTokens > outcomes.ingredientEvaluations ||
    outcomes.belowUsableRecommendations > outcomes.recommendationEvaluations ||
    outcomes.manualFallbackCompletions > outcomes.manualFallbackEvaluations ||
    outcomes.shelfFlowCompletions > outcomes.shelfFlowEvaluations ||
    outcomes.openWrongMatchReports > outcomes.wrongMatchReports ||
    outcomes.wrongMatchReports > outcomes.lookupEvaluations
  ) {
    fail(`${label} violates exact count conservation or subset invariants.`);
  }
}

function validateCategoryOutcomes(rows, cohortName, outcomes, minCellSize, contributors) {
  assertArray(rows, `${cohortName}.categoryOutcomes`, { min: 1, max: CATEGORY_CODES.size });
  const categories = [];
  let lookupEvaluations = 0;
  let correctMatches = 0;
  let incorrectMatches = 0;
  let noMatches = 0;
  let ingredientEvaluations = 0;
  let ingredientEvaluationsWithUnknownTokens = 0;
  let recommendationEvaluations = 0;
  let belowUsableRecommendations = 0;
  for (const [index, row] of rows.entries()) {
    const label = `${cohortName}.categoryOutcomes[${index}]`;
    assertExactKeys(
      row,
      [
        'categoryCode',
        'lookupEvaluations',
        'correctMatches',
        'incorrectMatches',
        'noMatches',
        'ingredientEvaluations',
        'ingredientEvaluationsWithUnknownTokens',
        'recommendationEvaluations',
        'belowUsableRecommendations',
      ],
      label,
    );
    if (!CATEGORY_CODES.has(row.categoryCode)) fail(`${label}.categoryCode is invalid.`);
    for (const key of ['lookupEvaluations', 'ingredientEvaluations', 'recommendationEvaluations']) {
      assertParticipantEvaluationDenominator(
        row[key],
        `${label}.${key}`,
        minCellSize,
        contributors,
      );
    }
    for (const key of [
      'correctMatches',
      'incorrectMatches',
      'noMatches',
      'ingredientEvaluationsWithUnknownTokens',
      'belowUsableRecommendations',
    ]) {
      assertPrivacySafeAggregate(row[key], `${label}.${key}`, minCellSize, {
        max: contributors,
      });
    }
    if (
      row.correctMatches + row.incorrectMatches + row.noMatches !== row.lookupEvaluations ||
      row.ingredientEvaluationsWithUnknownTokens > row.ingredientEvaluations ||
      row.belowUsableRecommendations > row.recommendationEvaluations
    ) {
      fail(`${label} violates exact participant-level category count conservation.`);
    }
    categories.push(row.categoryCode);
    lookupEvaluations += row.lookupEvaluations;
    correctMatches += row.correctMatches;
    incorrectMatches += row.incorrectMatches;
    noMatches += row.noMatches;
    ingredientEvaluations += row.ingredientEvaluations;
    ingredientEvaluationsWithUnknownTokens += row.ingredientEvaluationsWithUnknownTokens;
    recommendationEvaluations += row.recommendationEvaluations;
    belowUsableRecommendations += row.belowUsableRecommendations;
  }
  const sorted = [...categories].sort((left, right) => left.localeCompare(right, 'en-US'));
  if (
    new Set(categories).size !== categories.length ||
    canonicalJson(categories) !== canonicalJson(sorted)
  ) {
    fail(`${cohortName}.categoryOutcomes must be unique and sorted.`);
  }
  if (
    lookupEvaluations !== outcomes.lookupEvaluations ||
    correctMatches !== outcomes.correctMatches ||
    incorrectMatches !== outcomes.incorrectMatches ||
    noMatches !== outcomes.noMatches ||
    ingredientEvaluations !== outcomes.ingredientEvaluations ||
    ingredientEvaluationsWithUnknownTokens !== outcomes.ingredientEvaluationsWithUnknownTokens ||
    recommendationEvaluations !== outcomes.recommendationEvaluations ||
    belowUsableRecommendations !== outcomes.belowUsableRecommendations
  ) {
    fail(`${cohortName}.categoryOutcomes do not exactly reconcile to cohort outcomes.`);
  }
}

function validateOperationalStratumOutcomes(rows, cohortName, outcomes, minCellSize, contributors) {
  assertArray(rows, `${cohortName}.operationalStratumOutcomes`, {
    min: 1,
    max: OPERATIONAL_STRATUM_KEYS.length,
  });
  const keys = [];
  let manualFallbackEvaluations = 0;
  let manualFallbackCompletions = 0;
  let shelfFlowEvaluations = 0;
  let shelfFlowCompletions = 0;
  for (const [index, row] of rows.entries()) {
    const label = `${cohortName}.operationalStratumOutcomes[${index}]`;
    assertExactKeys(
      row,
      [
        'routeCode',
        'networkState',
        'manualFallbackEvaluations',
        'manualFallbackCompletions',
        'shelfFlowEvaluations',
        'shelfFlowCompletions',
      ],
      label,
    );
    const key = `${row.routeCode}:${row.networkState}`;
    if (!OPERATIONAL_STRATUM_KEYS.includes(key)) fail(`${label} route/network stratum is invalid.`);
    for (const denominator of ['manualFallbackEvaluations', 'shelfFlowEvaluations']) {
      assertParticipantEvaluationDenominator(
        row[denominator],
        `${label}.${denominator}`,
        minCellSize,
        contributors,
      );
    }
    for (const numerator of ['manualFallbackCompletions', 'shelfFlowCompletions']) {
      assertPrivacySafeAggregate(row[numerator], `${label}.${numerator}`, minCellSize, {
        max: contributors,
      });
    }
    if (
      row.manualFallbackCompletions > row.manualFallbackEvaluations ||
      row.shelfFlowCompletions > row.shelfFlowEvaluations
    ) {
      fail(`${label} violates exact participant-level operational count conservation.`);
    }
    keys.push(key);
    manualFallbackEvaluations += row.manualFallbackEvaluations;
    manualFallbackCompletions += row.manualFallbackCompletions;
    shelfFlowEvaluations += row.shelfFlowEvaluations;
    shelfFlowCompletions += row.shelfFlowCompletions;
  }
  const sorted = [...keys].sort((left, right) => left.localeCompare(right, 'en-US'));
  if (new Set(keys).size !== keys.length || canonicalJson(keys) !== canonicalJson(sorted)) {
    fail(`${cohortName}.operationalStratumOutcomes must be unique and sorted.`);
  }
  if (
    manualFallbackEvaluations !== outcomes.manualFallbackEvaluations ||
    manualFallbackCompletions !== outcomes.manualFallbackCompletions ||
    shelfFlowEvaluations !== outcomes.shelfFlowEvaluations ||
    shelfFlowCompletions !== outcomes.shelfFlowCompletions
  ) {
    fail(`${cohortName}.operationalStratumOutcomes do not exactly reconcile to cohort outcomes.`);
  }
}

function validateCohort(cohort, expectedName, policy) {
  const label = `beta corpus.cohorts.${expectedName}`;
  assertExactKeys(
    cohort,
    [
      'name',
      'participants',
      'eligibleParticipants',
      'contributors',
      'demandBuckets',
      'outcomes',
      'categoryOutcomes',
      'operationalStratumOutcomes',
    ],
    label,
  );
  if (cohort.name !== expectedName) fail(`${label}.name is invalid.`);
  for (const key of ['participants', 'eligibleParticipants', 'contributors']) {
    assertInteger(cohort[key], `${label}.${key}`, {
      min: policy.privacy.minCellSize,
      max: 1_000_000,
    });
  }
  if (
    cohort.eligibleParticipants > cohort.participants ||
    cohort.contributors > cohort.eligibleParticipants
  ) {
    fail(`${label} participant counts violate subset invariants.`);
  }
  validateDemandBuckets(
    cohort.demandBuckets,
    label,
    policy.privacy.minCellSize,
    cohort.contributors,
  );
  validateOutcomes(cohort.outcomes, label, policy.privacy.minCellSize, cohort.contributors);
  validateCategoryOutcomes(
    cohort.categoryOutcomes,
    label,
    cohort.outcomes,
    policy.privacy.minCellSize,
    cohort.contributors,
  );
  validateOperationalStratumOutcomes(
    cohort.operationalStratumOutcomes,
    label,
    cohort.outcomes,
    policy.privacy.minCellSize,
    cohort.contributors,
  );
}

function catalogOutcomeSetSha256(contractId, value) {
  return sha256(Buffer.from(canonicalJson({ contractId, value }), 'utf8'));
}

function catalogRegistryExtensionProofSha256(contractId, beforeSha256, afterSha256, context) {
  return sha256(
    Buffer.from(canonicalJson({ contractId, beforeSha256, afterSha256, context }), 'utf8'),
  );
}

export function catalogHoldoutAggregateOutcomeSetSha256(corpus) {
  return catalogOutcomeSetSha256(
    'catalog-holdout-aggregate-outcome-set-v1',
    corpus.cohorts.holdout.outcomes,
  );
}

export function catalogHoldoutCategoryOutcomeSetSha256(corpus) {
  return catalogOutcomeSetSha256(
    'catalog-holdout-category-outcome-set-v1',
    corpus.cohorts.holdout.categoryOutcomes,
  );
}

export function catalogHoldoutOperationalOutcomeSetSha256(corpus) {
  return catalogOutcomeSetSha256(
    'catalog-holdout-operational-outcome-set-v1',
    corpus.cohorts.holdout.operationalStratumOutcomes,
  );
}

export function catalogDemandCommitmentOutputSetSha256(corpus) {
  const entries = Object.entries(corpus.cohorts)
    .flatMap(([cohortName, cohort]) =>
      cohort.demandBuckets.map((bucket) => ({ cohortName, ...structuredClone(bucket) })),
    )
    .sort((left, right) =>
      `${left.cohortName}:${bucketSortKey(left)}`.localeCompare(
        `${right.cohortName}:${bucketSortKey(right)}`,
        'en-US',
      ),
    );
  return catalogOutcomeSetSha256('catalog-demand-commitment-output-set-v1', entries);
}

function validateEvaluationUnitAudit(audit, corpus, targetPolicy) {
  assertExactKeys(
    audit,
    [
      'contractId',
      'wilsonEvaluationUnit',
      'maxWilsonEvaluationsPerParticipantPerEndpoint',
      'aggregateEndpointParticipantSetRootSha256',
      'categoryEndpointParticipantSetRootSha256',
      'operationalEndpointParticipantSetRootSha256',
      'participantAssignmentAuditSha256',
      'outcomeReconciliationSha256',
      'allWilsonUnitsDistinctWithinEndpoint',
      'allCategoryStrataDisjointWithinEndpoint',
      'allOperationalStrataDisjointWithinEndpoint',
      'clusteredWilsonInputsPresent',
    ],
    'beta corpus.evaluationUnitAudit',
  );
  if (
    audit.contractId !== 'catalog-participant-evaluation-unit-audit-v1' ||
    audit.wilsonEvaluationUnit !== targetPolicy.sampling.wilsonEvaluationUnit ||
    audit.maxWilsonEvaluationsPerParticipantPerEndpoint !== 1
  ) {
    fail(
      'beta corpus evaluation-unit audit does not use the signed one-participant endpoint unit.',
    );
  }
  for (const key of [
    'aggregateEndpointParticipantSetRootSha256',
    'categoryEndpointParticipantSetRootSha256',
    'operationalEndpointParticipantSetRootSha256',
    'participantAssignmentAuditSha256',
    'outcomeReconciliationSha256',
  ]) {
    assertDigest(audit[key], `beta corpus.evaluationUnitAudit.${key}`);
  }
  for (const key of [
    'allWilsonUnitsDistinctWithinEndpoint',
    'allCategoryStrataDisjointWithinEndpoint',
    'allOperationalStrataDisjointWithinEndpoint',
  ]) {
    assertBoolean(audit[key], true, `beta corpus.evaluationUnitAudit.${key}`);
  }
  assertBoolean(
    audit.clusteredWilsonInputsPresent,
    false,
    'beta corpus.evaluationUnitAudit.clusteredWilsonInputsPresent',
  );
  const expectedReconciliationSha256 = catalogOutcomeSetSha256(
    'catalog-participant-evaluation-unit-reconciliation-v1',
    {
      aggregate: corpus.cohorts.holdout.outcomes,
      categories: corpus.cohorts.holdout.categoryOutcomes,
      operationalStrata: corpus.cohorts.holdout.operationalStratumOutcomes,
    },
  );
  if (audit.outcomeReconciliationSha256 !== expectedReconciliationSha256) {
    fail('beta corpus evaluation-unit audit does not bind the exact reconciled outcome sets.');
  }
}

function validateHoldoutControlReceipt(
  receipt,
  corpus,
  targetPolicy,
  cat02MembershipProof,
  trustRegistry,
) {
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'receiptId',
      'targetPolicySha256',
      'analysisPlanSha256',
      'metricImplementationSha256',
      'collectionBuildSha256',
      'holdoutQuerySha256',
      'evaluationUnitDefinitionSha256',
      'splitAssignmentLedgerSha256',
      'holdoutParticipantSetRootSha256',
      'evaluationUnitAuditSha256',
      'aggregateOutcomeSetSha256',
      'categoryOutcomeSetSha256',
      'operationalOutcomeSetSha256',
      'accessLogSha256',
      'evaluationLedgerSha256',
      'priorUseRegistryBeforeSha256',
      'priorUseRegistryAfterSha256',
      'priorUseRegistryExtensionProofSha256',
      'holdoutOpenedAt',
      'holdoutSealedAt',
      'evaluatedAt',
      'preOpenReadCount',
      'executedAnalysisLookCount',
      'priorHoldoutUseCount',
      'alternativeBuildLookCount',
      'alternativeQueryLookCount',
      'reusedParticipantCount',
      'collectionBuildMatchesPolicy',
      'metricImplementationMatchesPolicy',
      'queryMatchesPolicy',
      'untouchedBeforeOpen',
      'signers',
      'signatures',
    ],
    'beta corpus.holdoutControlReceipt',
  );
  if (
    receipt.schemaVersion !== 1 ||
    receipt.contractId !== CATALOG_HOLDOUT_CONTROL_RECEIPT_CONTRACT_ID ||
    receipt.signatureEnvelopeVersion !== CATALOG_HOLDOUT_CONTROL_SIGNATURE_ENVELOPE ||
    receipt.signingDomain !== CATALOG_HOLDOUT_CONTROL_SIGNING_DOMAIN
  ) {
    fail('holdout control receipt schema, signature envelope, or domain is invalid.');
  }
  assertId(receipt.receiptId, 'holdout control receipt.receiptId');
  for (const key of [
    'targetPolicySha256',
    'analysisPlanSha256',
    'metricImplementationSha256',
    'collectionBuildSha256',
    'holdoutQuerySha256',
    'evaluationUnitDefinitionSha256',
    'splitAssignmentLedgerSha256',
    'holdoutParticipantSetRootSha256',
    'evaluationUnitAuditSha256',
    'aggregateOutcomeSetSha256',
    'categoryOutcomeSetSha256',
    'operationalOutcomeSetSha256',
    'accessLogSha256',
    'evaluationLedgerSha256',
    'priorUseRegistryBeforeSha256',
    'priorUseRegistryAfterSha256',
    'priorUseRegistryExtensionProofSha256',
  ]) {
    assertDigest(receipt[key], `holdout control receipt.${key}`);
  }
  const timeline = corpus.splitTimeline;
  if (
    receipt.targetPolicySha256 !== catalogDocumentSha256(targetPolicy) ||
    receipt.analysisPlanSha256 !== targetPolicy.analysis.analysisPlanSha256 ||
    receipt.metricImplementationSha256 !== targetPolicy.analysis.metricImplementationSha256 ||
    receipt.collectionBuildSha256 !== targetPolicy.analysis.collectionBuildSha256 ||
    receipt.holdoutQuerySha256 !== targetPolicy.analysis.holdoutQuerySha256 ||
    receipt.evaluationUnitDefinitionSha256 !==
      targetPolicy.analysis.evaluationUnitDefinitionSha256 ||
    receipt.splitAssignmentLedgerSha256 !== corpus.provenance.splitAssignmentLedgerSha256 ||
    receipt.holdoutParticipantSetRootSha256 !==
      corpus.evaluationUnitAudit.aggregateEndpointParticipantSetRootSha256 ||
    receipt.evaluationUnitAuditSha256 !== catalogDocumentSha256(corpus.evaluationUnitAudit) ||
    receipt.aggregateOutcomeSetSha256 !== catalogHoldoutAggregateOutcomeSetSha256(corpus) ||
    receipt.categoryOutcomeSetSha256 !== catalogHoldoutCategoryOutcomeSetSha256(corpus) ||
    receipt.operationalOutcomeSetSha256 !== catalogHoldoutOperationalOutcomeSetSha256(corpus) ||
    receipt.holdoutOpenedAt !== timeline.holdoutOpenedAt ||
    receipt.holdoutSealedAt !== timeline.holdoutSealedAt ||
    receipt.evaluatedAt !== timeline.holdoutSealedAt ||
    receipt.priorUseRegistryAfterSha256 === receipt.priorUseRegistryBeforeSha256 ||
    receipt.priorUseRegistryExtensionProofSha256 !==
      catalogRegistryExtensionProofSha256(
        'catalog-holdout-prior-use-registry-extension-v1',
        receipt.priorUseRegistryBeforeSha256,
        receipt.priorUseRegistryAfterSha256,
        {
          holdoutParticipantSetRootSha256: receipt.holdoutParticipantSetRootSha256,
          evaluationLedgerSha256: receipt.evaluationLedgerSha256,
        },
      )
  ) {
    fail(
      'holdout control receipt does not bind the exact precommitted analysis and sealed outcomes.',
    );
  }
  for (const [key, expected] of Object.entries({
    preOpenReadCount: 0,
    executedAnalysisLookCount: 1,
    priorHoldoutUseCount: 0,
    alternativeBuildLookCount: 0,
    alternativeQueryLookCount: 0,
    reusedParticipantCount: 0,
  })) {
    assertInteger(receipt[key], `holdout control receipt.${key}`, { min: expected, max: expected });
  }
  for (const key of [
    'collectionBuildMatchesPolicy',
    'metricImplementationMatchesPolicy',
    'queryMatchesPolicy',
    'untouchedBeforeOpen',
  ]) {
    assertBoolean(receipt[key], true, `holdout control receipt.${key}`);
  }
  validateSignedRoles({
    document: receipt,
    signers: receipt.signers,
    signatures: receipt.signatures,
    requiredRoles: [{ decisionRole: 'holdout_data_custodian', trustRegistryRole: 'engineering' }],
    trustRegistry,
    payload: catalogHoldoutControlReceiptSigningPayload,
    earliestSignedAt: receipt.evaluatedAt,
    latestSignedAt: receipt.evaluatedAt,
    label: 'holdout control receipt',
  });
  assertSignerIndependentFrom(
    receipt.signers[0],
    [
      ...targetPolicy.signers,
      ...cat02MembershipProof.signers,
      ...corpus.curationDecisionAuthority.signers,
      corpus.curationDecisionAuthority.externalTimestampSigner,
      ...corpus.curationDecisionAuthority.databaseReviewAuthorization.signers,
    ],
    'holdout data custodian',
  );
}

function validatePrivacyExecutionReceipt(
  receipt,
  corpus,
  targetPolicy,
  cat02MembershipProof,
  trustRegistry,
) {
  assertExactKeys(
    receipt,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'receiptId',
      'releaseId',
      'targetPolicySha256',
      'keyEpochId',
      'kmsKeyReceiptSha256',
      'hmacImplementationSha256',
      'canonicalInputDefinitionSha256',
      'domainSeparationContextSha256',
      'demandCommitmentOutputSetSha256',
      'suppressionAuditPolicySha256',
      'suppressionAuditSha256',
      'overlapPolicySha256',
      'overlapAnalysisSha256',
      'priorReleaseRegistrySha256',
      'updatedReleaseRegistrySha256',
      'releaseRegistryContractSha256',
      'releaseRegistryExtensionProofSha256',
      'verifiedAt',
      'secretKeyMaterialPresent',
      'allCommitmentsGeneratedByKmsHmacSha256',
      'allPrimaryCellsBelowMinimum',
      'allComplementaryCellsPreventReconstruction',
      'noReconstructiveOverlap',
      'releaseRegistryAppendOnly',
      'signers',
      'signatures',
    ],
    'beta corpus.privacyExecutionReceipt',
  );
  if (
    receipt.schemaVersion !== 1 ||
    receipt.contractId !== CATALOG_PRIVACY_EXECUTION_RECEIPT_CONTRACT_ID ||
    receipt.signatureEnvelopeVersion !== CATALOG_PRIVACY_EXECUTION_SIGNATURE_ENVELOPE ||
    receipt.signingDomain !== CATALOG_PRIVACY_EXECUTION_SIGNING_DOMAIN
  ) {
    fail('privacy execution receipt schema, signature envelope, or domain is invalid.');
  }
  assertId(receipt.receiptId, 'privacy execution receipt.receiptId');
  assertId(receipt.releaseId, 'privacy execution receipt.releaseId');
  assertId(receipt.keyEpochId, 'privacy execution receipt.keyEpochId');
  for (const key of [
    'targetPolicySha256',
    'kmsKeyReceiptSha256',
    'hmacImplementationSha256',
    'canonicalInputDefinitionSha256',
    'domainSeparationContextSha256',
    'demandCommitmentOutputSetSha256',
    'suppressionAuditPolicySha256',
    'suppressionAuditSha256',
    'overlapPolicySha256',
    'overlapAnalysisSha256',
    'priorReleaseRegistrySha256',
    'updatedReleaseRegistrySha256',
    'releaseRegistryContractSha256',
    'releaseRegistryExtensionProofSha256',
  ]) {
    assertDigest(receipt[key], `privacy execution receipt.${key}`);
  }
  const privacy = targetPolicy.privacy;
  const controls = corpus.releaseControls;
  if (
    receipt.releaseId !== controls.releaseId ||
    receipt.targetPolicySha256 !== catalogDocumentSha256(targetPolicy) ||
    receipt.keyEpochId !== privacy.productDemandCommitmentKeyEpochId ||
    receipt.kmsKeyReceiptSha256 !== privacy.productDemandCommitmentKeyReceiptSha256 ||
    receipt.hmacImplementationSha256 !== privacy.productDemandCommitmentImplementationSha256 ||
    receipt.canonicalInputDefinitionSha256 !==
      privacy.productDemandCanonicalInputDefinitionSha256 ||
    receipt.domainSeparationContextSha256 !== privacy.productDemandDomainSeparationContextSha256 ||
    receipt.demandCommitmentOutputSetSha256 !== catalogDemandCommitmentOutputSetSha256(corpus) ||
    receipt.suppressionAuditPolicySha256 !== privacy.suppressionAuditPolicySha256 ||
    receipt.suppressionAuditSha256 !== controls.suppressionAuditSha256 ||
    receipt.overlapPolicySha256 !== privacy.overlapPolicySha256 ||
    receipt.overlapAnalysisSha256 !== controls.overlapAnalysisSha256 ||
    receipt.priorReleaseRegistrySha256 !== controls.priorReleaseRegistrySha256 ||
    receipt.updatedReleaseRegistrySha256 !== controls.updatedReleaseRegistrySha256 ||
    receipt.releaseRegistryContractSha256 !== privacy.releaseRegistryContractSha256 ||
    receipt.releaseRegistryExtensionProofSha256 !== controls.releaseRegistryExtensionProofSha256 ||
    receipt.releaseRegistryExtensionProofSha256 !==
      catalogRegistryExtensionProofSha256(
        'catalog-aggregate-release-registry-extension-v1',
        controls.priorReleaseRegistrySha256,
        controls.updatedReleaseRegistrySha256,
        {
          releaseId: controls.releaseId,
          overlapAnalysisSha256: controls.overlapAnalysisSha256,
          suppressionAuditSha256: controls.suppressionAuditSha256,
        },
      ) ||
    receipt.verifiedAt !== corpus.collectedAt
  ) {
    fail(
      'privacy execution receipt does not bind the exact HMAC, suppression, and overlap evidence.',
    );
  }
  assertTimestamp(receipt.verifiedAt, 'privacy execution receipt.verifiedAt');
  assertBoolean(
    receipt.secretKeyMaterialPresent,
    false,
    'privacy execution receipt.secretKeyMaterialPresent',
  );
  for (const key of [
    'allCommitmentsGeneratedByKmsHmacSha256',
    'allPrimaryCellsBelowMinimum',
    'allComplementaryCellsPreventReconstruction',
    'noReconstructiveOverlap',
    'releaseRegistryAppendOnly',
  ]) {
    assertBoolean(receipt[key], true, `privacy execution receipt.${key}`);
  }
  validateSignedRoles({
    document: receipt,
    signers: receipt.signers,
    signatures: receipt.signatures,
    requiredRoles: [{ decisionRole: 'privacy_pipeline_verifier', trustRegistryRole: 'legal' }],
    trustRegistry,
    payload: catalogPrivacyExecutionReceiptSigningPayload,
    earliestSignedAt: receipt.verifiedAt,
    latestSignedAt: receipt.verifiedAt,
    label: 'privacy execution receipt',
  });
  assertSignerIndependentFrom(
    receipt.signers[0],
    [
      ...targetPolicy.signers,
      ...cat02MembershipProof.signers,
      ...corpus.curationDecisionAuthority.signers,
      corpus.curationDecisionAuthority.externalTimestampSigner,
      ...corpus.curationDecisionAuthority.databaseReviewAuthorization.signers,
      ...corpus.holdoutControlReceipt.signers,
    ],
    'privacy pipeline verifier',
  );
}

export function validateCatalogBetaCorpus(
  corpus,
  { targetPolicy, cat02MembershipProof, trustRegistry } = {},
) {
  if (!targetPolicy || !cat02MembershipProof || !trustRegistry) {
    fail('beta corpus validation requires target policy, CAT-02 proof, and trust registry.');
  }
  assertExactKeys(
    corpus,
    [
      'schemaVersion',
      'contractId',
      'corpusId',
      'targetPolicySha256',
      'collectedAt',
      'splitTimeline',
      'provenance',
      'releaseControls',
      'privacy',
      'cohorts',
      'evaluationUnitAudit',
      'holdoutControlReceipt',
      'privacyExecutionReceipt',
      'curationDecisionAuthority',
    ],
    'beta corpus',
  );
  if (corpus.schemaVersion !== 1 || corpus.contractId !== CATALOG_BETA_CORPUS_CONTRACT_ID) {
    fail('beta corpus schema/contract is invalid.');
  }
  assertId(corpus.corpusId, 'beta corpus.corpusId');
  assertDigest(corpus.targetPolicySha256, 'beta corpus.targetPolicySha256');
  if (corpus.targetPolicySha256 !== catalogDocumentSha256(targetPolicy)) {
    fail('beta corpus does not bind the exact signed target policy.');
  }
  assertTimestamp(corpus.collectedAt, 'beta corpus.collectedAt');
  assertExactKeys(
    corpus.splitTimeline,
    [
      'assignmentSeedCommitmentSha256',
      'curationFrozenAt',
      'curationDecisionCommittedAt',
      'curationDecisionCommitmentSha256',
      'holdoutOpenedAt',
      'holdoutSealedAt',
    ],
    'beta corpus.splitTimeline',
  );
  assertDigest(
    corpus.splitTimeline.assignmentSeedCommitmentSha256,
    'beta corpus.splitTimeline.assignmentSeedCommitmentSha256',
  );
  if (
    corpus.splitTimeline.assignmentSeedCommitmentSha256 !==
    targetPolicy.split.assignmentSeedCommitmentSha256
  ) {
    fail('beta corpus split does not bind the pre-outcome assignment commitment.');
  }
  for (const key of [
    'curationFrozenAt',
    'curationDecisionCommittedAt',
    'holdoutOpenedAt',
    'holdoutSealedAt',
  ]) {
    assertTimestamp(corpus.splitTimeline[key], `beta corpus.splitTimeline.${key}`);
  }
  assertDigest(
    corpus.splitTimeline.curationDecisionCommitmentSha256,
    'beta corpus.splitTimeline.curationDecisionCommitmentSha256',
  );
  const timeline = corpus.splitTimeline;
  if (
    timestamp(timeline.curationFrozenAt) < timestamp(targetPolicy.collectionWindow.closesAt) ||
    timestamp(timeline.curationFrozenAt) > timestamp(timeline.curationDecisionCommittedAt) ||
    timestamp(timeline.curationDecisionCommittedAt) >= timestamp(timeline.holdoutOpenedAt) ||
    timestamp(timeline.holdoutOpenedAt) > timestamp(timeline.holdoutSealedAt) ||
    timestamp(timeline.holdoutSealedAt) > timestamp(corpus.collectedAt)
  ) {
    fail(
      'beta corpus timeline does not prove curation was frozen/committed before holdout opening.',
    );
  }
  validateCatalogPreholdoutDecisionAuthority(corpus.curationDecisionAuthority, {
    targetPolicy,
    cat02MembershipProof,
    trustRegistry,
    holdoutOpenedAt: timeline.holdoutOpenedAt,
  });
  if (
    corpus.curationDecisionAuthority.committedAt !== timeline.curationDecisionCommittedAt ||
    corpus.curationDecisionAuthority.curationDecisionCommitmentSha256 !==
      timeline.curationDecisionCommitmentSha256 ||
    timestamp(cat02MembershipProof.verifiedAt) > timestamp(timeline.curationDecisionCommittedAt)
  ) {
    fail('beta corpus timeline does not exactly match its signed pre-holdout decision authority.');
  }
  assertExactKeys(
    corpus.provenance,
    [
      'aggregateExportSha256',
      'consentLedgerSha256',
      'deletionLedgerSha256',
      'aggregationQuerySha256',
      'splitAssignmentLedgerSha256',
      'collectionBuildSha256',
      'analysisPlanSha256',
      'metricImplementationSha256',
      'evaluationUnitDefinitionSha256',
      'rawEvidenceLocationSha256',
      'productDemandCommitmentKeyReceiptSha256',
    ],
    'beta corpus.provenance',
  );
  for (const [key, value] of Object.entries(corpus.provenance)) {
    assertDigest(value, `beta corpus.provenance.${key}`);
  }
  if (corpus.provenance.aggregationQuerySha256 !== targetPolicy.privacy.queryDefinitionSha256) {
    fail('beta corpus aggregation query does not match the pre-outcome policy.');
  }
  if (
    corpus.provenance.collectionBuildSha256 !== targetPolicy.analysis.collectionBuildSha256 ||
    corpus.provenance.analysisPlanSha256 !== targetPolicy.analysis.analysisPlanSha256 ||
    corpus.provenance.metricImplementationSha256 !==
      targetPolicy.analysis.metricImplementationSha256 ||
    corpus.provenance.evaluationUnitDefinitionSha256 !==
      targetPolicy.analysis.evaluationUnitDefinitionSha256
  ) {
    fail(
      'beta corpus build, analysis, metric, or evaluation-unit provenance was not precommitted.',
    );
  }
  if (
    corpus.provenance.productDemandCommitmentKeyReceiptSha256 !==
    targetPolicy.privacy.productDemandCommitmentKeyReceiptSha256
  ) {
    fail('beta corpus demand commitments do not bind the pre-outcome secret-key receipt.');
  }
  assertExactKeys(
    corpus.releaseControls,
    [
      'releaseId',
      'priorReleaseRegistrySha256',
      'updatedReleaseRegistrySha256',
      'releaseRegistryExtensionProofSha256',
      'overlapPolicySha256',
      'overlapAnalysisSha256',
      'suppressionAuditSha256',
      'cohortWindowQueryReleaseKeyCommitmentSha256',
      'cohortOverlapAuditSha256',
      'cohortOverlapCount',
      'cohortDisjointnessVerified',
      'overlapDecision',
      'overlappingReleaseCount',
      'reconstructiveOverlapFound',
      'releaseRegistryAppendOnly',
    ],
    'beta corpus.releaseControls',
  );
  assertId(corpus.releaseControls.releaseId, 'beta corpus.releaseControls.releaseId');
  for (const key of [
    'priorReleaseRegistrySha256',
    'updatedReleaseRegistrySha256',
    'releaseRegistryExtensionProofSha256',
    'overlapPolicySha256',
    'overlapAnalysisSha256',
    'suppressionAuditSha256',
    'cohortWindowQueryReleaseKeyCommitmentSha256',
    'cohortOverlapAuditSha256',
  ]) {
    assertDigest(corpus.releaseControls[key], `beta corpus.releaseControls.${key}`);
  }
  assertInteger(
    corpus.releaseControls.cohortOverlapCount,
    'beta corpus.releaseControls.cohortOverlapCount',
    { min: 0, max: 0 },
  );
  if (
    corpus.releaseControls.priorReleaseRegistrySha256 !==
      targetPolicy.privacy.aggregateReleaseRegistrySha256 ||
    corpus.releaseControls.overlapPolicySha256 !== targetPolicy.privacy.overlapPolicySha256 ||
    corpus.releaseControls.cohortWindowQueryReleaseKeyCommitmentSha256 !==
      targetPolicy.privacy.cohortWindowQueryReleaseKeyCommitmentSha256 ||
    corpus.releaseControls.updatedReleaseRegistrySha256 ===
      corpus.releaseControls.priorReleaseRegistrySha256 ||
    corpus.releaseControls.cohortOverlapCount !== 0 ||
    corpus.releaseControls.cohortDisjointnessVerified !== true ||
    corpus.releaseControls.overlapDecision !== 'no_reconstructive_overlap' ||
    corpus.releaseControls.overlappingReleaseCount !== 0 ||
    corpus.releaseControls.reconstructiveOverlapFound !== false ||
    corpus.releaseControls.releaseRegistryAppendOnly !== true
  ) {
    fail(
      'beta corpus release controls do not prove disjoint people and an append-only release with no reconstructive cohort/window/query overlap.',
    );
  }
  validateCorpusPrivacy(corpus.privacy, targetPolicy.privacy);
  if (timestamp(corpus.privacy.deletionAppliedAt) > timestamp(corpus.collectedAt)) {
    fail('beta corpus deletion ledger application cannot postdate collection sealing.');
  }
  assertExactKeys(corpus.cohorts, ['curation', 'holdout'], 'beta corpus.cohorts');
  validateCohort(corpus.cohorts.curation, 'curation', targetPolicy);
  validateCohort(corpus.cohorts.holdout, 'holdout', targetPolicy);
  const curationCommitments = new Set(
    corpus.cohorts.curation.demandBuckets.map((bucket) => bucket.productDemandCommitmentSha256),
  );
  if (
    corpus.cohorts.holdout.demandBuckets.some((bucket) =>
      curationCommitments.has(bucket.productDemandCommitmentSha256),
    )
  ) {
    fail(
      'beta corpus demand commitments must be release/cohort domain-separated and unlinkable across curation and holdout.',
    );
  }
  validateEvaluationUnitAudit(corpus.evaluationUnitAudit, corpus, targetPolicy);
  validateHoldoutControlReceipt(
    corpus.holdoutControlReceipt,
    corpus,
    targetPolicy,
    cat02MembershipProof,
    trustRegistry,
  );
  validatePrivacyExecutionReceipt(
    corpus.privacyExecutionReceipt,
    corpus,
    targetPolicy,
    cat02MembershipProof,
    trustRegistry,
  );
  return corpus;
}

export function catalogCurationDecisionCommitment(records) {
  if (!Array.isArray(records)) fail('curation decision commitment requires records.');
  const reviewedRecords = records.map((record) => structuredClone(record));
  reviewedRecords.sort((left, right) =>
    left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
  );
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: CATALOG_CURATION_DECISION_COMMITMENT_ID,
        reviewedRecords,
      }),
      'utf8',
    ),
  );
}

export function catalogCurationCandidateSetSha256(records) {
  if (!Array.isArray(records)) fail('curation candidate-set digest requires records.');
  const candidates = records.map((record) => ({
    productRecordSha256: record.productRecordSha256,
    cat02StageRecordSha256: record.cat02StageRecordSha256,
    cat02DatabaseNormalizedRecordSha256: record.cat02DatabaseNormalizedRecordSha256,
    sourceApprovalSha256: record.sourceApprovalSha256,
    sourceQaSha256: record.sourceQaSha256,
    servedStateMutationRootSha256: record.servedStateMutationRootSha256,
  }));
  candidates.sort((left, right) =>
    left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
  );
  return sha256(
    Buffer.from(
      canonicalJson({ contractId: CATALOG_CURATION_CANDIDATE_SET_ID, candidates }),
      'utf8',
    ),
  );
}

export function catalogCat02MembershipSetSha256(records) {
  if (!Array.isArray(records)) fail('CAT-02 membership-set digest requires records.');
  const memberships = records.flatMap((record) =>
    (record.dependencyMemberships ?? []).map((membership) => ({
      productRecordSha256: record.productRecordSha256,
      ...structuredClone(membership),
    })),
  );
  return catalogCat02ProofMembershipSetSha256(memberships);
}

export function catalogServedStateMutationRootSetSha256(records) {
  if (!Array.isArray(records)) fail('served-state mutation-root set requires records.');
  const roots = records.map((record, index) => {
    assertDigest(
      record?.productRecordSha256,
      `served-state mutation root records[${index}].productRecordSha256`,
    );
    assertDigest(
      record?.servedStateMutationRootSha256,
      `served-state mutation root records[${index}].servedStateMutationRootSha256`,
    );
    return {
      productRecordSha256: record.productRecordSha256,
      servedStateMutationRootSha256: record.servedStateMutationRootSha256,
    };
  });
  roots.sort((left, right) =>
    left.productRecordSha256 < right.productRecordSha256
      ? -1
      : left.productRecordSha256 > right.productRecordSha256
        ? 1
        : 0,
  );
  if (new Set(roots.map((entry) => entry.productRecordSha256)).size !== roots.length) {
    fail('served-state mutation roots require one exact root per reviewed product record.');
  }
  return sha256(
    Buffer.from(
      canonicalJson({ contractId: CATALOG_SERVED_STATE_MUTATION_ROOT_SET_ID, roots }),
      'utf8',
    ),
  );
}

function catalogCurationCampaignAuthorityBody(review) {
  return {
    contractId: CATALOG_CURATION_CAMPAIGN_AUTHORITY_ID,
    releaseId: review.releaseId,
    targetPolicySha256: review.targetPolicySha256,
    betaShelfCorpusSha256: review.betaShelfCorpusSha256,
    lineage: review.lineage,
    databaseEligibilityPolicySha256: review.databaseEligibilityPolicySha256,
    cat02MembershipProofSha256: review.cat02MembershipProofSha256,
    cat02DatabaseObservationSha256: review.cat02DatabaseObservationSha256,
    cat02VerifierSignatureSetSha256: review.cat02VerifierSignatureSetSha256,
    cat02ProductionIntegritySetSha256: review.cat02ProductionIntegritySetSha256,
    servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(review.records),
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    curationDecisionCommittedAt: review.curationDecisionCommittedAt,
    reviewedAt: review.reviewedAt,
    databaseSnapshot: review.databaseSnapshot,
    authority: review.authority,
    inventoryCommitment: review.inventoryCommitment,
    databaseReviewAuthorization: review.databaseReviewAuthorization,
    records: review.records,
    reviewers: review.reviewers,
  };
}

export function catalogCurationCampaignAuthoritySha256(review) {
  return sha256(Buffer.from(canonicalJson(catalogCurationCampaignAuthorityBody(review)), 'utf8'));
}

export function catalogCurationReviewedRecordAuthoritySha256(review, record) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: CATALOG_CURATION_REVIEWED_RECORD_AUTHORITY_ID,
        releaseId: review.releaseId,
        targetPolicySha256: review.targetPolicySha256,
        betaShelfCorpusSha256: review.betaShelfCorpusSha256,
        databaseEligibilityPolicySha256: review.databaseEligibilityPolicySha256,
        candidateSetSha256: review.databaseSnapshot.candidateSetSha256,
        servedStateMutationRootSha256: record.servedStateMutationRootSha256,
        curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
        record,
      }),
      'utf8',
    ),
  );
}

export function catalogCurationReviewedRecordMappingSha256(review, record) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: CATALOG_CURATION_REVIEWED_RECORD_MAPPING_ID,
        releaseId: review.releaseId,
        productRecordSha256: record.productRecordSha256,
        servedStateMutationRootSha256: record.servedStateMutationRootSha256,
        offlineBaseSealedRecordSha256: catalogCurationReviewedRecordAuthoritySha256(review, record),
        databaseBaseRecordSha256: record.databaseBaseRecordSha256,
      }),
      'utf8',
    ),
  );
}

export function catalogCurationActivationAuthorization(
  review,
  record,
  { campaignAuthoritySha256 = catalogCurationCampaignAuthoritySha256(review) } = {},
) {
  const activationOperatorId = review.activation.operator.reviewerId;
  return {
    contractId: CATALOG_CURATION_ACTIVATION_AUTHORIZATION_ID,
    releaseId: review.releaseId,
    campaignAuthoritySha256,
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    productRecordSha256: record.productRecordSha256,
    servedStateMutationRootSha256: record.servedStateMutationRootSha256,
    offlineBaseSealedRecordSha256: catalogCurationReviewedRecordAuthoritySha256(review, record),
    databaseBaseRecordSha256: record.databaseBaseRecordSha256,
    reviewedRecordMappingSha256: catalogCurationReviewedRecordMappingSha256(review, record),
    activationDecision: review.activation.decision,
    activationOperatorId,
    activationOperatorRole: 'activation_operator',
    operationKey: `${review.activation.operationKeyPrefix}.${review.releaseId}.${record.productRecordSha256}`,
    reasonCode: review.activation.reasonCode,
    plannedAt: review.activation.plannedAt,
  };
}

export function catalogCurationActivationAuthorizationSet(review) {
  const campaignAuthoritySha256 = catalogCurationCampaignAuthoritySha256(review);
  const requests = (review.activation.decision === 'approve_activation' ? review.records : [])
    .filter((record) => record.decision === 'eligible_for_activation')
    .map((record) => ({
      productRecordSha256: record.productRecordSha256,
      requestSha256: sha256(
        Buffer.from(
          canonicalJson(
            catalogCurationActivationAuthorization(review, record, {
              campaignAuthoritySha256,
            }),
          ),
          'utf8',
        ),
      ),
    }))
    .sort((left, right) =>
      left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
    );
  return {
    contractId: CATALOG_CURATION_ACTIVATION_AUTHORIZATION_SET_ID,
    requests,
  };
}

export function catalogCurationActivationAuthorizationSetSha256(review) {
  return sha256(
    Buffer.from(canonicalJson(catalogCurationActivationAuthorizationSet(review)), 'utf8'),
  );
}

export function catalogActivationSignatureSha256(review) {
  const value = review.activation.authorizationSignature?.valueBase64;
  const bytes = assertCanonicalBase64Signature(value, 'activation authorization signature');
  return sha256(bytes);
}

export function catalogCurationDatabaseRecord(
  review,
  record,
  {
    campaignAuthoritySha256 = catalogCurationCampaignAuthoritySha256(review),
    activationSignatureSha256: suppliedActivationSignatureSha256,
  } = {},
) {
  const offlineBaseSealedRecordSha256 = catalogCurationReviewedRecordAuthoritySha256(
    review,
    record,
  );
  const reviewedRecordMappingSha256 = catalogCurationReviewedRecordMappingSha256(review, record);
  const approved =
    review.activation.decision === 'approve_activation' &&
    record.decision === 'eligible_for_activation';
  const databaseActivationRequestSha256 = approved
    ? sha256(
        Buffer.from(
          canonicalJson(
            catalogCurationActivationAuthorization(review, record, {
              campaignAuthoritySha256,
            }),
          ),
          'utf8',
        ),
      )
    : null;
  const activationSignatureSha256 = approved
    ? (suppliedActivationSignatureSha256 ?? catalogActivationSignatureSha256(review))
    : null;
  const cat02MembershipReadbackSha256 = sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-cat02-membership-readback-v1',
        productRecordSha256: record.productRecordSha256,
        memberships: record.dependencyMemberships,
      }),
      'utf8',
    ),
  );
  const regulatoryReviewEvidenceSha256 =
    record.productClass === 'cosmetic' ? null : catalogDocumentSha256(record.regulatoryEvidence);
  const reviewAuthority = {
    cat02MembershipProofSha256: review.cat02MembershipProofSha256,
    cat02DatabaseObservationSha256: review.cat02DatabaseObservationSha256,
    cat02VerifierSignatureSetSha256: review.cat02VerifierSignatureSetSha256,
    cat02ProductionIntegritySetSha256: review.cat02ProductionIntegritySetSha256,
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    regulatoryReviewerRole: 'regulatory_reviewer',
    regulatoryReviewEvidenceSha256,
    regulatoryReviewerIds: [review.reviewers[2].reviewerId],
    regulatorySignatureSetSha256: catalogRegulatorySignatureSetSha256(review),
    reviewerRoles: ['catalog_quality_reviewer', 'data_quality_reviewer'],
    reviewerEvidenceSha256s: review.reviewers
      .slice(0, 2)
      .map((reviewer) => reviewer.qualificationEvidenceSha256),
    reviewerSignatureSetSha256: catalogRecordReviewerSignatureSetSha256(review),
  };
  const authority = {
    contractId: 'catalog-launch-curation-record-v1',
    offlineRecordAuthorityContractId: CATALOG_CURATION_REVIEWED_RECORD_AUTHORITY_ID,
    offlineBaseSealedRecordSha256,
    databaseBaseRecordSha256: record.databaseBaseRecordSha256,
    reviewedRecordMappingSha256,
    servedStateMutationRootSha256: record.servedStateMutationRootSha256,
    reviewAuthority,
    activationDecision: approved ? 'approve_activation' : 'withhold_activation',
    activationOperatorRole: 'activation_operator',
    activationOperatorId: review.activation.operator.reviewerId,
    activationPlannedAt: approved ? review.activation.plannedAt : null,
    databaseActivationRequestSha256,
    activationSignature: approved
      ? {
          signerRole: 'activation_operator',
          signerId: review.activation.operator.reviewerId,
          signatureSha256: activationSignatureSha256,
        }
      : null,
  };
  return {
    productRecordSha256: record.productRecordSha256,
    cat02StageRecordSha256: record.cat02StageRecordSha256,
    cat02DatabaseNormalizedRecordSha256: record.cat02DatabaseNormalizedRecordSha256,
    sourceApprovalSha256: record.sourceApprovalSha256,
    sourceQaSha256: record.sourceQaSha256,
    servedStateMutationRootSha256: record.servedStateMutationRootSha256,
    cat02MembershipReadbackSha256,
    offlineBaseSealedRecordSha256,
    databaseBaseRecordSha256: record.databaseBaseRecordSha256,
    reviewedRecordMappingSha256,
    curationRecordSha256: sha256(Buffer.from(canonicalJson(authority), 'utf8')),
    manifestEntrySha256: offlineBaseSealedRecordSha256,
    databaseActivationRequestSha256,
    activationSignatureSha256,
  };
}

export function catalogCurationDatabaseRecordSet(review) {
  const campaignAuthoritySha256 = catalogCurationCampaignAuthoritySha256(review);
  const activationSignatureSha256 = catalogActivationSignatureSha256(review);
  const records = review.records
    .map((record) =>
      catalogCurationDatabaseRecord(review, record, {
        campaignAuthoritySha256,
        activationSignatureSha256,
      }),
    )
    .sort((left, right) =>
      left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
    );
  return {
    contractId: CATALOG_DATABASE_RECORD_SET_ID,
    releaseId: review.releaseId,
    records,
  };
}

export function catalogCurationDatabaseRecordSetSha256(review) {
  return sha256(Buffer.from(canonicalJson(catalogCurationDatabaseRecordSet(review)), 'utf8'));
}

export function catalogCurationManifestSha256(review) {
  const records = review.records
    .map((record) => ({
      productRecordSha256: record.productRecordSha256,
      manifestEntrySha256: catalogCurationReviewedRecordAuthoritySha256(review, record),
    }))
    .sort((left, right) =>
      left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
    );
  return sha256(
    Buffer.from(
      canonicalJson({ contractId: 'catalog-launch-curation-offline-manifest-v1', records }),
      'utf8',
    ),
  );
}

export function catalogCorpusConsentStateSha256(corpus) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-corpus-consent-state-v1',
        targetPolicySha256: corpus.targetPolicySha256,
        consentVersionSha256: corpus.privacy.consentVersionSha256,
        noticeSha256: corpus.privacy.noticeSha256,
        retentionPolicySha256: corpus.privacy.retentionPolicySha256,
        deletionWorkflowSha256: corpus.privacy.deletionWorkflowSha256,
        consentLedgerSha256: corpus.provenance.consentLedgerSha256,
        deletionLedgerSha256: corpus.provenance.deletionLedgerSha256,
        releaseId: corpus.releaseControls.releaseId,
        releaseRegistrySha256: corpus.releaseControls.updatedReleaseRegistrySha256,
        cohortOverlapAuditSha256: corpus.releaseControls.cohortOverlapAuditSha256,
      }),
      'utf8',
    ),
  );
}

export function catalogDatabaseReviewerSignatureSetSha256(review) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-database-reviewer-signature-set-v1',
        signatures: review.databaseReviewAuthorization.signatures.slice(0, 2),
      }),
      'utf8',
    ),
  );
}

export function catalogCurationOutcomeReviewerSignatureSetSha256(review) {
  if (!Array.isArray(review?.signatures)) {
    fail('curation outcome-reviewer signature-set digest requires review signatures.');
  }
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: CATALOG_CURATION_OUTCOME_REVIEWER_SIGNATURE_SET_ID,
        signatures: review.signatures,
      }),
      'utf8',
    ),
  );
}

export function catalogRecordReviewerSignatureSetSha256(review) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-record-reviewer-signature-set-v1',
        signatures: review.databaseReviewAuthorization.signatures.slice(0, 2),
      }),
      'utf8',
    ),
  );
}

export function catalogRegulatorySignatureSetSha256(review) {
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-regulatory-signature-set-v1',
        signatures: review.databaseReviewAuthorization.signatures.filter(
          (signature) => signature.decisionRole === 'regulatory_reviewer',
        ),
      }),
      'utf8',
    ),
  );
}

export function catalogDatabaseCampaignPlanSha256(plan) {
  return sha256(Buffer.from(canonicalJson(plan), 'utf8'));
}

function validateDatabaseSnapshot(snapshot) {
  assertExactKeys(
    snapshot,
    [
      'projectRefSha256',
      'capturedAt',
      'schemaMigrationVersion',
      'activeCat02BatchSha256',
      'candidateSetSha256',
      'servedStateMutationRootSetSha256',
      'sourceApprovalSetSha256',
      'cat03MigrationSha256',
      'cat03DatabaseContractTestSha256',
    ],
    'curation review.databaseSnapshot',
  );
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === 'capturedAt') assertTimestamp(value, `curation review.databaseSnapshot.${key}`);
    else if (key === 'schemaMigrationVersion') {
      if (value !== CATALOG_CURATION_REQUIRED_SCHEMA_MIGRATION_VERSION) {
        fail('curation review schema migration version is invalid.');
      }
    } else assertDigest(value, `curation review.databaseSnapshot.${key}`);
  }
  if (snapshot.cat03MigrationSha256 !== CATALOG_CURATION_REQUIRED_MIGRATION_SHA256) {
    fail('curation review CAT-03 migration digest does not match the exact current 0062 bytes.');
  }
  if (
    snapshot.cat03DatabaseContractTestSha256 !==
    CATALOG_CURATION_REQUIRED_DATABASE_CONTRACT_TEST_SHA256
  ) {
    fail(
      'curation review CAT-03 database-contract digest does not match the exact current pgTAP bytes.',
    );
  }
}

function validateRecordReview(
  record,
  index,
  regulatoryReviewer,
  databaseEligibilityPolicy,
  primaryArtifactAuthority,
) {
  const label = `curation review.records[${index}]`;
  assertExactKeys(
    record,
    [
      'productRecordSha256',
      'cat02StageRecordSha256',
      'cat02DatabaseNormalizedRecordSha256',
      'sourceApprovalSha256',
      'sourceQaSha256',
      'servedStateMutationRootSha256',
      'databaseBaseRecordSha256',
      'dependencyMemberships',
      'market',
      'categoryCode',
      'productClass',
      'decision',
      'demandPriorityRank',
      'demandPriorityCommitmentSha256',
      'reviews',
      'regulatoryEvidence',
    ],
    label,
  );
  for (const key of [
    'productRecordSha256',
    'cat02StageRecordSha256',
    'cat02DatabaseNormalizedRecordSha256',
    'sourceApprovalSha256',
    'sourceQaSha256',
    'servedStateMutationRootSha256',
    'databaseBaseRecordSha256',
  ]) {
    assertDigest(record[key], `${label}.${key}`);
  }
  assertArray(record.dependencyMemberships, `${label}.dependencyMemberships`, {
    min: DEPENDENCY_FIELD_SCOPES.size,
    max: MAX_DEPENDENCY_MEMBERSHIPS_PER_RECORD,
  });
  const dependencyMembershipKeys = [];
  for (const [membershipIndex, membership] of record.dependencyMemberships.entries()) {
    const membershipLabel = `${label}.dependencyMemberships[${membershipIndex}]`;
    assertExactKeys(
      membership,
      [
        'fieldScope',
        'dependencyEntitySha256',
        'batchId',
        'artifactSetSha256',
        'cat02StageRecordSha256',
        'cat02DatabaseNormalizedRecordSha256',
        'sourceApprovalSha256',
        'sourceQaSha256',
        'membershipEvidenceSha256',
      ],
      membershipLabel,
    );
    if (!DEPENDENCY_FIELD_SCOPES.has(membership.fieldScope)) {
      fail(`${membershipLabel}.fieldScope is invalid.`);
    }
    assertDigest(membership.dependencyEntitySha256, `${membershipLabel}.dependencyEntitySha256`);
    assertUuid(membership.batchId, `${membershipLabel}.batchId`);
    for (const key of [
      'artifactSetSha256',
      'cat02StageRecordSha256',
      'cat02DatabaseNormalizedRecordSha256',
      'sourceApprovalSha256',
      'sourceQaSha256',
      'membershipEvidenceSha256',
    ]) {
      assertDigest(membership[key], `${membershipLabel}.${key}`);
    }
    dependencyMembershipKeys.push(cat02RecordMembershipSortKey(membership));
  }
  const sortedDependencyMembershipKeys = [...dependencyMembershipKeys].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
  if (
    new Set(dependencyMembershipKeys).size !== dependencyMembershipKeys.length ||
    canonicalJson(dependencyMembershipKeys) !== canonicalJson(sortedDependencyMembershipKeys)
  ) {
    fail(
      `${label}.dependencyMemberships must be unique and sorted by field scope/dependency entity/batch.`,
    );
  }
  assertCat02DependencyMembershipCardinality(
    record.dependencyMemberships,
    `${label}.dependencyMemberships`,
    { productRecordSha256: record.productRecordSha256, primaryArtifactAuthority },
  );
  const primaryMembership = record.dependencyMemberships.find(
    (membership) => membership.fieldScope === 'barcode_identity',
  );
  if (
    primaryMembership.cat02StageRecordSha256 !== record.cat02StageRecordSha256 ||
    primaryMembership.cat02DatabaseNormalizedRecordSha256 !==
      record.cat02DatabaseNormalizedRecordSha256 ||
    primaryMembership.sourceApprovalSha256 !== record.sourceApprovalSha256 ||
    primaryMembership.sourceQaSha256 !== record.sourceQaSha256
  ) {
    fail(`${label} primary CAT-02 membership does not match its record authority hashes.`);
  }
  if (record.market !== 'US') fail(`${label}.market must match US Wave 1.`);
  if (!CATEGORY_CODES.has(record.categoryCode)) fail(`${label}.categoryCode is invalid.`);
  if (!PRODUCT_CLASSES.has(record.productClass)) fail(`${label}.productClass is invalid.`);
  if (!['eligible_for_activation', 'reject'].includes(record.decision)) {
    fail(`${label}.decision is invalid.`);
  }
  if (record.demandPriorityCommitmentSha256 !== null) {
    assertDigest(record.demandPriorityCommitmentSha256, `${label}.demandPriorityCommitmentSha256`);
  }
  if (record.demandPriorityRank !== null) {
    assertInteger(record.demandPriorityRank, `${label}.demandPriorityRank`, {
      min: 1,
      max: MAX_RECORDS,
    });
    if (
      record.demandPriorityCommitmentSha256 === null ||
      record.decision !== 'eligible_for_activation'
    ) {
      fail(`${label} priority rank requires an eligible record and demand commitment.`);
    }
  }
  assertExactKeys(
    record.reviews,
    [
      'barcodeReviewed',
      'nameReviewed',
      'brandReviewed',
      'categoryReviewed',
      'ingredientListReviewed',
      'ingredientTokensComplete',
      'ingredientMappingsComplete',
      'correctionHold',
      'qualityGrade',
    ],
    `${label}.reviews`,
  );
  const requiredTrue = [
    'barcodeReviewed',
    'nameReviewed',
    'brandReviewed',
    'categoryReviewed',
    'ingredientListReviewed',
    'ingredientTokensComplete',
    'ingredientMappingsComplete',
  ];
  for (const key of requiredTrue) {
    if (typeof record.reviews[key] !== 'boolean') fail(`${label}.reviews.${key} must be boolean.`);
  }
  if (typeof record.reviews.correctionHold !== 'boolean') {
    fail(`${label}.reviews.correctionHold must be boolean.`);
  }
  if (!['usable', 'verified'].includes(record.reviews.qualityGrade)) {
    fail(`${label}.reviews.qualityGrade is invalid.`);
  }
  if (
    record.decision === 'eligible_for_activation' &&
    (requiredTrue.some((key) => record.reviews[key] !== true) ||
      record.reviews.correctionHold !== false)
  ) {
    fail(`${label} cannot be eligible without complete positive review and no correction hold.`);
  }
  if (
    record.decision === 'eligible_for_activation' &&
    databaseEligibilityPolicy.requiredQualityGrade === 'verified' &&
    record.reviews.qualityGrade !== 'verified'
  ) {
    fail(`${label} cannot weaken the signed verified-only database eligibility policy.`);
  }
  const regulated =
    record.categoryCode === 'sunscreen' ||
    record.categoryCode === 'acne_treatment' ||
    record.productClass !== 'cosmetic';
  assertExactKeys(
    record.regulatoryEvidence,
    [
      'jurisdiction',
      'classification',
      'classificationEvidenceSha256',
      'regulatoryBasisEvidenceSha256',
      'usDrugFactsOrLabelRevisionSha256',
      'usDrugFactsOrLabelRevisionEvidenceSha256',
      'expiryStorageDisposition',
      'expiryStorageEvidenceSha256',
      'allowedAppBehavior',
      'prohibitedClaimSetSha256',
      'reviewerConditionsSha256',
      'qualifiedReviewerCredentialSha256',
      'classificationBasisReviewedAt',
      'labelRevisionReviewedAt',
      'effectiveAt',
      'expiresAt',
      'revalidationDueAt',
      'agencyProductApprovalClaimed',
    ],
    `${label}.regulatoryEvidence`,
  );
  if (
    record.regulatoryEvidence.jurisdiction !== 'US' ||
    record.regulatoryEvidence.classification !== record.productClass ||
    (regulated && !['otc_drug', 'combination_cosmetic_drug'].includes(record.productClass)) ||
    (!regulated && record.productClass !== 'cosmetic')
  ) {
    fail(`${label} market-specific cosmetic/OTC classification is inconsistent.`);
  }
  for (const key of [
    'classificationEvidenceSha256',
    'regulatoryBasisEvidenceSha256',
    'usDrugFactsOrLabelRevisionSha256',
    'usDrugFactsOrLabelRevisionEvidenceSha256',
    'expiryStorageEvidenceSha256',
    'prohibitedClaimSetSha256',
    'reviewerConditionsSha256',
    'qualifiedReviewerCredentialSha256',
  ]) {
    assertDigest(record.regulatoryEvidence[key], `${label}.regulatoryEvidence.${key}`);
  }
  for (const key of [
    'classificationBasisReviewedAt',
    'labelRevisionReviewedAt',
    'effectiveAt',
    'expiresAt',
    'revalidationDueAt',
  ]) {
    assertTimestamp(record.regulatoryEvidence[key], `${label}.regulatoryEvidence.${key}`);
  }
  const allowedExpiryStorage = regulated
    ? [
        'label_expiry_and_storage_reviewed',
        'stability_basis_and_storage_reviewed',
        'blocked_unresolved',
      ]
    : ['not_applicable_cosmetic'];
  if (
    !allowedExpiryStorage.includes(record.regulatoryEvidence.expiryStorageDisposition) ||
    record.regulatoryEvidence.allowedAppBehavior !== 'informational_catalog_display_only' ||
    record.regulatoryEvidence.agencyProductApprovalClaimed !== false ||
    timestamp(record.regulatoryEvidence.effectiveAt) >
      timestamp(record.regulatoryEvidence.classificationBasisReviewedAt) ||
    timestamp(record.regulatoryEvidence.classificationBasisReviewedAt) >=
      timestamp(record.regulatoryEvidence.expiresAt) ||
    timestamp(record.regulatoryEvidence.labelRevisionReviewedAt) >=
      timestamp(record.regulatoryEvidence.expiresAt) ||
    timestamp(record.regulatoryEvidence.revalidationDueAt) >
      timestamp(record.regulatoryEvidence.expiresAt)
  ) {
    fail(
      `${label} regulatory scope, validity, expiry/storage, or agency-approval posture is invalid.`,
    );
  }
  if (
    record.decision === 'eligible_for_activation' &&
    record.regulatoryEvidence.expiryStorageDisposition === 'blocked_unresolved'
  ) {
    fail(`${label} cannot activate with unresolved expiry/storage evidence.`);
  }
  if (
    record.regulatoryEvidence.qualifiedReviewerCredentialSha256 !==
    regulatoryReviewer.qualificationEvidenceSha256
  ) {
    fail(`${label} classification evidence is not bound to the qualified regulatory reviewer.`);
  }
}

export function wilsonOneSidedBounds(numerator, denominator) {
  assertInteger(numerator, 'Wilson numerator');
  assertInteger(denominator, 'Wilson denominator');
  if (numerator > denominator) fail('Wilson numerator cannot exceed denominator.');
  if (denominator === 0) {
    return Object.freeze({
      available: false,
      numerator: 0,
      denominator: 0,
      pointBasisPoints: null,
      lowerBasisPoints: null,
      upperBasisPoints: null,
    });
  }
  const z = 1.644_853_626_951_472_2;
  const p = numerator / denominator;
  const zSquared = z * z;
  const denominatorAdjustment = 1 + zSquared / denominator;
  const center = (p + zSquared / (2 * denominator)) / denominatorAdjustment;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / denominator + zSquared / (4 * denominator * denominator))) /
    denominatorAdjustment;
  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);
  return Object.freeze({
    available: true,
    numerator,
    denominator,
    pointBasisPoints: Math.round(p * 10_000),
    lowerBasisPoints: Math.floor((lower + Number.EPSILON) * 10_000),
    upperBasisPoints: Math.ceil((upper - Number.EPSILON) * 10_000),
  });
}

function gate(code, passed, actual, comparator, target) {
  return Object.freeze({ code, passed, actual, comparator, target });
}

export function evaluateCatalogCoverageTargets(targetPolicy, corpus) {
  const targets = targetPolicy.targets;
  const curation = corpus.cohorts.curation;
  const holdout = corpus.cohorts.holdout;
  const outcomes = holdout.outcomes;
  const correct = wilsonOneSidedBounds(outcomes.correctMatches, outcomes.lookupEvaluations);
  const wrong = wilsonOneSidedBounds(outcomes.incorrectMatches, outcomes.matchedEvaluations);
  const unknown = wilsonOneSidedBounds(
    outcomes.ingredientEvaluationsWithUnknownTokens,
    outcomes.ingredientEvaluations,
  );
  const belowUsableRecommendation = wilsonOneSidedBounds(
    outcomes.belowUsableRecommendations,
    outcomes.recommendationEvaluations,
  );
  const manualFallback = wilsonOneSidedBounds(
    outcomes.manualFallbackCompletions,
    outcomes.manualFallbackEvaluations,
  );
  const shelfFlow = wilsonOneSidedBounds(
    outcomes.shelfFlowCompletions,
    outcomes.shelfFlowEvaluations,
  );
  const curationDigests = new Set(
    curation.demandBuckets
      .filter((bucket) => bucket.suppression === 'none')
      .map((bucket) => bucket.productDemandCommitmentSha256),
  ).size;
  const holdoutDigests = new Set(
    holdout.demandBuckets
      .filter((bucket) => bucket.suppression === 'none')
      .map((bucket) => bucket.productDemandCommitmentSha256),
  ).size;
  const categoryRows = new Map(holdout.categoryOutcomes.map((row) => [row.categoryCode, row]));
  const categoryConfidence = Object.fromEntries(
    targets.requiredCategoryCodes.map((categoryCode) => {
      const row = categoryRows.get(categoryCode) ?? {
        lookupEvaluations: 0,
        correctMatches: 0,
        incorrectMatches: 0,
        ingredientEvaluations: 0,
        ingredientEvaluationsWithUnknownTokens: 0,
        recommendationEvaluations: 0,
        belowUsableRecommendations: 0,
      };
      const matchedEvaluations = row.correctMatches + row.incorrectMatches;
      return [
        categoryCode,
        {
          lookupEvaluations: row.lookupEvaluations,
          matchedEvaluations,
          ingredientEvaluations: row.ingredientEvaluations,
          recommendationEvaluations: row.recommendationEvaluations,
          correctMatch: wilsonOneSidedBounds(row.correctMatches, row.lookupEvaluations),
          wrongMatch: wilsonOneSidedBounds(row.incorrectMatches, matchedEvaluations),
          unknownIngredient: wilsonOneSidedBounds(
            row.ingredientEvaluationsWithUnknownTokens,
            row.ingredientEvaluations,
          ),
          belowUsableRecommendation: wilsonOneSidedBounds(
            row.belowUsableRecommendations,
            row.recommendationEvaluations,
          ),
        },
      ];
    }),
  );
  const operationalRows = new Map(
    holdout.operationalStratumOutcomes.map((row) => [`${row.routeCode}:${row.networkState}`, row]),
  );
  const operationalConfidence = Object.fromEntries(
    targets.requiredOperationalStrata.map(({ routeCode, networkState }) => {
      const key = `${routeCode}:${networkState}`;
      const row = operationalRows.get(key) ?? {
        manualFallbackEvaluations: 0,
        manualFallbackCompletions: 0,
        shelfFlowEvaluations: 0,
        shelfFlowCompletions: 0,
      };
      return [
        key,
        {
          routeCode,
          networkState,
          manualFallbackEvaluations: row.manualFallbackEvaluations,
          shelfFlowEvaluations: row.shelfFlowEvaluations,
          manualFallbackCompletion: wilsonOneSidedBounds(
            row.manualFallbackCompletions,
            row.manualFallbackEvaluations,
          ),
          shelfFlowCompletion: wilsonOneSidedBounds(
            row.shelfFlowCompletions,
            row.shelfFlowEvaluations,
          ),
        },
      ];
    }),
  );
  const gates = [
    gate(
      'curation_participants_minimum',
      curation.participants >= targets.minimumParticipants.curation,
      curation.participants,
      '>=',
      targets.minimumParticipants.curation,
    ),
    gate(
      'holdout_participants_minimum',
      holdout.participants >= targets.minimumParticipants.holdout,
      holdout.participants,
      '>=',
      targets.minimumParticipants.holdout,
    ),
    gate(
      'curation_contributors_minimum',
      curation.contributors >= targets.minimumContributors.curation,
      curation.contributors,
      '>=',
      targets.minimumContributors.curation,
    ),
    gate(
      'holdout_contributors_minimum',
      holdout.contributors >= targets.minimumContributors.holdout,
      holdout.contributors,
      '>=',
      targets.minimumContributors.holdout,
    ),
    gate(
      'holdout_lookup_denominator_minimum',
      outcomes.lookupEvaluations >= targets.minimumDenominators.holdoutLookupEvaluations,
      outcomes.lookupEvaluations,
      '>=',
      targets.minimumDenominators.holdoutLookupEvaluations,
    ),
    gate(
      'holdout_matched_denominator_minimum',
      outcomes.matchedEvaluations >= targets.minimumDenominators.holdoutMatchedEvaluations,
      outcomes.matchedEvaluations,
      '>=',
      targets.minimumDenominators.holdoutMatchedEvaluations,
    ),
    gate(
      'holdout_ingredient_evaluation_denominator_minimum',
      outcomes.ingredientEvaluations >= targets.minimumDenominators.holdoutIngredientEvaluations,
      outcomes.ingredientEvaluations,
      '>=',
      targets.minimumDenominators.holdoutIngredientEvaluations,
    ),
    gate(
      'holdout_recommendation_denominator_minimum',
      outcomes.recommendationEvaluations >=
        targets.minimumDenominators.holdoutRecommendationEvaluations,
      outcomes.recommendationEvaluations,
      '>=',
      targets.minimumDenominators.holdoutRecommendationEvaluations,
    ),
    gate(
      'holdout_manual_fallback_denominator_minimum',
      outcomes.manualFallbackEvaluations >=
        targets.minimumDenominators.holdoutManualFallbackEvaluations,
      outcomes.manualFallbackEvaluations,
      '>=',
      targets.minimumDenominators.holdoutManualFallbackEvaluations,
    ),
    gate(
      'holdout_shelf_flow_denominator_minimum',
      outcomes.shelfFlowEvaluations >= targets.minimumDenominators.holdoutShelfFlowEvaluations,
      outcomes.shelfFlowEvaluations,
      '>=',
      targets.minimumDenominators.holdoutShelfFlowEvaluations,
    ),
    gate(
      'curation_distinct_demand_digest_minimum',
      curationDigests >= targets.minimumDistinctDemandDigests.curation,
      curationDigests,
      '>=',
      targets.minimumDistinctDemandDigests.curation,
    ),
    gate(
      'holdout_distinct_demand_digest_minimum',
      holdoutDigests >= targets.minimumDistinctDemandDigests.holdout,
      holdoutDigests,
      '>=',
      targets.minimumDistinctDemandDigests.holdout,
    ),
    gate(
      'holdout_correct_match_wilson_lower_bound',
      correct.available &&
        outcomes.lookupEvaluations >= targets.minimumDenominators.holdoutLookupEvaluations &&
        correct.lowerBasisPoints >= targets.thresholdsBasisPoints.holdoutCorrectMatchLowerBoundMin,
      correct.lowerBasisPoints,
      '>=',
      targets.thresholdsBasisPoints.holdoutCorrectMatchLowerBoundMin,
    ),
    gate(
      'holdout_wrong_match_wilson_upper_bound',
      wrong.available &&
        outcomes.matchedEvaluations >= targets.minimumDenominators.holdoutMatchedEvaluations &&
        wrong.upperBasisPoints <= targets.thresholdsBasisPoints.holdoutWrongMatchUpperBoundMax,
      wrong.upperBasisPoints,
      '<=',
      targets.thresholdsBasisPoints.holdoutWrongMatchUpperBoundMax,
    ),
    gate(
      'holdout_unknown_token_wilson_upper_bound',
      unknown.available &&
        outcomes.ingredientEvaluations >=
          targets.minimumDenominators.holdoutIngredientEvaluations &&
        unknown.upperBasisPoints <= targets.thresholdsBasisPoints.holdoutUnknownTokenUpperBoundMax,
      unknown.upperBasisPoints,
      '<=',
      targets.thresholdsBasisPoints.holdoutUnknownTokenUpperBoundMax,
    ),
    gate(
      'holdout_below_usable_recommendation_wilson_upper_bound',
      belowUsableRecommendation.available &&
        outcomes.recommendationEvaluations >=
          targets.minimumDenominators.holdoutRecommendationEvaluations &&
        belowUsableRecommendation.upperBasisPoints <=
          targets.thresholdsBasisPoints.holdoutBelowUsableRecommendationUpperBoundMax,
      belowUsableRecommendation.upperBasisPoints,
      '<=',
      targets.thresholdsBasisPoints.holdoutBelowUsableRecommendationUpperBoundMax,
    ),
    gate(
      'holdout_manual_fallback_wilson_lower_bound',
      manualFallback.available &&
        outcomes.manualFallbackEvaluations >=
          targets.minimumDenominators.holdoutManualFallbackEvaluations &&
        manualFallback.lowerBasisPoints >=
          targets.thresholdsBasisPoints.holdoutManualFallbackCompletionLowerBoundMin,
      manualFallback.lowerBasisPoints,
      '>=',
      targets.thresholdsBasisPoints.holdoutManualFallbackCompletionLowerBoundMin,
    ),
    gate(
      'holdout_shelf_flow_wilson_lower_bound',
      shelfFlow.available &&
        outcomes.shelfFlowEvaluations >= targets.minimumDenominators.holdoutShelfFlowEvaluations &&
        shelfFlow.lowerBasisPoints >=
          targets.thresholdsBasisPoints.holdoutShelfFlowCompletionLowerBoundMin,
      shelfFlow.lowerBasisPoints,
      '>=',
      targets.thresholdsBasisPoints.holdoutShelfFlowCompletionLowerBoundMin,
    ),
    gate(
      'below_usable_recommendations_zero',
      outcomes.belowUsableRecommendations === 0,
      outcomes.belowUsableRecommendations,
      '=',
      0,
    ),
    gate(
      'open_wrong_match_reports_zero',
      outcomes.openWrongMatchReports === 0,
      outcomes.openWrongMatchReports,
      '=',
      0,
    ),
    gate(
      'open_p0_p1_incidents_zero',
      outcomes.openP0P1Incidents === 0,
      outcomes.openP0P1Incidents,
      '=',
      0,
    ),
    ...targets.requiredCategoryCodes.flatMap((categoryCode) => {
      const category = categoryConfidence[categoryCode];
      return [
        gate(
          `holdout_category_${categoryCode}_lookup_minimum`,
          category.lookupEvaluations >= targets.minimumCategoryDenominators.lookupEvaluations,
          category.lookupEvaluations,
          '>=',
          targets.minimumCategoryDenominators.lookupEvaluations,
        ),
        gate(
          `holdout_category_${categoryCode}_matched_minimum`,
          category.matchedEvaluations >= targets.minimumCategoryDenominators.matchedEvaluations,
          category.matchedEvaluations,
          '>=',
          targets.minimumCategoryDenominators.matchedEvaluations,
        ),
        gate(
          `holdout_category_${categoryCode}_ingredient_minimum`,
          category.ingredientEvaluations >=
            targets.minimumCategoryDenominators.ingredientEvaluations,
          category.ingredientEvaluations,
          '>=',
          targets.minimumCategoryDenominators.ingredientEvaluations,
        ),
        gate(
          `holdout_category_${categoryCode}_recommendation_minimum`,
          category.recommendationEvaluations >=
            targets.minimumCategoryDenominators.recommendationEvaluations,
          category.recommendationEvaluations,
          '>=',
          targets.minimumCategoryDenominators.recommendationEvaluations,
        ),
        gate(
          `holdout_category_${categoryCode}_correct_match_wilson_lower_bound`,
          category.correctMatch.available &&
            category.lookupEvaluations >= targets.minimumCategoryDenominators.lookupEvaluations &&
            category.correctMatch.lowerBasisPoints >=
              targets.thresholdsBasisPoints.holdoutCorrectMatchLowerBoundMin,
          category.correctMatch.lowerBasisPoints,
          '>=',
          targets.thresholdsBasisPoints.holdoutCorrectMatchLowerBoundMin,
        ),
        gate(
          `holdout_category_${categoryCode}_wrong_match_wilson_upper_bound`,
          category.wrongMatch.available &&
            category.matchedEvaluations >= targets.minimumCategoryDenominators.matchedEvaluations &&
            category.wrongMatch.upperBasisPoints <=
              targets.thresholdsBasisPoints.holdoutWrongMatchUpperBoundMax,
          category.wrongMatch.upperBasisPoints,
          '<=',
          targets.thresholdsBasisPoints.holdoutWrongMatchUpperBoundMax,
        ),
        gate(
          `holdout_category_${categoryCode}_unknown_ingredient_wilson_upper_bound`,
          category.unknownIngredient.available &&
            category.ingredientEvaluations >=
              targets.minimumCategoryDenominators.ingredientEvaluations &&
            category.unknownIngredient.upperBasisPoints <=
              targets.thresholdsBasisPoints.holdoutUnknownTokenUpperBoundMax,
          category.unknownIngredient.upperBasisPoints,
          '<=',
          targets.thresholdsBasisPoints.holdoutUnknownTokenUpperBoundMax,
        ),
        gate(
          `holdout_category_${categoryCode}_below_usable_recommendation_wilson_upper_bound`,
          category.belowUsableRecommendation.available &&
            category.recommendationEvaluations >=
              targets.minimumCategoryDenominators.recommendationEvaluations &&
            category.belowUsableRecommendation.upperBasisPoints <=
              targets.thresholdsBasisPoints.holdoutBelowUsableRecommendationUpperBoundMax,
          category.belowUsableRecommendation.upperBasisPoints,
          '<=',
          targets.thresholdsBasisPoints.holdoutBelowUsableRecommendationUpperBoundMax,
        ),
        gate(
          `holdout_category_${categoryCode}_below_usable_recommendations_zero`,
          category.belowUsableRecommendation.numerator === 0,
          category.belowUsableRecommendation.numerator,
          '=',
          0,
        ),
      ];
    }),
    ...targets.requiredOperationalStrata.flatMap(({ routeCode, networkState }) => {
      const stratumCode = `${routeCode}:${networkState}`;
      const operational = operationalConfidence[stratumCode];
      const gateCode = `${routeCode}_${networkState}`;
      return [
        gate(
          `holdout_operational_${gateCode}_manual_fallback_minimum`,
          operational.manualFallbackEvaluations >=
            targets.minimumOperationalStratumDenominators.manualFallbackEvaluations,
          operational.manualFallbackEvaluations,
          '>=',
          targets.minimumOperationalStratumDenominators.manualFallbackEvaluations,
        ),
        gate(
          `holdout_operational_${gateCode}_shelf_flow_minimum`,
          operational.shelfFlowEvaluations >=
            targets.minimumOperationalStratumDenominators.shelfFlowEvaluations,
          operational.shelfFlowEvaluations,
          '>=',
          targets.minimumOperationalStratumDenominators.shelfFlowEvaluations,
        ),
        gate(
          `holdout_operational_${gateCode}_manual_fallback_wilson_lower_bound`,
          operational.manualFallbackCompletion.available &&
            operational.manualFallbackEvaluations >=
              targets.minimumOperationalStratumDenominators.manualFallbackEvaluations &&
            operational.manualFallbackCompletion.lowerBasisPoints >=
              targets.thresholdsBasisPoints.holdoutManualFallbackCompletionLowerBoundMin,
          operational.manualFallbackCompletion.lowerBasisPoints,
          '>=',
          targets.thresholdsBasisPoints.holdoutManualFallbackCompletionLowerBoundMin,
        ),
        gate(
          `holdout_operational_${gateCode}_shelf_flow_wilson_lower_bound`,
          operational.shelfFlowCompletion.available &&
            operational.shelfFlowEvaluations >=
              targets.minimumOperationalStratumDenominators.shelfFlowEvaluations &&
            operational.shelfFlowCompletion.lowerBasisPoints >=
              targets.thresholdsBasisPoints.holdoutShelfFlowCompletionLowerBoundMin,
          operational.shelfFlowCompletion.lowerBasisPoints,
          '>=',
          targets.thresholdsBasisPoints.holdoutShelfFlowCompletionLowerBoundMin,
        ),
      ];
    }),
  ];
  return Object.freeze({
    gates,
    clear: gates.every((entry) => entry.passed),
    confidence: {
      correctMatch: correct,
      wrongMatch: wrong,
      unknownToken: unknown,
      belowUsableRecommendation,
      manualFallbackCompletion: manualFallback,
      shelfFlowCompletion: shelfFlow,
      requiredCategories: categoryConfidence,
      operationalStrata: operationalConfidence,
    },
    evaluationUnit: {
      unit: targetPolicy.sampling.wilsonEvaluationUnit,
      maxEvaluationsPerParticipantPerEndpoint:
        targetPolicy.sampling.maxWilsonEvaluationsPerParticipantPerEndpoint,
      clusteredInputsPresent: corpus.evaluationUnitAudit.clusteredWilsonInputsPresent,
      confidenceBoundsAreMarginalNotSimultaneous:
        targetPolicy.analysis.confidenceBoundsAreMarginalNotSimultaneous,
      multipleComparisonDecisionRule: targetPolicy.analysis.multipleComparisonDecisionRule,
    },
    distinctDemandDigests: { curation: curationDigests, holdout: holdoutDigests },
  });
}

export function evaluateCatalogInventoryTargets(targetPolicy, review) {
  const eligibleRecords = review.records.filter(
    (record) => record.decision === 'eligible_for_activation',
  );
  const prioritizedEligibleRecords = eligibleRecords.filter(
    (record) => record.demandPriorityRank !== null,
  );
  const eligibleByCategory = Object.fromEntries(
    targetPolicy.targets.requiredCategoryCodes.map((categoryCode) => [
      categoryCode,
      eligibleRecords.filter((record) => record.categoryCode === categoryCode).length,
    ]),
  );
  const gates = [
    gate(
      'eligible_catalog_record_floor',
      eligibleRecords.length >= targetPolicy.targets.inventory.minimumEligibleCatalogRecords,
      eligibleRecords.length,
      '>=',
      targetPolicy.targets.inventory.minimumEligibleCatalogRecords,
    ),
    gate(
      'prioritized_eligible_catalog_record_floor',
      prioritizedEligibleRecords.length >=
        targetPolicy.targets.inventory.minimumPrioritizedEligibleRecords,
      prioritizedEligibleRecords.length,
      '>=',
      targetPolicy.targets.inventory.minimumPrioritizedEligibleRecords,
    ),
    ...targetPolicy.targets.requiredCategoryCodes.map((categoryCode) =>
      gate(
        `eligible_category_${categoryCode}_floor`,
        eligibleByCategory[categoryCode] >=
          targetPolicy.targets.inventory.minimumEligibleByRequiredCategory[categoryCode],
        eligibleByCategory[categoryCode],
        '>=',
        targetPolicy.targets.inventory.minimumEligibleByRequiredCategory[categoryCode],
      ),
    ),
  ];
  return Object.freeze({
    clear: gates.every((entry) => entry.passed),
    gates,
    reviewedRecordCount: review.records.length,
    eligibleRecordCount: eligibleRecords.length,
    prioritizedEligibleRecordCount: prioritizedEligibleRecords.length,
    eligibleByCategory,
  });
}

export function validateCatalogCurationReview(
  review,
  { targetPolicy, betaShelfCorpus, cat02MembershipProof, trustRegistry } = {},
) {
  if (!targetPolicy || !betaShelfCorpus || !cat02MembershipProof || !trustRegistry) {
    fail(
      'curation review validation requires target policy, beta corpus, CAT-02 proof, and trust registry.',
    );
  }
  assertExactKeys(
    review,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'releaseId',
      'targetPolicySha256',
      'betaShelfCorpusSha256',
      'databaseEligibilityPolicySha256',
      'cat02MembershipProofSha256',
      'cat02DatabaseObservationSha256',
      'cat02VerifierSignatureSetSha256',
      'cat02ProductionIntegritySetSha256',
      'curationOutcomeReviewerSignatureSetSha256',
      'lineage',
      'curationDecisionCommittedAt',
      'reviewedAt',
      'databaseSnapshot',
      'authority',
      'inventoryCommitment',
      'databaseReviewAuthorization',
      'databaseCampaignPlan',
      'databaseCampaignPlanSha256',
      'records',
      'reviewers',
      'activation',
      'signatures',
    ],
    'curation review',
  );
  if (
    review.schemaVersion !== 1 ||
    review.contractId !== CATALOG_CURATION_REVIEW_CONTRACT_ID ||
    review.signatureEnvelopeVersion !== CATALOG_CURATION_SIGNATURE_ENVELOPE ||
    review.signingDomain !== CATALOG_CURATION_SIGNING_DOMAIN
  ) {
    fail('curation review schema, contract, signature envelope, or signing domain is invalid.');
  }
  assertId(review.releaseId, 'curation review.releaseId');
  assertDigest(review.targetPolicySha256, 'curation review.targetPolicySha256');
  assertDigest(review.betaShelfCorpusSha256, 'curation review.betaShelfCorpusSha256');
  assertDigest(
    review.databaseEligibilityPolicySha256,
    'curation review.databaseEligibilityPolicySha256',
  );
  assertDigest(review.cat02MembershipProofSha256, 'curation review.cat02MembershipProofSha256');
  assertDigest(
    review.cat02DatabaseObservationSha256,
    'curation review.cat02DatabaseObservationSha256',
  );
  assertDigest(
    review.cat02VerifierSignatureSetSha256,
    'curation review.cat02VerifierSignatureSetSha256',
  );
  assertDigest(
    review.cat02ProductionIntegritySetSha256,
    'curation review.cat02ProductionIntegritySetSha256',
  );
  assertDigest(
    review.curationOutcomeReviewerSignatureSetSha256,
    'curation review.curationOutcomeReviewerSignatureSetSha256',
  );
  if (
    review.targetPolicySha256 !== catalogDocumentSha256(targetPolicy) ||
    review.betaShelfCorpusSha256 !== catalogDocumentSha256(betaShelfCorpus)
  ) {
    fail('curation review does not bind the exact policy and corpus.');
  }
  if (review.databaseEligibilityPolicySha256 !== targetPolicy.databaseEligibilityPolicySha256) {
    fail('curation review does not bind the pre-outcome 0058 database eligibility policy.');
  }
  const reviewedServedStateMutationRootSetSha256 = catalogServedStateMutationRootSetSha256(
    review.records,
  );
  assertDigest(
    cat02MembershipProof.databaseObservation?.observedServedStateMutationRootSetSha256,
    'CAT-02 database observation.observedServedStateMutationRootSetSha256',
  );
  if (
    review.databaseSnapshot?.servedStateMutationRootSetSha256 !==
      reviewedServedStateMutationRootSetSha256 ||
    cat02MembershipProof.databaseObservation.observedServedStateMutationRootSetSha256 !==
      reviewedServedStateMutationRootSetSha256
  ) {
    fail(
      'served-state mutation root set is missing, tampered, or stale relative to the independent pre-review database observation.',
    );
  }
  if (
    review.cat02MembershipProofSha256 !== catalogDocumentSha256(cat02MembershipProof) ||
    review.cat02DatabaseObservationSha256 !==
      catalogCat02DatabaseObservationSha256(cat02MembershipProof) ||
    review.cat02VerifierSignatureSetSha256 !==
      catalogCat02VerifierSignatureSetSha256(cat02MembershipProof) ||
    review.cat02ProductionIntegritySetSha256 !==
      catalogCat02ProductionIntegritySetSha256(cat02MembershipProof.artifactSets)
  ) {
    fail('curation review does not bind the exact signed CAT-02 proof/observation/signature set.');
  }
  const primaryArtifactAuthority = catalogCat02PrimaryArtifactAuthority(
    cat02MembershipProof,
    targetPolicy,
  );
  if (
    canonicalJson(review.databaseReviewAuthorization) !==
    canonicalJson(betaShelfCorpus.curationDecisionAuthority.databaseReviewAuthorization)
  ) {
    fail('curation review does not bind the exact pre-holdout database review authorization.');
  }
  validateLineage(review.lineage, 'curation review.lineage');
  assertCanonicalEqual(review.lineage, targetPolicy.lineage, 'curation review.lineage');
  assertTimestamp(
    review.curationDecisionCommittedAt,
    'curation review.curationDecisionCommittedAt',
  );
  assertTimestamp(review.reviewedAt, 'curation review.reviewedAt');
  if (
    review.curationDecisionCommittedAt !==
      betaShelfCorpus.splitTimeline.curationDecisionCommittedAt ||
    review.releaseId !== betaShelfCorpus.curationDecisionAuthority.releaseId ||
    timestamp(review.reviewedAt) < timestamp(betaShelfCorpus.splitTimeline.holdoutSealedAt)
  ) {
    fail('curation review timeline does not bind the pre-holdout decision commitment.');
  }
  if (
    timestamp(cat02MembershipProof.databaseObservation.capturedAt) >= timestamp(review.reviewedAt)
  ) {
    fail('served-state mutation roots must be independently observed before outcome review.');
  }
  validateDatabaseSnapshot(review.databaseSnapshot);
  if (
    timestamp(review.databaseSnapshot.capturedAt) <
      timestamp(targetPolicy.collectionWindow.closesAt) ||
    timestamp(review.databaseSnapshot.capturedAt) >
      timestamp(betaShelfCorpus.splitTimeline.curationDecisionCommittedAt)
  ) {
    fail(
      'curation database snapshot must be captured after collection and no later than the pre-holdout decision commitment.',
    );
  }
  if (
    review.databaseSnapshot.sourceApprovalSetSha256 !== targetPolicy.lineage.cat01ApprovalSetSha256
  ) {
    fail('curation database snapshot does not bind the exact CAT-01 approval set.');
  }
  if (
    review.databaseSnapshot.projectRefSha256 !==
    cat02MembershipProof.databaseObservation.projectRefSha256
  ) {
    fail('curation snapshot and signed CAT-02 membership observation use different projects.');
  }
  assertExactKeys(
    review.authority,
    [
      'productFactSources',
      'betaDemandUse',
      'servingAuthorization',
      'selfSelectedCorpusRepresentativenessClaimed',
      'allProductsIndependentlySourced',
    ],
    'curation review.authority',
  );
  assertCanonicalEqual(
    review.authority.productFactSources,
    ['cat01_signed_source_approval', 'cat02_transactional_promotion'],
    'curation review.authority.productFactSources',
  );
  if (
    review.authority.betaDemandUse !==
      'prioritization_only_never_product_facts_or_serving_authority' ||
    review.authority.servingAuthorization !== 'cat03_database_activation_only'
  ) {
    fail('curation review authority improperly promotes beta demand into product facts.');
  }
  assertBoolean(
    review.authority.selfSelectedCorpusRepresentativenessClaimed,
    false,
    'curation review.authority.selfSelectedCorpusRepresentativenessClaimed',
  );
  assertBoolean(
    review.authority.allProductsIndependentlySourced,
    true,
    'curation review.authority.allProductsIndependentlySourced',
  );
  assertExactKeys(
    review.inventoryCommitment,
    [
      'expectedReviewedRecordCount',
      'expectedEligibleRecordCount',
      'completeReviewedRecordSetSha256',
      'candidateSetSha256',
      'cat02MembershipSetSha256',
    ],
    'curation review.inventoryCommitment',
  );
  assertInteger(
    review.inventoryCommitment.expectedReviewedRecordCount,
    'curation review.inventoryCommitment.expectedReviewedRecordCount',
    { min: 2_000, max: MAX_RECORDS },
  );
  assertInteger(
    review.inventoryCommitment.expectedEligibleRecordCount,
    'curation review.inventoryCommitment.expectedEligibleRecordCount',
    { min: 2_000, max: MAX_RECORDS },
  );
  for (const key of [
    'completeReviewedRecordSetSha256',
    'candidateSetSha256',
    'cat02MembershipSetSha256',
  ]) {
    assertDigest(review.inventoryCommitment[key], `curation review.inventoryCommitment.${key}`);
  }
  assertArray(review.records, 'curation review.records', { min: 2_000, max: MAX_RECORDS });
  assertArray(review.reviewers, 'curation review.reviewers', { min: 4, max: 4 });
  const requiredReviewerRoles = [
    { decisionRole: 'catalog_quality_reviewer', trustRegistryRole: 'engineering' },
    { decisionRole: 'data_quality_reviewer', trustRegistryRole: 'engineering' },
    { decisionRole: 'regulatory_reviewer', trustRegistryRole: 'legal' },
    { decisionRole: 'privacy_release_verifier', trustRegistryRole: 'legal' },
  ];
  for (const [index, required] of requiredReviewerRoles.entries()) {
    validateSignerDescriptor(
      review.reviewers[index],
      `curation review.reviewers[${index}]`,
      required.decisionRole,
      required.trustRegistryRole,
    );
  }
  assertExactKeys(
    review.activation,
    [
      'decision',
      'operator',
      'plannedAt',
      'operationKeyPrefix',
      'reasonCode',
      'activationAuthorizationSetSha256',
      'authorizationSignature',
    ],
    'curation review.activation',
  );
  if (!['approve_activation', 'withhold_activation'].includes(review.activation.decision)) {
    fail('curation review.activation.decision is invalid.');
  }
  validateSignerDescriptor(
    review.activation.operator,
    'curation review.activation.operator',
    'activation_operator',
    'engineering',
  );
  assertSignerIndependentFrom(
    review.activation.operator,
    review.reviewers,
    'curation activation operator',
  );
  assertTimestamp(review.activation.plannedAt, 'curation review.activation.plannedAt');
  if (
    review.activation.operationKeyPrefix !== 'cat03.activate' ||
    review.activation.reasonCode !== 'initial_launch_catalog_activation'
  ) {
    fail('curation activation operation-key prefix/reason vocabulary is invalid.');
  }
  assertDigest(
    review.activation.activationAuthorizationSetSha256,
    'curation review.activation.activationAuthorizationSetSha256',
  );
  assertExactKeys(
    review.activation.authorizationSignature,
    SIGNATURE_KEYS,
    'curation review.activation.authorizationSignature',
  );
  if (timestamp(review.activation.plannedAt) < timestamp(review.reviewedAt)) {
    fail('activation cannot be planned before review completion.');
  }
  const allSigners = [...review.reviewers, review.activation.operator];
  const activationSignature = review.activation.authorizationSignature;
  if (
    activationSignature.decisionRole !== 'activation_operator' ||
    activationSignature.reviewerId !== review.activation.operator.reviewerId ||
    activationSignature.trustRegistryKeyId !== review.activation.operator.trustRegistryKeyId ||
    activationSignature.algorithm !== 'Ed25519'
  ) {
    fail('activation authorization signature identity must bind the exact operator.');
  }
  assertId(
    activationSignature.reviewerId,
    'curation review.activation.authorizationSignature.reviewerId',
  );
  assertKeyId(
    activationSignature.trustRegistryKeyId,
    'curation review.activation.authorizationSignature.trustRegistryKeyId',
  );
  assertTimestamp(
    activationSignature.signedAt,
    'curation review.activation.authorizationSignature.signedAt',
  );
  if (timestamp(activationSignature.signedAt) < timestamp(review.activation.plannedAt)) {
    fail('activation operator cannot sign before the planned activation instant.');
  }
  validateSignedRoles({
    document: review,
    signers: review.reviewers,
    signatures: review.signatures,
    requiredRoles: requiredReviewerRoles,
    trustRegistry,
    payload: catalogCurationReviewSigningPayload,
    earliestSignedAt: review.reviewedAt,
    latestSignedAt: review.databaseReviewAuthorization.validUntil,
    label: 'curation review',
  });
  const expectedOutcomeReviewerSignatureSetSha256 =
    catalogCurationOutcomeReviewerSignatureSetSha256(review);
  if (
    review.curationOutcomeReviewerSignatureSetSha256 !== expectedOutcomeReviewerSignatureSetSha256
  ) {
    fail('curation outcome-reviewer signature-set root does not match all four exact signatures.');
  }
  const latestReviewerSignedAt = review.signatures
    .map((signature) => timestamp(signature.signedAt))
    .reduce((latest, value) => Math.max(latest, value), Number.NEGATIVE_INFINITY);
  if (timestamp(review.activation.plannedAt) <= latestReviewerSignedAt) {
    fail('planned activation must be strictly after every outcome reviewer signature.');
  }
  if (timestamp(activationSignature.signedAt) <= latestReviewerSignedAt) {
    fail('activation operator must sign strictly after every outcome reviewer signature.');
  }
  const activationSignatureBytes = assertCanonicalBase64Signature(
    activationSignature.valueBase64,
    'curation review.activation.authorizationSignature.valueBase64',
  );
  const activationPublicKey = trustedSigner(
    review.activation.operator,
    activationSignature,
    trustRegistry,
    'curation activation operator',
  );
  if (
    !verifyCryptographicSignature(
      null,
      catalogActivationAuthorizationSigningPayload(review, activationSignature),
      activationPublicKey,
      activationSignatureBytes,
    )
  ) {
    fail('activation operator signature does not authorize the exact request set.');
  }
  const recordKeys = [];
  const stageRecordKeys = [];
  const normalizedRecordKeys = [];
  const ranks = [];
  const priorityCommitments = [];
  for (const [index, record] of review.records.entries()) {
    validateRecordReview(
      record,
      index,
      review.reviewers[2],
      targetPolicy.databaseEligibilityPolicy,
      primaryArtifactAuthority,
    );
    recordKeys.push(record.productRecordSha256);
    stageRecordKeys.push(record.cat02StageRecordSha256);
    normalizedRecordKeys.push(record.cat02DatabaseNormalizedRecordSha256);
    if (record.demandPriorityRank !== null) {
      ranks.push(record.demandPriorityRank);
      priorityCommitments.push(record.demandPriorityCommitmentSha256);
    }
    if (
      record.regulatoryEvidence &&
      (timestamp(record.regulatoryEvidence.classificationBasisReviewedAt) >
        timestamp(review.curationDecisionCommittedAt) ||
        timestamp(record.regulatoryEvidence.labelRevisionReviewedAt) >
          timestamp(review.curationDecisionCommittedAt) ||
        timestamp(record.regulatoryEvidence.effectiveAt) >
          timestamp(review.curationDecisionCommittedAt) ||
        timestamp(record.regulatoryEvidence.expiresAt) <= timestamp(activationSignature.signedAt) ||
        timestamp(record.regulatoryEvidence.revalidationDueAt) <
          timestamp(activationSignature.signedAt))
    ) {
      fail(
        `curation review.records[${index}] regulatory evidence is post-commitment, expired, or stale at activation.`,
      );
    }
  }
  const sortedRecordKeys = [...recordKeys].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
  if (
    new Set(recordKeys).size !== recordKeys.length ||
    canonicalJson(recordKeys) !== canonicalJson(sortedRecordKeys)
  ) {
    fail('curation review.records must be unique and sorted by productRecordSha256.');
  }
  if (
    new Set(stageRecordKeys).size !== stageRecordKeys.length ||
    new Set(normalizedRecordKeys).size !== normalizedRecordKeys.length
  ) {
    fail('curation review records must bind distinct CAT-02 stage and normalized database rows.');
  }
  const expectedRanks = Array.from({ length: ranks.length }, (_, index) => index + 1);
  if (
    new Set(ranks).size !== ranks.length ||
    new Set(priorityCommitments).size !== priorityCommitments.length ||
    canonicalJson([...ranks].sort((left, right) => left - right)) !== canonicalJson(expectedRanks)
  ) {
    fail(
      'curation review demand priorities must use unique commitments and contiguous unique ranks.',
    );
  }
  if (
    review.databaseSnapshot.candidateSetSha256 !== catalogCurationCandidateSetSha256(review.records)
  ) {
    fail('curation database snapshot candidate set does not match the exact reviewed records.');
  }
  const decisionCommitmentSha256 = catalogCurationDecisionCommitment(review.records);
  const candidateSetSha256 = catalogCurationCandidateSetSha256(review.records);
  const membershipSetSha256 = catalogCat02MembershipSetSha256(review.records);
  const expectedEligibleRecordCount = review.records.filter(
    (record) => record.decision === 'eligible_for_activation',
  ).length;
  const expectedPrioritizedEligibleRecordCount = review.records.filter(
    (record) => record.decision === 'eligible_for_activation' && record.demandPriorityRank !== null,
  ).length;
  if (
    review.inventoryCommitment.expectedReviewedRecordCount !== review.records.length ||
    review.inventoryCommitment.expectedEligibleRecordCount !== expectedEligibleRecordCount ||
    review.inventoryCommitment.completeReviewedRecordSetSha256 !== decisionCommitmentSha256 ||
    review.inventoryCommitment.candidateSetSha256 !== candidateSetSha256 ||
    review.inventoryCommitment.cat02MembershipSetSha256 !== membershipSetSha256 ||
    membershipSetSha256 !== cat02MembershipProof.membershipSetSha256 ||
    review.databaseSnapshot.candidateSetSha256 !== candidateSetSha256
  ) {
    fail(
      'curation inventory commitment does not exactly bind the complete reviewed/eligible/CAT-02 record sets.',
    );
  }
  const flattenedMemberships = review.records.flatMap((record) =>
    record.dependencyMemberships.map((membership) => ({
      productRecordSha256: record.productRecordSha256,
      ...membership,
    })),
  );
  if (canonicalJson(flattenedMemberships) !== canonicalJson(cat02MembershipProof.memberships)) {
    fail('curation records do not exactly match every signed CAT-02 product/field membership.');
  }
  const preholdoutAuthority = betaShelfCorpus.curationDecisionAuthority;
  if (
    preholdoutAuthority.reviewedRecordCount !== review.records.length ||
    preholdoutAuthority.eligibleRecordCount !== expectedEligibleRecordCount ||
    preholdoutAuthority.prioritizedEligibleRecordCount !== expectedPrioritizedEligibleRecordCount ||
    preholdoutAuthority.curationDecisionCommitmentSha256 !== decisionCommitmentSha256 ||
    preholdoutAuthority.candidateSetSha256 !== candidateSetSha256 ||
    preholdoutAuthority.cat02MembershipProofSha256 !== review.cat02MembershipProofSha256 ||
    preholdoutAuthority.cat02MembershipSetSha256 !== membershipSetSha256
  ) {
    fail('curation review differs from the complete signed pre-holdout record authority.');
  }
  const priorAuthoritySigners = [
    ...targetPolicy.signers,
    ...cat02MembershipProof.signers,
    ...betaShelfCorpus.curationDecisionAuthority.signers,
    betaShelfCorpus.curationDecisionAuthority.externalTimestampSigner,
    ...betaShelfCorpus.holdoutControlReceipt.signers,
    ...betaShelfCorpus.privacyExecutionReceipt.signers,
  ];
  for (const signer of allSigners) {
    assertSignerIndependentFrom(
      signer,
      priorAuthoritySigners,
      `curation outcome role ${signer.decisionRole}`,
    );
  }
  const unsuppressedDemandByDigest = new Map(
    betaShelfCorpus.cohorts.curation.demandBuckets
      .filter((bucket) => bucket.suppression === 'none')
      .map((bucket) => [bucket.productDemandCommitmentSha256, bucket]),
  );
  const recordByDemandDigest = new Map();
  for (const [index, record] of review.records.entries()) {
    if (record.demandPriorityCommitmentSha256 === null) continue;
    const demand = unsuppressedDemandByDigest.get(record.demandPriorityCommitmentSha256);
    if (!demand) {
      fail(
        `curation review.records[${index}] disposition is not supported by an unsuppressed curation-cohort HMAC commitment.`,
      );
    }
    if (demand.categoryCode !== record.categoryCode) {
      fail(`curation review.records[${index}] demand category does not match the reviewed record.`);
    }
    if (recordByDemandDigest.has(record.demandPriorityCommitmentSha256)) {
      fail('each unsuppressed curation demand commitment must map to exactly one disposition.');
    }
    recordByDemandDigest.set(record.demandPriorityCommitmentSha256, record);
  }
  for (const demandDigest of unsuppressedDemandByDigest.keys()) {
    if (!recordByDemandDigest.has(demandDigest)) {
      fail(
        'every unsuppressed curation demand commitment requires exactly one reviewed disposition.',
      );
    }
  }
  if (decisionCommitmentSha256 !== betaShelfCorpus.splitTimeline.curationDecisionCommitmentSha256) {
    fail('curation review records do not match the decision commitment sealed before holdout.');
  }
  const quality = evaluateCatalogCoverageTargets(targetPolicy, betaShelfCorpus);
  const inventory = evaluateCatalogInventoryTargets(targetPolicy, review);
  const expectedAuthorizationSetSha256 = catalogCurationActivationAuthorizationSetSha256(review);
  if (review.activation.activationAuthorizationSetSha256 !== expectedAuthorizationSetSha256) {
    fail(
      'curation activation authorization-set digest does not match every exact eligible request.',
    );
  }
  const databaseReviewAuthorization =
    betaShelfCorpus.curationDecisionAuthority.databaseReviewAuthorization;
  if (
    canonicalJson(review.reviewers.slice(0, 2)) !==
      canonicalJson(databaseReviewAuthorization.signers.slice(0, 2)) ||
    canonicalJson(review.reviewers[2]) !== canonicalJson(databaseReviewAuthorization.signers[2])
  ) {
    fail(
      'database catalog/data/regulatory reviewers do not match the pre-holdout signed review authority.',
    );
  }
  assertExactKeys(
    review.databaseCampaignPlan,
    [
      'contractId',
      'releaseId',
      'campaignAuthoritySha256',
      'territory',
      'importBatchId',
      'importBatchEvidenceSha256',
      'importRecordsSha256',
      'importCandidatesSha256',
      'cat02ArtifactSetSha256',
      'cat02MembershipSetSha256',
      'cat02MembershipProofSha256',
      'cat02DatabaseObservationSha256',
      'cat02VerifierSignatureSetSha256',
      'cat02ProductionIntegritySetSha256',
      'contributingBatchIds',
      'contributingBatchSetSha256',
      'signedTargetPolicyContractId',
      'signedTargetPolicySha256',
      'eligibilityPolicySha256',
      'betaEvidenceContractId',
      'betaCorpusSha256',
      'curationReviewContractId',
      'curationManifestSha256',
      'trustRegistrySha256',
      'corpusConsentStateSha256',
      'reviewValidUntil',
      'expectedReviewedRecordCount',
      'expectedEligibleRecordCount',
      'expectedPrioritizedEligibleRecordCount',
      'requiredCategoryEligibleFloors',
      'expectedRecordSetSha256',
      'servedStateMutationRootSetSha256',
      'activationAuthorizationSetSha256',
      'curationOutcomeReviewerSignatureSetSha256',
      'reviewerRoles',
      'reviewerIds',
      'reviewerEvidenceSha256s',
      'reviewerSignatureSetSha256',
      'createdBy',
    ],
    'curation review.databaseCampaignPlan',
  );
  const primaryArtifactSet = primaryArtifactAuthority.artifactSet;
  assertUuid(review.databaseCampaignPlan.importBatchId, 'database campaign importBatchId');
  assertArray(
    review.databaseCampaignPlan.contributingBatchIds,
    'database campaign contributingBatchIds',
    {
      min: cat02MembershipProof.artifactSets.length,
      max: cat02MembershipProof.artifactSets.length,
    },
  );
  for (const batchId of review.databaseCampaignPlan.contributingBatchIds) {
    assertUuid(batchId, 'database campaign contributing batch id');
  }
  assertTimestamp(
    review.databaseCampaignPlan.reviewValidUntil,
    'database campaign reviewValidUntil',
  );
  assertArray(review.databaseCampaignPlan.reviewerRoles, 'database campaign reviewerRoles', {
    min: 2,
    max: 2,
  });
  assertArray(review.databaseCampaignPlan.reviewerIds, 'database campaign reviewerIds', {
    min: 2,
    max: 2,
  });
  assertArray(
    review.databaseCampaignPlan.reviewerEvidenceSha256s,
    'database campaign reviewerEvidenceSha256s',
    { min: 2, max: 2 },
  );
  for (const digest of review.databaseCampaignPlan.reviewerEvidenceSha256s) {
    assertDigest(digest, 'database campaign reviewer evidence digest');
  }
  const expectedPlan = {
    contractId: 'catalog-launch-curation-campaign-v1',
    releaseId: review.releaseId,
    campaignAuthoritySha256: catalogCurationCampaignAuthoritySha256(review),
    territory: 'US',
    importBatchId: primaryArtifactSet.batchId,
    importBatchEvidenceSha256: primaryArtifactSet.batchEvidenceSha256,
    importRecordsSha256: primaryArtifactSet.recordsArtifactSha256,
    importCandidatesSha256: primaryArtifactSet.candidatesArtifactSha256,
    cat02ArtifactSetSha256: cat02MembershipProof.artifactSetSha256,
    cat02MembershipSetSha256: cat02MembershipProof.membershipSetSha256,
    cat02MembershipProofSha256: catalogDocumentSha256(cat02MembershipProof),
    cat02DatabaseObservationSha256: catalogCat02DatabaseObservationSha256(cat02MembershipProof),
    cat02VerifierSignatureSetSha256: catalogCat02VerifierSignatureSetSha256(cat02MembershipProof),
    cat02ProductionIntegritySetSha256: catalogCat02ProductionIntegritySetSha256(
      cat02MembershipProof.artifactSets,
    ),
    contributingBatchIds: cat02MembershipProof.artifactSets.map(
      (artifactSet) => artifactSet.batchId,
    ),
    contributingBatchSetSha256: sha256(
      Buffer.from(
        canonicalJson({
          contractId: 'catalog-cat02-contributing-batch-set-v1',
          batches: cat02MembershipProof.artifactSets,
        }),
        'utf8',
      ),
    ),
    signedTargetPolicyContractId: CATALOG_TARGET_POLICY_CONTRACT_ID,
    signedTargetPolicySha256: review.targetPolicySha256,
    eligibilityPolicySha256: review.databaseEligibilityPolicySha256,
    betaEvidenceContractId: CATALOG_BETA_CORPUS_CONTRACT_ID,
    betaCorpusSha256: review.betaShelfCorpusSha256,
    curationReviewContractId: CATALOG_CURATION_REVIEW_CONTRACT_ID,
    curationManifestSha256: catalogCurationManifestSha256(review),
    trustRegistrySha256: targetPolicy.lineage.cat01TrustRegistrySha256,
    corpusConsentStateSha256: catalogCorpusConsentStateSha256(betaShelfCorpus),
    reviewValidUntil: databaseReviewAuthorization.validUntil,
    expectedReviewedRecordCount: review.records.length,
    expectedEligibleRecordCount,
    expectedPrioritizedEligibleRecordCount,
    requiredCategoryEligibleFloors:
      targetPolicy.targets.inventory.minimumEligibleByRequiredCategory,
    expectedRecordSetSha256: catalogCurationDatabaseRecordSetSha256(review),
    servedStateMutationRootSetSha256: reviewedServedStateMutationRootSetSha256,
    activationAuthorizationSetSha256: expectedAuthorizationSetSha256,
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    reviewerRoles: ['catalog_quality_reviewer', 'data_quality_reviewer'],
    reviewerIds: review.reviewers.slice(0, 2).map((reviewer) => reviewer.reviewerId),
    reviewerEvidenceSha256s: review.reviewers
      .slice(0, 2)
      .map((reviewer) => reviewer.qualificationEvidenceSha256),
    reviewerSignatureSetSha256:
      betaShelfCorpus.curationDecisionAuthority.databaseReviewerSignatureSetSha256,
    createdBy: review.activation.operator.reviewerId,
  };
  if (canonicalJson(review.databaseCampaignPlan) !== canonicalJson(expectedPlan)) {
    fail('database campaign plan does not exactly match the signed offline/0058 authority.');
  }
  assertDigest(review.databaseCampaignPlanSha256, 'curation review.databaseCampaignPlanSha256');
  if (
    review.databaseCampaignPlanSha256 !==
    catalogDatabaseCampaignPlanSha256(review.databaseCampaignPlan)
  ) {
    fail('database campaign-plan digest is invalid.');
  }
  const validUntil = timestamp(review.databaseCampaignPlan.reviewValidUntil);
  const trustValidUntil = allSigners
    .map((signer) =>
      trustRegistry.reviewers.find((entry) => entry.keyId === signer.trustRegistryKeyId),
    )
    .map((entry) => timestamp(entry.validUntil))
    .reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY);
  const regulatoryValidUntil = review.records.reduce(
    (minimum, record) =>
      Math.min(
        minimum,
        timestamp(record.regulatoryEvidence.expiresAt),
        timestamp(record.regulatoryEvidence.revalidationDueAt),
      ),
    Number.POSITIVE_INFINITY,
  );
  if (
    validUntil <= timestamp(activationSignature.signedAt) ||
    validUntil > trustValidUntil ||
    validUntil > regulatoryValidUntil
  ) {
    fail('database campaign review validity exceeds trust, regulatory, or activation bounds.');
  }
  for (const record of review.records.filter(
    (entry) => entry.decision === 'eligible_for_activation',
  )) {
    const request = catalogCurationActivationAuthorization(review, record, {
      campaignAuthoritySha256: expectedPlan.campaignAuthoritySha256,
    });
    if (
      request.operationKey.length > 199 ||
      !/^[a-z0-9][a-z0-9._:-]{2,198}$/u.test(request.operationKey)
    ) {
      fail('curation activation operation key violates the database idempotency-key contract.');
    }
  }
  const allEligible = review.records
    .filter((record) => record.decision === 'eligible_for_activation')
    .every(
      (record) =>
        record.reviews.correctionHold === false &&
        ['usable', 'verified'].includes(record.reviews.qualityGrade),
    );
  if (
    review.activation.decision === 'approve_activation' &&
    (!quality.clear || !inventory.clear || !allEligible)
  ) {
    fail('activation approval is forbidden when signed holdout, inventory, or record gates fail.');
  }
  return { review, quality, inventory };
}

function assertNoSensitiveTrackedKeys(value, label = 'tracked evidence', depth = 0) {
  if (depth > 100) fail(`${label} exceeds the nesting-depth limit.`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSensitiveTrackedKeys(entry, `${label}[${index}]`, depth + 1),
    );
    return;
  }
  if (!isObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (
      /^(?:userId|participantId|email|phone|barcode|gtin|productName|shelfPhoto|notes|freeText|searchTerm|rawQuery)$/iu.test(
        key,
      )
    ) {
      fail(`${label} contains forbidden sensitive/raw field ${key}.`);
    }
    assertNoSensitiveTrackedKeys(entry, `${label}.${key}`, depth + 1);
  }
}

export function buildCatalogCurationEnvelope({
  targetPolicy,
  betaShelfCorpus,
  cat02MembershipProof,
  curationReview,
  trustRegistry,
  trustRegistryArtifactSha256,
  trustedRoot,
  generatedAt,
}) {
  assertTimestamp(generatedAt, 'curation envelope.generatedAt');
  validateTrustRegistry(
    trustRegistry,
    trustRegistryArtifactSha256,
    trustedRoot,
    new Date(generatedAt),
  );
  if (targetPolicy.lineage?.cat01TrustRegistrySha256 !== trustRegistryArtifactSha256) {
    fail('target policy does not bind the exact active CAT-01 trust-registry artifact bytes.');
  }
  validateCatalogTargetPolicy(targetPolicy, { trustRegistry });
  validateCatalogCat02MembershipProof(cat02MembershipProof, { targetPolicy, trustRegistry });
  validateCatalogBetaCorpus(betaShelfCorpus, {
    targetPolicy,
    cat02MembershipProof,
    trustRegistry,
  });
  const { quality, inventory } = validateCatalogCurationReview(curationReview, {
    targetPolicy,
    betaShelfCorpus,
    cat02MembershipProof,
    trustRegistry,
  });
  if (
    timestamp(generatedAt) < timestamp(curationReview.activation.authorizationSignature.signedAt)
  ) {
    fail('curation envelope cannot be generated before the signed activation decision.');
  }
  const authority = {
    targetPolicySha256: catalogDocumentSha256(targetPolicy),
    betaShelfCorpusSha256: catalogDocumentSha256(betaShelfCorpus),
    cat02MembershipProofSha256: catalogDocumentSha256(cat02MembershipProof),
    curationReviewSha256: catalogDocumentSha256(curationReview),
    servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(
      curationReview.records,
    ),
    curationOutcomeReviewerSignatureSetSha256:
      curationReview.curationOutcomeReviewerSignatureSetSha256,
    trustRegistryArtifactSha256,
    releaseId: curationReview.releaseId,
    lineage: targetPolicy.lineage,
  };
  const replayKeySha256 = sha256(
    Buffer.from(
      canonicalJson({
        contractId: CATALOG_CURATION_ENVELOPE_CONTRACT_ID,
        authority,
      }),
      'utf8',
    ),
  );
  const body = {
    schemaVersion: 1,
    contractId: CATALOG_CURATION_ENVELOPE_CONTRACT_ID,
    generatedAt,
    authority,
    privacy: {
      aggregateOnly: true,
      rawUserIdentifiersPresent: false,
      rawBarcodesPresent: false,
      rawProductNamesPresent: false,
      rawFreeTextPresent: false,
      smallCellAndComplementarySuppressionRequired: true,
      nonzeroCellsBelowMinimumRejected: true,
      zeroDenominatorsPublishedAsUnavailableNullBounds: true,
      signedHmacSuppressionAndOverlapExecutionReceiptRequired: true,
    },
    scope: {
      corpusType: 'defined_self_selected_beta_shelf_coverage_corpus',
      marketRepresentativenessClaimed: false,
      demandAuthorizesProductFacts: false,
      legalOrAppStoreApprovalGuaranteed: false,
      qualityTargetsAreProductGuardrailsNotLegalOrAppleThresholds: true,
      regulatoryBasisIsNotAgencyProductApproval: true,
      wilsonEvaluationUnit: targetPolicy.sampling.wilsonEvaluationUnit,
      confidenceBoundsAreMarginalNotSimultaneous:
        targetPolicy.analysis.confidenceBoundsAreMarginalNotSimultaneous,
      multipleComparisonDecisionRule: targetPolicy.analysis.multipleComparisonDecisionRule,
      holdoutReuseAllowed: targetPolicy.analysis.holdoutReuseAllowed,
      externalCommitmentReceiptType:
        'independently_signed_append_only_log_receipt_not_rfc3161_timestamp_token',
    },
    qualityAtBuild: {
      signedHoldoutTargetsClear: quality.clear,
      signedInventoryTargetsClear: inventory.clear,
      activationDecision: curationReview.activation.decision,
    },
    artifacts: { targetPolicy, cat02MembershipProof, betaShelfCorpus, curationReview },
    replayKeySha256,
  };
  assertNoSensitiveTrackedKeys(body);
  return Object.freeze({
    ...body,
    envelopeDigestSha256: catalogDocumentSha256(body),
  });
}

export function validateCatalogCurationEnvelope(
  envelope,
  { trustRegistry, trustRegistryArtifactSha256, trustedRoot } = {},
) {
  assertExactKeys(
    envelope,
    [
      'schemaVersion',
      'contractId',
      'generatedAt',
      'authority',
      'privacy',
      'scope',
      'qualityAtBuild',
      'artifacts',
      'replayKeySha256',
      'envelopeDigestSha256',
    ],
    'curation envelope',
  );
  if (
    envelope.schemaVersion !== 1 ||
    envelope.contractId !== CATALOG_CURATION_ENVELOPE_CONTRACT_ID
  ) {
    fail('curation envelope schema/contract is invalid.');
  }
  assertExactKeys(
    envelope.artifacts,
    ['targetPolicy', 'cat02MembershipProof', 'betaShelfCorpus', 'curationReview'],
    'curation envelope.artifacts',
  );
  const rebuilt = buildCatalogCurationEnvelope({
    targetPolicy: envelope.artifacts.targetPolicy,
    cat02MembershipProof: envelope.artifacts.cat02MembershipProof,
    betaShelfCorpus: envelope.artifacts.betaShelfCorpus,
    curationReview: envelope.artifacts.curationReview,
    trustRegistry,
    trustRegistryArtifactSha256,
    trustedRoot,
    generatedAt: envelope.generatedAt,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(envelope)) {
    fail('curation envelope digest, replay key, authority, or contents were modified.');
  }
  return rebuilt;
}

function catalogCat02ProductMembershipReadbackSha256(proof, productRecordSha256) {
  const memberships = proof.memberships
    .filter((membership) => membership.productRecordSha256 === productRecordSha256)
    .map(({ productRecordSha256: _productRecordSha256, ...membership }) => membership);
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-cat02-membership-readback-v1',
        productRecordSha256,
        memberships,
      }),
      'utf8',
    ),
  );
}

function digestReadbackSet(contractId, records, field) {
  const entries = records
    .filter((record) => record[field] !== null)
    .map((record) => ({
      productRecordSha256: record.productRecordSha256,
      [field]: record[field],
    }));
  return sha256(Buffer.from(canonicalJson({ contractId, entries }), 'utf8'));
}

export function validateCatalogDatabaseReadback(
  readback,
  { envelope, trustRegistry, trustRegistryArtifactSha256, trustedRoot, now = new Date() } = {},
) {
  if (!envelope || !trustRegistry || !trustRegistryArtifactSha256 || !trustedRoot) {
    fail('database readback validation requires envelope and current pinned trust authority.');
  }
  const policy = envelope.artifacts.targetPolicy;
  const proof = envelope.artifacts.cat02MembershipProof;
  const corpus = envelope.artifacts.betaShelfCorpus;
  const review = envelope.artifacts.curationReview;
  assertExactKeys(
    readback,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'receiptId',
      'verifiedAt',
      'authority',
      'databaseState',
      'counts',
      'records',
      'databaseReadbackRecordSetSha256',
      'membershipReadback',
      'signers',
      'signatures',
    ],
    'database readback',
  );
  if (
    readback.schemaVersion !== 1 ||
    readback.contractId !== CATALOG_DATABASE_READBACK_CONTRACT_ID ||
    readback.signatureEnvelopeVersion !== CATALOG_DATABASE_READBACK_SIGNATURE_ENVELOPE ||
    readback.signingDomain !== CATALOG_DATABASE_READBACK_SIGNING_DOMAIN
  ) {
    fail('database readback schema, contract, signature envelope, or domain is invalid.');
  }
  assertId(readback.receiptId, 'database readback.receiptId');
  assertTimestamp(readback.verifiedAt, 'database readback.verifiedAt');
  const verificationNow = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(verificationNow.getTime()))
    fail('database readback verification time is invalid.');
  if (
    timestamp(readback.verifiedAt) < timestamp(envelope.generatedAt) ||
    timestamp(readback.verifiedAt) >= timestamp(review.databaseCampaignPlan.reviewValidUntil) ||
    timestamp(readback.verifiedAt) > verificationNow.getTime()
  ) {
    fail('database readback is before its envelope or outside the signed review-validity window.');
  }
  validateTrustRegistry(
    trustRegistry,
    trustRegistryArtifactSha256,
    trustedRoot,
    new Date(readback.verifiedAt),
  );
  assertExactKeys(
    readback.authority,
    [
      'releaseId',
      'envelopeDigestSha256',
      'replayKeySha256',
      'targetPolicySha256',
      'betaShelfCorpusSha256',
      'curationReviewSha256',
      'trustRegistrySha256',
      'databaseEligibilityPolicySha256',
      'curationDecisionCommitmentSha256',
      'candidateSetSha256',
      'cat02MembershipProofSha256',
      'cat02MembershipSetSha256',
      'cat02DatabaseObservationSha256',
      'cat02VerifierSignatureSetSha256',
      'cat02ProductionIntegritySetSha256',
      'servedStateMutationRootSetSha256',
      'curationOutcomeReviewerSignatureSetSha256',
      'activationAuthorizationSetSha256',
      'campaignAuthoritySha256',
      'databaseCampaignPlanSha256',
      'databaseRecordSetSha256',
    ],
    'database readback.authority',
  );
  for (const [key, value] of Object.entries(readback.authority)) {
    if (key === 'releaseId') assertId(value, `database readback.authority.${key}`);
    else assertDigest(value, `database readback.authority.${key}`);
  }
  const expectedAuthority = {
    releaseId: review.releaseId,
    envelopeDigestSha256: envelope.envelopeDigestSha256,
    replayKeySha256: envelope.replayKeySha256,
    targetPolicySha256: review.targetPolicySha256,
    betaShelfCorpusSha256: review.betaShelfCorpusSha256,
    curationReviewSha256: catalogDocumentSha256(review),
    trustRegistrySha256: trustRegistryArtifactSha256,
    databaseEligibilityPolicySha256: review.databaseEligibilityPolicySha256,
    curationDecisionCommitmentSha256: catalogCurationDecisionCommitment(review.records),
    candidateSetSha256: catalogCurationCandidateSetSha256(review.records),
    cat02MembershipProofSha256: catalogDocumentSha256(proof),
    cat02MembershipSetSha256: proof.membershipSetSha256,
    cat02DatabaseObservationSha256: catalogCat02DatabaseObservationSha256(proof),
    cat02VerifierSignatureSetSha256: catalogCat02VerifierSignatureSetSha256(proof),
    cat02ProductionIntegritySetSha256: catalogCat02ProductionIntegritySetSha256(proof.artifactSets),
    servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(review.records),
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    activationAuthorizationSetSha256: catalogCurationActivationAuthorizationSetSha256(review),
    campaignAuthoritySha256: catalogCurationCampaignAuthoritySha256(review),
    databaseCampaignPlanSha256: review.databaseCampaignPlanSha256,
    databaseRecordSetSha256: catalogCurationDatabaseRecordSetSha256(review),
  };
  if (canonicalJson(readback.authority) !== canonicalJson(expectedAuthority)) {
    fail('database readback authority does not bind the exact envelope/campaign/record roots.');
  }
  assertExactKeys(
    readback.databaseState,
    [
      'projectRefSha256',
      'schemaMigrationVersion',
      'schemaMigrationSha256',
      'contractTestSha256',
      'campaignId',
      'campaignRowSha256',
      'campaignStatus',
      'campaignReleaseEventId',
      'campaignReleaseEventReceiptSha256',
      'campaignReleaseHeadSha256',
      'campaignReleaseHeadGeneration',
      'campaignReleaseHeadState',
      'activationEventSetSha256',
      'stagedHeadSetSha256',
      'servingProbeSetSha256',
      'currentLiveEligibilitySetSha256',
      'currentServedStateMutationRootSetSha256',
      'capturedAt',
      'atomicCampaignReleaseApplied',
      'allCurrentHeadsServing',
      'allCurrentEligibilityMatches',
      'allServingProbesPassed',
    ],
    'database readback.databaseState',
  );
  for (const key of [
    'projectRefSha256',
    'schemaMigrationSha256',
    'contractTestSha256',
    'campaignRowSha256',
    'campaignReleaseEventReceiptSha256',
    'campaignReleaseHeadSha256',
    'activationEventSetSha256',
    'stagedHeadSetSha256',
    'servingProbeSetSha256',
    'currentLiveEligibilitySetSha256',
    'currentServedStateMutationRootSetSha256',
  ]) {
    assertDigest(readback.databaseState[key], `database readback.databaseState.${key}`);
  }
  assertUuid(readback.databaseState.campaignId, 'database readback.databaseState.campaignId');
  assertUuid(
    readback.databaseState.campaignReleaseEventId,
    'database readback.databaseState.campaignReleaseEventId',
  );
  assertInteger(
    readback.databaseState.campaignReleaseHeadGeneration,
    'database readback.databaseState.campaignReleaseHeadGeneration',
    { min: 1 },
  );
  assertTimestamp(readback.databaseState.capturedAt, 'database readback.databaseState.capturedAt');
  if (
    readback.databaseState.capturedAt !== readback.verifiedAt ||
    readback.databaseState.schemaMigrationVersion !==
      CATALOG_CURATION_REQUIRED_SCHEMA_MIGRATION_VERSION ||
    readback.databaseState.schemaMigrationSha256 !== review.databaseSnapshot.cat03MigrationSha256 ||
    readback.databaseState.contractTestSha256 !==
      review.databaseSnapshot.cat03DatabaseContractTestSha256 ||
    readback.databaseState.projectRefSha256 !== review.databaseSnapshot.projectRefSha256 ||
    readback.databaseState.campaignRowSha256 !== review.databaseCampaignPlanSha256 ||
    readback.databaseState.currentServedStateMutationRootSetSha256 !==
      review.databaseCampaignPlan.servedStateMutationRootSetSha256 ||
    readback.databaseState.campaignStatus !== 'released' ||
    readback.databaseState.campaignReleaseHeadState !== 'active'
  ) {
    fail('database readback does not match the signed current campaign/release authority.');
  }
  for (const key of [
    'atomicCampaignReleaseApplied',
    'allCurrentHeadsServing',
    'allCurrentEligibilityMatches',
    'allServingProbesPassed',
  ]) {
    assertBoolean(readback.databaseState[key], true, `database readback.databaseState.${key}`);
  }
  const eligibleRecords = review.records.filter(
    (record) => record.decision === 'eligible_for_activation',
  );
  const rejectedRecords = review.records.length - eligibleRecords.length;
  const expectedCounts = {
    campaignRows: 1,
    campaignReleaseEvents: 1,
    campaignReleaseHeads: 1,
    reviewedRecords: review.records.length,
    eligibleRecords: eligibleRecords.length,
    rejectedRecords,
    databaseRecords: review.records.length,
    activationAuthorizations: eligibleRecords.length,
    activationEvents: eligibleRecords.length,
    stagedHeads: eligibleRecords.length,
    servingProbes: eligibleRecords.length,
    currentLiveEligibleRecords: eligibleRecords.length,
    cat02Memberships: proof.memberships.length,
    missingRecords: 0,
    mismatchedRecords: 0,
    failedActivationEvents: 0,
    failedServingProbes: 0,
    unexpectedRecords: 0,
    currentIneligibleRecords: 0,
  };
  assertExactKeys(readback.counts, Object.keys(expectedCounts), 'database readback.counts');
  for (const [key, expected] of Object.entries(expectedCounts)) {
    assertInteger(readback.counts[key], `database readback.counts.${key}`, {
      min: expected,
      max: expected,
    });
  }
  assertArray(readback.records, 'database readback.records', {
    min: review.records.length,
    max: review.records.length,
  });
  const expectedDatabaseRecords = new Map(
    catalogCurationDatabaseRecordSet(review).records.map((record) => [
      record.productRecordSha256,
      record,
    ]),
  );
  for (const [index, record] of readback.records.entries()) {
    const label = `database readback.records[${index}]`;
    assertExactKeys(
      record,
      [
        'productRecordSha256',
        'cat02StageRecordSha256',
        'cat02DatabaseNormalizedRecordSha256',
        'sourceApprovalSha256',
        'sourceQaSha256',
        'servedStateMutationRootSha256',
        'cat02MembershipReadbackSha256',
        'offlineBaseSealedRecordSha256',
        'databaseBaseRecordSha256',
        'reviewedRecordMappingSha256',
        'curationRecordSha256',
        'manifestEntrySha256',
        'databaseActivationRequestSha256',
        'activationSignatureSha256',
        'activationEventReceiptSha256',
        'stagedHeadSha256',
        'servingProbeSha256',
        'currentLiveEligibilitySha256',
      ],
      label,
    );
    assertDigest(record.productRecordSha256, `${label}.productRecordSha256`);
    const expectedDatabaseRecord = expectedDatabaseRecords.get(record.productRecordSha256);
    if (!expectedDatabaseRecord)
      fail(`${label} is not in the signed complete database record set.`);
    const expectedApproved = expectedDatabaseRecord.databaseActivationRequestSha256 !== null;
    for (const key of [
      'offlineBaseSealedRecordSha256',
      'cat02StageRecordSha256',
      'cat02DatabaseNormalizedRecordSha256',
      'sourceApprovalSha256',
      'sourceQaSha256',
      'servedStateMutationRootSha256',
      'cat02MembershipReadbackSha256',
      'databaseBaseRecordSha256',
      'reviewedRecordMappingSha256',
      'curationRecordSha256',
      'manifestEntrySha256',
      'databaseActivationRequestSha256',
      'activationSignatureSha256',
    ]) {
      if (expectedDatabaseRecord[key] === null) {
        if (record[key] !== null) fail(`${label}.${key} must be null for a withheld record.`);
      } else if (record[key] !== expectedDatabaseRecord[key]) {
        fail(`${label}.${key} does not match the signed database record authority.`);
      }
    }
    for (const key of [
      'activationEventReceiptSha256',
      'stagedHeadSha256',
      'servingProbeSha256',
      'currentLiveEligibilitySha256',
    ]) {
      if (expectedApproved) assertDigest(record[key], `${label}.${key}`);
      else if (record[key] !== null) fail(`${label}.${key} must be null for a rejected record.`);
    }
    assertDigest(record.cat02MembershipReadbackSha256, `${label}.cat02MembershipReadbackSha256`);
    if (
      record.cat02MembershipReadbackSha256 !==
      catalogCat02ProductMembershipReadbackSha256(proof, record.productRecordSha256)
    ) {
      fail(`${label} CAT-02 membership readback does not match all four signed field scopes.`);
    }
  }
  const sortedReadbackRecords = [...readback.records].sort((left, right) =>
    left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
  );
  if (
    new Set(readback.records.map((record) => record.productRecordSha256)).size !==
      readback.records.length ||
    canonicalJson(readback.records) !== canonicalJson(sortedReadbackRecords)
  ) {
    fail('database readback records must be the exact unique sorted reviewed record set.');
  }
  assertDigest(
    readback.databaseReadbackRecordSetSha256,
    'database readback.databaseReadbackRecordSetSha256',
  );
  const expectedReadbackSetSha256 = sha256(
    Buffer.from(
      canonicalJson({
        contractId: 'catalog-curation-database-readback-record-set-v1',
        records: readback.records,
      }),
      'utf8',
    ),
  );
  if (readback.databaseReadbackRecordSetSha256 !== expectedReadbackSetSha256) {
    fail('database readback record-set digest is invalid.');
  }
  for (const [field, contractId, databaseField] of [
    [
      'activationEventReceiptSha256',
      'catalog-curation-activation-event-readback-set-v1',
      'activationEventSetSha256',
    ],
    ['stagedHeadSha256', 'catalog-curation-staged-head-readback-set-v1', 'stagedHeadSetSha256'],
    ['servingProbeSha256', 'catalog-curation-serving-probe-set-v1', 'servingProbeSetSha256'],
    [
      'currentLiveEligibilitySha256',
      'catalog-curation-current-live-eligibility-set-v1',
      'currentLiveEligibilitySetSha256',
    ],
  ]) {
    if (
      readback.databaseState[databaseField] !==
      digestReadbackSet(contractId, readback.records, field)
    ) {
      fail(`database readback ${databaseField} does not bind the exact eligible record set.`);
    }
  }
  assertExactKeys(
    readback.membershipReadback,
    [
      'cat02MembershipProofSha256',
      'cat02MembershipSetSha256',
      'artifactSetSha256',
      'batchIds',
      'cat02BatchReadbackSetSha256',
      'cat02ArtifactReadbackSetSha256',
      'cat02MembershipReadbackSetSha256',
      'allExact',
    ],
    'database readback.membershipReadback',
  );
  for (const key of [
    'cat02MembershipProofSha256',
    'cat02MembershipSetSha256',
    'artifactSetSha256',
    'cat02BatchReadbackSetSha256',
    'cat02ArtifactReadbackSetSha256',
    'cat02MembershipReadbackSetSha256',
  ]) {
    assertDigest(readback.membershipReadback[key], `database readback.membershipReadback.${key}`);
  }
  const batchIds = proof.artifactSets.map((artifactSet) => artifactSet.batchId);
  assertArray(readback.membershipReadback.batchIds, 'database readback membership batchIds', {
    min: batchIds.length,
    max: batchIds.length,
  });
  const expectedMembershipReadback = {
    cat02MembershipProofSha256: catalogDocumentSha256(proof),
    cat02MembershipSetSha256: proof.membershipSetSha256,
    artifactSetSha256: proof.artifactSetSha256,
    batchIds,
    cat02BatchReadbackSetSha256: sha256(
      Buffer.from(
        canonicalJson({ contractId: 'catalog-cat02-batch-readback-set-v1', batchIds }),
        'utf8',
      ),
    ),
    cat02ArtifactReadbackSetSha256: proof.artifactSetSha256,
    cat02MembershipReadbackSetSha256: digestReadbackSet(
      'catalog-cat02-membership-readback-set-v1',
      readback.records,
      'cat02MembershipReadbackSha256',
    ),
    allExact: true,
  };
  if (canonicalJson(readback.membershipReadback) !== canonicalJson(expectedMembershipReadback)) {
    fail('database CAT-02 batch/artifact/membership readback is incomplete or mismatched.');
  }
  validateSignedRoles({
    document: readback,
    signers: readback.signers,
    signatures: readback.signatures,
    requiredRoles: [{ decisionRole: 'database_verifier', trustRegistryRole: 'engineering' }],
    trustRegistry,
    payload: catalogDatabaseReadbackSigningPayload,
    earliestSignedAt: readback.verifiedAt,
    latestSignedAt: readback.verifiedAt,
    label: 'database readback',
  });
  const priorSigners = [
    ...policy.signers,
    ...proof.signers,
    ...corpus.curationDecisionAuthority.signers,
    corpus.curationDecisionAuthority.externalTimestampSigner,
    ...corpus.curationDecisionAuthority.databaseReviewAuthorization.signers,
    ...corpus.holdoutControlReceipt.signers,
    ...corpus.privacyExecutionReceipt.signers,
    ...review.reviewers,
    review.activation.operator,
  ];
  assertSignerIndependentFrom(readback.signers[0], priorSigners, 'database readback verifier');
  return readback;
}

export function buildCatalogCoverageQualityReport(envelope, verification = {}) {
  const validated = validateCatalogCurationEnvelope(envelope, verification);
  const policy = validated.artifacts.targetPolicy;
  const corpus = validated.artifacts.betaShelfCorpus;
  const review = validated.artifacts.curationReview;
  const quality = evaluateCatalogCoverageTargets(policy, corpus);
  const inventory = evaluateCatalogInventoryTargets(policy, review);
  const activationApproved = review.activation.decision === 'approve_activation';
  const acceptedRecords = review.records.filter(
    (record) => record.decision === 'eligible_for_activation',
  );
  const regulatedAcceptedRecords = acceptedRecords.filter(
    (record) => record.productClass !== 'cosmetic',
  );
  const preactivationGates = [
    ...quality.gates,
    ...inventory.gates,
    gate(
      'complete_reviewed_record_commitment',
      review.inventoryCommitment.completeReviewedRecordSetSha256 ===
        catalogCurationDecisionCommitment(review.records),
      review.inventoryCommitment.completeReviewedRecordSetSha256,
      '=',
      catalogCurationDecisionCommitment(review.records),
    ),
    gate(
      'exact_activation_authorization_set',
      review.activation.activationAuthorizationSetSha256 ===
        catalogCurationActivationAuthorizationSetSha256(review),
      review.activation.activationAuthorizationSetSha256,
      '=',
      catalogCurationActivationAuthorizationSetSha256(review),
    ),
    gate('signed_activation_decision', activationApproved, activationApproved ? 1 : 0, '=', 1),
  ];
  const preactivationClear = preactivationGates.every((entry) => entry.passed);
  let databaseReadback = null;
  if (verification.databaseReadback !== undefined && verification.databaseReadback !== null) {
    if (!preactivationClear) {
      fail('database release readback cannot clear a campaign that failed preactivation gates.');
    }
    databaseReadback = validateCatalogDatabaseReadback(verification.databaseReadback, {
      envelope: validated,
      trustRegistry: verification.trustRegistry,
      trustRegistryArtifactSha256: verification.trustRegistryArtifactSha256,
      trustedRoot: verification.trustedRoot,
      now: verification.now,
    });
  }
  const databaseReadbackGate = gate(
    'independent_database_release_readback',
    databaseReadback !== null,
    databaseReadback === null ? 0 : 1,
    '=',
    1,
  );
  const reportGates = [...preactivationGates, databaseReadbackGate];
  const catalogCurationClear = preactivationClear && databaseReadback !== null;
  const body = {
    schemaVersion: 1,
    contractId: CATALOG_CURATION_REPORT_CONTRACT_ID,
    generatedAt: databaseReadback?.verifiedAt ?? validated.generatedAt,
    status: catalogCurationClear
      ? 'clear'
      : preactivationClear
        ? 'approved_for_activation'
        : 'blocked',
    authority: validated.authority,
    replayKeySha256: validated.replayKeySha256,
    envelopeDigestSha256: validated.envelopeDigestSha256,
    scope: validated.scope,
    privacy: validated.privacy,
    cohortSummary: {
      curationParticipants: corpus.cohorts.curation.participants,
      holdoutParticipants: corpus.cohorts.holdout.participants,
      curationContributors: corpus.cohorts.curation.contributors,
      holdoutContributors: corpus.cohorts.holdout.contributors,
      curationDistinctDemandDigests: quality.distinctDemandDigests.curation,
      holdoutDistinctDemandDigests: quality.distinctDemandDigests.holdout,
    },
    confidence: quality.confidence,
    statisticalDesign: quality.evaluationUnit,
    privacyEvidenceSummary: {
      holdoutControlReceiptSha256: catalogDocumentSha256(corpus.holdoutControlReceipt),
      privacyExecutionReceiptSha256: catalogDocumentSha256(corpus.privacyExecutionReceipt),
      demandCommitmentOutputSetSha256: catalogDemandCommitmentOutputSetSha256(corpus),
      secretKeyMaterialPresent: corpus.privacyExecutionReceipt.secretKeyMaterialPresent,
      preOpenReadCount: corpus.holdoutControlReceipt.preOpenReadCount,
      executedAnalysisLookCount: corpus.holdoutControlReceipt.executedAnalysisLookCount,
      priorHoldoutUseCount: corpus.holdoutControlReceipt.priorHoldoutUseCount,
    },
    curationSummary: {
      reviewedRecordCount: review.records.length,
      eligibleRecordCount: acceptedRecords.length,
      rejectedRecordCount: review.records.length - acceptedRecords.length,
      regulatedEligibleRecordCount: regulatedAcceptedRecords.length,
      prioritizedEligibleRecordCount: inventory.prioritizedEligibleRecordCount,
      eligibleByRequiredCategory: inventory.eligibleByCategory,
      betaDemandUse: review.authority.betaDemandUse,
      activationDecision: review.activation.decision,
      servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(review.records),
      curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
      activationAuthorizationSetSha256: review.activation.activationAuthorizationSetSha256,
    },
    databaseReleaseSummary:
      databaseReadback === null
        ? {
            readbackPresent: false,
            receiptSha256: null,
            campaignStatus: 'not_verified',
            currentLiveEligibleRecordCount: 0,
            currentServedStateMutationRootSetSha256: null,
          }
        : {
            readbackPresent: true,
            receiptSha256: catalogDocumentSha256(databaseReadback),
            campaignStatus: databaseReadback.databaseState.campaignStatus,
            currentLiveEligibleRecordCount: databaseReadback.counts.currentLiveEligibleRecords,
            currentServedStateMutationRootSetSha256:
              databaseReadback.databaseState.currentServedStateMutationRootSetSha256,
          },
    clearAsOf: databaseReadback?.verifiedAt ?? null,
    reviewValidUntil: review.databaseCampaignPlan.reviewValidUntil,
    clearanceIsPointInTime: true,
    laterRetirementSupersessionOrDependencyWithdrawalRequiresNewReadback: true,
    durableCurrentClearanceClaimed: false,
    gates: reportGates,
    blockerCodes: reportGates.filter((entry) => !entry.passed).map((entry) => entry.code),
    catalogCurationClear,
    appStoreLegalOrRevenueOutcomeGuaranteed: false,
  };
  assertNoSensitiveTrackedKeys(body, 'coverage quality report');
  return Object.freeze({ ...body, reportDigestSha256: catalogDocumentSha256(body) });
}

function normalizedPath(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isWithin(parent, child) {
  const delta = relative(parent, child);
  return delta === '' || (!delta.startsWith(`..${sep}`) && delta !== '..' && !isAbsolute(delta));
}

function assertNoSymlinkComponents(path, root, label) {
  const absolute = resolve(path);
  const rootAbsolute = resolve(root);
  const delta = relative(rootAbsolute, absolute);
  if (delta.startsWith('..') || isAbsolute(delta)) fail(`${label} resolves outside the workspace.`);
  let current = rootAbsolute;
  for (const part of delta.split(/[\\/]+/u).filter(Boolean)) {
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      fail(`${label} must not traverse a symlink or junction.`);
    }
  }
}

function canonicalWorkspaceRoot(root) {
  const absolute = resolve(root);
  if (!existsSync(absolute) || !lstatSync(absolute).isDirectory())
    fail('workspace root is invalid.');
  return realpathSync(absolute);
}

export function readCatalogCurationInput(path, label, root = process.cwd()) {
  const realRoot = canonicalWorkspaceRoot(root);
  const candidate = resolve(realRoot, path);
  assertNoSymlinkComponents(candidate, realRoot, label);
  if (!isWithin(realRoot, candidate) || !existsSync(candidate) || !lstatSync(candidate).isFile()) {
    fail(`${label} must be a regular file inside the workspace.`);
  }
  const real = realpathSync(candidate);
  if (!isWithin(realRoot, real) || normalizedPath(real) !== normalizedPath(candidate)) {
    fail(`${label} path is not its real canonical workspace path.`);
  }
  const bytes = readFileSync(real);
  const value = parseCatalogEvidenceJson(bytes, label, { maxBytes: MAX_CONTROL_BYTES });
  return { path: real, bytes, sha256: sha256(bytes), value };
}

export function assertCatalogCurationOutputPath(outputPath, inputPaths, root = process.cwd()) {
  const realRoot = canonicalWorkspaceRoot(root);
  const artifactRoot = resolve(realRoot, 'artifacts', 'phase4');
  if (!existsSync(artifactRoot) || !lstatSync(artifactRoot).isDirectory()) {
    fail('artifacts/phase4 must exist before writing CAT-03 evidence.');
  }
  assertNoSymlinkComponents(artifactRoot, realRoot, 'CAT-03 artifact root');
  const candidate = resolve(realRoot, outputPath);
  assertNoSymlinkComponents(dirname(candidate), realRoot, 'CAT-03 output parent');
  if (!isWithin(artifactRoot, candidate)) {
    fail('CAT-03 output must stay under artifacts/phase4.');
  }
  if (!existsSync(dirname(candidate)) || !lstatSync(dirname(candidate)).isDirectory()) {
    fail('CAT-03 output parent must already exist and be a real directory.');
  }
  const realParent = realpathSync(dirname(candidate));
  if (
    !isWithin(artifactRoot, realParent) ||
    normalizedPath(realParent) !== normalizedPath(dirname(candidate))
  ) {
    fail('CAT-03 output parent resolves outside the approved artifact root.');
  }
  if (existsSync(candidate)) fail('CAT-03 evidence is immutable; output is no-clobber.');
  const protectedPaths = inputPaths.map((entry) => normalizedPath(resolve(realRoot, entry)));
  if (protectedPaths.includes(normalizedPath(candidate)))
    fail('CAT-03 output must not alias an input.');
  return candidate;
}

export function writeCatalogCurationJson(outputPath, value, inputPaths, root = process.cwd()) {
  const safePath = assertCatalogCurationOutputPath(outputPath, inputPaths, root);
  writeJsonAtomically(safePath, value, { allowReplace: false });
  return safePath;
}

export function parseExactCliArgs(argv, requiredFlags) {
  const allowed = new Set(requiredFlags);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !allowed.has(flag) ||
      typeof value !== 'string' ||
      value.length === 0 ||
      value.startsWith('--')
    ) {
      fail('CLI received an unknown, duplicate, positional, or valueless argument.');
    }
    if (Object.hasOwn(parsed, flag)) fail(`CLI flag ${flag} may be supplied only once.`);
    parsed[flag] = value;
  }
  for (const flag of requiredFlags) {
    if (!Object.hasOwn(parsed, flag)) fail(`CLI is missing required flag ${flag}.`);
  }
  return parsed;
}

export function trustedRootFromEnvironment(env = process.env) {
  return catalogTrustRootFromEnvironment(env);
}
