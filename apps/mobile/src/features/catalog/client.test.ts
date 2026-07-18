import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  catalogIntakeProvenance,
  lookupBarcode,
  reportCatalogIssue,
  searchCatalog,
  type CatalogProductSummary,
  type CatalogReportInput,
} from './client';

const mocks = vi.hoisted(() => ({
  isSupabaseConfigured: false,
  invoke: vi.fn(),
  leaseOpen: true,
  ownerUserId: 'user-1' as string | null,
  track: vi.fn(),
}));

vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingOwnerUserId: () => mocks.ownerUserId,
}));

vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  runHealthDataWriteOperation: async (
    ownerUserId: string,
    operation: (lease: { ownerUserId: string; assertCurrent: () => void }) => unknown,
  ) => {
    const assertCurrent = () => {
      if (!mocks.leaseOpen) throw new Error('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    };
    assertCurrent();
    const result = await operation({ ownerUserId, assertCurrent });
    assertCurrent();
    return result;
  },
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

function networkCatalogProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    barcode: '012345678905',
    name: 'Catalog serum',
    brand: 'Evidence Lab',
    category: 'serum',
    region: 'US',
    default_pao_months: 12,
    source: 'open_beauty_facts',
    catalog_source_id: '00000000-0000-4000-8000-000000000042',
    source_ref: 'obf:012345678905',
    source_url: 'https://catalog.example/products/012345678905',
    source_snapshot_date: '2026-07-09',
    quality_grade: 'usable',
    review_status: 'reviewed',
    data_quality_score: 92,
    ingredient_parse_status: 'complete',
    ingredient_parse_confidence: 0.98,
    catalog_sources: {
      id: '00000000-0000-4000-8000-000000000042',
      display_name: 'Reviewed offline catalog',
      source_key: 'open_beauty_facts',
      attribution_text: 'Source attribution',
      attribution_url: 'https://catalog.example/attribution',
    },
    product_pao_expiry: [],
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
    mocks.leaseOpen = true;
    mocks.invoke.mockClear();
    mocks.track.mockClear();
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
  });

  it('supports a dev-only catalog search no-match fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'no_match';

    await expect(searchCatalog('definitely not a catalog item')).resolves.toEqual({
      result: 'no_match',
      products: [],
      manualFallback: true,
    });

    expect(mocks.track).toHaveBeenCalledWith('catalog_search', { result: 'no_match' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('supports a dev-only eligible reviewed catalog match fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'matched';

    await expect(searchCatalog('barrier serum')).resolves.toMatchObject({
      result: 'matched',
      manualFallback: false,
      product: {
        id: '00000000-0000-4000-8000-000000000044',
        name: 'Reviewed Barrier Serum',
        quality_grade: 'usable',
        review_status: 'reviewed',
      },
      products: [
        {
          id: '00000000-0000-4000-8000-000000000044',
          barcode: '036000291452',
          catalog_source_id: '00000000-0000-4000-8000-000000000043',
        },
      ],
    });

    expect(mocks.track).toHaveBeenCalledWith('catalog_search', { result: 'matched' });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('supports a dev-only catalog search wrong-match fixture', async () => {
    process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT = 'wrong_match';

    await expect(searchCatalog('ceramide cleanser')).resolves.toMatchObject({
      result: 'matched',
      product: {
        id: '00000000-0000-4000-8000-000000000045',
        name: 'Wrong Catalog Serum',
        source: 'open_beauty_facts',
        catalog_source_id: '00000000-0000-4000-8000-000000000042',
      },
      products: [
        {
          id: '00000000-0000-4000-8000-000000000045',
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

    expect(mocks.track).toHaveBeenCalledWith('catalog_search', { result: 'matched' });
    expect(mocks.invoke).not.toHaveBeenCalled();
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
});

describe('catalog network response validation', () => {
  beforeEach(() => {
    runtime.__DEV__ = false;
    mocks.isSupabaseConfigured = true;
    mocks.leaseOpen = true;
    mocks.invoke.mockReset();
    mocks.track.mockClear();
    delete process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT;
  });

  afterEach(() => {
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('accepts only an exact reviewed and servable barcode response', async () => {
    const product = networkCatalogProduct();
    mocks.invoke.mockResolvedValueOnce({
      data: { result: 'matched', product },
      error: null,
    });

    await expect(lookupBarcode('012345678905')).resolves.toEqual({
      result: 'matched',
      product,
    });
    expect(mocks.track).toHaveBeenCalledWith('catalog_barcode_lookup', { result: 'matched' });
  });

  it('fails closed for external, unreviewed, mismatched, and malformed barcode responses', async () => {
    const invalidResponses = [
      { result: 'external_candidate', product: networkCatalogProduct() },
      {
        result: 'matched',
        product: networkCatalogProduct({ review_status: 'unreviewed' }),
      },
      {
        result: 'matched',
        product: networkCatalogProduct({ barcode: '4006381333931' }),
      },
      {
        result: 'matched',
        product: networkCatalogProduct({ barcode: '012345678906' }),
      },
      {
        result: 'matched',
        product: networkCatalogProduct({ barcode: '0012345678905' }),
      },
      {
        result: 'matched',
        product: networkCatalogProduct(),
        unexpected: true,
      },
    ];

    for (const data of invalidResponses) {
      mocks.invoke.mockResolvedValueOnce({ data, error: null });
      await expect(lookupBarcode('012345678905')).resolves.toEqual({
        result: 'error',
        manualFallback: true,
      });
    }

    expect(mocks.track).toHaveBeenCalledTimes(invalidResponses.length);
    expect(mocks.track).toHaveBeenCalledWith('catalog_barcode_lookup', { result: 'error' });
  });

  it('accepts an exact reviewed search response and rejects unsafe response shapes', async () => {
    const product = networkCatalogProduct();
    mocks.invoke.mockResolvedValueOnce({
      data: { result: 'matched', products: [product], manualFallback: false },
      error: null,
    });
    await expect(searchCatalog('catalog serum')).resolves.toEqual({
      result: 'matched',
      products: [product],
      manualFallback: false,
    });

    const invalidResponses = [
      { result: 'external_candidate', products: [product], manualFallback: false },
      {
        result: 'matched',
        products: [networkCatalogProduct({ quality_grade: 'limited' })],
        manualFallback: false,
      },
      {
        result: 'matched',
        products: [networkCatalogProduct({ barcode: '012345678906' })],
        manualFallback: false,
      },
      {
        result: 'matched',
        products: [networkCatalogProduct({ barcode: '0012345678905' })],
        manualFallback: false,
      },
      {
        result: 'matched',
        products: [product],
        manualFallback: false,
        unexpected: true,
      },
    ];
    for (const data of invalidResponses) {
      mocks.invoke.mockResolvedValueOnce({ data, error: null });
      await expect(searchCatalog('catalog serum')).resolves.toEqual({
        result: 'error',
        products: [],
        manualFallback: true,
      });
    }

    expect(mocks.track).toHaveBeenCalledWith('catalog_search', { result: 'matched' });
    expect(mocks.track).toHaveBeenCalledWith('catalog_search', { result: 'error' });
  });
});

describe('catalog issue reporting', () => {
  const reportRequestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const reported = {
    result: 'reported',
    correction: {
      id: '00000000-0000-4000-8000-000000000901',
      status: 'open',
      created_at: '2026-07-18T12:00:00.000Z',
      created: true,
    },
  };

  beforeEach(() => {
    mocks.leaseOpen = true;
    mocks.ownerUserId = 'user-1';
    mocks.isSupabaseConfigured = false;
    mocks.invoke.mockReset();
    mocks.track.mockClear();
  });

  it('distinguishes an unconfigured build without claiming or tracking a report', async () => {
    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'wrong_match',
        productId: '00000000-0000-4000-8000-000000000123',
        barcode: '012345678905',
        description: 'wrong_match reported from product detail',
      }),
    ).resolves.toEqual({ result: 'not_configured' });

    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('distinguishes closed or withdrawn health authority before transport', async () => {
    mocks.ownerUserId = null;

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).resolves.toEqual({ result: 'offline_or_withdrawn' });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('fails closed before transport when the UI did not supply a random request identity', async () => {
    mocks.isSupabaseConfigured = true;

    await expect(
      reportCatalogIssue({ correctionType: 'missing_product', barcode: '012345678905' }),
    ).resolves.toEqual({ result: 'invalid_request' });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('validates success, removes a duplicated payload barcode, then tracks only correction type', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({ data: reported, error: null });

    await expect(
      reportCatalogIssue({
        reportRequestId,
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
      } as unknown as CatalogReportInput),
    ).resolves.toEqual({
      result: 'success',
      correction: {
        id: '00000000-0000-4000-8000-000000000901',
        status: 'open',
        createdAt: '2026-07-18T12:00:00.000Z',
        created: true,
      },
    });

    expect(mocks.track).toHaveBeenCalledWith('catalog_correction_reported', {
      correction_type: 'missing_product',
    });
    expect(mocks.track).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('catalog-report', {
      body: {
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
        description: 'missing_product reported from barcode no-match',
        proposedPayload: { productName: 'Unknown sunscreen' },
        clientContext: {
          addedVia: 'barcode',
          route: 'shelf_no_match',
        },
      },
    });
  });

  it('always strips a legacy nested barcode even without a top-level barcode', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({ data: reported, error: null });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        proposedPayload: {
          barcode: '012345678905',
          productName: 'Unknown sunscreen',
        },
      } as unknown as CatalogReportInput),
    ).resolves.toMatchObject({ result: 'success' });

    expect(mocks.invoke).toHaveBeenCalledWith('catalog-report', {
      body: {
        reportRequestId,
        correctionType: 'missing_product',
        proposedPayload: { productName: 'Unknown sunscreen' },
      },
    });
  });

  it('sends the same sanitized catalog fields shown by confirmation', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({ data: reported, error: null });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        description: 'missing_product reported from catalog search',
        proposedPayload: {
          productName: '  Photoderm   Aquafluide  ',
          brand: 'Image Skincare',
          sourceUrl: 'https://catalog.example/products/123?token=private#review',
        },
        clientContext: { addedVia: 'search', route: 'shelf_search' },
      }),
    ).resolves.toMatchObject({ result: 'success' });

    expect(mocks.invoke).toHaveBeenCalledWith('catalog-report', {
      body: {
        reportRequestId,
        correctionType: 'missing_product',
        description: 'missing_product reported from catalog search',
        proposedPayload: {
          productName: 'Photoderm Aquafluide',
          brand: 'Image Skincare',
          sourceUrl: 'https://catalog.example/products/123',
        },
        clientContext: { addedVia: 'search', route: 'shelf_search' },
      },
    });
  });

  it('does not track an unvalidated success envelope', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: { result: 'reported', correction: { status: 'open' } },
      error: null,
    });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).resolves.toEqual({ result: 'error' });

    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('returns a truthful current receipt on replay without duplicating success analytics', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: {
        result: 'already_received',
        correction: {
          id: '00000000-0000-4000-8000-000000000901',
          status: 'triaged',
          created_at: '2026-07-18T12:00:00.000Z',
          created: false,
        },
      },
      error: null,
    });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).resolves.toEqual({
      result: 'success',
      correction: {
        id: '00000000-0000-4000-8000-000000000901',
        status: 'triaged',
        createdAt: '2026-07-18T12:00:00.000Z',
        created: false,
      },
    });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('detects backend rate limiting without emitting success analytics', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: { error: 'rate_limited' },
      error: { name: 'FunctionsHttpError', context: { status: 429 } },
    });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).resolves.toEqual({ result: 'rate_limited' });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('keeps a busy owner transaction explicitly retryable without success analytics', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockResolvedValueOnce({
      data: { error: 'report_busy' },
      error: { name: 'FunctionsHttpError', context: { status: 423 } },
    });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).resolves.toEqual({ result: 'retryable' });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('FunctionsFetchError: Failed to send a request'), 'offline_or_withdrawn'],
    [new Error('unexpected invoke failure'), 'error'],
  ] as const)('converts ordinary invoke rejection %s into %s', async (failure, result) => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockRejectedValueOnce(failure);

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).resolves.toEqual({ result });
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('does not swallow a stale health lease behind an ordinary invoke failure', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockImplementationOnce(async () => {
      mocks.leaseOpen = false;
      throw new Error('network unavailable');
    });

    await expect(
      reportCatalogIssue({
        reportRequestId,
        correctionType: 'missing_product',
        barcode: '012345678905',
      }),
    ).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('rejects a stale lookup response before analytics or result publication', async () => {
    mocks.isSupabaseConfigured = true;
    mocks.invoke.mockImplementationOnce(async () => {
      mocks.leaseOpen = false;
      return { data: { result: 'matched' }, error: null };
    });

    await expect(lookupBarcode('012345678905')).rejects.toThrow(
      'HEALTH_DATA_WRITE_ADMISSION_CLOSED',
    );

    expect(mocks.track).not.toHaveBeenCalledWith('catalog_barcode_lookup', expect.anything());
  });
});
