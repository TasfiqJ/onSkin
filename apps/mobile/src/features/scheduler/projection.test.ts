import { afterAll, describe, expect, it } from 'vitest';

import { orchestrate, type SchedulerProfile } from './orchestrate';
import {
  addDays,
  cycleActiveSummaries,
  cycleRecoveryNightNumbers,
  nextSlotDate,
  nightFor,
  nightIndex,
  weekAhead,
} from './projection';

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

function withTimeZone<T>(timeZone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

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
    for (const p of week)
      expect(['exfoliate', 'retinoid', 'recover', 'other_active']).toContain(p.night.slot);
  });

  it('nextSlotDate finds the next exfoliation (acid) night', () => {
    const anchor = '2026-06-01';
    const next = nextSlotDate(cycle, anchor, '2026-06-01', 'exfoliate');
    if (cycle.nights.some((n) => n.slot === 'exfoliate')) {
      expect(next).not.toBeNull();
      expect(nightFor(cycle, anchor, next!).slot).toBe('exfoliate');
    }
  });

  it('summarises every scheduled product and all of its cycle nights', () => {
    const summaries = cycleActiveSummaries(cycle);

    expect(summaries.map((summary) => summary.productId)).toEqual(['g', 'r']);
    expect(summaries.every((summary) => summary.nightNumbers.length > 0)).toBe(true);
    expect(summaries.flatMap((summary) => summary.nightNumbers)).toHaveLength(
      cycle.nights.filter((night) => night.productId != null).length,
    );
  });

  it('returns every recovery night as a one-based display number', () => {
    const recoveryNights = cycleRecoveryNightNumbers(cycle);

    expect(recoveryNights).toEqual(
      cycle.nights.filter((night) => night.slot === 'recover').map((night) => night.index + 1),
    );
    expect(recoveryNights.every((night) => night >= 1)).toBe(true);
  });

  it.each([
    ['America/Toronto', 'spring-forward', ['2026-03-07', '2026-03-08', '2026-03-09']],
    ['America/Toronto', 'fall-back', ['2026-10-31', '2026-11-01', '2026-11-02']],
    ['America/Los_Angeles', 'spring-forward', ['2026-03-07', '2026-03-08', '2026-03-09']],
    ['America/Los_Angeles', 'fall-back', ['2026-10-31', '2026-11-01', '2026-11-02']],
    ['UTC', 'year rollover', ['2026-12-31', '2027-01-01', '2027-01-02']],
  ] as const)(
    'keeps date-only projection on calendar days in %s across %s',
    (timeZone, _transition, expectedDates) => {
      withTimeZone(timeZone, () => {
        const [start, middle, end] = expectedDates;
        expect(addDays(start, 1)).toBe(middle);
        expect(addDays(start, 2)).toBe(end);

        const projected = weekAhead(cycle, start, start, 2);
        expect(projected.map(({ dateISO }) => dateISO)).toEqual(expectedDates);
        expect(projected.map(({ dateISO }) => nightIndex(cycle, start, dateISO))).toEqual([
          0,
          1 % cycle.lengthNights,
          2 % cycle.lengthNights,
        ]);

        const expectedReverseIndex =
          ((-2 % cycle.lengthNights) + cycle.lengthNights) % cycle.lengthNights;
        expect(nightIndex(cycle, end, start)).toBe(expectedReverseIndex);
      });
    },
  );
});
