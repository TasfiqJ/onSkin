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

for (const [host, expectedFeatures] of [
  ['developer.apple.com', ['F-06', 'F-08']],
  ['www.fda.gov', ['F-06', 'F-08']],
  ['www.ftc.gov', ['F-06', 'F-08']],
  ['www.aad.org', ['F-06', 'F-08']],
]) {
  const sourceOrigin = inventory.items.find((entry) => entry.id === `vendor-call:origin:${host}`);
  assert(sourceOrigin, `missing the governed routine-guidance source origin ${host}`);
  assert.deepEqual(
    sourceOrigin.featureIds,
    expectedFeatures,
    `${host} must remain mapped to the routine builder and cycle scheduler`,
  );
}

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
const customProGrantFlag = inventory.items.find(
  (entry) => entry.id === 'feature-flag:EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED',
);
assert(customProGrantFlag, 'missing the governed custom Pro grant flag');
assert.deepEqual(
  customProGrantFlag.featureIds,
  ['F-11', 'F-12'],
  'the custom Pro grant must remain mapped to subscriptions and reverse trial',
);
const iosWinBackFlag = inventory.items.find(
  (entry) => entry.id === 'feature-flag:EXPO_PUBLIC_IOS_WIN_BACK_ENABLED',
);
assert(iosWinBackFlag, 'missing the governed iOS win-back flag');
assert.deepEqual(
  iosWinBackFlag.featureIds,
  ['F-11'],
  'the iOS win-back flag must remain mapped to subscriptions',
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

assert(
  !inventory.items.some((entry) => entry.id === 'data-store:postgres:private'),
  'schema-qualified private tables must be inventoried by table name rather than schema name',
);
for (const id of [
  'data-store:postgres:catalog_launch_curation_campaigns',
  'data-store:postgres:catalog_launch_curation_records',
  'data-store:postgres:catalog_launch_curation_product_mutations',
  'data-store:postgres:catalog_launch_curation_events',
  'data-store:postgres:catalog_launch_curation_heads',
  'data-store:postgres:catalog_launch_curation_campaign_release_events',
  'data-store:postgres:catalog_launch_curation_campaign_release_heads',
]) {
  const curationItem = inventory.items.find((entry) => entry.id === id);
  assert(curationItem, `missing sealed catalog curation authority ${id}`);
  assert.deepEqual(
    curationItem.featureIds,
    ['F-04'],
    `${id} must remain mapped to the production catalog feature`,
  );
}

console.log(
  'Execution baseline smoke passed: omission, addition, duplicate, feature, and surface guards reject incomplete sets.',
);
