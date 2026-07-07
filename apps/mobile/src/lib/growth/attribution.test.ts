import { describe, expect, it } from 'vitest';

import {
  buildPublicGrowthUrl,
  isSafeOpaqueId,
  normalizePublicDomain,
  parseGrowthAttributionFromUrl,
  sanitizeAttribution,
  SENSITIVE_GROWTH_KEY,
} from './attribution';

describe('Phase 8 growth attribution stays privacy-safe', () => {
  it('normalizes only real production domains', () => {
    expect(normalizePublicDomain('https://RoutineKind.app/share')).toBe('routinekind.app');
    expect(normalizePublicDomain('https://example.com')).toBeNull();
    expect(normalizePublicDomain('routinekind.app?redirect=https://evil.example')).toBeNull();
    expect(normalizePublicDomain('routinekind.app@evil.com')).toBeNull();
    expect(normalizePublicDomain('javascript://routinekind.app')).toBeNull();
    expect(normalizePublicDomain('routinekind')).toBeNull();
    expect(normalizePublicDomain('')).toBeNull();
  });

  it('allows campaign metadata and the opaque share id only', () => {
    const clean = sanitizeAttribution({
      source: 'share_card',
      medium: 'organic_share',
      campaign: 'shelf_conflict_card_v1',
      creative_variant: 'story-v1',
      share_id: 'abcDEF_123456',
      product_name: 'Retinol',
      pregnancy: true,
      email: 'person@example.com',
      free_text: 'my shelf',
      arbitrary: 'ignored',
    });

    expect(clean).toEqual({
      source: 'share_card',
      medium: 'organic_share',
      campaign: 'shelf_conflict_card_v1',
      creative_variant: 'story-v1',
      share_id: 'abcDEF_123456',
    });
  });

  it('rejects non-opaque share ids and suspicious values', () => {
    expect(isSafeOpaqueId('abcDEF_123456')).toBe(true);
    expect(isSafeOpaqueId('short')).toBe(false);
    expect(sanitizeAttribution({ share_id: 'retinoid-user-123' })).toEqual({});
    expect(sanitizeAttribution({ content: 'hello world' })).toEqual({});
  });

  it('builds first-party links without sensitive query params', () => {
    const url = buildPublicGrowthUrl(
      '/s/abcDEF_123456',
      {
        source: 'share_card',
        medium: 'organic_share',
        campaign: 'shelf_conflict_card_v1',
        share_id: 'abcDEF_123456',
        skin_profile: 'DSPT',
      },
      { domain: 'routinekind.app' },
    );

    expect(url).toBe(
      'https://routinekind.app/s/abcDEF_123456?source=share_card&medium=organic_share&campaign=shelf_conflict_card_v1&share_id=abcDEF_123456',
    );
    expect(SENSITIVE_GROWTH_KEY.test(url!.split('?')[1] ?? '')).toBe(false);
  });

  it('rejects malformed public growth paths instead of composing confusing links', () => {
    expect(
      buildPublicGrowthUrl('/s/abcDEF_123456?product_name=Retinol', { source: 'share_card' }, {
        domain: 'routinekind.app',
      }),
    ).toBeNull();
    expect(
      buildPublicGrowthUrl('https://evil.com/s/abcDEF_123456', { source: 'share_card' }, {
        domain: 'routinekind.app',
      }),
    ).toBeNull();
    expect(
      buildPublicGrowthUrl('//evil.com/s/abcDEF_123456', { source: 'share_card' }, {
        domain: 'routinekind.app',
      }),
    ).toBeNull();
  });

  it('parses landing attribution through the same sanitizer', () => {
    expect(
      parseGrowthAttributionFromUrl(
        'https://onskin.app/s/abcDEF_123456?source=share_card&pregnancy=true&share_id=abcDEF_123456',
      ),
    ).toEqual({ source: 'share_card', share_id: 'abcDEF_123456' });
  });

  it('ignores malformed encoded attribution instead of throwing', () => {
    expect(() =>
      parseGrowthAttributionFromUrl('https://onskin.app/s/abcDEF_123456?source=%E0%A4%A&share_id=abcDEF_123456'),
    ).not.toThrow();
    expect(
      parseGrowthAttributionFromUrl('https://onskin.app/s/abcDEF_123456?source=%E0%A4%A&share_id=abcDEF_123456'),
    ).toEqual({ share_id: 'abcDEF_123456' });
  });
});
