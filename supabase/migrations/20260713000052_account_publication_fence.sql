-- =============================================================================
-- DB-10 - account session/provider publication fence
-- =============================================================================
-- This migration intentionally refuses to invent historical lease-drain
-- evidence. Deployment must freeze deletion intake, drain/finalize every
-- pre-0052 operation, and prove both active tables empty before applying it.

begin;

create or replace function public._assert_account_publication_fence_installable()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.account_deletion_operations)
     or exists (select 1 from public.account_deletion_barriers) then
    raise exception 'ACCOUNT_PUBLICATION_FENCE_REQUIRES_ZERO_ACTIVE_DELETIONS'
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function public._assert_account_publication_fence_installable()
  from public, anon, authenticated, service_role;

-- Deployment uses an intake freeze, but the database also closes the install
-- race: a concurrent begin must commit before this lock and fail the assertion,
-- or wait until the publication trigger and columns are installed.
lock table public.account_deletion_operations,
           public.account_deletion_barriers
  in access exclusive mode;

select public._assert_account_publication_fence_installable();

alter table public.account_deletion_operations
  add column publication_drain_started_at timestamptz,
  add column publication_drained_at timestamptz,
  add column publication_settle_not_before timestamptz,
  add column revenuecat_absence_observation_count smallint not null default 0,
  add column revenuecat_absence_first_observed_at timestamptz,
  add column revenuecat_absence_second_observed_at timestamptz,
  add column revenuecat_absence_last_claim_digest text;

alter table public.account_deletion_operations
  add constraint account_deletion_publication_drain_shape check (
    (publication_drain_started_at is null)
    or pg_catalog.isfinite(publication_drain_started_at)
  ),
  add constraint account_deletion_publication_drained_shape check (
    (publication_drained_at is null)
    or (
      publication_drain_started_at is not null
      and pg_catalog.isfinite(publication_drained_at)
      and publication_drained_at >= publication_drain_started_at
    )
  ),
  add constraint account_deletion_publication_settle_shape check (
    (
      publication_drained_at is null
      and publication_settle_not_before is null
    )
    or (
      publication_drained_at is not null
      and publication_settle_not_before is not null
      and publication_settle_not_before
        = publication_drained_at + interval '5 minutes'
      and pg_catalog.isfinite(publication_settle_not_before)
    )
  ),
  add constraint account_deletion_revenuecat_absence_shape check (
    (
      revenuecat_absence_observation_count = 0
      and revenuecat_absence_first_observed_at is null
      and revenuecat_absence_second_observed_at is null
      and revenuecat_absence_last_claim_digest is null
    )
    or (
      revenuecat_absence_observation_count = 1
      and revenuecat_absence_first_observed_at is not null
      and revenuecat_absence_second_observed_at is null
      and revenuecat_absence_last_claim_digest is not null
      and revenuecat_absence_last_claim_digest ~ '^[a-f0-9]{64}$'
    )
    or (
      revenuecat_absence_observation_count = 2
      and revenuecat_absence_first_observed_at is not null
      and revenuecat_absence_second_observed_at is not null
      and revenuecat_absence_last_claim_digest is not null
      and revenuecat_absence_last_claim_digest ~ '^[a-f0-9]{64}$'
    )
  ),
  add constraint account_deletion_revenuecat_absence_timing check (
    (
      revenuecat_absence_first_observed_at is null
      and revenuecat_absence_second_observed_at is null
    )
    or (
      publication_settle_not_before is not null
      and pg_catalog.isfinite(revenuecat_absence_first_observed_at)
      and revenuecat_absence_first_observed_at >= publication_settle_not_before
      and (
        revenuecat_absence_second_observed_at is null
        or (
          pg_catalog.isfinite(revenuecat_absence_second_observed_at)
          and revenuecat_absence_second_observed_at
            >= revenuecat_absence_first_observed_at + interval '60 seconds'
        )
      )
    )
  );

create table public.account_publication_leases (
  capability_digest text primary key
    check (capability_digest ~ '^[a-f0-9]{64}$'),
  user_id uuid not null,
  verified_session_id uuid not null,
  state text not null check (state in ('reserved', 'active', 'draining', 'closed')),
  reserved_at timestamptz not null,
  activated_at timestamptz,
  renewed_at timestamptz,
  drain_started_at timestamptz,
  closed_at timestamptz,
  close_reason text check (
    close_reason is null
    or close_reason in (
      'client_released', 'deadline_expired'
    )
  ),
  expires_at timestamptz not null,
  updated_at timestamptz not null,
  drain_operation_id uuid,
  foreign key (drain_operation_id, user_id)
    references public.account_deletion_operations (id, user_id) on delete cascade,
  check (
    pg_catalog.isfinite(reserved_at)
    and pg_catalog.isfinite(expires_at)
    and pg_catalog.isfinite(updated_at)
    and expires_at > reserved_at
    and updated_at >= reserved_at
  ),
  check (
    activated_at is null
    or (
      pg_catalog.isfinite(activated_at)
      and activated_at >= reserved_at
      and updated_at >= activated_at
    )
  ),
  check (
    renewed_at is null
    or (
      activated_at is not null
      and pg_catalog.isfinite(renewed_at)
      and renewed_at >= activated_at
      and updated_at >= renewed_at
    )
  ),
  check (
    (
      activated_at is null
      and renewed_at is null
      and expires_at = reserved_at + interval '30 seconds'
    )
    or (
      activated_at is not null
      and expires_at = coalesce(renewed_at, activated_at) + interval '60 seconds'
    )
  ),
  check (
    (drain_started_at is null and drain_operation_id is null)
    or (
      drain_started_at is not null
      and drain_operation_id is not null
      and pg_catalog.isfinite(drain_started_at)
      and drain_started_at >= reserved_at
      and drain_started_at < expires_at
      and updated_at >= drain_started_at
    )
  ),
  check (
    closed_at is null
    or (
      pg_catalog.isfinite(closed_at)
      and closed_at >= reserved_at
      and updated_at >= closed_at
    )
  ),
  check (
    (
      state = 'reserved'
      and activated_at is null
      and renewed_at is null
      and drain_started_at is null
      and drain_operation_id is null
      and closed_at is null
      and close_reason is null
    )
    or (
      state = 'active'
      and activated_at is not null
      and drain_started_at is null
      and drain_operation_id is null
      and closed_at is null
      and close_reason is null
    )
    or (
      state = 'draining'
      and activated_at is not null
      and drain_started_at is not null
      and drain_operation_id is not null
      and closed_at is null
      and close_reason is null
    )
    or (
      state = 'closed'
      and activated_at is not null
      and closed_at is not null
      and drain_started_at is not null
      and closed_at >= drain_started_at
      and drain_operation_id is not null
      and close_reason is not null
    )
  )
);

alter table public.account_publication_leases enable row level security;
alter table public.account_publication_leases force row level security;
revoke all on table public.account_publication_leases
  from public, anon, authenticated, service_role;

create unique index account_publication_leases_live_session_idx
  on public.account_publication_leases (user_id, verified_session_id)
  where state in ('reserved', 'active', 'draining');
