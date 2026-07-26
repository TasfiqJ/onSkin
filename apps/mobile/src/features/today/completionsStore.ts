import {
  getPrivateItem,
  removePrivateItem,
  setPrivateItem,
  updatePrivateItem,
} from '@/lib/storage/privateKV';
import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import {
  runCurrentHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { localDateString } from './useToday';

// Local-first daily check-off log (docs/03 §6: the activation + streak loop, and
// the research verdict's #1 lever, "make the daily loop the engine"). This is the
// v1 SOURCE OF TRUTH, following the D-029 local-first pattern shared with the shelf
// / photos / cycle stores; the server routine_completions table + the offline queue
// (completionQueue.ts) are the deferred sync target (B-ROUTINE-PERSIST / B-SUPABASE).
// A step completion is a (stepKey, localDate) pair. Adherence is deliberately
// stricter: a date counts only after every step in that day's projected PM/recovery
// routine is durable. Replaces the old local-useState check-off in today.tsx that
// never persisted (it broke activation + every streak surface).
const KEY = 'onskin.completions.v1';
const FIRST_COMPLETION_KEY = 'onskin.completions.firstCompletion.v1';
const SCHEMA_VERSION = 2 as const;

export const COMPLETION_LOG_INVALID = 'COMPLETION_LOG_INVALID';
export const COMPLETION_LOG_UNSUPPORTED_VERSION = 'COMPLETION_LOG_UNSUPPORTED_VERSION';

type Log = Record<string, string[]>; // localDate -> stepKeys done that day
type CompletionState = {
  days: Log;
  /** Explicit proof that every projected PM/recovery step was completed that day. */
  completedDays: Set<string>;
};
type CompletionLogEnvelope = {
  version: typeof SCHEMA_VERSION;
  days: Log;
  completedDays: string[];
};

export type ToggleCompletionResult = {
  done: boolean;
  inserted: boolean;
  firstEver: boolean;
  /** True only for the mutation that first proves the full PM/recovery routine. */
  completionDayInserted: boolean;
  /** Exact day snapshot produced by the same serialized mutation as `inserted`. */
  completedStepKeysAfter: ReadonlySet<string>;
};

export type ScheduledCompletionContext = Readonly<{
  phase: 'PM';
  stepKeys: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function completionLogError(code: string): Error {
  return new Error(code);
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
  const match = /^(AM|PM):(.+)$/.exec(text);
  if (!match) return null;
  const productId = match[2]!.trim();
  return productId.length > 0 ? `${match[1]}:${productId}` : null;
}

function shiftLocalDateISO(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDateString(new Date(year, month - 1, day + days));
}

function normalizeCompletionLog(value: unknown, strictCurrentSchema = false): Log {
  if (!isRecord(value)) throw completionLogError(COMPLETION_LOG_INVALID);
  const out: Log = {};
  for (const [date, keys] of Object.entries(value)) {
    const normalizedDate = normalizeLocalDateISO(date);
    if (!normalizedDate || !Array.isArray(keys)) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    if (strictCurrentSchema && normalizedDate !== date) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const normalizedKeys: string[] = [];
    for (const key of keys) {
      const normalizedKey = normalizeStepKey(key);
      if (!normalizedKey) throw completionLogError(COMPLETION_LOG_INVALID);
      if (
        strictCurrentSchema &&
        (normalizedKey !== key || normalizedKeys.includes(normalizedKey))
      ) {
        throw completionLogError(COMPLETION_LOG_INVALID);
      }
      if (!normalizedKeys.includes(normalizedKey)) normalizedKeys.push(normalizedKey);
    }
    if (strictCurrentSchema && normalizedKeys.length === 0) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    if (normalizedKeys.length > 0) {
      out[normalizedDate] = [...new Set([...(out[normalizedDate] ?? []), ...normalizedKeys])];
    }
  }
  return out;
}

function normalizeCompletedDays(value: unknown, days: Log): Set<string> {
  if (!Array.isArray(value)) throw completionLogError(COMPLETION_LOG_INVALID);
  const out = new Set<string>();
  for (const entry of value) {
    const normalizedDate = normalizeLocalDateISO(entry);
    if (
      !normalizedDate ||
      normalizedDate !== entry ||
      out.has(normalizedDate) ||
      !days[normalizedDate]?.some((key) => key.startsWith('PM:'))
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    out.add(normalizedDate);
  }
  return out;
}

function decodeCompletionLog(raw: string | null): CompletionState {
  if (raw === null) return { days: {}, completedDays: new Set() };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  if (!isRecord(parsed)) throw completionLogError(COMPLETION_LOG_INVALID);

  if (!hasOwn(parsed, 'version')) {
    return { days: normalizeCompletionLog(parsed), completedDays: new Set() };
  }
  if (parsed.version === 1) {
    if (Object.keys(parsed).length !== 2 || !hasOwn(parsed, 'days') || !isRecord(parsed.days)) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    return {
      days: normalizeCompletionLog(parsed.days, true),
      // A v1 row proves step taps, not that the then-scheduled PM routine was complete.
      completedDays: new Set(),
    };
  }
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw completionLogError(COMPLETION_LOG_UNSUPPORTED_VERSION);
    }
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  if (
    Object.keys(parsed).length !== 3 ||
    !hasOwn(parsed, 'days') ||
    !hasOwn(parsed, 'completedDays') ||
    !isRecord(parsed.days)
  ) {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  const days = normalizeCompletionLog(parsed.days, true);
  return { days, completedDays: normalizeCompletedDays(parsed.completedDays, days) };
}

function encodeCompletionLog(state: CompletionState): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    days: state.days,
    completedDays: [...state.completedDays].sort(),
  } satisfies CompletionLogEnvelope);
}

