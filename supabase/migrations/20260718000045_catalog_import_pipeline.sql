-- Restartable, staged catalog ingestion for OPT-117.
-- Partial imports remain invisible until promote_catalog_import commits.

create table if not exists public.catalog_import_versions (
  id                       uuid primary key default gen_random_uuid(),
  source_id                uuid not null references public.catalog_sources (id) on delete restrict,
  source_revision          text not null check (length(source_revision) between 1 and 160),
  artifact_uri             text,
  artifact_sha256          text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  importer_version         text not null check (length(importer_version) between 1 and 80),
  status                   text not null default 'running'
    check (status in ('running', 'ready', 'active', 'superseded', 'failed')),
  checkpoint_line          bigint not null default 0 check (checkpoint_line >= 0),
  accepted_record_count    bigint not null default 0 check (accepted_record_count >= 0),
  rejected_record_count    bigint not null default 0 check (rejected_record_count >= 0),
  staged_product_count     bigint not null default 0 check (staged_product_count >= 0),
  manifest                 jsonb not null default '{}'::jsonb,
  previous_active_import_id uuid references public.catalog_import_versions (id) on delete set null,
  started_at               timestamptz not null default clock_timestamp(),
  ready_at                 timestamptz,
  activated_at             timestamptz,
  finished_at              timestamptz,
  created_at               timestamptz not null default clock_timestamp(),
  unique (source_id, source_revision, artifact_sha256)
);

create index if not exists catalog_import_versions_source_status_idx
  on public.catalog_import_versions (source_id, status, created_at desc);

create table if not exists public.catalog_import_staged_products (
  import_id            uuid not null references public.catalog_import_versions (id) on delete cascade,
  canonical_identity   text not null check (length(canonical_identity) between 5 and 180),
  line_number          bigint not null check (line_number > 0),
  barcode              text not null check (barcode ~ '^[0-9]{8,14}$'),
  name                 text not null check (length(name) between 1 and 240),
  brand                text check (brand is null or length(brand) between 1 and 160),
  category             text check (category is null or length(category) between 1 and 80),
  ingredients_text     text check (ingredients_text is null or length(ingredients_text) <= 32768),
  source_ref           text not null check (length(source_ref) between 1 and 180),
  source_url           text check (source_url is null or length(source_url) <= 2048),
  source_snapshot_date date,
  quality_grade        text not null
    check (quality_grade in ('verified', 'usable', 'limited', 'unverified', 'blocked')),
  payload_sha256       text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  staged_at            timestamptz not null default clock_timestamp(),
  primary key (import_id, canonical_identity)
);

create index if not exists catalog_import_staged_products_line_idx
  on public.catalog_import_staged_products (import_id, line_number);

