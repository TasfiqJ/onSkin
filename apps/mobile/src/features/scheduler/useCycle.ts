import type { DisruptionReason } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { useRamp } from '@/features/routine/useRamp';
import { useShelf } from '@/features/shelf/useShelf';
import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';

import {
  endRecovery,
  loadCycleConfig,
  overrideStagingProducts,
  pauseCycle,
  recoveryProgress,
  resumeCycle,
  saveCustomCycleDefinition,
  skipTonight,
  startCycleToday,
  startRecovery,
  updateCycleConfig,
  type CycleConfig,
  type RecoveryReason,
} from './cycleStore';
import {
  applyCustomCycleDefinition,
  type CustomCycleDefinition,
  type CycleEditorActive,
} from './customCycle';
import {
  orchestrate,
  type Cycle,
  type NightSlot,
  type ScheduledConflictChoice,
  type SchedulerActive,
} from './orchestrate';
import { useProfileBits } from './profile';
import { nextSlotDate, nightFor, nightIndex, weekAhead, type ProjectedNight } from './projection';

// The scheduler's read hook (docs/05): orchestrates the shelf actives into a
// cycle, layers the user's stored config (variant / pause / recovery / skips),
// and projects tonight + the week ahead. Composed from useShelf so it stays live.

export type CycleData = {
  cycle: Cycle | null;
  recommendedCycle: Cycle | null;
  config: CycleConfig;
  tonight: { index: number; night: NightSlot } | null;
  weekAhead: ProjectedNight[];
  nextAcidNight: string | null; // ISO
  recovery: { active: boolean; day: number; days: number; reason: DisruptionReason | null };
  paused: boolean;
  /** True when the user skipped tonight (docs/05 §7). The cycle still continues. */
  skippedTonight: boolean;
  /** Ids of actives currently staged out by phased introduction (docs/05 §6.2),
   *  so a surface can offer "add it now anyway" against the real product. */
  stagedActiveIds: string[];
  cycleActives: CycleEditorActive[];
  knownProductIds: string[];
  notes: string[];
  conflictChoices: ScheduledConflictChoice[];
};

export function hasUseTogetherChoiceBetween(
  choices: readonly ScheduledConflictChoice[],
  productAId: string | null | undefined,
  productBId: string | null | undefined,
): boolean {
  if (!productAId || !productBId || productAId === productBId) return false;
  return choices.some(
    (record) =>
      record.choice === 'use_together' &&
      record.resolutionType === 'alternate_nights' &&
      record.productIds.includes(productAId) &&
      record.productIds.includes(productBId),
  );
}

function millisecondsUntilNextLocalDay(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  return Math.max(1_000, next.getTime() - now.getTime());
}

function useCycleLocalDate(): string {
  const [today, setToday] = useState(() => localDateString());
  const todayRef = useRef(today);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      const next = localDateString();
      if (next !== todayRef.current) {
        todayRef.current = next;
        setToday(next);
      }
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, millisecondsUntilNextLocalDay());
    };
    const handleAppState = (state: AppStateStatus) => {
      if (state !== 'active') return;
      refresh();
      schedule();
    };

    schedule();
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}

function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export type CycleHookResult = {
  data: CycleData | undefined;
  isLoading: boolean;
  isError: boolean;
  sourceReady: boolean;
  isExample: boolean;
};

