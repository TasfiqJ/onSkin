#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  isFeatureRequired,
  isReleasePlatformRequired,
  isSurfaceRequired,
  launchContractSnapshot,
  loadLaunchContract,
  platformEvidenceStatus,
  platformRequirementStatus,
  validateLaunchContract,
} from './contract.mjs';

const contract = loadLaunchContract();

assert.deepEqual(contract.release.platforms, ['ios']);
assert.equal(isReleasePlatformRequired('ios', contract), true);
assert.equal(isReleasePlatformRequired('android', contract), false);
assert.equal(platformRequirementStatus('ios', contract), 'required');
assert.equal(platformRequirementStatus('android', contract), 'not_applicable');
assert.equal(platformEvidenceStatus('ios', false, contract), 'blocked');
assert.equal(platformEvidenceStatus('ios', true, contract), 'pass');
assert.equal(platformEvidenceStatus('android', false, contract), 'not_applicable');
assert.equal(platformEvidenceStatus('android', true, contract), 'not_applicable');
assert.equal(isFeatureRequired(1, contract), true);
assert.equal(isFeatureRequired(20, contract), true);
assert.equal(isFeatureRequired('widgets_live_activities', contract), true);
assert.equal(isSurfaceRequired('cloud_ask', contract), true);
assert.equal(isSurfaceRequired('paid_measurement', contract), true);
assert.equal(contract.conflictShareAdmission.sharePublicationAdmitted, false);
assert.equal(contract.conflictShareAdmission.publicLinksAdmitted, false);
assert.equal(contract.conflictShareAdmission.shareReceiptIssuerAvailable, false);
assert.equal(contract.conflictShareAdmission.publicTokenServiceAvailable, false);
assert.equal(contract.conflictShareAdmission.sanitizedProjectionAllowlistRequired, true);
assert.equal(contract.conflictShareAdmission.exactPayloadConfirmationRequired, true);
assert.equal(contract.conflictShareAdmission.rawPrivateFieldsAllowed, false);
assert.equal(contract.conflictShareAdmission.analyticsAllowed, false);
assert.deepEqual(contract.trendInsightAdmission, {
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
assert.equal(Object.isFrozen(contract.trendInsightAdmission), true);
assert.deepEqual(
  launchContractSnapshot(contract).trendInsightAdmission,
  contract.trendInsightAdmission,
);
assert.deepEqual(contract.commerceAdmission, {
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
assert.equal(Object.isFrozen(contract.commerceAdmission), true);
assert.deepEqual(
  launchContractSnapshot(contract).commerceAdmission,
  contract.commerceAdmission,
);
assert.deepEqual(
  contract.featureProfessionalReviewRequirements.conflict_share.map(
    ({ reviewerRole, taskId }) => `${reviewerRole}:${taskId}`,
  ),
  [
    'regulatory_claims_counsel:REV-02',
    'privacy_security_reviewer:REV-03',
    'board_certified_dermatologist:REV-04',
    'cosmetic_chemist:REV-05',
    'ip_content_rights_counsel:REV-06',
    'release_signoff_operator:REV-07',
  ],
);
assert.deepEqual(
  launchContractSnapshot(contract).featureProfessionalReviewRequirements.conflict_share,
  contract.featureProfessionalReviewRequirements.conflict_share,
);
assert.deepEqual(
  launchContractSnapshot(contract).requiredFeatureIds,
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
);
assert.equal(launchContractSnapshot(contract).requiredSurfaces.length, 14);

const missingFeature = structuredClone(contract);
missingFeature.requiredFeatures = missingFeature.requiredFeatures.slice(0, 19);
assert.match(validateLaunchContract(missingFeature).join('\n'), /feature ID 1-20/);

const androidRelease = structuredClone(contract);
androidRelease.release.platforms = ['ios', 'android'];
androidRelease.release.androidRelease = true;
assert.match(validateLaunchContract(androidRelease).join('\n'), /only ios/);
assert.match(validateLaunchContract(androidRelease).join('\n'), /androidRelease must be false/);

const weakenedSafety = structuredClone(contract);
weakenedSafety.safetyConstraints.aiSkinScores = true;
assert.match(validateLaunchContract(weakenedSafety).join('\n'), /aiSkinScores must be false/);

const missingRoutineReviewer = structuredClone(contract);
missingRoutineReviewer.featureProfessionalReviewRequirements.routine_builder =
  missingRoutineReviewer.featureProfessionalReviewRequirements.routine_builder.slice(0, 2);
assert.match(
  validateLaunchContract(missingRoutineReviewer).join('\n'),
  /routine_builder must require the exact three reviewer roles/,
);

const weakenedSchedulerReviewer = structuredClone(contract);
weakenedSchedulerReviewer.featureProfessionalReviewRequirements.cycle_scheduler[2].taskId =
  'REV-05';
assert.match(
  validateLaunchContract(weakenedSchedulerReviewer).join('\n'),
  /cycle_scheduler.regulatory_counsel must bind the exact task and scope/,
);

const missingRecommendationReviewer = structuredClone(contract);
missingRecommendationReviewer.featureProfessionalReviewRequirements.recommendations =
  missingRecommendationReviewer.featureProfessionalReviewRequirements.recommendations.slice(0, 2);
assert.match(
  validateLaunchContract(missingRecommendationReviewer).join('\n'),
  /recommendations must require the exact three reviewer roles/,
);

const missingConflictShareReviewer = structuredClone(contract);
missingConflictShareReviewer.featureProfessionalReviewRequirements.conflict_share =
  missingConflictShareReviewer.featureProfessionalReviewRequirements.conflict_share.slice(0, 5);
assert.match(
  validateLaunchContract(missingConflictShareReviewer).join('\n'),
  /conflict_share must require the exact six release-review roles/,
);

const weakenedConflictShareReviewer = structuredClone(contract);
weakenedConflictShareReviewer.featureProfessionalReviewRequirements.conflict_share[5].taskId =
  'REV-06';
assert.match(
  validateLaunchContract(weakenedConflictShareReviewer).join('\n'),
  /conflict_share.release_signoff_operator must bind the exact task and scope/,
);

const forgedShareAdmission = structuredClone(contract);
forgedShareAdmission.conflictShareAdmission.sharePublicationAdmitted = true;
assert.match(
  validateLaunchContract(forgedShareAdmission).join('\n'),
  /sharePublicationAdmitted must be false/,
);

const extraShareAdmissionKey = structuredClone(contract);
extraShareAdmissionKey.conflictShareAdmission.runtimeFlagOverride = true;
assert.match(
  validateLaunchContract(extraShareAdmissionKey).join('\n'),
  /only the exact CORE-07A admission keys/,
);

for (const key of Object.keys(contract.trendInsightAdmission)) {
  const forgedTrendAdmission = structuredClone(contract);
  forgedTrendAdmission.trendInsightAdmission[key] = true;
  assert.match(
    validateLaunchContract(forgedTrendAdmission).join('\n'),
    new RegExp(`trendInsightAdmission\\.${key} must be false`, 'u'),
  );
}

const missingTrendAdmissionKey = structuredClone(contract);
delete missingTrendAdmissionKey.trendInsightAdmission.resultIssuerAvailable;
assert.match(
  validateLaunchContract(missingTrendAdmissionKey).join('\n'),
  /resultIssuerAvailable must be false/,
);
assert.match(
  validateLaunchContract(missingTrendAdmissionKey).join('\n'),
  /only the exact PHOTO-05A admission keys/,
);

const extraTrendAdmissionKey = structuredClone(contract);
extraTrendAdmissionKey.trendInsightAdmission.fixtureOverride = true;
assert.match(
  validateLaunchContract(extraTrendAdmissionKey).join('\n'),
  /only the exact PHOTO-05A admission keys/,
);

for (const key of Object.keys(contract.commerceAdmission)) {
  const forgedCommerceAdmission = structuredClone(contract);
  forgedCommerceAdmission.commerceAdmission[key] = true;
  assert.match(
    validateLaunchContract(forgedCommerceAdmission).join('\n'),
    new RegExp(`commerceAdmission\\.${key} must be false`, 'u'),
  );
}

const missingCommerceAdmissionKey = structuredClone(contract);
delete missingCommerceAdmissionKey.commerceAdmission.affiliateRailAvailable;
assert.match(
  validateLaunchContract(missingCommerceAdmissionKey).join('\n'),
  /affiliateRailAvailable must be false/,
);
assert.match(
  validateLaunchContract(missingCommerceAdmissionKey).join('\n'),
  /only the exact COM-01A admission keys/,
);

const extraCommerceAdmissionKey = structuredClone(contract);
extraCommerceAdmissionKey.commerceAdmission.fixtureOverride = true;
assert.match(
  validateLaunchContract(extraCommerceAdmissionKey).join('\n'),
  /only the exact COM-01A admission keys/,
);

console.log('Launch contract smoke tests passed.');
