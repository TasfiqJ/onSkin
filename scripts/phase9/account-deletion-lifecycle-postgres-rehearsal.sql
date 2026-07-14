\set ON_ERROR_STOP on

-- Disposable PostgreSQL 15/17 rehearsal for migration 0048. Run only in a
-- fresh throwaway database. It creates the minimum effective pre-0048 schema,
-- applies the real migration, and exercises authorization, request ambiguity,
-- reconciliation, stale-JWT barriers, Storage attestation, expiry, and cleanup.

-- Match the pinned Supabase image's extension namespace so this rehearsal
-- catches the same qualification errors as a full local source replay.
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to public;

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;

-- Emulate the Data API default ACL used by existing Supabase projects. The
-- migration must explicitly remove service-role table DML and expose only RPCs.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

create schema auth;
create table auth.users (
  id uuid primary key
);

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create schema storage;
grant usage on schema storage to authenticated;
grant usage on schema storage to service_role;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner text,
  owner_id text,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant select, insert, update, delete on storage.objects to service_role;
create policy rehearsal_storage_permissive on storage.objects
  for all to authenticated using (true) with check (true);

-- The migration deliberately fails if any canonical caller-RLS table is absent.
-- Their feature-specific columns/policies are irrelevant to this isolated gate.
do $$
declare
  v_table text;
  v_tables constant text[] := array[
    'profiles', 'skin_profiles', 'user_products', 'routines', 'routine_steps',
    'routine_completions', 'routine_conflicts', 'active_ramp', 'shelf_scans',
    'cycles', 'cycle_nights', 'streak_freezes', 'notification_preferences',
    'notification_log', 'consents', 'photos', 'entitlements',
    'recommendation_preferences', 'recommendations', 'catalog_corrections',
    'catalog_lookup_events', 'commerce_click_events', 'community_blocks',
    'community_questions', 'community_reactions', 'community_reports',
    'photo_trend', 'ask_sessions', 'ask_turn_audit', 'ask_safety_audit'
  ]::text[];
begin
  foreach v_table in array v_tables loop
    execute pg_catalog.format(
      'create table public.%I (id uuid primary key default gen_random_uuid(), marker text)',
      v_table
    );
    execute pg_catalog.format('alter table public.%I enable row level security', v_table);
    execute pg_catalog.format(
      'grant select, insert, update, delete on public.%I to authenticated',
      v_table
    );
    execute pg_catalog.format(
      'create policy rehearsal_permissive on public.%I '
      || 'for all to authenticated using (true) with check (true)',
      v_table
    );
  end loop;
end;
$$;

-- Pointer columns used by the deletion Storage worklist. Other production
-- columns are irrelevant to this isolated rehearsal.
alter table public.profiles add column avatar_path text;
alter table public.photos add column user_id uuid, add column storage_path text;

-- Pre-0048 rate-limit shape and fixtures.
create table public.edge_rate_limits (
  scope text not null check (scope ~ '^[a-z0-9_-]{1,64}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds between 60 and 86400),
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);
alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;
create index edge_rate_limits_updated_idx on public.edge_rate_limits (updated_at);
create index edge_rate_limits_window_start_idx on public.edge_rate_limits (window_start);

create function public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$ select true $$;
revoke all on function public.consume_edge_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer)
  to service_role;

create function public.scrub_account_service_rows(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'complete', true,
    'order_attributions_scrubbed', 0,
    'commerce_click_events_deleted', 0,
    'obf_contribution_queue_deleted', 0,
    'subscriptions_events_deleted', 0,
    'subscriptions_events_scrubbed', 0,
    'residual_order_attributions', 0,
    'residual_obf_contributions', 0,
    'residual_subscription_identities', 0
  );
$$;
revoke all on function public.scrub_account_service_rows(uuid)
  from public, anon, authenticated;
grant execute on function public.scrub_account_service_rows(uuid) to service_role;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005');

insert into public.edge_rate_limits (
  scope, key_hash, window_start, window_seconds, request_count
) values
  ('waitlist', repeat('1', 64), date_trunc('minute', now()), 60, 1),
  ('catalog-search', repeat('2', 64), date_trunc('minute', now()), 60, 1),
  ('legacy-unknown', repeat('3', 64), date_trunc('minute', now()), 60, 1);

\ir ../../supabase/migrations/20260713000048_account_deletion_lifecycle_and_rate_limit_ownership.sql

do $$
declare
  v_table text;
begin
  if (select count(*) from public.edge_rate_limits) <> 1
     or not exists (
       select 1 from public.edge_rate_limits where scope = 'waitlist'
     ) then
    raise exception 'REHEARSAL_LEGACY_RATE_LIMIT_CLASSIFICATION_FAILED';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.edge_rate_limits'::pg_catalog.regclass
       and conname = 'edge_rate_limits_owner_user_id_fkey'
       and contype = 'f'
       and confdeltype = 'c'
       and convalidated
  ) then
    raise exception 'REHEARSAL_RATE_LIMIT_OWNER_CASCADE_MISSING';
  end if;

  if pg_catalog.to_regclass('public.edge_rate_limits_expires_idx') is null
     or pg_catalog.to_regclass('public.edge_rate_limits_owner_user_idx') is null then
    raise exception 'REHEARSAL_RATE_LIMIT_CLEANUP_INDEX_MISSING';
  end if;

  if (select count(*) from pg_catalog.pg_policy
       where polname in (
         'account_deletion_write_barrier_insert',
         'account_deletion_write_barrier_update',
         'account_deletion_write_barrier_delete'
       )
         and polrelid <> 'storage.objects'::pg_catalog.regclass) <> 90 then
    raise exception 'REHEARSAL_CALLER_TABLE_BARRIER_POLICY_COUNT_FAILED';
  end if;

  if (select count(*) from pg_catalog.pg_policy
       where polrelid = 'storage.objects'::pg_catalog.regclass
         and polname in (
           'account_deletion_write_barrier_insert',
           'account_deletion_write_barrier_update',
           'account_deletion_write_barrier_delete'
         )) <> 3 then
    raise exception 'REHEARSAL_STORAGE_BARRIER_POLICIES_MISSING';
  end if;

  foreach v_table in array array[
    'account_deletion_operations',
    'account_deletion_barriers',
    'account_deletion_steps',
    'account_deletion_receipts',
    'account_deletion_operator_recovery_audit'
  ]::text[] loop
    if not exists (
      select 1
        from pg_catalog.pg_class
       where oid = pg_catalog.to_regclass('public.' || v_table)
         and relrowsecurity
         and relforcerowsecurity
    ) then
      raise exception 'REHEARSAL_SERVICE_TABLE_RLS_FAILED:%', v_table;
    end if;
  end loop;

  if pg_catalog.has_table_privilege('authenticated', 'public.account_deletion_steps', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.account_deletion_receipts', 'SELECT')
     or pg_catalog.has_table_privilege('service_role', 'public.account_deletion_steps', 'SELECT')
     or pg_catalog.has_table_privilege('service_role', 'public.account_deletion_steps', 'UPDATE')
     or pg_catalog.has_table_privilege(
       'service_role', 'public.account_deletion_operator_recovery_audit', 'INSERT'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.begin_account_deletion(uuid,text,text,timestamptz,bytea,bytea,bytea)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.begin_account_deletion(uuid,text,text,timestamptz,bytea,bytea,bytea)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.get_account_deletion_status(text)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.get_account_deletion_status(text)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.get_account_deletion_status(text)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.get_account_deletion_barrier_state(uuid)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.get_account_deletion_barrier_state(uuid)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.get_account_deletion_barrier_state(uuid)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.update_account_deletion_step_payload(uuid,text,text,bytea)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.update_account_deletion_step_payload(uuid,text,text,bytea)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.recover_account_deletion_step(uuid,text,text,text,text)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.recover_account_deletion_step(uuid,text,text,text,text)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.list_account_deletions_ready_to_finalize(integer)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.list_account_deletions_ready_to_finalize(integer)',
       'EXECUTE'
     ) then
    raise exception 'REHEARSAL_SERVICE_PRIVILEGE_BOUNDARY_FAILED';
  end if;

  if (
    select array_agg(columns.column_name order by columns.ordinal_position)
      from information_schema.columns as columns
     where columns.table_schema = 'public'
       and columns.table_name = 'account_deletion_receipts'
  ) is distinct from array[
    'capability_digest',
    'receipt_state',
    'subject_hmac_key_version',
    'subject_hmac',
    'apple_manual_revocation_required',
    'completed_at',
    'expires_at',
    'purge_after'
  ]::information_schema.sql_identifier[] then
    raise exception 'REHEARSAL_TERMINAL_RECEIPT_NOT_MINIMAL';
  end if;

  if public._account_deletion_idempotency_digest(repeat('7', 64))
       = public._account_deletion_capability_digest(repeat('7', 64))
     or public._account_deletion_idempotency_digest(repeat('7', 64))
       = public._account_deletion_claim_digest(repeat('7', 64))
     or public._account_deletion_capability_digest(repeat('7', 64))
       = public._account_deletion_claim_digest(repeat('7', 64)) then
    raise exception 'REHEARSAL_TOKEN_DIGESTS_NOT_DOMAIN_SEPARATED';
  end if;
  if public._account_deletion_idempotency_digest(repeat('7', 64))
       <> 'd3d8ae6effd06551471ebe864cc13d8a7eb3b0ae236e88d96a88091285a61a76'
     or public._account_deletion_capability_digest(repeat('7', 64))
       <> 'ad4b24c4877fee6adbd5d8953d5edb3df9042afaad7a99494dd356ee83c8d04b'
     or public._account_deletion_claim_digest(repeat('7', 64))
       <> '7086a541df2ff4c4fc089840936737fec148b855c38372f0636917ef6dd4d9ce'
     or public._account_deletion_operator_command_digest(repeat('7', 64))
       <> '3312b18d41e641f4f0601067e26bb7a222bfe17a9bbca79ea09981a479b41231'
  then
    raise exception 'REHEARSAL_TOKEN_DIGEST_KNOWN_VECTOR_FAILED';
  end if;
end;
$$;

set role service_role;
do $$
begin
  begin
    update public.account_deletion_steps set result_code = result_code where false;
    raise exception 'REHEARSAL_SERVICE_ROLE_DIRECT_LIFECYCLE_DML_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set role authenticated;
do $$
begin
  perform public.get_account_deletion_barrier_state(
    '00000000-0000-4000-8000-000000000001'
  );
  raise exception 'REHEARSAL_AUTHENTICATED_PREFLIGHT_RPC_ALLOWED';
exception when insufficient_privilege then null;
end;
$$;
reset role;

-- More than one candidate-page of older, future-scheduled operations must not
-- starve a newer operation whose first incomplete step is runnable now.
do $$
declare
  v_now timestamptz := clock_timestamp();
  v_due_user_id uuid := '10000000-0000-4000-8000-000000000102';
begin
  insert into auth.users (id)
  select (
    '10000000-0000-4000-8000-' || pg_catalog.lpad(series.i::text, 12, '0')
  )::uuid
    from pg_catalog.generate_series(1, 102) as series(i);

  insert into public.account_deletion_operations (
    user_id,
    idempotency_digest,
    capability_digest,
    state,
    created_at,
    updated_at,
    expires_at
  )
  select users.id,
         pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to('starvation-idempotency:' || users.id::text, 'UTF8'),
             'sha256'
           ),
           'hex'
         ),
         pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to('starvation-capability:' || users.id::text, 'UTF8'),
             'sha256'
           ),
           'hex'
         ),
         'pending',
         case
           when users.id = v_due_user_id then v_now
           else v_now - interval '2 hours'
                + (
                  pg_catalog.right(users.id::text, 12)::bigint
                  * interval '1 millisecond'
                )
         end,
         v_now,
         v_now + interval '2 hours'
    from auth.users as users
   where users.id::text like '10000000-0000-4000-8000-%';

  insert into public.account_deletion_barriers (
    user_id,
    operation_id,
    created_at,
    expires_at
  )
  select operations.user_id,
         operations.id,
         operations.created_at,
         operations.expires_at
    from public.account_deletion_operations as operations
   where operations.user_id::text like '10000000-0000-4000-8000-%';

  insert into public.account_deletion_steps (
    operation_id,
    step_name,
    step_order,
    next_attempt_at
  )
  select operations.id,
         definitions.step_name,
         definitions.step_order,
         case
           when definitions.step_order = 10
                and operations.user_id <> v_due_user_id
             then v_now + interval '1 hour'
           else null
         end
    from public.account_deletion_operations as operations
    cross join (
      values
        ('apple_revoke'::text, 10::smallint),
        ('revenuecat_delete'::text, 20::smallint),
        ('posthog_delete'::text, 30::smallint),
        ('photo_storage_delete'::text, 40::smallint),
        ('service_rows_scrub'::text, 50::smallint),
        ('auth_user_delete'::text, 60::smallint)
    ) as definitions(step_name, step_order)
   where operations.user_id::text like '10000000-0000-4000-8000-%';

  perform pg_catalog.set_config(
    'rehearsal.starvation_due_op',
    (
      select operations.id::text
        from public.account_deletion_operations as operations
       where operations.user_id = v_due_user_id
    ),
    false
  );
