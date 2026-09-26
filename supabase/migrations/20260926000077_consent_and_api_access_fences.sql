-- =============================================================================
-- 0077 - Restore exact-session consent and sealed API access fences
-- =============================================================================
-- Migration 0057 replaced the Apple-aware consent helper introduced by 0055.
-- Keep the 0076 statement-time correction, but branch through the exact-session
-- account fence before a SECURITY DEFINER helper can inspect consent rows.
-- Also close two historical API surfaces exposed by the complete migration
-- chain: the retired conflict-choice writer and ambient public/private function
-- execution for the dedicated catalog-operator login.

begin;
set local lock_timeout = '5s';

create or replace function public.has_current_consent(p_consent_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
volatile
as $$
begin
  if not public.account_access_allowed() then
    return false;
  end if;

  if exists (
    select 1
      from public.consents future
     where future.user_id = (select auth.uid())
       and future.consent_type = p_consent_type
       and future.granted_at > pg_catalog.statement_timestamp()
  ) then
    return false;
  end if;

  return coalesce((
    select consent.granted
      from public.consents as consent
     where consent.user_id = (select auth.uid())
       and consent.consent_type = p_consent_type
     order by consent.granted_at desc, consent.granted asc, consent.id desc
     limit 1
  ), false);
end;
$$;
revoke all on function public.has_current_consent(text)
  from public, anon, service_role, catalog_operator_edge;
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
volatile
as $$
declare
  v_user_id uuid;
  v_matches boolean;
begin
  if not public.account_access_allowed() then
    return false;
  end if;

  v_user_id := (select auth.uid());
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
       and future.granted_at > pg_catalog.statement_timestamp()
  ) then
    return false;
  end if;

  select
    consent.granted
    and consent.version = p_version
    and consent.consent_text_hash = p_consent_text_hash
    into v_matches
    from public.consents as consent
   where consent.user_id = v_user_id
     and consent.consent_type = p_consent_type
   order by consent.granted_at desc, consent.granted asc, consent.id desc
   limit 1;

  return coalesce(v_matches, false);
end;
$$;
revoke all on function public.has_current_exact_consent(text, text, text)
  from public, anon, service_role, catalog_operator_edge;
grant execute on function public.has_current_exact_consent(text, text, text)
  to authenticated;

-- This RPC reads the sealed, unreviewed legacy conflict-rule relation and has
-- no production caller. Keep the historical function for rollback forensics,
-- but remove every runtime execution lane.
revoke all on function public.apply_conflict_choice_outbox_batch(jsonb)
  from public, anon, authenticated, service_role, catalog_operator_edge;

-- The catalog-operator login may execute only the six functions in the
-- non-API gateway schema. Reassert that invariant after every later migration
-- that created or replaced public/private functions.
revoke execute on all functions in schema public, private
  from catalog_operator_edge;

commit;
