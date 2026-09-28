#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import {
  CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  artifactDisplayPath,
  assertFixturePath,
  assertProductionArtifactPath,
  assertSafeOutputPath,
  assertCatalogSourceTreeClean,
  canonicalizeCatalogGtin,
  catalogTransformedPayloadSha256,
  catalogTransformerDescriptor,
  loadAndValidateProductionApproval,
  loadCatalogSourcePolicy,
  parseCatalogEvidenceJson,
  parseImportArgs,
  writeJsonAtomically,
} from './source-policy.mjs';

const root = process.cwd();
const { mode, approvalPath, inputPath, outputPath } = parseImportArgs(process.argv.slice(2), {
  input: 'scripts/phase4/fixtures/obf-sample.jsonl',
  output: 'docs/phase-4/generated/obf-fixture-import.json',
});
const sourcePolicy = loadCatalogSourcePolicy(root);
const sourcePolicyEntry = sourcePolicy.policy.sources.open_beauty_facts;
const PARSER_VERSION = 'phase4-obf-transform-v2';
const TRANSFORMER_PATH = 'scripts/phase4/import-obf-snapshot.mjs';
const executionTransformer =
  mode === 'candidate' || (mode === 'production' && approvalPath)
    ? catalogTransformerDescriptor(
        root,
        TRANSFORMER_PATH,
        PARSER_VERSION,
        mode === 'production'
          ? { sourceCommitSha: process.env.EAS_BUILD_GIT_COMMIT_HASH ?? '' }
          : undefined,
      )
    : null;
const safeInputPath =
  mode === 'fixture'
    ? assertFixturePath(inputPath, root)
    : assertProductionArtifactPath(inputPath, root);
const safeOutputPath = assertSafeOutputPath({
  approvalPath,
  inputPath: safeInputPath,
  mode,
  outputPath,
  root,
});

const inputStat = statSync(safeInputPath);
if (inputStat.size > sourcePolicyEntry.transformLimits.maxArtifactBytes) {
  throw new Error(
    `OBF artifact exceeds the ${sourcePolicyEntry.transformLimits.maxArtifactBytes}-byte bounded transform limit. Split and review it before import.`,
  );
}
const inputBytes = readFileSync(safeInputPath);
const artifactBytes = inputBytes.length;
if (inputBytes.length > sourcePolicyEntry.transformLimits.maxArtifactBytes) {
  throw new Error(
    `OBF artifact exceeds the ${sourcePolicyEntry.transformLimits.maxArtifactBytes}-byte bounded transform limit. Split and review it before import.`,
  );
}

const BEAUTY_TAGS = new Set([
  'en:beauty',
  'en:cosmetics',
  'en:skin-care',
  'en:face-care',
  'en:moisturizers',
  'en:sunscreens',
  'en:cleansers',
  'en:serums',
  'en:toners',
]);
const REJECT_TAGS = new Set([
  'en:mouthwashes',
  'en:toothpastes',
  'en:oral-care',
  'en:shampoos',
  'en:hair-care',
]);

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return null;
  return text.length > 0 ? text : null;
}

function rejectedText(value, maxLength) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function sourceRecordModifiedDate(value) {
  if (!Number.isSafeInteger(value) || value < 0) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function categoryFromTags(tags) {
  const lower = tags.map((tag) => tag.toLowerCase());
  // OBF's governed beauty category taxonomy has no benzoyl-peroxide/acne
  // category. Never derive that regulated product classification from a free
  // tag or ingredient-name substring here; the signed CAT-02 row-review
  // overlay is the only supported candidate override, and CAT-03 still
  // requires its independent OTC/regulatory evidence before serving.
  if (lower.some((tag) => tag.includes('sunscreen') || tag.includes('sun-protection')))
    return 'spf';
  if (lower.some((tag) => tag.includes('cleanser'))) return 'cleanser';
  if (lower.some((tag) => tag.includes('toner') || tag.includes('essence'))) return 'toner';
  if (lower.some((tag) => tag.includes('serum'))) return 'serum';
  if (lower.some((tag) => tag.includes('moisturizer') || tag.includes('moisturiser')))
    return 'moisturiser_tube';
  return null;
}

function isBeautyCandidate(tags) {
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => REJECT_TAGS.has(tag))) return false;
  return lower.some((tag) => BEAUTY_TAGS.has(tag));
}

