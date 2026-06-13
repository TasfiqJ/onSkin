import { describe, expect, it } from 'vitest';

import { computeExpiry, expiryBadge, resolvePaoMonths } from './pao';

describe('PAO resolution (docs/02 §6)', () => {
  it('prefers explicit pao, then catalog default, then category default, then null', () => {
    expect(resolvePaoMonths({ paoMonths: 6, catalogDefault: 12, category: 'serum' })).toBe(6);
    expect(resolvePaoMonths({ catalogDefault: 12, category: 'serum' })).toBe(12);
    expect(resolvePaoMonths({ category: 'vitamin_c_serum' })).toBe(4);
    expect(resolvePaoMonths({ category: 'unknown_cat' })).toBeNull();
    expect(resolvePaoMonths({})).toBeNull();
  });
});

describe('expiry computation (sooner of expiry vs opened+PAO)', () => {
  it('uses PAO when no explicit expiry', () => {
    expect(computeExpiry({ openedAt: '2026-01-15', paoMonths: 6 })).toBe('2026-07-15');
  });
  it('picks the sooner of the two', () => {
    expect(computeExpiry({ openedAt: '2026-01-15', paoMonths: 12, expiryDate: '2026-09-01' })).toBe('2026-09-01');
  });
  it('returns null when unknowable', () => {
    expect(computeExpiry({ openedAt: '2026-01-15' })).toBeNull();
    expect(computeExpiry({})).toBeNull();
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
  it('expired -> replace', () => {
    expect(expiryBadge('2026-05-01', today).kind).toBe('expired');
  });
});
