import { useQuery, useQueryClient } from '@tanstack/react-query';

import { awaitAccountGenerationLease } from '@/lib/auth/accountGeneration';
import {
  useLocalDateBoundary,
  type LocalDateBoundaryIdentity,
} from '@/lib/query/localDateBoundaryStore';
import {
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
  shouldRefetchCurrentLocalDayQuery,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { shouldOfferStepUp } from './ramp';
import { ensureRamp, getStoredRamps, stepUpRamp, type StoredRamp } from './rampStore';
import { usePlan, type PlanQueryResult } from './usePlan';

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

export type RampPlanSource = Pick<
  PlanQueryResult,
  'data' | 'isError' | 'isFetching' | 'isLoading' | 'isSuccess'
>;

export type RampQueryResult = {
  items: RampItem[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  retry: () => Promise<{ isError: boolean }>;
  acceptStepUp: (productId: string) => Promise<void>;
};

/**
 * Merge persisted ramp state with a route-owned plan and local-day snapshot.
 * Shared Plan recovery stays with the route; this hook retries only the ramp
 * observer it mounts itself.
 */
export function useRampFromPlan(
  planQuery: RampPlanSource,
  boundary: LocalDateBoundaryIdentity,
): RampQueryResult {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const { data: planData } = planQuery;
  // The design-only empty-shelf example is never user state and must not seed
  // private ramp records or participate in the live scheduler.
  const planRamps = planData?.isExample ? [] : (planData?.plan.ramp ?? []);
  const { localDate: today } = boundary;
  const keyIds = planRamps.map((r) => r.productId).join(',');
  const hasRampInputs = planQuery.isSuccess && planRamps.length > 0;

  const q = useQuery<RampItem[]>({
    queryKey: queryKeys.ramp(ownerScope, boundary, keyIds),
    networkMode: 'always',
    // Once an authoritative local read fails, only the explicit recovery action
    // retries it. Focus/reconnect must not hide the failure or hammer unreadable
    // storage before the user can see the fail-closed state.
    refetchOnReconnect: (query) =>
      query.state.status !== 'error' && shouldRefetchCurrentLocalDayQuery(query),
    refetchOnWindowFocus: (query) =>
      query.state.status !== 'error' && shouldRefetchCurrentLocalDayQuery(query),
    retry: false,
    retryOnMount: false,
    enabled: hasRampInputs,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        lease.assertCurrent();
        const stored = await awaitAccountGenerationLease(lease, () => getStoredRamps());
        lease.assertCurrent();
        const items: RampItem[] = [];
        for (const r of planRamps) {
          // Lazy seeding is a write. Assert the captured owner immediately before it.
          let state = stored[r.productId];
          if (!state) {
            lease.assertCurrent();
            state = await ensureRamp(r.productId, r.state);
            lease.assertCurrent();
          }
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
        return items;
      }),
  });

  async function acceptStepUp(productId: string): Promise<void> {
    const item = q.isSuccess
      ? q.data?.find((candidate) => candidate.productId === productId)
      : null;
    if (!item?.offerStepUp) throw new Error('RAMP_STEP_UP_UNAVAILABLE');
    const desiredFreqPerWeek = Math.min(item.state.targetPerWeek, item.state.freqPerWeek + 1);
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      lease.assertCurrent();
      await stepUpRamp(productId, desiredFreqPerWeek);
      lease.assertCurrent();
      await awaitAccountGenerationLease(lease, () =>
        qc.invalidateQueries({ queryKey: ownerQueryPrefixes.ramp(ownerScope) }),
      );
      lease.assertCurrent();
    });
  }

  async function retry(): Promise<{ isError: boolean }> {
    if (!hasRampInputs || !q.isError) return { isError: false };
    const result = await q.refetch();
    return { isError: result.isError };
  }

  return {
    // Retained query data is not authoritative after a failed background read.
    items: q.isSuccess ? (q.data ?? []) : [],
    isLoading: planQuery.isLoading || (hasRampInputs && q.isPending),
    isError: planQuery.isError || (hasRampInputs && q.isError),
    isFetching: planQuery.isFetching || (hasRampInputs && q.isFetching),
    isSuccess: planQuery.isSuccess && (!hasRampInputs || q.isSuccess),
    retry,
    acceptStepUp,
  };
}

/** Standalone ramp consumer. Route view models should prefer `useRampFromPlan`. */
export function useRamp(): RampQueryResult {
  const planQuery = usePlan();
  const boundary = useLocalDateBoundary();
  const ramp = useRampFromPlan(planQuery, boundary);

  return {
    ...ramp,
    retry: async () => {
      const results = await Promise.all([
        planQuery.isError ? planQuery.retry() : Promise.resolve(),
        ramp.retry(),
      ]);
      return {
        isError: results.some(
          (result) => result && typeof result === 'object' && 'isError' in result && result.isError,
        ),
      };
    },
  };
}
