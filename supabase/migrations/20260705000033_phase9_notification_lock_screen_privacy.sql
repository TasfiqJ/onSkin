-- =============================================================================
-- 0033 - Phase 9 notification lock-screen privacy
-- =============================================================================
-- OS notification payloads for health-adjacent reminders must stay generic. Keep
-- the legacy column for exports/reconciliation, but prevent old or future rows
-- from disabling lock-screen discretion.

update public.notification_preferences
set lockscreen_discreet = true
where lockscreen_discreet is false;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_lockscreen_discreet_true,
  add constraint notification_preferences_lockscreen_discreet_true
    check (lockscreen_discreet is true);

comment on column public.notification_preferences.lockscreen_discreet is
  'Always true as of Phase 9: OS notification payloads use generic lock-screen copy only.';
