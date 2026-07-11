import {
  CATALOG_LOOKUP_PRODUCT_SELECT,
  REVIEWED_CATALOG_FRESHNESS_FILTER,
  externalCatalogProvenance,
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

Deno.test('external lookup candidates do not fabricate catalog or freshness provenance', () => {
  const provenance = externalCatalogProvenance('012345678905', '2026-07-09');

  assert(provenance.catalog_source_id === null, 'external candidates have no catalog source UUID');
  assert(
    provenance.source_ref === '012345678905',
    'the upstream reference must remain the barcode',
  );
  assert(
    provenance.source_snapshot_date === '2026-07-09',
    'the external source snapshot date must be preserved',
  );
  assert(
    provenance.default_pao_months === null && provenance.product_pao_expiry.length === 0,
    'external candidates must not synthesize PAO or expiry evidence',
  );
});
