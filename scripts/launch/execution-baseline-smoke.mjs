import assert from 'node:assert/strict';
import {
  buildFeatureInventory,
  exactSetProblems,
  gatedSurfaces,
  parsePlanRows,
} from './execution-baseline.mjs';

const planIds = parsePlanRows().map(({ id }) => id);
assert.equal(
  planIds.length,
  202,
  'the plan-derived count must include Codex, human, reviewer, Apple, and vendor items',
);
assert(
  exactSetProblems('plan', planIds, planIds.slice(1)).some((problem) =>
    problem.includes('missing'),
  ),
);
assert(
  exactSetProblems('plan', planIds, [...planIds, 'UNKNOWN-99']).some((problem) =>
    problem.includes('unknown'),
  ),
);
assert(
  exactSetProblems('plan', planIds, [...planIds, planIds[0]]).some((problem) =>
    problem.includes('duplicate'),
  ),
);

const inventory = buildFeatureInventory();
const featureKeys = inventory.features.map(({ key }) => key);
assert.equal(featureKeys.length, 20);
assert(exactSetProblems('features', featureKeys, featureKeys.slice(1)).length > 0);

const surfaceKeys = gatedSurfaces.flatMap(({ surfaceKeys: keys }) => keys);
assert.equal(surfaceKeys.length, 14);
assert(
  exactSetProblems(
    'surfaces',
    surfaceKeys,
    surfaceKeys.filter((key) => key !== 'live_activities'),
  ).length > 0,
);

for (const category of [
  'route',
  'feature-flag',
  'native-module',
  'data-store',
  'edge-function',
  'vendor-call',
  'generated-packet',
]) {
  assert(
    inventory.items.some((entry) => entry.category === category),
    `missing ${category}`,
  );
}

const appleSupportOrigin = inventory.items.find(
  (entry) => entry.id === 'vendor-call:origin:support.apple.com',
);
assert(appleSupportOrigin, 'missing the Apple account-support origin');
assert.deepEqual(
  appleSupportOrigin.featureIds,
  ['F-02'],
  'Apple account-support instructions must remain mapped to identity and consent',
);

const postHogDeletionOrigin = inventory.items.find(
  (entry) => entry.id === 'vendor-call:origin:eu.posthog.com',
);
assert(postHogDeletionOrigin, 'missing the environment-configured PostHog deletion origin');
assert.deepEqual(
  postHogDeletionOrigin.featureIds,
  ['F-20'],
  'PostHog deletion must remain mapped to admin and operator tooling',
);

assert(
  !inventory.items.some((entry) => entry.id === 'feature-flag:OBF_API_ENABLED'),
  'the retired live Open Beauty Facts API flag must not return to the launch inventory',
);
assert(
  !inventory.items.some((entry) => entry.id === 'vendor-call:origin:world.openbeautyfacts.org'),
  'offline Open Beauty Facts artifacts must not be classified as a live vendor call',
);

const deletionLifecycleTableFeatures = {
  account_deletion_operations: ['F-02', 'F-20'],
  account_deletion_barriers: ['F-02', 'F-20'],
  account_deletion_steps: ['F-02', 'F-20'],
  account_deletion_receipts: ['F-02', 'F-20'],
  account_deletion_operator_recovery_audit: ['F-02', 'F-20'],
  revenuecat_identity_tombstones: ['F-02', 'F-11', 'F-12'],
  account_publication_leases: ['F-02', 'F-11', 'F-12'],
};
for (const [table, expectedFeatureIds] of Object.entries(deletionLifecycleTableFeatures)) {
  const tableItem = inventory.items.find((entry) => entry.id === `data-store:postgres:${table}`);
  assert(tableItem, `missing deletion lifecycle table ${table}`);
  assert.deepEqual(
    tableItem.featureIds,
    expectedFeatureIds,
    `${table} must remain mapped to its account/privacy, payment, and/or operator launch features`,
  );
}

for (const id of [
  'data-store:postgres:health_processing_states',
  'data-store:postgres:health_consent_withdrawal_operations',
  'data-store:postgres:health_consent_withdrawal_steps',
  'data-store:local:apps/mobile/src/features/healthConsent/lifecycleStore.ts',
  'edge-function:health-consent-worker',
]) {
  const healthLifecycleItem = inventory.items.find((entry) => entry.id === id);
  assert(healthLifecycleItem, `missing health-consent lifecycle item ${id}`);
  assert.deepEqual(
    healthLifecycleItem.featureIds,
    ['F-02'],
    `${id} must map to onboarding, identity, and consent rather than skin cycling`,
  );
}

console.log(
  'Execution baseline smoke passed: omission, addition, duplicate, feature, and surface guards reject incomplete sets.',
);
