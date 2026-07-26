import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('cycle week route scheduler notes', () => {
  it('opens the why-this-night sheet for every projected cycle row', () => {
    const source = readAppRoute('cycle/week.tsx');
    const whyTonight = readAppRoute('cycle/why-tonight.tsx');
    const useCycle = readFileSync(`${APP_DIR}/../features/scheduler/useCycle.ts`, 'utf8');
    const projection = readFileSync(`${APP_DIR}/../features/scheduler/projection.ts`, 'utf8');

    expect(source).toContain("pathname: '/cycle/why-tonight'");
    expect(source).toContain('params: { date: p.dateISO }');
    expect(source).toContain('const cycleNightNumber = p.night.index + 1;');
    expect(source).toContain('const cycleNightLabel = formatCycleNightLabel(cycleNightNumber);');
    expect(source).toContain('function formatCycleNightLabel(cycleNightNumber: number): string');
    expect(source).toContain('return `Night ${cycleNightNumber}`;');
    expect(source).toContain('cycle night ${cycleNightNumber} of ${cycle.lengthNights}');
    expect(source).toContain('{cycleNightLabel}');
    expect(source).not.toContain('`N${cycleNightNumber}`');
    expect(source).not.toContain('N{i + 1}');
    expect(source).not.toContain('${p.weekday}: ${slotLabel(p.night.slot)} night${tonight');
    expect(source).not.toContain("if (tonight) router.push('/cycle/why-tonight');");
    expect(useCycle).toContain('const week = cycle ? weekAhead(cycle, anchor, today) : [];');
    expect(useCycle).not.toContain('weekAhead(cycle, anchor, today, 4)');
    expect(projection).toContain('days = 6');

    expect(whyTonight).toContain('useLocalSearchParams');
    expect(whyTonight).toContain('DATE_PARAM_RE');
    expect(whyTonight).toContain('const selectedDate = params.date');
    expect(whyTonight).toContain('weekAhead.find((p) => p.dateISO === selectedDate)');
    expect(whyTonight).toContain("isTonight ? 'WHY THIS, TONIGHT?' : 'WHY THIS NIGHT?'");
    expect(whyTonight).toContain(
      'slotTitle(selectedNight.night.slot, isTonight, selectedNight.weekday)',
    );
  });

  it('only exposes phased-introduction scheduler notes as tappable controls', () => {
    const source = readAppRoute('cycle/week.tsx');

    expect(source).toContain('function SchedulerNote');
    expect(source).toContain('const opensPhasedIntro = /add your/i.test(note);');
    expect(source).toContain('if (opensPhasedIntro)');
    expect(source).toContain('accessibilityLabel="Review phased introduction"');
    expect(source).toContain("router.push('/cycle/phased-intro')");
    expect(source).toContain(
      'mt-4 min-h-[48px] flex-row items-center gap-3 rounded-[18px] px-4 py-3',
    );
    expect(source).not.toContain(
      'mt-4 min-h-[44px] flex-row items-center gap-3 rounded-[18px] px-4 py-3',
    );
    expect(source).toContain('<View className="mt-4 flex-row items-start');
    expect(source).not.toContain('if (/add your/i.test(data!.notes[0]!))');
    expect(source).not.toContain('{data!.notes[0]}');
  });

  it('keeps cycle week text actions buffered above sub-pixel phone targets', () => {
    const source = readAppRoute('cycle/week.tsx');

    expect(source).toContain(
      'className="min-h-[48px] min-w-[48px] items-center justify-center px-2"',
    );
    expect(source).toContain('className="mt-6 min-h-[48px] items-center justify-center py-2"');
    expect(source).not.toContain(
      'className="min-h-[44px] min-w-[44px] items-center justify-center px-2"',
    );
    expect(source).not.toContain('className="mt-6 min-h-[44px] items-center justify-center py-2"');
  });

  it('keeps phased-intro actions visible on the shortest phone sheet', () => {
    const source = readAppRoute('cycle/phased-intro.tsx');

    expect(source).toContain('const shortSheet = height < 520;');
    expect(source).toContain("shortSheet ? 'px-5 pb-3 pt-3' : compactSheet ? 'pb-6' : undefined");
    expect(source).toContain("'text-[25px] leading-[27px]'");
    expect(source).toContain("shortSheet ? 'mt-3' : compactSheet ? 'mt-4' : 'mt-6'");
    expect(source).toContain('short={shortSheet}');
    expect(source).toContain(
      "shortSheet ? 'mt-1 py-0' : compactSheet ? 'min-h-[48px] py-3' : undefined",
    );
    expect(source).toContain(
      'style={shortSheet ? { height: 48, minHeight: 48, paddingVertical: 0 } : undefined}',
    );
    expect(source).toContain("'min-h-[48px]'");
    expect(source).not.toContain("className={compactSheet ? 'pb-6' : undefined}");
  });

  it('uses the complete tap-based authored-cycle transaction instead of deferred drag copy', () => {
    const source = readAppRoute('cycle/settings.tsx');

    expect(source).toContain('Scheduled');
    expect(source).toContain("{ id: 'custom', label: 'Custom', sub: 'Your night plan' }");
    expect(source).toContain('Cycle length');
    expect(source).toContain('Active frequency');
    expect(source).toContain('Night assignments');
    expect(source).toContain("label={saving ? 'Saving cycle...' : 'Save cycle'}");
    expect(source).toContain(
      "await mutations.saveCustom(customCycle, baselineVariant !== 'custom');",
    );
    expect(source).toContain('pruneMissingCustomCycleProducts');
    expect(source).toContain('accessibilityLabel={`${variant.label}. ${sub}`}');
    expect(source).toContain('<SettingsHeader disabled={saving} />');
    expect(source).toContain('usePreventRemove(saving, () => undefined);');
    expect(source).toContain('const guardArmed = new Promise<void>');
    expect(source).toContain('await guardArmed;');
    expect(source).toContain('window.history.pushState(');
    expect(source).toContain("window.addEventListener('popstate', onPopState, { capture: true });");
    expect(source).toContain('event.stopImmediatePropagation();');
    expect(source).toContain('window.history.forward();');
    expect(source).toContain("browserNavigation?.addEventListener('navigate', onNavigate);");
    expect(source).toContain('await disarmPendingExit.current();');
    expect(source).toContain('if (exitAfterCommit) backOrReplace(router);');
    expect(source).toContain('const saveDisabled = saving || !hasChanges;');
    expect(source).toContain('active.staged && selectedDraftIds.has(active.id)');
    expect(source).toContain('Your saved nights stay intact.');
    expect(source).toContain('dismissDisabled={disabled}');
    expect(source).not.toContain("{ id: 'classic', label: 'Classic', sub: '4 nights' }");
    expect(source).not.toContain('Drag-to-reassign');
    expect(source).not.toContain('arrives with the reorder gesture');
    expect(source).not.toContain('B-DRAG-DND');
    expect(source).not.toContain('gap-[3px]');
  });

  it('keeps cycle settings night labels one-based like the week overview', () => {
    const source = readAppRoute('cycle/settings.tsx');

    expect(source).toContain('Night ${index + 1}');
    expect(source).toContain('Night ${index + 1}. ${assignment}. Change assignment');
    expect(source).toContain('<Text variant="titleSm">Night {index + 1}</Text>');
    expect(source).not.toMatch(/>N\{index/);
    expect(source).not.toContain('N{night.index}');
  });

  it('keeps the procedure recovery CTA buffered on compact phones', () => {
    const source = readAppRoute('cycle/procedure.tsx');

    expect(source).toContain('contentContainerClassName="pb-10"');
    expect(source).toContain('<View className="bg-paper pb-4 pt-3">');
    expect(source).toContain('<Button');
    expect(source.indexOf('<View className="bg-paper pb-4 pt-3">')).toBeLessThan(
      source.indexOf("'Start recovery'"),
    );
  });

  it('persists cycle mutations before cache, analytics, navigation, or success copy', () => {
    const store = readFileSync(`${APP_DIR}/../features/scheduler/cycleStore.ts`, 'utf8');
    const useCycle = readFileSync(`${APP_DIR}/../features/scheduler/useCycle.ts`, 'utf8');
    const disruption = readAppRoute('cycle/disruption.tsx');
    const procedure = readAppRoute('cycle/procedure.tsx');
    const recovery = readAppRoute('cycle/recovery.tsx');
    const phasedIntro = readAppRoute('cycle/phased-intro.tsx');
    const settings = readAppRoute('cycle/settings.tsx');
    const today = readAppRoute('(tabs)/today.tsx');
    const plan = readAppRoute('routine/plan.tsx');
    const tolerance = readAppRoute('routine/tolerance.tsx');
    const sheet = readFileSync(`${APP_DIR}/../components/ui/Sheet.tsx`, 'utf8');

    expect(store).toContain('await updatePrivateItem(KEY, (raw) => {');
    expect(store).toContain('EXPO_PUBLIC_E2E_CYCLE_CONFIG_SAVE_FAILURE');
    expect(store).toContain("throw new Error('E2E_CYCLE_CONFIG_PRIVATE_WRITE_FAILURE')");
    expect(store).toContain('finishRecoveryAt(finishPauseAt(current, today), today)');
    expect(store).toContain('currentAndFutureSkips');
    expect(store).not.toContain('/* best-effort */');

    const commitIndex = useCycle.indexOf('() => updateCycleConfig({ variant })');
    expect(commitIndex).toBeGreaterThan(-1);
    expect(useCycle.indexOf("track('cycle_variant_changed'", commitIndex)).toBeGreaterThan(
      commitIndex,
    );
    const customCommitIndex = useCycle.indexOf('() => saveCustomCycleDefinition(definition)');
    expect(customCommitIndex).toBeGreaterThan(-1);
    expect(useCycle.indexOf("track('routine_edited'", customCommitIndex)).toBeGreaterThan(
      customCommitIndex,
    );
    expect(useCycle).toContain("if (variantChanged) track('cycle_variant_changed'");
    expect(useCycle).toContain(
      "config.variant === 'auto' || config.variant === 'custom' ? null : config.variant",
    );
    expect(useCycle).toContain("cadenceReady && config.variant === 'custom' && config.customCycle");
    expect(useCycle).toContain("await qc.cancelQueries({ queryKey: ['cycleConfig'] })");
    expect(useCycle).toContain(
      "qc.setQueryData<CycleConfig>(['cycleConfig', localDateString()], next)",
    );
    expect(useCycle.indexOf('afterCommit?.();')).toBeGreaterThan(
      useCycle.indexOf("qc.setQueryData<CycleConfig>(['cycleConfig', localDateString()], next)"),
    );
    expect(useCycle).toContain('lease.assertCurrent();');
    expect(useCycle).toContain("queryKey: ['cycleConfig', today]");
    expect(useCycle).toContain("AppState.addEventListener('change', handleAppState)");
    expect(useCycle).toContain('millisecondsUntilNextLocalDay()');

    expect(disruption).toContain('data?.paused ? (');
    expect(disruption).toContain('Resume my routine');
    expect(disruption).toContain("void act('resume', m.resume)");
    expect(disruption).toContain('<CycleMutationError />');
    expect(procedure).toContain("saveFailed ? 'Try again'");
    expect(recovery).toContain("saveFailed ? 'Try again'");
    expect(settings).toContain('<CycleMutationError />');
    expect(today).toContain("? 'Tonight · Paused'");
    expect(today).toContain("? 'Manage paused cycle'");
    expect(today).toContain("? '/cycle/disruption'");
    expect(today).toContain('Your cycle resumes when you are ready');

    expect(plan).toContain('const cycleMutations = useCycleMutations();');
    expect(plan).toContain('await cycleMutations.start();');
    expect(plan).toContain('<CycleMutationError className="mb-2 mt-0" />');

    const recoveryWriteIndex = tolerance.indexOf("await m.beginRecovery(7, 'irritation');");
    const rampWriteIndex = tolerance.indexOf('await applyToleranceToRamps(selected);');
    expect(recoveryWriteIndex).toBeGreaterThan(-1);
    expect(rampWriteIndex).toBeGreaterThan(recoveryWriteIndex);
    expect(tolerance).toContain("setSaveFailure(recoveryIsActive ? 'recovery_only' : 'unchanged')");
    expect(tolerance).toContain('dismissDisabled={saving}');

    expect(sheet).toContain('dismissDisabled?: boolean;');
    expect(sheet).toContain('disabled={dismissDisabled}');
    expect(disruption).toContain('dismissDisabled={controlsDisabled}');
    expect(phasedIntro).toContain('dismissDisabled={saving}');

    expect(phasedIntro).toContain('await overrideStaging(stagedIds);');
    expect(phasedIntro).not.toContain('Promise.all(stagedIds.map');
    expect(phasedIntro).toContain('accessibilityState={{ disabled: saving }}');
  });

  it('keeps scheduler safety notes visible when no cycle is formed', () => {
    const source = readAppRoute('cycle/week.tsx');
    const noteRenderCount = source.match(/<SchedulerNote note=\{schedulerNote\} \/>/g) ?? [];

    expect(source).toContain(
      'const schedulerNote = cadenceReady ? (data?.notes[0] ?? null) : null;',
    );
    expect(noteRenderCount).toHaveLength(2);
    expect(source.indexOf('No actives to cycle yet.')).toBeLessThan(
      source.lastIndexOf('<SchedulerNote note={schedulerNote} />'),
    );
  });

  it('keeps production cycle surfaces honest while cadence is review-gated', () => {
    const week = readAppRoute('cycle/week.tsx');
    const settings = readAppRoute('cycle/settings.tsx');
    const whyTonight = readAppRoute('cycle/why-tonight.tsx');
    const reviewGate = readFileSync(`${APP_DIR}/../features/routine/reviewGate.ts`, 'utf8');

    expect(reviewGate).toContain('EXPO_PUBLIC_E2E_ROUTINE_CADENCE_REVIEW_GATE');
    expect(reviewGate).toContain("'closed'");
    expect(reviewGate).toContain('isDev &&');

    expect(week).toContain("import { canUseRoutineCadence } from '@/features/routine/reviewGate';");
    expect(week).toContain('const cadenceReady = canUseRoutineCadence();');
    expect(week).toContain("!cadenceReady\n    ? 'review gate'");
    expect(week).toContain('cadenceReady && data?.paused ? (');
    expect(week).toContain(') : cadenceReady && data?.recovery.active ? (');
    expect(week).toContain('!cadenceReady ? (');
    expect(week).toContain('<ReviewGateEmptyState />');
    expect(week).toContain('cadenceReady && data?.paused');
    expect(week).toContain('cadenceReady && data?.recovery.active');
    expect(week).toContain(
      'Cycle guidance is unavailable until its exact rules and copy complete required professional',
    );
    expect(week).toContain('We publish skin-cycling cadence only after dermatologist');
    expect(week).toContain('{cadenceReady ? (');

    expect(settings).toContain(
      "import { canUseRoutineCadence } from '@/features/routine/reviewGate';",
    );
    expect(settings).toContain('const cadenceReady = canUseRoutineCadence();');
    expect(settings).toContain('if (!cadenceReady) return <CadenceReviewGate />;');
    expect(settings).toContain('Cycle settings open after review.');
    expect(settings).toContain('settings stay hidden');
    expect(settings).toContain('until clinical and cosmetic-chemistry review closes.');

    expect(whyTonight).toContain(
      "import { canUseRoutineCadence } from '@/features/routine/reviewGate';",
    );
    expect(whyTonight).toContain("case 'authored_recovery':");
    expect(whyTonight).toContain("case 'missing':");
    expect(whyTonight).toContain("case 'safety':");
    expect(whyTonight).toContain("case 'staged':");
    expect(whyTonight).toContain("case 'cadence_cap':");
    expect(whyTonight).toContain('const cadenceReady = canUseRoutineCadence();');
    expect(whyTonight).toContain('const cycle = cadenceReady ? (data?.cycle ?? null) : null;');
    expect(whyTonight).toContain('const tonight = cadenceReady ? (data?.tonight ?? null) : null;');
    expect(whyTonight).not.toContain('const cycle = data?.cycle;');
    expect(whyTonight).not.toContain('const tonight = data?.tonight;');
    expect(whyTonight).toContain(
      'Cycle guidance is unavailable until its exact rules and copy complete required professional review.',
    );
    expect(whyTonight).toContain('Your daily AM/PM routine is still available.');
  });
});
