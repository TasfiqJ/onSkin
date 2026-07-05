import { supabase } from '@/lib/supabase/client';
import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { isStale, withQueued, type PendingCompletion } from './completionQueue.pure';

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

export async function getPendingCompletions(): Promise<PendingCompletion[]> {
  try {
    const raw = await getPrivateItem(KEY);
    return raw ? (JSON.parse(raw) as PendingCompletion[]) : [];
  } catch {
    return [];
  }
}

async function savePending(list: PendingCompletion[]): Promise<void> {
  await setPrivateItem(KEY, JSON.stringify(list));
}

export async function enqueueCompletion(rec: PendingCompletion): Promise<void> {
  await savePending(withQueued(await getPendingCompletions(), rec));
}

/** Step ids checked off but not yet synced, for a given local day (read merge). */
export async function pendingStepIdsForDate(date: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (const c of await getPendingCompletions()) {
    if (c.completedDate === date && c.stepId) out.add(c.stepId);
  }
  return out;
}

/**
 * Drain the queue to Supabase. Removes rows that land (or already exist; a 23505
 * dedup means it's recorded). Keeps rows that fail transiently (offline) for the
 * next attempt. Drops rows that are stale (past the ~48h server cap) or that belong
 * to a different signed-in user (they can't pass the current session's RLS). Safe
 * to call repeatedly; a no-op when the queue is empty or there's no session yet.
 */
export async function flushCompletions(
  now: Date = new Date(),
): Promise<{ flushed: number; remaining: number }> {
  const pending = await getPendingCompletions();
  if (pending.length === 0) return { flushed: 0, remaining: 0 };

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { flushed: 0, remaining: pending.length }; // no session yet; retry later

  const remaining: PendingCompletion[] = [];
  let flushed = 0;
  for (const rec of pending) {
    if (rec.userId !== userId) continue; // a prior account's row; drop
    if (isStale(rec.completedDate, now)) continue; // past the server backfill cap; drop
    try {
      const { error } = await supabase.from('routine_completions').insert({
        user_id: userId,
        routine_id: rec.routineId,
        step_id: rec.stepId,
        completed_date: rec.completedDate,
      });
      if (!error || error.code === '23505') flushed += 1; // landed, or already recorded (dedup)
      else remaining.push(rec); // transient backend error; keep for the next flush
    } catch {
      remaining.push(rec); // network failure; keep for the next flush
    }
  }
  await savePending(remaining);
  return { flushed, remaining: remaining.length };
}
