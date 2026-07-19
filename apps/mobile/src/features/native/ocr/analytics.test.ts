import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LABEL_CAPTURE_ANALYTICS_SOURCE,
  labelRecognitionLatencyBucket,
  trackLabelRecognitionCompleted,
} from './analytics';

const mocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

describe('label recognition analytics', () => {
  beforeEach(() => {
    mocks.track.mockReset();
  });

  it('uses a sanitizer-safe source token for ingredient parsing', () => {
    expect(LABEL_CAPTURE_ANALYTICS_SOURCE).toBe('label_capture');
    expect(LABEL_CAPTURE_ANALYTICS_SOURCE).not.toContain('ocr');
  });

  it.each([
    [0, 'lt_1s'],
    [999.99, 'lt_1s'],
    [1_000, '1s_to_lt_3s'],
    [2_999.99, '1s_to_lt_3s'],
    [3_000, '3s_to_lt_6s'],
    [5_999.99, '3s_to_lt_6s'],
    [6_000, '6s_to_lt_12s'],
    [11_999.99, '6s_to_lt_12s'],
    [12_000, 'gte_12s'],
    [Number.POSITIVE_INFINITY, 'unknown'],
    [Number.NaN, 'unknown'],
    [-1, 'unknown'],
  ])('coarsens %s milliseconds to %s', (elapsedMs, expected) => {
    expect(labelRecognitionLatencyBucket(elapsedMs)).toBe(expected);
  });

  it.each(['recognized', 'no_text', 'timed_out', 'failed', 'cancelled'] as const)(
    'emits only the allowlisted content-free contract for %s',
    (result) => {
      trackLabelRecognitionCompleted({ result, elapsedMs: 3_421.87 });

      expect(mocks.track).toHaveBeenCalledOnce();
      expect(mocks.track).toHaveBeenCalledWith('label_recognition_completed', {
        result,
        latency_bucket: '3s_to_lt_6s',
        on_device: true,
      });
    },
  );

  it('fails an unexpected runtime result into the generic failed bucket', () => {
    trackLabelRecognitionCompleted({
      result: 'recognized_label_contains_ingredient_content',
      elapsedMs: 250,
    } as never);

    expect(mocks.track).toHaveBeenCalledWith('label_recognition_completed', {
      result: 'failed',
      latency_bucket: 'lt_1s',
      on_device: true,
    });
  });
});
