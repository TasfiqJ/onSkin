#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = Object.freeze({
  packageJson: 'package.json',
  privateKV: 'apps/mobile/src/lib/storage/privateKV.ts',
  privateKVTest: 'apps/mobile/src/lib/storage/privateKV.test.ts',
  orderStore: 'apps/mobile/src/features/routine/orderStore.ts',
  orderStoreTest: 'apps/mobile/src/features/routine/orderStore.test.ts',
  orderRoutesTest: 'apps/mobile/src/features/routine/orderRoutes.test.ts',
  reorderRoute: 'apps/mobile/src/app/routine/reorder.tsx',
  usePlan: 'apps/mobile/src/features/routine/usePlan.ts',
  cycleStore: 'apps/mobile/src/features/scheduler/cycleStore.ts',
  cycleStoreTest: 'apps/mobile/src/features/scheduler/cycleStore.test.ts',
  customCycle: 'apps/mobile/src/features/scheduler/customCycle.ts',
  customCycleTest: 'apps/mobile/src/features/scheduler/customCycle.test.ts',
  useCycle: 'apps/mobile/src/features/scheduler/useCycle.ts',
  projectionTest: 'apps/mobile/src/features/scheduler/projection.test.ts',
  todayTest: 'apps/mobile/src/features/today/useToday.test.ts',
  cleanupKeys: 'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  cleanupTest: 'apps/mobile/src/features/settings/localPrivateData.test.ts',
  localExport: 'apps/mobile/src/features/settings/localDeviceExport.ts',
  localExportTest: 'apps/mobile/src/features/settings/localDeviceExport.test.ts',
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function boundedSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing ordered end marker: ${endMarker}`);
  return source.slice(start, end);
}

function occurrenceCount(source, marker) {
  return source.split(marker).length - 1;
}

test('private persistence bounds one serialized guarded transform and verified rollback', () => {
  const privateKV = read(paths.privateKV);
  const privateKVTest = read(paths.privateKVTest);
  const orderStore = read(paths.orderStore);
  const cycleStore = read(paths.cycleStore);
  const guardedUpdate = boundedSection(
    privateKV,
    'async function updatePrivateItemWithGuard',
    'export async function updatePrivateItem',
  );
  const publicUpdate = boundedSection(
    privateKV,
    'export async function updatePrivateItem',
    'export function updateCatalogLookupQueueForPurposeLimitedExport',
  );
  const rollback = boundedSection(
    privateKV,
    'async function restoreExactRawAfterAmbiguousMutation',
    'export async function getPrivateItem',
  );
  const orderSave = boundedSection(
    orderStore,
    'export async function saveRoutineOrderOverrides',
    'function stepIds',
  );
  const cycleMutation = boundedSection(
    cycleStore,
    'async function mutateCycleConfig',
    'export async function updateCycleConfig',
  );

  assert.match(guardedUpdate, /runSerializedPrivateMutations\(\[key\],\s*async\s*\(\)\s*=>/u);
  const readIndex = guardedUpdate.indexOf(
    'const existingRaw = await assertNoFailedReadRewrite(key)',
  );
  const transformIndex = guardedUpdate.indexOf('const nextValue = updater(currentValue)');
  const conflictReadIndex = guardedUpdate.indexOf(
    'const latestRaw = await AsyncStorage.getItem(key)',
  );
  const writeIndex = guardedUpdate.indexOf('if (nextValue === null)');
  assert.ok(readIndex >= 0 && transformIndex > readIndex);
  assert.ok(conflictReadIndex > transformIndex && writeIndex > conflictReadIndex);
  assert.match(publicUpdate, /captureHealthPurposePrivateDataWriteLease\(key\)/u);
  assert.match(publicUpdate, /return updatePrivateItemWithGuard\(key,\s*updater/u);
  assert.match(rollback, /if\s*\(\s*currentRaw\s*===\s*existingRaw\s*\)\s*return;/u);
  assert.match(rollback, /if\s*\(\s*currentRaw\s*!==\s*attemptedRaw\s*\)/u);
  assert.match(rollback, /restoredRaw\s*!==\s*existingRaw/u);
  assert.match(guardedUpdate, /restoreExactRawAfterAmbiguousMutation/u);
  assert.equal(occurrenceCount(orderSave, 'updatePrivateItem(STORAGE_KEY,'), 1);
  assert.equal(occurrenceCount(cycleMutation, 'updatePrivateItem(KEY,'), 1);
  assert.doesNotMatch(cycleMutation, /loadCycleConfigForLease/u);
  assert.match(
    privateKVTest,
    /serializes complete read-modify-write transforms for one private key/u,
  );
  assert.match(
    cycleStore,
    /saveCustomCycleDefinition[\s\S]*?mutateCycleConfig\([\s\S]*?variant:\s*['"]custom['"][\s\S]*?customCycle/u,
  );
});

test('malformed, future-version, read-failure, and write-failure state stays preserved', () => {
  const privateKV = read(paths.privateKV);
  const privateKVTest = read(paths.privateKVTest);
  const orderStore = read(paths.orderStore);
  const orderStoreTest = read(paths.orderStoreTest);
  const cycleStore = read(paths.cycleStore);
  const cycleStoreTest = read(paths.cycleStoreTest);

  assert.match(privateKV, /assertNoFailedReadRewrite\(key\)/u);
  assert.match(
    privateKVTest,
    /blocks a fallback rewrite until the failed encrypted read succeeds/u,
  );
  assert.match(
    orderStore,
    /const latest\s*=\s*current\s*===\s*null\s*\?\s*emptyOverrides\(\)\s*:\s*decodeOverrides\(current\)/u,
  );
  assert.match(orderStore, /ROUTINE_ORDER_UNSUPPORTED_VERSION/u);
  assert.match(
    orderStoreTest,
    /preserves malformed or future-version state instead of applying it/u,
  );
  assert.match(
    orderStoreTest,
    /propagates private-storage failures instead of claiming a save succeeded/u,
  );
  assert.match(
    privateKVTest,
    /restores exact prior ciphertext when setItem commits and then rejects/u,
  );
  assert.match(
    privateKVTest,
    /restores exact prior ciphertext when guarded remove commits and then rejects/u,
  );
  assert.match(
    privateKVTest,
    /fails closed without overwriting conflicting bytes after setItem rejection/u,
  );
  assert.match(
    privateKVTest,
    /fails closed without overwriting a conflicting guarded-removal replacement/u,
  );
  assert.match(cycleStore, /throw new Error\(['"]CYCLE_CONFIG_INVALID['"]\)/u);
  assert.match(cycleStoreTest, /fails closed and preserves malformed current cycle state/u);
  assert.match(
    cycleStoreTest,
    /preserves unknown custom-cycle schemas instead of projecting or deleting them/u,
  );
  assert.match(
    cycleStoreTest,
    /propagates failed private writes and leaves the previous cycle unchanged/u,
  );
  assert.match(
    cycleStoreTest,
    /does not pre-commit reconciliation when the requested mutation fails/u,
  );
  assert.match(
    cycleStoreTest,
    /requires a complete exact current schema instead of defaulting partial or unknown fields/u,
  );
});

test('routine-order phase transactions merge independent concurrent edits', () => {
  const orderStore = read(paths.orderStore);
  const orderStoreTest = read(paths.orderStoreTest);
  const orderSave = boundedSection(
    orderStore,
    'export async function saveRoutineOrderOverrides',
    'function stepIds',
  );

  assert.match(orderSave, /validateSaveTransaction\(transaction\)/u);
  assert.match(orderSave, /am:\s*!sameIds\(previous\.am,\s*next\.am\)/u);
  assert.match(orderSave, /pm:\s*!sameIds\(previous\.pm,\s*next\.pm\)/u);
  assert.match(orderSave, /am:\s*changed\.am\s*\?\s*next\.am\s*:\s*latest\.am/u);
  assert.match(orderSave, /pm:\s*changed\.pm\s*\?\s*next\.pm\s*:\s*latest\.pm/u);
  assert.match(
    orderStoreTest,
    /merges concurrent independent AM and PM edits against the latest serialized value/u,
  );
  assert.match(
    orderStoreTest,
    /does not resurrect a concurrently cleared phase while another phase is reordered/u,
  );
  assert.match(
    orderStoreTest,
    /treats a stale no-op snapshot as a no-op instead of erasing a concurrent edit/u,
  );
});

test('routine-order success publishes cache, analytics, and navigation only after persistence', () => {
  const reorderRoute = read(paths.reorderRoute);
  const saveIndex = reorderRoute.indexOf('const saved = await saveRoutineOrderOverrides');
  const cacheIndex = reorderRoute.indexOf('queryClient.setQueryData', saveIndex);
  const analyticsIndex = reorderRoute.indexOf("track('step_reordered'", cacheIndex);
  const navigationIndex = reorderRoute.indexOf('backOrReplace(router);', analyticsIndex);
  const catchIndex = reorderRoute.indexOf('} catch {', saveIndex);

  assert.ok(saveIndex >= 0, 'routine order route must await the private write');
  assert.ok(cacheIndex > saveIndex, 'cache publication must follow the private write');
  assert.ok(analyticsIndex > cacheIndex, 'success analytics must follow cache publication');
  assert.ok(navigationIndex > analyticsIndex, 'navigation must follow success analytics');
  assert.ok(catchIndex > navigationIndex, 'the failure path must enclose the ordered success path');
  assert.match(
    reorderRoute,
    /if\s*\(\s*saveInFlight\.current\s*\|\|\s*persistenceUnavailable\s*\)\s*return;/u,
  );
  assert.match(
    reorderRoute,
    /We could not confirm the save\. Reload to check your saved routine, then try again\./u,
  );
});

test('custom-cycle cache and analytics publication follows the committed atomic value', () => {
  const useCycle = read(paths.useCycle);
  const commitStart = useCycle.indexOf('const commit =');
  const storageIndex = useCycle.indexOf('const next = await operation();', commitStart);
  const cacheIndex = useCycle.indexOf('qc.setQueryData<CycleConfig>', storageIndex);
  const analyticsIndex = useCycle.indexOf('afterCommit?.();', cacheIndex);

  assert.ok(commitStart >= 0);
  assert.ok(storageIndex > commitStart, 'cycle mutation must await storage');
  assert.ok(cacheIndex > storageIndex, 'cycle cache must publish the returned committed value');
  assert.ok(analyticsIndex > cacheIndex, 'cycle success analytics must follow cache publication');
  assert.match(
    useCycle,
    /saveCustom[\s\S]*?saveCustomCycleDefinition\(definition\)[\s\S]*?cycle_customized/u,
  );
});

test('relaunch loaders decode versioned state and never silently replace unsupported bytes', () => {
  const orderStore = read(paths.orderStore);
  const orderStoreTest = read(paths.orderStoreTest);
  const usePlan = read(paths.usePlan);
  const cycleStore = read(paths.cycleStore);
  const cycleStoreTest = read(paths.cycleStoreTest);

  assert.match(
    orderStore,
    /loadRoutineOrderOverrides[\s\S]*?getPrivateItem\(STORAGE_KEY\)[\s\S]*?decodeOverrides\(raw\)/u,
  );
  assert.match(orderStore, /schemaVersion:\s*1/u);
  assert.match(
    orderStoreTest,
    /normalizes legacy ids in memory without rewriting storage during a read/u,
  );
  assert.match(usePlan, /queryFn:\s*loadRoutineOrderForCurrentHealthLease/u);
  assert.match(cycleStore, /const KEY\s*=\s*['"]layerwell\.cycle\.v2['"]/u);
  assert.match(cycleStore, /const LEGACY_KEY\s*=\s*['"]layerwell\.cycle\.v1['"]/u);
  assert.match(cycleStore, /allowMissingSchemaVersion\s*=\s*false/u);
  assert.match(
    cycleStoreTest,
    /migrates a valid legacy partial config into the isolated current key/u,
  );
  assert.match(
    cycleStoreTest,
    /requires an explicit schema on the current key while legacy migration stays compatible/u,
  );
  assert.match(
    cycleStoreTest,
    /requires a complete exact current schema instead of defaulting partial or unknown fields/u,
  );
  assert.match(cycleStoreTest, /preserves a future top-level schema for a newer app build/u);
});

test('named Node/Vitest timezone cases remain explicit and bounded', () => {
  const projectionTest = read(paths.projectionTest);
  const todayTest = read(paths.todayTest);

  for (const source of [projectionTest, todayTest]) {
    assert.match(source, /America\/Toronto/u);
    assert.match(source, /America\/Los_Angeles/u);
    assert.match(source, /UTC/u);
    assert.match(source, /process\.env\.TZ/u);
  }
  assert.match(projectionTest, /keeps date-only projection on calendar days/u);
  assert.match(todayTest, /renders the real spring-forward clock jump/u);
  assert.match(todayTest, /keeps the same local date through the repeated fall-back hour/u);
});

test('routine and custom-cycle intent uses stable shelf-product identities', () => {
  const orderStore = read(paths.orderStore);
  const orderStoreTest = read(paths.orderStoreTest);
  const customCycle = read(paths.customCycle);
  const customCycleTest = read(paths.customCycleTest);
  const cycleStore = read(paths.cycleStore);

  assert.match(orderStore, /steps\.map\(\(step\)\s*=>\s*step\.productId\)/u);
  assert.match(
    orderStore,
    /new Map\(canonicalSteps\.map\(\(step\)\s*=>\s*\[step\.productId,\s*step\]/u,
  );
  assert.match(
    orderStoreTest,
    /reorders by stable product id even when product names are duplicated/u,
  );
  assert.match(
    orderStoreTest,
    /keeps a renamed product in the saved position because identity is its id/u,
  );
  assert.match(
    customCycle,
    /export type CustomCycleNight\s*=\s*\{\s*productId:\s*string\s*\|\s*null;/u,
  );
  assert.match(customCycle, /normalizeProductId\(rawNight\.productId\)/u);
  assert.match(customCycleTest, /turns a generated cycle into stable product-id intent/u);
  assert.match(cycleStore, /customCycle:\s*CustomCycleDefinition\s*\|\s*null/u);
});

test('cleanup and purpose-limited export register both current persistence records', () => {
  const cleanupKeys = read(paths.cleanupKeys);
  const cleanupTest = read(paths.cleanupTest);
  const localExport = read(paths.localExport);
  const localExportTest = read(paths.localExportTest);

  for (const key of ['layerwell.routineOrder.v1', 'layerwell.cycle.v2']) {
    assert.match(cleanupKeys, new RegExp(`['"]${key.replaceAll('.', '\\.')}['"]`, 'u'));
    assert.match(localExport, new RegExp(`key:\\s*['"]${key.replaceAll('.', '\\.')}['"]`, 'u'));
  }
  assert.match(cleanupTest, /layerwell\.routineOrder\.v1/u);
  assert.match(localExport, /field:\s*['"]routine_order_overrides['"]/u);
  assert.match(localExport, /field:\s*['"]cycle_configuration['"]/u);
  assert.match(localExportTest, /routine_order_overrides/u);
  assert.match(localExportTest, /cycle_configuration/u);
  assert.match(localExportTest, /customCycle/u);
});

test('ordering preference cannot create cadence authority and custom-cycle writes cannot bypass it', () => {
  const orderStore = read(paths.orderStore);
  const usePlan = read(paths.usePlan);
  const cycleStore = read(paths.cycleStore);

  assert.doesNotMatch(orderStore, /reviewGate|canUseRoutineCadence|cycleStore/u);
  assert.match(
    orderStore,
    /return am === plan\.am && pm === plan\.pm \? plan : \{ \.\.\.plan, am, pm \};/u,
  );
  assert.match(
    usePlan,
    /const canonicalPlan\s*=\s*generatePlan[\s\S]*?applyRoutineOrderOverrides\(canonicalPlan,\s*orderOverrides\)/u,
  );
  assert.match(
    cycleStore,
    /async function mutateCycleConfig[\s\S]*?assertRoutineCadenceMutationAdmission\(\)[\s\S]*?updatePrivateItem\(KEY/u,
  );
  assert.match(cycleStore, /saveCustomCycleDefinition[\s\S]*?return mutateCycleConfig\(/u);
});

test('the CORE-04 persistence contract is mandatory in Phase 3 and launch verification', () => {
  const packageJson = JSON.parse(read(paths.packageJson));
  assert.equal(
    packageJson.scripts['core04:persistence-source-contract:test'],
    'node --test scripts/core04/persistence-source-contract.test.mjs',
  );
  for (const parentScript of ['phase3:verify', 'launch:verify']) {
    const commands = String(packageJson.scripts[parentScript] ?? '').split(' && ');
    assert.ok(
      commands.includes('npm run core04:persistence-source-contract:test'),
      `${parentScript} must run the CORE-04 persistence contract as a blocking gate`,
    );
  }
});
