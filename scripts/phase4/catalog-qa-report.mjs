#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';
import { launchContractSnapshot, loadLaunchContract } from '../launch/contract.mjs';
import {
  CATALOG_QA_LAUNCH_CLEAR_REASON,
  CATALOG_QA_SOURCE_HASH_PATHS,
  CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  assertSafeOutputPath,
  canonicalJson,
  catalogReleaseIdentityFromRepository,
  catalogTransformedPayloadSha256,
  catalogTransformerDescriptor,
  loadCatalogReleaseBuildEvidence,
  loadCatalogReleaseScope,
  loadCatalogSourcePolicy,
  loadCatalogSourceTrustRegistry,
  normalizeCatalogCosingKey,
  parseCatalogControlJson,
  parseCatalogEvidenceJson,
  sha256,
  validateProductionApproval,
  validateCatalogReleaseBuildEvidence,
  writeTextFilesAtomically,
} from './source-policy.mjs';

const root = process.cwd();
const launchContract = loadLaunchContract(root);
const sourcePolicy = loadCatalogSourcePolicy(root);
const inputPath = resolve(
  root,
  process.argv[2] ?? 'docs/phase-4/generated/obf-fixture-import.json',
);
const jsonOutputPath = resolve(
  root,
  process.argv[3] ?? 'docs/phase-4/generated/catalog-qa-report.json',
);
const mdOutputPath = jsonOutputPath.replace(/\.json$/i, '.md');
if (mdOutputPath === jsonOutputPath) {
  throw new Error('Catalog QA JSON output path must end in .json.');
}

const manifestBytes = readFileSync(inputPath);
const manifest = parseCatalogEvidenceJson(manifestBytes, 'Catalog transform manifest');
const blockers = [];
const warnings = [];
const digestPattern = /^[0-9a-f]{64}$/i;

