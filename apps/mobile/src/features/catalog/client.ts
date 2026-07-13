import type { PaoSource } from '@onskin/types';

import type { ProductCategory } from '@/features/shelf/categories';
import { track } from '@/lib/analytics/track';
import { isSupabaseConfigured } from '@/lib/env';
import { invokeEdgeFunction } from '@/lib/network/edgeFunctions';
import { isRequestCancellation, RequestPolicyError } from '@/lib/network/requestPolicy';

import type { CatalogQualityGrade } from './quality';

export type CatalogPaoExpiryRecord = {
  pao_months?: number | null;
  pao_source?: 'label' | 'brand_label' | 'catalog' | 'category_default' | 'unknown' | null;
  expiry_date?: string | null;
  expiry_source?: 'printed' | 'label' | 'manufacturer' | 'pao_computed' | 'unknown' | null;
  region?: string | null;
  source_id?: string | null;
  review_status?: string | null;
  created_at?: string | null;
};

export type CatalogSourceSummary = {
  id?: string | null;
  display_name?: string | null;
  source_key?: string | null;
  attribution_text?: string | null;
  attribution_url?: string | null;
};

export type CatalogProductSummary = {
  id: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: ProductCategory | string | null;
  region?: string | null;
  default_pao_months?: number | null;
  source: string | null;
  catalog_source_id?: string | null;
  catalog_sources?: CatalogSourceSummary | null;
  source_ref?: string | null;
  source_url?: string | null;
  source_snapshot_date?: string | null;
  quality_grade?: CatalogQualityGrade | string | null;
  review_status?: string | null;
  data_quality_score?: number | null;
  ingredient_parse_status?: string | null;
  ingredient_parse_confidence?: number | null;
  product_pao_expiry?: CatalogPaoExpiryRecord[] | CatalogPaoExpiryRecord | null;
  rawIngredientsText?: string | null;
  external?: boolean;
};

export type CatalogIntakeProvenance = {
  catalogSourceId: string | null;
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function validLocalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
}

function normalizedRegion(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}

function normalizedPaoSource(value: unknown): PaoSource {
  switch (value) {
    case 'label':
    case 'brand_label':
      return 'label';
    case 'catalog':
      return 'catalog';
    case 'category_default':
      return 'category_default';
    default:
      return 'unknown';
  }
}

function freshnessRows(product: CatalogProductSummary): CatalogPaoExpiryRecord[] {
  const rawRows = Array.isArray(product.product_pao_expiry)
    ? product.product_pao_expiry
    : product.product_pao_expiry
      ? [product.product_pao_expiry]
      : [];
  const reviewed = rawRows.filter((row) => row.review_status === 'reviewed');
  const productRegion = normalizedRegion(product.region);
  return productRegion
    ? reviewed.filter((row) => normalizedRegion(row.region) === productRegion)
    : reviewed;
}

function trustedPao(rows: CatalogPaoExpiryRecord[]): {
  months: number | null;
  source: PaoSource;
} {
  const candidates = rows.flatMap((row) => {
    const source = normalizedPaoSource(row.pao_source);
    return typeof row.pao_months === 'number' &&
      Number.isInteger(row.pao_months) &&
      row.pao_months > 0 &&
      source !== 'unknown'
      ? [{ months: row.pao_months, source }]
      : [];
  });
  const months = [...new Set(candidates.map((candidate) => candidate.months))];
  if (months.length !== 1) return { months: null, source: 'unknown' };

  const sources = new Set(candidates.map((candidate) => candidate.source));
  const source: PaoSource = sources.has('label')
    ? 'label'
    : sources.has('catalog')
      ? 'catalog'
      : 'category_default';
  return { months: months[0] ?? null, source };
}

function trustedPrintedExpiry(rows: CatalogPaoExpiryRecord[]): string | null {
  const dates = [
    ...new Set(
      rows.flatMap((row) => {
        // Shelf currently models this field specifically as a printed package
        // date. Preserve richer label/manufacturer evidence in the catalog
        // response instead of flattening it into a provenance claim it cannot
        // represent.
        if (row.expiry_source !== 'printed') return [];
        const date = validLocalDate(row.expiry_date);
        return date ? [date] : [];
      }),
    ),
  ];
  return dates.length === 1 ? (dates[0] ?? null) : null;
}

/**
 * Converts reviewed catalog evidence into the coarser Shelf intake contract.
 * Ambiguous, unreviewed, region-mismatched, or source-less values stay unknown.
 */
