import { existsSync } from 'node:fs';
import {
  baselinePaths,
  buildFeatureInventory,
  buildTaskGraph,
  features,
  gatedSurfaces,
  discoverRuntimeCredentialNames,
  exactSetProblems,
  parsePlanRows,
  readJson,
  readRepo,
  readinessLabels,
  root,
  stableJson,
} from './execution-baseline.mjs';

const failures = [];
const fail = (message) => failures.push(message);

for (const path of Object.values(baselinePaths)) {
  if (!existsSync(new URL(`../../${path}`, import.meta.url)))
    fail(`Missing baseline artifact: ${path}`);
}

async function checkCanonical(path, expected) {
  if (!existsSync(new URL(`../../${path}`, import.meta.url))) return;
  if (readRepo(path) !== (await stableJson(expected))) {
    fail(
      `${path} is stale. Run node scripts/launch/build-execution-baseline.mjs and review the diff.`,
    );
  }
}

await checkCanonical(baselinePaths.featureInventory, buildFeatureInventory());
await checkCanonical(baselinePaths.taskGraph, buildTaskGraph());

const planRows = parsePlanRows();
const planIds = planRows.map(({ id }) => id);
if (planIds.length !== new Set(planIds).size)
  fail('Execution plan contains duplicate work-item IDs.');

if (existsSync(new URL(`../../${baselinePaths.executionStatus}`, import.meta.url))) {
  const status = readJson(baselinePaths.executionStatus);
  const statusIds = status.items.map(({ id }) => id);
  for (const problem of exactSetProblems('Execution status plan IDs', planIds, statusIds))
    fail(problem);
  if (status.expectedWorkItemCount !== planIds.length) {
    fail(
      `Execution status count ${status.expectedWorkItemCount} does not match plan count ${planIds.length}.`,
    );
  }
  for (const entry of status.items) {
    if (!status.allowedStatuses.includes(entry.status))
      fail(`Invalid status for ${entry.id}: ${entry.status}`);
    if (!entry.nextAction) fail(`Missing next action for ${entry.id}.`);
    if (!Array.isArray(entry.blockedBy) || !Array.isArray(entry.evidenceRefs)) {
      fail(`Invalid blockedBy/evidenceRefs arrays for ${entry.id}.`);
    }
  }
}

