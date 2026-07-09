import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reportCatalogIssue, searchCatalog } from './client';

const mocks = vi.hoisted(() => ({
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
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
const originalDev = runtime.__DEV__;

describe('catalog client E2E fixtures', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    mocks.isSupabaseConfigured = false;
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

describe('catalog issue reporting', () => {
  beforeEach(() => {
    mocks.isSupabaseConfigured = false;
    mocks.invoke.mockReset();
    mocks.track.mockClear();
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
    });
  });
});
