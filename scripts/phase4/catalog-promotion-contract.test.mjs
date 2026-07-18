import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { launchContractSnapshot, loadLaunchContract } from '../launch/contract.mjs';
import {
  CATALOG_STAGE_CONTRACT_ID,
  CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID,
  CATALOG_DATABASE_NORMALIZED_RECORD_HASH_CONTRACT_ID,
  CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE,
  CATALOG_ROW_REVIEW_SIGNING_DOMAIN,
  REQUIRED_PROMOTION_QA_SOURCE_PATHS,
  buildCatalogBatchEvidenceDescriptor,
  buildCatalogStageEnvelope,
  catalogBatchEvidenceSha256,
  catalogDatabaseCandidatesSha256,
  catalogDatabaseNormalizedPayload,
  catalogDatabaseRecordSha256,
  catalogProjectedExpandedReceiptBytes,
  catalogRowReviewSigningPayload,
  completeCatalogDatabaseReceiptsFromFiles,
  materializeCatalogDatabaseReceiptCompletion,
  normalizeCosingNaturalKey,
  validateCatalogPromotionOperator,
  validatePromotionQaSourceHashes,
  validateRowReviewTrustAuthority,
  writeCatalogDatabaseReceiptCompletion,
  writeCatalogStageEnvelope,
} from './catalog-promotion-contract.mjs';
import {
  CATALOG_QA_LAUNCH_CLEAR_REASON,
  CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
  assertCatalogSourceTreeClean,
  canonicalJson,
  catalogTransformedPayloadSha256,
  sha256,
} from './source-policy.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', '..');
const artifactRoot = resolve(root, 'artifacts/phase4');
const cliPath = resolve(scriptDir, 'build-catalog-stage-envelope.mjs');
const completionCliPath = resolve(scriptDir, 'complete-catalog-database-receipts.mjs');
const launchContract = launchContractSnapshot(loadLaunchContract(root));
const digest = (character) => character.repeat(64);
const gitSha = 'a'.repeat(40);
const syntheticAuthority = Object.freeze({
  buildSourceGitSha: gitSha,
  evidenceHeadGitSha: 'b'.repeat(40),
  sourcePolicySha256: digest('5'),
  trustRegistrySha256: digest('6'),
  releaseScopeSha256: digest('7'),
  releaseBuildEvidenceSha256: digest('8'),
});

mkdirSync(artifactRoot, { recursive: true });

function retainedSnapshot(manifest) {
  const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    manifest,
    manifestBytesBase64: bytes.toString('base64'),
    sha256: sha256(bytes),
  };
}

