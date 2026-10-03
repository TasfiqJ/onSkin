import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Today route mobile contracts', () => {
  it('keeps the home summary and streak control comfortably tappable on phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');
    const header = readFileSync(
      fileURLToPath(new URL('../../components/ui/TodayFocusHeader.tsx', import.meta.url)),
      'utf8',
    );

    expect(source).toContain('<TodayFocusHeader');
    expect(source).toContain('streakDays={progress?.streak ?? 0}');
    expect(header).toContain('accessibilityLabel="View your streak and adherence"');
    expect(header).toContain("router.push('/routine/streak')");
    expect(header).toContain("streakDays === 1 ? 'day' : 'days'");
    expect(header).toContain('min-h-[48px]');
    expect(header).toContain('rounded-pill');
    expect(header).toContain('accessibilityRole="progressbar"');
  });

  it('keeps Today actions clear while using the status-first home hierarchy', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain(
      "import { Button, Screen, Text, TodayFocusHeader } from '@/components/ui';",
    );
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPhone = height < 700');
    expect(source).toContain('const compactRecommendationPrompt = height < 860');
    expect(source).toContain('const shortEmptyRoutine = compactPhone && height < 600;');
    expect(source).toContain('const showRecommendations = hasRealRoutine && height >= 500;');
    expect(source).toContain('const showTonightTeaser =');
    expect(source).toContain('(cadenceWithheldCount === 0 || height >= 932);');
    expect(source).toContain('function EmptyRoutineCard');
    expect(source).toContain('Build a routine from your shelf.');
    expect(source).toContain('label="Add products"');
    expect(source).toContain("router.push('/shelf/manual')");
    expect(source).toContain(
      "import { projectTodayRoutine } from '@/features/today/routineProjection';",
    );
    expect(source).toContain(
      'const routine = projectTodayRoutine({ planData, cycleData, completedStepKeys: done });',
    );
    expect(source).toContain('hasExamplePlan,');
    expect(source).toContain('hasRealRoutine,');
    expect(source).toContain('safetyExclusionCount,');
    expect(source).toContain('cadenceWithheldCount,');
    expect(source).toContain('sequencingWithheldCount,');
    expect(source).toContain('function CadenceWithheldNotice');
    expect(source).toContain('function SequencingWithheldNotice');
    expect(source).toContain('Review pregnancy and breastfeeding setting');
    expect(source).toContain("contentContainerClassName={compactPhone ? 'pb-28' : 'pb-6'}");
    expect(source).toContain('<ReverseTrialBanner compact={compactPhone} />');
    expect(source).toContain('<ReverseTrialBanner compact={compactPhone} tone="night" />');
    expect(source.match(/<TodayFocusHeader/g)).toHaveLength(2);
    expect(source).toContain('phase="AM"');
    expect(source).toContain('phase="PM"');
    expect(source).toContain('total={steps.length}');
    expect(source).toContain('completed={doneCount}');
    expect(source).toContain('total={pmSteps.length}');
    expect(source).toContain('completed={donePm}');
    expect(source).toContain('const nameLineCount = compact ? 2 : undefined;');
    expect(source).toContain('const subLineCount = compact ? 2 : undefined;');
    expect(source).toContain(
      '<RecommendationsTeaser compact={compactRecommendationPrompt} showGapPrompt />',
    );
    expect(source).toContain('{showRecommendations ? (');
    expect(source).toContain('phase7Flags.cloudAsk && !compactPhone');
    expect(source).toContain('{showTonightTeaser ? (');
  });

  it('keeps PM cycle strip labels legible only when a real cycle exists', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).not.toContain('FALLBACK_SLOTS');
    expect(source).toContain(
      'function cycleStripLabel(slot: SchedulerSlot, compact: boolean): string',
    );
    expect(source).toContain("if (slot === 'exfoliate') return 'Exfol\\niate';");
    expect(source).toContain("if (slot === 'retinoid') return 'Retin\\noid';");
    expect(source).toContain("if (slot === 'recover') return 'Reco\\nver';");
    expect(source).toContain('const { height, width } = useWindowDimensions();');
    expect(source).toContain('const compactCycleStrip = compactPhone || width < 430;');
    expect(source).toContain(
      'const { nightNumber, nightTotal, suppressedAcidName, nextAcidISO } = routine;',
    );
    expect(source).toContain('const label = cycleStripLabel(n.slot, compactCycleStrip);');
    expect(source).toContain('const accessibilityLabel = slotLabel(n.slot);');
    expect(source).toContain('{cycle ? (');
    expect(source).toContain('cycleStripNights,');
    expect(source).toContain('cycleStripNights.map((n, i) =>');
    expect(source).toContain('const active = i === 0;');
    expect(source).not.toContain('cycle.nights.map((n, i) =>');
    expect(source).toContain('No evening steps yet.');
    expect(source).toContain('Add a cleanser, moisturiser, or night product to build this out.');
    expect(source).toContain('maxFontSizeMultiplier={1.08}');
    expect(source).toContain('accessibilityLabel={accessibilityLabel}');
    expect(source).toContain('numberOfLines={compactCycleStrip ? 2 : 1}');
    expect(source).toContain('<View className="flex-row gap-1">');
    expect(source).toContain('fontSize: compactCycleStrip ? 10.5 : 12');
    expect(source).toContain('lineHeight: compactCycleStrip ? 11 : 15');
    expect(source).toContain('marginTop: compactCycleStrip ? 7 : 8');
    expect(source).toContain("textAlign: 'center'");
    expect(source).not.toContain('adjustsFontSizeToFit');
    expect(source).not.toContain('minimumFontScale={0.85}');
    expect(source).not.toContain('className="mt-2 text-center text-[10.5px]"');
  });

  it('tracks cycle-night completion from the PM local-first check-off path only', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain(
      "import { shouldTrackCycleNightCompleted } from '@/features/today/cycleCompletion';",
    );
    expect(source).toContain("track('routine_checkoff_completed', { moment });");
    expect(source).toContain("track('first_checkoff_completed', { moment });");
    expect(source).toContain('if (result.inserted && completionViewCurrent()) {');
    expect(source).toContain('shouldTrackCycleNightCompleted({');
    expect(source).toContain('completedStepKeysAfter: result.completedStepKeysAfter');
    expect(source).toContain('completedKey: key');
    expect(source).toContain("phase: 'PM'");
    expect(source).toContain('cycleActive: routine.cycleActive');
    expect(source).toContain('stepKeys: pmStepKeys');
    expect(source).toContain('completionInserted: result.inserted');
    expect(source).not.toContain('completedBefore: done');
    expect(source).toContain('if (result.completionDayInserted && (progress?.streak ?? 0) >= 6) {');
    expect(source).toContain('reviewMomentEarned = completionViewCurrent()');
    expect(source).toContain(
      "void requestReviewAfterValue('seven_checkoff_days').catch(() => undefined)",
    );
    expect(source.indexOf('setCompletionPendingKey(null)')).toBeLessThan(
      source.indexOf("requestReviewAfterValue('seven_checkoff_days')"),
    );
    expect(source).toContain(
      'const result = await toggleCompletion(key, today, scheduled, remoteSync)',
    );
    expect(source).toContain("routine.source === 'real'");
    expect(source).toContain('completionSyncStepIdentity(key) === null');
    expect(source).toContain("'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED'");
    expect(source).toContain("'COMPLETION_TIMEZONE_UNAVAILABLE'");
    expect(source).toContain('queryKey: completionUnsyncedQueryKey');
    expect(source).toContain('Your local export keeps this evidence.');
    expect(source).toContain("source: 'real_plan'");
    expect(source).toContain('stepOrder: context.stepOrder');
    expect(source).toContain("track('cycle_night_completed', { moment: 'pm', source: 'today' })");
    const eventIndex = source.indexOf("track('cycle_night_completed'");
    const eventCall = source.slice(eventIndex, eventIndex + 120);
    expect(eventCall).not.toMatch(/product|slot|step|skin|goal/i);
  });

  it('fails closed when completion history cannot be read or written', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain('const completionUnavailable =');
    expect(source).toContain('completionLoading || completionQuery.isError');
    expect(source).toContain('disabled={completionUnavailable || completionPendingKey !== null}');
    expect(source).toContain("Check-offs aren't available right now.");
    expect(source).toContain('Reload to confirm your saved progress, then try again.');
    expect(source).toContain(
      'const result = await toggleCompletion(key, today, scheduled, remoteSync)',
    );
    expect(source).toContain('persistenceConfirmed = true');
    expect(source).toContain('qc.setQueryData(completionQueryKey');
    expect(source).toContain('haptics.success()');
    expect(
      source.indexOf('const result = await toggleCompletion(key, today, scheduled, remoteSync)'),
    ).toBeLessThan(source.indexOf('haptics.success()'));
    expect(source).toContain('setCompletionActionFailed(true)');
    expect(source).toContain('completionSyncUnsyncedQuery.isError || completionActionFailed');
    expect(source).toContain('!actionState.begin(key)');
    expect(source).toContain("networkMode: 'always'");
    expect(source).toContain('runWithCompletionLease(completionLease');
    expect(source).toContain('await cancelCompletionReads()');
    expect(source).toContain('if (reviewMomentEarned && completionReadsConfirmed && completionViewCurrent())');
    expect(source.indexOf('if (completionUnavailable) {')).toBeLessThan(
      source.indexOf('total={steps.length}'),
    );
    const retry = source.slice(source.indexOf('async function retryCompletions()'),
      source.indexOf('async function handleCompletionSyncUnavailable()'));
    expect(retry.indexOf('getCompletedSteps(readDate)')).toBeLessThan(
      retry.indexOf('setCompletionActionFailed(false)'),
    );
    expect(retry).not.toContain('haptics.success');
    expect(source).toContain('completionStorageKey = JSON.stringify(scope)');
    expect(source).toContain('actionState.storageKey !== completionStorageKey');
    expect(source).toContain('staleTime: 0');
    const viewGuardStart = source.indexOf('function completionViewCurrent()');
    const viewGuardEnd = source.indexOf('function assertCompletionViewCurrent()', viewGuardStart);
    expect(viewGuardStart).toBeGreaterThanOrEqual(0);
    expect(viewGuardEnd).toBeGreaterThan(viewGuardStart);
    const viewGuard = source.slice(viewGuardStart, viewGuardEnd);
    expect(viewGuard).toContain('planSource.isSourceCurrent()');
    expect(viewGuard).toContain('completionView.isActive()');
    expect(viewGuard).toContain('completionDateScopeCurrent()');
    expect(viewGuard).toContain('currentRoutineType() === type');
    const storageGuard = source.slice(source.indexOf('function completionStorageScopeCurrent()'),
      source.indexOf('function assertCompletionStorageScopeCurrent()'));
    expect(storageGuard).toContain('assertHealthDataWriteLease(completionLease)');
    expect(storageGuard).not.toContain('localDateString');
    expect(storageGuard).not.toContain('currentRoutineType');
    expect(source).toContain('return completionStorageScopeCurrent() && localDateString() === date');
    const mutation = source.slice(source.indexOf('async function handleCompletion('),
      source.indexOf('async function retryCompletions()'));
    expect(mutation).toContain('if (!completionStorageScopeCurrent()) return');
    const settlement = mutation.slice(mutation.indexOf('const result = await toggleCompletion'));
    expect(settlement.indexOf('assertCompletionStorageScopeCurrent()')).toBeLessThan(
      settlement.indexOf('persistenceConfirmed = true'),
    );
    expect(settlement).toContain('if (completionView.isActive() && completionDateScopeCurrent())');
    expect(settlement).toContain('await refreshCompletionReads()');
    expect(settlement).toContain('else if (!completionReadsConfirmed)');
    expect(retry).toContain('if (completionStorageScopeCurrent()) setCompletionActionFailed(true)');
    expect(retry).toContain('if (!completionDateScopeCurrent(readDate)) continue');
    expect(source).toContain('const actionState = completionActionStateForLease(completionLease)');
    expect(source).toContain('useSyncExternalStore(');
    expect(source).toContain('actionState.subscribe, actionState.getSnapshot, actionState.getSnapshot');
    expect(source).toContain('completionView.isActive() && completionDateScopeCurrent()');
    expect(source).toContain('return () => { completionView.deactivate(); }');
    expect(source).not.toContain('renderCompletionState');
    expect(source).not.toContain('actionState.deactivate');
    expect(source).not.toContain('actionState.activate');
    expect(source).not.toContain('setActionState');
    expect(storageGuard).not.toContain('completionView');
    const refresh = source.slice(source.indexOf('async function refreshCompletionReads()'),
      source.indexOf('const hasCompletionIdentityRepair'));
    expect(refresh.indexOf('await cancelCompletionReads()')).toBeLessThan(
      refresh.indexOf('await qc.invalidateQueries'),
    );
    expect(refresh).toContain('predicate: completionQueryInStorageScope');
    expect(refresh).toContain('throwOnError: true');
    expect(source).toContain('if (!persistenceConfirmed)');
    expect(source).not.toContain('onPress={() => void toggle(k)}');
  });

  it('keeps the visible date, clock, and AM/PM phase live across foreground boundaries', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain("import { useRoutineClock } from '@/features/today/useRoutineClock';");
    expect(source).toContain('const clock = useRoutineClock({ includeMinuteUpdates: true })');
    expect(source).toContain('const type = clock.phase');
    expect(source).toContain('const today = clock.localDate');
    expect(source).toContain('const dateLabel = clock.now.toLocaleDateString');
    expect(source).toContain('const clockLabel = clock.clockLabel');
    expect(source).not.toContain('const type = currentRoutineType()');
  });
});
