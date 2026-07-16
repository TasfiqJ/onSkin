import { describe, expect, it } from 'vitest';

import {
  CATALOG_SEARCH_MAX_QUERY_LENGTH,
  CATALOG_SEARCH_MIN_QUERY_LENGTH,
  catalogSearchTerm,
  isCatalogSearchQueryEligible,
  normalizeCatalogSearchQuery,
} from './searchQuery';

describe('catalog search query contract', () => {
  it('matches the server query bounds', () => {
    expect(CATALOG_SEARCH_MIN_QUERY_LENGTH).toBe(2);
    expect(CATALOG_SEARCH_MAX_QUERY_LENGTH).toBe(80);
  });

  it('collapses whitespace, trims, and caps the public query at 80 characters', () => {
    expect(normalizeCatalogSearchQuery('  CeraVe\n\t hydrating   cleanser  ')).toBe(
      'CeraVe hydrating cleanser',
    );

    const overlong = `  ${'a'.repeat(79)}   bc  `;
    const normalized = normalizeCatalogSearchQuery(overlong);
    expect(normalized).toHaveLength(CATALOG_SEARCH_MAX_QUERY_LENGTH);
    expect(normalized).toBe(`${'a'.repeat(79)} `);
  });

  it('normalizes nullish and non-string input exactly like the server', () => {
    expect(normalizeCatalogSearchQuery(null)).toBe('');
    expect(normalizeCatalogSearchQuery(undefined)).toBe('');
    expect(normalizeCatalogSearchQuery(12345)).toBe('12345');
  });

  it('removes database-search grammar and normalizes the remaining term', () => {
    expect(catalogSearchTerm('  10%_(Niacinamide), C\\E  ')).toBe('10 Niacinamide C E');
    expect(catalogSearchTerm('%_,()\\')).toBe('');
  });

  it('preserves Unicode text while applying the same whitespace rules', () => {
    expect(normalizeCatalogSearchQuery('  Crème\u00a0\u00a0brûlée  東京  ')).toBe(
      'Crème brûlée 東京',
    );
    expect(catalogSearchTerm('  Crème_(東京)  ')).toBe('Crème 東京');
  });

  it('requires at least two characters after search-term sanitization', () => {
    expect(isCatalogSearchQueryEligible('')).toBe(false);
    expect(isCatalogSearchQueryEligible('   ')).toBe(false);
    expect(isCatalogSearchQueryEligible('%_,()\\')).toBe(false);
    expect(isCatalogSearchQueryEligible('a%')).toBe(false);
    expect(isCatalogSearchQueryEligible('é')).toBe(false);
    expect(isCatalogSearchQueryEligible('ab')).toBe(true);
    expect(isCatalogSearchQueryEligible('東京')).toBe(true);
  });
});
