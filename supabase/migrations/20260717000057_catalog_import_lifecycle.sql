-- =============================================================================
-- 0057 · Reviewed, replay-safe catalog import lifecycle
-- =============================================================================
-- Source approval is necessary but not sufficient to publish a catalog row.
-- This migration separates transport, deterministic staging, human review,
-- projection, and non-destructive rollback. Runtime service credentials may
-- move and verify sealed evidence, but they are deliberately not catalog
-- reviewers or release operators.

create schema if not exists private;

do $$
begin
  if pg_catalog.current_setting('server_encoding') <> 'UTF8' then
    raise exception 'CATALOG_IMPORT_UTF8_REQUIRED' using errcode = '55000';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_collation as collations
    where collations.collname = 'und-x-icu'
      and collations.collprovider = 'i'
      and collations.collencoding in (-1, 6)
  ) then
    raise exception 'CATALOG_IMPORT_ICU_COLLATION_REQUIRED' using errcode = '55000';
  end if;
end;
$$;

-- Keep the original batch relation compatible with earlier import tooling,
-- while making every new production batch evidence-bound and replay-safe.
alter table public.catalog_import_batches
  drop constraint if exists catalog_import_batches_status_check;

alter table public.catalog_import_batches
  add constraint catalog_import_batches_status_check
    check (status in (
      'planned', 'running', 'succeeded', 'failed', 'blocked',
      'finalized', 'verified', 'reviewed', 'promoted', 'retired'
    )),
  add column if not exists operation_key text,
  add column if not exists request_sha256 text,
  add column if not exists artifact_kind text,
  add column if not exists territory text,
  add column if not exists manifest_sha256 text,
  add column if not exists source_policy_sha256 text,
  add column if not exists source_approval_sha256 text,
  add column if not exists transform_sha256 text,
  add column if not exists transformed_payload_sha256 text,
  add column if not exists qa_report_sha256 text,
  add column if not exists qa_blocker_count integer not null default 0,
  add column if not exists qa_warning_count integer not null default 0,
  add column if not exists expected_record_count integer,
  add column if not exists staged_record_count integer not null default 0,
  add column if not exists accepted_record_count integer not null default 0,
  add column if not exists rejected_record_count integer not null default 0,
  add column if not exists duplicate_record_count integer not null default 0,
  add column if not exists conflict_record_count integer not null default 0,
  add column if not exists records_sha256 text,
  add column if not exists candidates_sha256 text,
  add column if not exists finalize_operation_key text,
  add column if not exists finalize_request_sha256 text,
  add column if not exists verification_operation_key text,
  add column if not exists verification_request_sha256 text,
  add column if not exists verification_evidence_sha256 text,
  add column if not exists review_operation_key text,
  add column if not exists review_request_sha256 text,
  add column if not exists review_ticket text,
  add column if not exists review_evidence_sha256 text,
  add column if not exists reviewed_by text,
  add column if not exists reviewer_ids text[],
  add column if not exists finalized_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists promoted_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists rollback_reason text;

alter table public.catalog_import_batches
  add constraint catalog_import_batches_operation_key_shape_check
    check (operation_key is null or operation_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'),
  add constraint catalog_import_batches_artifact_kind_check
    check (artifact_kind is null or artifact_kind in ('production', 'candidate', 'fixture')),
  add constraint catalog_import_batches_territory_check
    check (territory is null or territory ~ '^[A-Z]{2}$'),
  add constraint catalog_import_batches_evidence_hashes_check
    check (
      (request_sha256 is null or request_sha256 ~ '^[a-f0-9]{64}$')
      and (artifact_sha256 is null or artifact_sha256 ~ '^[a-f0-9]{64}$')
      and (manifest_sha256 is null or manifest_sha256 ~ '^[a-f0-9]{64}$')
      and (source_policy_sha256 is null or source_policy_sha256 ~ '^[a-f0-9]{64}$')
      and (source_approval_sha256 is null or source_approval_sha256 ~ '^[a-f0-9]{64}$')
      and (transform_sha256 is null or transform_sha256 ~ '^[a-f0-9]{64}$')
      and (transformed_payload_sha256 is null or transformed_payload_sha256 ~ '^[a-f0-9]{64}$')
      and (qa_report_sha256 is null or qa_report_sha256 ~ '^[a-f0-9]{64}$')
      and (records_sha256 is null or records_sha256 ~ '^[a-f0-9]{64}$')
      and (candidates_sha256 is null or candidates_sha256 ~ '^[a-f0-9]{64}$')
      and (finalize_request_sha256 is null or finalize_request_sha256 ~ '^[a-f0-9]{64}$')
      and (verification_request_sha256 is null or verification_request_sha256 ~ '^[a-f0-9]{64}$')
      and (verification_evidence_sha256 is null or verification_evidence_sha256 ~ '^[a-f0-9]{64}$')
      and (review_request_sha256 is null or review_request_sha256 ~ '^[a-f0-9]{64}$')
      and (review_evidence_sha256 is null or review_evidence_sha256 ~ '^[a-f0-9]{64}$')
    ),
  add constraint catalog_import_batches_lifecycle_counts_check
    check (
      qa_blocker_count >= 0 and qa_warning_count >= 0
      and (expected_record_count is null or expected_record_count between 1 and 100000)
      and staged_record_count >= 0 and accepted_record_count >= 0
      and rejected_record_count >= 0 and duplicate_record_count >= 0
      and conflict_record_count >= 0
    ),
  add constraint catalog_import_batches_reviewer_ids_check check (
    reviewer_ids is null or (
      pg_catalog.cardinality(reviewer_ids) = 2
      and reviewer_ids[1] is not null and reviewer_ids[2] is not null
      and reviewer_ids[1] <> reviewer_ids[2]
      and reviewer_ids[1] ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
      and reviewer_ids[2] ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
      and pg_catalog.length(pg_catalog.array_to_string(reviewer_ids, '+')) <= 200
    )
  );

create unique index if not exists catalog_import_batches_operation_key_uidx
  on public.catalog_import_batches (operation_key)
  where operation_key is not null;
create unique index if not exists catalog_import_batches_finalize_operation_uidx
  on public.catalog_import_batches (finalize_operation_key)
  where finalize_operation_key is not null;
create unique index if not exists catalog_import_batches_verification_operation_uidx
  on public.catalog_import_batches (verification_operation_key)
  where verification_operation_key is not null;
create unique index if not exists catalog_import_batches_review_operation_uidx
  on public.catalog_import_batches (review_operation_key)
  where review_operation_key is not null;

-- Sealed receipts prove which exact chunks were accepted. Staged payloads are
-- never a serving surface and become immutable once finalization begins.
create table private.catalog_import_chunk_receipts (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references public.catalog_import_batches (id) on delete restrict,
  operation_key         text not null,
  request_sha256        text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  chunk_ordinal         integer not null check (chunk_ordinal > 0),
  first_record_ordinal  integer not null check (first_record_ordinal > 0),
  record_count          integer not null check (record_count between 1 and 500),
  chunk_sha256          text not null check (chunk_sha256 ~ '^[a-f0-9]{64}$'),
  accepted_at           timestamptz not null default now(),
  unique (batch_id, chunk_ordinal),
  unique (operation_key)
);

create table private.catalog_import_staged_records (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid not null references public.catalog_import_batches (id) on delete restrict,
  record_ordinal      integer not null check (record_ordinal > 0),
  record_kind         text not null check (record_kind in ('product', 'ingredient')),
  natural_key         text not null,
  source_payload      jsonb not null check (jsonb_typeof(source_payload) = 'object'),
  normalized_payload  jsonb not null check (jsonb_typeof(normalized_payload) = 'object'),
  record_sha256       text not null check (record_sha256 ~ '^[a-f0-9]{64}$'),
  disposition         text not null default 'pending'
    check (disposition in ('pending', 'accepted', 'rejected', 'duplicate', 'conflict')),
  sealed_at           timestamptz,
  created_at          timestamptz not null default now(),
  unique (batch_id, record_ordinal)
);
create index catalog_import_staged_records_natural_key_idx
  on private.catalog_import_staged_records (batch_id, record_kind, natural_key);

create table private.catalog_import_review_events (
  id                       uuid primary key default gen_random_uuid(),
  batch_id                 uuid not null references public.catalog_import_batches (id) on delete restrict,
  staged_record_id         uuid not null references private.catalog_import_staged_records (id) on delete restrict,
  decision                 text not null check (decision in ('accepted', 'rejected')),
  reason                   text not null,
  review_ticket            text not null,
  reviewed_by              text not null,
  review_evidence_sha256   text not null check (review_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  request_sha256           text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  reviewed_at              timestamptz not null default now(),
  unique (batch_id, staged_record_id)
);

create table private.catalog_import_conflicts (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid not null references public.catalog_import_batches (id) on delete restrict,
  staged_record_id    uuid not null references private.catalog_import_staged_records (id) on delete restrict,
  conflict_type       text not null check (conflict_type in ('batch_key_mismatch', 'existing_natural_key')),
  natural_key         text not null,
  existing_entity_id text,
  conflict_sha256     text not null check (conflict_sha256 ~ '^[a-f0-9]{64}$'),
  created_at          timestamptz not null default now(),
  unique (batch_id, staged_record_id, conflict_type, natural_key)
);

create table private.catalog_import_promotion_events (
  id                       uuid primary key default gen_random_uuid(),
  batch_id                 uuid not null references public.catalog_import_batches (id) on delete restrict,
  event_type               text not null check (event_type in ('promotion', 'rollback')),
  operation_key            text not null,
  request_sha256           text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  actor                    text not null,
  review_ticket            text not null,
  review_evidence_sha256   text not null check (review_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  reason                   text,
  affected_entity_count    integer not null default 0 check (affected_entity_count >= 0),
  created_at               timestamptz not null default now(),
  unique (batch_id, event_type),
  unique (operation_key)
);

create table private.catalog_import_entity_revisions (
  id                       uuid primary key default gen_random_uuid(),
  batch_id                 uuid not null references public.catalog_import_batches (id) on delete restrict,
  staged_record_id         uuid references private.catalog_import_staged_records (id) on delete restrict,
  promotion_event_id       uuid not null references private.catalog_import_promotion_events (id) on delete restrict,
  entity_type              text not null check (entity_type in ('product', 'barcode', 'ingredient_list', 'ingredient', 'synonym')),
  entity_id                text not null,
  revision_number          integer not null check (revision_number > 0),
  revision_action          text not null check (revision_action in ('inserted', 'retired')),
  projection_sha256        text not null check (projection_sha256 ~ '^[a-f0-9]{64}$'),
  projection_snapshot      jsonb not null check (jsonb_typeof(projection_snapshot) = 'object'),
  created_at               timestamptz not null default now(),
  unique (entity_type, entity_id, revision_number)
);

create table private.catalog_import_batch_effects (
  id                       uuid primary key default gen_random_uuid(),
  batch_id                 uuid not null references public.catalog_import_batches (id) on delete restrict,
  staged_record_id         uuid references private.catalog_import_staged_records (id) on delete restrict,
  promotion_event_id       uuid not null references private.catalog_import_promotion_events (id) on delete restrict,
  effect_type              text not null check (effect_type in ('inserted', 'retired')),
  entity_type              text not null check (entity_type in ('product', 'barcode', 'ingredient_list', 'ingredient', 'synonym')),
  entity_id                text not null,
  before_sha256            text check (before_sha256 is null or before_sha256 ~ '^[a-f0-9]{64}$'),
  after_sha256             text not null check (after_sha256 ~ '^[a-f0-9]{64}$'),
  created_at               timestamptz not null default now(),
  unique (promotion_event_id, effect_type, entity_type, entity_id)
);

-- Every promoted projection carries direct batch/record/hash lineage. Existing
-- pre-lifecycle rows remain nullable and must still satisfy the live serving
-- gates installed by migration 0056.
alter table public.products
  add column if not exists import_batch_id uuid references public.catalog_import_batches (id) on delete restrict,
  add column if not exists import_staged_record_id uuid references private.catalog_import_staged_records (id) on delete restrict,
  add column if not exists import_record_ordinal integer,
  add column if not exists import_record_sha256 text,
  add column if not exists import_projection_status text,
  add column if not exists retired_import_natural_key text;

alter table public.ingredients
  add column if not exists import_batch_id uuid references public.catalog_import_batches (id) on delete restrict,
  add column if not exists import_staged_record_id uuid references private.catalog_import_staged_records (id) on delete restrict,
  add column if not exists import_record_ordinal integer,
  add column if not exists import_record_sha256 text,
  add column if not exists import_projection_status text,
  add column if not exists retired_import_natural_key text;

alter table public.product_barcodes
  add column if not exists import_batch_id uuid references public.catalog_import_batches (id) on delete restrict,
  add column if not exists import_staged_record_id uuid references private.catalog_import_staged_records (id) on delete restrict,
  add column if not exists import_record_ordinal integer,
  add column if not exists import_record_sha256 text,
  add column if not exists import_projection_status text,
  add column if not exists import_entity_id uuid,
  add column if not exists retired_import_natural_key text;

alter table public.ingredient_synonyms
  add column if not exists import_batch_id uuid references public.catalog_import_batches (id) on delete restrict,
  add column if not exists import_staged_record_id uuid references private.catalog_import_staged_records (id) on delete restrict,
  add column if not exists import_record_ordinal integer,
  add column if not exists import_record_sha256 text,
  add column if not exists import_projection_status text,
  add column if not exists retired_import_natural_key text;

alter table public.product_ingredient_lists
  add column if not exists import_batch_id uuid references public.catalog_import_batches (id) on delete restrict,
  add column if not exists import_staged_record_id uuid references private.catalog_import_staged_records (id) on delete restrict,
  add column if not exists import_record_ordinal integer,
  add column if not exists import_record_sha256 text,
  add column if not exists import_projection_status text;

alter table public.products
  add constraint products_import_lineage_check check (
    (import_batch_id is null and import_staged_record_id is null and import_record_ordinal is null
      and import_record_sha256 is null and import_projection_status is null)
    or (import_batch_id is not null and import_staged_record_id is not null and import_record_ordinal > 0
      and import_record_sha256 ~ '^[a-f0-9]{64}$' and import_projection_status in ('active', 'retired'))
  );
alter table public.ingredients
  add constraint ingredients_import_lineage_check check (
    (import_batch_id is null and import_staged_record_id is null and import_record_ordinal is null
      and import_record_sha256 is null and import_projection_status is null)
    or (import_batch_id is not null and import_staged_record_id is not null and import_record_ordinal > 0
      and import_record_sha256 ~ '^[a-f0-9]{64}$' and import_projection_status in ('active', 'retired'))
  );
alter table public.product_barcodes
  add constraint product_barcodes_import_lineage_check check (
    (import_batch_id is null and import_staged_record_id is null and import_record_ordinal is null
      and import_record_sha256 is null and import_projection_status is null)
    or (import_batch_id is not null and import_staged_record_id is not null and import_record_ordinal > 0
      and import_record_sha256 ~ '^[a-f0-9]{64}$' and import_projection_status in ('active', 'retired'))
  );
alter table public.ingredient_synonyms
  add constraint ingredient_synonyms_import_lineage_check check (
    (import_batch_id is null and import_staged_record_id is null and import_record_ordinal is null
      and import_record_sha256 is null and import_projection_status is null)
    or (import_batch_id is not null and import_staged_record_id is not null and import_record_ordinal > 0
      and import_record_sha256 ~ '^[a-f0-9]{64}$' and import_projection_status in ('active', 'retired'))
  );
alter table public.product_ingredient_lists
  add constraint product_ingredient_lists_import_lineage_check check (
    (import_batch_id is null and import_staged_record_id is null and import_record_ordinal is null
      and import_record_sha256 is null and import_projection_status is null)
    or (import_batch_id is not null and import_staged_record_id is not null and import_record_ordinal > 0
      and import_record_sha256 ~ '^[a-f0-9]{64}$' and import_projection_status in ('active', 'retired'))
  );

alter table public.products
  add constraint products_import_retirement_key_check check (
    (import_batch_id is null and retired_import_natural_key is null)
    or (import_batch_id is not null and (
      (import_projection_status = 'active' and retired_import_natural_key is null)
      or (import_projection_status = 'retired' and retired_import_natural_key is not null)
    ))
  );
alter table public.ingredients
  add constraint ingredients_import_retirement_key_check check (
    (import_batch_id is null and retired_import_natural_key is null)
    or (import_batch_id is not null and (
      (import_projection_status = 'active' and retired_import_natural_key is null)
      or (import_projection_status = 'retired' and retired_import_natural_key is not null)
    ))
  );
alter table public.product_barcodes
  add constraint product_barcodes_import_retirement_key_check check (
    (import_batch_id is null and import_entity_id is null and retired_import_natural_key is null)
    or (import_batch_id is not null and import_entity_id is not null and (
      (import_projection_status = 'active' and retired_import_natural_key is null)
      or (import_projection_status = 'retired' and retired_import_natural_key is not null)
    ))
  );
alter table public.ingredient_synonyms
  add constraint ingredient_synonyms_import_retirement_key_check check (
    (import_batch_id is null and retired_import_natural_key is null)
    or (import_batch_id is not null and (
      (import_projection_status = 'active' and retired_import_natural_key is null)
      or (import_projection_status = 'retired' and retired_import_natural_key is not null)
    ))
  );
create unique index product_barcodes_import_entity_uidx
  on public.product_barcodes (import_entity_id) where import_entity_id is not null;

create index products_import_batch_idx on public.products (import_batch_id)
  where import_batch_id is not null;
create index ingredients_import_batch_idx on public.ingredients (import_batch_id)
  where import_batch_id is not null;

create or replace function private.catalog_import_sha256_text(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(coalesce(p_value, ''), 'UTF8'), 'sha256'),
    'hex'
  )
$$;

-- Cross-runtime binding uses recursive lexicographic object-key order,
-- preserved array order, and JSON-standard primitive serialization. Import
-- candidates themselves remain exact-key string/null records; integer support
-- is needed by the compact batch-evidence descriptor reviewed by the owner.
create or replace function private.catalog_import_canonical_json(p_value jsonb)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_type text := pg_catalog.jsonb_typeof(p_value);
  v_result text;
begin
  if v_type = 'null' then
    return 'null';
  elsif v_type = 'string' then
    return pg_catalog.to_jsonb(p_value #>> '{}')::text;
  elsif v_type in ('boolean', 'number') then
    return p_value::text;
  elsif v_type = 'array' then
    select '[' || coalesce(pg_catalog.string_agg(
      private.catalog_import_canonical_json(items.value), ',' order by items.ordinality
    ), '') || ']'
      into v_result
      from pg_catalog.jsonb_array_elements(p_value) with ordinality as items(value, ordinality);
    return v_result;
  elsif v_type = 'object' then
    select '{' || coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(items.key)::text || ':' ||
        private.catalog_import_canonical_json(items.value),
      ',' order by items.key collate pg_catalog."C"
    ), '') || '}'
      into v_result
      from pg_catalog.jsonb_each(p_value) as items(key, value);
    return v_result;
  end if;
  raise exception 'CATALOG_IMPORT_CANONICAL_JSON_DOMAIN_INVALID' using errcode = '22023';
end;
$$;

create or replace function private.catalog_import_normalize_key(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.upper(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(coalesce(p_value, ''), 'NFKC') collate pg_catalog."und-x-icu",
        U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
        ' ', 'g'
      )
    ) collate pg_catalog."und-x-icu"
  )
