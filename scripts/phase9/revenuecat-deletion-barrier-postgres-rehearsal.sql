\set ON_ERROR_STOP on

-- Disposable PostgreSQL 15/17 rehearsal for migrations 0041 and 0049. Run
-- only in a fresh throwaway database. It builds the minimum pre-0041 payment
-- schema plus the migration-0048 advisory-key/barrier contract, applies the
-- real migrations, and proves deletion-aware ingress and privilege behavior.

create extension pgcrypto with schema public;
create extension dblink with schema public;

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit;

create schema auth;
create table auth.users (
  id uuid primary key
);

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

-- Minimum effective migration-0048 contract consumed by migration 0049.
create table public.account_deletion_barriers (
  user_id uuid primary key
);
alter table public.account_deletion_barriers enable row level security;
alter table public.account_deletion_barriers force row level security;
revoke all on table public.account_deletion_barriers from public, anon, authenticated;

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

revoke all on function public._account_deletion_advisory_key(uuid)
  from public, anon, authenticated, service_role;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005');

insert into public.account_deletion_barriers (user_id) values
  ('00000000-0000-4000-8000-000000000002');

\ir ../../supabase/migrations/20260713000049_revenuecat_deletion_barrier_guard.sql

do $$
begin
  if pg_catalog.has_function_privilege(
       'service_role',
       'public.process_revenuecat_webhook_event(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.process_revenuecat_webhook_event_guarded(text,text,text[],text,text,text[],text[],text[],text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text,boolean,boolean,boolean,smallint,text,jsonb,boolean,boolean)',
       'EXECUTE'
     ) then
    raise exception 'REHEARSAL_REVENUECAT_GUARD_PRIVILEGE_BOUNDARY_FAILED';
  end if;
end;
$$;

-- A trigger observes the transaction from inside the old atomic delegate. The
-- guarded wrapper must already hold every expected account advisory lock when
-- the audit insert and entitlement projection execute.
create function public.rehearsal_assert_revenuecat_account_locks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_setting text := pg_catalog.current_setting(
    'rehearsal.expected_revenuecat_lock_uuids',
    true
  );
  v_expected uuid;
  v_key bigint;
begin
  if v_expected_setting is null or v_expected_setting = '' then
    return new;
  end if;

  foreach v_expected in array pg_catalog.string_to_array(v_expected_setting, ',')::uuid[] loop
    v_key := public._account_deletion_advisory_key(v_expected);
    if not exists (
      select 1
        from pg_catalog.pg_locks as locks
       where locks.pid = pg_catalog.pg_backend_pid()
         and locks.locktype = 'advisory'
         and locks.mode = 'ExclusiveLock'
         and locks.granted
         and locks.objsubid = 1
         and locks.classid::bigint = (
           (v_key >> 32) & 4294967295::bigint
         )
         and locks.objid::bigint = (v_key & 4294967295::bigint)
    ) then
      raise exception 'REHEARSAL_REVENUECAT_ACCOUNT_LOCK_MISSING';
    end if;
  end loop;
  return new;
end;
$$;

create trigger rehearsal_assert_revenuecat_account_locks
before insert on public.subscriptions_events
for each row execute function public.rehearsal_assert_revenuecat_account_locks();

create function public.rehearsal_delay_concurrent_revenuecat_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rc_event_id in ('concurrent-forward', 'concurrent-reverse') then
    perform pg_catalog.pg_sleep(0.5);
  end if;
  return new;
end;
$$;

create trigger rehearsal_delay_concurrent_revenuecat_insert
before insert on public.subscriptions_events
for each row execute function public.rehearsal_delay_concurrent_revenuecat_insert();

-- Security-invoker convenience wrapper keeps each fixture readable while still
-- requiring service_role permission on the real guarded function.
create function public.rehearsal_process_revenuecat_event(
  p_event_id text,
  p_user_candidates text[],
  p_app_user_id text,
  p_original_app_user_id text,
  p_aliases text[],
  p_transferred_from text[],
  p_transferred_to text[],
  p_event_type text default 'RENEWAL'
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
      p_user_candidates,
      p_app_user_id,
      p_original_app_user_id,
      p_aliases,
      p_transferred_from,
      p_transferred_to,
      'production',
      'app_store',
      'routinekind_pro_annual',
      'pro',
      '2027-07-13T00:00:00Z'::timestamptz,
      '2026-07-13T00:00:00Z'::timestamptz,
      '2026-07-13T00:00:01Z'::timestamptz,
      '2026-07-13T00:00:02Z'::timestamptz,
      'original-transaction-' || p_event_id,
      'transaction-' || p_event_id,
      'normal',
      true,
      true,
      case
        when pg_catalog.upper(
          pg_catalog.btrim(p_event_type, E' \t\n\r\f\013')
        ) = 'TRANSFER' then false
        else true
      end,
      200::smallint,
      'default',
      pg_catalog.jsonb_build_object(
        'event',
        pg_catalog.jsonb_build_object(
          'id',
          p_event_id,
          'type',
          pg_catalog.upper(pg_catalog.btrim(p_event_type, E' \t\n\r\f\013'))
        )
      ),
      true,
      true
    ) as guarded;
