import type { PaoSource } from '@onskin/types';

import type { ProductCategory } from '@/features/shelf/categories';
import { normalizeCanonicalProductBarcode } from '@/features/native/camera/barcode';
import { track } from '@/lib/analytics/track';
import { BRAND } from '@/lib/brand';
import { runHealthDataWriteOperation } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';

import type { CatalogQualityGrade } from './quality';
import {
  catalogReportHasValidRequestId,
  catalogReportTransportInput,
  type CatalogCorrectionStatus,
  type CatalogReportInput,
} from './reportTransport';

export {
  catalogReportTransportInput,
  type CatalogCorrectionType,
  type CatalogReportInput,
} from './reportTransport';

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export type CatalogSearchResponse =
  | {
      result: 'matched';
      products: CatalogProductSummary[];
      manualFallback: false;
    }
  | {
      result: 'no_match';
      products: [];
      manualFallback: true;
    }
  | {
      result: 'too_short';
      products: [];
    }
  | {
      result: 'offline' | 'error';
      products: [];
      manualFallback: true;
    };

const CATALOG_PRODUCT_NETWORK_KEYS = new Set([
  'id',
  'barcode',
  'name',
  'brand',
  'category',
  'region',
  'default_pao_months',
  'source',
  'catalog_source_id',
  'source_ref',
  'source_url',
  'source_snapshot_date',
  'quality_grade',
  'review_status',
  'data_quality_score',
  'ingredient_parse_status',
  'ingredient_parse_confidence',
  'catalog_sources',
  'product_pao_expiry',
]);
const CATALOG_SOURCE_NETWORK_KEYS = new Set([
  'id',
  'display_name',
  'source_key',
  'attribution_text',
  'attribution_url',
]);
const CATALOG_FRESHNESS_NETWORK_KEYS = new Set([
  'pao_months',
  'pao_source',
  'expiry_date',
  'expiry_source',
  'region',
  'source_id',
  'review_status',
  'created_at',
]);
const LOOKUP_MATCH_KEYS = new Set(['result', 'product']);
const LOOKUP_NO_MATCH_KEYS = new Set(['result', 'manualFallback']);
const SEARCH_RESULT_KEYS = new Set(['result', 'products', 'manualFallback']);
const SEARCH_TOO_SHORT_KEYS = new Set(['result', 'products']);
const SERVABLE_QUALITY_GRADES = new Set<CatalogQualityGrade>(['verified', 'usable']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isNullableString(value: unknown, maxLength = 500): boolean {
  return (
    value === null ||
    (typeof value === 'string' && value.length <= maxLength && value.trim().length > 0)
  );
}

function isNullableFiniteNumber(value: unknown, min: number, max: number): boolean {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max)
  );
}

function isCatalogSourceNetworkValue(
  value: unknown,
  expectedId: string,
  expectedSourceKey: string,
): value is CatalogSourceSummary {
  if (!isRecord(value) || !hasExactKeys(value, CATALOG_SOURCE_NETWORK_KEYS)) return false;
  return (
    value.id === expectedId &&
    value.source_key === expectedSourceKey &&
    isNullableString(value.display_name, 200) &&
    isNullableString(value.attribution_text, 500) &&
    isNullableString(value.attribution_url, 500)
  );
}

function isCatalogFreshnessNetworkValue(value: unknown): value is CatalogPaoExpiryRecord {
  if (!isRecord(value) || !hasExactKeys(value, CATALOG_FRESHNESS_NETWORK_KEYS)) return false;
  return (
    (value.pao_months === null ||
      (typeof value.pao_months === 'number' &&
        Number.isInteger(value.pao_months) &&
        value.pao_months > 0)) &&
    (value.pao_source === null ||
      value.pao_source === 'label' ||
      value.pao_source === 'brand_label' ||
      value.pao_source === 'catalog' ||
      value.pao_source === 'category_default' ||
      value.pao_source === 'unknown') &&
    (value.expiry_date === null || validLocalDate(value.expiry_date) !== null) &&
    (value.expiry_source === null ||
      value.expiry_source === 'printed' ||
      value.expiry_source === 'label' ||
      value.expiry_source === 'manufacturer' ||
      value.expiry_source === 'pao_computed' ||
      value.expiry_source === 'unknown') &&
    isNullableString(value.region, 20) &&
    uuidOrNull(value.source_id) === value.source_id &&
    value.review_status === 'reviewed' &&
    isNullableString(value.created_at, 50)
  );
}

