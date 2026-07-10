import { describe, expect, it } from 'vitest';

import { parseIngredientText } from './ingredientParser';

describe('ingredient parser', () => {
  it('preserves order, tags known actives, and keeps unknown tokens', () => {
    const result = parseIngredientText(
      'Aqua / Water / Eau, Glycerin, Niacinamide, Retinol, Tocophenol',
    );

    expect(result.status).toBe('partial');
    expect(result.tokens.map((token) => token.normalizedToken)).toEqual([
      'water',
      'glycerin',
      'niacinamide',
      'retinol',
      'tocophenol',
    ]);
    expect(result.tokens[2]?.tags).toContain('niacinamide');
    expect(result.tokens[3]?.tags).toContain('retinoid');
    expect(result.unknownTokens).toEqual(['Tocophenol']);
  });

  it('detects active and inactive sections without merging them', () => {
    const result = parseIngredientText(
      'Active ingredients: Avobenzone 3%, Zinc Oxide 10%; Inactive ingredients: Water, Glycerin',
    );

    expect(result.activeSectionFound).toBe(true);
    expect(result.inactiveSectionFound).toBe(true);
    expect(result.tokens.filter((token) => token.section === 'active')).toHaveLength(2);
    expect(result.tokens[0]?.percent).toBe(3);
    expect(result.warnings).toContain('label_percentage_detected_review_required');
  });

  it('fails empty text explicitly', () => {
    const result = parseIngredientText(' ');
    expect(result.status).toBe('failed');
    expect(result.warnings).toContain('empty_ingredient_text');
  });
});