$$;

set role service_role;

-- Mixed active/barred/deleted owners: all three locks are present inside the
-- atomic delegate, only the live unbarred account resolves, and every inactive
-- occurrence (including an opaque embedding) is absent from persisted fields.
do $$
declare
  v_outcome text;
  v_projection boolean;
  v_status text;
begin
  perform pg_catalog.set_config(
    'rehearsal.expected_revenuecat_lock_uuids',
    '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000003',
    true
  );
  select result.outcome, result.projection_applied, result.processing_status
    into v_outcome, v_projection, v_status
    from public.rehearsal_process_revenuecat_event(
      'mixed-active-barred',
      array['00000000-0000-4000-8000-000000000003'],
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      array[
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001',
        '$RCAnonymousID:safe-alias',
        '$RCAnonymousID:00000000-0000-4000-8000-000000000002'
      ],
      array[
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        '$RCAnonymousID:safe-source'
      ],
      array[
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000001'
      ]
    ) as result;
  if v_outcome <> 'processed' or not v_projection or v_status <> 'processed' then
    raise exception 'REHEARSAL_REVENUECAT_MIXED_RESULT_FAILED';
  end if;
end;
$$;

reset role;

do $$
declare
  v_row public.subscriptions_events%rowtype;
  v_row_text text;
begin
  select events.*
    into strict v_row
    from public.subscriptions_events as events
   where events.rc_event_id = 'mixed-active-barred';
  v_row_text := pg_catalog.to_jsonb(v_row)::text;
  if v_row.user_id is distinct from '00000000-0000-4000-8000-000000000001'::uuid
     or v_row.resolved_user_id is distinct from '00000000-0000-4000-8000-000000000001'::uuid
     or v_row.app_user_id is not null
     or v_row.original_app_user_id <> '00000000-0000-4000-8000-000000000001'
     or v_row.aliases is distinct from array[
       '$RCAnonymousID:safe-alias',
       '00000000-0000-4000-8000-000000000001'
     ]::text[]
     or v_row.transferred_from is distinct from array[
       '$RCAnonymousID:safe-source'
     ]::text[]
     or v_row.transferred_to is distinct from array[
       '00000000-0000-4000-8000-000000000001'
     ]::text[]
     or v_row_text like '%00000000-0000-4000-8000-000000000002%'
     or v_row_text like '%00000000-0000-4000-8000-000000000003%'
     or not exists (
       select 1
         from public.entitlements as entitlements
        where entitlements.user_id = '00000000-0000-4000-8000-000000000001'
          and entitlements.is_active
          and entitlements.rc_event_id = 'mixed-active-barred'
     ) then
    raise exception 'REHEARSAL_REVENUECAT_MIXED_SCRUB_OR_PROJECTION_FAILED';
  end if;
end;
$$;

set role service_role;

-- All exact UUIDs are missing or barred. No audit/projection row is created and
-- the returned value is a constant that contains no provider/account identity.
do $$
declare
  v_outcome text;
  v_projection boolean;
  v_status text;
  v_result_text text;
begin
  select result.outcome,
         result.projection_applied,
         result.processing_status,
         pg_catalog.to_jsonb(result)::text
    into v_outcome, v_projection, v_status, v_result_text
    from public.rehearsal_process_revenuecat_event(
      'all-barred',
      array['00000000-0000-4000-8000-000000000003'],
      '00000000-0000-4000-8000-000000000002',
      null,
      array[
        '$RCAnonymousID:private-provider-handle',
        '00000000-0000-4000-8000-000000000003'
      ],
      null,
      array['00000000-0000-4000-8000-000000000002']
    ) as result;
  if v_outcome <> 'suppressed_deleted_account'
     or v_projection
     or v_status <> 'suppressed_deleted_account'
     or v_result_text like '%00000000-0000-4000-8000-000000000002%'
     or v_result_text like '%00000000-0000-4000-8000-000000000003%'
     or v_result_text like '%private-provider-handle%' then
    raise exception 'REHEARSAL_REVENUECAT_SUPPRESSION_RESULT_LEAKED';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1
      from public.subscriptions_events
     where rc_event_id = 'all-barred'
  ) then
    raise exception 'REHEARSAL_REVENUECAT_ALL_BARRED_EVENT_PERSISTED';
  end if;
