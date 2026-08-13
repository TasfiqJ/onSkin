-- Resumable, idempotent account deletion (OPT-014).
--
-- The durable row is intentionally not foreign-keyed to auth.users: it must
-- survive the final auth deletion as a content-free completion/support receipt.
-- Only service_role may inspect or mutate the ledger directly. One 256-bit
-- capability RPC exposes only terminal, content-free completion metadata.

create table public.account_deletion_requests (
  request_id             uuid primary key default gen_random_uuid(),
  user_id                uuid,
  initiating_session_id  uuid,
  completion_token_hash  text not null unique
    check (completion_token_hash ~ '^t_[0-9a-f]{64}$'),
  user_hash              text not null unique
    check (user_hash ~ '^u_[0-9a-f]{32}$'),
  user_lookup_hash       text not null unique
    check (user_lookup_hash ~ '^d_[0-9a-f]{32}$'),
  next_step              text not null default 'revenuecat'
    check (next_step in (
      'revenuecat', 'posthog', 'storage', 'database', 'sessions', 'apple',
      'apple_in_progress', 'providers_final', 'auth', 'complete'
    )),
  apple_required         boolean not null default false,
  revenuecat_result      text check (revenuecat_result is null or revenuecat_result in ('deleted', 'already_absent')),
  apple_result           text check (apple_result is null or apple_result in ('revoked', 'skipped')),
  posthog_result         text check (posthog_result is null or posthog_result in ('deleted', 'already_absent', 'skipped')),
  sessions_result        text check (sessions_result is null or sessions_result = 'revoked'),
  providers_final_result text check (providers_final_result is null or providers_final_result = 'reconciled'),
  attempt_count          integer not null default 0 check (attempt_count >= 0),
  lease_token            uuid,
  lease_expires_at       timestamptz,
  last_error_code        text check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{1,64}$'),
  requested_at           timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  revenuecat_completed_at timestamptz,
  posthog_completed_at   timestamptz,
  storage_completed_at   timestamptz,
  database_completed_at  timestamptz,
  sessions_completed_at  timestamptz,
  apple_attempt_started_at timestamptz,
  apple_completed_at     timestamptz,
  providers_final_completed_at timestamptz,
  auth_completed_at      timestamptz,
  completed_at           timestamptz,
  constraint account_deletion_lease_shape check (
    (lease_token is null) = (lease_expires_at is null)
  ),
  constraint account_deletion_receipt_shape check (
    (
      next_step = 'complete'
      and user_id is null
      and initiating_session_id is null
      and completed_at is not null
    )
    or (
      next_step <> 'complete'
      and user_id is not null
      and initiating_session_id is not null
      and completed_at is null
    )
  )
);

create unique index account_deletion_requests_active_user_idx
  on public.account_deletion_requests (user_id)
  where user_id is not null;
create index account_deletion_requests_support_status_idx
  on public.account_deletion_requests (next_step, updated_at desc);

alter table public.account_deletion_requests enable row level security;
-- No client policy by design. This is a service-role-only support ledger.

create table public.account_deletion_click_tombstones (
  click_token_hash text primary key
    check (click_token_hash ~ '^c_[0-9a-f]{32}$'),
  request_id uuid not null references public.account_deletion_requests (request_id)
    on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.account_deletion_click_tombstones enable row level security;
-- Opaque click-token hashes are retained only to prevent a late order poll from
-- relinking a deleted account. No raw click token or user id is retained.

-- Serialize a deletion request with every direct owner write. A transaction
-- that began a write first completes before the deletion freeze is recorded;
-- a write that begins later waits, observes the request, and fails closed.
create or replace function public.account_deletion_erasure_context_allows(
  p_user_id uuid default null
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.account_deletion_requests as deletion
    where deletion.request_id::text = pg_catalog.current_setting(
            'app.account_deletion_request_id',
            true
          )
      and deletion.lease_token::text = pg_catalog.current_setting(
            'app.account_deletion_lease_token',
            true
          )
      and deletion.next_step = 'database'
      and (p_user_id is null or deletion.user_id = p_user_id)
  );
$$;
revoke all on function public.account_deletion_erasure_context_allows(uuid)
  from public, anon, authenticated;

create or replace function public.reject_owned_write_during_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_text text;
  v_user_id uuid;
begin
  -- UPDATE must freeze both owners. Looking only at NEW would let a concurrent
  -- mutation move a row away from the deleting owner after the erase scan.
  foreach v_owner_text in array array[
    case when tg_op <> 'INSERT' then pg_catalog.to_jsonb(old) ->> tg_argv[0] end,
    case when tg_op <> 'DELETE' then pg_catalog.to_jsonb(new) ->> tg_argv[0] end
  ]
  loop
    if v_owner_text is null or v_owner_text = '' then
      continue;
    end if;
    begin
      v_user_id := v_owner_text::uuid;
    exception when invalid_text_representation then
      continue;
    end;

    if public.account_deletion_erasure_context_allows(v_user_id) then
      continue;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
    );
    if exists (
      select 1
      from public.account_deletion_requests as deletion
      where deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)
    ) then
      raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.reject_owned_write_during_account_deletion()
  from public, anon, authenticated;

-- Apply the freeze to every current table carrying a direct account owner.
-- Child rows are removed through their frozen parent roots in the transactional
-- erase RPC below. Future direct-owner tables must be added to this list.
do $$
declare
  v_target text;
  v_parts text[];
  v_trigger_name text;
