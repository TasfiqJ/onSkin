-- C-10/P2A-R2: RevenueCat owner and transaction projection authority.
-- Ambiguous live identities stay unresolved; lifecycle events must correspond
-- to the current transaction and preserve known renewal intention. The existing
-- v0051 service wrapper, deletion/HMAC locks, privacy filtering, atomic event
-- claim/replay/rollback remain in force. Publication is versioned below.
-- CREATE OR REPLACE retains both existing private functions' ACLs.

begin;

-- Private publication state is deliberately outside the exposed public schema.
-- The epoch admits guarded-writer facts and the narrowly validated current
-- transaction cutover below. Historical JSON shape alone is never authority.
create schema revenuecat_publication;
revoke all on schema revenuecat_publication from public, anon, authenticated, service_role;

create table revenuecat_publication.admission (
  singleton boolean primary key default true check (singleton),
  epoch uuid not null default gen_random_uuid()
);
insert into revenuecat_publication.admission (singleton) values (true);
revoke all on table revenuecat_publication.admission from public, anon, authenticated, service_role;

-- CACHE 1 + exact-owner transaction locks guarantee allocation order across
-- sessions. Rollback may burn a number, never publish uncommitted state. The
-- sequence is never reset by row replacement, cache migration or receipt retry.
create sequence revenuecat_publication.revision_sequence as bigint
  minvalue 1 maxvalue 9223372036854775807 start 1 increment 1 no cycle cache 1;
revoke all on sequence revenuecat_publication.revision_sequence
  from public, anon, authenticated, service_role;

create table revenuecat_publication.projections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  canonical jsonb not null
);
alter table revenuecat_publication.projections enable row level security;
revoke all on table revenuecat_publication.projections
  from public, anon, authenticated, service_role;

