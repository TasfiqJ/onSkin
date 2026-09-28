export const OPERATOR_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const OPERATOR_ABSOLUTE_SESSION_MS = 60 * 60 * 1000;

export interface SessionClock {
  readonly startedAtMs: number;
  readonly lastActivityAtMs: number;
}

export type SessionExpiryReason = 'absolute' | 'idle' | null;

export function recordActivity(clock: SessionClock, nowMs: number): SessionClock {
  if (!Number.isFinite(nowMs) || nowMs < clock.startedAtMs) return clock;
  return { ...clock, lastActivityAtMs: Math.max(clock.lastActivityAtMs, nowMs) };
}

export function sessionExpiryReason(clock: SessionClock, nowMs: number): SessionExpiryReason {
  if (
    !Number.isFinite(nowMs) ||
    nowMs < clock.startedAtMs ||
    nowMs < clock.lastActivityAtMs
  ) {
    return 'absolute';
  }
  if (nowMs - clock.startedAtMs >= OPERATOR_ABSOLUTE_SESSION_MS) return 'absolute';
  if (nowMs - clock.lastActivityAtMs >= OPERATOR_IDLE_TIMEOUT_MS) return 'idle';
  return null;
}

export function millisecondsUntilExpiry(clock: SessionClock, nowMs: number): number {
  if (sessionExpiryReason(clock, nowMs) === 'absolute') return 0;
  const idleRemaining = OPERATOR_IDLE_TIMEOUT_MS - (nowMs - clock.lastActivityAtMs);
  const absoluteRemaining = OPERATOR_ABSOLUTE_SESSION_MS - (nowMs - clock.startedAtMs);
  return Math.max(0, Math.min(idleRemaining, absoluteRemaining));
}
