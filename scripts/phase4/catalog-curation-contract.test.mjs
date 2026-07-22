import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  buildCatalogCoverageQualityReport,
  buildCatalogCurationEnvelope,
  catalogActivationAuthorizationSigningPayload,
  catalogCat02ArtifactSetSha256,
  catalogCat02DatabaseObservationSha256,
  catalogCat02DatabaseNormalizedRecordSha256,
  catalogCat02DependencyEntitySha256,
  catalogCat02MembershipProofSigningPayload,
  catalogCat02ProductionIntegritySetSha256,
  catalogCat02ProofMembershipSetSha256,
  catalogCat02VerifierSignatureSetSha256,
  catalogCorpusConsentStateSha256,
  catalogCurationActivationAuthorizationSetSha256,
  catalogCurationCampaignAuthoritySha256,
  catalogCurationCandidateSetSha256,
  catalogCurationDatabaseRecordSet,
  catalogCurationDatabaseRecordSetSha256,
  catalogCurationDecisionCommitment,
  catalogCurationManifestSha256,
  catalogCurationOutcomeReviewerSignatureSetSha256,
  catalogCurationReviewSigningPayload,
  catalogDatabaseCampaignPlanSha256,
  catalogDatabaseReadbackSigningPayload,
  catalogDatabaseReviewAuthorizationSigningPayload,
  CATALOG_CURATION_REQUIRED_DATABASE_CONTRACT_TEST_SHA256,
  CATALOG_CURATION_REQUIRED_MIGRATION_SHA256,
  CATALOG_CURATION_REQUIRED_SCHEMA_MIGRATION_VERSION,
  CATALOG_DB_ELIGIBILITY_POLICY_GOLDEN_CANONICAL_JSON,
  CATALOG_DB_ELIGIBILITY_POLICY_GOLDEN_SHA256,
  catalogDbEligibilityPolicyCanonicalJson,
  catalogDbEligibilityPolicySha256,
  catalogDemandCommitmentOutputSetSha256,
  catalogDocumentSha256,
  catalogExternalTimestampReceiptSigningPayload,
  catalogHoldoutAggregateOutcomeSetSha256,
  catalogHoldoutCategoryOutcomeSetSha256,
  catalogHoldoutControlReceiptSigningPayload,
  catalogHoldoutOperationalOutcomeSetSha256,
  catalogPrivacyExecutionReceiptSigningPayload,
  catalogPreholdoutDecisionSigningPayload,
  catalogPreholdoutLedgerEntrySha256,
  catalogPreholdoutLedgerRootSha256,
  catalogRecordReviewerSignatureSetSha256,
  catalogRegulatorySignatureSetSha256,
  catalogServedStateMutationRootSetSha256,
  catalogTargetPolicySigningPayload,
  evaluateCatalogCoverageTargets,
  evaluateCatalogInventoryTargets,
  readCatalogCurationInput,
  validateCatalogBetaCorpus,
  validateCatalogCat02MembershipProof,
  validateCatalogCurationEnvelope,
  validateCatalogCurationReview,
  validateCatalogDatabaseReadback,
  validateCatalogTargetPolicy,
  wilsonOneSidedBounds,
} from './catalog-curation-contract.mjs';
import { canonicalJson, sha256, trustRegistrySigningPayload } from './source-policy.mjs';

const root = resolve(import.meta.dirname, '../..');
const CATEGORIES = ['acne_treatment', 'cleanser', 'moisturizer', 'serum', 'sunscreen', 'toner'];
const CATEGORY_FLOORS = {
  acne_treatment: 334,
  cleanser: 334,
  moisturizer: 333,
  serum: 333,
  sunscreen: 333,
  toner: 333,
};
const SCOPES = ['barcode_identity', 'category', 'ingredients', 'regulatory_classification'];

function cat02TestMembershipSortKey(membership) {
  return `${membership.productRecordSha256}:${membership.fieldScope}:${membership.dependencyEntitySha256}:${membership.batchId}`;
}

function h(value) {
  return sha256(Buffer.from(value, 'utf8'));
}

function keyMaterial() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyBytes = Buffer.from(publicKey.export({ format: 'der', type: 'spki' }));
  return { privateKey, publicKeyBytes, publicKeySha256: sha256(publicKeyBytes) };
}

function signerDefinition({ decisionRole, reviewerId, keyId, trustRegistryRole, group, key }) {
  return {
    decisionRole,
    reviewerId,
    trustRegistryKeyId: keyId,
    trustRegistryRole,
    independenceGroup: group,
    publicKeySha256: key.publicKeySha256,
    qualificationEvidenceSha256: h(`credential:${reviewerId}`),
  };
}

function makeAuthority() {
  const definitions = [
    ['quality_target_owner', 'target-owner', 'target-owner-key', 'engineering'],
    ['privacy_reviewer', 'privacy-reviewer', 'privacy-review-key', 'legal'],
    [
      'cat02_database_membership_verifier',
      'cat02-db-verifier',
      'cat02-db-verifier-key',
      'engineering',
    ],
    ['catalog_quality_reviewer', 'catalog-reviewer', 'catalog-review-key', 'engineering'],
    ['data_quality_reviewer', 'data-reviewer', 'data-review-key', 'engineering'],
    ['curation_decision_owner', 'decision-owner', 'decision-owner-key', 'engineering'],
    ['commitment_ledger_witness', 'ledger-witness', 'ledger-witness-key', 'engineering'],
    [
      'external_timestamp_authority',
      'timestamp-authority',
      'timestamp-authority-key',
      'engineering',
    ],
    ['regulatory_reviewer', 'regulatory-reviewer', 'regulatory-review-key', 'legal'],
    ['privacy_release_verifier', 'privacy-release-verifier', 'privacy-release-key', 'legal'],
    ['holdout_data_custodian', 'holdout-custodian', 'holdout-custodian-key', 'engineering'],
    ['privacy_pipeline_verifier', 'privacy-pipeline-verifier', 'privacy-pipeline-key', 'legal'],
    ['activation_operator', 'activation-operator', 'activation-operator-key', 'engineering'],
    ['database_verifier', 'database-verifier', 'database-verifier-key', 'engineering'],
  ];
  const byRole = new Map();
  const reviewers = definitions.map(([decisionRole, reviewerId, keyId, role], index) => {
    const key = keyMaterial();
    const signer = signerDefinition({
      decisionRole,
      reviewerId,
      keyId,
      trustRegistryRole: role,
      group: `${reviewerId}-group`,
      key,
    });
    byRole.set(decisionRole, { signer, key });
    return {
      keyId,
      reviewerId,
      role,
      status: 'active',
      name: `Independent Authority ${index + 1}`,
      qualification: `Qualified ${decisionRole.replaceAll('_', ' ')} for US catalog evidence`,
      jurisdictions: ['US'],
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2027-12-31T23:59:59.999Z',
      independenceGroup: signer.independenceGroup,
      publicKeySpkiBase64: key.publicKeyBytes.toString('base64'),
      publicKeySha256: key.publicKeySha256,
      evidence: {
        recordId: `credential-record-${index + 1}`,
        uri: `https://evidence.routinekind.app/credentials/authority-${index + 1}`,
        sha256: signer.qualificationEvidenceSha256,
      },
    };
  });
  const rootKey = keyMaterial();
  const trustRegistry = {
    schemaVersion: 1,
    registryId: 'catalog-source-trust-v1',
    policyId: 'catalog-source-policy-v1',
    epoch: 1,
    status: 'active',
    updatedAt: '2026-07-01T00:00:00.000Z',
    reviewers,
    rootSignature: null,
  };
  trustRegistry.rootSignature = {
    envelopeVersion: 'catalog-source-trust-registry-signature-v1',
    algorithm: 'Ed25519',
    keyId: 'catalog-offline-root-key-1',
    publicKeySha256: rootKey.publicKeySha256,
    signedAt: trustRegistry.updatedAt,
    valueBase64: sign(
      null,
      trustRegistrySigningPayload(trustRegistry),
      rootKey.privateKey,
    ).toString('base64'),
  };
  const trustRegistryBytes = Buffer.from(`${JSON.stringify(trustRegistry, null, 2)}\n`, 'utf8');
  const trustRegistryArtifactSha256 = sha256(trustRegistryBytes);
  return {
    byRole,
    trustRegistry,
    trustRegistryArtifactSha256,
    trustedRoot: {
      keyId: 'catalog-offline-root-key-1',
      publicKeySpkiBase64: rootKey.publicKeyBytes.toString('base64'),
      registryEpoch: 1,
      registrySha256: trustRegistryArtifactSha256,
    },
  };
}

function signDocument(document, roleEntries, payload) {
  document.signatures = roleEntries.map(({ signer, key, signedAt }) => {
    const signature = {
      decisionRole: signer.decisionRole,
      reviewerId: signer.reviewerId,
      trustRegistryKeyId: signer.trustRegistryKeyId,
      algorithm: 'Ed25519',
      signedAt,
      valueBase64: '',
    };
    signature.valueBase64 = sign(null, payload(document, signature), key.privateKey).toString(
      'base64',
    );
    return signature;
  });
}

function makeTargetPolicy(authority) {
  const databaseEligibilityPolicy = {
    contractId: 'catalog-launch-db-eligibility-policy-v1',
    territory: 'US',
    requiredQualityGrade: 'verified',
    minimumDataQualityScore: 95,
    minimumIngredientQualityScore: 95,
    minimumBarcodeQualityScore: 95,
    minimumCategoryQualityScore: 95,
    minimumParseConfidence: 0.98,
    minimumTokenMatchConfidence: 0.98,
    minimumMappedIngredientCount: 1,
    requireBarcode: true,
    regulatedCategoryMode: 'qualified-review-required',
  };
  const policy = {
    schemaVersion: 1,
    contractId: 'catalog-launch-target-policy-v1',
    signatureEnvelopeVersion: 'catalog-launch-target-policy-signature-v1',
    signingDomain: 'routinekind.catalog-launch-target-policy.v1',
    policyId: 'catalog-target-policy-2026-09',
    authoredAt: '2026-07-15T00:00:00.000Z',
    collectionWindow: {
      opensAt: '2026-08-01T00:00:00.000Z',
      closesAt: '2026-08-31T23:59:59.999Z',
    },
    population: {
      corpusType: 'consented_self_selected_beta_shelves',
      inferenceScope: 'defined_beta_shelf_coverage_corpus_only',
      territories: ['US'],
    },
    sampling: {
      method: 'self_selected_non_probability',
      populationRepresentativenessClaimed: false,
      skuDefinition: 'gtin_market_formula_package_revision',
      oneObservationPerParticipantSku: true,
      wilsonEvaluationUnit: 'one_distinct_participant_per_endpoint',
      maxWilsonEvaluationsPerParticipantPerEndpoint: 1,
      clusteredWilsonInputsAllowed: false,
    },
    analysis: {
      analysisPlanSha256: h('precommitted analysis plan'),
      metricImplementationSha256: h('precommitted metric implementation'),
      collectionBuildSha256: h('precommitted collection build'),
      holdoutQuerySha256: h('aggregate query'),
      evaluationUnitDefinitionSha256: h('participant endpoint evaluation unit'),
      allowedAnalysisLookCount: 1,
      priorHoldoutUseCount: 0,
      holdoutReuseAllowed: false,
      alternativeBuildOrQueryLooksAllowed: false,
      confidenceBoundsAreMarginalNotSimultaneous: true,
      multipleComparisonDecisionRule: 'intersection_union_all_gates_must_pass',
    },
    split: {
      method: 'sha256_committed_deterministic_assignment',
      curationBasisPoints: 7000,
      holdoutBasisPoints: 3000,
      assignmentSeedCommitmentSha256: h('assignment seed authority'),
    },
    privacy: {
      consentPurpose: 'optional_catalog_coverage_curation',
      consentVersionSha256: h('consent version'),
      noticeSha256: h('privacy notice'),
      queryDefinitionSha256: h('aggregate query'),
      retentionPolicySha256: h('retention policy'),
      deletionWorkflowSha256: h('deletion workflow'),
      aggregateReleaseRegistrySha256: h('release registry before'),
      overlapPolicySha256: h('overlap policy'),
      cohortWindowQueryReleaseKeyCommitmentSha256: h('cohort release key'),
      productDemandCommitmentMethod:
        'hmac_sha256_secret_epoch_key_domain_separated_by_release_and_cohort',
      productDemandCommitmentKeyEpochId: 'catalog-demand-epoch-2026-09',
      productDemandCommitmentKeyReceiptSha256: h('demand hmac key receipt'),
      productDemandCommitmentImplementationSha256: h('kms hmac implementation'),
      productDemandCanonicalInputDefinitionSha256: h('demand canonical input'),
      productDemandDomainSeparationContextSha256: h('demand domain separation context'),
      suppressionAuditPolicySha256: h('suppression audit policy'),
      releaseRegistryContractSha256: h('release registry contract'),
      rawShelfDataTracked: false,
      rawUserIdentifiersTracked: false,
      rawBarcodesTracked: false,
      rawProductNamesTracked: false,
      rawFreeTextTracked: false,
      minCellSize: 5,
      complementarySuppression: true,
      maxContributionsPerParticipantSku: 1,
    },
    lineage: {
      cat01PolicySha256: h('cat01 policy'),
      cat01TrustRegistrySha256: authority.trustRegistryArtifactSha256,
      cat01ApprovalSetSha256: h('cat01 approval set'),
      cat02StageEnvelopeSha256: h('primary cat02 stage envelope'),
      cat02DatabaseReceiptCompletionSha256: h('primary cat02 database completion'),
      cat02PromotionReceiptSha256: h('primary cat02 promotion receipt'),
      cat02QaReportSha256: h('primary cat02 qa report'),
      buildSourceGitSha: '1234567890abcdef1234567890abcdef12345678',
    },
    databaseEligibilityPolicy,
    databaseEligibilityPolicySha256: catalogDbEligibilityPolicySha256(databaseEligibilityPolicy),
    targets: {
      confidenceMethod: 'wilson_score_one_sided',
      confidenceLevelBasisPoints: 9500,
      zScoreMillionths: 1_644_854,
      minimumParticipants: { curation: 300, holdout: 1200 },
      minimumContributors: { curation: 300, holdout: 1200 },
      minimumDenominators: {
        holdoutLookupEvaluations: 1200,
        holdoutMatchedEvaluations: 1200,
        holdoutIngredientEvaluations: 1200,
        holdoutRecommendationEvaluations: 1200,
        holdoutManualFallbackEvaluations: 500,
        holdoutShelfFlowEvaluations: 500,
      },
      minimumDistinctDemandDigests: { curation: 100, holdout: 6 },
      minimumCategoryDenominators: {
        lookupEvaluations: 200,
        matchedEvaluations: 200,
        ingredientEvaluations: 200,
        recommendationEvaluations: 200,
      },
      minimumOperationalStratumDenominators: {
        manualFallbackEvaluations: 100,
        shelfFlowEvaluations: 100,
      },
      inventory: {
        minimumEligibleCatalogRecords: 2000,
        minimumPrioritizedEligibleRecords: 100,
        minimumEligibleByRequiredCategory: CATEGORY_FLOORS,
      },
      thresholdsBasisPoints: {
        holdoutCorrectMatchLowerBoundMin: 9000,
        holdoutWrongMatchUpperBoundMax: 200,
        holdoutUnknownTokenUpperBoundMax: 1500,
        holdoutBelowUsableRecommendationUpperBoundMax: 200,
        holdoutManualFallbackCompletionLowerBoundMin: 8000,
        holdoutShelfFlowCompletionLowerBoundMin: 8000,
      },
      zeroTolerance: {
        belowUsableRecommendations: true,
        openWrongMatchReports: true,
        openP0P1Incidents: true,
      },
      requiredCategoryCodes: CATEGORIES,
      requiredOperationalStrata: [
        { routeCode: 'barcode', networkState: 'offline' },
        { routeCode: 'barcode', networkState: 'online' },
        { routeCode: 'manual_recovery', networkState: 'offline' },
        { routeCode: 'search_ocr', networkState: 'online' },
      ],
    },
    signers: [
      authority.byRole.get('quality_target_owner').signer,
      authority.byRole.get('privacy_reviewer').signer,
    ],
    signatures: [],
  };
  signDocument(
    policy,
    [
      { ...authority.byRole.get('quality_target_owner'), signedAt: '2026-07-16T00:00:00.000Z' },
      { ...authority.byRole.get('privacy_reviewer'), signedAt: '2026-07-16T01:00:00.000Z' },
    ],
    catalogTargetPolicySigningPayload,
  );
  return policy;
}

