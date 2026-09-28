-- =============================================================================
-- 0076 - Compare consent receipt time with the current statement, not BEGIN
-- =============================================================================
-- Health consent RPCs stamp receipts with clock_timestamp(). A later statement
-- in the same transaction must not misclassify that legitimate receipt as
-- future-dated just because now() is frozen at transaction start. Keep the
-- future-receipt fail-closed rule at the statement boundary; a receipt dated
-- after the current statement remains inadmissible. This changes no RLS policy,
-- grant, ledger row, or release status.

begin;
set local lock_timeout = '5s';

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
         and future.granted_at > pg_catalog.statement_timestamp()
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
       and future.granted_at > pg_catalog.statement_timestamp()
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

commit;