begin
  foreach v_target in array array[
    'profiles:id',
    'skin_profiles:user_id',
    'user_products:user_id',
    'routines:user_id',
    'routine_completions:user_id',
    'photos:user_id',
    'consents:user_id',
    'notification_preferences:user_id',
    'routine_conflicts:user_id',
    'active_ramp:user_id',
    'shelf_scans:user_id',
    'cycles:user_id',
    'streak_freezes:user_id',
    'notification_log:user_id',
    'recommendation_preferences:user_id',
    'recommendations:user_id',
    'commerce_click_events:user_id',
    'community_blocks:user_id',
    'community_questions:user_id',
    'community_reactions:user_id',
    'community_reports:reporter_id',
    'photo_trend:user_id',
    'ask_sessions:user_id',
    'ask_safety_audit:user_id',
    'catalog_corrections:user_id',
    'obf_contribution_queue:user_id',
    'catalog_lookup_events:user_id',
    'reverse_trial_grants:user_id'
  ]
  loop
    v_parts := pg_catalog.string_to_array(v_target, ':');
    v_trigger_name := 'trg_' || v_parts[1] || '_account_deletion_freeze';
    execute pg_catalog.format(
      'drop trigger if exists %I on public.%I',
      v_trigger_name,
      v_parts[1]
    );
    execute pg_catalog.format(
      'create trigger %I before insert or update or delete on public.%I '
      || 'for each row execute function public.reject_owned_write_during_account_deletion(%L)',
      v_trigger_name,
      v_parts[1],
      v_parts[2]
    );
  end loop;
end;
$$;

-- Parent-owned rows have no direct auth user column. Freeze their INSERT,
-- UPDATE, and DELETE paths through the same advisory lock as their parent.
create or replace function public.reject_parent_owned_write_during_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_text text;
  v_parent_id uuid;
  v_user_id uuid;
begin
  if public.account_deletion_erasure_context_allows(null) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  foreach v_parent_text in array array[
    case when tg_op <> 'INSERT' then pg_catalog.to_jsonb(old) ->> tg_argv[0] end,
    case when tg_op <> 'DELETE' then pg_catalog.to_jsonb(new) ->> tg_argv[0] end
  ]
  loop
    if v_parent_text is null or v_parent_text = '' then
      continue;
    end if;
    begin
      v_parent_id := v_parent_text::uuid;
    exception when invalid_text_representation then
      continue;
    end;

    execute pg_catalog.format(
      'select %I from public.%I where %I = $1',
      tg_argv[3],
      tg_argv[1],
      tg_argv[2]
    )
    into v_user_id
    using v_parent_id;
    if v_user_id is null then
      continue;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
    );
    if exists (
      select 1
      from public.account_deletion_requests as deletion
      where deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)
    ) then
      raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.reject_parent_owned_write_during_account_deletion()
  from public, anon, authenticated;

do $$
declare
  v_target text;
  v_parts text[];
  v_trigger_name text;
begin
  foreach v_target in array array[
    'routine_steps:routine_id:routines:id:user_id',
    'cycle_nights:cycle_id:cycles:id:user_id',
    'ask_turn_audit:session_id:ask_sessions:id:user_id',
    'obf_contribution_queue:correction_id:catalog_corrections:id:user_id'
  ]
  loop
    v_parts := pg_catalog.string_to_array(v_target, ':');
    v_trigger_name := 'trg_' || v_parts[1] || '_account_deletion_parent_freeze';
    execute pg_catalog.format(
      'drop trigger if exists %I on public.%I',
      v_trigger_name,
      v_parts[1]
    );
    execute pg_catalog.format(
      'create trigger %I before insert or update or delete on public.%I '
      || 'for each row execute function '
      || 'public.reject_parent_owned_write_during_account_deletion(%L, %L, %L, %L)',
      v_trigger_name,
      v_parts[1],
      v_parts[2],
      v_parts[3],
      v_parts[4],
      v_parts[5]
    );
  end loop;
end;
$$;

-- RLS companion for user-token photo uploads. The advisory lock closes the
-- in-flight-upload race with account_deletion_claim while revealing only the
-- caller's own deletion state. The retained lookup tombstone also rejects a
-- still-valid access JWT after auth.users has been deleted and user_id nulled.
create or replace function public.account_deletion_write_allowed()
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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
  );
  return not exists (
    select 1
    from public.account_deletion_requests as deletion
    where deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)
  );
end;
$$;
revoke all on function public.account_deletion_write_allowed() from public, anon;
grant execute on function public.account_deletion_write_allowed() to authenticated;

create policy "photos_account_deletion_freeze_insert" on public.photos
  as restrictive for insert to authenticated
  with check (public.account_deletion_write_allowed());
create policy "photos_account_deletion_freeze_update" on public.photos
  as restrictive for update to authenticated
  using (public.account_deletion_write_allowed())
  with check (public.account_deletion_write_allowed());
create policy "photos_account_deletion_freeze_delete" on public.photos
  as restrictive for delete to authenticated
  using (public.account_deletion_write_allowed());
create policy "photos_objects_account_deletion_freeze_insert" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'photos' or public.account_deletion_write_allowed());
create policy "photos_objects_account_deletion_freeze_update" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'photos' or public.account_deletion_write_allowed())
  with check (bucket_id <> 'photos' or public.account_deletion_write_allowed());
create policy "photos_objects_account_deletion_freeze_delete" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'photos' or public.account_deletion_write_allowed());

