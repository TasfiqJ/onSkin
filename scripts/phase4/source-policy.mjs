import {
  createHash,
  createPublicKey,
  randomUUID,
  verify as verifyCryptographicSignature,
} from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isIP } from 'node:net';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

export const CATALOG_SOURCE_POLICY_PATH = 'docs/phase-4/catalog-source-policy.json';
export const CATALOG_SOURCE_TRUST_REGISTRY_PATH = 'docs/phase-4/catalog-source-trust-registry.json';
export const CATALOG_RELEASE_SCOPE_PATH = 'docs/phase-4/catalog-release-scope.json';
export const CATALOG_RELEASE_BUILD_EVIDENCE_PATH =
  'docs/phase-4/catalog-release-build-evidence.json';
export const APPROVAL_SIGNATURE_ENVELOPE = 'catalog-source-approval-signature-v1';
export const TRUST_REGISTRY_SIGNATURE_ENVELOPE = 'catalog-source-trust-registry-signature-v1';
export const RELEASE_BUILD_EVIDENCE_SIGNATURE_ENVELOPE =
  'catalog-release-build-evidence-signature-v1';
export const CATALOG_TRANSFORMED_PAYLOAD_CONTRACT = Object.freeze({
  contractId: 'catalog-transformed-payload-v1',
  schemaVersion: 1,
  digestAlgorithm: 'SHA-256',
  canonicalization: 'canonical-json-sorted-object-keys',
  recordStage: 'before-source-snapshot-date-enrichment',
  excludedRecordFields: Object.freeze(['sourceSnapshotDate']),
  sourceSnapshotDateBinding: Object.freeze({
    signedApprovalPath: 'artifact.snapshotDate',
    manifestPath: 'sourceSnapshot.date',
    recordField: 'sourceSnapshotDate',
  }),
});
export const CATALOG_QA_LAUNCH_CLEAR_REASON =
  'No. Source-transform QA is only one gate; launch still requires final source identity/legal evidence, curated record review, beta coverage, signed binary/device evidence, deployment, and named signoff.';
export const CATALOG_QA_SOURCE_HASH_PATHS = Object.freeze([
  '.gitignore',
  '.github/workflows/quality.yml',
  'package.json',
  'package-lock.json',
  'apps/mobile/app.config.js',
  'apps/mobile/app.base.json',
  'apps/mobile/eas.json',
  'apps/mobile/package.json',
  'apps/mobile/phase3-review-evidence.js',
  'docs/hugeToDo/launch-contract.json',
  'scripts/launch/contract.mjs',
  'scripts/phase4/catalog-qa-report.mjs',
  'scripts/phase4/build-source-worklist.mjs',
  'scripts/phase4/beta-coverage-report.mjs',
  'scripts/phase4/beta-coverage-report-smoke.mjs',
  'scripts/phase4/catalog-curation-contract.mjs',
  'scripts/phase4/catalog-curation-contract.test.mjs',
  'scripts/phase4/build-catalog-curation-envelope.mjs',
  'scripts/phase4/catalog-coverage-quality-report.mjs',
  'scripts/phase4/catalog-coverage-quality-report.test.mjs',
  'scripts/phase4/import-obf-snapshot.mjs',
  'scripts/phase4/import-cosing-dictionary.mjs',
  'scripts/phase4/import-fixture-smoke.mjs',
  'scripts/phase4/check-source-env.mjs',
  'scripts/phase4/check-source-env-smoke.mjs',
  'scripts/phase4/catalog-qa-report-smoke.mjs',
  'scripts/phase4/catalog-promotion-contract.mjs',
  'scripts/phase4/catalog-promotion-contract.test.mjs',
  'scripts/phase4/build-catalog-stage-envelope.mjs',
  'scripts/phase4/complete-catalog-database-receipts.mjs',
  'scripts/phase4/catalog-source-policy-audit.mjs',
  'scripts/phase4/source-policy.mjs',
  'scripts/phase4/source-policy.test.mjs',
  'scripts/phase2/local-supabase-contract.mjs',
  'scripts/phase2/local-supabase-reset.mjs',
  'scripts/phase9/lib.mjs',
  'scripts/phase9/rls-adversarial-smoke.mjs',
  'scripts/phase9/supabase-function-acl.test.mjs',
  'scripts/phase9/supabase-policy-lint.mjs',
  'supabase/migrations/20260614000026_phase4_catalog.sql',
  'supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql',
  'supabase/migrations/20260717000057_catalog_import_lifecycle.sql',
  'supabase/migrations/20260717000058_catalog_launch_curation.sql',
  'supabase/tests/database/schema_contract.test.sql',
  'supabase/tests/database/catalog_import_lifecycle.test.sql',
  'supabase/tests/database/catalog_launch_curation.test.sql',
  'supabase/functions/catalog-lookup/index.ts',
  'supabase/functions/catalog-lookup/catalogContract.ts',
  'supabase/functions/catalog-lookup/catalogContract.test.ts',
  'supabase/functions/catalog-search/index.ts',
  'supabase/functions/catalog-search/catalogContract.ts',
  'supabase/functions/catalog-search/catalogContract.test.ts',
  'supabase/functions/catalog-report/index.ts',
  'supabase/functions/catalog-report/privacy.ts',
  'supabase/functions/catalog-report/privacy.test.ts',
  'supabase/functions/deno.lock',
  'docs/FOR_TAS_TO_DO.md',
  'docs/phase-3/consent-matrix.md',
  'docs/phase-3/data-inventory.md',
  'docs/store-privacy-inventory.md',
  'docs/phase-4/beta-coverage-report.md',
  'docs/phase-4/beta-shelf-corpus.template.json',
  'docs/phase-4/catalog-coverage-quality-targets.template.json',
  'docs/phase-4/catalog-curation-review.template.json',
  'docs/phase-4/catalog-cat02-membership-proof.template.json',
  'docs/phase-4/catalog-curation-database-readback.template.json',
  'docs/phase-4/catalog-curation-release-runbook.md',
  'docs/phase-4/catalog-release-scope.json',
  'docs/phase-4/catalog-release-build-evidence.json',
  'docs/phase-4/catalog-source-memo-cosing.md',
  'docs/phase-4/catalog-source-memo-open-beauty-facts.md',
  'docs/phase-4/catalog-import-promotion-runbook.md',
  'docs/phase-4/catalog-source-policy.json',
  'docs/phase-4/catalog-source-trust-registry.json',
  'docs/phase-4/obf-source-approval.template.json',
  'docs/phase-4/cosing-source-approval.template.json',
  'docs/phase-4/odbl-compliance-memo.md',
  'docs/phase-4/phase-4-exit-review.md',
]);

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EAS_BUILD_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GIT_COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const IOS_BUILD_NUMBER_PATTERN = /^[1-9]\d{0,17}$/;
const APP_STORE_ID_PATTERN = /^[1-9]\d{4,19}$/;
const SUPPORT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_PATTERN =
  /(?:^|[\s._-])(example|placeholder|replace|sample|test|todo|tbd|unknown)(?:$|[\s._-])/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const CATALOG_CANONICAL_WHITESPACE_PATTERN =
  /[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/gu;
const RESERVED_HOST_PATTERN =
  /(?:^|\.)(?:localhost|local|invalid|test|example(?:\.com|\.org|\.net)?)$/i;

const SOURCE_SECURITY_INVARIANTS = {
  open_beauty_facts: {
    componentId: 'obf_odbl_component',
    productionApproved: false,
    legalReviewRequired: true,
    sourceUrl: 'https://world.openbeautyfacts.org/',
    allowedSnapshotHosts: ['openbeautyfacts.org', 'openfoodfacts.org'],
    allowedSnapshotPathPrefixes: ['/data', '/data/'],
    allowedImportModes: ['fixture', 'approved_offline_export'],
    maxSnapshotAgeDays: 31,
    forbiddenProductionArtifactSha256: [
      'c9a150c17cac824f78a85671544bea22fa04156dbbc4693b6ff3538a6205a8e5',
    ],
    transformLimits: {
      maxArtifactBytes: 67_108_864,
      maxRecords: 100_000,
      maxFieldCharacters: 20_000,
      maxCategoryTags: 100,
    },
    allowedFields: [
      'code',
      'product_name',
      'brands',
      'categories_tags',
      'ingredients_text',
      'last_modified_t',
    ],
    requiredDeterminations: {
      attribution: 'approved_for_exact_public_surface',
      imageRights: 'images_prohibited',
      contributionBack: 'disabled',
      corrections: 'first_party_correction_workflow_only',
      thirdPartyContentRights: 'approved_for_exact_textual_fields_and_nominative_use',
      sourceTermsSnapshot: 'exact_terms_snapshot_retained',
    },
    requiredTermsUrls: [
      'https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/',
      'https://opendatacommons.org/licenses/odbl/1-0/',
      'https://opendatacommons.org/licenses/dbcl/1-0/',
    ],
    databaseClassificationOptions: ['derivative_database', 'collective_database_component'],
    shareAlikeImplementationOptions: [
      'entire_derivative_or_alterations_machine_readable',
      'source_component_unmodified_separate_and_machine_readable',
    ],
    sourceIsolationMode: 'separate_source_component_pending_legal_classification',
    requiredProductionUses: ['offline_export_import', 'product_facts'],
    forbiddenProductionUses: [
      'runtime_api',
      'search_as_you_type_api',
      'api_crawling',
      'product_images',
      'automatic_contribution_back',
    ],
    forbiddenClaims: ['complete', 'always_accurate', 'source_verified', 'safe'],
    attributionRequired: true,
    shareAlikeReviewRequired: true,
    correctionWorkflowRequired: true,
    licenses: {
      database: { url: 'https://opendatacommons.org/licenses/odbl/1-0/' },
      contents: { url: 'https://opendatacommons.org/licenses/dbcl/1-0/' },
      images: {
        url: 'https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/',
        allowed: false,
      },
    },
  },
  cosing: {
    componentId: 'cosing_reference_component',
    productionApproved: false,
    legalReviewRequired: true,
    sourceUrl:
      'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en',
    allowedSnapshotHosts: ['ec.europa.eu', 'europa.eu'],
    allowedSnapshotPathPrefixes: [
      '/sectors/cosmetics/cosmetic-ingredient-database_en',
      '/growth/tools-databases/cosing',
    ],
    allowedImportModes: ['fixture', 'approved_offline_snapshot'],
    maxSnapshotAgeDays: 366,
    forbiddenProductionArtifactSha256: [
      '7bb4651229ab07aa7fd70f11168ddfcc41da75cd61279d7f0d413b1ea809e3a4',
    ],
    transformLimits: {
      maxArtifactBytes: 33_554_432,
      maxRecords: 100_000,
      maxFieldCharacters: 20_000,
      maxSynonymsPerRecord: 50,
    },
    allowedFields: [
      'inci_name',
      'display_name',
      'cas_number',
      'ec_number',
      'annex_status',
      'synonyms',
      'cosing_ref',
      'record_status',
      'glossary_decision',
    ],
    requiredDeterminations: {
      reuse: 'approved_for_exact_offline_fields',
      attribution: 'approved_for_exact_public_surface',
      thirdPartyRights: 'excluded_or_separately_cleared',
      regulatoryDisclaimer: 'informative_not_approval_or_safety',
      imageRights: 'images_prohibited',
      corrections: 'first_party_correction_workflow_only',
      ecReuseConditions:
        'source_credit_change_indication_no_distortion_non_liability_operationalized',
      glossaryDecision: 'eu_2025_1175_exact_version_retained',
    },
    requiredTermsUrls: [
      'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en',
      'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database/cosing-glossary-ingredients_en',
      'https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng',
      'https://commission.europa.eu/legal-notice_en',
    ],
    databaseCombinationMode: 'provenance_tagged_reference_component',
    allowedRecordStatuses: ['active'],
    requiredGlossaryDecision: 'EU_2025_1175',
    reuseBasis: { url: 'https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng' },
    requiredProductionUses: ['offline_reference_import', 'inci_normalization'],
    forbiddenProductionUses: ['runtime_api', 'product_images'],
    forbiddenClaims: [
      'approved',
      'safe',
      'recommended',
      'product_legal_in_market',
      'medical_clearance',
      'pregnancy_safe',
    ],
    attributionRequired: true,
    correctionWorkflowRequired: true,
  },
};

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeCatalogCosingKey(value) {
  if (typeof value !== 'string') {
    throw new Error('CosIng normalization requires text.');
  }
  return value
    .normalize('NFKC')
    .replace(CATALOG_CANONICAL_WHITESPACE_PATTERN, ' ')
    .replace(/^ +| +$/gu, '')
    .toUpperCase();
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} must be valid UTF-8.`);
  }
}

function assertNoDuplicateJsonKeys(text, label) {
  let index = 0;
  const maxDepth = 100;

  function whitespace() {
    while (/\s/.test(text[index] ?? '')) index += 1;
  }

  function stringToken() {
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === '\\') {
        index += 2;
      } else if (text[index] === '"') {
        index += 1;
        return JSON.parse(text.slice(start, index));
      } else {
        index += 1;
      }
    }
    throw new Error(`${label} contains an unterminated JSON string.`);
  }

  function value(depth) {
    if (depth > maxDepth) throw new Error(`${label} exceeds the JSON nesting limit.`);
    whitespace();
    if (text[index] === '{') return object(depth + 1);
    if (text[index] === '[') return array(depth + 1);
    if (text[index] === '"') {
      stringToken();
      return;
    }
    const match = text
      .slice(index)
      .match(/^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/);
    if (!match) throw new Error(`${label} contains invalid JSON near byte ${index}.`);
    index += match[0].length;
  }

  function object(depth) {
    index += 1;
    whitespace();
    const keys = new Set();
    if (text[index] === '}') {
      index += 1;
      return;
    }
    for (;;) {
      whitespace();
      if (text[index] !== '"') throw new Error(`${label} contains an invalid object key.`);
      const key = stringToken();
      if (keys.has(key)) throw new Error(`${label} contains duplicate JSON key ${key}.`);
      keys.add(key);
      whitespace();
      if (text[index] !== ':') throw new Error(`${label} contains an invalid object member.`);
      index += 1;
      value(depth);
      whitespace();
      if (text[index] === '}') {
        index += 1;
        return;
      }
      if (text[index] !== ',') throw new Error(`${label} contains an invalid object delimiter.`);
      index += 1;
    }
  }

  function array(depth) {
    index += 1;
    whitespace();
    if (text[index] === ']') {
      index += 1;
      return;
    }
    for (;;) {
      value(depth);
      whitespace();
      if (text[index] === ']') {
        index += 1;
        return;
      }
      if (text[index] !== ',') throw new Error(`${label} contains an invalid array delimiter.`);
      index += 1;
    }
  }

  value(0);
  whitespace();
  if (index !== text.length) throw new Error(`${label} contains trailing JSON content.`);
}

function readJson(path, label) {
  const bytes = readFileSync(path);
  return { bytes, value: parseCatalogControlJson(bytes, label) };
}

export function parseCatalogControlJson(bytes, label = 'Catalog control JSON') {
  return parseCatalogEvidenceJson(bytes, label, { maxBytes: 1_048_576 });
}

export function parseCatalogEvidenceJson(
  bytes,
  label = 'Catalog evidence JSON',
  { maxBytes = 268_435_456 } = {},
) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new Error(`${label} must be supplied as bytes.`);
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || bytes.length > maxBytes) {
    throw new Error(`${label} exceeds its bounded evidence-file limit.`);
  }
  const text = decodeUtf8(bytes, label);
  assertNoDuplicateJsonKeys(text, label);
  return JSON.parse(text);
}

function stableJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON rejects non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  throw new Error(`Canonical JSON rejects ${typeof value}.`);
}

export function canonicalJson(value) {
  return stableJson(value);
}

export function approvalSigningPayload(approval) {
  const payload = { ...approval };
  delete payload.signatures;
  return Buffer.from(canonicalJson(payload), 'utf8');
}

export function trustRegistrySigningPayload(registry) {
  const payload = { ...registry };
  delete payload.rootSignature;
  return Buffer.from(canonicalJson(payload), 'utf8');
}

export function releaseBuildEvidenceSigningPayload(evidence) {
  const payload = { ...evidence };
  delete payload.signature;
  return Buffer.from(canonicalJson(payload), 'utf8');
}

export function catalogTransformedPayloadSha256({
  controls,
  inputSha256,
  parserVersion,
  projectedFields,
  records,
  rejected = [],
  sourceComponentId,
  sourceIsolationMode,
  sourceKey,
}) {
  if (!['open_beauty_facts', 'cosing'].includes(sourceKey)) {
    throw new Error('Transformed payload sourceKey is invalid.');
  }
  if (!Array.isArray(records) || !Array.isArray(rejected)) {
    throw new Error('Transformed payload records/rejected must be arrays.');
  }
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Transformed payload record ${index + 1} must be an object.`);
    }
    if (Object.hasOwn(record, 'sourceSnapshotDate')) {
      throw new Error(
        'Transformed payload records must be hashed before sourceSnapshotDate enrichment; the date is separately bound by the signed approval and import manifest.',
      );
    }
  }
  return sha256(
    Buffer.from(
      canonicalJson({
        contractId: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.contractId,
        schemaVersion: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.schemaVersion,
        controls,
        inputSha256,
        parserVersion,
        projectedFields,
        records,
        rejected,
        sourceComponentId,
        sourceIsolationMode,
        sourceKey,
      }),
      'utf8',
    ),
  );
}

