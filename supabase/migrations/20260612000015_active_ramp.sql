-- =============================================================================
-- 0015 · active_ramp  (retinoid/active ramp-up scheduler, docs/03 §4)
-- =============================================================================
-- "Start low and slow" modelled as per-user, recomputable state (DECISIONS D-023):
-- offer-only step-ups, automatic de-escalation on self-reported irritation. Final
-- cadence numbers are a B-DERM-REVIEW item (medical-adjacent). Owner-only RLS
-- exactly per docs/01 §3.
create table public.active_ramp (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  user_product_id uuid not null references public.user_products (id) on delete cascade,
  ramp_class      text not null check (ramp_class in ('retinoid', 'aha', 'bha', 'other_active')),
  freq_per_week   int  not null,                 -- current scheduled nights/week
  target_per_week int  not null,                 -- e.g. 3–4 for tolerated nightly-ish use
  started_at      date not null default current_date,
  last_step_up    date,
  next_review_at  date,                           -- when to OFFER (never force) a step-up
  tolerance_state text not null default 'building' check (tolerance_state in ('building', 'steady', 'paused_irritation')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, user_product_id)
);
create index active_ramp_user_idx on public.active_ramp (user_id);
create index active_ramp_product_idx on public.active_ramp (user_product_id);

alter table public.active_ramp enable row level security;

create policy "active_ramp_select_own" on public.active_ramp
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "active_ramp_insert_own" on public.active_ramp
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.owns_user_product(user_product_id));
create policy "active_ramp_update_own" on public.active_ramp
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_user_product(user_product_id));
create policy "active_ramp_delete_own" on public.active_ramp
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger trg_active_ramp_updated_at
  before update on public.active_ramp
  for each row execute function public.set_updated_at();
