\set ON_ERROR_STOP on

-- Isolated upgrade rehearsal for migration 0059. The legacy event is seeded
-- before the health trigger is installed so applying the real migration proves
-- its maintenance UPDATE cannot be blocked by request-epoch enforcement.
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema private;

create table public.shelf_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contributed_back boolean not null default false
);

create table public.catalog_lookup_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lookup_type text not null,
  query text,
  barcode text,
  result text not null,
  matched_product_id uuid,
  source_key text,
  quality_grade text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key,
  barcode text,
  status text not null,
  review_status text not null,
  quality_grade text not null,
  recommendation_eligible boolean not null
);

create table public.product_barcodes (
  barcode text primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  review_status text not null
);

create table public.obf_contribution_queue (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid,
  user_id uuid not null,
  barcode text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'held',
  hold_reason text,
  source_snapshot jsonb not null default '{}'::jsonb,
  obf_response jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid,
  barcode text,
  correction_type text not null,
  status text not null default 'open',
  description text,
  proposed_payload jsonb not null default '{}'::jsonb,
  client_context jsonb not null default '{}'::jsonb,
  assigned_to text,
  resolved_by text,
  resolution_note text,
  source_id uuid,
  operator_reviewed_at timestamptz,
  operator_reviewed_by text,
  operator_review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shelf_scans enable row level security;
alter table public.catalog_lookup_events enable row level security;
alter table public.catalog_corrections enable row level security;
alter table public.obf_contribution_queue enable row level security;

create policy "shelf_scans_select_own" on public.shelf_scans for select to authenticated using (true);
create policy "shelf_scans_insert_own" on public.shelf_scans for insert to authenticated with check (true);
create policy "shelf_scans_update_own" on public.shelf_scans for update to authenticated using (true);
create policy "health_processing_read_fence" on public.shelf_scans for select to authenticated using (true);
create policy "catalog_lookup_events_select_own" on public.catalog_lookup_events for select to authenticated using (true);
create policy "catalog_lookup_events_insert_own" on public.catalog_lookup_events for insert to authenticated with check (true);
create policy "catalog_corrections_select_own" on public.catalog_corrections for select to authenticated using (true);
create policy "obf_contribution_queue_legacy_read" on public.obf_contribution_queue for select to service_role using (true);

-- Model Supabase's broad table defaults, including privileges that bypass RLS
-- or can mutate schema-level behavior, rather than seeding CRUD alone.
grant all privileges on table public.shelf_scans to anon, authenticated, service_role;
grant all privileges on table public.catalog_lookup_events to anon, authenticated, service_role;
grant all privileges on table public.catalog_corrections to anon, authenticated, service_role;
grant all privileges on table public.obf_contribution_queue to anon, authenticated, service_role;

create or replace function public._request_health_processing_epoch()
returns bigint
language sql
stable
as $$
  select nullif(current_setting('app.test_health_epoch', true), '')::bigint
$$;

create or replace function public.account_write_allowed(p_user_id uuid)
returns boolean
language sql
stable
as $$ select p_user_id is not null $$;

create or replace function public._assert_health_processing_epoch_locked(
  p_user_id uuid,
  p_expected_epoch bigint
)
returns void
language plpgsql
as $$
begin
  if p_user_id is null
     or p_expected_epoch is distinct from public._request_health_processing_epoch() then
    raise exception 'HEALTH_PROCESSING_EPOCH_STALE' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._guard_direct_health_write()
returns trigger
language plpgsql
as $$
begin
  perform public._assert_health_processing_epoch_locked(
    new.user_id,
    public._request_health_processing_epoch()
  );
  if public._request_health_processing_epoch() is null then
    raise exception 'HEALTH_PROCESSING_EPOCH_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_obf_contribution_for_correction(
  p_correction_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.obf_contribution_queue (
    correction_id,
    user_id,
    payload,
    status
  ) values (
    p_correction_id,
    '00000000-0000-4000-8000-000000000001',
    '{"legacy":"must-purge"}'::jsonb,
    'held'
  ) returning id into v_id;
  return pg_catalog.jsonb_build_object('outcome', 'enqueued', 'id', v_id);
end;
$$;
grant execute on function public.enqueue_obf_contribution_for_correction(uuid)
  to service_role;

create or replace function public.rehearsal_triage_catalog_correction(
  p_correction_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update public.catalog_corrections
  set status = 'triaged',
      updated_at = pg_catalog.now()
  where id = p_correction_id;
end;
$$;
grant execute on function public.rehearsal_triage_catalog_correction(uuid)
  to service_role;

create or replace function public.rehearsal_scrub_obf_queue(p_user_id uuid)
returns bigint
language plpgsql
security definer
as $$
declare
  v_count bigint;
begin
  delete from public.obf_contribution_queue where user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Stand in for CAT-03's immutable served-state mutation ledger. The real
-- triggers must remain enabled while 0059 blocks reviewed identities so any
-- affected curation head is invalidated by ordinary mutation evidence.
create table private.catalog_serving_mutation_probe (
  relation_name text not null,
  product_id uuid not null,
  barcode text
);

create or replace function private.capture_catalog_serving_mutation_probe()
returns trigger
language plpgsql
as $$
begin
  insert into private.catalog_serving_mutation_probe (
    relation_name,
    product_id,
    barcode
  ) values (
    tg_table_name,
    coalesce(
      pg_catalog.to_jsonb(new) ->> 'product_id',
      pg_catalog.to_jsonb(new) ->> 'id'
    )::uuid,
    pg_catalog.to_jsonb(new) ->> 'barcode'
  );
  return new;
end;
$$;

create trigger catalog_launch_mutation_products
  after update on public.products
  for each row execute function private.capture_catalog_serving_mutation_probe();
create trigger catalog_launch_mutation_barcodes
  after update on public.product_barcodes
  for each row execute function private.capture_catalog_serving_mutation_probe();

insert into public.shelf_scans (user_id, contributed_back)
values ('00000000-0000-4000-8000-000000000001', false);

select public.enqueue_obf_contribution_for_correction(
  '30000000-0000-4000-8000-000000000001'
);

insert into public.catalog_lookup_events (
  user_id,
  lookup_type,
  query,
  barcode,
  result,
  matched_product_id,
  source_key,
  quality_grade,
  created_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'barcode',
  'legacy sensitive query',
  '036000291452',
  'matched',
  '00000000-0000-4000-8000-000000000002',
  'legacy_source',
  'usable',
  now() - interval '1 day'
);

insert into public.catalog_lookup_events (
  user_id,
  lookup_type,
  query,
  result,
  created_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'search',
  'legacy infinite timestamp',
  'no_match',
  'infinity'::timestamptz
);

create trigger trg_catalog_lookup_events_health_write
  before insert or update on public.catalog_lookup_events
  for each row execute function public._guard_direct_health_write('user_id');

insert into public.catalog_corrections (
  user_id,
  barcode,
  correction_type,
  proposed_payload,
  client_context
) values (
  '00000000-0000-4000-8000-000000000001',
  '123456789',
  'missing_product',
  '{"productName":"Legacy report","Barcode":"lot-serial-123","metadata":{"BARCODE":"nested-lot"}}'::jsonb,
  '{"route":"legacy","details":[{"barCode":"context-lot"}]}'::jsonb
);

update public.catalog_corrections
set created_at = 'infinity'::timestamptz,
    updated_at = 'infinity'::timestamptz
where barcode = '123456789';

insert into public.catalog_corrections (
  user_id,
  barcode,
  correction_type,
  proposed_payload
) values (
  '00000000-0000-4000-8000-000000000001',
  '0036000291452',
  'missing_product',
  '{"productName":"Legacy UPC-A shape"}'::jsonb
);

insert into public.catalog_corrections (
  user_id,
  barcode,
  correction_type,
  proposed_payload
) values (
  '00000000-0000-4000-8000-000000000001',
  '04006381333931',
  'missing_product',
  '{"productName":"Legacy padded EAN-13 shape"}'::jsonb
);

insert into public.catalog_corrections (
  user_id,
  barcode,
  correction_type,
  proposed_payload
) values
  (
    '00000000-0000-4000-8000-000000000001',
    '00012345678905',
    'missing_product',
    '{"productName":"Legacy padded UPC-A shape"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000096385074',
    'missing_product',
    '{"productName":"Legacy padded GTIN-8 shape"}'::jsonb
  );

insert into public.catalog_corrections (
  user_id,
  correction_type,
  description,
  proposed_payload,
  client_context
) values (
  '00000000-0000-4000-8000-000000000001',
  'ingredient_issue',
  'pregnancy medication note from legacy@example.test',
  pg_catalog.jsonb_build_object(
    'productName', '  Safe   legacy product  ',
    'brand', 'Image Skincare',
    'ingredientsText', '  Aqua,   Glycerin  ',
    'sourceUrl', 'https://user:pass@example.test/item?access_token=secret',
    'qualityIssue', 'authorization bearer token',
    'category', pg_catalog.jsonb_build_object('BARCODE', 'nested-alias'),
    'suggestedCorrection', pg_catalog.jsonb_build_array('nested'),
    'unknownPath', 'file:///var/mobile/private-photo.jpg',
    'Barcode', 'duplicate-identity',
    'sourceName', E'local label C:\\Users\\name\\photo.jpg'
  ),
  pg_catalog.jsonb_build_object(
    'route', '  shelf_detail  ',
    'source', 'camera',
    'appVersion', '1.0',
    'platform', 'email legacy@example.test',
    'quality', pg_catalog.jsonb_build_object('barCode', 'nested-context'),
    'accessToken', 'secret'
  )
);

insert into public.catalog_corrections (
  user_id,
  correction_type,
  description,
  proposed_payload,
  client_context
) values (
  '00000000-0000-4000-8000-000000000001',
  'category_issue',
  pg_catalog.repeat('D', 100000),
  pg_catalog.jsonb_build_object(
    'productName', 'Oversized legacy payload',
    'sourceName', pg_catalog.repeat('A', 10000)
  ),
  pg_catalog.jsonb_build_object(
    'route', 'shelf_detail',
    'appVersion', pg_catalog.repeat('B', 10000)
  )
);

do $$
declare
  v_deep jsonb := '"leaf"'::jsonb;
  v_index integer;
begin
  for v_index in 1..96 loop
    v_deep := pg_catalog.jsonb_build_object('level', v_deep);
  end loop;
  insert into public.catalog_corrections (
    user_id,
    correction_type,
    proposed_payload,
    client_context
  ) values (
    '00000000-0000-4000-8000-000000000001',
    'source_issue',
    pg_catalog.jsonb_build_object(
      'productName', 'Deep legacy product',
      'metadata', v_deep
    ),
    pg_catalog.jsonb_build_object('route', v_deep)
  );
end;
$$;

insert into public.products (
  id, barcode, status, review_status, quality_grade, recommendation_eligible
) values
  ('00000000-0000-4000-8000-000000000010', '012345678905', 'active', 'reviewed', 'usable', true),
  ('00000000-0000-4000-8000-000000000011', '123456789', 'active', 'reviewed', 'usable', true),
  ('00000000-0000-4000-8000-000000000012', '0036000291452', 'active', 'reviewed', 'usable', true),
  ('00000000-0000-4000-8000-000000000013', '04006381333931', 'active', 'reviewed', 'usable', true),
  ('00000000-0000-4000-8000-000000000014', '10012345000017', 'active', 'reviewed', 'usable', true),
  ('00000000-0000-4000-8000-000000000015', '00012345678905', 'active', 'reviewed', 'usable', true),
  ('00000000-0000-4000-8000-000000000016', '00000096385074', 'active', 'reviewed', 'usable', true);

insert into public.product_barcodes (barcode, product_id, review_status) values
  ('012345678905', '00000000-0000-4000-8000-000000000010', 'reviewed'),
  ('123456789', '00000000-0000-4000-8000-000000000011', 'reviewed'),
  ('0036000291452', '00000000-0000-4000-8000-000000000012', 'reviewed'),
  ('04006381333931', '00000000-0000-4000-8000-000000000013', 'reviewed'),
  ('10012345000017', '00000000-0000-4000-8000-000000000014', 'reviewed'),
  ('00012345678905', '00000000-0000-4000-8000-000000000015', 'reviewed'),
  ('00000096385074', '00000000-0000-4000-8000-000000000016', 'reviewed');

create trigger trg_catalog_corrections_health_write
  before insert or update on public.catalog_corrections
  for each row execute function public._guard_direct_health_write('user_id');

\ir ../../supabase/migrations/20260718000059_catalog_scan_minimization.sql

do $$
declare
  v_obf_result jsonb;
begin
  if exists (select 1 from public.shelf_scans) then
    raise exception 'legacy shelf scan was not purged';
  end if;
  if exists (select 1 from public.obf_contribution_queue) then
    raise exception 'legacy OBF contribution work was not purged';
  end if;
  if not (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'obf_contribution_queue'
  ) then
    raise exception 'legacy OBF contribution queue was not force-RLS sealed';
  end if;
  if pg_catalog.has_table_privilege(
       'anon', 'public.obf_contribution_queue', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.obf_contribution_queue', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'TRUNCATE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'TRIGGER'
     ) then
    raise exception 'legacy OBF contribution queue retains an API privilege';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'obf_contribution_queue'
  ) then
    raise exception 'legacy OBF contribution queue retains an API policy';
  end if;
  if pg_catalog.has_function_privilege(
    'service_role',
    'public.enqueue_obf_contribution_for_correction(uuid)',
    'EXECUTE'
  ) then
    raise exception 'legacy OBF contribution enqueue authority remains executable';
  end if;
  v_obf_result := public.enqueue_obf_contribution_for_correction(
    '30000000-0000-4000-8000-000000000001'
  );
  if v_obf_result is distinct from
       '{"outcome":"contribution_lane_disabled","enqueued":false}'::jsonb
     or exists (select 1 from public.obf_contribution_queue)
     or public.rehearsal_scrub_obf_queue(
       '00000000-0000-4000-8000-000000000001'
     ) <> 0 then
    raise exception 'legacy OBF compatibility stub or account erasure path is not inert';
  end if;
  if exists (
    select 1
    from public.catalog_lookup_events
    where query is not null
       or barcode is not null
       or matched_product_id is not null
       or source_key is not null
       or quality_grade is not null
  ) then
    raise exception 'legacy lookup identity was not minimized';
  end if;
  if exists (
    select 1
    from public.catalog_lookup_events
    where not isfinite(created_at) or created_at > now()
  ) then
    raise exception 'future/non-finite lookup timestamp survived';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.catalog_lookup_events'::regclass
      and tgname = 'trg_catalog_lookup_events_health_write'
      and not tgisinternal
  ) then
    raise exception 'health-write trigger was not restored';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_lookup_events', 'INSERT') then
    raise exception 'authenticated lookup-event insert remains granted';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_lookup_events', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.catalog_lookup_events', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.catalog_lookup_events', 'TRIGGER') then
    raise exception 'lookup-event bypass privilege remains granted';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_corrections', 'SELECT') then
    raise exception 'authenticated correction workflow read remains granted';
  end if;
  if has_table_privilege('authenticated', 'public.catalog_corrections', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.catalog_corrections', 'TRUNCATE')
     or has_table_privilege('service_role', 'public.catalog_corrections', 'TRIGGER') then
    raise exception 'catalog-correction bypass privilege remains granted';
  end if;
  if not has_table_privilege('service_role', 'public.catalog_corrections', 'SELECT') then
    raise exception 'sanitized correction export lost its service read';
  end if;
  if exists (
    select 1
    from public.catalog_corrections
    where barcode is not null
      and barcode not in (
        '96385074', '012345678905', '036000291452', '4006381333931'
      )
  ) then
    raise exception 'legacy correction identity was not minimized/canonicalized';
  end if;
  if exists (
    select 1
    from public.catalog_corrections
    where description is distinct from private.catalog_report_safe_text(
            'description', description
          )
       or proposed_payload is distinct from private.catalog_sanitize_report_object(
            proposed_payload, 'proposed'
          )
       or client_context is distinct from private.catalog_sanitize_report_object(
            client_context, 'context'
          )
       or not isfinite(created_at)
       or not isfinite(updated_at)
       or created_at > now()
       or updated_at > now()
  ) then
    raise exception 'legacy correction payload/timestamp was not minimized';
  end if;
  if not exists (
    select 1
    from public.catalog_corrections
    where correction_type = 'ingredient_issue'
      and description is null
      and proposed_payload = '{"productName":"Safe legacy product","brand":"Image Skincare","ingredientsText":"Aqua, Glycerin"}'::jsonb
      and client_context = '{"route":"shelf_detail","source":"camera","appVersion":"1.0"}'::jsonb
  ) then
    raise exception 'legacy correction scalar allowlist did not preserve only safe reporter fields';
  end if;
  if not exists (
    select 1
    from public.catalog_corrections
    where correction_type = 'source_issue'
      and proposed_payload = '{"productName":"Deep legacy product"}'::jsonb
      and client_context = '{}'::jsonb
  ) then
    raise exception 'deeply nested legacy correction was not minimized nonrecursively';
  end if;
  if not exists (
    select 1
    from public.catalog_corrections
    where correction_type = 'category_issue'
      and description is null
      and proposed_payload = '{"productName":"Oversized legacy payload"}'::jsonb
      and client_context = '{"route":"shelf_detail"}'::jsonb
  ) then
    raise exception 'unbounded legacy correction fields were not dropped while bounded allowlisted fields were preserved';
  end if;
  if (select count(*) from public.catalog_corrections where barcode = '036000291452') <> 1 then
    raise exception 'leading-zero EAN shape was not canonicalized to UPC-A';
  end if;
  if (select count(*) from public.catalog_corrections where barcode = '4006381333931') <> 1 then
    raise exception 'leading-zero GTIN-14 shape was not canonicalized to EAN-13';
  end if;
  if (select count(*) from public.catalog_corrections where barcode = '012345678905') <> 1 then
    raise exception 'two-zero-padded GTIN-14 shape was not canonicalized to UPC-A';
  end if;
  if (select count(*) from public.catalog_corrections where barcode = '96385074') <> 1 then
    raise exception 'six-zero-padded GTIN-14 shape was not canonicalized to GTIN-8';
  end if;
  if not private.catalog_gtin_is_valid('04006381333931')
     or private.catalog_gtin_is_canonical('04006381333931')
     or private.catalog_gtin_is_canonical('00012345678905')
     or private.catalog_gtin_is_canonical('00000096385074')
     or private.catalog_gtin_is_canonical('0036000291452')
     or not private.catalog_gtin_is_canonical('012345678905')
     or not private.catalog_gtin_is_canonical('10012345000017') then
    raise exception 'canonical GTIN helper does not distinguish checksum-valid padded forms';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.catalog_corrections'::regclass
      and conname = 'catalog_corrections_barcode_gtin'
      and convalidated
  ) then
    raise exception 'correction GTIN constraint was not validated';
  end if;
  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_constraint
    where conrelid = 'public.catalog_corrections'::pg_catalog.regclass
      and conname in (
        'catalog_corrections_payloads_no_barcode',
        'catalog_corrections_description_sanitized',
        'catalog_corrections_intake_idempotency'
      )
      and contype = 'c'
      and convalidated
  ) <> 3 then
    raise exception 'correction sanitization/idempotency constraints were not validated';
  end if;
  if (
    select pg_catalog.count(*)
    from public.products
    where id in (
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000014'
    )
      and status = 'active'
      and review_status = 'reviewed'
      and recommendation_eligible is true
  ) <> 2 then
    raise exception 'checksum-valid canonical product was incorrectly blocked';
  end if;
  if exists (
    select 1
    from public.products
    where id in (
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000013',
      '00000000-0000-4000-8000-000000000015',
      '00000000-0000-4000-8000-000000000016'
    )
      and (
        status <> 'blocked'
        or review_status <> 'blocked'
        or quality_grade <> 'blocked'
        or recommendation_eligible is not false
      )
  ) then
    raise exception 'invalid or noncanonical reviewed product was not blocked';
  end if;
  if exists (
    select 1
    from public.product_barcodes
    where barcode in (
      '123456789', '0036000291452', '04006381333931',
      '00012345678905', '00000096385074'
    )
      and review_status <> 'blocked'
  ) then
    raise exception 'invalid or noncanonical reviewed barcode mapping was not blocked';
  end if;
  if (
    select count(*)
    from private.catalog_serving_mutation_probe
    where relation_name = 'products'
  ) <> 5 or (
    select count(*)
    from private.catalog_serving_mutation_probe
    where relation_name = 'product_barcodes'
  ) <> 5 then
    raise exception 'reviewed-identity remediation bypassed served-state mutation triggers';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'catalog_launch_mutation_products'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.product_barcodes'::regclass
      and tgname = 'catalog_launch_mutation_barcodes'
      and not tgisinternal
  ) then
    raise exception 'served-state mutation trigger was not preserved';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_reviewed_active_barcode_gtin'
      and convalidated
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_barcodes'::regclass
      and conname = 'product_barcodes_reviewed_barcode_gtin'
      and convalidated
  ) then
    raise exception 'servable catalog GTIN constraints were not validated';
  end if;
  begin
    update public.product_barcodes
    set review_status = 'reviewed'
    where barcode = '123456789';
    raise exception 'invalid mapping entered the reviewed serving lane';
  exception
    when check_violation then null;
  end;
  begin
    update public.products
    set status = 'active', review_status = 'reviewed'
    where id = '00000000-0000-4000-8000-000000000012';
    raise exception 'noncanonical product entered the active reviewed serving lane';
  exception
    when check_violation then null;
  end;
  begin
    update public.product_barcodes
    set review_status = 'reviewed'
    where barcode = '04006381333931';
    raise exception 'padded GTIN-14 mapping entered the reviewed serving lane';
  exception
    when check_violation then null;
  end;
  begin
    update public.products
    set status = 'active', review_status = 'reviewed'
    where id = '00000000-0000-4000-8000-000000000013';
    raise exception 'padded GTIN-14 product entered the active reviewed serving lane';
  exception
    when check_violation then null;
  end;
  if has_function_privilege(
    'authenticated',
    'public.record_catalog_lookup_event(uuid,bigint,text,text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'authenticated event RPC execution remains granted';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.record_catalog_lookup_event(uuid,bigint,text,text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'service event RPC execution is missing';
  end if;
end;
$$;

select set_config('app.test_health_epoch', '7', false);

select public.record_catalog_lookup_event(
  '00000000-0000-4000-8000-000000000001',
  7,
  'barcode',
  'no_match',
  1,
  60
);

do $$
begin
  if not exists (
    select 1
    from public.catalog_lookup_events
    where created_at >= now() - interval '60 seconds'
      and lookup_type = 'barcode'
      and result = 'no_match'
      and query is null
      and barcode is null
      and matched_product_id is null
      and source_key is null
      and quality_grade is null
  ) then
    raise exception 'service RPC did not record an identity-free outcome';
  end if;

  begin
    perform public.record_catalog_lookup_event(
      '00000000-0000-4000-8000-000000000001',
      7,
      'barcode',
      'matched',
      1,
      60
    );
    raise exception 'event RPC rate ceiling did not reject';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CATALOG_LOOKUP_EVENT_RATE_LIMITED' then raise; end if;
  end;

  begin
    insert into public.catalog_lookup_events (
      user_id,
      lookup_type,
      query,
      result
    ) values (
      '00000000-0000-4000-8000-000000000001',
      'search',
      'must fail',
      'no_match'
    );
    raise exception 'identity constraint did not reject';
  exception
    when check_violation then null;
  end;
end;
$$;

set role service_role;

do $$
declare
  v_id uuid;
  v_status text;
  v_created_at timestamptz;
  v_created boolean;
  v_replay_id uuid;
  v_replay_status text;
  v_replay_created_at timestamptz;
  v_replay_created boolean;
  v_correction public.catalog_corrections%rowtype;
  v_padded_alias text;
begin
  select submitted.id, submitted.status, submitted.created_at, submitted.created
    into v_id, v_status, v_created_at, v_created
  from public.submit_catalog_correction(
    '00000000-0000-4000-8000-000000000001',
    7,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    null,
    '012345678905',
    'missing_product',
    'rehearsal valid correction',
    '{"productName":"Rehearsed catalog product","brand":"Rehearsal"}'::jsonb,
    '{"route":"phase9_catalog_scan_minimization"}'::jsonb
  ) as submitted;

  if v_id is null
     or v_status <> 'open'
     or v_created is not true
     or not pg_catalog.isfinite(v_created_at)
     or v_created_at > pg_catalog.now() then
    raise exception 'sealed correction RPC returned an invalid receipt';
  end if;

  select correction.*
    into v_correction
  from public.catalog_corrections as correction
  where correction.id = v_id;

  if not found then
    raise exception 'sealed correction RPC did not persist its receipt';
  end if;

  if v_correction.user_id <> '00000000-0000-4000-8000-000000000001'::uuid
     or v_correction.product_id is not null
     or v_correction.barcode <> '012345678905'
     or v_correction.correction_type <> 'missing_product'
     or v_correction.status <> 'open'
     or v_correction.description <> 'rehearsal valid correction'
     or v_correction.proposed_payload <> '{"productName":"Rehearsed catalog product","brand":"Rehearsal"}'::jsonb
     or v_correction.client_context <> '{"route":"phase9_catalog_scan_minimization"}'::jsonb
     or v_correction.assigned_to is not null
     or v_correction.resolved_by is not null
     or v_correction.resolution_note is not null
     or v_correction.source_id is not null
     or v_correction.operator_reviewed_at is not null
     or v_correction.operator_reviewed_by is not null
     or v_correction.operator_review_note is not null
     or v_correction.intake_request_id <>
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
     or v_correction.intake_health_epoch <> 7
     or v_correction.intake_request_digest !~ '^[0-9a-f]{64}$'
     or v_correction.created_at is distinct from v_created_at
     or not pg_catalog.isfinite(v_correction.created_at)
     or not pg_catalog.isfinite(v_correction.updated_at)
     or v_correction.created_at > pg_catalog.now()
     or v_correction.updated_at > pg_catalog.now() then
    raise exception 'sealed correction RPC did not persist the exact fixed-field contract';
  end if;

  select submitted.id, submitted.status, submitted.created_at, submitted.created
    into v_replay_id, v_replay_status, v_replay_created_at, v_replay_created
  from public.submit_catalog_correction(
    '00000000-0000-4000-8000-000000000001',
    7,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    null,
    '012345678905',
    'missing_product',
    'rehearsal valid correction',
    '{"productName":"Rehearsed catalog product","brand":"Rehearsal"}'::jsonb,
    '{"route":"phase9_catalog_scan_minimization"}'::jsonb
  ) as submitted;

  if v_replay_id is distinct from v_id
     or v_replay_status <> 'open'
     or v_replay_created_at is distinct from v_created_at
     or v_replay_created is not false
     or (
       select count(*)
       from public.catalog_corrections
       where user_id = '00000000-0000-4000-8000-000000000001'
         and intake_request_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     ) <> 1 then
    raise exception 'exact report retry did not return one immutable receipt';
  end if;

  perform public.rehearsal_triage_catalog_correction(v_id);

  select submitted.id, submitted.status, submitted.created_at, submitted.created
    into v_replay_id, v_replay_status, v_replay_created_at, v_replay_created
  from public.submit_catalog_correction(
    '00000000-0000-4000-8000-000000000001',
    7,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    null,
    '012345678905',
    'missing_product',
    'rehearsal valid correction',
    '{"productName":"Rehearsed catalog product","brand":"Rehearsal"}'::jsonb,
    '{"route":"phase9_catalog_scan_minimization"}'::jsonb
  ) as submitted;

  if v_replay_id is distinct from v_id
     or v_replay_status <> 'triaged'
     or v_replay_created_at is distinct from v_created_at
     or v_replay_created is not false then
    raise exception 'replayed report receipt did not expose current bounded status';
  end if;

  begin
    perform public.submit_catalog_correction(
      '00000000-0000-4000-8000-000000000001',
      7,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      null,
      '012345678905',
      'missing_product',
      'changed request body',
      '{"productName":"Rehearsed catalog product","brand":"Rehearsal"}'::jsonb,
      '{"route":"phase9_catalog_scan_minimization"}'::jsonb
    );
    raise exception 'conflicting report request-id reuse did not reject';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'CATALOG_REPORT_IDEMPOTENCY_CONFLICT' then raise; end if;
  end;

  begin
    perform public.submit_catalog_correction(
      '00000000-0000-4000-8000-000000000001',
      7,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      null,
      null,
      'missing_product',
      null,
      '{}'::jsonb,
      '{}'::jsonb
    );
    raise exception 'identity-free correction did not reject';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'CATALOG_REPORT_INPUT_INVALID' then raise; end if;
  end;

  foreach v_padded_alias in array array[
    '04006381333931',
    '00012345678905',
    '00000096385074'
  ] loop
    begin
      perform public.submit_catalog_correction(
        '00000000-0000-4000-8000-000000000001',
        7,
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        null,
        v_padded_alias,
        'missing_product',
        null,
        '{"productName":"Padded GTIN-14 probe"}'::jsonb,
        '{"route":"phase9_catalog_scan_minimization"}'::jsonb
      );
      raise exception 'padded GTIN-14 correction identity did not reject: %', v_padded_alias;
    exception
      when sqlstate '22023' then
        if sqlerrm <> 'CATALOG_REPORT_INPUT_INVALID' then raise; end if;
    end;
  end loop;

  begin
    perform public.submit_catalog_correction(
      '00000000-0000-4000-8000-000000000001',
      7,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      null,
      '036000291452',
      'missing_product',
      null,
      '{"productName":"Nested barcode probe","brand":{"BARCODE":"must-fail"}}'::jsonb,
      '{"route":"phase9_catalog_scan_minimization"}'::jsonb
    );
    raise exception 'nested case-folded proposed-payload barcode did not reject';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'CATALOG_REPORT_INPUT_INVALID' then raise; end if;
  end;

  begin
    perform public.submit_catalog_correction(
      '00000000-0000-4000-8000-000000000001',
      7,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      null,
      '036000291452',
      'missing_product',
      null,
      '{"productName":"Nested context probe"}'::jsonb,
      '{"route":{"barCode":"must-fail"}}'::jsonb
    );
    raise exception 'nested case-folded client-context barcode did not reject';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'CATALOG_REPORT_INPUT_INVALID' then raise; end if;
  end;
end;
$$;

reset role;

select 'catalog-scan-minimization-postgres-rehearsal: pass' as result;
