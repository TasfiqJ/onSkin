import { createPublicKey, verify as verifyCryptographicSignature } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { launchContractSnapshot, loadLaunchContract } from '../launch/contract.mjs';
import {
  CATALOG_QA_LAUNCH_CLEAR_REASON,
  CATALOG_QA_SOURCE_HASH_PATHS,
  CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  assertCatalogBuildSourceCommit,
  assertCatalogSourceTreeClean,
  canonicalJson,
  catalogReleaseIdentityFromRepository,
  catalogTransformedPayloadSha256,
  catalogTransformerDescriptor,
  loadCatalogReleaseBuildEvidence,
  loadCatalogReleaseScope,
  loadCatalogSourcePolicy,
  loadCatalogSourceTrustRegistry,
  normalizeCatalogCosingKey,
  parseCatalogEvidenceJson,
  sha256,
  validateCatalogReleaseBuildEvidence,
  validateProductionApproval,
  writeJsonAtomically,
} from './source-policy.mjs';

export const CATALOG_STAGE_CONTRACT_ID = 'catalog-stage-envelope-v1';
export const CATALOG_REVIEW_OVERLAY_ID = 'catalog-row-review-overlay-v1';
export const CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE = 'catalog-row-review-signature-v1';
export const CATALOG_ROW_REVIEW_SIGNING_DOMAIN = 'routinekind.catalog-row-review-overlay.v1';
export const CATALOG_DATABASE_RECEIPT_EVIDENCE_CONTRACT_ID =
  'catalog-import-database-receipt-evidence-v1';
export const CATALOG_DATABASE_RECEIPT_COMPLETION_CONTRACT_ID =
  'catalog-import-database-receipt-completion-v1';
export const CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID =
  'catalog-database-candidates-leaf-aggregate-v2';
export const CATALOG_DATABASE_NORMALIZED_RECORD_HASH_CONTRACT_ID =
  'catalog-database-normalized-record-canonical-json-sha256-v1';

export const REQUIRED_PROMOTION_QA_SOURCE_PATHS = CATALOG_QA_SOURCE_HASH_PATHS;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const REVIEWER_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const TRUST_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const LIFECYCLE_OPERATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$/u;
const EVIDENCE_URI_PATTERN = /^https:\/\/[^\s/$.?#].[^\s]*$/u;
const FORBIDDEN_SECRET_KEY_PATTERN =
  /^(?:api[-_]?key|authorization|cookie|password|private[-_]?key|refresh[-_]?token|secret|service[-_]?role[-_]?key)$/iu;

const MAXIMUM_BYTES = Object.freeze({
  transform: 80 * 1024 * 1024,
  qa: 4 * 1024 * 1024,
  reviews: 32 * 1024 * 1024,
  envelope: 128 * 1024 * 1024,
  receipts: 256 * 1024 * 1024,
});
const MAXIMUM_RECORDS = 100_000;
const MAXIMUM_REVIEWERS = 16;
const MAXIMUM_DATABASE_CHUNK_JSON_BYTES = 8_388_608;
const DATABASE_RECORD_RECEIPT_KEYS = Object.freeze([
  'recordOrdinal',
  'recordSha256',
  'recordKind',
  'canonicalKey',
  'sourcePayload',
  'normalizedPayload',
  'disposition',
]);
const DATABASE_EVIDENCE_RECORD_RECEIPT_KEYS = Object.freeze([
  'recordOrdinal',
  'recordSha256',
  'recordKind',
  'canonicalKey',
  'disposition',
]);
const DATABASE_CHUNK_RPC_RECEIPT_KEYS = Object.freeze([
  'batch_id',
  'chunk_ordinal',
  'staged_record_count',
  'chunk_sha256',
  'record_receipts',
  'replayed',
]);
const DATABASE_FINALIZE_RPC_RECEIPT_KEYS = Object.freeze([
  'batch_id',
  'batch_status',
  'canonical_record_count',
  'duplicate_record_count',
  'conflict_record_count',
  'records_sha256',
  'candidates_sha256',
  'record_receipts',
  'replayed',
]);
const DATABASE_REVIEW_DECISION_KEYS = Object.freeze([
  'recordOrdinal',
  'recordSha256',
  'decision',
  'reason',
]);
const DATABASE_NORMALIZED_PAYLOAD_KEYS = Object.freeze({
  product: Object.freeze([
    'recordKind',
    'canonicalKey',
    'barcode',
    'name',
    'brand',
    'category',
    'ingredientsText',
    'source',
    'sourceRef',
    'sourceUrl',
    'sourceRecordModifiedDate',
    'sourceArtifactSha256',
    'sourceSnapshotDate',
    'region',
    'qualityGrade',
    'reviewStatus',
  ]),
  ingredient: Object.freeze([
    'recordKind',
    'canonicalKey',
    'inciName',
    'normalizedInciName',
    'displayName',
    'casNumber',
    'ecNumber',
    'annexStatus',
    'source',
    'sourceRef',
    'sourceUrl',
    'sourceRecordStatus',
    'glossaryDecision',
    'sourceArtifactSha256',
    'sourceSnapshotDate',
    'reviewStatus',
    'synonyms',
  ]),
});
const DATABASE_CANDIDATE_KEYS = Object.freeze({
  product: Object.freeze([
    'recordKind',
    'canonicalKey',
    'barcode',
    'name',
    'brand',
    'category',
    'ingredientsText',
    'source',
    'sourceComponentId',
    'sourceRef',
    'sourceUrl',
    'sourceRecordModifiedDate',
    'sourceArtifactSha256',
    'qualityGrade',
    'reviewStatus',
    'sourceSnapshotDate',
    'region',
  ]),
  ingredient: Object.freeze([
    'recordKind',
    'canonicalKey',
    'inciName',
    'displayName',
    'casNumber',
    'ecNumber',
    'annexStatus',
    'sourceRef',
    'sourceRecordStatus',
    'glossaryDecision',
    'source',
    'sourceComponentId',
    'sourceUrl',
    'sourceArtifactSha256',
    'reviewStatus',
    'synonyms',
    'sourceSnapshotDate',
  ]),
});
const DATABASE_NORMALIZED_RECORD_BINDING = Object.freeze({
  contractId: CATALOG_DATABASE_NORMALIZED_RECORD_HASH_CONTRACT_ID,
  normalizationVersion: 'catalog-import-lifecycle-0057-normalization-v1',
  normalizedPayloadBuilder: 'catalogDatabaseNormalizedPayload',
  canonicalization: 'recursive-lexicographic-object-keys-preserved-array-order-json-primitives-v1',
  recordHash: 'SHA-256(UTF-8 canonicalJson(normalizedPayload))',
  databaseCanonicalizer: 'private.catalog_import_canonical_json',
  exactFieldValueComparisonRequired: true,
});
const ALLOWED_ANNEX_STATUSES = new Set([
  null,
  'restricted',
  'prohibited',
  'preservative',
  'uv_filter',
  'colourant',
]);
const ALLOWED_PRODUCT_CATEGORIES = new Set([
  null,
  'cleanser',
  'toner',
  'serum',
  'moisturiser_tube',
  'spf',
]);

const SOURCE_CONTRACTS = Object.freeze({
  open_beauty_facts: Object.freeze({
    componentId: 'obf_odbl_component',
    importMode: 'approved_offline_export',
    parserVersion: 'phase4-obf-transform-v2',
    recordField: 'products',
    isolationMode: 'separate_source_component_pending_legal_classification',
    projectedFields: Object.freeze([
      'code',
      'product_name',
      'brands',
      'categories_tags',
      'ingredients_text',
      'last_modified_t',
    ]),
    forbiddenArtifactSha256: Object.freeze([
      'c9a150c17cac824f78a85671544bea22fa04156dbbc4693b6ff3538a6205a8e5',
    ]),
  }),
  cosing: Object.freeze({
    componentId: 'cosing_reference_component',
    importMode: 'approved_offline_snapshot',
    parserVersion: 'phase4-cosing-transform-v2',
    recordField: 'ingredients',
    isolationMode: 'provenance_tagged_reference_component',
    projectedFields: Object.freeze([
      'inci_name',
      'display_name',
      'cas_number',
      'ec_number',
      'annex_status',
      'synonyms',
      'cosing_ref',
      'record_status',
      'glossary_decision',
    ]),
    forbiddenArtifactSha256: Object.freeze([
      '7bb4651229ab07aa7fd70f11168ddfcc41da75cd61279d7f0d413b1ea809e3a4',
    ]),
  }),
});

const TRANSFORM_KEYS = Object.freeze({
  open_beauty_facts: Object.freeze([
    'generatedAt',
    'schemaVersion',
    'status',
    'inputPath',
    'inputSha256',
    'source',
    'sourceComponentId',
    'sourcePolicy',
    'sourceApproval',
    'transformerCandidate',
    'sourceSnapshot',
    'importMode',
    'parserVersion',
    'transformedPayloadContract',
    'transformedPayloadSha256',
    'projectedFields',
    'sourceIsolationMode',
    'licenses',
    'controls',
    'warning',
    'totals',
    'products',
    'rejected',
  ]),
  cosing: Object.freeze([
    'generatedAt',
    'schemaVersion',
    'status',
    'source',
    'sourceComponentId',
    'sourcePolicy',
    'sourceApproval',
    'transformerCandidate',
    'sourceSnapshot',
    'importMode',
    'parserVersion',
    'transformedPayloadContract',
    'transformedPayloadSha256',
    'projectedFields',
    'sourceIsolationMode',
    'reuseBasis',
    'controls',
    'warning',
    'inputPath',
    'inputSha256',
    'totals',
    'ingredients',
  ]),
});

const QA_KEYS = Object.freeze([
  'generatedAt',
  'launchContract',
  'inputPath',
  'gitSha',
  'buildSourceGitSha',
  'gitStatus',
  'source',
  'status',
  'importMode',
  'inputArtifact',
  'transformedPayloadContract',
  'transformedPayloadSha256',
  'recomputedTransformSha256',
  'sourceHashes',
  'totals',
  'blockers',
  'warnings',
  'localQaClear',
  'launchClear',
  'launchClearReason',
]);

function fail(message) {
  throw new Error(`Catalog stage contract rejected input: ${message}`);
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

function assertDigest(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest.`);
  }
}

function assertText(value, label, { max = 500, min = 1 } = {}) {
  if (
    typeof value !== 'string' ||
    value.length < min ||
    value.length > max ||
    value !== value.trim() ||
    CONTROL_PATTERN.test(value)
  ) {
    fail(`${label} must be trimmed control-free text between ${min} and ${max} characters.`);
  }
}

function assertDate(value, label) {
  const parsed =
    typeof value === 'string' && DATE_PATTERN.test(value)
      ? Date.parse(`${value}T00:00:00.000Z`)
      : Number.NaN;
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    fail(`${label} must be a valid YYYY-MM-DD date.`);
  }
}

function assertTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !RFC3339_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(`${label} must be a strict UTC RFC3339 instant.`);
  }
}

function decodeCanonicalSignature(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) {
    fail(`${label} must be canonical base64.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== value) {
    fail(`${label} must be canonical 64-byte Ed25519 signature base64.`);
  }
  return bytes;
}

export function catalogRowReviewSigningPayload(overlay, reviewerId) {
  if (!isObject(overlay)) fail('row-review signing payload requires an overlay object.');
  if (typeof reviewerId !== 'string' || !REVIEWER_ID_PATTERN.test(reviewerId)) {
    fail('row-review signing payload reviewerId is malformed.');
  }
  const unsignedOverlay = { ...overlay };
  delete unsignedOverlay.signatures;
  return Buffer.from(
    canonicalJson({
      signatureEnvelopeVersion: CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE,
      signingDomain: CATALOG_ROW_REVIEW_SIGNING_DOMAIN,
      reviewerId,
      overlay: unsignedOverlay,
    }),
    'utf8',
  );
}

function assertArray(value, label, { min = 0, max = MAXIMUM_RECORDS } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${label} must contain between ${min} and ${max} entries.`);
  }
}

function assertNoSecretKeys(value, label, depth = 0) {
  if (depth > 100) fail(`${label} exceeds the bounded nesting depth.`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretKeys(entry, `${label}[${index}]`, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_SECRET_KEY_PATTERN.test(key))
      fail(`${label} contains forbidden secret field ${key}.`);
    assertNoSecretKeys(entry, `${label}.${key}`, depth + 1);
  }
}

function normalizedPath(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isWithin(parent, child) {
  const delta = relative(parent, child);
  return delta === '' || (!delta.startsWith(`..${sep}`) && delta !== '..' && !isAbsolute(delta));
}

function assertNoSymlinkComponents(path, label) {
  const absolute = resolve(path);
  const parsedRoot = resolve(absolute, sep);
  const remainder = absolute
    .slice(parsedRoot.length)
    .split(/[\\/]+/u)
    .filter(Boolean);
  let current = parsedRoot;
  for (const part of remainder) {
    current = resolve(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      fail(`${label} does not exist at ${current}.`);
    }
    if (stat.isSymbolicLink()) fail(`${label} contains a symlink or junction at ${current}.`);
  }
}

function readStableFileBytes(path, label, maxBytes) {
  const absolute = resolve(path);
  assertNoSymlinkComponents(absolute, label);
  const real = realpathSync.native(absolute);
  if (normalizedPath(real) !== normalizedPath(absolute)) {
    fail(`${label} must use its real canonical path without aliases.`);
  }
  const before = statSync(real);
  if (!before.isFile()) fail(`${label} must be a regular file.`);
  if (before.size < 2 || before.size > maxBytes) {
    fail(`${label} exceeds its bounded ${maxBytes}-byte file limit.`);
  }
  const bytes = readFileSync(real);
  const after = statSync(real);
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    bytes.length !== after.size
  ) {
    fail(`${label} changed while it was being read.`);
  }
  return { bytes, path: real, sha256: sha256(bytes) };
}

function readStableEvidenceFile(path, label, maxBytes) {
  const evidence = readStableFileBytes(path, label, maxBytes);
  return {
    ...evidence,
    value: parseCatalogEvidenceJson(evidence.bytes, label, { maxBytes }),
  };
}

function workspaceRelative(root, path) {
  const delta = relative(root, path).replace(/\\/gu, '/');
  if (!delta || delta === '..' || delta.startsWith('../')) {
    fail('Evidence inputs and outputs must stay inside the workspace.');
  }
  return delta;
}

function validateRetainedSnapshot(snapshot, label) {
  assertExactKeys(snapshot, ['manifest', 'manifestBytesBase64', 'sha256'], label);
  assertDigest(snapshot.sha256, `${label}.sha256`);
  if (
    typeof snapshot.manifestBytesBase64 !== 'string' ||
    snapshot.manifestBytesBase64.length === 0 ||
    snapshot.manifestBytesBase64.length % 4 !== 0
  ) {
    fail(`${label}.manifestBytesBase64 must be canonical non-empty base64.`);
  }
  const bytes = Buffer.from(snapshot.manifestBytesBase64, 'base64');
  if (bytes.toString('base64') !== snapshot.manifestBytesBase64) {
    fail(`${label}.manifestBytesBase64 is not canonical base64.`);
  }
  const parsed = parseCatalogEvidenceJson(bytes, `${label} retained bytes`, {
    maxBytes: 2 * 1024 * 1024,
  });
  if (sha256(bytes) !== snapshot.sha256) fail(`${label} retained bytes do not match its hash.`);
  if (canonicalJson(parsed) !== canonicalJson(snapshot.manifest)) {
    fail(`${label} retained bytes do not match its embedded manifest.`);
  }
  return parsed;
}

function validateSourceApproval(transform, contract) {
  assertExactKeys(
    transform.sourceApproval,
    [
      'manifest',
      'manifestBytesBase64',
      'manifestSha256',
      'releaseBuildEvidenceSnapshot',
      'releaseScopeSnapshot',
      'transformerSnapshot',
      'trustRegistrySnapshot',
    ],
    'transform.sourceApproval',
  );
  const approvalEnvelope = {
    manifest: transform.sourceApproval.manifest,
    manifestBytesBase64: transform.sourceApproval.manifestBytesBase64,
    sha256: transform.sourceApproval.manifestSha256,
  };
  const approval = validateRetainedSnapshot(approvalEnvelope, 'source approval');
  assertExactKeys(
    approval,
    [
      'schemaVersion',
      'signatureEnvelopeVersion',
      'policyId',
      'policySha256',
      'trustRegistry',
      'releaseScope',
      'transformer',
      'sourceKey',
      'decision',
      'reviewId',
      'decisionEvidence',
      'reviewedAt',
      'expiresAt',
      'artifact',
      'termsSnapshot',
      'attribution',
      'scope',
      'determinations',
      'operations',
      'controls',
      'allowedUses',
      'forbiddenUses',
      'reviewers',
      'signatures',
    ],
    'source approval manifest',
  );
  if (
    approval.schemaVersion !== 1 ||
    approval.signatureEnvelopeVersion !== 'catalog-source-approval-signature-v1' ||
    approval.decision !== 'approved' ||
    approval.sourceKey !== transform.source
  ) {
    fail('source approval is not an approved v1 decision for the exact source.');
  }
  assertExactKeys(approval.trustRegistry, ['registryId', 'sha256'], 'approval.trustRegistry');
  assertExactKeys(approval.releaseScope, ['scopeId', 'sha256'], 'approval.releaseScope');
  assertExactKeys(
    approval.artifact,
    [
      'sha256',
      'bytes',
      'snapshotDate',
      'sourceUrl',
      'upstreamSha256',
      'acquisitionEvidenceUri',
      'acquisitionEvidenceSha256',
      'transformationRecordContractId',
      'transformationRecordSha256',
    ],
    'approval.artifact',
  );
  assertExactKeys(approval.scope, ['appIdentity', 'territories', 'fields'], 'approval.scope');
  assertExactKeys(
    approval.controls,
    [
      'offlineImportOnly',
      'imagesIncluded',
      'runtimeRequests',
      'contributionBack',
      'databaseComponentId',
    ],
    'approval.controls',
  );
  if (
    approval.controls.offlineImportOnly !== true ||
    approval.controls.imagesIncluded !== false ||
    approval.controls.runtimeRequests !== false ||
    approval.controls.contributionBack !== false ||
    approval.controls.databaseComponentId !== contract.componentId
  ) {
    fail('source approval external-recipient/image controls are not fail-closed.');
  }
  if (canonicalJson(approval.scope.territories) !== canonicalJson(['US'])) {
    fail('source approval must be scoped exactly to the US launch territory.');
  }
  if (canonicalJson(approval.scope.fields) !== canonicalJson(contract.projectedFields)) {
    fail('source approval fields do not match the exact source projection.');
  }
  if (
    approval.artifact.sha256 !== transform.inputSha256 ||
    approval.artifact.bytes !== transform.sourceSnapshot.bytes ||
    approval.artifact.snapshotDate !== transform.sourceSnapshot.date ||
    approval.artifact.sourceUrl !== transform.sourceSnapshot.url ||
    approval.artifact.transformationRecordContractId !==
      CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.contractId ||
    approval.artifact.transformationRecordSha256 !== transform.transformedPayloadSha256
  ) {
    fail(
      'source approval artifact/snapshot/transformed-payload bindings do not match the transform.',
    );
  }
  if (
    approval.policyId !== transform.sourcePolicy.policyId ||
    approval.policySha256 !== transform.sourcePolicy.sha256
  ) {
    fail('source approval policy identity/hash does not match the transform.');
  }
  if (
    canonicalJson(approval.transformer) !==
    canonicalJson(transform.sourceApproval.transformerSnapshot)
  ) {
    fail('source approval transformer does not match the retained transformer snapshot.');
  }
  if (
    approval.transformer.parserVersion !== contract.parserVersion ||
    approval.transformer.gitCommitSha === undefined ||
    !GIT_SHA_PATTERN.test(approval.transformer.gitCommitSha) ||
    !SHA256_PATTERN.test(approval.transformer.sha256 ?? '')
  ) {
    fail('source approval transformer lacks the exact parser/build-source Git binding.');
  }
  assertDigest(approval.trustRegistry.sha256, 'approval.trustRegistry.sha256');
  assertDigest(approval.releaseScope.sha256, 'approval.releaseScope.sha256');

  const trust = validateRetainedSnapshot(
    transform.sourceApproval.trustRegistrySnapshot,
    'trust registry snapshot',
  );
  const release = validateRetainedSnapshot(
    transform.sourceApproval.releaseScopeSnapshot,
    'release scope snapshot',
  );
  const build = validateRetainedSnapshot(
    transform.sourceApproval.releaseBuildEvidenceSnapshot,
    'release build evidence snapshot',
  );
  assertExactKeys(
    trust,
    [
      'schemaVersion',
      'registryId',
      'policyId',
      'epoch',
      'status',
      'updatedAt',
      'reviewers',
      'rootSignature',
    ],
    'trust registry manifest',
  );
  if (
    trust.schemaVersion !== 1 ||
    trust.status !== 'active' ||
    trust.registryId !== approval.trustRegistry.registryId ||
    transform.sourceApproval.trustRegistrySnapshot.sha256 !== approval.trustRegistry.sha256
  ) {
    fail('active trust-registry snapshot does not match the approved source decision.');
  }
  assertArray(trust.reviewers, 'trust registry reviewers', { min: 2, max: MAXIMUM_REVIEWERS });
  assertExactKeys(
    release,
    [
      'schemaVersion',
      'scopeId',
      'status',
      'appIdentity',
      'territories',
      'attribution',
      'approvedAt',
      'expiresAt',
      'evidence',
    ],
    'release scope manifest',
  );
  if (
    release.schemaVersion !== 1 ||
    release.status !== 'approved' ||
    release.scopeId !== approval.releaseScope.scopeId ||
    transform.sourceApproval.releaseScopeSnapshot.sha256 !== approval.releaseScope.sha256 ||
    canonicalJson(release.territories) !== canonicalJson(['US']) ||
    canonicalJson(release.appIdentity) !== canonicalJson(approval.scope.appIdentity)
  ) {
    fail('approved US release-scope snapshot does not match the source approval.');
  }
  assertExactKeys(
    build,
    [
      'schemaVersion',
      'evidenceId',
      'status',
      'releaseScope',
      'trustRegistry',
      'easBuild',
      'archive',
      'appStoreRelease',
      'territories',
      'evidence',
      'verifiedAt',
      'verifier',
      'signature',
    ],
    'release build evidence manifest',
  );
  if (
    build.schemaVersion !== 1 ||
    build.status !== 'verified' ||
    canonicalJson(build.territories) !== canonicalJson(['US']) ||
    build.releaseScope?.scopeId !== release.scopeId ||
    build.releaseScope?.sha256 !== transform.sourceApproval.releaseScopeSnapshot.sha256 ||
    build.trustRegistry?.registryId !== trust.registryId ||
    build.trustRegistry?.epoch !== trust.epoch ||
    build.trustRegistry?.sha256 !== transform.sourceApproval.trustRegistrySnapshot.sha256 ||
    build.easBuild?.profile !== 'production' ||
    build.easBuild?.platform !== 'ios' ||
    build.easBuild?.gitCommitSha !== approval.transformer.gitCommitSha
  ) {
    fail(
      'verified iOS release-build evidence does not exactly bind release scope, trust, and transformer commit.',
    );
  }
  return { approval, trust, release, build };
}

function validateObfRecord(record, index, transform, contract) {
  assertExactKeys(
    record,
    [
      'barcode',
      'name',
      'brand',
      'category',
      'ingredientsText',
      'source',
      'sourceComponentId',
      'sourceRef',
      'sourceUrl',
      'sourceRecordModifiedDate',
      'sourceArtifactSha256',
      'qualityGrade',
      'reviewStatus',
      'sourceSnapshotDate',
    ],
    `transform.products[${index}]`,
  );
  if (typeof record.barcode !== 'string' || !/^\d{8,14}$/u.test(record.barcode)) {
    fail(`transform.products[${index}].barcode must be an exact 8-14 digit natural key.`);
  }
  assertText(record.name, `transform.products[${index}].name`, { max: 200 });
  if (record.brand !== null)
    assertText(record.brand, `transform.products[${index}].brand`, { max: 300 });
  if (record.category !== null)
    assertText(record.category, `transform.products[${index}].category`, { max: 100 });
  if (!ALLOWED_PRODUCT_CATEGORIES.has(record.category)) {
    fail(
      `transform.products[${index}].category is outside the frozen ASCII product-type vocabulary.`,
    );
  }
  if (record.ingredientsText !== null) {
    assertText(record.ingredientsText, `transform.products[${index}].ingredientsText`, {
      max: 20_000,
    });
  }
  if (
    record.source !== transform.source ||
    record.sourceComponentId !== contract.componentId ||
    record.sourceRef !== record.barcode ||
    record.sourceUrl !== `https://world.openbeautyfacts.org/product/${record.barcode}` ||
    record.sourceArtifactSha256 !== transform.inputSha256 ||
    record.sourceSnapshotDate !== transform.sourceSnapshot.date ||
    !['limited', 'unverified'].includes(record.qualityGrade) ||
    record.reviewStatus !== 'unreviewed'
  ) {
    fail(`transform.products[${index}] violates exact source/provenance bindings.`);
  }
  assertDate(
    record.sourceRecordModifiedDate,
    `transform.products[${index}].sourceRecordModifiedDate`,
  );
  if (record.sourceRecordModifiedDate > record.sourceSnapshotDate) {
    fail(
      `transform.products[${index}].sourceRecordModifiedDate cannot postdate its source snapshot.`,
    );
  }
  return {
    naturalKey: record.barcode,
    sourceRefKey: record.sourceRef,
    identifiers: {},
  };
}

