import type { OnboardingEvent } from '@onskin/types';
import type { PostHog } from 'posthog-react-native';

import type { AnalyticsAllowedEventName } from '@/lib/analytics/eventRegistry';
import {
  isAllowedAnalyticsEventName,
  isAllowedAnalyticsPropKey,
} from '@/lib/analytics/eventRegistry';
import {
  discardPostHogTelemetryForAccountDeletion,
  withPostHogDeletionFreezeTimeout,
} from '@/lib/analytics/posthogDeletionFreeze';
import {
  createDeletionAwarePostHogStorage,
  type DeletionAwarePostHogStorage,
} from '@/lib/analytics/posthogDurableStorage';
import {
  AccountGenerationLeaseError,
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { accountDeletionVendorWritesBlocked } from '@/lib/auth/accountDeletionVendorFreezeRuntime';
import { env } from '@/lib/env';
import {
  GROWTH_ATTRIBUTION_KEYS,
  sanitizeAttribution,
  type GrowthAttributionKey,
} from '@/lib/growth/attribution';
import { devWarn } from '@/lib/observability/safeLog';

interface PostHogHandle {
  disabledForLocalCleanup: boolean;
  persistedProperties: typeof import('posthog-react-native').PostHogPersistedProperty;
  posthog: PostHog;
  storage: DeletionAwarePostHogStorage;
}

const ACCOUNT_DELETION_ANALYTICS_FREEZE_WAIT_MS = 1_500;
const LOCAL_DELETION_CLEANUP_API_KEY = 'onskin-local-deletion-cleanup';

let posthogPromise: Promise<PostHogHandle | null> | null = null;
let accountDeletionFreezeTail: Promise<void> = Promise.resolve();
type AnalyticsProps = Parameters<PostHog['capture']>[1];

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

function canUsePostHog(): boolean {
  return env.posthogKey.length > 0 && env.posthogHost.length > 0;
}

function sanitizeAnalyticsNumber(value: number): number | undefined {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE_ANALYTICS_INTEGER)
    return undefined;
  return value;
}

async function getPostHogHandle(forAccountDeletion = false): Promise<PostHogHandle | null> {
  const configured = canUsePostHog();
  if (!configured && !forAccountDeletion) return null;
  let resumeAfterCompletedDeletion = false;

  if (posthogPromise) {
    const observedPromise = posthogPromise;
    const existing = await observedPromise;
    if (posthogPromise !== observedPromise) return posthogPromise;
    if (
      existing &&
      !forAccountDeletion &&
      !accountDeletionVendorWritesBlocked() &&
      (existing.disabledForLocalCleanup || existing.storage.isSealed())
    ) {
      // A successfully deleted owner leaves its client sealed. Once the durable
      // receipt is gone, a later owner gets a fresh client backed by the now-
      // clean persistence files instead of inheriting a permanently inert SDK.
      posthogPromise = null;
      resumeAfterCompletedDeletion = true;
    } else {
      return existing;
    }
  }

  posthogPromise = import('posthog-react-native')
    .then(({ default: PostHogClient, PostHogPersistedProperty }) => {
      const disabledForLocalCleanup = !configured;
      const storage = createDeletionAwarePostHogStorage();
      if (accountDeletionVendorWritesBlocked()) storage.beginDeletionFreeze();

      const posthog = new PostHogClient(
        configured ? env.posthogKey : LOCAL_DELETION_CLEANUP_API_KEY,
        {
          host: env.posthogHost,
          captureAppLifecycleEvents: false,
          customStorage: storage,
          disableRemoteFeatureFlags: true,
          disableSurveys: true,
          disabled: disabledForLocalCleanup,
          enableSessionReplay: false,
          persistence: 'file',
        },
      );

      if (resumeAfterCompletedDeletion) {
        // The persisted opt-out belongs to the deleted owner. Register these
        // callbacks before returning the new client so a later owner's first
        // capture is ordered after identity reset and opt-in. The deletion
        // barrier already verified both persisted queues are empty.
        posthog.reset();
        void posthog.optIn();
      }

      return {
        disabledForLocalCleanup,
        persistedProperties: PostHogPersistedProperty,
        posthog,
        storage,
      };
    })
    .catch((error: unknown) => {
      devWarn('[analytics] PostHog initialization failed', error);
      return null;
    });

  return posthogPromise;
}

async function getPostHog(): Promise<PostHog | null> {
  return (await getPostHogHandle())?.posthog ?? null;
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
  if (accountDeletionVendorWritesBlocked()) return;
  const safeEvent = sanitizeAnalyticsEventName(event);
  if (!safeEvent) return;

  const safeProps = sanitizeAnalyticsProps(props);

  void runAccountGenerationOperation(async (lease) => {
    const posthog = await awaitAccountGenerationLease(lease, getPostHog);
    lease.assertCurrent();
    if (accountDeletionVendorWritesBlocked()) return;
    posthog?.capture(safeEvent, safeProps);
  }).catch((error: unknown) => {
    devWarn('[analytics] capture failed', error);
  });
}

// Call at the anonymous-to-permanent conversion (account creation) per docs/01 section 7.
export async function identify(
  lease: AccountGenerationLease,
  userId: string,
  props?: Record<string, unknown>,
): Promise<void> {
  if (accountDeletionVendorWritesBlocked()) return;
  const safeProps = sanitizeAnalyticsProps(props);

  try {
    lease.assertCurrent();
    const [posthog, pseudonymousId] = await awaitAccountGenerationLease(lease, () =>
      Promise.all([getPostHog(), pseudonymousUserId(userId)]),
    );
    lease.assertCurrent();
    if (accountDeletionVendorWritesBlocked()) return;
    posthog?.identify(pseudonymousId, safeProps);
    lease.assertCurrent();
  } catch (error) {
    if (error instanceof AccountGenerationLeaseError) throw error;
    devWarn('[analytics] identify failed', error);
  }
}

async function resetPostHogIdentity(): Promise<void> {
  const posthog = await getPostHog();
  posthog?.reset();
}

export async function freezeAnalyticsIdentityForAccountDeletion(): Promise<void> {
  // Serializing the underlying operations (not their timeout races) prevents a
  // quick retry from overtaking a slow first drain and letting an older disk
  // write land after a newer clear.
  const operation = accountDeletionFreezeTail
    .catch(() => undefined)
    .then(async () => {
      const handle = await getPostHogHandle(true);
      if (!handle) throw new Error('ACCOUNT_DELETION_ANALYTICS_FREEZE_UNAVAILABLE');

      const { persistedProperties: properties } = handle;
      await discardPostHogTelemetryForAccountDeletion(
        handle.posthog,
        handle.storage,
        {
          all: Object.values(properties),
          anonymousId: properties.AnonymousId,
          distinctId: properties.DistinctId,
          logsQueue: properties.LogsQueue,
          optedOut: properties.OptedOut,
          queue: properties.Queue,
        },
        ACCOUNT_DELETION_ANALYTICS_FREEZE_WAIT_MS,
      );
    });
  accountDeletionFreezeTail = operation;

  await withPostHogDeletionFreezeTimeout(operation, ACCOUNT_DELETION_ANALYTICS_FREEZE_WAIT_MS);
}

export async function resetAnalyticsIdentity(): Promise<void> {
  await resetPostHogIdentity();
}

export async function flushAnalytics(): Promise<void> {
  if (accountDeletionVendorWritesBlocked()) return;
  const posthog = await getPostHog();
  if (accountDeletionVendorWritesBlocked()) return;
  await posthog?.flush();
}