function sourceConfig(source) {
  if (source === 'open_beauty_facts') {
    return {
      componentId: 'obf_odbl_component',
      importMode: 'approved_offline_export',
      parserVersion: 'phase4-obf-transform-v2',
      isolationMode: 'separate_source_component_pending_legal_classification',
      projectedFields: [
        'code',
        'product_name',
        'brands',
        'categories_tags',
        'ingredients_text',
        'last_modified_t',
      ],
      controls: {
        runtimeRequests: false,
        imagesIncluded: false,
        contributionBack: false,
        productionApprovalRequired: true,
      },
    };
  }
  return {
    componentId: 'cosing_reference_component',
    importMode: 'approved_offline_snapshot',
    parserVersion: 'phase4-cosing-transform-v2',
    isolationMode: 'provenance_tagged_reference_component',
    projectedFields: [
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
    controls: {
      runtimeRequests: false,
      imagesIncluded: false,
      contributionBack: false,
      productionApprovalRequired: true,
      claimsAuthority: 'informative_reference_only',
    },
  };
}

function obfRecord(overrides = {}) {
  return {
    barcode: '12345670',
    name: 'Reviewed Moisturizer',
    brand: 'Example Brand',
    category: 'moisturiser_tube',
    ingredientsText: 'Water, Glycerin',
    source: 'open_beauty_facts',
    sourceComponentId: 'obf_odbl_component',
    sourceRef: '12345670',
    sourceUrl: 'https://world.openbeautyfacts.org/product/12345670',
    sourceRecordModifiedDate: '2026-07-13',
    sourceArtifactSha256: digest('1'),
    qualityGrade: 'limited',
    reviewStatus: 'unreviewed',
    sourceSnapshotDate: '2026-07-14',
    ...overrides,
  };
}

function cosingRecord(overrides = {}) {
  return {
    inciName: 'GLYCERIN',
    displayName: 'Glycerin',
    casNumber: '56-81-5',
    ecNumber: '200-289-5',
    annexStatus: null,
    sourceRef: 'COSING:1',
    sourceRecordStatus: 'active',
    glossaryDecision: 'EU_2025_1175',
    source: 'cosing',
    sourceComponentId: 'cosing_reference_component',
    sourceArtifactSha256: digest('1'),
    reviewStatus: 'unreviewed',
    synonyms: ['GLYCEROL'],
    sourceSnapshotDate: '2026-07-14',
    ...overrides,
  };
}

function buildTransform(source, records) {
  const config = sourceConfig(source);
  const recordsBeforeSnapshot = records.map((record) => {
    const copy = { ...record };
    delete copy.sourceSnapshotDate;
    return copy;
  });
  const transformedPayloadSha256 = catalogTransformedPayloadSha256({
    controls: config.controls,
    inputSha256: digest('1'),
    parserVersion: config.parserVersion,
    projectedFields: config.projectedFields,
    records: recordsBeforeSnapshot,
    rejected: [],
    sourceComponentId: config.componentId,
    sourceIsolationMode: config.isolationMode,
    sourceKey: source,
  });
  const trust = retainedSnapshot({
    schemaVersion: 1,
    registryId: 'catalog-source-trust-v1',
    policyId: 'catalog-source-policy-v1',
    epoch: 7,
    status: 'active',
    updatedAt: '2026-07-15T00:00:00.000Z',
    reviewers: [{ reviewerId: 'legal-source' }, { reviewerId: 'engineering-source' }],
    rootSignature: { algorithm: 'Ed25519', valueBase64: 'c2lnbmF0dXJl' },
  });
  const appIdentity = {
    displayName: 'RoutineKind',
    bundleId: 'com.routinekind.app',
    version: '1.0.0',
    build: '1',
    publicHost: 'routinekind.app',
    supportEmail: 'support@routinekind.app',
  };
  const release = retainedSnapshot({
    schemaVersion: 1,
    scopeId: 'catalog-release-scope-v1',
    status: 'approved',
    appIdentity,
    territories: ['US'],
    attribution: { publicUrl: 'https://routinekind.app/catalog-sources' },
    approvedAt: '2026-07-15T01:00:00.000Z',
    expiresAt: '2027-07-15T01:00:00.000Z',
    evidence: { identity: {}, territory: {}, attributionSurface: {} },
  });
  const build = retainedSnapshot({
    schemaVersion: 1,
    evidenceId: 'catalog-release-build-evidence-v1',
    status: 'verified',
    releaseScope: { scopeId: release.manifest.scopeId, sha256: release.sha256 },
    trustRegistry: {
      registryId: trust.manifest.registryId,
      epoch: trust.manifest.epoch,
      sha256: trust.sha256,
    },
    easBuild: {
      buildId: 'f51831f0-ea30-406a-8c5f-f8e1cc57d39c',
      profile: 'production',
      platform: 'ios',
      gitCommitSha: gitSha,
      resolvedExpoConfigSha256: digest('2'),
    },
    archive: {},
    appStoreRelease: {},
    territories: ['US'],
    evidence: {},
    verifiedAt: '2026-07-15T02:00:00.000Z',
    verifier: {},
    signature: { algorithm: 'Ed25519', valueBase64: 'c2lnbmF0dXJl' },
  });
  const transformer = {
    path:
      source === 'open_beauty_facts'
        ? 'scripts/phase4/import-obf-snapshot.mjs'
        : 'scripts/phase4/import-cosing-dictionary.mjs',
    parserVersion: config.parserVersion,
    files: [],
    runtime: { node: process.version },
    gitCommitSha: gitSha,
    gitTreeSha: digest('3').slice(0, 40),
    sha256: digest('4'),
  };
  const approvalManifest = {
    schemaVersion: 1,
    signatureEnvelopeVersion: 'catalog-source-approval-signature-v1',
    policyId: 'catalog-source-policy-v1',
    policySha256: digest('5'),
    trustRegistry: { registryId: trust.manifest.registryId, sha256: trust.sha256 },
    releaseScope: { scopeId: release.manifest.scopeId, sha256: release.sha256 },
    transformer,
    sourceKey: source,
    decision: 'approved',
    reviewId: `source-${source}-review`,
    decisionEvidence: {},
    reviewedAt: '2026-07-15T03:00:00.000Z',
    expiresAt: '2027-07-15T03:00:00.000Z',
    artifact: {
      sha256: digest('1'),
      bytes: 123,
      snapshotDate: '2026-07-14',
      sourceUrl:
        source === 'open_beauty_facts'
          ? 'https://static.openfoodfacts.org/data/openbeautyfacts-products.jsonl.gz'
          : 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en',
      upstreamSha256: digest('6'),
      acquisitionEvidenceUri: 'https://evidence.routinekind.app/catalog/acquisition',
      acquisitionEvidenceSha256: digest('7'),
      transformationRecordContractId: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT.contractId,
      transformationRecordSha256: transformedPayloadSha256,
    },
    termsSnapshot: {},
    attribution: {},
    scope: { appIdentity, territories: ['US'], fields: config.projectedFields },
    determinations: {},
    operations: {},
    controls: {
      offlineImportOnly: true,
      imagesIncluded: false,
      runtimeRequests: false,
      contributionBack: false,
      databaseComponentId: config.componentId,
    },
    allowedUses: [],
    forbiddenUses: [],
    reviewers: {},
    signatures: {},
  };
  const approval = retainedSnapshot(approvalManifest);
  const common = {
    generatedAt: '2026-07-15T04:00:00.000Z',
    schemaVersion: 2,
    status: 'approved_transform',
    source,
    sourceComponentId: config.componentId,
    sourcePolicy: { policyId: approvalManifest.policyId, sha256: approvalManifest.policySha256 },
    sourceApproval: {
      manifest: approval.manifest,
      manifestBytesBase64: approval.manifestBytesBase64,
      manifestSha256: approval.sha256,
      releaseBuildEvidenceSnapshot: build,
      releaseScopeSnapshot: release,
      transformerSnapshot: transformer,
      trustRegistrySnapshot: trust,
    },
    transformerCandidate: null,
    sourceSnapshot: {
      date: approvalManifest.artifact.snapshotDate,
      url: approvalManifest.artifact.sourceUrl,
      artifactSha256: approvalManifest.artifact.sha256,
      bytes: approvalManifest.artifact.bytes,
    },
    importMode: config.importMode,
    parserVersion: config.parserVersion,
    transformedPayloadContract: CATALOG_TRANSFORMED_PAYLOAD_CONTRACT,
    transformedPayloadSha256,
    projectedFields: config.projectedFields,
    sourceIsolationMode: config.isolationMode,
    controls: config.controls,
    warning: 'Hash-bound approved source transform; row promotion still requires review.',
    inputPath: `external/${source}-approved-source.bin`,
    inputSha256: approvalManifest.artifact.sha256,
  };
  return source === 'open_beauty_facts'
    ? {
        ...common,
        licenses: { images: { allowed: false } },
        totals: {
          inputRecords: records.length,
          acceptedProducts: records.length,
          rejectedRecords: 0,
          withIngredientText: records.filter((record) => record.ingredientsText).length,
        },
        products: records,
        rejected: [],
      }
    : {
        ...common,
        reuseBasis: { url: 'https://eur-lex.europa.eu/eli/dec/2011/833/oj/eng' },
        totals: {
          inputRows: records.length,
          ingredients: records.length,
          synonyms: records.reduce((sum, record) => sum + record.synonyms.length, 0),
        },
        ingredients: records,
      };
}

function reviewNaturalKey(source, record) {
  return source === 'open_beauty_facts'
    ? record.barcode
    : normalizeCosingNaturalKey(record.inciName);
}

function fixtureDatabaseCandidate(source, record, transform) {
  if (source === 'open_beauty_facts') {
    return {
      recordKind: 'product',
      canonicalKey: record.barcode,
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
    canonicalKey: normalizeCosingNaturalKey(record.inciName),
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

function fixtureNormalizedPayload(candidate) {
  if (candidate.recordKind === 'product') {
    return {
      recordKind: 'product',
      canonicalKey: candidate.canonicalKey,
      barcode: candidate.barcode,
      name: candidate.name.trim(),
      brand: candidate.brand?.trim() || null,
      category: candidate.category?.trim().toLowerCase() || null,
      ingredientsText: candidate.ingredientsText?.trim() || null,
      source: candidate.source,
      sourceRef: candidate.sourceRef.trim(),
      sourceUrl: candidate.sourceUrl.trim(),
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
    canonicalKey: candidate.canonicalKey,
    inciName: candidate.inciName.trim(),
    normalizedInciName: candidate.canonicalKey,
    displayName: candidate.displayName?.trim() || null,
    casNumber: candidate.casNumber?.trim() || null,
    ecNumber: candidate.ecNumber?.trim() || null,
    annexStatus: candidate.annexStatus?.trim() || null,
    source: candidate.source,
    sourceRef: candidate.sourceRef.trim(),
    sourceUrl: candidate.sourceUrl.trim(),
    sourceRecordStatus: candidate.sourceRecordStatus,
    glossaryDecision: candidate.glossaryDecision,
    sourceArtifactSha256: candidate.sourceArtifactSha256,
    sourceSnapshotDate: candidate.sourceSnapshotDate,
    reviewStatus: candidate.reviewStatus,
    synonyms: [...candidate.synonyms].map(normalizeCosingNaturalKey).sort(),
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function fixture({
  source = 'open_beauty_facts',
  records = source === 'open_beauty_facts' ? [obfRecord()] : [cosingRecord()],
  dispositions = [],
  transformMutate,
  qaMutate,
  reviewMutate,
} = {}) {
  const directory = mkdtempSync(join(artifactRoot, 'promotion-contract-test-'));
  const transformPath = join(directory, 'approved-transform.json');
  const qaPath = join(directory, 'qa.json');
  const reviewsPath = join(directory, 'reviews.json');
  const transform = buildTransform(source, records);
  transformMutate?.(transform);
  writeJson(transformPath, transform);
  const transformBytes = readFileSync(transformPath);
  const transformRelative = relative(root, transformPath).replace(/\\/gu, '/');
  const qa = {
    generatedAt: '2026-07-15T05:00:00.000Z',
    launchContract: structuredClone(launchContract),
    inputPath: transformRelative,
    gitSha,
    buildSourceGitSha: gitSha,
    gitStatus: '',
    source: transform.source,
    status: transform.status,
    importMode: transform.importMode,
    inputArtifact: {
      path: transformRelative,
      exists: true,
      bytes: transformBytes.length,
      sha256: sha256(transformBytes),
    },
    transformedPayloadContract: transform.transformedPayloadContract,
    transformedPayloadSha256: transform.transformedPayloadSha256,
    recomputedTransformSha256: transform.transformedPayloadSha256,
    sourceHashes: [
      { path: 'scripts/phase4/source-policy.mjs', exists: true, bytes: 1, sha256: digest('8') },
    ],
    totals: {
      records: records.length,
      rejectedRecords: 0,
      missingCategory: 0,
      missingIngredients: 0,
      duplicateIdentifiers: 0,
      provenanceDrift: 0,
      imageFields: 0,
    },
    blockers: [],
    warnings: [],
    localQaClear: true,
    launchClear: false,
    launchClearReason: CATALOG_QA_LAUNCH_CLEAR_REASON,
  };
  qaMutate?.(qa);
  writeJson(qaPath, qa);
  const qaBytes = readFileSync(qaPath);
  const qaRelative = relative(root, qaPath).replace(/\\/gu, '/');
  const batchEvidence = buildCatalogBatchEvidenceDescriptor({
    transform,
    transformArtifactSha256: sha256(transformBytes),
    qaReportUri: qaRelative,
    qaReportSha256: sha256(qaBytes),
    expectedRecordCount: records.length,
  });
  const reviewers = [
    {
      reviewerId: 'catalog-reviewer-1',
      role: 'catalog_reviewer',
      trustRegistryKeyId: 'catalog-review-key-1',
      trustRegistryRole: 'engineering',
      independenceGroup: 'catalog-operations',
      publicKeySha256: digest('b'),
      evidenceUri: 'https://evidence.routinekind.app/reviews/catalog-reviewer-1',
      evidenceSha256: digest('9'),
    },
    {
      reviewerId: 'quality-reviewer-1',
      role: 'data_quality_reviewer',
      trustRegistryKeyId: 'quality-review-key-1',
      trustRegistryRole: 'legal',
      independenceGroup: 'data-quality',
      publicKeySha256: digest('c'),
      evidenceUri: 'https://evidence.routinekind.app/reviews/quality-reviewer-1',
      evidenceSha256: digest('a'),
    },
  ];
  const review = {
    schemaVersion: 1,
    contractId: 'catalog-row-review-overlay-v1',
    signatureEnvelopeVersion: CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_ROW_REVIEW_SIGNING_DOMAIN,
    overlayId: `review-overlay-${source}`,
    source,
    sourceComponentId: sourceConfig(source).componentId,
    transformArtifactSha256: sha256(transformBytes),
    transformedPayloadSha256: transform.transformedPayloadSha256,
    sourceApprovalManifestSha256: transform.sourceApproval.manifestSha256,
    trustRegistrySha256: transform.sourceApproval.trustRegistrySnapshot.sha256,
    qaReportUri: qaRelative,
    qaReportSha256: sha256(qaBytes),
    databaseCandidatesDigestContractId: CATALOG_DATABASE_CANDIDATE_DIGEST_CONTRACT_ID,
    databaseCandidatesSha256: catalogDatabaseCandidatesSha256(
      records.map((record) => fixtureDatabaseCandidate(source, record, transform)),
    ),
    databaseBatchEvidenceSha256: catalogBatchEvidenceSha256(batchEvidence),
    reviewers,
    records: records.map((record, index) => {
      const requested = dispositions[index] ?? { disposition: 'accepted' };
      const disposition = requested.disposition;
      return {
        ordinal: index + 1,
        sourceRef: record.sourceRef,
        naturalKey: reviewNaturalKey(source, record),
        disposition,
        reasonCode:
          requested.reasonCode ??
          (disposition === 'accepted'
            ? 'accepted_after_review'
            : disposition === 'rejected'
              ? 'content_quality_rejected'
              : 'duplicate_natural_key'),
        duplicateOfNaturalKey:
          disposition === 'duplicate'
            ? (requested.duplicateOfNaturalKey ?? reviewNaturalKey(source, records[0]))
            : null,
        reviewerIds: ['catalog-reviewer-1', 'quality-reviewer-1'],
      };
    }),
    signatures: reviewers.map((reviewer, index) => ({
      reviewerId: reviewer.reviewerId,
      keyId: reviewer.trustRegistryKeyId,
      algorithm: 'Ed25519',
      valueBase64: Buffer.alloc(64, index + 1).toString('base64'),
    })),
  };
  reviewMutate?.(review);
  writeJson(reviewsPath, review);
  return {
    authorityValidator: () => syntheticAuthority,
    directory,
    outputPath: join(directory, 'stage.json'),
    qaPath,
    reviewsPath,
    transformPath,
  };
}

function cleanup(t, value) {
  t.after(() => rmSync(value.directory, { recursive: true, force: true }));
  return value;
}

function rejectsFixture(value, pattern) {
  assert.throws(() => buildCatalogStageEnvelope({ ...value, root }), pattern);
}

function databaseReceiptBundle(envelope, batchId) {
  const databasePlan = structuredClone(envelope.databasePlan);
  const expandedBindings = [];
  const chunkReceipts = [];
  let recordOrdinal = 0;
  for (const chunk of databasePlan.stage.chunks) {
    const chunkBindings = chunk.records.map((candidate) => {
      recordOrdinal += 1;
      const normalizedPayload = catalogDatabaseNormalizedPayload(candidate);
      const binding = {
        recordOrdinal,
        recordSha256: catalogDatabaseRecordSha256(normalizedPayload),
        recordKind: candidate.recordKind,
        canonicalKey: candidate.canonicalKey,
        sourcePayload: candidate,
        normalizedPayload,
        disposition: 'pending',
      };
      expandedBindings.push(binding);
      return binding;
    });
    chunkReceipts.push({
      batch_id: batchId,
      chunk_ordinal: chunk.chunkOrdinal,
      staged_record_count: recordOrdinal,
      chunk_sha256: sha256(Buffer.from(`database-chunk-${chunk.chunkOrdinal}`, 'utf8')),
      record_receipts: chunkBindings,
      replayed: false,
    });
  }
  const recordHashes = expandedBindings.map((binding) => binding.recordSha256);
  return {
    databasePlan,
    batchId,
    chunkReceipts,
    finalizeReceipt: {
      batch_id: batchId,
      batch_status: 'finalized',
      canonical_record_count: expandedBindings.length,
      duplicate_record_count: 0,
      conflict_record_count: 0,
      records_sha256: sha256(Buffer.from(recordHashes.join(''), 'utf8')),
      candidates_sha256: databasePlan.candidateBinding.databaseCandidatesSha256,
      record_receipts: expandedBindings.map(
        ({ recordOrdinal: ordinal, recordSha256, recordKind, canonicalKey, disposition }) => ({
          recordOrdinal: ordinal,
          recordSha256,
          recordKind,
          canonicalKey,
          disposition,
        }),
      ),
      replayed: false,
    },
  };
}

test('builds deterministic content-addressed envelopes and exact per-record hashes', (t) => {
  const value = cleanup(t, fixture());
  const first = buildCatalogStageEnvelope({ ...value, root });
  const second = buildCatalogStageEnvelope({ ...value, root });
  assert.deepEqual(second, first);
  assert.equal(first.contractId, CATALOG_STAGE_CONTRACT_ID);
  assert.equal(first.counts.accepted, 1);
  assert.match(first.stageDigestSha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    first.idempotencyKey,
    `${CATALOG_STAGE_CONTRACT_ID}:open_beauty_facts:${first.stageDigestSha256}`,
  );
  assert.match(first.records[0].recordSha256, /^[a-f0-9]{64}$/u);
  assert.match(first.records[0].transformRecordPayloadSha256, /^[a-f0-9]{64}$/u);
  assert.equal(Object.hasOwn(first.records[0], 'payload'), false);
  assert.equal(Object.hasOwn(first, 'generatedAt'), false);
  assert.equal(first.databasePlan.promotionExecutable, false);
  assert.equal(first.databasePlan.stage.chunks[0].records[0].recordKind, 'product');
  assert.equal(Object.keys(first.databasePlan.begin.args.p_manifest).length, 17);
  assert.deepEqual(Object.keys(first.databasePlan.stage.chunks[0].records[0]).sort(), [
    'barcode',
    'brand',
    'canonicalKey',
    'category',
    'ingredientsText',
    'name',
    'qualityGrade',
    'recordKind',
    'region',
    'reviewStatus',
    'source',
    'sourceArtifactSha256',
    'sourceComponentId',
    'sourceRecordModifiedDate',
    'sourceRef',
    'sourceSnapshotDate',
    'sourceUrl',
  ]);
  assert.equal(Object.hasOwn(first.databasePlan.stage.chunks[0], 'chunkSha256'), false);
  assert.equal(
    first.databasePlan.finalize.recordsSha256Authority,
    'finalize_catalog_import.records_sha256',
  );
  assert.match(first.databasePlan.review.intents[0].recordSha256From, /finalize_catalog_import/u);
  assert.deepEqual(first.databasePlan.review.materializedDecisionExactKeys, [
    'recordOrdinal',
    'recordSha256',
    'decision',
    'reason',
  ]);
  assert.deepEqual(first.databasePlan.review.intents[0].reviewerIds, [
    'catalog-reviewer-1',
    'quality-reviewer-1',
  ]);
  assert.equal(
    first.databasePlan.review.reviewAuthorityBinding.overlayArtifactSha256,
    first.evidence.reviews.sha256,
  );
  assert.equal(Object.hasOwn(first.databasePlan.verify, 'verificationEvidenceSha256'), false);
  assert.equal(first.databasePlan.verify.verificationEvidenceSha256AvailableAtPreflight, false);
  assert.equal(first.databasePlan.verify.verificationEvidenceSha256RequiredAtExecution, true);
  assert.deepEqual(
    first.databasePlan.verify.verificationEvidenceBundleContract.finalizeReceiptExactKeys,
    [
      'batchStatus',
      'canonicalRecordCount',
      'duplicateRecordCount',
      'conflictRecordCount',
      'recordsSha256',
      'candidatesSha256',
      'recordReceipts',
    ],
  );
  assert.equal(Object.hasOwn(first.databasePlan.promote, 'operator'), false);
  assert.equal(first.databasePlan.promote.operatorMustDifferFromReviewedBy, true);
  assert.deepEqual(
    first.databasePlan.promote.forbiddenOperatorReviewerIds,
    first.databasePlan.review.reviewerIds,
  );
  assert.equal(Object.hasOwn(first.databasePlan.rollback, 'operator'), false);
  assert.equal(first.databasePlan.rollback.operatorMustDifferFromReviewedBy, true);
  assert.equal(
    validateCatalogPromotionOperator({
      databasePlan: first.databasePlan,
      operator: 'independent-operator-1',
    }),
    'independent-operator-1',
  );
  assert.equal(
    validateCatalogPromotionOperator({
      databasePlan: first.databasePlan,
      operator: 'independent+operator',
    }),
    'independent+operator',
  );
  for (const operator of [
    first.databasePlan.review.reviewerIds[0],
    first.databasePlan.review.reviewerIds[1],
    first.databasePlan.review.reviewerIds[0].toUpperCase(),
    first.databasePlan.review.reviewedByDerivedValue,
    first.databasePlan.review.reviewedByDerivedValue.toUpperCase(),
  ]) {
    assert.throws(
      () => validateCatalogPromotionOperator({ databasePlan: first.databasePlan, operator }),
      /distinct from every signed row reviewer/u,
    );
  }

  const outputA = join(value.directory, 'stage-a.json');
  const outputB = join(value.directory, 'stage-b.json');
  writeCatalogStageEnvelope(outputA, first, root);
  writeCatalogStageEnvelope(outputB, second, root);
  assert.deepEqual(readFileSync(outputB), readFileSync(outputA));
});

test('materializes exact database receipts, minimal evidence, and receipt-bound review decisions', (t) => {
  const records = [
    obfRecord(),
    obfRecord({
      barcode: '87654325',
      name: 'Second Reviewed Moisturizer',
      sourceRef: '87654325',
      sourceUrl: 'https://world.openbeautyfacts.org/product/87654325',
    }),
  ];
  const value = cleanup(t, fixture({ records }));
  const envelope = buildCatalogStageEnvelope({ ...value, root });
  const databasePlan = structuredClone(envelope.databasePlan);
  const candidates = databasePlan.stage.chunks[0].records;
  const chunkTemplate = databasePlan.stage.chunks[0];
  databasePlan.stage.chunks = candidates.map((candidate, index) => ({
    ...chunkTemplate,
    operationKey: `${databasePlan.operationNamespace}:chunk:${index + 1}`,
    chunkOrdinal: index + 1,
    firstRecordOrdinal: index + 1,
    records: [candidate],
    canonicalJsonBytes: Buffer.byteLength(canonicalJson([candidate]), 'utf8'),
  }));

  const batchId = '11111111-1111-4111-8111-111111111111';
  const recordHashes = candidates.map((candidate) =>
    sha256(Buffer.from(canonicalJson(fixtureNormalizedPayload(candidate)), 'utf8')),
  );
  const expandedBindings = candidates.map((candidate, index) => ({
    recordOrdinal: index + 1,
    recordSha256: recordHashes[index],
    recordKind: candidate.recordKind,
    canonicalKey: candidate.canonicalKey,
    sourcePayload: candidate,
    normalizedPayload: fixtureNormalizedPayload(candidate),
    disposition: 'pending',
  }));
  const chunkReceipts = expandedBindings.map((binding, index) => ({
    batch_id: batchId,
    chunk_ordinal: index + 1,
    staged_record_count: index + 1,
    chunk_sha256: sha256(Buffer.from(`database-chunk-${index + 1}`)),
    record_receipts: [binding],
    replayed: false,
  }));
  const finalizeReceipt = {
    batch_id: batchId,
    batch_status: 'finalized',
    canonical_record_count: 2,
    duplicate_record_count: 0,
    conflict_record_count: 0,
    records_sha256: sha256(Buffer.from(recordHashes.join(''), 'utf8')),
    candidates_sha256: databasePlan.candidateBinding.databaseCandidatesSha256,
    record_receipts: expandedBindings.map(
      ({ recordOrdinal, recordSha256, recordKind, canonicalKey, disposition }) => ({
        recordOrdinal,
        recordSha256,
        recordKind,
        canonicalKey,
        disposition,
      }),
    ),
    replayed: false,
  };

  const completion = materializeCatalogDatabaseReceiptCompletion({
    databasePlan,
    batchId,
    chunkReceipts,
    finalizeReceipt,
  });
  assert.equal(
    completion.verificationEvidenceSha256,
    sha256(Buffer.from(canonicalJson(completion.verificationEvidenceBundle), 'utf8')),
  );
  assert.equal(completion.reviewDecisions.length, 2);
  assert.equal(
    completion.reviewRequest.args.p_expected_verification_evidence_sha256,
    completion.verificationEvidenceSha256,
  );
  assert.deepEqual(Object.keys(completion.reviewDecisions[0]), [
    'recordOrdinal',
    'recordSha256',
    'decision',
    'reason',
  ]);
  const retainedEvidence = canonicalJson(completion.verificationEvidenceBundle);
  assert.equal(retainedEvidence.includes('sourcePayload'), false);
  assert.equal(retainedEvidence.includes('normalizedPayload'), false);

  const envelopePath = join(value.directory, 'receipt-stage-envelope.json');
  const receiptsPath = join(value.directory, 'database-rpc-receipts.json');
  const completionOutputPath = join(value.directory, 'database-receipt-completion.json');
  const fileChunkReceipts = [
    {
      batch_id: batchId,
      chunk_ordinal: 1,
      staged_record_count: 2,
      chunk_sha256: sha256(Buffer.from('database-file-chunk-1')),
      record_receipts: expandedBindings,
      replayed: false,
    },
  ];
  writeCatalogStageEnvelope(envelopePath, envelope, root);
  writeJson(receiptsPath, {
    schemaVersion: 1,
    contractId: 'catalog-database-rpc-receipts-v1',
    batchId,
    chunkReceipts: fileChunkReceipts,
    finalizeReceipt,
  });
  const fileCompletion = completeCatalogDatabaseReceiptsFromFiles({
    envelopePath,
    receiptsPath,
    root,
    authorityValidator: () => syntheticAuthority,
  });
  assert.equal(fileCompletion.sourceStageDigestSha256, envelope.stageDigestSha256);
  assert.equal(canonicalJson(fileCompletion).includes('normalizedPayload'), false);
  writeCatalogDatabaseReceiptCompletion(completionOutputPath, fileCompletion, root);
  assert.throws(
    () => writeCatalogDatabaseReceiptCompletion(completionOutputPath, fileCompletion, root),
    /no-clobber/u,
  );
  assert.throws(
    () => completeCatalogDatabaseReceiptsFromFiles({ envelopePath, receiptsPath, root }),
    /Production import requires committed|Invalid catalog|authority/u,
  );

  const swappedPayloadChunks = structuredClone(chunkReceipts);
  swappedPayloadChunks[0].record_receipts[0].sourcePayload.name = 'Valid-key payload swap';
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan,
        batchId,
        chunkReceipts: swappedPayloadChunks,
        finalizeReceipt,
      }),
    /exact signed direct-stage candidate bytes/u,
  );
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan,
        batchId,
        chunkReceipts: chunkReceipts.slice(0, 1),
        finalizeReceipt,
      }),
    /database chunk receipts must contain/u,
  );
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan,
        batchId,
        chunkReceipts: [...chunkReceipts].reverse(),
        finalizeReceipt,
      }),
    /exact planned ordinal order/u,
  );
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan,
        batchId,
        chunkReceipts: [...chunkReceipts, structuredClone(chunkReceipts[1])],
        finalizeReceipt,
      }),
    /database chunk receipts must contain/u,
  );
  const expandedFinalize = structuredClone(finalizeReceipt);
  expandedFinalize.record_receipts[0].sourcePayload = candidates[0];
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan,
        batchId,
        chunkReceipts,
        finalizeReceipt: expandedFinalize,
      }),
    /missing or unknown fields/u,
  );
  const tamperedHash = structuredClone(finalizeReceipt);
  tamperedHash.record_receipts[0].recordSha256 = digest('f');
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan,
        batchId,
        chunkReceipts,
        finalizeReceipt: tamperedHash,
      }),
    /record-hash continuity/u,
  );
  const forgedPreflightVerification = structuredClone(databasePlan);
  forgedPreflightVerification.review.verificationEvidenceSha256 = digest('f');
  assert.throws(
    () =>
      materializeCatalogDatabaseReceiptCompletion({
        databasePlan: forgedPreflightVerification,
        batchId,
        chunkReceipts,
        finalizeReceipt,
      }),
    /post-receipt verification evidence/u,
  );
});