function decodeCanonicalBase64(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new Error(`${label} must be canonical base64.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) {
    throw new Error(`${label} must be canonical base64.`);
  }
  return bytes;
}

function ed25519PublicKeyFromBase64(value, label) {
  const bytes = decodeCanonicalBase64(value, label);
  const key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(`${label} must encode an Ed25519 public key.`);
  }
  const normalizedBytes = key.export({ format: 'der', type: 'spki' });
  if (!Buffer.from(normalizedBytes).equals(bytes)) {
    throw new Error(`${label} must use exact minimal SPKI DER without trailing bytes.`);
  }
  return { bytes: Buffer.from(normalizedBytes), key };
}

export function catalogTrustRootFromEnvironment(env = process.env) {
  const keyId = env.CATALOG_TRUST_ROOT_KEY_ID;
  const publicKeySpkiBase64 = env.CATALOG_TRUST_ROOT_PUBLIC_KEY_SPKI_BASE64;
  const registryEpoch = env.CATALOG_TRUST_REGISTRY_EPOCH;
  const registrySha256 = env.CATALOG_TRUST_REGISTRY_SHA256;
  if (!keyId && !publicKeySpkiBase64 && !registryEpoch && !registrySha256) return null;
  if (!keyId || !publicKeySpkiBase64 || !registryEpoch || !registrySha256) {
    throw new Error(
      'Catalog trust-root key ID/public key and pinned registry epoch/SHA-256 must be supplied together.',
    );
  }
  if (
    !/^\d+$/.test(registryEpoch) ||
    !Number.isSafeInteger(Number(registryEpoch)) ||
    Number(registryEpoch) < 1 ||
    !digest(registrySha256)
  ) {
    throw new Error('Pinned catalog trust-registry epoch/SHA-256 is invalid.');
  }
  return {
    keyId,
    publicKeySpkiBase64,
    registryEpoch: Number(registryEpoch),
    registrySha256: registrySha256.toLowerCase(),
  };
}

function digest(value) {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function safeText(value, { min = 3, max = 200, allowPlaceholder = false } = {}) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= min &&
    value.length <= max &&
    !CONTROL_CHARACTER_PATTERN.test(value) &&
    (allowPlaceholder || !PLACEHOLDER_PATTERN.test(value))
  );
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  } catch {
    return false;
  }
}

function validRfc3339Utc(value) {
  if (typeof value !== 'string' || !RFC3339_UTC_PATTERN.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function daysBetween(earlier, later) {
  return (Date.parse(later) - Date.parse(earlier)) / 86_400_000;
}

function parsePublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      isIP(url.hostname) !== 0 ||
      !url.hostname.includes('.') ||
      RESERVED_HOST_PATTERN.test(url.hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function normalizePublicHttpsHost(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || CONTROL_CHARACTER_PATTERN.test(trimmed)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = parsePublicHttpsUrl(candidate);
  if (!url || url.search || url.hash || url.port) return null;
  return url.hostname.toLowerCase();
}

function allowedSourceUrl(value, source) {
  const url = parsePublicHttpsUrl(value);
  if (!url) return false;
  const hostAllowed = source.allowedSnapshotHosts.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
  const pathAllowed = source.allowedSnapshotPathPrefixes.some(
    (prefix) =>
      url.pathname === prefix ||
      (prefix.endsWith('/')
        ? url.pathname.startsWith(prefix)
        : url.pathname.startsWith(`${prefix}/`)),
  );
  return hostAllowed && pathAllowed;
}

function exactStringArray(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    new Set(value).size === value.length &&
    value.every((item) => expected.includes(item))
  );
}

function exactObjectKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort())
  );
}

function validateExactInvariant(actual, expected, path, errors) {
  if (actual === undefined) {
    errors.push(`${path} is missing from the frozen source-security invariant.`);
    return;
  }
  if (Array.isArray(expected) || expected === null || typeof expected !== 'object') {
    if (canonicalJson(actual) !== canonicalJson(expected)) {
      errors.push(`${path} differs from the frozen source-security invariant.`);
    }
    return;
  }
  for (const [key, value] of Object.entries(expected)) {
    validateExactInvariant(actual?.[key], value, `${path}.${key}`, errors);
  }
}

export function loadCatalogSourcePolicy(root = process.cwd()) {
  const path = fixedRepoFile(root, CATALOG_SOURCE_POLICY_PATH, 'Catalog source policy');
  const { bytes, value: policy } = readJson(path, 'Catalog source policy');
  const errors = validateCatalogSourcePolicy(policy);
  if (errors.length > 0)
    throw new Error(`Invalid catalog source policy:\n- ${errors.join('\n- ')}`);
  return { path, bytes, sha256: sha256(bytes), policy };
}

export function validateCatalogSourcePolicy(policy) {
  const errors = [];
  if (policy?.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (policy?.policyId !== 'catalog-source-policy-v1') {
    errors.push('policyId must be catalog-source-policy-v1.');
  }
  const controls = policy?.globalControls;
  for (const key of [
    'approvalManifestRequiredForProduction',
    'artifactSha256Required',
    'recordLevelProvenanceRequired',
    'publicAttributionSurfaceRequired',
  ]) {
    if (controls?.[key] !== true) errors.push(`globalControls.${key} must be true.`);
  }
  for (const key of [
    'runtimeThirdPartyCatalogRequestsAllowed',
    'contributionBackAllowed',
    'externalProductImagesAllowed',
  ]) {
    if (controls?.[key] !== false) errors.push(`globalControls.${key} must be false.`);
  }
  if (!exactStringArray(controls?.permittedLaunchTerritories, ['US'])) {
    errors.push('globalControls.permittedLaunchTerritories must remain US-only for Wave 1.');
  }
  if (
    !Number.isInteger(controls?.approvalMaxValidityDays) ||
    controls.approvalMaxValidityDays < 1 ||
    controls.approvalMaxValidityDays > 366
  ) {
    errors.push('globalControls.approvalMaxValidityDays must be 1..366.');
  }

  for (const sourceKey of ['open_beauty_facts', 'cosing']) {
    const source = policy?.sources?.[sourceKey];
    if (!source) {
      errors.push(`sources.${sourceKey} is required.`);
      continue;
    }
    if (source.productionApproved !== false || source.legalReviewRequired !== true) {
      errors.push(`sources.${sourceKey} must remain production-disabled and legal-review gated.`);
    }
    if (!safeText(source.componentId) || !source.allowedImportModes?.includes('fixture')) {
      errors.push(`sources.${sourceKey} requires a componentId and fixture import mode.`);
    }
    if (source.allowedImportModes?.some((mode) => /api|runtime/i.test(mode))) {
      errors.push(`sources.${sourceKey}.allowedImportModes must not allow runtime/API import.`);
    }
    if (
      !Array.isArray(source.allowedSnapshotHosts) ||
      source.allowedSnapshotHosts.length === 0 ||
      !Array.isArray(source.allowedSnapshotPathPrefixes) ||
      source.allowedSnapshotPathPrefixes.length === 0
    ) {
      errors.push(`sources.${sourceKey} requires source host and path allowlists.`);
    }
    if (
      !Number.isInteger(source.transformLimits?.maxArtifactBytes) ||
      source.transformLimits.maxArtifactBytes < 1 ||
      !Number.isInteger(source.transformLimits?.maxRecords) ||
      source.transformLimits.maxRecords < 1 ||
      !Number.isInteger(source.maxSnapshotAgeDays) ||
      source.maxSnapshotAgeDays < 1
    ) {
      errors.push(`sources.${sourceKey} requires positive transform/freshness bounds.`);
    }
    if (
      !Array.isArray(source.allowedFields) ||
      source.allowedFields.length === 0 ||
      new Set(source.allowedFields).size !== source.allowedFields.length
    ) {
      errors.push(`sources.${sourceKey}.allowedFields must be a non-empty unique list.`);
    }
    if (
      !source.requiredDeterminations ||
      Object.values(source.requiredDeterminations).some((value) => !safeText(value))
    ) {
      errors.push(`sources.${sourceKey}.requiredDeterminations is invalid.`);
    }
    if (
      !Array.isArray(source.forbiddenProductionArtifactSha256) ||
      source.forbiddenProductionArtifactSha256.length === 0 ||
      source.forbiddenProductionArtifactSha256.some((value) => !digest(value))
    ) {
      errors.push(`sources.${sourceKey} must deny known fixture hashes in production.`);
    }
    if (!Array.isArray(source.forbiddenProductionUses) || !source.attributionRequired) {
      errors.push(`sources.${sourceKey} requires forbidden uses and attribution.`);
    }
    validateExactInvariant(
      source,
      SOURCE_SECURITY_INVARIANTS[sourceKey],
      `sources.${sourceKey}`,
      errors,
    );
  }

  const obf = policy?.sources?.open_beauty_facts;
  if (obf?.licenses?.images?.allowed !== false) errors.push('OBF images must remain disabled.');
  if (obf?.sourceIsolationMode !== 'separate_source_component_pending_legal_classification') {
    errors.push('OBF source isolation must not predeclare derivative/collective classification.');
  }
  for (const use of ['runtime_api', 'product_images', 'automatic_contribution_back']) {
    if (!obf?.forbiddenProductionUses?.includes(use)) errors.push(`OBF must forbid ${use}.`);
  }
  for (const claim of ['approved', 'safe', 'recommended', 'pregnancy_safe']) {
    if (!policy?.sources?.cosing?.forbiddenClaims?.includes(claim)) {
      errors.push(`CosIng must forbid the ${claim} claim.`);
    }
  }
  return errors;
}

export function loadCatalogSourceTrustRegistry(
  root = process.cwd(),
  { trustedRoot = catalogTrustRootFromEnvironment() } = {},
) {
  const path = fixedRepoFile(
    root,
    CATALOG_SOURCE_TRUST_REGISTRY_PATH,
    'Catalog source trust registry',
  );
  const { bytes, value: registry } = readJson(path, 'Catalog source trust registry');
  const registrySha256 = sha256(bytes);
  const errors = validateCatalogSourceTrustRegistry(registry, {
    registrySha256,
    requireActive: false,
    trustedRoot,
  });
  if (errors.length > 0)
    throw new Error(`Invalid source trust registry:\n- ${errors.join('\n- ')}`);
  return { path, bytes, sha256: registrySha256, registry, trustedRoot };
}

export function validateCatalogSourceTrustRegistry(
  registry,
  { now = new Date(), registrySha256 = null, requireActive = false, trustedRoot = null } = {},
) {
  const errors = [];
  if (registry?.schemaVersion !== 1) errors.push('trust registry schemaVersion must be 1.');
  if (registry?.registryId !== 'catalog-source-trust-v1') {
    errors.push('trust registryId must be catalog-source-trust-v1.');
  }
  if (registry?.policyId !== 'catalog-source-policy-v1') {
    errors.push('trust registry policyId does not match.');
  }
  if (!Number.isSafeInteger(registry?.epoch) || registry.epoch < 0) {
    errors.push('trust registry epoch must be a non-negative integer.');
  }
  if (!['pending_external_reviewer_keys', 'active'].includes(registry?.status)) {
    errors.push('trust registry status is invalid.');
  }
  if (!Array.isArray(registry?.reviewers)) {
    errors.push('trust registry reviewers must be an array.');
  }
  const reviewers = Array.isArray(registry?.reviewers) ? registry.reviewers : [];
  const keyIds = new Set();
  const reviewerIds = new Set();
  const publicKeyFingerprints = new Set();
  for (const [index, reviewer] of reviewers.entries()) {
    const prefix = `trust registry reviewer ${index}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(reviewer?.keyId ?? '')) {
      errors.push(`${prefix} keyId is invalid.`);
    } else if (keyIds.has(reviewer.keyId)) {
      errors.push(`${prefix} keyId is duplicated.`);
    } else keyIds.add(reviewer.keyId);
    if (!/^[a-z0-9][a-z0-9._:-]{2,127}$/.test(reviewer?.reviewerId ?? '')) {
      errors.push(`${prefix} reviewerId is invalid.`);
    } else if (reviewerIds.has(reviewer.reviewerId)) {
      errors.push(`${prefix} reviewerId is duplicated.`);
    } else reviewerIds.add(reviewer.reviewerId);
    if (!/^[a-z0-9][a-z0-9._:-]{2,127}$/.test(reviewer?.independenceGroup ?? '')) {
      errors.push(`${prefix} independenceGroup is invalid.`);
    }
    if (!['legal', 'engineering'].includes(reviewer?.role)) {
      errors.push(`${prefix} role is invalid.`);
    }
    if (!['active', 'revoked'].includes(reviewer?.status)) {
      errors.push(`${prefix} status is invalid.`);
    }
    if (!safeText(reviewer?.name) || !safeText(reviewer?.qualification)) {
      errors.push(`${prefix} name/qualification is invalid.`);
    }
    if (!exactStringArray(reviewer?.jurisdictions, ['US'])) {
      errors.push(`${prefix} must be explicitly qualified for US Wave 1.`);
    }
    if (!validRfc3339Utc(reviewer?.validFrom) || !validRfc3339Utc(reviewer?.validUntil)) {
      errors.push(`${prefix} key validity must use strict UTC RFC3339 instants.`);
    } else if (
      reviewer.status === 'active' &&
      (Date.parse(reviewer.validFrom) > now.getTime() ||
        Date.parse(reviewer.validUntil) <= now.getTime())
    ) {
      errors.push(`${prefix} active key is not currently valid.`);
    }
    let publicKeyBytes = null;
    try {
      publicKeyBytes = ed25519PublicKeyFromBase64(
        reviewer?.publicKeySpkiBase64,
        `${prefix} public key`,
      ).bytes;
    } catch {
      errors.push(`${prefix} public key is not valid Ed25519 SPKI DER.`);
    }
    if (
      !digest(reviewer?.publicKeySha256) ||
      sha256(publicKeyBytes ?? '') !== reviewer?.publicKeySha256
    ) {
      errors.push(`${prefix} public-key fingerprint does not match.`);
    } else if (publicKeyFingerprints.has(reviewer.publicKeySha256)) {
      errors.push(`${prefix} public-key fingerprint is duplicated.`);
    } else {
      publicKeyFingerprints.add(reviewer.publicKeySha256);
    }
    if (!safeText(reviewer?.evidence?.recordId) || !digest(reviewer?.evidence?.sha256)) {
      errors.push(`${prefix} qualification evidence record/hash is invalid.`);
    }
    if (!parsePublicHttpsUrl(reviewer?.evidence?.uri)) {
      errors.push(`${prefix} qualification evidence URI is invalid.`);
    }
  }
  if (requireActive && registry?.status !== 'active') {
    errors.push('an active externally anchored trust registry is required.');
  }
  if (registry?.status === 'active') {
    if (
      !trustedRoot ||
      registry.epoch < 1 ||
      registry.epoch !== trustedRoot.registryEpoch ||
      !digest(registrySha256) ||
      registrySha256.toLowerCase() !== trustedRoot.registrySha256
    ) {
      errors.push('active trust registry does not match the externally pinned current epoch/hash.');
    }
    if (!validRfc3339Utc(registry?.updatedAt)) {
      errors.push('active trust registry updatedAt must be a strict UTC RFC3339 instant.');
    } else if (
      Date.parse(registry.updatedAt) > now.getTime() ||
      daysBetween(registry.updatedAt, now.toISOString()) > 366
    ) {
      errors.push('active trust registry is future-dated or older than 366 days.');
    }
    for (const role of ['legal', 'engineering']) {
      if (!reviewers.some((reviewer) => reviewer.role === role && reviewer.status === 'active')) {
        errors.push(`active trust registry requires an active ${role} key.`);
      }
    }
    const activeLegal = reviewers.filter(
      (reviewer) => reviewer.role === 'legal' && reviewer.status === 'active',
    );
    const activeEngineering = reviewers.filter(
      (reviewer) => reviewer.role === 'engineering' && reviewer.status === 'active',
    );
    for (const legal of activeLegal) {
      for (const engineering of activeEngineering) {
        if (legal.reviewerId === engineering.reviewerId) {
          errors.push('legal and engineering trust roles require distinct reviewer identities.');
        }
        if (legal.independenceGroup === engineering.independenceGroup) {
          errors.push('legal and engineering trust roles require independent reviewer groups.');
        }
        if (legal.publicKeySha256 === engineering.publicKeySha256) {
          errors.push('legal and engineering trust roles require distinct public keys.');
        }
        if (legal.name.toLocaleLowerCase('en-US') === engineering.name.toLocaleLowerCase('en-US')) {
          errors.push('legal and engineering trust roles require distinct named reviewers.');
        }
      }
    }

    const rootSignature = registry?.rootSignature;
    if (!trustedRoot) {
      errors.push('active trust registry requires an externally supplied trust-root public key.');
    } else {
      let rootKey = null;
      let rootKeyBytes = null;
      try {
        ({ key: rootKey, bytes: rootKeyBytes } = ed25519PublicKeyFromBase64(
          trustedRoot.publicKeySpkiBase64,
          'external trust-root public key',
        ));
      } catch {
        errors.push('external trust-root public key is not valid Ed25519 SPKI DER.');
      }
      if (
        !safeText(trustedRoot.keyId) ||
        rootSignature?.envelopeVersion !== TRUST_REGISTRY_SIGNATURE_ENVELOPE ||
        rootSignature?.algorithm !== 'Ed25519' ||
        rootSignature?.keyId !== trustedRoot.keyId ||
        rootSignature?.publicKeySha256 !== sha256(rootKeyBytes ?? '') ||
        rootSignature?.signedAt !== registry.updatedAt
      ) {
        errors.push('trust-registry root signature metadata does not match the external root.');
      }
      let signatureBytes = null;
      try {
        signatureBytes = decodeCanonicalBase64(
          rootSignature?.valueBase64,
          'trust-registry root signature',
        );
        if (signatureBytes.length !== 64) throw new Error('invalid Ed25519 signature length');
      } catch {
        errors.push('trust-registry root signature is not canonical Ed25519 signature bytes.');
      }
      if (
        rootKey &&
        signatureBytes &&
        !verifyCryptographicSignature(
          null,
          trustRegistrySigningPayload(registry),
          rootKey,
          signatureBytes,
        )
      ) {
        errors.push('trust-registry root signature is invalid.');
      }
    }
  } else if (reviewers.length > 0) {
    errors.push('pending trust registry must not carry reviewer keys.');
  } else if (registry?.rootSignature !== null) {
    errors.push('pending trust registry must not carry a root signature.');
  }
  if (registry?.status !== 'active' && registry?.updatedAt !== null) {
    errors.push('pending trust registry updatedAt must be null.');
  }
  if (registry?.status !== 'active' && registry?.epoch !== 0) {
    errors.push('pending trust registry epoch must be 0.');
  }
  return [...new Set(errors)];
}

