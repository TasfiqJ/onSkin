-- =============================================================================
-- Entitlement authority lanes
-- =============================================================================
-- RevenueCat events and app-granted reverse trials previously competed for the
-- single public.entitlements row keyed by user_id. Keep that table as the
-- RevenueCat projection, retain the one-time reverse-trial grant as the app
-- authority, and expose both through one owner-derived read RPC.
--
-- Historical RevenueCat rows without a complete provider ordering tuple are
-- not assigned an artificial timestamp. They remain legacy_unknown and fail
-- closed until a service-side RevenueCat CustomerInfo reconciliation records a
-- provider snapshot watermark. Webhooks older than or equal to that snapshot
-- are stale; a later webhook resumes the exact event tuple ordering introduced
-- by migration 0041.

begin;

-- Migration 0052 retained the five-argument service rate-limit API by
-- delegating to this private 0048 implementation. Extend that single
-- authoritative implementation for reconciliation; otherwise the new Edge
-- Function would deterministically fail every request as EDGE_RATE_LIMIT_INVALID.
-- This remains an owner-scoped bucket and therefore shares the account-write
-- advisory lock and deletion barrier with every other account mutation.
create or replace function public._consume_edge_rate_limit_v0048_unbound(
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
       'catalog-search', 'data-export', 'growth-event',
       'subscription-reconciliation', 'waitlist'
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
    'account-deletion-intake', 'catalog-lookup', 'catalog-search', 'data-export',
    'subscription-reconciliation'
  );
  if v_account_scope then
    if p_owner_user_id is null then
      raise exception 'EDGE_RATE_LIMIT_ACCOUNT_OWNER_NOT_ACTIVE' using errcode = '42501';
    end if;

    if p_scope = 'account-deletion-intake' then
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

revoke all on function public._consume_edge_rate_limit_v0048_unbound(
  text, text, integer, integer, uuid
) from public, anon, authenticated, service_role;

alter table public.edge_rate_limits
  drop constraint if exists edge_rate_limits_scope_owner_classification,
  add constraint edge_rate_limits_scope_owner_classification
    check (
      (
        scope in (
          'account-deletion-intake', 'catalog-lookup', 'catalog-search',
          'data-export', 'subscription-reconciliation'
        )
        and owner_user_id is not null
      )
      or (
        scope in ('account-deletion-status', 'growth-event', 'waitlist')
        and owner_user_id is null
      )
    );

alter table public.entitlements
  add column if not exists rc_cursor_state text not null default 'ordered',
  add column if not exists rc_snapshot_at timestamptz,
  add column if not exists rc_snapshot_fingerprint text;

-- Recover app-granted rows into their durable one-time authority before
-- removing them from the RevenueCat projection. A malformed legacy grant with
-- no expiry is retained as already-used but immediately inactive; it never
-- becomes indefinite access.
insert into public.reverse_trial_grants as grants (
  user_id,
  granted_at,
  expires_at,
  source,
  metadata
)
select
  entitlements.user_id,
  coalesce(
    entitlements.original_purchase_at,
    entitlements.verified_at,
    entitlements.updated_at,
    transaction_timestamp()
  ),
  coalesce(
    entitlements.expires_at,
    entitlements.original_purchase_at,
    entitlements.verified_at,
    entitlements.updated_at,
    transaction_timestamp()
  ),
  'server',
  pg_catalog.jsonb_build_object(
    'action', 'start_reverse_trial',
    'environment', case
      when entitlements.environment in ('production', 'development')
        then entitlements.environment
      else 'unknown'
    end
  )
from public.entitlements as entitlements
where entitlements.period_type = 'reverse_trial'
  and (
    entitlements.source = 'app_granted'
    or (
      entitlements.source is null
      and entitlements.store = 'app_granted'
    )
  )
on conflict (user_id) do update
  set source = 'server',
      metadata = pg_catalog.jsonb_build_object(
        'action', 'start_reverse_trial',
        'environment', case
          when coalesce(
            grants.metadata ->> 'environment',
            excluded.metadata ->> 'environment'
          ) in ('production', 'development')
            then coalesce(
              grants.metadata ->> 'environment',
              excluded.metadata ->> 'environment'
            )
          else 'unknown'
        end
      );

