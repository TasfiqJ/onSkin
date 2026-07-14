import type { DisruptionReason } from '@onskin/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { useRamp } from '@/features/routine/useRamp';
import { useShelf } from '@/features/shelf/useShelf';
import { track } from '@/lib/analytics/track';
import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';
import {
  queryKeys,
  runOwnerQueryOperation,
  shouldRefetchCurrentLocalDayQuery,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { commitCycleConfigForOwner } from './cycleMutationCoordinator';
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

function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export type CycleQueryResult = {
  data: CycleData | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  retry: () => Promise<void>;
};

export function useCycle(): CycleQueryResult {
  const shelf = useShelf();
  const ownerScope = useOwnerQueryScope();
  const boundary = useLocalDateBoundary();
  const { localDate: today } = boundary;
  const cfg = useQuery({
    queryKey: queryKeys.cycleConfig(ownerScope, boundary),
    queryFn: () => runOwnerQueryOperation(ownerScope, () => loadCycleConfig()),
    refetchOnReconnect: shouldRefetchCurrentLocalDayQuery,
    refetchOnWindowFocus: shouldRefetchCurrentLocalDayQuery,
  });
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
    // Ramp cadence is a safety input. Never orchestrate with an empty frequency
    // map while its persisted state is pending or unreadable: that would fall
    // back to the higher reviewed class cap and silently increase active nights.
    if (
      !shelf.isSuccess ||
      !cfg.isSuccess ||
      !profile.isSuccess ||
      !ramp.isSuccess ||
      !shelf.data ||
      !cfg.data ||
      !profile.data
    ) {
      return undefined;
    }
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
  }, [
    shelf.isSuccess,
    cfg.isSuccess,
    profile.isSuccess,
    ramp.isSuccess,
    shelf.data,
    cfg.data,
    profile.data,
    freqByProductId,
    today,
    cadenceReady,
  ]);

  async function retry(): Promise<void> {
    await Promise.all([
      shelf.isError ? shelf.refetch() : Promise.resolve(),
      cfg.isError ? cfg.refetch() : Promise.resolve(),
      profile.isError ? profile.refetch() : Promise.resolve(),
      ramp.isError ? ramp.retry() : Promise.resolve(),
    ]);
  }

  return {
    data,
    isLoading: shelf.isLoading || cfg.isLoading || profile.isLoading || ramp.isLoading,
    isError: shelf.isError || cfg.isError || profile.isError || ramp.isError,
    isFetching: shelf.isFetching || cfg.isFetching || profile.isFetching || ramp.isFetching,
    isSuccess:
      shelf.isSuccess && cfg.isSuccess && profile.isSuccess && ramp.isSuccess && data !== undefined,
    retry,
  };
}

export function useCycleMutations() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const commit = async (operation: () => Promise<CycleConfig>): Promise<CycleConfig> => {
    return commitCycleConfigForOwner({
      cancel: (queryKey) => qc.cancelQueries({ queryKey }),
      operation: () => runOwnerQueryOperation(ownerScope, operation),
      publish: (queryKey, next) => qc.setQueryData<CycleConfig>(queryKey, next),
      scope: ownerScope,
    });
  };
  return {
    async setVariant(variant: CycleConfig['variant']) {
      await commit(() => updateCycleConfig({ variant }));
      track('cycle_variant_changed', { variant });
    },
    async saveCustom(definition: CustomCycleDefinition, variantChanged: boolean) {
      await commit(() => saveCustomCycleDefinition(definition));
      if (variantChanged) track('cycle_variant_changed', { variant: 'custom' });
      track('routine_edited', { action: 'cycle_customized', source: 'cycle_settings' });
    },
    async start() {
      await commit(startCycleToday);
      track('cycle_started');
    },
    async pause(reason: DisruptionReason) {
      await commit(() => pauseCycle(reason));
      track('cycle_paused');
    },
    async resume() {
      await commit(resumeCycle);
      track('cycle_resumed');
    },
    async skip() {
      await commit(skipTonight);
      track('night_skipped');
    },
    async overrideStaging(productIds: readonly string[]) {
      await commit(() => overrideStagingProducts(productIds));
      track('phased_intro_overridden');
    },
    async beginRecovery(days: number, reason: RecoveryReason) {
      await commit(() => startRecovery(days, reason));
      track('cycle_recovery_started');
    },
    async finishRecovery() {
      await commit(endRecovery);
    },
  };
}
