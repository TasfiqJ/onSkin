import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import { readPrivateItem, removePrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';
import { localDateString } from './useToday';

// Local-first daily check-off log (docs/03 §6: the activation + streak loop, and
// the research verdict's #1 lever, "make the daily loop the engine"). This is the
// v1 SOURCE OF TRUTH, following the D-029 local-first pattern shared with the shelf
// / photos / cycle stores; the server routine_completions table + the offline queue
// (completionQueue.ts) are the deferred sync target (B-ROUTINE-PERSIST / B-SUPABASE).
// A completion is a (stepKey, localDate) pair; a date counts toward the forgiving
// streak when at least one step was checked off that day (showing up, the low-bar
// definition the streak evidence rewards). Replaces the old local-useState check-off
// in today.tsx that never persisted (it broke activation + every streak surface).
const KEY = 'onskin.completions.v1';
const FIRST_COMPLETION_KEY = 'onskin.completions.firstCompletion.v1';
const SCHEMA_VERSION = 2 as const;
const LEGACY_SCHEMA_VERSION = 1 as const;
let e2eCompletionReadFailureCount = 0;

export const COMPLETION_LOG_INVALID = 'COMPLETION_LOG_INVALID';
export const COMPLETION_LOG_UNSUPPORTED_VERSION = 'COMPLETION_LOG_UNSUPPORTED_VERSION';
export const COMPLETION_LOG_UNAVAILABLE = 'COMPLETION_LOG_UNAVAILABLE';
export const COMPLETION_FIRST_MARKER_INVALID = 'COMPLETION_FIRST_MARKER_INVALID';
export const COMPLETION_FIRST_MARKER_UNAVAILABLE = 'COMPLETION_FIRST_MARKER_UNAVAILABLE';

type Log = Record<string, string[]>; // localDate -> stepKeys done that day
type CompletionLogEnvelope = {
  version: typeof SCHEMA_VERSION;
  days: Log;
  firstCompletionRecorded: boolean;
};

type CompletionLogFormat = 'absent' | 'bare' | 'v1' | 'v2';

type DecodedCompletionLog = {
  days: Log;
  firstCompletionRecorded: boolean | null;
  format: CompletionLogFormat;
};

export type CompletionLogRead =
  | { status: 'absent'; days: Log }
  | { status: 'available'; days: Log }
  | {
      status: 'unavailable' | 'corrupt' | 'unsupported_version';
      days: null;
    };

export type CompletionCommitResult =
  | {
      status: 'committed';
      done: true;
      firstEver: boolean;
      changed: boolean;
      date: string;
      completedSteps: Set<string>;
    }
  | {
      status: 'rejected' | 'cancelled';
      done: boolean;
      firstEver: false;
      changed: false;
      date: string | null;
      completedSteps: Set<string>;
    };

type LegacyFirstCompletionRead =
  | { status: 'available'; recorded: boolean }
  | { status: 'unavailable' | 'corrupt' | 'unsupported_version'; recorded: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

function completionLogError(code: string): Error {
  return new Error(code);
}

function consumeE2ECompletionReadFailure(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_COMPLETION_STORAGE_FAILURE?.trim().toLowerCase();
  if (fixture === 'always') return true;
  const failureLimit = fixture === 'twice' ? 2 : fixture === 'once' ? 1 : 0;
  if (failureLimit === 0 || e2eCompletionReadFailureCount >= failureLimit) return false;
  e2eCompletionReadFailureCount += 1;
  return true;
}

function normalizeLocalDateISO(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? text
    : null;
}

function normalizeStepKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function shiftLocalDateISO(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDateString(new Date(year, month - 1, day + days));
}

function normalizeCompletionLog(value: unknown): Log {
  if (!isRecord(value)) throw completionLogError(COMPLETION_LOG_INVALID);
  const out: Log = {};
  for (const [date, keys] of Object.entries(value)) {
    const normalizedDate = normalizeLocalDateISO(date);
    if (!normalizedDate || !Array.isArray(keys)) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const normalizedKeys: string[] = [];
    for (const key of keys) {
      const normalizedKey = normalizeStepKey(key);
      if (!normalizedKey) throw completionLogError(COMPLETION_LOG_INVALID);
      if (!normalizedKeys.includes(normalizedKey)) normalizedKeys.push(normalizedKey);
    }
    if (normalizedKeys.length > 0) {
      out[normalizedDate] = [...new Set([...(out[normalizedDate] ?? []), ...normalizedKeys])];
    }
  }
  return out;
}

function hasAnyCompletion(log: Log): boolean {
  return Object.values(log).some((steps) => steps.length > 0);
}

function decodeCompletionLog(raw: string | null): DecodedCompletionLog {
  if (raw === null) {
    return { days: {}, firstCompletionRecorded: null, format: 'absent' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  if (!isRecord(parsed)) throw completionLogError(COMPLETION_LOG_INVALID);

  if (!hasOwn(parsed, 'version')) {
    return {
      days: normalizeCompletionLog(parsed),
      firstCompletionRecorded: null,
      format: 'bare',
    };
  }
  if (parsed.version === LEGACY_SCHEMA_VERSION) {
    return {
      days: normalizeCompletionLog(parsed.days),
      firstCompletionRecorded: null,
      format: 'v1',
    };
  }
  if (parsed.version === SCHEMA_VERSION) {
    if (
      !hasExactKeys(parsed, ['version', 'days', 'firstCompletionRecorded']) ||
      typeof parsed.firstCompletionRecorded !== 'boolean'
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const days = normalizeCompletionLog(parsed.days);
    if (
      JSON.stringify(days) !== JSON.stringify(parsed.days) ||
      (!parsed.firstCompletionRecorded && hasAnyCompletion(days))
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    return {
      days,
      firstCompletionRecorded: parsed.firstCompletionRecorded,
      format: 'v2',
    };
  }
  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > SCHEMA_VERSION
  ) {
    throw completionLogError(COMPLETION_LOG_UNSUPPORTED_VERSION);
  }
  throw completionLogError(COMPLETION_LOG_INVALID);
}

function encodeCompletionLog(log: Log, firstCompletionRecorded: boolean): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    days: log,
    firstCompletionRecorded,
  } satisfies CompletionLogEnvelope);
}

/** Stable per-step key. Phase-scoped so an AM and a PM step for the same product
 *  never collide. */
export function stepKey(phase: 'AM' | 'PM', productId: string): string {
  return `${phase}:${productId}`;
}

/** Read and classify the completion log without migrating, repairing, or writing. */
export async function readCompletionLog(): Promise<CompletionLogRead> {
  if (consumeE2ECompletionReadFailure()) {
    return { status: 'unavailable', days: null };
  }
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(KEY);
  } catch {
    return { status: 'unavailable', days: null };
  }
  if (stored.status === 'absent') return { status: 'absent', days: {} };
  if (stored.status === 'unavailable') return { status: 'unavailable', days: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', days: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', days: null };
  }

  try {
    return { status: 'available', days: decodeCompletionLog(stored.value).days };
  } catch (error) {
    if (error instanceof Error && error.message === COMPLETION_LOG_UNSUPPORTED_VERSION) {
      return { status: 'unsupported_version', days: null };
    }
    return { status: 'corrupt', days: null };
  }
}

