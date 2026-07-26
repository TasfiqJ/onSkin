import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { applyToleranceToRamps } from '@/features/routine/rampStore';
import { canUseRoutineCadence, canUseRoutineRecovery } from '@/features/routine/reviewGate';
import { shippableRoutineCadencePolicy } from '@/features/routine/sequencing';
import { useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { APP_HOME_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// 07 · Weekly tolerance check-in (design 07, docs/03 §4). The ONLY assessment ,
// optional, explicitly non-diagnostic. That tunes the ramp cadence. Each answer
// states exactly what the app will do (comfortable → offer step-up; dry → hold;
// irritated → add recovery & ease off).
const OPTIONS = [
  {
    id: 'comfortable',
    title: 'Comfortable',
    sub: 'We may offer a small step-up',
    swatch: colors.sageTint,
    dot: colors.sage,
    restingBorder: colors.hairline,
  },
  {
    id: 'a_bit_dry',
    title: 'A bit dry',
    sub: "We'll hold your pace steady",
    swatch: colors.clayTint,
    dot: colors.clayBright,
    restingBorder: colors.hairline,
  },
  // Irritated carries a pre-emphasised amber inset border at rest (design 07).
  {
    id: 'irritated',
    title: 'Irritated',
    sub: "We'll add recovery nights & ease off",
    swatch: 'rgba(176,122,60,0.14)',
    dot: colors.amber,
    restingBorder: 'rgba(176,122,60,0.4)',
  },
] as const;
type ToleranceAnswer = (typeof OPTIONS)[number]['id'];

export default function ToleranceScreen() {
  const cadenceReady = canUseRoutineCadence();
  const recoveryReady = canUseRoutineRecovery();
  const cadencePolicy = shippableRoutineCadencePolicy();
  if (!cadenceReady || !recoveryReady || !cadencePolicy) {
    return <ToleranceReviewGate />;
  }
  return <ToleranceCheckIn irritationRecoveryDays={cadencePolicy.recoveryWindows.irritationDays} />;
}

function ToleranceCheckIn({ irritationRecoveryDays }: { irritationRecoveryDays: number }) {
  const { height } = useWindowDimensions();
  const [selected, setSelected] = useState<ToleranceAnswer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<'unchanged' | 'recovery_only' | null>(null);
  const [recoveryStarted, setRecoveryStarted] = useState(false);
  const m = useCycleMutations();
  const qc = useQueryClient();
  const compactSheet = height < 640;

  // Each answer states what the app does (docs/03 §4 / docs/05 §7) and now PERSISTS to
  // the ramp: comfortable marks steady (a step-up may be offered later), a bit dry
  // holds the pace, irritated de-escalates the ramp AND starts a barrier-recovery
  // window. Previously comfortable/dry did nothing (review fix).
  const onSave = async () => {
    if (!selected || saving || !canUseRoutineCadence() || !canUseRoutineRecovery()) return;
    setSaving(true);
    setSaveFailure(null);
    let recoveryIsActive = recoveryStarted;
    try {
      // Put the safety-preserving recovery state in place first. If that write
      // fails, the ramp is untouched; if the later ramp write fails, retry is
      // idempotent and the already-active recovery still withholds actives.
      if (selected === 'irritated' && !recoveryIsActive) {
        await m.beginRecovery(irritationRecoveryDays, 'irritation');
        recoveryIsActive = true;
        setRecoveryStarted(true);
      }
      await applyToleranceToRamps(selected);
      await qc.invalidateQueries({ queryKey: ['ramp'] });
      if (selected === 'irritated') {
        router.replace('/cycle/recovery');
        return;
      }
      backOrReplace(router);
    } catch {
      setSaveFailure(recoveryIsActive ? 'recovery_only' : 'unchanged');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      fallbackRoute={APP_HOME_ROUTE}
      scroll
      backdropAccessible={!compactSheet}
      dismissDisabled={saving}
      className={compactSheet ? 'pb-6' : undefined}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip tolerance check-in"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        className={cn(
          'min-h-[48px] min-w-[48px] self-end items-center justify-center px-2',
          compactSheet ? 'mb-0' : 'mb-1',
        )}
        onPress={() => backOrReplace(router)}
        style={{ opacity: saving ? 0.55 : 1 }}
      >
        <Text variant="body" tone="muted" className="font-sans-semibold text-[14px]">
          Skip
        </Text>
      </Pressable>
      <Text variant="label" tone="clay" className="font-mono">
        ONE QUICK CHECK-IN
      </Text>
      <Text
        variant="title"
        className={compactSheet ? 'mt-1.5 text-[29px] leading-[32px]' : 'mt-2.5 text-[33px]'}
      >
        How did your skin feel this week?
      </Text>
      <Text
        variant="bodySm"
        tone="muted"
        className={compactSheet ? 'mt-1.5 text-[13px] leading-[18px]' : 'mt-2 text-[14px]'}
      >
        It only tunes your pace. Nothing here is a diagnosis. Optional, always.
      </Text>

      <View className={compactSheet ? 'mt-4 gap-2' : 'mt-6 gap-2.5'}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={`${o.title}. ${o.sub}`}
            accessibilityState={{
              disabled: saving || recoveryStarted,
              selected: selected === o.id,
            }}
            disabled={saving || recoveryStarted}
            className={cn(
              'flex-row items-center rounded-[18px] bg-paper-raised',
              compactSheet ? 'h-[72px] min-h-[72px] gap-3 px-3.5 py-2.5' : 'gap-3.5 p-4',
            )}
            style={{
              borderWidth: selected === o.id ? 2 : 1,
              borderColor: selected === o.id ? colors.clay : o.restingBorder,
              opacity: saving || recoveryStarted ? 0.55 : 1,
            }}
            onPress={() => {
              setSelected(o.id);
              setSaveFailure(null);
            }}
          >
            <View
              className="h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ backgroundColor: o.swatch }}
            >
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: o.dot }} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[15.5px]">{o.title}</Text>
              <Text className="mt-0.5 text-[12.5px]" style={{ color: colors.muted }}>
                {o.sub}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {saveFailure ? (
        <View accessibilityRole="alert" className="mt-3 rounded-[8px] bg-clay-tint p-3.5">
          <Text className="font-sans-semibold text-[13.5px]" style={{ color: colors.ink }}>
            {saveFailure === 'recovery_only' ? 'Pace not updated' : 'Check-in not saved'}
          </Text>
          <Text variant="bodySm" tone="muted" className="mt-1 text-[12.5px]">
            {saveFailure === 'recovery_only'
              ? 'Recovery mode is on, so actives remain paused. Try again to finish updating your pace.'
              : 'Your previous pace and cycle are still in place. Try again when private storage is available.'}
          </Text>
        </View>
      ) : null}

      <Button
        className={compactSheet ? 'mt-3 h-[48px] min-h-[48px] py-2.5' : 'mt-6'}
        label={saving ? 'Saving...' : saveFailure ? 'Try again' : 'Save'}
        disabled={!selected || saving}
        onPress={() => void onSave()}
      />
    </Sheet>
  );
}

function ToleranceReviewGate() {
  const { height } = useWindowDimensions();
  const compactSheet = height < 640;

  return (
    <Sheet
      fallbackRoute={APP_HOME_ROUTE}
      scroll
      backdropAccessible={!compactSheet}
      className={compactSheet ? 'pb-6' : undefined}
    >
      <Text variant="label" tone="clay" className="font-mono">
        CHECK-IN UNAVAILABLE
      </Text>
      <Text variant="title" className="mt-2.5 text-[33px]">
        Weekly check-ins open after review.
      </Text>
      <Text variant="bodySm" tone="muted" className="mt-2 text-[14px]">
        Your existing daily routine is still available and unchanged. Check-in guidance and any
        cadence or recovery changes stay unavailable until their exact rules and copy complete all
        required independent professional review.
      </Text>
      <Button
        className={compactSheet ? 'mt-4 h-[48px] min-h-[48px] py-2.5' : 'mt-6'}
        label="Back to routine"
        onPress={() => backOrReplace(router)}
      />
    </Sheet>
  );
}
