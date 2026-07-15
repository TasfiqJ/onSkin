-- =============================================================================
-- B-SIWA-SERVER-LIFECYCLE - durable Sign in with Apple credential authority
-- =============================================================================
-- A Supabase session is not proof that Apple's short-lived authorization code
-- was exchanged and retained. Apple-backed accounts therefore remain unable to
-- read or mutate account-owned data until the server has attested the native
-- identity token, exchanged the one-use code, and stored the refresh token in a
-- versioned authenticated-encryption envelope.

begin;

-- -----------------------------------------------------------------------------
-- Sealed lifecycle, capture, and server-notification state
-- -----------------------------------------------------------------------------

create table public.apple_auth_lifecycles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  apple_subject_hmac text not null unique
    check (apple_subject_hmac ~ '^[a-f0-9]{64}$'),
  subject_hmac_key_version text not null
    check (subject_hmac_key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  client_id text not null
    check (
      pg_catalog.length(client_id) between 3 and 255
      and client_id = pg_catalog.btrim(client_id)
      and client_id !~ '[[:cntrl:]]'
    ),
  state text not null
    check (state in ('active', 'revoked', 'account_deleted', 'action_required')),
  generation bigint not null default 1 check (generation >= 1),
  encrypted_refresh_token bytea,
  vault_key_version text
    check (vault_key_version is null or vault_key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  last_validated_at timestamptz,
  next_validation_at timestamptz,
  validation_claim_digest text
    check (validation_claim_digest is null or validation_claim_digest ~ '^[a-f0-9]{64}$'),
  validation_lease_expires_at timestamptz,
  validation_attempt_count integer not null default 0
    check (validation_attempt_count between 0 and 1000000),
  relay_email_state text not null default 'unknown'
    check (relay_email_state in ('unknown', 'enabled', 'disabled')),
  relay_email_hmac text check (relay_email_hmac is null or relay_email_hmac ~ '^[a-f0-9]{64}$'),
  last_event_at timestamptz,
  last_event_rank smallint not null default 0 check (last_event_rank between 0 and 4),
  last_failure_code text
    check (last_failure_code is null or last_failure_code ~ '^[A-Z0-9_]{1,64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (octet_length(encrypted_refresh_token) between 1 and 8192),
  check (
    (state = 'active' and encrypted_refresh_token is not null and vault_key_version is not null)
    or (state <> 'active' and encrypted_refresh_token is null and vault_key_version is null)
  ),
  check (
    (state = 'active' and last_validated_at is not null and next_validation_at is not null)
    or (state <> 'active' and next_validation_at is null)
  ),
  check (
    (validation_claim_digest is null and validation_lease_expires_at is null)
    or (
      state = 'active'
      and validation_claim_digest is not null
      and validation_lease_expires_at is not null
    )
  ),
  check (
    (last_validated_at is null or pg_catalog.isfinite(last_validated_at))
    and (next_validation_at is null or pg_catalog.isfinite(next_validation_at))
    and (validation_lease_expires_at is null or pg_catalog.isfinite(validation_lease_expires_at))
    and (last_event_at is null or pg_catalog.isfinite(last_event_at))
    and pg_catalog.isfinite(created_at)
    and pg_catalog.isfinite(updated_at)
  )
);

create index apple_auth_lifecycles_validation_due_idx
  on public.apple_auth_lifecycles (next_validation_at, user_id)
  where state = 'active';

create table public.apple_auth_capture_operations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  code_hmac text not null unique check (code_hmac ~ '^[a-f0-9]{64}$'),
  apple_subject_hmac text not null check (apple_subject_hmac ~ '^[a-f0-9]{64}$'),
  subject_hmac_key_version text not null
    check (subject_hmac_key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  client_id text not null
    check (
      pg_catalog.length(client_id) between 3 and 255
      and client_id = pg_catalog.btrim(client_id)
      and client_id !~ '[[:cntrl:]]'
    ),
  state text not null default 'reserved'
    check (state in ('reserved', 'exchange_started', 'succeeded', 'failed', 'expired')),
  failure_code text check (failure_code is null or failure_code ~ '^[A-Z0-9_]{1,64}$'),
  created_at timestamptz not null default clock_timestamp(),
  exchange_started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (clock_timestamp() + interval '10 minutes'),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, user_id),
  check (
    pg_catalog.isfinite(created_at)
    and pg_catalog.isfinite(expires_at)
    and pg_catalog.isfinite(updated_at)
    and expires_at > created_at
  ),
  check (
    (state = 'reserved' and exchange_started_at is null and completed_at is null)
    or (
      state = 'exchange_started'
      and exchange_started_at is not null
      and completed_at is null
      and pg_catalog.isfinite(exchange_started_at)
    )
    or (
      state in ('succeeded', 'failed', 'expired')
      and completed_at is not null
      and pg_catalog.isfinite(completed_at)
    )
  )
);

create index apple_auth_capture_operations_owner_created_idx
  on public.apple_auth_capture_operations (user_id, created_at desc);
create index apple_auth_capture_operations_expiry_idx
  on public.apple_auth_capture_operations (expires_at)
  where state in ('reserved', 'exchange_started');

create table public.apple_auth_server_events (
  id bigint generated always as identity primary key,
  jti_hmac text not null unique check (jti_hmac ~ '^[a-f0-9]{64}$'),
  payload_hmac text not null unique check (payload_hmac ~ '^[a-f0-9]{64}$'),
  apple_subject_hmac text not null check (apple_subject_hmac ~ '^[a-f0-9]{64}$'),
  subject_hmac_key_version text not null
    check (subject_hmac_key_version ~ '^[A-Za-z0-9._-]{1,64}$'),
  client_id text not null
    check (
      pg_catalog.length(client_id) between 3 and 255
      and client_id = pg_catalog.btrim(client_id)
      and client_id !~ '[[:cntrl:]]'
    ),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null
    check (
      event_type in (
        'email-enabled', 'email-disabled', 'consent-revoked', 'account-deleted', 'unknown'
      )
    ),
  event_at timestamptz not null,
  relay_email_hmac text check (relay_email_hmac is null or relay_email_hmac ~ '^[a-f0-9]{64}$'),
  result_code text not null
    check (
      result_code in (
        'applied', 'duplicate', 'stale', 'unknown_subject', 'ignored_unknown'
      )
    ),
  received_at timestamptz not null default clock_timestamp(),
  check (pg_catalog.isfinite(event_at) and pg_catalog.isfinite(received_at))
);

create index apple_auth_server_events_subject_time_idx
  on public.apple_auth_server_events (apple_subject_hmac, event_at desc);
create index apple_auth_server_events_received_idx
  on public.apple_auth_server_events (received_at);

alter table public.apple_auth_lifecycles enable row level security;
alter table public.apple_auth_lifecycles force row level security;
alter table public.apple_auth_capture_operations enable row level security;
alter table public.apple_auth_capture_operations force row level security;
alter table public.apple_auth_server_events enable row level security;
alter table public.apple_auth_server_events force row level security;

revoke all on table public.apple_auth_lifecycles
  from public, anon, authenticated, service_role;
revoke all on table public.apple_auth_capture_operations
  from public, anon, authenticated, service_role;
revoke all on table public.apple_auth_server_events
  from public, anon, authenticated, service_role;
revoke all on sequence public.apple_auth_server_events_id_seq
  from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Internal integrity helpers
-- -----------------------------------------------------------------------------

create or replace function public._apple_auth_claim_digest(p_claim_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to('routinekind-apple-auth-validation-claim:v1:' || p_claim_token, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public._apple_auth_claim_digest(text)
  from public, anon, authenticated, service_role;

create or replace function public._apple_auth_next_validation_at(
  p_user_id uuid,
  p_generation bigint,
  p_now timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_now
    + interval '24 hours'
    + pg_catalog.make_interval(
        secs => pg_catalog.abs(
          pg_catalog.hashtextextended(p_user_id::text || ':' || p_generation::text, 550055)::bigint
          % 7201
        )::integer
      );
$$;

revoke all on function public._apple_auth_next_validation_at(uuid, bigint, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public._apple_auth_has_identity(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_user_id is not null and exists (
    select 1
      from auth.identities as identities
     where identities.user_id = p_user_id
       and identities.provider = 'apple'
  );
$$;

revoke all on function public._apple_auth_has_identity(uuid)
  from public, anon, authenticated, service_role;

create or replace function public._apple_auth_identity_matches(
  p_user_id uuid,
  p_apple_subject text
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_user_id is not null
     and p_apple_subject is not null
     and pg_catalog.length(p_apple_subject) between 1 and 512
     and p_apple_subject = pg_catalog.btrim(p_apple_subject)
     and exists (
       select 1
         from auth.identities as identities
        where identities.user_id = p_user_id
          and identities.provider = 'apple'
          and identities.identity_data ->> 'sub' = p_apple_subject
     );
$$;

revoke all on function public._apple_auth_identity_matches(uuid, text)
  from public, anon, authenticated, service_role;

-- This predicate is deliberately false when an Apple identity exists but the
-- capture row is absent. Calling Supabase Auth directly therefore cannot bypass
-- the code-exchange/vault boundary. A 72-hour validation ceiling fails closed
-- if the scheduled worker disappears without making a lifecycle decision.
create or replace function public._account_access_allowed(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );

  if not exists (select 1 from auth.users as users where users.id = p_user_id) then
    return false;
  end if;
  -- A lifecycle row remains authoritative after an Apple identity is unlinked.
  -- Otherwise a terminal lifecycle could be bypassed by establishing a new
  -- session through a retained alternate provider. Only an owner that has
  -- neither an Apple identity nor any Apple lifecycle is not applicable.
  if not exists (
    select 1
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = p_user_id
  ) then
    return not public._apple_auth_has_identity(p_user_id);
  end if;

  return exists (
    select 1
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = p_user_id
       and lifecycles.state = 'active'
       and lifecycles.encrypted_refresh_token is not null
       and lifecycles.vault_key_version is not null
       and lifecycles.last_validated_at > v_now - interval '72 hours'
  );
end;
$$;

revoke all on function public._account_access_allowed(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.account_access_allowed()
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_text text := (select auth.jwt() ->> 'session_id');
  v_session_id uuid;
begin
  if v_user_id is null
     or v_session_text is null
     or v_session_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_session_id := v_session_text::uuid;
  if not exists (
    select 1 from auth.sessions as sessions
     where sessions.id = v_session_id and sessions.user_id = v_user_id
  ) then
    return false;
  end if;
  return public._account_access_allowed(v_user_id);
end;
$$;

revoke all on function public.account_access_allowed() from public, anon;
grant execute on function public.account_access_allowed() to authenticated;

-- Extend the canonical write authority. Existing direct and service-writer
-- barriers now close for an unvaulted or invalid Apple-backed account as well
-- as for an account-deletion barrier.
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

  return public._account_access_allowed(p_user_id)
    and not exists (
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
  if not public.account_access_allowed() then
    return false;
  end if;
  return not exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  );
end;
$$;

revoke all on function public.account_write_allowed() from public, anon;
grant execute on function public.account_write_allowed() to authenticated;

-- -----------------------------------------------------------------------------
-- Immediate stale-JWT denial for all canonical owner data and private photos
-- -----------------------------------------------------------------------------

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
      raise exception 'APPLE_AUTH_READ_BARRIER_TABLE_MISSING:%', v_table
        using errcode = 'P0001';
    end if;
    execute pg_catalog.format(
      'create policy apple_auth_read_barrier on public.%I '
      || 'as restrictive for select to authenticated '
      || 'using (public.account_access_allowed())',
      v_table
    );
  end loop;
end;
$$;

create policy apple_auth_read_barrier on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'photos' or public.account_access_allowed());

-- -----------------------------------------------------------------------------
-- Authenticated access preflight
-- -----------------------------------------------------------------------------

create or replace function public.get_account_access_state()
returns table (
  user_id uuid,
  state text,
  generation bigint
)
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_text text := (select auth.jwt() ->> 'session_id');
  v_session_id uuid;
  v_lifecycle public.apple_auth_lifecycles%rowtype;
begin
  if v_user_id is null
     or v_session_text is null
     or v_session_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'ACCOUNT_ACCESS_SESSION_REJECTED' using errcode = '28000';
  end if;
  v_session_id := v_session_text::uuid;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_user_id)
  );
  if not exists (
    select 1
      from auth.sessions as sessions
     where sessions.id = v_session_id
       and sessions.user_id = v_user_id
  ) then
    raise exception 'ACCOUNT_ACCESS_SESSION_REJECTED' using errcode = '28000';
  end if;

  select * into v_lifecycle
    from public.apple_auth_lifecycles as lifecycles
   where lifecycles.user_id = v_user_id;

  if v_lifecycle.user_id is null and not public._apple_auth_has_identity(v_user_id) then
    return query select v_user_id, 'not_applicable'::text, 0::bigint;
    return;
  end if;

  if public._account_access_allowed(v_user_id) then
    return query select v_user_id, 'active'::text, v_lifecycle.generation;
    return;
  end if;
  return query select v_user_id, 'blocked'::text, coalesce(v_lifecycle.generation, 0::bigint);
end;
$$;

revoke all on function public.get_account_access_state() from public, anon;
grant execute on function public.get_account_access_state() to authenticated;

-- Every authenticated health-consent RPC from v0054 enters through this
-- shared exact-session assertion. Extend that same function OID so existing
-- callers and previously compiled routines cannot bypass the Apple lifecycle
-- authority through a SECURITY DEFINER consent read or mutation.
create or replace function public._assert_current_health_session(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_text text := (select auth.jwt() ->> 'session_id');
  v_session_id uuid;
begin
  if p_user_id is null
     or v_session_text is null
     or v_session_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'HEALTH_CONSENT_SESSION_REJECTED' using errcode = '28000';
  end if;
  v_session_id := v_session_text::uuid;
  perform 1
    from auth.sessions as sessions
   where sessions.id = v_session_id
     and sessions.user_id = p_user_id
   for key share;
  if not found or not public._account_access_allowed(p_user_id) then
    raise exception 'HEALTH_CONSENT_SESSION_REJECTED' using errcode = '28000';
  end if;
end;
$$;

revoke all on function public._assert_current_health_session(uuid)
  from public, anon, authenticated, service_role;

-- The mobile subscription store reads this v0053 SECURITY DEFINER RPC
-- directly. Keep its reviewed projection logic intact behind a new exact
-- account-access wrapper; it is not a recovery/deletion/bootstrap lane.
alter function public.read_entitlement_projections()
  rename to _read_entitlement_projections_v0053_unfenced;
revoke all on function public._read_entitlement_projections_v0053_unfenced()
  from public, anon, authenticated, service_role;

create function public.read_entitlement_projections()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.account_access_allowed() then
    raise exception 'ACCOUNT_ACCESS_DENIED' using errcode = '28000';
  end if;
  return public._read_entitlement_projections_v0053_unfenced();
end;
$$;

revoke all on function public.read_entitlement_projections()
  from public, anon, authenticated, service_role;
grant execute on function public.read_entitlement_projections()
  to authenticated;

-- Older owner/consent policies call these SECURITY DEFINER boolean helpers,
-- and PostgREST also exposes every executable public-schema function as an
-- RPC. Bind both uses to the exact-session Apple account fence before running
-- their existing health-purpose or ownership logic. PL/pgSQL branching is
-- intentional: SQL boolean expressions may be reordered, so an already-issued
-- stale JWT must return false without probing any protected row or health
-- header state.
create or replace function public.has_current_consent(p_consent_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;

  return (
    select case
      when public._health_consent_type_protected(p_consent_type) then
        exists (
          select 1
            from public.health_processing_states as base
            join public.health_dependent_consent_states as dependent
              on dependent.user_id = base.user_id
             and dependent.consent_type = p_consent_type
            join public.health_consent_copy_registry as base_registry
              on base_registry.consent_type = 'health_data_collection'
             and base_registry.action = 'grant'
             and base_registry.version = base.consent_version
             and base_registry.consent_text_hash = base.consent_text_hash
             and base_registry.review_status = 'approved'
             and base_registry.is_current
            join public.health_consent_copy_registry as registry
              on registry.consent_type = dependent.consent_type
             and registry.action = 'grant'
             and registry.version = dependent.version
             and registry.consent_text_hash = dependent.consent_text_hash
             and registry.review_status = 'approved'
             and registry.is_current
           where base.user_id = (select auth.uid())
             and base.state = 'active'
             and dependent.state = 'active'
             and dependent.health_epoch = base.epoch
             and (
               p_consent_type not in ('photo_cloud_backup', 'photo_trend_insights')
               or exists (
                 select 1
                   from public.health_dependent_consent_states as capture
                   join public.health_consent_copy_registry as capture_registry
                     on capture_registry.consent_type = 'photo_capture'
                    and capture_registry.action = 'grant'
                    and capture_registry.version = capture.version
                    and capture_registry.consent_text_hash = capture.consent_text_hash
                    and capture_registry.review_status = 'approved'
                    and capture_registry.is_current
                  where capture.user_id = base.user_id
                    and capture.consent_type = 'photo_capture'
                    and capture.state = 'active'
                    and capture.health_epoch = base.epoch
               )
             )
        )
      else coalesce((
        select consents.granted
          from public.consents as consents
         where consents.user_id = (select auth.uid())
           and consents.consent_type = p_consent_type
         order by consents.granted_at desc, consents.granted asc, consents.id desc
         limit 1
      ), false)
    end
  );
end;
$$;

create or replace function public.owns_routine(p_routine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;
  return (
    select private.health_processing_read_allowed((select auth.uid()))
      and exists (
        select 1
          from public.routines as routines
         where routines.id = p_routine_id
           and routines.user_id = (select auth.uid())
      )
  );
end;
$$;

create or replace function public.owns_user_product(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;
  return (
    select private.health_processing_read_allowed((select auth.uid()))
      and exists (
        select 1
          from public.user_products as products
         where products.id = p_product_id
           and products.user_id = (select auth.uid())
      )
  );
end;
$$;

create or replace function public.owns_cycle(p_cycle_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;
  return (
    select private.health_processing_read_allowed((select auth.uid()))
      and exists (
        select 1
          from public.cycles as cycles
         where cycles.id = p_cycle_id
           and cycles.user_id = (select auth.uid())
      )
  );
end;
$$;

create or replace function public.owns_photo(p_photo_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;
  return (
    select private.health_dependent_read_allowed(
        (select auth.uid()), 'photo_capture'
      )
      and exists (
        select 1
          from public.photos as photos
         where photos.id = p_photo_id
           and photos.user_id = (select auth.uid())
           and (
             photos.local_only
             or private.health_dependent_read_allowed(
               (select auth.uid()), 'photo_cloud_backup'
             )
           )
      )
  );
end;
$$;

create or replace function public.owns_ask_turn_audit(p_turn_audit_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;
  return (
    select private.health_dependent_read_allowed((select auth.uid()), 'ask_onskin')
      and exists (
        select 1
          from public.ask_turn_audit as turns
          join public.ask_sessions as sessions on sessions.id = turns.session_id
         where turns.id = p_turn_audit_id
           and sessions.user_id = (select auth.uid())
      )
  );
end;
$$;

create or replace function public.owns_consent(p_consent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
declare
  v_health_epoch bigint;
begin
  if not public.account_access_allowed() then
    return false;
  end if;
  -- Keep the pre-existing exact header requirement. The constant dynamic call
  -- prevents schema lint from executing the request-bound helper without an
  -- HTTP request context while preserving its runtime error semantics.
  execute 'select public._request_health_processing_epoch()'
    into v_health_epoch;
  return (
    select exists (
      select 1
        from public.health_dependent_consent_states as states
       where states.user_id = (select auth.uid())
         and states.consent_type = 'community_participation'
         and states.state = 'active'
         and states.current_receipt_id = p_consent_id
         and states.health_epoch = v_health_epoch
    )
  );
end;
$$;

revoke all on function public.has_current_consent(text)
  from public, anon, authenticated, service_role;
revoke all on function public.owns_routine(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.owns_user_product(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.owns_cycle(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.owns_photo(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.owns_ask_turn_audit(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.owns_consent(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.has_current_consent(text) to authenticated;
grant execute on function public.owns_routine(uuid) to authenticated;
grant execute on function public.owns_user_product(uuid) to authenticated;
grant execute on function public.owns_cycle(uuid) to authenticated;
grant execute on function public.owns_photo(uuid) to authenticated;
grant execute on function public.owns_ask_turn_audit(uuid) to authenticated;
grant execute on function public.owns_consent(uuid) to authenticated;

-- Trigger functions never need a direct RPC surface. Trigger execution does
-- not depend on EXECUTE grants, so seal the legacy consent guard explicitly.
revoke all on function public.consents_block_update()
  from public, anon, authenticated, service_role;

-- Account deletion may reuse the already-retained Apple refresh token instead
-- of asking the user for another one-use authorization code. This RPC keeps the
-- vault sealed in transit, binds the read to the exact live Auth session, and
-- remains service-role only. The deletion runtime opens and immediately
-- re-seals the token under its separate per-step deletion key before beginning
-- the durable operation.
create or replace function public.get_apple_auth_deletion_vault(
  p_user_id uuid,
  p_session_id uuid
)
returns table (
  apple_subject_hmac text,
  client_id text,
  encrypted_refresh_token bytea,
  vault_key_version text,
  generation bigint
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
    select lifecycles.apple_subject_hmac,
           lifecycles.client_id,
           lifecycles.encrypted_refresh_token,
           lifecycles.vault_key_version,
           lifecycles.generation
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = p_user_id
       and lifecycles.state = 'active'
       and lifecycles.encrypted_refresh_token is not null
       and lifecycles.vault_key_version is not null;
end;
$$;

-- Preserve the session-bound v0052 intake contract while atomically retiring
-- the Apple vault after the durable deletion barrier and encrypted Apple step
-- have committed. A lost HTTP response can still be recovered through the
-- caller-held deletion status capability without leaving a reusable provider
-- credential behind the barrier.
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

  update public.apple_auth_lifecycles as lifecycles
     set state = 'action_required',
         generation = lifecycles.generation + 1,
         encrypted_refresh_token = null,
         vault_key_version = null,
         next_validation_at = null,
         validation_claim_digest = null,
         validation_lease_expires_at = null,
         last_failure_code = 'APPLE_ACCOUNT_DELETION_STARTED',
         updated_at = clock_timestamp()
   where lifecycles.user_id = p_user_id
     and lifecycles.state = 'active';
end;
$$;

-- -----------------------------------------------------------------------------
-- One-use authorization-code capture
-- -----------------------------------------------------------------------------

create or replace function public.begin_apple_auth_capture(
  p_operation_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_apple_subject text,
  p_apple_subject_hmacs text[],
  p_subject_hmac_key_versions text[],
  p_code_hmac text,
  p_client_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.apple_auth_capture_operations%rowtype;
  v_existing_lifecycle public.apple_auth_lifecycles%rowtype;
  v_terminal_event public.apple_auth_server_events%rowtype;
  v_now timestamptz := clock_timestamp();
  v_terminal_generation bigint;
  v_terminal_rank smallint;
  v_terminal_state text;
begin
  if p_operation_id is null
     or p_user_id is null
     or p_session_id is null
     or p_apple_subject_hmacs is null
     or p_subject_hmac_key_versions is null
     or coalesce(pg_catalog.array_ndims(p_apple_subject_hmacs), 0) <> 1
     or coalesce(pg_catalog.array_ndims(p_subject_hmac_key_versions), 0) <> 1
     or coalesce(pg_catalog.array_length(p_apple_subject_hmacs, 1), 0)
       not between 1 and 3
     or pg_catalog.array_lower(p_apple_subject_hmacs, 1) <> 1
     or pg_catalog.array_lower(p_subject_hmac_key_versions, 1) <> 1
     or pg_catalog.array_length(p_subject_hmac_key_versions, 1)
       <> pg_catalog.array_length(p_apple_subject_hmacs, 1)
     or exists (
       select 1 from pg_catalog.unnest(p_apple_subject_hmacs) as candidate(value)
        where candidate.value is null or candidate.value !~ '^[a-f0-9]{64}$'
     )
     or exists (
       select 1 from pg_catalog.unnest(p_subject_hmac_key_versions) as candidate(value)
        where candidate.value is null
           or candidate.value !~ '^[A-Za-z0-9._-]{1,64}$'
     )
     or p_code_hmac !~ '^[a-f0-9]{64}$'
     or p_client_id is null
     or pg_catalog.length(p_client_id) not between 3 and 255
     or p_client_id <> pg_catalog.btrim(p_client_id)
     or p_client_id ~ '[[:cntrl:]]'
     or not public._apple_auth_identity_matches(p_user_id, p_apple_subject) then
    raise exception 'APPLE_AUTH_CAPTURE_REJECTED' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  perform 1
    from auth.identities as identities
   where identities.user_id = p_user_id
     and identities.provider = 'apple'
     and identities.provider_id = p_apple_subject
     and identities.identity_data ->> 'sub' = p_apple_subject
   for key share;
  if not found or not exists (
    select 1
      from auth.sessions as sessions
     where sessions.id = p_session_id
       and sessions.user_id = p_user_id
  ) or exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    raise exception 'APPLE_AUTH_CAPTURE_SESSION_REJECTED' using errcode = '28000';
  end if;

  -- A terminal notification can be committed before Supabase Auth finishes
  -- inserting the identity row. Apple does not promise a retry, so first
  -- capture reconciles immutable keyed evidence before any one-use code is
  -- dispatched. This account-locked query takes no replay advisory or row
  -- lock, preserving the event->account lock order used by the event RPC.
  select events.* into v_terminal_event
    from public.apple_auth_server_events as events
   where events.result_code = 'unknown_subject'
     and events.user_id is null
     and events.client_id = p_client_id
     and events.event_type in ('consent-revoked', 'account-deleted')
     and exists (
       select 1
         from pg_catalog.generate_subscripts(p_apple_subject_hmacs, 1) as candidate(index)
        where p_apple_subject_hmacs[candidate.index] = events.apple_subject_hmac
          and p_subject_hmac_key_versions[candidate.index] = events.subject_hmac_key_version
     )
   order by case events.event_type when 'account-deleted' then 2 else 1 end desc,
            events.event_at desc,
            events.id desc
   limit 1;
  if found then
    if exists (
      select 1 from public.apple_auth_lifecycles as lifecycles
       where lifecycles.apple_subject_hmac = any(p_apple_subject_hmacs)
         and lifecycles.user_id <> p_user_id
    ) then
      raise exception 'APPLE_AUTH_EVENT_SUBJECT_AMBIGUOUS' using errcode = 'P0001';
    end if;
    select * into v_existing_lifecycle
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = p_user_id;
    v_terminal_state := case
      when v_terminal_event.event_type = 'account-deleted'
        or v_existing_lifecycle.state = 'account_deleted' then 'account_deleted'
      else 'revoked'
    end;
    v_terminal_rank := case v_terminal_state when 'account_deleted' then 4 else 3 end;
    v_terminal_generation := coalesce(v_existing_lifecycle.generation, 0) + 1;

    insert into public.apple_auth_lifecycles (
      user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
      generation, encrypted_refresh_token, vault_key_version, last_validated_at,
      next_validation_at, validation_claim_digest, validation_lease_expires_at,
      validation_attempt_count, last_event_at, last_event_rank, last_failure_code,
      created_at, updated_at
    ) values (
      p_user_id, p_apple_subject_hmacs[1], p_subject_hmac_key_versions[1],
      p_client_id, v_terminal_state, v_terminal_generation, null, null,
      v_existing_lifecycle.last_validated_at, null, null, null, 0,
      greatest(coalesce(v_existing_lifecycle.last_event_at, v_terminal_event.event_at),
        v_terminal_event.event_at),
      greatest(coalesce(v_existing_lifecycle.last_event_rank, 0), v_terminal_rank),
      case v_terminal_state
        when 'account_deleted' then 'APPLE_EVENT_ACCOUNT_DELETED'
        else 'APPLE_EVENT_CONSENT_REVOKED'
      end,
      v_now, v_now
    )
    on conflict (user_id) do update
      set apple_subject_hmac = excluded.apple_subject_hmac,
          subject_hmac_key_version = excluded.subject_hmac_key_version,
          client_id = excluded.client_id,
          state = excluded.state,
          generation = excluded.generation,
          encrypted_refresh_token = null,
          vault_key_version = null,
          next_validation_at = null,
          validation_claim_digest = null,
          validation_lease_expires_at = null,
          validation_attempt_count = 0,
          last_event_at = excluded.last_event_at,
          last_event_rank = excluded.last_event_rank,
          last_failure_code = excluded.last_failure_code,
          updated_at = excluded.updated_at;

    update public.apple_auth_server_events as events
       set user_id = p_user_id,
           result_code = 'applied'
     where events.result_code = 'unknown_subject'
       and events.user_id is null
       and events.client_id = p_client_id
       and events.event_type in ('consent-revoked', 'account-deleted')
       and exists (
         select 1
           from pg_catalog.generate_subscripts(p_apple_subject_hmacs, 1) as candidate(index)
          where p_apple_subject_hmacs[candidate.index] = events.apple_subject_hmac
            and p_subject_hmac_key_versions[candidate.index] = events.subject_hmac_key_version
       );
    perform public._queue_account_deletion_from_apple_event(p_user_id, v_now);
    delete from auth.sessions as sessions where sessions.user_id = p_user_id;
    return 'blocked';
  end if;

  select * into v_existing
    from public.apple_auth_capture_operations as operations
   where operations.code_hmac = p_code_hmac
      or operations.id = p_operation_id
   order by (operations.id = p_operation_id) desc
   limit 1
   for update;
  if found then
    if v_existing.id <> p_operation_id
       or v_existing.user_id <> p_user_id
       or v_existing.session_id <> p_session_id
       or v_existing.apple_subject_hmac <> p_apple_subject_hmacs[1]
       or v_existing.client_id <> p_client_id then
      raise exception 'APPLE_AUTH_CAPTURE_REPLAY_REJECTED' using errcode = '23505';
    end if;
    return v_existing.state;
  end if;

  if (
    select count(*)
      from public.apple_auth_capture_operations as operations
     where operations.user_id = p_user_id
       and operations.created_at > v_now - interval '15 minutes'
  ) >= 10 then
    raise exception 'APPLE_AUTH_CAPTURE_RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.apple_auth_capture_operations (
    id, user_id, session_id, code_hmac, apple_subject_hmac,
    subject_hmac_key_version, client_id, created_at, expires_at, updated_at
  ) values (
    p_operation_id, p_user_id, p_session_id, p_code_hmac, p_apple_subject_hmacs[1],
    p_subject_hmac_key_versions[1], p_client_id,
    v_now, v_now + interval '10 minutes', v_now
  );
  return 'reserved';
end;
$$;

create or replace function public.mark_apple_auth_capture_exchange_started(
  p_operation_id uuid,
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (
    select 1 from auth.sessions as sessions
     where sessions.id = p_session_id and sessions.user_id = p_user_id
  ) then
    return false;
  end if;

  update public.apple_auth_capture_operations as operations
     set state = 'exchange_started', exchange_started_at = v_now, updated_at = v_now
   where operations.id = p_operation_id
     and operations.user_id = p_user_id
     and operations.session_id = p_session_id
     and operations.state = 'reserved'
     and operations.expires_at > v_now;
  return found;
end;
$$;

create or replace function public.complete_apple_auth_capture(
  p_operation_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_encrypted_refresh_token bytea,
  p_vault_key_version text
)
returns table (state text, generation bigint, next_validation_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.apple_auth_capture_operations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_generation bigint;
  v_next timestamptz;
begin
  if p_encrypted_refresh_token is null
     or octet_length(p_encrypted_refresh_token) not between 1 and 8192
     or p_vault_key_version !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'APPLE_AUTH_CAPTURE_VAULT_REJECTED' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (
    select 1 from auth.sessions as sessions
     where sessions.id = p_session_id and sessions.user_id = p_user_id
  ) or exists (
    select 1 from public.account_deletion_barriers as barriers
     where barriers.user_id = p_user_id
  ) then
    raise exception 'APPLE_AUTH_CAPTURE_SESSION_REJECTED' using errcode = '28000';
  end if;

  select * into v_operation
    from public.apple_auth_capture_operations as operations
   where operations.id = p_operation_id
     and operations.user_id = p_user_id
     and operations.session_id = p_session_id
   for update;
  if not found or v_operation.state <> 'exchange_started' then
    raise exception 'APPLE_AUTH_CAPTURE_STATE_REJECTED' using errcode = 'P0001';
  end if;

  select coalesce(lifecycles.generation, 0) + 1 into v_generation
    from (select 1) as seed
    left join public.apple_auth_lifecycles as lifecycles
      on lifecycles.user_id = p_user_id;
  v_next := public._apple_auth_next_validation_at(p_user_id, v_generation, v_now);

  insert into public.apple_auth_lifecycles (
    user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
    generation, encrypted_refresh_token, vault_key_version, last_validated_at,
    next_validation_at, validation_claim_digest, validation_lease_expires_at,
    validation_attempt_count, last_failure_code, created_at, updated_at
  ) values (
    p_user_id, v_operation.apple_subject_hmac, v_operation.subject_hmac_key_version,
    v_operation.client_id, 'active', v_generation, p_encrypted_refresh_token,
    p_vault_key_version, v_now, v_next, null, null, 0, null, v_now, v_now
  )
  on conflict (user_id) do update
    set apple_subject_hmac = excluded.apple_subject_hmac,
        subject_hmac_key_version = excluded.subject_hmac_key_version,
        client_id = excluded.client_id,
        state = 'active',
        generation = excluded.generation,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        vault_key_version = excluded.vault_key_version,
        last_validated_at = excluded.last_validated_at,
        next_validation_at = excluded.next_validation_at,
        validation_claim_digest = null,
        validation_lease_expires_at = null,
        validation_attempt_count = 0,
        last_failure_code = null,
        updated_at = excluded.updated_at;

  update public.apple_auth_capture_operations as operations
     set state = 'succeeded', completed_at = v_now, updated_at = v_now
   where operations.id = p_operation_id;
  return query select 'active'::text, v_generation, v_next;
end;
$$;

create or replace function public.fail_apple_auth_capture(
  p_operation_id uuid,
  p_user_id uuid,
  p_failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_failure_code !~ '^[A-Z0-9_]{1,64}$' then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  update public.apple_auth_capture_operations as operations
     set state = 'failed', failure_code = p_failure_code,
         completed_at = v_now, updated_at = v_now
   where operations.id = p_operation_id
     and operations.user_id = p_user_id
     and operations.state in ('reserved', 'exchange_started');
  return found;
end;
$$;

-- -----------------------------------------------------------------------------
-- Daily validation worker claims and terminal fencing
-- -----------------------------------------------------------------------------

create or replace function public.claim_due_apple_auth_validations(
  p_claim_token text,
  p_limit integer
)
returns table (
  user_id uuid,
  apple_subject_hmac text,
  subject_hmac_key_version text,
  client_id text,
  generation bigint,
  encrypted_refresh_token bytea,
  vault_key_version text,
  last_validated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_digest text;
begin
  if p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_limit not between 1 and 100 then
    raise exception 'APPLE_AUTH_VALIDATION_CLAIM_REJECTED' using errcode = '22023';
  end if;
  v_digest := public._apple_auth_claim_digest(p_claim_token);

  return query
  with due as (
    select lifecycles.user_id
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.state = 'active'
       and lifecycles.next_validation_at <= v_now
       and (
         lifecycles.validation_lease_expires_at is null
         or lifecycles.validation_lease_expires_at <= v_now
       )
     order by lifecycles.next_validation_at, lifecycles.user_id
     for update skip locked
     limit p_limit
  ), claimed as (
    update public.apple_auth_lifecycles as lifecycles
       set validation_claim_digest = v_digest,
           validation_lease_expires_at = v_now + interval '2 minutes',
           validation_attempt_count = lifecycles.validation_attempt_count + 1,
           updated_at = v_now
      from due
     where lifecycles.user_id = due.user_id
    returning lifecycles.*
  )
  select claimed.user_id, claimed.apple_subject_hmac,
         claimed.subject_hmac_key_version, claimed.client_id, claimed.generation,
         claimed.encrypted_refresh_token, claimed.vault_key_version,
         claimed.last_validated_at
    from claimed;
end;
$$;

-- Validation completion is also the online rotation boundary. The current
-- keyed subject alias and fresh authenticated-encryption envelope must commit
-- in the same claim/generation CAS as the next validation schedule.
create or replace function public.complete_apple_auth_validation(
  p_user_id uuid,
  p_generation bigint,
  p_claim_token text,
  p_apple_subject_hmac text,
  p_subject_hmac_key_version text,
  p_encrypted_refresh_token bytea,
  p_vault_key_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null
     or p_generation is null
     or p_generation < 1
     or p_claim_token is null
     or p_claim_token !~ '^[a-f0-9]{64}$'
     or p_apple_subject_hmac is null
     or p_apple_subject_hmac !~ '^[a-f0-9]{64}$'
     or p_subject_hmac_key_version is null
     or p_subject_hmac_key_version !~ '^[A-Za-z0-9._-]{1,64}$'
     or p_encrypted_refresh_token is null
     or pg_catalog.octet_length(p_encrypted_refresh_token) not between 1 and 8192
     or p_vault_key_version is null
     or p_vault_key_version !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'APPLE_AUTH_VALIDATION_COMPLETION_REJECTED' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  update public.apple_auth_lifecycles as lifecycles
     set apple_subject_hmac = p_apple_subject_hmac,
         subject_hmac_key_version = p_subject_hmac_key_version,
         encrypted_refresh_token = p_encrypted_refresh_token,
         vault_key_version = p_vault_key_version,
         last_validated_at = v_now,
         next_validation_at = public._apple_auth_next_validation_at(
           p_user_id, p_generation, v_now
         ),
         validation_claim_digest = null,
         validation_lease_expires_at = null,
         validation_attempt_count = 0,
         last_failure_code = null,
         updated_at = v_now
   where lifecycles.user_id = p_user_id
     and lifecycles.generation = p_generation
     and lifecycles.state = 'active'
     and lifecycles.validation_claim_digest = public._apple_auth_claim_digest(p_claim_token)
     and lifecycles.validation_lease_expires_at > v_now;
  return found;
end;
$$;

create or replace function public.defer_apple_auth_validation(
  p_user_id uuid,
  p_generation bigint,
  p_claim_token text,
  p_failure_code text,
  p_retry_after_seconds integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_last_validated_at timestamptz;
begin
  if p_failure_code !~ '^[A-Z0-9_]{1,64}$'
     or p_retry_after_seconds not between 86400 and 172800 then
    raise exception 'APPLE_AUTH_VALIDATION_DEFER_REJECTED' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  select lifecycles.last_validated_at into v_last_validated_at
    from public.apple_auth_lifecycles as lifecycles
   where lifecycles.user_id = p_user_id
     and lifecycles.generation = p_generation
     and lifecycles.state = 'active'
     and lifecycles.validation_claim_digest = public._apple_auth_claim_digest(p_claim_token)
     and lifecycles.validation_lease_expires_at > v_now
   for update;
  if not found then
    return 'stale';
  end if;

  if v_last_validated_at <= v_now - interval '72 hours' then
    update public.apple_auth_lifecycles as lifecycles
       set state = 'action_required', generation = lifecycles.generation + 1,
           encrypted_refresh_token = null, vault_key_version = null,
           next_validation_at = null, validation_claim_digest = null,
           validation_lease_expires_at = null,
           last_failure_code = 'APPLE_VALIDATION_STALE', updated_at = v_now
     where lifecycles.user_id = p_user_id;
    delete from auth.sessions as sessions where sessions.user_id = p_user_id;
    return 'blocked';
  end if;

  update public.apple_auth_lifecycles as lifecycles
     set next_validation_at = v_now + pg_catalog.make_interval(secs => p_retry_after_seconds),
         validation_claim_digest = null,
         validation_lease_expires_at = null,
         last_failure_code = p_failure_code,
         updated_at = v_now
   where lifecycles.user_id = p_user_id;
  return 'deferred';
end;
$$;

create or replace function public.invalidate_apple_auth_lifecycle(
  p_user_id uuid,
  p_generation bigint,
  p_claim_token text,
  p_failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_failure_code not in (
    'APPLE_INVALID_GRANT', 'APPLE_SUBJECT_MISMATCH', 'APPLE_TOKEN_RESPONSE_INVALID',
    'APPLE_VAULT_INVALID', 'APPLE_EVENT_CONSENT_REVOKED',
    'APPLE_EVENT_ACCOUNT_DELETED', 'APPLE_NATIVE_CREDENTIAL_INVALID',
    'APPLE_NATIVE_CREDENTIAL_TRANSFERRED'
  ) then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  update public.apple_auth_lifecycles as lifecycles
     set state = case
           when p_failure_code = 'APPLE_EVENT_ACCOUNT_DELETED' then 'account_deleted'
           when p_failure_code in (
             'APPLE_SUBJECT_MISMATCH', 'APPLE_TOKEN_RESPONSE_INVALID', 'APPLE_VAULT_INVALID',
             'APPLE_NATIVE_CREDENTIAL_TRANSFERRED'
           ) then 'action_required'
           else 'revoked'
         end,
         generation = lifecycles.generation + 1,
         encrypted_refresh_token = null,
         vault_key_version = null,
         next_validation_at = null,
         validation_claim_digest = null,
         validation_lease_expires_at = null,
         last_failure_code = p_failure_code,
         updated_at = v_now
   where lifecycles.user_id = p_user_id
     and lifecycles.generation = p_generation
     and lifecycles.state = 'active'
     and lifecycles.validation_claim_digest = public._apple_auth_claim_digest(p_claim_token)
     and lifecycles.validation_lease_expires_at > v_now;
  if not found then
    return false;
  end if;
  delete from auth.sessions as sessions where sessions.user_id = p_user_id;
  return true;
end;
$$;

create or replace function public.invalidate_apple_auth_for_session(
  p_user_id uuid,
  p_session_id uuid,
  p_apple_subject text,
  p_failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lifecycle_invalidated boolean := false;
begin
  if p_failure_code not in (
    'APPLE_NATIVE_CREDENTIAL_INVALID', 'APPLE_NATIVE_CREDENTIAL_TRANSFERRED'
  ) or not public._apple_auth_identity_matches(p_user_id, p_apple_subject) then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  if not exists (
    select 1 from auth.sessions as sessions
     where sessions.id = p_session_id and sessions.user_id = p_user_id
  ) then
    return false;
  end if;
  update public.apple_auth_lifecycles as lifecycles
     set state = case
           when p_failure_code = 'APPLE_NATIVE_CREDENTIAL_TRANSFERRED'
             then 'action_required'
           else 'revoked'
         end,
         generation = lifecycles.generation + 1,
         encrypted_refresh_token = null, vault_key_version = null,
         next_validation_at = null, validation_claim_digest = null,
         validation_lease_expires_at = null,
         last_failure_code = p_failure_code, updated_at = v_now
   where lifecycles.user_id = p_user_id;
  v_lifecycle_invalidated := found;
  delete from auth.sessions as sessions where sessions.user_id = p_user_id;
  return v_lifecycle_invalidated;
end;
$$;

-- -----------------------------------------------------------------------------
-- Signed Apple server-to-server event application
-- -----------------------------------------------------------------------------

-- A verified terminal Apple event is an authoritative account-level erasure
-- signal under RoutineKind's conservative Sign in with Apple policy. Queue the same
-- six-step durable deletion coordinator used by in-app deletion, in the same
-- transaction as the lifecycle transition. Apple has already terminated the
-- authorization, so that provider step is durably attested as complete while
-- every remaining provider and first-party erasure step stays unchanged.
create or replace function public._queue_account_deletion_from_apple_event(
  p_user_id uuid,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_id uuid;
  v_idempotency_key text;
  v_capability text;
begin
  if p_user_id is null
     or p_now is null
     or not pg_catalog.isfinite(p_now)
     or not exists (select 1 from auth.users as users where users.id = p_user_id) then
    raise exception 'APPLE_AUTH_EVENT_DELETION_REJECTED' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(p_user_id)
  );
  select operations.id
    into v_operation_id
    from public.account_deletion_operations as operations
   where operations.user_id = p_user_id
   for update;

  if v_operation_id is null then
    v_idempotency_key := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
    loop
      v_capability := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
      exit when v_capability <> v_idempotency_key;
    end loop;

    select legacy.operation_id
      into v_operation_id
      from public._begin_account_deletion_v0048_unbound(
        p_user_id,
        v_idempotency_key,
        v_capability,
        p_now + interval '29 days',
        null::bytea,
        null::bytea,
        null::bytea
      ) as legacy;
  end if;

  if v_operation_id is null then
    raise exception 'APPLE_AUTH_EVENT_DELETION_REJECTED' using errcode = 'P0001';
  end if;

  update public.account_deletion_steps as steps
     set status = 'succeeded',
         next_attempt_at = null,
         lease_kind = null,
         claim_digest = null,
         lease_expires_at = null,
         request_started_at = coalesce(steps.request_started_at, p_now),
         completed_at = p_now,
         result_code = 'APPLE_AUTHORIZATION_TERMINATED',
         encrypted_payload = null,
         updated_at = p_now
   where steps.operation_id = v_operation_id
     and steps.step_name = 'apple_revoke'
     and steps.status <> 'succeeded';

  perform public._refresh_account_deletion_operation(v_operation_id, p_now);
  return v_operation_id;
end;
$$;

revoke all on function public._queue_account_deletion_from_apple_event(uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.apply_apple_auth_server_event(
  p_jti_hmac text,
  p_payload_hmac text,
  p_apple_subject_hmacs text[],
  p_subject_hmac_key_versions text[],
  p_apple_subject text,
  p_client_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_relay_email_hmac text
)
returns table (result_code text, user_id uuid, state text, generation bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lifecycle public.apple_auth_lifecycles%rowtype;
  v_existing_event public.apple_auth_server_events%rowtype;
  v_event_subject_hmac text;
  v_event_subject_hmac_key_version text;
  v_identity_user_id uuid;
  v_locked_identity_user_id uuid;
  v_target_user_id uuid;
  v_identity_count bigint;
  v_created_terminal boolean := false;
  v_replay_promotable boolean := false;
  v_jti_lock bigint;
  v_payload_lock bigint;
  v_rank smallint := case p_event_type
    when 'email-enabled' then 1
    when 'email-disabled' then 2
    when 'consent-revoked' then 3
    when 'account-deleted' then 4
    else 0
  end;
  v_result text;
begin
  if p_jti_hmac is null
     or p_jti_hmac !~ '^[a-f0-9]{64}$'
     or p_payload_hmac is null
     or p_payload_hmac !~ '^[a-f0-9]{64}$'
     or p_apple_subject_hmacs is null
     or p_subject_hmac_key_versions is null
     or coalesce(pg_catalog.array_ndims(p_apple_subject_hmacs), 0) <> 1
     or coalesce(pg_catalog.array_ndims(p_subject_hmac_key_versions), 0) <> 1
     or coalesce(pg_catalog.array_length(p_apple_subject_hmacs, 1), 0)
       not between 1 and 3
     or pg_catalog.array_lower(p_apple_subject_hmacs, 1) <> 1
     or pg_catalog.array_lower(p_subject_hmac_key_versions, 1) <> 1
     or pg_catalog.array_length(p_subject_hmac_key_versions, 1)
       <> pg_catalog.array_length(p_apple_subject_hmacs, 1)
     or exists (
       select 1 from pg_catalog.unnest(p_apple_subject_hmacs) as candidate(value)
        where candidate.value is null or candidate.value !~ '^[a-f0-9]{64}$'
     )
     or exists (
       select 1 from pg_catalog.unnest(p_subject_hmac_key_versions) as candidate(value)
        where candidate.value is null
           or candidate.value !~ '^[A-Za-z0-9._-]{1,64}$'
     )
     or p_client_id is null
     or pg_catalog.length(p_client_id) not between 3 and 255
     or p_client_id <> pg_catalog.btrim(p_client_id)
     or p_client_id ~ '[[:cntrl:]]'
     or p_event_type is null
     or p_event_type not in (
       'email-enabled', 'email-disabled', 'consent-revoked', 'account-deleted', 'unknown'
     )
     or (
       p_event_type in ('consent-revoked', 'account-deleted')
       and (
         p_apple_subject is null
         or pg_catalog.length(p_apple_subject) not between 1 and 512
         or p_apple_subject <> pg_catalog.btrim(p_apple_subject)
         or p_apple_subject ~ '[[:cntrl:]]'
       )
     )
     or (
       p_event_type not in ('consent-revoked', 'account-deleted')
       and p_apple_subject is not null
     )
     or p_event_at is null
     or not pg_catalog.isfinite(p_event_at)
     or (p_relay_email_hmac is not null and p_relay_email_hmac !~ '^[a-f0-9]{64}$') then
    raise exception 'APPLE_AUTH_EVENT_REJECTED' using errcode = '22023';
  end if;

  -- Serialize both replay identities in deterministic order. Unique indexes
  -- remain the final invariant, while these locks make simultaneous Apple
  -- retries return the stable duplicate disposition instead of a transient
  -- uniqueness error that would provoke another provider retry.
  v_jti_lock := pg_catalog.hashtextextended(
    'routinekind-apple-event-jti:v1:' || p_jti_hmac,
    0
  );
  v_payload_lock := pg_catalog.hashtextextended(
    'routinekind-apple-event-payload:v1:' || p_payload_hmac,
    0
  );
  if v_jti_lock <= v_payload_lock then
    perform pg_catalog.pg_advisory_xact_lock(v_jti_lock);
    if v_jti_lock <> v_payload_lock then
      perform pg_catalog.pg_advisory_xact_lock(v_payload_lock);
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(v_payload_lock);
    perform pg_catalog.pg_advisory_xact_lock(v_jti_lock);
  end if;

  if (
    select count(*)
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.apple_subject_hmac = any(p_apple_subject_hmacs)
  ) > 1 then
    raise exception 'APPLE_AUTH_EVENT_SUBJECT_AMBIGUOUS' using errcode = 'P0001';
  end if;

  if (
    select count(*)
      from public.apple_auth_server_events as events
     where events.jti_hmac = p_jti_hmac
        or events.payload_hmac = p_payload_hmac
  ) > 1 then
    raise exception 'APPLE_AUTH_EVENT_REPLAY_AMBIGUOUS' using errcode = 'P0001';
  end if;
  select * into v_existing_event
    from public.apple_auth_server_events as events
   where events.jti_hmac = p_jti_hmac
      or events.payload_hmac = p_payload_hmac;
  v_replay_promotable := v_existing_event.id is not null
    and v_existing_event.jti_hmac = p_jti_hmac
    and v_existing_event.payload_hmac = p_payload_hmac
    and v_existing_event.result_code = 'unknown_subject'
    and v_existing_event.client_id = p_client_id
    and v_existing_event.event_type = p_event_type
    and v_existing_event.event_at = p_event_at
    and v_existing_event.relay_email_hmac is not distinct from p_relay_email_hmac
    and p_event_type in ('consent-revoked', 'account-deleted')
    and exists (
      select 1
        from pg_catalog.generate_subscripts(p_apple_subject_hmacs, 1) as candidate(index)
       where p_apple_subject_hmacs[candidate.index] = v_existing_event.apple_subject_hmac
         and p_subject_hmac_key_versions[candidate.index]
           = v_existing_event.subject_hmac_key_version
    );
  if v_existing_event.id is not null
     and not v_replay_promotable then
    select lifecycles.* into v_lifecycle
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = v_existing_event.user_id;
    return query select 'duplicate'::text, v_lifecycle.user_id,
      v_lifecycle.state, v_lifecycle.generation;
    return;
  end if;

  if p_event_type in ('consent-revoked', 'account-deleted') then
    select count(*) into v_identity_count
      from auth.identities as identities
     where identities.provider = 'apple'
       and identities.provider_id = p_apple_subject
       and identities.identity_data ->> 'sub' = p_apple_subject;
    if v_identity_count > 1 then
      raise exception 'APPLE_AUTH_EVENT_IDENTITY_AMBIGUOUS' using errcode = 'P0001';
    elsif v_identity_count = 1 then
      select identities.user_id into v_identity_user_id
        from auth.identities as identities
       where identities.provider = 'apple'
         and identities.provider_id = p_apple_subject
         and identities.identity_data ->> 'sub' = p_apple_subject;
    end if;
  end if;

  select * into v_lifecycle
    from public.apple_auth_lifecycles as lifecycles
   where lifecycles.apple_subject_hmac = any(p_apple_subject_hmacs)
     and lifecycles.client_id = p_client_id;
  if found
     and v_identity_user_id is not null
     and v_identity_user_id <> v_lifecycle.user_id then
    raise exception 'APPLE_AUTH_EVENT_SUBJECT_AMBIGUOUS' using errcode = 'P0001';
  end if;
  if not found then
    if exists (
      select 1 from public.apple_auth_lifecycles as lifecycles
       where lifecycles.apple_subject_hmac = any(p_apple_subject_hmacs)
    ) then
      raise exception 'APPLE_AUTH_EVENT_CLIENT_MISMATCH' using errcode = '22023';
    end if;

    -- Apple verifies the raw subject before this service-only RPC is reached.
    -- It is used transiently only to bridge a terminal event that wins the
    -- race with first vault capture (or an existing pre-rollout Apple user).
    -- No raw subject is inserted into public lifecycle or event storage.
    if v_identity_user_id is null then
      if v_existing_event.id is not null then
        return query select 'duplicate'::text, null::uuid, null::text, null::bigint;
        return;
      end if;
      v_event_subject_hmac := p_apple_subject_hmacs[1];
      v_event_subject_hmac_key_version := p_subject_hmac_key_versions[1];
      v_result := case p_event_type when 'unknown' then 'ignored_unknown'
        else 'unknown_subject' end;
      insert into public.apple_auth_server_events (
        jti_hmac, payload_hmac, apple_subject_hmac, subject_hmac_key_version,
        client_id, event_type, event_at, relay_email_hmac, result_code, received_at
      ) values (
        p_jti_hmac, p_payload_hmac, v_event_subject_hmac,
        v_event_subject_hmac_key_version, p_client_id, p_event_type,
        p_event_at, p_relay_email_hmac, v_result, v_now
      );
      return query select v_result, null::uuid, null::text, null::bigint;
      return;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      public._account_deletion_advisory_key(v_identity_user_id)
    );
    select identities.user_id into v_locked_identity_user_id
      from auth.identities as identities
     where identities.provider = 'apple'
       and identities.provider_id = p_apple_subject
       and identities.identity_data ->> 'sub' = p_apple_subject
     for key share;
    if not found or v_locked_identity_user_id <> v_identity_user_id then
      if v_existing_event.id is not null then
        return query select 'duplicate'::text, null::uuid, null::text, null::bigint;
        return;
      end if;
      v_event_subject_hmac := p_apple_subject_hmacs[1];
      v_event_subject_hmac_key_version := p_subject_hmac_key_versions[1];
      v_result := case p_event_type when 'unknown' then 'ignored_unknown'
        else 'unknown_subject' end;
      insert into public.apple_auth_server_events (
        jti_hmac, payload_hmac, apple_subject_hmac, subject_hmac_key_version,
        client_id, event_type, event_at, relay_email_hmac, result_code, received_at
      ) values (
        p_jti_hmac, p_payload_hmac, v_event_subject_hmac,
        v_event_subject_hmac_key_version, p_client_id, p_event_type,
        p_event_at, p_relay_email_hmac, v_result, v_now
      );
      return query select v_result, null::uuid, null::text, null::bigint;
      return;
    end if;
    select * into v_lifecycle
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = v_identity_user_id
     for update;
    if found and v_lifecycle.client_id <> p_client_id then
      raise exception 'APPLE_AUTH_EVENT_CLIENT_MISMATCH' using errcode = '22023';
    elsif not found then
      if exists (
        select 1 from public.apple_auth_lifecycles as lifecycles
         where lifecycles.apple_subject_hmac = any(p_apple_subject_hmacs)
           and lifecycles.user_id <> v_identity_user_id
      ) then
        raise exception 'APPLE_AUTH_EVENT_SUBJECT_AMBIGUOUS' using errcode = 'P0001';
      end if;
      insert into public.apple_auth_lifecycles (
        user_id, apple_subject_hmac, subject_hmac_key_version, client_id, state,
        generation, encrypted_refresh_token, vault_key_version, last_validated_at,
        next_validation_at, last_event_at, last_event_rank, last_failure_code,
        created_at, updated_at
      ) values (
        v_identity_user_id, p_apple_subject_hmacs[1], p_subject_hmac_key_versions[1],
        p_client_id,
        case p_event_type when 'account-deleted' then 'account_deleted' else 'revoked' end,
        1, null, null, null, null, p_event_at, v_rank,
        case p_event_type
          when 'account-deleted' then 'APPLE_EVENT_ACCOUNT_DELETED'
          else 'APPLE_EVENT_CONSENT_REVOKED'
        end,
        v_now, v_now
      )
      returning * into v_lifecycle;
      v_created_terminal := true;
    end if;
  end if;

  v_event_subject_hmac := v_lifecycle.apple_subject_hmac;
  v_event_subject_hmac_key_version := v_lifecycle.subject_hmac_key_version;

  if not v_created_terminal then
    v_target_user_id := v_lifecycle.user_id;
    perform pg_catalog.pg_advisory_xact_lock(
      public._account_deletion_advisory_key(v_target_user_id)
    );
    if p_event_type in ('consent-revoked', 'account-deleted') then
      v_locked_identity_user_id := null;
      select identities.user_id into v_locked_identity_user_id
        from auth.identities as identities
       where identities.provider = 'apple'
         and identities.provider_id = p_apple_subject
         and identities.identity_data ->> 'sub' = p_apple_subject
       for key share;
      if found and v_locked_identity_user_id <> v_target_user_id then
        raise exception 'APPLE_AUTH_EVENT_SUBJECT_AMBIGUOUS' using errcode = 'P0001';
      end if;
    end if;
    -- Every other lifecycle mutation acquires the owner advisory lock before
    -- locking this row. Re-read in that same order to avoid a capture/event
    -- deadlock and to detect an account that was erased while this event waited.
    select * into v_lifecycle
      from public.apple_auth_lifecycles as lifecycles
     where lifecycles.user_id = v_target_user_id
       and lifecycles.client_id = p_client_id
     for update;
    if not found then
      if v_existing_event.id is not null then
        return query select 'duplicate'::text, null::uuid, null::text, null::bigint;
        return;
      end if;
      v_event_subject_hmac := p_apple_subject_hmacs[1];
      v_event_subject_hmac_key_version := p_subject_hmac_key_versions[1];
      v_result := case p_event_type when 'unknown' then 'ignored_unknown'
        else 'unknown_subject' end;
      insert into public.apple_auth_server_events (
        jti_hmac, payload_hmac, apple_subject_hmac, subject_hmac_key_version,
        client_id, event_type, event_at, relay_email_hmac, result_code, received_at
      ) values (
        p_jti_hmac, p_payload_hmac, v_event_subject_hmac,
        v_event_subject_hmac_key_version, p_client_id, p_event_type,
        p_event_at, p_relay_email_hmac, v_result, v_now
      );
      return query select v_result, null::uuid, null::text, null::bigint;
      return;
    end if;
    v_event_subject_hmac := v_lifecycle.apple_subject_hmac;
    v_event_subject_hmac_key_version := v_lifecycle.subject_hmac_key_version;
  end if;

  if v_created_terminal then
    v_result := 'applied';
  elsif p_event_type = 'account-deleted' then
    update public.apple_auth_lifecycles as lifecycles
       set state = 'account_deleted', generation = lifecycles.generation + 1,
           encrypted_refresh_token = null, vault_key_version = null,
           next_validation_at = null, validation_claim_digest = null,
           validation_lease_expires_at = null,
           last_event_at = greatest(coalesce(lifecycles.last_event_at, p_event_at), p_event_at),
           last_event_rank = greatest(lifecycles.last_event_rank, v_rank),
           last_failure_code = 'APPLE_EVENT_ACCOUNT_DELETED', updated_at = v_now
     where lifecycles.user_id = v_lifecycle.user_id
       and lifecycles.state <> 'account_deleted';
    v_result := case when found then 'applied' else 'stale' end;
  elsif p_event_type = 'consent-revoked' then
    update public.apple_auth_lifecycles as lifecycles
       set state = 'revoked', generation = lifecycles.generation + 1,
           encrypted_refresh_token = null, vault_key_version = null,
           next_validation_at = null, validation_claim_digest = null,
           validation_lease_expires_at = null,
           last_event_at = greatest(coalesce(lifecycles.last_event_at, p_event_at), p_event_at),
           last_event_rank = greatest(lifecycles.last_event_rank, v_rank),
           last_failure_code = 'APPLE_EVENT_CONSENT_REVOKED', updated_at = v_now
     where lifecycles.user_id = v_lifecycle.user_id
       and lifecycles.state not in ('revoked', 'account_deleted');
    v_result := case when found then 'applied' else 'stale' end;
  elsif p_event_type in ('email-enabled', 'email-disabled') then
    update public.apple_auth_lifecycles as lifecycles
       set relay_email_state = case p_event_type
             when 'email-enabled' then 'enabled' else 'disabled' end,
           relay_email_hmac = p_relay_email_hmac,
           last_event_at = p_event_at,
           last_event_rank = v_rank,
           updated_at = v_now
     where lifecycles.user_id = v_lifecycle.user_id
       and lifecycles.state = 'active'
       and (
         lifecycles.last_event_at is null
         or p_event_at > lifecycles.last_event_at
         or (p_event_at = lifecycles.last_event_at and v_rank > lifecycles.last_event_rank)
       );
    v_result := case when found then 'applied' else 'stale' end;
  else
    v_result := 'ignored_unknown';
  end if;

  if v_existing_event.id is null then
    insert into public.apple_auth_server_events (
      jti_hmac, payload_hmac, apple_subject_hmac, subject_hmac_key_version,
      client_id, user_id, event_type,
      event_at, relay_email_hmac, result_code, received_at
    ) values (
      p_jti_hmac, p_payload_hmac, v_event_subject_hmac,
      v_event_subject_hmac_key_version,
      p_client_id, v_lifecycle.user_id, p_event_type, p_event_at,
      p_relay_email_hmac, v_result, v_now
    );
  else
    update public.apple_auth_server_events as events
       set apple_subject_hmac = v_event_subject_hmac,
           subject_hmac_key_version = v_event_subject_hmac_key_version,
           user_id = v_lifecycle.user_id,
           result_code = v_result
     where events.id = v_existing_event.id;
  end if;

  if p_event_type in ('consent-revoked', 'account-deleted')
     and v_result in ('applied', 'stale') then
    perform public._queue_account_deletion_from_apple_event(v_lifecycle.user_id, v_now);
    delete from auth.sessions as sessions where sessions.user_id = v_lifecycle.user_id;
  end if;
  select * into v_lifecycle
    from public.apple_auth_lifecycles as lifecycles
   where lifecycles.user_id = v_lifecycle.user_id;
  return query select v_result, v_lifecycle.user_id, v_lifecycle.state, v_lifecycle.generation;
end;
$$;

create or replace function public.purge_expired_apple_auth_artifacts(p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_limit not between 1 and 10000 then
    raise exception 'APPLE_AUTH_PURGE_LIMIT_REJECTED' using errcode = '22023';
  end if;
  with expired as (
    select operations.id
      from public.apple_auth_capture_operations as operations
     where (
       operations.state in ('reserved', 'exchange_started')
       and operations.expires_at <= clock_timestamp()
     ) or (
       operations.state in ('succeeded', 'failed', 'expired')
       and operations.completed_at <= clock_timestamp() - interval '24 hours'
     )
     order by operations.expires_at, operations.id
     for update skip locked
     limit p_limit
  ), removed as (
    delete from public.apple_auth_capture_operations as operations
     using expired
     where operations.id = expired.id
    returning 1
  )
  select count(*) into v_count from removed;
  return v_count;
end;
$$;

-- Every mutation/read authority is RPC-only. The tables remain inaccessible
-- even to service_role so a generic service client cannot dump token envelopes
-- or provider-event mappings.
revoke all on function public.begin_apple_auth_capture(
  uuid, uuid, uuid, text, text[], text[], text, text
) from public, anon, authenticated;
revoke all on function public.mark_apple_auth_capture_exchange_started(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_apple_auth_capture(uuid, uuid, uuid, bytea, text)
  from public, anon, authenticated;
revoke all on function public.fail_apple_auth_capture(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_due_apple_auth_validations(text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_apple_auth_validation(
  uuid, bigint, text, text, text, bytea, text
)
  from public, anon, authenticated;
revoke all on function public.defer_apple_auth_validation(uuid, bigint, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.invalidate_apple_auth_lifecycle(uuid, bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.invalidate_apple_auth_for_session(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.get_apple_auth_deletion_vault(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.begin_account_deletion(
  uuid, uuid, text, text, timestamptz, bytea, bytea, bytea
) from public, anon, authenticated, service_role;
revoke all on function public.apply_apple_auth_server_event(
  text, text, text[], text[], text, text, text, timestamptz, text
)
  from public, anon, authenticated;
revoke all on function public.purge_expired_apple_auth_artifacts(integer)
  from public, anon, authenticated;

grant execute on function public.begin_apple_auth_capture(
  uuid, uuid, uuid, text, text[], text[], text, text
) to service_role;
grant execute on function public.mark_apple_auth_capture_exchange_started(uuid, uuid, uuid)
  to service_role;
grant execute on function public.complete_apple_auth_capture(uuid, uuid, uuid, bytea, text)
  to service_role;
grant execute on function public.fail_apple_auth_capture(uuid, uuid, text)
  to service_role;
grant execute on function public.claim_due_apple_auth_validations(text, integer)
  to service_role;
grant execute on function public.complete_apple_auth_validation(
  uuid, bigint, text, text, text, bytea, text
)
  to service_role;
grant execute on function public.defer_apple_auth_validation(uuid, bigint, text, text, integer)
  to service_role;
grant execute on function public.invalidate_apple_auth_lifecycle(uuid, bigint, text, text)
  to service_role;
grant execute on function public.invalidate_apple_auth_for_session(uuid, uuid, text, text)
  to service_role;
grant execute on function public.get_apple_auth_deletion_vault(uuid, uuid)
  to service_role;
grant execute on function public.begin_account_deletion(
  uuid, uuid, text, text, timestamptz, bytea, bytea, bytea
) to service_role;
grant execute on function public.apply_apple_auth_server_event(
  text, text, text[], text[], text, text, text, timestamptz, text
)
  to service_role;
grant execute on function public.purge_expired_apple_auth_artifacts(integer)
  to service_role;

comment on table public.apple_auth_lifecycles is
  'Sealed Sign in with Apple access authority. Stores only keyed subject/email aliases and an authenticated-encryption envelope; direct table access is denied to every API role.';
comment on table public.apple_auth_capture_operations is
  'Finite one-use authorization-code dispatch ledger. Stores a keyed code digest, never an authorization code, identity token, nonce, provider token, or response body.';
comment on table public.apple_auth_server_events is
  'Replay-deduplicated metadata for verified Apple server notifications. Provider subjects, jti, and relay email are stored only as keyed digests.';
comment on function public.account_access_allowed() is
  'Fail-closed authenticated RLS predicate. Apple-backed accounts require an active, recently validated server token vault; non-Apple accounts remain unaffected.';

commit;
