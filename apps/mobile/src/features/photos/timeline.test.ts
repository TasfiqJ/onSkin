import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  defaultComparePair,
  detectMilestones,
  forSeries,
  groupByMonth,
  metadataLine,
  referenceFor,
  weeksSpanned,
  type PhotoMeta,
} from './timeline';

function mk(id: string, date: string, extra: Partial<PhotoMeta> = {}): PhotoMeta {
  return {
    id,
    series: 'front',
    takenLocalDate: date,
    timeOfDay: 'morning',
    alignmentScore: 0.9,
    lightingScore: 0.85,
    isReference: false,
    referencePhotoId: null,
    localUri: null,
    notes: null,
    ...extra,
  };
}

describe('date helpers (local-day, tz-safe. D-012)', () => {
  it('counts whole days between local dates', () => {
    expect(daysBetween('2026-03-12', '2026-06-12')).toBe(92);
    expect(daysBetween('2026-06-12', '2026-06-12')).toBe(0);
  });
});

describe('metadata line (docs/06 §4. "13 weeks · 26 photos · all on this phone")', () => {
  it('reproduces the spec line for a 13-week, 26-photo timeline', () => {
    const photos: PhotoMeta[] = [mk('first', '2026-03-12')];
    for (let i = 1; i <= 24; i++) {
      // 24 filler shots strictly inside the window (Apr/May) so span stays Mar12→Jun12.
      const month = i <= 12 ? 4 : 5;
      const day = ((i - 1) % 12) * 2 + 1; // 1,3,5… within the month
      photos.push(mk(`p${i}`, `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`));
    }
    photos.push(mk('last', '2026-06-12'));
    const m = metadataLine(photos);
    expect(m.count).toBe(26);
    expect(m.weeks).toBe(13);
    expect(m.text).toBe('13 weeks · 26 photos · all on this phone');
  });
  it('singularises for a one-photo-per-week start', () => {
    const m = metadataLine([mk('a', '2026-06-01'), mk('b', '2026-06-08')]);
    expect(m.text).toBe('1 week · 2 photos · all on this phone');
  });
});

describe('compare pairing (docs/06 §4)', () => {
  const photos = [mk('a', '2026-03-12'), mk('b', '2026-03-20'), mk('c', '2026-05-01'), mk('d', '2026-06-12')];
  it('defaults to earliest vs latest', () => {
    const pair = defaultComparePair(photos);
    expect(pair?.before.id).toBe('a');
    expect(pair?.after.id).toBe('d');
  });
  it('one-cycle interval picks the photo closest to (latest − 84d)', () => {
    // latest = Jun 12 (92d after first); target ≈ 8d after first → Mar 20 (b).
    const pair = defaultComparePair(photos, { intervalDays: 84 });
    expect(pair?.before.id).toBe('b');
    expect(pair?.after.id).toBe('d');
  });
  it('returns null with fewer than two in the series', () => {
    expect(defaultComparePair([mk('only', '2026-06-12')])).toBeNull();
  });
});

describe('series isolation + reference (docs/06 §3)', () => {
  const photos = [
    mk('f1', '2026-03-12'),
    mk('f2', '2026-04-12', { isReference: true }),
    mk('L1', '2026-03-15', { series: 'left' }),
  ];
  it('forSeries filters and sorts oldest→newest', () => {
    expect(forSeries(photos, 'front').map((p) => p.id)).toEqual(['f1', 'f2']);
    expect(forSeries(photos, 'left').map((p) => p.id)).toEqual(['L1']);
  });
  it('reference is the explicit one, else the earliest', () => {
    expect(referenceFor(photos, 'front')?.id).toBe('f2'); // explicit
    expect(referenceFor([mk('x', '2026-03-12'), mk('y', '2026-04-12')])?.id).toBe('x'); // earliest
  });
});

describe('month grouping (docs/06 §4 film strip)', () => {
  const photos = [
    mk('mar', '2026-03-12'),
    mk('may', '2026-05-11'),
    mk('jun1', '2026-06-01'),
    mk('jun12', '2026-06-12'),
  ];
  it('groups newest-month-first, newest-photo-first, marking the current month', () => {
    const groups = groupByMonth(photos, 'front', '2026-06-13');
    expect(groups.map((g) => g.key)).toEqual(['2026-06', '2026-05', '2026-03']);
    expect(groups[0]!.label).toBe('This month · June');
    expect(groups[0]!.photos.map((p) => p.id)).toEqual(['jun12', 'jun1']);
    expect(groups[1]!.label).toBe('May 2026');
  });
});

describe('calm milestones (docs/06 §4. Not gamified)', () => {
  it('marks first, four_weeks (≥28d) and one_cycle (≥84d)', () => {
    const photos = [mk('a', '2026-03-12'), mk('b', '2026-04-12'), mk('c', '2026-06-12')];
    const ms = detectMilestones(photos);
    expect(ms.map((m) => m.milestone)).toEqual(['first', 'four_weeks', 'one_cycle']);
    expect(ms.find((m) => m.milestone === 'first')?.photo.id).toBe('a');
    expect(ms.find((m) => m.milestone === 'one_cycle')?.photo.id).toBe('c');
  });
  it('only the milestones actually reached appear', () => {
    const photos = [mk('a', '2026-06-01'), mk('b', '2026-06-08')]; // 7 days
    expect(detectMilestones(photos).map((m) => m.milestone)).toEqual(['first']);
  });
  it('weeksSpanned is inclusive and rounded', () => {
    expect(weeksSpanned([mk('a', '2026-03-12'), mk('b', '2026-06-12')])).toBe(13);
  });
});
