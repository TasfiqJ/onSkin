import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OfflineSync } from './OfflineSync';

const OFFLINE_SYNC = fileURLToPath(new URL('./OfflineSync.tsx', import.meta.url));

const h = vi.hoisted(() => ({
  appState: 'active',
  appStateListener: null as ((state: string) => void) | null,
  online: true,
  onlineListener: null as ((online: boolean) => void) | null,
  queueListener: null as (() => void) | null,
  shelfListener: null as (() => void) | null,
  completionListener: null as (() => void) | null,
  leaseListener: null as ((lease: unknown) => void) | null,
  lease: null as Readonly<{
    generation: number;
    epoch: number;
    ownerUserId: string;
    accountGeneration: number;
    expiresAt: null;
  }> | null,
  flushCompletions: vi.fn(),
  flushShelfMirrorQueue: vi.fn(),
  drainCatalogLookupQueue: vi.fn(),
  maintainCatalogLookupQueue: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
  onlineManager: {
    isOnline: () => h.online,
    subscribe: (listener: (online: boolean) => void) => {
      h.onlineListener = listener;
      return vi.fn();
    },
  },
}));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return h.appState;
    },
    addEventListener: vi.fn((_event: string, listener: (state: string) => void) => {
      h.appStateListener = listener;
      return { remove: vi.fn() };
    }),
  },
}));
vi.mock('@/lib/consent/healthProcessingEpoch', () => ({
  activeHealthProcessingLeaseSnapshot: () => h.lease,
  subscribeActiveHealthProcessingLeaseChanges: (listener: (lease: unknown) => void) => {
    h.leaseListener = listener;
    return () => {
      if (h.leaseListener === listener) h.leaseListener = null;
    };
  },
}));
vi.mock('./completionQueue', () => ({
  flushCompletions: h.flushCompletions,
}));
vi.mock('./shelfMirrorQueue', () => ({
  flushShelfMirrorQueue: h.flushShelfMirrorQueue,
}));
vi.mock('@/features/shelf/store', () => ({
  subscribeShelfMirrorOutboxChanges: (listener: () => void) => {
    h.shelfListener = listener;
    return () => {
      if (h.shelfListener === listener) h.shelfListener = null;
    };
  },
}));
vi.mock('@/features/today/completionsStore', () => ({
  subscribeCompletionSyncOutboxChanges: (listener: () => void) => {
    h.completionListener = listener;
    return () => {
      if (h.completionListener === listener) h.completionListener = null;
    };
  },
}));
vi.mock('./catalogLookupQueue', () => ({
  drainCatalogLookupQueue: h.drainCatalogLookupQueue,
  maintainCatalogLookupQueue: h.maintainCatalogLookupQueue,
  subscribeCatalogLookupQueueChanges: (listener: () => void) => {
    h.queueListener = listener;
    return vi.fn();
  },
}));

let renderer: ReactTestRenderer | null = null;

async function flushEffects(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  h.appStateListener = null;
  h.appState = 'active';
  h.online = true;
  h.onlineListener = null;
  h.queueListener = null;
  h.shelfListener = null;
  h.completionListener = null;
  h.leaseListener = null;
  h.lease = null;
  h.flushCompletions.mockReset().mockResolvedValue({ flushed: 1, terminal: 0, remaining: 0 });
  h.flushShelfMirrorQueue.mockReset().mockResolvedValue({
    flushed: 0,
    terminal: 0,
    remaining: 0,
    retryable: false,
  });
  h.drainCatalogLookupQueue.mockReset().mockResolvedValue({
    attempted: 0,
    ready: 0,
    resolved: 0,
    deferred: 0,
    expired: 0,
    remaining: 0,
    nextRetryAt: null,
    nextExpiryAt: null,
  });
  h.maintainCatalogLookupQueue.mockReset().mockResolvedValue({
    expired: 0,
    remaining: 0,
    nextRetryAt: null,
    nextExpiryAt: null,
  });
  h.invalidateQueries.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
  vi.useRealTimers();
});

