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

  it('associates a percentage with its named active instead of the first active', () => {
    expect(deriveConcentration('Niacinamide 1% + Salicylic Acid 2%', ['niacinamide', 'bha'])).toBe(
      'high',
    );
    expect(
      deriveConcentration('Niacinamide 10% + Salicylic Acid 0.5%', ['niacinamide', 'bha']),
    ).toBe('low');
  });

  it('does not assign an unrelated percentage to BHA without a stated BHA strength', () => {
    expect(
      deriveConcentration('BHA Exfoliant with Niacinamide 10%', ['bha', 'niacinamide']),
    ).toBeUndefined();
    expect(
      deriveConcentration('Niacinamide 10% BHA Exfoliant', ['niacinamide', 'bha']),
    ).toBeUndefined();
    expect(deriveConcentration('Panthenol 1%; Salicylic Acid', ['bha'])).toBeUndefined();
  });

  it('requires every threshold-bearing active in a multi-active name to be resolved', () => {
    expect(deriveConcentration('Retinol 0.3% + Glycolic Acid 7%', ['retinoid', 'aha'])).toBe('low');
    expect(deriveConcentration('Retinol 0.3% + Glycolic Acid 10%', ['retinoid', 'aha'])).toBe(
      'high',
    );
    expect(
      deriveConcentration('Retinol 0.3% + BHA Exfoliant', ['retinoid', 'bha']),
    ).toBeUndefined();
  });

  it('returns undefined when no percent is present or no relevant active', () => {
    expect(deriveConcentration('Ceramide Moisturizer', ['ceramide'])).toBeUndefined();
    expect(deriveConcentration('Retinol Night Serum', ['retinoid'])).toBeUndefined();
    expect(deriveConcentration('50% Niacinamide-free formula', ['ceramide'])).toBeUndefined();
    expect(deriveConcentration('1% Acne Treatment', ['bha'])).toBeUndefined();
  });
});