$$;

create or replace function private.catalog_import_normalize_label(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.normalize(coalesce(p_value, ''), 'NFKC') collate pg_catalog."und-x-icu",
        U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
        ' ', 'g'
      )
    ) collate pg_catalog."und-x-icu"
  )
$$;

-- Signed direct-stage text must already satisfy the JavaScript contract.  In
-- particular, do not silently trim or accept control characters and thereby
-- make the database-normalized receipt describe bytes the signer rejected.
-- The edge class is the frozen ECMAScript trim set used by the importer.
create or replace function private.catalog_import_text_is_bounded(
  p_value text,
  p_maximum integer
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_value is not null
    and p_maximum is not null
    and pg_catalog.length(p_value) between 1 and p_maximum
    and (
      select coalesce(pg_catalog.sum(
        case
          when pg_catalog.ascii(pg_catalog.substr(p_value, positions.position, 1)) > 65535
            then 2
          else 1
        end
      ), 0)
      from pg_catalog.generate_series(1, pg_catalog.length(p_value)) as positions(position)
    ) <= p_maximum
    and p_value !~ U&'^[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'
    and p_value !~ U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]$'
    and p_value !~ U&'[\0001-\001F\007F]'
$$;

create or replace function private.catalog_import_date_is_valid(
  p_value text,
  p_maximum date
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_date date;
begin
  if p_value is null or p_maximum is null
     or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  begin
    v_date := p_value::date;
  exception when others then
    return false;
  end;
  return pg_catalog.to_char(v_date, 'YYYY-MM-DD') = p_value and v_date <= p_maximum;
end;
$$;

-- Small owner-review descriptor binding the candidate bytes to the exact
-- source, artifact, policy, transform, QA, and parser evidence accepted at
-- begin. Its restricted canonical-JSON digest is the cross-runtime binding;
-- missing, changed, or extra fields therefore fail closed.
create or replace function private.catalog_import_batch_evidence(p_batch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'sourceKey', sources.source_key,
    'batchType', batches.batch_type,
    'snapshotDate', batches.snapshot_date,
    'artifactKind', batches.artifact_kind,
    'territory', batches.territory,
    'artifactUri', batches.artifact_uri,
    'artifactSha256', batches.artifact_sha256,
    'manifest', batches.manifest,
    'manifestSha256', batches.manifest_sha256,
    'sourcePolicySha256', batches.source_policy_sha256,
    'sourceApprovalSha256', batches.source_approval_sha256,
    'transformSha256', batches.transform_sha256,
    'transformedPayloadSha256', batches.transformed_payload_sha256,
    'qaReportUri', batches.qa_report_uri,
    'qaReportSha256', batches.qa_report_sha256,
    'qaBlockerCount', batches.qa_blocker_count,
    'qaWarningCount', batches.qa_warning_count,
    'expectedRecordCount', batches.expected_record_count,
    'parserVersion', batches.parser_version,
    'normalizationVersion', 'catalog-import-lifecycle-0057-normalization-v1'
  )
  from public.catalog_import_batches as batches
  join public.catalog_sources as sources on sources.id = batches.source_id
  where batches.id = p_batch_id
$$;

create or replace function private.catalog_import_batch_evidence_sha256(p_batch_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(
      private.catalog_import_batch_evidence(p_batch_id)
    )
  )
$$;

revoke all on function private.catalog_import_sha256_text(text)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_canonical_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_normalize_key(text)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_normalize_label(text)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_text_is_bounded(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_date_is_valid(text, date)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_batch_evidence(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_import_batch_evidence_sha256(uuid)
  from public, anon, authenticated, service_role;

-- Immutable audit relations accept inserts only from the owner-only lifecycle
-- functions. Corrections are represented by later events, never history edits.
create or replace function private.guard_catalog_import_ledger_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'CATALOG_IMPORT_LEDGER_IMMUTABLE' using errcode = '55000';
end;
$$;
revoke all on function private.guard_catalog_import_ledger_immutable()
  from public, anon, authenticated, service_role;

create trigger catalog_import_review_events_immutable
  before update or delete on private.catalog_import_review_events
  for each row execute function private.guard_catalog_import_ledger_immutable();
create trigger catalog_import_conflicts_immutable
  before update or delete on private.catalog_import_conflicts
  for each row execute function private.guard_catalog_import_ledger_immutable();
create trigger catalog_import_promotion_events_immutable
  before update or delete on private.catalog_import_promotion_events
  for each row execute function private.guard_catalog_import_ledger_immutable();
create trigger catalog_import_entity_revisions_immutable
  before update or delete on private.catalog_import_entity_revisions
  for each row execute function private.guard_catalog_import_ledger_immutable();
create trigger catalog_import_batch_effects_immutable
  before update or delete on private.catalog_import_batch_effects
  for each row execute function private.guard_catalog_import_ledger_immutable();
create trigger catalog_import_chunk_receipts_immutable
  before update or delete on private.catalog_import_chunk_receipts
  for each row execute function private.guard_catalog_import_ledger_immutable();

create or replace function private.guard_catalog_import_staged_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     or pg_catalog.current_setting('onskin.catalog_import_transition', true)
       is distinct from '0057-owner-transition'
     or (pg_catalog.to_jsonb(new) - array['disposition', 'sealed_at'])
       is distinct from (pg_catalog.to_jsonb(old) - array['disposition', 'sealed_at'])
     or not (
       (old.disposition = 'pending' and old.sealed_at is null
         and new.disposition in ('pending', 'duplicate', 'conflict')
         and new.sealed_at is not null)
       or (old.disposition = 'pending' and old.sealed_at is not null
         and new.disposition in ('accepted', 'rejected')
         and new.sealed_at = old.sealed_at)
     ) then
    raise exception 'CATALOG_IMPORT_STAGED_RECORD_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_catalog_import_staged_transition()
  from public, anon, authenticated, service_role;
create trigger catalog_import_staged_records_guard
  before update or delete on private.catalog_import_staged_records
  for each row execute function private.guard_catalog_import_staged_transition();

-- Begin accepts only a zero-finding, production, US artifact whose source is
-- currently approved. The caller supplies detached hashes; the manifest must
-- repeat the exact identity tuple so a mixed evidence packet cannot start.
create or replace function public.begin_catalog_import(
  p_operation_key text,
  p_source_key text,
  p_batch_type text,
  p_snapshot_date date,
  p_artifact_kind text,
  p_territory text,
  p_artifact_uri text,
  p_artifact_sha256 text,
  p_manifest jsonb,
  p_manifest_sha256 text,
  p_source_policy_sha256 text,
  p_source_approval_sha256 text,
  p_transform_sha256 text,
  p_transformed_payload_sha256 text,
  p_qa_report_uri text,
  p_qa_report_sha256 text,
  p_qa_blocker_count integer,
  p_qa_warning_count integer,
  p_expected_record_count integer,
  p_parser_version text
)
returns table (batch_id uuid, batch_status text, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request_sha256 text;
  v_existing public.catalog_import_batches%rowtype;
  v_source public.catalog_sources%rowtype;
  v_batch_id uuid;
begin
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'operationKey', p_operation_key,
      'sourceKey', p_source_key,
      'batchType', p_batch_type,
      'snapshotDate', p_snapshot_date,
      'artifactKind', p_artifact_kind,
      'territory', p_territory,
      'artifactUri', p_artifact_uri,
      'artifactSha256', p_artifact_sha256,
      'manifest', p_manifest,
      'manifestSha256', p_manifest_sha256,
      'sourcePolicySha256', p_source_policy_sha256,
      'sourceApprovalSha256', p_source_approval_sha256,
      'transformSha256', p_transform_sha256,
      'transformedPayloadSha256', p_transformed_payload_sha256,
      'qaReportUri', p_qa_report_uri,
      'qaReportSha256', p_qa_report_sha256,
      'qaBlockerCount', p_qa_blocker_count,
      'qaWarningCount', p_qa_warning_count,
      'expectedRecordCount', p_expected_record_count,
      'parserVersion', p_parser_version
    )::text
  );

  if p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$' then
    raise exception 'CATALOG_IMPORT_OPERATION_KEY_INVALID' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-operation:' || p_operation_key, 0)
  );

  select batches.* into v_existing
    from public.catalog_import_batches as batches
   where batches.operation_key = p_operation_key
   for update;
  if found then
    if v_existing.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_OPERATION_REPLAY_CHANGED' using errcode = '22023';
    end if;
    return query select v_existing.id, 'running'::text, true;
    return;
  end if;

  if p_source_key is null
     or (p_source_key, p_batch_type) not in (
       ('open_beauty_facts', 'obf_export'),
       ('cosing', 'cosing_dictionary')
     )
     or p_snapshot_date is null
     or p_snapshot_date > current_date
     or p_artifact_kind is distinct from 'production'
     or p_territory is distinct from 'US'
     or nullif(pg_catalog.btrim(p_artifact_uri), '') is null
     or p_artifact_uri <> pg_catalog.btrim(p_artifact_uri)
     or pg_catalog.length(p_artifact_uri) > 2000
     or nullif(pg_catalog.btrim(p_qa_report_uri), '') is null
     or p_qa_report_uri <> pg_catalog.btrim(p_qa_report_uri)
     or pg_catalog.length(p_qa_report_uri) > 2048
     or p_expected_record_count is null
     or p_expected_record_count < 1
     or p_expected_record_count > 100000
     or nullif(pg_catalog.btrim(p_parser_version), '') is null
     or pg_catalog.length(p_parser_version) > 100
     or p_qa_blocker_count is distinct from 0
     or p_qa_warning_count is distinct from 0
     or pg_catalog.jsonb_typeof(p_manifest) is distinct from 'object'
     or pg_catalog.pg_column_size(p_manifest) > 65536
     or (select count(*) from pg_catalog.jsonb_object_keys(p_manifest)) <> 17
     or not (p_manifest ?& array[
       'schemaVersion', 'status', 'importMode', 'sourceKey',
       'sourceComponentId', 'parserVersion', 'artifactKind', 'territory',
       'snapshotDate', 'artifactSha256', 'manifestSha256',
       'sourcePolicySha256', 'sourceApprovalSha256', 'transformSha256',
       'transformedPayloadSha256', 'qaReportSha256', 'qaStatus'
     ])
     or p_manifest ->> 'schemaVersion' is distinct from '1'
     or p_manifest ->> 'status' is distinct from 'approved_transform'
     or p_manifest ->> 'sourceKey' is distinct from p_source_key
     or p_manifest ->> 'sourceComponentId' is distinct from (case p_source_key
       when 'open_beauty_facts' then 'obf_odbl_component'
       when 'cosing' then 'cosing_reference_component'
       else null
     end)
     or p_manifest ->> 'importMode' is distinct from (case p_source_key
       when 'open_beauty_facts' then 'approved_offline_export'
       when 'cosing' then 'approved_offline_snapshot'
       else null
     end)
     or p_manifest ->> 'parserVersion' is distinct from p_parser_version
     or p_manifest ->> 'artifactKind' is distinct from p_artifact_kind
     or p_manifest ->> 'territory' is distinct from p_territory
     or p_manifest ->> 'artifactSha256' is distinct from p_artifact_sha256
     or p_manifest ->> 'manifestSha256' is distinct from p_manifest_sha256
     or p_manifest ->> 'sourcePolicySha256' is distinct from p_source_policy_sha256
     or p_manifest ->> 'sourceApprovalSha256' is distinct from p_source_approval_sha256
     or p_manifest ->> 'transformSha256' is distinct from p_transform_sha256
     or p_manifest ->> 'transformedPayloadSha256' is distinct from p_transformed_payload_sha256
     or p_manifest ->> 'qaReportSha256' is distinct from p_qa_report_sha256
     or p_manifest ->> 'qaStatus' is distinct from 'pass'
     or p_manifest ->> 'snapshotDate' is distinct from p_snapshot_date::text
     or exists (
       select 1
       from pg_catalog.unnest(array[
         p_artifact_sha256, p_manifest_sha256, p_source_policy_sha256,
         p_source_approval_sha256, p_transform_sha256,
         p_transformed_payload_sha256, p_qa_report_sha256
       ]) as evidence(value)
       where evidence.value is null or evidence.value !~ '^[a-f0-9]{64}$'
     ) then
    raise exception 'CATALOG_IMPORT_EVIDENCE_INVALID' using errcode = '22023';
  end if;

  select sources.* into v_source
    from public.catalog_sources as sources
   where sources.source_key = p_source_key
     and sources.production_approved is true
     and sources.review_status = 'legal_approved'
     and nullif(pg_catalog.btrim(sources.reviewed_by), '') is not null
     and sources.reviewed_at is not null
     and sources.reviewed_at <= pg_catalog.now()
     and (
       sources.requires_attribution is false
       or (
         nullif(pg_catalog.btrim(sources.attribution_text), '') is not null
         and nullif(pg_catalog.btrim(sources.attribution_url), '') is not null
       )
     )
   for share;
  if not found then
    raise exception 'CATALOG_IMPORT_SOURCE_NOT_APPROVED' using errcode = '55000';
  end if;

  insert into public.catalog_import_batches (
    source_id, batch_type, snapshot_date, artifact_uri, artifact_sha256,
    manifest, status, parser_version, qa_report_uri, started_at, created_by,
    operation_key, request_sha256, artifact_kind, territory, manifest_sha256,
    source_policy_sha256, source_approval_sha256, transform_sha256,
    transformed_payload_sha256,
    qa_report_sha256, qa_blocker_count, qa_warning_count,
    expected_record_count, staged_record_count
  ) values (
    v_source.id, p_batch_type, p_snapshot_date, p_artifact_uri,
    p_artifact_sha256, p_manifest, 'running', p_parser_version,
    p_qa_report_uri, pg_catalog.now(), 'catalog-import-service',
    p_operation_key, v_request_sha256, p_artifact_kind, p_territory,
    p_manifest_sha256, p_source_policy_sha256, p_source_approval_sha256,
    p_transform_sha256, p_transformed_payload_sha256, p_qa_report_sha256, p_qa_blocker_count,
    p_qa_warning_count, p_expected_record_count, 0
  ) returning id into v_batch_id;

  return query select v_batch_id, 'running'::text, false;
end;
$$;

comment on function public.begin_catalog_import(
  text, text, text, date, text, text, text, text, jsonb, text, text,
  text, text, text, text, text, integer, integer, integer, text
) is 'Service-only replay-safe start for approved zero-finding US catalog artifacts.';

revoke all on function public.begin_catalog_import(
  text, text, text, date, text, text, text, text, jsonb, text, text,
  text, text, text, text, text, integer, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.begin_catalog_import(
  text, text, text, date, text, text, text, text, jsonb, text, text,
  text, text, text, text, text, integer, integer, integer, text
) to service_role;

-- Chunks are sequential by design. This bounds retry reasoning: an exact old
-- receipt is a no-op, while gaps, reordering, or changed bytes are rejected.
create or replace function public.stage_catalog_import_chunk(
  p_batch_id uuid,
  p_operation_key text,
  p_chunk_ordinal integer,
  p_first_record_ordinal integer,
  p_records jsonb
)
returns table (
  batch_id uuid,
  chunk_ordinal integer,
  staged_record_count integer,
  chunk_sha256 text,
  record_receipts jsonb,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_source_key text;
  v_request_sha256 text;
  v_receipt private.catalog_import_chunk_receipts%rowtype;
  v_record jsonb;
  v_normalized jsonb;
  v_kind text;
  v_natural_key text;
  v_record_sha256 text;
  v_record_count integer;
  v_existing_chunk_count integer;
  v_synonyms jsonb;
  v_chunk_sha256 text;
  v_record_receipts jsonb;
  v_canonical_records text;
  v_index integer := 0;
begin
  if p_batch_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_chunk_ordinal is null or p_chunk_ordinal < 1
     or p_first_record_ordinal is null or p_first_record_ordinal < 1
     or pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'CATALOG_IMPORT_CHUNK_INPUT_INVALID' using errcode = '22023';
  end if;

  v_canonical_records := private.catalog_import_canonical_json(p_records);
  if pg_catalog.octet_length(v_canonical_records) > 8388608 then
    raise exception 'CATALOG_IMPORT_CHUNK_INPUT_INVALID' using errcode = '22023';
  end if;

  v_record_count := pg_catalog.jsonb_array_length(p_records);
  if v_record_count not between 1 and 500 then
    raise exception 'CATALOG_IMPORT_CHUNK_SIZE_INVALID' using errcode = '22023';
  end if;
  v_chunk_sha256 := private.catalog_import_sha256_text(p_records::text);
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id,
      'operationKey', p_operation_key,
      'chunkOrdinal', p_chunk_ordinal,
      'firstRecordOrdinal', p_first_record_ordinal,
      'records', p_records
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch
    from public.catalog_import_batches as batches
   where batches.id = p_batch_id
   for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;

  select receipts.* into v_receipt
    from private.catalog_import_chunk_receipts as receipts
   where (receipts.batch_id = p_batch_id
       and receipts.chunk_ordinal = p_chunk_ordinal)
      or receipts.operation_key = p_operation_key
   for update;
  if found then
    if v_receipt.batch_id <> p_batch_id
       or v_receipt.chunk_ordinal <> p_chunk_ordinal
       or v_receipt.operation_key <> p_operation_key
       or v_receipt.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_CHUNK_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'recordOrdinal', records.record_ordinal,
      'recordSha256', records.record_sha256,
      'recordKind', records.record_kind,
      'canonicalKey', records.natural_key,
      'sourcePayload', records.source_payload,
      'normalizedPayload', records.normalized_payload,
      'disposition', 'pending'
    ) order by records.record_ordinal) into v_record_receipts
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id
      and records.record_ordinal between v_receipt.first_record_ordinal
        and v_receipt.first_record_ordinal + v_receipt.record_count - 1;
    return query
      select p_batch_id, p_chunk_ordinal,
        v_receipt.first_record_ordinal + v_receipt.record_count - 1,
        v_receipt.chunk_sha256, v_record_receipts, true;
    return;
  end if;

  if v_batch.status <> 'running'
     or v_batch.artifact_kind <> 'production'
     or v_batch.territory <> 'US'
     or v_batch.qa_blocker_count <> 0
     or v_batch.qa_warning_count <> 0 then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_STAGEABLE' using errcode = '55000';
  end if;
  select count(*)::integer into v_existing_chunk_count
    from private.catalog_import_chunk_receipts as receipts
   where receipts.batch_id = p_batch_id;
  if p_chunk_ordinal <> v_existing_chunk_count + 1
     or p_first_record_ordinal <> v_batch.staged_record_count + 1
     or v_batch.staged_record_count + v_record_count > v_batch.expected_record_count then
    raise exception 'CATALOG_IMPORT_CHUNK_SEQUENCE_INVALID' using errcode = '22023';
  end if;

  select sources.source_key into v_source_key
    from public.catalog_sources as sources
   where sources.id = v_batch.source_id;

  for v_record in
    select records.value from pg_catalog.jsonb_array_elements(p_records) as records(value)
  loop
    v_index := v_index + 1;
    if pg_catalog.jsonb_typeof(v_record) is distinct from 'object' then
      raise exception 'CATALOG_IMPORT_RECORD_INVALID' using errcode = '22023';
    end if;
    perform private.catalog_import_canonical_json(v_record);
    v_kind := v_record ->> 'recordKind';

    if v_kind = 'product' then
      if v_source_key <> 'open_beauty_facts'
         or v_batch.batch_type <> 'obf_export'
         or (select count(*) from pg_catalog.jsonb_object_keys(v_record)) <> 17
         or not (v_record ?& array[
           'recordKind', 'canonicalKey', 'barcode', 'name', 'brand', 'category',
           'ingredientsText', 'source', 'sourceComponentId', 'sourceRef',
           'sourceUrl', 'sourceRecordModifiedDate', 'sourceArtifactSha256',
           'qualityGrade', 'reviewStatus', 'sourceSnapshotDate', 'region'
         ])
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array[
             'recordKind', 'canonicalKey', 'barcode', 'name', 'source',
             'sourceComponentId', 'sourceRef', 'sourceUrl',
             'sourceRecordModifiedDate', 'sourceArtifactSha256',
             'qualityGrade', 'reviewStatus', 'sourceSnapshotDate', 'region'
           ])
             and pg_catalog.jsonb_typeof(fields.value) is distinct from 'string'
         )
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array['brand', 'category', 'ingredientsText'])
             and pg_catalog.jsonb_typeof(fields.value) not in ('string', 'null')
         )
         or v_record ->> 'source' is distinct from v_source_key
         or v_record ->> 'sourceComponentId' is distinct from 'obf_odbl_component'
         or v_record ->> 'sourceArtifactSha256' is distinct from v_batch.artifact_sha256
         or v_record ->> 'sourceSnapshotDate' is distinct from v_batch.snapshot_date::text
         or v_record ->> 'region' is distinct from 'US'
         or v_record ->> 'barcode' !~ '^[0-9]{8,14}$'
         or v_record ->> 'canonicalKey' is distinct from v_record ->> 'barcode'
         or v_record ->> 'sourceRef' is distinct from v_record ->> 'barcode'
         or not private.catalog_import_text_is_bounded(v_record ->> 'name', 200)
         or (v_record ->> 'brand' is not null
           and not private.catalog_import_text_is_bounded(v_record ->> 'brand', 300))
         or (v_record ->> 'category' is not null
           and not private.catalog_import_text_is_bounded(v_record ->> 'category', 100))
         or (v_record ->> 'category' is not null
           and v_record ->> 'category' not in (
             'cleanser', 'toner', 'serum', 'moisturiser_tube', 'spf'
           ))
         or (v_record ->> 'ingredientsText' is not null
           and not private.catalog_import_text_is_bounded(v_record ->> 'ingredientsText', 20000))
         or nullif(pg_catalog.btrim(v_record ->> 'sourceRef'), '') is null
         or pg_catalog.length(pg_catalog.btrim(v_record ->> 'sourceRef')) > 14
         or v_record ->> 'sourceUrl' is distinct from
           'https://world.openbeautyfacts.org/product/' || (v_record ->> 'barcode')
         or pg_catalog.length(v_record ->> 'sourceUrl') > 2000
         or not private.catalog_import_date_is_valid(
           v_record ->> 'sourceRecordModifiedDate', v_batch.snapshot_date
         )
         or v_record ->> 'qualityGrade' not in ('limited', 'unverified')
         or v_record ->> 'reviewStatus' is distinct from 'unreviewed'
         or pg_catalog.length(coalesce(v_record ->> 'ingredientsText', '')) > 20000 then
        raise exception 'CATALOG_IMPORT_PRODUCT_RECORD_INVALID' using errcode = '22023';
      end if;
      v_natural_key := v_record ->> 'barcode';
      v_normalized := pg_catalog.jsonb_build_object(
        'recordKind', 'product',
        'canonicalKey', v_natural_key,
        'barcode', v_natural_key,
        'name', pg_catalog.btrim(v_record ->> 'name'),
        'brand', nullif(pg_catalog.btrim(v_record ->> 'brand'), ''),
        -- Category is a frozen ASCII enum emitted by the approved transformer;
        -- retaining it verbatim avoids any ICU lower-case version dependency.
        'category', v_record -> 'category',
        'ingredientsText', nullif(pg_catalog.btrim(v_record ->> 'ingredientsText'), ''),
        'source', v_source_key,
        'sourceRef', pg_catalog.btrim(v_record ->> 'sourceRef'),
        'sourceUrl', pg_catalog.btrim(v_record ->> 'sourceUrl'),
        'sourceRecordModifiedDate', v_record ->> 'sourceRecordModifiedDate',
        'sourceArtifactSha256', v_batch.artifact_sha256,
        'sourceSnapshotDate', v_batch.snapshot_date::text,
        'region', 'US',
        'qualityGrade', v_record ->> 'qualityGrade',
        'reviewStatus', v_record ->> 'reviewStatus'
      );
    elsif v_kind = 'ingredient' then
      if v_source_key <> 'cosing'
         or v_batch.batch_type <> 'cosing_dictionary'
         or (select count(*) from pg_catalog.jsonb_object_keys(v_record)) <> 17
         or not (v_record ?& array[
           'recordKind', 'canonicalKey', 'inciName', 'displayName', 'casNumber', 'ecNumber',
           'annexStatus', 'sourceRef', 'sourceRecordStatus',
           'glossaryDecision', 'source', 'sourceComponentId', 'sourceUrl',
           'sourceArtifactSha256', 'reviewStatus', 'synonyms',
           'sourceSnapshotDate'
         ])
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array[
             'recordKind', 'canonicalKey', 'inciName', 'displayName',
             'sourceRef', 'sourceRecordStatus', 'glossaryDecision', 'source',
             'sourceComponentId', 'sourceUrl', 'sourceArtifactSha256',
             'reviewStatus', 'sourceSnapshotDate'
           ])
             and pg_catalog.jsonb_typeof(fields.value) is distinct from 'string'
         )
         or exists (
           select 1 from pg_catalog.jsonb_each(v_record) as fields(key, value)
           where fields.key = any(array['casNumber', 'ecNumber', 'annexStatus'])
             and pg_catalog.jsonb_typeof(fields.value) not in ('string', 'null')
         )
         or v_record ->> 'source' is distinct from v_source_key
         or v_record ->> 'sourceComponentId' is distinct from 'cosing_reference_component'
         or v_record ->> 'sourceArtifactSha256' is distinct from v_batch.artifact_sha256
         or v_record ->> 'sourceSnapshotDate' is distinct from v_batch.snapshot_date::text
         or not private.catalog_import_text_is_bounded(v_record ->> 'inciName', 300)
         or not private.catalog_import_text_is_bounded(v_record ->> 'displayName', 300)
         or v_record ->> 'canonicalKey' is distinct from
           private.catalog_import_normalize_key(v_record ->> 'inciName')
         or nullif(pg_catalog.btrim(v_record ->> 'sourceRef'), '') is null
         or pg_catalog.length(pg_catalog.btrim(v_record ->> 'sourceRef')) > 500
         or v_record ->> 'sourceRef' !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
         or (v_record ->> 'casNumber' is not null
           and v_record ->> 'casNumber' !~ '^[0-9]{2,7}-[0-9]{2}-[0-9]$')
         or (v_record ->> 'ecNumber' is not null
           and v_record ->> 'ecNumber' !~ '^[0-9]{3}-[0-9]{3}-[0-9]$')
         or (pg_catalog.jsonb_typeof(v_record -> 'annexStatus') = 'string'
           and not private.catalog_import_text_is_bounded(v_record ->> 'annexStatus', 500))
         or not private.catalog_import_text_is_bounded(v_record ->> 'sourceUrl', 2000)
         or v_record ->> 'sourceUrl' !~ '^https://([A-Za-z0-9-]+[.])*((ec[.]europa[.]eu)|(europa[.]eu))/[^[:space:]]+$'
         or pg_catalog.length(v_record ->> 'sourceUrl') > 2000
         or v_record ->> 'sourceRecordStatus' is distinct from 'active'
         or v_record ->> 'glossaryDecision' is distinct from 'EU_2025_1175'
         or v_record ->> 'reviewStatus' is distinct from 'unreviewed'
         or pg_catalog.jsonb_typeof(v_record -> 'synonyms') is distinct from 'array'
         or exists (
           select 1 from pg_catalog.jsonb_array_elements(v_record -> 'synonyms') as synonyms(value)
           where pg_catalog.jsonb_typeof(synonyms.value) is distinct from 'string'
         )
         or pg_catalog.length(coalesce(v_record ->> 'annexStatus', '')) > 500 then
        raise exception 'CATALOG_IMPORT_INGREDIENT_RECORD_INVALID' using errcode = '22023';
      end if;
      v_natural_key := private.catalog_import_normalize_key(v_record ->> 'inciName');
      if exists (
           select 1 from pg_catalog.jsonb_array_elements_text(v_record -> 'synonyms') as items(value)
           where not private.catalog_import_text_is_bounded(items.value, 300)
             or nullif(private.catalog_import_normalize_key(items.value), '') is null
             or private.catalog_import_normalize_key(items.value) = v_natural_key
         )
         or (
           select count(*) from pg_catalog.jsonb_array_elements_text(v_record -> 'synonyms')
         ) <> (
           select count(distinct private.catalog_import_normalize_key(items.value))
           from pg_catalog.jsonb_array_elements_text(v_record -> 'synonyms') as items(value)
         ) then
        raise exception 'CATALOG_IMPORT_INGREDIENT_SYNONYMS_INVALID' using errcode = '22023';
      end if;
      select coalesce(pg_catalog.jsonb_agg(
        synonyms.value order by synonyms.value collate pg_catalog."C"
      ), '[]'::jsonb)
        into v_synonyms
        from (
          select private.catalog_import_normalize_key(items.value) as value
          from pg_catalog.jsonb_array_elements_text(
            v_record -> 'synonyms'
          ) as items(value)
        ) as synonyms;
      if pg_catalog.jsonb_array_length(v_synonyms) > 50 then
        raise exception 'CATALOG_IMPORT_INGREDIENT_SYNONYMS_INVALID' using errcode = '22023';
      end if;
      v_normalized := pg_catalog.jsonb_build_object(
        'recordKind', 'ingredient',
        'canonicalKey', v_natural_key,
        'inciName', pg_catalog.btrim(v_record ->> 'inciName'),
        'normalizedInciName', v_natural_key,
        'displayName', nullif(pg_catalog.btrim(v_record ->> 'displayName'), ''),
        'casNumber', nullif(pg_catalog.btrim(v_record ->> 'casNumber'), ''),
        'ecNumber', nullif(pg_catalog.btrim(v_record ->> 'ecNumber'), ''),
        'annexStatus', nullif(pg_catalog.btrim(v_record ->> 'annexStatus'), ''),
        'source', v_source_key,
        'sourceRef', pg_catalog.btrim(v_record ->> 'sourceRef'),
        'sourceUrl', pg_catalog.btrim(v_record ->> 'sourceUrl'),
        'sourceRecordStatus', v_record ->> 'sourceRecordStatus',
        'glossaryDecision', v_record ->> 'glossaryDecision',
        'sourceArtifactSha256', v_batch.artifact_sha256,
        'sourceSnapshotDate', v_batch.snapshot_date::text,
        'reviewStatus', v_record ->> 'reviewStatus',
        'synonyms', v_synonyms
      );
    else
      raise exception 'CATALOG_IMPORT_RECORD_KIND_INVALID' using errcode = '22023';
    end if;

    -- Explicit migration-0057 SQL/JavaScript receipt contract: SHA-256 over
    -- UTF-8 recursive canonical JSON of the exact normalized payload. The
    -- offline completion tool independently derives and checks these bytes.
    v_record_sha256 := private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(v_normalized)
    );
    insert into private.catalog_import_staged_records (
      batch_id, record_ordinal, record_kind, natural_key, source_payload,
      normalized_payload, record_sha256
    ) values (
      p_batch_id, p_first_record_ordinal + v_index - 1, v_kind,
      v_natural_key, v_record, v_normalized, v_record_sha256
    );
  end loop;

  insert into private.catalog_import_chunk_receipts (
    batch_id, operation_key, request_sha256, chunk_ordinal,
    first_record_ordinal, record_count, chunk_sha256
  ) values (
    p_batch_id, p_operation_key, v_request_sha256, p_chunk_ordinal,
    p_first_record_ordinal, v_record_count, v_chunk_sha256
  );
  update public.catalog_import_batches as batches
     set staged_record_count = batches.staged_record_count + v_record_count
   where batches.id = p_batch_id;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'recordOrdinal', records.record_ordinal,
    'recordSha256', records.record_sha256,
    'recordKind', records.record_kind,
    'canonicalKey', records.natural_key,
    'sourcePayload', records.source_payload,
    'normalizedPayload', records.normalized_payload,
    'disposition', 'pending'
  ) order by records.record_ordinal) into v_record_receipts
  from private.catalog_import_staged_records as records
  where records.batch_id = p_batch_id
    and records.record_ordinal between p_first_record_ordinal
      and p_first_record_ordinal + v_record_count - 1;

  return query
    select p_batch_id, p_chunk_ordinal,
      v_batch.staged_record_count + v_record_count, v_chunk_sha256,
      v_record_receipts, false;
