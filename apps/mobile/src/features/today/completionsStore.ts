import { getPrivateItem, removePrivateItem, setPrivateItem } from '@/lib/storage/privateKV';
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

type Log = Record<string, string[]>; // localDate -> stepKeys done that day

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
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
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

function normalizeCompletionLog(value: unknown): Log | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const out: Log = {};
  for (const [date, keys] of Object.entries(value)) {
    const normalizedDate = normalizeLocalDateISO(date);
    if (!normalizedDate || !Array.isArray(keys)) continue;
    const normalizedKeys = [
      ...new Set(keys.map(normalizeStepKey).filter((key): key is string => Boolean(key))),
    ];
    if (normalizedKeys.length > 0) out[normalizedDate] = normalizedKeys;
  }
  return out;
}

/** Stable per-step key. Phase-scoped so an AM and a PM step for the same product
 *  never collide. */
export function stepKey(phase: 'AM' | 'PM', productId: string): string {
  return `${phase}:${productId}`;
}

async function load(): Promise<Log> {
  let raw: string | null;
  try {
    raw = await getPrivateItem(KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizeCompletionLog(parsed);
    if (normalized) {
      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        if (Object.keys(normalized).length > 0)
          await setPrivateItem(KEY, JSON.stringify(normalized)).catch(() => undefined);
        else await removePrivateItem(KEY).catch(() => undefined);
      }
      return normalized;
    }
  } catch {
    /* malformed legacy/local state */
  }
  await removePrivateItem(KEY).catch(() => undefined);
  return {};
}

async function save(log: Log): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(log));
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

/** Toggle a step's completion for a day. Returns whether it is now done and whether
 *  this was the user's first-ever completion (the north-star activation moment).
 *  Dates outside the server completion window (docs/03 §6) are rejected. */
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
  const log = await load();
  const hadAny = Object.values(log).some((a) => a.length > 0);
  const day = new Set(log[normalizedDate] ?? []);
  let done: boolean;
  if (day.has(normalizedKey)) {
    day.delete(normalizedKey);
    done = false;
  } else {
    day.add(normalizedKey);
    done = true;
  }
  if (day.size > 0) log[normalizedDate] = [...day];
  else delete log[normalizedDate];
  await save(log);
  return { done, firstEver: done && !hadAny };
}

/** Dates with at least one completion (the streak's "completion days"). */
export async function getCompletedDates(): Promise<Set<string>> {
  const log = await load();
  return new Set(Object.keys(log).filter((d) => (log[d]?.length ?? 0) > 0));
}

/** Per-day completion counts (heat-map intensity). */
export async function getCountByDate(): Promise<Map<string, number>> {
  const log = await load();
  const m = new Map<string, number>();
  for (const [d, keys] of Object.entries(log)) if (keys.length > 0) m.set(d, keys.length);
  return m;
}

/** Test/seed reset. */
export async function clearCompletions(): Promise<void> {
  await removePrivateItem(KEY);
}
