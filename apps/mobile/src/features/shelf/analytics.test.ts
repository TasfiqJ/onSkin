import { describe, expect, it } from 'vitest';

import { sanitizeAnalyticsEventName, sanitizeAnalyticsProps } from '@/lib/analytics/track';

import { PRODUCT_ADD_START_SOURCES } from './analytics';

describe('shelf add-start analytics', () => {
  it('keeps every product-add-start source privacy-safe', () => {
    expect(sanitizeAnalyticsEventName('product_add_started')).toBe('product_add_started');

    for (const source of PRODUCT_ADD_START_SOURCES) {
      expect(sanitizeAnalyticsProps('product_add_started', { source })).toEqual({ source });
    }
  });
});
