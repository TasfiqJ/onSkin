import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { AskTeaser } from '@/features/ask/AskTeaser';
import { friendlyWeekday, slotLabel } from '@/features/scheduler/projection';
import { useCycle } from '@/features/scheduler/useCycle';
import { usePlan } from '@/features/routine/usePlan';
import { useProgress } from '@/features/routine/useProgress';
import { RecommendationsTeaser } from '@/features/recommendations/RecommendationsTeaser';
import { ReverseTrialBanner } from '@/features/subscription/ReverseTrialBanner';
import { getCompletedSteps, stepKey, toggleCompletion } from '@/features/today/completionsStore';
import { currentRoutineType, localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Today. The daily habit loop (design 04 AM light / 05 PM dark, docs/03 §6/§9).
// The check-off is the north-star activation metric and the retention engine, so it
// PERSISTS to the local-first completions store (completionsStore.ts) and feeds the
// streak/heat-map via useProgress. The server routine_completions table is the
// deferred sync target (B-ROUTINE-PERSIST / B-SUPABASE). AM is paper, PM is night
// with the skin-cycling strip + the Doc-2 auto-resolution banner ("next acid night").
// Fallback strip labels when no cycle is running yet (the classic rhythm).
const FALLBACK_SLOTS = ['Exfoliate', 'Retinoid', 'Recover', 'Recover'];

function slotInstruction(slot: string): string {
  if (slot === 'retinoid') return 'Apply to dry skin · pea-sized · avoid the eye area.';
  if (slot === 'exfoliate') return 'A thin layer. Exfoliation night only.';
  return 'Barrier support. Keep it simple.';
}

function CheckRow({
  name,
  sub,
  state,
  dark,
  onPress,
}: {
  name: string;
  sub?: string;
  state: 'done' | 'next' | 'pending';
  dark: boolean;
  onPress: () => void;
}) {
  const accent = dark ? colors.clayBright : colors.clay;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: state === 'done' }}
      accessibilityLabel={name}
      onPress={() => {
        if (state !== 'done') haptics.success();
        onPress();
      }}
      className="flex-row items-center gap-3.5 py-3"
      style={{ borderTopWidth: 1, borderTopColor: dark ? colors.hairlineDark : colors.hairline }}>
      <View
        className="h-[26px] w-[26px] items-center justify-center rounded-full"
        style={
          state === 'done'
            ? { backgroundColor: accent }
            : { borderWidth: state === 'next' ? 2 : 1.5, borderColor: state === 'next' ? accent : dark ? 'rgba(244,239,231,0.25)' : 'rgba(32,27,21,0.18)' }
        }>
        {state === 'done' ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.paper }} /> : null}
      </View>
      <View className="flex-1">
        <Text
          variant="body"
          className={cn('font-sans-medium text-[15.5px]', state === 'done' && 'line-through')}
          style={{ color: state === 'done' ? colors.mutedLight : dark ? colors.cream : colors.ink }}>
          {name}
        </Text>
        {sub ? (
          <Text className="mt-0.5 text-[12.5px]" style={{ color: dark ? 'rgba(244,239,231,0.45)' : colors.muted }}>
            {sub}
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
  const tonightSlot = cTonight?.night.slot ?? null;

  // Persist the check-off to the local-first store, fire the activation metric on the
  // first-ever completion, and refresh Today + the streak/heat-map (docs/03 §6).
  async function toggle(key: string) {
    const { firstEver } = await toggleCompletion(key, today);
    if (firstEver) track('first_checkoff_completed', { step: key });
    await qc.invalidateQueries({ queryKey: ['completions', today] });
    await qc.invalidateQueries({ queryKey: ['progress'] });
  }

  const rowState = (key: string, firstUndoneKey: string | null): 'done' | 'next' | 'pending' =>
    done.has(key) ? 'done' : key === firstUndoneKey ? 'next' : 'pending';

  const dateLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ---- AM ----
  if (!dark) {
    const steps = plan?.am ?? [];
    const firstUndone = steps.map((s) => stepKey('AM', s.productId)).find((k) => !done.has(k)) ?? null;
    const doneCount = steps.filter((s) => done.has(stepKey('AM', s.productId))).length;
    return (
      <Screen edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
          <ReverseTrialBanner />
          <View className="mt-1 flex-row items-start justify-between">
            <Text variant="label" tone="muted" className="font-mono mt-1">
              {dateLabel.toUpperCase()}
            </Text>
            {progress && progress.streak > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View your streak and adherence"
                onPress={() => router.push('/routine/streak')}
                className="flex-row items-center gap-1.5 rounded-pill bg-clay-tint px-3.5 py-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-clay" />
                <Text className="font-sans-bold text-[13px]" style={{ color: colors.clayDeep }}>
                  {progress.streak} days
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text variant="title" className="mt-4">
            Good morning.
          </Text>

          <View className="mt-6 rounded-card bg-paper-raised p-5" style={{ borderWidth: 1, borderColor: colors.hairline }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text variant="body" className="font-sans-bold">
                Morning routine
              </Text>
              <Text variant="label" tone="muted" className="font-mono">
                {doneCount} of {steps.length}
              </Text>
            </View>
            {steps.map((s) => {
              const k = stepKey('AM', s.productId);
              return (
                <CheckRow
                  key={k}
                  name={s.name}
                  sub={s.instruction}
                  state={rowState(k, firstUndone)}
                  dark={false}
                  onPress={() => void toggle(k)}
                />
              );
            })}
          </View>

          {/* For you. Recommendations + the in-routine SPF gap prompt (docs/09 §7) */}
          <RecommendationsTeaser showGapPrompt />

          {/* Ask OnSkin. The deterministic, on-device advisor (docs/13 §9 moat taste) */}
          <AskTeaser />

          {/* Tonight teaser */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See your cycle week ahead"
            className="mt-4 flex-row items-center gap-4 rounded-card p-5"
            style={{ backgroundColor: colors.night }}
            onPress={() => {
              haptics.select();
              router.push('/cycle/week');
            }}>
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: colors.nightSurface }}>
              <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
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
        </ScrollView>
      </Screen>
    );
  }

  // ---- PM (dark). Driven by the orchestrated, profile-aware cycle ----
  const nightNumber = cTonight ? cTonight.index + 1 : 2;
  const nightTotal = cycle?.lengthNights ?? FALLBACK_SLOTS.length;
  // Tonight's cycled active comes from the engine (suppressed correctly for
  // pregnancy etc.). Not from a hardcoded literal. Skipped/recovery nights drop it.
  const cycledStep =
    !skippedTonight && !recoveryActive && cTonight?.night.productId
      ? {
          productId: cTonight.night.productId,
          name: cTonight.night.productName ?? 'Tonight’s active',
          instruction: slotInstruction(cTonight.night.slot),
          order: 40,
        }
      : null;
  const dailyPm = (plan?.pm ?? []).filter((s) => !s.cyclingNight);
  const pmSteps = [...dailyPm, ...(cycledStep ? [cycledStep] : [])].sort((a, b) => a.order - b.order);
  const firstUndonePm = pmSteps.map((s) => stepKey('PM', s.productId)).find((k) => !done.has(k)) ?? null;
  const donePm = pmSteps.filter((s) => done.has(stepKey('PM', s.productId))).length;
  const suppressedAcidName =
    tonightSlot === 'retinoid' && cycle ? (cycle.nights.find((n) => n.slot === 'exfoliate')?.productName ?? null) : null;
  const nextAcidISO = cycleData?.nextAcidNight ?? null;

  return (
    <Screen tone="night" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <ReverseTrialBanner tone="night" />
        <Text variant="label" tone="inverseMuted" className="font-mono mt-1">
          {dateLabel.toUpperCase()} · 9:41 PM
        </Text>
        <Text variant="title" tone="inverse" className="mt-2">
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
            }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.sage }} />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
              Recovery mode · day {cycleData.recovery.day} of {cycleData.recovery.days}. Barrier support
              tonight.
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
            }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
              Your cycle is paused. Resume whenever you&apos;re ready.
            </Text>
            <Text style={{ color: 'rgba(244,239,231,0.4)' }}>›</Text>
          </Pressable>
        ) : skippedTonight ? (
          <View className="mt-6 flex-row items-center gap-3 rounded-card px-5 py-4" style={{ backgroundColor: colors.nightSurface }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.8)' }}>
              You skipped tonight. Nothing breaks, your cycle picks up tomorrow.
            </Text>
          </View>
        ) : null}

        {/* Skin-cycling strip. Taps through to the week overview (docs/05 §6.1) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See your cycle week ahead"
          className="mt-4 rounded-card p-5"
          style={{ backgroundColor: colors.nightSurface }}
          onPress={() => {
            haptics.select();
            router.push('/cycle/week');
          }}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-sans-bold text-[13px] uppercase tracking-[1px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
              Skin cycling · night {nightNumber} of {nightTotal}
            </Text>
            <Text className="text-[12px]" style={{ color: colors.clayBright }}>
              Week ahead ›
            </Text>
          </View>
          <View className="flex-row gap-2">
            {(cycle ? cycle.nights.map((n) => slotLabel(n.slot)) : FALLBACK_SLOTS).map((label, i) => {
              const active = cTonight ? i === cTonight.index : i + 1 === nightNumber;
              return (
                <View key={i} className="flex-1">
                  <View className="h-1.5 rounded-pill" style={{ backgroundColor: active ? colors.clayBright : 'rgba(244,239,231,0.16)' }} />
                  <Text
                    numberOfLines={1}
                    className="mt-2 text-center text-[10.5px]"
                    style={{ color: active ? colors.clayBright : 'rgba(244,239,231,0.45)', fontWeight: active ? '700' : '400' }}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Pressable>

        {/* Evening routine */}
        <View className="mt-4 rounded-card p-5" style={{ backgroundColor: colors.nightSurface }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-sans-bold text-[16px]" style={{ color: colors.cream }}>
              Evening routine
            </Text>
            <Text className="font-mono text-[12px]" style={{ color: 'rgba(244,239,231,0.45)' }}>
              {donePm} of {pmSteps.length}
            </Text>
          </View>
          {pmSteps.map((s) => {
            const k = stepKey('PM', s.productId);
            return (
              <CheckRow
                key={k}
                name={s.name}
                sub={s.instruction}
                state={rowState(k, firstUndonePm)}
                dark
                onPress={() => void toggle(k)}
              />
            );
          })}
        </View>

        {/* Auto-resolution banner. The Doc-2 resolution rendered (docs/03 §5) */}
        {suppressedAcidName ? (
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl px-5 py-4" style={{ backgroundColor: 'rgba(217,161,131,0.10)' }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.75)', lineHeight: 20 }}>
              Your {suppressedAcidName.toLowerCase()} is on alternate nights. Kept off your retinoid
              night to protect your barrier.{nextAcidISO ? ` Next acid night: ${friendlyWeekday(nextAcidISO)}.` : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
