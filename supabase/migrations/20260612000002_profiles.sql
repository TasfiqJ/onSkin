-- =============================================================================
-- 0002 · profiles  (auth.users -> public.profiles)
-- =============================================================================
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  avatar_path    text,
  locale         text,
  units          text not null default 'metric' check (units in ('metric', 'imperial')),
  current_streak int  not null default 0,
  longest_streak int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Owner-only. (select auth.uid()) for initPlan caching; WITH CHECK on writes.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile on signup. DEFENSIVE per docs/01 §3: this runs inside
-- the auth transaction, so any error here would BLOCK signups. We swallow
-- exceptions and ON CONFLICT DO NOTHING so a signup never fails because of it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- Never block signup. A client-side fallback can create the profile later.
    return new;
end;
$$;

-- Auth-trigger function only — not client-callable as an RPC (RLS review hardening).
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