export function loadCatalogReleaseScope(root = process.cwd()) {
  const path = fixedRepoFile(root, CATALOG_RELEASE_SCOPE_PATH, 'Catalog release scope');
  const { bytes, value: scope } = readJson(path, 'Catalog release scope');
  const policy = loadCatalogSourcePolicy(root).policy;
  const errors = validateCatalogReleaseScope(scope, { policy, requireApproved: false });
  if (errors.length > 0)
    throw new Error(`Invalid catalog release scope:\n- ${errors.join('\n- ')}`);
  return { path, bytes, sha256: sha256(bytes), scope };
}

function validateEvidenceRecord(record, label, errors) {
  if (!safeText(record?.recordId) || !digest(record?.sha256) || !parsePublicHttpsUrl(record?.uri)) {
    errors.push(`${label} evidence record/URI/hash is invalid.`);
  }
}

export function validateCatalogReleaseScope(
  scope,
  { policy, requireApproved = true, now = new Date() },
) {
  const errors = [];
  if (scope?.schemaVersion !== 1 || scope?.scopeId !== 'catalog-release-scope-v1') {
    errors.push('release scope identity/schema is invalid.');
  }
  if (!exactStringArray(scope?.territories, policy.globalControls.permittedLaunchTerritories)) {
    errors.push('release scope territories must exactly match the policy US-only Wave 1 scope.');
  }
  if (!requireApproved && scope?.status === 'pending_external_identity_and_territory_approval') {
    if (scope.appIdentity !== null || scope.attribution !== null) {
      errors.push('pending release scope must not assert an app identity or attribution surface.');
    }
    return errors;
  }
  if (scope?.status !== 'approved') errors.push('release scope is not externally approved.');
  const identity = scope?.appIdentity;
  if (!safeText(identity?.displayName, { max: 100 }))
    errors.push('release displayName is invalid.');
  if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+){2,}$/.test(identity?.bundleId ?? '')) {
    errors.push('release bundleId is invalid.');
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(identity?.version ?? '')) {
    errors.push('release version is invalid.');
  }
  if (!IOS_BUILD_NUMBER_PATTERN.test(identity?.build ?? '')) {
    errors.push('release build must be the reviewed 1-18 digit positive decimal string.');
  }
  const publicUrl = parsePublicHttpsUrl(scope?.attribution?.publicUrl);
  if (!publicUrl || publicUrl.hostname !== identity?.publicHost) {
    errors.push('release attribution URL must use the exact approved publicHost.');
  }
  const supportEmail = identity?.supportEmail ?? '';
  const supportHost = supportEmail.includes('@')
    ? supportEmail.slice(supportEmail.lastIndexOf('@') + 1)
    : '';
  if (
    !safeText(supportEmail, { min: 6, max: 254 }) ||
    !SUPPORT_EMAIL_PATTERN.test(supportEmail) ||
    RESERVED_HOST_PATTERN.test(supportHost) ||
    PLACEHOLDER_PATTERN.test(supportHost)
  ) {
    errors.push('release supportEmail is invalid.');
  }
  if (!validRfc3339Utc(scope?.approvedAt) || !validRfc3339Utc(scope?.expiresAt)) {
    errors.push('release approval dates must use strict UTC RFC3339 instants.');
  } else {
    if (Date.parse(scope.expiresAt) <= now.getTime()) errors.push('release scope is expired.');
    if (Date.parse(scope.approvedAt) > now.getTime()) errors.push('release scope is future-dated.');
    if (Date.parse(scope.expiresAt) <= Date.parse(scope.approvedAt)) {
      errors.push('release scope expiresAt must follow approvedAt.');
    }
  }
  for (const key of ['identity', 'territory', 'attributionSurface']) {
    validateEvidenceRecord(scope?.evidence?.[key], `release ${key}`, errors);
  }
  return errors;
}

