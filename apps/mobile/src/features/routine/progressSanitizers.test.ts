import { describe, expect, it } from 'vitest';

import {
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
});
