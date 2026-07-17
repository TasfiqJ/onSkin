#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  exerciseIncident,
  readExerciseInputs,
  validateDashboardContract,
} from './maintenance-incident-exercise.mjs';

const { contract, scenario } = readExerciseInputs();
const index = validateDashboardContract(contract);
assert.equal(index.dashboardIds.size, 5);
assert.equal(index.metricIds.size, 15);
console.log('OK five content-free dashboard domains and 15 unthresholded metrics');

const nativeResult = exerciseIncident(contract, scenario);
assert.equal(nativeResult.status, 'pass');
assert.equal(nativeResult.decision.freezeRollout, true);
assert.equal(nativeResult.decision.otaAllowed, false);
assert.equal(nativeResult.decision.rollbackPath, 'binary_halt_hotfix');
assert.equal(nativeResult.checks.liveRecoverySignalAvailable, false);
console.log(
  'OK native/runtime-incompatible incident rejects OTA and retains live recovery blocker',
);

const jsScenario = structuredClone(scenario);
jsScenario.incidentId = 'OPT212-DRILL-002';
jsScenario.issueClass = 'js_bug';
jsScenario.currentArtifact.changeClass = 'js';
jsScenario.rollbackTarget.runtimeFingerprint = jsScenario.currentArtifact.runtimeFingerprint;
jsScenario.expectedDecision.otaAllowed = false;
jsScenario.expectedDecision.rollbackPath = 'binary_halt_hotfix';
const jsResult = exerciseIncident(contract, jsScenario);
assert.equal(jsResult.decision.otaAllowed, false);
assert.equal(jsResult.decision.rollbackPath, 'binary_halt_hotfix');
assert.equal(jsResult.checks.storeOnlyPolicyEnforced, true);
console.log('OK store-only policy keeps same-runtime JS incident on binary hotfix path');

const privacyScenario = structuredClone(scenario);
privacyScenario.incidentId = 'OPT212-DRILL-003';
privacyScenario.issueClass = 'privacy_failure';
privacyScenario.dashboardId = 'data_rights';
privacyScenario.signals = [
  {
    metricId: 'deletion_oldest_pending_minutes',
    state: 'critical',
    sampleCount: 1,
  },
];
privacyScenario.expectedDecision.rollbackPath = 'privacy_containment_and_review';
const privacyResult = exerciseIncident(contract, privacyScenario);
assert.equal(privacyResult.decision.otaAllowed, false);
assert.equal(privacyResult.decision.rollbackPath, 'privacy_containment_and_review');
console.log('OK privacy incident selects containment and review instead of a client rollback');

const unsafeScenario = structuredClone(scenario);
unsafeScenario.email = 'synthetic@example.invalid';
assert.throws(() => exerciseIncident(contract, unsafeScenario), /forbidden field/);
console.log('OK content-bearing incident fields fail closed');

const updateEnabledContract = structuredClone(contract);
updateEnabledContract.releasePolicy.easUpdateEnabled = true;
assert.throws(
  () => validateDashboardContract(updateEnabledContract),
  /accepted store-only policy/,
);
console.log('OK maintenance contract rejects unreviewed EAS Update enablement');