export function catalogIntakeProvenance(product: CatalogProductSummary): CatalogIntakeProvenance {
  const rows = freshnessRows(product);
  const pao = trustedPao(rows);
  return {
    catalogSourceId: uuidOrNull(product.catalog_source_id),
    paoMonths: pao.months,
    paoSource: pao.source,
    expiryDate: trustedPrintedExpiry(rows),
  };
}

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
      region: 'US',
      default_pao_months: 6,
      source: 'open_beauty_facts',
      catalog_source_id: '00000000-0000-4000-8000-000000000042',
      source_ref: '012345678905',
      source_url: 'https://world.openbeautyfacts.org/product/012345678905',
      source_snapshot_date: '2026-07-09',
      quality_grade: 'limited',
      review_status: 'fixture',
      data_quality_score: 0.42,
      ingredient_parse_status: 'partial',
      ingredient_parse_confidence: 0.52,
      product_pao_expiry: [
        {
          pao_months: 6,
          pao_source: 'catalog',
          expiry_date: null,
          expiry_source: 'unknown',
          region: 'US',
          source_id: '00000000-0000-4000-8000-000000000042',
          review_status: 'reviewed',
          created_at: '2026-07-09T00:00:00.000Z',
        },
      ],
      rawIngredientsText: 'Aqua, Glycerin, Niacinamide',
    };
    return { result: 'matched', product, products: [product] };
  }
  return null;
}

async function waitForDevCatalogSearchDelay(signal: AbortSignal | undefined): Promise<void> {
  if (!isDevRuntime()) return;
  const delayMs = Number(process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_DELAY_MS);
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;

  await new Promise<void>((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    timeout = setTimeout(finish, Math.min(delayMs, 10_000));
    if (signal?.aborted) finish();
    else signal?.addEventListener('abort', finish, { once: true });
  });
}

type CatalogRequestOptions = Readonly<{ signal?: AbortSignal }>;

function unavailableResult(error: unknown): 'error' | 'offline' {
  return error instanceof RequestPolicyError && error.kind === 'offline' ? 'offline' : 'error';
}

export async function lookupBarcode(
  barcode: string,
  options: CatalogRequestOptions = {},
): Promise<CatalogLookupResponse> {
  if (!isSupabaseConfigured) return { result: 'offline', manualFallback: true };
  try {
    const data = await invokeEdgeFunction<CatalogLookupResponse>('catalog-lookup', {
      body: { barcode },
      signal: options.signal,
    });
    track('catalog_barcode_lookup', { result: data?.result ?? 'unknown' });
    return data ?? { result: 'error', manualFallback: true };
  } catch (error) {
    if (isRequestCancellation(error)) throw error;
    const result = unavailableResult(error);
    track('catalog_barcode_lookup', { result });
    return { result, manualFallback: true };
  }
}

export async function searchCatalog(
  query: string,
  options: CatalogRequestOptions = {},
): Promise<CatalogLookupResponse & { products?: CatalogProductSummary[] }> {
  await waitForDevCatalogSearchDelay(options.signal);
  if (options.signal?.aborted) {
    return { result: 'error', products: [], manualFallback: true };
  }
  const fixture = devCatalogSearchFixture();
  if (fixture) {
    track('catalog_search', { result: fixture.result });
    return fixture;
  }
  if (!isSupabaseConfigured) return { result: 'offline', products: [], manualFallback: true };
  try {
    const data = await invokeEdgeFunction<
      CatalogLookupResponse & { products?: CatalogProductSummary[] }
    >('catalog-search', {
      body: { query, limit: 12 },
      signal: options.signal,
    });
    track('catalog_search', { result: data?.result ?? 'unknown' });
    return data ?? { result: 'error', products: [], manualFallback: true };
  } catch (error) {
    if (isRequestCancellation(error)) throw error;
    const result = unavailableResult(error);
    track('catalog_search', { result });
    return { result, products: [], manualFallback: true };
  }
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
}, options: CatalogRequestOptions = {}): Promise<{ ok: boolean; offline?: boolean }> {
  track('catalog_correction_reported', { correction_type: input.correctionType });
  if (!isSupabaseConfigured) return { ok: false, offline: true };

  try {
    await invokeEdgeFunction('catalog-report', { body: input, signal: options.signal });
    return { ok: true };
  } catch (error) {
    if (isRequestCancellation(error)) throw error;
    return {
      ok: false,
      ...(error instanceof RequestPolicyError && error.kind === 'offline'
        ? { offline: true }
        : {}),
    };
  }
}