end;
$$;

comment on function public.stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)
  is 'Service-only contiguous deterministic catalog staging with exact chunk replay.';
revoke all on function public.stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.stage_catalog_import_chunk(uuid, text, integer, integer, jsonb)
  to service_role;

-- Recompute every database-owned receipt before verification, review, and
-- promotion. This catches accidental or privileged edits to batch evidence,
-- chunk windows, source payloads, normalized bytes, or record hashes.
create or replace function private.catalog_import_batch_integrity(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      batches.status in ('finalized', 'verified', 'reviewed', 'promoted')
      and batches.artifact_kind = 'production'
      and batches.territory = 'US'
      and batches.qa_blocker_count = 0
      and batches.qa_warning_count = 0
      and batches.expected_record_count = batches.staged_record_count
      and batches.records_sha256 ~ '^[a-f0-9]{64}$'
      and (select count(*) from pg_catalog.jsonb_object_keys(batches.manifest)) = 17
      and batches.manifest ?& array[
        'schemaVersion', 'status', 'importMode', 'sourceKey',
        'sourceComponentId', 'parserVersion', 'artifactKind', 'territory',
        'snapshotDate', 'artifactSha256', 'manifestSha256',
        'sourcePolicySha256', 'sourceApprovalSha256', 'transformSha256',
        'transformedPayloadSha256', 'qaReportSha256', 'qaStatus'
      ]
      and batches.manifest ->> 'schemaVersion' = '1'
      and batches.manifest ->> 'status' = 'approved_transform'
      and batches.manifest ->> 'sourceKey' = sources.source_key
      and batches.manifest ->> 'sourceComponentId' = (case sources.source_key
        when 'open_beauty_facts' then 'obf_odbl_component'
        when 'cosing' then 'cosing_reference_component'
      end)
      and batches.manifest ->> 'importMode' = (case sources.source_key
        when 'open_beauty_facts' then 'approved_offline_export'
        when 'cosing' then 'approved_offline_snapshot'
      end)
      and batches.manifest ->> 'parserVersion' = batches.parser_version
      and batches.manifest ->> 'artifactKind' = batches.artifact_kind
      and batches.manifest ->> 'territory' = batches.territory
      and batches.manifest ->> 'snapshotDate' = batches.snapshot_date::text
      and batches.manifest ->> 'artifactSha256' = batches.artifact_sha256
      and batches.manifest ->> 'manifestSha256' = batches.manifest_sha256
      and batches.manifest ->> 'sourcePolicySha256' = batches.source_policy_sha256
      and batches.manifest ->> 'sourceApprovalSha256' = batches.source_approval_sha256
      and batches.manifest ->> 'transformSha256' = batches.transform_sha256
      and batches.manifest ->> 'transformedPayloadSha256' = batches.transformed_payload_sha256
      and batches.manifest ->> 'qaReportSha256' = batches.qa_report_sha256
      and batches.manifest ->> 'qaStatus' = 'pass'
      and batches.request_sha256 = private.catalog_import_sha256_text(
        pg_catalog.jsonb_build_object(
          'operationKey', batches.operation_key,
          'sourceKey', sources.source_key,
          'batchType', batches.batch_type,
          'snapshotDate', batches.snapshot_date,
          'artifactKind', batches.artifact_kind,
          'territory', batches.territory,
          'artifactUri', batches.artifact_uri,
          'artifactSha256', batches.artifact_sha256,
          'manifest', batches.manifest,
          'manifestSha256', batches.manifest_sha256,
          'sourcePolicySha256', batches.source_policy_sha256,
          'sourceApprovalSha256', batches.source_approval_sha256,
          'transformSha256', batches.transform_sha256,
          'transformedPayloadSha256', batches.transformed_payload_sha256,
          'qaReportUri', batches.qa_report_uri,
          'qaReportSha256', batches.qa_report_sha256,
          'qaBlockerCount', batches.qa_blocker_count,
          'qaWarningCount', batches.qa_warning_count,
          'expectedRecordCount', batches.expected_record_count,
          'parserVersion', batches.parser_version
        )::text
      )
      and sources.production_approved is true
      and sources.review_status = 'legal_approved'
      and nullif(pg_catalog.btrim(sources.reviewed_by), '') is not null
      and sources.reviewed_at is not null
      and sources.reviewed_at <= pg_catalog.now()
      and (sources.requires_attribution is false or (
        nullif(pg_catalog.btrim(sources.attribution_text), '') is not null
        and nullif(pg_catalog.btrim(sources.attribution_url), '') is not null
      ))
      and (
        select count(*) from private.catalog_import_staged_records as records
        where records.batch_id = batches.id
      ) = batches.expected_record_count
      and not exists (
        select 1 from private.catalog_import_staged_records as records
        where records.batch_id = batches.id
          and (
            records.sealed_at is null
            or records.record_sha256 <> private.catalog_import_sha256_text(
              private.catalog_import_canonical_json(records.normalized_payload)
            )
          )
      )
      and batches.records_sha256 = (
        select private.catalog_import_sha256_text(
          coalesce(pg_catalog.string_agg(records.record_sha256, '' order by records.record_ordinal), '')
        )
        from private.catalog_import_staged_records as records
        where records.batch_id = batches.id
      )
      and batches.candidates_sha256 = (
        select private.catalog_import_sha256_text(
          coalesce(pg_catalog.string_agg(
            private.catalog_import_sha256_text(
              private.catalog_import_canonical_json(records.source_payload)
            ), '' order by records.record_ordinal
          ), '')
        )
        from private.catalog_import_staged_records as records
        where records.batch_id = batches.id
      )
      and (
        select coalesce(sum(receipts.record_count), 0)
        from private.catalog_import_chunk_receipts as receipts
        where receipts.batch_id = batches.id
      ) = batches.expected_record_count
      and not exists (
        select 1
        from (
          select receipts.*,
            pg_catalog.row_number() over (order by receipts.chunk_ordinal) as expected_chunk,
            1 + coalesce(
              sum(receipts.record_count) over (
                order by receipts.chunk_ordinal
                rows between unbounded preceding and 1 preceding
              ), 0
            ) as expected_first
          from private.catalog_import_chunk_receipts as receipts
          where receipts.batch_id = batches.id
        ) as ordered_receipts
        cross join lateral (
          select pg_catalog.jsonb_agg(records.source_payload order by records.record_ordinal) as payload,
            count(*)::integer as payload_count
          from private.catalog_import_staged_records as records
          where records.batch_id = batches.id
            and records.record_ordinal between ordered_receipts.first_record_ordinal
              and ordered_receipts.first_record_ordinal + ordered_receipts.record_count - 1
        ) as chunk
        where ordered_receipts.chunk_ordinal <> ordered_receipts.expected_chunk
           or ordered_receipts.first_record_ordinal <> ordered_receipts.expected_first
           or ordered_receipts.record_count <> chunk.payload_count
           or ordered_receipts.chunk_sha256 <>
             private.catalog_import_sha256_text(chunk.payload::text)
           or ordered_receipts.request_sha256 <>
             private.catalog_import_sha256_text(
               pg_catalog.jsonb_build_object(
                 'batchId', batches.id,
                 'operationKey', ordered_receipts.operation_key,
                 'chunkOrdinal', ordered_receipts.chunk_ordinal,
                 'firstRecordOrdinal', ordered_receipts.first_record_ordinal,
                 'records', chunk.payload
               )::text
             )
      )
    from public.catalog_import_batches as batches
    join public.catalog_sources as sources on sources.id = batches.source_id
    where batches.id = p_batch_id
  ), false)
