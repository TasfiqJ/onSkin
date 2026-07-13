import type { PostHogPersistedProperty } from 'posthog-react-native';

import type { DeletionAwarePostHogStorage } from './posthogDurableStorage';

export const ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT =
  'ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT';
export const ACCOUNT_DELETION_ANALYTICS_FREEZE_INVALID =
  'ACCOUNT_DELETION_ANALYTICS_FREEZE_INVALID';

export interface PostHogDeletionPropertySet {
  all: readonly PostHogPersistedProperty[];
  anonymousId: PostHogPersistedProperty;
  distinctId: PostHogPersistedProperty;
  logsQueue: PostHogPersistedProperty;
  optedOut: PostHogPersistedProperty;
  queue: PostHogPersistedProperty;
}

export interface PostHogDeletionClient {
  flush(): Promise<void>;
  flushLogs(): Promise<void>;
  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined;
  optOut(): Promise<void>;
  reloadFeatureFlagsAsync(): Promise<unknown>;
  reset(propertiesToKeep?: PostHogPersistedProperty[]): void;
  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void;
  shutdown(timeoutMs?: number): Promise<void>;
}

function queueIsEmpty(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function assertDeletionState(
  posthog: PostHogDeletionClient,
  properties: PostHogDeletionPropertySet,
): void {
  if (
    !queueIsEmpty(posthog.getPersistedProperty(properties.queue)) ||
    !queueIsEmpty(posthog.getPersistedProperty(properties.logsQueue)) ||
    posthog.getPersistedProperty(properties.distinctId) !== undefined ||
    posthog.getPersistedProperty(properties.anonymousId) !== undefined ||
    posthog.getPersistedProperty(properties.optedOut) !== true
  ) {
    throw new Error(ACCOUNT_DELETION_ANALYTICS_FREEZE_INVALID);
  }
}

/**
 * Freezes one PostHog client for account deletion using only supported SDK
 * APIs. The app's durable vendor gate must already be armed before this runs.
 */
export async function discardPostHogTelemetryForAccountDeletion(
  posthog: PostHogDeletionClient,
  storage: DeletionAwarePostHogStorage,
  properties: PostHogDeletionPropertySet,
  shutdownTimeoutMs: number,
): Promise<void> {
  // This is synchronous and comes first: pending async preloads now resolve as
  // absent, while every adapter entry point is already blocked by the durable
  // account-deletion receipt.
  storage.beginDeletionFreeze();

  // Clear every public persisted property immediately. In particular this
  // removes Queue and LogsQueue, which PostHog intentionally preserves in an
  // ordinary reset. Opt-out is written directly first so deferred captures
  // already registered with the SDK fail closed when initialization finishes.
  for (const property of properties.all) posthog.setPersistedProperty(property, null);
  posthog.setPersistedProperty(properties.optedOut, true);
  posthog.setPersistedProperty(properties.queue, null);
  posthog.setPersistedProperty(properties.logsQueue, null);

  // reset([]) remains ordered behind any SDK operations deferred on its init
  // promise, clears identity without preserving a device identifier, and keeps
  // the already-empty queues. optOut is registered immediately after it.
  posthog.reset([]);
  await posthog.optOut();

  // The client is constructed with remote feature flags disabled, making this
  // public async API a network-free initialization barrier. It closes the race
  // where a custom-storage promise resolved just before deletion, but the SDK's
  // memory-population callback had not run yet.
  await posthog.reloadFeatureFlagsAsync();

  // Initialization and every pre-freeze deferred adapter operation have now
  // settled. Clear once more so neither a late preload nor identify can restore
  // owner-A identity or queues after the reset/opt-out callbacks.
  for (const property of properties.all) posthog.setPersistedProperty(property, null);
  posthog.setPersistedProperty(properties.optedOut, true);
  posthog.setPersistedProperty(properties.queue, null);
  posthog.setPersistedProperty(properties.logsQueue, null);

  let pipelineFailure: unknown;
  try {
    // Unlike RN shutdown's deliberately best-effort logs budget, these public
    // flush calls join any already-running event/log request without declaring
    // a timeout successful. The queues are empty first, so they cannot start a
    // new owner-A send. The outer deletion deadline rejects if either hangs.
    await Promise.all([posthog.flush(), posthog.flushLogs()]);
  } catch (error) {
    pipelineFailure = error;
  }

  let shutdownFailure: unknown;
  try {
    // Public shutdown clears automatic timers, joins any request that was
    // already in flight, and drains both the event and logs storage pipelines.
    await posthog.shutdown(shutdownTimeoutMs);
  } catch (error) {
    shutdownFailure = error;
  } finally {
    // shutdown has now initiated its final storage writes. Seal before awaiting
    // them so a late SDK callback cannot persist telemetry afterward.
    storage.seal();
  }

  await storage.drain();
  if (pipelineFailure !== undefined) throw pipelineFailure;
  if (shutdownFailure !== undefined) throw shutdownFailure;
  assertDeletionState(posthog, properties);
}

export async function withPostHogDeletionFreezeTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
