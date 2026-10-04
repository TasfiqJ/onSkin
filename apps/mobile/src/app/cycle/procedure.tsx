import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { canUseRoutineCadence, canUseRoutineRecovery } from '@/features/routine/reviewGate';
import {
  shippableRoutineCadencePolicy,
  shippableRoutineGuidanceCopy,
} from '@/features/routine/sequencing';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import {
  CycleRouteReadinessNotice,
  useCycleRouteReadiness,
} from '@/features/scheduler/CycleRouteReadiness';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Post-procedure recovery (design screen 05, docs/05 §6.4/§7). After a peel or
// facial, pause actives and simplify to barrier basics for a chosen window, then
// resume. Exact windows and explanatory copy come from the admitted corpus.

export default function ProcedureScreen() {
  const cadencePolicy = shippableRoutineCadencePolicy();
  const guidanceCopy = shippableRoutineGuidanceCopy();
  if (!canUseRoutineCadence() || !canUseRoutineRecovery() || !cadencePolicy || !guidanceCopy) {
    return <CadenceReviewGate />;
  }
  return (
    <ProcedureScreenContent
      defaultDays={cadencePolicy.recoveryWindows.defaultProcedureDays}
      explanation={guidanceCopy.recoveryProcedureExplanation}
      restChoices={cadencePolicy.recoveryWindows.procedureChoicesDays}
    />
  );
}

function ProcedureScreenContent({
  defaultDays,
  explanation,
  restChoices,
}: {
  defaultDays: number;
  explanation: string;
  restChoices: readonly number[];
}) {
  const cycleSource = useCycle();
  const readiness = useCycleRouteReadiness(cycleSource);
  const m = useCycleMutations();
  const [days, setDays] = useState(defaultDays);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  if (!readiness.data) return <ProcedureSourceState readiness={readiness} />;

  async function beginRecovery() {
    if (saving || !readiness.isCurrent()) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await m.beginRecovery(days, 'procedure');
      if (!cycleSource.isSourceCurrent({ afterConfigCommit: true })) return;
      router.replace('/cycle/recovery');
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="mt-2">
          <RouteIconButton
            accessibilityLabel="Back"
            disabled={saving}
            onPress={() => backOrReplace(router)}
          />
        </View>

        <View className="mt-2 h-12 w-12 items-center justify-center rounded-full bg-clay-tint">
          <Text className="text-[18px] text-clay">◇</Text>
        </View>
        <Text
          variant="title"
          className="mt-5 text-[31px] leading-[34px]"
          accessibilityRole="header"
        >
          Let&apos;s give your skin a few days.
        </Text>
        <Text variant="body" tone="muted" className="mt-2">
          {explanation}
        </Text>

        <Text variant="eyebrow" tone="clay" className="mb-2.5 mt-6">
          How long to rest?
        </Text>
        <View className="flex-row gap-2">
          {restChoices.map((d) => {
            const sel = days === d;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving, selected: sel }}
                disabled={saving}
                onPress={() => {
                  if (!readiness.isCurrent()) return;
                  haptics.select();
                  setDays(d);
                  setSaveFailed(false);
                }}
                className={cn(
                  'min-h-[58px] flex-1 items-center justify-center rounded-[14px] bg-paper-raised py-3.5',
                  sel ? 'border-2 border-clay' : 'border border-hairline-strong',
                )}
                style={{ opacity: saving ? 0.55 : 1 }}
              >
                <Text className="font-sans-bold text-[18px]" tone={sel ? 'clay' : 'ink'}>
                  {d}
                </Text>
                <Text variant="bodySm" tone="muted">
                  days
                </Text>
              </Pressable>
            );
          })}
        </View>

        {saveFailed ? <CycleMutationError /> : null}
      </ScrollView>

      <View className="bg-paper pb-4 pt-3">
        <Button
          disabled={saving}
          label={saving ? 'Starting recovery...' : saveFailed ? 'Try again' : 'Start recovery'}
          onPress={() => void beginRecovery()}
        />
      </View>
    </Screen>
  );
}

function ProcedureSourceState({
  readiness,
}: {
  readiness: ReturnType<typeof useCycleRouteReadiness>;
}) {
  if (readiness.state === 'ready') return null;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2">
        <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router)} />
      </View>
      <CycleRouteReadinessNotice
        className="mt-6"
        state={readiness.state}
        retrying={readiness.retrying}
        onRetry={() => void readiness.retry()}
      />
    </Screen>
  );
}

function CadenceReviewGate() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2">
        <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router)} />
      </View>
      <View className="mt-6 rounded-[8px] bg-paper-raised p-5">
        <Text variant="body" className="font-sans-semibold">
          Cycle recovery controls are unavailable.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-2">
          These controls stay unavailable until their exact rules and copy complete required
          professional review.
        </Text>
      </View>
    </Screen>
  );
}
