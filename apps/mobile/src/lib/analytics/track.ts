import type { PostHog } from 'posthog-react-native';

import {
  analyticsSchemaForEvent,
  type AnalyticsAllowedEventName,
  type AnalyticsEventWithoutProps,
  type AnalyticsEventWithProps,
  type AnalyticsEventProps,
  type ExactAnalyticsEventProps,
  isAllowedAnalyticsPayloadShape,
  isAllowedAnalyticsPropValue,
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

function safeOwnDataEntries(value: unknown): [string, unknown][] | null {
  if (!value || typeof value !== 'object') return null;

  try {
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) return null;

    const entries: [string, unknown][] = [];
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      entries.push([key, descriptor.value]);
    }
    return entries;
  } catch {
    return null;
  }
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

export function sanitizeAnalyticsProps(
  event: AnalyticsAllowedEventName,
  props?: unknown,
): AnalyticsProps {
  return sanitizeAnalyticsPayload(event, props).props;
}

type SanitizedAnalyticsPayload = {
  accepted: boolean;
  props: AnalyticsProps;
};

function sanitizeAnalyticsPayload(
  event: AnalyticsAllowedEventName,
  props?: unknown,
): SanitizedAnalyticsPayload {
  const schema = analyticsSchemaForEvent(event);
  if (Object.keys(schema).length === 0) {
    return props === undefined
      ? { accepted: true, props: undefined }
      : { accepted: false, props: undefined };
  }

  const entries = props === undefined ? [] : safeOwnDataEntries(props);
  if (!entries) return { accepted: false, props: undefined };

  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of entries) {
    if (!isAllowedAnalyticsPropKey(key)) return { accepted: false, props: undefined };
    const rule = schema[key];
    if (!rule) return { accepted: false, props: undefined };
    if (value === undefined) continue;
    if (!isAllowedAnalyticsPropValue(rule, value)) {
      return { accepted: false, props: undefined };
    }
    clean[key] = value as string | number | boolean | null;
  }

  if (!isAllowedAnalyticsPayloadShape(event, clean)) {
    return { accepted: false, props: undefined };
  }
  return {
    accepted: true,
    props: Object.keys(clean).length ? clean : undefined,
  };
}

export function sanitizeAnalyticsEventName(event: string): AnalyticsAllowedEventName | null {
  const normalized = event.trim();
  return isAllowedAnalyticsEventName(normalized) ? normalized : null;
}

export function prepareAnalyticsEvent(
  event: string,
  props?: unknown,
): Readonly<{ event: AnalyticsAllowedEventName; props: AnalyticsProps }> | null {
  const safeEvent = sanitizeAnalyticsEventName(event);
  if (!safeEvent) return null;
  const payload = sanitizeAnalyticsPayload(safeEvent, props);
  return payload.accepted ? { event: safeEvent, props: payload.props } : null;
}

export function track<Event extends AnalyticsEventWithoutProps>(event: Event): void;
export function track<
  Event extends AnalyticsEventWithProps,
  const Actual extends AnalyticsEventProps<NoInfer<Event>>,
>(event: Event, props: ExactAnalyticsEventProps<NoInfer<Event>, Actual>): void;
export function track(event: AnalyticsAllowedEventName, props?: unknown): void {
  if (accountDeletionVendorWritesBlocked()) return;
  const prepared = prepareAnalyticsEvent(event, props);
  if (!prepared) return;

  void runAccountGenerationOperation(async (lease) => {
    const posthog = await awaitAccountGenerationLease(lease, getPostHog);
    lease.assertCurrent();
    if (accountDeletionVendorWritesBlocked()) return;
    posthog?.capture(prepared.event, prepared.props);
  }).catch((error: unknown) => {
    devWarn('[analytics] capture failed', error);
  });
}

// Call at the anonymous-to-permanent conversion (account creation) per docs/01 section 7.
export async function identify(lease: AccountGenerationLease, userId: string): Promise<void> {
  if (accountDeletionVendorWritesBlocked()) return;

  try {
    lease.assertCurrent();
    const [posthog, pseudonymousId] = await awaitAccountGenerationLease(lease, () =>
      Promise.all([getPostHog(), pseudonymousUserId(userId)]),
    );
    lease.assertCurrent();
    if (accountDeletionVendorWritesBlocked()) return;
    posthog?.identify(pseudonymousId);
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
