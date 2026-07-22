import { describe, expect, it } from 'vitest';

import {
  computeExpiry,
  computeExpiryWithSource,
  expiryBadge,
} from './pao';

describe('expiry computation (sooner of expiry vs opened+PAO)', () => {
  it('uses PAO when no explicit expiry', () => {
    expect(computeExpiry({ openedAt: '2026-01-15', paoMonths: 6 })).toBe('2026-07-15');
  });
  it('picks the sooner of the two', () => {
    expect(computeExpiry({ openedAt: '2026-01-15', paoMonths: 12, expiryDate: '2026-09-01' })).toBe(
      '2026-09-01',
    );
  });
  it('returns null when unknowable', () => {
    expect(computeExpiry({ openedAt: '2026-01-15' })).toBeNull();
    expect(computeExpiry({})).toBeNull();
  });
  it('clamps calendar month ends like PostgreSQL intervals', () => {
    expect(computeExpiry({ openedAt: '2026-01-31', paoMonths: 1 })).toBe('2026-02-28');
    expect(computeExpiry({ openedAt: '2024-01-31', paoMonths: 1 })).toBe('2024-02-29');
    expect(computeExpiry({ openedAt: '2026-08-31', paoMonths: 1 })).toBe('2026-09-30');
  });
  it('reports the source of the winning candidate and gives printed dates equal-date priority', () => {
    expect(
      computeExpiryWithSource({
        openedAt: '2026-01-31',
        paoMonths: 3,
        expiryDate: '2026-06-01',
      }),
    ).toEqual({ date: '2026-04-30', source: 'pao_computed' });
    expect(
      computeExpiryWithSource({
        openedAt: '2026-01-31',
        paoMonths: 3,
        expiryDate: '2026-04-30',
      }),
    ).toEqual({ date: '2026-04-30', source: 'printed' });
  });
  it('rejects invalid calendar inputs instead of overflowing them', () => {
    expect(computeExpiry({ openedAt: '2026-02-30', paoMonths: 1 })).toBeNull();
    expect(computeExpiry({ expiryDate: '2026-13-01' })).toBeNull();
  });
});

describe('expiry badge taxonomy (docs/02 §7.6)', () => {
  const today = '2026-06-13';
  it('unknown when no expiry', () => {
    expect(expiryBadge(null, today).kind).toBe('unknown');
  });
  it('future date shown neutrally', () => {
    const b = expiryBadge('2027-05-01', today);
    expect(b.kind).toBe('date');
    expect(b.label).toBe('May 2027');
  });
  it('countdown within threshold (the spec SPF "3 wks left")', () => {
    const b = expiryBadge('2026-07-04', today); // ~21 days
    expect(b.kind).toBe('countdown');
    expect(b.label).toBe('3 wks left');
  });
  it('uses neutral replacement language for an expired date', () => {
    const b = expiryBadge('2026-05-01', today);
    expect(b.kind).toBe('expired');
    expect(b.label).toBe('Time to replace');
    expect(b.label).not.toMatch(/danger|safety|warning|!/i);
  });
  it('labels an unknown date without calling it an estimate', () => {
    expect(expiryBadge(null, today).label).toBe('Date unknown');
    expect(expiryBadge('not-a-date', today).label).toBe('Date unknown');
  });
  it.each([
    ['2026-06-12', 'Jun 2026'],
    ['2026-06-13', 'Jun 2026'],
    ['2026-06-14', 'Jun 2026'],
    ['2026-06-20', 'Jun 2026'],
    ['2026-07-13', 'Jul 2026'],
    ['2026-07-14', 'Jul 2026'],
  ])('keeps an estimated %s date qualified without urgency', (expiry, monthYear) => {
    const b = expiryBadge(expiry, today, { estimate: true });

    expect(b).toEqual({ kind: 'unknown', label: `est.\n${monthYear}` });
    expect(b.label).not.toMatch(/days|wks|replace/i);
  });
});

// New Smart Shelf badge states (docs/04 §5.3).
describe('badge taxonomy: paired state (docs/04 §5.3)', () => {
  const today = '2026-06-13';
  it('a resolved pairing shows "paired" instead of a neutral future date', () => {
    const b = expiryBadge('2027-05-01', today, { paired: true });
    expect(b.kind).toBe('paired');
    expect(b.label).toBe('paired');
  });
  it('paired NEVER hides an urgent countdown (urgency wins)', () => {
    const b = expiryBadge('2026-07-04', today, { paired: true });
    expect(b.kind).toBe('countdown');
  });
});