create or replace function public.account_deletion_lookup_hash(p_user_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'd_' || pg_catalog.md5('account-deletion:user:' || p_user_id::text);
$$;
revoke all on function public.account_deletion_lookup_hash(uuid)
  from public, anon, authenticated;

-- Supabase Auth does not expose a supported "before identity link" hook. These
-- database guards are therefore the strongest local fail-closed boundary: once
-- a deletion receipt exists, user metadata and identities are immutable and no
-- session except the initiating one can be created/refreshed. The final auth.users
-- DELETE sets a transaction-local context so only its cascading identity DELETE
-- is admitted. Session/token DELETEs remain allowed because they only revoke
-- access and are required by global/other-session sign-out.
create or replace function public.reject_auth_write_during_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_text text;
  v_user_id uuid;
  v_allow_final_delete boolean := coalesce(tg_argv[1], 'false') = 'true';
begin
  foreach v_owner_text in array array[
    case when tg_op <> 'INSERT' then pg_catalog.to_jsonb(old) ->> tg_argv[0] end,
    case when tg_op <> 'DELETE' then pg_catalog.to_jsonb(new) ->> tg_argv[0] end
  ]
  loop
    if v_owner_text is null or v_owner_text = '' then
      continue;
    end if;
    begin
      v_user_id := v_owner_text::uuid;
    exception when invalid_text_representation then
      continue;
    end;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
    );
    if exists (
      select 1
      from public.account_deletion_requests as deletion
      where deletion.user_id = v_user_id
    ) then
      if v_allow_final_delete
        and tg_op = 'DELETE'
        and pg_catalog.current_setting(
              'app.account_deletion_auth_delete_user_id',
              true
            ) = v_user_id::text
        and exists (
          select 1
          from public.account_deletion_requests as deletion
          where deletion.user_id = v_user_id
            and deletion.next_step = 'auth'
            and deletion.lease_token is not null
            and deletion.lease_expires_at > clock_timestamp()
        )
      then
        continue;
      end if;
      raise exception 'ACCOUNT_DELETION_AUTH_FROZEN' using errcode = '55000';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.reject_auth_write_during_account_deletion()
  from public, anon, authenticated;

-- Preserve only the initiating auth session so a retry remains possible after
-- access-token expiry. A provider re-login creates a different session id and
-- is rejected; DELETE remains available to revoke every other session.
create or replace function public.reject_auth_session_write_during_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_owner_text text;
  v_user_id uuid;
  v_initiating_session_id uuid;
  v_is_same_session_update boolean :=
    tg_op = 'UPDATE'
    and v_old ->> 'id' = v_new ->> 'id'
    and v_old ->> 'user_id' = v_new ->> 'user_id';
begin
  foreach v_owner_text in array array[v_old ->> 'user_id', v_new ->> 'user_id']
  loop
    if v_owner_text is null or v_owner_text = '' then
      continue;
    end if;
    begin
      v_user_id := v_owner_text::uuid;
    exception when invalid_text_representation then
      continue;
    end;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
    );
    v_initiating_session_id := null;
    select deletion.initiating_session_id
    into v_initiating_session_id
    from public.account_deletion_requests as deletion
    where deletion.user_id = v_user_id;
    if found then
      if v_is_same_session_update
        and v_new ->> 'id' = v_initiating_session_id::text
      then
        continue;
      end if;
      raise exception 'ACCOUNT_DELETION_AUTH_FROZEN' using errcode = '55000';
    end if;
  end loop;

  return new;
end;
$$;
revoke all on function public.reject_auth_session_write_during_account_deletion()
  from public, anon, authenticated;

-- GoTrue can rotate or revoke refresh tokens through INSERT and UPDATE. Permit
-- rotation only for the durable initiating session. For other sessions, keep
-- only a security-reducing revocation UPDATE available to signOut(...,'others').
-- JSON comparison avoids depending on a particular hosted-Supabase column set.
create or replace function public.reject_auth_refresh_token_write_during_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_owner_text text;
  v_user_id uuid;
  v_initiating_session_id uuid;
  v_is_revocation_only boolean :=
    tg_op = 'UPDATE'
    and coalesce((v_new ->> 'revoked')::boolean, false)
    and (v_new - 'revoked' - 'updated_at') = (v_old - 'revoked' - 'updated_at');
begin
  foreach v_owner_text in array array[v_old ->> 'user_id', v_new ->> 'user_id']
  loop
    if v_owner_text is null or v_owner_text = '' then
      continue;
    end if;
    begin
      v_user_id := v_owner_text::uuid;
    exception when invalid_text_representation then
      continue;
    end;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
    );
    v_initiating_session_id := null;
    select deletion.initiating_session_id
    into v_initiating_session_id
    from public.account_deletion_requests as deletion
    where deletion.user_id = v_user_id;
    if found then
      if (
        tg_op = 'INSERT'
        and v_new ->> 'session_id' = v_initiating_session_id::text
      ) or (
        tg_op = 'UPDATE'
        and v_old ->> 'session_id' = v_initiating_session_id::text
        and v_new ->> 'session_id' = v_initiating_session_id::text
        and v_old ->> 'user_id' = v_new ->> 'user_id'
      ) or v_is_revocation_only
      then
        continue;
      end if;
      raise exception 'ACCOUNT_DELETION_AUTH_FROZEN' using errcode = '55000';
    end if;
  end loop;

  return new;
end;
$$;
revoke all on function public.reject_auth_refresh_token_write_during_account_deletion()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_update_account_deletion_freeze on auth.users;
create trigger on_auth_user_update_account_deletion_freeze
  before update on auth.users
  for each row execute function public.reject_auth_write_during_account_deletion('id', 'false');

drop trigger if exists on_auth_identity_account_deletion_freeze on auth.identities;
create trigger on_auth_identity_account_deletion_freeze
  before insert or update or delete on auth.identities
  for each row execute function public.reject_auth_write_during_account_deletion('user_id', 'true');

drop trigger if exists on_auth_session_account_deletion_freeze on auth.sessions;
create trigger on_auth_session_account_deletion_freeze
  before insert or update on auth.sessions
  for each row execute function public.reject_auth_session_write_during_account_deletion();

