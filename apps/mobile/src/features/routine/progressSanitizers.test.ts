import { describe, expect, it } from 'vitest';

import {
  decodeServerAdherenceProjection,
  normalizeProgressCompletionDate,
  normalizeProgressCount,
  normalizeProgressLongestStreak,
} from './progressSanitizers';

describe('progress data sanitizers', () => {
  it('normalizes completion dates before they affect streaks or heat maps', () => {
    expect(normalizeProgressCompletionDate(' 2026-07-07 ')).toBe('2026-07-07');
    expect(normalizeProgressCompletionDate('2026-02-31')).toBeNull();
    expect(normalizeProgressCompletionDate('not-a-day')).toBeNull();
    expect(normalizeProgressCompletionDate(null)).toBeNull();
  });

  it('drops malformed progress counts and server personal-best streaks', () => {
    expect(normalizeProgressCount(2)).toBe(2);
    expect(normalizeProgressCount(0)).toBe(0);
    expect(normalizeProgressCount(1.5)).toBe(0);
    expect(normalizeProgressCount('3')).toBe(0);

    expect(normalizeProgressLongestStreak(14)).toBe(14);
    expect(normalizeProgressLongestStreak(-1)).toBe(0);
    expect(normalizeProgressLongestStreak(Number.NaN)).toBe(0);
    expect(normalizeProgressLongestStreak('14')).toBe(0);
  });

  it('strictly decodes the one-row authoritative adherence projection', () => {
    const row = {
      current_streak: 3,
      longest_streak: 8,
      adherence_timezone: 'America/Toronto',
      reference_day: '2026-07-26',
      frozen_dates: ['2026-07-24', '2026-07-22'],
      lapsed: false,
      algorithm_version: 1,
    };
    expect(decodeServerAdherenceProjection([row])).toEqual({
      currentStreak: 3,
      longestStreak: 8,
      adherenceTimezone: 'America/Toronto',
      referenceDay: '2026-07-26',
      frozenDates: ['2026-07-24', '2026-07-22'],
      lapsed: false,
      algorithmVersion: 1,
    });
    for (const value of [
      row,
      [],
      [{ ...row, longest_streak: 2 }],
      [{ ...row, reference_day: '2026-02-31' }],
      [{ ...row, frozen_dates: ['2026-07-22', '2026-07-24'] }],
      [{ ...row, frozen_dates: ['2026-07-24', '2026-07-24'] }],
      [{ ...row, algorithm_version: 0 }],
      [{ ...row, extra: true }],
    ]) {
      expect(decodeServerAdherenceProjection(value)).toBeNull();
    }
  });
});
