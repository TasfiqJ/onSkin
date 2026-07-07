import { supabase } from '@/lib/supabase/client';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

/**
 * Local-first notification preferences (docs/07 §7, the D-029 shelf/photos pattern).
 * AsyncStorage is the v1 source of truth so the settings + scheduling work offline
 * and before the backend exists (B-SUPABASE); a best-effort `notification_preferences`
 * mirror keeps the row ready to reconcile. Times are "HH:MM" (24h) locally and
 * mapped to the DB `time` columns on mirror. This is the single source of truth for
 * the AM/PM reminder schedule, the tier toggles, quiet hours, and discretion. It
 * supersedes the Slice-20 local photo-reminder flag (now `captureReminders`).
 */
const KEY = 'onskin.notifPrefs.v1';
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function timeOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return HH_MM.test(text) ? text : fallback;
}

function optionalTimeOr(
  source: Record<string, unknown>,
  key: keyof Pick<NotifPrefs, 'quietStart' | 'quietEnd'>,
  fallback: string | null,
): string | null {
  if (!(key in source)) return fallback;
  const value = source[key];
  if (value === null) return null;
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return HH_MM.test(text) ? text : fallback;
}

export function normalizeNotifPatch(patch: Partial<NotifPrefs>): Partial<NotifPrefs> {
  return patch.lockscreenDiscreet === false ? { ...patch, lockscreenDiscreet: true } : patch;
}

export function normalizeNotifPrefs(prefs: Partial<NotifPrefs> = {}): NotifPrefs {
  const source = isRecord(prefs) ? prefs : {};
  return {
    amEnabled: booleanOr(source.amEnabled, DEFAULT_PREFS.amEnabled),
    pmEnabled: booleanOr(source.pmEnabled, DEFAULT_PREFS.pmEnabled),
    amTime: timeOr(source.amTime, DEFAULT_PREFS.amTime),
    pmTime: timeOr(source.pmTime, DEFAULT_PREFS.pmTime),
    streakNudges: booleanOr(source.streakNudges, DEFAULT_PREFS.streakNudges),
    replenishmentAlerts: booleanOr(source.replenishmentAlerts, DEFAULT_PREFS.replenishmentAlerts),
    captureReminders: booleanOr(source.captureReminders, DEFAULT_PREFS.captureReminders),
    quietStart: optionalTimeOr(source, 'quietStart', DEFAULT_PREFS.quietStart),
    quietEnd: optionalTimeOr(source, 'quietEnd', DEFAULT_PREFS.quietEnd),
    liveActivityEnabled: booleanOr(source.liveActivityEnabled, DEFAULT_PREFS.liveActivityEnabled),
    promotionalOptIn: booleanOr(source.promotionalOptIn, DEFAULT_PREFS.promotionalOptIn),
    lockscreenDiscreet: true,
  };
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  let raw: string | null = null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return DEFAULT_PREFS;
  }
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      await removePrivateItem(KEY).catch(() => undefined);
      return DEFAULT_PREFS;
    }
    const normalized = normalizeNotifPrefs(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
    }
    return normalized;
  } catch {
    await removePrivateItem(KEY).catch(() => undefined);
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
  const next = normalizeNotifPrefs({ ...(await loadNotifPrefs()), ...normalizeNotifPatch(patch) });
  await setPrivateItem(KEY, JSON.stringify(next));
  void mirror(next);
  return next;
}

/** Test/seed reset. */
export async function clearNotifPrefs(): Promise<void> {
  await removePrivateItem(KEY);
}
