import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_GENERATION_CHANGED,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
} from '@/lib/auth/accountGeneration';
import { createOwnerQueryScope } from '@/lib/query/queryKeys';

import { groundedTurnsQueryOptions } from './groundedTurnsQuery';
import { getGroundedTurns } from './store';

vi.mock('./store', () => ({
  getGroundedTurns: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function runQuery(options: ReturnType<typeof groundedTurnsQueryOptions>): Promise<number> {
  return (options.queryFn as () => Promise<number>)();
}

describe('owner-bound Ask grounded-turn operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a delayed account-A quota read after the account generation changes', async () => {
    const scopeA = createOwnerQueryScope();
    const read = deferred<number>();
    vi.mocked(getGroundedTurns).mockReturnValueOnce(read.promise);
    const pending = runQuery(groundedTurnsQueryOptions(scopeA, '2026-07'));

    beginAccountGenerationBoundary();
    try {
      read.resolve(3);
      await expect(pending).rejects.toThrow(ACCOUNT_GENERATION_CHANGED);
    } finally {
      endAccountGenerationBoundary();
    }
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
});
