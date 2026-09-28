import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAccountActivityBlockedForDeletion } from '@/features/settings/accountDeletionBarrier';
import { ANALYTICS_RESTRICTED_EXACT_PROP_EVENTS } from '@/lib/analytics/eventRegistry';
import {
  closeAnalyticsPublication,
  getAnalyticsPublicationGeneration,
  openAnalyticsPublication,
  type AnalyticsPublicationTransport,
} from '@/lib/analytics/publicationGate';
import {
  resetAnalyticsIdentity,
  sanitizeAnalyticsEventName,
  sanitizeAnalyticsEventProps,
  sanitizeAnalyticsProps,
  track,
} from './track';

const mocks = vi.hoisted(() => ({
  purgeLegacyPostHogPersistence: vi.fn<() => Promise<void>>(),
}));

vi.mock('@/lib/analytics/postHogPersistenceCleanup', () => ({
  purgeLegacyPostHogPersistence: mocks.purgeLegacyPostHogPersistence,
}));

const TRACK_SOURCE = fileURLToPath(new URL('./track.ts', import.meta.url));

function openForOwner(ownerId: string, publish: AnalyticsPublicationTransport['publish']): boolean {
  const generation = getAnalyticsPublicationGeneration();
  return openAnalyticsPublication({
    ownerId,
    receipt: {
      ownerId,
      token: `verified-${ownerId}`,
      generation,
      verified: true,
    },
    transport: { publish },
  });
}

