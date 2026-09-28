import { describe, expect, it } from 'vitest';

import * as planCatalog from './plans';
import { monthlyEquivalent, offerLine, PLANS, priceAmount, REVERSE_TRIAL_DAYS } from './plans';

describe('plan catalog (docs/08 §2.3)', () => {
  it('annual is the default with a 14-day trial; monthly has no trial; no weekly plan', () => {
    expect(PLANS.annual.unit).toBe('year');
    expect(PLANS.annual.trialDays).toBe(14);
    expect(PLANS.monthly.unit).toBe('month');
    expect(PLANS.monthly.trialDays).toBe(0);
    expect((PLANS as Record<string, unknown>).weekly).toBeUndefined();
  });
  it('keeps RevenueCat product ids config-driven behind neutral local defaults', () => {
    expect(PLANS.annual.productId).toBe('layerwell_pro_annual_dev');
    expect(PLANS.monthly.productId).toBe('layerwell_pro_monthly_dev');
    expect(`${PLANS.annual.productId} ${PLANS.monthly.productId}`).not.toMatch(/onskin/i);
  });
  it('keeps the reverse trial at seven days without an invented win-back offer', () => {
    expect(REVERSE_TRIAL_DAYS).toBe(7);
    expect((planCatalog as Record<string, unknown>).WINBACK).toBeUndefined();
  });
});

describe('price formatting (display only. Real prices come from the offering)', () => {
  it('parses a fallback label', () => {
    expect(priceAmount('$49.99')).toBe(49.99);
  });
  it('floors the per-month equivalent so it never overstates ($49.99 → $4.16)', () => {
    expect(monthlyEquivalent('$49.99')).toBe('$4.16');
    expect(monthlyEquivalent('$39.99')).toBe('$3.33');
  });
  it('builds the honest billed-amount offer line', () => {
    expect(offerLine(PLANS.annual)).toBe('Start 14 days free, then $49.99/year');
    expect(offerLine(PLANS.monthly)).toBe('$8.99/month');
  });
});
