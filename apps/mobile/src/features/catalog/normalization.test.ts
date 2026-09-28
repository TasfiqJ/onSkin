import { describe, expect, it } from 'vitest';

import {
  displayIngredientToken,
  normalizeBarcode,
  normalizeIngredientSeparators,
  normalizeIngredientToken,
  normalizeWhitespace,
  parsePercent,
} from './normalization';

describe('catalog normalization', () => {
  it('normalizes supported barcode lengths', () => {
    expect(normalizeBarcode(' 0 36000-29145 2 ')).toBe('036000291452');
    expect(normalizeBarcode('123')).toBeNull();
  });

  it('normalizes common INCI aliases without dropping tokens', () => {
    expect(normalizeIngredientToken('Aqua / Water / Eau')).toBe('water');
    expect(normalizeIngredientToken('Glycerine')).toBe('glycerin');
  });

  it('uses NFC without compatibility-folding multilingual ingredient text', () => {
    expect(normalizeWhitespace('Cafe\u0301  乳液')).toBe('Café 乳液');
    expect(normalizeIngredientToken('Α-Τοκοφερόλη')).toBe('α-τοκοφερόλη');
    expect(normalizeIngredientToken('ヒアルロン酸Ｎａ')).toBe('ヒアルロン酸ｎａ');
    expect(normalizeIngredientToken('ماء الورد')).toBe('ماء الورد');
    expect(displayIngredientToken('α-τοκοφερόλη')).toBe('Α-Τοκοφερόλη');
  });

  it('maps full-width and ideographic label separators for parser tokenization', () => {
    expect(normalizeIngredientSeparators('水，甘油；烟酰胺、泛醇')).toBe('水,甘油;烟酰胺,泛醇');
    expect(normalizeIngredientSeparators('ماء، جلسرين؛ نياسيناميد')).toBe(
      'ماء, جلسرين; نياسيناميد',
    );
  });

  it('preserves numeric locants while removing actual numbered-list decorators', () => {
    expect(normalizeIngredientToken('1,2-Hexanediol')).toBe('1,2-hexanediol');
    expect(normalizeIngredientToken('2,4-Diaminopyrimidine 3-Oxide')).toBe(
      '2,4-diaminopyrimidine 3-oxide',
    );
    expect(normalizeIngredientToken('1. Water')).toBe('water');
  });

  it('extracts label percentages for review', () => {
    expect(parsePercent('Niacinamide 10%')).toBe(10);
    expect(parsePercent('Glycerin')).toBeNull();
  });
});
