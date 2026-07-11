-- Replenishment notifications are opt-in. The previous default did not prove consent,
-- so existing true rows fail closed and can be enabled again from Settings.

alter table public.notification_preferences
  alter column replenishment_alerts set default false;

update public.notification_preferences
set replenishment_alerts = false
where replenishment_alerts = true;
