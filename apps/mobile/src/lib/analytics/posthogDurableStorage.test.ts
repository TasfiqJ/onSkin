import { describe, expect, it, vi } from 'vitest';

import {
  DeletionAwarePostHogStorage,
  POSTHOG_EVENTS_STORAGE_KEY,
  POSTHOG_LOGS_STORAGE_KEY,
  POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT,
  POSTHOG_PERSISTED_QUEUE_MAX_AGE_MS,
  POSTHOG_PERSISTED_STORAGE_MAX_BYTES,
  sanitizePersistedPostHogStorage,
  type PostHogStorageBackend,
} from './posthogDurableStorage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const NOW = Date.parse('2026-07-21T12:00:00.000Z');
const DISTINCT_ID = '018f0000-0000-7000-8000-000000000001';

function eventRow(id: number, timestamp = new Date(NOW).toISOString()) {
  return {
    message: {
      distinct_id: DISTINCT_ID,
      event: 'onboarding_started',
      properties: {
        $geoip_disable: true,
        $lib: 'posthog-react-native',
        $lib_version: '4.54.4',
      },
      timestamp,
      uuid: rowUuid(id),
    },
  };
}

function rowUuid(id: number): string {
  return `018f0000-0000-7000-8000-${String(id + 1_000).padStart(12, '0')}`;
}

function eventsStorage(queue: unknown): string {
  return JSON.stringify({
    version: 'v1',
    content: { queue, distinct_id: 'pseudonymous-id' },
  });
}