export function normalizeCosingNaturalKey(value) {
  if (typeof value !== 'string') fail('CosIng INCI natural key must be text.');
  return normalizeCatalogCosingKey(value);
}

function validateCosingRecord(record, index, transform, contract) {
  assertExactKeys(
    record,
    [
      'inciName',
      'displayName',
      'casNumber',
      'ecNumber',
      'annexStatus',
      'sourceRef',
      'sourceRecordStatus',
      'glossaryDecision',
      'source',
      'sourceComponentId',
      'sourceArtifactSha256',
      'reviewStatus',
      'synonyms',
      'sourceSnapshotDate',
    ],
    `transform.ingredients[${index}]`,
  );
  assertText(record.inciName, `transform.ingredients[${index}].inciName`, { max: 300 });
  assertText(record.displayName, `transform.ingredients[${index}].displayName`, { max: 300 });
  if (record.casNumber !== null && !/^\d{2,7}-\d{2}-\d$/u.test(record.casNumber)) {
    fail(`transform.ingredients[${index}].casNumber is malformed.`);
  }
  if (record.ecNumber !== null && !/^\d{3}-\d{3}-\d$/u.test(record.ecNumber)) {
    fail(`transform.ingredients[${index}].ecNumber is malformed.`);
  }
  if (record.annexStatus !== null) {
    assertText(record.annexStatus, `transform.ingredients[${index}].annexStatus`, { max: 500 });
  }
  if (
    typeof record.sourceRef !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(record.sourceRef)
  ) {
    fail(`transform.ingredients[${index}].sourceRef is malformed.`);
  }
  assertArray(record.synonyms, `transform.ingredients[${index}].synonyms`, { min: 0, max: 50 });
  const synonymKeys = record.synonyms.map((synonym, synonymIndex) => {
    assertText(synonym, `transform.ingredients[${index}].synonyms[${synonymIndex}]`, { max: 300 });
    return normalizeCosingNaturalKey(synonym);
  });
  const naturalKey = normalizeCosingNaturalKey(record.inciName);
  if (new Set(synonymKeys).size !== synonymKeys.length || synonymKeys.includes(naturalKey)) {
    fail(`transform.ingredients[${index}] contains a local INCI/synonym collision.`);
  }
  if (
    record.sourceRecordStatus !== 'active' ||
    record.glossaryDecision !== 'EU_2025_1175' ||
    record.source !== transform.source ||
    record.sourceComponentId !== contract.componentId ||
    record.sourceArtifactSha256 !== transform.inputSha256 ||
    record.reviewStatus !== 'unreviewed' ||
    record.sourceSnapshotDate !== transform.sourceSnapshot.date
  ) {
    fail(`transform.ingredients[${index}] violates exact source/provenance bindings.`);
  }
  return {
    naturalKey,
    sourceRefKey: normalizeCosingNaturalKey(record.sourceRef),
    identifiers: {
      cas: record.casNumber,
      ec: record.ecNumber,
      synonyms: synonymKeys,
    },
  };
}

function validateTransform(transform, transformEvidence) {
  if (!isObject(transform) || !Object.hasOwn(SOURCE_CONTRACTS, transform.source)) {
    fail('transform source is unsupported.');
  }
  const contract = SOURCE_CONTRACTS[transform.source];
  assertExactKeys(transform, TRANSFORM_KEYS[transform.source], 'transform');
  assertNoSecretKeys(transform, 'transform');
  if (
    transform.schemaVersion !== 2 ||
    transform.status !== 'approved_transform' ||
    transform.importMode !== contract.importMode ||
    transform.transformerCandidate !== null ||
    transform.sourceComponentId !== contract.componentId ||
    transform.parserVersion !== contract.parserVersion ||
    transform.sourceIsolationMode !== contract.isolationMode
  ) {
    fail('transform is not the exact approved source/import/component/parser/isolation state.');
  }
  assertTimestamp(transform.generatedAt, 'transform.generatedAt');
  assertExactKeys(transform.sourcePolicy, ['policyId', 'sha256'], 'transform.sourcePolicy');
  assertDigest(transform.sourcePolicy.sha256, 'transform.sourcePolicy.sha256');
  assertDigest(transform.inputSha256, 'transform.inputSha256');
  assertDigest(transform.transformedPayloadSha256, 'transform.transformedPayloadSha256');
  assertExactKeys(
    transform.sourceSnapshot,
    ['date', 'url', 'artifactSha256', 'bytes'],
    'transform.sourceSnapshot',
  );
  assertDate(transform.sourceSnapshot.date, 'transform.sourceSnapshot.date');
  assertText(transform.sourceSnapshot.url, 'transform.sourceSnapshot.url', { max: 2_000 });
  if (
    transform.sourceSnapshot.artifactSha256 !== transform.inputSha256 ||
    !Number.isInteger(transform.sourceSnapshot.bytes) ||
    transform.sourceSnapshot.bytes < 1
  ) {
    fail('transform source snapshot does not exactly bind input artifact hash/bytes.');
  }
  const inputDisplayPath = String(transform.inputPath ?? '')
    .replace(/\\/gu, '/')
    .toLowerCase();
  if (
    inputDisplayPath.includes('/fixtures/') ||
    inputDisplayPath.startsWith('scripts/phase4/fixtures/') ||
    contract.forbiddenArtifactSha256.includes(transform.inputSha256)
  ) {
    fail('fixture bytes or fixture paths can never enter a production stage envelope.');
  }
  if (
    canonicalJson(transform.transformedPayloadContract) !==
      canonicalJson(CATALOG_TRANSFORMED_PAYLOAD_CONTRACT) ||
    canonicalJson(transform.projectedFields) !== canonicalJson(contract.projectedFields)
  ) {
    fail('transform payload contract/projected fields are not the frozen source contract.');
  }
  const expectedControls =
    transform.source === 'cosing'
      ? {
          runtimeRequests: false,
          imagesIncluded: false,
          contributionBack: false,
          productionApprovalRequired: true,
          claimsAuthority: 'informative_reference_only',
        }
      : {
          runtimeRequests: false,
          imagesIncluded: false,
          contributionBack: false,
          productionApprovalRequired: true,
        };
  if (canonicalJson(transform.controls) !== canonicalJson(expectedControls)) {
    fail('transform external-recipient/image/contribution controls are unsafe.');
  }
  const records = transform[contract.recordField];
  assertArray(records, `transform.${contract.recordField}`, { min: 1, max: MAXIMUM_RECORDS });
  if (transform.source === 'open_beauty_facts') {
    assertArray(transform.rejected, 'transform.rejected', { min: 0, max: MAXIMUM_RECORDS });
    assertExactKeys(
      transform.totals,
      ['inputRecords', 'acceptedProducts', 'rejectedRecords', 'withIngredientText'],
      'transform.totals',
    );
    if (
      transform.totals.inputRecords !== records.length + transform.rejected.length ||
      transform.totals.acceptedProducts !== records.length ||
      transform.totals.rejectedRecords !== transform.rejected.length ||
      transform.totals.withIngredientText !==
        records.filter((record) => record?.ingredientsText).length
    ) {
      fail('transform OBF totals do not exactly match its records and transform rejections.');
    }
  } else {
    assertExactKeys(transform.totals, ['inputRows', 'ingredients', 'synonyms'], 'transform.totals');
    const synonymCount = records.reduce(
      (sum, record) => sum + (Array.isArray(record?.synonyms) ? record.synonyms.length : 0),
      0,
    );
    if (
      transform.totals.inputRows !== records.length ||
      transform.totals.ingredients !== records.length ||
      transform.totals.synonyms !== synonymCount
    ) {
      fail('transform CosIng totals do not exactly match its records and synonyms.');
    }
  }
  const recordMetadata = records.map((record, index) =>
    transform.source === 'open_beauty_facts'
      ? validateObfRecord(record, index, transform, contract)
      : validateCosingRecord(record, index, transform, contract),
  );
  const recordsBeforeSnapshot = records.map((record) => {
    const copy = { ...record };
    delete copy.sourceSnapshotDate;
    return copy;
  });
  const recomputed = catalogTransformedPayloadSha256({
    controls: expectedControls,
    inputSha256: transform.inputSha256,
    parserVersion: contract.parserVersion,
    projectedFields: contract.projectedFields,
    records: recordsBeforeSnapshot,
    rejected: transform.source === 'open_beauty_facts' ? transform.rejected : [],
    sourceComponentId: contract.componentId,
    sourceIsolationMode: contract.isolationMode,
    sourceKey: transform.source,
  });
  if (recomputed !== transform.transformedPayloadSha256) {
    fail('transform record bytes do not recompute to transformedPayloadSha256.');
  }
  const snapshots = validateSourceApproval(transform, contract);
  return { contract, records, recordMetadata, snapshots, transformEvidence };
}