describe('analytics publication lifecycle', () => {
  beforeEach(() => {
    mocks.purgeLegacyPostHogPersistence.mockReset();
    mocks.purgeLegacyPostHogPersistence.mockResolvedValue(undefined);
    setAccountActivityBlockedForDeletion(false);
    closeAnalyticsPublication();
  });

  afterEach(() => {
    closeAnalyticsPublication();
    setAccountActivityBlockedForDeletion(true);
  });

  it('drops unknown or denied-state events without buffering or later replay', () => {
    const publish = vi.fn<AnalyticsPublicationTransport['publish']>();

    track('screen_viewed', { screen_name: 'today' });
    track('user-derived-event', { screen_name: 'today' });
    expect(publish).not.toHaveBeenCalled();

    expect(openForOwner('owner-a', publish)).toBe(true);
    expect(publish).not.toHaveBeenCalled();
    track('screen_viewed', { screen_name: 'today' });
    expect(publish).toHaveBeenCalledOnce();

    closeAnalyticsPublication();
    track('screen_viewed', { screen_name: 'progress' });
    expect(publish).toHaveBeenCalledOnce();
  });

  it('sanitizes before publishing to a currently open owner transport', () => {
    const publish = vi.fn<AnalyticsPublicationTransport['publish']>();
    expect(openForOwner('owner-a', publish)).toBe(true);

    track('catalog_search', {
      result: 'no_match',
      latency_bucket: '1s_to_lt_3s',
      source: 'shelf',
      product_name: 'Sensitive Product',
      ingredient_text: 'Sensitive ingredient list',
      email: 'person@example.com',
    });

    expect(publish).toHaveBeenCalledWith('catalog_search', {
      result: 'no_match',
      latency_bucket: '1s_to_lt_3s',
    });
  });

  it('drops a restricted event when its fixed privacy schema is invalid', () => {
    const publish = vi.fn<AnalyticsPublicationTransport['publish']>();
    expect(openForOwner('owner-a', publish)).toBe(true);

    for (const [event, props] of [
      ['catalog_search', { result: 'matched', latency_bucket: 'exact_1342ms' }],
      ['catalog_lookup_no_match', { lookup_type: 'barcode' }],
      ['catalog_correction_reported', { correction_type: 'unreviewed_type' }],
      ['catalog_lookup_retry_saved', { result: 'retry_later' }],
      ['barcode_decode_rejected', { reason: 'raw_data', barcode_type: 'ean13' }],
      ['barcode_decode_success', { barcode_type: 'qr' }],
      ['barcode_scanned', { source: 'scan', matched: true, result: 'no_match' }],
      ['scan_matched', { source: 'scan', result: 'no_match' }],
      ['scan_no_match', { source: 'scan', result: 'matched' }],
      ['product_scanned', { source: 'catalog', matched: true }],
      ['label_capture_photo_taken', { native_ocr_enabled: 'true' }],
      [
        'label_recognition_completed',
        { result: 'recognized', latency_bucket: 'lt_1s', on_device: false },
      ],
      [
        'ingredient_parse_completed',
        { source: 'manual', result: 'partial', unknown_count_bucket: 'exact_4' },
      ],
    ] as const) {
      track(event, props);
    }

    expect(publish).not.toHaveBeenCalled();
  });

  it('fences a stale owner generation across an account switch', () => {
    const first = vi.fn<AnalyticsPublicationTransport['publish']>();
    const second = vi.fn<AnalyticsPublicationTransport['publish']>();
    const staleGeneration = getAnalyticsPublicationGeneration();
    expect(openForOwner('owner-a', first)).toBe(true);

    closeAnalyticsPublication();
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-b',
        receipt: {
          ownerId: 'owner-b',
          token: 'verified-owner-b',
          generation: staleGeneration,
          verified: true,
        },
        transport: { publish: second },
      }),
    ).toBe(false);
    expect(openForOwner('owner-b', second)).toBe(true);

    track('screen_viewed', { screen_name: 'progress' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('withdrawal through the deletion barrier drops the transport and never reopens it', () => {
    const publish = vi.fn<AnalyticsPublicationTransport['publish']>();
    expect(openForOwner('owner-a', publish)).toBe(true);

    setAccountActivityBlockedForDeletion(true);
    track('screen_viewed', { screen_name: 'today' });
    setAccountActivityBlockedForDeletion(false);
    track('screen_viewed', { screen_name: 'progress' });

    expect(publish).not.toHaveBeenCalled();
  });

  it('reset closes synchronously before purge completes', async () => {
    let finishPurge!: () => void;
    mocks.purgeLegacyPostHogPersistence.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPurge = resolve;
        }),
    );
    const publish = vi.fn<AnalyticsPublicationTransport['publish']>();
    expect(openForOwner('owner-a', publish)).toBe(true);

    const reset = resetAnalyticsIdentity();
    track('screen_viewed', { screen_name: 'today' });
    expect(publish).not.toHaveBeenCalled();

    finishPurge();
    await reset;
    track('screen_viewed', { screen_name: 'progress' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('stays closed when reset persistence purge fails', async () => {
    mocks.purgeLegacyPostHogPersistence.mockRejectedValueOnce(new Error('purge failed'));
    const publish = vi.fn<AnalyticsPublicationTransport['publish']>();
    expect(openForOwner('owner-a', publish)).toBe(true);

    await expect(resetAnalyticsIdentity()).rejects.toThrow('purge failed');
    track('screen_viewed', { screen_name: 'today' });
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('analytics sanitizer', () => {
  it('keeps the restricted exact-schema event family explicit and immutable', () => {
    expect(ANALYTICS_RESTRICTED_EXACT_PROP_EVENTS).toEqual([
      'barcode_decode_rejected',
      'barcode_decode_success',
      'barcode_scanned',
      'catalog_barcode_lookup',
      'catalog_correction_reported',
      'catalog_lookup_no_match',
      'catalog_lookup_retry_saved',
      'catalog_search',
      'ingredient_parse_completed',
      'label_capture_photo_taken',
      'label_recognition_completed',
      'product_scanned',
      'scan_matched',
      'scan_no_match',
    ]);
    expect(Object.isFrozen(ANALYTICS_RESTRICTED_EXACT_PROP_EVENTS)).toBe(true);
  });

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
        campaign: 'shelf_conflict_card_v1',
        content: 'conflict_card',
        platform: 'ios',
        app_version: '0.1.0',
        build_number: '42',
        product_name: 'Retinol',
        pregnancy_status: 'pregnant',
        product_type: 'mineral_spf',
        trigger: 'gap',
        intent: 'medical',
        moment: new Date('2026-07-06T10:00:00.000Z'),
        email: 'person@example.com',
        nested: { unsafe: true },
        change_state: 'consistent',
      }),
    ).toEqual({
      creative_variant: 'story-v1',
      screen_name: 'reveal',
      share_id: 'abcDEF_123456',
      native_ocr_enabled: true,
      medium: 'organic_share',
      campaign: 'shelf_conflict_card_v1',
      content: 'conflict_card',
      platform: 'ios',
      app_version: '0.1.0',
      build_number: '42',
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
        campaign: 'retinol_hack',
        contact: 'person@example.com',
        content: 'skin_profile',
      }),
    ).toEqual({ source: 'share_card', medium: 'organic_share' });
  });

  it('drops string values that look like URLs, tokens, or local paths', () => {
    expect(
      sanitizeAnalyticsProps({
        source: 'https://example.com/s/abc?token=secret',
        medium: 'jwt_header.payload.signature',
        type: 'content://photos/1',
        reason: 'signed_url',
        context: '/var/mobile/Containers/Data/photo.jpg',
        feature: 'routine_builder',
      }),
    ).toEqual({ feature: 'routine_builder' });
  });

  it('keeps only compact bucket tokens for string props', () => {
    expect(
      sanitizeAnalyticsProps({
        source: ' routine_builder ',
        medium: 'organic share',
        type: 'routine.builder',
        reason: 'retry#1',
        feature: 'cycle-recovery',
        surface: 'in_context',
      }),
    ).toEqual({ source: 'routine_builder', feature: 'cycle-recovery', surface: 'in_context' });
  });

  it('drops photo quality result buckets while preserving generic result buckets', () => {
    for (const result of [
      'matched',
      'lighting_varies',
      'misaligned',
      'low',
      'unmeasured',
      'darker',
    ]) {
      expect(sanitizeAnalyticsProps({ on_device: true, result })).toEqual({ on_device: true });
    }

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

  it('allows the privacy-safe scan activation events and metadata buckets', () => {
    expect(sanitizeAnalyticsEventName('barcode_scanned')).toBe('barcode_scanned');
    expect(sanitizeAnalyticsEventName('scan_matched')).toBe('scan_matched');
    expect(sanitizeAnalyticsEventName('scan_no_match')).toBe('scan_no_match');
    expect(sanitizeAnalyticsEventName('catalog_lookup_retry_saved')).toBe(
      'catalog_lookup_retry_saved',
    );
    expect(
      sanitizeAnalyticsEventProps('barcode_scanned', {
        source: 'scan',
        matched: false,
        result: 'ambiguous',
        barcode: '1234567890123',
        product_id: 'product-1',
        count: 1,
      }),
    ).toEqual({
      source: 'scan',
      matched: false,
      result: 'ambiguous',
    });
  });

  it('enforces exact schemas for catalog, scan, and label funnel events', () => {
    expect(
      sanitizeAnalyticsEventProps('catalog_lookup_no_match', {
        lookup_type: 'search',
        term: 'privatequery',
        count: 1,
      }),
    ).toEqual({ lookup_type: 'search' });
    expect(
      sanitizeAnalyticsEventProps('catalog_correction_reported', {
        correction_type: 'ingredient_issue',
        content: 'privatecontent',
        count: 2,
      }),
    ).toEqual({ correction_type: 'ingredient_issue' });
    expect(
      sanitizeAnalyticsEventProps('catalog_lookup_retry_saved', {
        result: 'already_queued',
        barcode: '012345678905',
      }),
    ).toEqual({ result: 'already_queued' });
    expect(
      sanitizeAnalyticsEventProps('barcode_decode_rejected', {
        reason: 'checksum',
        barcode_type: 'ean13',
        term: 'privatequery',
      }),
    ).toEqual({ reason: 'checksum', barcode_type: 'ean13' });
    expect(
      sanitizeAnalyticsEventProps('barcode_decode_success', {
        barcode_type: 'unknown',
        count: 14,
      }),
    ).toEqual({ barcode_type: 'unknown' });
    expect(
      sanitizeAnalyticsEventProps('scan_matched', {
        source: 'scan',
        result: 'matched',
        matched: true,
        term: 'privatequery',
      }),
    ).toEqual({ source: 'scan', result: 'matched' });
    expect(
      sanitizeAnalyticsEventProps('scan_no_match', {
        source: 'scan',
        result: 'no_match',
        matched: false,
        term: 'privatequery',
      }),
    ).toEqual({ source: 'scan', result: 'no_match' });
    expect(
      sanitizeAnalyticsEventProps('product_scanned', {
        source: 'scan',
        matched: true,
        result: 'matched',
        count: 1,
      }),
    ).toEqual({ source: 'scan', matched: true });
    expect(
      sanitizeAnalyticsEventProps('label_capture_photo_taken', {
        native_ocr_enabled: false,
        local_uri: 'file:///private/label.jpg',
        count: 1,
      }),
    ).toEqual({ native_ocr_enabled: false });
  });

  it('rejects invalid or contradictory catalog, scan, and label enums', () => {
    for (const [event, props] of [
      ['catalog_lookup_no_match', { lookup_type: 'barcode' }],
      ['catalog_correction_reported', { correction_type: 'other' }],
      ['catalog_lookup_retry_saved', { result: 'pending' }],
      ['barcode_decode_rejected', { reason: 'format', barcode_type: 'ean13' }],
      ['barcode_decode_rejected', { reason: 'checksum', barcode_type: 'qr' }],
      ['barcode_decode_success', { barcode_type: 'qr' }],
      ['barcode_scanned', { source: 'scan', matched: true, result: 'no_match' }],
      ['barcode_scanned', { source: 'catalog', matched: true, result: 'matched' }],
      ['scan_matched', { source: 'scan', result: 'no_match' }],
      ['scan_no_match', { source: 'scan', result: 'matched' }],
      ['product_scanned', { source: 'search', matched: true }],
      ['label_capture_photo_taken', { native_ocr_enabled: 'yes' }],
    ] as const) {
      expect(sanitizeAnalyticsEventProps(event, props)).toBeUndefined();
    }
  });

  it('allows only content-free label-recognition buckets', () => {
    expect(sanitizeAnalyticsEventName('label_recognition_completed')).toBe(
      'label_recognition_completed',
    );
    expect(
      sanitizeAnalyticsEventProps('label_recognition_completed', {
        result: 'recognized',
        latency_bucket: '3s_to_lt_6s',
        on_device: true,
        source: 'label_capture',
        elapsed_ms: 3_421,
        confidence: 0.91,
        ingredient_text: 'Aqua, Glycerin',
        local_uri: 'file:///var/mobile/private-label.jpg',
      }),
    ).toEqual({
      result: 'recognized',
      latency_bucket: '3s_to_lt_6s',
      on_device: true,
    });

    expect(
      sanitizeAnalyticsEventProps('label_recognition_completed', {
        result: 'recognized',
        latency_bucket: '3s_to_lt_6s',
        on_device: true,
        source: 'ocr_label_capture',
      }),
    ).toEqual({
      result: 'recognized',
      latency_bucket: '3s_to_lt_6s',
      on_device: true,
    });

    for (const latency_bucket of [
      'lt_1s',
      '1s_to_lt_3s',
      '3s_to_lt_6s',
      '6s_to_lt_12s',
      'gte_12s',
      'unknown',
    ]) {
      expect(sanitizeAnalyticsProps({ latency_bucket })).toEqual({ latency_bucket });
    }

    expect(
      sanitizeAnalyticsEventProps('label_recognition_completed', {
        result: 'recognized',
        latency_bucket: 'exact_3421ms',
        on_device: true,
      }),
    ).toBeUndefined();
    expect(
      sanitizeAnalyticsEventProps('label_recognition_completed', {
        result: 'recognized',
        latency_bucket: 'lt_1s',
        on_device: false,
      }),
    ).toBeUndefined();
  });

  it('enforces fixed catalog latency buckets at the final publication sanitizer', () => {
    for (const event of ['catalog_barcode_lookup', 'catalog_search'] as const) {
      expect(
        sanitizeAnalyticsEventProps(event, {
          result: 'matched',
          latency_bucket: '3s_to_lt_6s',
          query: 'private search',
          barcode: '012345678905',
          elapsed_ms: 3_421,
        }),
      ).toEqual({
        result: 'matched',
        latency_bucket: '3s_to_lt_6s',
      });
      expect(
        sanitizeAnalyticsEventProps(event, {
          result: 'matched',
          latency_bucket: 'exact_3421ms',
        }),
      ).toBeUndefined();
      expect(
        sanitizeAnalyticsEventProps(event, {
          result: 'unexpected_result',
          latency_bucket: 'lt_1s',
        }),
      ).toBeUndefined();
    }
  });

  it('enforces content-free ingredient parse buckets at the final publication sanitizer', () => {
    expect(
      sanitizeAnalyticsEventProps('ingredient_parse_completed', {
        source: 'label_capture',
        result: 'partial',
        unknown_count_bucket: 'three_to_five',
        native_ocr_enabled: true,
        count: 4,
        ingredient_text: 'private label text',
      }),
    ).toEqual({
      source: 'label_capture',
      result: 'partial',
      unknown_count_bucket: 'three_to_five',
      native_ocr_enabled: true,
    });
    expect(
      sanitizeAnalyticsEventProps('ingredient_parse_completed', {
        source: 'label_capture',
        result: 'partial',
        unknown_count_bucket: 'exact_4',
        native_ocr_enabled: true,
      }),
    ).toBeUndefined();
    expect(
      sanitizeAnalyticsEventProps('ingredient_parse_completed', {
        source: 'unreviewed_source',
        result: 'partial',
        unknown_count_bucket: 'one_to_two',
      }),
    ).toBeUndefined();
    expect(
      sanitizeAnalyticsEventProps('ingredient_parse_completed', {
        source: 'manual',
        result: 'unexpected_result',
        unknown_count_bucket: 'none',
      }),
    ).toBeUndefined();
    expect(
      sanitizeAnalyticsEventProps('ingredient_parse_completed', {
        source: 'label_capture',
        result: 'parsed',
        unknown_count_bucket: 'none',
        native_ocr_enabled: 'yes',
      }),
    ).toBeUndefined();
    expect(sanitizeAnalyticsEventProps('ingredient_parse_completed', {})).toBeUndefined();
  });

  it('allows V1 activation events without sensitive payload details', () => {
    expect(sanitizeAnalyticsEventName('first_useful_insight')).toBe('first_useful_insight');
    expect(sanitizeAnalyticsEventName('product_add_started')).toBe('product_add_started');
    expect(sanitizeAnalyticsEventName('routine_created')).toBe('routine_created');
    expect(sanitizeAnalyticsEventName('routine_plan_viewed')).toBe('routine_plan_viewed');
    expect(sanitizeAnalyticsEventName('routine_edited')).toBe('routine_edited');
    expect(sanitizeAnalyticsEventName('cycle_night_completed')).toBe('cycle_night_completed');
    expect(sanitizeAnalyticsEventName('step_reordered')).toBe('step_reordered');
    expect(sanitizeAnalyticsEventName('ramp_step_up_offered')).toBe('ramp_step_up_offered');
    expect(sanitizeAnalyticsEventName('ramp_step_up_accepted')).toBe('ramp_step_up_accepted');
    expect(sanitizeAnalyticsEventName('routine_checkoff_completed')).toBe(
      'routine_checkoff_completed',
    );
    expect(sanitizeAnalyticsEventName('paywall_dismissed')).toBe('paywall_dismissed');
    expect(sanitizeAnalyticsEventName('subscription_cancel_intent')).toBe(
      'subscription_cancel_intent',
    );
    expect(sanitizeAnalyticsEventName('support_contact_opened')).toBe('support_contact_opened');
    expect(sanitizeAnalyticsEventName('support_contact_failed')).toBe('support_contact_failed');

    expect(
      sanitizeAnalyticsProps({
        source: 'routine_plan',
        action: 'reordered',
        count: 3,
        moment: 'pm',
        rule_id: '00000000-0000-4000-8000-000000000001',
        product_name: 'Retinol 0.3%',
        goal: 'barrier_repair',
      }),
    ).toEqual({ source: 'routine_plan', action: 'reordered', count: 3, moment: 'pm' });

    expect(
      sanitizeAnalyticsProps({
        source: 'settings',
        result: 'unavailable',
        email: 'support@example.com',
        message: 'my routine is broken',
      }),
    ).toEqual({ source: 'settings', result: 'unavailable' });

    expect(
      sanitizeAnalyticsProps({
        source: 'beta_feedback',
        result: 'opened',
        category: 'catalog_match',
        severity: 'p1',
        free_text: 'my exact issue',
      }),
    ).toEqual({
      source: 'beta_feedback',
      result: 'opened',
      category: 'catalog_match',
      severity: 'p1',
    });
  });

  it('rejects conflict-state and conflict-only sharing event names', () => {
    for (const event of [
      'conflict_detected',
      'conflict_detail_viewed',
      'conflict_overridden',
      'conflict_resolution_chosen',
      'landing_viewed',
      'share_card_export_failed',
      'share_card_export_started',
      'share_card_export_succeeded',
      'share_card_exported',
      'share_link_created',
      'share_link_opened',
      'share_sheet_opened',
    ]) {
      expect(sanitizeAnalyticsEventName(event)).toBeNull();
    }
  });

  it('drops unapproved or user-derived event names', () => {
    expect(sanitizeAnalyticsEventName('photo_captured')).toBe('photo_captured');
    expect(sanitizeAnalyticsEventName('photo_baseline_added')).toBe('photo_baseline_added');
    expect(sanitizeAnalyticsEventName('routine_step_irritation')).toBeNull();
    expect(sanitizeAnalyticsEventName('Acne concern: cheeks')).toBeNull();
  });

  it('keeps analytics vendor capture launch-gated and purges legacy persistence', () => {
    const source = readFileSync(TRACK_SOURCE, 'utf8');

    expect(source).toContain('sanitizeAnalyticsEventName(event)');
    expect(source).toContain('if (isAccountActivityBlockedForDeletion()) {');
    expect(source).toContain('export async function resetAnalyticsIdentity');
    expect(source).toContain('closeAnalyticsPublication();');
    expect(source).toContain('await purgeLegacyPostHogPersistence()');
    expect(source).not.toContain("import('posthog-react-native')");
    expect(source).not.toContain('.capture(');
    expect(source).not.toContain('.identify(');
    expect(source).not.toContain('.flush(');
    expect(source).not.toContain('export function identify');
    expect(source).not.toContain('pseudonymousUserId');
  });
});