export function loadCatalogReleaseBuildEvidence(
  root = process.cwd(),
  {
    releaseScope = null,
    releaseScopeSha256 = null,
    requireVerified = false,
    trustRegistry = null,
    trustRegistrySha256 = null,
    now = new Date(),
  } = {},
) {
  const path = fixedRepoFile(
    root,
    CATALOG_RELEASE_BUILD_EVIDENCE_PATH,
    'Catalog release build evidence',
  );
  const { bytes, value: evidence } = readJson(path, 'Catalog release build evidence');
  const errors = validateCatalogReleaseBuildEvidence(evidence, {
    releaseScope,
    releaseScopeSha256,
    requireVerified,
    trustRegistry,
    trustRegistrySha256,
    now,
  });
  if (errors.length > 0) {
    throw new Error(`Invalid catalog release build evidence:\n- ${errors.join('\n- ')}`);
  }
  return { path, bytes, sha256: sha256(bytes), evidence };
}

export function validateCatalogReleaseBuildEvidence(
  buildEvidence,
  {
    releaseScope = null,
    releaseScopeSha256 = null,
    requireVerified = true,
    trustRegistry = null,
    trustRegistrySha256 = null,
    now = new Date(),
  } = {},
) {
  const errors = [];
  if (
    !exactObjectKeys(buildEvidence, [
      'schemaVersion',
      'evidenceId',
      'status',
      'releaseScope',
      'trustRegistry',
      'easBuild',
      'archive',
      'territories',
      'appStoreRelease',
      'evidence',
      'verifiedAt',
      'verifier',
      'signature',
    ]) ||
    !exactObjectKeys(buildEvidence?.evidence, [
      'resolvedExpoConfig',
      'easBuildMetadata',
      'archiveInspection',
      'appStoreRelease',
    ])
  ) {
    errors.push('release build evidence contains missing or unsupported fields.');
  }
  if (
    buildEvidence?.schemaVersion !== 1 ||
    buildEvidence?.evidenceId !== 'catalog-release-build-evidence-v1'
  ) {
    errors.push('release build evidence identity/schema is invalid.');
  }
  if (!exactStringArray(buildEvidence?.territories, ['US'])) {
    errors.push('release build evidence territories must remain exactly US-only.');
  }
  if (buildEvidence?.status === 'pending_eas_archive_and_app_store_evidence') {
    for (const key of [
      'releaseScope',
      'trustRegistry',
      'easBuild',
      'archive',
      'appStoreRelease',
      'verifiedAt',
      'verifier',
      'signature',
    ]) {
      if (buildEvidence?.[key] !== null) {
        errors.push(`pending release build evidence ${key} must be null.`);
      }
    }
    for (const key of [
      'resolvedExpoConfig',
      'easBuildMetadata',
      'archiveInspection',
      'appStoreRelease',
    ]) {
      if (buildEvidence?.evidence?.[key] !== null) {
        errors.push(`pending release build evidence evidence.${key} must be null.`);
      }
    }
    if (requireVerified) errors.push('release build evidence is not verified.');
    return errors;
  }
  if (buildEvidence?.status !== 'verified') {
    return [...errors, 'release build evidence status is invalid.'];
  }
  for (const [value, keys, label] of [
    [buildEvidence.releaseScope, ['scopeId', 'sha256'], 'releaseScope'],
    [buildEvidence.trustRegistry, ['registryId', 'epoch', 'sha256'], 'trustRegistry'],
    [
      buildEvidence.easBuild,
      ['buildId', 'profile', 'platform', 'gitCommitSha', 'resolvedExpoConfigSha256'],
      'easBuild',
    ],
    [
      buildEvidence.archive,
      ['bundleId', 'shortVersion', 'buildNumber', 'ipaSha256', 'infoPlistSha256', 'inspectedAt'],
      'archive',
    ],
    [
      buildEvidence.appStoreRelease,
      ['appId', 'bundleId', 'version', 'buildNumber', 'territories', 'observedAt'],
      'appStoreRelease',
    ],
    [buildEvidence.verifier, ['keyId', 'reviewerId', 'publicKeySha256'], 'verifier'],
    [
      buildEvidence.signature,
      ['envelopeVersion', 'algorithm', 'keyId', 'valueBase64'],
      'signature',
    ],
  ]) {
    if (!exactObjectKeys(value, keys)) {
      errors.push(`release build evidence ${label} contains missing or unsupported fields.`);
    }
  }
  for (const key of [
    'resolvedExpoConfig',
    'easBuildMetadata',
    'archiveInspection',
    'appStoreRelease',
  ]) {
    if (!exactObjectKeys(buildEvidence?.evidence?.[key], ['recordId', 'uri', 'sha256'])) {
      errors.push(`release build evidence evidence.${key} has an unsupported record shape.`);
    }
  }
  if (
    buildEvidence?.releaseScope?.scopeId !== releaseScope?.scopeId ||
    buildEvidence?.releaseScope?.sha256 !== releaseScopeSha256
  ) {
    errors.push('release build evidence does not match the fixed release scope.');
  }
  if (
    buildEvidence?.trustRegistry?.registryId !== trustRegistry?.registryId ||
    buildEvidence?.trustRegistry?.epoch !== trustRegistry?.epoch ||
    buildEvidence?.trustRegistry?.sha256 !== trustRegistrySha256
  ) {
    errors.push('release build evidence does not match the current trust registry.');
  }
  const eas = buildEvidence?.easBuild;
  if (
    !EAS_BUILD_UUID_PATTERN.test(eas?.buildId ?? '') ||
    eas?.profile !== 'production' ||
    eas?.platform !== 'ios' ||
    !GIT_COMMIT_SHA_PATTERN.test(eas?.gitCommitSha ?? '') ||
    !digest(eas?.resolvedExpoConfigSha256)
  ) {
    errors.push('release build evidence EAS metadata is invalid.');
  }
  const archive = buildEvidence?.archive;
  if (
    archive?.bundleId !== releaseScope?.appIdentity?.bundleId ||
    archive?.shortVersion !== releaseScope?.appIdentity?.version ||
    archive?.buildNumber !== releaseScope?.appIdentity?.build ||
    !IOS_BUILD_NUMBER_PATTERN.test(archive?.buildNumber ?? '') ||
    !digest(archive?.ipaSha256) ||
    !digest(archive?.infoPlistSha256) ||
    !validRfc3339Utc(archive?.inspectedAt)
  ) {
    errors.push('release build evidence archive identity/hash inspection is invalid.');
  }
  const appStore = buildEvidence?.appStoreRelease;
  if (
    !APP_STORE_ID_PATTERN.test(appStore?.appId ?? '') ||
    appStore?.bundleId !== releaseScope?.appIdentity?.bundleId ||
    appStore?.bundleId !== archive?.bundleId ||
    appStore?.version !== releaseScope?.appIdentity?.version ||
    appStore?.version !== archive?.shortVersion ||
    appStore?.buildNumber !== releaseScope?.appIdentity?.build ||
    appStore?.buildNumber !== archive?.buildNumber ||
    !IOS_BUILD_NUMBER_PATTERN.test(appStore?.buildNumber ?? '') ||
    !exactStringArray(appStore?.territories, releaseScope?.territories ?? []) ||
    !validRfc3339Utc(appStore?.observedAt) ||
    !validRfc3339Utc(buildEvidence?.verifiedAt) ||
    Date.parse(archive?.inspectedAt ?? 0) > now.getTime() ||
    Date.parse(appStore?.observedAt ?? 0) > now.getTime() ||
    Date.parse(buildEvidence?.verifiedAt ?? 0) > now.getTime() ||
    Date.parse(buildEvidence?.verifiedAt ?? 0) < Date.parse(archive?.inspectedAt ?? 0) ||
    Date.parse(appStore?.observedAt ?? 0) < Date.parse(archive?.inspectedAt ?? 0) ||
    Date.parse(buildEvidence?.verifiedAt ?? 0) < Date.parse(appStore?.observedAt ?? 0) ||
    daysBetween(buildEvidence?.verifiedAt, now.toISOString()) > 31
  ) {
    errors.push('release build/App Store verification timestamp or app identity is invalid.');
  }
  if (
    (validRfc3339Utc(releaseScope?.approvedAt) &&
      (Date.parse(archive?.inspectedAt ?? 0) < Date.parse(releaseScope.approvedAt) ||
        Date.parse(appStore?.observedAt ?? 0) < Date.parse(releaseScope.approvedAt) ||
        Date.parse(buildEvidence?.verifiedAt ?? 0) < Date.parse(releaseScope.approvedAt))) ||
    (validRfc3339Utc(trustRegistry?.updatedAt) &&
      (Date.parse(archive?.inspectedAt ?? 0) < Date.parse(trustRegistry.updatedAt) ||
        Date.parse(appStore?.observedAt ?? 0) < Date.parse(trustRegistry.updatedAt) ||
        Date.parse(buildEvidence?.verifiedAt ?? 0) < Date.parse(trustRegistry.updatedAt)))
  ) {
    errors.push(
      'release build/archive/App Store evidence predates its release-scope or trust-registry authority.',
    );
  }
  for (const key of [
    'resolvedExpoConfig',
    'easBuildMetadata',
    'archiveInspection',
    'appStoreRelease',
  ]) {
    validateEvidenceRecord(buildEvidence?.evidence?.[key], `release build ${key}`, errors);
  }
  const signature = buildEvidence?.signature;
  const reviewer = trustRegistry?.reviewers?.find((entry) => entry.keyId === signature?.keyId);
  if (
    signature?.envelopeVersion !== RELEASE_BUILD_EVIDENCE_SIGNATURE_ENVELOPE ||
    signature?.algorithm !== 'Ed25519' ||
    !reviewer ||
    reviewer.role !== 'engineering' ||
    reviewer.status !== 'active' ||
    buildEvidence?.verifier?.keyId !== reviewer.keyId ||
    buildEvidence?.verifier?.reviewerId !== reviewer.reviewerId ||
    buildEvidence?.verifier?.publicKeySha256 !== reviewer.publicKeySha256 ||
    Date.parse(buildEvidence?.verifiedAt ?? 0) < Date.parse(reviewer?.validFrom ?? 0) ||
    Date.parse(buildEvidence?.verifiedAt ?? 0) > Date.parse(reviewer?.validUntil ?? 0)
  ) {
    errors.push('release build evidence verifier/signature metadata is invalid.');
  } else {
    try {
      const key = ed25519PublicKeyFromBase64(
        reviewer.publicKeySpkiBase64,
        'release build evidence verifier key',
      ).key;
      const signatureBytes = decodeCanonicalBase64(
        signature.valueBase64,
        'release build evidence signature',
      );
      if (
        signatureBytes.length !== 64 ||
        !verifyCryptographicSignature(
          null,
          releaseBuildEvidenceSigningPayload(buildEvidence),
          key,
          signatureBytes,
        )
      ) {
        errors.push('release build evidence signature is invalid.');
      }
    } catch {
      errors.push('release build evidence signature is invalid.');
    }
  }
  return [...new Set(errors)];
}

