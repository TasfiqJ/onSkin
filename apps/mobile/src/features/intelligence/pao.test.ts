import { describe, expect, it } from 'vitest';

import { computeExpiry, expiryBadge, PAO_DEFAULTS_REVIEWED, resolvePaoMonths } from './pao';

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
    const b = expiryBadge('2026-05-01', today);
    expect(b.kind).toBe('expired');
    expect(b.label).toBe('Replace');
    expect(b.safety).toBeFalsy();
  });
  it('unknown badge reads "PAO est." (honesty over false precision)', () => {
    expect(expiryBadge(null, today).label).toBe('PAO est.');
  });
});

// New Smart Shelf badge states (docs/04 §5.3).
describe('badge taxonomy — paired + the eye/SPF safety exception (docs/04 §5.3)', () => {
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
  it('expired eye/SPF item gets the firmer, non-red "Replace for safety"', () => {
    const b = expiryBadge('2026-05-01', today, { safetyCritical: true });
    expect(b.kind).toBe('expired');
    expect(b.safety).toBe(true);
    expect(b.label).toBe('Replace for safety');
    // It is still never alarmist ("danger"/"!").
    expect(b.label).not.toMatch(/danger|!|warning/i);
  });
  it('a safety-critical countdown stays a calm countdown (not firmer)', () => {
    const b = expiryBadge('2026-07-04', today, { safetyCritical: true });
    expect(b.kind).toBe('countdown');
    expect(b.safety).toBeFalsy();
  });
});

// Launch-gate parity with the conflict matrix (claimsafety.test.ts asserts every
// rule's reviewedBy is null). The PAO category defaults are equally medical-
// adjacent (docs/04 §3, B-DERM-REVIEW) and must not silently ship as authoritative.
describe('PAO defaults are launch-gated (B-DERM-REVIEW)', () => {
  it('the category PAO defaults are flagged unreviewed until cosmetic-chemist sign-off', () => {
    expect(PAO_DEFAULTS_REVIEWED).toBe(false);
  });
});
