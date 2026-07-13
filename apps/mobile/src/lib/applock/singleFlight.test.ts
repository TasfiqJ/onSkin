import { describe, expect, it, vi } from 'vitest';

import { runSingleFlight, type SingleFlightLease } from './singleFlight';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('app-lock authentication single flight', () => {
  it('shares one in-flight native prompt across concurrent callers', async () => {
    const pending = deferred<'success'>();
    const operation = vi.fn(() => pending.promise);
    const lease: SingleFlightLease<'success'> = { current: null };

    const first = runSingleFlight(lease, operation);
    const second = runSingleFlight(lease, operation);

    expect(first).toBe(second);
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);

    pending.resolve('success');
    await expect(first).resolves.toBe('success');
    await Promise.resolve();
    expect(lease.current).toBeNull();
  });

  it('releases the lease after failure so retry can prompt again', async () => {
    const firstAttempt = deferred<'success'>();
    const operation = vi
      .fn<() => Promise<'success'>>()
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockResolvedValueOnce('success');
    const lease: SingleFlightLease<'success'> = { current: null };

    const first = runSingleFlight(lease, operation);
    firstAttempt.reject(new Error('native prompt failed'));
    await expect(first).rejects.toThrow('native prompt failed');
    await Promise.resolve();

    await expect(runSingleFlight(lease, operation)).resolves.toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