if (existsSync(new URL(`../../${baselinePaths.taskGraph}`, import.meta.url))) {
  const graph = readJson(baselinePaths.taskGraph);
  const graphIds = graph.nodes.map(({ id }) => id);
  for (const problem of exactSetProblems('Task graph plan IDs', planIds, graphIds)) fail(problem);
  for (const node of graph.nodes) {
    if (!node.nextAction) fail(`Task graph node ${node.id} has no next action.`);
    for (const dependency of node.prerequisites) {
      if (!planIds.includes(dependency)) fail(`${node.id} has unknown prerequisite ${dependency}.`);
      if (dependency === node.id) fail(`${node.id} depends on itself.`);
    }
  }
  const graphById = new Map(graph.nodes.map((node) => [node.id, node.prerequisites]));
  const visited = new Set();
  const visiting = new Set();
  function visit(id, ancestry = []) {
    if (visiting.has(id)) {
      fail(`Task graph contains a dependency cycle: ${[...ancestry, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graphById.get(id) ?? []) visit(dependency, [...ancestry, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graphIds) visit(id);
}

if (existsSync(new URL(`../../${baselinePaths.featureInventory}`, import.meta.url))) {
  const inventory = readJson(baselinePaths.featureInventory);
  const launchContract = readJson(baselinePaths.launchContract);
  const featureIds = inventory.features.map(({ id }) => id);
  const surfaceIds = inventory.gatedSurfaces.map(({ id }) => id);
  const expectedFeatureIds = features.map(({ id }) => id);
  const expectedSurfaceIds = gatedSurfaces.map(({ id }) => id);
  for (const id of expectedFeatureIds)
    if (!featureIds.includes(id)) fail(`Feature inventory is missing ${id}.`);
  for (const id of expectedSurfaceIds)
    if (!surfaceIds.includes(id)) fail(`Feature inventory is missing gated surface ${id}.`);
  if (inventory.features.length !== 20)
    fail(`Feature inventory must contain exactly 20 launch features.`);
  const contractFeatureKeys = launchContract.requiredFeatures.map(({ key }) => key);
  const inventoryFeatureKeys = inventory.features.map(({ key }) => key);
  for (const problem of exactSetProblems(
    'Feature inventory contract keys',
    contractFeatureKeys,
    inventoryFeatureKeys,
  ))
    fail(problem);
  const contractSurfaceKeys = [...launchContract.requiredSurfaces];
  const inventorySurfaceKeys = inventory.gatedSurfaces.flatMap(({ surfaceKeys }) => surfaceKeys);
  for (const problem of exactSetProblems(
    'Gated surface contract keys',
    contractSurfaceKeys,
    inventorySurfaceKeys,
  ))
    fail(problem);
  for (const entry of inventory.items) {
    if (!readinessLabels.includes(entry.readiness))
      fail(`${entry.id} has invalid readiness ${entry.readiness}.`);
    if (!entry.featureIds?.length) fail(`${entry.id} has no feature mapping.`);
    for (const featureId of entry.featureIds ?? []) {
      if (!featureIds.includes(featureId))
        fail(`${entry.id} references unknown feature ${featureId}.`);
    }
    if (!existsSync(new URL(`../../${entry.source}`, import.meta.url)))
      fail(`${entry.id} source is missing: ${entry.source}`);
  }
  for (const category of [
    'route',
    'feature-flag',
    'native-module',
    'data-store',
    'edge-function',
    'vendor-call',
    'generated-packet',
  ]) {
    if (!inventory.items.some((entry) => entry.category === category))
      fail(`Feature inventory has no ${category} entries.`);
  }
}

if (existsSync(new URL(`../../${baselinePaths.credentials}`, import.meta.url))) {
  const credentials = readJson(baselinePaths.credentials);
  const requiredClasses = ['client-public', 'server-secret', 'eas', 'supabase', 'apple', 'vendor'];
  for (const name of requiredClasses) {
    if (!credentials.storageClasses?.some((entry) => entry.id === name))
      fail(`Credential storage class missing: ${name}`);
  }
  const names = [];
  for (const entry of credentials.credentials ?? []) {
    names.push(entry.name);
    if ('value' in entry || 'exampleValue' in entry || 'currentValue' in entry) {
      fail(`Credential inventory must never store values (${entry.name}).`);
    }
    if (!entry.storageClass || !entry.location || !entry.sensitivity)
      fail(`Credential metadata incomplete: ${entry.name}`);
  }
  if (names.length !== new Set(names).size) fail('Credential inventory contains duplicate names.');
  for (const name of discoverRuntimeCredentialNames()) {
    if (!names.includes(name)) fail(`Runtime credential/config name is not inventoried: ${name}`);
  }
}

if (existsSync(new URL(`../../${baselinePaths.evidenceGovernance}`, import.meta.url))) {
  const governance = readJson(baselinePaths.evidenceGovernance);
  for (const key of ['redaction', 'retention', 'rollback', 'incident', 'evidenceRecord']) {
    if (!governance[key]) fail(`Evidence governance section missing: ${key}`);
  }
  if (!governance.redaction.prohibitedContent?.length)
    fail('Evidence governance lacks prohibited-content rules.');
  if (!governance.rollback.requiredFields?.length)
    fail('Rollback convention lacks required fields.');
  if (!governance.incident.severities?.length) fail('Incident convention lacks severities.');
}

if (existsSync(new URL(`../../${baselinePaths.worktreeBoundary}`, import.meta.url))) {
  const boundary = readJson(baselinePaths.worktreeBoundary);
  if (!boundary.defaultRule || !boundary.observedAtDelegation?.length)
    fail('Worktree boundary is incomplete.');
  for (const entry of boundary.observedAtDelegation ?? []) {
    if (!entry.path || !entry.disposition) fail('Worktree boundary entry lacks path/disposition.');
  }
}

if (failures.length) {
  console.error(`Execution baseline validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Execution baseline valid: ${planIds.length} plan items, ${features.length} features, ${gatedSurfaces.length} grouped gated surfaces (${gatedSurfaces.flatMap(({ surfaceKeys }) => surfaceKeys).length} contract keys); repository root ${root}.`,
);
