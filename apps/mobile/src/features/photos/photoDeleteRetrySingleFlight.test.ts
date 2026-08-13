import { describe, expect, it, vi } from 'vitest';

import {
  runPhotoDeleteRetrySingleFlight,
  type PhotoDeleteRetryPromiseRef,
} from './photoDeleteRetrySingleFlight';

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('photo deletion retry single-flight coordinator', () => {
  it('joins duplicate activation and permits another attempt after completion', async () => {
    const firstAttempt = deferred();
    const secondAttempt = deferred();
    const operation = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstAttempt.promise)
      .mockReturnValueOnce(secondAttempt.promise);
    const promiseRef: PhotoDeleteRetryPromiseRef = { current: null };

    const first = runPhotoDeleteRetrySingleFlight(promiseRef, operation);
    const duplicate = runPhotoDeleteRetrySingleFlight(promiseRef, operation);

    expect(duplicate).toBe(first);
    expect(operation).toHaveBeenCalledTimes(1);

    firstAttempt.resolve();
    await first;
    expect(promiseRef.current).toBeNull();

    const next = runPhotoDeleteRetrySingleFlight(promiseRef, operation);
    expect(next).not.toBe(first);
    expect(operation).toHaveBeenCalledTimes(2);
    secondAttempt.resolve();
    await next;
  });

  it('clears a failed attempt so retry remains available', async () => {
    const failure = new Error('retry failed');
    const operation = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue();
    const promiseRef: PhotoDeleteRetryPromiseRef = { current: null };

    await expect(runPhotoDeleteRetrySingleFlight(promiseRef, operation)).rejects.toBe(failure);
    expect(promiseRef.current).toBeNull();

    await expect(runPhotoDeleteRetrySingleFlight(promiseRef, operation)).resolves.toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(2);
    expect(promiseRef.current).toBeNull();
  });
});
