import { describe, expect, it } from 'vitest';

import { normalizeBarcode, normalizeIngredientToken, parsePercent } from './normalization';

describe('catalog normalization', () => {
  it('normalizes supported barcode lengths', () => {
    expect(normalizeBarcode(' 0 36000-29145 2 ')).toBe('036000291452');
    expect(normalizeBarcode('123')).toBeNull();
  });

  it('normalizes common INCI aliases without dropping tokens', () => {
    expect(normalizeIngredientToken('Aqua / Water / Eau')).toBe('water');
    expect(normalizeIngredientToken('Glycerine')).toBe('glycerin');
  });

  it('extracts label percentages for review', () => {
    expect(parsePercent('Niacinamide 10%')).toBe(10);
    expect(parsePercent('Glycerin')).toBeNull();
  });
});
