import type { OnboardingEvent } from '@onskin/types';

import { isAccountActivityBlockedForDeletion } from '@/features/settings/accountDeletionBarrier';
import type { AnalyticsAllowedEventName } from '@/lib/analytics/eventRegistry';
import {
  isAllowedAnalyticsEventName,
  isAllowedAnalyticsPropKey,
} from '@/lib/analytics/eventRegistry';
import {
  GROWTH_ATTRIBUTION_KEYS,
  sanitizeAttribution,
  type GrowthAttributionKey,
} from '@/lib/growth/attribution';
import { purgeLegacyPostHogPersistence } from '@/lib/analytics/postHogPersistenceCleanup';

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
const MAX_SAFE_ANALYTICS_INTEGER = 10_000;
const SAFE_ANALYTICS_STRING_VALUE = /^[A-Za-z0-9_-]{1,80}$/;

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function pseudonymousUserId(userId: string): Promise<string> {
  const input = `onskin:user:${userId}`;
  let digest: string;
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    digest = bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  } else {
    const Crypto = await import('expo-crypto');
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  }
  return `u_${digest.slice(0, 32)}`;
}

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

export function track(event: OnboardingEvent | string, props?: Record<string, unknown>): void {
  if (isAccountActivityBlockedForDeletion()) return;
  const safeEvent = sanitizeAnalyticsEventName(event);
  if (!safeEvent) return;

  // Direct mobile vendor capture is intentionally disabled until the approved
  // analytics configuration and consent state have loaded. Keep sanitization at
  // every call site so a future barrier-aware server transport cannot bypass it.
  void sanitizeAnalyticsProps(props);
}

// Call at the anonymous-to-permanent conversion (account creation) per docs/01 section 7.
export function identify(userId: string, props?: Record<string, unknown>): void {
  if (isAccountActivityBlockedForDeletion()) return;
  void userId;
  void sanitizeAnalyticsProps(props);
}

export async function resetAnalyticsIdentity(): Promise<void> {
  await purgeLegacyPostHogPersistence();
}

export async function flushAnalytics(): Promise<void> {
  // There is no direct mobile vendor queue while analytics is launch-gated.
}
