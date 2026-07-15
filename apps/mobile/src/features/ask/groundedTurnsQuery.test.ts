import { onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope, queryKeys } from '@/lib/query/queryKeys';

import { groundedTurnsQueryOptions } from './groundedTurnsQuery';
import { getGroundedTurns } from './store';

vi.mock('./store', () => ({
  getGroundedTurns: vi.fn(),
}));

function deferred<T>() {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

function runQuery(options: ReturnType<typeof groundedTurnsQueryOptions>): Promise<number> {
  return (options.queryFn as () => Promise<number>)();
}

describe('owner-bound Ask grounded-turn operations', () => {
  beforeEach(() => {
    vi.mocked(getGroundedTurns).mockReset();
    vi.mocked(getGroundedTurns).mockResolvedValue(0);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('executes the local quota read while the device is offline', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ownerScope = createOwnerQueryScope();
    onlineManager.setOnline(false);
    vi.mocked(getGroundedTurns).mockResolvedValueOnce(2);

    await expect(
      client.fetchQuery(groundedTurnsQueryOptions(ownerScope, '2026-07')),
    ).resolves.toBe(2);

    expect(getGroundedTurns).toHaveBeenCalledExactlyOnceWith('2026-07');
    expect(client.getQueryData(queryKeys.askGroundedTurns(ownerScope, '2026-07'))).toBe(2);
    client.clear();
  });

  it('detaches a never-resolving quota read so the account boundary can drain', async () => {
    vi.mocked(getGroundedTurns).mockReturnValueOnce(new Promise<number>(() => undefined));
    const pending = runQuery(
      groundedTurnsQueryOptions(createOwnerQueryScope(), '2026-07'),
    );
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pending).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('lets account cancellation dominate a later typed storage failure', async () => {
    const read = deferred<number>();
    vi.mocked(getGroundedTurns).mockReturnValueOnce(read.promise);
    const pending = runQuery(
      groundedTurnsQueryOptions(createOwnerQueryScope(), '2026-07'),
    );
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pending).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();

      read.reject(new Error('ASK_TURN_RECORD_UNAVAILABLE'));
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('never publishes a late account-A quota read into the fresh account-B cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scopeA = createOwnerQueryScope();
    const read = deferred<number>();
    vi.mocked(getGroundedTurns).mockReturnValueOnce(read.promise);
    const pendingA = client.fetchQuery(groundedTurnsQueryOptions(scopeA, '2026-07'));
    await Promise.resolve();

    beginAccountGenerationBoundary();
    try {
      await expect(pendingA).rejects.toMatchObject({ code: ACCOUNT_GENERATION_CHANGED });
      await expect(waitForAccountGenerationOperationsToSettle()).resolves.toBeUndefined();
    } finally {
      endAccountGenerationBoundary();
    }

    const scopeB = createOwnerQueryScope();
    vi.mocked(getGroundedTurns).mockResolvedValueOnce(1);
    await expect(
      client.fetchQuery(groundedTurnsQueryOptions(scopeB, '2026-07')),
    ).resolves.toBe(1);

    read.resolve(3);
    await Promise.resolve();
    await Promise.resolve();

    expect(client.getQueryData(queryKeys.askGroundedTurns(scopeA, '2026-07'))).toBeUndefined();
    expect(client.getQueryData(queryKeys.askGroundedTurns(scopeB, '2026-07'))).toBe(1);
    client.clear();
  });

  it('publishes a delayed read when the same owner generation remains current', async () => {
    const scope = createOwnerQueryScope();
    const read = deferred<number>();
    vi.mocked(getGroundedTurns).mockReturnValueOnce(read.promise);
    const options = groundedTurnsQueryOptions(scope, '2026-07');
    expect(options.networkMode).toBe('always');
    const pending = runQuery(options);

    read.resolve(2);

    await expect(pending).resolves.toBe(2);
  });

  it('preserves a genuine typed storage failure for the current owner', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = createOwnerQueryScope();
    vi.mocked(getGroundedTurns).mockRejectedValueOnce(
      new Error('ASK_TURN_RECORD_UNAVAILABLE'),
    );

    await expect(
      client.fetchQuery(groundedTurnsQueryOptions(scope, '2026-07')),
    ).rejects.toThrow('ASK_TURN_RECORD_UNAVAILABLE');
    expect(client.getQueryData(queryKeys.askGroundedTurns(scope, '2026-07'))).toBeUndefined();
    client.clear();
  });
});
