import { describe, expect, it, vi } from 'vitest';

import { DeletionAwarePostHogStorage, type PostHogStorageBackend } from './posthogDurableStorage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('deletion-aware PostHog storage', () => {
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
