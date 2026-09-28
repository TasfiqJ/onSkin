-- Restore the reviewed CAT-03 serving boundary after the later search-index
-- optimization replaced it with a service-role raw-products scan. The active
-- search indexes remain available for a future plan-verified optimization, but
-- no index or two-character fast path may weaken publication eligibility.
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
security definer
set search_path = ''
as $$
declare
  v_query text;
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
begin
  v_query := pg_catalog.left(
    pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(
          pg_catalog.replace(
            pg_catalog.translate(coalesce(p_query, ''), '%_,()', '     '),
            pg_catalog.chr(92),
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
  if pg_catalog.char_length(v_query) < 2 then
    return;
  end if;
  v_pattern := '%' || v_query || '%';
  return query
  select
    product.id,
    product.barcode,
    product.name,
    product.brand,
    product.category,
    product.region,
    product.default_pao_months,
    product.source,
    product.catalog_source_id,
    product.source_ref,
    product.source_url,
    product.source_snapshot_date,
    product.quality_grade,
    product.review_status,
    product.data_quality_score,
    product.ingredient_parse_status,
    product.ingredient_parse_confidence,
    product.catalog_sources,
    product.product_pao_expiry
  from public.catalog_servable_products as product
  where pg_catalog.lower(product.name) like v_pattern
     or pg_catalog.lower(coalesce(product.brand, '')) like v_pattern
  order by product.data_quality_score desc,
    pg_catalog.lower(product.name), product.id
  limit v_limit;
end;
$$;

comment on function public.search_catalog_products(text, integer) is
  'Service-only catalog search requiring the exact current CAT-03 serving head.';
revoke all on function public.search_catalog_products(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.search_catalog_products(text, integer)
  to service_role;

-- The optimization branch also introduced an unrelated, service-role
-- executable one-argument promotion overload. It can publish active rows
-- without the five-argument CAT-02 owner-only review/receipt boundary.
-- Repository evidence does not establish any hosted production promotion.
-- Retain its staging tables for evidence and possible non-serving import work,
-- but remove the unsafe publication capability. Deliberately omit CASCADE so
-- an unexpected dependent object stops migration for review. The governed
-- five-argument overload and its privileges are intentionally untouched.
revoke all on function public.promote_catalog_import(uuid)
  from public, anon, authenticated, service_role;
drop function public.promote_catalog_import(uuid);
