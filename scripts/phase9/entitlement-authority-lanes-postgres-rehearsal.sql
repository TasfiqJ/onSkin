\set ON_ERROR_STOP on

-- Disposable PostgreSQL 15/17 rehearsal for migration 0053. Run only in a
-- fresh throwaway database. The schema below is the smallest effective
-- pre-0053 contract needed to exercise the real 0041 webhook projection and
-- the real forward-only authority-lane migration.

create extension pgcrypto with schema public;

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$$;

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
  user_id uuid references auth.users (id) on delete set null,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  app_user_id text,
  original_app_user_id text,
  aliases text[],
  resolved_user_id uuid references auth.users (id) on delete set null,
  environment text,
  store text,
  product_id text,
  processed_at timestamptz,
  processing_status text,
  error text,
  signature_verified boolean,
  auth_verified boolean
);

create table public.reverse_trial_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null default 'server',
  metadata jsonb not null default '{}'::jsonb
);

create table public.account_deletion_barriers (
  user_id uuid primary key
);

create table public.edge_rate_limits (
  scope text not null,
  key_hash text not null,
  owner_user_id uuid references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  window_seconds integer not null,
  request_count integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
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
  )
);

create or replace function public.purge_expired_edge_rate_limits(p_limit integer)
returns integer
language sql
security definer
set search_path = ''
as $$
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
  select count(*)::integer from deleted;
$$;

-- Effective pre-0053 operational read ACL retained by migrations 0050/0051.
grant select on table public.entitlements, public.reverse_trial_grants
  to service_role;

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

