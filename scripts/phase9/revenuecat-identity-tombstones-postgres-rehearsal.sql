\set ON_ERROR_STOP on

-- Disposable PostgreSQL 15/17 rehearsal for migration 0051. Run only in a
-- fresh throwaway database. The setup is the minimum effective 0041/0048/0049
-- contract; the real 0041, 0049, and 0051 migrations are applied unchanged.

create extension pgcrypto with schema public;
create extension dblink with schema public;

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit;

create schema auth;
create table auth.users (id uuid primary key);

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement text,
  is_active boolean not null default false,
  product_id text,
  expires_at timestamptz,
  rc_event_id text,
  updated_at timestamptz not null default now(),
  store text,
  period_type text,
  will_renew boolean,
  original_purchase_at timestamptz,
  offering_id text,
  experiment_id text,
  acquisition_channel text,
  source text,
  environment text,
  management_url text,
  verified_at timestamptz,
  package_id text,
  store_user_id text,
  last_reconciled_at timestamptz,
  raw_status jsonb not null default '{}'::jsonb
);

create table public.subscriptions_events (
  id uuid primary key default gen_random_uuid(),
  rc_event_id text unique,
  user_id uuid,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  app_user_id text,
  original_app_user_id text,
  aliases text[],
  resolved_user_id uuid,
  environment text,
  store text,
  product_id text,
  processed_at timestamptz,
  processing_status text,
  error text,
  signature_verified boolean,
  auth_verified boolean
);

\ir ../../supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql

create table public.account_deletion_operations (
  id uuid primary key,
  user_id uuid not null unique,
  state text not null,
  expires_at timestamptz not null
);

create table public.account_deletion_barriers (
  user_id uuid primary key,
  operation_id uuid not null unique,
  expires_at timestamptz not null
);

create table public.account_deletion_steps (
  operation_id uuid not null,
  step_name text not null,
  status text not null,
  lease_kind text,
  claim_digest text,
  lease_expires_at timestamptz,
  request_started_at timestamptz,
  primary key (operation_id, step_name)
);

alter table public.account_deletion_operations enable row level security;
alter table public.account_deletion_operations force row level security;
alter table public.account_deletion_barriers enable row level security;
alter table public.account_deletion_barriers force row level security;
alter table public.account_deletion_steps enable row level security;
alter table public.account_deletion_steps force row level security;
revoke all on table public.account_deletion_operations
  from public, anon, authenticated, service_role;
revoke all on table public.account_deletion_barriers
  from public, anon, authenticated, service_role;
revoke all on table public.account_deletion_steps
  from public, anon, authenticated, service_role;

create function public._account_deletion_advisory_key(p_user_id uuid)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.hashtextextended(
    'onskin-account-write:' || p_user_id::text,
    486926381092731::bigint
  );
$$;