function validateQa(qa, qaEvidence, transformState, root) {
  assertExactKeys(qa, QA_KEYS, 'QA report');
  assertNoSecretKeys(qa, 'QA report');
  assertTimestamp(qa.generatedAt, 'QA report.generatedAt');
  const transformPath = workspaceRelative(root, transformState.transformEvidence.path);
  assertExactKeys(
    qa.inputArtifact,
    ['path', 'exists', 'bytes', 'sha256'],
    'QA report.inputArtifact',
  );
  if (
    qa.source !== transformState.transformEvidence.value.source ||
    qa.status !== 'approved_transform' ||
    qa.importMode !== transformState.contract.importMode ||
    qa.transformedPayloadSha256 !==
      transformState.transformEvidence.value.transformedPayloadSha256 ||
    qa.recomputedTransformSha256 !==
      transformState.transformEvidence.value.transformedPayloadSha256 ||
    canonicalJson(qa.transformedPayloadContract) !==
      canonicalJson(CATALOG_TRANSFORMED_PAYLOAD_CONTRACT)
  ) {
    fail('QA report does not bind the exact approved transform state and digest.');
  }
  if (
    qa.inputPath.replace(/\\/gu, '/') !== transformPath ||
    qa.inputArtifact.path.replace(/\\/gu, '/') !== transformPath ||
    qa.inputArtifact.exists !== true ||
    qa.inputArtifact.bytes !== transformState.transformEvidence.bytes.length ||
    qa.inputArtifact.sha256 !== transformState.transformEvidence.sha256
  ) {
    fail('QA report input path/hash/bytes do not bind the exact transform file.');
  }
  const expectedLaunchContract = launchContractSnapshot(loadLaunchContract(root));
  if (canonicalJson(qa.launchContract) !== canonicalJson(expectedLaunchContract)) {
    fail('QA report launch contract does not match the current fixed launch contract.');
  }
  if (
    qa.localQaClear !== true ||
    !Array.isArray(qa.blockers) ||
    qa.blockers.length !== 0 ||
    !Array.isArray(qa.warnings) ||
    qa.warnings.length !== 0 ||
    typeof qa.gitStatus !== 'string' ||
    qa.gitStatus !== ''
  ) {
    fail('QA must be locally clear with zero blockers, warnings, and dirty Git paths.');
  }
  if (qa.launchClear !== false || qa.launchClearReason !== CATALOG_QA_LAUNCH_CLEAR_REASON) {
    fail('QA report must retain the exact non-launch-clear boundary.');
  }
  if (qa.buildSourceGitSha !== transformState.snapshots.build.easBuild.gitCommitSha) {
    fail('QA build-source identity does not match verified release-build evidence.');
  }
  if (typeof qa.gitSha !== 'string' || !GIT_SHA_PATTERN.test(qa.gitSha)) {
    fail('QA Git identity must be an exact lowercase commit SHA.');
  }
  assertExactKeys(
    qa.totals,
    [
      'records',
      'rejectedRecords',
      'missingCategory',
      'missingIngredients',
      'duplicateIdentifiers',
      'provenanceDrift',
      'imageFields',
    ],
    'QA report.totals',
  );
  const expectedRejectedRecords =
    transformState.transformEvidence.value.source === 'open_beauty_facts'
      ? transformState.transformEvidence.value.rejected.length
      : 0;
  if (
    qa.totals.records !== transformState.records.length ||
    qa.totals.rejectedRecords !== expectedRejectedRecords ||
    qa.totals.missingCategory !== 0 ||
    qa.totals.missingIngredients !== 0 ||
    qa.totals.duplicateIdentifiers !== 0 ||
    qa.totals.provenanceDrift !== 0 ||
    qa.totals.imageFields !== 0
  ) {
    fail('QA report exact counts are inconsistent or retain a catalog quality finding.');
  }
  if (
    transformState.transformEvidence.value.source === 'open_beauty_facts' &&
    transformState.records.some((record) => !record.category || !record.ingredientsText)
  ) {
    fail('QA report cannot be zero-warning while an OBF row lacks category or ingredients.');
  }
  assertArray(qa.sourceHashes, 'QA report.sourceHashes', { min: 1, max: 1_000 });
  for (const [index, entry] of qa.sourceHashes.entries()) {
    assertExactKeys(
      entry,
      ['path', 'exists', 'bytes', 'sha256'],
      `QA report.sourceHashes[${index}]`,
    );
    if (entry.exists !== true || !Number.isInteger(entry.bytes) || entry.bytes < 1) {
      fail(`QA report.sourceHashes[${index}] is not a present bounded source hash.`);
    }
    assertDigest(entry.sha256, `QA report.sourceHashes[${index}].sha256`);
  }
  return qaEvidence;
}

