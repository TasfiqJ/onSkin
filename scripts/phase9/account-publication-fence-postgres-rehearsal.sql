\set ON_ERROR_STOP on

-- Disposable PostgreSQL 15/17 rehearsal for the real 0052 migration. The
-- setup is the minimum effective 0048 contract used by the migration.
create extension pgcrypto with schema public;
create extension dblink with schema public;

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit;

create schema auth;
create table auth.users (id uuid primary key);
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade
);

create schema storage;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner uuid,
  owner_id text
);

create table public.account_deletion_operations (
  id uuid primary key,
  user_id uuid not null unique,
  state text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (id, user_id)
);

create table public.account_deletion_barriers (
  user_id uuid primary key,
  operation_id uuid not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (operation_id, user_id)
    references public.account_deletion_operations (id, user_id) on delete cascade
);

create table public.account_deletion_steps (
  operation_id uuid not null
    references public.account_deletion_operations (id) on delete cascade,
  step_name text not null,
  step_order smallint not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts smallint not null default 12,
  next_attempt_at timestamptz,
  lease_kind text,
  claim_digest text,
  lease_expires_at timestamptz,
  request_started_at timestamptz,
  completed_at timestamptz,
  result_code text,
  encrypted_payload bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (operation_id, step_name),
  unique (operation_id, step_order)
);

