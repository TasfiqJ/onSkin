import { hasReplenishmentSignalForProducts } from '@/features/recommendations/replenishment';
import { shouldOfferStepUp } from '@/features/routine/ramp';
import { getStoredRamps, type StoredRamps } from '@/features/routine/rampStore';
import { loadShelf, type ShelfProduct } from '@/features/shelf/store';
import { streakState } from '@/features/streak/streak';
import {
  getCompletionSummary,
  type CompletionSummary,
} from '@/features/today/completionsStore';
import { localDateString } from '@/features/today/useToday';
import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

export type BehaviouralTriggerEnables = Readonly<{
  promotional: boolean;
  ramp: boolean;
  replenishment: boolean;
}>;

export type BehaviouralTriggerSnapshot = Readonly<{
  promotional: boolean;
  ramp: boolean;
  replenishment: boolean;
}>;

export type BehaviouralSnapshotDependencies = Readonly<{
  readCompletions: () => Promise<CompletionSummary>;
  readRamps: () => Promise<StoredRamps>;
  readShelf: () => Promise<ShelfProduct[]>;
}>;

const defaultDependencies: BehaviouralSnapshotDependencies = Object.freeze({
  readCompletions: getCompletionSummary,
  readRamps: getStoredRamps,
  readShelf: loadShelf,
});

export function deriveBehaviouralTriggerSnapshot(
  enabled: BehaviouralTriggerEnables,
  input: Readonly<{
    completedDates: ReadonlySet<string> | null;
    ramps: StoredRamps | null;
    shelf: readonly ShelfProduct[] | null;
  }>,
  today: string,
): BehaviouralTriggerSnapshot {
  const activeProductIds = new Set(
    input.shelf
      ?.filter((product) => product.status === 'active')
      .map((product) => product.id) ?? [],
  );
  const ramp =
    enabled.ramp && input.ramps
      ? Object.entries(input.ramps).some(
          ([productId, state]) =>
            activeProductIds.has(productId) && shouldOfferStepUp({ ...state, today }),
        )
      : false;

  return Object.freeze({
    replenishment:
      enabled.replenishment && input.shelf
        ? hasReplenishmentSignalForProducts(input.shelf, today)
        : false,
    ramp,
    promotional:
      enabled.promotional && input.completedDates
        ? streakState(new Set(input.completedDates), today).lapsed
        : false,
  });
}

/** One lifecycle-triggered local batch. Disabled domains perform no private
 * reads; enabled domains share the Shelf read needed by replenishment and ramp.
 * Any unreadable source fails the complete optional notification evaluation
 * closed without changing or repairing private bytes. */
export async function readBehaviouralTriggerSnapshot(
  lease: AccountGenerationLease,
  enabled: BehaviouralTriggerEnables,
  today = localDateString(),
  dependencies: BehaviouralSnapshotDependencies = defaultDependencies,
): Promise<BehaviouralTriggerSnapshot> {
  const needsShelf = enabled.replenishment || enabled.ramp;
  const [shelf, ramps, completions] = await Promise.all([
    needsShelf
      ? awaitAccountGenerationLease(lease, dependencies.readShelf)
      : Promise.resolve(null),
    enabled.ramp
      ? awaitAccountGenerationLease(lease, dependencies.readRamps)
      : Promise.resolve(null),
    enabled.promotional
      ? awaitAccountGenerationLease(lease, dependencies.readCompletions)
      : Promise.resolve(null),
  ]);
  lease.assertCurrent();

  return deriveBehaviouralTriggerSnapshot(
    enabled,
    {
      shelf,
      ramps,
      completedDates: completions?.completedDates ?? null,
    },
    today,
  );
}