function gitHeadCommit(root) {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, 'rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0 || !GIT_SHA_PATTERN.test(result.stdout.trim())) {
    fail(`current Git HEAD is unavailable: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function gitCommittedFileBytes(root, commitSha, path) {
  const result = spawnSync(
    'git',
    ['-c', `safe.directory=${root}`, 'show', `${commitSha}:${path}`],
    {
      cwd: root,
      encoding: null,
      maxBuffer: 101 * 1024 * 1024,
    },
  );
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    fail(`QA source hash ${path} is not an exact tracked file at ${commitSha}.`);
  }
  return result.stdout;
}

export function validatePromotionQaSourceHashes(qa, root = process.cwd()) {
  const realRoot = realpathSync.native(resolve(root));
  if (typeof qa?.gitSha !== 'string' || !GIT_SHA_PATTERN.test(qa.gitSha)) {
    fail('QA source hash inventory requires an exact lowercase Git commit SHA.');
  }
  const currentHead = gitHeadCommit(realRoot);
  if (qa.gitSha !== currentHead) {
    fail('QA source hash inventory Git SHA must equal current HEAD.');
  }
  assertArray(qa?.sourceHashes, 'QA report.sourceHashes', {
    min: REQUIRED_PROMOTION_QA_SOURCE_PATHS.length,
    max: REQUIRED_PROMOTION_QA_SOURCE_PATHS.length,
  });
  const paths = new Map();
  for (const [index, entry] of qa.sourceHashes.entries()) {
    assertExactKeys(
      entry,
      ['path', 'exists', 'bytes', 'sha256'],
      `QA report.sourceHashes[${index}]`,
    );
    if (
      typeof entry.path !== 'string' ||
      entry.path.length < 1 ||
      entry.path.length > 500 ||
      entry.path.includes('\\') ||
      isAbsolute(entry.path) ||
      entry.path === '..' ||
      entry.path.startsWith('../')
    ) {
      fail(`QA report.sourceHashes[${index}].path is unsafe.`);
    }
    if (entry.path !== REQUIRED_PROMOTION_QA_SOURCE_PATHS[index]) {
      fail(
        `QA source hash inventory must exactly match the ordered promotion authority paths at index ${index}.`,
      );
    }
    if (paths.has(entry.path)) fail('QA report.sourceHashes paths must be unique.');
    if (entry.exists !== true || !Number.isInteger(entry.bytes) || entry.bytes < 1) {
      fail(`QA report.sourceHashes[${index}] is not a present bounded source hash.`);
    }
    assertDigest(entry.sha256, `QA report.sourceHashes[${index}].sha256`);
    const current = readStableFileBytes(
      resolve(realRoot, entry.path),
      `QA source hash ${entry.path}`,
      100 * 1024 * 1024,
    );
    if (
      !isWithin(realRoot, current.path) ||
      workspaceRelative(realRoot, current.path) !== entry.path ||
      current.bytes.length !== entry.bytes ||
      current.sha256 !== entry.sha256
    ) {
      fail(`QA source hash ${entry.path} does not match the current exact file bytes.`);
    }
    const committed = gitCommittedFileBytes(realRoot, qa.gitSha, entry.path);
    if (!current.bytes.equals(committed)) {
      fail(`QA source hash ${entry.path} does not match its exact committed Git blob.`);
    }
    paths.set(entry.path, entry);
  }
  return paths;
}

function assertCurrentSnapshot(snapshot, current, currentValue, label) {
  if (
    snapshot.sha256 !== current.sha256 ||
    canonicalJson(snapshot.manifest) !== canonicalJson(currentValue)
  ) {
    fail(`${label} is not the current fixed repository evidence.`);
  }
}

export function validateCurrentCatalogPromotionAuthority({
  root,
  transformState,
  qa,
  reviewState,
  env = process.env,
}) {
  const realRoot = realpathSync.native(resolve(root));
  assertCatalogSourceTreeClean(realRoot);
  const policy = loadCatalogSourcePolicy(realRoot);
  const trust = loadCatalogSourceTrustRegistry(realRoot);
  const release = loadCatalogReleaseScope(realRoot);
  const build = loadCatalogReleaseBuildEvidence(realRoot, {
    releaseScope: release.scope,
    releaseScopeSha256: release.sha256,
    requireVerified: true,
    trustRegistry: trust.registry,
    trustRegistrySha256: trust.sha256,
  });
  const embedded = transformState.snapshots;
  if (
    transformState.transformEvidence.value.sourcePolicy.policyId !== policy.policy.policyId ||
    transformState.transformEvidence.value.sourcePolicy.sha256 !== policy.sha256
  ) {
    fail('approved transform does not bind the current fixed source-policy bytes.');
  }
  assertCurrentSnapshot(
    transformState.transformEvidence.value.sourceApproval.trustRegistrySnapshot,
    trust,
    trust.registry,
    'retained trust registry',
  );
  assertCurrentSnapshot(
    transformState.transformEvidence.value.sourceApproval.releaseScopeSnapshot,
    release,
    release.scope,
    'retained release scope',
  );
  assertCurrentSnapshot(
    transformState.transformEvidence.value.sourceApproval.releaseBuildEvidenceSnapshot,
    build,
    build.evidence,
    'retained release build evidence',
  );
  const buildSourceGitSha = build.evidence.easBuild.gitCommitSha;
  if (qa.buildSourceGitSha !== buildSourceGitSha) {
    fail('QA build-source Git SHA does not match current verified release evidence.');
  }
  const ancestry = assertCatalogBuildSourceCommit(realRoot, buildSourceGitSha);
  const currentHead = gitHeadCommit(realRoot);
  if (qa.gitSha !== currentHead || ancestry.headCommitSha !== currentHead) {
    fail('QA Git SHA must equal the current clean evidence checkout HEAD.');
  }
  validatePromotionQaSourceHashes(qa, realRoot);
  const transformerPath =
    transformState.transformEvidence.value.source === 'open_beauty_facts'
      ? 'scripts/phase4/import-obf-snapshot.mjs'
      : 'scripts/phase4/import-cosing-dictionary.mjs';
  const transformer = catalogTransformerDescriptor(
    realRoot,
    transformerPath,
    transformState.contract.parserVersion,
    { sourceCommitSha: buildSourceGitSha },
  );
  if (
    canonicalJson(transformer) !==
    canonicalJson(transformState.transformEvidence.value.sourceApproval.transformerSnapshot)
  ) {
    fail('retained transformer snapshot does not match the current build-source descriptor.');
  }
  const runtimeRelease = catalogReleaseIdentityFromRepository(realRoot, env, {
    includeEvidence: true,
  });
  if (canonicalJson(runtimeRelease.easBuild) !== canonicalJson(build.evidence.easBuild)) {
    fail('current production EAS identity does not match signed release-build evidence.');
  }
  const buildErrors = validateCatalogReleaseBuildEvidence(build.evidence, {
    releaseScope: release.scope,
    releaseScopeSha256: release.sha256,
    requireVerified: true,
    trustRegistry: trust.registry,
    trustRegistrySha256: trust.sha256,
  });
  const approvalErrors = validateProductionApproval({
    approval: embedded.approval,
    artifactSha256: transformState.transformEvidence.value.inputSha256,
    artifactBytes: transformState.transformEvidence.value.sourceSnapshot.bytes,
    policy: policy.policy,
    policySha256: policy.sha256,
    releaseScope: release.scope,
    releaseRuntimeIdentity: runtimeRelease.identity,
    releaseScopeSha256: release.sha256,
    sourceKey: transformState.transformEvidence.value.source,
    transformer,
    transformedPayloadSha256: transformState.transformEvidence.value.transformedPayloadSha256,
    trustRegistry: trust.registry,
    trustRegistrySha256: trust.sha256,
    trustRoot: trust.trustedRoot,
  });
  const errors = [...buildErrors, ...approvalErrors];
  if (errors.length > 0) {
    fail(`current cryptographic catalog authority revalidation failed:\n- ${errors.join('\n- ')}`);
  }
  const rowReviewAuthority = validateRowReviewTrustAuthority({
    reviewers: reviewState?.reviewers,
    overlay: reviewState?.reviewEvidence?.value,
    trustRegistry: trust.registry,
    approval: embedded.approval,
  });
  return {
    buildSourceGitSha,
    evidenceHeadGitSha: currentHead,
    sourcePolicySha256: policy.sha256,
    trustRegistrySha256: trust.sha256,
    releaseScopeSha256: release.sha256,
    releaseBuildEvidenceSha256: build.sha256,
    rowReviewAuthority,
  };
}

function validateReviewers(reviewers) {
  assertArray(reviewers, 'review overlay.reviewers', { min: 2, max: 2 });
  const byId = new Map();
  const evidenceUris = new Set();
  const evidenceHashes = new Set();
  for (const [index, reviewer] of reviewers.entries()) {
    assertExactKeys(
      reviewer,
      [
        'reviewerId',
        'role',
        'trustRegistryKeyId',
        'trustRegistryRole',
        'independenceGroup',
        'publicKeySha256',
        'evidenceUri',
        'evidenceSha256',
      ],
      `review overlay.reviewers[${index}]`,
    );
    if (typeof reviewer.reviewerId !== 'string' || !REVIEWER_ID_PATTERN.test(reviewer.reviewerId)) {
      fail(`review overlay.reviewers[${index}].reviewerId is malformed.`);
    }
    if (!['catalog_reviewer', 'data_quality_reviewer'].includes(reviewer.role)) {
      fail(`review overlay.reviewers[${index}].role is unsupported.`);
    }
    if (!TRUST_KEY_ID_PATTERN.test(reviewer.trustRegistryKeyId ?? '')) {
      fail(`review overlay.reviewers[${index}].trustRegistryKeyId is malformed.`);
    }
    if (!['legal', 'engineering'].includes(reviewer.trustRegistryRole)) {
      fail(`review overlay.reviewers[${index}].trustRegistryRole is unsupported.`);
    }
    assertText(reviewer.independenceGroup, `review overlay.reviewers[${index}].independenceGroup`, {
      max: 128,
    });
    assertDigest(reviewer.publicKeySha256, `review overlay.reviewers[${index}].publicKeySha256`);
    if (
      typeof reviewer.evidenceUri !== 'string' ||
      !EVIDENCE_URI_PATTERN.test(reviewer.evidenceUri)
    ) {
      fail(`review overlay.reviewers[${index}].evidenceUri must be an HTTPS evidence URI.`);
    }
    assertDigest(reviewer.evidenceSha256, `review overlay.reviewers[${index}].evidenceSha256`);
    const key = reviewer.reviewerId.toLowerCase();
    if (byId.has(key)) fail('review overlay reviewer identities must be distinct.');
    const evidenceUriKey = reviewer.evidenceUri.toLowerCase();
    if (evidenceUris.has(evidenceUriKey) || evidenceHashes.has(reviewer.evidenceSha256)) {
      fail('review overlay reviewer evidence records must be distinct.');
    }
    evidenceUris.add(evidenceUriKey);
    evidenceHashes.add(reviewer.evidenceSha256);
    byId.set(key, reviewer);
  }
  if (
    ![...byId.values()].some((entry) => entry.role === 'catalog_reviewer') ||
    ![...byId.values()].some((entry) => entry.role === 'data_quality_reviewer')
  ) {
    fail('review overlay requires both catalog and data-quality reviewer roles.');
  }
  return byId;
}

function validateRowReviewSignatures(overlay, reviewers) {
  assertArray(overlay.signatures, 'review overlay.signatures', {
    min: reviewers.size,
    max: reviewers.size,
  });
  const signatures = new Map();
  for (const [index, signature] of overlay.signatures.entries()) {
    assertExactKeys(
      signature,
      ['reviewerId', 'keyId', 'algorithm', 'valueBase64'],
      `review overlay.signatures[${index}]`,
    );
    const reviewer = reviewers.get(String(signature.reviewerId).toLowerCase());
    if (
      !reviewer ||
      signature.reviewerId !== reviewer.reviewerId ||
      signature.keyId !== reviewer.trustRegistryKeyId ||
      signature.algorithm !== 'Ed25519' ||
      signatures.has(signature.reviewerId.toLowerCase())
    ) {
      fail('review overlay signatures must exactly cover every reviewer identity and trust key.');
    }
    decodeCanonicalSignature(
      signature.valueBase64,
      `review overlay.signatures[${index}].valueBase64`,
    );
    signatures.set(signature.reviewerId.toLowerCase(), signature);
  }
  if (signatures.size !== reviewers.size) {
    fail('review overlay signatures must cover every reviewer exactly once.');
  }
  return signatures;
}

export function validateRowReviewTrustAuthority({ reviewers, overlay, trustRegistry, approval }) {
  const reviewerMap = reviewers instanceof Map ? reviewers : validateReviewers(reviewers);
  if (
    !isObject(overlay) ||
    overlay.signatureEnvelopeVersion !== CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE ||
    overlay.signingDomain !== CATALOG_ROW_REVIEW_SIGNING_DOMAIN ||
    canonicalJson(overlay.reviewers) !== canonicalJson([...reviewerMap.values()])
  ) {
    fail('row-review authority requires the exact signed overlay domain.');
  }
  const signatures = validateRowReviewSignatures(overlay, reviewerMap);
  if (trustRegistry?.status !== 'active' || !Array.isArray(trustRegistry.reviewers)) {
    fail('row-review authority requires the current active trust registry.');
  }
  const sourceApprovalReviewers = approval?.reviewers;
  if (
    sourceApprovalReviewers === null ||
    typeof sourceApprovalReviewers !== 'object' ||
    Array.isArray(sourceApprovalReviewers) ||
    canonicalJson(Object.keys(sourceApprovalReviewers).sort()) !==
      canonicalJson(['engineering', 'legal'])
  ) {
    fail('row-review authority requires exact legal and engineering source approver snapshots.');
  }

  const trustedByKeyId = new Map(
    trustRegistry.reviewers.map((reviewer) => [String(reviewer?.keyId), reviewer]),
  );
  const sourceApprovers = Object.values(sourceApprovalReviewers);
  const reviewerIds = new Set();
  const keyIds = new Set();
  const publicKeys = new Set();
  const independenceGroups = new Set();
  const resolved = [];
  for (const reviewer of reviewerMap.values()) {
    const trusted = trustedByKeyId.get(reviewer.trustRegistryKeyId);
    if (
      !trusted ||
      trusted.status !== 'active' ||
      trusted.reviewerId !== reviewer.reviewerId ||
      trusted.role !== reviewer.trustRegistryRole ||
      trusted.independenceGroup !== reviewer.independenceGroup ||
      trusted.publicKeySha256 !== reviewer.publicKeySha256 ||
      trusted.evidence?.uri !== reviewer.evidenceUri ||
      trusted.evidence?.sha256 !== reviewer.evidenceSha256
    ) {
      fail(
        `row reviewer ${reviewer.reviewerId} does not exactly match an active current trust-registry identity, key, role, group, and qualification evidence.`,
      );
    }

    let publicKeyBytes;
    let publicKey;
    try {
      publicKeyBytes = Buffer.from(trusted.publicKeySpkiBase64, 'base64');
      if (
        publicKeyBytes.length === 0 ||
        publicKeyBytes.toString('base64') !== trusted.publicKeySpkiBase64 ||
        sha256(publicKeyBytes) !== reviewer.publicKeySha256
      ) {
        throw new Error('public-key encoding or fingerprint mismatch');
      }
      publicKey = createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
      if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('not Ed25519');
    } catch {
      fail(`row reviewer ${reviewer.reviewerId} has an invalid trusted Ed25519 public key.`);
    }
    const signature = signatures.get(reviewer.reviewerId.toLowerCase());
    const signatureBytes = decodeCanonicalSignature(
      signature.valueBase64,
      `row reviewer ${reviewer.reviewerId} signature`,
    );
    if (
      !verifyCryptographicSignature(
        null,
        catalogRowReviewSigningPayload(overlay, reviewer.reviewerId),
        publicKey,
        signatureBytes,
      )
    ) {
      fail(
        `row reviewer ${reviewer.reviewerId} signature does not authorize the exact overlay and record assignments.`,
      );
    }

    const reviewerIdKey = reviewer.reviewerId.toLowerCase();
    const keyIdKey = reviewer.trustRegistryKeyId.toLowerCase();
    const groupKey = reviewer.independenceGroup.toLowerCase();
    if (
      reviewerIds.has(reviewerIdKey) ||
      keyIds.has(keyIdKey) ||
      publicKeys.has(reviewer.publicKeySha256) ||
      independenceGroups.has(groupKey)
    ) {
      fail(
        'row-review authority requires distinct identities, trust keys, public keys, and groups.',
      );
    }
    if (
      sourceApprovers.some(
        (sourceApprover) =>
          sourceApprover?.reviewerId?.toLowerCase() === reviewerIdKey ||
          sourceApprover?.keyId?.toLowerCase() === keyIdKey ||
          sourceApprover?.publicKeySha256 === reviewer.publicKeySha256,
      )
    ) {
      fail('row reviewers must not reuse source-approval identities, trust keys, or public keys.');
    }
    reviewerIds.add(reviewerIdKey);
    keyIds.add(keyIdKey);
    publicKeys.add(reviewer.publicKeySha256);
    independenceGroups.add(groupKey);
    resolved.push({
      reviewerId: reviewer.reviewerId,
      functionalRole: reviewer.role,
      trustRegistryKeyId: reviewer.trustRegistryKeyId,
      trustRegistryRole: reviewer.trustRegistryRole,
      independenceGroup: reviewer.independenceGroup,
      publicKeySha256: reviewer.publicKeySha256,
      qualificationEvidenceSha256: reviewer.evidenceSha256,
      overlaySignatureSha256: sha256(signatureBytes),
    });
  }
  resolved.sort((left, right) => left.reviewerId.localeCompare(right.reviewerId, 'en-US'));
  return {
    trustRegistryId: trustRegistry.registryId,
    trustRegistryEpoch: trustRegistry.epoch,
    reviewers: resolved,
    sourceApprovalIdentityReuse: false,
  };
}

function collisionMembers(recordMetadata) {
  const buckets = new Map();
  function add(dimension, value, index) {
    if (value === null || value === undefined) return;
    const key = `${dimension}\u0000${value}`;
    const members = buckets.get(key) ?? new Set();
    members.add(index);
    buckets.set(key, members);
  }
  for (const [index, metadata] of recordMetadata.entries()) {
    add('naturalKey', metadata.naturalKey, index);
    add('sourceRef', metadata.sourceRefKey, index);
    add('cas', metadata.identifiers.cas, index);
    add('ec', metadata.identifiers.ec, index);
    add('inciOrSynonym', metadata.naturalKey, index);
    for (const synonym of metadata.identifiers.synonyms ?? []) {
      add('synonym', synonym, index);
      add('inciOrSynonym', synonym, index);
    }
  }
  const conflicts = new Set();
  for (const members of buckets.values()) {
    if (members.size > 1) members.forEach((index) => conflicts.add(index));
  }
  return conflicts;
}

function validateReviews(overlay, reviewEvidence, transformState, qaEvidence, batchEvidence) {
  assertExactKeys(
    overlay,
    [
      'schemaVersion',
      'contractId',
      'signatureEnvelopeVersion',
      'signingDomain',
      'overlayId',
      'source',
      'sourceComponentId',
      'transformArtifactSha256',
      'transformedPayloadSha256',
      'sourceApprovalManifestSha256',
      'trustRegistrySha256',
      'qaReportUri',
      'qaReportSha256',
      'databaseCandidatesDigestContractId',
      'databaseCandidatesSha256',
      'databaseBatchEvidenceSha256',
      'reviewers',
      'records',
      'signatures',
    ],
    'review overlay',
  );
  assertNoSecretKeys(overlay, 'review overlay');
  if (
    overlay.schemaVersion !== 1 ||
    overlay.contractId !== CATALOG_REVIEW_OVERLAY_ID ||
    overlay.signatureEnvelopeVersion !== CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE ||
    overlay.signingDomain !== CATALOG_ROW_REVIEW_SIGNING_DOMAIN ||
    overlay.source !== transformState.transformEvidence.value.source ||
    overlay.sourceComponentId !== transformState.contract.componentId ||
    overlay.transformArtifactSha256 !== transformState.transformEvidence.sha256 ||
    overlay.transformedPayloadSha256 !==
      transformState.transformEvidence.value.transformedPayloadSha256 ||
    overlay.sourceApprovalManifestSha256 !==
      transformState.transformEvidence.value.sourceApproval.manifestSha256 ||
    overlay.trustRegistrySha256 !==
      transformState.transformEvidence.value.sourceApproval.trustRegistrySnapshot.sha256 ||
    overlay.qaReportUri !== batchEvidence.qaReportUri ||
    overlay.qaReportSha256 !== qaEvidence.sha256 ||
    overlay.databaseCandidatesDigestContractId !== CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID ||
    overlay.databaseBatchEvidenceSha256 !== catalogBatchEvidenceSha256(batchEvidence)
  ) {
    fail(
      'review overlay does not exactly bind its signature domain, source approval, trust registry, QA report, batch provenance, and approved transform source/file/payload.',
    );
  }
  assertText(overlay.overlayId, 'review overlay.overlayId', { max: 200 });
  const expectedDatabaseCandidatesSha256 = catalogDatabaseCandidatesSha256(
    transformState.records.map((record, index) =>
      databaseCandidate(
        transformState.transformEvidence.value.source,
        record,
        transformState.recordMetadata[index].naturalKey,
        transformState.transformEvidence.value,
      ),
    ),
  );
  if (overlay.databaseCandidatesSha256 !== expectedDatabaseCandidatesSha256) {
    fail('review overlay databaseCandidatesSha256 does not bind the exact direct-stage records.');
  }
  const reviewers = validateReviewers(overlay.reviewers);
  validateRowReviewSignatures(overlay, reviewers);
  const requiredReviewerIds = [...reviewers.values()].map((reviewer) => reviewer.reviewerId).sort();
  assertArray(overlay.records, 'review overlay.records', {
    min: transformState.records.length,
    max: transformState.records.length,
  });
  const reviewByOrdinal = new Map();
  for (const [index, review] of overlay.records.entries()) {
    assertExactKeys(
      review,
      [
        'ordinal',
        'sourceRef',
        'naturalKey',
        'disposition',
        'reasonCode',
        'duplicateOfNaturalKey',
        'reviewerIds',
      ],
      `review overlay.records[${index}]`,
    );
    if (
      !Number.isInteger(review.ordinal) ||
      review.ordinal < 1 ||
      review.ordinal > transformState.records.length ||
      reviewByOrdinal.has(review.ordinal)
    ) {
      fail('review overlay must contain every transform ordinal exactly once.');
    }
    const metadata = transformState.recordMetadata[review.ordinal - 1];
    if (
      review.sourceRef !== transformState.records[review.ordinal - 1].sourceRef ||
      review.naturalKey !== metadata.naturalKey
    ) {
      fail(`review overlay ordinal ${review.ordinal} has sourceRef/naturalKey drift.`);
    }
    if (!['accepted', 'rejected', 'duplicate'].includes(review.disposition)) {
      fail(`review overlay ordinal ${review.ordinal} has a pending or unknown disposition.`);
    }
    const allowedReasons = {
      accepted: ['accepted_after_review'],
      rejected: [
        'invalid_annex_status',
        'content_quality_rejected',
        'provenance_rejected',
        'policy_rejected',
        'conflict_rejected',
      ],
      duplicate: [
        'duplicate_natural_key',
        'duplicate_source_ref',
        'duplicate_identifier',
        'duplicate_synonym',
      ],
    };
    if (!allowedReasons[review.disposition].includes(review.reasonCode)) {
      fail(`review overlay ordinal ${review.ordinal} has a disposition/reason mismatch.`);
    }
    if (review.disposition === 'duplicate') {
      assertText(
        review.duplicateOfNaturalKey,
        `review overlay ordinal ${review.ordinal}.duplicateOfNaturalKey`,
        { max: 500 },
      );
    } else if (review.duplicateOfNaturalKey !== null) {
      fail(
        `review overlay ordinal ${review.ordinal} may bind duplicateOfNaturalKey only for duplicate disposition.`,
      );
    }
    assertArray(review.reviewerIds, `review overlay ordinal ${review.ordinal}.reviewerIds`, {
      min: 2,
      max: 2,
    });
    const selected = review.reviewerIds.map((id) => reviewers.get(String(id).toLowerCase()));
    if (
      selected.some((entry) => !entry) ||
      canonicalJson([...review.reviewerIds].sort()) !== canonicalJson(requiredReviewerIds) ||
      new Set(review.reviewerIds.map((id) => String(id).toLowerCase())).size !== 2 ||
      new Set(selected.map((entry) => entry.role)).size !== 2 ||
      new Set(selected.map((entry) => entry.trustRegistryRole)).size !== 2 ||
      new Set(selected.map((entry) => entry.independenceGroup.toLowerCase())).size !== 2
    ) {
      fail(
        `review overlay ordinal ${review.ordinal} requires two distinct independent reviewer roles.`,
      );
    }
    reviewByOrdinal.set(review.ordinal, review);
  }
  const conflicts = collisionMembers(transformState.recordMetadata);
  const knownNaturalKeys = new Set(
    transformState.recordMetadata.map((metadata) => metadata.naturalKey),
  );
  for (const ordinal of Array.from(
    { length: transformState.records.length },
    (_, index) => index + 1,
  )) {
    const review = reviewByOrdinal.get(ordinal);
    if (!review) fail(`review overlay is missing transform ordinal ${ordinal}.`);
    if (conflicts.has(ordinal - 1) && review.disposition === 'accepted') {
      fail(
        `review overlay ordinal ${ordinal} accepts a colliding natural/source/CAS/EC/synonym identity.`,
      );
    }
    if (review.disposition === 'duplicate' && !knownNaturalKeys.has(review.duplicateOfNaturalKey)) {
      fail(`review overlay ordinal ${ordinal} references an unknown duplicate natural key.`);
    }
    const record = transformState.records[ordinal - 1];
    if (
      transformState.transformEvidence.value.source === 'cosing' &&
      !ALLOWED_ANNEX_STATUSES.has(record.annexStatus) &&
      !(review.disposition === 'rejected' && review.reasonCode === 'invalid_annex_status')
    ) {
      fail(
        `review overlay ordinal ${ordinal} must reject a CosIng annex status outside the database enum.`,
      );
    }
  }
  return { reviewByOrdinal, reviewers, reviewEvidence };
}

function evidenceDescriptor(root, evidence) {
  return {
    path: workspaceRelative(root, evidence.path),
    bytes: evidence.bytes.length,
    sha256: evidence.sha256,
  };
}

function databaseCandidate(source, record, naturalKey, transform) {
  if (source === 'open_beauty_facts') {
    return {
      recordKind: 'product',
      canonicalKey: naturalKey,
      barcode: record.barcode,
      name: record.name,
      brand: record.brand,
      category: record.category,
      ingredientsText: record.ingredientsText,
      source: record.source,
      sourceComponentId: record.sourceComponentId,
      sourceRef: record.sourceRef,
      sourceUrl: record.sourceUrl,
      sourceRecordModifiedDate: record.sourceRecordModifiedDate,
      sourceArtifactSha256: record.sourceArtifactSha256,
      qualityGrade: record.qualityGrade,
      reviewStatus: record.reviewStatus,
      sourceSnapshotDate: record.sourceSnapshotDate,
      region: 'US',
    };
  }
  return {
    recordKind: 'ingredient',
    canonicalKey: naturalKey,
    inciName: record.inciName,
    displayName: record.displayName,
    casNumber: record.casNumber,
    ecNumber: record.ecNumber,
    annexStatus: record.annexStatus,
    sourceRef: record.sourceRef,
    sourceRecordStatus: record.sourceRecordStatus,
    glossaryDecision: record.glossaryDecision,
    source: record.source,
    sourceComponentId: record.sourceComponentId,
    sourceUrl: transform.sourceSnapshot.url,
    sourceArtifactSha256: record.sourceArtifactSha256,
    reviewStatus: record.reviewStatus,
    synonyms: [...record.synonyms],
    sourceSnapshotDate: record.sourceSnapshotDate,
  };
}

function assertRestrictedCandidateJson(value, label, depth = 0) {
  if (depth > 10) fail(`${label} exceeds the restricted canonical JSON depth.`);
  if (value === null || typeof value === 'string') return;
  if (Array.isArray(value)) {
    if (value.length > MAXIMUM_RECORDS) fail(`${label} exceeds the restricted array bound.`);
    value.forEach((entry, index) =>
      assertRestrictedCandidateJson(entry, `${label}[${index}]`, depth + 1),
    );
    return;
  }
  if (!isObject(value)) {
    fail(`${label} permits only objects, arrays, strings, and explicit nulls.`);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/u.test(key)) {
      fail(`${label} contains a key outside the restricted ASCII candidate domain.`);
    }
    assertRestrictedCandidateJson(entry, `${label}.${key}`, depth + 1);
  }
}

function databaseBtrim(value) {
  return value === null ? null : value.replace(/^ +| +$/gu, '');
}

function databaseNullIfEmpty(value) {
  return value === '' ? null : value;
}

function compareCanonicalUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function catalogDatabaseNormalizedPayload(candidate) {
  if (!isObject(candidate) || !Object.hasOwn(DATABASE_CANDIDATE_KEYS, candidate.recordKind)) {
    fail('database normalized payload requires a supported direct-stage candidate.');
  }
  assertExactKeys(
    candidate,
    DATABASE_CANDIDATE_KEYS[candidate.recordKind],
    'database normalized payload candidate',
  );
  assertRestrictedCandidateJson(candidate, 'database normalized payload candidate');

  if (candidate.recordKind === 'product') {
    if (!ALLOWED_PRODUCT_CATEGORIES.has(candidate.category)) {
      fail('database normalized product category is outside the frozen ASCII vocabulary.');
    }
    return {
      recordKind: 'product',
      canonicalKey: candidate.barcode,
      barcode: candidate.barcode,
      name: databaseBtrim(candidate.name),
      brand: databaseNullIfEmpty(databaseBtrim(candidate.brand)),
      category: candidate.category,
      ingredientsText: databaseNullIfEmpty(databaseBtrim(candidate.ingredientsText)),
      source: candidate.source,
      sourceRef: databaseBtrim(candidate.sourceRef),
      sourceUrl: databaseBtrim(candidate.sourceUrl),
      sourceRecordModifiedDate: candidate.sourceRecordModifiedDate,
      sourceArtifactSha256: candidate.sourceArtifactSha256,
      sourceSnapshotDate: candidate.sourceSnapshotDate,
      region: 'US',
      qualityGrade: candidate.qualityGrade,
      reviewStatus: candidate.reviewStatus,
    };
  }

  return {
    recordKind: 'ingredient',
    canonicalKey: normalizeCosingNaturalKey(candidate.inciName),
    inciName: databaseBtrim(candidate.inciName),
    normalizedInciName: normalizeCosingNaturalKey(candidate.inciName),
    displayName: databaseNullIfEmpty(databaseBtrim(candidate.displayName)),
    casNumber: databaseNullIfEmpty(databaseBtrim(candidate.casNumber)),
    ecNumber: databaseNullIfEmpty(databaseBtrim(candidate.ecNumber)),
    annexStatus: databaseNullIfEmpty(databaseBtrim(candidate.annexStatus)),
    source: candidate.source,
    sourceRef: databaseBtrim(candidate.sourceRef),
    sourceUrl: databaseBtrim(candidate.sourceUrl),
    sourceRecordStatus: candidate.sourceRecordStatus,
    glossaryDecision: candidate.glossaryDecision,
    sourceArtifactSha256: candidate.sourceArtifactSha256,
    sourceSnapshotDate: candidate.sourceSnapshotDate,
    reviewStatus: candidate.reviewStatus,
    synonyms: candidate.synonyms.map(normalizeCosingNaturalKey).sort(compareCanonicalUtf8),
  };
}

export function catalogDatabaseRecordSha256(normalizedPayload) {
  if (
    !isObject(normalizedPayload) ||
    !Object.hasOwn(DATABASE_NORMALIZED_PAYLOAD_KEYS, normalizedPayload.recordKind)
  ) {
    fail('database record hash requires a supported normalized payload.');
  }
  assertExactKeys(
    normalizedPayload,
    DATABASE_NORMALIZED_PAYLOAD_KEYS[normalizedPayload.recordKind],
    'database record hash normalized payload',
  );
  assertRestrictedCandidateJson(normalizedPayload, 'database record hash normalized payload');
  return sha256(Buffer.from(canonicalJson(normalizedPayload), 'utf8'));
}

export function catalogDatabaseCandidatesSha256(candidates) {
  assertArray(candidates, 'database candidates', { min: 1, max: MAXIMUM_RECORDS });
  assertRestrictedCandidateJson(candidates, 'database candidates');
  const recordLeafHashes = candidates.map((candidate) =>
    sha256(Buffer.from(canonicalJson(candidate), 'utf8')),
  );
  return sha256(Buffer.from(recordLeafHashes.join(''), 'utf8'));
}

export function catalogProjectedExpandedReceiptBytes(candidates) {
  assertArray(candidates, 'projected database candidates', {
    min: 1,
    max: MAXIMUM_RECORDS,
  });
  let projectedBytes = 4096;
  for (const [index, candidate] of candidates.entries()) {
    assertRestrictedCandidateJson(candidate, `projected database candidates[${index}]`);
    const candidateBytes = Buffer.byteLength(canonicalJson(candidate), 'utf8');
    projectedBytes += candidateBytes * 8 + 2048;
    if (projectedBytes > MAXIMUM_BYTES.receipts) {
      fail(
        'projected expanded database receipts exceed the 256 MiB completion-input bound; split the batch before staging.',
      );
    }
  }
  return projectedBytes;
}

function compactCatalogImportManifest(transform, transformArtifactSha256, qaReportSha256) {
  return {
    schemaVersion: 1,
    status: 'approved_transform',
    importMode: transform.importMode,
    sourceKey: transform.source,
    sourceComponentId: transform.sourceComponentId,
    parserVersion: transform.parserVersion,
    artifactKind: 'production',
    territory: 'US',
    snapshotDate: transform.sourceSnapshot.date,
    artifactSha256: transform.inputSha256,
    manifestSha256: transformArtifactSha256,
    sourcePolicySha256: transform.sourcePolicy.sha256,
    sourceApprovalSha256: transform.sourceApproval.manifestSha256,
    transformSha256: transform.sourceApproval.transformerSnapshot.sha256,
    transformedPayloadSha256: transform.transformedPayloadSha256,
    qaReportSha256,
    qaStatus: 'pass',
  };
}

export function buildCatalogBatchEvidenceDescriptor({
  transform,
  transformArtifactSha256,
  qaReportUri,
  qaReportSha256,
  expectedRecordCount,
}) {
  assertDigest(transformArtifactSha256, 'batch evidence transformArtifactSha256');
  assertText(qaReportUri, 'batch evidence qaReportUri', { max: 500 });
  assertDigest(qaReportSha256, 'batch evidence qaReportSha256');
  assertReceiptInteger(expectedRecordCount, 'batch evidence expectedRecordCount', { min: 1 });
  const manifest = compactCatalogImportManifest(transform, transformArtifactSha256, qaReportSha256);
  return {
    sourceKey: transform.source,
    batchType: transform.source === 'open_beauty_facts' ? 'obf_export' : 'cosing_dictionary',
    snapshotDate: transform.sourceSnapshot.date,
    artifactKind: 'production',
    territory: 'US',
    artifactUri: transform.sourceSnapshot.url,
    artifactSha256: transform.inputSha256,
    manifest,
    manifestSha256: transformArtifactSha256,
    sourcePolicySha256: transform.sourcePolicy.sha256,
    sourceApprovalSha256: transform.sourceApproval.manifestSha256,
    transformSha256: transform.sourceApproval.transformerSnapshot.sha256,
    transformedPayloadSha256: transform.transformedPayloadSha256,
    qaReportUri,
    qaReportSha256,
    qaBlockerCount: 0,
    qaWarningCount: 0,
    expectedRecordCount,
    parserVersion: transform.parserVersion,
    normalizationVersion: 'catalog-import-lifecycle-0057-normalization-v1',
  };
}

export function catalogBatchEvidenceSha256(batchEvidence) {
  assertExactKeys(
    batchEvidence,
    [
      'sourceKey',
      'batchType',
      'snapshotDate',
      'artifactKind',
      'territory',
      'artifactUri',
      'artifactSha256',
      'manifest',
      'manifestSha256',
      'sourcePolicySha256',
      'sourceApprovalSha256',
      'transformSha256',
      'transformedPayloadSha256',
      'qaReportUri',
      'qaReportSha256',
      'qaBlockerCount',
      'qaWarningCount',
      'expectedRecordCount',
      'parserVersion',
      'normalizationVersion',
    ],
    'catalog batch evidence',
  );
  return sha256(Buffer.from(canonicalJson(batchEvidence), 'utf8'));
}

function buildDatabasePlan({
  root,
  transformState,
  transformEvidence,
  qaEvidence,
  reviewEvidence,
  reviewState,
  batchEvidence,
  operationSeed,
}) {
  const transform = transformEvidence.value;
  const source = transform.source;
  const operationNamespace = `cat02:${source}:${operationSeed}`;
  const compactManifest = compactCatalogImportManifest(
    transform,
    transformEvidence.sha256,
    qaEvidence.sha256,
  );
  const batchEvidenceSha256 = catalogBatchEvidenceSha256(batchEvidence);
  const candidates = transformState.records.map((record, index) =>
    databaseCandidate(source, record, transformState.recordMetadata[index].naturalKey, transform),
  );
  const databaseCandidatesSha256 = catalogDatabaseCandidatesSha256(candidates);
  const projectedExpandedReceiptBytes = catalogProjectedExpandedReceiptBytes(candidates);
  const chunks = [];
  let chunkRecords = [];
  let chunkFirstOrdinal = 1;
  const appendChunk = () => {
    const chunkOrdinal = chunks.length + 1;
    chunks.push({
      rpc: 'stage_catalog_import_chunk',
      operationKey: `${operationNamespace}:chunk:${chunkOrdinal}`,
      batchIdFrom: 'begin_catalog_import.batch_id',
      chunkOrdinal,
      firstRecordOrdinal: chunkFirstOrdinal,
      records: chunkRecords,
      canonicalJsonBytes: Buffer.byteLength(canonicalJson(chunkRecords), 'utf8'),
      databaseReceiptRequired: {
        fields: [
          'batch_id',
          'chunk_ordinal',
          'staged_record_count',
          'chunk_sha256',
          'record_receipts',
          'replayed',
        ],
        recordReceiptFields: [...DATABASE_RECORD_RECEIPT_KEYS],
        hashAuthority: CATALOG_DATABASE_NORMALIZED_RECORD_HASH_CONTRACT_ID,
      },
    });
    chunkFirstOrdinal += chunkRecords.length;
    chunkRecords = [];
  };
  for (const candidate of candidates) {
    const proposed = [...chunkRecords, candidate];
    const proposedBytes = Buffer.byteLength(canonicalJson(proposed), 'utf8');
    if (
      chunkRecords.length > 0 &&
      (chunkRecords.length >= 500 || proposedBytes > MAXIMUM_DATABASE_CHUNK_JSON_BYTES)
    ) {
      appendChunk();
    }
    chunkRecords.push(candidate);
    if (
      Buffer.byteLength(canonicalJson(chunkRecords), 'utf8') > MAXIMUM_DATABASE_CHUNK_JSON_BYTES
    ) {
      fail('a direct-stage database candidate exceeds the 8 MiB chunk JSON bound.');
    }
  }
  if (chunkRecords.length > 0) appendChunk();
  const reviewIntents = transformState.records.map((record, index) => {
    const ordinal = index + 1;
    const review = reviewState.reviewByOrdinal.get(ordinal);
    return {
      recordOrdinal: ordinal,
      canonicalKey: transformState.recordMetadata[index].naturalKey,
      sourceRef: record.sourceRef,
      requestedDisposition: review.disposition,
      reason: review.reasonCode,
      reviewerIds: [...review.reviewerIds],
      recordSha256From: `finalize_catalog_import.record_receipts[recordOrdinal=${ordinal}].recordSha256`,
      receiptDispositionRule:
        review.disposition === 'duplicate'
          ? 'omit_if_database_duplicate; otherwise_materialize_rejected_if_pending; fail_on_conflict'
          : 'must_be_pending_then_materialize_requested_decision',
    };
  });
  const reviewerIds = [...reviewState.reviewers.values()]
    .map((reviewer) => reviewer.reviewerId)
    .sort();
  const reviewedBy = reviewerIds.join('+');
  if (reviewedBy.length > 200) {
    fail('combined database reviewer identity exceeds the bounded lifecycle operator field.');
  }
  return {
    schemaVersion: 1,
    contractId: 'catalog-import-lifecycle-0057-preflight-v1',
    status: 'preflight_only_requires_database_receipts',
    promotionExecutable: false,
    target: 'caller_selected_approved_supabase_project',
    targetCredentialsIncluded: false,
    operationNamespace,
    candidateBinding: {
      contractId: CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID,
      canonicalization: 'restricted-canonical-json-record-leaf-sha256-concat-v1',
      recordLeafHash: 'SHA-256(UTF-8 canonicalJson(candidate))',
      aggregateHash: 'SHA-256(UTF-8 concatenated lowercase 64-hex record leaf hashes)',
      sourceArray: 'stage.chunks[*].records in chunk/record order',
      exactRecordCount: candidates.length,
      databaseCandidatesSha256,
      boundBySignedReviewOverlay: true,
      databaseRecomputationRequired: true,
    },
    normalizedRecordBinding: { ...DATABASE_NORMALIZED_RECORD_BINDING },
    batchEvidenceBinding: {
      contractId: 'catalog-import-batch-evidence-v1',
      canonicalization: 'canonical-json-sorted-object-keys',
      descriptor: batchEvidence,
      databaseBatchEvidenceSha256: batchEvidenceSha256,
      boundBySignedReviewOverlay: true,
      databaseRecomputationRequiredAtOwnerReview: true,
      excludesOnlyDynamicOperationKeyAndBatchId: true,
    },
    begin: {
      rpc: 'begin_catalog_import',
      args: {
        p_operation_key: `${operationNamespace}:begin`,
        p_source_key: source,
        p_batch_type: source === 'open_beauty_facts' ? 'obf_export' : 'cosing_dictionary',
        p_snapshot_date: transform.sourceSnapshot.date,
        p_artifact_kind: 'production',
        p_territory: 'US',
        p_artifact_uri: transform.sourceSnapshot.url,
        p_artifact_sha256: transform.inputSha256,
        p_manifest: compactManifest,
        p_manifest_sha256: transformEvidence.sha256,
        p_source_policy_sha256: transform.sourcePolicy.sha256,
        p_source_approval_sha256: transform.sourceApproval.manifestSha256,
        p_transform_sha256: transform.sourceApproval.transformerSnapshot.sha256,
        p_transformed_payload_sha256: transform.transformedPayloadSha256,
        p_qa_report_uri: workspaceRelative(root, qaEvidence.path),
        p_qa_report_sha256: qaEvidence.sha256,
        p_qa_blocker_count: 0,
        p_qa_warning_count: 0,
        p_expected_record_count: candidates.length,
        p_parser_version: transform.parserVersion,
      },
    },
    stage: {
      maximumChunkRecords: 500,
      maximumChunkJsonBytes: MAXIMUM_DATABASE_CHUNK_JSON_BYTES,
      maximumCompletionReceiptArtifactBytes: MAXIMUM_BYTES.receipts,
      projectedExpandedReceiptBytes,
      inputRecordCount: candidates.length,
      chunks,
    },
    finalize: {
      rpc: 'finalize_catalog_import',
      batchIdFrom: 'begin_catalog_import.batch_id',
      operationKey: `${operationNamespace}:finalize`,
      expectedRecordCount: candidates.length,
      recordsSha256Authority: 'finalize_catalog_import.records_sha256',
      databaseCandidatesSha256Authority: 'finalize_catalog_import.candidates_sha256',
      recordReceiptsAuthority: 'finalize_catalog_import.record_receipts',
      recordReceiptFields: [...DATABASE_EVIDENCE_RECORD_RECEIPT_KEYS],
      mustReturnStatus: 'finalized',
      failOnAnyConflict: true,
    },
    verify: {
      rpc: 'verify_catalog_import',
      batchIdFrom: 'begin_catalog_import.batch_id',
      operationKey: `${operationNamespace}:verify`,
      recordsSha256From: 'finalize_catalog_import.records_sha256',
      verificationEvidenceSha256RequiredAtExecution: true,
      verificationEvidenceSha256AvailableAtPreflight: false,
      verificationEvidenceSha256From:
        'materializeCatalogDatabaseReceiptCompletion.verificationEvidenceSha256',
      verificationEvidenceBundleContract: {
        schemaVersion: 1,
        contractId: CATALOG_DATABASE_RECEIPT_EVIDENCE_CONTRACT_ID,
        hashAlgorithm: 'SHA-256',
        byteEncoding: 'UTF-8',
        executableBuilder: 'materializeCatalogDatabaseReceiptCompletion',
        executableCanonicalizer: 'canonicalJson',
        canonicalization:
          'recursive lexicographic object-key order; preserved array order; JSON primitives only',
        exactKeys: [
          'schemaVersion',
          'contractId',
          'batchId',
          'operationNamespace',
          'source',
          'databaseCandidatesSha256',
          'databaseBatchEvidenceSha256',
          'chunkReceipts',
          'finalizeReceipt',
        ],
        chunkReceiptExactKeys: [
          'chunkOrdinal',
          'stagedRecordCount',
          'chunkSha256',
          'recordReceipts',
        ],
        finalizeReceiptExactKeys: [
          'batchStatus',
          'canonicalRecordCount',
          'duplicateRecordCount',
          'conflictRecordCount',
          'recordsSha256',
          'candidatesSha256',
          'recordReceipts',
        ],
        recordReceiptExactKeys: [...DATABASE_EVIDENCE_RECORD_RECEIPT_KEYS],
        ordering: {
          chunkReceipts: 'ascending chunkOrdinal without gaps',
          recordReceipts: 'ascending recordOrdinal without gaps',
        },
        replayInvariantProjection:
          'RPC replayed flags are validated but excluded because they are transport state, not sealed receipt identity.',
      },
      mustReturnStatus: 'verified',
    },
    review: {
      rpc: 'review_catalog_import',
      rpcArgumentOrder: [
        'p_batch_id',
        'p_operation_key',
        'p_decisions',
        'p_expected_candidates_sha256',
        'p_expected_batch_evidence_sha256',
        'p_expected_verification_evidence_sha256',
        'p_reviewer_ids',
        'p_review_ticket',
        'p_review_evidence_sha256',
      ],
      batchIdFrom: 'begin_catalog_import.batch_id',
      operationKey: `${operationNamespace}:review`,
      reviewTicket: reviewEvidence.value.overlayId,
      reviewerIds,
      reviewedByDerivedValue: reviewedBy,
      reviewedByIsNotRpcInput: true,
      reviewEvidenceSha256: reviewEvidence.sha256,
      databaseCandidatesSha256,
      databaseCandidatesMustMatchFinalizeAuthority: true,
      qaReportSha256: qaEvidence.sha256,
      databaseBatchEvidenceSha256: batchEvidenceSha256,
      databaseBatchEvidenceMustMatchStoredBatch: true,
      verificationEvidenceSha256AvailableAtPreflight: false,
      verificationEvidenceSha256From:
        'materializeCatalogDatabaseReceiptCompletion.verificationEvidenceSha256',
      verificationEvidenceMustMatchStoredBatch: true,
      reviewAuthorityBinding: {
        overlayContractId: CATALOG_REVIEW_OVERLAY_ID,
        overlayArtifactSha256: reviewEvidence.sha256,
        reviewerSetSha256: sha256(
          Buffer.from(canonicalJson(reviewEvidence.value.reviewers), 'utf8'),
        ),
        perRowReviewerAssignmentsSha256: sha256(
          Buffer.from(
            canonicalJson(
              reviewEvidence.value.records.map((record) => ({
                recordOrdinal: record.ordinal,
                reviewerIds: record.reviewerIds,
              })),
            ),
            'utf8',
          ),
        ),
      },
      intents: reviewIntents,
      materializedDecisionExactKeys: ['recordOrdinal', 'recordSha256', 'decision', 'reason'],
      decisionsMustBeMaterializedFromDatabaseReceipts: true,
      failOnMissingChangedOrExtraReceipt: true,
    },
    promote: {
      rpc: 'promote_catalog_import',
      batchIdFrom: 'begin_catalog_import.batch_id',
      operationKey: `${operationNamespace}:promote`,
      operatorRequiredAtExecution: true,
      operatorMustDifferFromReviewedBy: true,
      operatorMustNotMatchAnyReviewerId: true,
      forbiddenOperatorReviewerIds: reviewerIds,
      reviewTicket: reviewEvidence.value.overlayId,
      reviewEvidenceSha256: reviewEvidence.sha256,
      permittedOnlyAfterExactReceiptMaterialization: true,
    },
    rollback: {
      rpc: 'rollback_catalog_import',
      batchIdFrom: 'begin_catalog_import.batch_id',
      operationKey: `${operationNamespace}:rollback`,
      operatorRequiredAtExecution: true,
      operatorMustDifferFromReviewedBy: true,
      operatorMustNotMatchAnyReviewerId: true,
      forbiddenOperatorReviewerIds: reviewerIds,
      reviewTicket: reviewEvidence.value.overlayId,
      reviewEvidenceSha256: reviewEvidence.sha256,
      reasonRequiredAtExecution: true,
    },
    receiptCompletionRequirements: [
      'Every chunk response must match its ordinal/count and return a database chunk_sha256 plus one exact record receipt per input ordinal.',
      'Finalize must be conflict-free and its database records_sha256/record_receipts are authoritative.',
      'Verification evidence must be computed only after all database chunk/finalize receipts exist, from the exact canonical receipt-bundle contract; source QA is not verification evidence.',
      'Review decisions must be materialized only after every expanded receipt payload and record hash matches the signed candidate under the shared PostgreSQL/JavaScript normalized-record canonical-JSON contract.',
      'Promotion remains false until begin, all chunks, finalize, verify, and receipt-bound review succeed on one explicitly selected approved target.',
    ],
  };
}

function assertReceiptInteger(value, label, { min = 0, max = MAXIMUM_RECORDS } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer between ${min} and ${max}.`);
  }
}

