import { describe, expect, it, vi } from 'vitest';

import { createCaptureAnalysisCoordinator } from './captureAnalysisCoordinator';
import { PhotoAnalysisCleanupError } from './photoAnalysisCleanup';

vi.mock('@/lib/auth/accountGeneration', () => ({
  runAccountGenerationOperation: async <T>(
    operation: (lease: {
      assertCurrent: () => void;
      generation: number;
      signal: AbortSignal;
    }) => Promise<T>,
  ) =>
    operation({
      assertCurrent: () => undefined,
      generation: 0,
      signal: new AbortController().signal,
    }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('capture analysis coordinator', () => {
  it('aborts a replaced URI and drains its native work before route cleanup', async () => {
    const coordinator = createCaptureAnalysisCoordinator();
    const first = coordinator.activate('file:///first.jpg')!;
    const native = deferred<void>();
    const observed: string[] = [];
    const operation = first.run(async (control) => {
      await native.promise;
      observed.push(control.signal.aborted ? 'aborted' : 'current');
      control.assertActive();
    });
    await Promise.resolve();

    coordinator.activate('file:///second.jpg');
    const drain = coordinator.abortAndDrain();
    expect(observed).toEqual([]);
    native.resolve();
    await expect(operation).rejects.toThrow();
    await expect(drain).resolves.toBeUndefined();
    expect(observed).toEqual(['aborted']);
  });

  it('blocks drain on plaintext cleanup and retries the exact retained cleanup', async () => {
    const coordinator = createCaptureAnalysisCoordinator();
    const lease = coordinator.activate('file:///capture.jpg')!;
    const retry = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('still busy'))
      .mockResolvedValueOnce(undefined);
    await lease
      .run(async () => {
        throw new PhotoAnalysisCleanupError(retry);
      })
      .catch(() => undefined);

    expect(coordinator.hasPendingCleanup()).toBe(true);
    await expect(coordinator.abortAndDrain()).rejects.toThrow('still busy');
    expect(coordinator.hasPendingCleanup()).toBe(true);
    await expect(coordinator.abortAndDrain()).resolves.toBeUndefined();
    expect(coordinator.hasPendingCleanup()).toBe(false);
    expect(retry).toHaveBeenCalledTimes(2);
  });
});
