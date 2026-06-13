-- =============================================================================
-- 0006 · routines + routine_steps
-- =============================================================================
create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('AM', 'PM', 'custom')),
  name       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index routines_user_id_idx on public.routines (user_id);

create table public.routine_steps (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references public.routines (id) on delete cascade,
  user_product_id uuid references public.user_products (id) on delete set null,
  step_order      int  not null,
  frequency       text not null default 'daily' check (frequency in ('daily', 'skin_cycling', 'every_n_days')),
  cycling_night   int  check (cycling_night between 1 and 4),  -- 1=exfoliation 2=retinoid 3-4=recovery
  -- NOTE: the 'every_n_days' frequency value is in docs/01 §3, but the doc does
  -- NOT specify a column to store the interval. Per CLAUDE.md (don't invent
  -- schema), the interval column is intentionally omitted. BLOCKED: B-EVERY-N-DAYS.
  instructions    text,
  created_at      timestamptz not null default now()
);
create index routine_steps_routine_id_idx on public.routine_steps (routine_id);
create index routine_steps_user_product_id_idx on public.routine_steps (user_product_id);

-- SECURITY DEFINER helper so the routine_steps policy doesn't JOIN inside the
-- policy expression (the documented Supabase RLS performance pattern, docs/01 §3).
create or replace function public.owns_routine(p_routine_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.user_id = (select auth.uid())
  );
$$;
-- owns_routine IS referenced inside RLS policies, so the authenticated role must
-- be able to execute it; deny everyone else (RLS review hardening).
revoke all on function public.owns_routine(uuid) from public, anon;
grant execute on function public.owns_routine(uuid) to authenticated;

alter table public.routines enable row level security;
alter table public.routine_steps enable row level security;

-- routines: owner-only.
create policy "routines_select_own" on public.routines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "routines_insert_own" on public.routines
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "routines_update_own" on public.routines
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "routines_delete_own" on public.routines
  for delete to authenticated using ((select auth.uid()) = user_id);

-- routine_steps: ownership flows through the parent routine.
create policy "routine_steps_select_own" on public.routine_steps
  for select to authenticated using (public.owns_routine(routine_id));
create policy "routine_steps_insert_own" on public.routine_steps
  for insert to authenticated with check (public.owns_routine(routine_id));
create policy "routine_steps_update_own" on public.routine_steps
  for update to authenticated using (public.owns_routine(routine_id))
  with check (public.owns_routine(routine_id));
create policy "routine_steps_delete_own" on public.routine_steps
  for delete to authenticated using (public.owns_routine(routine_id));

create trigger trg_routines_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();
