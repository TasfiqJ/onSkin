function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const migrationUrl = new URL(
  '../../migrations/20260713000042_catalog_search_indexed_rpc.sql',
  import.meta.url,
);

Deno.test('catalog search migration aligns substring predicates with trigram indexes', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));

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
    const sql = compact(await Deno.readTextFile(migrationUrl));

    assert(
      sql.includes('create or replace function public.search_catalog_products('),
      'reviewed catalog search RPC is missing',
    );
    assert(sql.includes('stable security invoker'), 'catalog search must remain invoker-scoped');
    assert(
      sql.includes("where p.status <> 'blocked'"),
      'search must continue to exclude blocked products',
    );
    assert(
      !sql.includes("p.review_status = 'reviewed'") &&
        !sql.includes('p.recommendation_eligible') &&
        !sql.includes("p.quality_grade in ('verified', 'usable')"),
      'the optimization must not silently narrow Shelf intake visibility',
    );
    assert(
      sql.includes("freshness.review_status = 'reviewed'"),
      'unreviewed freshness evidence must remain hidden',
    );
    for (const field of [
      'p.id',
      'p.barcode',
      'p.name',
      'p.brand',
      'p.category',
      'p.region',
      'p.default_pao_months',
      'p.source',
      'p.source_id as catalog_source_id',
      'p.source_ref',
      'p.source_url',
      'p.source_snapshot_date',
      'p.quality_grade',
      'p.review_status',
      'p.data_quality_score',
      'p.ingredient_parse_status',
      'p.ingredient_parse_confidence',
    ]) {
      assert(sql.includes(field), `catalog search response is missing ${field}`);
    }
    for (const evidenceField of [
      "'pao_months'",
      "'pao_source'",
      "'expiry_date'",
      "'expiry_source'",
      "'region'",
      "'source_id'",
      "'review_status'",
      "'created_at'",
    ]) {
      assert(sql.includes(evidenceField), `freshness response is missing ${evidenceField}`);
    }
    assert(
      sql.includes('coalesce( ( select jsonb_agg(') && sql.includes("'[]'::jsonb"),
      'products without reviewed freshness must remain visible with an empty evidence array',
    );
    assert(
      sql.includes('order by p.data_quality_score desc, lower(p.name), p.id'),
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
});