$$;
revoke all on function private.catalog_import_batch_integrity(uuid)
  from public, anon, authenticated, service_role;

-- Finalization seals all rows, proves the contiguous normalized-record digest,
-- and binds ordered source candidates as SHA256(concatenated fixed-width
-- SHA256(canonical candidate) leaves). The bounded 6.4 MB leaf chain avoids a
-- whole-batch JSONB value at the 100k ceiling. Key disagreements route to an
-- immutable conflict ledger; blocked batches are replaced, never edited open.
create or replace function public.finalize_catalog_import(
  p_batch_id uuid,
  p_operation_key text,
  p_expected_record_count integer
)
returns table (
  batch_id uuid,
  batch_status text,
  canonical_record_count integer,
  duplicate_record_count integer,
  conflict_record_count integer,
  records_sha256 text,
  candidates_sha256 text,
  record_receipts jsonb,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_request_sha256 text;
  v_computed_sha256 text;
  v_candidates_sha256 text;
  v_duplicate_count integer;
  v_conflict_count integer;
  v_canonical_count integer;
  v_record_receipts jsonb;
begin
  if p_batch_id is null
     or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_expected_record_count is null or p_expected_record_count < 1 then
    raise exception 'CATALOG_IMPORT_FINALIZE_INPUT_INVALID' using errcode = '22023';
  end if;
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id,
      'operationKey', p_operation_key,
      'expectedRecordCount', p_expected_record_count
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch
    from public.catalog_import_batches as batches
   where batches.id = p_batch_id
   for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.catalog_import_batches as other_batches
    where other_batches.finalize_operation_key = p_operation_key
      and other_batches.id <> p_batch_id
  ) then
    raise exception 'CATALOG_IMPORT_FINALIZE_REPLAY_CHANGED' using errcode = '22023';
  end if;

  if v_batch.finalize_operation_key is not null then
    if v_batch.finalize_operation_key <> p_operation_key
       or v_batch.finalize_request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_FINALIZE_REPLAY_CHANGED' using errcode = '22023';
    end if;
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'recordOrdinal', records.record_ordinal,
      'recordSha256', records.record_sha256,
      'recordKind', records.record_kind,
      'canonicalKey', records.natural_key,
      'disposition', case when records.disposition in ('accepted', 'rejected')
        then 'pending' else records.disposition end
    ) order by records.record_ordinal) into v_record_receipts
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id;
    return query select v_batch.id,
      case when v_batch.conflict_record_count = 0 then 'finalized' else 'blocked' end,
      v_batch.staged_record_count - v_batch.duplicate_record_count - v_batch.conflict_record_count,
      v_batch.duplicate_record_count, v_batch.conflict_record_count,
      v_batch.records_sha256, v_batch.candidates_sha256,
      v_record_receipts, true;
    return;
  end if;

  select private.catalog_import_sha256_text(
           coalesce(pg_catalog.string_agg(records.record_sha256, '' order by records.record_ordinal), '')
         )
    into v_computed_sha256
    from private.catalog_import_staged_records as records
   where records.batch_id = p_batch_id;
  select private.catalog_import_sha256_text(
           coalesce(pg_catalog.string_agg(
             private.catalog_import_sha256_text(
               private.catalog_import_canonical_json(records.source_payload)
             ), '' order by records.record_ordinal
           ), '')
         )
    into v_candidates_sha256
    from private.catalog_import_staged_records as records
   where records.batch_id = p_batch_id;

  if v_batch.status <> 'running'
     or v_batch.expected_record_count <> p_expected_record_count
     or v_batch.staged_record_count <> p_expected_record_count
     or (select count(*) from private.catalog_import_staged_records as records
          where records.batch_id = p_batch_id) <> p_expected_record_count
     or (select min(records.record_ordinal) from private.catalog_import_staged_records as records
          where records.batch_id = p_batch_id) <> 1
     or (select max(records.record_ordinal) from private.catalog_import_staged_records as records
          where records.batch_id = p_batch_id) <> p_expected_record_count then
    raise exception 'CATALOG_IMPORT_FINALIZE_EVIDENCE_MISMATCH' using errcode = '22023';
  end if;
  perform pg_catalog.set_config(
    'onskin.catalog_import_transition', '0057-owner-transition', true
  );

  -- Different bytes for one natural key are never silently deduplicated.
  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key, conflict_sha256
  )
  select records.batch_id, records.id, 'batch_key_mismatch', records.natural_key,
    private.catalog_import_sha256_text(
      records.record_kind || ':' || records.natural_key || ':' || records.record_sha256
    )
  from private.catalog_import_staged_records as records
  join (
    select grouped.batch_id, grouped.record_kind, grouped.natural_key
    from private.catalog_import_staged_records as grouped
    where grouped.batch_id = p_batch_id
    group by grouped.batch_id, grouped.record_kind, grouped.natural_key
    having count(distinct grouped.record_sha256) > 1
  ) as conflicts
    on conflicts.batch_id = records.batch_id
   and conflicts.record_kind = records.record_kind
   and conflicts.natural_key = records.natural_key;

  update private.catalog_import_staged_records as records
     set disposition = 'conflict', sealed_at = pg_catalog.now()
   where records.batch_id = p_batch_id
     and exists (
       select 1 from private.catalog_import_conflicts as conflicts
       where conflicts.staged_record_id = records.id
     );

  -- Exact duplicate bytes retain one canonical row and seal later ordinals as
  -- duplicates. Their hashes remain in the batch digest and audit history.
  with ranked as (
    select records.id,
      pg_catalog.row_number() over (
        partition by records.record_kind, records.natural_key, records.record_sha256
        order by records.record_ordinal
      ) as rank
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id
      and records.disposition = 'pending'
  )
  update private.catalog_import_staged_records as records
     set disposition = 'duplicate', sealed_at = pg_catalog.now()
    from ranked
   where ranked.id = records.id and ranked.rank > 1;

  -- Alternate identifiers are uniqueness authorities too. A repeated CosIng
  -- reference, CAS/EC number, or synonym is a whole-record conflict even when
  -- the primary INCI names differ.
  with alternate_keys as (
    select records.id, records.batch_id, 'source_ref'::text as key_type,
      case when records.record_kind = 'ingredient'
        then private.catalog_import_normalize_key(records.normalized_payload ->> 'sourceRef')
        else records.normalized_payload ->> 'sourceRef'
      end as key_value
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id and records.disposition = 'pending'
    union all
    select records.id, records.batch_id, 'cas', records.normalized_payload ->> 'casNumber'
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id and records.disposition = 'pending'
      and records.record_kind = 'ingredient'
      and records.normalized_payload ->> 'casNumber' is not null
    union all
    select records.id, records.batch_id, 'ec', records.normalized_payload ->> 'ecNumber'
    from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id and records.disposition = 'pending'
      and records.record_kind = 'ingredient'
      and records.normalized_payload ->> 'ecNumber' is not null
    union all
    select records.id, records.batch_id, 'synonym', synonyms.value
    from private.catalog_import_staged_records as records
    cross join lateral pg_catalog.jsonb_array_elements_text(
      records.normalized_payload -> 'synonyms'
    ) as synonyms(value)
    where records.batch_id = p_batch_id and records.disposition = 'pending'
      and records.record_kind = 'ingredient'
  ), collided as (
    select keys.key_type, keys.key_value
    from alternate_keys as keys
    group by keys.key_type, keys.key_value
    having count(distinct keys.id) > 1
  )
  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key, conflict_sha256
  )
  select keys.batch_id, keys.id, 'batch_key_mismatch',
    keys.key_type || ':' || keys.key_value,
    private.catalog_import_sha256_text(
      keys.key_type || ':' || keys.key_value || ':' || keys.id::text
    )
  from alternate_keys as keys
  join collided
    on collided.key_type = keys.key_type and collided.key_value = keys.key_value;

  -- A synonym cannot equal any other canonical INCI in the batch (or vice
  -- versa); otherwise lookup meaning depends on traversal order.
  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key, conflict_sha256
  )
  select distinct synonym_owner.batch_id, synonym_owner.id,
    'batch_key_mismatch', 'canonical_synonym:' || synonyms.value,
    private.catalog_import_sha256_text(
      'canonical_synonym:' || synonyms.value || ':' || synonym_owner.id::text
    )
  from private.catalog_import_staged_records as synonym_owner
  cross join lateral pg_catalog.jsonb_array_elements_text(
    synonym_owner.normalized_payload -> 'synonyms'
  ) as synonyms(value)
  join private.catalog_import_staged_records as canonical_owner
    on canonical_owner.batch_id = synonym_owner.batch_id
   and canonical_owner.record_kind = 'ingredient'
   and canonical_owner.natural_key = synonyms.value
   and canonical_owner.id <> synonym_owner.id
   and canonical_owner.disposition = 'pending'
  where synonym_owner.batch_id = p_batch_id
    and synonym_owner.record_kind = 'ingredient'
    and synonym_owner.disposition = 'pending';

  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key, conflict_sha256
  )
  select distinct canonical_owner.batch_id, canonical_owner.id,
    'batch_key_mismatch', 'synonym_canonical:' || synonyms.value,
    private.catalog_import_sha256_text(
      'synonym_canonical:' || synonyms.value || ':' || canonical_owner.id::text
    )
  from private.catalog_import_staged_records as synonym_owner
  cross join lateral pg_catalog.jsonb_array_elements_text(
    synonym_owner.normalized_payload -> 'synonyms'
  ) as synonyms(value)
  join private.catalog_import_staged_records as canonical_owner
    on canonical_owner.batch_id = synonym_owner.batch_id
   and canonical_owner.record_kind = 'ingredient'
   and canonical_owner.natural_key = synonyms.value
   and canonical_owner.id <> synonym_owner.id
   and canonical_owner.disposition = 'pending'
  where synonym_owner.batch_id = p_batch_id
    and synonym_owner.record_kind = 'ingredient'
    and synonym_owner.disposition = 'pending';

  -- Existing catalog identities are review conflicts, never overwrite targets.
  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key,
    existing_entity_id, conflict_sha256
  )
  select records.batch_id, records.id, 'existing_natural_key', records.natural_key,
    coalesce(products.id::text, mappings.product_id::text),
    private.catalog_import_sha256_text(
      'product:' || records.natural_key || ':' || coalesce(products.id::text, mappings.product_id::text)
    )
  from private.catalog_import_staged_records as records
  left join public.products as products on products.barcode = records.natural_key
  left join public.product_barcodes as mappings on mappings.barcode = records.natural_key
  where records.batch_id = p_batch_id
    and records.record_kind = 'product'
    and records.disposition = 'pending'
    and (products.id is not null or mappings.product_id is not null);

  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key,
    existing_entity_id, conflict_sha256
  )
  select records.batch_id, records.id, 'existing_natural_key',
    'source_ref:' || (records.normalized_payload ->> 'sourceRef'),
    pg_catalog.min(products.id::text),
    private.catalog_import_sha256_text(
      'product_source_ref:' || (records.normalized_payload ->> 'sourceRef') || ':' ||
      pg_catalog.string_agg(products.id::text, ',' order by products.id::text)
    )
  from private.catalog_import_staged_records as records
  join public.products as products
    on products.source_ref = records.normalized_payload ->> 'sourceRef'
  where records.batch_id = p_batch_id
    and records.record_kind = 'product'
    and records.disposition = 'pending'
  group by records.batch_id, records.id,
    records.normalized_payload ->> 'sourceRef';

  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key,
    existing_entity_id, conflict_sha256
  )
  select records.batch_id, records.id, 'existing_natural_key', records.natural_key,
    pg_catalog.min(ingredients.id::text),
    private.catalog_import_sha256_text(
      'ingredient:' || records.natural_key || ':' ||
      pg_catalog.string_agg(ingredients.id::text, ',' order by ingredients.id::text)
    )
  from private.catalog_import_staged_records as records
  join public.ingredients as ingredients
    on private.catalog_import_normalize_key(ingredients.inci_name) = records.natural_key
  where records.batch_id = p_batch_id
    and records.record_kind = 'ingredient'
    and records.disposition = 'pending'
  group by records.batch_id, records.id, records.natural_key;

  -- Existing alternate identifiers are equally fail-closed.
  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key,
    existing_entity_id, conflict_sha256
  )
  select records.batch_id, records.id, 'existing_natural_key',
    conflicts.key_type || ':' || conflicts.key_value,
    pg_catalog.min(conflicts.existing_id),
    private.catalog_import_sha256_text(
      conflicts.key_type || ':' || conflicts.key_value || ':' ||
      pg_catalog.string_agg(conflicts.existing_id, ',' order by conflicts.existing_id)
    )
  from private.catalog_import_staged_records as records
  cross join lateral (
    select 'source_ref'::text as key_type,
      private.catalog_import_normalize_key(records.normalized_payload ->> 'sourceRef') as key_value,
      ingredients.id::text as existing_id
    from public.ingredients as ingredients
    where records.record_kind = 'ingredient'
      and private.catalog_import_normalize_key(ingredients.cosing_ref) =
        private.catalog_import_normalize_key(records.normalized_payload ->> 'sourceRef')
    union all
    select 'cas', records.normalized_payload ->> 'casNumber', ingredients.id::text
    from public.ingredients as ingredients
    where records.record_kind = 'ingredient'
      and records.normalized_payload ->> 'casNumber' is not null
      and ingredients.cas_number = records.normalized_payload ->> 'casNumber'
    union all
    select 'ec', records.normalized_payload ->> 'ecNumber', ingredients.id::text
    from public.ingredients as ingredients
    where records.record_kind = 'ingredient'
      and records.normalized_payload ->> 'ecNumber' is not null
      and ingredients.ec_number = records.normalized_payload ->> 'ecNumber'
  ) as conflicts
  where records.batch_id = p_batch_id and records.disposition = 'pending'
  group by records.batch_id, records.id, conflicts.key_type, conflicts.key_value;

  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key,
    existing_entity_id, conflict_sha256
  )
  select records.batch_id, records.id, 'existing_natural_key',
    collisions.key_type || ':' || collisions.key_value,
    pg_catalog.min(collisions.existing_id),
    private.catalog_import_sha256_text(
      collisions.key_type || ':' || collisions.key_value || ':' ||
      pg_catalog.string_agg(collisions.existing_id, ',' order by collisions.existing_id)
    )
  from private.catalog_import_staged_records as records
  cross join lateral pg_catalog.jsonb_array_elements_text(
    records.normalized_payload -> 'synonyms'
  ) as imported_synonyms(value)
  cross join lateral (
    select 'synonym'::text as key_type, imported_synonyms.value as key_value,
      synonyms.id::text as existing_id
    from public.ingredient_synonyms as synonyms
    where private.catalog_import_normalize_key(synonyms.synonym) = imported_synonyms.value
    union all
    select 'synonym_canonical', imported_synonyms.value, ingredients.id::text
    from public.ingredients as ingredients
    where private.catalog_import_normalize_key(ingredients.inci_name) = imported_synonyms.value
  ) as collisions
  where records.batch_id = p_batch_id and records.record_kind = 'ingredient'
    and records.disposition = 'pending'
  group by records.batch_id, records.id, collisions.key_type, collisions.key_value;

  insert into private.catalog_import_conflicts (
    batch_id, staged_record_id, conflict_type, natural_key,
    existing_entity_id, conflict_sha256
  )
  select records.batch_id, records.id, 'existing_natural_key',
    'canonical_synonym:' || records.natural_key, pg_catalog.min(synonyms.id::text),
    private.catalog_import_sha256_text(
      'canonical_synonym:' || records.natural_key || ':' ||
      pg_catalog.string_agg(synonyms.id::text, ',' order by synonyms.id::text)
    )
  from private.catalog_import_staged_records as records
  join public.ingredient_synonyms as synonyms
    on private.catalog_import_normalize_key(synonyms.synonym) = records.natural_key
  where records.batch_id = p_batch_id and records.record_kind = 'ingredient'
    and records.disposition = 'pending'
  group by records.batch_id, records.id, records.natural_key;

  update private.catalog_import_staged_records as records
     set disposition = 'conflict', sealed_at = pg_catalog.now()
   where records.batch_id = p_batch_id
     and records.disposition = 'pending'
     and exists (
       select 1 from private.catalog_import_conflicts as conflicts
       where conflicts.staged_record_id = records.id
     );
  update private.catalog_import_staged_records as records
     set sealed_at = pg_catalog.now()
   where records.batch_id = p_batch_id and records.sealed_at is null;

  select count(*) filter (where records.disposition = 'duplicate')::integer,
         count(*) filter (where records.disposition = 'conflict')::integer,
         count(*) filter (where records.disposition = 'pending')::integer
    into v_duplicate_count, v_conflict_count, v_canonical_count
    from private.catalog_import_staged_records as records
   where records.batch_id = p_batch_id;

  update public.catalog_import_batches as batches
     set status = case when v_conflict_count = 0 then 'finalized' else 'blocked' end,
         records_sha256 = v_computed_sha256,
         candidates_sha256 = v_candidates_sha256,
         finalize_operation_key = p_operation_key,
         finalize_request_sha256 = v_request_sha256,
         duplicate_record_count = v_duplicate_count,
         conflict_record_count = v_conflict_count,
         product_count = (
           select count(*)::integer from private.catalog_import_staged_records as records
           where records.batch_id = p_batch_id and records.record_kind = 'product'
             and records.disposition = 'pending'
         ),
         ingredient_count = (
           select count(*)::integer from private.catalog_import_staged_records as records
           where records.batch_id = p_batch_id and records.record_kind = 'ingredient'
             and records.disposition = 'pending'
         ),
         finalized_at = pg_catalog.now(),
         finished_at = case when v_conflict_count > 0 then pg_catalog.now() else batches.finished_at end
   where batches.id = p_batch_id;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'recordOrdinal', records.record_ordinal,
    'recordSha256', records.record_sha256,
    'recordKind', records.record_kind,
    'canonicalKey', records.natural_key,
    'disposition', records.disposition
  ) order by records.record_ordinal) into v_record_receipts
  from private.catalog_import_staged_records as records
  where records.batch_id = p_batch_id;

  return query select p_batch_id,
    case when v_conflict_count = 0 then 'finalized' else 'blocked' end,
    v_canonical_count, v_duplicate_count, v_conflict_count,
    v_computed_sha256, v_candidates_sha256, v_record_receipts, false;
