import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';

import { useProfileBits } from '@/features/scheduler/profile';
import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';
import { useShelf } from '@/features/shelf/useShelf';
import {
  assertHealthDataWriteLease,
  captureHealthDataWriteLease,
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';

import {
  generatePlan,
  type GeneratedPlan,
  type RoutineGenerationProfile,
  type RoutineProduct,
} from './generate';
import {
  applyRoutineOrderOverrides,
  loadRoutineOrderOverrides,
  routineOrderQueryKeyForLease,
  type RoutineOrderOverrides,
} from './orderStore';
import { routineGenerationProfileForRealShelf } from './planProfileAdmission';

// The user's generated plan. Live from the shelf via the (tested) generatePlan
// pipeline; when the shelf is empty, falls back to the design's Maya example so
// the plan-built screen matches the handoff design out of the box (docs/03 §2 /
// design screen 01). Becomes fully live once products are on the shelf.

const MAYA_PRODUCTS: RoutineProduct[] = [
  { id: 'm-cleanser', name: 'Cream cleanser', tags: [] },
  { id: 'm-vitc', name: 'Vitamin C serum', tags: ['vitamin_c'] },
  { id: 'm-retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
  { id: 'm-glycolic', name: 'Glycolic 7% Toner', tags: ['aha'] },
  { id: 'm-cera', name: 'Ceramide moisturizer', tags: ['ceramide', 'barrier'] },
];
const MAYA_PROFILE: RoutineGenerationProfile = {
  sensitivity: 'sensitive',
  pregnancy: false,
  reproductiveStatus: 'none',
  goals: ['barrier_repair'],
};

export type PlanResult = {
  plan: GeneratedPlan;
  canonicalPlan: GeneratedPlan;
  isExample: boolean;
  profileLabel: string;
  orderOverrides: RoutineOrderOverrides;
  orderPersistenceUnavailable: boolean;
  activeProductIds: string[];
};

export type PlanHookResult = {
  /** Exact authority used for the local order read; never persisted in the record. */
  orderLease?: HealthDataWriteLease;
  data: PlanResult | undefined;
  /** True only while one or more canonical inputs are still loading. */
  isLoading: boolean;
  /** True when any canonical input query failed, even if React Query retained cached data. */
  isError: boolean;
  /** True only when every canonical input is current and structurally available. */
  sourceReady: boolean;
  /** Explicitly identifies the Maya design fallback without requiring callers to inspect data. */
  isExample: boolean;
};

// Keep PlanHookResult's existing data/loading contract intact for G2's editor.
export type RecoverablePlanHookResult = PlanHookResult & {
  /** A refetch may retain data; it is not an initial load or a usable source. */
  isRefreshing: boolean;
  /** Re-read all canonical inputs, never synthesize success from retained cache. */
  retry: () => Promise<void>;
  /** Synchronous action fence, including query changes before React re-renders. */
  isSourceCurrent: () => boolean;
};

// Only in-memory identities: removing/recreating an unscoped input query must
// not inherit a previous query's freshness proof. No private record/key changes.
const planInputQueryIds = new WeakMap<object, number>();
let nextPlanInputQueryId = 0;
function planInputQueryId(query: object): number {
  let id = planInputQueryIds.get(query);
  if (id === undefined) {
    id = ++nextPlanInputQueryId;
    planInputQueryIds.set(query, id);
  }
  return id;
}

function subscribeRoutineOrderLease(onChange: () => void): () => void {
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleExpiry = () => {
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
    const expiresAt = activeHealthProcessingLeaseSnapshot()?.expiresAt;
    if (expiresAt !== null && expiresAt !== undefined) {
      expiryTimer = setTimeout(() => {
        onChange();
        scheduleExpiry();
      }, Math.max(1, Math.min(expiresAt - Date.now(), 2_147_483_647)));
    }
  };
  const unsubscribe = subscribeActiveHealthProcessingLeaseChanges(() => {
    scheduleExpiry();
    onChange();
  });
  scheduleExpiry();
  return () => {
    unsubscribe();
    if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  };
}

export function usePlan(): RecoverablePlanHookResult {
  const queryClient = useQueryClient();
  const shelf = useShelf();
  const profile = useProfileBits();
  const activeLease = useSyncExternalStore(
    subscribeRoutineOrderLease,
    activeHealthProcessingLeaseSnapshot,
    activeHealthProcessingLeaseSnapshot,
  );
  const orderLease = useMemo(() => {
    if (activeLease === null) return undefined;
    try {
      return captureHealthDataWriteLease();
    } catch {
      return undefined;
    }
  }, [activeLease]);
  const loadRoutineOrderForCurrentHealthLease = (): Promise<RoutineOrderOverrides> => {
    if (!orderLease) return Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
    return loadRoutineOrderOverrides(orderLease);
  };
  const routineOrder = useQuery({
    queryKey: routineOrderQueryKeyForLease(orderLease),
    queryFn: loadRoutineOrderForCurrentHealthLease,
    enabled: orderLease !== undefined,
    // This query reads local encrypted storage, not the network. Do not pause it
    // in airplane mode or automatically retry a corrupt/private read failure.
    networkMode: 'always',
    retry: false,
    staleTime: Infinity,
  });
  // setActiveHealthProcessingEpoch increments generation whenever any lease
  // identity field changes (and on clear/re-grant). G2's unchanged account +
  // generation key therefore already scopes the order read to exact authority.
  const authorityKey = orderLease === undefined ? 'closed' : JSON.stringify([
    orderLease.ownerUserId, orderLease.accountGeneration, orderLease.epoch,
    orderLease.generation, orderLease.expiresAt,
  ]);
  const inputProofKey = ['routinePlanInputProof', authorityKey] as const;
  const inputProof = useQuery({
    queryKey: inputProofKey,
    enabled: orderLease !== undefined,
    retry: false,
    staleTime: Infinity,
    networkMode: 'always',
    queryFn: async ({ signal }) => {
      const assertCurrent = () => {
        if (!orderLease || signal.aborted) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
        assertHealthDataWriteLease(orderLease);
      };
      assertCurrent();
      // The shared Shelf/Profile keys are intentionally unchanged. Cancel even
      // initial (data-less) reads: refetch(cancelRefetch:true) alone can JOIN a
      // predecessor's initial fetch. Reassert after cancellation before any read.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['shelf'], exact: true }),
        queryClient.cancelQueries({ queryKey: ['skinProfileBits'], exact: true }),
      ]);
      assertCurrent();
      const cache = queryClient.getQueryCache();
      const inputs = [
        { key: ['shelf'], refetch: () => shelf.refetch({ cancelRefetch: false, throwOnError: true }) },
        { key: ['skinProfileBits'], refetch: () => profile.refetch({ cancelRefetch: false, throwOnError: true }) },
      ].map((input) => {
        const query = cache.find({ queryKey: input.key, exact: true });
        if (!query) throw new Error('ROUTINE_PLAN_SOURCE_UNAVAILABLE');
        return { ...input, query };
      });
      const confirmed = new Map<object, object>();
      const unsubscribe = cache.subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success' &&
            !event.action.manual && inputs.some(({ query }) => query === event.query)) {
          confirmed.set(event.query, event.query.state);
        }
      });
      try {
        // With old fetches cancelled, these calls can only start/join reads under
        // this exact authority. Their canonical query functions fence all awaits.
        await Promise.all(inputs.map((input) => input.refetch()));
        assertCurrent();
        // A cancelled refetch may resolve to reverted cached data. Require a real
        // non-manual success event AND its still-current state, not promise success
        // or a local setQueryData. Structural sharing of identical bytes is fine.
        for (const { key, query } of inputs) {
          if (cache.find({ queryKey: key, exact: true }) !== query ||
              confirmed.get(query) !== query.state || query.state.status !== 'success' ||
              query.state.fetchStatus !== 'idle' || query.state.isInvalidated ||
              query.state.data === undefined) {
            throw new Error('ROUTINE_PLAN_SOURCE_UNAVAILABLE');
          }
        }
        return { authorityKey, inputQueryIds: inputs.map(({ query }) => planInputQueryId(query)) };
      } finally {
        // Never cancel/invalidate successor inputs in an old finally callback.
        unsubscribe();
      }
    },
  });
  const isLoading = shelf.isLoading || profile.isLoading || routineOrder.isLoading;
  const isError = shelf.isError || profile.isError || routineOrder.isError || inputProof.isError;
  const isRefreshing = Boolean(
    shelf.isFetching || profile.isFetching || routineOrder.isFetching || inputProof.isFetching,
  );
  const inputsReady = Boolean(
    orderLease &&
    !isLoading &&
    !isError &&
    !isRefreshing &&
    !shelf.isPaused && !profile.isPaused && !routineOrder.isPaused &&
    !inputProof.isPaused && inputProof.data?.authorityKey === authorityKey &&
    shelf.data !== undefined &&
    profile.data !== undefined &&
    profile.data.source !== 'unavailable' &&
    routineOrder.data !== undefined,
  );
  function currentSourceCache(): boolean {
    const proofData = inputProof.data;
    if (!inputsReady || !orderLease || !proofData) return false;
    try {
      assertHealthDataWriteLease(orderLease);
      const inputQueries = [['shelf'], ['skinProfileBits']].map((queryKey) =>
        queryClient.getQueryCache().find({ queryKey, exact: true }),
      );
      if (!inputQueries.every((query, index) => query !== undefined &&
          planInputQueryId(query) === proofData.inputQueryIds[index])) return false;
      // Reject old handlers after invalidation, refetch, input replacement or
      // query removal, even before observer notifications reach this render.
      return [
        { key: ['shelf'], data: shelf.data },
        { key: ['skinProfileBits'], data: profile.data },
        { key: routineOrderQueryKeyForLease(orderLease), data: routineOrder.data },
        { key: inputProofKey, data: inputProof.data },
      ].every(({ key, data }) => {
        const current = queryClient.getQueryState(key);
        return current?.status === 'success' && current.fetchStatus === 'idle' &&
          !current.isInvalidated && current.data === data;
      });
    } catch {
      return false;
    }
  }

  const sourceReady = currentSourceCache();
  function isSourceCurrent(): boolean {
    return sourceReady && currentSourceCache();
  }

  async function retry(): Promise<void> {
    if (!orderLease) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
    assertHealthDataWriteLease(orderLease);
    // One proof operation per exact authority; concurrent retries join it.
    // The proof re-reads Shelf/Profile; G2 independently re-reads its exact key.
    // An order error must not poison the Shelf/Profile proof: G2's existing
    // order-only reload remains able to recover an order-only failure.
    await Promise.all([
      inputProof.refetch({ cancelRefetch: false, throwOnError: true }),
      routineOrder.refetch({ cancelRefetch: true, throwOnError: true }),
    ]);
    assertHealthDataWriteLease(orderLease);
    const nextShelf = queryClient.getQueryState(['shelf']);
    const nextProfile = queryClient.getQueryState<{ source: string }>(['skinProfileBits']);
    const nextOrder = queryClient.getQueryState(routineOrderQueryKeyForLease(orderLease));
    const nextProof = queryClient.getQueryState(inputProofKey);
    if (![nextShelf, nextProfile, nextOrder, nextProof].every((state) =>
      state?.status === 'success' && state.fetchStatus === 'idle' &&
      !state.isInvalidated && state.data !== undefined,
    ) || nextProfile?.data?.source === 'unavailable') {
      throw new Error('ROUTINE_PLAN_SOURCE_UNAVAILABLE');
    }
  }

  const recovery = { isRefreshing, retry, isSourceCurrent };
  // A successor editor must not initialize a new-authority draft from the old
  // unscoped cache. Retain G2 data on same-authority refetch/error only after
  // that authority has actually earned its input proof at least once.
  if (isLoading || !orderLease || routineOrder.data === undefined ||
      inputProof.data?.authorityKey !== authorityKey) {
    // A failed/closed read is not a new empty routine. A genuine absent record
    // is already represented by the store's successfully decoded empty value.
    return { ...recovery, orderLease, data: undefined, isLoading, isError, sourceReady: false, isExample: false };
  }

  const orderOverrides = routineOrder.data;

  const items = shelf.data?.items ?? [];
  if (items.length > 0) {
    // A real shelf must never inherit the synthetic example profile. If the
    // user's current health/profile source is unavailable, publish no plan.
    const real = routineGenerationProfileForRealShelf(profile.data);
    if (!real) {
      return {
        ...recovery,
        orderLease,
        data: undefined,
        isLoading: false,
        isError,
        sourceReady: false,
        isExample: false,
      };
    }
    const products: RoutineProduct[] = items.map((i) => ({
      id: i.engineProduct.id,
      name: i.engineProduct.name,
      tags: i.engineProduct.tags,
      category: i.category,
      concentration: i.engineProduct.concentration,
    }));
    // Use the REAL profile (sensitivity + pregnancy + goals) so the plan honours
    // pregnancy retinoid suppression etc. everywhere, not just the cycle engine.
    // Use the launch-gated rule set (docs/02 §9 B-DERM-REVIEW), consistent with
    // useShelf/recommendations. In production the conflict layer stays inert until
    // clinical sign-off; in dev the full starter matrix drives the plan.
    const canonicalPlan = generatePlan(products, real, shelf.data?.conflictChoices);
    const data: PlanResult = {
      plan: applyRoutineOrderOverrides(canonicalPlan, orderOverrides),
      canonicalPlan,
      isExample: false,
      profileLabel: routinePlanProfileLabel(profile.data ?? null, false),
      orderOverrides,
      orderPersistenceUnavailable: routineOrder.isError,
      activeProductIds: items.map((item) => item.id),
    };
    return {
      ...recovery,
      orderLease,
      data,
      isLoading: false,
      isError,
      sourceReady,
      isExample: false,
    };
  }
  const canonicalPlan = generatePlan(MAYA_PRODUCTS, MAYA_PROFILE);
  const data: PlanResult = {
    plan: canonicalPlan,
    canonicalPlan,
    isExample: true,
    profileLabel: routinePlanProfileLabel(null, true),
    orderOverrides,
    orderPersistenceUnavailable: routineOrder.isError,
    activeProductIds: [],
  };
  return {
    ...recovery,
    orderLease,
    data,
    isLoading: false,
    isError,
    sourceReady,
    isExample: true,
  };
}
