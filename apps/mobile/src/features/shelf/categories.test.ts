import { describe, expect, it } from 'vitest';

import {
  categoryLabel,
  functionalTagsForCategory,
  isSunscreenCategory,
  PRODUCT_CATEGORIES,
} from './categories';

// Category selection supplies taxonomy and functional tags, never a PAO value.
describe('shelf categories (docs/04 §4.4)', () => {
  it('every category resolves a label', () => {
    for (const c of PRODUCT_CATEGORIES) {
      expect(categoryLabel(c.id)).toBeTruthy();
    }
  });

  it('normalizes the manual and catalog sunscreen category aliases', () => {
    for (const category of ['spf', 'sunscreen', ' SPF ', ' SunScreen ']) {
      expect(isSunscreenCategory(category)).toBe(true);
      expect(functionalTagsForCategory(category)).toEqual(['sunscreen']);
    }

    expect(isSunscreenCategory(null)).toBe(false);
  });

  it('derives only review-safe functional tags from explicit category picks', () => {
    expect(functionalTagsForCategory('retinoid_serum')).toEqual(['retinoid']);
    expect(functionalTagsForCategory('vitamin_c_serum')).toEqual(['vitamin_c']);
    expect(functionalTagsForCategory('benzoyl_peroxide')).toEqual(['benzoyl_peroxide']);
    expect(functionalTagsForCategory('serum')).toEqual([]);
    expect(functionalTagsForCategory('other')).toEqual([]);
    expect(functionalTagsForCategory(null)).toEqual([]);
  });
});
