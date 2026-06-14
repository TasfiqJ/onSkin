import type { PhotoMilestone, PhotoSeries, TimeOfDay } from '@onskin/types';

/**
 * Pure photo-timeline logic (docs/06 §4): which two photos to compare by default,
 * how to group the film strip by month, the calm milestone markers, the metadata
 * line ("13 weeks · 26 photos · all on this phone"), and per-series reference
 * resolution. No I/O, no scoring. Just deterministic organisation of the user's
 * own photos so they can judge with their own eyes. Fully unit-tested.
 */

export type PhotoMeta = {
  id: string;
  series: PhotoSeries;
  /** Local calendar day, YYYY-MM-DD (the D-012 tz handling). */
  takenLocalDate: string;
  timeOfDay: TimeOfDay | null;
  alignmentScore: number | null;
  lightingScore: number | null;
  /** Explicitly chosen baseline for its series (else the earliest is implied). */
  isReference: boolean;
  referencePhotoId: string | null;
  /** On-device file path; null before the bytes exist (placeholder rendering). */
  localUri: string | null;
  notes: string | null;
};

const MS_PER_DAY = 86_400_000;

/** Parse YYYY-MM-DD at local noon to avoid DST/tz edge shifts. */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / MS_PER_DAY);
}

/** Photos of one series, oldest → newest (a series is internally consistent). */
export function forSeries(photos: PhotoMeta[], series: PhotoSeries = 'front'): PhotoMeta[] {
  return photos
    .filter((p) => p.series === series)
    .slice()
    .sort((a, b) => a.takenLocalDate.localeCompare(b.takenLocalDate));
}

/** The reference for a series: the explicit one, else the earliest (docs/06 §3). */
export function referenceFor(photos: PhotoMeta[], series: PhotoSeries = 'front'): PhotoMeta | null {
  const list = forSeries(photos, series);
  return list.find((p) => p.isReference) ?? list[0] ?? null;
}

/**
 * The default before/after pair to show in Compare (docs/06 §4): earliest vs
 * latest (the most legible "your own eyes" story). `intervalDays` lets the caller
 * ask for a one-cycle window instead. The before becomes the photo closest to
 * (latest − intervalDays). Returns null if a series has fewer than two photos.
 */
export function defaultComparePair(
  photos: PhotoMeta[],
  opts: { series?: PhotoSeries; intervalDays?: number } = {},
): { before: PhotoMeta; after: PhotoMeta } | null {
  const list = forSeries(photos, opts.series);
  if (list.length < 2) return null;
  const after = list[list.length - 1]!;
  if (opts.intervalDays == null) return { before: list[0]!, after };
  // Closest earlier photo to the requested interval back from `after`.
  const target = daysBetween(list[0]!.takenLocalDate, after.takenLocalDate) - opts.intervalDays;
  let before = list[0]!;
  let best = Infinity;
  for (const p of list) {
    if (p.id === after.id) continue;
    const offset = Math.abs(daysBetween(list[0]!.takenLocalDate, p.takenLocalDate) - Math.max(0, target));
    if (offset < best) {
      best = offset;
      before = p;
    }
  }
  return { before, after };
}

export type MonthGroup = { key: string; label: string; photos: PhotoMeta[] };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Group the film strip by month, newest month first, newest photo first within a
 * month (docs/06 §4). `todayYmd` lets the current month read "This month · June".
 */
export function groupByMonth(photos: PhotoMeta[], series: PhotoSeries = 'front', todayYmd?: string): MonthGroup[] {
  const list = forSeries(photos, series);
  const byKey = new Map<string, PhotoMeta[]>();
  for (const p of list) {
    const key = p.takenLocalDate.slice(0, 7); // YYYY-MM
    const bucket = byKey.get(key);
    if (bucket) bucket.push(p);
    else byKey.set(key, [p]);
  }
  const curMonthKey = (todayYmd ?? '').slice(0, 7);
  return [...byKey.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, ps]) => {
      const [y, m] = key.split('-').map(Number);
      const monthName = MONTHS[(m ?? 1) - 1]!;
      const label = key === curMonthKey ? `This month · ${monthName}` : `${monthName} ${y}`;
      return {
        key,
        label,
        photos: ps.slice().sort((a, b) => b.takenLocalDate.localeCompare(a.takenLocalDate)),
      };
    });
}

/** The thresholds, in days, that earn a calm milestone (docs/06 §4). */
const MILESTONE_DAYS: { milestone: PhotoMilestone; days: number }[] = [
  { milestone: 'four_weeks', days: 28 },
  { milestone: 'one_cycle', days: 84 },
];

/**
 * Calm, non-gamified milestones reached so far (docs/06 §4): the first photo, then
 * each threshold crossed measured from the first photo of the series. Returns the
 * photo that crossed each threshold so the timeline can mark it.
 */
export function detectMilestones(
  photos: PhotoMeta[],
  series: PhotoSeries = 'front',
): { milestone: PhotoMilestone; photo: PhotoMeta }[] {
  const list = forSeries(photos, series);
  if (list.length === 0) return [];
  const first = list[0]!;
  const out: { milestone: PhotoMilestone; photo: PhotoMeta }[] = [{ milestone: 'first', photo: first }];
  for (const { milestone, days } of MILESTONE_DAYS) {
    const crossing = list.find((p) => daysBetween(first.takenLocalDate, p.takenLocalDate) >= days);
    if (crossing) out.push({ milestone, photo: crossing });
  }
  return out;
}

/** Weeks the timeline spans, inclusive (docs/06 §4 "13 weeks"). */
export function weeksSpanned(photos: PhotoMeta[], series?: PhotoSeries): number {
  const list = series ? forSeries(photos, series) : photos.slice().sort((a, b) => a.takenLocalDate.localeCompare(b.takenLocalDate));
  if (list.length === 0) return 0;
  const span = daysBetween(list[0]!.takenLocalDate, list[list.length - 1]!.takenLocalDate);
  return Math.max(1, Math.round(span / 7));
}

/**
 * The metadata line under the title (docs/06 §4): "13 weeks · 26 photos · all on
 * this phone". Which doubles as a quiet privacy reassurance. Photo count is
 * across ALL series; weeks spans the whole timeline.
 */
export function metadataLine(photos: PhotoMeta[]): { weeks: number; count: number; text: string } {
  const count = photos.length;
  const weeks = weeksSpanned(photos);
  const wk = `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  const ph = `${count} ${count === 1 ? 'photo' : 'photos'}`;
  return { weeks, count, text: `${wk} · ${ph} · all on this phone` };
}
