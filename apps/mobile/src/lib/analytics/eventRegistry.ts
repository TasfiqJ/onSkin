export const ANALYTICS_ALLOWED_PROP_KEYS = [
  'action',
  'added_via',
  'answerKind',
  'barcode_type',
  'context',
  'consented',
  'correction_type',
  'count',
  'creative_variant',
  'days',
  'feature',
  'flagged',
  'grounded',
  'is_opened',
  'kind',
  'lookup_type',
  'milestone',
  'mode',
  'moment',
  'native_ocr_enabled',
  'on_device',
  'period_type',
  'reason',
  'reaction',
  'refused',
  'result',
  'screen_name',
  'share_id',
  'signal_source',
  'source',
  'streak',
  'surface',
  'type',
  'variant',
] as const;

export type AnalyticsAllowedPropKey = (typeof ANALYTICS_ALLOWED_PROP_KEYS)[number];

const allowed = new Set<string>(ANALYTICS_ALLOWED_PROP_KEYS);

export function isAllowedAnalyticsPropKey(key: string): key is AnalyticsAllowedPropKey {
  return allowed.has(key);
}