create or replace function public.account_write_allowed(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
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

\ir ../../supabase/migrations/20260713000041_revenuecat_webhook_atomic_projection.sql

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005'),
  ('10000000-0000-4000-8000-000000000006'),
  ('10000000-0000-4000-8000-000000000007'),
  ('10000000-0000-4000-8000-000000000008'),
  ('10000000-0000-4000-8000-000000000009'),
  ('10000000-0000-4000-8000-000000000010'),
  ('10000000-0000-4000-8000-000000000011');

-- User 1 is a historical local reverse trial that must move lanes. Its raw
-- status intentionally contains identifiers that must not survive recovery.
insert into public.entitlements (
  user_id, entitlement, is_active, product_id, expires_at, rc_event_id,
  updated_at, store, period_type, will_renew, original_purchase_at,
  offering_id, source, environment, package_id, store_user_id, raw_status
) values (
  '10000000-0000-4000-8000-000000000001', 'pro', true,
  'forbidden-product', now() + interval '4 days', 'forbidden-event', now(),
  'app_granted', 'reverse_trial', false, now() - interval '3 days',
  'forbidden-offering', 'app_granted', 'production', 'forbidden-package',
  'forbidden-revenuecat-user',
  '{"transaction_id":"forbidden-transaction"}'::jsonb
);

-- Users 2 and 3 model old store rows without trustworthy complete provider
-- order. User 3 has a partial tuple and must remain conservative.
insert into public.entitlements (
  user_id, entitlement, is_active, product_id, expires_at, rc_event_id,
  store, period_type, will_renew, source, environment, rc_event_at,
  rc_event_priority, store_user_id, raw_status
) values
  (
    '10000000-0000-4000-8000-000000000002', 'pro', true, 'legacy-product',
    now() + interval '30 days', null, 'app_store', 'normal', true,
    'revenuecat', 'production', null, null, 'foreign-legacy-unknown',
    '{"identity":"must-clear"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'pro', true, 'partial-product',
    now() + interval '30 days', null, 'app_store', 'normal', true,
    'revenuecat', 'production', '2026-07-01 00:00:00+00', 100,
    'foreign-legacy-partial', '{"identity":"must-clear"}'::jsonb
  );

-- User 4 has a complete trusted webhook tuple and an independent app grant.
insert into public.entitlements (
  user_id, entitlement, is_active, product_id, expires_at, rc_event_id,
  store, period_type, will_renew, source, environment, rc_event_at,
  rc_event_priority, store_user_id, raw_status
) values (
  '10000000-0000-4000-8000-000000000004', 'pro', true, 'store-product',
  now() + interval '30 days', 'ordered-seed', 'app_store', 'normal', true,
  'revenuecat', 'production', clock_timestamp() - interval '1 minute', 100,
  'foreign-ordered', '{"identity":"must-clear"}'::jsonb
);
insert into public.reverse_trial_grants (
  user_id, granted_at, expires_at, source, metadata
) values (
  '10000000-0000-4000-8000-000000000004', now() - interval '1 day',
  now() + interval '6 days', 'legacy-writer',
  '{"environment":"development","transaction_id":"must-disappear"}'::jsonb
);

-- User 5 proves that an exact matching audit row may recover missing tuple
-- fields without substituting processing, verification, or migration clocks.
insert into public.subscriptions_events (
  rc_event_id, user_id, event_type, payload, received_at, resolved_user_id,
  provider_event_at, projection_priority, processing_status
) values (
  'recoverable-event', '10000000-0000-4000-8000-000000000005', 'RENEWAL',
  '{}'::jsonb, '2026-07-05 00:00:05+00',
  '10000000-0000-4000-8000-000000000005',
  '2026-07-05 00:00:00+00', 100, 'processed'
);
insert into public.entitlements (
  user_id, entitlement, is_active, product_id, expires_at, rc_event_id,
  store, period_type, will_renew, source, environment
) values (
  '10000000-0000-4000-8000-000000000005', 'pro', true,
  'recovered-product', now() + interval '30 days', 'recoverable-event',
  'app_store', 'normal', true, 'revenuecat', 'production'
);

-- User 9 is a provider promotional written by the old mapper as app_granted.
-- User 10 is an unclassifiable local-shaped row and must be quarantined, not
-- promoted. User 11 proves a source-null historical provider row is normalized
-- into the RC-only table but remains fail-closed without a complete cursor.
insert into public.subscriptions_events (
  rc_event_id, user_id, event_type, payload, received_at, resolved_user_id,
  environment, store, product_id, processing_status, provider_event_at,
  projection_priority
) values (
  'historical-provider-promo',
  '10000000-0000-4000-8000-000000000009',
  'INITIAL_PURCHASE',
  '{"event":{"store":"PROMOTIONAL"}}'::jsonb,
  '2026-07-06 00:00:01+00',
  '10000000-0000-4000-8000-000000000009',
  'PRODUCTION', 'app_granted', 'rc_promo_pro_monthly', 'processed',
  '2026-07-06 00:00:00+00', 100
);
insert into public.entitlements (
  user_id, entitlement, is_active, product_id, expires_at, rc_event_id,
  store, period_type, will_renew, source, environment, rc_event_at,
  rc_event_priority, raw_status
) values
  (
    '10000000-0000-4000-8000-000000000009', 'pro', true,
    'rc_promo_pro_monthly', now() + interval '30 days',
    'historical-provider-promo', 'app_granted', 'normal', false,
    'revenuecat', 'production', '2026-07-06 00:00:00+00', 100,
    '{"provider":"revenuecat"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000010', 'pro', true,
    'unclassifiable-local-shape', now() + interval '30 days',
    'untrusted-local-event', 'app_granted', 'mystery', false,
    'app_granted', 'production', '2026-07-07 00:00:00+00', 100,
    '{"identity":"must-clear"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000011', 'pro', true,
    'source-null-legacy', now() + interval '30 days', null,
    'app_store', 'normal', true, null, 'production', null, null,
    '{}'::jsonb
  );

\ir ../../supabase/migrations/20260714000053_entitlement_authority_lanes.sql

-- The Edge caller's exact new scope must reach the inherited 0052 five-arg
-- wrapper instead of failing every reconciliation as EDGE_RATE_LIMIT_INVALID.
do $$
declare
  v_first boolean;
  v_second boolean;
  v_third boolean;
  v_key text := repeat('a', 64);
begin
  v_first := public._consume_edge_rate_limit_v0048_unbound(
    'subscription-reconciliation', v_key, 2, 300,
    '10000000-0000-4000-8000-000000000011'
  );
  v_second := public._consume_edge_rate_limit_v0048_unbound(
    'subscription-reconciliation', v_key, 2, 300,
    '10000000-0000-4000-8000-000000000011'
  );
  v_third := public._consume_edge_rate_limit_v0048_unbound(
    'subscription-reconciliation', v_key, 2, 300,
    '10000000-0000-4000-8000-000000000011'
  );
  if not v_first
     or not v_second
     or v_third
     or not exists (
       select 1
         from public.edge_rate_limits as limits
        where limits.scope = 'subscription-reconciliation'
          and limits.owner_user_id = '10000000-0000-4000-8000-000000000011'
          and limits.request_count = 3
     ) then
    raise exception 'REHEARSAL_RECONCILIATION_RATE_LIMIT_FAILED';
  end if;
end;
$$;

insert into public.account_deletion_barriers (user_id)
values ('10000000-0000-4000-8000-000000000011');
do $$
begin
  perform public._consume_edge_rate_limit_v0048_unbound(
    'subscription-reconciliation', repeat('b', 64), 2, 300,
    '10000000-0000-4000-8000-000000000011'
  );
  raise exception 'REHEARSAL_DELETION_RATE_LIMIT_UNEXPECTEDLY_ALLOWED';
exception
  when insufficient_privilege then
    if sqlerrm not like '%EDGE_RATE_LIMIT_ACCOUNT_OWNER_NOT_ACTIVE%' then
      raise;
    end if;
end;
$$;
delete from public.account_deletion_barriers
 where user_id = '10000000-0000-4000-8000-000000000011';

-- Reproduce migration 0051's foreign-identity privacy scrub against every
-- cursor state. It must clear identities/status without changing authority.
insert into public.entitlements (
  user_id, entitlement, is_active, product_id, updated_at, source,
  environment, store_user_id, raw_status, rc_cursor_state, rc_snapshot_at,
  rc_snapshot_fingerprint
) values (
  '10000000-0000-4000-8000-000000000008', 'pro', false,
  'snapshot-scrub-product', now(), 'revenuecat', 'production',
  'foreign-snapshot', '{"identity":"must-clear"}'::jsonb, 'snapshot',
  '2026-07-13 00:00:00+00', 'md5:00000000000000000000000000000000'
);

do $$
declare
  v_updated integer;
begin
  update public.entitlements as entitlements
     set store_user_id = null,
         raw_status = '{}'::jsonb,
         updated_at = clock_timestamp()
   where entitlements.user_id in (
     '10000000-0000-4000-8000-000000000003',
     '10000000-0000-4000-8000-000000000004',
     '10000000-0000-4000-8000-000000000008'
   );
  get diagnostics v_updated = row_count;
  if v_updated <> 3
     or exists (
       select 1
         from public.entitlements
        where user_id in (
          '10000000-0000-4000-8000-000000000003',
          '10000000-0000-4000-8000-000000000004',
          '10000000-0000-4000-8000-000000000008'
        )
          and (store_user_id is not null or raw_status <> '{}'::jsonb)
     )
     or not exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000003'
          and rc_cursor_state = 'legacy_unknown'
     )
     or not exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000004'
          and rc_cursor_state = 'ordered'
          and rc_event_id = 'ordered-seed'
     )
     or not exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000008'
          and rc_cursor_state = 'snapshot'
          and rc_snapshot_at = '2026-07-13 00:00:00+00'
     ) then
    raise exception 'REHEARSAL_0051_PRIVACY_SCRUB_COMPATIBILITY_FAILED';
  end if;
