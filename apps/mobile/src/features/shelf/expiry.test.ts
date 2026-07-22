import { describe, expect, it } from 'vitest';

import {
  calendarWeeksUsed,
  isEstimatedExpiry,
  localDateMonthLabel,
  localDateMonthYearLabel,
  surfacedExpiry,
} from './expiry';

describe('surfaced Shelf expiry provenance', () => {
  it('does not surface a date from unknown PAO provenance', () => {
    expect(
      surfacedExpiry({
        isOpened: true,
        openedAt: '2026-01-01',
        paoMonths: 6,
        expiryDate: null,
        expirySource: 'unknown',
      }),
    ).toBeNull();
  });

  it('surfaces explicit printed and category-derived dates according to their source', () => {
    expect(
      surfacedExpiry({
        isOpened: false,
        openedAt: null,
        paoMonths: null,
        expiryDate: '2027-02-01',
        expirySource: 'printed',
      }),
    ).toBe('2027-02-01');

    expect(
      surfacedExpiry({
        isOpened: true,
        openedAt: '2026-01-31',
        paoMonths: 3,
        expiryDate: '2026-06-01',
        expirySource: 'estimated',
      }),
    ).toBe('2026-04-30');
  });

  it('calls only a category-derived expiry estimate an estimate', () => {
    expect(
      isEstimatedExpiry({ expirySource: 'estimated', paoSource: 'category_default' }),
    ).toBe(true);
    expect(isEstimatedExpiry({ expirySource: 'pao_computed', paoSource: 'label' })).toBe(false);
    expect(isEstimatedExpiry({ expirySource: 'unknown', paoSource: 'unknown' })).toBe(false);
  });

  it('formats first-of-month local dates without UTC rollover', () => {
    expect(localDateMonthYearLabel('2026-07-01')).toBe('Jul 2026');
    expect(localDateMonthYearLabel('2026-07-01', 'long')).toBe('July 2026');
    expect(localDateMonthLabel('2026-07-01')).toBe('Jul');
  });

  it('rejects malformed local dates instead of normalizing them', () => {
    expect(localDateMonthYearLabel('2026-13-01')).toBeNull();
    expect(localDateMonthYearLabel('2026-02-30')).toBeNull();
    expect(localDateMonthYearLabel('07/01/2026')).toBeNull();
    expect(localDateMonthLabel('2026-00-10')).toBeNull();
  });

  it('compares archive usage by calendar day and keeps same-day use valid', () => {
    const localStart = new Date(2026, 6, 1, 23, 30).toISOString();
    expect(calendarWeeksUsed(localStart, '2026-07-01')).toBe(1);
    expect(calendarWeeksUsed(new Date(2026, 5, 17, 9).toISOString(), '2026-07-01')).toBe(2);
    expect(calendarWeeksUsed(new Date(2026, 6, 2, 9).toISOString(), '2026-07-01')).toBeNull();
    expect(calendarWeeksUsed('not-a-timestamp', '2026-07-01')).toBeNull();
    expect(calendarWeeksUsed(localStart, '2026-02-30')).toBeNull();
  });
});
