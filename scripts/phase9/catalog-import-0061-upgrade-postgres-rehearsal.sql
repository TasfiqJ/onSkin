\set ON_ERROR_STOP on

-- Dedicated forward-upgrade rehearsal for a database that has already applied
-- CAT-07 migration 0060 and then receives migration 0061. The fixture is the
-- smallest production-shaped surface needed to execute both migrations from
-- their checked-in source bytes and exercise the upgrade-only trigger path.
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticated'
  ) then
    create role authenticated nologin;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'service_role'
  ) then
    create role service_role nologin bypassrls;
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
  display_name text not null,
  attribution_text text,
  attribution_url text,
  requires_attribution boolean not null default false,
  production_approved boolean not null default true,
  review_status text not null default 'legal_approved',
  reviewed_by text,
  reviewed_at timestamptz
);

create table public.product_categories (
  id text primary key,
  label text,
  default_pao_months integer
    constraint product_categories_default_pao_months_check
      check (default_pao_months is null or default_pao_months > 0),
  pao_source text not null default 'unknown',
  is_sunscreen boolean not null default false,
  review_status text not null default 'unreviewed'
);

create table public.products (
  id uuid primary key,
  barcode text,
  name text not null,
  brand text,
  category text,
  category_id text references public.product_categories (id) on delete set null,
  region text,
  default_pao_months integer
    constraint products_default_pao_months_check
      check (default_pao_months is null or default_pao_months > 0),
  source text,
  source_id uuid references public.catalog_sources (id) on delete set null,
  source_ref text,
  source_url text,
  source_snapshot_date date,
  quality_grade text not null default 'usable',
  review_status text not null default 'unreviewed',
  status text not null default 'active',
  recommendation_eligible boolean not null default true,
  reviewed_at timestamptz,
  data_quality_score numeric,
  ingredient_parse_status text,
  ingredient_parse_confidence numeric
);

