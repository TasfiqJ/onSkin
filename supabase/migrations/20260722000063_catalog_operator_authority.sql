-- =============================================================================
-- 0063 - CAT-08 catalog operator authority boundary
-- =============================================================================
-- This migration replaces the shared service-role correction-review authority
-- with named, AAL2 operator sessions and bounded RPCs. Reporter rows remain
-- erasable health-adjacent data. A confirmed product hold is copied into a
-- separate reporter-free authority relation so consent withdrawal cannot make
-- a known product issue disappear.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'catalog_operator_edge'
  ) then
    create role catalog_operator_edge
      login
      nosuperuser
      noinherit
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls
      connection limit 8;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'catalog_operator_edge'
      and rolsuper
  ) then
    raise exception 'CATALOG_OPERATOR_EDGE_ROLE_SUPERUSER_DRIFT'
      using errcode = '42501';
  end if;
end;
$$;

alter role catalog_operator_edge
  login
  noinherit
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls
  connection limit 8;
alter role catalog_operator_edge set search_path = '';
alter role catalog_operator_edge set statement_timeout = '15s';
alter role catalog_operator_edge set lock_timeout = '2s';
alter role catalog_operator_edge set idle_in_transaction_session_timeout = '5s';

-- Reusing a named role is safe only when it has no inherited/SET ROLE lane and
-- owns no database object. Fail the migration instead of silently preserving
-- privileged role drift from a prior manual deployment.
do $$
declare
  v_edge_role_oid oid;
begin
  select role.oid into strict v_edge_role_oid
  from pg_catalog.pg_roles as role
  where role.rolname = 'catalog_operator_edge';

  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    where membership.member = v_edge_role_oid
       or membership.roleid = v_edge_role_oid
  ) then
    raise exception 'CATALOG_OPERATOR_EDGE_ROLE_MEMBERSHIP_DRIFT'
      using errcode = '42501';
  end if;

  if pg_catalog.has_schema_privilege(
    'catalog_operator_edge',
    'auth',
    'usage'
  ) then
    raise exception 'CATALOG_OPERATOR_EDGE_AUTH_SCHEMA_DRIFT'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_shdepend as dependency
    where dependency.refclassid = 'pg_catalog.pg_authid'::regclass
      and dependency.refobjid = v_edge_role_oid
      and dependency.deptype = 'o'
      and (
        dependency.dbid = 0
        or dependency.dbid = (
          select database.oid
          from pg_catalog.pg_database as database
          where database.datname = pg_catalog.current_database()
        )
      )
  ) then
    raise exception 'CATALOG_OPERATOR_EDGE_ROLE_OWNERSHIP_DRIFT'
      using errcode = '42501';
  end if;
end;
$$;

create schema if not exists catalog_operator_gateway;
revoke all on schema catalog_operator_gateway
  from public, anon, authenticated, service_role, catalog_operator_edge;
grant usage on schema catalog_operator_gateway to catalog_operator_edge;

create table private.catalog_operator_runtime_control (
  singleton               boolean primary key default true check (singleton),
  control_generation      bigint not null check (control_generation > 0),
  admission_state         text not null check (admission_state in ('frozen', 'open')),
  environment             text not null check (
    environment in ('unconfigured', 'development', 'staging', 'production')
  ),
  source_revision         text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  edge_deployment_id      text not null check (
    edge_deployment_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$'
  ),
  reason_code             text not null check (
    reason_code in (
      'initial_fail_closed',
      'deployment_cutover',
      'hosted_verification_passed',
      'incident_freeze',
      'credential_rotation',
      'rollback'
    )
  ),
  change_receipt_sha256   text not null check (change_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  changed_at              timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(changed_at)),
  check (
    admission_state = 'frozen'
    or (
      environment in ('development', 'staging', 'production')
      and source_revision <> pg_catalog.repeat('0', 40)
      and edge_deployment_id <> 'unconfigured'
    )
  )
);

create table private.catalog_operator_runtime_control_history (
  control_generation      bigint primary key check (control_generation > 0),
  admission_state         text not null check (admission_state in ('frozen', 'open')),
  environment             text not null check (
    environment in ('unconfigured', 'development', 'staging', 'production')
  ),
  source_revision         text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  edge_deployment_id      text not null check (
    edge_deployment_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$'
  ),
  reason_code             text not null,
  change_receipt_sha256   text not null check (change_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  changed_at              timestamptz not null check (pg_catalog.isfinite(changed_at))
);

insert into private.catalog_operator_runtime_control (
  singleton,
  control_generation,
  admission_state,
  environment,
  source_revision,
  edge_deployment_id,
  reason_code,
  change_receipt_sha256
) values (
  true,
  1,
  'frozen',
  'unconfigured',
  pg_catalog.repeat('0', 40),
  'unconfigured',
  'initial_fail_closed',
  pg_catalog.repeat('0', 64)
);

insert into private.catalog_operator_runtime_control_history (
  control_generation,
  admission_state,
  environment,
  source_revision,
  edge_deployment_id,
  reason_code,
  change_receipt_sha256,
  changed_at
)
select control_generation,
       admission_state,
       environment,
       source_revision,
       edge_deployment_id,
       reason_code,
       change_receipt_sha256,
       changed_at
from private.catalog_operator_runtime_control;

revoke all on table private.catalog_operator_runtime_control
  from public, anon, authenticated, service_role, catalog_operator_edge;
revoke all on table private.catalog_operator_runtime_control_history
  from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.guard_catalog_operator_runtime_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CATALOG_OPERATOR_RUNTIME_CONTROL_REQUIRED'
      using errcode = '55000';
  end if;
  if new.singleton is distinct from true
     or new.control_generation <> old.control_generation + 1
     or new.changed_at <= old.changed_at then
    raise exception 'CATALOG_OPERATOR_RUNTIME_CONTROL_INVALID'
      using errcode = '22023';
  end if;
  insert into private.catalog_operator_runtime_control_history (
    control_generation,
    admission_state,
    environment,
    source_revision,
    edge_deployment_id,
    reason_code,
    change_receipt_sha256,
    changed_at
  ) values (
    new.control_generation,
    new.admission_state,
    new.environment,
    new.source_revision,
    new.edge_deployment_id,
    new.reason_code,
    new.change_receipt_sha256,
    new.changed_at
  );
  return new;
end;
$$;

create trigger catalog_operator_runtime_control_guard
  before update or delete on private.catalog_operator_runtime_control
  for each row execute function private.guard_catalog_operator_runtime_control();

create or replace function private.guard_catalog_operator_runtime_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'CATALOG_OPERATOR_RUNTIME_HISTORY_IMMUTABLE'
    using errcode = '55000';
end;
$$;

create trigger catalog_operator_runtime_history_immutable
  before update or delete or truncate
  on private.catalog_operator_runtime_control_history
  for each statement execute function private.guard_catalog_operator_runtime_history();

revoke all on function private.guard_catalog_operator_runtime_control()
  from public, anon, authenticated, service_role, catalog_operator_edge;
revoke all on function private.guard_catalog_operator_runtime_history()
  from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.catalog_operator_sha256(p_value jsonb)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        'routinekind-catalog-operator:v1:' || p_value::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

revoke all on function private.catalog_operator_sha256(jsonb)
  from public, anon, authenticated, service_role;

create table private.catalog_operator_grant_attestations (
  id                    uuid primary key default gen_random_uuid(),
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  attested_by_user_id   uuid not null references auth.users (id) on delete restrict,
  authority_receipt_sha256 text not null unique
    check (authority_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_sha256       text not null
    check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  attested_at           timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(attested_at)),
  valid_until           timestamptz not null
    check (pg_catalog.isfinite(valid_until)),
  check (operator_user_id <> attested_by_user_id),
  check (valid_until > attested_at and valid_until <= attested_at + interval '90 days')
);

create table private.catalog_operator_grants (
  id                    uuid primary key default gen_random_uuid(),
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  attestation_id        uuid not null unique
    references private.catalog_operator_grant_attestations (id) on delete restrict,
  issued_by_user_id     uuid not null references auth.users (id) on delete restrict,
  issued_at             timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(issued_at)),
  valid_from            timestamptz not null,
  valid_until           timestamptz not null,
  grant_sha256          text not null unique check (grant_sha256 ~ '^[a-f0-9]{64}$'),
  check (operator_user_id <> issued_by_user_id),
  check (
    pg_catalog.isfinite(valid_from)
    and pg_catalog.isfinite(valid_until)
    and valid_from >= issued_at - interval '5 minutes'
    and valid_until > valid_from
    and valid_until <= issued_at + interval '90 days'
  )
);

create table private.catalog_operator_capability_bindings (
  grant_id              uuid not null
    references private.catalog_operator_grants (id) on delete restrict,
  capability            text not null check (capability in (
    'correction_queue_read',
    'source_queue_read',
    'correction_claim',
    'catalog_hold_claim',
    'source_claim',
    'correction_triage',
    'correction_disposition',
    'source_review_record',
    'catalog_repair_attest',
    'catalog_hold_release'
  )),
  bound_at               timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(bound_at)),
  binding_sha256         text not null unique check (binding_sha256 ~ '^[a-f0-9]{64}$'),
  primary key (grant_id, capability)
);

create table private.catalog_operator_grant_revocations (
  id                    uuid primary key default gen_random_uuid(),
  grant_id              uuid not null unique
    references private.catalog_operator_grants (id) on delete restrict,
  revoked_by_user_id    uuid not null references auth.users (id) on delete restrict,
  reason_code           text not null check (reason_code in (
    'access_removed', 'role_changed', 'security_response', 'expired_authority'
  )),
  evidence_sha256       text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  revoked_at            timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(revoked_at))
);

create table private.catalog_operator_sessions (
  id                    uuid primary key default gen_random_uuid(),
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  auth_session_id       uuid not null,
  mfa_factor_id         uuid not null,
  runtime_control_generation bigint not null check (runtime_control_generation > 0),
  edge_environment      text not null check (
    edge_environment in ('development', 'staging', 'production')
  ),
  source_revision       text not null check (source_revision ~ '^[a-f0-9]{40}$'),
  edge_deployment_id    text not null check (
    edge_deployment_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$'
  ),
  grant_ids             uuid[] not null,
  capability_set_sha256 text not null check (capability_set_sha256 ~ '^[a-f0-9]{64}$'),
  established_at        timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(established_at)),
  expires_at            timestamptz not null check (pg_catalog.isfinite(expires_at)),
  check (
    pg_catalog.array_ndims(grant_ids) = 1
    and pg_catalog.array_lower(grant_ids, 1) = 1
    and pg_catalog.cardinality(grant_ids) between 1 and 32
    and pg_catalog.array_position(grant_ids, null) is null
  ),
  check (expires_at > established_at and expires_at <= established_at + interval '10 minutes')
);

create index catalog_operator_sessions_lookup_idx
  on private.catalog_operator_sessions
  (operator_user_id, auth_session_id, expires_at desc);

create table private.catalog_operator_rate_buckets (
  operator_user_id      uuid not null
    references auth.users (id) on delete cascade,
  budget_class          text not null check (budget_class in (
    'all', 'session', 'queue', 'detail', 'claim', 'transition', 'release'
  )),
  window_start          timestamptz not null
    check (pg_catalog.isfinite(window_start)),
  window_seconds        integer not null check (window_seconds = 900),
  request_count         integer not null check (request_count > 0),
  expires_at            timestamptz not null check (
    pg_catalog.isfinite(expires_at)
    and expires_at = window_start + interval '1 hour'
  ),
  primary key (operator_user_id, budget_class, window_start)
);

create index catalog_operator_rate_buckets_expiry_idx
  on private.catalog_operator_rate_buckets (expires_at, operator_user_id);

create table private.catalog_operator_work_states (
  item_kind             text not null check (item_kind in (
    'correction_report', 'catalog_source', 'import_batch'
  )),
  item_id               uuid not null,
  version               bigint not null default 1 check (version > 0),
  status                text not null check (status in (
    'open', 'triaged', 'accepted', 'rejected',
    'acknowledged', 'changes_requested', 'escalated',
    'promotion_recommended', 'rollback_recommended'
  )),
  last_actor_user_id    uuid references auth.users (id) on delete restrict,
  updated_at            timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(updated_at)),
  primary key (item_kind, item_id)
);

create table private.catalog_operator_claims (
  id                    uuid primary key default gen_random_uuid(),
  operation_id          uuid not null unique,
  item_kind             text not null check (item_kind in (
    'correction_report', 'catalog_source', 'import_batch', 'product_hold'
  )),
  item_id               uuid not null,
  item_version          bigint not null check (item_version > 0),
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  operator_session_id   uuid not null
    references private.catalog_operator_sessions (id) on delete restrict,
  claimed_at            timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(claimed_at)),
  expires_at            timestamptz not null check (pg_catalog.isfinite(expires_at)),
  check (expires_at > claimed_at and expires_at <= claimed_at + interval '5 minutes')
);

create index catalog_operator_claims_item_idx
  on private.catalog_operator_claims (item_kind, item_id, expires_at desc);

create index catalog_operator_claims_expiry_idx
  on private.catalog_operator_claims (expires_at, id);

create table private.catalog_operator_operation_receipts (
  operation_id          uuid primary key,
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  rpc_name              text not null check (rpc_name in (
    'catalog_operator_claim',
    'catalog_operator_transition',
    'catalog_operator_release_hold'
  )),
  request_sha256        text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  response              jsonb not null check (
    pg_catalog.jsonb_typeof(response) = 'object'
    and pg_catalog.pg_column_size(response) <= 8192
  ),
  created_at            timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(created_at))
);

create table private.catalog_operator_audit_events (
  id                    uuid primary key,
  subject_kind          text not null check (subject_kind in (
    'correction_workflow', 'catalog_source', 'import_batch',
    'product_hold', 'repair_attestation'
  )),
  subject_id            uuid,
  product_id            uuid references public.products (id) on delete restrict,
  event_type            text not null,
  reason_code           text not null,
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  operator_session_id   uuid not null
    references private.catalog_operator_sessions (id) on delete restrict,
  chain_sequence        bigint not null check (chain_sequence > 0),
  occurred_at           timestamptz not null check (pg_catalog.isfinite(occurred_at)),
  evidence_sha256       text check (
    evidence_sha256 is null or evidence_sha256 ~ '^[a-f0-9]{64}$'
  ),
  event_payload         jsonb not null default '{}'::jsonb check (
    pg_catalog.jsonb_typeof(event_payload) = 'object'
    and pg_catalog.pg_column_size(event_payload) <= 4096
  ),
  previous_event_sha256 text check (
    previous_event_sha256 is null or previous_event_sha256 ~ '^[a-f0-9]{64}$'
  ),
  event_sha256          text not null unique check (event_sha256 ~ '^[a-f0-9]{64}$'),
  check (
    (subject_kind = 'correction_workflow' and subject_id is null)
    or subject_kind <> 'correction_workflow'
  )
);

create index catalog_operator_audit_subject_idx
  on private.catalog_operator_audit_events
  (subject_kind, subject_id, product_id, chain_sequence desc);

create unique index catalog_operator_audit_chain_sequence_uidx
  on private.catalog_operator_audit_events (
    subject_kind,
    coalesce(subject_id::text, ''),
    coalesce(product_id::text, ''),
    chain_sequence
  );

create table private.catalog_operator_product_holds (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products (id) on delete restrict,
  reason_code           text not null check (reason_code in (
    'wrong_match_confirmed', 'ingredient_risk_confirmed',
    'source_defect_confirmed', 'expiry_defect_confirmed',
    'category_defect_confirmed', 'duplicate_confirmed'
  )),
  state                 text not null check (state in (
    'active', 'repair_attested', 'released'
  )),
  version               bigint not null default 1 check (version > 0),
  triaged_by_user_id    uuid references auth.users (id) on delete restrict,
  legacy_origin_sha256  text check (
    legacy_origin_sha256 is null or legacy_origin_sha256 ~ '^[a-f0-9]{64}$'
  ),
  baseline_import_batch_id uuid
    references public.catalog_import_batches (id) on delete restrict,
  baseline_product_record_sha256 text check (
    baseline_product_record_sha256 is null
    or baseline_product_record_sha256 ~ '^[a-f0-9]{64}$'
  ),
  baseline_served_state_mutation_root_sha256 text not null
    check (baseline_served_state_mutation_root_sha256 ~ '^[a-f0-9]{64}$'),
  disposition           text check (disposition in ('accepted', 'rejected')),
  disposition_by_user_id uuid references auth.users (id) on delete restrict,
  disposition_at        timestamptz,
  accepted_by_user_id   uuid references auth.users (id) on delete restrict,
  repair_receipt_id     uuid,
  released_by_user_id   uuid references auth.users (id) on delete restrict,
  opened_at             timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(opened_at)),
  accepted_at           timestamptz,
  repair_attested_at    timestamptz,
  released_at           timestamptz,
  check (
    (triaged_by_user_id is not null and legacy_origin_sha256 is null)
    or (triaged_by_user_id is null and legacy_origin_sha256 is not null)
  ),
  check (
    (disposition is null and disposition_by_user_id is null and disposition_at is null)
    or (
      disposition is not null and disposition_by_user_id is not null
      and disposition_at is not null and pg_catalog.isfinite(disposition_at)
      and disposition_at >= opened_at
      and disposition_by_user_id <> triaged_by_user_id
    )
  ),
  check (
    (accepted_at is null and accepted_by_user_id is null)
    or (
      accepted_at is not null and accepted_by_user_id is not null
      and pg_catalog.isfinite(accepted_at) and accepted_at >= opened_at
      and accepted_by_user_id <> triaged_by_user_id
      and disposition = 'accepted'
      and accepted_by_user_id = disposition_by_user_id
      and accepted_at = disposition_at
    )
  ),
  check (
    (state = 'active' and repair_receipt_id is null
      and repair_attested_at is null and released_at is null
      and released_by_user_id is null)
    or (state = 'repair_attested' and repair_receipt_id is not null
      and repair_attested_at is not null and released_at is null
      and released_by_user_id is null)
    or (state = 'released' and repair_receipt_id is not null
      and repair_attested_at is not null and released_at is not null
      and released_by_user_id is not null
      and pg_catalog.isfinite(released_at)
      and released_at >= repair_attested_at)
  )
);