-- Whitelist the only app-grant metadata retained by the current contract.
-- This prevents legacy service writes from carrying store product, transaction,
-- event, offering, package, or RevenueCat user identifiers into this lane.
update public.reverse_trial_grants as grants
   set source = 'server',
       metadata = pg_catalog.jsonb_build_object(
         'action', 'start_reverse_trial',
         'environment', case
           when grants.metadata ->> 'environment' in ('production', 'development')
             then grants.metadata ->> 'environment'
           else 'unknown'
         end
       );

delete from public.entitlements as entitlements
where entitlements.period_type = 'reverse_trial'
  and (
    entitlements.source = 'app_granted'
    or (
      entitlements.source is null
      and entitlements.store = 'app_granted'
    )
  );

-- The webhook mapper historically collapsed RevenueCat's PROMOTIONAL store
-- into app_granted. Normalize those rows from retained provider provenance
-- before reserving app_granted exclusively for reverse_trial_grants. The raw
-- audit payload is the strongest evidence; source='revenuecat' is the bounded
-- fallback for projections already written by the guarded webhook RPC.
update public.subscriptions_events as events
   set store = 'promotional'
 where events.store = 'app_granted'
   and pg_catalog.upper(
         pg_catalog.btrim(coalesce(events.payload -> 'event' ->> 'store', ''))
       ) = 'PROMOTIONAL';

update public.entitlements as entitlements
   set store = 'promotional',
       source = 'revenuecat'
 where entitlements.store = 'app_granted'
   and (
     entitlements.source = 'revenuecat'
     or exists (
       select 1
         from public.subscriptions_events as events
        where events.rc_event_id = entitlements.rc_event_id
          and pg_catalog.upper(
                pg_catalog.btrim(
                  coalesce(events.payload -> 'event' ->> 'store', '')
                )
              ) = 'PROMOTIONAL'
     )
   );

-- An app_granted-shaped row that was neither a strict historical reverse
-- trial nor tied to provider promotional evidence is not safe to classify as
-- either authority. Preserve non-identity diagnostics but quarantine access
-- as an unordered RevenueCat projection until a fresh provider snapshot.
update public.entitlements as entitlements
   set is_active = false,
       store = null,
       source = 'revenuecat',
       rc_event_id = null,
       rc_event_at = null,
       rc_event_priority = null,
       rc_original_transaction_id = null,
       rc_transaction_id = null,
       store_user_id = null,
       raw_status = '{}'::jsonb
 where entitlements.store = 'app_granted'
    or entitlements.source = 'app_granted';

-- After the strict local-marker recovery above, every remaining historical
-- row belongs to the provider projection table. Rows without exact provider
-- order still become legacy_unknown below and cannot grant access.
update public.entitlements
   set source = 'revenuecat'
 where source is distinct from 'revenuecat';

alter table public.entitlements
  alter column source set not null;

-- Recover a complete tuple only from the exact persisted RevenueCat audit row.
-- Processing time, migration time, updated_at, and verified_at are deliberately
-- never promoted into provider ordering evidence.
update public.entitlements as entitlements
   set rc_event_at = coalesce(
         entitlements.rc_event_at,
         events.provider_event_at
       ),
       rc_event_priority = coalesce(
         entitlements.rc_event_priority,
         events.projection_priority
       )
  from public.subscriptions_events as events
 where entitlements.rc_event_id = events.rc_event_id
   and events.provider_event_at is not null
   and events.projection_priority in (100, 200, 300);

update public.entitlements as entitlements
   set rc_cursor_state = case
         when entitlements.rc_event_at is not null
          and entitlements.rc_event_priority in (100, 200, 300)
          and entitlements.rc_event_id is not null
          and pg_catalog.length(pg_catalog.btrim(entitlements.rc_event_id)) > 0
           then 'ordered'
         else 'legacy_unknown'
       end,
       rc_snapshot_at = null,
       rc_snapshot_fingerprint = null;