end;
$$;

set role service_role;
select operation_id as starvation_claim_op
  from public.claim_next_account_deletion_step('dispatch', 60)
\gset
select pg_catalog.set_config(
  'rehearsal.starvation_claim_op',
  :'starvation_claim_op',
  false
);
reset role;

do $$
begin
  if pg_catalog.current_setting('rehearsal.starvation_claim_op')::uuid
       <> pg_catalog.current_setting('rehearsal.starvation_due_op')::uuid
     or (
       select count(*)
         from public.account_deletion_steps as steps
         join public.account_deletion_operations as operations
           on operations.id = steps.operation_id
        where operations.user_id::text like '10000000-0000-4000-8000-%'
          and operations.user_id <> '10000000-0000-4000-8000-000000000102'
          and steps.step_name = 'apple_revoke'
          and steps.status = 'pending'
          and steps.attempt_count = 0
     ) <> 101 then
    raise exception 'REHEARSAL_DUE_WORK_STARVED_BY_FUTURE_CANDIDATES';
  end if;
end;
$$;

delete from public.account_deletion_operations
 where user_id::text like '10000000-0000-4000-8000-%';
delete from auth.users
 where id::text like '10000000-0000-4000-8000-%';

set role service_role;
do $$
begin
  perform public.scrub_account_service_rows(
    '00000000-0000-4000-8000-000000000001'
  );
  raise exception 'REHEARSAL_SERVICE_SCRUB_WITHOUT_BARRIER_ALLOWED';
exception
  when raise_exception then
    if sqlerrm <> 'ACCOUNT_DELETION_BARRIER_REQUIRED' then raise; end if;
end;
$$;
do $$
begin
  perform public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000005',
    repeat('0', 64),
    repeat('5', 64),
    clock_timestamp() + interval '31 days',
    null,
    null,
    null
  );
  raise exception 'REHEARSAL_OPERATION_MAX_LIFETIME_NOT_ENFORCED';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'ACCOUNT_DELETION_BEGIN_INVALID' then raise; end if;
end;
$$;

-- Terminal success without a request-start marker is restricted to exact,
-- non-mutating evidence codes. This lets the runtime report truthful provider
-- absence/manual states without pretending that it dispatched a deletion.
select operation_id as nonmutating_op
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000005',
    repeat('01', 32),
    repeat('23', 32),
    clock_timestamp() + interval '1 day',
    decode('01', 'hex'),
    decode('02', 'hex'),
    decode('03', 'hex')
  )
\gset
select pg_catalog.set_config('rehearsal.nonmutating_op', :'nonmutating_op', false);
select claim_token as nonmutating_apple_claim
  from public.claim_account_deletion_step(:'nonmutating_op'::uuid, 'dispatch', 60)
 where claimed
\gset
select pg_catalog.set_config(
  'rehearsal.nonmutating_apple_claim',
  :'nonmutating_apple_claim',
  false
);
do $$
begin
  begin
    perform public.record_account_deletion_step(
      pg_catalog.current_setting('rehearsal.nonmutating_op')::uuid,
      'apple_revoke',
      pg_catalog.current_setting('rehearsal.nonmutating_apple_claim'),
      'succeeded',
      'APPLE_ARBITRARY_UNSTARTED_SUCCESS',
      null
    );
    raise exception 'REHEARSAL_ARBITRARY_UNSTARTED_SUCCESS_ALLOWED';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'ACCOUNT_DELETION_SUCCESS_REQUIRES_STARTED_REQUEST' then raise; end if;
  end;
end;
$$;
select * from public.record_account_deletion_step(
  :'nonmutating_op'::uuid,
  'apple_revoke',
  :'nonmutating_apple_claim',
  'succeeded',
  'APPLE_NOT_LINKED',
  null
);
select claim_token as nonmutating_rc_claim
  from public.claim_account_deletion_step(:'nonmutating_op'::uuid, 'dispatch', 60)
 where claimed
\gset
select * from public.record_account_deletion_step(
  :'nonmutating_op'::uuid,
  'revenuecat_delete',
  :'nonmutating_rc_claim',
  'succeeded',
  'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
  null
);
select claim_token as nonmutating_posthog_claim
  from public.claim_account_deletion_step(:'nonmutating_op'::uuid, 'dispatch', 60)
 where claimed
\gset
select pg_catalog.set_config(
  'rehearsal.nonmutating_posthog_claim',
  :'nonmutating_posthog_claim',
  false
);
do $$
begin
  begin
    perform public.record_account_deletion_step(
      pg_catalog.current_setting('rehearsal.nonmutating_op')::uuid,
      'posthog_delete',
      pg_catalog.current_setting('rehearsal.nonmutating_posthog_claim'),
      'succeeded',
      'POSTHOG_DELETION_NOT_REQUIRED',
      null
    );
    raise exception 'REHEARSAL_POSTHOG_UNSTARTED_SUCCESS_ALLOWED';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'ACCOUNT_DELETION_SUCCESS_REQUIRES_STARTED_REQUEST' then raise; end if;
  end;
end;
$$;
select * from public.mark_account_deletion_step_request_started(
  :'nonmutating_op'::uuid,
  'posthog_delete',
  :'nonmutating_posthog_claim'
);
select * from public.record_account_deletion_step(
  :'nonmutating_op'::uuid,
  'posthog_delete',
  :'nonmutating_posthog_claim',
  'succeeded',
  'POSTHOG_DELETION_NOT_REQUIRED',
  null
);
select claim_token as nonmutating_storage_claim
  from public.claim_account_deletion_step(:'nonmutating_op'::uuid, 'dispatch', 60)
 where claimed
\gset
select * from public.record_account_deletion_step(
  :'nonmutating_op'::uuid,
  'photo_storage_delete',
  :'nonmutating_storage_claim',
  'succeeded',
  'PHOTO_STORAGE_ALREADY_ABSENT',
  null
);
reset role;

delete from public.account_deletion_operations where id = :'nonmutating_op'::uuid;

-- Public buckets remain available through the legacy signature; account scopes
-- require the verified owner argument.
set role service_role;
select public.consume_edge_rate_limit('waitlist', repeat('4', 64), 2, 60);
select public.consume_edge_rate_limit('account-deletion-status', repeat('7', 64), 2, 60);
do $$
begin
  perform public.consume_edge_rate_limit('catalog-search', repeat('5', 64), 2, 60);
  raise exception 'REHEARSAL_ACCOUNT_RATE_LIMIT_USED_LEGACY_SIGNATURE';
exception
  when insufficient_privilege then
    if sqlerrm <> 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_REQUIRED' then raise; end if;
end;
$$;
select public.consume_edge_rate_limit(
  'catalog-search',
  repeat('6', 64),
  2,
  60,
  '00000000-0000-4000-8000-000000000001'::uuid
);
select public.consume_edge_rate_limit(
  'account-deletion-intake',
  repeat('8', 64),
  5,
  600,
  '00000000-0000-4000-8000-000000000001'::uuid
);
reset role;

do $$
begin
  if not exists (
    select 1
      from public.edge_rate_limits
     where scope = 'catalog-search'
       and owner_user_id = '00000000-0000-4000-8000-000000000001'
       and expires_at = window_start + pg_catalog.make_interval(
         secs => greatest(window_seconds * 4, 3600)
       )
  ) then
    raise exception 'REHEARSAL_ACCOUNT_RATE_LIMIT_OWNER_OR_EXPIRY_FAILED';
  end if;
end;
$$;

set role service_role;
do $$
begin
  if public.get_account_deletion_barrier_state(
    '00000000-0000-4000-8000-000000000001'
  ) <> 'clear' then
    raise exception 'REHEARSAL_CLEAR_PREFLIGHT_FAILED';
  end if;
end;
$$;
reset role;

