-- =============================================================================
-- RevenueCat webhook: deletion-barrier serialization and identity suppression
-- =============================================================================
-- The Edge Function is not authoritative for account identity or lock order.
-- This guarded transaction independently extracts every exact UUID from all
-- structured identity inputs, locks those accounts in global order, excludes
-- missing/barred accounts, and only then delegates to the existing atomic event
-- and projection implementation while the transaction locks remain held.

begin;

create or replace function public._revenuecat_exact_account_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  with normalized as (
    select pg_catalog.btrim(p_value, E' \t\n\r\f\013') as value
  )
  select case
    when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then pg_catalog.lower(value)::uuid
    else null
  end
  from normalized;
$$;

revoke all on function public._revenuecat_exact_account_uuid(text)
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_identity_contains_account_uuid(
  p_value text,
  p_account_ids uuid[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
        from unnest(coalesce(p_account_ids, '{}'::uuid[])) as account(account_id)
       where pg_catalog.strpos(
         pg_catalog.lower(p_value),
         account.account_id::text
       ) > 0
    ),
    false
  );
$$;

revoke all on function public._revenuecat_identity_contains_account_uuid(text, uuid[])
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_filter_identity_scalar(
  p_value text,
  p_active_account_ids uuid[],
  p_inactive_account_ids uuid[]
)
returns text
language sql
immutable
set search_path = ''
as $$
  with identity as (
    select public._revenuecat_exact_account_uuid(p_value) as account_id
  )
  select case
    when p_value is null then null
    when identity.account_id is not null then
      case
        when identity.account_id = any(coalesce(p_active_account_ids, '{}'::uuid[]))
          then identity.account_id::text
        else null
      end
    when public._revenuecat_identity_contains_account_uuid(
      p_value,
      p_inactive_account_ids
    ) then null
    else p_value
  end
  from identity;
$$;

