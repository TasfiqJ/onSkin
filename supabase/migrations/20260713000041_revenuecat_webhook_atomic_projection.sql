-- =============================================================================
-- RevenueCat webhook: atomic event audit + ordered entitlement projection
-- =============================================================================
-- One service-role RPC now owns identity resolution, event-id idempotency, stale
-- event detection, the entitlement projection, and processing status. Postgres
-- serializes concurrent projection upserts by user_id; the ordering tuple is
-- provider event time, lifecycle priority, then event id for a deterministic tie.

alter table public.subscriptions_events
  add column if not exists provider_event_at timestamptz,
  add column if not exists original_transaction_id text,
  add column if not exists transaction_id text,
  add column if not exists transferred_from text[],
  add column if not exists transferred_to text[],
  add column if not exists projection_priority smallint,
  add column if not exists projection_applied boolean not null default false,
  add column if not exists processing_attempts integer not null default 0;

alter table public.entitlements
  add column if not exists rc_event_at timestamptz,
  add column if not exists rc_event_priority smallint,
  add column if not exists rc_original_transaction_id text,
  add column if not exists rc_transaction_id text;

alter table public.subscriptions_events
  drop constraint if exists subscriptions_events_rc_event_id_nonempty,
  add constraint subscriptions_events_rc_event_id_nonempty
    check (rc_event_id is not null and length(btrim(rc_event_id)) > 0) not valid;

create index if not exists subscriptions_events_resolved_provider_event_idx
  on public.subscriptions_events (resolved_user_id, provider_event_at desc)
  where resolved_user_id is not null;

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
      coalesce(p_payload, '{}'::jsonb),
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

      v_attempts := greatest(coalesce(v_existing.processing_attempts, 0) + 1, 1);
      v_event_row_id := v_existing.id;

      -- Error and unresolved-user rows are explicit replay/dead-letter records.
      -- Re-delivery retries them without creating a second audit row.
      update public.subscriptions_events
         set user_id = v_resolved_user_id,
             event_type = p_event_type,
             payload = coalesce(p_payload, '{}'::jsonb),
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

    if v_resolved_user_id is null then
      v_processing_status := 'unresolved_user';
    elsif not p_should_project then
      v_processing_status := 'ignored_event_type';
    else
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
        verified_at,
        store_user_id,
        last_reconciled_at,
        raw_status,
        rc_event_at,
        rc_event_priority,
        rc_original_transaction_id,
        rc_transaction_id
      )
      values (
        v_resolved_user_id,
        case when p_entitlement = 'pro_plus' then 'pro_plus' else 'pro' end,
        p_is_active,
        p_product_id,
        p_expiration_at,
        p_rc_event_id,
        v_now,
        p_store,
        p_period_type,
        p_will_renew,
        p_original_purchase_at,
        p_offering_id,
        'revenuecat',
        p_environment,
        v_now,
        coalesce(p_app_user_id, p_original_app_user_id, v_resolved_user_id::text),
        v_now,
        coalesce(p_payload -> 'event', '{}'::jsonb),
        p_provider_event_at,
        p_projection_priority,
        p_original_transaction_id,
        p_transaction_id
      )
      on conflict (user_id) do update
        set entitlement = excluded.entitlement,
            is_active = excluded.is_active,
            product_id = excluded.product_id,
            expires_at = excluded.expires_at,
            rc_event_id = excluded.rc_event_id,
            updated_at = excluded.updated_at,
            store = excluded.store,
            period_type = excluded.period_type,
            will_renew = excluded.will_renew,
            original_purchase_at = excluded.original_purchase_at,
            offering_id = excluded.offering_id,
            source = excluded.source,
            environment = excluded.environment,
            verified_at = excluded.verified_at,
            store_user_id = excluded.store_user_id,
            last_reconciled_at = excluded.last_reconciled_at,
            raw_status = excluded.raw_status,
            rc_event_at = excluded.rc_event_at,
            rc_event_priority = excluded.rc_event_priority,
            rc_original_transaction_id = excluded.rc_original_transaction_id,
            rc_transaction_id = excluded.rc_transaction_id
      where entitlement_projection.rc_event_at is null
         or excluded.rc_event_at > entitlement_projection.rc_event_at
         or (
           excluded.rc_event_at = entitlement_projection.rc_event_at
           and excluded.rc_event_priority > coalesce(entitlement_projection.rc_event_priority, 0)
         )
         or (
           excluded.rc_event_at = entitlement_projection.rc_event_at
           and excluded.rc_event_priority = coalesce(entitlement_projection.rc_event_priority, 0)
           and pg_catalog.convert_to(excluded.rc_event_id, 'UTF8')
             > pg_catalog.convert_to(coalesce(entitlement_projection.rc_event_id, ''), 'UTF8')
         )
      returning user_id into v_entitlement_user_id;

      v_processing_status :=
        case when v_entitlement_user_id is null then 'stale' else 'processed' end;
    end if;

    update public.subscriptions_events
       set processed_at = v_now,
           processing_status = v_processing_status,
           error = null,
           projection_applied = v_entitlement_user_id is not null
     where id = v_event_row_id;

    return query
      select
        case
          when v_processing_status = 'processed' then 'processed'
          when v_processing_status = 'stale' then 'stale'
          when v_processing_status = 'unresolved_user' then 'unresolved'
          else 'ignored'
        end,
        v_entitlement_user_id is not null,
        v_processing_status;
    return;
  exception when others then
    -- The nested block is a subtransaction: event claim and projection are both
    -- rolled back before this content-minimized retry record is written.
    v_failure_state := sqlstate;
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
      coalesce(p_payload, '{}'::jsonb),
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

comment on function public.process_revenuecat_webhook_event(
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
) is 'Atomically records a RevenueCat event and applies it only when its provider ordering tuple is newer; error rows are replayable with the same event id.';

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
) from public, anon, authenticated;

grant execute on function public.process_revenuecat_webhook_event(
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
