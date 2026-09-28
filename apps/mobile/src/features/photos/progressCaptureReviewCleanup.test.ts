import { describe, expect, it, vi } from 'vitest';

import { createProgressReviewCleanupOwner } from './progressCaptureReviewCleanup';

describe('forced Progress review unmount cleanup owner', () => {
  it('retains a failed forced-unmount cleanup and retries the exact lifecycle', async () => {
    const lifecycle = {
      dispose: vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('filesystem busy'))
        .mockResolvedValueOnce(undefined),
    };
    const owner = createProgressReviewCleanupOwner();

    await expect(owner.retainAndDispose(lifecycle)).rejects.toThrow('filesystem busy');
    expect(owner.hasPending()).toBe(true);
    await expect(owner.retry()).resolves.toBe(1);
    expect(owner.hasPending()).toBe(false);
    expect(lifecycle.dispose).toHaveBeenCalledTimes(2);
  });

  it('serializes a retry behind the first forced-unmount cleanup attempt', async () => {
    let release!: () => void;
    const first = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lifecycle = {
      dispose: vi.fn<() => Promise<void>>().mockImplementationOnce(() => first),
    };
    const owner = createProgressReviewCleanupOwner();

    const retained = owner.retainAndDispose(lifecycle);
    const retry = owner.retry();
    await vi.waitFor(() => expect(lifecycle.dispose).toHaveBeenCalledOnce());
    release();
    await expect(retained).resolves.toBeUndefined();
    await expect(retry).resolves.toBe(0);
    expect(lifecycle.dispose).toHaveBeenCalledOnce();
  });
});