function validateDatabaseRecordReceipts(
  receipts,
  label,
  { expectedCount, firstOrdinal, allowedDispositions, expectedCandidates, expanded },
) {
  assertArray(receipts, label, { min: expectedCount, max: expectedCount });
  return receipts.map((receipt, index) => {
    assertExactKeys(
      receipt,
      expanded ? DATABASE_RECORD_RECEIPT_KEYS : DATABASE_EVIDENCE_RECORD_RECEIPT_KEYS,
      `${label}[${index}]`,
    );
    const expectedOrdinal = firstOrdinal + index;
    if (receipt.recordOrdinal !== expectedOrdinal) {
      fail(`${label} must be ordered without missing, repeated, or extra record ordinals.`);
    }
    assertDigest(receipt.recordSha256, `${label}[${index}].recordSha256`);
    const expectedCandidate = expectedCandidates[index];
    if (
      !isObject(expectedCandidate) ||
      receipt.recordKind !== expectedCandidate.recordKind ||
      receipt.canonicalKey !== expectedCandidate.canonicalKey
    ) {
      fail(`${label}[${index}] does not bind the exact signed direct-stage candidate bytes.`);
    }
    if (expanded) {
      if (canonicalJson(receipt.sourcePayload) !== canonicalJson(expectedCandidate)) {
        fail(`${label}[${index}] does not bind the exact signed direct-stage candidate bytes.`);
      }
      if (!Object.hasOwn(DATABASE_NORMALIZED_PAYLOAD_KEYS, receipt.recordKind)) {
        fail(`${label}[${index}].recordKind is unsupported.`);
      }
      assertExactKeys(
        receipt.normalizedPayload,
        DATABASE_NORMALIZED_PAYLOAD_KEYS[receipt.recordKind],
        `${label}[${index}].normalizedPayload`,
      );
      assertRestrictedCandidateJson(receipt.sourcePayload, `${label}[${index}].sourcePayload`);
      assertRestrictedCandidateJson(
        receipt.normalizedPayload,
        `${label}[${index}].normalizedPayload`,
      );
      const expectedNormalizedPayload = catalogDatabaseNormalizedPayload(expectedCandidate);
      if (canonicalJson(receipt.normalizedPayload) !== canonicalJson(expectedNormalizedPayload)) {
        fail(
          `${label}[${index}] normalized payload does not exactly match migration 0057 derivation from the signed candidate.`,
        );
      }
      const expectedRecordSha256 = catalogDatabaseRecordSha256(expectedNormalizedPayload);
      if (receipt.recordSha256 !== expectedRecordSha256) {
        fail(
          `${label}[${index}].recordSha256 does not match the shared PostgreSQL/JavaScript normalized-record hash contract.`,
        );
      }
    }
    if (!allowedDispositions.has(receipt.disposition)) {
      fail(`${label}[${index}].disposition is not valid for this lifecycle phase.`);
    }
    const validated = {
      recordOrdinal: receipt.recordOrdinal,
      recordSha256: receipt.recordSha256,
      recordKind: receipt.recordKind,
      canonicalKey: receipt.canonicalKey,
      disposition: receipt.disposition,
    };
    if (expanded) {
      validated.sourcePayload = JSON.parse(canonicalJson(receipt.sourcePayload));
      validated.normalizedPayload = JSON.parse(canonicalJson(receipt.normalizedPayload));
    }
    return validated;
  });
}

