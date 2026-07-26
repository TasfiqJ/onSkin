-- =============================================================================
-- Health-profile cloud writes require the current collection consent
-- =============================================================================
-- Authenticated clients never own the ledger clock. This preserves immutable
-- arrival ordering without changing service-role/account-deletion behavior.

create or replace function public.order_health_consent_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data_collection' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'health-consent:' || new.user_id::text,
        0
      )
    );
  end if;
  if current_user = 'authenticated' then
    new.granted_at := pg_catalog.clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_consents_authenticated_granted_at on public.consents;
drop trigger if exists trg_consents_health_consent_ordering on public.consents;
-- PostgreSQL fires same-kind triggers alphabetically. "health" sorts after the
-- existing trg_consents_account_deletion_freeze trigger, preserving account-
-- deletion -> health-consent lock order across consent and profile writes.
create trigger trg_consents_health_consent_ordering
  before insert on public.consents
  for each row execute function public.order_health_consent_insert();

-- A legacy future-dated row is an unreadable ordering horizon, not permission.
-- Recreate the generic helper fail-closed so no consent-gated table can treat
-- such a row as a grant while the server clock has not reached it.
create or replace function public.has_current_consent(p_consent_type text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when exists (
      select 1
        from public.consents future
       where future.user_id = (select auth.uid())
         and future.consent_type = p_consent_type
         and future.granted_at > now()
    ) then false
    else coalesce((
      select c.granted
        from public.consents c
       where c.user_id = (select auth.uid())
         and c.consent_type = p_consent_type
       order by c.granted_at desc, c.granted asc
       limit 1
    ), false)
  end;
$$;
revoke all on function public.has_current_consent(text) from public, anon;
grant execute on function public.has_current_consent(text) to authenticated;

create or replace function public.has_current_exact_consent(
  p_consent_type text,
  p_version text,
  p_consent_text_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_matches boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('health-consent:' || v_user_id::text, 0)
  );

  if exists (
    select 1
      from public.consents future
     where future.user_id = v_user_id
       and future.consent_type = p_consent_type
       and future.granted_at > pg_catalog.now()
  ) then
    return false;
  end if;

  select
    c.granted
    and c.version = p_version
    and c.consent_text_hash = p_consent_text_hash
    into v_matches
    from public.consents c
   where c.user_id = v_user_id
     and c.consent_type = p_consent_type
   order by c.granted_at desc, c.granted asc
   limit 1;

  return coalesce(v_matches, false);
end;
$$;
revoke all on function public.has_current_exact_consent(text, text, text)
  from public, anon;
grant execute on function public.has_current_exact_consent(text, text, text)
  to authenticated;

-- Keep the existing owner-only permissive policies. These restrictive policies
-- are ANDed with every applicable permissive policy, so a future permissive
-- policy cannot accidentally bypass the exact health-data collection gate.

drop policy if exists "skin_profiles_insert_current_health_consent"
  on public.skin_profiles;
create policy "skin_profiles_insert_current_health_consent"
  on public.skin_profiles
  as restrictive
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.has_current_exact_consent(
      'health_data_collection',
      'draft-v1-2026-07-10',
      '7957a2811fff0e8cefc6f7180b751ec45688fe99421978eedae05b96c2f251fd'
    )
  );

-- V1 has no authenticated profile-update producer. Remove the legacy UPDATE
-- surface instead of retaining a wider consent-gated capability.
drop policy if exists "skin_profiles_update_current_health_consent"
  on public.skin_profiles;
drop policy if exists "skin_profiles_update_own" on public.skin_profiles;
revoke update on table public.skin_profiles from public, anon, authenticated;