export function catalogReleaseIdentityFromRepository(
  root = process.cwd(),
  env = process.env,
  { includeEvidence = false, resolvedExpoConfig = null } = {},
) {
  const realRoot = canonicalWorkspaceRoot(root);
  const appBase = readJson(
    fixedRepoFile(realRoot, 'apps/mobile/app.base.json', 'Expo app base config'),
    'Expo app base config',
  ).value;
  const mobilePackage = readJson(
    fixedRepoFile(realRoot, 'apps/mobile/package.json', 'Mobile package manifest'),
    'Mobile package manifest',
  ).value;
  if (!safeText(appBase?.expo?.version) || appBase.expo.version !== mobilePackage?.version) {
    throw new Error('Expo and mobile package release versions must match exactly.');
  }
  if (env.APP_VARIANT !== 'production' || env.EXPO_PUBLIC_APP_ENV !== 'production') {
    throw new Error('Catalog production approval requires the production Expo/EAS variant.');
  }
  if (
    env.EAS_BUILD_PROFILE !== 'production' ||
    env.EAS_BUILD_PLATFORM !== 'ios' ||
    !EAS_BUILD_UUID_PATTERN.test(env.EAS_BUILD_ID ?? '') ||
    !GIT_COMMIT_SHA_PATTERN.test(env.EAS_BUILD_GIT_COMMIT_HASH ?? '')
  ) {
    throw new Error(
      'Catalog production approval requires exact EAS iOS production build ID/profile/commit metadata.',
    );
  }
  assertCatalogBuildSourceCommit(realRoot, env.EAS_BUILD_GIT_COMMIT_HASH);
  let resolvedExpo = resolvedExpoConfig;
  if (!resolvedExpo) {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        "const factory=require('./apps/mobile/app.config.js'); const value=factory(); process.stdout.write(JSON.stringify(value.expo));",
      ],
      { cwd: realRoot, encoding: 'utf8', env: { ...process.env, ...env } },
    );
    if (result.status !== 0) {
      throw new Error(
        `Resolved production Expo config failed: ${(result.stderr || result.stdout).trim()}`,
      );
    }
    resolvedExpo = parseCatalogControlJson(
      Buffer.from(result.stdout),
      'Resolved production Expo config',
    );
  }
  const publicHost = normalizePublicHttpsHost(env.EXPO_PUBLIC_FINAL_BRAND_DOMAIN);
  const identity = {
    displayName: env.APP_DISPLAY_NAME ?? env.EXPO_PUBLIC_APP_DISPLAY_NAME,
    bundleId: env.APP_IOS_BUNDLE_IDENTIFIER,
    version: appBase.expo.version,
    build: env.CATALOG_RELEASE_IOS_BUILD_NUMBER,
    publicHost,
    supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL,
  };
  if (
    env.CATALOG_RELEASE_TERRITORIES !== 'US' ||
    !safeText(identity.displayName, { max: 100 }) ||
    !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+){2,}$/.test(identity.bundleId ?? '') ||
    !IOS_BUILD_NUMBER_PATTERN.test(identity.build ?? '') ||
    !identity.publicHost ||
    !SUPPORT_EMAIL_PATTERN.test(identity.supportEmail ?? '') ||
    resolvedExpo?.name !== identity.displayName ||
    resolvedExpo?.ios?.bundleIdentifier !== identity.bundleId ||
    resolvedExpo?.version !== identity.version ||
    resolvedExpo?.extra?.appVariant !== 'production' ||
    resolvedExpo?.extra?.appEnvironment !== 'production' ||
    resolvedExpo?.extra?.publicLinkDomain !== identity.publicHost ||
    resolvedExpo?.extra?.supportEmail !== identity.supportEmail ||
    String(resolvedExpo?.ios?.buildNumber ?? '') !== identity.build
  ) {
    throw new Error(
      'Resolved production Expo config/territory does not match the exact catalog release identity.',
    );
  }
  if (includeEvidence) {
    const easBuild = {
      buildId: env.EAS_BUILD_ID,
      profile: env.EAS_BUILD_PROFILE,
      platform: env.EAS_BUILD_PLATFORM,
      gitCommitSha: env.EAS_BUILD_GIT_COMMIT_HASH,
      resolvedExpoConfigSha256: sha256(Buffer.from(canonicalJson(resolvedExpo), 'utf8')),
    };
    return {
      identity,
      easBuild,
      resolvedExpoConfigSha256: easBuild.resolvedExpoConfigSha256,
    };
  }
  return identity;
}

