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

  it('splits full-width and ideographic separators while preserving multilingual unknowns', () => {
    const result = parseIngredientText('水，甘油；烟酰胺、Α-Τοκοφερόλη, ماء الورد');

    expect(result.tokens.map((token) => token.normalizedToken)).toEqual([
      '水',
      '甘油',
      '烟酰胺',
      'α-τοκοφερόλη',
      'ماء الورد',
    ]);
    expect(result.unknownTokens).toEqual(['水', '甘油', '烟酰胺', 'Α-Τοκοφερόλη', 'ماء الورد']);
  });

  it('splits Arabic label punctuation without compatibility-folding the ordered text', () => {
    const result = parseIngredientText('ماء، جلسرين؛ نياسيناميد');

    expect(result.tokens.map((token) => token.normalizedToken)).toEqual([
      'ماء',
      'جلسرين',
      'نياسيناميد',
    ]);
    expect(result.unknownTokens).toEqual(['ماء', 'جلسرين', 'نياسيناميد']);
  });

  it('does not split numeric locants inside chemical ingredient names', () => {
    const result = parseIngredientText(
      'Water, 1,2-Hexanediol, 1,2-Pentanediol; 2,4-Diaminopyrimidine 3-Oxide',
    );

    expect(result.parserVersion).toBe('phase4-inci-parser-v2');
    expect(result.tokens.map((token) => token.normalizedToken)).toEqual([
      'water',
      '1,2-hexanediol',
      '1,2-pentanediol',
      '2,4-diaminopyrimidine 3-oxide',
    ]);
  });

  it('distinguishes numeric locants from no-space ingredient delimiters', () => {
    const result = parseIngredientText(
      'CI 77491,1,2-Hexanediol,77492,2,4-Diaminopyrimidine 3-Oxide',
    );

    expect(result.tokens.map((token) => token.normalizedToken)).toEqual([
      'ci 77491',
      '1,2-hexanediol',
      '77492',
      '2,4-diaminopyrimidine 3-oxide',
    ]);
  });

  it('preserves multi-part and embedded numeric locants', () => {
    const result = parseIngredientText('1, 2, 3-Propanetriol; Butane-1,3-diol');

    expect(result.tokens.map((token) => token.normalizedToken)).toEqual([
      '1,2,3-propanetriol',
      'butane-1,3-diol',
    ]);
  });
});
