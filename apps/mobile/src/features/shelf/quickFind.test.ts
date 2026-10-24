import { expect, it } from 'vitest';
import { findSavedProducts } from './quickFind';

const products = [
  { name: 'Crème sérum', brand: 'Élan' },
  { name: 'Cleanser', brand: null },
  { name: 'SÉRUM calm', brand: 'Other' },
];
it('matches Unicode accents, case, whitespace and words across name and brand', () => {
  expect(findSavedProducts(products, ' ELAN  CREME ')).toEqual([products[0]]);
  expect(findSavedProducts(products, 'se\u0301rum')).toEqual([products[0], products[2]]);
});
it('preserves the admitted order and object identities without sorting or mutation', () => {
  expect(findSavedProducts(products, 'serum')[0]).toBe(products[0]);
  expect(findSavedProducts(products, '  ')).toBe(products);
  expect(products).toHaveLength(3);
});
it('treats punctuation as text and has an honest no-match result', () => {
  expect(findSavedProducts(products, '[.*]')).toEqual([]);
  expect(findSavedProducts([], 'cleanser')).toEqual([]);
});
