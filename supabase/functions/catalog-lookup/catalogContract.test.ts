import {
  CATALOG_LOOKUP_PRODUCT_SELECT,
  REVIEWED_CATALOG_FRESHNESS_FILTER,
} from './catalogContract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('catalog lookup exposes source UUID and reviewed freshness evidence separately', () => {
  assert(
    CATALOG_LOOKUP_PRODUCT_SELECT.includes('catalog_source_id:source_id'),
    'the product source UUID must have a dedicated response field',
  );
  assert(
    CATALOG_LOOKUP_PRODUCT_SELECT.includes('source_ref'),
    'the upstream source reference must remain separate',
  );
  assert(
    CATALOG_LOOKUP_PRODUCT_SELECT.includes(
      'product_pao_expiry(pao_months, pao_source, expiry_date, expiry_source',
    ),
    'the response must include explicit PAO and expiry provenance',
  );
  assert(
    REVIEWED_CATALOG_FRESHNESS_FILTER.column === 'product_pao_expiry.review_status' &&
      REVIEWED_CATALOG_FRESHNESS_FILTER.value === 'reviewed',
    'only reviewed freshness evidence may leave the Edge Function',
  );
});

Deno.test('catalog lookup has no request-time external provider path', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  for (const forbidden of [
    'fetchOpenBeautyFacts',
    'fetchWithTimeout',
    'world.openbeautyfacts.org',
    'OBF_API_ENABLED',
    'OBF_USER_AGENT',
    'external_candidate',
  ]) {
    assert(!source.includes(forbidden), `catalog lookup must not contain ${forbidden}`);
  }
  assert(
    source.includes("return json({ result: 'no_match', manualFallback: true });"),
    'a local catalog miss must retain the manual fallback',
  );
});
