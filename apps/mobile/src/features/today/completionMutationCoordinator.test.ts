import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { AccountGenerationLeaseError } from '@/lib/auth/accountGeneration';
import { OWNER_QUERY_NAMESPACE, queryKeys, type OwnerQueryScope } from '@/lib/query/queryKeys';

import {
  commitTodayCompletionForOwner,
  mergeCompletionSnapshot,
} from './completionMutationCoordinator';
import type { CompletionCommitResult } from './completionsStore';

const SCOPE: OwnerQueryScope = { generation: 7 };
const BOUNDARY = {
  localDate: '2026-07-15',
  timeZone: 'America/Toronto|offset:240',
};

function committed(
  steps: readonly string[],
  overrides: Partial<Extract<CompletionCommitResult, { status: 'committed' }>> = {},
): Extract<CompletionCommitResult, { status: 'committed' }> {
  return {
    status: 'committed',
    done: true,
    firstEver: false,
    changed: true,
    date: BOUNDARY.localDate,
    completedSteps: new Set(steps),
    ...overrides,
  };
}

describe('Today completion cache publication', () => {
  it('publishes only after durable completion and never waits for Progress reconciliation', async () => {
    let releaseCommit!: () => void;
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    let releaseReconciliation!: () => void;
    const reconciliation = new Promise<void>((resolve) => {
      releaseReconciliation = resolve;
    });
    const published: { key: readonly unknown[]; value: Set<string> }[] = [];
    const reconcileProgress = vi.fn(() => reconciliation);

    const pending = commitTodayCompletionForOwner({
      boundary: BOUNDARY,
      cancel: async () => {},
      isOwnerCurrent: () => true,
      operation: async () => {
        await commitGate;
        return committed(['AM:cleanser']);
      },
      publish: (key, update) => published.push({ key, value: update(undefined) }),
      readBoundary: () => BOUNDARY,
      reconcileProgress,
      scope: SCOPE,
    });

    await Promise.resolve();
    expect(published).toEqual([]);
    releaseCommit();

    await expect(pending).resolves.toMatchObject({ published: true });
    expect(reconcileProgress).toHaveBeenCalledOnce();
    expect(published).toEqual([
      {
        key: [
          'completions',
          OWNER_QUERY_NAMESPACE,
          7,
          'local-day',
          '2026-07-15',
          'America/Toronto|offset:240',
        ],
        value: new Set(['AM:cleanser']),
      },
    ]);

    releaseReconciliation();
  });

  it('rejects a stale owner before invoking the durable operation', async () => {
    const operation = vi.fn(async () => committed(['AM:cleanser']));

    await expect(
      commitTodayCompletionForOwner({
        boundary: BOUNDARY,
        cancel: async () => {},
        isOwnerCurrent: () => false,
        operation,
        publish: () => {},
        scope: SCOPE,
      }),
    ).rejects.toBeInstanceOf(AccountGenerationLeaseError);
    expect(operation).not.toHaveBeenCalled();
  });

  it('suppresses publication when the captured owner changes during persistence', async () => {
    let current = true;
    const cancel = vi.fn();
    const publish = vi.fn();

    const result = await commitTodayCompletionForOwner({
      boundary: BOUNDARY,
      cancel,
      isOwnerCurrent: () => current,
      operation: async () => {
        current = false;
        return committed(['AM:cleanser']);
      },
      publish,
      scope: SCOPE,
    });

    expect(result.published).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('never publishes an old-date snapshot into the new local-day key', async () => {
    const keys: (readonly unknown[])[] = [];

    await commitTodayCompletionForOwner({
      boundary: BOUNDARY,
      cancel: async () => {},
      isOwnerCurrent: () => true,
      operation: async () => committed(['PM:retinol']),
      publish: (key) => keys.push(key),
      readBoundary: () => ({
        localDate: '2026-07-16',
        timeZone: BOUNDARY.timeZone,
      }),
      scope: SCOPE,
    });

    expect(keys).toEqual([queryKeys.completions(SCOPE, BOUNDARY)]);
  });

  it('publishes the same date into both exact timezone identities after travel', async () => {
    const travelled = {
      localDate: BOUNDARY.localDate,
      timeZone: 'America/Vancouver|offset:420',
    };
    const keys: (readonly unknown[])[] = [];

    await commitTodayCompletionForOwner({
      boundary: BOUNDARY,
      cancel: async () => {},
      isOwnerCurrent: () => true,
      operation: async () => committed(['PM:retinol']),
      publish: (key) => keys.push(key),
      readBoundary: () => travelled,
      scope: SCOPE,
    });

    expect(keys).toEqual([
      queryKeys.completions(SCOPE, BOUNDARY),
      queryKeys.completions(SCOPE, travelled),
    ]);
  });

  it('unions reverse-order publications without mutating the existing Set', () => {
    const current = new Set(['AM:cleanser']);
    const newer = mergeCompletionSnapshot(current, new Set(['AM:cleanser', 'AM:spf']));
    const older = mergeCompletionSnapshot(newer, new Set(['AM:cleanser', 'AM:serum']));

    expect(current).toEqual(new Set(['AM:cleanser']));
    expect(newer).not.toBe(current);
    expect(older).toEqual(new Set(['AM:cleanser', 'AM:spf', 'AM:serum']));
  });

  it('cancels a stale exact read before publishing the durable snapshot', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const key = queryKeys.completions(SCOPE, BOUNDARY);
    let releaseRead!: (value: Set<string>) => void;
    const staleRead = client
      .fetchQuery({
        queryKey: key,
        queryFn: () =>
          new Promise<Set<string>>((resolve) => {
            releaseRead = resolve;
          }),
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(releaseRead).toBeTypeOf('function'));

    await commitTodayCompletionForOwner({
      boundary: BOUNDARY,
      cancel: (queryKey) => client.cancelQueries({ queryKey }),
      isOwnerCurrent: () => true,
      operation: async () => committed(['AM:cleanser']),
      publish: (queryKey, update) => client.setQueryData(queryKey, update),
      readBoundary: () => BOUNDARY,
      scope: SCOPE,
    });

    releaseRead(new Set());
    await staleRead;
    expect(client.getQueryData(key)).toEqual(new Set(['AM:cleanser']));
    client.clear();
  });
});
