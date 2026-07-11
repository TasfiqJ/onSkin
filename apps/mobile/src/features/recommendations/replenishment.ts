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
function productIdentity(item: ShelfItem): string {
  const product = item.product;
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
  const activeIdentities = new Set(active.map(productIdentity));
  const candidates: ShelfReplenishmentCandidate[] = [];
  for (const item of active) {
    if (item.badge.kind === 'countdown') candidates.push({ item, reason: 'countdown' });
    if (item.badge.kind === 'expired') candidates.push({ item, reason: 'expired' });
  }

  const seenFinished = new Set<string>();
  for (const item of data.archive) {
    if (item.status !== 'finished') continue;
    const identity = productIdentity(item);
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
