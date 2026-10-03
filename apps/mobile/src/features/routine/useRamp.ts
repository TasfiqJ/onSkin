import { useQuery, useQueryClient } from '@tanstack/react-query';

import { canUseRoutineCadence, canUseRoutineRecovery } from '@/features/routine/reviewGate';
import { assertRoutineCadenceMutationAdmission } from '@/features/scheduler/cycleStore';
import { localDateString } from '@/features/today/useToday';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';

import { shouldOfferStepUp } from './ramp';
import { ensureRamp, getStoredRamps, stepUpRamp, type StoredRamp } from './rampStore';
import { usePlan } from './usePlan';

// Live ramp state for the ramp + tolerance surfaces (docs/03 §4). Merges the plan's
// generated initial ramps with the persisted per-product overrides (rampStore), and
// derives the offer-only step-up gate from the pure shouldOfferStepUp. Replaces the
// hardcoded ramp screen with real, persisted state (the offer never auto-escalates).

export type RampItem = {
  productId: string;
  name: string;
  state: StoredRamp;
  offerStepUp: boolean;
};

export function useRamp(): {
  items: RampItem[];
  isLoading: boolean;
  isError: boolean;
  sourceReady: boolean;
  isExample: boolean;
  isRefreshing: boolean;
  /** The captured ramp and plan inputs must still be current at action time. */
  isSourceCurrent: () => boolean;
  /** Re-read persisted ramps; never acknowledge a retained error locally. */
  retry: () => Promise<void>;
  acceptStepUp: (productId: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const plan = usePlan();
  const planCurrent = plan.sourceReady && !plan.isError && !plan.isLoading &&
    !plan.isRefreshing && plan.isSourceCurrent();
  const planData = planCurrent ? plan.data : undefined;
  const planLoading = plan.isLoading;
  const planRamps = planData?.plan.ramp ?? [];
  const cadenceReady = canUseRoutineCadence();
  const recoveryReady = canUseRoutineRecovery();
  const today = localDateString();
  const keyIds = planRamps.map((r) => r.productId).join(',');

  function assertPlanCurrent(): void {
    if (!planCurrent || !plan.isSourceCurrent()) throw new Error('ROUTINE_PLAN_SOURCE_UNAVAILABLE');
  }

  const queryKey = ['ramp', keyIds, plan.orderLease] as const;
  const q = useQuery<RampItem[]>({
    // The record format is unchanged; a successor lease must not reuse old ramp query data.
    queryKey,
    enabled: cadenceReady && planCurrent,
    queryFn: () =>
      runCurrentHealthDataOperation(async (lease) => {
        assertRoutineCadenceMutationAdmission();
        lease.assertCurrent();
        assertPlanCurrent();
        const stored = await getStoredRamps();
        lease.assertCurrent();
        assertPlanCurrent();
        const items: RampItem[] = [];
        for (const r of planRamps) {
          // Use the stored override if present; otherwise lazily seed from the plan's
          // generated initial so the screen always has real, persisted state.
          lease.assertCurrent();
          assertPlanCurrent();
          const state = stored[r.productId] ?? (await ensureRamp(r.productId, r.state));
          lease.assertCurrent();
          assertPlanCurrent();
          items.push({
            productId: r.productId,
            name: r.name,
            state,
            offerStepUp: shouldOfferStepUp({
              startedAt: state.startedAt,
              lastStepUp: state.lastStepUp,
              freqPerWeek: state.freqPerWeek,
              targetPerWeek: state.targetPerWeek,
              toleranceState: state.toleranceState,
              today,
            }),
          });
        }
        lease.assertCurrent();
        assertPlanCurrent();
        return items;
      }),
  });

  function acceptStepUp(productId: string): Promise<void> {
    assertRoutineCadenceMutationAdmission();
    assertPlanCurrent();
    return runCurrentHealthDataOperation(async (lease) => {
      assertRoutineCadenceMutationAdmission();
      lease.assertCurrent();
      assertPlanCurrent();
      await stepUpRamp(productId);
      assertRoutineCadenceMutationAdmission();
      lease.assertCurrent();
      assertPlanCurrent();
      await qc.invalidateQueries({ queryKey: ['ramp'] });
      lease.assertCurrent();
    });
  }

  const items = !cadenceReady || !planCurrent
    ? []
    : (q.data ?? []).filter(
        (item) => recoveryReady || item.state.toleranceState !== 'paused_irritation',
      );
  const isLoading = cadenceReady && (planLoading || plan.isRefreshing || q.isLoading);
  const isError = cadenceReady && (plan.isError || q.isError);
  const isRefreshing = cadenceReady && Boolean(plan.isRefreshing || q.isFetching);
  const sourceReady = Boolean(
    cadenceReady && planCurrent && !isLoading && !isError && !isRefreshing &&
    !q.isPaused && q.data !== undefined,
  );
  function isSourceCurrent(): boolean {
    if (!sourceReady || !canUseRoutineCadence() || !plan.isSourceCurrent()) return false;
    const current = qc.getQueryState(queryKey);
    return current?.status === 'success' && current.fetchStatus === 'idle' &&
      !current.isInvalidated && current.data === q.data;
  }
  async function retry(): Promise<void> {
    assertRoutineCadenceMutationAdmission();
    assertPlanCurrent();
    await q.refetch({ cancelRefetch: false, throwOnError: true });
    assertPlanCurrent();
  }
  return {
    items,
    isLoading,
    isError,
    sourceReady,
    isExample: plan.isExample,
    isRefreshing,
    isSourceCurrent,
    retry,
    acceptStepUp,
  };
}
