-- =============================================================================
-- RevenueCat deletion: opaque-identity tombstones and guarded webhook ingress
-- =============================================================================
-- A complete RevenueCat v2 preflight family is transiently presented to the
-- establishment RPC while its keyed HMACs alone are retained. Webhook ingress
-- presents aligned HMAC lookup candidates for every configured key version;
-- the database strips/suppresses matches while holding the same account locks
-- used by deletion. Raw provider aliases never enter the tombstone table.
--
-- The 825-day maximum below is an engineering ceiling, not an approved
-- production retention policy. Launch remains blocked until RevenueCat has
-- confirmed the relevant alias/restore/recreation lifecycle and privacy
-- counsel has approved a finite duration, old-key overlap, and purge schedule.

begin;

create table public.revenuecat_identity_tombstones (
  hmac_key_version smallint not null
    check (hmac_key_version between 1 and 32767),
  identity_hmac text not null
    check (identity_hmac ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (hmac_key_version, identity_hmac),
  check (
    pg_catalog.isfinite(created_at)
    and pg_catalog.isfinite(expires_at)
    and expires_at > created_at
    and expires_at <= created_at + interval '825 days'
  )
);

alter table public.revenuecat_identity_tombstones enable row level security;
alter table public.revenuecat_identity_tombstones force row level security;
revoke all on table public.revenuecat_identity_tombstones
  from public, anon, authenticated, service_role;

create index revenuecat_identity_tombstones_expiry_idx
  on public.revenuecat_identity_tombstones (expires_at, hmac_key_version, identity_hmac);

create or replace function public._revenuecat_identity_tombstone_advisory_key(
  p_hmac_key_version smallint,
  p_identity_hmac text
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.hashtextextended(
    'onskin/revenuecat-identity-tombstone-lock/v1:'
      || p_hmac_key_version::text || ':' || p_identity_hmac,
    732841906512317::bigint
  );
$$;

revoke all on function public._revenuecat_identity_tombstone_advisory_key(smallint, text)
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_embedded_account_uuids(p_value text)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  with matches as (
    select distinct captures.value[1]::uuid as account_id
      from pg_catalog.regexp_matches(
        pg_catalog.lower(coalesce(p_value, '')),
        '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
        'g'
      ) as captures(value)
  )
  select coalesce(
    pg_catalog.array_agg(account_id order by account_id::text),
    '{}'::uuid[]
  )
    from matches;
$$;

revoke all on function public._revenuecat_embedded_account_uuids(text)
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_identity_matches_family_v0051(
  p_value text,
  p_raw_identities text[],
  p_user_id uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is not null
    and (
      p_value = any(coalesce(p_raw_identities, '{}'::text[]))
      or pg_catalog.strpos(pg_catalog.lower(p_value), p_user_id::text) > 0
    );
$$;

revoke all on function public._revenuecat_identity_matches_family_v0051(text, text[], uuid)
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_remove_identity_family_v0051(
  p_values text[],
  p_raw_identities text[],
  p_user_id uuid
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select nullif(
    pg_catalog.array_agg(item.value order by item.ordinality)
      filter (
        where not public._revenuecat_identity_matches_family_v0051(
          item.value,
          p_raw_identities,
          p_user_id
        )
      ),
    '{}'::text[]
  )
    from unnest(coalesce(p_values, '{}'::text[]))
      with ordinality as item(value, ordinality);
$$;

revoke all on function public._revenuecat_remove_identity_family_v0051(text[], text[], uuid)
  from public, anon, authenticated, service_role;

create or replace function public._revenuecat_filter_identity_scalar_v0051(
  p_value text,
  p_active_account_ids uuid[],
  p_inactive_account_ids uuid[],
  p_tombstoned_values text[]
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
    when p_value = any(coalesce(p_tombstoned_values, '{}'::text[])) then null
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

revoke all on function public._revenuecat_filter_identity_scalar_v0051(
  text, uuid[], uuid[], text[]
) from public, anon, authenticated, service_role;

create or replace function public._revenuecat_filter_identity_array_v0051(
  p_values text[],
  p_active_account_ids uuid[],
  p_inactive_account_ids uuid[],
  p_tombstoned_values text[]
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with filtered as (
    select public._revenuecat_filter_identity_scalar_v0051(
      item.value,
      p_active_account_ids,
      p_inactive_account_ids,
      p_tombstoned_values
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

revoke all on function public._revenuecat_filter_identity_array_v0051(
  text[], uuid[], uuid[], text[]
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
  v_now timestamptz := clock_timestamp();
  v_operation public.account_deletion_operations%rowtype;
  v_operation_user_id uuid;
  v_step public.account_deletion_steps%rowtype;
  v_account_ids uuid[] := '{}'::uuid[];
  v_account_id uuid;
  v_raw_count integer := pg_catalog.cardinality(coalesce(p_raw_identities, '{}'::text[]));
  v_hash_count integer := pg_catalog.cardinality(coalesce(p_identity_hmacs, '{}'::text[]));
  v_lock_version smallint;
  v_lock_hmac text;
  v_residual_events bigint;
  v_residual_entitlements bigint;
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
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '825 days'
     or exists (
       select 1
         from unnest(p_identity_hmacs) as digest(value)
        where digest.value is null
           or digest.value !~ '^[a-f0-9]{64}$'
     )
     or exists (
       select 1
         from unnest(p_raw_identities) as identity(value)
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
     or (
       select count(distinct identity.value)
         from unnest(p_raw_identities) as identity(value)
     ) <> v_raw_count
     or (
       select count(distinct digest.value)
         from unnest(p_identity_hmacs) as digest(value)
     ) <> v_hash_count then
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
    pg_catalog.array_agg(account_id order by account_id::text),
    '{}'::uuid[]
  )
    into v_account_ids
    from all_account_ids;

  foreach v_account_id in array v_account_ids loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._account_deletion_advisory_key(v_account_id)
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

  if v_operation.id is null
     or v_operation.user_id is distinct from v_operation_user_id
     or not exists (
       select 1
         from public.account_deletion_barriers as barriers
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

  -- A RevenueCat alias family can cross account boundaries under some restore
  -- modes. Never tombstone an exact or embedded UUID that currently belongs to
  -- another Auth account; vendor/live evidence must resolve that ambiguity.
  if exists (
    select 1
      from unnest(v_account_ids) as candidate(account_id)
      join auth.users as users on users.id = candidate.account_id
     where candidate.account_id <> v_operation.user_id
  ) then
    raise exception 'REVENUECAT_IDENTITY_BARRIER_SHARED_LIVE_ACCOUNT'
      using errcode = '23514';
  end if;

  -- Opaque identities have no account UUID to serialize on. The same sorted
  -- keyed-HMAC lock set is acquired by webhook ingress, closing the otherwise
  -- possible insert-after-scrub race without retaining a raw provider alias.
  for v_lock_version, v_lock_hmac in
    select distinct p_identity_hmac_key_version, digest.value
      from unnest(p_identity_hmacs) as digest(value)
     order by p_identity_hmac_key_version, digest.value
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._revenuecat_identity_tombstone_advisory_key(
        v_lock_version,
        v_lock_hmac
      )
    );
  end loop;

  insert into public.revenuecat_identity_tombstones as tombstones (
    hmac_key_version,
    identity_hmac,
    created_at,
    expires_at
  )
  select p_identity_hmac_key_version,
         digest.value,
         v_now,
         p_expires_at
    from unnest(p_identity_hmacs) as digest(value)
  on conflict (hmac_key_version, identity_hmac) do update
    set expires_at = greatest(tombstones.expires_at, excluded.expires_at)
  where greatest(tombstones.expires_at, excluded.expires_at)
          <= tombstones.created_at + interval '825 days';

  if exists (
    select 1
      from unnest(p_identity_hmacs) as expected(identity_hmac)
      left join public.revenuecat_identity_tombstones as tombstones
        on tombstones.hmac_key_version = p_identity_hmac_key_version
       and tombstones.identity_hmac = expected.identity_hmac
     where tombstones.identity_hmac is null
        or tombstones.expires_at < p_expires_at
  ) then
    raise exception 'REVENUECAT_IDENTITY_BARRIER_RETENTION_CONFLICT'
      using errcode = '22023';
  end if;

  -- Remove account-only audit rows identified by any exact provider family
  -- member or by the deleting UUID embedded in a provider-generated alias.
  delete from public.subscriptions_events as events
   where (
     events.user_id = v_operation.user_id
     or events.resolved_user_id = v_operation.user_id
     or public._revenuecat_identity_matches_family_v0051(
       events.app_user_id, p_raw_identities, v_operation.user_id
     )
     or public._revenuecat_identity_matches_family_v0051(
       events.original_app_user_id, p_raw_identities, v_operation.user_id
     )
     or exists (
       select 1
         from unnest(
           coalesce(events.aliases, '{}'::text[])
           || coalesce(events.transferred_from, '{}'::text[])
           || coalesce(events.transferred_to, '{}'::text[])
         ) as identity(value)
        where public._revenuecat_identity_matches_family_v0051(
          identity.value, p_raw_identities, v_operation.user_id
        )
     )
   )
   and not exists (
     select 1
       from auth.users as other_user
      where other_user.id <> v_operation.user_id
        and (
          events.user_id = other_user.id
          or events.resolved_user_id = other_user.id
          or events.app_user_id = other_user.id::text
          or events.original_app_user_id = other_user.id::text
          or events.aliases @> array[other_user.id::text]
          or events.transferred_from @> array[other_user.id::text]
          or events.transferred_to @> array[other_user.id::text]
        )
   );

  -- Shared transfer/audit rows keep the other explicit live Auth owner and
  -- non-identity audit fields while every deleting-family identity is stripped.
  update public.subscriptions_events as events
     set user_id = case
           when events.user_id = v_operation.user_id then null
           else events.user_id
         end,
         resolved_user_id = case
           when events.resolved_user_id = v_operation.user_id then null
           else events.resolved_user_id
         end,
         app_user_id = case
           when public._revenuecat_identity_matches_family_v0051(
             events.app_user_id, p_raw_identities, v_operation.user_id
           ) then null
           else events.app_user_id
         end,
         original_app_user_id = case
           when public._revenuecat_identity_matches_family_v0051(
             events.original_app_user_id, p_raw_identities, v_operation.user_id
           ) then null
           else events.original_app_user_id
         end,
         aliases = public._revenuecat_remove_identity_family_v0051(
           events.aliases, p_raw_identities, v_operation.user_id
         ),
         transferred_from = public._revenuecat_remove_identity_family_v0051(
           events.transferred_from, p_raw_identities, v_operation.user_id
         ),
         transferred_to = public._revenuecat_remove_identity_family_v0051(
           events.transferred_to, p_raw_identities, v_operation.user_id
         )
   where events.user_id = v_operation.user_id
      or events.resolved_user_id = v_operation.user_id
      or public._revenuecat_identity_matches_family_v0051(
        events.app_user_id, p_raw_identities, v_operation.user_id
      )
      or public._revenuecat_identity_matches_family_v0051(
        events.original_app_user_id, p_raw_identities, v_operation.user_id
      )
      or exists (
        select 1
          from unnest(
            coalesce(events.aliases, '{}'::text[])
            || coalesce(events.transferred_from, '{}'::text[])
            || coalesce(events.transferred_to, '{}'::text[])
          ) as identity(value)
         where public._revenuecat_identity_matches_family_v0051(
           identity.value, p_raw_identities, v_operation.user_id
         )
      );

  delete from public.entitlements
   where user_id = v_operation.user_id;

  update public.entitlements as entitlements
     set store_user_id = null,
         raw_status = '{}'::jsonb,
         updated_at = v_now
   where entitlements.user_id <> v_operation.user_id
     and public._revenuecat_identity_matches_family_v0051(
       entitlements.store_user_id,
       p_raw_identities,
       v_operation.user_id
     );

  select count(*)
    into v_residual_events
    from public.subscriptions_events as events
   where events.user_id = v_operation.user_id
      or events.resolved_user_id = v_operation.user_id
      or public._revenuecat_identity_matches_family_v0051(
        events.app_user_id, p_raw_identities, v_operation.user_id
      )
      or public._revenuecat_identity_matches_family_v0051(
        events.original_app_user_id, p_raw_identities, v_operation.user_id
      )
      or exists (
        select 1
          from unnest(
            coalesce(events.aliases, '{}'::text[])
            || coalesce(events.transferred_from, '{}'::text[])
            || coalesce(events.transferred_to, '{}'::text[])
          ) as identity(value)
         where public._revenuecat_identity_matches_family_v0051(
           identity.value, p_raw_identities, v_operation.user_id
         )
      );

  select count(*)
    into v_residual_entitlements
    from public.entitlements as entitlements
   where entitlements.user_id = v_operation.user_id
      or public._revenuecat_identity_matches_family_v0051(
        entitlements.store_user_id, p_raw_identities, v_operation.user_id
      );

  if v_residual_events <> 0 or v_residual_entitlements <> 0 then
    raise exception 'REVENUECAT_IDENTITY_BARRIER_SCRUB_INCOMPLETE' using errcode = 'P0001';
  end if;

  return query select true, 1::smallint, v_raw_count;
end;
$$;

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
  p_auth_verified boolean,
  p_identity_hmac_key_versions smallint[],
  p_identity_hmacs text[],
  p_identity_values text[]
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
  v_now timestamptz := clock_timestamp();
  v_account_id uuid;
  v_all_account_ids uuid[] := '{}'::uuid[];
  v_active_account_ids uuid[] := '{}'::uuid[];
  v_inactive_account_ids uuid[] := '{}'::uuid[];
  v_tombstoned_values text[] := '{}'::text[];
  v_app_user_id text;
  v_original_app_user_id text;
  v_aliases text[];
  v_transferred_from text[];
  v_transferred_to text[];
  v_source_count integer;
  v_lookup_count integer;
  v_lock_version smallint;
  v_lock_hmac text;
begin
  with source_identities(value) as (
    values (p_app_user_id), (p_original_app_user_id)
    union all
    select identity.value
      from unnest(
        coalesce(p_aliases, '{}'::text[])
        || coalesce(p_transferred_from, '{}'::text[])
        || coalesce(p_transferred_to, '{}'::text[])
      ) as identity(value)
  )
  select count(distinct value)
    into v_source_count
    from source_identities
   where value is not null;

  v_lookup_count := pg_catalog.cardinality(
    coalesce(p_identity_hmacs, '{}'::text[])
  );

  if p_identity_hmac_key_versions is null
     or p_identity_hmacs is null
     or p_identity_values is null
     or pg_catalog.cardinality(p_identity_hmac_key_versions) <> v_lookup_count
     or pg_catalog.cardinality(p_identity_values) <> v_lookup_count
     or v_lookup_count > 2048
     or (v_source_count = 0 and v_lookup_count <> 0)
     or (v_source_count > 0 and v_lookup_count = 0)
     or pg_catalog.cardinality(
       array[p_app_user_id, p_original_app_user_id]
       || coalesce(p_user_candidates, '{}'::text[])
       || coalesce(p_aliases, '{}'::text[])
       || coalesce(p_transferred_from, '{}'::text[])
       || coalesce(p_transferred_to, '{}'::text[])
     ) > 256
     or exists (
       select 1
         from unnest(
           array[p_app_user_id, p_original_app_user_id]
           || coalesce(p_user_candidates, '{}'::text[])
           || coalesce(p_aliases, '{}'::text[])
           || coalesce(p_transferred_from, '{}'::text[])
           || coalesce(p_transferred_to, '{}'::text[])
         ) as source(identity_value)
        where source.identity_value is not null
          and (
            pg_catalog.btrim(source.identity_value, E' \t\n\r\f\013') = ''
            or pg_catalog.octet_length(
                 pg_catalog.convert_to(source.identity_value, 'UTF8')
               ) > 1500
          )
     )
     or exists (
       select 1
         from unnest(
           coalesce(p_user_candidates, '{}'::text[])
           || coalesce(p_aliases, '{}'::text[])
           || coalesce(p_transferred_from, '{}'::text[])
           || coalesce(p_transferred_to, '{}'::text[])
         ) as source(identity_value)
        where source.identity_value is null
     )
     or (
       select coalesce(pg_catalog.sum(pg_catalog.octet_length(
         pg_catalog.convert_to(source.identity_value, 'UTF8')
       )), 0)
         from unnest(
           array[p_app_user_id, p_original_app_user_id]
           || coalesce(p_user_candidates, '{}'::text[])
           || coalesce(p_aliases, '{}'::text[])
           || coalesce(p_transferred_from, '{}'::text[])
           || coalesce(p_transferred_to, '{}'::text[])
         ) as source(identity_value)
        where source.identity_value is not null
     ) > 32768
     or (
       select count(distinct version.value)
         from unnest(p_identity_hmac_key_versions) as version(value)
     ) > 4
     or exists (
       select 1
         from unnest(
           p_identity_hmac_key_versions,
           p_identity_hmacs,
           p_identity_values
         ) as lookup(key_version, identity_hmac, identity_value)
        where lookup.key_version is null
           or lookup.key_version not between 1 and 32767
           or lookup.identity_hmac is null
           or lookup.identity_hmac !~ '^[a-f0-9]{64}$'
           or lookup.identity_value is null
           or lookup.identity_value = ''
           or lookup.identity_value <> pg_catalog.btrim(lookup.identity_value)
           or pg_catalog.octet_length(
                pg_catalog.convert_to(lookup.identity_value, 'UTF8')
              ) > 1500
     )
     or exists (
       select 1
         from unnest(p_identity_values) as lookup(identity_value)
        where not exists (
          select 1
            from unnest(
              array[p_app_user_id, p_original_app_user_id]
              || coalesce(p_aliases, '{}'::text[])
              || coalesce(p_transferred_from, '{}'::text[])
              || coalesce(p_transferred_to, '{}'::text[])
            ) as source(identity_value)
           where source.identity_value = lookup.identity_value
        )
     )
     or exists (
       with source_identities(value) as (
         values (p_app_user_id), (p_original_app_user_id)
         union all
         select identity.value
           from unnest(
             coalesce(p_aliases, '{}'::text[])
             || coalesce(p_transferred_from, '{}'::text[])
             || coalesce(p_transferred_to, '{}'::text[])
           ) as identity(value)
       ), configured_versions as (
         select distinct version.value as key_version
           from unnest(p_identity_hmac_key_versions) as version(value)
       )
       select 1
         from configured_versions
         cross join (
           select distinct value from source_identities where value is not null
         ) as source
        where not exists (
          select 1
            from unnest(
              p_identity_hmac_key_versions,
              p_identity_values
            ) as lookup(key_version, identity_value)
           where lookup.key_version = configured_versions.key_version
             and lookup.identity_value = source.value
        )
     )
     or (
       select count(*)
         from (
           select distinct lookup.key_version,
                           lookup.identity_hmac,
                           lookup.identity_value
             from unnest(
               p_identity_hmac_key_versions,
               p_identity_hmacs,
               p_identity_values
             ) as lookup(key_version, identity_hmac, identity_value)
         ) as unique_lookup
     ) <> v_lookup_count then
    raise exception 'INVALID_REVENUECAT_IDENTITY_TOMBSTONE_LOOKUP' using errcode = '22023';
  end if;

  -- Repeat embedded UUID extraction in SQL. These UUIDs affect only global lock
  -- order and deletion suppression; the v0049 delegate still resolves owners
  -- solely from exact structured UUID values.
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
  ), account_ids as (
    select distinct account.account_id
      from raw_identities
      cross join lateral unnest(
        public._revenuecat_embedded_account_uuids(raw_identities.value)
      ) as account(account_id)
  )
  select coalesce(
    pg_catalog.array_agg(account_id order by account_id::text),
    '{}'::uuid[]
  )
    into v_all_account_ids
    from account_ids;

  foreach v_account_id in array v_all_account_ids loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._account_deletion_advisory_key(v_account_id)
    );
  end loop;

  -- Account locks always precede HMAC locks. Every participant then acquires
  -- the composite HMAC lock set in one global order, preventing both opaque
  -- insert-after-scrub races and opposite-family deadlocks.
  for v_lock_version, v_lock_hmac in
    select distinct lookup.key_version, lookup.identity_hmac
      from unnest(
        p_identity_hmac_key_versions,
        p_identity_hmacs
      ) as lookup(key_version, identity_hmac)
     order by lookup.key_version, lookup.identity_hmac
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      public._revenuecat_identity_tombstone_advisory_key(
        v_lock_version,
        v_lock_hmac
      )
    );
  end loop;

  select coalesce(
    pg_catalog.array_agg(candidate.account_id order by candidate.account_id::text),
    '{}'::uuid[]
  )
    into v_active_account_ids
    from unnest(v_all_account_ids) as candidate(account_id)
   where exists (
     select 1 from auth.users as users where users.id = candidate.account_id
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

  select coalesce(
    pg_catalog.array_agg(distinct lookup.identity_value order by lookup.identity_value),
    '{}'::text[]
  )
    into v_tombstoned_values
    from unnest(
      p_identity_hmac_key_versions,
      p_identity_hmacs,
      p_identity_values
    ) as lookup(key_version, identity_hmac, identity_value)
    join public.revenuecat_identity_tombstones as tombstones
      on tombstones.hmac_key_version = lookup.key_version
     and tombstones.identity_hmac = lookup.identity_hmac
     and tombstones.expires_at > v_now;

  if pg_catalog.cardinality(v_all_account_ids) > 0
     and pg_catalog.cardinality(v_active_account_ids) = 0 then
    return query
      select 'suppressed_deleted_account'::text,
             false,
             'suppressed_deleted_account'::text;
    return;
  end if;

  v_app_user_id := public._revenuecat_filter_identity_scalar_v0051(
    p_app_user_id,
    v_active_account_ids,
    v_inactive_account_ids,
    v_tombstoned_values
  );
  v_original_app_user_id := public._revenuecat_filter_identity_scalar_v0051(
    p_original_app_user_id,
    v_active_account_ids,
    v_inactive_account_ids,
    v_tombstoned_values
  );
  v_aliases := public._revenuecat_filter_identity_array_v0051(
    p_aliases,
    v_active_account_ids,
    v_inactive_account_ids,
    v_tombstoned_values
  );
  v_transferred_from := public._revenuecat_filter_identity_array_v0051(
    p_transferred_from,
    v_active_account_ids,
    v_inactive_account_ids,
    v_tombstoned_values
  );
  v_transferred_to := public._revenuecat_filter_identity_array_v0051(
    p_transferred_to,
    v_active_account_ids,
    v_inactive_account_ids,
    v_tombstoned_values
  );

  if pg_catalog.cardinality(v_tombstoned_values) > 0
     and v_app_user_id is null
     and v_original_app_user_id is null
     and v_aliases is null
     and v_transferred_from is null
     and v_transferred_to is null then
    return query
      select 'suppressed_deleted_account'::text,
             false,
             'suppressed_deleted_account'::text;
    return;
  end if;

  return query
    select guarded.outcome,
           guarded.projection_applied,
           guarded.processing_status
      from public.process_revenuecat_webhook_event_guarded(
        p_rc_event_id,
        p_event_type,
        p_user_candidates,
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
      ) as guarded;
end;
$$;

create or replace function public.purge_expired_revenuecat_identity_tombstones(
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'REVENUECAT_IDENTITY_TOMBSTONE_PURGE_INVALID' using errcode = '22023';
  end if;
  delete from public.revenuecat_identity_tombstones as tombstones
   where (tombstones.hmac_key_version, tombstones.identity_hmac) in (
     select candidate.hmac_key_version, candidate.identity_hmac
       from public.revenuecat_identity_tombstones as candidate
      where candidate.expires_at <= clock_timestamp()
      order by candidate.expires_at,
               candidate.hmac_key_version,
               candidate.identity_hmac
      limit p_limit
      for update skip locked
   );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- The v0049 overload is an owner-private delegate. Service callers must supply
-- HMAC lookup inputs through the v0051 overload.
revoke all on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[], text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text, text,
  boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.establish_revenuecat_deletion_identity_barrier(
  uuid, text, smallint, text[], text[], timestamptz
) from public, anon, authenticated;
grant execute on function public.establish_revenuecat_deletion_identity_barrier(
  uuid, text, smallint, text[], text[], timestamptz
) to service_role;

revoke all on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[], text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text, text,
  boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean,
  smallint[], text[], text[]
) from public, anon, authenticated;
grant execute on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[], text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text, text,
  boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean,
  smallint[], text[], text[]
) to service_role;

revoke all on function public.purge_expired_revenuecat_identity_tombstones(integer)
  from public, anon, authenticated;
grant execute on function public.purge_expired_revenuecat_identity_tombstones(integer)
  to service_role;

-- All service writes now enter audited security-definer RPCs. SELECT remains
-- available for operational reconciliation without restoring direct mutation.
revoke insert, update, delete, truncate, references, trigger
  on table public.subscriptions_events from service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.entitlements from service_role;
grant select on table public.subscriptions_events to service_role;
grant select on table public.entitlements to service_role;

comment on table public.revenuecat_identity_tombstones is
  'Finite RevenueCat deletion barriers containing only versioned domain-separated keyed-HMAC identities and expiry metadata. Raw account UUIDs and provider aliases are forbidden.';
comment on function public.establish_revenuecat_deletion_identity_barrier(
  uuid, text, smallint, text[], text[], timestamptz
) is
  'Under a live RevenueCat deletion dispatch claim, atomically retains only keyed-HMAC tombstones and transiently scrubs the bounded raw identity family from current subscription rows.';
comment on function public.process_revenuecat_webhook_event_guarded(
  text, text, text[], text, text, text[], text[], text[], text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text, text,
  boolean, boolean, boolean, smallint, text, jsonb, boolean, boolean,
  smallint[], text[], text[]
) is
  'Checks all aligned RevenueCat identity HMAC candidates, locks embedded UUIDs for suppression only, strips tombstoned identities, and delegates live exact-UUID ownership to the v0049 guard.';

commit;
