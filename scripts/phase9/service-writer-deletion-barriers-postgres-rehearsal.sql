\set ON_ERROR_STOP on

-- Disposable PostgreSQL 15/17 rehearsal for migration 0050. Run only in a
-- fresh throwaway database. It builds the minimum effective pre-0050 schema,
-- applies the real migration, and proves both writer-first/deletion-first race
-- orders plus the final service-role privilege boundary.

create extension pgcrypto with schema public;
create extension dblink with schema public;

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;

-- Emulate the Data API table ACL present in a Supabase project before the
-- migration narrows direct service mutation to guarded RPCs.
alter default privileges in schema public
  grant select, insert, update, delete, truncate on tables to service_role;

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

create table public.reverse_trial_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null default 'server',
  metadata jsonb not null default '{}'::jsonb
);

create table public.catalog_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  barcode text,
  correction_type text not null,
  proposed_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.obf_contribution_queue (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid references public.catalog_corrections (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
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

create table public.account_deletion_barriers (
  user_id uuid primary key
);
alter table public.account_deletion_barriers enable row level security;
alter table public.account_deletion_barriers force row level security;
revoke all on table public.account_deletion_barriers
  from public, anon, authenticated, service_role;

create or replace function public._account_deletion_advisory_key(p_user_id uuid)
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

create or replace function public.account_write_allowed(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if p_user_id is null then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  return exists (
    select 1 from auth.users as users where users.id = p_user_id
  ) and not exists (
    select 1
      from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  );
end;
$$;
revoke all on function public.account_write_allowed(uuid)
  from public, anon, authenticated;
grant execute on function public.account_write_allowed(uuid) to service_role;

create or replace function public.expire_app_granted_reverse_trials()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.entitlements
     set is_active = false,
         will_renew = false,
         updated_at = now(),
         last_reconciled_at = now()
   where store = 'app_granted'
     and period_type = 'reverse_trial'
     and is_active = true
     and expires_at is not null
     and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.expire_app_granted_reverse_trials()
  from public, anon, authenticated;
grant execute on function public.expire_app_granted_reverse_trials()
  to service_role;

-- Effective pre-0050 function signatures. Migration 0050 replaces both.
create or replace function public.grant_app_granted_reverse_trial(
  p_user_id uuid,
  p_expires_at timestamptz,
  p_environment text
)
returns setof public.entitlements
language sql
security definer
set search_path = ''
as $$
  select entitlements.*
    from public.entitlements as entitlements
   where false;
$$;

create or replace function public.grant_app_granted_reverse_trial(
  p_user_id uuid,
  p_expires_at timestamptz,
  p_environment text,
  p_product_id text
)
returns setof public.entitlements
language sql
security definer
set search_path = ''
as $$
  select *
    from public.grant_app_granted_reverse_trial(
      p_user_id,
      p_expires_at,
      p_environment
    );
$$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000006');

insert into public.catalog_corrections (
  id,
  user_id,
  barcode,
  correction_type,
  proposed_payload
) values
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    '000000000003',
    'missing_product',
    '{"productName":"writer first"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000004',
    '000000000004',
    'missing_product',
    '{"productName":"deletion first"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000005',
    '000000000005',
    'missing_product',
    '{"productName":"derived control"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000006',
    '000000000006',
    'wrong_match',
    '{"productName":"not eligible"}'::jsonb
  );

-- Expired target rows on both reverse-trial race accounts make the rehearsal
-- exercise the account-lock -> target-row-lock order. The unrelated expired
-- row proves a direct grant never performs a global update in that transaction.
insert into public.entitlements (
  user_id,
  entitlement,
  is_active,
  expires_at,
  store,
  period_type
) values
  (
    '00000000-0000-4000-8000-000000000001',
    'pro',
    true,
    now() - interval '1 hour',
    'app_granted',
    'reverse_trial'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'pro',
    true,
    now() - interval '1 hour',
    'app_granted',
    'reverse_trial'
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'pro',
    true,
    now() - interval '1 hour',
    'app_granted',
    'reverse_trial'
  );

\ir ../../supabase/migrations/20260713000050_service_writer_deletion_barriers.sql

do $$
begin
  if not pg_catalog.has_function_privilege(
       'service_role',
       'public.grant_app_granted_reverse_trial(uuid,timestamptz,text)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.enqueue_obf_contribution_for_correction(uuid)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.grant_app_granted_reverse_trial(uuid,timestamptz,text)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.enqueue_obf_contribution_for_correction(uuid)',
       'EXECUTE'
     ) then
    raise exception 'REHEARSAL_SERVICE_WRITER_RPC_PRIVILEGES_FAILED';
  end if;

  if not pg_catalog.has_table_privilege('service_role', 'public.entitlements', 'SELECT')
     or pg_catalog.has_table_privilege('service_role', 'public.entitlements', 'INSERT')
     or pg_catalog.has_table_privilege('service_role', 'public.entitlements', 'UPDATE')
     or pg_catalog.has_table_privilege('service_role', 'public.entitlements', 'DELETE')
     or pg_catalog.has_table_privilege('service_role', 'public.entitlements', 'TRUNCATE')
     or not pg_catalog.has_table_privilege(
       'service_role', 'public.reverse_trial_grants', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.reverse_trial_grants', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.reverse_trial_grants', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.reverse_trial_grants', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.reverse_trial_grants', 'TRUNCATE'
     )
     or not pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.obf_contribution_queue', 'TRUNCATE'
     ) then
    raise exception 'REHEARSAL_SERVICE_WRITER_TABLE_PRIVILEGES_FAILED';
  end if;
end;
$$;

-- Rehearsal-only deletion transaction. It takes the production advisory lock,
-- creates the barrier, then scrubs the service rows covered by this migration.
create or replace function public.rehearsal_begin_service_writer_deletion(
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  insert into public.account_deletion_barriers (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  delete from public.obf_contribution_queue where user_id = p_user_id;
  delete from public.reverse_trial_grants where user_id = p_user_id;
  delete from public.entitlements where user_id = p_user_id;
  return 'deletion_started';
end;
$$;
revoke all on function public.rehearsal_begin_service_writer_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.rehearsal_begin_service_writer_deletion(uuid)
  to service_role;

create or replace function public.rehearsal_try_reverse_trial(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.grant_app_granted_reverse_trial(
    p_user_id,
    now() + interval '7 days',
    'production'
  );
  return 'granted';
exception
  when others then
    if sqlerrm = 'ACCOUNT_DELETION_IN_PROGRESS' then
      return 'account_deletion_in_progress';
    end if;
    raise;
end;
$$;
revoke all on function public.rehearsal_try_reverse_trial(uuid)
  from public, anon, authenticated;
grant execute on function public.rehearsal_try_reverse_trial(uuid)
  to service_role;

-- Deterministic overlap: writer-first users sleep only after the guarded RPC
-- has acquired the account lock; deletion-first users sleep while inserting
-- the barrier after the deletion transaction has acquired that same lock.
create or replace function public.rehearsal_delay_service_writer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id in (
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000003'::uuid
  ) then
    perform pg_catalog.pg_sleep(0.75);
  end if;
  return new;
end;
$$;

create trigger rehearsal_delay_reverse_trial_writer
before insert on public.reverse_trial_grants
for each row execute function public.rehearsal_delay_service_writer();

create trigger rehearsal_delay_obf_writer
before insert on public.obf_contribution_queue
for each row execute function public.rehearsal_delay_service_writer();

create or replace function public.rehearsal_delay_deletion_barrier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id in (
    '00000000-0000-4000-8000-000000000002'::uuid,
    '00000000-0000-4000-8000-000000000004'::uuid
  ) then
    perform pg_catalog.pg_sleep(0.75);
  end if;
  return new;
end;
$$;

create trigger rehearsal_delay_deletion_barrier
before insert on public.account_deletion_barriers
for each row execute function public.rehearsal_delay_deletion_barrier();

-- Reverse trial, writer first: the grant commits before deletion acquires the
-- lock, then deletion removes both service rows.
do $$
declare
  v_writer text;
  v_deletion text;
begin
  perform public.dblink_connect(
    'reverse_writer_first_writer',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_connect(
    'reverse_writer_first_deletion',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_exec('reverse_writer_first_writer', 'set role service_role');
  perform public.dblink_exec('reverse_writer_first_deletion', 'set role service_role');
  perform public.dblink_send_query(
    'reverse_writer_first_writer',
    $query$select public.rehearsal_try_reverse_trial(
      '00000000-0000-4000-8000-000000000001'::uuid
    )$query$
  );
  perform pg_catalog.pg_sleep(0.15);
  perform public.dblink_send_query(
    'reverse_writer_first_deletion',
    $query$select public.rehearsal_begin_service_writer_deletion(
      '00000000-0000-4000-8000-000000000001'::uuid
    )$query$
  );
  while public.dblink_is_busy('reverse_writer_first_writer') = 1
     or public.dblink_is_busy('reverse_writer_first_deletion') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_writer
    from public.dblink_get_result('reverse_writer_first_writer') as result(result text);
  select result into v_deletion
    from public.dblink_get_result('reverse_writer_first_deletion') as result(result text);
  perform public.dblink_disconnect('reverse_writer_first_writer');
  perform public.dblink_disconnect('reverse_writer_first_deletion');
  if v_writer <> 'granted'
     or v_deletion <> 'deletion_started'
     or exists (
       select 1 from public.reverse_trial_grants
        where user_id = '00000000-0000-4000-8000-000000000001'
     )
     or exists (
       select 1 from public.entitlements
        where user_id = '00000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'REHEARSAL_REVERSE_WRITER_FIRST_FAILED';
  end if;
end;
$$;

-- Reverse trial, deletion first: the writer waits for the barrier transaction
-- and receives the exact stable conflict without creating either row.
do $$
declare
  v_writer text;
  v_deletion text;
begin
  perform public.dblink_connect(
    'reverse_deletion_first_deletion',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_connect(
    'reverse_deletion_first_writer',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_exec('reverse_deletion_first_deletion', 'set role service_role');
  perform public.dblink_exec('reverse_deletion_first_writer', 'set role service_role');
  perform public.dblink_send_query(
    'reverse_deletion_first_deletion',
    $query$select public.rehearsal_begin_service_writer_deletion(
      '00000000-0000-4000-8000-000000000002'::uuid
    )$query$
  );
  perform pg_catalog.pg_sleep(0.15);
  perform public.dblink_send_query(
    'reverse_deletion_first_writer',
    $query$select public.rehearsal_try_reverse_trial(
      '00000000-0000-4000-8000-000000000002'::uuid
    )$query$
  );
  while public.dblink_is_busy('reverse_deletion_first_deletion') = 1
     or public.dblink_is_busy('reverse_deletion_first_writer') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_deletion
    from public.dblink_get_result('reverse_deletion_first_deletion') as result(result text);
  select result into v_writer
    from public.dblink_get_result('reverse_deletion_first_writer') as result(result text);
  perform public.dblink_disconnect('reverse_deletion_first_deletion');
  perform public.dblink_disconnect('reverse_deletion_first_writer');
  if v_deletion <> 'deletion_started'
     or v_writer <> 'account_deletion_in_progress'
     or exists (
       select 1 from public.reverse_trial_grants
        where user_id = '00000000-0000-4000-8000-000000000002'
     )
     or exists (
       select 1 from public.entitlements
        where user_id = '00000000-0000-4000-8000-000000000002'
     ) then
    raise exception 'REHEARSAL_REVERSE_DELETION_FIRST_FAILED';
  end if;
end;
$$;

-- OBF enqueue, writer first: the queue insert derives its data from the stored
-- correction, then deletion waits and removes it.
do $$
declare
  v_writer jsonb;
  v_deletion text;
begin
  perform public.dblink_connect(
    'obf_writer_first_writer',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_connect(
    'obf_writer_first_deletion',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_exec('obf_writer_first_writer', 'set role service_role');
  perform public.dblink_exec('obf_writer_first_deletion', 'set role service_role');
  perform public.dblink_send_query(
    'obf_writer_first_writer',
    $query$select public.enqueue_obf_contribution_for_correction(
      '10000000-0000-4000-8000-000000000003'::uuid
    )$query$
  );
  perform pg_catalog.pg_sleep(0.15);
  perform public.dblink_send_query(
    'obf_writer_first_deletion',
    $query$select public.rehearsal_begin_service_writer_deletion(
      '00000000-0000-4000-8000-000000000003'::uuid
    )$query$
  );
  while public.dblink_is_busy('obf_writer_first_writer') = 1
     or public.dblink_is_busy('obf_writer_first_deletion') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_writer
    from public.dblink_get_result('obf_writer_first_writer') as result(result jsonb);
  select result into v_deletion
    from public.dblink_get_result('obf_writer_first_deletion') as result(result text);
  perform public.dblink_disconnect('obf_writer_first_writer');
  perform public.dblink_disconnect('obf_writer_first_deletion');
  if v_writer ->> 'outcome' <> 'enqueued'
     or v_deletion <> 'deletion_started'
     or exists (
       select 1 from public.obf_contribution_queue
        where user_id = '00000000-0000-4000-8000-000000000003'
     ) then
    raise exception 'REHEARSAL_OBF_WRITER_FIRST_FAILED';
  end if;
end;
$$;

-- OBF enqueue, deletion first: the RPC's initial correction lookup may run,
-- but its locked re-read observes the barrier and succeeds without enqueueing.
do $$
declare
  v_writer jsonb;
  v_deletion text;
begin
  perform public.dblink_connect(
    'obf_deletion_first_deletion',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_connect(
    'obf_deletion_first_writer',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_exec('obf_deletion_first_deletion', 'set role service_role');
  perform public.dblink_exec('obf_deletion_first_writer', 'set role service_role');
  perform public.dblink_send_query(
    'obf_deletion_first_deletion',
    $query$select public.rehearsal_begin_service_writer_deletion(
      '00000000-0000-4000-8000-000000000004'::uuid
    )$query$
  );
  perform pg_catalog.pg_sleep(0.15);
  perform public.dblink_send_query(
    'obf_deletion_first_writer',
    $query$select public.enqueue_obf_contribution_for_correction(
      '10000000-0000-4000-8000-000000000004'::uuid
    )$query$
  );
  while public.dblink_is_busy('obf_deletion_first_deletion') = 1
     or public.dblink_is_busy('obf_deletion_first_writer') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_deletion
    from public.dblink_get_result('obf_deletion_first_deletion') as result(result text);
  select result into v_writer
    from public.dblink_get_result('obf_deletion_first_writer') as result(result jsonb);
  perform public.dblink_disconnect('obf_deletion_first_deletion');
  perform public.dblink_disconnect('obf_deletion_first_writer');
  if v_deletion <> 'deletion_started'
     or v_writer ->> 'outcome' <> 'account_deletion_in_progress'
     or (v_writer ->> 'enqueued')::boolean
     or exists (
       select 1 from public.obf_contribution_queue
        where user_id = '00000000-0000-4000-8000-000000000004'
     ) then
    raise exception 'REHEARSAL_OBF_DELETION_FIRST_FAILED';
  end if;
end;
$$;

-- Non-racing controls: values are derived from the correction, retries are
-- idempotent, ineligible/missing corrections do not enqueue, target expiry is
-- account-scoped, and the standalone global-expiry RPC remains available.
do $$
declare
  v_first jsonb;
  v_second jsonb;
  v_not_eligible jsonb;
  v_missing jsonb;
begin
  v_first := public.enqueue_obf_contribution_for_correction(
    '10000000-0000-4000-8000-000000000005'
  );
  v_second := public.enqueue_obf_contribution_for_correction(
    '10000000-0000-4000-8000-000000000005'
  );
  v_not_eligible := public.enqueue_obf_contribution_for_correction(
    '10000000-0000-4000-8000-000000000006'
  );
  v_missing := public.enqueue_obf_contribution_for_correction(
    '10000000-0000-4000-8000-ffffffffffff'
  );

  if v_first ->> 'outcome' <> 'enqueued'
     or v_second ->> 'outcome' <> 'already_enqueued'
     or v_not_eligible ->> 'outcome' <> 'correction_not_eligible'
     or v_missing ->> 'outcome' <> 'correction_missing'
     or (
       select count(*)
         from public.obf_contribution_queue
        where correction_id = '10000000-0000-4000-8000-000000000005'
     ) <> 1
     or not exists (
       select 1
         from public.obf_contribution_queue
        where correction_id = '10000000-0000-4000-8000-000000000005'
          and user_id = '00000000-0000-4000-8000-000000000005'
          and barcode = '000000000005'
          and payload = '{"productName":"derived control"}'::jsonb
          and status = 'held'
          and hold_reason = 'awaiting_source_review_and_moderation'
     ) then
    raise exception 'REHEARSAL_OBF_DERIVATION_OR_IDEMPOTENCE_FAILED';
  end if;

  perform public.rehearsal_try_reverse_trial(
    '00000000-0000-4000-8000-000000000005'
  );
  if not exists (
    select 1
      from public.entitlements
     where user_id = '00000000-0000-4000-8000-000000000006'
       and is_active
  ) then
    raise exception 'REHEARSAL_REVERSE_EXPIRY_WAS_NOT_SCOPED';
  end if;

  perform public.expire_app_granted_reverse_trials();
  if exists (
    select 1
      from public.entitlements
     where user_id = '00000000-0000-4000-8000-000000000006'
       and is_active
  ) then
    raise exception 'REHEARSAL_REVERSE_GLOBAL_EXPIRY_RPC_FAILED';
  end if;
end;
$$;

select 'SERVICE_WRITER_DELETION_BARRIERS_POSTGRES_REHEARSAL_PASS' as result;
