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

  it('clears a synchronous throw so explicit retry is not stuck', async () => {
    const promiseRef: PhotoDeleteRetryPromiseRef = { current: null };
    await expect(runPhotoDeleteRetrySingleFlight(promiseRef, () => {
      throw new Error('SYNC_FAILURE');
    })).rejects.toThrow('SYNC_FAILURE');
    expect(promiseRef.current).toBeNull();
    await expect(runPhotoDeleteRetrySingleFlight(promiseRef, async () => undefined)).resolves.toBeUndefined();
  });

  it('reserves the promise before an operation can activate retry re-entrantly', async () => {
    const promiseRef: PhotoDeleteRetryPromiseRef = { current: null };
    const duplicateOperation = vi.fn(async () => undefined);
    let nested: Promise<void> | null = null;
    const first = runPhotoDeleteRetrySingleFlight(promiseRef, async () => {
      nested = runPhotoDeleteRetrySingleFlight(promiseRef, duplicateOperation);
    });
    expect(nested).toBe(first);
    await first;
    expect(duplicateOperation).not.toHaveBeenCalled();
    expect(promiseRef.current).toBeNull();
  });

});
