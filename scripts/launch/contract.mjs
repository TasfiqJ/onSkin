import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LAUNCH_CONTRACT_PATH = 'docs/hugeToDo/launch-contract.json';
export const LAUNCH_CONTRACT_SCHEMA_VERSION = 1;
export const NOT_APPLICABLE = 'not_applicable';
export const REQUIRED_FEATURE_IDS = Object.freeze(
  Array.from({ length: 20 }, (_, index) => index + 1),
);
export const REQUIRED_SURFACE_KEYS = Object.freeze([
  'commerce',
  'community_posting',
  'community_aggregates',
  'trend_insights',
  'cloud_ask',
  'widgets',
  'live_activities',
  'share_cards',
  'reviewed_conflict_sharing',
  'goal_active_recommendations',
  'public_links',
  'review_prompts',
  'creator_links',
  'paid_measurement',
]);

const REQUIRED_EVIDENCE_LEVELS = Object.freeze([
  'code_complete',
  'locally_verified',
  'live_staging_verified',
  'physical_iphone_verified',
  'external_professional_review_signed',
  'production_verified',
  'store_approved',
]);

const REQUIRED_CORE_PROFESSIONAL_REVIEWS = Object.freeze({
  board_certified_dermatologist: Object.freeze({
    taskId: 'REV-04',
    scope: 'clinical_order_eligibility_and_user_copy',
  }),
  cosmetic_chemist: Object.freeze({
    taskId: 'REV-05',
    scope: 'formulation_order_and_application_copy',
  }),
  regulatory_counsel: Object.freeze({
    taskId: 'H-07',
    scope: 'claims_jurisdiction_and_market_clearance',
  }),
});

const CORE_PROFESSIONAL_REVIEW_FEATURE_KEYS = Object.freeze([
  'routine_builder',
  'cycle_scheduler',
  'recommendations',
]);

const REQUIRED_CONFLICT_SHARE_REVIEWS = Object.freeze({
  regulatory_claims_counsel: Object.freeze({
    taskId: 'REV-02',
    scope: 'exact_share_claims_copy_citations_and_market_positioning',
  }),
  privacy_security_reviewer: Object.freeze({
    taskId: 'REV-03',
    scope: 'share_projection_destination_retention_revocation_and_data_flow',
  }),
  board_certified_dermatologist: Object.freeze({
    taskId: 'REV-04',
    scope: 'exact_conflict_claim_clinical_meaning_and_user_copy',
  }),
  cosmetic_chemist: Object.freeze({
    taskId: 'REV-05',
    scope: 'exact_ingredient_compatibility_claim_and_application_copy',
  }),
  ip_content_rights_counsel: Object.freeze({
    taskId: 'REV-06',
    scope: 'exact_share_content_citations_images_trademarks_and_distribution_rights',
  }),
  release_signoff_operator: Object.freeze({
    taskId: 'REV-07',
    scope: 'detached_exact_source_signoffs_credentials_and_release_binding',
  }),
});

const PROFESSIONAL_REVIEW_FEATURE_KEYS = Object.freeze([
  ...CORE_PROFESSIONAL_REVIEW_FEATURE_KEYS,
  'conflict_share',
]);

const REQUIRED_CONFLICT_SHARE_ADMISSION = Object.freeze({
  sharePublicationAdmitted: false,
  publicLinksAdmitted: false,
  shareReceiptIssuerAvailable: false,
  publicTokenServiceAvailable: false,
  sanitizedProjectionAllowlistRequired: true,
  exactPayloadConfirmationRequired: true,
  rawPrivateFieldsAllowed: false,
  analyticsAllowed: false,
});

export const REQUIRED_TREND_INSIGHT_ADMISSION = Object.freeze({
  trendInsightAdmitted: false,
  validatedOnDeviceEngineAvailable: false,
  resultIssuerAvailable: false,
  calibrationAuthorityAvailable: false,
  fairnessAuthorityAvailable: false,
  simulatedMetricsAllowed: false,
  contentAnalyticsAllowed: false,
  disabledPathSideEffectsAllowed: false,
  cloudPhotoProcessingAllowed: false,
  scoreAgeGradePercentageAllowed: false,
});

