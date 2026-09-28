#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFERRED_FEATURE_IDS,
  REQUIRED_FEATURE_IDS,
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
const iosWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/ios-launch-contract.yml'),
  'utf8',
);
assert.ok(iosWorkflow.includes('npm run launch:contract:verify'));

assert.deepEqual(contract.release.platforms, ['ios']);
assert.equal(contract.release.mode, 'lean-v1');
assert.equal(isReleasePlatformRequired('ios', contract), true);
assert.equal(isReleasePlatformRequired('android', contract), false);
assert.equal(platformRequirementStatus('ios', contract), 'required');
assert.equal(platformRequirementStatus('android', contract), 'not_applicable');
assert.equal(platformEvidenceStatus('ios', false, contract), 'blocked');
assert.equal(platformEvidenceStatus('ios', true, contract), 'pass');
assert.equal(platformEvidenceStatus('android', false, contract), 'not_applicable');

assert.deepEqual(launchContractSnapshot(contract).requiredFeatureIds, REQUIRED_FEATURE_IDS);
assert.deepEqual(launchContractSnapshot(contract).deferredFeatureIds, DEFERRED_FEATURE_IDS);
assert.deepEqual(contract.requiredSurfaces, []);
for (const id of REQUIRED_FEATURE_IDS) assert.equal(isFeatureRequired(id, contract), true);
for (const id of DEFERRED_FEATURE_IDS) assert.equal(isFeatureRequired(id, contract), false);
for (const surface of [
  'cloud_ask',
  'commerce',
  'community_posting',
  'trend_insights',
  'widgets',
  'share_cards',
  'public_links',
  'review_prompts',
  'creator_links',
  'paid_measurement',
]) {
  assert.equal(isSurfaceRequired(surface, contract), false);
}

assert.equal(contract.conflictShareAdmission.sharePublicationAdmitted, false);
assert.equal(contract.trendInsightAdmission.trendInsightAdmitted, false);
assert.equal(contract.commerceAdmission.commerceAdmitted, false);
assert.equal(contract.iosWinBackOfferAdmission.winBackOfferAdmitted, false);
assert.deepEqual(Object.keys(contract.featureProfessionalReviewRequirements).sort(), [
  'conflict_engine',
  'conflict_share',
  'cycle_scheduler',
  'recommendations',
  'routine_builder',
]);
for (const key of ['conflict_engine', 'routine_builder', 'cycle_scheduler']) {
  const requirements = contract.featureProfessionalReviewRequirements[key];
  assert.deepEqual(
    requirements.map((item) => item.taskId),
    ['H-03', 'H-03', 'H-03'],
  );
}

const allFeatures = structuredClone(contract);
allFeatures.release.mode = 'all-features';
assert.match(validateLaunchContract(allFeatures).join('\n'), /lean-v1/);
const forgedDeferred = structuredClone(contract);
forgedDeferred.requiredFeatures.push({ id: 14, key: 'ask_advisor', name: 'Ask' });
assert.match(validateLaunchContract(forgedDeferred).join('\n'), /requiredFeatures/);
const forgedSurface = structuredClone(contract);
forgedSurface.requiredSurfaces = ['cloud_ask'];
assert.match(validateLaunchContract(forgedSurface).join('\n'), /requiredSurfaces must be empty/);
const weakenedSafety = structuredClone(contract);
weakenedSafety.safetyConstraints.aiSkinScores = true;
assert.match(validateLaunchContract(weakenedSafety).join('\n'), /aiSkinScores must be false/);
const forgedCommerce = structuredClone(contract);
forgedCommerce.commerceAdmission.commerceAdmitted = true;
assert.match(
  validateLaunchContract(forgedCommerce).join('\n'),
  /commerceAdmission\.commerceAdmitted must be false/,
);
const forgedTrend = structuredClone(contract);
forgedTrend.trendInsightAdmission.trendInsightAdmitted = true;
assert.match(
  validateLaunchContract(forgedTrend).join('\n'),
  /trendInsightAdmission\.trendInsightAdmitted must be false/,
);
const forgedShare = structuredClone(contract);
forgedShare.conflictShareAdmission.sharePublicationAdmitted = true;
assert.match(
  validateLaunchContract(forgedShare).join('\n'),
  /conflictShareAdmission\.sharePublicationAdmitted must be false/,
);
const forgedWinBack = structuredClone(contract);
forgedWinBack.iosWinBackOfferAdmission.winBackOfferAdmitted = true;
assert.match(
  validateLaunchContract(forgedWinBack).join('\n'),
  /iosWinBackOfferAdmission\.winBackOfferAdmitted must be false/,
);

console.log('Lean V1 launch contract smoke tests passed.');

// Deferral never erases the professional review boundary for a future successor.
for (const key of ['recommendations', 'conflict_share']) {
  const weakened = structuredClone(contract);
  weakened.featureProfessionalReviewRequirements[key].pop();
  assert.match(validateLaunchContract(weakened).join('\n'), /exact reviewer roles/);
}
