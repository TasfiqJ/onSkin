// PURE helpers for the offline check-off queue (docs/01 §6). No RN/Supabase imports
// so the dedup/staleness logic is unit-testable in the Node vitest env.

export type PendingCompletion = {
  userId: string;
  routineId: string;
  stepId: string | null;
  completedDate: string; // YYYY-MM-DD, the user's LOCAL calendar day
  enqueuedAt: string; // ISO timestamp, for debugging/ordering
};

export function normalizeLocalDay(value: unknown): string | null {
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

export function normalizeQueueId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

export function normalizePendingCompletion(value: unknown): PendingCompletion | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const userId = normalizeQueueId(rec.userId);
  const routineId = normalizeQueueId(rec.routineId);
  const stepId = rec.stepId === null ? null : normalizeQueueId(rec.stepId);
  const completedDate = normalizeLocalDay(rec.completedDate);
  if (!userId || !routineId || !completedDate || (stepId === null && rec.stepId !== null)) {
    return null;
  }
  if (typeof rec.enqueuedAt !== 'string' || Number.isNaN(new Date(rec.enqueuedAt).getTime())) {
    return null;
  }
  return {
    userId,
    routineId,
    stepId,
    completedDate,
    enqueuedAt: new Date(rec.enqueuedAt).toISOString(),
  };
}

/** Stable identity for dedup; mirrors the DB unique (user, step, day). */
export function completionKey(
  c: Pick<PendingCompletion, 'userId' | 'routineId' | 'stepId' | 'completedDate'>,
): string {
  return `${c.userId}|${c.routineId}|${c.stepId ?? ''}|${c.completedDate}`;
}

/** Append a completion unless an identical one is already queued. */
export function withQueued(list: PendingCompletion[], rec: PendingCompletion): PendingCompletion[] {
  const normalized = normalizePendingCompletion(rec);
  if (!normalized) return list;
  const k = completionKey(normalized);
  return list.some((c) => completionKey(c) === k) ? list : [...list, normalized];
}

/** A local calendar day as YYYY-MM-DD (matches today/useToday, DECISIONS D-012). */
export function localDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftLocalDay(on: Date, days: number): string {
  return localDayString(new Date(on.getFullYear(), on.getMonth(), on.getDate() + days));
}

/**
 * The server accepts current_date - 2 through current_date + 1 (migration 0007
 * validate_completion). A queued completion outside that window will never be
 * accepted, so we drop it rather than retry forever.
 */
export function isStale(completedDate: string, on: Date): boolean {
  const normalizedDate = normalizeLocalDay(completedDate);
  if (!normalizedDate) return true;
  return normalizedDate < shiftLocalDay(on, -2) || normalizedDate > shiftLocalDay(on, 1);
}
