import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import { supabase } from '@/lib/supabase/client';

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
const SCHEMA_VERSION = 1 as const;
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

type NotifPrefsEnvelope = {
  version: typeof SCHEMA_VERSION;
  prefs: Record<string, unknown>;
};

export const NOTIF_PREFS_INVALID = 'NOTIF_PREFS_INVALID';
export const NOTIF_PREFS_UNSUPPORTED_VERSION = 'NOTIF_PREFS_UNSUPPORTED_VERSION';

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

function failClosedPrefs(): NotifPrefs {
  return {
    ...DEFAULT_PREFS,
    amEnabled: false,
    pmEnabled: false,
    streakNudges: false,
    replenishmentAlerts: false,
    captureReminders: false,
    liveActivityEnabled: false,
    promotionalOptIn: false,
    timezone: currentDeviceTimezone(),
  };
}

function isCurrentStoredPrefs(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const expectedKeys = [
    REPLENISHMENT_OPT_IN_MARKER,
    'amEnabled',
    'amTime',
    'captureReminders',
    'liveActivityEnabled',
    'lockscreenDiscreet',
    'pmEnabled',
    'pmTime',
    'promotionalOptIn',
    'quietEnd',
    'quietStart',
    'replenishmentAlerts',
    'streakNudges',
    'timezone',
  ].sort();
  const keys = Object.keys(value).sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    return false;
  }
  for (const key of [
    'amEnabled',
    'pmEnabled',
    'streakNudges',
    'replenishmentAlerts',
    'captureReminders',
    'liveActivityEnabled',
    'promotionalOptIn',
    'lockscreenDiscreet',
    REPLENISHMENT_OPT_IN_MARKER,
  ]) {
    if (typeof value[key] !== 'boolean') return false;
  }
  if (value.lockscreenDiscreet !== true) return false;
  if (value.replenishmentAlerts !== value[REPLENISHMENT_OPT_IN_MARKER]) return false;
  if (typeof value.amTime !== 'string' || !HH_MM.test(value.amTime)) return false;
  if (typeof value.pmTime !== 'string' || !HH_MM.test(value.pmTime)) return false;
  for (const key of ['quietStart', 'quietEnd']) {
    const time = value[key];
    if (!(time === null || (typeof time === 'string' && HH_MM.test(time)))) return false;
  }
  return (
    typeof value.timezone === 'string' &&
    value.timezone.length > 0 &&
    value.timezone.length <= 128 &&
    TIMEZONE_TEXT.test(value.timezone)
  );
}

function decodeNotifPrefs(raw: string): NotifPrefs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(NOTIF_PREFS_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(NOTIF_PREFS_INVALID);

  if (Object.prototype.hasOwnProperty.call(parsed, 'version')) {
    if (parsed.version !== SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > SCHEMA_VERSION
      ) {
        throw new Error(NOTIF_PREFS_UNSUPPORTED_VERSION);
      }
      throw new Error(NOTIF_PREFS_INVALID);
    }
    const keys = Object.keys(parsed).sort();
    if (keys.length !== 2 || keys[0] !== 'prefs' || keys[1] !== 'version') {
      throw new Error(NOTIF_PREFS_INVALID);
    }
    if (!isCurrentStoredPrefs(parsed.prefs)) throw new Error(NOTIF_PREFS_INVALID);
    return normalizeNotifPrefs(parsed.prefs);
  }

  // Pre-envelope records retain their forgiving compatibility normalization.
  return normalizeNotifPrefs(parsed);
}

function encodeNotifPrefs(prefs: NotifPrefs): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    prefs: prefsForStorage(prefs),
  } satisfies NotifPrefsEnvelope);
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await getPrivateItem(KEY);
    return raw === null
      ? { ...DEFAULT_PREFS, timezone: currentDeviceTimezone() }
      : decodeNotifPrefs(raw);
  } catch {
    // Corrupt, unsupported, or unavailable private state disables every optional
    // notification instead of silently treating it as fresh opt-in state.
    return failClosedPrefs();
  }
}

function toDbTime(hm: string | null): string | null {
  return hm ? `${hm}:00` : null;
}

/** Best-effort mirror to the owner-only `notification_preferences` row (B-SUPABASE). */
async function mirror(p: NotifPrefs): Promise<void> {
  try {
    await runAccountGenerationOperation(async (lease) => {
      const owner = await captureAuthenticatedAccountOwner(lease);
      if (!owner) return;
      lease.assertCurrent();
      await supabase
        .from('notification_preferences')
        .upsert({
          user_id: owner.userId,
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
        })
        .abortSignal(lease.signal);
      lease.assertCurrent();
    });
  } catch {
    /* best-effort until backend configured */
  }
}

export async function saveNotifPrefs(patch: Partial<NotifPrefs>): Promise<NotifPrefs> {
  return runAccountGenerationOperation(async (lease) => {
    const normalizedPatch = normalizeNotifPatch(patch);
    let next: NotifPrefs | null = null;
    await updatePrivateItem(KEY, (currentRaw) => {
      const current = currentRaw === null ? normalizeNotifPrefs() : decodeNotifPrefs(currentRaw);
      const replenishmentOptInConfirmed =
        'replenishmentAlerts' in normalizedPatch
          ? normalizedPatch.replenishmentAlerts === true
          : current.replenishmentAlerts;
      next = normalizeNotifPrefs({
        ...current,
        ...normalizedPatch,
        [REPLENISHMENT_OPT_IN_MARKER]: replenishmentOptInConfirmed,
      });
      return encodeNotifPrefs(next);
    });
    lease.assertCurrent();
    if (!next) throw new Error('NOTIF_PREFS_WRITE_FAILED');
    void mirror(next);
    return next;
  });
}

/** Test/seed reset. */
export async function clearNotifPrefs(): Promise<void> {
  await removePrivateItem(KEY);
}
