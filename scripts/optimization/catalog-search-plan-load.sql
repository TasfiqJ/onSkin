\set ON_ERROR_STOP on

-- Deterministic, synthetic-only OPT-116 catalog fixture. The orchestrator
-- enforces catalog_rows >= 250000 before this file is sent to PostgreSQL.
create schema if not exists extensions;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

drop table if exists public.product_pao_expiry cascade;
drop table if exists public.products cascade;
drop table if exists public.catalog_sources cascade;

create table public.catalog_sources (
  id uuid primary key,
  display_name text not null,
  source_key text not null unique,
  attribution_text text,
  attribution_url text
);

create table public.products (
  id uuid primary key,
  barcode text unique,
  name text not null,
  brand text,
  category text,
  region text,
  default_pao_months integer,
  source text not null,
  source_id uuid references public.catalog_sources (id),
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text,
  review_status text,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric,
  status text not null
);

create table public.product_pao_expiry (
  id uuid primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  pao_months integer,
  pao_source text,
  expiry_date date,
  expiry_source text,
  region text,
  source_id uuid references public.catalog_sources (id),
  review_status text not null,
  created_at timestamptz not null
);

insert into public.catalog_sources (
  id,
  display_name,
  source_key,
  attribution_text,
  attribution_url
)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Synthetic benchmark source',
  'synthetic_opt116',
  'Synthetic benchmark data',
  null
);

with generated as (
  select
    value,
    pg_catalog.md5('opt116-product-' || value::text) as digest
  from pg_catalog.generate_series(1, :catalog_rows::integer) as series(value)
)
insert into public.products (
  id,
  barcode,
  name,
  brand,
  category,
  region,
  default_pao_months,
  source,
  source_id,
  source_ref,
  source_url,
  source_snapshot_date,
  quality_grade,
  review_status,
  data_quality_score,
  ingredient_parse_status,
  ingredient_parse_confidence,
  status
)
select
  (
    pg_catalog.substr(digest, 1, 8) || '-' ||
    pg_catalog.substr(digest, 9, 4) || '-' ||
    pg_catalog.substr(digest, 13, 4) || '-' ||
    pg_catalog.substr(digest, 17, 4) || '-' ||
    pg_catalog.substr(digest, 21, 12)
  )::uuid,
  pg_catalog.lpad(value::text, 13, '0'),
  case
    when value % 997 = 0 then 'Qx Benchmark Essence ' || value::text
    when value % 31 = 0 then 'Retinol Renewal Serum ' || value::text
    when value % 37 = 0 then 'Hydrating Barrier Cream ' || value::text
    when value % 41 = 0 then 'Niacinamide Balancing Serum ' || value::text
    when value % 53 = 0 then 'Gentle Daily Cleanser ' || value::text
    else 'Daily Skin Product ' || value::text
  end,
  case
    when value % 43 = 0 then 'Dermalab'
    when value % 47 = 0 then 'Glow Works'
    when value % 59 = 0 then null
    else 'Benchmark Brand ' || (value % 500)::text
  end,
  case value % 5
    when 0 then 'serum'
    when 1 then 'cleanser'
    when 2 then 'moisturiser'
    when 3 then 'spf'
    else 'toner'
  end,
  case when value % 7 = 0 then 'CA' else 'US' end,
  case when value % 3 = 0 then 12 else 6 end,
  'synthetic',
  '11111111-1111-4111-8111-111111111111'::uuid,
  'synthetic-' || value::text,
  null,
  date '2026-07-01',
  case when value % 11 = 0 then 'verified' else 'usable' end,
  'reviewed',
  ((value * 37) % 1000)::numeric / 10,
  'parsed',
  ((value * 17) % 100)::numeric / 100,
  case when value % 97 = 0 then 'blocked' else 'active' end
from generated;

with eligible as (
  select
    product.id as product_id,
    product.source_id,
    row_number() over (order by product.barcode) as sequence,
    pg_catalog.md5('opt116-pao-' || product.barcode) as digest
  from public.products as product
  where (pg_catalog.right(product.barcode, 1)::integer % 10) = 0
)
insert into public.product_pao_expiry (
  id,
  product_id,
  pao_months,
  pao_source,
  expiry_date,
  expiry_source,
  region,
  source_id,
  review_status,
  created_at
)
select
  (
    pg_catalog.substr(digest, 1, 8) || '-' ||
    pg_catalog.substr(digest, 9, 4) || '-' ||
    pg_catalog.substr(digest, 13, 4) || '-' ||
    pg_catalog.substr(digest, 17, 4) || '-' ||
    pg_catalog.substr(digest, 21, 12)
  )::uuid,
  product_id,
  case when sequence % 2 = 0 then 12 else 6 end,
  'synthetic_label',
  null,
  null,
  'US',
  source_id,
  'reviewed',
  timestamptz '2026-07-01 00:00:00+00' + (sequence % 30) * interval '1 day'
from eligible;
