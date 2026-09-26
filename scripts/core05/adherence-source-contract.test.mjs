#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = Object.freeze({
  packageJson: 'package.json',
  store: 'apps/mobile/src/features/today/completionsStore.ts',
  storeTest: 'apps/mobile/src/features/today/completionsStore.test.ts',
  completionSync: 'apps/mobile/src/features/today/completionSync.ts',
  today: 'apps/mobile/src/app/(tabs)/today.tsx',
  todayTest: 'apps/mobile/src/features/today/todayRoute.test.ts',
  completionQueue: 'apps/mobile/src/lib/offline/completionQueue.ts',
  completionQueueTest: 'apps/mobile/src/lib/offline/completionQueue.test.ts',
  shelfMirrorQueue: 'apps/mobile/src/lib/offline/shelfMirrorQueue.ts',
  offlineSync: 'apps/mobile/src/lib/offline/OfflineSync.tsx',
  offlineSyncTest: 'apps/mobile/src/lib/offline/OfflineSync.test.ts',
  progress: 'apps/mobile/src/features/routine/useProgress.ts',
  streak: 'apps/mobile/src/features/streak/streak.ts',
  streakTest: 'apps/mobile/src/features/streak/streak.test.ts',
  clock: 'apps/mobile/src/features/today/useRoutineClock.ts',
  clockTest: 'apps/mobile/src/features/today/useRoutineClock.test.ts',
  streakRoute: 'apps/mobile/src/app/routine/streak.tsx',
  welcomeBackRoute: 'apps/mobile/src/app/routine/welcome-back.tsx',
  cleanup: 'apps/mobile/src/features/settings/localPrivateDataKeys.ts',
  localExport: 'apps/mobile/src/features/settings/localDeviceExport.ts',
  notificationCopy: 'apps/mobile/src/features/notifications/copy.ts',
  notificationDefaults: 'apps/mobile/src/features/notifications/defaults.ts',
  notificationStore: 'apps/mobile/src/features/notifications/store.ts',
  notificationOnboarding: 'apps/mobile/src/features/notifications/onboarding.ts',
  notificationOnboardingRoute: 'apps/mobile/src/app/onboarding/notifications.tsx',
  notificationDelivery: 'apps/mobile/src/features/notifications/deliver.ts',
  notificationLedger: 'apps/mobile/src/features/notifications/sentStore.ts',
  notificationSettings: 'apps/mobile/src/app/settings/notifications.tsx',
  notificationTiming: 'apps/mobile/src/app/settings/timing.tsx',
  adherenceMigration: 'supabase/migrations/20260726000068_routine_adherence_authority.sql',
  adherenceDbTest: 'supabase/tests/database/routine_adherence_authority.test.sql',
  syncBridgeMigration: 'supabase/migrations/20260726000069_routine_completion_sync_bridge.sql',
  syncBridgeDbTest: 'supabase/tests/database/routine_completion_sync_bridge.test.sql',
  databaseTypes: 'packages/types/src/database.types.ts',
  adherenceParityCorpus: 'scripts/core05/adherence-parity-corpus.json',
  schemaContract: 'supabase/tests/database/schema_contract.test.sql',
  notificationHooks: 'apps/mobile/src/features/notifications/useNotifications.ts',
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function generatedFunctionBlock(source, functionName) {
  const declaration = new RegExp(`^      ${functionName}: \\{`, 'mu').exec(source);
  assert.ok(declaration, `generated DB types: missing ${functionName}`);

  const bodyStart = source.indexOf('\n', declaration.index) + 1;
  const nextDeclaration = /^      [a-z0-9_]+: \{/mu.exec(source.slice(bodyStart));
  assert.ok(nextDeclaration, `generated DB types: could not bound ${functionName}`);
  return source.slice(declaration.index, bodyStart + nextDeclaration.index);
}

function assertGeneratedObjectShape(functionBlock, sectionName, expectedProperties) {
  const marker = `        ${sectionName}: {`;
  const markerIndex = functionBlock.indexOf(marker);
  assert.notEqual(markerIndex, -1, `generated DB types: missing ${sectionName} object`);

  const bodyStart = functionBlock.indexOf('\n', markerIndex) + 1;
  const closing = /^        \}(?:\[\])?$/mu.exec(functionBlock.slice(bodyStart));
  assert.ok(closing, `generated DB types: could not bound ${sectionName} object`);
  const body = functionBlock.slice(bodyStart, bodyStart + closing.index);
  const actualProperties = new Map();

  for (const line of body.split('\n')) {
    if (line.length === 0) continue;
    const property = /^          ([a-z0-9_]+)(\??): (.+)$/u.exec(line);
    assert.ok(property, `generated DB types: unexpected ${sectionName} line ${line}`);
    actualProperties.set(property[1], {
      optional: property[2] === '?',
      type: property[3],
    });
  }

  assert.deepEqual(
    [...actualProperties.keys()].sort(),
    Object.keys(expectedProperties).sort(),
    `generated DB types: ${sectionName} keys must remain exact`,
  );
  for (const [propertyName, expectedType] of Object.entries(expectedProperties)) {
    assert.deepEqual(
      actualProperties.get(propertyName),
      { optional: false, type: expectedType },
      `generated DB types: ${sectionName}.${propertyName} must remain required ${expectedType}`,
    );
  }
}

