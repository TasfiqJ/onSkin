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
  adherenceParityCorpus: 'scripts/core05/adherence-parity-corpus.json',
  schemaContract: 'supabase/tests/database/schema_contract.test.sql',
  notificationHooks: 'apps/mobile/src/features/notifications/useNotifications.ts',
});

function read(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
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

test('database adherence is exact-time, marker-only, and server-owned at head 0068', () => {
  const migration = read(paths.adherenceMigration);
  const dbTest = read(paths.adherenceDbTest);
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
  assert.match(dbTest, /deletion clears current\/freeze state without shrinking the personal best/u);
  assert.match(schemaContract, /\b67::bigint\b/u);
  assert.match(schemaContract, /'20260726000068'::text/u);
});

test('the hashed corpus executes the actual client streak implementation and binds SQL parity', async () => {
  const corpus = JSON.parse(read(paths.adherenceParityCorpus));
  const dbTest = read(paths.adherenceDbTest);
  const corpusHash = createHash('sha256')
    .update(JSON.stringify(corpus))
    .digest('hex');

  assert.equal(corpus.schemaVersion, 1);
  assert.equal(corpus.canonicalFrozenDateOrder, 'newest_to_oldest');
  assert.equal(corpus.cases.length, 9);
  assert.equal(
    corpusHash,
    'cbcfe0a13f1ef878f8769c875e9fb5b49fdcf667e723b4d918bc46889144fa00',
  );
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