create table if not exists public.catalog_import_batch_receipts (
  import_id            uuid not null references public.catalog_import_versions (id) on delete cascade,
  expected_checkpoint  bigint not null check (expected_checkpoint >= 0),
  last_line            bigint not null check (last_line > expected_checkpoint),
  batch_sha256         text not null check (batch_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_count       int not null check (accepted_count >= 0),
  rejected_count       int not null check (rejected_count >= 0),
  created_at           timestamptz not null default clock_timestamp(),
  primary key (import_id, expected_checkpoint),
  unique (import_id, last_line)
);

create table if not exists public.catalog_active_imports (
  source_id    uuid primary key references public.catalog_sources (id) on delete restrict,
  import_id    uuid not null unique references public.catalog_import_versions (id) on delete restrict,
  activated_at timestamptz not null default clock_timestamp()
);

alter table public.product_ingredient_lists
  add column if not exists import_version_id uuid
    references public.catalog_import_versions (id) on delete set null;

create unique index if not exists product_ingredient_lists_import_version_uidx
  on public.product_ingredient_lists (product_id, import_version_id);

alter table public.catalog_import_versions enable row level security;
alter table public.catalog_import_staged_products enable row level security;
alter table public.catalog_import_batch_receipts enable row level security;
alter table public.catalog_active_imports enable row level security;

revoke all on table public.catalog_import_versions from public, anon, authenticated;
revoke all on table public.catalog_import_staged_products from public, anon, authenticated;
revoke all on table public.catalog_import_batch_receipts from public, anon, authenticated;
revoke all on table public.catalog_active_imports from public, anon, authenticated;

create or replace function public.begin_catalog_import(
  p_source_key text,
  p_source_revision text,
  p_artifact_uri text,
  p_artifact_sha256 text,
  p_importer_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_import public.catalog_import_versions%rowtype;
begin
  if p_source_revision is null or length(trim(p_source_revision)) not between 1 and 160 then
    raise exception 'CATALOG_IMPORT_REVISION_INVALID';
  end if;
  if p_artifact_sha256 is null or p_artifact_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'CATALOG_IMPORT_SHA256_INVALID';
  end if;
  if p_importer_version is null or length(trim(p_importer_version)) not between 1 and 80 then
    raise exception 'CATALOG_IMPORTER_VERSION_INVALID';
  end if;

  select id into v_source_id
  from public.catalog_sources
  where source_key = p_source_key;
  if v_source_id is null then raise exception 'CATALOG_IMPORT_SOURCE_UNKNOWN'; end if;

  insert into public.catalog_import_versions (
    source_id, source_revision, artifact_uri, artifact_sha256, importer_version
  ) values (
    v_source_id, trim(p_source_revision), nullif(trim(p_artifact_uri), ''),
    p_artifact_sha256, trim(p_importer_version)
  )
  on conflict (source_id, source_revision, artifact_sha256) do update
    set artifact_uri = coalesce(excluded.artifact_uri, public.catalog_import_versions.artifact_uri),
        status = case
          when public.catalog_import_versions.status = 'failed' then 'running'
          else public.catalog_import_versions.status
        end,
        finished_at = case
          when public.catalog_import_versions.status = 'failed' then null
          else public.catalog_import_versions.finished_at
        end
  returning * into v_import;

  return jsonb_build_object(
    'importId', v_import.id,
    'status', v_import.status,
    'checkpointLine', v_import.checkpoint_line,
    'acceptedRecords', v_import.accepted_record_count,
    'rejectedRecords', v_import.rejected_record_count,
    'stagedProducts', v_import.staged_product_count
  );
end;
$$;

create or replace function public.stage_catalog_import_batch(
  p_import_id uuid,
  p_expected_checkpoint bigint,
  p_last_line bigint,
  p_rows jsonb,
  p_rejected_count int,
  p_batch_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.catalog_import_versions%rowtype;
  v_accepted_count int;
  v_staged_count bigint;
  v_receipt public.catalog_import_batch_receipts%rowtype;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'CATALOG_IMPORT_ROWS_INVALID'; end if;
  v_accepted_count := jsonb_array_length(p_rows);
  if v_accepted_count > 500 then raise exception 'CATALOG_IMPORT_BATCH_TOO_LARGE'; end if;
  if p_rejected_count < 0 then raise exception 'CATALOG_IMPORT_REJECT_COUNT_INVALID'; end if;
  if p_last_line <= p_expected_checkpoint then raise exception 'CATALOG_IMPORT_CHECKPOINT_INVALID'; end if;
  if v_accepted_count + p_rejected_count <> p_last_line - p_expected_checkpoint then
    raise exception 'CATALOG_IMPORT_BATCH_CARDINALITY_INVALID';
  end if;
  if p_batch_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'CATALOG_IMPORT_BATCH_SHA_INVALID'; end if;

  select * into v_import
  from public.catalog_import_versions
  where id = p_import_id
  for update;
  if not found then raise exception 'CATALOG_IMPORT_UNKNOWN'; end if;

  if v_import.checkpoint_line = p_last_line then
    select * into v_receipt
    from public.catalog_import_batch_receipts
    where import_id = p_import_id
      and expected_checkpoint = p_expected_checkpoint
      and last_line = p_last_line
      and batch_sha256 = p_batch_sha256;
    if not found then raise exception 'CATALOG_IMPORT_REPLAY_MISMATCH'; end if;
    return jsonb_build_object(
      'checkpointLine', v_import.checkpoint_line,
      'acceptedRecords', v_import.accepted_record_count,
      'rejectedRecords', v_import.rejected_record_count,
      'stagedProducts', v_import.staged_product_count,
      'replayed', true
    );
  end if;

  if v_import.status <> 'running' then raise exception 'CATALOG_IMPORT_NOT_RUNNING'; end if;
  if v_import.checkpoint_line <> p_expected_checkpoint then
    raise exception 'CATALOG_IMPORT_CHECKPOINT_CONFLICT';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(line_number bigint)
    where row.line_number <= p_expected_checkpoint or row.line_number > p_last_line
  ) then
    raise exception 'CATALOG_IMPORT_ROW_LINE_INVALID';
  end if;

  with parsed_rows as (
    select *
    from jsonb_to_recordset(p_rows) as row(
      canonical_identity text,
      line_number bigint,
      barcode text,
      name text,
      brand text,
      category text,
      ingredients_text text,
      source_ref text,
      source_url text,
      source_snapshot_date date,
      quality_grade text,
      payload_sha256 text
    )
  ), deduplicated_rows as (
    select distinct on (row.canonical_identity) row.*
    from parsed_rows row
    order by row.canonical_identity, row.line_number desc
  )
  insert into public.catalog_import_staged_products (
    import_id, canonical_identity, line_number, barcode, name, brand, category,
    ingredients_text, source_ref, source_url, source_snapshot_date, quality_grade,
    payload_sha256
  )
  select
    p_import_id, row.canonical_identity, row.line_number, row.barcode, row.name,
    row.brand, row.category, row.ingredients_text, row.source_ref, row.source_url,
    row.source_snapshot_date, row.quality_grade, row.payload_sha256
  from deduplicated_rows row
  on conflict (import_id, canonical_identity) do update
    set line_number = excluded.line_number,
        barcode = excluded.barcode,
        name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        ingredients_text = excluded.ingredients_text,
        source_ref = excluded.source_ref,
        source_url = excluded.source_url,
        source_snapshot_date = excluded.source_snapshot_date,
        quality_grade = excluded.quality_grade,
        payload_sha256 = excluded.payload_sha256,
        staged_at = clock_timestamp()
    where excluded.line_number > public.catalog_import_staged_products.line_number;

  insert into public.catalog_import_batch_receipts (
    import_id, expected_checkpoint, last_line, batch_sha256, accepted_count, rejected_count
  ) values (
    p_import_id, p_expected_checkpoint, p_last_line, p_batch_sha256,
    v_accepted_count, p_rejected_count
  );

  select count(*) into v_staged_count
  from public.catalog_import_staged_products
  where import_id = p_import_id;

  update public.catalog_import_versions
  set checkpoint_line = p_last_line,
      accepted_record_count = accepted_record_count + v_accepted_count,
      rejected_record_count = rejected_record_count + p_rejected_count,
      staged_product_count = v_staged_count
  where id = p_import_id
  returning * into v_import;

  return jsonb_build_object(
    'checkpointLine', v_import.checkpoint_line,
    'acceptedRecords', v_import.accepted_record_count,
    'rejectedRecords', v_import.rejected_record_count,
    'stagedProducts', v_import.staged_product_count,
    'replayed', false
  );
end;
$$;

create or replace function public.ready_catalog_import(
  p_import_id uuid,
  p_input_sha256 text,
  p_input_records bigint,
  p_accepted_records bigint,
  p_rejected_records bigint,
  p_manifest jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.catalog_import_versions%rowtype;
begin
  select * into v_import
  from public.catalog_import_versions
  where id = p_import_id
  for update;
  if not found then raise exception 'CATALOG_IMPORT_UNKNOWN'; end if;
  if v_import.status not in ('running', 'ready') then raise exception 'CATALOG_IMPORT_NOT_READYABLE'; end if;
  if v_import.artifact_sha256 <> p_input_sha256 then raise exception 'CATALOG_IMPORT_ARTIFACT_MISMATCH'; end if;
  if v_import.checkpoint_line <> p_input_records then raise exception 'CATALOG_IMPORT_INCOMPLETE'; end if;
  if v_import.accepted_record_count <> p_accepted_records or
     v_import.rejected_record_count <> p_rejected_records or
     p_accepted_records + p_rejected_records <> p_input_records then
    raise exception 'CATALOG_IMPORT_COUNT_MISMATCH';
  end if;
  if jsonb_typeof(p_manifest) <> 'object' then raise exception 'CATALOG_IMPORT_MANIFEST_INVALID'; end if;

  update public.catalog_import_versions
  set status = 'ready',
      manifest = p_manifest,
      ready_at = coalesce(ready_at, clock_timestamp()),
      finished_at = null
  where id = p_import_id
  returning * into v_import;

  return jsonb_build_object(
    'importId', v_import.id,
    'status', v_import.status,
    'checkpointLine', v_import.checkpoint_line,
    'acceptedRecords', v_import.accepted_record_count,
    'rejectedRecords', v_import.rejected_record_count,
    'stagedProducts', v_import.staged_product_count
  );
end;
$$;

create or replace function public.promote_catalog_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.catalog_import_versions%rowtype;
  v_source public.catalog_sources%rowtype;
  v_previous uuid;
  v_active_count bigint;
begin
  select * into v_import
  from public.catalog_import_versions
  where id = p_import_id
  for update;
  if not found then raise exception 'CATALOG_IMPORT_UNKNOWN'; end if;
  if v_import.status = 'active' then
    return jsonb_build_object('importId', v_import.id, 'status', 'active', 'replayed', true);
  end if;
  if v_import.status <> 'ready' then raise exception 'CATALOG_IMPORT_NOT_READY'; end if;

  select * into v_source from public.catalog_sources where id = v_import.source_id;
  if not v_source.production_approved then raise exception 'CATALOG_IMPORT_SOURCE_NOT_APPROVED'; end if;
  perform pg_advisory_xact_lock(hashtext('catalog-import:' || v_source.source_key));

  select import_id into v_previous
  from public.catalog_active_imports
  where source_id = v_import.source_id
  for update;

  insert into public.products (
    barcode, name, brand, category, is_curated, source, source_ref, imported_at,
    canonical_name, display_name, normalized_brand_name, status, source_priority,
    review_status, quality_grade, source_id, source_snapshot_date, source_url,
    last_source_refresh_at, ingredient_parse_status
  )
  select
    staged.barcode, staged.name, staged.brand, staged.category, false,
    v_source.source_key, staged.source_ref, clock_timestamp(), staged.name,
    staged.name, lower(staged.brand), 'active', 200, 'unreviewed',
    staged.quality_grade, v_source.id, staged.source_snapshot_date,
    staged.source_url, clock_timestamp(), 'not_parsed'
  from public.catalog_import_staged_products staged
  where staged.import_id = p_import_id
  on conflict (barcode) do update
    set name = excluded.name,
        brand = excluded.brand,
        category = excluded.category,
        source_ref = excluded.source_ref,
        imported_at = excluded.imported_at,
        canonical_name = excluded.canonical_name,
        display_name = excluded.display_name,
        normalized_brand_name = excluded.normalized_brand_name,
        status = 'active',
        review_status = excluded.review_status,
        quality_grade = excluded.quality_grade,
        source_snapshot_date = excluded.source_snapshot_date,
        source_url = excluded.source_url,
        last_source_refresh_at = excluded.last_source_refresh_at
    where public.products.source_id = excluded.source_id;

  update public.products product
  set status = 'retired', last_source_refresh_at = clock_timestamp()
  where product.source_id = v_source.id
    and not exists (
      select 1 from public.catalog_import_staged_products staged
      where staged.import_id = p_import_id and staged.barcode = product.barcode
    );

  insert into public.product_barcodes (
    barcode, product_id, source_id, confidence, review_status, last_seen_at
  )
  select product.barcode, product.id, v_source.id, 1, 'unreviewed', clock_timestamp()
  from public.products product
  join public.catalog_import_staged_products staged
    on staged.import_id = p_import_id and staged.barcode = product.barcode
  where product.source_id = v_source.id
  on conflict (barcode) do update
    set product_id = excluded.product_id,
        source_id = excluded.source_id,
        confidence = excluded.confidence,
        last_seen_at = excluded.last_seen_at
    where public.product_barcodes.source_id = excluded.source_id;

  insert into public.product_ingredient_lists (
    product_id, source_id, raw_text, locale, parse_status, parse_confidence,
    parser_version, token_count, unmatched_count, source_snapshot_date,
    review_status, import_version_id
  )
  select
    product.id, v_source.id, staged.ingredients_text, 'en', 'not_parsed', 0,
    v_import.importer_version, 0, 0, staged.source_snapshot_date, 'unreviewed',
    p_import_id
  from public.catalog_import_staged_products staged
  join public.products product
    on product.barcode = staged.barcode and product.source_id = v_source.id
  where staged.import_id = p_import_id and staged.ingredients_text is not null
  on conflict (product_id, import_version_id) do update
    set raw_text = excluded.raw_text,
        source_snapshot_date = excluded.source_snapshot_date,
        updated_at = clock_timestamp();

  if v_previous is not null and v_previous <> p_import_id then
    update public.catalog_import_versions
    set status = 'superseded', finished_at = clock_timestamp()
    where id = v_previous and status = 'active';
  end if;

  insert into public.catalog_active_imports (source_id, import_id, activated_at)
  values (v_source.id, p_import_id, clock_timestamp())
  on conflict (source_id) do update
    set import_id = excluded.import_id, activated_at = excluded.activated_at;

  update public.catalog_import_versions
  set status = 'active',
      previous_active_import_id = v_previous,
      activated_at = coalesce(activated_at, clock_timestamp()),
      finished_at = clock_timestamp()
  where id = p_import_id;

  analyze public.products;
  analyze public.product_barcodes;

  select count(*) into v_active_count
  from public.products
  where source_id = v_source.id and status = 'active';

  return jsonb_build_object(
    'importId', p_import_id,
    'status', 'active',
    'previousActiveImportId', v_previous,
    'activeProducts', v_active_count,
    'replayed', false
  );
end;
$$;

revoke all on function public.begin_catalog_import(text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.stage_catalog_import_batch(uuid, bigint, bigint, jsonb, int, text)
  from public, anon, authenticated;
revoke all on function public.ready_catalog_import(uuid, text, bigint, bigint, bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.promote_catalog_import(uuid)
  from public, anon, authenticated;

grant execute on function public.begin_catalog_import(text, text, text, text, text)
  to service_role;
grant execute on function public.stage_catalog_import_batch(uuid, bigint, bigint, jsonb, int, text)
  to service_role;
grant execute on function public.ready_catalog_import(uuid, text, bigint, bigint, bigint, jsonb)
  to service_role;
grant execute on function public.promote_catalog_import(uuid)
  to service_role;

comment on table public.catalog_import_versions is
  'Durable source-version/checkpoint/promotion metadata for restartable catalog imports.';
comment on table public.catalog_import_staged_products is
  'Version-isolated normalized products; never read by the mobile catalog surface.';
comment on table public.catalog_import_batch_receipts is
  'Idempotency receipts for commit-then-response-loss safe importer batch retries.';
comment on table public.catalog_active_imports is
  'Atomic active-version pointer and rollback predecessor metadata per catalog source.';
