import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  catalogIntakeProvenance,
  reportCatalogIssue,
  searchCatalog,
  type CatalogProductSummary,
} from './client';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  isSupabaseConfigured: false,
  invoke: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  get isSupabaseConfigured() {
    return mocks.isSupabaseConfigured;
  },
}));

vi.mock('@/lib/analytics/track', () => ({
  track: mocks.track,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
    },
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

function catalogProduct(overrides: Partial<CatalogProductSummary> = {}): CatalogProductSummary {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    barcode: '012345678905',
    name: 'Catalog serum',
    brand: 'Evidence Lab',
    category: 'serum',
    region: 'US',
    default_pao_months: 24,
    source: 'open_beauty_facts',
    source_ref: 'obf:012345678905',
    ...overrides,
  };
}

describe('catalog intake provenance', () => {
  it('keeps the catalog source UUID separate from its upstream reference', () => {
    const product = catalogProduct({
      catalog_source_id: '00000000-0000-4000-8000-000000000042',
      source_ref: 'obf:012345678905',
      product_pao_expiry: [
        {
          pao_months: 12,
          pao_source: 'catalog',
          expiry_date: '2028-04-30',
          expiry_source: 'printed',
          region: 'US',
          review_status: 'reviewed',
        },
      ],
    });

    expect(catalogIntakeProvenance(product)).toEqual({
      catalogSourceId: '00000000-0000-4000-8000-000000000042',
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: '2028-04-30',
    });
  });

  it('uses only explicit reviewed PAO evidence and never relabels a legacy default', () => {
    expect(catalogIntakeProvenance(catalogProduct())).toEqual({
      catalogSourceId: null,
      paoMonths: null,
      paoSource: 'unknown',
      expiryDate: null,
    });

    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [
            {
              pao_months: 9,
              pao_source: 'label',
              region: 'US',
              review_status: 'unreviewed',
            },
          ],
        }),
      ),
    ).toMatchObject({ paoMonths: null, paoSource: 'unknown' });
  });

  it('preserves explicit label evidence but rejects region-mismatched evidence', () => {
    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [
            {
              pao_months: 6,
              pao_source: 'brand_label',
              region: 'US',
              review_status: 'reviewed',
            },
          ],
        }),
      ),
    ).toMatchObject({ paoMonths: 6, paoSource: 'label' });

    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [
            {
              pao_months: 6,
              pao_source: 'label',
              region: 'CA',
              review_status: 'reviewed',
            },
          ],
        }),
      ),
    ).toMatchObject({ paoMonths: null, paoSource: 'unknown' });
  });

  it('does not turn computed, manufacturer, or unknown expiry evidence into a printed date', () => {
    const common = {
      pao_months: 12,
      pao_source: 'catalog' as const,
      expiry_date: '2028-04-30',
      region: 'US',
      review_status: 'reviewed',
    };

    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [{ ...common, expiry_source: 'pao_computed' }],
        }),
      ),
    ).toMatchObject({ paoMonths: 12, paoSource: 'catalog', expiryDate: null });
    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [{ ...common, expiry_source: 'unknown' }],
        }),
      ),
    ).toMatchObject({ expiryDate: null });
    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [{ ...common, expiry_source: 'manufacturer' }],
        }),
      ),
    ).toMatchObject({ expiryDate: null });
  });

  it('degrades conflicting reviewed values to unknown instead of guessing', () => {
    expect(
      catalogIntakeProvenance(
        catalogProduct({
          product_pao_expiry: [
            {
              pao_months: 6,
              pao_source: 'label',
              expiry_date: '2027-06-01',
              expiry_source: 'printed',
              region: 'US',
              review_status: 'reviewed',
            },
            {
              pao_months: 12,
              pao_source: 'catalog',
              expiry_date: '2028-06-01',
              expiry_source: 'printed',
              region: 'US',
              review_status: 'reviewed',
            },
          ],
        }),
      ),
    ).toMatchObject({ paoMonths: null, paoSource: 'unknown', expiryDate: null });
  });

  it('never substitutes source_ref for a missing or malformed source UUID', () => {
    expect(
      catalogIntakeProvenance(
        catalogProduct({
          catalog_source_id: 'obf:012345678905',
          source_ref: '00000000-0000-4000-8000-000000000042',
        }),
      ).catalogSourceId,
    ).toBeNull();
  });
});

