import { describe, expect, it } from 'vitest';

import { pseudonymousUserId, sanitizeAnalyticsProps } from './track';

describe('analytics sanitizer', () => {
  it('drops sensitive keys and complex payloads', () => {
    expect(
      sanitizeAnalyticsProps({
        creative_variant: 'story-v1',
        screen_name: 'reveal',
        share_id: 'abcDEF_123456',
        native_ocr_enabled: true,
        rule_id: '00000000-0000-4000-8000-000000000001',
        product_id: 'prod_123',
        slug: 'retinoid-conflict',
        step: 'irritation',
        alignment_score: 0.91,
        medium: 'organic_share',
        product_name: 'Retinol',
        pregnancy_status: 'pregnant',
        email: 'person@example.com',
        nested: { unsafe: true },
      }),
    ).toEqual({
      creative_variant: 'story-v1',
      screen_name: 'reveal',
      share_id: 'abcDEF_123456',
      native_ocr_enabled: true,
    });
  });

  it('drops string values that look like contact or health context', () => {
    expect(
      sanitizeAnalyticsProps({
        source: 'share_card',
        medium: 'organic_share',
        contact: 'person@example.com',
        content: 'skin_profile',
      }),
    ).toEqual({ source: 'share_card' });
  });

  it('derives a stable pseudonymous user id without exposing the raw Supabase id', async () => {
    const raw = '00000000-0000-4000-8000-000000000001';
    const first = await pseudonymousUserId(raw);
    const second = await pseudonymousUserId(raw);

    expect(first).toBe(second);
    expect(first).toMatch(/^u_[a-f0-9]{32}$/);
    expect(first).not.toContain(raw);
  });
});