create function revenuecat_publication.reduce_transaction(
  p_owner uuid, p_transaction text, p_product text, p_store text,
  p_environment text, p_original text, p_snapshot_floor timestamptz
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_epoch text;
  v_event record;
  v_fact jsonb;
  v_now timestamptz := clock_timestamp();
  v_purchased boolean := false;
  v_active boolean := false;
  v_will_renew boolean := null;
  v_window timestamptz;
  v_expiration timestamptz;
  v_purchase_at timestamptz;
  v_period text;
  v_offering text;
  v_access_kind text;
  v_access_id text;
  v_renewal_id text;
  v_window_id text;
  v_head_id text;
  v_used boolean;
  v_pending boolean;
  v_consumed_refund boolean := false;
  v_resolved_ids jsonb := '[]'::jsonb;
  v_pending_ids jsonb := '[]'::jsonb;
begin
  select epoch::text into strict v_epoch from revenuecat_publication.admission where singleton;
  for v_event in
    select e.*
      from public.subscriptions_events e
     where e.user_id = p_owner and e.resolved_user_id = p_owner
       and e.transaction_id = p_transaction and e.product_id = p_product
       and e.store = p_store and e.environment = p_environment
       and (p_original is null or e.original_transaction_id is null
         or e.original_transaction_id = p_original)
       and not coalesce(e.account_deletion_suppressed, false)
       and (e.auth_verified is true or e.signature_verified is true)
       and e.payload -> '_onskin_fact_v1' ->> 'epoch' = v_epoch
       and e.payload -> '_onskin_fact_v1' -> 'version' = '1'::jsonb
       and (p_snapshot_floor is null or e.provider_event_at > p_snapshot_floor)
       and (e.processing_status in ('processing', 'processed', 'stale')
         or (e.processing_status = 'error'
           and e.error = 'REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING'))
     order by e.provider_event_at, e.projection_priority,
       pg_catalog.convert_to(e.rc_event_id, 'UTF8')
  loop
    v_fact := v_event.payload -> '_onskin_fact_v1';
    v_used := false;
    v_pending := false;
    if v_event.event_type in ('INITIAL_PURCHASE', 'RENEWAL') then
      -- Purchase establishes both a finite paid window and its own renewal
      -- intention. Replaying an older purchase after a refund cannot reset
      -- access: the subsequent authentic revocation is reduced below again.
      v_purchased := true;
      v_window := (v_fact ->> 'expiration_at')::timestamptz;
      v_expiration := v_window;
      v_purchase_at := (v_fact ->> 'purchased_at')::timestamptz;
      v_period := v_fact ->> 'period_type';
      v_offering := v_fact ->> 'offering_id';
      v_active := v_window > v_now;
      v_will_renew := (v_fact ->> 'will_renew')::boolean;
      v_access_kind := 'purchase';
      v_access_id := v_event.rc_event_id;
      v_renewal_id := v_event.rc_event_id;
      v_window_id := v_event.rc_event_id;
      v_consumed_refund := false;
      v_used := true;
    elsif v_event.event_type = 'EXPIRATION'
       or (v_event.event_type = 'CANCELLATION'
         and v_fact ->> 'cancel_reason' = 'CUSTOMER_SUPPORT') then
      -- First-seen revocations establish only an inactive watermark. They are
      -- not purchase proof. A later arrival of the older purchase will supply
      -- its independent intention without reviving refunded access.
      v_active := false;
      v_expiration := (v_fact ->> 'expiration_at')::timestamptz;
      if not v_purchased then
        v_purchase_at := (v_fact ->> 'purchased_at')::timestamptz;
        v_period := v_fact ->> 'period_type';
        v_offering := v_fact ->> 'offering_id';
      end if;
      v_access_kind := case when v_event.event_type = 'EXPIRATION'
        then 'expiration' else 'refund' end;
      v_access_id := v_event.rc_event_id;
      if v_event.event_type = 'EXPIRATION' then
        v_will_renew := false;
        v_renewal_id := v_event.rc_event_id;
      end if;
      v_consumed_refund := false;
      v_used := true;
    elsif v_event.event_type = 'REFUND_REVERSED' then
      if v_purchased and v_access_kind = 'refund' and not v_consumed_refund
         and least(v_window, (v_fact ->> 'expiration_at')::timestamptz) > v_now then
        -- A matching reversal consumes the latest refund cycle; an expiration
        -- or later refund is never undone by an older reversal. The reversal
        -- restores at most the already-proved window, never renewal intention.
        v_expiration := least(v_window, (v_fact ->> 'expiration_at')::timestamptz);
        v_active := v_expiration > v_now;
        v_access_kind := 'reversal';
        v_access_id := v_event.rc_event_id;
        v_consumed_refund := true;
        v_used := true;
      elsif v_access_kind is null or v_access_kind = 'purchase'
         or (v_access_kind = 'refund' and not v_purchased) then
        v_pending := (v_fact ->> 'expiration_at')::timestamptz > v_now;
      end if;
    elsif v_event.event_type = 'CANCELLATION' then
      if v_purchased then
        if v_fact ->> 'cancel_reason' is distinct from 'BILLING_ERROR' then
          v_will_renew := false;
          v_renewal_id := v_event.rc_event_id;
        end if;
        v_used := true;
      else
        v_pending := true;
      end if;
    elsif v_event.event_type = 'UNCANCELLATION' then
      if v_purchased then
        v_will_renew := true;
        v_renewal_id := v_event.rc_event_id;
        v_used := true;
      else
        v_pending := true;
      end if;
    elsif v_event.event_type in ('BILLING_ISSUE', 'SUBSCRIPTION_EXTENDED') then
      if v_purchased and v_access_kind in ('purchase', 'reversal') then
        if (v_fact ->> 'expiration_at')::timestamptz > v_now then
          v_window := greatest(v_window, (v_fact ->> 'expiration_at')::timestamptz);
          v_expiration := v_window;
          v_active := true;
          v_window_id := v_event.rc_event_id;
          v_used := true;
        end if;
      elsif not v_purchased then
        v_pending := (v_fact ->> 'expiration_at')::timestamptz > v_now;
      end if;
    end if;
    if v_pending then
      v_pending_ids := v_pending_ids || pg_catalog.jsonb_build_array(v_event.rc_event_id);
    else
      v_resolved_ids := v_resolved_ids || pg_catalog.jsonb_build_array(v_event.rc_event_id);
    end if;
    if v_used then v_head_id := v_event.rc_event_id; end if;
  end loop;
  return pg_catalog.jsonb_build_object(
    'head_id', v_head_id, 'is_active', v_active, 'will_renew', v_will_renew,
    'expires_at', v_expiration, 'purchased_at', v_purchase_at,
    'period_type', v_period, 'offering_id', v_offering,
    'access_event_id', v_access_id, 'renewal_event_id', v_renewal_id,
    'window_event_id', v_window_id, 'has_purchase', v_purchased,
    'resolved_ids', v_resolved_ids, 'pending_ids', v_pending_ids
  );
end;
$$;
revoke all on function revenuecat_publication.reduce_transaction(
  uuid, text, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;

-- Migration-only compatibility for a currently published, receipt-proven
-- transaction. This validator is deliberately stricter than arbitrary JSON
-- shape: normalized columns, immutable event payload and finite timing agree.
create function revenuecat_publication.provider_timestamp(p_value jsonb)
returns timestamptz language plpgsql immutable set search_path='' as $$
declare v_number numeric;
begin
  if pg_catalog.jsonb_typeof(p_value) is distinct from 'number' then return null; end if;
  v_number := (p_value #>> '{}')::numeric;
  if v_number < 1 or v_number > 8640000000000000 or trunc(v_number) <> v_number then return null; end if;
  return pg_catalog.to_timestamp((v_number / 1000)::double precision);
exception when others then return null;
end $$;
revoke all on function revenuecat_publication.provider_timestamp(jsonb)
 from public,anon,authenticated,service_role;

create function revenuecat_publication.current_receipt_fact(p_event public.subscriptions_events,p_epoch text)
returns jsonb language plpgsql stable set search_path='' as $$
declare
  v_event jsonb := p_event.payload -> 'event';
  v_at timestamptz;
  v_purchase timestamptz;
  v_expiry timestamptz;
  v_grace timestamptz;
  v_refund boolean;
begin
  if p_event.processing_status is null or p_event.processing_status not in ('processed','stale')
    or p_event.processed_at is null or p_event.processing_attempts < 1
    or (p_event.processing_status='processed' and p_event.projection_applied is distinct from true)
    or (p_event.processing_status='stale' and p_event.projection_applied is distinct from false)
    or p_event.error is not null
    or not (coalesce(p_event.auth_verified,false) or coalesce(p_event.signature_verified,false))
    or coalesce(p_event.account_deletion_suppressed,false)
    or p_event.user_id is null or p_event.resolved_user_id is distinct from p_event.user_id
    or p_event.transaction_id is null or p_event.transaction_id !~ '[^[:space:]]'
    or p_event.store is distinct from 'app_store'
    or p_event.environment is null or p_event.environment not in ('production','sandbox')
    or p_event.projection_priority is null or p_event.projection_priority not in (100,200,300)
    or p_event.event_type not in ('INITIAL_PURCHASE','RENEWAL','CANCELLATION','EXPIRATION',
      'REFUND_REVERSED','UNCANCELLATION','BILLING_ISSUE','SUBSCRIPTION_EXTENDED')
    or pg_catalog.jsonb_typeof(v_event) is distinct from 'object'
    or v_event ->> 'id' is distinct from p_event.rc_event_id
    or v_event ->> 'type' is distinct from p_event.event_type
    or v_event ->> 'transaction_id' is distinct from p_event.transaction_id
    or nullif(v_event ->> 'original_transaction_id','') is distinct from p_event.original_transaction_id
    or v_event ->> 'product_id' is distinct from p_event.product_id
    or upper(v_event ->> 'store') is distinct from 'APP_STORE'
    or lower(v_event ->> 'environment') is distinct from p_event.environment
    or lower(v_event ->> 'period_type') is null
    or lower(v_event ->> 'period_type') not in ('normal','trial','intro')
    or pg_catalog.jsonb_typeof(v_event -> 'entitlement_ids') is distinct from 'array'
    or not (v_event -> 'entitlement_ids' ? 'pro') then return null; end if;
  if v_event ? 'is_sandbox' and (
    pg_catalog.jsonb_typeof(v_event -> 'is_sandbox') is distinct from 'boolean'
    or (v_event ->> 'is_sandbox')::boolean is distinct from (p_event.environment='sandbox')
  ) then return null; end if;
  v_at := revenuecat_publication.provider_timestamp(v_event -> 'event_timestamp_ms');
  v_purchase := coalesce(revenuecat_publication.provider_timestamp(v_event -> 'purchased_at_ms'),
    revenuecat_publication.provider_timestamp(v_event -> 'original_purchase_date_ms'));
  v_expiry := revenuecat_publication.provider_timestamp(v_event -> 'expiration_at_ms');
  v_grace := revenuecat_publication.provider_timestamp(v_event -> 'grace_period_expiration_at_ms');
  if v_at is null or v_at is distinct from p_event.provider_event_at
    or v_purchase is null or v_expiry is null or v_expiry <= v_purchase
    or v_purchase > v_at + (case when p_event.event_type='INITIAL_PURCHASE'
      then interval '5 minutes' else interval '1 day' end)
    or (v_event ? 'grace_period_expiration_at_ms' and v_grace is null)
    or (v_grace is not null and v_grace < v_expiry) then return null; end if;
  v_refund := p_event.event_type='CANCELLATION' and v_event ->> 'cancel_reason'='CUSTOMER_SUPPORT';
  return pg_catalog.jsonb_build_object('version',1,'epoch',p_epoch,
    'entitlement','pro',
    'expiration_at',case when p_event.event_type='BILLING_ISSUE' then coalesce(v_grace,v_expiry) else v_expiry end,
    'purchased_at',v_purchase,'period_type',lower(v_event ->> 'period_type'),
    'will_renew',p_event.event_type in ('INITIAL_PURCHASE','RENEWAL','UNCANCELLATION'),
    'is_active',p_event.event_type <> 'EXPIRATION' and not coalesce(v_refund,false),
    'offering_id',v_event ->> 'presented_offering_id','cancel_reason',v_event ->> 'cancel_reason');
end $$;
revoke all on function revenuecat_publication.current_receipt_fact(public.subscriptions_events,text)
 from public,anon,authenticated,service_role;

-- Only the transaction already named by a valid current ordered projection is
-- eligible for compatibility initialization. Both its current head and at least
-- one corresponding, actually-applied purchase must retain authenticated,
-- consistent receipts. Stale/unapplied purchases alone cannot mint an anchor.
-- No other owner's/dormant transaction/history is admitted, and no entitlement
-- is changed by this step. New deliveries later reduce the bounded anchored set.
do $$
declare
  v_owner uuid;
  v_current public.entitlements%rowtype;
  v_epoch text;
  v_head jsonb;
  v_purchase jsonb;
begin
  select epoch::text into strict v_epoch from revenuecat_publication.admission where singleton;
  for v_owner in select e.user_id from public.entitlements e order by e.user_id loop
    perform pg_catalog.pg_advisory_xact_lock(public._account_deletion_advisory_key(v_owner));
    select e.* into v_current from public.entitlements e where e.user_id=v_owner for update;
    if v_current.rc_cursor_state is distinct from 'ordered'
      or v_current.entitlement is distinct from 'pro'
      or v_current.store is distinct from 'app_store'
      or v_current.environment not in ('production','sandbox')
      or v_current.rc_transaction_id is null
      or v_current.rc_transaction_id !~ '[^[:space:]]'
      or v_current.original_purchase_at is null or not pg_catalog.isfinite(v_current.original_purchase_at)
      or v_current.expires_at is null or not pg_catalog.isfinite(v_current.expires_at)
      or exists(select 1 from public.account_deletion_barriers b where b.user_id=v_owner)
      then continue; end if;
    select revenuecat_publication.current_receipt_fact(e,v_epoch) into v_head
      from public.subscriptions_events e
      where e.rc_event_id=v_current.rc_event_id and e.user_id=v_owner and e.resolved_user_id=v_owner
        and e.projection_applied is true and e.provider_event_at=v_current.rc_event_at
        and e.projection_priority=v_current.rc_event_priority
        and e.transaction_id=v_current.rc_transaction_id and e.product_id=v_current.product_id
        and e.store=v_current.store and e.environment=v_current.environment
        and (e.original_transaction_id is null or v_current.rc_original_transaction_id is null
          or e.original_transaction_id=v_current.rc_original_transaction_id);
    if v_head is null then continue; end if;
    select fact.value into v_purchase from public.subscriptions_events e
      cross join lateral (select revenuecat_publication.current_receipt_fact(e,v_epoch)) fact(value)
      where e.user_id=v_owner and e.resolved_user_id=v_owner and e.projection_applied is true
        and e.event_type in ('INITIAL_PURCHASE','RENEWAL')
        and e.transaction_id=v_current.rc_transaction_id and e.product_id=v_current.product_id
        and e.store=v_current.store and e.environment=v_current.environment
        and (e.original_transaction_id is null or v_current.rc_original_transaction_id is null
          or e.original_transaction_id=v_current.rc_original_transaction_id)
        and fact.value is not null
        and (fact.value ->> 'purchased_at')::timestamptz=v_current.original_purchase_at
      order by e.provider_event_at desc limit 1;
    if v_purchase is null then continue; end if;
    update public.subscriptions_events e set payload=(e.payload-'_onskin_fact_v1')
      || pg_catalog.jsonb_build_object('_onskin_fact_v1',revenuecat_publication.current_receipt_fact(e,v_epoch))
      where e.user_id=v_owner and e.resolved_user_id=v_owner
        and e.transaction_id=v_current.rc_transaction_id and e.product_id=v_current.product_id
        and e.store=v_current.store and e.environment=v_current.environment
        and (e.original_transaction_id is null or v_current.rc_original_transaction_id is null
          or e.original_transaction_id=v_current.rc_original_transaction_id)
        and revenuecat_publication.current_receipt_fact(e,v_epoch) is not null;
  end loop;
end $$;


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

  -- A deterministic list is not proof that its first account owns this event.
  -- Deletion/tombstone filtering has already run under the existing locks. If
  -- more than one exact live owner remains, retain the filtered audit evidence
  -- through the atomic delegate's replayable unresolved-user path. Never bind
  -- the event or project paid access to an arbitrary account.
  if pg_catalog.cardinality(v_semantic_user_candidates) > 1 then
    v_semantic_user_candidates := '{}'::text[];
  end if;

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


create or replace function public.process_revenuecat_webhook_event(
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
  v_now timestamptz := clock_timestamp();
  v_resolved_user_id uuid;
  v_event_row_id uuid;
  v_existing public.subscriptions_events%rowtype;
  v_entitlement_user_id uuid;
  v_processing_status text;
  v_attempts integer := 1;
  v_failure_state text;
  v_current_entitlement public.entitlements%rowtype;
  v_should_project boolean := p_should_project;
  v_dependency_pending boolean := false;
  v_retry_error text := 'REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING';
  v_original_transaction_id text := p_original_transaction_id;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb) - '_onskin_fact_v1';
  v_epoch text;
  v_reduced jsonb;
  v_head public.subscriptions_events%rowtype;
  v_corresponds boolean;
  v_floor timestamptz;
  v_can_reduce boolean := false;

begin
  if p_rc_event_id is null
     or length(btrim(p_rc_event_id)) = 0
     or length(p_rc_event_id) > 255
     or p_event_type is null
     or length(btrim(p_event_type)) = 0
     or length(p_event_type) > 100
     or p_provider_event_at is null
     or p_received_at is null then
    raise exception using errcode = '22023', message = 'INVALID_REVENUECAT_EVENT';
  end if;

  if p_should_project is null
     or p_is_active is null
     or p_will_renew is null
     or (p_should_project and (
       p_projection_priority is null
       or p_projection_priority not in (100, 200, 300)
     )) then
    raise exception using errcode = '22023', message = 'INVALID_REVENUECAT_ORDER_PRIORITY';
  end if;

  -- New authority must remain identifiable by later transaction-specific
  -- revocations. Keep incomplete signed evidence auditable, without projecting.
  -- The marker is minted here only after the guarded owner/tombstone boundary
  -- and supported Edge admission. Raw provider/history JSON never supplies it.
  select epoch::text into strict v_epoch from revenuecat_publication.admission where singleton;
  v_should_project := v_should_project
    and (p_auth_verified is true or p_signature_verified is true)
    and coalesce(p_transaction_id ~ '[^[:space:]]', false)
    and p_entitlement = 'pro'
    and p_store = 'app_store'
    and p_environment in ('production', 'sandbox')
    and p_period_type in ('normal', 'trial', 'intro')
    and p_product_id is not null
    and pg_catalog.isfinite(p_original_purchase_at)
    and pg_catalog.isfinite(p_expiration_at)
    and p_expiration_at > p_original_purchase_at
    and p_event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'CANCELLATION',
      'EXPIRATION', 'REFUND_REVERSED', 'UNCANCELLATION', 'BILLING_ISSUE',
      'SUBSCRIPTION_EXTENDED');

  -- Candidate order is normalized by the Edge Function: transfer destination,
  -- direct app user, original app user, then sorted aliases. Text comparison
  -- avoids unsafe UUID casts for provider-generated anonymous identifiers.
  select users.id
    into v_resolved_user_id
    from unnest(coalesce(p_user_candidates, array[]::text[])) with ordinality
      as candidates(candidate, position)
    join auth.users as users on users.id::text = candidates.candidate
   order by candidates.position
   limit 1;

  if v_resolved_user_id is not null and v_should_project then
    v_payload := v_payload || pg_catalog.jsonb_build_object('_onskin_fact_v1',
      pg_catalog.jsonb_build_object(
        'epoch', v_epoch,
        'version', 1,
        'entitlement', p_entitlement,
        'expiration_at', p_expiration_at,
        'purchased_at', p_original_purchase_at,
        'period_type', p_period_type,
        'will_renew', p_will_renew,
        'is_active', p_is_active,
        'offering_id', p_offering_id,
        'cancel_reason', p_payload -> 'event' ->> 'cancel_reason'
      ));
  end if;

  begin
    -- Claim the provider event. ON CONFLICT waits for an in-flight insert with
    -- the same id, making simultaneous duplicates converge before inspection.
    insert into public.subscriptions_events as event_audit (
      rc_event_id,
      user_id,
      event_type,
      payload,
      received_at,
      app_user_id,
      original_app_user_id,
      aliases,
      resolved_user_id,
      environment,
      store,
      product_id,
      processing_status,
      signature_verified,
      auth_verified,
      provider_event_at,
      original_transaction_id,
      transaction_id,
      transferred_from,
      transferred_to,
      projection_priority,
      projection_applied,
      processing_attempts
    )
    values (
      p_rc_event_id,
      v_resolved_user_id,
      p_event_type,
      v_payload,
      p_received_at,
      p_app_user_id,
      p_original_app_user_id,
      p_aliases,
      v_resolved_user_id,
      p_environment,
      p_store,
      p_product_id,
      'processing',
      p_signature_verified,
      p_auth_verified,
      p_provider_event_at,
      p_original_transaction_id,
      p_transaction_id,
      p_transferred_from,
      p_transferred_to,
      p_projection_priority,
      false,
      1
    )
    on conflict (rc_event_id) do nothing
    returning id into v_event_row_id;

    if v_event_row_id is null then
      select events.*
        into v_existing
        from public.subscriptions_events as events
       where events.rc_event_id = p_rc_event_id
       for update;

      if v_existing.id is null then
        raise exception using errcode = '40001', message = 'REVENUECAT_EVENT_CLAIM_LOST';
      end if;

      if coalesce(v_existing.processing_status, '') not in ('error', 'unresolved_user') then
        return query
          select
            'duplicate'::text,
            coalesce(v_existing.projection_applied, false),
            coalesce(v_existing.processing_status, 'processed');
        return;
      end if;

      if v_existing.payload ? '_onskin_fact_v1'
         and row(v_existing.user_id, v_existing.resolved_user_id,
           v_existing.event_type, v_existing.provider_event_at,
           v_existing.transaction_id, v_existing.original_transaction_id,
           v_existing.product_id, v_existing.store, v_existing.environment,
           v_existing.payload -> '_onskin_fact_v1')
           is distinct from row(v_resolved_user_id, v_resolved_user_id,
           p_event_type, p_provider_event_at,
           p_transaction_id, p_original_transaction_id, p_product_id, p_store,
           p_environment, v_payload -> '_onskin_fact_v1') then
        return query select 'error'::text, false, 'error'::text;
        return;
      end if;

      v_attempts := greatest(coalesce(v_existing.processing_attempts, 0) + 1, 1);
      v_event_row_id := v_existing.id;

      -- Error and unresolved-user rows are explicit replay/dead-letter records.
      -- Re-delivery retries them without creating a second audit row.
      update public.subscriptions_events
         set user_id = v_resolved_user_id,
             event_type = p_event_type,
             payload = v_payload,
             received_at = p_received_at,
             app_user_id = p_app_user_id,
             original_app_user_id = p_original_app_user_id,
             aliases = p_aliases,
             resolved_user_id = v_resolved_user_id,
             environment = p_environment,
             store = p_store,
             product_id = p_product_id,
             processed_at = null,
             processing_status = 'processing',
             error = null,
             signature_verified = p_signature_verified,
             auth_verified = p_auth_verified,
             provider_event_at = p_provider_event_at,
             original_transaction_id = p_original_transaction_id,
             transaction_id = p_transaction_id,
             transferred_from = p_transferred_from,
             transferred_to = p_transferred_to,
             projection_priority = p_projection_priority,
             projection_applied = false,
             processing_attempts = v_attempts
       where id = v_event_row_id;
    end if;

    -- The existing guarded RPC serializes this exact owner with deletion and
    -- snapshot writers. Receipt claim, pending-fact reconsideration, projection
    -- and publication revision commit in this same transaction.
    if v_resolved_user_id is not null and v_should_project then
      select e.* into v_current_entitlement
        from public.entitlements e where e.user_id = v_resolved_user_id for update;
      v_corresponds := coalesce(
        p_transaction_id = v_current_entitlement.rc_transaction_id
        and p_product_id = v_current_entitlement.product_id
        and p_store = v_current_entitlement.store
        and p_environment = v_current_entitlement.environment
        and (p_original_transaction_id is null
          or v_current_entitlement.rc_original_transaction_id is null
          or p_original_transaction_id = v_current_entitlement.rc_original_transaction_id), false);
      if v_corresponds then
        v_original_transaction_id := coalesce(v_current_entitlement.rc_original_transaction_id,
          p_original_transaction_id);
      end if;
      if v_current_entitlement.rc_cursor_state = 'snapshot' then
        -- Preserve the existing snapshot floor. Only a strictly later genuine
        -- purchase can establish a new transaction after an unbound snapshot.
        v_floor := v_current_entitlement.rc_snapshot_at;
        v_can_reduce := p_event_type in ('INITIAL_PURCHASE', 'RENEWAL')
          and p_provider_event_at > v_floor;
      elsif v_current_entitlement.rc_cursor_state = 'legacy_unknown' then
        v_can_reduce := false;
      else
        v_floor := (v_current_entitlement.raw_status -> '_onskin_reduction_v1'
          ->> 'snapshot_floor')::timestamptz;
        if v_current_entitlement.user_id is null or v_corresponds then
          v_can_reduce := true;
        elsif p_event_type in ('INITIAL_PURCHASE', 'RENEWAL') then
          -- The paid period, not a delayed old lifecycle's generation time,
          -- selects a new transaction. A known chain cannot be replaced by a
          -- contradictory chain for the same exact store transaction.
          v_can_reduce := (v_current_entitlement.rc_transaction_id is null
              and p_provider_event_at > v_current_entitlement.rc_event_at)
            or (p_transaction_id <> v_current_entitlement.rc_transaction_id
            and (p_original_purchase_at > v_current_entitlement.original_purchase_at
              or (v_current_entitlement.original_purchase_at is null
                and p_provider_event_at > v_current_entitlement.rc_event_at)
              or (p_original_purchase_at = v_current_entitlement.original_purchase_at
                and public._revenuecat_event_cursor_is_newer_v0053(
                  p_provider_event_at, p_projection_priority, p_rc_event_id,
                  v_current_entitlement.rc_event_at, v_current_entitlement.rc_event_priority,
                  v_current_entitlement.rc_event_id))));
        else
          -- A lifecycle for a genuinely later period in the known chain may
          -- precede its purchase. Keep its accepted obligation replayable, and
          -- reconsider it automatically when that exact purchase arrives.
          v_dependency_pending := coalesce(
            p_product_id = v_current_entitlement.product_id
            and p_store = v_current_entitlement.store
            and p_environment = v_current_entitlement.environment
            and p_original_transaction_id is not null
            and p_original_transaction_id = v_current_entitlement.rc_original_transaction_id
            and p_transaction_id <> v_current_entitlement.rc_transaction_id
            and p_original_purchase_at > v_current_entitlement.original_purchase_at,
            false);
        end if;
      end if;

      if v_can_reduce then
        v_reduced := revenuecat_publication.reduce_transaction(
          v_resolved_user_id, p_transaction_id, p_product_id, p_store,
          p_environment, v_original_transaction_id, v_floor);
        v_dependency_pending := v_reduced -> 'pending_ids' ? p_rc_event_id;
        -- A receipt accepted while its dependency was absent is resolved in the
        -- same transaction as the newly available prerequisite. It never needs
        -- the provider to redeliver its ID to affect the canonical projection.
        update public.subscriptions_events e
           set processing_status = 'stale', error = null, processed_at = v_now,
               projection_applied = false
         where e.user_id = v_resolved_user_id and e.resolved_user_id = v_resolved_user_id
           and e.processing_status = 'error'
           and e.error = 'REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING'
           and v_reduced -> 'resolved_ids' ? e.rc_event_id
           and e.rc_event_id <> p_rc_event_id;
        if v_reduced ->> 'head_id' is not null then
          select e.* into strict v_head from public.subscriptions_events e
            where e.rc_event_id = v_reduced ->> 'head_id';
          insert into public.entitlements as current_projection (
            user_id, entitlement, is_active, product_id, expires_at, rc_event_id,
            updated_at, store, period_type, will_renew, original_purchase_at,
            offering_id, source, environment, verified_at, store_user_id,
            last_reconciled_at, raw_status, rc_event_at, rc_event_priority,
            rc_original_transaction_id, rc_transaction_id
          ) values (
            v_resolved_user_id, 'pro', (v_reduced ->> 'is_active')::boolean,
            p_product_id, (v_reduced ->> 'expires_at')::timestamptz, v_head.rc_event_id,
            v_now, p_store, v_reduced ->> 'period_type',
            (v_reduced ->> 'will_renew')::boolean,
            (v_reduced ->> 'purchased_at')::timestamptz, v_reduced ->> 'offering_id',
            'revenuecat', p_environment, v_head.provider_event_at,
            coalesce(v_head.app_user_id, v_head.original_app_user_id, v_resolved_user_id::text),
            v_now, coalesce(v_head.payload -> 'event', '{}'::jsonb)
              || pg_catalog.jsonb_build_object('_onskin_reduction_v1',
                pg_catalog.jsonb_build_object('epoch', v_epoch,
                  'snapshot_floor', v_floor,
                  'access_event_id', v_reduced ->> 'access_event_id',
                  'renewal_event_id', v_reduced ->> 'renewal_event_id',
                  'window_event_id', v_reduced ->> 'window_event_id')),
            v_head.provider_event_at, v_head.projection_priority,
            coalesce(v_original_transaction_id, v_head.original_transaction_id), p_transaction_id
          ) on conflict (user_id) do update set
            entitlement = excluded.entitlement, is_active = excluded.is_active,
            product_id = excluded.product_id, expires_at = excluded.expires_at,
            rc_event_id = excluded.rc_event_id, updated_at = excluded.updated_at,
            store = excluded.store, period_type = excluded.period_type,
            will_renew = excluded.will_renew, original_purchase_at = excluded.original_purchase_at,
            offering_id = excluded.offering_id, source = excluded.source,
            environment = excluded.environment, verified_at = excluded.verified_at,
            store_user_id = excluded.store_user_id, last_reconciled_at = excluded.last_reconciled_at,
            raw_status = excluded.raw_status, rc_event_at = excluded.rc_event_at,
            rc_event_priority = excluded.rc_event_priority,
            rc_original_transaction_id = excluded.rc_original_transaction_id,
            rc_transaction_id = excluded.rc_transaction_id,
            management_url = null, package_id = null
          where row(current_projection.entitlement, current_projection.is_active,
              current_projection.product_id, current_projection.expires_at,
              current_projection.rc_event_id, current_projection.store,
              current_projection.period_type, current_projection.will_renew,
              current_projection.original_purchase_at, current_projection.offering_id,
              current_projection.source, current_projection.environment,
              current_projection.verified_at, current_projection.raw_status,
              current_projection.rc_event_at, current_projection.rc_event_priority,
              current_projection.rc_original_transaction_id, current_projection.rc_transaction_id)
            is distinct from row(excluded.entitlement, excluded.is_active,
              excluded.product_id, excluded.expires_at, excluded.rc_event_id,
              excluded.store, excluded.period_type, excluded.will_renew,
              excluded.original_purchase_at, excluded.offering_id, excluded.source,
              excluded.environment, excluded.verified_at, excluded.raw_status,
              excluded.rc_event_at, excluded.rc_event_priority,
              excluded.rc_original_transaction_id, excluded.rc_transaction_id)
          returning user_id into v_entitlement_user_id;
        end if;
      end if;
    end if;

    if v_resolved_user_id is null then
      v_processing_status := 'unresolved_user';
    elsif v_dependency_pending then
      v_processing_status := 'error';
    elsif v_entitlement_user_id is not null then
      v_processing_status := 'processed';
    elsif v_should_project and (v_can_reduce or p_event_type in ('INITIAL_PURCHASE', 'RENEWAL')) then
      v_processing_status := 'stale';
    else
      v_processing_status := 'ignored_event_type';
    end if;

    update public.subscriptions_events
       set processed_at = v_now,
           processing_status = v_processing_status,
           error = case when v_dependency_pending
             then v_retry_error else null end,
           projection_applied = v_entitlement_user_id is not null
     where id = v_event_row_id;

    return query
      select
        case
          when v_processing_status = 'processed' then 'processed'
          when v_processing_status = 'stale' then 'stale'
          when v_processing_status = 'unresolved_user' then 'unresolved'
          when v_processing_status = 'error' then 'error'
          else 'ignored'
        end,
        v_entitlement_user_id is not null,
        v_processing_status;
    return;
  exception when others then
    -- The nested block is a subtransaction: event claim and projection are both
    -- rolled back before this content-minimized retry record is written.
    v_failure_state := sqlstate;
    -- A failed retry rolls back to an already-durable pending obligation. Do
    -- not turn its accepted fact into an unadmitted new-failure receipt. Keep
    -- the original payload/owner/dependency intact so the next prerequisite
    -- can resolve it without another provider retry of this ID.
    -- Failure may also occur in the claim INSERT before the duplicate row
    -- was loaded. Re-read the rolled-back durable receipt, never rely on a
    -- local record having been populated before the failing statement.
    select e.* into v_existing from public.subscriptions_events e
      where e.rc_event_id = p_rc_event_id for update;
    if v_existing.id is not null
       and v_existing.processing_status = 'error'
       and v_existing.error = 'REVENUECAT_LIFECYCLE_DEPENDENCY_PENDING'
       and v_existing.payload -> '_onskin_fact_v1' ->> 'epoch' = v_epoch then
      if v_existing.user_id = v_resolved_user_id
         and v_existing.resolved_user_id = v_resolved_user_id then
        update public.subscriptions_events e
          set processing_attempts = greatest(e.processing_attempts + 1, v_attempts),
              processed_at = v_now
          where e.id = v_existing.id;
      end if;
      return query select 'error'::text, false, 'error'::text;
      return;
    end if;
    v_payload := v_payload - '_onskin_fact_v1';
    insert into public.subscriptions_events as event_audit (
      rc_event_id,
      user_id,
      event_type,
      payload,
      received_at,
      app_user_id,
      original_app_user_id,
      aliases,
      resolved_user_id,
      environment,
      store,
      product_id,
      processed_at,
      processing_status,
      error,
      signature_verified,
      auth_verified,
      provider_event_at,
      original_transaction_id,
      transaction_id,
      transferred_from,
      transferred_to,
      projection_priority,
      projection_applied,
      processing_attempts
    )
    values (
      p_rc_event_id,
      v_resolved_user_id,
      p_event_type,
      v_payload,
      p_received_at,
      p_app_user_id,
      p_original_app_user_id,
      p_aliases,
      v_resolved_user_id,
      p_environment,
      p_store,
      p_product_id,
      v_now,
      'error',
      'REVENUECAT_ATOMIC_PROCESSING_FAILED:' || v_failure_state,
      p_signature_verified,
      p_auth_verified,
      p_provider_event_at,
      p_original_transaction_id,
      p_transaction_id,
      p_transferred_from,
      p_transferred_to,
      p_projection_priority,
      false,
      v_attempts
    )
    on conflict (rc_event_id) do update
      set user_id = excluded.user_id,
          event_type = excluded.event_type,
          payload = excluded.payload,
          received_at = excluded.received_at,
          app_user_id = excluded.app_user_id,
          original_app_user_id = excluded.original_app_user_id,
          aliases = excluded.aliases,
          resolved_user_id = excluded.resolved_user_id,
          environment = excluded.environment,
          store = excluded.store,
          product_id = excluded.product_id,
          processed_at = excluded.processed_at,
          processing_status = 'error',
          error = excluded.error,
          signature_verified = excluded.signature_verified,
          auth_verified = excluded.auth_verified,
          provider_event_at = excluded.provider_event_at,
          original_transaction_id = excluded.original_transaction_id,
          transaction_id = excluded.transaction_id,
          transferred_from = excluded.transferred_from,
          transferred_to = excluded.transferred_to,
          projection_priority = excluded.projection_priority,
          projection_applied = false,
          processing_attempts = greatest(
            event_audit.processing_attempts,
            excluded.processing_attempts
          )
    where event_audit.processing_status in ('processing', 'error', 'unresolved_user');

    return query select 'error'::text, false, 'error'::text;
    return;
  end;
end;
$$;

create or replace function public._guard_revenuecat_entitlement_cursor_v0053()
returns trigger
language plpgsql
security definer
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
    new.verified_at := new.rc_snapshot_at;
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
      new.verified_at := new.rc_event_at;
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
      new.verified_at := new.rc_event_at;
      return new;
    end if;

    -- Only this migration's guarded reducer can publish a different combined
    -- materialization under an older/equal real provider tuple. The immutable
    -- server revision is assigned by the AFTER trigger, never supplied here.
    if new.raw_status -> '_onskin_reduction_v1' ->> 'epoch' = (
      select epoch::text from revenuecat_publication.admission where singleton
    ) and exists (
      select 1 from public.subscriptions_events e
       where e.rc_event_id = new.rc_event_id and e.user_id = new.user_id
         and e.resolved_user_id = new.user_id
         and e.transaction_id = new.rc_transaction_id
         and e.product_id = new.product_id and e.store = new.store
         and e.environment = new.environment
         and e.provider_event_at = new.rc_event_at
         and e.projection_priority = new.rc_event_priority
         and (e.auth_verified is true or e.signature_verified is true) and not coalesce(e.account_deletion_suppressed, false)
         and e.payload -> '_onskin_fact_v1' ->> 'epoch' = (
           select epoch::text from revenuecat_publication.admission where singleton
         )
    ) then
      new.rc_cursor_state := 'ordered';
      new.rc_snapshot_at := null;
      new.rc_snapshot_fingerprint := null;
      new.verified_at := new.rc_event_at;
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
    new.verified_at := new.rc_event_at;
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

-- One canonical wire body is captured on write, not recomputed on every read.
-- Revision is scoped to this backend's exact owner RevenueCat stream v1. Only
-- the decimal string crosses JSON; bigint overflow aborts atomically.
create function revenuecat_publication.canonical(p_row public.entitlements)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'state', case when p_row.rc_cursor_state = 'legacy_unknown' then 'legacy_unknown'
      when p_row.is_active and p_row.entitlement in ('pro', 'pro_plus')
      then 'active' else 'inactive' end,
    'row', pg_catalog.jsonb_build_object(
      'tier', p_row.entitlement,
      'is_active', p_row.rc_cursor_state <> 'legacy_unknown' and p_row.is_active
        and p_row.entitlement in ('pro', 'pro_plus'),
      'product_id', p_row.product_id, 'expires_at', p_row.expires_at,
      'store', p_row.store, 'period_type', p_row.period_type,
      'will_renew', p_row.will_renew, 'granted_at', p_row.original_purchase_at,
      'source', 'revenuecat', 'environment', p_row.environment,
      'management_url', p_row.management_url, 'verified_at', p_row.verified_at,
      'offering_id', p_row.offering_id, 'package_id', p_row.package_id,
      'cursor', case
        when p_row.rc_cursor_state = 'ordered' then pg_catalog.jsonb_build_object(
          'kind', 'rc_webhook', 'at', p_row.rc_event_at,
          'priority', p_row.rc_event_priority, 'event_id', p_row.rc_event_id)
        when p_row.rc_cursor_state = 'snapshot' then pg_catalog.jsonb_build_object(
          'kind', 'rc_snapshot', 'at', p_row.rc_snapshot_at,
          'fingerprint', p_row.rc_snapshot_fingerprint)
        else null end
    )
  );
$$;
revoke all on function revenuecat_publication.canonical(public.entitlements)
  from public, anon, authenticated, service_role;

create function revenuecat_publication.publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canonical jsonb;
  v_previous revenuecat_publication.projections%rowtype;
begin
  -- Migration51 also scrubs a foreign owner's raw identity fields while holding
  -- the deleted family's locks. It must not acquire that foreign owner's lock
  -- after locking its row (or republish time-derived expiry during the scrub).
  if tg_op = 'UPDATE' and new.store_user_id is null and new.raw_status = '{}'::jsonb
     and (pg_catalog.to_jsonb(new) - array['store_user_id','raw_status','updated_at'])
       is not distinct from
       (pg_catalog.to_jsonb(old) - array['store_user_id','raw_status','updated_at']) then
    return new;
  end if;
  -- The same lock used by webhook, snapshot and account deletion also covers
  -- service-role direct writes. Privacy scrubs do not change the wire fields.
  perform pg_catalog.pg_advisory_xact_lock(public._account_deletion_advisory_key(new.user_id));
  if not exists (select 1 from auth.users u where u.id = new.user_id)
     or exists (select 1 from public.account_deletion_barriers b where b.user_id = new.user_id) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = 'P0001';
  end if;
  v_canonical := revenuecat_publication.canonical(new);
  select p.* into v_previous from revenuecat_publication.projections p
    where p.user_id = new.user_id for update;
  if v_previous.user_id is null or v_previous.canonical is distinct from v_canonical then
    insert into revenuecat_publication.projections(user_id, revision, canonical)
      values (new.user_id, nextval('revenuecat_publication.revision_sequence'), v_canonical)
      on conflict (user_id) do update set revision = excluded.revision,
        canonical = excluded.canonical;
  end if;
  return new;
end;
$$;
revoke all on function revenuecat_publication.publish()
  from public, anon, authenticated, service_role;
create trigger publish_revenuecat_projection_v1
  after insert or update on public.entitlements
  for each row execute function revenuecat_publication.publish();

-- Initial publication wraps existing trusted materializations without treating
-- old raw event JSON as a newly admitted purchase. No history is reconciled.
insert into revenuecat_publication.projections(user_id, revision, canonical)
  select e.user_id, nextval('revenuecat_publication.revision_sequence'),
    revenuecat_publication.canonical(e)
    from public.entitlements e order by e.user_id;

-- Keep migration55's authenticated session/account fence exactly in place.
-- Only its private delegate changes the versioned publication representation.
create or replace function public._read_entitlement_projections_v0053_unfenced()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_store jsonb := pg_catalog.jsonb_build_object('state', 'absent', 'row', null);
  v_publication revenuecat_publication.projections%rowtype;
  v_app_grant public.reverse_trial_grants%rowtype;
  v_app_state text := 'absent';
  v_app_row jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATED_SUBJECT_REQUIRED' using errcode = '28000';
  end if;
  -- Sidecar retention can never make a deleted entitlement visible. Its only
  -- purpose after row replacement is preserving revision order, not paid proof.
  select p.* into v_publication from revenuecat_publication.projections p
    join public.entitlements e on e.user_id = p.user_id
    where p.user_id = v_user_id;
  if v_publication.user_id is not null then
    v_store := v_publication.canonical;
    if v_store ->> 'state' <> 'legacy_unknown' then
      v_store := pg_catalog.jsonb_set(v_store, '{row,cursor}',
        pg_catalog.jsonb_build_object('kind', 'server_projection', 'version', 1,
          'stream_id', v_user_id::text, 'revision', v_publication.revision::text,
          'provider', v_publication.canonical -> 'row' -> 'cursor'));
    end if;
  elsif exists (select 1 from public.entitlements e where e.user_id = v_user_id) then
    -- A missing publication cannot fall back to unversioned positive authority.
    raise exception 'ENTITLEMENT_PUBLICATION_REQUIRED' using errcode = 'P0001';
  end if;
  select g.* into v_app_grant from public.reverse_trial_grants g where g.user_id = v_user_id;
  if v_app_grant.user_id is not null then
    v_app_state := case when v_app_grant.expires_at > v_now then 'active' else 'inactive' end;
    v_app_row := pg_catalog.jsonb_build_object(
      'tier', 'pro', 'is_active', v_app_grant.expires_at > v_now,
      'product_id', null, 'expires_at', v_app_grant.expires_at,
      'store', 'app_granted', 'period_type', 'reverse_trial', 'will_renew', false,
      'granted_at', v_app_grant.granted_at, 'source', 'app_granted',
      'environment', case when v_app_grant.metadata ->> 'environment' in ('production', 'development')
        then v_app_grant.metadata ->> 'environment' else 'unknown' end,
      'management_url', null, 'verified_at', v_app_grant.granted_at,
      'offering_id', null, 'package_id', null, 'cursor', null);
  end if;
  return pg_catalog.jsonb_build_object('schema_version', 2,
    'store_projection', v_store,
    'app_grant_projection', pg_catalog.jsonb_build_object('state', v_app_state, 'row', v_app_row));
end;
$$;
revoke all on function public._read_entitlement_projections_v0053_unfenced()
  from public, anon, authenticated, service_role;
comment on function public.read_entitlement_projections() is
  'Authenticated exact-owner schema-v2 projection: immutable server_projection v1 cursor with lossless revision plus unchanged provider provenance. Requires the coordinated v2 evidence/cache client.';

commit;