-- A live authenticated caller can write before deletion begins.
set role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  false
);
insert into public.profiles (marker) values ('before-barrier');
insert into public.profiles (id, marker, avatar_path) values (
  '00000000-0000-4000-8000-000000000001',
  'avatar-pointer',
  'trusted/avatar-pointer-only.jpg'
);
insert into public.photos (user_id, storage_path) values
  (
    '00000000-0000-4000-8000-000000000001',
    'trusted/photo-pointer-only.jpg'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'trusted/other-user-pointer.jpg'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'trusted/malicious-pointer-to-other-owner.jpg'
  );
insert into storage.objects (bucket_id, name, owner, owner_id) values
  (
    'photos',
    '00000000-0000-4000-8000-000000000001/path-owned.jpg',
    null,
    null
  ),
  (
    'photos',
    'legacy/moved-owner.jpg',
    '00000000-0000-4000-8000-000000000001',
    null
  ),
  (
    'photos',
    'legacy/moved-owner-id.jpg',
    null,
    '00000000-0000-4000-8000-000000000001'
  ),
  ('photos', 'trusted/photo-pointer-only.jpg', null, null),
  ('photos', 'trusted/avatar-pointer-only.jpg', null, null),
  (
    'photos',
    '00000000-0000-4000-8000-000000000002/other.jpg',
    null,
    '00000000-0000-4000-8000-000000000002'
  ),
  ('photos', 'trusted/other-user-pointer.jpg', null, null),
  (
    'photos',
    'trusted/malicious-pointer-to-other-owner.jpg',
    '00000000-0000-4000-8000-000000000002',
    null
  ),
  (
    'photos',
    '00000000-0000-4000-8000-000000000001/explicit-other-owner.jpg',
    null,
    '00000000-0000-4000-8000-000000000002'
  );
insert into storage.objects (bucket_id, name, owner, owner_id)
select 'photos',
       '00000000-0000-4000-8000-000000000001/bulk/'
         || pg_catalog.lpad(series.i::text, 4, '0') || '.jpg',
       null,
       null
  from pg_catalog.generate_series(1, 1005) as series(i);
reset role;

-- Begin is service-only and atomically installs the barrier while retaining
-- the bounded owner-keyed quota until Auth hard deletion. The absolute
-- deadline is replay-stable.
set role service_role;
select operation_id as op_a,
       operation_expires_at as op_a_expires
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000001',
    repeat('9', 64),
    repeat('a', 64),
    now() + interval '30 minutes',
    decode('0102030405060708', 'hex'),
    decode('2122232425262728', 'hex'),
    decode('1112131415161718', 'hex')
  )
\gset
select pg_catalog.set_config('rehearsal.op_a', :'op_a', false);
select pg_catalog.set_config('rehearsal.op_a_expires', :'op_a_expires', false);

do $$
begin
  if public.get_account_deletion_barrier_state(
    '00000000-0000-4000-8000-000000000001'
  ) <> 'active' then
    raise exception 'REHEARSAL_ACTIVE_PREFLIGHT_FAILED';
  end if;
end;
$$;

-- Operation identity still uses independent idempotency/status tokens, while
-- every intake attempt shares one verified-owner quota bucket. A lost response
-- retry may regenerate expiry and randomized ciphertext, so the first operation
-- remains authoritative and replay inputs neither conflict nor mutate. The
-- bounded limiter remains usable after the barrier for safe replay.
do $$
begin
  if not public.consume_edge_rate_limit(
    'account-deletion-intake',
    repeat('8', 64),
    5,
    600,
    '00000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'REHEARSAL_POST_BARRIER_INTAKE_RETRY_RATE_LIMIT_FAILED';
  end if;
end;
$$;

select operation_id as replay_op_a,
       operation_expires_at as replay_op_a_expires,
       created as replay_created
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000001',
    repeat('9', 64),
    repeat('a', 64),
    now() + interval '20 minutes',
    decode('deadbeef', 'hex'),
    decode('feedface', 'hex'),
    decode('cafebabe', 'hex')
  )
\gset
select pg_catalog.set_config('rehearsal.replay_op_a', :'replay_op_a', false);
select pg_catalog.set_config(
  'rehearsal.replay_op_a_expires',
  :'replay_op_a_expires',
  false
);
select pg_catalog.set_config('rehearsal.replay_created', :'replay_created', false);

do $$
begin
  if pg_catalog.current_setting('rehearsal.replay_op_a')::uuid
       <> pg_catalog.current_setting('rehearsal.op_a')::uuid
     or pg_catalog.current_setting('rehearsal.replay_op_a_expires')::timestamptz
       <> pg_catalog.current_setting('rehearsal.op_a_expires')::timestamptz
     or pg_catalog.current_setting('rehearsal.replay_created')::boolean then
    raise exception 'REHEARSAL_IDEMPOTENT_REPLAY_DID_NOT_RETURN_ACTIVE_OPERATION';
  end if;
end;
$$;

do $$
begin
  perform public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000001',
    repeat('8', 64),
    repeat('a', 64),
    pg_catalog.current_setting('rehearsal.op_a_expires')::timestamptz,
    decode('0102030405060708', 'hex'),
    decode('2122232425262728', 'hex'),
    decode('1112131415161718', 'hex')
  );
  raise exception 'REHEARSAL_CONFLICTING_IDEMPOTENCY_REPLAY_ALLOWED';
exception
  when unique_violation then
    if sqlerrm <> 'ACCOUNT_DELETION_IDEMPOTENCY_CONFLICT' then raise; end if;
end;
$$;

do $$
begin
  perform public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000002',
    repeat('9', 64),
    repeat('7', 64),
    clock_timestamp() + interval '10 minutes',
    null,
    null,
    null
  );
  raise exception 'REHEARSAL_CROSS_ACCOUNT_IDEMPOTENCY_REUSE_ALLOWED';
exception
  when unique_violation then
    if sqlerrm <> 'ACCOUNT_DELETION_IDEMPOTENCY_REUSED' then raise; end if;
end;
$$;

do $$
begin
  perform public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000002',
    repeat('7', 64),
    repeat('a', 64),
    clock_timestamp() + interval '10 minutes',
    null,
    null,
    null
  );
  raise exception 'REHEARSAL_CROSS_ACCOUNT_CAPABILITY_REUSE_ALLOWED';
exception
  when unique_violation then
    if sqlerrm <> 'ACCOUNT_DELETION_CAPABILITY_REUSED' then raise; end if;
end;
$$;

do $$
begin
  perform public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000005',
    repeat('8', 64),
    repeat('8', 64),
    clock_timestamp() + interval '10 minutes',
    null,
    null,
    null
  );
  raise exception 'REHEARSAL_SHARED_IDEMPOTENCY_AND_CAPABILITY_TOKEN_ALLOWED';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'ACCOUNT_DELETION_BEGIN_INVALID' then raise; end if;
end;
$$;
reset role;

do $$
declare
  v_operation_text text;
begin
  select pg_catalog.to_jsonb(operations)::text
    into v_operation_text
    from public.account_deletion_operations as operations
   where operations.id = pg_catalog.current_setting('rehearsal.op_a')::uuid;
  if pg_catalog.strpos(v_operation_text, repeat('9', 64)) > 0
     or pg_catalog.strpos(v_operation_text, repeat('a', 64)) > 0 then
    raise exception 'REHEARSAL_RAW_INTAKE_TOKEN_RETAINED';
  end if;
  if (
    select steps.encrypted_payload
      from public.account_deletion_steps as steps
     where steps.operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
       and steps.step_name = 'apple_revoke'
  ) is distinct from decode('0102030405060708', 'hex')
     or (
       select steps.encrypted_payload
         from public.account_deletion_steps as steps
        where steps.operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
          and steps.step_name = 'revenuecat_delete'
     ) is distinct from decode('2122232425262728', 'hex')
     or (
       select steps.encrypted_payload
         from public.account_deletion_steps as steps
        where steps.operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
          and steps.step_name = 'posthog_delete'
     ) is distinct from decode('1112131415161718', 'hex') then
    raise exception 'REHEARSAL_IDEMPOTENT_REPLAY_MUTATED_ORIGINAL_PAYLOADS';
  end if;
end;
$$;

set role service_role;
do $$
declare
  v_operation_id uuid;
  v_state text;
begin
  select operation_id, operation_state
    into v_operation_id, v_state
    from public.get_account_deletion_status(repeat('a', 64));
  if v_operation_id is distinct from pg_catalog.current_setting('rehearsal.op_a')::uuid
     or v_state <> 'pending' then
    raise exception 'REHEARSAL_CAPABILITY_ONLY_ACTIVE_RECOVERY_FAILED';
  end if;
end;
$$;
reset role;

set role service_role;
do $$
declare
  v_result jsonb;
begin
  v_result := public.scrub_account_service_rows(
    '00000000-0000-4000-8000-000000000001'
  );
  if v_result ->> 'complete' <> 'true' then
    raise exception 'REHEARSAL_GUARDED_SERVICE_SCRUB_FAILED';
  end if;
end;
$$;
reset role;

do $$
begin
  if (
    select count(*)
      from public.edge_rate_limits
     where owner_user_id = '00000000-0000-4000-8000-000000000001'
  ) <> 2
     or not exists (
       select 1
         from public.edge_rate_limits
        where owner_user_id = '00000000-0000-4000-8000-000000000001'
          and scope = 'account-deletion-intake'
          and key_hash = repeat('8', 64)
          and request_count = 2
     ) then
    raise exception 'REHEARSAL_BEGIN_OWNER_RATE_LIMIT_PERSISTENCE_OR_RETRY_FAILED';
  end if;
  if not exists (
    select 1
      from public.account_deletion_barriers
     where user_id = '00000000-0000-4000-8000-000000000001'
       and operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
       and expires_at = pg_catalog.current_setting('rehearsal.op_a_expires')::timestamptz
  ) then
    raise exception 'REHEARSAL_BEGIN_BARRIER_MISSING';
  end if;
end;
$$;

-- The restrictive policy plus account_write_allowed() blocks a stale JWT on
-- both public rows and photo Storage, while allowing no TOCTOU with begin.
set role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  false
);
do $$
begin
  insert into public.profiles (marker) values ('must-be-blocked');
  raise exception 'REHEARSAL_STALE_JWT_PUBLIC_WRITE_ALLOWED';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  update public.profiles
     set marker = 'must-be-blocked'
   where marker = 'before-barrier';
  if found then
    raise exception 'REHEARSAL_STALE_JWT_PUBLIC_UPDATE_ALLOWED';
  end if;
end;
$$;
do $$
begin
  delete from public.profiles where marker = 'before-barrier';
  if found then
    raise exception 'REHEARSAL_STALE_JWT_PUBLIC_DELETE_ALLOWED';
  end if;