end;
$$;

comment on function public.finalize_catalog_import(uuid, text, integer)
  is 'Service-only exact-count/digest sealing and conservative dedupe/conflict routing.';
revoke all on function public.finalize_catalog_import(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.finalize_catalog_import(uuid, text, integer)
  to service_role;

create or replace function public.verify_catalog_import(
  p_batch_id uuid,
  p_operation_key text,
  p_records_sha256 text,
  p_verification_evidence_sha256 text
)
returns table (batch_id uuid, batch_status text, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_request_sha256 text;
begin
  if p_batch_id is null or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_records_sha256 is null or p_records_sha256 !~ '^[a-f0-9]{64}$'
     or p_verification_evidence_sha256 is null
     or p_verification_evidence_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_IMPORT_VERIFY_INPUT_INVALID' using errcode = '22023';
  end if;
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id, 'operationKey', p_operation_key,
      'recordsSha256', p_records_sha256,
      'verificationEvidenceSha256', p_verification_evidence_sha256
    )::text
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch from public.catalog_import_batches as batches
   where batches.id = p_batch_id for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.catalog_import_batches as other_batches
    where other_batches.verification_operation_key = p_operation_key
      and other_batches.id <> p_batch_id
  ) then
    raise exception 'CATALOG_IMPORT_VERIFY_REPLAY_CHANGED' using errcode = '22023';
  end if;
  if v_batch.verification_operation_key is not null then
    if v_batch.verification_operation_key <> p_operation_key
       or v_batch.verification_request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_VERIFY_REPLAY_CHANGED' using errcode = '22023';
    end if;
    return query select v_batch.id, 'verified'::text, true;
    return;
  end if;
  if v_batch.status <> 'finalized'
     or v_batch.records_sha256 <> p_records_sha256
     or not private.catalog_import_batch_integrity(p_batch_id)
     or v_batch.staged_record_count <> v_batch.expected_record_count
     or v_batch.conflict_record_count <> 0
     or v_batch.qa_blocker_count <> 0 or v_batch.qa_warning_count <> 0
     or v_batch.artifact_kind <> 'production' or v_batch.territory <> 'US'
     or not exists (
       select 1 from public.catalog_sources as sources
       where sources.id = v_batch.source_id
         and sources.production_approved is true
         and sources.review_status = 'legal_approved'
         and nullif(pg_catalog.btrim(sources.reviewed_by), '') is not null
         and sources.reviewed_at is not null and sources.reviewed_at <= pg_catalog.now()
         and (sources.requires_attribution is false or (
           nullif(pg_catalog.btrim(sources.attribution_text), '') is not null
           and nullif(pg_catalog.btrim(sources.attribution_url), '') is not null
         ))
     ) then
    raise exception 'CATALOG_IMPORT_VERIFY_GATE_CLOSED' using errcode = '55000';
  end if;
  update public.catalog_import_batches as batches
     set status = 'verified', verification_operation_key = p_operation_key,
         verification_request_sha256 = v_request_sha256,
         verification_evidence_sha256 = p_verification_evidence_sha256,
         verified_at = pg_catalog.now()
   where batches.id = p_batch_id;
  return query select p_batch_id, 'verified'::text, false;
