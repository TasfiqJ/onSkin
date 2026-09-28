function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const indexedMigrationUrl = new URL(
  '../../migrations/20260713000042_catalog_search_indexed_rpc.sql',
  import.meta.url,
);
const servingGateMigrationUrl = new URL(
  '../../migrations/20260717000056_catalog_serving_eligibility_gate.sql',
  import.meta.url,
);
const finalBoundaryMigrationUrl = new URL(
  '../../migrations/20260921000073_catalog_search_promotion_boundary.sql',
  import.meta.url,
);

Deno.test('current catalog search preserves the CAT-03 serving gate after index optimization', async () => {
  const sql = compact(await Deno.readTextFile(finalBoundaryMigrationUrl));
  assert(
    sql.includes('create or replace function public.search_catalog_products(') &&
      sql.includes('stable security definer') &&
      sql.includes("set search_path = ''") &&
      sql.includes('from public.catalog_servable_products as product') &&
      !sql.includes('from public.products as product'),
    'the final service search must read the current CAT-03 servable projection',
  );
  assert(
    sql.includes(
      'revoke all on function public.search_catalog_products(text, integer) from public, anon, authenticated, service_role',
    ) &&
      sql.includes('grant execute on function public.search_catalog_products(text, integer) to service_role'),
    'only the service Edge lane may execute the final bounded search',
  );
  assert(
    sql.includes('drop function public.promote_catalog_import(uuid)') &&
      !sql.includes('drop function public.promote_catalog_import(uuid, text, text, text, text)'),
    'the unreviewed one-argument promotion overload must be retired without removing CAT-02',
  );
});

Deno.test('catalog search migration aligns substring predicates with trigram indexes', async () => {
  const sql = compact(await Deno.readTextFile(indexedMigrationUrl));

  assert(
    sql.includes('create extension if not exists pg_trgm with schema extensions'),
    'pg_trgm must be installed explicitly',
  );
  assert(
    sql.includes("using gin (lower(name) extensions.gin_trgm_ops) where status <> 'blocked'"),
    'the name predicate must have a matching partial trigram index',
  );
  assert(
    sql.includes(
      "using gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops) where status <> 'blocked'",
    ),
    'the brand predicate must have a matching partial trigram index',
  );
  assert(
    sql.includes(
      "on public.product_pao_expiry (product_id, created_at desc, id) where review_status = 'reviewed'",
    ),
    'reviewed freshness lookup must be supported by its own partial index',
  );
  assert(
    sql.includes('lower(p.name) like v_pattern') &&
      sql.includes("lower(coalesce(p.brand, '')) like v_pattern"),
    'the RPC must preserve name-or-brand substring matching',
  );
});