function decodeCatalogProduct(value: unknown): CatalogProductSummary | null {
  if (!isRecord(value) || !hasExactKeys(value, CATALOG_PRODUCT_NETWORK_KEYS)) return null;

  const id = uuidOrNull(value.id);
  const catalogSourceId = uuidOrNull(value.catalog_source_id);
  if (
    !id ||
    id !== value.id ||
    !catalogSourceId ||
    catalogSourceId !== value.catalog_source_id ||
    typeof value.barcode !== 'string' ||
    normalizeCanonicalProductBarcode(value.barcode) !== value.barcode ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 200 ||
    typeof value.source !== 'string' ||
    !value.source.trim() ||
    value.source.length > 100 ||
    !SERVABLE_QUALITY_GRADES.has(value.quality_grade as CatalogQualityGrade) ||
    value.review_status !== 'reviewed' ||
    !isNullableString(value.brand, 200) ||
    !isNullableString(value.category, 100) ||
    !isNullableString(value.region, 20) ||
    (value.default_pao_months !== null &&
      (typeof value.default_pao_months !== 'number' ||
        !Number.isInteger(value.default_pao_months) ||
        value.default_pao_months <= 0)) ||
    !isNullableString(value.source_ref, 500) ||
    !isNullableString(value.source_url, 500) ||
    (value.source_snapshot_date !== null && validLocalDate(value.source_snapshot_date) === null) ||
    !isNullableFiniteNumber(value.data_quality_score, 0, 100) ||
    !isNullableString(value.ingredient_parse_status, 100) ||
    !isNullableFiniteNumber(value.ingredient_parse_confidence, 0, 1) ||
    !isCatalogSourceNetworkValue(value.catalog_sources, catalogSourceId, value.source) ||
    !Array.isArray(value.product_pao_expiry) ||
    !value.product_pao_expiry.every(isCatalogFreshnessNetworkValue)
  ) {
    return null;
  }

  return value as CatalogProductSummary;
}

function decodeCatalogLookupResponse(
  value: unknown,
  expectedBarcode: string,
): CatalogLookupResponse | null {
  if (!isRecord(value) || typeof value.result !== 'string') return null;
  if (value.result === 'matched') {
    if (!hasExactKeys(value, LOOKUP_MATCH_KEYS)) return null;
    const product = decodeCatalogProduct(value.product);
    return product?.barcode === expectedBarcode ? { result: 'matched', product } : null;
  }
  if (value.result === 'no_match' && hasExactKeys(value, LOOKUP_NO_MATCH_KEYS)) {
    return value.manualFallback === true ? { result: 'no_match', manualFallback: true } : null;
  }
  return null;
}

function decodeCatalogSearchResponse(value: unknown): CatalogSearchResponse | null {
  if (!isRecord(value) || typeof value.result !== 'string' || !Array.isArray(value.products)) {
    return null;
  }
  if (value.result === 'too_short') {
    return hasExactKeys(value, SEARCH_TOO_SHORT_KEYS) && value.products.length === 0
      ? { result: 'too_short', products: [] }
      : null;
  }
  if (!hasExactKeys(value, SEARCH_RESULT_KEYS)) return null;
  if (value.result === 'no_match') {
    return value.products.length === 0 && value.manualFallback === true
      ? { result: 'no_match', products: [], manualFallback: true }
      : null;
  }
  if (value.result !== 'matched' || value.manualFallback !== false || value.products.length === 0) {
    return null;
  }
  const products = value.products.map(decodeCatalogProduct);
  return products.every((product): product is CatalogProductSummary => product !== null)
    ? { result: 'matched', products, manualFallback: false }
    : null;
}

function isDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function devCatalogSearchFixture():
  | (CatalogSearchResponse & { product?: CatalogProductSummary })
  | null {
  if (!isDevRuntime()) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT?.trim().toLowerCase();
  if (fixture === 'no_match') return { result: 'no_match', products: [], manualFallback: true };
  if (fixture === 'matched') {
    const product: CatalogProductSummary = {
      id: '00000000-0000-4000-8000-000000000044',
      barcode: '036000291452',
      name: 'Reviewed Barrier Serum',
      brand: 'RoutineKind Fixture',
      category: 'serum',
      region: 'CA',
      default_pao_months: 12,
      source: 'routinekind_fixture',
      catalog_source_id: '00000000-0000-4000-8000-000000000043',
      catalog_sources: {
        id: '00000000-0000-4000-8000-000000000043',
        display_name: `Reviewed ${BRAND.appName} fixture`,
        source_key: 'routinekind_fixture',
        attribution_text: 'Development-only reviewed catalog fixture',
        attribution_url: null,
      },
      source_ref: 'fixture:036000291452',
      source_url: null,
      source_snapshot_date: '2026-07-18',
      quality_grade: 'usable',
      review_status: 'reviewed',
      data_quality_score: 94,
      ingredient_parse_status: 'complete',
      ingredient_parse_confidence: 0.98,
      product_pao_expiry: [
        {
          pao_months: 12,
          pao_source: 'catalog',
          expiry_date: null,
          expiry_source: 'unknown',
          region: 'CA',
          source_id: '00000000-0000-4000-8000-000000000043',
          review_status: 'reviewed',
          created_at: '2026-07-18T00:00:00.000Z',
        },
      ],
      rawIngredientsText: 'Aqua, Glycerin, Ceramide NP',
    };
    return { result: 'matched', product, products: [product], manualFallback: false };
  }
  if (fixture === 'wrong_match') {
    // Development-only UI fixture: provenance is deliberately non-routable and performs no fetch.
    const product: CatalogProductSummary = {
      id: '00000000-0000-4000-8000-000000000045',
      barcode: '012345678905',
      name: 'Wrong Catalog Serum',
      brand: 'Mismatch Lab',
      category: 'serum',
      region: 'US',
      default_pao_months: 6,
      source: 'open_beauty_facts',
      catalog_source_id: '00000000-0000-4000-8000-000000000042',
      source_ref: '012345678905',
      source_url: 'https://offline-fixture.invalid/open-beauty-facts/product/012345678905',
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
    return { result: 'matched', product, products: [product], manualFallback: false };
  }
  return null;
}

export async function lookupBarcode(barcode: string): Promise<CatalogLookupResponse> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return { result: 'offline', manualFallback: true };
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    if (!isSupabaseConfigured) return { result: 'offline', manualFallback: true };
    lease.assertCurrent();
    const { data, error } = await supabase.functions.invoke('catalog-lookup', {
      body: { barcode },
    });
    lease.assertCurrent();
    const response = error ? null : decodeCatalogLookupResponse(data, barcode);
    track('catalog_barcode_lookup', { result: response?.result ?? 'error' });
    lease.assertCurrent();
    return response ?? { result: 'error', manualFallback: true };
  });
}

export async function searchCatalog(query: string): Promise<CatalogSearchResponse> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) {
    return { result: 'offline', products: [], manualFallback: true };
  }
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    const fixture = devCatalogSearchFixture();
    if (fixture) {
      lease.assertCurrent();
      track('catalog_search', { result: fixture.result });
      lease.assertCurrent();
      return fixture;
    }
    if (!isSupabaseConfigured) return { result: 'offline', products: [], manualFallback: true };
    lease.assertCurrent();
    const { data, error } = await supabase.functions.invoke('catalog-search', {
      body: { query, limit: 12 },
    });
    lease.assertCurrent();
    const response = error ? null : decodeCatalogSearchResponse(data);
    track('catalog_search', { result: response?.result ?? 'error' });
    lease.assertCurrent();
    return response ?? { result: 'error', products: [], manualFallback: true };
  });
}

export type CatalogReportOutcome =
  | {
      result: 'success';
      correction: {
        id: string;
        status: CatalogCorrectionStatus;
        createdAt: string;
        created: boolean;
      };
    }
  | { result: 'not_configured' }
  | { result: 'offline_or_withdrawn' }
  | { result: 'rate_limited' }
  | { result: 'retryable' }
  | { result: 'invalid_request' }
  | { result: 'request_conflict' }
  | { result: 'error' };

