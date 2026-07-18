import { expiryBadge } from '@/features/intelligence/pao';
import { surfacedExpiry } from '@/features/shelf/expiry';
import type { ShelfProduct } from '@/features/shelf/store';
import type { ShelfData, ShelfItem } from '@/features/shelf/useShelf';

export type ReplenishmentReason = 'countdown' | 'expired' | 'finished';

export type ShelfReplenishmentCandidate = {
  item: ShelfItem;
  reason: ReplenishmentReason;
};

function normalized(value: string | null): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

/** Stable enough to suppress an archived unit after the same product is re-added. */
function productIdentity(product: Pick<
  ShelfProduct,
  'barcode' | 'brand' | 'catalogProductId' | 'category' | 'name'
>): string {
  const catalogProductId = normalized(product.catalogProductId);
  if (catalogProductId) return `catalog:${catalogProductId}`;
  const barcode = normalized(product.barcode);
  if (barcode) return `barcode:${barcode}`;
  return [
    'manual',
    normalized(product.brand),
    normalized(product.name),
    normalized(product.category),
  ].join(':');
}

/**
 * The only automatic replenishment signals allowed by docs/04 section 6:
 * active products within the countdown window, active products past their
 * tracked date, and finished products that have not already been re-added.
 */
export function collectReplenishmentCandidates(
  data: Pick<ShelfData, 'items' | 'archive'> | null | undefined,
): ShelfReplenishmentCandidate[] {
  if (!data) return [];

  const active = data.items.filter((item) => item.status === 'active');
  const activeIdentities = new Set(active.map((item) => productIdentity(item.product)));
  const candidates: ShelfReplenishmentCandidate[] = [];
  for (const item of active) {
    if (item.badge.kind === 'countdown') candidates.push({ item, reason: 'countdown' });
    if (item.badge.kind === 'expired') candidates.push({ item, reason: 'expired' });
  }

  const seenFinished = new Set<string>();
  for (const item of data.archive) {
    if (item.status !== 'finished') continue;
    const identity = productIdentity(item.product);
    if (activeIdentities.has(identity) || seenFinished.has(identity)) continue;
    seenFinished.add(identity);
    candidates.push({ item, reason: 'finished' });
  }

  return candidates;
}

export function hasReplenishmentSignal(
  data: Pick<ShelfData, 'items' | 'archive'> | null | undefined,
): boolean {
  return collectReplenishmentCandidates(data).length > 0;
}

/** Lightweight lifecycle evaluator over the exact local Shelf rows. It avoids
 * mounting the complete Shelf/profile/conflict query graph solely for a
 * background notification decision. */
export function hasReplenishmentSignalForProducts(
  products: readonly ShelfProduct[],
  today: string,
): boolean {
  const active = products.filter((product) => product.status === 'active');
  const activeIdentities = new Set(active.map(productIdentity));

  if (
    active.some((product) => {
      const kind = expiryBadge(surfacedExpiry(product), today).kind;
      return kind === 'countdown' || kind === 'expired';
    })
  ) {
    return true;
  }

  return products.some(
    (product) =>
      product.status === 'finished' && !activeIdentities.has(productIdentity(product)),
  );
}
