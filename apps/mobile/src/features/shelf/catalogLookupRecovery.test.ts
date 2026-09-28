import { describe, expect, it, vi } from 'vitest';

import type { CatalogProductSummary } from '@/features/catalog/client';
import type { ReadyCatalogLookup } from '@/lib/offline/catalogLookupQueue';

import {
  catalogRecoveryIntakePatch,
  catalogRecoveryShelfFields,
  finalizeCatalogLookupAfterShelfSave,
  revalidateCatalogRecovery,
} from './catalogLookupRecovery';

vi.mock('@/features/catalog/client', () => ({
  lookupBarcode: vi.fn(),
  catalogIntakeProvenance: (value: CatalogProductSummary) => ({
    catalogSourceId: value.catalog_source_id ?? null,
    paoMonths: 12,
    paoSource: 'catalog',
    expiryDate: null,
  }),
}));
vi.mock('@/lib/offline/catalogLookupQueue', () => ({
  acceptReadyCatalogLookup: vi.fn(),
  acceptReadyCatalogLookupAfterShelfSave: vi.fn(),
  bindCatalogLookupToShelfProduct: vi.fn(),
}));

const BARCODE = '012345678905';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000044';
const SOURCE_ID = '00000000-0000-4000-8000-000000000043';

function product(overrides: Partial<CatalogProductSummary> = {}): CatalogProductSummary {
  return {
    id: PRODUCT_ID,
    barcode: BARCODE,
    name: 'Reviewed Mineral SPF 50',
    brand: 'Layerwell',
    category: 'sunscreen',
    region: 'CA',
    source: 'layerwell_reviewed',
    catalog_source_id: SOURCE_ID,
    catalog_sources: {
      id: SOURCE_ID,
      source_key: 'layerwell_reviewed',
      display_name: 'Layerwell reviewed catalog',
    },
    source_ref: 'catalog-row-44',
    source_url: 'https://example.invalid/catalog-row-44',
    source_snapshot_date: '2026-07-17',
    quality_grade: 'usable',
    review_status: 'reviewed',
    data_quality_score: 91,
    ingredient_parse_status: 'parsed',
    ingredient_parse_confidence: 0.95,
    rawIngredientsText: 'Water, Zinc Oxide',
    product_pao_expiry: [
      {
        pao_months: 12,
        pao_source: 'catalog',
        expiry_date: '2027-07-01',
        expiry_source: 'printed',
        region: 'CA',
        source_id: SOURCE_ID,
        review_status: 'reviewed',
      },
    ],
    ...overrides,
  };
}

function ready(overrides: Partial<ReadyCatalogLookup> = {}): ReadyCatalogLookup {
  return {
    barcode: BARCODE,
    shelfProductId: '00000000-0000-4000-8000-000000000055',
    enqueuedAt: '2026-07-18T12:00:00.000Z',
    expiresAt: '2026-07-25T12:00:00.000Z',
    candidate: {
      productId: PRODUCT_ID,
      barcode: BARCODE,
      name: 'Reviewed Mineral SPF 50',
      brand: 'Layerwell',
      category: 'sunscreen',
      catalogSourceId: SOURCE_ID,
      sourceKey: 'layerwell_reviewed',
      sourceDisplayName: 'Layerwell reviewed catalog',
      qualityGrade: 'usable',
      reviewStatus: 'reviewed',
      matchedAt: '2026-07-18T12:01:00.000Z',
    },
    ...overrides,
  };
}

