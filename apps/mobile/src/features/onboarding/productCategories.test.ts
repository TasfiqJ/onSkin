import { describe, expect, it } from 'vitest';

import { categoryLabel, PRODUCT_CATEGORIES } from '@/features/shelf/categories';

import { ONBOARDING_PRODUCT_CATEGORIES } from './productCategories';

describe('onboarding product categories', () => {
  it('uses canonical shelf category IDs with user-facing labels', () => {
    const canonicalIds = new Set(PRODUCT_CATEGORIES.map((category) => category.id));

    for (const category of ONBOARDING_PRODUCT_CATEGORIES) {
      expect(canonicalIds.has(category.id)).toBe(true);
      expect(categoryLabel(category.id)).not.toBe(category.id);
    }
  });
});
