import type {
  PostHog,
  PostHogCustomStorage,
  PostHogOptions,
  PostHogPersistedProperty,
} from 'posthog-react-native';

import {
  POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT,
  sanitizePostHogAppProperties,
  sanitizePostHogEventQueue,
} from '@/lib/analytics/posthogDurableStorage';
import { env } from '@/lib/env';

export const POSTHOG_RUNTIME_POLICY = Object.freeze({
  fetchRetryCount: 1,
  fetchRetryDelayMs: 1_000,
  flushAt: 20,
  flushIntervalMs: 30_000,
  maxBatchSize: 50,
  maxQueueSize: POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT,
  requestTimeoutMs: 8_000,
});

export function createPostHogRuntimeOptions(
  storage: PostHogCustomStorage,
  disabled: boolean,
): PostHogOptions {
  return {
    host: env.posthogHost,
    captureAppLifecycleEvents: false,
    customAppProperties: (properties) => sanitizePostHogAppProperties(properties),
    customStorage: storage,
    disableRemoteFeatureFlags: true,
    disableSurveys: true,
    disabled,
    disableGeoip: true,
    errorTracking: {
      autocapture: false,
      exceptionSteps: { enabled: false, maxBytes: 0 },
    },
    enableSessionReplay: false,
    fetchRetryCount: POSTHOG_RUNTIME_POLICY.fetchRetryCount,
    fetchRetryDelay: POSTHOG_RUNTIME_POLICY.fetchRetryDelayMs,
    flushAt: POSTHOG_RUNTIME_POLICY.flushAt,
    flushInterval: POSTHOG_RUNTIME_POLICY.flushIntervalMs,
    logs: {
      beforeSend: () => null,
      maxBufferSize: 1,
      rateCap: { maxLogs: 0, windowMs: POSTHOG_RUNTIME_POLICY.flushIntervalMs },
    },
    maxBatchSize: POSTHOG_RUNTIME_POLICY.maxBatchSize,
    maxQueueSize: POSTHOG_RUNTIME_POLICY.maxQueueSize,
    persistence: 'file',
    preloadFeatureFlags: false,
    requestTimeout: POSTHOG_RUNTIME_POLICY.requestTimeoutMs,
    sendFeatureFlagEvent: false,
    setDefaultPersonProperties: false,
  };
}

export function installPostHogQueueRetention(
  posthog: PostHog,
  queueKey: PostHogPersistedProperty,
  now: () => number = Date.now,
): void {
  const sdkFlush = posthog.flush.bind(posthog);
  posthog.flush = async () => {
    const sanitized = sanitizePostHogEventQueue(posthog.getPersistedProperty(queueKey), now());
    if (sanitized.changed) posthog.setPersistedProperty(queueKey, sanitized.queue);
    await sdkFlush();
  };
}
