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

console.log(
  'Execution baseline smoke passed: omission, addition, duplicate, feature, and surface guards reject incomplete sets.',
);
