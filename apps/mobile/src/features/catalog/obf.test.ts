import { describe, expect, it } from 'vitest';

import {
  buildOpenBeautyFactsUserAgent,
  isBeautyCategoryCandidate,
  mapObfProduct,
  sanitizeContributionPayload,
} from './obf';

describe('Open Beauty Facts mapping', () => {
  it('requires a product-opener compatible user agent', () => {
    expect(
      buildOpenBeautyFactsUserAgent({
        appName: 'Layerwell',
        version: '1.0.0',
        contactEmail: 'support@example.com',
      }),
    ).toBe('Layerwell/1.0.0 (support@example.com)');
    expect(() =>
      buildOpenBeautyFactsUserAgent({ appName: 'App', version: '1.0.0', contactEmail: 'bad' }),
    ).toThrow();
  });

  it('accepts skin-care categories and rejects oral care', () => {
    expect(isBeautyCategoryCandidate(['en:skin-care', 'en:serums'])).toBe(true);
    expect(isBeautyCategoryCandidate(['en:mouthwashes', 'en:beauty'])).toBe(false);
  });

  it('maps exact product records without image fields', () => {
    const mapped = mapObfProduct({
      code: ' 1234567890123 ',
      product_name: 'Gentle Serum',
      brands: 'Fixture Brand',
      ingredients_text: 'Water, Niacinamide',
      categories_tags: ['en:skin-care', 'en:serums'],
      last_modified_t: 1_767_225_600,
    });

    expect(mapped?.barcode).toBe('1234567890123');
    expect(mapped?.category).toBe('serum');
    expect(mapped?.sourceUrl).toContain('/product/1234567890123');
    expect(Object.keys(mapped ?? {})).not.toContain('image_url');
  });

  it('sanitizes contribution payloads to product facts only', () => {
    expect(
      sanitizeContributionPayload({
        barcode: 'abc12345678',
        productName: 'Product',
        brand: 'Brand',
        ingredientsText: 'Water',
      }),
    ).toEqual({
      code: '12345678',
      product_name: 'Product',
      brands: 'Brand',
      ingredients_text: 'Water',
    });
  });
});
