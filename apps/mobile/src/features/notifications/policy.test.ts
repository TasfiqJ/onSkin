import { describe, expect, it } from 'vitest';

import { canSend, tierEnabled, tierOf, toMinutes, WEEKLY_CAP, withinQuietHours } from './policy';

const ALL_ON = {
  amEnabled: true,
  pmEnabled: true,
  streakNudges: true,
  replenishmentAlerts: true,
  captureReminders: true,
  promotionalOptIn: true,
};

describe('notification tiers (docs/07 §3.1)', () => {
  it('maps each kind to exactly one tier', () => {
    expect(tierOf('am_reminder')).toBe('utility');
    expect(tierOf('pm_step')).toBe('utility');
    expect(tierOf('replenishment')).toBe('behavioural');
    expect(tierOf('rampup')).toBe('behavioural');
    expect(tierOf('winback')).toBe('promotional');
  });
  it('utility is uncapped; behavioural and promotional are capped', () => {
    expect(WEEKLY_CAP.utility).toBe(Infinity);
    expect(WEEKLY_CAP.behavioural).toBe(3);
    expect(WEEKLY_CAP.promotional).toBe(1);
  });
});

describe('per-kind opt-out gate (docs/07 §3.1, D-031)', () => {
  it('a kind is enabled only when its governing toggle is on', () => {
    expect(tierEnabled('replenishment', ALL_ON)).toBe(true);
    expect(tierEnabled('replenishment', { ...ALL_ON, replenishmentAlerts: false })).toBe(false);
    expect(tierEnabled('capture', { ...ALL_ON, captureReminders: false })).toBe(false);
  });
  it('winback is gated by the off-by-default promotional opt-in (consent gate, §8)', () => {
    expect(tierEnabled('winback', { ...ALL_ON, promotionalOptIn: false })).toBe(false);
    expect(tierEnabled('winback', ALL_ON)).toBe(true);
  });
  it('rampup/de-escalation fall under the streak-nudge toggle (no dedicated toggle)', () => {
    expect(tierEnabled('rampup', { ...ALL_ON, streakNudges: false })).toBe(false);
    expect(tierEnabled('deescalation', { ...ALL_ON, streakNudges: false })).toBe(false);
  });
});

describe('quiet hours (docs/07 §3.4)', () => {
  it('no window set → never quiet', () => {
    expect(withinQuietHours('23:00', null, null)).toBe(false);
  });
  it('overnight window 22:00→07:00 covers late night and early morning', () => {
    expect(withinQuietHours('23:30', '22:00', '07:00')).toBe(true);
    expect(withinQuietHours('06:30', '22:00', '07:00')).toBe(true);
    expect(withinQuietHours('07:00', '22:00', '07:00')).toBe(false); // end exclusive
    expect(withinQuietHours('12:00', '22:00', '07:00')).toBe(false);
  });
  it('same-day window 13:00→14:00', () => {
    expect(withinQuietHours('13:30', '13:00', '14:00')).toBe(true);
    expect(withinQuietHours('14:30', '13:00', '14:00')).toBe(false);
  });
  it('parses HH:MM:SS too (DB time)', () => {
    expect(toMinutes('09:30:00')).toBe(570);
  });
});

describe('canSend. Frequency cap + quiet hours (docs/07 §3.4/§9)', () => {
  const base = { now: '12:00', quietStart: '22:00', quietEnd: '07:00' } as const;
  it('allows a utility reminder regardless of weekly count', () => {
    expect(canSend({ kind: 'pm_step', sentThisWeekForTier: 99, ...base }).allowed).toBe(true);
  });
  it('caps behavioural triggers at 3/week', () => {
    expect(canSend({ kind: 'replenishment', sentThisWeekForTier: 2, ...base }).allowed).toBe(true);
    expect(canSend({ kind: 'replenishment', sentThisWeekForTier: 3, ...base })).toEqual({
      allowed: false,
      reason: 'frequency_cap',
    });
  });
  it('suppresses everything inside quiet hours, even utility', () => {
    expect(canSend({ kind: 'pm_step', sentThisWeekForTier: 0, now: '23:30', quietStart: '22:00', quietEnd: '07:00' })).toEqual({
      allowed: false,
      reason: 'quiet_hours',
    });
  });
  it('caps the promotional tier at 1/week', () => {
    expect(canSend({ kind: 'winback', sentThisWeekForTier: 1, ...base }).reason).toBe('frequency_cap');
  });
});
