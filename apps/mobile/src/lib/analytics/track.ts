import type { OnboardingEvent } from '@onskin/types';
import type { PostHog } from 'posthog-react-native';

import type { AnalyticsAllowedEventName } from '@/lib/analytics/eventRegistry';
import { isAllowedAnalyticsEventName, isAllowedAnalyticsPropKey } from '@/lib/analytics/eventRegistry';
import { env } from '@/lib/env';
import { devWarn } from '@/lib/observability/safeLog';

let posthogPromise: Promise<PostHog | null> | null = null;
type AnalyticsProps = Parameters<PostHog['capture']>[1];

export const SENSITIVE_ANALYTICS_KEY =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
export const SENSITIVE_ANALYTICS_VALUE =
  /(@|https?:\/\/|file:\/\/|content:\/\/|\/data\/|\/var\/mobile\/|\/cache\/|\?.*=|token|jwt|secret|signed_url|barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|(?:^|[_\W])spf(?:$|[_\W])|peptide|dspt|fitzpatrick|monk|axis|step|score|slug|acne|rosacea|eczema|psoriasis|dermatitis|melasma|hyperpigmentation|irritation|procedure|medical|concern|conflict|product_fit|replenish|routine_q|conflict_q)/i;
const APPROVED_BUCKET_KEYS = new Set(['barcode_type', 'native_ocr_enabled', 'screen_name', 'share_id']);
const PHOTO_QUALITY_RESULT_VALUES = new Set(['matched', 'misaligned', 'darker', 'low']);
const MAX_SAFE_ANALYTICS_INTEGER = 10_000;

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

function canUsePostHog(): boolean {
  return env.posthogKey.length > 0 && env.posthogHost.length > 0;
}

function sanitizeAnalyticsNumber(value: number): number | undefined {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE_ANALYTICS_INTEGER) return undefined;
  return value;
}

async function getPostHog(): Promise<PostHog | null> {
  if (!canUsePostHog()) return null;

  posthogPromise ??= import('posthog-react-native')
    .then(({ default: PostHogClient }) => {
      return new PostHogClient(env.posthogKey, {
        host: env.posthogHost,
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        persistence: 'file',
      });
    })
    .catch((error: unknown) => {
      devWarn('[analytics] PostHog initialization failed', error);
      return null;
    });

  return posthogPromise;
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
      if (!trimmed || trimmed.includes('@') || SENSITIVE_ANALYTICS_VALUE.test(trimmed)) continue;
      if (key === 'result' && PHOTO_QUALITY_RESULT_VALUES.has(trimmed)) continue;
      clean[key] = trimmed.slice(0, 160);
    }
  }
  return clean;
}

export function sanitizeAnalyticsEventName(event: OnboardingEvent | string): AnalyticsAllowedEventName | null {
  const normalized = event.trim();
  return isAllowedAnalyticsEventName(normalized) ? normalized : null;
}

export function track(event: OnboardingEvent | string, props?: Record<string, unknown>): void {
  const safeEvent = sanitizeAnalyticsEventName(event);
  if (!safeEvent) return;

  const safeProps = sanitizeAnalyticsProps(props);

  void getPostHog()
    .then((posthog) => {
      posthog?.capture(safeEvent, safeProps);
    })
    .catch((error: unknown) => {
      devWarn('[analytics] capture failed', error);
    });
}

// Call at the anonymous-to-permanent conversion (account creation) per docs/01 section 7.
export function identify(userId: string, props?: Record<string, unknown>): void {
  const safeProps = sanitizeAnalyticsProps(props);

  void Promise.all([getPostHog(), pseudonymousUserId(userId)])
    .then(([posthog, pseudonymousId]) => {
      posthog?.identify(pseudonymousId, safeProps);
    })
    .catch((error: unknown) => {
      devWarn('[analytics] identify failed', error);
    });
}

export async function resetAnalyticsIdentity(): Promise<void> {
  const posthog = await getPostHog();
  await posthog?.reset();
}

export async function flushAnalytics(): Promise<void> {
  const posthog = await getPostHog();
  await posthog?.flush();
}
