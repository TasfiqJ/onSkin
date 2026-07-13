import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';
import {
  ownerQueryPrefixes,
  queryKeys,
  runOwnerQueryOperation,
  shouldRefetchCurrentLocalDayQuery,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

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
  acceptStepUp: (productId: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const { data: planData, isLoading: planLoading } = usePlan();
  const planRamps = planData?.plan.ramp ?? [];
  const boundary = useLocalDateBoundary();
  const { localDate: today } = boundary;
  const keyIds = planRamps.map((r) => r.productId).join(',');

  const q = useQuery<RampItem[]>({
    queryKey: queryKeys.ramp(ownerScope, boundary, keyIds),
    refetchOnReconnect: shouldRefetchCurrentLocalDayQuery,
    refetchOnWindowFocus: shouldRefetchCurrentLocalDayQuery,
    enabled: !planLoading,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        const stored = await getStoredRamps();
        const items: RampItem[] = [];
        for (const r of planRamps) {
          // Lazy seeding is a write. Assert the captured owner immediately before it.
          if (!stored[r.productId]) lease.assertCurrent();
          const state = stored[r.productId] ?? (await ensureRamp(r.productId, r.state));
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
        return items;
      }),
  });

  async function acceptStepUp(productId: string): Promise<void> {
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      lease.assertCurrent();
      await stepUpRamp(productId);
      lease.assertCurrent();
      await qc.invalidateQueries({ queryKey: ownerQueryPrefixes.ramp(ownerScope) });
    });
  }

  return { items: q.data ?? [], isLoading: planLoading || q.isLoading, acceptStepUp };
}
