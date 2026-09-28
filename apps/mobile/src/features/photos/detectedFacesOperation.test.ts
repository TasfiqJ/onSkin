import { describe, expect, it, vi } from 'vitest';

import { runDetectedFacesOperation } from './detectedFacesOperation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('native face detector publication fence', () => {
  it('publishes no result or fallback error after account-signal abort wins the native race', async () => {
    const native = deferred<{ success: boolean; faces: unknown[] }>();
    const account = new AbortController();
    const published: string[] = [];
    const operation = runDetectedFacesOperation({
      control: {
        signal: account.signal,
        assertActive: () => {
          if (account.signal.aborted) throw new Error('ACCOUNT_GENERATION_CHANGED');
        },
      },
      detector: {
        status: 'ready',
        initialize: vi.fn(async () => undefined),
        detectFaces: vi.fn(() => native.promise),
      },
      isCancelled: () => false,
      publish: (result) => published.push(result.status),
      uri: 'file:///capture.jpg',
    });
    await vi.waitFor(() => expect(published).toEqual(['modelLoading', 'detecting']));

    account.abort();
    native.resolve({ success: true, faces: [] });
    await operation;

    expect(published).toEqual(['modelLoading', 'detecting']);
  });

  it('asserts the lease after initialization before publishing detector failure', async () => {
    const initialization = deferred<void>();
    const account = new AbortController();
    const published: string[] = [];
    const detector = {
      status: 'loading',
      initialize: vi.fn(() => initialization.promise),
      detectFaces: vi.fn(),
    };
    const operation = runDetectedFacesOperation({
      control: {
        signal: account.signal,
        assertActive: () => {
          if (account.signal.aborted) throw new Error('ACCOUNT_GENERATION_CHANGED');
        },
      },
      detector,
      isCancelled: () => false,
      publish: (result) => published.push(result.status),
      uri: 'file:///capture.jpg',
    });
    await vi.waitFor(() => expect(published).toEqual(['modelLoading']));

    account.abort();
    initialization.resolve();
    await operation;

    expect(published).toEqual(['modelLoading']);
    expect(detector.detectFaces).not.toHaveBeenCalled();
  });
});
