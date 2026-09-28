import {
  CATALOG_SEARCH_DEFAULT_LIMIT,
  CATALOG_SEARCH_MAX_LIMIT,
  CATALOG_SEARCH_MAX_QUERY_LENGTH,
  CATALOG_SEARCH_MIN_QUERY_LENGTH,
  CATALOG_SEARCH_RPC,
  catalogSearchLimit,
  catalogSearchTerm,
  normalizeCatalogSearchQuery,
} from './catalogContract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('catalog search normalizes empty and short queries deterministically', () => {
  assert(normalizeCatalogSearchQuery(null) === '', 'null must normalize to an empty query');
  assert(normalizeCatalogSearchQuery('  \n\t ') === '', 'whitespace must normalize to empty');
  assert(catalogSearchTerm(' a ') === 'a', 'one searchable character must remain one character');
  assert(
    catalogSearchTerm('a%').length < CATALOG_SEARCH_MIN_QUERY_LENGTH,
    'metacharacters must not make a one-character query eligible',
  );
});

Deno.test('catalog search neutralizes pattern grammar and keeps ordinary substring text', () => {
  assert(
    catalogSearchTerm('  100%_ Serum,(Night)\\Brand  ') === '100 Serum Night Brand',
    'LIKE and PostgREST metacharacters must collapse to plain spaces',
  );
  assert(
    catalogSearchTerm(`  O'Reilly   "Glow"  `) === `O'Reilly "Glow"`,
    'quotes must remain inert parameter text while whitespace collapses',
  );
});

Deno.test('catalog search caps normalized query text at the reviewed length', () => {
  const normalized = normalizeCatalogSearchQuery(`  ${'x'.repeat(120)}  `);
  assert(
    normalized.length === CATALOG_SEARCH_MAX_QUERY_LENGTH,
    'normalized query must respect the maximum length',
  );
  assert(normalized === 'x'.repeat(80), 'the cap must retain the leading searchable text');
});

Deno.test('catalog search limits are integral and bounded for every JSON input shape', () => {
  assert(CATALOG_SEARCH_RPC === 'search_catalog_products', 'the reviewed RPC name changed');
  assert(catalogSearchLimit(undefined) === CATALOG_SEARCH_DEFAULT_LIMIT, 'missing limit default');
  assert(catalogSearchLimit(null) === CATALOG_SEARCH_DEFAULT_LIMIT, 'null limit default');
  assert(catalogSearchLimit('') === CATALOG_SEARCH_DEFAULT_LIMIT, 'blank limit default');
  assert(catalogSearchLimit('invalid') === CATALOG_SEARCH_DEFAULT_LIMIT, 'invalid limit default');
  assert(catalogSearchLimit(Number.NaN) === CATALOG_SEARCH_DEFAULT_LIMIT, 'NaN limit default');
  assert(catalogSearchLimit(Infinity) === CATALOG_SEARCH_DEFAULT_LIMIT, 'infinite limit default');
  assert(
    catalogSearchLimit({ limit: 12 }) === CATALOG_SEARCH_DEFAULT_LIMIT,
    'object limit default',
  );
  assert(catalogSearchLimit(-5) === 1, 'negative limit must clamp to one');
  assert(catalogSearchLimit(0) === 1, 'zero limit must clamp to one');
  assert(catalogSearchLimit(12.9) === 12, 'decimal limit must truncate deterministically');
  assert(catalogSearchLimit('20') === CATALOG_SEARCH_MAX_LIMIT, 'numeric string limit');
  assert(catalogSearchLimit(200) === CATALOG_SEARCH_MAX_LIMIT, 'large limit must clamp');
});