test('receipt completion rejects drift in every normalized field and the canonical record hash', (t) => {
  const cases = [
    {
      source: 'open_beauty_facts',
      batchId: '22222222-2222-4222-8222-222222222222',
      records: [
        obfRecord({
          brand: null,
          category: 'moisturiser_tube',
        }),
      ],
      expected: {
        category: 'moisturiser_tube',
      },
    },
    {
      source: 'cosing',
      batchId: '33333333-3333-4333-8333-333333333333',
      records: [
        cosingRecord({
          inciName: 'ＮＩＡＣＩＮＡＭＩＤＥ',
          annexStatus: null,
          synonyms: ['Vitamin\u00a0B3', 'Nicotinamide'],
        }),
      ],
      expected: {
        canonicalKey: 'NIACINAMIDE',
        synonyms: ['NICOTINAMIDE', 'VITAMIN B3'],
      },
    },
  ];

  const unicodeCategory = cleanup(
    t,
    fixture({ records: [obfRecord({ category: '\u0130\u00df\uff26\uff2f\uff2f' })] }),
  );
  rejectsFixture(unicodeCategory, /frozen ASCII product-type vocabulary/u);

  for (const receiptCase of cases) {
    const value = cleanup(t, fixture({ source: receiptCase.source, records: receiptCase.records }));
    const envelope = buildCatalogStageEnvelope({ ...value, root });
    const receiptBundle = databaseReceiptBundle(envelope, receiptCase.batchId);
    const normalizedPayload = receiptBundle.chunkReceipts[0].record_receipts[0].normalizedPayload;

    assert.equal(
      receiptBundle.databasePlan.normalizedRecordBinding.contractId,
      CATALOG_DATABASE_NORMALIZED_RECORD_HASH_CONTRACT_ID,
    );
    for (const [field, expected] of Object.entries(receiptCase.expected)) {
      assert.deepEqual(normalizedPayload[field], expected);
    }
    assert.equal(
      receiptBundle.chunkReceipts[0].record_receipts[0].recordSha256,
      sha256(Buffer.from(canonicalJson(normalizedPayload), 'utf8')),
    );
    assert.doesNotThrow(() => materializeCatalogDatabaseReceiptCompletion(receiptBundle));

    for (const field of Object.keys(normalizedPayload)) {
      const tamperedBundle = structuredClone(receiptBundle);
      const tamperedPayload = tamperedBundle.chunkReceipts[0].record_receipts[0].normalizedPayload;
      const current = tamperedPayload[field];
      tamperedPayload[field] = Array.isArray(current)
        ? [...current, `${field}-tampered`]
        : current === null
          ? `${field}-tampered`
          : `${current}-tampered`;
      assert.throws(
        () => materializeCatalogDatabaseReceiptCompletion(tamperedBundle),
        /normalized payload does not exactly match migration 0057 derivation/u,
        `${receiptCase.source}.${field} drift must fail before review materialization`,
      );
    }

    const tamperedHashBundle = structuredClone(receiptBundle);
    tamperedHashBundle.chunkReceipts[0].record_receipts[0].recordSha256 = digest('f');
    assert.throws(
      () => materializeCatalogDatabaseReceiptCompletion(tamperedHashBundle),
      /shared PostgreSQL\/JavaScript normalized-record hash contract/u,
      `${receiptCase.source} record hash drift must fail before review materialization`,
    );

    const downgradedPlanBundle = structuredClone(receiptBundle);
    downgradedPlanBundle.databasePlan.normalizedRecordBinding.recordHash =
      'trust-database-receipt-without-recomputation';
    assert.throws(
      () => materializeCatalogDatabaseReceiptCompletion(downgradedPlanBundle),
      /normalized-record hash contract does not match migration 0057/u,
    );
  }

  const migrationSql = readFileSync(
    resolve(root, 'supabase/migrations/20260717000057_catalog_import_lifecycle.sql'),
    'utf8',
  );
  assert.match(
    migrationSql,
    /v_record_sha256 := private\.catalog_import_sha256_text\(\s*private\.catalog_import_canonical_json\(v_normalized\)\s*\)/su,
  );
  assert.match(
    migrationSql,
    /records\.record_sha256 <> private\.catalog_import_sha256_text\(\s*private\.catalog_import_canonical_json\(records\.normalized_payload\)\s*\)/su,
  );
  assert.match(migrationSql, /synonyms\.value order by synonyms\.value collate pg_catalog\."C"/u);
  assert.match(
    migrationSql,
    /v_record ->> 'category' not in \(\s*'cleanser', 'toner', 'serum', 'moisturiser_tube', 'spf'\s*\)/su,
  );
  assert.match(migrationSql, /'category', v_record -> 'category'/u);
});