end;
$$;

set role service_role;

-- Anonymous-only provider identifiers remain audit evidence but cannot become
-- Auth resolution candidates, even while unrelated active accounts exist.
do $$
declare
  v_outcome text;
begin
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event(
      'anonymous-only',
      array['$RCAnonymousID:candidate'],
      '$RCAnonymousID:app',
      'provider-original',
      array['$RCAnonymousID:alias'],
      array['$RCAnonymousID:source'],
      array['$RCAnonymousID:destination']
    ) as result;
  if v_outcome <> 'unresolved' then
    raise exception 'REHEARSAL_REVENUECAT_ANONYMOUS_RESULT_FAILED';
  end if;
end;
$$;

-- transferred_to is an ownership signal only for RevenueCat TRANSFER events.
-- A destination attached to another event type remains audit-only.
do $$
declare
  v_outcome text;
begin
  perform pg_catalog.set_config(
    'rehearsal.expected_revenuecat_lock_uuids',
    '00000000-0000-4000-8000-000000000004',
    true
  );
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event(
      'non-transfer-destination-only',
      array['00000000-0000-4000-8000-000000000004'],
      '$RCAnonymousID:app',
      null,
      null,
      null,
      array['00000000-0000-4000-8000-000000000004'],
      E'\t renewal \r\n'
    ) as result;
  if v_outcome <> 'unresolved' then
    raise exception 'REHEARSAL_REVENUECAT_NON_TRANSFER_DESTINATION_RESOLVED';
  end if;
end;
$$;

-- ASCII boundary whitespace and case normalize before the TRANSFER semantic
-- check, so a legitimate destination can own a normalized TRANSFER event.
do $$
declare
  v_outcome text;
begin
  perform pg_catalog.set_config(
    'rehearsal.expected_revenuecat_lock_uuids',
    '00000000-0000-4000-8000-000000000005',
    true
  );
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event(
      'trimmed-transfer-destination',
      array['00000000-0000-4000-8000-000000000005'],
      '$RCAnonymousID:app',
      null,
      null,
      null,
      array['00000000-0000-4000-8000-000000000005'],
      E' \t transfer \r\n'
    ) as result;
  if v_outcome <> 'ignored' then
    raise exception 'REHEARSAL_REVENUECAT_TRIMMED_TRANSFER_NOT_RESOLVED';
  end if;
end;
$$;

-- A spoofed active UUID supplied only in p_user_candidates participates in the
-- lock set but never becomes the semantic owner of barred structured data.
do $$
declare
  v_outcome text;
begin
  perform pg_catalog.set_config(
    'rehearsal.expected_revenuecat_lock_uuids',
    '00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000004',
    true
  );
  select result.outcome
    into v_outcome
    from public.rehearsal_process_revenuecat_event(
      'candidate-spoof',
      array['00000000-0000-4000-8000-000000000004'],
      '00000000-0000-4000-8000-000000000002',
      null,
      array[
        '$RCAnonymousID:safe-spoof-alias',
        '$RCAnonymousID:00000000-0000-4000-8000-000000000002'
      ],
      null,
      null
    ) as result;
  if v_outcome <> 'unresolved' then
    raise exception 'REHEARSAL_REVENUECAT_CANDIDATE_SPOOF_RESULT_FAILED';
  end if;
end;
$$;

-- SQL-level malformed identity values fail closed with a constant error.
do $$
begin
  perform public.rehearsal_process_revenuecat_event(
    'malformed-identity',
    '{}'::text[],
    null,
    null,
    array[null]::text[],
    null,
    null
  );
  raise exception 'REHEARSAL_REVENUECAT_MALFORMED_IDENTITY_ALLOWED';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'INVALID_REVENUECAT_IDENTITY_SHAPE' then raise; end if;
end;
$$;

reset role;

do $$
declare
  v_anonymous public.subscriptions_events%rowtype;
  v_non_transfer public.subscriptions_events%rowtype;
  v_spoof public.subscriptions_events%rowtype;
  v_transfer public.subscriptions_events%rowtype;
