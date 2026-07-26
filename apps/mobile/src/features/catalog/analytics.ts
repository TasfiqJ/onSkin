import {
  ANALYTICS_LATENCY_BUCKETS,
  ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS,
} from '@/lib/analytics/eventRegistry';

export const CATALOG_LOOKUP_LATENCY_BUCKETS = ANALYTICS_LATENCY_BUCKETS;

export type CatalogLookupLatencyBucket = (typeof CATALOG_LOOKUP_LATENCY_BUCKETS)[number];

export const CATALOG_UNKNOWN_INGREDIENT_COUNT_BUCKETS =
  ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS;

export type CatalogUnknownIngredientCountBucket =
  (typeof CATALOG_UNKNOWN_INGREDIENT_COUNT_BUCKETS)[number];

/**
 * Coarsen a local monotonic duration before it reaches analytics. Exact timing
 * and wall-clock timestamps are never returned. Invalid readings fail closed.
 */
export function catalogLookupLatencyBucket(elapsedMs: number): CatalogLookupLatencyBucket {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 'unknown';
  if (elapsedMs < 1_000) return 'lt_1s';
  if (elapsedMs < 3_000) return '1s_to_lt_3s';
  if (elapsedMs < 6_000) return '3s_to_lt_6s';
  if (elapsedMs < 12_000) return '6s_to_lt_12s';
  return 'gte_12s';
}

/**
 * Bucket only the number of parser-preserved unknowns. The helper accepts no
 * token content, and invalid/non-integral counts fail into an explicit bucket.
 */
export function catalogUnknownIngredientCountBucket(
  count: number,
): CatalogUnknownIngredientCountBucket {
  if (!Number.isSafeInteger(count) || count < 0) return 'unknown';
  if (count === 0) return 'none';
  if (count <= 2) return 'one_to_two';
  if (count <= 5) return 'three_to_five';
  return 'six_plus';
}