end;
$$;

create or replace function public.rehearsal_revenuecat_event(
  p_user_id uuid,
  p_event_id text,
  p_provider_at timestamptz,
  p_priority integer,
  p_is_active boolean,
  p_product_id text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_outcome text;
begin
  select event_result.outcome
    into v_outcome
    from public.process_revenuecat_webhook_event(
      p_event_id,
      case when p_is_active then 'RENEWAL' else 'EXPIRATION' end,
      array[p_user_id::text],
      p_user_id::text,
      p_user_id::text,
      null,
      null,
      null,
      'PRODUCTION',
      'APP_STORE',
      p_product_id,
      'pro',
      case when p_is_active then p_provider_at + interval '30 days' else p_provider_at end,
      p_provider_at - interval '30 days',
      p_provider_at,
      p_provider_at + interval '1 second',
      'original-' || p_event_id,
      'transaction-' || p_event_id,
      'NORMAL',
      p_is_active,
      p_is_active,
      true,
      p_priority::smallint,
      'default',
      pg_catalog.jsonb_build_object(
        'event', pg_catalog.jsonb_build_object('id', p_event_id)
      ),
      true,
      true
    ) as event_result;
  return v_outcome;
end;
$$;

-- Recovery separates the authorities and minimizes every app-grant record.
do $$
begin
  if exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000001'
     )
     or not exists (
       select 1
         from public.reverse_trial_grants
        where user_id = '10000000-0000-4000-8000-000000000001'
          and source = 'server'
          and metadata = '{"action":"start_reverse_trial","environment":"production"}'::jsonb
     )
     or not exists (
       select 1
         from public.reverse_trial_grants
        where user_id = '10000000-0000-4000-8000-000000000004'
          and source = 'server'
          and metadata = '{"action":"start_reverse_trial","environment":"development"}'::jsonb
     ) then
    raise exception 'REHEARSAL_APP_GRANT_RECOVERY_FAILED';
  end if;
