import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { devWarn } from '@/lib/observability/safeLog';
import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';

import {
  addProduct,
  applyCatalogRecoveryProductUpdate,
  loadShelf,
  reAddProduct,
  removeProduct,
  updateProduct,
  type NewShelfProduct,
  type CatalogRecoveryProductUpdate,
  type CatalogRecoveryProductUpdateResult,
  type ShelfProduct,
} from './store';

// Shelf lifecycle mutations (docs/04 §5.7). Each writes the local-first store
// (source of truth, D-029) and best-effort-mirrors to Supabase so it's ready to
// sync once the project exists (B-SUPABASE). PostHog funnel events per docs/04 §9.

/** Best-effort mirror to user_products. Local and server rows deliberately share
 * one UUID so routine_conflicts foreign keys can reference the mirrored shelf. */
async function mirrorUpsert(p: ShelfProduct, lease: HealthDataWriteOperationLease): Promise<void> {
  try {
    const { data } = await getPersistedSupabaseUser();
    lease.assertCurrent();
    if (data.user?.id !== lease.ownerUserId) return;
    const { error } = await supabase.from('user_products').upsert(
      {
        id: p.id,
        user_id: lease.ownerUserId,
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
    lease.assertCurrent();
    if (error) throw new Error('SUPABASE_USER_PRODUCT_UPSERT_FAILED');
  } catch (error) {
    lease.assertCurrent();
    devWarn('shelf_mirror_upsert_failed', error);
    /* offline / no DB. The local store already holds it (D-029) */
  }
}

async function mirrorDelete(id: string, lease: HealthDataWriteOperationLease): Promise<void> {
  try {
    const { data } = await getPersistedSupabaseUser();
    lease.assertCurrent();
    if (data.user?.id !== lease.ownerUserId) return;
    const { error } = await supabase
      .from('user_products')
      .delete()
      .eq('id', id)
      .eq('user_id', lease.ownerUserId);
    lease.assertCurrent();
    if (error) throw new Error('SUPABASE_USER_PRODUCT_DELETE_FAILED');
  } catch (error) {
    lease.assertCurrent();
    devWarn('shelf_mirror_delete_failed', error);
  }
}

function runShelfMutation<T>(
  operation: (lease: HealthDataWriteOperationLease) => Promise<T>,
): Promise<T> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return Promise.reject(new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED));
  return runHealthDataWriteOperation(expectedOwnerUserId, operation);
}

export function useShelfMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['shelf'] });

  return {
    async add(input: NewShelfProduct): Promise<ShelfProduct> {
      return runShelfMutation(async (lease) => {
        const product = await addProduct(input);
        lease.assertCurrent();
        track('product_added', { added_via: input.addedVia });
        await mirrorUpsert(product, lease);
        lease.assertCurrent();
        await invalidate();
        lease.assertCurrent();
        return product;
      });
    },

    async applyCatalogRecovery(
      input: CatalogRecoveryProductUpdate,
    ): Promise<CatalogRecoveryProductUpdateResult> {
      return runShelfMutation(async (lease) => {
        const result = await applyCatalogRecoveryProductUpdate(input);
        lease.assertCurrent();
        if (result.status === 'updated') await mirrorUpsert(result.product, lease);
        lease.assertCurrent();
        await invalidate();
        lease.assertCurrent();
        return result;
      });
    },

    /** The opened-date linchpin write (docs/04 §4.5). */
    async setOpened(
      id: string,
      patch: { openedAt: string | null; isOpened: boolean; paoMonths?: number | null },
    ): Promise<void> {
      return runShelfMutation(async (lease) => {
        const product = await updateProduct(id, {
          openedAt: patch.openedAt,
          isOpened: patch.isOpened,
          ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
        });
        lease.assertCurrent();
        if (product) await mirrorUpsert(product, lease);
        lease.assertCurrent();
        track('opened_date_set', { is_opened: patch.isOpened });
        await invalidate();
        lease.assertCurrent();
      });
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      return runShelfMutation(async (lease) => {
        const product = await updateProduct(id, patch);
        lease.assertCurrent();
        if (product) await mirrorUpsert(product, lease);
        lease.assertCurrent();
        await invalidate();
        lease.assertCurrent();
      });
    },

    async markFinished(id: string): Promise<void> {
      return runShelfMutation(async (lease) => {
        const product = await updateProduct(id, {
          status: 'finished',
          finishedAt: localDateString(),
        });
        lease.assertCurrent();
        if (product) await mirrorUpsert(product, lease);
        lease.assertCurrent();
        track('product_finished', { source: 'shelf' });
        await invalidate();
        lease.assertCurrent();
      });
    },

    async markDiscarded(id: string): Promise<void> {
      return runShelfMutation(async (lease) => {
        const product = await updateProduct(id, {
          status: 'discarded',
          finishedAt: localDateString(),
        });
        lease.assertCurrent();
        if (product) await mirrorUpsert(product, lease);
        lease.assertCurrent();
        track('product_discarded', { source: 'shelf' });
        await invalidate();
        lease.assertCurrent();
      });
    },

    async remove(id: string): Promise<void> {
      return runShelfMutation(async (lease) => {
        await removeProduct(id);
        lease.assertCurrent();
        await mirrorDelete(id, lease);
        lease.assertCurrent();
        await invalidate();
        lease.assertCurrent();
      });
    },

    /** Replenish "re-add the same one". Archives the unit, resets the clock (§6). */
    async replace(id: string): Promise<ShelfProduct | null> {
      return runShelfMutation(async (lease) => {
        const fresh = await reAddProduct(id);
        lease.assertCurrent();
        if (fresh) {
          const shelf = await loadShelf();
          lease.assertCurrent();
          const archived = shelf.find((product) => product.id === id);
          if (archived) await mirrorUpsert(archived, lease);
          lease.assertCurrent();
          await mirrorUpsert(fresh, lease);
          lease.assertCurrent();
        }
        track('replenishment_nudge_tapped', { action: 're_add' });
        await invalidate();
        lease.assertCurrent();
        return fresh;
      });
    },
  };
}
