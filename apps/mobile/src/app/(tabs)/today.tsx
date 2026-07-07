import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { AskTeaser } from '@/features/ask/AskTeaser';
import { friendlyWeekday, slotLabel } from '@/features/scheduler/projection';
import { useCycle } from '@/features/scheduler/useCycle';
import { usePlan } from '@/features/routine/usePlan';
import { useProgress } from '@/features/routine/useProgress';
import { RecommendationsTeaser } from '@/features/recommendations/RecommendationsTeaser';
import { requestReviewAfterValue } from '@/features/review/prompt';
import { ReverseTrialBanner } from '@/features/subscription/ReverseTrialBanner';
import { getCompletedSteps, stepKey, toggleCompletion } from '@/features/today/completionsStore';
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

function slotInstruction(slot: string): string {
  if (slot === 'retinoid') return 'Apply to dry skin · pea-sized · avoid the eye area.';
  if (slot === 'exfoliate') return 'A thin layer. Exfoliation night only.';
  return 'Barrier support. Keep it simple.';
}

// PM display sub overrides for the known retinoid-night roles (design 05). Display
// only, the toggle key (stepKey) is unchanged. Falls back to the step's instruction.
function pmDisplaySub(step: { role?: string; instruction?: string }): string | undefined {
  if (step.role === 'cleanser') return 'Dry skin fully before the retinoid';
  if (step.role === 'treatment') return 'Pea-sized · avoid eye area';
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
        if (state !== 'done') haptics.success();
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
  const { height } = useWindowDimensions();
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
  const plan = planData?.plan;

  // The orchestrated, profile-aware cycle drives tonight everywhere (so pregnancy
  // suppression etc. is never contradicted by a hardcoded surface. Review fix).
  const cycle = cycleData?.cycle ?? null;
  const cTonight = cycleData?.tonight ?? null;
  const skippedTonight = cycleData?.skippedTonight ?? false;
  const recoveryActive = cycleData?.recovery.active ?? false;
  const paused = cycleData?.paused ?? false;
  const tonightSlot = cTonight?.night.slot ?? null;

  // Persist the check-off to the local-first store, fire the activation metric on the
  // first-ever completion, and refresh Today + the streak/heat-map (docs/03 §6).
  async function toggle(key: string) {
    const { done, firstEver } = await toggleCompletion(key, today);
    if (done) {
      const moment = type.toLowerCase();
      track('routine_checkoff_completed', { moment });
      if (firstEver) track('first_checkoff_completed', { moment });
    }
    if (done && (progress?.streak ?? 0) >= 6) void requestReviewAfterValue('seven_checkoff_days');
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
  const compactRecommendationPrompt = height < 860;

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

          {/* For you. Recommendations + the in-routine SPF gap prompt (docs/09 §7) */}
          <RecommendationsTeaser compact={compactRecommendationPrompt} showGapPrompt />

          {/* Ask. The deterministic, on-device advisor (docs/13 §9 moat taste) */}
          {phase7Flags.cloudAsk && !compactPhone ? <AskTeaser /> : null}

          {/* Tonight teaser */}
          {compactPhone || !cycle ? null : (
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
          )}
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
  const cycledStep =
    !skippedTonight && !recoveryActive && !paused && cTonight?.night.productId
      ? {
          productId: cTonight.night.productId,
          name: cTonight.night.productName ?? 'Tonight’s active',
          instruction: slotInstruction(cTonight.night.slot),
          order: 40,
          role: cTonight.night.slot === 'retinoid' ? ('treatment' as const) : undefined,
        }
      : null;
  const dailyPm = (plan?.pm ?? []).filter((s) => !s.cyclingNight);
  const pmSteps = [...dailyPm, ...(cycledStep ? [cycledStep] : [])].sort(
    (a, b) => a.order - b.order,
  );
  const firstUndonePm =
    pmSteps.map((s) => stepKey('PM', s.productId)).find((k) => !done.has(k)) ?? null;
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
              {cycle.nights.map((n, i) => {
                const label = slotLabel(n.slot);
                const active = cTonight ? i === cTonight.index : false;
                return (
                  <View key={i} className="flex-1">
                    <View
                      className="h-1.5 rounded-pill"
                      style={{
                        backgroundColor: active ? colors.clayBright : 'rgba(244,239,231,0.16)',
                      }}
                    />
                    <Text
                      adjustsFontSizeToFit
                      maxFontSizeMultiplier={1.12}
                      minimumFontScale={0.85}
                      numberOfLines={1}
                      style={{
                        color: active ? colors.clayBright : 'rgba(244,239,231,0.45)',
                        fontSize: 12,
                        fontWeight: active ? '700' : '400',
                        lineHeight: 15,
                        marginTop: 8,
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
                  sub={pmDisplaySub(s)}
                  state={rowState(k, firstUndonePm)}
                  dark
                  compact={compactPhone}
                  first={i === 0}
                  onPress={() => void toggle(k)}
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