function compareApprovalScope(approvalScope, releaseScope, source, errors) {
  if (
    canonicalJson(approvalScope?.appIdentity ?? null) !==
    canonicalJson(releaseScope?.appIdentity ?? null)
  ) {
    errors.push('approval app identity does not exactly match the fixed release scope.');
  }
  if (!exactStringArray(approvalScope?.territories, releaseScope?.territories ?? [])) {
    errors.push('approval territories do not exactly match the fixed release scope.');
  }
  if (!exactStringArray(approvalScope?.fields, source.allowedFields)) {
    errors.push('approval fields must exactly match the policy-approved source projection.');
  }
}

function verifyReviewerSignature({ approval, registry, reviewerType, reviewedAt, errors }) {
  const signature = approval?.signatures?.[reviewerType];
  if (signature?.algorithm !== 'Ed25519') {
    errors.push(`approval ${reviewerType} signature algorithm must be Ed25519.`);
    return null;
  }
  const reviewer = registry?.reviewers?.find((entry) => entry.keyId === signature?.keyId);
  if (!reviewer || reviewer.role !== reviewerType || reviewer.status !== 'active') {
    errors.push(
      `approval ${reviewerType} signature key is not an active trusted ${reviewerType} key.`,
    );
    return null;
  }
  if (
    !validRfc3339Utc(reviewedAt) ||
    Date.parse(reviewedAt) < Date.parse(reviewer.validFrom) ||
    Date.parse(reviewedAt) > Date.parse(reviewer.validUntil)
  ) {
    errors.push(`approval ${reviewerType} key was not valid at review time.`);
  }
  let verified = false;
  try {
    const publicKey = ed25519PublicKeyFromBase64(
      reviewer.publicKeySpkiBase64,
      `approval ${reviewerType} public key`,
    ).key;
    const signatureBytes = decodeCanonicalBase64(
      signature?.valueBase64,
      `approval ${reviewerType} signature`,
    );
    if (signatureBytes.length !== 64) throw new Error('invalid Ed25519 signature length');
    verified = verifyCryptographicSignature(
      null,
      approvalSigningPayload(approval),
      publicKey,
      signatureBytes,
    );
  } catch {
    verified = false;
  }
  if (!verified) errors.push(`approval ${reviewerType} signature is invalid.`);
  return reviewer;
}

export function validateProductionApproval({
  approval,
  artifactSha256,
  artifactBytes,
  policy,
  policySha256,
  releaseScope,
  releaseRuntimeIdentity,
  releaseScopeSha256,
  sourceKey,
  transformer,
  transformedPayloadSha256,
  trustRegistry,
  trustRegistrySha256,
  trustRoot = null,
  now = new Date(),
}) {
  const errors = [];
  const source = policy?.sources?.[sourceKey];
  if (!source) return [`Unknown source key ${sourceKey}.`];
  errors.push(...validateCatalogReleaseScope(releaseScope, { policy, requireApproved: true, now }));
  if (
    canonicalJson(releaseRuntimeIdentity ?? null) !==
    canonicalJson(releaseScope?.appIdentity ?? null)
  ) {
    errors.push('current Expo/EAS release identity does not match the fixed release scope.');
  }
  errors.push(
    ...validateCatalogSourceTrustRegistry(trustRegistry, {
      now,
      registrySha256: trustRegistrySha256,
      requireActive: true,
      trustedRoot: trustRoot,
    }),
  );
  if (trustRegistry?.status !== 'active') {
    errors.push('catalog source trust registry is not active.');
  }

  if (
    approval?.schemaVersion !== 1 ||
    approval?.signatureEnvelopeVersion !== APPROVAL_SIGNATURE_ENVELOPE
  ) {
    errors.push('approval schema/signature envelope is invalid.');
  }
  if (approval?.policyId !== policy.policyId || approval?.policySha256 !== policySha256) {
    errors.push('approval policy identity/hash does not match current policy bytes.');
  }
  if (
    approval?.trustRegistry?.registryId !== trustRegistry?.registryId ||
    approval?.trustRegistry?.sha256 !== trustRegistrySha256
  ) {
    errors.push('approval trust-registry identity/hash does not match current registry bytes.');
  }
  if (
    approval?.releaseScope?.scopeId !== releaseScope?.scopeId ||
    approval?.releaseScope?.sha256 !== releaseScopeSha256
  ) {
    errors.push('approval release-scope identity/hash does not match current scope bytes.');
  }
  if (canonicalJson(approval?.transformer ?? null) !== canonicalJson(transformer ?? null)) {
    errors.push('approval is not bound to the exact current transformer/parser bytes.');
  }
  if (approval?.sourceKey !== sourceKey || approval?.decision !== 'approved') {
    errors.push('approval source/decision is invalid.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,200}$/.test(approval?.reviewId ?? '')) {
    errors.push('approval reviewId is invalid.');
  }
  validateEvidenceRecord(approval?.decisionEvidence, 'approval decision', errors);

  if (!validRfc3339Utc(approval?.reviewedAt) || !validRfc3339Utc(approval?.expiresAt)) {
    errors.push('approval dates must use strict UTC RFC3339 instants.');
  } else {
    if (Date.parse(approval.reviewedAt) > now.getTime()) errors.push('approval is future-dated.');
    if (Date.parse(approval.expiresAt) <= now.getTime()) errors.push('approval is expired.');
    const validity = daysBetween(approval.reviewedAt, approval.expiresAt);
    if (validity <= 0 || validity > policy.globalControls.approvalMaxValidityDays) {
      errors.push('approval validity exceeds the policy maximum.');
    }
  }

  const artifact = approval?.artifact;
  if (
    !digest(artifact?.sha256) ||
    artifact.sha256.toLowerCase() !== artifactSha256?.toLowerCase()
  ) {
    errors.push('approval artifact SHA-256 does not match the exact input bytes.');
  }
  if (source.forbiddenProductionArtifactSha256.includes(artifactSha256?.toLowerCase())) {
    errors.push('known fixture bytes can never be authorized for production.');
  }
  if (!Number.isInteger(artifact?.bytes) || artifact.bytes !== artifactBytes) {
    errors.push('approval artifact byte count does not match the exact input bytes.');
  }
  if (!validIsoDate(artifact?.snapshotDate)) {
    errors.push('approval artifact snapshotDate must be YYYY-MM-DD.');
  } else if (validRfc3339Utc(approval?.reviewedAt)) {
    const snapshotInstant = `${artifact.snapshotDate}T00:00:00.000Z`;
    const reviewAge = daysBetween(snapshotInstant, approval.reviewedAt);
    const importAge = daysBetween(snapshotInstant, now.toISOString());
    if (
      reviewAge < 0 ||
      reviewAge > source.maxSnapshotAgeDays ||
      importAge < 0 ||
      importAge > source.maxSnapshotAgeDays
    ) {
      errors.push('approval artifact snapshot is future-dated or too stale for this source.');
    }
  }
  if (!allowedSourceUrl(artifact?.sourceUrl, source)) {
    errors.push('approval artifact sourceUrl is not an approved source export/snapshot path.');
  }
  for (const key of ['upstreamSha256', 'acquisitionEvidenceSha256']) {
    if (!digest(artifact?.[key])) errors.push(`approval artifact.${key} must be SHA-256.`);
  }
  if (
    artifact?.transformationRecordContractId !== CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.contractId
  ) {
    errors.push('approval transformed-payload contract is missing or unsupported.');
  }
  if (
    !digest(artifact?.transformationRecordSha256) ||
    artifact.transformationRecordSha256 !== transformedPayloadSha256
  ) {
    errors.push(
      'approval transformationRecordSha256 does not match the exact transformed payload.',
    );
  }
  if (!parsePublicHttpsUrl(artifact?.acquisitionEvidenceUri)) {
    errors.push('approval artifact acquisitionEvidenceUri is invalid.');
  }

  const termsSnapshot = approval?.termsSnapshot;
  if (
    !validRfc3339Utc(termsSnapshot?.capturedAt) ||
    !exactStringArray(termsSnapshot?.sourceUrls, source.requiredTermsUrls)
  ) {
    errors.push('approval terms snapshot timestamp/source URLs are incomplete or stale.');
  } else if (
    validRfc3339Utc(approval?.reviewedAt) &&
    (Date.parse(termsSnapshot.capturedAt) > Date.parse(approval.reviewedAt) ||
      daysBetween(termsSnapshot.capturedAt, now.toISOString()) > 366)
  ) {
    errors.push('approval terms snapshot chronology is invalid.');
  }
  validateEvidenceRecord(termsSnapshot?.evidence, 'approval terms snapshot', errors);

  const publicUrl = parsePublicHttpsUrl(approval?.attribution?.publicUrl);
  const releasePublicUrl = parsePublicHttpsUrl(releaseScope?.attribution?.publicUrl);
  if (!publicUrl || publicUrl.href !== releasePublicUrl?.href) {
    errors.push('approval attribution URL does not match the fixed release scope.');
  }
  if (
    approval?.attribution?.copyApproved !== true ||
    !safeText(approval?.attribution?.noticeLocale) ||
    !safeText(approval?.attribution?.noticeText, { min: 20, max: 2000 }) ||
    sha256(approval?.attribution?.noticeText ?? '') !== approval?.attribution?.noticeSha256 ||
    !digest(approval?.attribution?.publicSurfaceArtifactSha256) ||
    !parsePublicHttpsUrl(approval?.attribution?.publicSurfaceEvidenceUri) ||
    approval?.attribution?.sourceDatabaseUrl !== source.sourceUrl
  ) {
    errors.push('approval attribution notice/surface/source binding is incomplete or invalid.');
  }
  compareApprovalScope(approval?.scope, releaseScope, source, errors);

  for (const [key, expected] of Object.entries(source.requiredDeterminations ?? {})) {
    if (approval?.determinations?.[key] !== expected) {
      errors.push(`approval determinations.${key} must equal ${JSON.stringify(expected)}.`);
    }
  }
  if (sourceKey === 'open_beauty_facts') {
    const classification = approval?.determinations?.databaseClassification;
    const implementation = approval?.determinations?.shareAlikeImplementation;
    if (!source.databaseClassificationOptions.includes(classification)) {
      errors.push('approval OBF database classification is missing/invalid.');
    }
    if (!source.shareAlikeImplementationOptions.includes(implementation)) {
      errors.push('approval OBF share-alike implementation is missing/invalid.');
    }
    const expectedImplementation =
      classification === 'derivative_database'
        ? 'entire_derivative_or_alterations_machine_readable'
        : 'source_component_unmodified_separate_and_machine_readable';
    if (implementation !== expectedImplementation) {
      errors.push('approval OBF classification/share-alike implementation pair is inconsistent.');
    }
    if (
      classification !== 'derivative_database' ||
      implementation !== 'entire_derivative_or_alterations_machine_readable'
    ) {
      errors.push(
        'current OBF filtering/normalization transformer requires the conservative derivative-database delivery path.',
      );
    }
    if (
      approval?.attribution?.machineReadableDelivery?.status !==
        'deployed_before_production_promotion' ||
      !parsePublicHttpsUrl(approval?.attribution?.machineReadableDelivery?.publicUrl) ||
      parsePublicHttpsUrl(approval?.attribution?.machineReadableDelivery?.publicUrl)?.hostname !==
        releaseScope?.appIdentity?.publicHost ||
      !safeText(approval?.attribution?.machineReadableDelivery?.owner) ||
      !digest(approval?.attribution?.machineReadableDelivery?.artifactSha256)
    ) {
      errors.push('approval OBF machine-readable delivery plan is incomplete.');
    }
    validateEvidenceRecord(
      approval?.attribution?.machineReadableDelivery?.evidence,
      'approval OBF machine-readable delivery',
      errors,
    );
  }

  for (const key of ['sourceObligationOwner', 'correctionOwner']) {
    if (!safeText(approval?.operations?.[key]))
      errors.push(`approval operations.${key} is invalid.`);
  }
  if (
    !Number.isInteger(approval?.operations?.correctionSlaDays) ||
    approval.operations.correctionSlaDays < 1 ||
    approval.operations.correctionSlaDays > 30
  ) {
    errors.push('approval correction SLA must be 1..30 days.');
  }
  for (const key of ['sourceObligationEvidence', 'correctionRunbookEvidence']) {
    validateEvidenceRecord(approval?.operations?.[key], `approval operations ${key}`, errors);
  }

  const expectedControls = {
    offlineImportOnly: true,
    imagesIncluded: false,
    runtimeRequests: false,
    contributionBack: false,
    databaseComponentId: source.componentId,
  };
  for (const [key, expected] of Object.entries(expectedControls)) {
    if (approval?.controls?.[key] !== expected) {
      errors.push(`approval controls.${key} must equal ${JSON.stringify(expected)}.`);
    }
  }
  if (!exactStringArray(approval?.allowedUses, source.requiredProductionUses)) {
    errors.push('approval allowedUses must exactly match policy.');
  }
  const forbidden = new Set(approval?.forbiddenUses ?? []);
  for (const use of source.forbiddenProductionUses) {
    if (!forbidden.has(use)) errors.push(`approval forbiddenUses must include ${use}.`);
  }
  for (const use of approval?.allowedUses ?? []) {
    if (forbidden.has(use)) errors.push(`approval cannot both allow and forbid ${use}.`);
  }

  const legal = verifyReviewerSignature({
    approval,
    registry: trustRegistry,
    reviewerType: 'legal',
    reviewedAt: approval?.reviewedAt,
    errors,
  });
  const engineering = verifyReviewerSignature({
    approval,
    registry: trustRegistry,
    reviewerType: 'engineering',
    reviewedAt: approval?.reviewedAt,
    errors,
  });
  if (
    legal &&
    engineering &&
    (legal.keyId === engineering.keyId ||
      legal.publicKeySha256 === engineering.publicKeySha256 ||
      legal.reviewerId === engineering.reviewerId ||
      legal.independenceGroup === engineering.independenceGroup)
  ) {
    errors.push('legal and engineering approvals require distinct people, groups, and keys.');
  }
  for (const [type, reviewer] of [
    ['legal', legal],
    ['engineering', engineering],
  ]) {
    const reviewerSnapshot = approval?.reviewers?.[type];
    if (
      reviewerSnapshot?.keyId !== reviewer?.keyId ||
      reviewerSnapshot?.reviewerId !== reviewer?.reviewerId ||
      reviewerSnapshot?.independenceGroup !== reviewer?.independenceGroup ||
      reviewerSnapshot?.publicKeySha256 !== reviewer?.publicKeySha256 ||
      reviewerSnapshot?.name !== reviewer?.name ||
      reviewerSnapshot?.qualification !== reviewer?.qualification ||
      !validRfc3339Utc(reviewerSnapshot?.approvedAt)
    ) {
      errors.push(`approval ${type} reviewer snapshot does not match its trusted registry key.`);
    } else if (
      !reviewer ||
      Date.parse(reviewerSnapshot.approvedAt) < Date.parse(reviewer.validFrom) ||
      Date.parse(reviewerSnapshot.approvedAt) > Date.parse(reviewer.validUntil) ||
      Date.parse(reviewerSnapshot.approvedAt) > Date.parse(approval?.reviewedAt ?? 0) ||
      daysBetween(reviewerSnapshot.approvedAt, approval?.reviewedAt) > 1
    ) {
      errors.push(`approval ${type} reviewer chronology is invalid.`);
    }
    if (
      reviewer &&
      validRfc3339Utc(approval?.expiresAt) &&
      Date.parse(approval.expiresAt) > Date.parse(reviewer.validUntil)
    ) {
      errors.push(`approval expiry exceeds the ${type} reviewer key validity.`);
    }
  }
  if (validRfc3339Utc(approval?.reviewedAt)) {
    if (
      validRfc3339Utc(trustRegistry?.updatedAt) &&
      Date.parse(approval.reviewedAt) < Date.parse(trustRegistry.updatedAt)
    ) {
      errors.push('approval predates the active trust registry attestation.');
    }
    if (
      validRfc3339Utc(releaseScope?.approvedAt) &&
      Date.parse(approval.reviewedAt) < Date.parse(releaseScope.approvedAt)
    ) {
      errors.push('approval predates the fixed release-scope approval.');
    }
  }
  if (
    validRfc3339Utc(approval?.expiresAt) &&
    validRfc3339Utc(releaseScope?.expiresAt) &&
    Date.parse(approval.expiresAt) > Date.parse(releaseScope.expiresAt)
  ) {
    errors.push('approval expiry exceeds the fixed release-scope validity.');
  }
  return [...new Set(errors)];
}

function canonicalExistingFile(path, label) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error(`${label} must be a regular non-symlink file.`);
  return realpathSync.native(absolute);
}

