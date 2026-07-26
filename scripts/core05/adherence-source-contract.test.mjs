#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const paths = Object.freeze({
  packageJson: 'package.json',
  store: 'apps/mobile/src/features/today/completionsStore.ts',
  storeTest: 'apps/mobile/src/features/today/completionsStore.test.ts',
  today: 'apps/mobile/src/app/(tabs)/today.tsx',
  todayTest: 'apps/mobile/src/features/today/todayRoute.test.ts',
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
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

test('completion state is strict, versioned, and never invents legacy adherence', () => {
  const store = read(paths.store);
  const storeTest = read(paths.storeTest);

  assert.match(store, /const SCHEMA_VERSION = 2 as const/u);
  assert.match(store, /Object\.keys\(parsed\)\.length !== 3/u);
  assert.match(store, /normalizeCompletionLog\(parsed\.days,\s*true\)/u);
  assert.match(store, /completedDays:\s*new Set\(\)/u);
  assert.match(store, /normalizedDate !== entry/u);
  assert.match(store, /out\.has\(normalizedDate\)/u);
  assert.match(store, /key\.startsWith\(['"]PM:['"]\)/u);
  assert.match(storeTest, /does not invent adherence from AM, partial PM, or legacy step rows/u);
  assert.match(storeTest, /rejects non-canonical current envelopes without rewriting their bytes/u);
});

test('only a complete projected PM or recovery routine creates an adherence day', () => {
  const store = read(paths.store);
  const storeTest = read(paths.storeTest);
  const today = read(paths.today);

  assert.match(store, /export type ScheduledCompletionContext/u);
  assert.match(store, /scheduledStepKeys\.every\(\(step\)\s*=>\s*day\.has\(step\)\)/u);
  assert.match(
    store,
    /completionDayInserted:\s*completedScheduledRoutine\s*&&\s*!alreadyCompletedDay/u,
  );
  assert.match(store, /for \(const date of log\.completedDays\) completedDates\.add\(date\)/u);
  assert.match(
    storeTest,
    /records exactly one adherence day only after every scheduled PM step is durable/u,
  );
  assert.match(today, /toggleCompletion\(key,\s*today,\s*scheduled\)/u);
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
  const persistIndex = today.indexOf(
    'const result = await toggleCompletion(key, today, scheduled)',
  );
  const hapticIndex = today.indexOf('haptics.success()', persistIndex);
  assert.ok(persistIndex >= 0 && hapticIndex > persistIndex);
  assert.match(today, /persistenceConfirmed = true/u);
  assert.match(today, /if \(!persistenceConfirmed\)/u);
  assert.match(today, /qc\.setQueryData\(\[['"]completions['"],\s*today\]/u);
  assert.match(today, /setCompletionActionFailed\(true\)/u);
  assert.match(today, /Reload to confirm your saved progress, then try again\./u);
  assert.match(todayTest, /fails closed when completion history cannot be read or written/u);
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

test('completion records remain registered for cleanup/export and this contract is mandatory', () => {
  const cleanup = read(paths.cleanup);
  const localExport = read(paths.localExport);
  for (const key of [
    'onskin.completions.v1',
    'onskin.completions.firstCompletion.v1',
    'onskin.completions.pending',
  ]) {
    assert.match(cleanup, new RegExp(key.replaceAll('.', '\\.'), 'u'));
    assert.match(localExport, new RegExp(key.replaceAll('.', '\\.'), 'u'));
  }

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
