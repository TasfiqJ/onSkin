import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase/client';

/**
 * Local-first notification preferences (docs/07 §7, the D-029 shelf/photos pattern).
 * AsyncStorage is the v1 source of truth so the settings + scheduling work offline
 * and before the backend exists (B-SUPABASE); a best-effort `notification_preferences`
 * mirror keeps the row ready to reconcile. Times are "HH:MM" (24h) locally and
 * mapped to the DB `time` columns on mirror. This is the single source of truth for
 * the AM/PM reminder schedule, the tier toggles, quiet hours, and discretion — it
 * supersedes the Slice-20 local photo-reminder flag (now `captureReminders`).
 */
const KEY = 'onskin.notifPrefs.v1';

export type NotifPrefs = {
  amEnabled: boolean;
  pmEnabled: boolean;
  amTime: string; // "HH:MM"
  pmTime: string;
  streakNudges: boolean;
  replenishmentAlerts: boolean;
  captureReminders: boolean; // weekly progress-photo nudge (opt-in, off by default)
  quietStart: string | null; // "HH:MM" | null
  quietEnd: string | null;
  liveActivityEnabled: boolean;
  promotionalOptIn: boolean;
  lockscreenDiscreet: boolean;
};

export const DEFAULT_PREFS: NotifPrefs = {
  amEnabled: true,
  pmEnabled: true,
  amTime: '07:30',
  pmTime: '21:30',
  streakNudges: true,
  replenishmentAlerts: true,
  captureReminders: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  liveActivityEnabled: false,
  promotionalOptIn: false,
  lockscreenDiscreet: true,
};

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function toDbTime(hm: string | null): string | null {
  return hm ? `${hm}:00` : null;
}

/** Best-effort mirror to the owner-only `notification_preferences` row (B-SUPABASE). */
async function mirror(p: NotifPrefs): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.id) return;
    await supabase.from('notification_preferences').upsert({
      user_id: u.user.id,
      am_reminder_time: toDbTime(p.amTime),
      pm_reminder_time: toDbTime(p.pmTime),
      am_reminder_enabled: p.amEnabled,
      pm_reminder_enabled: p.pmEnabled,
      streak_nudges: p.streakNudges,
      replenishment_alerts: p.replenishmentAlerts,
      capture_reminders: p.captureReminders,
      quiet_hours_start: toDbTime(p.quietStart),
      quiet_hours_end: toDbTime(p.quietEnd),
      live_activity_enabled: p.liveActivityEnabled,
      promotional_opt_in: p.promotionalOptIn,
      lockscreen_discreet: p.lockscreenDiscreet,
    });
  } catch {
    /* best-effort until backend configured */
  }
}

export async function saveNotifPrefs(patch: Partial<NotifPrefs>): Promise<NotifPrefs> {
  const next = { ...(await loadNotifPrefs()), ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  void mirror(next);
  return next;
}

/** Test/seed reset. */
export async function clearNotifPrefs(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
