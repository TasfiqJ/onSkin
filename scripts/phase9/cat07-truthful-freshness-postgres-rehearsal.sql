\set ON_ERROR_STOP on

-- Isolated pre-CAT-07 upgrade rehearsal. The fixture intentionally includes
-- only the table/function surface the real 0060 migration needs, then verifies
-- the launch CAT07 model: product-specific reviewed catalog PAO can be admitted,
-- category defaults are quarantined, and catalog lifecycle operations do not pin.
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

create schema private;

create table public.ingredient_pao_defaults (
  category text primary key,
  default_pao_months integer not null,
  rationale text
);

create table public.catalog_sources (
  id uuid primary key,
  source_key text not null unique,
  production_approved boolean not null default true,
  review_status text not null default 'legal_approved'
);

create table public.product_categories (
  id text primary key,
  label text,
  default_pao_months integer check (default_pao_months is null or default_pao_months > 0),
  pao_source text not null default 'unknown',
  is_sunscreen boolean not null default false,
  review_status text not null default 'unreviewed'
);

create table public.products (
  id uuid primary key,
  barcode text,
  name text,
  category text,
  category_id text references public.product_categories (id) on delete set null,
  source text,
  source_id uuid references public.catalog_sources (id) on delete set null,
  source_ref text,
  source_snapshot_date date,
  region text,
  status text not null default 'active',
  review_status text not null default 'unreviewed',
  quality_grade text not null default 'usable',
  recommendation_eligible boolean not null default true,
  reviewed_at timestamptz,
  default_pao_months integer check (default_pao_months is null or default_pao_months > 0)
);

create table public.product_pao_expiry (
  id uuid primary key,
  product_id uuid references public.products (id) on delete cascade,
  pao_months integer,
  pao_source text not null default 'unknown',
  region text,
  source_id uuid references public.catalog_sources (id) on delete set null,
  reviewed_by text,
  review_status text not null default 'unreviewed',
  expiry_date date,
  expiry_source text not null default 'unknown'
);

create table public.user_products (
  id uuid primary key,
  user_id uuid not null,
  catalog_product_id uuid references public.products (id) on delete set null,
  catalog_source_id uuid references public.catalog_sources (id) on delete set null,
  manual_name text,
  opened_at date,
  is_opened boolean not null default false,
  pao_months integer check (pao_months is null or pao_months > 0),
  pao_source text not null default 'unknown',
  expiry_date date,
  expiry_computed date generated always as (
    least(expiry_date, (opened_at + make_interval(months => pao_months))::date)
  ) stored,
  expiry_source text not null default 'unknown',
  constraint user_products_opened_state_coherent check (
    (is_opened = true and opened_at is not null and opened_at <= current_date)
    or (is_opened = false and opened_at is null)
  ),
  constraint user_products_pao_source_coherent check (
    (pao_months is null and pao_source = 'unknown')
    or pao_months is not null
  ),
  constraint user_products_expiry_source_coherent check (
    expiry_source = case
      when is_opened = false and expiry_date is not null then 'printed'
      when is_opened = false then 'estimated'
      when expiry_computed is null then 'unknown'
      when expiry_date is not null and expiry_computed = expiry_date then 'printed'
      else 'pao_computed'
    end
  )
);

create function public._health_consent_type_protected(text)
returns boolean language sql stable as $$ select true $$;

create function public._assert_health_dependent_active_locked(uuid, text)
returns void language plpgsql as $$ begin return; end; $$;

create function public._assert_health_processing_active_locked(uuid)
returns void language plpgsql as $$ begin return; end; $$;

create function private.catalog_product_is_servable(uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.products
    where id = $1
      and status = 'active'
      and review_status = 'reviewed'
      and quality_grade in ('verified', 'usable')
      and recommendation_eligible
  )
$$;

create function private.catalog_source_is_production_approved(uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.catalog_sources
    where id = $1
      and production_approved
      and review_status = 'legal_approved'
  )
$$;

create function public._guard_direct_health_write()
returns trigger language plpgsql as $$ begin return new; end; $$;

create trigger trg_user_products_health_write
  before insert or update on public.user_products
  for each row execute function public._guard_direct_health_write('user_id');

insert into public.ingredient_pao_defaults (category, default_pao_months, rationale)
values ('serum', 9, 'legacy fixture'), ('spf', 12, 'legacy fixture');

insert into public.catalog_sources (id, source_key) values
  ('62000000-0000-4000-8000-000000000001', 'internal_derived'),
  ('62000000-0000-4000-8000-000000000002', 'curated');

insert into public.product_categories (
  id, label, default_pao_months, pao_source, is_sunscreen, review_status
) values
  ('cat07-reviewed-serum', 'Serum', 9, 'reviewed_category_default', false, 'reviewed'),
  ('cat07-sunscreen', 'Sunscreen', null, 'label_required', true, 'needs_review');

insert into public.products (
  id, barcode, name, category, category_id, source, source_id, source_ref,
  source_snapshot_date, region, status, review_status, quality_grade,
  recommendation_eligible, reviewed_at, default_pao_months
) values
  (
    '61000000-0000-4000-8000-000000000001', '10000007', 'CAT07 catalog serum',
    'serum', 'cat07-reviewed-serum', 'internal_derived',
    '62000000-0000-4000-8000-000000000001', 'cat07-catalog',
    current_date, 'US', 'active', 'reviewed', 'usable', true,
    statement_timestamp() - interval '1 minute', 12
  ),
  (
    '61000000-0000-4000-8000-000000000002', '10000014', 'CAT07 category serum',
    'serum', 'cat07-reviewed-serum', 'internal_derived',
    '62000000-0000-4000-8000-000000000001', 'cat07-category',
    current_date, 'US', 'active', 'reviewed', 'usable', true,
    statement_timestamp() - interval '1 minute', null
  ),
  (
    '61000000-0000-4000-8000-000000000003', '10000021', 'CAT07 invalid default',
    'serum', 'cat07-reviewed-serum', 'internal_derived',
    '62000000-0000-4000-8000-000000000001', 'cat07-invalid-default',
    current_date, 'US', 'active', 'reviewed', 'usable', true,
    statement_timestamp() - interval '1 minute', 180
  );