alter table public.entitlements
  drop constraint if exists entitlements_rc_cursor_state_allowed,
  add constraint entitlements_rc_cursor_state_allowed
    check (rc_cursor_state in ('ordered', 'snapshot', 'legacy_unknown')),
  drop constraint if exists entitlements_rc_cursor_shape,
  add constraint entitlements_rc_cursor_shape
    check (
      (
        rc_cursor_state = 'ordered'
        and rc_event_at is not null
        and rc_event_priority in (100, 200, 300)
        and rc_event_id is not null
        and pg_catalog.length(pg_catalog.btrim(rc_event_id)) > 0
        and rc_snapshot_at is null
        and rc_snapshot_fingerprint is null
      )
      or (
        rc_cursor_state = 'snapshot'
        and rc_event_at is null
        and rc_event_priority is null
        and rc_event_id is null
        and rc_snapshot_at is not null
        and rc_snapshot_fingerprint ~ '^md5:[a-f0-9]{32}$'
      )
      or (
        rc_cursor_state = 'legacy_unknown'
        and rc_snapshot_at is null
        and rc_snapshot_fingerprint is null
      )
    ),
  drop constraint if exists entitlements_excludes_local_reverse_trial,
  drop constraint if exists entitlements_revenuecat_authority_only,
  add constraint entitlements_revenuecat_authority_only
    check (
      source = 'revenuecat'
      and (store is null or store <> 'app_granted')
    );

create or replace function public._revenuecat_event_cursor_is_newer_v0053(
  p_new_at timestamptz,
  p_new_priority smallint,
  p_new_event_id text,
  p_old_at timestamptz,
  p_old_priority smallint,
  p_old_event_id text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_new_at > p_old_at
    or (
      p_new_at = p_old_at
      and p_new_priority > p_old_priority
    )
    or (
      p_new_at = p_old_at
      and p_new_priority = p_old_priority
      and pg_catalog.convert_to(p_new_event_id, 'UTF8')
        > pg_catalog.convert_to(p_old_event_id, 'UTF8')
    ),
    false
  );
$$;

revoke all on function public._revenuecat_event_cursor_is_newer_v0053(
  timestamptz, smallint, text, timestamptz, smallint, text
) from public, anon, authenticated, service_role;

