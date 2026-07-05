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

/** Stable per-step key. Phase-scoped so an AM and a PM step for the same product
 *  never collide. */
export function stepKey(phase: 'AM' | 'PM', productId: string): string {
  return `${phase}:${productId}`;
}

async function load(): Promise<Log> {
  try {
    const raw = await getPrivateItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Log) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function save(log: Log): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(log));
}

/** The step keys checked off on `date`. */
export async function getCompletedSteps(date: string = localDateString()): Promise<Set<string>> {
  const log = await load();
  return new Set(log[date] ?? []);
}

/** Whether a completion date is older than the ~48h backfill cap (docs/07 §4.4):
 *  the server rejects backdating past today-2, so the local store must too, or a
 *  future "log an earlier day" surface could silently inflate the streak. Cutoff =
 *  today - 2 local days; dates on/after the cutoff are allowed. */
export function isBeyondBackfillCap(date: string, today: string = localDateString()): boolean {
  const t = new Date(`${today}T00:00:00`);
  const cutoff = localDateString(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2));
  return date < cutoff;
}

/** Toggle a step's completion for a day. Returns whether it is now done and whether
 *  this was the user's first-ever completion (the north-star activation moment).
 *  Backdating past the 48h cap (docs/07 §4.4) is rejected to prevent streak abuse. */
export async function toggleCompletion(
  key: string,
  date: string = localDateString(),
): Promise<{ done: boolean; firstEver: boolean }> {
  if (isBeyondBackfillCap(date)) {
    // Outside the 48h backfill window: do not record, report it as not-done.
    const existing = await getCompletedSteps(date);
    return { done: existing.has(key), firstEver: false };
  }
  const log = await load();
  const hadAny = Object.values(log).some((a) => a.length > 0);
  const day = new Set(log[date] ?? []);
  let done: boolean;
  if (day.has(key)) {
    day.delete(key);
    done = false;
  } else {
    day.add(key);
    done = true;
  }
  if (day.size > 0) log[date] = [...day];
  else delete log[date];
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
