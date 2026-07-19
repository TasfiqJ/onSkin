import { track } from '@/lib/analytics/track';

import type { LabelOcrAttemptResult } from './coordinator';

export const LABEL_CAPTURE_ANALYTICS_SOURCE = 'label_capture' as const;

export const LABEL_RECOGNITION_ANALYTICS_RESULTS = [
  'recognized',
  'no_text',
  'timed_out',
  'failed',
  'cancelled',
] as const satisfies readonly LabelOcrAttemptResult['status'][];

export type LabelRecognitionAnalyticsResult = (typeof LABEL_RECOGNITION_ANALYTICS_RESULTS)[number];

export const LABEL_RECOGNITION_LATENCY_BUCKETS = [
  'lt_1s',
  '1s_to_lt_3s',
  '3s_to_lt_6s',
  '6s_to_lt_12s',
  'gte_12s',
  'unknown',
] as const;

export type LabelRecognitionLatencyBucket = (typeof LABEL_RECOGNITION_LATENCY_BUCKETS)[number];

const recognizedResults = new Set<string>(LABEL_RECOGNITION_ANALYTICS_RESULTS);

/**
 * Coarsen local timing before it crosses the analytics boundary. Invalid clock
 * readings fail into an explicit bucket instead of leaking an exact value.
 */
export function labelRecognitionLatencyBucket(elapsedMs: number): LabelRecognitionLatencyBucket {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 'unknown';
  if (elapsedMs < 1_000) return 'lt_1s';
  if (elapsedMs < 3_000) return '1s_to_lt_3s';
  if (elapsedMs < 6_000) return '3s_to_lt_6s';
  if (elapsedMs < 12_000) return '6s_to_lt_12s';
  return 'gte_12s';
}

function normalizeRecognitionResult(value: unknown): LabelRecognitionAnalyticsResult {
  return typeof value === 'string' && recognizedResults.has(value)
    ? (value as LabelRecognitionAnalyticsResult)
    : 'failed';
}

/**
 * The sole CAT-05 recognition analytics boundary. Never add recognized text,
 * a photo URI, confidence, ingredient content, failure detail, or exact timing.
 */
export function trackLabelRecognitionCompleted(
  input: Readonly<{
    result: LabelRecognitionAnalyticsResult;
    elapsedMs: number;
  }>,
): void {
  track('label_recognition_completed', {
    result: normalizeRecognitionResult(input.result),
    latency_bucket: labelRecognitionLatencyBucket(input.elapsedMs),
    on_device: true,
  });
}