drop trigger if exists on_auth_refresh_token_account_deletion_freeze on auth.refresh_tokens;
create trigger on_auth_refresh_token_account_deletion_freeze
  before insert or update on auth.refresh_tokens
  for each row execute function public.reject_auth_refresh_token_write_during_account_deletion();

-- RevenueCat events can arrive before the deletion request, between its
-- checkpoints, or after auth deletion. Acquire the same per-user lock as the
-- deletion claim. Once tombstoned, retain only content-minimized provider audit
-- metadata and never restore an account identifier or raw payload.
alter table public.subscriptions_events
  add column if not exists account_deletion_suppressed boolean not null default false;

create or replace function public.suppress_deleted_revenuecat_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidates text[];
  v_candidate text;
  v_user_id uuid;
  v_payload_text text := coalesce(new.payload::text, '');
  v_suppressed boolean := coalesce(new.account_deletion_suppressed, false);
begin
  -- Some retained provider payloads can carry an identity outside the indexed
  -- candidate columns. Serialize every event with account_deletion_claim so an
  -- event committed immediately before a claim is included in the erase scan,
  -- while every event after the claim observes the durable tombstone.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:revenuecat-events', 0)
  );

  if tg_op = 'UPDATE' and old.account_deletion_suppressed then
    v_suppressed := true;
  end if;

  v_candidates := array[
    new.user_id::text,
    new.resolved_user_id::text,
    new.app_user_id,
    new.original_app_user_id
  ]
    || coalesce(new.aliases, array[]::text[])
    || coalesce(new.transferred_from, array[]::text[])
    || coalesce(new.transferred_to, array[]::text[]);

  foreach v_candidate in array v_candidates
  loop
    if v_candidate is null or v_candidate = '' then
      continue;
    end if;
    v_user_id := null;
    begin
      v_user_id := v_candidate::uuid;
    exception when invalid_text_representation then
      v_user_id := null;
    end;

    if v_user_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
      );
    end if;

    if exists (
      select 1
      from public.account_deletion_requests as deletion
      where (v_user_id is not null and (
              deletion.user_id = v_user_id
              or deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)
            ))
         or deletion.user_hash = v_candidate
    ) then
      v_suppressed := true;
      exit;
    end if;
  end loop;

  if not v_suppressed then
    select deletion.user_id
    into v_user_id
    from public.account_deletion_requests as deletion
    where (deletion.user_id is not null and pg_catalog.strpos(v_payload_text, deletion.user_id::text) > 0)
       or pg_catalog.strpos(v_payload_text, deletion.user_hash) > 0
       or pg_catalog.strpos(v_payload_text, deletion.user_lookup_hash) > 0
    order by deletion.requested_at
    limit 1;
    if found then
      if v_user_id is not null then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
        );
      end if;
      v_suppressed := true;
    end if;
  end if;

  if v_suppressed then
    new.user_id := null;
    new.resolved_user_id := null;
    new.app_user_id := null;
    new.original_app_user_id := null;
    new.aliases := null;
    new.transferred_from := null;
    new.transferred_to := null;
    new.payload := pg_catalog.jsonb_build_object(
      'erased', true,
      'reason', 'account_deletion'
    );
    new.processing_status := 'account_deleted';
    new.projection_applied := false;
    new.account_deletion_suppressed := true;
    new.error := null;
  end if;
  return new;
end;
$$;
revoke all on function public.suppress_deleted_revenuecat_identity()
  from public, anon, authenticated;

drop trigger if exists trg_subscriptions_events_account_deletion_suppress
  on public.subscriptions_events;
create trigger trg_subscriptions_events_account_deletion_suppress
  before insert or update on public.subscriptions_events
  for each row execute function public.suppress_deleted_revenuecat_identity();

-- Entitlement projection is service-linked rather than user-authored. Skip a
-- provider projection for an active or completed deletion tombstone. Returning
-- null from this BEFORE trigger makes the atomic webhook RPC record a stale /
-- account-deleted audit result without recreating entitlements.
create or replace function public.suppress_deleted_entitlement_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := new.user_id;
begin
  if v_user_id is null then
    return null;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
  );
  if exists (
    select 1
    from public.account_deletion_requests as deletion
    where deletion.user_id = v_user_id
       or deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.suppress_deleted_entitlement_projection()
  from public, anon, authenticated;

drop trigger if exists trg_entitlements_account_deletion_suppress
  on public.entitlements;
create trigger trg_entitlements_account_deletion_suppress
  before insert or update on public.entitlements
  for each row execute function public.suppress_deleted_entitlement_projection();

-- ShopMy reports are re-polled after settlement. A raw click token is nulled
-- during an active deletion under the shared lock, and after completion through
-- the irreversible token-hash tombstone created by the database erase RPC.
create or replace function public.suppress_deleted_order_click_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_click_hash text;
begin
  if new.click_token is null or new.click_token = '' then
    return new;
  end if;
  v_click_hash := 'c_' || pg_catalog.md5(
    'account-deletion:click:' || new.click_token
  );
  if exists (
    select 1
    from public.account_deletion_click_tombstones as tombstone
    where tombstone.click_token_hash = v_click_hash
  ) then
    new.click_token := null;
    return new;
  end if;

  for v_user_id in
    select distinct click.user_id
    from public.commerce_click_events as click
    where click.click_token = new.click_token
    order by click.user_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('account-deletion:' || v_user_id::text, 0)
    );
    if exists (
      select 1
      from public.account_deletion_requests as deletion
      where deletion.user_id = v_user_id
         or deletion.user_lookup_hash = public.account_deletion_lookup_hash(v_user_id)
    ) then
      new.click_token := null;
      return new;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.suppress_deleted_order_click_token()
  from public, anon, authenticated;

