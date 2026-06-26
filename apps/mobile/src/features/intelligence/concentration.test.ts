import { describe, expect, it } from 'vitest';

import { deriveConcentration } from './concentration';

describe('deriveConcentration (docs/02 §4.2 concentration band)', () => {
  it('reads a high-dose retinoid above its threshold', () => {
    expect(deriveConcentration('Retinol 1% Serum', ['retinoid'])).toBe('high');
    expect(deriveConcentration('Retinol 0.3% Night Serum', ['retinoid'])).toBe('low');
  });

  it('reads high-dose salicylic (>=2%) so the pregnancy safety rule can fire', () => {
    expect(deriveConcentration('2% BHA Liquid Exfoliant', ['bha'])).toBe('high');
    expect(deriveConcentration('Gentle 0.5% Salicylic Toner', ['bha'])).toBe('low');
  });

  it('reads glycolic and vitamin C bands', () => {
    expect(deriveConcentration('Glycolic 10% Toner', ['aha'])).toBe('high');
    expect(deriveConcentration('Glycolic 7% Toner', ['aha'])).toBe('low');
    expect(deriveConcentration('Vitamin C 20% Serum', ['vitamin_c'])).toBe('high');
  });

  it('returns undefined when no percent is present or no relevant active', () => {
    expect(deriveConcentration('Ceramide Moisturizer', ['ceramide'])).toBeUndefined();
    expect(deriveConcentration('Retinol Night Serum', ['retinoid'])).toBeUndefined();
    expect(deriveConcentration('50% Niacinamide-free formula', ['ceramide'])).toBeUndefined();
  });
});