create or replace function public._guard_revenuecat_entitlement_cursor_v0053()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Migration 0051's identity-family scrub deliberately clears only privacy
  -- payloads on foreign entitlement rows. Permit that exact monotonic scrub
  -- for every cursor state without treating it as a provider projection: all
  -- projection and cursor fields must be byte-for-byte unchanged, identifiers
  -- can only move to NULL, and raw provider status can only move to {}.
  if tg_op = 'UPDATE'
     and new.store_user_id is null
     and new.raw_status = '{}'::jsonb
     and row(
       new.user_id,
       new.entitlement,
       new.is_active,
       new.product_id,
       new.expires_at,
       new.rc_event_id,
       new.store,
       new.period_type,
       new.will_renew,
       new.original_purchase_at,
       new.offering_id,
       new.experiment_id,
       new.acquisition_channel,
       new.source,
       new.environment,
       new.management_url,
       new.verified_at,
       new.package_id,
       new.last_reconciled_at,
       new.rc_event_at,
       new.rc_event_priority,
       new.rc_original_transaction_id,
       new.rc_transaction_id,
       new.rc_cursor_state,
       new.rc_snapshot_at,
       new.rc_snapshot_fingerprint
     ) is not distinct from row(
       old.user_id,
       old.entitlement,
       old.is_active,
       old.product_id,
       old.expires_at,
       old.rc_event_id,
       old.store,
       old.period_type,
       old.will_renew,
       old.original_purchase_at,
       old.offering_id,
       old.experiment_id,
       old.acquisition_channel,
       old.source,
       old.environment,
       old.management_url,
       old.verified_at,
       old.package_id,
       old.last_reconciled_at,
       old.rc_event_at,
       old.rc_event_priority,
       old.rc_original_transaction_id,
       old.rc_transaction_id,
       old.rc_cursor_state,
       old.rc_snapshot_at,
       old.rc_snapshot_fingerprint
     ) then
    return new;
  end if;

  -- Snapshot rows are written only through the service-only reconciliation RPC.
  -- An accepted webhook UPDATE inherits unspecified cursor-state columns from
  -- the old snapshot row, so a complete new event tuple must continue into the
  -- webhook branch below rather than being mistaken for a snapshot write.
  if new.rc_cursor_state = 'snapshot'
     and new.rc_event_at is null
     and new.rc_event_priority is null
     and new.rc_event_id is null then
    if new.rc_snapshot_at is null
       or new.rc_snapshot_fingerprint is null
       or new.rc_snapshot_fingerprint !~ '^md5:[a-f0-9]{32}$' then
      raise exception 'INVALID_REVENUECAT_SNAPSHOT_CURSOR' using errcode = '22023';
    end if;
    return new;
  end if;

  -- Every webhook projection has a complete provider tuple. The migration-0041
  -- UPSERT does not know about the new state columns, so this trigger establishes
  -- ordered state for inserts and accepted post-snapshot updates.
  if new.source = 'revenuecat'
     and new.rc_event_at is not null
     and new.rc_event_priority in (100, 200, 300)
     and new.rc_event_id is not null
     and pg_catalog.length(pg_catalog.btrim(new.rc_event_id)) > 0 then
    if tg_op = 'INSERT' then
      new.rc_cursor_state := 'ordered';
      new.rc_snapshot_at := null;
      new.rc_snapshot_fingerprint := null;
      return new;
    end if;

    -- No ordinary webhook can establish order relative to a genuinely
    -- unordered legacy row. A current CustomerInfo snapshot must initialize the
    -- watermark first, including when this webhook is a legitimate delayed
    -- refund or expiration.
    if old.rc_cursor_state = 'legacy_unknown' then
      return null;
    end if;

    if old.rc_cursor_state = 'snapshot' then
      -- A snapshot describes provider state as of its request time. Equal-time
      -- events are covered by that snapshot, so only a strictly later provider
      -- event may resume event-tuple ordering.
      if new.rc_event_at <= old.rc_snapshot_at then
        return null;
      end if;
      new.rc_cursor_state := 'ordered';
      new.rc_snapshot_at := null;
      new.rc_snapshot_fingerprint := null;
      return new;
    end if;

    if old.rc_cursor_state = 'ordered'
       and not public._revenuecat_event_cursor_is_newer_v0053(
         new.rc_event_at,
         new.rc_event_priority,
         new.rc_event_id,
         old.rc_event_at,
         old.rc_event_priority,
         old.rc_event_id
       ) then
      return null;
    end if;

    new.rc_cursor_state := 'ordered';
    new.rc_snapshot_at := null;
    new.rc_snapshot_fingerprint := null;
    return new;
  end if;

  raise exception 'INVALID_REVENUECAT_EVENT_CURSOR' using errcode = '22023';
end;
$$;

revoke all on function public._guard_revenuecat_entitlement_cursor_v0053()
  from public, anon, authenticated, service_role;

drop trigger if exists guard_revenuecat_entitlement_cursor_v0053
  on public.entitlements;
create trigger guard_revenuecat_entitlement_cursor_v0053
before insert or update on public.entitlements
for each row execute function public._guard_revenuecat_entitlement_cursor_v0053();