test('rejects fixture, candidate, forged, and missing approval bindings', (t) => {
  const cases = [
    [
      'fixture path',
      (transform) => {
        transform.inputPath = 'scripts/phase4/fixtures/copied-production.jsonl';
      },
      /fixture bytes or fixture paths/u,
    ],
    [
      'copied fixture hash',
      (transform) => {
        transform.inputSha256 = 'c9a150c17cac824f78a85671544bea22fa04156dbbc4693b6ff3538a6205a8e5';
        transform.sourceSnapshot.artifactSha256 = transform.inputSha256;
      },
      /fixture bytes or fixture paths/u,
    ],
    [
      'candidate status',
      (transform) => {
        transform.status = 'candidate_transform_not_approved';
        transform.importMode = 'candidate_hash_only';
      },
      /not the exact approved/u,
    ],
    [
      'forged approval decision',
      (transform) => {
        transform.sourceApproval.manifest.decision = 'pending';
      },
      /retained bytes do not match/u,
    ],
    [
      'missing release build snapshot',
      (transform) => {
        delete transform.sourceApproval.releaseBuildEvidenceSnapshot;
      },
      /missing or unknown fields/u,
    ],
  ];
  for (const [, transformMutate, pattern] of cases) {
    const value = cleanup(t, fixture({ transformMutate }));
    rejectsFixture(value, pattern);
  }
});

