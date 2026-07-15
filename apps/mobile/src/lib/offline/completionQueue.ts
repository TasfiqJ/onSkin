import { getPersistedSupabaseUser, supabase } from '@/lib/supabase/client';
import { getPrivateItem, updatePrivateItem } from '@/lib/storage/privateKV';

import {
  completionKey,
  isStale,
  normalizeLocalDay,
  normalizePendingCompletion,
  withQueued,
  type PendingCompletion,
} from './completionQueue.pure';

export type { PendingCompletion } from './completionQueue.pure';

// Persisted offline write queue for routine check-offs (docs/01 §6: "writes must
// succeed locally and sync later"): a dependency-free queue-and-retry on the
// encrypted private KV store. A check-off is enqueued durably (it survives an
// app kill) and drained to Supabase when connectivity returns; dedup mirrors the
// DB unique (user, step, day).
//
// DEFERRED SYNC TARGET (B-SUPABASE / B-ROUTINE-PERSIST): the v1 source of truth
// for completions is the local-first log in `features/today/completionsStore.ts`.
// This queue is the server-sync half: it activates once the routine is persisted
// server-side and check-offs carry real `routine_id`/`step_id` UUIDs to insert.
// Until then `flushCompletions` no-ops (no session) and the feeder that maps the
// local log to server ids lands with B-ROUTINE-PERSIST. The pure dedup/staleness
// logic (completionQueue.pure.ts) is unit-tested and ready.
const KEY = 'onskin.completions.pending';
const SCHEMA_VERSION = 1 as const;

export const COMPLETION_QUEUE_INVALID = 'COMPLETION_QUEUE_INVALID';
export const COMPLETION_QUEUE_UNSUPPORTED_VERSION = 'COMPLETION_QUEUE_UNSUPPORTED_VERSION';

type CompletionQueueEnvelope = {
  version: typeof SCHEMA_VERSION;
  items: PendingCompletion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function queueError(code: string): Error {
  return new Error(code);
}

function normalizePendingList(value: unknown): PendingCompletion[] {
  if (!Array.isArray(value)) throw queueError(COMPLETION_QUEUE_INVALID);
  const out: PendingCompletion[] = [];
  for (const row of value) {
    const normalized = normalizePendingCompletion(row);
    if (!normalized) throw queueError(COMPLETION_QUEUE_INVALID);
    if (!out.some((existing) => completionKey(existing) === completionKey(normalized))) {
      out.push(normalized);
    }
  }
  return out;
}

function decodePending(raw: string | null): PendingCompletion[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw queueError(COMPLETION_QUEUE_INVALID);
  }

  if (Array.isArray(parsed)) return normalizePendingList(parsed);
  if (!isRecord(parsed)) throw queueError(COMPLETION_QUEUE_INVALID);
  if (!hasOwn(parsed, 'version')) throw queueError(COMPLETION_QUEUE_INVALID);
  if (parsed.version !== SCHEMA_VERSION) {
    if (
      typeof parsed.version === 'number' &&
      Number.isSafeInteger(parsed.version) &&
      parsed.version > SCHEMA_VERSION
    ) {
      throw queueError(COMPLETION_QUEUE_UNSUPPORTED_VERSION);
    }
    throw queueError(COMPLETION_QUEUE_INVALID);
  }
  return normalizePendingList(parsed.items);
}

function encodePending(items: PendingCompletion[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, items } satisfies CompletionQueueEnvelope);
}

export async function getPendingCompletions(): Promise<PendingCompletion[]> {
  try {
    return decodePending(await getPrivateItem(KEY));
  } catch {
    // Keep the public read fail-soft without repairing/deleting unreadable bytes.
    return [];
  }
}

export async function enqueueCompletion(rec: PendingCompletion): Promise<void> {
  await updatePrivateItem(KEY, (current) => encodePending(withQueued(decodePending(current), rec)));
}

/** Step ids checked off but not yet synced, for a given local day (read merge). */
export async function pendingStepIdsForDate(date: string): Promise<Set<string>> {
  const normalizedDate = normalizeLocalDay(date);
  if (!normalizedDate) return new Set();
  const out = new Set<string>();
  for (const c of await getPendingCompletions()) {
    if (c.completedDate === normalizedDate && c.stepId) out.add(c.stepId);
  }
  return out;
}

/**
 * Drain the queue to Supabase. Removes rows that land (or already exist; a 23505
 * dedup means it's recorded). Keeps rows that fail transiently (offline) for the
 * next attempt. Drops rows outside the server completion window or that belong to
 * a different signed-in user (they can't pass the current session's RLS). Safe to
 * call repeatedly; a no-op when the queue is empty or there's no session yet.
 */
export async function flushCompletions(
  now: Date = new Date(),
): Promise<{ flushed: number; remaining: number }> {
  const pending = await getPendingCompletions();
  if (pending.length === 0) return { flushed: 0, remaining: 0 };

  const { data } = await getPersistedSupabaseUser();
  const userId = data.user?.id;
  if (!userId) return { flushed: 0, remaining: pending.length }; // no session yet; retry later

  const removeKeys = new Set<string>();
  let flushed = 0;
  for (const rec of pending) {
    if (rec.userId !== userId) {
      removeKeys.add(completionKey(rec)); // a prior account's row; drop
      continue;
    }
    if (isStale(rec.completedDate, now)) {
      removeKeys.add(completionKey(rec)); // outside the server window; drop
      continue;
    }
    try {
      const { error } = await supabase.from('routine_completions').insert({
        user_id: userId,
        routine_id: rec.routineId,
        step_id: rec.stepId,
        completed_date: rec.completedDate,
      });
      if (!error || error.code === '23505') {
        removeKeys.add(completionKey(rec));
        flushed += 1; // landed, or already recorded (dedup)
      }
    } catch {
      // Network failure: leave the row in the latest queue for the next flush.
    }
  }

  let remaining = pending.length;
  await updatePrivateItem(KEY, (current) => {
    const latest = decodePending(current);
    const next = latest.filter((rec) => !removeKeys.has(completionKey(rec)));
    remaining = next.length;
    return encodePending(next);
  });
  return { flushed, remaining };
}