function databaseEvidenceRecordReceipt(receipt) {
  return {
    recordOrdinal: receipt.recordOrdinal,
    recordSha256: receipt.recordSha256,
    recordKind: receipt.recordKind,
    canonicalKey: receipt.canonicalKey,
    disposition: receipt.disposition,
  };
}

function validateDatabasePlanNormalizedRecordBinding(databasePlan) {
  const binding = databasePlan.normalizedRecordBinding;
  if (!isObject(binding)) {
    fail('database plan is missing the normalized-record hash contract.');
  }
  assertExactKeys(
    binding,
    Object.keys(DATABASE_NORMALIZED_RECORD_BINDING),
    'database plan.normalizedRecordBinding',
  );
  if (canonicalJson(binding) !== canonicalJson(DATABASE_NORMALIZED_RECORD_BINDING)) {
    fail('database plan normalized-record hash contract does not match migration 0057.');
  }
}

function validateDatabasePlanBatchEvidence(databasePlan) {
  const descriptor = databasePlan.batchEvidenceBinding?.descriptor;
  const expectedSha256 = catalogBatchEvidenceSha256(descriptor);
  const args = databasePlan.begin?.args;
  if (
    databasePlan.batchEvidenceBinding?.databaseBatchEvidenceSha256 !== expectedSha256 ||
    databasePlan.review?.databaseBatchEvidenceSha256 !== expectedSha256 ||
    descriptor.sourceKey !== args?.p_source_key ||
    descriptor.batchType !== args?.p_batch_type ||
    descriptor.snapshotDate !== args?.p_snapshot_date ||
    descriptor.artifactKind !== args?.p_artifact_kind ||
    descriptor.territory !== args?.p_territory ||
    descriptor.artifactUri !== args?.p_artifact_uri ||
    descriptor.artifactSha256 !== args?.p_artifact_sha256 ||
    canonicalJson(descriptor.manifest) !== canonicalJson(args?.p_manifest) ||
    descriptor.manifestSha256 !== args?.p_manifest_sha256 ||
    descriptor.sourcePolicySha256 !== args?.p_source_policy_sha256 ||
    descriptor.sourceApprovalSha256 !== args?.p_source_approval_sha256 ||
    descriptor.transformSha256 !== args?.p_transform_sha256 ||
    descriptor.transformedPayloadSha256 !== args?.p_transformed_payload_sha256 ||
    descriptor.qaReportUri !== args?.p_qa_report_uri ||
    descriptor.qaReportSha256 !== args?.p_qa_report_sha256 ||
    descriptor.qaBlockerCount !== args?.p_qa_blocker_count ||
    descriptor.qaWarningCount !== args?.p_qa_warning_count ||
    descriptor.expectedRecordCount !== args?.p_expected_record_count ||
    descriptor.parserVersion !== args?.p_parser_version ||
    descriptor.normalizationVersion !== 'catalog-import-lifecycle-0057-normalization-v1'
  ) {
    fail('database batch-evidence digest does not match the complete immutable begin evidence.');
  }
  return expectedSha256;
}

