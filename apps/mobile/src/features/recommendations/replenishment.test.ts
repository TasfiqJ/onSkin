import type { ProductStatus } from '@onskin/types';
import { describe, expect, it } from 'vitest';

import type { ShelfItem } from '@/features/shelf/useShelf';

import { collectReplenishmentCandidates, hasReplenishmentSignal } from './replenishment';

type ItemOptions = {
  id: string;
  status?: ProductStatus;
  badgeKind?: ShelfItem['badge']['kind'];
  name?: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  catalogProductId?: string | null;
  replacementRootId?: string;
  expiryDate?: string | null;
  expirySource?: ShelfItem['product']['expirySource'];
  legacyUnverifiedExpiryDate?: string | null;
  isOpened?: boolean;
  paoSource?: ShelfItem['product']['paoSource'];
};

function item({
  id,
  status = 'active',
  badgeKind = 'unknown',
  name = id,
  brand = null,
  category = 'serum',
  barcode = null,
  catalogProductId = null,
  replacementRootId,
  expiryDate = null,
  expirySource = 'unknown',
  legacyUnverifiedExpiryDate = null,
  isOpened = true,
  paoSource = 'unknown',
}: ItemOptions): ShelfItem {
  return {
    id,
    name,
    brand,
    category,
    metaLine: '',
    status,
    badge: { kind: badgeKind } as ShelfItem['badge'],
    product: {
      id,
      name,
      brand,
      category,
      barcode,
      catalogProductId,
      replacementRootId,
      expiryDate,
      expirySource,
      legacyUnverifiedExpiryDate,
      isOpened,
      paoSource,
    } as ShelfItem['product'],
    engineProduct: { id, name, tags: [] },
    paired: false,
  };
}

describe('replenishment signal selection', () => {
  it('preserves printed-expiry, product-label PAO and reviewed catalog PAO provenance', () => {
    const printedCountdown = item({
      id: 'printed-countdown',
      badgeKind: 'countdown',
      expiryDate: '2026-08-01',
      expirySource: 'printed',
    });
    const printedExpired = item({
      id: 'printed-expired',
      badgeKind: 'expired',
      expiryDate: '2026-06-01',
      expirySource: 'printed',
    });
    const labelPaoCountdown = item({
      id: 'label-pao-countdown',
      badgeKind: 'countdown',
      expirySource: 'pao_computed',
      paoSource: 'label',
    });
    const catalogPaoExpired = item({
      id: 'catalog-pao-expired',
      badgeKind: 'expired',
      expirySource: 'pao_computed',
      paoSource: 'catalog',
    });
    const unopened = item({ id: 'unopened', badgeKind: 'unknown', isOpened: false });

    expect(
      collectReplenishmentCandidates({
        items: [
          printedCountdown,
          printedExpired,
          labelPaoCountdown,
          catalogPaoExpired,
          unopened,
        ],
        archive: [],
      }),
    ).toEqual([
      { item: printedCountdown, reason: 'printed_expiry_countdown' },
      { item: printedExpired, reason: 'printed_expiry_expired' },
      { item: labelPaoCountdown, reason: 'label_pao_countdown' },
      { item: catalogPaoExpired, reason: 'catalog_pao_expired' },
    ]);
  });

  it('rejects estimated, category-default and unknown freshness even with an actionable badge', () => {
    const estimated = item({
      id: 'estimated',
      badgeKind: 'countdown',
      expirySource: 'estimated',
      paoSource: 'category_default',
    });
    const categoryDefault = item({
      id: 'category-default',
      badgeKind: 'expired',
      expirySource: 'pao_computed',
      paoSource: 'category_default',
    });
    const unknown = item({
      id: 'unknown',
      badgeKind: 'expired',
      expirySource: 'unknown',
    });
    const legacyCatalogDate = item({
      id: 'legacy-catalog-date',
      badgeKind: 'expired',
      expiryDate: '2026-06-01',
      expirySource: 'printed',
      legacyUnverifiedExpiryDate: '2026-06-01',
    });

    expect(
      collectReplenishmentCandidates({
        items: [estimated, categoryDefault, unknown, legacyCatalogDate],
        archive: [],
      }),
    ).toEqual([]);
  });

  it('includes finished products but never discarded archive rows', () => {
    const finished = item({ id: 'finished', status: 'finished' });
    const discarded = item({ id: 'discarded', status: 'discarded', badgeKind: 'expired' });

    expect(collectReplenishmentCandidates({ items: [], archive: [finished, discarded] })).toEqual([
      { item: finished, reason: 'finished' },
    ]);
    expect(hasReplenishmentSignal({ items: [], archive: [finished] })).toBe(true);
  });

  it('falls back to catalog identity when replacement lineage is absent', () => {
    const activeReplacement = item({
      id: 'fresh-unit',
      catalogProductId: 'catalog-1',
      badgeKind: 'date',
    });
    const oldUnit = item({
      id: 'old-unit',
      status: 'finished',
      catalogProductId: 'catalog-1',
    });

    expect(
      collectReplenishmentCandidates({ items: [activeReplacement], archive: [oldUnit] }),
    ).toEqual([]);
  });

  it('uses immutable replacement lineage after the active successor gains catalog identity', () => {
    const replacementRootId = '00000000-0000-4000-8000-000000000090';
    const activeReplacement = item({
      id: 'enriched-successor',
      replacementRootId,
      catalogProductId: 'catalog-1',
      badgeKind: 'date',
    });
    const oldManualUnit = item({
      id: 'manual-ancestor',
      replacementRootId,
      status: 'finished',
      name: 'Barrier cream',
      brand: 'Example',
      catalogProductId: null,
    });

    expect(
      collectReplenishmentCandidates({ items: [activeReplacement], archive: [oldManualUnit] }),
    ).toEqual([]);
  });

  it('deduplicates repeated finished history for the same manual product', () => {
    const latest = item({ id: 'latest', status: 'finished', name: 'Daily Cream', brand: 'A' });
    const older = item({ id: 'older', status: 'finished', name: 'daily cream', brand: 'a' });

    expect(collectReplenishmentCandidates({ items: [], archive: [latest, older] })).toEqual([
      { item: latest, reason: 'finished' },
    ]);
  });

  it('returns no automatic signal for unknown or unopened products without a printed date', () => {
    expect(
      hasReplenishmentSignal({
        items: [
          item({ id: 'unknown', badgeKind: 'unknown' }),
          item({ id: 'unopened', badgeKind: 'unknown', isOpened: false }),
        ],
        archive: [],
      }),
    ).toBe(false);
  });
});