test('rejects duplicate JSON keys before parser last-value recovery', (t) => {
  const value = cleanup(t, fixture());
  const qa = readFileSync(value.qaPath, 'utf8');
  rmSync(value.qaPath);
  writeFileSync(
    value.qaPath,
    qa.replace('{\n', '{\n  "generatedAt": "2026-07-15T05:00:00.000Z",\n'),
    { flag: 'wx' },
  );
  rejectsFixture(value, /duplicate JSON key generatedAt/u);
});

test('rejects QA blockers, warnings, dirty state, and payload drift', (t) => {
  const mutations = [
    (qa) => {
      qa.blockers = ['blocked'];
      qa.localQaClear = false;
    },
    (qa) => {
      qa.warnings = ['warning'];
      qa.localQaClear = false;
    },
    (qa) => {
      qa.gitStatus = ' M dirty-file';
      qa.localQaClear = false;
    },
    (qa) => {
      qa.recomputedTransformSha256 = digest('f');
    },
    (qa) => {
      qa.launchClear = true;
    },
    (qa) => {
      qa.launchClearReason = 'Yes.';
    },
    (qa) => {
      qa.launchContract.mode = 'invented-mode';
    },
  ];
  for (const qaMutate of mutations) {
    const value = cleanup(t, fixture({ qaMutate }));
    rejectsFixture(value, /QA/u);
  }
});

