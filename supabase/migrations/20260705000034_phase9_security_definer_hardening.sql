-- =============================================================================
-- Phase 9 security-definer hardening
-- =============================================================================
-- Keep SECURITY DEFINER helpers on an empty search_path and make executable
-- privileges explicit. This migration is intentionally final/effective-schema
-- hardening for functions introduced earlier in the migration history.

create or replace function public.owns_photo(p_photo_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.photos
    where id = p_photo_id and user_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_photo(uuid) from public, anon;
grant execute on function public.owns_photo(uuid) to authenticated;

create or replace function public.expire_app_granted_reverse_trials()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.entitlements
     set is_active = false,
         will_renew = false,
         updated_at = now(),
         last_reconciled_at = now()
   where store = 'app_granted'
     and period_type = 'reverse_trial'
     and is_active = true
     and expires_at is not null
     and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.expire_app_granted_reverse_trials() from public, anon, authenticated;
grant execute on function public.expire_app_granted_reverse_trials() to service_role;
