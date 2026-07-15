import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { captureAuthenticatedAccountOwner } from '@/lib/auth/authenticatedAccountOwner';
import {
  readPrivateItem,
  removePrivateItem,
  updatePrivateItem,
  type PrivateKVReadFailureReason,
  type PrivateKVReadResult,
} from '@/lib/storage/privateKV';
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
const MAX_NOTIF_PREFS_CHARS = 16_384;
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

type NotifPrefsFormat = 'current' | 'legacy';
type PrivateKVCorruptReason = Extract<PrivateKVReadResult, { status: 'corrupt' }>['reason'];

export type NotifPrefsRead =
  | { status: 'absent'; prefs: NotifPrefs }
  | { status: 'available'; prefs: NotifPrefs; format: NotifPrefsFormat }
  | { status: 'unavailable'; prefs: null; reason: PrivateKVReadFailureReason }
  | {
      status: 'corrupt';
      prefs: null;
      reason: PrivateKVCorruptReason | 'invalid_payload';
    }
  | { status: 'unsupported_version'; prefs: null };

export type NotifPrefsSaveResult = Readonly<{
  prefs: NotifPrefs;
  changed: boolean;
}>;

export const NOTIF_PREFS_INVALID = 'NOTIF_PREFS_INVALID';
export const NOTIF_PREFS_UNSUPPORTED_VERSION = 'NOTIF_PREFS_UNSUPPORTED_VERSION';
export const NOTIF_PREFS_UNAVAILABLE = 'NOTIF_PREFS_UNAVAILABLE';
export const NOTIF_PREFS_WRITE_UNCERTAIN = 'NOTIF_PREFS_WRITE_UNCERTAIN';

export const DEFAULT_PREFS: NotifPrefs = {
  // Genuine absence is not notification consent. The onboarding soft ask or an
  // explicit Settings action creates the first affirmative preference record.
  amEnabled: false,
  pmEnabled: false,
  amTime: '07:30',
  pmTime: '21:30',
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

const BOOLEAN_PREF_KEYS = [
  'amEnabled',
  'pmEnabled',
  'streakNudges',
  'replenishmentAlerts',
  'captureReminders',
  'liveActivityEnabled',
  'promotionalOptIn',
  'lockscreenDiscreet',
] as const satisfies readonly (keyof NotifPrefs)[];
const REQUIRED_TIME_PREF_KEYS = ['amTime', 'pmTime'] as const;
const OPTIONAL_TIME_PREF_KEYS = ['quietStart', 'quietEnd'] as const;
const LEGACY_PREF_KEYS = new Set<string>([
  ...BOOLEAN_PREF_KEYS,
  ...REQUIRED_TIME_PREF_KEYS,
  ...OPTIONAL_TIME_PREF_KEYS,
  'timezone',
  REPLENISHMENT_OPT_IN_MARKER,
]);

export function currentDeviceTimezone(): string {
  try {
    return timezoneOr(Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC');
  } catch {
    return 'UTC';
  }
}

export function normalizeNotifPatch(patch: Partial<NotifPrefs>): Partial<NotifPrefs> {
  if (!isRecord(patch)) throw new Error(NOTIF_PREFS_INVALID);
  for (const key of Object.keys(patch)) {
    if (!LEGACY_PREF_KEYS.has(key) || key === REPLENISHMENT_OPT_IN_MARKER) {
      throw new Error(NOTIF_PREFS_INVALID);
    }
  }
  for (const key of BOOLEAN_PREF_KEYS) {
    if (key in patch && typeof patch[key] !== 'boolean') throw new Error(NOTIF_PREFS_INVALID);
  }
  for (const key of REQUIRED_TIME_PREF_KEYS) {
    if (key in patch && (typeof patch[key] !== 'string' || !HH_MM.test(patch[key]))) {
      throw new Error(NOTIF_PREFS_INVALID);
    }
  }
  for (const key of OPTIONAL_TIME_PREF_KEYS) {
    if (key in patch) {
      const value = patch[key];
      if (!(value === null || (typeof value === 'string' && HH_MM.test(value)))) {
        throw new Error(NOTIF_PREFS_INVALID);
      }
    }
  }
  if (
    'timezone' in patch &&
    (typeof patch.timezone !== 'string' ||
      patch.timezone.length === 0 ||
      patch.timezone.length > 128 ||
      !TIMEZONE_TEXT.test(patch.timezone))
  ) {
    throw new Error(NOTIF_PREFS_INVALID);
  }
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
    timezone: timezoneOr(source.timezone, timezone),
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

function validateLegacyPrefs(value: Record<string, unknown>): void {
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !LEGACY_PREF_KEYS.has(key))) {
    throw new Error(NOTIF_PREFS_INVALID);
  }
  for (const key of BOOLEAN_PREF_KEYS) {
    if (key in value && typeof value[key] !== 'boolean') throw new Error(NOTIF_PREFS_INVALID);
  }
  if (
    REPLENISHMENT_OPT_IN_MARKER in value &&
    typeof value[REPLENISHMENT_OPT_IN_MARKER] !== 'boolean'
  ) {
    throw new Error(NOTIF_PREFS_INVALID);
  }
  for (const key of REQUIRED_TIME_PREF_KEYS) {
    if (key in value) {
      const time = value[key];
      if (typeof time !== 'string' || !HH_MM.test(time.trim())) {
        throw new Error(NOTIF_PREFS_INVALID);
      }
    }
  }
  for (const key of OPTIONAL_TIME_PREF_KEYS) {
    if (key in value) {
      const time = value[key];
      if (!(time === null || (typeof time === 'string' && HH_MM.test(time.trim())))) {
        throw new Error(NOTIF_PREFS_INVALID);
      }
    }
  }
  if ('timezone' in value) {
    const timezone = value.timezone;
    if (
      typeof timezone !== 'string' ||
      timezone.trim().length === 0 ||
      timezone.trim().length > 128 ||
      !TIMEZONE_TEXT.test(timezone.trim())
    ) {
      throw new Error(NOTIF_PREFS_INVALID);
    }
  }
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

function decodeNotifPrefs(raw: string): { prefs: NotifPrefs; format: NotifPrefsFormat } {
  if (raw.length > MAX_NOTIF_PREFS_CHARS) throw new Error(NOTIF_PREFS_INVALID);
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
    return { prefs: normalizeNotifPrefs(parsed.prefs), format: 'current' };
  }

  // Installed pre-envelope records may omit fields added by later releases, but
  // every present field must still be known and semantically valid.
  validateLegacyPrefs(parsed);
  return { prefs: normalizeNotifPrefs(parsed), format: 'legacy' };
}

function encodeNotifPrefs(prefs: NotifPrefs): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    prefs: prefsForStorage(prefs),
  } satisfies NotifPrefsEnvelope);
}