describe('catalog client E2E fixtures', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    mocks.isSupabaseConfigured = false;
    mocks.invoke.mockClear();
    mocks.track.mockClear();
    mocks.getUser.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'account-a' } }, error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a', user: { id: 'account-a' } } },
      error: null,
    });
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_DELAY_MS;
  });

  it('supports a dev-only catalog search no-match fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'no_match';

    await expect(searchCatalog('definitely not a catalog item')).resolves.toEqual({
      result: 'no_match',
      products: [],
      manualFallback: true,
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('supports a dev-only catalog search wrong-match fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'wrong_match';

    await expect(searchCatalog('ceramide cleanser')).resolves.toMatchObject({
      result: 'matched',
      product: {
        id: 'e2e-wrong-match-product',
        name: 'Wrong Catalog Serum',
        source: 'open_beauty_facts',
        catalog_source_id: '00000000-0000-4000-8000-000000000042',
      },
      products: [
        {
          id: 'e2e-wrong-match-product',
          barcode: '012345678905',
          name: 'Wrong Catalog Serum',
          quality_grade: 'limited',
          product_pao_expiry: [
            {
              pao_months: 6,
              pao_source: 'catalog',
              review_status: 'reviewed',
            },
          ],
        },
      ],
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('supports a bounded dev-only catalog render-stress fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'stress';

    const response = await searchCatalog('render fixture');

    expect(response).toMatchObject({ result: 'matched' });
    expect(response.products).toHaveLength(12);
    expect(response.products?.map((product) => product.id)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `e2e-catalog-stress-${String(index + 1).padStart(2, '0')}`,
      ),
    );
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('rejects short sanitized queries locally without transport or analytics', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'stress';

    await expect(searchCatalog('a%')).resolves.toEqual({
      result: 'too_short',
      products: [],
      manualFallback: true,
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('normalizes and bounds the query before invoking catalog-search', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: { result: 'no_match', products: [] },
      error: null,
    });
    const query = `  ${'a'.repeat(90)}   cleanser  `;

    await expect(searchCatalog(query)).resolves.toEqual({ result: 'no_match', products: [] });

    expect(mocks.invoke).toHaveBeenCalledWith('catalog-search', {
      body: { query: 'a'.repeat(80), limit: 12 },
      headers: { Authorization: 'Bearer token-a' },
      signal: expect.any(AbortSignal),
    });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('ignores catalog search fixtures outside development runtime', async () => {
    runtime.__DEV__ = false;
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'no_match';

    await expect(searchCatalog('definitely not a catalog item')).resolves.toEqual({
      result: 'offline',
      products: [],
      manualFallback: true,
    });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('lets a route cancellation stop a delayed dev search without publishing a result', async () => {
    vi.useFakeTimers();
    try {
      process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'no_match';
      process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_DELAY_MS = '1500';
      const controller = new AbortController();
      const request = searchCatalog('ceramide', { signal: controller.signal });

      controller.abort();
      await vi.runAllTimersAsync();

      await expect(request).resolves.toEqual({
        result: 'error',
        products: [],
        manualFallback: true,
      });
      expect(mocks.track).not.toHaveBeenCalled();
      expect(mocks.invoke).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('catalog issue reporting', () => {
  beforeEach(() => {
    mocks.isSupabaseConfigured = false;
    mocks.invoke.mockReset();
    mocks.track.mockClear();
    mocks.getUser.mockReset();
    mocks.getSession.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'account-a' } }, error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a', user: { id: 'account-a' } } },
      error: null,
    });
  });

  it('tracks only correction type and falls back safely while offline', async () => {
    await expect(
      reportCatalogIssue({
        correctionType: 'wrong_match',
        productId: 'catalog-123',
        barcode: '012345678905',
        description: 'wrong_match reported from product detail',
        proposedPayload: {
          productName: 'Private shelf product',
          ingredientsText: 'Do not leak this into analytics',
        },
        clientContext: { route: 'shelf_detail' },
      }),
    ).resolves.toEqual({ ok: false, offline: true });

    expect(mocks.track).toHaveBeenCalledWith('catalog_correction_reported', {
      correction_type: 'wrong_match',
    });
    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('submits correction reports only to the catalog-report Edge Function when configured', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({ error: null });

    await expect(
      reportCatalogIssue({
        correctionType: 'ingredient_issue',
        productId: 'catalog-456',
        barcode: null,
        description: 'ingredient_issue reported from product detail',
        clientContext: {
          addedVia: 'search',
          quality: 'usable',
          route: 'shelf_detail',
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(mocks.track).toHaveBeenCalledWith('catalog_correction_reported', {
      correction_type: 'ingredient_issue',
    });
    expect(mocks.invoke).toHaveBeenCalledWith('catalog-report', {
      body: {
        correctionType: 'ingredient_issue',
        productId: 'catalog-456',
        barcode: null,
        description: 'ingredient_issue reported from product detail',
        clientContext: {
          addedVia: 'search',
          quality: 'usable',
          route: 'shelf_detail',
        },
      },
      headers: { Authorization: 'Bearer token-a' },
      signal: expect.any(AbortSignal),
    });
  });

  it('submits missing-product reports with product-only context when configured', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({ error: null });

    await expect(
      reportCatalogIssue({
        correctionType: 'missing_product',
        barcode: '012345678905',
        description: 'missing_product reported from barcode no-match',
        proposedPayload: {
          barcode: '012345678905',
          productName: 'Unknown sunscreen',
        },
        clientContext: {
          addedVia: 'barcode',
          route: 'shelf_no_match',
        },
      }),
    ).resolves.toEqual({ ok: true });

    expect(mocks.track).toHaveBeenCalledWith('catalog_correction_reported', {
      correction_type: 'missing_product',
    });
    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('catalog-report', {
      body: {
        correctionType: 'missing_product',
        barcode: '012345678905',
        description: 'missing_product reported from barcode no-match',
        proposedPayload: {
          barcode: '012345678905',
          productName: 'Unknown sunscreen',
        },
        clientContext: {
          addedVia: 'barcode',
          route: 'shelf_no_match',
        },
      },
      headers: { Authorization: 'Bearer token-a' },
      signal: expect.any(AbortSignal),
    });
  });
});
