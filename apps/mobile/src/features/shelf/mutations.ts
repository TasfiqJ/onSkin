import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { scheduleOutboxFlush } from '@/lib/offline/outbox';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import {
  acknowledgeProductAdd,
  addProduct,
  reAddProduct,
  removeProduct,
  updateProduct,
  type NewShelfProduct,
  type ShelfProduct,
} from './store';
import { failClosedShelfQueriesAfterMutationFailure } from './mutationFailure';

type ReplenishmentAttempt = {
  pending: Promise<ShelfProduct | null>;
};

// Shared across route-local hook instances and remounts. The atomic store also
// recovers a committed replacement from durable v1 lineage after a process
// restart, when this in-memory coordinator no longer exists.
const replenishmentAttempts = new Map<string, ReplenishmentAttempt>();

function replenishmentAttemptKey(ownerScope: OwnerQueryScope, productId: string): string {
  return `${ownerScope.generation}:${productId}`;
}

export function resetShelfMutationStateForTests(): void {
  replenishmentAttempts.clear();
}

// Shelf lifecycle mutations commit the local-first source of truth and an
// encrypted owner-bound outbox state mirror as one transaction. Network
// publication is restart-safe and never blocks the local write.

export function useShelfMutations() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const { user } = useAuth();
  const ownerId = user?.id.trim();
  const invalidate = () => {
    if (!isOwnerQueryScopeCurrent(ownerScope)) return Promise.resolve();
    return qc.invalidateQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) });
  };
  const runWithFailureRecovery = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      try {
        await failClosedShelfQueriesAfterMutationFailure(qc, ownerScope);
      } catch {
        // Preserve the authoritative mutation error. The reset is best effort;
        // the next mounted owner-scoped query still performs a strict read.
      }
      throw error;
    }
  };

  return {
    async add(input: NewShelfProduct, operationId: string): Promise<ShelfProduct> {
      return runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await addProduct(input, {
            ...(ownerId ? { ownerId } : {}),
            ownerGeneration: lease.generation,
            operationId,
            assertCurrent: lease.assertCurrent,
          });
          lease.assertCurrent();
          track('product_added', { added_via: input.addedVia });
          scheduleOutboxFlush();
          await invalidate();
          lease.assertCurrent();
          return product;
        }),
      );
    },

    /** Clear the durable retry receipt only after the route received the row. */
    async acknowledgeAdd(productId: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          await acknowledgeProductAdd(productId, {
            ...(ownerId ? { ownerId } : {}),
            ownerGeneration: lease.generation,
            assertCurrent: lease.assertCurrent,
          });
          lease.assertCurrent();
        }),
      );
    },

    /** The opened-date linchpin write (docs/04 §4.5). */
    async setOpened(
      id: string,
      patch: { openedAt: string | null; isOpened: boolean; paoMonths?: number | null },
    ): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(
            id,
            {
              openedAt: patch.openedAt,
              isOpened: patch.isOpened,
              ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
            },
            {
              ...(ownerId ? { ownerId } : {}),
              ownerGeneration: lease.generation,
              assertCurrent: lease.assertCurrent,
            },
          );
          lease.assertCurrent();
          if (product) scheduleOutboxFlush();
          track('opened_date_set', { is_opened: patch.isOpened });
          await invalidate();
        }),
      );
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(id, patch, {
            ...(ownerId ? { ownerId } : {}),
            ownerGeneration: lease.generation,
            assertCurrent: lease.assertCurrent,
          });
          lease.assertCurrent();
          if (product) scheduleOutboxFlush();
          await invalidate();
        }),
      );
    },

    async markFinished(id: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(
            id,
            {
              status: 'finished',
              finishedAt: localDateString(),
            },
            {
              ...(ownerId ? { ownerId } : {}),
              ownerGeneration: lease.generation,
              assertCurrent: lease.assertCurrent,
            },
          );
          lease.assertCurrent();
          if (product) scheduleOutboxFlush();
          track('product_finished', { source: 'shelf' });
          await invalidate();
        }),
      );
    },

    async markDiscarded(id: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(
            id,
            {
              status: 'discarded',
              finishedAt: localDateString(),
            },
            {
              ...(ownerId ? { ownerId } : {}),
              ownerGeneration: lease.generation,
              assertCurrent: lease.assertCurrent,
            },
          );
          lease.assertCurrent();
          if (product) scheduleOutboxFlush();
          track('product_discarded', { source: 'shelf' });
          await invalidate();
        }),
      );
    },

    async remove(id: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const removed = await removeProduct(id, {
            ...(ownerId ? { ownerId } : {}),
            ownerGeneration: lease.generation,
            assertCurrent: lease.assertCurrent,
          });
          lease.assertCurrent();
          if (removed) scheduleOutboxFlush();
          await invalidate();
        }),
      );
    },

    /** Replenish "re-add the same one". Archives the unit, resets the clock (§6). */
    async replace(id: string): Promise<ShelfProduct | null> {
      const attemptKey = replenishmentAttemptKey(ownerScope, id);
      const existing = replenishmentAttempts.get(attemptKey);
      if (existing) {
        return runOwnerQueryOperation(ownerScope, async (lease) => {
          const completed = await existing.pending;
          lease.assertCurrent();
          return completed;
        });
      }

      // Concurrent taps and separate route-local hooks share one in-flight write.
      // After settlement the store's source-derived UUID—not retained product
      // data in module memory—makes any uncertain retry idempotent.
      const pending = runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const replaced = await reAddProduct(id, {
            ...(ownerId ? { ownerId } : {}),
            ownerGeneration: lease.generation,
            assertCurrent: lease.assertCurrent,
          });
          lease.assertCurrent();
          if (replaced) scheduleOutboxFlush();
          track('replenishment_nudge_tapped', { action: 're_add' });
          await invalidate();
          lease.assertCurrent();
          return replaced?.fresh ?? null;
        }),
      );
      replenishmentAttempts.set(attemptKey, { pending });
      try {
        return await pending;
      } finally {
        if (replenishmentAttempts.get(attemptKey)?.pending === pending) {
          replenishmentAttempts.delete(attemptKey);
        }
      }
    },
  };
}
