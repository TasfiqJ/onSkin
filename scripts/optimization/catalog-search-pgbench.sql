\set query_kind random(1, 8)

select pg_catalog.count(*)
from public.search_catalog_products(
  case :query_kind
    when 1 then 'retinol'
    when 2 then 'dermalab'
    when 3 then 'hydrat'
    when 4 then 'retinl'
    when 5 then 'zzzxqvnomatch'
    when 6 then 'qx'
    when 7 then 're'
    else 'in'
  end,
  20
);