function canonicalWorkspaceRoot(root) {
  const absolute = resolve(root);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Workspace root must be a real directory, not a symlink or junction.');
  }
  return realpathSync.native(absolute);
}

function safeExistingDirectory(path, realRoot, label) {
  const absolute = resolve(path);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a real directory, not a symlink or junction.`);
  }
  const candidate = realpathSync.native(absolute);
  if (!isWithin(realRoot, candidate)) {
    throw new Error(`${label} resolves outside the canonical workspace root.`);
  }
  return candidate;
}

function ensureDirectChildDirectory(parent, childName, label) {
  const candidate = resolve(parent, childName);
  if (!existsSync(candidate)) mkdirSync(candidate);
  return safeExistingDirectory(candidate, parent, label);
}

function fixedRepoFile(root, relativePath, label) {
  const realRoot = canonicalWorkspaceRoot(root);
  const candidate = canonicalExistingFile(resolve(realRoot, relativePath), label);
  if (!isWithin(realRoot, candidate)) {
    throw new Error(`${label} resolves outside the canonical workspace root.`);
  }
  return candidate;
}

function normalizedPath(path) {
  const resolved = resolve(path);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(root, candidate) {
  const rel = relative(normalizedPath(root), normalizedPath(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function gitOutput(root, args, label) {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

const CATALOG_POST_BUILD_EVIDENCE_PATHS = new Set([
  'docs/phase-4/catalog-release-build-evidence.json',
  'docs/phase-4/generated/beta-coverage-report.json',
  'docs/phase-4/generated/beta-coverage-report.md',
  'docs/phase-4/generated/catalog-qa-report.json',
  'docs/phase-4/generated/catalog-qa-report.md',
  'docs/phase-4/generated/cosing-catalog-qa-report.json',
  'docs/phase-4/generated/cosing-catalog-qa-report.md',
  'docs/phase-4/generated/cosing-fixture-import.json',
  'docs/phase-4/generated/obf-fixture-import.json',
  'docs/phase-4/generated/source-worklist.json',
  'docs/phase-4/generated/source-worklist.md',
]);

function gitBytes(root, args, label) {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${label} failed: ${Buffer.from(result.stderr ?? result.stdout ?? '')
        .toString('utf8')
        .trim()}`,
    );
  }
  return Buffer.from(result.stdout);
}

export function assertCatalogBuildSourceCommit(root, sourceCommitSha) {
  const realRoot = canonicalWorkspaceRoot(root);
  if (!/^[0-9a-f]{40}$/.test(sourceCommitSha ?? '')) {
    throw new Error('Catalog build-source commit must be an exact lowercase 40-hex Git SHA.');
  }
  const resolvedCommit = gitOutput(
    realRoot,
    ['rev-parse', `${sourceCommitSha}^{commit}`],
    'Catalog build-source commit lookup',
  );
  if (resolvedCommit !== sourceCommitSha) {
    throw new Error('Catalog build-source commit does not resolve to the exact supplied SHA.');
  }
  const headCommitSha = gitOutput(realRoot, ['rev-parse', 'HEAD'], 'Catalog HEAD lookup');
  const ancestry = spawnSync(
    'git',
    [
      '-c',
      `safe.directory=${realRoot}`,
      'merge-base',
      '--is-ancestor',
      sourceCommitSha,
      headCommitSha,
    ],
    { cwd: realRoot, encoding: 'utf8' },
  );
  if (ancestry.status !== 0) {
    throw new Error('Catalog build-source commit must be an ancestor of the evidence checkout.');
  }
  const mergeCommits = gitOutput(
    realRoot,
    ['rev-list', '--merges', `${sourceCommitSha}..${headCommitSha}`],
    'Catalog post-build merge audit',
  );
  if (mergeCommits) {
    throw new Error('Catalog post-build evidence history must not contain merge commits.');
  }
  const changedPaths = [
    ...new Set(
      gitOutput(
        realRoot,
        [
          'log',
          '--format=',
          '--no-renames',
          '--name-only',
          '--diff-filter=ACDMRTUXB',
          `${sourceCommitSha}..${headCommitSha}`,
        ],
        'Catalog post-build evidence history',
      )
        .split(/\r?\n/)
        .filter(Boolean)
        .map((path) => path.replaceAll('\\', '/')),
    ),
  ].sort();
  const disallowedPaths = changedPaths.filter(
    (path) => !CATALOG_POST_BUILD_EVIDENCE_PATHS.has(path),
  );
  if (disallowedPaths.length > 0) {
    throw new Error(
      `Catalog build-source commit has non-evidence descendants:\n${disallowedPaths.join('\n')}`,
    );
  }
  return { sourceCommitSha, headCommitSha, changedPaths };
}

