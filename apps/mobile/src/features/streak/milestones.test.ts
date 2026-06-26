import { describe, expect, it } from 'vitest';

import { currentMilestone, milestoneThresholds } from './milestones';

// Calm streak milestones (docs/07 §4.5). Detection must be deterministic and the
// thresholds de-duplicated so a cycle length that coincides with 7/30 collapses.

describe('streak milestones', () => {
  it('returns null below the first milestone', () => {
    expect(currentMilestone(0, 4)).toBeNull();
    expect(currentMilestone(1, 4)).toBeNull();
  });

  it('surfaces the one-cycle milestone at the cycle length, before one week', () => {
    const m = currentMilestone(4, 4);
    expect(m?.key).toBe('one_cycle');
    expect(m?.copy).toMatch(/cycle/i);
  });

  it('surfaces the 7-day milestone at one week', () => {
    expect(currentMilestone(7, 4)?.key).toBe('d7');
  });

  it('surfaces the 30-day milestone at thirty days', () => {
    expect(currentMilestone(30, 4)?.key).toBe('d30');
    expect(currentMilestone(45, 4)?.key).toBe('d30');
  });

  it('reports the HIGHEST milestone reached, not the first', () => {
    expect(currentMilestone(20, 4)?.key).toBe('d7'); // past 7 + cycle, not yet 30
  });

  it('de-duplicates thresholds when the cycle length coincides with 7', () => {
    const ts = milestoneThresholds(7).map((m) => m.threshold);
    expect(ts).toEqual([...new Set(ts)]); // no duplicate 7
    expect(ts).toContain(7);
    expect(ts).toContain(30);
  });
});
