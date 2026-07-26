import type { OnboardingEvent } from '@onskin/types';

import { isAccountActivityBlockedForDeletion } from '@/features/settings/accountDeletionBarrier';
import {
  ANALYTICS_BARCODE_TYPES,
  ANALYTICS_CATALOG_CORRECTION_TYPES,
  ANALYTICS_CATALOG_LOOKUP_RESULTS,
  ANALYTICS_CATALOG_RETRY_RESULTS,
  ANALYTICS_INGREDIENT_PARSE_RESULTS,
  ANALYTICS_INGREDIENT_PARSE_SOURCES,
  ANALYTICS_LABEL_RECOGNITION_RESULTS,
  ANALYTICS_LATENCY_BUCKETS,
  ANALYTICS_RESTRICTED_EXACT_PROP_EVENTS,
  ANALYTICS_SCAN_RESULTS,
  ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS,
  isAllowedAnalyticsEventName,
  isAllowedAnalyticsPropKey,
  type AnalyticsAllowedEventName,
} from '@/lib/analytics/eventRegistry';
import {
  GROWTH_ATTRIBUTION_KEYS,
  sanitizeAttribution,
  type GrowthAttributionKey,
} from '@/lib/growth/attribution';
import { purgeLegacyPostHogPersistence } from '@/lib/analytics/postHogPersistenceCleanup';
import {
  closeAnalyticsPublication,
  publishAnalyticsEvent,
} from '@/lib/analytics/publicationGate';

type AnalyticsProps = Record<string, string | number | boolean | null> | undefined;

export const SENSITIVE_ANALYTICS_KEY =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
export const SENSITIVE_ANALYTICS_VALUE =
  /(@|https?:\/\/|file:\/\/|content:\/\/|\/data\/|\/var\/mobile\/|\/cache\/|\?.*=|token|jwt|secret|signed_url|barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|(?:^|[_\W])spf(?:$|[_\W])|peptide|dspt|fitzpatrick|monk|axis|step|score|slug|acne|rosacea|eczema|psoriasis|dermatitis|melasma|hyperpigmentation|irritation|procedure|medical|concern|conflict|product_fit|replenish|routine_q|conflict_q)/i;
const APPROVED_BUCKET_KEYS = new Set([
  'barcode_type',
  'native_ocr_enabled',
  'screen_name',
  'share_id',
]);
const GROWTH_BUCKET_KEYS = new Set<string>(GROWTH_ATTRIBUTION_KEYS);
const PHOTO_QUALITY_RESULT_VALUES = new Set([
  'matched',
  'lighting_varies',
  'misaligned',
  'low',
  'unmeasured',
  'darker',
]);
const LABEL_RECOGNITION_RESULT_VALUES = new Set<string>(
  ANALYTICS_LABEL_RECOGNITION_RESULTS,
);
const LATENCY_BUCKET_VALUES = new Set<string>(ANALYTICS_LATENCY_BUCKETS);
const CATALOG_LOOKUP_RESULT_VALUES = new Set<string>(ANALYTICS_CATALOG_LOOKUP_RESULTS);
const CATALOG_CORRECTION_TYPE_VALUES = new Set<string>(
  ANALYTICS_CATALOG_CORRECTION_TYPES,
);
const CATALOG_RETRY_RESULT_VALUES = new Set<string>(ANALYTICS_CATALOG_RETRY_RESULTS);
const SCAN_RESULT_VALUES = new Set<string>(ANALYTICS_SCAN_RESULTS);
const BARCODE_TYPE_VALUES = new Set<string>(ANALYTICS_BARCODE_TYPES);
const INGREDIENT_PARSE_RESULT_VALUES = new Set<string>(ANALYTICS_INGREDIENT_PARSE_RESULTS);
const INGREDIENT_PARSE_SOURCE_VALUES = new Set<string>(ANALYTICS_INGREDIENT_PARSE_SOURCES);
const UNKNOWN_INGREDIENT_COUNT_VALUES = new Set<string>(
  ANALYTICS_UNKNOWN_INGREDIENT_COUNT_BUCKETS,
);
const EVENTS_REQUIRING_EXACT_PROPS = new Set<AnalyticsAllowedEventName>(
  ANALYTICS_RESTRICTED_EXACT_PROP_EVENTS,
);
const MAX_SAFE_ANALYTICS_INTEGER = 10_000;
const SAFE_ANALYTICS_STRING_VALUE = /^[A-Za-z0-9_-]{1,80}$/;

function sanitizeAnalyticsNumber(value: number): number | undefined {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE_ANALYTICS_INTEGER)
    return undefined;
  return value;
}

export function sanitizeAnalyticsProps(props?: Record<string, unknown>): AnalyticsProps {
  if (!props) return undefined;

  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!isAllowedAnalyticsPropKey(key)) continue;
    if (!APPROVED_BUCKET_KEYS.has(key) && SENSITIVE_ANALYTICS_KEY.test(key)) continue;
    if (value === undefined) continue;
    if (value === null || typeof value === 'boolean') {
      clean[key] = value;
    } else if (typeof value === 'number') {
      const safeNumber = sanitizeAnalyticsNumber(value);
      if (safeNumber !== undefined) clean[key] = safeNumber;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed.includes('@')) continue;
      if (GROWTH_BUCKET_KEYS.has(key)) {
        const growthValue = sanitizeAttribution({ [key]: trimmed })[key as GrowthAttributionKey];
        if (!growthValue) continue;
        clean[key] = growthValue;
        continue;
      }
      if (SENSITIVE_ANALYTICS_VALUE.test(trimmed)) continue;
      if (!SAFE_ANALYTICS_STRING_VALUE.test(trimmed)) continue;
      if (key === 'result' && PHOTO_QUALITY_RESULT_VALUES.has(trimmed)) continue;
      clean[key] = trimmed;
    }
  }
  return clean;
}

