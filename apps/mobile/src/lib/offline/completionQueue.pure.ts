// PURE helpers for the offline check-off queue (docs/01 §6). No RN/Supabase imports
// so the dedup/staleness logic is unit-testable in the Node vitest env.

export type PendingCompletion = {
  userId: string;
  routineId: string;
  stepId: string | null;
  completedDate: string; // YYYY-MM-DD, the user's LOCAL calendar day
  enqueuedAt: string; // ISO timestamp, for debugging/ordering
};

/** Stable identity for dedup; mirrors the DB unique (user, step, day). */
export function completionKey(
  c: Pick<PendingCompletion, 'userId' | 'routineId' | 'stepId' | 'completedDate'>,
): string {
  return `${c.userId}|${c.routineId}|${c.stepId ?? ''}|${c.completedDate}`;
}

/** Append a completion unless an identical one is already queued. */
export function withQueued(list: PendingCompletion[], rec: PendingCompletion): PendingCompletion[] {
  const k = completionKey(rec);
  return list.some((c) => completionKey(c) === k) ? list : [...list, rec];
}

/** A local calendar day as YYYY-MM-DD (matches today/useToday, DECISIONS D-012). */
export function localDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The server caps backfill at ~48h (migration 0007 validate_completion). A queued
 * completion older than that will never be accepted, so we drop it rather than
 * retry forever. Cutoff = today - 2 days (local); dates on/after the cutoff are OK.
 */
export function isStale(completedDate: string, on: Date): boolean {
  const cutoff = new Date(on.getFullYear(), on.getMonth(), on.getDate() - 2);
  return completedDate < localDayString(cutoff);
}
