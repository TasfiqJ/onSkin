-- =============================================================================
-- 0046 · Fail-closed account-deletion scrub for service-only payment rows
-- =============================================================================
-- A commerce attribution has no owner column; its only ownership link is the
-- opaque click token. RevenueCat audit rows can retain one account in seven
-- scalar/array columns. This migration makes those links unambiguous, removes
-- legacy raw-payload identity keys, and exposes one atomic service-role scrub.

begin;

-- PostgreSQL's one-argument btrim removes ordinary spaces only. Provider
-- identities can arrive with other ASCII boundary whitespace, so every legacy
-- comparison in this migration uses one explicit normalizer.
create or replace function public._migration_0046_ascii_trim(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.btrim(p_value, E' \t\n\r\f\013');
$$;

-- Migration 0041 intentionally added the nonempty provider-event constraint as
-- NOT VALID so existing audit rows could remain online. PostgreSQL still checks
-- that constraint on every later UPDATE, including the normalization below. A
-- pre-0041 NULL/blank id would therefore abort this migration halfway through.
-- Preserve those legacy audit rows under an explicit, deterministic internal
-- namespace derived from the immutable row primary key, then validate the old
-- constraint before touching any other subscription-event column.
do $$
begin
  if exists (
    select 1
      from public.subscriptions_events as legacy
      join public.subscriptions_events as collision
        on collision.id <> legacy.id
       and collision.rc_event_id =
         'legacy_missing_rc_event_id_' || legacy.id::text
     where legacy.rc_event_id is null
        or public._migration_0046_ascii_trim(legacy.rc_event_id) = ''
  ) then
    raise exception 'LEGACY_SUBSCRIPTION_EVENT_ID_COLLISION_PREFLIGHT'
      using errcode = '23505';
  end if;
end;
$$;

update public.subscriptions_events
   set rc_event_id = 'legacy_missing_rc_event_id_' || id::text
 where rc_event_id is null
    or public._migration_0046_ascii_trim(rc_event_id) = '';

alter table public.subscriptions_events
  validate constraint subscriptions_events_rc_event_id_nonempty;

-- Tokens are generated from a fresh random UUID for every outbound click. A
-- duplicate would make attribution ownership ambiguous, so deployment stops
-- rather than guessing which account owns an order.
do $$
begin
  if exists (
    select 1
      from public.commerce_click_events
     group by click_token
    having count(*) > 1
  ) then
    raise exception 'COMMERCE_CLICK_TOKEN_DUPLICATE_PREFLIGHT'
      using errcode = '23505';
  end if;
end;
$$;

create unique index if not exists commerce_click_events_click_token_uidx
  on public.commerce_click_events (click_token);

-- Unknown historical provider tokens have no account owner. Detach them before
-- adding the invariant. ON DELETE SET NULL then makes consent withdrawal and
-- auth-user cascade cleanup race-safe, and prevents a later poll from restoring
-- a token after its owner click has gone away.
update public.order_attributions as attribution
   set click_token = null
 where attribution.click_token is not null
   and not exists (
     select 1
       from public.commerce_click_events as click
      where click.click_token = attribution.click_token
   );

alter table public.order_attributions
  drop constraint if exists order_attributions_click_token_fkey;

alter table public.order_attributions
  add constraint order_attributions_click_token_fkey
  foreign key (click_token)
  references public.commerce_click_events (click_token)
  on delete set null;

-- PostgreSQL can BitmapOr the scalar indexes and use GIN array containment for
-- the independent RevenueCat owner predicates. The existing resolved-user
-- provider-time index already has resolved_user_id as its leading column.
create index if not exists subscriptions_events_user_id_idx
  on public.subscriptions_events (user_id)
  where user_id is not null;

create index if not exists subscriptions_events_app_user_id_idx
  on public.subscriptions_events (app_user_id)
  where app_user_id is not null;

create index if not exists subscriptions_events_original_app_user_id_idx
  on public.subscriptions_events (original_app_user_id)
  where original_app_user_id is not null;

create index if not exists subscriptions_events_aliases_gin_idx
  on public.subscriptions_events using gin (aliases)
  where aliases is not null;

create index if not exists subscriptions_events_transferred_from_gin_idx
  on public.subscriptions_events using gin (transferred_from)
  where transferred_from is not null;

create index if not exists subscriptions_events_transferred_to_gin_idx
  on public.subscriptions_events using gin (transferred_to)
  where transferred_to is not null;

-- Early webhook revisions stored either the provider event object or the raw
-- { event: ... } body. Extract every value from the five documented ownership
-- fields before replacing that payload. Only candidates that still match a live
-- Auth UUID are backfilled as owners; provider-anonymous aliases are not promoted.
create or replace function public._migration_0046_payload_owner_values(p_payload jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with payload_objects as (
    select 1::bigint as object_order,
           case
             when pg_catalog.jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) = 'object'
               then coalesce(p_payload, '{}'::jsonb)
             else '{}'::jsonb
           end as value
    union all
    select 2::bigint,
           case
             when pg_catalog.jsonb_typeof(coalesce(p_payload, '{}'::jsonb) -> 'event') = 'object'
               then coalesce(p_payload, '{}'::jsonb) -> 'event'
             else '{}'::jsonb
           end
  ), owner_keys as (
    select *
      from (values
        (1::bigint, 'app_user_id'::text),
        (2::bigint, 'original_app_user_id'::text),
        (3::bigint, 'aliases'::text),
        (4::bigint, 'transferred_from'::text),
        (5::bigint, 'transferred_to'::text)
      ) as keys(key_order, key_name)
  ), candidates as (
    select item.value #>> '{}' as candidate,
           objects.object_order,
           keys.key_order,
           item.ordinality as item_order
      from payload_objects as objects
      cross join owner_keys as keys
      cross join lateral pg_catalog.jsonb_array_elements(
        case pg_catalog.jsonb_typeof(objects.value -> keys.key_name)
          when 'array' then objects.value -> keys.key_name
          when 'string' then pg_catalog.jsonb_build_array(objects.value -> keys.key_name)
          else '[]'::jsonb
        end
      ) with ordinality as item(value, ordinality)
     where pg_catalog.jsonb_typeof(item.value) = 'string'
  ), first_seen as (
    select case
             when public._migration_0046_ascii_trim(candidate)
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               then pg_catalog.lower(public._migration_0046_ascii_trim(candidate))
             else public._migration_0046_ascii_trim(candidate)
           end as candidate,
           min(object_order * 1000000 + key_order * 10000 + item_order) as first_order
      from candidates
     where candidate is not null
       and public._migration_0046_ascii_trim(candidate) <> ''
     group by case
       when public._migration_0046_ascii_trim(candidate)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then pg_catalog.lower(public._migration_0046_ascii_trim(candidate))
       else public._migration_0046_ascii_trim(candidate)
     end
  )
  select nullif(
    pg_catalog.array_agg(candidate order by first_order),
    '{}'::text[]
  )
    from first_seen;
$$;

create or replace function public._migration_0046_merge_text_values(
  p_existing text[],
  p_additions text[]
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with candidates as (
    select existing.value, 1::bigint as source_order, existing.ordinality as item_order
      from unnest(coalesce(p_existing, '{}'::text[]))
        with ordinality as existing(value, ordinality)
    union all
    select additions.value, 2::bigint, additions.ordinality
      from unnest(coalesce(p_additions, '{}'::text[]))
        with ordinality as additions(value, ordinality)
  ), first_seen as (
    select public._migration_0046_ascii_trim(value) as value,
           min(source_order * 1000000 + item_order) as first_order
      from candidates
     where value is not null
       and public._migration_0046_ascii_trim(value) <> ''
     group by public._migration_0046_ascii_trim(value)
  )
  select nullif(pg_catalog.array_agg(value order by first_order), '{}'::text[])
    from first_seen;
$$;

-- Existing provider arrays are audit evidence: preserve every byte, duplicate,
-- and position. Append only canonical live UUIDs that are not already present
-- exactly; this avoids rewriting unrelated aliases while still giving the
-- deletion scrub an exact UUID value it can match.
create or replace function public._migration_0046_append_missing_text_values(
  p_existing text[],
  p_additions text[]
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with additions as (
    select addition.value,
           min(addition.ordinality) as first_order
      from unnest(coalesce(p_additions, '{}'::text[]))
        with ordinality as addition(value, ordinality)
     where addition.value is not null
       and public._migration_0046_ascii_trim(addition.value) <> ''
       and not coalesce(p_existing, '{}'::text[]) @> array[addition.value]
     group by addition.value
  ), combined as (
    select existing.value,
           1::bigint as source_order,
           existing.ordinality as item_order
      from unnest(coalesce(p_existing, '{}'::text[]))
        with ordinality as existing(value, ordinality)
    union all
    select additions.value,
           2::bigint,
           additions.first_order
      from additions
  )
  select nullif(
    pg_catalog.array_agg(value order by source_order, item_order),
    '{}'::text[]
  )
    from combined;
$$;

create or replace function public._migration_0046_sanitized_payload(p_payload jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with source as (
    select case
      when pg_catalog.jsonb_typeof(coalesce(p_payload, '{}'::jsonb) -> 'event') = 'object'
        then coalesce(p_payload, '{}'::jsonb) -> 'event'
      when pg_catalog.jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) = 'object'
        then coalesce(p_payload, '{}'::jsonb)
      else '{}'::jsonb
    end as event
  ), allowed as (
    select entry.key, entry.value
      from source
      cross join lateral pg_catalog.jsonb_each(source.event) as entry(key, value)
     where (
       entry.key = any(array[
         'id',
         'type',
         'product_id',
         'store',
         'environment',
         'original_transaction_id',
         'transaction_id',
         'period_type',
         'presented_offering_id'
       ]::text[])
       and pg_catalog.jsonb_typeof(entry.value) = 'string'
       and public._migration_0046_ascii_trim(entry.value #>> '{}') <> ''
     ) or (
       entry.key = any(array[
         'event_timestamp_ms',
         'purchased_at_ms',
         'expiration_at_ms',
         'original_purchase_date_ms'
       ]::text[])
       and pg_catalog.jsonb_typeof(entry.value) = 'number'
     ) or (
       entry.key = 'is_sandbox'
       and pg_catalog.jsonb_typeof(entry.value) = 'boolean'
     ) or (
       entry.key = 'entitlement_ids'
       and pg_catalog.jsonb_typeof(entry.value) = 'array'
     )
  ), normalized as (
    select key,
           case when key = 'entitlement_ids' then (
             select coalesce(pg_catalog.jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
               from pg_catalog.jsonb_array_elements(allowed.value)
                 with ordinality as item(value, ordinality)
              where pg_catalog.jsonb_typeof(item.value) = 'string'
                and public._migration_0046_ascii_trim(item.value #>> '{}') <> ''
           ) else value end as value
      from allowed
  )
  select pg_catalog.jsonb_build_object(
    'event',
    coalesce(pg_catalog.jsonb_object_agg(key, value), '{}'::jsonb)
  )
    from normalized;
$$;

create or replace function public._migration_0046_row_owner_values(
  p_user_id uuid,
  p_resolved_user_id uuid,
  p_app_user_id text,
  p_original_app_user_id text,
  p_aliases text[],
  p_transferred_from text[],
  p_transferred_to text[],
  p_payload jsonb
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select public._migration_0046_merge_text_values(
    pg_catalog.array_remove(
      array[
        p_user_id::text,
        p_resolved_user_id::text,
        p_app_user_id,
        p_original_app_user_id
      ]::text[]
      || coalesce(p_aliases, '{}'::text[])
      || coalesce(p_transferred_from, '{}'::text[])
      || coalesce(p_transferred_to, '{}'::text[]),
      null
    ),
    public._migration_0046_payload_owner_values(p_payload)
  );
$$;

-- Keep every UUID-shaped structured owner in one canonical representation so
-- exact scalar/GIN predicates remain usable during deletion. Opaque provider
-- aliases that are not UUID-shaped retain their original bytes.
create or replace function public.canonical_subscription_owner_identity(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when pg_catalog.btrim(p_value, E' \t\n\r\f\013')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then pg_catalog.lower(pg_catalog.btrim(p_value, E' \t\n\r\f\013'))
    else p_value
  end;
$$;

revoke all on function public.canonical_subscription_owner_identity(text)
  from public, anon, authenticated;

create or replace function public.canonicalize_subscription_event_owners()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.app_user_id := public.canonical_subscription_owner_identity(new.app_user_id);
  new.original_app_user_id :=
    public.canonical_subscription_owner_identity(new.original_app_user_id);

  if exists (
    select 1
      from unnest(coalesce(new.aliases, '{}'::text[])) as owner(value)
     where owner.value is distinct from
       public.canonical_subscription_owner_identity(owner.value)
  ) then
    select pg_catalog.array_agg(
             public.canonical_subscription_owner_identity(owner.value)
             order by owner.ordinality
           )
      into new.aliases
      from unnest(new.aliases) with ordinality as owner(value, ordinality);
  end if;

  if exists (
    select 1
      from unnest(coalesce(new.transferred_from, '{}'::text[])) as owner(value)
     where owner.value is distinct from
       public.canonical_subscription_owner_identity(owner.value)
  ) then
    select pg_catalog.array_agg(
             public.canonical_subscription_owner_identity(owner.value)
             order by owner.ordinality
           )
      into new.transferred_from
      from unnest(new.transferred_from) with ordinality as owner(value, ordinality);
  end if;

  if exists (
    select 1
      from unnest(coalesce(new.transferred_to, '{}'::text[])) as owner(value)
     where owner.value is distinct from
       public.canonical_subscription_owner_identity(owner.value)
  ) then
    select pg_catalog.array_agg(
             public.canonical_subscription_owner_identity(owner.value)
             order by owner.ordinality
           )
      into new.transferred_to
      from unnest(new.transferred_to) with ordinality as owner(value, ordinality);
  end if;

  return new;
end;
$$;

revoke all on function public.canonicalize_subscription_event_owners()
  from public, anon, authenticated;

drop trigger if exists subscriptions_events_canonical_owner_identities
  on public.subscriptions_events;
create trigger subscriptions_events_canonical_owner_identities
before insert or update of
  app_user_id,
  original_app_user_id,
  aliases,
  transferred_from,
  transferred_to
on public.subscriptions_events
for each row execute function public.canonicalize_subscription_event_owners();

-- Fire the canonicalizer only for historical rows that actually contain a
-- noncanonical UUID-shaped structured owner.
update public.subscriptions_events as events
   set app_user_id = events.app_user_id,
       original_app_user_id = events.original_app_user_id,
       aliases = events.aliases,
       transferred_from = events.transferred_from,
       transferred_to = events.transferred_to
 where events.app_user_id is distinct from
         public.canonical_subscription_owner_identity(events.app_user_id)
    or events.original_app_user_id is distinct from
         public.canonical_subscription_owner_identity(events.original_app_user_id)
    or exists (
      select 1
        from unnest(coalesce(events.aliases, '{}'::text[])) as owner(value)
       where owner.value is distinct from
         public.canonical_subscription_owner_identity(owner.value)
    )
    or exists (
      select 1
        from unnest(coalesce(events.transferred_from, '{}'::text[])) as owner(value)
       where owner.value is distinct from
         public.canonical_subscription_owner_identity(owner.value)
    )
    or exists (
      select 1
        from unnest(coalesce(events.transferred_to, '{}'::text[])) as owner(value)
       where owner.value is distinct from
         public.canonical_subscription_owner_identity(owner.value)
    );

do $$
begin
  if exists (
    select 1
      from public.subscriptions_events as events
     where events.app_user_id is distinct from
             public.canonical_subscription_owner_identity(events.app_user_id)
        or events.original_app_user_id is distinct from
             public.canonical_subscription_owner_identity(events.original_app_user_id)
        or exists (
          select 1
            from unnest(coalesce(events.aliases, '{}'::text[])) as owner(value)
           where owner.value is distinct from
             public.canonical_subscription_owner_identity(owner.value)
        )
        or exists (
          select 1
            from unnest(coalesce(events.transferred_from, '{}'::text[])) as owner(value)
           where owner.value is distinct from
             public.canonical_subscription_owner_identity(owner.value)
        )
        or exists (
          select 1
            from unnest(coalesce(events.transferred_to, '{}'::text[])) as owner(value)
           where owner.value is distinct from
             public.canonical_subscription_owner_identity(owner.value)
        )
  ) then
    raise exception 'SUBSCRIPTION_OWNER_CANONICALIZATION_INCOMPLETE'
      using errcode = 'P0001';
  end if;
end;
$$;

-- Older account-deletion builds wrote a 20-character base64url SHA-256 prefix
-- of the raw Supabase UUID, then cleared only four scalar owner fields. Recover
-- those deleted identities from the marker before purging it so alias-only,
-- transfer-only, and legacy-payload residue can still be erased safely.
create temporary table migration_0046_legacy_deleted_identities (
  identity text primary key
) on commit drop;

insert into migration_0046_legacy_deleted_identities (identity)
with candidates as (
  select events.user_id::text as candidate
    from public.subscriptions_events as events
   where events.user_id is not null
  union all
  select events.resolved_user_id::text
    from public.subscriptions_events as events
   where events.resolved_user_id is not null
  union all
  select scalar.value
    from public.subscriptions_events as events
    cross join lateral unnest(array[
      events.app_user_id,
      events.original_app_user_id
    ]) as scalar(value)
   where scalar.value is not null
  union all
  select arrays.value
    from public.subscriptions_events as events
    cross join lateral unnest(
      coalesce(events.aliases, '{}'::text[])
      || coalesce(events.transferred_from, '{}'::text[])
      || coalesce(events.transferred_to, '{}'::text[])
    ) as arrays(value)
  union all
  select payload_owner.value
    from public.subscriptions_events as events
    cross join lateral unnest(
      coalesce(
        public._migration_0046_payload_owner_values(events.payload),
        '{}'::text[]
      )
    ) as payload_owner(value)
), normalized as (
  select distinct pg_catalog.lower(
           public._migration_0046_ascii_trim(candidate)
         ) as candidate
    from candidates
   where candidate is not null
     and public._migration_0046_ascii_trim(candidate)
       ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
select normalized.candidate
  from normalized
 where not exists (
   select 1
     from auth.users as still_live
    where still_live.id::text = normalized.candidate
 )
   and exists (
   select 1
     from public.subscriptions_events as marker
    where marker.event_type = 'CUSTOMER_DELETION_REQUESTED'
      and pg_catalog.left(
        marker.rc_event_id,
        pg_catalog.length(
          'account_deletion_'
          || pg_catalog.left(
            pg_catalog.translate(
              pg_catalog.encode(
                pg_catalog.sha256(
                  pg_catalog.convert_to(normalized.candidate, 'UTF8')
                ),
                'base64'
              ),
              '+/=',
              '-_'
            ),
            20
          )
          || '_'
        )
      ) = 'account_deletion_'
        || pg_catalog.left(
          pg_catalog.translate(
            pg_catalog.encode(
              pg_catalog.sha256(
                pg_catalog.convert_to(normalized.candidate, 'UTF8')
              ),
              'base64'
            ),
            '+/=',
            '-_'
          ),
          20
        )
        || '_'
 );

with legacy_owners as (
  select events.id,
         (
           select users.id::text
             from (values
               (
                 1::bigint,
                 case
                   when pg_catalog.jsonb_typeof(events.payload -> 'app_user_id') = 'string'
                     then nullif(
                       public._migration_0046_ascii_trim(
                         events.payload ->> 'app_user_id'
                       ),
                       ''
                     )
                 end
               ),
               (
                 2::bigint,
                 case
                   when pg_catalog.jsonb_typeof(
                     events.payload -> 'event' -> 'app_user_id'
                   ) = 'string'
                     then nullif(
                       public._migration_0046_ascii_trim(
                         events.payload -> 'event' ->> 'app_user_id'
                       ),
                       ''
                     )
                 end
               )
             ) as candidates(candidate_order, candidate)
             join auth.users as users
               on users.id::text = pg_catalog.lower(candidates.candidate)
            order by candidates.candidate_order
            limit 1
         ) as live_app_user_id,
         (
           select users.id::text
             from (values
               (
                 1::bigint,
                 case
                   when pg_catalog.jsonb_typeof(
                     events.payload -> 'original_app_user_id'
                   ) = 'string'
                     then nullif(
                       public._migration_0046_ascii_trim(
                         events.payload ->> 'original_app_user_id'
                       ),
                       ''
                     )
                 end
               ),
               (
                 2::bigint,
                 case
                   when pg_catalog.jsonb_typeof(
                     events.payload -> 'event' -> 'original_app_user_id'
                   ) = 'string'
                     then nullif(
                       public._migration_0046_ascii_trim(
                         events.payload -> 'event' ->> 'original_app_user_id'
                       ),
                       ''
                     )
                 end
               )
             ) as candidates(candidate_order, candidate)
             join auth.users as users
               on users.id::text = pg_catalog.lower(candidates.candidate)
            order by candidates.candidate_order
            limit 1
         ) as live_original_app_user_id,
         (
           select pg_catalog.array_agg(users.id::text order by candidates.ordinality)
             from unnest(
               coalesce(
                 public._migration_0046_payload_owner_values(events.payload),
                 '{}'::text[]
               )
             ) with ordinality as candidates(candidate, ordinality)
             join auth.users as users
               on users.id::text = pg_catalog.lower(candidates.candidate)
         ) as live_owner_ids
    from public.subscriptions_events as events
   where public._migration_0046_payload_owner_values(events.payload) is not null
)
update public.subscriptions_events as events
   set app_user_id = case
         when events.app_user_id is null
           or public._migration_0046_ascii_trim(events.app_user_id) = ''
           then legacy_owners.live_app_user_id
         else events.app_user_id
       end,
       original_app_user_id = case
         when events.original_app_user_id is null
           or public._migration_0046_ascii_trim(events.original_app_user_id) = ''
           then legacy_owners.live_original_app_user_id
         else events.original_app_user_id
       end,
       aliases = public._migration_0046_append_missing_text_values(
         events.aliases,
         legacy_owners.live_owner_ids
       )
  from legacy_owners
 where legacy_owners.id = events.id
   and (
     (
       (
         events.app_user_id is null
         or public._migration_0046_ascii_trim(events.app_user_id) = ''
       )
       and legacy_owners.live_app_user_id is not null
     )
     or (
       (
         events.original_app_user_id is null
         or public._migration_0046_ascii_trim(events.original_app_user_id) = ''
       )
       and legacy_owners.live_original_app_user_id is not null
     )
     or exists (
       select 1
         from unnest(coalesce(legacy_owners.live_owner_ids, '{}'::text[]))
           as candidate(value)
        where not coalesce(events.aliases, '{}'::text[]) @> array[candidate.value]
     )
   );

-- Every live UUID observed in a legacy owner field must now be represented by
-- at least one of the seven normalized owner fields before the raw JSON is lost.
do $$
begin
  if exists (
    select 1
      from public.subscriptions_events as events
      cross join lateral unnest(
        coalesce(
          public._migration_0046_payload_owner_values(events.payload),
          '{}'::text[]
        )
      ) as candidates(candidate)
      join auth.users as users
        on users.id::text = pg_catalog.lower(
          public._migration_0046_ascii_trim(candidates.candidate)
        )
     where not (
       coalesce(events.user_id = users.id, false)
       or coalesce(events.resolved_user_id = users.id, false)
       or coalesce(events.app_user_id = users.id::text, false)
       or coalesce(events.original_app_user_id = users.id::text, false)
       or coalesce(events.aliases @> array[users.id::text], false)
       or coalesce(events.transferred_from @> array[users.id::text], false)
       or coalesce(events.transferred_to @> array[users.id::text], false)
     )
  ) then
    raise exception 'LEGACY_SUBSCRIPTION_OWNER_BACKFILL_INCOMPLETE'
      using errcode = 'P0001';
  end if;
end;
$$;

-- Rows linked only to an already-deleted legacy account have no remaining app
-- purpose. Shared rows keep any still-live Auth owner and lose only recovered
-- deleted identities from every normalized field; payload identities are removed
-- by the typed replacement immediately afterward.
delete from public.subscriptions_events as events
 where exists (
   select 1
     from unnest(
       coalesce(
         public._migration_0046_row_owner_values(
           events.user_id,
           events.resolved_user_id,
           events.app_user_id,
           events.original_app_user_id,
           events.aliases,
           events.transferred_from,
           events.transferred_to,
           events.payload
         ),
         '{}'::text[]
       )
     ) as owner(candidate)
     join migration_0046_legacy_deleted_identities as deleted
       on deleted.identity = pg_catalog.lower(
         public._migration_0046_ascii_trim(owner.candidate)
       )
 )
   and not exists (
     select 1
       from auth.users as live_owner
      where exists (
        select 1
          from unnest(
            coalesce(
              public._migration_0046_row_owner_values(
                events.user_id,
                events.resolved_user_id,
                events.app_user_id,
                events.original_app_user_id,
                events.aliases,
                events.transferred_from,
                events.transferred_to,
                events.payload
              ),
              '{}'::text[]
            )
          ) as owner(candidate)
         where pg_catalog.lower(
           public._migration_0046_ascii_trim(owner.candidate)
         ) = live_owner.id::text
      )
   );

update public.subscriptions_events as events
   set user_id = case
         when exists (
           select 1
             from migration_0046_legacy_deleted_identities as deleted
            where deleted.identity = events.user_id::text
         ) then null
         else events.user_id
       end,
       resolved_user_id = case
         when exists (
           select 1
             from migration_0046_legacy_deleted_identities as deleted
            where deleted.identity = events.resolved_user_id::text
         ) then null
         else events.resolved_user_id
       end,
       app_user_id = case
         when exists (
           select 1
             from migration_0046_legacy_deleted_identities as deleted
            where deleted.identity = pg_catalog.lower(
              public._migration_0046_ascii_trim(events.app_user_id)
            )
         ) then null
         else events.app_user_id
       end,
       original_app_user_id = case
         when exists (
           select 1
             from migration_0046_legacy_deleted_identities as deleted
            where deleted.identity = pg_catalog.lower(
              public._migration_0046_ascii_trim(events.original_app_user_id)
            )
         ) then null
         else events.original_app_user_id
       end,
       aliases = case
         when exists (
           select 1
             from unnest(coalesce(events.aliases, '{}'::text[])) as owner(value)
             join migration_0046_legacy_deleted_identities as deleted
               on deleted.identity = pg_catalog.lower(
                 public._migration_0046_ascii_trim(owner.value)
               )
         ) then (
           select nullif(
             pg_catalog.array_agg(owner.value order by owner.ordinality)
               filter (where deleted.identity is null),
             '{}'::text[]
           )
             from unnest(coalesce(events.aliases, '{}'::text[]))
               with ordinality as owner(value, ordinality)
             left join migration_0046_legacy_deleted_identities as deleted
               on deleted.identity = pg_catalog.lower(
                 public._migration_0046_ascii_trim(owner.value)
               )
         )
         else events.aliases
       end,
       transferred_from = case
         when exists (
           select 1
             from unnest(coalesce(events.transferred_from, '{}'::text[])) as owner(value)
             join migration_0046_legacy_deleted_identities as deleted
               on deleted.identity = pg_catalog.lower(
                 public._migration_0046_ascii_trim(owner.value)
               )
         ) then (
           select nullif(
             pg_catalog.array_agg(owner.value order by owner.ordinality)
               filter (where deleted.identity is null),
             '{}'::text[]
           )
             from unnest(coalesce(events.transferred_from, '{}'::text[]))
               with ordinality as owner(value, ordinality)
             left join migration_0046_legacy_deleted_identities as deleted
               on deleted.identity = pg_catalog.lower(
                 public._migration_0046_ascii_trim(owner.value)
               )
         )
         else events.transferred_from
       end,
       transferred_to = case
         when exists (
           select 1
             from unnest(coalesce(events.transferred_to, '{}'::text[])) as owner(value)
             join migration_0046_legacy_deleted_identities as deleted
               on deleted.identity = pg_catalog.lower(
                 public._migration_0046_ascii_trim(owner.value)
               )
         ) then (
           select nullif(
             pg_catalog.array_agg(owner.value order by owner.ordinality)
               filter (where deleted.identity is null),
             '{}'::text[]
           )
             from unnest(coalesce(events.transferred_to, '{}'::text[]))
               with ordinality as owner(value, ordinality)
             left join migration_0046_legacy_deleted_identities as deleted
               on deleted.identity = pg_catalog.lower(
                 public._migration_0046_ascii_trim(owner.value)
               )
         )
         else events.transferred_to
       end
 where exists (
   select 1
     from unnest(
       coalesce(
         public._migration_0046_row_owner_values(
           events.user_id,
           events.resolved_user_id,
           events.app_user_id,
           events.original_app_user_id,
           events.aliases,
           events.transferred_from,
           events.transferred_to,
           events.payload
         ),
         '{}'::text[]
       )
     ) as owner(candidate)
     join migration_0046_legacy_deleted_identities as deleted
       on deleted.identity = pg_catalog.lower(
         public._migration_0046_ascii_trim(owner.candidate)
       )
 );

-- The marker was useful only for the one-time recovery above. Remove it after
-- all recoverable structured identities have been scrubbed.
delete from public.subscriptions_events
 where event_type = 'CUSTOMER_DELETION_REQUESTED'
   and pg_catalog.left(rc_event_id, pg_catalog.length('account_deletion_'))
     = 'account_deletion_';

do $$
begin
  if exists (
    select 1
      from public.subscriptions_events
     where event_type = 'CUSTOMER_DELETION_REQUESTED'
       and pg_catalog.left(rc_event_id, pg_catalog.length('account_deletion_'))
         = 'account_deletion_'
  ) then
    raise exception 'LEGACY_ACCOUNT_DELETION_HASH_PURGE_INCOMPLETE'
      using errcode = 'P0001';
  end if;
end;
$$;

-- Replace every historical payload with the same typed allowlist used by current
-- ingress. Replacement (rather than key subtraction) ensures unknown/nested PII
-- cannot survive under a custom key or malformed allowlisted value.
update public.subscriptions_events
   set payload = public._migration_0046_sanitized_payload(payload)
 where payload is distinct from public._migration_0046_sanitized_payload(payload);

do $$
begin
  if exists (
    select 1
      from public.subscriptions_events as events
      cross join lateral unnest(
        coalesce(
          public._migration_0046_row_owner_values(
            events.user_id,
            events.resolved_user_id,
            events.app_user_id,
            events.original_app_user_id,
            events.aliases,
            events.transferred_from,
            events.transferred_to,
            events.payload
          ),
          '{}'::text[]
        )
      ) as owner(candidate)
      join migration_0046_legacy_deleted_identities as deleted
        on deleted.identity = pg_catalog.lower(
          public._migration_0046_ascii_trim(owner.candidate)
        )
  ) then
    raise exception 'LEGACY_DELETED_SUBSCRIPTION_IDENTITY_SCRUB_INCOMPLETE'
      using errcode = 'P0001';
  end if;
end;
$$;

-- Executable migration rehearsal: conflicting root/event owners are extracted
-- in stable order, malformed values cannot crash normalization, nested custom
-- data is dropped, and mixed entitlement arrays retain strings only.
do $$
declare
  fixture jsonb := '{
    "app_user_id": "00000000-0000-4000-8000-000000000001",
    "event": {
      "id": "fixture-event",
      "type": "TRANSFER",
      "app_user_id": "00000000-0000-4000-8000-000000000002",
      "aliases": [
        "00000000-0000-4000-8000-000000000001",
        null,
        7,
        "00000000-0000-4000-8000-000000000002"
      ],
      "transferred_to": "00000000-0000-4000-8000-000000000003",
      "entitlement_ids": ["pro", null, 8, "pro_plus"],
      "subscriber_attributes": {"email": "private@example.invalid"}
    },
    "custom_identity": {"user": "00000000-0000-4000-8000-000000000001"}
  }'::jsonb;
  extracted text[];
  merged text[];
  sanitized jsonb;
begin
  extracted := public._migration_0046_payload_owner_values(fixture);
  if extracted is distinct from array[
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003'
  ]::text[] then
    raise exception 'LEGACY_SUBSCRIPTION_OWNER_FIXTURE_FAILED' using errcode = 'P0001';
  end if;

  merged := public._migration_0046_merge_text_values(
    array['retained-before', extracted[1], 'retained-after'],
    extracted
  );
  if merged is distinct from array[
    'retained-before',
    '00000000-0000-4000-8000-000000000001',
    'retained-after',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003'
  ]::text[] then
    raise exception 'LEGACY_SUBSCRIPTION_OWNER_MERGE_FIXTURE_FAILED'
      using errcode = 'P0001';
  end if;

  sanitized := public._migration_0046_sanitized_payload(fixture);
  if sanitized is distinct from '{
    "event": {
      "id": "fixture-event",
      "type": "TRANSFER",
      "entitlement_ids": ["pro", "pro_plus"]
    }
  }'::jsonb then
    raise exception 'LEGACY_SUBSCRIPTION_PAYLOAD_FIXTURE_FAILED' using errcode = 'P0001';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
      from public.subscriptions_events
     where payload is distinct from public._migration_0046_sanitized_payload(payload)
  ) then
    raise exception 'SUBSCRIPTION_PAYLOAD_ALLOWLIST_INCOMPLETE'
      using errcode = 'P0001';
  end if;
end;
$$;

drop function public._migration_0046_sanitized_payload(jsonb);
drop function public._migration_0046_row_owner_values(
  uuid,
  uuid,
  text,
  text,
  text[],
  text[],
  text[],
  jsonb
);
drop function public._migration_0046_merge_text_values(text[], text[]);
drop function public._migration_0046_append_missing_text_values(text[], text[]);
drop function public._migration_0046_payload_owner_values(jsonb);
drop function public._migration_0046_ascii_trim(text);

create or replace function public.scrub_account_service_rows(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id_text text;
  order_rows_scrubbed bigint := 0;
  click_rows_deleted bigint := 0;
  subscription_rows_deleted bigint := 0;
  subscription_rows_scrubbed bigint := 0;
  residual_order_attributions bigint := 0;
  residual_subscription_identities bigint := 0;
begin
  if p_user_id is null then
    raise exception 'ACCOUNT_SERVICE_SCRUB_INVALID_USER' using errcode = '22004';
  end if;
  v_user_id_text := p_user_id::text;

  update public.order_attributions as attribution
     set click_token = null
   where attribution.click_token is not null
     and exists (
       select 1
         from public.commerce_click_events as click
        where click.user_id = p_user_id
          and click.click_token = attribution.click_token
     );
  get diagnostics order_rows_scrubbed = row_count;

  delete from public.commerce_click_events as click
   where click.user_id = p_user_id;
  get diagnostics click_rows_deleted = row_count;

  -- A RevenueCat event owned only by this account has no post-deletion purpose in
  -- the app database, so remove it rather than retaining transaction/audit handles
  -- with the identity columns blanked. Preserve a row only when another currently
  -- live auth user is explicitly present in one of the seven owner fields.
  delete from public.subscriptions_events as event
   where (
     event.user_id = p_user_id
     or event.resolved_user_id = p_user_id
     or event.app_user_id = v_user_id_text
     or event.original_app_user_id = v_user_id_text
     or event.aliases @> array[v_user_id_text]
     or event.transferred_from @> array[v_user_id_text]
     or event.transferred_to @> array[v_user_id_text]
   )
   and not exists (
     select 1
       from auth.users as other_user
      where other_user.id <> p_user_id
        and (
          event.user_id = other_user.id
          or event.resolved_user_id = other_user.id
          or event.app_user_id = other_user.id::text
          or event.original_app_user_id = other_user.id::text
          or event.aliases @> array[other_user.id::text]
          or event.transferred_from @> array[other_user.id::text]
          or event.transferred_to @> array[other_user.id::text]
        )
   );
  get diagnostics subscription_rows_deleted = row_count;

  -- Rows shared with another live account retain that account and non-identity
  -- audit fields. Remove only the deleting user's scalar/array occurrences.
  update public.subscriptions_events as event
     set user_id = case when event.user_id = p_user_id then null else event.user_id end,
         resolved_user_id = case
           when event.resolved_user_id = p_user_id then null
           else event.resolved_user_id
         end,
         app_user_id = case
           when event.app_user_id = v_user_id_text then null
           else event.app_user_id
         end,
         original_app_user_id = case
           when event.original_app_user_id = v_user_id_text then null
           else event.original_app_user_id
         end,
         aliases = case
           when event.aliases @> array[v_user_id_text]
             then nullif(pg_catalog.array_remove(event.aliases, v_user_id_text), '{}'::text[])
           else event.aliases
         end,
         transferred_from = case
           when event.transferred_from @> array[v_user_id_text]
             then nullif(
               pg_catalog.array_remove(event.transferred_from, v_user_id_text),
               '{}'::text[]
             )
           else event.transferred_from
         end,
         transferred_to = case
           when event.transferred_to @> array[v_user_id_text]
             then nullif(
               pg_catalog.array_remove(event.transferred_to, v_user_id_text),
               '{}'::text[]
             )
           else event.transferred_to
         end
   where event.user_id = p_user_id
      or event.resolved_user_id = p_user_id
      or event.app_user_id = v_user_id_text
      or event.original_app_user_id = v_user_id_text
      or event.aliases @> array[v_user_id_text]
      or event.transferred_from @> array[v_user_id_text]
      or event.transferred_to @> array[v_user_id_text];
  get diagnostics subscription_rows_scrubbed = row_count;

  select count(*)
    into residual_order_attributions
    from public.order_attributions as attribution
    join public.commerce_click_events as click
      on click.click_token = attribution.click_token
   where click.user_id = p_user_id
     and attribution.click_token is not null;

  select count(*)
    into residual_subscription_identities
    from public.subscriptions_events as event
   where event.user_id = p_user_id
      or event.resolved_user_id = p_user_id
      or event.app_user_id = v_user_id_text
      or event.original_app_user_id = v_user_id_text
      or event.aliases @> array[v_user_id_text]
      or event.transferred_from @> array[v_user_id_text]
      or event.transferred_to @> array[v_user_id_text];

  if residual_order_attributions <> 0 or residual_subscription_identities <> 0 then
    raise exception 'ACCOUNT_SERVICE_SCRUB_INCOMPLETE' using errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object(
    'complete', true,
    'order_attributions_scrubbed', order_rows_scrubbed,
    'commerce_click_events_deleted', click_rows_deleted,
    'subscriptions_events_deleted', subscription_rows_deleted,
    'subscriptions_events_scrubbed', subscription_rows_scrubbed,
    'residual_order_attributions', residual_order_attributions,
    'residual_subscription_identities', residual_subscription_identities
  );
end;
$$;

revoke all on function public.scrub_account_service_rows(uuid)
  from public, anon, authenticated;
grant execute on function public.scrub_account_service_rows(uuid) to service_role;

comment on function public.scrub_account_service_rows(uuid) is
  'Atomically removes one verified account identity from service-only commerce and subscription rows, deletes account-only subscription events, preserves shared owners and audit fields, and raises if matching residue remains.';

commit;