end;
$$;

-- Complete audit evidence is recoverable; missing and partial tuples are not.
do $$
begin
  if not exists (
       select 1
         from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000005'
          and rc_cursor_state = 'ordered'
          and rc_event_at = '2026-07-05 00:00:00+00'
          and rc_event_priority = 100
     )
     or not exists (
       select 1
         from public.entitlements
        where user_id in (
          '10000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000003'
        )
          and rc_cursor_state = 'legacy_unknown'
        group by rc_cursor_state
       having count(*) = 2
     ) then
    raise exception 'REHEARSAL_LEGACY_CURSOR_CLASSIFICATION_FAILED';
  end if;
end;
$$;

-- Historical authority normalization is loss-averse and fail-closed.
do $$
begin
  if not exists (
       select 1
         from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000009'
          and source = 'revenuecat'
          and store = 'promotional'
          and rc_cursor_state = 'ordered'
     )
     or not exists (
       select 1
         from public.subscriptions_events
        where rc_event_id = 'historical-provider-promo'
          and store = 'promotional'
     )
     or not exists (
       select 1
         from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000010'
          and source = 'revenuecat'
          and store is null
          and not is_active
          and rc_cursor_state = 'legacy_unknown'
          and store_user_id is null
          and raw_status = '{}'::jsonb
     )
     or not exists (
       select 1
         from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000011'
          and source = 'revenuecat'
          and rc_cursor_state = 'legacy_unknown'
     )
     or exists (
       select 1
         from public.entitlements
        where source <> 'revenuecat' or store = 'app_granted'
     ) then
    raise exception 'REHEARSAL_HISTORICAL_AUTHORITY_NORMALIZATION_FAILED';
  end if;
end;
$$;

-- Authenticated reads derive the owner and return exactly one two-lane object.
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000004';
do $$
declare
  v_projection jsonb := public.read_entitlement_projections();
