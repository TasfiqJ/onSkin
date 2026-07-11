import type { ExpirySource, PaoSource } from '@onskin/types';

import { computeExpiryWithSource } from '@/features/intelligence/pao';

export const PAO_MONTH_OPTIONS = [3, 6, 9, 12, 18, 24] as const;

const PAO_SOURCES = new Set<PaoSource>(['label', 'catalog', 'category_default', 'unknown']);

export type ShelfFreshness = {
  openedAt: string | null;
  isOpened: boolean;
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null;
  expirySource: ExpirySource;
};

type ShelfFreshnessInput = {
  openedAt?: unknown;
  isOpened?: unknown;
  paoMonths?: unknown;
  paoSource?: unknown;
  expiryDate?: unknown;
};

function currentLocalDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validLocalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function shiftLocalDateMonths(value: string, months: number): string | null {
  const iso = validLocalDate(value);
  if (!iso || !Number.isInteger(months)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const absoluteMonth = year! * 12 + (month! - 1) + months;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day!, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(
    2,
    '0',
  )}`;
}

function positiveIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function paoSourceOrUnknown(value: unknown): PaoSource {
  return typeof value === 'string' && PAO_SOURCES.has(value as PaoSource)
    ? (value as PaoSource)
    : 'unknown';
}

/** Enforces the Shelf freshness invariants for persisted recovery and every write. */
export function normalizeShelfFreshness(
  input: ShelfFreshnessInput,
  today: string = currentLocalDate(),
): ShelfFreshness {
  const normalizedToday = validLocalDate(today) ?? currentLocalDate();
  const candidateOpenedAt = validLocalDate(input.openedAt);
  const openedAtNotFuture =
    candidateOpenedAt && candidateOpenedAt <= normalizedToday ? candidateOpenedAt : null;
  const requestedOpened =
    typeof input.isOpened === 'boolean' ? input.isOpened : openedAtNotFuture != null;
  const isOpened = requestedOpened && openedAtNotFuture != null;
  const openedAt = isOpened ? openedAtNotFuture : null;
  const paoMonths = positiveIntegerOrNull(input.paoMonths);
  const paoSource = paoMonths == null ? 'unknown' : paoSourceOrUnknown(input.paoSource);
  const expiryDate = validLocalDate(input.expiryDate);
  const computed = isOpened
    ? computeExpiryWithSource({ openedAt, paoMonths, expiryDate })
    : { date: expiryDate, source: expiryDate ? ('printed' as const) : ('unknown' as const) };
  const expirySource: ExpirySource = isOpened
    ? computed.source
    : expiryDate
      ? 'printed'
      : 'estimated';

  return {
    openedAt,
    isOpened,
    paoMonths,
    paoSource,
    expiryDate,
    expirySource,
  };
}