export function useCycle(): CycleHookResult {
  const shelf = useShelf();
  const today = useCycleLocalDate();
  const cfg = useQuery({ queryKey: ['cycleConfig', today], queryFn: loadCycleConfig });
  const profile = useProfileBits();
  // Live ramp state (the same source tolerance.tsx writes), so the user's actual
  // ramped frequency reaches the scheduler instead of every active defaulting to
  // the class cap (docs/05 §4: freq = min(ramp.freq_per_week, frequency_cap)).
  const ramp = useRamp();
  const cadenceReady = canUseRoutineCadence();
  // Per-product ramp frequency keyed by engineProduct.id (== user_product id ==
  // rampStore key), built from the merged plan-initial + persisted-override ramp.
  const freqByProductId = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const it of ramp.items) m[it.productId] = it.state.freqPerWeek;
    return m;
  }, [ramp.items]);

  const data = useMemo<CycleData | undefined>(() => {
    if (!shelf.data || !cfg.data || !profile.data) return undefined;
    const config = cfg.data;

    const actives: SchedulerActive[] = shelf.data.items.map((i) => ({
      id: i.engineProduct.id,
      name: i.engineProduct.name,
      tags: i.engineProduct.tags,
      subflags: i.engineProduct.subflags,
      category: i.category,
      concentration: i.engineProduct.concentration,
      // Recently added → phased introduction, unless the user opted to start it
      // now ("add it now anyway", docs/05 §6.2).
      isNew:
        daysSince(i.product.createdAt) <= 3 &&
        !config.stagingOverrides.includes(i.engineProduct.id),
    }));
    const {
      cycle: recommendedCycle,
      amDaily,
      cycleActives,
      notes,
      conflictChoices,
    } = orchestrate(actives, {
      sensitivity: profile.data.sensitivity,
      pregnancy: profile.data.pregnancy,
      pregnancySafety: profile.data.pregnancySafety,
      pregnancyStatus: profile.data.pregnancyStatus,
      goals: profile.data.goals,
      preferredVariant:
        config.variant === 'auto' || config.variant === 'custom' ? null : config.variant,
      freqByProductId,
      conflictChoices: shelf.data.conflictChoices,
    });
    const cycle =
      cadenceReady && config.variant === 'custom' && config.customCycle
        ? applyCustomCycleDefinition({
            definition: config.customCycle,
            actives: cycleActives,
            amDaily,
            notes,
          })
        : recommendedCycle;
    const stagedActiveIds = cycleActives
      .filter((active) => active.staged)
      .map((active) => active.id);

    const anchor = config.anchorISO;
    const tonight = cycle
      ? { index: nightIndex(cycle, anchor, today), night: nightFor(cycle, anchor, today) }
      : null;
    const week = cycle ? weekAhead(cycle, anchor, today) : [];
    const nextAcidNight = cycle ? nextSlotDate(cycle, anchor, today, 'exfoliate') : null;
    const rec = recoveryProgress(config.recovery, today);

    return {
      cycle,
      recommendedCycle,
      config,
      tonight,
      weekAhead: week,
      nextAcidNight,
      recovery: { ...rec, reason: config.recovery?.reason ?? null },
      paused: config.pausedFrom != null,
      skippedTonight: config.skips.includes(today),
      stagedActiveIds,
      cycleActives,
      knownProductIds: actives.map((active) => active.id),
      notes,
      conflictChoices,
    };
  }, [shelf.data, cfg.data, profile.data, freqByProductId, today, cadenceReady]);

  const isLoading = shelf.isLoading || cfg.isLoading || profile.isLoading || ramp.isLoading;
  const isError = shelf.isError || cfg.isError || profile.isError || ramp.isError;
  return {
    data,
    isLoading,
    isError,
    sourceReady: Boolean(
      !isLoading &&
      !isError &&
      shelf.data !== undefined &&
      cfg.data !== undefined &&
      profile.data !== undefined &&
      profile.data.source !== 'unavailable' &&
      ramp.sourceReady &&
      data !== undefined,
    ),
    isExample: ramp.isExample,
  };
}

export function useCycleMutations() {
  const qc = useQueryClient();
  const commit = (operation: () => Promise<CycleConfig>, afterCommit?: () => void): Promise<void> =>
    runCurrentHealthDataOperation(async (lease) => {
      lease.assertCurrent();
      await qc.cancelQueries({ queryKey: ['cycleConfig'] });
      lease.assertCurrent();
      const next = await operation();
      lease.assertCurrent();
      qc.setQueryData<CycleConfig>(['cycleConfig', localDateString()], next);
      lease.assertCurrent();
      afterCommit?.();
      lease.assertCurrent();
    });
  return {
    setVariant(variant: CycleConfig['variant']) {
      return commit(
        () => updateCycleConfig({ variant }),
        () => track('cycle_variant_changed', { variant }),
      );
    },
    saveCustom(definition: CustomCycleDefinition, variantChanged: boolean) {
      return commit(
        () => saveCustomCycleDefinition(definition),
        () => {
          if (variantChanged) track('cycle_variant_changed', { variant: 'custom' });
          track('routine_edited', { action: 'cycle_customized', source: 'cycle_settings' });
        },
      );
    },
    start() {
      return commit(startCycleToday, () => track('cycle_started'));
    },
    pause(reason: DisruptionReason) {
      return commit(
        () => pauseCycle(reason),
        () => track('cycle_paused'),
      );
    },
    resume() {
      return commit(resumeCycle, () => track('cycle_resumed'));
    },
    skip() {
      return commit(skipTonight, () => track('night_skipped'));
    },
    overrideStaging(productIds: readonly string[]) {
      return commit(
        () => overrideStagingProducts(productIds),
        () => track('phased_intro_overridden'),
      );
    },
    beginRecovery(days: number, reason: RecoveryReason) {
      return commit(
        () => startRecovery(days, reason),
        () => track('cycle_recovery_started'),
      );
    },
    finishRecovery() {
      return commit(endRecovery);
    },
  };
}
