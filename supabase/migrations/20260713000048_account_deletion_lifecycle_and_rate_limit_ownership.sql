-- =============================================================================
-- DB-10 · durable account-deletion lifecycle and account-owned rate limits
-- =============================================================================
-- Active deletion state intentionally keeps the Auth UUID only while work is
-- unfinished. Terminal receipts retain only a domain-separated keyed HMAC, one
-- key version, a manual-Apple-action flag, and finite timestamps. Provider
-- bodies, handles, credentials, raw UUIDs, and free-form errors are forbidden.

begin;

-- -----------------------------------------------------------------------------
-- Durable active state, finite terminal receipt, and per-account serialization
-- -----------------------------------------------------------------------------

create table public.account_deletion_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  idempotency_digest text not null unique
    check (idempotency_digest ~ '^[a-f0-9]{64}$'),
  capability_digest text not null unique
    check (capability_digest ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending'
    check (state in (
      'pending',
      'running',
      'action_required',
      'ready_to_finalize'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (id, user_id),
  unique (user_id, idempotency_digest),
  check (idempotency_digest <> capability_digest),
  check (
    pg_catalog.isfinite(expires_at)
    and expires_at > created_at
    and expires_at <= created_at + interval '30 days'
  )
);

-- No Auth FK is deliberate: the barrier and operation must survive an Auth
-- hard-delete until the worker records that step and atomically finalizes.
create table public.account_deletion_barriers (
  user_id uuid primary key,
  operation_id uuid not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (operation_id, user_id)
    references public.account_deletion_operations (id, user_id)
    on delete cascade,
  check (
    pg_catalog.isfinite(expires_at)
    and expires_at > created_at
    and expires_at <= created_at + interval '30 days'
  )
);

create table public.account_deletion_steps (
  operation_id uuid not null
    references public.account_deletion_operations (id) on delete cascade,
  step_name text not null,
  step_order smallint not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'leased', 'request_started', 'ambiguous', 'action_required', 'succeeded'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 12 check (max_attempts between 1 and 100),
  next_attempt_at timestamptz,
  lease_kind text check (lease_kind in ('dispatch', 'reconcile')),
  claim_digest text check (claim_digest is null or claim_digest ~ '^[a-f0-9]{64}$'),
  lease_expires_at timestamptz,
  request_started_at timestamptz,
  completed_at timestamptz,
  result_code text check (result_code is null or result_code ~ '^[A-Z0-9_]{1,64}$'),
  encrypted_payload bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (operation_id, step_name),
  unique (operation_id, step_order),
  check (
    (step_name = 'apple_revoke' and step_order = 10)
    or (step_name = 'revenuecat_delete' and step_order = 20)
    or (step_name = 'posthog_delete' and step_order = 30)
    or (step_name = 'photo_storage_delete' and step_order = 40)
    or (step_name = 'service_rows_scrub' and step_order = 50)
    or (step_name = 'auth_user_delete' and step_order = 60)
  ),
  check (
    encrypted_payload is null
    or (
      step_name = 'apple_revoke'
      and pg_catalog.octet_length(encrypted_payload) between 1 and 8192
    )
    or (
      step_name = 'revenuecat_delete'
      and pg_catalog.octet_length(encrypted_payload) between 1 and 32768
    )
    or (
      step_name = 'posthog_delete'
      and pg_catalog.octet_length(encrypted_payload) between 1 and 32768
    )
  ),
  check (
    (
      status in ('pending', 'ambiguous', 'action_required', 'succeeded')
      and lease_kind is null
      and claim_digest is null
      and lease_expires_at is null
    )
    or (
      status in ('leased', 'request_started')
      and lease_kind is not null
      and claim_digest is not null
      and lease_expires_at is not null
      and pg_catalog.isfinite(lease_expires_at)
    )
  ),
  check (attempt_count <= max_attempts),
  check (next_attempt_at is null or pg_catalog.isfinite(next_attempt_at)),
  check (request_started_at is null or pg_catalog.isfinite(request_started_at)),
  check (completed_at is null or pg_catalog.isfinite(completed_at)),
  check (
    (status = 'request_started' and request_started_at is not null)
    or status <> 'request_started'
  ),
  check (
    (status = 'succeeded' and completed_at is not null)
    or (status <> 'succeeded' and completed_at is null)
  )
);

create table public.account_deletion_receipts (
  capability_digest text primary key
    check (capability_digest ~ '^[a-f0-9]{64}$'),
  receipt_state text not null check (receipt_state in ('completed', 'action_required')),
  subject_hmac_key_version smallint
    check (subject_hmac_key_version between 1 and 32767),
  subject_hmac text check (subject_hmac is null or subject_hmac ~ '^[a-f0-9]{64}$'),
  apple_manual_revocation_required boolean not null,
  completed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  purge_after timestamptz not null,
  check (
    (receipt_state = 'completed' and subject_hmac_key_version is not null and subject_hmac is not null)
    or (receipt_state = 'action_required' and subject_hmac_key_version is null and subject_hmac is null)
  ),
  check (
    pg_catalog.isfinite(expires_at)
    and expires_at > completed_at
    and expires_at <= completed_at + interval '30 days'
  ),
  check (
    pg_catalog.isfinite(purge_after)
    and purge_after > expires_at
    and purge_after <= expires_at + interval '7 days'
  )
);

create table public.account_deletion_operator_recovery_audit (
  command_digest text primary key check (command_digest ~ '^[a-f0-9]{64}$'),
  operation_id uuid not null,
  step_name text not null check (step_name in (
    'apple_revoke', 'revenuecat_delete', 'posthog_delete',
    'photo_storage_delete', 'service_rows_scrub', 'auth_user_delete'
  )),
  recovery_mode text not null check (recovery_mode in ('dispatch', 'reconcile')),
  reason_code text not null check (reason_code in (
    'CONFIGURATION_REPAIRED',
    'PROVIDER_RECOVERY_APPROVED',
    'LOCAL_RETRY_APPROVED',
    'TRANSIENT_INCIDENT_RESOLVED'
  )),
  prior_result_code text check (
    prior_result_code is null or prior_result_code ~ '^[A-Z0-9_]{1,64}$'
  ),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  check (
    pg_catalog.isfinite(created_at)
    and pg_catalog.isfinite(expires_at)
    and expires_at > created_at
  )
);

alter table public.account_deletion_operations enable row level security;
alter table public.account_deletion_operations force row level security;
alter table public.account_deletion_barriers enable row level security;
alter table public.account_deletion_barriers force row level security;
alter table public.account_deletion_steps enable row level security;
alter table public.account_deletion_steps force row level security;
alter table public.account_deletion_receipts enable row level security;
alter table public.account_deletion_receipts force row level security;
alter table public.account_deletion_operator_recovery_audit enable row level security;
alter table public.account_deletion_operator_recovery_audit force row level security;

revoke all on table public.account_deletion_operations from public, anon, authenticated, service_role;
revoke all on table public.account_deletion_barriers from public, anon, authenticated, service_role;
revoke all on table public.account_deletion_steps from public, anon, authenticated, service_role;
revoke all on table public.account_deletion_receipts from public, anon, authenticated, service_role;
revoke all on table public.account_deletion_operator_recovery_audit
  from public, anon, authenticated, service_role;

create index account_deletion_operations_expires_idx
  on public.account_deletion_operations (expires_at, id);
create index account_deletion_barriers_expires_idx
  on public.account_deletion_barriers (expires_at, operation_id);
create index account_deletion_steps_runnable_idx
  on public.account_deletion_steps (operation_id, step_order)
  where status <> 'succeeded';
create index account_deletion_receipts_expires_idx
  on public.account_deletion_receipts (purge_after, capability_digest);
create index account_deletion_operator_recovery_audit_expires_idx
  on public.account_deletion_operator_recovery_audit (expires_at, command_digest);
create unique index account_deletion_receipts_subject_hmac_idx
  on public.account_deletion_receipts (subject_hmac_key_version, subject_hmac)
  where subject_hmac is not null;

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

create or replace function public._account_deletion_token_digest(
  p_context text,
  p_token text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(p_context || p_token, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public._account_deletion_token_digest(text, text)
  from public, anon, authenticated, service_role;

create or replace function public._account_deletion_capability_digest(p_capability text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public._account_deletion_token_digest(
    'onskin-account-deletion-status-capability:v1:',
    p_capability
  );
$$;

revoke all on function public._account_deletion_capability_digest(text)
  from public, anon, authenticated, service_role;

create or replace function public._account_deletion_idempotency_digest(
  p_idempotency_key text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select public._account_deletion_token_digest(
    'onskin-account-deletion-intake-idempotency:v1:',
    p_idempotency_key
  );
$$;

revoke all on function public._account_deletion_idempotency_digest(text)
  from public, anon, authenticated, service_role;

create or replace function public._account_deletion_claim_digest(p_claim_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public._account_deletion_token_digest(
    'onskin-account-deletion-worker-claim:v1:',
    p_claim_token
  );
$$;

revoke all on function public._account_deletion_claim_digest(text)
  from public, anon, authenticated, service_role;

create or replace function public._account_deletion_operator_command_digest(
  p_command_token text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select public._account_deletion_token_digest(
    'onskin-account-deletion-operator-command:v1:',
    p_command_token
  );
$$;

revoke all on function public._account_deletion_operator_command_digest(text)
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

create or replace function public.account_write_allowed()
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return false;
  end if;
  return public.account_write_allowed(v_user_id);
end;
$$;

revoke all on function public.account_write_allowed() from public, anon;
grant execute on function public.account_write_allowed() to authenticated;

-- Authenticated mobile sessions reach this service-only RPC through the Edge
-- boundary after the bearer token has been resolved to its exact Auth owner.
-- The response is deliberately one opaque word: operation ids, lifecycle
-- phases, provider state, timestamps, and capabilities never cross this gate.
create or replace function public.get_account_deletion_barrier_state(
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if p_user_id is null then
    raise exception 'ACCOUNT_DELETION_PREFLIGHT_INVALID_USER' using errcode = '22004';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );

  -- A locally cached JWT can outlive a hard-deleted Auth subject. Never
  -- mislabel that stale session as clear; the Edge boundary maps this failure
  -- to an unpublished, retryable client boundary.
  if not exists (
    select 1 from auth.users as users where users.id = p_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_PREFLIGHT_AUTH_SUBJECT_ABSENT'
      using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    return 'active';
  end if;
  return 'clear';
end;
$$;

revoke all on function public.get_account_deletion_barrier_state(uuid)
  from public, anon, authenticated, service_role;

-- Put the migration-0047 service scrub behind the same barrier and advisory
-- lock. The renamed implementation remains callable only by its owner; the
-- public name is a guarded service-role wrapper.
alter function public.scrub_account_service_rows(uuid)
  rename to _scrub_account_service_rows_unlocked_0048;
revoke all on function public._scrub_account_service_rows_unlocked_0048(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.scrub_account_service_rows(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'ACCOUNT_SERVICE_SCRUB_INVALID_USER' using errcode = '22004';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (
    select 1
      from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_BARRIER_REQUIRED' using errcode = 'P0001';
  end if;
  return public._scrub_account_service_rows_unlocked_0048(p_user_id);
end;
$$;

revoke all on function public.scrub_account_service_rows(uuid)
  from public, anon, authenticated;
grant execute on function public.scrub_account_service_rows(uuid) to service_role;

-- Every canonical caller-owned table receives a restrictive write barrier.
-- This covers direct and parent-owned rows without duplicating ownership joins.
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
    if pg_catalog.to_regclass('public.' || v_table) is null then
      raise exception 'ACCOUNT_WRITE_BARRIER_TABLE_MISSING:%', v_table
        using errcode = 'P0001';
    end if;

    execute pg_catalog.format(
      'create policy account_deletion_write_barrier_insert on public.%I '
      || 'as restrictive for insert to authenticated '
      || 'with check (public.account_write_allowed())',
      v_table
    );
    execute pg_catalog.format(
      'create policy account_deletion_write_barrier_update on public.%I '
      || 'as restrictive for update to authenticated '
      || 'using (public.account_write_allowed()) '
      || 'with check (public.account_write_allowed())',
      v_table
    );
    execute pg_catalog.format(
      'create policy account_deletion_write_barrier_delete on public.%I '
      || 'as restrictive for delete to authenticated '
      || 'using (public.account_write_allowed())',
      v_table
    );
  end loop;
end;
$$;

-- Storage writes use the same transaction-scoped lock. Existing owner/consent/
-- anonymous checks remain in their permissive policies; these are additional
-- restrictive predicates for the photos bucket only.
create policy account_deletion_write_barrier_insert on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'photos'
    or public.account_write_allowed()
  );

create policy account_deletion_write_barrier_update on storage.objects
  as restrictive for update to authenticated
  using (
    bucket_id <> 'photos'
    or public.account_write_allowed()
  )
  with check (
    bucket_id <> 'photos'
    or public.account_write_allowed()
  );

create policy account_deletion_write_barrier_delete on storage.objects
  as restrictive for delete to authenticated
  using (
    bucket_id <> 'photos'
    or public.account_write_allowed()
  );

-- Normalize expired leases while the caller holds the operation/user lock.
create or replace function public._refresh_account_deletion_operation(
  p_operation_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_expires_at timestamptz;
  v_next_state text;
begin
  select operations.state, operations.expires_at
    into v_state, v_expires_at
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;

  if v_state is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.account_deletion_steps as steps
     set status = case
           when steps.status = 'request_started' then 'ambiguous'
           when steps.lease_kind = 'reconcile' then 'ambiguous'
           else 'pending'
         end,
         next_attempt_at = case
           when steps.status = 'leased' and steps.lease_kind = 'dispatch'
             then p_now
           else steps.next_attempt_at
         end,
         result_code = case
           when steps.status = 'request_started' then 'REQUEST_OUTCOME_UNKNOWN'
           when steps.lease_kind = 'reconcile' then 'RECONCILE_LEASE_EXPIRED'
           else 'LEASE_EXPIRED_BEFORE_REQUEST'
         end,
         lease_kind = null,
         claim_digest = null,
         lease_expires_at = null,
         updated_at = p_now
   where steps.operation_id = p_operation_id
     and steps.status in ('leased', 'request_started')
     and steps.lease_expires_at <= p_now;

  if v_expires_at <= p_now then
    -- The deadline ends unattended processing; it does not erase the durable
    -- work needed to fulfil the request. Apple credentials are the only secret
    -- that cannot outlive this deadline. Record the durable manual fallback so
    -- local erasure and the remaining provider reconciliation can continue.
    update public.account_deletion_steps
       set encrypted_payload = null,
           updated_at = p_now
     where operation_id = p_operation_id
       and step_name = 'apple_revoke'
       and encrypted_payload is not null;
    update public.account_deletion_steps
       set status = 'succeeded',
           next_attempt_at = null,
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           request_started_at = coalesce(request_started_at, p_now),
           completed_at = p_now,
           result_code = 'APPLE_MANUAL_REVOCATION_RECORDED',
           encrypted_payload = null,
           updated_at = p_now
     where operation_id = p_operation_id
       and step_name = 'apple_revoke'
       and status <> 'succeeded';
  end if;

  if not exists (
    select 1
      from public.account_deletion_steps
     where operation_id = p_operation_id
       and status <> 'succeeded'
  ) then
    v_next_state := 'ready_to_finalize';
  elsif exists (
    select 1
      from public.account_deletion_steps
     where operation_id = p_operation_id
       and step_order >= 40
       and status = 'action_required'
  ) then
    v_next_state := 'action_required';
  elsif not exists (
    select 1
      from public.account_deletion_steps
     where operation_id = p_operation_id
       and step_order >= 40
       and status <> 'succeeded'
  ) and exists (
    select 1
      from public.account_deletion_steps
     where operation_id = p_operation_id
       and step_order < 40
       and status <> 'succeeded'
  ) then
    -- First-party erasure is complete, but a provider still needs bounded
    -- reconciliation/operator work. Public Edge maps this opaque state to
    -- delayed while the barrier/minimal provider evidence survives.
    v_next_state := 'action_required';
  elsif exists (
    select 1
      from public.account_deletion_steps
     where operation_id = p_operation_id
       and status = 'ambiguous'
  ) then
    v_next_state := 'running';
  elsif v_state = 'pending' and not exists (
    select 1
      from public.account_deletion_steps
     where operation_id = p_operation_id
       and attempt_count > 0
  ) then
    v_next_state := 'pending';
  else
    v_next_state := 'running';
  end if;

  update public.account_deletion_operations
     set state = v_next_state,
         updated_at = case when state is distinct from v_next_state then p_now else updated_at end
   where id = p_operation_id;
end;
$$;

revoke all on function public._refresh_account_deletion_operation(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- Dependency-aware claim selection. Provider dispatches are attempted in
-- Apple -> RevenueCat -> PostHog order, but an ambiguous/action-required
-- provider no longer blocks first-party erasure. The local chain remains strict.
create or replace function public._account_deletion_claimable_step(
  p_operation_id uuid,
  p_claim_mode text,
  p_now timestamptz
)
returns table (step_name text)
language sql
security definer
stable
set search_path = ''
as $$
  with normalized as (
    select steps.step_name,
           steps.step_order,
           case
             when steps.status = 'request_started'
                  and steps.lease_expires_at <= p_now
               then 'ambiguous'
             when steps.status = 'leased'
                  and steps.lease_expires_at <= p_now
                  and steps.lease_kind = 'reconcile'
               then 'ambiguous'
             when steps.status = 'leased'
                  and steps.lease_expires_at <= p_now
               then 'pending'
             else steps.status
           end as effective_status,
           case
             when steps.status = 'leased'
                  and steps.lease_expires_at <= p_now
                  and steps.lease_kind = 'dispatch'
               then p_now
             else steps.next_attempt_at
           end as effective_next_attempt_at
      from public.account_deletion_steps as steps
     where steps.operation_id = p_operation_id
  ), provider_blocker as (
    select normalized.*
      from normalized
     where normalized.step_order < 40
       and normalized.effective_status not in (
         'succeeded', 'ambiguous', 'action_required'
       )
     order by normalized.step_order
     limit 1
  ), local_blocker as (
    select normalized.*
      from normalized
     where normalized.step_order >= 40
       and normalized.effective_status <> 'succeeded'
     order by normalized.step_order
     limit 1
  ), due_provider_reconcile as (
    select normalized.*
      from normalized
     where normalized.step_order < 40
       and normalized.effective_status = 'ambiguous'
       and coalesce(
         normalized.effective_next_attempt_at,
         '-infinity'::timestamptz
       ) <= p_now
     order by normalized.step_order
     limit 1
  ), choices as (
    select 10 as priority,
           provider_blocker.step_order,
           provider_blocker.step_name
      from provider_blocker
     where p_claim_mode = 'dispatch'
       and provider_blocker.effective_status = 'pending'
       and coalesce(
         provider_blocker.effective_next_attempt_at,
         '-infinity'::timestamptz
       ) <= p_now
    union all
    select 20,
           local_blocker.step_order,
           local_blocker.step_name
      from local_blocker
     where p_claim_mode = 'dispatch'
       and not exists (select 1 from provider_blocker)
       and local_blocker.effective_status = 'pending'
       and coalesce(
         local_blocker.effective_next_attempt_at,
         '-infinity'::timestamptz
       ) <= p_now
    union all
    select 30,
           local_blocker.step_order,
           local_blocker.step_name
      from local_blocker
      where p_claim_mode = 'reconcile'
        and local_blocker.effective_status = 'ambiguous'
       and coalesce(
         local_blocker.effective_next_attempt_at,
          '-infinity'::timestamptz
        ) <= p_now
    union all
    select 40,
           due_provider_reconcile.step_order,
           due_provider_reconcile.step_name
      from due_provider_reconcile
     where p_claim_mode = 'reconcile'
       and not exists (
         select 1
           from local_blocker
          where local_blocker.effective_status = 'ambiguous'
            and coalesce(
              local_blocker.effective_next_attempt_at,
              '-infinity'::timestamptz
            ) <= p_now
       )
  )
  select choices.step_name
    from choices
   order by choices.priority, choices.step_order
   limit 1;
$$;

revoke all on function public._account_deletion_claimable_step(
  uuid, text, timestamptz
) from public, anon, authenticated, service_role;

-- Storage database pointers are not ownership evidence: legacy profile/photo
-- rows were not uniformly path constrained. Explicit Storage ownership wins;
-- owner-null objects are safe only under the canonical account prefix.
create or replace function public._account_photo_storage_object_owned(
  p_user_id uuid,
  p_object_name text,
  p_owner text,
  p_owner_id text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_user_id is not null
     and p_object_name is not null
     and (
       (
         (p_owner = p_user_id::text or p_owner_id = p_user_id::text)
         and (p_owner is null or p_owner = p_user_id::text)
         and (p_owner_id is null or p_owner_id = p_user_id::text)
       )
       or (
         p_owner is null
         and p_owner_id is null
         and pg_catalog.split_part(p_object_name, '/', 1) = p_user_id::text
       )
     );
$$;

revoke all on function public._account_photo_storage_object_owned(uuid, text, text, text)
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Lifecycle RPCs (service-role only)
-- -----------------------------------------------------------------------------

create or replace function public.begin_account_deletion(
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
declare
  v_now timestamptz := clock_timestamp();
  v_idempotency_digest text;
  v_capability_digest text;
  v_operation public.account_deletion_operations%rowtype;
begin
  if p_user_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[a-f0-9]{64}$'
     or p_capability is null
     or p_capability !~ '^[a-f0-9]{64}$'
     or p_idempotency_key = p_capability
     or p_operation_expires_at is null
     or not pg_catalog.isfinite(p_operation_expires_at)
     or p_operation_expires_at <= v_now
     or p_operation_expires_at > v_now + interval '30 days'
     or (
       p_apple_encrypted_credential is not null
       and pg_catalog.octet_length(p_apple_encrypted_credential) not between 1 and 8192
     )
      or (
        p_revenuecat_encrypted_reconciliation is not null
        and pg_catalog.octet_length(p_revenuecat_encrypted_reconciliation)
          not between 1 and 32768
      )
      or (
        p_posthog_encrypted_reconciliation is not null
       and pg_catalog.octet_length(p_posthog_encrypted_reconciliation) not between 1 and 32768
     ) then
    raise exception 'ACCOUNT_DELETION_BEGIN_INVALID' using errcode = '22023';
  end if;

  v_idempotency_digest := public._account_deletion_idempotency_digest(
    p_idempotency_key
  );
  v_capability_digest := public._account_deletion_capability_digest(p_capability);
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.user_id = p_user_id
   for update;

  if v_operation.id is not null then
    if v_operation.idempotency_digest <> v_idempotency_digest then
      raise exception 'ACCOUNT_DELETION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    if v_operation.capability_digest <> v_capability_digest then
      raise exception 'ACCOUNT_DELETION_CAPABILITY_MISMATCH' using errcode = '42501';
    end if;
    if not exists (
      select 1
        from public.account_deletion_barriers as barriers
       where barriers.operation_id = v_operation.id
         and barriers.user_id = p_user_id
         and barriers.expires_at = v_operation.expires_at
    ) or (
      select count(*)
        from public.account_deletion_steps as steps
       where steps.operation_id = v_operation.id
    ) <> 6 then
      raise exception 'ACCOUNT_DELETION_ACTIVE_STATE_INCOMPLETE' using errcode = 'P0001';
    end if;

    perform public._refresh_account_deletion_operation(v_operation.id, v_now);
    return query
      select operations.id, operations.state, operations.expires_at, false
        from public.account_deletion_operations as operations
       where operations.id = v_operation.id;
    return;
  end if;

  if exists (
    select 1
      from public.account_deletion_receipts as receipts
     where receipts.capability_digest = v_capability_digest
  ) then
    raise exception 'ACCOUNT_DELETION_CAPABILITY_ALREADY_TERMINAL' using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.account_deletion_operations as operations
     where operations.idempotency_digest = v_idempotency_digest
  ) then
    raise exception 'ACCOUNT_DELETION_IDEMPOTENCY_REUSED' using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.account_deletion_operations as operations
     where operations.capability_digest = v_capability_digest
  ) then
    raise exception 'ACCOUNT_DELETION_CAPABILITY_REUSED' using errcode = '23505';
  end if;

  if not exists (select 1 from auth.users as users where users.id = p_user_id) then
    raise exception 'ACCOUNT_DELETION_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.account_deletion_operations (
    user_id,
    idempotency_digest,
    capability_digest,
    created_at,
    updated_at,
    expires_at
  ) values (
    p_user_id,
    v_idempotency_digest,
    v_capability_digest,
    v_now,
    v_now,
    p_operation_expires_at
  )
  returning * into v_operation;

  insert into public.account_deletion_barriers (
    user_id,
    operation_id,
    created_at,
    expires_at
  ) values (
    p_user_id,
    v_operation.id,
    v_now,
    p_operation_expires_at
  );

  insert into public.account_deletion_steps (
    operation_id,
    step_name,
    step_order,
    encrypted_payload
  ) values
    (v_operation.id, 'apple_revoke', 10, p_apple_encrypted_credential),
    (v_operation.id, 'revenuecat_delete', 20, p_revenuecat_encrypted_reconciliation),
    (v_operation.id, 'posthog_delete', 30, p_posthog_encrypted_reconciliation),
    (v_operation.id, 'photo_storage_delete', 40, null),
    (v_operation.id, 'service_rows_scrub', 50, null),
    (v_operation.id, 'auth_user_delete', 60, null);

  -- Keep the bounded owner-keyed intake bucket while Auth remains live so
  -- retries cannot reset their own quota after this commit. The shared
  -- advisory lock serializes it with intake consumption; the Auth FK removes
  -- every owner bucket at hard deletion and the maintenance TTL is a backstop.

  return query
    select v_operation.id, v_operation.state, v_operation.expires_at, true;
end;
$$;

create or replace function public.get_account_deletion_status(p_capability text)
returns table (
  operation_id uuid,
  operation_state text,
  operation_expires_at timestamptz,
  next_step_name text,
  next_step_status text,
  attempt_count integer,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  receipt_expires_at timestamptz,
  apple_manual_revocation_required boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_capability_digest text;
begin
  if p_capability is null
     or p_capability !~ '^[a-f0-9]{64}$' then
    raise exception 'ACCOUNT_DELETION_STATUS_INVALID' using errcode = '22023';
  end if;
  v_capability_digest := public._account_deletion_capability_digest(p_capability);

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.capability_digest = v_capability_digest;

  if v_operation.id is null then
    return query
      select null::uuid,
              case when receipts.expires_at <= v_now then 'expired'
                   else receipts.receipt_state end,
             null::timestamptz,
             null::text,
             null::text,
             null::integer,
             null::timestamptz,
             null::timestamptz,
             receipts.expires_at,
             receipts.apple_manual_revocation_required
        from public.account_deletion_receipts as receipts
       where receipts.capability_digest = v_capability_digest
          and receipts.purge_after > v_now;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = v_operation.id
   for update;
  if v_operation.id is null then
    return query
      select null::uuid,
             case when receipts.expires_at <= v_now then 'expired'
                  else receipts.receipt_state end,
             null::timestamptz,
             null::text,
             null::text,
             null::integer,
             null::timestamptz,
             null::timestamptz,
             receipts.expires_at,
             receipts.apple_manual_revocation_required
        from public.account_deletion_receipts as receipts
       where receipts.capability_digest = v_capability_digest
         and receipts.purge_after > v_now;
    return;
  end if;
  perform public._refresh_account_deletion_operation(v_operation.id, v_now);

  return query
    select operations.id,
           operations.state,
           operations.expires_at,
           steps.step_name,
           steps.status,
           steps.attempt_count,
           steps.next_attempt_at,
           steps.lease_expires_at,
           null::timestamptz,
           null::boolean
      from public.account_deletion_operations as operations
      left join lateral (
        select candidate.*
          from public.account_deletion_steps as candidate
         where candidate.operation_id = operations.id
           and candidate.status <> 'succeeded'
         order by candidate.step_order
         limit 1
      ) as steps on true
     where operations.id = v_operation.id;
end;
$$;

create or replace function public.claim_account_deletion_step(
  p_operation_id uuid,
  p_claim_mode text,
  p_lease_seconds integer
)
returns table (
  claimed boolean,
  operation_state text,
  step_name text,
  step_status text,
  claim_mode text,
  claim_token text,
  attempt_count integer,
  request_started_at timestamptz,
  lease_expires_at timestamptz,
  encrypted_payload bytea
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
  v_step_name text;
  v_claim_token text;
begin
  if p_operation_id is null
     or p_claim_mode is null
     or p_claim_mode not in ('dispatch', 'reconcile')
     or p_lease_seconds is null
     or p_lease_seconds < 15
     or p_lease_seconds > 900 then
    raise exception 'ACCOUNT_DELETION_CLAIM_INVALID' using errcode = '22023';
  end if;

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;

  select claimable.step_name
    into v_step_name
    from public._account_deletion_claimable_step(
      p_operation_id,
      p_claim_mode,
      v_now
    ) as claimable;

  if v_step_name is null then
    return query select
      false,
      v_operation.state,
      null::text,
      null::text,
      null::text,
      null::text,
      null::integer,
      null::timestamptz,
      null::timestamptz,
      null::bytea;
    return;
  end if;

  select steps.*
    into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = v_step_name
   for update;

  if v_step.step_name is not null
     and v_step.status in ('pending', 'ambiguous')
     and v_step.attempt_count >= v_step.max_attempts then
    update public.account_deletion_steps as exhausted_step
       set status = 'action_required',
           next_attempt_at = null,
           result_code = 'MAX_ATTEMPTS_EXHAUSTED',
           updated_at = v_now
     where exhausted_step.operation_id = p_operation_id
       and exhausted_step.step_name = v_step.step_name
    returning * into v_step;
    perform public._refresh_account_deletion_operation(p_operation_id, v_now);
    select operations.*
      into v_operation
      from public.account_deletion_operations as operations
     where operations.id = p_operation_id;
    return query select
      false,
      v_operation.state,
      v_step.step_name,
      v_step.status,
      null::text,
      null::text,
      v_step.attempt_count,
      v_step.request_started_at,
      v_step.lease_expires_at,
      null::bytea;
    return;
  end if;

  v_claim_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');

  update public.account_deletion_steps as claimed_step
     set status = 'leased',
         attempt_count = claimed_step.attempt_count + 1,
         lease_kind = p_claim_mode,
         claim_digest = public._account_deletion_claim_digest(v_claim_token),
         lease_expires_at = v_now + pg_catalog.make_interval(secs => p_lease_seconds),
         request_started_at = case
           when p_claim_mode = 'dispatch' then null
           else claimed_step.request_started_at
         end,
         completed_at = null,
         updated_at = v_now
   where claimed_step.operation_id = p_operation_id
     and claimed_step.step_name = v_step.step_name
  returning * into v_step;

  update public.account_deletion_operations
     set updated_at = v_now
   where id = p_operation_id;
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;

  return query select
    true,
    v_operation.state,
    v_step.step_name,
    v_step.status,
    v_step.lease_kind,
    v_claim_token,
    v_step.attempt_count,
    v_step.request_started_at,
    v_step.lease_expires_at,
    v_step.encrypted_payload;
end;
$$;

create or replace function public.claim_next_account_deletion_step(
  p_claim_mode text,
  p_lease_seconds integer
)
returns table (
  operation_id uuid,
  user_id uuid,
  operation_state text,
  step_name text,
  step_status text,
  claim_mode text,
  claim_token text,
  attempt_count integer,
  request_started_at timestamptz,
  lease_expires_at timestamptz,
  encrypted_payload bytea
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
begin
  if p_claim_mode is null
     or p_claim_mode not in ('dispatch', 'reconcile')
     or p_lease_seconds is null
     or p_lease_seconds < 15
     or p_lease_seconds > 900 then
    raise exception 'ACCOUNT_DELETION_CLAIM_NEXT_INVALID' using errcode = '22023';
  end if;

  for v_operation in
    select operations.*
      from public.account_deletion_operations as operations
      join lateral public._account_deletion_claimable_step(
        operations.id,
        p_claim_mode,
        v_now
      ) as claimable on true
     order by operations.created_at, operations.id
     limit 100
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      public._account_deletion_advisory_key(v_operation.user_id)
    ) then
      continue;
    end if;

    perform public._refresh_account_deletion_operation(v_operation.id, v_now);
    if not exists (
      select 1
        from public._account_deletion_claimable_step(
          v_operation.id,
          p_claim_mode,
          v_now
        )
    ) then
      continue;
    end if;

    return query
      select v_operation.id,
             v_operation.user_id,
             claimed_step.operation_state,
             claimed_step.step_name,
             claimed_step.step_status,
             claimed_step.claim_mode,
             claimed_step.claim_token,
             claimed_step.attempt_count,
             claimed_step.request_started_at,
             claimed_step.lease_expires_at,
             claimed_step.encrypted_payload
        from public.claim_account_deletion_step(
          v_operation.id,
          p_claim_mode,
          p_lease_seconds
        ) as claimed_step
       where claimed_step.claimed;
    if found then
      return;
    end if;
  end loop;
end;
$$;

create or replace function public.mark_account_deletion_step_request_started(
  p_operation_id uuid,
  p_step_name text,
  p_claim_token text
)
returns table (
  step_status text,
  claim_mode text,
  request_started_at timestamptz,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
begin
  if p_operation_id is null
     or p_step_name is null
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$' then
    raise exception 'ACCOUNT_DELETION_REQUEST_START_INVALID' using errcode = '22023';
  end if;

  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);

  update public.account_deletion_steps as steps
     set status = 'request_started',
         request_started_at = case
           when steps.lease_kind = 'reconcile'
             then coalesce(steps.request_started_at, v_now)
           else v_now
         end,
         updated_at = v_now
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
     and steps.status = 'leased'
     and steps.lease_expires_at > v_now
     and steps.claim_digest = public._account_deletion_claim_digest(p_claim_token)
  returning * into v_step;

  if v_step.step_name is null then
    raise exception 'ACCOUNT_DELETION_REQUEST_START_CAS_FAILED' using errcode = '40001';
  end if;

  return query select
    v_step.status,
    v_step.lease_kind,
    v_step.request_started_at,
    v_step.lease_expires_at;
end;
$$;

create or replace function public.update_account_deletion_step_payload(
  p_operation_id uuid,
  p_step_name text,
  p_claim_token text,
  p_encrypted_payload bytea
)
returns table (
  step_status text,
  claim_mode text,
  request_started_at timestamptz,
  lease_expires_at timestamptz,
  encrypted_payload_octets integer,
  encrypted_payload_digest text,
  payload_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
begin
  if p_operation_id is null
     or p_step_name is null
     or p_step_name not in ('apple_revoke', 'revenuecat_delete', 'posthog_delete')
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_encrypted_payload is null
     or (
       p_step_name = 'apple_revoke'
       and pg_catalog.octet_length(p_encrypted_payload) not between 1 and 8192
     )
     or (
       p_step_name = 'revenuecat_delete'
       and pg_catalog.octet_length(p_encrypted_payload) not between 1 and 32768
     )
     or (
       p_step_name = 'posthog_delete'
       and pg_catalog.octet_length(p_encrypted_payload) not between 1 and 32768
     ) then
    raise exception 'ACCOUNT_DELETION_PAYLOAD_UPDATE_INVALID' using errcode = '22023';
  end if;

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);

  select steps.*
    into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;

  if v_step.step_name is null
     or v_step.status not in ('leased', 'request_started')
     or v_step.claim_digest
          is distinct from public._account_deletion_claim_digest(p_claim_token)
     or v_step.lease_expires_at is null
     or v_step.lease_expires_at <= v_now then
    raise exception 'ACCOUNT_DELETION_PAYLOAD_UPDATE_CAS_FAILED' using errcode = '40001';
  end if;

  update public.account_deletion_steps as steps
     set encrypted_payload = p_encrypted_payload,
         updated_at = v_now
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
  returning * into v_step;

  return query select
    v_step.status,
    v_step.lease_kind,
    v_step.request_started_at,
    v_step.lease_expires_at,
    pg_catalog.octet_length(v_step.encrypted_payload),
    pg_catalog.encode(extensions.digest(v_step.encrypted_payload, 'sha256'), 'hex'),
    v_step.updated_at;
end;
$$;

create or replace function public.record_account_deletion_step(
  p_operation_id uuid,
  p_step_name text,
  p_claim_token text,
  p_outcome text,
  p_result_code text,
  p_retry_at timestamptz
)
returns table (
  operation_state text,
  step_status text,
  next_attempt_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
begin
  if p_operation_id is null
     or p_step_name is null
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_outcome is null
     or p_outcome not in ('succeeded', 'retryable', 'ambiguous', 'action_required')
     or p_result_code is null
     or p_result_code !~ '^[A-Z0-9_]{1,64}$' then
    raise exception 'ACCOUNT_DELETION_RECORD_INVALID' using errcode = '22023';
  end if;

  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);

  select steps.* into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;

  if v_step.step_name is null
     or v_step.claim_digest
          is distinct from public._account_deletion_claim_digest(p_claim_token)
     or v_step.lease_expires_at <= v_now then
    raise exception 'ACCOUNT_DELETION_RECORD_CAS_FAILED' using errcode = '40001';
  end if;

  if p_outcome = 'retryable' then
    if not (
         v_step.status = 'leased'
         or (
           v_step.status = 'request_started'
           and (
             v_step.step_name = 'apple_revoke'
             or v_step.lease_kind = 'reconcile'
           )
         )
       )
       or p_retry_at is null
       or not pg_catalog.isfinite(p_retry_at)
       or p_retry_at < v_now
       or p_retry_at > v_now + interval '7 days' then
      raise exception 'ACCOUNT_DELETION_RETRY_NOT_SAFE_FOR_STEP_STATE'
        using errcode = '22023';
    end if;

    update public.account_deletion_steps
       set status = case when v_step.lease_kind = 'reconcile' then 'ambiguous' else 'pending' end,
           next_attempt_at = p_retry_at,
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           request_started_at = case
             when v_step.lease_kind = 'reconcile'
               then v_step.request_started_at
             else null
           end,
           result_code = p_result_code,
           updated_at = v_now
     where operation_id = p_operation_id
       and step_name = p_step_name
    returning * into v_step;
  elsif p_outcome = 'action_required' then
    if v_step.status not in ('leased', 'request_started') or p_retry_at is not null then
      raise exception 'ACCOUNT_DELETION_ACTION_REQUIRED_STATE_INVALID'
        using errcode = '22023';
    end if;

    update public.account_deletion_steps
       set status = 'action_required',
           next_attempt_at = null,
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           result_code = p_result_code,
           updated_at = v_now
     where operation_id = p_operation_id
       and step_name = p_step_name
    returning * into v_step;
  elsif p_outcome = 'ambiguous' then
    if v_step.status <> 'request_started' or p_retry_at is not null then
      raise exception 'ACCOUNT_DELETION_AMBIGUOUS_REQUIRES_STARTED_REQUEST'
        using errcode = '22023';
    end if;

    update public.account_deletion_steps
       set status = 'ambiguous',
           next_attempt_at = null,
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           result_code = p_result_code,
           updated_at = v_now
     where operation_id = p_operation_id
       and step_name = p_step_name
    returning * into v_step;
  else
    if not (
         v_step.status = 'request_started'
         or (
           v_step.status = 'leased'
           and (
             v_step.step_name = 'service_rows_scrub'
             or (
               v_step.step_name = 'apple_revoke'
               and p_result_code in (
                 'APPLE_NOT_LINKED',
                 'APPLE_MANUAL_REVOCATION_RECORDED'
               )
             )
             or (
               v_step.step_name = 'revenuecat_delete'
               and p_result_code = 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED'
             )
             or (
               v_step.step_name = 'photo_storage_delete'
               and p_result_code = 'PHOTO_STORAGE_ALREADY_ABSENT'
             )
           )
         )
       )
       or p_retry_at is not null then
      raise exception 'ACCOUNT_DELETION_SUCCESS_REQUIRES_STARTED_REQUEST'
        using errcode = '22023';
    end if;
    if p_step_name = 'auth_user_delete'
       and exists (select 1 from auth.users as users where users.id = v_operation.user_id) then
      raise exception 'ACCOUNT_DELETION_AUTH_USER_STILL_PRESENT' using errcode = 'P0001';
    end if;
    if p_step_name = 'photo_storage_delete'
       and exists (
         select 1
           from storage.objects as objects
          where objects.bucket_id = 'photos'
            and public._account_photo_storage_object_owned(
              v_operation.user_id,
              objects.name,
              pg_catalog.to_jsonb(objects) ->> 'owner',
              pg_catalog.to_jsonb(objects) ->> 'owner_id'
            )
       ) then
      raise exception 'ACCOUNT_DELETION_PHOTO_STORAGE_STILL_PRESENT'
        using errcode = 'P0001';
    end if;

    update public.account_deletion_steps
       set status = 'succeeded',
           next_attempt_at = null,
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           completed_at = v_now,
           result_code = p_result_code,
           encrypted_payload = null,
           updated_at = v_now
     where operation_id = p_operation_id
       and step_name = p_step_name
    returning * into v_step;
  end if;

  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;

  return query select v_operation.state, v_step.status, v_step.next_attempt_at;
end;
$$;

create or replace function public.recover_account_deletion_step(
  p_operation_id uuid,
  p_step_name text,
  p_recovery_mode text,
  p_command_token text,
  p_reason_code text
)
returns table (
  operation_state text,
  step_status text,
  next_attempt_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
  v_command_digest text;
begin
  if p_operation_id is null
     or p_step_name is null
     or p_recovery_mode not in ('dispatch', 'reconcile')
     or p_command_token is null
     or p_command_token !~ '^[a-f0-9]{64}$'
     or p_reason_code not in (
       'CONFIGURATION_REPAIRED',
       'PROVIDER_RECOVERY_APPROVED',
       'LOCAL_RETRY_APPROVED',
       'TRANSIENT_INCIDENT_RESOLVED'
     ) then
    raise exception 'ACCOUNT_DELETION_RECOVERY_INVALID' using errcode = '22023';
  end if;
  v_command_digest := public._account_deletion_operator_command_digest(p_command_token);
  if exists (
    select 1 from public.account_deletion_operator_recovery_audit
     where command_digest = v_command_digest
  ) then
    raise exception 'ACCOUNT_DELETION_RECOVERY_COMMAND_REPLAYED' using errcode = '23505';
  end if;

  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;

  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  select steps.* into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;

  if v_step.step_name is null or v_step.status <> 'action_required' then
    raise exception 'ACCOUNT_DELETION_RECOVERY_WRONG_STATE' using errcode = '55000';
  end if;
  if p_recovery_mode = 'dispatch' and v_step.request_started_at is not null then
    raise exception 'ACCOUNT_DELETION_RECOVERY_UNSAFE_REDISPATCH' using errcode = '22023';
  end if;
  if p_recovery_mode = 'reconcile' and (
    v_step.request_started_at is null
    or v_step.step_name not in (
      'apple_revoke', 'revenuecat_delete', 'posthog_delete',
      'photo_storage_delete', 'auth_user_delete'
    )
  ) then
    raise exception 'ACCOUNT_DELETION_RECOVERY_RECONCILE_INVALID' using errcode = '22023';
  end if;

  insert into public.account_deletion_operator_recovery_audit (
    command_digest, operation_id, step_name, recovery_mode, reason_code,
    prior_result_code, created_at, expires_at
  ) values (
    v_command_digest, p_operation_id, p_step_name, p_recovery_mode, p_reason_code,
    v_step.result_code, v_now, v_now + interval '30 days'
  );

  update public.account_deletion_steps as steps
     set status = case when p_recovery_mode = 'dispatch' then 'pending' else 'ambiguous' end,
         attempt_count = 0,
         next_attempt_at = v_now,
         lease_kind = null,
         claim_digest = null,
         lease_expires_at = null,
         completed_at = null,
         result_code = 'OPERATOR_RECOVERY_QUEUED',
         updated_at = v_now
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
  returning * into v_step;

  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  return query select v_operation.state, v_step.status, v_step.next_attempt_at;
end;
$$;

create or replace function public.list_account_deletions_ready_to_finalize(
  p_limit integer
)
returns table (operation_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation record;
  v_locked public.account_deletion_operations%rowtype;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'ACCOUNT_DELETION_FINALIZE_LIST_LIMIT_INVALID' using errcode = '22023';
  end if;
  for v_operation in
    select operations.id, operations.user_id
      from public.account_deletion_operations as operations
     where operations.state = 'ready_to_finalize'
     order by operations.updated_at, operations.id
     limit p_limit
  loop
    if pg_catalog.pg_try_advisory_xact_lock(
      public._account_deletion_advisory_key(v_operation.user_id)
    ) then
      select operations.* into v_locked
        from public.account_deletion_operations as operations
       where operations.id = v_operation.id
       for update;
      if v_locked.id is not null then
        perform public._refresh_account_deletion_operation(v_locked.id, v_now);
        select operations.* into v_locked
          from public.account_deletion_operations as operations
         where operations.id = v_operation.id;
        if v_locked.state = 'ready_to_finalize'
           and not exists (
             select 1 from public.account_deletion_steps as steps
              where steps.operation_id = v_locked.id
                and steps.status <> 'succeeded'
           )
           and not exists (
             select 1 from auth.users as users where users.id = v_locked.user_id
           ) then
          operation_id := v_locked.id;
          user_id := v_locked.user_id;
          return next;
        end if;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.finalize_account_deletion(


  p_operation_id uuid,
  p_subject_hmac text,
  p_subject_hmac_key_version smallint,
  p_receipt_expires_at timestamptz
)
returns table (
  completed boolean,
  completed_at timestamptz,
  expires_at timestamptz,
  apple_manual_revocation_required boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_receipt public.account_deletion_receipts%rowtype;
  v_apple_manual boolean;
  v_scrub_result jsonb;
begin
  if p_operation_id is null
     or p_subject_hmac is null
     or p_subject_hmac !~ '^[a-f0-9]{64}$'
     or p_subject_hmac_key_version is null
     or p_subject_hmac_key_version < 1
     or p_receipt_expires_at is null
     or not pg_catalog.isfinite(p_receipt_expires_at)
     or p_receipt_expires_at <= v_now
     or p_receipt_expires_at > v_now + interval '30 days' then
    raise exception 'ACCOUNT_DELETION_FINALIZE_INVALID' using errcode = '22023';
  end if;

  select receipts.* into v_receipt
    from public.account_deletion_receipts as receipts
   where receipts.subject_hmac_key_version = p_subject_hmac_key_version
     and receipts.subject_hmac = p_subject_hmac;
  if v_receipt.subject_hmac is not null then
    return query select
      true,
      v_receipt.completed_at,
      v_receipt.expires_at,
      v_receipt.apple_manual_revocation_required;
    return;
  end if;

  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    select receipts.* into v_receipt
      from public.account_deletion_receipts as receipts
     where receipts.subject_hmac_key_version = p_subject_hmac_key_version
       and receipts.subject_hmac = p_subject_hmac;
    if v_receipt.subject_hmac is not null then
      return query select true, v_receipt.completed_at, v_receipt.expires_at,
        v_receipt.apple_manual_revocation_required;
      return;
    end if;
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_operation.user_id)
  );
  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;

  if v_operation.id is null then
    select receipts.* into v_receipt
      from public.account_deletion_receipts as receipts
     where receipts.subject_hmac_key_version = p_subject_hmac_key_version
       and receipts.subject_hmac = p_subject_hmac;
    if v_receipt.subject_hmac is not null then
      return query select true, v_receipt.completed_at, v_receipt.expires_at,
        v_receipt.apple_manual_revocation_required;
      return;
    end if;
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;

  if v_operation.state <> 'ready_to_finalize'
     or exists (
       select 1
         from public.account_deletion_steps
        where operation_id = p_operation_id
          and status <> 'succeeded'
     )
     or exists (select 1 from auth.users as users where users.id = v_operation.user_id) then
    raise exception 'ACCOUNT_DELETION_NOT_READY_TO_FINALIZE' using errcode = 'P0001';
  end if;

  -- Step attestations can become stale if a service writer raced before it saw
  -- the barrier. Re-run the exact idempotent scrub and Storage attestation
  -- while the same account lock is held immediately before receipt creation.
  v_scrub_result := public.scrub_account_service_rows(v_operation.user_id);
  if v_scrub_result is null
     or (v_scrub_result ->> 'complete') is distinct from 'true'
     or (v_scrub_result ->> 'residual_order_attributions') is distinct from '0'
     or (v_scrub_result ->> 'residual_obf_contributions') is distinct from '0'
     or (v_scrub_result ->> 'residual_subscription_identities') is distinct from '0'
  then
    raise exception 'ACCOUNT_DELETION_FINAL_SERVICE_SCRUB_FAILED'
      using errcode = 'P0001';
  end if;
  if public.count_account_photo_storage_objects(v_operation.user_id) <> 0 then
    raise exception 'ACCOUNT_DELETION_FINAL_STORAGE_NOT_EMPTY'
      using errcode = 'P0001';
  end if;

  select coalesce(
           steps.result_code in (
              'APPLE_MANUAL_REVOCATION_REQUIRED',
              'APPLE_MANUAL_REVOCATION_RECORDED',
             'APPLE_CREDENTIAL_UNAVAILABLE',
             'APPLE_REVOCATION_FAILED'
           ),
           false
         )
    into v_apple_manual
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = 'apple_revoke';

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
    v_operation.capability_digest,
    'completed',
    p_subject_hmac_key_version,
    p_subject_hmac,
    v_apple_manual,
    v_now,
    p_receipt_expires_at,
    p_receipt_expires_at + interval '7 days'
  )
  returning * into v_receipt;

  update public.account_deletion_operator_recovery_audit as audit
     set expires_at = v_now + interval '30 days'
   where audit.operation_id = p_operation_id;

  delete from public.account_deletion_operations
   where id = p_operation_id;

  return query select
    true,
    v_receipt.completed_at,
    v_receipt.expires_at,
    v_receipt.apple_manual_revocation_required;
end;
$$;

create or replace function public.get_account_deletion_receipt(
  p_subject_hmac text,
  p_subject_hmac_key_version smallint
)
returns table (
  completed boolean,
  completed_at timestamptz,
  expires_at timestamptz,
  apple_manual_revocation_required boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select true,
         receipts.completed_at,
         receipts.expires_at,
         receipts.apple_manual_revocation_required
    from public.account_deletion_receipts as receipts
   where p_subject_hmac ~ '^[a-f0-9]{64}$'
     and receipts.receipt_state = 'completed'
     and receipts.subject_hmac_key_version = p_subject_hmac_key_version
     and receipts.subject_hmac = p_subject_hmac
     and receipts.expires_at > now();
$$;

-- The automatic-processing deadline never reopens writes or destroys required
-- work. Purge removes only finite receipts/operator audit. Expired operations
-- are refreshed under the account lock so Apple secrets become the manual
-- fallback while RevenueCat/PostHog reconciliation evidence survives.
create or replace function public.purge_expired_account_deletion_artifacts(
  p_limit integer
)
returns table (
  receipts_deleted integer,
  operations_deleted integer,
  encrypted_credentials_redacted integer,
  active_accounts_retained integer,
  operator_audits_deleted integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_operation record;
  v_had_apple_payload boolean;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'ACCOUNT_DELETION_PURGE_LIMIT_INVALID' using errcode = '22023';
  end if;

  with candidates as (
    select receipts.capability_digest
      from public.account_deletion_receipts as receipts
     where receipts.purge_after <= v_now
     order by receipts.purge_after, receipts.capability_digest
     limit p_limit
     for update skip locked
  ), deleted as (
    delete from public.account_deletion_receipts as receipts
     using candidates
     where receipts.capability_digest = candidates.capability_digest
    returning 1
  )
  select count(*)::integer into receipts_deleted from deleted;

  encrypted_credentials_redacted := 0;
  operations_deleted := 0;
  for v_operation in
    select operations.id, operations.user_id
      from public.account_deletion_operations as operations
     where operations.expires_at <= v_now
     order by operations.expires_at, operations.id
     limit p_limit
  loop
    if pg_catalog.pg_try_advisory_xact_lock(
      public._account_deletion_advisory_key(v_operation.user_id)
    ) then
      select exists (
        select 1 from public.account_deletion_steps as steps
         where steps.operation_id = v_operation.id
           and steps.step_name = 'apple_revoke'
           and steps.encrypted_payload is not null
      ) into v_had_apple_payload;
      perform public._refresh_account_deletion_operation(v_operation.id, v_now);
      if v_had_apple_payload then
        encrypted_credentials_redacted := encrypted_credentials_redacted + 1;
      end if;
    end if;
  end loop;

  with candidates as (
    select audit.command_digest
     from public.account_deletion_operator_recovery_audit as audit
     where audit.expires_at <= v_now
       and not exists (
         select 1 from public.account_deletion_operations as operations
          where operations.id = audit.operation_id
       )
     order by audit.expires_at, audit.command_digest
     limit p_limit
     for update skip locked
  ), deleted as (
    delete from public.account_deletion_operator_recovery_audit as audit
     using candidates
     where audit.command_digest = candidates.command_digest
    returning 1
  )
  select count(*)::integer into operator_audits_deleted from deleted;

  select count(*)::integer
    into active_accounts_retained
    from public.account_deletion_operations as operations
   where operations.expires_at <= v_now
   ;

  return next;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage API worklist and exact post-delete attestation
-- -----------------------------------------------------------------------------

create or replace function public.list_account_photo_storage_objects(
  p_user_id uuid,
  p_after_name text,
  p_limit integer
)
returns table (object_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or p_limit is null
     or p_limit < 1
     or p_limit > 1000
     or (p_after_name is not null and pg_catalog.length(p_after_name) > 1024) then
    raise exception 'ACCOUNT_PHOTO_STORAGE_LIST_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (
    select 1 from public.account_deletion_barriers where user_id = p_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_BARRIER_REQUIRED' using errcode = 'P0001';
  end if;

  return query
    select objects.name
      from storage.objects as objects
     where objects.bucket_id = 'photos'
       and public._account_photo_storage_object_owned(
         p_user_id,
         objects.name,
         pg_catalog.to_jsonb(objects) ->> 'owner',
         pg_catalog.to_jsonb(objects) ->> 'owner_id'
       )
       and (p_after_name is null or objects.name > p_after_name)
     order by objects.name
     limit p_limit;
end;
$$;

create or replace function public.count_account_photo_storage_objects(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if p_user_id is null then
    raise exception 'ACCOUNT_PHOTO_STORAGE_COUNT_INVALID' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (
    select 1 from public.account_deletion_barriers where user_id = p_user_id
  ) then
    raise exception 'ACCOUNT_DELETION_BARRIER_REQUIRED' using errcode = 'P0001';
  end if;

  select count(*)
    into v_count
    from storage.objects as objects
   where objects.bucket_id = 'photos'
     and public._account_photo_storage_object_owned(
       p_user_id,
       objects.name,
       pg_catalog.to_jsonb(objects) ->> 'owner',
       pg_catalog.to_jsonb(objects) ->> 'owner_id'
     );
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Account-owned deterministic rate-limit buckets
-- -----------------------------------------------------------------------------

alter table public.edge_rate_limits
  add column owner_user_id uuid,
  add column expires_at timestamptz;

update public.edge_rate_limits
   set expires_at = window_start + pg_catalog.make_interval(
     secs => greatest(window_seconds * 4, 3600)
   );

-- Existing account-key HMACs cannot be reversed to recover a verified Auth
-- owner. Reset them once rather than preserve unlinkable personal residue.
delete from public.edge_rate_limits
 where scope not in ('account-deletion-status', 'growth-event', 'waitlist');

alter table public.edge_rate_limits
  alter column expires_at set not null,
  add constraint edge_rate_limits_owner_user_id_fkey
    foreign key (owner_user_id) references auth.users (id) on delete cascade,
  add constraint edge_rate_limits_scope_owner_classification
    check (
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
  add constraint edge_rate_limits_deterministic_expiry
    check (
      pg_catalog.isfinite(expires_at)
      and expires_at = window_start + pg_catalog.make_interval(
        secs => greatest(window_seconds * 4, 3600)
      )
    );

create index edge_rate_limits_owner_user_idx
  on public.edge_rate_limits (owner_user_id)
  where owner_user_id is not null;
create index edge_rate_limits_expires_idx
  on public.edge_rate_limits (expires_at, scope, key_hash, window_start);

create or replace function public.purge_expired_edge_rate_limits(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'EDGE_RATE_LIMIT_PURGE_LIMIT_INVALID' using errcode = '22023';
  end if;

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

create or replace function public.consume_edge_rate_limit(
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
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_request_count integer;
  v_account_scope boolean;
begin
  if p_scope is null
     or p_scope not in (
       'account-deletion-intake', 'account-deletion-status', 'catalog-lookup',
       'catalog-search', 'data-export', 'growth-event', 'waitlist'
     )
     or p_key_hash is null
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit is null
     or p_limit < 1
     or p_limit > 1000
     or p_window_seconds is null
     or p_window_seconds < 60
     or p_window_seconds > 86400 then
    raise exception 'EDGE_RATE_LIMIT_INVALID' using errcode = '22023';
  end if;

  v_account_scope := p_scope in (
    'account-deletion-intake', 'catalog-lookup', 'catalog-search', 'data-export'
  );
  if v_account_scope then
    if p_owner_user_id is null then
      raise exception 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_NOT_ACTIVE' using errcode = '42501';
    end if;

    if p_scope = 'account-deletion-intake' then
      -- Intake retries must remain possible after the first request atomically
      -- installs the deletion barrier. Serialize with begin/finalization and
      -- require a still-live Auth owner. Runtime keys this bucket only by a
      -- domain-separated HMAC of that verified owner, never by caller tokens.
      -- The FK removes the bounded service metadata on hard delete.
      perform pg_catalog.pg_advisory_xact_lock(
        public._account_deletion_advisory_key(p_owner_user_id)
      );
      if not exists (
        select 1 from auth.users as users where users.id = p_owner_user_id
      ) then
        raise exception 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_NOT_ACTIVE' using errcode = '42501';
      end if;
    elsif not public.account_write_allowed(p_owner_user_id) then
      raise exception 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_NOT_ACTIVE' using errcode = '42501';
    end if;
  elsif p_owner_user_id is not null then
    raise exception 'EDGE_RATE_LIMIT_PUBLIC_OWNER_FORBIDDEN' using errcode = '22023';
  end if;

  perform public.purge_expired_edge_rate_limits(100);

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from v_now) / p_window_seconds)
      * p_window_seconds
  );
  v_expires_at := v_window_start + pg_catalog.make_interval(
    secs => greatest(p_window_seconds * 4, 3600)
  );

  insert into public.edge_rate_limits as limits (
    scope,
    key_hash,
    owner_user_id,
    window_start,
    window_seconds,
    request_count,
    expires_at,
    created_at,
    updated_at
  ) values (
    p_scope,
    p_key_hash,
    p_owner_user_id,
    v_window_start,
    p_window_seconds,
    1,
    v_expires_at,
    v_now,
    v_now
  )
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = limits.request_count + 1,
    updated_at = v_now
  where limits.owner_user_id is not distinct from excluded.owner_user_id
    and limits.window_seconds = excluded.window_seconds
    and limits.expires_at = excluded.expires_at
  returning request_count into v_request_count;

  if v_request_count is null then
    raise exception 'EDGE_RATE_LIMIT_BUCKET_CONFLICT' using errcode = 'P0001';
  end if;
  return v_request_count <= p_limit;
end;
$$;

-- Preserve public-form callers on the four-argument signature. Authenticated
-- scopes fail closed until their Edge caller supplies the verified Auth owner to
-- the five-argument overload.
create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope not in ('account-deletion-status', 'growth-event', 'waitlist') then
    raise exception 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  return public.consume_edge_rate_limit(
    p_scope,
    p_key_hash,
    p_limit,
    p_window_seconds,
    null::uuid
  );
end;
$$;

-- Explicit privilege boundary for every lifecycle/storage/retention RPC.
revoke all on function public.begin_account_deletion(uuid, text, text, timestamptz, bytea, bytea, bytea)
  from public, anon, authenticated;
revoke all on function public.get_account_deletion_status(text)
  from public, anon, authenticated;
revoke all on function public.get_account_deletion_barrier_state(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_account_deletion_step(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.claim_next_account_deletion_step(text, integer)
  from public, anon, authenticated;
revoke all on function public.mark_account_deletion_step_request_started(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.update_account_deletion_step_payload(uuid, text, text, bytea)
  from public, anon, authenticated;
revoke all on function public.record_account_deletion_step(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.recover_account_deletion_step(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.list_account_deletions_ready_to_finalize(integer)
  from public, anon, authenticated;
revoke all on function public.finalize_account_deletion(
  uuid, text, smallint, timestamptz
) from public, anon, authenticated;
revoke all on function public.get_account_deletion_receipt(text, smallint)
  from public, anon, authenticated;
revoke all on function public.purge_expired_account_deletion_artifacts(integer)
  from public, anon, authenticated;
revoke all on function public.list_account_photo_storage_objects(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.count_account_photo_storage_objects(uuid)
  from public, anon, authenticated;
revoke all on function public.purge_expired_edge_rate_limits(integer)
  from public, anon, authenticated;
revoke all on function public.consume_edge_rate_limit(text, text, integer, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.consume_edge_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.begin_account_deletion(uuid, text, text, timestamptz, bytea, bytea, bytea)
  to service_role;
grant execute on function public.get_account_deletion_status(text)
  to service_role;
grant execute on function public.get_account_deletion_barrier_state(uuid)
  to service_role;
grant execute on function public.claim_account_deletion_step(uuid, text, integer)
  to service_role;
grant execute on function public.claim_next_account_deletion_step(text, integer)
  to service_role;
grant execute on function public.mark_account_deletion_step_request_started(uuid, text, text)
  to service_role;
grant execute on function public.update_account_deletion_step_payload(uuid, text, text, bytea)
  to service_role;
grant execute on function public.record_account_deletion_step(
  uuid, text, text, text, text, timestamptz
) to service_role;
grant execute on function public.recover_account_deletion_step(uuid, text, text, text, text)
  to service_role;
grant execute on function public.list_account_deletions_ready_to_finalize(integer)
  to service_role;
grant execute on function public.finalize_account_deletion(
  uuid, text, smallint, timestamptz
) to service_role;
grant execute on function public.get_account_deletion_receipt(text, smallint)
  to service_role;
grant execute on function public.purge_expired_account_deletion_artifacts(integer)
  to service_role;
grant execute on function public.list_account_photo_storage_objects(uuid, text, integer)
  to service_role;
grant execute on function public.count_account_photo_storage_objects(uuid)
  to service_role;
grant execute on function public.purge_expired_edge_rate_limits(integer)
  to service_role;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer, uuid)
  to service_role;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer)
  to service_role;

comment on table public.account_deletion_receipts is
  'Finite terminal deletion status keyed by a random-capability digest; completed receipts also carry a domain-separated subject HMAC. Never stores a raw account id, provider handle/body, credential, or unkeyed subject digest.';
comment on table public.account_deletion_operator_recovery_audit is
  'Replay-protected, pseudonymous operator recovery commands. Active-operation commands remain while required for replay safety; finalization resets their purge deadline to 30 days. Never stores a user id, raw command token, provider body, credential, or free-form reason.';
comment on function public.mark_account_deletion_step_request_started(uuid, text, text) is
  'CAS marker that must commit before a provider request starts; lease expiry after this marker becomes ambiguous and reconciliation-only.';
comment on function public.update_account_deletion_step_payload(uuid, text, text, bytea) is
  'Lease-and-claim CAS update for bounded encrypted Apple/RevenueCat/PostHog recovery evidence; returns only ciphertext size/digest and timing attestation.';
comment on function public.recover_account_deletion_step(uuid, text, text, text, text) is
  'Replay-protected service recovery for action-required work; unsafe post-dispatch work can only return to reconciliation.';
comment on function public.list_account_deletions_ready_to_finalize(integer) is
  'Bounded crash-recovery discovery for all-succeeded operations whose Auth subject is absent; returns only the active operation and subject UUID needed to compute the finite receipt HMAC.';
comment on function public.account_write_allowed(uuid) is
  'Takes the shared per-account transaction advisory lock and returns true only for a live Auth user without an active deletion barrier.';
comment on function public.get_account_deletion_barrier_state(uuid) is
  'Service-only mobile session preflight. Returns only clear or active for a still-live verified Auth owner; stale/deleted subjects fail closed.';

commit;