begin
  if v_projection ->> 'schema_version' <> '1'
     or v_projection -> 'store_projection' ->> 'state' <> 'active'
     or v_projection -> 'store_projection' -> 'row' ->> 'product_id' <> 'store-product'
     or v_projection -> 'store_projection' -> 'row' ->> 'source' <> 'revenuecat'
     or v_projection -> 'app_grant_projection' ->> 'state' <> 'active'
     or v_projection -> 'app_grant_projection' -> 'row' ->> 'source' <> 'app_granted'
     or v_projection -> 'app_grant_projection' -> 'row' -> 'cursor' <> 'null'::jsonb
     or v_projection -> 'app_grant_projection' -> 'row' -> 'product_id' <> 'null'::jsonb
     or v_projection -> 'store_projection' -> 'row' ? 'user_id'
     or v_projection -> 'app_grant_projection' -> 'row' ? 'user_id' then
    raise exception 'REHEARSAL_AUTHENTICATED_READ_ENVELOPE_FAILED';
  end if;
end;
$$;

set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
do $$
declare
  v_projection jsonb := public.read_entitlement_projections();
begin
  if v_projection -> 'store_projection' ->> 'state' <> 'legacy_unknown'
     or (v_projection -> 'store_projection' -> 'row' ->> 'is_active')::boolean
     or v_projection -> 'app_grant_projection' ->> 'state' <> 'absent'
     or v_projection -> 'app_grant_projection' -> 'row' <> 'null'::jsonb
     or v_projection::text like '%store-product%' then
    raise exception 'REHEARSAL_LEGACY_OR_CROSS_OWNER_READ_FAILED';
  end if;
end;
$$;

reset role;

set role anon;
do $$
begin
  perform public.read_entitlement_projections();
  raise exception 'REHEARSAL_ANON_READ_UNEXPECTEDLY_ALLOWED';
exception
  when insufficient_privilege then null;
end;
$$;

reset role;
set role service_role;
do $$
declare
  v_equal_at timestamptz;
begin
  begin
    perform public.reconcile_revenuecat_entitlement_snapshot(
      '10000000-0000-4000-8000-000000000007',
      '2026-07-13 00:00:01+00',
      null, true, 'active-without-tier', '2026-08-13 00:00:00+00',
      'app_store', 'normal', true, '2026-07-13 00:00:00+00',
      null, 'production', null, null
    );
    raise exception 'REHEARSAL_NULL_ACTIVE_TIER_UNEXPECTEDLY_ALLOWED';
  exception
    when others then
      if sqlerrm not like '%INVALID_REVENUECAT_SNAPSHOT%' then
        raise;
      end if;
  end;

  begin
    perform public.reconcile_revenuecat_entitlement_snapshot(
      '10000000-0000-4000-8000-000000000007',
      '2026-07-13 00:00:01+00',
      'pro', false, null, null, 'app_granted', 'promotional', false, null,
      null, 'production', null, null
    );
    raise exception 'REHEARSAL_APP_GRANTED_SNAPSHOT_STORE_UNEXPECTEDLY_ALLOWED';
  exception
    when others then
      if sqlerrm not like '%INVALID_REVENUECAT_SNAPSHOT%' then
        raise;
      end if;
  end;

  begin
    select rc_event_at into v_equal_at
      from public.entitlements
     where user_id = '10000000-0000-4000-8000-000000000004';
    perform public.reconcile_revenuecat_entitlement_snapshot(
      '10000000-0000-4000-8000-000000000004',
      v_equal_at,
      'pro', true, 'same-time-snapshot', v_equal_at + interval '30 days',
      'app_store', 'normal', true, v_equal_at - interval '30 days',
      null, 'production', null, null
    );
    raise exception 'REHEARSAL_EQUAL_ORDERED_SNAPSHOT_UNEXPECTEDLY_ALLOWED';
  exception
    when others then
      if sqlerrm not like '%REVENUECAT_SNAPSHOT_CURSOR_CONFLICT%' then
        raise;
      end if;
  end;
end;
$$;
reset role;

-- The app grant is durable only in reverse_trial_grants. The compatibility row
-- contains no provider event, transaction, store-user, offering, or package id.
set role service_role;
do $$
declare
  v_row public.entitlements%rowtype;
