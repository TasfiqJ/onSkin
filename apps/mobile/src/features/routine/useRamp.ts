import { useQuery, useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';

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
  const { data: planData, isLoading: planLoading } = usePlan();
  const planRamps = planData?.plan.ramp ?? [];
  const today = localDateString();
  const keyIds = planRamps.map((r) => r.productId).join(',');

  const q = useQuery<RampItem[]>({
    queryKey: ['ramp', keyIds],
    enabled: !planLoading,
    queryFn: async () => {
      const stored = await getStoredRamps();
      const items: RampItem[] = [];
      for (const r of planRamps) {
        // Use the stored override if present; otherwise lazily seed from the plan's
        // generated initial so the screen always has real, persisted state.
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
    },
  });

  async function acceptStepUp(productId: string): Promise<void> {
    await stepUpRamp(productId);
    await qc.invalidateQueries({ queryKey: ['ramp'] });
  }

  return { items: q.data ?? [], isLoading: planLoading || q.isLoading, acceptStepUp };
}
