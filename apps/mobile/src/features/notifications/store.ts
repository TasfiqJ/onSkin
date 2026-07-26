import {
  HEALTH_DATA_WRITE_ADMISSION_CLOSED,
  runHealthDataWriteOperation,
} from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingOwnerUserId } from '@/lib/consent/healthProcessingEpoch';
import { getPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import { DEFAULT_ROUTINE_REMINDER_TIMES } from './defaults';

/**
 * Local-first notification preferences (docs/07 §7, the D-029 shelf/photos pattern).
 * The encrypted device store is the source of truth so settings and scheduling
 * work offline without transmitting reminder times, quiet hours, timezone, or
 * inferred routine interests. Remote preference/log sync remains closed until
 * CAT-09 privacy, consent, retention, and exact-build disclosure gates pass.
 * Times are "HH:MM" (24h). Every notification purpose defaults off; the AM/PM
 * values below are proposals that become active only after the exact times are
 * shown and accepted.
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
  amEnabled: false,
  pmEnabled: false,
  amTime: DEFAULT_ROUTINE_REMINDER_TIMES.amTime,
  pmTime: DEFAULT_ROUTINE_REMINDER_TIMES.pmTime,
  streakNudges: false,
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

export async function saveNotifPrefs(patch: Partial<NotifPrefs>): Promise<NotifPrefs> {
  const expectedOwnerUserId = activeHealthProcessingOwnerUserId();
  if (!expectedOwnerUserId) throw new Error(HEALTH_DATA_WRITE_ADMISSION_CLOSED);
  return runHealthDataWriteOperation(expectedOwnerUserId, async (lease) => {
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
    return next;
  });
}

/** Test/seed reset. */
export async function clearNotifPrefs(): Promise<void> {
  await removePrivateItem(KEY);
}
