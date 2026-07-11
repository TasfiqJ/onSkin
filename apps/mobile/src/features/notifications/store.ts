import { supabase } from '@/lib/supabase/client';
import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

/**
 * Local-first notification preferences (docs/07 §7, the D-029 shelf/photos pattern).
 * AsyncStorage is the v1 source of truth so the settings + scheduling work offline
 * and before the backend exists (B-SUPABASE); a best-effort `notification_preferences`
 * mirror keeps the row ready to reconcile. Times are "HH:MM" (24h) locally and
 * mapped to the DB `time` columns on mirror, with the current device timezone
 * carried in the DB `timezone` field. This is the single source of truth for the
 * AM/PM reminder schedule, the tier toggles, quiet hours, and discretion. It
 * supersedes the Slice-20 local photo-reminder flag (now `captureReminders`).
 */
const KEY = 'onskin.notifPrefs.v1';
const REPLENISHMENT_OPT_IN_MARKER = 'replenishmentAlertsOptInConfirmed';
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIMEZONE_TEXT = /^[A-Za-z0-9_+\-/.]+$/;

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
  timezone: string;
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
  replenishmentAlerts: false,
  captureReminders: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  timezone: currentDeviceTimezone(),
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

function timezoneOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text.length > 0 && text.length <= 128 && TIMEZONE_TEXT.test(text) ? text : fallback;
}

export function currentDeviceTimezone(): string {
  try {
    return timezoneOr(Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC');
  } catch {
    return 'UTC';
  }
}

export function normalizeNotifPatch(patch: Partial<NotifPrefs>): Partial<NotifPrefs> {
  return patch.lockscreenDiscreet === false ? { ...patch, lockscreenDiscreet: true } : patch;
}

export function normalizeNotifPrefs(prefs: unknown = {}): NotifPrefs {
  const source = isRecord(prefs) ? prefs : {};
  const timezone = currentDeviceTimezone();
  const replenishmentOptInConfirmed = source[REPLENISHMENT_OPT_IN_MARKER] === true;
  return {
    amEnabled: booleanOr(source.amEnabled, DEFAULT_PREFS.amEnabled),
    pmEnabled: booleanOr(source.pmEnabled, DEFAULT_PREFS.pmEnabled),
    amTime: timeOr(source.amTime, DEFAULT_PREFS.amTime),
    pmTime: timeOr(source.pmTime, DEFAULT_PREFS.pmTime),
    streakNudges: booleanOr(source.streakNudges, DEFAULT_PREFS.streakNudges),
    replenishmentAlerts: replenishmentOptInConfirmed && source.replenishmentAlerts === true,
    captureReminders: booleanOr(source.captureReminders, DEFAULT_PREFS.captureReminders),
    quietStart: optionalTimeOr(source, 'quietStart', DEFAULT_PREFS.quietStart),
    quietEnd: optionalTimeOr(source, 'quietEnd', DEFAULT_PREFS.quietEnd),
    timezone: timezoneOr(timezone, DEFAULT_PREFS.timezone),
    liveActivityEnabled: booleanOr(source.liveActivityEnabled, DEFAULT_PREFS.liveActivityEnabled),
    promotionalOptIn: booleanOr(source.promotionalOptIn, DEFAULT_PREFS.promotionalOptIn),
    lockscreenDiscreet: true,
  };
}

function prefsForStorage(prefs: NotifPrefs): Record<string, unknown> {
  return {
    ...prefs,
    [REPLENISHMENT_OPT_IN_MARKER]: prefs.replenishmentAlerts,
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
    const stored = prefsForStorage(normalized);
    if (JSON.stringify(parsed) !== JSON.stringify(stored)) {
      await setPrivateItem(KEY, JSON.stringify(stored)).catch(() => undefined);
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
      timezone: p.timezone,
      live_activity_enabled: p.liveActivityEnabled,
      promotional_opt_in: p.promotionalOptIn,
      lockscreen_discreet: p.lockscreenDiscreet,
    });
  } catch {
    /* best-effort until backend configured */
  }
}

export async function saveNotifPrefs(patch: Partial<NotifPrefs>): Promise<NotifPrefs> {
  const current = await loadNotifPrefs();
  const normalizedPatch = normalizeNotifPatch(patch);
  const replenishmentOptInConfirmed =
    'replenishmentAlerts' in normalizedPatch
      ? normalizedPatch.replenishmentAlerts === true
      : current.replenishmentAlerts;
  const next = normalizeNotifPrefs({
    ...current,
    ...normalizedPatch,
    [REPLENISHMENT_OPT_IN_MARKER]: replenishmentOptInConfirmed,
  });
  await setPrivateItem(KEY, JSON.stringify(prefsForStorage(next)));
  void mirror(next);
  return next;
}

/** Test/seed reset. */
export async function clearNotifPrefs(): Promise<void> {
  await removePrivateItem(KEY);
}
