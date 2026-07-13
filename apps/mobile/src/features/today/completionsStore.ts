import {
  getPrivateItem,
  removePrivateItem,
  setPrivateItem,
  updatePrivateItem,
} from '@/lib/storage/privateKV';
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
const SCHEMA_VERSION = 1 as const;

export const COMPLETION_LOG_INVALID = 'COMPLETION_LOG_INVALID';
export const COMPLETION_LOG_UNSUPPORTED_VERSION = 'COMPLETION_LOG_UNSUPPORTED_VERSION';

type Log = Record<string, string[]>; // localDate -> stepKeys done that day
type CompletionLogEnvelope = {
  version: typeof SCHEMA_VERSION;
  days: Log;
};

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

function decodeCompletionLog(raw: string | null): Log {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw completionLogError(COMPLETION_LOG_INVALID);
  }
  if (!isRecord(parsed)) throw completionLogError(COMPLETION_LOG_INVALID);

  if (!hasOwn(parsed, 'version')) return normalizeCompletionLog(parsed);
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
  return normalizeCompletionLog(parsed.days);
}

function encodeCompletionLog(log: Log): string {
  return JSON.stringify({ version: SCHEMA_VERSION, days: log } satisfies CompletionLogEnvelope);
}

/** Stable per-step key. Phase-scoped so an AM and a PM step for the same product
 *  never collide. */
export function stepKey(phase: 'AM' | 'PM', productId: string): string {
  return `${phase}:${productId}`;
}

async function load(): Promise<Log> {
  try {
    return decodeCompletionLog(await getPrivateItem(KEY));
  } catch {
    // Reads stay fail-soft for existing UI callers, but never repair/delete bytes.
    return {};
  }
}

async function hasFirstCompletionMarker(): Promise<boolean> {
  return (await getPrivateItem(FIRST_COMPLETION_KEY).catch(() => null)) === 'true';
}

async function markFirstCompletion(): Promise<void> {
  await setPrivateItem(FIRST_COMPLETION_KEY, 'true').catch(() => undefined);
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

/** Idempotently record a step's completion for a day. Returns whether it is done and
 *  whether this was the user's first-ever completion (the north-star activation moment).
 *  Dates outside the server completion window (docs/03 §6) are rejected. */
// Repeated check-offs preserve the row because v1 completions are append-only.
export async function toggleCompletion(
  key: string,
  date: string = localDateString(),
): Promise<{ done: boolean; firstEver: boolean }> {
  const normalizedKey = normalizeStepKey(key);
  const normalizedDate = normalizeLocalDateISO(date);
  if (!normalizedKey || !normalizedDate || isBeyondBackfillCap(normalizedDate)) {
    // Outside the server completion window: do not record, report it as not-done.
    const existing = await getCompletedSteps(normalizedDate ?? date);
    return { done: normalizedKey ? existing.has(normalizedKey) : false, firstEver: false };
  }
  const firstCompletionAlreadyMarked = await hasFirstCompletionMarker();
  let result = { done: false, firstEver: false };
  let shouldMarkFirstCompletion = false;
  await updatePrivateItem(KEY, (current) => {
    const log = decodeCompletionLog(current);
    const hadAny = Object.values(log).some((steps) => steps.length > 0);
    const day = new Set(log[normalizedDate] ?? []);
    const alreadyCompleted = day.has(normalizedKey);
    if (!alreadyCompleted) day.add(normalizedKey);
    log[normalizedDate] = [...day];

    result = {
      done: true,
      firstEver: !alreadyCompleted && !hadAny && !firstCompletionAlreadyMarked,
    };
    shouldMarkFirstCompletion = hadAny || result.firstEver;
    return encodeCompletionLog(log);
  });
  if (shouldMarkFirstCompletion && !firstCompletionAlreadyMarked) {
    await markFirstCompletion();
  }
  return result;
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
  await removePrivateItem(KEY);
  await removePrivateItem(FIRST_COMPLETION_KEY);
}
