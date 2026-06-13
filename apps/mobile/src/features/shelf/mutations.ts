import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import { supabase } from '@/lib/supabase/client';

import {
  addProduct,
  reAddProduct,
  removeProduct,
  updateProduct,
  type NewShelfProduct,
  type ShelfProduct,
} from './store';

// Shelf lifecycle mutations (docs/04 §5.7). Each writes the local-first store
// (source of truth, D-029) and best-effort-mirrors to Supabase so it's ready to
// sync once the project exists (B-SUPABASE). PostHog funnel events per docs/04 §9.

/** Best-effort mirror to user_products — never throws into the UI (B-SUPABASE). */
async function mirrorInsert(p: ShelfProduct): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from('user_products').insert({
      user_id: userId,
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
    });
  } catch {
    /* offline / no DB — the local store already holds it (D-029) */
  }
}

export function useShelfMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shelf'] });

  return {
    async add(input: NewShelfProduct): Promise<ShelfProduct> {
      const product = await addProduct(input);
      track('product_added', { added_via: input.addedVia });
      void mirrorInsert(product);
      await invalidate();
      return product;
    },

    /** The opened-date linchpin write (docs/04 §4.5). */
    async setOpened(
      id: string,
      patch: { openedAt: string | null; isOpened: boolean; paoMonths?: number | null },
    ): Promise<void> {
      await updateProduct(id, {
        openedAt: patch.openedAt,
        isOpened: patch.isOpened,
        ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
      });
      track('opened_date_set', { is_opened: patch.isOpened });
      await invalidate();
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      await updateProduct(id, patch);
      await invalidate();
    },

    async markFinished(id: string): Promise<void> {
      await updateProduct(id, { status: 'finished', finishedAt: localDateString() });
      track('product_finished', { product_id: id });
      await invalidate();
    },

    async markDiscarded(id: string): Promise<void> {
      await updateProduct(id, { status: 'discarded', finishedAt: localDateString() });
      track('product_discarded', { product_id: id });
      await invalidate();
    },

    async remove(id: string): Promise<void> {
      await removeProduct(id);
      await invalidate();
    },

    /** Replenish "re-add the same one" — archives the unit, resets the clock (§6). */
    async replace(id: string): Promise<ShelfProduct | null> {
      const fresh = await reAddProduct(id);
      track('replenishment_nudge_tapped', { product_id: id, action: 're_add' });
      await invalidate();
      return fresh;
    },
  };
}