test('signed batch provenance rejects identical candidates with a different QA artifact', (t) => {
  const value = cleanup(t, fixture());
  const qa = JSON.parse(readFileSync(value.qaPath, 'utf8'));
  qa.generatedAt = '2026-07-15T05:00:01.000Z';
  rmSync(value.qaPath);
  writeJson(value.qaPath, qa);
  rejectsFixture(value, /QA report, batch provenance/u);
});

test('does not trust forged zero QA counts for incomplete OBF records', (t) => {
  const records = [obfRecord({ category: null })];
  const value = cleanup(t, fixture({ records }));
  rejectsFixture(value, /cannot be zero-warning/u);
});

test('requires a database-executable OBF source modification date', (t) => {
  for (const sourceRecordModifiedDate of [null, '2026-02-31', '2026-07-15']) {
    const records = [obfRecord({ sourceRecordModifiedDate })];
    const value = cleanup(t, fixture({ records }));
    rejectsFixture(value, /sourceRecordModifiedDate/u);
  }
});

test('rejects checksum-invalid and noncanonical padded OBF natural keys', (t) => {
  for (const barcode of [
    '12345678',
    '0036000291452',
    '00000096385074',
    '00012345678905',
    '04006381333931',
  ]) {
    const records = [
      obfRecord({
        barcode,
        sourceRef: barcode,
        sourceUrl: `https://world.openbeautyfacts.org/product/${barcode}`,
      }),
    ];
    const value = cleanup(t, fixture({ records }));
    rejectsFixture(value, /checksum-valid canonical GTIN/u);
  }
});

test('preserves the governed 20,000-code-unit OBF ingredient-text boundary', (t) => {
  const maximum = 'I'.repeat(20_000);
  const accepted = cleanup(t, fixture({ records: [obfRecord({ ingredientsText: maximum })] }));
  const envelope = buildCatalogStageEnvelope({ ...accepted, root });
  assert.equal(envelope.databasePlan.stage.chunks[0].records[0].ingredientsText.length, 20_000);

  const maximumAstral = '🧴'.repeat(10_000);
  const acceptedAstral = cleanup(
    t,
    fixture({ records: [obfRecord({ ingredientsText: maximumAstral })] }),
  );
  const astralEnvelope = buildCatalogStageEnvelope({ ...acceptedAstral, root });
  assert.equal(
    astralEnvelope.databasePlan.stage.chunks[0].records[0].ingredientsText.length,
    20_000,
  );

  const oversized = cleanup(
    t,
    fixture({ records: [obfRecord({ ingredientsText: `${maximum}I` })] }),
  );
  rejectsFixture(oversized, /ingredientsText/u);
  const oversizedAstral = cleanup(
    t,
    fixture({ records: [obfRecord({ ingredientsText: `${maximumAstral}🧴` })] }),
  );
  rejectsFixture(oversizedAstral, /ingredientsText/u);
});

test('requires complete explicit reviews, exact fields, and independent reviewer evidence', (t) => {
  const mutations = [
    (review) => {
      review.records[0].disposition = 'pending';
    },
    (review) => {
      review.records = [];
    },
    (review) => {
      delete review.records[0].reasonCode;
    },
    (review) => {
      review.records[0].unexpected = true;
    },
    (review) => {
      review.reviewers[1].reviewerId = review.reviewers[0].reviewerId;
    },
    (review) => {
      review.reviewers[1].independenceGroup = review.reviewers[0].independenceGroup;
    },
    (review) => {
      review.reviewers[1].trustRegistryRole = review.reviewers[0].trustRegistryRole;
    },
    (review) => {
      review.reviewers.push({
        ...review.reviewers[0],
        reviewerId: 'third-reviewer-1',
        trustRegistryKeyId: 'third-review-key-1',
        independenceGroup: 'third-review-group',
        publicKeySha256: digest('d'),
        evidenceUri: 'https://evidence.routinekind.app/reviews/third-reviewer-1',
        evidenceSha256: digest('e'),
      });
    },
    (review) => {
      review.records[0].reviewerIds[0] = review.records[0].reviewerIds[0].toUpperCase();
    },
    (review) => {
      review.signatures.pop();
    },
    (review) => {
      review.databaseCandidatesSha256 = digest('f');
    },
    (review) => {
      review.databaseBatchEvidenceSha256 = digest('f');
    },
  ];
  for (const reviewMutate of mutations) {
    const value = cleanup(t, fixture({ reviewMutate }));
    rejectsFixture(value, /review overlay/u);
  }
});