const sourceContracts = {
  open_beauty_facts: {
    componentId: 'obf_odbl_component',
    parserVersion: 'phase4-obf-transform-v2',
    transformerPath: 'scripts/phase4/import-obf-snapshot.mjs',
    approvedImportMode: 'approved_offline_export',
    isolation(source) {
      return source.sourceIsolationMode;
    },
    records: Array.isArray(manifest.products) ? manifest.products : [],
    rejected: Array.isArray(manifest.rejected) ? manifest.rejected : [],
  },
  cosing: {
    componentId: 'cosing_reference_component',
    parserVersion: 'phase4-cosing-transform-v2',
    transformerPath: 'scripts/phase4/import-cosing-dictionary.mjs',
    approvedImportMode: 'approved_offline_snapshot',
    isolation(source) {
      return source.databaseCombinationMode;
    },
    records: Array.isArray(manifest.ingredients) ? manifest.ingredients : [],
    rejected: [],
  },
};
const sourceKey = typeof manifest.source === 'string' ? manifest.source : '';
const contract = Object.hasOwn(sourceContracts, sourceKey) ? sourceContracts[sourceKey] : null;
const policySource = Object.hasOwn(sourcePolicy.policy.sources, sourceKey)
  ? sourcePolicy.policy.sources[sourceKey]
  : null;

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function isBoundedText(value, max) {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= max &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function decodeEvidenceBase64(value, label) {
  if (typeof value !== 'string' || value.length % 4 !== 0) {
    blockers.push(`${label} is not canonical base64.`);
    return null;
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) {
    blockers.push(`${label} is not canonical base64.`);
    return null;
  }
  return bytes;
}

function verifyEmbeddedSnapshot(snapshot, currentBundle, currentValue, label) {
  const bytes = decodeEvidenceBase64(snapshot?.manifestBytesBase64, `${label} bytes`);
  if (!bytes) return null;
  let parsed = null;
  try {
    parsed = parseCatalogControlJson(bytes, label);
  } catch (error) {
    blockers.push(`${label} is invalid: ${error.message}`);
    return null;
  }
  if (
    snapshot?.sha256 !== sha256(bytes) ||
    snapshot.sha256 !== currentBundle.sha256 ||
    canonicalJson(parsed) !== canonicalJson(snapshot?.manifest ?? null) ||
    canonicalJson(parsed) !== canonicalJson(currentValue)
  ) {
    blockers.push(`${label} does not exactly match its retained bytes and current fixed file.`);
  }
  return parsed;
}

if (manifest.schemaVersion !== 2) blockers.push('Import manifest schemaVersion must be 2.');
if (!contract || !policySource) blockers.push('Import manifest source is unsupported.');
if (contract && manifest.sourceComponentId !== contract.componentId) {
  blockers.push('Import manifest source component is missing or incorrect.');
}
if (
  manifest.sourcePolicy?.policyId !== sourcePolicy.policy.policyId ||
  manifest.sourcePolicy?.sha256 !== sourcePolicy.sha256
) {
  blockers.push('Import manifest source-policy identity/hash is missing or stale.');
}
if (!digestPattern.test(manifest.inputSha256 ?? '')) {
  blockers.push('Import manifest inputSha256 is invalid.');
}
if (
  manifest.sourceSnapshot?.artifactSha256 !== manifest.inputSha256 ||
  !Number.isInteger(manifest.sourceSnapshot?.bytes) ||
  manifest.sourceSnapshot.bytes < 1
) {
  blockers.push('Import manifest source snapshot byte/hash binding is invalid.');
}
if (contract && manifest.parserVersion !== contract.parserVersion) {
  blockers.push('Import manifest parserVersion is missing or unsupported.');
}
if (
  canonicalJson(manifest.transformedPayloadContract ?? null) !==
  canonicalJson(CATALOG_TRANSFORMED_PAYLOAD_CONTRACT)
) {
  blockers.push('Import manifest transformed-payload contract is missing or unsupported.');
}
if (
  policySource &&
  JSON.stringify(manifest.projectedFields) !== JSON.stringify(policySource.allowedFields)
) {
  blockers.push('Import manifest projected fields do not match the frozen policy projection.');
}
if (contract && manifest.sourceIsolationMode !== contract.isolation(policySource)) {
  blockers.push('Import manifest does not preserve the required source-isolation mode.');
}

const expectedControls =
  manifest.source === 'cosing'
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
if (canonicalJson(manifest.controls ?? null) !== canonicalJson(expectedControls)) {
  blockers.push('Import manifest external-recipient/image/contribution controls are unsafe.');
}
if (manifest.source === 'open_beauty_facts' && manifest.licenses?.images?.allowed !== false) {
  blockers.push('Import manifest must keep OBF product images disabled.');
}

let recomputedTransformSha256 = null;
if (contract && policySource) {
  const recordsWithoutSnapshotDate = contract.records.map((record) => {
    const copy = { ...record };
    for (const field of CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.excludedRecordFields) {
      delete copy[field];
    }
    return copy;
  });
  recomputedTransformSha256 = catalogTransformedPayloadSha256({
    controls: expectedControls,
    inputSha256: manifest.inputSha256,
    parserVersion: contract.parserVersion,
    projectedFields: policySource.allowedFields,
    records: recordsWithoutSnapshotDate,
    rejected: contract.rejected,
    sourceComponentId: contract.componentId,
    sourceIsolationMode: contract.isolation(policySource),
    sourceKey: manifest.source,
  });
  if (
    manifest.transformedPayloadSha256 !== recomputedTransformSha256 ||
    !digestPattern.test(manifest.transformedPayloadSha256 ?? '')
  ) {
    blockers.push('Import manifest transformed payload digest does not match its exact records.');
  }
}

let trustBundle = null;
let releaseBundle = null;
let releaseBuildBundle = null;
try {
  trustBundle = loadCatalogSourceTrustRegistry(root);
} catch (error) {
  blockers.push(`Current trust registry is invalid: ${error.message}`);
}
try {
  releaseBundle = loadCatalogReleaseScope(root);
} catch (error) {
  blockers.push(`Current release scope is invalid: ${error.message}`);
}
try {
  releaseBuildBundle = loadCatalogReleaseBuildEvidence(root, {
    releaseScope: releaseBundle?.scope ?? null,
    releaseScopeSha256: releaseBundle?.sha256 ?? null,
    trustRegistry: trustBundle?.registry ?? null,
    trustRegistrySha256: trustBundle?.sha256 ?? null,
  });
} catch (error) {
  blockers.push(`Current release build evidence is invalid: ${error.message}`);
}

if (manifest.status === 'fixture') {
  if (
    manifest.importMode !== 'fixture' ||
    manifest.sourceApproval !== null ||
    manifest.transformerCandidate !== null ||
    manifest.sourceSnapshot?.date !== null ||
    manifest.sourceSnapshot?.url !== null
  ) {
    blockers.push('Fixture manifest must be approval-free, snapshot-neutral fixture evidence.');
  }
} else if (manifest.status === 'candidate_transform_not_approved') {
  blockers.push('Unsigned candidate transforms can never pass catalog QA or promotion.');
  if (
    manifest.importMode !== 'candidate_hash_only' ||
    manifest.sourceApproval !== null ||
    !digestPattern.test(manifest.transformerCandidate?.sha256 ?? '')
  ) {
    blockers.push('Candidate transform marker/transformer binding is malformed.');
  }
} else if (manifest.status === 'approved_transform' && contract) {
  if (manifest.importMode !== contract.approvedImportMode) {
    blockers.push('Approved transform importMode does not match its source policy.');
  }
  const sourceApproval = manifest.sourceApproval;
  if (
    !exactKeys(sourceApproval, [
      'manifest',
      'manifestBytesBase64',
      'manifestSha256',
      'releaseBuildEvidenceSnapshot',
      'releaseScopeSnapshot',
      'transformerSnapshot',
      'trustRegistrySnapshot',
    ])
  ) {
    blockers.push('Approved transform sourceApproval envelope has missing or extra fields.');
  }
  const approvalBytes = decodeEvidenceBase64(
    sourceApproval?.manifestBytesBase64,
    'Source approval manifest bytes',
  );
  let approval = null;
  if (approvalBytes) {
    try {
      approval = parseCatalogControlJson(approvalBytes, 'Retained source approval');
    } catch (error) {
      blockers.push(`Retained source approval is invalid: ${error.message}`);
    }
    if (
      sourceApproval?.manifestSha256 !== sha256(approvalBytes) ||
      canonicalJson(approval) !== canonicalJson(sourceApproval?.manifest ?? null)
    ) {
      blockers.push('Source approval object does not match its retained exact bytes/hash.');
    }
  }
  if (trustBundle) {
    verifyEmbeddedSnapshot(
      sourceApproval?.trustRegistrySnapshot,
      trustBundle,
      trustBundle.registry,
      'Retained trust-registry snapshot',
    );
  }
  if (releaseBundle) {
    verifyEmbeddedSnapshot(
      sourceApproval?.releaseScopeSnapshot,
      releaseBundle,
      releaseBundle.scope,
      'Retained release-scope snapshot',
    );
  }
  if (sourceApproval && releaseBuildBundle) {
    verifyEmbeddedSnapshot(
      sourceApproval.releaseBuildEvidenceSnapshot,
      releaseBuildBundle,
      releaseBuildBundle.evidence,
      'Retained release-build-evidence snapshot',
    );
  }
  let transformer = null;
  try {
    transformer = catalogTransformerDescriptor(
      root,
      contract.transformerPath,
      contract.parserVersion,
      releaseBuildBundle?.evidence.status === 'verified'
        ? { sourceCommitSha: releaseBuildBundle.evidence.easBuild?.gitCommitSha ?? '' }
        : undefined,
    );
    if (canonicalJson(transformer) !== canonicalJson(sourceApproval?.transformerSnapshot ?? null)) {
      blockers.push('Retained transformer snapshot does not match the current exact bundle.');
    }
  } catch (error) {
    blockers.push(`Current transformer descriptor is unavailable: ${error.message}`);
  }
  let releaseRuntimeIdentity = null;
  let releaseRuntimeEasBuild = null;
  if (releaseBundle?.scope.status === 'approved') {
    try {
      const resolvedRelease = catalogReleaseIdentityFromRepository(root, process.env, {
        includeEvidence: true,
      });
      releaseRuntimeIdentity = resolvedRelease.identity;
      releaseRuntimeEasBuild = resolvedRelease.easBuild;
    } catch (error) {
      blockers.push(`Current production release identity is invalid: ${error.message}`);
    }
  }
  if (releaseBuildBundle && releaseBundle && trustBundle) {
    const buildErrors = validateCatalogReleaseBuildEvidence(releaseBuildBundle.evidence, {
      releaseScope: releaseBundle.scope,
      releaseScopeSha256: releaseBundle.sha256,
      requireVerified: true,
      trustRegistry: trustBundle.registry,
      trustRegistrySha256: trustBundle.sha256,
      now: new Date(),
    });
    blockers.push(...buildErrors.map((error) => `Release build evidence: ${error}`));
    if (
      releaseBuildBundle.evidence.status === 'verified' &&
      canonicalJson(releaseBuildBundle.evidence.easBuild ?? null) !==
        canonicalJson(releaseRuntimeEasBuild)
    ) {
      blockers.push(
        'Release build evidence does not match the current exact EAS build ID/profile/platform/commit/resolved Expo config.',
      );
    }
  }
  if (approval && trustBundle && releaseBundle && transformer) {
    const approvalErrors = validateProductionApproval({
      approval,
      artifactSha256: manifest.inputSha256,
      artifactBytes: manifest.sourceSnapshot?.bytes,
      policy: sourcePolicy.policy,
      policySha256: sourcePolicy.sha256,
      releaseScope: releaseBundle.scope,
      releaseRuntimeIdentity,
      releaseScopeSha256: releaseBundle.sha256,
      sourceKey: manifest.source,
      transformer,
      transformedPayloadSha256: recomputedTransformSha256,
      trustRegistry: trustBundle.registry,
      trustRegistrySha256: trustBundle.sha256,
      trustRoot: trustBundle.trustedRoot,
      now: new Date(),
    });
    blockers.push(...approvalErrors.map((error) => `Current approval revalidation: ${error}`));
    if (
      manifest.sourceSnapshot?.date !== approval.artifact?.snapshotDate ||
      manifest.sourceSnapshot?.url !== approval.artifact?.sourceUrl ||
      manifest.sourceSnapshot?.bytes !== approval.artifact?.bytes
    ) {
      blockers.push(
        'Manifest source snapshot does not exactly match the signed approval artifact.',
      );
    }
  }
} else {
  blockers.push('Import manifest status must be fixture or an exactly approved transform.');
}

let missingCategory = [];
let missingIngredients = [];
let provenanceDrift = [];
let imageFields = [];
let duplicateIdentifiers = [];

if (manifest.source === 'open_beauty_facts') {
  const products = contract?.records ?? [];
  const allowedKeys = [
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
  ];
  duplicateIdentifiers = duplicateValues(
    products.map((product) => (product && typeof product === 'object' ? product.barcode : null)),
  );
  if (duplicateIdentifiers.length) {
    blockers.push(`Duplicate barcodes: ${duplicateIdentifiers.join(', ')}`);
  }
  missingCategory = products.filter(
    (product) => !product || typeof product !== 'object' || !product.category,
  );
  missingIngredients = products.filter(
    (product) => !product || typeof product !== 'object' || !product.ingredientsText,
  );
  provenanceDrift = products.filter(
    (product) =>
      !product ||
      typeof product !== 'object' ||
      !exactKeys(product, allowedKeys) ||
      !/^\d{8,14}$/.test(product.barcode ?? '') ||
      !isBoundedText(product.name, 200) ||
      (product.brand !== null && !isBoundedText(product.brand, 300)) ||
      (product.category !== null && !isBoundedText(product.category, 100)) ||
      (product.ingredientsText !== null && !isBoundedText(product.ingredientsText, 20_000)) ||
      product.source !== 'open_beauty_facts' ||
      product.sourceComponentId !== contract.componentId ||
      product.sourceRef !== product.barcode ||
      product.sourceUrl !== `https://world.openbeautyfacts.org/product/${product.barcode}` ||
      !isCalendarDate(product.sourceRecordModifiedDate) ||
      (isCalendarDate(manifest.sourceSnapshot?.date) &&
        product.sourceRecordModifiedDate > manifest.sourceSnapshot.date) ||
      product.sourceArtifactSha256 !== manifest.inputSha256 ||
      product.sourceSnapshotDate !== manifest.sourceSnapshot?.date ||
      !['limited', 'unverified'].includes(product.qualityGrade) ||
      product.reviewStatus !== 'unreviewed',
  );
  imageFields = products.flatMap((product, index) =>
    Object.keys(product && typeof product === 'object' ? product : {})
      .filter((key) => /^image/i.test(key))
      .map((key) => `${index}:${key}`),
  );
  if (missingCategory.length)
    warnings.push(`${missingCategory.length} accepted products have no mapped category.`);
  if (missingIngredients.length)
    warnings.push(`${missingIngredients.length} accepted products have no ingredient text.`);
  if (products.length < 1) blockers.push('No accepted products in OBF import output.');
  if (
    manifest.totals?.inputRecords !== products.length + contract.rejected.length ||
    manifest.totals?.acceptedProducts !== products.length ||
    manifest.totals?.rejectedRecords !== contract.rejected.length ||
    manifest.totals?.withIngredientText !== products.length - missingIngredients.length
  ) {
    blockers.push('OBF manifest totals do not match its exact records.');
  }
} else if (manifest.source === 'cosing') {
  const ingredients = contract?.records ?? [];
  const allowedKeys = [
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
  ];
  for (const [label, values] of [
    [
      'INCI names',
      ingredients.map((value) =>
        typeof value?.inciName === 'string' ? normalizeCatalogCosingKey(value.inciName) : null,
      ),
    ],
    [
      'CosIng references',
      ingredients.map((value) =>
        typeof value?.sourceRef === 'string' ? normalizeCatalogCosingKey(value.sourceRef) : null,
      ),
    ],
    ['CAS numbers', ingredients.map((value) => value?.casNumber)],
    ['EC numbers', ingredients.map((value) => value?.ecNumber)],
  ]) {
    const duplicates = duplicateValues(values);
    if (duplicates.length) {
      duplicateIdentifiers.push(...duplicates);
      blockers.push(`Duplicate ${label}: ${duplicates.join(', ')}`);
    }
  }
  provenanceDrift = ingredients.filter((ingredient) => {
    const synonymsValid =
      Array.isArray(ingredient?.synonyms) &&
      ingredient.synonyms.every((value) => isBoundedText(value, 300));
    const synonymKeys = synonymsValid
      ? ingredient.synonyms.map((value) => normalizeCatalogCosingKey(value))
      : [];
    return (
      !ingredient ||
      typeof ingredient !== 'object' ||
      !exactKeys(ingredient, allowedKeys) ||
      !isBoundedText(ingredient.inciName, 300) ||
      !isBoundedText(ingredient.displayName, 300) ||
      (ingredient.casNumber !== null &&
        (typeof ingredient.casNumber !== 'string' ||
          !/^\d{2,7}-\d{2}-\d$/u.test(ingredient.casNumber))) ||
      (ingredient.ecNumber !== null &&
        (typeof ingredient.ecNumber !== 'string' ||
          !/^\d{3}-\d{3}-\d$/u.test(ingredient.ecNumber))) ||
      (ingredient.annexStatus !== null && !isBoundedText(ingredient.annexStatus, 500)) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(ingredient.sourceRef ?? '') ||
      ingredient.sourceRecordStatus !== 'active' ||
      ingredient.glossaryDecision !== policySource.requiredGlossaryDecision ||
      ingredient.source !== 'cosing' ||
      ingredient.sourceComponentId !== contract.componentId ||
      ingredient.sourceArtifactSha256 !== manifest.inputSha256 ||
      ingredient.sourceSnapshotDate !== manifest.sourceSnapshot?.date ||
      ingredient.reviewStatus !== 'unreviewed' ||
      !synonymsValid ||
      ingredient.synonyms.length > policySource.transformLimits.maxSynonymsPerRecord ||
      new Set(synonymKeys).size !== synonymKeys.length ||
      synonymKeys.includes(normalizeCatalogCosingKey(ingredient.inciName))
    );
  });
  imageFields = ingredients.flatMap((ingredient, index) =>
    Object.keys(ingredient && typeof ingredient === 'object' ? ingredient : {})
      .filter((key) => /^image/i.test(key))
      .map((key) => `${index}:${key}`),
  );
  if (ingredients.length < 1) blockers.push('No ingredients in CosIng import output.');
  const synonymCount = ingredients.reduce(
    (sum, ingredient) =>
      sum + (Array.isArray(ingredient?.synonyms) ? ingredient.synonyms.length : 0),
    0,
  );
  if (
    manifest.totals?.inputRows !== ingredients.length ||
    manifest.totals?.ingredients !== ingredients.length ||
    manifest.totals?.synonyms !== synonymCount
  ) {
    blockers.push('CosIng manifest totals do not match its exact records.');
  }
}

if (provenanceDrift.length) {
  blockers.push(`${provenanceDrift.length} records violate the exact content/provenance contract.`);
}
if (imageFields.length) {
  blockers.push(
    `Image fields are forbidden in external-source transforms: ${imageFields.join(', ')}`,
  );
}

function repoRelative(path) {
  const candidate = relative(root, path).replace(/\\/g, '/');
  return candidate && !candidate.startsWith('..') ? candidate : 'external-evidence-artifact';
}

function hashAbsolute(path, label = repoRelative(path)) {
  if (!existsSync(path)) return { path: label, exists: false };
  const bytes = readFileSync(path);
  return {
    path: label,
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const reportMode = manifest.status === 'fixture' ? 'fixture' : 'production';
const safeJsonOutputPath = assertSafeOutputPath({
  inputPath,
  mode: reportMode,
  outputPath: jsonOutputPath,
  root,
});
const safeMarkdownOutputPath = assertSafeOutputPath({
  inputPath,
  mode: reportMode,
  outputPath: mdOutputPath,
  root,
});
const reportOutputPaths = [safeJsonOutputPath, safeMarkdownOutputPath].map((path) =>
  relative(root, path).replace(/\\/g, '/'),
);
const inputArtifact = hashAbsolute(inputPath);
const sourceHashes = CATALOG_QA_SOURCE_HASH_PATHS.map((path) =>
  hashAbsolute(resolve(root, path), path),
);
for (const sourceHash of sourceHashes) {
  if (!sourceHash.exists) blockers.push(`Missing source hash input ${sourceHash.path}.`);
}

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedEvidence(reportOutputPaths);
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Catalog QA report generated with a dirty Git worktree; do not use it as final catalog-source evidence.',
  );
}

const localQaClear = blockers.length === 0 && warnings.length === 0;
const report = {
  generatedAt: new Date().toISOString(),
  launchContract: launchContractSnapshot(launchContract),
  inputPath: repoRelative(inputPath),
  gitSha,
  buildSourceGitSha:
    releaseBuildBundle?.evidence.status === 'verified'
      ? (releaseBuildBundle.evidence.easBuild?.gitCommitSha ?? null)
      : null,
  gitStatus,
  source: manifest.source,
  status: manifest.status,
  importMode: manifest.importMode,
  inputArtifact,
  transformedPayloadContract: manifest.transformedPayloadContract ?? null,
  transformedPayloadSha256: manifest.transformedPayloadSha256 ?? null,
  recomputedTransformSha256,
  sourceHashes,
  totals: {
    records: contract?.records.length ?? 0,
    rejectedRecords: contract?.rejected.length ?? 0,
    missingCategory: missingCategory.length,
    missingIngredients: missingIngredients.length,
    duplicateIdentifiers: duplicateIdentifiers.length,
    provenanceDrift: provenanceDrift.length,
    imageFields: imageFields.length,
  },
  blockers: [...new Set(blockers)],
  warnings: [...new Set(warnings)],
  localQaClear,
  launchClear: false,
  launchClearReason: CATALOG_QA_LAUNCH_CLEAR_REASON,
};

const markdownRows = sourceHashes
  .map((sourceHash) =>
    sourceHash.exists
      ? `| ${sourceHash.path} | present | ${sourceHash.bytes} | ${sourceHash.sha256} |`
      : `| ${sourceHash.path} | missing |  |  |`,
  )
  .join('\n');
const dirtyDetails = gitStatus.length ? `\nDirty paths:\n\n\`\`\`\n${gitStatus}\n\`\`\`\n\n` : '\n';
const markdown =
  `# Catalog QA Report\n\nGenerated: ${report.generatedAt}\n\n` +
  `Source: ${report.source ?? 'unknown'}\n\n` +
  `Transform status: ${report.status ?? 'unknown'}\n\n` +
  `Git SHA: ${report.gitSha}\n\n` +
  `Build-source Git SHA: ${report.buildSourceGitSha ?? 'not verified'}\n\n` +
  `Git status: ${report.gitStatus.length ? 'DIRTY' : 'clean'}\n` +
  dirtyDetails +
  `Records: ${report.totals.records}\n\n` +
  `Rejected records: ${report.totals.rejectedRecords}\n\n` +
  `Blockers: ${report.blockers.length ? report.blockers.join('; ') : 'none'}\n\n` +
  `Warnings: ${report.warnings.length ? report.warnings.join('; ') : 'none'}\n\n` +
  `Local QA clear: ${report.localQaClear ? 'yes' : 'no'}\n\n` +
  `Launch clear: no\n\n` +
  `Launch clear reason: ${report.launchClearReason}\n\n` +
  `## Input Artifact\n\n| Path | Status | Bytes | SHA-256 |\n| --- | --- | ---: | --- |\n` +
  `| ${inputArtifact.path} | present | ${inputArtifact.bytes} | ${inputArtifact.sha256} |\n\n` +
  `## Source Hashes\n\n| Path | Status | Bytes | SHA-256 |\n| --- | --- | ---: | --- |\n` +
  `${markdownRows}\n`;

const allowReplace = manifest.status === 'fixture';
writeTextFilesAtomically(
  [
    { path: safeJsonOutputPath, content: `${JSON.stringify(report, null, 2)}\n` },
    { path: safeMarkdownOutputPath, content: markdown },
  ],
  { allowReplace },
);

console.log(`Wrote ${safeJsonOutputPath}`);
console.log(`Blockers ${report.blockers.length}; warnings ${report.warnings.length}.`);
if (
  report.blockers.length > 0 ||
  (manifest.status === 'approved_transform' && report.warnings.length > 0)
) {
  process.exitCode = 1;
}
