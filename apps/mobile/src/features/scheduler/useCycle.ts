import type { DisruptionReason } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useShelf } from '@/features/shelf/useShelf';
import { localDateString } from '@/features/today/useToday';

import {
  endRecovery,
  loadCycleConfig,
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
  notes: string[];
};

function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function useCycle(): { data: CycleData | undefined; isLoading: boolean } {
  const shelf = useShelf();
  const cfg = useQuery({ queryKey: ['cycleConfig'], queryFn: loadCycleConfig });
  const profile = useProfileBits();
  const today = localDateString();

  const data = useMemo<CycleData | undefined>(() => {
    if (!shelf.data || !cfg.data || !profile.data) return undefined;
    const config = cfg.data;

    const actives: SchedulerActive[] = shelf.data.items.map((i) => ({
      id: i.engineProduct.id,
      name: i.engineProduct.name,
      tags: i.engineProduct.tags,
      isNew: daysSince(i.product.createdAt) <= 3, // recently added → phased introduction
    }));

    const { cycle, notes } = orchestrate(actives, {
      sensitivity: profile.data.sensitivity,
      pregnancy: profile.data.pregnancy,
      goals: profile.data.goals,
      preferredVariant: config.variant === 'auto' ? null : config.variant,
    });

    const anchor = config.anchorISO;
    const tonight = cycle ? { index: nightIndex(cycle, anchor, today), night: nightFor(cycle, anchor, today) } : null;
    const week = cycle ? weekAhead(cycle, anchor, today, 4) : [];
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
      notes,
    };
  }, [shelf.data, cfg.data, profile.data, today]);

  return { data, isLoading: shelf.isLoading || cfg.isLoading || profile.isLoading };
}

export function useCycleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['cycleConfig'] });
  return {
    async setVariant(variant: CycleConfig['variant']) {
      await updateCycleConfig({ variant });
      await invalidate();
    },
    async start() {
      await startCycleToday();
      await invalidate();
    },
    async pause(reason: DisruptionReason) {
      await pauseCycle(reason);
      await invalidate();
    },
    async resume() {
      await resumeCycle();
      await invalidate();
    },
    async skip() {
      await skipTonight();
      await invalidate();
    },
    async beginRecovery(days: number, reason: DisruptionReason) {
      await startRecovery(days, reason);
      await invalidate();
    },
    async finishRecovery() {
      await endRecovery();
      await invalidate();
    },
  };
}
