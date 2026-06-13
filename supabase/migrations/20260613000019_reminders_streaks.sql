-- =============================================================================
-- 0019 · Reminders / streaks / widgets (docs/07 §7)
-- =============================================================================
-- Extends notification_preferences with the tiered toggles + quiet hours +
-- capture/live-activity/promotional flags; adds the calm-streak forgiveness ledger
-- (streak_freezes) and a content-free delivery/throttle log (notification_log).
-- Owner-only RLS on every table (docs/01 §3 pattern). No RLS weakened.
-- NOTE: notification_preferences.updated_at already exists (migration 0011) — not
-- re-added (the smart-shelf-slice precedent for already-present timestamp columns).

alter table public.notification_preferences
  add column am_reminder_enabled  boolean not null default true,
  add column pm_reminder_enabled  boolean not null default true,
  add column capture_reminders    boolean not null default false, -- weekly progress-photo nudge (opt-in, docs/06 §5)
  add column quiet_hours_start     time,
  add column quiet_hours_end       time,
  add column live_activity_enabled boolean not null default false, -- PM Live Activity (opt-in, docs/07 §6)
  add column promotional_opt_in    boolean not null default false,  -- win-backs/announcements tier (off by default)
  add column lockscreen_discreet   boolean not null default true;   -- generic copy on the lock screen (docs/07 §3.6)

-- The calm streak's forgiveness window (auto-applied freezes; never purchased,
-- docs/07 §4.2). Computed-friendly: recompute_streak consumes routine_completions
-- + streak_freezes (D-011/D-012).
create table public.streak_freezes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  applied_for_date date not null,                 -- the missed day this freeze absorbed
  source           text not null default 'auto',  -- 'auto' (earned) — never 'purchased'
  created_at       timestamptz not null default now(),
  unique (user_id, applied_for_date)
);
create index streak_freezes_user_idx on public.streak_freezes (user_id);

alter table public.streak_freezes enable row level security;
create policy "streak_freezes_select_own" on public.streak_freezes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "streak_freezes_insert_own" on public.streak_freezes
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- No UPDATE/DELETE: the ledger is append-only audit (account-deletion cascade removes).

-- Delivery / throttle log for frequency caps + analytics — NEVER stores notification
-- content or health detail (docs/07 §7/§8), only tier + kind + timestamp.
create table public.notification_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier    text not null,        -- 'utility' | 'behavioural' | 'promotional'
  kind    text not null,        -- 'am_reminder' | 'pm_step' | 'capture' | 'replenishment' | 'rampup' | 'deescalation' | 'winback'
  sent_at timestamptz not null default now()
);
create index notification_log_user_tier_idx on public.notification_log (user_id, tier, sent_at);

alter table public.notification_log enable row level security;
create policy "notification_log_select_own" on public.notification_log
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notification_log_insert_own" on public.notification_log
  for insert to authenticated with check ((select auth.uid()) = user_id);