revoke all on function public._revenuecat_filter_identity_scalar(text, uuid[], uuid[])
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_filter_identity_array(
  p_values text[],
  p_active_account_ids uuid[],
  p_inactive_account_ids uuid[]
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with filtered as (
    select public._revenuecat_filter_identity_scalar(
      item.value,
      p_active_account_ids,
      p_inactive_account_ids
    ) as value
      from unnest(coalesce(p_values, '{}'::text[])) as item(value)
  ), unique_values as (
    select distinct value
      from filtered
     where value is not null
  )
  select nullif(
    pg_catalog.array_agg(value order by value),
    '{}'::text[]
  )
    from unique_values;
$$;

revoke all on function public._revenuecat_filter_identity_array(text[], uuid[], uuid[])
  from public, anon, authenticated, service_role;

create or replace function public.process_revenuecat_webhook_event_guarded(
  p_rc_event_id text,
  p_event_type text,
  p_user_candidates text[],
  p_app_user_id text,
  p_original_app_user_id text,
  p_aliases text[],
  p_transferred_from text[],
  p_transferred_to text[],
  p_environment text,
  p_store text,
  p_product_id text,
  p_entitlement text,
  p_expiration_at timestamptz,
  p_original_purchase_at timestamptz,
  p_provider_event_at timestamptz,
  p_received_at timestamptz,
  p_original_transaction_id text,
  p_transaction_id text,
  p_period_type text,
  p_will_renew boolean,
  p_is_active boolean,
  p_should_project boolean,
  p_projection_priority smallint,
  p_offering_id text,
  p_payload jsonb,
  p_signature_verified boolean,
  p_auth_verified boolean
)
returns table (
  outcome text,
  projection_applied boolean,
  processing_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_all_account_ids uuid[] := '{}'::uuid[];
  v_active_account_ids uuid[] := '{}'::uuid[];
  v_inactive_account_ids uuid[] := '{}'::uuid[];
  v_semantic_user_candidates text[] := '{}'::text[];
  v_app_user_id text;
  v_original_app_user_id text;
  v_aliases text[];
  v_transferred_from text[];
  v_transferred_to text[];
  v_event_type text;
begin
  v_event_type := pg_catalog.upper(
    pg_catalog.btrim(p_event_type, E' \t\n\r\f\013')
  );

  -- Preserve the old atomic boundary's required-event validation even when an
  -- all-deleted event is suppressed before reaching that implementation.
  if p_rc_event_id is null
     or length(pg_catalog.btrim(p_rc_event_id)) = 0
     or length(p_rc_event_id) > 255
     or v_event_type is null
     or length(v_event_type) = 0
     or length(v_event_type) > 100
     or p_provider_event_at is null
     or p_received_at is null then
    raise exception using errcode = '22023', message = 'INVALID_REVENUECAT_EVENT';
  end if;

  if p_should_project is null
     or p_is_active is null
     or p_will_renew is null
     or (
       p_should_project
       and (
         p_projection_priority is null
         or p_projection_priority not in (100, 200, 300)
       )
     ) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_REVENUECAT_ORDER_PRIORITY';
  end if;

  -- JSON null at the field level means absent. Null/empty array members and
  -- non-null empty scalars are malformed because silently discarding them can
  -- make the database and Edge candidate sets disagree.
  if (
       p_app_user_id is not null
       and pg_catalog.btrim(p_app_user_id, E' \t\n\r\f\013') = ''
     )
     or (
       p_original_app_user_id is not null
       and pg_catalog.btrim(p_original_app_user_id, E' \t\n\r\f\013') = ''
     )
     or exists (
       select 1
         from unnest(
           coalesce(p_user_candidates, '{}'::text[])
           || coalesce(p_aliases, '{}'::text[])
           || coalesce(p_transferred_from, '{}'::text[])
           || coalesce(p_transferred_to, '{}'::text[])
         ) as identity(value)
        where identity.value is null
           or pg_catalog.btrim(identity.value, E' \t\n\r\f\013') = ''
     ) then
    raise exception using
      errcode = '22023',
      message = 'INVALID_REVENUECAT_IDENTITY_SHAPE';
  end if;

  -- Candidate extraction is intentionally repeated in SQL. p_user_candidates
  -- participates in locking/classification, but is never trusted for semantic
  -- resolution; the latter is rebuilt from filtered structured fields below.
  with raw_identities(value) as (
    values (p_app_user_id), (p_original_app_user_id)
    union all
    select identity.value
      from unnest(
        coalesce(p_user_candidates, '{}'::text[])
        || coalesce(p_aliases, '{}'::text[])
        || coalesce(p_transferred_from, '{}'::text[])
        || coalesce(p_transferred_to, '{}'::text[])
      ) as identity(value)
  ), exact_account_ids as (
    select distinct public._revenuecat_exact_account_uuid(value) as account_id
      from raw_identities
  )
  select coalesce(
    pg_catalog.array_agg(account_id order by account_id::text),
    '{}'::uuid[]
  )
    into v_all_account_ids
    from exact_account_ids
   where account_id is not null;

  -- The sorted array is the only lock loop, preventing opposite transfer
  -- directions or alias order from creating inconsistent lock acquisition.
  foreach v_account_id in array v_all_account_ids loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._account_deletion_advisory_key(v_account_id)
    );
  end loop;

  select coalesce(
    pg_catalog.array_agg(candidate.account_id order by candidate.account_id::text),
    '{}'::uuid[]
  )
    into v_active_account_ids
    from unnest(v_all_account_ids) as candidate(account_id)
   where exists (
     select 1
       from auth.users as users
      where users.id = candidate.account_id
   )
     and not exists (
       select 1
         from public.account_deletion_barriers as barriers
        where barriers.user_id = candidate.account_id
     );

  select coalesce(
    pg_catalog.array_agg(candidate.account_id order by candidate.account_id::text),
    '{}'::uuid[]
  )
    into v_inactive_account_ids
    from unnest(v_all_account_ids) as candidate(account_id)
   where not (candidate.account_id = any(v_active_account_ids));

  if pg_catalog.cardinality(v_all_account_ids) > 0
     and pg_catalog.cardinality(v_active_account_ids) = 0 then
    return query
      select
        'suppressed_deleted_account'::text,
        false,
        'suppressed_deleted_account'::text;
    return;
  end if;

  v_app_user_id := public._revenuecat_filter_identity_scalar(
    p_app_user_id,
    v_active_account_ids,
    v_inactive_account_ids
  );
  v_original_app_user_id := public._revenuecat_filter_identity_scalar(
    p_original_app_user_id,
    v_active_account_ids,
    v_inactive_account_ids
  );
  v_aliases := public._revenuecat_filter_identity_array(
    p_aliases,
    v_active_account_ids,
    v_inactive_account_ids
  );
  v_transferred_from := public._revenuecat_filter_identity_array(
    p_transferred_from,
    v_active_account_ids,
    v_inactive_account_ids
  );
  v_transferred_to := public._revenuecat_filter_identity_array(
    p_transferred_to,
    v_active_account_ids,
    v_inactive_account_ids
  );

  -- Rebuild the only owner-resolution list from live structured UUIDs. Transfer
  -- destinations take precedence over app_user_id, original_app_user_id, and
  -- aliases. transferred_from and anonymous provider values remain audit-only.
  with semantic_candidates as (
    select public._revenuecat_exact_account_uuid(item.value) as account_id,
           1::bigint as group_order,
           item.ordinality as item_order
      from unnest(coalesce(v_transferred_to, '{}'::text[]))
        with ordinality as item(value, ordinality)
     where v_event_type = 'TRANSFER'
    union all
    select public._revenuecat_exact_account_uuid(v_app_user_id), 2::bigint, 1::bigint
    union all
    select public._revenuecat_exact_account_uuid(v_original_app_user_id), 3::bigint, 1::bigint
    union all
    select public._revenuecat_exact_account_uuid(item.value),
           4::bigint,
           item.ordinality
      from unnest(coalesce(v_aliases, '{}'::text[]))
        with ordinality as item(value, ordinality)
  ), first_seen as (
    select account_id,
           min(group_order * 1000000 + item_order) as first_order
      from semantic_candidates
     where account_id is not null
     group by account_id
  )
  select coalesce(
    pg_catalog.array_agg(account_id::text order by first_order, account_id::text),
    '{}'::text[]
  )
    into v_semantic_user_candidates
    from first_seen;

  return query
    select atomic.outcome,
           atomic.projection_applied,
           atomic.processing_status
      from public.process_revenuecat_webhook_event(
        p_rc_event_id,
        v_event_type,
        v_semantic_user_candidates,
        v_app_user_id,
        v_original_app_user_id,
        v_aliases,
        v_transferred_from,
        v_transferred_to,
        p_environment,
        p_store,
        p_product_id,
        p_entitlement,
        p_expiration_at,
        p_original_purchase_at,
        p_provider_event_at,
        p_received_at,
        p_original_transaction_id,
        p_transaction_id,
        p_period_type,
        p_will_renew,
        p_is_active,
        p_should_project,
        p_projection_priority,
        p_offering_id,
        p_payload,
        p_signature_verified,
        p_auth_verified
      ) as atomic;
end;
$$;

comment on function public.process_revenuecat_webhook_event_guarded(
  text,
  text,
  text[],
  text,
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  smallint,
  text,
  jsonb,
  boolean,
  boolean
) is 'Serializes every exact RevenueCat account UUID against deletion, strips inactive identities, suppresses all-inactive events, and calls the atomic projection while locks remain held.';

-- The unguarded implementation is now an owner-private delegate. Edge/service
-- callers can enter only through the deletion-aware transaction above.
revoke all on function public.process_revenuecat_webhook_event(
  text,
  text,
  text[],
  text,
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  smallint,
  text,
  jsonb,
  boolean,
  boolean
) from public, anon, authenticated, service_role;

revoke all on function public.process_revenuecat_webhook_event_guarded(
  text,
  text,
  text[],
  text,
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  smallint,
  text,
  jsonb,
  boolean,
  boolean
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_webhook_event_guarded(
  text,
  text,
  text[],
  text,
  text,
  text[],
  text[],
  text[],
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  smallint,
  text,
  jsonb,
  boolean,
  boolean
) to service_role;

commit;
