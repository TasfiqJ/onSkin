-- Serialize the remaining service-owned account writers against the durable
-- deletion barrier. Direct service-role table mutation is removed so these
-- guarded RPCs (and the already-guarded RevenueCat projection RPC) are the only
-- mutation paths.

begin;

-- The Edge caller runs the global expiry RPC as its own committed request
-- before this grant. Inside the grant, expire only this account after taking
-- the shared advisory lock. A global entitlement update and an account lock in
-- one transaction would invert deletion's account-lock-then-row-lock order.
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
  now_at timestamptz := now();
  normalized_environment text :=
    case
      when p_environment in ('production', 'development') then p_environment
      else 'unknown'
    end;
begin
  if not public.account_write_allowed(p_user_id) then
    raise exception 'ACCOUNT_DELETION_IN_PROGRESS' using errcode = 'P0001';
  end if;

  update public.entitlements
     set is_active = false,
         will_renew = false,
         updated_at = now_at,
         last_reconciled_at = now_at
   where user_id = p_user_id
     and store = 'app_granted'
     and period_type = 'reverse_trial'
     and is_active = true
     and expires_at is not null
     and expires_at <= now_at;

  select *
    into current_entitlement
    from public.entitlements
   where user_id = p_user_id
   for update;

  if current_entitlement.user_id is not null
     and current_entitlement.is_active
     and (
       current_entitlement.expires_at is null
       or current_entitlement.expires_at > now_at
     )
     and not (
       current_entitlement.store = 'app_granted'
       and current_entitlement.period_type = 'reverse_trial'
     ) then
    raise exception 'ACTIVE_SUBSCRIPTION_EXISTS';
  end if;

  insert into public.reverse_trial_grants (
    user_id,
    granted_at,
    expires_at,
    source,
    metadata
  )
  values (
    p_user_id,
    now_at,
    p_expires_at,
    'server',
    pg_catalog.jsonb_build_object('action', 'start_reverse_trial')
  )
  on conflict (user_id) do nothing
  returning * into inserted_grant;

  if inserted_grant.user_id is null then
    raise exception 'REVERSE_TRIAL_ALREADY_USED';
  end if;

  return query
    insert into public.entitlements (
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
      package_id,
      source,
      environment,
      management_url,
      verified_at,
      store_user_id,
      last_reconciled_at,
      raw_status
    )
    values (
      p_user_id,
      'pro',
      true,
      null,
      p_expires_at,
      null,
      now_at,
      'app_granted',
      'reverse_trial',
      false,
      now_at,
      null,
      null,
      'app_granted',
      normalized_environment,
      null,
      now_at,
      p_user_id::text,
      now_at,
      pg_catalog.jsonb_build_object('action', 'start_reverse_trial', 'days', 7)
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
          package_id = excluded.package_id,
          source = excluded.source,
          environment = excluded.environment,
          management_url = excluded.management_url,
          verified_at = excluded.verified_at,
          store_user_id = excluded.store_user_id,
          last_reconciled_at = excluded.last_reconciled_at,
          raw_status = excluded.raw_status
    returning public.entitlements.*;
end;
$$;

-- Preserve the deployed four-argument compatibility signature while routing
-- it through the same guarded implementation. App-granted trials never carry
-- an App Store or RevenueCat product identity.
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
  uuid,
  timestamptz,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.grant_app_granted_reverse_trial(
  uuid,
  timestamptz,
  text
) to service_role;

revoke all on function public.grant_app_granted_reverse_trial(
  uuid,
  timestamptz,
  text,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.grant_app_granted_reverse_trial(
  uuid,
  timestamptz,
  text,
  text
) to service_role;

-- The correction ID is the only caller-supplied input. Ownership, barcode,
-- correction type, and payload are re-read from the owner-scoped correction
-- after taking the shared account lock. A deletion barrier or already-removed
-- Auth subject is a successful suppression, not a queueing error.
create or replace function public.enqueue_obf_contribution_for_correction(
  p_correction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_initial_user_id uuid;
  v_user_id uuid;
  v_barcode text;
  v_payload jsonb;
  v_correction_type text;
  v_queue_id uuid;
begin
  if p_correction_id is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'correction_missing',
      'enqueued', false
    );
  end if;

  -- This first read only discovers the account lock key. Do not take a row lock
  -- before the advisory lock; deletion consistently takes the advisory lock
  -- first. The correction is re-read and key-locked below.
  select corrections.user_id
    into v_initial_user_id
    from public.catalog_corrections as corrections
   where corrections.id = p_correction_id;

  if not found or v_initial_user_id is null then
    return pg_catalog.jsonb_build_object(
      'outcome', 'correction_missing',
      'enqueued', false
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    public._account_deletion_advisory_key(v_initial_user_id)
  );

  select
    corrections.user_id,
    corrections.barcode,
    corrections.proposed_payload,
    corrections.correction_type
    into v_user_id, v_barcode, v_payload, v_correction_type
    from public.catalog_corrections as corrections
   where corrections.id = p_correction_id
   for key share;

  if not found or v_user_id is distinct from v_initial_user_id then
    return pg_catalog.jsonb_build_object(
      'outcome', 'correction_missing',
      'enqueued', false
    );
  end if;

  if not exists (
    select 1 from auth.users as users where users.id = v_user_id
  ) or exists (
    select 1
      from public.account_deletion_barriers as barriers
     where barriers.user_id = v_user_id
  ) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'account_deletion_in_progress',
      'enqueued', false
    );
  end if;

  if v_correction_type <> 'missing_product' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'correction_not_eligible',
      'enqueued', false
    );
  end if;

  -- Retried Edge requests must not create duplicate contribution work for the
  -- same correction. Existing historical duplicates are left untouched.
  select queue.id
    into v_queue_id
    from public.obf_contribution_queue as queue
   where queue.correction_id = p_correction_id
   order by queue.created_at, queue.id
   limit 1;

  if found then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_enqueued',
      'enqueued', true
    );
  end if;

  insert into public.obf_contribution_queue (
    correction_id,
    user_id,
    barcode,
    payload,
    status,
    hold_reason
  ) values (
    p_correction_id,
    v_user_id,
    v_barcode,
    v_payload,
    'held',
    'awaiting_source_review_and_moderation'
  )
  returning id into v_queue_id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'enqueued',
    'enqueued', true
  );
end;
$$;

revoke all on function public.enqueue_obf_contribution_for_correction(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_obf_contribution_for_correction(uuid)
  to service_role;

-- Service clients retain read access for owner-filtered export and provider
-- reconciliation, but all direct mutation must pass through guarded definer
-- functions.
revoke insert, update, delete, truncate on table public.entitlements
  from service_role;
revoke insert, update, delete, truncate on table public.reverse_trial_grants
  from service_role;
revoke insert, update, delete, truncate on table public.obf_contribution_queue
  from service_role;

grant select on table public.entitlements to service_role;
grant select on table public.reverse_trial_grants to service_role;
grant select on table public.obf_contribution_queue to service_role;

comment on function public.grant_app_granted_reverse_trial(uuid, timestamptz, text) is
  'Under the shared account advisory lock, expires only the target account and grants only for a live Auth subject without a deletion barrier; callers run global expiry in a separate transaction first.';
comment on function public.enqueue_obf_contribution_for_correction(uuid) is
  'Derives a held OBF contribution from one stored correction under the shared account lock and succeeds without enqueueing when deletion is active.';

commit;