type DevNotifPrefsReadState = 'unavailable' | 'corrupt' | 'unsupported_version';
let e2eReadFixtureSignature: string | null = null;
let e2eReadFailures = 0;
let e2eWriteFixtureSignature: string | null = null;
let e2eWriteFailures = 0;

function devNotifPrefsReadState(): DevNotifPrefsReadState | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_STORAGE_FAILURE?.trim().toLowerCase();
  if (!fixture) {
    e2eReadFixtureSignature = null;
    e2eReadFailures = 0;
    return null;
  }
  if (fixture !== e2eReadFixtureSignature) {
    e2eReadFixtureSignature = fixture;
    e2eReadFailures = 0;
  }
  if (fixture === 'always') return 'unavailable';
  if (fixture === 'corrupt') return 'corrupt';
  if (fixture === 'future') return 'unsupported_version';
  if (fixture !== 'once' || e2eReadFailures > 0) return null;
  e2eReadFailures += 1;
  return 'unavailable';
}

function shouldSimulateDevNotifPrefsWriteFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_NOTIF_PREFS_WRITE_FAILURE?.trim().toLowerCase();
  if (!fixture) {
    e2eWriteFixtureSignature = null;
    e2eWriteFailures = 0;
    return false;
  }
  if (fixture !== e2eWriteFixtureSignature) {
    e2eWriteFixtureSignature = fixture;
    e2eWriteFailures = 0;
  }
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2eWriteFailures > 0) return false;
  e2eWriteFailures += 1;
  return true;
}

/** Read and classify preferences without repairing, deleting, or migrating bytes. */
export async function readNotifPrefs(): Promise<NotifPrefsRead> {
  const fixture = devNotifPrefsReadState();
  if (fixture === 'unavailable') {
    return { status: 'unavailable', prefs: null, reason: 'storage_unavailable' };
  }
  if (fixture === 'corrupt') {
    return { status: 'corrupt', prefs: null, reason: 'invalid_payload' };
  }
  if (fixture === 'unsupported_version') {
    return { status: 'unsupported_version', prefs: null };
  }

  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return { status: 'unavailable', prefs: null, reason: 'storage_unavailable' };
  }
  if (stored.status === 'absent') {
    return {
      status: 'absent',
      prefs: { ...DEFAULT_PREFS, timezone: currentDeviceTimezone() },
    };
  }
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', prefs: null, reason: stored.reason };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', prefs: null, reason: stored.reason };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', prefs: null };
  }
  try {
    const decoded = decodeNotifPrefs(stored.value);
    return { status: 'available', prefs: decoded.prefs, format: decoded.format };
  } catch (error) {
    return error instanceof Error && error.message === NOTIF_PREFS_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', prefs: null }
      : { status: 'corrupt', prefs: null, reason: 'invalid_payload' };
  }
}

/** Strict adapter for imperative consumers that cannot act on an unreadable state. */
export async function loadNotifPrefs(): Promise<NotifPrefs> {
  const result = await readNotifPrefs();
  if (result.status === 'absent' || result.status === 'available') return result.prefs;
  if (result.status === 'unsupported_version') {
    throw new Error(NOTIF_PREFS_UNSUPPORTED_VERSION);
  }
  if (result.status === 'corrupt') throw new Error(NOTIF_PREFS_INVALID);
  throw new Error(NOTIF_PREFS_UNAVAILABLE);
}