end;
$$;
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('photos', '00000000-0000-4000-8000-000000000001/late.jpg');
  raise exception 'REHEARSAL_STALE_JWT_STORAGE_WRITE_ALLOWED';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  update storage.objects
     set name = name || '.late'
   where bucket_id = 'photos'
     and name = '00000000-0000-4000-8000-000000000001/path-owned.jpg';
  if found then
    raise exception 'REHEARSAL_STALE_JWT_STORAGE_UPDATE_ALLOWED';
  end if;
end;
$$;
do $$
begin
  delete from storage.objects
   where bucket_id = 'photos'
     and name = '00000000-0000-4000-8000-000000000001/path-owned.jpg';
  if found then
    raise exception 'REHEARSAL_STALE_JWT_STORAGE_DELETE_ALLOWED';
  end if;
end;
$$;
reset role;

-- Storage worklist unifies canonical prefixes, both generations of ownership
-- metadata, and trusted photo/avatar pointers without admitting another user.
-- Pagination must remain exact above the 1,000-object API batch ceiling.
set role service_role;
do $$
declare
  v_first_page text[];
  v_second_page text[];
  v_all_names text[];
  v_cursor text;
begin
  select array_agg(object_name order by object_name)
    into v_first_page
    from public.list_account_photo_storage_objects(
      '00000000-0000-4000-8000-000000000001',
      null,
      1000
    );

  if pg_catalog.cardinality(v_first_page) <> 1000 then
    raise exception 'REHEARSAL_STORAGE_FIRST_PAGE_SIZE_FAILED';
  end if;
  v_cursor := v_first_page[1000];
  select array_agg(object_name order by object_name)
    into v_second_page
    from public.list_account_photo_storage_objects(
      '00000000-0000-4000-8000-000000000001',
      v_cursor,
      1000
    );
  if pg_catalog.cardinality(v_second_page) <> 8 then
    raise exception 'REHEARSAL_STORAGE_SECOND_PAGE_SIZE_FAILED';
  end if;

  v_all_names := v_first_page || v_second_page;
  if (
    select count(distinct names.name)
      from pg_catalog.unnest(v_all_names) as names(name)
  ) <> 1008
     or not (
       '00000000-0000-4000-8000-000000000001/path-owned.jpg' = any(v_all_names)
     )
     or not ('legacy/moved-owner.jpg' = any(v_all_names))
     or not ('legacy/moved-owner-id.jpg' = any(v_all_names))
     or 'trusted/photo-pointer-only.jpg' = any(v_all_names)
     or 'trusted/avatar-pointer-only.jpg' = any(v_all_names)
     or '00000000-0000-4000-8000-000000000002/other.jpg' = any(v_all_names)
     or 'trusted/other-user-pointer.jpg' = any(v_all_names)
     or 'trusted/malicious-pointer-to-other-owner.jpg' = any(v_all_names)
     or '00000000-0000-4000-8000-000000000001/explicit-other-owner.jpg'
       = any(v_all_names) then
    raise exception 'REHEARSAL_STORAGE_WORKLIST_SCOPE_FAILED';
  end if;
  if public.count_account_photo_storage_objects(
    '00000000-0000-4000-8000-000000000001'
  ) <> 1008 then
    raise exception 'REHEARSAL_STORAGE_PREDELETE_COUNT_FAILED';
  end if;
end;
$$;
reset role;

-- Simulate repeated Storage API remove/relist batches. Direct SQL deletion is
-- used only by this disposable database rehearsal.
do $$
declare
  v_names text[];
  v_deleted integer := 0;
  v_batches integer := 0;
  v_batch_deleted integer;
begin
  loop
    select array_agg(object_name order by object_name)
      into v_names
      from public.list_account_photo_storage_objects(
        '00000000-0000-4000-8000-000000000001',
        null,
        1000
      );
    exit when coalesce(pg_catalog.cardinality(v_names), 0) = 0;

    delete from storage.objects
     where bucket_id = 'photos'
       and name = any(v_names);
    get diagnostics v_batch_deleted = row_count;
    v_deleted := v_deleted + v_batch_deleted;
    v_batches := v_batches + 1;
    if v_batches > 2 then
      raise exception 'REHEARSAL_STORAGE_RELIST_DID_NOT_CONVERGE';
    end if;
  end loop;

  if v_deleted <> 1008 or v_batches <> 2 then
    raise exception 'REHEARSAL_STORAGE_BATCH_DELETE_FAILED';
  end if;
  if not exists (
    select 1 from storage.objects as objects
     where objects.bucket_id = 'photos'
       and objects.name = 'trusted/photo-pointer-only.jpg'
       and objects.owner is null and objects.owner_id is null
  ) or not exists (
    select 1 from storage.objects as objects
     where objects.bucket_id = 'photos'
       and objects.name = 'trusted/avatar-pointer-only.jpg'
       and objects.owner is null and objects.owner_id is null
  ) or not exists (
    select 1
      from storage.objects as objects
     where objects.bucket_id = 'photos'
       and objects.name = 'trusted/malicious-pointer-to-other-owner.jpg'
       and objects.owner = '00000000-0000-4000-8000-000000000002'
  ) or not exists (
    select 1
      from storage.objects as objects
     where objects.bucket_id = 'photos'
       and objects.name =
         '00000000-0000-4000-8000-000000000001/explicit-other-owner.jpg'
       and objects.owner_id = '00000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'REHEARSAL_EXPLICIT_OTHER_OWNER_WAS_DELETED';
  end if;
end;
$$;

set role service_role;
do $$
begin
  if public.count_account_photo_storage_objects(
    '00000000-0000-4000-8000-000000000001'
  ) <> 0 then
    raise exception 'REHEARSAL_STORAGE_POSTDELETE_ATTESTATION_FAILED';
  end if;
end;
$$;

-- Apple revocation is intentionally first so a fresh SIWA credential is never
-- queued behind slower provider deletion/reconciliation. Its idempotent retry
-- retains ciphertext and leaves only the terminal manual-fallback boolean.
do $$
declare
  v_step text;
  v_claim text;
  v_payload bytea;
begin
  select claimed.step_name,
         claimed.claim_token,
         claimed.encrypted_payload
    into v_step, v_claim, v_payload
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'dispatch',
      60
    ) as claimed
   where claimed.claimed;
  if v_step <> 'apple_revoke'
     or v_claim is null
     or v_payload is distinct from decode('0102030405060708', 'hex') then
    raise exception 'REHEARSAL_APPLE_NOT_FIRST_OR_CIPHERTEXT_MISSING';
  end if;

  perform public.mark_account_deletion_step_request_started(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'apple_revoke',
    v_claim
  );
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'apple_revoke',
    v_claim,
    'retryable',
    'APPLE_IDEMPOTENT_RETRY',
    clock_timestamp() + interval '10 milliseconds'
  );
  perform pg_catalog.pg_sleep(0.02);

  select claimed.step_name,
         claimed.claim_token,
         claimed.encrypted_payload
    into v_step, v_claim, v_payload
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'dispatch',
      60
    ) as claimed
   where claimed.claimed;
  if v_step <> 'apple_revoke'
     or v_claim is null
     or v_payload is distinct from decode('0102030405060708', 'hex') then
    raise exception 'REHEARSAL_APPLE_SAFE_RETRY_OR_CIPHERTEXT_FAILED';
  end if;
  perform public.mark_account_deletion_step_request_started(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'apple_revoke',
    v_claim
  );
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'apple_revoke',
    v_claim,
    'succeeded',
    'APPLE_MANUAL_REVOCATION_REQUIRED',
    null
  );
end;
$$;

-- First provider dispatch: mark the request before network, then simulate a
-- crash. Lease expiry must become ambiguous, reject dispatch, and require an
-- explicit reconciliation claim.
select operation_id as due_op,
       user_id as due_user,
       claim_token as rc_claim
  from public.claim_next_account_deletion_step('dispatch', 60)
\gset
select pg_catalog.set_config('rehearsal.due_op', :'due_op', false);
select pg_catalog.set_config('rehearsal.due_user', :'due_user', false);
select pg_catalog.set_config('rehearsal.rc_claim', :'rc_claim', false);

select encrypted_payload_octets as rc_payload_octets
  from public.update_account_deletion_step_payload(
    :'op_a'::uuid,
    'revenuecat_delete',
    :'rc_claim',
    decode('51525354', 'hex')
  )
\gset
select pg_catalog.set_config('rehearsal.rc_payload_octets', :'rc_payload_octets', false);
do $$
begin
  if pg_catalog.current_setting('rehearsal.rc_payload_octets')::integer <> 4 then
    raise exception 'REHEARSAL_REVENUECAT_PAYLOAD_CAS_FAILED';
  end if;
  begin
    perform public.update_account_deletion_step_payload(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'revenuecat_delete',
      pg_catalog.current_setting('rehearsal.rc_claim'),
      decode(repeat('aa', 32769), 'hex')
    );
    raise exception 'REHEARSAL_REVENUECAT_OVERSIZE_PAYLOAD_ALLOWED';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;
do $$
begin
  if pg_catalog.current_setting('rehearsal.due_op')::uuid
       is distinct from pg_catalog.current_setting('rehearsal.op_a')::uuid
     or pg_catalog.current_setting('rehearsal.due_user')::uuid
       is distinct from '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'REHEARSAL_DUE_WORKER_CLAIM_SCOPE_FAILED';
  end if;
end;
$$;
select * from public.mark_account_deletion_step_request_started(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'revenuecat_delete',
  :'rc_claim'
);
do $$
begin
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'revenuecat_delete',
    pg_catalog.current_setting('rehearsal.rc_claim'),
    'retryable',
    'UNSAFE_POST_DISPATCH_RETRY',
    clock_timestamp() + interval '1 second'
  );
  raise exception 'REHEARSAL_UNSAFE_REVENUECAT_REDISPATCH_ALLOWED';
exception
  when invalid_parameter_value then
    if sqlerrm <> 'ACCOUNT_DELETION_RETRY_NOT_SAFE_FOR_STEP_STATE' then raise; end if;
end;
$$;
reset role;

update public.account_deletion_steps
   set lease_expires_at = clock_timestamp() - interval '1 second'
 where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
   and step_name = 'revenuecat_delete';

set role service_role;
select * from public.get_account_deletion_status(repeat('a', 64));
select claim_token as rc_reconcile_claim
  from public.claim_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'reconcile',
    60
  )
 where claimed
