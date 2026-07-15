import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { detectConflicts, isReassuring } from '@/features/intelligence/engine';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import { STARTER_RULES } from '@/features/intelligence/rules';

import { isEstimatedExpiry } from './expiry';
import { formatShelfMetaLine, SHELF_META_SEPARATOR } from './metadata';
import { pairedProductIdsForResolvedConflicts } from './pairedConflicts';
import type { ShelfProduct } from './store';

const profile = { sensitivity: 'sensitive', pregnancy: false } as const;

function shelfProduct(overrides: Partial<ShelfProduct> = {}): ShelfProduct {
  return {
    id: 'product-1',
    name: 'Retinol Serum',
    brand: null,
    category: null,
    barcode: null,
    catalogProductId: null,
    catalogSourceId: null,
    catalogSource: 'user_local',
    catalogSourceName: null,
    catalogSourceRef: null,
    catalogSourceUrl: null,
    catalogSourceSnapshotDate: null,
    catalogMatchQuality: 'manual',
    dataQualityScore: null,
    ingredientParseStatus: null,
    ingredientParseConfidence: null,
    parserVersion: null,
    sourceDisclosureAckAt: null,
    ingredients: [],
    openedAt: '2026-07-06',
    isOpened: true,
    paoMonths: 6,
    paoSource: 'category_default',
    expiryDate: null,
    expirySource: 'pao_computed',
    status: 'active',
    finishedAt: null,
    addedVia: 'manual',
    repurchaseCount: 1,
    thumbnailPath: null,
    createdAt: '2026-07-06T12:00:00.000Z',
    updatedAt: '2026-07-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('shelf paired badge resolution gate', () => {
  it('reuses the Shelf owner lease for the safety profile read', () => {
    const source = readFileSync(fileURLToPath(new URL('./useShelf.ts', import.meta.url)), 'utf8');

    expect(source).toContain('readProfileBitsWithLease(childLease)');
    expect(source).toContain('awaitAccountGenerationLease(childLease, () => loadShelf())');
    expect(source).toContain(
      'awaitAccountGenerationLease(childLease, () => loadConflictChoices())',
    );
    expect(source).not.toMatch(/\breadProfileBits\(\)/);
  });

  it('does not mark alternate-night advice as paired until scheduler placement resolves it', () => {
    const [conflict] = detectConflicts(
      [
        { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
        { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      profile,
      STARTER_RULES,
    );

    expect(conflict?.rule.resolutionType).toBe('alternate_nights');
    expect(pairedProductIdsForResolvedConflicts([conflict!], new Set())).toEqual(new Set());

    const resolved = pairedProductIdsForResolvedConflicts(
      [conflict!],
      new Set([conflictKey(conflict!)]),
    );
    expect(resolved).toEqual(new Set(['retinol', 'glycolic']));
  });

  it('does not mark overridden or reassuring interactions as paired', () => {
    const conflicts = detectConflicts(
      [
        { id: 'niacinamide', name: 'Niacinamide 10%', tags: ['niacinamide'] },
        { id: 'vitc', name: 'Vitamin C serum', tags: ['vitamin_c'] },
      ],
      profile,
      STARTER_RULES,
    );
    const reassurance = conflicts.find(isReassuring);
    expect(reassurance).toBeDefined();

    expect(
      pairedProductIdsForResolvedConflicts([reassurance!], new Set([conflictKey(reassurance!)])),
    ).toEqual(new Set());

    const [conflict] = detectConflicts(
      [
        { id: 'retinol', name: 'Retinol 0.3%', tags: ['retinoid'] },
        { id: 'glycolic', name: 'Glycolic 7%', tags: ['aha'] },
      ],
      profile,
      STARTER_RULES,
    );
    const key = conflictKey(conflict!);
    expect(
      pairedProductIdsForResolvedConflicts([conflict!], new Set([key]), new Set([key])),
    ).toEqual(new Set());
  });
});

describe('shelf metadata formatting', () => {
  it('keeps metadata phrases attached so narrow cards wrap at clean boundaries', () => {
    const meta = formatShelfMetaLine(shelfProduct());

    expect(meta).toBe(
      ['added\u00A0by\u00A0hand', 'opened\u00A0Jul', 'est.\u00A06\u00A0mo'].join(
        SHELF_META_SEPARATOR,
      ),
    );
    expect(meta).not.toContain('opened Jul');
    expect(meta).not.toContain(' · ');
  });

  it('describes the winning PAO estimate when a later printed date does not win', () => {
    const meta = formatShelfMetaLine(
      shelfProduct({
        category: 'spf',
        expiryDate: '2027-01-01',
        expirySource: 'pao_computed',
        paoSource: 'category_default',
      }),
    );

    expect(meta).toContain('est.\u00A06\u00A0mo');
    expect(meta).not.toContain('printed\u00A0expiry');
  });
});

describe('surfaced expiry estimate provenance', () => {
  it('follows the winning expiry source when printed and PAO dates coexist', () => {
    expect(
      isEstimatedExpiry(
        shelfProduct({
          category: 'spf',
          expiryDate: '2026-12-01',
          expirySource: 'pao_computed',
          paoSource: 'category_default',
        }),
      ),
    ).toBe(true);
    expect(
      isEstimatedExpiry(
        shelfProduct({
          expiryDate: '2026-08-01',
          expirySource: 'printed',
          paoSource: 'category_default',
        }),
      ),
    ).toBe(false);
  });
});
