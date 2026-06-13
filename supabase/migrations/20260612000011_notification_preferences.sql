-- =============================================================================
-- 0011 · notification_preferences
-- =============================================================================
create table public.notification_preferences (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  am_reminder_time     time,
  pm_reminder_time     time,
  streak_nudges        boolean not null default true,
  replenishment_alerts boolean not null default true,
  push_token           text,
  timezone             text,
  updated_at           timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