function artifactSets(policy) {
  const sets = [
    {
      batchId: '11111111-1111-4111-8111-111111111111',
      artifactKind: 'production',
      batchEvidenceSha256: h('primary batch evidence'),
      recordsArtifactSha256: h('primary records artifact'),
      candidatesArtifactSha256: h('primary candidates artifact'),
      stageEnvelopeSha256: policy.lineage.cat02StageEnvelopeSha256,
      databaseReceiptCompletionSha256: policy.lineage.cat02DatabaseReceiptCompletionSha256,
      promotionReceiptSha256: policy.lineage.cat02PromotionReceiptSha256,
      qaReportSha256: policy.lineage.cat02QaReportSha256,
      productionIntegrityEvidenceSha256: h('primary production integrity evidence'),
    },
    {
      batchId: '22222222-2222-4222-8222-222222222222',
      artifactKind: 'production',
      batchEvidenceSha256: h('dependency batch evidence'),
      recordsArtifactSha256: h('dependency records artifact'),
      candidatesArtifactSha256: h('dependency candidates artifact'),
      stageEnvelopeSha256: h('dependency stage envelope'),
      databaseReceiptCompletionSha256: h('dependency database completion'),
      promotionReceiptSha256: h('dependency promotion receipt'),
      qaReportSha256: h('dependency qa report'),
      productionIntegrityEvidenceSha256: h('dependency production integrity evidence'),
    },
  ];
  return sets;
}

function expandedCategories() {
  return CATEGORIES.flatMap((category) => Array(CATEGORY_FLOORS[category]).fill(category));
}

function makeRecords(authority, sets) {
  const categories = expandedCategories();
  const records = categories.map((categoryCode, index) => {
    const productRecordSha256 = h(`catalog product authority ${index}`);
    const regulated = categoryCode === 'sunscreen' || categoryCode === 'acne_treatment';
    const productClass = regulated ? 'otc_drug' : 'cosmetic';
    const regulatoryEvidence = {
      jurisdiction: 'US',
      classification: productClass,
      classificationEvidenceSha256: h(`classification:${index}`),
      regulatoryBasisEvidenceSha256: h(`regulatory-basis:${index}`),
      usDrugFactsOrLabelRevisionSha256: h(`label-revision:${index}`),
      usDrugFactsOrLabelRevisionEvidenceSha256: h(`label-revision-evidence:${index}`),
      expiryStorageDisposition: regulated
        ? 'label_expiry_and_storage_reviewed'
        : 'not_applicable_cosmetic',
      expiryStorageEvidenceSha256: h(`expiry-storage:${index}`),
      allowedAppBehavior: 'informational_catalog_display_only',
      prohibitedClaimSetSha256: h(`prohibited-claims:${index}`),
      reviewerConditionsSha256: h(`reviewer-conditions:${index}`),
      qualifiedReviewerCredentialSha256:
        authority.byRole.get('regulatory_reviewer').signer.qualificationEvidenceSha256,
      classificationBasisReviewedAt: '2026-09-02T10:00:00.000Z',
      labelRevisionReviewedAt: '2026-09-02T10:05:00.000Z',
      effectiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2027-06-30T00:00:00.000Z',
      revalidationDueAt: '2027-06-01T00:00:00.000Z',
      agencyProductApprovalClaimed: false,
    };
    const productSnapshotSha256 = h(`product-snapshot:${index}`);
    const dependencySha256 = h(`dependency-snapshot:${index}`);
    const barcode = String(100000000000 + index);
    const dependencyEntities = [
      {
        fieldScope: 'barcode_identity',
        entityType: 'barcode',
        entityId: barcode,
        projectionSha256: h(`barcode-projection:${index}`),
      },
      {
        fieldScope: 'category',
        entityType: 'product',
        entityId: `product:${index}`,
        projectionSha256: h(`category-projection:${index}`),
      },
      ...[0, 1].map((ingredientIndex) => ({
        fieldScope: 'ingredients',
        entityType: 'ingredient',
        entityId: `ingredient:${index}:${ingredientIndex}`,
        projectionSha256: h(`ingredient-projection:${index}:${ingredientIndex}`),
      })),
      {
        fieldScope: 'regulatory_classification',
        entityType: 'product',
        entityId: `product:${index}`,
        projectionSha256: h(`regulatory-projection:${index}`),
      },
    ];
    const primaryStageRecordSha256 = productRecordSha256;
    const primarySourceApprovalSha256 = h(`source-approval:${index}:primary-product`);
    const primarySourceQaSha256 = sets[0].qaReportSha256;
    const dependencyMemberships = dependencyEntities.map((entity) => {
      const { fieldScope } = entity;
      const ingredientEntity = fieldScope === 'ingredients';
      const artifactSet = ingredientEntity ? sets[1] : sets[0];
      const dependencyEntitySha256 = catalogCat02DependencyEntitySha256({
        productRecordSha256,
        ...entity,
      });
      const normalizedSnapshot =
        fieldScope === 'barcode_identity'
          ? { barcode, productSnapshotSha256, dependencyEntitySha256 }
          : fieldScope === 'category'
            ? { categoryCode, productSnapshotSha256, dependencyEntitySha256 }
            : fieldScope === 'ingredients'
              ? { dependencySha256, productSnapshotSha256, dependencyEntitySha256 }
              : {
                  categoryCode,
                  regulatoryClassification: productClass,
                  regulatoryReviewEvidenceSha256: regulated
                    ? catalogDocumentSha256(regulatoryEvidence)
                    : null,
                  regulatoryReviewerIds: [
                    authority.byRole.get('regulatory_reviewer').signer.reviewerId,
                  ],
                  dependencyEntitySha256,
                };
      return {
        fieldScope,
        dependencyEntitySha256,
        batchId: artifactSet.batchId,
        artifactSetSha256: catalogCat02ArtifactSetSha256(artifactSet),
        cat02StageRecordSha256: ingredientEntity
          ? h(`stage:${index}:${fieldScope}:${entity.entityId}`)
          : primaryStageRecordSha256,
        cat02DatabaseNormalizedRecordSha256: catalogCat02DatabaseNormalizedRecordSha256(
          productRecordSha256,
          fieldScope,
          normalizedSnapshot,
        ),
        sourceApprovalSha256: ingredientEntity
          ? h(`source-approval:${index}:${fieldScope}:${entity.entityId}`)
          : primarySourceApprovalSha256,
        sourceQaSha256: ingredientEntity ? sets[1].qaReportSha256 : primarySourceQaSha256,
        membershipEvidenceSha256: h(
          `membership-evidence:${index}:${fieldScope}:${entity.entityId}`,
        ),
      };
    });
    dependencyMemberships.sort((left, right) =>
      `${left.fieldScope}:${left.dependencyEntitySha256}:${left.batchId}`.localeCompare(
        `${right.fieldScope}:${right.dependencyEntitySha256}:${right.batchId}`,
        'en-US',
      ),
    );
    const primary = dependencyMemberships.find(
      (membership) => membership.fieldScope === 'barcode_identity',
    );
    return {
      productRecordSha256,
      cat02StageRecordSha256: primary.cat02StageRecordSha256,
      cat02DatabaseNormalizedRecordSha256: primary.cat02DatabaseNormalizedRecordSha256,
      sourceApprovalSha256: primary.sourceApprovalSha256,
      sourceQaSha256: primary.sourceQaSha256,
      servedStateMutationRootSha256: h(`served-state-mutation-root:${index}:generation:0`),
      databaseBaseRecordSha256: h(`database-base-record:${index}`),
      dependencyMemberships,
      market: 'US',
      categoryCode,
      productClass,
      decision: 'eligible_for_activation',
      demandPriorityRank: index < 100 ? index + 1 : null,
      demandPriorityCommitmentSha256: index < 100 ? h(`curation-demand:${index}`) : null,
      reviews: {
        barcodeReviewed: true,
        nameReviewed: true,
        brandReviewed: true,
        categoryReviewed: true,
        ingredientListReviewed: true,
        ingredientTokensComplete: true,
        ingredientMappingsComplete: true,
        correctionHold: false,
        qualityGrade: 'verified',
      },
      regulatoryEvidence,
    };
  });
  records.sort((left, right) =>
    left.productRecordSha256.localeCompare(right.productRecordSha256, 'en-US'),
  );
  return records;
}

function makeProof(authority, policy, sets, records) {
  const memberships = records.flatMap((record) =>
    record.dependencyMemberships.map((membership) => ({
      productRecordSha256: record.productRecordSha256,
      ...membership,
    })),
  );
  const proof = {
    schemaVersion: 1,
    contractId: 'catalog-cat02-curation-membership-proof-v1',
    signatureEnvelopeVersion: 'catalog-cat02-curation-membership-proof-signature-v1',
    signingDomain: 'routinekind.catalog-cat02-curation-membership-proof.v1',
    proofId: 'cat02-membership-proof-2026-09',
    releaseId: 'catalog-curation-release-2026-09',
    targetPolicySha256: catalogDocumentSha256(policy),
    databaseEligibilityPolicySha256: policy.databaseEligibilityPolicySha256,
    artifactSets: sets,
    artifactSetSha256: h(
      canonicalJson({
        contractId: 'catalog-cat02-curation-complete-artifact-set-v1',
        artifactSets: sets,
      }),
    ),
    memberships,
    membershipSetSha256: catalogCat02ProofMembershipSetSha256(memberships),
    databaseObservation: {
      projectRefSha256: h('production project ref'),
      schemaMigrationVersion: '20260713000054',
      schemaMigrationSha256: h('cat02 migration'),
      verificationQuerySha256: h('cat02 exact membership verification query'),
      observationMode: 'live_database_exact_set_receipt',
      observedArtifactSetSha256: h(
        canonicalJson({
          contractId: 'catalog-cat02-curation-complete-artifact-set-v1',
          artifactSets: sets,
        }),
      ),
      observedMembershipSetSha256: catalogCat02ProofMembershipSetSha256(memberships),
      observedProductionIntegritySetSha256: catalogCat02ProductionIntegritySetSha256(sets),
      observedServedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(records),
      capturedAt: '2026-09-02T12:00:00.000Z',
      promotedBatchCount: sets.length,
      membershipRowCount: memberships.length,
      missingMembershipCount: 0,
      extraMembershipCount: 0,
      mismatchedMembershipCount: 0,
      allBatchesLivePromoted: true,
      allBatchesProductionIntegrityVerified: true,
    },
    verifiedAt: '2026-09-02T12:00:00.000Z',
    signers: [authority.byRole.get('cat02_database_membership_verifier').signer],
    signatures: [],
  };
  signDocument(
    proof,
    [
      {
        ...authority.byRole.get('cat02_database_membership_verifier'),
        signedAt: proof.verifiedAt,
      },
    ],
    catalogCat02MembershipProofSigningPayload,
  );
  return proof;
}

function refreshCat02MembershipProof(proof, authority) {
  const artifactByBatch = new Map(
    proof.artifactSets.map((artifactSet) => [artifactSet.batchId, artifactSet]),
  );
  for (const membership of proof.memberships) {
    membership.artifactSetSha256 = catalogCat02ArtifactSetSha256(
      artifactByBatch.get(membership.batchId),
    );
  }
  proof.artifactSetSha256 = h(
    canonicalJson({
      contractId: 'catalog-cat02-curation-complete-artifact-set-v1',
      artifactSets: proof.artifactSets,
    }),
  );
  proof.databaseObservation.observedArtifactSetSha256 = proof.artifactSetSha256;
  proof.databaseObservation.observedProductionIntegritySetSha256 =
    catalogCat02ProductionIntegritySetSha256(proof.artifactSets);
  proof.memberships.sort((left, right) =>
    cat02TestMembershipSortKey(left).localeCompare(cat02TestMembershipSortKey(right), 'en-US'),
  );
  proof.membershipSetSha256 = catalogCat02ProofMembershipSetSha256(proof.memberships);
  proof.databaseObservation.observedMembershipSetSha256 = proof.membershipSetSha256;
  proof.databaseObservation.membershipRowCount = proof.memberships.length;
  signDocument(
    proof,
    [
      {
        ...authority.byRole.get('cat02_database_membership_verifier'),
        signedAt: proof.verifiedAt,
      },
    ],
    catalogCat02MembershipProofSigningPayload,
  );
  return proof;
}

function makeDatabaseReviewAuthorization(authority, policy, proof, records) {
  const eligibleRecordCount = records.filter(
    (record) => record.decision === 'eligible_for_activation',
  ).length;
  const authorization = {
    schemaVersion: 1,
    contractId: 'catalog-curation-database-review-authorization-v1',
    signatureEnvelopeVersion: 'catalog-curation-database-review-authorization-signature-v1',
    signingDomain: 'routinekind.catalog-curation-database-review-authorization.v1',
    releaseId: proof.releaseId,
    targetPolicySha256: catalogDocumentSha256(policy),
    databaseEligibilityPolicySha256: policy.databaseEligibilityPolicySha256,
    curationDecisionCommitmentSha256: catalogCurationDecisionCommitment(records),
    candidateSetSha256: catalogCurationCandidateSetSha256(records),
    cat02MembershipSetSha256: proof.membershipSetSha256,
    reviewedRecordCount: records.length,
    eligibleRecordCount,
    prioritizedEligibleRecordCount: records.filter(
      (record) =>
        record.decision === 'eligible_for_activation' && record.demandPriorityRank !== null,
    ).length,
    authorizedAt: '2026-09-03T00:00:00.000Z',
    validUntil: '2027-05-01T00:00:00.000Z',
    signers: [
      authority.byRole.get('catalog_quality_reviewer').signer,
      authority.byRole.get('data_quality_reviewer').signer,
      authority.byRole.get('regulatory_reviewer').signer,
    ],
    signatures: [],
  };
  signDocument(
    authorization,
    [
      { ...authority.byRole.get('catalog_quality_reviewer'), signedAt: authorization.authorizedAt },
      { ...authority.byRole.get('data_quality_reviewer'), signedAt: authorization.authorizedAt },
      { ...authority.byRole.get('regulatory_reviewer'), signedAt: authorization.authorizedAt },
    ],
    catalogDatabaseReviewAuthorizationSigningPayload,
  );
  return authorization;
}

