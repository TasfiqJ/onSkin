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

console.log('Launch contract smoke tests passed.');