\gset
select pg_catalog.set_config(
  'rehearsal.rc_reconcile_claim',
  :'rc_reconcile_claim',
  false
);
select * from public.mark_account_deletion_step_request_started(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'revenuecat_delete',
  :'rc_reconcile_claim'
);
select * from public.record_account_deletion_step(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'revenuecat_delete',
  :'rc_reconcile_claim',
  'retryable',
  'RECONCILIATION_RETRY_SAFE',
  clock_timestamp() + interval '1 second'
);
reset role;

update public.account_deletion_steps
   set next_attempt_at = clock_timestamp()
 where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
   and step_name = 'revenuecat_delete';

set role service_role;
select claim_token as rc_reconcile_claim_2
  from public.claim_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'reconcile',
    60
  )
 where claimed
\gset
select * from public.mark_account_deletion_step_request_started(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'revenuecat_delete',
  :'rc_reconcile_claim_2'
);
select * from public.record_account_deletion_step(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'revenuecat_delete',
  :'rc_reconcile_claim_2',
  'succeeded',
  'REVENUECAT_DELETE_ATTESTED',
  null
);
reset role;

-- PostHog recovery evidence is mutable only through the live lease/claim CAS.
-- The original dispatch cutoff survives ambiguity and two reconciliation
-- observations, while bounded ciphertext can evolve without plaintext storage.
set role service_role;
do $$
declare
  v_claim text;
  v_wrong_claim text;
  v_payload bytea;
  v_started_at timestamptz;
  v_payload_octets integer;
  v_payload_digest text;
begin
  select claimed.claim_token,
         claimed.encrypted_payload,
         claimed.request_started_at
    into v_claim, v_payload, v_started_at
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'dispatch',
      60
    ) as claimed
   where claimed.claimed;
  if v_claim is null
     or v_payload is distinct from decode('1112131415161718', 'hex')
     or v_started_at is not null then
    raise exception 'REHEARSAL_POSTHOG_INITIAL_PAYLOAD_OR_CUTOFF_FAILED';
  end if;
  perform pg_catalog.set_config('rehearsal.posthog_dispatch_claim', v_claim, false);
  v_wrong_claim := case
    when pg_catalog.left(v_claim, 1) = '0'
      then '1' || pg_catalog.substr(v_claim, 2)
    else '0' || pg_catalog.substr(v_claim, 2)
  end;

  begin
    perform public.update_account_deletion_step_payload(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'posthog_delete',
      v_wrong_claim,
      decode('21222324', 'hex')
    );
    raise exception 'REHEARSAL_POSTHOG_WRONG_CLAIM_PAYLOAD_UPDATE_ALLOWED';
  exception
    when serialization_failure then
      if sqlerrm <> 'ACCOUNT_DELETION_PAYLOAD_UPDATE_CAS_FAILED' then raise; end if;
  end;

  begin
    perform public.update_account_deletion_step_payload(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'photo_storage_delete',
      v_claim,
      decode('21222324', 'hex')
    );
    raise exception 'REHEARSAL_NONPROVIDER_PAYLOAD_UPDATE_ALLOWED';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'ACCOUNT_DELETION_PAYLOAD_UPDATE_INVALID' then raise; end if;
  end;

  begin
    perform public.update_account_deletion_step_payload(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'posthog_delete',
      v_claim,
      decode(repeat('aa', 32769), 'hex')
    );
    raise exception 'REHEARSAL_OVERSIZE_PROVIDER_PAYLOAD_UPDATE_ALLOWED';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'ACCOUNT_DELETION_PAYLOAD_UPDATE_INVALID' then raise; end if;
  end;

  select updated.encrypted_payload_octets,
         updated.encrypted_payload_digest
    into v_payload_octets, v_payload_digest
    from public.update_account_deletion_step_payload(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'posthog_delete',
      v_claim,
      decode('21222324', 'hex')
    ) as updated;
  if v_payload_octets <> 4
     or v_payload_digest <> pg_catalog.encode(
       extensions.digest(decode('21222324', 'hex'), 'sha256'),
       'hex'
     ) then
    raise exception 'REHEARSAL_PROVIDER_PAYLOAD_ATTESTATION_FAILED';
  end if;

  select started.request_started_at
    into v_started_at
    from public.mark_account_deletion_step_request_started(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'posthog_delete',
      v_claim
    ) as started;
  if v_started_at is null then
    raise exception 'REHEARSAL_POSTHOG_DISPATCH_CUTOFF_MISSING';
  end if;
  perform pg_catalog.set_config(
    'rehearsal.posthog_dispatch_started_at',
    v_started_at::text,
    false
  );

  select updated.request_started_at
    into v_started_at
    from public.update_account_deletion_step_payload(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'posthog_delete',
      v_claim,
      decode('31323334', 'hex')
    ) as updated;
  if v_started_at is distinct from
       pg_catalog.current_setting('rehearsal.posthog_dispatch_started_at')::timestamptz then
    raise exception 'REHEARSAL_POSTHOG_PAYLOAD_LOST_DISPATCH_CUTOFF';
  end if;
end;
$$;
reset role;

update public.account_deletion_steps
   set lease_expires_at = clock_timestamp() - interval '1 second'
 where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
   and step_name = 'posthog_delete';

set role service_role;
do $$
begin
  perform public.update_account_deletion_step_payload(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'posthog_delete',
    pg_catalog.current_setting('rehearsal.posthog_dispatch_claim'),
    decode('41424344', 'hex')
  );
  raise exception 'REHEARSAL_EXPIRED_LEASE_PAYLOAD_UPDATE_ALLOWED';
exception
  when serialization_failure then
    if sqlerrm <> 'ACCOUNT_DELETION_PAYLOAD_UPDATE_CAS_FAILED' then raise; end if;
end;
$$;

do $$
declare
  v_claim text;
  v_payload bytea;
  v_started_at timestamptz;
begin
  select claimed.claim_token,
         claimed.encrypted_payload,
         claimed.request_started_at
    into v_claim, v_payload, v_started_at
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'reconcile',
      60
    ) as claimed
   where claimed.claimed;
  if v_claim is null
     or v_payload is distinct from decode('31323334', 'hex')
     or v_started_at is distinct from
       pg_catalog.current_setting('rehearsal.posthog_dispatch_started_at')::timestamptz then
    raise exception 'REHEARSAL_POSTHOG_FIRST_RECONCILE_RECOVERY_FAILED';
  end if;
  perform pg_catalog.set_config('rehearsal.posthog_reconcile_claim_1', v_claim, false);

  perform public.update_account_deletion_step_payload(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'posthog_delete',
    v_claim,
    decode('41424344', 'hex')
  );
  select started.request_started_at
    into v_started_at
    from public.mark_account_deletion_step_request_started(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'posthog_delete',
      v_claim
    ) as started;
  if v_started_at is distinct from
       pg_catalog.current_setting('rehearsal.posthog_dispatch_started_at')::timestamptz then
    raise exception 'REHEARSAL_RECONCILE_OVERWROTE_DISPATCH_CUTOFF';
  end if;
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'posthog_delete',
    v_claim,
    'retryable',
    'POSTHOG_FIRST_ABSENCE_OBSERVED',
    clock_timestamp() + interval '1 second'
  );
end;
$$;
reset role;

update public.account_deletion_steps
   set next_attempt_at = clock_timestamp()
 where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
   and step_name = 'posthog_delete';

set role service_role;
do $$
declare
  v_claim text;
  v_payload bytea;
  v_started_at timestamptz;
begin
  select claimed.claim_token,
         claimed.encrypted_payload,
         claimed.request_started_at
    into v_claim, v_payload, v_started_at
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      'reconcile',
      60
    ) as claimed
   where claimed.claimed;
  if v_claim is null
     or v_payload is distinct from decode('41424344', 'hex')
     or v_started_at is distinct from
       pg_catalog.current_setting('rehearsal.posthog_dispatch_started_at')::timestamptz then
    raise exception 'REHEARSAL_POSTHOG_SECOND_RECONCILE_RECOVERY_FAILED';
  end if;

  perform public.update_account_deletion_step_payload(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'posthog_delete',
    v_claim,
    decode('51525354', 'hex')
  );
  perform public.mark_account_deletion_step_request_started(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'posthog_delete',
    v_claim
  );
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'posthog_delete',
    v_claim,
    'succeeded',
    'POSTHOG_TWO_ABSENCE_OBSERVATIONS_ATTESTED',
    null
  );
end;
$$;
reset role;

-- Finish the remaining non-Auth steps through the same claim/start/record CAS.
-- Apple already completed first; the local chain remains strict.
do $$
declare
  v_step text;
  v_claim text;
  v_payload bytea;
  v_result text;
begin
  foreach v_step in array array[
    'photo_storage_delete',
    'service_rows_scrub'
  ]::text[] loop
    select claim_token, encrypted_payload
      into v_claim, v_payload
      from public.claim_account_deletion_step(
        pg_catalog.current_setting('rehearsal.op_a')::uuid,
        'dispatch',
        60
      )
     where claimed;
    if v_claim is null then
      raise exception 'REHEARSAL_STEP_NOT_CLAIMED:%', v_step;
    end if;
    if v_payload is not null then
      raise exception 'REHEARSAL_PAYLOAD_EXPOSED_TO_WRONG_STEP:%', v_step;
    end if;

    perform public.mark_account_deletion_step_request_started(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      v_step,
      v_claim
    );
    v_result := case
      when v_step = 'photo_storage_delete' then 'PHOTO_STORAGE_ZERO_ATTESTED'
      else 'SERVICE_ROWS_ZERO_ATTESTED'
    end;
    perform public.record_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      v_step,
      v_claim,
      'succeeded',
      v_result,
      null
    );
  end loop;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1
      from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
       and encrypted_payload is not null
  ) then
    raise exception 'REHEARSAL_PROVIDER_CIPHERTEXT_NOT_REDACTED_AFTER_SUCCESS';
  end if;
end;
$$;

-- The Auth deletion is itself a claimed/started step. The active operation and
-- barrier intentionally survive the Auth row cascade until CAS recording.
set role service_role;
select claim_token as auth_claim
  from public.claim_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_a')::uuid,
    'dispatch',
    60
  )
 where claimed
\gset
select * from public.mark_account_deletion_step_request_started(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'auth_user_delete',
  :'auth_claim'
);
reset role;

delete from auth.users where id = '00000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.account_deletion_operations
     where id = pg_catalog.current_setting('rehearsal.op_a')::uuid
  ) or not exists (
    select 1 from public.account_deletion_barriers
     where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
  ) then
    raise exception 'REHEARSAL_ACTIVE_STATE_DID_NOT_SURVIVE_AUTH_DELETE';
  end if;
end;
$$;

