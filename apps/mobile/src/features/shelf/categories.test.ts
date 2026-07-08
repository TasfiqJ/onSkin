import { describe, expect, it } from 'vitest';

import { resolvePaoMonths } from '@/features/intelligence/pao';

import {
  categoryLabel,
  functionalTagsForCategory,
  isSafetyCriticalCategory,
  PRODUCT_CATEGORIES,
  usesPrintedExpiry,
} from './categories';

// The category model drives the manual-intake PAO default + the eye/SPF firmer
// exception (docs/04 §3/§4.4). These are B-DERM-REVIEW starting positions.
describe('shelf categories (docs/04 §4.4)', () => {
  it('every category resolves a label', () => {
    for (const c of PRODUCT_CATEGORIES) {
      expect(categoryLabel(c.id)).toBeTruthy();
    }
  });

  it('eye-area products and sunscreen are the only safety-critical categories', () => {
    expect(isSafetyCriticalCategory('eye_cream')).toBe(true);
    expect(isSafetyCriticalCategory('lash_brow')).toBe(true);
    expect(isSafetyCriticalCategory('mascara')).toBe(true);
    expect(isSafetyCriticalCategory('spf')).toBe(true);
    // Everything else stays calm.
    expect(isSafetyCriticalCategory('serum')).toBe(false);
    expect(isSafetyCriticalCategory('moisturiser_jar')).toBe(false);
    expect(isSafetyCriticalCategory(null)).toBe(false);
  });

  it('only sunscreen defers to a printed expiry (OTC drug)', () => {
    expect(usesPrintedExpiry('spf')).toBe(true);
    expect(usesPrintedExpiry('serum')).toBe(false);
  });

  it('derives only review-safe functional tags from explicit category picks', () => {
    expect(functionalTagsForCategory('retinoid_serum')).toEqual(['retinoid']);
    expect(functionalTagsForCategory('vitamin_c_serum')).toEqual(['vitamin_c']);
    expect(functionalTagsForCategory('benzoyl_peroxide')).toEqual(['benzoyl_peroxide']);
    expect(functionalTagsForCategory('serum')).toEqual([]);
    expect(functionalTagsForCategory('other')).toEqual([]);
    expect(functionalTagsForCategory(null)).toEqual([]);
  });

  it('each non-"other" category has a PAO default to pre-fill manual intake', () => {
    for (const c of PRODUCT_CATEGORIES) {
      if (c.id === 'other') continue;
      expect(resolvePaoMonths({ category: c.id })).not.toBeNull();
    }
  });
});
