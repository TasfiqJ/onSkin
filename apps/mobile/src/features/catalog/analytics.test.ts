import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_LATENCY_BUCKETS,
  ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS,
  isAllowedAnalyticsPropKey,
} from '@/lib/analytics/eventRegistry';

import {
  CATALOG_LOOKUP_LATENCY_BUCKETS,
  CATALOG_UNKNOWN_INGREDIENT_COUNT_BUCKETS,
  catalogLookupLatencyBucket,
  catalogUnknownIngredientCountBucket,
} from './analytics';

const MANUAL_ROUTE = fileURLToPath(new URL('../../app/shelf/manual.tsx', import.meta.url));
const OCR_ROUTE = fileURLToPath(new URL('../../app/shelf/ocr.tsx', import.meta.url));

describe('catalog analytics privacy buckets', () => {
  it('keeps the lookup latency vocabulary fixed and immutable', () => {
    expect(CATALOG_LOOKUP_LATENCY_BUCKETS).toEqual([
      'lt_1s',
      '1s_to_lt_3s',
      '3s_to_lt_6s',
      '6s_to_lt_12s',
      'gte_12s',
      'unknown',
    ]);
    expect(Object.isFrozen(CATALOG_LOOKUP_LATENCY_BUCKETS)).toBe(true);
    expect(CATALOG_LOOKUP_LATENCY_BUCKETS).toBe(ANALYTICS_LATENCY_BUCKETS);
  });

  it.each([
    [Number.NaN, 'unknown'],
    [Number.POSITIVE_INFINITY, 'unknown'],
    [Number.NEGATIVE_INFINITY, 'unknown'],
    [-1, 'unknown'],
    [0, 'lt_1s'],
    [999.999, 'lt_1s'],
    [1_000, '1s_to_lt_3s'],
    [2_999.999, '1s_to_lt_3s'],
    [3_000, '3s_to_lt_6s'],
    [5_999.999, '3s_to_lt_6s'],
    [6_000, '6s_to_lt_12s'],
    [11_999.999, '6s_to_lt_12s'],
    [12_000, 'gte_12s'],
  ] as const)('buckets lookup duration %s as %s', (elapsedMs, expected) => {
    expect(catalogLookupLatencyBucket(elapsedMs)).toBe(expected);
  });

  it('keeps the unknown-ingredient count vocabulary fixed and immutable', () => {
    expect(CATALOG_UNKNOWN_INGREDIENT_COUNT_BUCKETS).toEqual([
      'none',
      'one_to_two',
      'three_to_five',
      'six_plus',
      'unknown',
    ]);
    expect(Object.isFrozen(CATALOG_UNKNOWN_INGREDIENT_COUNT_BUCKETS)).toBe(true);
    expect(CATALOG_UNKNOWN_INGREDIENT_COUNT_BUCKETS).toBe(
      ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS,
    );
    expect(isAllowedAnalyticsPropKey('unknown_count_bucket')).toBe(true);
  });

  it.each([
    [Number.NaN, 'unknown'],
    [Number.POSITIVE_INFINITY, 'unknown'],
    [Number.NEGATIVE_INFINITY, 'unknown'],
    [-1, 'unknown'],
    [0.5, 'unknown'],
    [Number.MAX_SAFE_INTEGER + 1, 'unknown'],
    [0, 'none'],
    [1, 'one_to_two'],
    [2, 'one_to_two'],
    [3, 'three_to_five'],
    [5, 'three_to_five'],
    [6, 'six_plus'],
    [Number.MAX_SAFE_INTEGER, 'six_plus'],
  ] as const)('buckets unknown ingredient count %s as %s', (count, expected) => {
    expect(catalogUnknownIngredientCountBucket(count)).toBe(expected);
  });

  it('keeps ingredient parse routes on unknown-token buckets without exact counts', () => {
    const manualSource = readFileSync(MANUAL_ROUTE, 'utf8');
    const ocrSource = readFileSync(OCR_ROUTE, 'utf8');

    expect(manualSource).toContain(
      'unknown_count_bucket: catalogUnknownIngredientCountBucket(parsed.unknownTokens.length)',
    );
    expect(ocrSource).toContain(
      'unknown_count_bucket: catalogUnknownIngredientCountBucket(finalParsed.unknownTokens.length)',
    );
    expect(manualSource).not.toContain('count: parsed.tokens.length');
    expect(ocrSource).not.toContain('count: finalParsed.tokens.length');
  });
});