test('row reviewers resolve to current trust keys and cannot reuse source approvers', () => {
  const reviewerDefinitions = [
    {
      reviewerId: 'catalog-reviewer-1',
      role: 'catalog_reviewer',
      trustRegistryKeyId: 'catalog-review-key-1',
      trustRegistryRole: 'engineering',
      independenceGroup: 'catalog-operations',
      evidenceUri: 'https://evidence.routinekind.app/reviews/catalog-reviewer-1',
      evidenceSha256: digest('9'),
    },
    {
      reviewerId: 'quality-reviewer-1',
      role: 'data_quality_reviewer',
      trustRegistryKeyId: 'quality-review-key-1',
      trustRegistryRole: 'legal',
      independenceGroup: 'data-quality',
      evidenceUri: 'https://evidence.routinekind.app/reviews/quality-reviewer-1',
      evidenceSha256: digest('a'),
    },
  ];
  const signingKeys = reviewerDefinitions.map(() => generateKeyPairSync('ed25519'));
  const publicKeyBytes = signingKeys.map(({ publicKey }) =>
    publicKey.export({ format: 'der', type: 'spki' }),
  );
  const reviewers = reviewerDefinitions.map((reviewer, index) => ({
    ...reviewer,
    publicKeySha256: sha256(publicKeyBytes[index]),
  }));
  const trustRegistry = {
    registryId: 'catalog-source-trust-v1',
    epoch: 7,
    status: 'active',
    reviewers: reviewers.map((reviewer, index) => ({
      keyId: reviewer.trustRegistryKeyId,
      reviewerId: reviewer.reviewerId,
      role: reviewer.trustRegistryRole,
      status: 'active',
      independenceGroup: reviewer.independenceGroup,
      publicKeySpkiBase64: publicKeyBytes[index].toString('base64'),
      publicKeySha256: reviewer.publicKeySha256,
      evidence: { uri: reviewer.evidenceUri, sha256: reviewer.evidenceSha256 },
    })),
  };
  const approval = {
    reviewers: {
      legal: {
        keyId: 'source-legal-key-1',
        reviewerId: 'source-legal-reviewer-1',
        publicKeySha256: digest('d'),
      },
      engineering: {
        keyId: 'source-engineering-key-1',
        reviewerId: 'source-engineering-reviewer-1',
        publicKeySha256: digest('e'),
      },
    },
  };
  const overlay = {
    schemaVersion: 1,
    contractId: 'catalog-row-review-overlay-v1',
    signatureEnvelopeVersion: CATALOG_ROW_REVIEW_SIGNATURE_ENVELOPE,
    signingDomain: CATALOG_ROW_REVIEW_SIGNING_DOMAIN,
    overlayId: 'signed-overlay-unit-test',
    source: 'open_beauty_facts',
    sourceComponentId: 'obf_odbl_component',
    transformArtifactSha256: digest('1'),
    transformedPayloadSha256: digest('2'),
    sourceApprovalManifestSha256: digest('3'),
    trustRegistrySha256: digest('4'),
    databaseCandidatesSha256: digest('5'),
    reviewers,
    records: [
      {
        ordinal: 1,
        sourceRef: '12345670',
        naturalKey: '12345670',
        disposition: 'accepted',
        reasonCode: 'accepted_after_review',
        duplicateOfNaturalKey: null,
        reviewerIds: reviewers.map((reviewer) => reviewer.reviewerId),
      },
    ],
    signatures: [],
  };
  overlay.signatures = reviewers.map((reviewer, index) => ({
    reviewerId: reviewer.reviewerId,
    keyId: reviewer.trustRegistryKeyId,
    algorithm: 'Ed25519',
    valueBase64: sign(
      null,
      catalogRowReviewSigningPayload(overlay, reviewer.reviewerId),
      signingKeys[index].privateKey,
    ).toString('base64'),
  }));

  const authority = validateRowReviewTrustAuthority({
    reviewers,
    overlay,
    trustRegistry,
    approval,
  });
  assert.equal(authority.sourceApprovalIdentityReuse, false);
  assert.deepEqual(
    authority.reviewers.map((reviewer) => reviewer.reviewerId),
    ['catalog-reviewer-1', 'quality-reviewer-1'],
  );

  const mismatchedTrust = structuredClone(trustRegistry);
  mismatchedTrust.reviewers[0].publicKeySha256 = digest('f');
  assert.throws(
    () =>
      validateRowReviewTrustAuthority({
        reviewers,
        overlay,
        trustRegistry: mismatchedTrust,
        approval,
      }),
    /does not exactly match/u,
  );

  const reusedApproval = structuredClone(approval);
  reusedApproval.reviewers.legal.reviewerId = reviewers[0].reviewerId;
  assert.throws(
    () =>
      validateRowReviewTrustAuthority({
        reviewers,
        overlay,
        trustRegistry,
        approval: reusedApproval,
      }),
    /must not reuse source-approval identities/u,
  );

  const tamperedOverlay = structuredClone(overlay);
  tamperedOverlay.records[0].disposition = 'rejected';
  assert.throws(
    () =>
      validateRowReviewTrustAuthority({
        reviewers,
        overlay: tamperedOverlay,
        trustRegistry,
        approval,
      }),
    /signature does not authorize/u,
  );
});

test('rejects Unicode-normalized CosIng collisions when any colliding row is accepted', (t) => {
  const records = [
    cosingRecord({
      inciName: 'A\u030A',
      displayName: 'Combining Ring',
      sourceRef: 'COSING:10',
      casNumber: '100-00-1',
      ecNumber: '200-000-1',
      synonyms: ['FIRST NAME'],
    }),
    cosingRecord({
      inciName: '\u00C5',
      displayName: 'Precomposed Ring',
      sourceRef: 'COSING:11',
      casNumber: '100-00-2',
      ecNumber: '200-000-2',
      synonyms: ['SECOND NAME'],
    }),
  ];
  const value = cleanup(t, fixture({ source: 'cosing', records }));
  rejectsFixture(value, /accepts a colliding/u);
});

test('CosIng canonical keys use NFKC, collapsed whitespace, and deterministic uppercase', () => {
  assert.equal(normalizeCosingNaturalKey('A\u030A'), normalizeCosingNaturalKey('\u00C5'));
  assert.equal(
    normalizeCosingNaturalKey('\uFF27\uFF2C\uFF39\uFF23\uFF25\uFF32\uFF29\uFF2E'),
    'GLYCERIN',
  );
  assert.equal(normalizeCosingNaturalKey('  sodium\t hyaluronate  '), 'SODIUM HYALURONATE');
  const sharedWhitespaceCodePoints = [
    0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
    0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
    0xfeff,
  ];
  for (const codePoint of sharedWhitespaceCodePoints) {
    assert.equal(
      normalizeCosingNaturalKey(`alpha${String.fromCodePoint(codePoint)}beta`),
      'ALPHA BETA',
    );
  }
  assert.equal(
    normalizeCosingNaturalKey(` \t\u00a0\u2028\ufeffalpha\u3000\u2009beta\u202f `),
    'ALPHA BETA',
  );
  assert.deepEqual(
    ['é', 'ß', 'ı', '\u0130', 'A\u030A', '\uFF47\uFF4C\uFF59\uFF43\uFF45\uFF52\uFF49\uFF4E'].map(
      normalizeCosingNaturalKey,
    ),
    ['É', 'SS', 'I', '\u0130', 'Å', 'GLYCERIN'],
  );
});

test('database candidate digest canonicalizes key order and binds Unicode, nulls, controls, and arrays', () => {
  const first = [
    {
      zeta: 'Ångström\nline',
      alpha: null,
      values: ['😀', '\t', 'SECOND'],
    },
  ];
  const reorderedKeys = [
    {
      values: ['😀', '\t', 'SECOND'],
      alpha: null,
      zeta: 'Ångström\nline',
    },
  ];
  assert.equal(
    catalogDatabaseCandidatesSha256(first),
    catalogDatabaseCandidatesSha256(reorderedKeys),
  );
  assert.notEqual(
    catalogDatabaseCandidatesSha256(first),
    catalogDatabaseCandidatesSha256([{ ...first[0], alpha: '' }]),
  );
  assert.notEqual(
    catalogDatabaseCandidatesSha256(first),
    catalogDatabaseCandidatesSha256([{ ...first[0], values: [...first[0].values].reverse() }]),
  );
  const orderedRecords = [first[0], { alpha: 'second', values: [], zeta: null }];
  assert.notEqual(
    catalogDatabaseCandidatesSha256(orderedRecords),
    catalogDatabaseCandidatesSha256([...orderedRecords].reverse()),
  );
  assert.throws(
    () =>
      catalogProjectedExpandedReceiptBytes(
        Array(100_000).fill({ alpha: 'x'.repeat(100), values: [], zeta: null }),
      ),
    /exceed the 256 MiB completion-input bound/u,
  );
});

test('database plan carries the exact compatibility-normalized CosIng canonical key', (t) => {
  const records = [cosingRecord({ inciName: '\uFF27\uFF2C\uFF39\uFF23\uFF25\uFF32\uFF29\uFF2E' })];
  const value = cleanup(t, fixture({ source: 'cosing', records }));
  const envelope = buildCatalogStageEnvelope({ ...value, root });
  assert.equal(envelope.databasePlan.stage.chunks[0].records[0].canonicalKey, 'GLYCERIN');
  assert.equal(envelope.databasePlan.stage.chunks[0].records[0].recordKind, 'ingredient');
});

