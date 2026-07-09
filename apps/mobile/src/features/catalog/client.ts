import type { ProductCategory } from '@/features/shelf/categories';
import { track } from '@/lib/analytics/track';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import type { CatalogQualityGrade } from './quality';

export type CatalogProductSummary = {
  id: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: ProductCategory | string | null;
  default_pao_months?: number | null;
  source: string | null;
  source_ref?: string | null;
  source_url?: string | null;
  source_snapshot_date?: string | null;
  quality_grade?: CatalogQualityGrade | string | null;
  review_status?: string | null;
  data_quality_score?: number | null;
  ingredient_parse_status?: string | null;
  ingredient_parse_confidence?: number | null;
  rawIngredientsText?: string | null;
  external?: boolean;
};

export type CatalogLookupResponse =
  | { result: 'matched' | 'external_candidate'; product: CatalogProductSummary }
  | {
      result: 'no_match' | 'too_short' | 'offline' | 'error';
      products?: CatalogProductSummary[];
      manualFallback?: boolean;
    };

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function devCatalogSearchFixture():
  | (CatalogLookupResponse & { products?: CatalogProductSummary[] })
  | null {
  if (!isDevRuntime()) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT?.trim().toLowerCase();
  if (fixture === 'no_match') return { result: 'no_match', products: [], manualFallback: true };
  if (fixture === 'wrong_match') {
    const product: CatalogProductSummary = {
      id: 'e2e-wrong-match-product',
      barcode: '012345678905',
      name: 'Wrong Catalog Serum',
      brand: 'Mismatch Lab',
      category: 'serum',
      default_pao_months: 6,
      source: 'open_beauty_facts',
      source_ref: '012345678905',
      source_url: 'https://world.openbeautyfacts.org/product/012345678905',
      source_snapshot_date: '2026-07-09',
      quality_grade: 'limited',
      review_status: 'fixture',
      data_quality_score: 0.42,
      ingredient_parse_status: 'partial',
      ingredient_parse_confidence: 0.52,
      rawIngredientsText: 'Aqua, Glycerin, Niacinamide',
    };
    return { result: 'matched', product, products: [product] };
  }
  return null;
}

export async function lookupBarcode(barcode: string): Promise<CatalogLookupResponse> {
  if (!isSupabaseConfigured) return { result: 'offline', manualFallback: true };
  const { data, error } = await supabase.functions.invoke('catalog-lookup', { body: { barcode } });
  track('catalog_barcode_lookup', { result: error ? 'error' : (data?.result ?? 'unknown') });
  if (error) return { result: 'error', manualFallback: true };
  return data as CatalogLookupResponse;
}

export async function searchCatalog(
  query: string,
): Promise<CatalogLookupResponse & { products?: CatalogProductSummary[] }> {
  const fixture = devCatalogSearchFixture();
  if (fixture) {
    track('catalog_search', { result: fixture.result });
    return fixture;
  }
  if (!isSupabaseConfigured) return { result: 'offline', products: [], manualFallback: true };
  const { data, error } = await supabase.functions.invoke('catalog-search', {
    body: { query, limit: 12 },
  });
  track('catalog_search', { result: error ? 'error' : (data?.result ?? 'unknown') });
  if (error) return { result: 'error', products: [], manualFallback: true };
  return data as CatalogLookupResponse & { products?: CatalogProductSummary[] };
}

export type CatalogCorrectionType =
  | 'wrong_match'
  | 'missing_product'
  | 'ingredient_issue'
  | 'duplicate'
  | 'source_issue'
  | 'expiry_issue'
  | 'category_issue';

type CatalogReportScalar = string | number | boolean | null;
type CatalogReportPayloadKey =
  | 'productName'
  | 'brand'
  | 'barcode'
  | 'category'
  | 'ingredientsText'
  | 'sourceUrl'
  | 'sourceName'
  | 'defaultPaoMonths'
  | 'qualityIssue'
  | 'suggestedCorrection';
type CatalogReportContextKey =
  | 'addedVia'
  | 'quality'
  | 'source'
  | 'platform'
  | 'appVersion'
  | 'buildNumber'
  | 'route';

export async function reportCatalogIssue(input: {
  correctionType: CatalogCorrectionType;
  productId?: string | null;
  barcode?: string | null;
  description?: string | null;
  proposedPayload?: Partial<Record<CatalogReportPayloadKey, CatalogReportScalar>>;
  clientContext?: Partial<Record<CatalogReportContextKey, CatalogReportScalar>>;
}): Promise<{ ok: boolean; offline?: boolean }> {
  track('catalog_correction_reported', { correction_type: input.correctionType });
  if (!isSupabaseConfigured) return { ok: false, offline: true };

  const { error } = await supabase.functions.invoke('catalog-report', {
    body: input,
  });
  return { ok: !error };
}
