import type { DisruptionReason } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useRamp } from '@/features/routine/useRamp';
import { useShelf } from '@/features/shelf/useShelf';
import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';

import {
  endRecovery,
  loadCycleConfig,
  overrideStaging,
  pauseCycle,
  recoveryProgress,
  resumeCycle,
  skipTonight,
  startCycleToday,
  startRecovery,
  updateCycleConfig,
  type CycleConfig,
} from './cycleStore';
import { orchestrate, type Cycle, type NightSlot, type SchedulerActive } from './orchestrate';
import { useProfileBits } from './profile';
import { nextSlotDate, nightFor, nightIndex, weekAhead, type ProjectedNight } from './projection';

// The scheduler's read hook (docs/05): orchestrates the shelf actives into a
// cycle, layers the user's stored config (variant / pause / recovery / skips),
// and projects tonight + the week ahead. Composed from useShelf so it stays live.

export type CycleData = {
  cycle: Cycle | null;
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
  notes: string[];
};

function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function useCycle(): { data: CycleData | undefined; isLoading: boolean } {
  const shelf = useShelf();
  const cfg = useQuery({ queryKey: ['cycleConfig'], queryFn: loadCycleConfig });
  const profile = useProfileBits();
  // Live ramp state (the same source tolerance.tsx writes), so the user's actual
  // ramped frequency reaches the scheduler instead of every active defaulting to
  // the class cap (docs/05 §4: freq = min(ramp.freq_per_week, frequency_cap)).
  const ramp = useRamp();
  const today = localDateString();

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
      category: i.category,
      concentration: i.engineProduct.concentration,
      // Recently added → phased introduction, unless the user opted to start it
      // now ("add it now anyway", docs/05 §6.2).
      isNew:
        daysSince(i.product.createdAt) <= 3 &&
        !config.stagingOverrides.includes(i.engineProduct.id),
    }));
    const stagedActiveIds = actives.filter((a) => a.isNew).map((a) => a.id);

    const { cycle, notes } = orchestrate(actives, {
      sensitivity: profile.data.sensitivity,
      pregnancy: profile.data.pregnancy,
      pregnancySafety: profile.data.pregnancySafety,
      pregnancyStatus: profile.data.pregnancyStatus,
      goals: profile.data.goals,
      preferredVariant: config.variant === 'auto' ? null : config.variant,
      freqByProductId,
    });

    const anchor = config.anchorISO;
    const tonight = cycle
      ? { index: nightIndex(cycle, anchor, today), night: nightFor(cycle, anchor, today) }
      : null;
    const week = cycle ? weekAhead(cycle, anchor, today) : [];
    const nextAcidNight = cycle ? nextSlotDate(cycle, anchor, today, 'exfoliate') : null;
    const rec = recoveryProgress(config.recovery, today);

    return {
      cycle,
      config,
      tonight,
      weekAhead: week,
      nextAcidNight,
      recovery: { ...rec, reason: config.recovery?.reason ?? null },
      paused: config.pausedFrom != null,
      skippedTonight: config.skips.includes(today),
      stagedActiveIds,
      notes,
    };
  }, [shelf.data, cfg.data, profile.data, freqByProductId, today]);

  return {
    data,
    isLoading: shelf.isLoading || cfg.isLoading || profile.isLoading || ramp.isLoading,
  };
}

export function useCycleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['cycleConfig'] });
  return {
    async setVariant(variant: CycleConfig['variant']) {
      await updateCycleConfig({ variant });
      track('cycle_variant_changed', { variant });
      await invalidate();
    },
    async start() {
      await startCycleToday();
      track('cycle_started');
      await invalidate();
    },
    async pause(reason: DisruptionReason) {
      await pauseCycle(reason);
      track('cycle_paused');
      await invalidate();
    },
    async resume() {
      await resumeCycle();
      track('cycle_resumed');
      await invalidate();
    },
    async skip() {
      await skipTonight();
      track('night_skipped');
      await invalidate();
    },
    async overrideStaging(productId: string) {
      await overrideStaging(productId);
      track('phased_intro_overridden');
      await invalidate();
    },
    async beginRecovery(days: number, reason: DisruptionReason) {
      await startRecovery(days, reason);
      track('cycle_recovery_started');
      await invalidate();
    },
    async finishRecovery() {
      await endRecovery();
      await invalidate();
    },
  };
}
