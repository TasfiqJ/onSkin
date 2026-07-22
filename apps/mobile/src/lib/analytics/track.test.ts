import { describe, expect, it, vi } from 'vitest';

import { ANALYTICS_ALLOWED_EVENTS, ANALYTICS_EVENT_SCHEMAS } from '@/lib/analytics/eventRegistry';
import {
  AccountGenerationLeaseError,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

import {
  identify,
  prepareAnalyticsEvent,
  pseudonymousUserId,
  sanitizeAnalyticsEventName,
  sanitizeAnalyticsProps,
  track,
} from './track';

vi.mock('@/lib/auth/accountDeletionVendorFreezeRuntime', () => ({
  accountDeletionVendorWritesBlocked: () => false,
}));

function compileTimeAnalyticsContract(): void {
  track('catalog_search', { result: 'matched' });

  // @ts-expect-error catalog_search does not own the globally valid source key.
  track('catalog_search', { source: 'scan' });
  // @ts-expect-error catalog_search accepts only its fixed result buckets.
  track('catalog_search', { result: 'cerave' });
  // @ts-expect-error no-property events cannot acquire payloads silently.
  track('onboarding_started', {});
  // @ts-expect-error events with a schema require an explicit payload object.
  track('catalog_search');
  // @ts-expect-error required event dimensions cannot be omitted.
  track('barcode_scanned', {});
  // @ts-expect-error a matched scan cannot report a no-match result.
  track('barcode_scanned', { source: 'scan', matched: true, result: 'no_match' });
  // @ts-expect-error only refused turns can set refused to true.
  track('ask_turn', { kind: 'deterministic', grounded: false, refused: true });
  // @ts-expect-error grounded turns are not emitted by the shipped reservation boundary.
  track('ask_turn', { kind: 'grounded', grounded: false, refused: false });
  // @ts-expect-error example plans return before routine-created analytics.
  track('routine_created', { source: 'example' });
  // @ts-expect-error paired support dimensions cannot be partially supplied.
  track('support_contact_opened', {
    source: 'beta_feedback',
    result: 'opened',
    category: 'catalog_match',
  });
  // @ts-expect-error beta feedback requires its category and severity dimensions.
  track('support_contact_opened', { source: 'beta_feedback', result: 'opened' });
  const settingsSupportWithBetaDimensions = {
    source: 'settings',
    result: 'opened',
    category: 'catalog_match',
    severity: 'p2',
  } as const;
  // @ts-expect-error settings support events cannot acquire beta feedback dimensions.
  track('support_contact_opened', settingsSupportWithBetaDimensions);
  // @ts-expect-error routine action and source values are a discriminated pair.
  track('routine_edited', { action: 'reordered', source: 'cycle_settings', mode: 'am' });
  // @ts-expect-error reordered routines require an affected mode.
  track('routine_edited', { action: 'reordered', source: 'routine_reorder' });
  // @ts-expect-error manual parsing cannot report the native OCR flag.
  track('ingredient_parse_completed', {
    source: 'manual',
    result: 'parsed',
    count: 1,
    native_ocr_enabled: true,
  });
  // @ts-expect-error OCR parsing requires the native OCR flag.
  track('ingredient_parse_completed', {
    source: 'ocr_label_capture',
    result: 'parsed',
    count: 1,
  });
  // @ts-expect-error products intake screen views require their count.
  track('screen_viewed', { screen_name: 'products_intake' });
  // @ts-expect-error share-unavailable failures require the affected share ID.
  track('share_card_export_failed', {
    creative_variant: 'story-v1',
    reason: 'share_unavailable',
  });
  // @ts-expect-error exception failures cannot acquire a share ID.
  track('share_card_export_failed', {
    creative_variant: 'story-v1',
    reason: 'exception',
    share_id: 'abcDEF_123456',
  });
  const nonFreshCrossEventPayload = { result: 'matched', source: 'scan' } as const;
  // @ts-expect-error non-fresh objects still cannot carry a property owned by another event.
  track('catalog_search', nonFreshCrossEventPayload);
  // @ts-expect-error unsupported event names cannot reach the tracker.
  track('routine_step_irritation');
}
void compileTimeAnalyticsContract;

describe('analytics event schema', () => {
  it('has exactly one runtime schema for every allowed event', () => {
    expect(Object.keys(ANALYTICS_EVENT_SCHEMAS).sort()).toEqual(
      [...ANALYTICS_ALLOWED_EVENTS].sort(),
    );
  });

  it('accepts only the exact keys and values for an event', () => {
    expect(
      sanitizeAnalyticsProps('barcode_scanned', {
        source: 'scan',
        matched: false,
        result: 'ambiguous',
      }),
    ).toEqual({ source: 'scan', matched: false, result: 'ambiguous' });

    expect(
      sanitizeAnalyticsProps('landing_viewed', {
        source: 'share_card',
        medium: 'organic_share',
        campaign: 'shelf_conflict_card_v1',
        content: 'conflict_card',
        creative_variant: 'story-v1',
        platform: 'ios',
        app_version: '1.2.3',
        build_number: '42',
        share_id: 'abcDEF_123456',
      }),
    ).toEqual({
      source: 'share_card',
      medium: 'organic_share',
      campaign: 'shelf_conflict_card_v1',
      content: 'conflict_card',
      creative_variant: 'story-v1',
      platform: 'ios',
      app_version: '1.2.3',
      build_number: '42',
      share_id: 'abcDEF_123456',
    });
  });

  it('fails the entire property payload closed on cross-event or unknown keys', () => {
    expect(sanitizeAnalyticsProps('catalog_search', { source: 'scan' })).toBeUndefined();
    expect(
      sanitizeAnalyticsProps('barcode_scanned', {
        source: 'scan',
        matched: true,
        result: 'matched',
        product_id: 'product-1',
      }),
    ).toBeUndefined();
    expect(sanitizeAnalyticsProps('onboarding_started', { source: 'scan' })).toBeUndefined();
    expect(prepareAnalyticsEvent('catalog_search', { source: 'scan' })).toBeNull();
    expect(prepareAnalyticsEvent('barcode_scanned', {})).toBeNull();
    expect(prepareAnalyticsEvent('onboarding_started', {})).toBeNull();
    expect(prepareAnalyticsEvent('onboarding_started')).toEqual({
      event: 'onboarding_started',
      props: undefined,
    });
  });

  it('rejects payload shapes whose dimensions contradict their discriminants', () => {
    expect(
      prepareAnalyticsEvent('barcode_scanned', {
        source: 'scan',
        matched: true,
        result: 'no_match',
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('ask_turn', {
        kind: 'deterministic',
        grounded: false,
        refused: true,
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('ask_turn', {
        kind: 'grounded',
        grounded: false,
        refused: false,
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('support_contact_opened', {
        source: 'beta_feedback',
        result: 'opened',
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('support_contact_opened', {
        source: 'settings',
        result: 'opened',
        category: 'catalog_match',
        severity: 'p2',
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('routine_edited', {
        action: 'reordered',
        source: 'cycle_settings',
        mode: 'am',
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('ingredient_parse_completed', {
        source: 'ocr_label_capture',
        result: 'parsed',
        count: 1,
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('ingredient_parse_completed', {
        source: 'manual',
        result: 'failed',
        count: 1,
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('ingredient_parse_completed', {
        source: 'manual',
        result: 'parsed',
        count: 0,
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('ingredient_parse_completed', {
        source: 'ocr_label_capture',
        native_ocr_enabled: true,
        result: 'partial',
        count: 0,
      }),
    ).toBeNull();
    expect(prepareAnalyticsEvent('screen_viewed', { screen_name: 'products_intake' })).toBeNull();
    expect(
      prepareAnalyticsEvent('share_card_export_failed', {
        creative_variant: 'story-v1',
        reason: 'share_unavailable',
      }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('share_card_export_failed', {
        creative_variant: 'story-v1',
        reason: 'exception',
        share_id: 'abcDEF_123456',
      }),
    ).toBeNull();
  });

  it('rejects raw-looking and out-of-domain values even under allowed keys', () => {
    for (const value of [
      'cerave',
      'https://example.com/?token=secret',
      'file:///var/mobile/photo.jpg',
      'C:\\Users\\person\\photo.jpg',
      '\\\\server\\share',
      'person@example.com',
      'eczema',
      'breastfeeding',
      'my routine is broken',
    ]) {
      expect(sanitizeAnalyticsProps('catalog_search', { result: value })).toBeUndefined();
    }

    expect(
      sanitizeAnalyticsProps('landing_viewed', {
        share_id: 'abcDEF_123456',
        term: 'cerave',
      }),
    ).toBeUndefined();
  });

  it('rejects nested values, precise numbers, and oversized counters', () => {
    expect(
      sanitizeAnalyticsProps('catalog_search', { result: { bucket: 'matched' } }),
    ).toBeUndefined();
    expect(sanitizeAnalyticsProps('conflict_detected', { count: 0.91 })).toBeUndefined();
    expect(sanitizeAnalyticsProps('conflict_detected', { count: -1 })).toBeUndefined();
    expect(prepareAnalyticsEvent('conflict_detected', { count: 0 })).toBeNull();
    expect(
      prepareAnalyticsEvent('first_useful_insight', { count: 0, source: 'reveal' }),
    ).toBeNull();
    expect(prepareAnalyticsEvent('recommendation_shown', { count: 0 })).toBeNull();
    expect(
      prepareAnalyticsEvent('quiz_question_answered', { count: 0, type: 'single' }),
    ).toBeNull();
    expect(
      prepareAnalyticsEvent('streak_milestone_reached', { milestone: 'd7', streak: 0 }),
    ).toBeNull();
    expect(prepareAnalyticsEvent('routine_created', { source: 'example' })).toBeNull();
    expect(sanitizeAnalyticsProps('conflict_detected', { count: 10_001 })).toBeUndefined();
    expect(
      sanitizeAnalyticsProps('conflict_detected', { count: Number.POSITIVE_INFINITY }),
    ).toBeUndefined();
  });

  it('does not invoke accessors and fails hostile property containers closed', () => {
    const getter = Object.defineProperty({}, 'result', {
      enumerable: true,
      get: () => {
        throw new Error('raw getter value');
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('raw proxy value');
        },
      },
    );

    expect(() => sanitizeAnalyticsProps('catalog_search', getter)).not.toThrow();
    expect(sanitizeAnalyticsProps('catalog_search', getter)).toBeUndefined();
    expect(() => sanitizeAnalyticsProps('catalog_search', proxy)).not.toThrow();
    expect(sanitizeAnalyticsProps('catalog_search', proxy)).toBeUndefined();
  });

  it('drops undefined optional values without widening the event schema', () => {
    expect(
      sanitizeAnalyticsProps('streak_milestone_reached', {
        milestone: 'd7',
        streak: undefined,
      }),
    ).toEqual({ milestone: 'd7' });
    expect(
      sanitizeAnalyticsProps('winback_converted', {
        period_type: null,
        source: 'revenuecat',
      }),
    ).toEqual({ period_type: null, source: 'revenuecat' });
  });

  it('allows only registered event names', () => {
    expect(sanitizeAnalyticsEventName('photo_captured')).toBe('photo_captured');
    expect(sanitizeAnalyticsEventName('photo_baseline_added')).toBe('photo_baseline_added');
    expect(sanitizeAnalyticsEventName(' routine_created ')).toBe('routine_created');
    expect(sanitizeAnalyticsEventName('routine_step_irritation')).toBeNull();
    expect(sanitizeAnalyticsEventName('Acne concern: cheeks')).toBeNull();
  });
});

describe('analytics identity', () => {
  it('derives a stable pseudonymous user id without exposing the raw Supabase id', async () => {
    const raw = '00000000-0000-4000-8000-000000000001';
    const first = await pseudonymousUserId(raw);
    const second = await pseudonymousUserId(raw);

    expect(first).toBe(second);
    expect(first).toMatch(/^u_[a-f0-9]{32}$/);
    expect(first).not.toContain(raw);
  });

  it('refuses to identify after the initiating owner lease becomes stale', async () => {
    const controller = new AbortController();
    let assertionCount = 0;
    const lease: AccountGenerationLease = {
      generation: 1,
      signal: controller.signal,
      assertCurrent: () => {
        assertionCount += 1;
        if (assertionCount > 1) throw new AccountGenerationLeaseError();
      },
      beginBoundaryHandoff: () => () => undefined,
    };

    await expect(identify(lease, '00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({
      code: 'ACCOUNT_GENERATION_CHANGED',
    });
  });
});