export const REQUIRED_COMMERCE_ADMISSION = Object.freeze({
  commerceAdmitted: false,
  affiliateRailAvailable: false,
  publicationAuthorityAvailable: false,
  reviewedCatalogAvailable: false,
  reviewedStacksAvailable: false,
  partnerPollingAllowed: false,
  consentGrantAllowed: false,
  catalogReadsAllowed: false,
  clickRecordingAllowed: false,
  externalNavigationAllowed: false,
  analyticsAllowed: false,
  disabledPathSideEffectsAllowed: false,
});

const REQUIRED_SAFETY_FALSE = Object.freeze([
  'diagnosisTreatmentCurePreventionClaims',
  'aiSkinScores',
  'skinAgeClaims',
  'percentageImprovementClaims',
  'commissionInfluencedRecommendationRanking',
  'unconsentedCloudPhotoAnalysis',
  'publicBeforeAfterGallery',
  'weakenOwnerScopedRls',
]);

function sameMembers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((entry) => actual.includes(entry))
  );
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateLaunchContract(contract) {
  const errors = [];

  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return ['Launch contract must be a JSON object.'];
  }

  if (contract.schemaVersion !== LAUNCH_CONTRACT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${LAUNCH_CONTRACT_SCHEMA_VERSION}.`);
  }
  if (!nonEmptyString(contract.programId)) errors.push('programId is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(contract.effectiveDate ?? ''))) {
    errors.push('effectiveDate must use YYYY-MM-DD.');
  }
  if (contract.status !== 'active') errors.push('status must be active.');

  const release = contract.release ?? {};
  if (!sameMembers(release.platforms, ['ios'])) {
    errors.push('release.platforms must contain only ios.');
  }
  if (release.mode !== 'all-features') errors.push('release.mode must be all-features.');
  if (release.androidRelease !== false) errors.push('release.androidRelease must be false.');
  if (release.minimumIosVersion !== '17.0') {
    errors.push(
      'release.minimumIosVersion must be 17.0 unless an accepted policy patch changes it.',
    );
  }
  if (release.supportsIpad !== false) errors.push('release.supportsIpad must be false.');

  const features = Array.isArray(contract.requiredFeatures) ? contract.requiredFeatures : [];
  const featureIds = features.map((feature) => feature?.id);
  if (!sameMembers(featureIds, REQUIRED_FEATURE_IDS)) {
    errors.push('requiredFeatures must contain each feature ID 1-20 exactly once.');
  }
  if (new Set(featureIds).size !== featureIds.length) {
    errors.push('requiredFeatures contains duplicate IDs.');
  }
  const featureKeys = features.map((feature) => feature?.key);
  if (featureKeys.some((key) => !/^[a-z0-9_]+$/.test(String(key ?? '')))) {
    errors.push('Every required feature must have a stable snake_case key.');
  }
  if (new Set(featureKeys).size !== featureKeys.length) {
    errors.push('requiredFeatures contains duplicate keys.');
  }
  if (features.some((feature) => !nonEmptyString(feature?.name))) {
    errors.push('Every required feature must have a name.');
  }

  if (!sameMembers(contract.requiredSurfaces, REQUIRED_SURFACE_KEYS)) {
    errors.push('requiredSurfaces must contain every Phase 7/8 launch surface exactly once.');
  }
  if (new Set(contract.requiredSurfaces ?? []).size !== (contract.requiredSurfaces ?? []).length) {
    errors.push('requiredSurfaces contains duplicate keys.');
  }
  if (!sameMembers(contract.evidenceLevels, REQUIRED_EVIDENCE_LEVELS)) {
    errors.push('evidenceLevels must contain all seven evidence-maturity levels.');
  }

  const featureReviewRequirements = contract.featureProfessionalReviewRequirements;
  if (
    !featureReviewRequirements ||
    typeof featureReviewRequirements !== 'object' ||
    Array.isArray(featureReviewRequirements) ||
    !sameMembers(Object.keys(featureReviewRequirements), PROFESSIONAL_REVIEW_FEATURE_KEYS)
  ) {
    errors.push(
      'featureProfessionalReviewRequirements must cover routine_builder, cycle_scheduler, recommendations, and conflict_share exactly.',
    );
  } else {
    for (const featureKey of CORE_PROFESSIONAL_REVIEW_FEATURE_KEYS) {
      const requirements = featureReviewRequirements[featureKey];
      const roles = Array.isArray(requirements)
        ? requirements.map((requirement) => requirement?.reviewerRole)
        : [];
      if (!sameMembers(roles, Object.keys(REQUIRED_CORE_PROFESSIONAL_REVIEWS))) {
        errors.push(
          `featureProfessionalReviewRequirements.${featureKey} must require the exact three reviewer roles.`,
        );
        continue;
      }
      for (const requirement of requirements) {
        const expected = REQUIRED_CORE_PROFESSIONAL_REVIEWS[requirement.reviewerRole];
        if (
          !expected ||
          requirement.taskId !== expected.taskId ||
          requirement.scope !== expected.scope
        ) {
          errors.push(
            `featureProfessionalReviewRequirements.${featureKey}.${requirement.reviewerRole} must bind the exact task and scope.`,
          );
        }
      }
    }
    const conflictShareRequirements = featureReviewRequirements.conflict_share;
    const conflictShareRoles = Array.isArray(conflictShareRequirements)
      ? conflictShareRequirements.map((requirement) => requirement?.reviewerRole)
      : [];
    if (!sameMembers(conflictShareRoles, Object.keys(REQUIRED_CONFLICT_SHARE_REVIEWS))) {
      errors.push(
        'featureProfessionalReviewRequirements.conflict_share must require the exact six release-review roles.',
      );
    } else {
      for (const requirement of conflictShareRequirements) {
        const expected = REQUIRED_CONFLICT_SHARE_REVIEWS[requirement.reviewerRole];
        if (
          !expected ||
          requirement.taskId !== expected.taskId ||
          requirement.scope !== expected.scope
        ) {
          errors.push(
            `featureProfessionalReviewRequirements.conflict_share.${requirement.reviewerRole} must bind the exact task and scope.`,
          );
        }
      }
    }
  }

  for (const [key, expected] of Object.entries(REQUIRED_CONFLICT_SHARE_ADMISSION)) {
    if (contract.conflictShareAdmission?.[key] !== expected) {
      errors.push(`conflictShareAdmission.${key} must be ${expected}.`);
    }
  }
  if (
    Object.keys(contract.conflictShareAdmission ?? {}).length !==
      Object.keys(REQUIRED_CONFLICT_SHARE_ADMISSION).length ||
    Object.keys(contract.conflictShareAdmission ?? {}).some(
      (key) => !(key in REQUIRED_CONFLICT_SHARE_ADMISSION),
    )
  ) {
    errors.push('conflictShareAdmission must contain only the exact CORE-07A admission keys.');
  }

  for (const [key, expected] of Object.entries(REQUIRED_TREND_INSIGHT_ADMISSION)) {
    if (contract.trendInsightAdmission?.[key] !== expected) {
      errors.push(`trendInsightAdmission.${key} must be ${expected}.`);
    }
  }
  if (
    Object.keys(contract.trendInsightAdmission ?? {}).length !==
      Object.keys(REQUIRED_TREND_INSIGHT_ADMISSION).length ||
    Object.keys(contract.trendInsightAdmission ?? {}).some(
      (key) => !(key in REQUIRED_TREND_INSIGHT_ADMISSION),
    )
  ) {
    errors.push('trendInsightAdmission must contain only the exact PHOTO-05A admission keys.');
  }

  for (const [key, expected] of Object.entries(REQUIRED_COMMERCE_ADMISSION)) {
    if (contract.commerceAdmission?.[key] !== expected) {
      errors.push(`commerceAdmission.${key} must be ${expected}.`);
    }
  }
  if (
    Object.keys(contract.commerceAdmission ?? {}).length !==
      Object.keys(REQUIRED_COMMERCE_ADMISSION).length ||
    Object.keys(contract.commerceAdmission ?? {}).some(
      (key) => !(key in REQUIRED_COMMERCE_ADMISSION),
    )
  ) {
    errors.push('commerceAdmission must contain only the exact COM-01A admission keys.');
  }

  for (const key of REQUIRED_SAFETY_FALSE) {
    if (contract.safetyConstraints?.[key] !== false) {
      errors.push(`safetyConstraints.${key} must be false.`);
    }
  }
  if (contract.safetyConstraints?.photosLocalOnlyByDefault !== true) {
    errors.push('safetyConstraints.photosLocalOnlyByDefault must be true.');
  }

  return errors;
}

export function loadLaunchContract(root = process.cwd(), path = LAUNCH_CONTRACT_PATH) {
  const contract = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const errors = validateLaunchContract(contract);
  if (errors.length > 0) {
    throw new Error(`Invalid launch contract ${path}:\n- ${errors.join('\n- ')}`);
  }
  contract.trendInsightAdmission = Object.freeze({ ...contract.trendInsightAdmission });
  contract.commerceAdmission = Object.freeze({ ...contract.commerceAdmission });
  return Object.freeze(contract);
}

export function requiredReleasePlatforms(contract = loadLaunchContract()) {
  return Object.freeze([...contract.release.platforms]);
}

export function isReleasePlatformRequired(platform, contract = loadLaunchContract()) {
  return contract.release.platforms.includes(platform);
}

export function platformRequirementStatus(platform, contract = loadLaunchContract()) {
  return isReleasePlatformRequired(platform, contract) ? 'required' : NOT_APPLICABLE;
}

export function platformEvidenceStatus(platform, passed, contract = loadLaunchContract()) {
  if (!isReleasePlatformRequired(platform, contract)) return NOT_APPLICABLE;
  return passed === true ? 'pass' : 'blocked';
}

export function launchContractSnapshot(contract = loadLaunchContract()) {
  const featureProfessionalReviewRequirements = Object.freeze(
    Object.fromEntries(
      PROFESSIONAL_REVIEW_FEATURE_KEYS.map((featureKey) => [
        featureKey,
        Object.freeze(
          contract.featureProfessionalReviewRequirements[featureKey].map((requirement) =>
            Object.freeze({ ...requirement }),
          ),
        ),
      ]),
    ),
  );
  return Object.freeze({
    schemaVersion: contract.schemaVersion,
    programId: contract.programId,
    effectiveDate: contract.effectiveDate,
    releaseMode: contract.release.mode,
    platforms: Object.freeze([...contract.release.platforms]),
    androidRelease: contract.release.androidRelease,
    minimumIosVersion: contract.release.minimumIosVersion,
    supportsIpad: contract.release.supportsIpad,
    requiredFeatureIds: Object.freeze(contract.requiredFeatures.map((feature) => feature.id)),
    requiredFeatureKeys: Object.freeze(contract.requiredFeatures.map((feature) => feature.key)),
    requiredSurfaces: Object.freeze([...contract.requiredSurfaces]),
    featureProfessionalReviewRequirements,
    conflictShareAdmission: Object.freeze({ ...contract.conflictShareAdmission }),
    trendInsightAdmission: Object.freeze({ ...contract.trendInsightAdmission }),
    commerceAdmission: Object.freeze({ ...contract.commerceAdmission }),
  });
}

export function isFeatureRequired(featureIdOrKey, contract = loadLaunchContract()) {
  return contract.requiredFeatures.some(
    (feature) => feature.id === featureIdOrKey || feature.key === featureIdOrKey,
  );
}

export function isSurfaceRequired(surfaceKey, contract = loadLaunchContract()) {
  return contract.requiredSurfaces.includes(surfaceKey);
}
