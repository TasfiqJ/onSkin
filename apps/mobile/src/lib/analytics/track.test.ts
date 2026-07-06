import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { pseudonymousUserId, sanitizeAnalyticsEventName, sanitizeAnalyticsProps } from './track';

const TRACK_SOURCE = fileURLToPath(new URL('./track.ts', import.meta.url));

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
        product_type: 'mineral_spf',
        trigger: 'gap',
        intent: 'medical',
        email: 'person@example.com',
        nested: { unsafe: true },
        change_state: 'consistent',
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
        type: 'spf',
        reason: 'irritation',
        feature: 'conflict_checks',
        contact: 'person@example.com',
        content: 'skin_profile',
      }),
    ).toEqual({ source: 'share_card' });
  });

  it('drops photo quality result buckets while preserving generic result buckets', () => {
    expect(
      sanitizeAnalyticsProps({
        on_device: true,
        result: 'misaligned',
      }),
    ).toEqual({ on_device: true });

    expect(sanitizeAnalyticsProps({ result: 'error' })).toEqual({ result: 'error' });
  });

  it('keeps only small integer analytics counters', () => {
    expect(
      sanitizeAnalyticsProps({
        count: 2,
        days: 10_000,
        streak: -1,
        matched: true,
        result: 12_345_678_901,
        variant: 0.91,
        surface: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      count: 2,
      days: 10_000,
      streak: -1,
      matched: true,
    });
  });

  it('allows the privacy-safe scan activation event and metadata buckets', () => {
    expect(sanitizeAnalyticsEventName('product_scanned')).toBe('product_scanned');
    expect(
      sanitizeAnalyticsProps({
        source: 'scan',
        matched: false,
        result: 'ambiguous',
        barcode: '1234567890123',
        product_id: 'product-1',
      }),
    ).toEqual({
      source: 'scan',
      matched: false,
      result: 'ambiguous',
    });
  });

  it('drops unapproved or user-derived event names', () => {
    expect(sanitizeAnalyticsEventName('photo_captured')).toBe('photo_captured');
    expect(sanitizeAnalyticsEventName('routine_step_irritation')).toBeNull();
    expect(sanitizeAnalyticsEventName('Acne concern: cheeks')).toBeNull();
  });

  it('derives a stable pseudonymous user id without exposing the raw Supabase id', async () => {
    const raw = '00000000-0000-4000-8000-000000000001';
    const first = await pseudonymousUserId(raw);
    const second = await pseudonymousUserId(raw);

    expect(first).toBe(second);
    expect(first).toMatch(/^u_[a-f0-9]{32}$/);
    expect(first).not.toContain(raw);
  });

  it('keeps an explicit account-boundary reset for PostHog identity', () => {
    const source = readFileSync(TRACK_SOURCE, 'utf8');

    expect(source).toContain('sanitizeAnalyticsEventName(event)');
    expect(source).toContain('posthog?.capture(safeEvent, safeProps)');
    expect(source).toContain('captureAppLifecycleEvents: false');
    expect(source).toContain('enableSessionReplay: false');
    expect(source).toContain('export async function resetAnalyticsIdentity');
    expect(source).toContain('posthog?.reset()');
  });
});
