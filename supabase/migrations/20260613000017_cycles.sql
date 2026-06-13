-- =============================================================================
-- 0017 · Cycles  (docs/05 §3)
-- =============================================================================
-- The skin-cycle as a STORED, VERSIONED data object + its per-night slot
-- assignment. `cycling_night` on routine_steps (0006) records which night a step
-- belongs to, but the cycle itself (variant, length, anchor, per-night slot) had
-- nowhere to live (docs/05 §3, DECISIONS D-034). No change to routines/
-- routine_steps/routine_completions — they already carry frequency/cycling_night.
--
-- v1 keeps the live cycle in a local-first store (D-029 pattern, offline-first
-- docs/05 §10); this schema is the forward-compatible server target (B-SUPABASE /
-- B-ROUTINE-PERSIST). Server-authoritative orchestrate()/schedule_for() are
-- deferred with B-SERVER-DETECT.

create table public.cycles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  variant       text not null default 'gentle'
                  check (variant in ('gentle', 'classic', 'advanced', 'custom')),
  length_nights int  not null default 4 check (length_nights between 1 and 14),
  anchor_date   date not null,                       -- the date night_index 0 fell on
  is_active     boolean not null default true,
  paused_from   date,                                -- non-null while paused (§7)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index cycles_user_id_idx on public.cycles (user_id);
-- Only one active cycle per user is expected; edits version (new active row,
-- old superseded), preserving history (docs/05 §3).
create index cycles_user_active_idx on public.cycles (user_id, is_active);

create table public.cycle_nights (
  cycle_id        uuid not null references public.cycles (id) on delete cascade,
  night_index     int  not null check (night_index >= 0),  -- 0 .. length_nights-1
  slot            text not null
                    check (slot in ('exfoliation', 'retinoid', 'recovery', 'other_active')),
  user_product_id uuid references public.user_products (id) on delete set null,
  primary key (cycle_id, night_index)
);

-- --- ownership helper for the child table (mirrors owns_routine, 0006) --------
create or replace function public.owns_cycle(p_cycle_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.cycles c
    where c.id = p_cycle_id and c.user_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_cycle(uuid) from public, anon;
grant execute on function public.owns_cycle(uuid) to authenticated;

-- --- RLS (owner-only, docs/01 §3 pattern) ------------------------------------
alter table public.cycles enable row level security;

create policy "cycles_select_own" on public.cycles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cycles_insert_own" on public.cycles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cycles_update_own" on public.cycles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "cycles_delete_own" on public.cycles
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.cycle_nights enable row level security;

-- cycle_nights ownership is proven via the parent cycle (FKs only check existence).
create policy "cycle_nights_select_own" on public.cycle_nights
  for select to authenticated using (public.owns_cycle(cycle_id));
create policy "cycle_nights_insert_own" on public.cycle_nights
  for insert to authenticated with check (public.owns_cycle(cycle_id));
create policy "cycle_nights_update_own" on public.cycle_nights
  for update to authenticated
  using (public.owns_cycle(cycle_id))
  with check (public.owns_cycle(cycle_id));
create policy "cycle_nights_delete_own" on public.cycle_nights
  for delete to authenticated using (public.owns_cycle(cycle_id));

create trigger trg_cycles_updated_at
  before update on public.cycles
  for each row execute function public.set_updated_at();
