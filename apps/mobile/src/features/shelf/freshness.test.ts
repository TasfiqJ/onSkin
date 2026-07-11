import { describe, expect, it } from 'vitest';

import { normalizeShelfFreshness, shiftLocalDateMonths, validLocalDate } from './freshness';

const TODAY = '2026-07-11';

describe('Shelf freshness normalization', () => {
  it('keeps an explicitly unopened unit out of the PAO clock', () => {
    expect(
      normalizeShelfFreshness(
        {
          isOpened: false,
          openedAt: '2026-06-01',
          paoMonths: 12,
          paoSource: 'catalog',
        },
        TODAY,
      ),
    ).toEqual({
      isOpened: false,
      openedAt: null,
      paoMonths: 12,
      paoSource: 'catalog',
      expiryDate: null,
      expirySource: 'estimated',
    });
  });

  it('runs a PAO clock only when an opened unit has a real non-future date', () => {
    expect(
      normalizeShelfFreshness(
        {
          isOpened: true,
          openedAt: '2026-07-11',
          paoMonths: 6,
          paoSource: 'label',
        },
        TODAY,
      ),
    ).toMatchObject({
      isOpened: true,
      openedAt: TODAY,
      expirySource: 'pao_computed',
    });

    expect(
      normalizeShelfFreshness(
        { isOpened: true, openedAt: '2026-07-12', paoMonths: 6, paoSource: 'label' },
        TODAY,
      ),
    ).toMatchObject({ isOpened: false, openedAt: null, expirySource: 'estimated' });
  });

  it('uses provenance from the winning expiry candidate', () => {
    expect(
      normalizeShelfFreshness(
        {
          isOpened: true,
          openedAt: '2026-01-31',
          paoMonths: 3,
          paoSource: 'catalog',
          expiryDate: '2026-06-01',
        },
        TODAY,
      ).expirySource,
    ).toBe('pao_computed');

    expect(
      normalizeShelfFreshness(
        {
          isOpened: true,
          openedAt: '2026-01-31',
          paoMonths: 12,
          paoSource: 'catalog',
          expiryDate: '2026-06-01',
        },
        TODAY,
      ).expirySource,
    ).toBe('printed');
  });

  it('normalizes invalid PAO values and their source together', () => {
    for (const invalid of [-1, 0, 1.5, Number.NaN]) {
      expect(
        normalizeShelfFreshness(
          { isOpened: true, openedAt: TODAY, paoMonths: invalid, paoSource: 'label' },
          TODAY,
        ),
      ).toMatchObject({ paoMonths: null, paoSource: 'unknown', expirySource: 'unknown' });
    }
  });
});

describe('local calendar date validation', () => {
  it('accepts real leap days and rejects impossible or malformed dates', () => {
    expect(validLocalDate('2024-02-29')).toBe('2024-02-29');
    expect(validLocalDate('2026-02-29')).toBeNull();
    expect(validLocalDate('2026-02-30')).toBeNull();
    expect(validLocalDate('2026-7-01')).toBeNull();
    expect(validLocalDate('not-a-date')).toBeNull();
  });

  it('shifts month ends without JavaScript overflow', () => {
    expect(shiftLocalDateMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftLocalDateMonths('2024-03-31', -1)).toBe('2024-02-29');
  });
});
