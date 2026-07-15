import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { devWarn } from '@/lib/observability/safeLog';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';

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
async function mirrorUpsert(p: ShelfProduct): Promise<void> {
  try {
    const { data } = await getPersistedSupabaseUser();
    const userId = data.user?.id;
    if (!userId) return;
    const { error } = await supabase.from('user_products').upsert(
      {
        id: p.id,
        user_id: userId,
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
    );
    if (error) throw new Error('SUPABASE_USER_PRODUCT_UPSERT_FAILED');
  } catch (error) {
    devWarn('shelf_mirror_upsert_failed', error);
    /* offline / no DB. The local store already holds it (D-029) */
  }
}

async function mirrorDelete(id: string): Promise<void> {
  try {
    const { data } = await getPersistedSupabaseUser();
    const userId = data.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from('user_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error('SUPABASE_USER_PRODUCT_DELETE_FAILED');
  } catch (error) {
    devWarn('shelf_mirror_delete_failed', error);
  }
}

export function useShelfMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shelf'] });

  return {
    async add(input: NewShelfProduct): Promise<ShelfProduct> {
      const product = await addProduct(input);
      track('product_added', { added_via: input.addedVia });
      void mirrorUpsert(product);
      await invalidate();
      return product;
    },

    /** The opened-date linchpin write (docs/04 §4.5). */
    async setOpened(
      id: string,
      patch: { openedAt: string | null; isOpened: boolean; paoMonths?: number | null },
    ): Promise<void> {
      const product = await updateProduct(id, {
        openedAt: patch.openedAt,
        isOpened: patch.isOpened,
        ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
      });
      if (product) void mirrorUpsert(product);
      track('opened_date_set', { is_opened: patch.isOpened });
      await invalidate();
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      const product = await updateProduct(id, patch);
      if (product) void mirrorUpsert(product);
      await invalidate();
    },

    async markFinished(id: string): Promise<void> {
      const product = await updateProduct(id, {
        status: 'finished',
        finishedAt: localDateString(),
      });
      if (product) void mirrorUpsert(product);
      track('product_finished', { source: 'shelf' });
      await invalidate();
    },

    async markDiscarded(id: string): Promise<void> {
      const product = await updateProduct(id, {
        status: 'discarded',
        finishedAt: localDateString(),
      });
      if (product) void mirrorUpsert(product);
      track('product_discarded', { source: 'shelf' });
      await invalidate();
    },

    async remove(id: string): Promise<void> {
      await removeProduct(id);
      void mirrorDelete(id);
      await invalidate();
    },

    /** Replenish "re-add the same one". Archives the unit, resets the clock (§6). */
    async replace(id: string): Promise<ShelfProduct | null> {
      const fresh = await reAddProduct(id);
      if (fresh) {
        const archived = (await loadShelf()).find((product) => product.id === id);
        if (archived) void mirrorUpsert(archived);
        void mirrorUpsert(fresh);
      }
      track('replenishment_nudge_tapped', { action: 're_add' });
      await invalidate();
      return fresh;
    },
  };
}
