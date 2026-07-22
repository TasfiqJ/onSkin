import { describe, expect, it } from 'vitest';

import {
  currentLocalDate,
  normalizeShelfFreshness,
  parsePaoMonthInput,
  shiftLocalDateMonths,
  validLocalDate,
} from './freshness';

const TODAY = '2026-07-11';
const REVIEWED_CATALOG = {
  catalogProductId: '00000000-0000-4000-8000-000000000001',
  catalogSourceId: '00000000-0000-4000-8000-000000000002',
  catalogSource: 'routinekind_reviewed',
  catalogMatchQuality: 'usable',
  sourceDisclosureAckAt: '2026-07-11T12:00:00.000Z',
} as const;

describe('Shelf freshness normalization', () => {
  it('derives today from local calendar components instead of UTC serialization', () => {
    expect(currentLocalDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
    expect(currentLocalDate(new Date(2026, 11, 31, 23, 55))).toBe('2026-12-31');
  });

  it('keeps an explicitly unopened unit out of the PAO clock', () => {
    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
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
      expirySource: 'unknown',
    });
  });

  it('preserves a printed date for an unopened unit', () => {
    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
          isOpened: false,
          paoMonths: 12,
          paoSource: 'catalog',
          expiryDate: '2027-03-01',
        },
        TODAY,
      ),
    ).toMatchObject({
      isOpened: false,
      openedAt: null,
      expiryDate: '2027-03-01',
      expirySource: 'printed',
    });
  });

  it('runs a PAO clock only when an opened unit has a real non-future date', () => {
    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
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
    ).toMatchObject({ isOpened: false, openedAt: null, expirySource: 'unknown' });
  });

  it('fails every category default closed without exact retained review authority', () => {
    for (const input of [
      { ...REVIEWED_CATALOG, category: 'serum' },
      { ...REVIEWED_CATALOG, category: 'sunscreen' },
      { category: 'serum' },
    ]) {
      expect(
        normalizeShelfFreshness(
          {
            ...input,
            isOpened: true,
            openedAt: '2026-07-01',
            paoMonths: 9,
            paoSource: 'category_default',
          },
          TODAY,
        ),
      ).toMatchObject({ paoMonths: null, paoSource: 'unknown', expirySource: 'unknown' });
    }

    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
          isOpened: true,
          openedAt: '2026-07-01',
          paoMonths: 9,
          paoSource: 'unknown',
        },
        TODAY,
      ).expirySource,
    ).toBe('unknown');
  });

  it('accepts catalog PAO only with retained reviewed-catalog provenance', () => {
    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
          isOpened: true,
          openedAt: '2026-07-01',
          paoMonths: 12,
          paoSource: 'catalog',
        },
        TODAY,
      ),
    ).toMatchObject({ paoMonths: 12, paoSource: 'catalog', expirySource: 'pao_computed' });

    for (const input of [
      {},
      { ...REVIEWED_CATALOG, catalogSourceId: 'spoofed' },
      { ...REVIEWED_CATALOG, catalogMatchQuality: 'unverified' },
    ]) {
      expect(
        normalizeShelfFreshness(
          {
            ...input,
            isOpened: true,
            openedAt: '2026-07-01',
            paoMonths: 12,
            paoSource: 'catalog',
          },
          TODAY,
        ),
      ).toMatchObject({ paoMonths: null, paoSource: 'unknown', expirySource: 'unknown' });
    }
  });

  it('keeps explicit label and retained catalog PAO available for sunscreen', () => {
    expect(
      normalizeShelfFreshness(
        {
          category: 'sunscreen',
          isOpened: true,
          openedAt: '2026-07-01',
          paoMonths: 12,
          paoSource: 'label',
        },
        TODAY,
      ),
    ).toMatchObject({
      paoMonths: 12,
      paoSource: 'label',
      expirySource: 'pao_computed',
    });

    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
          category: 'sunscreen',
          isOpened: true,
          openedAt: '2026-07-01',
          paoMonths: 12,
          paoSource: 'catalog',
        },
        TODAY,
      ),
    ).toMatchObject({
      paoMonths: 12,
      paoSource: 'catalog',
      expirySource: 'pao_computed',
    });

    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
          category: 'sunscreen',
          isOpened: true,
          openedAt: '2026-07-01',
          paoMonths: 12,
          paoSource: 'category_default',
          expiryDate: '2027-01-01',
        },
        TODAY,
      ),
    ).toMatchObject({
      paoMonths: null,
      paoSource: 'unknown',
      expiryDate: '2027-01-01',
      expirySource: 'printed',
    });
  });

  it('uses provenance from the winning expiry candidate', () => {
    expect(
      normalizeShelfFreshness(
        {
          ...REVIEWED_CATALOG,
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
          ...REVIEWED_CATALOG,
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

  it('ignores unknown PAO values so a printed date always remains eligible', () => {
    for (const expiryDate of ['2026-02-01', '2026-12-01']) {
      expect(
        normalizeShelfFreshness(
          {
            isOpened: true,
            openedAt: '2026-01-01',
            paoMonths: 3,
            paoSource: 'unknown',
            expiryDate,
          },
          TODAY,
        ),
      ).toMatchObject({
        paoMonths: null,
        paoSource: 'unknown',
        expiryDate,
        expirySource: 'printed',
      });
    }
  });

  it('normalizes invalid PAO values and their source together', () => {
    for (const invalid of [-1, 0, 1.5, 121, Number.NaN]) {
      expect(
        normalizeShelfFreshness(
          { isOpened: true, openedAt: TODAY, paoMonths: invalid, paoSource: 'label' },
          TODAY,
        ),
      ).toMatchObject({ paoMonths: null, paoSource: 'unknown', expirySource: 'unknown' });
    }

    expect(
      normalizeShelfFreshness(
        { isOpened: true, openedAt: TODAY, paoMonths: 120, paoSource: 'label' },
        TODAY,
      ),
    ).toMatchObject({ paoMonths: 120, paoSource: 'label', expirySource: 'pao_computed' });
  });

  it('parses bounded custom label-month input without changing the entered unit', () => {
    expect(parsePaoMonthInput('36')).toBe(36);
    expect(parsePaoMonthInput(' 120 ')).toBe(120);
    for (const value of ['', '0', '121', '36M', '3.6', '-12']) {
      expect(parsePaoMonthInput(value)).toBeNull();
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