create unique index catalog_operator_product_holds_active_uidx
  on private.catalog_operator_product_holds (product_id)
  where state in ('active', 'repair_attested');

create table private.catalog_operator_repair_authority_receipts (
  id                    uuid primary key default gen_random_uuid(),
  hold_id               uuid not null
    references private.catalog_operator_product_holds (id) on delete restrict,
  hold_version          bigint not null check (hold_version > 0),
  product_id            uuid not null references public.products (id) on delete restrict,
  attested_by_user_id   uuid not null references auth.users (id) on delete restrict,
  operator_session_id   uuid not null
    references private.catalog_operator_sessions (id) on delete restrict,
  evidence_sha256       text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  import_batch_id       uuid not null
    references public.catalog_import_batches (id) on delete restrict,
  product_record_sha256 text not null check (product_record_sha256 ~ '^[a-f0-9]{64}$'),
  cat02_verification_evidence_sha256 text not null
    check (cat02_verification_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  curation_record_id    uuid not null
    references private.catalog_launch_curation_records (id) on delete restrict,
  curation_campaign_id  uuid not null
    references private.catalog_launch_curation_campaigns (id) on delete restrict,
  curation_record_sha256 text not null check (curation_record_sha256 ~ '^[a-f0-9]{64}$'),
  served_state_mutation_root_sha256 text not null
    check (served_state_mutation_root_sha256 ~ '^[a-f0-9]{64}$'),
  baseline_import_batch_id uuid
    references public.catalog_import_batches (id) on delete restrict,
  baseline_product_record_sha256 text check (
    baseline_product_record_sha256 is null
    or baseline_product_record_sha256 ~ '^[a-f0-9]{64}$'
  ),
  baseline_served_state_mutation_root_sha256 text not null
    check (baseline_served_state_mutation_root_sha256 ~ '^[a-f0-9]{64}$'),
  repair_authority_user_ids uuid[] not null,
  attested_at           timestamptz not null default pg_catalog.clock_timestamp()
    check (pg_catalog.isfinite(attested_at)),
  valid_until           timestamptz not null check (pg_catalog.isfinite(valid_until)),
  receipt_sha256        text not null unique check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  check (valid_until > attested_at and valid_until <= attested_at + interval '30 minutes'),
  check (
    pg_catalog.array_ndims(repair_authority_user_ids) = 1
    and pg_catalog.array_lower(repair_authority_user_ids, 1) = 1
    and pg_catalog.cardinality(repair_authority_user_ids) between 1 and 16
    and pg_catalog.array_position(repair_authority_user_ids, null) is null
  ),
  unique (hold_id, hold_version)
);

alter table private.catalog_operator_product_holds
  add constraint catalog_operator_product_holds_repair_receipt_fkey
  foreign key (repair_receipt_id)
  references private.catalog_operator_repair_authority_receipts (id)
  on delete restrict;

create table private.catalog_operator_hold_events (
  id                    uuid primary key,
  hold_id               uuid not null
    references private.catalog_operator_product_holds (id) on delete restrict,
  product_id            uuid not null references public.products (id) on delete restrict,
  sequence              bigint not null check (sequence > 0),
  event_type            text not null check (event_type in (
    'hold_created', 'hold_reopened', 'hold_accepted', 'hold_rejected',
    'repair_attested', 'hold_released'
  )),
  from_state            text,
  to_state              text not null check (to_state in (
    'active', 'repair_attested', 'released'
  )),
  reason_code           text not null,
  operator_user_id      uuid not null references auth.users (id) on delete restrict,
  operator_session_id   uuid not null
    references private.catalog_operator_sessions (id) on delete restrict,
  repair_receipt_id     uuid references
    private.catalog_operator_repair_authority_receipts (id) on delete restrict,
  occurred_at           timestamptz not null check (pg_catalog.isfinite(occurred_at)),
  previous_event_sha256 text check (
    previous_event_sha256 is null or previous_event_sha256 ~ '^[a-f0-9]{64}$'
  ),
  event_sha256          text not null unique check (event_sha256 ~ '^[a-f0-9]{64}$'),
  unique (hold_id, sequence)
);

create or replace function private.catalog_operator_grant_sha256(
  p_operator_user_id uuid,
  p_attestation_id uuid,
  p_issued_by_user_id uuid,
  p_issued_at timestamptz,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns text
language sql
immutable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'contractId', 'catalog-operator-grant-v1',
      'operatorUserId', p_operator_user_id,
      'attestationId', p_attestation_id,
      'issuedByUserId', p_issued_by_user_id,
      'issuedAt', pg_catalog.to_char(
        p_issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'validFrom', pg_catalog.to_char(
        p_valid_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'validUntil', pg_catalog.to_char(
        p_valid_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      )
    )
  )
$$;

create or replace function private.catalog_operator_binding_sha256(
  p_grant_id uuid,
  p_capability text,
  p_bound_at timestamptz
)
returns text
language sql
immutable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'contractId', 'catalog-operator-capability-binding-v1',
      'grantId', p_grant_id,
      'capability', p_capability,
      'boundAt', pg_catalog.to_char(
        p_bound_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      )
    )
  )
$$;

create or replace function private.catalog_operator_audit_event_sha256(
  p_id uuid,
  p_subject_kind text,
  p_subject_id uuid,
  p_product_id uuid,
  p_chain_sequence bigint,
  p_event_type text,
  p_reason_code text,
  p_operator_user_id uuid,
  p_operator_session_id uuid,
  p_occurred_at timestamptz,
  p_evidence_sha256 text,
  p_event_payload jsonb,
  p_previous_event_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'contractId', 'catalog-operator-audit-event-v2',
      'id', p_id,
      'subjectKind', p_subject_kind,
      'subjectId', p_subject_id,
      'productId', p_product_id,
      'chainSequence', p_chain_sequence,
      'eventType', p_event_type,
      'reasonCode', p_reason_code,
      'operatorUserId', p_operator_user_id,
      'operatorSessionId', p_operator_session_id,
      'occurredAt', pg_catalog.to_char(
        p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'evidenceSha256', p_evidence_sha256,
      'eventPayload', p_event_payload,
      'previousEventSha256', p_previous_event_sha256
    )
  )
$$;

create or replace function private.catalog_operator_hold_event_sha256(
  p_id uuid,
  p_hold_id uuid,
  p_product_id uuid,
  p_sequence bigint,
  p_event_type text,
  p_from_state text,
  p_to_state text,
  p_reason_code text,
  p_operator_user_id uuid,
  p_operator_session_id uuid,
  p_repair_receipt_id uuid,
  p_occurred_at timestamptz,
  p_previous_event_sha256 text
)
returns text
language sql
immutable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'contractId', 'catalog-operator-product-hold-event-v1',
      'id', p_id,
      'holdId', p_hold_id,
      'productId', p_product_id,
      'sequence', p_sequence,
      'eventType', p_event_type,
      'fromState', p_from_state,
      'toState', p_to_state,
      'reasonCode', p_reason_code,
      'operatorUserId', p_operator_user_id,
      'operatorSessionId', p_operator_session_id,
      'repairReceiptId', p_repair_receipt_id,
      'occurredAt', pg_catalog.to_char(
        p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'previousEventSha256', p_previous_event_sha256
    )
  )
$$;

alter table private.catalog_operator_grants
  add constraint catalog_operator_grants_hash_check check (
    grant_sha256 = private.catalog_operator_grant_sha256(
      operator_user_id, attestation_id, issued_by_user_id,
      issued_at, valid_from, valid_until
    )
  );

alter table private.catalog_operator_capability_bindings
  add constraint catalog_operator_capability_bindings_hash_check check (
    binding_sha256 = private.catalog_operator_binding_sha256(
      grant_id, capability, bound_at
    )
  );

alter table private.catalog_operator_audit_events
  add constraint catalog_operator_audit_events_hash_check check (
    event_sha256 = private.catalog_operator_audit_event_sha256(
      id, subject_kind, subject_id, product_id, chain_sequence,
      event_type, reason_code,
      operator_user_id, operator_session_id, occurred_at,
      evidence_sha256, event_payload, previous_event_sha256
    )
  );

alter table private.catalog_operator_hold_events
  add constraint catalog_operator_hold_events_hash_check check (
    event_sha256 = private.catalog_operator_hold_event_sha256(
      id, hold_id, product_id, sequence, event_type, from_state, to_state,
      reason_code, operator_user_id, operator_session_id,
      repair_receipt_id, occurred_at, previous_event_sha256
    )
  );

revoke all on function private.catalog_operator_grant_sha256(
  uuid, uuid, uuid, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_operator_binding_sha256(uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.catalog_operator_audit_event_sha256(
  uuid, text, uuid, uuid, bigint, text, text, uuid, uuid,
  timestamptz, text, jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function private.catalog_operator_hold_event_sha256(
  uuid, uuid, uuid, bigint, text, text, text, text, uuid, uuid, uuid,
  timestamptz, text
) from public, anon, authenticated, service_role;

create or replace function private.guard_catalog_operator_immutable()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'CATALOG_OPERATOR_LEDGER_IMMUTABLE' using errcode = '55000';
  end if;
  if pg_catalog.to_jsonb(new) ? 'occurred_at'
     and not pg_catalog.isfinite((pg_catalog.to_jsonb(new) ->> 'occurred_at')::timestamptz) then
    raise exception 'CATALOG_OPERATOR_LEDGER_TIME_INVALID' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_catalog_operator_immutable()
  from public, anon, authenticated, service_role;

create or replace function private.normalize_catalog_operator_revocation_time()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Revocations are incident controls, never scheduled jobs. Deriving the
  -- timestamp server-side prevents a future-dated immutable row from blocking
  -- an immediate replacement through the UNIQUE grant_id constraint.
  new.revoked_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function private.normalize_catalog_operator_revocation_time()
  from public, anon, authenticated, service_role;

create or replace function private.serialize_catalog_operator_grant_insert()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Grant creation and session/action admission share one actor lock. A session
  -- therefore sees either the complete newly committed grant/binding set or
  -- the prior set; it cannot aggregate an unlocked grant created mid-scan.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-session:' || new.operator_user_id::text,
      0
    )
  );
  return new;
end;
$$;

revoke all on function private.serialize_catalog_operator_grant_insert()
  from public, anon, authenticated, service_role;

create trigger catalog_operator_grant_attestations_immutable
  before update or delete on private.catalog_operator_grant_attestations
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_grants_immutable
  before update or delete on private.catalog_operator_grants
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_grants_serialize_insert
  before insert on private.catalog_operator_grants
  for each row execute function private.serialize_catalog_operator_grant_insert();
create trigger catalog_operator_bindings_immutable
  before update or delete on private.catalog_operator_capability_bindings
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_revocations_immutable
  before update or delete on private.catalog_operator_grant_revocations
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_revocations_immediate
  before insert on private.catalog_operator_grant_revocations
  for each row execute function private.normalize_catalog_operator_revocation_time();
create trigger catalog_operator_sessions_immutable
  before update or delete on private.catalog_operator_sessions
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_operation_receipts_immutable
  before update or delete on private.catalog_operator_operation_receipts
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_audit_events_immutable
  before update or delete on private.catalog_operator_audit_events
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_repair_receipts_immutable
  before update or delete on private.catalog_operator_repair_authority_receipts
  for each row execute function private.guard_catalog_operator_immutable();
create trigger catalog_operator_hold_events_immutable
  before update or delete on private.catalog_operator_hold_events
  for each row execute function private.guard_catalog_operator_immutable();

do $$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'catalog_operator_runtime_control',
    'catalog_operator_runtime_control_history',
    'catalog_operator_grant_attestations',
    'catalog_operator_grants',
    'catalog_operator_capability_bindings',
    'catalog_operator_grant_revocations',
    'catalog_operator_sessions',
    'catalog_operator_rate_buckets',
    'catalog_operator_work_states',
    'catalog_operator_claims',
    'catalog_operator_operation_receipts',
    'catalog_operator_audit_events',
    'catalog_operator_product_holds',
    'catalog_operator_repair_authority_receipts',
    'catalog_operator_hold_events'
  ] loop
    execute pg_catalog.format(
      'alter table private.%I enable row level security', v_relation
    );
    execute pg_catalog.format(
      'alter table private.%I force row level security', v_relation
    );
    execute pg_catalog.format(
      'revoke all on table private.%I from public, anon, authenticated, service_role',
      v_relation
    );
  end loop;
end;
$$;

