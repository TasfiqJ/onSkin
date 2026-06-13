-- =============================================================================
-- 0001 · Extensions + shared helper functions
-- =============================================================================
-- Conventions enforced across ALL migrations (docs/01 §3 "RLS verification rules"):
--   * RLS enabled on every table in `public`.
--   * Every policy wraps auth.uid() as (select auth.uid()) for initPlan caching.
--   * Every policy is scoped `to authenticated` (short-circuits for anon role).
--   * Every policy column is indexed.
--   * Every INSERT/UPDATE policy carries WITH CHECK.
--   * Cross-table checks go through SECURITY DEFINER helpers with search_path=''.

create extension if not exists pgcrypto;        -- gen_random_uuid()

-- Generic updated_at touch trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
-- Trigger-only function: not client-callable as an RPC (RLS review hardening).
revoke all on function public.set_updated_at() from public, anon, authenticated;