begin
  select grant_row.* into v_row
    from public.grant_app_granted_reverse_trial(
      '10000000-0000-4000-8000-000000000006',
      now() + interval '7 days',
      'production'
    ) as grant_row;
  if v_row.user_id is null
     or v_row.product_id is not null
     or v_row.rc_event_id is not null
     or v_row.offering_id is not null
     or v_row.package_id is not null
     or v_row.store_user_id is not null
     or v_row.rc_event_at is not null
     or v_row.rc_event_priority is not null
     or v_row.rc_original_transaction_id is not null
     or v_row.rc_transaction_id is not null
     or v_row.rc_snapshot_at is not null
     or v_row.rc_snapshot_fingerprint is not null
     or exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000006'
     )
     or not exists (
       select 1
         from public.reverse_trial_grants
        where user_id = '10000000-0000-4000-8000-000000000006'
          and metadata = '{"action":"start_reverse_trial","environment":"production"}'::jsonb
     ) then
    raise exception 'REHEARSAL_APP_GRANT_LANE_OR_DATA_MINIMIZATION_FAILED';
  end if;
end;
$$;

do $$
begin
  perform public.grant_app_granted_reverse_trial(
    '10000000-0000-4000-8000-000000000004',
    now() + interval '7 days',
    'production'
  );
  raise exception 'REHEARSAL_ACTIVE_STORE_GRANT_UNEXPECTEDLY_ALLOWED';
exception
  when others then
    if sqlerrm not like '%ACTIVE_SUBSCRIPTION_EXISTS%'
       and sqlerrm not like '%REVERSE_TRIAL_ALREADY_USED%' then
      raise;
    end if;
end;
$$;

do $$
begin
  perform public.grant_app_granted_reverse_trial(
    '10000000-0000-4000-8000-000000000003',
    now() + interval '7 days',
    'production'
  );
  raise exception 'REHEARSAL_LEGACY_STORE_GRANT_UNEXPECTEDLY_ALLOWED';
exception
  when others then
    if sqlerrm not like '%STORE_ENTITLEMENT_RECONCILIATION_REQUIRED%' then
      raise;
    end if;
end;
$$;
reset role;

-- A delayed but legitimate expiration cannot order itself against a legacy
-- row. Reconciliation exits legacy_unknown using provider request_date only.
do $$
declare
  v_outcome text;
begin
  v_outcome := public.rehearsal_revenuecat_event(
    '10000000-0000-4000-8000-000000000002',
    'legacy-delayed-expiration',
    '2026-07-11 00:00:00+00',
    300,
    false,
    'legacy-product'
  );
  if v_outcome <> 'stale'
     or not exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000002'
          and rc_cursor_state = 'legacy_unknown'
          and is_active
     ) then
    raise exception 'REHEARSAL_LEGACY_WEBHOOK_FAIL_CLOSED_FAILED';
  end if;
end;
$$;

set role service_role;
do $$
declare
  v_result text;
  v_snapshot_at timestamptz := clock_timestamp();
begin
  v_result := public.reconcile_revenuecat_entitlement_snapshot(
    '10000000-0000-4000-8000-000000000002',
    v_snapshot_at,
    'pro', false, 'snapshot-product', v_snapshot_at - interval '1 day',
    'app_store', 'normal', false, v_snapshot_at - interval '30 days',
    'default', 'production', 'https://apps.apple.com/account/subscriptions',
    'monthly'
  );
  if v_result <> 'reconciled_snapshot' then
    raise exception 'REHEARSAL_SNAPSHOT_RECONCILIATION_FAILED';
  end if;
end;
$$;
reset role;

-- Events covered by the provider snapshot are stale. A strictly later event
-- resumes exact (time, priority, UTF-8 event-id) ordering.
do $$
declare
  v_outcome text;
  v_snapshot_at timestamptz;
