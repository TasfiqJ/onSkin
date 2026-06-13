-- =============================================================================
-- 0004 · skin_profiles  (quiz results — HEALTH-INFERENCE DATA)
-- =============================================================================
-- Gated behind the health_data_collection consent at the app layer (docs/01 §4);
-- the row itself is owner-only at the DB layer.
create table public.skin_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  oily_dry            int,   -- axis scores (docs/01 §3, original 4-axis quiz)
  sensitive_resistant int,
  pigmented_non       int,
  wrinkled_tight      int,
  fitzpatrick         int check (fitzpatrick between 1 and 6),
  monk_tone           int check (monk_tone between 1 and 10),
  sensitivities       text[] not null default '{}',
  pregnancy_status    text check (pregnancy_status in ('none', 'pregnant', 'breastfeeding', 'prefer_not')),
  goals               text[] not null default '{}',
  completed_at        timestamptz,
  version             int not null default 1,
  created_at          timestamptz not null default now()
);
create index skin_profiles_user_id_idx on public.skin_profiles (user_id);

alter table public.skin_profiles enable row level security;

create policy "skin_profiles_select_own" on public.skin_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "skin_profiles_insert_own" on public.skin_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "skin_profiles_update_own" on public.skin_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "skin_profiles_delete_own" on public.skin_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);