function makePreholdoutAuthority(authority, policy, proof, records, databaseAuthorization) {
  const decision = {
    schemaVersion: 1,
    contractId: 'catalog-curation-preholdout-decision-commitment-v1',
    signatureEnvelopeVersion: 'catalog-curation-preholdout-decision-signature-v1',
    signingDomain: 'routinekind.catalog-curation-preholdout-decision.v1',
    decisionId: 'catalog-curation-decision-2026-09',
    releaseId: proof.releaseId,
    targetPolicySha256: catalogDocumentSha256(policy),
    databaseEligibilityPolicySha256: policy.databaseEligibilityPolicySha256,
    reviewedRecordCount: records.length,
    eligibleRecordCount: records.length,
    prioritizedEligibleRecordCount: 100,
    curationDecisionCommitmentSha256: catalogCurationDecisionCommitment(records),
    candidateSetSha256: catalogCurationCandidateSetSha256(records),
    cat02MembershipProofSha256: catalogDocumentSha256(proof),
    cat02MembershipSetSha256: proof.membershipSetSha256,
    databaseReviewAuthorization: databaseAuthorization,
    databaseReviewAuthorizationSha256: catalogDocumentSha256(databaseAuthorization),
    databaseReviewerSignatureSetSha256: h(
      canonicalJson({
        contractId: 'catalog-curation-database-reviewer-signature-set-v1',
        signatures: databaseAuthorization.signatures.slice(0, 2),
      }),
    ),
    ledgerSequence: 41,
    ledgerUriSha256: h('https://transparency.routinekind.app/catalog-curation'),
    externalTimestampAuthoritySha256: authority.byRole.get('external_timestamp_authority').signer
      .publicKeySha256,
    externalTimestampReceiptSha256: '',
    externalWitnessReceipt: {
      contractId: 'catalog-curation-external-timestamp-receipt-v1',
      logId: 'catalog-curation-transparency-log',
      logUriSha256: h('https://transparency.routinekind.app/catalog-curation'),
      sequence: 41,
      requestNonceSha256: h('timestamp request nonce 41'),
      witnessedDecisionCommitmentSha256: catalogCurationDecisionCommitment(records),
      priorCheckpointSha256: h('transparency checkpoint 40'),
      checkpointSha256: h('transparency checkpoint 41'),
      inclusionProofSha256: h('transparency inclusion proof 41'),
      observedAt: '2026-09-03T00:00:00.000Z',
    },
    externalTimestampSigner: authority.byRole.get('external_timestamp_authority').signer,
    externalTimestampSignature: null,
    priorLedgerRootSha256: h('curation ledger root 40'),
    appendOnlyLedgerEntrySha256: '',
    appendOnlyLedgerRootSha256: '',
    committedAt: '2026-09-03T00:00:00.000Z',
    signers: [
      authority.byRole.get('curation_decision_owner').signer,
      authority.byRole.get('commitment_ledger_witness').signer,
    ],
    signatures: [],
  };
  decision.externalTimestampReceiptSha256 = catalogDocumentSha256(decision.externalWitnessReceipt);
  const timestampEntry = authority.byRole.get('external_timestamp_authority');
  decision.externalTimestampSignature = {
    decisionRole: timestampEntry.signer.decisionRole,
    reviewerId: timestampEntry.signer.reviewerId,
    trustRegistryKeyId: timestampEntry.signer.trustRegistryKeyId,
    algorithm: 'Ed25519',
    signedAt: decision.committedAt,
    valueBase64: '',
  };
  decision.externalTimestampSignature.valueBase64 = sign(
    null,
    catalogExternalTimestampReceiptSigningPayload(decision, decision.externalTimestampSignature),
    timestampEntry.key.privateKey,
  ).toString('base64');
  decision.appendOnlyLedgerEntrySha256 = catalogPreholdoutLedgerEntrySha256(decision);
  decision.appendOnlyLedgerRootSha256 = catalogPreholdoutLedgerRootSha256(decision);
  signDocument(
    decision,
    [
      { ...authority.byRole.get('curation_decision_owner'), signedAt: decision.committedAt },
      { ...authority.byRole.get('commitment_ledger_witness'), signedAt: decision.committedAt },
    ],
    catalogPreholdoutDecisionSigningPayload,
  );
  return decision;
}

function cohort(name, buckets) {
  const outcomes = {
    lookupEvaluations: 1200,
    correctMatches: 1200,
    incorrectMatches: 0,
    noMatches: 0,
    matchedEvaluations: 1200,
    ingredientEvaluations: 1200,
    ingredientEvaluationsWithUnknownTokens: 50,
    recommendationEvaluations: 1200,
    belowUsableRecommendations: 0,
    manualFallbackEvaluations: 500,
    manualFallbackCompletions: 500,
    shelfFlowEvaluations: 500,
    shelfFlowCompletions: 500,
    wrongMatchReports: 0,
    openWrongMatchReports: 0,
    openP0P1Incidents: 0,
  };
  return {
    name,
    participants: 1200,
    eligibleParticipants: 1200,
    contributors: 1200,
    demandBuckets: buckets,
    outcomes,
    categoryOutcomes: CATEGORIES.map((categoryCode, index) => ({
      categoryCode,
      lookupEvaluations: 200,
      correctMatches: 200,
      incorrectMatches: 0,
      noMatches: 0,
      ingredientEvaluations: 200,
      ingredientEvaluationsWithUnknownTokens: [9, 9, 8, 8, 8, 8][index],
      recommendationEvaluations: 200,
      belowUsableRecommendations: 0,
    })),
    operationalStratumOutcomes: [
      ['barcode', 'offline'],
      ['barcode', 'online'],
      ['manual_recovery', 'offline'],
      ['search_ocr', 'online'],
    ].map(([routeCode, networkState]) => ({
      routeCode,
      networkState,
      manualFallbackEvaluations: 125,
      manualFallbackCompletions: 125,
      shelfFlowEvaluations: 125,
      shelfFlowCompletions: 125,
    })),
  };
}

function makeCorpus(authority, policy, records, decisionAuthority) {
  const curationBuckets = records
    .filter((record) => record.demandPriorityCommitmentSha256 !== null)
    .map((record) => ({
      productDemandCommitmentSha256: record.demandPriorityCommitmentSha256,
      categoryCode: record.categoryCode,
      demandReasonCode: 'shelf_present',
      count: 5,
      suppression: 'none',
    }))
    .sort((left, right) =>
      `${left.productDemandCommitmentSha256}:${left.categoryCode}:${left.demandReasonCode}`.localeCompare(
        `${right.productDemandCommitmentSha256}:${right.categoryCode}:${right.demandReasonCode}`,
        'en-US',
      ),
    );
  const holdoutBuckets = CATEGORIES.map((categoryCode, index) => ({
    productDemandCommitmentSha256: h(`holdout-demand:${index}`),
    categoryCode,
    demandReasonCode: 'lookup_no_match',
    count: 5,
    suppression: 'none',
  })).sort((left, right) =>
    `${left.productDemandCommitmentSha256}:${left.categoryCode}:${left.demandReasonCode}`.localeCompare(
      `${right.productDemandCommitmentSha256}:${right.categoryCode}:${right.demandReasonCode}`,
      'en-US',
    ),
  );
  const corpus = {
    schemaVersion: 1,
    contractId: 'catalog-beta-shelf-corpus-v1',
    corpusId: 'catalog-beta-corpus-2026-09',
    targetPolicySha256: catalogDocumentSha256(policy),
    collectedAt: '2026-09-10T12:00:00.000Z',
    splitTimeline: {
      assignmentSeedCommitmentSha256: policy.split.assignmentSeedCommitmentSha256,
      curationFrozenAt: '2026-09-01T00:00:00.000Z',
      curationDecisionCommittedAt: decisionAuthority.committedAt,
      curationDecisionCommitmentSha256: decisionAuthority.curationDecisionCommitmentSha256,
      holdoutOpenedAt: '2026-09-04T00:00:00.000Z',
      holdoutSealedAt: '2026-09-09T00:00:00.000Z',
    },
    provenance: {
      aggregateExportSha256: h('aggregate export'),
      consentLedgerSha256: h('consent ledger'),
      deletionLedgerSha256: h('deletion ledger'),
      aggregationQuerySha256: policy.privacy.queryDefinitionSha256,
      splitAssignmentLedgerSha256: h('split assignment ledger'),
      collectionBuildSha256: policy.analysis.collectionBuildSha256,
      analysisPlanSha256: policy.analysis.analysisPlanSha256,
      metricImplementationSha256: policy.analysis.metricImplementationSha256,
      evaluationUnitDefinitionSha256: policy.analysis.evaluationUnitDefinitionSha256,
      rawEvidenceLocationSha256: h('restricted evidence location'),
      productDemandCommitmentKeyReceiptSha256:
        policy.privacy.productDemandCommitmentKeyReceiptSha256,
    },
    releaseControls: {
      releaseId: 'aggregate-release-2026-09',
      priorReleaseRegistrySha256: policy.privacy.aggregateReleaseRegistrySha256,
      updatedReleaseRegistrySha256: h('release registry after'),
      releaseRegistryExtensionProofSha256: h('release registry extension proof'),
      overlapPolicySha256: policy.privacy.overlapPolicySha256,
      overlapAnalysisSha256: h('release overlap analysis'),
      suppressionAuditSha256: h('suppression and complementary suppression audit'),
      cohortWindowQueryReleaseKeyCommitmentSha256:
        policy.privacy.cohortWindowQueryReleaseKeyCommitmentSha256,
      cohortOverlapAuditSha256: h('exact cohort overlap audit'),
      cohortOverlapCount: 0,
      cohortDisjointnessVerified: true,
      overlapDecision: 'no_reconstructive_overlap',
      overlappingReleaseCount: 0,
      reconstructiveOverlapFound: false,
      releaseRegistryAppendOnly: true,
    },
    privacy: {
      consentVersionSha256: policy.privacy.consentVersionSha256,
      noticeSha256: policy.privacy.noticeSha256,
      retentionPolicySha256: policy.privacy.retentionPolicySha256,
      deletionWorkflowSha256: policy.privacy.deletionWorkflowSha256,
      aggregationOnly: true,
      oneParticipantPerSkuCapApplied: true,
      smallCellSuppressionApplied: true,
      complementarySuppressionApplied: true,
      rawShelfDataTracked: false,
      rawUserIdentifiersTracked: false,
      rawBarcodesTracked: false,
      rawProductNamesTracked: false,
      rawFreeTextTracked: false,
      deletionAppliedAt: '2026-09-09T12:00:00.000Z',
    },
    cohorts: {
      curation: cohort('curation', curationBuckets),
      holdout: cohort('holdout', holdoutBuckets),
    },
    evaluationUnitAudit: null,
    holdoutControlReceipt: null,
    privacyExecutionReceipt: null,
    curationDecisionAuthority: decisionAuthority,
  };
  corpus.evaluationUnitAudit = {
    contractId: 'catalog-participant-evaluation-unit-audit-v1',
    wilsonEvaluationUnit: policy.sampling.wilsonEvaluationUnit,
    maxWilsonEvaluationsPerParticipantPerEndpoint: 1,
    aggregateEndpointParticipantSetRootSha256: h('aggregate endpoint participant set root'),
    categoryEndpointParticipantSetRootSha256: h('category endpoint participant set root'),
    operationalEndpointParticipantSetRootSha256: h('operational endpoint participant set root'),
    participantAssignmentAuditSha256: h('participant assignment audit receipt'),
    outcomeReconciliationSha256: h(
      canonicalJson({
        contractId: 'catalog-participant-evaluation-unit-reconciliation-v1',
        value: {
          aggregate: corpus.cohorts.holdout.outcomes,
          categories: corpus.cohorts.holdout.categoryOutcomes,
          operationalStrata: corpus.cohorts.holdout.operationalStratumOutcomes,
        },
      }),
    ),
    allWilsonUnitsDistinctWithinEndpoint: true,
    allCategoryStrataDisjointWithinEndpoint: true,
    allOperationalStrataDisjointWithinEndpoint: true,
    clusteredWilsonInputsPresent: false,
  };
  corpus.releaseControls.releaseRegistryExtensionProofSha256 = h(
    canonicalJson({
      contractId: 'catalog-aggregate-release-registry-extension-v1',
      beforeSha256: corpus.releaseControls.priorReleaseRegistrySha256,
      afterSha256: corpus.releaseControls.updatedReleaseRegistrySha256,
      context: {
        releaseId: corpus.releaseControls.releaseId,
        overlapAnalysisSha256: corpus.releaseControls.overlapAnalysisSha256,
        suppressionAuditSha256: corpus.releaseControls.suppressionAuditSha256,
      },
    }),
  );
  const holdoutControlReceipt = {
    schemaVersion: 1,
    contractId: 'catalog-holdout-custody-evaluation-receipt-v1',
    signatureEnvelopeVersion: 'catalog-holdout-custody-evaluation-receipt-signature-v1',
    signingDomain: 'routinekind.catalog-holdout-custody-evaluation-receipt.v1',
    receiptId: 'holdout-control-receipt-2026-09',
    targetPolicySha256: catalogDocumentSha256(policy),
    analysisPlanSha256: policy.analysis.analysisPlanSha256,
    metricImplementationSha256: policy.analysis.metricImplementationSha256,
    collectionBuildSha256: policy.analysis.collectionBuildSha256,
    holdoutQuerySha256: policy.analysis.holdoutQuerySha256,
    evaluationUnitDefinitionSha256: policy.analysis.evaluationUnitDefinitionSha256,
    splitAssignmentLedgerSha256: corpus.provenance.splitAssignmentLedgerSha256,
    holdoutParticipantSetRootSha256:
      corpus.evaluationUnitAudit.aggregateEndpointParticipantSetRootSha256,
    evaluationUnitAuditSha256: catalogDocumentSha256(corpus.evaluationUnitAudit),
    aggregateOutcomeSetSha256: catalogHoldoutAggregateOutcomeSetSha256(corpus),
    categoryOutcomeSetSha256: catalogHoldoutCategoryOutcomeSetSha256(corpus),
    operationalOutcomeSetSha256: catalogHoldoutOperationalOutcomeSetSha256(corpus),
    accessLogSha256: h('sealed holdout access log'),
    evaluationLedgerSha256: h('single holdout evaluation ledger'),
    priorUseRegistryBeforeSha256: h('holdout prior use registry before'),
    priorUseRegistryAfterSha256: h('holdout prior use registry after'),
    priorUseRegistryExtensionProofSha256: h('holdout prior use registry extension proof'),
    holdoutOpenedAt: corpus.splitTimeline.holdoutOpenedAt,
    holdoutSealedAt: corpus.splitTimeline.holdoutSealedAt,
    evaluatedAt: corpus.splitTimeline.holdoutSealedAt,
    preOpenReadCount: 0,
    executedAnalysisLookCount: 1,
    priorHoldoutUseCount: 0,
    alternativeBuildLookCount: 0,
    alternativeQueryLookCount: 0,
    reusedParticipantCount: 0,
    collectionBuildMatchesPolicy: true,
    metricImplementationMatchesPolicy: true,
    queryMatchesPolicy: true,
    untouchedBeforeOpen: true,
    signers: [authority.byRole.get('holdout_data_custodian').signer],
    signatures: [],
  };
  holdoutControlReceipt.priorUseRegistryExtensionProofSha256 = h(
    canonicalJson({
      contractId: 'catalog-holdout-prior-use-registry-extension-v1',
      beforeSha256: holdoutControlReceipt.priorUseRegistryBeforeSha256,
      afterSha256: holdoutControlReceipt.priorUseRegistryAfterSha256,
      context: {
        holdoutParticipantSetRootSha256: holdoutControlReceipt.holdoutParticipantSetRootSha256,
        evaluationLedgerSha256: holdoutControlReceipt.evaluationLedgerSha256,
      },
    }),
  );
  signDocument(
    holdoutControlReceipt,
    [
      {
        ...authority.byRole.get('holdout_data_custodian'),
        signedAt: holdoutControlReceipt.evaluatedAt,
      },
    ],
    catalogHoldoutControlReceiptSigningPayload,
  );
  corpus.holdoutControlReceipt = holdoutControlReceipt;
  const privacyExecutionReceipt = {
    schemaVersion: 1,
    contractId: 'catalog-privacy-execution-receipt-v1',
    signatureEnvelopeVersion: 'catalog-privacy-execution-receipt-signature-v1',
    signingDomain: 'routinekind.catalog-privacy-execution-receipt.v1',
    receiptId: 'privacy-execution-receipt-2026-09',
    releaseId: corpus.releaseControls.releaseId,
    targetPolicySha256: catalogDocumentSha256(policy),
    keyEpochId: policy.privacy.productDemandCommitmentKeyEpochId,
    kmsKeyReceiptSha256: policy.privacy.productDemandCommitmentKeyReceiptSha256,
    hmacImplementationSha256: policy.privacy.productDemandCommitmentImplementationSha256,
    canonicalInputDefinitionSha256: policy.privacy.productDemandCanonicalInputDefinitionSha256,
    domainSeparationContextSha256: policy.privacy.productDemandDomainSeparationContextSha256,
    demandCommitmentOutputSetSha256: catalogDemandCommitmentOutputSetSha256(corpus),
    suppressionAuditPolicySha256: policy.privacy.suppressionAuditPolicySha256,
    suppressionAuditSha256: corpus.releaseControls.suppressionAuditSha256,
    overlapPolicySha256: policy.privacy.overlapPolicySha256,
    overlapAnalysisSha256: corpus.releaseControls.overlapAnalysisSha256,
    priorReleaseRegistrySha256: corpus.releaseControls.priorReleaseRegistrySha256,
    updatedReleaseRegistrySha256: corpus.releaseControls.updatedReleaseRegistrySha256,
    releaseRegistryContractSha256: policy.privacy.releaseRegistryContractSha256,
    releaseRegistryExtensionProofSha256: corpus.releaseControls.releaseRegistryExtensionProofSha256,
    verifiedAt: corpus.collectedAt,
    secretKeyMaterialPresent: false,
    allCommitmentsGeneratedByKmsHmacSha256: true,
    allPrimaryCellsBelowMinimum: true,
    allComplementaryCellsPreventReconstruction: true,
    noReconstructiveOverlap: true,
    releaseRegistryAppendOnly: true,
    signers: [authority.byRole.get('privacy_pipeline_verifier').signer],
    signatures: [],
  };
  signDocument(
    privacyExecutionReceipt,
    [
      {
        ...authority.byRole.get('privacy_pipeline_verifier'),
        signedAt: privacyExecutionReceipt.verifiedAt,
      },
    ],
    catalogPrivacyExecutionReceiptSigningPayload,
  );
  corpus.privacyExecutionReceipt = privacyExecutionReceipt;
  return corpus;
}

