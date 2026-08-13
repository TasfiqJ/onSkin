import { describe, expect, it, vi } from 'vitest';

import { createDevLocalResetCoordinator } from './devLocalResetCoordinator';
import {
  createSessionBoundaryQueueState,
  enqueueSessionBoundaryOperation,
} from './sessionBoundaryQueue';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('session boundary queue', () => {
  it('serializes a forced reset between concurrent session reconciliation and publication', async () => {
    const state = createSessionBoundaryQueueState();
    const releaseAuth = deferred<void>();
    const releaseFirstClear = deferred<void>();
    const events: string[] = [];
    let clearCount = 0;
    const resetCoordinator = createDevLocalResetCoordinator({
      clearAccountState: async () => {
        clearCount += 1;
        events.push(`clear:${clearCount}:start`);
        if (clearCount === 1) await releaseFirstClear.promise;
        events.push(`clear:${clearCount}:end`);
      },
      claimOwnership: async (userId) => {
        events.push(`claim:${userId}`);
      },
    });
    await resetCoordinator.requestSingleFlight(async () => undefined);
    const enqueue = (
      targetUserId: string,
      options: {
        forceQueue?: boolean;
        run: Parameters<typeof enqueueSessionBoundaryOperation>[1]['run'];
      },
    ) =>
      enqueueSessionBoundaryOperation(state, {
        effectEpoch: 1,
        forceQueue: options.forceQueue,
        onQueued: () => undefined,
        resumeAfterInherited: async () => undefined,
        run: options.run,
        targetUserId,
      });

    const auth = enqueue('owner-a', {
      run: async ({ isCurrent }) => {
        events.push('auth:start');
        await releaseAuth.promise;
        if (isCurrent()) events.push('publish:owner-a');
        events.push('auth:end');
      },
    });
    const reset = enqueue('owner-a', {
      forceQueue: true,
      run: async ({ isCurrent }) => {
        events.push('reset:start');
        await resetCoordinator.runIfRequired('owner-a', isCurrent);
        if (isCurrent()) events.push('publish:reset-owner-a');
        events.push('reset:end');
      },
    });

    await vi.waitFor(() => expect(events).toEqual(['auth:start']));
    releaseAuth.resolve();
    await vi.waitFor(() =>
      expect(events).toEqual([
        'auth:start',
        'auth:end',
        'reset:start',
        'clear:1:start',
      ]),
    );
    const ownerB = enqueue('owner-b', {
      run: async ({ isCurrent }) => {
        events.push('owner-b:start');
        await resetCoordinator.runIfRequired('owner-b', isCurrent);
        if (isCurrent()) events.push('publish:owner-b');
      },
    });

    releaseFirstClear.resolve();
    await Promise.all([auth, reset, ownerB]);

    expect(events).toEqual([
      'auth:start',
      'auth:end',
      'reset:start',
      'clear:1:start',
      'clear:1:end',
      'reset:end',
      'owner-b:start',
      'clear:2:start',
      'clear:2:end',
      'claim:owner-b',
      'publish:owner-b',
    ]);
    expect(events).not.toContain('claim:owner-a');
    expect(events.filter((event) => event.startsWith('publish:'))).toEqual([
      'publish:owner-b',
    ]);
  });

  it('does not deduplicate a forced same-owner reset, but coalesces a later refresh into it', async () => {
    const state = createSessionBoundaryQueueState();
    const releaseReset = deferred<void>();
    const resetRun = vi.fn(async () => releaseReset.promise);
    const refreshRun = vi.fn(async () => undefined);

    const reset = enqueueSessionBoundaryOperation(state, {
      effectEpoch: 1,
      forceQueue: true,
      onQueued: () => undefined,
      resumeAfterInherited: async () => undefined,
      run: resetRun,
      targetUserId: 'owner-a',
    });
    const refresh = enqueueSessionBoundaryOperation(state, {
      effectEpoch: 1,
      onQueued: () => undefined,
      resumeAfterInherited: async () => undefined,
      run: refreshRun,
      targetUserId: 'owner-a',
    });

    expect(refresh).toBe(reset);
    await vi.waitFor(() => expect(resetRun).toHaveBeenCalledOnce());
    expect(refreshRun).not.toHaveBeenCalled();
    releaseReset.resolve();
    await expect(refresh).resolves.toBeUndefined();
  });
});
