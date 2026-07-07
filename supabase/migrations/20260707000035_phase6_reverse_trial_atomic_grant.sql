-- =============================================================================
-- Phase 6 reverse-trial atomic grant hardening
-- =============================================================================
-- Keep the one-time reverse-trial audit row and entitlement mirror write inside
-- one transaction. The Edge Function calls this with the service role only.

create or replace function public.grant_app_granted_reverse_trial(
  p_user_id uuid,
  p_expires_at timestamptz,
  p_environment text,
  p_product_id text
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
      p_product_id,
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

revoke all on function public.grant_app_granted_reverse_trial(uuid, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.grant_app_granted_reverse_trial(uuid, timestamptz, text, text) to service_role;