begin
  select rc_snapshot_at into v_snapshot_at
    from public.entitlements
   where user_id = '10000000-0000-4000-8000-000000000002';
  v_outcome := public.rehearsal_revenuecat_event(
    '10000000-0000-4000-8000-000000000002',
    'snapshot-covered-expiration',
    v_snapshot_at,
    300,
    false,
    'covered-product'
  );
  if v_outcome <> 'stale' then
    raise exception 'REHEARSAL_SNAPSHOT_WATERMARK_FAILED';
  end if;

  v_outcome := public.rehearsal_revenuecat_event(
    '10000000-0000-4000-8000-000000000002',
    'b-later-renewal',
    v_snapshot_at + interval '1 second',
    100,
    true,
    'later-product'
  );
  if v_outcome <> 'processed' then
    raise exception 'REHEARSAL_POST_SNAPSHOT_TRANSITION_FAILED';
  end if;

  v_outcome := public.rehearsal_revenuecat_event(
    '10000000-0000-4000-8000-000000000002',
    'a-priority-expiration',
    v_snapshot_at + interval '1 second',
    300,
    false,
    'priority-product'
  );
  if v_outcome <> 'processed' then
    raise exception 'REHEARSAL_EQUAL_TIME_PRIORITY_ORDER_FAILED';
  end if;

  v_outcome := public.rehearsal_revenuecat_event(
    '10000000-0000-4000-8000-000000000002',
    'z-priority-expiration',
    v_snapshot_at + interval '1 second',
    300,
    false,
    'bytewise-winner'
  );
  if v_outcome <> 'processed' then
    raise exception 'REHEARSAL_EQUAL_TUPLE_EVENT_ID_ORDER_FAILED';
  end if;

  v_outcome := public.rehearsal_revenuecat_event(
    '10000000-0000-4000-8000-000000000002',
    'y-priority-expiration',
    v_snapshot_at + interval '1 second',
    300,
    true,
    'bytewise-loser'
  );
  if v_outcome <> 'stale'
     or not exists (
       select 1 from public.entitlements
        where user_id = '10000000-0000-4000-8000-000000000002'
          and rc_cursor_state = 'ordered'
          and rc_event_id = 'z-priority-expiration'
          and product_id = 'bytewise-winner'
     ) then
    raise exception 'REHEARSAL_STALE_EVENT_ID_FAILED';
  end if;
end;
$$;

-- Equal provider request_date with different state is a conflict, not an
-- arbitrary last writer; identical replay is a stable duplicate.
set role service_role;
do $$
declare
  v_result text;
  v_snapshot_at timestamptz := clock_timestamp();
begin
  v_result := public.reconcile_revenuecat_entitlement_snapshot(
    '10000000-0000-4000-8000-000000000007',
    v_snapshot_at,
    null, false, null, null, null, null, false, null,
    null, 'production', null, null
  );
  v_result := public.reconcile_revenuecat_entitlement_snapshot(
    '10000000-0000-4000-8000-000000000007',
    v_snapshot_at,
    null, false, null, null, null, null, false, null,
    null, 'production', null, null
  );
  if v_result <> 'duplicate_snapshot' then
    raise exception 'REHEARSAL_DUPLICATE_SNAPSHOT_FAILED';
  end if;

  begin
    perform public.reconcile_revenuecat_entitlement_snapshot(
      '10000000-0000-4000-8000-000000000007',
      v_snapshot_at,
      'pro', true, 'conflict-product', v_snapshot_at + interval '30 days',
      'app_store', 'normal', true, v_snapshot_at - interval '1 day',
      null, 'production', null, null
    );
    raise exception 'REHEARSAL_CONFLICTING_SNAPSHOT_UNEXPECTEDLY_ALLOWED';
  exception
    when others then
      if sqlerrm not like '%REVENUECAT_SNAPSHOT_CONFLICT%' then
        raise;
      end if;
  end;
end;
$$;
reset role;

select 'ENTITLEMENT_AUTHORITY_LANES_POSTGRES_REHEARSAL_PASS' as result;