-- A trusted server fetches current RevenueCat CustomerInfo, maps the pro
-- entitlement into these bounded fields, and supplies the provider response's
-- request_date as p_snapshot_at. This RPC never accepts a client identity and is
-- never executable by a client role.
create or replace function public.reconcile_revenuecat_entitlement_snapshot(
  p_user_id uuid,
  p_snapshot_at timestamptz,
  p_entitlement text,
  p_is_active boolean,
  p_product_id text,
  p_expires_at timestamptz,
  p_store text,
  p_period_type text,
  p_will_renew boolean,
  p_original_purchase_at timestamptz,
  p_offering_id text,
  p_environment text,
  p_management_url text,
  p_package_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_existing public.entitlements%rowtype;
  v_environment text := p_environment;
  v_fingerprint text;
begin
  if p_user_id is null
     or p_snapshot_at is null
     or p_snapshot_at < v_now - interval '5 minutes'
     or p_snapshot_at > v_now + interval '5 minutes'
     or p_is_active is null
     or p_will_renew is null
     or p_environment is null
     or p_environment not in (
       'production', 'sandbox', 'test_store', 'development', 'unknown'
     )
     or (
       p_entitlement is null
       and (
         p_is_active
         or p_product_id is not null
         or p_expires_at is not null
         or p_store is not null
         or p_period_type is not null
         or p_will_renew
         or p_original_purchase_at is not null
         or p_offering_id is not null
         or p_management_url is not null
         or p_package_id is not null
       )
     )
     or (
       p_entitlement is not null
       and (
         p_entitlement not in ('pro', 'pro_plus')
         or p_product_id is null
         or p_product_id <> pg_catalog.btrim(p_product_id)
         or pg_catalog.length(p_product_id) = 0
         or pg_catalog.length(p_product_id) > 500
         or p_store is null
         or p_original_purchase_at is null
         or p_original_purchase_at > p_snapshot_at + interval '1 minute'
         or (p_expires_at is not null and p_expires_at < p_original_purchase_at)
         or p_is_active is distinct from (
           p_expires_at is null or p_expires_at > p_snapshot_at
         )
       )
     )
     or (p_store is not null and p_store not in (
       'app_store', 'play_store', 'web', 'test_store', 'promotional'
     ))
     or (
       p_period_type is not null
       and (
         p_period_type <> pg_catalog.btrim(p_period_type)
         or pg_catalog.length(p_period_type) = 0
         or pg_catalog.length(p_period_type) > 100
         or p_period_type !~ '^[a-z0-9_]+$'
       )
     )
     or (p_store in ('promotional', 'test_store') and p_will_renew)
     or (p_offering_id is not null and (
       p_offering_id <> pg_catalog.btrim(p_offering_id)
       or pg_catalog.length(p_offering_id) = 0
       or pg_catalog.length(p_offering_id) > 500
     ))
     or (p_management_url is not null and (
       p_management_url <> pg_catalog.btrim(p_management_url)
       or pg_catalog.length(p_management_url) = 0
       or pg_catalog.length(p_management_url) > 2048
     ))
     or (p_package_id is not null and (
       p_package_id <> pg_catalog.btrim(p_package_id)
       or pg_catalog.length(p_package_id) = 0
       or pg_catalog.length(p_package_id) > 500
     )) then
    raise exception 'INVALID_REVENUECAT_SNAPSHOT' using errcode = '22023';
  end if;

  if not public.account_write_allowed(p_user_id) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = 'P0001';
  end if;

  v_fingerprint := 'md5:' || pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'entitlement', p_entitlement,
      'is_active', p_is_active,
      'product_id', p_product_id,
      'expires_at', p_expires_at,
      'store', p_store,
      'period_type', p_period_type,
      'will_renew', p_will_renew,
      'original_purchase_at', p_original_purchase_at,
      'offering_id', p_offering_id,
      'environment', v_environment,
      'management_url', p_management_url,
      'package_id', p_package_id
    )::text
  );

  select entitlements.*
    into v_existing
    from public.entitlements as entitlements
   where entitlements.user_id = p_user_id
   for update;

  if v_existing.user_id is not null then
    if v_existing.rc_cursor_state = 'snapshot' then
      if p_snapshot_at < v_existing.rc_snapshot_at then
        return 'stale_snapshot';
      end if;
      if p_snapshot_at = v_existing.rc_snapshot_at then
        if v_fingerprint = v_existing.rc_snapshot_fingerprint then
          return 'duplicate_snapshot';
        end if;
        raise exception 'REVENUECAT_SNAPSHOT_CONFLICT' using errcode = 'P0001';
      end if;
    elsif v_existing.rc_cursor_state = 'ordered' then
      if p_snapshot_at < v_existing.rc_event_at then
        return 'stale_snapshot';
      end if;
      if p_snapshot_at = v_existing.rc_event_at then
        raise exception 'REVENUECAT_SNAPSHOT_CURSOR_CONFLICT' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into public.entitlements as entitlement_projection (
    user_id,
    entitlement,
    is_active,
    product_id,
    expires_at,
    rc_event_id,
    updated_at,
    store,
    period_type,
    will_renew,
    original_purchase_at,
    offering_id,
    source,
    environment,
    management_url,
    verified_at,
    package_id,
    store_user_id,
    last_reconciled_at,
    raw_status,
    rc_event_at,
    rc_event_priority,
    rc_original_transaction_id,
    rc_transaction_id,
    rc_cursor_state,
    rc_snapshot_at,
    rc_snapshot_fingerprint
  ) values (
    p_user_id,
    p_entitlement,
    p_is_active,
    p_product_id,
    p_expires_at,
    null,
    v_now,
    p_store,
    p_period_type,
    p_will_renew,
    p_original_purchase_at,
    p_offering_id,
    'revenuecat',
    v_environment,
    p_management_url,
    v_now,
    p_package_id,
    null,
    v_now,
    pg_catalog.jsonb_build_object(
      'authority', 'revenuecat_snapshot',
      'fingerprint', v_fingerprint
    ),
    null,
    null,
    null,
    null,
    'snapshot',
    p_snapshot_at,
    v_fingerprint
  )
  on conflict (user_id) do update
    set entitlement = excluded.entitlement,
        is_active = excluded.is_active,
        product_id = excluded.product_id,
        expires_at = excluded.expires_at,
        rc_event_id = null,
        updated_at = excluded.updated_at,
        store = excluded.store,
        period_type = excluded.period_type,
        will_renew = excluded.will_renew,
        original_purchase_at = excluded.original_purchase_at,
        offering_id = excluded.offering_id,
        source = excluded.source,
        environment = excluded.environment,
        management_url = excluded.management_url,
        verified_at = excluded.verified_at,
        package_id = excluded.package_id,
        store_user_id = null,
        last_reconciled_at = excluded.last_reconciled_at,
        raw_status = excluded.raw_status,
        rc_event_at = null,
        rc_event_priority = null,
        rc_original_transaction_id = null,
        rc_transaction_id = null,
        rc_cursor_state = excluded.rc_cursor_state,
        rc_snapshot_at = excluded.rc_snapshot_at,
        rc_snapshot_fingerprint = excluded.rc_snapshot_fingerprint;

  return 'reconciled_snapshot';