drop trigger if exists trg_order_attributions_account_deletion_suppress
  on public.order_attributions;
create trigger trg_order_attributions_account_deletion_suppress
  before insert or update on public.order_attributions
  for each row execute function public.suppress_deleted_order_click_token();

-- Read-only service preflight lets the Edge worker require a fresh Apple
-- credential before claim/freeze when an older receipt already made that
-- requirement durable. Claim performs the authoritative identity read again
-- under the account advisory lock to close the preflight-to-claim race.
create or replace function public.account_deletion_preflight(
  p_user_id uuid,
  p_user_hash text
)
returns table (
  request_exists boolean,
  apple_required boolean,
  next_step text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_request public.account_deletion_requests%rowtype;
begin
  if p_user_id is null
    or p_user_hash is null
    or p_user_hash !~ '^u_[0-9a-f]{32}$'
  then
    raise exception 'ACCOUNT_DELETION_STATE_INVALID' using errcode = '22023';
  end if;

  select *
  into v_request
  from public.account_deletion_requests as deletion
  where deletion.user_hash = p_user_hash;

  if not found then
    return query select false, false, null::text;
    return;
  end if;
  if v_request.user_id is not null and v_request.user_id <> p_user_id then
    raise exception 'ACCOUNT_DELETION_STATE_CONFLICT' using errcode = '55000';
  end if;
  return query select true, v_request.apple_required, v_request.next_step;
end;
$$;

-- Opaque completion lookup closes the ordinary final-response-loss window.
-- Possession of the 256-bit hash reveals only an already-complete receipt and
-- cannot start, advance, or rebind deletion. The terminal capability remains
-- usable after auth.users deletion through anon/authenticated clients, while
-- service_role supports the Edge coordinator and operational verification.
create or replace function public.account_deletion_completion_status(
  p_completion_token_hash text
)
returns table (
  request_id uuid,
  next_step text,
  apple_required boolean,
  apple_result text,
  posthog_result text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_completion_token_hash is null
    or p_completion_token_hash !~ '^t_[0-9a-f]{64}$'
  then
    raise exception 'ACCOUNT_DELETION_STATE_INVALID' using errcode = '22023';
  end if;

  return query
  select
    deletion.request_id,
    deletion.next_step,
    deletion.apple_required,
    deletion.apple_result,
    deletion.posthog_result
  from public.account_deletion_requests as deletion
  where deletion.completion_token_hash = p_completion_token_hash
    and deletion.next_step = 'complete';
end;
$$;

create or replace function public.account_deletion_claim(
  p_user_id uuid,
  p_user_hash text,
  p_apple_required boolean,
  p_session_id uuid,
  p_lease_token uuid,
  p_completion_token_hash text
)
returns table (
  request_id uuid,
  next_step text,
  apple_required boolean,
  apple_result text,
  posthog_result text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_has_apple_identity boolean;
begin
  if p_user_id is null
    or p_session_id is null
    or p_lease_token is null
    or p_user_hash is null
    or p_user_hash !~ '^u_[0-9a-f]{32}$'
    or p_completion_token_hash is null
    or p_completion_token_hash !~ '^t_[0-9a-f]{64}$'
    or p_apple_required is null
  then
    raise exception 'ACCOUNT_DELETION_STATE_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:revenuecat-events', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || p_user_id::text, 0)
  );

  select exists (
    select 1
    from auth.identities as identity
    where identity.user_id = p_user_id
      and identity.provider = 'apple'
  ) into v_has_apple_identity;
  if v_has_apple_identity and not p_apple_required then
    raise exception 'ACCOUNT_DELETION_APPLE_REAUTHORIZATION_REQUIRED' using errcode = '22023';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    user_hash,
    user_lookup_hash,
    initiating_session_id,
    completion_token_hash,
    apple_required
  )
  values (
    p_user_id,
    p_user_hash,
    public.account_deletion_lookup_hash(p_user_id),
    p_session_id,
    p_completion_token_hash,
    p_apple_required
  )
  on conflict (user_hash) do nothing;

  select *
  into v_request
  from public.account_deletion_requests as deletion
  where deletion.user_hash = p_user_hash
  for update;

  if not found then
    raise exception 'ACCOUNT_DELETION_STATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.next_step = 'complete' then
    return query select
      v_request.request_id,
      v_request.next_step,
      v_request.apple_required,
      v_request.apple_result,
      v_request.posthog_result;
    return;
  end if;
  if v_request.user_id is distinct from p_user_id then
    raise exception 'ACCOUNT_DELETION_STATE_CONFLICT' using errcode = '55000';
  end if;
  if v_request.initiating_session_id is distinct from p_session_id then
    raise exception 'ACCOUNT_DELETION_SESSION_MISMATCH' using errcode = '55000';
  end if;
  if v_request.completion_token_hash is distinct from p_completion_token_hash then
    raise exception 'ACCOUNT_DELETION_COMPLETION_TOKEN_MISMATCH' using errcode = '55000';
  end if;
  if v_request.apple_required and not p_apple_required then
    raise exception 'ACCOUNT_DELETION_APPLE_REAUTHORIZATION_REQUIRED' using errcode = '22023';
  end if;
  if v_request.lease_token is not null
    and v_request.lease_expires_at > clock_timestamp()
    and (
      v_request.next_step = 'apple_in_progress'
      or v_request.lease_token <> p_lease_token
    )
  then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = '55000';
  end if;

  update public.account_deletion_requests as deletion
  set apple_required = deletion.apple_required or p_apple_required,
      next_step = case
        -- Every explicit Apple retry obtains a fresh single-use credential
        -- before claim. A failed/expired attempt is atomically reclaimed,
        -- while an active apple_in_progress lease above rejects concurrency.
        -- Auth is also rewound when a committed checkpoint response was lost.
        when p_apple_required
          and deletion.next_step in ('apple_in_progress', 'providers_final', 'auth')
          then 'apple'
        else deletion.next_step
      end,
      apple_result = case
        when p_apple_required
          and deletion.next_step in ('apple_in_progress', 'providers_final', 'auth')
          then null
        else deletion.apple_result
      end,
      apple_attempt_started_at = case
        when p_apple_required
          and deletion.next_step in ('apple_in_progress', 'providers_final', 'auth')
          then null
        else deletion.apple_attempt_started_at
      end,
      apple_completed_at = case
        when p_apple_required
          and deletion.next_step in ('apple_in_progress', 'providers_final', 'auth')
          then null
        else deletion.apple_completed_at
      end,
      providers_final_result = case
        when p_apple_required
          and deletion.next_step in ('providers_final', 'auth')
          then null
        else deletion.providers_final_result
      end,
      providers_final_completed_at = case
        when p_apple_required
          and deletion.next_step in ('providers_final', 'auth')
          then null
        else deletion.providers_final_completed_at
      end,
      lease_token = p_lease_token,
      lease_expires_at = clock_timestamp() + interval '10 minutes',
      attempt_count = deletion.attempt_count + 1,
      last_error_code = null,
      updated_at = now()
  where deletion.request_id = v_request.request_id
  returning * into v_request;

  return query select
    v_request.request_id,
    v_request.next_step,
    v_request.apple_required,
    v_request.apple_result,
    v_request.posthog_result;
