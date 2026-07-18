function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const migrationUrl = new URL(
  '../../migrations/20260718000052_catalog_search_bigram_index.sql',
  import.meta.url,
);

Deno.test(
  'two-character catalog search keeps exact substring semantics behind a bigram GIN candidate index',
  async () => {
    const sql = compact(await Deno.readTextFile(migrationUrl));

    assert(
      sql.includes('create or replace function public.catalog_search_bigram_tokens(') &&
        sql.includes('immutable') &&
        sql.includes('parallel safe'),
      'bigram tokenization must be immutable and index-safe',
    );
    assert(
      sql.includes('create index concurrently if not exists products_catalog_bigram_idx') &&
        sql.includes('on public.products using gin') &&
        sql.includes("where status <> 'blocked'"),
      'the candidate expression needs a matching partial concurrent GIN index',
    );
    assert(
      sql.includes('create index concurrently if not exists products_catalog_rank_idx') &&
        sql.includes('data_quality_score desc, lower(name), id'),
      'common bigrams need a concurrent ranking index for bounded top-N scans',
    );
    assert(
      sql.includes('not index_state.indisvalid or not index_state.indisready') &&
        sql.includes('catalog_search_invalid_concurrent_index') &&
        sql.includes('catalog_search_bigram_index_definition_mismatch') &&
        sql.includes('catalog_search_rank_index_definition_mismatch'),
      'migration retries must fail closed on an INVALID concurrent index instead of silently skipping it',
    );
    assert(
      sql.includes('if char_length(v_query) = 2 then') &&
        sql.includes('limit 1001') &&
        sql.includes('if v_candidate_probe_count <= 1000 then') &&
        sql.includes(') @> public.catalog_search_bigram_tokens(v_query)') &&
        sql.includes('lower(p.name) like v_pattern') &&
        sql.includes("lower(coalesce(p.brand, '')) like v_pattern"),
      'the bigram set must only prefilter the two-character branch before the unchanged exact substring predicate',
    );
    assert(
      sql.includes('if char_length(v_query) < 2 then return;'),
      'the public two-character query floor must remain unchanged',
    );
    assert(
      sql.includes('order by p.data_quality_score desc, lower(p.name), p.id limit v_limit'),
      'stable ranking and the server result cap must remain unchanged',
    );
    assert(
      sql.includes(
        'revoke all on function public.catalog_search_bigram_tokens(text) from public, anon, authenticated',
      ) && sql.includes('to service_role'),
      'the internal helper and search RPC must remain service-only',
    );
  },
);