const inputSha256 = createHash('sha256').update(inputBytes).digest('hex');
const raw = new TextDecoder('utf-8', { fatal: true }).decode(inputBytes);
const records = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    try {
      const record = parseCatalogEvidenceJson(
        Buffer.from(line, 'utf8'),
        `OBF JSONL line ${index + 1}`,
        { maxBytes: 131_072 },
      );
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('record must be a JSON object');
      }
      return record;
    } catch (error) {
      throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
    }
  });
if (records.length > sourcePolicyEntry.transformLimits.maxRecords) {
  throw new Error(
    `OBF artifact exceeds the ${sourcePolicyEntry.transformLimits.maxRecords}-record bounded transform limit. Split and review it before import.`,
  );
}

const products = [];
const rejected = [];

for (const record of records) {
  const barcode = canonicalizeCatalogGtin(record.code);
  const name = normalizeText(record.product_name, 200);
  const brand = normalizeText(record.brands, 300);
  const brandValid = record.brands == null || record.brands === '' || brand !== null;
  const tagsValid =
    Array.isArray(record.categories_tags) &&
    record.categories_tags.length <= 100 &&
    record.categories_tags.every(
      (tag) => typeof tag === 'string' && tag.length <= 200 && tag === tag.trim(),
    );
  const tags = tagsValid ? record.categories_tags : [];
  const ingredientsText = normalizeText(record.ingredients_text, 20_000);
  const ingredientsValid =
    record.ingredients_text == null || record.ingredients_text === '' || ingredientsText !== null;
  const modifiedDate = sourceRecordModifiedDate(record.last_modified_t);
  const beauty = isBeautyCandidate(tags);

  if (
    !barcode ||
    !name ||
    !brandValid ||
    !tagsValid ||
    !ingredientsValid ||
    !modifiedDate ||
    !beauty
  ) {
    rejected.push({
      code: rejectedText(record.code, 64),
      product_name: rejectedText(record.product_name, 300),
      reason: !barcode
        ? 'invalid_barcode'
        : !name
          ? 'missing_or_invalid_name'
          : !brandValid
            ? 'invalid_brand'
            : !tagsValid
              ? 'invalid_categories_tags'
              : !ingredientsValid
                ? 'invalid_ingredients_text'
                : !modifiedDate
                  ? 'missing_or_invalid_source_record_modified_date'
                  : 'not_skin_care_category',
    });
    continue;
  }

  products.push({
    barcode,
    name,
    brand,
    category: categoryFromTags(tags),
    ingredientsText,
    source: 'open_beauty_facts',
    sourceComponentId: sourcePolicyEntry.componentId,
    sourceRef: barcode,
    sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`,
    sourceRecordModifiedDate: modifiedDate,
    sourceArtifactSha256: inputSha256,
    qualityGrade: ingredientsText ? 'limited' : 'unverified',
    reviewStatus: 'unreviewed',
  });
}

const seenBarcodes = new Set();
for (const product of products) {
  if (seenBarcodes.has(product.barcode)) {
    throw new Error(`OBF transform contains duplicate barcode ${product.barcode}.`);
  }
  seenBarcodes.add(product.barcode);
}

const transformControls = {
  runtimeRequests: false,
  imagesIncluded: false,
  contributionBack: false,
  productionApprovalRequired: true,
};
const transformedPayloadSha256 = catalogTransformedPayloadSha256({
  controls: transformControls,
  inputSha256,
  parserVersion: PARSER_VERSION,
  projectedFields: sourcePolicyEntry.allowedFields,
  records: products,
  rejected,
  sourceComponentId: sourcePolicyEntry.componentId,
  sourceIsolationMode: sourcePolicyEntry.sourceIsolationMode,
  sourceKey: 'open_beauty_facts',
});
const approval =
  mode === 'production'
    ? loadAndValidateProductionApproval({
        approvalPath,
        artifactSha256: inputSha256,
        artifactBytes,
        executionTransformer,
        parserVersion: PARSER_VERSION,
        policyBundle: sourcePolicy,
        root,
        sourceKey: 'open_beauty_facts',
        transformedPayloadSha256,
        transformerPath: TRANSFORMER_PATH,
      })
    : null;
if (
  approval &&
  products.some(
    (product) => product.sourceRecordModifiedDate > approval.approval.artifact.snapshotDate,
  )
) {
  throw new Error(
    'OBF source record modified date cannot be later than the signed source snapshot date.',
  );
}
const promotableProducts = products.map((product) => ({
  ...product,
  sourceSnapshotDate: approval?.approval.artifact.snapshotDate ?? null,
}));
if (mode === 'candidate') {
  assertCatalogSourceTreeClean(root);
  const finalTransformer = catalogTransformerDescriptor(root, TRANSFORMER_PATH, PARSER_VERSION);
  if (JSON.stringify(executionTransformer) !== JSON.stringify(finalTransformer)) {
    throw new Error('Transformer bundle changed while the candidate transform was running.');
  }
}

function stripGeneratedAt(value) {
  const copy = { ...value };
  delete copy.generatedAt;
  return copy;
}

function stableGeneratedAt(output, nextManifest) {
  if (!existsSync(output)) return new Date().toISOString();
  try {
    const existing = JSON.parse(readFileSync(output, 'utf8'));
    if (
      typeof existing.generatedAt === 'string' &&
      JSON.stringify(stripGeneratedAt(existing)) === JSON.stringify(stripGeneratedAt(nextManifest))
    ) {
      return existing.generatedAt;
    }
  } catch {
    // Fall through to a fresh timestamp when the previous artifact is unreadable.
  }
  return new Date().toISOString();
}

const manifestBody = {
  schemaVersion: 2,
  status:
    mode === 'fixture'
      ? 'fixture'
      : mode === 'candidate'
        ? 'candidate_transform_not_approved'
        : 'approved_transform',
  inputPath: artifactDisplayPath(safeInputPath, root),
  inputSha256,
  source: 'open_beauty_facts',
  sourceComponentId: sourcePolicyEntry.componentId,
  sourcePolicy: {
    policyId: sourcePolicy.policy.policyId,
    sha256: sourcePolicy.sha256,
  },
  sourceApproval: approval
    ? {
        manifest: approval.approval,
        manifestBytesBase64: approval.bytes.toString('base64'),
        manifestSha256: approval.sha256,
        releaseScopeSnapshot: {
          manifest: approval.releaseScope.scope,
          manifestBytesBase64: approval.releaseScope.bytes.toString('base64'),
          sha256: approval.releaseScope.sha256,
        },
        releaseBuildEvidenceSnapshot: {
          manifest: approval.releaseBuildEvidence.evidence,
          manifestBytesBase64: approval.releaseBuildEvidence.bytes.toString('base64'),
          sha256: approval.releaseBuildEvidence.sha256,
        },
        transformerSnapshot: approval.transformer,
        trustRegistrySnapshot: {
          manifest: approval.trustRegistry.registry,
          manifestBytesBase64: approval.trustRegistry.bytes.toString('base64'),
          sha256: approval.trustRegistry.sha256,
        },
      }
    : null,
  transformerCandidate: mode === 'candidate' ? executionTransformer : null,
  sourceSnapshot: {
    date: approval?.approval.artifact.snapshotDate ?? null,
    url: approval?.approval.artifact.sourceUrl ?? null,
    artifactSha256: inputSha256,
    bytes: artifactBytes,
  },
  importMode:
    mode === 'fixture'
      ? 'fixture'
      : mode === 'candidate'
        ? 'candidate_hash_only'
        : 'approved_offline_export',
  parserVersion: PARSER_VERSION,
  transformedPayloadContract: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  transformedPayloadSha256,
  projectedFields: [...sourcePolicyEntry.allowedFields],
  sourceIsolationMode: sourcePolicyEntry.sourceIsolationMode,
  licenses: sourcePolicyEntry.licenses,
  controls: transformControls,
  warning:
    mode === 'fixture'
      ? 'Fixture import only. This artifact is never production catalog data.'
      : mode === 'candidate'
        ? 'Unsigned candidate transform only. Use its exact payload/transformer hashes for independent review; it can never be promoted or served.'
        : 'Transform approved only for the exact hash-bound offline artifact; promotion still requires catalog QA and release gates.',
  totals: {
    inputRecords: records.length,
    acceptedProducts: promotableProducts.length,
    rejectedRecords: rejected.length,
    withIngredientText: promotableProducts.filter((product) => product.ingredientsText).length,
  },
  products: promotableProducts,
  rejected,
};
const manifest = {
  generatedAt: stableGeneratedAt(safeOutputPath, manifestBody),
  ...manifestBody,
};

writeJsonAtomically(safeOutputPath, manifest, { allowReplace: mode === 'fixture' });

console.log(`Wrote ${safeOutputPath}`);
console.log(`Accepted ${products.length}/${records.length}; rejected ${rejected.length}.`);