async function load(): Promise<Log> {
  const result = await readCompletionLog();
  if (result.status === 'available' || result.status === 'absent') return result.days;
  if (result.status === 'unavailable') {
    throw completionLogError(COMPLETION_LOG_UNAVAILABLE);
  }
  if (result.status === 'unsupported_version') {
    throw completionLogError(COMPLETION_LOG_UNSUPPORTED_VERSION);
  }
  throw completionLogError(COMPLETION_LOG_INVALID);
}

async function readLegacyFirstCompletionMarker(): Promise<LegacyFirstCompletionRead> {
  let stored: Awaited<ReturnType<typeof readPrivateItem>>;
  try {
    stored = await readPrivateItem(FIRST_COMPLETION_KEY);
  } catch {
    return { status: 'unavailable', recorded: null };
  }
  if (stored.status === 'absent') return { status: 'available', recorded: false };
  if (stored.status === 'unavailable') return { status: 'unavailable', recorded: null };
  if (stored.status === 'corrupt') return { status: 'corrupt', recorded: null };
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', recorded: null };
  }
  if (stored.value === 'true') return { status: 'available', recorded: true };
  if (stored.value === 'false') return { status: 'available', recorded: false };
  return { status: 'corrupt', recorded: null };
}

function firstCompletionFromLegacyMigration(
  marker: LegacyFirstCompletionRead,
  hadAny: boolean,
): boolean {
  if (hadAny) return true;
  if (marker.status === 'available') return marker.recorded;
  if (marker.status === 'unavailable') {
    throw completionLogError(COMPLETION_FIRST_MARKER_UNAVAILABLE);
  }
  throw completionLogError(COMPLETION_FIRST_MARKER_INVALID);
}

/** The step keys checked off on `date`. */
export async function getCompletedSteps(date: string = localDateString()): Promise<Set<string>> {
  const normalizedDate = normalizeLocalDateISO(date);
  if (!normalizedDate) return new Set();
  const log = await load();
  return new Set(log[normalizedDate] ?? []);
}

/** Whether a completion date is outside the server validation window (docs/03 §6):
 *  backfill is limited to today - 2 local days, and the future side is capped at
 *  today + 1 for timezone tolerance. */
export function isBeyondBackfillCap(date: string, today: string = localDateString()): boolean {
  const normalizedDate = normalizeLocalDateISO(date);
  const normalizedToday = normalizeLocalDateISO(today);
  if (!normalizedDate || !normalizedToday) return true;
  const cutoff = shiftLocalDateISO(normalizedToday, -2);
  const maxFuture = shiftLocalDateISO(normalizedToday, 1);
  return normalizedDate < cutoff || normalizedDate > maxFuture;
}