describe('OfflineSync health-processing admission', () => {
  it('does not read or flush on mount or foreground while no epoch is active', async () => {
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).not.toHaveBeenCalled();
    expect(h.flushCompletions).not.toHaveBeenCalled();
    expect(h.drainCatalogLookupQueue).not.toHaveBeenCalled();

    await act(async () => h.appStateListener?.('active'));
    await flushEffects();
    expect(h.flushShelfMirrorQueue).not.toHaveBeenCalled();
    expect(h.flushCompletions).not.toHaveBeenCalled();
    expect(h.drainCatalogLookupQueue).not.toHaveBeenCalled();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('flushes on mount and foreground only while the same active epoch remains current', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['completions'] });
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['progress'] });
    expect(h.flushShelfMirrorQueue.mock.invocationCallOrder[0]).toBeLessThan(
      h.flushCompletions.mock.invocationCallOrder[0]!,
    );

    await act(async () => h.appStateListener?.('background'));
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();
    await act(async () => h.appStateListener?.('active'));
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
  });

  it('starts queued work when a null lease becomes active while mounted', async () => {
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).not.toHaveBeenCalled();
    expect(h.flushCompletions).not.toHaveBeenCalled();
    expect(h.drainCatalogLookupQueue).not.toHaveBeenCalled();

    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => h.leaseListener?.(h.lease));
    await flushEffects();

    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();
  });

  it('cancels the old catalog wake and reruns on a fresh lease generation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.drainCatalogLookupQueue.mockResolvedValueOnce({
      attempted: 1,
      ready: 0,
      resolved: 0,
      deferred: 1,
      expired: 0,
      remaining: 1,
      nextRetryAt: '2026-07-18T12:00:30.000Z',
      nextExpiryAt: '2026-07-25T12:00:00.000Z',
    });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();

    h.lease = {
      generation: 2,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => h.leaseListener?.(h.lease));
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
  });

  it('publishes newly ready catalog candidates only into the same admitted lease', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.drainCatalogLookupQueue.mockResolvedValueOnce({
      attempted: 1,
      ready: 1,
      resolved: 0,
      deferred: 0,
      expired: 0,
      remaining: 1,
      nextRetryAt: null,
      nextExpiryAt: '2026-07-25T12:00:00.000Z',
    });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['catalog-lookup-ready'] });

    h.invalidateQueries.mockClear();
    let resolveCatalog!: (result: {
      attempted: number;
      ready: number;
      resolved: number;
      deferred: number;
      expired: number;
      remaining: number;
      nextRetryAt: string | null;
      nextExpiryAt: string | null;
    }) => void;
    h.drainCatalogLookupQueue.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCatalog = resolve;
      }),
    );
    await act(async () => h.appStateListener?.('active'));
    h.lease = null;
    resolveCatalog({
      attempted: 1,
      ready: 1,
      resolved: 0,
      deferred: 0,
      expired: 0,
      remaining: 1,
      nextRetryAt: null,
      nextExpiryAt: '2026-07-25T12:00:00.000Z',
    });
    await flushEffects();
    expect(h.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['catalog-lookup-ready'] });
  });

  it('keeps the catalog drain independent from completion publication failures', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushCompletions.mockRejectedValueOnce(new Error('completion network failure'));
    h.drainCatalogLookupQueue.mockRejectedValueOnce(new Error('catalog network failure'));

    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();

    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('drains on an online transition only while the app is active', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();

    h.online = false;
    await act(async () => h.onlineListener?.(false));
    await flushEffects();
    expect(h.maintainCatalogLookupQueue).toHaveBeenCalledOnce();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).toHaveBeenCalledOnce();

    h.online = true;
    await act(async () => h.onlineListener?.(true));
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);

    h.appState = 'background';
    await act(async () => h.appStateListener?.('background'));
    h.online = false;
    await act(async () => h.onlineListener?.(false));
    h.online = true;
    await act(async () => h.onlineListener?.(true));
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
  });

  it('reacts to a newly enqueued item while mounted', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();

    await act(async () => h.queueListener?.());
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
  });

  it('drains a newly journaled completion while online and foregrounded', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();

    await act(async () => h.completionListener?.());
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);

    h.online = false;
    await act(async () => h.onlineListener?.(false));
    await act(async () => h.completionListener?.());
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);
  });

  it('starts completions after a terminal Shelf head is quarantined and the queue drains', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushShelfMirrorQueue.mockResolvedValueOnce({
      flushed: 0,
      terminal: 1,
      remaining: 0,
      retryable: false,
    });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();

    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.flushShelfMirrorQueue.mock.invocationCallOrder[0]).toBeLessThan(
      h.flushCompletions.mock.invocationCallOrder[0]!,
    );
  });

  it('backs off a thrown Shelf flush without starting completions', async () => {
    vi.useFakeTimers();
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushShelfMirrorQueue
      .mockRejectedValueOnce(new Error('SHELF_MIRROR_RESPONSE_INVALID'))
      .mockResolvedValueOnce({
        flushed: 0,
        terminal: 0,
        remaining: 0,
        retryable: false,
      });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledOnce();
  });

  it('drains a newly journaled Shelf operation before completions', async () => {
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    h.flushShelfMirrorQueue.mockClear();
    h.flushCompletions.mockClear();

    await act(async () => h.shelfListener?.());
    await flushEffects();

    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    expect(h.flushShelfMirrorQueue.mock.invocationCallOrder[0]).toBeLessThan(
      h.flushCompletions.mock.invocationCallOrder[0]!,
    );
  });

  it('retries remaining Shelf work with bounded online backoff before completions', async () => {
    vi.useFakeTimers();
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushShelfMirrorQueue
      .mockResolvedValueOnce({
        flushed: 0,
        terminal: 0,
        remaining: 1,
        retryable: true,
      })
      .mockResolvedValueOnce({
        flushed: 1,
        terminal: 0,
        remaining: 0,
        retryable: false,
      });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushEffects();
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledTimes(2);
    expect(h.flushCompletions).toHaveBeenCalledOnce();
  });

  it('retries remaining completion work with bounded online backoff', async () => {
    vi.useFakeTimers();
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushCompletions
      .mockResolvedValueOnce({ flushed: 0, terminal: 0, remaining: 1 })
      .mockResolvedValueOnce({ flushed: 1, terminal: 0, remaining: 0 });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();
    expect(h.flushCompletions).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    await flushEffects();
    expect(h.flushCompletions).toHaveBeenCalledOnce();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushEffects();
    expect(h.flushCompletions).toHaveBeenCalledTimes(2);
  });

  it('wakes at the exact next online retry time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.drainCatalogLookupQueue.mockResolvedValueOnce({
      attempted: 1,
      ready: 0,
      resolved: 0,
      deferred: 1,
      expired: 0,
      remaining: 1,
      nextRetryAt: '2026-07-18T12:00:30.000Z',
      nextExpiryAt: '2026-07-25T12:00:00.000Z',
    });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();

    await act(async () => {
      vi.advanceTimersByTime(29_999);
    });
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledOnce();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushEffects();
    expect(h.drainCatalogLookupQueue).toHaveBeenCalledTimes(2);
  });

  it('ignores a due retry while offline but wakes exactly for physical expiry cleanup', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
    h.online = false;
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.maintainCatalogLookupQueue.mockResolvedValueOnce({
      expired: 0,
      remaining: 1,
      nextRetryAt: '2026-07-18T12:00:00.000Z',
      nextExpiryAt: '2026-07-18T12:01:00.000Z',
    });
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    await flushEffects();

    await act(async () => {
      vi.advanceTimersByTime(59_999);
    });
    await flushEffects();
    expect(h.maintainCatalogLookupQueue).toHaveBeenCalledOnce();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await flushEffects();
    expect(h.maintainCatalogLookupQueue).toHaveBeenCalledTimes(2);
    expect(h.drainCatalogLookupQueue).not.toHaveBeenCalled();
  });

  it('does not start completion replay when the Shelf barrier settles after lease closure', async () => {
    let resolveShelf!: (result: {
      flushed: number;
      terminal: number;
      remaining: number;
      retryable: boolean;
    }) => void;
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushShelfMirrorQueue.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveShelf = resolve;
      }),
    );
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    expect(h.flushShelfMirrorQueue).toHaveBeenCalledOnce();
    expect(h.flushCompletions).not.toHaveBeenCalled();

    h.lease = null;
    resolveShelf({ flushed: 1, terminal: 0, remaining: 0, retryable: false });
    await flushEffects();

    expect(h.flushCompletions).not.toHaveBeenCalled();
  });

  it('does not publish a flush that settles after processing closes', async () => {
    let resolve!: (result: { flushed: number; remaining: number }) => void;
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushCompletions.mockReturnValueOnce(
      new Promise((next) => {
        resolve = next;
      }),
    );
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });
    expect(h.flushCompletions).toHaveBeenCalledOnce();

    h.lease = null;
    resolve({ flushed: 1, remaining: 0 });
    await flushEffects();
    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('does not publish across an exact numeric epoch owner/generation collision', async () => {
    let resolve!: (result: { flushed: number; remaining: number }) => void;
    h.lease = {
      generation: 1,
      epoch: 4,
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      expiresAt: null,
    };
    h.flushCompletions.mockReturnValueOnce(
      new Promise((next) => {
        resolve = next;
      }),
    );
    await act(async () => {
      renderer = create(createElement(OfflineSync));
    });

    h.lease = {
      generation: 2,
      epoch: 4,
      ownerUserId: 'owner-b',
      accountGeneration: 1,
      expiresAt: null,
    };
    resolve({ flushed: 1, remaining: 0 });
    await flushEffects();

    expect(h.invalidateQueries).not.toHaveBeenCalled();
  });

  it('refreshes the queries Today actually reads after an admitted completion flush', () => {
    const source = readFileSync(OFFLINE_SYNC, 'utf8');

    expect(source).toContain("invalidateQueries({ queryKey: ['completions'] })");
    expect(source).toContain("invalidateQueries({ queryKey: ['progress'] })");
    expect(source).not.toContain("invalidateQueries({ queryKey: ['today'] })");
  });
});
