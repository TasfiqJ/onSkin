import type { OnboardingEvent } from '@onskin/types';
import type { PostHog } from 'posthog-react-native';

import { isAllowedAnalyticsPropKey } from '@/lib/analytics/eventRegistry';
import { env } from '@/lib/env';

let posthogPromise: Promise<PostHog | null> | null = null;
type AnalyticsProps = Parameters<PostHog['capture']>[1];

export const SENSITIVE_ANALYTICS_KEY =
  /(barcode(?!_type)|ingredient|ocr|raw_text|note|localuri|local_uri|file|path|photo|image|receipt|product_id|product_name|rule_id|content_id|conflict_text|pregnan|condition|diagnos|skin|goal|profile|free_text|message|body|email|phone|address|name|user_id|app_user_id|(^|_)age($|_)|birth|zip|postal|retinoid|retinol|aha|bha|benzoyl|hydroquinone|niacinamide|vitamin_c|sunscreen|peptide|dspt|fitzpatrick|monk|axis|step|score|slug)/i;
const APPROVED_BUCKET_KEYS = new Set(['barcode_type', 'native_ocr_enabled', 'screen_name', 'share_id']);

function canUsePostHog(): boolean {
  return env.posthogKey.length > 0 && env.posthogHost.length > 0;
}

async function getPostHog(): Promise<PostHog | null> {
  if (!canUsePostHog()) return null;

  posthogPromise ??= import('posthog-react-native')
    .then(({ default: PostHogClient }) => {
      return new PostHogClient(env.posthogKey, {
        host: env.posthogHost,
        captureAppLifecycleEvents: true,
        enableSessionReplay: false,
        persistence: 'file',
      });
    })
    .catch((error: unknown) => {
      if (__DEV__) console.warn('[analytics] PostHog initialization failed', error);
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
    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed.includes('@') || SENSITIVE_ANALYTICS_KEY.test(trimmed)) continue;
      clean[key] = trimmed.slice(0, 160);
    } else if (value instanceof Date) {
      clean[key] = value.toISOString();
    }
  }
  return clean;
}

export function track(event: OnboardingEvent | string, props?: Record<string, unknown>): void {
  const safeProps = sanitizeAnalyticsProps(props);
  if (__DEV__) console.log('[analytics]', event, safeProps ?? {});

  void getPostHog()
    .then((posthog) => {
      posthog?.capture(event, safeProps);
    })
    .catch((error: unknown) => {
      if (__DEV__) console.warn('[analytics] capture failed', error);
    });
}

// Call at the anonymous-to-permanent conversion (account creation) per docs/01 section 7.
export function identify(userId: string, props?: Record<string, unknown>): void {
  const safeProps = sanitizeAnalyticsProps(props);
  if (__DEV__) console.log('[analytics] identify', userId, safeProps ?? {});

  void getPostHog()
    .then((posthog) => {
      posthog?.identify(userId, safeProps);
    })
    .catch((error: unknown) => {
      if (__DEV__) console.warn('[analytics] identify failed', error);
    });
}

export async function flushAnalytics(): Promise<void> {
  const posthog = await getPostHog();
  await posthog?.flush();
}
