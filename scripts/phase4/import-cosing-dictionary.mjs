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
  catalogTransformedPayloadSha256,
  catalogTransformerDescriptor,
  loadAndValidateProductionApproval,
  loadCatalogSourcePolicy,
  normalizeCatalogCosingKey,
  parseImportArgs,
  writeJsonAtomically,
} from './source-policy.mjs';

const root = process.cwd();
const { mode, approvalPath, inputPath, outputPath } = parseImportArgs(process.argv.slice(2), {
  input: 'scripts/phase4/fixtures/cosing-sample.csv',
  output: 'docs/phase-4/generated/cosing-fixture-import.json',
});
const sourcePolicy = loadCatalogSourcePolicy(root);
const sourcePolicyEntry = sourcePolicy.policy.sources.cosing;
const PARSER_VERSION = 'phase4-cosing-transform-v2';
const TRANSFORMER_PATH = 'scripts/phase4/import-cosing-dictionary.mjs';
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
    `CosIng artifact exceeds the ${sourcePolicyEntry.transformLimits.maxArtifactBytes}-byte bounded transform limit. Split and review it before import.`,
  );
}
const inputBytes = readFileSync(safeInputPath);
const artifactBytes = inputBytes.length;
if (inputBytes.length > sourcePolicyEntry.transformLimits.maxArtifactBytes) {
  throw new Error(
    `CosIng artifact exceeds the ${sourcePolicyEntry.transformLimits.maxArtifactBytes}-byte bounded transform limit. Split and review it before import.`,
  );
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

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  let quotedFieldClosed = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        quotedFieldClosed = true;
      } else {
        value += char;
      }
      continue;
    }
    if (quotedFieldClosed && char !== ',' && char !== '\r' && char !== '\n') {
      throw new Error('Malformed CSV: unexpected content after a closing quote.');
    }
    if (char === '"') {
      if (value.trim().length > 0) throw new Error('Malformed CSV quote in unquoted field.');
      quoted = true;
    } else if (char === ',') {
      row.push(value.trim());
      value = '';
      quotedFieldClosed = false;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      value = '';
      quotedFieldClosed = false;
      if (row.some((field) => field.length > 0)) rows.push(row);
      row = [];
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted field.');
  row.push(value.trim());
  if (row.some((field) => field.length > 0)) rows.push(row);
  return rows;
}