end;
$$;

revoke all on function public.reconcile_revenuecat_entitlement_snapshot(
  uuid, timestamptz, text, boolean, text, timestamptz, text, text, boolean,
  timestamptz, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_revenuecat_entitlement_snapshot(
  uuid, timestamptz, text, boolean, text, timestamptz, text, text, boolean,
  timestamptz, text, text, text, text
) to service_role;

-- Reverse-trial state is now derived directly from the immutable grant window.
-- Retain the legacy scheduled entry point as a safe no-op during a rolling Edge
-- deployment; it no longer mutates or revokes the RevenueCat projection.
create or replace function public.expire_app_granted_reverse_trials()
returns integer
language sql
security definer
set search_path = ''
as $$
  select 0;
$$;

revoke all on function public.expire_app_granted_reverse_trials()
  from public, anon, authenticated, service_role;
grant execute on function public.expire_app_granted_reverse_trials()
  to service_role;

create or replace function public.grant_app_granted_reverse_trial(
  p_user_id uuid,
  p_expires_at timestamptz,
  p_environment text
)
returns setof public.entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_entitlement public.entitlements%rowtype;
  inserted_grant public.reverse_trial_grants%rowtype;
  now_at timestamptz := clock_timestamp();
  normalized_environment text := case
    when p_environment in ('production', 'development') then p_environment
    else 'unknown'
  end;
begin
  if p_user_id is null
     or p_expires_at is null
     or p_expires_at <= now_at
     or p_expires_at > now_at + interval '8 days' then
    raise exception 'INVALID_REVERSE_TRIAL_WINDOW' using errcode = '22023';
  end if;

  if not public.account_write_allowed(p_user_id) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = 'P0001';
  end if;

  select entitlements.*
    into current_entitlement
    from public.entitlements as entitlements
   where entitlements.user_id = p_user_id
   for update;

  if current_entitlement.user_id is not null
     and current_entitlement.rc_cursor_state = 'legacy_unknown' then
    raise exception 'STORE_ENTITLEMENT_RECONCILIATION_REQUIRED' using errcode = 'P0001';
  end if;

  if current_entitlement.user_id is not null
     and current_entitlement.is_active
     and (
       current_entitlement.expires_at is null
       or current_entitlement.expires_at > now_at
     ) then
    raise exception 'ACTIVE_SUBSCRIPTION_EXISTS';
  end if;

  insert into public.reverse_trial_grants (
    user_id,
    granted_at,
    expires_at,
    source,
    metadata
  ) values (
    p_user_id,
    now_at,
    p_expires_at,
    'server',
    pg_catalog.jsonb_build_object(
      'action', 'start_reverse_trial',
      'environment', normalized_environment
    )
  )
  on conflict (user_id) do nothing
  returning * into inserted_grant;

  if inserted_grant.user_id is null then
    raise exception 'REVERSE_TRIAL_ALREADY_USED';
  end if;

  -- Return the established compatibility row shape without inserting it into
  -- the RevenueCat table. Every RevenueCat/store-only identifier is null.
  return query
    select
      inserted_grant.user_id,
      'pro'::text,
      inserted_grant.expires_at > now_at,
      null::text,
      inserted_grant.expires_at,
      null::text,
      inserted_grant.granted_at,
      'app_granted'::text,
      'reverse_trial'::text,
      false,
      inserted_grant.granted_at,
      null::text,
      null::text,
      null::text,
      'app_granted'::text,
      normalized_environment,
      null::text,
      inserted_grant.granted_at,
      null::text,
      null::text,
      inserted_grant.granted_at,
      pg_catalog.jsonb_build_object('action', 'start_reverse_trial'),
      null::timestamptz,
      null::smallint,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::text;
end;
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

revoke all on function public.grant_app_granted_reverse_trial(
  uuid, timestamptz, text
) from public, anon, authenticated, service_role;
grant execute on function public.grant_app_granted_reverse_trial(
  uuid, timestamptz, text
) to service_role;

revoke all on function public.grant_app_granted_reverse_trial(
  uuid, timestamptz, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.grant_app_granted_reverse_trial(
  uuid, timestamptz, text, text
) to service_role;

-- One exact authenticated object. The caller cannot choose a subject, and the
-- definer reads only auth.uid(). Both absent lanes are explicit. A legacy store
-- row is returned with is_active=false even if its historical raw bit was true.
create or replace function public.read_entitlement_projections()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_store public.entitlements%rowtype;
  v_app_grant public.reverse_trial_grants%rowtype;
  v_store_live boolean := false;
  v_app_live boolean := false;
  v_store_state text;
  v_app_state text;
  v_store_cursor jsonb;
  v_store_row jsonb;
  v_app_row jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATED_SUBJECT_REQUIRED' using errcode = '28000';
  end if;

  select entitlements.*
    into v_store
    from public.entitlements as entitlements
   where entitlements.user_id = v_user_id;

  select grants.*
    into v_app_grant
    from public.reverse_trial_grants as grants
   where grants.user_id = v_user_id;

  if v_store.user_id is null then
    v_store_state := 'absent';
    v_store_row := null;
  elsif v_store.rc_cursor_state = 'legacy_unknown' then
    v_store_state := 'legacy_unknown';
    v_store_cursor := null;
    v_store_row := pg_catalog.jsonb_build_object(
      'tier', v_store.entitlement,
      'is_active', false,
      'product_id', v_store.product_id,
      'expires_at', v_store.expires_at,
      'store', v_store.store,
      'period_type', v_store.period_type,
      'will_renew', v_store.will_renew,
      'granted_at', v_store.original_purchase_at,
      'source', 'revenuecat',
      'environment', v_store.environment,
      'management_url', v_store.management_url,
      'verified_at', v_store.verified_at,
      'offering_id', v_store.offering_id,
      'package_id', v_store.package_id,
      'cursor', v_store_cursor
    );
  else
    v_store_live := v_store.is_active
      and v_store.entitlement in ('pro', 'pro_plus')
      and (v_store.expires_at is null or v_store.expires_at > v_now);
    v_store_state := case when v_store_live then 'active' else 'inactive' end;
    v_store_cursor := case
      when v_store.rc_cursor_state = 'ordered' then
        pg_catalog.jsonb_build_object(
          'kind', 'rc_webhook',
          'at', v_store.rc_event_at,
          'priority', v_store.rc_event_priority,
          'event_id', v_store.rc_event_id
        )
      when v_store.rc_cursor_state = 'snapshot' then
        pg_catalog.jsonb_build_object(
          'kind', 'rc_snapshot',
          'at', v_store.rc_snapshot_at,
          'fingerprint', v_store.rc_snapshot_fingerprint
        )
      else null
    end;
    v_store_row := pg_catalog.jsonb_build_object(
      'tier', v_store.entitlement,
      'is_active', v_store_live,
      'product_id', v_store.product_id,
      'expires_at', v_store.expires_at,
      'store', v_store.store,
      'period_type', v_store.period_type,
      'will_renew', v_store.will_renew,
      'granted_at', v_store.original_purchase_at,
      'source', 'revenuecat',
      'environment', v_store.environment,
      'management_url', v_store.management_url,
      'verified_at', v_store.verified_at,
      'offering_id', v_store.offering_id,
      'package_id', v_store.package_id,
      'cursor', v_store_cursor
    );
  end if;

  if v_app_grant.user_id is null then
    v_app_state := 'absent';
    v_app_row := null;
  else
    v_app_live := v_app_grant.expires_at > v_now;
    v_app_state := case when v_app_live then 'active' else 'inactive' end;
    v_app_row := pg_catalog.jsonb_build_object(
      'tier', 'pro',
      'is_active', v_app_live,
      'product_id', null,
      'expires_at', v_app_grant.expires_at,
      'store', 'app_granted',
      'period_type', 'reverse_trial',
      'will_renew', false,
      'granted_at', v_app_grant.granted_at,
      'source', 'app_granted',
      'environment', case
        when v_app_grant.metadata ->> 'environment' in ('production', 'development')
          then v_app_grant.metadata ->> 'environment'
        else 'unknown'
      end,
      'management_url', null,
      'verified_at', v_app_grant.granted_at,
      'offering_id', null,
      'package_id', null,
      'cursor', null
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'schema_version', 1,
    'store_projection', pg_catalog.jsonb_build_object(
      'state', v_store_state,
      'row', v_store_row
    ),
    'app_grant_projection', pg_catalog.jsonb_build_object(
      'state', v_app_state,
      'row', v_app_row
    )
  );
end;
$$;

revoke all on function public.read_entitlement_projections()
  from public, anon, authenticated, service_role;
grant execute on function public.read_entitlement_projections()
  to authenticated;

comment on column public.entitlements.rc_cursor_state is
  'RevenueCat projection order authority: exact webhook tuple, provider snapshot watermark, or fail-closed unordered legacy row.';
comment on function public.reconcile_revenuecat_entitlement_snapshot(
  uuid, timestamptz, text, boolean, text, timestamptz, text, text, boolean,
  timestamptz, text, text, text, text
) is
  'Service-only RevenueCat CustomerInfo reconciliation. p_snapshot_at is the provider request_date; no processing or migration timestamp may be substituted.';
comment on function public.read_entitlement_projections() is
  'Returns exactly one schema-v1 object containing the auth.uid RevenueCat and app-grant lanes; the caller supplies no subject.';

commit;