set role service_role;
do $$
begin
  perform public.get_account_deletion_barrier_state(
    '00000000-0000-4000-8000-000000000001'
  );
  raise exception 'REHEARSAL_STALE_AUTH_SUBJECT_PREFLIGHT_CLEARED';
exception
  when insufficient_privilege then
    if sqlerrm <> 'ACCOUNT_DELETION_PREFLIGHT_AUTH_SUBJECT_ABSENT' then raise; end if;
end;
$$;
select * from public.record_account_deletion_step(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  'auth_user_delete',
  :'auth_claim',
  'succeeded',
  'AUTH_USER_ABSENT',
  null
);
insert into storage.objects (bucket_id, name, owner, owner_id) values (
  'photos',
  'late-service-writer-after-step.jpg',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001'
);
do $$
begin
  begin
    perform public.finalize_account_deletion(
      pg_catalog.current_setting('rehearsal.op_a')::uuid,
      repeat('b', 64),
      1::smallint,
      clock_timestamp() + interval '20 minutes'
    );
    raise exception 'REHEARSAL_FINAL_STORAGE_REATTESTATION_MISSING';
  exception
    when raise_exception then
      if sqlerrm <> 'ACCOUNT_DELETION_FINAL_STORAGE_NOT_EMPTY' then raise; end if;
  end;
end;
$$;
delete from storage.objects
 where bucket_id = 'photos'
   and name = 'late-service-writer-after-step.jpg';
select * from public.finalize_account_deletion(
  pg_catalog.current_setting('rehearsal.op_a')::uuid,
  repeat('b', 64),
  1::smallint,
  now() + interval '20 minutes'
);
reset role;

do $$
declare
  v_receipt_text text;
begin
  if exists (
    select 1 from public.account_deletion_operations
     where id = pg_catalog.current_setting('rehearsal.op_a')::uuid
  ) or exists (
    select 1 from public.account_deletion_barriers
     where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
  ) or exists (
    select 1 from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_a')::uuid
  ) or exists (
    select 1 from public.edge_rate_limits
     where owner_user_id = '00000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'REHEARSAL_FINALIZE_RETAINED_ACTIVE_STATE_OR_OWNER_LIMITER';
  end if;

  select pg_catalog.to_jsonb(receipts)::text
    into v_receipt_text
    from public.account_deletion_receipts as receipts
   where receipts.subject_hmac_key_version = 1
     and receipts.subject_hmac = repeat('b', 64);
  if v_receipt_text is null
     or v_receipt_text not like '%"apple_manual_revocation_required": true%'
     or v_receipt_text not like '%"receipt_state": "completed"%'
     or v_receipt_text not like '%"capability_digest"%'
     or v_receipt_text like '%00000000-0000-4000-8000-000000000001%'
     or v_receipt_text like '%aaaaaaaaaaaaaaaa%'
     or v_receipt_text like '%idempotency%'
     or v_receipt_text like '%operation_id%' then
    raise exception 'REHEARSAL_TERMINAL_RECEIPT_PRIVACY_OR_MANUAL_NOTICE_FAILED';
  end if;
end;
$$;

set role service_role;
do $$
declare
  v_state text;
  v_manual boolean;
begin
  select operation_state, apple_manual_revocation_required
    into v_state, v_manual
    from public.get_account_deletion_status(repeat('a', 64));
  if v_state <> 'completed' or v_manual is distinct from true then
    raise exception 'REHEARSAL_CAPABILITY_ONLY_TERMINAL_RECOVERY_FAILED';
  end if;
end;
$$;
reset role;

-- Provider and first-party deletion are independent lanes after each provider
-- has been attempted. RC and PostHog ambiguity must not retain local data; the
-- receipt still waits until both provider reconciliations succeed.
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000006');
insert into storage.objects (bucket_id, name, owner, owner_id) values (
  'photos',
  '00000000-0000-4000-8000-000000000006/late-object.jpg',
  null,
  null
);
set role service_role;
select operation_id as lane_op
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000006',
    repeat('1', 64),
    repeat('e', 64),
    now() + interval '20 minutes',
    null,
    null,
    decode('ababcdcd', 'hex')
  )
\gset
select pg_catalog.set_config('rehearsal.lane_op', :'lane_op', false);

do $$
declare
  v_expected_step text;
  v_step text;
  v_claim text;
begin
  foreach v_expected_step in array array[
    'apple_revoke',
    'revenuecat_delete',
    'posthog_delete'
  ]::text[] loop
    select claimed.step_name, claimed.claim_token
      into v_step, v_claim
      from public.claim_account_deletion_step(
        pg_catalog.current_setting('rehearsal.lane_op')::uuid,
        'dispatch',
        60
      ) as claimed
     where claimed.claimed;
    if v_step is distinct from v_expected_step or v_claim is null then
      raise exception 'REHEARSAL_PROVIDER_DISPATCH_ORDER_FAILED:%', v_expected_step;
    end if;
    perform public.mark_account_deletion_step_request_started(
      pg_catalog.current_setting('rehearsal.lane_op')::uuid,
      v_step,
      v_claim
    );
    perform public.record_account_deletion_step(
      pg_catalog.current_setting('rehearsal.lane_op')::uuid,
      v_step,
      v_claim,
      case when v_step = 'apple_revoke' then 'succeeded' else 'ambiguous' end,
      case
        when v_step = 'apple_revoke' then 'APPLE_REVOCATION_ATTESTED'
        when v_step = 'revenuecat_delete' then 'REVENUECAT_REQUEST_OUTCOME_UNKNOWN'
        else 'POSTHOG_REQUEST_OUTCOME_UNKNOWN'
      end,
      null
    );
  end loop;

  foreach v_expected_step in array array[
    'photo_storage_delete',
    'service_rows_scrub',
    'auth_user_delete'
  ]::text[] loop
    select claimed.step_name, claimed.claim_token
      into v_step, v_claim
      from public.claim_account_deletion_step(
        pg_catalog.current_setting('rehearsal.lane_op')::uuid,
        'dispatch',
        60
      ) as claimed
     where claimed.claimed;
    if v_step is distinct from v_expected_step or v_claim is null then
      raise exception 'REHEARSAL_PROVIDER_AMBIGUITY_BLOCKED_LOCAL_STEP:%', v_expected_step;
    end if;

    if v_step = 'service_rows_scrub' then
      perform public.scrub_account_service_rows(
        '00000000-0000-4000-8000-000000000006'
      );
      perform public.record_account_deletion_step(
        pg_catalog.current_setting('rehearsal.lane_op')::uuid,
        v_step,
        v_claim,
        'succeeded',
        'SERVICE_ROWS_ZERO_ATTESTED',
        null
      );
    else
      perform public.mark_account_deletion_step_request_started(
        pg_catalog.current_setting('rehearsal.lane_op')::uuid,
        v_step,
        v_claim
      );
      if v_step = 'auth_user_delete' then
        perform pg_catalog.set_config('rehearsal.lane_auth_claim', v_claim, false);
        exit;
      end if;
      if v_step = 'photo_storage_delete' then
        begin
          perform public.record_account_deletion_step(
            pg_catalog.current_setting('rehearsal.lane_op')::uuid,
            v_step,
            v_claim,
            'succeeded',
            'PHOTO_STORAGE_ZERO_ATTESTED',
            null
          );
          raise exception 'REHEARSAL_STORAGE_FALSE_ZERO_ATTESTATION_ALLOWED';
        exception
          when raise_exception then
            if sqlerrm <> 'ACCOUNT_DELETION_PHOTO_STORAGE_STILL_PRESENT' then raise; end if;
        end;
        delete from storage.objects
         where bucket_id = 'photos'
           and name = '00000000-0000-4000-8000-000000000006/late-object.jpg';
      end if;
      perform public.record_account_deletion_step(
        pg_catalog.current_setting('rehearsal.lane_op')::uuid,
        v_step,
        v_claim,
        'succeeded',
        'PHOTO_STORAGE_ZERO_ATTESTED',
        null
      );
    end if;
  end loop;
end;
$$;
reset role;

delete from auth.users where id = '00000000-0000-4000-8000-000000000006';
set role service_role;
select * from public.record_account_deletion_step(
  pg_catalog.current_setting('rehearsal.lane_op')::uuid,
  'auth_user_delete',
  pg_catalog.current_setting('rehearsal.lane_auth_claim'),
  'succeeded',
  'AUTH_USER_ABSENT',
  null
);

do $$
declare
  v_state text;
begin
  select operation_state
    into v_state
    from public.get_account_deletion_status(repeat('e', 64));
  if v_state <> 'action_required' then
    raise exception 'REHEARSAL_LOCAL_ERASURE_WITH_PROVIDER_PENDING_NOT_DELAYED';
  end if;

  begin
    perform public.finalize_account_deletion(
      pg_catalog.current_setting('rehearsal.lane_op')::uuid,
      repeat('6', 64),
      6::smallint,
      clock_timestamp() + interval '10 minutes'
    );
    raise exception 'REHEARSAL_RECEIPT_CREATED_BEFORE_PROVIDER_RECONCILIATION';
  exception
    when raise_exception then
      if sqlerrm <> 'ACCOUNT_DELETION_NOT_READY_TO_FINALIZE' then raise; end if;
  end;
end;
$$;

do $$
declare
  v_expected_step text;
  v_step text;
  v_claim text;
begin
  foreach v_expected_step in array array[
    'revenuecat_delete',
    'posthog_delete'
  ]::text[] loop
    select claimed.step_name, claimed.claim_token
      into v_step, v_claim
      from public.claim_account_deletion_step(
        pg_catalog.current_setting('rehearsal.lane_op')::uuid,
        'reconcile',
        60
      ) as claimed
     where claimed.claimed;
    if v_step is distinct from v_expected_step or v_claim is null then
      raise exception 'REHEARSAL_PROVIDER_RECONCILE_LANE_FAILED:%', v_expected_step;
    end if;
    perform public.mark_account_deletion_step_request_started(
      pg_catalog.current_setting('rehearsal.lane_op')::uuid,
      v_step,
      v_claim
    );
    perform public.record_account_deletion_step(
      pg_catalog.current_setting('rehearsal.lane_op')::uuid,
      v_step,
      v_claim,
      'succeeded',
      case
        when v_step = 'revenuecat_delete' then 'REVENUECAT_DELETE_ATTESTED'
        else 'POSTHOG_DELETE_ATTESTED'
      end,
      null
    );
  end loop;
end;
$$;

select * from public.finalize_account_deletion(
  pg_catalog.current_setting('rehearsal.lane_op')::uuid,
  repeat('6', 64),
  6::smallint,
  now() + interval '10 minutes'
);
reset role;

