#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  auditSecureStartup,
  readSecureStartupInputs,
} from './secure-startup-audit.mjs';

const inputs = readSecureStartupInputs();
const result = auditSecureStartup(inputs);
assert.equal(result.status, 'pass');
assert.equal(result.startupPhasesAudited, 13);
assert.equal(result.scenariosAudited, 11);
assert.equal(result.localDiagnosticsSchemaVersion, 2);
assert.equal(result.authorizationGateChanges, 0);
console.log('OK secure startup order and 13 fixed content-free milestones pass');

const escapedNavigation = structuredClone(inputs);
escapedNavigation.rootLayout = escapedNavigation.rootLayout.replace(
  '<StartupNavigationObserver />',
  '',
);
assert.throws(() => auditSecureStartup(escapedNavigation), /missing a required startup gate/);
console.log('OK navigation escaping the secure gates fails closed');

const lateVaultMarker = structuredClone(inputs);
lateVaultMarker.privateDataGate = lateVaultMarker.privateDataGate.replace(
  "markStartupPhase('vault_decision_complete')",
  '',
);
assert.throws(() => auditSecureStartup(lateVaultMarker), /before their children/);
console.log('OK late secure-gate instrumentation fails closed');

const dynamicMarker = structuredClone(inputs);
dynamicMarker.runtimeSources['apps/mobile/src/components/ui/Screen.tsx'] =
  dynamicMarker.runtimeSources['apps/mobile/src/components/ui/Screen.tsx'].replace(
    "markStartupPhase('first_meaningful_content')",
    'markStartupPhase(children)',
  );
assert.throws(() => auditSecureStartup(dynamicMarker), /must use one fixed literal/);
console.log('OK dynamic startup marker content fails closed');

const missingScenario = structuredClone(inputs);
missingScenario.truthTable = missingScenario.truthTable.replace('| Account A to B |', '| Removed |');
assert.throws(() => auditSecureStartup(missingScenario), /Missing startup scenario/);
console.log('OK incomplete startup truth table fails closed');

const relaxedGate = structuredClone(inputs);
relaxedGate.truthTable = relaxedGate.truthTable.replace(
  'no authorization gate is relaxed or reordered',
  'authorization may change',
);
assert.throws(() => auditSecureStartup(relaxedGate), /no-relaxation/);
console.log('OK authorization-gate relaxation fails closed');
