import { useQuery } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';

import { useProfileBits } from '@/features/scheduler/profile';
import { routinePlanProfileLabel } from '@/features/scheduler/profileMapping';
import { useShelf } from '@/features/shelf/useShelf';
import {
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

export function usePlan(): PlanHookResult {
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
  const isLoading = shelf.isLoading || profile.isLoading || routineOrder.isLoading;
  const isError = shelf.isError || profile.isError || routineOrder.isError;
  const sourceReady = Boolean(
    orderLease &&
    !isLoading &&
    !isError &&
    shelf.data !== undefined &&
    profile.data !== undefined &&
    profile.data.source !== 'unavailable' &&
    routineOrder.data !== undefined,
  );
  if (isLoading || !orderLease || routineOrder.data === undefined) {
    // A failed/closed read is not a new empty routine. A genuine absent record
    // is already represented by the store's successfully decoded empty value.
    return { orderLease, data: undefined, isLoading, isError, sourceReady: false, isExample: false };
  }

  const orderOverrides = routineOrder.data;

  const items = shelf.data?.items ?? [];
  if (items.length > 0) {
    // A real shelf must never inherit the synthetic example profile. If the
    // user's current health/profile source is unavailable, publish no plan.
    const real = routineGenerationProfileForRealShelf(profile.data);
    if (!real) {
      return {
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
    orderLease,
    data,
    isLoading: false,
    isError,
    sourceReady,
    isExample: true,
  };
}