-- A provider classification can stop in a durable, capability-visible
-- action_required state without persisting a response body.
set role service_role;
select operation_id as op_b
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000002',
    repeat('3', 64),
    repeat('2', 64),
    now() + interval '10 minutes',
    null,
    null,
    null
  )
\gset
select pg_catalog.set_config('rehearsal.op_b', :'op_b', false);
select claim_token as action_claim
  from public.claim_account_deletion_step(:'op_b'::uuid, 'dispatch', 60)
 where claimed
\gset
select * from public.mark_account_deletion_step_request_started(
  :'op_b'::uuid,
  'apple_revoke',
  :'action_claim'
);
select * from public.record_account_deletion_step(
  :'op_b'::uuid,
  'apple_revoke',
  :'action_claim',
  'action_required',
  'APPLE_OPERATOR_RECONCILIATION_REQUIRED',
  null
);
reset role;

-- A provider action_required settles the provider dispatch gate. Once the
-- other providers are resolved it must permit local erasure, while a local
-- action_required strictly blocks scrub/Auth.
update public.account_deletion_steps
   set status = 'succeeded',
       completed_at = clock_timestamp(),
       result_code = 'TEST_PROVIDER_SETTLED',
       encrypted_payload = null,
       updated_at = clock_timestamp()
 where operation_id = :'op_b'::uuid
   and step_name in ('revenuecat_delete', 'posthog_delete');

set role service_role;
select step_name as local_failure_step,
       claim_token as local_failure_claim
  from public.claim_account_deletion_step(:'op_b'::uuid, 'dispatch', 60)
 where claimed
\gset
select pg_catalog.set_config(
  'rehearsal.local_failure_step',
  :'local_failure_step',
  false
);
do $$
begin
  if pg_catalog.current_setting('rehearsal.local_failure_step')
       <> 'photo_storage_delete' then
    raise exception 'REHEARSAL_PROVIDER_ACTION_REQUIRED_BLOCKED_LOCAL_ERASURE';
  end if;
end;
$$;
select * from public.mark_account_deletion_step_request_started(
  :'op_b'::uuid,
  'photo_storage_delete',
  :'local_failure_claim'
);
select * from public.record_account_deletion_step(
  :'op_b'::uuid,
  'photo_storage_delete',
  :'local_failure_claim',
  'action_required',
  'PHOTO_STORAGE_OPERATOR_ACTION_REQUIRED',
  null
);
do $$
declare
  v_claimed boolean;
begin
  select claimed
    into v_claimed
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_b')::uuid,
      'dispatch',
      60
    );
  if v_claimed then
    raise exception 'REHEARSAL_LOCAL_FAILURE_DID_NOT_BLOCK_LATER_LOCAL_STEP';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1
      from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_b')::uuid
       and step_name = 'service_rows_scrub'
       and status = 'pending'
  ) or not exists (
    select 1
      from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_b')::uuid
       and step_name = 'auth_user_delete'
       and status = 'pending'
  ) then
    raise exception 'REHEARSAL_LOCAL_CHAIN_ADVANCED_AFTER_LOCAL_FAILURE';
  end if;
end;
$$;

set role service_role;
do $$
declare
  v_state text;
  v_step_state text;
begin
  select operation_state, next_step_status
    into v_state, v_step_state
    from public.get_account_deletion_status(repeat('2', 64));
  if v_state <> 'action_required' or v_step_state <> 'action_required' then
    raise exception 'REHEARSAL_ACTION_REQUIRED_STATUS_FAILED';
  end if;
end;
$$;
reset role;

-- Action-required work has a replay-protected, safety-aware recovery path.
set role service_role;
do $$
begin
  begin
    perform public.recover_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_b')::uuid,
      'apple_revoke',
      'dispatch',
      repeat('a', 64),
      'PROVIDER_RECOVERY_APPROVED'
    );
    raise exception 'REHEARSAL_UNSAFE_OPERATOR_REDISPATCH_ALLOWED';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'ACCOUNT_DELETION_RECOVERY_UNSAFE_REDISPATCH' then raise; end if;
  end;

  perform public.recover_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_b')::uuid,
    'apple_revoke',
    'reconcile',
    repeat('a', 64),
    'PROVIDER_RECOVERY_APPROVED'
  );
  begin
    perform public.recover_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_b')::uuid,
      'apple_revoke',
      'reconcile',
      repeat('a', 64),
      'PROVIDER_RECOVERY_APPROVED'
    );
    raise exception 'REHEARSAL_OPERATOR_COMMAND_REPLAY_ALLOWED';
  exception
    when unique_violation then
      if sqlerrm <> 'ACCOUNT_DELETION_RECOVERY_COMMAND_REPLAYED' then raise; end if;
  end;
  begin
    perform public.recover_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_b')::uuid,
      'apple_revoke',
      'reconcile',
      repeat('b', 64),
      'PROVIDER_RECOVERY_APPROVED'
    );
    raise exception 'REHEARSAL_OPERATOR_WRONG_STATE_ALLOWED';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

select step_name as recovery_step, claim_token as recovery_claim
  from public.claim_account_deletion_step(:'op_b'::uuid, 'reconcile', 60)
 where claimed
\gset
select * from public.mark_account_deletion_step_request_started(
  :'op_b'::uuid, :'recovery_step', :'recovery_claim'
);
select * from public.record_account_deletion_step(
  :'op_b'::uuid, :'recovery_step', :'recovery_claim', 'succeeded',
  'APPLE_MANUAL_REVOCATION_RECORDED', null
);
select * from public.recover_account_deletion_step(
  :'op_b'::uuid,
  'photo_storage_delete',
  'reconcile',
  repeat('c', 64),
  'LOCAL_RETRY_APPROVED'
);
select step_name as recovery_photo_step, claim_token as recovery_photo_claim
  from public.claim_account_deletion_step(:'op_b'::uuid, 'reconcile', 60)
 where claimed
\gset
select * from public.mark_account_deletion_step_request_started(
  :'op_b'::uuid, :'recovery_photo_step', :'recovery_photo_claim'
);
delete from storage.objects as objects
 where objects.bucket_id = 'photos'
   and objects.name in (
     select object_name
       from public.list_account_photo_storage_objects(
         '00000000-0000-4000-8000-000000000002', null, 1000
       )
   );
select * from public.record_account_deletion_step(
  :'op_b'::uuid, :'recovery_photo_step', :'recovery_photo_claim', 'succeeded',
  'PHOTO_STORAGE_ZERO_ATTESTED', null
);
select step_name as recovery_scrub_step, claim_token as recovery_scrub_claim
  from public.claim_account_deletion_step(:'op_b'::uuid, 'dispatch', 60)
 where claimed
\gset
select public.scrub_account_service_rows('00000000-0000-4000-8000-000000000002');
select * from public.record_account_deletion_step(
  :'op_b'::uuid, :'recovery_scrub_step', :'recovery_scrub_claim', 'succeeded',
  'SERVICE_ROWS_ZERO_ATTESTED', null
);
select step_name as recovery_auth_step, claim_token as recovery_auth_claim
  from public.claim_account_deletion_step(:'op_b'::uuid, 'dispatch', 60)
 where claimed
\gset
select * from public.mark_account_deletion_step_request_started(
  :'op_b'::uuid, :'recovery_auth_step', :'recovery_auth_claim'
);
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-000000000002';
set role service_role;
select * from public.record_account_deletion_step(
  :'op_b'::uuid, :'recovery_auth_step', :'recovery_auth_claim', 'succeeded',
  'AUTH_USER_ABSENT', null
);
select operation_id as discovered_finalize_op
  from public.list_account_deletions_ready_to_finalize(100)
 where operation_id = :'op_b'::uuid
\gset
select pg_catalog.set_config(
  'rehearsal.discovered_finalize_op',
  :'discovered_finalize_op',
  false
);
do $$
begin
  if pg_catalog.current_setting('rehearsal.discovered_finalize_op')::uuid
       <> pg_catalog.current_setting('rehearsal.op_b')::uuid then
    raise exception 'REHEARSAL_READY_TO_FINALIZE_CRASH_DISCOVERY_FAILED';
  end if;
end;
$$;
select * from public.finalize_account_deletion(
  :'op_b'::uuid, repeat('2', 64), 2::smallint, now() + interval '10 minutes'
);
-- A second worker that lost the race returns the existing receipt.
select * from public.finalize_account_deletion(
  :'op_b'::uuid, repeat('2', 64), 2::smallint, now() + interval '10 minutes'
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.account_deletion_operator_recovery_audit
     where operation_id = pg_catalog.current_setting('rehearsal.op_b')::uuid
  ) then
    raise exception 'REHEARSAL_OPERATOR_AUDIT_DID_NOT_SURVIVE_FINALIZATION';
  end if;
end;
$$;

update public.account_deletion_operator_recovery_audit
   set created_at = clock_timestamp() - interval '31 days',
       expires_at = clock_timestamp() - interval '1 day'
 where operation_id = pg_catalog.current_setting('rehearsal.op_b')::uuid;

-- Attempts are bounded. A pre-dispatch retry is safe, but the next claim after
-- the configured cap becomes action_required instead of looping forever.
set role service_role;
select operation_id as op_d
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000004',
    repeat('6', 64),
    repeat('4', 64),
    now() + interval '10 minutes',
    null,
    null,
    null
  )
\gset
select pg_catalog.set_config('rehearsal.op_d', :'op_d', false);
reset role;

update public.account_deletion_steps
   set max_attempts = 1
 where operation_id = pg_catalog.current_setting('rehearsal.op_d')::uuid
   and step_name = 'apple_revoke';

set role service_role;
select claim_token as max_claim
  from public.claim_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_d')::uuid,
    'dispatch',
    60
  )
 where claimed
\gset
select * from public.record_account_deletion_step(
  pg_catalog.current_setting('rehearsal.op_d')::uuid,
  'apple_revoke',
  :'max_claim',
  'retryable',
  'NETWORK_NOT_STARTED',
  clock_timestamp() + interval '1 second'
);
reset role;

update public.account_deletion_steps
   set next_attempt_at = clock_timestamp()
 where operation_id = pg_catalog.current_setting('rehearsal.op_d')::uuid
   and step_name = 'apple_revoke';

set role service_role;
do $$
declare
  v_claimed boolean;
  v_state text;
  v_step_state text;
begin
  select claimed, operation_state, step_status
    into v_claimed, v_state, v_step_state
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_d')::uuid,
      'dispatch',
      60
    );
  if v_claimed or v_state <> 'running' or v_step_state <> 'action_required' then
    raise exception 'REHEARSAL_MAX_ATTEMPTS_NOT_ENFORCED';
  end if;
