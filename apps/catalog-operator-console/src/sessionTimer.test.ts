import { describe, expect, it } from 'vitest';

import {
  millisecondsUntilExpiry,
  OPERATOR_ABSOLUTE_SESSION_MS,
  OPERATOR_IDLE_TIMEOUT_MS,
  recordActivity,
  sessionExpiryReason,
} from './sessionTimer';

describe('operator session timer', () => {
  it('expires on idle and absolute limits without extending the absolute lifetime', () => {
    const start = 1_000;
    const clock = { startedAtMs: start, lastActivityAtMs: start };
    expect(sessionExpiryReason(clock, start + OPERATOR_IDLE_TIMEOUT_MS)).toBe('idle');

    const active = recordActivity(clock, start + OPERATOR_IDLE_TIMEOUT_MS - 1);
    expect(sessionExpiryReason(active, start + OPERATOR_IDLE_TIMEOUT_MS)).toBeNull();
    expect(sessionExpiryReason(active, start + OPERATOR_ABSOLUTE_SESSION_MS)).toBe('absolute');
    expect(millisecondsUntilExpiry(active, start + OPERATOR_ABSOLUTE_SESSION_MS)).toBe(0);
  });

  it('fails closed for invalid or backwards clocks', () => {
    const clock = { startedAtMs: 10, lastActivityAtMs: 10 };
    expect(sessionExpiryReason(clock, Number.NaN)).toBe('absolute');
    expect(recordActivity(clock, 9)).toEqual(clock);
    const active = recordActivity(clock, 20);
    expect(sessionExpiryReason(active, 15)).toBe('absolute');
    expect(millisecondsUntilExpiry(active, 15)).toBe(0);
  });
});