export function sanitizeAnalyticsEventName(
  event: OnboardingEvent | string,
): AnalyticsAllowedEventName | null {
  const normalized = event.trim();
  return isAllowedAnalyticsEventName(normalized) ? normalized : null;
}

/** Apply the narrowest event-specific schema after the global privacy filter. */
export function sanitizeAnalyticsEventProps(
  event: AnalyticsAllowedEventName,
  props?: Record<string, unknown>,
): AnalyticsProps {
  const clean = sanitizeAnalyticsProps(props);
  if (event === 'label_recognition_completed') {
    if (
      clean === undefined ||
      typeof clean.result !== 'string' ||
      !LABEL_RECOGNITION_RESULT_VALUES.has(clean.result) ||
      typeof clean.latency_bucket !== 'string' ||
      !LATENCY_BUCKET_VALUES.has(clean.latency_bucket) ||
      clean.on_device !== true
    ) {
      return undefined;
    }
    return {
      result: clean.result,
      latency_bucket: clean.latency_bucket,
      on_device: true,
    };
  }
  if (event === 'catalog_barcode_lookup' || event === 'catalog_search') {
    const result = props?.result;
    const latencyBucket = props?.latency_bucket;
    if (
      typeof result !== 'string' ||
      !CATALOG_LOOKUP_RESULT_VALUES.has(result) ||
      typeof latencyBucket !== 'string' ||
      !LATENCY_BUCKET_VALUES.has(latencyBucket)
    ) {
      return undefined;
    }
    return {
      result,
      latency_bucket: latencyBucket,
    };
  }
  if (event === 'catalog_lookup_no_match') {
    return props?.lookup_type === 'search' ? { lookup_type: 'search' } : undefined;
  }
  if (event === 'catalog_correction_reported') {
    const correctionType = props?.correction_type;
    return typeof correctionType === 'string' &&
      CATALOG_CORRECTION_TYPE_VALUES.has(correctionType)
      ? { correction_type: correctionType }
      : undefined;
  }
  if (event === 'catalog_lookup_retry_saved') {
    const result = props?.result;
    return typeof result === 'string' && CATALOG_RETRY_RESULT_VALUES.has(result)
      ? { result }
      : undefined;
  }
  if (event === 'barcode_decode_rejected') {
    const barcodeType = props?.barcode_type;
    return props?.reason === 'checksum' &&
      typeof barcodeType === 'string' &&
      BARCODE_TYPE_VALUES.has(barcodeType)
      ? { reason: 'checksum', barcode_type: barcodeType }
      : undefined;
  }
  if (event === 'barcode_decode_success') {
    const barcodeType = props?.barcode_type;
    return typeof barcodeType === 'string' && BARCODE_TYPE_VALUES.has(barcodeType)
      ? { barcode_type: barcodeType }
      : undefined;
  }
  if (event === 'barcode_scanned') {
    const result = props?.result;
    const matched = props?.matched;
    if (
      props?.source !== 'scan' ||
      typeof result !== 'string' ||
      !SCAN_RESULT_VALUES.has(result) ||
      typeof matched !== 'boolean' ||
      matched !== (result === 'matched')
    ) {
      return undefined;
    }
    return { source: 'scan', matched, result };
  }
  if (event === 'scan_matched') {
    return props?.source === 'scan' && props.result === 'matched'
      ? { source: 'scan', result: 'matched' }
      : undefined;
  }
  if (event === 'scan_no_match') {
    return props?.source === 'scan' && props.result === 'no_match'
      ? { source: 'scan', result: 'no_match' }
      : undefined;
  }
  if (event === 'product_scanned') {
    return props?.source === 'scan' && typeof props.matched === 'boolean'
      ? { source: 'scan', matched: props.matched }
      : undefined;
  }
  if (event === 'label_capture_photo_taken') {
    return typeof props?.native_ocr_enabled === 'boolean'
      ? { native_ocr_enabled: props.native_ocr_enabled }
      : undefined;
  }
  if (event === 'ingredient_parse_completed') {
    if (
      clean === undefined ||
      typeof clean.source !== 'string' ||
      !INGREDIENT_PARSE_SOURCE_VALUES.has(clean.source) ||
      typeof clean.result !== 'string' ||
      !INGREDIENT_PARSE_RESULT_VALUES.has(clean.result) ||
      typeof clean.unknown_count_bucket !== 'string' ||
      !UNKNOWN_INGREDIENT_COUNT_VALUES.has(clean.unknown_count_bucket) ||
      (clean.native_ocr_enabled !== undefined &&
        typeof clean.native_ocr_enabled !== 'boolean')
    ) {
      return undefined;
    }
    return {
      source: clean.source,
      result: clean.result,
      unknown_count_bucket: clean.unknown_count_bucket,
      ...(clean.native_ocr_enabled === undefined
        ? {}
        : { native_ocr_enabled: clean.native_ocr_enabled }),
    };
  }
  return clean;
}

export function track(event: OnboardingEvent | string, props?: Record<string, unknown>): void {
  const safeEvent = sanitizeAnalyticsEventName(event);
  if (!safeEvent) return;
  const safeProps = sanitizeAnalyticsEventProps(safeEvent, props);
  if (EVENTS_REQUIRING_EXACT_PROPS.has(safeEvent) && safeProps === undefined) return;

  if (isAccountActivityBlockedForDeletion()) {
    closeAnalyticsPublication();
    return;
  }
  publishAnalyticsEvent(safeEvent, safeProps);
}

export async function resetAnalyticsIdentity(): Promise<void> {
  closeAnalyticsPublication();
  await purgeLegacyPostHogPersistence();
}
