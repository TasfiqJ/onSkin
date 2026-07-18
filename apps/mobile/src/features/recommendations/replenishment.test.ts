import type { ProductStatus } from '@onskin/types';
import { describe, expect, it } from 'vitest';

import type { ShelfItem } from '@/features/shelf/useShelf';

import {
  collectReplenishmentCandidates,
  hasReplenishmentSignal,
  hasReplenishmentSignalForProducts,
} from './replenishment';

type ItemOptions = {
  id: string;
  status?: ProductStatus;
  badgeKind?: ShelfItem['badge']['kind'];
  name?: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  catalogProductId?: string | null;
  isOpened?: boolean;
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
  isOpened = true,
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
      isOpened,
    } as ShelfItem['product'],
    engineProduct: { id, name, tags: [] },
    paired: false,
  };
}

describe('replenishment signal selection', () => {
  it('includes only active countdown and expired freshness signals', () => {
    const countdown = item({ id: 'countdown', badgeKind: 'countdown' });
    const expired = item({ id: 'expired', badgeKind: 'expired' });
    const unknown = item({ id: 'unknown', badgeKind: 'unknown' });
    const unopened = item({ id: 'unopened', badgeKind: 'unknown', isOpened: false });

    expect(
      collectReplenishmentCandidates({
        items: [countdown, expired, unknown, unopened],
        archive: [],
      }),
    ).toEqual([
      { item: countdown, reason: 'countdown' },
      { item: expired, reason: 'expired' },
    ]);
  });

  it('includes finished products but never discarded archive rows', () => {
    const finished = item({ id: 'finished', status: 'finished' });
    const discarded = item({ id: 'discarded', status: 'discarded', badgeKind: 'expired' });

    expect(collectReplenishmentCandidates({ items: [], archive: [finished, discarded] })).toEqual([
      { item: finished, reason: 'finished' },
    ]);
    expect(hasReplenishmentSignal({ items: [], archive: [finished] })).toBe(true);
  });

  it('suppresses a finished unit after the same catalog product is re-added', () => {
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

  it('derives the same lightweight lifecycle signals from raw local Shelf rows', () => {
    const active = item({
      id: 'active',
      catalogProductId: 'catalog-1',
      badgeKind: 'expired',
    });
    active.product.expiryDate = '2026-06-01';
    active.product.status = 'active';
    const replaced = item({
      id: 'old',
      status: 'finished',
      catalogProductId: 'catalog-1',
    });

    expect(
      hasReplenishmentSignalForProducts(
        [active.product, replaced.product],
        '2026-07-18',
      ),
    ).toBe(true);
    expect(
      hasReplenishmentSignalForProducts(
        [
          {
            ...active.product,
            expiryDate: null,
            isOpened: false,
          },
          replaced.product,
        ],
        '2026-07-18',
      ),
    ).toBe(false);
  });
});