revoke all on schema private from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_cleanup_expired_claims(
  p_limit integer default 500
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'CATALOG_OPERATOR_CLAIM_CLEANUP_INPUT_INVALID'
      using errcode = '22023';
  end if;

  with expired as (
    select claim.id
    from private.catalog_operator_claims as claim
    where claim.expires_at <= pg_catalog.now()
    order by claim.expires_at, claim.id
    limit p_limit
    for update skip locked
  )
  delete from private.catalog_operator_claims as claim
  using expired
  where claim.id = expired.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.catalog_operator_cleanup_expired_claims(integer)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_runtime_authority(
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint
)
returns table (
  control_generation bigint,
  edge_environment text,
  source_revision text,
  edge_deployment_id text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_edge_environment not in ('development', 'staging', 'production')
     or p_source_revision !~ '^[a-f0-9]{40}$'
     or p_edge_deployment_id is null
     or p_edge_deployment_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$'
     or p_control_generation is null
     or p_control_generation <= 0 then
    raise exception 'CATALOG_OPERATOR_RUNTIME_CONTEXT_INVALID'
      using errcode = '22023';
  end if;

  return query
  select control.control_generation,
         control.environment,
         control.source_revision,
         control.edge_deployment_id
  from private.catalog_operator_runtime_control as control
  where control.singleton
    and control.admission_state = 'open'
    and control.control_generation = p_control_generation
    and control.environment = p_edge_environment
    and control.source_revision = p_source_revision
    and control.edge_deployment_id = p_edge_deployment_id
  for share of control;

  if not found then
    raise exception 'CATALOG_OPERATOR_RUNTIME_FROZEN_OR_MISMATCH'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.catalog_operator_runtime_authority(
  text, text, text, bigint
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.catalog_operator_current_auth(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint
)
returns table (
  actor_user_id uuid,
  actor_email text,
  auth_session_id uuid,
  mfa_factor_id uuid,
  runtime_control_generation bigint,
  edge_environment text,
  source_revision text,
  edge_deployment_id text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_runtime record;
  v_actor uuid;
  v_actor_email text;
  v_factor uuid;
begin
  select * into v_runtime
  from private.catalog_operator_runtime_authority(
    p_edge_environment,
    p_source_revision,
    p_edge_deployment_id,
    p_control_generation
  );

  if p_auth_session_id is null then
    raise exception 'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED' using errcode = '28000';
  end if;

  select auth_session.user_id,
         pg_catalog.lower(pg_catalog.btrim(operator_user.email))
    into v_actor, v_actor_email
  from auth.sessions as auth_session
  join auth.users as operator_user
    on operator_user.id = auth_session.user_id
   and coalesce(
     (pg_catalog.to_jsonb(operator_user) ->> 'is_anonymous')::boolean,
     false
   ) is false
   and operator_user.email_confirmed_at is not null
   and operator_user.email is not null
   and pg_catalog.length(pg_catalog.btrim(operator_user.email)) between 3 and 254
   and pg_catalog.btrim(operator_user.email) !~ '[[:cntrl:]]'
  where auth_session.id = p_auth_session_id
    and auth_session.aal::text = 'aal2'
    and coalesce(
      nullif(pg_catalog.to_jsonb(auth_session) ->> 'not_after', '')::timestamptz,
      pg_catalog.now() + interval '1 second'
    ) > pg_catalog.now()
  for share of auth_session, operator_user;
  if not found then
    raise exception 'CATALOG_OPERATOR_AAL2_SESSION_REQUIRED' using errcode = '28000';
  end if;

  -- This owner-scoped predicate acquires the canonical account-deletion/
  -- Apple-lifecycle advisory lock for the remainder of the gateway
  -- transaction. Account access therefore cannot close between admission and
  -- a catalog mutation commit.
  if not public.account_write_allowed(v_actor) then
    raise exception 'CATALOG_OPERATOR_ACCOUNT_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  select factor.id
    into v_factor
  from auth.sessions as auth_session
  join auth.mfa_factors as factor
    on factor.id = auth_session.factor_id
   and factor.user_id = auth_session.user_id
   and factor.status::text = 'verified'
   and factor.factor_type::text = 'totp'
  where auth_session.id = p_auth_session_id
    and auth_session.user_id = v_actor
    and auth_session.aal::text = 'aal2'
    and coalesce(
      nullif(pg_catalog.to_jsonb(auth_session) ->> 'not_after', '')::timestamptz,
      pg_catalog.now() + interval '1 second'
    ) > pg_catalog.now()
  for share of auth_session, factor;
  if not found then
    raise exception 'CATALOG_OPERATOR_VERIFIED_TOTP_SESSION_REQUIRED'
      using errcode = '28000';
  end if;

  return query
  select v_actor,
         v_actor_email,
         p_auth_session_id,
         v_factor,
         v_runtime.control_generation,
         v_runtime.edge_environment,
         v_runtime.source_revision,
         v_runtime.edge_deployment_id;
end;
$$;

revoke all on function private.catalog_operator_current_auth(
  uuid, text, text, text, bigint
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.consume_catalog_operator_rate_budget(
  p_actor_user_id uuid,
  p_budget_class text,
  p_consume_global boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_class_limit integer;
  v_count integer;
begin
  if p_actor_user_id is null
     or p_consume_global is null
     or p_budget_class not in (
       'preflight', 'session', 'queue', 'detail',
       'claim', 'transition', 'release'
     ) then
    raise exception 'CATALOG_OPERATOR_RATE_BUDGET_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_class_limit := case p_budget_class
    when 'session' then 12
    when 'queue' then 60
    when 'detail' then 60
    when 'claim' then 60
    when 'transition' then 30
    when 'release' then 12
  end;
  v_window_start := pg_catalog.date_bin(
    interval '15 minutes',
    pg_catalog.clock_timestamp(),
    '2001-01-01 00:00:00+00'::timestamptz
  );

  with expired as (
    select bucket.operator_user_id,
           bucket.budget_class,
           bucket.window_start
    from private.catalog_operator_rate_buckets as bucket
    where bucket.expires_at <= pg_catalog.now()
    order by bucket.expires_at,
             bucket.operator_user_id,
             bucket.budget_class
    limit 100
    for update skip locked
  )
  delete from private.catalog_operator_rate_buckets as bucket
  using expired
  where bucket.operator_user_id = expired.operator_user_id
    and bucket.budget_class = expired.budget_class
    and bucket.window_start = expired.window_start;

  if p_consume_global then
    insert into private.catalog_operator_rate_buckets as bucket (
      operator_user_id,
      budget_class,
      window_start,
      window_seconds,
      request_count,
      expires_at
    ) values (
      p_actor_user_id,
      'all',
      v_window_start,
      900,
      1,
      v_window_start + interval '1 hour'
    )
    on conflict (operator_user_id, budget_class, window_start)
    do update set request_count =
      bucket.request_count + 1
    returning request_count into v_count;
    if v_count > 120 then
      raise exception 'CATALOG_OPERATOR_RATE_LIMITED' using errcode = '54000';
    end if;
  end if;

  if p_budget_class = 'preflight' then
    return;
  end if;

  insert into private.catalog_operator_rate_buckets as bucket (
    operator_user_id,
    budget_class,
    window_start,
    window_seconds,
    request_count,
    expires_at
  ) values (
    p_actor_user_id,
    p_budget_class,
    v_window_start,
    900,
    1,
    v_window_start + interval '1 hour'
  )
  on conflict (operator_user_id, budget_class, window_start)
  do update set request_count =
    bucket.request_count + 1
  returning request_count into v_count;
  if v_count > v_class_limit then
    raise exception 'CATALOG_OPERATOR_RATE_LIMITED' using errcode = '54000';
  end if;
end;
$$;

revoke all on function private.consume_catalog_operator_rate_budget(
  uuid, text, boolean
)
  from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.assert_catalog_operator(
  p_capability text,
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint
)
returns table (
  actor_user_id uuid,
  auth_session_id uuid,
  operator_session_id uuid,
  grant_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth record;
  v_grant_id uuid;
  v_authority_now timestamptz;
begin
  if p_capability is null or p_capability not in (
    'correction_queue_read', 'source_queue_read',
    'correction_claim', 'catalog_hold_claim', 'source_claim',
    'correction_triage', 'correction_disposition',
    'source_review_record', 'catalog_repair_attest',
    'catalog_hold_release'
  ) then
    raise exception 'CATALOG_OPERATOR_CAPABILITY_INVALID' using errcode = '22023';
  end if;

  select * into v_auth
  from private.catalog_operator_current_auth(
    p_auth_session_id,
    p_edge_environment,
    p_source_revision,
    p_edge_deployment_id,
    p_control_generation
  );

  -- Keep the session set stable between the grant-id scan and the fresh
  -- authorization query. Session establishment uses this exact lock and then
  -- takes grant-row locks in the same order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-session:' || v_auth.actor_user_id::text,
      0
    )
  );

  -- Lock every grant referenced by the exact live work session in UUID order.
  -- The revocation FK takes KEY SHARE on the same row, so FOR UPDATE makes
  -- grant revocation and the action commit linearizable.
  for v_grant_id in
    select referenced.grant_id
    from private.catalog_operator_sessions as operator_session
    cross join lateral pg_catalog.unnest(
      operator_session.grant_ids
    ) as referenced(grant_id)
    where operator_session.operator_user_id = v_auth.actor_user_id
      and operator_session.auth_session_id = v_auth.auth_session_id
      and operator_session.mfa_factor_id = v_auth.mfa_factor_id
      and operator_session.runtime_control_generation =
        v_auth.runtime_control_generation
      and operator_session.edge_environment = v_auth.edge_environment
      and operator_session.source_revision = v_auth.source_revision
      and operator_session.edge_deployment_id = v_auth.edge_deployment_id
      and operator_session.expires_at > pg_catalog.clock_timestamp()
    order by referenced.grant_id
  loop
    perform 1
    from private.catalog_operator_grants as grant_row
    where grant_row.id = v_grant_id
    for update;
  end loop;

  -- Each statement gets a fresh READ COMMITTED snapshot after any revocation
  -- lock wait. Use the wall clock captured after the grant locks instead of
  -- transaction-start now(), so expiry cannot win while this action waits.
  v_authority_now := pg_catalog.clock_timestamp();

  return query
  select v_auth.actor_user_id,
         v_auth.auth_session_id,
         operator_session.id,
         grant_row.id
  from private.catalog_operator_sessions as operator_session
  join private.catalog_operator_grants as grant_row
   on grant_row.id = any(operator_session.grant_ids)
   and grant_row.operator_user_id = v_auth.actor_user_id
   and grant_row.valid_from <= v_authority_now
   and grant_row.valid_until > v_authority_now
   and grant_row.grant_sha256 = private.catalog_operator_grant_sha256(
     grant_row.operator_user_id,
     grant_row.attestation_id,
     grant_row.issued_by_user_id,
     grant_row.issued_at,
     grant_row.valid_from,
     grant_row.valid_until
   )
  join private.catalog_operator_grant_attestations as attestation
   on attestation.id = grant_row.attestation_id
   and attestation.operator_user_id = grant_row.operator_user_id
   and attestation.valid_until > v_authority_now
  join private.catalog_operator_capability_bindings as binding
    on binding.grant_id = grant_row.id
   and binding.capability = p_capability
   and binding.binding_sha256 = private.catalog_operator_binding_sha256(
     binding.grant_id, binding.capability, binding.bound_at
   )
  where operator_session.operator_user_id = v_auth.actor_user_id
    and operator_session.auth_session_id = v_auth.auth_session_id
    and operator_session.mfa_factor_id = v_auth.mfa_factor_id
    and operator_session.runtime_control_generation =
      v_auth.runtime_control_generation
    and operator_session.edge_environment = v_auth.edge_environment
    and operator_session.source_revision = v_auth.source_revision
    and operator_session.edge_deployment_id = v_auth.edge_deployment_id
    and operator_session.expires_at > v_authority_now
    and operator_session.capability_set_sha256 =
      private.catalog_operator_sha256(pg_catalog.to_jsonb((
        select pg_catalog.array_agg(
          distinct current_binding.capability
          order by current_binding.capability
        )
        from private.catalog_operator_capability_bindings as current_binding
        where current_binding.grant_id = any(operator_session.grant_ids)
          and current_binding.binding_sha256 =
            private.catalog_operator_binding_sha256(
              current_binding.grant_id,
              current_binding.capability,
              current_binding.bound_at
            )
      )))
    and not exists (
      select 1
      from private.catalog_operator_grant_revocations as revocation
      where revocation.grant_id = grant_row.id
    )
  order by operator_session.established_at desc, grant_row.id
  limit 1;

  if not found then
    raise exception 'CATALOG_OPERATOR_CAPABILITY_DENIED' using errcode = '42501';
  end if;
  perform private.catalog_operator_cleanup_expired_claims(500);
end;
$$;

revoke all on function private.assert_catalog_operator(
  text, uuid, text, text, text, bigint
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function catalog_operator_gateway.catalog_operator_session(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_budget_class text
)
returns table (
  operator_session_id uuid,
  expires_at timestamptz,
  capabilities text[],
  operator_user_id uuid,
  operator_email text,
  edge_environment text,
  source_revision text,
  edge_deployment_id text,
  admission_state text,
  control_generation bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth record;
  v_grant_ids uuid[];
  v_capabilities text[];
  v_capability_set_sha256 text;
  v_expires_at timestamptz;
  v_authority_expires_at timestamptz;
  v_authority_now timestamptz;
  v_session_id uuid;
  v_grant_id uuid;
begin
  if p_budget_class not in ('preflight', 'session') then
    raise exception 'CATALOG_OPERATOR_RATE_BUDGET_INPUT_INVALID'
      using errcode = '22023';
  end if;

  select * into v_auth
  from private.catalog_operator_current_auth(
    p_auth_session_id,
    p_edge_environment,
    p_source_revision,
    p_edge_deployment_id,
    p_control_generation
  );

  if p_budget_class = 'preflight' then
    -- This statement is committed independently by the Edge gateway. It
    -- intentionally needs verified account/Auth/runtime identity, but no
    -- operator grant, so rejected and ungranted requests still spend the
    -- actor's global attempt budget. It creates no operator session.
    perform private.consume_catalog_operator_rate_budget(
      v_auth.actor_user_id,
      'preflight',
      true
    );
    return;
  end if;

  -- Serialize renewal before locking and aggregating grants, avoiding a later
  -- wait that could let an otherwise-valid grant or attestation expire.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-session:' || v_auth.actor_user_id::text,
      0
    )
  );

  -- Session establishment locks every current candidate grant before its
  -- authoritative aggregation. A concurrent FK-backed revocation therefore
  -- commits either before this fresh validation or after this transaction.
  for v_grant_id in
    select grant_row.id
    from private.catalog_operator_grants as grant_row
    where grant_row.operator_user_id = v_auth.actor_user_id
      and grant_row.valid_from <= pg_catalog.clock_timestamp()
      and grant_row.valid_until > pg_catalog.clock_timestamp()
    order by grant_row.id
    for update
  loop
    null;
  end loop;

  v_authority_now := pg_catalog.clock_timestamp();

  select pg_catalog.array_agg(distinct grant_row.id order by grant_row.id),
         pg_catalog.array_agg(
           distinct binding.capability order by binding.capability
         ),
         least(
           v_authority_now + interval '10 minutes',
           min(grant_row.valid_until),
           min(attestation.valid_until)
         )
    into v_grant_ids, v_capabilities, v_authority_expires_at
  from private.catalog_operator_grants as grant_row
  join private.catalog_operator_grant_attestations as attestation
    on attestation.id = grant_row.attestation_id
   and attestation.operator_user_id = grant_row.operator_user_id
   and attestation.valid_until > v_authority_now
  join private.catalog_operator_capability_bindings as binding
    on binding.grant_id = grant_row.id
   and binding.binding_sha256 = private.catalog_operator_binding_sha256(
     binding.grant_id, binding.capability, binding.bound_at
   )
  where grant_row.operator_user_id = v_auth.actor_user_id
    and grant_row.valid_from <= v_authority_now
    and grant_row.valid_until > v_authority_now
    and grant_row.grant_sha256 = private.catalog_operator_grant_sha256(
      grant_row.operator_user_id,
      grant_row.attestation_id,
      grant_row.issued_by_user_id,
      grant_row.issued_at,
      grant_row.valid_from,
      grant_row.valid_until
    )
    and not exists (
      select 1
      from private.catalog_operator_grant_revocations as revocation
      where revocation.grant_id = grant_row.id
    );

  if v_grant_ids is null
     or v_capabilities is null
     or v_authority_expires_at <= v_authority_now then
    raise exception 'CATALOG_OPERATOR_GRANT_REQUIRED' using errcode = '42501';
  end if;
  perform private.consume_catalog_operator_rate_budget(
    v_auth.actor_user_id,
    'session',
    false
  );
  perform private.catalog_operator_cleanup_expired_claims(500);

  v_capability_set_sha256 := private.catalog_operator_sha256(
    pg_catalog.to_jsonb(v_capabilities)
  );

  select operator_session.id, operator_session.expires_at
    into v_session_id, v_expires_at
  from private.catalog_operator_sessions as operator_session
  where operator_session.operator_user_id = v_auth.actor_user_id
    and operator_session.auth_session_id = v_auth.auth_session_id
    and operator_session.mfa_factor_id = v_auth.mfa_factor_id
    and operator_session.runtime_control_generation =
      v_auth.runtime_control_generation
    and operator_session.edge_environment = v_auth.edge_environment
    and operator_session.source_revision = v_auth.source_revision
    and operator_session.edge_deployment_id = v_auth.edge_deployment_id
    and operator_session.grant_ids = v_grant_ids
    and operator_session.capability_set_sha256 = v_capability_set_sha256
    and operator_session.expires_at >
      pg_catalog.clock_timestamp() + interval '2 minutes'
  order by operator_session.established_at desc
  limit 1;

  if v_session_id is null then
    v_expires_at := v_authority_expires_at;
    v_session_id := gen_random_uuid();
    insert into private.catalog_operator_sessions (
      id, operator_user_id, auth_session_id, mfa_factor_id,
      runtime_control_generation, edge_environment, source_revision,
      edge_deployment_id,
      grant_ids, capability_set_sha256, established_at, expires_at
    ) values (
      v_session_id,
      v_auth.actor_user_id,
      v_auth.auth_session_id,
      v_auth.mfa_factor_id,
      v_auth.runtime_control_generation,
      v_auth.edge_environment,
      v_auth.source_revision,
      v_auth.edge_deployment_id,
      v_grant_ids,
      v_capability_set_sha256,
      pg_catalog.clock_timestamp(),
      v_expires_at
    );
  end if;

  return query select
    v_session_id,
    v_expires_at,
    v_capabilities,
    v_auth.actor_user_id,
    v_auth.actor_email,
    v_auth.edge_environment,
    v_auth.source_revision,
    v_auth.edge_deployment_id,
    'open'::text,
    v_auth.runtime_control_generation;
end;
$$;

comment on function catalog_operator_gateway.catalog_operator_session(
  uuid, text, text, text, bigint, text
) is
  'Dedicated Edge-role boundary establishing a maximum-ten-minute operator session from exact signed runtime and Auth context; Postgres derives the confirmed email, actor, and verified TOTP factor.';

revoke all on function catalog_operator_gateway.catalog_operator_session(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.catalog_operator_item_snapshot(
  p_item_kind text,
  p_item_id uuid
)
returns table (
  item_version bigint,
  item_status text,
  item_created_at timestamptz,
  product_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_item_kind = 'correction_report' then
    return query
    select coalesce(work.version, 1::bigint),
           coalesce(work.status, case
             when correction.status in ('open', 'triaged', 'accepted', 'rejected')
               then correction.status
             else 'rejected'
           end),
           correction.created_at,
           correction.product_id
    from public.catalog_corrections as correction
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'correction_report'
     and work.item_id = correction.id
    where correction.id = p_item_id;
  elsif p_item_kind = 'catalog_source' then
    return query
    select coalesce(work.version, 1::bigint),
           coalesce(work.status, 'open'::text),
           source.created_at,
           null::uuid
    from public.catalog_sources as source
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'catalog_source'
     and work.item_id = source.id
    where source.id = p_item_id;
  elsif p_item_kind = 'import_batch' then
    return query
    select coalesce(work.version, 1::bigint),
           coalesce(work.status, 'open'::text),
           batch.created_at,
           null::uuid
    from public.catalog_import_batches as batch
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'import_batch'
     and work.item_id = batch.id
    where batch.id = p_item_id;
  elsif p_item_kind = 'product_hold' then
    return query
    select hold.version, hold.state, hold.opened_at, hold.product_id
    from private.catalog_operator_product_holds as hold
    where hold.id = p_item_id;
  else
    raise exception 'CATALOG_OPERATOR_ITEM_KIND_INVALID' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.catalog_operator_item_snapshot(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_product_has_blocking_reports(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_corrections as correction
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'correction_report'
     and work.item_id = correction.id
    where correction.product_id = p_product_id
      and coalesce(
        work.status,
        case
          when correction.status in ('open', 'triaged', 'accepted', 'rejected')
            then correction.status
          else 'rejected'
        end
      ) = 'triaged'
  )
$$;

revoke all on function
  private.catalog_operator_product_has_blocking_reports(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_hold_lifecycle_actor_ids(
  p_hold_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.array_agg(
      distinct event.operator_user_id order by event.operator_user_id
    ),
    '{}'::uuid[]
  )
  from private.catalog_operator_hold_events as event
  where event.hold_id = p_hold_id
    and event.event_type in (
      'hold_created', 'hold_reopened', 'hold_accepted', 'hold_rejected'
    )
$$;

revoke all on function
  private.catalog_operator_hold_lifecycle_actor_ids(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_named_auth_users(
  p_identities text[]
)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_identity text;
  v_user_id uuid;
  v_user_ids uuid[] := '{}'::uuid[];
  v_result uuid[];
begin
  if p_identities is null
     or pg_catalog.array_ndims(p_identities) <> 1
     or pg_catalog.array_lower(p_identities, 1) <> 1
     or pg_catalog.cardinality(p_identities) not between 1 and 16
     or pg_catalog.array_position(p_identities, null) is not null then
    return null;
  end if;

  foreach v_identity in array p_identities loop
    if v_identity !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return null;
    end if;
    v_user_id := v_identity::uuid;
    perform 1
    from auth.users as authority_user
    where authority_user.id = v_user_id
    for key share;
    if not found then
      return null;
    end if;
    v_user_ids := pg_catalog.array_append(v_user_ids, v_user_id);
  end loop;

  select pg_catalog.array_agg(distinct identity_id order by identity_id)
    into v_result
  from pg_catalog.unnest(v_user_ids) as identity(identity_id);
  return v_result;
end;
$$;

revoke all on function private.catalog_operator_named_auth_users(text[])
  from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_request_sha256(
  p_rpc_name text,
  p_request jsonb
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'rpcName', p_rpc_name,
      'request', p_request
    )
  )
$$;

revoke all on function private.catalog_operator_request_sha256(text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_append_audit(
  p_subject_kind text,
  p_subject_id uuid,
  p_product_id uuid,
  p_event_type text,
  p_reason_code text,
  p_operator_user_id uuid,
  p_operator_session_id uuid,
  p_evidence_sha256 text,
  p_event_payload jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_id uuid := gen_random_uuid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_chain_sequence bigint;
  v_previous text;
  v_event_sha256 text;
begin
  if p_subject_kind not in (
       'correction_workflow', 'catalog_source', 'import_batch',
       'product_hold', 'repair_attestation'
     )
     or (p_subject_kind = 'correction_workflow' and p_subject_id is not null)
     or p_event_type is null
     or p_event_type !~ '^[a-z][a-z0-9_]{2,63}$'
     or p_reason_code is null
     or p_reason_code !~ '^[a-z][a-z0-9_]{2,63}$'
     or p_operator_user_id is null
     or p_operator_session_id is null
     or (p_evidence_sha256 is not null and p_evidence_sha256 !~ '^[a-f0-9]{64}$')
     or pg_catalog.jsonb_typeof(p_event_payload) is distinct from 'object'
     or pg_catalog.pg_column_size(p_event_payload) > 4096
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_event_payload) as key(value)
       where key.value not in (
         'decision', 'statusBefore', 'statusAfter', 'holdId',
         'repairReceiptId', 'recommendationOnly', 'detailRead', 'itemKind',
         'leaseId'
       )
     )
     or (
       p_event_type = 'detail_viewed'
       and (
         p_event_payload ->> 'leaseId' is null
         or p_event_payload ->> 'leaseId' !~
           '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       )
     ) then
    raise exception 'CATALOG_OPERATOR_AUDIT_INPUT_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-audit:' || p_subject_kind || ':' ||
      coalesce(p_subject_id::text, p_product_id::text, 'global'),
      0
    )
  );

  if p_event_type = 'detail_viewed' then
    select event.id
      into v_id
    from private.catalog_operator_audit_events as event
    where event.subject_kind = p_subject_kind
      and event.subject_id is not distinct from p_subject_id
      and event.product_id is not distinct from p_product_id
      and event.event_type = 'detail_viewed'
      and event.event_payload ->> 'leaseId' =
        p_event_payload ->> 'leaseId'
    limit 1;
    if found then return v_id; end if;
    v_id := gen_random_uuid();
  end if;

  select event.chain_sequence + 1, event.event_sha256
    into v_chain_sequence, v_previous
  from private.catalog_operator_audit_events as event
  where event.subject_kind = p_subject_kind
    and event.subject_id is not distinct from p_subject_id
    and event.product_id is not distinct from p_product_id
  order by event.chain_sequence desc
  limit 1;
  v_chain_sequence := coalesce(v_chain_sequence, 1);

  v_event_sha256 := private.catalog_operator_audit_event_sha256(
    v_id, p_subject_kind, p_subject_id, p_product_id,
    v_chain_sequence, p_event_type, p_reason_code, p_operator_user_id,
    p_operator_session_id, v_now, p_evidence_sha256,
    p_event_payload, v_previous
  );

  insert into private.catalog_operator_audit_events (
    id, subject_kind, subject_id, product_id, event_type, reason_code,
    operator_user_id, operator_session_id, chain_sequence, occurred_at,
    evidence_sha256, event_payload, previous_event_sha256, event_sha256
  ) values (
    v_id, p_subject_kind, p_subject_id, p_product_id,
    p_event_type, p_reason_code, p_operator_user_id,
    p_operator_session_id, v_chain_sequence, v_now, p_evidence_sha256,
    p_event_payload, v_previous, v_event_sha256
  );
  return v_id;
end;
$$;

revoke all on function private.catalog_operator_append_audit(
  text, uuid, uuid, text, text, uuid, uuid, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function catalog_operator_gateway.catalog_operator_queue(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_queue_kind text,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  status text,
  priority integer,
  created_at timestamptz,
  summary jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_auth record;
begin
  if p_queue_kind not in ('correction', 'source_import')
     or p_limit is null or p_limit not between 1 and 50
     or (p_after_created_at is null) <> (p_after_id is null)
     or (p_after_created_at is not null and not pg_catalog.isfinite(p_after_created_at)) then
    raise exception 'CATALOG_OPERATOR_QUEUE_INPUT_INVALID' using errcode = '22023';
  end if;

  if p_queue_kind = 'correction' then
    select * into v_auth
    from private.assert_catalog_operator(
      'correction_queue_read',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  else
    select * into v_auth
    from private.assert_catalog_operator(
      'source_queue_read',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  end if;

  perform private.consume_catalog_operator_rate_budget(
    v_auth.actor_user_id,
    'queue',
    false
  );

  return query
  with queue_items as (
    select 'correction_report'::text as item_kind,
           correction.id as item_id,
           coalesce(work.version, 1::bigint) as item_version,
           coalesce(work.status, case
             when correction.status in ('open', 'triaged', 'accepted', 'rejected')
               then correction.status
             else 'rejected'
           end) as status,
           case correction.correction_type
             when 'ingredient_issue' then 10
             when 'wrong_match' then 20
             when 'source_issue' then 30
             when 'expiry_issue' then 40
             else 50
           end::integer as priority,
           correction.created_at,
           pg_catalog.jsonb_build_object(
             'correctionType', correction.correction_type,
             'productId', correction.product_id,
             'hasBarcode', correction.barcode is not null,
             'status', coalesce(work.status, correction.status)
           ) as summary
    from public.catalog_corrections as correction
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'correction_report'
     and work.item_id = correction.id
    where p_queue_kind = 'correction'
      and coalesce(work.status, correction.status) in ('open', 'triaged', 'accepted')

    union all

    select 'product_hold'::text,
           hold.id,
           hold.version,
           hold.state,
           5::integer,
           hold.opened_at,
           pg_catalog.jsonb_build_object(
             'productId', hold.product_id,
             'reasonCode', hold.reason_code,
             'state', hold.state,
             'openedAt', hold.opened_at,
             'repairReceiptReady', hold.repair_receipt_id is not null
           )
    from private.catalog_operator_product_holds as hold
    where p_queue_kind = 'correction'
      and hold.state in ('active', 'repair_attested')

    union all

    select 'catalog_source'::text,
           source.id,
           coalesce(work.version, 1::bigint),
           coalesce(work.status, 'open'::text),
           case source.review_status
             when 'blocked' then 10
             when 'pending' then 20
             else 40
           end::integer,
           source.created_at,
           pg_catalog.jsonb_build_object(
             'sourceKey', source.source_key,
             'displayName', source.display_name,
             'reviewStatus', source.review_status,
             'productionApproved', source.production_approved
           )
    from public.catalog_sources as source
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'catalog_source'
     and work.item_id = source.id
    where p_queue_kind = 'source_import'

    union all

    select 'import_batch'::text,
           batch.id,
           coalesce(work.version, 1::bigint),
           coalesce(work.status, 'open'::text),
           case
             when batch.status = 'blocked' or batch.qa_blocker_count > 0 then 10
             when batch.qa_warning_count > 0 then 20
             else 30
           end::integer,
           batch.created_at,
           pg_catalog.jsonb_build_object(
             'sourceKey', source.source_key,
             'status', batch.status,
             'artifactKind', batch.artifact_kind,
             'snapshotDate', batch.snapshot_date,
             'qaBlockerCount', batch.qa_blocker_count,
             'qaWarningCount', batch.qa_warning_count
           )
    from public.catalog_import_batches as batch
    join public.catalog_sources as source on source.id = batch.source_id
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'import_batch'
     and work.item_id = batch.id
    where p_queue_kind = 'source_import'
      and batch.status in ('finalized', 'verified', 'reviewed', 'promoted', 'blocked')
  )
  select queued.item_kind,
         queued.item_id,
         queued.item_version,
         queued.status,
         queued.priority,
         queued.created_at,
         queued.summary
  from queue_items as queued
  where p_after_created_at is null
     or (queued.created_at, queued.item_id) > (p_after_created_at, p_after_id)
  order by queued.created_at, queued.item_id
  limit p_limit;
end;
$$;

comment on function catalog_operator_gateway.catalog_operator_queue(
  uuid, text, text, text, bigint, text, timestamptz, uuid, integer
) is
  'Bounded keyset operator queue over sanitized correction, independent-hold, source, and import summaries.';

revoke all on function catalog_operator_gateway.catalog_operator_queue(
  uuid, text, text, text, bigint, text, timestamptz, uuid, integer
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function catalog_operator_gateway.catalog_operator_detail(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_item_kind text,
  p_item_id uuid,
  p_lease_id uuid,
  p_expected_version bigint
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  status text,
  detail jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_auth record;
  v_claim private.catalog_operator_claims%rowtype;
  v_snapshot record;
  v_detail jsonb;
begin
  if p_item_id is null or p_lease_id is null
     or p_expected_version is null or p_expected_version < 1
     or p_item_kind not in (
    'correction_report', 'catalog_source', 'import_batch', 'product_hold'
  ) then
    raise exception 'CATALOG_OPERATOR_DETAIL_INPUT_INVALID' using errcode = '22023';
  end if;

  if p_item_kind in ('correction_report', 'product_hold') then
    select * into v_auth
    from private.assert_catalog_operator(
      'correction_queue_read',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  else
    select * into v_auth
    from private.assert_catalog_operator(
      'source_queue_read',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  end if;

  perform private.consume_catalog_operator_rate_budget(
    v_auth.actor_user_id,
    'detail',
    false
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-item:' || p_item_kind || ':' || p_item_id::text, 0
    )
  );

  select claim.* into v_claim
  from private.catalog_operator_claims as claim
  where claim.id = p_lease_id
    and claim.item_kind = p_item_kind
    and claim.item_id = p_item_id
    and claim.operator_user_id = v_auth.actor_user_id
    and claim.operator_session_id = v_auth.operator_session_id
    and claim.expires_at > pg_catalog.now()
  for key share;
  if not found then
    raise exception 'CATALOG_OPERATOR_LEASE_INVALID' using errcode = '55P03';
  end if;
  if v_claim.item_version <> p_expected_version then
    raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
  end if;

  select * into v_snapshot
  from private.catalog_operator_item_snapshot(p_item_kind, p_item_id);
  if not found then
    raise exception 'CATALOG_OPERATOR_ITEM_NOT_FOUND' using errcode = '22023';
  end if;
  if v_snapshot.item_version <> p_expected_version then
    raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
  end if;

  if p_item_kind = 'correction_report' then
    select pg_catalog.jsonb_build_object(
      'correctionType', correction.correction_type,
      'productId', correction.product_id,
      'barcode', correction.barcode,
      'description', correction.description,
      'proposedPayload', correction.proposed_payload,
      'createdAt', correction.created_at,
      'status', v_snapshot.item_status,
      'product', case when product.id is null then null else
        pg_catalog.jsonb_build_object(
          'id', product.id,
          'name', product.name,
          'brand', product.brand,
          'category', product.category
        )
      end
    ) into v_detail
    from public.catalog_corrections as correction
    left join public.products as product on product.id = correction.product_id
    where correction.id = p_item_id;

    perform private.catalog_operator_append_audit(
      'correction_workflow', null, v_snapshot.product_id,
      'detail_viewed', 'authorized_review',
      v_auth.actor_user_id, v_auth.operator_session_id, null,
      pg_catalog.jsonb_build_object(
        'detailRead', true, 'itemKind', 'correction_report',
        'leaseId', p_lease_id
      )
    );
  elsif p_item_kind = 'product_hold' then
    select pg_catalog.jsonb_build_object(
      'productId', hold.product_id,
      'reasonCode', hold.reason_code,
      'state', hold.state,
      'openedAt', hold.opened_at,
      'acceptedAt', hold.accepted_at,
      'disposition', hold.disposition,
      'dispositionAt', hold.disposition_at,
      'repairReceiptId', hold.repair_receipt_id,
      'repairAttestedAt', hold.repair_attested_at,
      'releasedAt', hold.released_at,
      'product', pg_catalog.jsonb_build_object(
        'id', product.id,
        'name', product.name,
        'brand', product.brand,
        'category', product.category
      )
    ) into v_detail
    from private.catalog_operator_product_holds as hold
    join public.products as product on product.id = hold.product_id
    where hold.id = p_item_id;

    perform private.catalog_operator_append_audit(
      'product_hold', p_item_id, v_snapshot.product_id,
      'detail_viewed', 'authorized_review',
      v_auth.actor_user_id, v_auth.operator_session_id, null,
      pg_catalog.jsonb_build_object(
        'detailRead', true, 'itemKind', 'product_hold',
        'leaseId', p_lease_id
      )
    );
  elsif p_item_kind = 'catalog_source' then
    select pg_catalog.jsonb_build_object(
      'sourceKey', source.source_key,
      'displayName', source.display_name,
      'sourceUrl', source.source_url,
      'licenseName', source.license_name,
      'licenseUrl', source.license_url,
      'requiresAttribution', source.requires_attribution,
      'requiresShareAlike', source.requires_share_alike,
      'allowsImages', source.allows_images,
      'productionApproved', source.production_approved,
      'reviewStatus', source.review_status,
      'reviewedAt', source.reviewed_at
    ) into v_detail
    from public.catalog_sources as source
    where source.id = p_item_id;

    perform private.catalog_operator_append_audit(
      'catalog_source', p_item_id, null,
      'detail_viewed', 'authorized_review',
      v_auth.actor_user_id, v_auth.operator_session_id, null,
      pg_catalog.jsonb_build_object(
        'detailRead', true, 'itemKind', 'catalog_source',
        'leaseId', p_lease_id
      )
    );
  else
    select pg_catalog.jsonb_build_object(
      'sourceKey', source.source_key,
      'batchType', batch.batch_type,
      'snapshotDate', batch.snapshot_date,
      'artifactKind', batch.artifact_kind,
      'territory', batch.territory,
      'status', batch.status,
      'artifactSha256', batch.artifact_sha256,
      'manifestSha256', batch.manifest_sha256,
      'sourcePolicySha256', batch.source_policy_sha256,
      'sourceApprovalSha256', batch.source_approval_sha256,
      'qaReportSha256', batch.qa_report_sha256,
      'qaBlockerCount', batch.qa_blocker_count,
      'qaWarningCount', batch.qa_warning_count,
      'expectedRecordCount', batch.expected_record_count,
      'stagedRecordCount', batch.staged_record_count,
      'acceptedRecordCount', batch.accepted_record_count,
      'conflictRecordCount', batch.conflict_record_count,
      'verificationEvidenceSha256', batch.verification_evidence_sha256,
      'reviewEvidenceSha256', batch.review_evidence_sha256,
      'createdAt', batch.created_at
    ) into v_detail
    from public.catalog_import_batches as batch
    join public.catalog_sources as source on source.id = batch.source_id
    where batch.id = p_item_id;

    perform private.catalog_operator_append_audit(
      'import_batch', p_item_id, null,
      'detail_viewed', 'authorized_review',
      v_auth.actor_user_id, v_auth.operator_session_id, null,
      pg_catalog.jsonb_build_object(
        'detailRead', true, 'itemKind', 'import_batch',
        'leaseId', p_lease_id
      )
    );
  end if;

  if v_detail is null or pg_catalog.pg_column_size(v_detail) > 16384 then
    raise exception 'CATALOG_OPERATOR_DETAIL_UNAVAILABLE' using errcode = '55000';
  end if;

  return query select p_item_kind, p_item_id,
    v_snapshot.item_version, v_snapshot.item_status, v_detail;
end;
$$;

comment on function catalog_operator_gateway.catalog_operator_detail(
  uuid, text, text, text, bigint, text, uuid, uuid, bigint
) is
  'Returns a bounded, field-allowlisted detail only for the current actor exact live lease/version and appends a reporter-identity-free access audit event.';

revoke all on function catalog_operator_gateway.catalog_operator_detail(
  uuid, text, text, text, bigint, text, uuid, uuid, bigint
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function catalog_operator_gateway.catalog_operator_claim(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_operation_id uuid,
  p_item_kind text,
  p_item_id uuid,
  p_expected_version bigint
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  lease_id uuid,
  lease_expires_at timestamptz,
  status text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth record;
  v_snapshot record;
  v_request_sha256 text;
  v_existing private.catalog_operator_operation_receipts%rowtype;
  v_lease_id uuid;
  v_expires_at timestamptz;
  v_response jsonb;
begin
  if p_operation_id is null
     or p_operation_id::text !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_item_id is null
     or p_expected_version is null or p_expected_version < 1
     or p_item_kind not in (
       'correction_report', 'catalog_source', 'import_batch', 'product_hold'
     ) then
    raise exception 'CATALOG_OPERATOR_CLAIM_INPUT_INVALID' using errcode = '22023';
  end if;

  if p_item_kind = 'correction_report' then
    select * into v_auth
    from private.assert_catalog_operator(
      'correction_claim',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  elsif p_item_kind = 'product_hold' then
    select * into v_auth
    from private.assert_catalog_operator(
      'catalog_hold_claim',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  else
    select * into v_auth
    from private.assert_catalog_operator(
      'source_claim',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
  end if;

  perform private.consume_catalog_operator_rate_budget(
    v_auth.actor_user_id,
    'claim',
    false
  );

  v_request_sha256 := private.catalog_operator_request_sha256(
    'catalog_operator_claim',
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id,
      'itemKind', p_item_kind,
      'itemId', p_item_id,
      'expectedVersion', p_expected_version
    )
  );

  -- Serialize the receipt check as well as the item claim. Without an
  -- operation-key lock, two concurrent first attempts could both miss the
  -- receipt and turn an otherwise replay-safe request into a unique violation.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-operation:' || p_operation_id::text, 0
    )
  );

  select receipt.* into v_existing
  from private.catalog_operator_operation_receipts as receipt
  where receipt.operation_id = p_operation_id;
  if found then
    if v_existing.operator_user_id <> v_auth.actor_user_id
       or v_existing.rpc_name <> 'catalog_operator_claim'
       or v_existing.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_OPERATOR_OPERATION_CONFLICT' using errcode = '55000';
    end if;
    return query select
      p_item_kind,
      p_item_id,
      (v_existing.response ->> 'itemVersion')::bigint,
      (v_existing.response ->> 'leaseId')::uuid,
      (v_existing.response ->> 'leaseExpiresAt')::timestamptz,
      v_existing.response ->> 'status';
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-item:' || p_item_kind || ':' || p_item_id::text, 0
    )
  );

  select * into v_snapshot
  from private.catalog_operator_item_snapshot(p_item_kind, p_item_id);
  if not found then
    raise exception 'CATALOG_OPERATOR_ITEM_NOT_FOUND' using errcode = '22023';
  end if;
  if v_snapshot.item_version <> p_expected_version then
    raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
  end if;

  delete from private.catalog_operator_claims as claim
  where claim.item_kind = p_item_kind
    and claim.item_id = p_item_id
    and claim.expires_at <= pg_catalog.now();

  if exists (
    select 1
    from private.catalog_operator_claims as claim
    where claim.item_kind = p_item_kind
      and claim.item_id = p_item_id
      and claim.expires_at > pg_catalog.now()
  ) then
    raise exception 'CATALOG_OPERATOR_ITEM_ALREADY_CLAIMED' using errcode = '55P03';
  end if;

  v_lease_id := gen_random_uuid();
  v_expires_at := least(
    pg_catalog.now() + interval '5 minutes',
    (
      select operator_session.expires_at
      from private.catalog_operator_sessions as operator_session
      where operator_session.id = v_auth.operator_session_id
    )
  );
  if v_expires_at <= pg_catalog.now() then
    raise exception 'CATALOG_OPERATOR_SESSION_EXPIRED' using errcode = '28000';
  end if;

  insert into private.catalog_operator_claims (
    id, operation_id, item_kind, item_id, item_version,
    operator_user_id, operator_session_id, claimed_at, expires_at
  ) values (
    v_lease_id, p_operation_id, p_item_kind, p_item_id,
    v_snapshot.item_version, v_auth.actor_user_id,
    v_auth.operator_session_id, pg_catalog.clock_timestamp(), v_expires_at
  );

  v_response := pg_catalog.jsonb_build_object(
    'itemVersion', v_snapshot.item_version,
    'leaseId', v_lease_id,
    'leaseExpiresAt', v_expires_at,
    'status', v_snapshot.item_status
  );
  insert into private.catalog_operator_operation_receipts (
    operation_id, operator_user_id, rpc_name, request_sha256, response
  ) values (
    p_operation_id, v_auth.actor_user_id,
    'catalog_operator_claim', v_request_sha256, v_response
  );

  return query select p_item_kind, p_item_id,
    v_snapshot.item_version, v_lease_id, v_expires_at,
    v_snapshot.item_status;
end;
$$;

comment on function catalog_operator_gateway.catalog_operator_claim(
  uuid, text, text, text, bigint, uuid, text, uuid, bigint
) is
  'Acquires a database-generated, maximum-five-minute item lease with advisory serialization, version CAS, and UUIDv4 idempotency.';

revoke all on function catalog_operator_gateway.catalog_operator_claim(
  uuid, text, text, text, bigint, uuid, text, uuid, bigint
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function private.catalog_operator_append_hold_event(
  p_hold_id uuid,
  p_event_type text,
  p_from_state text,
  p_to_state text,
  p_reason_code text,
  p_operator_user_id uuid,
  p_operator_session_id uuid,
  p_repair_receipt_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_hold private.catalog_operator_product_holds%rowtype;
  v_id uuid := gen_random_uuid();
  v_sequence bigint;
  v_previous text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-hold-event:' || p_hold_id::text, 0
    )
  );
  select hold.* into v_hold
  from private.catalog_operator_product_holds as hold
  where hold.id = p_hold_id;
  if not found then
    raise exception 'CATALOG_OPERATOR_HOLD_NOT_FOUND' using errcode = '22023';
  end if;

  select coalesce(max(event.sequence), 0) + 1,
         (array_agg(event.event_sha256 order by event.sequence desc))[1]
    into v_sequence, v_previous
  from private.catalog_operator_hold_events as event
  where event.hold_id = p_hold_id;

  v_hash := private.catalog_operator_hold_event_sha256(
    v_id, p_hold_id, v_hold.product_id, v_sequence,
    p_event_type, p_from_state, p_to_state, p_reason_code,
    p_operator_user_id, p_operator_session_id,
    p_repair_receipt_id, v_now, v_previous
  );
  insert into private.catalog_operator_hold_events (
    id, hold_id, product_id, sequence, event_type, from_state, to_state,
    reason_code, operator_user_id, operator_session_id, repair_receipt_id,
    occurred_at, previous_event_sha256, event_sha256
  ) values (
    v_id, p_hold_id, v_hold.product_id, v_sequence,
    p_event_type, p_from_state, p_to_state, p_reason_code,
    p_operator_user_id, p_operator_session_id, p_repair_receipt_id,
    v_now, v_previous, v_hash
  );
  return v_id;
end;
$$;

revoke all on function private.catalog_operator_append_hold_event(
  uuid, text, text, text, text, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

-- Independent holds are serving-state authority. Extend the existing CAT-03
-- mutation ledger's relation vocabulary, then append through the same global
-- serialization and predecessor chain used by product/dependency mutations.
alter table private.catalog_launch_curation_product_mutations
  drop constraint catalog_launch_curation_product_mutations_source_relation_check;

alter table private.catalog_launch_curation_product_mutations
  add constraint catalog_launch_curation_product_mutations_source_relation_check
  check (source_relation in (
    'public.products',
    'public.catalog_sources',
    'public.catalog_import_batches',
    'public.brands',
    'public.product_categories',
    'public.product_barcodes',
    'public.product_ingredient_lists',
    'public.product_ingredient_tokens',
    'public.product_ingredients',
    'public.ingredients',
    'public.ingredient_synonyms',
    'public.ingredient_tag_assignments',
    'public.ingredient_tag_definitions',
    'public.product_active_bands',
    'public.product_pao_expiry',
    'public.catalog_corrections',
    'private.catalog_import_staged_records',
    'private.catalog_operator_product_holds'
  ));

create or replace function private.catalog_operator_append_hold_mutation(
  p_product_id uuid,
  p_hold_id uuid,
  p_operation text,
  p_before_row jsonb,
  p_after_row jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_id uuid := gen_random_uuid();
  v_generation bigint;
  v_previous_root text;
  v_before_sha256 text;
  v_after_sha256 text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_event_sha256 text;
  v_root_sha256 text;
begin
  if p_product_id is null or p_hold_id is null
     or p_operation not in ('INSERT', 'UPDATE')
     or (p_operation = 'INSERT' and (p_before_row is not null or p_after_row is null))
     or (p_operation = 'UPDATE' and (p_before_row is null or p_after_row is null))
     or (p_before_row is not null and (
       p_before_row ?| array['userId', 'correctionId', 'description', 'barcode']
     ))
     or (p_after_row is not null and (
       p_after_row ?| array['userId', 'correctionId', 'description', 'barcode']
     )) then
    raise exception 'CATALOG_OPERATOR_HOLD_MUTATION_INPUT_INVALID' using errcode = '22023';
  end if;

  -- Every served-state mutation follows the same lock order as ordinary
  -- product writes: product row first, then the global mutation-chain lock.
  perform 1
  from public.products as product
  where product.id = p_product_id
  for update;
  if not found then
    raise exception 'CATALOG_OPERATOR_PRODUCT_NOT_FOUND' using errcode = '22023';
  end if;

  v_before_sha256 := case when p_before_row is null then null else
    private.catalog_import_sha256_text(
      private.catalog_import_canonical_json(p_before_row)
    ) end;
  v_after_sha256 := private.catalog_import_sha256_text(
    private.catalog_import_canonical_json(p_after_row)
  );
  if p_operation = 'UPDATE' and v_before_sha256 = v_after_sha256 then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  select mutation.generation,
         mutation.served_state_mutation_root_sha256
    into v_generation, v_previous_root
  from private.catalog_launch_curation_product_mutations as mutation
  where mutation.product_id = p_product_id
  order by mutation.generation desc
  limit 1;
  if not found then
    v_generation := 0;
    v_previous_root :=
      private.catalog_launch_served_state_mutation_root_sha256(
        p_product_id, 0, null
      );
  end if;
  v_generation := v_generation + 1;
  v_event_sha256 :=
    private.catalog_launch_served_state_mutation_event_sha256(
      v_id, p_product_id, v_generation, 'operator_correction_hold',
      'private.catalog_operator_product_holds', p_hold_id::text,
      p_operation, v_now, v_before_sha256, v_after_sha256, v_previous_root
    );
  v_root_sha256 := private.catalog_launch_served_state_mutation_root_sha256(
    p_product_id, v_generation, v_event_sha256
  );

  insert into private.catalog_launch_curation_product_mutations (
    id, product_id, generation, mutation_kind, source_relation,
    source_row_key, mutation_operation, observed_at,
    before_row_sha256, after_row_sha256,
    previous_served_state_mutation_root_sha256,
    mutation_event_sha256, served_state_mutation_root_sha256
  ) values (
    v_id, p_product_id, v_generation, 'operator_correction_hold',
    'private.catalog_operator_product_holds', p_hold_id::text,
    p_operation, v_now, v_before_sha256, v_after_sha256,
    v_previous_root, v_event_sha256, v_root_sha256
  );
end;
$$;

revoke all on function private.catalog_operator_append_hold_mutation(
  uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.catalog_operator_repair_receipt_sha256(
  p_hold_id uuid,
  p_hold_version bigint,
  p_product_id uuid,
  p_attested_by_user_id uuid,
  p_evidence_sha256 text,
  p_import_batch_id uuid,
  p_product_record_sha256 text,
  p_cat02_verification_evidence_sha256 text,
  p_curation_record_id uuid,
  p_curation_campaign_id uuid,
  p_curation_record_sha256 text,
  p_served_state_mutation_root_sha256 text,
  p_baseline_import_batch_id uuid,
  p_baseline_product_record_sha256 text,
  p_baseline_served_state_mutation_root_sha256 text,
  p_repair_authority_user_ids uuid[],
  p_attested_at timestamptz,
  p_valid_until timestamptz
)
returns text
language sql
immutable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'contractId', 'catalog-operator-cat02-cat03-repair-receipt-v2',
      'holdId', p_hold_id,
      'holdVersion', p_hold_version,
      'productId', p_product_id,
      'attestedByUserId', p_attested_by_user_id,
      'evidenceSha256', p_evidence_sha256,
      'importBatchId', p_import_batch_id,
      'productRecordSha256', p_product_record_sha256,
      'cat02VerificationEvidenceSha256', p_cat02_verification_evidence_sha256,
      'curationRecordId', p_curation_record_id,
      'curationCampaignId', p_curation_campaign_id,
      'curationRecordSha256', p_curation_record_sha256,
      'servedStateMutationRootSha256', p_served_state_mutation_root_sha256,
      'baselineImportBatchId', p_baseline_import_batch_id,
      'baselineProductRecordSha256', p_baseline_product_record_sha256,
      'baselineServedStateMutationRootSha256',
        p_baseline_served_state_mutation_root_sha256,
      'repairAuthorityUserIds', pg_catalog.to_jsonb(p_repair_authority_user_ids),
      'attestedAt', pg_catalog.to_char(
        p_attested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ),
      'validUntil', pg_catalog.to_char(
        p_valid_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      )
    )
  )
$$;

alter table private.catalog_operator_repair_authority_receipts
  add constraint catalog_operator_repair_authority_receipts_hash_check check (
    receipt_sha256 = private.catalog_operator_repair_receipt_sha256(
      hold_id, hold_version, product_id, attested_by_user_id,
      evidence_sha256, import_batch_id, product_record_sha256,
      cat02_verification_evidence_sha256, curation_record_id,
      curation_campaign_id, curation_record_sha256,
      served_state_mutation_root_sha256, baseline_import_batch_id,
      baseline_product_record_sha256,
      baseline_served_state_mutation_root_sha256,
      repair_authority_user_ids, attested_at, valid_until
    )
  );

revoke all on function private.catalog_operator_repair_receipt_sha256(
  uuid, bigint, uuid, uuid, text, uuid, text, text, uuid, uuid, text, text,
  uuid, text, text, uuid[], timestamptz, timestamptz
) from public, anon, authenticated, service_role;

create or replace function catalog_operator_gateway.catalog_operator_transition(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_operation_id uuid,
  p_item_kind text,
  p_item_id uuid,
  p_lease_id uuid,
  p_expected_version bigint,
  p_decision text,
  p_reason_code text,
  p_evidence_sha256 text default null
)
returns table (
  item_kind text,
  item_id uuid,
  item_version bigint,
  status text,
  hold_id uuid,
  repair_receipt_id uuid,
  event_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_auth record;
  v_snapshot record;
  v_claim private.catalog_operator_claims%rowtype;
  v_work private.catalog_operator_work_states%rowtype;
  v_correction public.catalog_corrections%rowtype;
  v_hold private.catalog_operator_product_holds%rowtype;
  v_product public.products%rowtype;
  v_hold_product_id uuid;
  v_previous_hold_state text;
  v_baseline_root_sha256 text;
  v_hold_lifecycle_actor_ids uuid[];
  v_before_hold jsonb;
  v_after_hold jsonb;
  v_request_sha256 text;
  v_existing private.catalog_operator_operation_receipts%rowtype;
  v_new_version bigint;
  v_new_status text;
  v_hold_id uuid;
  v_repair_receipt_id uuid;
  v_event_id uuid;
  v_response jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_record record;
  v_receipt_sha256 text;
  v_allowed boolean := false;
begin
  if p_operation_id is null
     or p_operation_id::text !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_item_id is null or p_lease_id is null
     or p_expected_version is null or p_expected_version < 1
     or p_item_kind not in (
       'correction_report', 'catalog_source', 'import_batch', 'product_hold'
     )
     or p_decision is null or p_reason_code is null
     or (p_evidence_sha256 is not null and p_evidence_sha256 !~ '^[a-f0-9]{64}$') then
    raise exception 'CATALOG_OPERATOR_TRANSITION_INPUT_INVALID' using errcode = '22023';
  end if;

  if p_item_kind = 'correction_report' then
    if p_decision = 'triage' then
      select * into v_auth
      from private.assert_catalog_operator(
        'correction_triage',
        p_auth_session_id,
        p_edge_environment,
        p_source_revision,
        p_edge_deployment_id,
        p_control_generation
      );
      v_allowed := p_reason_code in (
        'wrong_match_confirmed', 'ingredient_risk_confirmed',
        'source_defect_confirmed', 'expiry_defect_confirmed',
        'category_defect_confirmed', 'duplicate_confirmed',
        'missing_product_confirmed'
      );
    elsif p_decision in ('accept', 'reject') then
      select * into v_auth
      from private.assert_catalog_operator(
        'correction_disposition',
        p_auth_session_id,
        p_edge_environment,
        p_source_revision,
        p_edge_deployment_id,
        p_control_generation
      );
      v_allowed := (
        p_decision = 'accept' and p_reason_code = 'repair_required'
      ) or (
        p_decision = 'reject' and p_reason_code in (
          'not_reproducible', 'report_incorrect', 'insufficient_evidence'
        )
      );
    end if;
    if p_evidence_sha256 is not null then v_allowed := false; end if;
  elsif p_item_kind in ('catalog_source', 'import_batch') then
    select * into v_auth
    from private.assert_catalog_operator(
      'source_review_record',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
    v_allowed :=
      (p_decision = 'acknowledge' and p_reason_code = 'reviewed_no_change')
      or (p_decision = 'request_changes' and p_reason_code in (
        'rights_gap', 'attribution_gap', 'artifact_gap',
        'quality_gap', 'provenance_gap'
      ))
      or (p_decision = 'escalate' and p_reason_code in (
        'legal_review_required', 'security_review_required',
        'source_withdrawal_risk'
      ))
      or (p_item_kind = 'import_batch'
        and p_decision = 'recommend_promotion'
        and p_reason_code = 'evidence_complete')
      or (p_item_kind = 'import_batch'
        and p_decision = 'recommend_rollback'
        and p_reason_code in (
          'integrity_failure', 'source_withdrawn', 'quality_regression'
        ));
    if p_evidence_sha256 is not null then v_allowed := false; end if;
  else
    select * into v_auth
    from private.assert_catalog_operator(
      'catalog_repair_attest',
      p_auth_session_id,
      p_edge_environment,
      p_source_revision,
      p_edge_deployment_id,
      p_control_generation
    );
    v_allowed := p_decision = 'attest_repair'
      and p_reason_code = 'cat02_cat03_repair_verified'
      and p_evidence_sha256 ~ '^[a-f0-9]{64}$';
  end if;
  if not v_allowed then
    raise exception 'CATALOG_OPERATOR_TRANSITION_NOT_ALLOWED' using errcode = '22023';
  end if;

  perform private.consume_catalog_operator_rate_budget(
    v_auth.actor_user_id,
    'transition',
    false
  );

  v_request_sha256 := private.catalog_operator_request_sha256(
    'catalog_operator_transition',
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id,
      'itemKind', p_item_kind,
      'itemId', p_item_id,
      'leaseId', p_lease_id,
      'expectedVersion', p_expected_version,
      'decision', p_decision,
      'reasonCode', p_reason_code,
      'evidenceSha256', p_evidence_sha256
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-operation:' || p_operation_id::text, 0
    )
  );
  select receipt.* into v_existing
  from private.catalog_operator_operation_receipts as receipt
  where receipt.operation_id = p_operation_id;
  if found then
    if v_existing.operator_user_id <> v_auth.actor_user_id
       or v_existing.rpc_name <> 'catalog_operator_transition'
       or v_existing.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_OPERATOR_OPERATION_CONFLICT' using errcode = '55000';
    end if;
    return query select
      p_item_kind,
      p_item_id,
      (v_existing.response ->> 'itemVersion')::bigint,
      v_existing.response ->> 'status',
      nullif(v_existing.response ->> 'holdId', '')::uuid,
      nullif(v_existing.response ->> 'repairReceiptId', '')::uuid,
      (v_existing.response ->> 'eventId')::uuid;
    return;
  end if;

  if p_item_kind = 'product_hold' then
    select hold.product_id into v_hold_product_id
    from private.catalog_operator_product_holds as hold
    where hold.id = p_item_id;
    if not found then
      raise exception 'CATALOG_OPERATOR_HOLD_NOT_FOUND' using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'catalog-operator-product-hold:' || v_hold_product_id::text, 0
      )
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-item:' || p_item_kind || ':' || p_item_id::text, 0
    )
  );

  select claim.* into v_claim
  from private.catalog_operator_claims as claim
  where claim.id = p_lease_id
    and claim.item_kind = p_item_kind
    and claim.item_id = p_item_id
    and claim.item_version = p_expected_version
    and claim.operator_user_id = v_auth.actor_user_id
    and claim.operator_session_id = v_auth.operator_session_id
    and claim.expires_at > pg_catalog.now()
  for update;
  if not found then
    raise exception 'CATALOG_OPERATOR_LEASE_INVALID' using errcode = '55P03';
  end if;

  select * into v_snapshot
  from private.catalog_operator_item_snapshot(p_item_kind, p_item_id);
  if not found then
    raise exception 'CATALOG_OPERATOR_ITEM_NOT_FOUND' using errcode = '22023';
  end if;
  if v_snapshot.item_version <> p_expected_version then
    raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
  end if;

  if p_item_kind = 'correction_report' then
    select correction.* into v_correction
    from public.catalog_corrections as correction
    where correction.id = p_item_id
    for update;
    if not found then
      raise exception 'CATALOG_OPERATOR_ITEM_NOT_FOUND' using errcode = '22023';
    end if;

    if v_correction.product_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          'catalog-operator-product-hold:' || v_correction.product_id::text, 0
        )
      );
    end if;

    insert into private.catalog_operator_work_states (
      item_kind, item_id, version, status, last_actor_user_id, updated_at
    ) values (
      'correction_report', p_item_id, 1,
      case when v_correction.status in ('open', 'triaged', 'accepted', 'rejected')
        then v_correction.status else 'rejected' end,
      null, v_now
    ) on conflict (item_kind, item_id) do nothing;

    select work.* into v_work
    from private.catalog_operator_work_states as work
    where work.item_kind = 'correction_report'
      and work.item_id = p_item_id
    for update;

    if p_decision = 'triage' then
      if v_work.status <> 'open' then
        raise exception 'CATALOG_OPERATOR_TRANSITION_STATE_INVALID' using errcode = '55000';
      end if;
      if (
        v_correction.correction_type = 'missing_product'
        and (v_correction.product_id is not null
          or p_reason_code <> 'missing_product_confirmed')
      ) or (
        v_correction.correction_type <> 'missing_product'
        and (
          v_correction.product_id is null
          or p_reason_code <> case v_correction.correction_type
            when 'wrong_match' then 'wrong_match_confirmed'
            when 'ingredient_issue' then 'ingredient_risk_confirmed'
            when 'source_issue' then 'source_defect_confirmed'
            when 'expiry_issue' then 'expiry_defect_confirmed'
            when 'category_issue' then 'category_defect_confirmed'
            when 'duplicate' then 'duplicate_confirmed'
            else '__invalid__'
          end
        )
      ) then
        raise exception 'CATALOG_OPERATOR_CORRECTION_REASON_MISMATCH' using errcode = '22023';
      end if;

      v_new_status := 'triaged';
      if v_correction.product_id is not null then
        select hold.id into v_hold_id
        from private.catalog_operator_product_holds as hold
        where hold.product_id = v_correction.product_id
          and hold.state in ('active', 'repair_attested');
        if v_hold_id is not null then
          perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              'catalog-operator-item:product_hold:' || v_hold_id::text, 0
            )
          );
          select hold.* into v_hold
          from private.catalog_operator_product_holds as hold
          where hold.id = v_hold_id
            and hold.product_id = v_correction.product_id
            and hold.state in ('active', 'repair_attested')
          for update;
          if not found then
            raise exception 'CATALOG_OPERATOR_HOLD_STATE_CHANGED'
              using errcode = '40001';
          end if;
        end if;

        select product.* into v_product
        from public.products as product
        where product.id = v_correction.product_id
        for update;
        if not found then
          raise exception 'CATALOG_OPERATOR_PRODUCT_NOT_FOUND' using errcode = '22023';
        end if;
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
        );
        v_baseline_root_sha256 :=
          private.catalog_launch_current_served_state_mutation_root_sha256(
            v_product.id
          );

        if v_hold_id is null then
          v_hold_id := gen_random_uuid();
          insert into private.catalog_operator_product_holds (
            id, product_id, reason_code, state, version,
            triaged_by_user_id, legacy_origin_sha256,
            baseline_import_batch_id, baseline_product_record_sha256,
            baseline_served_state_mutation_root_sha256, opened_at
          ) values (
            v_hold_id, v_correction.product_id, p_reason_code,
            'active', 1, v_auth.actor_user_id, null,
            v_product.import_batch_id, v_product.import_record_sha256,
            v_baseline_root_sha256, v_now
          ) returning * into v_hold;
          perform private.catalog_operator_append_hold_event(
            v_hold.id, 'hold_created', null, 'active', p_reason_code,
            v_auth.actor_user_id, v_auth.operator_session_id, null
          );
        else
          v_previous_hold_state := v_hold.state;
          v_before_hold := pg_catalog.jsonb_build_object(
            'id', v_hold.id, 'productId', v_hold.product_id,
            'reasonCode', v_hold.reason_code, 'state', v_hold.state,
            'version', v_hold.version
          );
          delete from private.catalog_operator_claims as claim
          where claim.item_kind = 'product_hold'
            and claim.item_id = v_hold.id;
          update private.catalog_operator_product_holds as hold
             set reason_code = p_reason_code,
                 state = 'active',
                 version = hold.version + 1,
                 triaged_by_user_id = v_auth.actor_user_id,
                 legacy_origin_sha256 = null,
                 baseline_import_batch_id = v_product.import_batch_id,
                 baseline_product_record_sha256 = v_product.import_record_sha256,
                 baseline_served_state_mutation_root_sha256 =
                   v_baseline_root_sha256,
                 disposition = null,
                 disposition_by_user_id = null,
                 disposition_at = null,
                 accepted_by_user_id = null,
                 accepted_at = null,
                 repair_receipt_id = null,
                 repair_attested_at = null,
                 released_by_user_id = null,
                 released_at = null,
                 opened_at = v_now
           where hold.id = v_hold.id
          returning hold.* into v_hold;
          perform private.catalog_operator_append_hold_event(
            v_hold.id, 'hold_reopened', v_previous_hold_state, 'active',
            p_reason_code, v_auth.actor_user_id,
            v_auth.operator_session_id, null
          );
        end if;

        v_after_hold := pg_catalog.jsonb_build_object(
          'id', v_hold.id, 'productId', v_hold.product_id,
          'reasonCode', v_hold.reason_code, 'state', v_hold.state,
          'version', v_hold.version
        );
        perform private.catalog_operator_append_hold_mutation(
          v_hold.product_id, v_hold.id,
          case when v_before_hold is null then 'INSERT' else 'UPDATE' end,
          v_before_hold, v_after_hold
        );
        perform public.refresh_product_correction_count(v_hold.product_id);
        -- Baseline the final post-hold serving root. Baseline fields are
        -- deliberately excluded from the mutation projection so recording
        -- this boundary cannot itself satisfy the later repair-delta gate.
        v_baseline_root_sha256 :=
          private.catalog_launch_current_served_state_mutation_root_sha256(
            v_hold.product_id
          );
        update private.catalog_operator_product_holds as hold
           set baseline_served_state_mutation_root_sha256 =
             v_baseline_root_sha256
         where hold.id = v_hold.id
        returning hold.* into v_hold;
      end if;
    elsif p_decision = 'accept' then
      if v_work.status <> 'triaged'
         or v_work.last_actor_user_id is null
         or v_work.last_actor_user_id = v_auth.actor_user_id then
        raise exception 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED' using errcode = '42501';
      end if;
      v_new_status := 'accepted';
      if v_correction.product_id is not null then
        select hold.id into v_hold_id
        from private.catalog_operator_product_holds as hold
        where hold.product_id = v_correction.product_id
          and hold.state in ('active', 'repair_attested');
        if not found then
          raise exception 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED' using errcode = '42501';
        end if;
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'catalog-operator-item:product_hold:' || v_hold_id::text, 0
          )
        );
        select hold.* into v_hold
        from private.catalog_operator_product_holds as hold
        where hold.id = v_hold_id
          and hold.product_id = v_correction.product_id
          and hold.state in ('active', 'repair_attested')
        for update;
        if not found or v_hold.triaged_by_user_id is null
           or v_hold.triaged_by_user_id = v_auth.actor_user_id then
          raise exception 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED' using errcode = '42501';
        end if;
        v_hold_id := v_hold.id;
        update private.catalog_operator_product_holds as hold
           set disposition = 'accepted',
               disposition_by_user_id = v_auth.actor_user_id,
               disposition_at = v_now,
               accepted_by_user_id = v_auth.actor_user_id,
               accepted_at = v_now,
               version = hold.version + 1
         where hold.id = v_hold.id
        returning hold.* into v_hold;
        delete from private.catalog_operator_claims as claim
        where claim.item_kind = 'product_hold'
          and claim.item_id = v_hold.id;
        perform private.catalog_operator_append_hold_event(
          v_hold.id, 'hold_accepted', v_hold.state, v_hold.state,
          p_reason_code, v_auth.actor_user_id,
          v_auth.operator_session_id, null
        );
      end if;
    else
      if v_work.status <> 'triaged'
         or v_work.last_actor_user_id is null
         or v_work.last_actor_user_id = v_auth.actor_user_id then
        raise exception 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED' using errcode = '42501';
      end if;
      v_new_status := 'rejected';
      if v_correction.product_id is not null then
        select hold.id into v_hold_id
        from private.catalog_operator_product_holds as hold
        where hold.product_id = v_correction.product_id
          and hold.state in ('active', 'repair_attested');
        if not found then
          raise exception 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED' using errcode = '42501';
        end if;
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended(
            'catalog-operator-item:product_hold:' || v_hold_id::text, 0
          )
        );
        select hold.* into v_hold
        from private.catalog_operator_product_holds as hold
        where hold.id = v_hold_id
          and hold.product_id = v_correction.product_id
          and hold.state in ('active', 'repair_attested')
        for update;
        if not found or v_hold.triaged_by_user_id is null
           or v_hold.triaged_by_user_id = v_auth.actor_user_id then
          raise exception 'CATALOG_OPERATOR_SECOND_PERSON_REQUIRED' using errcode = '42501';
        end if;
        v_hold_id := v_hold.id;
        update private.catalog_operator_product_holds as hold
           set disposition = case
                 when hold.disposition = 'accepted' then 'accepted'
                 else 'rejected'
               end,
               disposition_by_user_id = case
                 when hold.disposition = 'accepted'
                   then hold.disposition_by_user_id
                 else coalesce(hold.disposition_by_user_id, v_auth.actor_user_id)
               end,
               disposition_at = case
                 when hold.disposition = 'accepted' then hold.disposition_at
                 else coalesce(hold.disposition_at, v_now)
               end,
               version = hold.version + 1
         where hold.id = v_hold.id
        returning hold.* into v_hold;
        delete from private.catalog_operator_claims as claim
        where claim.item_kind = 'product_hold'
          and claim.item_id = v_hold.id;
        perform private.catalog_operator_append_hold_event(
          v_hold.id, 'hold_rejected', v_hold.state, v_hold.state,
          p_reason_code, v_auth.actor_user_id,
          v_auth.operator_session_id, null
        );
      end if;
    end if;

    update private.catalog_operator_work_states as work
       set status = v_new_status,
           version = work.version + 1,
           last_actor_user_id = v_auth.actor_user_id,
           updated_at = v_now
     where work.item_kind = 'correction_report'
       and work.item_id = p_item_id
       and work.version = p_expected_version
    returning work.version into v_new_version;
    if v_new_version is null then
      raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
    end if;

    v_event_id := private.catalog_operator_append_audit(
      'correction_workflow', null, v_correction.product_id,
      'correction_' || p_decision, p_reason_code,
      v_auth.actor_user_id, v_auth.operator_session_id, null,
      pg_catalog.jsonb_build_object(
        'decision', p_decision,
        'statusBefore', v_work.status,
        'statusAfter', v_new_status,
        'holdId', v_hold_id,
        'itemKind', 'correction_report'
      )
    );
  elsif p_item_kind in ('catalog_source', 'import_batch') then
    insert into private.catalog_operator_work_states (
      item_kind, item_id, version, status, last_actor_user_id, updated_at
    ) values (
      p_item_kind, p_item_id, 1, 'open', null, v_now
    ) on conflict (item_kind, item_id) do nothing;
    select work.* into v_work
    from private.catalog_operator_work_states as work
    where work.item_kind = p_item_kind and work.item_id = p_item_id
    for update;

    if p_item_kind = 'import_batch' and p_decision = 'recommend_promotion' then
      if not exists (
        select 1
        from public.catalog_import_batches as batch
        where batch.id = p_item_id
          and batch.status in ('verified', 'reviewed')
          and batch.artifact_kind = 'production'
          and batch.territory = 'US'
          and batch.qa_blocker_count = 0
          and batch.qa_warning_count = 0
          and batch.verification_evidence_sha256 ~ '^[a-f0-9]{64}$'
      ) then
        raise exception 'CATALOG_OPERATOR_PROMOTION_RECOMMENDATION_NOT_READY'
          using errcode = '55000';
      end if;
    elsif p_item_kind = 'import_batch'
      and p_decision = 'recommend_rollback'
      and not exists (
        select 1 from public.catalog_import_batches as batch
        where batch.id = p_item_id and batch.status = 'promoted'
      ) then
      raise exception 'CATALOG_OPERATOR_ROLLBACK_RECOMMENDATION_NOT_READY'
        using errcode = '55000';
    end if;

    v_new_status := case p_decision
      when 'acknowledge' then 'acknowledged'
      when 'request_changes' then 'changes_requested'
      when 'escalate' then 'escalated'
      when 'recommend_promotion' then 'promotion_recommended'
      when 'recommend_rollback' then 'rollback_recommended'
    end;
    update private.catalog_operator_work_states as work
       set status = v_new_status,
           version = work.version + 1,
           last_actor_user_id = v_auth.actor_user_id,
           updated_at = v_now
     where work.item_kind = p_item_kind
       and work.item_id = p_item_id
       and work.version = p_expected_version
    returning work.version into v_new_version;
    if v_new_version is null then
      raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
    end if;

    v_event_id := private.catalog_operator_append_audit(
      case p_item_kind
        when 'catalog_source' then 'catalog_source'
        else 'import_batch'
      end,
      p_item_id, null, p_decision, p_reason_code,
      v_auth.actor_user_id, v_auth.operator_session_id, null,
      pg_catalog.jsonb_build_object(
        'decision', p_decision,
        'statusBefore', v_work.status,
        'statusAfter', v_new_status,
        'recommendationOnly', true,
        'itemKind', p_item_kind
      )
    );
  else
    select hold.* into v_hold
    from private.catalog_operator_product_holds as hold
    where hold.id = p_item_id
    for update;
    if not found then
      raise exception 'CATALOG_OPERATOR_HOLD_NOT_FOUND' using errcode = '22023';
    end if;
    v_hold_lifecycle_actor_ids :=
      private.catalog_operator_hold_lifecycle_actor_ids(v_hold.id);
    if v_hold.state <> 'active'
       or v_hold.triaged_by_user_id is null
       or v_hold.disposition_by_user_id is null
       or v_hold_lifecycle_actor_ids = '{}'::uuid[]
       or v_auth.actor_user_id = any(v_hold_lifecycle_actor_ids) then
      raise exception 'CATALOG_OPERATOR_REPAIR_ATTESTATION_SEPARATION_REQUIRED'
        using errcode = '42501';
    end if;

    if private.catalog_operator_product_has_blocking_reports(v_hold.product_id) then
      raise exception 'CATALOG_OPERATOR_BLOCKING_REPORTS_REMAIN'
        using errcode = '55000';
    end if;

    -- Canonical proof-lock order: product row, then the global served-state
    -- mutation chain. This makes the proof and receipt current at commit.
    select product.* into v_product
    from public.products as product
    where product.id = v_hold.product_id
    for update;
    if not found then
      raise exception 'CATALOG_OPERATOR_PRODUCT_NOT_FOUND' using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
    );
    v_baseline_root_sha256 :=
      private.catalog_launch_current_served_state_mutation_root_sha256(
        v_hold.product_id
      );
    if v_baseline_root_sha256 =
         v_hold.baseline_served_state_mutation_root_sha256
       or (
         v_product.import_batch_id is not distinct from
           v_hold.baseline_import_batch_id
         and v_product.import_record_sha256 is not distinct from
           v_hold.baseline_product_record_sha256
       ) then
      raise exception 'CATALOG_OPERATOR_REPAIR_PROJECTION_UNCHANGED'
        using errcode = '55000';
    end if;

    select record.id as curation_record_id,
           record.campaign_id as curation_campaign_id,
           record.import_batch_id,
           record.product_record_sha256,
           record.curation_record_sha256,
           record.served_state_mutation_root_sha256,
           batch.verification_evidence_sha256,
           private.catalog_operator_named_auth_users(array[
             batch.reviewer_ids[1],
             batch.reviewer_ids[2],
             promotion.actor,
             campaign.reviewer_ids[1],
             campaign.reviewer_ids[2],
             campaign.created_by,
             record.regulatory_reviewer_ids[1],
             record.activation_operator_id,
             record.curated_by
           ]) as repair_authority_user_ids
      into v_record
    from private.catalog_launch_curation_records as record
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    join public.catalog_import_batches as batch
      on batch.id = record.import_batch_id
    join private.catalog_import_promotion_events as promotion
      on promotion.batch_id = batch.id
     and promotion.event_type = 'promotion'
    join public.products as product on product.id = record.product_id
    where record.product_id = v_hold.product_id
      and record.activation_decision = 'approve_activation'
      and campaign.review_valid_until > pg_catalog.now()
      and record.served_state_mutation_root_sha256 = v_baseline_root_sha256
      and private.catalog_launch_curation_record_is_structurally_valid(record.id)
      and product.import_projection_status = 'active'
      and product.import_batch_id = record.import_batch_id
      and product.import_staged_record_id = record.import_staged_record_id
      and product.import_record_sha256 = record.product_record_sha256
      and batch.status = 'promoted'
      and batch.artifact_kind = 'production'
      and batch.territory = 'US'
      and batch.qa_blocker_count = 0
      and batch.qa_warning_count = 0
      and batch.verification_evidence_sha256 ~ '^[a-f0-9]{64}$'
    order by record.sealed_at desc, record.id
    limit 1;
    if not found then
      raise exception 'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED'
        using errcode = '55000';
    end if;
    if v_record.repair_authority_user_ids is null then
      raise exception 'CATALOG_OPERATOR_NAMED_REPAIR_AUTHORITY_REQUIRED'
        using errcode = '55000';
    end if;
    if v_auth.actor_user_id = any(v_record.repair_authority_user_ids) then
      raise exception 'CATALOG_OPERATOR_REPAIR_ARTIFACT_AUTHOR_SEPARATION_REQUIRED'
        using errcode = '42501';
    end if;

    v_repair_receipt_id := gen_random_uuid();
    v_receipt_sha256 := private.catalog_operator_repair_receipt_sha256(
      v_hold.id, v_hold.version, v_hold.product_id,
      v_auth.actor_user_id, p_evidence_sha256,
      v_record.import_batch_id, v_record.product_record_sha256,
      v_record.verification_evidence_sha256,
      v_record.curation_record_id, v_record.curation_campaign_id,
      v_record.curation_record_sha256,
      v_record.served_state_mutation_root_sha256,
      v_hold.baseline_import_batch_id,
      v_hold.baseline_product_record_sha256,
      v_hold.baseline_served_state_mutation_root_sha256,
      v_record.repair_authority_user_ids,
      v_now, v_now + interval '30 minutes'
    );
    insert into private.catalog_operator_repair_authority_receipts (
      id, hold_id, hold_version, product_id, attested_by_user_id,
      operator_session_id, evidence_sha256, import_batch_id,
      product_record_sha256, cat02_verification_evidence_sha256,
      curation_record_id, curation_campaign_id, curation_record_sha256,
      served_state_mutation_root_sha256, baseline_import_batch_id,
      baseline_product_record_sha256,
      baseline_served_state_mutation_root_sha256,
      repair_authority_user_ids, attested_at, valid_until, receipt_sha256
    ) values (
      v_repair_receipt_id, v_hold.id, v_hold.version, v_hold.product_id,
      v_auth.actor_user_id, v_auth.operator_session_id, p_evidence_sha256,
      v_record.import_batch_id, v_record.product_record_sha256,
      v_record.verification_evidence_sha256,
      v_record.curation_record_id, v_record.curation_campaign_id,
      v_record.curation_record_sha256,
      v_record.served_state_mutation_root_sha256,
      v_hold.baseline_import_batch_id,
      v_hold.baseline_product_record_sha256,
      v_hold.baseline_served_state_mutation_root_sha256,
      v_record.repair_authority_user_ids,
      v_now, v_now + interval '30 minutes', v_receipt_sha256
    );

    update private.catalog_operator_product_holds as hold
       set state = 'repair_attested',
           repair_receipt_id = v_repair_receipt_id,
           repair_attested_at = v_now,
           version = hold.version + 1
     where hold.id = v_hold.id and hold.version = p_expected_version
    returning hold.version, hold.state into v_new_version, v_new_status;
    if v_new_version is null then
      raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
    end if;
    v_hold_id := v_hold.id;

    perform private.catalog_operator_append_hold_event(
      v_hold.id, 'repair_attested', v_hold.state, 'repair_attested',
      p_reason_code, v_auth.actor_user_id,
      v_auth.operator_session_id, v_repair_receipt_id
    );
    v_event_id := private.catalog_operator_append_audit(
      'repair_attestation', v_repair_receipt_id, v_hold.product_id,
      'repair_attested', p_reason_code,
      v_auth.actor_user_id, v_auth.operator_session_id,
      p_evidence_sha256,
      pg_catalog.jsonb_build_object(
        'decision', p_decision,
        'statusBefore', v_hold.state,
        'statusAfter', 'repair_attested',
        'holdId', v_hold.id,
        'repairReceiptId', v_repair_receipt_id,
        'itemKind', 'product_hold'
      )
    );
  end if;

  delete from private.catalog_operator_claims where id = p_lease_id;

  v_response := pg_catalog.jsonb_build_object(
    'itemVersion', v_new_version,
    'status', v_new_status,
    'holdId', v_hold_id,
    'repairReceiptId', v_repair_receipt_id,
    'eventId', v_event_id
  );
  insert into private.catalog_operator_operation_receipts (
    operation_id, operator_user_id, rpc_name, request_sha256, response
  ) values (
    p_operation_id, v_auth.actor_user_id,
    'catalog_operator_transition', v_request_sha256, v_response
  );

  return query select p_item_kind, p_item_id, v_new_version,
    v_new_status, v_hold_id, v_repair_receipt_id, v_event_id;
end;
$$;

comment on function catalog_operator_gateway.catalog_operator_transition(
  uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text
) is
  'Capability-separated, lease/CAS-bound correction and source-review transition. Source/import outcomes are recommendations; CAT-02/CAT-03 owner authority is not delegated.';

revoke all on function catalog_operator_gateway.catalog_operator_transition(
  uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text
) from public, anon, authenticated, service_role, catalog_operator_edge;

create or replace function catalog_operator_gateway.catalog_operator_release_hold(
  p_auth_session_id uuid,
  p_edge_environment text,
  p_source_revision text,
  p_edge_deployment_id text,
  p_control_generation bigint,
  p_operation_id uuid,
  p_hold_id uuid,
  p_lease_id uuid,
  p_expected_version bigint,
  p_repair_receipt_id uuid,
  p_reason_code text
)
returns table (
  hold_id uuid,
  item_version bigint,
  state text,
  released_at timestamptz,
  event_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_auth record;
  v_claim private.catalog_operator_claims%rowtype;
  v_hold private.catalog_operator_product_holds%rowtype;
  v_released private.catalog_operator_product_holds%rowtype;
  v_receipt private.catalog_operator_repair_authority_receipts%rowtype;
  v_product public.products%rowtype;
  v_hold_product_id uuid;
  v_current_root_sha256 text;
  v_hold_lifecycle_actor_ids uuid[];
  v_request_sha256 text;
  v_existing private.catalog_operator_operation_receipts%rowtype;
  v_before_hold jsonb;
  v_after_hold jsonb;
  v_event_id uuid;
  v_response jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_operation_id is null
     or p_operation_id::text !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_hold_id is null or p_lease_id is null
     or p_expected_version is null or p_expected_version < 1
     or p_repair_receipt_id is null
     or p_reason_code <> 'repair_verified_current' then
    raise exception 'CATALOG_OPERATOR_RELEASE_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into v_auth
  from private.assert_catalog_operator(
    'catalog_hold_release',
    p_auth_session_id,
    p_edge_environment,
    p_source_revision,
    p_edge_deployment_id,
    p_control_generation
  );

  perform private.consume_catalog_operator_rate_budget(
    v_auth.actor_user_id,
    'release',
    false
  );

  v_request_sha256 := private.catalog_operator_request_sha256(
    'catalog_operator_release_hold',
    pg_catalog.jsonb_build_object(
      'operationId', p_operation_id,
      'holdId', p_hold_id,
      'leaseId', p_lease_id,
      'expectedVersion', p_expected_version,
      'repairReceiptId', p_repair_receipt_id,
      'reasonCode', p_reason_code
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-operation:' || p_operation_id::text, 0
    )
  );
  select receipt.* into v_existing
  from private.catalog_operator_operation_receipts as receipt
  where receipt.operation_id = p_operation_id;
  if found then
    if v_existing.operator_user_id <> v_auth.actor_user_id
       or v_existing.rpc_name <> 'catalog_operator_release_hold'
       or v_existing.request_sha256 <> v_request_sha256 then
      raise exception 'CATALOG_OPERATOR_OPERATION_CONFLICT' using errcode = '55000';
    end if;
    return query select
      p_hold_id,
      (v_existing.response ->> 'itemVersion')::bigint,
      v_existing.response ->> 'state',
      (v_existing.response ->> 'releasedAt')::timestamptz,
      (v_existing.response ->> 'eventId')::uuid;
    return;
  end if;

  select hold.product_id into v_hold_product_id
  from private.catalog_operator_product_holds as hold
  where hold.id = p_hold_id;
  if not found then
    raise exception 'CATALOG_OPERATOR_HOLD_NOT_FOUND' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-product-hold:' || v_hold_product_id::text, 0
    )
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-item:product_hold:' || p_hold_id::text, 0
    )
  );
  select claim.* into v_claim
  from private.catalog_operator_claims as claim
  where claim.id = p_lease_id
    and claim.item_kind = 'product_hold'
    and claim.item_id = p_hold_id
    and claim.item_version = p_expected_version
    and claim.operator_user_id = v_auth.actor_user_id
    and claim.operator_session_id = v_auth.operator_session_id
    and claim.expires_at > pg_catalog.now()
  for update;
  if not found then
    raise exception 'CATALOG_OPERATOR_LEASE_INVALID' using errcode = '55P03';
  end if;

  select hold.* into v_hold
  from private.catalog_operator_product_holds as hold
  where hold.id = p_hold_id
  for update;
  if not found then
    raise exception 'CATALOG_OPERATOR_HOLD_NOT_FOUND' using errcode = '22023';
  end if;
  if v_hold.version <> p_expected_version then
    raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
  end if;

  if private.catalog_operator_product_has_blocking_reports(v_hold.product_id) then
    raise exception 'CATALOG_OPERATOR_BLOCKING_REPORTS_REMAIN'
      using errcode = '55000';
  end if;

  select product.* into v_product
  from public.products as product
  where product.id = v_hold.product_id
  for update;
  if not found then
    raise exception 'CATALOG_OPERATOR_PRODUCT_NOT_FOUND' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-launch-curation-global', 0)
  );
  v_current_root_sha256 :=
    private.catalog_launch_current_served_state_mutation_root_sha256(
      v_hold.product_id
    );

  select receipt.* into v_receipt
  from private.catalog_operator_repair_authority_receipts as receipt
  where receipt.id = p_repair_receipt_id
    and receipt.hold_id = p_hold_id
    and receipt.product_id = v_hold.product_id;
  if not found
     or v_hold.state <> 'repair_attested'
     or v_hold.repair_receipt_id <> p_repair_receipt_id
     or v_receipt.hold_version <> v_hold.version - 1
     or v_receipt.valid_until <= pg_catalog.now()
     or v_receipt.receipt_sha256 <>
       private.catalog_operator_repair_receipt_sha256(
         v_receipt.hold_id, v_receipt.hold_version,
         v_receipt.product_id, v_receipt.attested_by_user_id,
         v_receipt.evidence_sha256, v_receipt.import_batch_id,
         v_receipt.product_record_sha256,
         v_receipt.cat02_verification_evidence_sha256,
         v_receipt.curation_record_id, v_receipt.curation_campaign_id,
         v_receipt.curation_record_sha256,
         v_receipt.served_state_mutation_root_sha256,
         v_receipt.baseline_import_batch_id,
         v_receipt.baseline_product_record_sha256,
         v_receipt.baseline_served_state_mutation_root_sha256,
         v_receipt.repair_authority_user_ids,
         v_receipt.attested_at, v_receipt.valid_until
       ) then
    raise exception 'CATALOG_OPERATOR_REPAIR_RECEIPT_STALE' using errcode = '55000';
  end if;

  v_hold_lifecycle_actor_ids :=
    private.catalog_operator_hold_lifecycle_actor_ids(v_hold.id);
  if v_hold.triaged_by_user_id is null
     or v_hold.disposition_by_user_id is null
     or v_hold_lifecycle_actor_ids = '{}'::uuid[]
     or v_auth.actor_user_id = any(v_hold_lifecycle_actor_ids)
     or v_auth.actor_user_id = v_receipt.attested_by_user_id
     or v_auth.actor_user_id = any(v_receipt.repair_authority_user_ids) then
    raise exception 'CATALOG_OPERATOR_THIRD_PERSON_RELEASE_REQUIRED'
      using errcode = '42501';
  end if;

  if v_receipt.baseline_import_batch_id is distinct from
       v_hold.baseline_import_batch_id
     or v_receipt.baseline_product_record_sha256 is distinct from
       v_hold.baseline_product_record_sha256
     or v_receipt.baseline_served_state_mutation_root_sha256 <>
       v_hold.baseline_served_state_mutation_root_sha256
     or v_current_root_sha256 =
       v_receipt.baseline_served_state_mutation_root_sha256
     or (
       v_product.import_batch_id is not distinct from
         v_receipt.baseline_import_batch_id
       and v_product.import_record_sha256 is not distinct from
         v_receipt.baseline_product_record_sha256
     )
     or exists (
       select 1
       from pg_catalog.unnest(v_receipt.repair_authority_user_ids)
         as authority(identity_id)
       where not exists (
         select 1
         from auth.users as authority_user
         where authority_user.id = authority.identity_id
       )
     ) then
    raise exception 'CATALOG_OPERATOR_REPAIR_RECEIPT_STALE' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.products as product
    join public.catalog_import_batches as batch
      on batch.id = product.import_batch_id
    join private.catalog_launch_curation_records as record
      on record.id = v_receipt.curation_record_id
     and record.product_id = product.id
     and record.campaign_id = v_receipt.curation_campaign_id
    join private.catalog_launch_curation_campaigns as campaign
      on campaign.id = record.campaign_id
    where product.id = v_hold.product_id
      and product.import_projection_status = 'active'
      and product.import_batch_id = v_receipt.import_batch_id
      and product.import_record_sha256 = v_receipt.product_record_sha256
      and batch.status = 'promoted'
      and batch.artifact_kind = 'production'
      and batch.territory = 'US'
      and batch.qa_blocker_count = 0
      and batch.qa_warning_count = 0
      and batch.verification_evidence_sha256 =
        v_receipt.cat02_verification_evidence_sha256
      and record.curation_record_sha256 = v_receipt.curation_record_sha256
      and record.served_state_mutation_root_sha256 =
        v_receipt.served_state_mutation_root_sha256
      and record.served_state_mutation_root_sha256 = v_current_root_sha256
      and campaign.review_valid_until > pg_catalog.now()
      and private.catalog_launch_curation_record_is_structurally_valid(record.id)
  ) then
    raise exception 'CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED'
      using errcode = '55000';
  end if;

  v_before_hold := pg_catalog.jsonb_build_object(
    'id', v_hold.id, 'productId', v_hold.product_id,
    'reasonCode', v_hold.reason_code, 'state', v_hold.state,
    'version', v_hold.version
  );
  update private.catalog_operator_product_holds as hold
     set state = 'released',
         released_by_user_id = v_auth.actor_user_id,
         released_at = v_now,
         version = hold.version + 1
   where hold.id = p_hold_id and hold.version = p_expected_version
  returning hold.* into v_released;
  if not found then
    raise exception 'CATALOG_OPERATOR_VERSION_CONFLICT' using errcode = '40001';
  end if;

  v_after_hold := pg_catalog.jsonb_build_object(
    'id', v_released.id, 'productId', v_released.product_id,
    'reasonCode', v_released.reason_code, 'state', v_released.state,
    'version', v_released.version
  );
  perform private.catalog_operator_append_hold_event(
    v_released.id, 'hold_released', 'repair_attested', 'released',
    p_reason_code, v_auth.actor_user_id,
    v_auth.operator_session_id, p_repair_receipt_id
  );
  perform private.catalog_operator_append_hold_mutation(
    v_released.product_id, v_released.id,
    'UPDATE', v_before_hold, v_after_hold
  );
  perform public.refresh_product_correction_count(v_released.product_id);

  v_event_id := private.catalog_operator_append_audit(
    'product_hold', v_released.id, v_released.product_id,
    'hold_released', p_reason_code,
    v_auth.actor_user_id, v_auth.operator_session_id,
    v_receipt.evidence_sha256,
    pg_catalog.jsonb_build_object(
      'decision', 'release_hold',
      'statusBefore', 'repair_attested',
      'statusAfter', 'released',
      'holdId', v_released.id,
      'repairReceiptId', p_repair_receipt_id,
      'itemKind', 'product_hold'
    )
  );

  delete from private.catalog_operator_claims where id = p_lease_id;
  v_response := pg_catalog.jsonb_build_object(
    'itemVersion', v_released.version,
    'state', v_released.state,
    'releasedAt', v_released.released_at,
    'eventId', v_event_id
  );
  insert into private.catalog_operator_operation_receipts (
    operation_id, operator_user_id, rpc_name, request_sha256, response
  ) values (
    p_operation_id, v_auth.actor_user_id,
    'catalog_operator_release_hold', v_request_sha256, v_response
  );

  return query select v_released.id, v_released.version,
    v_released.state, v_released.released_at, v_event_id;
end;
$$;

comment on function catalog_operator_gateway.catalog_operator_release_hold(
  uuid, text, text, text, bigint, uuid, uuid, uuid, bigint, uuid, text
) is
  'Fourth-person release consuming a current immutable CAT-02/CAT-03 repair receipt; release advances served-state authority and never reactivates a campaign.';

revoke all on function catalog_operator_gateway.catalog_operator_release_hold(
  uuid, text, text, text, bigint, uuid, uuid, uuid, bigint, uuid, text
) from public, anon, authenticated, service_role, catalog_operator_edge;

-- Preserve any pre-0063 operator-confirmed hold without retaining the report
-- UUID, reporter UUID, description, payload, barcode, or client context. These
-- legacy rows remain fail-closed and cannot use the new release RPC until named
-- CAT-08 operators re-establish the required triage/accept separation.
insert into private.catalog_operator_product_holds (
  product_id, reason_code, state, version,
  triaged_by_user_id, legacy_origin_sha256,
  baseline_import_batch_id, baseline_product_record_sha256,
  baseline_served_state_mutation_root_sha256, opened_at
)
select distinct on (correction.product_id)
  correction.product_id,
  case correction.correction_type
    when 'wrong_match' then 'wrong_match_confirmed'
    when 'ingredient_issue' then 'ingredient_risk_confirmed'
    when 'source_issue' then 'source_defect_confirmed'
    when 'expiry_issue' then 'expiry_defect_confirmed'
    when 'category_issue' then 'category_defect_confirmed'
    when 'duplicate' then 'duplicate_confirmed'
  end,
  'active',
  1,
  null,
  private.catalog_operator_sha256(
    pg_catalog.jsonb_build_object(
      'contractId', 'catalog-operator-legacy-hold-origin-v1',
      'productId', correction.product_id,
      'correctionType', correction.correction_type,
      'reviewedAt', correction.operator_reviewed_at,
      'reviewerAliasSha256', private.catalog_operator_sha256(
        pg_catalog.to_jsonb(correction.operator_reviewed_by)
      )
    )
  ),
  product.import_batch_id,
  product.import_record_sha256,
  private.catalog_launch_current_served_state_mutation_root_sha256(
    product.id
  ),
  correction.operator_reviewed_at
from public.catalog_corrections as correction
join public.products as product on product.id = correction.product_id
where correction.product_id is not null
  and correction.correction_type in (
    'wrong_match', 'ingredient_issue', 'source_issue',
    'expiry_issue', 'category_issue', 'duplicate'
  )
  and correction.status in ('triaged', 'accepted')
  and correction.operator_reviewed_at is not null
  and correction.operator_reviewed_at <= pg_catalog.now()
  and nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null
  and nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null
order by correction.product_id, correction.operator_reviewed_at, correction.id
on conflict do nothing;

-- CAT-03 snapshots now seal only reporter-free independent hold authority.
-- The old implementation is retained by OID/name for auditability, while the
-- current wrapper overwrites both legacy correction-derived keys.
alter function private.catalog_launch_curation_dependency_snapshot(uuid, uuid)
  rename to catalog_launch_curation_dependency_snapshot_v0058;

revoke all on function
  private.catalog_launch_curation_dependency_snapshot_v0058(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.catalog_launch_curation_dependency_snapshot(
  p_product_id uuid,
  p_ingredient_list_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
  select pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(
        private.catalog_launch_curation_dependency_snapshot_v0058(
          p_product_id, p_ingredient_list_id
        ),
        '{contractId}',
        '"catalog-launch-curation-dependency-snapshot-v3"'::jsonb,
        true
      ),
      '{operatorHoldRows}',
      coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'holdId', hold.id,
            'productId', hold.product_id,
            'reasonCode', hold.reason_code,
            -- active and repair_attested are the same fail-closed serving
            -- condition. Workflow-only state/version changes must not
            -- invalidate the successor CAT-03 record that release rechecks.
            'servingBlocked', true
          ) order by hold.id
        )
        from private.catalog_operator_product_holds as hold
        where hold.product_id = p_product_id
          and hold.state in ('active', 'repair_attested')
      ), '[]'::jsonb),
      true
    ),
    '{operatorHoldCount}',
    pg_catalog.to_jsonb((
      select count(*)
      from private.catalog_operator_product_holds as hold
      where hold.product_id = p_product_id
        and hold.state in ('active', 'repair_attested')
    )),
    true
  )