create index account_publication_leases_expiry_idx
  on public.account_publication_leases (expires_at, capability_digest)
  where state in ('reserved', 'active', 'draining');
create index account_publication_leases_closed_idx
  on public.account_publication_leases (closed_at, capability_digest)
  where state = 'closed';
create index account_publication_leases_drain_idx
  on public.account_publication_leases (
    drain_operation_id, state, expires_at, capability_digest
  ) where drain_operation_id is not null;

create or replace function public._account_publication_capability_digest(
  p_capability text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select public._account_deletion_token_digest(
    'onskin-account-publication-lease-capability:v1:',
    p_capability
  );
$$;

revoke all on function public._account_publication_capability_digest(text)
  from public, anon, authenticated, service_role;

create or replace function public._settle_account_publication_drain(
  p_user_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_operation_id uuid;
begin
  update public.account_deletion_operations as operations
     set publication_drained_at = greatest(
           operations.publication_drain_started_at,
           coalesce(
             (
               select max(
                 case
                   when leases.state = 'draining' then leases.expires_at
                   when leases.close_reason = 'deadline_expired' then leases.expires_at
                   else leases.closed_at
                 end
               )
                 from public.account_publication_leases as leases
                where leases.drain_operation_id = operations.id
                  and leases.activated_at is not null
                  and (
                    leases.state = 'closed'
                    or (leases.state = 'draining' and leases.expires_at <= p_now)
                  )
             ),
             operations.publication_drain_started_at
           )
         ),
         publication_settle_not_before = greatest(
           operations.publication_drain_started_at,
           coalesce(
             (
               select max(
                 case
                   when leases.state = 'draining' then leases.expires_at
                   when leases.close_reason = 'deadline_expired' then leases.expires_at
                   else leases.closed_at
                 end
               )
                 from public.account_publication_leases as leases
                where leases.drain_operation_id = operations.id
                  and leases.activated_at is not null
                  and (
                    leases.state = 'closed'
                    or (leases.state = 'draining' and leases.expires_at <= p_now)
                  )
             ),
             operations.publication_drain_started_at
           )
         ) + interval '5 minutes',
         revenuecat_absence_observation_count = 0,
         revenuecat_absence_first_observed_at = null,
         revenuecat_absence_second_observed_at = null,
         revenuecat_absence_last_claim_digest = null,
         updated_at = p_now
   where operations.user_id = p_user_id
     and operations.publication_drain_started_at is not null
     and operations.publication_drained_at is null
     and not exists (
       select 1
         from public.account_publication_leases as leases
        where leases.user_id = p_user_id
          and leases.state = 'draining'
          and leases.expires_at > p_now
     )
  returning operations.id into v_operation_id;
  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    -- The operation row now contains the exact maximum authority end. Remove
    -- every non-live capability/session identifier immediately; no unfinished
    -- deletion can retain this transient evidence indefinitely.
    delete from public.account_publication_leases as leases
     where leases.drain_operation_id = v_operation_id
       and (
         leases.state = 'closed'
         or (
           leases.state = 'draining'
           and leases.expires_at <= p_now
         )
       );
  end if;
  return v_updated = 1;
end;
$$;

revoke all on function public._settle_account_publication_drain(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public._refresh_account_publication_leases(
  p_user_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Unattached leases are admission controls, not deletion evidence. Remove
  -- their identifying UUIDs at authority expiry instead of retaining them.
  delete from public.account_publication_leases as leases
   where leases.user_id = p_user_id
     and leases.drain_operation_id is null
     and leases.state in ('reserved', 'active')
     and leases.expires_at <= p_now;

  update public.account_publication_leases as leases
     set state = 'closed',
         closed_at = leases.expires_at,
         close_reason = 'deadline_expired',
         updated_at = p_now
   where leases.user_id = p_user_id
     and leases.state = 'draining'
     and leases.drain_operation_id is not null
     and leases.expires_at <= p_now;
  perform public._settle_account_publication_drain(p_user_id, p_now);
end;
$$;

revoke all on function public._refresh_account_publication_leases(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- Retire the migration-0048 user-only intake and preflight entry points.  A
-- bearer can be valid when Edge authentication starts and be signed out before
-- the later RPC.  Every authenticated destructive/publication boundary must
-- therefore lock the exact live Auth session in the same transaction as its
-- account advisory lock.  The old implementations remain owner-callable only
-- so the wrappers can preserve their reviewed lifecycle behavior.
alter function public.begin_account_deletion(
  uuid, text, text, timestamptz, bytea, bytea, bytea
) rename to _begin_account_deletion_v0048_unbound;
revoke all on function public._begin_account_deletion_v0048_unbound(
  uuid, text, text, timestamptz, bytea, bytea, bytea
) from public, anon, authenticated, service_role;
drop function if exists public.begin_account_deletion(
  uuid, text, text, timestamptz, bytea, bytea, bytea
);

alter function public.get_account_deletion_barrier_state(uuid)
  rename to _get_account_deletion_barrier_state_v0048_unbound;
revoke all on function public._get_account_deletion_barrier_state_v0048_unbound(uuid)
  from public, anon, authenticated, service_role;
drop function if exists public.get_account_deletion_barrier_state(uuid);

alter function public.consume_edge_rate_limit(text, text, integer, integer, uuid)
  rename to _consume_edge_rate_limit_v0048_unbound;
revoke all on function public._consume_edge_rate_limit_v0048_unbound(
  text, text, integer, integer, uuid
) from public, anon, authenticated, service_role;

-- Preserve the five-argument rate-limit contract for non-intake callers while
-- making the legacy account-deletion intake path fail closed.  Intake must use
-- the six-argument exact-session overload below.
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
begin
  if p_scope = 'account-deletion-intake' then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;
  return public._consume_edge_rate_limit_v0048_unbound(
    p_scope,
    p_key_hash,
    p_limit,
    p_window_seconds,
    p_owner_user_id
  );
end;
$$;

create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_owner_user_id uuid,
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope is distinct from 'account-deletion-intake' then
    raise exception 'EDGE_RATE_LIMIT_SESSION_SCOPE_INVALID' using errcode = '22023';
  end if;
  if p_owner_user_id is null or p_session_id is null then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_owner_user_id)
  );
  perform 1
    from auth.sessions as sessions
   where sessions.id = p_session_id
     and sessions.user_id = p_owner_user_id
   for key share;
  if not found then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;

  return public._consume_edge_rate_limit_v0048_unbound(
    p_scope,
    p_key_hash,
    p_limit,
    p_window_seconds,
    p_owner_user_id
  );
end;
$$;

create or replace function public.get_account_deletion_barrier_state(
  p_user_id uuid,
  p_session_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform 1
    from auth.sessions as sessions
   where sessions.id = p_session_id
     and sessions.user_id = p_user_id
   for key share;
  if not found then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;

  return public._get_account_deletion_barrier_state_v0048_unbound(p_user_id);
end;
$$;

create or replace function public.begin_account_deletion(
  p_user_id uuid,
  p_session_id uuid,
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
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform 1
    from auth.sessions as sessions
   where sessions.id = p_session_id
     and sessions.user_id = p_user_id
   for key share;
  if not found then
    raise exception 'ACCOUNT_DELETION_SESSION_REJECTED' using errcode = '28000';
  end if;

  return query
    select legacy.operation_id,
           legacy.operation_state,
           legacy.operation_expires_at,
           legacy.created
      from public._begin_account_deletion_v0048_unbound(
        p_user_id,
        p_idempotency_key,
        p_capability,
        p_operation_expires_at,
        p_apple_encrypted_credential,
        p_revenuecat_encrypted_reconciliation,
        p_posthog_encrypted_reconciliation
      ) as legacy;
end;
$$;

revoke all on function public.consume_edge_rate_limit(
  text, text, integer, integer, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.consume_edge_rate_limit(
  text, text, integer, integer, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.get_account_deletion_barrier_state(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.begin_account_deletion(
  uuid, uuid, text, text, timestamptz, bytea, bytea, bytea
) from public, anon, authenticated, service_role;

grant execute on function public.consume_edge_rate_limit(
  text, text, integer, integer, uuid
) to service_role;
grant execute on function public.consume_edge_rate_limit(
  text, text, integer, integer, uuid, uuid
) to service_role;
grant execute on function public.get_account_deletion_barrier_state(uuid, uuid)
  to service_role;
grant execute on function public.begin_account_deletion(
  uuid, uuid, text, text, timestamptz, bytea, bytea, bytea
) to service_role;

create or replace function public.reserve_account_publication_lease(
  p_user_id uuid,
  p_session_id uuid,
  p_capability text
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_digest text;
  v_existing public.account_publication_leases%rowtype;
begin
  if p_user_id is null
     or p_session_id is null
     or p_capability is null
     or p_capability !~ '^[a-f0-9]{64}$' then
    return query select 'lease_rejected'::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform 1
    from auth.sessions as sessions
   where sessions.id = p_session_id
     and sessions.user_id = p_user_id
   for key share;
  if not found then
    return query select 'session_rejected'::text;
    return;
  end if;
  v_now := clock_timestamp();
  perform public._refresh_account_publication_leases(p_user_id, v_now);
  if exists (
    select 1
      from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    return query select 'blocked'::text;
    return;
  end if;

  v_digest := public._account_publication_capability_digest(p_capability);

  select leases.*
    into v_existing
    from public.account_publication_leases as leases
   where leases.capability_digest = v_digest;
  if v_existing.capability_digest is not null then
    if v_existing.user_id = p_user_id
       and v_existing.verified_session_id = p_session_id
       and v_existing.state = 'reserved'
       and v_existing.expires_at > v_now then
      return query select 'reserved'::text;
    else
      return query select 'lease_rejected'::text;
    end if;
    return;
  end if;
  if (
    select count(*)
      from public.account_publication_leases as leases
     where leases.user_id = p_user_id
       and leases.state in ('reserved', 'active', 'draining')
       and leases.expires_at > v_now
  ) >= 8 then
    return query select 'lease_rejected'::text;
    return;
  end if;

  insert into public.account_publication_leases (
    capability_digest,
    user_id,
    verified_session_id,
    state,
    reserved_at,
    expires_at,
    updated_at
  ) values (
    v_digest,
    p_user_id,
    p_session_id,
    'reserved',
    v_now,
    v_now + interval '30 seconds',
    v_now
  ) on conflict do nothing;

  if found then
    return query select 'reserved'::text;
    return;
  end if;

  return query select 'lease_rejected'::text;
end;
$$;

create or replace function public.activate_account_publication_lease(
  p_user_id uuid,
  p_session_id uuid,
  p_capability text
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_digest text;
  v_lease public.account_publication_leases%rowtype;
begin
  if p_user_id is null
     or p_session_id is null
     or p_capability is null
     or p_capability !~ '^[a-f0-9]{64}$' then
    return query select 'lease_rejected'::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform 1
    from auth.sessions as sessions
   where sessions.id = p_session_id
     and sessions.user_id = p_user_id
   for key share;
  if not found then
    return query select 'session_rejected'::text;
    return;
  end if;
  v_now := clock_timestamp();
  perform public._refresh_account_publication_leases(p_user_id, v_now);
  if exists (
    select 1 from public.account_deletion_barriers
     where user_id = p_user_id
  ) then
    return query select 'blocked'::text;
    return;
  end if;

  v_digest := public._account_publication_capability_digest(p_capability);
  select leases.*
    into v_lease
    from public.account_publication_leases as leases
   where leases.capability_digest = v_digest
     and leases.user_id = p_user_id
     and leases.verified_session_id = p_session_id
   for update;
  if v_lease.capability_digest is null
     or v_lease.state not in ('reserved', 'active')
     or v_lease.expires_at <= v_now then
    return query select 'lease_rejected'::text;
    return;
  end if;
  if v_lease.state = 'active' then
    update public.account_publication_leases as leases
       set renewed_at = v_now,
           expires_at = v_now + interval '60 seconds',
           updated_at = v_now
     where leases.capability_digest = v_digest;
    return query select 'active'::text;
    return;
  end if;

  update public.account_publication_leases as leases
     set state = 'active',
         activated_at = v_now,
         renewed_at = null,
         expires_at = v_now + interval '60 seconds',
         updated_at = v_now
   where leases.capability_digest = v_digest;
  return query select 'active'::text;
end;
$$;

create or replace function public.renew_account_publication_lease(
  p_user_id uuid,
  p_session_id uuid,
  p_capability text
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_digest text;
begin
  if p_user_id is null
     or p_session_id is null
     or p_capability is null
     or p_capability !~ '^[a-f0-9]{64}$' then
    return query select 'lease_rejected'::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform 1
    from auth.sessions as sessions
   where sessions.id = p_session_id
     and sessions.user_id = p_user_id
   for key share;
  if not found then
    return query select 'session_rejected'::text;
    return;
  end if;
  v_now := clock_timestamp();
  perform public._refresh_account_publication_leases(p_user_id, v_now);
  if exists (
    select 1 from public.account_deletion_barriers
     where user_id = p_user_id
  ) then
    return query select 'blocked'::text;
    return;
  end if;

  v_digest := public._account_publication_capability_digest(p_capability);
  update public.account_publication_leases as leases
     set renewed_at = v_now,
         expires_at = v_now + interval '60 seconds',
         updated_at = v_now
   where leases.capability_digest = v_digest
     and leases.user_id = p_user_id
     and leases.verified_session_id = p_session_id
     and leases.state = 'active'
     and leases.expires_at > v_now;
  if found then
    return query select 'active'::text;
  else
    return query select 'lease_rejected'::text;
  end if;
end;
$$;

create or replace function public.release_account_publication_lease(
  p_capability text
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_digest text;
  v_user_id uuid;
begin
  if p_capability is null or p_capability !~ '^[a-f0-9]{64}$' then
    return query select 'released'::text;
    return;
  end if;
  v_digest := public._account_publication_capability_digest(p_capability);
  select leases.user_id
    into v_user_id
    from public.account_publication_leases as leases
   where leases.capability_digest = v_digest;
  if v_user_id is null then
    return query select 'released'::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  v_now := clock_timestamp();
  perform public._refresh_account_publication_leases(v_user_id, v_now);
  update public.account_publication_leases as leases
     set state = 'closed',
         closed_at = v_now,
         close_reason = 'client_released',
         updated_at = v_now
   where leases.capability_digest = v_digest
     and leases.state = 'draining'
     and leases.drain_operation_id is not null;
  delete from public.account_publication_leases as leases
   where leases.capability_digest = v_digest
     and leases.drain_operation_id is null
     and leases.state in ('reserved', 'active');
  perform public._settle_account_publication_drain(v_user_id, v_now);
  return query select 'released'::text;
end;
$$;

-- The barrier insert and the mobile lease RPCs share one account advisory
-- lock. Reservations close atomically; active leases enter a non-renewable
-- drain without extending their existing server deadline.
create or replace function public._fence_account_publication_on_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(new.user_id)
  );
  v_now := clock_timestamp();
  if not exists (
    select 1
      from public.account_deletion_operations as operations
     where operations.id = new.operation_id
       and operations.user_id = new.user_id
     for update
  ) then
    raise exception 'ACCOUNT_PUBLICATION_FENCE_OPERATION_MISMATCH'
      using errcode = '23503';
  end if;

  perform public._refresh_account_publication_leases(new.user_id, v_now);

  delete from public.account_publication_leases as leases
   where leases.user_id = new.user_id
     and leases.state = 'reserved'
     and leases.expires_at > v_now;

  update public.account_publication_leases as leases
     set state = 'draining',
         drain_started_at = v_now,
         drain_operation_id = new.operation_id,
         updated_at = v_now
   where leases.user_id = new.user_id
     and leases.state = 'active'
     and leases.expires_at > v_now;

  update public.account_deletion_operations as operations
     set publication_drain_started_at = v_now,
         publication_drained_at = null,
         publication_settle_not_before = null,
         revenuecat_absence_observation_count = 0,
         revenuecat_absence_first_observed_at = null,
         revenuecat_absence_second_observed_at = null,
         revenuecat_absence_last_claim_digest = null,
         updated_at = v_now
   where operations.id = new.operation_id
     and operations.user_id = new.user_id;

  perform public._settle_account_publication_drain(new.user_id, v_now);
  return new;
end;
$$;

revoke all on function public._fence_account_publication_on_deletion()
  from public, anon, authenticated, service_role;

create trigger account_deletion_barrier_publication_fence
before insert on public.account_deletion_barriers
for each row execute function public._fence_account_publication_on_deletion();

-- Transition-level enforcement is defense in depth for every current and
-- future RPC. RevenueCat cannot be leased or touch the network before drain
-- settlement, and terminal success requires two accepted absence rounds.
create or replace function public._guard_account_deletion_revenuecat_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.account_deletion_operations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if new.status in ('leased', 'request_started')
     and (
       new.lease_expires_at is null
       or new.lease_expires_at <= v_now
     ) then
    raise exception 'ACCOUNT_DELETION_LEASE_EXPIRED_AT_MUTATION'
      using errcode = '40001';
  end if;

  if new.step_name <> 'revenuecat_delete' then
    if new.step_order >= 40
       and new.status in ('leased', 'request_started', 'succeeded') then
      select operations.*
        into v_operation
        from public.account_deletion_operations as operations
       where operations.id = new.operation_id;
      if v_operation.id is null then
        raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
      end if;
      if v_operation.publication_drained_at is null
         or exists (
           select 1
             from public.account_publication_leases as leases
            where leases.drain_operation_id = new.operation_id
              and leases.user_id = v_operation.user_id
              and leases.state = 'draining'
              and leases.expires_at > v_now
         ) then
        raise exception 'ACCOUNT_DELETION_LOCAL_ERASURE_PUBLICATION_NOT_DRAINED'
          using errcode = '55000';
      end if;
    end if;
    return new;
  end if;

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = new.operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if new.status in ('leased', 'request_started', 'succeeded')
     and (
       v_operation.publication_drained_at is null
       or v_operation.publication_settle_not_before is null
       or v_operation.publication_settle_not_before > v_now
       or exists (
         select 1
           from public.account_publication_leases as leases
          where leases.drain_operation_id = new.operation_id
            and leases.user_id = v_operation.user_id
            and leases.state = 'draining'
            and leases.expires_at > v_now
       )
     ) then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_PUBLICATION_NOT_SETTLED'
      using errcode = '55000';
  end if;

  if new.status = 'leased'
     and (tg_op = 'INSERT' or old.status is distinct from 'leased')
     and v_operation.revenuecat_absence_observation_count = 1
     and v_operation.revenuecat_absence_first_observed_at
           + interval '60 seconds' > v_now then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_OBSERVATION_INTERVAL_PENDING'
      using errcode = '55000';
  end if;

  if new.status = 'request_started'
     and (tg_op = 'INSERT' or old.status is distinct from 'request_started') then
    update public.account_deletion_operations
       set revenuecat_absence_observation_count = 0,
           revenuecat_absence_first_observed_at = null,
           revenuecat_absence_second_observed_at = null,
           revenuecat_absence_last_claim_digest = null,
           updated_at = v_now
     where id = new.operation_id;
  end if;

  if new.status = 'succeeded'
     and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then
    select operations.*
      into v_operation
      from public.account_deletion_operations as operations
     where operations.id = new.operation_id;
    if v_operation.revenuecat_absence_observation_count <> 2
       or v_operation.revenuecat_absence_first_observed_at is null
       or v_operation.revenuecat_absence_second_observed_at is null
       or v_operation.revenuecat_absence_second_observed_at
            < v_operation.revenuecat_absence_first_observed_at + interval '60 seconds'
       or new.result_code not in (
         'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
         'REVENUECAT_V2_DELETION_VERIFIED'
       ) then
      raise exception 'ACCOUNT_DELETION_REVENUECAT_ABSENCE_NOT_CONFIRMED'
        using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public._guard_account_deletion_revenuecat_transition()
  from public, anon, authenticated, service_role;

create trigger account_deletion_revenuecat_transition_guard
before insert or update on public.account_deletion_steps
for each row execute function public._guard_account_deletion_revenuecat_transition();

create or replace function public.record_account_deletion_revenuecat_absence_observation(
  p_operation_id uuid,
  p_step_name text,
  p_claim_token text
)
returns table (confirmed boolean, observation_count smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
  v_claim_digest text;
begin
  if p_operation_id is null
     or p_step_name <> 'revenuecat_delete'
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$' then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_OBSERVATION_INVALID'
      using errcode = '22023';
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

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;
  select steps.*
    into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;
  v_now := clock_timestamp();
  v_claim_digest := public._account_deletion_claim_digest(p_claim_token);

  if v_step.step_name is null
     or v_step.status not in ('leased', 'request_started')
     or v_step.claim_digest is distinct from v_claim_digest
     or v_step.lease_expires_at is null
     or v_step.lease_expires_at <= v_now then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_OBSERVATION_CAS_FAILED'
      using errcode = '40001';
  end if;
  if v_operation.publication_drained_at is null
     or v_operation.publication_settle_not_before is null
     or v_operation.publication_settle_not_before > v_now
     or exists (
       select 1
         from public.account_publication_leases as leases
        where leases.drain_operation_id = p_operation_id
          and leases.user_id = v_operation.user_id
          and leases.state = 'draining'
          and leases.expires_at > v_now
     ) then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_PUBLICATION_NOT_SETTLED'
      using errcode = '55000';
  end if;

  if v_operation.revenuecat_absence_observation_count = 0 then
    update public.account_deletion_operations
       set revenuecat_absence_observation_count = 1,
           revenuecat_absence_first_observed_at = v_now,
           revenuecat_absence_second_observed_at = null,
           revenuecat_absence_last_claim_digest = v_claim_digest,
           updated_at = v_now
     where id = p_operation_id
    returning * into v_operation;
  elsif v_operation.revenuecat_absence_observation_count = 1
        and v_operation.revenuecat_absence_last_claim_digest <> v_claim_digest
        and v_now >= v_operation.revenuecat_absence_first_observed_at
                      + interval '60 seconds' then
    update public.account_deletion_operations
       set revenuecat_absence_observation_count = 2,
           revenuecat_absence_second_observed_at = v_now,
           revenuecat_absence_last_claim_digest = v_claim_digest,
           updated_at = v_now
     where id = p_operation_id
    returning * into v_operation;
  end if;

  return query select
    v_operation.revenuecat_absence_observation_count = 2,
    v_operation.revenuecat_absence_observation_count;
end;
$$;

create or replace function public.reset_account_deletion_revenuecat_absence_observations(
  p_operation_id uuid,
  p_step_name text,
  p_claim_token text
)
returns table (reset boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
begin
  if p_operation_id is null
     or p_step_name <> 'revenuecat_delete'
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$' then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_OBSERVATION_RESET_INVALID'
      using errcode = '22023';
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
  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;
  select steps.*
    into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;
  v_now := clock_timestamp();
  if v_step.step_name is null
     or v_step.status not in ('leased', 'request_started')
     or v_step.claim_digest
          is distinct from public._account_deletion_claim_digest(p_claim_token)
     or v_step.lease_expires_at is null
     or v_step.lease_expires_at <= v_now then
    raise exception 'ACCOUNT_DELETION_REVENUECAT_OBSERVATION_RESET_CAS_FAILED'
      using errcode = '40001';
  end if;

  update public.account_deletion_operations
     set revenuecat_absence_observation_count = 0,
         revenuecat_absence_first_observed_at = null,
         revenuecat_absence_second_observed_at = null,
         revenuecat_absence_last_claim_digest = null,
         updated_at = v_now
   where id = p_operation_id;
  return query select true;
end;
$$;

-- Bounded maintenance removes expired unattached identities immediately and
-- closes only drain-attached evidence. Candidate discovery takes no row lock;
-- the account advisory lock is always acquired before conditional mutation.
create or replace function public.reap_expired_account_publication_leases(
  p_limit integer
)
returns table (
  leases_closed integer,
  operations_drained integer,
  leases_purged integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_row record;
  v_closed integer := 0;
  v_drained integer := 0;
  v_purged integer := 0;
  v_folded integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'ACCOUNT_PUBLICATION_REAPER_INVALID' using errcode = '22023';
  end if;
  v_now := clock_timestamp();

  for v_row in
    select leases.capability_digest,
           leases.user_id,
           leases.drain_operation_id
      from public.account_publication_leases as leases
     where leases.state in ('reserved', 'active', 'draining')
       and leases.expires_at <= v_now
     order by leases.expires_at, leases.capability_digest
     limit p_limit
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(
      public._account_deletion_advisory_key(v_row.user_id)
    ) then
      continue;
    end if;
    v_now := clock_timestamp();
    if v_row.drain_operation_id is null then
      delete from public.account_publication_leases as leases
       where leases.capability_digest = v_row.capability_digest
         and leases.drain_operation_id is null
         and leases.state in ('reserved', 'active')
         and leases.expires_at <= v_now;
      if found then
        v_purged := v_purged + 1;
      end if;
    else
      update public.account_publication_leases as leases
         set state = 'closed',
             closed_at = leases.expires_at,
             close_reason = 'deadline_expired',
             updated_at = v_now
       where leases.capability_digest = v_row.capability_digest
         and leases.drain_operation_id = v_row.drain_operation_id
         and leases.state = 'draining'
         and leases.expires_at <= v_now;
      if found then
        select count(*) into v_folded
          from public.account_publication_leases as folded
         where folded.drain_operation_id = v_row.drain_operation_id
           and (
             folded.state = 'closed'
             or (
               folded.state = 'draining'
               and folded.expires_at <= v_now
             )
           );
        if public._settle_account_publication_drain(v_row.user_id, v_now) then
          v_closed := v_closed + v_folded;
          v_drained := v_drained + 1;
        else
          v_closed := v_closed + 1;
        end if;
      end if;
    end if;
  end loop;

  return query select v_closed, v_drained, v_purged;
end;
$$;

-- Preserve provider ordering while making the RevenueCat gate independent of
-- first-party erasure. A gated pending RevenueCat step blocks PostHog, but it
-- does not stop the strict photo -> service-row -> Auth local chain.
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
  with publication_gate as (
    select operations.publication_drained_at is not null
           and not exists (
             select 1
               from public.account_publication_leases as leases
              where leases.drain_operation_id = operations.id
                and leases.user_id = operations.user_id
                and leases.state = 'draining'
                and leases.expires_at > p_now
           ) as publication_drained,
           operations.publication_drained_at is not null
           and operations.publication_settle_not_before is not null
           and operations.publication_settle_not_before <= p_now
           and (
             operations.revenuecat_absence_observation_count <> 1
             or operations.revenuecat_absence_first_observed_at
                  + interval '60 seconds' <= p_now
           )
           and not exists (
             select 1
               from public.account_publication_leases as leases
              where leases.drain_operation_id = operations.id
                and leases.user_id = operations.user_id
                and leases.state = 'draining'
                and leases.expires_at > p_now
           ) as revenuecat_ready
      from public.account_deletion_operations as operations
     where operations.id = p_operation_id
  ), normalized as (
    select steps.step_name,
           steps.step_order,
           case
             when steps.status = 'request_started'
                  and steps.lease_expires_at <= p_now then 'ambiguous'
             when steps.status = 'leased'
                  and steps.lease_expires_at <= p_now
                  and steps.lease_kind = 'reconcile' then 'ambiguous'
             when steps.status = 'leased'
                  and steps.lease_expires_at <= p_now then 'pending'
             else steps.status
           end as effective_status,
           case
             when steps.status = 'leased'
                  and steps.lease_expires_at <= p_now
                  and steps.lease_kind = 'dispatch' then p_now
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
       and coalesce(normalized.effective_next_attempt_at, '-infinity'::timestamptz)
             <= p_now
     order by normalized.step_order
     limit 1
  ), choices as (
    select 10 as priority, provider_blocker.step_order, provider_blocker.step_name
      from provider_blocker cross join publication_gate
     where p_claim_mode = 'dispatch'
       and provider_blocker.effective_status = 'pending'
       and (
         provider_blocker.step_name <> 'revenuecat_delete'
         or publication_gate.revenuecat_ready
       )
       and coalesce(provider_blocker.effective_next_attempt_at, '-infinity'::timestamptz)
             <= p_now
    union all
    select 20, local_blocker.step_order, local_blocker.step_name
      from local_blocker cross join publication_gate
     where p_claim_mode = 'dispatch'
       and publication_gate.publication_drained
       and (
         not exists (select 1 from provider_blocker)
         or exists (
           select 1 from provider_blocker
            where provider_blocker.step_name = 'revenuecat_delete'
              and not publication_gate.revenuecat_ready
         )
       )
       and local_blocker.effective_status = 'pending'
       and coalesce(local_blocker.effective_next_attempt_at, '-infinity'::timestamptz)
             <= p_now
    union all
    select 30, local_blocker.step_order, local_blocker.step_name
      from local_blocker cross join publication_gate
     where p_claim_mode = 'reconcile'
       and publication_gate.publication_drained
       and local_blocker.effective_status = 'ambiguous'
       and coalesce(local_blocker.effective_next_attempt_at, '-infinity'::timestamptz)
             <= p_now
    union all
    select 40, due_provider_reconcile.step_order, due_provider_reconcile.step_name
      from due_provider_reconcile cross join publication_gate
     where p_claim_mode = 'reconcile'
       and (
         due_provider_reconcile.step_name <> 'revenuecat_delete'
         or publication_gate.revenuecat_ready
       )
       and not exists (
         select 1 from local_blocker
          where local_blocker.effective_status = 'ambiguous'
            and coalesce(local_blocker.effective_next_attempt_at, '-infinity'::timestamptz)
                  <= p_now
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

-- Compatibility patch: reconcile claims are leased (with their prior
-- request_started_at retained). Permit the established deletion-verified code
-- from that exact state; the transition trigger above remains the terminal
-- two-observation guard.
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
  v_now timestamptz;
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
  v_now := clock_timestamp();
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);

  select steps.* into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;
  v_now := clock_timestamp();

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
             when v_step.lease_kind = 'reconcile' then v_step.request_started_at
             else null
           end,
           result_code = p_result_code,
           updated_at = v_now
     where operation_id = p_operation_id and step_name = p_step_name
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
     where operation_id = p_operation_id and step_name = p_step_name
    returning * into v_step;
  elsif p_outcome = 'ambiguous' then
    if v_step.status <> 'request_started'
       or (
         p_retry_at is not null
         and (
           v_step.step_name <> 'revenuecat_delete'
           or not pg_catalog.isfinite(p_retry_at)
           or p_retry_at < v_now
           or p_retry_at > v_now + interval '7 days'
         )
       ) then
      raise exception 'ACCOUNT_DELETION_AMBIGUOUS_REQUIRES_STARTED_REQUEST'
        using errcode = '22023';
    end if;
    update public.account_deletion_steps
       set status = 'ambiguous',
           next_attempt_at = p_retry_at,
           lease_kind = null,
           claim_digest = null,
           lease_expires_at = null,
           result_code = p_result_code,
           updated_at = v_now
     where operation_id = p_operation_id and step_name = p_step_name
    returning * into v_step;
  else
    -- An already-absent result is only safe when the provider request was
    -- never started under this durable step. Keep this explicit instead of
    -- relying on the generic request_started success path below.
    if v_step.step_name = 'revenuecat_delete'
       and p_result_code = 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED'
       and v_step.request_started_at is not null then
      raise exception 'ACCOUNT_DELETION_SUCCESS_REQUIRES_STARTED_REQUEST'
        using errcode = '22023';
    end if;

    if not (
         v_step.status = 'request_started'
         or (
           v_step.status = 'leased'
           and (
             v_step.step_name = 'service_rows_scrub'
             or (
               v_step.step_name = 'apple_revoke'
               and p_result_code in (
                 'APPLE_NOT_LINKED', 'APPLE_MANUAL_REVOCATION_RECORDED'
               )
             )
             or (
               v_step.step_name = 'revenuecat_delete'
               and (
                 (
                   v_step.request_started_at is null
                   and p_result_code = 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED'
                 )
                 or (
                   v_step.lease_kind = 'reconcile'
                   and v_step.request_started_at is not null
                   and p_result_code = 'REVENUECAT_V2_DELETION_VERIFIED'
                 )
               )
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
     where operation_id = p_operation_id and step_name = p_step_name
    returning * into v_step;
  end if;

  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select operations.* into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  return query select v_operation.state, v_step.status, v_step.next_attempt_at;
end;
$$;

revoke all on function public.record_account_deletion_step(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_account_deletion_step(
  uuid, text, text, text, text, timestamptz
) to service_role;

-- Keep the 0051 implementation intact behind a post-lock wrapper. The wrapper
-- acquires every account and identity-HMAC lock first, then refreshes the DB
-- clock and revalidates the exact worker claim before the legacy implementation
-- can mutate tombstones or scrub provider identity rows.
alter function public.establish_revenuecat_deletion_identity_barrier(
  uuid, text, smallint, text[], text[], timestamptz
) rename to _establish_revenuecat_deletion_identity_barrier_v0051_locked;

revoke all on function public._establish_revenuecat_deletion_identity_barrier_v0051_locked(
  uuid, text, smallint, text[], text[], timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.establish_revenuecat_deletion_identity_barrier(
  p_operation_id uuid,
  p_claim_token text,
  p_identity_hmac_key_version smallint,
  p_identity_hmacs text[],
  p_raw_identities text[],
  p_expires_at timestamptz
)
returns table (
  established boolean,
  tombstone_version smallint,
  identity_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_operation public.account_deletion_operations%rowtype;
  v_operation_user_id uuid;
  v_step public.account_deletion_steps%rowtype;
  v_account_ids uuid[] := '{}'::uuid[];
  v_account_id uuid;
  v_lock_hmac text;
  v_raw_count integer := pg_catalog.cardinality(coalesce(p_raw_identities, '{}'::text[]));
  v_hash_count integer := pg_catalog.cardinality(coalesce(p_identity_hmacs, '{}'::text[]));
begin
  if p_operation_id is null
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_identity_hmac_key_version is null
     or p_identity_hmac_key_version not between 1 and 32767
     or p_identity_hmacs is null
     or p_raw_identities is null
     or v_raw_count < 1
     or v_raw_count > 66
     or v_hash_count <> v_raw_count
     or p_expires_at is null
     or not pg_catalog.isfinite(p_expires_at)
     or exists (
       select 1 from unnest(p_identity_hmacs) as digest(value)
        where digest.value is null or digest.value !~ '^[a-f0-9]{64}$'
     )
     or exists (
       select 1 from unnest(p_raw_identities) as identity(value)
        where identity.value is null
           or identity.value = ''
           or identity.value <> pg_catalog.btrim(identity.value)
           or pg_catalog.octet_length(
                pg_catalog.convert_to(identity.value, 'UTF8')
              ) > 1500
     )
     or (
       select coalesce(pg_catalog.sum(pg_catalog.octet_length(
         pg_catalog.convert_to(identity.value, 'UTF8')
       )), 0)
         from unnest(p_raw_identities) as identity(value)
     ) > 4096
     or (select count(distinct identity.value)
           from unnest(p_raw_identities) as identity(value))
          <> v_raw_count
     or (select count(distinct digest.value)
           from unnest(p_identity_hmacs) as digest(value))
          <> v_hash_count then
    raise exception 'REVENUECAT_IDENTITY_BARRIER_INPUT_INVALID' using errcode = '22023';
  end if;

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id;
  if v_operation.id is null then
    raise exception 'ACCOUNT_DELETION_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_operation_user_id := v_operation.user_id;

  with raw_account_ids as (
    select account.account_id
      from unnest(p_raw_identities) as identity(value)
      cross join lateral unnest(
        public._revenuecat_embedded_account_uuids(identity.value)
      ) as account(account_id)
  ), all_account_ids as (
    select v_operation_user_id as account_id
    union
    select raw_account_ids.account_id from raw_account_ids
  )
  select coalesce(
    pg_catalog.array_agg(account_id order by account_id::text), '{}'::uuid[]
  ) into v_account_ids
    from all_account_ids;

  foreach v_account_id in array v_account_ids loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._account_deletion_advisory_key(v_account_id)
    );
  end loop;
  for v_lock_hmac in
    select distinct digest.value
      from unnest(p_identity_hmacs) as digest(value)
     order by digest.value
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._revenuecat_identity_tombstone_advisory_key(
        p_identity_hmac_key_version, v_lock_hmac
      )
    );
  end loop;

  select operations.*
    into v_operation
    from public.account_deletion_operations as operations
   where operations.id = p_operation_id
   for update;
  select steps.*
    into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = 'revenuecat_delete'
   for update;
  v_now := clock_timestamp();

  if p_expires_at <= v_now
     or p_expires_at > v_now + interval '825 days'
     or v_operation.id is null
     or v_operation.user_id is distinct from v_operation_user_id
     or v_operation.publication_drained_at is null
     or v_operation.publication_settle_not_before is null
     or v_operation.publication_settle_not_before > v_now
     or exists (
       select 1 from public.account_publication_leases as leases
        where leases.drain_operation_id = v_operation.id
          and leases.user_id = v_operation.user_id
          and leases.state = 'draining'
          and leases.expires_at > v_now
     )
     or not exists (
       select 1 from public.account_deletion_barriers as barriers
        where barriers.user_id = v_operation.user_id
          and barriers.operation_id = v_operation.id
     )
     or v_step.step_name is null
     or v_step.status <> 'leased'
     or v_step.lease_kind <> 'dispatch'
     or v_step.request_started_at is not null
     or v_step.lease_expires_at is null
     or v_step.lease_expires_at <= v_now
     or v_step.claim_digest is distinct from
          public._account_deletion_claim_digest(p_claim_token) then
    raise exception 'REVENUECAT_IDENTITY_BARRIER_CAS_FAILED' using errcode = '40001';
  end if;

  return query
    select result.established, result.tombstone_version, result.identity_count
      from public._establish_revenuecat_deletion_identity_barrier_v0051_locked(
        p_operation_id,
        p_claim_token,
        p_identity_hmac_key_version,
        p_identity_hmacs,
        p_raw_identities,
        p_expires_at
      ) as result;
end;
$$;

revoke all on function public.establish_revenuecat_deletion_identity_barrier(
  uuid, text, smallint, text[], text[], timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.establish_revenuecat_deletion_identity_barrier(
  uuid, text, smallint, text[], text[], timestamptz
) to service_role;

-- The service-row scrub predates publication authority. Keep its implementation
-- behind a drain-aware wrapper so direct RPC callers cannot erase first-party
-- rows while a compliant client can still publish replacement data.
alter function public.scrub_account_service_rows(uuid)
  rename to _scrub_account_service_rows_v0046_unlocked;
revoke all on function public._scrub_account_service_rows_v0046_unlocked(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.scrub_account_service_rows(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_operation_id uuid;
begin
  if p_user_id is null then
    raise exception 'ACCOUNT_SERVICE_SCRUB_INVALID_USER' using errcode = '22004';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  v_now := clock_timestamp();
  select operations.id
    into v_operation_id
    from public.account_deletion_barriers as barriers
    join public.account_deletion_operations as operations
      on operations.id = barriers.operation_id
     and operations.user_id = barriers.user_id
   where barriers.user_id = p_user_id
     and operations.publication_drained_at is not null
     and not exists (
       select 1 from public.account_publication_leases as leases
        where leases.drain_operation_id = operations.id
          and leases.user_id = operations.user_id
          and leases.state = 'draining'
          and leases.expires_at > v_now
     )
   for update of operations;
  if v_operation_id is null then
    raise exception 'ACCOUNT_DELETION_LOCAL_ERASURE_PUBLICATION_NOT_DRAINED'
      using errcode = '55000';
  end if;
  return public._scrub_account_service_rows_v0046_unlocked(p_user_id);
end;
$$;

revoke all on function public.scrub_account_service_rows(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.scrub_account_service_rows(uuid)
  to service_role;

-- RevenueCat rate limits are separate per API domain and app-level key.
-- Enforce database-global fixed-window budgets so overlapping Edge isolates
-- cannot multiply the per-claim allowance. Each fixed cap is below half the
-- provider limit, so even two adjacent full buckets fit within any 60 seconds.
-- Only a domain-separated credential fingerprint is stored.
alter table public.edge_rate_limits
  drop constraint edge_rate_limits_scope_owner_classification;
alter table public.edge_rate_limits
  add constraint edge_rate_limits_scope_owner_classification
    check (
      (
        scope in (
          'account-deletion-intake', 'catalog-lookup', 'catalog-search', 'data-export'
        )
        and owner_user_id is not null
      )
      or (
        scope in (
          'account-deletion-provider-revenuecat-customer',
          'account-deletion-provider-revenuecat-project',
          'account-deletion-status', 'growth-event', 'waitlist'
        )
        and owner_user_id is null
      )
    );

create or replace function public.consume_revenuecat_account_deletion_budget(
  p_key_hash text,
  p_domain text
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
  v_scope text;
  v_limit integer;
begin
  if p_key_hash is null
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_domain is null
     or p_domain not in ('customer-information', 'project-configuration') then
    raise exception 'ACCOUNT_DELETION_PROVIDER_BUDGET_INVALID'
      using errcode = '22023';
  end if;
  if p_domain = 'customer-information' then
    v_scope := 'account-deletion-provider-revenuecat-customer';
    v_limit := 225;
  else
    v_scope := 'account-deletion-provider-revenuecat-project';
    v_limit := 25;
  end if;

  perform public.purge_expired_edge_rate_limits(100);
  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from v_now) / 60) * 60
  );
  v_expires_at := v_window_start + interval '1 hour';

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
    v_scope,
    p_key_hash,
    null,
    v_window_start,
    60,
    1,
    v_expires_at,
    v_now,
    v_now
  )
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = limits.request_count + 1,
    updated_at = v_now
  where limits.owner_user_id is null
    and limits.window_seconds = 60
    and limits.expires_at = excluded.expires_at
  returning request_count into v_request_count;

  if v_request_count is null then
    raise exception 'ACCOUNT_DELETION_PROVIDER_BUDGET_CONFLICT'
      using errcode = 'P0001';
  end if;
  return v_request_count <= v_limit;
end;
$$;

revoke all on function public.consume_revenuecat_account_deletion_budget(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_revenuecat_account_deletion_budget(text, text)
  to service_role;

create or replace function public.defer_account_deletion_revenuecat_provider_capacity(
  p_operation_id uuid,
  p_step_name text,
  p_claim_token text,
  p_retry_at timestamptz
)
returns table (deferred boolean, next_attempt_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_operation public.account_deletion_operations%rowtype;
  v_step public.account_deletion_steps%rowtype;
begin
  if p_operation_id is null
     or p_step_name <> 'revenuecat_delete'
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_retry_at is null
     or not pg_catalog.isfinite(p_retry_at) then
    raise exception 'ACCOUNT_DELETION_PROVIDER_CAPACITY_DEFER_INVALID'
      using errcode = '22023';
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
  v_now := clock_timestamp();
  if p_retry_at < v_now + interval '1 second'
     or p_retry_at > v_now + interval '5 minutes' then
    raise exception 'ACCOUNT_DELETION_PROVIDER_CAPACITY_DEFER_INVALID'
      using errcode = '22023';
  end if;

  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  select steps.* into v_step
    from public.account_deletion_steps as steps
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name
   for update;
  v_now := clock_timestamp();
  if v_step.step_name is null
     or v_step.status <> 'leased'
     or v_step.lease_kind not in ('dispatch', 'reconcile')
     or v_step.claim_digest
          is distinct from public._account_deletion_claim_digest(p_claim_token)
     or v_step.lease_expires_at <= v_now then
    raise exception 'ACCOUNT_DELETION_PROVIDER_CAPACITY_DEFER_CAS_FAILED'
      using errcode = '40001';
  end if;

  update public.account_deletion_steps as steps
     set status = case when v_step.lease_kind = 'reconcile' then 'ambiguous' else 'pending' end,
         attempt_count = greatest(steps.attempt_count - 1, 0),
         next_attempt_at = p_retry_at,
         lease_kind = null,
         claim_digest = null,
         lease_expires_at = null,
         request_started_at = case
           when v_step.lease_kind = 'reconcile' then v_step.request_started_at
           else null
         end,
         result_code = 'REVENUECAT_V2_PROVIDER_CAPACITY_DEFERRED',
         updated_at = v_now
   where steps.operation_id = p_operation_id
     and steps.step_name = p_step_name;
  perform public._refresh_account_deletion_operation(p_operation_id, v_now);
  return query select true, p_retry_at;
end;
$$;

revoke all on function public.defer_account_deletion_revenuecat_provider_capacity(
  uuid, text, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.defer_account_deletion_revenuecat_provider_capacity(
  uuid, text, text, timestamptz
) to service_role;

revoke all on function public.reserve_account_publication_lease(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.activate_account_publication_lease(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.renew_account_publication_lease(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.release_account_publication_lease(text)
  from public, anon, authenticated, service_role;
revoke all on function public.record_account_deletion_revenuecat_absence_observation(
  uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.reset_account_deletion_revenuecat_absence_observations(
  uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.reap_expired_account_publication_leases(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.reserve_account_publication_lease(uuid, uuid, text)
  to service_role;
grant execute on function public.activate_account_publication_lease(uuid, uuid, text)
  to service_role;
grant execute on function public.renew_account_publication_lease(uuid, uuid, text)
  to service_role;
grant execute on function public.release_account_publication_lease(text)
  to service_role;
grant execute on function public.record_account_deletion_revenuecat_absence_observation(
  uuid, text, text
) to service_role;
grant execute on function public.reset_account_deletion_revenuecat_absence_observations(
  uuid, text, text
) to service_role;
grant execute on function public.reap_expired_account_publication_leases(integer)
  to service_role;

comment on table public.account_publication_leases is
  'Sealed, short-lived publication authority. Stores only a domain-separated capability digest and exact Auth session/account UUIDs; unattached rows are deleted on release/expiry and drain rows are deleted immediately after exact authority-end metadata is folded into the operation.';
comment on function public.begin_account_deletion(
  uuid, uuid, text, text, timestamptz, bytea, bytea, bytea
) is
  'Destructive intake bound under the account advisory lock to the exact live Auth session that Edge authenticated; missing/mismatched sessions fail with SQLSTATE 28000 before lifecycle mutation.';
comment on function public.get_account_deletion_barrier_state(uuid, uuid) is
  'Opaque preflight bound under the account advisory lock to an exact live Auth session; returns only clear or active.';
comment on function public.consume_edge_rate_limit(
  text, text, integer, integer, uuid, uuid
) is
  'Account-deletion intake quota bound under the account advisory lock to an exact live Auth session; the legacy five-argument intake path fails closed.';
comment on function public.reserve_account_publication_lease(uuid, uuid, text) is
  'Service-only 30-second publication reservation bound to an exact live Auth session and the account deletion advisory lock.';
comment on function public.activate_account_publication_lease(uuid, uuid, text) is
  'Service-only activation immediately before publication; grants a fixed 60-second server-clock authority window.';
comment on function public.renew_account_publication_lease(uuid, uuid, text) is
  'Service-only fixed 60-second renewal while the exact Auth session remains live and no deletion barrier exists.';
comment on function public.release_account_publication_lease(text) is
  'Capability-only, idempotent and non-enumerating release that remains valid after Auth deletion.';
comment on function public.record_account_deletion_revenuecat_absence_observation(uuid, text, text) is
  'Atomic attestation that one CAS-valid claim completed one full-family absence round; two distinct claims and at least 60 seconds are required, and partial identity evidence must not cross claims.';
comment on function public.reap_expired_account_publication_leases(integer) is
  'Bounded advisory-lock-ordered cleanup that removes expired unattached identities and closes exact-deadline drain evidence.';
comment on function public.consume_revenuecat_account_deletion_budget(text, text) is
  'Service-only database-global RevenueCat deletion budgets by official API domain: 225 customer-information or 25 project-configuration requests per UTC minute/key fingerprint. Even two full adjacent buckets remain below the provider 480/minute and 60/minute domain limits.';
comment on function public.defer_account_deletion_revenuecat_provider_capacity(
  uuid, text, text, timestamptz
) is
  'Exact-claim CAS release for distributed RevenueCat quota exhaustion. Restores the consumed attempt and defers safely without marking an unsent mutation ambiguous.';

commit;
