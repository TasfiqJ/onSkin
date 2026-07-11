import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { AskTeaser } from '@/features/ask/AskTeaser';
import type { SchedulerSlot } from '@/features/scheduler/orchestrate';
import { friendlyWeekday, slotLabel } from '@/features/scheduler/projection';
import { useCycle } from '@/features/scheduler/useCycle';
import { usePlan } from '@/features/routine/usePlan';
import { useProgress } from '@/features/routine/useProgress';
import { RecommendationsTeaser } from '@/features/recommendations/RecommendationsTeaser';
import { requestReviewAfterValue } from '@/features/review/prompt';
import { ReverseTrialBanner } from '@/features/subscription/ReverseTrialBanner';
import { getCompletedSteps, stepKey, toggleCompletion } from '@/features/today/completionsStore';
import { shouldTrackCycleNightCompleted } from '@/features/today/cycleCompletion';
import { currentRoutineType, localClockLabel, localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { phase7Flags } from '@/lib/launch/phase7';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Today. The daily habit loop (design 04 AM light / 05 PM dark, docs/03 §6/§9).
// The check-off is the north-star activation metric and the retention engine, so it
// PERSISTS to the local-first completions store (completionsStore.ts) and feeds the
// streak/heat-map via useProgress. The server routine_completions table is the
// deferred sync target (B-ROUTINE-PERSIST / B-SUPABASE). AM is paper, PM is night
// with the skin-cycling strip when a real cycle exists + the Doc-2 auto-resolution
// banner ("next acid night").
const ROUTINE_CARD_SHADOW =
  Platform.OS === 'web'
    ? { boxShadow: '0 1px 2px rgba(32, 27, 21, 0.04)' }
    : {
        shadowColor: '#201B15',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      };

function slotInstruction(slot: SchedulerSlot): string {
  if (slot === 'retinoid') return 'Apply to dry skin · pea-sized · avoid the eye area.';
  if (slot === 'exfoliate') return 'A thin layer. Exfoliation night only.';
  return 'Barrier support. Keep it simple.';
}

// PM display sub overrides for the known retinoid-night roles (design 05). Display
// only, the toggle key (stepKey) is unchanged. Falls back to the step's instruction.
function pmDisplaySub(
  step: { role?: string; instruction?: string },
  hasScheduledRetinoid: boolean,
): string | undefined {
  if (step.role === 'cleanser' && hasScheduledRetinoid) {
    return 'Dry skin fully before the retinoid';
  }
  if (step.role === 'treatment' && hasScheduledRetinoid) return 'Pea-sized · avoid eye area';
  if (step.role === 'moisturiser') return 'Generous layer tonight';
  return step.instruction;
}

function compactRoutineInstruction(instruction: string): string {
  switch (instruction) {
    case 'Start with a clean base.':
      return 'Clean base first.';
    case 'Vitamin C in the morning, under your SPF.':
      return 'Under your SPF.';
    case 'Always the last morning step. Reapply through the day.':
      return 'Last step. Reapply later.';
    case 'Use in the morning. Follow the product label directions.':
      return 'Morning. Follow the label.';
    case 'Seal everything in.':
      return 'Seal it in.';
    case 'Apply to dry skin · pea-sized · avoid the eye area.':
      return 'Dry skin. Pea-sized.';
    case 'Pea-sized · avoid eye area':
      return 'Pea-sized. Avoid eyes.';
    case 'A thin layer. Exfoliation night only.':
      return 'Thin layer tonight.';
    case 'Barrier support. Keep it simple.':
      return 'Barrier support.';
    case 'Dry skin fully before the retinoid':
      return 'Dry skin first.';
    default:
      return instruction;
  }
}

function streakLabel(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function cycleStripLabel(slot: SchedulerSlot, compact: boolean): string {
  if (!compact) return slotLabel(slot);
  if (slot === 'exfoliate') return 'Exfol\niate';
  if (slot === 'retinoid') return 'Retin\noid';
  if (slot === 'recover') return 'Reco\nver';
  return 'Active';
}

function EmptyRoutineCard({
  compact = false,
  dark,
  short = false,
}: {
  compact?: boolean;
  dark: boolean;
  short?: boolean;
}) {
  const tight = compact && short;

  return (
    <View
      className={cn(
        tight
          ? 'mt-2 rounded-card px-4 py-3'
          : compact
            ? 'mt-3 rounded-card px-5 py-4'
            : 'mt-6 rounded-card p-6',
      )}
      style={{
        backgroundColor: dark ? colors.nightSurface : colors.paperRaised,
        borderWidth: dark ? 0 : 1,
        borderColor: colors.hairline,
        ...(dark ? undefined : ROUTINE_CARD_SHADOW),
      }}
    >
      <Text
        className="font-mono text-[11px] uppercase"
        style={{ color: dark ? 'rgba(244,239,231,0.52)' : colors.clayDeep }}
      >
        No routine yet
      </Text>
      <Text
        className={
          tight
            ? 'mt-1.5 font-sans-semibold text-[16px]'
            : compact
              ? 'mt-2 font-sans-semibold text-[18px]'
              : 'mt-3 font-sans-semibold text-[21px]'
        }
        style={{
          color: dark ? colors.cream : colors.ink,
          lineHeight: tight ? 20 : compact ? 22 : 25,
        }}
      >
        Build a routine from your shelf.
      </Text>
      {tight ? null : (
        <Text
          className={compact ? 'mt-1.5 text-[13px]' : 'mt-2.5 text-[14px]'}
          style={{
            color: dark ? 'rgba(244,239,231,0.58)' : colors.muted,
            lineHeight: compact ? 17 : 20,
          }}
        >
          Add the products you use and Today will become your AM/PM checklist.
        </Text>
      )}
      <Button
        label="Add products"
        variant={dark ? 'inverse' : 'primary'}
        className={tight ? 'mt-2 min-h-[52px] py-3' : compact ? 'mt-3' : 'mt-5'}
        onPress={() => router.push('/shelf/manual')}
      />
    </View>
  );
}

function CadenceWithheldNotice({
  compact,
  count,
  dark,
}: {
  compact: boolean;
  count: number;
  dark: boolean;
}) {
  const productLabel = count === 1 ? 'active product' : 'active products';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Review ${count} ${productLabel} without routine timing`}
      className={cn(
        'min-h-[48px] flex-row items-center gap-3 rounded-card px-5',
        compact ? 'mt-3 py-3' : 'mt-4 py-3.5',
      )}
      style={{ backgroundColor: dark ? colors.nightSurface : colors.greigeChip }}
      onPress={() => {
        haptics.select();
        router.push('/routine/plan');
      }}
    >
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dark ? colors.clayBright : colors.clayDeep }}
      />
      <Text
        className="flex-1 text-[13.5px]"
        style={{
          color: dark ? 'rgba(244,239,231,0.8)' : colors.muted,
          lineHeight: 19,
        }}
      >
        {`Timing is not set for ${count} ${productLabel}. ${
          count === 1 ? 'It stays' : 'They stay'
        } off Today for now.`}
      </Text>
      <Text aria-hidden style={{ color: dark ? colors.clayBright : colors.clayDeep }}>
        ›
      </Text>
    </Pressable>
  );
}

// Geometric checkmark (two rotated bars). No react-native-svg, per house rule.
function Check({ color = colors.paper }: { color?: string }) {
  return (
    <View style={{ width: 11, height: 9 }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 4,
          width: 5,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 3,
          top: 2,
          width: 9,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: '-50deg' }],
        }}
      />
    </View>
  );
}

function CheckRow({
  compact = false,
  name,
  sub,
  state,
  dark,
  first,
  onPress,
}: {
  compact?: boolean;
  name: string;
  sub?: string;
  state: 'done' | 'next' | 'pending';
  dark: boolean;
  first?: boolean;
  onPress: () => void;
}) {
  const accent = dark ? colors.clayBright : colors.clay;
  const displaySub = sub && compact ? compactRoutineInstruction(sub) : sub;
  const nameLineCount = compact ? 2 : undefined;
  const subLineCount = compact ? 1 : undefined;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === 'done' }}
      accessibilityLabel={name}
      aria-checked={state === 'done'}
      onPress={() => {
        if (state === 'done') return;
        haptics.success();
        onPress();
      }}
      className={cn('flex-row items-center', compact ? 'gap-3 py-2.5' : 'gap-3.5 py-3')}
      style={{
        borderTopWidth: first ? 0 : 1,
        borderTopColor: dark ? colors.hairlineDark : colors.hairline,
      }}
    >
      <View
        className={cn(
          'items-center justify-center rounded-full',
          compact ? 'h-6 w-6' : 'h-[26px] w-[26px]',
        )}
        style={
          state === 'done'
            ? { backgroundColor: accent }
            : {
                borderWidth: state === 'next' ? 2 : 1.5,
                borderColor:
                  state === 'next'
                    ? accent
                    : dark
                      ? 'rgba(244,239,231,0.25)'
                      : 'rgba(32,27,21,0.18)',
              }
        }
      >
        {state === 'done' ? <Check /> : null}
      </View>
      <View className="flex-1">
        <Text
          numberOfLines={nameLineCount}
          variant="body"
          className={cn(
            'font-sans-medium',
            compact ? 'text-[15px]' : 'text-[15.5px]',
            state === 'done' && 'line-through',
          )}
          style={{
            color: state === 'done' ? colors.mutedLight : dark ? colors.cream : colors.ink,
            lineHeight: compact ? 18 : undefined,
          }}
        >
          {name}
        </Text>
        {displaySub ? (
          <Text
            numberOfLines={subLineCount}
            className="mt-0.5 text-[12.5px]"
            style={{
              color: dark ? 'rgba(244,239,231,0.45)' : colors.muted,
              lineHeight: compact ? 16 : undefined,
            }}
          >
            {displaySub}
          </Text>
        ) : null}
      </View>
      {state === 'next' ? (
        <Text className="font-mono text-[11px]" style={{ color: accent }}>
          NEXT
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function TodayScreen() {
  const { height, width } = useWindowDimensions();
  const type = currentRoutineType();
  const dark = type === 'PM';
  const { data: planData } = usePlan();
  const { data: progress } = useProgress();
  const { data: cycleData } = useCycle();
  const qc = useQueryClient();
  const today = localDateString();
  const { data: doneData } = useQuery({
    queryKey: ['completions', today],
    queryFn: () => getCompletedSteps(today),
  });
  const done = doneData ?? new Set<string>();
  const hasExamplePlan = planData?.isExample === true;
  const hasRealRoutine = Boolean(planData && !planData.isExample);
  const plan = hasRealRoutine ? planData?.plan : undefined;
  const safetyExclusionCount = plan?.safetyExclusions.length ?? 0;
  const cadenceWithheldCount = plan?.cadenceWithheld.length ?? 0;
  const safetyExcludedIds = new Set(
    plan?.safetyExclusions.map((exclusion) => exclusion.productId) ?? [],
  );

  // The orchestrated, profile-aware cycle drives tonight everywhere (so pregnancy
  // suppression etc. is never contradicted by a hardcoded surface. Review fix).
  const cycle = hasRealRoutine ? (cycleData?.cycle ?? null) : null;
  const cTonight = cycleData?.tonight ?? null;
  const skippedTonight = cycleData?.skippedTonight ?? false;
  const recoveryActive = cycleData?.recovery.active ?? false;
  const paused = cycleData?.paused ?? false;
  const tonightSlot = cTonight?.night.slot ?? null;
  const cycleStripNights = cycleData?.weekAhead.map((projected) => projected.night) ?? [];

  // Persist the check-off to the local-first store, fire the activation metric on the
  // first-ever completion, and refresh Today + the streak/heat-map (docs/03 §6).
  async function toggle(
    key: string,
    context?: { phase: 'AM' | 'PM'; cycleActive: boolean; stepKeys: readonly string[] },
  ) {
    const result = await toggleCompletion(key, today);
    if (result.done) {
      const moment = type.toLowerCase();
      track('routine_checkoff_completed', { moment });
      if (result.firstEver) track('first_checkoff_completed', { moment });
      const checkoffPhase = context?.phase ?? (type === 'PM' ? 'PM' : 'AM');
      if (
        shouldTrackCycleNightCompleted({
          completedBefore: done,
          completedKey: key,
          cycleActive: context?.cycleActive === true,
          phase: checkoffPhase,
          stepKeys: context?.stepKeys ?? [],
          completionDone: result.done,
        })
      ) {
        track('cycle_night_completed', { moment: 'pm', source: 'today' });
      }
    }
    if (result.done && (progress?.streak ?? 0) >= 6)
      void requestReviewAfterValue('seven_checkoff_days');
    await qc.invalidateQueries({ queryKey: ['completions', today] });
    await qc.invalidateQueries({ queryKey: ['progress'] });
  }

  const rowState = (key: string, firstUndoneKey: string | null): 'done' | 'next' | 'pending' =>
    done.has(key) ? 'done' : key === firstUndoneKey ? 'next' : 'pending';

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const clockLabel = localClockLabel();
  const compactPhone = height < 700;
  const compactCycleStrip = compactPhone || width < 430;
  const compactRecommendationPrompt = height < 860;
  const shortEmptyRoutine = compactPhone && height < 600;
  const showRecommendations = hasRealRoutine && height >= 500;
  const showTonightTeaser =
    hasRealRoutine &&
    !compactPhone &&
    cycle != null &&
    (cadenceWithheldCount === 0 || height >= 932);

  // ---- AM ----
  if (!dark) {
    const steps = plan?.am ?? [];
    const firstUndone =
      steps.map((s) => stepKey('AM', s.productId)).find((k) => !done.has(k)) ?? null;
    const doneCount = steps.filter((s) => done.has(stepKey('AM', s.productId))).length;
    return (
      <Screen edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName={compactPhone ? 'pb-28' : 'pb-6'}
        >
          <ReverseTrialBanner compact={compactPhone} />
          <View className="mt-1 flex-row items-start justify-between">
            <Text variant="label" tone="muted" className="font-mono mt-1">
              {dateLabel.toUpperCase()}
            </Text>
            {progress && progress.streak > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View your streak and adherence"
                onPress={() => router.push('/routine/streak')}
                className="min-h-[48px] flex-row items-center gap-1.5 rounded-pill bg-clay-tint px-4 py-2.5"
              >
                <View className="h-1.5 w-1.5 rounded-full bg-clay" />
                <Text className="font-sans-bold text-[13px]" style={{ color: colors.clayDeep }}>
                  {streakLabel(progress.streak)}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text variant="titleLg" className={compactPhone ? 'mt-3' : 'mt-4'}>
            Good morning.
          </Text>

          {cadenceWithheldCount > 0 ? (
            <CadenceWithheldNotice
              compact={compactPhone}
              count={cadenceWithheldCount}
              dark={false}
            />
          ) : null}

          {hasExamplePlan ? (
            <EmptyRoutineCard compact={compactPhone} dark={false} short={shortEmptyRoutine} />
          ) : (
            <View
              className={
                compactPhone
                  ? 'mt-4 rounded-card bg-paper-raised'
                  : 'mt-6 rounded-card bg-paper-raised'
              }
              style={{
                paddingHorizontal: compactPhone ? 20 : 22,
                paddingTop: compactPhone ? 18 : 22,
                paddingBottom: compactPhone ? 8 : 12,
                borderWidth: 1,
                borderColor: colors.hairline,
                ...ROUTINE_CARD_SHADOW,
              }}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <Text variant="body" className="font-sans-bold">
                  Morning routine
                </Text>
                <Text variant="label" tone="muted" className="font-mono">
                  {doneCount} of {steps.length}
                </Text>
              </View>
              {steps.map((s, i) => {
                const k = stepKey('AM', s.productId);
                return (
                  <CheckRow
                    key={k}
                    name={s.name}
                    sub={s.instruction}
                    state={rowState(k, firstUndone)}
                    dark={false}
                    compact={compactPhone}
                    first={i === 0}
                    onPress={() => void toggle(k)}
                  />
                );
              })}
            </View>
          )}

          {/* For you. Recommendations + the in-routine SPF gap prompt (docs/09 §7) */}
          {showRecommendations ? (
            <RecommendationsTeaser compact={compactRecommendationPrompt} showGapPrompt />
          ) : null}

          {/* Ask. The deterministic, on-device advisor (docs/13 §9 moat taste) */}
          {phase7Flags.cloudAsk && !compactPhone ? <AskTeaser /> : null}

          {/* Tonight teaser */}
          {showTonightTeaser ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See your cycle week ahead"
              className="mt-4 flex-row items-center gap-4 rounded-card p-5"
              style={{ backgroundColor: colors.night }}
              onPress={() => {
                haptics.select();
                router.push('/cycle/week');
              }}
            >
              <View
                className="h-[38px] w-[38px] items-center justify-center rounded-full"
                style={{ backgroundColor: colors.nightSurface }}
              >
                <View
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: colors.clayBright }}
                />
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-[15px]" style={{ color: colors.cream }}>
                  {recoveryActive
                    ? 'Tonight · Recovery'
                    : skippedTonight
                      ? 'Tonight · Skipped'
                      : cTonight
                        ? `Tonight · Cycling night ${cTonight.index + 1}`
                        : 'Tonight'}
                </Text>
                <Text className="text-[13px]" style={{ color: 'rgba(244,239,231,0.55)' }}>
                  {recoveryActive
                    ? 'Barrier support. Actives paused'
                    : skippedTonight
                      ? 'Your cycle picks up tomorrow'
                      : tonightSlot === 'retinoid'
                        ? 'Retinoid night. Keep it simple'
                        : tonightSlot === 'exfoliate'
                          ? 'Exfoliation night'
                          : tonightSlot === 'recover'
                            ? 'Recovery night. Barrier support'
                            : 'Your evening routine'}
                </Text>
              </View>
              <Text style={{ color: 'rgba(244,239,231,0.4)', fontSize: 20 }}>›</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  // ---- PM (dark). Driven by the orchestrated, profile-aware cycle ----
  const nightNumber = cTonight ? cTonight.index + 1 : 0;
  const nightTotal = cycle?.lengthNights ?? 0;
  // Tonight's cycled active comes from the engine (suppressed correctly for
  // pregnancy etc.). Not from a hardcoded literal. Skipped, recovery, AND
  // paused/travel nights all drop the potent active so the evening trims to the
  // stable barrier basics the pause/travel banners promise (docs/05 §6.4).
  const scheduledCyclePlanStep = cTonight?.night.productId
    ? plan?.pm.find((step) => step.productId === cTonight.night.productId)
    : undefined;
  const cycledStep =
    !skippedTonight &&
    !recoveryActive &&
    !paused &&
    cTonight?.night.productId &&
    !safetyExcludedIds.has(cTonight.night.productId)
      ? {
          productId: cTonight.night.productId,
          name: cTonight.night.productName ?? 'Tonight’s active',
          instruction: slotInstruction(cTonight.night.slot),
          order: scheduledCyclePlanStep?.order ?? 40,
          role:
            scheduledCyclePlanStep?.role ??
            (cTonight.night.slot === 'retinoid' ? ('treatment' as const) : undefined),
        }
      : null;
  const dailyPm = (plan?.pm ?? []).filter(
    (step) => step.cadence !== 'cycle' && !safetyExcludedIds.has(step.productId),
  );
  const pmSteps = [...dailyPm, ...(cycledStep ? [cycledStep] : [])].sort(
    (a, b) => a.order - b.order,
  );
  const hasScheduledRetinoid = cycledStep?.role === 'treatment';
  const pmStepKeys = pmSteps.map((s) => stepKey('PM', s.productId));
  const firstUndonePm = pmStepKeys.find((k) => !done.has(k)) ?? null;
  const donePm = pmSteps.filter((s) => done.has(stepKey('PM', s.productId))).length;
  const suppressedAcidName =
    tonightSlot === 'retinoid' && cycle
      ? (cycle.nights.find((n) => n.slot === 'exfoliate')?.productName ?? null)
      : null;
  const nextAcidISO = cycleData?.nextAcidNight ?? null;

  return (
    <Screen tone="night" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactPhone ? 'pb-28' : 'pb-6'}
      >
        <ReverseTrialBanner compact={compactPhone} tone="night" />
        <Text variant="label" tone="inverseMuted" className="font-mono mt-1">
          {dateLabel.toUpperCase()} · {clockLabel}
        </Text>
        <Text variant="titleLg" tone="inverse" className="mt-2">
          Good evening.
        </Text>

        {/* Recovery / pause banner. The scheduler's disruption state (docs/05 §7) */}
        {cycleData?.recovery.active ? (
          <Pressable
            accessibilityRole="button"
            className="mt-6 flex-row items-center gap-3 rounded-card px-5 py-4"
            style={{ backgroundColor: 'rgba(79,122,74,0.16)' }}
            onPress={() => {
              haptics.select();
              router.push('/cycle/recovery');
            }}
          >
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.sage }} />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
              Recovery mode · day {cycleData.recovery.day} of {cycleData.recovery.days}. Barrier
              support tonight.
            </Text>
            <Text style={{ color: 'rgba(244,239,231,0.4)' }}>›</Text>
          </Pressable>
        ) : cycleData?.paused ? (
          <Pressable
            accessibilityRole="button"
            className="mt-6 flex-row items-center gap-3 rounded-card px-5 py-4"
            style={{ backgroundColor: colors.nightSurface }}
            onPress={() => {
              haptics.select();
              router.push('/cycle/disruption');
            }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.clayBright }}
            />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
              Your cycle is paused. Resume whenever you&apos;re ready.
            </Text>
            <Text style={{ color: 'rgba(244,239,231,0.4)' }}>›</Text>
          </Pressable>
        ) : skippedTonight ? (
          <View
            className="mt-6 flex-row items-center gap-3 rounded-card px-5 py-4"
            style={{ backgroundColor: colors.nightSurface }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.clayBright }}
            />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
              You skipped tonight. Nothing breaks, your cycle picks up tomorrow.
            </Text>
          </View>
        ) : null}

        {safetyExclusionCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review pregnancy and breastfeeding setting"
            className="mt-4 min-h-[48px] flex-row items-center gap-3 rounded-card px-5 py-3"
            style={{ backgroundColor: 'rgba(217,161,131,0.10)' }}
            onPress={() => {
              haptics.select();
              router.push('/settings/skin-profile?returnTo=today');
            }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.clayBright }}
            />
            <Text
              className="flex-1 text-[13.5px]"
              style={{ color: 'rgba(244,239,231,0.8)', lineHeight: 19 }}
            >
              {`${safetyExclusionCount} caution product${
                safetyExclusionCount === 1 ? '' : 's'
              } paused by your pregnancy & breastfeeding setting.`}
            </Text>
            <Text aria-hidden style={{ color: colors.clayBright }}>
              ›
            </Text>
          </Pressable>
        ) : null}

        {cadenceWithheldCount > 0 ? (
          <CadenceWithheldNotice compact={compactPhone} count={cadenceWithheldCount} dark />
        ) : null}

        {/* Skin-cycling strip. Taps through to the week overview (docs/05 §6.1) */}
        {cycle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See your cycle week ahead"
            className="mt-4 rounded-card p-5"
            style={{ backgroundColor: colors.nightSurface }}
            onPress={() => {
              haptics.select();
              router.push('/cycle/week');
            }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className="font-sans-bold text-[13px] uppercase tracking-[1px]"
                style={{ color: 'rgba(244,239,231,0.5)' }}
              >
                Skin cycling · night {nightNumber} of {nightTotal}
              </Text>
              <Text className="text-[12px]" style={{ color: colors.clayBright }}>
                Week ahead ›
              </Text>
            </View>
            <View className="flex-row gap-1">
              {cycleStripNights.map((n, i) => {
                const label = cycleStripLabel(n.slot, compactCycleStrip);
                const accessibilityLabel = slotLabel(n.slot);
                const active = i === 0;
                return (
                  <View key={`${n.index}-${i}`} className="flex-1">
                    <View
                      className="h-1.5 rounded-pill"
                      style={{
                        backgroundColor: active ? colors.clayBright : 'rgba(244,239,231,0.16)',
                      }}
                    />
                    <Text
                      accessibilityLabel={accessibilityLabel}
                      maxFontSizeMultiplier={1.08}
                      numberOfLines={compactCycleStrip ? 2 : 1}
                      style={{
                        color: active ? colors.clayBright : 'rgba(244,239,231,0.45)',
                        fontSize: compactCycleStrip ? 10.5 : 12,
                        fontWeight: active ? '700' : '400',
                        lineHeight: compactCycleStrip ? 11 : 15,
                        marginTop: compactCycleStrip ? 7 : 8,
                        textAlign: 'center',
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Pressable>
        ) : null}

        {/* Evening routine */}
        {hasExamplePlan ? (
          <EmptyRoutineCard compact={compactPhone} dark short={shortEmptyRoutine} />
        ) : (
          <View className="mt-4 rounded-card p-5" style={{ backgroundColor: colors.nightSurface }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-sans-bold text-[16px]" style={{ color: colors.cream }}>
                Evening routine
              </Text>
              {pmSteps.length ? (
                <Text className="font-mono text-[12px]" style={{ color: 'rgba(244,239,231,0.45)' }}>
                  {donePm} of {pmSteps.length}
                </Text>
              ) : null}
            </View>
            {pmSteps.length ? (
              pmSteps.map((s, i) => {
                const k = stepKey('PM', s.productId);
                return (
                  <CheckRow
                    key={k}
                    name={s.name}
                    sub={pmDisplaySub(s, hasScheduledRetinoid)}
                    state={rowState(k, firstUndonePm)}
                    dark
                    compact={compactPhone}
                    first={i === 0}
                    onPress={() =>
                      void toggle(k, {
                        phase: 'PM',
                        cycleActive: Boolean(cycle && cTonight),
                        stepKeys: pmStepKeys,
                      })
                    }
                  />
                );
              })
            ) : (
              <View className={compactPhone ? 'py-2.5' : 'py-3'}>
                <Text className="font-sans-medium text-[15px]" style={{ color: colors.cream }}>
                  No evening steps yet.
                </Text>
                <Text className="mt-1 text-[12.5px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
                  Add a cleanser, moisturiser, or night product to build this out.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Auto-resolution banner. The Doc-2 resolution rendered (docs/03 §5) */}
        {suppressedAcidName ? (
          <View
            className="mt-4 flex-row items-center gap-3 px-5 py-4"
            style={{ backgroundColor: 'rgba(217,161,131,0.10)', borderRadius: 18 }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.clayBright }}
            />
            <Text
              className="flex-1 text-[13.5px]"
              style={{ color: 'rgba(244,239,231,0.75)', lineHeight: 20 }}
            >
              Your {suppressedAcidName.toLowerCase()} is skipped tonight. It doesn&apos;t mix well
              with retinol.{nextAcidISO ? ` Next acid night: ${friendlyWeekday(nextAcidISO)}.` : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
