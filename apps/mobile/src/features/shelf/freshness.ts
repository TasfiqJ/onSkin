import type { ExpirySource, PaoSource } from '@layerwell/types';

import { computeExpiryWithSource } from '@/features/intelligence/pao';

export const PAO_MONTH_OPTIONS = [3, 6, 9, 12, 18, 24] as const;
/** Engineering validation ceiling for bounded date math and malformed-data
 * rejection. It is not a regulatory limit or a claim about typical shelf life. */
export const MAX_PAO_MONTHS = 120;

const PAO_SOURCES = new Set<PaoSource>(['label', 'catalog', 'category_default', 'unknown']);

export type ShelfFreshness = {
  openedAt: string | null;
  isOpened: boolean;
  paoMonths: number | null;
  paoSource: PaoSource;
  expiryDate: string | null;
  expirySource: ExpirySource;
};

export type ShelfFreshnessInput = {
  category?: unknown;
  catalogProductId?: unknown;
  catalogSourceId?: unknown;
  catalogSource?: unknown;
  catalogMatchQuality?: unknown;
  sourceDisclosureAckAt?: unknown;
  openedAt?: unknown;
  isOpened?: unknown;
  paoMonths?: unknown;
  paoSource?: unknown;
  expiryDate?: unknown;
};

export function currentLocalDate(date = new Date()): string {
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

function boundedPaoMonthsOrNull(value: unknown): number | null {
  const months = positiveIntegerOrNull(value);
  return months != null && months <= MAX_PAO_MONTHS ? months : null;
}

export function parsePaoMonthInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d{1,3}$/.test(normalized)) return null;
  return boundedPaoMonthsOrNull(Number(normalized));
}

function paoSourceOrUnknown(value: unknown): PaoSource {
  return typeof value === 'string' && PAO_SOURCES.has(value as PaoSource)
    ? (value as PaoSource)
    : 'unknown';
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Retained fields proving the value passed through the strict reviewed-catalog
 * decoder. This is a local integrity fence, not an independent evidence review. */
function hasRetainedReviewedCatalogProvenance(input: ShelfFreshnessInput): boolean {
  return (
    isCanonicalUuid(input.catalogProductId) &&
    isCanonicalUuid(input.catalogSourceId) &&
    typeof input.catalogSource === 'string' &&
    input.catalogSource.trim().length > 0 &&
    (input.catalogMatchQuality === 'verified' || input.catalogMatchQuality === 'usable') &&
    typeof input.sourceDisclosureAckAt === 'string' &&
    !Number.isNaN(Date.parse(input.sourceDisclosureAckAt))
  );
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
  const candidatePaoMonths = boundedPaoMonthsOrNull(input.paoMonths);
  const candidatePaoSource =
    candidatePaoMonths == null ? 'unknown' : paoSourceOrUnknown(input.paoSource);
  const untrustedPao =
    candidatePaoSource === 'unknown' ||
    (candidatePaoSource === 'catalog' && !hasRetainedReviewedCatalogProvenance(input)) ||
    candidatePaoSource === 'category_default';
  const paoMonths = untrustedPao ? null : candidatePaoMonths;
  const paoSource = untrustedPao ? 'unknown' : candidatePaoSource;
  const expiryDate = validLocalDate(input.expiryDate);
  const computed = isOpened
    ? computeExpiryWithSource({ openedAt, paoMonths, expiryDate })
    : { date: expiryDate, source: expiryDate ? ('printed' as const) : ('unknown' as const) };
  const expirySource: ExpirySource = (() => {
    if (computed.source === 'printed') return 'printed';
    if (computed.source === 'unknown') return 'unknown';
    if (paoSource === 'label' || paoSource === 'catalog') return 'pao_computed';
    return 'unknown';
  })();

  return {
    openedAt,
    isOpened,
    paoMonths,
    paoSource,
    expiryDate,
    expirySource,
  };
}

/** Exact historical v1 policy used only to authenticate persisted v1 envelopes
 * before upgrading them. Do not use for new writes. */
export function normalizeShelfFreshnessV1(
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