insert into public.product_pao_expiry (
  id, product_id, pao_months, pao_source, region, source_id, reviewed_by, review_status
) values
  (
    '63000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    12, 'catalog', 'US', '62000000-0000-4000-8000-000000000001',
    'Chemistry Reviewer CAT07', 'reviewed'
  ),
  (
    '63000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    121, 'label', 'US', '62000000-0000-4000-8000-000000000001',
    'Chemistry Reviewer CAT07', 'reviewed'
  );

insert into public.user_products (
  id, user_id, catalog_product_id, catalog_source_id, manual_name,
  opened_at, is_opened, pao_months, pao_source, expiry_date, expiry_source
) values
  (
    '64000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    'catalog pao', '2024-01-15', true, 12, 'catalog', null, 'pao_computed'
  ),
  (
    '64000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    'category default', '2024-01-15', true, 9, 'category_default', null, 'pao_computed'
  ),
  (
    '64000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    'catalog copied package date', '2024-01-15', true, null, 'unknown',
    '2030-01-15', 'printed'
  );

\ir ../../supabase/migrations/20260718000060_cat07_truthful_freshness.sql

do $$
declare
  v_internal_source uuid := '62000000-0000-4000-8000-000000000001';
begin
  if (select count(*) from public.ingredient_pao_defaults) <> 0 then
    raise exception 'CAT07_LEGACY_DEFAULT_RELATION_NOT_EMPTY';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    where relation.oid = 'public.ingredient_pao_defaults'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  )
  or not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.ingredient_pao_defaults'::regclass
      and conname = 'ingredient_pao_defaults_legacy_empty'
      and pg_catalog.pg_get_expr(conbin, conrelid) = 'false'
  ) then
    raise exception 'CAT07_LEGACY_DEFAULT_RELATION_NOT_SEALED';
  end if;

  begin
    insert into public.ingredient_pao_defaults (category, default_pao_months, rationale)
    values ('serum-again', 9, 'must fail');
    raise exception 'CAT07_LEGACY_DEFAULT_REPOPULATION_ACCEPTED';
  exception when check_violation then
    null;
  end;

  if not exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and pao_months = 12
      and pao_source = 'catalog'
      and expiry_source = 'pao_computed'
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000001'
      and catalog_pao_source_id = v_internal_source
      and catalog_pao_region = 'US'
      and catalog_pao_recorded_at is not null
  ) then
    raise exception 'CAT07_CATALOG_PAO_SNAPSHOT_NOT_BACKFILLED';
  end if;

  if not exists (
    select 1 from public.products
    where id = '61000000-0000-4000-8000-000000000003'
      and default_pao_months is null
      and review_status = 'needs_review'
      and recommendation_eligible = false
  ) then
    raise exception 'CAT07_OVERSIZED_PRODUCT_DEFAULT_NOT_QUARANTINED';
  end if;

  if exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000002'
      and (pao_months is not null or pao_source <> 'unknown' or expiry_source <> 'unknown')
  ) then
    raise exception 'CAT07_CATEGORY_DEFAULT_NOT_QUARANTINED';
  end if;

  if not exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000003'
      and expiry_date is null
      and legacy_unverified_expiry_date = '2030-01-15'
      and expiry_source = 'unknown'
  ) then
    raise exception 'CAT07_LEGACY_QUARANTINE_NOT_EXCLUSIVE';
  end if;

  delete from public.catalog_sources where id = v_internal_source;
  if not exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and catalog_source_id is null
      and catalog_pao_evidence_id = '63000000-0000-4000-8000-000000000001'
      and catalog_pao_source_id = v_internal_source
  ) then
    raise exception 'CAT07_CATALOG_SOURCE_DELETE_PINNED';
  end if;

  update public.user_products
  set catalog_source_id = v_internal_source
  where id = '64000000-0000-4000-8000-000000000001';
  if exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and catalog_source_id is not null
  ) then
    raise exception 'CAT07_STALE_SOURCE_REPLAY_RELINKED';
  end if;

  delete from public.products where id = '61000000-0000-4000-8000-000000000001';
  update public.user_products
  set catalog_product_id = '61000000-0000-4000-8000-000000000001'
  where id = '64000000-0000-4000-8000-000000000001';
  if exists (
    select 1 from public.user_products
    where id = '64000000-0000-4000-8000-000000000001'
      and catalog_product_id is not null
  ) then
    raise exception 'CAT07_STALE_PRODUCT_REPLAY_RELINKED';
  end if;

  begin
    insert into public.user_products (
      id, user_id, manual_name, opened_at, is_opened, pao_months, pao_source, expiry_source
    ) values (
      '64000000-0000-4000-8000-000000000004',
      '60000000-0000-4000-8000-000000000001',
      'future opening', ((statement_timestamp() at time zone 'UTC')::date + 2),
      true, 12, 'label', 'pao_computed'
    );
    raise exception 'CAT07_ARBITRARY_FUTURE_OPENING_ACCEPTED';
  exception when check_violation then
    null;
  end;
end;
$$;

select 'CAT07_TRUTHFUL_FRESHNESS_POSTGRES_REHEARSAL_PASS' as result;
