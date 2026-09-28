import type { ShelfData, ShelfItem } from '@/features/shelf/useShelf';

export const REPLENISHMENT_REASONS = [
  'printed_expiry_countdown',
  'printed_expiry_expired',
  'label_pao_countdown',
  'label_pao_expired',
  'catalog_pao_countdown',
  'catalog_pao_expired',
  'finished',
] as const;

/**
 * A replacement reason carries both lifecycle state and the provenance that
 * makes the freshness signal safe to surface. Category-default estimates and
 * unknown dates deliberately have no representable reason.
 */
export type ReplenishmentReason = (typeof REPLENISHMENT_REASONS)[number];

export type ShelfReplenishmentCandidate = {
  item: ShelfItem;
  reason: ReplenishmentReason;
};

function normalized(value: string | null): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

type FreshnessBadgeKind = 'countdown' | 'expired';
type FreshnessReplenishmentReason = Exclude<ReplenishmentReason, 'finished'>;

function freshnessReason(
  product: Pick<
    ShelfItem['product'],
    'expiryDate' | 'expirySource' | 'legacyUnverifiedExpiryDate' | 'paoSource'
  >,
  badgeKind: FreshnessBadgeKind,
): FreshnessReplenishmentReason | null {
  if (
    product.expirySource === 'printed' &&
    product.expiryDate !== null &&
    product.legacyUnverifiedExpiryDate === null
  ) {
    return badgeKind === 'countdown'
      ? 'printed_expiry_countdown'
      : 'printed_expiry_expired';
  }

  if (product.expirySource === 'pao_computed' && product.paoSource === 'label') {
    return badgeKind === 'countdown' ? 'label_pao_countdown' : 'label_pao_expired';
  }

  if (product.expirySource === 'pao_computed' && product.paoSource === 'catalog') {
    return badgeKind === 'countdown' ? 'catalog_pao_countdown' : 'catalog_pao_expired';
  }

  return null;
}

/** Stable enough to suppress an archived unit after the same product is re-added. */
function productIdentity(item: ShelfItem): string {
  const product = item.product;
  const replacementRootId = normalized(product.replacementRootId ?? null);
  if (replacementRootId) return `replacement:${replacementRootId}`;
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
    if (item.badge.kind !== 'countdown' && item.badge.kind !== 'expired') continue;
    const reason = freshnessReason(item.product, item.badge.kind);
    if (reason) candidates.push({ item, reason });
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
