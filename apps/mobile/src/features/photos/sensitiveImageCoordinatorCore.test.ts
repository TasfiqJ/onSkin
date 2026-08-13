import { describe, expect, it, vi } from 'vitest';

import {
  isSensitiveImageRequestCancelled,
  SensitiveImageDecryptCoordinator,
} from './sensitiveImageCoordinatorCore';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('SensitiveImageDecryptCoordinator', () => {
  it('serializes a 100-request burst under the photo-v1 concurrency budget', async () => {
    const pending = new Map<string, Deferred<string>>();
    let active = 0;
    let peak = 0;
    const load = vi.fn((uri: string) => {
      active += 1;
      peak = Math.max(peak, active);
      const completion = deferred<string>();
      pending.set(uri, completion);
      return completion.promise.finally(() => {
        active -= 1;
      });
    });
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 7,
    });
    const requests = Array.from({ length: 100 }, (_, index) =>
      coordinator.request(`photo-${index}:thumbnail:v1`, `encrypted://${index}`, 'visible'),
    );

    expect(load).toHaveBeenCalledTimes(1);
    expect(coordinator.snapshot()).toEqual({
      active: 1,
      queued: 99,
      running: 1,
      subscribers: 100,
    });

    for (let index = 0; index < requests.length; index += 1) {
      pending.get(`encrypted://${index}`)!.resolve(`data:${index}`);
      await expect(requests[index]!.promise).resolves.toBe(`data:${index}`);
    }

    expect(load).toHaveBeenCalledTimes(100);
    expect(peak).toBe(1);
    expect(coordinator.snapshot()).toEqual({ active: 0, queued: 0, running: 0, subscribers: 0 });
  });

  it('deduplicates one owner/rendition request and lets consumers cancel independently', async () => {
    const completion = deferred<string>();
    const load = vi.fn(() => completion.promise);
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 4,
    });
    const first = coordinator.request('photo-a:display:v1', 'encrypted://a', 'interactive');
    const second = coordinator.request('photo-a:display:v1', 'encrypted://a', 'visible');
    const cancelled = second.promise.catch((error: unknown) => error);

    second.cancel();
    completion.resolve('data:a');

    await expect(first.promise).resolves.toBe('data:a');
    expect(isSensitiveImageRequestCancelled(await cancelled)).toBe(true);
    expect(load).toHaveBeenCalledOnce();
  });

  it('runs interactive and visible requests before queued adjacent work', async () => {
    const pending = new Map<string, Deferred<string>>();
    const starts: string[] = [];
    const coordinator = new SensitiveImageDecryptCoordinator(
      (uri) => {
        starts.push(uri);
        const completion = deferred<string>();
        pending.set(uri, completion);
        return completion.promise;
      },
      { maxConcurrent: 1, getOwnerGeneration: () => 1 },
    );
    const blocker = coordinator.request('blocker', 'encrypted://blocker', 'interactive');
    const adjacent = coordinator.request('adjacent', 'encrypted://adjacent', 'adjacent');
    const visible = coordinator.request('visible', 'encrypted://visible', 'visible');
    const interactive = coordinator.request(
      'interactive',
      'encrypted://interactive',
      'interactive',
    );

    pending.get('encrypted://blocker')!.resolve('blocker');
    await expect(blocker.promise).resolves.toBe('blocker');
    expect(starts).toEqual(['encrypted://blocker', 'encrypted://interactive']);

    pending.get('encrypted://interactive')!.resolve('interactive');
    await expect(interactive.promise).resolves.toBe('interactive');
    expect(starts.at(-1)).toBe('encrypted://visible');

    pending.get('encrypted://visible')!.resolve('visible');
    await expect(visible.promise).resolves.toBe('visible');
    expect(starts.at(-1)).toBe('encrypted://adjacent');

    pending.get('encrypted://adjacent')!.resolve('adjacent');
    await expect(adjacent.promise).resolves.toBe('adjacent');
  });

  it('drops an off-screen queued request before native work starts', async () => {
    const completion = deferred<string>();
    const load = vi.fn(() => completion.promise);
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 2,
    });
    const blocker = coordinator.request('blocker', 'encrypted://blocker');
    const offscreen = coordinator.request('offscreen', 'encrypted://offscreen', 'visible');
    const cancelled = offscreen.promise.catch((error: unknown) => error);

    offscreen.cancel();
    expect(isSensitiveImageRequestCancelled(await cancelled)).toBe(true);
    completion.resolve('blocker');
    await expect(blocker.promise).resolves.toBe('blocker');
    expect(load).toHaveBeenCalledOnce();
  });

  it('purges demand immediately and suppresses a late native completion', async () => {
    const firstCompletion = deferred<string>();
    const secondCompletion = deferred<string>();
    const load = vi
      .fn<(uri: string) => Promise<string>>()
      .mockImplementationOnce(() => firstCompletion.promise)
      .mockImplementationOnce(() => secondCompletion.promise);
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 3,
    });
    const first = coordinator.request('same-photo', 'encrypted://same');
    const firstOutcome = first.promise.catch((error: unknown) => error);

    coordinator.purge();
    const second = coordinator.request('same-photo', 'encrypted://same');
    expect(isSensitiveImageRequestCancelled(await firstOutcome)).toBe(true);
    expect(load).toHaveBeenCalledOnce();
    expect(coordinator.snapshot()).toEqual({
      active: 1,
      queued: 1,
      running: 0,
      subscribers: 1,
    });

    firstCompletion.resolve('stale');
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    secondCompletion.resolve('fresh');
    await expect(second.promise).resolves.toBe('fresh');
  });

  it('never publishes a result across an owner-generation boundary', async () => {
    let ownerGeneration = 10;
    const completion = deferred<string>();
    const coordinator = new SensitiveImageDecryptCoordinator(() => completion.promise, {
      maxConcurrent: 1,
      getOwnerGeneration: () => ownerGeneration,
    });
    const request = coordinator.request('photo-a:display:v1', 'encrypted://a');
    const outcome = request.promise.catch((error: unknown) => error);

    ownerGeneration += 1;
    completion.resolve('owner-a-plaintext');

    expect(isSensitiveImageRequestCancelled(await outcome)).toBe(true);
    expect(coordinator.snapshot()).toEqual({ active: 0, queued: 0, running: 0, subscribers: 0 });
  });

  it('rejects identity reuse with different encrypted authority', () => {
    const coordinator = new SensitiveImageDecryptCoordinator(() => new Promise(() => {}), {
      maxConcurrent: 1,
      getOwnerGeneration: () => 5,
    });
    coordinator.request('photo-a:display:v1', 'encrypted://a');

    expect(() => coordinator.request('photo-a:display:v1', 'encrypted://b')).toThrow(
      'SENSITIVE_IMAGE_IDENTITY_CONFLICT',
    );
  });

  it('queues a replacement authority after the old native read loses its last consumer', async () => {
    const firstCompletion = deferred<string>();
    const secondCompletion = deferred<string>();
    const load = vi
      .fn<(uri: string) => Promise<string>>()
      .mockImplementationOnce(() => firstCompletion.promise)
      .mockImplementationOnce(() => secondCompletion.promise);
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 5,
    });
    const first = coordinator.request('photo-a:display:v1', 'encrypted://old');
    const firstOutcome = first.promise.catch((error: unknown) => error);

    first.cancel();
    const replacement = coordinator.request('photo-a:display:v1', 'encrypted://new');
    expect(isSensitiveImageRequestCancelled(await firstOutcome)).toBe(true);
    expect(coordinator.snapshot()).toEqual({
      active: 1,
      queued: 1,
      running: 0,
      subscribers: 1,
    });

    firstCompletion.resolve('stale');
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    secondCompletion.resolve('fresh');
    await expect(replacement.promise).resolves.toBe('fresh');
  });

  it('rejects a stale render generation before queueing native work', () => {
    const load = vi.fn(async () => 'data');
    const coordinator = new SensitiveImageDecryptCoordinator(load, {
      maxConcurrent: 1,
      getOwnerGeneration: () => 12,
    });

    expect(() => coordinator.request('photo-a', 'encrypted://a', 'visible', 11)).toThrow(
      'SENSITIVE_IMAGE_OWNER_GENERATION_CHANGED',
    );
    expect(load).not.toHaveBeenCalled();
    expect(coordinator.snapshot()).toEqual({ active: 0, queued: 0, running: 0, subscribers: 0 });
  });
});