Deno.test(
  'catalog search RPC preserves visibility, response evidence, ranking, and limits',
  async () => {
    const sql = compact(await Deno.readTextFile(servingGateMigrationUrl));

    assert(
      sql.includes('create or replace function public.search_catalog_products('),
      'reviewed catalog search RPC is missing',
    );
    assert(
      sql.includes('stable security definer') && sql.includes("set search_path = ''"),
      'catalog search must own its table access through a search-path-sealed service-only RPC',
    );
    assert(
      sql.includes('from public.catalog_servable_products as product'),
      'search must consume the central production-serving gate',
    );
    assert(
      sql.includes('cs.production_approved is true') &&
        sql.includes("cs.review_status = 'legal_approved'") &&
        sql.includes("p.region = 'us'") &&
        sql.includes("p.status = 'active'") &&
        sql.includes("p.review_status = 'reviewed'") &&
        sql.includes('p.last_reviewed_at is not null') &&
        sql.includes('p.last_reviewed_at <= pg_catalog.now()') &&
        sql.includes("p.quality_grade in ('verified', 'usable')") &&
        sql.includes('p.recommendation_eligible is true') &&
        sql.includes('p.unresolved_correction_count = 0') &&
        sql.includes("nullif(pg_catalog.btrim(p.source_ref), '') is not null") &&
        sql.includes('p.source_snapshot_date is not null') &&
        sql.includes('p.source_snapshot_date <= current_date') &&
        sql.includes("correction.status in ('triaged', 'accepted')") &&
        sql.includes('correction.operator_reviewed_at is not null') &&
        sql.includes("nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null") &&
        sql.includes("nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null"),
      'search must fail closed on release territory, provenance, source, review, quality, and correction eligibility',
    );
    for (const field of [
      'product.id',
      'product.barcode',
      'product.name',
      'product.brand',
      'product.category',
      'product.region',
      'product.default_pao_months',
      'product.source',
      'product.catalog_source_id',
      'product.source_ref',
      'product.source_url',
      'product.source_snapshot_date',
      'product.quality_grade',
      'product.review_status',
      'product.data_quality_score',
      'product.ingredient_parse_status',
      'product.ingredient_parse_confidence',
    ]) {
      assert(sql.includes(field), `catalog search response is missing ${field}`);
    }
    assert(
      sql.includes("freshness.review_status = 'reviewed'") &&
        sql.includes('freshness_source.id = freshness.source_id') &&
        sql.includes('freshness_source.production_approved is true') &&
        sql.includes("freshness_source.review_status = 'legal_approved'") &&
        sql.includes('freshness.region = p.region') &&
        sql.includes("'[]'::jsonb"),
      'held-source, cross-territory, and unreviewed freshness must stay hidden while absent evidence remains an empty array',
    );
    assert(
      sql.includes('cs.reviewed_at <= pg_catalog.now()') &&
        sql.includes('cs.requires_attribution is false') &&
        sql.includes("nullif(pg_catalog.btrim(cs.attribution_text), '') is not null") &&
        sql.includes("nullif(pg_catalog.btrim(cs.attribution_url), '') is not null"),
      'future review evidence and incomplete required attribution must suppress search',
    );
    assert(
      sql.includes('order by product.data_quality_score desc, lower(product.name), product.id'),
      'data quality must remain primary with deterministic tie-breakers',
    );
    assert(
      sql.includes('least(greatest(coalesce(p_limit, 10), 1), 20)') &&
        sql.includes('limit v_limit'),
      'the RPC must independently enforce the 1-20 result bound',
    );
    assert(
      sql.includes('if char_length(v_query) < 2 then return;'),
      'the RPC must independently reject empty and short terms',
    );
    assert(
      sql.includes("translate(coalesce(p_query, ''), '%_,()', ' ')") &&
        sql.includes('chr(92)') &&
        sql.includes('), 80 );'),
      'the RPC must independently neutralize metacharacters and cap query length',
    );
    assert(
      sql.includes(
        'revoke all on function public.search_catalog_products(text, integer) from public, anon, authenticated',
      ) &&
        sql.includes(
          'grant execute on function public.search_catalog_products(text, integer) to service_role',
        ),
      'the RPC must be callable only through the service-role Edge path',
    );
  },
);

Deno.test('catalog search Edge handler uses only the reviewed parameterized RPC', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  const compactSource = compact(source);

  assert(
    /admin\.rpc\(catalog_search_rpc,\s*\{/.test(compactSource),
    'Edge search must invoke the reviewed RPC',
  );
  assert(
    compactSource.includes('p_query: searchterm') && compactSource.includes('p_limit: limit'),
    'the RPC must receive normalized bounded parameters',
  );
  assert(
    !compactSource.includes(".from('products')"),
    'Edge search must not scan products directly',
  );
  assert(!compactSource.includes('.or('), 'Edge search must not interpolate PostgREST OR grammar');
  assert(!compactSource.includes('ilike'), 'Edge search must not retain the unindexed predicate');
  assert(
    compactSource.includes('manualfallback: !data?.length'),
    'an ineligible or unknown search result must preserve manual entry',
  );
});
