-- App-granted reverse trials are not App Store or RevenueCat products. Move
-- current callers to a three-argument RPC and make persisted store identity
-- null at the database boundary, not only in the current Edge caller.

begin;

update public.entitlements
set product_id = null,
    offering_id = null,
    package_id = null
where store = 'app_granted'
  and period_type = 'reverse_trial'
  and (product_id is not null or offering_id is not null or package_id is not null);

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
  perform public.expire_app_granted_reverse_trials();

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
    jsonb_build_object('action', 'start_reverse_trial')
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
      jsonb_build_object('action', 'start_reverse_trial', 'days', 7)
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

-- Zero-downtime compatibility for the previously deployed Edge Function. This
-- overload deliberately ignores its fourth argument and delegates to the
-- null-enforcing implementation above. Remove it only after hosted deployment
-- evidence proves every caller uses the three-argument signature.
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
) from public, anon, authenticated;
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
) from public, anon, authenticated;
grant execute on function public.grant_app_granted_reverse_trial(
  uuid,
  timestamptz,
  text,
  text
) to service_role;

commit;
