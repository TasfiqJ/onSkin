import { describe, expect, it, vi } from 'vitest';

import { createRevenueCatOperationBarrier } from './revenuecatOperationBarrier';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('RevenueCat deletion operation barrier', () => {
  it('registers before native completion and drains only after the operation settles', async () => {
    let blocked = false;
    const barrier = createRevenueCatOperationBarrier(() => blocked);
    const native = deferred<string>();
    const start = vi.fn(() => native.promise);

    const operation = barrier.run(start);
    expect(start).toHaveBeenCalledOnce();
    expect(barrier.activeCount()).toBe(1);

    blocked = true;
    let drained = false;
    const drain = barrier.waitForSettled().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    expect(barrier.run(() => Promise.resolve('late'))).toBeNull();

    native.resolve('done');
    await expect(operation).resolves.toBe('done');
    await drain;
    expect(barrier.activeCount()).toBe(0);
  });

  it('drains rejected operations without hiding their caller-visible error', async () => {
    const barrier = createRevenueCatOperationBarrier(() => false);
    const pending = barrier.run(() => Promise.reject(new Error('native failure')));

    await expect(pending).rejects.toThrow('native failure');
    await expect(barrier.waitForSettled()).resolves.toBeUndefined();
    expect(barrier.activeCount()).toBe(0);
  });

  it('refuses synchronously blocked work without invoking native code', () => {
    const barrier = createRevenueCatOperationBarrier(() => true);
    const native = vi.fn();

    expect(barrier.run(native)).toBeNull();
    expect(native).not.toHaveBeenCalled();
  });
});