$$;

revoke all on function
  private.catalog_launch_curation_dependency_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;

-- The denormalized projection remains a fast negative cache, but its source of
-- truth is now the independent product hold. A deleted reporter row cannot
-- decrement it while an active hold remains.
create or replace function public.refresh_product_correction_count(p_product_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hold_count integer;
begin
  if p_product_id is null then return; end if;
  select count(*)::integer into v_hold_count
  from private.catalog_operator_product_holds as hold
  where hold.product_id = p_product_id
    and hold.state in ('active', 'repair_attested');

  update public.products as product
     set unresolved_correction_count = v_hold_count,
         recommendation_eligible =
           product.quality_grade in ('verified', 'usable')
           and product.review_status = 'reviewed'
           and product.status = 'active'
           and v_hold_count = 0
   where product.id = p_product_id;
end;
$$;

revoke all on function public.refresh_product_correction_count(uuid)
  from public, anon, authenticated, service_role;

update public.products as product
   set unresolved_correction_count = hold_counts.hold_count,
       recommendation_eligible =
         product.quality_grade in ('verified', 'usable')
         and product.review_status = 'reviewed'
         and product.status = 'active'
         and hold_counts.hold_count = 0
from (
  select product_row.id,
         count(hold.id) filter (
           where hold.state in ('active', 'repair_attested')
         )::integer as hold_count
  from public.products as product_row
  left join private.catalog_operator_product_holds as hold
    on hold.product_id = product_row.id
  group by product_row.id
) as hold_counts
where hold_counts.id = product.id;

create or replace function private.catalog_product_is_servable(
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products as product
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
      and product.source_snapshot_date <=
        (pg_catalog.now() at time zone 'UTC')::date
      and private.catalog_source_is_production_approved(product.source_id)
      and private.catalog_launch_curation_head_is_active(product.id)
      and not exists (
        select 1
        from private.catalog_operator_product_holds as hold
        where hold.product_id = product.id
          and hold.state in ('active', 'repair_attested')
      )
  )
$$;

revoke all on function private.catalog_product_is_servable(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.catalog_product_is_servable(uuid)
  to authenticated;

-- Raw correction rows are no longer serving authority, so their erasure must
-- not append a CAT-03 served-state mutation. The independent hold insert and
-- release paths append their own reporter-free mutation projections instead.
drop trigger if exists catalog_launch_mutation_operator_corrections
  on public.catalog_corrections;

create or replace function private.serialize_catalog_correction_product()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_first uuid;
  v_second uuid;
begin
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    if old.product_id is null then
      v_first := new.product_id;
    elsif new.product_id is null then
      v_first := old.product_id;
    elsif old.product_id::text < new.product_id::text then
      v_first := old.product_id;
      v_second := new.product_id;
    else
      v_first := new.product_id;
      v_second := old.product_id;
    end if;
  else
    v_first := new.product_id;
  end if;

  if v_first is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'catalog-operator-product-hold:' || v_first::text, 0
      )
    );
  end if;
  if v_second is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'catalog-operator-product-hold:' || v_second::text, 0
      )
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.serialize_catalog_correction_product()
  from public, anon, authenticated, service_role;