/**
 * Idempotently commit a step completion and return the exact durable day snapshot.
 * The snapshot is captured inside the atomic private-KV transform but is not
 * returned until that transform has durably resolved, so callers can publish it
 * directly without rereading/decrypting the whole completion log.
 */
export async function commitCompletion(
  key: string,
  date: string = localDateString(),
): Promise<CompletionCommitResult> {
  const normalizedKey = normalizeStepKey(key);
  const normalizedDate = normalizeLocalDateISO(date);
  if (!normalizedKey || !normalizedDate || isBeyondBackfillCap(normalizedDate)) {
    // Outside the server completion window: do not record, report it as not-done.
    const existing = await getCompletedSteps(normalizedDate ?? date);
    return {
      status: 'rejected',
      done: normalizedKey ? existing.has(normalizedKey) : false,
      firstEver: false,
      changed: false,
      date: normalizedDate,
      completedSteps: new Set(existing),
    };
  }
  try {
    return await runAccountGenerationOperation(async (lease) => {
      const legacyMarker = await awaitAccountGenerationLease(
        lease,
        readLegacyFirstCompletionMarker,
      );
      lease.assertCurrent();

      let result: Extract<CompletionCommitResult, { status: 'committed' }> | undefined;
      lease.assertCurrent();
      await updatePrivateItem(KEY, (current) => {
        const decoded = decodeCompletionLog(current);
        const log = decoded.days;
        const hadAny = hasAnyCompletion(log);
        const firstCompletionRecorded =
          decoded.format === 'v2'
            ? decoded.firstCompletionRecorded!
            : firstCompletionFromLegacyMigration(legacyMarker, hadAny);
        const day = new Set(log[normalizedDate] ?? []);
        const alreadyCompleted = day.has(normalizedKey);
        if (!alreadyCompleted) day.add(normalizedKey);
        log[normalizedDate] = [...day];

        result = {
          status: 'committed',
          done: true,
          firstEver: !alreadyCompleted && !hadAny && !firstCompletionRecorded,
          changed: !alreadyCompleted,
          date: normalizedDate,
          completedSteps: new Set(day),
        };
        const nextFirstCompletionRecorded = firstCompletionRecorded || hadAny || !alreadyCompleted;
        if (
          decoded.format === 'v2' &&
          alreadyCompleted &&
          decoded.firstCompletionRecorded === nextFirstCompletionRecorded
        ) {
          return current;
        }
        return encodeCompletionLog(log, nextFirstCompletionRecorded);
      });
      lease.assertCurrent();
      if (!result) throw new Error('COMPLETION_COMMIT_NOT_APPLIED');
      return result;
    });
  } catch (error) {
    // Today invokes this mutation from a fire-and-forget press handler. An
    // account replacement cancels the old owner's interaction without routing
    // an unhandled rejection into the new session.
    if (error instanceof AccountGenerationLeaseError) {
      return {
        status: 'cancelled',
        done: false,
        firstEver: false,
        changed: false,
        date: normalizedDate,
        completedSteps: new Set(),
      };
    }
    throw error;
  }
}

/**
 * Backward-compatible completion API for callers that do not publish caches.
 * Repeated check-offs preserve the row because completions are append-only.
 */
export async function toggleCompletion(
  key: string,
  date: string = localDateString(),
): Promise<{ done: boolean; firstEver: boolean }> {
  const result = await commitCompletion(key, date);
  return { done: result.done, firstEver: result.firstEver };
}

/** Dates with at least one completion (the streak's "completion days"). */
export async function getCompletedDates(): Promise<Set<string>> {
  return (await getCompletionSummary()).completedDates;
}

/** Per-day completion counts (heat-map intensity). */
export async function getCountByDate(): Promise<Map<string, number>> {
  return (await getCompletionSummary()).countByDate;
}

export type CompletionSummary = {
  completedDates: Set<string>;
  countByDate: Map<string, number>;
};

/**
 * One storage snapshot for consumers that need both streak dates and heat-map
 * counts. Deriving both views together prevents duplicate private-store reads and
 * guarantees they describe the same atomic completion-log version.
 */
export async function getCompletionSummary(): Promise<CompletionSummary> {
  const log = await load();
  const completedDates = new Set<string>();
  const countByDate = new Map<string, number>();
  for (const [date, keys] of Object.entries(log)) {
    if (keys.length === 0) continue;
    completedDates.add(date);
    countByDate.set(date, keys.length);
  }
  return { completedDates, countByDate };
}

/** Test/seed reset. */
export async function clearCompletions(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    lease.assertCurrent();
    await removePrivateItem(KEY);
    lease.assertCurrent();
    await removePrivateItem(FIRST_COMPLETION_KEY);
    lease.assertCurrent();
  });
}
