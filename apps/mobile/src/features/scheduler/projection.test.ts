import { afterAll, describe, expect, it } from 'vitest';

import { orchestrate, type SchedulerProfile } from './orchestrate';
import { addDays, nextSlotDate, nightFor, nightIndex, weekAhead } from './projection';

// The projection algorithm (docs/05 §3): pure, local-day aware, safe modulo.
// The cycle fixture uses unreviewed cadence rules, which are dev-only until B-DERM-REVIEW.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

const base: SchedulerProfile = { sensitivity: 'neutral', pregnancy: false, goals: [] };
const cycle = orchestrate(
  [
    { id: 'r', name: 'Retinol', tags: ['retinoid'] },
    { id: 'g', name: 'Glycolic', tags: ['aha'] },
  ],
  base,
).cycle!;

afterAll(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
});

describe('projection (docs/05 §3)', () => {
  it('night_index wraps with the cycle length', () => {
    const anchor = '2026-06-01';
    const L = cycle.lengthNights;
    expect(nightIndex(cycle, anchor, anchor)).toBe(0);
    expect(nightIndex(cycle, anchor, addDays(anchor, L))).toBe(0); // full wrap
    expect(nightIndex(cycle, anchor, addDays(anchor, 1))).toBe(1 % L);
  });

  it('is safe for dates before the anchor (no negative index)', () => {
    const anchor = '2026-06-10';
    const idx = nightIndex(cycle, anchor, '2026-06-08'); // 2 days before
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(cycle.lengthNights);
  });

  it('weekAhead defaults to a full seven-night projection', () => {
    const week = weekAhead(cycle, '2026-06-01', '2026-06-12');
    expect(week.length).toBe(7);
    expect(week[0]!.dateISO).toBe('2026-06-12');
    expect(week[6]!.dateISO).toBe('2026-06-18');
    for (const p of week) expect(['exfoliate', 'retinoid', 'recover', 'other_active']).toContain(p.night.slot);
  });

  it('nextSlotDate finds the next exfoliation (acid) night', () => {
    const anchor = '2026-06-01';
    const next = nextSlotDate(cycle, anchor, '2026-06-01', 'exfoliate');
    if (cycle.nights.some((n) => n.slot === 'exfoliate')) {
      expect(next).not.toBeNull();
      expect(nightFor(cycle, anchor, next!).slot).toBe('exfoliate');
    }
  });
});
