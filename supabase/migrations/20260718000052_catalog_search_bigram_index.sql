-- =============================================================================
-- 0052 · Preserve indexed substring search for the supported two-character floor
-- =============================================================================
-- pg_trgm cannot extract a trigram from a two-character LIKE pattern, so the
-- supported query floor otherwise becomes a products sequential scan. A GIN
-- expression over deterministic name/brand bigrams supplies a lossless
-- candidate set; a ranking index bounds common-token top-N scans. The existing
-- LIKE predicate remains the exact-result filter. The indexes are deliberately
-- concurrent: apply this migration through the repository's non-transactional
-- Supabase CLI db-push path, and drop/retry any INVALID concurrent index before
-- repairing migration history.

create or replace function public.catalog_search_bigram_tokens(
  p_value text
)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct token.value order by token.value),
    array[]::text[]
  )
  from (
    select substr(
      lower(coalesce(p_value, '')),
      position.value,
      2
    ) as value
    from generate_series(
      1,
      greatest(
        char_length(lower(coalesce(p_value, ''))) - 1,
        0
      )
    ) as position(value)
  ) as token;
$$;

revoke all on function public.catalog_search_bigram_tokens(text)
  from public, anon, authenticated;
grant execute on function public.catalog_search_bigram_tokens(text)
  to service_role;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_index as index_state
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_state.indexrelid
    join pg_catalog.pg_namespace as index_namespace
      on index_namespace.oid = index_relation.relnamespace
    where index_namespace.nspname = 'public'
      and index_relation.relname in (
        'products_catalog_bigram_idx',
        'products_catalog_rank_idx'
      )
      and (not index_state.indisvalid or not index_state.indisready)
  ) then
    raise exception using
      errcode = '55000',
      message = 'CATALOG_SEARCH_INVALID_CONCURRENT_INDEX',
      hint = 'Drop only the named INVALID catalog index concurrently, then rerun the unapplied migration.';
  end if;
end;
$$;

create index concurrently if not exists products_catalog_bigram_idx
  on public.products using gin ((
    public.catalog_search_bigram_tokens(name) ||
    public.catalog_search_bigram_tokens(coalesce(brand, ''))
  ))
  where status <> 'blocked';

create index concurrently if not exists products_catalog_rank_idx
  on public.products (
    data_quality_score desc,
    lower(name),
    id
  )
  where status <> 'blocked';

do $$
declare
  v_bigram_definition text;
  v_bigram_keys integer;
  v_bigram_unique boolean;
  v_rank_definition text;
  v_rank_keys integer;
  v_rank_unique boolean;
begin
  select
    lower(regexp_replace(pg_catalog.pg_get_indexdef(index_state.indexrelid), '[[:space:]]+', ' ', 'g')),
    index_state.indnkeyatts,
    index_state.indisunique
  into v_bigram_definition, v_bigram_keys, v_bigram_unique
  from pg_catalog.pg_index as index_state
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = index_state.indexrelid
  join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_relation.relnamespace
  where index_namespace.nspname = 'public'
    and index_relation.relname = 'products_catalog_bigram_idx'
    and index_state.indisvalid
    and index_state.indisready;

  if v_bigram_definition is null
    or v_bigram_keys <> 1
    or v_bigram_unique
    or position('on public.products using gin' in v_bigram_definition) = 0
    or position('catalog_search_bigram_tokens(name)' in v_bigram_definition) = 0
    or position('catalog_search_bigram_tokens(coalesce(brand' in v_bigram_definition) = 0
    or position('where (status <> ''blocked''::text)' in v_bigram_definition) = 0
  then
    raise exception using
      errcode = '55000',
      message = 'CATALOG_SEARCH_BIGRAM_INDEX_DEFINITION_MISMATCH',
      hint = 'Inspect and replace only the named catalog index concurrently before rerunning the unapplied migration.';
  end if;

  select
    lower(regexp_replace(pg_catalog.pg_get_indexdef(index_state.indexrelid), '[[:space:]]+', ' ', 'g')),
    index_state.indnkeyatts,
    index_state.indisunique
  into v_rank_definition, v_rank_keys, v_rank_unique
  from pg_catalog.pg_index as index_state
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = index_state.indexrelid
  join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_relation.relnamespace
  where index_namespace.nspname = 'public'
    and index_relation.relname = 'products_catalog_rank_idx'
    and index_state.indisvalid
    and index_state.indisready;

  if v_rank_definition is null
    or v_rank_keys <> 3
    or v_rank_unique
    or position('on public.products using btree' in v_rank_definition) = 0
    or position('(data_quality_score desc, lower(name), id)' in v_rank_definition) = 0
    or position('where (status <> ''blocked''::text)' in v_rank_definition) = 0
  then
    raise exception using
      errcode = '55000',
      message = 'CATALOG_SEARCH_RANK_INDEX_DEFINITION_MISMATCH',
      hint = 'Inspect and replace only the named catalog index concurrently before rerunning the unapplied migration.';
  end if;
