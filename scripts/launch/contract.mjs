import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LAUNCH_CONTRACT_PATH = 'docs/hugeToDo/launch-contract.json';
export const LAUNCH_CONTRACT_SCHEMA_VERSION = 1;
export const NOT_APPLICABLE = 'not_applicable';
export const REQUIRED_FEATURE_IDS = Object.freeze([1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
export const DEFERRED_FEATURE_IDS = Object.freeze([4, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
export const REQUIRED_SURFACE_KEYS = Object.freeze([]);

const REQUIRED_EVIDENCE_LEVELS = Object.freeze([
  'code_complete',
  'locally_verified',
  'live_staging_verified',
  'physical_iphone_verified',
  'external_professional_review_signed',
  'production_verified',
  'store_approved',
]);

const REQUIRED_GUIDANCE_REVIEWS = Object.freeze({
  conflict_engine: Object.freeze({
    board_certified_dermatologist: Object.freeze({
      taskId: 'H-03',
      scope: 'exact_conflict_clinical_meaning_eligibility_and_user_copy',
    }),
    cosmetic_chemist: Object.freeze({
      taskId: 'H-03',
      scope: 'exact_ingredient_compatibility_and_application_copy',
    }),
    regulatory_counsel: Object.freeze({
      taskId: 'H-03',
      scope: 'claims_jurisdiction_and_market_clearance',
    }),
  }),
  routine_builder: Object.freeze({
    board_certified_dermatologist: Object.freeze({
      taskId: 'H-03',
      scope: 'clinical_order_eligibility_and_user_copy',
    }),
    cosmetic_chemist: Object.freeze({
      taskId: 'H-03',
      scope: 'formulation_order_and_application_copy',
    }),
    regulatory_counsel: Object.freeze({
      taskId: 'H-03',
      scope: 'claims_jurisdiction_and_market_clearance',
    }),
  }),
  cycle_scheduler: Object.freeze({
    board_certified_dermatologist: Object.freeze({
      taskId: 'H-03',
      scope: 'cadence_recovery_eligibility_and_user_copy',
    }),
    cosmetic_chemist: Object.freeze({
      taskId: 'H-03',
      scope: 'cadence_interaction_and_application_copy',
    }),
    regulatory_counsel: Object.freeze({
      taskId: 'H-03',
      scope: 'claims_jurisdiction_and_market_clearance',
    }),
  }),
});

const REQUIRED_REVIEW_FEATURE_KEYS = Object.freeze(Object.keys(REQUIRED_GUIDANCE_REVIEWS));

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

export const REQUIRED_IOS_WIN_BACK_OFFER_ADMISSION = Object.freeze({
  schemaVersion: 1,
  winBackOfferAdmitted: false,
  automaticInAppMessagesAllowed: false,
  winBackInAppMessageAllowed: false,
  disabledWinBackProviderCallsAllowed: false,
  eligibilityDerivedOfferRequired: true,
  localizedStorePricingRequired: true,
  hardcodedDiscountAllowed: false,
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

function validateExactBooleanObject(errors, label, actual, expected) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual?.[key] !== expectedValue) errors.push(`${label}.${key} must be ${expectedValue}.`);
  }
  const keys = Object.keys(actual ?? {});
  if (keys.length !== Object.keys(expected).length || keys.some((key) => !(key in expected))) {
    errors.push(`${label} must contain only the exact governed admission keys.`);
  }
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
  if (!sameMembers(release.platforms, ['ios']))
    errors.push('release.platforms must contain only ios.');
  if (release.mode !== 'lean-v1') errors.push('release.mode must be lean-v1.');
  if (release.androidRelease !== false) errors.push('release.androidRelease must be false.');
  if (release.minimumIosVersion !== '17.0') errors.push('release.minimumIosVersion must be 17.0.');
  if (release.supportsIpad !== false) errors.push('release.supportsIpad must be false.');

  const features = Array.isArray(contract.requiredFeatures) ? contract.requiredFeatures : [];
  const featureIds = features.map((feature) => feature?.id);
  if (!sameMembers(featureIds, REQUIRED_FEATURE_IDS)) {
    errors.push(
      `requiredFeatures must contain lean V1 feature IDs ${REQUIRED_FEATURE_IDS.join(', ')} exactly once.`,
    );
  }
  if (new Set(featureIds).size !== featureIds.length)
    errors.push('requiredFeatures contains duplicate IDs.');
  const featureKeys = features.map((feature) => feature?.key);
  if (featureKeys.some((key) => !/^[a-z0-9_]+$/.test(String(key ?? '')))) {
    errors.push('Every required feature must have a stable snake_case key.');
  }
  if (new Set(featureKeys).size !== featureKeys.length)
    errors.push('requiredFeatures contains duplicate keys.');
  if (features.some((feature) => !nonEmptyString(feature?.name)))
    errors.push('Every required feature must have a name.');

  const deferredIds = Array.isArray(contract.deferredFeatures)
    ? contract.deferredFeatures.map((feature) => feature?.id)
    : [];
  if (!sameMembers(deferredIds, DEFERRED_FEATURE_IDS)) {
    errors.push(`deferredFeatures must contain ${DEFERRED_FEATURE_IDS.join(', ')} exactly once.`);
  }
  const partition = [...featureIds, ...deferredIds].sort((a, b) => a - b);
  if (
    !sameMembers(
      partition,
      Array.from({ length: 20 }, (_, index) => index + 1),
    )
  ) {
    errors.push('requiredFeatures and deferredFeatures must partition feature IDs 1-20.');
  }

  if (!sameMembers(contract.requiredSurfaces, REQUIRED_SURFACE_KEYS)) {
    errors.push('requiredSurfaces must be empty for lean V1.');
  }
  if (!sameMembers(contract.evidenceLevels, REQUIRED_EVIDENCE_LEVELS)) {
    errors.push('evidenceLevels must contain all seven evidence-maturity levels.');
  }

  const reviewRequirements = contract.featureProfessionalReviewRequirements;
  if (
    !reviewRequirements ||
    typeof reviewRequirements !== 'object' ||
    Array.isArray(reviewRequirements) ||
    !sameMembers(Object.keys(reviewRequirements), REQUIRED_REVIEW_FEATURE_KEYS)
  ) {
    errors.push(
      'featureProfessionalReviewRequirements must cover conflict_engine, routine_builder, and cycle_scheduler exactly.',
    );
  } else {
    for (const featureKey of REQUIRED_REVIEW_FEATURE_KEYS) {
      const requirements = reviewRequirements[featureKey];
      const expected = REQUIRED_GUIDANCE_REVIEWS[featureKey];
      const roles = Array.isArray(requirements)
        ? requirements.map((item) => item?.reviewerRole)
        : [];
      if (!sameMembers(roles, Object.keys(expected))) {
        errors.push(
          `featureProfessionalReviewRequirements.${featureKey} must require dermatologist, cosmetic_chemist, and regulatory_counsel exactly.`,
        );
        continue;
      }
      for (const requirement of requirements) {
        const expectedRequirement = expected[requirement.reviewerRole];
        if (
          !expectedRequirement ||
          requirement.taskId !== expectedRequirement.taskId ||
          requirement.scope !== expectedRequirement.scope
        ) {
          errors.push(
            `featureProfessionalReviewRequirements.${featureKey}.${requirement.reviewerRole} must bind the exact H-03 task and scope.`,
          );
        }
      }
    }
  }

  validateExactBooleanObject(
    errors,
    'conflictShareAdmission',
    contract.conflictShareAdmission,
    REQUIRED_CONFLICT_SHARE_ADMISSION,
  );
  validateExactBooleanObject(
    errors,
    'trendInsightAdmission',
    contract.trendInsightAdmission,
    REQUIRED_TREND_INSIGHT_ADMISSION,
  );
  validateExactBooleanObject(
    errors,
    'commerceAdmission',
    contract.commerceAdmission,
    REQUIRED_COMMERCE_ADMISSION,
  );
  validateExactBooleanObject(
    errors,
    'iosWinBackOfferAdmission',
    contract.iosWinBackOfferAdmission,
    REQUIRED_IOS_WIN_BACK_OFFER_ADMISSION,
  );

  for (const key of REQUIRED_SAFETY_FALSE) {
    if (contract.safetyConstraints?.[key] !== false)
      errors.push(`safetyConstraints.${key} must be false.`);
  }
  if (contract.safetyConstraints?.photosLocalOnlyByDefault !== true) {
    errors.push('safetyConstraints.photosLocalOnlyByDefault must be true.');
  }
  return errors;
}

export function loadLaunchContract(root = process.cwd(), path = LAUNCH_CONTRACT_PATH) {
  const contract = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const errors = validateLaunchContract(contract);
  if (errors.length > 0)
    throw new Error(`Invalid launch contract ${path}:\n- ${errors.join('\n- ')}`);
  contract.conflictShareAdmission = Object.freeze({ ...contract.conflictShareAdmission });
  contract.trendInsightAdmission = Object.freeze({ ...contract.trendInsightAdmission });
  contract.commerceAdmission = Object.freeze({ ...contract.commerceAdmission });
  contract.iosWinBackOfferAdmission = Object.freeze({ ...contract.iosWinBackOfferAdmission });
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
      REQUIRED_REVIEW_FEATURE_KEYS.map((featureKey) => [
        featureKey,
        Object.freeze(
          contract.featureProfessionalReviewRequirements[featureKey].map((item) =>
            Object.freeze({ ...item }),
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
    deferredFeatureIds: Object.freeze(contract.deferredFeatures.map((feature) => feature.id)),
    requiredSurfaces: Object.freeze([...contract.requiredSurfaces]),
    featureProfessionalReviewRequirements,
    conflictShareAdmission: Object.freeze({ ...contract.conflictShareAdmission }),
    trendInsightAdmission: Object.freeze({ ...contract.trendInsightAdmission }),
    commerceAdmission: Object.freeze({ ...contract.commerceAdmission }),
    iosWinBackOfferAdmission: Object.freeze({ ...contract.iosWinBackOfferAdmission }),
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