const CATALOG_REPORT_SUCCESS_KEYS = new Set(['result', 'correction']);
const CATALOG_REPORT_CORRECTION_KEYS = new Set(['id', 'status', 'created_at', 'created']);
const CATALOG_CORRECTION_STATUSES = new Set<CatalogCorrectionStatus>([
  'open',
  'triaged',
  'accepted',
  'rejected',
  'closed',
]);

function decodeCatalogReportSuccess(
  value: unknown,
): Extract<CatalogReportOutcome, { result: 'success' }> | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, CATALOG_REPORT_SUCCESS_KEYS) ||
    (value.result !== 'reported' && value.result !== 'already_received') ||
    !isRecord(value.correction) ||
    !hasExactKeys(value.correction, CATALOG_REPORT_CORRECTION_KEYS)
  ) {
    return null;
  }
  const id = uuidOrNull(value.correction.id);
  const createdAt = value.correction.created_at;
  if (
    !id ||
    !CATALOG_CORRECTION_STATUSES.has(value.correction.status as CatalogCorrectionStatus) ||
    typeof value.correction.created !== 'boolean' ||
    value.correction.created !== (value.result === 'reported') ||
    typeof createdAt !== 'string' ||
    !createdAt.trim() ||
    !Number.isFinite(Date.parse(createdAt))
  ) {
    return null;
  }
  return {
    result: 'success',
    correction: {
      id,
      status: value.correction.status as CatalogCorrectionStatus,
      createdAt,
      created: value.correction.created,
    },
  };
}

function invokeErrorStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  if (typeof error.status === 'number') return error.status;
  const context = error.context;
  return isRecord(context) && typeof context.status === 'number' ? context.status : null;
}

function invokeErrorName(error: unknown): string {
  if (!isRecord(error)) return '';
  return [error.name, error.message, error.code]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function classifyCatalogReportFailure(error: unknown): CatalogReportOutcome {
  const status = invokeErrorStatus(error);
  const signature = invokeErrorName(error);
  if (status === 429 || signature.includes('rate_limit') || signature.includes('rate limit')) {
    return { result: 'rate_limited' };
  }
  if (status === 400) return { result: 'invalid_request' };
  if (status === 422) return { result: 'request_conflict' };
  if (status === 423) return { result: 'retryable' };
  if (
    status === 409 ||
    signature.includes('health_processing') ||
    signature.includes('health data') ||
    signature.includes('withdraw') ||
    signature.includes('functionfetcherror') ||
    signature.includes('network') ||
    signature.includes('failed to fetch') ||
    signature.includes('failed to send')
  ) {
    return { result: 'offline_or_withdrawn' };
  }
  return { result: 'error' };
}

export function isCatalogProductId(value: unknown): value is string {
  return uuidOrNull(value) !== null;
}

export async function reportCatalogIssue(input: CatalogReportInput): Promise<CatalogReportOutcome> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) return { result: 'offline_or_withdrawn' };
  const outcome = await runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
    lease.assertCurrent();
    const transportInput = catalogReportTransportInput(input);
    if (!catalogReportHasValidRequestId(transportInput))
      return { result: 'invalid_request' } as const;
    if (!isSupabaseConfigured) return { result: 'not_configured' } as const;
    lease.assertCurrent();
    let invocation: Awaited<ReturnType<typeof supabase.functions.invoke>>;
    try {
      invocation = await supabase.functions.invoke('catalog-report', { body: transportInput });
    } catch (error) {
      // Never turn a consent/account transition into an ordinary transport
      // result. If the lease closed while invoke was pending, this assertion
      // is the authoritative failure and must escape to the caller.
      lease.assertCurrent();
      return classifyCatalogReportFailure(error);
    }
    lease.assertCurrent();
    if (invocation.error) return classifyCatalogReportFailure(invocation.error);
    return decodeCatalogReportSuccess(invocation.data) ?? ({ result: 'error' } as const);
  });
  if (outcome.result === 'success' && outcome.correction.created) {
    track('catalog_correction_reported', { correction_type: input.correctionType });
  }
  return outcome;
}
