-- =============================================================================
-- 0042 · Indexed catalog name/brand search
-- =============================================================================
-- Keep Shelf intake search semantics as a case-insensitive substring match on
-- either product name or brand. The original full-text GIN index does not serve
-- that predicate, so add matching trigram expression indexes and keep the exact
-- barcode path separate. This migration intentionally does not tighten catalog
-- quality/review visibility; search continues to exclude only blocked products.

create extension if not exists pg_trgm with schema extensions;

create index if not exists products_catalog_name_trgm_idx
  on public.products using gin (lower(name) extensions.gin_trgm_ops)
  where status <> 'blocked';

create index if not exists products_catalog_brand_trgm_idx
  on public.products using gin (lower(coalesce(brand, '')) extensions.gin_trgm_ops)
  where status <> 'blocked';

create index if not exists product_pao_expiry_reviewed_product_idx
  on public.product_pao_expiry (product_id, created_at desc, id)
  where review_status = 'reviewed';

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
begin
  -- Repeat Edge normalization so direct service-role calls cannot turn LIKE
  -- metacharacters into an unbounded wildcard predicate.
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
  'Service-only indexed substring search for authenticated catalog-search Edge requests.';

revoke all on function public.search_catalog_products(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_catalog_products(text, integer)
  to service_role;