/** Stable per-step key. Phase-scoped so an AM and a PM step for the same product
 *  never collide. */
export function stepKey(phase: 'AM' | 'PM', productId: string): string {
  const normalized = normalizeStepKey(`${phase}:${productId}`);
  if (!normalized) throw completionLogError(COMPLETION_LOG_INVALID);
  return normalized;
}

async function load(lease: HealthDataWriteOperationLease): Promise<CompletionState> {
  lease.assertCurrent();
  const raw = await getPrivateItem(KEY);
  lease.assertCurrent();
  return decodeCompletionLog(raw);
}

async function hasFirstCompletionMarker(lease: HealthDataWriteOperationLease): Promise<boolean> {
  try {
    lease.assertCurrent();
    const marker = await getPrivateItem(FIRST_COMPLETION_KEY);
    lease.assertCurrent();
    return marker === 'true';
  } catch {
    lease.assertCurrent();
    return false;
  }
}

async function markFirstCompletion(lease: HealthDataWriteOperationLease): Promise<void> {
  try {
    lease.assertCurrent();
    await setPrivateItem(FIRST_COMPLETION_KEY, 'true');
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
  }
}

async function getCompletedStepsForLease(
  date: string,
  lease: HealthDataWriteOperationLease,
): Promise<Set<string>> {
  const normalizedDate = normalizeLocalDateISO(date);
  if (!normalizedDate) return new Set();
  const log = await load(lease);
  lease.assertCurrent();
  return new Set(log.days[normalizedDate] ?? []);
}