describe('catalog lookup recovery', () => {
  it('revalidates only the exact same reviewed first-party product', async () => {
    const lookup = vi.fn(async () => ({ result: 'matched' as const, product: product() }));

    await expect(revalidateCatalogRecovery(ready(), lookup)).resolves.toEqual({
      status: 'eligible',
      product: product(),
    });
    expect(lookup).toHaveBeenCalledWith(BARCODE);

    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({
          result: 'matched' as const,
          product: product({ id: '00000000-0000-4000-8000-000000000099' }),
        })),
      ),
    ).resolves.toEqual({ status: 'changed' });

    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({
          result: 'matched' as const,
          product: product({ name: 'A renamed product the user has not reviewed' }),
        })),
      ),
    ).resolves.toEqual({ status: 'changed' });

    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({
          result: 'external_candidate' as const,
          product: product(),
        })),
      ),
    ).resolves.toEqual({ status: 'changed' });
  });

  it('rejects unreviewed, source-mismatched, missing, and unavailable candidates', async () => {
    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({
          result: 'matched' as const,
          product: product({ review_status: 'pending' }),
        })),
      ),
    ).resolves.toEqual({ status: 'changed' });
    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({
          result: 'matched' as const,
          product: product({
            catalog_sources: { id: SOURCE_ID, source_key: 'different-source' },
          }),
        })),
      ),
    ).resolves.toEqual({ status: 'changed' });
    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({ result: 'no_match' as const })),
      ),
    ).resolves.toEqual({ status: 'gone' });
    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => ({ result: 'offline' as const })),
      ),
    ).resolves.toEqual({ status: 'unavailable' });
    await expect(
      revalidateCatalogRecovery(
        ready(),
        vi.fn(async () => Promise.reject(new Error('network'))),
      ),
    ).resolves.toEqual({ status: 'unavailable' });
  });

  it('creates a recovery intake token while keeping linked-update fields narrow', () => {
    const token = { barcode: BARCODE, productId: PRODUCT_ID };
    const intake = catalogRecoveryIntakePatch(product(), token);
    const linkedFields = catalogRecoveryShelfFields(product());

    expect(intake).toMatchObject({
      barcode: BARCODE,
      catalogProductId: PRODUCT_ID,
      catalogSourceId: SOURCE_ID,
      catalogRecoveryToken: token,
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: null,
      addedVia: 'barcode',
    });
    expect(intake.ingredients).toEqual(['Water', 'Zinc Oxide']);
    expect(linkedFields).toMatchObject({
      catalogProductId: PRODUCT_ID,
      catalogSourceId: SOURCE_ID,
      catalogName: 'Reviewed Mineral SPF 50',
    });
    expect(linkedFields).not.toHaveProperty('ingredients');
    expect(linkedFields).not.toHaveProperty('openedAt');
    expect(linkedFields).not.toHaveProperty('paoMonths');
    expect(linkedFields).not.toHaveProperty('expiryDate');
  });

  it('atomically binds and consumes an exact recovery token after a successful add', async () => {
    const bind = vi.fn(async () => true);
    const acceptAfterShelfSave = vi.fn(async () => {
      return ready();
    });

    await expect(
      finalizeCatalogLookupAfterShelfSave(
        {
          ownerUserId: 'owner-a',
          barcode: BARCODE,
          shelfProductId: '00000000-0000-4000-8000-000000000055',
          recoveryToken: { barcode: BARCODE, productId: PRODUCT_ID },
        },
        { bind, acceptAfterShelfSave },
      ),
    ).resolves.toBe('accepted');
    expect(bind).not.toHaveBeenCalled();
    expect(acceptAfterShelfSave).toHaveBeenCalledWith({
      ownerUserId: 'owner-a',
      barcode: BARCODE,
      productId: PRODUCT_ID,
      shelfProductId: '00000000-0000-4000-8000-000000000055',
    });
  });

  it('binds ordinary intake and preserves a recovery candidate when atomic acceptance fails', async () => {
    const bind = vi.fn(async () => true);
    const acceptAfterShelfSave = vi.fn(async () => ready());

    await expect(
      finalizeCatalogLookupAfterShelfSave(
        {
          ownerUserId: 'owner-a',
          barcode: BARCODE,
          shelfProductId: '00000000-0000-4000-8000-000000000055',
          recoveryToken: { barcode: '999999999999', productId: PRODUCT_ID },
        },
        { bind, acceptAfterShelfSave },
      ),
    ).resolves.toBe('bound');
    expect(acceptAfterShelfSave).not.toHaveBeenCalled();

    const failedAccept = vi.fn(async () => Promise.reject(new Error('private write failed')));
    await expect(
      finalizeCatalogLookupAfterShelfSave(
        {
          ownerUserId: 'owner-a',
          barcode: BARCODE,
          shelfProductId: '00000000-0000-4000-8000-000000000055',
          recoveryToken: { barcode: BARCODE, productId: PRODUCT_ID },
        },
        { bind, acceptAfterShelfSave: failedAccept },
      ),
    ).rejects.toThrow('private write failed');
    expect(failedAccept).toHaveBeenCalledOnce();
  });
});
