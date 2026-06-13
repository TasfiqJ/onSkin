import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useCycleAnchor } from '@/features/routine/cycleAnchor';
import { CYCLE_TEMPLATES, friendlyWeekday, nightForDate, nextNightWithSlot } from '@/features/intelligence/scheduler';
import { usePlan } from '@/features/routine/usePlan';
import { useProgress } from '@/features/routine/useProgress';
import { currentRoutineType, localDateString } from '@/features/today/useToday';
import { cn } from '@/lib/cn';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

// Today — the daily habit loop (design 04 AM light / 05 PM dark, docs/03 §6/§9).
// The check-off is the north-star activation metric. AM is paper, PM is night with
// the skin-cycling strip + the Doc-2 auto-resolution banner ("next acid night").
// Check-off is local/optimistic here; it binds to routine_completions once
// routines are persisted (B-SUPABASE).
const CLASSIC = CYCLE_TEMPLATES.classic_4; // the strip the design shows (Exfoliate/Retinoid/Recover/Recover)
const SLOT_LABELS = ['Exfoliate', 'Retinoid', 'Recover', 'Recover'];

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
  const { data: anchor } = useCycleAnchor();
  const [done, setDone] = useState<Set<string>>(new Set());
  const plan = planData?.plan;
  const today = localDateString();

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rowState = (id: string, firstUndoneId: string | null): 'done' | 'next' | 'pending' =>
    done.has(id) ? 'done' : id === firstUndoneId ? 'next' : 'pending';

  const dateLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ---- AM ----
  if (!dark) {
    const steps = plan?.am ?? [];
    const firstUndone = steps.find((s) => !done.has(s.productId))?.productId ?? null;
    const doneCount = steps.filter((s) => done.has(s.productId)).length;
    return (
      <Screen edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
          <View className="mt-1 flex-row items-start justify-between">
            <Text variant="label" tone="muted" className="font-mono mt-1">
              {dateLabel.toUpperCase()}
            </Text>
            {progress && progress.streak > 0 ? (
              <View className="flex-row items-center gap-1.5 rounded-pill bg-clay-tint px-3.5 py-1.5">
                <View className="h-1.5 w-1.5 rounded-full bg-clay" />
                <Text className="font-sans-bold text-[13px]" style={{ color: colors.clayDeep }}>
                  {progress.streak} days
                </Text>
              </View>
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
            {steps.map((s) => (
              <CheckRow
                key={s.productId}
                name={s.name}
                sub={s.instruction}
                state={rowState(s.productId, firstUndone)}
                dark={false}
                onPress={() => toggle(s.productId)}
              />
            ))}
          </View>

          {/* Tonight teaser */}
          <Pressable
            accessibilityRole="button"
            className="mt-4 flex-row items-center gap-4 rounded-card p-5"
            style={{ backgroundColor: colors.night }}
            onPress={() => {
              /* PM view shows after 5pm; teaser is informational */
            }}>
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: colors.nightSurface }}>
              <View className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-[15px]" style={{ color: colors.cream }}>
                Tonight · Cycling night 2
              </Text>
              <Text className="text-[13px]" style={{ color: 'rgba(244,239,231,0.55)' }}>
                Retinoid night — keep it simple
              </Text>
            </View>
            <Text style={{ color: 'rgba(244,239,231,0.4)', fontSize: 20 }}>›</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  // ---- PM (dark) ----
  const night = plan?.cycle && anchor ? nightForDate(CLASSIC, anchor, today) : { index: 2, slot: 'retinoid' as const, total: 4 };
  const dailyPm = (plan?.pm ?? []).filter((s) => !s.cyclingNight);
  const tonightActive = (plan?.pm ?? []).find((s) => s.cyclingNight === night.index);
  const pmSteps = [...dailyPm, ...(tonightActive ? [tonightActive] : [])].sort((a, b) => a.order - b.order);
  const firstUndonePm = pmSteps.find((s) => !done.has(s.productId))?.productId ?? null;
  const donePm = pmSteps.filter((s) => done.has(s.productId)).length;
  const suppressedAcid = night.slot === 'retinoid' ? (plan?.pm ?? []).find((s) => s.role === 'exfoliant') : undefined;
  const nextAcidISO = anchor ? nextNightWithSlot(CLASSIC, anchor, today, 'exfoliate') : null;

  return (
    <Screen tone="night" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <Text variant="label" tone="inverseMuted" className="font-mono mt-1">
          {dateLabel.toUpperCase()} · 9:41 PM
        </Text>
        <Text variant="title" tone="inverse" className="mt-2">
          Good evening.
        </Text>

        {/* Skin-cycling strip */}
        <View className="mt-6 rounded-card p-5" style={{ backgroundColor: colors.nightSurface }}>
          <Text className="mb-4 font-sans-bold text-[13px] uppercase tracking-[1px]" style={{ color: 'rgba(244,239,231,0.5)' }}>
            Skin cycling · night {night.index} of {night.total}
          </Text>
          <View className="flex-row gap-2">
            {SLOT_LABELS.map((label, i) => {
              const active = i + 1 === night.index;
              return (
                <View key={i} className="flex-1">
                  <View className="h-1.5 rounded-pill" style={{ backgroundColor: active ? colors.clayBright : 'rgba(244,239,231,0.16)' }} />
                  <Text
                    className="mt-2 text-center text-[11.5px]"
                    style={{ color: active ? colors.clayBright : 'rgba(244,239,231,0.45)', fontWeight: active ? '700' : '400' }}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

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
          {pmSteps.map((s) => (
            <CheckRow
              key={s.productId}
              name={s.name}
              sub={s.instruction}
              state={rowState(s.productId, firstUndonePm)}
              dark
              onPress={() => toggle(s.productId)}
            />
          ))}
        </View>

        {/* Auto-resolution banner — the Doc-2 resolution rendered (docs/03 §5) */}
        {suppressedAcid ? (
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl px-5 py-4" style={{ backgroundColor: 'rgba(217,161,131,0.10)' }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.clayBright }} />
            <Text className="flex-1 text-[13.5px]" style={{ color: 'rgba(244,239,231,0.75)', lineHeight: 20 }}>
              Your {suppressedAcid.name.toLowerCase()} is skipped tonight — it doesn&apos;t mix well with
              retinol.{nextAcidISO ? ` Next acid night: ${friendlyWeekday(nextAcidISO)}.` : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