create trigger catalog_operator_correction_product_serialization
  before insert or update of product_id on public.catalog_corrections
  for each row execute function private.serialize_catalog_correction_product();

create or replace function private.cleanup_catalog_operator_correction_work()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'catalog-operator-product-hold:' || old.product_id::text, 0
    )
  ) where old.product_id is not null;
  delete from private.catalog_operator_claims as claim
  where claim.item_kind = 'correction_report'
    and claim.item_id = old.id;
  delete from private.catalog_operator_work_states as work
  where work.item_kind = 'correction_report'
    and work.item_id = old.id;
  return old;
end;
$$;

revoke all on function private.cleanup_catalog_operator_correction_work()
  from public, anon, authenticated, service_role;

create trigger catalog_operator_correction_work_cleanup
  before delete on public.catalog_corrections
  for each row execute function
    private.cleanup_catalog_operator_correction_work();

create index catalog_corrections_owner_export_keyset_idx
  on public.catalog_corrections (user_id, created_at, id);

create or replace function public.export_catalog_corrections_for_subject(
  p_user_id uuid,
  p_after_created_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (
  export_total_count bigint,
  id uuid,
  user_id uuid,
  product_id uuid,
  barcode text,
  correction_type text,
  status text,
  description text,
  proposed_payload jsonb,
  client_context jsonb,
  source_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_caller_user_id uuid := auth.uid();
begin
  if p_user_id is null
     or p_limit is null or p_limit not between 1 and 500
     or ((p_after_created_at is null) <> (p_after_id is null))
     or (p_after_created_at is not null
       and not pg_catalog.isfinite(p_after_created_at)) then
    raise exception 'CATALOG_CORRECTION_EXPORT_INPUT_INVALID'
      using errcode = '22023';
  end if;
  if v_caller_user_id is null
     or v_caller_user_id <> p_user_id
     or auth.jwt() ->> 'role' <> 'authenticated'
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not public.account_access_allowed() then
    raise exception 'CATALOG_CORRECTION_EXPORT_OWNER_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  with owned_rows as (
    select count(*) over () as total_count,
           correction.id,
           correction.user_id,
           correction.product_id,
           correction.barcode,
           correction.correction_type,
           coalesce(work.status, correction.status) as effective_status,
           correction.description,
           correction.proposed_payload,
           correction.client_context,
           correction.source_id,
           correction.created_at,
           greatest(correction.updated_at, work.updated_at) as updated_at
    from public.catalog_corrections as correction
    left join private.catalog_operator_work_states as work
      on work.item_kind = 'correction_report'
     and work.item_id = correction.id
    where correction.user_id = p_user_id
  )
  select owned.total_count,
         owned.id,
         owned.user_id,
         owned.product_id,
         owned.barcode,
         owned.correction_type,
         owned.effective_status,
         owned.description,
         owned.proposed_payload,
         owned.client_context,
         owned.source_id,
         owned.created_at,
         owned.updated_at
  from owned_rows as owned
  where p_after_created_at is null
     or (owned.created_at, owned.id) > (p_after_created_at, p_after_id)
  order by owned.created_at, owned.id
  limit p_limit;
end;
$$;

comment on function public.export_catalog_corrections_for_subject(
  uuid, timestamptz, uuid, integer
) is
  'Authenticated-subject-bound, count-guarded keyset export of reporter-facing correction fields with authoritative operator workflow status.';

revoke all on function public.export_catalog_corrections_for_subject(
  uuid, timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function public.export_catalog_corrections_for_subject(
  uuid, timestamptz, uuid, integer
) to authenticated;

-- The old shared credential can still submit bounded intake but can no longer
-- read reports or turn them into holds. Data export and withdrawal use their
-- own SECURITY DEFINER owner-filtered functions and do not require this grant.
revoke select on table public.catalog_corrections from service_role;
revoke execute on function public.review_catalog_correction(
  uuid, bigint, text, text, text
) from public, anon, authenticated, service_role;

alter table public.catalog_corrections enable row level security;
alter table public.catalog_corrections force row level security;
revoke insert, update, delete on table public.catalog_corrections
  from public, anon, authenticated, service_role;

comment on table private.catalog_operator_product_holds is
  'Reporter-free global product holds. They survive report deletion and are serving authority until an exact CAT-02/CAT-03 repair receipt is consumed by a distinct release operator.';
comment on table private.catalog_operator_repair_authority_receipts is
  'Immutable short-lived binding of a hold to current promoted CAT-02 projection evidence and a current structurally valid CAT-03 successor record.';
comment on table private.catalog_operator_audit_events is
  'Immutable operator audit chain. Correction events deliberately omit report IDs and reporter identities so reporter erasure leaves no audit link.';

-- Remove every legacy Data API overload. The browser bearer can reach the
-- Edge Function only; it can never use PostgREST to invoke operator authority.
drop function if exists public.catalog_operator_session();
drop function if exists public.catalog_operator_session(uuid);
drop function if exists public.catalog_operator_queue(
  text, timestamptz, uuid, integer
);
drop function if exists public.catalog_operator_queue(
  uuid, text, timestamptz, uuid, integer
);
drop function if exists public.catalog_operator_detail(text, uuid, uuid, bigint);
drop function if exists public.catalog_operator_detail(
  uuid, text, uuid, uuid, bigint
);
drop function if exists public.catalog_operator_claim(uuid, text, uuid, bigint);
drop function if exists public.catalog_operator_claim(
  uuid, uuid, text, uuid, bigint
);
drop function if exists public.catalog_operator_transition(
  uuid, text, uuid, uuid, bigint, text, text, text
);
drop function if exists public.catalog_operator_transition(
  uuid, uuid, text, uuid, uuid, bigint, text, text, text
);
drop function if exists public.catalog_operator_release_hold(
  uuid, uuid, uuid, bigint, uuid, text
);
drop function if exists public.catalog_operator_release_hold(
  uuid, uuid, uuid, uuid, bigint, uuid, text
);

revoke all privileges on all tables in schema public
  from catalog_operator_edge;
revoke all privileges on all tables in schema private
  from catalog_operator_edge;
revoke all privileges on all sequences in schema public
  from catalog_operator_edge;
revoke all privileges on all sequences in schema private
  from catalog_operator_edge;
revoke all privileges on all functions in schema public
  from catalog_operator_edge;
revoke all privileges on all functions in schema private
  from catalog_operator_edge;
revoke all privileges on all functions in schema catalog_operator_gateway
  from catalog_operator_edge;

-- PostgreSQL grants function EXECUTE to PUBLIC by default. Remove that ambient
-- lane from every schema the dedicated login could qualify, and keep future
-- functions fail-closed. Existing explicit anon/authenticated/service grants
-- remain intact.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema private from public;
revoke execute on all functions in schema catalog_operator_gateway from public;
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema private
  revoke execute on functions from public;
alter default privileges in schema catalog_operator_gateway
  revoke execute on functions from public;

grant execute on function catalog_operator_gateway.catalog_operator_session(
  uuid, text, text, text, bigint, text
) to catalog_operator_edge;
grant execute on function catalog_operator_gateway.catalog_operator_queue(
  uuid, text, text, text, bigint, text, timestamptz, uuid, integer
) to catalog_operator_edge;
grant execute on function catalog_operator_gateway.catalog_operator_detail(
  uuid, text, text, text, bigint, text, uuid, uuid, bigint
) to catalog_operator_edge;
grant execute on function catalog_operator_gateway.catalog_operator_claim(
  uuid, text, text, text, bigint, uuid, text, uuid, bigint
) to catalog_operator_edge;
grant execute on function catalog_operator_gateway.catalog_operator_transition(
  uuid, text, text, text, bigint, uuid, text, uuid, uuid, bigint, text, text, text
) to catalog_operator_edge;
grant execute on function catalog_operator_gateway.catalog_operator_release_hold(
  uuid, text, text, text, bigint, uuid, uuid, uuid, bigint, uuid, text
) to catalog_operator_edge;

commit;