end;
$$;

comment on function public.verify_catalog_import(uuid, text, text, text)
  is 'Service-only verification of an already sealed, conflict-free batch.';
revoke all on function public.verify_catalog_import(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.verify_catalog_import(uuid, text, text, text)
  to service_role;

-- Deliberately migration-owner-only until CAT-08 supplies a dedicated,
-- separately authenticated catalog reviewer role.
create or replace function public.review_catalog_import(
  p_batch_id uuid,
  p_operation_key text,
  p_decisions jsonb,
  p_expected_candidates_sha256 text,
  p_expected_batch_evidence_sha256 text,
  p_expected_verification_evidence_sha256 text,
  p_reviewer_ids text[],
  p_review_ticket text,
  p_review_evidence_sha256 text
)
returns table (
  batch_id uuid,
  batch_status text,
  accepted_record_count integer,
  rejected_record_count integer,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_request_sha256 text;
  v_pending_count integer;
  v_accepted integer;
  v_rejected integer;
  v_reviewed_by text;
  v_batch_evidence_sha256 text;
begin
  if p_batch_id is null or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or pg_catalog.jsonb_typeof(p_decisions) is distinct from 'array'
     or pg_catalog.pg_column_size(p_decisions) > 33554432
     or p_expected_candidates_sha256 is null
     or p_expected_candidates_sha256 !~ '^[a-f0-9]{64}$'
     or p_expected_batch_evidence_sha256 is null
     or p_expected_batch_evidence_sha256 !~ '^[a-f0-9]{64}$'
     or p_expected_verification_evidence_sha256 is null
     or p_expected_verification_evidence_sha256 !~ '^[a-f0-9]{64}$'
     or p_reviewer_ids is null
     or pg_catalog.cardinality(p_reviewer_ids) <> 2
     or p_reviewer_ids[1] is null or p_reviewer_ids[2] is null
     or p_reviewer_ids[1] !~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
     or p_reviewer_ids[2] !~ '^[a-z0-9][a-z0-9._:-]{2,127}$'
     or p_reviewer_ids[1] = p_reviewer_ids[2]
     or pg_catalog.length(pg_catalog.array_to_string(p_reviewer_ids, '+')) > 200
     or not private.catalog_import_text_is_bounded(p_review_ticket, 200)
     or p_review_evidence_sha256 is null
     or p_review_evidence_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_IMPORT_REVIEW_INPUT_INVALID' using errcode = '22023';
  end if;
  v_reviewed_by := pg_catalog.array_to_string(p_reviewer_ids, '+');
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id, 'operationKey', p_operation_key,
      'decisions', p_decisions,
      'expectedCandidatesSha256', p_expected_candidates_sha256,
      'databaseBatchEvidenceSha256', p_expected_batch_evidence_sha256,
      'expectedVerificationEvidenceSha256', p_expected_verification_evidence_sha256,
      'reviewerIds', p_reviewer_ids,
      'reviewTicket', p_review_ticket,
      'reviewEvidenceSha256', p_review_evidence_sha256
    )::text
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch from public.catalog_import_batches as batches
   where batches.id = p_batch_id for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;
  v_batch_evidence_sha256 := private.catalog_import_batch_evidence_sha256(p_batch_id);
  if exists (
    select 1 from public.catalog_import_batches as other_batches
    where other_batches.review_operation_key = p_operation_key
      and other_batches.id <> p_batch_id
  ) then
    raise exception 'CATALOG_IMPORT_REVIEW_REPLAY_CHANGED' using errcode = '22023';
  end if;
  if v_batch.review_operation_key is not null then
    if v_batch.review_operation_key <> p_operation_key
       or v_batch.review_request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_REVIEW_REPLAY_CHANGED' using errcode = '22023';
    end if;
    return query select v_batch.id, 'reviewed'::text,
      v_batch.accepted_record_count, v_batch.rejected_record_count, true;
    return;
  end if;
  if v_batch.status <> 'verified'
     or v_batch.candidates_sha256 <> p_expected_candidates_sha256
     or v_batch_evidence_sha256 <> p_expected_batch_evidence_sha256
     or v_batch.verification_evidence_sha256 <> p_expected_verification_evidence_sha256
     or not private.catalog_import_batch_integrity(p_batch_id) then
    raise exception 'CATALOG_IMPORT_REVIEW_GATE_CLOSED' using errcode = '55000';
  end if;
  select count(*)::integer into v_pending_count
    from private.catalog_import_staged_records as records
   where records.batch_id = p_batch_id and records.disposition = 'pending';

  -- Validate the JSON domain before jsonb_to_recordset is allowed to coerce
  -- anything.  The completion artifact is exactly four typed fields; a text
  -- "1", numeric decision, or other coercible lookalike is not review proof.
  if pg_catalog.jsonb_array_length(p_decisions) <> v_pending_count
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(p_decisions) as decisions(value)
       where case
         when pg_catalog.jsonb_typeof(decisions.value) is distinct from 'object'
           then true
         else
           (select count(*) from pg_catalog.jsonb_object_keys(decisions.value)) <> 4
           or not (decisions.value ?& array[
             'recordOrdinal', 'recordSha256', 'decision', 'reason'
           ])
           or pg_catalog.jsonb_typeof(decisions.value -> 'recordOrdinal') is distinct from 'number'
           or decisions.value ->> 'recordOrdinal' !~ '^[1-9][0-9]{0,5}$'
           or pg_catalog.jsonb_typeof(decisions.value -> 'recordSha256') is distinct from 'string'
           or pg_catalog.jsonb_typeof(decisions.value -> 'decision') is distinct from 'string'
           or pg_catalog.jsonb_typeof(decisions.value -> 'reason') is distinct from 'string'
       end
     ) then
    raise exception 'CATALOG_IMPORT_REVIEW_DECISIONS_INCOMPLETE' using errcode = '22023';
  end if;

  if exists (
       select 1
       from pg_catalog.jsonb_to_recordset(p_decisions)
         as decisions("recordOrdinal" integer, "recordSha256" text, decision text, reason text)
       where decisions."recordOrdinal" is null
         or decisions."recordSha256" is null
         or decisions."recordSha256" !~ '^[a-f0-9]{64}$'
         or decisions.decision not in ('accepted', 'rejected')
         or not private.catalog_import_text_is_bounded(decisions.reason, 1000)
     )
     or (
       select count(distinct decisions."recordOrdinal")
       from pg_catalog.jsonb_to_recordset(p_decisions)
         as decisions("recordOrdinal" integer)
     ) <> v_pending_count
     or exists (
       select 1
       from pg_catalog.jsonb_to_recordset(p_decisions)
         as decisions("recordOrdinal" integer, "recordSha256" text)
       left join private.catalog_import_staged_records as records
         on records.batch_id = p_batch_id
        and records.record_ordinal = decisions."recordOrdinal"
        and records.record_sha256 = decisions."recordSha256"
        and records.disposition = 'pending'
       where records.id is null
     )
     or exists (
       select 1
       from pg_catalog.jsonb_to_recordset(p_decisions)
         as decisions("recordOrdinal" integer, "recordSha256" text, decision text)
       join private.catalog_import_staged_records as records
         on records.batch_id = p_batch_id
        and records.record_ordinal = decisions."recordOrdinal"
        and records.record_sha256 = decisions."recordSha256"
       where decisions.decision = 'accepted'
         and records.record_kind = 'ingredient'
         and records.normalized_payload ->> 'annexStatus' is not null
         and records.normalized_payload ->> 'annexStatus' not in (
           'restricted', 'prohibited', 'preservative', 'uv_filter', 'colourant'
         )
     ) then
    raise exception 'CATALOG_IMPORT_REVIEW_DECISIONS_INCOMPLETE' using errcode = '22023';
  end if;

  insert into private.catalog_import_review_events (
    batch_id, staged_record_id, decision, reason, review_ticket,
    reviewed_by, review_evidence_sha256, request_sha256
  )
  select p_batch_id, records.id, decisions.decision,
    decisions.reason, p_review_ticket, v_reviewed_by,
    p_review_evidence_sha256, v_request_sha256
  from pg_catalog.jsonb_to_recordset(p_decisions)
    as decisions("recordOrdinal" integer, "recordSha256" text, decision text, reason text)
  join private.catalog_import_staged_records as records
    on records.batch_id = p_batch_id
   and records.record_ordinal = decisions."recordOrdinal"
   and records.record_sha256 = decisions."recordSha256"
   and records.disposition = 'pending';

  perform pg_catalog.set_config(
    'onskin.catalog_import_transition', '0057-owner-transition', true
  );
  update private.catalog_import_staged_records as records
     set disposition = decisions.decision
    from pg_catalog.jsonb_to_recordset(p_decisions)
      as decisions("recordOrdinal" integer, "recordSha256" text, decision text)
   where records.batch_id = p_batch_id
     and records.record_ordinal = decisions."recordOrdinal"
     and records.record_sha256 = decisions."recordSha256"
     and records.disposition = 'pending';
  select count(*) filter (where records.disposition = 'accepted')::integer,
         count(*) filter (where records.disposition = 'rejected')::integer
    into v_accepted, v_rejected
    from private.catalog_import_staged_records as records
   where records.batch_id = p_batch_id;
  update public.catalog_import_batches as batches
     set status = 'reviewed', review_operation_key = p_operation_key,
         review_request_sha256 = v_request_sha256,
         review_ticket = p_review_ticket,
         review_evidence_sha256 = p_review_evidence_sha256,
         reviewed_by = v_reviewed_by, reviewer_ids = p_reviewer_ids,
         approved_at = pg_catalog.now(),
         accepted_record_count = v_accepted,
         rejected_record_count = v_rejected
   where batches.id = p_batch_id;
  return query select p_batch_id, 'reviewed'::text, v_accepted, v_rejected, false;
end;
$$;

comment on function public.review_catalog_import(uuid, text, jsonb, text, text, text, text[], text, text)
  is 'Migration-owner-only complete record review; runtime service authority is explicitly excluded.';
revoke all on function public.review_catalog_import(uuid, text, jsonb, text, text, text, text[], text, text)
  from public, anon, authenticated, service_role;