function signActivation(review, authority, signedAt = '2026-09-10T14:05:00.000Z') {
  const entry = authority.byRole.get('activation_operator');
  const signature = {
    decisionRole: 'activation_operator',
    reviewerId: entry.signer.reviewerId,
    trustRegistryKeyId: entry.signer.trustRegistryKeyId,
    algorithm: 'Ed25519',
    signedAt,
    valueBase64: '',
  };
  signature.valueBase64 = sign(
    null,
    catalogActivationAuthorizationSigningPayload(review, signature),
    entry.key.privateKey,
  ).toString('base64');
  review.activation.authorizationSignature = signature;
}

function signOutcomeReview(
  review,
  authority,
  signedAts = [
    '2026-09-10T13:20:00.000Z',
    '2026-09-10T13:25:00.000Z',
    '2026-09-10T13:30:00.000Z',
    '2026-09-10T13:35:00.000Z',
  ],
) {
  const roles = [
    'catalog_quality_reviewer',
    'data_quality_reviewer',
    'regulatory_reviewer',
    'privacy_release_verifier',
  ];
  signDocument(
    review,
    roles.map((role, index) => ({
      ...authority.byRole.get(role),
      signedAt: signedAts[index],
    })),
    catalogCurationReviewSigningPayload,
  );
  review.curationOutcomeReviewerSignatureSetSha256 =
    catalogCurationOutcomeReviewerSignatureSetSha256(review);
}

function makeReview(authority, policy, proof, corpus, records, sets) {
  const review = {
    schemaVersion: 1,
    contractId: 'catalog-curation-review-v1',
    signatureEnvelopeVersion: 'catalog-curation-review-signature-v1',
    signingDomain: 'routinekind.catalog-curation-review.v1',
    releaseId: proof.releaseId,
    targetPolicySha256: catalogDocumentSha256(policy),
    betaShelfCorpusSha256: catalogDocumentSha256(corpus),
    databaseEligibilityPolicySha256: policy.databaseEligibilityPolicySha256,
    cat02MembershipProofSha256: catalogDocumentSha256(proof),
    cat02DatabaseObservationSha256: catalogCat02DatabaseObservationSha256(proof),
    cat02VerifierSignatureSetSha256: catalogCat02VerifierSignatureSetSha256(proof),
    cat02ProductionIntegritySetSha256: catalogCat02ProductionIntegritySetSha256(proof.artifactSets),
    curationOutcomeReviewerSignatureSetSha256: h('outcome reviewer signature set pending'),
    lineage: structuredClone(policy.lineage),
    curationDecisionCommittedAt: corpus.splitTimeline.curationDecisionCommittedAt,
    reviewedAt: '2026-09-10T13:00:00.000Z',
    databaseSnapshot: {
      projectRefSha256: proof.databaseObservation.projectRefSha256,
      capturedAt: '2026-09-02T14:00:00.000Z',
      schemaMigrationVersion: CATALOG_CURATION_REQUIRED_SCHEMA_MIGRATION_VERSION,
      activeCat02BatchSha256: h('active cat02 batch set'),
      candidateSetSha256: catalogCurationCandidateSetSha256(records),
      servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(records),
      sourceApprovalSetSha256: policy.lineage.cat01ApprovalSetSha256,
      cat03MigrationSha256: CATALOG_CURATION_REQUIRED_MIGRATION_SHA256,
      cat03DatabaseContractTestSha256: CATALOG_CURATION_REQUIRED_DATABASE_CONTRACT_TEST_SHA256,
    },
    authority: {
      productFactSources: ['cat01_signed_source_approval', 'cat02_transactional_promotion'],
      betaDemandUse: 'prioritization_only_never_product_facts_or_serving_authority',
      servingAuthorization: 'cat03_database_activation_only',
      selfSelectedCorpusRepresentativenessClaimed: false,
      allProductsIndependentlySourced: true,
    },
    inventoryCommitment: {
      expectedReviewedRecordCount: records.length,
      expectedEligibleRecordCount: records.length,
      completeReviewedRecordSetSha256: catalogCurationDecisionCommitment(records),
      candidateSetSha256: catalogCurationCandidateSetSha256(records),
      cat02MembershipSetSha256: proof.membershipSetSha256,
    },
    databaseReviewAuthorization: corpus.curationDecisionAuthority.databaseReviewAuthorization,
    databaseCampaignPlan: null,
    databaseCampaignPlanSha256: h('campaign plan pending'),
    records,
    reviewers: [
      authority.byRole.get('catalog_quality_reviewer').signer,
      authority.byRole.get('data_quality_reviewer').signer,
      authority.byRole.get('regulatory_reviewer').signer,
      authority.byRole.get('privacy_release_verifier').signer,
    ],
    activation: {
      decision: 'approve_activation',
      operator: authority.byRole.get('activation_operator').signer,
      plannedAt: '2026-09-10T14:00:00.000Z',
      operationKeyPrefix: 'cat03.activate',
      reasonCode: 'initial_launch_catalog_activation',
      activationAuthorizationSetSha256: h('authorization set pending'),
      authorizationSignature: null,
    },
    signatures: [],
  };
  signOutcomeReview(review, authority);
  review.activation.activationAuthorizationSetSha256 =
    catalogCurationActivationAuthorizationSetSha256(review);
  signActivation(review, authority);
  const primary = sets[0];
  const databaseAuthorization = corpus.curationDecisionAuthority.databaseReviewAuthorization;
  review.databaseCampaignPlan = {
    contractId: 'catalog-launch-curation-campaign-v1',
    releaseId: review.releaseId,
    campaignAuthoritySha256: catalogCurationCampaignAuthoritySha256(review),
    territory: 'US',
    importBatchId: primary.batchId,
    importBatchEvidenceSha256: primary.batchEvidenceSha256,
    importRecordsSha256: primary.recordsArtifactSha256,
    importCandidatesSha256: primary.candidatesArtifactSha256,
    cat02ArtifactSetSha256: proof.artifactSetSha256,
    cat02MembershipSetSha256: proof.membershipSetSha256,
    cat02MembershipProofSha256: review.cat02MembershipProofSha256,
    cat02DatabaseObservationSha256: review.cat02DatabaseObservationSha256,
    cat02VerifierSignatureSetSha256: review.cat02VerifierSignatureSetSha256,
    cat02ProductionIntegritySetSha256: review.cat02ProductionIntegritySetSha256,
    contributingBatchIds: sets.map((set) => set.batchId),
    contributingBatchSetSha256: h(
      canonicalJson({
        contractId: 'catalog-cat02-contributing-batch-set-v1',
        batches: sets,
      }),
    ),
    signedTargetPolicyContractId: 'catalog-launch-target-policy-v1',
    signedTargetPolicySha256: review.targetPolicySha256,
    eligibilityPolicySha256: review.databaseEligibilityPolicySha256,
    betaEvidenceContractId: 'catalog-beta-shelf-corpus-v1',
    betaCorpusSha256: review.betaShelfCorpusSha256,
    curationReviewContractId: 'catalog-curation-review-v1',
    curationManifestSha256: catalogCurationManifestSha256(review),
    trustRegistrySha256: policy.lineage.cat01TrustRegistrySha256,
    corpusConsentStateSha256: catalogCorpusConsentStateSha256(corpus),
    reviewValidUntil: databaseAuthorization.validUntil,
    expectedReviewedRecordCount: records.length,
    expectedEligibleRecordCount: records.length,
    expectedPrioritizedEligibleRecordCount: 100,
    requiredCategoryEligibleFloors: CATEGORY_FLOORS,
    expectedRecordSetSha256: catalogCurationDatabaseRecordSetSha256(review),
    servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(review.records),
    activationAuthorizationSetSha256: review.activation.activationAuthorizationSetSha256,
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    reviewerRoles: ['catalog_quality_reviewer', 'data_quality_reviewer'],
    reviewerIds: review.reviewers.slice(0, 2).map((entry) => entry.reviewerId),
    reviewerEvidenceSha256s: review.reviewers
      .slice(0, 2)
      .map((entry) => entry.qualificationEvidenceSha256),
    reviewerSignatureSetSha256: corpus.curationDecisionAuthority.databaseReviewerSignatureSetSha256,
    createdBy: review.activation.operator.reviewerId,
  };
  review.databaseCampaignPlanSha256 = catalogDatabaseCampaignPlanSha256(
    review.databaseCampaignPlan,
  );
  return review;
}

function digestReadbackSet(contractId, records, field) {
  return h(
    canonicalJson({
      contractId,
      entries: records
        .filter((record) => record[field] !== null)
        .map((record) => ({
          productRecordSha256: record.productRecordSha256,
          [field]: record[field],
        })),
    }),
  );
}