/** The step keys checked off on `date`. */
export async function getCompletedSteps(date: string = localDateString()): Promise<Set<string>> {
  return runCurrentHealthDataOperation((lease) => getCompletedStepsForLease(date, lease));
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

/** Idempotently record a step's completion for a day. Returns whether it is done,
 *  whether a row was inserted, and whether this was the user's first-ever completion.
 *  Dates outside the server completion window (docs/03 §6) are rejected. */
// Repeated check-offs preserve the row because v1 completions are append-only.
export async function toggleCompletion(
  key: string,
  date: string = localDateString(),
  scheduled?: ScheduledCompletionContext,
): Promise<ToggleCompletionResult> {
  return runCurrentHealthDataOperation(async (lease) => {
    const normalizedKey = normalizeStepKey(key);
    const normalizedDate = normalizeLocalDateISO(date);
    if (!normalizedKey || !normalizedDate || isBeyondBackfillCap(normalizedDate)) {
      // Outside the server completion window: do not record, report it as not-done.
      const existing = await getCompletedStepsForLease(normalizedDate ?? date, lease);
      lease.assertCurrent();
      return {
        done: normalizedKey ? existing.has(normalizedKey) : false,
        inserted: false,
        firstEver: false,
        completionDayInserted: false,
        completedStepKeysAfter: existing,
      };
    }
    const scheduledStepKeys =
      scheduled === undefined
        ? null
        : scheduled.stepKeys.map((step) => {
            const normalized = normalizeStepKey(step);
            if (!normalized || !normalized.startsWith('PM:')) {
              throw completionLogError(COMPLETION_LOG_INVALID);
            }
            return normalized;
          });
    if (
      scheduled &&
      (scheduled.phase !== 'PM' ||
        scheduledStepKeys?.length === 0 ||
        new Set(scheduledStepKeys).size !== scheduledStepKeys?.length ||
        !normalizedKey.startsWith('PM:') ||
        !scheduledStepKeys?.includes(normalizedKey))
    ) {
      throw completionLogError(COMPLETION_LOG_INVALID);
    }
    const firstCompletionAlreadyMarked = await hasFirstCompletionMarker(lease);
    lease.assertCurrent();
    let result: ToggleCompletionResult = {
      done: false,
      inserted: false,
      firstEver: false,
      completionDayInserted: false,
      completedStepKeysAfter: new Set(),
    };
    let shouldMarkFirstCompletion = false;
    await updatePrivateItem(KEY, (current) => {
      lease.assertCurrent();
      const state = decodeCompletionLog(current);
      const hadAny = Object.values(state.days).some((steps) => steps.length > 0);
      const day = new Set(state.days[normalizedDate] ?? []);
      const alreadyCompleted = day.has(normalizedKey);
      if (!alreadyCompleted) day.add(normalizedKey);
      state.days[normalizedDate] = [...day];
      const alreadyCompletedDay = state.completedDays.has(normalizedDate);
      const completedScheduledRoutine =
        scheduledStepKeys !== null && scheduledStepKeys.every((step) => day.has(step));
      if (completedScheduledRoutine) state.completedDays.add(normalizedDate);

      result = {
        done: true,
        inserted: !alreadyCompleted,
        firstEver: !alreadyCompleted && !hadAny && !firstCompletionAlreadyMarked,
        completionDayInserted: completedScheduledRoutine && !alreadyCompletedDay,
        completedStepKeysAfter: new Set(day),
      };
      shouldMarkFirstCompletion = hadAny || result.firstEver;
      lease.assertCurrent();
      return encodeCompletionLog(state);
    });
    lease.assertCurrent();
    if (shouldMarkFirstCompletion && !firstCompletionAlreadyMarked) {
      await markFirstCompletion(lease);
    }
    lease.assertCurrent();
    return result;
  });
}

/** Dates with at least one completion (the streak's "completion days"). */
export async function getCompletedDates(): Promise<Set<string>> {
  return runCurrentHealthDataOperation(async (lease) => {
    const summary = await getCompletionSummaryForLease(lease);
    lease.assertCurrent();
    return summary.completedDates;
  });
}

/** Per-day completion counts (heat-map intensity). */
export async function getCountByDate(): Promise<Map<string, number>> {
  return runCurrentHealthDataOperation(async (lease) => {
    const summary = await getCompletionSummaryForLease(lease);
    lease.assertCurrent();
    return summary.countByDate;
  });
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
async function getCompletionSummaryForLease(
  lease: HealthDataWriteOperationLease,
): Promise<CompletionSummary> {
  const log = await load(lease);
  lease.assertCurrent();
  const completedDates = new Set<string>();
  const countByDate = new Map<string, number>();
  for (const [date, keys] of Object.entries(log.days)) {
    if (keys.length === 0) continue;
    countByDate.set(date, keys.length);
  }
  for (const date of log.completedDays) completedDates.add(date);
  lease.assertCurrent();
  return { completedDates, countByDate };
}

export async function getCompletionSummary(): Promise<CompletionSummary> {
  return runCurrentHealthDataOperation(getCompletionSummaryForLease);
}

/** Explicit deletion lane: no health plaintext is read or returned. */
export async function clearCompletions(): Promise<void> {
  await runAccountGenerationOperation(async (lease) => {
    lease.assertCurrent();
    await removePrivateItem(KEY);
    lease.assertCurrent();
    await removePrivateItem(FIRST_COMPLETION_KEY);
    lease.assertCurrent();
  });
}
