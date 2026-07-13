import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
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
  addProduct,
  loadShelf,
  reAddProduct,
  removeProduct,
  updateProduct,
  type NewShelfProduct,
  type ShelfProduct,
} from './store';

// Shelf lifecycle mutations (docs/04 §5.7). Each writes the local-first store
// (source of truth, D-029) and best-effort-mirrors to Supabase so it's ready to
// sync once the project exists (B-SUPABASE). PostHog funnel events per docs/04 §9.

/** Best-effort mirror to user_products. Local and server rows deliberately share
 * one UUID so routine_conflicts foreign keys can reference the mirrored shelf. */
export async function mirrorShelfUpsertForOwner(
  ownerScope: OwnerQueryScope,
  p: ShelfProduct,
): Promise<void> {
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

export async function mirrorShelfDeleteForOwner(
  ownerScope: OwnerQueryScope,
  id: string,
): Promise<void> {
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

export function useShelfMutations() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  const invalidate = () => {
    if (!isOwnerQueryScopeCurrent(ownerScope)) return Promise.resolve();
    return qc.invalidateQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) });
  };

  return {
    async add(input: NewShelfProduct): Promise<ShelfProduct> {
      return runOwnerQueryOperation(ownerScope, async (lease) => {
        const product = await addProduct(input);
        lease.assertCurrent();
        track('product_added', { added_via: input.addedVia });
        void mirrorShelfUpsertForOwner(ownerScope, product);
        await invalidate();
        lease.assertCurrent();
        return product;
      });
    },

    /** The opened-date linchpin write (docs/04 §4.5). */
    async setOpened(
      id: string,
      patch: { openedAt: string | null; isOpened: boolean; paoMonths?: number | null },
    ): Promise<void> {
      await runOwnerQueryOperation(ownerScope, async (lease) => {
        const product = await updateProduct(id, {
          openedAt: patch.openedAt,
          isOpened: patch.isOpened,
          ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
        });
        lease.assertCurrent();
        if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
        track('opened_date_set', { is_opened: patch.isOpened });
        await invalidate();
      });
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      await runOwnerQueryOperation(ownerScope, async (lease) => {
        const product = await updateProduct(id, patch);
        lease.assertCurrent();
        if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
        await invalidate();
      });
    },

    async markFinished(id: string): Promise<void> {
      await runOwnerQueryOperation(ownerScope, async (lease) => {
        const product = await updateProduct(id, {
          status: 'finished',
          finishedAt: localDateString(),
        });
        lease.assertCurrent();
        if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
        track('product_finished', { source: 'shelf' });
        await invalidate();
      });
    },

    async markDiscarded(id: string): Promise<void> {
      await runOwnerQueryOperation(ownerScope, async (lease) => {
        const product = await updateProduct(id, {
          status: 'discarded',
          finishedAt: localDateString(),
        });
        lease.assertCurrent();
        if (product) void mirrorShelfUpsertForOwner(ownerScope, product);
        track('product_discarded', { source: 'shelf' });
        await invalidate();
      });
    },

    async remove(id: string): Promise<void> {
      await runOwnerQueryOperation(ownerScope, async (lease) => {
        await removeProduct(id);
        lease.assertCurrent();
        void mirrorShelfDeleteForOwner(ownerScope, id);
        await invalidate();
      });
    },

    /** Replenish "re-add the same one". Archives the unit, resets the clock (§6). */
    async replace(id: string): Promise<ShelfProduct | null> {
      return runOwnerQueryOperation(ownerScope, async (lease) => {
        const fresh = await reAddProduct(id);
        lease.assertCurrent();
        if (fresh) {
          const archived = (await loadShelf()).find((product) => product.id === id);
          lease.assertCurrent();
          if (archived) void mirrorShelfUpsertForOwner(ownerScope, archived);
          void mirrorShelfUpsertForOwner(ownerScope, fresh);
        }
        track('replenishment_nudge_tapped', { action: 're_add' });
        await invalidate();
        return fresh;
      });
    },
  };
}