function assertGeneratedScalarReturn(functionBlock, expectedType) {
  assert.match(
    functionBlock,
    new RegExp(`^        Returns: ${expectedType}$`, 'mu'),
    `generated DB types: return type must remain ${expectedType}`,
  );
}

function sourceBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `${label}: missing start marker`);
  assert.ok(endIndex > startIndex, `${label}: missing end marker`);
  return source.slice(startIndex, endIndex);
}

function assertSourceOrder(source, patterns, label) {
  let offset = 0;
  for (const pattern of patterns) {
    const flags = pattern.flags.replaceAll('g', '').replaceAll('y', '');
    const match = new RegExp(pattern.source, flags).exec(source.slice(offset));
    assert.ok(match, `${label}: missing ordered source ${pattern}`);
    offset += match.index + match[0].length;
  }
}

function quotedValues(source) {
  return [...source.matchAll(/['"]([^'"]+)['"]/gu)].map((match) => match[1]);
}

function expandIsoDateRange({ start, end }) {
  const dates = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

test('completion state is strict v3 and legacy versions never invent adherence or replay work', () => {
  const store = read(paths.store);
  const storeTest = read(paths.storeTest);
  const completionSync = read(paths.completionSync);
  const legacyDecode = sourceBetween(
    store,
    "if (!hasOwn(parsed, 'version'))",
    'if (parsed.version === 1)',
    'legacy completion decoder',
  );
  const v1Decode = sourceBetween(
    store,
    'if (parsed.version === 1)',
    'if (parsed.version === 2)',
    'v1 completion decoder',
  );
  const v2Decode = sourceBetween(
    store,
    'if (parsed.version === 2)',
    'if (parsed.version !== SCHEMA_VERSION)',
    'v2 completion decoder',
  );
  const currentDecode = sourceBetween(
    store,
    'if (parsed.version !== SCHEMA_VERSION)',
    'function encodeCompletionLog',
    'current completion decoder',
  );

  assert.match(store, /const SCHEMA_VERSION\s*=\s*3\s+as const/u);
  assert.match(currentDecode, /Object\.keys\(parsed\)\.length\s*!==\s*4/u);
  for (const key of ['days', 'completedDays', 'sync']) {
    assert.match(currentDecode, new RegExp(`hasOwn\\(parsed, ['"]${key}['"]\\)`, 'u'));
  }
  assert.match(currentDecode, /decodeCompletionSyncState\(parsed\.sync/u);
  assert.match(
    completionSync,
    /hasExactKeys\(value,\s*\[['"]routineIds['"],\s*['"]stepIds['"],\s*['"]journal['"],\s*['"]outbox['"],\s*['"]terminal['"]\]\)/u,
  );
  for (const historicalDecode of [legacyDecode, v1Decode, v2Decode]) {
    assert.equal(
      historicalDecode.match(/sync:\s*emptyCompletionSyncState\(\)/gu)?.length,
      1,
      'each historical decoder must migrate with exactly one empty replay state',
    );
    assert.doesNotMatch(historicalDecode, /appendCompletionSync|journal\.push|outbox\.push/u);
  }
  for (const noAdherenceDecode of [legacyDecode, v1Decode]) {
    assert.match(noAdherenceDecode, /completedDays:\s*new Set\(\)/u);
  }
  assert.match(v2Decode, /normalizeCompletedDays\(parsed\.completedDays,\s*days\)/u);
  assert.match(store, /normalizedDate\s*!==\s*entry/u);
  assert.match(store, /out\.has\(normalizedDate\)/u);
  assert.match(store, /key\.startsWith\(['"]PM:['"]\)/u);
  assert.match(storeTest, /does not invent adherence from AM, partial PM, or legacy step rows/u);
  assert.match(
    storeTest,
    /upgrades v2 without inventing remote identities, timestamps, or replay work/u,
  );
  assert.match(storeTest, /rejects non-canonical current envelopes without rewriting their bytes/u);
});

test('only a complete projected PM or recovery routine creates an adherence day or remote work', () => {
  const store = read(paths.store);
  const storeTest = read(paths.storeTest);
  const completionSync = read(paths.completionSync);
  const today = read(paths.today);
  const toggle = sourceBetween(
    store,
    'export async function toggleCompletion',
    '/** Strict FIFO snapshot',
    'toggleCompletion',
  );
  const atomicAppend = sourceBetween(
    store,
    'function appendCompletionSyncOperation',
    'function appendCompletionSyncEvents',
    'completion journal append',
  );
  const terminalCascade = sourceBetween(
    store,
    'function blockRoutineDayForTerminalStep',
    'function appendCompletionSyncEvents',
    'terminal step dependency cascade',
  );
  const rejection = sourceBetween(
    store,
    'export async function rejectCompletionSyncOperation',
    '/** Dates with at least one completion',
    'terminal completion rejection',
  );

  assert.match(store, /export type ScheduledCompletionContext/u);
  assert.match(store, /scheduledStepKeys\.every\(\(step\)\s*=>\s*day\.has\(step\)\)/u);
  assert.match(
    store,
    /completionDayInserted:\s*completedScheduledRoutine\s*&&\s*!alreadyCompletedDay/u,
  );
  assert.match(store, /for \(const date of log\.completedDays\) completedDates\.add\(date\)/u);
  assert.match(store, /source:\s*['"]real_plan['"]/u);
  assert.match(toggle, /remoteSync\?:\s*CompletionRemoteSyncContext/u);
  assert.match(toggle, /remoteSync\.source\s*!==\s*['"]real_plan['"]/u);
  assert.match(toggle, /const remoteIdentity = completionSyncStepIdentity\(normalizedKey\)/u);
  assert.match(toggle, /remoteIdentity === null/u);
  assert.match(toggle, /remoteSync\.timezone\s*!==\s*null\s*&&\s*remoteTimezone\s*===\s*null/u);
  assert.match(
    toggle,
    /remoteSync\.unavailableReason\s*===\s*['"]COMPLETION_TIMEZONE_UNAVAILABLE['"][\s\S]*?remoteSync\.timezone\s*!==\s*null/u,
  );
  assert.match(toggle, /canonicalCompletionSyncStepOrder\(remoteSync\.stepOrder\)\s*===\s*null/u);
  assertSourceOrder(
    toggle,
    [
      /await updatePrivateItem\(KEY/u,
      /appendCompletionSyncEvents\(/u,
      /return encodeCompletionLog\(state\)/u,
    ],
    'visible completion and replay event must share one private-KV transform',
  );
  assertSourceOrder(
    atomicAppend,
    [/sync\.journal\.push\(/u, /sync\.outbox\.push\(eventId\)/u],
    'journal append must precede its replay pointer',
  );
  assert.match(rejection, /operation\?\.kind\s*===\s*['"]step['"]/u);
  assert.match(
    rejection,
    /blockRoutineDayForTerminalStep\(state\.sync,\s*normalizedEventId,\s*operation\)/u,
  );
  assert.match(terminalCascade, /index\s*>\s*stepIndex/u);
  assert.match(terminalCascade, /operation\.kind\s*===\s*['"]routine_day['"]/u);
  assert.match(terminalCascade, /operation\.routineId\s*===\s*step\.routineId/u);
  assert.match(terminalCascade, /operation\.completedDate\s*===\s*step\.completedDate/u);
  assert.match(
    terminalCascade,
    /sync\.outbox\s*=\s*sync\.outbox\.filter\(\(eventId\)\s*=>\s*eventId\s*!==\s*marker\.eventId\)/u,
  );
  assert.match(terminalCascade, /code:\s*COMPLETION_DEPENDENCY_TERMINAL/u);
  assert.match(completionSync, /value\s*===\s*COMPLETION_DEPENDENCY_TERMINAL\s*\?\s*value\s*:/u);
  assert.match(
    storeTest,
    /records exactly one adherence day only after every scheduled PM step is durable/u,
  );
  assert.match(
    storeTest,
    /atomically journals real-plan step and full-PM attestations with stable identities/u,
  );
  assert.match(
    storeTest,
    /atomically cascades a terminal final PM step to its bound routine-day marker/u,
  );
  assert.match(today, /stepKey\(['"]AM['"],\s*s\.productId\)/u);
  assert.match(today, /stepKey\(['"]PM['"],\s*s\.productId\)/u);
  assert.match(today, /routine\.source\s*===\s*['"]real['"]/u);
  assert.match(today, /completionSyncStepIdentity\(key\)\s*===\s*null/u);
  assert.match(today, /timezone\s*===\s*null/u);
  assert.match(today, /['"]COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED['"]/u);
  assert.match(today, /['"]COMPLETION_TIMEZONE_UNAVAILABLE['"]/u);
  assert.match(
    today,
    /remoteSync\s*=\s*\{[\s\S]*?source:\s*['"]real_plan['"],[\s\S]*?timezone,[\s\S]*?stepOrder:\s*context\.stepOrder/u,
  );
  assert.match(today, /toggleCompletion\(key,\s*today,\s*scheduled,\s*remoteSync\)/u);
  assert.match(
    today,
    /result\.completionDayInserted\s*&&\s*\(progress\?\.streak\s*\?\?\s*0\)\s*>=\s*6/u,
  );
});

test('Today publishes success only after persistence and fails closed on unreadable state', () => {
  const store = read(paths.store);
  const today = read(paths.today);
  const todayTest = read(paths.todayTest);

  assert.doesNotMatch(store, /Reads stay fail-soft/u);
  assert.match(today, /completionLoading\s*\|\|\s*completionQuery\.isError/u);
  assert.match(today, /disabled=\{completionUnavailable\s*\|\|\s*completionPendingKey !== null\}/u);
  assertSourceOrder(
    today,
    [
      /const result\s*=\s*await toggleCompletion\(\s*key,\s*today,\s*scheduled,\s*remoteSync\s*\)/u,
      /lease\.assertCurrent\(\)/u,
      /persistenceConfirmed\s*=\s*true/u,
      /qc\.setQueryData\(/u,
      /haptics\.success\(\)/u,
    ],
    'Today persistence-before-success publication',
  );
  assert.match(today, /persistenceConfirmed = true/u);
  assert.match(today, /if \(!persistenceConfirmed\)/u);
  assert.match(today, /qc\.setQueryData\(\[['"]completions['"],\s*today\]/u);
  assert.match(today, /setCompletionActionFailed\(true\)/u);
  assert.match(today, /Reload to confirm your saved progress, then try again\./u);
  assert.match(todayTest, /fails closed when completion history cannot be read or written/u);
});

test('completion replay uses exact dispositions and a durable Shelf dependency barrier', () => {
  const completionSync = read(paths.completionSync);
  const completionQueue = read(paths.completionQueue);
  const completionQueueTest = read(paths.completionQueueTest);
  const shelfMirrorQueue = read(paths.shelfMirrorQueue);
  const offlineSync = read(paths.offlineSync);
  const offlineSyncTest = read(paths.offlineSyncTest);
  const terminalCodeBlock = sourceBetween(
    completionSync,
    'const COMPLETION_SYNC_REMOTE_TERMINAL_CODES',
    'export type CompletionSyncOperation',
    'completion remote terminal codes',
  );
  const responseDecoder = sourceBetween(
    completionQueue,
    'function decodeCompletionRpcResponse',
    'function rpcArguments',
    'completion response decoder',
  );
  const dependencyDeferral = sourceBetween(
    read(paths.store),
    'export async function deferCompletionSyncDependencyOperation',
    '/** Dates with at least one completion',
    'completion dependency deferral',
  );
  const completionRpcArguments = sourceBetween(
    completionQueue,
    'function rpcArguments(operation: CompletionSyncOperation)',
    'type CompletionFlushResult',
    'completion RPC arguments',
  );
  const shelfRpcArguments = sourceBetween(
    shelfMirrorQueue,
    'function rpcArguments(operation: ShelfMirrorOperation)',
    'function shelfMirrorLeaseKey',
    'Shelf RPC arguments',
  );
  const runShelf = sourceBetween(
    offlineSync,
    'const runShelf =',
    'const scheduleCompletionWake',
    'Shelf replay worker',
  );
  const runAll = sourceBetween(
    offlineSync,
    'const run =',
    'const unsubscribeHealthLease',
    'offline worker entry point',
  );
  const completionWake = sourceBetween(
    offlineSync,
    'const unsubscribeCompletions = subscribeCompletionSyncOutboxChanges',
    'const unsubscribeShelf = subscribeShelfMirrorOutboxChanges',
    'completion outbox wake',
  );

  assert.deepEqual([...new Set(quotedValues(terminalCodeBlock))].sort(), [
    'COMPLETION_AFTER_PRODUCT_DELETION',
    'COMPLETION_EVENT_CONFLICT',
    'COMPLETION_IDENTITY_CONFLICT',
    'COMPLETION_REQUEST_INVALID',
  ]);
  assert.match(
    completionSync,
    /return value\s*===\s*['"]COMPLETION_PRODUCT_RETRY_LATER['"]\s*\?\s*value\s*:\s*null/u,
  );
  assert.match(responseDecoder, /keys\.length\s*!==\s*4/u);
  assert.deepEqual(
    [...responseDecoder.matchAll(/value\.status\s*!==\s*['"]([^'"]+)['"]/gu)]
      .map((match) => match[1])
      .sort(),
    ['accepted', 'idempotent', 'retryable', 'terminal'],
  );
  assert.match(
    responseDecoder,
    /status\s*===\s*['"]accepted['"]\s*\|\|\s*status\s*===\s*['"]idempotent['"]/u,
  );
  assert.match(responseDecoder, /if \(value\.code\s*!==\s*null\)/u);
  assert.match(responseDecoder, /retryableCompletionSyncCode\(value\.code\)/u);
  assert.match(responseDecoder, /remoteTerminalCompletionSyncCode\(value\.code\)/u);
  assert.doesNotMatch(completionQueue, /set_routine_adherence_timezone/u);
  assert.match(
    completionQueue,
    /supabase\.rpc\(['"]record_routine_completion['"],\s*rpcArguments\(operation\)\)/u,
  );
  assert.match(
    shelfMirrorQueue,
    /supabase\.rpc\(['"]sync_shelf_product['"],\s*rpcArguments\(operation\)\)/u,
  );
  assert.doesNotMatch(completionQueue, /supabase\.rpc\.bind|as unknown as CompletionRpc/u);
  assert.doesNotMatch(shelfMirrorQueue, /supabase\.rpc\.bind|as unknown as ShelfMirrorRpc/u);
  assert.match(completionQueue, /deferCompletionSyncDependencyOperation\(/u);
  assert.match(completionQueue, /hasUnresolvedTerminalShelfMirrorOperationForProduct\(/u);
  assert.match(dependencyDeferral, /const originalOutbox = \[\.\.\.state\.sync\.outbox\]/u);
  assert.match(dependencyDeferral, /candidate\.kind === ['"]routine_day['"]/u);
  assert.match(dependencyDeferral, /candidate\.routineId === operation\.routineId/u);
  assert.match(dependencyDeferral, /candidate\.completedDate === operation\.completedDate/u);
  assert.match(
    dependencyDeferral,
    /state\.sync\.outbox = \[[\s\S]*?filter\([\s\S]*?!deferredIds\.has[\s\S]*?\.\.\.deferredEventIds/u,
  );
  assert.doesNotMatch(dependencyDeferral, /sync\.terminal\.push|COMPLETION_DEPENDENCY_TERMINAL/u);
  for (const key of [
    'p_event_id',
    'p_routine_id',
    'p_routine_type',
    'p_step_id',
    'p_user_product_id',
    'p_step_order',
    'p_completed_at',
    'p_completed_date',
    'p_timezone',
  ]) {
    assert.match(completionRpcArguments, new RegExp(`\\b${key}:`, 'u'));
  }
  for (const key of [
    'p_operation_id',
    'p_operation_kind',
    'p_enqueued_at',
    'p_product_id',
    'p_payload',
  ]) {
    assert.match(shelfRpcArguments, new RegExp(`\\b${key}:`, 'u'));
  }
  assertSourceOrder(
    runShelf,
    [/flushShelfMirrorQueue\(\)/u, /if \(remaining\s*>\s*0\) return/u, /runCompletions\(\)/u],
    'Shelf must drain before completion replay',
  );
  assert.match(runAll, /runShelf\(\)/u);
  assert.doesNotMatch(runAll, /runCompletions\(\)|flushCompletions\(\)/u);
  assert.match(completionWake, /runShelf\(\)/u);
  assert.doesNotMatch(completionWake, /runCompletions\(\)|flushCompletions\(\)/u);
  assert.match(
    completionQueueTest,
    /fails closed on malformed, foreign-event, or over-shaped success responses/u,
  );
  assert.match(
    completionQueueTest,
    /defers a retryable missing Shelf dependency and drains later unrelated FIFO work/u,
  );
  assert.match(
    completionQueueTest,
    /retains and later replays the original event when Shelf is corrected after the terminal check/u,
  );
  assert.match(
    read(paths.storeTest),
    /atomically defers a missing Shelf dependency and its bound routine-day marker/u,
  );
  assert.match(offlineSyncTest, /drains a newly journaled Shelf operation before completions/u);
  assert.match(
    offlineSyncTest,
    /retries remaining Shelf work with bounded online backoff before completions/u,
  );
  assert.match(offlineSyncTest, /backs off a thrown Shelf flush without starting completions/u);
});

test('future tolerance rows cannot affect today and live clocks cross routine boundaries', () => {
  const progress = read(paths.progress);
  const streak = read(paths.streak);
  const streakTest = read(paths.streakTest);
  const clock = read(paths.clock);
  const clockTest = read(paths.clockTest);

  assert.match(progress, /completedDate > todayISO/u);
  assert.match(progress, /completedDate <= todayISO/u);
  assert.match(progress, /\.is\(['"]step_id['"],\s*null\)/u);
  assert.match(progress, /supabase\.rpc\(['"]set_routine_adherence_timezone['"]/u);
  assert.doesNotMatch(progress, /select\(['"]longest_streak['"]\)/u);
  assert.match(streak, /eligibleCompleted/u);
  assert.match(streak, /!throughDate\s*\|\|\s*day <= throughDate/u);
  assert.match(streakTest, /timezone-tolerance row for tomorrow/u);
  assert.match(clock, /AppState\.addEventListener\(['"]change['"],\s*onAppStateChange\)/u);
  assert.match(clock, /nextState !== ['"]active['"]/u);
  assert.match(clock, /millisecondsUntilNextRoutineBoundary/u);
  assert.match(clockTest, /from AM to PM at 17:00/u);
  assert.match(clockTest, /next local date at midnight/u);
});

test('streak and welcome-back routes do not turn load failures into fake zero or lapse states', () => {
  const streakRoute = read(paths.streakRoute);
  const welcomeBackRoute = read(paths.welcomeBackRoute);

  for (const source of [streakRoute, welcomeBackRoute]) {
    assert.match(source, /if \(!data\)/u);
    assert.match(source, /isError/u);
    assert.match(source, /refetch/u);
  }
  assert.match(streakRoute, /No streak or adherence total is being guessed\./u);
  assert.match(welcomeBackRoute, /won['’]t guess whether your streak is protected or lapsed/u);
});

test('routine milestones describe verified check-offs without outcome claims', () => {
  const copy = read(paths.notificationCopy);

  assert.match(copy, /Seven completed routine nights/u);
  assert.match(copy, /A cycle['’]s worth of routine nights checked off/u);
  assert.match(copy, /Thirty completed routine nights/u);
  assert.doesNotMatch(copy, /progress photos may|paying off|full cycle in/u);
});

test('notification opt-in is exact-time, authorization-aware, local-only, and cap-safe', () => {
  const store = read(paths.notificationStore);
  const defaults = read(paths.notificationDefaults);
  const onboarding = read(paths.notificationOnboarding);
  const route = read(paths.notificationOnboardingRoute);
  const copy = read(paths.notificationCopy);
  const delivery = read(paths.notificationDelivery);
  const ledger = read(paths.notificationLedger);
  const settings = read(paths.notificationSettings);
  const timing = read(paths.notificationTiming);
  const hooks = read(paths.notificationHooks);

  assert.match(store, /amEnabled:\s*false/u);
  assert.match(store, /pmEnabled:\s*false/u);
  assert.match(store, /streakNudges:\s*false/u);
  assert.match(store, /amTime:\s*DEFAULT_ROUTINE_REMINDER_TIMES\.amTime/u);
  assert.match(store, /pmTime:\s*DEFAULT_ROUTINE_REMINDER_TIMES\.pmTime/u);
  assert.match(defaults, /amTime:\s*['"]07:30['"]/u);
  assert.match(defaults, /pmTime:\s*['"]21:30['"]/u);
  assert.doesNotMatch(store, /notification_preferences|supabase/u);

  assert.match(onboarding, /PROPOSED_ROUTINE_REMINDER_TIMES/u);
  assert.match(onboarding, /DEFAULT_ROUTINE_REMINDER_TIMES/u);
  assert.match(onboarding, /amTime:\s*times\.amTime/u);
  assert.match(onboarding, /pmTime:\s*times\.pmTime/u);
  assert.match(onboarding, /isDeliverableAuthorizationState\(outcome\.state\)/u);
  assert.match(copy, /formatReminderTime\(DEFAULT_ROUTINE_REMINDER_TIMES\.amTime\)/u);
  assert.match(copy, /formatReminderTime\(DEFAULT_ROUTINE_REMINDER_TIMES\.pmTime\)/u);
  assert.match(copy, /Use these times/u);
  assert.match(route, /acceptRoutineReminderSoftAsk\(PROPOSED_ROUTINE_REMINDER_TIMES\)/u);
  assert.doesNotMatch(route, /notification_prompt_(?:shown|granted|denied)/u);

  for (const state of [
    'not_determined',
    'denied',
    'authorized',
    'provisional',
    'ephemeral',
    'unavailable',
  ]) {
    assert.match(delivery, new RegExp(`['"]${state}['"]`, 'u'));
  }
  assert.match(delivery, /canAskAgain/u);
  assert.match(delivery, /allowAlert:\s*true/u);
  assert.match(delivery, /allowBadge:\s*false/u);
  assert.match(delivery, /allowSound:\s*false/u);
  assert.match(delivery, /reserveNotificationSlotLocal\(kind,\s*now\)/u);
  assert.doesNotMatch(delivery, /notification_log|from\(['"]notification_/u);
  assert.match(ledger, /export async function reserveNotificationSlotLocal/u);
  assert.match(ledger, /used >= WEEKLY_CAP\[tier\]/u);
  assert.doesNotMatch(ledger, /export async function recordSentLocal/u);
  assert.match(settings, /blocked in/u);
  assert.match(settings, /Open Settings/u);
  assert.match(settings, /openAppSettings/u);
  assert.match(settings, /settingsOpenFailed/u);
  assert.match(settings, /Checking notification access/u);
  assert.match(settings, /Routine pacing suggestions/u);
  assert.match(hooks, /AppState\.addEventListener\(['"]change['"]/u);
  assert.match(hooks, /invalidateQueries\(\{\s*queryKey:\s*AUTHORIZATION_KEY\s*\}\)/u);
  assert.match(hooks, /const state = await getPermissionStatus\(\)/u);
  assert.match(hooks, /await rescheduleReminders\(\)/u);
  assert.match(timing, /Event-triggered suggestions are skipped\./u);
  assert.match(timing, /Trial billing reminders follow the date shown at checkout\./u);
});

test('database adherence and atomic Shelf/completion sync remain server-owned at head 0077', () => {
  const migration = read(paths.adherenceMigration);
  const dbTest = read(paths.adherenceDbTest);
  const syncBridgeMigration = read(paths.syncBridgeMigration);
  const syncBridgeDbTest = read(paths.syncBridgeDbTest);
  const databaseTypes = read(paths.databaseTypes);
  const schemaContract = read(paths.schemaContract);

  assert.match(migration, /private\.routine_adherence_timezone_is_valid/u);
  assert.match(migration, /completions\.step_id is null/u);
  assert.match(migration, /private\.project_routine_adherence/u);
  assert.match(migration, /ROUTINE_ADHERENCE_CACHE_SERVER_OWNED/u);
  assert.match(migration, /ROUTINE_ADHERENCE_FREEZE_SERVER_OWNED/u);
  assert.match(migration, /drop policy if exists "streak_freezes_insert_own"/u);
  assert.match(migration, /public\.set_routine_adherence_timezone/u);
  assert.match(migration, /public\.refresh_routine_adherence/u);
  assert.match(migration, /referencing new table as inserted_routine_completions/u);
  assert.match(migration, /referencing old table as deleted_routine_completions/u);
  assert.match(migration, /clear_routine_adherence_on_withdrawal/u);

  assert.match(dbTest, /select plan\(78\)/u);
  assert.match(
    dbTest,
    /CORE05_PARITY_CORPUS_SHA256: cbcfe0a13f1ef878f8769c875e9fb5b49fdcf667e723b4d918bc46889144fa00/u,
  );
  assert.match(dbTest, /the hashed parity corpus matches the authoritative SQL projection/u);
  assert.match(dbTest, /two separated misses consume the total two-freeze budget/u);
  assert.match(dbTest, /a partial step completion cannot affect adherence/u);
  assert.match(dbTest, /an authenticated owner cannot directly insert a freeze/u);
  assert.match(
    dbTest,
    /deletion clears current\/freeze state without shrinking the personal best/u,
  );
  assert.match(syncBridgeMigration, /public\.sync_shelf_product\(/u);
  assert.match(syncBridgeMigration, /public\.record_routine_completion\(/u);
  assert.match(syncBridgeMigration, /public\.export_shelf_product_identities_for_subject\(/u);
  assert.match(syncBridgeMigration, /public\.export_shelf_sync_receipts_for_subject\(/u);
  assert.match(
    syncBridgeMigration,
    /public\.export_routine_completion_sync_receipts_for_subject\(/u,
  );
  assert.match(syncBridgeMigration, /HEALTH_SYNC_EXPORT_NONACTIVE_RESIDUE/u);
  assert.match(syncBridgeMigration, /create table public\.shelf_product_identities/u);
  assert.match(syncBridgeMigration, /COMPLETION_PRODUCT_RETRY_LATER/u);
  assert.doesNotMatch(syncBridgeMigration, /COMPLETION_DEPENDENCY_TERMINAL/u);
  assert.match(syncBridgeDbTest, /exact 93-migration source history/u);
  assert.match(syncBridgeDbTest, /semantic-conflict rejection cannot mutate adherence authority/u);
  assert.match(
    syncBridgeDbTest,
    /Shelf sync rejects an exact draft-blocked health grant before retention/u,
  );
  assert.match(
    syncBridgeDbTest,
    /completion sync rejects a formerly active epoch after its exact grant closes/u,
  );
  assert.match(
    syncBridgeDbTest,
    /withdrawn lifecycle fails closed if a sealed source has synthetic residue/u,
  );
  assert.match(
    syncBridgeDbTest,
    /zero-attestation proves stable identities and all relational health data erased/u,
  );
  assert.match(schemaContract, /\b93::bigint\b/u);
  assert.match(schemaContract, /'20260926000077'::text/u);
  assert.match(databaseTypes, /shelf_product_identities:\s*\{/u);
  const exportShelfIdentities = generatedFunctionBlock(
    databaseTypes,
    'export_shelf_product_identities_for_subject',
  );
  assertGeneratedObjectShape(exportShelfIdentities, 'Args', {
    p_after_created_at: 'string',
    p_after_id: 'string',
    p_limit: 'number',
  });
  assertGeneratedObjectShape(exportShelfIdentities, 'Returns', {
    created_at: 'string',
    deleted_effective_at: 'string',
    deleted_received_at: 'string',
    export_total_count: 'number',
    id: 'string',
    user_id: 'string',
  });

  const exportShelfReceipts = generatedFunctionBlock(
    databaseTypes,
    'export_shelf_sync_receipts_for_subject',
  );
  assertGeneratedObjectShape(exportShelfReceipts, 'Args', {
    p_after_created_at: 'string',
    p_after_id: 'string',
    p_limit: 'number',
  });
  assertGeneratedObjectShape(exportShelfReceipts, 'Returns', {
    created_at: 'string',
    export_total_count: 'number',
    finalized_at: 'string',
    operation_id: 'string',
    result_code: 'string',
    state: 'string',
    user_id: 'string',
  });

  const exportCompletionReceipts = generatedFunctionBlock(
    databaseTypes,
    'export_routine_completion_sync_receipts_for_subject',
  );
  assertGeneratedObjectShape(exportCompletionReceipts, 'Args', {
    p_after_created_at: 'string',
    p_after_id: 'string',
    p_limit: 'number',
  });
  assertGeneratedObjectShape(exportCompletionReceipts, 'Returns', {
    created_at: 'string',
    event_id: 'string',
    export_total_count: 'number',
    finalized_at: 'string',
    result_code: 'string',
    state: 'string',
    user_id: 'string',
  });

  const syncShelfProduct = generatedFunctionBlock(databaseTypes, 'sync_shelf_product');
  assertGeneratedObjectShape(syncShelfProduct, 'Args', {
    p_enqueued_at: 'string',
    p_operation_id: 'string',
    p_operation_kind: 'string',
    p_payload: 'Json',
    p_product_id: 'string',
  });
  assertGeneratedScalarReturn(syncShelfProduct, 'Json');

  const recordRoutineCompletion = generatedFunctionBlock(
    databaseTypes,
    'record_routine_completion',
  );
  assertGeneratedObjectShape(recordRoutineCompletion, 'Args', {
    p_completed_at: 'string',
    p_completed_date: 'string',
    p_event_id: 'string',
    p_routine_id: 'string',
    p_routine_type: 'string',
    p_step_id: 'string',
    p_step_order: 'number',
    p_timezone: 'string',
    p_user_product_id: 'string',
  });
  assertGeneratedScalarReturn(recordRoutineCompletion, 'Json');
});

test('the hashed corpus executes the actual client streak implementation and binds SQL parity', async () => {
  const corpus = JSON.parse(read(paths.adherenceParityCorpus));
  const dbTest = read(paths.adherenceDbTest);
  const corpusHash = createHash('sha256').update(JSON.stringify(corpus)).digest('hex');

  assert.equal(corpus.schemaVersion, 1);
  assert.equal(corpus.canonicalFrozenDateOrder, 'newest_to_oldest');
  assert.equal(corpus.cases.length, 9);
  assert.equal(corpusHash, 'cbcfe0a13f1ef878f8769c875e9fb5b49fdcf667e723b4d918bc46889144fa00');
  assert.match(dbTest, new RegExp(`CORE05_PARITY_CORPUS_SHA256: ${corpusHash}`, 'u'));
  assert.equal(
    dbTest.split(JSON.stringify(corpus)).length - 1,
    2,
    'pgTAP actual and expected queries must both consume the exact hashed JSON bytes',
  );

  const client = await import(pathToFileURL(resolve(root, paths.streak)).href);
  for (const parityCase of corpus.cases) {
    const completedDates =
      parityCase.completedDates ?? expandIsoDateRange(parityCase.completedDateRange);
    const completed = new Set(completedDates);
    const actual = client.streakState(completed, parityCase.referenceDay, 2);
    assert.deepEqual(
      actual,
      {
        current: parityCase.expected.current,
        freezeActive: parityCase.expected.frozenDates.length > 0,
        frozenDates: parityCase.expected.frozenDates,
        lapsed: parityCase.expected.lapsed,
      },
      `${parityCase.id}: actual streakState must match the shared corpus`,
    );
    assert.equal(
      client.bestStreak(completed, 2, parityCase.referenceDay),
      parityCase.expected.best,
      `${parityCase.id}: actual bestStreak must match the shared corpus`,
    );
  }
});

test('completion records remain registered for cleanup/export and this contract is mandatory', () => {
  const cleanup = read(paths.cleanup);
  const localExport = read(paths.localExport);
  const completionQueue = read(paths.completionQueue);
  for (const key of [
    'layerwell.completions.v1',
    'layerwell.completions.firstCompletion.v1',
    'layerwell.completions.pending',
  ]) {
    assert.match(cleanup, new RegExp(key.replaceAll('.', '\\.'), 'u'));
    assert.match(localExport, new RegExp(key.replaceAll('.', '\\.'), 'u'));
  }
  const completionFlush = sourceBetween(
    completionQueue,
    'async function runCompletionFlush',
    '/**\n * Single-flight FIFO replay',
    'completion replay cleanup',
  );
  assert.match(completionFlush, /getPendingCompletionSyncOperations\(\)/u);
  assert.doesNotMatch(
    completionQueue,
    /removePrivateItem|LEGACY_COMPLETION_QUEUE_KEY|layerwell\.completions\.pending/u,
    'completion replay must preserve and never read the exportable legacy quarantine',
  );
  assert.doesNotMatch(
    completionFlush,
    /getPrivateItem\(\s*LEGACY_COMPLETION_QUEUE_KEY|JSON\.parse\([^)]*LEGACY_COMPLETION_QUEUE_KEY/u,
  );
  assert.match(
    localExport,
    /key:\s*['"]layerwell\.completions\.pending['"][\s\S]*?field:\s*['"]legacy_pending_completion_sync['"]/u,
  );
  assert.match(
    localExport,
    /const REDACTED_LOCAL_FIELD_NAMES\s*=\s*new Set\(\[[\s\S]*?['"]ownerUserId['"]/u,
  );
  assert.match(
    localExport,
    /sections\[spec\.section\]\[spec\.field\]\s*=\s*redactLocalFields\(exportValue\)/u,
  );

  const packageJson = JSON.parse(read(paths.packageJson));
  assert.equal(
    packageJson.scripts['core05:adherence-source-contract:test'],
    'node --test scripts/core05/adherence-source-contract.test.mjs',
  );
  for (const parentScript of ['phase3:verify', 'launch:verify']) {
    const commands = String(packageJson.scripts[parentScript] ?? '').split(' && ');
    assert.ok(
      commands.includes('npm run core05:adherence-source-contract:test'),
      `${parentScript} must run the CORE-05 adherence contract as a blocking gate`,
    );
  }
});
