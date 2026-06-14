import { describe, expect, it } from 'vitest';

import { bestStreak, buildWeek, monthHeat, streakState, weeklyDone } from './streak';

function set(...days: string[]): Set<string> {
  return new Set(days);
}

describe('calm forgiving streak. Current (docs/07 §4.1/§4.2)', () => {
  it('counts consecutive completion days', () => {
    const s = streakState(set('2026-06-13', '2026-06-12', '2026-06-11'), '2026-06-13');
    expect(s.current).toBe(3);
    expect(s.freezeActive).toBe(false);
    expect(s.lapsed).toBe(false);
  });

  it("today not-yet-done is neutral. It doesn't break the streak", () => {
    const s = streakState(set('2026-06-12', '2026-06-11', '2026-06-10'), '2026-06-13');
    expect(s.current).toBe(3);
    expect(s.freezeActive).toBe(false);
  });

  it('a clean run that simply ended is NOT reported as frozen (no trailing-miss artifact)', () => {
    const s = streakState(set('2026-06-13', '2026-06-12', '2026-06-11'), '2026-06-13');
    expect(s.frozenDates).toEqual([]);
    expect(s.freezeActive).toBe(false);
  });

  it('absorbs an interior missed day with an auto-freeze. Streak safe', () => {
    // missed 06-12, completed on both sides + a long tail
    const s = streakState(
      set('2026-06-13', '2026-06-11', '2026-06-10', '2026-06-09', '2026-06-08'),
      '2026-06-13',
    );
    expect(s.current).toBe(5);
    expect(s.freezeActive).toBe(true);
    expect(s.frozenDates).toContain('2026-06-12');
  });

  it('absorbs up to two missed days (the window), then resets at the third', () => {
    // gap of 3 consecutive misses (06-12,11,10) between today and older completions
    const s = streakState(
      set('2026-06-13', '2026-06-09', '2026-06-08', '2026-06-07'),
      '2026-06-13',
    );
    expect(s.current).toBe(1); // only 06-13 survives; the 3-day gap cut off the rest
    expect(s.freezeActive).toBe(false);
  });

  it('lapses when there is no completion within reach (earn-back)', () => {
    const s = streakState(set('2026-06-05'), '2026-06-13');
    expect(s.current).toBe(0);
    expect(s.lapsed).toBe(true);
  });

  it('a brand-new user with no completions has not lapsed', () => {
    expect(streakState(set(), '2026-06-13').lapsed).toBe(false);
  });
});

describe('longest streak. Non-decreasing best (D-011)', () => {
  it('finds the best forgiving run across history', () => {
    const completed = set(
      '2026-05-01', '2026-05-02', '2026-05-04', '2026-05-05', '2026-05-06', // 1 freeze (05-03) → run of 5
      '2026-06-10', '2026-06-11', // a later, shorter run of 2
    );
    expect(bestStreak(completed)).toBe(5);
  });
  it('resets the run when a gap exceeds the window', () => {
    // 05-01,05-02 then a 3-day gap then 05-06,05-07,05-08,05-09 → best 4
    const completed = set('2026-05-01', '2026-05-02', '2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09');
    expect(bestStreak(completed)).toBe(4);
  });
});

describe('weekly adherence + heat-map (docs/07 §4.3)', () => {
  it('builds Mon→Sun with done / missed / today / frozen states', () => {
    const today = '2026-06-13'; // Saturday
    const completed = set('2026-06-08', '2026-06-09', '2026-06-11');
    const frozen = set('2026-06-10');
    const week = buildWeek(completed, today, frozen);
    expect(week).toHaveLength(7);
    expect(week.find((d) => d.state === 'today')).toBeTruthy();
    expect(weeklyDone(week)).toBe(3);
    expect(week.some((d) => d.state === 'frozen')).toBe(true);
  });

  it('month heat-map intensities scale with completion count; future is empty', () => {
    const today = '2026-06-13';
    const counts = new Map([
      ['2026-06-01', 1],
      ['2026-06-02', 2],
      ['2026-06-03', 3],
    ]);
    const heat = monthHeat(counts, today);
    expect(heat[0]!.intensity).toBe(1);
    expect(heat[1]!.intensity).toBe(2);
    expect(heat[2]!.intensity).toBe(3);
    expect(heat[3]!.intensity).toBe(0); // 06-04, no completions
    expect(heat[29]!.intensity).toBe(0); // 06-30, future
  });
});