function makeReadback(authority, envelope) {
  const {
    targetPolicy: policy,
    cat02MembershipProof: proof,
    curationReview: review,
  } = envelope.artifacts;
  const records = catalogCurationDatabaseRecordSet(review).records.map((record) => ({
    ...record,
    activationEventReceiptSha256:
      record.databaseActivationRequestSha256 === null
        ? null
        : h(`activation-event:${record.productRecordSha256}`),
    stagedHeadSha256:
      record.databaseActivationRequestSha256 === null
        ? null
        : h(`staged-head:${record.productRecordSha256}`),
    servingProbeSha256:
      record.databaseActivationRequestSha256 === null
        ? null
        : h(`serving-probe:${record.productRecordSha256}`),
    currentLiveEligibilitySha256:
      record.databaseActivationRequestSha256 === null
        ? null
        : h(`current-live:${record.productRecordSha256}`),
    cat02MembershipReadbackSha256: record.cat02MembershipReadbackSha256,
  }));
  const verifiedAt = '2026-09-10T16:00:00.000Z';
  const readback = {
    schemaVersion: 1,
    contractId: 'catalog-curation-database-readback-v1',
    signatureEnvelopeVersion: 'catalog-curation-database-readback-signature-v1',
    signingDomain: 'routinekind.catalog-curation-database-readback.v1',
    receiptId: 'catalog-curation-db-readback-2026-09',
    verifiedAt,
    authority: {
      releaseId: review.releaseId,
      envelopeDigestSha256: envelope.envelopeDigestSha256,
      replayKeySha256: envelope.replayKeySha256,
      targetPolicySha256: review.targetPolicySha256,
      betaShelfCorpusSha256: review.betaShelfCorpusSha256,
      curationReviewSha256: catalogDocumentSha256(review),
      trustRegistrySha256: authority.trustRegistryArtifactSha256,
      databaseEligibilityPolicySha256: review.databaseEligibilityPolicySha256,
      curationDecisionCommitmentSha256: catalogCurationDecisionCommitment(review.records),
      candidateSetSha256: catalogCurationCandidateSetSha256(review.records),
      cat02MembershipProofSha256: catalogDocumentSha256(proof),
      cat02MembershipSetSha256: proof.membershipSetSha256,
      cat02DatabaseObservationSha256: catalogCat02DatabaseObservationSha256(proof),
      cat02VerifierSignatureSetSha256: catalogCat02VerifierSignatureSetSha256(proof),
      cat02ProductionIntegritySetSha256: catalogCat02ProductionIntegritySetSha256(
        proof.artifactSets,
      ),
      servedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(review.records),
      curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
      activationAuthorizationSetSha256: catalogCurationActivationAuthorizationSetSha256(review),
      campaignAuthoritySha256: catalogCurationCampaignAuthoritySha256(review),
      databaseCampaignPlanSha256: review.databaseCampaignPlanSha256,
      databaseRecordSetSha256: catalogCurationDatabaseRecordSetSha256(review),
    },
    databaseState: {
      projectRefSha256: review.databaseSnapshot.projectRefSha256,
      schemaMigrationVersion: CATALOG_CURATION_REQUIRED_SCHEMA_MIGRATION_VERSION,
      schemaMigrationSha256: review.databaseSnapshot.cat03MigrationSha256,
      contractTestSha256: review.databaseSnapshot.cat03DatabaseContractTestSha256,
      campaignId: '33333333-3333-4333-8333-333333333333',
      campaignRowSha256: review.databaseCampaignPlanSha256,
      campaignStatus: 'released',
      campaignReleaseEventId: '44444444-4444-4444-8444-444444444444',
      campaignReleaseEventReceiptSha256: h('atomic campaign release receipt'),
      campaignReleaseHeadSha256: h('active campaign release head'),
      campaignReleaseHeadGeneration: 1,
      campaignReleaseHeadState: 'active',
      activationEventSetSha256: digestReadbackSet(
        'catalog-curation-activation-event-readback-set-v1',
        records,
        'activationEventReceiptSha256',
      ),
      stagedHeadSetSha256: digestReadbackSet(
        'catalog-curation-staged-head-readback-set-v1',
        records,
        'stagedHeadSha256',
      ),
      servingProbeSetSha256: digestReadbackSet(
        'catalog-curation-serving-probe-set-v1',
        records,
        'servingProbeSha256',
      ),
      currentLiveEligibilitySetSha256: digestReadbackSet(
        'catalog-curation-current-live-eligibility-set-v1',
        records,
        'currentLiveEligibilitySha256',
      ),
      currentServedStateMutationRootSetSha256: catalogServedStateMutationRootSetSha256(
        review.records,
      ),
      capturedAt: verifiedAt,
      atomicCampaignReleaseApplied: true,
      allCurrentHeadsServing: true,
      allCurrentEligibilityMatches: true,
      allServingProbesPassed: true,
    },
    counts: {
      campaignRows: 1,
      campaignReleaseEvents: 1,
      campaignReleaseHeads: 1,
      reviewedRecords: review.records.length,
      eligibleRecords: review.records.length,
      rejectedRecords: 0,
      databaseRecords: review.records.length,
      activationAuthorizations: review.records.length,
      activationEvents: review.records.length,
      stagedHeads: review.records.length,
      servingProbes: review.records.length,
      currentLiveEligibleRecords: review.records.length,
      cat02Memberships: proof.memberships.length,
      missingRecords: 0,
      mismatchedRecords: 0,
      failedActivationEvents: 0,
      failedServingProbes: 0,
      unexpectedRecords: 0,
      currentIneligibleRecords: 0,
    },
    records,
    databaseReadbackRecordSetSha256: h(
      canonicalJson({
        contractId: 'catalog-curation-database-readback-record-set-v1',
        records,
      }),
    ),
    membershipReadback: {
      cat02MembershipProofSha256: catalogDocumentSha256(proof),
      cat02MembershipSetSha256: proof.membershipSetSha256,
      artifactSetSha256: proof.artifactSetSha256,
      batchIds: proof.artifactSets.map((artifactSet) => artifactSet.batchId),
      cat02BatchReadbackSetSha256: h(
        canonicalJson({
          contractId: 'catalog-cat02-batch-readback-set-v1',
          batchIds: proof.artifactSets.map((artifactSet) => artifactSet.batchId),
        }),
      ),
      cat02ArtifactReadbackSetSha256: proof.artifactSetSha256,
      cat02MembershipReadbackSetSha256: digestReadbackSet(
        'catalog-cat02-membership-readback-set-v1',
        records,
        'cat02MembershipReadbackSha256',
      ),
      allExact: true,
    },
    signers: [authority.byRole.get('database_verifier').signer],
    signatures: [],
  };
  signDocument(
    readback,
    [{ ...authority.byRole.get('database_verifier'), signedAt: verifiedAt }],
    catalogDatabaseReadbackSigningPayload,
  );
  return readback;
}

function makeFixture() {
  const authority = makeAuthority();
  const targetPolicy = makeTargetPolicy(authority);
  const sets = artifactSets(targetPolicy);
  const records = makeRecords(authority, sets);
  const cat02MembershipProof = makeProof(authority, targetPolicy, sets, records);
  const databaseAuthorization = makeDatabaseReviewAuthorization(
    authority,
    targetPolicy,
    cat02MembershipProof,
    records,
  );
  const decisionAuthority = makePreholdoutAuthority(
    authority,
    targetPolicy,
    cat02MembershipProof,
    records,
    databaseAuthorization,
  );
  const betaShelfCorpus = makeCorpus(authority, targetPolicy, records, decisionAuthority);
  const curationReview = makeReview(
    authority,
    targetPolicy,
    cat02MembershipProof,
    betaShelfCorpus,
    records,
    sets,
  );
  const envelope = buildCatalogCurationEnvelope({
    targetPolicy,
    cat02MembershipProof,
    betaShelfCorpus,
    curationReview,
    trustRegistry: authority.trustRegistry,
    trustRegistryArtifactSha256: authority.trustRegistryArtifactSha256,
    trustedRoot: authority.trustedRoot,
    generatedAt: '2026-09-10T15:00:00.000Z',
  });
  const databaseReadback = makeReadback(authority, envelope);
  const verification = {
    trustRegistry: authority.trustRegistry,
    trustRegistryArtifactSha256: authority.trustRegistryArtifactSha256,
    trustedRoot: authority.trustedRoot,
    now: new Date('2026-09-10T16:00:00.000Z'),
  };
  return {
    authority,
    targetPolicy,
    cat02MembershipProof,
    betaShelfCorpus,
    curationReview,
    envelope,
    databaseReadback,
    verification,
  };
}

const fixture = makeFixture();

test('builds a 2,000-record, six-category envelope and reserves clear for DB readback', () => {
  assert.deepEqual(
    validateCatalogCurationEnvelope(fixture.envelope, fixture.verification),
    fixture.envelope,
  );
  const inventory = evaluateCatalogInventoryTargets(fixture.targetPolicy, fixture.curationReview);
  assert.equal(inventory.clear, true);
  assert.equal(inventory.eligibleRecordCount, 2000);
  assert.equal(inventory.prioritizedEligibleRecordCount, 100);
  assert.deepEqual(inventory.eligibleByCategory, CATEGORY_FLOORS);
  const preactivation = buildCatalogCoverageQualityReport(fixture.envelope, fixture.verification);
  assert.equal(preactivation.status, 'approved_for_activation');
  assert.equal(preactivation.catalogCurationClear, false);
  assert.equal(preactivation.clearAsOf, null);
  assert.equal(preactivation.statisticalDesign.unit, 'one_distinct_participant_per_endpoint');
  assert.equal(preactivation.statisticalDesign.confidenceBoundsAreMarginalNotSimultaneous, true);
  assert.equal(preactivation.privacyEvidenceSummary.preOpenReadCount, 0);
  assert.equal(preactivation.privacyEvidenceSummary.executedAnalysisLookCount, 1);
  assert.equal(preactivation.confidence.belowUsableRecommendation.available, true);
  assert.equal(
    preactivation.curationSummary.servedStateMutationRootSetSha256,
    catalogServedStateMutationRootSetSha256(fixture.curationReview.records),
  );
  assert.equal(preactivation.databaseReleaseSummary.currentServedStateMutationRootSetSha256, null);
  const finalReport = buildCatalogCoverageQualityReport(fixture.envelope, {
    ...fixture.verification,
    databaseReadback: fixture.databaseReadback,
  });
  assert.equal(finalReport.status, 'clear');
  assert.equal(finalReport.catalogCurationClear, true);
  assert.equal(finalReport.clearanceIsPointInTime, true);
  assert.equal(finalReport.durableCurrentClearanceClaimed, false);
  assert.equal(finalReport.databaseReleaseSummary.currentLiveEligibleRecordCount, 2000);
  assert.equal(
    finalReport.databaseReleaseSummary.currentServedStateMutationRootSetSha256,
    catalogServedStateMutationRootSetSha256(fixture.curationReview.records),
  );
});

test('validates independent signed CAT-02 membership and final DB readback authorities', () => {
  assert.equal(
    validateCatalogDatabaseReadback(fixture.databaseReadback, {
      envelope: fixture.envelope,
      ...fixture.verification,
    }),
    fixture.databaseReadback,
  );
  assert.equal(fixture.cat02MembershipProof.artifactSets.length, 2);
  assert.equal(fixture.cat02MembershipProof.memberships.length, 10000);
  assert.equal(fixture.cat02MembershipProof.databaseObservation.missingMembershipCount, 0);
});