test('rejects cross-record CAS, source-reference, and INCI/synonym collisions', (t) => {
  const cases = [
    [
      cosingRecord({
        inciName: 'FIRST INCI',
        sourceRef: 'COSING:20',
        casNumber: '100-10-1',
        ecNumber: '200-010-1',
        synonyms: ['FIRST SYNONYM'],
      }),
      cosingRecord({
        inciName: 'SECOND INCI',
        sourceRef: 'COSING:21',
        casNumber: '100-10-1',
        ecNumber: '200-010-2',
        synonyms: ['SECOND SYNONYM'],
      }),
    ],
    [
      cosingRecord({
        inciName: 'THIRD INCI',
        sourceRef: 'COSING:SAME',
        casNumber: '100-20-1',
        ecNumber: '200-020-1',
        synonyms: ['THIRD SYNONYM'],
      }),
      cosingRecord({
        inciName: 'FOURTH INCI',
        sourceRef: 'COSING:SAME',
        casNumber: '100-20-2',
        ecNumber: '200-020-2',
        synonyms: ['FOURTH SYNONYM'],
      }),
    ],
    [
      cosingRecord({
        inciName: 'NIACINAMIDE',
        sourceRef: 'COSING:30',
        casNumber: '100-30-1',
        ecNumber: '200-030-1',
        synonyms: ['GLYCERIN'],
      }),
      cosingRecord({
        inciName: 'GLYCERIN',
        sourceRef: 'COSING:31',
        casNumber: '100-30-2',
        ecNumber: '200-030-2',
        synonyms: ['GLYCEROL'],
      }),
    ],
  ];
  for (const records of cases) {
    const value = cleanup(t, fixture({ source: 'cosing', records }));
    rejectsFixture(value, /accepts a colliding/u);
  }
});

test('structural QA permits an evidence-only descendant HEAD while binding the build source', (t) => {
  const value = cleanup(
    t,
    fixture({
      qaMutate(qa) {
        qa.gitSha = 'b'.repeat(40);
      },
    }),
  );
  const envelope = buildCatalogStageEnvelope({ ...value, root });
  assert.equal(envelope.authority.buildSourceGitSha, gitSha);
  assert.equal(envelope.authority.evidenceHeadGitSha, 'b'.repeat(40));
});

test('current QA source hash verifier requires the exact ordered committed authority inventory', (t) => {
  const repository = mkdtempSync(join(artifactRoot, 'qa-authority-repository-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  for (const path of REQUIRED_PROMOTION_QA_SOURCE_PATHS) {
    const destination = resolve(repository, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(root, path), destination);
  }
  const git = (args) => {
    const result = spawnSync('git', ['-c', `safe.directory=${repository}`, ...args], {
      cwd: repository,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${args.join(' ')} failed: ${result.stderr || result.stdout}`);
    return result.stdout.trim();
  };
  git(['init', '--quiet']);
  git(['config', 'user.email', 'catalog-contract@example.invalid']);
  git(['config', 'user.name', 'Catalog Contract']);
  git(['add', '--all']);
  git(['commit', '--quiet', '-m', 'fixture']);
  const qaGitSha = git(['rev-parse', 'HEAD']);
  const currentHashes = () =>
    REQUIRED_PROMOTION_QA_SOURCE_PATHS.map((path) => {
      const bytes = readFileSync(resolve(repository, path));
      return { path, exists: true, bytes: bytes.length, sha256: sha256(bytes) };
    });
  const sourceHashes = currentHashes();
  validatePromotionQaSourceHashes({ gitSha: qaGitSha, sourceHashes }, repository);
  const forged = structuredClone(sourceHashes);
  forged[0].sha256 = digest('f');
  assert.throws(
    () => validatePromotionQaSourceHashes({ gitSha: qaGitSha, sourceHashes: forged }, repository),
    /does not match the current exact file bytes/u,
  );
  assert.throws(
    () =>
      validatePromotionQaSourceHashes(
        { gitSha: qaGitSha, sourceHashes: sourceHashes.slice(1) },
        repository,
      ),
    /must contain between/u,
  );
  const reordered = structuredClone(sourceHashes);
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () =>
      validatePromotionQaSourceHashes({ gitSha: qaGitSha, sourceHashes: reordered }, repository),
    /exactly match the ordered promotion authority paths/u,
  );

  const migrationPath = resolve(
    repository,
    'supabase/migrations/20260717000057_catalog_import_lifecycle.sql',
  );
  const migrationBytes = readFileSync(migrationPath);
  writeFileSync(migrationPath, Buffer.concat([migrationBytes, Buffer.from('\n')]));
  assert.throws(
    () => assertCatalogSourceTreeClean(repository),
    /Dirty paths:[\s\S]*20260717000057_catalog_import_lifecycle[.]sql/u,
  );
  writeFileSync(migrationPath, migrationBytes);
  assert.doesNotThrow(() => assertCatalogSourceTreeClean(repository));

  const hiddenDirtyPath = resolve(repository, REQUIRED_PROMOTION_QA_SOURCE_PATHS[0]);
  git(['update-index', '--assume-unchanged', REQUIRED_PROMOTION_QA_SOURCE_PATHS[0]]);
  writeFileSync(hiddenDirtyPath, Buffer.concat([readFileSync(hiddenDirtyPath), Buffer.from('\n')]));
  assert.throws(
    () =>
      validatePromotionQaSourceHashes(
        { gitSha: qaGitSha, sourceHashes: currentHashes() },
        repository,
      ),
    /does not match its exact committed Git blob/u,
  );
});

test('CosIng rows outside the database annex enum must be explicitly rejected', (t) => {
  const records = [cosingRecord({ annexStatus: 'not-a-db-enum' })];
  const accepted = cleanup(t, fixture({ source: 'cosing', records }));
  rejectsFixture(accepted, /must reject a CosIng annex status/u);

  const rejected = cleanup(
    t,
    fixture({
      source: 'cosing',
      records,
      dispositions: [{ disposition: 'rejected', reasonCode: 'invalid_annex_status' }],
    }),
  );
  const envelope = buildCatalogStageEnvelope({ ...rejected, root });
  assert.equal(envelope.counts.rejected, 1);
  assert.equal(envelope.counts.accepted, 0);
});

test('output path is bounded, symlink-safe, no-clobber, and leaves no partial temp files', (t) => {
  const value = cleanup(t, fixture());
  const envelope = buildCatalogStageEnvelope({ ...value, root });
  assert.throws(
    () => writeCatalogStageEnvelope(resolve(root, 'outside-stage.json'), envelope, root),
    /artifacts\/phase4/u,
  );
  writeCatalogStageEnvelope(value.outputPath, envelope, root);
  const before = readFileSync(value.outputPath);
  assert.throws(() => writeCatalogStageEnvelope(value.outputPath, envelope, root), /no-clobber/u);
  assert.deepEqual(readFileSync(value.outputPath), before);
  assert.deepEqual(
    readdirSync(value.directory).filter((name) => name.endsWith('.tmp')),
    [],
  );

  const target = join(value.directory, 'real-output-parent');
  const link = join(value.directory, 'linked-output-parent');
  mkdirSync(target);
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(
      () => writeCatalogStageEnvelope(join(link, 'stage.json'), envelope, root),
      /symlink|junction|real canonical/u,
    );
  } catch (error) {
    if (!['EPERM', 'EACCES', 'UNKNOWN'].includes(error?.code)) throw error;
  }
});

test('CLI requires exact flags and cannot bypass current production authority', (t) => {
  const value = cleanup(t, fixture());
  const firstOutput = join(value.directory, 'cli-stage-a.json');
  const run = (outputPath, extra = []) =>
    spawnSync(
      process.execPath,
      [
        cliPath,
        '--transform',
        value.transformPath,
        '--qa',
        value.qaPath,
        '--reviews',
        value.reviewsPath,
        '--output',
        outputPath,
        ...extra,
      ],
      { cwd: root, encoding: 'utf8' },
    );
  const first = run(firstOutput);
  assert.notEqual(first.status, 0);
  assert.match(first.stderr, /Production import requires committed|Invalid catalog|authority/u);
  const unknown = run(join(value.directory, 'unused.json'), ['--target', 'production']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unknown or positional CLI argument/u);

  const completionUnknown = spawnSync(
    process.execPath,
    [
      completionCliPath,
      '--envelope',
      value.transformPath,
      '--receipts',
      value.qaPath,
      '--output',
      join(value.directory, 'unused-completion.json'),
      '--target',
      'production',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(completionUnknown.status, 0);
  assert.match(completionUnknown.stderr, /unknown or positional CLI argument/u);
  const completionMissing = spawnSync(process.execPath, [completionCliPath, '--envelope'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(completionMissing.status, 0);
  assert.match(completionMissing.stderr, /requires an explicit path|missing required CLI flag/u);
});
