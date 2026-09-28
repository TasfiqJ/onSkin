import { computeExpiry } from '@/features/intelligence/pao';

import { validLocalDate } from './freshness';
import type { ShelfProduct } from './store';

const DAY_MS = 86_400_000;

// The surfaced expiry for a product (docs/04 §3): whichever is sooner of the
// user-recorded package date and opened+PAO. Unopened items have no PAO clock.
// Shared by the shelf list and detail hub so date displays never diverge.
export function surfacedExpiry(
  p: Pick<
    ShelfProduct,
    'isOpened' | 'openedAt' | 'paoMonths' | 'expiryDate' | 'expirySource'
  >,
): string | null {
  if (p.expirySource === 'unknown') return null;
  if (p.expirySource === 'printed') return p.expiryDate ?? null;
  if (!p.isOpened) return null;
  return computeExpiry({ openedAt: p.openedAt, paoMonths: p.paoMonths, expiryDate: p.expiryDate });
}

export function isEstimatedExpiry(p: Pick<ShelfProduct, 'expirySource' | 'paoSource'>): boolean {
  return p.expirySource === 'estimated' && p.paoSource === 'category_default';
}

/** "Sep 2026" month/year label for a surfaced expiry (docs/04 §5.6). */
export function expiryMonthLabel(iso: string | null): string | null {
  return localDateMonthYearLabel(iso);
}

/** Format an ISO local date without interpreting midnight as UTC first. */
export function localDateMonthYearLabel(
  iso: string | null,
  month: 'short' | 'long' = 'short',
): string | null {
  const localDate = validLocalDate(iso);
  if (!localDate) return null;
  const [year, numericMonth, day] = localDate.split('-').map(Number);
  return new Date(year!, numericMonth! - 1, day!).toLocaleDateString('en-US', {
    month,
    year: 'numeric',
  });
}

/** Short month label for a validated ISO local date. */
export function localDateMonthLabel(iso: string | null): string | null {
  const localDate = validLocalDate(iso);
  if (!localDate) return null;
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', { month: 'short' });
}

/** Calendar weeks from a timestamp's local day through a local finish date.
 * UTC day numbers avoid DST-length days while preserving local calendar dates. */
export function calendarWeeksUsed(createdAt: string, finishedAt: string | null): number | null {
  const finish = validLocalDate(finishedAt);
  const start = new Date(createdAt);
  if (!finish || Number.isNaN(start.getTime())) return null;
  const [finishYear, finishMonth, finishDay] = finish.split('-').map(Number);
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const finishDayNumber = Date.UTC(finishYear!, finishMonth! - 1, finishDay!);
  if (finishDayNumber < startDay) return null;
  return Math.max(1, Math.round((finishDayNumber - startDay) / (7 * DAY_MS)));
}