export function catalogTransformerDescriptor(
  root,
  transformerPath,
  parserVersion,
  { sourceCommitSha = null } = {},
) {
  const realRoot = canonicalWorkspaceRoot(root);
  const hasExplicitSourceCommit = sourceCommitSha !== null;
  const commitSha =
    sourceCommitSha ?? gitOutput(realRoot, ['rev-parse', 'HEAD'], 'Transformer Git commit lookup');
  if (hasExplicitSourceCommit) assertCatalogBuildSourceCommit(realRoot, commitSha);
  const files = [
    transformerPath,
    'scripts/phase4/source-policy.mjs',
    'apps/mobile/app.config.js',
    'apps/mobile/app.base.json',
    'apps/mobile/eas.json',
    'apps/mobile/package.json',
    'apps/mobile/phase3-review-evidence.js',
    'docs/hugeToDo/launch-contract.json',
    'package.json',
    'package-lock.json',
  ].map((path) => {
    const absolute = fixedRepoFile(realRoot, path, `Transformer bundle file ${path}`);
    const bytes = readFileSync(absolute);
    if (hasExplicitSourceCommit) {
      const committedBytes = gitBytes(
        realRoot,
        ['show', `${commitSha}:${path}`],
        `Transformer build-source file ${path}`,
      );
      if (!bytes.equals(committedBytes)) {
        throw new Error(`${path} does not match the exact catalog build-source commit.`);
      }
    }
    return { path, sha256: sha256(bytes) };
  });
  const descriptor = {
    path: transformerPath,
    parserVersion,
    files,
    runtime: { node: process.version },
    gitCommitSha: commitSha,
    gitTreeSha: gitOutput(
      realRoot,
      ['rev-parse', `${commitSha}^{tree}`],
      'Transformer Git tree lookup',
    ),
  };
  return {
    ...descriptor,
    sha256: sha256(Buffer.from(canonicalJson(descriptor), 'utf8')),
  };
}

export function assertCatalogSourceTreeClean(root) {
  const status = gitOutput(
    root,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...CATALOG_QA_SOURCE_HASH_PATHS],
    'Catalog source-tree cleanliness check',
  );
  if (status) {
    throw new Error(
      `Production import requires committed catalog policy/transformer/release bytes. Dirty paths:\n${status}`,
    );
  }
}

export function loadAndValidateProductionApproval({
  approvalPath,
  artifactSha256,
  artifactBytes,
  parserVersion,
  policyBundle,
  root = process.cwd(),
  sourceKey,
  transformedPayloadSha256,
  executionTransformer = null,
  transformerPath,
  now,
}) {
  if (!approvalPath) throw new Error('Production import requires --approval-manifest <path>.');
  const absolutePath = canonicalExistingFile(resolve(root, approvalPath), 'Approval manifest');
  const { bytes, value: approval } = readJson(absolutePath, 'Production source approval');
  const trust = loadCatalogSourceTrustRegistry(root);
  const release = loadCatalogReleaseScope(root);
  const releaseBuild = loadCatalogReleaseBuildEvidence(root, {
    releaseScope: release.scope,
    releaseScopeSha256: release.sha256,
    requireVerified: true,
    trustRegistry: trust.registry,
    trustRegistrySha256: trust.sha256,
    now,
  });
  const resolvedRelease = catalogReleaseIdentityFromRepository(root, process.env, {
    includeEvidence: true,
  });
  if (
    canonicalJson(releaseBuild.evidence.easBuild ?? null) !==
    canonicalJson(resolvedRelease.easBuild)
  ) {
    throw new Error(
      'Production import release build evidence does not match the exact EAS build metadata.',
    );
  }
  const releaseRuntimeIdentity = resolvedRelease.identity;
  const transformer = catalogTransformerDescriptor(root, transformerPath, parserVersion, {
    sourceCommitSha: releaseBuild.evidence.easBuild.gitCommitSha,
  });
  if (executionTransformer && canonicalJson(executionTransformer) !== canonicalJson(transformer)) {
    throw new Error('Transformer bundle changed while the import was running.');
  }
  const errors = validateProductionApproval({
    approval,
    artifactSha256,
    artifactBytes,
    policy: policyBundle.policy,
    policySha256: policyBundle.sha256,
    releaseScope: release.scope,
    releaseRuntimeIdentity,
    releaseScopeSha256: release.sha256,
    sourceKey,
    transformer,
    transformedPayloadSha256,
    trustRegistry: trust.registry,
    trustRegistrySha256: trust.sha256,
    trustRoot: trust.trustedRoot,
    now,
  });
  if (errors.length > 0) {
    throw new Error(`Production source approval is invalid:\n- ${errors.join('\n- ')}`);
  }
  assertCatalogSourceTreeClean(root);
  return {
    approval,
    path: absolutePath,
    sha256: sha256(bytes),
    releaseScope: release,
    releaseBuildEvidence: releaseBuild,
    transformer,
    trustRegistry: trust,
    bytes,
  };
}

export function parseImportArgs(argv, defaults) {
  let mode = null;
  let approvalPath = null;
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--fixture' || arg === '--candidate' || arg === '--production') {
      if (mode) throw new Error('Choose exactly one import mode exactly once.');
      mode = arg.slice(2);
      continue;
    }
    if (arg === '--approval-manifest') {
      if (approvalPath) throw new Error('--approval-manifest may be supplied only once.');
      approvalPath = argv[index + 1];
      if (!approvalPath || approvalPath.startsWith('--')) {
        throw new Error('--approval-manifest requires a path.');
      }
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}.`);
    positionals.push(arg);
  }
  if (!mode) throw new Error('Choose --fixture, --candidate, or --production.');
  if (mode === 'fixture' && approvalPath) {
    throw new Error('Fixture imports must not consume a production approval manifest.');
  }
  if (mode === 'candidate' && approvalPath) {
    throw new Error('Candidate transforms must not consume a production approval manifest.');
  }
  if (positionals.length > 2) throw new Error('Expected at most input and output paths.');
  if (mode !== 'fixture' && positionals.length !== 2) {
    throw new Error('Candidate/production import requires explicit input and output paths.');
  }
  const inputPath = resolve(process.cwd(), positionals[0] ?? defaults.input);
  const outputPath = resolve(process.cwd(), positionals[1] ?? defaults.output);
  if (normalizedPath(inputPath) === normalizedPath(outputPath)) {
    throw new Error('Import input and output paths must differ.');
  }
  return { mode, approvalPath, inputPath, outputPath };
}

export function assertFixturePath(inputPath, root = process.cwd()) {
  const realRoot = canonicalWorkspaceRoot(root);
  const fixtureRoot = safeExistingDirectory(
    resolve(realRoot, 'scripts/phase4/fixtures'),
    realRoot,
    'Fixture root',
  );
  const candidate = canonicalExistingFile(inputPath, 'Fixture input');
  if (!isWithin(fixtureRoot, candidate)) {
    throw new Error('Fixture mode only accepts real files under scripts/phase4/fixtures.');
  }
  return candidate;
}

export function assertProductionArtifactPath(inputPath, root = process.cwd()) {
  const realRoot = canonicalWorkspaceRoot(root);
  const fixtureRoot = safeExistingDirectory(
    resolve(realRoot, 'scripts/phase4/fixtures'),
    realRoot,
    'Fixture root',
  );
  const candidate = canonicalExistingFile(inputPath, 'Production input');
  if (isWithin(fixtureRoot, candidate)) {
    throw new Error('Production mode rejects checked-in fixture artifacts.');
  }
  return candidate;
}

export function assertSafeOutputPath({
  approvalPath,
  inputPath,
  mode,
  outputPath,
  root = process.cwd(),
}) {
  const realRoot = canonicalWorkspaceRoot(root);
  const generatedRoot = safeExistingDirectory(
    resolve(realRoot, 'docs/phase-4/generated'),
    realRoot,
    'Generated evidence root',
  );
  const artifactsRoot = ensureDirectChildDirectory(realRoot, 'artifacts', 'Artifact root');
  const artifactRoot = ensureDirectChildDirectory(artifactsRoot, 'phase4', 'Phase 4 artifact root');
  const allowedRoots = mode === 'fixture' ? [generatedRoot, artifactRoot] : [artifactRoot];
  const candidate = resolve(outputPath);
  if (!allowedRoots.some((allowedRoot) => isWithin(allowedRoot, candidate))) {
    throw new Error(
      `Output must stay under ${mode === 'fixture' ? 'docs/phase-4/generated or artifacts/phase4' : 'artifacts/phase4'}.`,
    );
  }
  const realParent = safeExistingDirectory(dirname(candidate), realRoot, 'Output parent directory');
  const allowedRealRoots = allowedRoots;
  if (!allowedRealRoots.some((allowedRoot) => isWithin(allowedRoot, realParent))) {
    throw new Error('Output parent resolves outside the approved output root.');
  }
  const inputReal = canonicalExistingFile(inputPath, 'Input artifact');
  const protectedFiles = [inputReal];
  if (approvalPath)
    protectedFiles.push(canonicalExistingFile(resolve(root, approvalPath), 'Approval manifest'));
  if (existsSync(candidate)) {
    const outputReal = canonicalExistingFile(candidate, 'Existing output');
    if (protectedFiles.some((path) => normalizedPath(path) === normalizedPath(outputReal))) {
      throw new Error('Output must not alias the input or approval manifest.');
    }
    if (mode !== 'fixture')
      throw new Error('Production output already exists; refusing to clobber evidence.');
  }
  return candidate;
}

export function writeJsonAtomically(outputPath, value, { allowReplace = false } = {}) {
  writeTextAtomically(outputPath, `${JSON.stringify(value, null, 2)}\n`, { allowReplace });
}

export function writeTextAtomically(outputPath, value, { allowReplace = false } = {}) {
  if (typeof value !== 'string') throw new Error('Atomic text output must be a string.');
  const tempPath = resolve(
    dirname(outputPath),
    `.${basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(tempPath, value, {
      encoding: 'utf8',
      flag: 'wx',
    });
    if (allowReplace) {
      renameSync(tempPath, outputPath);
    } else {
      linkSync(tempPath, outputPath);
      rmSync(tempPath, { force: true });
    }
  } finally {
    rmSync(tempPath, { force: true });
  }
}

export function writeTextFilesAtomically(entries, { allowReplace = false } = {}) {
  if (!Array.isArray(entries) || entries.length < 1) {
    throw new Error('Atomic evidence batch requires at least one file.');
  }
  const paths = entries.map((entry) => resolve(entry.path));
  if (new Set(paths.map(normalizedPath)).size !== paths.length) {
    throw new Error('Atomic evidence batch paths must be unique.');
  }
  if (entries.some((entry) => typeof entry.content !== 'string')) {
    throw new Error('Atomic evidence batch content must be text.');
  }
  if (allowReplace) {
    for (const entry of entries) {
      writeTextAtomically(entry.path, entry.content, { allowReplace: true });
    }
    return;
  }

  const staged = entries.map((entry) => ({
    outputPath: resolve(entry.path),
    tempPath: resolve(
      dirname(entry.path),
      `.${basename(entry.path)}.${process.pid}.${randomUUID()}.tmp`,
    ),
    content: entry.content,
  }));
  const linkedOutputs = [];
  try {
    for (const entry of staged) {
      writeFileSync(entry.tempPath, entry.content, { encoding: 'utf8', flag: 'wx' });
    }
    for (const entry of staged) {
      linkSync(entry.tempPath, entry.outputPath);
      linkedOutputs.push(entry.outputPath);
    }
  } catch (error) {
    for (const outputPath of linkedOutputs) rmSync(outputPath, { force: true });
    throw error;
  } finally {
    for (const entry of staged) rmSync(entry.tempPath, { force: true });
  }
}

export function artifactDisplayPath(inputPath, root = process.cwd()) {
  const rel = relative(root, inputPath);
  if (!rel.startsWith('..') && !isAbsolute(rel)) return rel.replace(/\\/g, '/');
  return 'external-approved-artifact';
}