export function materializeCatalogDatabaseReceiptCompletion({
  databasePlan,
  batchId,
  chunkReceipts,
  finalizeReceipt,
}) {
  if (
    !isObject(databasePlan) ||
    databasePlan.contractId !== 'catalog-import-lifecycle-0057-preflight-v1' ||
    databasePlan.status !== 'preflight_only_requires_database_receipts' ||
    databasePlan.promotionExecutable !== false
  ) {
    fail('database receipt completion requires an exact non-executable CAT-02 preflight plan.');
  }
  if (typeof batchId !== 'string' || !UUID_PATTERN.test(batchId)) {
    fail('database receipt completion batchId must be a lowercase UUID.');
  }
  const source = databasePlan.begin?.args?.p_source_key;
  if (!Object.hasOwn(SOURCE_CONTRACTS, source)) {
    fail('database receipt completion source is unsupported.');
  }
  validateDatabasePlanNormalizedRecordBinding(databasePlan);
  const databaseBatchEvidenceSha256 = validateDatabasePlanBatchEvidence(databasePlan);
  assertText(databasePlan.operationNamespace, 'database plan.operationNamespace', { max: 200 });
  if (
    databasePlan.verify?.verificationEvidenceBundleContract?.contractId !==
      CATALOG_DATABASE_RECEIPT_EVIDENCE_CONTRACT_ID ||
    databasePlan.verify?.verificationEvidenceBundleContract?.executableBuilder !==
      'materializeCatalogDatabaseReceiptCompletion' ||
    databasePlan.verify?.verificationEvidenceSha256AvailableAtPreflight !== false ||
    Object.hasOwn(databasePlan.verify ?? {}, 'verificationEvidenceSha256') ||
    databasePlan.review?.verificationEvidenceSha256AvailableAtPreflight !== false ||
    Object.hasOwn(databasePlan.review ?? {}, 'verificationEvidenceSha256')
  ) {
    fail('database plan does not require executable post-receipt verification evidence.');
  }

  const totalRecords = databasePlan.stage?.inputRecordCount;
  assertReceiptInteger(totalRecords, 'database plan.stage.inputRecordCount', { min: 1 });
  const plannedChunks = databasePlan.stage?.chunks;
  if (
    databasePlan.stage?.maximumChunkRecords !== 500 ||
    databasePlan.stage?.maximumChunkJsonBytes !== MAXIMUM_DATABASE_CHUNK_JSON_BYTES
  ) {
    fail('database plan chunk bounds do not match the lifecycle RPC contract.');
  }
  assertArray(plannedChunks, 'database plan.stage.chunks', { min: 1, max: totalRecords });
  assertArray(chunkReceipts, 'database chunk receipts', {
    min: plannedChunks.length,
    max: plannedChunks.length,
  });

  let cumulativeRecords = 0;
  const plannedCandidates = [];
  const chunkRecordBindingByOrdinal = new Map();
  const normalizedChunkReceipts = [];
  for (const [index, plannedChunk] of plannedChunks.entries()) {
    const label = `database chunk receipt ${index + 1}`;
    const receipt = chunkReceipts[index];
    const requiredReceiptFields = plannedChunk?.databaseReceiptRequired?.recordReceiptFields;
    if (
      plannedChunk?.databaseReceiptRequired?.hashAuthority !==
        CATALOG_DATABASE_NORMALIZED_RECORD_HASH_CONTRACT_ID ||
      !Array.isArray(requiredReceiptFields) ||
      canonicalJson(requiredReceiptFields) !== canonicalJson(DATABASE_RECORD_RECEIPT_KEYS)
    ) {
      fail('database plan chunk does not require the exact normalized-record receipt contract.');
    }
    assertExactKeys(receipt, DATABASE_CHUNK_RPC_RECEIPT_KEYS, label);
    if (receipt.batch_id !== batchId) fail(`${label} belongs to a different batch.`);
    if (typeof receipt.replayed !== 'boolean') fail(`${label}.replayed must be boolean.`);
    const expectedChunkOrdinal = index + 1;
    if (
      plannedChunk?.chunkOrdinal !== expectedChunkOrdinal ||
      receipt.chunk_ordinal !== expectedChunkOrdinal
    ) {
      fail('database chunk receipts must follow the exact planned ordinal order without gaps.');
    }
    const plannedRecords = plannedChunk.records;
    assertArray(plannedRecords, `database plan.stage.chunks[${index}].records`, {
      min: 1,
      max: 500,
    });
    const plannedChunkBytes = Buffer.byteLength(canonicalJson(plannedRecords), 'utf8');
    if (
      plannedChunk.canonicalJsonBytes !== plannedChunkBytes ||
      plannedChunkBytes > MAXIMUM_DATABASE_CHUNK_JSON_BYTES
    ) {
      fail('database plan chunk exceeds or misstates its canonical JSON byte bound.');
    }
    const firstOrdinal = cumulativeRecords + 1;
    if (plannedChunk.firstRecordOrdinal !== firstOrdinal) {
      fail('database plan chunk record windows are not contiguous.');
    }
    cumulativeRecords += plannedRecords.length;
    plannedCandidates.push(...plannedRecords);
    if (receipt.staged_record_count !== cumulativeRecords) {
      fail(`${label}.staged_record_count breaks cumulative record-count continuity.`);
    }
    assertDigest(receipt.chunk_sha256, `${label}.chunk_sha256`);
    const recordReceipts = validateDatabaseRecordReceipts(receipt.record_receipts, label, {
      expectedCount: plannedRecords.length,
      firstOrdinal,
      allowedDispositions: new Set(['pending']),
      expectedCandidates: plannedRecords,
      expanded: true,
    });
    for (const recordReceipt of recordReceipts) {
      if (chunkRecordBindingByOrdinal.has(recordReceipt.recordOrdinal)) {
        fail('database chunk receipts repeat a record ordinal.');
      }
      chunkRecordBindingByOrdinal.set(recordReceipt.recordOrdinal, recordReceipt);
    }
    normalizedChunkReceipts.push({
      chunkOrdinal: receipt.chunk_ordinal,
      stagedRecordCount: receipt.staged_record_count,
      chunkSha256: receipt.chunk_sha256,
      recordReceipts: recordReceipts.map(databaseEvidenceRecordReceipt),
    });
  }
  if (cumulativeRecords !== totalRecords || chunkRecordBindingByOrdinal.size !== totalRecords) {
    fail('database chunk receipts do not cover the exact preflight record count.');
  }
  const expectedDatabaseCandidatesSha256 = catalogDatabaseCandidatesSha256(plannedCandidates);
  const projectedExpandedReceiptBytes = catalogProjectedExpandedReceiptBytes(plannedCandidates);
  if (
    databasePlan.candidateBinding?.contractId !== CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID ||
    databasePlan.candidateBinding?.databaseCandidatesSha256 !== expectedDatabaseCandidatesSha256 ||
    databasePlan.review?.databaseCandidatesSha256 !== expectedDatabaseCandidatesSha256 ||
    databasePlan.stage?.maximumCompletionReceiptArtifactBytes !== MAXIMUM_BYTES.receipts ||
    databasePlan.stage?.projectedExpandedReceiptBytes !== projectedExpandedReceiptBytes
  ) {
    fail('database plan candidate digest does not match its exact ordered direct-stage records.');
  }

  assertExactKeys(finalizeReceipt, DATABASE_FINALIZE_RPC_RECEIPT_KEYS, 'database finalize receipt');
  if (finalizeReceipt.batch_id !== batchId) {
    fail('database finalize receipt belongs to a different batch.');
  }
  if (typeof finalizeReceipt.replayed !== 'boolean') {
    fail('database finalize receipt.replayed must be boolean.');
  }
  if (
    databasePlan.finalize?.expectedRecordCount !== totalRecords ||
    databasePlan.finalize?.mustReturnStatus !== 'finalized' ||
    databasePlan.finalize?.failOnAnyConflict !== true ||
    finalizeReceipt.batch_status !== 'finalized'
  ) {
    fail('database finalize receipt is not the required conflict-free finalized state.');
  }
  for (const field of [
    'canonical_record_count',
    'duplicate_record_count',
    'conflict_record_count',
  ]) {
    assertReceiptInteger(finalizeReceipt[field], `database finalize receipt.${field}`, {
      max: totalRecords,
    });
  }
  const finalizedRecordReceipts = validateDatabaseRecordReceipts(
    finalizeReceipt.record_receipts,
    'database finalize record receipts',
    {
      expectedCount: totalRecords,
      firstOrdinal: 1,
      allowedDispositions: new Set(['pending', 'duplicate', 'conflict']),
      expectedCandidates: plannedCandidates,
      expanded: false,
    },
  );
  for (const recordReceipt of finalizedRecordReceipts) {
    const chunkBinding = chunkRecordBindingByOrdinal.get(recordReceipt.recordOrdinal);
    if (
      !chunkBinding ||
      canonicalJson(databaseEvidenceRecordReceipt(chunkBinding)) !==
        canonicalJson({ ...recordReceipt, disposition: 'pending' })
    ) {
      fail('database finalize receipt breaks chunk-to-finalize record-hash continuity.');
    }
  }
  const dispositionCounts = {
    pending: finalizedRecordReceipts.filter((receipt) => receipt.disposition === 'pending').length,
    duplicate: finalizedRecordReceipts.filter((receipt) => receipt.disposition === 'duplicate')
      .length,
    conflict: finalizedRecordReceipts.filter((receipt) => receipt.disposition === 'conflict')
      .length,
  };
  if (
    finalizeReceipt.canonical_record_count !== dispositionCounts.pending ||
    finalizeReceipt.duplicate_record_count !== dispositionCounts.duplicate ||
    finalizeReceipt.conflict_record_count !== dispositionCounts.conflict ||
    dispositionCounts.pending + dispositionCounts.duplicate + dispositionCounts.conflict !==
      totalRecords ||
    dispositionCounts.conflict !== 0
  ) {
    fail('database finalize counts do not exactly match the sealed receipt dispositions.');
  }
  assertDigest(finalizeReceipt.records_sha256, 'database finalize receipt.records_sha256');
  assertDigest(finalizeReceipt.candidates_sha256, 'database finalize receipt.candidates_sha256');
  const receiptCandidatesSha256 = catalogDatabaseCandidatesSha256(
    Array.from(
      { length: totalRecords },
      (_, index) => chunkRecordBindingByOrdinal.get(index + 1).sourcePayload,
    ),
  );
  if (
    finalizeReceipt.candidates_sha256 !== expectedDatabaseCandidatesSha256 ||
    receiptCandidatesSha256 !== expectedDatabaseCandidatesSha256
  ) {
    fail(
      'database finalize candidates_sha256 does not match the signed exact direct-stage candidates.',
    );
  }
  const recomputedRecordsSha256 = sha256(
    Buffer.from(finalizedRecordReceipts.map((receipt) => receipt.recordSha256).join(''), 'utf8'),
  );
  if (finalizeReceipt.records_sha256 !== recomputedRecordsSha256) {
    fail('database finalize records_sha256 does not match the ordered record-receipt hashes.');
  }

  const reviewIntents = databasePlan.review?.intents;
  assertArray(reviewIntents, 'database review intents', {
    min: totalRecords,
    max: totalRecords,
  });
  if (
    canonicalJson(databasePlan.review?.materializedDecisionExactKeys) !==
    canonicalJson(DATABASE_REVIEW_DECISION_KEYS)
  ) {
    fail('database review decision schema is not the exact four-key contract.');
  }
  const reviewDecisions = [];
  for (const [index, intent] of reviewIntents.entries()) {
    const ordinal = index + 1;
    assertExactKeys(
      intent,
      [
        'recordOrdinal',
        'canonicalKey',
        'sourceRef',
        'requestedDisposition',
        'reason',
        'reviewerIds',
        'recordSha256From',
        'receiptDispositionRule',
      ],
      `database review intent ${ordinal}`,
    );
    if (intent.recordOrdinal !== ordinal) {
      fail('database review intents must cover every ordinal exactly once in order.');
    }
    if (!['accepted', 'rejected', 'duplicate'].includes(intent.requestedDisposition)) {
      fail(`database review intent ${ordinal} has an unsupported disposition.`);
    }
    assertText(intent.reason, `database review intent ${ordinal}.reason`, { max: 1000 });
    assertArray(intent.reviewerIds, `database review intent ${ordinal}.reviewerIds`, {
      min: 2,
      max: 2,
    });
    const receipt = finalizedRecordReceipts[index];
    if (receipt.disposition === 'conflict') {
      fail(`database record receipt ${ordinal} is conflicted and cannot be reviewed.`);
    }
    if (receipt.disposition === 'duplicate') {
      if (intent.requestedDisposition !== 'duplicate') {
        fail(`database duplicate receipt ${ordinal} contradicts the row-review overlay.`);
      }
      continue;
    }
    const decision =
      intent.requestedDisposition === 'duplicate' ? 'rejected' : intent.requestedDisposition;
    reviewDecisions.push({
      recordOrdinal: ordinal,
      recordSha256: receipt.recordSha256,
      decision,
      reason: intent.reason,
    });
  }
  if (reviewDecisions.length !== dispositionCounts.pending) {
    fail('materialized review decisions do not exactly cover every pending database receipt.');
  }
  for (const [index, decision] of reviewDecisions.entries()) {
    assertExactKeys(
      decision,
      DATABASE_REVIEW_DECISION_KEYS,
      `materialized review decision ${index}`,
    );
  }

  const verificationEvidenceBundle = {
    schemaVersion: 1,
    contractId: CATALOG_DATABASE_RECEIPT_EVIDENCE_CONTRACT_ID,
    batchId,
    operationNamespace: databasePlan.operationNamespace,
    source,
    databaseCandidatesSha256: expectedDatabaseCandidatesSha256,
    databaseBatchEvidenceSha256,
    chunkReceipts: normalizedChunkReceipts,
    finalizeReceipt: {
      batchStatus: finalizeReceipt.batch_status,
      canonicalRecordCount: finalizeReceipt.canonical_record_count,
      duplicateRecordCount: finalizeReceipt.duplicate_record_count,
      conflictRecordCount: finalizeReceipt.conflict_record_count,
      recordsSha256: finalizeReceipt.records_sha256,
      candidatesSha256: finalizeReceipt.candidates_sha256,
      recordReceipts: finalizedRecordReceipts.map(databaseEvidenceRecordReceipt),
    },
  };
  const verificationEvidenceSha256 = sha256(
    Buffer.from(canonicalJson(verificationEvidenceBundle), 'utf8'),
  );
  return {
    schemaVersion: 1,
    contractId: CATALOG_DATABASE_RECEIPT_COMPLETION_CONTRACT_ID,
    batchId,
    recordsSha256: finalizeReceipt.records_sha256,
    databaseCandidatesSha256: finalizeReceipt.candidates_sha256,
    databaseBatchEvidenceSha256,
    verificationEvidenceBundle,
    verificationEvidenceSha256,
    reviewDecisions,
    verificationRequest: {
      rpc: 'verify_catalog_import',
      args: {
        p_batch_id: batchId,
        p_operation_key: databasePlan.verify.operationKey,
        p_records_sha256: finalizeReceipt.records_sha256,
        p_verification_evidence_sha256: verificationEvidenceSha256,
      },
    },
    reviewRequest: {
      rpc: 'review_catalog_import',
      args: {
        p_batch_id: batchId,
        p_operation_key: databasePlan.review.operationKey,
        p_decisions: reviewDecisions,
        p_expected_candidates_sha256: finalizeReceipt.candidates_sha256,
        p_expected_batch_evidence_sha256: databaseBatchEvidenceSha256,
        p_expected_verification_evidence_sha256: verificationEvidenceSha256,
        p_reviewer_ids: [...databasePlan.review.reviewerIds],
        p_review_ticket: databasePlan.review.reviewTicket,
        p_review_evidence_sha256: databasePlan.review.reviewEvidenceSha256,
      },
    },
  };
}