create or replace function private.record_catalog_import_projection(
  p_batch_id uuid,
  p_staged_record_id uuid,
  p_promotion_event_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_snapshot jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_revision integer;
  v_before_sha256 text;
  v_after_sha256 text;
begin
  select revisions.revision_number, revisions.projection_sha256
    into v_revision, v_before_sha256
    from private.catalog_import_entity_revisions as revisions
   where revisions.entity_type = p_entity_type
     and revisions.entity_id = p_entity_id
   order by revisions.revision_number desc
   limit 1;
  v_revision := coalesce(v_revision, 0) + 1;
  v_after_sha256 := private.catalog_import_sha256_text(p_snapshot::text);
  insert into private.catalog_import_entity_revisions (
    batch_id, staged_record_id, promotion_event_id, entity_type, entity_id,
    revision_number, revision_action, projection_sha256, projection_snapshot
  ) values (
    p_batch_id, p_staged_record_id, p_promotion_event_id, p_entity_type,
    p_entity_id, v_revision, p_action, v_after_sha256, p_snapshot
  );
  insert into private.catalog_import_batch_effects (
    batch_id, staged_record_id, promotion_event_id, effect_type, entity_type,
    entity_id, before_sha256, after_sha256
  ) values (
    p_batch_id, p_staged_record_id, p_promotion_event_id, p_action,
    p_entity_type, p_entity_id, v_before_sha256, v_after_sha256
  );
end;
$$;
revoke all on function private.record_catalog_import_projection(
  uuid, uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;

-- Promotion is insert-only. Accepted import review means "eligible to enter
-- curation", not clinically reviewed or recommendation-ready: every new row
-- starts needs_review/unverified and therefore remains non-servable.
create or replace function public.promote_catalog_import(
  p_batch_id uuid,
  p_operation_key text,
  p_operator text,
  p_review_ticket text,
  p_review_evidence_sha256 text
)
returns table (
  batch_id uuid,
  promotion_event_id uuid,
  affected_entity_count integer,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_source public.catalog_sources%rowtype;
  v_request_sha256 text;
  v_existing_event private.catalog_import_promotion_events%rowtype;
  v_event_id uuid;
  v_record private.catalog_import_staged_records%rowtype;
  v_product_id uuid;
  v_ingredient_id uuid;
  v_ingredient_list_id uuid;
  v_barcode_entity_id uuid;
  v_synonym_id uuid;
  v_synonym text;
  v_snapshot jsonb;
  v_affected integer;
begin
  if p_batch_id is null or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_operator is null
     or p_operator !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_review_ticket is null or p_review_ticket <> pg_catalog.btrim(p_review_ticket)
     or pg_catalog.length(p_review_ticket) not between 1 and 200
     or p_review_evidence_sha256 is null
     or p_review_evidence_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CATALOG_IMPORT_PROMOTION_INPUT_INVALID' using errcode = '22023';
  end if;
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id, 'operationKey', p_operation_key,
      'operator', p_operator, 'reviewTicket', p_review_ticket,
      'reviewEvidenceSha256', p_review_evidence_sha256
    )::text
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-promotion-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch from public.catalog_import_batches as batches
   where batches.id = p_batch_id for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;

  select events.* into v_existing_event
    from private.catalog_import_promotion_events as events
   where events.operation_key = p_operation_key
      or (events.batch_id = p_batch_id and events.event_type = 'promotion');
  if found then
    if v_existing_event.batch_id <> p_batch_id
       or v_existing_event.event_type <> 'promotion'
       or v_existing_event.operation_key <> p_operation_key
       or v_existing_event.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_PROMOTION_REPLAY_CHANGED' using errcode = '22023';
    end if;
    return query select p_batch_id, v_existing_event.id,
      v_existing_event.affected_entity_count, true;
    return;
  end if;

  if v_batch.status <> 'reviewed'
     or v_batch.accepted_record_count < 1
     or not private.catalog_import_batch_integrity(p_batch_id)
     or pg_catalog.lower(p_operator) = pg_catalog.lower(v_batch.reviewed_by)
     or exists (
       select 1
       from pg_catalog.unnest(v_batch.reviewer_ids) as reviewers(reviewer_id)
       where pg_catalog.lower(reviewers.reviewer_id) = pg_catalog.lower(p_operator)
     )
     or v_batch.review_ticket <> p_review_ticket
     or v_batch.review_evidence_sha256 <> p_review_evidence_sha256
     or v_batch.conflict_record_count <> 0
     or v_batch.qa_blocker_count <> 0 or v_batch.qa_warning_count <> 0
     or v_batch.artifact_kind <> 'production' or v_batch.territory <> 'US' then
    raise exception 'CATALOG_IMPORT_PROMOTION_GATE_CLOSED' using errcode = '55000';
  end if;
  select sources.* into v_source from public.catalog_sources as sources
   where sources.id = v_batch.source_id
     and sources.production_approved is true
     and sources.review_status = 'legal_approved'
     and nullif(pg_catalog.btrim(sources.reviewed_by), '') is not null
     and sources.reviewed_at is not null and sources.reviewed_at <= pg_catalog.now()
     and (sources.requires_attribution is false or (
       nullif(pg_catalog.btrim(sources.attribution_text), '') is not null
       and nullif(pg_catalog.btrim(sources.attribution_url), '') is not null
     ))
   for share;
  if not found then
    raise exception 'CATALOG_IMPORT_SOURCE_NOT_APPROVED' using errcode = '55000';
  end if;

  -- Recheck natural keys inside the global promotion lock. A concurrent or
  -- post-finalization catalog insert aborts the whole transaction with no
  -- projection or audit residue.
  if exists (
       select 1 from private.catalog_import_staged_records as records
       left join public.products as products on products.barcode = records.natural_key
       left join public.product_barcodes as mappings on mappings.barcode = records.natural_key
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'product'
         and (products.id is not null or mappings.product_id is not null)
     )
     or exists (
       select 1 from private.catalog_import_staged_records as records
       join public.products as products
         on products.source_ref = records.normalized_payload ->> 'sourceRef'
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'product'
     )
     or exists (
       select 1 from private.catalog_import_staged_records as records
       join public.ingredients as ingredients
         on private.catalog_import_normalize_key(ingredients.inci_name) = records.natural_key
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'ingredient'
     )
     or exists (
       select 1 from private.catalog_import_staged_records as records
       join public.ingredients as ingredients
         on private.catalog_import_normalize_key(ingredients.cosing_ref) =
              private.catalog_import_normalize_key(records.normalized_payload ->> 'sourceRef')
         or (
           records.normalized_payload ->> 'casNumber' is not null
           and ingredients.cas_number = records.normalized_payload ->> 'casNumber'
         )
         or (
           records.normalized_payload ->> 'ecNumber' is not null
           and ingredients.ec_number = records.normalized_payload ->> 'ecNumber'
         )
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'ingredient'
     )
     or exists (
       select 1
       from private.catalog_import_staged_records as records
       cross join lateral pg_catalog.jsonb_array_elements_text(
         records.normalized_payload -> 'synonyms'
       ) as imported_synonyms(value)
       join public.ingredient_synonyms as synonyms
         on private.catalog_import_normalize_key(synonyms.synonym) = imported_synonyms.value
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'ingredient'
     )
     or exists (
       select 1
       from private.catalog_import_staged_records as records
       cross join lateral pg_catalog.jsonb_array_elements_text(
         records.normalized_payload -> 'synonyms'
       ) as imported_synonyms(value)
       join public.ingredients as ingredients
         on private.catalog_import_normalize_key(ingredients.inci_name) = imported_synonyms.value
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'ingredient'
     )
     or exists (
       select 1
       from private.catalog_import_staged_records as records
       join public.ingredient_synonyms as synonyms
         on private.catalog_import_normalize_key(synonyms.synonym) = records.natural_key
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'ingredient'
     )
     or exists (
       select 1
       from private.catalog_import_staged_records as records
       cross join lateral pg_catalog.jsonb_array_elements_text(
         records.normalized_payload -> 'synonyms'
       ) as imported_synonyms(value)
       where records.batch_id = p_batch_id and records.disposition = 'accepted'
         and records.record_kind = 'ingredient'
       group by imported_synonyms.value
       having count(*) > 1
     ) then
    raise exception 'CATALOG_IMPORT_DESTINATION_CONFLICT' using errcode = '23505';
  end if;

  select coalesce(sum(
    case when records.record_kind = 'product' then
      2 + case when records.normalized_payload ->> 'ingredientsText' is null then 0 else 1 end
    else
      1 + pg_catalog.jsonb_array_length(records.normalized_payload -> 'synonyms')
    end
  ), 0)::integer into v_affected
  from private.catalog_import_staged_records as records
  where records.batch_id = p_batch_id and records.disposition = 'accepted';

  insert into private.catalog_import_promotion_events (
    batch_id, event_type, operation_key, request_sha256, actor,
    review_ticket, review_evidence_sha256, affected_entity_count
  ) values (
    p_batch_id, 'promotion', p_operation_key, v_request_sha256, p_operator,
    p_review_ticket, p_review_evidence_sha256, v_affected
  ) returning id into v_event_id;

  for v_record in
    select records.* from private.catalog_import_staged_records as records
    where records.batch_id = p_batch_id and records.disposition = 'accepted'
    order by records.record_ordinal
  loop
    if v_record.record_kind = 'product' then
      v_product_id := gen_random_uuid();
      insert into public.products (
        id, barcode, name, brand, category, canonical_name, display_name,
        normalized_brand_name, product_type, region, source, source_id,
        source_ref, source_url, source_snapshot_date, status, review_status,
        data_quality_score, ingredient_quality_score, barcode_quality_score,
        category_quality_score, quality_grade, recommendation_eligible,
        ingredient_parse_status, ingredient_parse_confidence, parser_version,
        unresolved_correction_count, import_batch_id, import_staged_record_id,
        import_record_ordinal, import_record_sha256, import_projection_status
      ) values (
        v_product_id, v_record.normalized_payload ->> 'barcode',
        v_record.normalized_payload ->> 'name',
        v_record.normalized_payload ->> 'brand',
        v_record.normalized_payload ->> 'category',
        v_record.normalized_payload ->> 'name',
        v_record.normalized_payload ->> 'name',
        private.catalog_import_normalize_label(v_record.normalized_payload ->> 'brand'),
        v_record.normalized_payload ->> 'category', 'US', v_source.source_key,
        v_source.id, v_record.normalized_payload ->> 'sourceRef',
        v_record.normalized_payload ->> 'sourceUrl', v_batch.snapshot_date,
        'active', 'needs_review', 0, 0, 0, 0, 'unverified', false,
        'not_parsed', 0, v_batch.parser_version, 0, p_batch_id, v_record.id,
        v_record.record_ordinal, v_record.record_sha256, 'active'
      );
      select pg_catalog.to_jsonb(products) into v_snapshot
        from public.products as products where products.id = v_product_id;
      perform private.record_catalog_import_projection(
        p_batch_id, v_record.id, v_event_id, 'product', v_product_id::text,
        'inserted', v_snapshot
      );

      insert into public.product_barcodes (
        barcode, product_id, source_id, confidence, review_status,
        import_batch_id, import_staged_record_id, import_record_ordinal,
        import_record_sha256, import_projection_status, import_entity_id
      ) values (
        v_record.normalized_payload ->> 'barcode', v_product_id, v_source.id,
        1, 'needs_review', p_batch_id, v_record.id, v_record.record_ordinal,
        v_record.record_sha256, 'active', gen_random_uuid()
      );
      select mappings.import_entity_id, pg_catalog.to_jsonb(mappings)
        into v_barcode_entity_id, v_snapshot
        from public.product_barcodes as mappings
       where mappings.barcode = v_record.normalized_payload ->> 'barcode';
      perform private.record_catalog_import_projection(
        p_batch_id, v_record.id, v_event_id, 'barcode',
        v_barcode_entity_id::text, 'inserted', v_snapshot
      );

      if v_record.normalized_payload ->> 'ingredientsText' is not null then
        v_ingredient_list_id := gen_random_uuid();
        insert into public.product_ingredient_lists (
          id, product_id, source_id, raw_text, locale, parse_status,
          parse_confidence, parser_version, token_count, unmatched_count,
          source_snapshot_date, review_status, import_batch_id,
          import_staged_record_id, import_record_ordinal,
          import_record_sha256, import_projection_status
        ) values (
          v_ingredient_list_id, v_product_id, v_source.id,
          v_record.normalized_payload ->> 'ingredientsText', 'en',
          'not_parsed', 0, v_batch.parser_version, 0, 0, v_batch.snapshot_date,
          'needs_review', p_batch_id, v_record.id, v_record.record_ordinal,
          v_record.record_sha256, 'active'
        );
        select pg_catalog.to_jsonb(lists) into v_snapshot
          from public.product_ingredient_lists as lists
         where lists.id = v_ingredient_list_id;
        perform private.record_catalog_import_projection(
          p_batch_id, v_record.id, v_event_id, 'ingredient_list',
          v_ingredient_list_id::text, 'inserted', v_snapshot
        );
      end if;
    else
      v_ingredient_id := gen_random_uuid();
      insert into public.ingredients (
        id, inci_name, display_name, cas_number, ec_number, cosing_ref,
        annex_status, source, normalized_inci_name,
        review_status, source_id, source_snapshot_date, source_url,
        ingredient_quality_score, import_batch_id, import_staged_record_id,
        import_record_ordinal, import_record_sha256, import_projection_status
      ) values (
        v_ingredient_id, v_record.normalized_payload ->> 'inciName',
        v_record.normalized_payload ->> 'displayName',
        v_record.normalized_payload ->> 'casNumber',
        v_record.normalized_payload ->> 'ecNumber',
        v_record.normalized_payload ->> 'sourceRef',
        v_record.normalized_payload ->> 'annexStatus',
        v_source.source_key,
        v_record.natural_key, 'needs_review', v_source.id,
        v_batch.snapshot_date, v_record.normalized_payload ->> 'sourceUrl', 0,
        p_batch_id, v_record.id, v_record.record_ordinal,
        v_record.record_sha256, 'active'
      );
      select pg_catalog.to_jsonb(ingredients) into v_snapshot
        from public.ingredients as ingredients where ingredients.id = v_ingredient_id;
      perform private.record_catalog_import_projection(
        p_batch_id, v_record.id, v_event_id, 'ingredient',
        v_ingredient_id::text, 'inserted', v_snapshot
      );

      for v_synonym in
        select synonyms.value from pg_catalog.jsonb_array_elements_text(
          v_record.normalized_payload -> 'synonyms'
        ) as synonyms(value)
      loop
        v_synonym_id := gen_random_uuid();
        insert into public.ingredient_synonyms (
          id, ingredient_id, synonym, normalized_synonym, source_id,
          review_status, import_batch_id, import_staged_record_id,
          import_record_ordinal, import_record_sha256, import_projection_status
        ) values (
          v_synonym_id, v_ingredient_id, v_synonym, v_synonym, v_source.id,
          'needs_review', p_batch_id, v_record.id, v_record.record_ordinal,
          v_record.record_sha256, 'active'
        );
        select pg_catalog.to_jsonb(synonyms) into v_snapshot
          from public.ingredient_synonyms as synonyms where synonyms.id = v_synonym_id;
        perform private.record_catalog_import_projection(
          p_batch_id, v_record.id, v_event_id, 'synonym',
          v_synonym_id::text, 'inserted', v_snapshot
        );
      end loop;
    end if;
  end loop;

  update public.catalog_import_batches as batches
     set status = 'promoted', promoted_at = pg_catalog.now(),
         finished_at = pg_catalog.now()
   where batches.id = p_batch_id;
  return query select p_batch_id, v_event_id, v_affected, false;
end;
$$;

comment on function public.promote_catalog_import(uuid, text, text, text, text)
  is 'Migration-owner-only insert-only projection of completely reviewed catalog records.';
revoke all on function public.promote_catalog_import(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

-- Rollback retires only projections owned by this batch. Catalog identities,
-- user shelf FKs, correction history, and every provenance event remain.
create or replace function public.rollback_catalog_import(
  p_batch_id uuid,
  p_operation_key text,
  p_operator text,
  p_review_ticket text,
  p_review_evidence_sha256 text,
  p_reason text
)
returns table (
  batch_id uuid,
  rollback_event_id uuid,
  affected_entity_count integer,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch public.catalog_import_batches%rowtype;
  v_request_sha256 text;
  v_existing_event private.catalog_import_promotion_events%rowtype;
  v_event_id uuid;
  v_affected integer;
  v_projection record;
begin
  if p_batch_id is null or p_operation_key is null
     or p_operation_key !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$'
     or p_operator is null
     or p_operator !~ '^[A-Za-z0-9][A-Za-z0-9._@:+/-]{2,199}$'
     or p_review_ticket is null or p_review_ticket <> pg_catalog.btrim(p_review_ticket)
     or pg_catalog.length(p_review_ticket) not between 1 and 200
     or p_review_evidence_sha256 is null
     or p_review_evidence_sha256 !~ '^[a-f0-9]{64}$'
     or p_reason is null or p_reason <> pg_catalog.btrim(p_reason)
     or pg_catalog.length(p_reason) not between 10 and 1000 then
    raise exception 'CATALOG_IMPORT_ROLLBACK_INPUT_INVALID' using errcode = '22023';
  end if;
  v_request_sha256 := private.catalog_import_sha256_text(
    pg_catalog.jsonb_build_object(
      'batchId', p_batch_id, 'operationKey', p_operation_key,
      'operator', p_operator, 'reviewTicket', p_review_ticket,
      'reviewEvidenceSha256', p_review_evidence_sha256, 'reason', p_reason
    )::text
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-promotion-global', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-import-batch:' || p_batch_id::text, 0)
  );
  select batches.* into v_batch from public.catalog_import_batches as batches
   where batches.id = p_batch_id for update;
  if not found then
    raise exception 'CATALOG_IMPORT_BATCH_NOT_FOUND' using errcode = '22023';
  end if;
  select events.* into v_existing_event
    from private.catalog_import_promotion_events as events
   where events.operation_key = p_operation_key
      or (events.batch_id = p_batch_id and events.event_type = 'rollback');
  if found then
    if v_existing_event.batch_id <> p_batch_id
       or v_existing_event.event_type <> 'rollback'
       or v_existing_event.operation_key <> p_operation_key
       or v_existing_event.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_IMPORT_ROLLBACK_REPLAY_CHANGED' using errcode = '22023';
    end if;
    return query select p_batch_id, v_existing_event.id,
      v_existing_event.affected_entity_count, true;
    return;
  end if;
  if v_batch.status <> 'promoted'
     or v_batch.review_ticket <> p_review_ticket
     or v_batch.review_evidence_sha256 <> p_review_evidence_sha256
     or pg_catalog.lower(p_operator) = pg_catalog.lower(v_batch.reviewed_by)
     or exists (
       select 1
       from pg_catalog.unnest(v_batch.reviewer_ids) as reviewers(reviewer_id)
       where pg_catalog.lower(reviewers.reviewer_id) = pg_catalog.lower(p_operator)
     ) then
    raise exception 'CATALOG_IMPORT_ROLLBACK_GATE_CLOSED' using errcode = '55000';
  end if;

  select (
    (select count(*) from public.products where import_batch_id = p_batch_id)
    + (select count(*) from public.product_barcodes where import_batch_id = p_batch_id)
    + (select count(*) from public.product_ingredient_lists where import_batch_id = p_batch_id)
    + (select count(*) from public.ingredients where import_batch_id = p_batch_id)
    + (select count(*) from public.ingredient_synonyms where import_batch_id = p_batch_id)
  )::integer into v_affected;
  insert into private.catalog_import_promotion_events (
    batch_id, event_type, operation_key, request_sha256, actor,
    review_ticket, review_evidence_sha256, reason, affected_entity_count
  ) values (
    p_batch_id, 'rollback', p_operation_key, v_request_sha256, p_operator,
    p_review_ticket, p_review_evidence_sha256, p_reason, v_affected
  ) returning id into v_event_id;

  update public.products
     set status = 'blocked', review_status = 'blocked', quality_grade = 'blocked',
         recommendation_eligible = false,
         retired_import_natural_key = barcode,
         barcode = null,
         source_ref = 'retired:' || id::text,
         import_projection_status = 'retired'
   where import_batch_id = p_batch_id and import_projection_status = 'active';
  update public.product_barcodes
     set review_status = 'blocked',
         retired_import_natural_key = barcode,
         barcode = 'retired:' || import_entity_id::text,
         import_projection_status = 'retired'
   where import_batch_id = p_batch_id and import_projection_status = 'active';
  update public.product_ingredient_lists
     set review_status = 'blocked', import_projection_status = 'retired',
         updated_at = pg_catalog.now()
   where import_batch_id = p_batch_id and import_projection_status = 'active';
  update public.ingredients
     set review_status = 'blocked',
         retired_import_natural_key = inci_name,
         inci_name = '[RETIRED:' || id::text || ']',
         normalized_inci_name = '[RETIRED:' || id::text || ']',
         cosing_ref = null,
         cas_number = null,
         ec_number = null,
         import_projection_status = 'retired'
   where import_batch_id = p_batch_id and import_projection_status = 'active';
  update public.ingredient_synonyms
     set review_status = 'blocked',
         retired_import_natural_key = synonym,
         synonym = '[RETIRED:' || id::text || ']',
         normalized_synonym = '[RETIRED:' || id::text || ']',
         import_projection_status = 'retired'
   where import_batch_id = p_batch_id and import_projection_status = 'active';

  for v_projection in
    select 'product'::text as entity_type, products.id::text as entity_id,
      products.import_staged_record_id as staged_record_id,
      pg_catalog.to_jsonb(products) as snapshot
    from public.products as products where products.import_batch_id = p_batch_id
    union all
    select 'barcode', mappings.import_entity_id::text, mappings.import_staged_record_id,
      pg_catalog.to_jsonb(mappings)
    from public.product_barcodes as mappings where mappings.import_batch_id = p_batch_id
    union all
    select 'ingredient_list', lists.id::text, lists.import_staged_record_id,
      pg_catalog.to_jsonb(lists)
    from public.product_ingredient_lists as lists where lists.import_batch_id = p_batch_id
    union all
    select 'ingredient', ingredients.id::text, ingredients.import_staged_record_id,
      pg_catalog.to_jsonb(ingredients)
    from public.ingredients as ingredients where ingredients.import_batch_id = p_batch_id
    union all
    select 'synonym', synonyms.id::text, synonyms.import_staged_record_id,
      pg_catalog.to_jsonb(synonyms)
    from public.ingredient_synonyms as synonyms where synonyms.import_batch_id = p_batch_id
  loop
    perform private.record_catalog_import_projection(
      p_batch_id, v_projection.staged_record_id, v_event_id,
      v_projection.entity_type, v_projection.entity_id, 'retired',
      v_projection.snapshot
    );
  end loop;

  update public.catalog_import_batches as batches
     set status = 'retired', retired_at = pg_catalog.now(),
         rollback_reason = p_reason, finished_at = pg_catalog.now()
   where batches.id = p_batch_id;
  return query select p_batch_id, v_event_id, v_affected, false;
end;
$$;

comment on function public.rollback_catalog_import(uuid, text, text, text, text, text)
  is 'Migration-owner-only fail-closed retirement preserving catalog and user references.';
revoke all on function public.rollback_catalog_import(uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;

-- Positive ingredient/read predicates mirror the product gate without exposing
-- source-review metadata as an addressable API oracle.
create or replace function private.catalog_ingredient_is_servable(p_ingredient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ingredients as ingredients
    join public.catalog_sources as sources
      on sources.id = ingredients.source_id
     and sources.source_key = ingredients.source
     and sources.production_approved is true
     and sources.review_status = 'legal_approved'
     and nullif(pg_catalog.btrim(sources.reviewed_by), '') is not null
     and sources.reviewed_at is not null
     and sources.reviewed_at <= pg_catalog.now()
     and (sources.requires_attribution is false or (
       nullif(pg_catalog.btrim(sources.attribution_text), '') is not null
       and nullif(pg_catalog.btrim(sources.attribution_url), '') is not null
     ))
    where ingredients.id = p_ingredient_id
      and ingredients.review_status = 'reviewed'
      and ingredients.source_snapshot_date is not null
      and ingredients.source_snapshot_date <= current_date
      and nullif(pg_catalog.btrim(coalesce(ingredients.cosing_ref, ingredients.source_url)), '') is not null
      and (
        ingredients.import_batch_id is null
        or (
          ingredients.import_projection_status = 'active'
          and exists (
            select 1 from public.catalog_import_batches as batches
            where batches.id = ingredients.import_batch_id
              and batches.status = 'promoted'
          )
        )
      )
  )
$$;
revoke all on function private.catalog_ingredient_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_ingredient_is_servable(uuid)
  to authenticated;

create or replace function private.catalog_product_is_servable(p_product_id uuid)
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
     and source.production_approved is true
     and source.review_status = 'legal_approved'
     and nullif(pg_catalog.btrim(source.reviewed_by), '') is not null
     and source.reviewed_at is not null
     and source.reviewed_at <= pg_catalog.now()
     and (source.requires_attribution is false or (
       nullif(pg_catalog.btrim(source.attribution_text), '') is not null
       and nullif(pg_catalog.btrim(source.attribution_url), '') is not null
     ))
    where product.id = p_product_id
      and product.region = 'US'
      and product.status = 'active'
      and product.review_status = 'reviewed'
      and product.last_reviewed_at is not null
      and product.last_reviewed_at <= pg_catalog.now()
      and product.quality_grade in ('verified', 'usable')
      and product.recommendation_eligible is true
      and product.unresolved_correction_count = 0
      and nullif(pg_catalog.btrim(product.source_ref), '') is not null
      and product.source_snapshot_date is not null
      and product.source_snapshot_date <= current_date
      and (
        product.import_batch_id is null
        or (
          product.import_projection_status = 'active'
          and exists (
            select 1 from public.catalog_import_batches as batches
            where batches.id = product.import_batch_id
              and batches.status = 'promoted'
          )
        )
      )
      and not exists (
        select 1 from public.product_ingredients as links
        where links.product_id = product.id
          and (
            private.catalog_source_is_production_approved(links.source_id) is not true
            or private.catalog_ingredient_is_servable(links.ingredient_id) is not true
          )
      )
      and not exists (
        select 1 from public.product_ingredient_tokens as tokens
        where tokens.product_id = product.id
          and tokens.ingredient_id is not null
          and (
            private.catalog_source_is_production_approved(tokens.source_id) is not true
            or private.catalog_ingredient_is_servable(tokens.ingredient_id) is not true
          )
      )
      and not exists (
        select 1 from public.product_active_bands as bands
        where bands.product_id = product.id
          and bands.ingredient_id is not null
          and (
            private.catalog_source_is_production_approved(bands.source_id) is not true
            or private.catalog_ingredient_is_servable(bands.ingredient_id) is not true
          )
      )
      and not exists (
        select 1
        from public.catalog_corrections as correction
        where correction.product_id = product.id
          and correction.status in ('triaged', 'accepted')
          and correction.operator_reviewed_at is not null
          and correction.operator_reviewed_at <= pg_catalog.now()
          and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
          and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
      )
  )
$$;
revoke all on function private.catalog_product_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_product_is_servable(uuid)
  to authenticated;

-- The service-only lookup/search view predates import lineage. Rebuild it on
-- the same positive helper so a retired batch cannot be resurrected by later
-- edits to mutable curation fields.
create or replace view public.catalog_servable_products
with (security_invoker = true)
as
select
  products.id,
  products.barcode,
  products.name,
  products.brand,
  products.category,
  products.region,
  products.default_pao_months,
  products.source,
  products.source_id as catalog_source_id,
  products.source_ref,
  products.source_url,
  products.source_snapshot_date,
  products.quality_grade,
  products.review_status,
  products.data_quality_score,
  products.ingredient_parse_status,
  products.ingredient_parse_confidence,
  pg_catalog.jsonb_build_object(
    'id', sources.id,
    'display_name', sources.display_name,
    'source_key', sources.source_key,
    'attribution_text', sources.attribution_text,
    'attribution_url', sources.attribution_url
  ) as catalog_sources,
  coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'pao_months', freshness.pao_months,
        'pao_source', freshness.pao_source,
        'expiry_date', freshness.expiry_date,
        'expiry_source', freshness.expiry_source,
        'region', freshness.region,
        'source_id', freshness.source_id,
        'review_status', freshness.review_status,
        'created_at', freshness.created_at
      ) order by freshness.created_at desc, freshness.id
    )
    from public.product_pao_expiry as freshness
    where freshness.product_id = products.id
      and freshness.review_status = 'reviewed'
      and nullif(pg_catalog.btrim(freshness.reviewed_by), '') is not null
      and freshness.region = products.region
      and private.catalog_source_is_production_approved(freshness.source_id)
  ), '[]'::jsonb) as product_pao_expiry