create table public.product_pao_expiry (
  id uuid primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  pao_months integer
    constraint product_pao_expiry_pao_months_check
      check (pao_months is null or pao_months > 0),
  pao_source text not null default 'unknown',
  region text,
  source_id uuid references public.catalog_sources (id) on delete set null,
  reviewed_by text,
  review_status text not null default 'unreviewed',
  expiry_date date,
  expiry_source text not null default 'unknown',
  created_at timestamptz not null default pg_catalog.now()
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

create table public.catalog_corrections (
  id uuid primary key,
  user_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  status text not null default 'open',
  description text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.shelf_scans (
  id uuid primary key,
  user_id uuid not null,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.catalog_import_batches (
  id uuid primary key,
  source_id uuid not null references public.catalog_sources (id),
  batch_type text not null,
  artifact_kind text not null,
  artifact_sha256 text not null,
  snapshot_date date not null,
  territory text not null,
  status text not null,
  expected_record_count integer not null,
  staged_record_count integer not null default 0,
  qa_blocker_count integer not null default 0,
  qa_warning_count integer not null default 0
);

create table private.catalog_import_chunk_receipts (
  batch_id uuid not null references public.catalog_import_batches (id),
  operation_key text not null unique,
  request_sha256 text not null,
  chunk_ordinal integer not null,
  first_record_ordinal integer not null,
  record_count integer not null,
  chunk_sha256 text not null,
  primary key (batch_id, chunk_ordinal)
);

create table private.catalog_import_staged_records (
  batch_id uuid not null references public.catalog_import_batches (id),
  record_ordinal integer not null,
  record_kind text not null,
  natural_key text not null,
  source_payload jsonb not null,
  normalized_payload jsonb not null,
  record_sha256 text not null,
  primary key (batch_id, record_ordinal),
  unique (batch_id, record_sha256)
);

create function public._health_consent_type_protected(text)
returns boolean language sql stable as $$ select true $$;

create function public._assert_health_dependent_active_locked(uuid, text)
returns void language plpgsql as $$ begin return; end; $$;

create function public._assert_health_processing_active_locked(uuid)
returns void language plpgsql as $$ begin return; end; $$;

create function public._guard_direct_health_write()
returns trigger language plpgsql as $$ begin return new; end; $$;

create trigger trg_user_products_health_write
  before insert or update on public.user_products
  for each row execute function public._guard_direct_health_write('user_id');

create trigger trg_catalog_corrections_health_write
  before insert or update on public.catalog_corrections
  for each row execute function public._guard_direct_health_write('user_id');

create function private.catalog_source_is_production_approved(p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_sources as source
    where source.id = p_source_id
      and source.production_approved is true
      and source.review_status = 'legal_approved'
      and nullif(pg_catalog.btrim(source.reviewed_by), '') is not null
      and source.reviewed_at is not null
      and source.reviewed_at <= pg_catalog.now()
  )
$$;

create function private.catalog_product_is_servable(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products as product
    join public.catalog_sources as source
      on source.id = product.source_id
     and source.source_key = product.source
    where product.id = p_product_id
      and product.region = 'US'
      and product.status = 'active'
      and product.review_status = 'reviewed'
      and product.quality_grade in ('verified', 'usable')
      and product.recommendation_eligible is true
      and private.catalog_source_is_production_approved(source.id)
  )
$$;

revoke all on function private.catalog_source_is_production_approved(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_product_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_source_is_production_approved(uuid)
  to authenticated;
grant execute on function private.catalog_product_is_servable(uuid)
  to authenticated;

create function private.catalog_import_canonical_json(p_value jsonb)
returns text language sql immutable as $$ select p_value::text $$;

create function private.catalog_import_sha256_text(p_value text)
returns text
language sql
immutable
as $$
  select pg_catalog.encode(
    public.digest(pg_catalog.convert_to(p_value, 'UTF8'), 'sha256'),
    'hex'
  )
$$;

create function private.catalog_import_text_is_bounded(
  p_value text,
  p_maximum integer
)
returns boolean
language sql
immutable
as $$
  select p_value is not null
    and nullif(pg_catalog.btrim(p_value), '') is not null
    and pg_catalog.length(p_value) <= p_maximum
$$;

create function private.catalog_import_normalize_key(p_value text)
returns text
language sql
immutable
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.btrim(p_value)),
    '[^a-z0-9]+',
    '_',
    'g'
  )
$$;

create function private.catalog_import_date_is_valid(
  p_value text,
  p_maximum date
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_date date;
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  v_date := p_value::date;
  return v_date <= p_maximum;
exception when others then
  return false;
end;
$$;

-- Public only inside this disposable fixture so API-role calls can construct
-- identical valid/invalid payloads without receiving USAGE on `private`.
create function public.rehearsal_0061_product_record(p_category text)
returns jsonb
language sql
immutable
as $$
  select pg_catalog.jsonb_build_object(
    'recordKind', 'product',
    'canonicalKey', '012345678905',
    'barcode', '012345678905',
    'name', 'Rehearsal benzoyl wash',
    'brand', 'Rehearsal',
    'category', p_category,
    'ingredientsText', 'Benzoyl Peroxide',
    'source', 'open_beauty_facts',
    'sourceComponentId', 'obf_odbl_component',
    'sourceRef', '012345678905',
    'sourceUrl', 'https://world.openbeautyfacts.org/product/012345678905',
    'sourceRecordModifiedDate', '2026-07-20',
    'sourceArtifactSha256', pg_catalog.repeat('a', 64),
    'qualityGrade', 'limited',
    'reviewStatus', 'unreviewed',
    'sourceSnapshotDate', '2026-07-21',
    'region', 'US'
  )
$$;

insert into public.ingredient_pao_defaults (
  category, default_pao_months, rationale
) values ('serum', 9, 'legacy fixture must be purged by 0060');

insert into public.catalog_sources (
  id, source_key, display_name, attribution_text, attribution_url,
  requires_attribution, production_approved, review_status, reviewed_by,
  reviewed_at
) values
  (
    '71000000-0000-4000-8000-000000000001', 'open_beauty_facts',
    'Open Beauty Facts', 'Open Beauty Facts',
    'https://world.openbeautyfacts.org', true, true, 'legal_approved',
    'Catalog Counsel 0061', pg_catalog.now() - interval '1 hour'
  ),
  (
    '71000000-0000-4000-8000-000000000002', 'other_reviewed_source',
    'Other reviewed source', null, null, false, true, 'legal_approved',
    'Catalog Counsel 0061', pg_catalog.now() - interval '1 hour'
  ),
  (
    '71000000-0000-4000-8000-000000000003', 'detachable_source',
    'Detachable source', null, null, false, true, 'legal_approved',
    'Catalog Counsel 0061', pg_catalog.now() - interval '1 hour'
  );

insert into public.product_categories (
  id, label, default_pao_months, pao_source, review_status
) values ('rehearsal-serum', 'Serum', 9, 'reviewed_category_default', 'reviewed');

insert into public.products (
  id, barcode, name, brand, category, category_id, region,
  default_pao_months, source, source_id, source_ref, source_url,
  source_snapshot_date, quality_grade, review_status, status,
  recommendation_eligible, reviewed_at, data_quality_score,
  ingredient_parse_status, ingredient_parse_confidence
) values
  (
    '72000000-0000-4000-8000-000000000001', '012345678905',
    'Visible exact-source product', 'Rehearsal', 'serum',
    'rehearsal-serum', 'US', 12, 'open_beauty_facts',
    '71000000-0000-4000-8000-000000000001', 'visible-exact',
    'https://world.openbeautyfacts.org/product/012345678905', '2026-07-21',
    'usable', 'reviewed', 'active', true,
    pg_catalog.now() - interval '1 hour', 0.99, 'parsed', 0.99
  ),
  (
    '72000000-0000-4000-8000-000000000002', '012345678912',
    'Product parent detach', 'Rehearsal', 'serum', 'rehearsal-serum',
    'US', 12, 'open_beauty_facts',
    '71000000-0000-4000-8000-000000000001', 'product-detach',
    'https://world.openbeautyfacts.org/product/012345678912', '2026-07-21',
    'usable', 'reviewed', 'active', true,
    pg_catalog.now() - interval '1 hour', 0.98, 'parsed', 0.98
  ),
  (
    '72000000-0000-4000-8000-000000000003', '012345678929',
    'Source parent detach', 'Rehearsal', 'serum', 'rehearsal-serum',
    'US', 12, 'detachable_source',
    '71000000-0000-4000-8000-000000000003', 'source-detach',
    'https://example.org/product/source-detach', '2026-07-21',
    'usable', 'reviewed', 'active', true,
    pg_catalog.now() - interval '1 hour', 0.97, 'parsed', 0.97
  );

insert into public.product_pao_expiry (
  id, product_id, pao_months, pao_source, region, source_id,
  reviewed_by, review_status, expiry_source, created_at
) values
  (
    '73000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001', 12, 'catalog', 'US',
    '71000000-0000-4000-8000-000000000001', 'Chemistry 0061',
    'reviewed', 'pao_computed', pg_catalog.now() - interval '5 minutes'
  ),
  (
    '73000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000001', 13, 'catalog', 'US',
    '71000000-0000-4000-8000-000000000002', 'Chemistry 0061',
    'reviewed', 'pao_computed', pg_catalog.now() - interval '4 minutes'
  ),
  (
    '73000000-0000-4000-8000-000000000003',
    '72000000-0000-4000-8000-000000000001', 9, 'category_default', 'US',
    '71000000-0000-4000-8000-000000000001', 'Chemistry 0061',
    'reviewed', 'unknown', pg_catalog.now() - interval '3 minutes'
  ),
  (
    '73000000-0000-4000-8000-000000000004',
    '72000000-0000-4000-8000-000000000001', 6, 'unknown', 'US',
    '71000000-0000-4000-8000-000000000001', 'Chemistry 0061',
    'reviewed', 'unknown', pg_catalog.now() - interval '2 minutes'
  ),
  (
    '73000000-0000-4000-8000-000000000005',
    '72000000-0000-4000-8000-000000000002', 12, 'catalog', 'US',
    '71000000-0000-4000-8000-000000000001', 'Chemistry 0061',
    'reviewed', 'pao_computed', pg_catalog.now() - interval '1 minute'
  ),
  (
    '73000000-0000-4000-8000-000000000006',
    '72000000-0000-4000-8000-000000000003', 12, 'catalog', 'US',
    '71000000-0000-4000-8000-000000000003', 'Chemistry 0061',
    'reviewed', 'pao_computed', pg_catalog.now() - interval '1 minute'
  );

insert into public.user_products (
  id, user_id, catalog_product_id, catalog_source_id, manual_name,
  opened_at, is_opened, pao_months, pao_source, expiry_source
) values
  (
    '74000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000001', 'product detach shelf row',
    '2026-01-15', true, 12, 'catalog', 'pao_computed'
  ),
  (
    '74000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-000000000003', 'source detach shelf row',
    '2026-01-15', true, 12, 'catalog', 'pao_computed'
  );

insert into public.catalog_corrections (
  id, user_id, product_id, status, description
) values (
  '75000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000002',
  'open', 'must survive product parent deletion'
);

insert into public.shelf_scans (id, user_id) values (
  '76000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001'
);

alter table public.product_pao_expiry enable row level security;
create policy "product_pao_expiry_read_servable"
  on public.product_pao_expiry for select to authenticated using (true);
grant select on public.product_pao_expiry, public.products to authenticated;

alter table public.catalog_corrections enable row level security;
create policy legacy_catalog_corrections_read
  on public.catalog_corrections for select to authenticated using (true);
alter table public.shelf_scans enable row level security;
create policy legacy_shelf_scans_read
  on public.shelf_scans for select to authenticated using (true);
grant all on public.catalog_corrections, public.shelf_scans
  to anon, authenticated, service_role;

-- Execute the exact checked-in 0060 bytes. Everything below this include is an
-- already-upgraded 0060 database, including the trigger definition later
-- repaired by 0061.
\ir ../../supabase/migrations/20260718000060_cat07_truthful_freshness.sql

do $$
begin
  if (select count(*) from public.ingredient_pao_defaults) <> 0
     or not exists (
       select 1
       from pg_catalog.pg_class as relation
       where relation.oid = 'public.ingredient_pao_defaults'::regclass
         and relation.relrowsecurity
         and relation.relforcerowsecurity
     ) then
    raise exception 'CATALOG_0061_REHEARSAL_0060_NOT_APPLIED';
  end if;

  if not exists (
    select 1
    from public.user_products
    where id = '74000000-0000-4000-8000-000000000001'
      and catalog_pao_evidence_id =
        '73000000-0000-4000-8000-000000000005'::uuid
      and catalog_pao_source_id =
        '71000000-0000-4000-8000-000000000001'::uuid
      and pao_source = 'catalog'
  ) then
    raise exception 'CATALOG_0061_REHEARSAL_0060_SNAPSHOT_MISSING';
  end if;
end;
$$;

insert into public.catalog_import_batches (
  id, source_id, batch_type, artifact_kind, artifact_sha256, snapshot_date,
  territory, status, expected_record_count, staged_record_count,
  qa_blocker_count, qa_warning_count
) values (
  '77000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'obf_export', 'production', pg_catalog.repeat('a', 64), '2026-07-21',
  'US', 'running', 1, 0, 0, 0
);

-- Execute the exact checked-in forward migration bytes.
\ir ../../supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql

do $$
begin
  if pg_catalog.has_function_privilege(
       'anon',
       'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.stage_catalog_import_chunk(uuid,text,integer,integer,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'CATALOG_0061_STAGE_RPC_ACL_INVALID';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('catalog_corrections', 'shelf_scans')
  ) <> 0 then
    raise exception 'CATALOG_0061_LEGACY_RAW_POLICY_SURVIVED';
  end if;
end;
$$;

-- API-role denial must occur before any advisory-locked staging mutation.
set role authenticated;
do $$
begin
  begin
    perform public.stage_catalog_import_chunk(
      '77000000-0000-4000-8000-000000000001',
      'upgrade-denied-0061', 1, 1,
      pg_catalog.jsonb_build_array(
        public.rehearsal_0061_product_record('benzoyl_peroxide')
      )
    );
    raise exception 'CATALOG_0061_AUTHENTICATED_STAGE_ACCEPTED';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;
reset role;

do $$
begin
  if exists (
       select 1 from private.catalog_import_staged_records
       where batch_id = '77000000-0000-4000-8000-000000000001'
     )
     or exists (
       select 1 from private.catalog_import_chunk_receipts
       where batch_id = '77000000-0000-4000-8000-000000000001'
     )
     or (
       select staged_record_count from public.catalog_import_batches
       where id = '77000000-0000-4000-8000-000000000001'
     ) <> 0 then
    raise exception 'CATALOG_0061_DENIED_STAGE_LEFT_RESIDUE';
  end if;
end;
$$;

-- A service-authorized but invalid category is rejected transactionally. The
-- row insert, chunk receipt, and batch counter must all roll back together.
set role service_role;
do $$
begin
  begin
    perform public.stage_catalog_import_chunk(
      '77000000-0000-4000-8000-000000000001',
      'upgrade-invalid-0061', 1, 1,
      pg_catalog.jsonb_build_array(
        public.rehearsal_0061_product_record('retinoid')
      )
    );
    raise exception 'CATALOG_0061_INVALID_CATEGORY_ACCEPTED';
  exception when sqlstate '22023' then
    if sqlerrm <> 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID' then
      raise;
    end if;
  end;
end;
$$;
reset role;

do $$
begin
  if exists (
       select 1 from private.catalog_import_staged_records
       where batch_id = '77000000-0000-4000-8000-000000000001'
     )
     or exists (
       select 1 from private.catalog_import_chunk_receipts
       where batch_id = '77000000-0000-4000-8000-000000000001'
     )
     or (
       select staged_record_count from public.catalog_import_batches
       where id = '77000000-0000-4000-8000-000000000001'
     ) <> 0 then
    raise exception 'CATALOG_0061_INVALID_STAGE_DID_NOT_ROLL_BACK';
  end if;
end;
$$;

set role service_role;
do $$
declare
  v_receipt record;
begin
  select staged.* into v_receipt
  from public.stage_catalog_import_chunk(
    '77000000-0000-4000-8000-000000000001',
    'upgrade-valid-0061', 1, 1,
    pg_catalog.jsonb_build_array(
      public.rehearsal_0061_product_record('benzoyl_peroxide')
    )
  ) as staged;

  if v_receipt.batch_id is distinct from
       '77000000-0000-4000-8000-000000000001'::uuid
     or v_receipt.chunk_ordinal <> 1
     or v_receipt.staged_record_count <> 1
     or v_receipt.replayed is not false
     or v_receipt.record_receipts #>>
       '{0,normalizedPayload,category}' <> 'benzoyl_peroxide' then
    raise exception 'CATALOG_0061_VALID_STAGE_RECEIPT_INVALID';
  end if;
end;
$$;
reset role;

do $$
begin
  if (
       select staged_record_count
       from public.catalog_import_batches
       where id = '77000000-0000-4000-8000-000000000001'
     ) <> 1
     or (
       select normalized_payload ->> 'category'
       from private.catalog_import_staged_records
       where batch_id = '77000000-0000-4000-8000-000000000001'
         and record_ordinal = 1
     ) <> 'benzoyl_peroxide' then
    raise exception 'CATALOG_0061_VALID_STAGE_NOT_PERSISTED';
  end if;
end;
$$;

-- The service projection and direct authenticated policy must expose only the
-- exact-parent-source, product-specific reviewed PAO. Wrong-source,
-- category-default, and unknown evidence are all non-visible.
do $$
declare
  v_pao jsonb;
begin
  select served.product_pao_expiry into v_pao
  from public.catalog_servable_products as served
  where served.id = '72000000-0000-4000-8000-000000000001';

  if v_pao is null
     or pg_catalog.jsonb_array_length(v_pao) <> 1
     or v_pao #>> '{0,pao_source}' <> 'catalog'
     or v_pao #>> '{0,pao_months}' <> '12'
     or v_pao #>> '{0,source_id}' <>
       '71000000-0000-4000-8000-000000000001' then
    raise exception 'CATALOG_0061_SERVICE_PAO_BOUNDARY_INVALID: %', v_pao;
  end if;
end;
$$;

set role authenticated;
do $$
declare
  v_count integer;
  v_only_id uuid;
begin
  select
    pg_catalog.count(*)::integer,
    pg_catalog.min(freshness.id::text)::uuid
    into v_count, v_only_id
  from public.product_pao_expiry as freshness
  where freshness.product_id = '72000000-0000-4000-8000-000000000001';

  if v_count <> 1
     or v_only_id <> '73000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'CATALOG_0061_AUTHENTICATED_PAO_BOUNDARY_INVALID: %, %',
      v_count, v_only_id;
  end if;
end;
$$;
reset role;

-- Exercise the table-safe 0061 trigger replacement through the actual nested
-- ON DELETE SET NULL updates. First prove the entire parent/cascade/detach set
-- is reversible, then repeat it as the committed lifecycle operation.
begin;
delete from public.products
where id = '72000000-0000-4000-8000-000000000002';

do $$
begin
  if exists (
       select 1 from public.products
       where id = '72000000-0000-4000-8000-000000000002'
     )
     or not exists (
       select 1 from public.catalog_corrections
       where id = '75000000-0000-4000-8000-000000000001'
         and product_id is null
         and description = 'must survive product parent deletion'
     )
     or not exists (
       select 1 from public.user_products
       where id = '74000000-0000-4000-8000-000000000001'
         and catalog_product_id is null
         and catalog_source_id =
           '71000000-0000-4000-8000-000000000001'::uuid
         and pao_source = 'catalog'
         and pao_months = 12
         and catalog_pao_evidence_id =
           '73000000-0000-4000-8000-000000000005'::uuid
     ) then
    raise exception 'CATALOG_0061_NESTED_PRODUCT_DETACH_INVALID';
  end if;
end;
$$;
rollback;

do $$
begin
  if not exists (
       select 1 from public.products
       where id = '72000000-0000-4000-8000-000000000002'
     )
     or not exists (
       select 1 from public.product_pao_expiry
       where id = '73000000-0000-4000-8000-000000000005'
     )
     or not exists (
       select 1 from public.catalog_corrections
       where id = '75000000-0000-4000-8000-000000000001'
         and product_id = '72000000-0000-4000-8000-000000000002'
     )
     or not exists (
       select 1 from public.user_products
       where id = '74000000-0000-4000-8000-000000000001'
         and catalog_product_id =
           '72000000-0000-4000-8000-000000000002'::uuid
     ) then
    raise exception 'CATALOG_0061_PRODUCT_DELETE_ROLLBACK_INVALID';
  end if;
end;
$$;

delete from public.products
where id = '72000000-0000-4000-8000-000000000002';

do $$
begin
  if not exists (
       select 1 from public.catalog_corrections
       where id = '75000000-0000-4000-8000-000000000001'
         and product_id is null
     )
     or not exists (
       select 1 from public.user_products
       where id = '74000000-0000-4000-8000-000000000001'
         and catalog_product_id is null
         and catalog_source_id =
           '71000000-0000-4000-8000-000000000001'::uuid
         and catalog_pao_evidence_id =
           '73000000-0000-4000-8000-000000000005'::uuid
     ) then
    raise exception 'CATALOG_0061_COMMITTED_PRODUCT_DETACH_INVALID';
  end if;
end;
$$;

delete from public.catalog_sources
where id = '71000000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (
       select 1 from public.products
       where id = '72000000-0000-4000-8000-000000000003'
         and source_id is null
     )
     or not exists (
       select 1 from public.user_products
       where id = '74000000-0000-4000-8000-000000000002'
         and catalog_product_id =
           '72000000-0000-4000-8000-000000000003'::uuid
         and catalog_source_id is null
         and pao_source = 'catalog'
         and catalog_pao_source_id =
           '71000000-0000-4000-8000-000000000003'::uuid
     ) then
    raise exception 'CATALOG_0061_NESTED_SOURCE_DETACH_INVALID';
  end if;
end;
$$;

select 'catalog-import-0061-upgrade-postgres-rehearsal: pass' as result;