begin
  select events.*
    into strict v_anonymous
    from public.subscriptions_events as events
   where events.rc_event_id = 'anonymous-only';
  select events.*
    into strict v_non_transfer
    from public.subscriptions_events as events
   where events.rc_event_id = 'non-transfer-destination-only';
  select events.*
    into strict v_spoof
    from public.subscriptions_events as events
   where events.rc_event_id = 'candidate-spoof';
  select events.*
    into strict v_transfer
    from public.subscriptions_events as events
   where events.rc_event_id = 'trimmed-transfer-destination';

  if v_anonymous.resolved_user_id is not null
     or v_anonymous.user_id is not null
     or v_anonymous.app_user_id <> '$RCAnonymousID:app'
     or v_anonymous.aliases is distinct from array['$RCAnonymousID:alias']::text[]
     or v_non_transfer.event_type <> 'RENEWAL'
     or v_non_transfer.resolved_user_id is not null
     or v_non_transfer.user_id is not null
     or v_non_transfer.transferred_to is distinct from array[
       '00000000-0000-4000-8000-000000000004'
     ]::text[]
     or v_spoof.resolved_user_id is not null
     or v_spoof.user_id is not null
     or v_spoof.app_user_id is not null
     or v_spoof.aliases is distinct from array['$RCAnonymousID:safe-spoof-alias']::text[]
     or v_transfer.event_type <> 'TRANSFER'
     or v_transfer.resolved_user_id is distinct from
       '00000000-0000-4000-8000-000000000005'::uuid
     or v_transfer.user_id is distinct from '00000000-0000-4000-8000-000000000005'::uuid
     or exists (
       select 1
         from public.entitlements
        where user_id = '00000000-0000-4000-8000-000000000004'
     )
     or exists (
       select 1
         from public.entitlements
        where user_id = '00000000-0000-4000-8000-000000000005'
     ) then
    raise exception 'REHEARSAL_REVENUECAT_ANONYMOUS_OR_SPOOF_ATTACHMENT_FAILED';
  end if;
end;
$$;

-- Opposite raw candidate/field orders execute concurrently. Each transaction
-- proves both advisory locks are already held inside its insert trigger. The
-- half-second trigger overlap would expose inconsistent lock order as a
-- deadlock; globally sorted extraction lets both transactions complete.
do $$
declare
  v_forward_outcome text;
  v_forward_status text;
  v_reverse_outcome text;
  v_reverse_status text;
begin
  perform public.dblink_connect(
    'revenuecat_forward',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_connect(
    'revenuecat_reverse',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );

  perform public.dblink_send_query(
    'revenuecat_forward',
    $query$
      with configured as (
        select pg_catalog.set_config(
          'rehearsal.expected_revenuecat_lock_uuids',
          '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000004',
          true
        )
      )
      select result.*
        from configured
        cross join lateral public.rehearsal_process_revenuecat_event(
          'concurrent-forward',
          array[
            '00000000-0000-4000-8000-000000000004',
            '00000000-0000-4000-8000-000000000001'
          ],
          '00000000-0000-4000-8000-000000000001',
          null,
          array['00000000-0000-4000-8000-000000000004'],
          null,
          null
        ) as result
    $query$
  );
  perform public.dblink_send_query(
    'revenuecat_reverse',
    $query$
      with configured as (
        select pg_catalog.set_config(
          'rehearsal.expected_revenuecat_lock_uuids',
          '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000004',
          true
        )
      )
      select result.*
        from configured
        cross join lateral public.rehearsal_process_revenuecat_event(
          'concurrent-reverse',
          array[
            '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000004'
          ],
          '00000000-0000-4000-8000-000000000004',
          null,
          array['00000000-0000-4000-8000-000000000001'],
          null,
          null
        ) as result
    $query$
  );

  while public.dblink_is_busy('revenuecat_forward') = 1
     or public.dblink_is_busy('revenuecat_reverse') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;

  select result.outcome, result.processing_status
    into v_forward_outcome, v_forward_status
    from public.dblink_get_result('revenuecat_forward')
      as result(outcome text, projection_applied boolean, processing_status text);
  select result.outcome, result.processing_status
    into v_reverse_outcome, v_reverse_status
    from public.dblink_get_result('revenuecat_reverse')
      as result(outcome text, projection_applied boolean, processing_status text);

  perform public.dblink_disconnect('revenuecat_forward');
  perform public.dblink_disconnect('revenuecat_reverse');

  if v_forward_outcome not in ('processed', 'stale')
     or v_forward_status is distinct from v_forward_outcome
     or v_reverse_outcome not in ('processed', 'stale')
     or v_reverse_status is distinct from v_reverse_outcome
     or (
       select count(*)
         from public.subscriptions_events
        where rc_event_id in ('concurrent-forward', 'concurrent-reverse')
          and processing_status in ('processed', 'stale')
     ) <> 2 then
    raise exception 'REHEARSAL_REVENUECAT_CONCURRENT_LOCK_ORDER_FAILED';
  end if;
end;
$$;

select 'REVENUECAT_DELETION_BARRIER_POSTGRES_REHEARSAL_PASS' as result;