create function public._account_deletion_claim_digest(p_claim_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    public.digest(
      pg_catalog.convert_to(
        'onskin/account-deletion-claim/v1:' || p_claim_token,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public._account_deletion_advisory_key(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public._account_deletion_claim_digest(text)
  from public, anon, authenticated, service_role;

\ir ../../supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql
\ir ../../supabase/migrations/20260713000051_revenuecat_identity_tombstones.sql

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');

insert into public.account_deletion_operations (id, user_id, state, expires_at)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'running',
  clock_timestamp() + interval '20 days'
);

insert into public.account_deletion_barriers (user_id, operation_id, expires_at)
values (
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '20 days'
);

insert into public.account_deletion_steps (
  operation_id,
  step_name,
  status,
  lease_kind,
  claim_digest,
  lease_expires_at,
  request_started_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'revenuecat_delete',
  'leased',
  'dispatch',
  public._account_deletion_claim_digest(repeat('1', 64)),
  clock_timestamp() + interval '10 minutes',
  null
);

insert into public.account_deletion_operations (id, user_id, state, expires_at)
values (
  '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000003',
  'running',
  clock_timestamp() - interval '20 days'
);

insert into public.account_deletion_barriers (user_id, operation_id, expires_at)
values (
  '00000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  clock_timestamp() - interval '20 days'
);

insert into public.account_deletion_steps (
  operation_id,
  step_name,
  status,
  lease_kind,
  claim_digest,
  lease_expires_at,
  request_started_at
)
values (
  '10000000-0000-4000-8000-000000000003',
  'revenuecat_delete',
  'leased',
  'dispatch',
  public._account_deletion_claim_digest(repeat('3', 64)),
  clock_timestamp() + interval '10 minutes',
  null
);

insert into public.subscriptions_events (
  rc_event_id,
  user_id,
  resolved_user_id,
  event_type,
  payload,
  app_user_id,
  aliases,
  transferred_from,
  transferred_to,
  provider_event_at,
  processing_status
)
values
  (
    'historical-opaque-a',
    null,
    null,
    'RENEWAL',
    '{"event":{"type":"RENEWAL"}}',
    'opaque-deleted-a',
    array['opaque-deleted-a'],
    null,
    null,
    clock_timestamp(),
    'unresolved_user'
  ),
  (
    'historical-prefixed-a',
    null,
    null,
    'RENEWAL',
    '{"event":{"type":"RENEWAL"}}',
    '$RCAnonymousID:00000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    clock_timestamp(),
    'unresolved_user'
  ),
  (
    'historical-transfer-a-b',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'TRANSFER',
    '{"event":{"type":"TRANSFER"}}',
    'opaque-deleted-a',
    array['opaque-deleted-a', '00000000-0000-4000-8000-000000000002'],
    array['opaque-deleted-a'],
    array['00000000-0000-4000-8000-000000000002'],
    clock_timestamp(),
    'ignored_event_type'
  ),
  (
    'historical-live-exact-b',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'RENEWAL',
    '{"event":{"type":"RENEWAL"}}',
    '00000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    clock_timestamp(),
    'processed'
  ),
  (
    'historical-live-prefixed-b',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'RENEWAL',
    '{"event":{"type":"RENEWAL"}}',
    '$RCAnonymousID:00000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    clock_timestamp(),
    'processed'
  );

insert into public.entitlements (
  user_id,
  entitlement,
  is_active,
  store_user_id,
  raw_status
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'pro',
    true,
    'opaque-deleted-a',
    '{"legacy":"opaque-deleted-a"}'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'pro',
    true,
    'opaque-deleted-a',
    '{"legacy":"opaque-deleted-a"}'
  );

-- The live dispatch claim is mandatory and input is strictly bounded.
set role service_role;

do $$
begin
  perform public.establish_revenuecat_deletion_identity_barrier(
    '10000000-0000-4000-8000-000000000001',
    repeat('2', 64),
    1::smallint,
    array[repeat('a', 64)],
    array['00000000-0000-4000-8000-000000000001'],
    clock_timestamp() + interval '400 days'
  );
  raise exception 'REHEARSAL_REVENUECAT_IDENTITY_WRONG_CLAIM_ALLOWED';
exception
  when serialization_failure then
    if sqlerrm <> 'REVENUECAT_IDENTITY_BARRIER_CAS_FAILED' then raise; end if;
end;
$$;

do $$
begin
  perform public.establish_revenuecat_deletion_identity_barrier(
    '10000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    1::smallint,
    array(select pg_catalog.lpad(pg_catalog.to_hex(value), 64, '0')
            from generate_series(1, 67) as value),
    array(select 'bounded-' || value::text from generate_series(1, 67) as value),
    clock_timestamp() + interval '400 days'
  );
  raise exception 'REHEARSAL_REVENUECAT_IDENTITY_UNBOUNDED_FAMILY_ALLOWED';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'REVENUECAT_IDENTITY_BARRIER_INPUT_INVALID' then raise; end if;
end;
$$;

-- A v2 family that crosses into a different live Auth account fails closed.
-- Neither an exact live UUID nor a provider-prefixed live UUID may be retained
-- as a tombstone or used to scrub the other account's subscription audit row.
do $$
begin
  perform public.establish_revenuecat_deletion_identity_barrier(
    '10000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    1::smallint,
    array[repeat('d', 64)],
    array['00000000-0000-4000-8000-000000000002'],
    clock_timestamp() + interval '400 days'
  );
  raise exception 'REHEARSAL_REVENUECAT_LIVE_EXACT_ALIAS_ALLOWED';
exception
  when check_violation then
    if sqlerrm <> 'REVENUECAT_IDENTITY_BARRIER_SHARED_LIVE_ACCOUNT' then raise; end if;
end;
$$;

do $$
begin
  perform public.establish_revenuecat_deletion_identity_barrier(
    '10000000-0000-4000-8000-000000000001',
    repeat('1', 64),
    1::smallint,
    array[repeat('e', 64)],
    array['$RCAnonymousID:00000000-0000-4000-8000-000000000002'],
    clock_timestamp() + interval '400 days'
  );
  raise exception 'REHEARSAL_REVENUECAT_LIVE_PREFIXED_ALIAS_ALLOWED';
exception
  when check_violation then
    if sqlerrm <> 'REVENUECAT_IDENTITY_BARRIER_SHARED_LIVE_ACCOUNT' then raise; end if;
end;
$$;

reset role;

do $$
begin
  if exists (select 1 from public.revenuecat_identity_tombstones)
     or not exists (
       select 1
         from public.subscriptions_events
        where rc_event_id = 'historical-live-exact-b'
          and user_id = '00000000-0000-4000-8000-000000000002'::uuid
          and resolved_user_id = '00000000-0000-4000-8000-000000000002'::uuid
          and app_user_id = '00000000-0000-4000-8000-000000000002'
     )
     or not exists (
       select 1
         from public.subscriptions_events
        where rc_event_id = 'historical-live-prefixed-b'
          and user_id = '00000000-0000-4000-8000-000000000002'::uuid
          and resolved_user_id = '00000000-0000-4000-8000-000000000002'::uuid
          and app_user_id = '$RCAnonymousID:00000000-0000-4000-8000-000000000002'
     ) then
    raise exception 'REHEARSAL_REVENUECAT_SHARED_LIVE_ALIAS_MUTATED';
  end if;
end;
$$;

set role service_role;

do $$
declare
  v_result record;
begin
  select result.*
    into strict v_result
    from public.establish_revenuecat_deletion_identity_barrier(
      '10000000-0000-4000-8000-000000000001',
      repeat('1', 64),
      1::smallint,
      array[repeat('a', 64), repeat('b', 64), repeat('c', 64)],
      array[
        '00000000-0000-4000-8000-000000000001',
        '$RCAnonymousID:00000000-0000-4000-8000-000000000001',
        'opaque-deleted-a'
      ],
      clock_timestamp() + interval '400 days'
    ) as result;
  if v_result.established is distinct from true
     or v_result.tombstone_version <> 1
     or v_result.identity_count <> 3 then
    raise exception 'REHEARSAL_REVENUECAT_IDENTITY_BARRIER_RESULT_FAILED';
  end if;
end;
$$;

reset role;

do $$
declare
  v_shared public.subscriptions_events%rowtype;
begin
  if (select count(*) from public.revenuecat_identity_tombstones) <> 3
     or exists (
       select 1
         from public.revenuecat_identity_tombstones
        where identity_hmac in (
          '00000000-0000-4000-8000-000000000001',
          '$RCAnonymousID:00000000-0000-4000-8000-000000000001',
          'opaque-deleted-a'
        )
     )
     or exists (
       select 1
         from information_schema.columns
        where table_schema = 'public'
          and table_name = 'revenuecat_identity_tombstones'
          and column_name in (
            'user_id', 'operation_id', 'identity', 'raw_identity', 'alias', 'project_id'
          )
     )
     or exists (
       select 1
         from public.subscriptions_events
        where rc_event_id in ('historical-opaque-a', 'historical-prefixed-a')
     )
     or exists (
       select 1
         from public.entitlements
        where user_id = '00000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'REHEARSAL_REVENUECAT_RAW_ALIAS_NONRETENTION_FAILED';
  end if;

  select events.*
    into strict v_shared
    from public.subscriptions_events as events
   where events.rc_event_id = 'historical-transfer-a-b';
  if v_shared.user_id is distinct from '00000000-0000-4000-8000-000000000002'::uuid
     or v_shared.resolved_user_id is distinct from
       '00000000-0000-4000-8000-000000000002'::uuid
     or v_shared.app_user_id is not null
     or v_shared.aliases is distinct from
       array['00000000-0000-4000-8000-000000000002']::text[]
     or v_shared.transferred_from is not null
     or v_shared.transferred_to is distinct from
       array['00000000-0000-4000-8000-000000000002']::text[]
     or not exists (
       select 1
         from public.entitlements
        where user_id = '00000000-0000-4000-8000-000000000002'
          and store_user_id is null
          and raw_status = '{}'::jsonb
     ) then
    raise exception 'REHEARSAL_REVENUECAT_TRANSIENT_FAMILY_SCRUB_FAILED';
  end if;
end;
$$;

-- Security-invoker helper for concise v0051 ingress fixtures. HMAC inputs are
-- aligned with exact source identity values, as the Edge HMAC helper produces.
create function public.rehearsal_process_revenuecat_event_v0051(
  p_event_id text,
  p_event_type text,
  p_app_user_id text,
  p_aliases text[],
  p_transferred_from text[],
  p_transferred_to text[],
  p_key_versions smallint[],
  p_identity_hmacs text[],
  p_identity_values text[]
)
returns table (
  outcome text,
  projection_applied boolean,
  processing_status text
)
language sql
set search_path = ''
as $$
  select guarded.outcome,
         guarded.projection_applied,
         guarded.processing_status
    from public.process_revenuecat_webhook_event_guarded(
      p_event_id,
      p_event_type,
      '{}'::text[],
      p_app_user_id,
      null,
      p_aliases,
      p_transferred_from,
      p_transferred_to,
      'production',
      'app_store',
      'routinekind_pro_annual',
      'pro',
      '2027-07-13T00:00:00Z'::timestamptz,
      '2026-07-13T00:00:00Z'::timestamptz,
      clock_timestamp(),
      clock_timestamp(),
      'original-' || p_event_id,
      'transaction-' || p_event_id,
      'normal',
      true,
      true,
      p_event_type <> 'TRANSFER',
      case when p_event_type = 'TRANSFER' then 0 else 200 end::smallint,
      'default',
      jsonb_build_object('event', jsonb_build_object('type', p_event_type)),
      true,
      true,
      p_key_versions,
      p_identity_hmacs,
      p_identity_values
    ) as guarded;
$$;

grant execute on function public.rehearsal_process_revenuecat_event_v0051(
  text, text, text, text[], text[], text[], smallint[], text[], text[]
) to service_role;

-- Hold a new opaque-only webhook after it has acquired the HMAC lock but
-- before its audit insert commits. Establishment must wait, then scrub that
-- newly committed row in the same transaction that creates the tombstone.
-- Operation 3 and its authoritative retained barrier are deliberately past
-- their processing deadline; a fresh live dispatch claim must still reconcile.
create function public.rehearsal_delay_opaque_identity_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rc_event_id = 'concurrent-opaque-race' then
    perform pg_catalog.pg_sleep(1);
  end if;
  return new;
end;
$$;

create trigger rehearsal_delay_opaque_identity_insert
before insert on public.subscriptions_events
for each row execute function public.rehearsal_delay_opaque_identity_insert();

do $$
declare
  v_lock_key bigint := public._revenuecat_identity_tombstone_advisory_key(
    1::smallint,
    repeat('7', 64)
  );
  v_lock_seen boolean := false;
  v_attempt integer;
  v_outcome text;
begin
  perform public.dblink_connect(
    'revenuecat_opaque_race',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_send_query(
    'revenuecat_opaque_race',
    $query$
      select result.*
        from public.rehearsal_process_revenuecat_event_v0051(
          'concurrent-opaque-race',
          'RENEWAL',
          'opaque-race',
          null,
          null,
          null,
          array[1::smallint],
          array[repeat('7', 64)],
          array['opaque-race']
        ) as result
    $query$
  );

  for v_attempt in 1..200 loop
    select exists (
      select 1
        from pg_catalog.pg_locks as locks
       where locks.pid <> pg_catalog.pg_backend_pid()
         and locks.locktype = 'advisory'
         and locks.mode = 'ExclusiveLock'
         and locks.granted
         and locks.objsubid = 1
         and locks.classid::bigint = ((v_lock_key >> 32) & 4294967295::bigint)
         and locks.objid::bigint = (v_lock_key & 4294967295::bigint)
    ) into v_lock_seen;
    exit when v_lock_seen;
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  if not v_lock_seen then
    raise exception 'REHEARSAL_REVENUECAT_OPAQUE_WEBHOOK_LOCK_NOT_OBSERVED';
  end if;

  perform *
    from public.establish_revenuecat_deletion_identity_barrier(
      '10000000-0000-4000-8000-000000000003',
      repeat('3', 64),
      1::smallint,
      array[repeat('6', 64), repeat('7', 64)],
      array[
        '00000000-0000-4000-8000-000000000003',
        'opaque-race'
      ],
      clock_timestamp() + interval '400 days'
    );

  while public.dblink_is_busy('revenuecat_opaque_race') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result.outcome
    into v_outcome
    from public.dblink_get_result('revenuecat_opaque_race')
      as result(outcome text, projection_applied boolean, processing_status text);
  perform public.dblink_disconnect('revenuecat_opaque_race');

  if v_outcome <> 'unresolved'
     or exists (
       select 1
         from public.subscriptions_events
        where rc_event_id = 'concurrent-opaque-race'
     )
     or not exists (
       select 1
         from public.revenuecat_identity_tombstones
        where hmac_key_version = 1
          and identity_hmac = repeat('7', 64)
     ) then
    raise exception 'REHEARSAL_REVENUECAT_OPAQUE_INSERT_AFTER_SCRUB_RACE_FAILED';
  end if;
end;
$$;

set role service_role;

-- Late opaque-only delivery is suppressed by its keyed HMAC.
do $$
declare
  v_outcome text;
begin
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event_v0051(
      'late-opaque-a',
      'RENEWAL',
      'opaque-deleted-a',
      null,
      null,
      null,
      array[1::smallint],
      array[repeat('c', 64)],
      array['opaque-deleted-a']
    ) as result;
  if v_outcome <> 'suppressed_deleted_account' then
    raise exception 'REHEARSAL_REVENUECAT_LATE_OPAQUE_NOT_SUPPRESSED';
  end if;
end;
$$;

-- A provider-prefixed deleted UUID is locked/suppressed but never promoted to
-- an entitlement owner merely because it contains a UUID substring.
do $$
declare
  v_outcome text;
begin
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event_v0051(
      'late-prefixed-a',
      'RENEWAL',
      '$RCAnonymousID:00000000-0000-4000-8000-000000000001',
      null,
      null,
      null,
      array[1::smallint],
      array[repeat('a', 64)],
      array['$RCAnonymousID:00000000-0000-4000-8000-000000000001']
    ) as result;
  if v_outcome <> 'suppressed_deleted_account' then
    raise exception 'REHEARSAL_REVENUECAT_PREFIXED_UUID_NOT_SUPPRESSED';
  end if;
end;
$$;

-- Mixed A/B transfer strips tombstoned A and assigns only exact live B.
do $$
declare
  v_outcome text;
begin
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event_v0051(
      'late-transfer-a-b',
      'TRANSFER',
      'opaque-deleted-a',
      null,
      array['opaque-deleted-a'],
      array['00000000-0000-4000-8000-000000000002'],
      array[1::smallint, 1::smallint],
      array[repeat('c', 64), repeat('d', 64)],
      array[
        'opaque-deleted-a',
        '00000000-0000-4000-8000-000000000002'
      ]
    ) as result;
  if v_outcome <> 'ignored' then
    raise exception 'REHEARSAL_REVENUECAT_MIXED_TRANSFER_RESULT_FAILED';
  end if;
end;
$$;

-- An embedded live UUID is audit-only and cannot resolve an owner.
do $$
declare
  v_outcome text;
begin
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event_v0051(
      'live-prefixed-b',
      'RENEWAL',
      '$RCAnonymousID:00000000-0000-4000-8000-000000000002',
      null,
      null,
      null,
      array[1::smallint, 1::smallint],
      array[repeat('e', 64), repeat('f', 64)],
      array[
        '$RCAnonymousID:00000000-0000-4000-8000-000000000002',
        '$RCAnonymousID:00000000-0000-4000-8000-000000000002'
      ]
    ) as result;
  if v_outcome <> 'unresolved' then
    raise exception 'REHEARSAL_REVENUECAT_EMBEDDED_UUID_OWNED_ENTITLEMENT';
  end if;
end;
$$;

reset role;

do $$
declare
  v_transfer public.subscriptions_events%rowtype;
  v_prefixed public.subscriptions_events%rowtype;
begin
  if exists (
       select 1 from public.subscriptions_events
        where rc_event_id in ('late-opaque-a', 'late-prefixed-a')
     ) then
    raise exception 'REHEARSAL_REVENUECAT_SUPPRESSED_EVENT_PERSISTED';
  end if;
  select events.* into strict v_transfer
    from public.subscriptions_events as events
   where events.rc_event_id = 'late-transfer-a-b';
  select events.* into strict v_prefixed
    from public.subscriptions_events as events
   where events.rc_event_id = 'live-prefixed-b';
  if v_transfer.user_id is distinct from '00000000-0000-4000-8000-000000000002'::uuid
     or v_transfer.resolved_user_id is distinct from
       '00000000-0000-4000-8000-000000000002'::uuid
     or v_transfer.app_user_id is not null
     or v_transfer.transferred_from is not null
     or v_transfer.transferred_to is distinct from
       array['00000000-0000-4000-8000-000000000002']::text[]
     or v_prefixed.user_id is not null
     or v_prefixed.resolved_user_id is not null then
    raise exception 'REHEARSAL_REVENUECAT_TRANSFER_OR_EMBEDDED_OWNER_FAILED';
  end if;
end;
$$;

-- Expired rows do not match, and the version is part of the lookup key.
insert into public.revenuecat_identity_tombstones (
  hmac_key_version,
  identity_hmac,
  created_at,
  expires_at
)
values (2, repeat('9', 64), clock_timestamp() - interval '2 days',
        clock_timestamp() - interval '1 day');

set role service_role;

do $$
declare
  v_expired text;
  v_wrong_version text;
begin
  select result.outcome into v_expired
    from public.rehearsal_process_revenuecat_event_v0051(
      'expired-tombstone', 'RENEWAL', 'opaque-expired', null, null, null,
      array[2::smallint], array[repeat('9', 64)], array['opaque-expired']
    ) as result;
  select result.outcome into v_wrong_version
    from public.rehearsal_process_revenuecat_event_v0051(
      'wrong-key-version', 'RENEWAL', 'opaque-deleted-a', null, null, null,
      array[2::smallint], array[repeat('c', 64)], array['opaque-deleted-a']
    ) as result;
  if v_expired <> 'unresolved' or v_wrong_version <> 'unresolved' then
    raise exception 'REHEARSAL_REVENUECAT_EXPIRY_OR_KEY_VERSION_FAILED';
  end if;
  if public.purge_expired_revenuecat_identity_tombstones(100) <> 1 then
    raise exception 'REHEARSAL_REVENUECAT_EXPIRY_PURGE_FAILED';
  end if;
end;
$$;

-- Every source value must be covered for every presented key version.
do $$
begin
  perform public.rehearsal_process_revenuecat_event_v0051(
    'missing-hmac-coverage',
    'RENEWAL',
    'identity-one',
    array['identity-two'],
    null,
    null,
    array[1::smallint],
    array[repeat('8', 64)],
    array['identity-one']
  );
  raise exception 'REHEARSAL_REVENUECAT_MISSING_HMAC_COVERAGE_ALLOWED';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'INVALID_REVENUECAT_IDENTITY_TOMBSTONE_LOOKUP' then raise; end if;
end;
$$;

-- Direct service-role table mutation is denied; only guarded RPCs execute.
do $$
begin
  insert into public.subscriptions_events (rc_event_id) values ('direct-write-denied');
  raise exception 'REHEARSAL_REVENUECAT_DIRECT_EVENT_INSERT_ALLOWED';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  update public.entitlements set is_active = false;
  raise exception 'REHEARSAL_REVENUECAT_DIRECT_ENTITLEMENT_UPDATE_ALLOWED';
exception when insufficient_privilege then null;
end;
$$;

reset role;

do $$
begin
  if pg_catalog.has_function_privilege(
       'service_role',
       'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean,smallint[],text[],text[])',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.establish_revenuecat_deletion_identity_barrier(uuid,text,smallint,text[],text[],timestamptz)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.establish_revenuecat_deletion_identity_barrier(uuid,text,smallint,text[],text[],timestamptz)',
       'EXECUTE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.subscriptions_events', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.entitlements', 'UPDATE'
     )
     or not pg_catalog.has_table_privilege(
       'service_role', 'public.subscriptions_events', 'SELECT'
     )
     or not pg_catalog.has_table_privilege(
       'service_role', 'public.entitlements', 'SELECT'
     ) then
    raise exception 'REHEARSAL_REVENUECAT_IDENTITY_PRIVILEGE_BOUNDARY_FAILED';
  end if;
end;
$$;

select 'REVENUECAT_IDENTITY_TOMBSTONES_POSTGRES_REHEARSAL_PASS' as result;
