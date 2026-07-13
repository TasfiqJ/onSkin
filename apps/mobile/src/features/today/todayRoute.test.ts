import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Today route mobile contracts', () => {
  it('keeps check-offs closed until private completion history is readable', () => {
    const today = readAppRoute('(tabs)/today.tsx');
    const streak = readAppRoute('routine/streak.tsx');
    const welcomeBack = readAppRoute('routine/welcome-back.tsx');

    expect(today).toContain(
      'completionQuery.isPending || completionQuery.isError || completionMutationFailed',
    );
    expect(today).toContain('retry: false');
    const store = readFileSync(`${APP_DIR}/../features/today/completionsStore.ts`, 'utf8');
    expect(store).toContain('EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE');
    expect(store).toContain("typeof __DEV__ === 'undefined' || !__DEV__");
    expect(today).toContain("typeof __DEV__ !== 'undefined'");
    expect(today).toContain("EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE === 'today_once'");
    expect(today).toContain('<CompletionHistoryState');
    expect(today).toContain('catch {\n      setCompletionMutationFailed(true);');
    expect(today).toContain('if (result.isSuccess) setCompletionMutationFailed(false);');
    expect(today).toContain('onRetry={() => void retryCompletionHistory()}');
    for (const source of [streak, welcomeBack]) {
      expect(source).toContain('progressQuery.isPending || progressQuery.isError');
      expect(source).toContain('<CompletionHistoryState');
      expect(source).toContain('onRetry={() => void progressQuery.refetch()}');
    }
  });

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
    expect(source).toContain('const hasExamplePlan = planData?.isExample === true;');
    expect(source).toContain('const hasRealRoutine = Boolean(planData && !planData.isExample);');
    expect(source).toContain('const plan = hasRealRoutine ? planData?.plan : undefined;');
    expect(source).toContain('const cycle = hasRealRoutine ? (cycleData?.cycle ?? null) : null;');
    expect(source).toContain('const safetyExcludedIds = new Set(');
    expect(source).toContain('!safetyExcludedIds.has(cTonight.night.productId)');
    expect(source).toContain("step.cadence !== 'cycle' && !safetyExcludedIds.has(step.productId)");
    expect(source).not.toContain('step.cyclingNight');
    expect(source).toContain('function CadenceWithheldNotice');
    expect(source).toContain('const cadenceWithheldCount = plan?.cadenceWithheld.length ?? 0;');
    expect(source).toContain('Timing is not set for ${count} ${productLabel}.');
    expect(source).toContain("router.push('/routine/plan')");
    expect(source.match(/<CadenceWithheldNotice/g)).toHaveLength(2);
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
    expect(source).toContain('function compactRoutineInstruction(instruction: string): string');
    expect(source).toContain("case 'Vitamin C in the morning, under your SPF.':");
    expect(source).toContain("return 'Under your SPF.';");
    expect(source).toContain("case 'Always the last morning step. Reapply through the day.':");
    expect(source).toContain("return 'Last step. Reapply later.';");
    expect(source).toContain("case 'Use in the morning. Follow the product label directions.':");
    expect(source).toContain("return 'Morning. Follow the label.';");
    expect(source).toContain(
      'const displaySub = sub && compact ? compactRoutineInstruction(sub) : sub;',
    );
    expect(source).toContain('const nameLineCount = compact ? 2 : undefined;');
    expect(source).toContain('const subLineCount = compact ? 1 : undefined;');
    expect(source).toContain('{displaySub}');
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
    expect(source).toContain('const nightNumber = cTonight ? cTonight.index + 1 : 0');
    expect(source).toContain('const nightTotal = cycle?.lengthNights ?? 0');
    expect(source).toContain('const label = cycleStripLabel(n.slot, compactCycleStrip);');
    expect(source).toContain('const accessibilityLabel = slotLabel(n.slot);');
    expect(source).toContain('{cycle ? (');
    expect(source).toContain(
      'const cycleStripNights = cycleData?.weekAhead.map((projected) => projected.night) ?? [];',
    );
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
    expect(source).toContain('shouldTrackCycleNightCompleted({');
    expect(source).toContain('completedBefore: done');
    expect(source).toContain('completedKey: key');
    expect(source).toContain("phase: 'PM'");
    expect(source).toContain('cTonight?.night.productId &&');
    expect(source).toContain('!paused &&');
    expect(source).toContain('!skippedTonight &&');
    expect(source).toContain('!recoveryActive,');
    expect(source).toContain('stepKeys: pmStepKeys');
    expect(source).toContain("track('cycle_night_completed', { moment: 'pm', source: 'today' })");
    const eventIndex = source.indexOf("track('cycle_night_completed'");
    const eventCall = source.slice(eventIndex, eventIndex + 120);
    expect(eventCall).not.toMatch(/product|slot|step|skin|goal/i);
  });
});