test('full pre-holdout commitment rejects any authority-bearing record mutation', () => {
  const review = structuredClone(fixture.curationReview);
  review.records[0].regulatoryEvidence.allowedAppBehavior = 'altered';
  assert.throws(
    () =>
      validateCatalogCurationReview(review, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /commitment|signature|authority/u,
  );
});

test('append-only served-state mutation roots reject missing, tampered, and pre-record stale review authority', () => {
  assert.equal(
    catalogServedStateMutationRootSetSha256([
      {
        productRecordSha256: 'b158b7767ae4b3e3d860cd4b9ed4096bab22dd9fd8a36b1fb638fad57e9fa1b6',
        servedStateMutationRootSha256:
          '1987be70ed4b250c4d3580deb133b45955b0e910e71efc9239f1afb05b2f097a',
      },
      {
        productRecordSha256: 'a9dfbdb3499a116a047047a6e9c0bf4077a53e8dbf2f894d3c7bd6653c8cd5bc',
        servedStateMutationRootSha256:
          '9bbf6049ac0792b14d12f2c69b85eb4c49beddff6de1d72c7e15310b95569892',
      },
    ]),
    'f4a78f23347dd671722ee265c7191392c387370bf05afe2c875c5e11c3bf119f',
  );
  const validateReview = (review, proof = fixture.cat02MembershipProof) =>
    validateCatalogCurationReview(review, {
      targetPolicy: fixture.targetPolicy,
      betaShelfCorpus: fixture.betaShelfCorpus,
      cat02MembershipProof: proof,
      trustRegistry: fixture.authority.trustRegistry,
    });
  const expectedRootSetSha256 = catalogServedStateMutationRootSetSha256(
    fixture.curationReview.records,
  );
  assert.equal(
    fixture.cat02MembershipProof.databaseObservation.observedServedStateMutationRootSetSha256,
    expectedRootSetSha256,
  );

  const missing = structuredClone(fixture.curationReview);
  delete missing.records[0].servedStateMutationRootSha256;
  assert.throws(() => validateReview(missing), /served-state mutation root/u);

  const tampered = structuredClone(fixture.curationReview);
  tampered.records[0].servedStateMutationRootSha256 = h('tampered served-state mutation root');
  assert.throws(() => validateReview(tampered), /mutation root set .*tampered|mutation root/u);

  for (const forbiddenField of ['snapshotSha256', 'correctionLedgerSha256']) {
    const privacyUnsafeSnapshot = structuredClone(fixture.curationReview);
    privacyUnsafeSnapshot.databaseSnapshot[forbiddenField] = h(`forbidden:${forbiddenField}`);
    assert.throws(
      () => validateReview(privacyUnsafeSnapshot),
      /databaseSnapshot has missing or unknown fields/u,
      `${forbiddenField} must not create an opaque fingerprint of unrelated or user correction data`,
    );
  }

  // This is the modeled mutation-before-record/exact-restoration case: the
  // independently signed DB observation advanced monotonically even though the
  // served bytes may have been restored. The old review cannot be reused.
  const advancedRootSetSha256 = h(
    'served-state mutation root set after pre-record withdrawal and exact restoration',
  );
  const advancedProof = structuredClone(fixture.cat02MembershipProof);
  advancedProof.databaseObservation.observedServedStateMutationRootSetSha256 =
    advancedRootSetSha256;
  signDocument(
    advancedProof,
    [
      {
        ...fixture.authority.byRole.get('cat02_database_membership_verifier'),
        signedAt: advancedProof.verifiedAt,
      },
    ],
    catalogCat02MembershipProofSigningPayload,
  );
  assert.equal(
    validateCatalogCat02MembershipProof(advancedProof, {
      targetPolicy: fixture.targetPolicy,
      trustRegistry: fixture.authority.trustRegistry,
    }),
    advancedProof,
  );
  assert.throws(
    () => validateReview(fixture.curationReview, advancedProof),
    /mutation root set .*stale/u,
  );

  const currentDatabaseAdvanced = structuredClone(fixture.databaseReadback);
  currentDatabaseAdvanced.databaseState.currentServedStateMutationRootSetSha256 =
    advancedRootSetSha256;
  signDocument(
    currentDatabaseAdvanced,
    [
      {
        ...fixture.authority.byRole.get('database_verifier'),
        signedAt: currentDatabaseAdvanced.verifiedAt,
      },
    ],
    catalogDatabaseReadbackSigningPayload,
  );
  assert.throws(
    () =>
      validateCatalogDatabaseReadback(currentDatabaseAdvanced, {
        envelope: fixture.envelope,
        ...fixture.verification,
      }),
    /does not match the signed current campaign\/release authority/u,
  );
});

test('activation operator is independent from every outcome reviewer', () => {
  const review = structuredClone(fixture.curationReview);
  review.activation.operator = {
    ...review.reviewers[0],
    decisionRole: 'activation_operator',
  };
  assert.throws(
    () =>
      validateCatalogCurationReview(review, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /activation operator must be independent/u,
  );
});

test('outcome reviewers seal first and activation authorization is strictly later', () => {
  const validate = (review) =>
    validateCatalogCurationReview(review, {
      targetPolicy: fixture.targetPolicy,
      betaShelfCorpus: fixture.betaShelfCorpus,
      cat02MembershipProof: fixture.cat02MembershipProof,
      trustRegistry: fixture.authority.trustRegistry,
    });
  const firstReviewerSignature = fixture.curationReview.signatures[0];
  const signedReviewBody = catalogCurationReviewSigningPayload(
    fixture.curationReview,
    firstReviewerSignature,
  );
  const postReviewFieldsChanged = structuredClone(fixture.curationReview);
  postReviewFieldsChanged.curationOutcomeReviewerSignatureSetSha256 = h(
    'different downstream reviewer root',
  );
  postReviewFieldsChanged.databaseCampaignPlan = null;
  postReviewFieldsChanged.databaseCampaignPlanSha256 = h('different downstream campaign plan');
  postReviewFieldsChanged.activation.activationAuthorizationSetSha256 = h(
    'different downstream activation set',
  );
  postReviewFieldsChanged.activation.authorizationSignature.valueBase64 = Buffer.alloc(
    64,
    7,
  ).toString('base64');
  assert.deepEqual(
    catalogCurationReviewSigningPayload(postReviewFieldsChanged, firstReviewerSignature),
    signedReviewBody,
  );
  const preReviewMutationRootChanged = structuredClone(fixture.curationReview);
  preReviewMutationRootChanged.records[0].servedStateMutationRootSha256 = h(
    'changed pre-review served-state mutation root',
  );
  assert.notDeepEqual(
    catalogCurationReviewSigningPayload(preReviewMutationRootChanged, firstReviewerSignature),
    signedReviewBody,
  );
  assert.equal(
    fixture.curationReview.curationOutcomeReviewerSignatureSetSha256,
    catalogCurationOutcomeReviewerSignatureSetSha256(fixture.curationReview),
  );
  assert.ok(
    fixture.curationReview.signatures.every(
      (signature) =>
        Date.parse(signature.signedAt) <
        Date.parse(fixture.curationReview.activation.authorizationSignature.signedAt),
    ),
  );

  const backdated = structuredClone(fixture.curationReview);
  signActivation(backdated, fixture.authority, '2026-09-10T13:55:00.000Z');
  assert.throws(() => validate(backdated), /cannot sign before the planned activation instant/u);

  const activationFirst = structuredClone(fixture.curationReview);
  signOutcomeReview(activationFirst, fixture.authority, [
    '2026-09-10T13:20:00.000Z',
    '2026-09-10T13:25:00.000Z',
    '2026-09-10T13:30:00.000Z',
    '2026-09-10T14:10:00.000Z',
  ]);
  activationFirst.activation.activationAuthorizationSetSha256 =
    catalogCurationActivationAuthorizationSetSha256(activationFirst);
  signActivation(activationFirst, fixture.authority, '2026-09-10T14:05:00.000Z');
  assert.throws(
    () => validate(activationFirst),
    /planned activation must be strictly after|must sign strictly after every outcome reviewer/u,
  );

  const rootTamper = structuredClone(fixture.curationReview);
  rootTamper.curationOutcomeReviewerSignatureSetSha256 = h('tampered outcome reviewer root');
  assert.throws(() => validate(rootTamper), /signature-set root does not match/u);

  const authorizationTamper = structuredClone(fixture.curationReview);
  authorizationTamper.activation.activationAuthorizationSetSha256 = h(
    'tampered post-review activation set',
  );
  assert.throws(
    () => validate(authorizationTamper),
    /authorization-set digest|activation operator signature does not authorize/u,
  );

  const replacedReviewerSet = structuredClone(fixture.curationReview);
  signOutcomeReview(replacedReviewerSet, fixture.authority, [
    '2026-09-10T13:21:00.000Z',
    '2026-09-10T13:26:00.000Z',
    '2026-09-10T13:31:00.000Z',
    '2026-09-10T13:36:00.000Z',
  ]);
  replacedReviewerSet.activation.activationAuthorizationSetSha256 =
    catalogCurationActivationAuthorizationSetSha256(replacedReviewerSet);
  assert.throws(
    () => validate(replacedReviewerSet),
    /activation operator signature does not authorize/u,
  );

  const reviewerBodyTamper = structuredClone(fixture.curationReview);
  reviewerBodyTamper.activation.decision = 'withhold_activation';
  assert.throws(() => validate(reviewerBodyTamper), /curation review .*signature/u);
});

test('hard inventory floor cannot be satisfied by a token record or null priorities', () => {
  const review = structuredClone(fixture.curationReview);
  review.records = review.records.slice(0, 1);
  const tokenInventory = evaluateCatalogInventoryTargets(fixture.targetPolicy, review);
  assert.equal(tokenInventory.clear, false);
  assert.deepEqual(
    tokenInventory.gates.find((gate) => gate.code === 'eligible_catalog_record_floor'),
    {
      code: 'eligible_catalog_record_floor',
      passed: false,
      actual: 1,
      comparator: '>=',
      target: 2000,
    },
  );
  assert.throws(
    () =>
      validateCatalogCurationReview(review, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /contract rejected/u,
  );
  const priorityless = structuredClone(fixture.curationReview);
  for (const record of priorityless.records) record.demandPriorityRank = null;
  assert.equal(evaluateCatalogInventoryTargets(fixture.targetPolicy, priorityless).clear, false);
});

test('every unsuppressed demand commitment maps once and to the same category', () => {
  const review = structuredClone(fixture.curationReview);
  const prioritized = review.records.find((record) => record.demandPriorityRank === 1);
  prioritized.categoryCode = prioritized.categoryCode === 'serum' ? 'sunscreen' : 'serum';
  assert.throws(
    () =>
      validateCatalogCurationReview(review, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /category|signature/u,
  );
});

test('stratum Wilson gates expose a bad required category hidden by a passing aggregate', () => {
  const corpus = structuredClone(fixture.betaShelfCorpus);
  const row = corpus.cohorts.holdout.categoryOutcomes[0];
  row.correctMatches = 180;
  row.noMatches = 20;
  corpus.cohorts.holdout.outcomes.correctMatches = 1180;
  corpus.cohorts.holdout.outcomes.noMatches = 20;
  corpus.cohorts.holdout.outcomes.matchedEvaluations = 1180;
  const evaluation = evaluateCatalogCoverageTargets(fixture.targetPolicy, corpus);
  assert.equal(
    evaluation.gates.find((gate) => gate.code === 'holdout_correct_match_wilson_lower_bound')
      .passed,
    true,
  );
  assert.equal(
    evaluation.gates.find(
      (gate) => gate.code === 'holdout_category_acne_treatment_correct_match_wilson_lower_bound',
    ).passed,
    false,
  );
});

test('contributors, bucket counts, overlap, and nonzero operational denominators fail closed', () => {
  const corpus = structuredClone(fixture.betaShelfCorpus);
  corpus.cohorts.curation.contributors = 4;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(corpus, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /count|contributors/u,
  );
  const outcome = structuredClone(fixture.betaShelfCorpus);
  outcome.cohorts.holdout.outcomes.manualFallbackEvaluations = 0;
  outcome.cohorts.holdout.outcomes.manualFallbackCompletions = 0;
  assert.equal(evaluateCatalogCoverageTargets(fixture.targetPolicy, outcome).clear, false);
  const overlap = structuredClone(fixture.betaShelfCorpus);
  overlap.releaseControls.cohortOverlapCount = 1;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(overlap, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /between 0 and 0|disjoint/u,
  );
});

test('tampered or untrusted external timestamp/log receipt is rejected', () => {
  const corpus = structuredClone(fixture.betaShelfCorpus);
  corpus.curationDecisionAuthority.externalWitnessReceipt.sequence = 42;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(corpus, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /timestamp|ledger|signature/u,
  );
  const untrusted = structuredClone(fixture.betaShelfCorpus);
  untrusted.curationDecisionAuthority.externalTimestampAuthoritySha256 = h('untrusted authority');
  assert.throws(
    () =>
      validateCatalogBetaCorpus(untrusted, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /timestamp|pinned|signature/u,
  );
});

test('CAT-02 proof requires production-integral batches, variable ingredient entities, and zero DB variance', () => {
  const synthetic = structuredClone(fixture.cat02MembershipProof);
  synthetic.artifactSets[0].artifactKind = 'fixture';
  assert.throws(
    () =>
      validateCatalogCat02MembershipProof(synthetic, {
        targetPolicy: fixture.targetPolicy,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /must be production/u,
  );
  const forgedIntegrity = structuredClone(fixture.cat02MembershipProof);
  forgedIntegrity.artifactSets[0].productionIntegrityEvidenceSha256 = h(
    'synthetic integrity claim',
  );
  assert.throws(
    () =>
      validateCatalogCat02MembershipProof(forgedIntegrity, {
        targetPolicy: fixture.targetPolicy,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /production-integrity|artifact-set|signature|exact live/u,
  );
  const crossBatchProductProjection = structuredClone(fixture.cat02MembershipProof);
  const secondaryArtifact = crossBatchProductProjection.artifactSets[1];
  for (const membership of crossBatchProductProjection.memberships.filter(
    (entry) => entry.fieldScope !== 'ingredients',
  )) {
    membership.batchId = secondaryArtifact.batchId;
    membership.sourceQaSha256 = secondaryArtifact.qaReportSha256;
  }
  refreshCat02MembershipProof(crossBatchProductProjection, fixture.authority);
  assert.throws(
    () =>
      validateCatalogCat02MembershipProof(crossBatchProductProjection, {
        targetPolicy: fixture.targetPolicy,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /exact target-policy primary artifact/u,
  );

  const duplicatePrimaryArtifact = structuredClone(fixture.cat02MembershipProof);
  const [declaredPrimary, duplicatePrimary] = duplicatePrimaryArtifact.artifactSets;
  for (const key of [
    'stageEnvelopeSha256',
    'databaseReceiptCompletionSha256',
    'promotionReceiptSha256',
    'qaReportSha256',
  ]) {
    duplicatePrimary[key] = declaredPrimary[key];
  }
  for (const membership of duplicatePrimaryArtifact.memberships.filter(
    (entry) => entry.batchId === duplicatePrimary.batchId,
  )) {
    membership.sourceQaSha256 = duplicatePrimary.qaReportSha256;
  }
  refreshCat02MembershipProof(duplicatePrimaryArtifact, fixture.authority);
  assert.throws(
    () =>
      validateCatalogCat02MembershipProof(duplicatePrimaryArtifact, {
        targetPolicy: fixture.targetPolicy,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /exactly one artifact matching all four/u,
  );
  const missingScope = structuredClone(fixture.cat02MembershipProof);
  const firstProductRecordSha256 = missingScope.memberships[0].productRecordSha256;
  missingScope.memberships = missingScope.memberships.filter(
    (membership) =>
      membership.productRecordSha256 !== firstProductRecordSha256 ||
      membership.fieldScope !== 'ingredients',
  );
  refreshCat02MembershipProof(missingScope, fixture.authority);
  assert.throws(
    () =>
      validateCatalogCat02MembershipProof(missingScope, {
        targetPolicy: fixture.targetPolicy,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /at least one ingredients dependency entity/u,
  );

  const missingIngredient = structuredClone(fixture.cat02MembershipProof);
  const oneIngredientIndex = missingIngredient.memberships.findIndex(
    (membership) =>
      membership.productRecordSha256 === firstProductRecordSha256 &&
      membership.fieldScope === 'ingredients',
  );
  missingIngredient.memberships.splice(oneIngredientIndex, 1);
  refreshCat02MembershipProof(missingIngredient, fixture.authority);
  assert.equal(
    validateCatalogCat02MembershipProof(missingIngredient, {
      targetPolicy: fixture.targetPolicy,
      trustRegistry: fixture.authority.trustRegistry,
    }),
    missingIngredient,
  );

  const extraIngredient = structuredClone(fixture.cat02MembershipProof);
  const added = structuredClone(
    extraIngredient.memberships.find(
      (membership) =>
        membership.productRecordSha256 === firstProductRecordSha256 &&
        membership.fieldScope === 'ingredients',
    ),
  );
  added.dependencyEntitySha256 = h('extra mapped ingredient dependency entity');
  added.cat02StageRecordSha256 = h('extra mapped ingredient stage row');
  added.cat02DatabaseNormalizedRecordSha256 = h('extra mapped ingredient normalized row');
  added.sourceApprovalSha256 = h('extra mapped ingredient source approval');
  added.sourceQaSha256 = h('extra mapped ingredient source QA');
  added.membershipEvidenceSha256 = h('extra mapped ingredient evidence');
  extraIngredient.memberships.push(added);
  refreshCat02MembershipProof(extraIngredient, fixture.authority);

  for (const proof of [missingIngredient, extraIngredient]) {
    assert.throws(
      () =>
        buildCatalogCurationEnvelope({
          targetPolicy: fixture.targetPolicy,
          cat02MembershipProof: proof,
          betaShelfCorpus: fixture.betaShelfCorpus,
          curationReview: fixture.curationReview,
          trustRegistry: fixture.authority.trustRegistry,
          trustRegistryArtifactSha256: fixture.authority.trustRegistryArtifactSha256,
          trustedRoot: fixture.authority.trustedRoot,
          generatedAt: '2026-09-10T15:00:00.000Z',
        }),
      /CAT-02|membership|authority|commitment/u,
    );
  }

  const duplicateIngredient = structuredClone(fixture.cat02MembershipProof);
  duplicateIngredient.memberships.push(
    structuredClone(
      duplicateIngredient.memberships.find(
        (membership) =>
          membership.productRecordSha256 === firstProductRecordSha256 &&
          membership.fieldScope === 'ingredients',
      ),
    ),
  );
  refreshCat02MembershipProof(duplicateIngredient, fixture.authority);
  assert.throws(
    () =>
      validateCatalogCat02MembershipProof(duplicateIngredient, {
        targetPolicy: fixture.targetPolicy,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /must be unique/u,
  );

  const duplicateRecordEntity = structuredClone(fixture.curationReview);
  const ingredientMemberships = duplicateRecordEntity.records[0].dependencyMemberships.filter(
    (membership) => membership.fieldScope === 'ingredients',
  );
  ingredientMemberships[1].dependencyEntitySha256 = ingredientMemberships[0].dependencyEntitySha256;
  signOutcomeReview(duplicateRecordEntity, fixture.authority);
  duplicateRecordEntity.activation.activationAuthorizationSetSha256 =
    catalogCurationActivationAuthorizationSetSha256(duplicateRecordEntity);
  signActivation(duplicateRecordEntity, fixture.authority);
  assert.throws(
    () =>
      validateCatalogCurationReview(duplicateRecordEntity, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /unique/u,
  );
});

test('database readback rejects subsets, extras, and current-serving mismatches', () => {
  for (const mutate of [
    (receipt) => receipt.records.pop(),
    (receipt) => receipt.records.push(structuredClone(receipt.records[0])),
    (receipt) => {
      receipt.records[0].currentLiveEligibilitySha256 = h('wrong live row');
    },
  ]) {
    const readback = structuredClone(fixture.databaseReadback);
    mutate(readback);
    assert.throws(
      () =>
        validateCatalogDatabaseReadback(readback, {
          envelope: fixture.envelope,
          ...fixture.verification,
        }),
      /record|between|set|signature/u,
    );
  }
  for (const key of [
    'cat02MembershipProofSha256',
    'cat02DatabaseObservationSha256',
    'cat02VerifierSignatureSetSha256',
    'cat02ProductionIntegritySetSha256',
    'servedStateMutationRootSha256',
    'servedStateMutationRootSetSha256',
    'curationOutcomeReviewerSignatureSetSha256',
  ]) {
    const readback = structuredClone(fixture.databaseReadback);
    readback.authority[key] = h(`tampered readback ${key}`);
    assert.throws(
      () =>
        validateCatalogDatabaseReadback(readback, {
          envelope: fixture.envelope,
          ...fixture.verification,
        }),
      /authority|signature/u,
    );
  }
});

test('CAT-03 review and readback reject pre-0062 schema authority', () => {
  const legacyReview = structuredClone(fixture.curationReview);
  legacyReview.databaseSnapshot.schemaMigrationVersion = '20260717000058';
  signOutcomeReview(legacyReview, fixture.authority);
  legacyReview.activation.activationAuthorizationSetSha256 =
    catalogCurationActivationAuthorizationSetSha256(legacyReview);
  signActivation(legacyReview, fixture.authority);
  assert.throws(
    () =>
      validateCatalogCurationReview(legacyReview, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /schema migration version is invalid/u,
  );

  const legacyReadback = structuredClone(fixture.databaseReadback);
  legacyReadback.databaseState.schemaMigrationVersion = '20260717000058';
  signDocument(
    legacyReadback,
    [
      {
        ...fixture.authority.byRole.get('database_verifier'),
        signedAt: legacyReadback.verifiedAt,
      },
    ],
    catalogDatabaseReadbackSigningPayload,
  );
  assert.throws(
    () =>
      validateCatalogDatabaseReadback(legacyReadback, {
        envelope: fixture.envelope,
        ...fixture.verification,
      }),
    /current campaign\/release authority/u,
  );
});

test('CAT-03 review binds the exact current migration and database-contract bytes', () => {
  const wrongMigration = structuredClone(fixture.curationReview);
  wrongMigration.databaseSnapshot.cat03MigrationSha256 = h('invented cat03 migration bytes');
  assert.throws(
    () =>
      validateCatalogCurationReview(wrongMigration, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /migration digest does not match the exact current 0062 bytes/u,
  );

  const wrongDatabaseContract = structuredClone(fixture.curationReview);
  wrongDatabaseContract.databaseSnapshot.cat03DatabaseContractTestSha256 = h(
    'invented cat03 pg tap bytes',
  );
  assert.throws(
    () =>
      validateCatalogCurationReview(wrongDatabaseContract, {
        targetPolicy: fixture.targetPolicy,
        betaShelfCorpus: fixture.betaShelfCorpus,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /database-contract digest does not match the exact current pgTAP bytes/u,
  );
});

test('target inventory declaration cannot weaken 2,000/six-category consistency', () => {
  const target = structuredClone(fixture.targetPolicy);
  target.targets.inventory.minimumEligibleCatalogRecords = 1999;
  assert.throws(
    () => validateCatalogTargetPolicy(target, { trustRegistry: fixture.authority.trustRegistry }),
    /between 2000|2,000/u,
  );
  const subset = structuredClone(fixture.targetPolicy);
  subset.targets.requiredCategoryCodes = ['sunscreen'];
  subset.targets.inventory.minimumEligibleByRequiredCategory = { sunscreen: 2000 };
  assert.throws(
    () => validateCatalogTargetPolicy(subset, { trustRegistry: fixture.authority.trustRegistry }),
    /six-category/u,
  );
});

test('database eligibility policy canonical text and digest match the fixed JS/PostgreSQL golden vector', () => {
  const expectedCanonicalJson =
    '{"contractId":"catalog-launch-db-eligibility-policy-v1","minimumBarcodeQualityScore":95.00,"minimumCategoryQualityScore":95.00,"minimumDataQualityScore":95.00,"minimumIngredientQualityScore":95.00,"minimumMappedIngredientCount":1,"minimumParseConfidence":0.9800,"minimumTokenMatchConfidence":0.9800,"regulatedCategoryMode":"qualified-review-required","requireBarcode":true,"requiredQualityGrade":"verified","territory":"US"}';
  const expectedSha256 = '9b1fd33edaec8cf3c8582f3f9298ec9e70f5f4140b6426afb1e710eee4845e9d';
  assert.equal(CATALOG_DB_ELIGIBILITY_POLICY_GOLDEN_CANONICAL_JSON, expectedCanonicalJson);
  assert.equal(CATALOG_DB_ELIGIBILITY_POLICY_GOLDEN_SHA256, expectedSha256);
  assert.equal(
    catalogDbEligibilityPolicyCanonicalJson(fixture.targetPolicy.databaseEligibilityPolicy),
    expectedCanonicalJson,
  );
  assert.equal(
    catalogDbEligibilityPolicySha256(fixture.targetPolicy.databaseEligibilityPolicy),
    expectedSha256,
  );
});

test('0058 and JS canonical bridges use identical mapping/auth/record-set vocabulary', () => {
  const sql = readFileSync(
    resolve(root, 'supabase/migrations/20260717000058_catalog_launch_curation.sql'),
    'utf8',
  );
  for (const key of [
    'offlineBaseSealedRecordSha256',
    'databaseBaseRecordSha256',
    'reviewedRecordMappingSha256',
    'databaseActivationRequestSha256',
    'activationSignatureSha256',
    'manifestEntrySha256',
    'regulatoryClassification',
    'regulatoryReviewEvidenceSha256',
    'regulatoryReviewerRole',
    'regulatoryReviewerIds',
    'regulatorySignatureSetSha256',
    'reviewerEvidenceSha256s',
    'reviewerSignatureSetSha256',
    'reviewAuthority',
    'cat02ArtifactSetSha256',
    'dependencyEntitySha256',
    'cat02MembershipSetSha256',
    'cat02MembershipProofSha256',
    'cat02DatabaseObservationSha256',
    'cat02VerifierSignatureSetSha256',
    'cat02ProductionIntegritySetSha256',
    'curationOutcomeReviewerSignatureSetSha256',
    'contributingBatchIds',
    'contributingBatchSetSha256',
    'catalog-launch-curation-database-record-set-v1',
    'catalog-cat02-retained-dependency-entity-v1',
  ]) {
    assert.match(sql, new RegExp(key, 'u'));
  }
  assert.match(
    sql,
    /catalog-launch-curation-database-base-record-v1[\s\S]*?servedStateMutationRootSha256[\s\S]*?regulatoryReviewEvidenceSha256[\s\S]*?regulatoryReviewerRole[\s\S]*?regulatoryReviewerIds/u,
  );
  assert.match(
    sql,
    /catalog-launch-curation-reviewed-record-mapping-v1[\s\S]*?productRecordSha256[\s\S]*?servedStateMutationRootSha256[\s\S]*?offlineBaseSealedRecordSha256/u,
  );
  assert.match(
    sql,
    /catalog-launch-curation-activation-authorization-v1[\s\S]*?productRecordSha256[\s\S]*?servedStateMutationRootSha256[\s\S]*?offlineBaseSealedRecordSha256/u,
  );
  assert.match(
    sql,
    /catalog-launch-curation-record-v1[\s\S]*?servedStateMutationRootSha256[\s\S]*?reviewAuthority[\s\S]*?cat02MembershipProofSha256[\s\S]*?cat02DatabaseObservationSha256[\s\S]*?cat02VerifierSignatureSetSha256[\s\S]*?cat02ProductionIntegritySetSha256[\s\S]*?curationOutcomeReviewerSignatureSetSha256[\s\S]*?regulatorySignatureSetSha256[\s\S]*?reviewerEvidenceSha256s[\s\S]*?reviewerSignatureSetSha256/u,
  );
  const dbRecord = catalogCurationDatabaseRecordSet(fixture.curationReview).records[0];
  const review = fixture.curationReview;
  const reviewedRecord = review.records[0];
  const expectedReviewAuthority = {
    cat02MembershipProofSha256: review.cat02MembershipProofSha256,
    cat02DatabaseObservationSha256: review.cat02DatabaseObservationSha256,
    cat02VerifierSignatureSetSha256: review.cat02VerifierSignatureSetSha256,
    cat02ProductionIntegritySetSha256: review.cat02ProductionIntegritySetSha256,
    curationOutcomeReviewerSignatureSetSha256: review.curationOutcomeReviewerSignatureSetSha256,
    regulatoryReviewerRole: 'regulatory_reviewer',
    regulatoryReviewEvidenceSha256: catalogDocumentSha256(reviewedRecord.regulatoryEvidence),
    regulatoryReviewerIds: [review.reviewers[2].reviewerId],
    regulatorySignatureSetSha256: catalogRegulatorySignatureSetSha256(review),
    reviewerRoles: ['catalog_quality_reviewer', 'data_quality_reviewer'],
    reviewerEvidenceSha256s: review.reviewers
      .slice(0, 2)
      .map((reviewer) => reviewer.qualificationEvidenceSha256),
    reviewerSignatureSetSha256: catalogRecordReviewerSignatureSetSha256(review),
  };
  const expectedFinalAuthority = {
    contractId: 'catalog-launch-curation-record-v1',
    offlineRecordAuthorityContractId:
      'catalog-launch-curation-offline-reviewed-record-authority-v1',
    offlineBaseSealedRecordSha256: dbRecord.offlineBaseSealedRecordSha256,
    databaseBaseRecordSha256: dbRecord.databaseBaseRecordSha256,
    reviewedRecordMappingSha256: dbRecord.reviewedRecordMappingSha256,
    servedStateMutationRootSha256: reviewedRecord.servedStateMutationRootSha256,
    reviewAuthority: expectedReviewAuthority,
    activationDecision: 'approve_activation',
    activationOperatorRole: 'activation_operator',
    activationOperatorId: review.activation.operator.reviewerId,
    activationPlannedAt: review.activation.plannedAt,
    databaseActivationRequestSha256: dbRecord.databaseActivationRequestSha256,
    activationSignature: {
      signerRole: 'activation_operator',
      signerId: review.activation.operator.reviewerId,
      signatureSha256: dbRecord.activationSignatureSha256,
    },
  };
  assert.equal(dbRecord.curationRecordSha256, h(canonicalJson(expectedFinalAuthority)));
  assert.deepEqual(review.databaseCampaignPlan.contributingBatchIds, [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ]);
  assert.equal(
    review.databaseCampaignPlan.cat02ArtifactSetSha256,
    fixture.cat02MembershipProof.artifactSetSha256,
  );
  assert.equal(
    review.databaseCampaignPlan.cat02MembershipSetSha256,
    fixture.cat02MembershipProof.membershipSetSha256,
  );
  assert.equal(
    review.databaseCampaignPlan.cat02MembershipProofSha256,
    catalogDocumentSha256(fixture.cat02MembershipProof),
  );
  assert.equal(
    review.databaseCampaignPlan.cat02DatabaseObservationSha256,
    catalogCat02DatabaseObservationSha256(fixture.cat02MembershipProof),
  );
  assert.equal(
    review.databaseCampaignPlan.cat02VerifierSignatureSetSha256,
    catalogCat02VerifierSignatureSetSha256(fixture.cat02MembershipProof),
  );
  assert.equal(
    review.databaseCampaignPlan.cat02ProductionIntegritySetSha256,
    catalogCat02ProductionIntegritySetSha256(fixture.cat02MembershipProof.artifactSets),
  );
  assert.equal(dbRecord.manifestEntrySha256, dbRecord.offlineBaseSealedRecordSha256);
  assert.equal(Object.hasOwn(dbRecord, 'offlineReviewedRecordAuthoritySha256'), false);
  assert.equal(Object.hasOwn(dbRecord, 'databaseBaseSealedRecordSha256'), false);
});

test('CAT-03 operator templates expose the current exact schema while remaining blocked', () => {
  const parseTemplate = (name) =>
    readCatalogCurationInput(resolve(root, 'docs/phase-4', name), `checked-in CAT-03 ${name}`, root)
      .value;
  const keyTopology = (value) => {
    if (Array.isArray(value)) return value.length === 0 ? [] : [keyTopology(value[0])];
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value)
          .sort((left, right) => left.localeCompare(right, 'en-US'))
          .map((key) => [key, keyTopology(value[key])]),
      );
    }
    return null;
  };
  const target = parseTemplate('catalog-coverage-quality-targets.template.json');
  const proof = parseTemplate('catalog-cat02-membership-proof.template.json');
  const corpus = parseTemplate('beta-shelf-corpus.template.json');
  const review = parseTemplate('catalog-curation-review.template.json');
  const readback = parseTemplate('catalog-curation-database-readback.template.json');
  const matchingPrimaryArtifacts = proof.artifactSets.filter(
    (artifactSet) =>
      artifactSet.stageEnvelopeSha256 === target.lineage.cat02StageEnvelopeSha256 &&
      artifactSet.databaseReceiptCompletionSha256 ===
        target.lineage.cat02DatabaseReceiptCompletionSha256 &&
      artifactSet.promotionReceiptSha256 === target.lineage.cat02PromotionReceiptSha256 &&
      artifactSet.qaReportSha256 === target.lineage.cat02QaReportSha256,
  );
  assert.equal(matchingPrimaryArtifacts.length, 1);
  const templatePrimaryArtifact = matchingPrimaryArtifacts[0];
  const templatePrimaryArtifactSha256 = catalogCat02ArtifactSetSha256(templatePrimaryArtifact);
  const assertConservativeProductLineage = (memberships, productRecordSha256) => {
    const primary = memberships.find((membership) => membership.fieldScope === 'barcode_identity');
    for (const fieldScope of ['barcode_identity', 'category', 'regulatory_classification']) {
      const projection = memberships.find((membership) => membership.fieldScope === fieldScope);
      assert.equal(projection.batchId, templatePrimaryArtifact.batchId);
      assert.equal(projection.artifactSetSha256, templatePrimaryArtifactSha256);
      assert.equal(projection.cat02StageRecordSha256, productRecordSha256);
      assert.equal(projection.sourceQaSha256, templatePrimaryArtifact.qaReportSha256);
    }
    for (const fieldScope of ['category', 'regulatory_classification']) {
      const projection = memberships.find((membership) => membership.fieldScope === fieldScope);
      for (const key of [
        'batchId',
        'artifactSetSha256',
        'cat02StageRecordSha256',
        'sourceApprovalSha256',
        'sourceQaSha256',
      ]) {
        assert.equal(projection[key], primary[key], `${fieldScope}.${key} primary lineage`);
      }
    }
  };

  for (const [label, template, validFixture] of [
    ['target policy', target, fixture.targetPolicy],
    ['CAT-02 membership proof', proof, fixture.cat02MembershipProof],
    ['beta shelf corpus', corpus, fixture.betaShelfCorpus],
    ['curation review', review, fixture.curationReview],
    ['database readback', readback, fixture.databaseReadback],
  ]) {
    assert.deepEqual(
      keyTopology(template),
      keyTopology(validFixture),
      `${label} template topology`,
    );
  }

  assert.equal(
    target.databaseEligibilityPolicySha256,
    catalogDbEligibilityPolicySha256(target.databaseEligibilityPolicy),
  );
  assert.deepEqual(target.targets.requiredCategoryCodes, CATEGORIES);
  assert.deepEqual(
    Object.keys(target.targets.inventory.minimumEligibleByRequiredCategory),
    CATEGORIES,
  );
  assert.equal(proof.artifactSets.length, 2);
  assert.equal(
    proof.artifactSets.every(
      (artifactSet) =>
        artifactSet.artifactKind === 'production' &&
        /^[a-f0-9]{64}$/u.test(artifactSet.productionIntegrityEvidenceSha256),
    ),
    true,
  );
  assert.equal(proof.databaseObservation.allBatchesProductionIntegrityVerified, true);
  assert.deepEqual(
    [...new Set(proof.memberships.map((membership) => membership.fieldScope))],
    SCOPES,
  );
  assert.equal(
    proof.memberships.filter((membership) => membership.fieldScope === 'ingredients').length,
    2,
  );
  assert.equal(
    proof.memberships.every((membership) =>
      /^[a-f0-9]{64}$/u.test(membership.dependencyEntitySha256),
    ),
    true,
  );
  assert.equal(
    proof.artifactSetSha256,
    h(
      canonicalJson({
        contractId: 'catalog-cat02-curation-complete-artifact-set-v1',
        artifactSets: proof.artifactSets,
      }),
    ),
  );
  assert.equal(proof.membershipSetSha256, catalogCat02ProofMembershipSetSha256(proof.memberships));
  assertConservativeProductLineage(proof.memberships, proof.memberships[0].productRecordSha256);
  assert.equal(proof.databaseObservation.promotedBatchCount, proof.artifactSets.length);
  assert.equal(proof.databaseObservation.membershipRowCount, proof.memberships.length);
  const templateServedStateMutationRootSetSha256 = catalogServedStateMutationRootSetSha256(
    review.records,
  );
  assert.equal(
    proof.databaseObservation.observedServedStateMutationRootSetSha256,
    templateServedStateMutationRootSetSha256,
  );
  assert.equal(
    review.databaseSnapshot.servedStateMutationRootSetSha256,
    templateServedStateMutationRootSetSha256,
  );
  assert.equal(
    review.databaseCampaignPlan.servedStateMutationRootSetSha256,
    templateServedStateMutationRootSetSha256,
  );
  assert.deepEqual(
    corpus.curationDecisionAuthority.databaseReviewAuthorization.signers.map(
      (signer) => signer.decisionRole,
    ),
    ['catalog_quality_reviewer', 'data_quality_reviewer', 'regulatory_reviewer'],
  );
  for (const cohortName of ['curation', 'holdout']) {
    assert.equal(
      Object.hasOwn(corpus.cohorts[cohortName].outcomes, 'manualFallbackEvaluations'),
      true,
    );
    assert.equal(Object.hasOwn(corpus.cohorts[cohortName].outcomes, 'shelfFlowEvaluations'), true);
  }
  assert.deepEqual(
    [
      ...new Set(
        review.records[0].dependencyMemberships.map((membership) => membership.fieldScope),
      ),
    ],
    SCOPES,
  );
  assert.equal(
    review.records[0].dependencyMemberships.filter(
      (membership) => membership.fieldScope === 'ingredients',
    ).length,
    2,
  );
  assert.deepEqual(
    review.records[0].dependencyMemberships,
    proof.memberships.map(({ productRecordSha256, ...membership }) => {
      assert.equal(productRecordSha256, review.records[0].productRecordSha256);
      return membership;
    }),
  );
  assertConservativeProductLineage(
    review.records[0].dependencyMemberships,
    review.records[0].productRecordSha256,
  );
  assert.equal(
    review.records[0].regulatoryEvidence.allowedAppBehavior,
    'informational_catalog_display_only',
  );
  assert.equal(review.records[0].regulatoryEvidence.agencyProductApprovalClaimed, false);
  assert.deepEqual(
    review.databaseCampaignPlan.contributingBatchIds,
    proof.artifactSets.map(({ batchId }) => batchId),
  );
  assert.equal(review.reviewers.length, 4);
  assert.equal(
    review.curationOutcomeReviewerSignatureSetSha256,
    catalogCurationOutcomeReviewerSignatureSetSha256(review),
  );
  assert.equal(
    review.databaseCampaignPlan.curationOutcomeReviewerSignatureSetSha256,
    review.curationOutcomeReviewerSignatureSetSha256,
  );
  assert.equal(
    readback.authority.curationOutcomeReviewerSignatureSetSha256,
    review.curationOutcomeReviewerSignatureSetSha256,
  );
  assert.equal(
    readback.authority.servedStateMutationRootSetSha256,
    templateServedStateMutationRootSetSha256,
  );
  assert.equal(
    readback.databaseState.currentServedStateMutationRootSetSha256,
    templateServedStateMutationRootSetSha256,
  );
  assert.equal(
    readback.records[0].servedStateMutationRootSha256,
    review.records[0].servedStateMutationRootSha256,
  );
  assert.equal(review.activation.authorizationSignature.decisionRole, 'activation_operator');
  assert.deepEqual(
    readback.membershipReadback.batchIds,
    proof.artifactSets.map(({ batchId }) => batchId),
  );
  assert.ok(review.records.length < target.targets.inventory.minimumEligibleCatalogRecords);
  assert.ok(corpus.cohorts.holdout.participants < target.targets.minimumParticipants.holdout);
  assert.equal(readback.counts.currentLiveEligibleRecords, 1);
  assert.throws(() =>
    validateCatalogTargetPolicy(target, { trustRegistry: fixture.authority.trustRegistry }),
  );
  assert.throws(() =>
    validateCatalogCat02MembershipProof(proof, {
      targetPolicy: target,
      trustRegistry: fixture.authority.trustRegistry,
    }),
  );
  assert.throws(() =>
    validateCatalogBetaCorpus(corpus, {
      targetPolicy: target,
      cat02MembershipProof: proof,
      trustRegistry: fixture.authority.trustRegistry,
    }),
  );
  assert.throws(() =>
    validateCatalogCurationReview(review, {
      targetPolicy: target,
      betaShelfCorpus: corpus,
      cat02MembershipProof: proof,
      trustRegistry: fixture.authority.trustRegistry,
    }),
  );
  assert.throws(() =>
    validateCatalogDatabaseReadback(readback, {
      envelope: fixture.envelope,
      ...fixture.verification,
    }),
  );
});

test('participant-level Wilson units, caps, reconciliation, and small cells fail closed', () => {
  const overConcentrated = structuredClone(fixture.betaShelfCorpus);
  overConcentrated.cohorts.holdout.outcomes.lookupEvaluations = 1201;
  overConcentrated.cohorts.holdout.outcomes.correctMatches = 1201;
  overConcentrated.cohorts.holdout.outcomes.matchedEvaluations = 1201;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(overConcentrated, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /participant|contributors|between/u,
  );

  const smallCell = structuredClone(fixture.betaShelfCorpus);
  smallCell.cohorts.holdout.outcomes.correctMatches = 1199;
  smallCell.cohorts.holdout.outcomes.incorrectMatches = 1;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(smallCell, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /minimum-cell/u,
  );

  const clustered = structuredClone(fixture.betaShelfCorpus);
  clustered.evaluationUnitAudit.clusteredWilsonInputsPresent = true;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(clustered, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /clusteredWilsonInputsPresent/u,
  );
});

test('category ingredient and operational route/network strata cannot hide aggregate failures', () => {
  const categoryCorpus = structuredClone(fixture.betaShelfCorpus);
  const categoryUnknownCounts = [30, 5, 5, 5, 5, 0];
  categoryCorpus.cohorts.holdout.categoryOutcomes.forEach((row, index) => {
    row.ingredientEvaluationsWithUnknownTokens = categoryUnknownCounts[index];
  });
  const categoryEvaluation = evaluateCatalogCoverageTargets(fixture.targetPolicy, categoryCorpus);
  assert.equal(
    categoryEvaluation.gates.find(
      (entry) => entry.code === 'holdout_unknown_token_wilson_upper_bound',
    ).passed,
    true,
  );
  assert.equal(
    categoryEvaluation.gates.find(
      (entry) =>
        entry.code === 'holdout_category_acne_treatment_unknown_ingredient_wilson_upper_bound',
    ).passed,
    false,
  );

  const operationalCorpus = structuredClone(fixture.betaShelfCorpus);
  operationalCorpus.cohorts.holdout.operationalStratumOutcomes[0].manualFallbackCompletions = 100;
  operationalCorpus.cohorts.holdout.outcomes.manualFallbackCompletions = 475;
  const operationalEvaluation = evaluateCatalogCoverageTargets(
    fixture.targetPolicy,
    operationalCorpus,
  );
  assert.equal(
    operationalEvaluation.gates.find(
      (entry) => entry.code === 'holdout_manual_fallback_wilson_lower_bound',
    ).passed,
    true,
  );
  assert.equal(
    operationalEvaluation.gates.find(
      (entry) =>
        entry.code === 'holdout_operational_barcode_offline_manual_fallback_wilson_lower_bound',
    ).passed,
    false,
  );
});

test('below-usable recommendations require both zero observations and a Wilson upper bound', () => {
  const evaluation = evaluateCatalogCoverageTargets(fixture.targetPolicy, fixture.betaShelfCorpus);
  assert.equal(
    evaluation.gates.find(
      (entry) => entry.code === 'holdout_below_usable_recommendation_wilson_upper_bound',
    ).passed,
    true,
  );
  assert.equal(
    evaluation.gates.find((entry) => entry.code === 'below_usable_recommendations_zero').passed,
    true,
  );
  assert.equal(wilsonOneSidedBounds(0, 100).upperBasisPoints, 264);
  assert.ok(
    wilsonOneSidedBounds(0, 100).upperBasisPoints >
      fixture.targetPolicy.targets.thresholdsBasisPoints
        .holdoutBelowUsableRecommendationUpperBoundMax,
  );
});

test('missing strata and zero denominators are explicit unavailable evidence', () => {
  const corpus = structuredClone(fixture.betaShelfCorpus);
  corpus.cohorts.holdout.categoryOutcomes.pop();
  const evaluation = evaluateCatalogCoverageTargets(fixture.targetPolicy, corpus);
  assert.deepEqual(evaluation.confidence.requiredCategories.toner.correctMatch, {
    available: false,
    numerator: 0,
    denominator: 0,
    pointBasisPoints: null,
    lowerBasisPoints: null,
    upperBasisPoints: null,
  });
  assert.equal(
    evaluation.gates.find((entry) => entry.code === 'holdout_category_toner_lookup_minimum').passed,
    false,
  );
});

test('holdout access, reuse, build, HMAC, suppression, and registry receipt tampering fails closed', () => {
  for (const mutate of [
    (corpus) => {
      corpus.holdoutControlReceipt.preOpenReadCount = 1;
    },
    (corpus) => {
      corpus.holdoutControlReceipt.executedAnalysisLookCount = 2;
    },
    (corpus) => {
      corpus.holdoutControlReceipt.priorHoldoutUseCount = 1;
    },
    (corpus) => {
      corpus.provenance.collectionBuildSha256 = h('uncommitted alternate collection build');
    },
    (corpus) => {
      corpus.cohorts.holdout.demandBuckets[0].productDemandCommitmentSha256 = h(
        'unattested arbitrary digest',
      );
    },
    (corpus) => {
      corpus.privacyExecutionReceipt.allComplementaryCellsPreventReconstruction = false;
    },
    (corpus) => {
      corpus.releaseControls.updatedReleaseRegistrySha256 =
        corpus.releaseControls.priorReleaseRegistrySha256;
    },
  ]) {
    const corpus = structuredClone(fixture.betaShelfCorpus);
    mutate(corpus);
    assert.throws(
      () =>
        validateCatalogBetaCorpus(corpus, {
          targetPolicy: fixture.targetPolicy,
          cat02MembershipProof: fixture.cat02MembershipProof,
          trustRegistry: fixture.authority.trustRegistry,
        }),
      /holdout|precommitted|privacy|HMAC|release|signature|registry|between 0 and 0/u,
    );
  }

  const belowMinimum = structuredClone(fixture.betaShelfCorpus);
  belowMinimum.cohorts.holdout.demandBuckets[0].count = 4;
  assert.throws(
    () =>
      validateCatalogBetaCorpus(belowMinimum, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /between 5/u,
  );

  const lonePrimary = structuredClone(fixture.betaShelfCorpus);
  lonePrimary.cohorts.holdout.demandBuckets[0].count = null;
  lonePrimary.cohorts.holdout.demandBuckets[0].suppression = 'primary_small_cell';
  assert.throws(
    () =>
      validateCatalogBetaCorpus(lonePrimary, {
        targetPolicy: fixture.targetPolicy,
        cat02MembershipProof: fixture.cat02MembershipProof,
        trustRegistry: fixture.authority.trustRegistry,
      }),
    /primary and complementary/u,
  );
});

test('Wilson calculation is conservative and parser remains bounded above a 2,000-row artifact', () => {
  assert.deepEqual(wilsonOneSidedBounds(0, 0), {
    available: false,
    numerator: 0,
    denominator: 0,
    pointBasisPoints: null,
    lowerBasisPoints: null,
    upperBasisPoints: null,
  });
  assert.equal(wilsonOneSidedBounds(0, 200).upperBasisPoints, 134);
  assert.equal(wilsonOneSidedBounds(200, 200).lowerBasisPoints, 9866);
  assert.equal(wilsonOneSidedBounds(190, 200).lowerBasisPoints, 9181);
  assert.equal(wilsonOneSidedBounds(0, 100).upperBasisPoints, 264);
  assert.ok(
    wilsonOneSidedBounds(191, 200).lowerBasisPoints >
      wilsonOneSidedBounds(190, 200).lowerBasisPoints,
  );
  for (const args of [
    [1, 0],
    [2, 1],
    [-1, 10],
    [1.5, 10],
    [1, Number.POSITIVE_INFINITY],
  ]) {
    assert.throws(() => wilsonOneSidedBounds(...args), /Wilson|integer|numerator/u);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(fixture.curationReview)) < 32 * 1024 * 1024);
  const directory = mkdtempSync(join(tmpdir(), 'cat03-bounds-'));
  try {
    const path = join(directory, 'oversized.json');
    writeFileSync(path, Buffer.alloc(32 * 1024 * 1024 + 1, 0x20));
    assert.throws(
      () => readCatalogCurationInput(path, 'oversized evidence', directory),
      /bounded evidence-file/u,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