export function validateCatalogPromotionOperator({ databasePlan, operator }) {
  if (typeof operator !== 'string' || !LIFECYCLE_OPERATOR_PATTERN.test(operator)) {
    fail('catalog promotion operator is malformed.');
  }
  const reviewerIds = databasePlan?.review?.reviewerIds;
  assertArray(reviewerIds, 'database plan.review.reviewerIds', {
    min: 2,
    max: 2,
  });
  const normalizedReviewerIds = reviewerIds.map((reviewerId) => {
    if (typeof reviewerId !== 'string' || !REVIEWER_ID_PATTERN.test(reviewerId)) {
      fail('database plan.review.reviewerIds contains a malformed identity.');
    }
    return reviewerId.toLowerCase();
  });
  const reviewedByDerivedValue = databasePlan?.review?.reviewedByDerivedValue;
  if (
    typeof reviewedByDerivedValue !== 'string' ||
    reviewedByDerivedValue !== reviewerIds.join('+')
  ) {
    fail('database plan.review.reviewedByDerivedValue is malformed.');
  }
  if (
    new Set(normalizedReviewerIds).size !== reviewerIds.length ||
    normalizedReviewerIds.includes(operator.toLowerCase()) ||
    operator.toLowerCase() === reviewedByDerivedValue.toLowerCase() ||
    databasePlan.promote?.operatorMustNotMatchAnyReviewerId !== true ||
    canonicalJson(databasePlan.promote?.forbiddenOperatorReviewerIds) !==
      canonicalJson(reviewerIds) ||
    databasePlan.rollback?.operatorMustNotMatchAnyReviewerId !== true ||
    canonicalJson(databasePlan.rollback?.forbiddenOperatorReviewerIds) !==
      canonicalJson(reviewerIds)
  ) {
    fail('catalog promotion operator must be distinct from every signed row reviewer.');
  }
  return operator;
}

export function buildCatalogStageEnvelope({
  transformPath,
  qaPath,
  reviewsPath,
  root = process.cwd(),
  authorityValidator = validateCurrentCatalogPromotionAuthority,
}) {
  const realRoot = realpathSync.native(resolve(root));
  const transformEvidence = readStableEvidenceFile(
    transformPath,
    'approved transform',
    MAXIMUM_BYTES.transform,
  );
  const qaEvidence = readStableEvidenceFile(qaPath, 'zero-warning QA report', MAXIMUM_BYTES.qa);
  const reviewEvidence = readStableEvidenceFile(
    reviewsPath,
    'row-review overlay',
    MAXIMUM_BYTES.reviews,
  );
  for (const evidence of [transformEvidence, qaEvidence, reviewEvidence]) {
    if (!isWithin(realRoot, evidence.path))
      fail('all stage evidence must stay within the workspace.');
  }
  if (
    new Set([transformEvidence.path, qaEvidence.path, reviewEvidence.path].map(normalizedPath))
      .size !== 3
  ) {
    fail('transform, QA, and review inputs must be three distinct real files.');
  }
  const transformState = validateTransform(transformEvidence.value, transformEvidence);
  validateQa(qaEvidence.value, qaEvidence, transformState, realRoot);
  const batchEvidence = buildCatalogBatchEvidenceDescriptor({
    transform: transformEvidence.value,
    transformArtifactSha256: transformEvidence.sha256,
    qaReportUri: workspaceRelative(realRoot, qaEvidence.path),
    qaReportSha256: qaEvidence.sha256,
    expectedRecordCount: transformState.records.length,
  });
  const reviewState = validateReviews(
    reviewEvidence.value,
    reviewEvidence,
    transformState,
    qaEvidence,
    batchEvidence,
  );
  const authority = authorityValidator({
    root: realRoot,
    transformState,
    qa: qaEvidence.value,
    reviewState,
  });

  const stageRecords = transformState.records.map((record, index) => {
    const review = reviewState.reviewByOrdinal.get(index + 1);
    const body = {
      hashDomain: 'offline-reviewed-transform-record-v1',
      ordinal: index + 1,
      sourceRef: record.sourceRef,
      naturalKey: transformState.recordMetadata[index].naturalKey,
      disposition: review.disposition,
      reasonCode: review.reasonCode,
      duplicateOfNaturalKey: review.duplicateOfNaturalKey,
      reviewerIds: [...review.reviewerIds],
      transformRecordPayloadSha256: sha256(Buffer.from(canonicalJson(record), 'utf8')),
    };
    return { ...body, recordSha256: sha256(Buffer.from(canonicalJson(body), 'utf8')) };
  });
  const counts = {
    transformedRecords: transformState.records.length,
    accepted: stageRecords.filter((record) => record.disposition === 'accepted').length,
    rejected: stageRecords.filter((record) => record.disposition === 'rejected').length,
    duplicate: stageRecords.filter((record) => record.disposition === 'duplicate').length,
    transformRejected:
      transformEvidence.value.source === 'open_beauty_facts'
        ? transformEvidence.value.rejected.length
        : 0,
  };
  const auditAggregateRecordsSha256 = sha256(
    Buffer.from(canonicalJson(stageRecords.map((record) => record.recordSha256)), 'utf8'),
  );
  const operationSeed = sha256(
    Buffer.from(
      canonicalJson({
        source: transformEvidence.value.source,
        transformSha256: transformEvidence.sha256,
        qaSha256: qaEvidence.sha256,
        reviewsSha256: reviewEvidence.sha256,
        auditAggregateRecordsSha256,
      }),
      'utf8',
    ),
  );
  const databasePlan = buildDatabasePlan({
    root: realRoot,
    transformState,
    transformEvidence,
    qaEvidence,
    reviewEvidence,
    reviewState,
    batchEvidence,
    operationSeed,
  });
  const body = {
    schemaVersion: 1,
    contractId: CATALOG_STAGE_CONTRACT_ID,
    operation: 'stage_reviewed_catalog_batch',
    source: transformEvidence.value.source,
    sourceComponentId: transformState.contract.componentId,
    parserVersion: transformState.contract.parserVersion,
    importMode: transformState.contract.importMode,
    territory: 'US',
    sourceSnapshot: transformEvidence.value.sourceSnapshot,
    sourcePolicy: transformEvidence.value.sourcePolicy,
    transformedPayloadSha256: transformEvidence.value.transformedPayloadSha256,
    databaseCandidatesSha256: databasePlan.candidateBinding.databaseCandidatesSha256,
    databaseCandidatesDigestContractId: CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID,
    databaseBatchEvidenceSha256: databasePlan.batchEvidenceBinding.databaseBatchEvidenceSha256,
    approvalManifestSha256: transformEvidence.value.sourceApproval.manifestSha256,
    trustRegistrySha256: transformEvidence.value.sourceApproval.trustRegistrySnapshot.sha256,
    releaseScopeSha256: transformEvidence.value.sourceApproval.releaseScopeSnapshot.sha256,
    releaseBuildEvidenceSha256:
      transformEvidence.value.sourceApproval.releaseBuildEvidenceSnapshot.sha256,
    evidence: {
      transform: evidenceDescriptor(realRoot, transformEvidence),
      qa: evidenceDescriptor(realRoot, qaEvidence),
      reviews: evidenceDescriptor(realRoot, reviewEvidence),
    },
    authority,
    counts,
    auditAggregateRecordsSha256,
    records: stageRecords,
    databasePlan,
  };
  const stageDigestSha256 = sha256(Buffer.from(canonicalJson(body), 'utf8'));
  const envelope = {
    ...body,
    stageDigestSha256,
    idempotencyKey: `${CATALOG_STAGE_CONTRACT_ID}:${transformEvidence.value.source}:${stageDigestSha256}`,
  };
  if (
    Buffer.byteLength(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8') > MAXIMUM_BYTES.envelope
  ) {
    fail('stage envelope exceeds the 128 MiB completion-consumable artifact bound.');
  }
  return envelope;
}

export function parseCatalogStageArgs(argv) {
  const values = new Map();
  const allowed = new Set(['--transform', '--qa', '--reviews', '--output']);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag)) fail(`unknown or positional CLI argument ${flag}.`);
    if (values.has(flag)) fail(`CLI flag ${flag} may be supplied only once.`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`CLI flag ${flag} requires an explicit path.`);
    values.set(flag, value);
    index += 1;
  }
  for (const flag of allowed) {
    if (!values.has(flag)) fail(`missing required CLI flag ${flag}.`);
  }
  return {
    transformPath: resolve(values.get('--transform')),
    qaPath: resolve(values.get('--qa')),
    reviewsPath: resolve(values.get('--reviews')),
    outputPath: resolve(values.get('--output')),
  };
}

export function parseCatalogReceiptCompletionArgs(argv) {
  const values = new Map();
  const allowed = new Set(['--envelope', '--receipts', '--output']);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag)) fail(`unknown or positional CLI argument ${flag}.`);
    if (values.has(flag)) fail(`CLI flag ${flag} may be supplied only once.`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`CLI flag ${flag} requires an explicit path.`);
    values.set(flag, value);
    index += 1;
  }
  for (const flag of allowed) {
    if (!values.has(flag)) fail(`missing required CLI flag ${flag}.`);
  }
  return {
    envelopePath: resolve(values.get('--envelope')),
    receiptsPath: resolve(values.get('--receipts')),
    outputPath: resolve(values.get('--output')),
  };
}

export function completeCatalogDatabaseReceiptsFromFiles({
  envelopePath,
  receiptsPath,
  root = process.cwd(),
  authorityValidator = validateCurrentCatalogPromotionAuthority,
}) {
  const realRoot = realpathSync.native(resolve(root));
  const envelopeEvidence = readStableEvidenceFile(
    envelopePath,
    'catalog stage envelope',
    MAXIMUM_BYTES.envelope,
  );
  const receiptsEvidence = readStableEvidenceFile(
    receiptsPath,
    'catalog database receipts',
    MAXIMUM_BYTES.receipts,
  );
  if (
    !isWithin(realRoot, envelopeEvidence.path) ||
    !isWithin(realRoot, receiptsEvidence.path) ||
    normalizedPath(envelopeEvidence.path) === normalizedPath(receiptsEvidence.path)
  ) {
    fail('completion inputs must be distinct real files inside the workspace.');
  }
  const envelope = envelopeEvidence.value;
  if (
    envelope.schemaVersion !== 1 ||
    envelope.contractId !== CATALOG_STAGE_CONTRACT_ID ||
    !isObject(envelope.evidence)
  ) {
    fail('completion envelope is not a CAT-02 stage envelope.');
  }
  assertDigest(envelope.stageDigestSha256, 'completion envelope.stageDigestSha256');
  const envelopeBody = { ...envelope };
  delete envelopeBody.stageDigestSha256;
  delete envelopeBody.idempotencyKey;
  if (
    sha256(Buffer.from(canonicalJson(envelopeBody), 'utf8')) !== envelope.stageDigestSha256 ||
    envelope.idempotencyKey !==
      `${CATALOG_STAGE_CONTRACT_ID}:${envelope.source}:${envelope.stageDigestSha256}`
  ) {
    fail('completion envelope content digest or idempotency key is invalid.');
  }
  const rebuiltEnvelope = buildCatalogStageEnvelope({
    root: realRoot,
    transformPath: resolve(realRoot, envelope.evidence.transform?.path ?? ''),
    qaPath: resolve(realRoot, envelope.evidence.qa?.path ?? ''),
    reviewsPath: resolve(realRoot, envelope.evidence.reviews?.path ?? ''),
    authorityValidator,
  });
  if (canonicalJson(rebuiltEnvelope) !== canonicalJson(envelope)) {
    fail('completion envelope does not reproduce from its current exact authority evidence.');
  }

  const receipts = receiptsEvidence.value;
  assertExactKeys(
    receipts,
    ['schemaVersion', 'contractId', 'batchId', 'chunkReceipts', 'finalizeReceipt'],
    'catalog database receipts',
  );
  assertNoSecretKeys(receipts, 'catalog database receipts');
  if (receipts.schemaVersion !== 1 || receipts.contractId !== 'catalog-database-rpc-receipts-v1') {
    fail('catalog database receipts contract identity is invalid.');
  }
  const completion = materializeCatalogDatabaseReceiptCompletion({
    databasePlan: envelope.databasePlan,
    batchId: receipts.batchId,
    chunkReceipts: receipts.chunkReceipts,
    finalizeReceipt: receipts.finalizeReceipt,
  });
  const body = {
    ...completion,
    operation: 'complete_catalog_database_receipts',
    sourceStageDigestSha256: envelope.stageDigestSha256,
    sourceEnvelopeSha256: envelopeEvidence.sha256,
    sourceReceiptsSha256: receiptsEvidence.sha256,
    evidence: {
      envelope: evidenceDescriptor(realRoot, envelopeEvidence),
      receipts: evidenceDescriptor(realRoot, receiptsEvidence),
    },
  };
  const completionDigestSha256 = sha256(Buffer.from(canonicalJson(body), 'utf8'));
  return {
    ...body,
    completionDigestSha256,
    idempotencyKey: `${CATALOG_DATABASE_RECEIPT_COMPLETION_CONTRACT_ID}:${receipts.batchId}:${completionDigestSha256}`,
  };
}

export function assertCatalogStageOutputPath(outputPath, root = process.cwd()) {
  const realRoot = realpathSync.native(resolve(root));
  const artifactRoot = realpathSync.native(resolve(realRoot, 'artifacts/phase4'));
  const candidate = resolve(outputPath);
  if (
    !isWithin(artifactRoot, candidate) ||
    normalizedPath(candidate) === normalizedPath(artifactRoot)
  ) {
    fail('output must be a file below artifacts/phase4.');
  }
  if (!candidate.toLowerCase().endsWith('.json')) fail('output must use a .json filename.');
  const parent = resolve(candidate, '..');
  assertNoSymlinkComponents(parent, 'stage output parent');
  const realParent = realpathSync.native(parent);
  if (
    !isWithin(artifactRoot, realParent) ||
    normalizedPath(realParent) !== normalizedPath(parent)
  ) {
    fail('output parent must be a real non-symlink directory under artifacts/phase4.');
  }
  try {
    lstatSync(candidate);
    fail('output already exists; stage evidence is no-clobber.');
  } catch (error) {
    if (error?.message?.startsWith('Catalog stage contract rejected input:')) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }
  return candidate;
}

export function writeCatalogStageEnvelope(outputPath, envelope, root = process.cwd()) {
  const safeOutput = assertCatalogStageOutputPath(outputPath, root);
  if (
    Buffer.byteLength(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8') > MAXIMUM_BYTES.envelope
  ) {
    fail('stage envelope exceeds the 128 MiB completion-consumable artifact bound.');
  }
  writeJsonAtomically(safeOutput, envelope, { allowReplace: false });
  return safeOutput;
}

export function writeCatalogDatabaseReceiptCompletion(
  outputPath,
  completion,
  root = process.cwd(),
) {
  const safeOutput = assertCatalogStageOutputPath(outputPath, root);
  if (
    Buffer.byteLength(`${JSON.stringify(completion, null, 2)}\n`, 'utf8') > MAXIMUM_BYTES.envelope
  ) {
    fail('receipt completion exceeds the 128 MiB output artifact bound; split the batch.');
  }
  writeJsonAtomically(safeOutput, completion, { allowReplace: false });
  return safeOutput;
}