end;
$$;

create or replace function public.account_deletion_begin_apple_attempt(
  p_request_id uuid,
  p_user_id uuid,
  p_lease_token uuid
)
returns table (
  request_id uuid,
  next_step text,
  apple_required boolean,
  apple_result text,
  posthog_result text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_deletion_requests%rowtype;
begin
  select *
  into v_request
  from public.account_deletion_requests as deletion
  where deletion.request_id = p_request_id
    and deletion.user_id = p_user_id
  for update;

  if not found then
    raise exception 'ACCOUNT_DELETION_STATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.next_step <> 'apple'
    or not v_request.apple_required
    or v_request.lease_token is distinct from p_lease_token
    or v_request.lease_expires_at is null
    or v_request.lease_expires_at <= clock_timestamp()
  then
    raise exception 'ACCOUNT_DELETION_STATE_CONFLICT' using errcode = '55000';
  end if;

  update public.account_deletion_requests as deletion
  set next_step = 'apple_in_progress',
      apple_attempt_started_at = now(),
      last_error_code = null,
      updated_at = now()
  where deletion.request_id = p_request_id
  returning * into v_request;

  return query select
    v_request.request_id,
    v_request.next_step,
    v_request.apple_required,
    v_request.apple_result,
    v_request.posthog_result;
end;
$$;

create or replace function public.account_deletion_checkpoint(
  p_request_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_expected_step text,
  p_result text
)
returns table (
  request_id uuid,
  next_step text,
  apple_required boolean,
  apple_result text,
  posthog_result text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_deletion_requests%rowtype;
  v_next_step text;
begin
  select *
  into v_request
  from public.account_deletion_requests as deletion
  where deletion.request_id = p_request_id
  for update;

  if not found then
    raise exception 'ACCOUNT_DELETION_STATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- auth.users deletion and this receipt update commit in one database
  -- transaction. The Edge worker's post-delete checkpoint is read/ack only.
  if p_expected_step = 'auth'
    and v_request.next_step = 'complete'
    and v_request.user_id is null
  then
    return query select
      v_request.request_id,
      v_request.next_step,
      v_request.apple_required,
      v_request.apple_result,
      v_request.posthog_result;
    return;
  end if;
  if v_request.user_id is distinct from p_user_id then
    raise exception 'ACCOUNT_DELETION_STATE_CONFLICT' using errcode = '55000';
  end if;
  if p_expected_step = 'auth' then
    raise exception 'AUTH_DELETE_NOT_CONFIRMED' using errcode = '55000';
  end if;
  if v_request.next_step <> p_expected_step
    or v_request.lease_token is distinct from p_lease_token
    or v_request.lease_expires_at is null
    or v_request.lease_expires_at <= clock_timestamp()
  then
    raise exception 'ACCOUNT_DELETION_STATE_CONFLICT' using errcode = '55000';
  end if;

  if p_result is null
    or (p_expected_step = 'revenuecat' and p_result not in ('deleted', 'already_absent'))
    or (p_expected_step = 'posthog' and p_result not in ('deleted', 'skipped'))
    or (p_expected_step in ('storage', 'database') and p_result <> 'deleted')
    or (p_expected_step = 'sessions' and p_result <> 'revoked')
    or (p_expected_step = 'apple' and (p_result <> 'skipped' or v_request.apple_required))
    or (
      p_expected_step = 'apple_in_progress'
      and (p_result <> 'revoked' or not v_request.apple_required)
    )
    or (p_expected_step = 'providers_final' and p_result <> 'reconciled')
  then
    raise exception 'ACCOUNT_DELETION_STATE_INVALID' using errcode = '22023';
  end if;

  v_next_step := case p_expected_step
    when 'revenuecat' then 'posthog'
    when 'posthog' then 'storage'
    when 'storage' then 'database'
    when 'database' then 'sessions'
    when 'sessions' then 'apple'
    when 'apple' then 'providers_final'
    when 'apple_in_progress' then 'providers_final'
    when 'providers_final' then 'auth'
    else null
  end;
  if v_next_step is null then
    raise exception 'ACCOUNT_DELETION_STATE_INVALID' using errcode = '22023';
  end if;

  update public.account_deletion_requests as deletion
  set next_step = v_next_step,
      revenuecat_result = case when p_expected_step = 'revenuecat' then p_result else deletion.revenuecat_result end,
      apple_result = case when p_expected_step in ('apple', 'apple_in_progress') then p_result else deletion.apple_result end,
      posthog_result = case when p_expected_step = 'posthog' then p_result else deletion.posthog_result end,
      sessions_result = case when p_expected_step = 'sessions' then p_result else deletion.sessions_result end,
      providers_final_result = case when p_expected_step = 'providers_final' then p_result else deletion.providers_final_result end,
      revenuecat_completed_at = case when p_expected_step = 'revenuecat' then now() else deletion.revenuecat_completed_at end,
      posthog_completed_at = case when p_expected_step = 'posthog' then now() else deletion.posthog_completed_at end,
      storage_completed_at = case when p_expected_step = 'storage' then now() else deletion.storage_completed_at end,
      database_completed_at = case when p_expected_step = 'database' then now() else deletion.database_completed_at end,
      sessions_completed_at = case when p_expected_step = 'sessions' then now() else deletion.sessions_completed_at end,
      apple_completed_at = case when p_expected_step in ('apple', 'apple_in_progress') then now() else deletion.apple_completed_at end,
      providers_final_completed_at = case when p_expected_step = 'providers_final' then now() else deletion.providers_final_completed_at end,
      lease_expires_at = clock_timestamp() + interval '10 minutes',
      last_error_code = null,
      updated_at = now()
  where deletion.request_id = p_request_id
  returning * into v_request;

  return query select
    v_request.request_id,
    v_request.next_step,
    v_request.apple_required,
    v_request.apple_result,
    v_request.posthog_result;
end;
$$;

create or replace function public.account_deletion_record_failure(
  p_request_id uuid,
  p_user_id uuid,
  p_lease_token uuid,
  p_expected_step text,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.account_deletion_requests as deletion
  set last_error_code = case
        when p_error_code ~ '^[A-Z0-9_]{1,64}$' then p_error_code
        else 'ACCOUNT_DELETION_FAILED'
      end,
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where deletion.request_id = p_request_id
    and deletion.user_id = p_user_id
    and deletion.lease_token = p_lease_token
    and deletion.next_step = p_expected_step;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- One transaction removes every current public owner row while preserving only
-- provider/finance audit records after erasing their account identifiers.
create or replace function public.erase_account_database_state(
  p_request_id uuid,
  p_user_id uuid,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_deletion_requests%rowtype;
begin
  -- Keep the global provider-event lock before the receipt row lock. The
  -- RevenueCat scrub trigger reacquires it later in this same transaction, and
  -- this consistent order avoids a retry claim / erase deadlock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:revenuecat-events', 0)
  );

  select *
  into v_request
  from public.account_deletion_requests as deletion
  where deletion.request_id = p_request_id
    and deletion.user_id = p_user_id
  for update;
  if not found then
    raise exception 'ACCOUNT_DELETION_STATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.next_step <> 'database'
    or v_request.lease_token is distinct from p_lease_token
    or v_request.lease_expires_at is null
    or v_request.lease_expires_at <= clock_timestamp()
  then
    raise exception 'ACCOUNT_DELETION_STATE_CONFLICT' using errcode = '55000';
  end if;

  perform pg_catalog.set_config(
    'app.account_deletion_request_id',
    p_request_id::text,
    true
  );
  perform pg_catalog.set_config(
    'app.account_deletion_lease_token',
    p_lease_token::text,
    true
  );

  -- Remove the profile first so completion-delete triggers do not repeatedly
  -- recompute a streak during the bulk erase.
  delete from public.profiles where id = p_user_id;

  insert into public.account_deletion_click_tombstones (
    click_token_hash,
    request_id
  )
  select distinct
    'c_' || pg_catalog.md5('account-deletion:click:' || click.click_token),
    p_request_id
  from public.commerce_click_events as click
  where click.user_id = p_user_id
    and click.click_token <> ''
  on conflict (click_token_hash) do nothing;

  update public.order_attributions
  set click_token = null
  where click_token in (
    select click.click_token
    from public.commerce_click_events as click
    where click.user_id = p_user_id
  );

  update public.subscriptions_events
  set user_id = null,
      resolved_user_id = null,
      app_user_id = null,
      original_app_user_id = null,
      aliases = null,
      transferred_from = null,
      transferred_to = null,
      payload = pg_catalog.jsonb_build_object(
        'erased', true,
        'reason', 'account_deletion'
      ),
      processing_status = 'account_deleted',
      projection_applied = false,
      account_deletion_suppressed = true,
      error = null
  where user_id = p_user_id
    or resolved_user_id = p_user_id
    or app_user_id = p_user_id::text
    or app_user_id = v_request.user_hash
    or app_user_id = v_request.user_lookup_hash
    or original_app_user_id = p_user_id::text
    or original_app_user_id = v_request.user_hash
    or original_app_user_id = v_request.user_lookup_hash
    or p_user_id::text = any(coalesce(aliases, array[]::text[]))
    or p_user_id::text = any(coalesce(transferred_from, array[]::text[]))
    or p_user_id::text = any(coalesce(transferred_to, array[]::text[]))
    or v_request.user_hash = any(coalesce(aliases, array[]::text[]))
    or v_request.user_hash = any(coalesce(transferred_from, array[]::text[]))
    or v_request.user_hash = any(coalesce(transferred_to, array[]::text[]))
    or pg_catalog.strpos(coalesce(payload::text, ''), p_user_id::text) > 0
    or pg_catalog.strpos(coalesce(payload::text, ''), v_request.user_hash) > 0;

  delete from public.obf_contribution_queue
  where user_id = p_user_id
    or correction_id in (
      select correction.id
      from public.catalog_corrections as correction
      where correction.user_id = p_user_id
    );
  delete from public.community_reports where reporter_id = p_user_id;
  delete from public.community_reactions where user_id = p_user_id;
  delete from public.community_blocks where user_id = p_user_id;
  delete from public.community_questions where user_id = p_user_id;
  delete from public.ask_safety_audit where user_id = p_user_id;
  delete from public.ask_sessions where user_id = p_user_id;
  delete from public.catalog_lookup_events where user_id = p_user_id;
  delete from public.catalog_corrections where user_id = p_user_id;
  delete from public.photo_trend where user_id = p_user_id;
  delete from public.recommendations where user_id = p_user_id;
  delete from public.recommendation_preferences where user_id = p_user_id;
  delete from public.notification_log where user_id = p_user_id;
  delete from public.streak_freezes where user_id = p_user_id;
  delete from public.notification_preferences where user_id = p_user_id;
  delete from public.cycles where user_id = p_user_id;
  delete from public.active_ramp where user_id = p_user_id;
  delete from public.routine_conflicts where user_id = p_user_id;
  delete from public.routine_completions where user_id = p_user_id;
  delete from public.routines where user_id = p_user_id;
  delete from public.photos where user_id = p_user_id;
  delete from public.shelf_scans where user_id = p_user_id;
  delete from public.commerce_click_events where user_id = p_user_id;
  delete from public.user_products where user_id = p_user_id;
  delete from public.reverse_trial_grants where user_id = p_user_id;
  delete from public.entitlements where user_id = p_user_id;
  delete from public.consents where user_id = p_user_id;
  delete from public.skin_profiles where user_id = p_user_id;
end;
$$;

-- GoTrue does not carry the Edge worker's lease token into its database
-- transaction. The database therefore serializes auth deletion against claim
-- with the same account advisory lock, locks the receipt row, and admits DELETE
-- only while an unexpired `auth` lease is ready. A delayed worker cannot delete
-- auth after another worker has rewound the receipt to Apple/provider recovery.
create or replace function public.guard_account_deletion_before_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.account_deletion_requests%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || old.id::text, 0)
  );
  select *
  into v_request
  from public.account_deletion_requests as deletion
  where deletion.user_id = old.id
  for update;

  if not found
    or v_request.next_step <> 'auth'
    or v_request.lease_token is null
    or v_request.lease_expires_at is null
    or v_request.lease_expires_at <= clock_timestamp()
  then
    raise exception 'ACCOUNT_DELETION_AUTH_NOT_READY' using errcode = '55000';
  end if;

  perform pg_catalog.set_config(
    'app.account_deletion_auth_delete_user_id',
    old.id::text,
    true
  );
  perform pg_catalog.set_config(
    'app.account_deletion_auth_delete_request_id',
    v_request.request_id::text,
    true
  );
  return old;
end;
$$;
revoke all on function public.guard_account_deletion_before_auth_delete()
  from public, anon, authenticated;

-- GoTrue's auth.users DELETE and this receipt transition commit atomically.
-- The BEFORE guard makes every out-of-order admin delete roll back instead of
-- discarding the recovery identifier or inventing a terminal partial state.
create or replace function public.finalize_account_deletion_after_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.account_deletion_requests as deletion
  set next_step = 'complete',
      user_id = null,
      initiating_session_id = null,
      auth_completed_at = now(),
      completed_at = now(),
      lease_token = null,
      lease_expires_at = null,
      last_error_code = null,
      updated_at = now()
  where deletion.user_id = old.id
    and deletion.next_step = 'auth'
    and deletion.request_id::text = pg_catalog.current_setting(
          'app.account_deletion_auth_delete_request_id',
          true
        );
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'ACCOUNT_DELETION_AUTH_NOT_READY' using errcode = '55000';
  end if;
  return old;
end;
$$;
revoke all on function public.finalize_account_deletion_after_auth_delete()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_delete_account_deletion_guard
  on auth.users;
create trigger on_auth_user_delete_account_deletion_guard
  before delete on auth.users
  for each row execute function public.guard_account_deletion_before_auth_delete();

drop trigger if exists on_auth_user_deleted_finalize_account_deletion
  on auth.users;
create trigger on_auth_user_deleted_finalize_account_deletion
  after delete on auth.users
  for each row execute function public.finalize_account_deletion_after_auth_delete();

revoke all on function public.account_deletion_preflight(uuid, text)
  from public, anon, authenticated;
revoke all on function public.account_deletion_claim(uuid, text, boolean, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.account_deletion_completion_status(text)
  from public, anon, authenticated;
revoke all on function public.account_deletion_begin_apple_attempt(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.account_deletion_checkpoint(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.account_deletion_record_failure(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.erase_account_database_state(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.account_deletion_preflight(uuid, text)
  to service_role;
grant execute on function public.account_deletion_claim(uuid, text, boolean, uuid, uuid, text)
  to service_role;
grant execute on function public.account_deletion_completion_status(text)
  to anon, authenticated, service_role;
grant execute on function public.account_deletion_begin_apple_attempt(uuid, uuid, uuid)
  to service_role;
grant execute on function public.account_deletion_checkpoint(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.account_deletion_record_failure(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.erase_account_database_state(uuid, uuid, uuid)
  to service_role;
