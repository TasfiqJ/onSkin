import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Today route mobile contracts', () => {
  it('keeps the streak and adherence pill comfortably tappable on phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain('accessibilityLabel="View your streak and adherence"');
    expect(source).toContain("router.push('/routine/streak')");
    expect(source).toContain('function streakLabel(days: number): string');
    expect(source).toContain("days === 1 ? 'day' : 'days'");
    expect(source).toContain('{streakLabel(progress.streak)}');
    expect(source).not.toContain('{progress.streak} days');
    expect(source).toContain('min-h-[48px]');
    expect(source).not.toContain('min-h-[44px]');
    expect(source).toContain('px-4 py-2.5');
    expect(source).not.toContain('px-3.5 py-1.5');
  });

  it('keeps Today prompt actions clear of the floating tab bar on short phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain("import { Button, Screen, Text } from '@/components/ui';");
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPhone = height < 700');
    expect(source).toContain('const compactRecommendationPrompt = height < 860');
    expect(source).toContain('const shortEmptyRoutine = compactPhone && height < 600;');
    expect(source).toContain('const showRecommendations = hasRealRoutine && height >= 500;');
    expect(source).toContain('const showTonightTeaser =');
    expect(source).toContain('(cadenceWithheldCount === 0 || height >= 932);');
    expect(source).toContain('function EmptyRoutineCard');
    expect(source).toContain('short = false');
    expect(source).toContain('const tight = compact && short;');
    expect(source).toContain('No routine yet');
    expect(source).toContain('Build a routine from your shelf.');
    expect(source).toContain('label="Add products"');
    expect(source).toContain("router.push('/shelf/manual')");
    expect(source).toContain("tight\n          ? 'mt-2 rounded-card px-4 py-3'");
    expect(source).toContain("? 'mt-3 rounded-card px-5 py-4'");
    expect(source).toContain(": 'mt-6 rounded-card p-6'");
    expect(source).toContain("tight\n            ? 'mt-1.5 font-sans-semibold text-[16px]'");
    expect(source).toContain("? 'mt-2 font-sans-semibold text-[18px]'");
    expect(source).toContain('lineHeight: tight ? 20 : compact ? 22 : 25');
    expect(source).toContain('{tight ? null : (');
    expect(source).toContain("className={compact ? 'mt-1.5 text-[13px]' : 'mt-2.5 text-[14px]'}");
    expect(source).toContain('lineHeight: compact ? 17 : 20');
    expect(source).toContain(
      "className={tight ? 'mt-2 min-h-[52px] py-3' : compact ? 'mt-3' : 'mt-5'}",
    );
    expect(source.match(/short=\{shortEmptyRoutine\}/g)).toHaveLength(2);
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
    expect(source).not.toContain('step.cyclingNight');
    expect(source).toContain('function CadenceWithheldNotice');
    expect(source).toContain('Timing is not set for ${count} ${productLabel}.');
    expect(source).toContain("router.push('/routine/plan')");
    expect(source.match(/<CadenceWithheldNotice/g)).toHaveLength(2);
    expect(source).toContain('function SequencingWithheldNotice');
    expect(source).toContain('Application order is not reviewed for ${count} ${productLabel}.');
    expect(source.match(/<SequencingWithheldNotice/g)).toHaveLength(2);
    expect(source).toContain('Review pregnancy and breastfeeding setting');
    expect(source).toContain("router.push('/settings/skin-profile?returnTo=today')");
    expect(source).toContain("contentContainerClassName={compactPhone ? 'pb-28' : 'pb-6'}");
    expect(source).toContain('<ReverseTrialBanner compact={compactPhone} />');
    expect(source).toContain('<ReverseTrialBanner compact={compactPhone} tone="night" />');
    expect(source).toContain("className={compactPhone ? 'mt-3' : 'mt-4'}");
    expect(source).toContain("? 'mt-4 rounded-card bg-paper-raised'");
    expect(source).toContain(": 'mt-6 rounded-card bg-paper-raised'");
    expect(source).toContain('paddingTop: compactPhone ? 18 : 22');
    expect(source).toContain('paddingBottom: compactPhone ? 8 : 12');
    expect(source).not.toContain('compactRoutineInstruction');
    expect(source).not.toContain('pmDisplaySub');
    expect(source).toContain('const nameLineCount = compact ? 2 : undefined;');
    expect(source).toContain('const subLineCount = compact ? 2 : undefined;');
    expect(source).toContain('{sub}');
    expect(source).toContain('compact?: boolean;');
    expect(source).toContain(
      "className={cn('flex-row items-center', compact ? 'gap-3 py-2.5' : 'gap-3.5 py-3')}",
    );
    expect(source).toContain('numberOfLines={nameLineCount}');
    expect(source).toContain('numberOfLines={subLineCount}');
    expect(source).toContain('lineHeight: compact ? 18 : undefined');
    expect(source).toContain('lineHeight: compact ? 16 : undefined');
    expect(source).not.toContain('numberOfLines={compact ? 1 : undefined}');
    expect(source.match(/<CheckRow[\s\S]*?compact=\{compactPhone\}/g)).toHaveLength(2);
    expect(source).toContain(
      '<RecommendationsTeaser compact={compactRecommendationPrompt} showGapPrompt />',
    );
    expect(source).toContain('{showRecommendations ? (');
    expect(source).not.toContain('<RecommendationsTeaser compact={compactPhone} showGapPrompt />');
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
    expect(source).toContain('if (result.inserted) {');
    expect(source).toContain('shouldTrackCycleNightCompleted({');
    expect(source).toContain('completedStepKeysAfter: result.completedStepKeysAfter');
    expect(source).toContain('completedKey: key');
    expect(source).toContain("phase: 'PM'");
    expect(source).toContain('cycleActive: routine.cycleActive');
    expect(source).toContain('stepKeys: pmStepKeys');
    expect(source).toContain('completionInserted: result.inserted');
    expect(source).not.toContain('completedBefore: done');
    expect(source).toContain('if (result.completionDayInserted && (progress?.streak ?? 0) >= 6) {');
    expect(source).toContain('const result = await toggleCompletion(key, today, scheduled)');
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
    expect(source).toContain('const result = await toggleCompletion(key, today, scheduled)');
    expect(source).toContain('persistenceConfirmed = true');
    expect(source).toContain("qc.setQueryData(['completions', today]");
    expect(source).toContain('haptics.success()');
    expect(
      source.indexOf('const result = await toggleCompletion(key, today, scheduled)'),
    ).toBeLessThan(source.indexOf('haptics.success()'));
    expect(source).toContain('setCompletionActionFailed(true)');
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