function toDbTime(hm: string | null): string | null {
  return hm ? `${hm}:00` : null;
}

let mirrorTail: Promise<void> = Promise.resolve();

async function runSerializedMirror<T>(
  lease: AccountGenerationLease,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = mirrorTail.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  mirrorTail = tail;
  try {
    await awaitAccountGenerationLease(lease, () => previous);
    lease.assertCurrent();
    return await operation();
  } catch (error) {
    // Do not let an old queued/transport error replace owner-boundary
    // cancellation, and always release the queue for the next generation.
    lease.assertCurrent();
    throw error;
  } finally {
    release();
    if (mirrorTail === tail) mirrorTail = Promise.resolve();
  }
}

/** Best-effort mirror to the owner-only `notification_preferences` row (B-SUPABASE). */
async function mirror(p: NotifPrefs): Promise<void> {
  const snapshot = Object.freeze({ ...p });
  try {
    await runAccountGenerationOperation(async (lease) => {
      await runSerializedMirror(lease, async () => {
        lease.assertCurrent();
        const owner = await captureAuthenticatedAccountOwner(lease);
        if (!owner) return;
        lease.assertCurrent();
        let result: { error: unknown };
        try {
          result = await awaitAccountGenerationLease(lease, () =>
            supabase
              .from('notification_preferences')
              .upsert({
                user_id: owner.userId,
                am_reminder_time: toDbTime(snapshot.amTime),
                pm_reminder_time: toDbTime(snapshot.pmTime),
                am_reminder_enabled: snapshot.amEnabled,
                pm_reminder_enabled: snapshot.pmEnabled,
                streak_nudges: snapshot.streakNudges,
                replenishment_alerts: snapshot.replenishmentAlerts,
                capture_reminders: snapshot.captureReminders,
                quiet_hours_start: toDbTime(snapshot.quietStart),
                quiet_hours_end: toDbTime(snapshot.quietEnd),
                timezone: snapshot.timezone,
                live_activity_enabled: snapshot.liveActivityEnabled,
                promotional_opt_in: snapshot.promotionalOptIn,
                lockscreen_discreet: snapshot.lockscreenDiscreet,
              })
              .abortSignal(lease.signal),
          );
        } catch (error) {
          lease.assertCurrent();
          throw error;
        }
        lease.assertCurrent();
        if (result.error) throw result.error;
      });
    });
  } catch {
    /* best-effort until backend configured */
  }
}

function prefsEqual(left: NotifPrefs, right: NotifPrefs): boolean {
  return JSON.stringify(prefsForStorage(left)) === JSON.stringify(prefsForStorage(right));
}

export async function saveNotifPrefs(
  patch: Partial<NotifPrefs>,
): Promise<NotifPrefsSaveResult> {
  const normalizedPatch = normalizeNotifPatch(patch);
  if (shouldSimulateDevNotifPrefsWriteFailure()) {
    throw new Error('E2E_NOTIF_PREFS_WRITE_FAILURE');
  }
  return runAccountGenerationOperation(async (lease) => {
    let next: NotifPrefs | null = null;
    let changed = false;
    let expectedRaw: string | null = null;
    try {
      await updatePrivateItem(KEY, (currentRaw) => {
        const current =
          currentRaw === null
            ? normalizeNotifPrefs()
            : decodeNotifPrefs(currentRaw).prefs;
        const replenishmentOptInConfirmed =
          'replenishmentAlerts' in normalizedPatch
            ? normalizedPatch.replenishmentAlerts === true
            : current.replenishmentAlerts;
        next = normalizeNotifPrefs({
          ...current,
          ...normalizedPatch,
          timezone: normalizedPatch.timezone ?? currentDeviceTimezone(),
          [REPLENISHMENT_OPT_IN_MARKER]: replenishmentOptInConfirmed,
        });
        changed = currentRaw === null || !prefsEqual(current, next);
        // For a semantic legacy no-op, privateKV still encrypts the returned
        // legacy plaintext. Exact response-loss confirmation must therefore
        // compare with the value actually returned to privateKV, not a v1
        // envelope that this mutation never requested.
        expectedRaw = changed ? encodeNotifPrefs(next) : currentRaw;
        return expectedRaw;
      });
    } catch (error) {
      if (expectedRaw === null) throw error;
      let confirmation: Awaited<ReturnType<typeof readPrivateItem>>;
      lease.assertCurrent();
      try {
        confirmation = await readPrivateItem(KEY);
      } catch {
        lease.assertCurrent();
        throw new Error(NOTIF_PREFS_WRITE_UNCERTAIN);
      }
      lease.assertCurrent();
      if (confirmation.status !== 'available' || confirmation.value !== expectedRaw) {
        throw new Error(NOTIF_PREFS_WRITE_UNCERTAIN);
      }
    }
    lease.assertCurrent();
    if (!next) throw new Error('NOTIF_PREFS_WRITE_FAILED');
    if (changed) void mirror(next);
    return { prefs: next, changed };
  });
}

/** Test/seed reset. */
export async function clearNotifPrefs(): Promise<void> {
  await removePrivateItem(KEY);
}