const inputSha256 = createHash('sha256').update(inputBytes).digest('hex');
const raw = new TextDecoder('utf-8', { fatal: true }).decode(inputBytes);
const csvRows = parseCsv(raw);
const headers = csvRows.shift() ?? [];
if (headers[0]?.startsWith('\uFEFF')) headers[0] = headers[0].slice(1);
if (
  headers.length !== sourcePolicyEntry.allowedFields.length ||
  new Set(headers).size !== headers.length ||
  sourcePolicyEntry.allowedFields.some((field) => !headers.includes(field))
) {
  throw new Error(
    `CosIng CSV headers must exactly match the approved projection: ${sourcePolicyEntry.allowedFields.join(', ')}.`,
  );
}
if (csvRows.length > sourcePolicyEntry.transformLimits.maxRecords) {
  throw new Error(
    `CosIng artifact exceeds the ${sourcePolicyEntry.transformLimits.maxRecords}-record bounded transform limit. Split and review it before import.`,
  );
}
const rows = csvRows.map((values, index) => {
  if (values.length !== headers.length) {
    throw new Error(
      `CosIng CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
    );
  }
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
});

function boundedText(value, label, { max = 300, required = false } = {}) {
  if (
    typeof value !== 'string' ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.length > max ||
    value !== value.trim()
  ) {
    throw new Error(`${label} is invalid or exceeds ${max} characters.`);
  }
  if (required && value.length === 0) throw new Error(`${label} is required.`);
  return value || null;
}

function duplicateKey(value) {
  return normalizeCatalogCosingKey(value);
}

const ingredients = rows.map((row, index) => {
  const rowLabel = `CosIng CSV row ${index + 2}`;
  const inciName = boundedText(row.inci_name, `${rowLabel} inci_name`, { required: true });
  const displayName = boundedText(row.display_name, `${rowLabel} display_name`) ?? inciName;
  const casNumber = boundedText(row.cas_number, `${rowLabel} cas_number`, { max: 32 });
  const ecNumber = boundedText(row.ec_number, `${rowLabel} ec_number`, { max: 32 });
  if (casNumber && !/^\d{2,7}-\d{2}-\d$/.test(casNumber)) {
    throw new Error(`${rowLabel} cas_number is malformed.`);
  }
  if (ecNumber && !/^\d{3}-\d{3}-\d$/.test(ecNumber)) {
    throw new Error(`${rowLabel} ec_number is malformed.`);
  }
  const annexStatus = boundedText(row.annex_status, `${rowLabel} annex_status`, { max: 500 });
  const sourceRef = boundedText(row.cosing_ref, `${rowLabel} cosing_ref`, {
    max: 200,
    required: true,
  });
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(sourceRef)) {
    throw new Error(`${rowLabel} cosing_ref is malformed.`);
  }
  if (!sourcePolicyEntry.allowedRecordStatuses.includes(row.record_status)) {
    throw new Error(`${rowLabel} record_status is not approved for launch import.`);
  }
  if (row.glossary_decision !== sourcePolicyEntry.requiredGlossaryDecision) {
    throw new Error(`${rowLabel} glossary_decision is not the retained glossary version.`);
  }
  const synonyms = row.synonyms
    ? row.synonyms.split('|').map((value, synonymIndex) =>
        boundedText(value.trim(), `${rowLabel} synonym ${synonymIndex + 1}`, {
          required: true,
        }),
      )
    : [];
  if (synonyms.length > sourcePolicyEntry.transformLimits.maxSynonymsPerRecord) {
    throw new Error(`${rowLabel} exceeds the bounded synonym count.`);
  }
  if (new Set(synonyms.map(duplicateKey)).size !== synonyms.length) {
    throw new Error(`${rowLabel} contains duplicate synonyms.`);
  }
  if (synonyms.some((synonym) => duplicateKey(synonym) === duplicateKey(inciName))) {
    throw new Error(`${rowLabel} contains a synonym identical to its INCI name.`);
  }
  return {
    inciName,
    displayName,
    casNumber,
    ecNumber,
    annexStatus,
    sourceRef,
    sourceRecordStatus: row.record_status,
    glossaryDecision: row.glossary_decision,
    source: 'cosing',
    sourceComponentId: sourcePolicyEntry.componentId,
    sourceArtifactSha256: inputSha256,
    reviewStatus: 'unreviewed',
    synonyms,
  };
});

for (const [label, selector] of [
  ['INCI name', (ingredient) => duplicateKey(ingredient.inciName)],
  ['CosIng reference', (ingredient) => duplicateKey(ingredient.sourceRef)],
  ['CAS number', (ingredient) => ingredient.casNumber],
  ['EC number', (ingredient) => ingredient.ecNumber],
]) {
  const seen = new Set();
  for (const ingredient of ingredients) {
    const value = selector(ingredient);
    if (value === null) continue;
    if (seen.has(value)) throw new Error(`CosIng transform contains duplicate ${label} ${value}.`);
    seen.add(value);
  }
}

const transformControls = {
  runtimeRequests: false,
  imagesIncluded: false,
  contributionBack: false,
  productionApprovalRequired: true,
  claimsAuthority: 'informative_reference_only',
};
const transformedPayloadSha256 = catalogTransformedPayloadSha256({
  controls: transformControls,
  inputSha256,
  parserVersion: PARSER_VERSION,
  projectedFields: sourcePolicyEntry.allowedFields,
  records: ingredients,
  sourceComponentId: sourcePolicyEntry.componentId,
  sourceIsolationMode: sourcePolicyEntry.databaseCombinationMode,
  sourceKey: 'cosing',
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
        sourceKey: 'cosing',
        transformedPayloadSha256,
        transformerPath: TRANSFORMER_PATH,
      })
    : null;
const promotableIngredients = ingredients.map((ingredient) => ({
  ...ingredient,
  sourceSnapshotDate: approval?.approval.artifact.snapshotDate ?? null,
}));
if (mode === 'candidate') {
  assertCatalogSourceTreeClean(root);
  const finalTransformer = catalogTransformerDescriptor(root, TRANSFORMER_PATH, PARSER_VERSION);
  if (JSON.stringify(executionTransformer) !== JSON.stringify(finalTransformer)) {
    throw new Error('Transformer bundle changed while the candidate transform was running.');
  }
}

const manifestBody = {
  schemaVersion: 2,
  status:
    mode === 'fixture'
      ? 'fixture'
      : mode === 'candidate'
        ? 'candidate_transform_not_approved'
        : 'approved_transform',
  source: 'cosing',
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
        : 'approved_offline_snapshot',
  parserVersion: PARSER_VERSION,
  transformedPayloadContract: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  transformedPayloadSha256,
  projectedFields: [...sourcePolicyEntry.allowedFields],
  sourceIsolationMode: sourcePolicyEntry.databaseCombinationMode,
  reuseBasis: sourcePolicyEntry.reuseBasis,
  controls: transformControls,
  warning:
    mode === 'candidate'
      ? 'Unsigned candidate transform only. It can never be promoted or served. CosIng remains informative only.'
      : 'CosIng is informative only. Do not treat ingredient presence as approval or safety.',
  inputPath: artifactDisplayPath(safeInputPath, root),
  inputSha256,
  totals: {
    inputRows: rows.length,
    ingredients: promotableIngredients.length,
    synonyms: promotableIngredients.reduce(
      (sum, ingredient) => sum + ingredient.synonyms.length,
      0,
    ),
  },
  ingredients: promotableIngredients,
};
const manifest = {
  generatedAt: stableGeneratedAt(safeOutputPath, manifestBody),
  ...manifestBody,
};

writeJsonAtomically(safeOutputPath, manifest, { allowReplace: mode === 'fixture' });
console.log(`Wrote ${safeOutputPath}`);
