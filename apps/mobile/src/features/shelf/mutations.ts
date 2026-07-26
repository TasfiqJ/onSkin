import { useQueryClient } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { track } from '@/lib/analytics/track';
import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';

import {
  addProduct,
  applyCatalogRecoveryProductUpdate,
  reAddProduct,
  removeProduct,
  updateProduct,
  type NewShelfProduct,
  type CatalogRecoveryProductUpdate,
  type CatalogRecoveryProductUpdateResult,
  type ReplacementOpeningState,
  type ShelfProduct,
} from './store';

// Shelf lifecycle mutations (docs/04 §5.7) write the local-first source of
// truth (D-029). Store v3 persists owner-free replay work in the same encrypted
// transaction, so this hook has no crash-gap-prone direct mirror.

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
        await updateProduct(id, {
          openedAt: patch.openedAt,
          isOpened: patch.isOpened,
          ...(patch.paoMonths !== undefined ? { paoMonths: patch.paoMonths } : {}),
        });
        lease.assertCurrent();
        track('opened_date_set', { is_opened: patch.isOpened });
        await invalidate();
        lease.assertCurrent();
      });
    },

    async edit(id: string, patch: Partial<Omit<ShelfProduct, 'id' | 'createdAt'>>): Promise<void> {
      return runShelfMutation(async (lease) => {
        await updateProduct(id, patch);
        lease.assertCurrent();
        await invalidate();
        lease.assertCurrent();
      });
    },

    async markFinished(id: string): Promise<void> {
      return runShelfMutation(async (lease) => {
        await updateProduct(id, {
          status: 'finished',
          finishedAt: localDateString(),
        });
        lease.assertCurrent();
        track('product_finished', { source: 'shelf' });
        await invalidate();
        lease.assertCurrent();
      });
    },

    async markDiscarded(id: string): Promise<void> {
      return runShelfMutation(async (lease) => {
        await updateProduct(id, {
          status: 'discarded',
          finishedAt: localDateString(),
        });
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
        await invalidate();
        lease.assertCurrent();
      });
    },

    /** Replenish "re-add the same one". Archives the unit, resets the clock (§6). */
    async replace(
      id: string,
      opening: ReplacementOpeningState,
      operationId: string,
    ): Promise<ShelfProduct | null> {
      return runShelfMutation(async (lease) => {
        const fresh = await reAddProduct(id, opening, operationId);
        lease.assertCurrent();
        track('replenishment_nudge_tapped', { action: 're_add' });
        await invalidate();
        lease.assertCurrent();
        return fresh;
      });
    },
  };
}
