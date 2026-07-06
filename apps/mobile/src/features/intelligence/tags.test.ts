import { describe, expect, it } from 'vitest';

import { tagsForIngredientList } from './tags';

function tagsFor(...names: string[]) {
  return tagsForIngredientList(names).tags;
}

describe('front-label tag aliases', () => {
  it('recognises common retinoid front-label wording', () => {
    expect(tagsFor('Granactive Retinoid 2% Emulsion').has('retinoid')).toBe(true);
    expect(tagsFor('Hydroxypinacolone Retinoate Serum').has('retinoid')).toBe(true);
  });

  it('recognises common acid shorthand from manually entered product names', () => {
    expect(tagsFor('Glycolic 7% Toner').has('aha')).toBe(true);
    expect(tagsFor('AHA 30% + BHA 2% Peeling Solution').has('aha')).toBe(true);
    expect(tagsFor('AHA 30% + BHA 2% Peeling Solution').has('bha')).toBe(true);
    expect(tagsFor('Salicylic 2% Treatment').has('bha')).toBe(true);
  });

  it('recognises vitamin C and SPF front-label shorthand before catalog seed', () => {
    expect(tagsFor('Vitamin C Serum').has('vitamin_c')).toBe(true);
    expect(tagsFor('Vitamin-C Suspension').has('vitamin_c')).toBe(true);
    expect(tagsFor('Vit C Brightening Serum').has('vitamin_c')).toBe(true);
    expect(tagsFor('Mineral SPF 50').has('sunscreen')).toBe(true);
    expect(tagsFor('Daily SPF50 Fluid').has('sunscreen')).toBe(true);
    expect(tagsFor('Daily Sunscreen').has('sunscreen')).toBe(true);
    expect(tagsFor('Sport Sun Screen Lotion').has('sunscreen')).toBe(true);
  });
});
