import type { PostHogPersistedProperty } from 'posthog-react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT,
  discardPostHogTelemetryForAccountDeletion,
  type PostHogDeletionClient,
  type PostHogDeletionPropertySet,
  withPostHogDeletionFreezeTimeout,
} from './posthogDeletionFreeze';
import { DeletionAwarePostHogStorage, type PostHogStorageBackend } from './posthogDurableStorage';

const property = (value: string) => value as PostHogPersistedProperty;
const PROPERTIES = {
  anonymousId: property('anonymous_id'),
  distinctId: property('distinct_id'),
  logsQueue: property('logs_queue'),
  optedOut: property('opted_out'),
  queue: property('queue'),
  props: property('props'),
} as const;
const PROPERTY_SET: PostHogDeletionPropertySet = {
  all: Object.values(PROPERTIES),
  anonymousId: PROPERTIES.anonymousId,
  distinctId: PROPERTIES.distinctId,
  logsQueue: PROPERTIES.logsQueue,
  optedOut: PROPERTIES.optedOut,
  queue: PROPERTIES.queue,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class BehavioralPostHogClient implements PostHogDeletionClient {
  readonly sentEvents: string[] = [];
  readonly sentLogs: string[] = [];
  readonly state = new Map<PostHogPersistedProperty, unknown>();
  reloadFeatureFlagsImplementation: () => Promise<unknown> = async () => undefined;
  shutdownImplementation: () => Promise<void> = async () => {
    this.flushQueuedTelemetry();
  };

  constructor(private readonly storage: DeletionAwarePostHogStorage) {
    this.state.set(PROPERTIES.anonymousId, 'owner-a-anonymous');
    this.state.set(PROPERTIES.distinctId, 'owner-a-pseudonymous');
    this.state.set(PROPERTIES.queue, ['owner-a-event']);
    this.state.set(PROPERTIES.logsQueue, ['owner-a-log']);
    this.state.set(PROPERTIES.props, { owner: 'A' });
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    if (value === null) this.state.delete(key);
    else this.state.set(key, value);
    void this.storage.setItem(String(key), JSON.stringify(value));
  }

  reset(): void {
    for (const key of [...this.state.keys()]) {
      if (key !== PROPERTIES.queue && key !== PROPERTIES.logsQueue) this.state.delete(key);
    }
  }

  async optOut(): Promise<void> {
    this.setPersistedProperty(PROPERTIES.optedOut, true);
  }

  async flush(): Promise<void> {
    this.flushQueuedTelemetry();
  }

  async flushLogs(): Promise<void> {
    this.flushQueuedTelemetry();
  }

  async reloadFeatureFlagsAsync(): Promise<unknown> {
    return this.reloadFeatureFlagsImplementation();
  }

  async shutdown(): Promise<void> {
    await this.shutdownImplementation();
  }

  captureAfterFreeze(event: string): void {
    if (this.getPersistedProperty(PROPERTIES.optedOut) === true) return;
    const queue = this.getPersistedProperty<string[]>(PROPERTIES.queue) ?? [];
    this.setPersistedProperty(PROPERTIES.queue, [...queue, event]);
  }

  flushQueuedTelemetry(): void {
    this.sentEvents.push(...(this.getPersistedProperty<string[]>(PROPERTIES.queue) ?? []));
    this.sentLogs.push(...(this.getPersistedProperty<string[]>(PROPERTIES.logsQueue) ?? []));
    this.setPersistedProperty(PROPERTIES.queue, []);
    this.setPersistedProperty(PROPERTIES.logsQueue, []);
  }
}

function makeHarness() {
  const persisted = new Map<string, string>();
  const backend: PostHogStorageBackend = {
    getItem: (key) => persisted.get(key) ?? null,
    setItem: async (key, value) => {
      persisted.set(key, value);
    },
  };
  const storage = new DeletionAwarePostHogStorage(backend);
  const posthog = new BehavioralPostHogClient(storage);
  return { persisted, posthog, storage };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PostHog account-deletion telemetry barrier', () => {
  it('discards queued events and logs without sending them, then prevents recreation', async () => {
    const { persisted, posthog, storage } = makeHarness();

    await discardPostHogTelemetryForAccountDeletion(posthog, storage, PROPERTY_SET, 1_500);

    expect(posthog.sentEvents).toEqual([]);
    expect(posthog.sentLogs).toEqual([]);
    expect(posthog.getPersistedProperty(PROPERTIES.queue)).toEqual([]);
    expect(posthog.getPersistedProperty(PROPERTIES.logsQueue)).toEqual([]);
    expect(posthog.getPersistedProperty(PROPERTIES.distinctId)).toBeUndefined();
    expect(posthog.getPersistedProperty(PROPERTIES.anonymousId)).toBeUndefined();
    expect(posthog.getPersistedProperty(PROPERTIES.optedOut)).toBe(true);
    expect(storage.isSealed()).toBe(true);

    posthog.captureAfterFreeze('late-owner-a-event');
    posthog.flushQueuedTelemetry();
    storage.setItem('queue', 'late-owner-a-recreation');
    await storage.drain();

    expect(posthog.sentEvents).toEqual([]);
    expect(posthog.sentLogs).toEqual([]);
    expect([...persisted.values()]).not.toContain('late-owner-a-recreation');
  });

  it('clears owner queues restored by an SDK preload callback at initialization', async () => {
    const { posthog, storage } = makeHarness();
    posthog.reloadFeatureFlagsImplementation = async () => {
      posthog.state.set(PROPERTIES.anonymousId, 'preloaded-owner-a');
      posthog.state.set(PROPERTIES.distinctId, 'preloaded-owner-a');
      posthog.state.set(PROPERTIES.queue, ['preloaded-owner-a-event']);
      posthog.state.set(PROPERTIES.logsQueue, ['preloaded-owner-a-log']);
    };

    await discardPostHogTelemetryForAccountDeletion(posthog, storage, PROPERTY_SET, 1_500);

    expect(posthog.sentEvents).toEqual([]);
    expect(posthog.sentLogs).toEqual([]);
    expect(posthog.getPersistedProperty(PROPERTIES.distinctId)).toBeUndefined();
    expect(posthog.getPersistedProperty(PROPERTIES.anonymousId)).toBeUndefined();
    expect(posthog.getPersistedProperty(PROPERTIES.queue)).toEqual([]);
    expect(posthog.getPersistedProperty(PROPERTIES.logsQueue)).toEqual([]);
  });

  it('rejects a shutdown failure after sealing and draining the cleared queues', async () => {
    const { posthog, storage } = makeHarness();
    const failure = new Error('in-flight request failed');
    posthog.shutdownImplementation = vi.fn().mockRejectedValue(failure);

    await expect(
      discardPostHogTelemetryForAccountDeletion(posthog, storage, PROPERTY_SET, 1_500),
    ).rejects.toBe(failure);

    expect(storage.isSealed()).toBe(true);
    expect(posthog.getPersistedProperty(PROPERTIES.queue)).toEqual([]);
    expect(posthog.getPersistedProperty(PROPERTIES.logsQueue)).toEqual([]);
  });

  it('times out without declaring success while an in-flight SDK shutdown is unsettled', async () => {
    vi.useFakeTimers();
    const { posthog, storage } = makeHarness();
    const shutdown = deferred<void>();
    posthog.shutdownImplementation = () => shutdown.promise;

    const operation = discardPostHogTelemetryForAccountDeletion(
      posthog,
      storage,
      PROPERTY_SET,
      1_500,
    );
    const bounded = withPostHogDeletionFreezeTimeout(operation, 1_500);
    const timedOut = expect(bounded).rejects.toThrow(ACCOUNT_DELETION_ANALYTICS_FREEZE_TIMEOUT);
    await vi.advanceTimersByTimeAsync(1_501);

    await timedOut;
    expect(storage.isSealed()).toBe(false);
    expect(storage.getItem(String(PROPERTIES.queue))).toBeNull();

    shutdown.resolve();
    await expect(operation).resolves.toBeUndefined();
    expect(storage.isSealed()).toBe(true);
  });
});