create table public.edge_rate_limits (
  scope text not null check (scope ~ '^[a-z0-9_-]{1,64}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  owner_user_id uuid references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds between 60 and 86400),
  request_count integer not null default 1,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start),
  constraint edge_rate_limits_scope_owner_classification check (
    (
      scope in (
        'account-deletion-intake', 'catalog-lookup', 'catalog-search', 'data-export'
      )
      and owner_user_id is not null
    )
    or (
      scope in ('account-deletion-status', 'growth-event', 'waitlist')
      and owner_user_id is null
    )
  ),
  constraint edge_rate_limits_deterministic_expiry check (
    pg_catalog.isfinite(expires_at)
    and expires_at = window_start + pg_catalog.make_interval(
      secs => greatest(window_seconds * 4, 3600)
    )
  )
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

create function public._account_deletion_token_digest(p_context text, p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    public.digest(pg_catalog.convert_to(p_context || p_token, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create function public._account_deletion_claim_digest(p_claim_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public._account_deletion_token_digest(
    'onskin-account-deletion-worker-claim:v1:', p_claim_token
  );
$$;

create function public._refresh_account_deletion_operation(
  p_operation_id uuid,
  p_now timestamptz
)
returns void
language sql
security definer
set search_path = ''
as $$ select null::void $$;

create function public._account_photo_storage_object_owned(
  p_user_id uuid,
  p_object_name text,
  p_owner text,
  p_owner_id text
)
returns boolean
language sql
immutable
set search_path = ''
as $$ select false $$;

create function public._revenuecat_identity_tombstone_advisory_key(
  p_hmac_key_version smallint,
  p_identity_hmac text
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.hashtextextended(
    'rehearsal-revenuecat:' || p_hmac_key_version::text || ':' || p_identity_hmac,
    732841906512317::bigint
  );
$$;

create function public._revenuecat_embedded_account_uuids(p_value text)
returns uuid[]
language sql
immutable
set search_path = ''
as $$ select '{}'::uuid[] $$;

create function public.establish_revenuecat_deletion_identity_barrier(
  p_operation_id uuid,
  p_claim_token text,
  p_identity_hmac_key_version smallint,
  p_identity_hmacs text[],
  p_raw_identities text[],
  p_expires_at timestamptz
)
returns table (established boolean, tombstone_version smallint, identity_count integer)
language sql
security definer
set search_path = ''
as $$
  select true, 1::smallint, pg_catalog.cardinality(p_identity_hmacs)
$$;

create function public.scrub_account_service_rows(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select jsonb_build_object('scrubbed', true) $$;

-- Minimal migration-0048 entry points used to prove that 0052 retires every
-- user-only authenticated boundary without editing the applied migration.
create function public.get_account_deletion_barrier_state(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (select 1 from auth.users as users where users.id = p_user_id) then
    raise exception 'ACCOUNT_DELETION_PREFLIGHT_AUTH_SUBJECT_ABSENT'
      using errcode = '42501';
  end if;
  if exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    return 'active';
  end if;
  return 'clear';
end;
$$;

create function public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_owner_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_expires_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_owner_user_id)
  );
  if not exists (
    select 1 from auth.users as users where users.id = p_owner_user_id
  ) then
    raise exception 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_NOT_ACTIVE' using errcode = '42501';
  end if;
  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_start + pg_catalog.make_interval(
    secs => greatest(p_window_seconds * 4, 3600)
  );
  insert into public.edge_rate_limits as limits (
    scope, key_hash, owner_user_id, window_start, window_seconds,
    request_count, expires_at, created_at, updated_at
  ) values (
    p_scope, p_key_hash, p_owner_user_id, v_window_start, p_window_seconds,
    1, v_expires_at, v_now, v_now
  )
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = limits.request_count + 1,
    updated_at = v_now
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;

create function public.purge_expired_edge_rate_limits(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  with candidates as (
    select limits.scope, limits.key_hash, limits.window_start
      from public.edge_rate_limits as limits
     where limits.expires_at <= clock_timestamp()
     order by limits.expires_at, limits.scope, limits.key_hash, limits.window_start
     limit p_limit
     for update skip locked
  ), deleted as (
    delete from public.edge_rate_limits as limits
     using candidates
     where limits.scope = candidates.scope
       and limits.key_hash = candidates.key_hash
       and limits.window_start = candidates.window_start
    returning 1
  )
  select count(*)::integer into v_deleted from deleted;
  return v_deleted;
end;
$$;

create function public.begin_account_deletion(
  p_user_id uuid,
  p_idempotency_key text,
  p_capability text,
  p_operation_expires_at timestamptz,
  p_apple_encrypted_credential bytea,
  p_revenuecat_encrypted_reconciliation bytea,
  p_posthog_encrypted_reconciliation bytea
)
returns table (
  operation_id uuid,
  operation_state text,
  operation_expires_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_operation_id uuid := gen_random_uuid();
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (select 1 from auth.users as users where users.id = p_user_id) then
    raise exception 'ACCOUNT_DELETION_USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.account_deletion_operations (
    id, user_id, expires_at
  ) values (
    v_operation_id, p_user_id, p_operation_expires_at
  );
  insert into public.account_deletion_barriers (
    user_id, operation_id, expires_at
  ) values (
    p_user_id, v_operation_id, p_operation_expires_at
  );
  insert into public.account_deletion_steps (
    operation_id, step_name, step_order, encrypted_payload
  ) values
    (v_operation_id, 'apple_revoke', 10, p_apple_encrypted_credential),
    (v_operation_id, 'revenuecat_delete', 20, p_revenuecat_encrypted_reconciliation),
    (v_operation_id, 'posthog_delete', 30, p_posthog_encrypted_reconciliation),
    (v_operation_id, 'photo_storage_delete', 40, null),
    (v_operation_id, 'service_rows_scrub', 50, null),
    (v_operation_id, 'auth_user_delete', 60, null);
  return query select v_operation_id, 'pending'::text, p_operation_expires_at, true;
end;
$$;

\ir ../../supabase/migrations/20260713000052_account_publication_fence.sql

-- The install assertion is the same code invoked after ACCESS EXCLUSIVE locks.
do $$
begin
  perform public._assert_account_publication_fence_installable();
  insert into public.account_deletion_operations (id, user_id, expires_at)
  values (
    'f0000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    clock_timestamp() + interval '1 day'
  );
  begin
    perform public._assert_account_publication_fence_installable();
    raise exception 'REHEARSAL_ZERO_ACTIVE_PRECONDITION_BYPASSED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_PUBLICATION_FENCE_REQUIRES_ZERO_ACTIVE_DELETIONS' then
        raise;
      end if;
  end;
  delete from public.account_deletion_operations
   where id = 'f0000000-0000-4000-8000-000000000001';
end;
$$;

-- Auth can invalidate the exact JWT session after Edge resolves its user. The
-- session-bound rate, preflight, and begin RPCs must all reject that race with
-- one classifiable SQL contract before any durable or rate-limit write.
insert into auth.users (id) values
  ('e0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002');
insert into auth.sessions (id, user_id) values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002');
delete from auth.sessions
 where id = 'e1000000-0000-4000-8000-000000000001';

set role service_role;
do $$
begin
  begin
    perform public.consume_edge_rate_limit(
      'account-deletion-intake', repeat('c', 64), 5, 600,
      'e0000000-0000-4000-8000-000000000001'
    );
    raise exception 'REHEARSAL_LEGACY_INTAKE_RATE_SIGNATURE_ALLOWED';
  exception
    when invalid_authorization_specification then
      if sqlerrm <> 'ACCOUNT_DELETION_SESSION_REJECTED' then raise; end if;
  end;
  begin
    perform public.consume_edge_rate_limit(
      'account-deletion-intake', repeat('c', 64), 5, 600,
      'e0000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001'
    );
    raise exception 'REHEARSAL_SIGNED_OUT_SESSION_RATE_WRITE_ALLOWED';
  exception
    when invalid_authorization_specification then
      if sqlerrm <> 'ACCOUNT_DELETION_SESSION_REJECTED' then raise; end if;
  end;
  begin
    perform public.get_account_deletion_barrier_state(
      'e0000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000002'
    );
    raise exception 'REHEARSAL_MISMATCHED_SESSION_PREFLIGHT_ALLOWED';
  exception
    when invalid_authorization_specification then
      if sqlerrm <> 'ACCOUNT_DELETION_SESSION_REJECTED' then raise; end if;
  end;
  begin
    perform * from public.begin_account_deletion(
      'e0000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',
      repeat('a', 64), repeat('b', 64),
      clock_timestamp() + interval '1 day', null, null, null
    );
    raise exception 'REHEARSAL_SIGNED_OUT_SESSION_BEGIN_ALLOWED';
  exception
    when invalid_authorization_specification then
      if sqlerrm <> 'ACCOUNT_DELETION_SESSION_REJECTED' then raise; end if;
  end;
end;
$$;
reset role;

do $$
begin
  if exists (
       select 1 from public.edge_rate_limits
        where owner_user_id = 'e0000000-0000-4000-8000-000000000001'
     )
     or exists (
       select 1 from public.account_deletion_operations
        where user_id = 'e0000000-0000-4000-8000-000000000001'
     )
     or exists (
       select 1 from public.account_deletion_barriers
        where user_id = 'e0000000-0000-4000-8000-000000000001'
     ) then
    raise exception 'REHEARSAL_REJECTED_SESSION_LEFT_DURABLE_STATE';
  end if;
  if pg_catalog.to_regprocedure(
       'public.begin_account_deletion(uuid,text,text,timestamptz,bytea,bytea,bytea)'
     ) is not null
     or pg_catalog.to_regprocedure(
       'public.get_account_deletion_barrier_state(uuid)'
     ) is not null then
    raise exception 'REHEARSAL_UNBOUND_SESSION_RPC_REMAINS';
  end if;
end;
$$;

insert into auth.sessions (id, user_id) values (
  'e1000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001'
);
set role service_role;
do $$
declare
  v_clear text;
  v_allowed boolean;
  v_created boolean;
begin
  select public.get_account_deletion_barrier_state(
    'e0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001'
  ) into v_clear;
  if v_clear <> 'clear' then
    raise exception 'REHEARSAL_LIVE_SESSION_PREFLIGHT_FAILED';
  end if;
  select public.consume_edge_rate_limit(
    'account-deletion-intake', repeat('c', 64), 5, 600,
    'e0000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001'
  ) into v_allowed;
  if not v_allowed then
    raise exception 'REHEARSAL_LIVE_SESSION_RATE_FAILED';
  end if;
  select created into v_created
    from public.begin_account_deletion(
      'e0000000-0000-4000-8000-000000000001',
      'e1000000-0000-4000-8000-000000000001',
      repeat('a', 64), repeat('b', 64),
      clock_timestamp() + interval '1 day', null, null, null
    );
  if not v_created then
    raise exception 'REHEARSAL_LIVE_SESSION_BEGIN_FAILED';
  end if;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.edge_rate_limits
       where owner_user_id = 'e0000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from public.account_deletion_operations
          where user_id = 'e0000000-0000-4000-8000-000000000001') <> 1
     or (select count(*) from public.account_deletion_barriers
          where user_id = 'e0000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'REHEARSAL_LIVE_SESSION_ATOMIC_STATE_FAILED';
  end if;
end;
$$;
delete from public.account_deletion_operations
 where user_id = 'e0000000-0000-4000-8000-000000000001';
delete from public.edge_rate_limits
 where owner_user_id = 'e0000000-0000-4000-8000-000000000001';
delete from auth.users
 where id in (
   'e0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000002'
 );


-- Lost capabilities expire at their frozen authority deadlines. One bounded
-- reaper candidate must still derive drain completion from every expired
-- draining row, including an unequal later deadline not yet closed.
insert into auth.users (id) values ('40000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001');
set role service_role;
do $$
declare v_status text;
begin
  select status into v_status from public.reserve_account_publication_lease(
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001', repeat('6', 64)
  );
  select status into v_status from public.activate_account_publication_lease(
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001', repeat('6', 64)
  );
  select status into v_status from public.reserve_account_publication_lease(
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000002', repeat('7', 64)
  );
  select status into v_status from public.activate_account_publication_lease(
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000002', repeat('7', 64)
  );
  if v_status <> 'active' then raise exception 'REHEARSAL_EXPIRY_ACTIVATION_FAILED'; end if;
end;
$$;
reset role;

insert into public.account_deletion_operations (id, user_id, expires_at)
values (
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 day'
);
insert into public.account_deletion_barriers (user_id, operation_id, expires_at)
values (
  '40000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 day'
);

do $$
declare v_now timestamptz := clock_timestamp();
begin
  update public.account_deletion_operations
     set publication_drain_started_at = v_now - interval '40 seconds',
         publication_drained_at = null,
         publication_settle_not_before = null
   where id = '42000000-0000-4000-8000-000000000001';
  update public.account_publication_leases
     set reserved_at = v_now - interval '120 seconds',
         activated_at = case capability_digest
           when public._account_publication_capability_digest(repeat('6', 64))
             then v_now - interval '70 seconds'
           else v_now - interval '61 seconds'
         end,
         renewed_at = null,
         expires_at = case capability_digest
           when public._account_publication_capability_digest(repeat('6', 64))
             then v_now - interval '10 seconds'
           else v_now - interval '1 second'
         end,
         drain_started_at = v_now - interval '40 seconds',
         updated_at = v_now
   where drain_operation_id = '42000000-0000-4000-8000-000000000001';
end;
$$;

create temporary table rehearsal_expected_publication_drain (
  operation_id uuid primary key,
  expected_drained_at timestamptz not null
);
insert into rehearsal_expected_publication_drain
select '42000000-0000-4000-8000-000000000001'::uuid, max(expires_at)
  from public.account_publication_leases
 where drain_operation_id = '42000000-0000-4000-8000-000000000001';

set role service_role;
do $$
declare
  v_closed integer;
  v_drained integer;
  v_purged integer;
begin
  select leases_closed, operations_drained, leases_purged
    into v_closed, v_drained, v_purged
    from public.reap_expired_account_publication_leases(1);
  if v_closed <> 2 or v_drained <> 1 or v_purged <> 0 then
    raise exception 'REHEARSAL_FIRST_BOUNDED_REAP_FAILED: %, %, %',
      v_closed, v_drained, v_purged;
  end if;
end;
$$;
reset role;

do $$
declare
  v_later_expiry timestamptz;
  v_operation public.account_deletion_operations%rowtype;
begin
  select expected_drained_at into v_later_expiry
    from rehearsal_expected_publication_drain
   where operation_id = '42000000-0000-4000-8000-000000000001';
  select * into v_operation from public.account_deletion_operations
   where id = '42000000-0000-4000-8000-000000000001';
  if v_operation.publication_drained_at is distinct from v_later_expiry
     or v_operation.publication_settle_not_before
          is distinct from v_later_expiry + interval '5 minutes'
     or exists (
       select 1 from public.account_publication_leases
        where drain_operation_id = v_operation.id
     ) then
    raise exception 'REHEARSAL_UNEQUAL_EXPIRY_DRAIN_MATH_FAILED';
  end if;
end;
$$;

-- An expired unattached reservation is purged, never retained as a closed
-- row carrying raw account/session UUIDs.
insert into auth.users (id) values ('50000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id) values (
  '51000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001'
);
set role service_role;
select * from public.reserve_account_publication_lease(
  '50000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001', repeat('8', 64)
);
reset role;
do $$
declare v_now timestamptz := clock_timestamp();
begin
  update public.account_publication_leases
     set reserved_at = v_now - interval '31 seconds',
         expires_at = v_now - interval '1 second',
         updated_at = v_now
   where capability_digest
           = public._account_publication_capability_digest(repeat('8', 64));
end;
$$;
set role service_role;
select * from public.reap_expired_account_publication_leases(1);
reset role;
do $$
begin
  if exists (
    select 1 from public.account_publication_leases
     where user_id = '50000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'REHEARSAL_EXPIRED_UNATTACHED_IDENTITY_RETAINED';
  end if;
end;
$$;

-- Exact Auth session ownership, eight-live cap, idempotent reserve, activation
-- refresh, and immediate minimization of unattached releases.
insert into auth.users (id) values ('10000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id)
select ('11000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
       '10000000-0000-4000-8000-000000000001'::uuid
  from generate_series(1, 9) as series;

create function public.rehearsal_publication_lease_was_renewed(p_capability text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_publication_leases as leases
     where leases.capability_digest
             = public._account_publication_capability_digest(p_capability)
       and leases.renewed_at is not null
  );
$$;
revoke all on function public.rehearsal_publication_lease_was_renewed(text)
  from public, anon, authenticated;
grant execute on function public.rehearsal_publication_lease_was_renewed(text)
  to service_role;

set role service_role;
do $$
declare
  v_status text;
  v_series integer;
begin
  select status into v_status
    from public.reserve_account_publication_lease(
      '10000000-0000-4000-8000-000000000001',
      '21000000-0000-4000-8000-000000000001',
      repeat('f', 64)
    );
  if v_status <> 'session_rejected' then
    raise exception 'REHEARSAL_STALE_SESSION_ACCEPTED';
  end if;

  for v_series in 1..8 loop
    select status into v_status
      from public.reserve_account_publication_lease(
        '10000000-0000-4000-8000-000000000001',
        ('11000000-0000-4000-8000-' || lpad(v_series::text, 12, '0'))::uuid,
        lpad(to_hex(v_series), 64, '0')
      );
    if v_status <> 'reserved' then
      raise exception 'REHEARSAL_LIVE_CAP_RESERVE_FAILED: %', v_series;
    end if;
  end loop;
  select status into v_status
    from public.reserve_account_publication_lease(
      '10000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000009',
      repeat('e', 64)
    );
  if v_status <> 'lease_rejected' then
    raise exception 'REHEARSAL_MAX_EIGHT_LIVE_BYPASSED';
  end if;

  select status into v_status
    from public.reserve_account_publication_lease(
      '10000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001',
      lpad(to_hex(1), 64, '0')
    );
  if v_status <> 'reserved' then
    raise exception 'REHEARSAL_IDEMPOTENT_RESERVE_FAILED';
  end if;
  select status into v_status
    from public.activate_account_publication_lease(
      '10000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001',
      lpad(to_hex(1), 64, '0')
    );
  perform pg_catalog.pg_sleep(0.01);
  select status into v_status
    from public.activate_account_publication_lease(
      '10000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001',
      lpad(to_hex(1), 64, '0')
    );
  if v_status <> 'active'
     or not public.rehearsal_publication_lease_was_renewed(lpad(to_hex(1), 64, '0')) then
    raise exception 'REHEARSAL_IDEMPOTENT_ACTIVATE_DID_NOT_REFRESH';
  end if;

  for v_series in 1..8 loop
    select status into v_status
      from public.release_account_publication_lease(lpad(to_hex(v_series), 64, '0'));
    if v_status <> 'released' then
      raise exception 'REHEARSAL_RELEASE_STATUS_FAILED';
    end if;
  end loop;
  select status into v_status
    from public.release_account_publication_lease(repeat('d', 64));
  if v_status <> 'released' then
    raise exception 'REHEARSAL_NONENUMERATING_RELEASE_FAILED';
  end if;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1 from public.account_publication_leases
     where user_id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'REHEARSAL_UNATTACHED_RELEASE_RETAINED_IDENTITY';
  end if;
end;
$$;

do $$
declare
  v_name text;
begin
  if not exists (
       select 1 from pg_catalog.pg_class
        where oid = 'public.account_publication_leases'::regclass
          and relrowsecurity and relforcerowsecurity
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.account_publication_leases', 'SELECT'
     ) then
    raise exception 'REHEARSAL_PUBLICATION_LEASE_RLS_ACL_FAILED';
  end if;
  foreach v_name in array array[
    'public.begin_account_deletion(uuid,uuid,text,text,timestamptz,bytea,bytea,bytea)',
    'public.get_account_deletion_barrier_state(uuid,uuid)',
    'public.consume_edge_rate_limit(text,text,integer,integer,uuid)',
    'public.consume_edge_rate_limit(text,text,integer,integer,uuid,uuid)',
    'public.reserve_account_publication_lease(uuid,uuid,text)',
    'public.activate_account_publication_lease(uuid,uuid,text)',
    'public.renew_account_publication_lease(uuid,uuid,text)',
    'public.release_account_publication_lease(text)',
    'public.record_account_deletion_revenuecat_absence_observation(uuid,text,text)',
    'public.reset_account_deletion_revenuecat_absence_observations(uuid,text,text)',
    'public.reap_expired_account_publication_leases(integer)'
  ] loop
    if not pg_catalog.has_function_privilege('service_role', v_name, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_name, 'EXECUTE')
       or pg_catalog.has_function_privilege('anon', v_name, 'EXECUTE') then
      raise exception 'REHEARSAL_PUBLICATION_RPC_ACL_FAILED: %', v_name;
    end if;
  end loop;
end;
$$;

set role service_role;
do $$
begin
  begin
    perform 1 from public.account_publication_leases limit 1;
    raise exception 'REHEARSAL_SERVICE_ROLE_DIRECT_LEASE_READ_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

create function public.rehearsal_begin_deletion_with_delay(
  p_user_id uuid,
  p_operation_id uuid,
  p_delay_seconds double precision
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  insert into public.account_deletion_operations (id, user_id, expires_at)
  values (p_operation_id, p_user_id, clock_timestamp() + interval '1 day');
  insert into public.account_deletion_barriers (user_id, operation_id, expires_at)
  values (p_user_id, p_operation_id, clock_timestamp() + interval '1 day');
  perform pg_catalog.pg_sleep(p_delay_seconds);
  return 'inserted';
end;
$$;

-- Reserve/delete/activate race: activation waits behind the same account lock,
-- then observes the committed barrier. The unactivated reservation is deleted.
insert into auth.users (id) values ('20000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id) values (
  '21000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001'
);
set role service_role;
do $$
declare v_status text;
begin
  select status into v_status
    from public.reserve_account_publication_lease(
      '20000000-0000-4000-8000-000000000001',
      '21000000-0000-4000-8000-000000000001',
      repeat('2', 64)
    );
  if v_status <> 'reserved' then
    raise exception 'REHEARSAL_RACE_RESERVATION_FAILED';
  end if;
end;
$$;
reset role;

do $$
declare
  v_key bigint := public._account_deletion_advisory_key(
    '20000000-0000-4000-8000-000000000001'
  );
  v_seen boolean := false;
  v_attempt integer;
  v_status text;
  v_result text;
begin
  perform public.dblink_connect(
    'publication_begin_race',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_send_query(
    'publication_begin_race',
    $query$
      select public.rehearsal_begin_deletion_with_delay(
        '20000000-0000-4000-8000-000000000001',
        '22000000-0000-4000-8000-000000000001',
        0.5
      )
    $query$
  );
  for v_attempt in 1..200 loop
    select exists (
      select 1 from pg_catalog.pg_locks as locks
       where locks.pid <> pg_catalog.pg_backend_pid()
         and locks.locktype = 'advisory'
         and locks.mode = 'ExclusiveLock'
         and locks.granted
         and locks.objsubid = 1
         and locks.classid::bigint = ((v_key >> 32) & 4294967295::bigint)
         and locks.objid::bigint = (v_key & 4294967295::bigint)
    ) into v_seen;
    exit when v_seen;
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  if not v_seen then
    raise exception 'REHEARSAL_RACE_LOCK_NOT_OBSERVED';
  end if;

  select status into v_status
    from public.activate_account_publication_lease(
      '20000000-0000-4000-8000-000000000001',
      '21000000-0000-4000-8000-000000000001',
      repeat('2', 64)
    );
  while public.dblink_is_busy('publication_begin_race') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_result
    from public.dblink_get_result('publication_begin_race') as result(result text);
  perform public.dblink_disconnect('publication_begin_race');
  if v_status <> 'blocked' or v_result <> 'inserted' then
    raise exception 'REHEARSAL_RESERVE_DELETE_ACTIVATE_RACE_FAILED';
  end if;
end;
$$;

do $$
begin
  if exists (
       select 1 from public.account_publication_leases
        where user_id = '20000000-0000-4000-8000-000000000001'
     )
     or not exists (
       select 1 from public.account_deletion_operations
        where id = '22000000-0000-4000-8000-000000000001'
          and publication_drained_at is not null
          and publication_settle_not_before
                = publication_drained_at + interval '5 minutes'
     ) then
    raise exception 'REHEARSAL_RESERVATION_CANCEL_OR_EMPTY_DRAIN_FAILED';
  end if;
  delete from public.account_deletion_operations
   where id = '22000000-0000-4000-8000-000000000001';
end;
$$;

-- Multi-device active authority drains without deadline extension. Local
-- erasure waits for drain but not the RevenueCat settling interval. Capability
-- release remains available after Auth/session cascade.
insert into auth.users (id) values ('30000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001');

set role service_role;
do $$
declare v_status text;
begin
  select status into v_status from public.reserve_account_publication_lease(
    '30000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001', repeat('a', 64)
  );
  if v_status <> 'reserved' then raise exception 'REHEARSAL_DEVICE_A_RESERVE_FAILED'; end if;
  select status into v_status from public.activate_account_publication_lease(
    '30000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001', repeat('a', 64)
  );
  if v_status <> 'active' then raise exception 'REHEARSAL_DEVICE_A_ACTIVATE_FAILED'; end if;
  select status into v_status from public.reserve_account_publication_lease(
    '30000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000002', repeat('b', 64)
  );
  if v_status <> 'reserved' then raise exception 'REHEARSAL_DEVICE_B_RESERVE_FAILED'; end if;
  select status into v_status from public.activate_account_publication_lease(
    '30000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000002', repeat('b', 64)
  );
  if v_status <> 'active' then raise exception 'REHEARSAL_DEVICE_B_ACTIVATE_FAILED'; end if;
end;
$$;
reset role;

insert into public.account_deletion_operations (id, user_id, expires_at)
values (
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 day'
);
insert into public.account_deletion_barriers (user_id, operation_id, expires_at)
values (
  '30000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 day'
);
insert into public.account_deletion_steps (
  operation_id, step_name, step_order, status, completed_at, result_code
) values
  ('32000000-0000-4000-8000-000000000001', 'apple_revoke', 10,
   'succeeded', clock_timestamp(), 'APPLE_NOT_LINKED'),
  ('32000000-0000-4000-8000-000000000001', 'revenuecat_delete', 20,
   'pending', null, null),
  ('32000000-0000-4000-8000-000000000001', 'posthog_delete', 30,
   'pending', null, null),
  ('32000000-0000-4000-8000-000000000001', 'photo_storage_delete', 40,
   'pending', null, null),
  ('32000000-0000-4000-8000-000000000001', 'service_rows_scrub', 50,
   'pending', null, null),
  ('32000000-0000-4000-8000-000000000001', 'auth_user_delete', 60,
   'pending', null, null);

do $$
declare v_step text;
begin
  if (select count(*) from public.account_publication_leases
       where drain_operation_id = '32000000-0000-4000-8000-000000000001'
         and state = 'draining') <> 2
     or exists (
       select 1 from public.account_deletion_operations
        where id = '32000000-0000-4000-8000-000000000001'
          and publication_drained_at is not null
     ) then
    raise exception 'REHEARSAL_MULTI_DEVICE_DRAIN_START_FAILED';
  end if;
  select step_name into v_step
    from public._account_deletion_claimable_step(
      '32000000-0000-4000-8000-000000000001', 'dispatch', clock_timestamp()
    );
  if v_step is not null then
    raise exception 'REHEARSAL_LOCAL_ERASURE_STARTED_BEFORE_DRAIN: %', v_step;
  end if;
  begin
    update public.account_deletion_steps
       set status = 'leased', lease_kind = 'dispatch',
           claim_digest = public._account_deletion_claim_digest(repeat('1', 64)),
           lease_expires_at = clock_timestamp() + interval '2 minutes'
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'photo_storage_delete';
    raise exception 'REHEARSAL_DIRECT_LOCAL_DRAIN_BYPASS_ALLOWED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_DELETION_LOCAL_ERASURE_PUBLICATION_NOT_DRAINED' then raise; end if;
  end;
end;
$$;

set role service_role;
do $$
declare
  v_status text;
begin
  select status into v_status from public.renew_account_publication_lease(
    '30000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001', repeat('a', 64)
  );
  if v_status <> 'blocked' then raise exception 'REHEARSAL_DRAIN_RENEW_NOT_BLOCKED'; end if;
  begin
    perform public.scrub_account_service_rows(
      '30000000-0000-4000-8000-000000000001'
    );
    raise exception 'REHEARSAL_DIRECT_SERVICE_SCRUB_DURING_DRAIN_ALLOWED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_DELETION_LOCAL_ERASURE_PUBLICATION_NOT_DRAINED' then raise; end if;
  end;
end;
$$;
reset role;

delete from auth.users where id = '30000000-0000-4000-8000-000000000001';

set role service_role;
do $$
declare v_status text;
begin
  select status into v_status
    from public.release_account_publication_lease(repeat('a', 64));
  if v_status <> 'released' then raise exception 'REHEARSAL_POST_AUTH_RELEASE_A_FAILED'; end if;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1 from public.account_deletion_operations
     where id = '32000000-0000-4000-8000-000000000001'
       and publication_drained_at is not null
  ) then
    raise exception 'REHEARSAL_DRAIN_SETTLED_WITH_LIVE_DEVICE';
  end if;
end;
$$;

set role service_role;
select * from public.release_account_publication_lease(repeat('b', 64));
reset role;

do $$
declare
  v_step text;
  v_operation public.account_deletion_operations%rowtype;
begin
  select * into v_operation from public.account_deletion_operations
   where id = '32000000-0000-4000-8000-000000000001';
  if v_operation.publication_drained_at is null
     or v_operation.publication_settle_not_before
          is distinct from v_operation.publication_drained_at + interval '5 minutes'
     or exists (
       select 1 from public.account_publication_leases
        where drain_operation_id = v_operation.id
     ) then
    raise exception 'REHEARSAL_MULTI_DEVICE_EXACT_DRAIN_FAILED';
  end if;
  select step_name into v_step
    from public._account_deletion_claimable_step(
      v_operation.id, 'dispatch', clock_timestamp()
    );
  if v_step <> 'photo_storage_delete' then
    raise exception 'REHEARSAL_LOCAL_DID_NOT_BYPASS_SETTLE: %', v_step;
  end if;
end;
$$;

set role service_role;
do $$
declare v_result jsonb;
begin
  v_result := public.scrub_account_service_rows(
    '30000000-0000-4000-8000-000000000001'
  );
  if v_result <> '{"scrubbed":true}'::jsonb then
    raise exception 'REHEARSAL_SERVICE_SCRUB_AFTER_DRAIN_FAILED';
  end if;
end;
$$;
reset role;

do $$
declare
  v_now timestamptz := clock_timestamp();
begin
  begin
    update public.account_deletion_steps
       set status = 'leased',
           lease_kind = 'reconcile',
           claim_digest = public._account_deletion_claim_digest(repeat('3', 64)),
           lease_expires_at = clock_timestamp() + interval '2 minutes',
           request_started_at = clock_timestamp() - interval '1 minute'
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'revenuecat_delete';
    raise exception 'REHEARSAL_REVENUECAT_SETTLE_BYPASS_ALLOWED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_DELETION_REVENUECAT_PUBLICATION_NOT_SETTLED' then raise; end if;
  end;

  update public.account_deletion_operations
     set publication_drain_started_at = v_now - interval '8 minutes',
         publication_drained_at = v_now - interval '7 minutes',
         publication_settle_not_before = v_now - interval '2 minutes'
   where id = '32000000-0000-4000-8000-000000000001';
  update public.account_deletion_steps
     set status = 'leased',
         lease_kind = 'reconcile',
         claim_digest = public._account_deletion_claim_digest(repeat('3', 64)),
         lease_expires_at = clock_timestamp() + interval '5 minutes',
         request_started_at = clock_timestamp() - interval '10 minutes'
   where operation_id = '32000000-0000-4000-8000-000000000001'
     and step_name = 'revenuecat_delete';
end;
$$;

set role service_role;
do $$
declare
  v_confirmed boolean;
  v_count smallint;
begin
  select confirmed, observation_count into v_confirmed, v_count
    from public.record_account_deletion_revenuecat_absence_observation(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete',
      repeat('3', 64)
    );
  if v_confirmed or v_count <> 1 then
    raise exception 'REHEARSAL_FIRST_ABSENCE_OBSERVATION_FAILED';
  end if;
end;
$$;
reset role;

update public.account_deletion_operations
   set revenuecat_absence_first_observed_at = clock_timestamp() - interval '61 seconds'
 where id = '32000000-0000-4000-8000-000000000001';

-- More than 60 seconds is insufficient under the same live claim token.
set role service_role;
do $$
declare
  v_confirmed boolean;
  v_count smallint;
begin
  select confirmed, observation_count into v_confirmed, v_count
    from public.record_account_deletion_revenuecat_absence_observation(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete',
      repeat('3', 64)
    );
  if v_confirmed or v_count <> 1 then
    raise exception 'REHEARSAL_SAME_CLAIM_ADVANCED_OBSERVATION';
  end if;
  begin
    perform * from public.record_account_deletion_step(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete', repeat('3', 64), 'succeeded',
      'REVENUECAT_V2_DELETION_VERIFIED', null
    );
    raise exception 'REHEARSAL_ONE_OBSERVATION_TERMINAL_BYPASS_ALLOWED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_DELETION_REVENUECAT_ABSENCE_NOT_CONFIRMED' then raise; end if;
  end;
end;
$$;
reset role;

-- A held account lock crossing a legacy mutation's captured expiry is rejected
-- by the post-lock step transition invariant shared by claim/mark/payload RPCs.
create function public.rehearsal_hold_account_lock_final(
  p_user_id uuid,
  p_delay_seconds double precision
)
returns text language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform pg_catalog.pg_sleep(p_delay_seconds);
  return 'held';
end;
$$;
create function public.rehearsal_stale_mark_final(
  p_operation_id uuid,
  p_user_id uuid
)
returns void language plpgsql set search_path = '' as $$
declare v_stale_now timestamptz := clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  update public.account_deletion_steps
     set status = 'request_started', request_started_at = v_stale_now
   where operation_id = p_operation_id
     and step_name = 'photo_storage_delete'
     and status = 'leased'
     and lease_expires_at > v_stale_now;
end;
$$;
update public.account_deletion_steps
   set status = 'leased', lease_kind = 'dispatch',
       claim_digest = public._account_deletion_claim_digest(repeat('9', 64)),
       lease_expires_at = clock_timestamp() + interval '500 milliseconds',
       request_started_at = null
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'photo_storage_delete';
do $$
declare
  v_key bigint := public._account_deletion_advisory_key(
    '30000000-0000-4000-8000-000000000001'
  );
  v_seen boolean := false;
  v_attempt integer;
  v_result text;
begin
  perform public.dblink_connect(
    'publication_stale_mark_final',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_send_query(
    'publication_stale_mark_final',
    $query$select public.rehearsal_hold_account_lock_final(
      '30000000-0000-4000-8000-000000000001', 0.8
    )$query$
  );
  for v_attempt in 1..200 loop
    select exists (
      select 1 from pg_catalog.pg_locks as locks
       where locks.pid <> pg_catalog.pg_backend_pid()
         and locks.locktype = 'advisory' and locks.mode = 'ExclusiveLock'
         and locks.granted and locks.objsubid = 1
         and locks.classid::bigint = ((v_key >> 32) & 4294967295::bigint)
         and locks.objid::bigint = (v_key & 4294967295::bigint)
    ) into v_seen;
    exit when v_seen;
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  if not v_seen then raise exception 'REHEARSAL_STALE_MARK_LOCK_NOT_SEEN'; end if;
  begin
    perform public.rehearsal_stale_mark_final(
      '32000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    );
    raise exception 'REHEARSAL_STALE_MARK_CROSSED_EXPIRY';
  exception when serialization_failure then
    if sqlerrm <> 'ACCOUNT_DELETION_LEASE_EXPIRED_AT_MUTATION' then raise; end if;
  end;
  while public.dblink_is_busy('publication_stale_mark_final') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_result
    from public.dblink_get_result('publication_stale_mark_final') as result(result text);
  perform public.dblink_disconnect('publication_stale_mark_final');
  if v_result <> 'held' then raise exception 'REHEARSAL_STALE_MARK_HOLDER_FAILED'; end if;
  begin
    update public.account_deletion_steps set encrypted_payload = decode('01', 'hex')
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'photo_storage_delete';
    raise exception 'REHEARSAL_STALE_PAYLOAD_CROSSED_EXPIRY';
  exception when serialization_failure then
    if sqlerrm <> 'ACCOUNT_DELETION_LEASE_EXPIRED_AT_MUTATION' then raise; end if;
  end;
  update public.account_deletion_steps
     set status = 'pending', lease_kind = null, claim_digest = null,
         lease_expires_at = null, request_started_at = null
   where operation_id = '32000000-0000-4000-8000-000000000001'
     and step_name = 'photo_storage_delete';
  begin
    update public.account_deletion_steps
       set status = 'leased', lease_kind = 'dispatch',
           claim_digest = public._account_deletion_claim_digest(repeat('9', 64)),
           lease_expires_at = clock_timestamp() - interval '1 second'
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'photo_storage_delete';
    raise exception 'REHEARSAL_STALE_CLAIM_RETURNED_EXPIRED_LEASE';
  exception when serialization_failure then
    if sqlerrm <> 'ACCOUNT_DELETION_LEASE_EXPIRED_AT_MUTATION' then raise; end if;
  end;
end;
$$;

-- The 0051 wrapper refreshes its clock after all account and HMAC locks.
create function public.rehearsal_hold_identity_lock_final(
  p_hmac text,
  p_delay_seconds double precision
)
returns text language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._revenuecat_identity_tombstone_advisory_key(1::smallint, p_hmac)
  );
  perform pg_catalog.pg_sleep(p_delay_seconds);
  return 'held';
end;
$$;
update public.account_deletion_steps
   set status = 'leased', lease_kind = 'dispatch',
       claim_digest = public._account_deletion_claim_digest(repeat('e', 64)),
       lease_expires_at = clock_timestamp() + interval '5 minutes',
       request_started_at = null, completed_at = null, result_code = null
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';
set role service_role;
do $$
declare v_established boolean;
begin
  select established into v_established
    from public.establish_revenuecat_deletion_identity_barrier(
      '32000000-0000-4000-8000-000000000001', repeat('e', 64), 1::smallint,
      array[repeat('c', 64)], array['family-c'],
      clock_timestamp() + interval '1 day'
    );
  if not v_established then raise exception 'REHEARSAL_IDENTITY_WRAPPER_NORMAL_FAILED'; end if;
end;
$$;
reset role;
update public.account_deletion_steps
   set claim_digest = public._account_deletion_claim_digest(repeat('f', 64)),
       lease_expires_at = clock_timestamp() + interval '500 milliseconds'
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';
do $$
declare
  v_key bigint := public._revenuecat_identity_tombstone_advisory_key(
    1::smallint, repeat('d', 64)
  );
  v_seen boolean := false;
  v_attempt integer;
  v_result text;
begin
  perform public.dblink_connect(
    'publication_identity_clock_final',
    'dbname=' || pg_catalog.current_database()
      || ' options=''-c statement_timeout=5000'''
  );
  perform public.dblink_send_query(
    'publication_identity_clock_final',
    $query$select public.rehearsal_hold_identity_lock_final(repeat('d', 64), 0.8)$query$
  );
  for v_attempt in 1..200 loop
    select exists (
      select 1 from pg_catalog.pg_locks as locks
       where locks.pid <> pg_catalog.pg_backend_pid()
         and locks.locktype = 'advisory' and locks.mode = 'ExclusiveLock'
         and locks.granted and locks.objsubid = 1
         and locks.classid::bigint = ((v_key >> 32) & 4294967295::bigint)
         and locks.objid::bigint = (v_key & 4294967295::bigint)
    ) into v_seen;
    exit when v_seen;
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  if not v_seen then raise exception 'REHEARSAL_IDENTITY_LOCK_NOT_SEEN'; end if;
  begin
    perform * from public.establish_revenuecat_deletion_identity_barrier(
      '32000000-0000-4000-8000-000000000001', repeat('f', 64), 1::smallint,
      array[repeat('d', 64)], array['family-d'],
      clock_timestamp() + interval '1 day'
    );
    raise exception 'REHEARSAL_IDENTITY_STALE_CLAIM_MUTATED';
  exception when serialization_failure then
    if sqlerrm <> 'REVENUECAT_IDENTITY_BARRIER_CAS_FAILED' then raise; end if;
  end;
  while public.dblink_is_busy('publication_identity_clock_final') = 1 loop
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  select result into v_result
    from public.dblink_get_result('publication_identity_clock_final') as result(result text);
  perform public.dblink_disconnect('publication_identity_clock_final');
  if v_result <> 'held' then raise exception 'REHEARSAL_IDENTITY_HOLDER_FAILED'; end if;
end;
$$;

reset role;

-- Once the first scan is consumed, a new claim cannot be issued before the
-- DB-owned 60-second boundary. This prevents an early scan from being replayed
-- after the interval.
update public.account_deletion_operations
   set revenuecat_absence_first_observed_at = clock_timestamp()
 where id = '32000000-0000-4000-8000-000000000001';
update public.account_deletion_steps
   set status = 'ambiguous',
       lease_kind = null,
       claim_digest = null,
       lease_expires_at = null
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';
do $$
declare v_step text;
begin
  select step_name into v_step
    from public._account_deletion_claimable_step(
      '32000000-0000-4000-8000-000000000001',
      'reconcile',
      clock_timestamp()
    );
  if v_step = 'revenuecat_delete' then
    raise exception 'REHEARSAL_EARLY_REVENUECAT_CLAIMABLE';
  end if;
  begin
    update public.account_deletion_steps
       set status = 'leased',
           lease_kind = 'reconcile',
           claim_digest = public._account_deletion_claim_digest(repeat('4', 64)),
           lease_expires_at = clock_timestamp() + interval '5 minutes'
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'revenuecat_delete';
    raise exception 'REHEARSAL_EARLY_DISTINCT_CLAIM_ISSUED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_DELETION_REVENUECAT_OBSERVATION_INTERVAL_PENDING' then raise; end if;
  end;
end;
$$;
update public.account_deletion_operations
   set revenuecat_absence_first_observed_at = clock_timestamp() - interval '61 seconds'
 where id = '32000000-0000-4000-8000-000000000001';
update public.account_deletion_steps
   set status = 'leased',
       lease_kind = 'reconcile',
       claim_digest = public._account_deletion_claim_digest(repeat('4', 64)),
       lease_expires_at = clock_timestamp() + interval '5 minutes',
       request_started_at = clock_timestamp() - interval '10 minutes'
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';

set role service_role;
do $$
declare
  v_confirmed boolean;
  v_count smallint;
  v_state text;
  v_step_status text;
begin
  select confirmed, observation_count into v_confirmed, v_count
    from public.record_account_deletion_revenuecat_absence_observation(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete', repeat('4', 64)
    );
  if not v_confirmed or v_count <> 2 then
    raise exception 'REHEARSAL_SECOND_DISTINCT_ABSENCE_OBSERVATION_FAILED';
  end if;
  begin
    perform * from public.record_account_deletion_step(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete', repeat('4', 64), 'succeeded',
      'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED', null
    );
    raise exception 'REHEARSAL_ALREADY_ABSENT_ACCEPTED_AFTER_STARTED_REQUEST';
  exception when invalid_parameter_value then
    if sqlerrm <> 'ACCOUNT_DELETION_SUCCESS_REQUIRES_STARTED_REQUEST' then raise; end if;
  end;
  select operation_state, step_status into v_state, v_step_status
    from public.record_account_deletion_step(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete', repeat('4', 64), 'succeeded',
      'REVENUECAT_V2_DELETION_VERIFIED', null
    );
  if v_step_status <> 'succeeded' then
    raise exception 'REHEARSAL_RECONCILE_SUCCESS_COMPATIBILITY_FAILED';
  end if;
end;
$$;
reset role;

-- Presence reset is exact-claim bound and cannot leave stale observations.
update public.account_deletion_steps
   set status = 'leased',
       lease_kind = 'reconcile',
       claim_digest = public._account_deletion_claim_digest(repeat('5', 64)),
       lease_expires_at = clock_timestamp() + interval '5 minutes',
       completed_at = null,
       result_code = null
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';

set role service_role;
do $$
declare v_reset boolean;
begin
  select reset into v_reset
    from public.reset_account_deletion_revenuecat_absence_observations(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete', repeat('5', 64)
    );
  if not v_reset then raise exception 'REHEARSAL_ABSENCE_RESET_FAILED'; end if;
end;
$$;
reset role;

do $$
begin
  if (select revenuecat_absence_observation_count
        from public.account_deletion_operations
       where id = '32000000-0000-4000-8000-000000000001') <> 0 then
    raise exception 'REHEARSAL_ABSENCE_RESET_METADATA_RETAINED';
  end if;
  begin
    update public.account_deletion_steps
       set status = 'succeeded',
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           completed_at = clock_timestamp(),
           result_code = 'REVENUECAT_V2_DELETION_VERIFIED'
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'revenuecat_delete';
    raise exception 'REHEARSAL_DIRECT_TERMINAL_BYPASS_ALLOWED';
  exception
    when object_not_in_prerequisite_state then
      if sqlerrm <> 'ACCOUNT_DELETION_REVENUECAT_ABSENCE_NOT_CONFIRMED' then raise; end if;
  end;
end;
$$;

-- Database-global provider-key buckets remain exact across Edge isolates.
-- Each fixed-window cap is under half its official domain limit, so even the
-- adversarial :59.999/:00.001 boundary remains below any rolling-minute cap.
delete from public.edge_rate_limits
 where scope in (
   'account-deletion-provider-revenuecat-customer',
   'account-deletion-provider-revenuecat-project'
 );
do $$
begin
  if 225 * 2 >= 480 or 25 * 2 >= 60 then
    raise exception 'REHEARSAL_REVENUECAT_ADJACENT_BUCKET_LIMIT_UNSAFE';
  end if;
  if extract(second from clock_timestamp()) > 58 then
    perform pg_catalog.pg_sleep(2);
  end if;
end;
$$;
insert into public.edge_rate_limits (
  scope, key_hash, owner_user_id, window_start, window_seconds,
  request_count, expires_at, created_at, updated_at
)
select 'account-deletion-provider-revenuecat-customer', repeat('9', 64), null,
       pg_catalog.to_timestamp(
         pg_catalog.floor(extract(epoch from clock_timestamp()) / 60) * 60
       ),
       60, 224,
       pg_catalog.to_timestamp(
         pg_catalog.floor(extract(epoch from clock_timestamp()) / 60) * 60
       ) + interval '1 hour',
       clock_timestamp(), clock_timestamp();
insert into public.edge_rate_limits (
  scope, key_hash, owner_user_id, window_start, window_seconds,
  request_count, expires_at, created_at, updated_at
)
select 'account-deletion-provider-revenuecat-project', repeat('9', 64), null,
       pg_catalog.to_timestamp(
         pg_catalog.floor(extract(epoch from clock_timestamp()) / 60) * 60
       ),
       60, 24,
       pg_catalog.to_timestamp(
         pg_catalog.floor(extract(epoch from clock_timestamp()) / 60) * 60
       ) + interval '1 hour',
       clock_timestamp(), clock_timestamp();
set role service_role;
do $$
begin
  if not public.consume_revenuecat_account_deletion_budget(
    repeat('9', 64), 'customer-information'
  ) then
    raise exception 'REHEARSAL_REVENUECAT_CUSTOMER_BUDGET_225_REJECTED';
  end if;
  if public.consume_revenuecat_account_deletion_budget(
    repeat('9', 64), 'customer-information'
  ) then
    raise exception 'REHEARSAL_REVENUECAT_CUSTOMER_BUDGET_226_ALLOWED';
  end if;
  if not public.consume_revenuecat_account_deletion_budget(
    repeat('9', 64), 'project-configuration'
  ) then
    raise exception 'REHEARSAL_REVENUECAT_PROJECT_BUDGET_25_REJECTED';
  end if;
  if public.consume_revenuecat_account_deletion_budget(
    repeat('9', 64), 'project-configuration'
  ) then
    raise exception 'REHEARSAL_REVENUECAT_PROJECT_BUDGET_26_ALLOWED';
  end if;
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.edge_rate_limits
       where scope in (
         'account-deletion-provider-revenuecat-customer',
         'account-deletion-provider-revenuecat-project'
       )
         and key_hash = repeat('9', 64)
         and owner_user_id is null
         and window_seconds = 60
         and request_count in (226, 26)) <> 2 then
    raise exception 'REHEARSAL_REVENUECAT_DOMAIN_BUDGET_ROWS_INVALID';
  end if;
end;
$$;

-- Provider-directed delay on a started DELETE schedules only the GET-based
-- ambiguous lane; request_started remains durable and redispatch stays closed.
update public.account_deletion_steps
   set status = 'request_started',
       lease_kind = 'dispatch',
       claim_digest = public._account_deletion_claim_digest(repeat('7', 64)),
       lease_expires_at = clock_timestamp() + interval '2 minutes',
       request_started_at = clock_timestamp(),
       next_attempt_at = null
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';
set role service_role;
do $$
declare
  v_retry_at timestamptz := clock_timestamp() + interval '3 minutes';
  v_next timestamptz;
begin
  select next_attempt_at into v_next
    from public.record_account_deletion_step(
      '32000000-0000-4000-8000-000000000001',
      'revenuecat_delete', repeat('7', 64), 'ambiguous',
      'REVENUECAT_V2_DISPATCH_AMBIGUOUS', v_retry_at
    );
  if v_next is distinct from v_retry_at then
    raise exception 'REHEARSAL_REVENUECAT_AMBIGUOUS_BACKOFF_LOST';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.account_deletion_steps
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'revenuecat_delete'
       and status = 'ambiguous'
       and request_started_at is not null
       and next_attempt_at > clock_timestamp()
  ) then
    raise exception 'REHEARSAL_REVENUECAT_AMBIGUOUS_BACKOFF_STATE_INVALID';
  end if;
end;
$$;

-- Capacity deferral restores the claim attempt. Repeating this path twelve
-- times cannot manufacture MAX_ATTEMPTS_EXHAUSTED without a provider request.
update public.account_deletion_operations
   set revenuecat_absence_observation_count = 0,
       revenuecat_absence_first_observed_at = null,
       revenuecat_absence_second_observed_at = null,
       revenuecat_absence_last_claim_digest = null
 where id = '32000000-0000-4000-8000-000000000001';
update public.account_deletion_steps
   set status = 'ambiguous',
       attempt_count = 0,
       lease_kind = null,
       claim_digest = null,
       lease_expires_at = null,
       request_started_at = clock_timestamp() - interval '10 minutes',
       next_attempt_at = null,
       result_code = 'REVENUECAT_V2_DISPATCH_AMBIGUOUS'
 where operation_id = '32000000-0000-4000-8000-000000000001'
   and step_name = 'revenuecat_delete';
do $$
declare
  v_attempt integer;
  v_deferred boolean;
begin
  for v_attempt in 1..12 loop
    update public.account_deletion_steps
       set status = 'leased',
           attempt_count = attempt_count + 1,
           lease_kind = 'reconcile',
           claim_digest = public._account_deletion_claim_digest(repeat('8', 64)),
           lease_expires_at = clock_timestamp() + interval '2 minutes',
           next_attempt_at = null
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'revenuecat_delete';
    select deferred into v_deferred
      from public.defer_account_deletion_revenuecat_provider_capacity(
        '32000000-0000-4000-8000-000000000001',
        'revenuecat_delete', repeat('8', 64),
        clock_timestamp() + interval '65 seconds'
      );
    if not v_deferred then
      raise exception 'REHEARSAL_REVENUECAT_CAPACITY_NOT_DEFERRED';
    end if;
  end loop;
  if exists (
    select 1 from public.account_deletion_steps
     where operation_id = '32000000-0000-4000-8000-000000000001'
       and step_name = 'revenuecat_delete'
       and (
         attempt_count <> 0
         or status <> 'ambiguous'
         or result_code = 'MAX_ATTEMPTS_EXHAUSTED'
       )
  ) then
    raise exception 'REHEARSAL_REVENUECAT_CAPACITY_SPENT_ATTEMPTS';
  end if;
end;
$$;

select 'ACCOUNT_PUBLICATION_FENCE_POSTGRES_REHEARSAL_PASS' as result;
