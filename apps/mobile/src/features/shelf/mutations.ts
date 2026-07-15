import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { useAuth } from '@/lib/auth/AuthProvider';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { isSupabaseConfigured } from '@/lib/env';
import { devWarn } from '@/lib/observability/safeLog';
import {
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { supabase } from '@/lib/supabase/client';

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

const shelfMirrorTails = new Map<string, Promise<void>>();

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

function enqueueShelfMirror(
  ownerScope: OwnerQueryScope,
  productId: string,
  operation: () => Promise<void>,
): Promise<void> {
  const key = `${ownerScope.generation}:${productId}`;
  const previous = shelfMirrorTails.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const tail = current
    .catch(() => undefined)
    .finally(() => {
      if (shelfMirrorTails.get(key) === tail) shelfMirrorTails.delete(key);
    });
  shelfMirrorTails.set(key, tail);
  return current;
}

// Shelf lifecycle mutations (docs/04 §5.7). Each writes the local-first store
// (source of truth, D-029) and best-effort-mirrors to Supabase so it's ready to
// sync once the project exists (B-SUPABASE). PostHog funnel events per docs/04 §9.

/** Best-effort mirror to user_products. Local and server rows deliberately share
 * one UUID so routine_conflicts foreign keys can reference the mirrored shelf. */
async function performShelfMirrorUpsertForOwner(
  ownerScope: OwnerQueryScope,
  p: ShelfProduct,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (!owner) return;
      lease.assertCurrent();
      const { error } = await supabase
        .from('user_products')
        .upsert(
          {
            id: p.id,
            user_id: owner.userId,
            catalog_product_id: p.catalogProductId,
            catalog_source_id: p.catalogSourceId,
            catalog_match_quality: p.catalogMatchQuality,
            catalog_source_snapshot_date: p.catalogSourceSnapshotDate,
            manual_name: p.name,
            manual_brand: p.brand,
            barcode: p.barcode,
            opened_at: p.openedAt,
            pao_months: p.paoMonths,
            expiry_date: p.expiryDate,
            is_opened: p.isOpened,
            pao_source: p.paoSource,
            expiry_source: p.expirySource,
            added_via: p.addedVia,
            source_disclosure_ack_at: p.sourceDisclosureAckAt,
            status: p.status,
            finished_at: p.finishedAt,
          },
          { onConflict: 'id' },
        )
        .abortSignal(lease.signal);
      lease.assertCurrent();
      if (error) throw new Error('SUPABASE_USER_PRODUCT_UPSERT_FAILED');
    });
  } catch (error) {
    devWarn('shelf_mirror_upsert_failed', error);
    /* offline / no DB. The local store already holds it (D-029) */
  }
}

export function mirrorShelfUpsertForOwner(
  ownerScope: OwnerQueryScope,
  product: ShelfProduct,
): Promise<void> {
  return enqueueShelfMirror(ownerScope, product.id, () =>
    performShelfMirrorUpsertForOwner(ownerScope, product),
  );
}

async function performShelfMirrorDeleteForOwner(
  ownerScope: OwnerQueryScope,
  id: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await runOwnerQueryOperation(ownerScope, async (lease) => {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (!owner) return;
      lease.assertCurrent();
      const { error } = await supabase
        .from('user_products')
        .delete()
        .eq('id', id)
        .eq('user_id', owner.userId)
        .abortSignal(lease.signal);
      lease.assertCurrent();
      if (error) throw new Error('SUPABASE_USER_PRODUCT_DELETE_FAILED');
    });
  } catch (error) {
    devWarn('shelf_mirror_delete_failed', error);
  }
}

export function mirrorShelfDeleteForOwner(ownerScope: OwnerQueryScope, id: string): Promise<void> {
  return enqueueShelfMirror(ownerScope, id, () => performShelfMirrorDeleteForOwner(ownerScope, id));
}

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
            operationId,
            assertCurrent: lease.assertCurrent,
          });
          lease.assertCurrent();
          track('product_added', { added_via: input.addedVia });
          void mirrorShelfUpsertForOwner(ownerScope, product);
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
          const product = await updateProduct(id, {
            openedAt: patch.openedAt,
            isOpened: patch.isOpened,
            ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
          });
          lease.assertCurrent();
          if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
          track('opened_date_set', { is_opened: patch.isOpened });
          await invalidate();
        }),
      );
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(id, patch);
          lease.assertCurrent();
          if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
          await invalidate();
        }),
      );
    },

    async markFinished(id: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(id, {
            status: 'finished',
            finishedAt: localDateString(),
          });
          lease.assertCurrent();
          if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
          track('product_finished', { source: 'shelf' });
          await invalidate();
        }),
      );
    },

    async markDiscarded(id: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          const product = await updateProduct(id, {
            status: 'discarded',
            finishedAt: localDateString(),
          });
          lease.assertCurrent();
          if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
          track('product_discarded', { source: 'shelf' });
          await invalidate();
        }),
      );
    },

    async remove(id: string): Promise<void> {
      await runWithFailureRecovery(() =>
        runOwnerQueryOperation(ownerScope, async (lease) => {
          await removeProduct(id);
          lease.assertCurrent();
          void mirrorShelfDeleteForOwner(ownerScope, id);
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
          const replaced = await reAddProduct(id);
          lease.assertCurrent();
          if (replaced) {
            void mirrorShelfUpsertForOwner(ownerScope, replaced.archived);
            void mirrorShelfUpsertForOwner(ownerScope, replaced.fresh);
          }
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