end;
$$;

create or replace function public.search_catalog_products(
  p_query text,
  p_limit integer default 10
)
returns table (
  id uuid,
  barcode text,
  name text,
  brand text,
  category text,
  region text,
  default_pao_months integer,
  source text,
  catalog_source_id uuid,
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text,
  review_status text,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric,
  catalog_sources jsonb,
  product_pao_expiry jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_query text;
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
  v_candidate_probe_count integer;
begin
  v_query := left(
    lower(
      regexp_replace(
        trim(
          replace(
            translate(coalesce(p_query, ''), '%_,()', '     '),
            chr(92),
            ' '
          )
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    80
  );

  if char_length(v_query) < 2 then
    return;
  end if;

  v_pattern := '%' || v_query || '%';

  if char_length(v_query) = 2 then
    select count(*)
    into v_candidate_probe_count
    from (
      select 1
      from public.products as candidate
      where candidate.status <> 'blocked'
        and (
          public.catalog_search_bigram_tokens(candidate.name) ||
          public.catalog_search_bigram_tokens(coalesce(candidate.brand, ''))
        ) @> public.catalog_search_bigram_tokens(v_query)
      limit 1001
    ) as bounded_candidates;

    if v_candidate_probe_count <= 1000 then
      return query
  select
    p.id,
    p.barcode,
    p.name,
    p.brand,
    p.category,
    p.region,
    p.default_pao_months,
    p.source,
    p.source_id as catalog_source_id,
    p.source_ref,
    p.source_url,
    p.source_snapshot_date,
    p.quality_grade,
    p.review_status,
    p.data_quality_score,
    p.ingredient_parse_status,
    p.ingredient_parse_confidence,
    case
      when cs.id is null then null
      else jsonb_build_object(
        'id', cs.id,
        'display_name', cs.display_name,
        'source_key', cs.source_key,
        'attribution_text', cs.attribution_text,
        'attribution_url', cs.attribution_url
      )
    end as catalog_sources,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pao_months', freshness.pao_months,
            'pao_source', freshness.pao_source,
            'expiry_date', freshness.expiry_date,
            'expiry_source', freshness.expiry_source,
            'region', freshness.region,
            'source_id', freshness.source_id,
            'review_status', freshness.review_status,
            'created_at', freshness.created_at
          )
          order by freshness.created_at desc, freshness.id
        )
        from public.product_pao_expiry as freshness
        where freshness.product_id = p.id
          and freshness.review_status = 'reviewed'
      ),
      '[]'::jsonb
    ) as product_pao_expiry
  from public.products as p
  left join public.catalog_sources as cs on cs.id = p.source_id
  where p.status <> 'blocked'
    and (
      public.catalog_search_bigram_tokens(p.name) ||
      public.catalog_search_bigram_tokens(coalesce(p.brand, ''))
    ) @> public.catalog_search_bigram_tokens(v_query)
    and (
      lower(p.name) like v_pattern
      or lower(coalesce(p.brand, '')) like v_pattern
    )
  order by p.data_quality_score desc, lower(p.name), p.id
  limit v_limit;
      return;
    end if;
  end if;

  return query
  select
    p.id,
    p.barcode,
    p.name,
    p.brand,
    p.category,
    p.region,
    p.default_pao_months,
    p.source,
    p.source_id as catalog_source_id,
    p.source_ref,
    p.source_url,
    p.source_snapshot_date,
    p.quality_grade,
    p.review_status,
    p.data_quality_score,
    p.ingredient_parse_status,
    p.ingredient_parse_confidence,
    case
      when cs.id is null then null
      else jsonb_build_object(
        'id', cs.id,
        'display_name', cs.display_name,
        'source_key', cs.source_key,
        'attribution_text', cs.attribution_text,
        'attribution_url', cs.attribution_url
      )
    end as catalog_sources,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'pao_months', freshness.pao_months,
            'pao_source', freshness.pao_source,
            'expiry_date', freshness.expiry_date,
            'expiry_source', freshness.expiry_source,
            'region', freshness.region,
            'source_id', freshness.source_id,
            'review_status', freshness.review_status,
            'created_at', freshness.created_at
          )
          order by freshness.created_at desc, freshness.id
        )
        from public.product_pao_expiry as freshness
        where freshness.product_id = p.id
          and freshness.review_status = 'reviewed'
      ),
      '[]'::jsonb
    ) as product_pao_expiry
  from public.products as p
  left join public.catalog_sources as cs on cs.id = p.source_id
  where p.status <> 'blocked'
    and (
      lower(p.name) like v_pattern
      or lower(coalesce(p.brand, '')) like v_pattern
    )
  order by p.data_quality_score desc, lower(p.name), p.id
  limit v_limit;
end;
$$;

comment on function public.search_catalog_products(text, integer) is
  'Service-only indexed substring search for authenticated catalog-search Edge requests, including the two-character query floor.';

revoke all on function public.search_catalog_products(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_catalog_products(text, integer)
  to service_role;