from public.products as products
join public.catalog_sources as sources on sources.id = products.source_id
where private.catalog_product_is_servable(products.id);

revoke all on public.catalog_servable_products
  from public, anon, authenticated, service_role;

drop policy if exists "ingredients_read_all" on public.ingredients;
drop policy if exists "ingredients_read_servable" on public.ingredients;
create policy "ingredients_read_servable" on public.ingredients
  for select to authenticated using (private.catalog_ingredient_is_servable(id));

drop policy if exists "ingredient_synonyms_read_all" on public.ingredient_synonyms;
drop policy if exists "ingredient_synonyms_read_servable" on public.ingredient_synonyms;
create policy "ingredient_synonyms_read_servable" on public.ingredient_synonyms
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_is_servable(ingredient_id)
    and exists (
      select 1 from public.ingredients as parent_ingredient
      where parent_ingredient.id = ingredient_synonyms.ingredient_id
        and parent_ingredient.source_id = ingredient_synonyms.source_id
    )
    and (import_batch_id is null or import_projection_status = 'active')
  );

drop policy if exists "product_ingredients_read_servable" on public.product_ingredients;
create policy "product_ingredients_read_servable" on public.product_ingredients
  for select to authenticated using (
    private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_list_is_servable(ingredient_list_id, product_id)
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

drop policy if exists "product_ingredient_tokens_read_servable" on public.product_ingredient_tokens;
create policy "product_ingredient_tokens_read_servable" on public.product_ingredient_tokens
  for select to authenticated using (
    private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_list_is_servable(ingredient_list_id, product_id)
    and (ingredient_id is null or private.catalog_ingredient_is_servable(ingredient_id))
  );

drop policy if exists "product_active_bands_read_servable" on public.product_active_bands;
create policy "product_active_bands_read_servable" on public.product_active_bands
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_product_is_servable(product_id)
    and (ingredient_id is null or private.catalog_ingredient_is_servable(ingredient_id))
  );

drop policy if exists "brands_read_all" on public.brands;
drop policy if exists "brands_read_servable" on public.brands;
create policy "brands_read_servable" on public.brands
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
  );

drop policy if exists "ingredient_tag_assignments_read_all" on public.ingredient_tag_assignments;
drop policy if exists "ingredient_tag_assignments_read_servable" on public.ingredient_tag_assignments;
create policy "ingredient_tag_assignments_read_servable" on public.ingredient_tag_assignments
  for select to authenticated using (
    review_status = 'reviewed'
    and private.catalog_source_is_production_approved(source_id)
    and private.catalog_ingredient_is_servable(ingredient_id)
  );

-- These legacy relations do not carry enough row-level source/review evidence
-- to construct a positive client policy. Keep them server/owner-only instead
-- of treating absence of a blocker as approval.
drop policy if exists "ingredient_tags_read_all" on public.ingredient_tags;
drop policy if exists "ingredient_pao_defaults_read_all" on public.ingredient_pao_defaults;
drop policy if exists "product_categories_read_all" on public.product_categories;
drop policy if exists "ingredient_tag_definitions_read_all" on public.ingredient_tag_definitions;
revoke select on public.ingredient_tags, public.ingredient_pao_defaults,
  public.product_categories, public.ingredient_tag_definitions
  from public, anon, authenticated;

-- RLS is defense in depth; the sealed lifecycle has no direct API privilege or
-- policy at all, including for service_role.
revoke all on schema private from public, anon, authenticated, service_role;
alter table public.catalog_import_batches enable row level security;
alter table public.catalog_import_batches force row level security;
alter table public.catalog_quality_reports enable row level security;
alter table public.catalog_quality_reports force row level security;
alter table private.catalog_import_chunk_receipts enable row level security;
alter table private.catalog_import_chunk_receipts force row level security;
alter table private.catalog_import_staged_records enable row level security;
alter table private.catalog_import_staged_records force row level security;
alter table private.catalog_import_review_events enable row level security;
alter table private.catalog_import_review_events force row level security;
alter table private.catalog_import_conflicts enable row level security;
alter table private.catalog_import_conflicts force row level security;
alter table private.catalog_import_promotion_events enable row level security;
alter table private.catalog_import_promotion_events force row level security;
alter table private.catalog_import_entity_revisions enable row level security;
alter table private.catalog_import_entity_revisions force row level security;
alter table private.catalog_import_batch_effects enable row level security;
alter table private.catalog_import_batch_effects force row level security;

revoke all on table public.catalog_import_batches
  from public, anon, authenticated, service_role;
revoke all on table public.catalog_quality_reports
  from public, anon, authenticated, service_role;
revoke all on table private.catalog_import_chunk_receipts,
  private.catalog_import_staged_records,
  private.catalog_import_review_events,
  private.catalog_import_conflicts,
  private.catalog_import_promotion_events,
  private.catalog_import_entity_revisions,
  private.catalog_import_batch_effects
  from public, anon, authenticated, service_role;

-- Source approval/legal/attribution fields are release authority. In
-- particular, service_role bypasses RLS and therefore must have no direct
-- source mutation privilege.
alter table public.catalog_sources enable row level security;
alter table public.catalog_sources force row level security;
revoke all on table public.catalog_sources
  from public, anon, authenticated, service_role;

-- Global catalog mutation is possible only through reviewed owner workflows.
-- Service keys are transport credentials, not an administrative SQL console.
revoke insert, update, delete, truncate, references, trigger on
  public.products,
  public.product_barcodes,
  public.product_ingredient_lists,
  public.product_ingredient_tokens,
  public.product_ingredients,
  public.product_active_bands,
  public.product_pao_expiry,
  public.ingredients,
  public.ingredient_synonyms,
  public.ingredient_tags,
  public.ingredient_pao_defaults,
  public.brands,
  public.product_categories,
  public.ingredient_tag_definitions,
  public.ingredient_tag_assignments
from public, anon, authenticated, service_role;

comment on table private.catalog_import_staged_records is
  'Sealed, non-servable normalized records; final review disposition is explicit.';
comment on table private.catalog_import_entity_revisions is
  'Append-only projection snapshots linking every imported entity to exact source bytes.';
comment on table private.catalog_import_batch_effects is
  'Append-only per-batch insert/retirement effects used for auditable rollback.';
comment on column public.products.import_record_sha256 is
  'SHA-256 of the canonical staged record that produced this projection.';
comment on column public.ingredients.import_record_sha256 is
  'SHA-256 of the canonical staged record that produced this projection.';
comment on column public.catalog_import_batches.candidates_sha256 is
  'SHA-256 of ordered concatenated lowercase per-candidate SHA-256 canonical-JSON leaves.';