describe('deletion-aware PostHog storage', () => {
  it('expires old/future/malformed events and retains only the newest bounded FIFO rows', () => {
    const fresh = Array.from({ length: 300 }, (_, index) => eventRow(index));
    const raw = eventsStorage([
      eventRow(-3, new Date(NOW - POSTHOG_PERSISTED_QUEUE_MAX_AGE_MS - 1).toISOString()),
      eventRow(-2, new Date(NOW + 60 * 60 * 1_000).toISOString()),
      { message: { event: 'missing-time' } },
      ...fresh,
    ]);

    const result = sanitizePersistedPostHogStorage(POSTHOG_EVENTS_STORAGE_KEY, raw, NOW);
    const parsed = JSON.parse(result.value) as {
      content: { queue: ReturnType<typeof eventRow>[]; distinct_id: string };
    };

    expect(result.changed).toBe(true);
    expect(parsed.content.distinct_id).toBe('pseudonymous-id');
    expect(parsed.content.queue).toHaveLength(POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT);
    expect(parsed.content.queue[0]?.message.uuid).toBe(rowUuid(44));
    expect(parsed.content.queue.at(-1)?.message.uuid).toBe(rowUuid(299));
  });

  it('drops fresh rows that bypass the exact event or property allowlist', () => {
    const unknownEvent = eventRow(1);
    unknownEvent.message.event = 'private_search_text';
    const forbiddenProperty = eventRow(2);
    Object.assign(forbiddenProperty.message.properties, { search_text: 'private ingredient query' });

    const result = sanitizePersistedPostHogStorage(
      POSTHOG_EVENTS_STORAGE_KEY,
      eventsStorage([unknownEvent, forbiddenProperty, eventRow(3)]),
      NOW,
    );
    const queue = JSON.parse(result.value).content.queue as ReturnType<typeof eventRow>[];

    expect(queue).toHaveLength(1);
    expect(queue[0]?.message.uuid).toBe(rowUuid(3));
  });

  it('rejects raw UUIDv4 identity and private text hidden in metadata fields', () => {
    const rawAccountId = eventRow(1);
    rawAccountId.message.distinct_id = '123e4567-e89b-42d3-a456-426614174000';
    const privateOsVersion = eventRow(2);
    Object.assign(privateOsVersion.message.properties, { $os_version: 'Jasim phone' });
    const privateBuild = eventRow(3);
    Object.assign(privateBuild.message.properties, { $app_build: 'private_product_name' });

    const result = sanitizePersistedPostHogStorage(
      POSTHOG_EVENTS_STORAGE_KEY,
      eventsStorage([rawAccountId, privateOsVersion, privateBuild, eventRow(4)]),
      NOW,
    );
    const queue = JSON.parse(result.value).content.queue as ReturnType<typeof eventRow>[];

    expect(queue).toHaveLength(1);
    expect(queue[0]?.message.uuid).toBe(rowUuid(4));
  });

  it('retains only the exact internal identify shape used by the runtime', () => {
    const identify = eventRow(1);
    identify.message.event = '$identify';
    Object.assign(identify.message.properties, { $anon_distinct_id: DISTINCT_ID });
    const unsafeIdentify = eventRow(2);
    unsafeIdentify.message.event = '$identify';
    Object.assign(unsafeIdentify.message.properties, { $set: { email: 'private@example.com' } });

    const result = sanitizePersistedPostHogStorage(
      POSTHOG_EVENTS_STORAGE_KEY,
      eventsStorage([identify, unsafeIdentify]),
      NOW,
    );
    const queue = JSON.parse(result.value).content.queue as ReturnType<typeof eventRow>[];

    expect(queue).toHaveLength(1);
    expect(queue[0]?.message.uuid).toBe(rowUuid(1));
  });

  it('retains the exact age and clock-skew boundaries', () => {
    const raw = eventsStorage([
      eventRow(1, new Date(NOW - POSTHOG_PERSISTED_QUEUE_MAX_AGE_MS).toISOString()),
      eventRow(2, new Date(NOW + 5 * 60 * 1_000).toISOString()),
    ]);

    expect(sanitizePersistedPostHogStorage(POSTHOG_EVENTS_STORAGE_KEY, raw, NOW)).toEqual({
      value: raw,
      changed: false,
    });
  });

  it('leaves an already valid bounded event envelope byte-for-byte unchanged', () => {
    const raw = eventsStorage([eventRow(1), eventRow(2)]);
    expect(sanitizePersistedPostHogStorage(POSTHOG_EVENTS_STORAGE_KEY, raw, NOW)).toEqual({
      value: raw,
      changed: false,
    });
  });

  it('clears prohibited legacy super-property, flag, survey, and replay caches', () => {
    const raw = JSON.stringify({
      version: 'v1',
      content: {
        queue: [eventRow(1)],
        distinct_id: 'retained-sdk-identity',
        feature_flags: { private_flag: 'private value' },
        props: { private_property: 'private value' },
        remote_config: { sessionRecording: { private: true } },
        session_replay: { private: true },
        surveys: [{ private: true }],
      },
    });

    const result = sanitizePersistedPostHogStorage(POSTHOG_EVENTS_STORAGE_KEY, raw, NOW);

    expect(JSON.parse(result.value)).toEqual({
      version: 'v1',
      content: { queue: [eventRow(1)], distinct_id: 'retained-sdk-identity' },
    });
  });

  it('fails malformed, future-version, and oversized storage closed to an empty queue', () => {
    for (const raw of [
      '{bad-json',
      JSON.stringify({ version: 'v2', content: { queue: [eventRow(1)] } }),
      'x'.repeat(POSTHOG_PERSISTED_STORAGE_MAX_BYTES + 1),
    ]) {
      const result = sanitizePersistedPostHogStorage(POSTHOG_EVENTS_STORAGE_KEY, raw, NOW);
      expect(result.changed).toBe(true);
      expect(JSON.parse(result.value)).toEqual({
        version: 'v1',
        content: { queue: [], opted_out: true },
      });
    }
  });

  it('prohibits the separate persisted PostHog logs queue', () => {
    const raw = JSON.stringify({
      version: 'v1',
      content: { logs_queue: [{ record: { timeUnixNano: '1', body: 'private log' } }] },
    });
    const result = sanitizePersistedPostHogStorage(POSTHOG_LOGS_STORAGE_KEY, raw, NOW);
    expect(JSON.parse(result.value)).toEqual({
      version: 'v1',
      content: { logs_queue: [] },
    });
  });

  it('durably sanitizes a preload before publishing it to the SDK', async () => {
    const values = new Map([
      [POSTHOG_EVENTS_STORAGE_KEY, eventsStorage([eventRow(1, '2020-01-01T00:00:00.000Z')])],
    ]);
    const backend: PostHogStorageBackend = {
      getItem: (key) => values.get(key) ?? null,
      setItem: vi.fn(async (key, value) => {
        values.set(key, value);
      }),
    };
    const storage = new DeletionAwarePostHogStorage(backend, () => NOW);

    const loaded = await storage.getItem(POSTHOG_EVENTS_STORAGE_KEY);

    expect(JSON.parse(loaded!)).toEqual({
      version: 'v1',
      content: { queue: [], distinct_id: 'pseudonymous-id' },
    });
    expect(values.get(POSTHOG_EVENTS_STORAGE_KEY)).toBe(loaded);
    expect(backend.setItem).toHaveBeenCalledOnce();
  });

  it('sanitizes every SDK persistence write before it reaches the backend', async () => {
    const persisted: string[] = [];
    const backend: PostHogStorageBackend = {
      getItem: () => null,
      setItem: vi.fn(async (_key, value) => {
        persisted.push(value);
      }),
    };
    const storage = new DeletionAwarePostHogStorage(backend, () => NOW);
    const fresh = Array.from({ length: 300 }, (_, index) => eventRow(index));

    await storage.setItem(
      POSTHOG_EVENTS_STORAGE_KEY,
      eventsStorage([eventRow(-1, '2020-01-01T00:00:00.000Z'), ...fresh]),
    );

    const queue = JSON.parse(persisted[0]!).content.queue as ReturnType<typeof eventRow>[];
    expect(queue).toHaveLength(POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT);
    expect(queue[0]?.message.uuid).toBe(rowUuid(44));
    expect(queue.at(-1)?.message.uuid).toBe(rowUuid(299));
  });

  it('removes cross-file queues and creates a missing expected queue', () => {
    const events = sanitizePersistedPostHogStorage(
      POSTHOG_EVENTS_STORAGE_KEY,
      JSON.stringify({ version: 'v1', content: { logs_queue: ['private log'] } }),
      NOW,
    );
    const logs = sanitizePersistedPostHogStorage(
      POSTHOG_LOGS_STORAGE_KEY,
      JSON.stringify({ version: 'v1', content: { queue: [eventRow(1)] } }),
      NOW,
    );

    expect(JSON.parse(events.value)).toEqual({ version: 'v1', content: { queue: [] } });
    expect(JSON.parse(logs.value)).toEqual({ version: 'v1', content: { logs_queue: [] } });
  });

  it('orders a concurrent SDK write after preload sanitation so old bytes cannot win', async () => {
    const preload = deferred<string | null>();
    const persisted: string[] = [];
    const backend: PostHogStorageBackend = {
      getItem: () => preload.promise,
      setItem: vi.fn(async (_key, value) => {
        persisted.push(value);
      }),
    };
    const storage = new DeletionAwarePostHogStorage(backend, () => NOW);
    const read = storage.getItem(POSTHOG_EVENTS_STORAGE_KEY);
    const freshWrite = eventsStorage([eventRow(2)]);
    const write = storage.setItem(POSTHOG_EVENTS_STORAGE_KEY, freshWrite);

    preload.resolve(eventsStorage([eventRow(1, '2020-01-01T00:00:00.000Z')]));
    await read;
    await write;

    expect(persisted.map((value) => (JSON.parse(value).content.queue as unknown[]).length)).toEqual([
      0,
      1,
    ]);
    expect(persisted.at(-1)).toBe(freshWrite);
  });

  it('does not alter unrelated custom-storage keys', () => {
    expect(sanitizePersistedPostHogStorage('unrelated', 'opaque', NOW)).toEqual({
      value: 'opaque',
      changed: false,
    });
  });

  it('turns an already-running owner preload into an absent read when deletion starts', async () => {
    const read = deferred<string | null>();
    const backend: PostHogStorageBackend = {
      getItem: vi.fn(() => read.promise),
      setItem: vi.fn(),
    };
    const storage = new DeletionAwarePostHogStorage(backend);

    const pendingRead = storage.getItem('.posthog-events');
    storage.beginDeletionFreeze();
    read.resolve('{"owner":"A","queue":["owner-a-event"]}');

    await expect(pendingRead).resolves.toBeNull();
  });

  it('serializes old and deletion writes, then drops every write after sealing', async () => {
    const firstWrite = deferred<void>();
    const values = new Map<string, string>();
    const starts: string[] = [];
    let writeCount = 0;
    const backend: PostHogStorageBackend = {
      getItem: (key) => values.get(key) ?? null,
      setItem: vi.fn(async (key, value) => {
        starts.push(`${key}:${value}`);
        writeCount += 1;
        if (writeCount === 1) await firstWrite.promise;
        values.set(key, value);
      }),
    };
    const storage = new DeletionAwarePostHogStorage(backend);

    void storage.setItem('events', 'owner-a-queued');
    storage.beginDeletionFreeze();
    void storage.setItem('events', 'events-cleared');
    void storage.setItem('logs', 'logs-cleared');
    storage.seal();
    storage.setItem('events', 'owner-a-recreated');

    expect(starts).toEqual([]);
    firstWrite.resolve();
    await storage.drain();

    expect(starts).toEqual(['events:owner-a-queued', 'events:events-cleared', 'logs:logs-cleared']);
    expect(values).toEqual(
      new Map([
        ['events', 'events-cleared'],
        ['logs', 'logs-cleared'],
      ]),
    );
  });

  it('surfaces a deletion-phase persistence rejection even when the SDK swallows it', async () => {
    const failure = new Error('disk write failed');
    const backend: PostHogStorageBackend = {
      getItem: () => null,
      setItem: vi.fn().mockRejectedValue(failure),
    };
    const storage = new DeletionAwarePostHogStorage(backend);

    storage.beginDeletionFreeze();
    void storage.setItem('events', 'cleared');
    storage.seal();

    await expect(storage.drain()).rejects.toBe(failure);
  });

  it('does not let a failed pre-freeze write poison a later successful discard', async () => {
    let persisted: string | null = null;
    const backend: PostHogStorageBackend = {
      getItem: () => persisted,
      setItem: vi
        .fn()
        .mockRejectedValueOnce(new Error('old queue write failed'))
        .mockImplementationOnce(async (_key, value) => {
          persisted = value;
        }),
    };
    const storage = new DeletionAwarePostHogStorage(backend);

    void storage.setItem('events', 'old-owner-a-state');
    storage.beginDeletionFreeze();
    void storage.setItem('events', 'cleared');
    storage.seal();

    await expect(storage.drain()).resolves.toBeUndefined();
    expect(backend.setItem).toHaveBeenCalledTimes(2);
  });

  it('rejects when the backend does not read back the final cleared payload', async () => {
    const backend: PostHogStorageBackend = {
      getItem: () => 'stale-owner-a-state',
      setItem: vi.fn().mockResolvedValue(undefined),
    };
    const storage = new DeletionAwarePostHogStorage(backend);

    storage.beginDeletionFreeze();
    void storage.setItem('events', 'cleared');
    storage.seal();

    await expect(storage.drain()).rejects.toThrow('ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED');
  });
});
