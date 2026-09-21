#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  auditStoreOnlyResolvedApp,
  auditStoreOnlyRelease,
  readStoreOnlyReleaseInputs,
} from './store-only-release-audit.mjs';

const inputs = readStoreOnlyReleaseInputs();
const result = auditStoreOnlyRelease(inputs);
assert.equal(result.status, 'pass');
assert.equal(result.clientDelivery, 'store-build-only');
assert.equal(result.easUpdateEnabled, false);
console.log('OK accepted store-only release policy passes');

auditStoreOnlyResolvedApp(inputs.app, 'development');
const resolvedOverride = structuredClone(inputs.app);
resolvedOverride.updates.enabled = true;
assert.throws(
  () => auditStoreOnlyResolvedApp(resolvedOverride, 'staging'),
  /Resolved staging config updates.enabled must be false/,
);
console.log('OK resolved variant OTA overrides fail closed');

const updateEnabled = structuredClone(inputs);
updateEnabled.app.updates.enabled = true;
assert.throws(() => auditStoreOnlyRelease(updateEnabled), /updates.enabled must be false/);
console.log('OK enabled Expo updates fail closed');

const updateCheck = structuredClone(inputs);
updateCheck.app.updates.checkAutomatically = 'ON_LOAD';
assert.throws(() => auditStoreOnlyRelease(updateCheck), /checkAutomatically must be NEVER/);
console.log('OK automatic update checks fail closed');

const updateUrl = structuredClone(inputs);
updateUrl.app.updates.url = 'https://u.expo.dev/synthetic';
assert.throws(() => auditStoreOnlyRelease(updateUrl), /omit updates.url/);
console.log('OK unexpected update URL fails closed');

const directDependency = structuredClone(inputs);
directDependency.mobilePackage.dependencies['expo-updates'] = '0.0.0-synthetic';
assert.throws(() => auditStoreOnlyRelease(directDependency), /must not directly depend/);
console.log('OK direct expo-updates dependency fails closed');

const channel = structuredClone(inputs);
channel.eas.build.production.channel = 'production';
assert.throws(() => auditStoreOnlyRelease(channel), /must omit channel/);
console.log('OK unexpected EAS channel fails closed');

const stagingChannel = structuredClone(inputs);
stagingChannel.eas.build.staging.channel = 'staging';
assert.throws(() => auditStoreOnlyRelease(stagingChannel), /must omit channel/);
console.log('OK unexpected staging EAS channel fails closed');

const maintenanceMismatch = structuredClone(inputs);
maintenanceMismatch.maintenanceContract.releasePolicy.easUpdateEnabled = true;
assert.throws(() => auditStoreOnlyRelease(maintenanceMismatch), /Maintenance contract/);
console.log('OK maintenance release-policy drift fails closed');