end;
$$;
reset role;

update public.account_deletion_steps
   set status = 'succeeded',
       completed_at = clock_timestamp(),
       result_code = 'TEST_PROVIDER_SETTLED',
       encrypted_payload = null,
       updated_at = clock_timestamp()
 where operation_id = pg_catalog.current_setting('rehearsal.op_d')::uuid
   and step_name in ('revenuecat_delete', 'posthog_delete');

set role service_role;
do $$
declare
  v_step text;
  v_claim text;
begin
  select claimed.step_name, claimed.claim_token
    into v_step, v_claim
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_d')::uuid,
      'dispatch',
      60
    ) as claimed
   where claimed.claimed;
  if v_step <> 'photo_storage_delete' or v_claim is null then
    raise exception 'REHEARSAL_PROVIDER_MAX_ATTEMPTS_BLOCKED_LOCAL_ERASURE';
  end if;
  perform public.mark_account_deletion_step_request_started(
    pg_catalog.current_setting('rehearsal.op_d')::uuid,
    v_step,
    v_claim
  );
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_d')::uuid,
    v_step,
    v_claim,
    'succeeded',
    'PHOTO_STORAGE_ZERO_ATTESTED',
    null
  );

  select claimed.step_name, claimed.claim_token
    into v_step, v_claim
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_d')::uuid,
      'dispatch',
      60
    ) as claimed
   where claimed.claimed;
  if v_step <> 'service_rows_scrub' or v_claim is null then
    raise exception 'REHEARSAL_PROVIDER_MAX_ATTEMPTS_BLOCKED_SERVICE_SCRUB';
  end if;
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_d')::uuid,
    v_step,
    v_claim,
    'succeeded',
    'SERVICE_ROWS_ZERO_ATTESTED',
    null
  );

  select claimed.step_name, claimed.claim_token
    into v_step, v_claim
    from public.claim_account_deletion_step(
      pg_catalog.current_setting('rehearsal.op_d')::uuid,
      'dispatch',
      60
    ) as claimed
   where claimed.claimed;
  if v_step <> 'auth_user_delete' or v_claim is null then
    raise exception 'REHEARSAL_PROVIDER_MAX_ATTEMPTS_BLOCKED_AUTH_ERASURE';
  end if;
  perform public.record_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_d')::uuid,
    v_step,
    v_claim,
    'action_required',
    'TEST_AUTH_NOT_DELETED',
    null
  );
end;
$$;
reset role;

-- A due provider reconciliation cannot starve first-party erasure recovery.
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000007');
set role service_role;
select operation_id as fairness_op
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000007',
    repeat('f', 64),
    repeat('1', 64),
    now() + interval '10 minutes',
    null, null, null
  )
\gset
reset role;
update public.account_deletion_steps
   set status = case step_name
         when 'apple_revoke' then 'succeeded'
         when 'revenuecat_delete' then 'ambiguous'
         when 'posthog_delete' then 'action_required'
         when 'photo_storage_delete' then 'ambiguous'
         else status
       end,
       attempt_count = case when step_order <= 40 then 1 else attempt_count end,
       request_started_at = case
         when step_name in ('revenuecat_delete', 'photo_storage_delete') then now()
         else request_started_at
       end,
       completed_at = case when step_name = 'apple_revoke' then now() else null end,
       result_code = case
         when step_name = 'apple_revoke' then 'APPLE_REVOKED'
         when step_name = 'revenuecat_delete' then 'REVENUECAT_REQUEST_OUTCOME_UNKNOWN'
         when step_name = 'posthog_delete' then 'POSTHOG_OPERATOR_REQUIRED'
         when step_name = 'photo_storage_delete' then 'PHOTO_STORAGE_REQUEST_OUTCOME_UNKNOWN'
         else result_code
       end
 where operation_id = :'fairness_op'::uuid;
set role service_role;
select step_name as fairness_claim_step
  from public.claim_account_deletion_step(:'fairness_op'::uuid, 'reconcile', 60)
 where claimed
\gset
select pg_catalog.set_config('rehearsal.fairness_claim_step', :'fairness_claim_step', false);
reset role;
do $$
begin
  if pg_catalog.current_setting('rehearsal.fairness_claim_step') <> 'photo_storage_delete' then
    raise exception 'REHEARSAL_PROVIDER_RECONCILE_STARVED_LOCAL_RECOVERY';
  end if;
end;
$$;

-- Expired active artifacts redact credentials immediately but never remove the
-- barrier while Auth remains live. Once Auth is absent, bounded cleanup removes
-- the nonterminal operation. Expired terminal receipts and rate buckets purge in
-- deterministic order.
set role service_role;
select operation_id as op_c
  from public.begin_account_deletion(
    '00000000-0000-4000-8000-000000000003',
    repeat('d', 64),
    repeat('c', 64),
    now() + interval '10 minutes',
    decode('aabbccdd', 'hex'),
    decode('11223344', 'hex'),
    decode('eeff0011', 'hex')
  )
\gset
select pg_catalog.set_config('rehearsal.op_c', :'op_c', false);
reset role;

update public.account_deletion_operations
   set created_at = clock_timestamp() - interval '2 hours',
       expires_at = clock_timestamp() - interval '1 hour'
 where id = pg_catalog.current_setting('rehearsal.op_c')::uuid;
update public.account_deletion_barriers
   set created_at = clock_timestamp() - interval '2 hours',
       expires_at = clock_timestamp() - interval '1 hour'
 where operation_id = pg_catalog.current_setting('rehearsal.op_c')::uuid;

insert into public.account_deletion_receipts (
  capability_digest,
  receipt_state,
  subject_hmac_key_version,
  subject_hmac,
  apple_manual_revocation_required,
  completed_at,
  expires_at,
  purge_after
) values (
  repeat('f', 64),
  'completed',
  2,
  repeat('d', 64),
  false,
  clock_timestamp() - interval '2 hours',
  clock_timestamp() - interval '1 hour',
  clock_timestamp() - interval '30 minutes'
);

insert into public.account_deletion_receipts (
  capability_digest, receipt_state, subject_hmac_key_version, subject_hmac,
  apple_manual_revocation_required, completed_at, expires_at, purge_after
) values (
  public._account_deletion_capability_digest(repeat('5', 64)),
  'completed',
  3,
  repeat('e', 64),
  false,
  clock_timestamp() - interval '2 hours',
  clock_timestamp() - interval '1 hour',
  clock_timestamp() + interval '1 hour'
);

set role service_role;
do $$
declare
  v_state text;
begin
  select operation_state into v_state
    from public.get_account_deletion_status(repeat('5', 64));
  if v_state <> 'expired' then
    raise exception 'REHEARSAL_EXPIRED_CAPABILITY_GRACE_FAILED';
  end if;
  if exists (
    select 1 from public.get_account_deletion_status(repeat('0', 64))
  ) then
    raise exception 'REHEARSAL_INVALID_CAPABILITY_NOT_DISTINGUISHED';
  end if;
end;
$$;
reset role;

insert into public.edge_rate_limits (
  scope,
  key_hash,
  owner_user_id,
  window_start,
  window_seconds,
  request_count,
  expires_at
) values (
  'waitlist',
  repeat('e', 64),
  null,
  date_trunc('minute', clock_timestamp() - interval '2 hours'),
  60,
  1,
  date_trunc('minute', clock_timestamp() - interval '2 hours') + interval '1 hour'
);

set role service_role;
select * from public.purge_expired_account_deletion_artifacts(100);
select public.purge_expired_edge_rate_limits(100);
reset role;

do $$
begin
  if not exists (
    select 1
     from public.account_deletion_operations
     where id = pg_catalog.current_setting('rehearsal.op_c')::uuid
       and state in ('pending', 'running')
  ) or not exists (
    select 1 from public.account_deletion_barriers
     where operation_id = pg_catalog.current_setting('rehearsal.op_c')::uuid
  ) or exists (
    select 1
      from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_c')::uuid
       and step_name = 'apple_revoke'
       and encrypted_payload is not null
  ) or not exists (
    select 1
      from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_c')::uuid
       and step_name = 'apple_revoke'
       and status = 'succeeded'
       and result_code = 'APPLE_MANUAL_REVOCATION_RECORDED'
  ) or (
    select count(*)
      from public.account_deletion_steps
     where operation_id = pg_catalog.current_setting('rehearsal.op_c')::uuid
       and step_name in ('revenuecat_delete', 'posthog_delete')
       and encrypted_payload is not null
  ) <> 2 then
    raise exception 'REHEARSAL_EXPIRED_LIVE_ACCOUNT_FAIL_CLOSED_FAILED';
  end if;
  if exists (
    select 1
      from public.account_deletion_receipts
     where subject_hmac_key_version = 2 and subject_hmac = repeat('d', 64)
  ) or exists (
    select 1 from public.edge_rate_limits where key_hash = repeat('e', 64)
  ) or exists (
    select 1 from public.account_deletion_operator_recovery_audit
     where operation_id = pg_catalog.current_setting('rehearsal.op_b')::uuid
  ) then
    raise exception 'REHEARSAL_EXPIRED_TERMINAL_PURGE_FAILED';
  end if;
end;
$$;

delete from auth.users where id = '00000000-0000-4000-8000-000000000003';
set role service_role;
select * from public.purge_expired_account_deletion_artifacts(100);
select step_name as expired_claim_step
  from public.claim_account_deletion_step(
    pg_catalog.current_setting('rehearsal.op_c')::uuid,
    'dispatch',
    60
  )
 where claimed
\gset
select pg_catalog.set_config('rehearsal.expired_claim_step', :'expired_claim_step', false);
reset role;

do $$
declare
  v_state text;
begin
  if not exists (
    select 1 from public.account_deletion_operations
     where id = pg_catalog.current_setting('rehearsal.op_c')::uuid
  ) or not exists (
    select 1 from public.account_deletion_barriers
     where operation_id = pg_catalog.current_setting('rehearsal.op_c')::uuid
  ) then
    raise exception 'REHEARSAL_EXPIRED_ABSENT_ACCOUNT_WORK_NOT_RETAINED';
  end if;
  select operation_state
    into v_state
    from public.get_account_deletion_status(repeat('c', 64));
  if v_state not in ('pending', 'running')
     or pg_catalog.current_setting('rehearsal.expired_claim_step') <> 'revenuecat_delete' then
    raise exception 'REHEARSAL_EXPIRED_ABSENT_ACCOUNT_NOT_RESUMABLE';
  end if;
end;
$$;

select 'ACCOUNT_DELETION_LIFECYCLE_POSTGRES_REHEARSAL_PASS' as result;
