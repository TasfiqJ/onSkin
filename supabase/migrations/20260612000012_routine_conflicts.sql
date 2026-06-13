-- =============================================================================
-- 0012 · routine_conflicts  (per-user, owner-only) — docs/02 §3
-- =============================================================================
-- Materialised, explainable record of detected interactions for a user's
-- shelf/routines + the user's chosen resolution. Recomputed on shelf/routine
-- change by the (tested) client engine and upserted here (owner RLS). This is a
-- cache of the user's OWN data referencing service-controlled rules, so a
-- client-computed cache carries no cross-user/privilege risk.
--
-- DECISIONS D-021: the doc's server-authoritative `detect_conflicts(uid)`
-- SECURITY DEFINER function is intentionally deferred — a single tested TS
-- implementation (docs/02 §10 client detector, with fixture tests) is safer for
-- this liability surface than an untestable PL/pgSQL twin that could diverge.
-- Add it once there's a live DB to test against (BLOCKED: B-SERVER-DETECT).
create table public.routine_conflicts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  rule_id           uuid not null references public.conflict_rules (id),
  product_a_id      uuid references public.user_products (id) on delete cascade,
  product_b_id      uuid references public.user_products (id) on delete cascade,
  computed_severity text not null check (computed_severity in ('none', 'mild', 'moderate', 'high')),
  status            text not null default 'suggested' check (status in ('suggested', 'accepted', 'overridden', 'dismissed')),
  user_choice       text,
  rule_version      int,                 -- which rule_version produced this row (docs/02 §9 audit)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index routine_conflicts_user_idx on public.routine_conflicts (user_id);
create index routine_conflicts_rule_idx on public.routine_conflicts (rule_id);
create index routine_conflicts_product_a_idx on public.routine_conflicts (product_a_id);
create index routine_conflicts_product_b_idx on public.routine_conflicts (product_b_id);

-- Ownership helper for the referenced products (mirrors owns_routine in 0006;
-- DECISIONS D-014 pattern). FKs only check existence, not ownership.
create or replace function public.owns_user_product(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.user_products up
    where up.id = p_product_id and up.user_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_user_product(uuid) from public, anon;
grant execute on function public.owns_user_product(uuid) to authenticated;

alter table public.routine_conflicts enable row level security;

create policy "routine_conflicts_select_own" on public.routine_conflicts
  for select to authenticated using ((select auth.uid()) = user_id);
-- INSERT/UPDATE prove ownership of the row AND of any referenced products, so a
-- user can't poison their cache with another user's product UUIDs (RLS review).
create policy "routine_conflicts_insert_own" on public.routine_conflicts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (product_a_id is null or public.owns_user_product(product_a_id))
    and (product_b_id is null or public.owns_user_product(product_b_id))
  );
create policy "routine_conflicts_update_own" on public.routine_conflicts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (product_a_id is null or public.owns_user_product(product_a_id))
    and (product_b_id is null or public.owns_user_product(product_b_id))
  );
create policy "routine_conflicts_delete_own" on public.routine_conflicts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- NOTE (RLS review, accepted by-design): rule_id may reference a now-inactive
-- conflict_rule. This is intentional — routine_conflicts is an audit cache and
-- `rule_version` records which version produced the row (docs/02 §9).

create trigger trg_routine_conflicts_updated_at
  before update on public.routine_conflicts
  for each row execute function public.set_updated_at();
